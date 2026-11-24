from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from auth import picture_of
from database import get_db
from honors import set_coins
from notifications import send_notifications
from players import require_approved
from roster_sync import plays_for_team
from schedules import team_schedule, team_weekdays
from teams import TeamId

MAX_DAYS_AHEAD = 14
RESPONDING_ROLES = ("jugador", "admin")
ATTENDANCE_COINS = 10
# Destacados del entreno: el entrenador elige hasta 3 de los que fueron y cada uno gana estos coins.
STAR_COINS = 5
MAX_STARS = 3
STAR_DAYS_BACK = 7
# Los destacados empiezan con los entrenos de este día en adelante: los anteriores no cuentan.
STARS_FROM = date(2026, 11, 12)
CLUB_TIME = ZoneInfo("Europe/Madrid")


def _club_now():
    # Hora de España: los entrenos se apuntan con la hora del club, no con la del servidor.
    return datetime.now(CLUB_TIME)

router = APIRouter(prefix="/api")
_indexes_ready = False


class AttendanceAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: TeamId
    date: date
    status: Literal["going", "not_going"]


class TrainingStars(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: TeamId
    date: date
    user_ids: list[str] = Field(default_factory=list, max_length=MAX_STARS)


def _can_star(user, team_id):
    """El entrenador de ese equipo o un administrador."""
    if user.get("role") == "admin":
        return True
    return user.get("role") == "entrenador" and team_id in user.get("coached_team_ids", [])


async def _training_started(db, team_id, day, now):
    """True si ese día hay entreno y ya ha empezado (un entreno sin hora cuenta al acabar el día)."""
    for session in await team_schedule(db, team_id):
        if day.weekday() not in session["days"]:
            continue
        if day < now.date():
            return True
        return day == now.date() and session.get("start") is not None and session["start"] <= now.strftime("%H:%M")
    return False


async def _last_training(db, team_id):
    """El último entreno que ya ha empezado (hoy, si ya ha empezado, o el anterior), desde STARS_FROM.
    Hasta que el equipo entrena, no hay destacados que enseñar."""
    now = _club_now()
    day = now.date()
    for _ in range(STAR_DAYS_BACK + 1):
        if day < STARS_FROM:
            return None
        if await _training_started(db, team_id, day, now):
            return day
        day -= timedelta(days=1)
    return None


async def _check_training_date(db, team_id, training_date):
    # Un día de margen por la diferencia horaria entre el servidor y España.
    today = datetime.now(timezone.utc).date()
    if not today - timedelta(days=1) <= training_date <= today + timedelta(days=MAX_DAYS_AHEAD):
        raise HTTPException(status_code=422, detail="Esa fecha no está disponible")
    if training_date.weekday() not in await team_weekdays(db, team_id):
        raise HTTPException(status_code=422, detail="Ese día no hay entrenamiento")


def _can_respond(user, team_id):
    return (user.get("role") in RESPONDING_ROLES or plays_for_team(user)) and user.get("team_id") == team_id


async def answer_lists(db, team_ids, status_by_user):
    """Quién va, quién no y quién falta por responder, con nombre y foto. Sirve para entrenos y partidos."""
    members = await db.users.find(
        {
            # Quien pierde el acceso sale de la lista, aunque hubiera respondido.
            "status": "approved",
            "$or": [
                {"id": {"$in": list(status_by_user)}},
                {"team_id": {"$in": list(team_ids)}, "role": "jugador"},
                {"team_id": {"$in": list(team_ids)}, "role": {"$in": ["entrenador", "admin"]}, "also_plays": True},
            ],
        }
    ).to_list(1000)
    # La posición y el dorsal ya son públicos para los miembros: salen también en la plantilla.
    players = await db.players.find({"user_id": {"$in": [member["id"] for member in members]}}).to_list(1000)
    player_by_user = {player["user_id"]: player for player in players}
    names = {"going": [], "not_going": [], "no_answer": []}
    for member in members:
        player = player_by_user.get(member["id"], {})
        names[status_by_user.get(member["id"], "no_answer")].append(
            {
                # Viene de otro equipo a ayudar.
                "guest": member.get("team_id") not in team_ids,
                "id": member["id"],
                "name": member["name"],
                "picture": picture_of(member),
                "position": player.get("position"),
                "number": player.get("number"),
            }
        )
    for group in names.values():
        group.sort(key=lambda person: person["name"].casefold())
    return names


async def _ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.attendance.create_index(
        [("team_id", ASCENDING), ("date", ASCENDING), ("user_id", ASCENDING)],
        unique=True,
    )
    _indexes_ready = True


@router.get("/attendance")
async def get_attendance(
    team_id: Annotated[TeamId, Query()],
    training_date: date = Query(..., alias="date"),
    user=Depends(require_approved),
    db=Depends(get_db),
):
    await _check_training_date(db, team_id, training_date)
    answers = await db.attendance.find({"team_id": team_id, "date": training_date.isoformat()}).to_list(500)
    mine = next((answer["status"] for answer in answers if answer["user_id"] == user["id"]), None)
    help_request = await db.help_requests.find_one({"team_id": team_id, "date": training_date.isoformat()})
    can_ask = _can_respond(user, team_id) or user.get("role") == "admin" or (
        user.get("role") == "entrenador" and team_id in user.get("coached_team_ids", [])
    )
    result = {
        "team_id": team_id,
        "date": training_date.isoformat(),
        "can_respond": _can_respond(user, team_id),
        "mine": mine,
        # Pedir ayuda a otros equipos en el chat general, y cómo va si ya se ha pedido.
        "can_ask_help": can_ask,
        "help": help_request and {"id": help_request["id"], "helpers": len(help_request.get("helpers", []))},
    }

    status_by_user = {answer["user_id"]: answer["status"] for answer in answers}
    return {**result, **await answer_lists(db, (team_id,), status_by_user)}


@router.put("/attendance")
async def answer_attendance(body: AttendanceAnswer, user=Depends(require_approved), db=Depends(get_db)):
    if not _can_respond(user, body.team_id):
        raise HTTPException(status_code=403, detail="Solo puedes responder por tu propio equipo")
    await _check_training_date(db, body.team_id, body.date)
    await _ensure_indexes(db)

    key = {"team_id": body.team_id, "date": body.date.isoformat(), "user_id": user["id"]}
    change = {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}}
    try:
        await db.attendance.update_one(key, change, upsert=True)
    except DuplicateKeyError:
        # Dos respuestas a la vez: la primera creó el registro, esta lo actualiza.
        await db.attendance.update_one(key, change)
    # Decir que vas da coins; si luego dices que no vas, se quitan. Una vez por entrenamiento.
    ref = f"attendance:{body.team_id}:{body.date.isoformat()}:{user['id']}"
    amount = ATTENDANCE_COINS if body.status == "going" else 0
    coins = await set_coins(db, user["id"], amount, "attendance", "Voy al entreno", ref)
    # Contestar tarde (el día después) devuelve los coins que se quitaron por no contestar.
    no_answer = f"no_answer:{body.team_id}:{body.date.isoformat()}:{user['id']}"
    coins += await set_coins(db, user["id"], 0, "no_answer", "", no_answer)
    return {"team_id": body.team_id, "date": body.date.isoformat(), "mine": body.status, "coins": coins}


