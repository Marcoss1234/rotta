from datetime import timedelta

import pytest

import matches
from test_auth import client_for, db  # noqa: F401


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    monkeypatch.setattr(matches, "_indexes_ready", False)


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def member(admin, token="token-ana", role="jugador", team="masculino"):
    client = client_for(token)
    user_id = client.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{user_id}", json={"status": "approved", "role": role, "team_id": team})
    assert response.status_code == 200, response.text
    return client


def day(offset=0):
    return (matches._today() + timedelta(days=offset)).isoformat()


def create(client, **body):
    payload = {"team_id": "masculino", "date": day(), "time": "18:00", "opponent": "CV Roquetas", **body}
    return client.post("/api/matches", json=payload)


def listing(client, team="masculino"):
    response = client.get(f"/api/matches?team_id={team}")
    assert response.status_code == 200, response.text
    return response.json()


def names(match, key):
    return [person["name"] for person in match[key]]


def test_el_cuerpo_tecnico_crea_un_partido_para_hoy(admin):
    response = create(admin, location="Pabellón Municipal", notes="Llevad las dos equipaciones")
    assert response.status_code == 201, response.text
    match = response.json()
    assert (match["date"], match["time"], match["opponent"], match["kind"]) == (day(), "18:00", "CV Roquetas", "amistoso")
    assert match["can_edit"] is True
    assert listing(admin)[0]["id"] == match["id"]


def test_entrenador_tambien_puede_crear(admin):
    coach = member(admin, role="entrenador")
    assert create(coach).status_code == 201


@pytest.mark.parametrize("role", ["jugador", "familia"])
def test_jugadores_y_familias_no_crean_ni_editan(admin, role):
    other = member(admin, role=role)
    assert create(other).status_code == 403
    match_id = create(admin).json()["id"]
    assert other.patch(f"/api/matches/{match_id}", json={"time": "19:00"}).status_code == 403
    assert other.delete(f"/api/matches/{match_id}").status_code == 403
    assert listing(other)[0]["can_edit"] is False


def test_sin_acceso_no_se_ven(db):  # noqa: F811
    assert client_for("token-ana").get("/api/matches?team_id=masculino").status_code == 403


def test_orden_y_solo_los_proximos(admin, db):  # noqa: F811
    create(admin, date=day(3), opponent="Tercero")
    create(admin, date=day(), time="20:00", opponent="Segundo")
    create(admin, date=day(), time="10:00", opponent="Primero")
    assert [match["opponent"] for match in listing(admin)] == ["Primero", "Segundo", "Tercero"]

    import asyncio

    asyncio.run(db.matches.update_one({"opponent": "Tercero"}, {"$set": {"date": day(-1)}}))
    assert [match["opponent"] for match in listing(admin)] == ["Primero", "Segundo"]


def test_cada_equipo_ve_los_suyos(admin):
    create(admin, team_id="femenino", opponent="Solo femenino")
    assert listing(admin, "masculino") == []
    assert [match["opponent"] for match in listing(admin, "femenino")] == ["Solo femenino"]


@pytest.mark.parametrize(
    "body",
    [
        {"time": "25:00"},
        {"time": "6"},
        {"opponent": ""},
        {"opponent": "x" * 81},
        {"kind": "final"},
        {"date": "2000-01-01"},
        {"team_id": "inventado"},
        {"notes": "x" * 301},
        {"created_by": "otro"},
    ],
)
def test_datos_no_validos(admin, body):
    assert create(admin, **body).status_code == 422


def test_editar_y_borrar(admin):
    match_id = create(admin).json()["id"]
    edited = admin.patch(f"/api/matches/{match_id}", json={"time": "18:30", "opponent": "CV Aguadulce", "kind": "liga"})
    assert edited.status_code == 200
    assert (edited.json()["time"], edited.json()["opponent"], edited.json()["kind"]) == ("18:30", "CV Aguadulce", "liga")
    assert admin.patch(f"/api/matches/{match_id}", json={"opponent": None}).status_code == 422
    assert admin.patch(f"/api/matches/{match_id}", json={}).status_code == 422

    assert admin.delete(f"/api/matches/{match_id}").status_code == 204
    assert listing(admin) == []
    assert admin.delete(f"/api/matches/{match_id}").status_code == 404


