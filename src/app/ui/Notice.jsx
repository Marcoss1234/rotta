import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cx } from "./cx.js";

const TONES = {
  error: { className: "bg-danger/10 text-danger-text ring-1 ring-inset ring-danger/30", icon: CircleAlert, role: "alert" },
  success: { className: "bg-voy/10 text-voy-text ring-1 ring-inset ring-voy/30", icon: CircleCheck, role: "status" },
  info: { className: "bg-raised text-ink", icon: Info, role: "status" },
};

/** Un aviso: error (se anuncia en voz alta), éxito o información. */
export function Notice({ tone = "info", className, children }) {
  const { className: toneClass, icon: Icon, role } = TONES[tone];
  return (
    <p role={role} className={cx("flex items-start gap-2 rounded-card p-3 text-sm font-semibold", toneClass, className)}>
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Cuando una lista está vacía: una frase que diga qué saldrá aquí (y, si hace falta, una acción). */
export function EmptyState({ children, action, className }) {
  return (
    <div className={cx("flex flex-col items-start gap-3 rounded-card bg-raised p-4 text-sm text-ink-muted", className)}>
      <p>{children}</p>
      {action}
    </div>
  );
}

const BADGES = {
  neutral: "bg-raised text-ink-muted",
  club: "bg-club text-on-club",
  rotta: "bg-rotta text-on-rotta",
  voy: "bg-voy text-snow",
  danger: "bg-danger text-snow",
};

/** Etiqueta pequeña (tipo, estado, contador). Texto de 12 px como mínimo. */
export function Badge({ tone = "neutral", className, children }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold", BADGES[tone], className)}>{children}</span>;
}
