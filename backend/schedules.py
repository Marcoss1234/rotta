from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from database import get_db
from players import require_approved
from teams import Sessions, TeamId, default_schedule, teams

# Horario de entrenamiento de cada equipo. Mientras nadie lo cambie desde la app, vale el de serie,
# que es parte de la estructura del club (teams.py). Los días van de 0 (lunes) a 6 (domingo).

router = APIRouter(prefix="/api")


class ScheduleSave(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sessions: Sessions


def can_edit_schedule(user, team_id):
    """El entrenador de ese equipo y los administradores."""
    if user.get("role") == "admin":
        return True
    if user.get("role") != "entrenador":
        return False
    return team_id == user.get("team_id") or team_id in user.get("coached_team_ids", [])


async def team_schedule(db, team_id):
    saved = await db.team_schedules.find_one({"team_id": team_id})
    return saved["sessions"] if saved else default_schedule(team_id)


async def team_weekdays(db, team_id):
    """Los días que entrena el equipo, según su horario actual."""
    return {day for session in await team_schedule(db, team_id) for day in session["days"]}


@router.get("/schedules")
async def list_schedules(user=Depends(require_approved), db=Depends(get_db)):
    saved = {item["team_id"]: item["sessions"] for item in await db.team_schedules.find().to_list(len(teams()))}
    return {
        team["id"]: {
            "sessions": saved.get(team["id"]) or default_schedule(team["id"]),
            "can_edit": can_edit_schedule(user, team["id"]),
        }
        for team in teams()
    }


@router.put("/schedules/{team_id}")
async def save_schedule(team_id: TeamId, body: ScheduleSave, user=Depends(require_approved), db=Depends(get_db)):
    if not can_edit_schedule(user, team_id):
        raise HTTPException(status_code=403, detail="Solo el entrenador del equipo puede cambiar su horario")
    sessions = [session.model_dump() for session in body.sessions]
    sessions.sort(key=lambda session: session["days"][0])
    await db.team_schedules.update_one(
        {"team_id": team_id},
        {"$set": {"sessions": sessions, "updated_by": user["id"], "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"sessions": sessions, "can_edit": True}
