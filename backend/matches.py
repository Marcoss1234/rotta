from datetime import date, datetime, timedelta
from typing import Annotated, Literal, Optional
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

from attendance import _can_respond, answer_lists
from database import get_db
from honors import set_coins
from notifications import send_notifications, team_member_ids
from players import _is_staff, require_approved
from teams import TeamId, match_teams

CLUB_TIME = ZoneInfo("Europe/Madrid")
MAX_DAYS_AHEAD = 366
MAX_DAYS_BACK = 730
MAX_PLAYED_LISTED = 300
MAX_SETS = 5
# Decir "Voy" a un partido da coins; si luego dices que no, se quitan.
MATCH_COINS = 7  # Igual que en coins.py.
WEEKDAYS = ("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom")
MONTHS = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")
# Si cambia algo de esto, los jugadores tienen que enterarse.
NOTIFIED_FIELDS = ("date", "time", "opponent", "location")

Kind = Literal["amistoso", "liga", "torneo", "otro"]
Time = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
Opponent = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Place = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
Notes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]

router = APIRouter(prefix="/api")


def can_manage_matches(user):
    """Entrenadores y administradores, y los jugadores a los que un administrador haya hecho editores."""
    return _is_staff(user) or bool(user.get("match_editor"))


def _can_answer(user, team_id):
    return any(_can_respond(user, team) for team in match_teams(team_id))


async def require_match_manager(user=Depends(require_approved)):
    if not can_manage_matches(user):
        raise HTTPException(status_code=403, detail="Solo entrenadores, administradores y editores gestionan partidos")
    return user
_indexes_ready = False


def _today():
    # Los partidos se apuntan con la hora de España, no con la del servidor.
    return datetime.now(CLUB_TIME).date()


async def _notify_match(db, match, actor, title):
    day = date.fromisoformat(match["date"])
    when = f"{WEEKDAYS[day.weekday()]} {day.day} {MONTHS[day.month - 1]} · {match['time']}"
    await send_notifications(
        db,
        await team_member_ids(db, match_teams(match["team_id"]), actor["id"]),
        "matches",
        {
            "title": title,
            "body": f"{when} contra {match['opponent']}",
            "url": f"/app?equipo={match['team_id']}&pestana=partidos",
            "tag": f"match-{match['id']}",
        },
    )


# Un partido de hoy cuenta como jugado en cuanto se apunta su resultado.
def _is_played(match):
    return match["date"] < _today().isoformat() or bool(match.get("sets"))


def _check_sets(match_date, sets):
    if sets and match_date > _today().isoformat():
        raise HTTPException(status_code=422, detail="Ese partido aún no se ha jugado: quita el resultado o cambia la fecha")


def _check_date(match_date):
    today = _today()
    # Se admiten fechas pasadas para poder apuntar los partidos ya jugados.
    if not today - timedelta(days=MAX_DAYS_BACK) <= match_date <= today + timedelta(days=MAX_DAYS_AHEAD):
        raise HTTPException(status_code=422, detail="Elige una fecha de los dos últimos años o del próximo")


class SetScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    us: int = Field(ge=0, le=99)
    them: int = Field(ge=0, le=99)

    @model_validator(mode="after")
    def check_not_tied(self):
        if self.us == self.them:
            raise ValueError("Un set no puede acabar empatado")
        return self


class MatchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: TeamId
    date: date
    time: Time
    opponent: Opponent
    kind: Kind = "amistoso"
    location: Place = ""
    notes: Notes = ""
    sets: list[SetScore] = Field(default_factory=list, max_length=MAX_SETS)


# Un campo llamado `date` taparía al tipo `date` dentro de su propia clase.
MatchDate = date


class MatchUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: Optional[MatchDate] = None
    time: Optional[Time] = None
    opponent: Optional[Opponent] = None
    kind: Optional[Kind] = None
    location: Optional[Place] = None
    notes: Optional[Notes] = None
    sets: Optional[list[SetScore]] = Field(default=None, max_length=MAX_SETS)

    @model_validator(mode="after")
    def check_fields(self):
        if not self.model_fields_set:
            raise ValueError("Indica algún cambio")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} no puede quedar vacío")
        return self


class MatchAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["going", "not_going"]


async def _ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.matches.create_index("id", unique=True)
    await db.matches.create_index([("team_id", ASCENDING), ("date", ASCENDING)])
    await db.match_answers.create_index([("match_id", ASCENDING), ("user_id", ASCENDING)], unique=True)
    _indexes_ready = True


async def _public_match(db, match, user):
    answers = await db.match_answers.find({"match_id": match["id"]}).to_list(500)
    status_by_user = {answer["user_id"]: answer["status"] for answer in answers}
    live = await db.live_matches.find_one({"match_id": match["id"]})
    live_summary = None
    if live:
        from live import scoreboard, status_of  # Aquí dentro: live también usa este módulo.

        board = scoreboard(live)
        live_summary = {"id": live["id"], "status": status_of(live), "won": board["won"], "current": board["current"]}
    return {
        "live": live_summary,
        "is_today": match["date"] == _today().isoformat(),
        "id": match["id"],
        "team_id": match["team_id"],
        "date": match["date"],
        "time": match["time"],
        "opponent": match["opponent"],
        "kind": match["kind"],
        "location": match.get("location", ""),
        "notes": match.get("notes", ""),
        "sets": match.get("sets", []),
        "can_edit": can_manage_matches(user),
        "can_respond": _can_answer(user, match["team_id"]) and not _is_played(match),
        "mine": status_by_user.get(user["id"]),
        **await answer_lists(db, match_teams(match["team_id"]), status_by_user),
    }


