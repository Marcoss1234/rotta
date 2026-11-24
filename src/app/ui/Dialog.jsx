import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "./Button.jsx";
import { cx } from "./cx.js";

// Los márgenes van con «!»: si el diálogo está dentro de un contenedor con space-y-*, Tailwind le pone
// sus propios márgenes y dejaría de estar centrado.
const PLACEMENTS = {
  // Ventana en el centro (formularios, confirmaciones).
  center: "!m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-md rounded-card",
  // Panel lateral (detalles, ajustes largos): a la derecha y de arriba abajo.
  side: "!my-0 !ml-auto !mr-0 h-full max-h-none w-full max-w-md md:rounded-l-card",
};

/**
 * Ventana emergente sobre el <dialog> del navegador: atrapa el foco, se cierra con Escape y tapa el resto.
 * Se abre al montarse y se cierra al desmontarse (como los diálogos de siempre de la app).
 * Props: title, description, onClose, busy (no se deja cerrar mientras guarda), placement (center | side),
 * footer (los botones de abajo), children.
 */
export function Dialog({ title, description, onClose, busy = false, placement = "center", footer, className, children }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className={cx(
        PLACEMENTS[placement],
        "overflow-y-auto bg-card p-5 font-body text-ink shadow-card ring-1 ring-line backdrop:bg-canvas/75 backdrop:backdrop-blur-sm md:p-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-2xl font-extrabold leading-tight">{title}</h2>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        </div>
        <IconButton icon={X} label="Cerrar" size="sm" disabled={busy} onClick={onClose} className="-mr-2 -mt-1" />
      </div>
      <div className="mt-4">{children}</div>
      {footer && <div className="mt-5">{footer}</div>}
    </dialog>
  );
}
