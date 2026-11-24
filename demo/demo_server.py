"""Servidor de DEMO para enseñar la app a otros clubs.

Arranca el backend de verdad con una base de datos en memoria llena de un club inventado:
jugadores, horarios, partidos, ranking con podio, coins, tienda, chat, destacados y pizarra.
No toca la base de datos real ni necesita claves: todo se borra al cerrarlo.

Se arranca con `npm run demo` (ver demo/README.md).
"""
import asyncio
import json
import os
import random
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

ADMIN_EMAIL = "coordinacion@demo.test"
os.environ.update(
    MONGO_URL="mongodb://demo-en-memoria",
    DB_NAME="demo",
    GOOGLE_CLIENT_ID="demo.apps.googleusercontent.com",
    ADMIN_EMAILS=ADMIN_EMAIL,
    COOKIE_SECURE="false",
)
# Que no salgan avisos al móvil de nadie desde la demo (vacías: backend/.env no las rellena).
for key in ("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"):
    os.environ[key] = ""

import logging  # noqa: E402

import httpx  # noqa: E402
import uvicorn  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

import attendance  # noqa: E402
import auth  # noqa: E402
import coins as coins_module  # noqa: E402
import honors  # noqa: E402
import players as players_module  # noqa: E402
import privacy  # noqa: E402
import ranking  # noqa: E402
from database import get_db  # noqa: E402
from roster_sync import ensure_user_index, sync_player_with_user  # noqa: E402
from server import app  # noqa: E402
from teams import use_club_structure  # noqa: E402



CLUB_TIME = attendance.CLUB_TIME
TODAY = datetime.now(CLUB_TIME).date()
rng = random.Random(2026)
logging.getLogger("httpx").setLevel(logging.WARNING)

# Las cuentas con las que se entra en la demo (botones de la pantalla de entrada).
ACCOUNTS = {
    "demo-coordinacion": ("Laura Martín", ADMIN_EMAIL, "admin", None, []),
    "demo-entrenador": ("Javier Ortega", "entrenador@demo.test", "entrenador", "femenino", ["femenino", "masculino"]),
    "demo-jugadora": ("Carmen López", "jugadora@demo.test", "jugador", "femenino", []),
    "demo-jugador": ("Daniel Sánchez", "jugador@demo.test", "jugador", "masculino", []),
    "demo-familia": ("Rosa Jiménez", "familia@demo.test", "familia", "escuela-lm", []),
}

# Compañeros con cuenta (contestan a entrenos, escriben en el chat...) y sin cuenta (solo ficha).
SQUADS = {
    "femenino": {
        "accounts": [("Lucía Navarro", "Colocador", 3), ("Marta Gil", "Líbero", 5), ("Elena Rubio", "Central", 9),
                     ("Sara Molina", "Opuesto", 11), ("Paula Herrera", "Receptor", 7), ("Irene Castro", "Central", 14)],
        "players": [("Andrea Vega", "Receptor", 2), ("Nuria Prieto", "Colocador", 8), ("Alba Serrano", "Líbero", 1),
                    ("Claudia Ramos", "Opuesto", 12), ("Inés Romero", "Receptor", 15)],
        "me": ("Receptor", 10),
    },
    "masculino": {
        "accounts": [("Hugo Moreno", "Colocador", 6), ("Álvaro Díaz", "Central", 13), ("Pablo Iglesias", "Líbero", 1),
                     ("Sergio Medina", "Opuesto", 17), ("Adrián Cortés", "Receptor", 4)],
        "players": [("Marcos Fuentes", "Central", 9), ("Raúl Cabrera", "Receptor", 11), ("Iván Garrido", "Colocador", 2),
                    ("Rubén Pascual", "Opuesto", 14), ("Óscar León", "Receptor", 8), ("Diego Vidal", "Líbero", 3)],
        "me": ("Receptor", 7),
    },
    "escuela-lm": {
        "accounts": [],
        "players": [("Pablo Jiménez", "Receptor", 4), ("Lola Santos", "Colocador", 7), ("Mario Peña", "Central", 10),
                    ("Vega Lozano", "Receptor", 2), ("Leo Marín", "Líbero", 1), ("Noa Cano", "Opuesto", 9)],
    },
    "escuela-mj": {
        "accounts": [],
        "players": [("Hugo Reyes", "Receptor", 5), ("Valeria Soto", "Colocador", 3), ("Bruno Vidal", "Central", 12),
                    ("Aitana Ruiz", "Receptor", 6), ("Martín Gómez", "Opuesto", 8)],
    },
    "playa": {"accounts": [], "players": [("Ainhoa Bravo", "Receptor", 1), ("Jaime Ortiz", "Receptor", 2)]},
}

