"""Tienda de Club Coins: cosas para el personaje que se compran una vez y quedan para siempre."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from database import get_db
from honors import balance_of, give_coins
from players import require_approved

# Precios altos a propósito: lo bueno de la tienda (efectos y camisetas, 500-700) tiene que costar meses de entrenos.
# Cada objeto es "tipo:valor". El valor es el que se guarda en el personaje (y debe existir en looks.js).
CATALOG = [
    {"id": "remate:fuego", "category": "efectos", "name": "Remate de fuego", "price": 600, "hex": "#ff5a1f"},
    {"id": "remate:rayo", "category": "efectos", "name": "Remate eléctrico", "price": 600, "hex": "#22d3ee"},
    {"id": "remate:galaxia", "category": "efectos", "name": "Remate galaxia", "price": 650, "hex": "#8b5cf6"},
    {"id": "remate:oro", "category": "efectos", "name": "Remate de oro", "price": 700, "hex": "#ffc94d"},
    {"id": "recepcion:fuego", "category": "efectos", "name": "Recepción de fuego", "price": 550, "hex": "#ff5a1f"},
    {"id": "recepcion:rayo", "category": "efectos", "name": "Recepción eléctrica", "price": 550, "hex": "#22d3ee"},
    {"id": "recepcion:galaxia", "category": "efectos", "name": "Recepción galaxia", "price": 600, "hex": "#8b5cf6"},
    {"id": "recepcion:oro", "category": "efectos", "name": "Recepción de oro", "price": 600, "hex": "#ffc94d"},
    {"id": "recepcion:hielo", "category": "efectos", "name": "Recepción de hielo", "price": 500, "hex": "#7dd3fc"},
    {"id": "colocacion:fuego", "category": "efectos", "name": "Colocación de fuego", "price": 550, "hex": "#ff5a1f"},
    {"id": "colocacion:rayo", "category": "efectos", "name": "Colocación eléctrica", "price": 550, "hex": "#22d3ee"},
    {"id": "colocacion:galaxia", "category": "efectos", "name": "Colocación galaxia", "price": 600, "hex": "#a855f7"},
    {"id": "colocacion:oro", "category": "efectos", "name": "Colocación de oro", "price": 600, "hex": "#ffc94d"},
    {"id": "colocacion:estrellas", "category": "efectos", "name": "Colocación de estrellas", "price": 500, "hex": "#fff3b0"},
    {"id": "shirt:rayo", "category": "camisetas", "name": "Camiseta Club Rayo", "price": 500, "hex": "#22d3ee"},
    {"id": "shirt:fuego", "category": "camisetas", "name": "Camiseta Club Fuego", "price": 550, "hex": "#f97316"},
    {"id": "shirt:bomba", "category": "camisetas", "name": "Camiseta Club Bomba", "price": 650, "hex": "#ff3800"},
    {"id": "shirt:telarana", "category": "camisetas", "name": "Camiseta Club Telaraña", "price": 600, "hex": "#f4f4f5"},
    {"id": "shirt:cuervo", "category": "camisetas", "name": "Camiseta Club Cuervo", "price": 600, "hex": "#ff6b00"},
    {"id": "shirt:oro", "category": "camisetas", "name": "Camiseta Club Oro", "price": 700, "hex": "#e8b923"},
    {"id": "hair:neon-verde", "category": "pelo", "name": "Pelo verde neón", "price": 200, "hex": "#39ff14"},
    {"id": "hair:neon-rosa", "category": "pelo", "name": "Pelo rosa neón", "price": 200, "hex": "#ff2bd6"},
    {"id": "hair:morado", "category": "pelo", "name": "Pelo morado galaxia", "price": 200, "hex": "#7c3aed"},
    {"id": "hair:fuego", "category": "pelo", "name": "Pelo rojo fuego", "price": 250, "hex": "#e11d1d"},
    {"id": "hair:plata", "category": "pelo", "name": "Pelo plateado", "price": 300, "hex": "#d7dce2"},
    {"id": "hair:oro", "category": "pelo", "name": "Pelo dorado", "price": 500, "hex": "#f5c542"},
    {"id": "accent:fuego", "category": "equipacion", "name": "Cinta y muñequeras rojo fuego", "price": 150, "hex": "#e11d1d"},
    {"id": "accent:neon", "category": "equipacion", "name": "Cinta y muñequeras neón", "price": 180, "hex": "#39ff14"},
    {"id": "accent:oro", "category": "equipacion", "name": "Cinta y muñequeras doradas", "price": 300, "hex": "#e8b923"},
    {"id": "shoes:neon", "category": "zapatillas", "name": "Zapatillas neón", "price": 300, "hex": "#39ff14"},
    {"id": "shoes:oro", "category": "zapatillas", "name": "Zapatillas doradas", "price": 500, "hex": "#e8b923"},
    {"id": "glasses:redondas", "category": "gafas", "name": "Gafas redondas", "price": 120, "hex": None},
    {"id": "glasses:sol", "category": "gafas", "name": "Gafas de sol", "price": 150, "hex": None},
    {"id": "glasses:deporte", "category": "gafas", "name": "Gafas deportivas", "price": 200, "hex": None},
]
BY_ID = {item["id"]: item for item in CATALOG}

router = APIRouter(prefix="/api/shop")


class Purchase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_id: str = Field(min_length=1, max_length=40)


def owned_items(user):
    return set(user.get("owned_items", []))


def required_items(character):
    """Lo que hace falta haber comprado para llevar este personaje."""
    needed = set()
    for field in ("hair_color", "hair_color2"):
        needed.add(f"hair:{character.get(field)}")
    for field in ("headband", "wristbands"):
        needed.add(f"accent:{character.get(field)}")
    needed.add(f"shoes:{character.get('shoes')}")
    needed.add(f"glasses:{character.get('glasses')}")
    needed.add(f"shirt:{character.get('shirt')}")
    for action in ("remate", "recepcion", "colocacion"):
        needed.add(f"{action}:{character.get(f'fx_{action}')}")
    return {item for item in needed if item in BY_ID}


@router.get("")
async def get_shop(user=Depends(require_approved), db=Depends(get_db)):
    from coins import sync_answer_coins  # Aquí dentro: coins usa la asistencia, que no hace falta al importar la tienda.

    await sync_answer_coins(db, user)
    owned = owned_items(user)
    return {
        "balance": await balance_of(db, user["id"]),
        "items": [{**item, "owned": item["id"] in owned} for item in CATALOG],
    }


@router.post("/buy")
async def buy(body: Purchase, user=Depends(require_approved), db=Depends(get_db)):
    item = BY_ID.get(body.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Ese objeto no está en la tienda")
    if item["id"] in owned_items(user):
        raise HTTPException(status_code=409, detail="Ya lo tienes")
    balance = await balance_of(db, user["id"])
    if balance < item["price"]:
        raise HTTPException(status_code=422, detail=f"Te faltan {item['price'] - balance} Club Coins")
    # El cobro va con su referencia: aunque se pulse dos veces, solo se cobra una.
    if await give_coins(db, user["id"], -item["price"], "shop", f"Tienda: {item['name']}", f"shop:{user['id']}:{item['id']}"):
        await db.users.update_one({"id": user["id"]}, {"$addToSet": {"owned_items": item["id"]}})
    return {"balance": await balance_of(db, user["id"]), "item": {**item, "owned": True}}
