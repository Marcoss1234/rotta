# Rediseño Premium deportivo: documento maestro

Rama: `claude/amazing-euler-emy9p1` (sin tocar `main`, TNT ni el servidor; sin merge ni despliegue).
El plan completo (14 fases y el principio de diseño compacto) lo dio Marcos el 26-11-2026: ejecutar las
fases en orden, en bloques pequeños, cada uno con pruebas, compilación, `npm run comprobar-temas`, capturas
cuando haya cambios visibles, commit propio y push a esta rama. Sin cambios de lógica, permisos, privacidad,
puntuaciones, coins ni asistencia; los problemas de backend se apuntan aquí y se dejan para otra fase.

## Hecho

| Commit | Qué |
| --- | --- |
| `e1e4e8b` | Base 0·a: tokens fijos y personalidad de Lima, Naranja y Tinta (`themes.js`, `themes.test.js`) |
| `2821373` | Base 0·b: escenario (resplandores ajustados al club) y comprobaciones con colores extremos |
| `9a2c656` | Base 1·a: Button, Card, Tabs, ChipGroup, Field, Notice con la personalidad de cada identidad |
| `81c437a` | Marco: barra superior móvil, navegación inferior por identidad, barra lateral agrupada, `ui/PageHeader` |
| `786ea42` | Inicio 2·a: `ui/Stage`, `ui/StatTile`, `GoingCourt` propio de Rotta (sin el dibujo del TNT) |
| `600aa28` | Inicio 2·b: composición nueva (saludo y coins, escenario del entreno con la pista, tus números, próximo partido, escritorio en dos columnas) |
| `f6d4a84` | Inicio 2·c: pestaña Partidos con el mismo lenguaje y ajustes |

| (este) | Inicio 3: sitio en una línea bajo la hora (entreno y partido), arena en la pista de playa; revisado con familia, entrenador sin ficha, playa, 360 px y tableta |
| (este) | Plantilla: lista en filas compactas dentro de un solo bloque (contacto en una línea), pista con suelo y líneas de la identidad (`CourtDrawing themed`), escritorio a todo el ancho con pista y lista lado a lado |
| `9770252` | Ranking y Premios: grupo por defecto desde la estructura del club (`ownGroupOf`), sin `startsWith("escuela")` (cambio funcional pequeño, aparte) |
| (este) | Ranking: pantalla fija en el móvil (cabecera, equipo, semana/mes, filtro y acceso a «Tu ficha» fijos; premios, podio compacto, clasificación en filas y tu ficha al final en una zona que se desliza por dentro); escritorio con tu ficha a la derecha; «Nota global» en lugar de «Overall»; nota dorada solo ≥85 y el resto neutra; gráficas con colores del tema y estilo de cada identidad; fichas en hoja desde abajo (`ui/Dialog placement="auto"`); `PageHeader` con los botones al lado del título |
| (este) | Notas: pantalla fija en el móvil (cabecera, equipo, semana con su estado Borrador/Publicada, cuántos llevas y «Publicar» fijos; la lista se desliza por dentro); filas compactas con la nota de cada habilidad en una línea, si hay comentario y «Puntuar» a los que faltan; filtro Todos / Sin nota / Con nota; confirmar la publicación en hoja; escritorio con la lista a la izquierda y el estado a la derecha. `RatingDialog` sobre `ui/Dialog` (hoja en el móvil): quién, cuántas habilidades lleva, posición y «Nota global» arriba fijos; cada habilidad con su peso («pesa 30%»), su nota en grande y un botón para dejarla sin nota; Guardar siempre a la vista. Barra y aro con el carácter de cada identidad (`rating-range`, `rating-ring` en index.css) |
| (este) | Eventos: pantalla fija en el móvil (cabecera con «Añadir» al lado y el mes fijos; calendario y agenda se deslizan por dentro); días más bajos; agenda en filas dentro de un solo bloque; escritorio a todo el ancho con el calendario a la izquierda y la agenda fija a la derecha; formulario de evento en hoja (`placement="auto"`) |
| (este) | Partidos jugados: pantalla fija en el móvil (cabecera con «Partidos» al lado, tipo de partido y resumen fijos; la lista se desliza por dentro); resultado y sets más compactos; MVP e informe en una misma franja; formulario de partido en hoja |
| (este) | Móvil compacto (pedido por Marcos): en el móvil todo un poco más pequeño en la misma proporción que en el ordenador (raíz de 15 px en `html.app-shell` por debajo de 768 px; letra mínima 12 px con `text-xs`; campos de texto en 16 px; relleno de tarjetas 16 px; títulos de pantalla 28 px en el móvil). Afecta a todas las pantallas a la vez |
| (este) | Plantilla en el móvil: pantalla fija; la cancha entera con sus medidas de verdad a la izquierda (tan alta como quepa, `CourtBoard fit`) y el banquillo a la derecha en una columna que se desliza hacia abajo; la lista completa de jugadores en hoja con el botón «Jugadores»; la explicación de la pista tras ⓘ. En móviles muy bajos (667 px) la tarjeta se desliza un poco para no montar las chapas. Tableta y escritorio, como estaban |
| (este) | Cabecera más pequeña en el móvil: título de pantalla de 24 px, subtítulo de 12 px, menos espacio debajo; pastillas de elegir (equipo, filtros) y pestañas Plantilla/Pizarra algo más bajas. En escritorio, igual que antes |
| `ce4f0fc` | Este documento maestro |
| `163d4b3` | Herramienta `tools/crear-admin.py` (cuenta de administrador con usuario y contraseña; fuera del rediseño) |

