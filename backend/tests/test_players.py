import pytest
from fastapi.testclient import TestClient

import players
from server import app
from test_auth import client_for, db  # noqa: F401

NEW_PLAYER = {
    "team_id": "femenino",
    "name": "  Laura Martín ",
    "position": "Receptor",
    "number": 4,
    "phone": "+34 600 000 000",
    "email": "Laura@Ejemplo.es",
}


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    monkeypatch.setattr(players, "_indexes_ready", False)


def as_role(admin, token, role):
    client = client_for(token)
    user_id = client.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{user_id}", json={"status": "approved", "role": role})
    assert response.status_code == 200, response.text
    return client


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def create(client, **changes):
    return client.post("/api/players", json={**NEW_PLAYER, **changes})


def test_sin_sesion_no_hay_nada(db):  # noqa: F811
    client = TestClient(app)
    assert client.get("/api/teams").status_code == 401
    assert client.get("/api/players?team_id=femenino").status_code == 401
    assert client.post("/api/players", json=NEW_PLAYER).status_code == 401
    assert client.patch("/api/players/x", json={"name": "Otro"}).status_code == 401
    assert client.delete("/api/players/x").status_code == 401


def test_pendiente_no_ve_plantillas(db, admin):  # noqa: F811
    create(admin)
    pending = client_for("token-ana")
    assert pending.get("/api/teams").status_code == 403
    assert pending.get("/api/players?team_id=femenino").status_code == 403


def test_rechazado_pierde_el_acceso_a_plantillas(db, admin):  # noqa: F811
    ana = as_role(admin, "token-ana", "jugador")
    assert ana.get("/api/players?team_id=femenino").status_code == 200
    ana_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{ana_id}", json={"status": "rejected"})
    assert ana.get("/api/players?team_id=femenino").status_code == 403


def test_equipos_del_club(db, admin):  # noqa: F811
    ids = [team["id"] for team in admin.get("/api/teams").json()]
    assert ids == ["masculino", "femenino", "escuela-lm", "escuela-mj", "playa"]


def test_cada_grupo_de_escuela_tiene_su_plantilla(db, admin):  # noqa: F811
    assert create(admin, team_id="escuela-lm", name="Grupo Lunes", number=3).status_code == 201
    assert create(admin, team_id="escuela-mj", name="Grupo Martes", number=3).status_code == 201
    assert [p["name"] for p in admin.get("/api/players?team_id=escuela-lm").json()] == ["Grupo Lunes"]
    assert [p["name"] for p in admin.get("/api/players?team_id=escuela-mj").json()] == ["Grupo Martes"]
    assert create(admin, team_id="escuela", name="Grupo Viejo").status_code == 422


@pytest.mark.parametrize("role", ["admin", "entrenador"])
def test_cuerpo_tecnico_gestiona_y_ve_contacto(db, admin, role):  # noqa: F811
    staff = as_role(admin, "token-ana", role)

    created = create(staff)
    assert created.status_code == 201, created.text
    player = created.json()
    assert player["name"] == "Laura Martín"
    assert player["email"] == "laura@ejemplo.es"

    listed = staff.get("/api/players?team_id=femenino").json()
    assert listed[0]["phone"] == "+34 600 000 000"

    updated = staff.patch(f"/api/players/{player['id']}", json={"position": "Central", "phone": None})
    assert updated.status_code == 200
    assert updated.json()["position"] == "Central"
    assert updated.json()["phone"] is None
    assert updated.json()["number"] == 4

    assert staff.delete(f"/api/players/{player['id']}").status_code == 204
    assert staff.get("/api/players?team_id=femenino").json() == []


@pytest.mark.parametrize("role", ["jugador", "familia"])
def test_jugador_y_familia_no_ven_contactos_ni_editan(db, admin, role):  # noqa: F811
    player_id = create(admin).json()["id"]
    member = as_role(admin, "token-ana", role)

    response = member.get("/api/players?team_id=femenino")
    assert response.status_code == 200
    assert response.json() == [
        {"id": player_id, "team_id": "femenino", "name": "Laura Martín", "position": "Receptor", "preferred_positions": [], "number": 4, "court": None, "linked": False, "picture": "", "character": None, "height_cm": None, "crown": None}
    ]
    assert "600 000" not in response.text
    assert "ejemplo.es" not in response.text

    assert create(member, number=5).status_code == 403
    assert member.patch(f"/api/players/{player_id}", json={"name": "Otro"}).status_code == 403
    assert member.delete(f"/api/players/{player_id}").status_code == 403
    assert admin.get("/api/players?team_id=femenino").json()[0]["name"] == "Laura Martín"


def test_cambio_de_rol_se_aplica_al_momento(db, admin):  # noqa: F811
    ana = as_role(admin, "token-ana", "entrenador")
    create(admin)
    assert "phone" in ana.get("/api/players?team_id=femenino").json()[0]

    ana_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{ana_id}", json={"role": "jugador"})
    assert "phone" not in ana.get("/api/players?team_id=femenino").json()[0]
    assert create(ana, number=6).status_code == 403


