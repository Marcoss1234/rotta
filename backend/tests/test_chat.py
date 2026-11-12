import pytest

import chat
from test_auth import client_for, db  # noqa: F401

ALL_CHANNELS = ["general", "masculino", "femenino", "escuela-lm", "escuela-mj", "playa", "familia"]


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    monkeypatch.setattr(chat, "_indexes_ready", False)


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def member(admin, token="token-ana", role="jugador", team="femenino", status="approved"):
    client = client_for(token)
    user_id = client.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{user_id}", json={"status": status, "role": role, "team_id": team})
    assert response.status_code == 200, response.text
    return client


def channel_ids(client):
    response = client.get("/api/chat/channels")
    assert response.status_code == 200, response.text
    return [channel["id"] for channel in response.json()]


def send(client, channel="general", text="Hola"):
    return client.post(f"/api/chat/channels/{channel}/messages", json={"text": text})


def texts(client, channel="general"):
    return [message["text"] for message in client.get(f"/api/chat/channels/{channel}/messages").json()["messages"]]


def unread(client, channel="general"):
    return next(item for item in client.get("/api/chat/channels").json() if item["id"] == channel)["unread"]


def test_sin_sesion_o_sin_aprobar_no_hay_chat(db):  # noqa: F811
    from fastapi.testclient import TestClient

    from server import app

    assert TestClient(app).get("/api/chat/channels").status_code == 401
    pending = client_for("token-ana")
    assert pending.get("/api/chat/channels").status_code == 403
    assert pending.get("/api/chat/channels/general/messages").status_code == 403
    assert send(pending).status_code == 403


def test_admin_ve_todos_los_chats(admin):
    assert channel_ids(admin) == ALL_CHANNELS


@pytest.mark.parametrize("role", ["jugador", "entrenador"])
def test_jugadores_y_entrenadores_ven_general_su_equipo_y_familia(admin, role):
    assert channel_ids(member(admin, role=role)) == ["general", "femenino", "familia"]


def test_la_familia_solo_tiene_su_chat(admin):
    family = member(admin, role="familia")
    assert channel_ids(family) == ["familia"]
    for channel in ("general", "femenino"):
        assert family.get(f"/api/chat/channels/{channel}/messages").status_code == 403
        assert send(family, channel).status_code == 403
    assert send(family, "familia", "Hola").status_code == 201
    assert texts(admin, "familia") == ["Hola"]


@pytest.mark.parametrize("role", ["jugador", "entrenador"])
def test_en_el_chat_familia_estamos_todos(admin, role):
    other = member(admin, role=role)
    family = member(admin, "token-luis", role="familia")
    assert send(family, "familia", "Hola a todos").status_code == 201
    assert send(other, "familia", "Hola").status_code == 201
    assert send(admin, "familia", "Buenas").status_code == 201
    for client in (other, family, admin):
        assert texts(client, "familia") == ["Hola a todos", "Hola", "Buenas"]


def test_familia_sin_equipo_tambien_tiene_su_chat(admin):
    assert channel_ids(member(admin, role="familia", team=None)) == ["familia"]


def test_una_familia_ya_no_borra_ni_escribe_en_chats_anteriores(admin):
    message = send(admin, "general").json()
    family = member(admin, role="familia")
    assert family.delete(f"/api/chat/messages/{message['id']}").status_code == 404


def test_sin_equipo_general_y_familia(admin):
    assert channel_ids(member(admin, team=None)) == ["general", "familia"]


def test_no_se_entra_en_el_chat_de_otro_equipo(admin):
    ana = member(admin)
    send(admin, "masculino", "Secreto")
    assert ana.get("/api/chat/channels/masculino/messages").status_code == 403
    assert send(ana, "masculino").status_code == 403
    assert ana.post("/api/chat/channels/masculino/read").status_code == 403


def test_chat_inexistente(admin):
    assert admin.get("/api/chat/channels/inventado/messages").status_code == 422


