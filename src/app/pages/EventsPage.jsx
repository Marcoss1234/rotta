import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { createEvent, deleteEvent, getCalendar, updateEvent } from "@/app/api.js";
import EventDialog from "@/app/components/EventDialog.jsx";
import { DateBadge, EventPlace, MatchNotes } from "@/app/components/MatchInfo.jsx";
import { RankingHero } from "@/app/components/RankingVisuals.jsx";
import { localToday, placeInfo } from "@/app/matches.js";
import { MATCH_TEAM_PHRASE } from "@/app/teams.js";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const PILLS_PER_DAY = 2;

const pad = (number) => String(number).padStart(2, "0");
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function shiftMonth(month, by) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + by, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function monthTitle(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return capitalize(new Date(year, monthNumber - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
}

function dayTitle(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return capitalize(new Date(year, month - 1, day).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }));
}

// Los huecos del principio colocan el día 1 debajo de su día de la semana.
function monthCells(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const blanks = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, monthNumber, 0).getDate();
  return [...Array(blanks).fill(null), ...Array.from({ length: days }, (_, index) => `${month}-${pad(index + 1)}`)];
}

const isMatch = (item) => item.type === "match";
const pillClass = (item) => (isMatch(item) ? "bg-tnt/30 text-orange-100" : "bg-sky-400/25 text-sky-100");

function DayCell({ iso, items, selected, onSelect }) {
  const today = iso === localToday();
  const day = Number(iso.slice(8));
  const extra = items.length - PILLS_PER_DAY;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${dayTitle(iso)}${items.length ? `: ${items.map((item) => (isMatch(item) ? "partido" : item.title)).join(", ")}` : ", nada"}`}
      onClick={() => onSelect(iso)}
      className={`flex min-h-[5.25rem] min-w-0 flex-col gap-0.5 rounded-lg border p-0.5 text-left transition-colors md:min-h-28 md:p-1.5 ${
        selected ? "border-white bg-white/10" : items.length ? "border-white/15 bg-panel hover:border-white/40" : "border-white/5 bg-panel/50 hover:border-white/20"
      }`}
    >
      <span className={`flex h-6 w-6 items-center justify-center rounded-full font-display text-sm font-black ${today ? "bg-tnt text-onbrand" : items.length ? "text-white" : "text-zinc-500"}`}>
        {day}
      </span>
      {items.slice(0, PILLS_PER_DAY).map((item) => (
        <span key={item.id} className={`block overflow-hidden whitespace-nowrap rounded px-0.5 py-0.5 text-[9.5px] font-bold leading-tight tracking-tight md:truncate md:px-1 md:text-xs md:tracking-normal ${pillClass(item)}`}>
          {isMatch(item) ? "Partido" : item.title}
        </span>
      ))}
      {extra > 0 && <span className="px-1 text-[10px] font-bold leading-tight text-zinc-300 md:text-xs">+{extra}</span>}
    </button>
  );
}

function AgendaRow({ item, canManage, onEdit }) {
  return (
    <li className={`space-y-2.5 rounded-xl border border-l-4 border-white/5 bg-panel p-3 ${isMatch(item) ? "border-l-tnt" : "border-l-sky-400"}`} data-testid="calendar-item">
      <div className="flex items-center gap-3">
        <DateBadge iso={item.date} />
        <div className="min-w-0 flex-1">
          <p className="break-words font-display text-lg font-black leading-tight">
            {isMatch(item) ? `Partido ${MATCH_TEAM_PHRASE[item.team_id]}` : item.title}
          </p>
          {isMatch(item) && <p className="mt-0.5 break-words text-sm font-semibold text-zinc-300">contra <span className="text-white">{item.opponent}</span></p>}
        </div>
        {item.time && <p className="shrink-0 font-display text-2xl font-black leading-none">{item.time}</p>}
        {!isMatch(item) && canManage && (
          <button type="button" onClick={() => onEdit(item)} aria-label={`Editar ${item.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/5 hover:text-white">
            <Pencil aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>
      {!isMatch(item) && item.location && <EventPlace place={placeInfo(item.location).label} url={placeInfo(item.location).url} />}
      {!isMatch(item) && item.notes && <MatchNotes notes={item.notes} />}
    </li>
  );
}

