import { MapPin, Navigation, StickyNote } from "lucide-react";

const fromIso = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// Hoja de calendario: día de la semana, número y mes. Cabecera roja y hoja blanca, como uno de verdad.
export function DateBadge({ iso }) {
  const date = fromIso(iso);
  const today = iso === new Date().toLocaleDateString("sv-SE");
  const weekday = today ? "Hoy" : date.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "");
  const month = date.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  return (
    <div className="w-14 shrink-0 overflow-hidden rounded-xl bg-[#FAFAFA] text-center shadow-sm ring-1 ring-black/10" aria-hidden="true">
      <p className="bg-red-600 py-0.5 text-[10px] font-bold text-snow">{weekday}</p>
      <p className="font-display text-2xl font-extrabold leading-8 text-[#18181B]">{date.getDate()}</p>
      <p className="pb-1 text-[10px] font-semibold text-[#71717A]">{month}</p>
    </div>
  );
}

// Dónde: la dirección y un botón para abrir el mapa.
export function EventPlace({ place, url }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-void/60 p-2 pl-3">
      <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-ember" />
      <p className="min-w-0 flex-1 text-sm text-zinc-200">{place}</p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold text-zinc-900 hover:bg-zinc-200"
        >
          <Navigation aria-hidden="true" className="h-4 w-4" />
          Cómo llegar
        </a>
      )}
    </div>
  );
}

export function MatchNotes({ notes }) {
  return (
    <p className="flex gap-2 whitespace-pre-wrap break-words rounded-xl border border-white/10 p-3 text-sm text-zinc-300">
      <StickyNote aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
      {notes}
    </p>
  );
}
