import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, CircleCheck, CircleHelp, CircleX, Coins, Crown, Dumbbell, LifeBuoy, History, Pencil, Plus, Trophy, Volleyball, X, Zap } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  answerAttendance,
  askForHelp,
  answerMatch,
  createMatch,
  enterLiveMatch,
  deleteMatch,
  getAttendance,
  getCoins,
  listLive,
  getSchedules,
  listMatches,
  listTeams,
  listPendingUsers,
  saveSchedule,
  updateMatch,
} from "@/app/api.js";
import Avatar from "@/app/components/Avatar.jsx";
import CoinBurst from "@/app/components/CoinBurst.jsx";
import ConfirmDialog from "@/app/components/board/ConfirmDialog.jsx";
import TrainingStars from "@/app/components/TrainingStars.jsx";
import usePolling from "@/app/usePolling.js";
import GoingCourt, { initialsOf } from "@/app/components/GoingCourt.jsx";
import InstallCard from "@/app/components/InstallCard.jsx";
import { EventPlace, MatchNotes } from "@/app/components/MatchInfo.jsx";
import MatchDialog from "@/app/components/MatchDialog.jsx";
import NotificationsCard from "@/app/components/NotificationsCard.jsx";
import ScheduleDialog from "@/app/components/ScheduleDialog.jsx";
import { GroupPicker } from "@/app/components/RankingVisuals.jsx";
import { localToday, matchDayLabel, matchKindLabel, placeInfo } from "@/app/matches.js";
import { nextTraining, trainingAfter } from "@/app/nextTraining.js";
import { roleLabel } from "@/app/roles.js";
import { TEAM_SCHEDULES, defaultTeamId, isBeachTeam, isTeamId, sessionsToSchedules, shareMatches } from "@/app/teams.js";
import { TRAINING_VENUE_ADDRESS, TRAINING_VENUE_URL } from "../../../data/groups.js";

const STORAGE_KEY = "tnt-equipo-visto";

// "Buenos días", "Buenas tardes" o "Buenas noches", según la hora.
function greeting(hour = new Date().getHours()) {
  if (hour >= 6 && hour < 14) return "Buenos días";
  if (hour >= 14 && hour < 21) return "Buenas tardes";
  return "Buenas noches";
}

// El fondo de la cabecera: una pista de vóley vista desde arriba, girada, con su balón.
function CourtBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -bottom-24 -right-28 h-72 w-[30rem] rotate-[-18deg] rounded-sm border-[3px] border-white/20 bg-white/[0.06]">
        <span className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-white/30" />
        <span className="absolute inset-y-0 left-[33.3%] w-[3px] bg-white/20" />
        <span className="absolute inset-y-0 left-[66.6%] w-[3px] bg-white/20" />
      </div>
      <Volleyball className="absolute bottom-4 right-5 h-20 w-20 rotate-12 text-white/30" strokeWidth={1.4} />
    </div>
  );
}

function readStoredTeam() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeTeam(teamId) {
  try {
    window.localStorage.setItem(STORAGE_KEY, teamId);
  } catch {
    // Sin almacenamiento, simplemente no se recuerda la elección.
  }
}

