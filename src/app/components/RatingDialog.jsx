import { useState } from "react";
import { X } from "lucide-react";
import Avatar from "@/app/components/Avatar.jsx";
import { overallTone } from "@/app/components/RankingVisuals.jsx";
import { POSITIONS } from "@/app/roles.js";
import { formatOverall, formatScore, overallOf, weightPercent } from "@/app/ranking.js";
import { Button, ChipGroup, Dialog, Field, Notice, Textarea } from "@/app/ui/index.js";

// La barra empieza medio punto antes del 1: ese primer tramo significa "sin nota".
const NO_SCORE = 0.5;

// La nota global en un aro que se llena (0 a 100). Colores del tema; el grosor y el remate, de cada identidad
// (rating-ring en index.css: Lima recto y fino, Naranja grueso y redondo, Tinta una línea finísima).
function OverallRing({ overall }) {
  const fill = overall === null ? 0 : overall;
  const radius = 34;
  const length = 2 * Math.PI * radius;
  return (
    <div className="relative flex h-[5.25rem] w-[5.25rem] shrink-0 items-center justify-center" aria-live="polite">
      <svg aria-hidden="true" viewBox="0 0 84 84" className="rating-ring absolute inset-0 h-full w-full -rotate-90">
        <circle cx="42" cy="42" r={radius} className="rating-ring-track" />
        <circle cx="42" cy="42" r={radius} className="rating-ring-fill" strokeDasharray={`${(fill / 100) * length} ${length}`} />
      </svg>
      <span className="relative flex flex-col items-center">
        <span className={`font-score text-3xl leading-none ${overallTone(overall)}`}>{formatOverall(overall)}</span>
        <span className="mt-0.5 text-[11px] font-semibold leading-none text-ink-muted">Nota global</span>
      </span>
    </div>
  );
}

// Una habilidad: nombre, cuánto pesa en su posición, la nota en grande y la barra para ponerla.
function SkillSlider({ id, label, weight, value, busy, onChange }) {
  const empty = value === NO_SCORE;
  const text = empty ? "–" : formatScore(value);
  return (
    <li className="py-2.5">
      <div className="flex items-center gap-2">
        <label htmlFor={`rating-${id}`} className="min-w-0 flex-1 text-sm font-semibold text-ink">
          {label}
          <span className="ml-2 rounded-full bg-raised px-1.5 py-0.5 text-xs font-bold text-ink-muted">pesa {weight}%</span>
        </label>
        {!empty && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChange(NO_SCORE)}
            aria-label={`Dejar ${label} sin nota`}
            title="Sin nota"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-ui hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
        <span className={`w-12 text-right font-score text-2xl leading-none ${empty ? "text-ink-muted" : "text-ink"}`}>{text}</span>
      </div>
      <input
        id={`rating-${id}`}
        type="range"
        min={NO_SCORE}
        max="10"
        step="0.5"
        value={value}
        disabled={busy}
        aria-valuetext={empty ? "Sin nota" : text}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--fill": `${((value - NO_SCORE) / (10 - NO_SCORE)) * 100}%` }}
        className="rating-range"
      />
    </li>
  );
}

// Poner las notas de un jugador: hoja desde abajo en el móvil y ventana en el centro en escritorio. Arriba, fijo
// mientras se desliza, quién es, su posición y la nota global que va saliendo; debajo, una barra por habilidad.
export default function RatingDialog({ row, skills, weights, published = false, onSave, onClose }) {
  const [position, setPosition] = useState(row.rating?.position ?? row.position);
  const [scores, setScores] = useState(row.rating?.scores ?? {});
  const [comment, setComment] = useState(row.rating?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const positionWeights = weights[position];
  // Si cambia la posición, lo ya escrito se recuerda, pero solo cuenta lo que esa posición puntúa.
  const counted = Object.fromEntries(Object.entries(scores).filter(([skill]) => positionWeights[skill] !== undefined));
  const overall = overallOf(positionWeights, counted);
  const positionSkills = skills.filter(({ id }) => positionWeights[id] !== undefined);
  const scoredCount = positionSkills.filter(({ id }) => counted[id] !== undefined).length;

  const setScore = (skill, value) =>
    setScores((current) => {
      const next = { ...current };
      if (value === NO_SCORE) delete next[skill];
      else next[skill] = value;
      return next;
    });

  const submit = async (event) => {
    event?.preventDefault();
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
    <Dialog
      title={row.name}
      description={published ? "Semana publicada: lo que guardes cambia el ranking al momento." : "Borrador: los jugadores no lo verán hasta que publiques la semana."}
      onClose={onClose}
      busy={busy}
      placement="auto"
    >
      <form id="rating-form" onSubmit={submit}>
        {/* Lo que manda: quién, su posición y la nota global. Se queda arriba mientras se desliza por las habilidades. */}
        <div className="sticky -top-5 z-10 -mx-5 mb-1 bg-overlay px-5 pb-3 pt-1 md:-top-6 md:-mx-6 md:px-6">
          <div className="flex items-center gap-3">
            <Avatar name={row.name} picture={row.picture} className="h-11 w-11 text-sm" />
            <p className="min-w-0 flex-1 text-sm text-ink-muted">
              <span className="font-score text-lg text-ink">{scoredCount}</span>/{positionSkills.length} habilidades con nota
            </p>
            <OverallRing overall={overall} />
          </div>
          <p className="mb-1.5 mt-2 text-xs font-semibold text-ink-muted">Posición esta semana</p>
          <ChipGroup label="Posición esta semana" scroll value={position} onChange={(item) => !busy && setPosition(item)} options={POSITIONS.map((item) => ({ value: item, label: item }))} />
        </div>

        <ul aria-label="Habilidades" className="divide-y divide-line">
          {positionSkills.map(({ id, label }) => (
            <SkillSlider
              key={id}
              id={id}
              label={label}
              weight={weightPercent(positionWeights, id)}
              value={scores[id] ?? NO_SCORE}
              busy={busy}
              onChange={(value) => setScore(id, value)}
            />
          ))}
        </ul>
        <p className="mt-1 text-xs text-ink-muted">
          De 1 a 10 según lo esperado para su posición. Si algo no se ha visto esta semana, déjalo a la izquierda del todo, sin nota.
        </p>

        <Field id="rating-comment" label="Comentario" optional hint="Solo lo verán este jugador y sus entrenadores." className="mt-4">
          <Textarea
            id="rating-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            rows={2}
            disabled={busy}
            hint="Solo lo verán este jugador y sus entrenadores."
          />
        </Field>

        {error && <Notice tone="error" className="mt-3">{error}</Notice>}

        {/* Guardar siempre a mano, abajo, aunque falten habilidades por ver. */}
        <div className="sticky bottom-[calc(-1.25rem-env(safe-area-inset-bottom))] z-10 -mx-5 mt-4 grid grid-cols-2 gap-2 border-t border-line bg-overlay px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 -mb-[calc(1.25rem+env(safe-area-inset-bottom))] md:-bottom-6 md:-mx-6 md:-mb-6 md:px-6 md:pb-6">
          <Button variant="secondary" size="lg" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="lg" busy={busy} busyLabel="Guardando…">Guardar</Button>
        </div>
      </form>
    </Dialog>
  );
}
