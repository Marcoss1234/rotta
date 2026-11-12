import secrets
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Annotated
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StringConstraints, field_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from auth import (
    SESSION_COOKIE,
    _ensure_indexes,
    _hash_token,
    _public_user,
    current_user,
    require_admin,
    start_session,
)
from database import get_db

Username = Annotated[
    str,
    BeforeValidator(lambda value: value.strip().lower() if isinstance(value, str) else value),
    StringConstraints(pattern=r"^[a-z0-9._-]{3,30}$"),
]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
FullName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]

# Nombres que harían creer que la cuenta es del club.
RESERVED_USERNAMES = {"admin", "administrador", "administracion", "root", "club", "tnt", "entrenador", "soporte"}

ATTEMPTS_WINDOW = timedelta(minutes=15)
REGISTER_WINDOW = timedelta(hours=1)
USER_ATTEMPTS = 5
IP_ATTEMPTS = 30
IP_REGISTRATIONS = 40
TEMPORARY_PASSWORD_LIFETIME = timedelta(hours=48)
# Sin letras ni números que se confundan al pasarla por mensaje (0/O, 1/l/I).
TEMPORARY_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
TEMPORARY_LENGTH = 14
TOO_MANY_ATTEMPTS = "Demasiados intentos. Espera unos minutos y vuelve a probar"
WRONG_LOGIN = "Usuario o contraseña incorrectos"

router = APIRouter(prefix="/api")
hasher = PasswordHasher()


class Registration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: FullName
    username: Username
    password: Password

    @field_validator("username")
    @classmethod
    def not_reserved(cls, value):
        if value in RESERVED_USERNAMES:
            raise ValueError("Ese nombre de usuario no está disponible")
        return value


class PasswordLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class PasswordSetup(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: Username
    password: Password

    @field_validator("username")
    @classmethod
    def not_reserved(cls, value):
        if value in RESERVED_USERNAMES:
            raise ValueError("Ese nombre de usuario no está disponible")
        return value


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)
    new_password: Password


def _now():
    return datetime.now(timezone.utc)


def _as_utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _client_ip(request):
    # Vercel rellena esta cabecera por su cuenta: quien llama no puede inventársela.
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "desconocida")


def _hash_password(password):
    return hasher.hash(password)


def _password_matches(stored_hash, password):
    try:
        return hasher.verify(stored_hash, password)
    except (VerificationError, InvalidHashError):
        return False


@lru_cache(maxsize=1)
def _dummy_hash():
    return hasher.hash(secrets.token_urlsafe(16))


def _reject_weak_password(password, username):
    if username in password.casefold():
        raise HTTPException(status_code=422, detail="La contraseña no puede contener tu nombre de usuario")


async def _over_limit(db, key, limit):
    attempt = await db.login_attempts.find_one({"key": key, "expires_at": {"$gt": _now()}})
    return bool(attempt and attempt["count"] >= limit)


