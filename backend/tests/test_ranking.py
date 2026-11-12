import asyncio
from datetime import timedelta

import pytest

import ranking
from test_auth import client_for, db  # noqa: F401


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    monkeypatch.setattr(ranking, "_indexes_ready", False)


COACHED = ["masculino", "femenino", "escuela-lm", "escuela-mj"]


def set_coached(client, teams):
    me = client.get("/api/auth/me").json()["id"]
    response = client.patch(f"/api/users/{me}", json={"coached_team_ids": teams})
    assert response.status_code == 200, response.text


# Para puntuar hay que entrenar el equipo, también siendo administrador.
@pytest.fixture
def admin(db):  # noqa: F811
    client = client_for("token-admin")
    set_coached(client, COACHED)
    return client


def member(admin, token="token-ana", role="jugador", team="masculino", coached=None):
    client = client_for(token)
    me = client.get("/api/auth/me").json()
    body = {"status": "approved", "role": role, "team_id": team}
    if coached is not None:
        body["coached_team_ids"] = coached
    response = admin.patch(f"/api/users/{me['id']}", json=body)
    assert response.status_code == 200, response.text
    return client


def week(offset=0):
    return (ranking._current_monday() - timedelta(weeks=offset)).isoformat()


def add_player(admin, name, position="Receptor", team="masculino"):
    response = admin.post("/api/players", json={"team_id": team, "name": name, "position": position})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def rate(client, player_id, scores, position="Receptor", offset=0, group="masculino", comment=""):
    return client.put(
        "/api/ranking/ratings",
        json={
            "group_id": group,
            "week": week(offset),
            "player_id": player_id,
            "position": position,
            "scores": scores,
            "comment": comment,
        },
    )


def rate_ok(client, *args, **kwargs):
    response = rate(client, *args, **kwargs)
    assert response.status_code == 200, response.text
    return response.json()["rating"]


def publish(client, offset=0, group="masculino"):
    return client.post("/api/ranking/publish", json={"group_id": group, "week": week(offset)})


def publish_ok(client, *args, **kwargs):
    response = publish(client, *args, **kwargs)
    assert response.status_code == 200, response.text


def table(client, group="masculino"):
    response = client.get(f"/api/ranking?group_id={group}")
    assert response.status_code == 200, response.text
    return response.json()


ALL_EIGHT = {skill["id"]: 8 for skill in ranking.SKILLS}


def test_cada_posicion_suma_cien():
    for position, weights in ranking.WEIGHTS.items():
        if position != "Sin definir":
            assert sum(weights.values()) == 100, position


def test_el_colocador_depende_sobre_todo_de_la_colocacion():
    scores = {"saque": 6, "recepcion": 5, "antebrazo": 6, "colocacion": 9, "ataque": 4, "bloqueo": 6}
    assert ranking.overall_of("Colocador", scores) == 75


def test_el_libero_no_arrastra_ceros():
    assert ranking.overall_of("Líbero", {"recepcion": 8.5, "antebrazo": 8, "colocacion": 6}) == 79.2


def test_una_habilidad_sin_nota_reparte_su_peso():
    assert ranking.overall_of("Líbero", {"recepcion": 8, "antebrazo": 8}) == 80


def test_sin_definir_es_la_media():
    assert ranking.overall_of("Sin definir", {"saque": 6, "ataque": 8}) == 70


def test_al_libero_no_se_le_puede_poner_ataque(admin):
    player = add_player(admin, "Lola", "Líbero")
    assert rate(admin, player, {"ataque": 5}, position="Líbero").status_code == 422


@pytest.mark.parametrize("score", [0, 10.5, 7.3])
def test_notas_fuera_de_escala(admin, score):
    assert rate(admin, add_player(admin, "Lola"), {"saque": score}).status_code == 422


def test_comentario_sin_notas_no_vale(admin):
    assert rate(admin, add_player(admin, "Lola"), {}, comment="Bien").status_code == 422


def test_semana_que_no_es_lunes_o_futura(admin):
    player = add_player(admin, "Lola")
    body = {"group_id": "masculino", "player_id": player, "position": "Receptor", "scores": {"saque": 7}}
    martes = (ranking._current_monday() + timedelta(days=1)).isoformat()
    assert admin.put("/api/ranking/ratings", json={**body, "week": martes}).status_code == 422
    assert rate(admin, player, {"saque": 7}, offset=-1).status_code == 422


def test_el_borrador_no_se_ve_hasta_publicar(admin):
    player = add_player(admin, "Lola")
    rate_ok(admin, player, ALL_EIGHT)
    assert table(admin)["entries"] == []
    publish_ok(admin)
    result = table(admin)
    assert result["week"] == week()
    assert [(entry["name"], entry["rank"], entry["overall"]) for entry in result["entries"]] == [("Lola", 1, 80)]


