import asyncio
from datetime import datetime, timezone

import honors
from test_auth import client_for, db  # noqa: F401
from test_characters import member, save


def give(db, client, amount):  # noqa: F811
    me = client.get("/api/auth/me").json()["id"]
    asyncio.run(
        db.coin_entries.insert_one(
            {"id": "x", "user_id": me, "amount": amount, "kind": "test", "label": "Regalo", "ref": f"test:{me}", "created_at": datetime.now(timezone.utc)}
        )
    )


def test_la_tienda_lista_lo_que_hay_y_lo_que_tienes(db):  # noqa: F811
    honors._indexes_ready = False
    ana = member(client_for("token-admin"))
    shop = ana.get("/api/shop").json()
    assert shop["balance"] == 0 and len(shop["items"]) > 5 and not any(item["owned"] for item in shop["items"])


def test_comprar_cobra_una_vez_y_se_puede_llevar(db):  # noqa: F811
    honors._indexes_ready = False
    ana = member(client_for("token-admin"))
    # Sin comprar, no se puede llevar.
    assert save(ana, hair_color="oro").status_code == 403
    assert save(ana, glasses="sol").status_code == 403
    assert ana.post("/api/shop/buy", json={"item_id": "glasses:sol"}).status_code == 422
    give(db, ana, 500)
    bought = ana.post("/api/shop/buy", json={"item_id": "glasses:sol"})
    assert bought.status_code == 200 and bought.json()["balance"] == 350
    assert ana.post("/api/shop/buy", json={"item_id": "glasses:sol"}).status_code == 409
    assert ana.post("/api/shop/buy", json={"item_id": "nada"}).status_code == 404
    assert save(ana, glasses="sol").status_code == 200
    assert ana.get("/api/profile").json()["owned_items"] == ["glasses:sol"]
    assert ana.get("/api/coins").json()["entries"][0]["label"] == "Tienda: Gafas de sol"
    # Lo normal sigue siendo gratis.
    assert save(ana, glasses="none", hair_color="rubio").status_code == 200
