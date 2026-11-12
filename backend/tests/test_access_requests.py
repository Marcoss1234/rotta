import pytest

from test_auth import client_for, db  # noqa: F401


def id_of(client):
    return client.get("/api/auth/me").json()["id"]


def make(admin, client, role):
    response = admin.patch(f"/api/users/{id_of(client)}", json={"status": "approved", "role": role, "team_id": "masculino"})
    assert response.status_code == 200, response.text


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


@pytest.fixture
def coach(admin):
    client = client_for("token-ana")
    make(admin, client, "entrenador")
    return client


@pytest.fixture
def luis(db):  # noqa: F811
    return client_for("token-luis")


def review(client, user_id, **body):
    return client.post(f"/api/users/{user_id}/access", json=body)


def test_el_entrenador_ve_solo_a_quien_espera(coach, luis):
    pending = coach.get("/api/users/pending")
    assert pending.status_code == 200, pending.text
    assert [person["id"] for person in pending.json()] == [id_of(luis)]


def test_el_entrenador_sigue_sin_ver_ni_editar_a_todos(coach, luis):
    assert coach.get("/api/users").status_code == 403
    assert coach.patch(f"/api/users/{id_of(luis)}", json={"status": "approved", "role": "jugador"}).status_code == 403


@pytest.mark.parametrize("role", ["jugador", "familia"])
def test_el_entrenador_acepta(coach, luis, role):
    response = review(coach, id_of(luis), status="approved", role=role, team_id="femenino")
    assert response.status_code == 200, response.text
    me = luis.get("/api/auth/me").json()
    assert (me["status"], me["role"], me["team_id"]) == ("approved", role, "femenino")
    assert coach.get("/api/users/pending").json() == []


def test_al_aceptar_a_un_jugador_entra_en_la_plantilla(coach, luis, admin):
    review(coach, id_of(luis), status="approved", role="jugador", team_id="femenino")
    roster = admin.get("/api/players?team_id=femenino")
    assert roster.status_code == 200, roster.text
    assert "Luis" in roster.text


def test_el_entrenador_rechaza(coach, luis):
    assert review(coach, id_of(luis), status="rejected").status_code == 200
    me = luis.get("/api/auth/me").json()
    assert (me["status"], me["role"]) == ("rejected", None)


@pytest.mark.parametrize("role", ["entrenador", "admin", "jefe"])
def test_el_entrenador_no_da_mas_permisos(coach, luis, role):
    assert review(coach, id_of(luis), status="approved", role=role, team_id="masculino").status_code == 422
    assert luis.get("/api/auth/me").json()["status"] == "pending"


@pytest.mark.parametrize("extra", [{"match_editor": True}, {"coached_team_ids": ["masculino"]}, {"also_plays": True}])
def test_no_se_cuelan_otros_permisos(coach, luis, extra):
    body = {"status": "approved", "role": "jugador", "team_id": "masculino", **extra}
    assert review(coach, id_of(luis), **body).status_code == 422


@pytest.mark.parametrize("body", [{"status": "approved"}, {"status": "approved", "role": "jugador"}, {"status": "approved", "team_id": "masculino"}])
def test_para_aceptar_hacen_falta_rol_y_equipo(coach, luis, body):
    assert review(coach, id_of(luis), **body).status_code == 422


def test_solo_se_resuelve_quien_espera(coach, admin, luis):
    # Ni se puede rechazar a un administrador o miembro, ni resolver dos veces.
    assert review(coach, id_of(admin), status="rejected").status_code == 409
    user_id = id_of(luis)
    assert review(coach, user_id, status="rejected").status_code == 200
    assert review(coach, user_id, status="approved", role="jugador", team_id="masculino").status_code == 409
    assert review(coach, "no-existe", status="rejected").status_code == 409


@pytest.mark.parametrize("role", ["jugador", "familia"])
def test_jugadores_y_familias_no_aceptan(admin, luis, role):
    ana = client_for("token-ana")
    make(admin, ana, role)
    assert ana.get("/api/users/pending").status_code == 403
    assert review(ana, id_of(luis), status="approved", role="jugador", team_id="masculino").status_code == 403


def test_quien_espera_no_se_acepta_solo(luis):
    assert luis.get("/api/users/pending").status_code == 403
    assert review(luis, id_of(luis), status="approved", role="jugador", team_id="masculino").status_code == 403


def test_sin_sesion_no_se_ve(db):  # noqa: F811
    assert client_for().get("/api/users/pending").status_code == 401