def test_no_se_publica_una_semana_vacia(admin):
    assert publish(admin).status_code == 422


def history(client, player_id, group="masculino"):
    response = client.get(f"/api/ranking/players/{player_id}?group_id={group}")
    assert response.status_code == 200, response.text
    return response.json()["weeks"]


def test_el_jugador_ve_las_notas_de_otros_sin_el_comentario(admin):
    other = add_player(admin, "Lola")
    ana = member(admin)
    rate_ok(admin, other, ALL_EIGHT, comment="Privado")
    publish_ok(admin)
    entry = table(ana)["entries"][0]
    assert "scores" not in entry and "comment" not in entry
    [seen] = history(ana, other)
    assert seen["scores"] == ALL_EIGHT and seen["overall"] == 80
    assert seen["comment"] == ""


def test_el_borrador_de_otro_no_se_ve(admin):
    other = add_player(admin, "Lola")
    ana = member(admin)
    rate_ok(admin, other, ALL_EIGHT)
    assert history(ana, other) == []


def test_el_comentario_solo_lo_ven_sus_entrenadores(admin):
    other = add_player(admin, "Lola")
    rate_ok(admin, other, ALL_EIGHT, comment="Privado")
    publish_ok(admin)
    own_coach = member(admin, "token-ana", role="entrenador", team="masculino")
    other_coach = member(admin, "token-luis", role="entrenador", team="femenino")
    assert history(admin, other)[0]["comment"] == "Privado"
    assert history(own_coach, other)[0]["comment"] == "Privado"
    assert history(other_coach, other)[0]["comment"] == ""


def test_el_jugador_ve_su_ficha_publicada(admin, db):  # noqa: F811
    ana = member(admin)
    me = ana.get("/api/auth/me").json()["id"]
    mine = asyncio.run(db.players.find_one({"user_id": me}))["id"]
    rate_ok(admin, mine, ALL_EIGHT, offset=1, comment="Sigue así")
    publish_ok(admin, offset=1)
    rate_ok(admin, mine, ALL_EIGHT, comment="Aún en borrador")
    assert table(ana)["my_player_id"] == mine
    weeks = ana.get(f"/api/ranking/players/{mine}?group_id=masculino").json()["weeks"]
    assert [(item["week"], item["comment"]) for item in weeks] == [(week(1), "Sigue así")]


def test_el_entrenador_solo_puntua_su_equipo(admin):
    player = add_player(admin, "Lola", team="femenino")
    coach = member(admin, role="entrenador", team="masculino")
    assert rate(coach, player, ALL_EIGHT, group="femenino").status_code == 403
    assert coach.get(f"/api/ranking/sheet?group_id=femenino&week={week()}").status_code == 403


def groups_rated(client):
    return {group["id"] for group in client.get("/api/ranking/groups").json() if group["can_rate"]}


def test_raul_pone_notas_al_femenino_y_al_masculino(admin):
    raul = member(admin, role="entrenador", team="masculino", coached=["femenino"])
    assert groups_rated(raul) == {"masculino", "femenino"}
    assert rate(raul, add_player(admin, "Lola"), ALL_EIGHT).status_code == 200
    assert rate(raul, add_player(admin, "Mar", team="femenino"), ALL_EIGHT, group="femenino").status_code == 200
    assert rate(raul, add_player(admin, "Nino", team="escuela-lm"), ALL_EIGHT, group="escuela").status_code == 403


def test_david_solo_pone_notas_a_la_escuela(admin):
    david = member(admin, role="entrenador", team="escuela-lm", coached=["escuela-mj"])
    assert groups_rated(david) == {"escuela"}
    assert rate(david, add_player(admin, "Nino", team="escuela-mj"), ALL_EIGHT, group="escuela").status_code == 200
    assert rate(david, add_player(admin, "Lola"), ALL_EIGHT).status_code == 403
    assert publish(david).status_code == 403


def test_david_siendo_administrador_tampoco_se_sale_de_la_escuela(admin):
    david = member(admin, role="admin", team="escuela-lm", coached=["escuela-lm", "escuela-mj"])
    assert groups_rated(david) == {"escuela"}
    assert rate(david, add_player(admin, "Lola"), ALL_EIGHT).status_code == 403


@pytest.mark.parametrize("team", ["masculino", None])
def test_ser_administrador_no_da_permiso_para_poner_notas(admin, team):
    other = member(admin, role="admin", team=team, coached=[])
    player = add_player(admin, "Lola")
    assert groups_rated(other) == set()
    assert rate(other, player, ALL_EIGHT).status_code == 403
    assert publish(other).status_code == 403
    assert other.get(f"/api/ranking/sheet?group_id=masculino&week={week()}").status_code == 403


