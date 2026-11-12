import asyncio
import json
from datetime import timedelta

import pytest
from pywebpush import WebPushException

import chat
import matches
import notifications
import ranking
from test_auth import client_for, db  # noqa: F401

FCM = "https://fcm.googleapis.com/fcm/send/"


class FakeResponse:
    def __init__(self, status_code):
        self.status_code = status_code
        self.text = ""


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setenv("VAPID_PUBLIC_KEY", "clave-publica")
    monkeypatch.setenv("VAPID_PRIVATE_KEY", "clave-privada")
    monkeypatch.setenv("VAPID_SUBJECT", "https://club.test")
    for module in (notifications, chat, matches, ranking):
        monkeypatch.setattr(module, "_indexes_ready", False)


@pytest.fixture
def sent(monkeypatch):
    """Lo que se habría enviado: (móvil, datos)."""
    calls = []

    def fake(subscription, data, ttl, topic):
        calls.append((subscription["endpoint"].removeprefix(FCM), json.loads(data)))
        return False

    monkeypatch.setattr(notifications, "_send_one", fake)
    return calls


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def member(admin, token, role="jugador", team="masculino", **extra):
    client = client_for(token)
    user_id = client.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{user_id}", json={"status": "approved", "role": role, "team_id": team, **extra})
    assert response.status_code == 200, response.text
    return client


def subscribe(client, device):
    response = client.put("/api/notifications/subscription", json={"endpoint": FCM + device, "keys": {"p256dh": "a", "auth": "b"}})
    assert response.status_code == 204, response.text


def say(client, channel="masculino", text="Hola"):
    response = client.post(f"/api/chat/channels/{channel}/messages", json={"text": text})
    assert response.status_code == 201, response.text


def today():
    return matches._today().isoformat()


def create_match(client, **body):
    payload = {"team_id": "masculino", "date": today(), "time": "18:00", "opponent": "CV Roquetas", **body}
    response = client.post("/api/matches", json=payload)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_sin_claves_no_se_ofrece_ni_se_envia(admin, sent, monkeypatch):
    monkeypatch.delenv("VAPID_PRIVATE_KEY")
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    assert ana.get("/api/notifications/status").json()["enabled"] is False
    say(admin)
    assert sent == []


def test_el_estado_no_descubre_la_clave_privada(admin):
    assert "clave-privada" not in admin.get("/api/notifications/status").text


@pytest.mark.parametrize("endpoint", ["http://fcm.googleapis.com/x", "https://evil.test/x", "https://fcm.googleapis.com.evil.test/x", "https://localhost/x"])
def test_solo_servicios_de_avisos_conocidos(admin, endpoint):
    response = admin.put("/api/notifications/subscription", json={"endpoint": endpoint, "keys": {"p256dh": "a", "auth": "b"}})
    assert response.status_code == 422


@pytest.mark.parametrize("endpoint", ["https://web.push.apple.com/x", "https://updates.push.services.mozilla.com/x", "https://wns2-par02p.notify.windows.com/x"])
def test_servicios_de_avisos_admitidos(admin, endpoint):
    assert admin.put("/api/notifications/subscription", json={"endpoint": endpoint, "keys": {"p256dh": "a", "auth": "b"}}).status_code == 204


def test_sin_acceso_no_se_apunta(db):  # noqa: F811
    response = client_for("token-ana").put("/api/notifications/subscription", json={"endpoint": FCM + "x", "keys": {"p256dh": "a", "auth": "b"}})
    assert response.status_code == 403


def test_el_mensaje_avisa_a_los_del_chat_menos_al_autor(admin, sent):
    ana = member(admin, "token-ana")
    luis = member(admin, "token-luis")
    subscribe(ana, "ana")
    subscribe(luis, "luis")
    say(ana, text="Llevo los balones")
    assert [device for device, _ in sent] == ["luis"]
    payload = sent[0][1]
    assert payload["title"] == "Masculino"
    assert payload["body"] == "Ana: Llevo los balones"
    assert payload["url"] == "/app/chat?canal=masculino"
    assert payload["tag"] == "chat-masculino"


