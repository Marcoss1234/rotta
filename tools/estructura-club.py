"""Ver o cambiar los equipos de un club: nombres, horario de serie, partidos compartidos y grupos del ranking.

Uso (desde la carpeta del proyecto, con backend/.env configurado):
    python tools/estructura-club.py tnt                      # la enseña (la guardada o la de serie)
    python tools/estructura-club.py tnt equipos.json         # la cambia por la del archivo
    python tools/estructura-club.py tnt --de-serie           # vuelve a la de serie

Con «-» en vez del código: la base de DB_NAME, la de una instalación de un solo club.
Ejemplo de archivo: tools/estructura-ejemplo.json. Los días van de 0 (lunes) a 6 (domingo).

Ojo: si quitas un equipo que ya tiene gente, sus jugadores, partidos y mensajes siguen en la base
con ese código de equipo, pero la app deja de enseñarlos hasta que vuelva a existir.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from pydantic import ValidationError  # noqa: E402

from clubs import find_club  # noqa: E402
from database import get_client  # noqa: E402
from teams import ClubStructure, load_club_structure  # noqa: E402


async def club_db(client, slug):
    if slug == "-":
        name = os.environ.get("DB_NAME")
        if not name:
            raise SystemExit("Falta DB_NAME en backend/.env (o di el código del club)")
        return client[name]
    club = await find_club(client, slug)
    if not club:
        raise SystemExit(f"No hay ningún club con el código «{slug}» (mira: python tools/crear-club.py --lista)")
    return client[club["db_name"]]


async def main(args):
    if not args or args[0] in ("-h", "--help") or len(args) > 2:
        print(__doc__)
        return 0 if args and args[0] in ("-h", "--help") else 1
    client = get_client()
    db = await club_db(client, args[0])

    if len(args) == 1:
        current = await load_club_structure(db)
        print(json.dumps(current.model_dump(), ensure_ascii=False, indent=2))
        return 0

    if args[1] == "--de-serie":
        await db.club_settings.update_one({"id": "club"}, {"$unset": {"structure": ""}})
        print("Vuelve a tener los equipos de serie.")
        return 0

    try:
        raw = json.loads(Path(args[1]).read_text(encoding="utf-8"))
        new = ClubStructure.model_validate(raw)
    except (OSError, json.JSONDecodeError) as error:
        print(f"No se ha podido leer el archivo: {error}")
        return 1
    except ValidationError as error:
        print("El archivo tiene errores, no se ha cambiado nada:")
        for item in error.errors():
            place = " > ".join(str(part) for part in item["loc"]) or "(todo)"
            print(f"  - {place}: {item['msg']}")
        return 1

    in_use = set(await db.users.distinct("team_id")) | set(await db.players.distinct("team_id"))
    removed = sorted(team for team in in_use if team and team not in {team.id for team in new.teams})
    if removed:
        print(f"Aviso: estos equipos tienen gente y ya no están en el archivo: {', '.join(removed)}")

    await db.club_settings.update_one({"id": "club"}, {"$set": {"structure": new.model_dump()}}, upsert=True)
    names = ", ".join(team.name for team in new.teams)
    print(f"Guardado. Equipos: {names}. La app lo coge en la siguiente petición.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1:])))
