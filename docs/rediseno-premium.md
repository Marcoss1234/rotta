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
| (este) | Directo e informe: sin degradados ni el naranja del TNT (marcador con el color del club y el rival en su azul fijo `rival`; textura del marcador según la identidad); media pista con sus medidas de verdad y la pista de la identidad (`CourtDrawing themed`); ventanas del jugador, ayuda y MVP en hoja desde abajo en el móvil; «Empezar partido» como botón principal; el informe con verde/rojo de victoria y derrota. Arreglo: la pizarra, el directo y el informe ya no quedan debajo de la barra lateral en escritorio (`md:left-[17rem]`). Texto corregido: «+1» ya no dice «naranja» |
| (este) | Premios y tienda: pantalla fija en el móvil; escaparates en el escenario oscuro de Rotta (sin el degradado ámbar del TNT); escritorio en dos columnas. Premios: «Volver al ranking» (flecha) y «Tienda» al lado del título; premios en tarjetas del tema. Tienda: categorías como pastillas de la identidad; artículos con la selección del club; «Puesto» pasa a la línea de estado; la barra de abajo junta lo que te pruebas y comprar/ponértelo (antes «Probándote» iba encima del personaje); comprar en dorado sólido con texto oscuro fijo. Arreglo: la barra de comprar ya no se mete bajo la barra lateral |
| (este) | Chat: lista en filas dentro de un solo bloque (lo elegido con el tono del club, lo sin leer en negrita con su contador); conversación con cabecera ligera (icono del club, sin franja maciza), burbujas propias con el color del club y las de los demás con la tarjeta del tema, separador de día en pastilla, campo de escribir como los del tema; escritorio a todo el ancho |
| (este) | Perfil reordenado: pantalla fija en el móvil con pestañas Ficha (personaje, coins, estadísticas) · Datos · Apariencia · Cuenta (avisos, instalar, privacidad, acceso y cerrar sesión), cada una deslizándose por dentro; `?seccion=` para abrir una directamente. Escritorio: la ficha fija a la izquierda y las pestañas a la derecha. Personaje en el escenario de Rotta (sin el degradado naranja), tarjetas y botones del tema |
| (este) | Chat estilo WhatsApp (pedido por Marcos): burbujas con piquito en la primera de cada tanda, la hora y los ✓ dentro de la burbuja, fondo con dibujos suaves de voley (`chat-wallpaper`), la fecha en pastilla que se queda arriba al bajar, campo de escribir en pastilla con la foto dentro y botón redondo de enviar; la papelera sale al tocar el mensaje (o al pasar el ratón) en vez de una en cada mensaje |
| (este) | Pizarra: lista con pantalla fija, «Nueva» al lado del título, tarjetas del tema y tres columnas en escritorio. Editor: en escritorio la cancha ocupa todo el alto y los controles van en una columna a la derecha (antes debajo, con la cancha pequeña y los botones estirados); móvil y tableta igual que antes. Sin el naranja ni los degradados del TNT; lo elegido (2D/3D, Dibujar/Jugada, tamaño de pista) con el estilo de la identidad. La cancha de la pizarra sigue realista, como estaba decidido |
| (este) | Editor de la pizarra en escritorio: el panel de la derecha ordenado por partes con título (Dibujar/Jugada arriba; en Dibujar, «Herramientas» y «Añadir a la pista» con botones grandes en rejilla de dos; en Jugada, «Reproducir» con el play y la línea de tiempo, «Velocidad» y «Cambiar la jugada»). Antes eran las tiras del móvil amontonadas abajo. Móvil y tableta, igual |
| (este) | Componentes sin degradados de marca: «Partido en directo» (Inicio y vista previa de Apariencia) en rojo liso de directo; aviso de notificaciones con el tono del club; premios, destacados del entreno y coins en dorado liso (`bg-gold/10`) con texto oscuro fijo sobre el dorado; botón de ayuda del chat en azul liso |
| (este) | Inicio con pantalla fija en el móvil: saludo con coins y equipo fijos; lo demás se desliza con las pestañas Entrenamientos/Partidos pegadas arriba al bajar; orden nuevo: avisos de acceso, directo y la agenda primero, y los avisos de instalar, notificaciones y la bienvenida al final (antes empujaban el entreno). Escritorio igual |
| (este) | Repaso: Notas con la semana, su estado, el progreso y «Publicar» en un solo bloque en el móvil; Jugados con el resumen en una sola tira (cada dato con su ancho) |
| (este) | Barra de arriba del móvil: en Inicio, el saludo («Buenas tardes, Carmen») en lugar del nombre del club; las coins (moneda y número, con la corona si la tienes) junto a tu foto en todas las pantallas, al día con Inicio y la tienda (`src/app/coins.js`). Inicio ya no tiene la franja del saludo en el móvil |
| (este) | Título de cada pantalla en la barra de arriba del móvil (en lugar del nombre del club, que ya se ve en el escudo); la cabecera de la página queda en una línea con el subtítulo y los botones. El `h1` sigue en la página para lectores de pantalla (`sr-only` en el móvil). `PageHeader` avisa del título con un evento (`PAGE_TITLE_EVENT`) |
| (este) | Plantilla y Pizarra en el móvil: las pestañas «Plantilla | Pizarra» van en la línea de la cabecera, junto a «Añadir»/«Nueva» (una fila menos; el equipo ya se ve en sus botones). `PageHeader` acepta un subtítulo que no sea texto |
| (este) | Una fila menos en el móvil: Eventos con el mes en la línea de la cabecera (en lugar de «Calendario del club»); Notas con los equipos en la cabecera y «Ranking» como icono; Jugados con los tipos de partido en la cabecera y «Partidos» como flecha |
| (este) | Chat y Perfil en el móvil sin la línea de subtítulo («X mensajes sin leer», tu nombre), que ya se ve en otro sitio; `PageHeader` sin subtítulo ni botones no ocupa nada en el móvil |
| `ce4f0fc` | Este documento maestro |
| `163d4b3` | Herramienta `tools/crear-admin.py` (cuenta de administrador con usuario y contraseña; fuera del rediseño) |

