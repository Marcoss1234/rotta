import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import password_auth
from server import app
from test_auth import client_for, db  # noqa: F401

GOOD_PASSWORD = "cancha-azul-27"
NEW_PASSWORD = "red-alta-ocho-8"


def anonymous():
    return TestClient(app, base_url="http://testserver")


def register(client=None, username="martin.g", password=GOOD_PASSWORD, name="Martín García"):
    client = client or anonymous()
    return client, client.post("/api/auth/register", json={"name": name, "username": username, "password": password})


def login(username="martin.g", password=GOOD_PASSWORD, client=None):
    client = client or anonymous()
    return client, client.post("/api/auth/login", json={"username": username, "password": password})


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def approve(admin, user_id, role="jugador", team="femenino"):
    response = admin.patch(f"/api/users/{user_id}", json={"status": "approved", "role": role, "team_id": team})
    assert response.status_code == 200, response.text


def test_registrarse_deja_la_cuenta_pendiente_y_sin_acceso(admin):
    client, response = register()
    assert response.status_code == 201, response.text
    user = response.json()
    assert (user["status"], user["role"], user["username"], user["email"]) == ("pending", None, "martin.g", None)
    assert user["has_password"] is True
    assert client.get("/api/auth/me").status_code == 200
    assert client.get("/api/teams").status_code in (200, 403)
    assert client.get("/api/players?team_id=femenino").status_code == 403
    assert client.get("/api/chat/channels").status_code == 403
    assert client.get("/api/users").status_code == 403


def test_nunca_se_devuelve_la_contrasena_ni_su_cifrado(admin):
    _, response = register()
    assert "password_hash" not in response.json()
    assert GOOD_PASSWORD not in response.text
    listing = admin.get("/api/users")
    assert "password_hash" not in listing.text
    assert "argon2" not in listing.text


def test_la_contrasena_se_guarda_cifrada(db, admin):  # noqa: F811
    register()
    stored = asyncio.run(db.users.find_one({"username": "martin.g"}))
    assert stored["password_hash"].startswith("$argon2")
    assert GOOD_PASSWORD not in str(stored)