def test_convocatoria_voy_y_no_voy(admin):
    ana = member(admin)
    luis = member(admin, "token-luis")
    match_id = create(admin).json()["id"]

    answered = ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"})
    assert answered.status_code == 200
    assert answered.json()["mine"] == "going"
    seen = listing(luis)[0]
    assert names(seen, "going") == ["Ana"]
    assert names(seen, "no_answer") == ["Luis"]
    assert seen["can_respond"] is True and seen["mine"] is None

    ana.put(f"/api/matches/{match_id}/answer", json={"status": "not_going"})
    assert names(listing(admin)[0], "not_going") == ["Ana"]


@pytest.mark.parametrize("role,team", [("familia", "masculino"), ("entrenador", "masculino"), ("jugador", "femenino")])
def test_solo_responde_quien_juega_en_ese_equipo(admin, role, team):
    other = member(admin, role=role, team=team)
    match_id = create(admin).json()["id"]
    assert listing(other)[0]["can_respond"] is False
    assert other.put(f"/api/matches/{match_id}/answer", json={"status": "going"}).status_code == 403


def test_borrar_el_partido_borra_las_respuestas(admin, db):  # noqa: F811
    import asyncio

    ana = member(admin)
    match_id = create(admin).json()["id"]
    ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"})
    admin.delete(f"/api/matches/{match_id}")
    assert asyncio.run(db.match_answers.count_documents({"match_id": match_id})) == 0


def test_no_se_responde_a_un_partido_pasado(admin, db):  # noqa: F811
    import asyncio

    ana = member(admin)
    match_id = create(admin).json()["id"]
    asyncio.run(db.matches.update_one({"id": match_id}, {"$set": {"date": day(-2)}}))
    assert ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"}).status_code == 422


def test_lugar_admite_un_enlace_largo_de_mapas(admin):
    link = "https://www.google.com/maps/place/Pabell%C3%B3n+Municipal/@36.76,-2.61,17z/data=" + "x" * 150
    response = create(admin, location=f"Pabellón Municipal {link}")
    assert response.status_code == 201, response.text
    assert response.json()["location"].endswith("x" * 150)
    assert create(admin, location="x" * 301).status_code == 422


def make_editor(admin, client, value=True):
    user_id = client.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{user_id}", json={"match_editor": value})
    assert response.status_code == 200, response.text
    return response.json()


def test_un_jugador_editor_gestiona_partidos(admin):
    ana = member(admin)
    assert create(ana).status_code == 403
    assert make_editor(admin, ana)["match_editor"] is True

    created = create(ana, opponent="CV Aguadulce")
    assert created.status_code == 201, created.text
    match_id = created.json()["id"]
    assert created.json()["can_edit"] is True
    assert ana.patch(f"/api/matches/{match_id}", json={"time": "19:00"}).status_code == 200
    # Sigue siendo jugador: responde, pero no gestiona plantillas ni usuarios.
    assert ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"}).status_code == 200
    assert ana.post("/api/players", json={"team_id": "masculino", "name": "Otro"}).status_code == 403
    assert ana.get("/api/users").status_code == 403
    assert ana.delete(f"/api/matches/{match_id}").status_code == 204


def test_quitar_el_permiso_de_editor(admin):
    ana = member(admin)
    make_editor(admin, ana)
    match_id = create(ana).json()["id"]
    make_editor(admin, ana, False)
    assert ana.patch(f"/api/matches/{match_id}", json={"time": "19:00"}).status_code == 403
    assert listing(ana)[0]["can_edit"] is False


