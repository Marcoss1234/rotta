import pytest

import boards
from test_auth import client_for, db  # noqa: F401


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    monkeypatch.setattr(boards, "_indexes_ready", False)


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def member(admin, token="token-ana", role="jugador", team="masculino", **extra):
    client = client_for(token)
    user_id = client.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{user_id}", json={"status": "approved", "role": role, "team_id": team, **extra})
    assert response.status_code == 200, response.text
    return client


TOKEN = {"id": "a", "type": "token", "x": 0.2, "y": 0.7, "side": "home", "label": "7", "name": "Ana"}
ARROW = {"id": "b", "type": "arrow", "x1": 0.1, "y1": 0.2, "x2": 0.5, "y2": 0.4, "style": "pass"}


def body(**extra):
    return {"team_id": "masculino", "name": "Saque flotante", "kind": "saque", "steps": [{"elements": [TOKEN, ARROW]}], **extra}


def create(client, **extra):
    response = client.post("/api/boards", json=body(**extra))
    assert response.status_code == 201, response.text
    return response.json()


def content(**extra):
    return {key: value for key, value in body(**extra).items() if key != "team_id"}


def listing(client, team="masculino"):
    response = client.get(f"/api/boards?team_id={team}")
    assert response.status_code == 200, response.text
    return response.json()


def test_guarda_todos_los_elementos_tal_cual(admin):
    elements = [
        TOKEN,
        ARROW,
        {"id": "c", "type": "ball", "x": 0.5, "y": 0.5},
        {"id": "d", "type": "zone", "x": 0.1, "y": 0.1, "w": 0.3, "h": 0.2},
        {"id": "e", "type": "text", "x": 0.2, "y": 0.3, "text": "Cubrir aquí"},
        {"id": "f", "type": "stroke", "points": [[0.1, 0.1], [0.2, 0.2]]},
    ]
    board = create(admin, steps=[{"elements": elements}])
    saved = admin.get(f"/api/boards/{board['id']}").json()["steps"][0]["elements"]
    assert [item["type"] for item in saved] == ["token", "arrow", "ball", "zone", "text", "stroke"]
    assert saved[0]["name"] == "Ana"
    assert saved[5]["points"] == [[0.1, 0.1], [0.2, 0.2]]


def test_cada_ficha_guarda_su_posicion_en_la_jugada(admin):
    board = create(admin, steps=[{"elements": [{**TOKEN, "position": "Opuesto"}, {**TOKEN, "id": "z"}]}])
    saved = admin.get(f"/api/boards/{board['id']}").json()["steps"][0]["elements"]
    assert [item["position"] for item in saved] == ["Opuesto", None]


def test_posicion_inexistente_no_vale(admin):
    assert admin.post("/api/boards", json=body(steps=[{"elements": [{**TOKEN, "position": "Portero"}]}])).status_code == 422


RECORDING = {"duration_ms": 900, "tracks": [{"id": "a", "points": [[0, 0.2, 0.7], [450, 0.3, 0.6], [900, 0.4, 0.5]]}]}


def test_guarda_y_borra_la_grabacion(admin):
    board = create(admin, recording=RECORDING)
    assert admin.get(f"/api/boards/{board['id']}").json()["recording"]["duration_ms"] == 900
    assert admin.get(f"/api/boards/{board['id']}").json()["recording"]["tracks"][0]["points"][1] == [450, 0.3, 0.6]
    assert admin.put(f"/api/boards/{board['id']}", json=content(recording=None)).status_code == 200
    assert admin.get(f"/api/boards/{board['id']}").json()["recording"] is None


def test_la_jugada_por_pasos_guarda_sus_pasos(admin):
    plan = [
        {"playerId": "a", "action": "saque", "target": {"x": 0.5, "y": 0.2}, "moves": [{"playerId": "a", "target": {"x": 0.3, "y": 0.8}}]},
        {"playerId": "a", "action": "colocacion", "tempo": "1", "target": None, "moves": []},
    ]
    board = create(admin, recording={**RECORDING, "plan": plan})
    saved = admin.get(f"/api/boards/{board['id']}").json()["recording"]["plan"]
    assert saved[0]["target"] == {"x": 0.5, "y": 0.2} and saved[1]["tempo"] == "1" and saved[1]["target"] is None
    bad = admin.post("/api/boards", json=body(recording={**RECORDING, "plan": [{"playerId": "a", "action": "volar"}]}))
    assert bad.status_code == 422