def test_los_del_equipo_y_el_admin_comparten_mensajes(admin):
    ana = member(admin)
    luis = member(admin, "token-luis")
    assert send(ana, "femenino", "¿Quién lleva balones?").status_code == 201
    assert send(admin, "femenino", "Yo").status_code == 201
    assert texts(luis, "femenino") == ["¿Quién lleva balones?", "Yo"]
    assert texts(luis) == []


def test_las_escuelas_tienen_chats_separados(admin):
    lunes = member(admin, team="escuela-lm")
    martes = member(admin, "token-luis", team="escuela-mj")
    send(lunes, "escuela-lm", "Grupo de lunes")
    assert texts(admin, "escuela-lm") == ["Grupo de lunes"]
    assert martes.get("/api/chat/channels/escuela-lm/messages").status_code == 403
    assert texts(martes, "escuela-mj") == []


def test_cambiar_de_equipo_cambia_de_chat_al_momento(admin):
    ana = member(admin)
    user_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{user_id}", json={"team_id": "masculino"})
    assert channel_ids(ana) == ["general", "masculino", "familia"]
    assert ana.get("/api/chat/channels/femenino/messages").status_code == 403


def test_quitar_el_acceso_corta_el_chat(admin):
    ana = member(admin)
    user_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{user_id}", json={"status": "rejected"})
    assert ana.get("/api/chat/channels/general/messages").status_code == 403
    assert send(ana).status_code == 403


@pytest.mark.parametrize("text", ["", "   \n ", "x" * 1001])
def test_texto_no_valido(admin, text):
    assert send(admin, text=text).status_code == 422
    assert texts(admin) == []


def test_no_se_puede_suplantar_al_autor(admin):
    ana = member(admin)
    response = ana.post("/api/chat/channels/general/messages", json={"text": "Hola", "author": "Admin"})
    assert response.status_code == 422


def test_el_mensaje_lleva_autor_y_no_expone_datos_de_la_cuenta(admin):
    ana = member(admin)
    message = send(ana).json()
    assert (message["author"], message["author_role"], message["mine"], message["can_delete"]) == ("Ana", "jugador", True, True)
    assert "user_id" not in message and "email" not in message and "_id" not in message
    seen = admin.get("/api/chat/channels/general/messages").json()["messages"][0]
    assert (seen["mine"], seen["can_delete"]) == (False, True)


def test_cada_mensaje_identifica_a_su_autor_para_darle_color(admin):
    ana = member(admin)
    ana_id = ana.get("/api/auth/me").json()["id"]
    send(ana, text="Uno")
    ana.patch("/api/profile", json={"name": "Ana Nueva"})
    send(ana, text="Dos")
    authors = [m["author_id"] for m in admin.get("/api/chat/channels/general/messages").json()["messages"]]
    assert authors == [ana_id, ana_id]


def test_el_html_se_guarda_tal_cual(admin):
    send(admin, text="<script>alert(1)</script>")
    assert texts(admin) == ["<script>alert(1)</script>"]


def test_paginacion_de_mensajes_anteriores(admin, monkeypatch):
    monkeypatch.setattr(chat, "PAGE_SIZE", 3)
    for number in range(7):
        send(admin, text=str(number))

    latest = admin.get("/api/chat/channels/general/messages").json()
    assert [m["text"] for m in latest["messages"]] == ["4", "5", "6"]
    assert latest["has_more"] is True

    older = admin.get(f"/api/chat/channels/general/messages?before={latest['messages'][0]['id']}").json()
    assert [m["text"] for m in older["messages"]] == ["1", "2", "3"]
    assert older["has_more"] is True

    oldest = admin.get(f"/api/chat/channels/general/messages?before={older['messages'][0]['id']}").json()
    assert [m["text"] for m in oldest["messages"]] == ["0"]
    assert oldest["has_more"] is False


def test_before_de_otro_chat_no_sirve(admin):
    secret = send(admin, "masculino").json()
    assert admin.get(f"/api/chat/channels/general/messages?before={secret['id']}").status_code == 404


