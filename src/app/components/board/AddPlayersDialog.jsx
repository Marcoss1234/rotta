import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import Avatar from "@/app/components/Avatar.jsx";
import { POSITIONS } from "@/app/roles.js";

// Primero las posiciones de campo, en el orden habitual; quien aún no tiene posición, al final.
const POSITION_ORDER = [...POSITIONS.filter((position) => position !== "Sin definir"), "Sin definir"];

function groupByPosition(players) {
  return POSITION_ORDER.map((position) => ({
    position,
    players: players.filter((player) => player.position === position),
  })).filter((group) => group.players.length > 0);
}

function PlayerRow({ player, placed, checked, onToggle }) {
  return (
    <li>
      <label className={`flex min-h-12 items-center gap-2.5 rounded-lg px-2 py-1 ${placed ? "opacity-45" : "cursor-pointer hover:bg-white/5"}`}>
        <input type="checkbox" checked={checked || placed} disabled={placed} onChange={onToggle} className="peer sr-only" />
        <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white ${checked || placed ? "border-tnt bg-tnt text-onbrand" : "border-white/30"}`}>
          {(checked || placed) && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
        </span>
        <Avatar name={player.name} picture={player.picture} className="h-9 w-9 text-xs" />
        <span className="min-w-0 flex-1 break-words text-sm font-bold">{player.name}</span>
        {placed ? (
          <span className="shrink-0 text-[11px] font-semibold text-zinc-400">En la pista</span>
        ) : (
          player.number !== null && <span className="shrink-0 font-display text-lg font-black italic text-ember"><span className="sr-only">Dorsal </span>{player.number}</span>
        )}
      </label>
    </li>
  );
}

function TeamSection({ team, players, placedIds, selected, onToggle, onToggleMany, defaultOpen }) {
  const groups = useMemo(() => groupByPosition(players), [players]);
  const free = players.filter((player) => !placedIds.has(player.id));
  const chosen = free.filter((player) => selected.has(player.id)).length;
  const allChosen = free.length > 0 && chosen === free.length;

  return (
    <details open={defaultOpen} className="group rounded-xl bg-void/60">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
        <span className="min-w-0 flex-1 truncate font-display text-base font-black uppercase italic">{team.name.replace(/^Club /, "")}</span>
        {chosen > 0 && <span className="rounded-full bg-tnt px-2 py-0.5 text-xs font-bold text-onbrand">{chosen}</span>}
        <span className="text-xs font-semibold text-zinc-400">{players.length}</span>
      </summary>
      <div className="px-1 pb-2">
        {players.length === 0 && <p className="px-2 pb-1 text-sm text-zinc-400">Este equipo aún no tiene jugadores.</p>}
        {free.length > 0 && (
          <button type="button" onClick={() => onToggleMany(free, !allChosen)} className="mb-1 ml-2 min-h-11 text-xs font-bold text-ember">
            {allChosen ? "Quitar selección" : "Seleccionar todos"}
          </button>
        )}
        {groups.map((group) => (
          <section key={group.position} aria-label={group.position}>
            <h4 className="px-2 pb-0.5 pt-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-400">{group.position}</h4>
            <ul>
              {group.players.map((player) => (
                <PlayerRow key={player.id} player={player} placed={placedIds.has(player.id)} checked={selected.has(player.id)} onToggle={() => onToggle(player)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}

export default function AddPlayersDialog({ teams, players, boardTeamId, placedIds, onAdd, onClose }) {
  const dialogRef = useRef(null);
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  // El equipo de la jugada, primero y abierto.
  const ordered = [...teams].sort((a, b) => (b.id === boardTeamId) - (a.id === boardTeamId));

  const toggle = (player) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(player.id)) next.add(player.id);
      return next;
    });

  const toggleMany = (list, value) =>
    setSelected((current) => {
      const next = new Set(current);
      list.forEach((player) => (value ? next.add(player.id) : next.delete(player.id)));
      return next;
    });

  const count = selected.size;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="add-players-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto flex max-h-[88dvh] w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-white/15 bg-panel p-0 font-body text-white backdrop:bg-black/80"
    >
      <h2 id="add-players-title" className="shrink-0 px-4 pb-2 pt-4 font-display text-2xl font-black uppercase italic">Añadir jugadores</h2>
      {/* flex-auto (no flex-1): en Safari del iPhone, con flex-1 la lista se encoge a nada. */}
      <div className="min-h-0 flex-auto space-y-1.5 overflow-y-auto overscroll-contain px-3 pb-2">
        {ordered.map((team) => (
          <TeamSection
            key={team.id}
            team={team}
            players={players.filter((player) => player.team_id === team.id)}
            placedIds={placedIds}
            selected={selected}
            onToggle={toggle}
            onToggleMany={toggleMany}
            defaultOpen={team.id === boardTeamId}
          />
        ))}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 p-3">
        <button type="button" onClick={onClose} className="min-h-12 rounded-lg border border-white/30 text-sm font-semibold hover:bg-white/5">Cancelar</button>
        <button
          type="button"
          disabled={count === 0}
          onClick={() => onAdd(players.filter((player) => selected.has(player.id)))}
          className="min-h-12 rounded-lg bg-gradient-to-r from-tnt to-ember font-display text-sm font-black uppercase italic disabled:opacity-40 text-onbrand"
        >
          {count > 0 ? `Añadir (${count})` : "Añadir"}
        </button>
      </div>
    </dialog>
  );
}
