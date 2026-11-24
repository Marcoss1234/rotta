import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "./cx.js";

// Campos de formulario. El fondo es el de la pantalla (canvas) para que se vean sobre una tarjeta; el borde
// tiene 3:1 en todos los temas (control); al escribir, el borde pasa al color de Rotta (el del foco).
// Las esquinas siguen al tema pero nunca son de pastilla (un cuadro de texto redondo no se lee bien).
const CONTROL =
  "w-full rounded-field bg-canvas px-3.5 text-base text-ink ring-1 ring-inset ring-control placeholder:text-ink-muted " +
  "focus:outline-none focus:ring-2 focus:ring-rotta-text disabled:cursor-not-allowed disabled:opacity-60 " +
  "aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger-text";

/**
 * Etiqueta, ayuda y error de un campo. El campo va dentro (children) con el mismo `id`.
 * Props: id, label, optional (añade «(opcional)»), hint, error.
 */
export function Field({ id, label, optional = false, hint, error, className, children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (opcional)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-ayuda`} className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-danger-text">{error}</p>}
    </div>
  );
}

// Enlaza el campo con su ayuda o su error (los lectores de pantalla lo leen al entrar en el campo).
const describedBy = (id, hint, error) => (error ? `${id}-error` : hint ? `${id}-ayuda` : undefined);

/** Props extra: invalid (marca el error), hint y error (solo para enlazarlos; se enseñan con Field). */
export const Input = forwardRef(function Input({ id, invalid, hint, error, className, ...rest }, ref) {
  return <input ref={ref} id={id} aria-invalid={invalid || Boolean(error) || undefined} aria-describedby={describedBy(id, hint, error)} className={cx(CONTROL, "min-h-11", className)} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ id, invalid, hint, error, className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} id={id} rows={rows} aria-invalid={invalid || Boolean(error) || undefined} aria-describedby={describedBy(id, hint, error)} className={cx(CONTROL, "py-2.5", className)} {...rest} />;
});

/** Desplegable del sistema (en el móvil abre la rueda nativa), con la flecha del tema. */
export const Select = forwardRef(function Select({ id, invalid, hint, error, className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} id={id} aria-invalid={invalid || Boolean(error) || undefined} aria-describedby={describedBy(id, hint, error)} className={cx(CONTROL, "min-h-11 appearance-none pr-10", className)} {...rest}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
    </div>
  );
});
