"""Fase 3 de varios clubs: el nombre y el escudo de cada club."""
import asyncio

from mongomock_motor import AsyncMongoMockClient

import clubs
from test_auth import client_for, db  # noqa: F401

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 100


def upload(client, data, content_type="image/png"):
    return client.put("/api/club/crest", content=data, headers={"Content-Type": content_type})


def test_sin_nombre_ni_escudo_la_app_pone_los_de_rotta(db):  # noqa: F811
    response = client_for().get("/api/club/identity")
    assert response.status_code == 200
    assert response.json() == {"name": None, "crest": None}
    assert client_for().get("/api/club/crest").status_code == 404


def test_el_administrador_pone_el_nombre_y_lo_ve_todo_el_mundo(db):  # noqa: F811
    response = client_for("token-admin").put("/api/club/identity", json={"name": "  C.V. Los Pinos  "})
    assert response.status_code == 200, response.text
    assert client_for().get("/api/club/identity").json()["name"] == "C.V. Los Pinos"


def test_el_escudo_se_sube_se_ve_sin_sesion_y_se_quita(db):  # noqa: F811
    admin = client_for("token-admin")
    crest = upload(admin, PNG).json()["crest"]
    assert crest.startswith("/api/club/crest?v=")

    image = client_for().get(crest)
    assert image.status_code == 200
    assert image.content == PNG
    assert image.headers["content-type"] == "image/png"
    assert image.headers["x-content-type-options"] == "nosniff"

    # Uno nuevo tiene otra dirección, para que los móviles no se queden con el viejo.
    assert upload(admin, WEBP, "image/webp").json()["crest"] != crest

    assert admin.delete("/api/club/crest").json() == {"name": None, "crest": None}
    assert client_for().get("/api/club/crest").status_code == 404


def test_solo_el_administrador_cambia_nombre_y_escudo(db):  # noqa: F811
    for client, status in ((client_for(), 401), (client_for("token-ana"), 403)):
        assert client.put("/api/club/identity", json={"name": "Otro"}).status_code == status
        assert upload(client, PNG).status_code == status
        assert client.delete("/api/club/crest").status_code == status


def test_nombres_y_escudos_que_no_valen(db):  # noqa: F811
    admin = client_for("token-admin")
    assert admin.put("/api/club/identity", json={"name": "X"}).status_code == 422
    assert admin.put("/api/club/identity", json={"name": "x" * 41}).status_code == 422
    assert admin.put("/api/club/identity", json={"name": "<script>"}).status_code == 422
    # Lo que importa es lo que hay dentro, no lo que diga la cabecera. SVG no: puede llevar código.
    assert upload(admin, b"<svg onload=alert(1)></svg>", "image/svg+xml").status_code == 415
    assert upload(admin, b"GIF89a" + b"\x00" * 50, "image/png").status_code == 415
    assert upload(admin, PNG + b"\x00" * 210 * 1024).status_code == 413


def test_un_club_nuevo_sale_ya_con_su_nombre():
    client = AsyncMongoMockClient()
    clubs.forget_cache()
    club = asyncio.run(clubs.create_club(client, "pinos", "C.V. Los Pinos"))
    saved = asyncio.run(client[club["db_name"]].club_settings.find_one({"id": "club"}))
    assert saved["identity"]["name"] == "C.V. Los Pinos"
