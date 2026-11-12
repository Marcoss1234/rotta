import re
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from database import get_db
from players import require_approved
from teams import TEAM_WEEKDAYS, TEAMS, TeamId

# Horario de entrenamiento de cada equipo. Mientras nadie lo cambie desde la app, vale el de serie
# (el mismo que src/app/teams.js). Los días van de 0 (lunes) a 6 (domingo).
DEFAULT_SCHEDULES = {
    "masculino": [{"days": [1, 3], "start": "19:15", "end": "20:45"}],
    "femenino": [{"days": [1, 3], "start": "20:45", "end": "22:15"}],
    "escuela-lm": [{"days": [0, 2], "start": "17:45", "end": "19:15"}],
    "escuela-mj": [{"days": [1, 3], "start": "17:45", "end": "19:15"}],
    "playa": [{"days": [1, 3], "start": None, "end": None}],
}
assert all(
    tuple(sorted({day for session in sessions for day in session["days"]})) == TEAM_WEEKDAYS[team_id]
    for team_id, sessions in DEFAULT_SCHEDULES.items()
)

TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
Weekday = Annotated[int, Field(ge=0, le=6)]

router = APIRouter(prefix="/api")


class Session(BaseModel):
    model_config = ConfigDict(extra="forbid")

    days: Annotated[list[Weekday], Field(min_length=1, max_length=7)]
    # Sin hora (como en Playa) sale "Horario por consultar".
    start: Optional[str] = None
    end: Optional[str] = None

    @field_validator("days")
    @classmethod
    def sorted_days(cls, value):
        if len(set(value)) != len(value):
            raise ValueError("No repitas días")
        return sorted(value)

    @model_validator(mode="after")
    def check_times(self):
        if (self.start is None) != (self.end is None):
            raise ValueError("Pon la hora de inicio y la de fin, o ninguna")
        if self.start is not None:
            if not TIME_PATTERN.match(self.start) or not TIME_PATTERN.match(self.end):
                raise ValueError("La hora va como 19:15")
            if self.end <= self.start:
                raise ValueError("El entrenamiento tiene que acabar después de empezar")
        return self


class ScheduleSave(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sessions: Annotated[list[Session], Field(min_length=1, max_length=7)]

    @model_validator(mode="after")
    def no_shared_days(self):
        days = [day for session in self.sessions for day in session.days]
        if len(set(days)) != len(days):
            raise ValueError("Cada día solo puede tener un horario")
        return self


def can_edit_schedule(user, team_id):
    """El entrenador de ese equipo y los administradores."""
    if user.get("role") == "admin":
        return True
    if user.get("role") != "entrenador":
        return False
    return team_id == user.get("team_id") or team_id in user.get("coached_team_ids", [])


async def team_schedule(db, team_id):
    saved = await db.team_schedules.find_one({"team_id": team_id})
    return saved["sessions"] if saved else DEFAULT_SCHEDULES[team_id]


async def team_weekdays(db, team_id):
    """Los días que entrena el equipo, según su horario actual."""
    return {day for session in await team_schedule(db, team_id) for day in session["days"]}


@router.get("/schedules")
async def list_schedules(user=Depends(require_approved), db=Depends(get_db)):
    saved = {item["team_id"]: item["sessions"] for item in await db.team_schedules.find().to_list(len(TEAMS))}
    return {
        team["id"]: {
            "sessions": saved.get(team["id"], DEFAULT_SCHEDULES[team["id"]]),
            "can_edit": can_edit_schedule(user, team["id"]),
        }
        for team in TEAMS
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