def test_solo_un_admin_da_el_permiso_de_editor(admin):
    ana = member(admin)
    coach = member(admin, "token-luis", role="entrenador")
    ana_id = ana.get("/api/auth/me").json()["id"]
    assert coach.patch(f"/api/users/{ana_id}", json={"match_editor": True}).status_code == 403
    assert ana.patch(f"/api/users/{ana_id}", json={"match_editor": True}).status_code == 403
    assert ana.patch("/api/profile", json={"match_editor": True}).status_code == 422
    assert create(ana).status_code == 403


def test_las_dos_escuelas_comparten_partidos(admin):
    tarde = member(admin, "token-ana", team="escuela-mj")
    manana = member(admin, "token-luis", team="escuela-lm")
    match_id = create(admin, team_id="escuela-mj").json()["id"]

    seen = listing(manana, "escuela-lm")
    assert [match["id"] for match in seen] == [match_id]
    assert seen[0]["can_respond"] is True
    assert manana.put(f"/api/matches/{match_id}/answer", json={"status": "going"}).status_code == 200

    shared = listing(tarde, "escuela-mj")[0]
    assert names(shared, "going") == ["Luis"]
    assert names(shared, "no_answer") == ["Ana"]


def test_un_cambio_en_la_escuela_se_ve_en_las_dos(admin):
    match_id = create(admin, team_id="escuela-lm", opponent="Antes").json()["id"]
    assert admin.patch(f"/api/matches/{match_id}", json={"opponent": "Despues"}).status_code == 200
    assert [match["opponent"] for match in listing(admin, "escuela-mj")] == ["Despues"]
    assert admin.delete(f"/api/matches/{match_id}").status_code == 204
    assert listing(admin, "escuela-lm") == []


def test_los_demas_equipos_no_comparten_partidos(admin):
    create(admin, team_id="escuela-mj")
    other = member(admin, "token-ana", team="femenino")
    assert listing(admin, "femenino") == []
    create(admin, team_id="masculino", opponent="Solo masculino")
    assert all(match["opponent"] != "Solo masculino" for match in listing(other, "femenino"))


def played(client, team="masculino"):
    response = client.get(f"/api/matches/played?team_id={team}")
    assert response.status_code == 200, response.text
    return response.json()


def test_se_puede_apuntar_un_partido_ya_jugado(admin):
    response = create(admin, date=day(-3), opponent="NYM")
    assert response.status_code == 201, response.text
    assert listing(admin) == []
    assert [(match["date"], match["opponent"]) for match in played(admin)] == [(day(-3), "NYM")]


def test_los_jugados_salen_del_mas_reciente_al_mas_antiguo(admin):
    create(admin, date=day(-9), opponent="Antiguo")
    create(admin, date=day(-1), opponent="Reciente")
    create(admin, opponent="Hoy no")
    assert [match["opponent"] for match in played(admin)] == ["Reciente", "Antiguo"]


def test_un_partido_pasado_no_admite_respuestas(admin):
    ana = member(admin)
    match_id = create(admin, date=day(-2)).json()["id"]
    assert ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"}).status_code == 422


def test_partido_de_hace_mas_de_dos_anos_no_vale(admin):
    assert create(admin, date=day(-matches.MAX_DAYS_BACK - 1)).status_code == 422
    assert create(admin, date=day(-matches.MAX_DAYS_BACK)).status_code == 201


def test_los_jugados_de_la_escuela_salen_en_las_dos(admin):
    create(admin, team_id="escuela-lm", date=day(-2), opponent="Compartido")
    assert [match["opponent"] for match in played(admin, "escuela-mj")] == ["Compartido"]
    assert played(admin, "masculino") == []


def test_quien_no_edita_ve_jugados_sin_poder_editar(admin):
    ana = member(admin)
    match_id = create(admin, date=day(-2)).json()["id"]
    seen = played(ana)
    assert [match["id"] for match in seen] == [match_id]
    assert seen[0]["can_edit"] is False


def test_jugados_requiere_acceso(db):  # noqa: F811
    assert client_for("token-ana").get("/api/matches/played?team_id=masculino").status_code == 403


