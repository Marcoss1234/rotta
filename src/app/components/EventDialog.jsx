import { useEffect, useRef, useState } from "react";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/20 bg-void px-3 text-base text-white focus:border-white focus:outline-none";
const labelClass = "mb-1.5 block text-sm font-semibold text-zinc-300";
const primaryClass = "min-h-11 rounded-full bg-tnt px-4 text-sm font-bold text-onbrand disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "min-h-11 rounded-full border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";
const optional = <span className="font-normal text-zinc-400">(opcional)</span>;

export default function EventDialog({ event, defaultDate, onSave, onDelete, onClose }) {
  const dialogRef = useRef(null);
  const editing = Boolean(event);
  const [form, setForm] = useState(() => ({
    title: event?.title ?? "",
    date: event?.date ?? defaultDate,
    time: event?.time ?? "",
    location: event?.location ?? "",
    notes: event?.notes ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const set = (field) => (changeEvent) => setForm((current) => ({ ...current, [field]: changeEvent.target.value }));

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

  const submit = (submitEvent) => {
    submitEvent.preventDefault();
    if (!form.title.trim()) {
      setError("Escribe qué evento es");
      return;
    }
    run(() => onSave(form));
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="event-dialog-title"
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-white/20 bg-panel p-5 font-body text-white backdrop:bg-black/70"
    >
      <h2 id="event-dialog-title" className="font-display text-2xl font-extrabold">{editing ? "Editar evento" : "Nuevo evento"}</h2>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="event-title" className={labelClass}>Qué es</label>
          <input id="event-title" value={form.title} onChange={set("title")} maxLength={80} required disabled={busy} placeholder="Cena de equipo" className={fieldClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="event-date" className={labelClass}>Día</label>
            <input id="event-date" type="date" value={form.date} onChange={set("date")} required disabled={busy} className={`${fieldClass} [color-scheme:dark]`} />
          </div>
          <div>
            <label htmlFor="event-time" className={labelClass}>Hora {optional}</label>
            <input id="event-time" type="time" value={form.time} onChange={set("time")} disabled={busy} className={`${fieldClass} [color-scheme:dark]`} />
          </div>
        </div>
        <div>
          <label htmlFor="event-location" className={labelClass}>Lugar {optional}</label>
          <input id="event-location" value={form.location} onChange={set("location")} maxLength={300} disabled={busy} placeholder="Dirección o enlace de Maps" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="event-notes" className={labelClass}>Notas {optional}</label>
          <textarea id="event-notes" value={form.notes} onChange={set("notes")} maxLength={300} rows={2} disabled={busy} className={`${fieldClass} py-2.5`} />
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-300/50 p-3 text-sm font-semibold text-red-200">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onClose} className={secondaryClass}>Cancelar</button>
          <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Guardando…" : editing ? "Guardar" : "Crear evento"}</button>
        </div>
      </form>

      {editing && (
        <div className="mt-4 border-t border-white/10 pt-4">
          {confirmingDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-200">¿Borrar este evento?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => setConfirmingDelete(false)} className={secondaryClass}>No</button>
                <button type="button" disabled={busy} onClick={() => run(onDelete)} className="min-h-11 rounded-full border border-red-300 px-4 text-sm font-bold text-red-200 hover:bg-red-300/10 disabled:opacity-50">
                  Sí, borrar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmingDelete(true)} className="min-h-11 w-full rounded-full text-sm font-semibold text-red-200 hover:bg-red-300/10 disabled:opacity-50">
              Borrar evento
            </button>
          )}
        </div>
      )}
    </dialog>
  );
}