def test_los_jugadores_ven_la_grabacion_publicada(admin):
    ana = member(admin)
    board = create(admin, published=True, recording=RECORDING)
    assert ana.get(f"/api/boards/{board['id']}").json()["recording"]["tracks"][0]["id"] == "a"


def test_una_jugada_antigua_no_tiene_grabacion(admin, db):  # noqa: F811
    import asyncio

    board = create(admin)
    asyncio.run(db.boards.update_one({"id": board["id"]}, {"$unset": {"recording": ""}}))
    assert admin.get(f"/api/boards/{board['id']}").json()["recording"] is None


@pytest.mark.parametrize(
    "recording",
    [
        {"duration_ms": 0, "tracks": RECORDING["tracks"]},
        {"duration_ms": boards.MAX_RECORDING_MS + 1, "tracks": RECORDING["tracks"]},
        {"duration_ms": 900, "tracks": []},
        {"duration_ms": 900, "tracks": [{"id": "a", "points": []}]},
        {"duration_ms": 900, "tracks": [{"id": "a", "points": [[0, 2, 0.5]]}]},
        {"duration_ms": 900, "tracks": [{"id": "a", "points": [[500, 0.1, 0.5], [100, 0.1, 0.5]]}]},
    ],
)
def test_grabacion_no_valida(admin, recording):
    assert admin.post("/api/boards", json=body(recording=recording)).status_code == 422


def test_el_borrador_no_lo_ven_los_jugadores(admin):
    ana = member(admin)
    board = create(admin)
    assert listing(ana) == {"can_edit": False, "can_create": True, "boards": []}
    assert ana.get(f"/api/boards/{board['id']}").status_code == 404


def test_publicada_la_ven_pero_no_la_cambian(admin):
    ana = member(admin)
    board = create(admin, published=True)
    seen = listing(ana)["boards"]
    assert [item["id"] for item in seen] == [board["id"]]
    assert seen[0]["can_edit"] is False
    assert ana.put(f"/api/boards/{board['id']}", json=content()).status_code == 403
    assert ana.delete(f"/api/boards/{board['id']}").status_code == 403


def test_el_entrenador_solo_edita_sus_equipos(admin):
    coach = member(admin, role="entrenador", team="femenino", coached_team_ids=["masculino"])
    assert coach.post("/api/boards", json=body()).status_code == 201
    assert coach.post("/api/boards", json=body(team_id="femenino")).status_code == 201
    assert coach.post("/api/boards", json=body(team_id="playa")).status_code == 403
    other = create(admin, team_id="playa")
    assert coach.get(f"/api/boards/{other['id']}").status_code == 404
    assert coach.put(f"/api/boards/{other['id']}", json=content()).status_code == 404


def test_otro_equipo_y_familias_no_entran(admin):
    other = member(admin, team="femenino")
    family = member(admin, "token-luis", role="familia")
    board = create(admin, published=True)
    assert other.get("/api/boards?team_id=masculino").status_code == 403
    assert other.get(f"/api/boards/{board['id']}").status_code == 404
    assert family.get("/api/boards?team_id=masculino").status_code == 403
    assert family.get(f"/api/boards/{board['id']}").status_code == 404


def test_sin_acceso_no_hay_nada(db):  # noqa: F811
    assert client_for("token-ana").get("/api/boards?team_id=masculino").status_code == 403


def test_actualizar_y_borrar(admin):
    board = create(admin)
    updated = admin.put(f"/api/boards/{board['id']}", json=content(name="Otra", court="half", published=True, steps=[{"elements": []}]))
    assert updated.status_code == 200, updated.text
    assert (updated.json()["name"], updated.json()["court"], updated.json()["published"]) == ("Otra", "half", True)
    assert updated.json()["team_id"] == "masculino"
    assert admin.delete(f"/api/boards/{board['id']}").status_code == 204
    assert admin.get(f"/api/boards/{board['id']}").status_code == 404


