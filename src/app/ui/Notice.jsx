import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cx } from "./cx.js";

// Los cuatro tonos, de más a menos urgente. Solo los errores se anuncian en voz alta con alert; el resto, con status.
// Etiquetas que solo admiten texto dentro (contenido «de frase»): con ellas, el interior va en un <span>.
// Con cualquier otra (div, section...), el interior es un <div> y puede llevar listas o párrafos.
const PHRASING = new Set(["p", "span", "label", "strong", "em", "small", "b"]);

const TONES = {
  error: { box: "bg-danger/10 text-danger-text ring-1 ring-inset ring-danger/30", inline: "text-danger-text", icon: CircleAlert, role: "alert" },
  warning: { box: "bg-warning/10 text-warning-text ring-1 ring-inset ring-warning/40", inline: "text-warning-text", icon: TriangleAlert, role: "status" },
  success: { box: "bg-voy/10 text-voy-text ring-1 ring-inset ring-voy/30", inline: "text-voy-text", icon: CircleCheck, role: "status" },
  info: { box: "bg-raised text-ink", inline: "text-ink-muted", icon: Info, role: "status" },
};

/**
 * Un aviso: error, advertencia, éxito o información.
 * - inline: sin recuadro (debajo de un campo, dentro de una fila o de un formulario corto).
 * - announce: false si es un aviso fijo que no aparece por algo que acaba de pasar (no se anuncia en voz alta).
 * - size: "sm" (12 px) donde no cabe más; "md" (14 px) por defecto.
 * - as: la etiqueta HTML. Con "p" (por defecto) el texto va en un <span>; con "div", en un <div>, así que puede
 *   llevar una lista sin anidar bloques dentro de texto.
 */
export function Notice({ tone = "info", inline = false, announce = true, size = "md", as: Tag = "p", className, children }) {
  const { box, inline: inlineClass, icon: Icon, role } = TONES[tone];
  const Body = PHRASING.has(Tag) ? "span" : "div";
  return (
    <Tag
      role={announce ? role : undefined}
      className={cx("flex items-start font-semibold", size === "sm" ? "gap-1.5 text-xs" : "gap-2 text-sm", inline ? inlineClass : cx("rounded-card p-3", box), className)}
    >
      <Icon aria-hidden="true" className={cx("shrink-0", size === "sm" ? "mt-px h-3.5 w-3.5" : "mt-0.5 h-4 w-4")} />
      <Body className="min-w-0">{children}</Body>
    </Tag>
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
