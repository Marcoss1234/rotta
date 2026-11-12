from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from attendance import ATTENDANCE_COINS, _can_respond
from database import get_db
from honors import balance_of, crowns_by_user, give_coins, set_coins
from players import require_approved
from schedules import team_weekdays

MAX_ENTRIES = 30
MAX_HONORS = 30
CLUB_TIME = ZoneInfo("Europe/Madrid")

# No contestar a un entreno (ni "Voy" ni "No voy") resta coins cuando ese día ya ha pasado.
NO_ANSWER_PENALTY = 10
# Solo cuenta desde que existe la norma, y como mucho los últimos dos meses.
PENALTIES_FROM = date(2026, 11, 12)
LOOKBACK_DAYS = 60
MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

router = APIRouter(prefix="/api")


# Los coins por decir "Voy" empezaron este día: los "Voy" guardados desde entonces cuentan aunque
# se dieran antes de que existieran los coins (o cuando valían menos).
COINS_FROM = date(2026, 11, 11)
MATCH_COINS = 7


async def sync_answer_coins(db, user):
    """Pone al día los coins de los "Voy" ya dados: a quien ya había contestado no le hace falta volver a hacerlo."""
    since = COINS_FROM.isoformat()
    trainings = await db.attendance.find(
        {"user_id": user["id"], "status": "going", "date": {"$gte": since}, "guest": {"$ne": True}}
    ).to_list(500)
    for answer in trainings:
        ref = f"attendance:{answer['team_id']}:{answer['date']}:{user['id']}"
        await set_coins(db, user["id"], ATTENDANCE_COINS, "attendance", "Voy al entreno", ref)
    answers = await db.match_answers.find({"user_id": user["id"], "status": "going"}).to_list(500)
    if answers:
        matches = await db.matches.find({"id": {"$in": [answer["match_id"] for answer in answers]}, "date": {"$gte": since}}).to_list(500)
        for match in matches:
            label = f"Voy al partido contra {match['opponent']}"[:80]
            await set_coins(db, user["id"], MATCH_COINS, "match", label, f"match:{match['id']}:{user['id']}")


def no_answer_ref(team_id, day, user_id):
    return f"no_answer:{team_id}:{day}:{user_id}"


def _joined_on(user):
    created = user.get("created_at")
    if isinstance(created, str):
        created = datetime.fromisoformat(created)
    if isinstance(created, datetime):
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return created.astimezone(CLUB_TIME).date()
    return None


async def charge_missed_answers(db, user):
    """Resta los coins de cada entreno ya pasado al que no contestaste. Cada entreno se cobra una sola vez."""
    team_id = user.get("team_id")
    if not team_id or not _can_respond(user, team_id):
        return
    today = datetime.now(CLUB_TIME).date()
    start = max(PENALTIES_FROM, today - timedelta(days=LOOKBACK_DAYS))
    joined = _joined_on(user)
    if joined:
        # El día que entras en el club no cuenta: aún no sabías que había que contestar.
        start = max(start, joined + timedelta(days=1))
    weekdays = await team_weekdays(db, team_id)
    days = []
    day = start
    while day < today:
        if day.weekday() in weekdays:
            days.append(day.isoformat())
        day += timedelta(days=1)
    if not days:
        return
    answered = await db.attendance.find({"team_id": team_id, "user_id": user["id"], "date": {"$in": days}}).to_list(len(days))
    done = {answer["date"] for answer in answered}
    for missed in days:
        if missed not in done:
            label = f"Sin contestar al entreno del {int(missed[8:10])} {MONTHS[int(missed[5:7]) - 1]}"
            await give_coins(db, user["id"], -NO_ANSWER_PENALTY, "no_answer", label, no_answer_ref(team_id, missed, user["id"]))


@router.get("/coins")
async def my_coins(user=Depends(require_approved), db=Depends(get_db)):
    """Tus Club Coins: el saldo, de dónde han salido los últimos y los premios que has ganado."""
    await sync_answer_coins(db, user)
    await charge_missed_answers(db, user)
    entries = await db.coin_entries.find({"user_id": user["id"]}).sort("created_at", -1).to_list(MAX_ENTRIES)
    honors = await db.honors.find({"user_id": user["id"]}).sort("created_at", -1).to_list(MAX_HONORS)
    crowns = await crowns_by_user(db, [user["id"]])
    return {
        "balance": await balance_of(db, user["id"]),
        "crown": crowns.get(user["id"]),
        "no_answer_penalty": NO_ANSWER_PENALTY,
        "entries": [
            {"amount": entry["amount"], "label": entry["label"], "kind": entry["kind"], "created_at": entry["created_at"]}
            for entry in entries
        ],
        "honors": [
            {
                "title": honor["title"],
                "kind": honor["kind"],
                "place": honor["place"],
                "period": honor["period"],
                "group_id": honor["group_id"],
                "current": honor["current"],
            }
            for honor in honors
        ],
    }
