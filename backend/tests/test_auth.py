import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import auth  # noqa: E402
from database import get_db  # noqa: E402
from server import app  # noqa: E402

GOOGLE_ACCOUNTS = {
    "token-admin": {"sub": "g-admin", "email": "Admin@Club.es", "email_verified": True, "name": "Admin"},
    "token-ana": {"sub": "g-ana", "email": "ana@gmail.com", "email_verified": True, "name": "Ana"},
    "token-luis": {"sub": "g-luis", "email": "luis@gmail.com", "email_verified": True, "name": "Luis"},
    "token-sin-verificar": {"sub": "g-x", "email": "x@gmail.com", "email_verified": False, "name": "X"},
}


def fake_verify(credential):
    if credential not in GOOGLE_ACCOUNTS:
        raise ValueError("token falso")
    return GOOGLE_ACCOUNTS[credential]


@pytest.fixture
def db(monkeypatch):
    database = AsyncMongoMockClient()["test"]
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "cliente-de-prueba")
    monkeypatch.setenv("ADMIN_EMAILS", "admin@club.es")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setattr(auth, "verify_google_token", fake_verify)
    monkeypatch.setattr(auth, "_indexes_ready", False)
    app.dependency_overrides[get_db] = lambda: database
    yield database
    app.dependency_overrides.clear()


def client_for(token=None):
    client = TestClient(app, base_url="http://testserver")
    if token:
        response = client.post("/api/auth/google", json={"credential": token})
        assert response.status_code == 200, response.text
    return client


def test_token_falso_no_entra(db):
    response = TestClient(app).post("/api/auth/google", json={"credential": "inventado"})
    assert response.status_code == 401


def test_correo_sin_verificar_no_entra(db):
    response = TestClient(app).post("/api/auth/google", json={"credential": "token-sin-verificar"})
    assert response.status_code == 401
    assert "rotta_session" not in response.cookies


def test_sin_configurar_google_no_entra(db, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "")
    response = TestClient(app).post("/api/auth/google", json={"credential": "token-ana"})
    assert response.status_code == 503


def test_sin_sesion_no_hay_datos(db):
    client = TestClient(app)
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/users").status_code == 401
    assert client.patch("/api/users/x", json={"status": "rejected"}).status_code == 401


def test_cookie_inventada_no_vale(db):
    client = TestClient(app)
    client.cookies.set("rotta_session", "inventada", path="/api")
    assert client.get("/api/auth/me").status_code == 401


def test_cuenta_nueva_queda_pendiente_y_sin_acceso(db):
    client = client_for("token-ana")
    me = client.get("/api/auth/me").json()
    assert me["status"] == "pending"
    assert me["role"] is None
    assert client.get("/api/users").status_code == 403


def test_correo_de_admin_entra_como_admin_sin_distinguir_mayusculas(db):
    me = client_for("token-admin").get("/api/auth/me").json()
    assert me["status"] == "approved"
    assert me["role"] == "admin"


def test_la_cookie_es_httponly_y_el_token_no_se_guarda_en_claro(db):
    response = TestClient(app).post("/api/auth/google", json={"credential": "token-ana"})
    header = response.headers["set-cookie"].lower()
    assert "httponly" in header
    assert "samesite=lax" in header
    token = response.cookies["rotta_session"]
    assert token not in response.text

    import asyncio

    stored = asyncio.run(db.sessions.find_one({}))
    assert token not in str(stored)
    assert stored["token_hash"] == auth._hash_token(token)


@pytest.mark.parametrize("value,expected", [("true", True), (None, True), ("false", False)])
def test_cookie_secure_por_defecto(db, monkeypatch, value, expected):
    if value is None:
        monkeypatch.delenv("COOKIE_SECURE")
    else:
        monkeypatch.setenv("COOKIE_SECURE", value)
    response = TestClient(app).post("/api/auth/google", json={"credential": "token-ana"})
    assert ("secure" in response.headers["set-cookie"].lower()) is expected


