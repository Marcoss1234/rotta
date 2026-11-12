from typing import Literal, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ReturnDocument

from database import get_db
from players import require_approved
from shop import owned_items, required_items
from user_profile import _profile_response

# El personaje de cada uno: el mismo muñeco que sale en la pizarra 3D.
# Las opciones deben coincidir con src/app/character/looks.js.
Build = Literal["male", "female"]
Skin = Literal["s1", "s2", "s3", "s4", "s5", "s6"]
Hair = Literal["corto", "rapado", "tupe", "rizos", "raya", "coleta", "moño", "melena", "trenza", "media", "calvo"]
HairColor = Literal[
    "negro", "moreno", "castano-oscuro", "castano", "avellana", "rubio-oscuro", "rubio", "pelirrojo",
    "platino", "gris", "azul", "rosa",
    # De la tienda:
    "neon-verde", "neon-rosa", "morado", "fuego", "plata", "oro",
]
Eyes = Literal["round", "almond", "smiley"]
Mouth = Literal["smile", "line", "grin", "soft", "open"]
Beard = Literal["none", "stubble", "short", "full", "moustache", "goatee", "moustache_goatee"]
HairSplit = Literal["vertical", "horizontal"]
Accent = Literal["none", "blanco", "negro", "naranja", "azul", "rosa", "amarillo", "verde", "morado", "fuego", "neon", "oro"]
KneePads = Literal["negro", "blanco", "naranja", "azul", "rosa"]
Shoes = Literal["blanco", "negro", "naranja", "azul", "rosa", "amarillo", "neon", "oro"]
Glasses = Literal["none", "redondas", "sol", "deporte"]
Shirt = Literal["normal", "rayo", "fuego", "bomba", "oro", "telarana", "cuervo"]
# Efectos en la pizarra 3D al rematar, recibir y colocar (de la tienda).
FxRemate = Literal["none", "fuego", "rayo", "galaxia", "oro"]
FxRecepcion = Literal["none", "fuego", "rayo", "galaxia", "oro", "hielo"]
FxColocacion = Literal["none", "fuego", "rayo", "galaxia", "oro", "estrellas"]
Celebration = Literal["brazos", "puno"]

router = APIRouter(prefix="/api")


class Character(BaseModel):
    model_config = ConfigDict(extra="forbid")

    build: Build
    skin: Skin
    hair: Hair
    hair_color: HairColor
    eyes: Eyes
    mouth: Mouth
    beard: Beard
    freckles: bool
    blush: bool
    headband: Accent
    wristbands: Accent
    kneepads: KneePads
    shoes: Shoes
    celebration: Celebration
    # Cuerpo: 0 = muy delgado / poco músculo, 50 = normal, 100 = grueso / muy musculoso.
    weight: int = Field(50, ge=0, le=100)
    muscle: int = Field(50, ge=0, le=100)
    # Pelo de dos colores ("none" = de uno solo) y si van mitad y mitad o arriba y abajo.
    hair_color2: Union[HairColor, Literal["none"]] = "none"
    hair_split: HairSplit = "vertical"
    eyeliner: bool = False
    glasses: Glasses = "none"
    shirt: Shirt = "normal"
    fx_remate: FxRemate = "none"
    fx_recepcion: FxRecepcion = "none"
    fx_colocacion: FxColocacion = "none"


@router.put("/profile/character")
async def save_character(body: Character, user=Depends(require_approved), db=Depends(get_db)):
    # Lo de la tienda solo se puede llevar si se ha comprado.
    if required_items(body.model_dump()) - owned_items(user):
        raise HTTPException(status_code=403, detail="Eso es de la tienda: cómpralo primero con tus Club Coins")
    updated = await db.users.find_one_and_update(
        {"id": user["id"]},
        {"$set": {"character": body.model_dump()}},
        return_document=ReturnDocument.AFTER,
    )
    return await _profile_response(db, updated)
