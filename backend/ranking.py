from datetime import date, datetime, timedelta
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from auth import _admin_emails, characters_by_user, heights_by_user, pictures_by_user
from database import get_db
from honors import crowns_by_user, give_honor
from notifications import send_notifications, team_member_ids
from players import Position, require_approved

CLUB_TIME = ZoneInfo("Europe/Madrid")
# El ranking es la media de las últimas semanas publicadas, para que una sola semana no lo decida todo.
WINDOW_WEEKS = 4
MIN_WEEKS = 2
# Quien tiene menos semanas de las necesarias sale igual en la tabla, pero con esta penalización en la media
# (de 0 a 100) y la marca de «1 semana»: así aparece, pero una sola semana buena no le sube arriba del todo.
FEW_WEEKS_PENALTY = 10
HISTORY_WEEKS = 12

# Playa no entra hasta que se decida cómo funciona. Las dos Escuelas comparten ranking.
GROUPS = {
    "masculino": {"name": "Club Masculino", "teams": ("masculino",)},
    "femenino": {"name": "Club Senior Femenino", "teams": ("femenino",)},
    "escuela": {"name": "Club Escuela", "teams": ("escuela-lm", "escuela-mj")},
}
GroupId = Literal["masculino", "femenino", "escuela"]

Skill = Literal["saque", "recepcion", "antebrazo", "colocacion", "ataque", "bloqueo"]
SKILLS = [
    {"id": "saque", "label": "Saque"},
    {"id": "recepcion", "label": "Recepción"},
    # Se llamaba "Pase de antebrazo": el id no cambia para conservar las notas ya guardadas.
    {"id": "antebrazo", "label": "Defensa"},
    {"id": "colocacion", "label": "Colocación"},
    {"id": "ataque", "label": "Ataque"},
    {"id": "bloqueo", "label": "Bloqueo"},
]

# Cuánto pesa cada habilidad en el overall de cada posición. Lo que no aparece no se puntúa.
WEIGHTS = {
    "Colocador": {"saque": 10, "recepcion": 5, "antebrazo": 10, "colocacion": 55, "ataque": 5, "bloqueo": 15},
    "Líbero": {"recepcion": 45, "antebrazo": 40, "colocacion": 15},
    "Receptor": {"saque": 15, "recepcion": 30, "antebrazo": 10, "colocacion": 5, "ataque": 30, "bloqueo": 10},
    "Central": {"saque": 15, "antebrazo": 5, "colocacion": 5, "ataque": 35, "bloqueo": 40},
    "Opuesto": {"saque": 15, "recepcion": 5, "antebrazo": 10, "colocacion": 5, "ataque": 50, "bloqueo": 15},
    "Sin definir": {skill["id"]: 1 for skill in SKILLS},
}

Score = Annotated[float, Field(ge=1, le=10, multiple_of=0.5)]
Comment = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]

router = APIRouter(prefix="/api")
_indexes_ready = False


class RatingSave(BaseModel):
    model_config = ConfigDict(extra="forbid")

    group_id: GroupId
    week: date
    player_id: str = Field(min_length=1, max_length=64)
    position: Position
    scores: dict[Skill, Score]
    comment: Comment = ""

    @model_validator(mode="after")
    def check_scores(self):
        not_rated = [skill for skill in self.scores if skill not in WEIGHTS[self.position]]
        if not_rated:
            raise ValueError(f"{self.position} no se puntúa en {', '.join(not_rated)}")
        if self.comment and not self.scores:
            raise ValueError("Pon al menos una nota para dejar un comentario")
        return self


class WeekPublish(BaseModel):
    model_config = ConfigDict(extra="forbid")

    group_id: GroupId
    week: date


def overall_of(position, scores):
    """De 0 a 100. Si una habilidad se queda sin nota, su peso se reparte entre las demás."""
    weights = {skill: weight for skill, weight in WEIGHTS[position].items() if skill in scores}
    total = sum(weights.values())
    if not total:
        return None
    return round(sum(scores[skill] * weight for skill, weight in weights.items()) / total * 10, 1)


