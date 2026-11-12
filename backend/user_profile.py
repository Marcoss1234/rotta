from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal, Optional
from uuid import uuid4

from bson.binary import Binary
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from auth import _public_user, picture_of
from database import get_db
from players import (
    NUMBER_TAKEN,
    Name,
    Number,
    Phone,
    _check_number_free,
    _ensure_indexes as _ensure_player_indexes,
    require_approved,
)
from teams import TEAMS

PreferredPosition = Literal["Líbero", "Colocador", "Receptor", "Central", "Opuesto"]
DominantHand = Literal["derecha", "izquierda", "ambas"]
# Estatura en centímetros: con ella el personaje sale a escala en la pizarra 3D.
HeightCm = Annotated[int, Field(ge=120, le=230)]

# La app reduce la foto antes de subirla; esto es solo el tope por si alguien llama directamente.
MAX_AVATAR_BYTES = 150 * 1024
STATS_DAYS = 30
NO_PLAYER = "Esto solo se puede cambiar si estás en una plantilla"

router = APIRouter(prefix="/api")
_indexes_ready = False


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[Name] = None
    number: Optional[Number] = None
    phone: Optional[Phone] = None
    preferred_positions: Optional[list[PreferredPosition]] = Field(default=None, max_length=3)
    dominant_hand: Optional[DominantHand] = None
    height_cm: Optional[HeightCm] = None

    @field_validator("preferred_positions")
    @classmethod
    def no_repeats(cls, value):
        if value is not None and len(set(value)) != len(value):
            raise ValueError("No repitas posiciones")
        return value

    @model_validator(mode="after")
    def check_fields(self):
        if not self.model_fields_set:
            raise ValueError("Indica algún cambio")
        for field in ("name", "preferred_positions"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} no puede quedar vacío")
        return self


async def _ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.avatars.create_index("user_id", unique=True)
    _indexes_ready = True


def _image_type(data):
    """Se mira el contenido, no lo que diga quien sube el archivo."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


async def _profile_response(db, user):
    player = await db.players.find_one({"user_id": user["id"]})
    names = {team["id"]: team["name"] for team in TEAMS}
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=STATS_DAYS)).isoformat()
    answers = {"user_id": user["id"], "date": {"$gte": cutoff}}
    return {
        "user": _public_user(user),
        "preferred_positions": user.get("preferred_positions", []),
        "dominant_hand": user.get("dominant_hand"),
        "height_cm": user.get("height_cm"),
        "character": user.get("character"),
        "owned_items": user.get("owned_items", []),
        "team_name": names.get(user.get("team_id")),
        "coached_team_names": [
            names[team_id] for team_id in user.get("coached_team_ids", []) if team_id in names
        ] if user.get("role") == "entrenador" else [],
        "player": player and {
            "id": player["id"],
            "number": player.get("number"),
            "position": player["position"],
            "phone": player.get("phone"),
        },
        "stats": {
            "days": STATS_DAYS,
            "going": await db.attendance.count_documents({**answers, "status": "going"}),
            "not_going": await db.attendance.count_documents({**answers, "status": "not_going"}),
        },
    }


@router.get("/profile")
async def get_profile(user=Depends(require_approved), db=Depends(get_db)):
    return await _profile_response(db, user)


@router.patch("/profile")
async def update_profile(body: ProfileUpdate, user=Depends(require_approved), db=Depends(get_db)):
    changes = body.model_dump(include=body.model_fields_set)
    player = await db.players.find_one({"user_id": user["id"]})
    if not player and ("number" in changes or "phone" in changes):
        raise HTTPException(status_code=409, detail=NO_PLAYER)

    # Primero la ficha: si el dorsal está ocupado no se guarda nada.
    if player:
        player_changes = {key: changes[key] for key in ("name", "number", "phone", "preferred_positions") if key in changes}
        # La posición del equipo la decide el entrenador: la preferencia solo rellena la que está sin definir.
        if changes.get("preferred_positions") and player["position"] == "Sin definir":
            player_changes["position"] = changes["preferred_positions"][0]
        if player_changes:
            await _ensure_player_indexes(db)
            if "number" in player_changes:
                await _check_number_free(db, player["team_id"], player_changes["number"], ignore_id=player["id"])
            player_changes["updated_at"] = datetime.now(timezone.utc)
            try:
                await db.players.update_one({"id": player["id"]}, {"$set": player_changes})
            except DuplicateKeyError as error:
                raise HTTPException(status_code=409, detail=NUMBER_TAKEN) from error

    user_changes = {key: changes[key] for key in ("name", "preferred_positions", "dominant_hand", "height_cm") if key in changes}
    if user_changes:
        user = await db.users.find_one_and_update(
            {"id": user["id"]}, {"$set": user_changes}, return_document=ReturnDocument.AFTER
        )
    return await _profile_response(db, user)


@router.put("/profile/avatar")
async def upload_avatar(request: Request, user=Depends(require_approved), db=Depends(get_db)):
    if (user.get("consent") or {}).get("photos") is False:
        raise HTTPException(status_code=403, detail="No hay permiso para fotos: cámbialo en tu perfil si quieres subir una")
    data = await request.body()
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="La foto es demasiado grande")
    content_type = _image_type(data)
    if not content_type:
        raise HTTPException(status_code=415, detail="Sube una foto en JPG o WebP")

    await _ensure_indexes(db)
    await db.avatars.update_one(
        {"user_id": user["id"]},
        {"$set": {"data": Binary(data), "content_type": content_type, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    updated = await db.users.find_one_and_update(
        {"id": user["id"]},
        {"$set": {"avatar_version": uuid4().hex[:12]}},
        return_document=ReturnDocument.AFTER,
    )
    return _public_user(updated)


@router.delete("/profile/avatar")
async def delete_avatar(user=Depends(require_approved), db=Depends(get_db)):
    await db.avatars.delete_one({"user_id": user["id"]})
    updated = await db.users.find_one_and_update(
        {"id": user["id"]},
        {"$unset": {"avatar_version": ""}},
        return_document=ReturnDocument.AFTER,
    )
    return _public_user(updated)


@router.get("/users/{user_id}/avatar")
async def get_avatar(user_id: str, _user=Depends(require_approved), db=Depends(get_db)):
    avatar = await db.avatars.find_one({"user_id": user_id})
    if not avatar:
        raise HTTPException(status_code=404, detail="Sin foto")
    return Response(
        content=bytes(avatar["data"]),
        media_type=avatar["content_type"],
        headers={
            # Cada foto nueva tiene otra dirección (?v=), así que esta nunca cambia.
            "Cache-Control": "private, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )
