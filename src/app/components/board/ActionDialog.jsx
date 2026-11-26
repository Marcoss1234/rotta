import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CircleDot, Feather, Flame, Hand, Shield, Trash2, X, Zap } from "lucide-react";
import { COACH_ACTIONS, PLAYER_ACTIONS, SET_TEMPOS, actionLabel } from "@/app/boardRecording.js";

const ICONS = { saque: CircleDot, recepcion: ArrowDownToLine, colocacion: ArrowUpFromLine, remate: Zap, bloqueo: Hand, defensa: Shield, free: Feather, fuerte: Flame };
export const actionIcon = (value) => ICONS[value] ?? CircleDot;

const seconds = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

// Qué hace este jugador en este momento de la jugada. También lista y deja quitar las que ya tiene.
export default function ActionDialog({ name, time, actions, onChoose, onRemove, onClose, coach = false }) {
  const dialogRef = useRef(null);
  // Al elegir "Colocar" se pregunta el tiempo.
  const [setting, setSetting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="action-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xs rounded-2xl border border-white/15 bg-card p-4 font-body text-white backdrop:bg-black/70"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="action-title" className="font-display text-lg font-extrabold leading-tight">¿Qué hace {name}?</h2>
          {time !== null && <p className="text-xs text-ink-muted">En el segundo {seconds(time)} de la jugada</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10">
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      {setting ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-bold text-white/60">¿A qué tiempo coloca?</p>
          {SET_TEMPOS.map((tempo) => (
            <button
              key={tempo.value}
              type="button"
              onClick={() => onChoose("colocacion", tempo.value)}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/10 bg-void/70 px-3 text-left hover:border-tnt"
            >
              <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg bg-brand font-display text-base font-extrabold text-onbrand">{tempo.short}</span>
              <span>
                <span className="block text-sm font-bold">{tempo.label}</span>
                <span className="block text-xs text-ink-muted">{tempo.hint}</span>
              </span>
            </button>
          ))}
          <button type="button" onClick={() => setSetting(false)} className="min-h-11 w-full rounded-lg text-sm font-semibold text-white/80 hover:bg-white/5">
            Volver
          </button>
        </div>
      ) : (
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(coach ? COACH_ACTIONS : PLAYER_ACTIONS).map(({ value, label }) => {
          const Icon = ICONS[value];
          return (
            <button
              key={value}
              type="button"
              onClick={() => (value === "colocacion" ? setSetting(true) : onChoose(value))}
              className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-void/70 text-xs font-bold hover:border-tnt hover:text-club-ui"
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
              {label}
            </button>
          );
        })}
      </div>
      )}

      {actions.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <h3 className="text-[11px] font-bold text-ink">Sus acciones en esta jugada</h3>
          <ul className="mt-1.5 space-y-1">
            {actions.map((item) => {
              const Icon = ICONS[item.action];
              return (
                <li key={`${item.t}-${item.action}`} className="flex min-h-11 items-center gap-2 rounded-lg bg-void/60 pl-3">
                  <Icon aria-hidden="true" className="h-4 w-4 text-club-ui" />
                  <span className="flex-1 text-sm font-semibold">{actionLabel(item.action, item.tempo)}</span>
                  <span className="text-xs tabular-nums text-ink-muted">{seconds(item.t)}</span>
                  <button type="button" onClick={() => onRemove(item)} aria-label={`Quitar ${actionLabel(item.action)} del segundo ${seconds(item.t)}`} className="flex h-11 w-11 items-center justify-center text-ink-muted hover:text-red-200">
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </dialog>
  );
}
