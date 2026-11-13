"""Partido en directo: marcador punto a punto y aciertos y fallos de cada jugador, mientras se juega.

Solo se guardan las acciones; el marcador, los sets, quién saca y las estadísticas se calculan a partir de ellas.
Así deshacer es quitar la última acción y nunca se descuadra nada.
"""

from datetime import datetime, timezone
from typing import Annotated, Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from pymongo import ASCENDING, DESCENDING

from attendance import answer_lists
from database import get_db
from honors import give_coins, give_honor
from matches import _today, can_manage_matches
from notifications import send_notifications, team_member_ids
from players import require_approved
from teams import TEAMS, TeamId, match_teams

MAX_EVENTS = 1500
MVP_COINS = 15
# Ganar el partido: para cada jugador de la plantilla con cuenta.
WIN_COINS = 50
MAX_LINEUP = 20
TIMEOUTS_PER_SET = 2
RECENT_FINISHED = 10
TEAM_NAMES = {team["id"]: team["name"] for team in TEAMS}

Side = Literal["us", "them"]
Skill = Literal["saque", "recepcion", "colocacion", "ataque", "bloqueo", "defensa"]
Opponent = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]

router = APIRouter(prefix="/api/live")
_indexes_ready = False


class LiveCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: TeamId
    opponent: Opponent
    match_id: Optional[str] = Field(default=None, max_length=64)
    best_of: Literal[3, 5] = 5
    first_serve: Side = "us"
    lineup: Annotated[list[Annotated[str, StringConstraints(min_length=1, max_length=64)]], Field(min_length=1, max_length=MAX_LINEUP)]


class LiveOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Quién va en cada sitio: los 12 primeros en la pista y el resto en el banquillo.
    order: Annotated[list[Annotated[str, StringConstraints(max_length=64)]], Field(max_length=200)]