# Quién entra con cada botón: credencial falsa de Google -> datos de la cuenta.
CLAIMS = {}


def fake_verify(credential):
    if credential not in CLAIMS:
        raise ValueError("Solo se entra con las cuentas de la demo")
    return CLAIMS[credential]


db = AsyncMongoMockClient()["demo"]
auth.verify_google_token = fake_verify


async def demo_db():
    # Como get_db de verdad: la base y, con ella, los equipos del club (backend/teams.py).
    await use_club_structure(db)
    return db


app.dependency_overrides[get_db] = demo_db

# En la demo todo cuenta desde hace semanas: destacados, coins y sin multas por no contestar.
attendance.STARS_FROM = TODAY - timedelta(days=60)
coins_module.COINS_FROM = TODAY - timedelta(days=60)
coins_module.PENALTIES_FROM = TODAY + timedelta(days=1)


def slug(name):
    return name.lower().replace(" ", ".").translate(str.maketrans("áéíóúñ", "aeioun"))


async def add_user(key, name, email, role, team, coached, created):
    CLAIMS[key] = {"sub": f"g-{key}", "email": email, "email_verified": True, "name": name}
    user = {
        "id": f"u-{key}",
        "google_sub": f"g-{key}",
        "email": email,
        "name": name,
        "status": "approved",
        "role": role,
        "team_id": team,
        "coached_team_ids": coached,
        "created_at": created,
        # Las cuentas de la demo ya han aceptado la privacidad: así se entra directo.
        "consent": {"version": privacy.POLICY_VERSION, "accepted_at": created, "adult": True, "guardian_name": None, "photos": True},
    }
    await db.users.insert_one(user)
    await sync_player_with_user(db, user)
    return user["id"]


async def client_for(key):
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://demo")
    response = await client.post("/api/auth/google", json={"credential": key})
    response.raise_for_status()
    return client


async def ok(response):
    if response.status_code >= 400:
        raise RuntimeError(f"{response.request.method} {response.request.url}: {response.status_code} {response.text}")
    return response.json() if response.content else None


def monday(weeks_back):
    start = TODAY - timedelta(days=TODAY.weekday())
    return start - timedelta(weeks=weeks_back)


def training_days(team, back_days, ahead_days=0):
    weekdays = set(attendance_weekdays[team])
    return [TODAY + timedelta(days=offset) for offset in range(-back_days, ahead_days + 1) if (TODAY + timedelta(days=offset)).weekday() in weekdays]


attendance_weekdays = {}