def _current_monday():
    today = datetime.now(CLUB_TIME).date()
    return today - timedelta(days=today.weekday())


def _check_week(week):
    if week.weekday() != 0:
        raise HTTPException(status_code=422, detail="La semana se indica por su lunes")
    if week > _current_monday():
        raise HTTPException(status_code=422, detail="Esa semana aún no ha empezado")
    return week.isoformat()


def _rated_teams(user):
    """El administrador principal puede puntuar todos los equipos; los demás, los que entrenan."""
    coached = set(user.get("coached_team_ids", []))
    if user.get("role") == "admin" and user.get("email", "").casefold() in _admin_emails():
        return {team for group in GROUPS.values() for team in group["teams"]}
    if user.get("role") == "entrenador":
        return coached | {user.get("team_id")}
    return coached if user.get("role") == "admin" else set()


def _can_view(user, group_id):
    # Todo el club ve el ranking de todos los equipos, menos las familias.
    return user.get("role") != "familia"


def _can_rate(user, group_id):
    return bool(_rated_teams(user) & set(GROUPS[group_id]["teams"]))


def _require_view(user, group_id):
    if not _can_view(user, group_id):
        raise HTTPException(status_code=403, detail="El ranking no está disponible para las familias")


def _require_rate(user, group_id):
    if not _can_rate(user, group_id):
        raise HTTPException(status_code=403, detail="Solo el entrenador de este equipo o el administrador principal pone notas")


async def _ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.ratings.create_index(
        [("group_id", ASCENDING), ("week", ASCENDING), ("player_id", ASCENDING)],
        unique=True,
    )
    await db.rating_weeks.create_index([("group_id", ASCENDING), ("week", ASCENDING)], unique=True)
    _indexes_ready = True


async def _roster(db, group_id):
    players = await db.players.find({"team_id": {"$in": list(GROUPS[group_id]["teams"])}}).to_list(500)
    players.sort(key=lambda player: player["name"].casefold())
    pictures = await pictures_by_user(db, [player.get("user_id") for player in players])
    return players, pictures


async def _published_weeks(db, group_id):
    """Las semanas publicadas del grupo, de la más reciente a la más antigua."""
    weeks = await db.rating_weeks.find({"group_id": group_id}).to_list(1000)
    return sorted((week["week"] for week in weeks), reverse=True)


# ---------- Premios: podio de cada semana y jugador del mes ----------

WEEK_PRIZES = {1: 100, 2: 60, 3: 40}
MONTH_PRIZES = {1: 250, 2: 150, 3: 100}
MONTH_TITLES = {"masculino": "Jugador del mes", "femenino": "Jugadora del mes", "escuela": "Estrella del mes"}
MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def _podium(values):
    """Los tres primeros puestos. Con la misma nota (a un decimal) se comparte puesto y premio."""
    result, place, previous = [], 0, None
    for index, (player_id, value) in enumerate(sorted(values.items(), key=lambda item: -item[1]), start=1):
        rounded = round(value, 1)
        if rounded != previous:
            place, previous = index, rounded
        if place > 3:
            break
        result.append((player_id, place))
    return result


def _month_of(week_key):
    return week_key[:7]


def _previous_month(month):
    year, number = int(month[:4]), int(month[5:7])
    return f"{year - 1}-12" if number == 1 else f"{year}-{number - 1:02d}"


def _month_label(month):
    return f"{MONTH_NAMES[int(month[5:7]) - 1]} {month[:4]}"


async def _week_overalls(db, group_id, weeks, roster_ids):
    """La nota de cada jugador en cada una de esas semanas."""
    ratings = await db.ratings.find({"group_id": group_id, "week": {"$in": list(weeks)}}).to_list(5000)
    scores = {}
    for rating in ratings:
        overall = overall_of(rating["position"], rating["scores"])
        if rating["player_id"] in roster_ids and overall is not None:
            scores.setdefault(rating["player_id"], []).append(overall)
    return scores


