import asyncio

import pytest

import auth
import chat
import players
import roster_sync
import user_profile
from test_auth import GOOGLE_ACCOUNTS, client_for, db  # noqa: F401

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"0" * 200


@pytest.fixture(autouse=True)
def reset_indexes(monkeypatch):
    for module, flag in ((players, "_indexes_ready"), (roster_sync, "_index_ready"), (chat, "_indexes_ready"), (user_profile, "_indexes_ready")):
        monkeypatch.setattr(module, flag, False)


@pytest.fixture
def admin(db):  # noqa: F811
    # La base simulada falla si estos índices se crean con datos dentro; la real, no.
    asyncio.run(players._ensure_indexes(db))
    return client_for("token-admin")


def member(admin, token="token-ana", role="jugador", team="femenino"):
    client = client_for(token)
    user_id = client.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{user_id}", json={"status": "approved", "role": role, "team_id": team})
    assert response.status_code == 200, response.text
    return client


def ficha(admin, name="Ana", team="femenino"):
    return next(player for player in admin.get(f"/api/players?team_id={team}").json() if player["name"] == name)


def upload(client, data=JPEG):
    return client.put("/api/profile/avatar", content=data, headers={"Content-Type": "application/octet-stream"})


def test_sin_aprobar_no_hay_perfil(db):  # noqa: F811
    pending = client_for("token-ana")
    assert pending.get("/api/profile").status_code == 403
    assert pending.patch("/api/profile", json={"name": "Otra Ana"}).status_code == 403
    assert upload(pending).status_code == 403


def test_el_jugador_cambia_su_propio_dorsal(admin):
    ana = member(admin)
    response = ana.patch("/api/profile", json={"number": 7})
    assert response.status_code == 200, response.text
    assert response.json()["player"]["number"] == 7
    assert ficha(admin)["number"] == 7

    assert ana.patch("/api/profile", json={"number": None}).status_code == 200
    assert ficha(admin)["number"] is None


def test_dorsal_ocupado_no_guarda_nada(admin):
    ana = member(admin)
    admin.post("/api/players", json={"team_id": "femenino", "name": "Ya Estaba", "number": 7})
    response = ana.patch("/api/profile", json={"number": 7, "name": "Nombre Nuevo", "dominant_hand": "izquierda"})
    assert response.status_code == 409
    profile = ana.get("/api/profile").json()
    assert profile["user"]["name"] == "Ana"
    assert profile["dominant_hand"] is None
    assert ficha(admin)["number"] is None


def test_el_mismo_dorsal_vale_en_otro_equipo_y_guardarlo_otra_vez(admin):
    ana = member(admin)
    admin.post("/api/players", json={"team_id": "masculino", "name": "Otro", "number": 7})
    assert ana.patch("/api/profile", json={"number": 7}).status_code == 200
    assert ana.patch("/api/profile", json={"number": 7}).status_code == 200


@pytest.mark.parametrize("number", [-1, 100, "siete"])
def test_dorsal_no_valido(admin, number):
    assert member(admin).patch("/api/profile", json={"number": number}).status_code == 422


def test_sin_ficha_no_hay_dorsal_ni_telefono(admin):
    family = member(admin, role="familia")
    assert family.patch("/api/profile", json={"number": 7}).status_code == 409
    assert family.patch("/api/profile", json={"phone": "+34 600 111 222"}).status_code == 409
    response = family.patch("/api/profile", json={"name": "Madre De Ana"})
    assert response.status_code == 200
    assert response.json()["player"] is None


def test_posiciones_preferidas_rellenan_la_que_esta_sin_definir(admin):
    ana = member(admin)
    response = ana.patch("/api/profile", json={"preferred_positions": ["Líbero", "Receptor"]})
    assert response.json()["preferred_positions"] == ["Líbero", "Receptor"]
    player = ficha(admin)
    assert player["preferred_positions"] == ["Líbero", "Receptor"]
    assert player["position"] == "Líbero"


