"""Lo que es de cada club y ve todo el mundo: su nombre y su escudo, sus colores y sus equipos.

Se lee también desde la pantalla de entrada, antes de iniciar sesión, y solo lo cambia un administrador.
Cada persona elige además claro u oscuro en su móvil; eso no se guarda aquí.
Todo va en `club_settings`, documento `{"id": "club"}`; el escudo, en `club_files` (`{"id": "crest"}`).
"""
from datetime import datetime, timezone
from typing import Annotated, Literal, get_args
from uuid import uuid4

from bson import Binary
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from auth import require_admin
from clubs import with_club
from database import get_db
from teams import structure

router = APIRouter(prefix="/api")

# La app reduce el escudo antes de subirlo; esto es solo el tope por si alguien llama directamente.
MAX_CREST_BYTES = 200 * 1024


@router.get("/club/structure")
async def get_club_structure(_db=Depends(get_db)):
    """Los equipos del club, qué equipos juegan juntos y los grupos del ranking (ver teams.py).
    Pública, como los colores: la app la carga al arrancar. get_db ya la ha dejado a mano."""
    return structure().model_dump()


# ---------- Nombre y escudo ----------

ClubName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=40, pattern=r"^[^\x00-\x1f\x7f<>]+$")]


class ClubIdentity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ClubName


def _crest_type(data):
    """Se mira el contenido, no lo que diga quien sube el archivo. Sin SVG: puede llevar código dentro."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


async def club_identity(db):
    """El nombre y el escudo del club. Sin ellos, None: la app enseña los de Rotta."""
    saved = (await db.club_settings.find_one({"id": "club"}, {"_id": 0, "identity": 1}) or {}).get("identity", {})
    version = saved.get("crest_version")
    return {
        "name": saved.get("name"),
        "crest": with_club(f"/api/club/crest?v={version}") if version else None,
    }


@router.get("/club/identity")
async def get_club_identity(db=Depends(get_db)):
    return await club_identity(db)


@router.put("/club/identity")
async def save_club_identity(body: ClubIdentity, _user=Depends(require_admin), db=Depends(get_db)):
    await db.club_settings.update_one({"id": "club"}, {"$set": {"identity.name": body.name}}, upsert=True)
    return await club_identity(db)


@router.put("/club/crest")
async def upload_club_crest(request: Request, _user=Depends(require_admin), db=Depends(get_db)):
    data = await request.body()
    if len(data) > MAX_CREST_BYTES:
        raise HTTPException(status_code=413, detail="El escudo es demasiado grande")
    content_type = _crest_type(data)
    if not content_type:
        raise HTTPException(status_code=415, detail="Sube el escudo en PNG, JPG o WebP")
    await db.club_files.update_one(
        {"id": "crest"},
        {"$set": {"data": Binary(data), "content_type": content_type, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    await db.club_settings.update_one({"id": "club"}, {"$set": {"identity.crest_version": uuid4().hex[:12]}}, upsert=True)
    return await club_identity(db)


@router.delete("/club/crest")
async def delete_club_crest(_user=Depends(require_admin), db=Depends(get_db)):
    await db.club_files.delete_one({"id": "crest"})
    await db.club_settings.update_one({"id": "club"}, {"$unset": {"identity.crest_version": ""}})
    return await club_identity(db)


@router.get("/club/crest")
async def get_club_crest(db=Depends(get_db)):
    """Pública: sale en la pantalla de entrada."""
    crest = await db.club_files.find_one({"id": "crest"})
    if not crest:
        raise HTTPException(status_code=404, detail="El club no tiene escudo")
    return Response(
        content=bytes(crest["data"]),
        media_type=crest["content_type"],
        headers={
            # Cada escudo nuevo tiene otra dirección (?v=), así que esta nunca cambia.
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ---------- Colores ----------

HexColor = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
# Los temas de Rotta (los mismos que src/app/themes.js). Un club que no ha elegido usa Tinta.
ThemeStyle = Literal["lima", "naranja", "tinta"]
DEFAULT_STYLE = "tinta"
# Rotta por defecto: morado y cian sobre negro, con el tema Tinta.
DEFAULTS = {"brand": "#7C3AED", "accent": "#22D3EE", "mode": "dark", "style": DEFAULT_STYLE}


class ClubTheme(BaseModel):
    model_config = ConfigDict(extra="forbid")

    brand: str = HexColor
    accent: str = HexColor
    mode: Literal["light", "dark"]
    # Opcional: una app que todavía no conoce los temas guarda sus colores sin cambiar el tema del club.
    style: ThemeStyle | None = None


async def club_theme(db):
    saved = await db.club_settings.find_one({"id": "club"}, {"_id": 0, "theme": 1})
    theme = {**DEFAULTS, **(saved or {}).get("theme", {})}
    # Un tema que ya no existe (o escrito a mano mal) no rompe la app: vuelve al de por defecto.
    if theme["style"] not in get_args(ThemeStyle):
        theme["style"] = DEFAULT_STYLE
    return theme


@router.get("/club/theme")
async def get_club_theme(db=Depends(get_db)):
    return await club_theme(db)


@router.put("/club/theme")
async def save_club_theme(body: ClubTheme, user=Depends(require_admin), db=Depends(get_db)):
    changes = {"theme.brand": body.brand.upper(), "theme.accent": body.accent.upper(), "theme.mode": body.mode}
    if body.style is not None:
        changes["theme.style"] = body.style
    await db.club_settings.update_one({"id": "club"}, {"$set": changes}, upsert=True)
    return await club_theme(db)
