import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, CircleCheck, CircleHelp, CircleX, Coins, Crown, Dumbbell, LifeBuoy, History, Pencil, Plus, Trophy, UserPlus, X, Zap } from "lucide-react";
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
  getPlayerProfile,
  getProfile,
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
import WelcomeCard from "@/app/components/WelcomeCard.jsx";
import { EventPlace, MatchNotes } from "@/app/components/MatchInfo.jsx";
import MatchDialog from "@/app/components/MatchDialog.jsx";
import NotificationsCard from "@/app/components/NotificationsCard.jsx";
import ScheduleDialog from "@/app/components/ScheduleDialog.jsx";
import { GroupPicker } from "@/app/components/RankingVisuals.jsx";
import { localToday, matchDayLabel, matchKindLabel, placeInfo } from "@/app/matches.js";
import { nextTraining, trainingAfter } from "@/app/nextTraining.js";
import { TEAM_SCHEDULES, defaultTeamId, isBeachTeam, isTeamId, sessionsToSchedules, shareMatches } from "@/app/teams.js";
import { TRAINING_VENUE_ADDRESS, TRAINING_VENUE_URL } from "../../../data/groups.js";
import { Button, EmptyState, Notice, Stage, StatTile, TabPanel, Tabs } from "@/app/ui/index.js";
import ClubCrest from "@/app/components/ClubCrest.jsx";

const STORAGE_KEY = "tnt-equipo-visto";