Pruebas al cerrar `f6d4a84`: web 228, servidor 637, temas sin fallos. Con `163d4b3`: servidor 643. Con Notas: web 231, servidor 643.

## Estado exacto (26-11-2026, tarde)

- **Publicado:** Marcos pidió publicar lo hecho. `main` se adelantó (sin mezcla, avance directo) hasta `3be2727`
  (pizarra en escritorio). Render publica `main` solo: ahí ya se ve el rediseño hasta ese punto.
- Lo que se haga después va solo a la rama `claude/amazing-euler-emy9p1` y no se publica hasta que Marcos lo pida
  (entonces, otra vez `git push origin HEAD:main` si `main` no tiene nada nuevo).
- Hecho del plan: base visual, marco, Inicio, Plantilla, Ranking, Notas, Eventos, Jugados, directo, Premios y tienda,
  chat (estilo WhatsApp), Perfil (pestañas) y Pizarra. Más el móvil compacto (raíz de 15 px).
- Marcos entra como administrador con su cuenta `marcos098`. Google no sale en la app publicada porque falta
  `GOOGLE_CLIENT_ID` en Render.
- Para retomar: «sigue el plan de `docs/rediseno-premium.md` en la rama `claude/amazing-euler-emy9p1`». Antes de
  las capturas hay que arrancar la demo (`npm run demo`; se para sola al rato) y crear los datos de prueba que hagan
  falta (partido de hoy para el directo, mensajes del chat).

## Siguiente (por orden)

