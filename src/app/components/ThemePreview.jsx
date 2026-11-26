import { Check, ChevronDown, X } from "lucide-react";
import { buildRottaTheme, mix } from "@/app/theme.js";

// Vista previa de un tema de Rotta con los colores del club, en claro o en oscuro.
// No es una muestra aparte: sale de buildRottaTheme, lo mismo que pinta la app (fondos, textos, color de Rotta,
// color del club ya ajustado, esquinas, números, «Voy», la barra de la nota y el banner del directo).
// Va con estilos propios (no con las clases de la app) para poder enseñar otro tema y otro modo a la vez.

const TRACK = 0.12; // la pista de las barras, igual que .rating-range en index.css

function MiniCrest({ theme, size = 22 }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-extrabold"
      style={{ width: size, height: size, background: theme.club, color: theme.onClub, fontSize: size * 0.4, boxShadow: theme.warnings.includes("colorless") ? `inset 0 0 0 1.5px ${theme.text}` : undefined }}
    >
      CV
      <span className="absolute inset-x-0 bottom-0" style={{ height: "22%", background: theme.stripe }} />
    </span>
  );
}

/** La vista grande: cómo se verá la app. `compact` es la versión pequeña de cada opción del selector. */
export default function ThemePreview({ style, mode, brand, accent, compact = false }) {
  const theme = buildRottaTheme(style, mode, brand, accent);
  const card = { background: theme.surface, borderRadius: theme.shape.card, boxShadow: `inset 0 0 0 1px ${theme.line}` };
  const control = theme.shape.control;
  const score = { fontFamily: '"Bricolage Grotesque", sans-serif', fontStretch: theme.numbers.width, fontWeight: theme.numbers.weight, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", lineHeight: 0.95 };

  if (compact) {
    return (
      <div aria-hidden="true" className="flex h-full flex-col gap-1.5 p-2" style={{ background: theme.bg, color: theme.text }}>
        <div className="h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${theme.club} 0 72%, ${theme.stripe} 72% 100%)` }} />
        <div className="flex flex-1 flex-col justify-between gap-1 p-1.5" style={card}>
          <span className="self-start px-1.5 text-[9px] font-bold leading-4" style={{ background: theme.rotta, color: theme.onRotta, borderRadius: control }}>en 35 min</span>
          <span style={{ ...score, fontSize: 22 }}>20:45</span>
          <span className="block h-3.5 text-center text-[9px] font-bold leading-[14px]" style={{ background: theme.success, color: "#FFFFFF", borderRadius: control }}>Voy</span>
        </div>
      </div>
    );
  }

  const fill = `linear-gradient(90deg, ${theme.clubUi}, ${theme.accentUi}) 0 / 62% 100% no-repeat, ${mix(theme.surface, theme.text, TRACK)}`;
  return (
    <div className="flex flex-col gap-2.5 overflow-hidden p-3 text-[12px] leading-snug" style={{ background: theme.bg, color: theme.text, fontFamily: '"Instrument Sans", sans-serif' }}>
      <div aria-hidden="true" className="-mx-3 -mt-3 h-1" style={{ background: `linear-gradient(90deg, ${theme.club} 0 72%, ${theme.stripe} 72% 100%)` }} />
      <div className="flex items-center gap-2">
        <MiniCrest theme={theme} />
        <span className="flex min-w-0 items-center gap-1 font-semibold">
          <span className="truncate">Sénior Femenino</span>
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" style={{ color: theme.muted }} />
        </span>
      </div>
      <div className="flex gap-1 p-0.5" style={{ background: theme.raised, borderRadius: control }}>
        <span className="flex flex-1 items-center justify-center gap-1 py-1 font-semibold" style={{ background: theme.clubSoft, borderRadius: control }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: theme.clubUi }} />
          Entrenos
        </span>
        <span className="flex flex-1 items-center justify-center py-1 font-semibold" style={{ color: theme.muted }}>Partidos</span>
      </div>
      <div className="flex flex-col gap-2 p-2.5" style={card}>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold" style={{ color: theme.muted }}>Próximo entreno</span>
          <span className="px-1.5 text-[10px] font-bold leading-4" style={{ background: theme.rotta, color: theme.onRotta, borderRadius: control }}>en 35 min</span>
        </div>
        <span style={{ ...score, fontSize: 34 }}>20:45</span>
        <div className="grid grid-cols-2 gap-1.5">
          <span className="flex min-h-8 items-center justify-center gap-1 font-bold" style={{ background: theme.success, color: "#FFFFFF", borderRadius: control }}>
            <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
            Voy
          </span>
          <span className="flex min-h-8 items-center justify-center gap-1 font-bold" style={{ boxShadow: `inset 0 0 0 1.5px ${theme.control}`, borderRadius: control }}>
            <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
            No voy
          </span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="font-semibold"><span style={{ color: theme.successText }}>7</span> van</span>
          <span className="font-semibold" style={{ color: theme.rottaText }}>Ver lista</span>
        </div>
        <div aria-hidden="true" className="h-1.5 rounded-full" style={{ background: fill }} />
        <span className="text-[11px] font-semibold" style={{ color: theme.accentText }}>REC · COL · LIB</span>
      </div>
      <div className="px-2.5 py-1.5 text-center font-bold" style={{ background: "#DC2626", color: "#FFFFFF", borderRadius: control }}>
        Partido en directo
      </div>
    </div>
  );
}
