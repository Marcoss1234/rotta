import asyncio
import json

from test_auth import client_for, db  # noqa: F401


def test_el_administrador_descarga_la_copia(db):  # noqa: F811
    admin = client_for("token-admin")
    admin.post("/api/chat/channels/general/messages", json={"text": "Hola"})
    response = admin.get("/api/admin/backup")
    assert response.status_code == 200, response.text
    assert "attachment" in response.headers["content-disposition"]
    data = json.loads(response.text)
    assert data["counts"]["users"] >= 1
    assert data["collections"]["chat_messages"][0]["text"] == "Hola"
    assert "_id" not in data["collections"]["users"][0]
    assert "sessions" not in data["collections"]


def test_la_copia_no_lleva_contrasenas(db):  # noqa: F811
    admin = client_for("token-admin")
    asyncio.run(db.users.update_many({}, {"$set": {"password_hash": "secreto", "temporary_password": "x"}}))
    text = admin.get("/api/admin/backup").text
    assert "secreto" not in text
    assert "temporary_password" not in text


def test_solo_los_administradores(db):  # noqa: F811
    admin = client_for("token-admin")
    ana = client_for("token-ana")
    user_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{user_id}", json={"status": "approved", "role": "entrenador", "team_id": "femenino"})
    assert ana.get("/api/admin/backup").status_code == 403
