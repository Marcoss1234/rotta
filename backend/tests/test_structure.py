"""Fase 2 de varios clubs: cada club tiene sus equipos, sus partidos compartidos y sus grupos del ranking."""
import asyncio
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from database import get_db
from server import app
from teams import DEFAULT_STRUCTURE, ClubStructure, load_club_structure, use_club_structure
from test_auth import client_for, db  # noqa: F401

EXAMPLE = json.loads((Path(__file__).resolve().parents[2] / "tools" / "estructura-ejemplo.json").read_text(encoding="utf-8"))


@pytest.fixture
def club(db):  # noqa: F811
    """Un club con su propia estructura (la de tools/estructura-ejemplo.json), cargada como lo hace get_db."""
    asyncio.run(db.club_settings.insert_one({"id": "club", "structure": EXAMPLE}))

    async def club_db():
        await use_club_structure(db)
        return db

    app.dependency_overrides[get_db] = club_db
    return db


def admin_client():
    return client_for("token-admin")


def test_el_ejemplo_es_una_estructura_valida():
    ClubStructure.model_validate(EXAMPLE)


def test_sin_estructura_guardada_valen_los_equipos_de_serie(db):  # noqa: F811
    response = client_for().get("/api/club/structure")
    assert response.status_code == 200
    assert response.json() == DEFAULT_STRUCTURE.model_dump()
    assert [team["id"] for team in admin_client().get("/api/teams").json()] == [
        "masculino",
        "femenino",
        "escuela-lm",
        "escuela-mj",
        "playa",
    ]


def test_la_estructura_es_publica_como_los_colores(club):
    response = client_for().get("/api/club/structure")
    assert response.status_code == 200
    data = response.json()
    assert [team["id"] for team in data["teams"]] == ["alevin-a", "alevin-b", "cadete", "senior", "playa"]
    assert data["shared_matches"] == [["alevin-a", "alevin-b"]]
    assert [group["id"] for group in data["groups"]] == ["alevin", "cadete", "senior"]


def test_los_equipos_son_los_del_club(club):
    admin = admin_client()
    assert admin.get("/api/teams").json()[2] == {"id": "cadete", "name": "Cadete Femenino"}
    assert admin.get("/api/players?team_id=cadete").status_code == 200
    # Los equipos de serie ya no existen en este club.
    assert admin.get("/api/players?team_id=masculino").status_code == 422
    assert admin.get("/api/matches?team_id=masculino").status_code == 422


def test_el_chat_tiene_los_canales_del_club(club):
    admin = admin_client()
    channels = [channel["id"] for channel in admin.get("/api/chat/channels").json()]
    assert channels == ["general", "alevin-a", "alevin-b", "cadete", "senior", "playa", "familia"]
    assert admin.get("/api/chat/channels/cadete/messages").status_code == 200
    assert admin.get("/api/chat/channels/masculino/messages").status_code == 422


def test_el_horario_de_serie_es_el_del_club(club):
    schedules = admin_client().get("/api/schedules").json()
    assert set(schedules) == {"alevin-a", "alevin-b", "cadete", "senior", "playa"}
    assert schedules["cadete"]["sessions"] == [
        {"days": [0, 2], "start": "18:15", "end": "19:45"},
        {"days": [4], "start": "17:30", "end": "19:00"},
    ]
    assert schedules["playa"]["sessions"] == [{"days": [5], "start": None, "end": None}]


def test_los_grupos_del_ranking_son_los_del_club(club):
    admin = admin_client()
    assert [group["id"] for group in admin.get("/api/ranking/groups").json()] == ["alevin", "cadete", "senior"]
    assert admin.get("/api/ranking?group_id=alevin").status_code == 200
    assert admin.get("/api/ranking?group_id=escuela").status_code == 422


def test_una_estructura_guardada_que_no_vale_no_rompe_el_club(db):  # noqa: F811
    asyncio.run(db.club_settings.insert_one({"id": "club", "structure": {"teams": []}}))
    assert asyncio.run(load_club_structure(db)) == DEFAULT_STRUCTURE


@pytest.mark.parametrize(
    "change, message",
    [
        (lambda data: data["teams"].append(dict(data["teams"][0])), "mismo código"),
        (lambda data: data["teams"][0].update(id="general"), "general"),
        (lambda data: data["groups"][0]["teams"].append("inventado"), "no son del club"),
        (lambda data: data["shared_matches"].append(["cadete", "inventado"]), "equipos del club"),
        (lambda data: data["teams"][0].update(id="Con Espacios"), "pattern"),
        (lambda data: data["teams"][0]["schedule"].append({"days": [0], "start": "10:00", "end": "11:00"}), "un horario"),
    ],
)
def test_estructuras_mal_hechas_no_valen(change, message):
    data = json.loads(json.dumps(EXAMPLE))
    change(data)
    with pytest.raises(ValidationError, match=message):
        ClubStructure.model_validate(data)
