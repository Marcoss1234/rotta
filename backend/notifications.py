import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Annotated, Optional
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError
from pywebpush import WebPushException, webpush

from database import get_db
from players import require_approved
from roster_sync import plays_for_team

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notifications")
_indexes_ready = False

KINDS = ("chat", "matches", "ranking")
MAX_SUBSCRIPTIONS_PER_USER = 8
PUSH_TIMEOUT_SECONDS = 5
GONE_STATUSES = (404, 410)

# El servidor hace peticiones a estas direcciones: solo se aceptan las de los servicios de avisos de los navegadores.
PUSH_HOSTS = ("fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com")
PUSH_HOST_SUFFIXES = (".push.apple.com", ".notify.windows.com")

Key = Annotated[str, StringConstraints(min_length=1, max_length=255)]


class SubscriptionKeys(BaseModel):
    model_config = ConfigDict(extra="ignore")

    p256dh: Key
    auth: Key


class SubscriptionSave(BaseModel):
    model_config = ConfigDict(extra="ignore")

    endpoint: str = Field(max_length=2000)
    keys: SubscriptionKeys

    @field_validator("endpoint")
    @classmethod
    def check_endpoint(cls, endpoint):
        url = urlsplit(endpoint)
        host = (url.hostname or "").lower()
        if url.scheme != "https" or not (host in PUSH_HOSTS or host.endswith(PUSH_HOST_SUFFIXES)):
            raise ValueError("Ese servicio de avisos no está admitido")
        return endpoint


class SubscriptionRemove(BaseModel):
    model_config = ConfigDict(extra="ignore")

    endpoint: str = Field(max_length=2000)


class PreferencesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    chat: Optional[bool] = None
    matches: Optional[bool] = None
    ranking: Optional[bool] = None

    @model_validator(mode="after")
    def check_fields(self):
        if not self.model_fields_set or any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Indica qué avisos quieres cambiar")
        return self


def _public_key():
    return os.environ.get("VAPID_PUBLIC_KEY", "")


def _is_configured():
    return bool(_public_key() and os.environ.get("VAPID_PRIVATE_KEY") and os.environ.get("VAPID_SUBJECT"))


def _preferences(user):
    saved = user.get("notification_prefs", {})
    return {kind: saved.get(kind, True) for kind in KINDS}


async def _ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await db.push_subscriptions.create_index([("user_id", ASCENDING), ("updated_at", ASCENDING)])
    _indexes_ready = True


def _send_one(subscription, data, ttl, topic):
    """Devuelve True si el móvil ya no existe y hay que olvidar esta suscripción."""
    headers = {"Urgency": "high"}
    if topic:
        # Si el móvil está apagado, de los avisos con el mismo tema solo le llega el último.
        headers["Topic"] = topic
    try:
        webpush(
            subscription_info={"endpoint": subscription["endpoint"], "keys": subscription["keys"]},
            data=data,
            vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
            vapid_claims={"sub": os.environ["VAPID_SUBJECT"]},
            ttl=ttl,
            timeout=PUSH_TIMEOUT_SECONDS,
            headers=headers,
        )
    except WebPushException as error:
        status = getattr(error.response, "status_code", None)
        if status in GONE_STATUSES:
            return True
        logger.warning("Aviso no entregado (%s)", status)
    return False


async def send_notifications(db, user_ids, kind, payload, ttl=86400, topic=None):
    """Avisa a estas personas. Un fallo aquí nunca debe impedir lo que las ha provocado."""
    if not _is_configured() or not user_ids:
        return
    try:
        users = await db.users.find({"id": {"$in": list(user_ids)}, "status": "approved"}).to_list(5000)
        wanted = [user["id"] for user in users if _preferences(user)[kind]]
        subscriptions = await db.push_subscriptions.find({"user_id": {"$in": wanted}}).to_list(10000)
        data = json.dumps(payload, ensure_ascii=False)
        gone = await asyncio.gather(
            *(asyncio.to_thread(_send_one, subscription, data, ttl, topic) for subscription in subscriptions)
        )
        stale = [subscription["endpoint"] for subscription, is_gone in zip(subscriptions, gone) if is_gone]
        if stale:
            await db.push_subscriptions.delete_many({"endpoint": {"$in": stale}})
    except Exception:
        logger.exception("No se han podido enviar los avisos")


async def team_member_ids(db, team_ids, exclude_id):
    """Quienes juegan en estos equipos y sus entrenadores, sin contar a quien provoca el aviso."""
    teams = set(team_ids)

    def belongs(user):
        if plays_for_team(user) and user.get("team_id") in teams:
            return True
        coached = {user.get("team_id"), *user.get("coached_team_ids", [])}
        return user.get("role") == "entrenador" and bool(coached & teams)

    users = await db.users.find({"status": "approved"}).to_list(5000)
    return [user["id"] for user in users if user["id"] != exclude_id and belongs(user)]


@router.get("/status")
async def get_status(user=Depends(require_approved)):
    return {"enabled": _is_configured(), "public_key": _public_key(), "preferences": _preferences(user)}


@router.put("/preferences")
async def update_preferences(body: PreferencesUpdate, user=Depends(require_approved), db=Depends(get_db)):
    changes = {f"notification_prefs.{kind}": value for kind, value in body.model_dump(include=body.model_fields_set).items()}
    await db.users.update_one({"id": user["id"]}, {"$set": changes})
    return _preferences(await db.users.find_one({"id": user["id"]}))


@router.put("/subscription", status_code=204)
async def save_subscription(body: SubscriptionSave, user=Depends(require_approved), db=Depends(get_db)):
    """Si el móvil ya estaba apuntado con otra cuenta, pasa a esta."""
    await _ensure_indexes(db)
    key = {"endpoint": body.endpoint}
    change = {"$set": {"user_id": user["id"], "keys": body.keys.model_dump(), "updated_at": datetime.now(timezone.utc)}}
    try:
        await db.push_subscriptions.update_one(key, change, upsert=True)
    except DuplicateKeyError:
        await db.push_subscriptions.update_one(key, change)

    mine = await db.push_subscriptions.find({"user_id": user["id"]}).to_list(100)
    mine.sort(key=lambda subscription: subscription["updated_at"], reverse=True)
    old = [subscription["endpoint"] for subscription in mine[MAX_SUBSCRIPTIONS_PER_USER:]]
    if old:
        await db.push_subscriptions.delete_many({"endpoint": {"$in": old}})


@router.post("/subscription/remove", status_code=204)
async def remove_subscription(body: SubscriptionRemove, user=Depends(require_approved), db=Depends(get_db)):
    await db.push_subscriptions.delete_one({"endpoint": body.endpoint, "user_id": user["id"]})