async def _give_podium(db, group_id, kind, period, podium, by_id, prizes, title_of, current):
    if current:
        # La corona pasa a los nuevos: los de antes se quedan el premio en su historial.
        await db.honors.update_many({"group_id": group_id, "kind": kind, "current": True}, {"$set": {"current": False}})
    winners = {}
    for player_id, place in podium:
        user_id = by_id[player_id].get("user_id")
        title = title_of(place)
        given = await give_honor(
            db,
            group_id=group_id,
            kind=kind,
            period=period,
            player_id=player_id,
            user_id=user_id,
            place=place,
            title=title,
            coins=prizes[place],
            current=current,
        )
        if given and user_id:
            winners[user_id] = (title, prizes[place])
    for user_id, (title, coins) in winners.items():
        await send_notifications(
            db,
            [user_id],
            "ranking",
            {"title": title, "body": f"Has ganado {coins} Club Coins", "url": "/app/perfil", "tag": f"premio-{kind}"},
        )


async def award_week(db, group_id, week_key):
    """Al publicar una semana: premio a los tres mejores de esa semana y, si empieza mes, a los mejores del mes anterior."""
    players, _ = await _roster(db, group_id)
    by_id = {player["id"]: player for player in players}
    published = await _published_weeks(db, group_id)
    latest = bool(published) and published[0] == week_key
    scores = await _week_overalls(db, group_id, [week_key], by_id)
    podium = _podium({player_id: values[0] for player_id, values in scores.items()})
    await _give_podium(db, group_id, "week", week_key, podium, by_id, WEEK_PRIZES, lambda place: f"Top {place} de la semana", latest)

    # El mes se cierra cuando se publica la primera semana del mes siguiente.
    if not latest:
        return
    month = _previous_month(_month_of(week_key))
    weeks = [week for week in published if _month_of(week) == month]
    if not weeks or await db.honors.find_one({"group_id": group_id, "kind": "month", "period": month}):
        return
    scores = await _week_overalls(db, group_id, weeks, by_id)
    required = min(MIN_WEEKS, len(weeks))
    averages = {player_id: sum(values) / len(values) for player_id, values in scores.items() if len(values) >= required}
    label = _month_label(month)

    def title_of(place):
        return f"{MONTH_TITLES[group_id]} · {label}" if place == 1 else f"Top {place} de {label}"

    await _give_podium(db, group_id, "month", month, _podium(averages), by_id, MONTH_PRIZES, title_of, True)


def _config():
    return {"skills": SKILLS, "weights": WEIGHTS}


def _public_rating(rating, with_comment=True):
    return {
        "week": rating["week"],
        "position": rating["position"],
        "scores": rating["scores"],
        "comment": rating.get("comment", "") if with_comment else "",
        "overall": overall_of(rating["position"], rating["scores"]),
    }


def _standings(ratings, window, roster_ids):
    """Quién tiene puesto y con qué media, y quién está puntuado pero aún no tiene semanas suficientes."""
    required = min(MIN_WEEKS, len(window))
    overalls = {}
    for rating in ratings:
        overall = overall_of(rating["position"], rating["scores"])
        if rating["week"] in window and rating["player_id"] in roster_ids and overall is not None:
            overalls.setdefault(rating["player_id"], []).append(overall)

    averages, provisional = {}, set()
    for player, values in overalls.items():
        average = sum(values) / len(values)
        if len(values) < required:
            # Pocas semanas: entra igual, pero con penalización (ver FEW_WEEKS_PENALTY).
            average = max(0.0, average - FEW_WEEKS_PENALTY)
            provisional.add(player)
        averages[player] = average
    places, place, previous = {}, 0, None
    for index, (player, average) in enumerate(sorted(averages.items(), key=lambda item: -item[1]), start=1):
        rounded = round(average, 1)
        # Con la misma media se comparte puesto.
        if rounded != previous:
            place, previous = index, rounded
        places[player] = {"rank": place, "overall": rounded, "provisional": player in provisional}
    return places, [player for player in overalls if player not in places]