async def _find_match(db, match_id):
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Ese partido ya no existe")
    return match


def _played_match(match, user):
    fields = ("id", "team_id", "date", "time", "opponent", "kind")
    return {
        **{field: match[field] for field in fields},
        "location": match.get("location", ""),
        "notes": match.get("notes", ""),
        "sets": match.get("sets", []),
        "mvp": match.get("mvp"),
        "can_edit": can_manage_matches(user),
    }


@router.get("/matches/played")
async def list_played_matches(team_id: TeamId = Query(...), user=Depends(require_approved), db=Depends(get_db)):
    """Los partidos ya jugados del equipo, del más reciente al más antiguo."""
    query = {"team_id": {"$in": list(match_teams(team_id))}, "date": {"$lte": _today().isoformat()}}
    matches = await db.matches.find(query).sort([("date", DESCENDING), ("time", DESCENDING)]).to_list(MAX_PLAYED_LISTED)
    return [_played_match(match, user) for match in matches if _is_played(match)]


@router.get("/matches")
async def list_matches(team_id: TeamId = Query(...), user=Depends(require_approved), db=Depends(get_db)):
    """Los próximos partidos del equipo, incluidos los de hoy, del más cercano al más lejano."""
    matches = await db.matches.find({"team_id": {"$in": list(match_teams(team_id))}, "date": {"$gte": _today().isoformat()}}).to_list(50)
    matches.sort(key=lambda match: (match["date"], match["time"]))
    return [await _public_match(db, match, user) for match in matches if not _is_played(match)]


@router.post("/matches", status_code=201)
async def create_match(body: MatchCreate, user=Depends(require_match_manager), db=Depends(get_db)):
    _check_date(body.date)
    _check_sets(body.date.isoformat(), body.sets)
    await _ensure_indexes(db)
    match = {
        **body.model_dump(),
        "date": body.date.isoformat(),
        "id": str(uuid4()),
        "created_by": user["id"],
        "created_at": datetime.now(CLUB_TIME),
    }
    await db.matches.insert_one(match)
    # Apuntar un partido ya jugado no es una novedad para nadie.
    if not _is_played(match):
        await _notify_match(db, match, user, "Partido nuevo")
    return await _public_match(db, match, user)


@router.patch("/matches/{match_id}")
async def update_match(match_id: str, body: MatchUpdate, user=Depends(require_match_manager), db=Depends(get_db)):
    before = await _find_match(db, match_id)
    changes = body.model_dump(include=body.model_fields_set)
    if "date" in changes:
        _check_date(body.date)
        changes["date"] = body.date.isoformat()
    _check_sets(changes.get("date", before["date"]), changes.get("sets", before.get("sets")))
    await db.matches.update_one({"id": match_id}, {"$set": {**changes, "updated_by": user["id"]}})
    updated = await _find_match(db, match_id)
    if not _is_played(updated) and any(before.get(field) != updated.get(field) for field in NOTIFIED_FIELDS):
        await _notify_match(db, updated, user, "Cambios en el partido")
    return await _public_match(db, updated, user)


@router.delete("/matches/{match_id}", status_code=204)
async def delete_match(match_id: str, user=Depends(require_match_manager), db=Depends(get_db)):
    match = await _find_match(db, match_id)
    await db.matches.delete_one({"id": match_id})
    await db.match_answers.delete_many({"match_id": match_id})
    if not _is_played(match):
        await _notify_match(db, match, user, "Partido cancelado")


@router.put("/matches/{match_id}/answer")
async def answer_match(match_id: str, body: MatchAnswer, user=Depends(require_approved), db=Depends(get_db)):
    match = await _find_match(db, match_id)
    if not _can_answer(user, match["team_id"]):
        raise HTTPException(status_code=403, detail="Solo puedes responder por tu propio equipo")
    if _is_played(match):
        raise HTTPException(status_code=422, detail="Ese partido ya se jugó")
    await _ensure_indexes(db)
    key = {"match_id": match_id, "user_id": user["id"]}
    change = {"$set": {"status": body.status, "updated_at": datetime.now(CLUB_TIME)}}
    try:
        await db.match_answers.update_one(key, change, upsert=True)
    except DuplicateKeyError:
        await db.match_answers.update_one(key, change)
    amount = MATCH_COINS if body.status == "going" else 0
    label = f"Voy al partido contra {match['opponent']}"[:80]
    coins = await set_coins(db, user["id"], amount, "match", label, f"match:{match_id}:{user['id']}")
    return {**await _public_match(db, match, user), "coins": coins}
