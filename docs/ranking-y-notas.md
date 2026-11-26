# Ranking y Notas: rediseño por bloques

Trabajo en la rama `claude/amazing-euler-emy9p1`, un commit por bloque, encima de las fases visuales anteriores
(Entrada y primera experiencia, hasta `39d959b`). Sin tocar `main`, el TNT ni el servidor publicado.

> Historia: el bloque 0 se hizo primero, por error, en `claude/happy-bardeen-3k4k0w` (commit `90f3bf4`, que partía de
> `d2c1b9e`, sin las fases visuales). Se ha traído aquí y se ha rehecho entero con la versión actual.

## Decisiones (26-11-2026)

1. **Privacidad de las notas**: en esta fase no se cambian los permisos del servidor. La discrepancia de abajo se trata
   aparte, antes de vender Rotta.
2. **Terminología**: «Overall» pasa a «Nota global» en toda la sección.
3. **Colores de las notas**: dorado solo para 85 o más. El resto en tonos neutros y legibles, sin colores de estado
   ni del club.
4. **Tu ficha**: acceso rápido arriba del Ranking y, además, la ficha al final como ahora.
5. **Equipo por defecto**: se arregla sin `team_id.startsWith("escuela")`, con una lógica que sirva para cualquier club.

Reglas de trabajo: separar cambios visuales, funcionales y de servidor; no cambiar permisos ni reglas del backend sin
consultarlo; antes de cada bloque, rama, commit y archivos; después, pruebas, compilación, temas y capturas en móvil,
tableta y escritorio.

## Bloque 0: cómo funciona hoy

Punto de partida: `39d959b` («Entrada, bloque 10: revisión final») en `claude/amazing-euler-emy9p1`.

### Pruebas

| Comprobación | Resultado |
| --- | --- |
| Servidor: `cd backend && python -m pytest -q` | **637 pasan** (49 en `tests/test_ranking.py`) |
| Web: `npm test` (vitest) | **157 pasan** en 18 archivos |
| Web: `npm run build` | Compila sin errores |
| Temas: `npm run comprobar-temas` | Todo cumple (lima, naranja y tinta; claro y oscuro; 2.904.210 contrastes) |
| Demo (`npm run demo`) | Sin errores de consola propios (solo los 401 de antes de entrar, normales) |

Capturas en la demo de esta rama: Ranking de la semana y del mes, ficha de otra jugadora (como Jugadora) y hoja de
Notas (como Entrenador), en móvil (390), tableta (820) y escritorio (1440), en claro y oscuro (30 en total). Se ve
que son de la versión actual: los grupos ya usan `ChipGroup` (tono suave del club con borde), las posiciones llevan
punto de color y la marca de Rotta va en su color propio.

### Qué hace cada pantalla

- **Ranking** (`src/app/pages/RankingPage.jsx`): cabecera (`RankingHero`) con Premios y, si puede puntuar, Notas;
  grupos (`GroupPicker`), Semana / Mejor del mes (`PeriodPicker`), premios vigentes (`HonorsBanner`), filtro por
  posición (`PositionFilter`), podio de 3, el resto en filas, «Aún sin puesto» y al final **Tu ficha** (solo si el
  usuario tiene jugador en ese grupo y hay semana publicada).
- **Ficha de un jugador** (diálogo `PlayerDialog` al tocar a alguien): personaje 3D, nota de la última semana, radar,
  barras por habilidad y evolución. El comentario solo sale si es suyo o lo ve un entrenador o administrador.
- **Notas** (`src/app/pages/RatingSheetPage.jsx` + `components/RatingDialog.jsx`): hoja del entrenador por semana,
  borradores y publicar.
- **Visuales compartidos** (`components/RankingVisuals.jsx`, `components/PlayerRatingHistory.jsx`).
- **Servidor** (`backend/ranking.py`, no se toca): `GET /ranking`, `/ranking/groups`, `/ranking/honors`,
  `/ranking/players/{id}`, `/ranking/sheet`, `PUT /ranking/ratings`, `POST /ranking/publish`, `POST /ranking/award`,
  `GET /players/{id}/profile`.

### Lo que ya trajeron las fases visuales

- `RankingHero` y `CardTitle` usan los colores del tema (`text-ink`, `text-ink-muted`, `bg-club-soft`, `text-club-ui`).
- `GroupPicker` usa `ChipGroup` de `src/app/ui`.
- `PositionTag` usa `POSITION_TONES` (color propio por posición, con punto, legible en claro y oscuro).
- Los errores usan `Notice`.

### Lo que falta y toca a los siguientes bloques

