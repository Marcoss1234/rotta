"""La web (React) servida desde el propio backend, como en el contenedor de Render.

/app, /app/ranking, /app/privacidad... no son archivos: son pantallas de la app, y las abre React.
Si alguien entra directamente por uno de esos enlaces (el que se pasa por WhatsApp), se le da
index.html y React pinta la pantalla que toca. Lo que sí sigue dando 404:
- lo de /api (una ruta de la API que no existe no debe devolver una página),
- un archivo que no existe (un .js o una imagen), para no devolver HTML donde se espera otra cosa.
"""
from pathlib import PurePosixPath

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles


class SinglePageApp(StaticFiles):
    def __init__(self, directory):
        super().__init__(directory=directory, html=True)

    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code != 404 or not _is_app_screen(path):
                raise
            # Sin caché: así, al publicar una versión nueva, el móvil coge la app nueva.
            response = await super().get_response("index.html", scope)
            response.headers["Cache-Control"] = "no-cache"
            return response


def _is_app_screen(path):
    # Starlette da la ruta con el separador del sistema (\ en Windows, / en Linux).
    clean = PurePosixPath(path.replace("\\", "/").strip("/"))
    if clean.parts[:1] == ("api",):
        return False
    return not clean.suffix