export default function EventsPage({ onAccessLost }) {
  const [month, setMonth] = useState(() => localToday().slice(0, 7));
  const [calendar, setCalendar] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCalendar(null);
    setError("");
    getCalendar(month)
      .then((data) => {
        if (!cancelled) setCalendar(data);
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (requestError.status === 401 || requestError.status === 403) onAccessLost();
        else setError(requestError.message);
      });
    return () => {
      cancelled = true;
    };
  }, [month, version, onAccessLost]);

  const goToMonth = (next) => {
    setSelected(null);
    setMonth(next);
  };

  // Un 401 o 403 al guardar significa que ha cambiado tu acceso; el resto se muestra en el formulario.
  const guarded = async (action) => {
    let saved;
    try {
      saved = await action();
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) onAccessLost();
      throw requestError;
    }
    setEditing(null);
    // Si el evento se ha guardado en otro mes, se va a ese mes para que se vea.
    if (saved && saved.date.slice(0, 7) !== month) goToMonth(saved.date.slice(0, 7));
    else setVersion((current) => current + 1);
  };

  const items = calendar?.items ?? [];
  const itemsOf = (iso) => items.filter((item) => item.date === iso);
  const listed = selected ? itemsOf(selected) : items;
  const today = localToday();
  const defaultDate = selected ?? (today.startsWith(month) ? today : `${month}-01`);
  const canManage = Boolean(calendar?.can_manage);
  const arrowClass = "flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/5";

  return (
    <div className="space-y-6">
      <RankingHero title="Eventos" subtitle="Calendario del club" stacked>
        {canManage && (
          <button type="button" onClick={() => setEditing({ event: null })} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-extrabold text-void hover:bg-zinc-200">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Añadir
          </button>
        )}
      </RankingHero>

      <section aria-label="Calendario" className="space-y-2">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-panel p-1">
          <button type="button" aria-label="Mes anterior" onClick={() => goToMonth(shiftMonth(month, -1))} className={arrowClass}>
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <h2 className="font-display text-xl font-black" aria-live="polite">{monthTitle(month)}</h2>
          <button type="button" aria-label="Mes siguiente" onClick={() => goToMonth(shiftMonth(month, 1))} className={arrowClass}>
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div aria-hidden="true" className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => <span key={day} className="text-center text-xs font-bold text-zinc-400">{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1" data-testid="calendar-grid">
          {monthCells(month).map((iso, index) => (
            iso
              ? <DayCell key={iso} iso={iso} items={itemsOf(iso)} selected={selected === iso} onSelect={(day) => setSelected((current) => (current === day ? null : day))} />
              : <span key={`hueco-${index}`} aria-hidden="true" />
          ))}
        </div>
      </section>

      {error && <p role="alert" className="rounded-lg border border-red-300/50 bg-panel p-3 text-sm font-semibold text-red-200">{error}</p>}
      {!error && !calendar && <p role="status" className="text-zinc-300">Cargando…</p>}

      {calendar && (
        <section aria-labelledby="agenda-title" className="space-y-2">
          <div className="flex min-h-11 items-center justify-between gap-3 border-b border-white/15 pb-1">
            <h2 id="agenda-title" className="min-w-0 font-display text-lg font-black">{selected ? dayTitle(selected) : "Todo el mes"}</h2>
            {selected && (
              <button type="button" onClick={() => setSelected(null)} className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-zinc-300 hover:text-white">
                Ver el mes
              </button>
            )}
          </div>
          {listed.length === 0 ? (
            <p className="rounded-xl bg-panel p-4 text-sm text-zinc-400">{selected ? "No hay nada este día." : "No hay nada este mes."}</p>
          ) : (
            <ul className="space-y-2">
              {listed.map((item) => <AgendaRow key={item.id} item={item} canManage={canManage} onEdit={(event) => setEditing({ event })} />)}
            </ul>
          )}
        </section>
      )}

      {editing && (
        <EventDialog
          event={editing.event}
          defaultDate={defaultDate}
          onSave={(values) => guarded(() => (editing.event ? updateEvent(editing.event.id, values) : createEvent(values)))}
          onDelete={() => guarded(() => deleteEvent(editing.event.id))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
