from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import attendance
from server import app
from teams import TEAM_WEEKDAYS
from test_auth import client_for, db  # noqa: F401


def training_day(team="femenino", skip=0):
    day = datetime.now(timezone.utc).date() + timedelta(days=1)
    while True:
        if day.weekday() in TEAM_WEEKDAYS[team]:
            if skip == 0:
                return day.isoformat()
            skip -= 1
        day += timedelta(days=1)


def rest_day(team="femenino"):
    day = datetime.now(timezone.utc).date() + timedelta(days=1)
    while day.weekday() in TEAM_WEEKDAYS[team]:
        day += timedelta(days=1)
    return day.isoformat()


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    monkeypatch.setattr(attendance, "_indexes_ready", False)


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def member(admin, token, role, team="femenino"):
    client = client_for(token)
    user_id = client.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{user_id}", json={"status": "approved", "role": role, "team_id": team})
    assert response.status_code == 200, response.text
    return client


def answer(client, status="going", team="femenino", date=None):
    return client.put("/api/attendance", json={"team_id": team, "date": date or training_day(team), "status": status})


def read(client, team="femenino", date=None):
    return client.get("/api/attendance", params={"team_id": team, "date": date or training_day(team)})


def test_sin_sesion_nada(db):  # noqa: F811
    client = TestClient(app)
    assert read(client).status_code == 401
    assert answer(client).status_code == 401


def test_pendiente_no_responde_ni_ve(db):  # noqa: F811
    pending = client_for("token-ana")
    assert read(pending).status_code == 403
    assert answer(pending).status_code == 403


def test_jugador_confirma_y_puede_cambiar_de_idea(db, admin):  # noqa: F811
    ana = member(admin, "token-ana", "jugador")
    assert read(ana).json()["mine"] is None
    assert read(ana).json()["can_respond"] is True

    assert answer(ana).json()["mine"] == "going"
    assert read(ana).json()["mine"] == "going"
    assert answer(ana, "not_going").status_code == 200
    assert read(ana).json()["mine"] == "not_going"


def names(data, key):
    return [person["name"] for person in data[key]]


@pytest.mark.parametrize("role", ["jugador", "familia", "entrenador"])
def test_todos_ven_quien_va_no_va_y_no_responde(db, admin, role):  # noqa: F811
    ana = member(admin, "token-ana", "jugador")
    luis = member(admin, "token-luis", role)
    answer(ana)
    data = read(luis).json()
    assert names(data, "going") == ["Ana"]
    assert names(data, "not_going") == []
    if role == "jugador":
        assert names(data, "no_answer") == ["Luis"]
        answer(luis, "not_going")
        data = read(ana).json()
        assert names(data, "not_going") == ["Luis"]
        assert names(data, "no_answer") == []


def test_quien_va_lleva_su_posicion_y_dorsal(db, admin):  # noqa: F811
    ana = member(admin, "token-ana", "jugador")
    answer(ana)
    player_id = admin.get("/api/players?team_id=femenino").json()[0]["id"]
    assert admin.patch(f"/api/players/{player_id}", json={"position": "Central", "number": 9}).status_code == 200
    person = read(ana).json()["going"][0]
    assert (person["position"], person["number"]) == ("Central", 9)


def test_la_lista_no_expone_datos_de_la_cuenta(db, admin):  # noqa: F811
    ana = member(admin, "token-ana", "jugador")
    answer(ana)
    person = read(member(admin, "token-luis", "jugador")).json()["going"][0]
    assert set(person) == {"id", "name", "picture", "position", "number", "guest"}


@pytest.mark.parametrize("status", ["going", "not_going"])
def test_quien_pierde_el_acceso_sale_de_la_lista(db, admin, status):  # noqa: F811
    ana = member(admin, "token-ana", "jugador")
    answer(ana, status)
    ana_id = ana.get("/api/auth/me").json()["id"]
    assert names(read(admin).json(), status) == ["Ana"]

    assert admin.patch(f"/api/users/{ana_id}", json={"status": "rejected"}).status_code == 200
    data = read(admin).json()
    for key in ("going", "not_going", "no_answer"):
        assert names(data, key) == []


