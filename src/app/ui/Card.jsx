import { cx } from "./cx.js";

// Tarjetas: separan un bloque de información. Úsalas por función, no para todo: dentro de una tarjeta,
// separa con líneas (border-line) o con el nivel "raised", no con otra tarjeta igual.
const LEVELS = {
  // Bloque principal sobre el fondo de la pantalla, con la profundidad de cada identidad (ui-card en index.css:
  // borde en Lima y Tinta, sombra en Naranja y en claro, línea de luz arriba en oscuro).
  base: "rounded-card bg-card ui-card",
  // Zona dentro de una tarjeta (un resumen, un grupo de opciones): con la esquina «dentro», más pequeña.
  raised: "rounded-inner bg-raised",
  // Por encima del resto (menús, paneles que se abren): superficie y sombra de ventana.
  overlay: "rounded-card bg-overlay shadow-overlay",
  // Solo contorno: listas ligeras.
  outline: "rounded-card ring-1 ring-line",
  // Lo destacado del club (lo seleccionado, lo tuyo).
  accent: "rounded-card bg-club-soft ring-1 ring-club-ui",
};
// md: 20 px en el móvil y 24 en escritorio (p-card).
const PADDINGS = { none: "", sm: "p-3", md: "p-card" };
// Al pasar el ratón por una tarjeta que se puede tocar.
const HOVER = { base: "ui-card-interactive", raised: "hover:bg-overlay", overlay: "hover:brightness-105", outline: "hover:ring-control", accent: "hover:brightness-105" };

/** Props: as (etiqueta HTML), level (base | raised | overlay | outline | accent), padding (none | sm | md), interactive. */
export function Card({ as: Tag = "section", level = "base", padding = "md", interactive = false, className, children, ...rest }) {
  return (
    <Tag className={cx(LEVELS[level], PADDINGS[padding], interactive && cx("transition-ui", HOVER[level]), className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Cabecera de una tarjeta: título (y subtítulo) a la izquierda y una acción a la derecha. */
export function CardHeader({ title, subtitle, action, id, as: Tag = "h2", className }) {
  return (
    <div className={cx("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <Tag id={id} className="font-title text-xl leading-tight text-ink">{title}</Tag>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