def test_no_leidos(admin):
    ana = member(admin)
    send(admin, text="Uno")
    send(admin, text="Dos")
    assert unread(ana) == 2
    assert unread(admin) == 0  # Los propios no cuentan.

    assert ana.post("/api/chat/channels/general/read").status_code == 204
    assert unread(ana) == 0

    send(admin, text="Tres")
    assert unread(ana) == 1


def test_marcar_leido_sin_mensajes_no_falla(admin):
    assert admin.post("/api/chat/channels/general/read").status_code == 204
    assert unread(admin) == 0


def test_resumen_del_chat(admin):
    assert admin.get("/api/chat/channels").json()[0]["last_message"] is None
    send(admin, text="y" * 200)
    last = admin.get("/api/chat/channels").json()[0]["last_message"]
    assert last["author"] == "Admin"
    assert len(last["text"]) == chat.PREVIEW_LENGTH
    assert last["created_at"].endswith("Z")


def test_borrar_mensajes(admin):
    ana = member(admin)
    luis = member(admin, "token-luis")
    first = send(ana, text="De Ana").json()
    second = send(ana, text="Otro de Ana").json()

    assert luis.delete(f"/api/chat/messages/{first['id']}").status_code == 403
    assert ana.delete(f"/api/chat/messages/{first['id']}").status_code == 204
    assert admin.delete(f"/api/chat/messages/{second['id']}").status_code == 204
    assert texts(admin) == []
    assert ana.delete(f"/api/chat/messages/{first['id']}").status_code == 404


def test_entrenador_no_borra_mensajes_ajenos(admin):
    coach = member(admin, role="entrenador")
    message = send(admin, "femenino").json()
    assert coach.delete(f"/api/chat/messages/{message['id']}").status_code == 403


def seen_flags(client, channel="general"):
    return [m["seen"] for m in client.get(f"/api/chat/channels/{channel}/messages").json()["messages"]]


def test_un_tick_hasta_que_otro_lo_lee(admin):
    ana = member(admin)
    assert send(ana, text="Uno").json()["seen"] is False
    assert seen_flags(ana) == [False]

    # Que el propio autor lo lea no cuenta como visto.
    ana.post("/api/chat/channels/general/read")
    assert seen_flags(ana) == [False]

    admin.post("/api/chat/channels/general/read")
    assert seen_flags(ana) == [True]


def test_lo_enviado_despues_de_leer_sigue_sin_ver(admin):
    ana = member(admin)
    send(ana, text="Uno")
    admin.post("/api/chat/channels/general/read")
    send(ana, text="Dos")
    assert seen_flags(ana) == [True, False]


def test_el_visto_no_se_cruza_entre_chats(admin):
    ana = member(admin)
    send(ana, "femenino", "Equipo")
    send(ana, "general", "Club")
    admin.post("/api/chat/channels/general/read")
    assert seen_flags(ana, "femenino") == [False]
    assert seen_flags(ana, "general") == [True]


def test_el_visto_solo_lo_recibe_el_autor(admin):
    ana = member(admin)
    luis = member(admin, "token-luis")
    send(ana, text="Uno")
    luis.post("/api/chat/channels/general/read")
    assert seen_flags(ana) == [True]
    assert seen_flags(luis) == [False]


def typing_names(client, channel="general"):
    return client.get(f"/api/chat/channels/{channel}/messages").json()["typing"]


def test_escribiendo_se_ve_por_los_demas_y_no_por_uno_mismo(admin):
    ana = member(admin)
    assert ana.post("/api/chat/channels/general/typing").status_code == 204
    assert typing_names(admin) == ["Ana"]
    assert typing_names(ana) == []
    assert typing_names(admin, "femenino") == []


def test_varios_escribiendo(admin):
    ana = member(admin)
    luis = member(admin, "token-luis")
    ana.post("/api/chat/channels/general/typing")
    luis.post("/api/chat/channels/general/typing")
    ana.post("/api/chat/channels/general/typing")
    assert typing_names(admin) == ["Ana", "Luis"]