@router.get("/attendance/stars")
async def get_stars(team_id: Annotated[TeamId, Query()], user=Depends(require_approved), db=Depends(get_db)):
    """Los destacados del último entreno y, para el entrenador, quién fue para poder elegirlos."""
    last = await _last_training(db, team_id)
    if not last:
        return {"team_id": team_id, "date": None, "stars": [], "going": [], "can_star": False, "coins": STAR_COINS}
    answers = await db.attendance.find({"team_id": team_id, "date": last.isoformat(), "status": "going"}).to_list(500)
    lists = await answer_lists(db, (team_id,), {answer["user_id"]: "going" for answer in answers})
    saved = await db.training_stars.find_one({"team_id": team_id, "date": last.isoformat()})
    starred = saved["user_ids"] if saved else []
    people = {person["id"]: person for person in lists["going"]}
    return {
        "team_id": team_id,
        "date": last.isoformat(),
        "stars": [people[user_id] for user_id in starred if user_id in people],
        "going": lists["going"] if _can_star(user, team_id) else [],
        "can_star": _can_star(user, team_id),
        "coins": STAR_COINS,
        "max": MAX_STARS,
    }


@router.put("/attendance/stars")
async def save_stars(body: TrainingStars, user=Depends(require_approved), db=Depends(get_db)):
    if not _can_star(user, body.team_id):
        raise HTTPException(status_code=403, detail="Solo el entrenador del equipo elige a los destacados")
    now = _club_now()
    today = now.date()
    if not today - timedelta(days=STAR_DAYS_BACK) <= body.date <= today or body.date < STARS_FROM:
        raise HTTPException(status_code=422, detail="Solo se eligen destacados de entrenos de esta última semana")
    if body.date.weekday() not in await team_weekdays(db, body.team_id):
        raise HTTPException(status_code=422, detail="Ese día no hay entrenamiento")
    if not await _training_started(db, body.team_id, body.date, now):
        raise HTTPException(status_code=422, detail="Los destacados se eligen cuando el entreno ya ha empezado")
    chosen = list(dict.fromkeys(body.user_ids))
    going = await db.attendance.find({"team_id": body.team_id, "date": body.date.isoformat(), "status": "going", "user_id": {"$in": chosen}}).to_list(10)
    if len(going) != len(chosen):
        raise HTTPException(status_code=422, detail="Solo pueden ser destacados los que fueron al entreno")
    key = {"team_id": body.team_id, "date": body.date.isoformat()}
    saved = await db.training_stars.find_one(key)
    before = saved["user_ids"] if saved else []
    await db.training_stars.update_one(key, {"$set": {"user_ids": chosen, "by": user["id"], "updated_at": datetime.now(timezone.utc)}}, upsert=True)
    label = f"Destacado del entreno del {body.date.day}/{body.date.month}"
    for user_id in set(before) | set(chosen):
        amount = STAR_COINS if user_id in chosen else 0
        await set_coins(db, user_id, amount, "star", label, f"star:{body.team_id}:{body.date.isoformat()}:{user_id}")
    new_stars = [user_id for user_id in chosen if user_id not in before]
    if new_stars:
        await send_notifications(
            db,
            new_stars,
            "ranking",
            {"title": "⭐ ¡Destacado del entreno!", "body": f"Tu entrenador te ha elegido: +{STAR_COINS} Club Coins", "url": "/app", "tag": f"estrella-{body.date.isoformat()}"},
        )
    return await get_stars(body.team_id, user, db)