def test_la_ultima_modificada_sale_primero(admin):
    first = create(admin, name="Primera")
    create(admin, name="Segunda")
    admin.put(f"/api/boards/{first['id']}", json=content(name="Primera"))
    assert [item["name"] for item in listing(admin)["boards"]] == ["Primera", "Segunda"]


def test_cada_equipo_tiene_sus_jugadas(admin):
    create(admin, team_id="femenino")
    assert listing(admin)["boards"] == []


@pytest.mark.parametrize(
    "steps",
    [
        [],
        [{"elements": [{**TOKEN, "x": 1.5}]}],
        [{"elements": [{"id": "x", "type": "bomba", "x": 0.1, "y": 0.1}]}],
        [{"elements": [{**TOKEN, "extra": "no"}]}],
        [{"elements": [{"id": "x", "type": "stroke", "points": [[0.1, 0.1]]}]}],
        [{"elements": [{"id": "x", "type": "text", "x": 0.1, "y": 0.1, "text": "   "}]}],
        [{"elements": [TOKEN] * (boards.MAX_ELEMENTS + 1)}],
        [{"elements": []}] * (boards.MAX_STEPS + 1),
    ],
)
def test_contenido_no_valido(admin, steps):
    assert admin.post("/api/boards", json=body(steps=steps)).status_code == 422


def test_no_se_admite_demasiado_dibujo(admin, monkeypatch):
    monkeypatch.setattr(boards, "MAX_BOARD_POINTS", 3)
    stroke = {"id": "x", "type": "stroke", "points": [[0.1, 0.1], [0.2, 0.2]]}
    assert admin.post("/api/boards", json=body(steps=[{"elements": [stroke, {**stroke, "id": "y"}]}])).status_code == 422


def test_nombre_vacio_no_vale(admin):
    assert admin.post("/api/boards", json=body(name="   ")).status_code == 422


def lineup(team="masculino", name="Alineación 1", tokens=None):
    tokens = tokens if tokens is not None else [
        {**TOKEN, "id": "t1", "player_id": "p1"},
        {**TOKEN, "id": "t2", "player_id": "p2", "x": 0.8},
    ]
    return {"team_id": team, "name": name, "tokens": tokens}


def test_guardar_y_poner_alineaciones(admin):
    first = admin.post("/api/board-lineups", json=lineup())
    assert first.status_code == 201, first.text
    second = admin.post("/api/board-lineups", json=lineup(name="Alineación 2")).json()
    listed = admin.get("/api/board-lineups?team_id=masculino").json()
    # La última guardada sale arriba.
    assert [item["name"] for item in listed] == ["Alineación 2", "Alineación 1"]
    assert [token["player_id"] for token in listed[0]["tokens"]] == ["p1", "p2"]
    assert admin.get("/api/board-lineups?team_id=femenino").json() == []
    assert admin.delete(f"/api/board-lineups/{second['id']}").status_code == 204
    assert [item["name"] for item in admin.get("/api/board-lineups?team_id=masculino").json()] == ["Alineación 1"]


@pytest.mark.parametrize(
    "tokens",
    [
        [],
        [{**TOKEN, "player_id": None}],
        [{**TOKEN, "side": "rival", "player_id": "p1"}],
        [{**TOKEN, "id": "t1", "player_id": "p1"}, {**TOKEN, "id": "t2", "player_id": "p1"}],
    ],
)
def test_alineacion_no_valida(admin, tokens):
    assert admin.post("/api/board-lineups", json=lineup(tokens=tokens)).status_code == 422


def test_solo_los_entrenadores_del_equipo(admin):
    saved = admin.post("/api/board-lineups", json=lineup()).json()
    player = member(admin)
    coach = member(admin, "token-luis", role="entrenador", team="femenino")
    for client in (player, coach):
        assert client.get("/api/board-lineups?team_id=masculino").status_code == 403
        assert client.post("/api/board-lineups", json=lineup()).status_code == 403
        assert client.delete(f"/api/board-lineups/{saved['id']}").status_code == 404
    assert coach.post("/api/board-lineups", json=lineup(team="femenino")).status_code == 201


def test_limite_de_alineaciones(admin, monkeypatch):
    monkeypatch.setattr(boards, "MAX_LINEUPS", 2)
    for _ in range(2):
        assert admin.post("/api/board-lineups", json=lineup()).status_code == 201
    assert admin.post("/api/board-lineups", json=lineup()).status_code == 422


