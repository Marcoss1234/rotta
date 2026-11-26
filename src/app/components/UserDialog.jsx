import { useEffect, useRef, useState } from "react";
import { accountLabel, ROLES, roleLabel } from "@/app/roles.js";
import { Notice } from "@/app/ui/index.js";

const selectClass =
  "min-h-11 w-full rounded-lg border border-white/20 bg-void px-3 text-sm text-white focus:border-white focus:outline-none";
const labelClass = "mb-1.5 block text-sm font-semibold text-white/80";
const primaryClass = "min-h-11 rounded-full bg-brand px-4 text-sm font-bold text-onbrand disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "min-h-11 rounded-full border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";
const dangerClass =
  "min-h-11 rounded-full border border-red-300 px-4 text-sm font-bold text-red-200 hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-50";

function TemporaryPassword({ user, onCreate }) {
  const [state, setState] = useState("idle");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setState("busy");
    setError("");
    try {
      setPassword(await onCreate());
      setState("done");
    } catch (createError) {
      setError(createError.message);
      setState("confirming");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setError("No se ha podido copiar: selecciónala y cópiala a mano.");
    }
  };

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      {state === "idle" && (
        <button type="button" onClick={() => setState("confirming")} className="min-h-11 w-full rounded-full text-sm font-semibold text-white/60 hover:bg-white/5">
          ¿Ha olvidado su contraseña?
        </button>
      )}
      {(state === "confirming" || state === "busy") && (
        <div className="space-y-2">
          <p className="text-sm text-white/60">Se creará una contraseña temporal para {user.name}. La actual dejará de valer y se cerrarán sus sesiones.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={state === "busy"} onClick={() => setState("idle")} className={secondaryClass}>Cancelar</button>
            <button type="button" disabled={state === "busy"} onClick={create} className={primaryClass}>
              {state === "busy" ? "Creando…" : "Crear"}
            </button>
          </div>
        </div>
      )}
      {state === "done" && (
        <div className="space-y-2" data-testid="temporary-password">
          <p className="text-sm font-semibold text-white/60">Contraseña temporal de {user.username}:</p>
          <p className="select-all break-all rounded-lg bg-void p-3 font-mono text-base">{password}</p>
          <button type="button" onClick={copy} className={`${secondaryClass} w-full`}>{copied ? "Copiada" : "Copiar"}</button>
          <p className="text-xs leading-relaxed text-ink-muted">
            Pásasela solo a esa persona. No se volverá a mostrar, caduca en 48 horas y tendrá que cambiarla al entrar.
          </p>
        </div>
      )}
      {error && <Notice tone="error" inline className="mt-2">{error}</Notice>}
    </div>
  );
}

