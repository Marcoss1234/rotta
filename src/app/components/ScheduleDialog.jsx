import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { WEEKDAY_SHORT, WEEKDAY_NAMES } from "@/app/teams.js";

const timeClass =
  "min-h-11 w-full rounded-lg border border-white/20 bg-void px-3 text-base text-white focus:border-white focus:outline-none disabled:opacity-40";
const primaryClass = "min-h-11 rounded-full bg-tnt px-4 text-sm font-bold text-onbrand disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "min-h-11 rounded-full border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";

// Un horario en el formulario: sin hora se guarda como "Horario por consultar".
const toForm = (session) => ({ days: session.days, start: session.start ?? "", end: session.end ?? "", noTime: session.start === null });

// Horario de entrenamiento de un equipo: qué días y a qué hora. Puede tener varios (por ejemplo,
// lunes a una hora y jueves a otra), pero cada día solo en uno.
export default function ScheduleDialog({ teamName, sessions, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [rows, setRows] = useState(() => sessions.map(toForm));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const change = (index, patch) => setRows((current) => current.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const usedElsewhere = (index, day) => rows.some((row, at) => at !== index && row.days.includes(day));
  const toggleDay = (index, day) =>
    setRows((current) =>
      current.map((row, at) =>
        at === index
          ? { ...row, days: row.days.includes(day) ? row.days.filter((item) => item !== day) : [...row.days, day].sort((a, b) => a - b) }
          : row,
      ),
    );

  const problem = (() => {
    if (rows.some((row) => row.days.length === 0)) return "Marca al menos un día en cada horario.";
    if (rows.some((row) => !row.noTime && (!row.start || !row.end))) return "Pon la hora de empezar y de acabar.";
    if (rows.some((row) => !row.noTime && row.end <= row.start)) return "El entrenamiento tiene que acabar después de empezar.";
    return "";
  })();

  const save = async (event) => {
    event.preventDefault();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(rows.map((row) => ({ days: row.days, start: row.noTime ? null : row.start, end: row.noTime ? null : row.end })));
    } catch (saveError) {
      setError(saveError.message);
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="schedule-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-panel p-5 font-body text-white backdrop:bg-black/70"
    >
      <form onSubmit={save} className="space-y-5">
        <div>
          <h2 id="schedule-title" className="font-display text-2xl font-extrabold leading-tight">Horario de entrenamiento</h2>
          <p className="mt-1 text-sm text-zinc-400">{teamName}. Lo ve todo el equipo y es el que se usa para confirmar asistencia.</p>
        </div>

        {rows.map((row, index) => (
          <fieldset key={index} className="space-y-3 rounded-xl border border-white/10 bg-void/50 p-3">
            <legend className="sr-only">Horario {index + 1}</legend>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-300">Días</p>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
                  aria-label={`Quitar el horario ${index + 1}`}
                  className="-mr-1 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-red-300"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_SHORT.map((short, day) => {
                const on = row.days.includes(day);
                const taken = usedElsewhere(index, day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    aria-label={WEEKDAY_NAMES[day]}
                    disabled={taken}
                    onClick={() => toggleDay(index, day)}
                    className={`min-h-11 rounded-full text-sm font-bold disabled:opacity-25 ${on ? "bg-tnt text-onbrand" : "border border-white/15 text-zinc-200 hover:bg-white/5"}`}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Empieza</span>
                <input type="time" value={row.start} disabled={row.noTime} onChange={(event) => change(index, { start: event.target.value })} className={timeClass} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Acaba</span>
                <input type="time" value={row.end} disabled={row.noTime} onChange={(event) => change(index, { end: event.target.value })} className={timeClass} />
              </label>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={row.noTime} onChange={(event) => change(index, { noTime: event.target.checked })} className="h-5 w-5 accent-tnt" />
              Sin hora fija («Horario por consultar»)
            </label>
          </fieldset>
        ))}

        {rows.length < 7 && (
          <button
            type="button"
            onClick={() => setRows((current) => [...current, { days: [], start: "", end: "", noTime: false }])}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-ember hover:bg-white/5"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Otro horario (otros días a otra hora)
          </button>
        )}

        {error && <p role="alert" className="rounded-lg border border-red-300/50 p-3 text-sm font-semibold text-red-200">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryClass}>Cancelar</button>
          <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Guardando…" : "Guardar horario"}</button>
        </div>
      </form>
    </dialog>
  );
}
