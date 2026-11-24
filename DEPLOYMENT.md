# Despliegue con Docker

La app usa MongoDB para guardar cuentas, chat, imágenes y el resto de datos. MongoDB queda solo en la red privada de Docker; su base se persiste en `data/mongo/`. El archivo `data/groups.js` sigue siendo parte del código de la web y no se modifica.

## Preparar el VPS

1. Instala Docker Engine y el complemento Docker Compose.
2. Copia `.env.example` a `.env` y cambia los cuatro valores `MONGO_*` por credenciales seguras. En el VPS puedes generar contraseñas URL-safe con `openssl rand -hex 32`; usa valores distintos para la cuenta raíz y la cuenta de la app. No compartas ni subas `.env`.
3. Configura `GOOGLE_CLIENT_ID` y `ADMIN_EMAILS` para habilitar el acceso y elegir los administradores iniciales. `DB_NAME` ya tiene un valor por defecto.
4. Inicia los servicios:

   ```sh
   docker compose up -d --build
   docker compose ps
   ```

El puerto web solo escucha en `127.0.0.1:8000`; la API y MongoDB no publican puertos en el VPS. `COOKIE_SECURE=true` presupone que el proxy ofrece HTTPS.

## Proxy inverso

Con Caddy instalado directamente en el VPS:

```caddyfile
rotta.example.com {
    reverse_proxy 127.0.0.1:8000
}
```

Para Nginx en el VPS, configura el `server_name` y TLS como de costumbre y usa `proxy_pass http://127.0.0.1:8000;` para el sitio. El contenedor web sirve la SPA y reenvía `/api/` al backend.

Si Caddy o Nginx está en otro contenedor, `127.0.0.1` apunta a ese contenedor, no a Rotta: conecta el proxy a la red Docker `rotta_app` y apunta al servicio `web:8080`, o ajusta el enlace de puerto para que el proxy externo pueda alcanzarlo.

Para servir clubs por subdominio, configura `ROOT_DOMAIN` en `.env` (por ejemplo, `rotta.example.com`). Se utiliza tanto en el backend como al compilar la web; después de cambiarlo, reconstruye con `docker compose up -d --build`.

## Datos y mantenimiento

La carpeta `data/mongo/` sobrevive a reinicios y recreaciones normales de los contenedores. No la borres ni la uses como sustituto de copias de seguridad; guarda backups fuera del VPS. Los ficheros de inicialización de MongoDB se aplican solo al crear por primera vez la base vacía, así que cambiar las credenciales en `.env` no cambia usuarios ya creados.

Ver logs:

```sh
docker compose logs -f api web mongo
```
