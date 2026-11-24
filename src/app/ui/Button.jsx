import { forwardRef } from "react";
import { LoaderCircle } from "lucide-react";
import { cx } from "./cx.js";

// Botones de Rotta. Solo colores del tema: el del club para la acción principal, el texto y los bordes del tema
// para el resto, y el rojo con significado para borrar. Esquinas según el tema (rounded-control).
const BASE =
  "inline-flex shrink-0 items-center justify-center rounded-control font-bold transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export const BUTTON_VARIANTS = {
  // La acción principal de la pantalla: una sola por zona.
  primary: "bg-club text-on-club hover:brightness-110 active:brightness-95",
  // Acciones normales (Cancelar, Ver más...).
  secondary: "text-ink ring-1 ring-inset ring-control hover:bg-raised",
  // Acciones discretas dentro de una tarjeta o lista.
  quiet: "text-ink-muted hover:bg-raised hover:text-ink",
  // Borrar o algo que no se puede deshacer, ya confirmado.
  danger: "bg-danger text-snow hover:brightness-110",
  // El primer paso para borrar (antes de confirmar).
  "danger-quiet": "text-danger-text hover:bg-danger/10",
};

const SIZES = {
  sm: "min-h-10 gap-1.5 px-3 text-sm",
  md: "min-h-11 gap-2 px-4 text-sm",
  lg: "min-h-14 gap-2 px-5 text-lg",
};
const ICON_SIZES = { sm: "h-4 w-4", md: "h-4 w-4", lg: "h-5 w-5" };

/**
 * Props: variant (primary | secondary | quiet | danger | danger-quiet), size (sm | md | lg), icon (de lucide-react),
 * busy (lo está guardando: se desactiva y enseña busyLabel), block (ocupa todo el ancho). El resto va al <button>.
 */
export const Button = forwardRef(function Button(
  { variant = "primary", size = "md", icon: Icon, busy = false, busyLabel, block = false, className, children, type = "button", disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(BASE, BUTTON_VARIANTS[variant], SIZES[size], block && "w-full", className)}
      {...rest}
    >
      {busy ? <LoaderCircle aria-hidden="true" className={cx(ICON_SIZES[size], "animate-spin")} /> : Icon && <Icon aria-hidden="true" className={ICON_SIZES[size]} />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
});

/** Botón solo con icono. `label` es obligatorio: es lo que se lee en voz alta y sale al pasar el ratón. */
export const IconButton = forwardRef(function IconButton({ icon: Icon, label, variant = "quiet", size = "md", className, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(BASE, BUTTON_VARIANTS[variant], size === "sm" ? "h-10 w-10" : "h-11 w-11", className)}
      {...rest}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
    </button>
  );
});
