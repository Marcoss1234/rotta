"""Los colores del club: el principal, el segundo y si su app es clara u oscura por defecto.

Los lee todo el mundo (también la pantalla de entrada, antes de iniciar sesión) y solo los cambia
un administrador. Cada persona elige además claro u oscuro en su móvil; eso no se guarda aquí.
"""
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from auth import require_admin
from database import get_db
from teams import structure

router = APIRouter(prefix="/api")


@router.get("/club/structure")
async def get_club_structure(_db=Depends(get_db)):
    """Los equipos del club, qué equipos juegan juntos y los grupos del ranking (ver teams.py).
    Pública, como los colores: la app la carga al arrancar. get_db ya la ha dejado a mano."""
    return structure().model_dump()

HexColor = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
# Rotta por defecto: morado y cian sobre negro.
DEFAULTS = {"brand": "#7C3AED", "accent": "#22D3EE", "mode": "dark"}


class ClubTheme(BaseModel):
    model_config = ConfigDict(extra="forbid")

    brand: str = HexColor
    accent: str = HexColor
    mode: Literal["light", "dark"]


async def club_theme(db):
    saved = await db.club_settings.find_one({"id": "club"}, {"_id": 0, "theme": 1})
    return {**DEFAULTS, **(saved or {}).get("theme", {})}


@router.get("/club/theme")
async def get_club_theme(db=Depends(get_db)):
    return await club_theme(db)


@router.put("/club/theme")
async def save_club_theme(body: ClubTheme, user=Depends(require_admin), db=Depends(get_db)):
    theme = {"brand": body.brand.upper(), "accent": body.accent.upper(), "mode": body.mode}
    await db.club_settings.update_one({"id": "club"}, {"$set": {"theme": theme}}, upsert=True)
    return theme
