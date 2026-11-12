import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pymongo import ASCENDING, ReturnDocument

from clubs import session_cookie, with_club
from database import get_db
from roster_sync import sync_player_with_user
from teams import TeamId

SESSION_DAYS = 30

Role = Literal["admin", "entrenador", "jugador", "familia"]

router = APIRouter(prefix="/api")
_indexes_ready = False


class GoogleLogin(BaseModel):
    credential: str = Field(min_length=1, max_length=8192)


class UserUpdate(BaseModel):
    status: Optional[Literal["approved", "rejected"]] = None
    role: Optional[Role] = None
    team_id: Optional[TeamId] = None
    also_plays: Optional[bool] = None
    coached_team_ids: Optional[list[TeamId]] = None
    match_editor: Optional[bool] = None

    @model_validator(mode="after")
    def needs_a_change(self):
        extras = any(getattr(self, field) is not None for field in ("also_plays", "coached_team_ids", "match_editor"))
        if self.status is None and self.role is None and "team_id" not in self.model_fields_set and not extras:
            raise ValueError("Indica un estado, un rol o un equipo")
        return self


class AccessReview(BaseModel):
    """Lo que puede decidir un entrenador: entrar como jugador o familia, o no entrar."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["approved", "rejected"]
    role: Optional[Literal["jugador", "familia"]] = None
    team_id: Optional[TeamId] = None

    @model_validator(mode="after")
    def approval_is_complete(self):
        if self.status == "approved" and (self.role is None or self.team_id is None):
            raise ValueError("Elige un rol y un equipo para aceptar")
        return self


def _now():
    return datetime.now(timezone.utc)


def _google_client_id():
    return os.environ.get("GOOGLE_CLIENT_ID", "").strip()


def _admin_emails():
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {email.strip().casefold() for email in raw.split(",") if email.strip()}


def _hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def picture_of(user):
    """La foto subida a la app si la hay; si no, la de Google. Sin permiso para fotos, ninguna."""
    if (user.get("consent") or {}).get("photos") is False:
        return ""
    if user.get("avatar_version"):
        return with_club(f"/api/users/{user['id']}/avatar?v={user['avatar_version']}")
    return user.get("picture", "")


async def pictures_by_user(db, user_ids):
    ids = list({user_id for user_id in user_ids if user_id})
    if not ids:
        return {}
    users = await db.users.find({"id": {"$in": ids}}, {"id": 1, "avatar_version": 1, "picture": 1, "consent": 1}).to_list(len(ids))
    return {user["id"]: picture_of(user) for user in users}


async def characters_by_user(db, user_ids):
    """El personaje que ha elegido cada uno, para que la pizarra lo pinte igual que su perfil."""
    ids = list({user_id for user_id in user_ids if user_id})
    if not ids:
        return {}
    users = await db.users.find({"id": {"$in": ids}, "character": {"$exists": True}}, {"id": 1, "character": 1}).to_list(len(ids))
    return {user["id"]: user["character"] for user in users}


async def heights_by_user(db, user_ids):
    """Lo que mide cada uno (en cm), para que su muñeco salga a escala en la pizarra."""
    ids = list({user_id for user_id in user_ids if user_id})
    if not ids:
        return {}
    users = await db.users.find({"id": {"$in": ids}, "height_cm": {"$ne": None}}, {"id": 1, "height_cm": 1}).to_list(len(ids))
    return {user["id"]: user["height_cm"] for user in users}


def _public_user(user):
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user.get("email"),
        "username": user.get("username"),
        "has_password": bool(user.get("password_hash")),
        "must_change_password": bool(user.get("must_change_password")),
        "picture": picture_of(user),
        "has_custom_picture": bool(user.get("avatar_version")),
        "status": user["status"],
        "role": user.get("role"),
        "team_id": user.get("team_id"),
        "also_plays": bool(user.get("also_plays")),
        "coached_team_ids": user.get("coached_team_ids", []),
        "match_editor": bool(user.get("match_editor")),
        "consent": _public_consent(user.get("consent")),
    }


def _public_consent(consent):
    """Lo que la app necesita saber del permiso aceptado (la fecha y el tutor se quedan en el servidor)."""
    if not consent:
        return None
    return {"version": consent.get("version"), "adult": consent.get("adult"), "photos": consent.get("photos")}


def verify_google_token(credential):
    """Comprueba con Google que el token es auténtico y devuelve sus datos."""
    return google_id_token.verify_oauth2_token(
        credential, google_requests.Request(), _google_client_id()
    )


async def _ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.users.create_index("id", unique=True)
    await db.users.create_index("google_sub", unique=True)
    await db.users.create_index(
        "username",
        unique=True,
        partialFilterExpression={"username": {"$type": "string"}},
    )
    await db.sessions.create_index("token_hash", unique=True)
    await db.sessions.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
    await db.login_attempts.create_index("key", unique=True)
    await db.login_attempts.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
    _indexes_ready = True


async def start_session(db, user, response):
    now = _now()
    token = secrets.token_urlsafe(32)
    await db.sessions.insert_one(
        {
            "token_hash": _hash_token(token),
            "user_id": user["id"],
            "created_at": now,
            "expires_at": now + timedelta(days=SESSION_DAYS),
        }
    )
    response.set_cookie(
        session_cookie(),
        token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=os.environ.get("COOKIE_SECURE", "true").lower() != "false",
        samesite="lax",
        path="/api",
    )


def reject_if_password_must_change(user):
    if user.get("must_change_password"):
        raise HTTPException(status_code=403, detail="Primero tienes que cambiar tu contraseña")


async def current_user(request: Request, db=Depends(get_db)):
    token = request.cookies.get(session_cookie())
    if not token:
        raise HTTPException(status_code=401, detail="Inicia sesión")
    session = await db.sessions.find_one(
        {"token_hash": _hash_token(token), "expires_at": {"$gt": _now()}}
    )
    if not session:
        raise HTTPException(status_code=401, detail="Inicia sesión")
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="Inicia sesión")
    return user


async def require_admin(user=Depends(current_user)):
    if user["status"] != "approved" or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo para administradores")
    reject_if_password_must_change(user)
    return user


async def require_access_reviewer(user=Depends(current_user)):
    if user["status"] != "approved" or user.get("role") not in ("admin", "entrenador"):
        raise HTTPException(status_code=403, detail="Solo para entrenadores y administradores")
    reject_if_password_must_change(user)
    return user


@router.get("/auth/config")
async def auth_config():
    # El identificador de cliente de Google es público: no es una contraseña.
    return {"google_client_id": _google_client_id()}


@router.post("/auth/google")
async def login_with_google(body: GoogleLogin, response: Response, db=Depends(get_db)):
    if not _google_client_id():
        raise HTTPException(status_code=503, detail="El acceso con Google no está configurado")
    try:
        claims = await run_in_threadpool(verify_google_token, body.credential)
    except ValueError as error:
        raise HTTPException(status_code=401, detail="No se ha podido verificar la cuenta") from error
    if not claims.get("email_verified") or not claims.get("email"):
        raise HTTPException(status_code=401, detail="La cuenta de Google no tiene un correo verificado")

    await _ensure_indexes(db)
    now = _now()
    email = claims["email"].casefold()
    is_admin = email in _admin_emails()

    to_set = {
        "email": email,
        "picture": claims.get("picture", ""),
        "last_login_at": now,
    }
    # El nombre de Google solo vale de partida: luego cada uno lo cambia en su perfil.
    on_insert = {"id": str(uuid4()), "name": claims.get("name") or email, "created_at": now}
    if is_admin:
        to_set.update(status="approved", role="admin")
    else:
        on_insert.update(status="pending", role=None)

    user = await db.users.find_one_and_update(
        {"google_sub": claims["sub"]},
        {"$set": to_set, "$setOnInsert": on_insert},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    await start_session(db, user, response)
    return _public_user(user)


@router.get("/auth/me")
async def me(user=Depends(current_user)):
    return _public_user(user)


@router.post("/auth/logout", status_code=204)
async def logout(request: Request, response: Response, db=Depends(get_db)):
    token = request.cookies.get(session_cookie())
    if token:
        await db.sessions.delete_one({"token_hash": _hash_token(token)})
    response.delete_cookie(session_cookie(), path="/api")


@router.get("/users")
async def list_users(_admin=Depends(require_admin), db=Depends(get_db)):
    users = await db.users.find({}).sort("created_at", ASCENDING).to_list(1000)
    return [_public_user(user) for user in users]


@router.get("/users/pending")
async def list_pending_users(_reviewer=Depends(require_access_reviewer), db=Depends(get_db)):
    users = await db.users.find({"status": "pending"}).sort("created_at", ASCENDING).to_list(1000)
    return [_public_user(user) for user in users]


@router.post("/users/{user_id}/access")
async def review_access(
    user_id: str,
    body: AccessReview,
    reviewer=Depends(require_access_reviewer),
    db=Depends(get_db),
):
    approved = body.status == "approved"
    # Solo se resuelve a quien sigue esperando: así dos entrenadores no se pisan.
    updated = await db.users.find_one_and_update(
        {"id": user_id, "status": "pending"},
        {
            "$set": {
                "status": body.status,
                "role": body.role if approved else None,
                "team_id": body.team_id if approved else None,
                "also_plays": False,
                "coached_team_ids": [],
                "match_editor": False,
                "reviewed_by": reviewer["id"],
                "reviewed_at": _now(),
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=409, detail="Esta solicitud ya se ha resuelto")
    await sync_player_with_user(db, updated)
    return _public_user(updated)


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UserUpdate,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    reviewed = {"reviewed_by": admin["id"], "reviewed_at": _now()}
    team_change = {"team_id": body.team_id} if "team_id" in body.model_fields_set else {}
    if body.also_plays is not None:
        team_change["also_plays"] = body.also_plays
    if body.coached_team_ids is not None:
        team_change["coached_team_ids"] = list(dict.fromkeys(body.coached_team_ids))
    if body.match_editor is not None:
        team_change["match_editor"] = body.match_editor

    # Cambiar solo los equipos no toca el acceso: vale para cualquiera, también para uno mismo.
    if body.status is None and body.role is None:
        updated = await db.users.find_one_and_update(
            {"id": user_id},
            {"$set": {**team_change, **reviewed}},
            return_document=ReturnDocument.AFTER,
        )
        await sync_player_with_user(db, updated)
        return _public_user(updated)

    if target["id"] == admin["id"]:
        raise HTTPException(status_code=409, detail="No puedes cambiar tu propio acceso")
    if target.get("email") in _admin_emails():
        raise HTTPException(status_code=409, detail="Este administrador se gestiona en la configuración")

    status = body.status or target["status"]
    if status == "approved":
        role = body.role or target.get("role")
        if not role:
            raise HTTPException(status_code=422, detail="Elige un rol para aprobar el acceso")
    elif status == "rejected":
        role = None
    else:
        raise HTTPException(status_code=422, detail="Primero aprueba el acceso")

    updated = await db.users.find_one_and_update(
        {"id": user_id},
        {"$set": {"status": status, "role": role, **team_change, **reviewed}},
        return_document=ReturnDocument.AFTER,
    )
    await sync_player_with_user(db, updated)
    return _public_user(updated)
