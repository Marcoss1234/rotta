import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Equal, Zap } from "lucide-react";
import { formatOverall } from "@/app/ranking.js";

export function RankingHero({ title, subtitle, stacked = false, children }) {
  return (
    <header className="grain relative overflow-hidden rounded-2xl bg-gradient-to-br from-tnt via-tnt to-tntdeep p-5 md:p-6 text-onbrand">
      <Zap aria-hidden="true" className="absolute -right-6 -top-8 h-44 w-44 rotate-12 fill-white/10 text-white/10" />
      {stacked ? (
        <div className="relative">
          <h1 className="font-display text-5xl font-black uppercase italic leading-none tracking-tight max-[359px]:text-4xl md:text-6xl">{title}</h1>
          {/* Con títulos largos el botón va abajo para no pisarlos. */}
          <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
            <p className="min-w-0 text-sm font-semibold text-white/85">{subtitle}</p>
            {children}
          </div>
        </div>
      ) : (
        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-5xl font-black uppercase italic leading-none tracking-tight max-[359px]:text-4xl md:text-6xl">{title}</h1>
            {subtitle && <p className="mt-2 text-sm font-semibold text-white/85">{subtitle}</p>}
          </div>
          {children}
        </div>
      )}
    </header>
  );
}

export function GroupPicker({ groups, groupId, onChange, columns = "grid-cols-3" }) {
  if (groups.length < 2) return null;
  return (
    <div role="group" aria-label="Elegir equipo" className={`grid gap-1 rounded-xl bg-panel p-1 ${columns}`}>
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          aria-pressed={group.id === groupId}
          onClick={() => onChange(group.id)}
          className={`min-h-11 rounded-lg px-1 font-display text-sm font-extrabold uppercase tracking-wide transition-colors max-[359px]:text-xs max-[359px]:tracking-normal ${
            group.id === groupId ? "bg-tnt text-onbrand shadow-sm" : "text-zinc-300 hover:text-white"
          }`}
        >
          {group.name.replace(/^Club (Senior )?/, "")}
        </button>
      ))}
    </div>
  );
}

const POSITION_STYLES = {
  Líbero: "bg-sky-400/15 text-sky-300",
  Colocador: "bg-violet-400/15 text-violet-300",
  Receptor: "bg-emerald-400/15 text-emerald-300",
  Central: "bg-amber-400/15 text-amber-300",
  Opuesto: "bg-rose-400/15 text-rose-300",
};

export function PositionTag({ position }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${POSITION_STYLES[position] ?? "bg-white/10 text-zinc-300"}`}>
      {position}
    </span>
  );
}

// Cuanto mejor es la nota, más se enciende el número.
export function overallTone(overall) {
  if (overall === null || overall === undefined) return "text-zinc-500";
  if (overall >= 85) return "text-amber-300";
  if (overall >= 70) return "text-ember";
  if (overall >= 50) return "text-white";
  return "text-zinc-400";
}

export function OverallNumber({ overall, className = "text-3xl" }) {
  return (
    <span className={`font-display font-black italic leading-none tabular-nums ${overallTone(overall)} ${className}`}>
      <span className="sr-only">Overall </span>{formatOverall(overall)}
    </span>
  );
}

export function MovementPill({ value, hasPrevious }) {
  if (!hasPrevious) return null;
  if (value === null) {
    return <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] font-bold uppercase text-sky-300">Nuevo</span>;
  }
  if (value === 0) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-zinc-400">
        <Equal aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="sr-only">Sigue igual</span>
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-sm font-extrabold ${up ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span className="sr-only">{up ? "Sube" : "Baja"} </span>
      {Math.abs(value)}
    </span>
  );
}

export function AnimatedBar({ percent, className = "h-1.5" }) {
  return (
    <div aria-hidden="true" className={`overflow-hidden rounded-full bg-white/10 ${className}`}>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-tnt to-ember text-onbrand"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}

const SHORT_LABELS = {
  saque: "Saque",
  recepcion: "Recep.",
  antebrazo: "Defensa",
  colocacion: "Coloc.",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
};

// Es un resumen visual: las notas exactas se leen en las barras de al lado.
export function SkillRadar({ skills, scores }) {
  const center = 120;
  const radius = 76;
  const pointAt = (index, scale) => {
    const angle = (-90 + (index * 360) / skills.length) * (Math.PI / 180);
    return [center + Math.cos(angle) * radius * scale, center + Math.sin(angle) * radius * scale];
  };
  const shape = (scaleOf) => skills.map((skill, index) => pointAt(index, scaleOf(skill)).join(",")).join(" ");

  return (
    <svg viewBox="-40 0 320 240" aria-hidden="true" className="mx-auto w-full max-w-[20rem]">
      <defs>
        <linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF3800" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#FF8800" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon key={ring} points={shape(() => ring)} fill="none" stroke="rgba(255,255,255,0.12)" />
      ))}
      {skills.map((skill, index) => {
        const [x, y] = pointAt(index, 1);
        return <line key={skill.id} x1={center} y1={center} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" />;
      })}
      <motion.polygon
        points={shape((skill) => scores[skill.id] / 10)}
        fill="url(#radar-fill)"
        stroke="#FF8800"
        strokeWidth="2"
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
      {skills.map((skill, index) => {
        const [x, y] = pointAt(index, scores[skill.id] / 10);
        return <circle key={skill.id} cx={x} cy={y} r="3.5" fill="#fff" />;
      })}
      {skills.map((skill, index) => {
        const [x, y] = pointAt(index, 1.24);
        const anchor = Math.abs(x - center) < 8 ? "middle" : x > center ? "start" : "end";
        return (
          <text key={skill.id} x={x} y={y + 4} textAnchor={anchor} fill="#d4d4d8" fontSize="12" fontWeight="700">
            {SHORT_LABELS[skill.id]}
          </text>
        );
      })}
    </svg>
  );
}

const shortDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const dayOf = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// Recibe las semanas de la más antigua a la más reciente.
export function EvolutionChart({ weeks }) {
  const width = 320;
  const height = 110;
  const values = weeks.map((week) => week.overall);
  const low = Math.max(0, Math.min(...values) - 8);
  const high = Math.min(100, Math.max(...values) + 8);
  const points = weeks.map((week, index) => [
    24 + (index * (width - 48)) / (weeks.length - 1),
    78 - ((week.overall - low) / (high - low || 1)) * 56,
  ]);
  const line = points.map((point) => point.join(",")).join(" ");
  const area = `24,92 ${line} ${width - 24},92`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="w-full">
      <defs>
        <linearGradient id="evolution-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF3800" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FF3800" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#evolution-area)" />
      <polyline points={line} fill="none" stroke="#FF8800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], index) => (
        <g key={weeks[index].week}>
          <circle cx={x} cy={y} r="4" fill={index === points.length - 1 ? "#fff" : "#FF8800"} />
          <text x={x} y={y - 9} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">{Math.round(weeks[index].overall)}</text>
          <text x={x} y={106} textAnchor="middle" fill="#a1a1aa" fontSize="10">{shortDate.format(dayOf(weeks[index].week))}</text>
        </g>
      ))}
    </svg>
  );
}