def test_admin_aprueba_con_rol_y_el_permiso_se_aplica_al_momento(db):
    admin, ana = client_for("token-admin"), client_for("token-ana")
    ana_id = ana.get("/api/auth/me").json()["id"]

    assert admin.patch(f"/api/users/{ana_id}", json={"status": "approved"}).status_code == 422

    response = admin.patch(f"/api/users/{ana_id}", json={"status": "approved", "role": "jugador"})
    assert response.status_code == 200
    me = ana.get("/api/auth/me").json()
    assert (me["status"], me["role"]) == ("approved", "jugador")
    assert ana.get("/api/users").status_code == 403


def test_rol_inventado_no_vale(db):
    admin, ana = client_for("token-admin"), client_for("token-ana")
    ana_id = ana.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{ana_id}", json={"status": "approved", "role": "jefe"})
    assert response.status_code == 422


@pytest.mark.parametrize("role", ["jugador", "familia", "entrenador"])
def test_solo_el_admin_gestiona_usuarios(db, role):
    admin, ana, luis = client_for("token-admin"), client_for("token-ana"), client_for("token-luis")
    ana_id = ana.get("/api/auth/me").json()["id"]
    luis_id = luis.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{ana_id}", json={"status": "approved", "role": role})

    assert ana.get("/api/users").status_code == 403
    response = ana.patch(f"/api/users/{luis_id}", json={"status": "approved", "role": "admin"})
    assert response.status_code == 403
    assert luis.get("/api/auth/me").json()["status"] == "pending"


def test_pendiente_no_puede_aprobarse_a_si_mismo(db):
    ana = client_for("token-ana")
    ana_id = ana.get("/api/auth/me").json()["id"]
    response = ana.patch(f"/api/users/{ana_id}", json={"status": "approved", "role": "admin"})
    assert response.status_code == 403


def test_admin_no_puede_quitarse_su_acceso(db):
    admin = client_for("token-admin")
    admin_id = admin.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{admin_id}", json={"status": "rejected"})
    assert response.status_code == 409


def test_otro_admin_no_puede_quitar_a_un_admin_de_la_configuracion(db):
    admin, ana = client_for("token-admin"), client_for("token-ana")
    admin_id = admin.get("/api/auth/me").json()["id"]
    ana_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{ana_id}", json={"status": "approved", "role": "admin"})
    response = ana.patch(f"/api/users/{admin_id}", json={"status": "rejected"})
    assert response.status_code == 409


def test_rechazado_pierde_el_acceso_y_no_lo_recupera_al_volver_a_entrar(db):
    admin, ana = client_for("token-admin"), client_for("token-ana")
    ana_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{ana_id}", json={"status": "approved", "role": "admin"})
    assert ana.get("/api/users").status_code == 200

    admin.patch(f"/api/users/{ana_id}", json={"status": "rejected"})
    assert ana.get("/api/users").status_code == 403

    again = client_for("token-ana").get("/api/auth/me").json()
    assert (again["status"], again["role"]) == ("rejected", None)


def test_volver_a_entrar_no_cambia_el_rol(db):
    admin, ana = client_for("token-admin"), client_for("token-ana")
    ana_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{ana_id}", json={"status": "approved", "role": "familia"})
    again = client_for("token-ana").get("/api/auth/me").json()
    assert again["id"] == ana_id
    assert again["role"] == "familia"


def test_cerrar_sesion_invalida_la_cookie(db):
    ana = client_for("token-ana")
    cookie = ana.cookies["rotta_session"]
    assert ana.post("/api/auth/logout").status_code == 204

    stale = TestClient(app)
    stale.cookies.set("rotta_session", cookie, path="/api")
    assert stale.get("/api/auth/me").status_code == 401


def test_rutas_publicas_antiguas_desactivadas_por_defecto(db):
    client = TestClient(app)
    assert client.get("/api/status").status_code == 404
    body = {
        "nombre": "Ana", "email": "a@b.es", "telefono": "600000000",
        "categoria": "Club Escuela", "posicion": "Líbero",
    }
    assert client.post("/api/inscripciones", json=body).status_code == 404


