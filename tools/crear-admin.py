"""Crea una cuenta de administrador con usuario y contraseña (para entrar desde el móvil sin Google).

Uso (desde la carpeta del proyecto, con backend/.env configurado):
    python tools/crear-admin.py marcos "Marcos Niño"
    python tools/crear-admin.py marcos "Marcos Niño" --club tnt

- La cuenta queda aprobada y con rol de administrador en la base del club (--club; si no, DEFAULT_CLUB o DB_NAME).
- No se escribe ninguna contraseña en la terminal: se crea una temporal, se enseña UNA vez y la app pide
  cambiarla al entrar (como la contraseña temporal que da un administrador). Caduca en 48 horas.
- Al entrar por primera vez, la app pide aceptar la privacidad, como a todo el mundo.
- Si el usuario ya existe, no se toca (para no quitarle la contraseña a nadie sin querer).
"""
import argparse
import asyncio
import os
import re
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from clubs import central_db  # noqa: E402
from password_auth import (  # noqa: E402
    RESERVED_USERNAMES,
    TEMPORARY_ALPHABET,
    TEMPORARY_LENGTH,
    TEMPORARY_PASSWORD_LIFETIME,
    _hash_password,
)

USERNAME = re.compile(r"^[a-z0-9._-]{3,30}$")


class AccountError(ValueError):
    pass


async def create_admin(db, username, name):
    """Crea la cuenta y devuelve (usuario, contraseña temporal). La contraseña solo se guarda cifrada."""
    username = username.strip().lower()
    name = name.strip()
    if not USERNAME.match(username):
        raise AccountError("El usuario solo puede tener de 3 a 30 letras minúsculas, números, puntos, guiones o guiones bajos")
    if username in RESERVED_USERNAMES:
        raise AccountError(f"«{username}» está reservado (haría creer que la cuenta es del club): elige otro")
    if not 2 <= len(name) <= 120:
        raise AccountError("El nombre tiene que tener entre 2 y 120 caracteres")
    if await db.users.find_one({"username": username}):
        raise AccountError(f"Ya hay una cuenta «{username}»: no se ha tocado")

    temporary = "".join(secrets.choice(TEMPORARY_ALPHABET) for _ in range(TEMPORARY_LENGTH))
    now = datetime.now(timezone.utc)
    user_id = str(uuid4())
    user = {
        "id": user_id,
        # Como en el registro con contraseña: nunca coincide con una cuenta de Google.
        "google_sub": f"local:{user_id}",
        "email": None,
        "username": username,
        "password_hash": _hash_password(temporary),
        "must_change_password": True,
        "temporary_password_expires_at": now + TEMPORARY_PASSWORD_LIFETIME,
        "name": name,
        "picture": "",
        "status": "approved",
        "role": "admin",
        "created_at": now,
        "last_login_at": None,
    }
    await db.users.insert_one(user)
    return user, temporary


async def database(client, club):
    """La base del club, igual que la elige el servidor: el club indicado, DEFAULT_CLUB o DB_NAME."""
    slug = club or os.environ.get("DEFAULT_CLUB")
    if slug:
        found = await central_db(client).clubs.find_one({"slug": slug.strip().lower()}, {"_id": 0})
        if not found:
            raise AccountError(f"No existe el club «{slug}» (mira los que hay con: python tools/crear-club.py --lista)")
        return client[found["db_name"]], found["name"]
    db_name = os.environ.get("DB_NAME")
    if not db_name:
        raise AccountError("Di de qué club con --club (o configura DEFAULT_CLUB o DB_NAME en backend/.env)")
    return client[db_name], db_name


async def main(args):
    from database import get_client

    try:
        db, where = await database(get_client(), args.club)
        user, temporary = await create_admin(db, args.usuario, args.nombre)
    except AccountError as error:
        print(f"No se ha creado: {error}")
        return 1
    print(f"Administrador creado en {where}: {user['name']} (usuario «{user['username']}»).")
    print(f"Contraseña temporal (solo se enseña ahora, caduca en 48 horas): {temporary}")
    print("Entra en la app con «Entrar», usuario y esta contraseña: te pedirá poner una tuya.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Crea una cuenta de administrador con usuario y contraseña.")
    parser.add_argument("usuario")
    parser.add_argument("nombre")
    parser.add_argument("--club", help="código del club (el de ?club=...); si no, DEFAULT_CLUB o DB_NAME")
    sys.exit(asyncio.run(main(parser.parse_args())))
