import pytest

import live
import matches
from test_auth import client_for, db  # noqa: F401
from test_matches import create as create_match
from test_matches import member


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    monkeypatch.setattr(live, "_indexes_ready", False)
    monkeypatch.setattr(matches, "_indexes_ready", False)


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def add_player(admin, name, number, team="masculino"):
    response = admin.post("/api/players", json={"team_id": team, "name": name, "position": "Receptor", "number": number})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def start(admin, lineup, **extra):
    response = admin.post("/api/live", json={"team_id": "masculino", "opponent": "CV Roquetas", "lineup": lineup, **extra})
    assert response.status_code == 201, response.text
    return response.json()


def event(client, live_id, **body):
    return client.post(f"/api/live/{live_id}/events", json=body)


def points(client, live_id, side, count):
    state = None
    for _ in range(count):
        response = event(client, live_id, type="point", side=side)
        assert response.status_code == 200, response.text
        state = response.json()
    return state


def test_marcador_punto_a_punto_y_quien_saca(admin):
    ana = add_player(admin, "Ana", 7)
    game = start(admin, [ana], first_serve="them")
    assert game["serving"] == "them" and game["set_number"] == 1 and game["can_score"] is True
    state = points(admin, game["id"], "us", 2)
    assert state["current"] == {"us": 2, "them": 0} and state["serving"] == "us"
    state = event(admin, game["id"], type="point", side="them").json()
    assert state["current"] == {"us": 2, "them": 1} and state["serving"] == "them"


def test_el_set_acaba_a_25_con_dos_de_ventaja(admin):
    game = start(admin, [add_player(admin, "Ana", 7)])
    points(admin, game["id"], "us", 24)
    state = points(admin, game["id"], "them", 24)
    assert state["current"] == {"us": 24, "them": 24} and state["sets"] == []
    state = points(admin, game["id"], "us", 1)
    assert state["sets"] == []
    state = points(admin, game["id"], "us", 1)
    assert state["sets"] == [{"us": 26, "them": 24}] and state["won"] == {"us": 1, "them": 0}
    assert state["current"] == {"us": 0, "them": 0} and state["set_number"] == 2


def test_a_dos_sets_el_tercero_es_a_15_y_luego_no_se_puntua(admin):
    game = start(admin, [add_player(admin, "Ana", 7)], best_of=3)
    points(admin, game["id"], "us", 25)
    points(admin, game["id"], "them", 25)
    state = points(admin, game["id"], "us", 15)
    assert state["finished"] is True and state["winner"] == "us" and state["won"] == {"us": 2, "them": 1}
    assert state["sets"][-1] == {"us": 15, "them": 0}
    assert event(admin, game["id"], type="point", side="us").status_code == 409


def test_aciertos_y_fallos_de_jugador_y_de_equipo(admin):
    ana = add_player(admin, "Ana", 7)
    game = start(admin, [ana])
    state = event(admin, game["id"], type="stat", player_id=ana, result="good", skill="ataque", point="us").json()
    assert state["current"]["us"] == 1 and state["stats"][ana] == {"good": 1, "bad": 0, "points": 1, "errors": 0}
    state = event(admin, game["id"], type="stat", player_id=ana, result="bad", skill="recepcion", point="them").json()
    assert state["current"] == {"us": 1, "them": 1} and state["stats"][ana]["errors"] == 1
    state = event(admin, game["id"], type="stat", result="good").json()
    assert state["team_stats"] == {"good": 1, "bad": 0} and state["current"] == {"us": 1, "them": 1}
    # Deshacer quita la última acción.
    state = admin.delete(f"/api/live/{game['id']}/events/last").json()
    assert state["team_stats"] == {"good": 0, "bad": 0}
    otro = add_player(admin, "Otro", 9)
    assert event(admin, game["id"], type="stat", player_id=otro, result="good").status_code == 422


def test_tiempos_muertos_dos_por_set(admin):
    game = start(admin, [add_player(admin, "Ana", 7)])
    assert event(admin, game["id"], type="timeout", side="us").json()["timeouts"]["us"] == 1
    assert event(admin, game["id"], type="timeout", side="us").status_code == 200
    assert event(admin, game["id"], type="timeout", side="us").status_code == 422


def test_acciones_mal_formadas(admin):
    game = start(admin, [add_player(admin, "Ana", 7)])
    assert event(admin, game["id"], type="point").status_code == 422
    assert event(admin, game["id"], type="stat").status_code == 422
    assert event(admin, game["id"], type="point", side="us", result="good").status_code == 422


