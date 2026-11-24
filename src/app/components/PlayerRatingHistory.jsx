import { TrendingDown, TrendingUp } from "lucide-react";
import { AnimatedBar, EvolutionChart, OverallNumber, PositionTag, SkillRadar } from "@/app/components/RankingVisuals.jsx";
import { formatOverall, formatScore, weekLabel } from "@/app/ranking.js";

// La ficha del jugador: la última semana publicada al detalle y cómo ha evolucionado.
export default function PlayerRatingHistory({ history }) {
  const [latest, previous] = history.weeks;
  if (!latest) {
    return <p className="text-sm text-zinc-300">Todavía no hay ninguna semana publicada con notas.</p>;
  }
  const rated = history.skills.filter(({ id }) => history.weights[latest.position]?.[id] !== undefined && latest.scores[id] !== undefined);
  const change = previous ? Math.round(latest.overall) - Math.round(previous.overall) : 0;
  const recent = history.weeks.slice(0, 8).reverse();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <PositionTag position={latest.position} />
          <p className="mt-1.5 text-sm text-zinc-300">Semana {weekLabel(latest.week)}</p>
          {change !== 0 && (
            <p className={`mt-1 flex items-center gap-1 text-sm font-bold ${change > 0 ? "text-emerald-300" : "text-red-300"}`}>
              {change > 0 ? <TrendingUp aria-hidden="true" className="h-4 w-4" /> : <TrendingDown aria-hidden="true" className="h-4 w-4" />}
              {change > 0 ? `+${change}` : change} respecto a la anterior
            </p>
          )}
        </div>
        <p className="shrink-0 text-right">
          <OverallNumber overall={latest.overall} className="block text-7xl" />
          <span className="text-[11px] font-bold text-zinc-400">Overall</span>
        </p>
      </div>

      <div className="grid items-center gap-4 sm:grid-cols-2">
        {rated.length >= 3 && <SkillRadar skills={rated} scores={latest.scores} />}
        <ul className="space-y-3">
          {rated.map(({ id, label }) => (
            <li key={id}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="font-semibold text-zinc-200">{label}</span>
                <span className="font-display font-extrabold tabular-nums">{formatScore(latest.scores[id])}</span>
              </div>
              <AnimatedBar percent={latest.scores[id] * 10} />
            </li>
          ))}
        </ul>
      </div>

      {latest.comment && (
        <blockquote className="rounded-r-lg border-l-4 border-tnt bg-void p-3 text-sm text-zinc-200">
          <span className="mb-1 block text-[11px] font-bold text-zinc-400">Comentario del entrenador</span>
          <span className="whitespace-pre-wrap break-words">{latest.comment}</span>
        </blockquote>
      )}

      {recent.length >= 2 && (
        <div>
          <h3 className="mb-1 text-[11px] font-bold text-zinc-400">Evolución</h3>
          <EvolutionChart weeks={recent} />
          <ul className="sr-only">
            {recent.map((week) => <li key={week.week}>{weekLabel(week.week)}: {formatOverall(week.overall)}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
