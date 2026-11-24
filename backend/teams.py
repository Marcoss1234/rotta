"""La estructura de cada club: sus equipos, qué equipos juegan juntos, los grupos del ranking y el horario de serie.

Cada club la guarda en su base de datos (`club_settings`, documento `{"id": "club"}`, campo `structure`).
Si no tiene, vale DEFAULT_STRUCTURE (los equipos con los que nació la app), y así un club recién
creado, la demo y los tests funcionan sin configurar nada.

`get_db` la carga en cada petición (use_club_structure) y la deja en una ContextVar: el resto del código
la consulta con las funciones de abajo (teams(), team_name(), match_teams(), groups()...).
Para cambiarla: tools/estructura-club.py.
"""
import re
from contextvars import ContextVar
from typing import Annotated, Literal, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

TEAM_ID = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$")
TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
# Canales del chat que no son de un equipo: ningún equipo puede llamarse así.
RESERVED_IDS = {"general", "familia"}

Weekday = Annotated[int, Field(ge=0, le=6)]


class Session(BaseModel):
    """Un horario de entrenamiento: unos días (0 = lunes) y una hora. Sin hora sale «Horario por consultar»."""

    model_config = ConfigDict(extra="forbid")

    days: Annotated[list[Weekday], Field(min_length=1, max_length=7)]
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


def check_sessions(sessions):
    days = [day for session in sessions for day in session.days]
    if len(set(days)) != len(days):
        raise ValueError("Cada día solo puede tener un horario")
    return sessions


Sessions = Annotated[list[Session], Field(min_length=1, max_length=7), AfterValidator(check_sessions)]


class TeamConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=TEAM_ID.pattern)
    name: str = Field(min_length=1, max_length=60)
    # Cómo se nombra en el calendario: «Partido del Femenino». Si no se pone: «Partido de <nombre>».
    match_phrase: Optional[str] = Field(default=None, max_length=60)
    # Vóley playa: la pista se pinta de arena y no sale el pabellón.
    beach: bool = False
    # Partido en directo: a tres sets ganados (5) o a dos (3), como las escuelas.
    best_of: Literal[3, 5] = 5
    schedule: Sessions