def test_los_jugadores_lo_ven_pero_no_puntuan(admin):
    game = start(admin, [add_player(admin, "Ana", 7)])
    ana = member(admin)
    seen = ana.get(f"/api/live/{game['id']}")
    assert seen.status_code == 200 and seen.json()["can_score"] is False
    assert event(ana, game["id"], type="point", side="us").status_code == 403
    assert ana.post("/api/live", json={"team_id": "masculino", "opponent": "X", "lineup": ["a"]}).status_code == 403
    listed = ana.get("/api/live?team_id=masculino").json()
    assert [item["id"] for item in listed["live"]] == [game["id"]] and listed["can_create"] is False


def test_solo_jugadores_del_equipo_en_la_plantilla(admin):
    other = add_player(admin, "Laura", 4, team="femenino")
    response = admin.post("/api/live", json={"team_id": "masculino", "opponent": "X", "lineup": [other]})
    assert response.status_code == 422


def test_al_terminar_se_guarda_el_resultado_en_el_partido(admin):
    match_id = create_match(admin).json()["id"]
    game = start(admin, [add_player(admin, "Ana", 7)], match_id=match_id, best_of=3)
    points(admin, game["id"], "us", 25)
    points(admin, game["id"], "us", 25)
    finished = admin.post(f"/api/live/{game['id']}/finish")
    assert finished.status_code == 200 and finished.json()["status"] == "finished" and finished.json()["mvp"] is None
    saved = admin.get("/api/matches/played?team_id=masculino").json()
    assert saved[0]["sets"] == [{"us": 25, "them": 0}, {"us": 25, "them": 0}]
    assert event(admin, game["id"], type="point", side="us").status_code == 409
    listed = admin.get("/api/live?team_id=masculino").json()
    assert listed["live"] == [] and listed["finished"][0]["won"] == {"us": 2, "them": 0}


def test_entrar_al_partido_de_hoy_con_los_que_van(admin):
    match_id = create_match(admin).json()["id"]
    ana = member(admin)
    luis = member(admin, "token-luis")
    ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"})
    luis.put(f"/api/matches/{match_id}/answer", json={"status": "not_going"})
    # Un jugador no puede abrirlo si aún no existe.
    assert ana.post(f"/api/live/match/{match_id}").status_code == 403
    game = admin.post(f"/api/live/match/{match_id}")
    assert game.status_code == 200, game.text
    game = game.json()
    assert [item["name"] for item in game["lineup"]] == ["Ana"] and game["match_id"] == match_id
    # Entrar otra vez abre el mismo; y ahora el jugador también lo ve.
    assert admin.post(f"/api/live/match/{match_id}").json()["id"] == game["id"]
    assert ana.post(f"/api/live/match/{match_id}").json()["id"] == game["id"]
    ana_id = game["lineup"][0]["player_id"]
    # Entrar no lo empieza: hasta darle a «Empezar partido» no se apunta nada.
    assert game["status"] == "pending" and game["can_start"] is True and game["can_score"] is False
    assert event(admin, game["id"], type="point", side="us").status_code == 409
    assert admin.get("/api/live?team_id=masculino").json()["live"] == []
    assert ana.post(f"/api/live/{game['id']}/start").status_code == 403
    started = admin.post(f"/api/live/{game['id']}/start").json()
    assert started["status"] == "live" and started["can_score"] is True
    assert event(admin, game["id"], type="stat", player_id=ana_id, result="good", skill="ataque", point="us").status_code == 200
    # Si luego dice que no va, sigue en la plantilla porque ya tiene acciones.
    luis.put(f"/api/matches/{match_id}/answer", json={"status": "going"})
    ana.put(f"/api/matches/{match_id}/answer", json={"status": "not_going"})
    names = sorted(item["name"] for item in admin.get(f"/api/live/{game['id']}").json()["lineup"])
    assert names == ["Ana", "Luis"]
    shown = admin.get("/api/matches?team_id=masculino").json()[0]
    assert shown["live"]["id"] == game["id"] and shown["live"]["current"] == {"us": 1, "them": 0} and shown["is_today"] is True


def test_solo_el_dia_del_partido(admin):
    match_id = create_match(admin, date=__import__("test_matches").day(1)).json()["id"]
    assert admin.post(f"/api/live/match/{match_id}").status_code == 422


def test_el_entrenador_elige_mvp_y_gana_coins(admin):
    match_id = create_match(admin).json()["id"]
    ana = member(admin)
    ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"})
    game = admin.post(f"/api/live/match/{match_id}").json()
    admin.post(f"/api/live/{game['id']}/start")
    ana_id = game["lineup"][0]["player_id"]
    points(admin, game["id"], "us", 25)
    before = ana.get("/api/coins").json()["balance"]
    assert admin.post(f"/api/live/{game['id']}/finish", json={"mvp_player_id": "nadie"}).status_code == 422
    finished = admin.post(f"/api/live/{game['id']}/finish", json={"mvp_player_id": ana_id})
    assert finished.status_code == 200 and finished.json()["mvp"]["name"] == "Ana"
    coins = ana.get("/api/coins").json()
    assert coins["balance"] == before + live.MVP_COINS
    assert coins["honors"][0]["title"] == "MVP contra CV Roquetas" and coins["crown"] is None
    played = admin.get("/api/matches/played?team_id=masculino").json()
    assert played[0]["mvp"] == "Ana" and played[0]["sets"] == [{"us": 25, "them": 0}]


