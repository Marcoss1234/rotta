from datetime import timedelta

import pytest

import matches
from test_auth import client_for, db  # noqa: F401


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def member(admin, role="jugador", team="masculino", token="token-ana"):
    client = client_for(token)
    user_id = client.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{user_id}", json={"status": "approved", "role": role, "team_id": team})
    assert response.status_code == 200, response.text
    return client


def day(offset=10):
    return (matches._today() + timedelta(days=offset)).isoformat()


def create(client, **body):
    return client.post("/api/events", json={"title": "Cena de equipo", "date": day(), **body})


def calendar(client, month=None):
    response = client.get(f"/api/calendar?month={month or day()[:7]}")
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("role", ["entrenador", "admin"])
def test_entrenadores_y_administradores_crean_eventos(admin, role):
    client = member(admin, role=role)
    response = create(client, time="21:30", location="Bar Central", notes="Reservado")
    assert response.status_code == 201, response.text
    [item] = calendar(client)["items"]
    assert (item["type"], item["title"], item["time"], item["location"], item["notes"]) == ("event", "Cena de equipo", "21:30", "Bar Central", "Reservado")


@pytest.mark.parametrize("role", ["jugador", "familia"])
def test_los_demas_ven_el_calendario_pero_no_lo_tocan(admin, role):
    event = create(admin).json()
    client = member(admin, role=role)
    result = calendar(client)
    assert result["can_manage"] is False
    assert [item["id"] for item in result["items"]] == [event["id"]]
    assert create(client).status_code == 403
    assert client.put(f"/api/events/{event['id']}", json={"title": "Otro", "date": day()}).status_code == 403
    assert client.delete(f"/api/events/{event['id']}").status_code == 403


def test_el_jugador_con_permiso_de_partidos_no_crea_eventos(admin):
    ana = member(admin)
    user_id = ana.get("/api/auth/me").json()["id"]
    assert admin.patch(f"/api/users/{user_id}", json={"match_editor": True}).status_code == 200
    assert create(ana).status_code == 403


def test_sin_acceso_no_se_ve(db):  # noqa: F811
    assert client_for().get(f"/api/calendar?month={day()[:7]}").status_code == 401
    assert client_for("token-ana").get(f"/api/calendar?month={day()[:7]}").status_code == 403


def add_match(admin, team, date, time="18:00", rival="CV Roquetas", **extra):
    response = admin.post("/api/matches", json={"team_id": team, "date": date, "time": time, "opponent": rival, "notes": "Interna", **extra})
    assert response.status_code == 201, response.text


def test_salen_los_partidos_de_todos_los_equipos_con_lo_justo(admin):
    add_match(admin, "femenino", day(), rival="CD Vicar")
    add_match(admin, "escuela-lm", day(), time="11:00", rival="Ejido")
    add_match(admin, "masculino", day(-3), rival="Jugado")
    items = calendar(member(admin, team="playa"), day()[:7])["items"]
    found = {item["opponent"]: item for item in items if item["type"] == "match"}
    assert found["CD Vicar"]["team_id"] == "femenino" and found["Ejido"]["team_id"] == "escuela-lm"
    assert set(found["CD Vicar"]) == {"type", "id", "date", "time", "team_id", "opponent"}


def test_mezcla_ordenada_por_dia_y_hora(admin):
    add_match(admin, "masculino", day(), time="18:00", rival="Tarde")
    create(admin, title="Por la manana", time="10:00")
    create(admin, title="Al dia siguiente", date=day(11))
    month = day()[:7]
    if day(11)[:7] != month:
        pytest.skip("El dia siguiente cae en otro mes")
    labels = [item.get("title") or item["opponent"] for item in calendar(admin, month)["items"]]
    assert labels == ["Por la manana", "Tarde", "Al dia siguiente"]


def test_cada_mes_solo_lo_suyo(admin):
    today = matches._today().replace(day=1)
    next_month = (today + timedelta(days=32)).replace(day=1)
    create(admin, title="Este", date=today.isoformat())
    create(admin, title="El siguiente", date=next_month.isoformat())
    assert [item["title"] for item in calendar(admin, next_month.isoformat()[:7])["items"]] == ["El siguiente"]


def test_editar_y_borrar(admin):
    event = create(admin, location="Bar").json()
    edited = admin.put(f"/api/events/{event['id']}", json={"title": "Comida", "date": day(12), "time": "14:00"})
    assert edited.status_code == 200, edited.text
    assert (edited.json()["title"], edited.json()["date"], edited.json()["location"]) == ("Comida", day(12), "")
    assert admin.delete(f"/api/events/{event['id']}").status_code == 204
    assert admin.delete(f"/api/events/{event['id']}").status_code == 404
    assert admin.put(f"/api/events/{event['id']}", json={"title": "Otra", "date": day()}).status_code == 404


@pytest.mark.parametrize(
    "body",
    [{"title": "   "}, {"title": "x" * 81}, {"time": "25:00"}, {"date": "mañana"}, {"inventado": 1}],
)
def test_datos_no_validos(admin, body):
    assert create(admin, **body).status_code == 422


@pytest.mark.parametrize("offset", [-800, 400])
def test_fechas_demasiado_lejanas(admin, offset):
    assert create(admin, date=day(offset)).status_code == 422


@pytest.mark.parametrize("month", ["2026-13", "2026", "x"])
def test_mes_no_valido(admin, month):
    assert admin.get(f"/api/calendar?month={month}").status_code == 422