async def seed():
    await auth._ensure_indexes(db)
    await ensure_user_index(db)
    await players_module._ensure_indexes(db)
    created = datetime.now(timezone.utc) - timedelta(days=45)

    # Cuentas de la demo y compañeros con cuenta.
    for key, (name, email, role, team, coached) in ACCOUNTS.items():
        await add_user(key, name, email, role, team, coached, created)
    mates = {}
    for team, squad in SQUADS.items():
        for name, _, _ in squad["accounts"]:
            key = f"mate-{slug(name)}"
            mates[name] = await add_user(key, name, f"{slug(name)}@demo.test", "jugador", team, [], created)
    # Dos personas pidiendo entrar: así se ve cómo se aprueba el acceso.
    now = datetime.now(timezone.utc)
    for index, name in enumerate(("Teresa Calvo", "Manuel Rey")):
        await db.users.insert_one({"id": f"u-pend{index}", "google_sub": f"g-pend{index}", "email": f"pendiente{index}@demo.test",
                                   "name": name, "status": "pending", "role": None, "created_at": now - timedelta(hours=3 + index)})

    admin = await client_for("demo-coordinacion")
    coach = await client_for("demo-entrenador")

    # Plantillas: posiciones, dorsales y jugadores sin cuenta.
    roster_ids = {}
    for team, squad in SQUADS.items():
        roster = await ok(await admin.get(f"/api/players?team_id={team}"))
        by_name = {player["name"]: player for player in roster}
        wanted = {name: (position, number) for name, position, number in squad["accounts"]}
        if "me" in squad:
            me_name = ACCOUNTS["demo-jugadora" if team == "femenino" else "demo-jugador"][0]
            wanted[me_name] = squad["me"]
        for name, (position, number) in wanted.items():
            await ok(await admin.patch(f"/api/players/{by_name[name]['id']}", json={"position": position, "number": number}))
        for name, position, number in squad["players"]:
            await ok(await admin.post("/api/players", json={"team_id": team, "name": name, "position": position, "number": number}))
        roster_ids[team] = [player["id"] for player in await ok(await admin.get(f"/api/players?team_id={team}"))]

    schedules = await ok(await admin.get("/api/schedules"))
    for team, info in schedules.items():
        attendance_weekdays[team] = [day for session in info["sessions"] for day in session["days"]]

    # Ranking: las últimas cinco semanas publicadas en los tres grupos (sale podio de la semana y del mes).
    for group_id, teams in (("femenino", ["femenino"]), ("masculino", ["masculino"]), ("escuela", ["escuela-lm", "escuela-mj"])):
        roster = [player for team in teams for player in await ok(await admin.get(f"/api/players?team_id={team}"))]
        level = {player["id"]: rng.uniform(5.5, 8.3) for player in roster}
        # Las cuentas de la demo van arriba: así se ve su corona en el personaje y en el ranking.
        stars_of_demo = {ACCOUNTS["demo-jugadora"][0]: 8.9, ACCOUNTS["demo-jugador"][0]: 8.9}
        level.update({player["id"]: stars_of_demo[player["name"]] for player in roster if player["name"] in stars_of_demo})
        for weeks_back in range(5, -1, -1):
            week = monday(weeks_back).isoformat()
            for player in roster:
                weights = ranking.WEIGHTS[player["position"]]
                scores = {skill: max(1, min(10, round((level[player["id"]] + rng.uniform(-1.2, 1.2)) * 2) / 2)) for skill in weights}
                comment = rng.choice(["", "", "Muy bien en recepción esta semana.", "Sigue así, se nota el trabajo.", "Hay que ajustar el saque."])
                await ok(await admin.put("/api/ranking/ratings", json={"group_id": group_id, "week": week, "player_id": player["id"],
                                                                     "position": player["position"], "scores": scores, "comment": comment}))
            await ok(await admin.post("/api/ranking/publish", json={"group_id": group_id, "week": week}))

    # Asistencia: entrenos pasados (directo en la base, la app no deja contestar al pasado) y el próximo.
    for team in ("femenino", "masculino"):
        users = [user async for user in db.users.find({"team_id": team, "role": "jugador"})]
        for day in training_days(team, 21):
            if day >= TODAY:
                continue
            for user in users:
                status = "going" if rng.random() < 0.85 else "not_going"
                await db.attendance.insert_one({"team_id": team, "date": day.isoformat(), "user_id": user["id"], "status": status})
        upcoming = [day for day in training_days(team, 0, 7) if day >= TODAY][:2]
        for user in users:
            if user["id"] == "u-demo-jugadora":
                continue
            client = await client_for(next(key for key, claims in CLAIMS.items() if claims["email"] == user["email"]))
            for day in upcoming:
                if rng.random() < 0.8:
                    status = "going" if rng.random() < 0.85 else "not_going"
                    await ok(await client.put("/api/attendance", json={"team_id": team, "date": day.isoformat(), "status": status}))
            await client.aclose()

    # Destacados del último entreno del femenino.
    stars = await ok(await coach.get("/api/attendance/stars?team_id=femenino"))
    if stars["date"]:
        went = [user["id"] async for user in db.users.find({"team_id": "femenino", "role": "jugador"})]
        for user_id in went:
            await db.attendance.update_one({"team_id": "femenino", "date": stars["date"], "user_id": user_id},
                                           {"$set": {"status": "going"}}, upsert=True)
        chosen = ["u-demo-jugadora", mates["Lucía Navarro"], mates["Marta Gil"]]
        await ok(await coach.put("/api/attendance/stars", json={"team_id": "femenino", "date": stars["date"], "user_ids": chosen}))

    # Partidos: jugados con resultado y los próximos.
    def day(offset):
        return (TODAY + timedelta(days=offset)).isoformat()

    matches = [
        ("femenino", -26, "18:00", "CV Bahía", "liga", "Pabellón Municipal", [(25, 21), (22, 25), (25, 19), (25, 23)]),
        ("femenino", -19, "12:00", "Voley Las Dunas", "liga", "Pabellón Las Dunas", [(19, 25), (25, 22), (21, 25), (25, 18), (15, 12)]),
        ("femenino", -12, "18:00", "CV Puerto Alto", "liga", "Pabellón Municipal", [(25, 17), (25, 20), (25, 22)]),
        ("femenino", -5, "11:30", "Voley Sierra Norte", "liga", "Pabellón Sierra Norte", [(23, 25), (25, 27), (25, 20), (20, 25)]),
        ("femenino", 3, "18:00", "Club Atlético Voley", "liga", "Pabellón Municipal", []),
        ("femenino", 10, "12:00", "CV Los Olivos", "liga", "Pabellón Los Olivos", []),
        ("masculino", -20, "19:00", "Voley Costa Sur", "liga", "Pabellón Municipal", [(25, 20), (25, 23), (18, 25), (25, 21)]),
        ("masculino", -6, "17:00", "CV Mirador", "liga", "Pabellón El Mirador", [(22, 25), (25, 21), (25, 23), (25, 16)]),
        ("masculino", 4, "19:00", "CV Bahía", "liga", "Pabellón Municipal", []),
        ("escuela-lm", -13, "10:00", "Escuela Voley Las Dunas", "amistoso", "Pabellón Municipal", [(25, 18), (22, 25), (15, 11)]),
        ("escuela-lm", 9, "10:00", "Torneo de Escuelas", "torneo", "Pabellón Central", []),
    ]
    for team, offset, hour, opponent, kind, place, sets in matches:
        await ok(await admin.post("/api/matches", json={
            "team_id": team, "date": day(offset), "time": hour, "opponent": opponent, "kind": kind, "location": place,
            "sets": [{"us": us, "them": them} for us, them in sets],
        }))

    # Calendario del club.
    for title, offset, hour, place, notes in (
        ("Torneo de Navidad del club", 30, "10:00", "Pabellón Municipal", "Mixto, equipos de 4. Apuntaos en el chat."),
        ("Reunión de familias de la Escuela", 6, "19:30", "Sala del pabellón", "Horarios del segundo trimestre y equipaciones."),
        ("Cena del club", 23, "21:00", "Restaurante La Pista", "15 € por persona. Confirmad antes del viernes."),
    ):
        await ok(await admin.post("/api/events", json={"title": title, "date": day(offset), "time": hour, "location": place, "notes": notes}))

    # Chat.
    messages = [
        ("demo-coordinacion", "general", "¡Bienvenidos a la app del club! Aquí tenéis horarios, partidos, el ranking y el chat de cada equipo."),
        ("demo-entrenador", "femenino", "Chicas, el jueves trabajamos recepción y salida de contraataque. Puntuales 😉"),
        ("mate-lucia.navarro", "femenino", "¡Allí estaremos!"),
        ("mate-marta.gil", "femenino", "¿Alguien me acerca el sábado al partido? 🙏"),
        ("demo-jugadora", "femenino", "Yo te llevo Marta, paso por tu casa a las 10:45"),
        ("demo-entrenador", "masculino", "Buen partido el domingo. Esta semana vídeo del rival en la pizarra."),
        ("mate-hugo.moreno", "masculino", "Vamos con todo 💪"),
        ("demo-familia", "familia", "¿El torneo de escuelas es todo el día? Para organizarnos con la comida."),
        ("demo-coordinacion", "familia", "Sí, de 10:00 a 14:00 aprox. Os pasamos el horario exacto esta semana."),
    ]
    for key, channel, text in messages:
        client = await client_for(key)
        await ok(await client.post(f"/api/chat/channels/{channel}/messages", json={"text": text}))
        await client.aclose()

    # Coins de regalo para la jugadora de la demo: así se puede comprar en la tienda en directo.
    await honors.give_coins(db, "u-demo-jugadora", 1500, "admin", "Regalo de la demo", "demo:regalo")
    await honors.give_coins(db, "u-demo-jugador", 900, "admin", "Regalo de la demo", "demo:regalo")
    player = await client_for("demo-jugadora")
    for item in ("shirt:fuego", "remate:rayo"):
        await ok(await player.post("/api/shop/buy", json={"item_id": item}))
    await ok(await player.put("/api/profile/character", json={
        "build": "female", "skin": "s2", "hair": "coleta", "hair_color": "castano", "eyes": "almond", "mouth": "smile",
        "beard": "none", "freckles": True, "blush": True, "headband": "naranja", "wristbands": "naranja",
        "kneepads": "negro", "shoes": "naranja", "celebration": "brazos", "shirt": "fuego", "fx_remate": "rayo",
    }))
    await player.aclose()

    # Pizarra: jugadas guardadas (demo/boards.json, sacadas de la propia pizarra).
    boards_file = Path(__file__).with_name("boards.json")
    if boards_file.exists():
        for board in json.loads(boards_file.read_text(encoding="utf-8")):
            # Los jugadores van por nombre ("name:Carmen López"): sus ids cambian en cada arranque.
            roster = {player["name"]: player["id"] for player in await ok(await coach.get(f"/api/players?team_id={board['team_id']}"))}
            for step in board["steps"]:
                for element in step["elements"]:
                    if str(element.get("player_id") or "").startswith("name:"):
                        element["player_id"] = roster.get(element["player_id"][5:])
            await ok(await coach.post("/api/boards", json=board))

    await admin.aclose()
    await coach.aclose()


asyncio.run(seed())
# Para probar otros equipos: DEMO_ESTRUCTURA=tools/estructura-ejemplo.json npm run demo
# (los datos de la demo son de los equipos de serie; con otra estructura salen los equipos vacíos).
if os.environ.get("DEMO_ESTRUCTURA"):
    structure = json.loads((ROOT / os.environ["DEMO_ESTRUCTURA"]).read_text(encoding="utf-8"))
    asyncio.run(db.club_settings.update_one({"id": "club"}, {"$set": {"structure": structure}}, upsert=True))
print("\n  Demo lista: abre http://localhost:5180/app y elige con quién entrar.\n")
uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("DEMO_API_PORT", "8100")), log_level="warning")
