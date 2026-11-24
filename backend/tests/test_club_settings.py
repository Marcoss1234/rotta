import asyncio
import re
from pathlib import Path
from typing import get_args

import pytest
from club_settings import DEFAULT_STYLE, ThemeStyle
from test_auth import client_for, db  # noqa: F401


def test_sin_ajustes_sale_el_tema_de_rotta(db):  # noqa: F811
    response = client_for().get("/api/club/theme")
    assert response.status_code == 200
    assert response.json() == {"brand": "#7C3AED", "accent": "#22D3EE", "mode": "dark", "style": "tinta"}


def test_el_administrador_cambia_los_colores_y_los_ve_todo_el_mundo(db):  # noqa: F811
    admin = client_for("token-admin")
    response = admin.put("/api/club/theme", json={"brand": "#1d4ed8", "accent": "#f59e0b", "mode": "light"})
    assert response.status_code == 200, response.text
    assert client_for().get("/api/club/theme").json() == {"brand": "#1D4ED8", "accent": "#F59E0B", "mode": "light", "style": "tinta"}


def test_solo_el_administrador_cambia_los_colores(db):  # noqa: F811
    body = {"brand": "#1D4ED8", "accent": "#F59E0B", "mode": "light"}
    assert client_for().put("/api/club/theme", json=body).status_code == 401
    assert client_for("token-ana").put("/api/club/theme", json=body).status_code == 403


def test_colores_mal_escritos_no_valen(db):  # noqa: F811
    admin = client_for("token-admin")
    assert admin.put("/api/club/theme", json={"brand": "azul", "accent": "#F59E0B", "mode": "light"}).status_code == 422
    assert admin.put("/api/club/theme", json={"brand": "#1D4ED8", "accent": "#F59E0B", "mode": "gris"}).status_code == 422


# ---------- Temas de Rotta (Lima, Naranja y Tinta) ----------


def test_el_administrador_elige_el_tema_y_lo_ve_todo_el_mundo(db):  # noqa: F811
    admin = client_for("token-admin")
    for style in ("lima", "naranja", "tinta"):
        body = {"brand": "#9F1239", "accent": "#D4A017", "mode": "dark", "style": style}
        response = admin.put("/api/club/theme", json=body)
        assert response.status_code == 200, response.text
        assert response.json() == body
        assert client_for().get("/api/club/theme").json()["style"] == style


def test_un_tema_que_no_existe_no_vale(db):  # noqa: F811
    admin = client_for("token-admin")
    body = {"brand": "#1D4ED8", "accent": "#F59E0B", "mode": "light"}
    for style in ("verde", "LIMA", ""):
        assert admin.put("/api/club/theme", json={**body, "style": style}).status_code == 422


def test_guardar_colores_sin_tema_no_cambia_el_tema(db):  # noqa: F811
    """Una app que todavía no conoce los temas solo manda los colores: el tema elegido se queda."""
    admin = client_for("token-admin")
    admin.put("/api/club/theme", json={"brand": "#1D4ED8", "accent": "#F59E0B", "mode": "light", "style": "naranja"})
    response = admin.put("/api/club/theme", json={"brand": "#15803D", "accent": "#EAB308", "mode": "dark"})
    assert response.status_code == 200, response.text
    assert response.json() == {"brand": "#15803D", "accent": "#EAB308", "mode": "dark", "style": "naranja"}


def test_un_club_con_colores_de_antes_sale_en_tinta(db):  # noqa: F811
    """Clubs que guardaron sus colores antes de que hubiera temas: sin migrar nada, salen en Tinta."""
    asyncio.run(db.club_settings.insert_one({"id": "club", "theme": {"brand": "#E11D2E", "accent": "#F5C542", "mode": "dark"}}))
    assert client_for().get("/api/club/theme").json() == {"brand": "#E11D2E", "accent": "#F5C542", "mode": "dark", "style": "tinta"}


def test_un_tema_guardado_que_ya_no_existe_vuelve_a_tinta(db):  # noqa: F811
    asyncio.run(db.club_settings.insert_one({"id": "club", "theme": {"brand": "#E11D2E", "accent": "#F5C542", "mode": "dark", "style": "antiguo"}}))
    assert client_for().get("/api/club/theme").json()["style"] == "tinta"


def test_solo_el_administrador_cambia_el_tema(db):  # noqa: F811
    body = {"brand": "#1D4ED8", "accent": "#F59E0B", "mode": "light", "style": "lima"}
    assert client_for().put("/api/club/theme", json=body).status_code == 401
    assert client_for("token-ana").put("/api/club/theme", json=body).status_code == 403
    assert client_for().get("/api/club/theme").json()["style"] == "tinta"


THEMES_JS = Path(__file__).resolve().parents[2] / "src" / "app" / "themes.js"


@pytest.mark.skipif(not THEMES_JS.exists(), reason="Sin la web al lado (por ejemplo, dentro de la imagen del servidor)")
def test_la_web_y_el_servidor_tienen_los_mismos_temas():
    """Si se añade o quita un tema en un lado y no en el otro, este test lo dice."""
    source = THEMES_JS.read_text(encoding="utf-8")
    block = source.split("export const THEMES = {", 1)[1].split("\n};", 1)[0]
    web_styles = re.findall(r"^  ([a-z]+): \{", block, flags=re.MULTILINE)
    web_default = re.search(r'^export const DEFAULT_STYLE = "([^"]+)"', source, flags=re.MULTILINE).group(1)
    assert sorted(web_styles) == sorted(get_args(ThemeStyle))
    assert web_default == DEFAULT_STYLE
