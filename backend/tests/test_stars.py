import asyncio
from datetime import datetime, timedelta, timezone

import pytest

import attendance
import honors
from teams import default_weekdays
from test_auth import client_for, db  # noqa: F401


# Para que no dependa de la hora a la que se pasan los tests: es casi medianoche en España
# y los destacados cuentan desde hace tiempo.
LATE = datetime.now(attendance.CLUB_TIME).replace(hour=23, minute=59, second=0, microsecond=0)


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    monkeypatch.setattr(attendance, "_indexes_ready", False)
    monkeypatch.setattr(honors, "_indexes_ready", False)
    monkeypatch.setattr(attendance, "_club_now", lambda: LATE)
    monkeypatch.setattr(attendance, "STARS_FROM", LATE.date() - timedelta(days=30))


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def member(admin, token, team="femenino", role="jugador"):
    client = client_for(token)
    me = client.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{me}", json={"status": "approved", "role": role, "team_id": team})
    return client, me


def last_training(team="femenino"):
    day = LATE.date()
    while day.weekday() not in default_weekdays(team):
        day -= timedelta(days=1)
    return day.isoformat()


def went(db, user_id, date, team="femenino"):  # noqa: F811
    asyncio.run(db.attendance.insert_one({"team_id": team, "date": date, "user_id": user_id, "status": "going"}))


def stars(client, user_ids, date=None, team="femenino"):
    return client.put("/api/attendance/stars", json={"team_id": team, "date": date or last_training(team), "user_ids": user_ids})


def test_el_entrenador_elige_destacados_y_ganan_coins(admin, db):  # noqa: F811
    ana, ana_id = member(admin, "token-ana")
    luis, luis_id = member(admin, "token-luis")
    day = last_training()
    went(db, ana_id, day)
    went(db, luis_id, day)
    # Lo que ya tienen por haber dicho "Voy" (según el día puede contar o no); aquí solo miramos lo de destacado.
    ana_base = ana.get("/api/coins").json()["balance"]
    luis_base = luis.get("/api/coins").json()["balance"]

    listed = admin.get("/api/attendance/stars?team_id=femenino").json()
    assert listed["date"] == day and listed["can_star"] is True and len(listed["going"]) == 2
    saved = stars(admin, [ana_id])
    assert saved.status_code == 200, saved.text
    assert [person["id"] for person in saved.json()["stars"]] == [ana_id]
    assert ana.get("/api/coins").json()["balance"] == ana_base + attendance.STAR_COINS

    # Cambiar de idea: a Ana se le quitan y Luis los gana.
    stars(admin, [luis_id])
    assert ana.get("/api/coins").json()["balance"] == ana_base
    assert luis.get("/api/coins").json()["balance"] == luis_base + attendance.STAR_COINS
    # Los jugadores ven quién ha sido destacado, pero no eligen.
    seen = ana.get("/api/attendance/stars?team_id=femenino").json()
    assert seen["can_star"] is False and seen["going"] == [] and seen["stars"][0]["id"] == luis_id
    assert stars(ana, [ana_id]).status_code == 403


def test_solo_los_que_fueron_y_como_mucho_tres(admin, db):  # noqa: F811
    _, ana_id = member(admin, "token-ana")
    assert stars(admin, [ana_id]).status_code == 422
    assert stars(admin, ["a", "b", "c", "d"]).status_code == 422


def test_ir_al_entreno_da_diez(admin):
    assert attendance.ATTENDANCE_COINS == 10


def test_no_hay_destacados_hasta_que_empieza_el_entreno(admin, monkeypatch):
    # Hoy toca entreno pero aún no ha empezado: se ve el entreno anterior.
    today = LATE.date()
    while today.weekday() not in default_weekdays("femenino"):
        today -= timedelta(days=1)
    morning = LATE.replace(year=today.year, month=today.month, day=today.day, hour=9, minute=0)
    monkeypatch.setattr(attendance, "_club_now", lambda: morning)
    listed = admin.get("/api/attendance/stars?team_id=femenino").json()
    assert listed["date"] != today.isoformat()
    assert stars(admin, [], date=today.isoformat()).status_code == 422
    # Ya ha empezado (el femenino entrena a las 20:45): ahora sí es el de hoy.
    night = morning.replace(hour=21, minute=0)
    monkeypatch.setattr(attendance, "_club_now", lambda: night)
    assert admin.get("/api/attendance/stars?team_id=femenino").json()["date"] == today.isoformat()


def test_los_entrenos_de_antes_de_empezar_los_destacados_no_cuentan(admin, monkeypatch):
    monkeypatch.setattr(attendance, "STARS_FROM", LATE.date() + timedelta(days=1))
    listed = admin.get("/api/attendance/stars?team_id=femenino").json()
    assert listed["date"] is None and listed["can_star"] is False
    assert stars(admin, []).status_code == 422