async def _count_attempt(db, key, window):
    now = _now()
    # Mongo tarda hasta un minuto en borrar lo caducado: aquí no se puede contar con eso.
    await db.login_attempts.delete_one({"key": key, "expires_at": {"$lte": now}})
    change = {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": now + window}}
    try:
        await db.login_attempts.update_one({"key": key}, change, upsert=True)
    except DuplicateKeyError:
        await db.login_attempts.update_one({"key": key}, change)


@router.post("/auth/register", status_code=201)
async def register(body: Registration, request: Request, response: Response, db=Depends(get_db)):
    await _ensure_indexes(db)
    ip_key = f"register-ip:{_client_ip(request)}"
    if await _over_limit(db, ip_key, IP_REGISTRATIONS):
        raise HTTPException(status_code=429, detail=TOO_MANY_ATTEMPTS)
    _reject_weak_password(body.password, body.username)
    await _count_attempt(db, ip_key, REGISTER_WINDOW)

    user_id = str(uuid4())
    now = _now()
    user = {
        "id": user_id,
        # El índice de google_sub es único y no admite varios vacíos: aquí nunca coincide con uno de Google.
        "google_sub": f"local:{user_id}",
        "email": None,
        "username": body.username,
        "password_hash": await run_in_threadpool(_hash_password, body.password),
        "name": body.name,
        "picture": "",
        "status": "pending",
        "role": None,
        "created_at": now,
        "last_login_at": now,
    }
    try:
        await db.users.insert_one(user)
    except DuplicateKeyError as error:
        raise HTTPException(status_code=409, detail="Ese nombre de usuario ya está en uso") from error
    await start_session(db, user, response)
    return _public_user(user)


@router.post("/auth/login")
async def login(body: PasswordLogin, request: Request, response: Response, db=Depends(get_db)):
    await _ensure_indexes(db)
    username = body.username.strip().lower()
    user_key = f"login-user:{username}"
    ip_key = f"login-ip:{_client_ip(request)}"
    if await _over_limit(db, user_key, USER_ATTEMPTS) or await _over_limit(db, ip_key, IP_ATTEMPTS):
        raise HTTPException(status_code=429, detail=TOO_MANY_ATTEMPTS)

    user = await db.users.find_one({"username": username})
    stored_hash = user.get("password_hash") if user else None
    # También se calcula sin cuenta, para que la respuesta no delate qué usuarios existen.
    matches = await run_in_threadpool(_password_matches, stored_hash or _dummy_hash(), body.password)
    expires_at = user.get("temporary_password_expires_at") if user else None
    expired = bool(expires_at and _as_utc(expires_at) <= _now())
    if not stored_hash or not matches or expired:
        await _count_attempt(db, user_key, ATTEMPTS_WINDOW)
        await _count_attempt(db, ip_key, ATTEMPTS_WINDOW)
        raise HTTPException(status_code=401, detail=WRONG_LOGIN)

    await db.login_attempts.delete_one({"key": user_key})
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login_at": _now()}})
    await start_session(db, user, response)
    return _public_user(user)


@router.post("/auth/password/setup")
async def set_up_password(body: PasswordSetup, user=Depends(current_user), db=Depends(get_db)):
    """Para quien entró con Google: le deja un usuario y una contraseña para entrar sin Google."""
    if user.get("password_hash"):
        raise HTTPException(status_code=409, detail="Tu cuenta ya tiene contraseña: cámbiala desde Perfil")
    _reject_weak_password(body.password, body.username)
    await _ensure_indexes(db)
    try:
        updated = await db.users.find_one_and_update(
            # Solo si sigue sin contraseña, por si llegan dos peticiones a la vez.
            {"id": user["id"], "password_hash": {"$exists": False}},
            {
                "$set": {
                    "username": body.username,
                    "password_hash": await run_in_threadpool(_hash_password, body.password),
                    "must_change_password": False,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError as error:
        raise HTTPException(status_code=409, detail="Ese nombre de usuario ya está en uso") from error
    if not updated:
        raise HTTPException(status_code=409, detail="Tu cuenta ya tiene contraseña: cámbiala desde Perfil")
    return _public_user(updated)


@router.post("/auth/password")
async def change_password(body: PasswordChange, request: Request, user=Depends(current_user), db=Depends(get_db)):
    if not user.get("password_hash"):
        raise HTTPException(status_code=409, detail="Esta cuenta entra con Google y no tiene contraseña")
    await _ensure_indexes(db)
    key = f"password-user:{user['id']}"
    if await _over_limit(db, key, USER_ATTEMPTS):
        raise HTTPException(status_code=429, detail=TOO_MANY_ATTEMPTS)
    if not await run_in_threadpool(_password_matches, user["password_hash"], body.current_password):
        await _count_attempt(db, key, ATTEMPTS_WINDOW)
        # No es 401 ni 403: la app los entiende como que has perdido el acceso.
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta")
    if body.new_password == body.current_password:
        raise HTTPException(status_code=422, detail="La nueva contraseña tiene que ser distinta")
    _reject_weak_password(body.new_password, user["username"])

    updated = await db.users.find_one_and_update(
        {"id": user["id"]},
        {
            "$set": {"password_hash": await run_in_threadpool(_hash_password, body.new_password), "must_change_password": False},
            "$unset": {"temporary_password_expires_at": ""},
        },
        return_document=ReturnDocument.AFTER,
    )
    await db.login_attempts.delete_one({"key": key})
    # Si alguien más tenía la sesión abierta con la contraseña anterior, se queda fuera.
    token = request.cookies.get(SESSION_COOKIE, "")
    await db.sessions.delete_many({"user_id": user["id"], "token_hash": {"$ne": _hash_token(token)}})
    return _public_user(updated)


@router.post("/users/{user_id}/temporary-password")
async def create_temporary_password(user_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not target.get("password_hash"):
        raise HTTPException(status_code=409, detail="Esta cuenta entra con Google y no tiene contraseña")
    if target["id"] == admin["id"]:
        raise HTTPException(status_code=409, detail="Tu propia contraseña se cambia desde Perfil")

    temporary = "".join(secrets.choice(TEMPORARY_ALPHABET) for _ in range(TEMPORARY_LENGTH))
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "password_hash": await run_in_threadpool(_hash_password, temporary),
                "must_change_password": True,
                "temporary_password_expires_at": _now() + TEMPORARY_PASSWORD_LIFETIME,
                "password_reset_by": admin["id"],
            }
        },
    )
    await db.sessions.delete_many({"user_id": user_id})
    await db.login_attempts.delete_one({"key": f"login-user:{target['username']}"})
    # Es la única vez que se puede ver: solo se guarda cifrada.
    return {"temporary_password": temporary}
