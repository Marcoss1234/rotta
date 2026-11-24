import { cx } from "./cx.js";

/**
 * Elegir entre opciones (equipos, filtros, posiciones): una fila de pastillas.
 * options: [{ value, label, count? }]; value: el elegido (o una lista si multiple); onChange(valor o lista).
 * scroll: una sola fila que se desliza si no caben (en el móvil).
 */
export function ChipGroup({ options, value, onChange, label, multiple = false, scroll = false, className }) {
  const chosen = (option) => (multiple ? value.includes(option) : value === option);
  const pick = (option) => {
    if (!multiple) return onChange(option);
    return onChange(chosen(option) ? value.filter((item) => item !== option) : [...value, option]);
  };
  return (
    <div role="group" aria-label={label} className={cx("flex gap-1.5", scroll ? "no-scrollbar -mx-5 overflow-x-auto px-5 md:mx-0 md:px-0" : "flex-wrap", className)}>
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
