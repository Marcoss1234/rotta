import pytest

import players
import roster_sync
from test_auth import client_for, db  # noqa: F401


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    monkeypatch.setattr(players, "_indexes_ready", False)
    monkeypatch.setattr(roster_sync, "_index_ready", False)


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def user_id_of(token="token-ana"):
    return client_for(token).get("/api/auth/me").json()["id"]


def change(admin, user_id, **body):
    response = admin.patch(f"/api/users/{user_id}", json=body)
    assert response.status_code == 200, response.text
    return response


def roster(admin, team="femenino"):
    return admin.get(f"/api/players?team_id={team}").json()


def approve_player(admin, team="femenino"):
    user_id = user_id_of()
    change(admin, user_id, status="approved", role="jugador", team_id=team)
    return user_id


def test_aprobar_jugador_con_equipo_lo_mete_en_la_plantilla(db, admin):  # noqa: F811
    approve_player(admin)
    players_list = roster(admin)
    assert len(players_list) == 1
    player = players_list[0]
    assert player["name"] == "Ana"
    assert player["position"] == "Sin definir"
    assert player["number"] is None
    assert player["court"] is None
    assert player["linked"] is True


@pytest.mark.parametrize("role", ["familia", "entrenador", "admin"])
def test_otros_roles_no_entran(db, admin, role):  # noqa: F811
    user_id = user_id_of()
    change(admin, user_id, status="approved", role=role, team_id="femenino")
    assert roster(admin) == []


def test_jugador_sin_equipo_no_entra_hasta_tenerlo(db, admin):  # noqa: F811
    user_id = user_id_of()
    change(admin, user_id, status="approved", role="jugador")
    assert all(roster(admin, team) == [] for team in ("masculino", "femenino", "playa"))
    change(admin, user_id, team_id="playa")
    assert [p["name"] for p in roster(admin, "playa")] == ["Ana"]


def test_pendiente_con_equipo_no_entra(db, admin):  # noqa: F811
    change(admin, user_id_of(), team_id="femenino")
    assert roster(admin) == []


def test_no_se_duplica_al_guardar_otra_vez_o_volver_a_entrar(db, admin):  # noqa: F811
    user_id = approve_player(admin)
    change(admin, user_id, team_id="femenino")
    change(admin, user_id, role="jugador")
    client_for("token-ana")
    assert len(roster(admin)) == 1


def test_cambiar_de_equipo_lo_mueve_al_banquillo_y_conserva_sus_datos(db, admin):  # noqa: F811
    user_id = approve_player(admin)
    player_id = roster(admin)[0]["id"]
    admin.patch(f"/api/players/{player_id}", json={"number": 7, "position": "Central", "court": {"x": 0.5, "y": 0.5}})

    change(admin, user_id, team_id="masculino")
    assert roster(admin) == []
    moved = roster(admin, "masculino")[0]
    assert moved["id"] == player_id
    assert (moved["number"], moved["position"], moved["court"]) == (7, "Central", None)


def test_si_el_dorsal_esta_ocupado_en_el_nuevo_equipo_se_queda_sin_dorsal(db, admin):  # noqa: F811
    user_id = approve_player(admin)
    player_id = roster(admin)[0]["id"]
    admin.patch(f"/api/players/{player_id}", json={"number": 7})
    admin.post("/api/players", json={"team_id": "masculino", "name": "Ya Estaba", "number": 7})

    change(admin, user_id, team_id="masculino")
    numbers = {p["name"]: p["number"] for p in roster(admin, "masculino")}
    assert numbers == {"Ya Estaba": 7, "Ana": None}


@pytest.mark.parametrize(
    "body",
    [{"team_id": None}, {"role": "familia"}, {"role": "entrenador"}, {"status": "rejected"}],
)
def test_sale_de_la_plantilla(db, admin, body):  # noqa: F811
    user_id = approve_player(admin)
    change(admin, user_id, **body)
    assert roster(admin) == []


def test_si_vuelve_entra_desde_cero(db, admin):  # noqa: F811
    user_id = approve_player(admin)
    player_id = roster(admin)[0]["id"]
    admin.patch(f"/api/players/{player_id}", json={"number": 7})
    change(admin, user_id, status="rejected")
    change(admin, user_id, status="approved", role="jugador")

    back = roster(admin)[0]
    assert back["id"] != player_id
    assert back["number"] is None


def test_quitarle_el_equipo_no_borra_a_otros_ni_a_los_manuales(db, admin):  # noqa: F811
    user_id = approve_player(admin)
    admin.post("/api/players", json={"team_id": "femenino", "name": "Sin Cuenta"})
    change(admin, user_id, team_id=None)
    assert [p["name"] for p in roster(admin)] == ["Sin Cuenta"]
    assert roster(admin)[0]["linked"] is False


def test_ficha_con_cuenta_no_se_borra_ni_cambia_de_equipo_desde_plantilla(db, admin):  # noqa: F811
    approve_player(admin)
    player_id = roster(admin)[0]["id"]
    assert admin.delete(f"/api/players/{player_id}").status_code == 409
    assert admin.patch(f"/api/players/{player_id}", json={"team_id": "playa"}).status_code == 409
    assert roster(admin)[0]["id"] == player_id
    assert admin.patch(f"/api/players/{player_id}", json={"team_id": "femenino", "position": "Líbero", "number": 3}).status_code == 200


def test_jugador_no_puede_crear_su_ficha_ni_tocarla(db, admin):  # noqa: F811
    approve_player(admin)
    ana = client_for("token-ana")
    player_id = roster(admin)[0]["id"]
    assert ana.patch(f"/api/players/{player_id}", json={"number": 10}).status_code == 403
    assert ana.post("/api/players", json={"team_id": "femenino", "name": "Otra Ana", "user_id": "x"}).status_code in (403, 422)
    assert admin.post("/api/players", json={"team_id": "femenino", "name": "Otra Ana", "user_id": "x"}).status_code == 422
