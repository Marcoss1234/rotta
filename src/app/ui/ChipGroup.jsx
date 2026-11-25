import { useEffect, useRef, useState } from "react";
import { cx } from "./cx.js";

const FADE = "2.5rem";

// Con `scroll`, el borde por donde quedan más opciones se difumina: así se ve que la fila sigue y se puede deslizar.
// Es una máscara (transparencia), no un color: vale en todos los temas.
function fadeMask(left, right) {
  if (!left && !right) return undefined;
  const start = left ? `transparent, black ${FADE}` : "black";
  const end = right ? `black calc(100% - ${FADE}), transparent` : "black";
  const mask = `linear-gradient(to right, ${start}, ${end})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

// Mientras la fila se pueda deslizar, dice si quedan opciones a la izquierda o a la derecha.
function useScrollEdges(ref, enabled, value) {
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return undefined;
    const update = () => {
      const max = element.scrollWidth - element.clientWidth;
      setEdges({ left: element.scrollLeft > 1, right: element.scrollLeft < max - 1 });
    };
    // La opción elegida, a la vista (si es la quinta, no queda escondida fuera de la pantalla).
    const selected = element.querySelector("[aria-pressed=true]");
    if (selected) {
      const { left, right } = selected.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      if (right > box.right) element.scrollLeft += right - box.right + 24;
      else if (left < box.left) element.scrollLeft -= box.left - left + 24;
    }
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [ref, enabled, value]);
  return edges;
}

/**
 * Elegir entre opciones (equipos, filtros, posiciones): una fila de pastillas.
 * options: [{ value, label, count? }]; value: el elegido (o una lista si multiple); onChange(valor o lista).
 * scroll: una sola fila que se desliza si no caben (en el móvil), con el borde difuminado mientras quedan más.
 */
export function ChipGroup({ options, value, onChange, label, multiple = false, scroll = false, className }) {
  const ref = useRef(null);
  const edges = useScrollEdges(ref, scroll, multiple ? value.join() : value);
  const chosen = (option) => (multiple ? value.includes(option) : value === option);
  const pick = (option) => {
    if (!multiple) return onChange(option);
    return onChange(chosen(option) ? value.filter((item) => item !== option) : [...value, option]);
  };
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-fade={scroll ? [edges.left && "izquierda", edges.right && "derecha"].filter(Boolean).join(" ") || "no" : undefined}
      style={scroll ? fadeMask(edges.left, edges.right) : undefined}
      className={cx("flex gap-1.5", scroll ? "no-scrollbar -mx-5 overflow-x-auto px-5 md:mx-0 md:px-0" : "flex-wrap", className)}
    >
      {options.map((option) => {
        const selected = chosen(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => pick(option.value)}
            className={cx(
              "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-control px-3.5 text-sm font-semibold ring-1 ring-inset transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text",
              selected ? "bg-club-soft text-ink ring-club-ui" : "text-ink-muted ring-line hover:text-ink hover:ring-control",
            )}
          >
            {option.label}
            {option.count != null && <span className="text-xs font-bold text-ink-muted">{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