def test_editar_un_partido_a_fecha_pasada(admin):
    match_id = create(admin).json()["id"]
    assert admin.patch(f"/api/matches/{match_id}", json={"date": day(-4)}).status_code == 200
    assert [match["id"] for match in played(admin)] == [match_id]


THREE_ONE = [{"us": 25, "them": 20}, {"us": 23, "them": 25}, {"us": 25, "them": 18}, {"us": 26, "them": 24}]


def test_el_resultado_por_sets_se_ve_en_jugados(admin):
    ana = member(admin)
    match_id = create(admin, date=day(-3)).json()["id"]
    assert played(ana)[0]["sets"] == []
    assert admin.patch(f"/api/matches/{match_id}", json={"sets": THREE_ONE}).status_code == 200
    assert played(ana)[0]["sets"] == THREE_ONE


def test_el_resultado_se_puede_apuntar_al_crearlo(admin):
    assert create(admin, date=day(-3), sets=THREE_ONE).status_code == 201
    assert played(admin)[0]["sets"] == THREE_ONE


def test_el_resultado_se_puede_quitar(admin):
    match_id = create(admin, date=day(-3), sets=THREE_ONE).json()["id"]
    assert admin.patch(f"/api/matches/{match_id}", json={"sets": []}).status_code == 200
    assert played(admin)[0]["sets"] == []


@pytest.mark.parametrize(
    "sets",
    [
        [{"us": 25, "them": 25}],
        [{"us": -1, "them": 25}],
        [{"us": 100, "them": 25}],
        [{"us": 25}],
        [{"us": 25, "them": 20}] * 6,
    ],
)
def test_resultados_no_validos(admin, sets):
    assert create(admin, date=day(-3), sets=sets).status_code == 422


def test_un_partido_futuro_no_tiene_resultado(admin):
    assert create(admin, date=day(3), sets=THREE_ONE).status_code == 422
    match_id = create(admin, date=day(3)).json()["id"]
    assert admin.patch(f"/api/matches/{match_id}", json={"sets": THREE_ONE}).status_code == 422


def test_no_se_mueve_al_futuro_un_partido_con_resultado(admin):
    match_id = create(admin, date=day(-3), sets=THREE_ONE).json()["id"]
    assert admin.patch(f"/api/matches/{match_id}", json={"date": day(3)}).status_code == 422


def test_el_partido_de_hoy_pasa_a_jugados_con_su_resultado(admin):
    ana = member(admin)
    match_id = create(admin).json()["id"]
    assert [match["id"] for match in listing(ana)] == [match_id]
    assert played(ana) == []
    assert admin.patch(f"/api/matches/{match_id}", json={"sets": THREE_ONE}).status_code == 200
    assert listing(ana) == []
    assert [match["id"] for match in played(ana)] == [match_id]
    assert ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"}).status_code == 422


def test_el_resultado_lo_apunta_quien_gestiona_partidos(admin):
    ana = member(admin)
    match_id = create(admin, date=day(-3)).json()["id"]
    assert ana.patch(f"/api/matches/{match_id}", json={"sets": THREE_ONE}).status_code == 403


def test_decir_voy_al_partido_da_siete_coins(admin):
    match_id = create(admin, date=day(1)).json()["id"]
    ana = member(admin)
    going = ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"})
    assert going.status_code == 200 and going.json()["coins"] == matches.MATCH_COINS
    assert ana.put(f"/api/matches/{match_id}/answer", json={"status": "going"}).json()["coins"] == 0
    assert ana.get("/api/coins").json()["balance"] == matches.MATCH_COINS
    # Cambiar a "No voy" devuelve lo ganado; decir "No voy" sin haber dicho "Voy" no quita nada.
    assert ana.put(f"/api/matches/{match_id}/answer", json={"status": "not_going"}).json()["coins"] == -matches.MATCH_COINS
    assert ana.put(f"/api/matches/{match_id}/answer", json={"status": "not_going"}).json()["coins"] == 0
    assert ana.get("/api/coins").json()["balance"] == 0
