from datetime import datetime, timedelta, timezone

import pytest

from test_auth import client_for, db  # noqa: F401

DEFAULT_FEMENINO = [{"days": [1, 3], "start": "20:45", "end": "22:15"}]


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def member(admin, token="token-ana", role="jugador", team="femenino", coached=None):
    client = client_for(token)
    user_id = client.get("/api/auth/me").json()["id"]
    changes = {"status": "approved", "role": role, "team_id": team}
    if coached is not None:
        changes["coached_team_ids"] = coached
    response = admin.patch(f"/api/users/{user_id}", json=changes)
    assert response.status_code == 200, response.text
    return client


def save(client, team="femenino", sessions=None):
    return client.put(f"/api/schedules/{team}", json={"sessions": sessions or [{"days": [0, 2], "start": "19:00", "end": "20:30"}]})


def next_day(weekday):
    day = datetime.now(timezone.utc).date() + timedelta(days=1)
    while day.weekday() != weekday:
        day += timedelta(days=1)
    return day.isoformat()


def test_horario_de_serie_para_todos(admin):
    ana = member(admin)
    schedules = ana.get("/api/schedules").json()
    assert set(schedules) == {"masculino", "femenino", "escuela-lm", "escuela-mj", "playa"}
    assert schedules["femenino"] == {"sessions": DEFAULT_FEMENINO, "can_edit": False}
    assert schedules["playa"]["sessions"][0]["start"] is None


def test_el_entrenador_cambia_el_horario_de_su_equipo(admin):
    raul = member(admin, "token-luis", role="entrenador", team="masculino", coached=["femenino"])
    response = save(raul)
    assert response.status_code == 200, response.text
    ana = member(admin)
    assert ana.get("/api/schedules").json()["femenino"]["sessions"] == [{"days": [0, 2], "start": "19:00", "end": "20:30"}]
    assert raul.get("/api/schedules").json()["femenino"]["can_edit"] is True
    assert raul.get("/api/schedules").json()["masculino"]["can_edit"] is True
    assert raul.get("/api/schedules").json()["playa"]["can_edit"] is False


def test_otros_no_pueden_cambiarlo(admin):
    ana = member(admin)
    assert save(ana).status_code == 403
    otro = member(admin, "token-luis", role="entrenador", team="escuela-lm", coached=["escuela-lm"])
    assert save(otro).status_code == 403
    assert save(admin).status_code == 200


@pytest.mark.parametrize("sessions", [
    [{"days": [1], "start": "20:00", "end": "19:00"}],
    [{"days": [1], "start": "20:00", "end": None}],
    [{"days": [1], "start": "25:00", "end": "26:00"}],
    [{"days": [], "start": "19:00", "end": "20:00"}],
    [{"days": [7], "start": "19:00", "end": "20:00"}],
    [{"days": [1, 1], "start": "19:00", "end": "20:00"}],
    [{"days": [1], "start": "19:00", "end": "20:00"}, {"days": [1], "start": "21:00", "end": "22:00"}],
])
def test_horarios_no_validos(admin, sessions):
    assert save(admin, sessions=sessions).status_code == 422


def test_dos_horarios_distintos_y_sin_hora(admin):
    sessions = [{"days": [3], "start": "18:00", "end": "19:30"}, {"days": [0], "start": None, "end": None}]
    saved = save(admin, sessions=sessions).json()["sessions"]
    assert [session["days"] for session in saved] == [[0], [3]]


def test_la_asistencia_sigue_los_dias_nuevos(admin):
    ana = member(admin)
    lunes = next_day(0)
    martes = next_day(1)
    assert ana.get(f"/api/attendance?team_id=femenino&date={lunes}").status_code == 422
    assert ana.get(f"/api/attendance?team_id=femenino&date={martes}").status_code == 200
    save(admin)  # Lunes y miércoles.
    assert ana.get(f"/api/attendance?team_id=femenino&date={lunes}").status_code == 200
    assert ana.put("/api/attendance", json={"team_id": "femenino", "date": lunes, "status": "going"}).status_code == 200
    assert ana.get(f"/api/attendance?team_id=femenino&date={martes}").status_code == 422
