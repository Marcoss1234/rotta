import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Coins, Flag, Hand, Info, MoreVertical, MousePointerClick, Play, RotateCcw, Star, Timer, Trash2, Trophy, Undo2, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { addLiveEvent, changeLiveMvp, deleteLive, finishLive, getLive, resetLive, setLiveOrder, startLive, undoLiveEvent } from "@/app/api.js";
import ConfirmDialog from "@/app/components/board/ConfirmDialog.jsx";
import { CourtDrawing } from "@/app/components/CourtBoard.jsx";
import { initialsOf } from "@/app/components/GoingCourt.jsx";
import MatchReport from "@/app/components/MatchReport.jsx";
import usePolling from "@/app/usePolling.js";

const POLL_MS = 2000;
const SKILLS = [
  ["saque", "Saque"],
  ["recepcion", "Recepción"],
  ["colocacion", "Colocación"],
  ["ataque", "Ataque"],
  ["bloqueo", "Bloqueo"],
  ["defensa", "Defensa"],
];
const SKILL_LABEL = Object.fromEntries(SKILLS);
// Lo que gana el punto si sale bien, y lo que lo pierde si sale mal.
const WINS_POINT = new Set(["saque", "ataque", "bloqueo"]);
const LOSES_POINT = new Set(["saque", "recepcion", "colocacion", "ataque", "bloqueo", "defensa"]);
// Lo que se puede apuntar como perfecto (la doble positiva): no da punto, pero prepara el ataque.
const PERFECT_SKILLS = new Set(["recepcion", "colocacion", "defensa"]);
// Lo que más hace cada posición, arriba del todo al tocarla. Así la líbero y la colocadora también suman en las
// estadísticas aunque no acaben puntos.
const POSITION_ACTIONS = {
  Líbero: [["recepcion", true], ["recepcion", false], ["defensa", true], ["defensa", false]],
  Colocador: [["colocacion", true], ["colocacion", false], ["defensa", false], ["saque", false]],
  Receptor: [["recepcion", true], ["recepcion", false], ["ataque", false], ["defensa", false]],
  Central: [["ataque", false], ["bloqueo", false], ["saque", false], ["defensa", false]],
  Opuesto: [["ataque", false], ["bloqueo", false], ["saque", false], ["defensa", false]],
};
const POSITION_SHORT = { Líbero: "LIB", Colocador: "COL", Receptor: "REC", Central: "CEN", Opuesto: "OPU" };

const firstName = (name) => name.trim().split(/\s+/)[0];

function Ball({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10.6" fill="#fff" />
      <g fill="none" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round">
        <path d="M12 1.6c-1.6 4.4-1.2 8.2 1.2 10.6" />
        <path d="M13.2 12.2c4.6-.2 7.6 1.6 9 4.4" />
        <path d="M13.2 12.2c-2.4 3.8-5.8 5.8-9.4 5.9" />
        <path d="M3.6 6.4c3 .3 6.2 2 9.6 5.8" />
      </g>
    </svg>
  );
}

function describe(event, lineup, opponent) {
  const player = lineup.find((item) => item.player_id === event.player_id);
  const who = player ? firstName(player.name) : "Equipo";
  if (event.type === "point") return event.side === "us" ? "Punto Club" : `Punto ${opponent}`;
  if (event.type === "timeout") return `Tiempo muerto ${event.side === "us" ? "Club" : opponent}`;
  const what = event.skill ? `${SKILL_LABEL[event.skill]}${event.perfect ? " perfecta" : ""}` : event.result === "good" ? "Acierto" : "Fallo";
  const mark = event.result === "good" ? "✓" : "✗";
  const point = event.point ? (event.point === "us" ? " · +1 Club" : ` · +1 ${opponent}`) : "";
  return `${who} · ${what} ${mark}${point}`;
}

// El mejor del partido hasta ahora: más aciertos que fallos (y, si empatan, más puntos).
function bestPlayer(game) {
  let best = null;
  for (const player of game.lineup) {
    const stats = game.stats[player.player_id];
    if (!stats) continue;
    const score = stats.good - stats.bad + stats.points * 0.5;
    if (score > 0 && (!best || score > best.score)) best = { id: player.player_id, score };
  }
  return best?.id ?? null;
}

// Una mitad del marcador. Quien lleva el marcador la toca para sumar el punto.
function ScoreSide({ side, name, score, sets, serving, timeouts, canScore, onPoint, busy }) {
  const us = side === "us";
  const content = (
    <>
      <span className="flex items-center gap-1.5 truncate text-xs font-extrabold text-white/85">
        {serving && <Ball className="live-serve h-4 w-4 shrink-0" />}
        <span className="truncate">{name}</span>
      </span>
      <span key={score} className="score-pop block font-display text-[clamp(3.6rem,min(20vw,12vh),7rem)] font-extrabold leading-[0.9] tabular-nums drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)] md:text-[clamp(4rem,9vh,7rem)]">
        {score}
      </span>
      <span className="flex items-center gap-2">
        <span className="flex gap-1" aria-label={`${sets} sets ganados`}>
          {[0, 1, 2].map((index) => (
            <span key={index} className={`h-2 w-2 rounded-full ${index < sets ? (us ? "bg-white" : "bg-sky-200") : "bg-white/20"}`} />
          ))}
        </span>
        {timeouts > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-white/70">
            <Timer aria-hidden="true" className="h-3 w-3" />
            {timeouts}
          </span>
        )}
      </span>
      {canScore && <span className="mt-1 rounded-full bg-black/25 px-3 py-0.5 text-[11px] font-extrabold">+1 punto</span>}
    </>
  );
  const look = `live-score relative flex min-h-[clamp(8rem,22vh,13rem)] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl px-2 py-3 text-white ring-1 ring-white/15 ${
    us ? "bg-gradient-to-br from-tnt via-tnt to-tntdeep shadow-[0_10px_40px_rgba(255,56,0,0.35)] text-onbrand" : "bg-gradient-to-br from-sky-500 via-sky-700 to-slate-900 shadow-[0_10px_40px_rgba(14,165,233,0.25)] text-snow"
  }`;
  if (!canScore) return <div className={look}>{content}</div>;
  return (
    <button type="button" disabled={busy} onClick={onPoint} aria-label={`Punto para ${name}`} className={`${look} shadow-[0_8px_24px_rgba(0,0,0,0.45)]`}>
      {content}
    </button>
  );
}

