import { Field, PasswordInput } from "@/app/ui/index.js";

// Estilos antiguos de campo: los sigue usando Perfil (ProfilePage) mientras no se rediseñe. No usar en pantallas nuevas.
export const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/20 bg-card px-3 text-base text-white placeholder-zinc-500 focus:border-white focus:outline-none";
export const fieldLabelClass = "mb-1.5 block text-sm font-semibold text-white/80";

/** Etiqueta, campo de contraseña con el ojo, ayuda y error (Field + PasswordInput de src/app/ui). */
export default function PasswordField({ id, label, value, onChange, autoComplete, hint, error, disabled, required = true, inputRef }) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <PasswordInput
        ref={inputRef}
        id={id}
        what={label.toLowerCase()}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        hint={hint}
        error={error}
      />
    </Field>
  );
}