def test_admin_asigna_equipo_al_aprobar_y_lo_cambia_despues(db):
    admin, ana = client_for("token-admin"), client_for("token-ana")
    assert ana.get("/api/auth/me").json()["team_id"] is None
    ana_id = ana.get("/api/auth/me").json()["id"]

    approved = admin.patch(f"/api/users/{ana_id}", json={"status": "approved", "role": "jugador", "team_id": "femenino"})
    assert approved.json()["team_id"] == "femenino"

    changed = admin.patch(f"/api/users/{ana_id}", json={"team_id": "playa"})
    assert changed.status_code == 200
    assert changed.json()["team_id"] == "playa"
    assert changed.json()["role"] == "jugador"
    assert changed.json()["status"] == "approved"

    cleared = admin.patch(f"/api/users/{ana_id}", json={"team_id": None})
    assert cleared.json()["team_id"] is None


def test_cambiar_el_rol_no_borra_el_equipo(db):
    admin, ana = client_for("token-admin"), client_for("token-ana")
    ana_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{ana_id}", json={"status": "approved", "role": "jugador", "team_id": "femenino"})
    assert admin.patch(f"/api/users/{ana_id}", json={"role": "familia"}).json()["team_id"] == "femenino"


def test_admin_puede_cambiar_su_propio_equipo_pero_no_su_acceso(db):
    admin = client_for("token-admin")
    admin_id = admin.get("/api/auth/me").json()["id"]
    assert admin.patch(f"/api/users/{admin_id}", json={"team_id": "masculino"}).json()["team_id"] == "masculino"
    assert admin.patch(f"/api/users/{admin_id}", json={"team_id": "playa", "status": "rejected"}).status_code == 409
    assert admin.get("/api/auth/me").json()["team_id"] == "masculino"


def test_asignar_equipo_no_da_acceso_a_quien_esta_pendiente(db):
    admin, ana = client_for("token-admin"), client_for("token-ana")
    ana_id = ana.get("/api/auth/me").json()["id"]
    assert admin.patch(f"/api/users/{ana_id}", json={"team_id": "femenino"}).status_code == 200
    me = ana.get("/api/auth/me").json()
    assert (me["status"], me["team_id"]) == ("pending", "femenino")
    assert ana.get("/api/players?team_id=femenino").status_code == 403


def test_solo_el_admin_asigna_equipos(db):
    admin, ana = client_for("token-admin"), client_for("token-ana")
    ana_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{ana_id}", json={"status": "approved", "role": "entrenador"})
    assert ana.patch(f"/api/users/{ana_id}", json={"team_id": "femenino"}).status_code == 403


def test_equipo_inventado_no_vale(db):
    admin, ana = client_for("token-admin"), client_for("token-ana")
    ana_id = ana.get("/api/auth/me").json()["id"]
    assert admin.patch(f"/api/users/{ana_id}", json={"team_id": "inventado"}).status_code == 422


def test_cambio_vacio_no_vale(db):
    admin, ana = client_for("token-admin"), client_for("token-ana")
    ana_id = ana.get("/api/auth/me").json()["id"]
    assert admin.patch(f"/api/users/{ana_id}", json={}).status_code == 422


def test_sesion_caducada_no_vale(db):
    from datetime import datetime, timedelta, timezone

    client = client_for("token-ana")
    assert client.get("/api/auth/me").status_code == 200
    import asyncio

    asyncio.run(
        db.sessions.update_many({}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}})
    )
    assert client.get("/api/auth/me").status_code == 401


def test_config_devuelve_solo_el_cliente_publico(db):
    data = TestClient(app).get("/api/auth/config").json()
    assert data == {"google_client_id": "cliente-de-prueba"}
    assert "ADMIN" not in str(data)
    assert os.environ["GOOGLE_CLIENT_ID"] == "cliente-de-prueba"
