from typing import Literal

# Los equipos son los grupos del club. Si cambian, se cambian aquí y en src/app/teams.js.
TEAMS = [
    {"id": "masculino", "name": "Club Masculino"},
    {"id": "femenino", "name": "Club Senior Femenino"},
    {"id": "escuela-lm", "name": "Club Escuela LM"},
    {"id": "escuela-mj", "name": "Club Escuela MJ"},
    {"id": "playa", "name": "Club Playa"},
]
TeamId = Literal["masculino", "femenino", "escuela-lm", "escuela-mj", "playa"]

# Las dos Escuelas entrenan aparte, pero juegan los mismos partidos. Debe coincidir con src/app/teams.js.
SHARED_MATCH_TEAMS = ("escuela-lm", "escuela-mj")


def match_teams(team_id):
    """Los equipos que ven y juegan los partidos de este equipo."""
    return SHARED_MATCH_TEAMS if team_id in SHARED_MATCH_TEAMS else (team_id,)

# Días de entrenamiento (0 = lunes). Deben coincidir con los horarios de src/app/teams.js.
TEAM_WEEKDAYS = {
    "masculino": (1, 3),
    "femenino": (1, 3),
    "escuela-lm": (0, 2),
    "escuela-mj": (1, 3),
    "playa": (1, 3),
}
