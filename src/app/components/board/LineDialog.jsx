import { useEffect, useRef, useState } from "react";

const SIZES = [2, 3, 4, 5, 6, 7, 8];

// Crear una fila: cuántos jugadores tiene. Después se toca en la pista dónde va.
const RULES = [
  { value: "toque", title: "Con cualquier toque", text: "Cada uno vuelve al final de la fila tras su último toque y los demás avanzan." },
  { value: "remate", title: "Al rematar (japo)", text: "Nadie se mueve hasta que alguien remata: ese se cambia por el último de la fila, que es el que espera." },
];

export default function LineDialog({ onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const [size, setSize] = useState(5);
  // Dos pasos: cuántos jugadores y luego cuándo se cambian.
  const [step, setStep] = useState("size");
  const [rule, setRule] = useState("toque");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="line-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xs rounded-2xl border border-white/15 bg-panel p-4 font-body text-white backdrop:bg-black/70"
    >
      <h2 id="line-dialog-title" className="font-display text-lg font-black">Nueva fila</h2>
      {step === "rule" ? (
        <>
          <p className="mt-1 text-sm text-zinc-300">¿Cuándo se cambian los de la fila?</p>
          <div role="radiogroup" aria-label="Cuándo se cambian" className="mt-3 space-y-2">
            {RULES.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={rule === item.value}
                onClick={() => setRule(item.value)}
                className={`block w-full rounded-xl p-3 text-left ${rule === item.value ? "bg-tnt/20 ring-2 ring-tnt" : "bg-void ring-1 ring-white/15"}`}
              >
                <span className="block text-sm font-black">{item.title}</span>
                <span className="mt-0.5 block text-xs text-zinc-300">{item.text}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setStep("size")} className="min-h-11 rounded-lg border border-white/30 text-sm font-semibold hover:bg-white/5">Atrás</button>
            <button type="button" onClick={() => onConfirm(size, rule)} className="min-h-11 rounded-lg bg-tnt text-sm font-bold text-onbrand">Colocar fila</button>
          </div>
        </>
      ) : (
        <>
      <p className="mt-1 text-sm text-zinc-300">¿Cuántos jugadores hay en la fila? Se ponen jugadores de la plantilla y luego puedes cambiarlos.</p>
      <div role="radiogroup" aria-label="Jugadores en la fila" className="mt-3 grid grid-cols-4 gap-1.5">
        {SIZES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={size === value}
            onClick={() => setSize(value)}
            className={`min-h-11 rounded-lg text-base font-black ${size === value ? "bg-tnt text-onbrand" : "border border-white/15 bg-void text-zinc-200"}`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-white/30 text-sm font-semibold hover:bg-white/5">Cancelar</button>
        <button type="button" onClick={() => setStep("rule")} className="min-h-11 rounded-lg bg-tnt text-sm font-bold text-onbrand">Siguiente</button>
      </div>
        </>
      )}
    </dialog>
  );
}
