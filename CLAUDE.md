# Contexto para Claude

Rotta es la versión general de la app del C.V. TNT Almería, para venderla a otros clubs de voley. El usuario (Marcos) habla en español y quiere las explicaciones sencillas.

## Decisiones
- La app del TNT (repo `proyecto-voley-tnt`, rama `app-privada`) se queda en mantenimiento: solo cambios que pida David o arreglos. Lo nuevo va a Rotta. Un arreglo de un fallo que existe en las dos apps se hace en ambas.
- Más adelante el TNT podría pasar a ser un club más dentro de Rotta.
- Commit y push solo cuando el usuario lo pide. Nunca subir `backend/.env` ni dejarlo en un ordenador compartido.

## Hecho
- Sin nada del TNT: nombre, logo provisional `public/rotta-logo.svg`, donde ponía TNT pone Club.
- Temas: cada club elige sus dos colores (Perfil > Apariencia, solo administradores; `backend/club_settings.py`, `src/app/useTheme.js`, `src/app/theme.js`). Cada persona elige claro, oscuro o automático. Colores con significado fijos (calendario rojo, Voy verde, coins dorado, podio oro/plata/bronce). Pista, pizarra y partido en directo siempre en oscuro (`.force-dark`). Las clases de Tailwind van por variables CSS (`src/theme-palette.css`, generado con `tools/generar-colores-tema.mjs`).
- Privacidad: política en `/app/privacidad`, permisos al entrar (menores de 14 con tutor, fotos aparte) y borrar la cuenta (`backend/privacy.py`).
- Identidad propia (rama `rediseno-identidad`): logo de las seis zonas en rotación (`public/rotta-logo.svg`, `RotationMark.jsx`), títulos en Bricolage Grotesque y texto en Instrument Sans, sin mayúsculas ni cursiva. Cabeceras con `RankingHero` (título a la izquierda), tarjetas `rounded-3xl bg-panel ring-1 ring-white/10`, botones en forma de pastilla, sin degradados de marca. Inicio: pista y balón de fondo en la cabecera, hora en grande, Voy/No voy grandes, quién va con caras y partidos cara a cara. Avatares sin foto con un color por persona.
- Personajes estilo videojuego (`src/app/character/character3D.js`): cabeza más grande (`HEAD_GROW`), ojos grandes con dos brillos (`EYE_GROW`, `EYE_GAP`), brazos y piernas con músculo (`muscle`), brillo de contorno dentro del material (`withRim`, sin mallas extra), parpadeo, cara contenta al celebrar y respiración en reposo (en `posePlayer`). En el Perfil, luz más suave y contraluz con el color del club (`AvatarStage.jsx`).
- Animaciones: recepción en tres tiempos (`receptionLoad`, `reception`, `receptionFollow`), colocación con final de brazos estirados (`setFollow`) y bloqueo pasando las manos por encima de la red (`blockReach`; también en `gesture-times.json`, con su salto de 1,08). Celebraciones nuevas: baile, avión y salto con giro (en `looks.js`, `gestureTimes.js` y el `Literal` de `backend/characters.py`). Peso: brazos con inercia (`overshoot`, no en remate ni saque, que tienen posturas propias del editor) y estirarse/aplastarse al saltar y caer. Espera viva en `posePoints` (peso, rebote y saltito de espera con ritmo propio de cada uno). Pelo con muelle (`hanging` en `addHair` y `swingHair`).
- Demo con un club inventado: `npm run demo` (puertos 5180 y 8100), guion en `demo/README.md`.
- Varios clubs, fase 1: una base de datos por club (`backend/clubs.py`). El club sale de la cabecera `X-Club`, de `?club=` o del subdominio (`ROOT_DOMAIN`); sin club, `DEFAULT_CLUB` o `DB_NAME`. Alta: `python tools/crear-club.py codigo "Nombre"`. Tests en `backend/tests/test_clubs.py`.

- Traído del TNT (13-11-2026): pizarra con entrenadores (Free/Fuerte), conos, cajones y arrastrar en 3D; filas con el botón «Fila» y su condición: «con cualquier toque» (vuelven solas al final tras su último toque) o «al rematar (japo)» (solo el que remata se cambia por el último de la fila), «Balón nuevo» y «Repetir hasta que pasen todos». Partido en directo: botón «Empezar partido», media pista con 6 titulares y banquillo, arrastrar para cambiar, guía ⓘ, +50 Club Coins por ganar e informe completo al terminar (`src/app/components/MatchReport.jsx`, `match_report` en `backend/live.py`).

## Siguiente: varios clubs, fase 2 (sin empezar)
Equipos, horarios y grupos del ranking configurables por club. Ahora están escritos para el TNT en `backend/teams.py`, los `GROUPS` de `backend/ranking.py`, los `DEFAULT_SCHEDULES` de `backend/schedules.py`, `src/app/teams.js` y `data/groups.js`.
Diseño previsto:
- Guardar la estructura en `club_settings` de la base de cada club; si no hay, valen los equipos del TNT (así los tests y la demo siguen igual).
- `get_db` carga la estructura y la deja en una `ContextVar`. `TeamId`, `GroupId` y `ChannelId` pasan de `Literal` a `str` con un validador que la comprueba (FastAPI resuelve las dependencias antes de validar el cuerpo).
- `TEAMS`, `TEAM_WEEKDAYS`, `match_teams`, `GROUPS`, `DEFAULT_SCHEDULES` y los `TEAM_NAMES` de `live.py` y `help_requests.py` pasan a ser funciones.
- Web: un endpoint con la estructura del club; `src/app/teams.js` la carga al arrancar.
Después: fase 3 (nombre y escudo de cada club en la app) y fase 4 (pantalla para dar de alta clubs).

## Probar
- Tests: `cd backend && python -m pytest -q` (576 pasan). Web: `npm run build`.
- Coste: MongoDB Atlas gratis aguanta unos 15-18 clubs (límite de colecciones) y 512 MB; las fotos del chat son lo que más ocupa.