def test_no_se_puede_elegir_rol_ni_estado_al_registrarse(admin):
    response = anonymous().post(
        "/api/auth/register",
        json={"name": "Listo", "username": "listo", "password": GOOD_PASSWORD, "role": "admin", "status": "approved"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "username,password",
    [
        ("ab", GOOD_PASSWORD),
        ("con espacios", GOOD_PASSWORD),
        ("con@arroba", GOOD_PASSWORD),
        ("admin", GOOD_PASSWORD),
        ("martin.g", "corta12"),
        ("martin.g", "x" * 129),
        ("martin.g", "soy-martin.g-1"),
    ],
)
def test_datos_de_registro_no_validos(admin, username, password):
    _, response = register(username=username, password=password)
    assert response.status_code == 422


def test_usuario_repetido_aunque_cambien_las_mayusculas(admin):
    assert register()[1].status_code == 201
    assert register(username="MARTIN.G", name="Otro")[1].status_code == 409


def test_varias_cuentas_con_usuario_conviven_con_google(admin):
    assert register()[1].status_code == 201
    assert register(username="otra.persona", name="Otra Persona")[1].status_code == 201
    assert len(admin.get("/api/users").json()) == 3
    assert client_for("token-ana").get("/api/auth/me").status_code == 200


def test_entrar_con_usuario_y_contrasena(admin):
    register()
    client, response = login(username="  Martin.G ")
    assert response.status_code == 200, response.text
    assert response.json()["username"] == "martin.g"
    assert client.get("/api/auth/me").json()["name"] == "Martín García"


@pytest.mark.parametrize("username,password", [("martin.g", "no-es-esta-1"), ("no.existe", GOOD_PASSWORD)])
def test_el_error_no_delata_si_el_usuario_existe(admin, username, password):
    register()
    _, response = login(username, password)
    assert response.status_code == 401
    assert response.json()["detail"] == password_auth.WRONG_LOGIN


def test_una_cuenta_de_google_no_entra_por_contrasena(admin):
    client_for("token-ana")
    _, response = login("ana@gmail.com", GOOD_PASSWORD)
    assert response.status_code == 401


def test_se_bloquea_tras_varios_fallos(admin):
    register()
    for _ in range(password_auth.USER_ATTEMPTS):
        assert login(password="no-es-esta-1")[1].status_code == 401
    assert login()[1].status_code == 429


def test_el_bloqueo_de_uno_no_afecta_a_otro(admin):
    register()
    register(username="otra.persona")
    for _ in range(password_auth.USER_ATTEMPTS):
        login(password="no-es-esta-1")
    assert login("otra.persona")[1].status_code == 200


def test_acertar_reinicia_los_fallos(admin):
    register()
    for _ in range(password_auth.USER_ATTEMPTS - 1):
        login(password="no-es-esta-1")
    assert login()[1].status_code == 200
    assert login(password="no-es-esta-1")[1].status_code == 401
    assert login()[1].status_code == 200


def test_el_bloqueo_caduca(db, admin):  # noqa: F811
    register()
    for _ in range(password_auth.USER_ATTEMPTS):
        login(password="no-es-esta-1")
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    asyncio.run(db.login_attempts.update_one({"key": "login-user:martin.g"}, {"$set": {"expires_at": past}}))
    assert login()[1].status_code == 200


def test_limite_de_fallos_por_conexion(admin, monkeypatch):
    monkeypatch.setattr(password_auth, "IP_ATTEMPTS", 3)
    for number in range(3):
        login(f"inventado{number}", "no-es-esta-1")
    assert login("otro.distinto", "no-es-esta-1")[1].status_code == 429


def test_limite_de_registros_por_conexion(admin, monkeypatch):
    monkeypatch.setattr(password_auth, "IP_REGISTRATIONS", 2)
    assert register(username="uno.uno")[1].status_code == 201
    assert register(username="dos.dos")[1].status_code == 201
    assert register(username="tres.tres")[1].status_code == 429


def test_cambiar_contrasena(admin):
    client, _ = register()
    other_session, _ = login()
    response = client.post("/api/auth/password", json={"current_password": GOOD_PASSWORD, "new_password": NEW_PASSWORD})
    assert response.status_code == 200, response.text
    assert client.get("/api/auth/me").status_code == 200
    assert other_session.get("/api/auth/me").status_code == 401
    assert login(password=GOOD_PASSWORD)[1].status_code == 401
    assert login(password=NEW_PASSWORD)[1].status_code == 200


@pytest.mark.parametrize(
    "current,new,status",
    [
        ("no-es-esta-1", NEW_PASSWORD, 400),
        (GOOD_PASSWORD, GOOD_PASSWORD, 422),
        (GOOD_PASSWORD, "corta12", 422),
        (GOOD_PASSWORD, "martin.g-2025", 422),
    ],
)
def test_cambios_de_contrasena_no_validos(admin, current, new, status):
    client, _ = register()
    response = client.post("/api/auth/password", json={"current_password": current, "new_password": new})
    assert response.status_code == status
    assert login()[1].status_code == 200


def test_cambiar_contrasena_exige_sesion_y_cuenta_con_contrasena(admin):
    body = {"current_password": GOOD_PASSWORD, "new_password": NEW_PASSWORD}
    assert anonymous().post("/api/auth/password", json=body).status_code == 401
    assert client_for("token-ana").post("/api/auth/password", json=body).status_code == 409


def test_fallar_la_contrasena_actual_se_bloquea(admin):
    client, _ = register()
    body = {"current_password": "no-es-esta-1", "new_password": NEW_PASSWORD}
    for _ in range(password_auth.USER_ATTEMPTS):
        assert client.post("/api/auth/password", json=body).status_code == 400
    assert client.post("/api/auth/password", json=body).status_code == 429


def temporary_password(admin, user_id):
    response = admin.post(f"/api/users/{user_id}/temporary-password")
    assert response.status_code == 200, response.text
    return response.json()["temporary_password"]


def test_contrasena_temporal_obliga_a_cambiarla(admin):
    client, response = register()
    user_id = response.json()["id"]
    approve(admin, user_id)
    assert client.get("/api/chat/channels").status_code == 200

    temporary = temporary_password(admin, user_id)
    assert client.get("/api/auth/me").status_code == 401  # Se cierran sus sesiones.
    assert login(password=GOOD_PASSWORD)[1].status_code == 401

    client, response = login(password=temporary)
    assert response.status_code == 200
    assert response.json()["must_change_password"] is True
    for path in ("/api/chat/channels", "/api/players?team_id=femenino"):
        assert client.get(path).status_code == 403

    changed = client.post("/api/auth/password", json={"current_password": temporary, "new_password": NEW_PASSWORD})
    assert changed.status_code == 200, changed.text
    assert changed.json()["must_change_password"] is False
    assert client.get("/api/chat/channels").status_code == 200
    assert login(password=temporary)[1].status_code == 401


def test_contrasena_temporal_caduca(db, admin):  # noqa: F811
    _, response = register()
    temporary = temporary_password(admin, response.json()["id"])
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    asyncio.run(db.users.update_one({"username": "martin.g"}, {"$set": {"temporary_password_expires_at": past}}))
    assert login(password=temporary)[1].status_code == 401


def test_contrasena_temporal_desbloquea_la_cuenta(admin):
    _, response = register()
    for _ in range(password_auth.USER_ATTEMPTS):
        login(password="no-es-esta-1")
    temporary = temporary_password(admin, response.json()["id"])
    assert login(password=temporary)[1].status_code == 200


def test_solo_un_admin_crea_contrasenas_temporales(admin):
    _, response = register()
    user_id = response.json()["id"]
    other, other_response = register(username="otra.persona")
    approve(admin, other_response.json()["id"], role="entrenador")
    assert anonymous().post(f"/api/users/{user_id}/temporary-password").status_code == 401
    assert other.post(f"/api/users/{user_id}/temporary-password").status_code == 403
    assert login()[1].status_code == 200


def test_contrasena_temporal_no_vale_para_google_ni_para_uno_mismo(admin):
    ana = client_for("token-ana").get("/api/auth/me").json()["id"]
    me = admin.get("/api/auth/me").json()["id"]
    assert admin.post(f"/api/users/{ana}/temporary-password").status_code == 409
    assert admin.post(f"/api/users/{me}/temporary-password").status_code == 409
    assert admin.post("/api/users/nadie/temporary-password").status_code == 404


def test_aprobado_entra_en_plantilla_como_las_cuentas_de_google(admin):
    client, response = register()
    approve(admin, response.json()["id"])
    roster = admin.get("/api/players?team_id=femenino").json()
    assert [player["name"] for player in roster] == ["Martín García"]
    assert client.get("/api/chat/channels").status_code == 200


def test_registrarse_no_convierte_en_admin_aunque_el_nombre_coincida(admin):
    _, response = register(username="admin.club", name="admin@club.es")
    assert response.json()["role"] is None
    assert response.json()["status"] == "pending"


def test_un_admin_puede_quitar_el_acceso_a_una_cuenta_con_usuario(admin):
    client, response = register()
    user_id = response.json()["id"]
    approve(admin, user_id)
    assert admin.patch(f"/api/users/{user_id}", json={"status": "rejected"}).status_code == 200
    assert client.get("/api/chat/channels").status_code == 403


def test_el_admin_de_google_puede_crearse_usuario_y_contrasena_y_entrar_sin_google(admin):
    response = admin.post("/api/auth/password/setup", json={"username": "marcos.admin", "password": GOOD_PASSWORD})
    assert response.status_code == 200, response.text
    assert response.json()["has_password"] is True
    assert response.json()["username"] == "marcos.admin"

    client, response = login("marcos.admin")
    assert response.status_code == 200, response.text
    assert (response.json()["role"], response.json()["status"]) == ("admin", "approved")
    assert client.get("/api/users").status_code == 200


def test_crear_contrasena_solo_vale_una_vez(admin):
    assert admin.post("/api/auth/password/setup", json={"username": "marcos.admin", "password": GOOD_PASSWORD}).status_code == 200
    again = admin.post("/api/auth/password/setup", json={"username": "otro.admin", "password": NEW_PASSWORD})
    assert again.status_code == 409
    _, response = login("otro.admin", NEW_PASSWORD)
    assert response.status_code == 401


def test_quien_ya_tiene_contrasena_no_puede_crear_otra(admin):
    client, _ = register()
    response = client.post("/api/auth/password/setup", json={"username": "martin.nuevo", "password": NEW_PASSWORD})
    assert response.status_code == 409


def test_crear_contrasena_exige_sesion(admin):
    response = anonymous().post("/api/auth/password/setup", json={"username": "nadie.aqui", "password": GOOD_PASSWORD})
    assert response.status_code == 401


def test_crear_contrasena_no_deja_usuarios_ocupados_ni_reservados(admin):
    register()
    taken = admin.post("/api/auth/password/setup", json={"username": "martin.g", "password": NEW_PASSWORD})
    assert taken.status_code == 409
    reserved = admin.post("/api/auth/password/setup", json={"username": "admin", "password": NEW_PASSWORD})
    assert reserved.status_code == 422
    weak = admin.post("/api/auth/password/setup", json={"username": "marcos.admin", "password": "marcos.admin-1"})
    assert weak.status_code == 422
