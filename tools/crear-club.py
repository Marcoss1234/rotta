"""Da de alta un club en Rotta, con su propia base de datos.

Uso (desde la carpeta del proyecto, con backend/.env configurado):
    python tools/crear-club.py tnt "C.V. TNT Almería"
    python tools/crear-club.py --lista

El código (tnt) es lo que va en la dirección: tnt.rotta.app o ?club=tnt.
Solo letras minúsculas, números y guiones.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from clubs import central_db, create_club  # noqa: E402
from database import get_client  # noqa: E402


async def main(args):
    client = get_client()
    if args == ["--lista"]:
        clubs = await central_db(client).clubs.find({}, {"_id": 0}).sort("slug", 1).to_list(1000)
        if not clubs:
            print("Todavía no hay clubs.")
        for club in clubs:
            print(f"{club['slug']:<20} {club['name']:<30} base: {club['db_name']}")
        return 0
    if len(args) != 2:
        print(__doc__)
        return 1
    try:
        club = await create_club(client, args[0], args[1])
    except ValueError as error:
        print(f"No se ha creado: {error}")
        return 1
    print(f"Club creado: {club['name']} (código «{club['slug']}», base «{club['db_name']}»).")
    print(f"Se entra con ?club={club['slug']} o, con dominio propio, en {club['slug']}.<tu dominio>.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1:])))
