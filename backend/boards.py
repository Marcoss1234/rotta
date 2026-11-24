from datetime import datetime, timezone
from typing import Annotated, Literal, Optional, Union
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_serializer, model_validator
from pymongo import ASCENDING

from database import get_db
from players import Position, require_approved
from teams import TeamId

MAX_STEPS = 30
MAX_ELEMENTS = 150
MAX_STROKE_POINTS = 400
MAX_BOARD_POINTS = 20000
MAX_BOARDS_LISTED = 200
MAX_RECORDING_MS = 125000
MAX_TRACKS = 60
MAX_TRACK_POINTS = 3000
MAX_RECORDING_POINTS = 20000

Kind = Literal["saque", "recepcion", "ataque", "defensa", "rotacion", "otro"]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
ElementId = Annotated[str, StringConstraints(min_length=1, max_length=40)]
# Todo se guarda de 0 a 1 sobre la pista entera, así se ve igual en cualquier pantalla.
Coord = Annotated[float, Field(ge=0, le=1)]

router = APIRouter(prefix="/api/boards")
_indexes_ready = False


class _Element(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: ElementId


class Token(_Element):
    type: Literal["token"]
    x: Coord
    y: Coord
    # "coach": un entrenador en la pista (lanza frees y balones fuertes en los ejercicios).
    side: Literal["home", "rival", "coach"]
    player_id: Optional[Annotated[str, StringConstraints(max_length=64)]] = None
    label: Annotated[str, StringConstraints(max_length=3)] = ""
    name: Annotated[str, StringConstraints(max_length=20)] = ""
    # Solo para esta jugada. Sin valor, se usa la posición de su ficha.
    position: Optional[Position] = None
    # Marcado con doble toque: quien ataca en esta jugada.
    highlight: bool = False
    # La fila en la que está (ejercicios en fila): vuelve al final tras su último toque.
    line: Optional[Annotated[str, StringConstraints(max_length=12)]] = None
    # Cuándo se cambia: con cualquier toque (vuelve al final) o solo al rematar (se cambia por el último).
    line_rule: Optional[Literal["toque", "remate"]] = None


class Ball(_Element):
    type: Literal["ball"]
    x: Coord
    y: Coord


class Arrow(_Element):
    type: Literal["arrow"]
    x1: Coord
    y1: Coord
    x2: Coord
    y2: Coord
    style: Literal["move", "pass"]


class Zone(_Element):
    type: Literal["zone"]
    x: Coord
    y: Coord
    w: Coord
    h: Coord


class Text(_Element):
    type: Literal["text"]
    x: Coord
    y: Coord
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class Prop(_Element):
    # Material de entreno: conos y cajones (al cajón se sube un entrenador o un jugador).
    type: Literal["prop"]
    kind: Literal["cone", "box"]
    x: Coord
    y: Coord


class Stroke(_Element):
    type: Literal["stroke"]
    points: Annotated[list[tuple[Coord, Coord]], Field(min_length=2, max_length=MAX_STROKE_POINTS)]


Element = Annotated[Union[Token, Ball, Arrow, Zone, Text, Stroke, Prop], Field(discriminator="type")]


class Step(BaseModel):
    model_config = ConfigDict(extra="forbid")

    elements: Annotated[list[Element], Field(max_length=MAX_ELEMENTS)]


class Track(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: ElementId
    # Cada punto es [milisegundo, x, y].
    points: Annotated[list[tuple[Annotated[int, Field(ge=0, le=MAX_RECORDING_MS)], Coord, Coord]], Field(min_length=1, max_length=MAX_TRACK_POINTS)]

    @model_validator(mode="after")
    def check_order(self):
        times = [point[0] for point in self.points]
        if times != sorted(times):
            raise ValueError("La grabación está desordenada")
        return self


MAX_ACTIONS = 200
# "free" y "fuerte" son de los entrenadores: un balón fácil y uno fuerte para defender.
ActionKind = Literal["saque", "recepcion", "colocacion", "remate", "bloqueo", "defensa", "free", "fuerte"]
# Tiempo de la colocación: 3 (alta), 2, 1 (rápida) y "menos" (la más rápida, directa a la mano del atacante).
SetTempo = Literal["3", "2", "1", "menos"]


class PlayerAction(BaseModel):
    """Lo que hace un jugador en un momento de la jugada: sacar, recibir, rematar…"""

    model_config = ConfigDict(extra="forbid")

    id: ElementId
    t: Annotated[int, Field(ge=0, le=MAX_RECORDING_MS)]
    action: ActionKind
    tempo: Optional[SetTempo] = None

    @model_validator(mode="after")
    def tempo_only_for_sets(self):
        if self.tempo is not None and self.action != "colocacion":
            raise ValueError("El tiempo solo vale para la colocación")
        return self

    @model_serializer(mode="wrap")
    def skip_empty_tempo(self, handler):
        data = handler(self)
        if data.get("tempo") is None:
            data.pop("tempo", None)
        return data


class Spot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: Coord
    y: Coord


class PlanMove(BaseModel):
    model_config = ConfigDict(extra="forbid")

    playerId: ElementId
    target: Spot


MAX_PLAN_STEPS = 60


class PlanStep(BaseModel):
    """Un paso de la jugada por pasos. Se guardan para poder seguir añadiendo pasos más tarde."""

    model_config = ConfigDict(extra="forbid")

    playerId: ElementId
    action: ActionKind
    tempo: Optional[SetTempo] = None
    # Sin destino: la jugada termina en este jugador.
    target: Optional[Spot] = None
    moves: Annotated[list[PlanMove], Field(max_length=MAX_TRACKS)] = []
    # Ejercicio en fila: al jugar, vuelve al final de su fila y los demás avanzan.
    back: bool = False
    # Balón nuevo: no juega el que venía, sino otro que saca este jugador (un entrenador lanzando, etc.).
    fresh: bool = False


class Recording(BaseModel):
    model_config = ConfigDict(extra="forbid")

    duration_ms: Annotated[int, Field(ge=1, le=MAX_RECORDING_MS)]
    tracks: Annotated[list[Track], Field(max_length=MAX_TRACKS)]
    actions: Annotated[list[PlayerAction], Field(max_length=MAX_ACTIONS)] = []
    # Solo en las jugadas hechas por pasos.
    plan: Optional[Annotated[list[PlanStep], Field(max_length=MAX_PLAN_STEPS)]] = None

    @model_validator(mode="after")
    def check_size(self):
        # Una grabación tiene que tener algo: movimientos, acciones o las dos cosas.
        if not self.tracks and not self.actions:
            raise ValueError("La grabación está vacía")
        if sum(len(track.points) for track in self.tracks) > MAX_RECORDING_POINTS:
            raise ValueError("Esta grabación es demasiado larga")
        return self


class BoardContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    kind: Kind = "otro"
    court: Literal["full", "half"] = "full"
    published: bool = False
    steps: Annotated[list[Step], Field(min_length=1, max_length=MAX_STEPS)]
    recording: Optional[Recording] = None

    @model_validator(mode="after")
    def check_size(self):
        points = sum(
            len(element.points) for step in self.steps for element in step.elements if isinstance(element, Stroke)
        )
        if points > MAX_BOARD_POINTS:
            raise ValueError("Esta jugada tiene demasiado dibujo")
        return self


class BoardCreate(BoardContent):
    team_id: TeamId


def _own_teams(user):
    teams = {user.get("team_id")}
    if user.get("role") == "entrenador":
        teams.update(user.get("coached_team_ids", []))
    return teams


def _can_edit(user, team_id):
    """Las jugadas del equipo: las crean y publican sus entrenadores (y los administradores)."""
    return user.get("role") == "admin" or (user.get("role") == "entrenador" and team_id in _own_teams(user))


# Los jugadores también pueden hacerse sus propias jugadas para jugar con la pizarra: solo las ven
# ellos y nunca se publican al equipo.
MAX_PRIVATE_BOARDS = 40


def _is_private(board):
    return bool(board.get("private"))


def _can_edit_board(user, board):
    if _is_private(board):
        return board.get("created_by") == user["id"]
    return _can_edit(user, board["team_id"])


def _can_view(user, team_id):
    if user.get("role") == "admin":
        return True
    return user.get("role") != "familia" and team_id in _own_teams(user)


def _sees(user, board):
    if _is_private(board):
        return board.get("created_by") == user["id"]
    return _can_edit(user, board["team_id"]) or (board["published"] and _can_view(user, board["team_id"]))


def _public(board, user):
    return {
        "id": board["id"],
        "team_id": board["team_id"],
        "name": board["name"],
        "kind": board["kind"],
        "court": board["court"],
        "published": board["published"],
        "steps": board["steps"],
        "recording": board.get("recording"),
        "updated_at": board["updated_at"].isoformat(),
        "can_edit": _can_edit_board(user, board),
        "private": _is_private(board),
    }


async def _ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.boards.create_index("id", unique=True)
    await db.boards.create_index([("team_id", ASCENDING), ("updated_at", ASCENDING)])
    _indexes_ready = True


async def _find_visible(db, board_id, user):
    # A quien no puede verla se le responde igual que si no existiera.
    board = await db.boards.find_one({"id": board_id})
    if not board or not _sees(user, board):
        raise HTTPException(status_code=404, detail="Esa jugada ya no existe")
    return board


def _require_edit(user, team_id):
    if not _can_edit(user, team_id):
        raise HTTPException(status_code=403, detail="Solo los entrenadores de este equipo editan la pizarra")


def _require_edit_board(user, board):
    if not _can_edit_board(user, board):
        raise HTTPException(status_code=403, detail="Solo los entrenadores de este equipo editan la pizarra")


@router.get("")
async def list_boards(team_id: Annotated[TeamId, Query()], user=Depends(require_approved), db=Depends(get_db)):
    if not _can_view(user, team_id):
        raise HTTPException(status_code=403, detail="Esta pizarra es de otro equipo")
    can_edit = _can_edit(user, team_id)
    team_boards = {"team_id": team_id, "private": {"$ne": True}}
    if not can_edit:
        team_boards["published"] = True
    # Además de las del equipo, las suyas propias (las privadas de los demás no las ve nadie).
    mine = {"team_id": team_id, "private": True, "created_by": user["id"]}
    boards = await db.boards.find({"$or": [team_boards, mine]}).to_list(MAX_BOARDS_LISTED)
    boards.sort(key=lambda board: board["updated_at"], reverse=True)
    return {"can_edit": can_edit, "can_create": True, "boards": [_public(board, user) for board in boards]}


@router.get("/{board_id}")
async def get_board(board_id: str, user=Depends(require_approved), db=Depends(get_db)):
    return _public(await _find_visible(db, board_id, user), user)


@router.post("", status_code=201)
async def create_board(body: BoardCreate, user=Depends(require_approved), db=Depends(get_db)):
    private = not _can_edit(user, body.team_id)
    if private:
        # Un jugador del equipo se hace una jugada suya: solo para él y sin publicar.
        if not _can_view(user, body.team_id):
            raise HTTPException(status_code=403, detail="Esta pizarra es de otro equipo")
        if await db.boards.count_documents({"private": True, "created_by": user["id"]}) >= MAX_PRIVATE_BOARDS:
            raise HTTPException(status_code=422, detail=f"Ya tienes {MAX_PRIVATE_BOARDS} jugadas: borra alguna antes")
    await _ensure_indexes(db)
    now = datetime.now(timezone.utc)
    board = {**body.model_dump(), "id": str(uuid4()), "created_by": user["id"], "updated_by": user["id"], "created_at": now, "updated_at": now}
    if private:
        board.update({"private": True, "published": False})
    await db.boards.insert_one(board)
    return _public(board, user)


@router.put("/{board_id}")
async def update_board(board_id: str, body: BoardContent, user=Depends(require_approved), db=Depends(get_db)):
    board = await _find_visible(db, board_id, user)
    _require_edit_board(user, board)
    changes = {**body.model_dump(), "updated_by": user["id"], "updated_at": datetime.now(timezone.utc)}
    if _is_private(board):
        changes["published"] = False
    await db.boards.update_one({"id": board_id}, {"$set": changes})
    return _public({**board, **changes}, user)


@router.delete("/{board_id}", status_code=204)
async def delete_board(board_id: str, user=Depends(require_approved), db=Depends(get_db)):
    board = await _find_visible(db, board_id, user)
    _require_edit_board(user, board)
    await db.boards.delete_one({"id": board_id})


# Alineaciones de la pizarra: dónde está cada jugador, guardado para ponerlo otra vez de un toque.
MAX_LINEUPS = 60
lineups_router = APIRouter(prefix="/api/board-lineups")


class LineupCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: TeamId
    name: Name
    tokens: Annotated[list[Token], Field(min_length=1, max_length=MAX_TRACKS)]

    @model_validator(mode="after")
    def only_players(self):
        if any(token.side != "home" or not token.player_id for token in self.tokens):
            raise ValueError("Una alineación solo lleva jugadores del equipo")
        ids = [token.player_id for token in self.tokens]
        if len(set(ids)) != len(ids):
            raise ValueError("Un jugador no puede estar dos veces")
        return self


def _public_lineup(lineup):
    return {
        "id": lineup["id"],
        "team_id": lineup["team_id"],
        "name": lineup["name"],
        "tokens": lineup["tokens"],
        "created_at": lineup["created_at"].isoformat(),
    }


@lineups_router.get("")
async def list_lineups(team_id: Annotated[TeamId, Query()], user=Depends(require_approved), db=Depends(get_db)):
    _require_edit(user, team_id)
    lineups = await db.board_lineups.find({"team_id": team_id}).to_list(MAX_LINEUPS)
    lineups.sort(key=lambda lineup: lineup["created_at"], reverse=True)
    return [_public_lineup(lineup) for lineup in lineups]


@lineups_router.post("", status_code=201)
async def create_lineup(body: LineupCreate, user=Depends(require_approved), db=Depends(get_db)):
    _require_edit(user, body.team_id)
    if await db.board_lineups.count_documents({"team_id": body.team_id}) >= MAX_LINEUPS:
        raise HTTPException(status_code=422, detail=f"Ya hay {MAX_LINEUPS} alineaciones: borra alguna antes")
    lineup = {
        **body.model_dump(),
        "id": str(uuid4()),
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.board_lineups.insert_one(lineup)
    return _public_lineup(lineup)


@lineups_router.delete("/{lineup_id}", status_code=204)
async def delete_lineup(lineup_id: str, user=Depends(require_approved), db=Depends(get_db)):
    lineup = await db.board_lineups.find_one({"id": lineup_id})
    # A quien no es entrenador de ese equipo se le responde igual que si no existiera.
    if not lineup or not _can_edit(user, lineup["team_id"]):
        raise HTTPException(status_code=404, detail="Esa alineación ya no existe")
    await db.board_lineups.delete_one({"id": lineup_id})


class LineupRename(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name


@lineups_router.patch("/{lineup_id}")
async def rename_lineup(lineup_id: str, body: LineupRename, user=Depends(require_approved), db=Depends(get_db)):
    lineup = await db.board_lineups.find_one({"id": lineup_id})
    if not lineup or not _can_edit(user, lineup["team_id"]):
        raise HTTPException(status_code=404, detail="Esa alineación ya no existe")
    await db.board_lineups.update_one({"id": lineup_id}, {"$set": {"name": body.name, "updated_by": user["id"]}})
    return _public_lineup({**lineup, "name": body.name})