**Terminología**
- «Overall» visible en `PlayerRatingHistory.jsx:30` y `RatingDialog.jsx:26`; para lectores de pantalla en
  `RankingVisuals.jsx` (`OverallNumber`) y en el podio de `RankingPage.jsx`. Los nombres internos (`formatOverall`,
  `overall`) no se ven y pueden quedarse.

**Colores de las notas** (`overallTone` en `RankingVisuals.jsx`, sin cambios desde el TNT)
- 85+ `text-amber-300`, 70-84 `text-ember` (el segundo color del club: cian en oscuro, verde petróleo en claro),
  50-69 `text-white`, menos de 50 `text-zinc-400`. Hay que dejar dorado solo para 85+ y el resto neutro.
- En claro, el dorado de 85+ sale marrón anaranjado (93 de «Tu ficha»).
- El radar y la evolución (`SkillRadar`, `EvolutionChart`) tienen naranjas fijos del TNT (`#FF3800`, `#FF8800`) y
  blanco fijo (`#fff`).
- Los pedestales del podio (oro, plata, bronce) están bien: son colores con significado fijo.

**Modo claro**
- Etiquetas del radar (Saque, Recep., …) casi invisibles, en «Tu ficha» y en la ficha de otro.
- En la evolución **no salen los números** de cada semana: están en blanco fijo (`fill="#fff"`) sobre fondo claro.

**Escritorio y tableta**
- La gráfica de evolución se estira con el ancho: en escritorio las fechas y números salen enormes.
- La hoja de Notas en escritorio es una columna estrecha con mucho hueco.

**Coherencia con `src/app/ui`**
- `PeriodPicker` y `PositionFilter` siguen con su propio estilo (relleno sólido del club), distinto de `ChipGroup` de
  los grupos que están justo encima. `src/app/ui` ya tiene `Tabs`, `ChipGroup`, `Dialog`, `Card`, `Button`, `Badge`.
- `PlayerDialog` usa su propio `<dialog>` y botón «Cerrar», no `Dialog` de `src/app/ui`. Lo mismo `RatingDialog`.
- Los botones «Premios» (ámbar) y «Notas»/«Ranking» (blanco) están hechos a mano, no con `Button`/`LinkButton`.

**Tu ficha**
- Solo está al final, después de toda la clasificación: en móvil hay que bajar mucho.
- En «Mejor del mes» la ficha enseña la nota de la última semana (93) mientras arriba sale su media del mes (89):
  puede confundir si no se dice qué es cada número.

**Equipo por defecto** (funcional, solo web)
- `RankingPage.jsx:236` y `RewardsPage.jsx:175` hacen
  `user.team_id?.startsWith("escuela") ? "escuela" : user.team_id`. Solo acierta si el grupo se llama igual que el
  equipo o es la Escuela del TNT. Con otra estructura (p. ej. grupo `infantil` con equipos `inf-a` e `inf-b`) un
  jugador de `inf-b` cae en el primer grupo de la lista. La web ya sabe qué equipos tiene cada grupo
  (`GET /api/club/structure`, `src/app/teams.js`), así que se arregla sin tocar el servidor.
- Relacionado, fuera de esta sección: `PlayerProfileDialog.jsx:12` y `RewardsPage.jsx` eligen el muñeco de chica con
  `team_id === "femenino"` (es el «pendiente pequeño» de la fase 2 en `CLAUDE.md`).

## Pendiente aparte: discrepancia de privacidad (no se toca en esta fase)

La política (`src/app/pages/PrivacyPage.jsx:98-99`) dice:

> Tus compañeros ven tu nombre, foto, posición, si vas a entrenar y tu **nota media** del ranking.
> Los comentarios de las notas solo los ves tú, tus entrenadores y los administradores del club.

Lo que hace hoy el servidor (`backend/ranking.py`):

- `GET /api/ranking/players/{id}` deja a **cualquier miembro del club que no sea familia** ver las notas publicadas
  **de cada habilidad** de cualquier jugador (últimas semanas, con radar y evolución), no solo la nota media. Lo
  comprueba el test `test_el_jugador_ve_las_notas_de_otros_sin_el_comentario`.
- También se ven los rankings de **todos los equipos**, no solo el propio (`_can_view`, test
  `test_todos_ven_el_ranking_de_todos_los_equipos`).
- El comentario sí queda oculto a los demás, como dice la política.

Hay que decidir antes de comercializar: o se cambia la política para decir lo que de verdad se ve, o se limita el
servidor (por ejemplo, el detalle por habilidad solo para el propio jugador y sus entrenadores, y que cada club elija
si se ven otros equipos). Lo más delicado: el detalle de notas de un menor visible para todo el club.
Mientras tanto, el rediseño no debe enseñar más de lo que ya se enseña hoy.
