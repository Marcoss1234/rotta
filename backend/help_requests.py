"""Pedir ayuda para un entreno: cuando un equipo no llega a ser suficientes, se pide gente en el chat general.

Quien le da a "Voy" en ese mensaje queda apuntado al entreno de ese día como uno más (sin cambiar de equipo).
"""

from datetime import date, datetime, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from attendance import _can_respond, _check_training_date, answer_lists
from auth import pictures_by_user
from database import get_db
from honors import set_coins
from players import require_approved
from schedules import team_schedule
from teams import TeamId, team_name

CLUB_TIME = ZoneInfo("Europe/Madrid")
HELP_COINS = 3
# Por debajo de esto el inicio anima a pedir ayuda (se puede pedir igualmente).
FEW_PLAYERS = 5
WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

router = APIRouter(prefix="/api/attendance/help")
_indexes_ready = False


class HelpAsk(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: TeamId
    date: date


async def _ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.help_requests.create_index([("team_id", ASCENDING), ("date", ASCENDING)], unique=True)
    await db.help_requests.create_index([("id", ASCENDING)], unique=True)
    _indexes_ready = True


def _today():
    return datetime.now(CLUB_TIME).date()


def _can_ask(user, team_id):
    if _can_respond(user, team_id) or user.get("role") == "admin":
        return True
    return user.get("role") == "entrenador" and team_id in user.get("coached_team_ids", [])


def _plays_there(user, team_id):
    return user.get("team_id") == team_id and user.get("role") != "familia"


async def _start_time(db, team_id, training_date):
    for session in await team_schedule(db, team_id):
        if training_date.weekday() in session["days"] and session.get("start"):
            return session["start"]
    return None


def _day_label(training_date):
    return f"{WEEKDAYS[training_date.weekday()]} {training_date.day} de {MONTHS[training_date.month - 1]}"


async def help_cards(db, help_ids, user):
    """Lo que necesita el chat para pintar cada petición de ayuda: quién se ha apuntado y si puedes apuntarte."""
    if not help_ids:
        return {}
    requests = await db.help_requests.find({"id": {"$in": list(help_ids)}}).to_list(len(help_ids))
    helper_ids = {helper for request in requests for helper in request.get("helpers", [])}
    users = await db.users.find({"id": {"$in": list(helper_ids)}, "status": "approved"}).to_list(1000)
    by_id = {person["id"]: person for person in users}
    pictures = await pictures_by_user(db, list(helper_ids))
    today = _today().isoformat()
    cards = {}
    for request in requests:
        helpers = [by_id[helper] for helper in request.get("helpers", []) if helper in by_id]
        # La misma pista del inicio: todos los que van a ese entreno, los del equipo y los que vienen a ayudar.
        answers = await db.attendance.find({"team_id": request["team_id"], "date": request["date"], "status": "going"}).to_list(200)
        lists = await answer_lists(db, (request["team_id"],), {answer["user_id"]: "going" for answer in answers})
        cards[request["id"]] = {
            "going": lists["going"],
            "id": request["id"],
            "team_id": request["team_id"],
            "team_name": team_name(request["team_id"]),
            "date": request["date"],
            "start": request.get("start"),
            "past": request["date"] < today,
            "joined": user["id"] in request.get("helpers", []),
            "own_team": _plays_there(user, request["team_id"]),
            "coins": HELP_COINS,
            "helpers": [{"id": person["id"], "name": person["name"], "picture": pictures.get(person["id"], "")} for person in helpers],
        }
    return cards


async def _card(db, request_id, user):
    cards = await help_cards(db, [request_id], user)
    if request_id not in cards:
        raise HTTPException(status_code=404, detail="Esa petición de ayuda ya no existe")
    return cards[request_id]


@router.post("", status_code=201)
async def ask_for_help(body: HelpAsk, user=Depends(require_approved), db=Depends(get_db)):
    # Se importa aquí: el chat también usa este módulo para pintar las peticiones.
    from chat import _ensure_indexes as ensure_chat_indexes, _notify_new_message, _now

    if not _can_ask(user, body.team_id):
        raise HTTPException(status_code=403, detail="Solo puedes pedir ayuda para tu equipo")
    await _check_training_date(db, body.team_id, body.date)
    if body.date < _today():
        raise HTTPException(status_code=422, detail="Ese entreno ya ha pasado")
    await _ensure_indexes(db)
    key = {"team_id": body.team_id, "date": body.date.isoformat()}
    if await db.help_requests.find_one(key):
        raise HTTPException(status_code=409, detail="Ya se ha pedido ayuda para ese entreno")

    going = await db.attendance.count_documents({**key, "status": "going"})
    start = await _start_time(db, body.team_id, body.date)
    when = f"{_day_label(body.date)}{f' a las {start}' if start else ''}"
    people = "nadie" if going == 0 else ("1 persona" if going == 1 else f"{going} personas")
    text = (
        f"🆘 ¡Necesitamos ayuda! No somos suficientes para el entreno de {team_name(body.team_id)} "
        f"del {when}. De momento vamos {people}. ¿Te vienes? Dale a «Voy»."
    )
    request = {
        **key,
        "id": str(uuid4()),
        "start": start,
        "requested_by": user["id"],
        "helpers": [],
        "created_at": datetime.now(timezone.utc),
    }
    try:
        await db.help_requests.insert_one(request)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Ya se ha pedido ayuda para ese entreno") from None

    await ensure_chat_indexes(db)
    message = {
        "id": str(uuid4()),
        "channel": "general",
        "user_id": user["id"],
        "author": user["name"],
        "author_role": user.get("role"),
        "text": text,
        "help_id": request["id"],
        "created_at": _now(),
    }
    await db.chat_messages.insert_one(message)
    await db.help_requests.update_one({"id": request["id"]}, {"$set": {"message_id": message["id"]}})
    await _notify_new_message(db, "general", message)
    return await _card(db, request["id"], user)


async def _open_request(db, request_id):
    request = await db.help_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Esa petición de ayuda ya no existe")
    if request["date"] < _today().isoformat():
        raise HTTPException(status_code=422, detail="Ese entreno ya ha pasado")
    return request


def _coins_ref(request, user):
    return f"help:{request['id']}:{user['id']}"


@router.post("/{request_id}/join")
async def join_help(request_id: str, user=Depends(require_approved), db=Depends(get_db)):
    """"Voy": te apunta a ese entreno. Ayudar a otro equipo da coins."""
    if user.get("role") == "familia":
        raise HTTPException(status_code=403, detail="Solo pueden apuntarse los jugadores del club")
    request = await _open_request(db, request_id)
    if _plays_there(user, request["team_id"]):
        raise HTTPException(status_code=422, detail="Es tu propio entreno: dile que vas desde el inicio")
    key = {"team_id": request["team_id"], "date": request["date"], "user_id": user["id"]}
    change = {"$set": {"status": "going", "guest": True, "updated_at": datetime.now(timezone.utc)}}
    try:
        await db.attendance.update_one(key, change, upsert=True)
    except DuplicateKeyError:
        await db.attendance.update_one(key, change)
    await db.help_requests.update_one({"id": request_id}, {"$addToSet": {"helpers": user["id"]}})
    label = f"Ayudar a {team_name(request['team_id'], 'otro equipo')}"
    coins = await set_coins(db, user["id"], HELP_COINS, "help", label, _coins_ref(request, user))
    return {**await _card(db, request_id, user), "coins_change": coins}


@router.delete("/{request_id}/join")
async def leave_help(request_id: str, user=Depends(require_approved), db=Depends(get_db)):
    """"Ya no puedo": te quita de ese entreno y se quitan los coins."""
    request = await _open_request(db, request_id)
    await db.attendance.delete_one({"team_id": request["team_id"], "date": request["date"], "user_id": user["id"], "guest": True})
    await db.help_requests.update_one({"id": request_id}, {"$pull": {"helpers": user["id"]}})
    coins = await set_coins(db, user["id"], 0, "help", "", _coins_ref(request, user))
    return {**await _card(db, request_id, user), "coins_change": coins}


async def remove_help(db, request_id):
    """Al borrar el mensaje se cancela la petición: los que se apuntaron dejan de ir y se quitan sus coins."""
    request = await db.help_requests.find_one({"id": request_id})
    if not request:
        return
    for helper in request.get("helpers", []):
        await db.attendance.delete_one({"team_id": request["team_id"], "date": request["date"], "user_id": helper, "guest": True})
        await set_coins(db, helper, 0, "help", "", f"help:{request_id}:{helper}")
    await db.help_requests.delete_one({"id": request_id})
