"""La web servida desde el backend (contenedor de Render): los enlaces a pantallas de la app se abren directos."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from spa import SinglePageApp

INDEX = "<!doctype html><div id=root></div>"


@pytest.fixture
def client(tmp_path):
    (tmp_path / "index.html").write_text(INDEX, encoding="utf-8")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")
    app = FastAPI()

    @app.get("/api/")
    def api_root():
        return {"ok": True}

    app.mount("/", SinglePageApp(tmp_path), name="frontend")
    return TestClient(app)


@pytest.mark.parametrize("path", ["/", "/app", "/app/", "/app/ranking", "/app/plantillas/pizarra/123", "/app?google"])
def test_las_pantallas_de_la_app_se_abren_directas(client, path):
    response = client.get(path)
    assert response.status_code == 200
    assert response.text == INDEX


def test_la_app_no_se_queda_guardada_al_publicar_otra_version(client):
    assert client.get("/app/ranking").headers["cache-control"] == "no-cache"


def test_los_archivos_que_existen_se_sirven_tal_cual(client):
    response = client.get("/assets/app.js")
    assert response.status_code == 200
    assert response.text == "console.log(1)"


@pytest.mark.parametrize("path", ["/assets/no-existe.js", "/logo-nuevo.png", "/api/no-existe", "/api"])
def test_lo_que_no_existe_sigue_dando_404(client, path):
    assert client.get(path).status_code == 404


def test_la_api_va_antes_que_la_web(client):
    assert client.get("/api/").json() == {"ok": True}