def test_sin_aprobar_no_se_ve_la_lista(db, admin):  # noqa: F811
    assert read(client_for("token-ana")).status_code == 403


def test_entrenador_y_familia_no_responden(db, admin):  # noqa: F811
    coach = member(admin, "token-ana", "entrenador")
    family = member(admin, "token-luis", "familia")
    assert read(coach).json()["can_respond"] is False
    assert answer(coach).status_code == 403
    assert read(family).json()["can_respond"] is False
    assert answer(family).status_code == 403


def test_admin_con_equipo_tambien_puede_confirmar(db, admin):  # noqa: F811
    admin_id = admin.get("/api/auth/me").json()["id"]
    assert answer(admin).status_code == 403
    admin.patch(f"/api/users/{admin_id}", json={"team_id": "femenino"})
    assert answer(admin).status_code == 200
    assert names(read(admin).json(), "going") == ["Admin"]


def test_no_se_responde_por_otro_equipo(db, admin):  # noqa: F811
    ana = member(admin, "token-ana", "jugador", team="masculino")
    assert answer(ana, team="femenino").status_code == 403
    assert read(ana, team="femenino").json()["can_respond"] is False
    assert answer(ana, team="masculino").status_code == 200


def test_cada_grupo_de_escuela_solo_entrena_sus_dias(db, admin):  # noqa: F811
    lunes = member(admin, "token-ana", "jugador", team="escuela-lm")
    martes = member(admin, "token-luis", "jugador", team="escuela-mj")

    assert answer(lunes, team="escuela-lm").status_code == 200
    assert answer(martes, team="escuela-mj").status_code == 200
    # El grupo de lunes y miércoles no tiene entrenamiento un martes, ni al revés.
    assert answer(lunes, team="escuela-lm", date=training_day("escuela-mj")).status_code == 422
    assert answer(martes, team="escuela-mj", date=training_day("escuela-lm")).status_code == 422
    # Cada entrenador ve su lista por separado.
    assert names(read(admin, team="escuela-lm").json(), "going") == ["Ana"]
    assert names(read(admin, team="escuela-mj").json(), "going") == ["Luis"]


def test_cada_entrenamiento_tiene_su_respuesta(db, admin):  # noqa: F811
    ana = member(admin, "token-ana", "jugador")
    answer(ana, date=training_day(skip=0))
    assert read(ana, date=training_day(skip=1)).json()["mine"] is None


def test_quien_cambia_de_equipo_sigue_en_la_lista_de_lo_que_respondio(db, admin):  # noqa: F811
    ana = member(admin, "token-ana", "jugador")
    answer(ana)
    ana_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{ana_id}", json={"team_id": "masculino"})
    assert names(read(admin).json(), "going") == ["Ana"]


@pytest.mark.parametrize(
    "date",
    [
        lambda: rest_day(),
        lambda: (datetime.now(timezone.utc).date() - timedelta(days=30)).isoformat(),
        lambda: (datetime.now(timezone.utc).date() + timedelta(days=60)).isoformat(),
    ],
)
def test_fecha_no_valida(db, admin, date):  # noqa: F811
    ana = member(admin, "token-ana", "jugador")
    assert answer(ana, date=date()).status_code == 422
    assert read(ana, date=date()).status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"status": "quizas"},
        {"team_id": "inventado"},
        {"date": "mañana"},
        {"user_id": "otro"},
    ],
)
def test_datos_no_validos(db, admin, body):  # noqa: F811
    ana = member(admin, "token-ana", "jugador")
    payload = {"team_id": "femenino", "date": training_day(), "status": "going", **body}
    assert ana.put("/api/attendance", json=payload).status_code == 422
