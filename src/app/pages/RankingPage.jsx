import { Suspense, lazy, useCallback, useEffect, useId, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Crown, PenLine, UserRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getPlayerProfile, getPlayerRatings, getRanking, getRankingHonors, listRankingGroups } from "@/app/api.js";
import HonorsBanner from "@/app/components/HonorsBanner.jsx";
import Avatar from "@/app/components/Avatar.jsx";
import PlayerRatingHistory from "@/app/components/PlayerRatingHistory.jsx";
import { lookOf } from "@/app/components/PlayerProfileDialog.jsx";
import { CardTitle, GroupPicker, MovementPill, OverallNumber, PositionTag } from "@/app/components/RankingVisuals.jsx";
import { ownGroupOf } from "@/app/teams.js";
import { formatOverall, weekLabel } from "@/app/ranking.js";
import { ChipGroup, Dialog, LinkButton, Notice, PageHeader, Stage, Tabs } from "@/app/ui/index.js";

const AvatarStage = lazy(() => import("@/app/character/AvatarStage.jsx"));

// Oro, plata y bronce de verdad: no cambian con el tema (colores con significado).
const MEDALS = [
  { order: "order-2", pedestal: "h-20 from-[#FDE68A] via-[#FBBF24] to-[#B45309]", ring: "ring-[#FCD34D]", avatar: "h-16 w-16 text-lg" },
  { order: "order-1", pedestal: "h-14 from-[#F4F4F5] via-[#D4D4D8] to-[#52525B]", ring: "ring-[#E4E4E7]", avatar: "h-12 w-12 text-base" },
  { order: "order-3", pedestal: "h-11 from-[#FDBA74] via-[#F97316] to-[#7C2D12]", ring: "ring-[#FB923C]", avatar: "h-12 w-12 text-base" },
];

// En el ranking del mes, quien tiene una sola semana puntuada sale, pero con 10 puntos menos (lo explica al tocarla).
function FewWeeksTag() {
  return (
    <span
      title="Este mes solo tiene 1 semana puntuada: cuenta con 10 puntos menos hasta que tenga 2"
      className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[11px] font-bold text-warning-text ring-1 ring-inset ring-warning/40"
    >
      1 semana · −10
    </span>
  );
}

// El podio, compacto: dentro del escenario (oscuro siempre), con los pedestales de oro, plata y bronce.
function PodiumPlace({ entry, index, place, mine, hasPrevious, showMovement, onOpen }) {
  const medal = MEDALS[index];
  return (
    <motion.li
      className={medal.order}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: [0.2, 0.08, 0.32][index], duration: 0.4, ease: "easeOut" }}
    >
      <button type="button" onClick={onOpen} aria-label={`Ver las notas de ${entry.name}`} className="flex w-full flex-col items-center rounded-t-inner transition-ui hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-on-stage">
        <span className="relative mb-1.5 block">
          {index === 0 && <Crown aria-hidden="true" className="absolute -top-4 left-1/2 h-5 w-5 -translate-x-1/2 fill-gold text-gold" />}
          <Avatar name={entry.name} picture={entry.picture} className={`${medal.avatar} ring-[3px] ${medal.ring}`} />
        </span>
        <span className="block w-full truncate px-0.5 text-center text-sm font-semibold leading-tight text-ink">
          {entry.name.split(" ")[0]}{mine && <span className="font-normal text-ink-muted"> (tú)</span>}
        </span>
        <span className="mb-1.5 mt-1 flex min-h-5 flex-wrap items-center justify-center gap-1">
          {entry.provisional && <FewWeeksTag />}
          {showMovement && <MovementPill value={entry.movement} hasPrevious={hasPrevious} />}
        </span>
        <span className={`flex w-full flex-col items-center justify-start rounded-t-inner bg-gradient-to-b pt-1.5 text-[#0B0C0F] ${medal.pedestal}`}>
          <span className="font-score text-3xl leading-none">
            <span className="sr-only">Nota global </span>{formatOverall(entry.overall)}
          </span>
          <span className="mt-0.5 text-xs font-bold">
            <span className="sr-only">Puesto </span>{place}º
          </span>
        </span>
      </button>
    </motion.li>
  );
}

