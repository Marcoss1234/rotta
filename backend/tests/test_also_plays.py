from datetime import datetime, timedelta, timezone

import pytest

import attendance
import chat
import players
import roster_sync
from teams import TEAM_WEEKDAYS
from test_auth import client_for, db  # noqa: F401


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    for module, flag in ((players, "_indexes_ready"), (roster_sync, "_index_ready"), (attendance, "_indexes_ready"), (chat, "_indexes_ready")):
        monkeypatch.setattr(module, flag, False)


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def account(admin, token="token-ana", **changes):
    client = client_for(token)
    user_id = client.get("/api/auth/me").json()["id"]
    body = {"status": "approved", "role": "entrenador", "team_id": "masculino", **changes}
    response = admin.patch(f"/api/users/{user_id}", json=body)
    assert response.status_code == 200, response.text
    return client, user_id, response.json()


def roster_names(admin, team="masculino"):
    return [player["name"] for player in admin.get(f"/api/players?team_id={team}").json()]


def training_day(team="masculino"):
    day = datetime.now(timezone.utc).date() + timedelta(days=1)
    while day.weekday() not in TEAM_WEEKDAYS[team]:
        day += timedelta(days=1)
    return day.isoformat()


def channels(client):
    return [channel["id"] for channel in client.get("/api/chat/channels").json()]


def test_el_caso_de_david_entrena_las_escuelas_y_juega_en_masculino(admin):
    david, _, user = account(admin, also_plays=True, coached_team_ids=["escuela-lm", "escuela-mj"])
    assert user["role"] == "entrenador"
    assert user["also_plays"] is True
    assert user["coached_team_ids"] == ["escuela-lm", "escuela-mj"]

    assert roster_names(admin) == ["Ana"]
    assert roster_names(admin, "escuela-lm") == []
    assert channels(david) == ["general", "masculino", "escuela-lm", "escuela-mj", "familia"]

    response = david.put("/api/attendance", json={"team_id": "masculino", "date": training_day(), "status": "going"})
    assert response.status_code == 200, response.text
    # Sigue siendo entrenador: gestiona plantillas y ve la asistencia.
    created = david.post("/api/players", json={"team_id": "escuela-lm", "name": "Niña Escuela"})
    assert created.status_code == 201, created.text
    seen = david.get(f"/api/attendance?team_id=masculino&date={training_day()}").json()
    assert [person["name"] for person in seen["going"]] == ["Ana"]


def test_entrenador_que_no_juega_no_entra_en_plantilla_ni_responde(admin):
    coach, _, _ = account(admin)
    assert roster_names(admin) == []
    assert coach.put("/api/attendance", json={"team_id": "masculino", "date": training_day(), "status": "going"}).status_code == 403


@pytest.mark.parametrize("role", ["entrenador", "admin"])
def test_marcar_tambien_juega_lo_mete_y_desmarcar_lo_saca(admin, role):
    _, user_id, _ = account(admin, role=role)
    assert roster_names(admin) == []
    assert admin.patch(f"/api/users/{user_id}", json={"also_plays": True}).status_code == 200
    assert roster_names(admin) == ["Ana"]
    assert admin.patch(f"/api/users/{user_id}", json={"also_plays": False}).status_code == 200
    assert roster_names(admin) == []


def test_familia_no_entra_aunque_tenga_la_marca(admin):
    client, _, _ = account(admin, role="familia", also_plays=True)
    assert roster_names(admin) == []
    assert client.put("/api/attendance", json={"team_id": "masculino", "date": training_day(), "status": "going"}).status_code == 403


def test_si_no_contesta_sale_como_sin_responder(admin):
    account(admin, also_plays=True)
    seen = admin.get(f"/api/attendance?team_id=masculino&date={training_day()}").json()
    assert [person["name"] for person in seen["no_answer"]] == ["Ana"]


def test_equipos_que_entrena_solo_cuentan_para_entrenadores(admin):
    player, _, _ = account(admin, role="jugador", coached_team_ids=["playa"])
    assert channels(player) == ["general", "masculino", "familia"]
    family, _, _ = account(admin, "token-luis", role="familia", coached_team_ids=["playa"])
    assert channels(family) == ["familia"]
    assert family.get("/api/chat/channels/playa/messages").status_code == 403


def test_quitar_un_equipo_entrenado_corta_ese_chat(admin):
    coach, user_id, _ = account(admin, coached_team_ids=["playa"])
    assert coach.get("/api/chat/channels/playa/messages").status_code == 200
    assert admin.patch(f"/api/users/{user_id}", json={"coached_team_ids": []}).status_code == 200
    assert coach.get("/api/chat/channels/playa/messages").status_code == 403


def test_equipo_entrenado_no_valido_o_repetido(admin):
    _, user_id, _ = account(admin)
    assert admin.patch(f"/api/users/{user_id}", json={"coached_team_ids": ["inventado"]}).status_code == 422
    repeated = admin.patch(f"/api/users/{user_id}", json={"coached_team_ids": ["playa", "playa"]})
    assert repeated.json()["coached_team_ids"] == ["playa"]


def test_solo_un_admin_cambia_estos_campos(admin):
    coach, user_id, _ = account(admin)
    other = coach.patch(f"/api/users/{user_id}", json={"coached_team_ids": ["playa"]})
    assert other.status_code == 403
    assert coach.patch(f"/api/users/{user_id}", json={"also_plays": True}).status_code == 403


def test_un_admin_puede_marcarse_a_si_mismo_que_juega(admin):
    me = admin.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{me}", json={"also_plays": True, "team_id": "femenino"})
    assert response.status_code == 200, response.text
    assert response.json()["role"] == "admin"
    assert roster_names(admin, "femenino") == ["Admin"]