def test_la_posicion_del_entrenador_no_se_toca(admin):
    ana = member(admin)
    admin.patch(f"/api/players/{ficha(admin)['id']}", json={"position": "Central"})
    ana.patch("/api/profile", json={"preferred_positions": ["Líbero"]})
    assert ficha(admin)["position"] == "Central"
    assert ficha(admin)["preferred_positions"] == ["Líbero"]


@pytest.mark.parametrize(
    "positions",
    [["Líbero", "Líbero"], ["Sin definir"], ["Portero"], ["Líbero", "Central", "Receptor", "Opuesto"]],
)
def test_posiciones_no_validas(admin, positions):
    assert member(admin).patch("/api/profile", json={"preferred_positions": positions}).status_code == 422


def test_preferencias_se_conservan_si_vuelve_a_la_plantilla(admin):
    ana = member(admin)
    ana.patch("/api/profile", json={"preferred_positions": ["Opuesto"]})
    user_id = ana.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{user_id}", json={"team_id": None})
    admin.patch(f"/api/users/{user_id}", json={"team_id": "playa"})
    player = ficha(admin, team="playa")
    assert (player["position"], player["preferred_positions"]) == ("Opuesto", ["Opuesto"])


def test_nombre_se_cambia_en_todas_partes_y_google_no_lo_pisa(admin):
    ana = member(admin)
    assert ana.patch("/api/profile", json={"name": "  Ana Gómez  "}).json()["user"]["name"] == "Ana Gómez"
    assert ficha(admin, "Ana Gómez")
    assert client_for("token-ana").get("/api/auth/me").json()["name"] == "Ana Gómez"
    assert GOOGLE_ACCOUNTS["token-ana"]["name"] == "Ana"


@pytest.mark.parametrize("body", [{"name": "A"}, {"name": None}, {"height_cm": 300}, {"dominant_hand": "pie"}, {"phone": "abc"}, {}])
def test_datos_no_validos(admin, body):
    assert member(admin).patch("/api/profile", json=body).status_code == 422


@pytest.mark.parametrize("body", [{"role": "admin"}, {"status": "approved"}, {"team_id": "playa"}, {"position": "Central"}, {"court": {"x": 0, "y": 0}}])
def test_no_se_cambia_nada_de_lo_que_decide_el_club(admin, body):
    ana = member(admin)
    assert ana.patch("/api/profile", json=body).status_code == 422
    assert ana.get("/api/auth/me").json()["role"] == "jugador"


def test_el_telefono_solo_lo_ve_el_cuerpo_tecnico(admin):
    ana = member(admin)
    luis = member(admin, "token-luis")
    assert ana.patch("/api/profile", json={"phone": "+34 600 111 222"}).status_code == 200
    assert ficha(admin)["phone"] == "+34 600 111 222"
    assert "phone" not in ficha(luis)
    assert ana.get("/api/profile").json()["player"]["phone"] == "+34 600 111 222"


def test_estadisticas_de_asistencia(admin):
    from test_also_plays import training_day

    ana = member(admin)
    ana.put("/api/attendance", json={"team_id": "femenino", "date": training_day("femenino"), "status": "going"})
    assert ana.get("/api/profile").json()["stats"] == {"days": 30, "going": 1, "not_going": 0}


def test_entrenador_ve_sus_equipos(admin):
    coach = member(admin, role="entrenador", team="masculino")
    user_id = coach.get("/api/auth/me").json()["id"]
    admin.patch(f"/api/users/{user_id}", json={"coached_team_ids": ["escuela-lm"]})
    profile = coach.get("/api/profile").json()
    assert profile["team_name"] == "Club Masculino"
    assert profile["coached_team_names"] == ["Club Escuela LM"]


@pytest.mark.parametrize("data,media_type", [(JPEG, "image/jpeg"), (WEBP, "image/webp")])
def test_subir_y_ver_una_foto(admin, data, media_type):
    ana = member(admin)
    response = upload(ana, data)
    assert response.status_code == 200, response.text
    user = response.json()
    assert user["has_custom_picture"] is True
    assert user["picture"].startswith(f"/api/users/{user['id']}/avatar?v=")

    seen = member(admin, "token-luis").get(user["picture"])
    assert seen.status_code == 200
    assert seen.content == data
    assert seen.headers["content-type"] == media_type
    assert seen.headers["x-content-type-options"] == "nosniff"