@router.get("/ranking/groups")
async def list_groups(user=Depends(require_approved)):
    return [
        {"id": group_id, "name": group["name"], "can_rate": _can_rate(user, group_id)}
        for group_id, group in GROUPS.items()
        if _can_view(user, group_id)
    ]


@router.get("/ranking")
async def get_ranking(group_id: GroupId = Query(...), user=Depends(require_approved), db=Depends(get_db)):
    """Solo el overall: el detalle por habilidad y los comentarios no salen aquí."""
    _require_view(user, group_id)
    players, pictures = await _roster(db, group_id)
    by_id = {player["id"]: player for player in players}
    mine = next((player["id"] for player in players if player.get("user_id") == user["id"]), None)
    published = await _published_weeks(db, group_id)
    if not published:
        return {"group_id": group_id, "week": None, "has_previous": False, "entries": [], "pending": [], "my_player_id": mine}

    latest, window, previous_window = published[0], published[:WINDOW_WEEKS], published[1 : WINDOW_WEEKS + 1]
    ratings = await db.ratings.find(
        {"group_id": group_id, "week": {"$in": list({*window, *previous_window})}}
    ).to_list(5000)
    places, pending = _standings(ratings, window, by_id)
    previous_places, _ = _standings(ratings, previous_window, by_id)

    latest_rating = {}
    for rating in sorted((item for item in ratings if item["week"] in window), key=lambda item: item["week"]):
        latest_rating[rating["player_id"]] = rating

    def person(player_id):
        player = by_id[player_id]
        return {
            "player_id": player_id,
            "name": player["name"],
            "number": player.get("number"),
            "picture": pictures.get(player.get("user_id"), ""),
            "position": latest_rating[player_id]["position"],
        }

    entries = []
    for player_id, place in places.items():
        week_rating = latest_rating[player_id] if latest_rating[player_id]["week"] == latest else None
        before = previous_places.get(player_id)
        entries.append(
            {
                **person(player_id),
                **place,
                "week_overall": overall_of(week_rating["position"], week_rating["scores"]) if week_rating else None,
                "movement": before["rank"] - place["rank"] if before else None,
            }
        )
    entries.sort(key=lambda entry: (entry["rank"], entry["name"].casefold()))
    waiting = sorted((person(player_id) for player_id in pending), key=lambda entry: entry["name"].casefold())
    return {
        "group_id": group_id,
        "week": latest,
        "has_previous": bool(previous_window),
        "entries": entries,
        "pending": waiting,
        "my_player_id": mine,
    }


@router.get("/ranking/honors")
async def get_honors(group_id: GroupId = Query(...), user=Depends(require_approved), db=Depends(get_db)):
    """El podio de la última semana y el mejor del mes, los que llevan corona ahora mismo."""
    _require_view(user, group_id)
    players, pictures = await _roster(db, group_id)
    by_id = {player["id"]: player for player in players}
    honors = await db.honors.find({"group_id": group_id, "current": True}).to_list(100)

    def entry(honor):
        player = by_id.get(honor["player_id"], {})
        return {
            "player_id": honor["player_id"],
            "name": player.get("name", "Jugador"),
            "picture": pictures.get(player.get("user_id"), ""),
            "place": honor["place"],
            "title": honor["title"],
            "coins": honor["coins"],
            "period": honor["period"],
        }

    def of_kind(kind):
        return sorted((entry(honor) for honor in honors if honor["kind"] == kind), key=lambda item: (item["place"], item["name"]))

    return {
        "group_id": group_id,
        "week": of_kind("week"),
        "month": of_kind("month"),
        "month_title": MONTH_TITLES[group_id],
        # Lo que se gana por cada puesto, para enseñarlo en el apartado de recompensas.
        "prizes": {
            "week": [{"place": place, "coins": coins} for place, coins in sorted(WEEK_PRIZES.items())],
            "month": [{"place": place, "coins": coins} for place, coins in sorted(MONTH_PRIZES.items())],
        },
    }