class GroupConfig(BaseModel):
    """Un grupo del ranking: los equipos que se puntúan y se clasifican juntos."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=TEAM_ID.pattern)
    name: str = Field(min_length=1, max_length=60)
    teams: Annotated[list[str], Field(min_length=1)]
    # El premio al primero del mes: «Jugadora del mes», «Estrella del mes»...
    month_title: str = Field(default="Mejor del mes", min_length=1, max_length=40)


class ClubStructure(BaseModel):
    model_config = ConfigDict(extra="forbid")

    teams: Annotated[list[TeamConfig], Field(min_length=1, max_length=40)]
    # Equipos que entrenan aparte pero juegan los mismos partidos (las dos Escuelas).
    shared_matches: list[Annotated[list[str], Field(min_length=2)]] = []
    groups: list[GroupConfig] = []

    @model_validator(mode="after")
    def references_exist(self):
        ids = [team.id for team in self.teams]
        if len(set(ids)) != len(ids):
            raise ValueError("Hay dos equipos con el mismo código")
        if RESERVED_IDS & set(ids):
            raise ValueError("Un equipo no puede llamarse «general» ni «familia»")
        known = set(ids)
        shared = [team for together in self.shared_matches for team in together]
        if len(set(shared)) != len(shared):
            raise ValueError("Un equipo solo puede compartir partidos con un grupo de equipos")
        if not set(shared) <= known:
            raise ValueError("Los partidos compartidos solo pueden ser de equipos del club")
        group_ids = [group.id for group in self.groups]
        if len(set(group_ids)) != len(group_ids):
            raise ValueError("Hay dos grupos del ranking con el mismo código")
        for group in self.groups:
            if not set(group.teams) <= known:
                raise ValueError(f"El grupo «{group.name}» tiene equipos que no son del club")
        return self


DEFAULT_STRUCTURE = ClubStructure.model_validate(
    {
        "teams": [
            {
                "id": "masculino",
                "name": "Club Masculino",
                "match_phrase": "del Masculino",
                "schedule": [{"days": [1, 3], "start": "19:15", "end": "20:45"}],
            },
            {
                "id": "femenino",
                "name": "Club Senior Femenino",
                "match_phrase": "del Femenino",
                "schedule": [{"days": [1, 3], "start": "20:45", "end": "22:15"}],
            },
            {
                "id": "escuela-lm",
                "name": "Club Escuela LM",
                "match_phrase": "de la Escuela",
                "best_of": 3,
                "schedule": [{"days": [0, 2], "start": "17:45", "end": "19:15"}],
            },
            {
                "id": "escuela-mj",
                "name": "Club Escuela MJ",
                "match_phrase": "de la Escuela",
                "best_of": 3,
                "schedule": [{"days": [1, 3], "start": "17:45", "end": "19:15"}],
            },
            {
                "id": "playa",
                "name": "Club Playa",
                "match_phrase": "de Playa",
                "beach": True,
                "schedule": [{"days": [1, 3]}],
            },
        ],
        "shared_matches": [["escuela-lm", "escuela-mj"]],
        # Playa no entra en el ranking hasta que se decida cómo funciona. Las dos Escuelas comparten ranking.
        "groups": [
            {"id": "masculino", "name": "Club Masculino", "teams": ["masculino"], "month_title": "Jugador del mes"},
            {"id": "femenino", "name": "Club Senior Femenino", "teams": ["femenino"], "month_title": "Jugadora del mes"},
            {"id": "escuela", "name": "Club Escuela", "teams": ["escuela-lm", "escuela-mj"], "month_title": "Estrella del mes"},
        ],
    }
)

_current = ContextVar("club_structure", default=DEFAULT_STRUCTURE)


def structure():
    return _current.get()


async def load_club_structure(db):
    """La estructura guardada del club, o la de serie. Una guardada que no valga se ignora (y se usa la de serie)."""
    saved = await db.club_settings.find_one({"id": "club"}, {"_id": 0, "structure": 1})
    raw = (saved or {}).get("structure")
    if not raw:
        return DEFAULT_STRUCTURE
    try:
        return ClubStructure.model_validate(raw)
    except ValidationError:
        return DEFAULT_STRUCTURE


async def use_club_structure(db):
    """Deja la estructura del club de esta petición a mano para todo el código (la llama get_db)."""
    _current.set(await load_club_structure(db))


def teams():
    """Los equipos del club, como los devuelve la API: [{"id", "name"}]."""
    return [{"id": team.id, "name": team.name} for team in structure().teams]


def team_ids():
    return [team.id for team in structure().teams]


def team_name(team_id, default=""):
    return next((team.name for team in structure().teams if team.id == team_id), default)


def team_config(team_id):
    """Todo lo que el club ha dicho de un equipo (TeamConfig), o None si no es del club."""
    return next((team for team in structure().teams if team.id == team_id), None)


def default_schedule(team_id):
    """El horario de serie del equipo (el que vale mientras su entrenador no lo cambie)."""
    team = next(team for team in structure().teams if team.id == team_id)
    return [session.model_dump() for session in team.schedule]


def default_weekdays(team_id):
    """Los días que entrena el equipo con su horario de serie (0 = lunes)."""
    return tuple(sorted({day for session in default_schedule(team_id) for day in session["days"]}))


def match_teams(team_id):
    """Los equipos que ven y juegan los partidos de este equipo."""
    for together in structure().shared_matches:
        if team_id in together:
            return tuple(together)
    return (team_id,)


def groups():
    """Los grupos del ranking: {id: {"name", "teams"}}, en orden."""
    return {
        group.id: {"name": group.name, "teams": tuple(group.teams), "month_title": group.month_title}
        for group in structure().groups
    }


def _check_team(value):
    if value not in team_ids():
        raise ValueError("Ese equipo no es del club")
    return value


def _check_group(value):
    if value not in groups():
        raise ValueError("Ese grupo del ranking no es del club")
    return value


def _check_channel(value):
    if value not in RESERVED_IDS and value not in team_ids():
        raise ValueError("Ese canal no es del club")
    return value


# Se comprueban contra la estructura del club de la petición (FastAPI resuelve get_db antes que el resto).
TeamId = Annotated[str, AfterValidator(_check_team)]
GroupId = Annotated[str, AfterValidator(_check_group)]
ChannelId = Annotated[str, AfterValidator(_check_channel)]
