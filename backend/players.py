from datetime import datetime, timezone
from typing import Annotated, Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, model_validator
from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError

from honors import crowns_by_user
from auth import characters_by_user, current_user, heights_by_user, picture_of, pictures_by_user, reject_if_password_must_change
from database import get_db
from teams import TEAMS, TeamId

Position = Literal["Sin definir", "Líbero", "Colocador", "Receptor", "Central", "Opuesto"]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\+?[0-9][0-9 ()-]{5,28}$")]
Number = Annotated[int, Field(ge=0, le=99)]

STAFF_ROLES = ("admin", "entrenador")
NUMBER_TAKEN = "Ese dorsal ya está en uso en este equipo"
LINKED_PLAYER = "Este jugador tiene cuenta: su equipo se cambia desde Usuarios"

router = APIRouter(prefix="/api")
_indexes_ready = False


class CourtSpot(BaseModel):
    """Dónde está la chapa, de 0 a 1 sobre el dibujo de la cancha. Sin valor, está en el banquillo."""

    model_config = ConfigDict(extra="forbid")

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class PlayerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: TeamId
    name: Name
    position: Position = "Sin definir"
    number: Optional[Number] = None
    phone: Optional[Phone] = None
    email: Optional[EmailStr] = None


class PlayerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: Optional[TeamId] = None
    name: Optional[Name] = None
    position: Optional[Position] = None
    number: Optional[Number] = None
    phone: Optional[Phone] = None
    email: Optional[EmailStr] = None
    court: Optional[CourtSpot] = None

    @model_validator(mode="after")
    def check_fields(self):
        if not self.model_fields_set:
            raise ValueError("Indica algún cambio")
        for field in ("team_id", "name", "position"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} no puede quedar vacío")
        return self


def _is_staff(user):
    return user.get("role") in STAFF_ROLES


async def require_approved(user=Depends(current_user)):
    if user["status"] != "approved":
        raise HTTPException(status_code=403, detail="Tu acceso aún no está aprobado")
    reject_if_password_must_change(user)
    return user


async def require_staff(user=Depends(require_approved)):
    if not _is_staff(user):
        raise HTTPException(status_code=403, detail="Solo para entrenadores y administradores")
    return user


def _public_player(player, include_contact, picture="", character=None, height_cm=None, crown=None):
    data = {
        "id": player["id"],
        "team_id": player["team_id"],
        "name": player["name"],
        "position": player["position"],
        "preferred_positions": player.get("preferred_positions", []),
        "number": player.get("number"),
        "court": player.get("court"),
        "linked": bool(player.get("user_id")),
        "picture": picture,
        "character": character,
        "height_cm": height_cm,
        "crown": crown,
    }
    if include_contact:
        data["phone"] = player.get("phone")
        data["email"] = player.get("email")
    return data


async def _ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.players.create_index("id", unique=True)
    await db.players.create_index("team_id")
    await db.players.create_index(
        [("team_id", ASCENDING), ("number", ASCENDING)],
        unique=True,
        partialFilterExpression={"number": {"$type": "int"}},
    )
    _indexes_ready = True


async def _check_number_free(db, team_id, number, ignore_id=None):
    if number is None:
        return
    query = {"team_id": team_id, "number": number}
    if ignore_id:
        query["id"] = {"$ne": ignore_id}
    if await db.players.find_one(query):
        raise HTTPException(status_code=409, detail=NUMBER_TAKEN)


@router.get("/teams")
async def list_teams(_user=Depends(require_approved)):
    return TEAMS


@router.get("/teams/{team_id}/family")
async def list_team_family(team_id: TeamId, _user=Depends(require_approved), db=Depends(get_db)):
    """Las familias del equipo, para las gradas: solo nombre y foto."""
    family = await db.users.find({"team_id": team_id, "status": "approved", "role": "familia"}).to_list(200)
    family.sort(key=lambda person: person["name"].casefold())
    return [{"id": person["id"], "name": person["name"], "picture": picture_of(person)} for person in family]


@router.get("/players")
async def list_players(
    team_id: TeamId = Query(...),
    user=Depends(require_approved),
    db=Depends(get_db),
):
    players = await db.players.find({"team_id": team_id}).to_list(500)
    players.sort(key=lambda p: (p.get("number") is None, p.get("number") or 0, p["name"].casefold()))
    include_contact = _is_staff(user)
    user_ids = [player.get("user_id") for player in players]
    pictures = await pictures_by_user(db, user_ids)
    characters = await characters_by_user(db, user_ids)
    heights = await heights_by_user(db, user_ids)
    crowns = await crowns_by_user(db, user_ids)
    return [
        _public_player(
            player,
            include_contact,
            pictures.get(player.get("user_id"), ""),
            characters.get(player.get("user_id")),
            heights.get(player.get("user_id")),
            crowns.get(player.get("user_id")),
        )
        for player in players
    ]


@router.post("/players", status_code=201)
async def create_player(body: PlayerCreate, user=Depends(require_staff), db=Depends(get_db)):
    await _ensure_indexes(db)
    await _check_number_free(db, body.team_id, body.number)

    now = datetime.now(timezone.utc)
    document = body.model_dump()
    document.update(id=str(uuid4()), created_at=now, updated_at=now, updated_by=user["id"])
    if document["email"]:
        document["email"] = document["email"].casefold()
    try:
        await db.players.insert_one(document)
    except DuplicateKeyError as error:
        raise HTTPException(status_code=409, detail=NUMBER_TAKEN) from error
    return _public_player(document, include_contact=True)


@router.patch("/players/{player_id}")
async def update_player(
    player_id: str,
    body: PlayerUpdate,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    await _ensure_indexes(db)
    player = await db.players.find_one({"id": player_id})
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    changes = body.model_dump(include=body.model_fields_set)
    if player.get("user_id") and changes.get("team_id", player["team_id"]) != player["team_id"]:
        raise HTTPException(status_code=409, detail=LINKED_PLAYER)
    if changes.get("email"):
        changes["email"] = changes["email"].casefold()
    # Quien cambia de equipo vuelve al banquillo de su nuevo equipo.
    if changes.get("team_id", player["team_id"]) != player["team_id"] and "court" not in changes:
        changes["court"] = None

    await _check_number_free(
        db,
        changes.get("team_id", player["team_id"]),
        changes.get("number", player.get("number")),
        ignore_id=player_id,
    )

    changes.update(updated_at=datetime.now(timezone.utc), updated_by=user["id"])
    try:
        updated = await db.players.find_one_and_update(
            {"id": player_id},
            {"$set": changes},
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError as error:
        raise HTTPException(status_code=409, detail=NUMBER_TAKEN) from error
    return _public_player(updated, include_contact=True)


@router.delete("/players/{player_id}", status_code=204)
async def delete_player(player_id: str, _user=Depends(require_staff), db=Depends(get_db)):
    player = await db.players.find_one({"id": player_id})
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    if player.get("user_id"):
        raise HTTPException(status_code=409, detail=LINKED_PLAYER)
    await db.players.delete_one({"id": player_id})
