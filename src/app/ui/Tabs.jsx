import { useRef } from "react";
import { cx } from "./cx.js";

/**
 * Pestañas para cambiar de apartado dentro de una pantalla (no para navegar entre pantallas).
 * items: [{ id, label, icon?, count?, panelId? }]; value: el id elegido; onChange(id); label: para qué son.
 * Con el teclado: flechas, Inicio y Fin.
 */
export function Tabs({ items, value, onChange, label, className }) {
  const refs = useRef([]);
  const move = (index) => {
    const next = (index + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].id);
  };
  const onKeyDown = (event, index) => {
    const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    move(keys[event.key]);
  };
  return (
    <div role="tablist" aria-label={label} className={cx("flex gap-1 rounded-control bg-raised p-1", className)}>
      {items.map(({ id, label: text, icon: Icon, count, panelId }, index) => {
        const selected = id === value;
        return (
          <button
            key={id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              "flex min-h-10 flex-1 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text",
              selected ? "bg-card text-ink shadow-card ring-1 ring-inset ring-control" : "text-ink-muted hover:text-ink",
            )}
          >
            {Icon && <Icon aria-hidden="true" className={cx("h-4 w-4", selected && "text-club-ui")} />}
            {text}
            {count != null && <span className="rounded-full bg-club px-1.5 text-xs font-bold leading-5 text-on-club">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
