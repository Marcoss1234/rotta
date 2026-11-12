import pytest

from test_auth import client_for, db  # noqa: F401

LOOK = {
    "build": "female",
    "skin": "s3",
    "hair": "coleta",
    "hair_color": "castano",
    "eyes": "almond",
    "mouth": "smile",
    "beard": "none",
    "freckles": True,
    "blush": False,
    "headband": "naranja",
    "wristbands": "none",
    "kneepads": "negro",
    "shoes": "blanco",
    "celebration": "brazos",
    "weight": 70,
    "muscle": 30,
    "hair_color2": "none",
    "hair_split": "vertical",
    "eyeliner": False,
    "glasses": "none",
    "shirt": "normal",
    "fx_remate": "none",
    "fx_recepcion": "none",
    "fx_colocacion": "none",
}


@pytest.fixture
def admin(db):  # noqa: F811
    return client_for("token-admin")


def member(admin, token="token-ana", role="jugador", team="femenino"):
    client = client_for(token)
    user_id = client.get("/api/auth/me").json()["id"]
    response = admin.patch(f"/api/users/{user_id}", json={"status": "approved", "role": role, "team_id": team})
    assert response.status_code == 200, response.text
    return client


def save(client, **changes):
    return client.put("/api/profile/character", json={**LOOK, **changes})


def test_cada_uno_guarda_su_personaje(admin):
    ana = member(admin)
    assert ana.get("/api/profile").json()["character"] is None
    response = save(ana)
    assert response.status_code == 200, response.text
    assert response.json()["character"] == LOOK
    assert ana.get("/api/profile").json()["character"] == LOOK


def test_se_puede_cambiar_otra_vez(admin):
    ana = member(admin)
    save(ana)
    assert save(ana, hair="moño", hair_color="rosa").json()["character"]["hair"] == "moño"


def test_el_personaje_sale_en_la_plantilla_para_la_pizarra(admin):
    ana = member(admin)
    save(ana)
    luis = member(admin, "token-luis")
    players = {player["name"]: player for player in luis.get("/api/players?team_id=femenino").json()}
    assert players["Ana"]["character"] == LOOK
    assert players["Luis"]["character"] is None


@pytest.mark.parametrize(
    "changes",
    [{"hair": "cresta"}, {"skin": "s9"}, {"celebration": "baile"}, {"freckles": "mucho"}, {"inventado": 1}, {"headband": "#123456"}],
)
def test_opciones_que_no_existen(admin, changes):
    assert save(member(admin), **changes).status_code == 422


def test_hacen_falta_todas_las_opciones(admin):
    ana = member(admin)
    incomplete = {key: value for key, value in LOOK.items() if key != "hair"}
    assert ana.put("/api/profile/character", json=incomplete).status_code == 422


def test_sin_aprobar_no_se_guarda(db):  # noqa: F811
    assert save(client_for("token-ana")).status_code == 403
    assert save(client_for()).status_code == 401


@pytest.mark.parametrize("field", ["weight", "muscle"])
def test_cuerpo_fuera_de_rango(admin, field):
    ana = member(admin)
    assert save(ana, **{field: 101}).status_code == 422
    assert save(ana, **{field: -1}).status_code == 422


def test_personaje_antiguo_sin_cuerpo_queda_normal(admin):
    ana = member(admin)
    old = {key: value for key, value in LOOK.items() if key not in ("weight", "muscle")}
    character = ana.put("/api/profile/character", json=old).json()["character"]
    assert character["weight"] == 50 and character["muscle"] == 50


def test_el_remate_ya_no_es_una_celebracion(admin):
    assert save(member(admin), celebration="remate").status_code == 422



def test_pelo_de_dos_colores_barbas_y_eyeliner(admin):
    ana = member(admin)
    for beard in ("short", "full", "moustache", "goatee", "moustache_goatee"):
        saved = save(ana, beard=beard, hair_color2="gris", hair_split="horizontal", eyeliner=True)
        assert saved.status_code == 200, saved.text
        character = saved.json()["character"]
        assert character["beard"] == beard and character["hair_color2"] == "gris" and character["eyeliner"] is True
    assert save(ana, hair_color2="verde").status_code == 422
    assert save(ana, hair_split="diagonal").status_code == 422
    assert save(ana, beard="beard").status_code == 422


def test_sin_las_opciones_nuevas_queda_de_un_color(admin):
    ana = member(admin)
    character = save(ana).json()["character"]
    assert character["hair_color2"] == "none" and character["hair_split"] == "vertical" and character["eyeliner"] is False
