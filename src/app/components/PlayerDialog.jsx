import { useEffect, useRef, useState } from "react";
import { POSITIONS } from "@/app/roles.js";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/20 bg-void px-3 text-sm text-white placeholder-zinc-400 focus:border-white focus:outline-none";
const labelClass = "mb-1.5 block text-sm font-semibold text-zinc-300";

export default function PlayerDialog({ player, teams, defaultTeamId, onSave, onDelete, onClose }) {
  const dialogRef = useRef(null);
  const [form, setForm] = useState({
    name: player?.name ?? "",
    team_id: player?.team_id ?? defaultTeamId,
    position: player?.position ?? "Sin definir",
    number: player?.number ?? "",
    phone: player?.phone ?? "",
    email: player?.email ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (actionError) {
      setError(actionError.message);
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    run(() =>
      onSave({
        name: form.name.trim(),
        team_id: form.team_id,
        position: form.position,
        number: form.number === "" ? null : Number(form.number),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      }),
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="player-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-white/20 bg-panel p-5 font-body text-white backdrop:bg-black/70"
    >
      <h2 id="player-dialog-title" className="font-display text-2xl font-extrabold">
        {player ? "Editar jugador" : "Añadir jugador"}
      </h2>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="player-name" className={labelClass}>Nombre y apellidos</label>
          <input id="player-name" required minLength={2} maxLength={120} autoComplete="off" value={form.name} onChange={update("name")} className={fieldClass} />
        </div>

        <div>
          <label htmlFor="player-team" className={labelClass}>Equipo</label>
          <select id="player-team" value={form.team_id} disabled={player?.linked} onChange={update("team_id")} className={`${fieldClass} disabled:opacity-60`}>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          {player?.linked && <p className="mt-1.5 text-sm text-zinc-400">Tiene cuenta: su equipo se cambia desde Usuarios.</p>}
        </div>

        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div>
            <label htmlFor="player-position" className={labelClass}>Posición</label>
            <select id="player-position" value={form.position} onChange={update("position")} className={fieldClass}>
              {POSITIONS.map((position) => <option key={position}>{position}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="player-number" className={labelClass}>Dorsal</label>
            <input id="player-number" type="number" min={0} max={99} step={1} inputMode="numeric" value={form.number} onChange={update("number")} className={fieldClass} />
          </div>
        </div>

        <fieldset className="space-y-4 rounded-lg border border-white/10 p-3">
          <legend className="px-1 text-sm font-semibold text-zinc-300">Contacto (opcional)</legend>
          <p className="text-sm text-zinc-400">Solo lo ven entrenadores y administradores.</p>
          <div>
            <label htmlFor="player-phone" className={labelClass}>Teléfono</label>
            <input id="player-phone" type="tel" maxLength={30} autoComplete="off" pattern="\+?[0-9][0-9 ()\-]{5,28}" title="Solo números, espacios, guiones y paréntesis" value={form.phone} onChange={update("phone")} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="player-email" className={labelClass}>Correo</label>
            <input id="player-email" type="email" maxLength={254} autoComplete="off" value={form.email} onChange={update("email")} className={fieldClass} />
          </div>
        </fieldset>

        {error && <p role="alert" className="rounded-lg border border-red-300/50 p-3 text-sm font-semibold text-red-200">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-lg border border-white/30 text-sm font-semibold hover:bg-white/5 disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-tnt text-sm font-bold text-onbrand disabled:opacity-50">
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>

      {player?.linked && (
        <p className="mt-4 border-t border-white/10 pt-4 text-sm text-zinc-400">
          Para sacarlo de la plantilla, quítale el equipo o el acceso desde Usuarios.
        </p>
      )}

      {player && !player.linked && (
        <div className="mt-4 border-t border-white/10 pt-4">
          {confirmingDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-200">¿Eliminar a {player.name} de la plantilla? No se puede deshacer.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => setConfirmingDelete(false)} className="min-h-11 rounded-lg border border-white/30 text-sm font-semibold hover:bg-white/5 disabled:opacity-50">
                  No
                </button>
                <button type="button" disabled={busy} onClick={() => run(onDelete)} className="min-h-11 rounded-lg border border-red-300 text-sm font-bold text-red-200 hover:bg-red-300/10 disabled:opacity-50">
                  Sí, eliminar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmingDelete(true)} className="min-h-11 w-full rounded-lg text-sm font-semibold text-red-200 hover:bg-red-300/10 disabled:opacity-50">
              Eliminar de la plantilla
            </button>
          )}
        </div>
      )}
    </dialog>
  );
}
