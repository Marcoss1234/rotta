from test_auth import client_for, db  # noqa: F401


def test_sin_ajustes_sale_el_tema_de_rotta(db):  # noqa: F811
    response = client_for().get("/api/club/theme")
    assert response.status_code == 200
    assert response.json() == {"brand": "#7C3AED", "accent": "#22D3EE", "mode": "dark"}


def test_el_administrador_cambia_los_colores_y_los_ve_todo_el_mundo(db):  # noqa: F811
    admin = client_for("token-admin")
    response = admin.put("/api/club/theme", json={"brand": "#1d4ed8", "accent": "#f59e0b", "mode": "light"})
    assert response.status_code == 200, response.text
    assert client_for().get("/api/club/theme").json() == {"brand": "#1D4ED8", "accent": "#F59E0B", "mode": "light"}


def test_solo_el_administrador_cambia_los_colores(db):  # noqa: F811
    body = {"brand": "#1D4ED8", "accent": "#F59E0B", "mode": "light"}
    assert client_for().put("/api/club/theme", json=body).status_code == 401
    assert client_for("token-ana").put("/api/club/theme", json=body).status_code == 403


def test_colores_mal_escritos_no_valen(db):  # noqa: F811
    admin = client_for("token-admin")
    assert admin.put("/api/club/theme", json={"brand": "azul", "accent": "#F59E0B", "mode": "light"}).status_code == 422
    assert admin.put("/api/club/theme", json={"brand": "#1D4ED8", "accent": "#F59E0B", "mode": "gris"}).status_code == 422