@router.get("/ranking/players/{player_id}")
async def get_player_history(
    player_id: str,
    group_id: GroupId = Query(...),
    user=Depends(require_approved),
    db=Depends(get_db),
):
    """Las notas publicadas las ve todo el que ve el ranking; el comentario, solo el propio jugador y sus entrenadores."""
    _require_view(user, group_id)
    player = await db.players.find_one({"id": player_id, "team_id": {"$in": list(GROUPS[group_id]["teams"])}})
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    with_comment = player.get("user_id") == user["id"] or user.get("role") == "admin" or _can_rate(user, group_id)
    published = (await _published_weeks(db, group_id))[:HISTORY_WEEKS]
    ratings = await db.ratings.find({"group_id": group_id, "player_id": player_id, "week": {"$in": published}}).to_list(100)
    ratings.sort(key=lambda rating: rating["week"], reverse=True)
    return {"player_id": player_id, "name": player["name"], "weeks": [_public_rating(item, with_comment) for item in ratings], **_config()}


@router.get("/ranking/sheet")
async def get_sheet(
    group_id: GroupId = Query(...),
    week: date = Query(...),
    user=Depends(require_approved),
    db=Depends(get_db),
):
    """La hoja del entrenador: aquí sí se ven los borradores."""
    _require_rate(user, group_id)
    week_key = _check_week(week)
    players, pictures = await _roster(db, group_id)
    ratings = await db.ratings.find({"group_id": group_id, "week": week_key}).to_list(500)
    by_player = {rating["player_id"]: rating for rating in ratings}
    published = await db.rating_weeks.find_one({"group_id": group_id, "week": week_key})
    return {
        "group_id": group_id,
        "week": week_key,
        "published": bool(published),
        "rows": [
            {
                "player_id": player["id"],
                "name": player["name"],
                "number": player.get("number"),
                "picture": pictures.get(player.get("user_id"), ""),
                "position": player["position"],
                "rating": _public_rating(by_player[player["id"]]) if player["id"] in by_player else None,
            }
            for player in players
        ],
        **_config(),
    }


@router.put("/ranking/ratings")
async def save_rating(body: RatingSave, user=Depends(require_approved), db=Depends(get_db)):
    """Guarda las notas de un jugador. Sin ninguna nota, queda sin puntuar esa semana."""
    _require_rate(user, body.group_id)
    week_key = _check_week(body.week)
    if not await db.players.find_one({"id": body.player_id, "team_id": {"$in": list(GROUPS[body.group_id]["teams"])}}):
        raise HTTPException(status_code=404, detail="Ese jugador no está en este equipo")
    key = {"group_id": body.group_id, "week": week_key, "player_id": body.player_id}
    if not body.scores:
        await db.ratings.delete_one(key)
        return {"rating": None}

    await _ensure_indexes(db)
    rating = {
        "position": body.position,
        "scores": body.scores,
        "comment": body.comment,
        "updated_by": user["id"],
        "updated_at": datetime.now(CLUB_TIME),
    }
    try:
        await db.ratings.update_one(key, {"$set": rating}, upsert=True)
    except DuplicateKeyError:
        await db.ratings.update_one(key, {"$set": rating})
    return {"rating": _public_rating({**key, **rating})}


@router.post("/ranking/publish")
async def publish_week(body: WeekPublish, user=Depends(require_approved), db=Depends(get_db)):
    _require_rate(user, body.group_id)
    week_key = _check_week(body.week)
    if not await db.ratings.find_one({"group_id": body.group_id, "week": week_key}):
        raise HTTPException(status_code=422, detail="Pon al menos una nota antes de publicar")
    await _ensure_indexes(db)
    key = {"group_id": body.group_id, "week": week_key}
    change = {"$setOnInsert": {"published_by": user["id"], "published_at": datetime.now(CLUB_TIME)}}
    try:
        result = await db.rating_weeks.update_one(key, change, upsert=True)
    except DuplicateKeyError:
        result = None  # Dos publicaciones a la vez: la semana ya está publicada.
    if result is not None and result.upserted_id is not None:
        await award_week(db, body.group_id, week_key)
        await send_notifications(
            db,
            await team_member_ids(db, GROUPS[body.group_id]["teams"], user["id"]),
            "ranking",
            {
                "title": "Ranking actualizado",
                "body": f"Ya están las notas de la semana en {GROUPS[body.group_id]['name']}",
                "url": f"/app/ranking?grupo={body.group_id}",
                "tag": f"ranking-{body.group_id}",
            },
        )
    return {"group_id": body.group_id, "week": week_key, "published": True}