def test_cambiar_el_nombre(admin):
    saved = admin.post("/api/board-lineups", json=lineup()).json()
    renamed = admin.patch(f"/api/board-lineups/{saved['id']}", json={"name": "  Recepción en W  "})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Recepción en W"
    assert admin.get("/api/board-lineups?team_id=masculino").json()[0]["name"] == "Recepción en W"
    assert admin.patch(f"/api/board-lineups/{saved['id']}", json={"name": "   "}).status_code == 422
    assert admin.patch("/api/board-lineups/no-existe", json={"name": "X"}).status_code == 404
    coach = member(admin, "token-luis", role="entrenador", team="femenino")
    assert coach.patch(f"/api/board-lineups/{saved['id']}", json={"name": "Mía"}).status_code == 404


def test_marca_de_atacante(admin):
    board = create(admin, steps=[{"elements": [{**TOKEN, "highlight": True}, ARROW]}])
    assert board["steps"][0]["elements"][0]["highlight"] is True
    plain = create(admin)
    assert plain["steps"][0]["elements"][0]["highlight"] is False


def test_acciones_de_los_jugadores(admin):
    actions = [{"id": "a", "t": 300, "action": "remate"}, {"id": "a", "t": 800, "action": "bloqueo"}]
    board = create(admin, recording={**RECORDING, "actions": actions})
    assert board["recording"]["actions"] == actions
    only_actions = create(admin, recording={"duration_ms": 900, "tracks": [], "actions": actions[:1]})
    assert only_actions["recording"]["tracks"] == []
    assert create(admin, recording=RECORDING)["recording"]["actions"] == []


@pytest.mark.parametrize("action", [{"id": "a", "t": 300, "action": "bailar"}, {"id": "a", "t": -1, "action": "remate"}, {"id": "a", "t": 300, "action": "colocacion", "tempo": "4"}, {"id": "a", "t": 300, "action": "remate", "tempo": "1"}])
def test_acciones_no_validas(admin, action):
    response = admin.post("/api/boards", json=body(recording={**RECORDING, "actions": [action]}))
    assert response.status_code == 422


def test_colocacion_con_tiempo(admin):
    actions = [{"id": "a", "t": 300, "action": "colocacion", "tempo": tempo} for tempo in ("3", "2", "1", "menos")]
    actions.append({"id": "a", "t": 900, "action": "colocacion"})
    board = create(admin, recording={**RECORDING, "actions": actions})
    assert board["recording"]["actions"] == actions


def test_el_jugador_se_hace_sus_propias_jugadas(admin):
    ana = member(admin)
    response = ana.post("/api/boards", json=body(published=True))
    assert response.status_code == 201, response.text
    mine = response.json()
    assert mine["private"] is True and mine["published"] is False and mine["can_edit"] is True
    # La cambia y la borra él; aunque pida publicarla, sigue sin publicar.
    updated = ana.put(f"/api/boards/{mine['id']}", json=content(name="Mía", published=True))
    assert updated.status_code == 200, updated.text
    assert updated.json()["published"] is False
    assert [item["id"] for item in listing(ana)["boards"]] == [mine["id"]]
    assert ana.delete(f"/api/boards/{mine['id']}").status_code == 204


def test_la_jugada_de_un_jugador_no_la_ve_nadie_mas(admin):
    ana = member(admin)
    mine = ana.post("/api/boards", json=body()).json()
    luis = member(admin, "token-luis")
    assert luis.get(f"/api/boards/{mine['id']}").status_code == 404
    assert luis.put(f"/api/boards/{mine['id']}", json=content()).status_code == 404
    assert [item["id"] for item in listing(luis)["boards"]] == []
    # Ni el entrenador ni el administrador la ven en la lista del equipo.
    assert all(item["id"] != mine["id"] for item in listing(admin)["boards"])
    assert admin.get(f"/api/boards/{mine['id']}").status_code == 404


def test_el_jugador_solo_en_su_equipo_y_las_familias_no(admin):
    ana = member(admin)
    assert ana.post("/api/boards", json=body(team_id="femenino")).status_code == 403
    family = member(admin, "token-luis", role="familia")
    assert family.post("/api/boards", json=body()).status_code == 403


