import asyncio
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional
from uuid import uuid4

from bson.binary import Binary
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, StringConstraints
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

from auth import pictures_by_user
from clubs import with_club
from database import get_db
from help_requests import help_cards, remove_help
from notifications import send_notifications
from players import require_approved
from teams import ChannelId, teams

GENERAL = {"id": "general", "name": "General"}
FAMILY = {"id": "familia", "name": "Familia"}
MessageText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
# La app reduce la foto antes de enviarla (unos cientos de KB); esto es el tope por si alguien llama directamente.
MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_IMAGE_SIDE = 4000
PHOTO_LABEL = "📷 Foto"

PAGE_SIZE = 50
UNREAD_CAP = 100
PREVIEW_LENGTH = 80
TYPING_SECONDS = 6
# La pantalla del chat pregunta cada 3 segundos: quien preguntó hace menos de esto lo está viendo.
PRESENCE_SECONDS = 10
NOTIFICATION_TTL_SECONDS = 3600
NOTIFICATION_LENGTH = 140
NEWEST_FIRST = [("created_at", DESCENDING), ("id", DESCENDING)]

router = APIRouter(prefix="/api/chat")
_indexes_ready = False


class NewMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: MessageText


def _visible_channels(user):
    """Familia es de todos. Las familias solo tienen ese; el general y los de equipo son para quienes están en el club."""
    if user.get("role") == "admin":
        return [GENERAL, *teams(), FAMILY]
    if user.get("role") == "familia":
        return [FAMILY]
    own = {user.get("team_id")}
    if user.get("role") == "entrenador":
        own.update(user.get("coached_team_ids", []))
    return [GENERAL, *(team for team in teams() if team["id"] in own), FAMILY]


def _require_channel(user, channel_id):
    if not any(channel["id"] == channel_id for channel in _visible_channels(user)):
        raise HTTPException(status_code=403, detail="No tienes acceso a este chat")