def test_dorsal_no_se_repite_en_el_equipo_pero_si_en_otro(db, admin):  # noqa: F811
    assert create(admin).status_code == 201
    assert create(admin, name="Otra Persona").status_code == 409
    assert create(admin, name="Otra Persona", team_id="masculino").status_code == 201


def test_sin_dorsal_se_permite_varias_veces(db, admin):  # noqa: F811
    assert create(admin, number=None).status_code == 201
    assert create(admin, name="Otra Persona", number=None).status_code == 201


def test_mover_de_equipo_o_cambiar_dorsal_respeta_el_duplicado(db, admin):  # noqa: F811
    create(admin)
    other = create(admin, name="Otra Persona", number=7, team_id="masculino").json()
    moved = admin.patch(f"/api/players/{other['id']}", json={"team_id": "femenino", "number": 4})
    assert moved.status_code == 409

    same = admin.patch(f"/api/players/{other['id']}", json={"number": 7, "name": "Otro Nombre"})
    assert same.status_code == 200


@pytest.mark.parametrize(
    "changes",
    [
        {"team_id": "inventado"},
        {"position": "Portero"},
        {"number": 100},
        {"number": -1},
        {"name": " "},
        {"phone": "llámame"},
        {"email": "no-es-correo"},
        {"role": "admin"},
    ],
)
def test_datos_no_validos_se_rechazan(db, admin, changes):  # noqa: F811
    assert create(admin, **changes).status_code == 422


@pytest.mark.parametrize("body", [{}, {"name": None}, {"team_id": None}, {"position": None}, {"id": "otro"}])
def test_cambios_no_validos_se_rechazan(db, admin, body):  # noqa: F811
    player_id = create(admin).json()["id"]
    assert admin.patch(f"/api/players/{player_id}", json=body).status_code == 422


def test_equipo_es_obligatorio_y_valido_al_listar(db, admin):  # noqa: F811
    assert admin.get("/api/players").status_code == 422
    assert admin.get("/api/players?team_id=inventado").status_code == 422
    assert admin.get("/api/players?team_id[$ne]=x").status_code == 422


def test_jugador_inexistente(db, admin):  # noqa: F811
    assert admin.patch("/api/players/no-existe", json={"name": "Otro"}).status_code == 404
    assert admin.delete("/api/players/no-existe").status_code == 404


def test_jugador_nuevo_empieza_en_el_banquillo(db, admin):  # noqa: F811
    assert create(admin).json()["court"] is None
    assert create(admin, name="Otra Persona", number=5, court={"x": 0.5, "y": 0.5}).status_code == 422


def test_la_chapa_se_guarda_y_todos_la_ven_pero_solo_el_cuerpo_tecnico_la_mueve(db, admin):  # noqa: F811
    player_id = create(admin).json()["id"]
    moved = admin.patch(f"/api/players/{player_id}", json={"court": {"x": 0.25, "y": 0.75}})
    assert moved.status_code == 200
    assert moved.json()["court"] == {"x": 0.25, "y": 0.75}
    assert moved.json()["position"] == "Receptor"

    member = as_role(admin, "token-ana", "familia")
    listed = member.get("/api/players?team_id=femenino").json()[0]
    assert listed["court"] == {"x": 0.25, "y": 0.75}
    assert member.patch(f"/api/players/{player_id}", json={"court": {"x": 0.1, "y": 0.1}}).status_code == 403

    coach = as_role(admin, "token-luis", "entrenador")
    assert coach.patch(f"/api/players/{player_id}", json={"court": None}).json()["court"] is None


@pytest.mark.parametrize("court", [{"x": 1.5, "y": 0.5}, {"x": 0.5, "y": -0.1}, {"x": 0.5}, {"x": 0.5, "y": 0.5, "z": 1}, "centro"])
def test_posicion_de_chapa_no_valida(db, admin, court):  # noqa: F811
    player_id = create(admin).json()["id"]
    assert admin.patch(f"/api/players/{player_id}", json={"court": court}).status_code == 422


def test_cambiar_de_equipo_devuelve_la_chapa_al_banquillo(db, admin):  # noqa: F811
    player_id = create(admin).json()["id"]
    admin.patch(f"/api/players/{player_id}", json={"court": {"x": 0.5, "y": 0.5}})

    same_team = admin.patch(f"/api/players/{player_id}", json={"team_id": "femenino", "name": "Otro Nombre"})
    assert same_team.json()["court"] == {"x": 0.5, "y": 0.5}

    moved = admin.patch(f"/api/players/{player_id}", json={"team_id": "masculino"})
    assert moved.json()["court"] is None


def test_orden_por_dorsal_y_sin_dorsal_al_final(db, admin):  # noqa: F811
    create(admin, name="Sin Dorsal", number=None)
    create(admin, name="Dorsal Nueve", number=9)
    create(admin, name="Dorsal Dos", number=2)
    names = [p["name"] for p in admin.get("/api/players?team_id=femenino").json()]
    assert names == ["Dorsal Dos", "Dorsal Nueve", "Sin Dorsal"]
