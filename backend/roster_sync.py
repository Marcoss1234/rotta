from datetime import datetime, timezone
from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from teams import team_ids


_index_ready = False


async def ensure_user_index(db):
    global _index_ready
    if _index_ready:
        return
    await db.players.create_index(
        "user_id",
        unique=True,
        partialFilterExpression={"user_id": {"$type": "string"}},
    )
    _index_ready = True


def plays_for_team(user):
    """Es jugador, o entrenador o administrador que también juega."""
    role = user.get("role")
    return role == "jugador" or (role in ("entrenador", "admin") and bool(user.get("also_plays")))


def _belongs_on_roster(user):
    return user.get("status") == "approved" and plays_for_team(user) and user.get("team_id") in team_ids()


async def sync_player_with_user(db, user):
    """Mantiene la ficha de la plantilla al día con la cuenta: quien es jugador con equipo tiene ficha."""
    await ensure_user_index(db)
    player = await db.players.find_one({"user_id": user["id"]})

    if not _belongs_on_roster(user):
        if player:
            await db.players.delete_one({"id": player["id"]})
        return

    now = datetime.now(timezone.utc)
    if not player:
        try:
            await db.players.insert_one(
                {
                    "id": str(uuid4()),
                    "user_id": user["id"],
                    "team_id": user["team_id"],
                    "name": user["name"],
                    "position": next(iter(user.get("preferred_positions", [])), "Sin definir"),
                    "preferred_positions": user.get("preferred_positions", []),
                    "number": None,
                    "phone": None,
                    "email": None,
                    "court": None,
                    "created_at": now,
                    "updated_at": now,
                }
            )
        except DuplicateKeyError:
            pass  # Otra petición simultánea ya creó la ficha.
        return

    if player["team_id"] == user["team_id"]:
        return

    # Cambia de equipo: vuelve al banquillo y conserva el dorsal si está libre en el nuevo.
    number = player.get("number")
    taken = number is not None and await db.players.find_one({"team_id": user["team_id"], "number": number})
    changes = {"team_id": user["team_id"], "court": None, "number": None if taken else number, "updated_at": now}
    try:
        await db.players.update_one({"id": player["id"]}, {"$set": changes})
    except DuplicateKeyError:
        await db.players.update_one({"id": player["id"]}, {"$set": {**changes, "number": None}})
