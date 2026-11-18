import { useEffect, useRef, useState } from "react";
import Avatar from "@/app/components/Avatar.jsx";
import { overallTone } from "@/app/components/RankingVisuals.jsx";
import { POSITIONS } from "@/app/roles.js";
import { formatOverall, formatScore, overallOf, weightPercent } from "@/app/ranking.js";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/20 bg-void px-3 text-base text-white focus:border-white focus:outline-none";
const primaryClass = "min-h-12 rounded-lg bg-tnt px-4 font-display text-sm font-extrabold text-onbrand disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "min-h-12 rounded-lg border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";

// La barra empieza medio punto antes del 1: ese primer tramo significa "sin nota".
const NO_SCORE = 0.5;

function OverallRing({ overall }) {
  const fill = overall === null ? 0 : overall;
  return (
    <div
      className="flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#FF3800, #FF8800 ${fill}%, rgba(255,255,255,0.12) ${fill}%)` }}
    >
      <div className="flex h-[4.6rem] w-[4.6rem] flex-col items-center justify-center rounded-full bg-panel" aria-live="polite">
        <span className={`font-display text-3xl font-black leading-none tabular-nums ${overallTone(overall)}`}>{formatOverall(overall)}</span>
        <span className="text-[9px] font-bold text-zinc-400">Overall</span>
      </div>
    </div>
  );
}

export default function RatingDialog({ row, skills, weights, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [position, setPosition] = useState(row.rating?.position ?? row.position);
  const [scores, setScores] = useState(row.rating?.scores ?? {});
  const [comment, setComment] = useState(row.rating?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const positionWeights = weights[position];
  // Si cambia la posición, lo ya escrito se recuerda, pero solo cuenta lo que esa posición puntúa.
  const counted = Object.fromEntries(Object.entries(scores).filter(([skill]) => positionWeights[skill] !== undefined));
  const overall = overallOf(positionWeights, counted);

  const setScore = (skill, value) =>
    setScores((current) => {
      const next = { ...current };
      if (value === NO_SCORE) delete next[skill];
      else next[skill] = value;
      return next;
    });

  const submit = async (event) => {
    event.preventDefault();
    if (comment.trim() && Object.keys(counted).length === 0) {
      setError("Pon al menos una nota para dejar un comentario");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({ position, scores: counted, comment: comment.trim() });
    } catch (saveError) {
      setError(saveError.message);
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="rating-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-panel p-0 font-body text-white backdrop:bg-black/80"
    >
      <div className="flex items-center gap-3 bg-gradient-to-r from-tnt/30 via-tnt/10 to-transparent p-5">
        <Avatar name={row.name} picture={row.picture} className="h-12 w-12 text-sm" />
        <h2 id="rating-dialog-title" className="min-w-0 flex-1 break-words font-display text-2xl font-black leading-tight">{row.name}</h2>
        <OverallRing overall={overall} />
      </div>

      <form onSubmit={submit} className="space-y-5 p-5 pt-4">
        <fieldset disabled={busy}>
          <legend className="mb-2 text-[11px] font-bold text-zinc-400">Posición esta semana</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {POSITIONS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={item === position}
                onClick={() => setPosition(item)}
                className={`min-h-11 rounded-lg px-1 text-xs font-bold ${item === position ? "bg-white text-void" : "bg-void text-zinc-300 hover:text-white"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1">
          {skills.filter(({ id }) => positionWeights[id] !== undefined).map(({ id, label }) => {
            const value = scores[id] ?? NO_SCORE;
            const text = value === NO_SCORE ? "–" : formatScore(value);
            return (
              <div key={id}>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor={`rating-${id}`} className="text-sm font-semibold text-zinc-200">
                    {label} <span className="text-xs font-bold text-ember">{weightPercent(positionWeights, id)}%</span>
                  </label>
                  <span className="font-display text-2xl font-black tabular-nums">{text}</span>
                </div>
                <input
                  id={`rating-${id}`}
                  type="range"
                  min={NO_SCORE}
                  max="10"
                  step="0.5"
                  value={value}
                  disabled={busy}
                  aria-valuetext={value === NO_SCORE ? "Sin nota" : text}
                  onChange={(event) => setScore(id, Number(event.target.value))}
                  style={{ "--fill": `${((value - NO_SCORE) / (10 - NO_SCORE)) * 100}%` }}
                  className="rating-range"
                />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-zinc-400">De 1 a 10 según lo esperado para su posición. Si algo no se ha visto esta semana, déjalo a la izquierda del todo, sin nota.</p>

        <div>
          <label htmlFor="rating-comment" className="mb-1.5 block text-[11px] font-bold text-zinc-400">Comentario <span className="font-normal normal-case tracking-normal">(opcional)</span></label>
          <textarea
            id="rating-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={busy}
            aria-describedby="rating-comment-hint"
            className={`${fieldClass} py-2.5`}
          />
          <p id="rating-comment-hint" className="mt-1 text-xs text-zinc-400">Solo lo verán este jugador y sus entrenadores.</p>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-300/50 p-3 text-sm font-semibold text-red-200">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onClose} className={secondaryClass}>Cancelar</button>
          <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </dialog>
  );
}