def test_el_chat_de_otro_equipo_no_avisa(admin, sent):
    ana = member(admin, "token-ana", team="femenino")
    subscribe(ana, "ana")
    say(admin, "masculino")
    assert sent == []


def test_no_avisa_si_estas_viendo_ese_chat(admin, sent):
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    assert ana.get("/api/chat/channels/masculino/messages").status_code == 200
    say(admin)
    assert sent == []


def test_avisa_si_miras_otro_chat_o_hace_rato_que_saliste(admin, sent, db):  # noqa: F811
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    assert ana.get("/api/chat/channels/general/messages").status_code == 200
    say(admin)
    assert len(sent) == 1

    assert ana.get("/api/chat/channels/masculino/messages").status_code == 200
    old = chat._now() - timedelta(seconds=chat.PRESENCE_SECONDS + 1)
    asyncio.run(db.chat_presence.update_many({}, {"$set": {"at": old}}))
    say(admin)
    assert len(sent) == 2


def test_se_puede_apagar_cada_tipo(admin, sent):
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    response = ana.put("/api/notifications/preferences", json={"chat": False})
    assert response.json() == {"chat": False, "matches": True, "ranking": True}
    say(admin)
    assert sent == []
    create_match(admin)
    assert len(sent) == 1


def test_preferencias_vacias_no_valen(admin):
    assert admin.put("/api/notifications/preferences", json={}).status_code == 422
    assert admin.put("/api/notifications/preferences", json={"chat": None}).status_code == 422


def test_al_borrar_la_suscripcion_deja_de_avisar(admin, sent):
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    assert ana.post("/api/notifications/subscription/remove", json={"endpoint": FCM + "ana"}).status_code == 204
    say(admin)
    assert sent == []


def test_no_se_puede_borrar_la_de_otro(admin, sent):
    ana = member(admin, "token-ana")
    luis = member(admin, "token-luis")
    subscribe(ana, "ana")
    assert luis.post("/api/notifications/subscription/remove", json={"endpoint": FCM + "ana"}).status_code == 204
    say(admin)
    assert len(sent) == 1


def test_el_movil_pasa_a_quien_inicia_sesion(admin, sent):
    ana = member(admin, "token-ana")
    luis = member(admin, "token-luis")
    subscribe(ana, "compartido")
    subscribe(luis, "compartido")
    say(ana)
    assert [device for device, _ in sent] == ["compartido"]
    sent.clear()
    say(luis)
    assert sent == []


def test_quien_pierde_el_acceso_deja_de_recibir(admin, sent):
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    user_id = ana.get("/api/auth/me").json()["id"]
    assert admin.patch(f"/api/users/{user_id}", json={"status": "rejected"}).status_code == 200
    say(admin)
    assert sent == []


def test_el_movil_que_ya_no_existe_se_olvida(admin, db, monkeypatch):  # noqa: F811
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")

    def gone(**_kwargs):
        raise WebPushException("gone", response=FakeResponse(410))

    monkeypatch.setattr(notifications, "webpush", gone)
    say(admin)
    assert asyncio.run(db.push_subscriptions.count_documents({})) == 0


def test_otros_errores_conservan_el_movil_y_no_rompen_el_mensaje(admin, db, monkeypatch):  # noqa: F811
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")

    def fails(**_kwargs):
        raise WebPushException("error", response=FakeResponse(500))

    monkeypatch.setattr(notifications, "webpush", fails)
    say(admin)
    assert asyncio.run(db.push_subscriptions.count_documents({})) == 1


def test_un_fallo_inesperado_no_rompe_el_mensaje(admin, monkeypatch):
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")

    def explodes(*_args):
        raise RuntimeError("fallo")

    monkeypatch.setattr(notifications, "_send_one", explodes)
    say(admin)


