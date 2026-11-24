import { useState } from "react";
import { Plus } from "lucide-react";
import { localToday, MATCH_KINDS } from "@/app/matches.js";
import { Button, Dialog, Field, Input, Notice, Select, Textarea } from "@/app/ui/index.js";

const MAX_SETS = 5;
const EMPTY_SET = { us: "", them: "" };

// En el ordenador el calendario solo se abría tocando el icono: así se abre al pulsar en cualquier parte.
function openCalendar(event) {
  try {
    event.currentTarget.showPicker?.();
  } catch {
    // Si el navegador no deja abrirlo así, sigue funcionando su forma normal.
  }
}

const LOCATION_HINT = "Escribe la dirección con el pueblo, o pega el enlace de Google Maps que te hayan pasado.";

export default function MatchDialog({ match, teams, defaultTeamId, onSave, onDelete, onClose }) {
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
    <Dialog title={editing ? "Editar partido" : "Nuevo partido"} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-4">
          {!editing && (
            <Field id="match-team" label="Equipo">
              <Select id="match-team" value={form.team_id} onChange={set("team_id")} disabled={busy}>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </Select>
            </Field>
          )}
          <Field id="match-opponent" label="Rival">
            <Input id="match-opponent" value={form.opponent} onChange={set("opponent")} maxLength={80} required disabled={busy} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="match-date" label="Día">
              <Input id="match-date" type="date" value={form.date} onChange={set("date")} onClick={openCalendar} required disabled={busy} className="cursor-pointer" />
            </Field>
            <Field id="match-time" label="Hora">
              <Input id="match-time" type="time" value={form.time} onChange={set("time")} required disabled={busy} />
            </Field>
          </div>
          <Field id="match-kind" label="Tipo">
            <Select id="match-kind" value={form.kind} onChange={set("kind")} disabled={busy}>
              {MATCH_KINDS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field id="match-location" label="Lugar" optional hint={LOCATION_HINT}>
            <Input id="match-location" value={form.location} onChange={set("location")} maxLength={300} disabled={busy} placeholder="Pabellón, dirección o enlace de Maps" hint={LOCATION_HINT} />
          </Field>
          <Field id="match-notes" label="Notas" optional>
            <Textarea id="match-notes" value={form.notes} onChange={set("notes")} maxLength={300} rows={2} disabled={busy} placeholder="Hora de quedar, equipación…" />
          </Field>
        </div>

        {showResult && (
          <fieldset disabled={busy} data-testid="match-result-fields" className="space-y-2 border-t border-line pt-4">
            <legend className="float-left mb-2 w-full text-sm font-semibold text-ink">
              Resultado por sets <span className="font-normal text-ink-muted">(opcional)</span>
            </legend>
            <div className="clear-left grid grid-cols-[3.25rem_1fr_1fr] items-center gap-2">
              <span aria-hidden="true" />
              <span aria-hidden="true" className="text-center text-xs font-bold text-club-label">Club</span>
              <span aria-hidden="true" className="text-center text-xs font-bold text-ink-muted">Rival</span>
              {sets.map((item, index) => (
                <div key={index} className="contents">
                  <span className="text-sm font-semibold text-ink-muted">Set {index + 1}</span>
                  <Input aria-label={`Set ${index + 1}, puntos de Club`} inputMode="numeric" maxLength={2} value={item.us} onChange={setPoints(index, "us")} className="font-score text-center text-lg" />
                  <Input aria-label={`Set ${index + 1}, puntos del rival`} inputMode="numeric" maxLength={2} value={item.them} onChange={setPoints(index, "them")} className="font-score text-center text-lg" />
                </div>
              ))}
            </div>
            {sets.length < MAX_SETS && (
              <Button variant="quiet" icon={Plus} block onClick={() => setSets((current) => [...current, EMPTY_SET])}>
                Añadir set
              </Button>
            )}
          </fieldset>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button type="submit" busy={busy} busyLabel="Guardando…">{editing ? "Guardar" : "Crear partido"}</Button>
        </div>
      </form>

      {editing && (
        <div className="mt-5 border-t border-line pt-4">
          {confirmingDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-ink">¿Borrar este partido? También se borrarán las respuestas de quién va.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => setConfirmingDelete(false)}>No</Button>
                <Button variant="danger" disabled={busy} onClick={() => run(onDelete)}>Sí, borrar</Button>
              </div>
            </div>
          ) : (
            <Button variant="danger-quiet" block disabled={busy} onClick={() => setConfirmingDelete(true)}>Borrar partido</Button>
          )}
        </div>
      )}
    </Dialog>
  );
}
