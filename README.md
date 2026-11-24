# Rotta · Gestor de clubs

La app para gestionar un club de voley: plantillas, entrenamientos con "Voy / No voy", partidos, ranking semanal con premios, coins y tienda, chat por equipos y pizarra táctica en 2D y 3D.

Nació como la app del C.V. TNT Almería. Rotta es la versión general, pensada para cualquier club. La app del TNT sigue aparte y no se toca desde aquí.

## Arrancar en local

```bash
npm install
pip install -r backend/requirements-dev.txt
```

- **Demo con un club inventado** (no necesita base de datos ni claves): `npm run demo` y abrir http://localhost:5180/app. Guion en [demo/README.md](demo/README.md).
- **Desarrollo normal:** `npm run dev`, con el backend (`uvicorn server:app --app-dir backend --port 8000`) y un `backend/.env` con su propia base de datos. **Nunca** la del TNT.
- **Tests:** `cd backend && python -m pytest -q`.

## Copias de seguridad

GitHub Actions hace cada día (03:30 UTC) una copia cifrada de todas las bases de Atlas, es decir, de todos los clubs (`.github/workflows/backup-db.yml`). Cada copia se guarda 30 días: pestaña **Actions** → «Copia de seguridad de la base de datos» → una ejecución → **Artifacts**. También se puede lanzar a mano con **Run workflow**.

Es aparte de la descarga que tiene cada administrador en la app (`backend/backup.py`): esa es un JSON de su club, sin contraseñas y sin forma automática de restaurarlo. La de GitHub es la copia completa con la que se puede devolver todo a como estaba.

Necesita dos secretos en GitHub (Settings → Secrets and variables → Actions):
- `BACKUP_MONGO_URI`: la conexión de Atlas. Mejor con un usuario de base de datos que solo pueda leer (rol *readAnyDatabase*).
- `BACKUP_PASSPHRASE`: una frase larga para cifrar las copias. **Guárdala también fuera de GitHub** (gestor de contraseñas): sin ella las copias no se pueden abrir.

Atlas tiene que dejar entrar conexiones de GitHub: en Network Access, `0.0.0.0/0` (es lo mismo que ya necesita Render).

**Restaurar una copia** (hacen falta `mongorestore`, de las MongoDB Database Tools, y `openssl`):

```bash
# 1. Descomprimir el .zip descargado de Artifacts: dentro está rotta-AAAA-MM-DD-HHMM.archive.gz.enc
# 2. Primero en una base de pruebas, para ver que está bien:
RESTORE_URI="mongodb+srv://..." BACKUP_PASSPHRASE="..." \
  tools/restore-db.sh rotta-AAAA-MM-DD-HHMM.archive.gz.enc --nsInclude='rotta.*' --nsFrom='rotta.*' --nsTo='rotta_prueba.*'
# 3. Para volver la base real a como estaba en la copia (borra lo que se hizo después):
RESTORE_URI="mongodb+srv://..." BACKUP_PASSPHRASE="..." \
  tools/restore-db.sh rotta-AAAA-MM-DD-HHMM.archive.gz.enc --drop
```

Una copia a mano desde el ordenador: `MONGO_URI=... BACKUP_PASSPHRASE=... tools/backup-db.sh` (la deja en `backups/`, que no se sube a git).

## Plan

### 1. Imprescindible antes de que entre un club
- [x] Varios clubs, fase 1: cada club con su propia base de datos (`backend/clubs.py`). Alta de clubs: `python tools/crear-club.py tnt "C.V. TNT Almería"`. El club sale de la cabecera `X-Club`, de `?club=` o del subdominio (`ROOT_DOMAIN` / `VITE_ROOT_DOMAIN`); sin club, `DEFAULT_CLUB` o `DB_NAME`.
- [x] Varios clubs, fase 2: equipos, horarios y grupos del ranking de cada club (`backend/teams.py`). Verlos o cambiarlos: `python tools/estructura-club.py tnt` / `python tools/estructura-club.py tnt equipos.json` (ejemplo en `tools/estructura-ejemplo.json`).
- [ ] Varios clubs, fase 3: nombre y escudo de cada club en toda la app.
- [ ] Varios clubs, fase 4: pantalla para dar de alta clubs.
- [ ] Política de privacidad y aviso legal.
- [ ] Borrar la cuenta y los datos desde la app.
- [ ] Permiso de madre, padre o tutor para menores, y consentimiento para las fotos.

### 2. Módulos que cada club activa o desactiva
- [ ] Panel de ajustes del club con interruptores por módulo (ranking y coins, tienda, pizarra, convocatorias, cuotas…).
- [ ] Convocatorias de partido: el entrenador elige quién va y se les avisa.
- [ ] Estadísticas de asistencia por jugador.
- [ ] Lesiones y "no disponible".
- [ ] Cuotas: quién ha pagado.

### 3. Para que los clubs entren fácil
- [ ] Unirse con un enlace o un QR por equipo.
- [ ] Llevar partidos y eventos al calendario del móvil.
- [ ] Web de presentación de Rotta.

### Más adelante
- [ ] Logo definitivo e iconos PNG para el móvil (ahora se usa `public/rotta-logo.svg`).
- [ ] Pizarra: aviso al publicar una jugada y comprobar solapamientos en las rotaciones.
- [ ] Estadísticas de la temporada por jugador.
- [ ] Registrar la marca "Rotta" en la OEPM (clases 9 y 42).
