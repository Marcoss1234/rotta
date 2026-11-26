import { useId, useRef } from "react";
import { cx } from "./cx.js";

// Identificadores de una pestaña y de su panel dentro de un grupo. Cada grupo tiene su propia base (useId),
// así que dos grupos de pestañas en la misma pantalla nunca repiten identificadores.
const tabId = (base, id) => `${base}-pestana-${id}`;
const panelId = (base, id) => `${base}-panel-${id}`;

/**
 * Pestañas para cambiar de apartado dentro de una pantalla (no para navegar entre pantallas).
 * items: [{ id, label, icon?, count?, disabled? }]; value: el id elegido; onChange(id); label: para qué son.
 * id: la base de los identificadores (de useId() en la pantalla) para enlazar cada pestaña con su <TabPanel>.
 * hasPanels: false si las pestañas solo filtran algo que ya está en la pantalla (sin paneles que enlazar).
 * Teclado: flechas izquierda y derecha, Inicio y Fin (se saltan las desactivadas).
 */
export function Tabs({ id, items, value, onChange, label, hasPanels = true, className }) {
  const ownId = useId();
  const base = id ?? ownId;
  const refs = useRef([]);
  const enabled = items.map((item, index) => (item.disabled ? null : index)).filter((index) => index !== null);

  const focusTab = (index) => {
    refs.current[index]?.focus();
    onChange(items[index].id);
  };
  const onKeyDown = (event, index) => {
    const position = enabled.indexOf(index);
    const target = {
      ArrowRight: enabled[(position + 1) % enabled.length],
      ArrowLeft: enabled[(position - 1 + enabled.length) % enabled.length],
      Home: enabled[0],
      End: enabled[enabled.length - 1],
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    focusTab(target);
  };

  return (
    <div role="tablist" aria-label={label} className={cx("flex gap-1 rounded-control bg-raised p-1", className)}>
      {items.map(({ id: itemId, label: text, icon: Icon, count, disabled = false }, index) => {
        const selected = itemId === value;
        return (
          <button
            key={itemId}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={tabId(base, itemId)}
            aria-selected={selected}
            aria-controls={hasPanels ? panelId(base, itemId) : undefined}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(itemId)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold transition-ui",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text",
              "disabled:cursor-not-allowed disabled:opacity-50",
              // Lo elegido, con la manera de cada identidad (ui-selected en index.css).
              selected ? "ui-selected" : "text-ink-muted hover:text-ink",
            )}
          >
            {Icon && <Icon aria-hidden="true" className={cx("h-4 w-4", selected && "ui-selected-icon text-club-ui")} />}
            {text}
            {count != null && <span className="ui-count rounded-full bg-club px-1.5 text-xs font-bold leading-5 text-on-club">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * El contenido de una pestaña. Siempre está en la página (para que aria-controls apunte a algo), pero oculto y
 * vacío si no es la elegida. tabsId: el mismo `id` que se le pasa a <Tabs>; tab: el id de su pestaña.
 */
export function TabPanel({ tabsId, tab, value, className, children }) {
  const selected = tab === value;
  return (
    <div role="tabpanel" id={panelId(tabsId, tab)} aria-labelledby={tabId(tabsId, tab)} hidden={!selected} tabIndex={0} className={cx("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text", className)}>
      {selected ? children : null}
    </div>
  );
}