// El número de coins sube (o baja) contando, en vez de cambiar de golpe.
function useCountUp(value, duration = 700) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (value === null || value === undefined) return undefined;
    const start = from.current ?? 0;
    if (start === value || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      setShown(value);
      return undefined;
    }
    const began = performance.now();
    let frame;
    const step = (now) => {
      const progress = Math.min(1, (now - began) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(start + (value - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, duration]);
  return shown;
}

// Partidos que se están jugando ahora en el club: un toque y vas al marcador en directo.
function LiveNow() {
  const [live, setLive] = useState([]);
  const load = useCallback(async () => {
    try {
      setLive((await listLive()).live);
    } catch {
      // Es un extra del inicio: si falla, no se enseña.
    }
  }, []);
  usePolling(load, 15000);
  if (live.length === 0) return null;
  return (
    <div className="space-y-2">
      {live.map((item) => (
        <Link
          key={item.id}
          to={`/app/directo/${item.id}`}
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-tnt to-ember p-3 shadow-[0_8px_24px_rgba(255,56,0,0.35)] text-snow"
        >
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/25 px-2 py-1 text-[10px] font-extrabold">
            <span aria-hidden="true" className="pulse-dot h-2 w-2 rounded-full bg-white" />
            En directo
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-base font-extrabold">
            {item.team_name.replace(/^Club /, "")} vs {item.opponent}
          </span>
          <span className="shrink-0 text-right font-display font-extrabold leading-none tabular-nums">
            <span className="block text-xl">
              {item.won.us}-{item.won.them}
            </span>
            <span className="text-[11px] text-white/80">
              {item.current.us}-{item.current.them}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0" />
        </Link>
      ))}
    </div>
  );
}

// Entrenamientos y partidos comparten estilo: tarjeta oscura, cabecera con un toque de color y los mismos botones.
// Al responder cambia lo que hay alrededor (la pista, las listas, los coins). Los botones se quedan donde
// estaban en la pantalla: la página no se mueve sola (Safari no lo compensa por su cuenta).
const ANCHOR_MS = 2500;

function scrollParent(node) {
  for (let parent = node?.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return document.scrollingElement;
}

function useStayInPlace() {
  const ref = useRef(null);
  const anchor = useRef(null);
  useLayoutEffect(() => {
    const saved = anchor.current;
    if (!saved || !ref.current) return;
    if (performance.now() > saved.until) {
      anchor.current = null;
      return;
    }
    const moved = ref.current.getBoundingClientRect().top - saved.top;
    if (Math.abs(moved) >= 1) saved.scroller.scrollTop += moved;
  });
  const hold = () => {
    if (!ref.current) return;
    anchor.current = { top: ref.current.getBoundingClientRect().top, scroller: scrollParent(ref.current), until: performance.now() + ANCHOR_MS };
  };
  return [ref, hold];
}

function AnswerButtons({ question, mine, busy, error, onAnswer, burst = null, hint = null }) {
  const [ref, hold] = useStayInPlace();
  return (
    <div data-testid="attendance-answer">
      <p className="font-display text-lg font-bold">{question}</p>
      {hint && <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-200/90"><Coins aria-hidden="true" className="h-3.5 w-3.5" />{hint}</p>}
      <div ref={ref} className="mt-3 grid grid-cols-2 gap-2">
        {[["going", "Voy", Check], ["not_going", "No voy", X]].map(([status, label, Icon]) => {
          const chosen = mine === status;
          const tone = chosen
            ? status === "going"
              ? "bg-emerald-500 text-snow shadow-[0_8px_24px_-8px_rgba(16,185,129,0.8)]"
              : "bg-zinc-200 text-zinc-900"
            : status === "going"
              ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/40 hover:bg-emerald-500/20"
              : "bg-white/5 text-zinc-200 ring-1 ring-inset ring-white/15 hover:bg-white/10";
          return (
            <span key={status} className="relative">
              <button
                type="button"
                aria-disabled={busy}
                aria-pressed={chosen}
                onClick={() => {
                  // Sin desactivar el botón: en el móvil, quitarle el foco puede mover la página.
                  if (busy) return;
                  hold();
                  onAnswer(status);
                }}
                className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-xl font-bold transition-colors aria-disabled:opacity-60 ${tone}`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={3} />
                {label}
              </button>
              {burst && burst.status === status && <CoinBurst burst={burst} />}
            </span>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-300">{error}</p>}
    </div>
  );
}

// El entreno de después, debajo del próximo: se contesta aquí mismo o los dos de golpe con «Voy a los dos».
function FollowingTraining({ following, mine, followingMine, busy, onAnswer, onAnswerBoth }) {
  const bothGoing = mine === "going" && followingMine === "going";
  return (
    <div className="space-y-2 rounded-xl bg-void/60 p-3" data-testid="following-training">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-sm">
          <span className="block text-xs font-bold uppercase tracking-wide text-zinc-400">Y el siguiente</span>
          <span className="block truncate font-semibold text-white">{following.label}</span>
        </p>
        <div className="flex shrink-0 gap-1.5">
          {[["going", "Voy"], ["not_going", "No voy"]].map(([status, label]) => (
            <button
              key={status}
              type="button"
              aria-disabled={busy}
              aria-pressed={followingMine === status}
              aria-label={`${label} el ${following.shortDay}`}
              onClick={() => !busy && onAnswer(status)}
              className={`min-h-10 rounded-lg px-3 text-sm font-bold aria-disabled:opacity-60 ${
                followingMine === status
                  ? status === "going"
                    ? "bg-emerald-600 text-snow"
                    : "bg-red-600 text-snow"
                  : "border border-white/20 text-white hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!bothGoing && (
        <button
          type="button"
          aria-disabled={busy}
          onClick={() => !busy && onAnswerBoth()}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-500/15 text-sm font-extrabold text-emerald-100 hover:bg-emerald-500/25 aria-disabled:opacity-60"
        >
          <CircleCheck aria-hidden="true" className="h-4 w-4" />
          Voy a los dos
        </button>
      )}
    </div>
  );
}

const ATTENDANCE_GROUPS = [
  { key: "going", title: "Van", icon: CircleCheck, tint: "text-emerald-400", empty: "Nadie todavía" },
  { key: "not_going", title: "No van", icon: CircleX, tint: "text-zinc-200", empty: "Nadie" },
  { key: "no_answer", title: "Sin responder", icon: CircleHelp, tint: "text-zinc-400", empty: "Han respondido todos" },
];

function AttendanceGroup({ group, people, currentUserId }) {
  const Icon = group.icon;
  return (
    <div className="rounded-xl border border-white/5 bg-void/60 p-3">
      <h3 className={`flex items-center gap-2 font-display text-sm font-extrabold ${group.tint}`}>
        <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
        {group.title}
        <span className="ml-auto font-display text-2xl font-extrabold leading-none tabular-nums text-white">{people.length}</span>
      </h3>
      {people.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">{group.empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {people.map((person) => (
            <li key={person.id} className="flex min-w-0 items-center gap-2 text-sm text-zinc-100">
              <Avatar name={person.name} picture={person.picture} className="h-7 w-7 text-[11px]" />
              <span className="min-w-0 break-words">
                {person.name}
                {person.id === currentUserId && <span className="text-zinc-400"> (tú)</span>}
                {person.guest && <span className="ml-1 rounded bg-sky-400/15 px-1.5 py-px text-[10px] font-bold text-sky-300">Ayuda</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Quién va, de un vistazo: las caras de los que van y cuántos faltan. La lista entera, al tocar.
function WhoIsGoing({ lists, currentUserId }) {
  const [open, setOpen] = useState(false);
  const going = lists.going ?? [];
  const shown = going.slice(0, 5);
  return (
    <div className="rounded-2xl bg-void/50 p-3" data-testid="attendance-panel">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="flex shrink-0 -space-x-2.5" aria-hidden="true">
          {shown.length === 0 ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-white/20 text-zinc-500">?</span>
          ) : (
            shown.map((person) => <Avatar key={person.id} name={person.name} picture={person.picture} className="h-9 w-9 text-[11px] ring-2 ring-panel" />)
          )}
          {going.length > shown.length && (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white ring-2 ring-panel">+{going.length - shown.length}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold leading-tight">
            <span className="text-emerald-300">{going.length}</span> {going.length === 1 ? "va" : "van"}
          </span>
          <span className="block text-xs text-zinc-400">
            {lists.not_going?.length ?? 0} no {(lists.not_going?.length ?? 0) === 1 ? "va" : "van"} · {lists.no_answer?.length ?? 0} sin responder
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-zinc-300">
          {open ? "Ocultar" : "Ver lista"}
          <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="mt-3 grid items-start gap-2 sm:grid-cols-3">
          {ATTENDANCE_GROUPS.map((group) => (
            <AttendanceGroup key={group.key} group={group} people={lists[group.key] ?? []} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ icon: Icon, label, status, action, testId, children }) {
  return (
    <article className="overflow-hidden rounded-3xl bg-panel ring-1 ring-white/10" data-testid={testId}>
      <div className="flex min-h-14 items-center justify-between gap-2 px-4 pt-2">
        <span className="flex items-center gap-2.5 text-sm font-semibold text-zinc-300">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-tnt text-onbrand">
            <Icon aria-hidden="true" className="h-4 w-4" />
          </span>
          {label}
          {status && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-snow">{status}</span>}
        </span>
        {action && <span>{action}</span>}
      </div>
      <div className="space-y-4 px-4 pb-4">{children}</div>
    </article>
  );
}

// "Hoy", "Mañana" o "jueves 20 nov".
function dayText(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date - today) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" }).replace(".", "");
}

// Cuánto falta, solo si es pronto: "en 40 min", "en 3 h".
function startsInText(ms) {
  if (ms === null || ms === undefined || ms <= 0) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `en ${hours} h` : null;
}

// Día y hora en grande, con cuánto falta, y debajo la pista con quien va.
function EventWhen({ iso, time, until, spoken, subtitle, teamId, people, titleId, currentUserId, aside = null, startsIn = null, before = null }) {
  const day = dayText(iso);
  const short = String(time ?? "").length <= 5;
  return (
    <div className="space-y-4">
      {before}
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          {(day || startsIn) && (
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-300">
              {day && <span className="first-letter:uppercase">{day}</span>}
              {startsIn && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-amber-950">{startsIn}</span>}
            </p>
          )}
          <p id={titleId} className={`mt-1 font-display font-extrabold leading-[0.9] tracking-tight tabular-nums ${short ? "text-6xl" : "text-3xl"}`}>
            <span className="sr-only">{spoken} </span>
            {time}
          </p>
          {(until || subtitle) && <p className="mt-2 text-sm font-medium text-zinc-300">{until ? `Hasta las ${until}` : subtitle}</p>}
        </div>
        {aside}
      </div>
      <GoingCourt teamId={teamId} people={people} currentUserId={currentUserId} />
    </div>
  );
}

// Partido: nuestro equipo contra el rival, cara a cara.
function Versus({ teamName, opponent }) {
  const side = (name, ours) => (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full font-display text-lg font-extrabold ${
          ours ? "bg-tnt text-onbrand" : "bg-zinc-200 text-zinc-900"
        }`}
        aria-hidden="true"
      >
        {ours ? <Volleyball className="h-7 w-7" /> : initialsOf(name)}
      </span>
      <span className="w-full truncate text-sm font-semibold">{name}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-void/50 px-3 py-4">
      {side(teamName, true)}
      <span className="font-display text-2xl font-extrabold text-zinc-500">vs</span>
      {side(opponent, false)}
    </div>
  );
}

function trainingQuestion(training) {
  if (training.known) return "¿Vas a ir?";
  const day = training.dayName?.toLowerCase();
  return day === "hoy" || day === "mañana" ? `¿Vas ${day}?` : `¿Vas el ${day}?`;
}

// Al lado de la hora del entreno: pedir gente a otros equipos en el chat general, o ver cómo va si ya se pidió.
function HelpButton({ attendance, onAsk }) {
  if (!attendance) return null;
  if (attendance.help) {
    const helpers = attendance.help.helpers;
    return (
      <Link
        to="/app/chat?canal=general"
        className="flex min-h-11 shrink-0 flex-col items-center justify-center rounded-xl border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-center text-sky-200 hover:bg-sky-400/20"
      >
        <span className="flex items-center gap-1 text-xs font-extrabold">
          <LifeBuoy aria-hidden="true" className="h-3.5 w-3.5" />
          Ayuda pedida
        </span>
        <span className="text-[11px] font-semibold text-sky-100/80">{helpers === 0 ? "Nadie aún" : helpers === 1 ? "1 se apunta" : `${helpers} se apuntan`}</span>
      </Link>
    );
  }
  if (!attendance.can_ask_help) return null;
  const few = (attendance.going?.length ?? 0) < 5;
  return (
    <button
      type="button"
      onClick={onAsk}
      className={`flex min-h-11 shrink-0 flex-col items-center justify-center rounded-xl px-2.5 py-1 text-center ${
        few ? "bg-gradient-to-br from-red-500 to-tnt text-snow shadow-[0_4px_14px_rgba(239,68,68,0.35)]" : "border border-white/20 text-zinc-200 hover:bg-white/5"
      }`}
    >
      <span className="flex items-center gap-1 text-xs font-extrabold">
        <LifeBuoy aria-hidden="true" className="h-3.5 w-3.5" />
        Pedir ayuda
      </span>
      <span className={`text-[11px] font-semibold ${few ? "text-white/85" : "text-zinc-400"}`}>{few ? "Somos pocos" : "A otros equipos"}</span>
    </button>
  );
}

function TrainingCard({
  teamId,
  training,
  attendance,
  following = null,
  followingAttendance = null,
  currentUserId,
  answerBusy,
  answerError,
  onAnswer,
  onAnswerFollowing,
  onAnswerBoth,
  onEditSchedule,
  coinBurst = null,
  onAskHelp,
}) {
  if (!training) return null;
  const helpButton = <HelpButton attendance={attendance} onAsk={onAskHelp} />;
  const hasVenue = !isBeachTeam(teamId);
  // El entrenador del equipo (y los administradores) cambian aquí el horario.
  const editButton = onEditSchedule && (
    <button
      type="button"
      onClick={onEditSchedule}
      aria-label="Editar el horario de entrenamiento"
      className="-mr-2 flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-white hover:bg-white/10"
    >
      <Pencil aria-hidden="true" className="h-4 w-4" />
      Editar horario
    </button>
  );

  return (
    <EventCard icon={Dumbbell} label="Próximo entrenamiento" status={training.inProgress ? "Ahora" : null} action={editButton} testId="training-card">
      {training.known ? (
        <EventWhen
          iso={training.date}
          time={training.start}
          until={training.end}
          startsIn={training.inProgress ? null : startsInText(training.startsAt)}
          spoken={training.title}
          teamId={teamId}
          people={attendance?.going ?? []}
          titleId="training-title"
          currentUserId={currentUserId}
          aside={helpButton}
        />
      ) : (
        <EventWhen iso={training.date} time={training.title} spoken="" subtitle={training.detail} teamId={teamId} people={attendance?.going ?? []} titleId="training-title" currentUserId={currentUserId} aside={helpButton} />
      )}
      {hasVenue ? (
        <EventPlace place={TRAINING_VENUE_ADDRESS} url={TRAINING_VENUE_URL} />
      ) : (
        <p className="rounded-xl bg-void/60 p-3 text-sm text-zinc-300">Consulta el lugar y las plazas con el club antes de ir.</p>
      )}
      {attendance?.can_respond && (
        <AnswerButtons question={trainingQuestion(training)} mine={attendance.mine} busy={answerBusy} error={answerError} onAnswer={onAnswer} burst={coinBurst} hint={attendance.mine === "going" ? "Vas: +10 coins conseguidos" : attendance.mine === "not_going" ? "Contestado: no pierdes coins" : "Voy: +10 coins · Si no contestas: −10 coins"} />
      )}
      {attendance?.can_respond && following && followingAttendance?.can_respond && (
        <FollowingTraining
          following={following}
          mine={attendance.mine}
          followingMine={followingAttendance.mine}
          busy={answerBusy}
          onAnswer={onAnswerFollowing}
          onAnswerBoth={onAnswerBoth}
        />
      )}
      {attendance && <WhoIsGoing lists={attendance} currentUserId={currentUserId} />}
    </EventCard>
  );
}

// El día del partido: entrar al marcador en directo (o verlo, si ya lo lleva alguien).
function LiveMatchButton({ match, onError }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!match.is_today || (!match.live && !match.can_edit)) return null;
  const live = match.live;
  const playing = live?.status === "live";
  const enter = async () => {
    if (live) {
      navigate(`/app/directo/${live.id}`);
      return;
    }
    setBusy(true);
    try {
      const created = await enterLiveMatch(match.id);
      navigate(`/app/directo/${created.id}`);
    } catch (requestError) {
      onError(requestError);
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={enter}
      disabled={busy}
      className={`relative flex min-h-14 w-full items-center gap-3 overflow-hidden rounded-xl px-4 text-left text-white disabled:opacity-70 ${
        playing || !live || live.status === "pending" ? "bg-gradient-to-r from-red-600 via-tnt to-ember shadow-[0_8px_24px_rgba(255,56,0,0.35)] text-snow" : "bg-panel ring-1 ring-white/15"
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/25">
        {playing ? <span aria-hidden="true" className="pulse-dot h-2.5 w-2.5 rounded-full bg-white" /> : <Zap aria-hidden="true" className="h-5 w-5 fill-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-extrabold leading-tight">
          {!live || live.status === "pending" ? (match.can_edit ? "Entrar al partido" : "Ver el partido") : playing ? (match.can_edit ? "Seguir el partido" : "Ver en directo") : "Ver el partido"}
        </span>
        <span className="block text-xs font-semibold text-white/80">
          {!live ? "Marcador punto a punto y aciertos y fallos" : live.status === "pending" ? "Aún no ha empezado" : playing ? "En directo ahora" : "Terminado"}
        </span>
      </span>
      {live && live.status !== "pending" && (
        <span className="shrink-0 text-right font-display font-extrabold leading-none tabular-nums">
          <span className="block text-2xl">
            {live.won.us}-{live.won.them}
          </span>
          {playing && (
            <span className="text-xs text-white/80">
              {live.current.us}-{live.current.them}
            </span>
          )}
        </span>
      )}
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0" />
    </button>
  );
}

function MatchCard({ match, teamName, currentUserId, busy, onAnswer, onEdit, onError, coinBurst = null }) {
  const editButton = match.can_edit && (
    <button
      type="button"
      onClick={() => onEdit(match)}
      aria-label={`Editar el partido contra ${match.opponent}`}
      className="-mr-2 flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-white hover:bg-white/10"
    >
      <Pencil aria-hidden="true" className="h-4 w-4" />
      Editar
    </button>
  );

  return (
    <EventCard icon={Trophy} label={`Partido · ${matchKindLabel(match.kind)}`} action={editButton} testId="match-card">
      <EventWhen
        iso={match.date}
        time={match.time}
        spoken={`${matchDayLabel(match.date)} contra ${match.opponent}`}
        startsIn={startsInText(matchStart(match) - Date.now())}
        before={<Versus teamName={teamName || "Nosotros"} opponent={match.opponent} />}
        teamId={match.team_id}
        people={match.going}
        currentUserId={currentUserId}
      />
      <LiveMatchButton match={match} onError={onError} />
      {match.location && <EventPlace place={placeInfo(match.location).label} url={placeInfo(match.location).url} />}
      {match.notes && <MatchNotes notes={match.notes} />}
      {match.can_respond && (
        <AnswerButtons
          question="¿Vas a jugar?"
          mine={match.mine}
          busy={busy}
          onAnswer={(status) => onAnswer(match, status)}
          burst={coinBurst}
          hint={match.mine === "going" ? "Vas: +7 coins conseguidos" : "Voy: +7 coins"}
        />
      )}
      <WhoIsGoing lists={match} currentUserId={currentUserId} />
    </EventCard>
  );
}

function MatchesSection({ teamId, teams, user, canManage, onAccessLost, onChange, onTeamChange, onCoins }) {
  const [matchBurst, setMatchBurst] = useState(null);
  const [matches, setMatches] = useState(null);
  const [editing, setEditing] = useState(null);
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401 || requestError.status === 403) onAccessLost();
    else setError(requestError.message);
  }, [onAccessLost]);

  const load = useCallback(async () => {
    try {
      const items = await listMatches(teamId);
      setMatches(items);
      // Así la pestaña sabe si sigue habiendo partido hoy tras crear o borrar uno.
      onChange?.(items);
    } catch (requestError) {
      handleError(requestError);
    }
  }, [teamId, handleError, onChange]);

  useEffect(() => {
    setMatches(null);
    setError("");
    load();
  }, [load]);

  const answer = async (match, status) => {
    setBusyId(match.id);
    setError("");
    try {
      const updated = await answerMatch(match.id, status);
      setMatches((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (updated.coins) {
        setMatchBurst({ matchId: match.id, amount: updated.coins, status, key: Date.now() });
        onCoins?.(updated.coins);
      }
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setBusyId(null);
    }
  };

  // Un 401 o 403 al guardar significa que ha cambiado tu acceso; el resto se muestra en el formulario.
  // Si el partido se guarda para otro equipo, se pasa a ese equipo: si no, parecería que ha desaparecido.
  const guarded = async (action) => {
    let saved;
    try {
      saved = await action();
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) onAccessLost();
      throw requestError;
    }
    setEditing(null);
    // Un partido ya jugado no sale en Próximos: se abre su página para que se vea que se ha guardado.
    if (saved?.team_id && (saved.date < localToday() || saved.sets.length > 0)) navigate(`/app/partidos/jugados?equipo=${saved.team_id}&tipo=${saved.kind}`);
    else if (saved?.team_id && !shareMatches(saved.team_id, teamId)) onTeamChange(saved.team_id);
    else load();
  };

  if (!matches) {
    return error
      ? <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>
      : <p role="status" className="text-zinc-300">Cargando…</p>;
  }

  return (
    <section aria-labelledby="matches-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-2">
        <h2 id="matches-title" className="font-display text-2xl font-extrabold">Próximos</h2>
        {canManage && (
          <button type="button" onClick={() => setEditing({ match: null })} className="flex min-h-11 items-center gap-1.5 rounded-full border border-white/20 px-3 text-sm font-semibold hover:bg-white/5">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Añadir partido
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
      {matches.length === 0 ? (
        <p className="rounded-3xl bg-panel p-4 text-sm text-zinc-400">No hay partidos programados para este equipo.</p>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              teamName={(teams.find((team) => team.id === match.team_id)?.name ?? "").replace(/^Club (Senior )?/, "")}
              currentUserId={user.id}
              busy={busyId === match.id}
              onAnswer={answer}
              onEdit={(item) => setEditing({ match: item })}
              coinBurst={matchBurst?.matchId === match.id ? matchBurst : null}
              onError={handleError}
            />
          ))}
        </div>
      )}
      <Link to={`/app/partidos/jugados?equipo=${teamId}`} data-testid="played-link" className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-panel px-4 hover:bg-white/5">
        <History aria-hidden="true" className="h-5 w-5 shrink-0 text-ember" />
        <span className="flex-1 font-display text-lg font-extrabold">Partidos jugados</span>
        <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-zinc-400" />
      </Link>
      {editing && (
        <MatchDialog
          match={editing.match}
          teams={teams}
          defaultTeamId={teamId}
          onSave={(values) => guarded(() => (editing.match ? updateMatch(editing.match.id, values) : createMatch(values)))}
          onDelete={() => guarded(() => deleteMatch(editing.match.id))}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

// El equipo que se está mirando se recuerda entre Inicio, Entrenamientos y Partidos.
function useTeamChoice(user, requested) {
  const [teamId, setTeamId] = useState(() => {
    // Al llegar desde un aviso se abre el equipo del que habla.
    if (isTeamId(requested)) return requested;
    const stored = readStoredTeam();
    if (isTeamId(stored)) return stored;
    return isTeamId(user.team_id) ? user.team_id : defaultTeamId();
  });
  const choose = useCallback((id) => {
    setTeamId(id);
    storeTeam(id);
  }, []);
  return [teamId, choose];
}

function useTeams(onAccessLost) {
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    listTeams()
      .then(setTeams)
      .catch((error) => {
        if (error.status === 401 || error.status === 403) onAccessLost();
      });
  }, [onAccessLost]);
  return teams;
}

function TeamPicker({ teams, teamId, onChange }) {
  if (teams.length === 0) return null;
  return <GroupPicker groups={teams} groupId={teamId} onChange={onChange} />;
}

// El horario que ha puesto cada entrenador (mientras carga, el de siempre).
function useSchedules(onAccessLost) {
  const [schedules, setSchedules] = useState(null);
  useEffect(() => {
    getSchedules()
      .then(setSchedules)
      .catch((error) => {
        if (error.status === 401 || error.status === 403) onAccessLost();
      });
  }, [onAccessLost]);
  return [schedules, setSchedules];
}

function useTrainingAttendance(teamId, onAccessLost, sessions) {
  const sessionsKey = JSON.stringify(sessions ?? null);
  const training = useMemo(
    () => nextTraining(sessions ? sessionsToSchedules(sessions) : TEAM_SCHEDULES[teamId] ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamId, sessionsKey],
  );
  const trainingDate = training?.date ?? null;
  const [attendance, setAttendance] = useState(null);
  // El entreno de después, para contestar a los dos de una vez.
  const following = useMemo(
    () => trainingAfter(sessions ? sessionsToSchedules(sessions) : TEAM_SCHEDULES[teamId] ?? [], training),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamId, sessionsKey, trainingDate],
  );
  const followingDate = following?.date ?? null;
  const [followingAttendance, setFollowingAttendance] = useState(null);

  const load = useCallback(async () => (trainingDate ? getAttendance(teamId, trainingDate) : null), [teamId, trainingDate]);
  const loadFollowing = useCallback(async () => (followingDate ? getAttendance(teamId, followingDate) : null), [teamId, followingDate]);

  useEffect(() => {
    let cancelled = false;
    setAttendance(null);
    setFollowingAttendance(null);
    load()
      .then((data) => {
        if (!cancelled) setAttendance(data);
      })
      .catch((error) => {
        if (!cancelled && (error.status === 401 || error.status === 403)) onAccessLost();
      });
    // Es un extra: si falla, se contesta como siempre, uno a uno.
    loadFollowing()
      .then((data) => {
        if (!cancelled) setFollowingAttendance(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [load, loadFollowing, onAccessLost]);

  return { training, trainingDate, attendance, setAttendance, load, following, followingDate, followingAttendance, setFollowingAttendance, loadFollowing };
}

const MATCH_LENGTH_MS = 2 * 60 * 60 * 1000;

const matchStart = (match) => {
  const [year, month, day] = match.date.split("-").map(Number);
  const [hour, minute] = match.time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
};

// Qué pestaña abrir: la de partidos si hay uno antes del próximo entrenamiento (o en juego).
function firstTab(training, matches, now = Date.now()) {
  const match = (matches ?? []).find((item) => matchStart(item) > now - MATCH_LENGTH_MS);
  if (!match) return "training";
  if (!training?.known) return "matches";
  return matchStart(match) - now < training.startsAt ? "matches" : "training";
}

function TabButton({ id, selected, icon: Icon, label, badge, onSelect }) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={selected}
      aria-controls={`panel-${id}`}
      onClick={() => onSelect(id)}
      className={`relative flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors ${
        selected ? "bg-tnt text-onbrand" : "text-zinc-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
      {label}
      {badge && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${selected ? "bg-white text-tnt" : "bg-tnt text-onbrand"}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

export default function HomePage({ user, onAccessLost }) {
  const teams = useTeams(onAccessLost);
  const [searchParams] = useSearchParams();
  const [teamId, setTeamId] = useTeamChoice(user, searchParams.get("equipo"));
  const [schedules, setSchedules] = useSchedules(onAccessLost);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const { training, trainingDate, attendance, setAttendance, load, following, followingDate, followingAttendance, setFollowingAttendance, loadFollowing } =
    useTrainingAttendance(teamId, onAccessLost, schedules?.[teamId]?.sessions);
  const [answerBusy, setAnswerBusy] = useState(false);
  const [answerError, setAnswerError] = useState("");
  const [matches, setMatches] = useState(null);
  const [tab, setTab] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [coins, setCoins] = useState(null);
  // Al entrar, el saldo cuenta desde 0; luego, desde el que había.
  const shownCoins = useCountUp(coins ? coins.balance : null);
  const [coinBurst, setCoinBurst] = useState(null);
  const [askingHelp, setAskingHelp] = useState(false);
  // Al cambiar de equipo por un partido recién guardado, se sigue en la pestaña de partidos.
  const stayOnMatches = useRef(false);
  const isAdmin = user.role === "admin";
  // Los jugadores con permiso de editor también pueden crear y cambiar partidos.
  const canManage = isAdmin || user.role === "entrenador" || Boolean(user.match_editor);
  const canReview = isAdmin || user.role === "entrenador";

  // Los coins son un extra del saludo: si fallan, el inicio se ve igual.
  const loadCoins = useCallback(() => {
    getCoins().then(setCoins).catch(() => {});
  }, []);
  useEffect(loadCoins, [loadCoins]);

  useEffect(() => {
    if (!canReview) return;
    listPendingUsers()
      .then((users) => setPendingCount(users.length))
      .catch((error) => {
        if (error.status === 401 || error.status === 403) onAccessLost();
      });
  }, [canReview, onAccessLost]);

  useEffect(() => {
    let cancelled = false;
    setMatches(null);
    setTab(stayOnMatches.current || searchParams.get("pestana") === "partidos" ? "matches" : null);
    stayOnMatches.current = false;
    setAnswerError("");
    // Solo sirve para elegir la pestaña inicial: la de partidos carga su propia lista.
    listMatches(teamId)
      .then((items) => {
        if (!cancelled) setMatches(items);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const shownTab = tab ?? (matches === null ? null : firstTab(training, matches));
  const matchToday = (matches ?? []).some((item) => matchDayLabel(item.date) === "Hoy");
  // Aunque se abra en Entrenamientos, la pestaña dice cuántos partidos hay por delante.
  const matchBadge = matchToday ? "Hoy" : matches?.length ? String(matches.length) : null;

  // Contestar al entreno de después, o a los dos a la vez («Voy a los dos»).
  const answerDays = async (answers) => {
    setAnswerBusy(true);
    setAnswerError("");
    try {
      let earned = 0;
      for (const [date, status] of answers) {
        const result = await answerAttendance(teamId, date, status);
        earned += result?.coins ?? 0;
      }
      if (earned) {
        setCoinBurst({ amount: earned, status: "going", key: Date.now() });
        setCoins((current) => current && { ...current, balance: current.balance + earned });
      }
      const [main, next] = await Promise.all([load(), loadFollowing()]);
      setAttendance(main);
      setFollowingAttendance(next);
    } catch (error) {
      if (error.status === 401) onAccessLost();
      else setAnswerError(error.message);
    } finally {
      setAnswerBusy(false);
    }
  };
  const answerFollowing = (status) => answerDays([[followingDate, status]]);
  const answerBoth = () =>
    answerDays(
      [
        [trainingDate, "going"],
        [followingDate, "going"],
      ].filter(([date], index) => (index === 0 ? attendance?.mine : followingAttendance?.mine) !== "going" && date),
    );

  const answerTraining = async (status) => {
    setAnswerBusy(true);
    setAnswerError("");
    try {
      const result = await answerAttendance(teamId, trainingDate, status);
      if (result?.coins) {
        setCoinBurst({ amount: result.coins, status, key: Date.now() });
        setCoins((current) => current && { ...current, balance: current.balance + result.coins });
      }
      setAttendance(await load());
    } catch (error) {
      if (error.status === 401) onAccessLost();
      else setAnswerError(error.message);
    } finally {
      setAnswerBusy(false);
    }
  };

  const sendHelp = async () => {
    setAskingHelp(false);
    setAnswerError("");
    try {
      await askForHelp(teamId, trainingDate);
      setAttendance(await load());
    } catch (error) {
      if (error.status === 401) onAccessLost();
      else setAnswerError(error.message);
    }
  };

  return (
    <div className="space-y-6">
      {askingHelp && (
        <ConfirmDialog
          message="Se enviará un mensaje al chat general diciendo que no sois suficientes para este entreno. Quien le dé a «Voy» vendrá a entrenar con vosotros ese día."
          confirmLabel="Pedir ayuda"
          onConfirm={sendHelp}
          onCancel={() => setAskingHelp(false)}
        />
      )}
      {pendingCount > 0 && (
        <Link to={isAdmin ? "/app/usuarios" : "/app/solicitudes"} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-tnt/60 bg-tnt/15 px-3 text-sm hover:bg-tnt/25">
          <span>{pendingCount === 1 ? "1 persona espera acceso" : `${pendingCount} personas esperan acceso`}</span>
          <span className="font-bold">Revisar</span>
        </Link>
      )}

      <LiveNow />

      <InstallCard variant="banner" />

      <NotificationsCard variant="banner" />

      <header className="relative isolate overflow-hidden rounded-3xl bg-tnt px-5 pb-5 pt-6 text-onbrand">
        <CourtBackdrop />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/80">{greeting()},</p>
            <h1 className="mt-1 break-words font-display text-5xl font-extrabold leading-[0.9] tracking-tight md:text-6xl">{user.name.split(" ")[0]}</h1>
            <p className="mt-2 text-sm font-medium text-white/80">{roleLabel(user.role)}</p>
          </div>
          <Link to="/app/perfil" aria-label="Ir a tu perfil" className="shrink-0 rounded-full">
            <Avatar name={user.name} picture={user.picture} className="h-16 w-16 text-lg ring-4 ring-white/30" />
          </Link>
        </div>
        {coins && (
          <Link
            key={coinBurst?.key ?? "coins"}
            to="/app/tienda"
            aria-label={`Tienes ${coins.balance} Club Coins. Ir a la tienda`}
            className={`${coinBurst ? "coin-pill-pop " : ""}relative mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-black/35 py-1 pl-1 pr-4 text-white ring-1 ring-amber-300/50 backdrop-blur-sm hover:bg-black/45`}
          >
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-amber-950">
              <Coins className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-bold tabular-nums">{(shownCoins ?? coins.balance).toLocaleString("es-ES")}</span>
            <span className="text-xs font-semibold text-amber-200">Club Coins</span>
            {coins.crown && <Crown aria-hidden="true" className="h-4 w-4 fill-amber-300 text-amber-400" />}
          </Link>
        )}
      </header>

      <TeamPicker teams={teams} teamId={teamId} onChange={setTeamId} />

      <section aria-label="Agenda del equipo" className="space-y-4">
        <div role="tablist" aria-label="Qué quieres ver" className="flex gap-1 rounded-full bg-panel p-1 ring-1 ring-white/10">
          <TabButton id="training" selected={shownTab === "training"} icon={Dumbbell} label="Entrenamientos" onSelect={setTab} />
          <TabButton id="matches" selected={shownTab === "matches"} icon={Trophy} label="Partidos" badge={matchBadge} onSelect={setTab} />
        </div>

        {shownTab === null && <p role="status" className="px-2 text-zinc-300">Cargando…</p>}

        {shownTab === "training" && (
          <div role="tabpanel" id="panel-training" aria-labelledby="tab-training" className="stagger-in">
            <TrainingCard
              teamId={teamId}
              training={training}
              attendance={attendance}
              currentUserId={user.id}
              answerBusy={answerBusy}
              answerError={answerError}
              onAnswer={answerTraining}
              following={following}
              followingAttendance={followingAttendance}
              onAnswerFollowing={answerFollowing}
              onAnswerBoth={answerBoth}
              coinBurst={coinBurst}
              onAskHelp={() => setAskingHelp(true)}
              onEditSchedule={schedules?.[teamId]?.can_edit ? () => setEditingSchedule(true) : null}
            />
            <TrainingStars teamId={teamId} onAccessLost={onAccessLost} />
            {editingSchedule && schedules?.[teamId] && (
              <ScheduleDialog
                teamName={teams.find((team) => team.id === teamId)?.name ?? ""}
                sessions={schedules[teamId].sessions}
                onClose={() => setEditingSchedule(false)}
                onSave={async (sessions) => {
                  const saved = await saveSchedule(teamId, sessions);
                  setSchedules((current) => ({ ...current, [teamId]: saved }));
                  setEditingSchedule(false);
                }}
              />
            )}
          </div>
        )}

        {shownTab === "matches" && (
          <div role="tabpanel" id="panel-matches" aria-labelledby="tab-matches" className="stagger-in">
            <MatchesSection
              teamId={teamId}
              teams={teams}
              user={user}
              canManage={canManage}
              onAccessLost={onAccessLost}
              onChange={setMatches}
              onCoins={(delta) => {
                setCoinBurst({ amount: delta, status: null, key: Date.now() });
                setCoins((current) => current && { ...current, balance: current.balance + delta });
              }}
              onTeamChange={(id) => {
                stayOnMatches.current = true;
                setTeamId(id);
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}
