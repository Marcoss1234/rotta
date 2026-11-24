import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from attendance import router as attendance_router
from auth import router as auth_router
from backup import router as backup_router
from boards import lineups_router as board_lineups_router, router as boards_router
from characters import router as characters_router
from coins import router as coins_router
from help_requests import router as help_router
from live import router as live_router
from shop import router as shop_router
from chat import router as chat_router
from club_settings import router as club_settings_router
from database import close_db, get_db
from events import router as events_router
from matches import router as matches_router
from notifications import router as notifications_router
from password_auth import router as password_auth_router
from players import router as players_router
from privacy import router as privacy_router
from ranking import router as ranking_router
from schedules import router as schedules_router
from user_profile import router as profile_router

app = FastAPI(title="Rotta API")
api_router = APIRouter(prefix="/api")


class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str = Field(min_length=1, max_length=120)


class InscripcionCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    email: EmailStr
    telefono: str = Field(min_length=6, max_length=30)
    categoria: Literal[
        "Club Escuela",
        "Club Senior Femenino",
        "Club Masculino",
        "Club Playa",
    ]
    posicion: Literal["Líbero", "Colocador", "Receptor", "Central", "Opuesto"]
    experiencia: str = Field(default="", max_length=600)


class InscripcionResponse(InscripcionCreate):
    id: str
    created_at: datetime


@api_router.get("/")
async def root():
    return {"message": "Rotta Volleyball Club API"}


# Rutas públicas que escriben en la base de datos sin iniciar sesión. La web no las usa
# (el formulario va por WhatsApp), así que solo se activan si se pide expresamente.
legacy_router = APIRouter(prefix="/api")


@legacy_router.post("/status", response_model=StatusCheck)
async def create_status_check(input_data: StatusCheckCreate, db=Depends(get_db)):
    status = StatusCheck(**input_data.model_dump())
    document = status.model_dump()
    document["timestamp"] = status.timestamp.isoformat()
    await db.status_checks.insert_one(document)
    return status


@legacy_router.get("/status", response_model=list[StatusCheck])
async def get_status_checks(db=Depends(get_db)):
    documents = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for document in documents:
        if isinstance(document.get("timestamp"), str):
            document["timestamp"] = datetime.fromisoformat(document["timestamp"])
    return documents


@legacy_router.post("/inscripciones", response_model=InscripcionResponse, status_code=201)
async def create_inscripcion(input_data: InscripcionCreate, db=Depends(get_db)):
    created_at = datetime.now(timezone.utc)
    document = input_data.model_dump()
    document["created_at"] = created_at.isoformat()
    result = await db.inscripciones.insert_one(document)
    return InscripcionResponse(
        id=str(result.inserted_id),
        created_at=created_at,
        **input_data.model_dump(),
    )


app.include_router(api_router)
app.include_router(auth_router)
app.include_router(backup_router)
app.include_router(password_auth_router)
app.include_router(players_router)
app.include_router(privacy_router)
app.include_router(attendance_router)
app.include_router(chat_router)
app.include_router(club_settings_router)
app.include_router(matches_router)
app.include_router(events_router)
app.include_router(ranking_router)
app.include_router(boards_router)
app.include_router(board_lineups_router)
app.include_router(schedules_router)
app.include_router(notifications_router)
app.include_router(profile_router)
app.include_router(characters_router)
app.include_router(coins_router)
app.include_router(help_router)
app.include_router(live_router)
app.include_router(shop_router)
if os.environ.get("ENABLE_PUBLIC_WRITE_ROUTES", "").lower() == "true":
    app.include_router(legacy_router)

frontend_dist = Path(__file__).resolve().parents[1] / "frontend-dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    close_db()