def test_dejar_de_escribir_o_enviar_lo_quita(admin):
    ana = member(admin)
    ana.post("/api/chat/channels/general/typing")
    assert ana.delete("/api/chat/channels/general/typing").status_code == 204
    assert typing_names(admin) == []

    ana.post("/api/chat/channels/general/typing")
    send(ana)
    assert typing_names(admin) == []


def test_escribiendo_caduca_solo(admin, monkeypatch):
    ana = member(admin)
    ana.post("/api/chat/channels/general/typing")
    monkeypatch.setattr(chat, "TYPING_SECONDS", -1)
    assert typing_names(admin) == []


def test_no_se_avisa_de_escribir_en_un_chat_ajeno(admin):
    ana = member(admin)
    assert ana.post("/api/chat/channels/masculino/typing").status_code == 403
    assert ana.delete("/api/chat/channels/masculino/typing").status_code == 403
    assert typing_names(admin, "masculino") == []


def test_mensaje_de_chat_ajeno_no_se_revela_al_borrar(admin):
    ana = member(admin)
    message = send(admin, "masculino").json()
    assert ana.delete(f"/api/chat/messages/{message['id']}").status_code == 404
    assert texts(admin, "masculino") == ["Hola"]


JPEG = b"\xff\xd8\xff\xe0" + b"0" * 300
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"0" * 300


def send_image(client, channel="general", data=JPEG, text=None, width=800, height=600):
    params = {"width": width, "height": height}
    if text is not None:
        params["text"] = text
    return client.post(
        f"/api/chat/channels/{channel}/images",
        params=params,
        content=data,
        headers={"Content-Type": "application/octet-stream"},
    )


@pytest.mark.parametrize("data, media_type", [(JPEG, "image/jpeg"), (WEBP, "image/webp")])
def test_enviar_y_ver_una_foto(admin, data, media_type):
    ana = member(admin)
    response = send_image(ana, "femenino", data, text="  Mirad  ")
    assert response.status_code == 201, response.text
    sent = response.json()
    assert sent["text"] == "Mirad"
    assert sent["image"]["width"] == 800 and sent["image"]["height"] == 600
    luis = member(admin, "token-luis")
    message = luis.get("/api/chat/channels/femenino/messages").json()["messages"][-1]
    assert message["image"] == sent["image"]
    photo = luis.get(sent["image"]["url"])
    assert photo.status_code == 200
    assert photo.content == data
    assert photo.headers["content-type"] == media_type


def test_foto_sin_texto_y_resumen(admin):
    ana = member(admin)
    assert send_image(ana).status_code == 201
    summary = next(item for item in admin.get("/api/chat/channels").json() if item["id"] == "general")
    assert summary["last_message"]["text"] == "📷 Foto"
    assert send(ana, text="Hola").json()["image"] is None


def test_la_foto_de_otro_equipo_no_se_ve(admin):
    ana = member(admin)
    url = send_image(ana, "femenino").json()["image"]["url"]
    pablo = member(admin, "token-luis", team="masculino")
    assert pablo.get(url).status_code == 404
    assert send_image(pablo, "femenino").status_code == 403


@pytest.mark.parametrize("data", [b"no es una imagen", b"GIF89a" + b"0" * 50])
def test_solo_se_aceptan_fotos(admin, data):
    assert send_image(member(admin), data=data).status_code == 415


def test_foto_demasiado_grande(admin):
    assert send_image(member(admin), data=JPEG + b"0" * (2 * 1024 * 1024)).status_code == 413


@pytest.mark.parametrize("width, height", [(0, 600), (800, 5000)])
def test_medidas_no_validas(admin, width, height):
    assert send_image(member(admin), width=width, height=height).status_code == 422


def test_borrar_el_mensaje_borra_la_foto(admin):
    ana = member(admin)
    sent = send_image(ana).json()
    assert ana.delete(f"/api/chat/messages/{sent['id']}").status_code == 204
    assert ana.get(sent["image"]["url"]).status_code == 404
