# Ranking y Notas: rediseño por bloques

Trabajo en la rama `claude/happy-bardeen-3k4k0w`, un commit por bloque. Sin tocar `main`, el TNT ni el servidor publicado.

## Decisiones (26-11-2026)

1. **Privacidad de las notas**: en esta fase no se cambian los permisos del servidor. La discrepancia de abajo se trata aparte, antes de vender Rotta.
2. **Terminología**: «Overall» pasa a «Nota global» en toda la sección.
3. **Colores de las notas**: dorado solo para 85 o más. El resto en tonos neutros y legibles, sin colores de estado ni del club.
4. **Tu ficha**: acceso rápido arriba del Ranking y, además, la ficha al final como ahora.
5. **Equipo por defecto**: se arregla sin `team_id.startsWith("escuela")`, con una lógica que sirva para cualquier club.

## Bloque 0: cómo funciona hoy

Punto de partida: commit `d2c1b9e`.

### Pruebas

- Servidor: `cd backend && python -m pytest -q` → **630 pasan** (49 de ellas en `tests/test_ranking.py`).
- Web: `npm run build` → compila sin errores.
- Demo (`npm run demo`): capturas de Ranking (semana y mes), ficha de otra jugadora y hoja de Notas del entrenador, en móvil (390), tableta (820) y escritorio (1440), en claro y oscuro. Sin errores de consola propios (solo los 401 de antes de entrar, normales).

### Qué hace cada pantalla

- **Ranking** (`src/app/pages/RankingPage.jsx`): cabecera con Premios (y Notas si puede puntuar), grupos, Semana / Mejor del mes, premios vigentes (`HonorsBanner`), filtro por posición, podio de 3, resto en filas, «Aún sin puesto» y al final **Tu ficha** (solo si el usuario tiene jugador en ese grupo y hay semana publicada).
- **Ficha de un jugador** (diálogo al tocar a alguien): personaje 3D, nota de la última semana, radar, barras por habilidad, evolución. El comentario solo sale si es suyo o lo ve un entrenador/administrador.
- **Notas** (`src/app/pages/RatingSheetPage.jsx` + `RatingDialog.jsx`): hoja del entrenador por semana, borradores y publicar.
- **Servidor** (`backend/ranking.py`): `GET /ranking`, `/ranking/groups`, `/ranking/honors`, `/ranking/players/{id}`, `/ranking/sheet`, `PUT /ranking/ratings`, `POST /ranking/publish`, `POST /ranking/award`, `GET /players/{id}/profile`.

### Lo que se ha visto y toca a los siguientes bloques

- **«Overall»** aparece como texto en `PlayerRatingHistory.jsx:30`, `RatingDialog.jsx:25` y como texto para lectores de pantalla en `RankingVisuals.jsx:84` y en el podio de `RankingPage.jsx`. La función y variables internas (`formatOverall`, `overall`) se pueden quedar con su nombre: no se ven.
- **Colores de las notas** (`overallTone` en `RankingVisuals.jsx`): 85+ `amber-300`, 70-84 `text-ember` (el segundo color del club: en la demo sale cian), 50-69 blanco, menos de 50 gris. En **modo claro** el dorado sale marrón anaranjado y el 70-84 depende del club. El radar y la gráfica de evolución usan naranjas fijos (`#FF3800`, `#FF8800`) que vienen del TNT.
- **Modo claro**: en «Tu ficha» y en la ficha de otro, las etiquetas del radar (Saque, Recep., …) y las fechas y números de la evolución casi no se leen.
- **Escritorio**: el Ranking ocupa una columna estrecha; sobra mucho espacio a los lados.
- **Tu ficha** solo está al final, después de toda la clasificación: en móvil hay que bajar bastante.
- **Equipo por defecto**: `RankingPage.jsx:235` y `RewardsPage.jsx:174` hacen `user.team_id?.startsWith("escuela") ? "escuela" : user.team_id`. Solo funciona si el grupo se llama igual que el equipo o es la Escuela del TNT. Con otra estructura (p. ej. grupo `infantil` con equipos `inf-a` e `inf-b`) un jugador de `inf-b` cae en el primer grupo de la lista, no en el suyo. La web ya tiene los grupos con sus equipos (`GET /api/club/structure`, `src/app/teams.js`), así que se puede arreglar solo en la web.

### Discrepancia de privacidad (pendiente, no se toca en esta fase)

La política (`src/app/pages/PrivacyPage.jsx:71-72`) dice:

> Tus compañeros ven tu nombre, foto, posición, si vas a entrenar y tu **nota media** del ranking.
> Los comentarios de las notas solo los ves tú, tus entrenadores y los administradores del club.

Lo que hace hoy el servidor:

- `GET /api/ranking/players/{id}` deja a **cualquier miembro del club que no sea familia** ver las notas publicadas **de cada habilidad** de cualquier jugador (últimas semanas, con radar y evolución), no solo la nota media. Lo comprueba el test `test_el_jugador_ve_las_notas_de_otros_sin_el_comentario`.
- También se ven los rankings de **todos los equipos**, no solo el propio (`_can_view`, test `test_todos_ven_el_ranking_de_todos_los_equipos`).
- El comentario sí queda oculto a los demás, como dice la política.

Hay que decidir antes de comercializar: o se cambia la política para decir lo que de verdad se ve, o se limita el servidor (por ejemplo, el detalle por habilidad solo para el propio jugador y sus entrenadores, y cada club elige si se ven otros equipos). Ojo con menores: el detalle de notas de un menor visible para todo el club es lo más delicado.
