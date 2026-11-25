# Componentes comunes de Rotta (`src/app/ui`)

Funcionan igual en los tres temas (Lima, Naranja y Tinta), en claro y en oscuro, y con cualquier color de club.
**Solo usan los nombres con significado** de `tailwind.config.js`; `npm run comprobar-temas` falla si alguno lleva
un color fijo (hexadecimal, `zinc-…`, `white`, `tnt`, `ember`…). Se importan de `@/app/ui/index.js`.
Para verlos todos: `npm run demo` y abrir `/componentes` (solo existe en desarrollo y en la demo).

| Componente | Para qué | Props principales |
| --- | --- | --- |
| `Button` | Acciones | `variant`: `primary` (color del club, una por zona), `secondary`, `quiet`, `danger`, `danger-quiet` · `size`: `sm`, `md`, `lg` · `icon` · `busy` + `busyLabel` · `block` |
| `LinkButton` | Un enlace con aspecto de botón (mapa, otra pantalla) | las de `Button` (por defecto `secondary`) + `href`, `target`... · `as={Link}` (react-router) con `to` para ir a otra pantalla |
| `IconButton` | Acción solo con icono | `icon`, `label` (obligatorio: se lee en voz alta) · `variant` · `size` |
| `Card` | Separar un bloque | `level`: `base`, `raised` (dentro de otra tarjeta), `outline`, `accent` (lo tuyo o lo elegido) · `padding`: `none`, `sm`, `md` · `as` · `interactive` |
| `CardHeader` | Título de una tarjeta | `title`, `subtitle`, `action` |
| `Tabs` | Apartados dentro de una pantalla | `id` (de `useId()`), `items` (`id`, `label`, `icon`, `count`, `disabled`), `value`, `onChange`, `label`, `hasPanels` · teclado: flechas, Inicio, Fin (se salta las desactivadas) |
| `TabPanel` | El contenido de cada pestaña | `tabsId` (el mismo `id` de `Tabs`), `tab`, `value` · enlazado con `aria-controls` y `aria-labelledby` |
| `ChipGroup` | Elegir equipo, filtros, opciones | `options` (`value`, `label`, `count`), `value`, `onChange`, `label`, `multiple`, `scroll` (una fila que se desliza: difumina el borde por donde quedan opciones y trae la elegida a la vista) |
| `Field` | Etiqueta, ayuda y error de un campo | `id`, `label`, `optional`, `hint`, `error` |
| `Input`, `Textarea`, `Select` | Campos | los de HTML + `invalid`, `hint`, `error` (para enlazarlos) |
| `PasswordInput` | Contraseña con el ojo para verla | las de `Input` + `autoComplete` (`current-password` o `new-password`) · `what` (qué contraseña es, para el botón: «Mostrar contraseña temporal») |
| `Dialog` | Ventana o panel lateral | `title`, `description`, `onClose`, `busy`, `placement`: `center` o `side`, `footer` |
| `Notice` | Avisos | `tone`: `error` (se anuncia con alert), `warning`, `success`, `info` · `inline` (sin recuadro) · `size`: `sm` (12 px) o `md` · `announce={false}` (aviso fijo, no se anuncia) · `as` (`div` si lleva una lista) |
| `EmptyState` | Lista vacía | `action` |
| `Badge` | Etiqueta pequeña | `tone`: `neutral`, `club`, `rotta`, `voy`, `danger`, `danger-soft` (lo negativo sin alarmar, como una derrota) |

Reglas de uso:
- Una sola acción principal por zona; las demás, `secondary` o `quiet`.
- Tarjetas por función, no para todo: dentro de una tarjeta, separa con `border-line` o con `level="raised"`.
- Textos de 12 px como mínimo.
- Lo propio de una pantalla (el calendario, la pista) se queda en su pantalla, pero con los mismos colores del tema.

Pruebas: `npm test` (Vitest + Testing Library + jsdom). Cada componente tiene su `*.test.jsx` al lado, con clics,
selección, teclado, estados desactivados y Escape. jsdom no trae `showModal()` ni `close()` de `<dialog>`:
`src/test/setup.js` los completa como en el navegador (incluidos sus errores), para no tapar fallos del componente.
