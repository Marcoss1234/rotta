import { useEffect, useRef } from "react";

// Las ventanas del navegador (confirm) no aparecen en todos los sitios: en algunos el botón no haría nada.
export default function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-message"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xs rounded-2xl border border-white/15 bg-card p-4 font-body text-white backdrop:bg-black/70"
    >
      <p id="confirm-message" className="text-sm font-semibold text-white">{message}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-white/30 text-sm font-semibold hover:bg-white/5">Cancelar</button>
        <button type="button" onClick={onConfirm} className="min-h-11 rounded-lg bg-brand text-sm font-bold text-onbrand">{confirmLabel}</button>
      </div>
    </dialog>
  );
}
