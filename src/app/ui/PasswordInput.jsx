import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./Field.jsx";
import { cx } from "./cx.js";

/**
 * Campo de contraseña con el botón de ver u ocultar (el ojo). Va dentro de un <Field> con el mismo `id`.
 * Props: las de Input (autoComplete: "current-password" para entrar, "new-password" para crear una), y
 * `what`: qué contraseña es, para el botón («Mostrar contraseña temporal»...; por defecto, «contraseña»).
 * Sin mayúsculas ni correcciones automáticas del teclado del móvil: una contraseña se escribe tal cual.
 */
export const PasswordInput = forwardRef(function PasswordInput({ what = "contraseña", className, disabled, maxLength = 128, ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  const action = `${visible ? "Ocultar" : "Mostrar"} ${what}`;
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={maxLength}
        disabled={disabled}
        className={cx("pr-12", className)}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={action}
        title={action}
        aria-pressed={visible}
        disabled={disabled}
        className={cx(
          "absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-field text-ink-muted transition hover:text-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rotta-text disabled:opacity-50",
        )}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  );
});
