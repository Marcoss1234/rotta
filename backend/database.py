import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")

_client = None


def get_db():
    """Devuelve la base de datos. La conexión se crea la primera vez que hace falta."""
    global _client
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise RuntimeError("MONGO_URL y DB_NAME deben configurarse")
    if _client is None:
        _client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
    return _client[db_name]


def close_db():
    global _client
    if _client is not None:
        _client.close()
        _client = None
