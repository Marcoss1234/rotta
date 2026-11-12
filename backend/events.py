from datetime import date, datetime
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, StringConstraints

from database import get_db
from matches import CLUB_TIME, Notes, Place, _check_date
from players import _is_staff, require_approved, require_staff

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
OptionalTime = Annotated[str, StringConstraints(pattern=r"^$|^([01]\d|2[0-3]):[0-5]\d$")]

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"
MAX_PER_MONTH = 500

router = APIRouter(prefix="/api")


class EventSave(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    date: date
    time: OptionalTime = ""
    location: Place = ""
    notes: Notes = ""


def _public_event(event):
    return {
        "type": "event",
        "id": event["id"],
        "date": event["date"],
        "time": event.get("time", ""),
        "title": event["title"],
        "location": event.get("location", ""),
        "notes": event.get("notes", ""),
    }


# En el calendario un partido es solo una línea: qué equipo y contra quién.
def _calendar_match(match):
    return {
        "type": "match",
        "id": match["id"],
        "date": match["date"],
        "time": match["time"],
        "team_id": match["team_id"],
        "opponent": match["opponent"],
    }


@router.get("/calendar")
async def get_calendar(month: str = Query(..., pattern=MONTH_PATTERN), user=Depends(require_approved), db=Depends(get_db)):
    """Todo lo que hay en un mes: los partidos de todos los equipos y los eventos del club."""
    in_month = {"date": {"$gte": f"{month}-01", "$lte": f"{month}-31"}}
    matches = await db.matches.find(in_month).to_list(MAX_PER_MONTH)
    events = await db.events.find(in_month).to_list(MAX_PER_MONTH)
    items = [_calendar_match(match) for match in matches] + [_public_event(event) for event in events]
    items.sort(key=lambda item: (item["date"], item["time"]))
    return {"month": month, "can_manage": _is_staff(user), "items": items}


@router.post("/events", status_code=201)
async def create_event(body: EventSave, user=Depends(require_staff), db=Depends(get_db)):
    _check_date(body.date)
    event = {
        **body.model_dump(),
        "date": body.date.isoformat(),
        "id": str(uuid4()),
        "created_by": user["id"],
        "created_at": datetime.now(CLUB_TIME),
    }
    await db.events.insert_one(event)
    return _public_event(event)


@router.put("/events/{event_id}")
async def update_event(event_id: str, body: EventSave, user=Depends(require_staff), db=Depends(get_db)):
    _check_date(body.date)
    changes = {**body.model_dump(), "date": body.date.isoformat(), "updated_by": user["id"]}
    result = await db.events.update_one({"id": event_id}, {"$set": changes})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Ese evento ya no existe")
    return _public_event({"id": event_id, **changes})


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(event_id: str, _user=Depends(require_staff), db=Depends(get_db)):
    result = await db.events.delete_one({"id": event_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Ese evento ya no existe")
