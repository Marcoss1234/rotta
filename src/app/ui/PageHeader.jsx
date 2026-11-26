import { cx } from "./cx.js";

/**
 * Cabecera de una pantalla (Premium deportivo): título compacto con la letra de la identidad, subtítulo y, si hace
 * falta, sus botones. Cada identidad la remata a su manera (app-page-header en index.css): Lima con una marca
 * corta en su color, Tinta con una línea fina debajo, Naranja sin adornos (su título ya es ancho y pesado).
 * Props: title, subtitle, actions (botones), stacked (los botones debajo, en vez de a la derecha), className.
 */
export function PageHeader({ title, subtitle, actions, stacked = false, className }) {
  return (
    <header className={cx("app-page-header flex gap-x-3 gap-y-3", stacked ? "flex-col" : "flex-wrap items-end justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-title text-title text-ink md:text-display">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className={stacked ? "flex min-h-11 items-center" : "shrink-0"}>{actions}</div>}
    </header>
  );
}
