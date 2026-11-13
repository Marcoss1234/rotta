import asyncio

import pytest

import attendance
import honors
import players
import ranking
from test_attendance import answer, training_day
from test_auth import client_for, db  # noqa: F401
from test_ranking import ALL_EIGHT, COACHED, add_player, member, publish_ok, rate_ok, set_coached, week


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    monkeypatch.setattr(ranking, "_indexes_ready", False)
    monkeypatch.setattr(attendance, "_indexes_ready", False)
    monkeypatch.setattr(honors, "_indexes_ready", False)


@pytest.fixture
def admin(db, monkeypatch):  # noqa: F811
    # Los índices de fichas se crean antes de meter jugadores: si no, al pasar este archivo solo,
    # el índice de dorsales chocaba con los que ya había.
    monkeypatch.setattr(players, "_indexes_ready", False)
    asyncio.run(players._ensure_indexes(db))
    client = client_for("token-admin")
    set_coached(client, COACHED)
    return client


def scores(value):
    return {skill: value for skill in ALL_EIGHT}


def player_of(db, client):  # noqa: F811
    me = client.get("/api/auth/me").json()["id"]
    return asyncio.run(db.players.find_one({"user_id": me}))["id"]


def coins(client):
    response = client.get("/api/coins")
    assert response.status_code == 200, response.text
    return response.json()


def month_change_offset():
    """Cuántas semanas atrás está la última semana del mes anterior."""
    offset = 1
    while week(offset)[:7] == week(0)[:7]:
        offset += 1
    return offset


def test_el_podio_de_la_semana_gana_coins_y_corona(admin, db):  # noqa: F811
    ana = member(admin)
    luis = member(admin, "token-luis")
    # Jugadores sin cuenta: entran en el podio, pero no tienen dónde recibir coins.
    pepe = add_player(admin, "Pepe")
    eva = add_player(admin, "Eva")
    rate_ok(admin, player_of(db, ana), scores(6))
    rate_ok(admin, player_of(db, luis), scores(8))
    rate_ok(admin, pepe, scores(9))
    rate_ok(admin, eva, scores(5))
    publish_ok(admin)

    assert coins(luis)["balance"] == 60 and coins(luis)["crown"] == "silver"
    assert coins(ana)["balance"] == 40 and coins(ana)["crown"] == "bronze"
    assert coins(ana)["honors"][0]["title"] == "Top 3 de la semana"

    podium = admin.get("/api/ranking/honors?group_id=masculino").json()
    assert [(entry["name"], entry["place"]) for entry in podium["week"]] == [("Pepe", 1), ("Luis", 2), ("Ana", 3)]
    roster = admin.get("/api/players?team_id=masculino").json()
    crowns = {player["id"]: player["crown"] for player in roster}
    assert crowns[player_of(db, luis)] == "silver" and crowns[eva] is None


def test_empatados_comparten_puesto_y_premio(admin, db):  # noqa: F811
    ana = member(admin)
    luis = member(admin, "token-luis")
    for client in (ana, luis):
        rate_ok(admin, player_of(db, client), scores(8))
    publish_ok(admin)
    assert coins(ana)["balance"] == coins(luis)["balance"] == 100


def test_el_premio_no_se_da_dos_veces(admin, db):  # noqa: F811
    ana = member(admin)
    rate_ok(admin, player_of(db, ana), scores(8))
    publish_ok(admin)
    publish_ok(admin)
    assert coins(ana)["balance"] == 100


def test_la_semana_siguiente_pasa_la_corona(admin, db):  # noqa: F811
    ana = member(admin)
    luis = member(admin, "token-luis")
    rate_ok(admin, player_of(db, ana), scores(9), offset=1)
    publish_ok(admin, offset=1)
    rate_ok(admin, player_of(db, luis), scores(9))
    rate_ok(admin, player_of(db, ana), scores(5))
    publish_ok(admin)
    assert coins(luis)["crown"] == "gold"
    assert coins(ana)["crown"] == "silver"
    assert coins(ana)["balance"] == 160


def test_al_empezar_mes_se_elige_el_mejor_del_mes_anterior(admin, db):  # noqa: F811
    ana = member(admin)
    luis = member(admin, "token-luis")
    last_of_month = month_change_offset()
    rate_ok(admin, player_of(db, ana), scores(9), offset=last_of_month)
    rate_ok(admin, player_of(db, luis), scores(7), offset=last_of_month)
    publish_ok(admin, offset=last_of_month)
    assert coins(ana)["balance"] == 100

    rate_ok(admin, player_of(db, luis), scores(9), offset=last_of_month - 1)
    publish_ok(admin, offset=last_of_month - 1)
    mine = coins(ana)
    # 100 de la semana + 250 del mes; y la corona del mes manda aunque esta semana no haya jugado.
    assert mine["balance"] == 350
    assert mine["crown"] == "month"
    month_number = int(week(last_of_month)[5:7])
    assert mine["honors"][0]["title"].startswith("Jugador del mes · " + ranking.MONTH_NAMES[month_number - 1])
    assert coins(luis)["balance"] == 60 + 100 + 150
    podium = admin.get("/api/ranking/honors?group_id=masculino").json()
    assert podium["month"][0]["name"] and podium["month_title"] == "Jugador del mes"