// Una fila de la clasificación: compacta, dentro de un solo bloque. Lo tuyo, con el tono del club.
function RankRow({ entry, place, mine, hasPrevious, showMovement, showLastWeek, onOpen, delay }) {
  return (
    <motion.li initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.25 }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver las notas de ${entry.name}`}
        className={`flex min-h-[3.5rem] w-full items-center gap-3 px-3 py-2 text-left transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rotta-text ${mine ? "bg-club-soft" : "hover:bg-raised"}`}
      >
        <span className="w-7 shrink-0 text-center font-score text-xl leading-none text-ink-muted">
          <span className="sr-only">Puesto </span>{place}
        </span>
        <Avatar name={entry.name} picture={entry.picture} className="h-9 w-9 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{entry.name}{mine && <span className="font-normal text-ink-muted"> (tú)</span>}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <PositionTag position={entry.position} />
            {entry.provisional && <FewWeeksTag />}
            {showLastWeek && entry.week_overall !== null && <span className="text-xs text-ink-muted">Semana: {formatOverall(entry.week_overall)}</span>}
          </span>
        </span>
        {showMovement && <MovementPill value={entry.movement} hasPrevious={hasPrevious} />}
        <OverallNumber overall={entry.overall} className="w-10 shrink-0 text-right text-2xl" />
      </button>
    </motion.li>
  );
}

const PERIODS = [
  { id: "week", label: "Semana" },
  { id: "month", label: "Mejor del mes" },
];

// Semana o mes: pestañas comunes (sin paneles: lo que cambia es la lista de debajo).
function PeriodPicker({ value, onChange }) {
  const id = useId();
  return <Tabs id={id} label="Ranking de la semana o del mes" value={value} onChange={onChange} hasPanels={false} items={PERIODS} />;
}

function PositionFilter({ positions, value, onChange }) {
  if (positions.length < 2) return null;
  return (
    <ChipGroup
      label="Filtrar por posición"
      scroll
      value={value}
      onChange={onChange}
      options={[{ value: "", label: "Todas" }, ...positions.map((item) => ({ value: item, label: item }))]}
    />
  );
}

// La ficha de notas de un jugador (también la tuya): hoja desde abajo en el móvil, ventana en el centro en escritorio.
function PlayerDialog({ player, groupId, history: given = null, onClose, onError }) {
  const [history, setHistory] = useState(given);
  // Su personaje (de su ficha); si no carga, se ven igual las notas.
  const [person, setPerson] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getPlayerProfile(player.player_id)
      .then((data) => {
        if (!cancelled) setPerson(data.player);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [player.player_id]);

  useEffect(() => {
    if (given) return undefined;
    let cancelled = false;
    getPlayerRatings(player.player_id, groupId)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((error) => {
        if (!cancelled) onError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [player.player_id, groupId, onError, given]);

  return (
    <Dialog
      title={player.name}
      onClose={onClose}
      placement="auto"
      media={
        person && (
          <div className="force-dark stage -mx-5 -mt-1 mb-4 h-52 border-0 md:-mx-6">
            <Suspense fallback={null}>
              <AvatarStage look={lookOf(person)} name={person.name.split(" ")[0]} number={person.number} position={person.position} heightCm={person.height_cm} crown={person.crown} />
            </Suspense>
          </div>
        )
      }
    >
      {history ? <PlayerRatingHistory history={history} /> : <p role="status" className="text-ink-muted">Cargando…</p>}
    </Dialog>
  );
}

export default function RankingPage({ user, onAccessLost }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [honors, setHonors] = useState(null);
  const [groups, setGroups] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [myHistory, setMyHistory] = useState(null);
  const [position, setPosition] = useState("");
  const period = searchParams.get("vista") === "mes" ? "month" : "week";
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState("");

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401 || requestError.status === 403) {
      onAccessLost();
      return;
    }
    setError(requestError.message);
  }, [onAccessLost]);

  useEffect(() => {
    listRankingGroups().then(setGroups).catch(handleError);
  }, [handleError]);

  const requested = searchParams.get("grupo");
  const ownGroup = ownGroupOf(user);
  const group = groups?.find(({ id }) => id === requested) ?? groups?.find(({ id }) => id === ownGroup) ?? groups?.[0];
  const groupId = group?.id ?? null;

  useEffect(() => {
    if (!groupId) return undefined;
    let cancelled = false;
    setHonors(null);
    // Los premios son un extra: si fallan, el ranking se ve igual.
    getRankingHonors(groupId)
      .then((data) => {
        if (!cancelled) setHonors(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return undefined;
    let cancelled = false;
    setRanking(null);
    setMyHistory(null);
    setPosition("");
    setError("");
    getRanking(groupId, period)
      .then(async (data) => {
        const history = data.my_player_id && data.week ? await getPlayerRatings(data.my_player_id, groupId) : null;
        if (cancelled) return;
        setRanking(data);
        setMyHistory(history);
      })
      .catch((requestError) => {
        if (!cancelled) handleError(requestError);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, period, handleError]);

  const positions = ranking ? [...new Set(ranking.entries.map((entry) => entry.position))].sort() : [];
  const visible = ranking ? ranking.entries.filter((entry) => !position || entry.position === position) : [];

  const rowProps = (entry, index) => ({
    entry,
    place: position ? index + 1 : entry.rank,
    mine: entry.player_id === ranking.my_player_id,
    hasPrevious: ranking.has_previous,
    showMovement: !position,
    showLastWeek: period === "month",
    onOpen: () => setViewing(entry),
  });

  const changeParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };
  const periodLabel = ranking?.week ? (period === "month" ? `Mes de ${ranking.month_label}` : weekLabel(ranking.week)) : "";

  const myEntry = ranking?.entries.find((entry) => entry.player_id === ranking.my_player_id) ?? null;
  const hasMyCard = Boolean(myHistory && myHistory.weeks.length > 0);
  const openMine = () => setViewing({ player_id: ranking.my_player_id, name: myEntry?.name ?? "Tu ficha", mine: true });
  const myCard = (stack) => hasMyCard && (
    <section aria-labelledby={stack ? "my-card-title-side" : "my-card-title"} className="ui-card space-y-4 rounded-card bg-card p-card">
      <CardTitle id={stack ? "my-card-title-side" : "my-card-title"} icon={UserRound}>Tu ficha</CardTitle>
      <PlayerRatingHistory history={myHistory} stack={stack} />
    </section>
  );

  // Pantalla fija en el móvil (Premium deportivo): arriba lo que no se mueve (cabecera, equipo, semana o mes, filtro y
  // el acceso a tu ficha); debajo, una zona que se desliza por dentro con los premios, el podio, la clasificación y tu
  // ficha al final. En escritorio: la clasificación a la izquierda y tu ficha fija a la derecha.
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 md:h-auto">
      <PageHeader
        title="Ranking"
        subtitle={group ? `${group.name}${periodLabel ? ` · ${periodLabel}` : ""}` : undefined}
        actions={
          <div className="flex shrink-0 gap-2">
            <LinkButton as={Link} size="sm" variant="secondary" icon={Crown} to={group ? `/app/ranking/recompensas?grupo=${group.id}` : "/app/ranking/recompensas"}>
              Premios
            </LinkButton>
            {group?.can_rate && (
              <LinkButton as={Link} size="sm" variant="primary" icon={PenLine} to={`/app/ranking/notas?grupo=${group.id}`}>
                Notas
              </LinkButton>
            )}
          </div>
        }
      />

      {groups && <GroupPicker groups={groups} groupId={groupId} onChange={(id) => changeParam("grupo", id)} />}
      {groups?.length > 0 && <PeriodPicker value={period} onChange={(id) => changeParam("vista", id === "month" ? "mes" : "")} />}
      {ranking?.week && <PositionFilter positions={positions} value={position} onChange={setPosition} />}

      {/* Acceso rápido a tu ficha (además de al final): tu puesto y tu nota de un vistazo. Solo en el móvil y tableta. */}
      {ranking?.week && hasMyCard && (
        <button
          type="button"
          onClick={openMine}
          className="ui-card flex min-h-12 items-center gap-3 rounded-card bg-club-soft px-3 text-left transition-ui hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text lg:hidden"
        >
          <UserRound aria-hidden="true" className="h-5 w-5 shrink-0 text-club-ui" />
          <span className="flex-1 text-sm font-semibold text-ink">Tu ficha</span>
          {myEntry && (
            <span className="flex items-baseline gap-3">
              <span className="font-score text-lg text-ink">{myEntry.rank}º</span>
              <OverallNumber overall={myEntry.overall} className="text-xl" />
            </span>
          )}
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted" />
        </button>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {!error && (!groups || (groupId && !ranking)) && <p role="status" className="text-ink-muted">Cargando…</p>}
      {groups?.length === 0 && <EmptyMessage>Tu equipo todavía no tiene ranking.</EmptyMessage>}

      {ranking && !ranking.week && (
        <EmptyMessage>
          {group.can_rate ? "Todavía no has publicado ninguna semana. Pon las notas y publícala para que salga el ranking." : "El entrenador todavía no ha publicado ninguna semana."}
        </EmptyMessage>
      )}

      {ranking?.week && (
        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
          <div className="-mx-gutter min-h-0 space-y-3 overflow-y-auto overscroll-contain px-gutter pb-2 md:mx-0 md:overflow-visible md:px-0" data-testid="ranking-scroll">
            <HonorsBanner honors={honors} />

            {/* Con el filtro cambian los puestos: se vuelve a montar para que repita la entrada. */}
            <div key={`${groupId}-${position}`} className="space-y-3">
              {visible.length > 0 && (
                <Stage decoration={false} className="px-3 pt-7">
                  <ol aria-label="Podio" className="relative grid grid-cols-3 items-end gap-2">
                    {visible.slice(0, 3).map((entry, index) => (
                      <PodiumPlace key={entry.player_id} index={index} {...rowProps(entry, index)} />
                    ))}
                  </ol>
                </Stage>
              )}
              {visible.length > 3 && (
                <ol start={4} aria-label="Resto de la clasificación" className="ui-card divide-y divide-line overflow-hidden rounded-card bg-card">
                  {visible.slice(3).map((entry, index) => (
                    <RankRow key={entry.player_id} delay={0.3 + index * 0.04} {...rowProps(entry, index + 3)} />
                  ))}
                </ol>
              )}
            </div>

            <p className="text-center text-xs text-ink-muted">
              {period === "month"
                ? `Media de ${ranking.weeks === 1 ? "la semana publicada" : `las ${ranking.weeks} semanas publicadas`} de ${ranking.month_label}`
                : "Nota de la última semana publicada"}
            </p>

            {ranking.pending.length > 0 && !position && (
              <section aria-labelledby="pending-title" className="rounded-card border border-dashed border-line p-4">
                <h2 id="pending-title" className="font-title text-base text-ink">Aún sin puesto</h2>
                <p className="mt-1 text-sm text-ink-muted">Hacen falta al menos 2 semanas puntuadas este mes.</p>
                <p className="mt-2 text-sm text-ink">{ranking.pending.map((person) => person.name).join(", ")}</p>
              </section>
            )}

            {/* Tu ficha al final (en el móvil); en escritorio va en su columna. */}
            {hasMyCard && <div className="lg:hidden">{myCard(false)}</div>}
          </div>

          {hasMyCard && <aside className="hidden lg:sticky lg:top-8 lg:block">{myCard(true)}</aside>}
        </div>
      )}

      {viewing && (
        <PlayerDialog
          player={viewing}
          groupId={groupId}
          history={viewing.mine ? myHistory : null}
          onClose={() => setViewing(null)}
          onError={handleError}
        />
      )}
    </div>
  );
}

function EmptyMessage({ children }) {
  return <p className="rounded-card bg-raised p-4 text-sm text-ink-muted">{children}</p>;
}