class LiveFinish(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # El MVP que elige el entrenador al terminar (o ninguno).
    mvp_player_id: Optional[str] = Field(default=None, max_length=64)


class LiveEvent(BaseModel):
    """Un punto, un acierto o fallo (de un jugador o del equipo) o un tiempo muerto."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["point", "stat", "timeout"]
    side: Optional[Side] = None
    player_id: Optional[str] = Field(default=None, max_length=64)
    result: Optional[Literal["good", "bad"]] = None
    skill: Optional[Skill] = None
    # Un acierto o fallo que además acaba el punto: para quién es.
    point: Optional[Side] = None

    @model_validator(mode="after")
    def check_shape(self):
        if self.type in ("point", "timeout") and (self.side is None or self.result or self.skill or self.player_id or self.point):
            raise ValueError("Indica solo de qué lado es")
        if self.type == "stat" and (self.result is None or self.side is not None):
            raise ValueError("Indica si es acierto o fallo")
        return self


async def _ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.live_matches.create_index([("id", ASCENDING)], unique=True)
    await db.live_matches.create_index([("team_id", ASCENDING), ("created_at", DESCENDING)])
    _indexes_ready = True


def _other(side):
    return "them" if side == "us" else "us"


def scoreboard(live):
    """El estado del partido a partir de sus acciones."""
    need = live["best_of"] // 2 + 1
    sets, current, won = [], {"us": 0, "them": 0}, {"us": 0, "them": 0}
    serving = live.get("first_serve", "us")
    timeouts = {"us": 0, "them": 0}
    finished = False
    stats = {}
    team = {"good": 0, "bad": 0}
    for event in live.get("events", []):
        scored = event.get("side") if event["type"] == "point" else event.get("point") if event["type"] == "stat" else None
        if event["type"] == "stat":
            target = stats.setdefault(event["player_id"], {"good": 0, "bad": 0, "points": 0, "errors": 0}) if event.get("player_id") else team
            target[event["result"]] += 1
            if event.get("player_id"):
                if event.get("point") == "us" and event["result"] == "good":
                    target["points"] += 1
                if event.get("point") == "them" and event["result"] == "bad":
                    target["errors"] += 1
        elif event["type"] == "timeout":
            timeouts[event["side"]] += 1
        if scored and not finished:
            current[scored] += 1
            serving = scored
            # El set decisivo es a 15; los demás a 25. Siempre con dos de ventaja.
            target_points = 15 if len(sets) == live["best_of"] - 1 else 25
            if current[scored] >= target_points and current[scored] - current[_other(scored)] >= 2:
                sets.append(dict(current))
                won[scored] += 1
                current = {"us": 0, "them": 0}
                timeouts = {"us": 0, "them": 0}
                finished = won[scored] == need
    return {
        "sets": sets,
        "current": current,
        "won": won,
        "set_number": len(sets) + (0 if finished else 1),
        "serving": serving,
        "timeouts": timeouts,
        "finished": finished,
        "winner": ("us" if won["us"] > won["them"] else "them") if finished else None,
        "stats": stats,
        "team_stats": team,
    }


SKILLS = ["saque", "recepcion", "colocacion", "ataque", "bloqueo", "defensa"]


def match_report(live, lineup):
    """Todo lo que ha pasado en el partido, ordenado para leerlo (y debatirlo) al terminar."""
    names = {item["player_id"]: item for item in lineup}
    players = {}
    skills = {skill: {"good": 0, "bad": 0, "players": {}} for skill in SKILLS}
    team = {"good": 0, "bad": 0}
    # Cómo llegó cada punto: nuestros (por acierto nuestro o fallo suyo) y suyos (por fallo nuestro o acierto suyo).
    origin = {"us_by_us": 0, "us_by_them": 0, "them_by_us": 0, "them_by_them": 0}
    timeouts = {"us": 0, "them": 0}
    sets, current, finished = [], {"us": 0, "them": 0}, False
    set_detail = [{"us_by_us": 0, "us_by_them": 0, "them_by_us": 0, "them_by_them": 0, "good": 0, "bad": 0}]
    runs = {"us": 0, "them": 0}
    run_side, run_length = None, 0
    lead = {"us": 0, "them": 0}
    for event in live.get("events", []):
        detail = set_detail[-1]
        if event["type"] == "stat":
            result = event["result"]
            detail[result] += 1
            player_id = event.get("player_id")
            skill = event.get("skill")
            if player_id:
                row = players.setdefault(player_id, {"good": 0, "bad": 0, "points": 0, "errors": 0, "skills": {}})
                row[result] += 1
                if event.get("point") == "us" and result == "good":
                    row["points"] += 1
                if event.get("point") == "them" and result == "bad":
                    row["errors"] += 1
                if skill:
                    per = row["skills"].setdefault(skill, {"good": 0, "bad": 0})
                    per[result] += 1
            else:
                team[result] += 1
            if skill:
                skills[skill][result] += 1
                if player_id:
                    per = skills[skill]["players"].setdefault(player_id, {"good": 0, "bad": 0})
                    per[result] += 1
        elif event["type"] == "timeout":
            timeouts[event["side"]] += 1
        scored = event.get("side") if event["type"] == "point" else event.get("point") if event["type"] == "stat" else None
        if not scored or finished:
            continue
        if event["type"] == "stat":
            key = f"{scored}_by_us"
        else:
            # Un punto sin acción apuntada: si es nuestro, lo ha fallado el rival; si es suyo, lo ha acertado él.
            key = f"{scored}_by_them"
        origin[key] += 1
        detail[key] += 1
        current[scored] += 1
        run_length = run_length + 1 if run_side == scored else 1
        run_side = scored
        runs[scored] = max(runs[scored], run_length)
        lead[scored] = max(lead[scored], current[scored] - current[_other(scored)])
        target_points = 15 if len(sets) == live["best_of"] - 1 else 25
        if current[scored] >= target_points and current[scored] - current[_other(scored)] >= 2:
            sets.append(dict(current))
            current = {"us": 0, "them": 0}
            run_side, run_length = None, 0
            finished = sum(1 for item in sets if item[scored] > item[_other(scored)]) == live["best_of"] // 2 + 1
            if not finished:
                set_detail.append({"us_by_us": 0, "us_by_them": 0, "them_by_us": 0, "them_by_them": 0, "good": 0, "bad": 0})
    if current["us"] or current["them"]:
        sets.append(dict(current))

    def person(player_id):
        item = names.get(player_id, {})
        return {"player_id": player_id, "name": item.get("name", "Jugador"), "number": item.get("number"), "position": item.get("position")}

    def ratio(good, bad):
        return round(good * 100 / (good + bad)) if good + bad else None

    player_rows = []
    for player_id, row in players.items():
        player_rows.append({
            **person(player_id),
            "good": row["good"],
            "bad": row["bad"],
            "points": row["points"],
            "errors": row["errors"],
            "balance": row["good"] - row["bad"],
            "percent": ratio(row["good"], row["bad"]),
            "skills": [{"skill": skill, **row["skills"][skill], "percent": ratio(**row["skills"][skill])} for skill in SKILLS if skill in row["skills"]],
        })
    player_rows.sort(key=lambda row: (-row["balance"], -row["good"], row["name"]))
    # Los que jugaron sin nada apuntado también salen, al final.
    for item in lineup:
        if item["player_id"] not in players:
            player_rows.append({**person(item["player_id"]), "good": 0, "bad": 0, "points": 0, "errors": 0, "balance": 0, "percent": None, "skills": []})

    skill_rows = []
    for skill in SKILLS:
        data = skills[skill]
        if not data["good"] and not data["bad"]:
            continue
        by_player = data["players"]
        best = max(by_player.items(), key=lambda item: (item[1]["good"], -item[1]["bad"]), default=None)
        worst = max(by_player.items(), key=lambda item: (item[1]["bad"], -item[1]["good"]), default=None)
        skill_rows.append({
            "skill": skill,
            "good": data["good"],
            "bad": data["bad"],
            "percent": ratio(data["good"], data["bad"]),
            "best": {**person(best[0]), "count": best[1]["good"]} if best and best[1]["good"] else None,
            "worst": {**person(worst[0]), "count": worst[1]["bad"]} if worst and worst[1]["bad"] else None,
        })
    return {
        "sets": [{**item, **set_detail[index]} if index < len(set_detail) else item for index, item in enumerate(sets)],
        "origin": origin,
        "team": team,
        "timeouts": timeouts,
        "runs": runs,
        "max_lead": lead,
        "players": player_rows,
        "skills": skill_rows,
        "total": {"good": sum(row["good"] for row in player_rows) + team["good"], "bad": sum(row["bad"] for row in player_rows) + team["bad"]},
    }


def status_of(live):
    """"pending" (sin empezar), "live" o "finished". Los que se abrieron antes de existir el botón de empezar
    y no tienen nada apuntado cuentan como sin empezar: entrar al partido ya no lo empieza."""
    if live["status"] == "live" and not live.get("started_at") and not live.get("events"):
        return "pending"
    return live["status"]


def _can_watch(user):
    return user.get("status") == "approved"


def _can_score(user, live):
    return can_manage_matches(user)


async def _lineup(db, live):
    """Quién juega. En un partido de la agenda, los que han dicho "Voy" (se actualiza solo); los que ya
    tienen acciones apuntadas siguen aunque luego cambien de idea."""
    if not live.get("match_id"):
        return _ordered(live["lineup"], live)
    answers = await db.match_answers.find({"match_id": live["match_id"], "status": "going"}).to_list(200)
    lists = await answer_lists(db, match_teams(live["team_id"]), {answer["user_id"]: "going" for answer in answers})
    lineup = [
        {"player_id": person["id"], "name": person["name"], "number": person.get("number"), "position": person.get("position"), "picture": person.get("picture", "")}
        for person in lists["going"]
    ]
    shown = {item["player_id"] for item in lineup}
    lineup += [item for item in live.get("lineup", []) if item["player_id"] not in shown]
    return _ordered(lineup, live)


def _ordered(lineup, live):
    """Los sitios que ha colocado el entrenador arrastrando; los que no ha colocado van detrás, como venían."""
    order = {player_id: index for index, player_id in enumerate(live.get("order") or [])}
    return sorted(lineup, key=lambda item: order.get(item["player_id"], len(order)))


async def _public(db, live, user):
    board = scoreboard(live)
    lineup = await _lineup(db, live)
    return {
        "id": live["id"],
        "team_id": live["team_id"],
        "team_name": TEAM_NAMES.get(live["team_id"], ""),
        "opponent": live["opponent"],
        "match_id": live.get("match_id"),
        "best_of": live["best_of"],
        "status": status_of(live),
        "lineup": lineup,
        "events": live.get("events", [])[-12:],
        "event_count": len(live.get("events", [])),
        "created_at": live["created_at"],
        "can_score": _can_score(user, live) and status_of(live) == "live",
        "can_start": _can_score(user, live) and status_of(live) == "pending",
        "mvp": live.get("mvp"),
        # Al terminar: el informe completo del partido.
        "report": match_report(live, lineup) if status_of(live) == "finished" else None,
        **board,
    }


def _summary(live):
    board = scoreboard(live)
    return {
        "id": live["id"],
        "team_id": live["team_id"],
        "team_name": TEAM_NAMES.get(live["team_id"], ""),
        "opponent": live["opponent"],
        "status": status_of(live),
        "won": board["won"],
        "current": board["current"],
        "sets": board["sets"],
        "created_at": live["created_at"],
    }


async def _find(db, live_id):
    live = await db.live_matches.find_one({"id": live_id})
    if not live:
        raise HTTPException(status_code=404, detail="Ese partido ya no existe")
    return live


def _require_scorer(user, live):
    if not can_manage_matches(user):
        raise HTTPException(status_code=403, detail="Solo entrenadores, administradores y editores llevan el marcador")
    if status_of(live) == "pending":
        raise HTTPException(status_code=409, detail="El partido aún no ha empezado: dale a «Empezar partido»")
    if live["status"] != "live":
        raise HTTPException(status_code=409, detail="Este partido ya ha terminado")


@router.get("")
async def list_live(team_id: Optional[TeamId] = Query(default=None), user=Depends(require_approved), db=Depends(get_db)):
    """Los partidos en directo ahora y los últimos terminados (de un equipo, o de todo el club)."""
    query = {"team_id": {"$in": list(match_teams(team_id))}} if team_id else {}
    found = await db.live_matches.find(query).sort("created_at", DESCENDING).to_list(60)
    live = [_summary(item) for item in found if status_of(item) == "live"]
    finished = [_summary(item) for item in found if status_of(item) == "finished"][:RECENT_FINISHED]
    return {"live": live, "finished": finished, "can_create": can_manage_matches(user)}


@router.post("", status_code=201)
async def start_live(body: LiveCreate, user=Depends(require_approved), db=Depends(get_db)):
    if not can_manage_matches(user):
        raise HTTPException(status_code=403, detail="Solo entrenadores, administradores y editores llevan el marcador")
    await _ensure_indexes(db)
    teams = list(match_teams(body.team_id))
    players = await db.players.find({"id": {"$in": body.lineup}, "team_id": {"$in": teams}}).to_list(MAX_LINEUP)
    by_id = {player["id"]: player for player in players}
    if len(by_id) != len(set(body.lineup)):
        raise HTTPException(status_code=422, detail="Algún jugador no es de este equipo")
    if body.match_id and not await db.matches.find_one({"id": body.match_id, "team_id": {"$in": teams}}):
        raise HTTPException(status_code=422, detail="Ese partido no es de este equipo")
    lineup = [
        {
            "player_id": player_id,
            "name": by_id[player_id]["name"],
            "number": by_id[player_id].get("number"),
            "position": by_id[player_id].get("position"),
        }
        for player_id in dict.fromkeys(body.lineup)
    ]
    now = datetime.now(timezone.utc)
    live = {
        "id": str(uuid4()),
        "team_id": body.team_id,
        "opponent": body.opponent,
        "match_id": body.match_id,
        "best_of": body.best_of,
        "first_serve": body.first_serve,
        "lineup": lineup,
        "events": [],
        "status": "live",
        "started_at": now,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.live_matches.insert_one(live)
    await send_notifications(
        db,
        await team_member_ids(db, teams, user["id"]),
        "matches",
        {
            "title": "¡Partido en directo!",
            "body": f"{TEAM_NAMES.get(body.team_id, 'Club')} contra {body.opponent}: sigue el marcador punto a punto",
            "url": f"/app/directo/{live['id']}",
            "tag": f"directo-{live['id']}",
        },
    )
    return await _public(db, live, user)


@router.post("/match/{match_id}")
async def enter_match(match_id: str, user=Depends(require_approved), db=Depends(get_db)):
    """"Entrar al partido": abre el marcador en directo de ese partido (o lo crea si aún no existe)."""
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Ese partido ya no existe")
    existing = await db.live_matches.find_one({"match_id": match_id})
    if existing:
        return await _public(db, existing, user)
    if not can_manage_matches(user):
        raise HTTPException(status_code=403, detail="Solo entrenadores, administradores y editores llevan el marcador")
    if match["date"] != _today().isoformat():
        raise HTTPException(status_code=422, detail="El marcador en directo se abre el día del partido")
    await _ensure_indexes(db)
    now = datetime.now(timezone.utc)
    live = {
        "id": str(uuid4()),
        "team_id": match["team_id"],
        "opponent": match["opponent"],
        "match_id": match_id,
        # Las Escuelas juegan a dos sets ganados; el resto, a tres.
        "best_of": 3 if match["team_id"].startswith("escuela") else 5,
        "first_serve": "us",
        "lineup": [],
        "events": [],
        # Se abre sin empezar: el marcador arranca cuando se pulsa «Empezar partido».
        "status": "pending",
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.live_matches.insert_one(live)
    return await _public(db, live, user)


@router.post("/{live_id}/start")
async def start_match(live_id: str, user=Depends(require_approved), db=Depends(get_db)):
    """«Empezar partido»: arranca el marcador y avisa al equipo de que está en directo."""
    live = await _find(db, live_id)
    if not _can_score(user, live):
        raise HTTPException(status_code=403, detail="Solo entrenadores, administradores y editores llevan el marcador")
    if status_of(live) != "pending":
        return await _public(db, live, user)
    now = datetime.now(timezone.utc)
    await db.live_matches.update_one({"id": live_id}, {"$set": {"status": "live", "started_at": now, "updated_at": now}})
    await send_notifications(
        db,
        await team_member_ids(db, list(match_teams(live["team_id"])), user["id"]),
        "matches",
        {
            "title": "🏐 ¡Empieza el partido!",
            "body": f"{TEAM_NAMES.get(live['team_id'], 'Club')} contra {live['opponent']}. ¡Entra y síguelo en directo, punto a punto!",
            "url": f"/app/directo/{live_id}",
            "tag": f"directo-{live_id}",
        },
    )
    return await _public(db, await _find(db, live_id), user)


@router.get("/{live_id}")
async def get_live(live_id: str, user=Depends(require_approved), db=Depends(get_db)):
    live = await _find(db, live_id)
    return await _public(db, live, user)


@router.post("/{live_id}/events")
async def add_event(live_id: str, body: LiveEvent, user=Depends(require_approved), db=Depends(get_db)):
    live = await _find(db, live_id)
    _require_scorer(user, live)
    board = scoreboard(live)
    scores = body.type == "point" or body.point is not None
    if scores and board["finished"]:
        raise HTTPException(status_code=409, detail="El partido ya está decidido: termínalo para guardar el resultado")
    lineup = await _lineup(db, live)
    player = next((item for item in lineup if item["player_id"] == body.player_id), None) if body.player_id else None
    if body.player_id and not player:
        raise HTTPException(status_code=422, detail="Ese jugador no está en la plantilla del partido")
    if body.type == "timeout" and board["timeouts"][body.side] >= TIMEOUTS_PER_SET:
        raise HTTPException(status_code=422, detail="Ya se han pedido los dos tiempos de este set")
    if len(live.get("events", [])) >= MAX_EVENTS:
        raise HTTPException(status_code=422, detail="Este partido ya tiene demasiadas acciones")
    event = {**body.model_dump(exclude_none=True), "id": str(uuid4()), "at": datetime.now(timezone.utc), "by": user["id"]}
    await db.live_matches.update_one({"id": live_id}, {"$push": {"events": event}, "$set": {"updated_at": event["at"]}})
    # Quien ya tiene acciones se queda en la plantilla aunque luego diga que no va.
    if player and live.get("match_id") and not any(item["player_id"] == player["player_id"] for item in live.get("lineup", [])):
        await db.live_matches.update_one({"id": live_id}, {"$push": {"lineup": player}})
    return await _public(db, await _find(db, live_id), user)


@router.delete("/{live_id}/events/last")
async def undo_event(live_id: str, user=Depends(require_approved), db=Depends(get_db)):
    live = await _find(db, live_id)
    _require_scorer(user, live)
    if not live.get("events"):
        raise HTTPException(status_code=422, detail="No hay nada que deshacer")
    await db.live_matches.update_one({"id": live_id}, {"$pop": {"events": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}})
    return await _public(db, await _find(db, live_id), user)


@router.post("/{live_id}/reset")
async def reset_match(live_id: str, user=Depends(require_approved), db=Depends(get_db)):
    """«Reiniciar partido»: borra todo lo apuntado y vuelve a quedar sin empezar (para probar o si se empezó sin querer).
    Los titulares que se han colocado se quedan."""
    live = await _find(db, live_id)
    if not _can_score(user, live):
        raise HTTPException(status_code=403, detail="Solo entrenadores, administradores y editores llevan el marcador")
    if status_of(live) == "finished":
        raise HTTPException(status_code=409, detail="Este partido ya ha terminado")
    await db.live_matches.update_one(
        {"id": live_id},
        {"$set": {"status": "pending", "events": [], "updated_at": datetime.now(timezone.utc)}, "$unset": {"started_at": ""}},
    )
    return await _public(db, await _find(db, live_id), user)


@router.put("/{live_id}/order")
async def set_order(live_id: str, body: LiveOrder, user=Depends(require_approved), db=Depends(get_db)):
    """Cambiar a los jugadores de sitio (arrastrando uno encima de otro, o del banquillo a la pista)."""
    live = await _find(db, live_id)
    if not _can_score(user, live):
        raise HTTPException(status_code=403, detail="Solo entrenadores, administradores y editores colocan a los jugadores")
    if status_of(live) == "finished":
        raise HTTPException(status_code=409, detail="Este partido ya ha terminado")
    await db.live_matches.update_one({"id": live_id}, {"$set": {"order": list(dict.fromkeys(body.order)), "updated_at": datetime.now(timezone.utc)}})
    return await _public(db, await _find(db, live_id), user)


@router.post("/{live_id}/finish")
async def finish_live(live_id: str, body: Optional[LiveFinish] = None, user=Depends(require_approved), db=Depends(get_db)):
    """Da el partido por terminado. Si estaba enlazado a un partido de la agenda, se le guarda el resultado.
    Si el entrenador elige MVP, gana sus coins y queda en sus premios."""
    live = await _find(db, live_id)
    _require_scorer(user, live)
    board = scoreboard(live)
    mvp = None
    if body and body.mvp_player_id:
        lineup = await _lineup(db, live)
        chosen = next((item for item in lineup if item["player_id"] == body.mvp_player_id), None)
        if not chosen:
            raise HTTPException(status_code=422, detail="El MVP tiene que ser de la plantilla del partido")
        mvp = {"player_id": chosen["player_id"], "name": chosen["name"]}
    changes = {"status": "finished", "updated_at": datetime.now(timezone.utc)}
    if mvp:
        changes["mvp"] = mvp
    await db.live_matches.update_one({"id": live_id}, {"$set": changes})
    match_changes = {}
    if live.get("match_id") and board["sets"]:
        match_changes["sets"] = board["sets"]
    if live.get("match_id") and mvp:
        match_changes["mvp"] = mvp["name"]
    if match_changes:
        await db.matches.update_one({"id": live["match_id"]}, {"$set": match_changes})
    if mvp:
        await _reward_mvp(db, live, mvp)
    if board["winner"] == "us":
        await _reward_win(db, live)
    return await _public(db, await _find(db, live_id), user)


async def _reward_win(db, live):
    """Victoria: cada jugador de la plantilla gana sus coins (una sola vez por partido, aunque se termine dos veces)."""
    lineup = await _lineup(db, live)
    if live.get("match_id"):
        user_ids = [item["player_id"] for item in lineup]
    else:
        players = await db.players.find({"id": {"$in": [item["player_id"] for item in lineup]}}).to_list(200)
        user_ids = [player["user_id"] for player in players if player.get("user_id")]
    label = f"Victoria contra {live['opponent']}"[:80]
    rewarded = []
    for user_id in dict.fromkeys(user_ids):
        if await give_coins(db, user_id, WIN_COINS, "win", label, f"win:{live['id']}:{user_id}"):
            rewarded.append(user_id)
    if rewarded:
        await send_notifications(
            db,
            rewarded,
            "matches",
            {"title": f"¡{label}!", "body": f"Habéis ganado: +{WIN_COINS} Club Coins para cada uno", "url": "/app/perfil", "tag": f"win-{live['id']}"},
        )


async def _reward_mvp(db, live, mvp):
    # En un partido de la agenda la plantilla son cuentas; si no, fichas de jugador (con o sin cuenta).
    if live.get("match_id"):
        user_id = mvp["player_id"]
    else:
        player = await db.players.find_one({"id": mvp["player_id"]})
        user_id = player.get("user_id") if player else None
    title = f"MVP contra {live['opponent']}"[:80]
    given = await give_honor(
        db,
        group_id=live["team_id"],
        kind="mvp",
        period=live["id"],
        player_id=mvp["player_id"],
        user_id=user_id,
        place=1,
        title=title,
        coins=MVP_COINS,
        current=False,
    )
    if given and user_id:
        await send_notifications(
            db,
            [user_id],
            "matches",
            {"title": f"¡{title}!", "body": f"Has ganado {MVP_COINS} Club Coins", "url": "/app/perfil", "tag": f"mvp-{live['id']}"},
        )


@router.delete("/{live_id}", status_code=204)
async def delete_live(live_id: str, user=Depends(require_approved), db=Depends(get_db)):
    await _find(db, live_id)
    if not can_manage_matches(user):
        raise HTTPException(status_code=403, detail="Solo entrenadores, administradores y editores borran partidos")
    await db.live_matches.delete_one({"id": live_id})
