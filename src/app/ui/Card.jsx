import { cx } from "./cx.js";

// Tarjetas: separan un bloque de información. Úsalas por función, no para todo: dentro de una tarjeta,
// separa con líneas (border-line) o con el nivel "raised", no con otra tarjeta igual.
const LEVELS = {
  // Bloque principal sobre el fondo de la pantalla.
  base: "bg-card ring-1 ring-line shadow-card",
  // Zona dentro de una tarjeta (un resumen, un grupo de opciones).
  raised: "bg-raised",
  // Solo contorno: listas ligeras.
  outline: "ring-1 ring-line",
  // Lo destacado del club (lo seleccionado, lo tuyo).
  accent: "bg-club-soft ring-1 ring-club-ui",
};
const PADDINGS = { none: "", sm: "p-3", md: "p-4 md:p-5" };

/** Props: as (etiqueta HTML), level (base | raised | outline | accent), padding (none | sm | md), interactive. */
export function Card({ as: Tag = "section", level = "base", padding = "md", interactive = false, className, children, ...rest }) {
  return (
    <Tag className={cx("rounded-card", LEVELS[level], PADDINGS[padding], interactive && "transition hover:ring-control", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Cabecera de una tarjeta: título (y subtítulo) a la izquierda y una acción a la derecha. */
export function CardHeader({ title, subtitle, action, id, as: Tag = "h2", className }) {
  return (
    <div className={cx("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <Tag id={id} className="font-display text-lg font-extrabold leading-tight text-ink">{title}</Tag>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
