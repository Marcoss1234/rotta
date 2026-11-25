import { useState } from "react";
import { POSITIONS } from "@/app/roles.js";
import { Button, Dialog, Field, Input, Notice, Select } from "@/app/ui/index.js";

// Las mismas reglas que el servidor (backend/players.py), para avisar en el campo antes de enviar.
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,28}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMBER_PATTERN = /^\d{1,2}$/;
const LINKED_TEAM_HINT = "Tiene cuenta en la app: su equipo se cambia desde Usuarios.";
const MOVE_HINT = "Si cambia de equipo, empieza en el banquillo de su nuevo equipo.";

const initialForm = (player, defaultTeamId) => ({
  name: player?.name ?? "",
  team_id: player?.team_id ?? defaultTeamId,
  position: player?.position ?? "Sin definir",
  number: player?.number ?? "",
  phone: player?.phone ?? "",
  email: player?.email ?? "",
});

/**
 * Los datos limpios del formulario (sin espacios de más, vacío = null) y los errores de cada campo.
 * Se exporta para probarlo aparte.
 */
export function readPlayerForm(form) {
  const name = form.name.trim().replace(/\s+/g, " ");
  const number = String(form.number).trim();
  const phone = form.phone.trim();
  const email = form.email.trim();
  const errors = {};
  if (name.length < 2) errors.name = "Escribe su nombre y apellidos";
  if (number && !NUMBER_PATTERN.test(number)) errors.number = "Del 0 al 99";
  if (phone && !PHONE_PATTERN.test(phone)) errors.phone = "Solo números, espacios, guiones y paréntesis (al menos 7 cifras)";
  if (email && !EMAIL_PATTERN.test(email)) errors.email = "Revisa el correo";
  return {
    errors,
    values: {
      name,
      team_id: form.team_id,
      position: form.position,
      number: number === "" ? null : Number(number),
      phone: phone || null,
      email: email ? email.toLowerCase() : null,
    },
  };
}

// Al editar solo se manda lo que ha cambiado (así no se pisa lo que otro haya tocado a la vez).
const changedValues = (player, values) =>
  Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== (player[key] ?? null)));

/**
 * Añadir o editar un jugador de la plantilla (solo entrenadores y administradores).
 * player: null para añadir. Si tiene cuenta (`linked`), el equipo no se cambia aquí sino desde Usuarios.
 * onSave(datos) recibe todo al crear y solo lo cambiado al editar; onDelete (opcional) para quitarlo.
 */
export default function PlayerDialog({ player, teams, defaultTeamId, onSave, onDelete = null, onClose }) {
  const editing = Boolean(player);
  const linked = Boolean(player?.linked);
  const [form, setForm] = useState(() => initialForm(player, defaultTeamId));
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };
  const update = (key) => (event) => setValue(key, event.target.value);

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (actionError) {
      // Dorsal repetido: el aviso va en su campo.
      if (actionError.status === 409 && /dorsal/i.test(actionError.message)) setFieldErrors((current) => ({ ...current, number: actionError.message }));
      else setError(actionError.message);
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    const { errors, values } = readPlayerForm(form);
    setFieldErrors(errors);
    setError("");
    if (Object.keys(errors).length > 0) return;
    if (!editing) {
      run(() => onSave(values));
      return;
    }
    const changes = changedValues(player, values);
    if (linked) delete changes.team_id;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    run(() => onSave(changes));
  };

  const firstName = player?.name.split(" ")[0];
  const teamHint = linked ? LINKED_TEAM_HINT : editing ? MOVE_HINT : undefined;

  return (
    <Dialog
      title={editing ? "Editar jugador" : "Añadir jugador"}
      description={editing ? player.name : "Entra en la plantilla del equipo que elijas."}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="space-y-4">
          <Field id="player-name" label="Nombre y apellidos" error={fieldErrors.name}>
            <Input id="player-name" value={form.name} onChange={update("name")} maxLength={120} autoComplete="off" required disabled={busy} error={fieldErrors.name} />
          </Field>

          <Field id="player-team" label="Equipo" hint={teamHint}>
            <Select id="player-team" value={form.team_id} onChange={update("team_id")} disabled={busy || linked} hint={teamHint}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </Select>
          </Field>

          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
            <Field id="player-position" label="Posición">
              <Select id="player-position" value={form.position} onChange={update("position")} disabled={busy}>
                {POSITIONS.map((position) => <option key={position}>{position}</option>)}
              </Select>
            </Field>
            <Field id="player-number" label="Dorsal" error={fieldErrors.number}>
              <Input
                id="player-number"
                inputMode="numeric"
                maxLength={2}
                autoComplete="off"
                value={form.number}
                onChange={(event) => setValue("number", event.target.value.replace(/\D/g, ""))}
                disabled={busy}
                error={fieldErrors.number}
                className="font-display text-lg font-bold tabular-nums"
              />
            </Field>
          </div>
        </div>

        <fieldset disabled={busy} className="space-y-4 border-t border-line pt-4">
          <legend className="float-left w-full">
            <span className="block text-sm font-semibold text-ink">
              Contacto <span className="font-normal text-ink-muted">(opcional)</span>
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">Solo lo ven entrenadores y administradores.</span>
          </legend>
          <div className="clear-left space-y-4 pt-1">
            <Field id="player-phone" label="Teléfono" error={fieldErrors.phone}>
              <Input id="player-phone" type="tel" inputMode="tel" maxLength={30} autoComplete="off" value={form.phone} onChange={update("phone")} error={fieldErrors.phone} />
            </Field>
            <Field id="player-email" label="Correo" error={fieldErrors.email}>
              <Input id="player-email" type="email" inputMode="email" maxLength={254} autoComplete="off" value={form.email} onChange={update("email")} error={fieldErrors.email} />
            </Field>
          </div>
        </fieldset>

        {error && <Notice tone="error">{error}</Notice>}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button type="submit" busy={busy} busyLabel="Guardando…">{editing ? "Guardar" : "Añadir"}</Button>
        </div>
      </form>

      {editing && onDelete && (
        <div className="mt-5 border-t border-line pt-4">
          {linked ? (
            <Notice tone="info" announce={false} size="sm">Para sacarlo de la plantilla, quítale el equipo o el acceso desde Usuarios.</Notice>
          ) : confirmingDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-ink">¿Quitar a {firstName} de la plantilla? No se puede deshacer.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => setConfirmingDelete(false)}>No</Button>
                <Button variant="danger" disabled={busy} onClick={() => run(onDelete)}>Sí, quitar</Button>
              </div>
            </div>
          ) : (
            <Button variant="danger-quiet" block disabled={busy} onClick={() => setConfirmingDelete(true)}>Quitar de la plantilla</Button>
          )}
        </div>
      )}
    </Dialog>
  );
}