@router.post("/ranking/award")
async def award_published_week(body: WeekPublish, user=Depends(require_approved), db=Depends(get_db)):
    """Solo administradores: dar los premios de una semana ya publicada que se quedó sin ellos
    (por ejemplo, porque se publicó antes de que existieran). Si ya estaban dados, no se dan otra vez."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo los administradores dan premios de semanas pasadas")
    week_key = _check_week(body.week)
    if not await db.rating_weeks.find_one({"group_id": body.group_id, "week": week_key}):
        raise HTTPException(status_code=422, detail="Esa semana no está publicada")
    await award_week(db, body.group_id, week_key)
    honors = await db.honors.find({"group_id": body.group_id, "kind": "week", "period": week_key}).to_list(20)
    return {
        "group_id": body.group_id,
        "week": week_key,
        "winners": [{"place": honor["place"], "player_id": honor["player_id"], "coins": honor["coins"]} for honor in sorted(honors, key=lambda item: item["place"])],
    }


@router.get("/players/{player_id}/profile")
async def get_player_profile(player_id: str, user=Depends(require_approved), db=Depends(get_db)):
    """La ficha de un jugador que ve todo el club: su personaje, sus títulos (semana, mes, MVP) y cómo va en el ranking."""
    player = await db.players.find_one({"id": player_id})
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    user_id = player.get("user_id")
    pictures = await pictures_by_user(db, [user_id])
    characters = await characters_by_user(db, [user_id])
    heights = await heights_by_user(db, [user_id])
    crowns = await crowns_by_user(db, [user_id])
    honors = await db.honors.find({"player_id": player_id}).to_list(300)
    honors.sort(key=lambda honor: honor.get("created_at") or datetime.min, reverse=True)
    titles = [
        {"title": honor["title"], "kind": honor["kind"], "place": honor["place"], "period": honor["period"], "current": bool(honor.get("current"))}
        for honor in honors
    ]
    counts = {
        "week_wins": sum(1 for honor in honors if honor["kind"] == "week" and honor["place"] == 1),
        "week_podiums": sum(1 for honor in honors if honor["kind"] == "week"),
        "month_wins": sum(1 for honor in honors if honor["kind"] == "month" and honor["place"] == 1),
        "mvp": sum(1 for honor in honors if honor["kind"] == "mvp"),
    }
    ranking = None
    group_id = next((group for group, data in GROUPS.items() if player["team_id"] in data["teams"]), None)
    if group_id and _can_view(user, group_id):
        board = await get_ranking(group_id=group_id, user=user, db=db)
        entry = next((item for item in board["entries"] if item["player_id"] == player_id), None)
        if entry:
            ranking = {
                "group_id": group_id,
                "group_name": GROUPS[group_id]["name"],
                "rank": entry["rank"],
                "of": len(board["entries"]),
                "overall": entry["overall"],
                "week_overall": entry["week_overall"],
                "movement": entry["movement"],
                "week": board["week"],
            }
    return {
        "player": {
            "id": player["id"],
            "team_id": player["team_id"],
            "name": player["name"],
            "position": player["position"],
            "number": player.get("number"),
            "picture": pictures.get(user_id, ""),
            "character": characters.get(user_id),
            "height_cm": heights.get(user_id),
            "crown": crowns.get(user_id),
            "linked": bool(user_id),
        },
        "titles": titles,
        "counts": counts,
        "ranking": ranking,
    }