1. ~~Inicio, bloque 3~~ (hecho).
2. ~~Plantilla y fichas de jugadores~~ (hecho; la nota de la ficha y el suelo del 3D se ven en Ranking y componentes).
3. ~~Ranking y Notas~~ (hecho).
4. ~~Eventos y calendario~~ (hecho).
5. ~~Partidos jugados y marcador en directo~~ (hecho).
6. ~~Premios y tienda~~ (hecho).
7. ~~Chat~~ (hecho).
8. ~~Perfil, apariencia y configuración~~ (hecho; falta repasar la vista previa de Apariencia, que aún pinta un degradado en «Partido en directo»).
9. ~~Pizarra y editor 3D~~ (hecho).
10. ~~Componentes~~ (degradados quitados) y ~~repaso de Inicio, Notas y Jugados~~ (hecho). **Siguiente paso:** revisión responsive (11) y limpieza (12).
10b. Componentes y gráficas comunes (`ui/charts`, `Dialog` con hoja, `Segmented`, `ListRow`), según se necesiten.
11. Revisión responsive y de accesibilidad (360, 390, tableta, escritorio; claro y oscuro).
12. Limpieza: estilos y alias antiguos sin uso (`bg-panel`, `text-zinc-…`, `bg-tnt`, `text-ember`, `buildTheme`),
    colores fijos y documentación (`CLAUDE.md`).

**Norma nueva (26-11-2026, pedida por Marcos): pantalla fija en el móvil.** La página no se desplaza entera: arriba lo
fijo (cabecera, filtros, lo importante) y las listas largas en una zona que se desliza por dentro; lo secundario se
abre en hoja desde abajo. Hecho en todas las pantallas (Inicio incluido) (fase de revisión responsive) y
a todas las pantallas nuevas. Cómo se hace: la página es `flex h-full min-h-0 flex-col md:h-auto`; lo fijo va arriba y
la zona que se desliza es `min-h-0 flex-1 overflow-y-auto overscroll-contain` (en escritorio, `md:overflow-visible`);
la ruta se añade a `WIDE_PATHS` en `AppLayout.jsx` si tiene distribución de escritorio propia.

**Norma (26-11-2026, pedida por Marcos): no gastar franjas en cosas pequeñas.** Si algo ocupa una fila entera y cabe
más pequeño en otro sitio (como el saludo y las coins, ahora en la barra de arriba), se mueve.

**Norma (26-11-2026, pedida por Marcos): publicar cada cambio.** Cada bloque terminado se sube también a `main`
(`git push origin HEAD:main`) para que Render lo publique.

**Norma (26-11-2026, pedida por Marcos): reordenar, no solo repintar.** En cada pantalla, decidir primero qué es lo
más importante, qué va junto y qué sobra arriba, y mover las piezas a donde queden mejor ordenadas. Al terminar las
pantallas, repasar las ya hechas con esta idea (ideas apuntadas: resumen de Jugados en una tira, estado y progreso de
Notas en un solo bloque con la semana, bienvenida de Inicio más pequeña o más abajo).

Principio en todas: diseño compacto (menos scroll y espacio vacío, filas en vez de tarjetas grandes, columnas en
escritorio) sin quitar información.

**Norma nueva (26-11-2026, pedida por Marcos): móvil compacto.** En el móvil todo puede ser algo más pequeño para que
se vea como en el ordenador y no parezca que no cabe. Está hecho en general (raíz de 15 px en el móvil), así que no hay
que bajar tamaños pantalla a pantalla. Límites: letra de 12 px como mínimo, campos de texto en 16 px y zonas de toque
de unos 40 px. Sustituye a «sin bajar el tamaño de letra ni de los controles». Nunca estirar ni aplastar una pista
o un dibujo para que quepa: se mantienen sus proporciones y se reparte el sitio (por ejemplo, la cancha a un lado y la
lista al otro).

## Pendiente aparte (backend, no se toca en el rediseño)

- Directo: si se termina un partido con los sets empatados (por ejemplo, a mitad del primero), el informe dice
  «Derrota» (cuenta como victoria solo si se ganan más sets). Es lógica, no diseño.
- Privacidad de las notas: los compañeros ven el detalle por habilidad de cualquier jugador y de todos los
  equipos; la política habla de «nota media» (detalle en `docs/ranking-y-notas.md`).

## Cómo probar

- `npm test`, `npm run build`, `npm run comprobar-temas`; `cd backend && python -m pytest -q`.
- Demo: `npm run demo` (5180/8100). Capturas con Playwright cambiando la identidad del club desde la cuenta de
  Coordinación (`PUT /api/club/theme`) y el modo con `localStorage["rotta-modo"]`.
