import pytest

import attendance
import chat
import help_requests
import honors
from test_attendance import training_day
from test_auth import client_for, db  # noqa: F401


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    for module in (attendance, chat, help_requests, honors):
        monkeypatch.setattr(module, "_indexes_ready", False)


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def member(admin, token, team, role="jugador"):
    client = client_for(token)
    me = client.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{me}", json={"status": "approved", "role": role, "team_id": team})
    assert response.status_code == 200, response.text
    return client


def ask(client, team="femenino", date=None):
    return client.post("/api/attendance/help", json={"team_id": team, "date": date or training_day(team)})


def going(client, team="femenino", date=None):
    response = client.get(f"/api/attendance?team_id={team}&date={date or training_day(team)}")
    assert response.status_code == 200, response.text
    return response.json()


def help_message(client):
    messages = client.get("/api/chat/channels/general/messages").json()["messages"]
    return next(message for message in messages if message["help"])


def test_pedir_ayuda_sale_en_el_chat_general(admin):
    ana = member(admin, "token-ana", "femenino")
    luis = member(admin, "token-luis", "masculino")
    asked = ask(ana)
    assert asked.status_code == 201, asked.text
    message = help_message(luis)
    assert "Club Senior Femenino" in message["text"] and "Voy" in message["text"]
    assert message["help"]["team_id"] == "femenino" and message["help"]["helpers"] == []
    assert message["help"]["joined"] is False and message["help"]["own_team"] is False
    assert help_message(ana)["help"]["own_team"] is True
    assert going(ana)["help"] == {"id": asked.json()["id"], "helpers": 0}
    # Solo una petición por entreno.
    assert ask(ana).status_code == 409


def test_quien_se_apunta_va_a_ese_entreno_y_gana_coins(admin):
    ana = member(admin, "token-ana", "femenino")
    luis = member(admin, "token-luis", "masculino")
    request_id = ask(ana).json()["id"]

    joined = luis.post(f"/api/attendance/help/{request_id}/join")
    assert joined.status_code == 200, joined.text
    assert joined.json()["joined"] is True and joined.json()["coins_change"] == help_requests.HELP_COINS
    assert [person["name"] for person in help_message(ana)["help"]["going"]] == ["Luis"]
    people = going(ana)["going"]
    assert [(person["name"], person["guest"]) for person in people] == [("Luis", True)]
    assert going(ana)["help"]["helpers"] == 1
    assert luis.get("/api/coins").json()["balance"] == help_requests.HELP_COINS
    # Apuntarse otra vez no suma más.
    assert luis.post(f"/api/attendance/help/{request_id}/join").json()["coins_change"] == 0

    left = luis.delete(f"/api/attendance/help/{request_id}/join")
    assert left.status_code == 200 and left.json()["coins_change"] == -help_requests.HELP_COINS
    assert going(ana)["going"] == []
    assert luis.get("/api/coins").json()["balance"] == 0


def test_los_del_propio_equipo_y_las_familias_no_se_apuntan(admin):
    ana = member(admin, "token-ana", "femenino")
    request_id = ask(ana).json()["id"]
    assert ana.post(f"/api/attendance/help/{request_id}/join").status_code == 422
    family = member(admin, "token-luis", "femenino", role="familia")
    assert family.post(f"/api/attendance/help/{request_id}/join").status_code == 403


def test_solo_se_pide_ayuda_para_tu_equipo(admin):
    luis = member(admin, "token-luis", "masculino")
    assert ask(luis, team="femenino").status_code == 403
    # El administrador puede pedirla para cualquiera.
    assert ask(admin, team="femenino").status_code == 201


def test_borrar_el_mensaje_cancela_la_ayuda(admin):
    ana = member(admin, "token-ana", "femenino")
    luis = member(admin, "token-luis", "masculino")
    request_id = ask(ana).json()["id"]
    luis.post(f"/api/attendance/help/{request_id}/join")
    message_id = help_message(ana)["id"]
    assert ana.delete(f"/api/chat/messages/{message_id}").status_code == 204
    assert going(ana)["going"] == [] and going(ana)["help"] is None
    assert luis.get("/api/coins").json()["balance"] == 0
    assert luis.post(f"/api/attendance/help/{request_id}/join").status_code == 404