def test_el_administrador_que_no_entrena_ve_el_comentario(admin):
    other = member(admin, role="admin", team="femenino", coached=[])
    player = add_player(admin, "Lola")
    rate_ok(admin, player, ALL_EIGHT, comment="Privado")
    publish_ok(admin)
    assert history(other, player)[0]["comment"] == "Privado"


def test_equipos_que_entrena_cuentan(admin):
    player = add_player(admin, "Lola", team="femenino")
    coach = member(admin, role="entrenador", team="masculino", coached=["femenino"])
    assert rate(coach, player, ALL_EIGHT, group="femenino").status_code == 200
    groups = coach.get("/api/ranking/groups").json()
    assert {group["id"] for group in groups if group["can_rate"]} == {"masculino", "femenino"}


def test_el_jugador_no_pone_notas(admin):
    player = add_player(admin, "Lola")
    ana = member(admin)
    assert rate(ana, player, ALL_EIGHT).status_code == 403
    assert publish(ana).status_code == 403
    assert ana.get(f"/api/ranking/sheet?group_id=masculino&week={week()}").status_code == 403


def test_todos_ven_el_ranking_de_todos_los_equipos(admin):
    lola = add_player(admin, "Lola")
    rate_ok(admin, lola, ALL_EIGHT)
    publish_ok(admin)
    nino = member(admin, team="escuela-lm")
    assert [group["id"] for group in nino.get("/api/ranking/groups").json()] == ["masculino", "femenino", "escuela"]
    assert [entry["name"] for entry in table(nino)["entries"]] == ["Lola"]
    assert history(nino, lola)[0]["overall"] == 80


def test_ver_otro_equipo_no_deja_puntuarlo(admin):
    lola = add_player(admin, "Lola")
    coach = member(admin, role="entrenador", team="femenino")
    groups = {group["id"]: group["can_rate"] for group in coach.get("/api/ranking/groups").json()}
    assert groups == {"masculino": False, "femenino": True, "escuela": False}
    assert rate(coach, lola, ALL_EIGHT).status_code == 403
    assert publish(coach).status_code == 403


def test_las_familias_no_ven_el_ranking(admin):
    family = member(admin, role="familia")
    assert family.get("/api/ranking?group_id=masculino").status_code == 403
    assert family.get("/api/ranking/groups").json() == []
    assert family.get("/api/ranking/players/cualquiera?group_id=masculino").status_code == 403


def test_playa_no_tiene_ranking(admin):
    surfer = member(admin, team="playa")
    assert "playa" not in [group["id"] for group in surfer.get("/api/ranking/groups").json()]
    assert admin.get("/api/ranking?group_id=playa").status_code == 422


def test_las_dos_escuelas_comparten_ranking(admin):
    lunes = add_player(admin, "Lunes", team="escuela-lm")
    martes = add_player(admin, "Martes", team="escuela-mj")
    rate_ok(admin, lunes, {"saque": 9}, group="escuela")
    rate_ok(admin, martes, {"saque": 7}, group="escuela")
    publish_ok(admin, group="escuela")
    assert [entry["name"] for entry in table(admin, "escuela")["entries"]] == ["Lunes", "Martes"]
    student = member(admin, team="escuela-mj")
    assert [entry["name"] for entry in table(student, "escuela")["entries"]] == ["Lunes", "Martes"]


def test_la_posicion_de_la_semana_decide_la_formula(admin):
    sergio = add_player(admin, "Sergio", "Colocador")
    scores = {"colocacion": 9, "ataque": 5}
    assert rate_ok(admin, sergio, scores, position="Colocador")["overall"] == 86.7
    assert rate_ok(admin, sergio, scores, position="Opuesto")["overall"] == 53.6


def test_cambiar_la_ficha_no_cambia_el_pasado(admin):
    sergio = add_player(admin, "Sergio", "Colocador")
    rate_ok(admin, sergio, {"colocacion": 9, "ataque": 5}, position="Colocador")
    publish_ok(admin)
    admin.patch(f"/api/players/{sergio}", json={"position": "Opuesto"})
    entry = table(admin)["entries"][0]
    assert (entry["position"], entry["overall"]) == ("Colocador", 86.7)


def test_la_media_usa_solo_las_cuatro_ultimas_publicadas(admin):
    lola = add_player(admin, "Lola")
    rate_ok(admin, lola, {"saque": 1}, offset=4)
    publish_ok(admin, offset=4)
    for offset in range(4):
        rate_ok(admin, lola, {"saque": 8}, offset=offset)
        publish_ok(admin, offset=offset)
    assert table(admin)["entries"][0]["overall"] == 80