def test_uno_abierto_antes_sin_nada_apuntado_vuelve_a_estar_sin_empezar(admin, db):  # noqa: F811
    import asyncio

    match_id = create_match(admin).json()["id"]
    game = admin.post(f"/api/live/match/{match_id}").json()
    # Así se guardaban antes al entrar: "en directo" sin haber empezado.
    asyncio.run(db.live_matches.update_one({"id": game["id"]}, {"$set": {"status": "live"}}))
    assert admin.get(f"/api/live/{game['id']}").json()["status"] == "pending"
    assert admin.get("/api/matches?team_id=masculino").json()[0]["live"]["status"] == "pending"


def test_si_ganan_cada_uno_gana_coins(admin):
    match_id = create_match(admin).json()["id"]
    ana = member(admin)
    ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"})
    game = admin.post(f"/api/live/match/{match_id}").json()
    admin.post(f"/api/live/{game['id']}/start")
    before = ana.get("/api/coins").json()["balance"]
    points(admin, game["id"], "us", 25)
    points(admin, game["id"], "us", 25)
    points(admin, game["id"], "us", 25)
    assert admin.post(f"/api/live/{game['id']}/finish").status_code == 200
    coins = ana.get("/api/coins").json()
    assert coins["balance"] == before + live.WIN_COINS
    assert coins["entries"][0]["label"] == "Victoria contra CV Roquetas"
    # Terminarlo otra vez no da más.
    admin.post(f"/api/live/{game['id']}/finish")
    assert ana.get("/api/coins").json()["balance"] == before + live.WIN_COINS


def test_si_pierden_no_hay_coins_de_victoria(admin):
    match_id = create_match(admin).json()["id"]
    ana = member(admin)
    ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"})
    game = admin.post(f"/api/live/match/{match_id}").json()
    admin.post(f"/api/live/{game['id']}/start")
    before = ana.get("/api/coins").json()["balance"]
    for _ in range(3):
        points(admin, game["id"], "them", 25)
    admin.post(f"/api/live/{game['id']}/finish")
    assert ana.get("/api/coins").json()["balance"] == before


def test_cambiar_de_sitio_arrastrando(admin):
    ana = add_player(admin, "Ana", 7)
    luis = add_player(admin, "Luis", 8)
    eva = add_player(admin, "Eva", 9)
    game = start(admin, [ana, luis, eva])
    changed = admin.put(f"/api/live/{game['id']}/order", json={"order": [eva, ana, luis]})
    assert changed.status_code == 200, changed.text
    assert [item["name"] for item in changed.json()["lineup"]] == ["Eva", "Ana", "Luis"]
    assert [item["name"] for item in admin.get(f"/api/live/{game['id']}").json()["lineup"]] == ["Eva", "Ana", "Luis"]
    jugador = client_for("token-ana")
    assert jugador.put(f"/api/live/{game['id']}/order", json={"order": [ana]}).status_code in (403, 401)


def test_informe_al_terminar(admin):
    ana = add_player(admin, "Ana", 7)
    luis = add_player(admin, "Luis", 8)
    game = start(admin, [ana, luis], best_of=3)
    live_id = game["id"]
    assert game["report"] is None
    event(admin, live_id, type="stat", player_id=ana, result="good", skill="ataque", point="us")
    event(admin, live_id, type="stat", player_id=ana, result="good", skill="ataque", point="us")
    event(admin, live_id, type="stat", player_id=luis, result="bad", skill="recepcion", point="them")
    event(admin, live_id, type="stat", player_id=luis, result="good", skill="defensa")
    points(admin, live_id, "us", 23)
    points(admin, live_id, "us", 25)
    report = admin.post(f"/api/live/{live_id}/finish").json()["report"]
    assert [(item["us"], item["them"]) for item in report["sets"]] == [(25, 1), (25, 0)]
    assert report["origin"]["us_by_us"] == 2 and report["origin"]["them_by_us"] == 1
    assert report["players"][0]["name"] == "Ana" and report["players"][0]["points"] == 2
    assert report["players"][1]["name"] == "Luis" and report["players"][1]["percent"] == 50
    attack = next(item for item in report["skills"] if item["skill"] == "ataque")
    assert attack["best"]["name"] == "Ana" and attack["percent"] == 100 and attack["worst"] is None
    reception = next(item for item in report["skills"] if item["skill"] == "recepcion")
    assert reception["worst"]["name"] == "Luis"
    assert report["runs"]["us"] == 25
