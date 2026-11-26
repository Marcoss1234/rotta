import { useEffect } from "react";
import { cx } from "./cx.js";

// El título de la pantalla también va a la barra de arriba del móvil (AppLayout lo escucha): así no hace falta una
// franja entera para él. En escritorio, donde no hay esa barra, se ve aquí como siempre.
export const PAGE_TITLE_EVENT = "rotta-page-title";
// Se guarda el último: la página se monta antes de que la barra empiece a escuchar.
let lastTitle = null;
export const currentPageTitle = () => lastTitle;
const announce = (title) => {
  lastTitle = title;
  window.dispatchEvent(new CustomEvent(PAGE_TITLE_EVENT, { detail: title }));
};

/**
 * Cabecera de una pantalla (Premium deportivo): título compacto con la letra de la identidad, subtítulo y, si hace
 * falta, sus botones. Cada identidad la remata a su manera (app-page-header en index.css): Lima con una marca
 * corta en su color, Tinta con una línea fina debajo, Naranja sin adornos (su título ya es ancho y pesado).
 * En el móvil el título se ve en la barra de arriba (aquí queda para los lectores de pantalla) y esta cabecera se
 * queda en una línea: el subtítulo y los botones.
 * Props: title, subtitle, actions (botones), stacked (los botones debajo, en vez de a la derecha), className.
 */
export function PageHeader({ title, subtitle, actions, stacked = false, className }) {
  useEffect(() => {
    announce(title);
    return () => announce(null);
  }, [title]);
  return (
    // Los botones van al lado del título (no debajo) para que la cabecera ocupe una sola franja.
    <header className={cx("app-page-header gap-x-3 gap-y-2 md:gap-y-3", stacked ? "flex flex-col" : "grid grid-cols-[minmax(0,1fr)_auto] items-center justify-between md:items-end", className)}>
      <div className="min-w-0">
        <h1 className="sr-only font-title text-title text-ink md:not-sr-only md:text-display">{title}</h1>
        {subtitle && <p className="text-xs text-ink-muted md:mt-1.5 md:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className={stacked ? "flex min-h-11 items-center" : "shrink-0"}>{actions}</div>}
    </header>
  );
}
