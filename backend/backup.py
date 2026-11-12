from datetime import datetime, timezone

from bson import json_util
from fastapi import APIRouter, Depends
from fastapi.responses import Response

from auth import require_admin
from database import get_db

# Copia de seguridad: todo lo que cuesta rehacer, en un archivo que el administrador se descarga.
# No van las sesiones, los avisos al móvil ni los "está escribiendo", que se rehacen solos.
# Tampoco las fotos (perfil y chat): pesan demasiado para una sola descarga.
COLLECTIONS = [
    "users",
    "players",
    "attendance",
    "matches",
    "match_answers",
    "events",
    "ratings",
    "rating_weeks",
    "coin_entries",
    "honors",
    "live_matches",
    "training_stars",
    "team_schedules",
    "boards",
    "board_lineups",
    "chat_messages",
    "chat_reads",
    "inscripciones",
]
# Nunca salen de la base de datos, ni en la copia.
SECRET_FIELDS = {"password_hash", "temporary_password", "temporary_password_expires_at"}
MAX_PER_COLLECTION = 50_000

router = APIRouter(prefix="/api/admin")


@router.get("/backup")
async def download_backup(user=Depends(require_admin), db=Depends(get_db)):
    now = datetime.now(timezone.utc)
    data = {}
    for name in COLLECTIONS:
        documents = await db[name].find({}, {"_id": 0}).to_list(MAX_PER_COLLECTION)
        if name == "users":
            documents = [{key: value for key, value in document.items() if key not in SECRET_FIELDS} for document in documents]
        data[name] = documents
    payload = {
        "app": "Rotta",
        "created_at": now,
        "created_by": user["id"],
        "counts": {name: len(documents) for name, documents in data.items()},
        "collections": data,
    }
    return Response(
        content=json_util.dumps(payload, ensure_ascii=False, indent=1),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="copia-tnt-{now.date().isoformat()}.json"',
            "Cache-Control": "no-store",
        },
    )
