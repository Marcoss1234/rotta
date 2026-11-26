import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import { ChipGroup, PageHeader } from "@/app/ui/index.js";
import { formatOverall } from "@/app/ranking.js";

// Cabecera de cada pantalla: ahora es la pieza común PageHeader (compacta, con la letra de cada identidad). Se
// mantiene este nombre para las pantallas que lo usan.
export function RankingHero({ title, subtitle, stacked = false, children }) {
  return <PageHeader title={title} subtitle={subtitle} stacked={stacked} actions={children} />;
}

// Título de una tarjeta: el icono en un círculo con el tono suave del club (el color del club, de acento en el
// icono) y el texto al lado. El icono sobre su círculo tiene 3:1 en todos los temas (lo comprueba
// npm run comprobar-temas: «Seleccionado: icono sobre su fondo»).
export function CardTitle({ icon: Icon, id, children, as: Tag = "h2" }) {
  return (
    <Tag id={id} className="flex items-center gap-2.5 font-display text-xl font-bold text-ink">
      {Icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-club-soft text-club-ui">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
      )}
      {children}
    </Tag>
  );
}

// Elegir equipo: una sola fila que se desliza si no caben todos (ChipGroup de src/app/ui: el elegido con el tono
// suave del club y su borde, el resto con contorno). Con un solo equipo no sale.
export function GroupPicker({ groups, groupId, onChange }) {
  if (groups.length < 2) return null;
  return (
    <ChipGroup
      label="Elegir equipo"
      scroll
      value={groupId}
      onChange={onChange}
      options={groups.map((group) => ({ value: group.id, label: group.name.replace(/^Club (Senior )?/, "") }))}
    />
  );
}

// Cada posición tiene su color propio (no el del club), el mismo en la etiqueta, en la chapa de la pista y en el
// cambio de puesto. Las familias de Tailwind siguen al modo claro u oscuro (src/theme-palette.css), así que el
// texto se lee en los dos. Texto de 12 px como mínimo.
// - tag: etiqueta (PositionTag). dot: el punto de color.
// - chip: el aro de la chapa en la pista; libero: el líbero lleva la chapa rellena de su color (otra camiseta).
// - label: el puesto escrito bajo la chapa (la pista va siempre en oscuro).
export const POSITION_TONES = {
  Líbero: { tag: "bg-sky-400/10 text-sky-300 ring-sky-400/30", dot: "bg-sky-400", chip: "border-sky-400 bg-sky-400 text-zinc-950", label: "text-sky-300" },
  Colocador: { tag: "bg-violet-400/10 text-violet-300 ring-violet-400/30", dot: "bg-violet-400", chip: "border-violet-400", label: "text-violet-300" },
  Receptor: { tag: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30", dot: "bg-emerald-400", chip: "border-emerald-400", label: "text-emerald-300" },
  // El ámbar, un tono más oscuro en claro (amber-200 pasa a amber-800): con el 300 quedaba justo en 4,5:1.
  Central: { tag: "bg-amber-400/10 text-amber-200 ring-amber-400/30", dot: "bg-amber-400", chip: "border-amber-400", label: "text-amber-300" },
  Opuesto: { tag: "bg-rose-400/10 text-rose-300 ring-rose-400/30", dot: "bg-rose-400", chip: "border-rose-400", label: "text-rose-300" },
};
const NEUTRAL_TONE = { tag: "bg-raised text-ink-muted ring-line", dot: "bg-ink-muted", chip: "border-white", label: "text-zinc-300" };
export const positionTone = (position) => POSITION_TONES[position] ?? NEUTRAL_TONE;

export function PositionTag({ position }) {
  const { tag, dot } = positionTone(position);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${tag}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {position}
    </span>
  );
}

// La nota global: dorada solo con 85 o más (lo que de verdad es oro). El resto, en el color del texto, sin colores
// de estado ni del club (decisión de Ranking y Notas: el segundo color del club no da información).
export function overallTone(overall) {
  if (overall === null || overall === undefined) return "text-ink-muted";
  if (overall >= 85) return "text-gold-text";
  return "text-ink";
}

export function OverallNumber({ overall, className = "text-3xl" }) {
  return (
    <span className={`font-score leading-none ${overallTone(overall)} ${className}`}>
      <span className="sr-only">Nota global </span>{formatOverall(overall)}
    </span>
  );
}

export function MovementPill({ value, hasPrevious }) {
  if (!hasPrevious) return null;
  if (value === null) {
    return <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-bold text-ink-muted">Nuevo</span>;
  }
  if (value === 0) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-raised text-ink-muted">
        <Equal aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="sr-only">Sigue igual</span>
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-sm font-bold ${up ? "bg-voy/10 text-voy-text" : "bg-danger/10 text-danger-text"}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span className="sr-only">{up ? "Sube" : "Baja"} </span>
      {Math.abs(value)}
    </span>
  );
}

export function AnimatedBar({ percent, className = "h-1.5" }) {
  return (
    <div aria-hidden="true" className={`chart-bar overflow-hidden rounded-full bg-ink/10 ${className}`}>
      <motion.div
        className="h-full rounded-full bg-club-ui"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}

// Nombres cortos de las habilidades (radar y resumen de cada fila en Notas).
export const SHORT_LABELS = {
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
    // Colores del tema (chart-* en index.css): rejilla en las líneas del tema, relleno y borde en el color del club
    // ajustado (club-ui), letras en el texto secundario. Grosor de línea de la identidad (--chart-line).
    <svg viewBox="-40 0 320 240" aria-hidden="true" className="chart mx-auto w-full max-w-[18rem]">
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon key={ring} points={shape(() => ring)} className="chart-grid" fill="none" />
      ))}
      {skills.map((skill, index) => {
        const [x, y] = pointAt(index, 1);
        return <line key={skill.id} x1={center} y1={center} x2={x} y2={y} className="chart-grid" />;
      })}
      <motion.polygon
        points={shape((skill) => scores[skill.id] / 10)}
        className="chart-area-strong"
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
      {skills.map((skill, index) => {
        const [x, y] = pointAt(index, scores[skill.id] / 10);
        return <circle key={skill.id} cx={x} cy={y} r="3.5" className="chart-point" />;
      })}
      {skills.map((skill, index) => {
        const [x, y] = pointAt(index, 1.24);
        const anchor = Math.abs(x - center) < 8 ? "middle" : x > center ? "start" : "end";
        return (
          <text key={skill.id} x={x} y={y + 4} textAnchor={anchor} className="chart-label" fontSize="13" fontWeight="700">
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
    // Colores del tema (chart-* en index.css) y tamaño máximo: en escritorio no se estira (las letras no crecen).
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="chart mx-auto w-full max-w-md">
      <polygon points={area} className="chart-area" />
      <polyline points={line} className="chart-line" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], index) => (
        <g key={weeks[index].week}>
          <circle cx={x} cy={y} r="4" className={index === points.length - 1 ? "chart-point-last" : "chart-point"} />
          <text x={x} y={y - 9} textAnchor="middle" className="chart-value" fontSize="12" fontWeight="800">{Math.round(weeks[index].overall)}</text>
          <text x={x} y={106} textAnchor="middle" className="chart-label" fontSize="10">{shortDate.format(dayOf(weeks[index].week))}</text>
        </g>
      ))}
    </svg>
  );
}