def test_las_semanas_sin_publicar_no_cuentan(admin):
    lola = add_player(admin, "Lola")
    rate_ok(admin, lola, {"saque": 8}, offset=1)
    publish_ok(admin, offset=1)
    rate_ok(admin, lola, {"saque": 2})
    assert table(admin)["entries"][0]["overall"] == 80


def test_la_primera_semana_basta_con_una_nota_y_luego_hacen_falta_dos(admin):
    lola = add_player(admin, "Lola")
    nora = add_player(admin, "Nora")
    rate_ok(admin, lola, {"saque": 8}, offset=1)
    rate_ok(admin, nora, {"saque": 7}, offset=1)
    publish_ok(admin, offset=1)
    assert [entry["name"] for entry in table(admin)["entries"]] == ["Lola", "Nora"]

    rate_ok(admin, nora, {"saque": 7})
    publish_ok(admin)
    result = table(admin)
    assert [entry["name"] for entry in result["entries"]] == ["Nora"]
    assert [person["name"] for person in result["pending"]] == ["Lola"]


def test_quien_falta_una_semana_conserva_su_media(admin):
    lola = add_player(admin, "Lola")
    for offset in (2, 1):
        rate_ok(admin, lola, {"saque": 8}, offset=offset)
        publish_ok(admin, offset=offset)
    rate_ok(admin, add_player(admin, "Nora"), {"saque": 5})
    publish_ok(admin)
    entry = next(item for item in table(admin)["entries"] if item["name"] == "Lola")
    assert (entry["overall"], entry["week_overall"]) == (80, None)


def test_flechas_de_subida_y_bajada(admin):
    lola, nora = add_player(admin, "Lola"), add_player(admin, "Nora")
    for player, score in ((lola, 8), (nora, 6)):
        rate_ok(admin, player, {"saque": score}, offset=1)
    publish_ok(admin, offset=1)
    assert table(admin)["has_previous"] is False
    for player, score in ((lola, 6), (nora, 10)):
        rate_ok(admin, player, {"saque": score})
    publish_ok(admin)
    result = table(admin)
    assert result["has_previous"] is True
    assert [(entry["name"], entry["movement"]) for entry in result["entries"]] == [("Nora", 1), ("Lola", -1)]


def test_misma_media_mismo_puesto(admin):
    lola, nora, zoe = add_player(admin, "Lola"), add_player(admin, "Nora"), add_player(admin, "Zoe")
    rate_ok(admin, lola, {"saque": 8})
    rate_ok(admin, nora, {"saque": 8})
    rate_ok(admin, zoe, {"saque": 6})
    publish_ok(admin)
    assert [(entry["name"], entry["rank"]) for entry in table(admin)["entries"]] == [("Lola", 1), ("Nora", 1), ("Zoe", 3)]


def test_corregir_tras_publicar_recalcula(admin):
    lola = add_player(admin, "Lola")
    rate_ok(admin, lola, {"saque": 8})
    publish_ok(admin)
    rate_ok(admin, lola, {"saque": 9})
    assert table(admin)["entries"][0]["overall"] == 90


def test_sin_notas_queda_sin_puntuar(admin):
    lola = add_player(admin, "Lola")
    rate_ok(admin, lola, {"saque": 8})
    assert rate_ok(admin, lola, {}) is None
    row = admin.get(f"/api/ranking/sheet?group_id=masculino&week={week()}").json()["rows"][0]
    assert row["rating"] is None


def test_la_hoja_trae_la_posicion_de_la_ficha_y_los_borradores(admin):
    sergio = add_player(admin, "Sergio", "Colocador")
    rate_ok(admin, sergio, {"colocacion": 9}, position="Opuesto", comment="Hoy de opuesto")
    sheet = admin.get(f"/api/ranking/sheet?group_id=masculino&week={week()}").json()
    assert sheet["published"] is False
    row = sheet["rows"][0]
    assert (row["position"], row["rating"]["position"], row["rating"]["comment"]) == ("Colocador", "Opuesto", "Hoy de opuesto")


def test_jugador_de_otro_equipo_no_se_puntua(admin):
    lola = add_player(admin, "Lola", team="femenino")
    assert rate(admin, lola, ALL_EIGHT).status_code == 404


def test_el_administrador_principal_puede_poner_notas_a_todos(admin, monkeypatch):
    set_coached(admin, [])
    assert groups_rated(admin) == set(ranking.GROUPS)
    assert rate(admin, add_player(admin, "Nino", team="escuela-lm"), ALL_EIGHT, group="escuela").status_code == 200
    # Otro administrador que no es el principal sigue sin poder.
    other = member(admin, role="admin", team="masculino", coached=[])
    assert rate(other, add_player(admin, "Lola"), ALL_EIGHT).status_code == 403
