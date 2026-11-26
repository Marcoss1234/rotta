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
  // Hoja desde abajo (móvil). auto: hoja en el móvil y en el centro desde 768 px (Premium deportivo: fichas y
  // detalles se abren así para no alargar la pantalla).
  sheet: "ui-sheet !mx-auto !mb-0 !mt-auto max-h-[88vh] w-full max-w-lg rounded-t-card pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
  auto: "ui-sheet !mx-auto !mb-0 !mt-auto max-h-[88vh] w-full max-w-lg rounded-t-card pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:!m-auto md:max-h-[92vh] md:w-[calc(100%-2rem)] md:rounded-card md:pb-6",
};

/**
 * Ventana emergente sobre el <dialog> del navegador: atrapa el foco, se cierra con Escape y tapa el resto.
 * Se abre al montarse y se cierra al desmontarse (como los diálogos de siempre de la app).
 * Props: title, description, onClose, busy (no se deja cerrar mientras guarda), placement (center | side | sheet | auto), media (algo encima del título, como el personaje 3D),
 * footer (los botones de abajo), children.
 */
export function Dialog({ title, description, onClose, busy = false, placement = "center", footer, className, children, media = null }) {
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
        "overflow-y-auto bg-overlay p-5 font-body text-ink shadow-overlay ring-1 ring-line backdrop:bg-canvas/75 backdrop:backdrop-blur-sm md:p-6",
        className,
      )}
    >
      {(placement === "sheet" || placement === "auto") && <span aria-hidden="true" className={cx("mx-auto -mt-2 mb-3 block h-1 w-10 rounded-full bg-line", placement === "auto" && "md:hidden")} />}
      {media}
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