// Media pista: los 6 titulares; el resto, en el banquillo.
const COURT_PLACES = 6;
// Sus sitios, con la red arriba: delante 4 3 2 y detrás 5 6 1 (en orden de la lista).
const HALF_SPOTS = [
  { x: 0.18, y: 0.27 },
  { x: 0.5, y: 0.27 },
  { x: 0.82, y: 0.27 },
  { x: 0.18, y: 0.73 },
  { x: 0.5, y: 0.73 },
  { x: 0.82, y: 0.73 },
];
// Media pista real: 9 m de ancho y 9 de fondo (aquí con la zona libre, algo menos de alto que de ancho).
const HALF_RATIO = 95 / 100;

// Mide el hueco libre y elige la pista que más lo llena: en el móvil, de pie; en pantallas anchas, tumbada.
function useCourtFit() {
  // Con una función como ref se empieza a medir justo cuando aparece el hueco (después de cargar el partido).
  const [node, ref] = useState(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  // Media pista con la red arriba. En el móvil llena el hueco aunque no tenga las medidas exactas.
  const phone = box.width < 640;
  const width = phone ? box.width : Math.min(box.width, box.height / HALF_RATIO);
  const height = phone ? Math.min(box.height, width * 1.15) : width * HALF_RATIO;
  return { ref, vertical: true, phone, width: Math.floor(width), height: Math.floor(height) };
}

// El nombre siempre entero (nunca con "…"): si es largo, la letra se hace más pequeña para que quepa.
const LABEL_FITS = 10;
const labelScale = (name, short) => {
  const length = name.length + (short ? short.length + 1 : 0);
  return length <= LABEL_FITS ? 1 : Math.max(0.6, LABEL_FITS / length);
};

// Un jugador en la pista: su foto o iniciales, el dorsal, el nombre y sus aciertos y fallos.
function CourtPlayer({ player, stats, mvp, spot, canScore, onOpen, compact = false, dragProps = null, dragging = false }) {
  const good = stats?.good ?? 0;
  const bad = stats?.bad ?? 0;
  const short = POSITION_SHORT[player.position];
  const body = (
    <>
      <span className={`relative block ${compact ? "w-[44%]" : "w-[58%]"}`}>
        <span
          style={{ fontSize: compact ? "min(6.6cqmin, 3.6cqw)" : "6.6cqmin" }}
          className={`flex aspect-square items-center justify-center overflow-hidden rounded-full border-2 bg-zinc-950 font-extrabold text-white shadow-[0_2px_8px_rgba(0,0,0,0.55)] ${mvp ? "border-amber-300" : "border-white"}`}
        >
          {player.picture ? <img src={player.picture} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : initialsOf(player.name)}
        </span>
        {player.number !== null && player.number !== undefined && (
          <span style={compact ? { fontSize: "min(5.6cqmin, 3cqw)", minWidth: "min(8cqmin, 4.4cqw)", padding: "0.6cqmin 1.1cqmin" } : { fontSize: "5.6cqmin", minWidth: "8cqmin", padding: "0.6cqmin 1.1cqmin" }} className="absolute -bottom-[10%] -right-[30%] rounded-full bg-tnt text-center font-extrabold leading-none text-onbrand">
            {player.number}
          </span>
        )}
        {mvp && <Star aria-label="El mejor ahora" style={{ width: "7.6cqmin", height: "7.6cqmin" }} className="absolute -left-[18%] -top-[10%] fill-amber-300 text-amber-300 drop-shadow" />}
      </span>
      <span style={{ fontSize: `${labelScale(firstName(player.name), short).toFixed(2)}em` }} className="mt-[1cqmin] flex gap-[1.4cqmin] whitespace-nowrap rounded-md bg-black/85 px-[1.5cqmin] font-bold leading-[1.35] text-white shadow">
        <span>{firstName(player.name)}</span>
        {short && <span className="shrink-0 text-ember">{short}</span>}
      </span>
      {(good > 0 || bad > 0) && (
        <span className={`flex gap-[1cqmin] font-extrabold tabular-nums leading-[1.3] ${compact ? "absolute -right-[6%] top-0 flex-col" : "mt-[0.8cqmin]"}`}>
          {good > 0 && <span className="rounded bg-emerald-500 px-[1.3cqmin] text-snow shadow">✓{good}</span>}
          {bad > 0 && <span className="rounded bg-red-500 px-[1.3cqmin] text-snow shadow">✗{bad}</span>}
        </span>
      )}
    </>
  );
  // De pie (móvil) cada ficha tiene más ancho, para que el nombre y la posición se lean enteros.
  const place = {
    left: `${spot.x * 100}%`,
    top: `${spot.y * 100}%`,
    // Nunca más ancho que su columna (4 de lado, 3 de pie), para no pisar al de al lado.
    width: compact ? "min(31cqmin, 24cqw)" : "min(36cqmin, 32cqw)",
    fontSize: compact ? "min(5.2cqmin, 3.2cqw)" : "min(4.9cqmin, 4.4cqw)",
  };
  const look = `absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${dragging ? "opacity-30" : ""}`;
  const style = dragProps ? { ...place, touchAction: "none" } : place;
  if (!canScore) return <span title={player.name} style={style} className={look} {...dragProps}>{body}</span>;
  return (
    <button type="button" onClick={onOpen} aria-label={`${player.name}: apuntar acierto o fallo`} style={style} className={`${look} rounded-xl`} {...dragProps}>
      {body}
    </button>
  );
}

// En el banquillo (si van más de 12): una ficha pequeña por jugador, igual de tocable.
function BenchPlayer({ player, stats, mvp, canScore, onOpen, dragProps = null, dragging = false }) {
  const good = stats?.good ?? 0;
  const bad = stats?.bad ?? 0;
  const inner = (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tnt text-xs font-extrabold text-onbrand">{player.number ?? initialsOf(player.name)}</span>
      <span className="whitespace-nowrap text-xs font-bold">{firstName(player.name)}</span>
      {(good > 0 || bad > 0) && (
        <span className="text-[10px] font-extrabold tabular-nums">
          {good > 0 && <span className="text-emerald-300">✓{good}</span>} {bad > 0 && <span className="text-red-300">✗{bad}</span>}
        </span>
      )}
    </>
  );
  const look = `flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-panel py-0.5 pl-0.5 pr-2.5 ring-1 ${mvp ? "ring-amber-300/60" : "ring-white/10"} ${dragging ? "opacity-30" : ""}`;
  // Del banquillo se arrastra a la pista.
  const style = dragProps ? { touchAction: "none" } : undefined;
  if (!canScore) return <span style={style} className={look} {...dragProps}>{inner}</span>;
  return (
    <button type="button" onClick={onOpen} aria-label={`${player.name}: apuntar acierto o fallo`} style={style} className={look} {...dragProps}>
      {inner}
    </button>
  );
}

// Al tocar un jugador: un toque en la acción y queda apuntada (con su punto, si lo gana o lo pierde).
function PlayerSheet({ player, opponent, onPick, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const pointFor = (result, skill) => (result === "good" ? (WINS_POINT.has(skill) ? "us" : null) : LOSES_POINT.has(skill) ? "them" : null);
  const pick = (result, skill, perfect = false) => onPick({ result, skill, point: pointFor(result, skill), ...(perfect ? { perfect: true } : {}) });
  const quick = POSITION_ACTIONS[player.position] ?? [];
  const noPointRole = player.position === "Líbero" || player.position === "Colocador";
  const plusOne = (point) =>
    point && <span className={`rounded-full px-1.5 text-[10px] font-extrabold ${point === "us" ? "bg-tnt text-onbrand" : "bg-sky-600 text-snow"}`}>+1</span>;
  const column = (result) => (
    <div className="space-y-1.5">
      <p className={`flex items-center justify-center gap-1 text-xs font-extrabold ${result === "good" ? "text-emerald-300" : "text-red-300"}`}>
        {result === "good" ? <Check aria-hidden="true" className="h-4 w-4" /> : <X aria-hidden="true" className="h-4 w-4" />}
        {result === "good" ? "Acierto" : "Fallo"}
      </p>
      {SKILLS.map(([skill, label]) => {
        const point = pointFor(result, skill);
        const tone =
          result === "good" ? "bg-emerald-500/15 text-emerald-50 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25" : "bg-red-500/15 text-red-50 ring-1 ring-red-400/30 hover:bg-red-500/25";
        return (
          <div key={skill} className="flex gap-1">
            <button
              type="button"
              onClick={() => pick(result, skill)}
              className={`flex min-h-11 min-w-0 flex-1 items-center justify-between gap-1 rounded-xl px-3 text-sm font-bold ${tone}`}
            >
              <span className="truncate">{label}</span>
              {plusOne(point)}
            </button>
            {result === "good" && PERFECT_SKILLS.has(skill) && (
              <button
                type="button"
                onClick={() => pick("good", skill, true)}
                aria-label={`${label} perfecta`}
                title={`${label} perfecta`}
                className="flex min-h-11 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/40 hover:bg-amber-400/25"
              >
                <Star aria-hidden="true" className="h-4 w-4 fill-current" />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onPick({ result, skill: null, point: null })}
        className="min-h-10 w-full rounded-xl text-xs font-bold text-zinc-300 ring-1 ring-white/10 hover:bg-white/5"
      >
        {result === "good" ? "Acierto sin punto" : "Fallo sin punto"}
      </button>
    </div>
  );
  const quickActions = quick.length > 0 && (
    <section aria-labelledby="player-sheet-quick" className="mb-3 rounded-xl bg-white/[0.04] p-2 ring-1 ring-white/10">
      <p id="player-sheet-quick" className="mb-1.5 px-1 text-xs font-extrabold uppercase tracking-widest text-zinc-300">
        Lo suyo · {player.position}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {quick.map(([skill, perfect]) => {
          const point = pointFor("good", skill);
          return (
            <button
              key={`${skill}-${perfect}`}
              type="button"
              onClick={() => pick("good", skill, perfect)}
              className={`flex min-h-12 items-center justify-between gap-1 rounded-xl px-3 text-left text-sm font-bold ${
                perfect
                  ? "bg-amber-400/20 text-amber-50 ring-1 ring-amber-300/50 hover:bg-amber-400/30"
                  : "bg-emerald-500/15 text-emerald-50 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25"
              }`}
            >
              <span>
                {SKILL_LABEL[skill]} {perfect ? "perfecta" : point ? "" : "buena"}
              </span>
              {perfect ? <Star aria-hidden="true" className="h-4 w-4 shrink-0 fill-current text-amber-300" /> : plusOne(point)}
            </button>
          );
        })}
      </div>
      {noPointRole && <p className="mt-1.5 px-1 text-[11px] leading-snug text-zinc-400">No dan punto, pero cuentan en sus estadísticas. ★ = perfecta (doble positiva).</p>}
    </section>
  );
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="player-sheet-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-surface p-3 font-body text-white backdrop:bg-black/70"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tnt font-display text-lg font-extrabold text-onbrand">{player.number ?? "–"}</span>
        <span className="min-w-0 flex-1">
          <span id="player-sheet-title" className="block truncate font-display text-lg font-extrabold">{player.name}</span>
          <span className="block text-xs text-zinc-400">«+1» suma el punto a Club (naranja) o a {opponent} (azul)</span>
        </span>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10">
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      {quickActions}
      <div className="grid grid-cols-2 gap-2">
        {column("good")}
        {column("bad")}
      </div>
    </dialog>
  );
}

// Al terminar: el entrenador elige el MVP. Viene marcado el que mejor ha ido según lo apuntado.
// Cómo se usa la pantalla: para quien lleva el marcador, todo; para el resto, lo que ven.
// Las listas de las ventanas usan `flex-auto` (no `flex-1`): en Safari del iPhone, con `flex-1`
// la lista se encogía casi a cero y solo se veía la primera línea.
function HelpDialog({ scorer, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const tips = scorer
    ? [
        [Play, "Empezar", "Dale a «Empezar partido» cuando empiece: se avisa al equipo."],
        [Hand, "Titulares y banquillo", "Arrastra un jugador encima de otro para cambiarlos (también del banquillo a la pista)."],
        [MousePointerClick, "Aciertos y fallos", "Toca a un jugador y elige en qué ha acertado o fallado."],
        [Star, "Líbero y colocador", "Arriba salen las acciones de su posición. Recepción, colocación y defensa no dan punto pero cuentan; ★ es perfecta (doble positiva)."],
        [Check, "Puntos", "«+1 punto» a quien lo gana. Si no lo apuntas a un jugador, cuenta como fallo o acierto del rival."],
        [Undo2, "Deshacer y reiniciar", "«Deshacer» quita lo último. En ⋮ → «Reiniciar partido» se empieza de cero."],
        [Flag, "Terminar", "En ⋮ → «Terminar partido»: eliges el MVP y se guarda. Si ganáis, +50 Club Coins a cada uno."],
      ]
    : [
        [Play, "En directo", "Aquí ves el marcador punto a punto mientras se juega."],
        [Hand, "La pista", "Los 6 de la pista son los titulares; los demás están en el banquillo."],
        [Check, "Aciertos y fallos", "Debajo de cada jugador salen sus ✓ aciertos y ✗ fallos del partido."],
        [Trophy, "Al terminar", "El entrenador elige el MVP. Si ganáis, cada uno gana 50 Club Coins."],
      ];
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="live-help-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-sm flex-col rounded-2xl border border-white/10 bg-surface p-0 font-body text-white backdrop:bg-black/70"
    >
      <div className="flex items-center gap-2 bg-gradient-to-r from-red-600 via-tnt to-ember px-4 py-3 text-snow">
        <Info aria-hidden="true" className="h-6 w-6 shrink-0" />
        <h2 id="live-help-title" className="font-display text-xl font-extrabold leading-tight">
          Cómo funciona
        </h2>
      </div>
      <ul className="min-h-0 flex-auto space-y-2.5 overflow-y-auto px-4 py-3">
        {tips.map(([Icon, title, text]) => (
          <li key={title} className="flex gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tnt/15 text-tnt ring-1 ring-tnt/30">
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-extrabold">{title}</span>
              <span className="block text-[13px] leading-snug text-zinc-300">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="p-3 pt-0">
        <button type="button" onClick={onClose} className="min-h-12 w-full rounded-xl bg-tnt font-display text-base font-extrabold text-onbrand">
          Entendido
        </button>
      </div>
    </dialog>
  );
}

// `changing`: el partido ya terminó y el entrenador cambia el MVP que eligió (o lo quita).
function MvpDialog({ game, suggested, onFinish, onCancel, changing = false }) {
  const dialogRef = useRef(null);
  const [chosen, setChosen] = useState(changing ? (game.mvp?.player_id ?? null) : suggested);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const ranked = [...game.lineup].sort((a, b) => {
    const score = (player) => {
      const stats = game.stats[player.player_id];
      return stats ? stats.good - stats.bad + stats.points * 0.5 : -99;
    };
    return score(b) - score(a);
  });
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="mvp-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto flex max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-sm flex-col rounded-2xl border border-white/10 bg-surface p-0 font-body text-white backdrop:bg-black/70"
    >
      <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 p-4 text-void">
        <p className="flex items-center gap-2 font-display text-xl font-extrabold">
          <Trophy aria-hidden="true" className="h-6 w-6" />
          <span id="mvp-title">{changing ? "Cambiar el MVP" : "¿Quién ha sido el MVP?"}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
          Gana <Coins aria-hidden="true" className="h-4 w-4" /> {15} Club Coins y se queda en sus premios.
        </p>
      </div>
      <ul className="min-h-0 flex-auto space-y-1.5 overflow-y-auto p-3">
        {ranked.map((player) => {
          const stats = game.stats[player.player_id];
          const selected = chosen === player.player_id;
          return (
            <li key={player.player_id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChosen(player.player_id)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${selected ? "bg-amber-400/15 ring-2 ring-amber-300" : "bg-panel ring-1 ring-white/10"}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tnt text-sm font-extrabold text-onbrand">{player.number ?? initialsOf(player.name)}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{player.name}</span>
                {player.player_id === suggested && <span className="shrink-0 rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-200">Sugerido</span>}
                <span className="shrink-0 text-xs font-extrabold tabular-nums">
                  <span className="text-emerald-300">✓{stats?.good ?? 0}</span> <span className="text-red-300">✗{stats?.bad ?? 0}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3">
        <button type="button" onClick={() => onFinish(null)} className="min-h-11 rounded-lg border border-white/25 text-sm font-semibold hover:bg-white/5">
          Sin MVP
        </button>
        <button type="button" disabled={!chosen} onClick={() => onFinish(chosen)} className="min-h-11 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-sm font-extrabold text-void disabled:opacity-50">
          Guardar MVP
        </button>
      </div>
      <button type="button" onClick={onCancel} className="mx-3 mb-3 min-h-10 rounded-lg text-xs font-semibold text-zinc-400 hover:bg-white/5">
        {changing ? "Cancelar" : "Aún no, seguir el partido"}
      </button>
    </dialog>
  );
}

export default function LiveMatchPage({ onAccessLost }) {
  const { liveId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheetFor, setSheetFor] = useState(null);
  const [menu, setMenu] = useState(false);
  const [timeoutChoice, setTimeoutChoice] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [banner, setBanner] = useState(null);
  const [choosingMvp, setChoosingMvp] = useState(false);
  const [helping, setHelping] = useState(false);
  // Al terminar, se abre el informe; se puede cerrar para ver la pista y volver a abrirlo.
  const [hideReport, setHideReport] = useState(false);
  const pending = useRef(0);
  // Arrastrar un jugador encima de otro (o del banquillo a la pista) los cambia de sitio.
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const justDragged = useRef(false);
  const court = useCourtFit();
  const lastSets = useRef(null);

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401) onAccessLost();
    else setError(requestError.message);
  }, [onAccessLost]);

  // Cuando se cierra un set, sale un aviso grande un momento.
  const apply = useCallback((next) => {
    setGame(next);
    const before = lastSets.current;
    lastSets.current = next.sets.length;
    if (before !== null && next.sets.length > before) {
      const set = next.sets.at(-1);
      const ours = set.us > set.them;
      setBanner({ key: Date.now(), text: next.finished ? (next.winner === "us" ? "¡Victoria!" : "Partido perdido") : `Set ${next.sets.length} para ${ours ? "Club" : next.opponent}`, score: `${set.us} - ${set.them}`, ours });
    }
  }, []);

  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(() => setBanner(null), 2600);
    return () => clearTimeout(timer);
  }, [banner]);

  const poll = useCallback(async () => {
    if (pending.current > 0) return;
    try {
      const next = await getLive(liveId);
      if (pending.current === 0) apply(next);
    } catch (requestError) {
      if (requestError.status === 404) navigate("/app?pestana=partidos", { replace: true });
      else handleError(requestError);
    }
  }, [liveId, apply, handleError, navigate]);
  usePolling(poll, POLL_MS);

  const send = async (action) => {
    pending.current += 1;
    setBusy(true);
    setError("");
    try {
      apply(await action());
    } catch (requestError) {
      handleError(requestError);
    } finally {
      pending.current -= 1;
      setBusy(false);
    }
  };

  const point = (side) => send(() => addLiveEvent(liveId, { type: "point", side }));

  const swapPlayers = (fromId, toId) => {
    const order = game.lineup.map((item) => item.player_id);
    const from = order.indexOf(fromId);
    const to = order.indexOf(toId);
    if (from < 0 || to < 0 || from === to) return;
    [order[from], order[to]] = [order[to], order[from]];
    const byId = new Map(game.lineup.map((item) => [item.player_id, item]));
    setGame((current) => ({ ...current, lineup: order.map((id) => byId.get(id)) }));
    send(() => setLiveOrder(liveId, order));
  };

  useEffect(() => {
    const move = (event) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 10) return;
      current.moved = true;
      setDrag({ ...current.player, x: event.clientX, y: event.clientY });
    };
    const end = (event) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      dragRef.current = null;
      setDrag(null);
      if (!current.moved) return;
      // El toque que acaba un arrastre no abre la ficha del jugador.
      justDragged.current = true;
      setTimeout(() => {
        justDragged.current = false;
      }, 0);
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-player]")?.dataset.player;
      if (target && target !== current.player.player_id) swapPlayers(current.player.player_id, target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  });
  const stat = (body) => send(() => addLiveEvent(liveId, { type: "stat", ...body }));

  if (!game) {
    return (
      <section className="fixed inset-0 z-50 flex items-center justify-center bg-void md:left-60">
        <p role="status" className="text-zinc-300">{error || "Cargando el partido…"}</p>
      </section>
    );
  }

  const live = game.status === "live";
  const notStarted = game.status === "pending";
  const canArrange = game.can_score || game.can_start;
  const dragPropsFor = (player) =>
    canArrange
      ? {
          "data-player": player.player_id,
          onPointerDown: (event) => {
            if (event.button > 0) return;
            dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, player };
          },
        }
      : null;
  const openSheet = (player) => {
    if (!justDragged.current) setSheetFor(player);
  };
  const canScore = game.can_score;
  const scoring = canScore && !game.finished;
  const mvp = bestPlayer(game);
  const latest = game.events.at(-1);
  const opponentShort = game.opponent.length > 14 ? `${game.opponent.slice(0, 13)}…` : game.opponent;

  return (
    <section aria-label={`Partido contra ${game.opponent}`} className="force-dark live-screen fixed inset-0 z-50 flex flex-col gap-2 overflow-hidden px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))] md:left-60 md:px-5 md:pb-5">
      {/* Cabecera */}
      <header className="flex h-11 shrink-0 items-center gap-2">
        <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/app?pestana=partidos"))} aria-label="Volver" className="-ml-1 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10">
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-extrabold leading-tight">
            {game.team_name.replace(/^Club /, "Club ")} <span className="text-zinc-500">vs</span> {game.opponent}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold">
            {notStarted ? (
              <span className="text-amber-300">Sin empezar</span>
            ) : live ? (
              <>
                <span aria-hidden="true" className="pulse-dot h-2 w-2 rounded-full bg-red-500 text-snow" />
                <span className="text-red-300">En directo</span>
              </>
            ) : (
              <span className="text-zinc-400">Terminado</span>
            )}
            <span className="text-zinc-500">· {notStarted ? "Set 1" : game.finished || !live ? "Final" : `Set ${game.set_number}`} · a {game.best_of === 5 ? 3 : 2} sets</span>
          </p>
        </div>
        <button type="button" onClick={() => setHelping(true)} aria-label="Cómo funciona" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-200 hover:bg-white/10">
          <Info aria-hidden="true" className="h-5 w-5" />
        </button>
        {(canScore || game.can_start) && (
          <div className="relative">
            <button type="button" onClick={() => setMenu((open) => !open)} aria-label="Más opciones" aria-expanded={menu} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10">
              <MoreVertical aria-hidden="true" className="h-5 w-5" />
            </button>
            {menu && <button type="button" tabIndex={-1} aria-label="Cerrar el menú" data-no-press onClick={() => setMenu(false)} className="fixed inset-0 z-[9] cursor-default" />}
            {menu && (
              <div className="absolute right-0 top-12 z-10 w-56 overflow-hidden rounded-xl bg-surface shadow-2xl ring-1 ring-white/10">
                {canScore && (
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setChoosingMvp(true);
                  }}
                  className="flex min-h-12 w-full items-center gap-2 px-3 text-sm font-semibold hover:bg-white/5"
                >
                  <Flag aria-hidden="true" className="h-4 w-4" />
                  Terminar partido
                </button>
                )}
                {canScore && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      setConfirming({
                        message: "¿Reiniciar el partido? Se borra todo lo apuntado (puntos, aciertos y fallos) y vuelve a salir «Empezar partido».",
                        label: "Reiniciar",
                        action: () => send(() => resetLive(liveId)),
                      });
                    }}
                    className="flex min-h-12 w-full items-center gap-2 px-3 text-sm font-semibold hover:bg-white/5"
                  >
                    <RotateCcw aria-hidden="true" className="h-4 w-4" />
                    Reiniciar partido
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setConfirming({
                      message: "¿Borrar este partido en directo? Se perderán el marcador y las estadísticas.",
                      label: "Borrar",
                      action: async () => {
                        await deleteLive(liveId).catch(handleError);
                        navigate("/app?pestana=partidos", { replace: true });
                      },
                    });
                  }}
                  className="flex min-h-12 w-full items-center gap-2 px-3 text-sm font-semibold text-red-200 hover:bg-white/5"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Borrar partido
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {drag && (
        <span
          aria-hidden="true"
          style={{ left: drag.x, top: drag.y }}
          className="pointer-events-none fixed z-[60] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-tnt text-lg font-extrabold text-onbrand shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
            {drag.number ?? initialsOf(drag.name)}
          </span>
          <span className="mt-1 whitespace-nowrap rounded-md bg-black/85 px-1.5 text-xs font-bold text-white">{firstName(drag.name)}</span>
        </span>
      )}
      {game.report && !hideReport && <MatchReport game={game} onClose={() => setHideReport(true)} onChangeMvp={game.can_edit_mvp ? () => setChoosingMvp(true) : null} />}
      {game.report && hideReport && (
        <button
          type="button"
          onClick={() => setHideReport(false)}
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 font-display text-base font-extrabold text-void"
        >
          <Trophy aria-hidden="true" className="h-5 w-5" />
          Ver el informe del partido
        </button>
      )}
      {/* Sin empezar: el entrenador lo arranca con un botón (entrar ya no lo empieza). */}
      {notStarted && (
        <div className="shrink-0 rounded-2xl bg-gradient-to-r from-amber-400/15 to-panel p-3 ring-1 ring-amber-300/30">
          {game.can_start ? (
            <>
              <p className="text-sm text-zinc-200">El partido aún no ha empezado. Cuando empiece, dale al botón y se avisa al equipo.</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => send(() => startLive(liveId))}
                className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-tnt to-ember font-display text-lg font-extrabold text-snow shadow-[0_8px_24px_rgba(255,56,0,0.35)] disabled:opacity-70"
              >
                <Play aria-hidden="true" className="h-5 w-5 fill-white" />
                {busy ? "Empezando…" : "Empezar partido"}
              </button>
            </>
          ) : (
            <p className="text-sm font-semibold text-amber-100">El partido aún no ha empezado. Cuando empiece, verás aquí el marcador punto a punto.</p>
          )}
        </div>
      )}

      <div className="live-layout min-h-0 flex-1">
      {/* Marcador */}
      <div style={{ gridArea: "score" }} className="relative grid grid-cols-2 gap-2">
        <ScoreSide side="us" name="Club" score={game.current.us} sets={game.won.us} serving={!game.finished && game.serving === "us"} timeouts={game.timeouts.us} canScore={scoring} busy={busy} onPoint={() => point("us")} />
        <ScoreSide side="them" name={opponentShort} score={game.current.them} sets={game.won.them} serving={!game.finished && game.serving === "them"} timeouts={game.timeouts.them} canScore={scoring} busy={busy} onPoint={() => point("them")} />
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl bg-void px-2.5 py-1.5 font-display font-extrabold leading-none shadow-[0_6px_20px_rgba(0,0,0,0.6)] ring-2 ring-white/10">
          <span className="text-[9px] text-zinc-400">{notStarted ? "Set" : game.finished || !live ? "Final" : "Set"}</span>
          <span className="text-xl text-white">{notStarted ? 1 : game.finished || !live ? `${game.won.us}-${game.won.them}` : game.set_number}</span>
        </span>
      </div>

      {/* Sets terminados */}
      {game.sets.length > 0 && (
        <ol aria-label="Sets" style={{ gridArea: "sets" }} className="flex items-center justify-center gap-1.5">
          {game.sets.map((set, index) => (
            <li key={index} className={`rounded-md px-2 py-0.5 text-xs font-extrabold tabular-nums ${set.us > set.them ? "bg-tnt/20 text-orange-200" : "bg-sky-500/15 text-sky-200"}`}>
              {set.us}-{set.them}
            </li>
          ))}
        </ol>
      )}

      {/* La pista con los que han dicho que van; si son más de 12, el resto en el banquillo. */}
      <div style={{ gridArea: "court" }} className="flex min-h-0 flex-col gap-2">
        <div ref={court.ref} className="relative flex min-h-0 flex-1 items-center justify-center">
          {game.lineup.length === 0 ? (
            <p className="max-w-xs rounded-2xl bg-panel/80 p-5 text-center text-sm text-zinc-300 ring-1 ring-white/10">
              Todavía nadie ha dicho que va a este partido. En cuanto respondan «Voy», aparecen aquí.
            </p>
          ) : (
            court.width > 0 && (
              <div
                role="group"
                aria-label="Jugadores en la pista"
                className="live-court relative overflow-hidden rounded-2xl ring-1 ring-white/15 [container-type:size]"
                style={{ width: court.width, height: court.height }}
              >
                {/* Solo nuestro campo: la pista entera, el doble de alta, y se ve la mitad de abajo (la red arriba). */}
                <div className="absolute inset-x-0 bottom-0" style={{ height: "200%" }}>
                  <CourtDrawing beach={game.team_id === "playa"} showZones={false} stretch />
                </div>
                {game.lineup.slice(0, COURT_PLACES).map((player, index) => {
                  const spot = HALF_SPOTS[index];
                  return (
                    <CourtPlayer
                      key={player.player_id}
                      player={player}
                      spot={spot}
                      stats={game.stats[player.player_id]}
                      mvp={mvp === player.player_id}
                      canScore={canScore && live}
                      onOpen={() => openSheet(player)}
                      dragProps={dragPropsFor(player)}
                      dragging={drag?.player_id === player.player_id}
                    />
                  );
                })}
              </div>
            )
          )}
        </div>
        {game.lineup.length > COURT_PLACES && (
          <div className="shrink-0">
            <p className="mb-1 flex items-baseline justify-between text-[10px] font-bold text-zinc-500">
              <span>Banquillo · {game.lineup.length - COURT_PLACES}</span>
              {canArrange && <span className="normal-case tracking-normal text-zinc-400">Arrastra para cambiar</span>}
            </p>
            {/* Todos a la vista (en varias filas si hace falta), para poder sacarlos a la pista arrastrando. */}
            <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto pb-1">
              {game.lineup.slice(COURT_PLACES).map((player) => (
                <BenchPlayer
                  key={player.player_id}
                  player={player}
                  stats={game.stats[player.player_id]}
                  mvp={mvp === player.player_id}
                  canScore={canScore && live}
                  onOpen={() => openSheet(player)}
                  dragProps={dragPropsFor(player)}
                  dragging={drag?.player_id === player.player_id}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* En pantallas anchas, debajo del marcador: las últimas jugadas. */}
      <ol aria-label="Últimas jugadas" style={{ gridArea: "feed" }} className="live-feed hidden min-h-0 flex-col justify-end gap-1 overflow-hidden md:flex">
        {[...game.events].reverse().slice(0, 10).map((event, index) => {
          const tone = event.type === "stat" ? (event.result === "good" ? "border-emerald-400" : "border-red-400") : event.type === "timeout" ? "border-zinc-500" : event.side === "us" ? "border-tnt" : "border-sky-500";
          return (
            <li key={event.id} style={{ opacity: 1 - index * 0.08 }} className={`truncate rounded-r-lg border-l-4 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-zinc-200 ${tone}`}>
              {describe(event, game.lineup, game.opponent)}
            </li>
          );
        })}
      </ol>

      <div style={{ gridArea: "controls" }} className="flex flex-col gap-2">
      {/* Última acción */}
      <div className="flex min-h-10 items-center gap-2 rounded-xl bg-white/[0.04] px-3 text-sm ring-1 ring-white/10 backdrop-blur">
        <span className="min-w-0 flex-1 truncate font-semibold text-zinc-200" aria-live="polite">
          {!live && game.mvp ? `🏆 MVP: ${game.mvp.name}` : latest ? describe(latest, game.lineup, game.opponent) : live ? "Empieza el partido: toca un marcador para sumar el punto" : "Sin acciones"}
        </span>
        <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-500">
          Equipo <span className="text-emerald-300">✓{game.team_stats.good}</span> <span className="text-red-300">✗{game.team_stats.bad}</span>
        </span>
      </div>

      {error && <p role="alert" className="shrink-0 text-center text-xs font-semibold text-red-300">{error}</p>}

      {/* Botones de equipo */}
      {canScore && live && (
        <div className="grid h-14 shrink-0 grid-cols-4 gap-1.5 md:h-16">
          <button type="button" disabled={busy} onClick={() => stat({ result: "good" })} className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-to-b from-emerald-500/25 to-emerald-500/10 text-emerald-100 ring-1 ring-emerald-400/40">
            <Check aria-hidden="true" className="h-5 w-5" />
            <span className="text-[10px] font-extrabold">Equipo</span>
          </button>
          <button type="button" disabled={busy} onClick={() => stat({ result: "bad" })} className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-to-b from-red-500/25 to-red-500/10 text-red-100 ring-1 ring-red-400/40">
            <X aria-hidden="true" className="h-5 w-5" />
            <span className="text-[10px] font-extrabold">Equipo</span>
          </button>
          <div className="relative">
            <button type="button" disabled={busy || game.finished} onClick={() => setTimeoutChoice((open) => !open)} aria-expanded={timeoutChoice} className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-xl bg-white/[0.06] text-zinc-100 ring-1 ring-white/10 disabled:opacity-40">
              <Timer aria-hidden="true" className="h-5 w-5" />
              <span className="text-[10px] font-extrabold">Tiempo</span>
            </button>
            {timeoutChoice && <button type="button" tabIndex={-1} aria-label="Cerrar" data-no-press onClick={() => setTimeoutChoice(false)} className="fixed inset-0 z-[9] cursor-default" />}
            {timeoutChoice && (
              <div className="absolute bottom-16 left-1/2 z-10 w-44 -translate-x-1/2 overflow-hidden rounded-xl bg-surface shadow-2xl ring-1 ring-white/10">
                {[["us", "Club"], ["them", opponentShort]].map(([side, label]) => (
                  <button
                    key={side}
                    type="button"
                    disabled={game.timeouts[side] >= 2}
                    onClick={() => {
                      setTimeoutChoice(false);
                      send(() => addLiveEvent(liveId, { type: "timeout", side }));
                    }}
                    className="flex min-h-11 w-full items-center justify-between px-3 text-sm font-semibold hover:bg-white/5 disabled:opacity-40"
                  >
                    {label}
                    <span className="text-xs text-zinc-400">{game.timeouts[side]}/2</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" disabled={busy || game.event_count === 0} onClick={() => send(() => undoLiveEvent(liveId))} className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-white/[0.06] text-zinc-100 ring-1 ring-white/10 disabled:opacity-40">
            <Undo2 aria-hidden="true" className="h-5 w-5" />
            <span className="text-[10px] font-extrabold">Deshacer</span>
          </button>
        </div>
      )}

      {/* Partido decidido: terminar y guardar */}
      {canScore && live && game.finished && (
        <button
          type="button"
          onClick={() => setChoosingMvp(true)}
          className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white font-display text-base font-extrabold text-void"
        >
          <Flag aria-hidden="true" className="h-5 w-5" />
          Terminar y guardar resultado
        </button>
      )}
      </div>
      </div>

      {banner && (
        <div key={banner.key} aria-live="assertive" className="live-banner pointer-events-none absolute inset-x-6 top-1/3 z-20 rounded-3xl p-5 text-center shadow-2xl">
          <div className={`absolute inset-0 rounded-3xl ${banner.ours ? "bg-gradient-to-br from-tnt to-tntdeep text-onbrand" : "bg-gradient-to-br from-sky-700 to-slate-900 text-snow"}`} />
          <p className="relative font-display text-2xl font-extrabold">{banner.text}</p>
          <p className="relative mt-1 font-display text-4xl font-extrabold tabular-nums">{banner.score}</p>
        </div>
      )}

      {sheetFor && (
        <PlayerSheet
          player={sheetFor}
          opponent={opponentShort}
          onClose={() => setSheetFor(null)}
          onPick={(choice) => {
            setSheetFor(null);
            stat({ player_id: sheetFor.player_id, ...choice, point: game.finished ? null : choice.point });
          }}
        />
      )}
      {helping && <HelpDialog scorer={Boolean(game.can_score || game.can_start)} onClose={() => setHelping(false)} />}
      {choosingMvp && (
        <MvpDialog
          game={game}
          suggested={mvp}
          changing={game.status === "finished"}
          onCancel={() => setChoosingMvp(false)}
          onFinish={(playerId) => {
            setChoosingMvp(false);
            send(() => (game.status === "finished" ? changeLiveMvp(liveId, playerId) : finishLive(liveId, playerId)));
          }}
        />
      )}
      {confirming && (
        <ConfirmDialog
          message={confirming.message}
          confirmLabel={confirming.label}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const { action } = confirming;
            setConfirming(null);
            action();
          }}
        />
      )}
    </section>
  );
}
