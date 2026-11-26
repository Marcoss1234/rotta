import asyncio
import importlib.util
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from server import app
from test_auth import db  # noqa: F401

# tools/crear-admin.py lleva guion en el nombre: se carga por su ruta.
_spec = importlib.util.spec_from_file_location("crear_admin", Path(__file__).resolve().parents[2] / "tools" / "crear-admin.py")
crear_admin = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(crear_admin)


def test_crea_un_administrador_que_entra_con_la_temporal_y_debe_cambiarla(db):  # noqa: F811
    user, temporary = asyncio.run(crear_admin.create_admin(db, "Marcos", "Marcos Niño"))
    assert user["username"] == "marcos" and user["role"] == "admin" and user["status"] == "approved"
    stored = asyncio.run(db.users.find_one({"username": "marcos"}))
    # La contraseña solo se guarda cifrada.
    assert temporary not in str(stored)
    client = TestClient(app, base_url="http://testserver")
    response = client.post("/api/auth/login", json={"username": "marcos", "password": temporary})
    assert response.status_code == 200, response.text
    me = client.get("/api/auth/me").json()
    assert me["role"] == "admin"
    assert me["must_change_password"] is True


def test_no_pisa_una_cuenta_que_ya_existe(db):  # noqa: F811
    asyncio.run(crear_admin.create_admin(db, "marcos", "Marcos"))
    with pytest.raises(crear_admin.AccountError, match="Ya hay una cuenta"):
        asyncio.run(crear_admin.create_admin(db, "marcos", "Otro"))


@pytest.mark.parametrize("username", ["admin", "ab", "Con Espacio", "tnt"])
def test_usuarios_no_validos_o_reservados(db, username):  # noqa: F811
    with pytest.raises(crear_admin.AccountError):
        asyncio.run(crear_admin.create_admin(db, username, "Marcos"))
