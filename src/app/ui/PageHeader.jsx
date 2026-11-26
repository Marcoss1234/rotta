import { cx } from "./cx.js";

/**
 * Cabecera de una pantalla (Premium deportivo): título compacto con la letra de la identidad, subtítulo y, si hace
 * falta, sus botones. Cada identidad la remata a su manera (app-page-header en index.css): Lima con una marca
 * corta en su color, Tinta con una línea fina debajo, Naranja sin adornos (su título ya es ancho y pesado).
 * Props: title, subtitle, actions (botones), stacked (los botones debajo, en vez de a la derecha), className.
 */
export function PageHeader({ title, subtitle, actions, stacked = false, className }) {
  return (
    // Los botones van al lado del título (no debajo) para que la cabecera ocupe una sola franja.
    <header className={cx("app-page-header gap-x-3 gap-y-2 md:gap-y-3", stacked ? "flex flex-col" : "grid grid-cols-[minmax(0,1fr)_auto] items-end justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-title text-title text-ink md:text-display">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted md:mt-1.5 md:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className={stacked ? "flex min-h-11 items-center" : "shrink-0"}>{actions}</div>}
    </header>
  );
}