Pruebas al cerrar `f6d4a84`: web 228, servidor 637, temas sin fallos. Con `163d4b3`: servidor 643. Con Notas: web 231, servidor 643.

## Estado exacto (26-11-2026)

- Rama `claude/amazing-euler-emy9p1`, último commit del rediseño `f6d4a84`; último commit `163d4b3`. Todo subido,
  sin cambios pendientes.
- Hecho del plan: base visual (tokens, identidades, piezas comunes), marco (navegación) e Inicio.
- Sin empezar: el bloque 3 de Inicio y las fases 2 a 12 de abajo.
- La app publicada (Render, https://rotta-709u.onrender.com) sale de `main`: ahí no se ve el rediseño. Para verlo,
  Marcos puede cambiar en Render (Settings > Branch) la rama a `claude/amazing-euler-emy9p1`.
- Marcos entra como administrador con su cuenta `marcos098` (aprobada en Atlas a mano). Google no sale en la app
  publicada porque falta `GOOGLE_CLIENT_ID` en Render.
- Para retomar: «sigue el plan de `docs/rediseno-premium.md` en la rama `claude/amazing-euler-emy9p1`». Antes de
  las capturas hay que arrancar la demo (`npm run demo`; en esta sesión se paró sola por tiempo).

## Siguiente (por orden)

1. ~~Inicio, bloque 3~~ (hecho).
2. ~~Plantilla y fichas de jugadores~~ (hecho; la nota de la ficha y el suelo del 3D se ven en Ranking y componentes).
3. ~~Ranking y Notas~~ (hecho).
4. ~~Eventos y calendario~~ (hecho).
5. Partidos jugados y marcador en directo: **Partidos jugados hecho**. **Siguiente paso:** el directo
   (`LiveMatchPage`: siempre oscuro y a pantalla completa; sus ventanas en hoja desde abajo).
6. Premios y tienda.
7. Chat.
8. Perfil, apariencia y configuración (que se vean las diferencias entre identidades).
9. Pizarra y editor 3D (solo el entorno; sin perder espacio ni precisión).
10. Componentes y gráficas comunes (`ui/charts`, `Dialog` con hoja, `Segmented`, `ListRow`), según se necesiten.
11. Revisión responsive y de accesibilidad (360, 390, tableta, escritorio; claro y oscuro).
12. Limpieza: estilos y alias antiguos sin uso (`bg-panel`, `text-zinc-…`, `bg-tnt`, `text-ember`, `buildTheme`),
    colores fijos y documentación (`CLAUDE.md`).

**Norma nueva (26-11-2026, pedida por Marcos): pantalla fija en el móvil.** La página no se desplaza entera: arriba lo
fijo (cabecera, filtros, lo importante) y las listas largas en una zona que se desliza por dentro; lo secundario se
abre en hoja desde abajo. Hecho en Ranking, Notas, Eventos, Partidos jugados y Plantilla. Pendiente de aplicar a Inicio (fase de revisión responsive) y
a todas las pantallas nuevas. Cómo se hace: la página es `flex h-full min-h-0 flex-col md:h-auto`; lo fijo va arriba y
la zona que se desliza es `min-h-0 flex-1 overflow-y-auto overscroll-contain` (en escritorio, `md:overflow-visible`);
la ruta se añade a `WIDE_PATHS` en `AppLayout.jsx` si tiene distribución de escritorio propia.

Principio en todas: diseño compacto (menos scroll y espacio vacío, filas en vez de tarjetas grandes, columnas en
escritorio) sin quitar información.

**Norma nueva (26-11-2026, pedida por Marcos): móvil compacto.** En el móvil todo puede ser algo más pequeño para que
se vea como en el ordenador y no parezca que no cabe. Está hecho en general (raíz de 15 px en el móvil), así que no hay
que bajar tamaños pantalla a pantalla. Límites: letra de 12 px como mínimo, campos de texto en 16 px y zonas de toque
de unos 40 px. Sustituye a «sin bajar el tamaño de letra ni de los controles». Nunca estirar ni aplastar una pista
o un dibujo para que quepa: se mantienen sus proporciones y se reparte el sitio (por ejemplo, la cancha a un lado y la
lista al otro).

## Pendiente aparte (backend, no se toca en el rediseño)

- Privacidad de las notas: los compañeros ven el detalle por habilidad de cualquier jugador y de todos los
  equipos; la política habla de «nota media» (detalle en `docs/ranking-y-notas.md`).

## Cómo probar

- `npm test`, `npm run build`, `npm run comprobar-temas`; `cd backend && python -m pytest -q`.
- Demo: `npm run demo` (5180/8100). Capturas con Playwright cambiando la identidad del club desde la cuenta de
  Coordinación (`PUT /api/club/theme`) y el modo con `localStorage["rotta-modo"]`.