def test_ir_al_entreno_da_coins_y_no_ir_los_quita(admin):
    ana = client_for("token-ana")
    me = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{me}", json={"status": "approved", "role": "jugador", "team_id": "femenino"})
    coins_per_training = attendance.ATTENDANCE_COINS

    first = answer(ana)
    assert first.status_code == 200 and first.json()["coins"] == coins_per_training
    assert answer(ana).json()["coins"] == 0
    assert coins(ana)["balance"] == coins_per_training
    assert coins(ana)["entries"][0]["label"] == "Voy al entreno"

    assert answer(ana, "not_going").json()["coins"] == -coins_per_training
    assert coins(ana)["balance"] == 0
    assert answer(ana, "going").json()["coins"] == coins_per_training

    assert answer(ana, "not_going", date=training_day(skip=1)).json()["coins"] == 0
    assert answer(ana, date=training_day(skip=1)).status_code == 200
    assert coins(ana)["balance"] == coins_per_training * 2


def test_sin_acceso_no_hay_coins(db):  # noqa: F811
    assert client_for("token-ana").get("/api/coins").status_code == 403


def test_no_contestar_a_un_entreno_resta_coins(admin, db, monkeypatch):  # noqa: F811
    import coins as coins_module
    from datetime import datetime, timedelta, timezone

    ana = client_for("token-ana")
    me = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{me}", json={"status": "approved", "role": "jugador", "team_id": "femenino"})
    # Ana lleva tres semanas en el club y la norma ya existía.
    joined = datetime.now(timezone.utc) - timedelta(days=21)
    asyncio.run(db.users.update_one({"id": me}, {"$set": {"created_at": joined}}))
    monkeypatch.setattr(coins_module, "PENALTIES_FROM", (joined - timedelta(days=30)).date())

    today = datetime.now(coins_module.CLUB_TIME).date()
    weekdays = asyncio.run(coins_module.team_weekdays(db, "femenino"))
    past = [
        (today - timedelta(days=offset)).isoformat()
        for offset in range(1, 21)
        if (today - timedelta(days=offset)).weekday() in weekdays
    ]
    # Contestó a uno ("No voy"): ese no resta.
    asyncio.run(db.attendance.insert_one({"team_id": "femenino", "date": past[-1], "user_id": me, "status": "not_going"}))

    first = coins(ana)
    assert first["balance"] == -coins_module.NO_ANSWER_PENALTY * (len(past) - 1)
    assert first["entries"][0]["label"].startswith("Sin contestar al entreno del")
    # Mirarlo otra vez no vuelve a cobrar.
    assert coins(ana)["balance"] == first["balance"]


def test_decir_no_voy_sin_haber_dicho_voy_no_quita_nada(admin):
    ana = client_for("token-ana")
    me = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{me}", json={"status": "approved", "role": "jugador", "team_id": "femenino"})
    assert answer(ana, "not_going").json()["coins"] == 0
    assert coins(ana)["balance"] == 0


def test_los_voy_de_antes_de_los_coins_cuentan_solos(admin, db, monkeypatch):  # noqa: F811
    import coins as coins_module
    from datetime import date

    ana = client_for("token-ana")
    me = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{me}", json={"status": "approved", "role": "jugador", "team_id": "femenino"})
    monkeypatch.setattr(coins_module, "COINS_FROM", date(2000, 1, 1))
    day = training_day()
    # Un "Voy" guardado antes de que existieran los coins, y otro de cuando valía 5.
    asyncio.run(db.attendance.insert_one({"team_id": "femenino", "date": day, "user_id": me, "status": "going"}))
    other = training_day(skip=1)
    asyncio.run(db.attendance.insert_one({"team_id": "femenino", "date": other, "user_id": me, "status": "going"}))
    asyncio.run(honors.give_coins(db, me, 5, "attendance", "Voy al entreno", f"attendance:femenino:{other}:{me}"))
    assert coins(ana)["balance"] == attendance.ATTENDANCE_COINS * 2
    # Mirarlo otra vez no suma más.
    assert coins(ana)["balance"] == attendance.ATTENDANCE_COINS * 2


def test_el_ranking_dice_lo_que_se_gana_por_puesto(admin):  # noqa: F811
    prizes = admin.get("/api/ranking/honors?group_id=masculino").json()["prizes"]
    assert prizes["week"] == [{"place": 1, "coins": 100}, {"place": 2, "coins": 60}, {"place": 3, "coins": 40}]
    assert [prize["coins"] for prize in prizes["month"]] == [250, 150, 100]


def test_ficha_del_jugador_con_titulos_y_ranking(admin, db):  # noqa: F811
    ana = member(admin)
    luis = member(admin, "token-luis")
    rate_ok(admin, player_of(db, ana), scores(9))
    rate_ok(admin, player_of(db, luis), scores(6))
    publish_ok(admin)
    # La ve cualquiera del club, no solo los entrenadores.
    profile = luis.get(f"/api/players/{player_of(db, ana)}/profile")
    assert profile.status_code == 200, profile.text
    data = profile.json()
    assert data["player"]["name"] == "Ana" and data["counts"]["week_wins"] == 1
    assert data["titles"][0]["title"] == "Jugador de la semana" or data["titles"][0]["place"] == 1
    assert data["ranking"]["rank"] == 1 and data["ranking"]["of"] == 2
    assert luis.get("/api/players/nadie/profile").status_code == 404
