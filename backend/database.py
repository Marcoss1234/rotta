import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Request
from motor.motor_asyncio import AsyncIOMotorClient

from clubs import database_for

load_dotenv(Path(__file__).parent / ".env")

_client = None


def get_client():
    """La conexión con MongoDB. Se crea la primera vez que hace falta."""
    global _client
    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        raise RuntimeError("MONGO_URL debe configurarse")
    if _client is None:
        _client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
    return _client


async def get_db(request: Request):
    """La base de datos del club de esta petición (cada club tiene la suya; ver clubs.py)."""
    return await database_for(request, get_client())


def close_db():
    global _client
    if _client is not None:
        _client.close()
        _client = None
