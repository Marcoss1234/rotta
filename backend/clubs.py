"""Varios clubs: cada club tiene su propia base de datos.

La lista de clubs está en la base central de Rotta (colección `clubs`). Cada petición dice de qué club es:
- la cabecera `X-Club` (la manda la app),
- `?club=` en la dirección (fotos y enlaces, que no llevan cabeceras),
- o el subdominio, si la web está en ROOT_DOMAIN (tnt.rotta.app -> "tnt").
Sin nada de eso se usa DEFAULT_CLUB y, si tampoco hay, la base de siempre (DB_NAME): así una instalación
de un solo club sigue funcionando igual.
"""
import os
import re
import time
from contextvars import ContextVar
from datetime import datetime, timezone

from fastapi import HTTPException, Request

SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$")
CACHE_SECONDS = 60

# El club de la petición en curso: lo usan las fotos (para su enlace) y la cookie de sesión.
current_club = ContextVar("current_club", default=None)

_cache = {"at": 0.0, "clubs": {}}


def central_db(client):
    return client[os.environ.get("CENTRAL_DB_NAME", "rotta")]


def clean_slug(value):
    slug = (value or "").strip().lower()
    return slug if SLUG.match(slug) else None


def slug_from_request(request: Request):
    """El código del club que pide la petición, o None si no dice ninguno."""
    for value in (request.headers.get("x-club"), request.query_params.get("club")):
        if value:
            slug = clean_slug(value)
            if not slug:
                raise HTTPException(status_code=400, detail="Ese código de club no es válido")
            return slug
    root = os.environ.get("ROOT_DOMAIN", "").strip().lower()
    host = (request.headers.get("host") or "").split(":")[0].lower()
    if root and host.endswith("." + root):
        return clean_slug(host[: -len(root) - 1])
    return clean_slug(os.environ.get("DEFAULT_CLUB"))


async def find_club(client, slug):
    if time.monotonic() - _cache["at"] > CACHE_SECONDS:
        clubs = await central_db(client).clubs.find({}, {"_id": 0}).to_list(1000)
        _cache.update(at=time.monotonic(), clubs={club["slug"]: club for club in clubs})
    club = _cache["clubs"].get(slug)
    if club is None:
        # Puede ser un club recién creado: se mira directamente antes de decir que no existe.
        club = await central_db(client).clubs.find_one({"slug": slug}, {"_id": 0})
        if club:
            _cache["clubs"][slug] = club
    return club


def forget_cache():
    _cache.update(at=0.0, clubs={})


async def database_for(request: Request, client):
    """La base de datos del club de esta petición."""
    slug = slug_from_request(request)
    if slug is None:
        current_club.set(None)
        db_name = os.environ.get("DB_NAME")
        if not db_name:
            raise HTTPException(status_code=400, detail="Falta decir de qué club eres")
        return client[db_name]
    club = await find_club(client, slug)
    if not club:
        raise HTTPException(status_code=404, detail="Ese club no existe")
    current_club.set(slug)
    return client[club["db_name"]]


async def create_club(client, slug, name):
    """Da de alta un club con su propia base de datos. Devuelve el club."""
    slug = clean_slug(slug)
    if not slug:
        raise ValueError("El código del club solo puede tener letras minúsculas, números y guiones")
    if await central_db(client).clubs.find_one({"slug": slug}):
        raise ValueError(f"Ya hay un club con el código «{slug}»")
    club = {"slug": slug, "name": name.strip(), "db_name": f"club_{slug.replace('-', '_')}", "created_at": datetime.now(timezone.utc)}
    await central_db(client).clubs.insert_one(dict(club))
    # Su nombre sale ya en la app (el administrador lo puede cambiar luego, con el escudo).
    await client[club["db_name"]].club_settings.update_one(
        {"id": "club"}, {"$set": {"identity.name": club["name"][:40]}}, upsert=True
    )
    forget_cache()
    return club


def with_club(url):
    """Añade el club a un enlace de la API (fotos), que el navegador pide sin cabeceras."""
    slug = current_club.get()
    if not slug:
        return url
    return f"{url}{'&' if '?' in url else '?'}club={slug}"


def session_cookie():
    """Cada club tiene su propia cookie de sesión: se puede estar dentro de dos clubs a la vez."""
    slug = current_club.get()
    return f"rotta_session_{slug}" if slug else "rotta_session"