def _iso(value):
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _now():
    # Mongo guarda milisegundos: se recorta para que lo devuelto coincida con lo guardado.
    now = datetime.now(timezone.utc)
    return now.replace(microsecond=now.microsecond // 1000 * 1000)


def _image_type(data):
    """Se mira el contenido, no lo que diga quien sube el archivo."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _summary_text(message):
    """Lo que se enseña del mensaje en la lista de chats y en el aviso: la foto, si no hay texto."""
    if message.get("image") and not message["text"]:
        return PHOTO_LABEL
    if message.get("image"):
        return f"{PHOTO_LABEL} {message['text']}"
    return message["text"]


def _public_image(image):
    return image and {
        "url": with_club(f"/api/chat/images/{image['id']}"),
        "width": image["width"],
        "height": image["height"],
    }


def _public_message(message, user, seen_until=None, pictures=None, help_cards=None):
    mine = message["user_id"] == user["id"]
    return {
        # Petición de ayuda para un entreno: el chat la pinta con su botón "Voy".
        "help": (help_cards or {}).get(message.get("help_id")),
        "image": _public_image(message.get("image")),
        "author_id": message["user_id"],
        "author_picture": (pictures or {}).get(message["user_id"], ""),
        # Solo el autor sabe si lo han visto.
        "seen": bool(mine and seen_until and message["created_at"] <= seen_until),
        "id": message["id"],
        "channel": message["channel"],
        "text": message["text"],
        "author": message["author"],
        "author_role": message["author_role"],
        "created_at": _iso(message["created_at"]),
        "mine": mine,
        "can_delete": mine or user.get("role") == "admin",
    }


async def _ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.chat_messages.create_index("id", unique=True)
    await db.chat_images.create_index("id", unique=True)
    await db.chat_messages.create_index(
        [("channel", ASCENDING), ("created_at", DESCENDING), ("id", DESCENDING)]
    )
    await db.chat_reads.create_index([("user_id", ASCENDING), ("channel", ASCENDING)], unique=True)
    await db.chat_reads.create_index([("channel", ASCENDING), ("last_read_at", DESCENDING)])
    await db.chat_typing.create_index([("channel", ASCENDING), ("user_id", ASCENDING)], unique=True)
    # Mongo limpia los avisos viejos por su cuenta; la consulta ya los ignora antes.
    await db.chat_typing.create_index("at", expireAfterSeconds=60)
    await db.chat_presence.create_index([("channel", ASCENDING), ("at", DESCENDING)])
    await db.chat_presence.create_index("at", expireAfterSeconds=300)
    _indexes_ready = True


async def _latest_message(db, channel_id):
    return await db.chat_messages.find_one({"channel": channel_id}, sort=NEWEST_FIRST)


async def _seen_until(db, channel_id, user):
    """Hasta dónde ha leído quien más lleva leído de los demás: lo anterior ya lo ha visto alguien."""
    read = await db.chat_reads.find_one(
        {"channel": channel_id, "user_id": {"$ne": user["id"]}},
        sort=[("last_read_at", DESCENDING)],
    )
    return read and read["last_read_at"]


async def _typing_names(db, channel_id, user):
    recent = datetime.now(timezone.utc) - timedelta(seconds=TYPING_SECONDS)
    typing = await db.chat_typing.find(
        {"channel": channel_id, "user_id": {"$ne": user["id"]}, "at": {"$gt": recent}}
    ).to_list(50)
    return sorted((item["name"] for item in typing), key=str.casefold)


async def _channel_summary(db, user, channel, last_read):
    unread_query = {"channel": channel["id"], "user_id": {"$ne": user["id"]}}
    if last_read:
        unread_query["created_at"] = {"$gt": last_read}
    latest, unread = await asyncio.gather(
        _latest_message(db, channel["id"]),
        db.chat_messages.count_documents(unread_query, limit=UNREAD_CAP),
    )
    return {
        **channel,
        "unread": unread,
        "last_message": latest
        and {
            "author": latest["author"],
            "text": _summary_text(latest)[:PREVIEW_LENGTH],
            "created_at": _iso(latest["created_at"]),
        },
    }


async def _notify_new_message(db, channel_id, message):
    """Avisa a quien tiene acceso a este chat, menos a su autor y a quien lo está viendo."""
    recent = _now() - timedelta(seconds=PRESENCE_SECONDS)
    watching = await db.chat_presence.find({"channel": channel_id, "at": {"$gt": recent}}).to_list(2000)
    skip = {message["user_id"], *(item["user_id"] for item in watching)}
    members = await db.users.find({"status": "approved"}).to_list(5000)
    recipients = [
        member["id"]
        for member in members
        if member["id"] not in skip and any(channel["id"] == channel_id for channel in _visible_channels(member))
    ]
    name = next(channel["name"] for channel in [GENERAL, FAMILY, *teams()] if channel["id"] == channel_id)
    await send_notifications(
        db,
        recipients,
        "chat",
        {
            "title": name.removeprefix("Club "),
            "body": f"{message['author']}: {_summary_text(message)}"[:NOTIFICATION_LENGTH],
            "url": f"/app/chat?canal={channel_id}",
            "tag": f"chat-{channel_id}",
        },
        ttl=NOTIFICATION_TTL_SECONDS,
        topic=f"chat-{channel_id}",
    )


@router.get("/channels")
async def list_channels(user=Depends(require_approved), db=Depends(get_db)):
    channels = _visible_channels(user)
    reads = await db.chat_reads.find({"user_id": user["id"]}).to_list(len(teams()) + 2)
    last_read = {read["channel"]: read["last_read_at"] for read in reads}
    return await asyncio.gather(
        *(_channel_summary(db, user, channel, last_read.get(channel["id"])) for channel in channels)
    )


@router.get("/channels/{channel_id}/messages")
async def list_messages(
    channel_id: ChannelId,
    before: Optional[str] = Query(default=None, max_length=64),
    user=Depends(require_approved),
    db=Depends(get_db),
):
    """Los últimos mensajes, o los anteriores a `before`. Siempre de más antiguo a más reciente."""
    _require_channel(user, channel_id)
    await _ensure_indexes(db)
    await db.chat_presence.update_one(
        {"channel": channel_id, "user_id": user["id"]}, {"$set": {"at": _now()}}, upsert=True
    )
    query = {"channel": channel_id}
    if before:
        anchor = await db.chat_messages.find_one({"id": before, "channel": channel_id})
        if not anchor:
            raise HTTPException(status_code=404, detail="Ese mensaje ya no existe")
        query["$or"] = [
            {"created_at": {"$lt": anchor["created_at"]}},
            {"created_at": anchor["created_at"], "id": {"$lt": anchor["id"]}},
        ]
    # Se pide uno de más para saber si quedan mensajes anteriores.
    found, seen_until, typing = await asyncio.gather(
        db.chat_messages.find(query).sort(NEWEST_FIRST).limit(PAGE_SIZE + 1).to_list(PAGE_SIZE + 1),
        _seen_until(db, channel_id, user),
        _typing_names(db, channel_id, user),
    )
    page = found[:PAGE_SIZE]
    pictures = await pictures_by_user(db, [message["user_id"] for message in page])
    cards = await help_cards(db, [message["help_id"] for message in page if message.get("help_id")], user)
    return {
        "messages": [_public_message(message, user, seen_until, pictures, cards) for message in reversed(page)],
        "has_more": len(found) > PAGE_SIZE,
        "typing": typing,
    }


@router.post("/channels/{channel_id}/messages", status_code=201)
async def send_message(channel_id: ChannelId, body: NewMessage, user=Depends(require_approved), db=Depends(get_db)):
    _require_channel(user, channel_id)
    await _ensure_indexes(db)
    message = {
        "id": str(uuid4()),
        "channel": channel_id,
        "user_id": user["id"],
        "author": user["name"],
        "author_role": user.get("role"),
        "text": body.text,
        "created_at": _now(),
    }
    await db.chat_messages.insert_one(message)
    await db.chat_typing.delete_one({"channel": channel_id, "user_id": user["id"]})
    await _notify_new_message(db, channel_id, message)
    return _public_message(message, user)


@router.post("/channels/{channel_id}/images", status_code=201)
async def send_image(
    channel_id: ChannelId,
    request: Request,
    width: int = Query(..., ge=1, le=MAX_IMAGE_SIDE),
    height: int = Query(..., ge=1, le=MAX_IMAGE_SIDE),
    text: Optional[str] = Query(default=None, max_length=1000),
    user=Depends(require_approved),
    db=Depends(get_db),
):
    """Una foto, con un texto opcional al pie. El cuerpo es la imagen tal cual (JPG o WebP)."""
    _require_channel(user, channel_id)
    data = await request.body()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="La foto es demasiado grande")
    content_type = _image_type(data)
    if not content_type:
        raise HTTPException(status_code=415, detail="Envía una foto en JPG o WebP")
    await _ensure_indexes(db)
    now = _now()
    image = {"id": str(uuid4()), "width": width, "height": height}
    await db.chat_images.insert_one(
        {**image, "channel": channel_id, "user_id": user["id"], "data": Binary(data), "content_type": content_type, "created_at": now}
    )
    message = {
        "id": str(uuid4()),
        "channel": channel_id,
        "user_id": user["id"],
        "author": user["name"],
        "author_role": user.get("role"),
        "text": (text or "").strip(),
        "image": image,
        "created_at": now,
    }
    await db.chat_messages.insert_one(message)
    await db.chat_typing.delete_one({"channel": channel_id, "user_id": user["id"]})
    await _notify_new_message(db, channel_id, message)
    return _public_message(message, user)


@router.get("/images/{image_id}")
async def get_image(image_id: str, user=Depends(require_approved), db=Depends(get_db)):
    image = await db.chat_images.find_one({"id": image_id})
    # Una foto de un chat ajeno se trata como si no existiera.
    if not image or not any(channel["id"] == image["channel"] for channel in _visible_channels(user)):
        raise HTTPException(status_code=404, detail="Esa foto ya no existe")
    return Response(
        content=bytes(image["data"]),
        media_type=image["content_type"],
        headers={
            # Cada foto tiene su propia dirección y nunca cambia.
            "Cache-Control": "private, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/channels/{channel_id}/typing", status_code=204)
async def start_typing(channel_id: ChannelId, user=Depends(require_approved), db=Depends(get_db)):
    _require_channel(user, channel_id)
    await _ensure_indexes(db)
    key = {"channel": channel_id, "user_id": user["id"]}
    change = {"$set": {"name": user["name"], "at": _now()}}
    try:
        await db.chat_typing.update_one(key, change, upsert=True)
    except DuplicateKeyError:
        await db.chat_typing.update_one(key, change)


@router.delete("/channels/{channel_id}/typing", status_code=204)
async def stop_typing(channel_id: ChannelId, user=Depends(require_approved), db=Depends(get_db)):
    _require_channel(user, channel_id)
    await db.chat_typing.delete_one({"channel": channel_id, "user_id": user["id"]})


@router.post("/channels/{channel_id}/read", status_code=204)
async def mark_read(channel_id: ChannelId, user=Depends(require_approved), db=Depends(get_db)):
    _require_channel(user, channel_id)
    latest = await _latest_message(db, channel_id)
    if not latest:
        return
    await _ensure_indexes(db)
    key = {"user_id": user["id"], "channel": channel_id}
    change = {"$max": {"last_read_at": latest["created_at"]}}
    try:
        await db.chat_reads.update_one(key, change, upsert=True)
    except DuplicateKeyError:
        # Dos pestañas a la vez: la primera creó el registro, esta lo actualiza.
        await db.chat_reads.update_one(key, change)


@router.delete("/messages/{message_id}", status_code=204)
async def delete_message(message_id: str, user=Depends(require_approved), db=Depends(get_db)):
    message = await db.chat_messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Ese mensaje ya no existe")
    # Un mensaje de un chat ajeno se trata como si no existiera.
    if not any(channel["id"] == message["channel"] for channel in _visible_channels(user)):
        raise HTTPException(status_code=404, detail="Ese mensaje ya no existe")
    if message["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo puedes borrar tus propios mensajes")
    await db.chat_messages.delete_one({"id": message_id})
    if message.get("help_id"):
        await remove_help(db, message["help_id"])
    if message.get("image"):
        await db.chat_images.delete_one({"id": message["image"]["id"]})
