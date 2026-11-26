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

Pruebas al cerrar `f6d4a84`: web 228, servidor 637, temas sin fallos.

## Siguiente (por orden)

1. Inicio, bloque 3: revisar familia, entrenador sin ficha, vóley playa, 360 px y tableta; compactar.
2. Plantilla y fichas de jugadores.
3. Ranking y Notas (ver `docs/ranking-y-notas.md`: «Nota global», dorado solo ≥85, Tu ficha arriba y al
   final, equipo por defecto sin `startsWith("escuela")`).
4. Eventos y calendario.
5. Partidos jugados y marcador en directo.
6. Premios y tienda.
7. Chat.
8. Perfil, apariencia y configuración (que se vean las diferencias entre identidades).
9. Pizarra y editor 3D (solo el entorno; sin perder espacio ni precisión).
10. Componentes y gráficas comunes (`ui/charts`, `Dialog` con hoja, `Segmented`, `ListRow`), según se necesiten.
11. Revisión responsive y de accesibilidad (360, 390, tableta, escritorio; claro y oscuro).
12. Limpieza: estilos y alias antiguos sin uso (`bg-panel`, `text-zinc-…`, `bg-tnt`, `text-ember`, `buildTheme`),
    colores fijos y documentación (`CLAUDE.md`).

Principio en todas: diseño compacto (menos scroll y espacio vacío, filas en vez de tarjetas grandes, columnas en
escritorio) sin bajar el tamaño de letra ni de los controles ni quitar información.

## Pendiente aparte (backend, no se toca en el rediseño)

- Privacidad de las notas: los compañeros ven el detalle por habilidad de cualquier jugador y de todos los
  equipos; la política habla de «nota media» (detalle en `docs/ranking-y-notas.md`).

## Cómo probar

- `npm test`, `npm run build`, `npm run comprobar-temas`; `cd backend && python -m pytest -q`.
- Demo: `npm run demo` (5180/8100). Capturas con Playwright cambiando la identidad del club desde la cuenta de
  Coordinación (`PUT /api/club/theme`) y el modo con `localStorage["rotta-modo"]`.
