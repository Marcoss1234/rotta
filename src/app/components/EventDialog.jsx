import { useState } from "react";
import { Button, Dialog, Field, Input, Notice, Textarea } from "@/app/ui/index.js";

export default function EventDialog({ event, defaultDate, onSave, onDelete, onClose }) {
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
    <Dialog title={editing ? "Editar evento" : "Nuevo evento"} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="event-title" label="Qué es">
          <Input id="event-title" value={form.title} onChange={set("title")} maxLength={80} required disabled={busy} placeholder="Cena de equipo" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="event-date" label="Día">
            <Input id="event-date" type="date" value={form.date} onChange={set("date")} required disabled={busy} />
          </Field>
          <Field id="event-time" label="Hora" optional>
            <Input id="event-time" type="time" value={form.time} onChange={set("time")} disabled={busy} />
          </Field>
        </div>
        <Field id="event-location" label="Lugar" optional>
          <Input id="event-location" value={form.location} onChange={set("location")} maxLength={300} disabled={busy} placeholder="Dirección o enlace de Maps" />
        </Field>
        <Field id="event-notes" label="Notas" optional>
          <Textarea id="event-notes" value={form.notes} onChange={set("notes")} maxLength={300} rows={2} disabled={busy} />
        </Field>

        {error && <Notice tone="error">{error}</Notice>}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button type="submit" busy={busy} busyLabel="Guardando…">{editing ? "Guardar" : "Crear evento"}</Button>
        </div>
      </form>

      {editing && (
        <div className="mt-5 border-t border-line pt-4">
          {confirmingDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-ink">¿Borrar este evento? No se puede deshacer.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => setConfirmingDelete(false)}>No</Button>
                <Button variant="danger" disabled={busy} onClick={() => run(onDelete)}>Sí, borrar</Button>
              </div>
            </div>
          ) : (
            <Button variant="danger-quiet" block disabled={busy} onClick={() => setConfirmingDelete(true)}>Borrar evento</Button>
          )}
        </div>
      )}
    </Dialog>
  );
}