// "Buenos días", "Buenas tardes" o "Buenas noches", según la hora.
function greeting(hour = new Date().getHours()) {
  if (hour >= 6 && hour < 14) return "Buenos días";
  if (hour >= 14 && hour < 21) return "Buenas tardes";
  return "Buenas noches";
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
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-live-club to-live-accent p-3 shadow-[0_8px_24px_rgba(255,56,0,0.35)] text-snow"
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
      <p className="font-title text-lg text-ink">{question}</p>
      {hint && <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-gold-text"><Coins aria-hidden="true" className="h-3.5 w-3.5" />{hint}</p>}
      <div ref={ref} className="mt-3 grid grid-cols-2 gap-2">
        {[["going", "Voy", Check], ["not_going", "No voy", X]].map(([status, label, Icon]) => {
          const chosen = mine === status;
          // Voy en el verde de siempre; No voy, neutro. Van dentro del escenario (siempre oscuro).
          const tone = chosen
            ? status === "going"
              ? "bg-voy text-snow shadow-[0_8px_24px_-8px_rgb(var(--c-success)/0.6)]"
              : "bg-ink text-canvas"
            : status === "going"
              ? "bg-voy/15 text-voy-text ring-1 ring-inset ring-voy/45 hover:bg-voy/25"
              : "bg-ink/[0.07] text-ink ring-1 ring-inset ring-ink/25 hover:bg-ink/[0.12]";
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
                className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-control font-title text-xl transition-ui aria-disabled:opacity-60 ${tone}`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={3} />
                {label}
              </button>
              {burst && burst.status === status && <CoinBurst burst={burst} />}
            </span>
          );
        })}
      </div>
      {error && <Notice tone="error" inline className="mt-2">{error}</Notice>}
    </div>
  );
}

// El entreno de después, debajo del próximo: se contesta aquí mismo o los dos de golpe con «Voy a los dos».
function FollowingTraining({ following, mine, followingMine, busy, onAnswer, onAnswerBoth }) {
  const bothGoing = mine === "going" && followingMine === "going";
  return (
    <div className="space-y-2 rounded-inner bg-ink/[0.06] p-3" data-testid="following-training">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-sm">
          <span className="block text-xs font-semibold text-ink-muted">Y el siguiente</span>
          <span className="block truncate font-semibold text-ink">{following.label}</span>
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
              className={`min-h-10 rounded-control px-3 text-sm font-bold transition-ui aria-disabled:opacity-60 ${
                followingMine === status
                  ? status === "going"
                    ? "bg-voy text-snow"
                    : "bg-ink text-canvas"
                  : "text-ink ring-1 ring-inset ring-ink/25 hover:bg-ink/10"
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
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-voy/15 text-sm font-bold text-voy-text ring-1 ring-inset ring-voy/45 transition-ui hover:bg-voy/25 aria-disabled:opacity-60"
        >
          <CircleCheck aria-hidden="true" className="h-4 w-4" />
          Voy a los dos
        </button>
      )}
    </div>
  );
}

const ATTENDANCE_GROUPS = [
  { key: "going", title: "Van", icon: CircleCheck, tint: "text-voy-text", empty: "Nadie todavía" },
  { key: "not_going", title: "No van", icon: CircleX, tint: "text-ink", empty: "Nadie" },
  { key: "no_answer", title: "Sin responder", icon: CircleHelp, tint: "text-ink-muted", empty: "Han respondido todos" },
];

function AttendanceGroup({ group, people, currentUserId }) {
  const Icon = group.icon;
  return (
    <div className="rounded-inner bg-ink/[0.05] p-3 ring-1 ring-inset ring-ink/10">
      <h3 className={`flex items-center gap-2 text-sm font-bold ${group.tint}`}>
        <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
        {group.title}
        <span className="ml-auto font-score text-2xl leading-none text-ink">{people.length}</span>
      </h3>
      {people.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">{group.empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {people.map((person) => (
            <li key={person.id} className="flex min-w-0 items-center gap-2 text-sm text-ink">
              <Avatar name={person.name} picture={person.picture} className="h-7 w-7 text-[11px]" />
              <span className="min-w-0 break-words">
                {person.name}
                {person.id === currentUserId && <span className="text-ink-muted"> (tú)</span>}
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
  const shown = going.slice(0, 4);
  return (
    <div className="rounded-inner bg-ink/[0.06] p-3" data-testid="attendance-panel">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="flex shrink-0 -space-x-2.5" aria-hidden="true">
          {shown.length === 0 ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-ink/25 text-ink-muted">?</span>
          ) : (
            shown.map((person) => <Avatar key={person.id} name={person.name} picture={person.picture} className="who-avatar h-9 w-9 text-[11px] ring-2 ring-card" />)
          )}
          {going.length > shown.length && (
            <span className="who-avatar flex h-9 w-9 items-center justify-center rounded-full bg-raised text-xs font-bold text-ink ring-2 ring-card">+{going.length - shown.length}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-title text-lg leading-tight text-ink">
            <span className="font-score text-voy-text">{going.length}</span> {going.length === 1 ? "va" : "van"}
          </span>
          <span className="block text-xs text-ink-muted">
            {lists.not_going?.length ?? 0} no {(lists.not_going?.length ?? 0) === 1 ? "va" : "van"} · {lists.no_answer?.length ?? 0} sin responder
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-muted">
          <span className="sr-only sm:not-sr-only">{open ? "Ocultar" : "Ver lista"}</span>
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

// Un partido: el primero de la lista es el escenario de la pestaña (featured); los demás, tarjetas del tema.
function EventCard({ icon: Icon, label, status, action, testId, featured = false, labelledBy, children }) {
  const head = (
    <div className="mb-4 flex min-h-11 items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
        <Icon aria-hidden="true" className={`h-4 w-4 ${featured ? "text-rotta-on-stage" : "text-club-ui"}`} />
        {label}
        {status && <span className="rounded-full bg-voy px-2 py-0.5 text-[11px] font-bold text-snow">{status}</span>}
      </span>
      {action && <span>{action}</span>}
    </div>
  );
  if (featured) {
    return (
      <Stage as="article" aria-labelledby={labelledBy} data-testid={testId} className="p-5 md:p-7">
        {head}
        {children}
      </Stage>
    );
  }
  return (
    <article aria-labelledby={labelledBy} className="ui-card rounded-card bg-card p-card text-ink" data-testid={testId}>
      {head}
      {children}
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

// Día y hora en grande, con cuánto falta. La hora es el número protagonista del escenario (letra de marcador de la
// identidad). La pista con quien va se pone aparte (GoingCourt), al lado en escritorio y debajo en el móvil.
function EventWhen({ iso, time, until, spoken, subtitle, titleId, aside = null, startsIn = null, before = null, place = null }) {
  const day = dayText(iso);
  const short = String(time ?? "").length <= 5;
  return (
    <div className="space-y-4">
      {before}
      {/* Si la hora y el botón de ayuda no caben juntos (números anchos de Naranja), el botón baja de línea. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-fit flex-1">
          {(day || startsIn) && (
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-muted">
              {day && <span className="first-letter:uppercase">{day}</span>}
              {startsIn && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold text-ink">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-rotta-on-stage" />
                  {startsIn}
                </span>
              )}
            </p>
          )}
          <p id={titleId} className={`mt-1 font-score leading-[0.85] text-ink ${short ? "text-hero md:text-[5.5rem]" : "text-3xl"}`}>
            <span className="sr-only">{spoken} </span>
            {time}
          </p>
          {(until || subtitle) && <p className="mt-2 text-sm font-medium text-ink-muted">{until ? `Hasta las ${until}` : subtitle}</p>}
          {place}
        </div>
        {aside}
      </div>
    </div>
  );
}

// Partido: nuestro equipo (con el escudo del club) contra el rival, cara a cara.
function Versus({ teamName, opponent }) {
  const side = (name, ours) => (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      {ours ? (
        <ClubCrest className="h-14 w-14" rottaClassName="rounded-[30%] object-cover" />
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-[30%] bg-ink/10 font-title text-lg text-ink" aria-hidden="true">
          {initialsOf(name)}
        </span>
      )}
      <span className="w-full truncate text-sm font-semibold text-ink">{name}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-inner bg-ink/[0.06] px-3 py-4">
      {side(teamName, true)}
      <span className="font-score text-2xl text-ink-muted">vs</span>
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
        className="flex min-h-11 shrink-0 flex-col items-center justify-center rounded-inner border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-center text-sky-200 transition-ui hover:bg-sky-400/20"
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
      className={`flex min-h-11 shrink-0 flex-col items-center justify-center rounded-inner px-2.5 py-1 text-center transition-ui ${
        few ? "bg-danger text-snow shadow-[0_6px_18px_-6px_rgb(var(--c-danger)/0.6)] hover:brightness-110" : "text-ink ring-1 ring-inset ring-ink/25 hover:bg-ink/10"
      }`}
    >
      <span className="flex items-center gap-1 text-xs font-extrabold">
        <LifeBuoy aria-hidden="true" className="h-3.5 w-3.5" />
        Pedir ayuda
      </span>
      <span className={`text-[11px] font-semibold ${few ? "text-snow/90" : "text-ink-muted"}`}>{few ? "Somos pocos" : "A otros equipos"}</span>
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
      className="-mr-2 flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink transition-ui hover:bg-ink/10"
    >
      <Pencil aria-hidden="true" className="h-4 w-4" />
      Editar horario
    </button>
  );
  // El sitio, en una línea debajo de la hora (antes era un bloque al final del escenario).
  const place = hasVenue ? (
    <EventPlace compact place={TRAINING_VENUE_ADDRESS} url={TRAINING_VENUE_URL} />
  ) : (
    <p className="mt-1 text-sm text-ink-muted">Consulta el lugar y las plazas con el club antes de ir.</p>
  );
  const when = training.known ? (
    <EventWhen
      place={place}
      iso={training.date}
      time={training.start}
      until={training.end}
      startsIn={training.inProgress ? null : startsInText(training.startsAt)}
      spoken={training.title}
      titleId="training-title"
      aside={helpButton}
    />
  ) : (
    <EventWhen iso={training.date} time={training.title} spoken="" subtitle={training.detail} titleId="training-title" aside={helpButton} place={place} />
  );

  // El escenario de Inicio (Premium deportivo). En el móvil, por orden: la hora, Voy / No voy, la pista con quien
  // va, el entreno siguiente y el sitio. En escritorio, la pista grande a la derecha y lo demás a la izquierda.
  return (
    <Stage as="article" aria-labelledby="training-title" data-testid="training-card" className="p-5 md:p-7">
      <div className="mb-4 flex min-h-11 items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
          <Dumbbell aria-hidden="true" className="h-4 w-4 text-rotta-on-stage" />
          Próximo entrenamiento
          {training.inProgress && <span className="rounded-full bg-voy px-2 py-0.5 text-[11px] font-bold text-snow">Ahora</span>}
        </span>
        {editButton}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-x-8">
        <div className="lg:col-start-1">{when}</div>
        {attendance?.can_respond && (
          <div className="lg:col-start-1">
            <AnswerButtons question={trainingQuestion(training)} mine={attendance.mine} busy={answerBusy} error={answerError} onAnswer={onAnswer} burst={coinBurst} hint={attendance.mine === "going" ? "Vas: +10 coins conseguidos" : attendance.mine === "not_going" ? "Contestado: no pierdes coins" : "Voy: +10 coins · Si no contestas: −10 coins"} />
          </div>
        )}
        <div className="space-y-3 lg:col-start-2 lg:row-span-4 lg:row-start-1">
          <GoingCourt teamId={teamId} people={attendance?.going ?? []} currentUserId={currentUserId} />
          {attendance && <WhoIsGoing lists={attendance} currentUserId={currentUserId} />}
        </div>
        {attendance?.can_respond && following && followingAttendance?.can_respond && (
          <div className="lg:col-start-1">
            <FollowingTraining
              following={following}
              mine={attendance.mine}
              followingMine={followingAttendance.mine}
              busy={answerBusy}
              onAnswer={onAnswerFollowing}
              onAnswerBoth={onAnswerBoth}
            />
          </div>
        )}
      </div>
    </Stage>
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
      className={`relative flex min-h-14 w-full items-center gap-3 overflow-hidden rounded-control px-4 text-left transition-ui disabled:opacity-70 ${
        playing || !live || live.status === "pending" ? "bg-gradient-to-r from-red-600 via-live-club to-live-accent shadow-[0_8px_24px_rgba(255,56,0,0.35)] text-snow" : "bg-raised text-ink ring-1 ring-line"
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

function MatchCard({ match, teamName, currentUserId, busy, onAnswer, onEdit, onError, coinBurst = null, featured = false }) {
  const titleId = `match-${match.id}-title`;
  const editButton = match.can_edit && (
    <button
      type="button"
      onClick={() => onEdit(match)}
      aria-label={`Editar el partido contra ${match.opponent}`}
      className="-mr-2 flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink transition-ui hover:bg-ink/10"
    >
      <Pencil aria-hidden="true" className="h-4 w-4" />
      Editar
    </button>
  );
  // Como el entreno: en escritorio, el primero con la pista grande a la derecha.
  const wide = featured ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-x-8" : "";
  const left = featured ? "lg:col-start-1" : "";

  return (
    <EventCard icon={Trophy} label={`Partido · ${matchKindLabel(match.kind)}`} action={editButton} testId="match-card" featured={featured} labelledBy={titleId}>
      <div className={`grid gap-5 ${wide}`}>
        <div className={left}>
          <EventWhen
            iso={match.date}
            time={match.time}
            spoken={`${matchDayLabel(match.date)} contra ${match.opponent}`}
            startsIn={startsInText(matchStart(match) - Date.now())}
            titleId={titleId}
            before={<Versus teamName={teamName || "Nosotros"} opponent={match.opponent} />}
            place={match.location ? <EventPlace compact place={placeInfo(match.location).label} url={placeInfo(match.location).url} /> : null}
          />
        </div>
        <div className={`empty:hidden ${left}`}><LiveMatchButton match={match} onError={onError} /></div>
        {match.can_respond && (
          <div className={left}>
            <AnswerButtons
              question="¿Vas a jugar?"
              mine={match.mine}
              busy={busy}
              onAnswer={(status) => onAnswer(match, status)}
              burst={coinBurst}
              hint={match.mine === "going" ? "Vas: +7 coins conseguidos" : "Voy: +7 coins"}
            />
          </div>
        )}
        <div className={`space-y-3 ${featured ? "lg:col-start-2 lg:row-span-5 lg:row-start-1" : ""}`}>
          <GoingCourt teamId={match.team_id} people={match.going} currentUserId={currentUserId} />
          <WhoIsGoing lists={match} currentUserId={currentUserId} />
        </div>
        {match.notes && (
          <div className={left}>
            <MatchNotes notes={match.notes} />
          </div>
        )}
      </div>
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
      ? <Notice tone="error" inline>{error}</Notice>
      : <p role="status" className="text-ink-muted">Cargando…</p>;
  }

  return (
    <section aria-labelledby="matches-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="matches-title" className="font-title text-2xl text-ink">Próximos</h2>
        {canManage && (
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setEditing({ match: null })}>
            Añadir partido
          </Button>
        )}
      </div>
      {error && <Notice tone="error" inline>{error}</Notice>}
      {matches.length === 0 ? (
        <EmptyState>No hay partidos programados para este equipo.</EmptyState>
      ) : (
        <div className="space-y-3">
          {matches.map((match, index) => (
            <MatchCard
              key={match.id}
              featured={index === 0}
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
      <Link to={`/app/partidos/jugados?equipo=${teamId}`} data-testid="played-link" className="ui-card ui-card-interactive flex min-h-14 items-center gap-3 rounded-card bg-card px-4 text-ink transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text">
        <History aria-hidden="true" className="h-5 w-5 shrink-0 text-club-ui" />
        <span className="flex-1 font-title text-lg">Partidos jugados</span>
        <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-muted" />
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

// Cabecera de Inicio: el saludo con tu nombre y tus coins. Sin la tarjeta de color: el protagonista es el escenario.
function HomeHeader({ user, coins, shownCoins, coinBurst }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-muted">{greeting()},</p>
        <h1 className="break-words font-title text-title text-ink md:text-display">{user.name.split(" ")[0]}</h1>
      </div>
      {coins && (
        <Link
          key={coinBurst?.key ?? "coins"}
          to="/app/tienda"
          aria-label={`Tienes ${coins.balance} Club Coins. Ir a la tienda`}
          className={`${coinBurst ? "coin-pill-pop " : ""}ui-card relative inline-flex min-h-11 items-center gap-2 rounded-control bg-card py-1 pl-1 pr-4 text-ink transition-ui hover:bg-raised`}
        >
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-amber-950">
            <Coins className="h-4 w-4" />
          </span>
          <span className="font-score text-xl leading-none">{(shownCoins ?? coins.balance).toLocaleString("es-ES")}</span>
          <span className="text-xs font-semibold text-ink-muted">Club Coins</span>
          {coins.crown && <Crown aria-hidden="true" className="h-4 w-4 fill-gold text-gold-text" />}
        </Link>
      )}
    </header>
  );
}

// Tus números (solo si tienes ficha de jugador): puesto y nota global del ranking y asistencia de los últimos días.
// Son datos que la app ya tiene (tu perfil y tu ficha); si no cargan, no salen. Dorado solo para 85 o más.
function useMyNumbers(user) {
  const [numbers, setNumbers] = useState(null);
  useEffect(() => {
    if (user.role === "familia") return undefined;
    let cancelled = false;
    getProfile()
      .then(async (profile) => {
        if (!profile.player) return;
        const card = await getPlayerProfile(profile.player.id).catch(() => null);
        if (!cancelled) setNumbers({ stats: profile.stats, ranking: card?.ranking ?? null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user.id, user.role]);
  return numbers;
}

function MyNumbers({ numbers }) {
  if (!numbers) return null;
  const { stats, ranking } = numbers;
  const answered = stats.going + stats.not_going;
  const attendance = answered ? Math.round((stats.going / answered) * 100) : null;
  const overall = ranking ? Math.round(ranking.overall) : null;
  return (
    <section aria-label="Tus números" className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-3">
      <Link to="/app/ranking" className="rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text">
        <StatTile label="Ranking" value={ranking ? `${ranking.rank}º` : "–"} caption={ranking ? `de ${ranking.of}` : "Sin puesto"} className="h-full transition-ui hover:bg-raised" />
      </Link>
      <StatTile label="Nota global" value={overall ?? "–"} caption={ranking ? "Semana" : "Sin notas"} emphasis={overall !== null && overall >= 85 ? "gold" : undefined} />
      <StatTile label="Asistencia" value={attendance ?? "–"} suffix={attendance !== null ? "%" : undefined} caption={`${stats.days} días`} />
    </section>
  );
}

// Después del entreno: el próximo partido, cara a cara. Un toque y se abre la pestaña de Partidos.
function NextMatchPeek({ match, onOpen }) {
  if (!match) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="ui-card ui-card-interactive w-full rounded-card bg-card p-4 text-left transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text"
    >
      <span className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-muted">
        <span className="flex items-center gap-1.5"><Trophy aria-hidden="true" className="h-3.5 w-3.5" />Próximo partido · {matchKindLabel(match.kind)}</span>
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
        <span className="relative flex">
          <ClubCrest className="h-11 w-11" rottaClassName="rounded-[30%] object-cover" />
          <span aria-hidden="true" className="absolute -bottom-1 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-raised text-[10px] font-bold text-ink-muted ring-2 ring-card">vs</span>
        </span>
        <span className="min-w-0">
          <span className="block truncate font-title text-lg leading-tight text-ink">{match.opponent}</span>
          <span className="block text-sm text-ink-muted">
            <span className="first-letter:uppercase">{matchDayLabel(match.date)}</span> · {match.time}
          </span>
        </span>
      </span>
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
  const tabsId = useId();
  const numbers = useMyNumbers(user);
  // El próximo partido que aún no ha terminado (para enseñarlo al lado del entreno).
  const nextMatch = (matches ?? []).find((item) => matchStart(item) > Date.now() - MATCH_LENGTH_MS) ?? null;
  // La columna de resumen solo existe si tiene algo: tus números (si tienes ficha) o el próximo partido.
  const showPeek = shownTab === "training" && Boolean(nextMatch);
  const hasAside = Boolean(numbers) || showPeek;
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
        // Aviso para entrenadores y administradores: una tarjeta del tema, con el número y a dónde lleva.
        <Link
          to={isAdmin ? "/app/usuarios" : "/app/solicitudes"}
          data-testid="pending-access"
          className="flex min-h-14 items-center gap-3 rounded-card bg-card px-3.5 py-2.5 text-ink shadow-card ring-1 ring-line transition hover:ring-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text"
        >
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-club-soft text-club-ui">
            <UserPlus aria-hidden="true" className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-club px-1 text-xs font-bold text-on-club ring-2 ring-card">{pendingCount}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{pendingCount === 1 ? "1 persona espera acceso" : `${pendingCount} personas esperan acceso`}</span>
            <span className="block text-xs text-ink-muted">Revísalas para darles entrada al club</span>
          </span>
          <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-muted" />
        </Link>
      )}

      <WelcomeCard user={user} />

      <LiveNow />

      <InstallCard variant="banner" />

      <NotificationsCard variant="banner" />

      <HomeHeader user={user} coins={coins} shownCoins={shownCoins} coinBurst={coinBurst} />

      <TeamPicker teams={teams} teamId={teamId} onChange={setTeamId} />

      {/* Escritorio: la agenda a la izquierda y tus números y el próximo partido a la derecha. En el móvil, uno debajo
          de otro (primero la agenda, que es lo que se viene a mirar). */}
      <div className={`grid gap-6 lg:items-start ${hasAside ? "lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]" : ""}`}>
      <section aria-label="Agenda del equipo" className="min-w-0 space-y-4">
        <Tabs
          id={tabsId}
          label="Qué quieres ver"
          value={shownTab}
          onChange={setTab}
          items={[
            { id: "training", label: "Entrenamientos", icon: Dumbbell },
            { id: "matches", label: "Partidos", icon: Trophy, count: matchBadge },
          ]}
        />

        {shownTab === null && <p role="status" className="px-2 text-ink-muted">Cargando…</p>}

        <TabPanel tabsId={tabsId} tab="training" value={shownTab} className="stagger-in space-y-4">
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
        </TabPanel>

        <TabPanel tabsId={tabsId} tab="matches" value={shownTab} className="stagger-in">
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
        </TabPanel>
      </section>

      {hasAside && (
        <aside aria-label="Tu resumen" className="space-y-3 lg:sticky lg:top-8">
          <MyNumbers numbers={numbers} />
          {showPeek && <NextMatchPeek match={nextMatch} onOpen={() => setTab("matches")} />}
        </aside>
      )}
      </div>
    </div>
  );
}
