# Componentes comunes de Rotta (`src/app/ui`)

Funcionan igual en los tres temas (Lima, Naranja y Tinta), en claro y en oscuro, y con cualquier color de club.
**Solo usan los nombres con significado** de `tailwind.config.js`; `npm run comprobar-temas` falla si alguno lleva
un color fijo (hexadecimal, `zinc-…`, `white`, `tnt`, `ember`…). Se importan de `@/app/ui/index.js`.
Para verlos todos: `npm run demo` y abrir `/componentes` (solo existe en desarrollo y en la demo).

| Componente | Para qué | Props principales |
| --- | --- | --- |
| `Button` | Acciones | `variant`: `primary` (color del club, una por zona), `secondary`, `quiet`, `danger`, `danger-quiet` · `size`: `sm`, `md`, `lg` · `icon` · `busy` + `busyLabel` · `block` |
| `IconButton` | Acción solo con icono | `icon`, `label` (obligatorio: se lee en voz alta) · `variant` · `size` |
| `Card` | Separar un bloque | `level`: `base`, `raised` (dentro de otra tarjeta), `outline`, `accent` (lo tuyo o lo elegido) · `padding`: `none`, `sm`, `md` · `as` · `interactive` |
| `CardHeader` | Título de una tarjeta | `title`, `subtitle`, `action` |
| `Tabs` | Apartados dentro de una pantalla | `items` (`id`, `label`, `icon`, `count`), `value`, `onChange`, `label` · teclado: flechas, Inicio, Fin |
| `ChipGroup` | Elegir equipo, filtros, opciones | `options` (`value`, `label`, `count`), `value`, `onChange`, `label`, `multiple`, `scroll` |
| `Field` | Etiqueta, ayuda y error de un campo | `id`, `label`, `optional`, `hint`, `error` |
| `Input`, `Textarea`, `Select` | Campos | los de HTML + `invalid`, `hint`, `error` (para enlazarlos) |
| `Dialog` | Ventana o panel lateral | `title`, `description`, `onClose`, `busy`, `placement`: `center` o `side`, `footer` |
| `Notice` | Avisos | `tone`: `error` (se anuncia), `success`, `info` |
| `EmptyState` | Lista vacía | `action` |
| `Badge` | Etiqueta pequeña | `tone`: `neutral`, `club`, `rotta`, `voy`, `danger` |

Reglas de uso:
- Una sola acción principal por zona; las demás, `secondary` o `quiet`.
- Tarjetas por función, no para todo: dentro de una tarjeta, separa con `border-line` o con `level="raised"`.
- Textos de 12 px como mínimo.
- Lo propio de una pantalla (el calendario, la pista) se queda en su pantalla, pero con los mismos colores del tema.
