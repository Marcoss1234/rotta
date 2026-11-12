import asyncio

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

import auth
import clubs
import database
import players
import roster_sync
from server import app
from test_auth import fake_verify


@pytest.fixture
def mongo(monkeypatch):
    """Sin atajos: la base de cada petición sale de la lista de clubs, como en el servidor de verdad."""
    client = AsyncMongoMockClient()
    monkeypatch.setattr(database, "_client", client)
    monkeypatch.setenv("MONGO_URL", "mongodb://simulado")
    monkeypatch.delenv("DB_NAME", raising=False)
    monkeypatch.delenv("DEFAULT_CLUB", raising=False)
    monkeypatch.setenv("ROOT_DOMAIN", "rotta.app")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "cliente-de-prueba")
    monkeypatch.setenv("ADMIN_EMAILS", "admin@club.es")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setattr(auth, "verify_google_token", fake_verify)
    for module, flag in ((auth, "_indexes_ready"), (players, "_indexes_ready"), (roster_sync, "_index_ready")):
        monkeypatch.setattr(module, flag, False)
    app.dependency_overrides.clear()
    clubs.forget_cache()
    asyncio.run(clubs.create_club(client, "tnt", "C.V. TNT Almería"))
    asyncio.run(clubs.create_club(client, "mintonette", "Mintonette"))
    yield client
    clubs.forget_cache()


def admin_of(club):
    client = TestClient(app, base_url="http://testserver", headers={"X-Club": club})
    response = client.post("/api/auth/google", json={"credential": "token-admin"})
    assert response.status_code == 200, response.text
    # Los índices de fichas, antes de meter datos (la base simulada falla si no).
    for module, flag in ((players, "_indexes_ready"), (roster_sync, "_index_ready")):
        setattr(module, flag, False)
    return client


def test_cada_club_tiene_su_base_y_no_ve_la_del_otro(mongo):
    tnt = admin_of("tnt")
    assert tnt.post("/api/players", json={"team_id": "femenino", "name": "Lucía"}).status_code == 201
    mintonette = admin_of("mintonette")
    assert mintonette.get("/api/players?team_id=femenino").json() == []
    assert [player["name"] for player in tnt.get("/api/players?team_id=femenino").json()] == ["Lucía"]
    assert asyncio.run(mongo["club_tnt"].players.count_documents({})) == 1
    assert asyncio.run(mongo["club_mintonette"].players.count_documents({})) == 0


def test_la_sesion_de_un_club_no_vale_en_otro(mongo):
    tnt = admin_of("tnt")
    # Misma cookie, otro club: no entra (cada club tiene su cookie y sus sesiones).
    stolen = TestClient(app, base_url="http://testserver", headers={"X-Club": "mintonette"}, cookies=tnt.cookies)
    assert stolen.get("/api/auth/me").status_code == 401
    assert tnt.get("/api/auth/me").status_code == 200


def test_el_club_sale_del_subdominio_o_del_enlace(mongo):
    tnt = admin_of("tnt")
    session = {"Cookie": f"rotta_session_tnt={tnt.cookies['rotta_session_tnt']}"}
    by_host = TestClient(app, base_url="http://tnt.rotta.app")
    assert by_host.get("/api/auth/me", headers=session).status_code == 200
    by_query = TestClient(app, base_url="http://testserver")
    assert by_query.get("/api/auth/me?club=tnt", headers=session).status_code == 200


def test_un_club_que_no_existe(mongo):
    client = TestClient(app, base_url="http://testserver", headers={"X-Club": "fantasma"})
    response = client.get("/api/club/theme")
    assert response.status_code == 404
    assert client.get("/api/club/theme", headers={"X-Club": "Mal Escrito!"}).status_code == 400


def test_sin_club_y_sin_base_por_defecto_lo_dice(mongo):
    assert TestClient(app, base_url="http://testserver").get("/api/club/theme").status_code == 400


def test_las_fotos_llevan_el_club_en_el_enlace(mongo):
    tnt = admin_of("tnt")
    jpeg = b"\xff\xd8\xff\xe0" + b"0" * 200
    asyncio.run(mongo["club_tnt"].users.update_one({"email": "admin@club.es"}, {"$set": {"consent": {"version": "x", "photos": True}}}))
    tnt.put("/api/profile/avatar", content=jpeg, headers={"Content-Type": "application/octet-stream"})
    picture = tnt.get("/api/auth/me").json()["picture"]
    assert picture.endswith("club=tnt"), picture


def test_no_se_repiten_codigos_de_club(mongo):
    with pytest.raises(ValueError):
        asyncio.run(clubs.create_club(mongo, "tnt", "Otro"))
    with pytest.raises(ValueError):
        asyncio.run(clubs.create_club(mongo, "Con Espacios", "Otro"))
