import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/20 bg-panel px-3 text-base text-white placeholder-zinc-500 focus:border-white focus:outline-none";
export const fieldLabelClass = "mb-1.5 block text-sm font-semibold text-zinc-300";

export default function PasswordField({ id, label, value, onChange, autoComplete, hint, disabled }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div>
      <label htmlFor={id} className={fieldLabelClass}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={128}
          required
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`${fieldClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white"
        >
          <Icon aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