@pytest.mark.parametrize(
    "data",
    [b"", b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", b"<html><script>alert(1)</script></html>", b"GIF89a" + b"0" * 50],
)
def test_solo_se_aceptan_fotos(admin, data):
    assert upload(member(admin), data).status_code == 415


def test_foto_demasiado_grande(admin):
    assert upload(member(admin), JPEG + b"0" * user_profile.MAX_AVATAR_BYTES).status_code == 413


def test_ver_fotos_exige_tener_acceso(admin):
    from test_password_auth import anonymous

    picture = upload(member(admin)).json()["picture"]
    assert anonymous().get(picture).status_code == 401


def test_nueva_foto_cambia_la_direccion(admin):
    ana = member(admin)
    first = upload(ana).json()["picture"]
    second = upload(ana, WEBP).json()["picture"]
    assert first != second
    assert ana.get(second).content == WEBP


def test_quitar_la_foto_vuelve_a_la_de_google(admin, monkeypatch):
    monkeypatch.setitem(GOOGLE_ACCOUNTS, "token-ana", {**GOOGLE_ACCOUNTS["token-ana"], "picture": "https://google.example/ana.jpg"})
    ana = member(admin)
    picture = upload(ana).json()["picture"]
    assert client_for("token-ana").get("/api/auth/me").json()["picture"] == picture  # Entrar no la pisa.

    response = ana.delete("/api/profile/avatar")
    assert response.json()["picture"] == "https://google.example/ana.jpg"
    assert response.json()["has_custom_picture"] is False
    assert ana.get(picture).status_code == 404


def test_gradas_solo_con_las_familias_aprobadas_de_ese_equipo(admin):
    family = member(admin, role="familia")
    picture = upload(family).json()["picture"]
    player = member(admin, "token-luis")
    stands = player.get("/api/teams/femenino/family").json()
    assert stands == [{"id": family.get("/api/auth/me").json()["id"], "name": "Ana", "picture": picture}]
    assert player.get("/api/teams/masculino/family").json() == []

    user_id = stands[0]["id"]
    assert admin.patch(f"/api/users/{user_id}", json={"status": "rejected"}).status_code == 200
    assert player.get("/api/teams/femenino/family").json() == []


def test_gradas_no_salen_jugadores_y_exigen_acceso(admin):
    player = member(admin)
    assert player.get("/api/teams/femenino/family").json() == []
    assert client_for("token-luis").get("/api/teams/femenino/family").status_code == 403
    assert player.get("/api/teams/inventado/family").status_code == 422


def test_la_foto_sale_en_plantilla_y_chat(admin):
    ana = member(admin)
    picture = upload(ana).json()["picture"]
    assert ficha(admin)["picture"] == picture
    ana.post("/api/chat/channels/general/messages", json={"text": "Hola"})
    message = admin.get("/api/chat/channels/general/messages").json()["messages"][0]
    assert message["author_picture"] == picture
    assert auth.picture_of({"id": "x"}) == ""


def test_estatura_se_guarda_y_sale_en_la_plantilla(admin):
    ana = member(admin)
    response = ana.patch("/api/profile", json={"height_cm": 172})
    assert response.status_code == 200, response.text
    assert response.json()["height_cm"] == 172
    assert ficha(admin)["height_cm"] == 172

    assert ana.patch("/api/profile", json={"height_cm": None}).status_code == 200
    assert ana.get("/api/profile").json()["height_cm"] is None
    assert ficha(admin)["height_cm"] is None


@pytest.mark.parametrize("height", [119, 231, 1.72, "alto"])
def test_estatura_no_valida(admin, height):
    ana = member(admin)
    assert ana.patch("/api/profile", json={"height_cm": height}).status_code == 422
