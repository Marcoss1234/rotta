import { MapPin, Navigation, StickyNote } from "lucide-react";
import { LinkButton } from "@/app/ui/index.js";

const fromIso = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// Hoja de calendario: día de la semana, número y mes. Cabecera roja (el rojo de calendario, igual en todos los
// temas) y la hoja con la tarjeta del tema; los números, con los del tema. Textos de 12 px como mínimo.
export function DateBadge({ iso }) {
  const date = fromIso(iso);
  const today = iso === new Date().toLocaleDateString("sv-SE");
  const weekday = today ? "Hoy" : date.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "");
  const month = date.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  return (
    <div className="w-14 shrink-0 overflow-hidden rounded-field bg-card text-center shadow-card ring-1 ring-line" aria-hidden="true">
      <p className="bg-calendar py-0.5 text-xs font-bold leading-4 text-snow">{weekday}</p>
      <p className="font-score text-2xl leading-8 text-ink">{date.getDate()}</p>
      <p className="pb-1 text-xs font-semibold leading-4 text-ink-muted">{month}</p>
    </div>
  );
}

// Dónde: la dirección y un botón para abrir el mapa. Va dentro de una tarjeta: fondo de relleno del tema y el
// icono en el segundo color del club (ajustado para verse).
// compact: en una sola línea, sin recuadro (debajo de la hora en el escenario de Inicio).
export function EventPlace({ place, url, compact = false }) {
  if (compact) {
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-sm text-ink-muted">
        <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">{place}</span>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-control px-2 font-semibold text-ink underline-offset-2 transition-ui hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text">
            <Navigation aria-hidden="true" className="h-3.5 w-3.5" />
            Cómo llegar
          </a>
        )}
      </p>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-field bg-raised p-2 pl-3">
      <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted" />
      <p className="min-w-0 flex-1 text-sm text-ink">{place}</p>
      {url && (
        <LinkButton href={url} target="_blank" rel="noopener noreferrer" size="sm" icon={Navigation}>
          Cómo llegar
        </LinkButton>
      )}
    </div>
  );
}

export function MatchNotes({ notes }) {
  return (
    <p className="flex gap-2 whitespace-pre-wrap break-words rounded-field border border-line p-3 text-sm text-ink-muted">
      <StickyNote aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
      {notes}
    </p>
  );
}
