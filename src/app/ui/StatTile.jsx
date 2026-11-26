import { cx } from "./cx.js";

/**
 * Un número protagonista con su etiqueta (Premium deportivo): puesto, nota, asistencia, coins...
 * El número va con la letra de marcador de la identidad (.font-score). `emphasis="gold"` solo para lo que de verdad
 * es oro: una nota de 85 o más, el oro del podio, los coins. El resto, en el color del texto.
 * Props: label, value, suffix (p. ej. «%» o «º»), caption (debajo, pequeño), emphasis («gold»), as, className.
 */
export function StatTile({ label, value, suffix, caption, emphasis, as: Tag = "div", className, ...rest }) {
  return (
    <Tag className={cx("ui-card flex min-w-0 flex-col gap-1 rounded-card bg-card p-4", className)} {...rest}>
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      <span className={cx("font-score text-[2rem] leading-none", emphasis === "gold" ? "text-gold-text" : "text-ink")}>
        {value}
        {suffix && <span className="ml-0.5 text-base">{suffix}</span>}
      </span>
      {caption && <span className="truncate text-xs text-ink-muted">{caption}</span>}
    </Tag>
  );
}
