import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";

// Una pista pequeña con un punto por jugador, para reconocer cada alineación de un vistazo.
function MiniCourt({ tokens }) {
  return (
    <svg viewBox="0 0 50 95" aria-hidden="true" className="h-[4.5rem] w-[2.4rem] shrink-0 rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
      <rect width="50" height="95" fill="#c9793f" />
      <rect x="2.5" y="32.5" width="45" height="30" fill="#d98b4f" />
      <rect x="2.5" y="2.5" width="45" height="90" fill="none" stroke="#fff" strokeWidth="0.8" />
      <line x1="0" y1="47.5" x2="50" y2="47.5" stroke="#fff" strokeWidth="1.8" />
      {tokens.map((token) => (
        <circle
          key={token.id}
          cx={2.5 + token.x * 45}
          cy={2.5 + token.y * 90}
          r="3.6"
          fill={token.position === "Líbero" ? "#FCD34D" : "#09090B"}
          stroke="#fff"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

const savedOn = (iso) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

function RenameForm({ lineup, onRename, onDone }) {
  const [name, setName] = useState(lineup.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.select();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (clean === lineup.name) {
      onDone();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onRename(lineup, clean);
      onDone();
    } catch (renameError) {
      setError(renameError.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex-1 p-2">
      <label htmlFor={`rename-${lineup.id}`} className="sr-only">Nuevo nombre de {lineup.name}</label>
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          id={`rename-${lineup.id}`}
          value={name}
          maxLength={60}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              event.preventDefault();
              onDone();
            }
          }}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/25 bg-void px-3 text-base text-white focus:border-white focus:outline-none"
        />
        <button type="submit" disabled={busy || !name.trim()} aria-label="Guardar nombre" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-tnt text-onbrand disabled:opacity-50">
          <Check aria-hidden="true" className="h-5 w-5" />
        </button>
        <button type="button" disabled={busy} onClick={onDone} aria-label="Cancelar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/20 text-zinc-200">
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs font-semibold text-red-300">{error}</p>}
    </form>
  );
}

export default function LineupsDialog({ lineups, error, onApply, onRename, onDelete, onClose }) {
  const dialogRef = useRef(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="lineups-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-panel p-0 font-body text-white backdrop:bg-black/70"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="relative shrink-0 border-b border-white/10 px-4 pb-3 pt-4">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-tnt via-ember to-transparent text-onbrand" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="lineups-title" className="font-display text-xl font-extrabold">Alineaciones</h2>
              <p className="text-xs text-zinc-400">Toca una para ponerla en la pista. Se puede deshacer.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10">
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto p-3">
          {error && <p role="alert" className="mb-2 rounded-lg border border-red-300/50 p-2 text-sm font-semibold text-red-200">{error}</p>}
          {lineups === null && !error && <p role="status" className="p-2 text-sm text-zinc-300">Cargando…</p>}
          {lineups?.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-sm text-zinc-300">
              Aún no hay ninguna.<br />Coloca a los jugadores y pulsa <span className="font-bold text-white">Guardar alineación</span>.
            </p>
          )}

          {lineups?.length > 0 && (
            <ul className="space-y-2">
              {lineups.map((lineup) => (
                <li key={lineup.id} className="flex items-stretch rounded-xl border border-white/5 bg-void/60">
                  {renamingId === lineup.id ? (
                    <RenameForm lineup={lineup} onRename={onRename} onDone={() => setRenamingId(null)} />
                  ) : confirmingId === lineup.id ? (
                    <div className="flex min-h-[5.25rem] flex-1 items-center gap-2 px-3">
                      <span className="min-w-0 flex-1 text-sm font-semibold">¿Borrar «{lineup.name}»?</span>
                      <button type="button" onClick={() => setConfirmingId(null)} className="min-h-11 rounded-lg border border-white/30 px-3 text-xs font-semibold">No</button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingId(null);
                          onDelete(lineup);
                        }}
                        className="min-h-11 rounded-lg bg-red-500/90 px-3 text-xs font-bold text-white"
                      >
                        Borrar
                      </button>
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => onApply(lineup)} className="group flex min-w-0 flex-1 items-center gap-3 rounded-l-xl p-2 text-left hover:bg-white/5">
                        <MiniCourt tokens={lineup.tokens} />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words font-bold leading-tight group-hover:text-ember">{lineup.name}</span>
                          <span className="mt-0.5 block text-[11px] font-semibold text-zinc-500">
                            {lineup.tokens.length} {lineup.tokens.length === 1 ? "jugador" : "jugadores"} · {savedOn(lineup.created_at)}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-300">{lineup.tokens.map((token) => token.name || token.label).join(", ")}</span>
                        </span>
                      </button>
                      <div className="flex shrink-0 flex-col justify-center border-l border-white/5">
                        <button type="button" onClick={() => setRenamingId(lineup.id)} aria-label={`Cambiar el nombre de ${lineup.name}`} className="flex h-11 w-11 items-center justify-center text-zinc-400 hover:bg-white/5 hover:text-white">
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setConfirmingId(lineup.id)} aria-label={`Borrar ${lineup.name}`} className="flex h-11 w-11 items-center justify-center text-zinc-400 hover:bg-white/5 hover:text-red-200">
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
