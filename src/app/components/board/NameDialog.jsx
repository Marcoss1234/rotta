import { useEffect, useRef, useState } from "react";

// Pide un nombre corto, ya rellenado con una propuesta para no tener que escribir si no quieres.
export default function NameDialog({ title, label, initialName, confirmLabel, busy = false, error = "", onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    inputRef.current.select();
    return () => dialog.close();
  }, []);

  const submit = (event) => {
    event.preventDefault();
    if (name.trim() && !busy) onConfirm(name.trim());
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="name-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xs rounded-2xl border border-white/15 bg-panel p-4 font-body text-white backdrop:bg-black/70"
    >
      <form onSubmit={submit}>
        <h2 id="name-dialog-title" className="font-display text-lg font-black uppercase italic">{title}</h2>
        <label htmlFor="name-dialog-input" className="mt-3 block text-xs font-semibold text-zinc-400">{label}</label>
        <input
          ref={inputRef}
          id="name-dialog-input"
          value={name}
          maxLength={60}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-void px-3 text-base text-white focus:border-white focus:outline-none"
        />
        {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-300">{error}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-lg border border-white/30 text-sm font-semibold hover:bg-white/5 disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={busy || !name.trim()} className="min-h-11 rounded-lg bg-tnt text-sm font-bold text-onbrand disabled:opacity-50">
            {busy ? "Guardando…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