export default function UserDialog({ user, isSelf, teams, onSave, onCreateTemporaryPassword, onClose }) {
  const dialogRef = useRef(null);
  const [role, setRole] = useState(user.role ?? "");
  const [teamId, setTeamId] = useState(user.team_id ?? "");
  const [alsoPlays, setAlsoPlays] = useState(Boolean(user.also_plays));
  const [matchEditor, setMatchEditor] = useState(Boolean(user.match_editor));
  const [coached, setCoached] = useState(user.coached_team_ids ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  const isApproved = user.status === "approved";
  const isPending = user.status === "pending";
  const team = teamId || null;
  const canAlsoPlay = role === "entrenador" || role === "admin";
  const canCoach = role === "entrenador" || role === "admin";
  // Entrenadores y administradores ya gestionan partidos: el permiso solo tiene sentido para jugadores.
  const canBeEditor = role === "jugador";
  const coachedChanged = [...coached].sort().join() !== [...(user.coached_team_ids ?? [])].sort().join();
  const alsoPlaysChanged = alsoPlays !== Boolean(user.also_plays);
  const matchEditorChanged = matchEditor !== Boolean(user.match_editor);
  const hasChanges = role !== (user.role ?? "") || team !== (user.team_id ?? null) || coachedChanged || alsoPlaysChanged || matchEditorChanged;

  const toggleCoached = (id) =>
    setCoached((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const run = async (changes) => {
    setBusy(true);
    setError("");
    try {
      await onSave(changes);
    } catch (saveError) {
      setError(saveError.message);
      setBusy(false);
    }
  };

  const save = () => {
    const changes = {};
    if (role !== (user.role ?? "")) changes.role = role;
    if (team !== (user.team_id ?? null)) changes.team_id = team;
    if (alsoPlaysChanged) changes.also_plays = alsoPlays;
    if (coachedChanged) changes.coached_team_ids = coached;
    if (matchEditorChanged) changes.match_editor = matchEditor;
    run(changes);
  };

  const playedBefore = user.role === "jugador" || ((user.role === "entrenador" || user.role === "admin") && user.also_plays);
  const wasOnRoster = isApproved && playedBefore && Boolean(user.team_id);
  const playsNow = role === "jugador" || (canAlsoPlay && alsoPlays);
  const willBeOnRoster = playsNow && Boolean(team);
  let rosterNote = "";
  if (wasOnRoster && !willBeOnRoster) rosterNote = "Saldrá de la plantilla y perderá su dorsal, su posición y su chapa.";
  else if (wasOnRoster && team !== user.team_id) rosterNote = "Pasará a la plantilla del nuevo equipo, en el banquillo.";
  else if (!wasOnRoster && willBeOnRoster) rosterNote = "Entrará en la plantilla de este equipo, en el banquillo.";
  else if (playsNow && !team) rosterNote = "Sin equipo no aparecerá en ninguna plantilla.";

  const statusText = isPending ? "Esperando acceso" : isApproved ? roleLabel(user.role) : "Sin acceso";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="user-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-white/20 bg-card p-5 font-body text-white backdrop:bg-black/70"
    >
      <h2 id="user-dialog-title" className="break-words font-display text-2xl font-extrabold">
        {user.name}{isSelf && <span className="font-body text-base font-normal text-ink-muted"> (tú)</span>}
      </h2>
      <p className="break-words text-sm text-ink-muted">{accountLabel(user)}</p>
      <p className="mt-1 text-sm font-semibold text-white/60">{statusText}</p>
      {isPending && user.has_password && (
        <Notice tone="warning" announce={false} className="mt-3">
          Esta cuenta se ha creado con usuario y contraseña, sin un correo verificado. El nombre lo ha escrito esa persona: confirma que es quien dice antes de aprobarla.
        </Notice>
      )}

      <div className="mt-4 space-y-4">
        {isSelf ? (
          <p className="text-sm text-white/80">Tu acceso solo puede cambiarlo otro administrador. Sí puedes cambiar tu equipo.</p>
        ) : (
          <div>
            <label htmlFor="user-role" className={labelClass}>Rol</label>
            <select id="user-role" value={role} disabled={busy} onChange={(event) => setRole(event.target.value)} className={selectClass}>
              {!isApproved && <option value="" disabled>Elige un rol</option>}
              {ROLES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="user-team" className={labelClass}>{playsNow ? "Equipo donde juega" : "Equipo principal"}</label>
          <select id="user-team" value={teamId} disabled={busy} onChange={(event) => setTeamId(event.target.value)} className={selectClass}>
            <option value="">Sin equipo</option>
            {teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>

        {canBeEditor && !isSelf && (
          <label className="flex min-h-11 items-start gap-3 py-1 text-sm text-white/60">
            <input
              type="checkbox"
              checked={matchEditor}
              disabled={busy}
              onChange={(event) => setMatchEditor(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-tnt"
            />
            <span>
              <span className="block font-semibold">Editor de partidos</span>
              <span className="block text-xs text-ink-muted">Puede añadir, cambiar y borrar partidos. Lo demás sigue igual que un jugador.</span>
            </span>
          </label>
        )}

        {canAlsoPlay && (
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-white/60">
            <input
              type="checkbox"
              checked={alsoPlays}
              disabled={busy}
              onChange={(event) => setAlsoPlays(event.target.checked)}
              className="h-5 w-5 accent-tnt"
            />
            También juega
          </label>
        )}

        {canCoach && (
          <fieldset>
            <legend className={labelClass}>Equipos que entrena</legend>
            <p className="mb-1 text-xs text-ink-muted">Verá también el chat de estos equipos.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {teams.map((item) => (
                <label key={item.id} className="flex min-h-11 items-center gap-3 text-sm text-white/60">
                  <input
                    type="checkbox"
                    checked={coached.includes(item.id)}
                    disabled={busy}
                    onChange={() => toggleCoached(item.id)}
                    className="h-5 w-5 accent-tnt"
                  />
                  {item.name.replace(/^Club /, "")}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {rosterNote && <p data-testid="roster-note" className="text-sm text-white/80">{rosterNote}</p>}
      </div>

      {error && <Notice tone="error" className="mt-4">{error}</Notice>}

      {isApproved ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onClose} className={secondaryClass}>Cancelar</button>
          <button type="button" disabled={busy || !hasChanges} onClick={save} className={primaryClass}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {isPending ? (
            <button type="button" disabled={busy} onClick={() => run({ status: "rejected" })} className={secondaryClass}>Rechazar</button>
          ) : (
            <button type="button" disabled={busy} onClick={onClose} className={secondaryClass}>Cancelar</button>
          )}
          <button
            type="button"
            disabled={busy || !role}
            onClick={() => run({ status: "approved", role, team_id: team, also_plays: canAlsoPlay && alsoPlays, coached_team_ids: canCoach ? coached : [], match_editor: canBeEditor && matchEditor })}
            className={primaryClass}
          >
            {busy ? "Guardando…" : "Aprobar"}
          </button>
        </div>
      )}

      {isPending && (
        <button type="button" disabled={busy} onClick={onClose} className="mt-2 min-h-11 w-full text-sm font-semibold text-white/80 hover:text-white disabled:opacity-50">
          Decidir más tarde
        </button>
      )}

      {isApproved && !isSelf && (
        <div className="mt-4 border-t border-white/10 pt-4">
          {confirmingRemoval ? (
            <div className="space-y-2">
              <p className="text-sm text-white/60">¿Quitar el acceso a {user.name}? Dejará de ver la app{wasOnRoster ? " y saldrá de la plantilla" : ""}, y podrás volver a aprobarlo.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => setConfirmingRemoval(false)} className={secondaryClass}>No</button>
                <button type="button" disabled={busy} onClick={() => run({ status: "rejected" })} className={dangerClass}>Sí, quitar</button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmingRemoval(true)} className="min-h-11 w-full rounded-full text-sm font-semibold text-red-200 hover:bg-red-300/10 disabled:opacity-50">
              Quitar acceso
            </button>
          )}
        </div>
      )}

      {user.has_password && !isSelf && <TemporaryPassword user={user} onCreate={onCreateTemporaryPassword} />}
    </dialog>
  );
}
