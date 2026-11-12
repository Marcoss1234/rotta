"""Club Coins y premios del ranking: lo que se gana queda apuntado una sola vez, con su motivo.

Este módulo no importa nada de la app para que lo puedan usar los jugadores, el ranking y la asistencia.
"""

from datetime import datetime, timezone
from uuid import uuid4

from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

# Corona que lleva el personaje: la del jugador del mes manda sobre la de la semana.
CROWN_BY_PLACE = {1: "gold", 2: "silver", 3: "bronze"}

_indexes_ready = False


async def ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    # `ref` dice de dónde salen los coins: con él, el mismo premio nunca se da dos veces.
    await db.coin_entries.create_index([("ref", ASCENDING)], unique=True)
    await db.coin_entries.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    await db.honors.create_index(
        [("group_id", ASCENDING), ("kind", ASCENDING), ("period", ASCENDING), ("player_id", ASCENDING)],
        unique=True,
    )
    _indexes_ready = True


async def give_coins(db, user_id, amount, kind, label, ref):
    """Suma (o resta) coins. Devuelve False si ese premio ya estaba dado."""
    if not user_id or not amount:
        return False
    await ensure_indexes(db)
    try:
        await db.coin_entries.insert_one(
            {
                "id": str(uuid4()),
                "user_id": user_id,
                "amount": amount,
                "kind": kind,
                "label": label,
                "ref": ref,
                "created_at": datetime.now(timezone.utc),
            }
        )
    except DuplicateKeyError:
        return False
    return True


async def set_coins(db, user_id, amount, kind, label, ref):
    """Deja los coins de `ref` en `amount` (0 los quita). Devuelve cuánto ha cambiado el saldo."""
    if not user_id:
        return 0
    await ensure_indexes(db)
    current = await db.coin_entries.find_one({"ref": ref})
    before = current["amount"] if current else 0
    if amount == before:
        return 0
    if not amount:
        await db.coin_entries.delete_one({"ref": ref})
    elif current:
        await db.coin_entries.update_one({"ref": ref}, {"$set": {"amount": amount, "created_at": datetime.now(timezone.utc)}})
    else:
        if not await give_coins(db, user_id, amount, kind, label, ref):
            return 0
    return amount - before


async def give_honor(db, *, group_id, kind, period, player_id, user_id, place, title, coins, current):
    """Apunta un premio del ranking y sus coins. Devuelve False si ya estaba dado."""
    await ensure_indexes(db)
    try:
        await db.honors.insert_one(
            {
                "id": str(uuid4()),
                "group_id": group_id,
                "kind": kind,
                "period": period,
                "player_id": player_id,
                "user_id": user_id,
                "place": place,
                "title": title,
                "coins": coins,
                "current": current,
                "created_at": datetime.now(timezone.utc),
            }
        )
    except DuplicateKeyError:
        return False
    await give_coins(db, user_id, coins, f"ranking_{kind}", title, f"honor:{group_id}:{kind}:{period}:{player_id}")
    return True


async def balance_of(db, user_id):
    entries = await db.coin_entries.find({"user_id": user_id}, {"amount": 1}).to_list(100000)
    return sum(entry["amount"] for entry in entries)


async def crowns_by_user(db, user_ids):
    """La corona de cada uno ahora mismo: "month" (jugador del mes), o gold/silver/bronze (podio de la semana)."""
    ids = [user_id for user_id in user_ids if user_id]
    if not ids:
        return {}
    honors = await db.honors.find({"user_id": {"$in": ids}, "current": True}).to_list(1000)
    crowns = {}
    for honor in honors:
        if honor["kind"] == "month" and honor["place"] == 1:
            crowns[honor["user_id"]] = "month"
    for honor in sorted(honors, key=lambda item: item["place"]):
        if honor["kind"] == "week":
            crowns.setdefault(honor["user_id"], CROWN_BY_PLACE.get(honor["place"]))
    return {user_id: crown for user_id, crown in crowns.items() if crown}
