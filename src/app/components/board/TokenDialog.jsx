import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import Avatar from "@/app/components/Avatar.jsx";
import { POSITIONS } from "@/app/roles.js";
import { tokenPosition } from "@/app/boards.js";

// El toque que abre la ventana puede caer también sobre lo que aparece debajo del dedo.
const ARM_DELAY_MS = 300;

export default function TokenDialog({ element, player, busy, onApply, onRemove, onClose }) {
  const dialogRef = useRef(null);
  const [armed, setArmed] = useState(false);
  const [alsoRoster, setAlsoRoster] = useState(false);
  const [label, setLabel] = useState(element.label);
  const rival = element.side === "rival";
  const current = tokenPosition(element, player);
  const title = player?.name ?? (rival ? `Rival ${element.label}` : element.name || element.label);
  const hasOverride = Boolean(player && element.position && element.position !== player.position);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    const timer = setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => {
      clearTimeout(timer);
      dialog.close();
    };
  }, []);

  const labelChange = rival && label.trim() && label.trim() !== element.label ? { label: label.trim() } : {};

  const close = () => {
    if (busy) return;
    if (Object.keys(labelChange).length > 0) onApply(labelChange, false);
    else onClose();
  };

  const pick = (position) => {
    if (position === current && !alsoRoster && Object.keys(labelChange).length === 0) {
      onClose();
      return;
    }
    onApply({ ...labelChange, position }, alsoRoster && Boolean(player));
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="token-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (armed && event.target === dialogRef.current) close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-white/15 bg-panel p-0 font-body text-white backdrop:bg-black/70"
    >
      <div className={`space-y-4 p-4 ${armed ? "" : "pointer-events-none"}`}>
        <div className="flex items-center gap-3">
          {player ? (
            <Avatar name={player.name} picture={player.picture} className="h-12 w-12 text-sm" />
          ) : (
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tnt text-sm font-black text-onbrand">{element.label}</span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="token-dialog-title" className="break-words font-display text-xl font-black uppercase italic leading-tight">{title}</h2>
            {player && <p className="mt-0.5 text-xs font-semibold text-zinc-400">En su ficha: {player.position}</p>}
          </div>
          <button type="button" onClick={close} aria-label="Cerrar" className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-lg text-zinc-300 hover:bg-white/5">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <fieldset disabled={busy}>
          <legend className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400">Posición en esta jugada</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {POSITIONS.map((position) => (
              <button
                key={position}
                type="button"
                aria-pressed={position === current}
                onClick={() => pick(position)}
                className={`min-h-12 rounded-lg px-2 text-sm font-bold disabled:opacity-50 ${position === current ? "bg-gradient-to-r from-tnt to-ember text-onbrand" : "bg-void text-zinc-200 hover:text-white"}`}
              >
                {position}
              </button>
            ))}
          </div>
        </fieldset>

        {player && (
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-zinc-200">
            <span className="min-w-0">
              Cambiarla también en su ficha
              <span className="block text-xs font-normal text-zinc-400">Si no, solo cambia en esta jugada.</span>
            </span>
            <input type="checkbox" checked={alsoRoster} disabled={busy} onChange={(event) => setAlsoRoster(event.target.checked)} className="peer sr-only" />
            <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-white/15 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-tnt peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white" />
          </label>
        )}

        {hasOverride && (
          <button type="button" disabled={busy} onClick={() => onApply({ position: null }, false)} className="min-h-11 text-sm font-bold text-ember">
            Volver a la de su ficha ({player.position})
          </button>
        )}

        {rival && (
          <div>
            <label htmlFor="token-label" className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-zinc-400">Dorsal o etiqueta</label>
            <input
              id="token-label"
              value={label}
              maxLength={3}
              onChange={(event) => setLabel(event.target.value)}
              className="min-h-11 w-24 rounded-lg border border-white/20 bg-void px-3 text-center font-bold text-white focus:border-white focus:outline-none"
            />
          </div>
        )}

        <button type="button" disabled={busy} onClick={onRemove} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-400/50 text-sm font-bold text-red-200 hover:bg-red-400/10 disabled:opacity-50">
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Quitar de la pista
        </button>
      </div>
    </dialog>
  );
}
