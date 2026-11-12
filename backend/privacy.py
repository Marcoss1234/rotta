"""Privacidad: aceptar la política (con permiso de madre, padre o tutor para menores de 14) y borrar la cuenta.

En España, por debajo de 14 años hace falta el consentimiento de quien tenga la patria potestad o tutela
(artículo 7 de la Ley Orgánica 3/2018). El permiso para fotos va aparte: sin él no se ve ni se sube su foto.
"""
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

from auth import _admin_emails, _public_user, current_user
from clubs import session_cookie
from database import get_db

router = APIRouter(prefix="/api")

# Si la política cambia de verdad, se sube la versión y todo el mundo la vuelve a aceptar.
POLICY_VERSION = "2026-11"

# Todo lo que la app guarda con el id de la persona.
PERSONAL_COLLECTIONS = (
    "sessions",
    "push_subscriptions",
    "avatars",
    "attendance",
    "match_answers",
    "coin_entries",
    "chat_messages",
    "chat_images",
    "chat_reads",
    "chat_typing",
    "chat_presence",
)


class Consent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    accepted: Literal[True]
    # Mayor de 14 años; si no, lo acepta su madre, padre o tutor (y se apunta su nombre).
    adult: bool
    guardian_name: Optional[str] = Field(default=None, max_length=80)
    photos: bool

    @model_validator(mode="after")
    def guardian_for_minors(self):
        name = (self.guardian_name or "").strip()
        if not self.adult and len(name) < 3:
            raise ValueError("Escribe el nombre de la madre, el padre o el tutor que da el permiso")
        self.guardian_name = name or None if not self.adult else None
        return self


class DeleteAccount(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirm: Literal["BORRAR"]


def consent_is_current(user):
    return (user.get("consent") or {}).get("version") == POLICY_VERSION


@router.get("/privacy")
async def privacy_info():
    return {"version": POLICY_VERSION}


@router.put("/profile/consent")
async def save_consent(body: Consent, user=Depends(current_user), db=Depends(get_db)):
    consent = {
        "version": POLICY_VERSION,
        "accepted_at": datetime.now(timezone.utc),
        "adult": body.adult,
        "guardian_name": body.guardian_name,
        "photos": body.photos,
    }
    await db.users.update_one({"id": user["id"]}, {"$set": {"consent": consent}})
    return _public_user({**user, "consent": consent})


@router.delete("/profile", status_code=204)
async def delete_account(body: DeleteAccount, response: Response, user=Depends(current_user), db=Depends(get_db)):
    """Borra la cuenta y todo lo suyo: ficha, notas, premios, coins, mensajes, fotos y asistencia."""
    if (user.get("email") or "").casefold() in _admin_emails():
        raise HTTPException(status_code=409, detail="El administrador principal no se puede borrar desde la app")
    user_id = user["id"]
    for name in PERSONAL_COLLECTIONS:
        await db[name].delete_many({"user_id": user_id})

    # Su ficha de la plantilla y lo que cuelga de ella (notas del ranking y premios).
    player_ids = [player["id"] async for player in db.players.find({"user_id": user_id}, {"id": 1})]
    if player_ids:
        await db.ratings.delete_many({"player_id": {"$in": player_ids}})
        await db.honors.delete_many({"player_id": {"$in": player_ids}})
        await db.players.delete_many({"id": {"$in": player_ids}})
    await db.honors.delete_many({"user_id": user_id})

    # En lo que es de otros (destacados, peticiones de ayuda) solo se quita su nombre.
    await db.training_stars.update_many({"user_ids": user_id}, {"$pull": {"user_ids": user_id}})
    await db.help_requests.update_many({"helpers": user_id}, {"$pull": {"helpers": user_id}})
    await db.help_requests.update_many({"requested_by": user_id}, {"$set": {"requested_by": None}})

    await db.users.delete_one({"id": user_id})
    response.delete_cookie(session_cookie(), path="/api")
