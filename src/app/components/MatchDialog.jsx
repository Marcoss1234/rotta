import { useEffect, useRef, useState } from "react";
import { localToday, MATCH_KINDS } from "@/app/matches.js";

const MAX_SETS = 5;
const EMPTY_SET = { us: "", them: "" };
const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/20 bg-void px-3 text-base text-white focus:border-white focus:outline-none";
const labelClass = "mb-1.5 block text-sm font-semibold text-zinc-300";
const primaryClass = "min-h-11 rounded-full bg-tnt px-4 text-sm font-bold text-onbrand disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "min-h-11 rounded-full border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";

// En el ordenador el calendario solo se abría tocando el icono: así se abre al pulsar en cualquier parte.
function openCalendar(event) {
  try {
    event.currentTarget.showPicker?.();
  } catch {
    // Si el navegador no deja abrirlo así, sigue funcionando su forma normal.
  }
}

export default function MatchDialog({ match, teams, defaultTeamId, onSave, onDelete, onClose }) {
  const dialogRef = useRef(null);
  const editing = Boolean(match);
  const [form, setForm] = useState(() => ({
    team_id: match?.team_id ?? defaultTeamId,
    date: match?.date ?? localToday(),
    time: match?.time ?? "18:00",
    opponent: match?.opponent ?? "",
    kind: match?.kind ?? "amistoso",
    location: match?.location ?? "",
    notes: match?.notes ?? "",
  }));
  const [sets, setSets] = useState(() =>
    match?.sets?.length ? match.sets.map(({ us, them }) => ({ us: String(us), them: String(them) })) : [EMPTY_SET, EMPTY_SET, EMPTY_SET],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const setPoints = (index, side) => (event) => {
    const value = event.target.value.replace(/\D/g, "");
    setSets((current) => current.map((item, position) => (position === index ? { ...item, [side]: value } : item)));
  };

  // Al crear un partido para hoy aún no se ha jugado; al editarlo, puede que acabe de terminar.
  const today = localToday();
  const showResult = form.date < today || (editing && form.date === today);

  // Los sets que se dejan en blanco no cuentan.
  const readSets = () => {
    const result = [];
    for (const [index, { us, them }] of sets.entries()) {
      if (!us && !them) continue;
      if (!us || !them) return { problem: `Faltan puntos en el set ${index + 1}` };
      if (Number(us) === Number(them)) return { problem: `El set ${index + 1} no puede acabar empatado` };
      result.push({ us: Number(us), them: Number(them) });
    }
    return { result };
  };

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (saveError) {
      setError(saveError.message);
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.opponent.trim()) {
      setError("Escribe contra quién se juega");
      return;
    }
    const { problem, result } = showResult ? readSets() : { result: [] };
    if (problem) {
      setError(problem);
      return;
    }
    const { team_id: teamId, ...rest } = form;
    const data = { ...rest, sets: result };
    run(() => onSave(editing ? data : { team_id: teamId, ...data }));
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="match-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-white/20 bg-panel p-5 font-body text-white backdrop:bg-black/70"
    >
      <h2 id="match-dialog-title" className="font-display text-2xl font-extrabold">{editing ? "Editar partido" : "Nuevo partido"}</h2>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {!editing && (
          <div>
            <label htmlFor="match-team" className={labelClass}>Equipo</label>
            <select id="match-team" value={form.team_id} onChange={set("team_id")} disabled={busy} className={fieldClass}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="match-opponent" className={labelClass}>Rival</label>
          <input id="match-opponent" value={form.opponent} onChange={set("opponent")} maxLength={80} required disabled={busy} className={fieldClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="match-date" className={labelClass}>Día</label>
            <input id="match-date" type="date" value={form.date} onChange={set("date")} onClick={openCalendar} required disabled={busy} className={`${fieldClass} cursor-pointer [color-scheme:dark]`} />
          </div>
          <div>
            <label htmlFor="match-time" className={labelClass}>Hora</label>
            <input id="match-time" type="time" value={form.time} onChange={set("time")} required disabled={busy} className={fieldClass} />
          </div>
        </div>
        <div>
          <label htmlFor="match-kind" className={labelClass}>Tipo</label>
          <select id="match-kind" value={form.kind} onChange={set("kind")} disabled={busy} className={fieldClass}>
            {MATCH_KINDS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="match-location" className={labelClass}>Lugar <span className="font-normal text-zinc-400">(opcional)</span></label>
          <input id="match-location" value={form.location} onChange={set("location")} maxLength={300} disabled={busy} placeholder="Pabellón, dirección o enlace de Maps" aria-describedby="match-location-hint" className={fieldClass} />
          <p id="match-location-hint" className="mt-1 text-xs text-zinc-400">Escribe la dirección con el pueblo, o pega el enlace de Google Maps que te hayan pasado.</p>
        </div>
        <div>
          <label htmlFor="match-notes" className={labelClass}>Notas <span className="font-normal text-zinc-400">(opcional)</span></label>
          <textarea id="match-notes" value={form.notes} onChange={set("notes")} maxLength={300} rows={2} disabled={busy} placeholder="Hora de quedar, equipación…" className={`${fieldClass} py-2.5`} />
        </div>

        {showResult && (
          <fieldset disabled={busy} data-testid="match-result-fields">
            <legend className={labelClass}>Resultado por sets <span className="font-normal text-zinc-400">(opcional)</span></legend>
            <div className="grid grid-cols-[3.25rem_1fr_1fr] items-center gap-2">
              <span aria-hidden="true" />
              <span aria-hidden="true" className="text-center text-xs font-bold text-ember">Club</span>
              <span aria-hidden="true" className="text-center text-xs font-bold text-zinc-400">Rival</span>
              {sets.map((item, index) => (
                <div key={index} className="contents">
                  <span className="text-sm font-semibold text-zinc-300">Set {index + 1}</span>
                  <input aria-label={`Set ${index + 1}, puntos de Club`} inputMode="numeric" maxLength={2} value={item.us} onChange={setPoints(index, "us")} className={`${fieldClass} text-center font-bold`} />
                  <input aria-label={`Set ${index + 1}, puntos del rival`} inputMode="numeric" maxLength={2} value={item.them} onChange={setPoints(index, "them")} className={`${fieldClass} text-center font-bold`} />
                </div>
              ))}
            </div>
            {sets.length < MAX_SETS && (
              <button type="button" onClick={() => setSets((current) => [...current, EMPTY_SET])} className="mt-2 min-h-11 w-full rounded-full text-sm font-semibold text-white hover:bg-white/5">
                Añadir set
              </button>
            )}
          </fieldset>
        )}

        {error && <p role="alert" className="rounded-lg border border-red-300/50 p-3 text-sm font-semibold text-red-200">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onClose} className={secondaryClass}>Cancelar</button>
          <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Guardando…" : editing ? "Guardar" : "Crear partido"}</button>
        </div>
      </form>

      {editing && (
        <div className="mt-4 border-t border-white/10 pt-4">
          {confirmingDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-200">¿Borrar este partido? También se borrarán las respuestas de quién va.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => setConfirmingDelete(false)} className={secondaryClass}>No</button>
                <button type="button" disabled={busy} onClick={() => run(onDelete)} className="min-h-11 rounded-full border border-red-300 px-4 text-sm font-bold text-red-200 hover:bg-red-300/10 disabled:opacity-50">
                  Sí, borrar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmingDelete(true)} className="min-h-11 w-full rounded-full text-sm font-semibold text-red-200 hover:bg-red-300/10 disabled:opacity-50">
              Borrar partido
            </button>
          )}
        </div>
      )}
    </dialog>
  );
}
