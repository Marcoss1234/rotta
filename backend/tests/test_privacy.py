import asyncio

import privacy
from test_auth import client_for, db  # noqa: F401
from test_profile import JPEG, admin, member, reset_indexes, upload  # noqa: F401

ADULT = {"accepted": True, "adult": True, "photos": True}


def me(client):
    return client.get("/api/auth/me").json()


def test_sin_aceptar_no_hay_consentimiento(db):  # noqa: F811
    assert me(client_for("token-ana"))["consent"] is None


def test_un_adulto_acepta_la_politica(db):  # noqa: F811
    ana = client_for("token-ana")
    response = ana.put("/api/profile/consent", json=ADULT)
    assert response.status_code == 200, response.text
    assert me(ana)["consent"] == {"version": privacy.POLICY_VERSION, "adult": True, "photos": True}


def test_un_menor_necesita_el_nombre_del_tutor(db):  # noqa: F811
    ana = client_for("token-ana")
    minor = {"accepted": True, "adult": False, "photos": False}
    assert ana.put("/api/profile/consent", json=minor).status_code == 422
    response = ana.put("/api/profile/consent", json={**minor, "guardian_name": "Rosa Jiménez"})
    assert response.status_code == 200, response.text
    saved = asyncio.run(db.users.find_one({"id": me(ana)["id"]}))
    assert saved["consent"]["guardian_name"] == "Rosa Jiménez"
    # El nombre del tutor no sale en la app.
    assert "guardian_name" not in me(ana)["consent"]


def test_hay_que_aceptar_de_verdad(db):  # noqa: F811
    assert client_for("token-ana").put("/api/profile/consent", json={**ADULT, "accepted": False}).status_code == 422


def test_sin_permiso_para_fotos_no_se_ve_ni_se_sube(admin):  # noqa: F811
    ana = member(admin)
    assert upload(ana).status_code == 200
    assert me(ana)["picture"]
    ana.put("/api/profile/consent", json={**ADULT, "photos": False})
    assert me(ana)["picture"] == ""
    assert upload(ana).status_code == 403


def test_borrar_la_cuenta_borra_todo_lo_suyo(admin, db):  # noqa: F811
    ana = member(admin)
    user_id = me(ana)["id"]
    player_id = asyncio.run(db.players.find_one({"user_id": user_id}))["id"]
    upload(ana)
    ana.post("/api/chat/channels/femenino/messages", json={"text": "Hola"})
    asyncio.run(db.ratings.insert_one({"player_id": player_id, "week": "2026-11-09", "group_id": "femenino"}))
    asyncio.run(db.coin_entries.insert_one({"user_id": user_id, "amount": 10, "ref": "x"}))
    asyncio.run(db.training_stars.insert_one({"team_id": "femenino", "date": "2026-11-10", "user_ids": [user_id, "otra"]}))

    assert ana.request("DELETE", "/api/profile", json={"confirm": "BORRAR"}).status_code == 204

    assert asyncio.run(db.users.find_one({"id": user_id})) is None
    assert asyncio.run(db.players.find_one({"id": player_id})) is None
    for name in ("chat_messages", "avatars", "coin_entries", "sessions"):
        assert asyncio.run(db[name].count_documents({"user_id": user_id})) == 0, name
    assert asyncio.run(db.ratings.count_documents({"player_id": player_id})) == 0
    stars = asyncio.run(db.training_stars.find_one({"date": "2026-11-10"}))
    assert stars["user_ids"] == ["otra"]
    # La sesión ya no vale.
    assert ana.get("/api/auth/me").status_code == 401


def test_borrar_pide_confirmacion(db):  # noqa: F811
    ana = client_for("token-ana")
    assert ana.request("DELETE", "/api/profile", json={"confirm": "si"}).status_code == 422
    assert me(ana)["id"]


def test_el_administrador_principal_no_se_borra(db):  # noqa: F811
    admin_client = client_for("token-admin")
    assert admin_client.request("DELETE", "/api/profile", json={"confirm": "BORRAR"}).status_code == 409