def test_partido_nuevo_avisa_al_equipo_y_su_entrenador(admin, sent):
    ana = member(admin, "token-ana")
    coach = member(admin, "token-luis", role="entrenador", team="femenino", coached_team_ids=["masculino"])
    subscribe(ana, "ana")
    subscribe(coach, "coach")
    subscribe(admin, "admin")
    match_id = create_match(admin)
    assert sorted(device for device, _ in sent) == ["ana", "coach"]
    payload = sent[0][1]
    assert payload["title"] == "Partido nuevo"
    assert "18:00 contra CV Roquetas" in payload["body"]
    assert payload["url"] == "/app?equipo=masculino&pestana=partidos"
    assert payload["tag"] == f"match-{match_id}"


def test_partido_no_avisa_a_otros_equipos_ni_a_familias(admin, sent):
    other = member(admin, "token-ana", team="femenino")
    family = member(admin, "token-luis", role="familia")
    subscribe(other, "otro")
    subscribe(family, "familia")
    create_match(admin)
    assert sent == []


def test_partido_de_escuela_avisa_a_las_dos(admin, sent):
    tarde = member(admin, "token-ana", team="escuela-mj")
    manana = member(admin, "token-luis", team="escuela-lm")
    subscribe(tarde, "mj")
    subscribe(manana, "lm")
    create_match(admin, team_id="escuela-mj")
    assert sorted(device for device, _ in sent) == ["lm", "mj"]


def test_cambiar_hora_avisa_y_cambiar_notas_no(admin, sent):
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    match_id = create_match(admin)
    sent.clear()
    assert admin.patch(f"/api/matches/{match_id}", json={"notes": "Llevad agua"}).status_code == 200
    assert sent == []
    assert admin.patch(f"/api/matches/{match_id}", json={"time": "18:00"}).status_code == 200
    assert sent == []
    assert admin.patch(f"/api/matches/{match_id}", json={"time": "19:30"}).status_code == 200
    assert sent[0][1]["title"] == "Cambios en el partido"
    assert "19:30" in sent[0][1]["body"]


def test_cancelar_avisa(admin, sent):
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    match_id = create_match(admin)
    sent.clear()
    assert admin.delete(f"/api/matches/{match_id}").status_code == 204
    assert sent[0][1]["title"] == "Partido cancelado"


def test_borrar_un_partido_ya_jugado_no_avisa(admin, sent, db):  # noqa: F811
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    match_id = create_match(admin)
    sent.clear()
    yesterday = (matches._today() - timedelta(days=1)).isoformat()
    asyncio.run(db.matches.update_one({"id": match_id}, {"$set": {"date": yesterday}}))
    assert admin.delete(f"/api/matches/{match_id}").status_code == 204
    assert sent == []


def add_rating(admin, week):
    me = admin.get("/api/auth/me").json()["id"]
    assert admin.patch(f"/api/users/{me}", json={"coached_team_ids": ["masculino"]}).status_code == 200
    player = admin.post("/api/players", json={"team_id": "masculino", "name": "Lola", "position": "Receptor"}).json()["id"]
    response = admin.put(
        "/api/ranking/ratings",
        json={"group_id": "masculino", "week": week, "player_id": player, "position": "Receptor", "scores": {"saque": 8}},
    )
    assert response.status_code == 200, response.text


def test_publicar_ranking_avisa_solo_la_primera_vez(admin, sent):
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    week = ranking._current_monday().isoformat()
    add_rating(admin, week)
    assert sent == []
    body = {"group_id": "masculino", "week": week}
    assert admin.post("/api/ranking/publish", json=body).status_code == 200
    assert sent[0][1]["url"] == "/app/ranking?grupo=masculino"
    assert admin.post("/api/ranking/publish", json=body).status_code == 200
    assert len(sent) == 1


def test_apuntar_un_partido_ya_jugado_no_avisa(admin, sent):
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    create_match(admin, date=(matches._today() - timedelta(days=3)).isoformat())
    assert sent == []


def test_apuntar_el_resultado_no_avisa(admin, sent):
    ana = member(admin, "token-ana")
    subscribe(ana, "ana")
    match_id = create_match(admin)
    sent.clear()
    assert admin.patch(f"/api/matches/{match_id}", json={"sets": [{"us": 25, "them": 20}]}).status_code == 200
    assert sent == []