def test_limite_de_jugadas_propias(admin, monkeypatch):
    monkeypatch.setattr(boards, "MAX_PRIVATE_BOARDS", 2)
    ana = member(admin)
    assert ana.post("/api/boards", json=body()).status_code == 201
    assert ana.post("/api/boards", json=body()).status_code == 201
    assert ana.post("/api/boards", json=body()).status_code == 422


def test_las_jugadas_del_equipo_siguen_siendo_del_entrenador(admin):
    board = create(admin)
    assert board["private"] is False
    ana = member(admin)
    assert ana.get(f"/api/boards/{board['id']}").status_code == 404


def test_entrenador_en_la_pizarra_con_free_y_fuerte(admin):
    coach = {"id": "e", "type": "token", "x": 0.5, "y": 0.2, "side": "coach", "label": "DA", "name": "David", "player_id": "coach-x"}
    recording = {
        "duration_ms": 2000,
        "tracks": [{"id": "e", "points": [[0, 0.5, 0.2]]}],
        "actions": [{"id": "e", "t": 0, "action": "free"}, {"id": "e", "t": 1000, "action": "fuerte"}],
    }
    board = create(admin, steps=[{"elements": [coach, TOKEN]}], recording=recording)
    saved = admin.get(f"/api/boards/{board['id']}").json()
    assert saved["steps"][0]["elements"][0]["side"] == "coach"
    assert [item["action"] for item in saved["recording"]["actions"]] == ["free", "fuerte"]


def test_conos_y_cajones_en_la_pizarra(admin):
    cone = {"id": "c", "type": "prop", "kind": "cone", "x": 0.3, "y": 0.7}
    box = {"id": "b", "type": "prop", "kind": "box", "x": 0.5, "y": 0.2}
    board = create(admin, steps=[{"elements": [cone, box, TOKEN]}])
    saved = admin.get(f"/api/boards/{board['id']}").json()
    assert [item.get("kind") for item in saved["steps"][0]["elements"][:2]] == ["cone", "box"]
    wrong = {**cone, "kind": "silla"}
    assert admin.post("/api/boards", json=body(steps=[{"elements": [wrong]}])).status_code == 422


def test_ejercicio_en_fila_guarda_vuelve_a_la_fila(admin):
    recording = {
        "duration_ms": 2000,
        "tracks": [{"id": "e", "points": [[0, 0.5, 0.2]]}],
        "plan": [{"playerId": "e", "action": "colocacion", "target": {"x": 0.2, "y": 0.6}, "back": True, "fresh": True}],
    }
    coach = {"id": "e", "type": "token", "x": 0.5, "y": 0.2, "side": "home", "label": "1", "name": "Ana", "line": "fila1"}
    board = create(admin, steps=[{"elements": [coach]}], recording=recording)
    saved = admin.get(f"/api/boards/{board['id']}").json()
    assert saved["recording"]["plan"][0]["back"] is True and saved["recording"]["plan"][0]["fresh"] is True
    assert saved["steps"][0]["elements"][0]["line"] == "fila1"


def test_lista_de_entrenadores_para_la_pizarra(admin):
    coach = member(admin, token="token-luis", role="entrenador")
    coach.put("/api/profile/character", json={})  # Sin personaje guardado también sale.
    listed = admin.get("/api/coaches").json()
    assert [item["name"] for item in listed] == ["Luis"]
    assert listed[0]["id"].startswith("coach-") and listed[0]["team_id"] == "entrenadores" and listed[0]["coach"] is True


def test_fila_al_rematar(admin):
    token = {"id": "d", "type": "token", "x": 0.2, "y": 0.6, "side": "home", "label": "1", "name": "Dani", "line": "fila1", "line_rule": "remate"}
    board = create(admin, steps=[{"elements": [token]}])
    saved = admin.get(f"/api/boards/{board['id']}").json()
    assert saved["steps"][0]["elements"][0]["line_rule"] == "remate"
    wrong = {**token, "line_rule": "saque"}
    assert admin.post("/api/boards", json=body(steps=[{"elements": [wrong]}])).status_code == 422
