import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Crown, PenLine } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getPlayerRatings, getRanking, getRankingHonors, listRankingGroups } from "@/app/api.js";
import HonorsBanner from "@/app/components/HonorsBanner.jsx";
import Avatar from "@/app/components/Avatar.jsx";
import PlayerRatingHistory from "@/app/components/PlayerRatingHistory.jsx";
import { AnimatedBar, GroupPicker, MovementPill, OverallNumber, PositionTag, RankingHero } from "@/app/components/RankingVisuals.jsx";
import { formatOverall, weekLabel } from "@/app/ranking.js";

// Oro, plata y bronce de verdad: no cambian con el tema.
const MEDALS = [
  { order: "order-2", pedestal: "h-32 from-[#FDE68A] via-[#FBBF24] to-[#B45309]", ring: "ring-[#FCD34D]", avatar: "h-20 w-20 text-xl" },
  { order: "order-1", pedestal: "h-24 from-[#F4F4F5] via-[#D4D4D8] to-[#52525B]", ring: "ring-[#E4E4E7]", avatar: "h-16 w-16 text-lg" },
  { order: "order-3", pedestal: "h-20 from-[#FDBA74] via-[#F97316] to-[#7C2D12]", ring: "ring-[#FB923C]", avatar: "h-16 w-16 text-lg" },
];

function PodiumPlace({ entry, index, place, mine, hasPrevious, showMovement, onOpen }) {
  const medal = MEDALS[index];
  const content = (
    <>
      <span className="relative mb-2 block">
        {index === 0 && <Crown aria-hidden="true" className="absolute -top-5 left-1/2 h-6 w-6 -translate-x-1/2 fill-amber-300 text-amber-300" />}
        <Avatar name={entry.name} picture={entry.picture} className={`${medal.avatar} ring-4 ${medal.ring}`} />
      </span>
      <span className="block w-full break-words px-0.5 text-center text-sm font-bold leading-tight">
        {entry.name}{mine && <span className="font-normal text-zinc-400"> (tú)</span>}
      </span>
      <span className="mb-1 mt-1 flex min-h-6 flex-wrap items-center justify-center gap-1">
        <PositionTag position={entry.position} />
        {showMovement && <MovementPill value={entry.movement} hasPrevious={hasPrevious} />}
      </span>
      <span className={`flex w-full flex-col items-center justify-start rounded-t-xl bg-gradient-to-b pt-2 text-[#0B0C0F] ${medal.pedestal}`}>
        <span className="font-display text-4xl font-black italic leading-none tabular-nums">
          <span className="sr-only">Overall </span>{formatOverall(entry.overall)}
        </span>
        <span className="mt-1 font-display text-sm font-black uppercase italic">
          <span className="sr-only">Puesto </span>{place}º
        </span>
      </span>
    </>
  );
  return (
    <motion.li
      className={medal.order}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: [0.25, 0.1, 0.4][index], duration: 0.45, ease: "easeOut" }}
    >
      <button type="button" onClick={onOpen} aria-label={`Ver las notas de ${entry.name}`} className="flex w-full flex-col items-center rounded-t-xl hover:brightness-110">{content}</button>
    </motion.li>
  );
}

function RankRow({ entry, place, mine, hasPrevious, showMovement, onOpen, delay }) {
  const content = (
    <>
      <span className="w-8 shrink-0 text-center font-display text-2xl font-black italic tabular-nums text-zinc-500">
        <span className="sr-only">Puesto </span>{place}
      </span>
      <Avatar name={entry.name} picture={entry.picture} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block break-words font-bold">{entry.name}{mine && <span className="font-normal text-zinc-400"> (tú)</span>}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <PositionTag position={entry.position} />
          {entry.week_overall !== null && <span className="text-xs text-zinc-400">Última: {formatOverall(entry.week_overall)}</span>}
        </span>
        <AnimatedBar percent={entry.overall} className="mt-2 h-1" />
      </span>
      {showMovement && <MovementPill value={entry.movement} hasPrevious={hasPrevious} />}
      <OverallNumber overall={entry.overall} className="w-12 shrink-0 text-right text-3xl" />
    </>
  );
  const look = mine ? "border-tnt/60 bg-gradient-to-r from-tnt/25 to-panel" : "border-white/5 bg-panel";
  return (
    <motion.li initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.3 }}>
      <button type="button" onClick={onOpen} aria-label={`Ver las notas de ${entry.name}`} className={`flex min-h-[4.5rem] w-full items-center gap-3 rounded-xl border px-3 py-2.5 hover:border-white/25 ${look}`}>{content}</button>
    </motion.li>
  );
}

function PositionFilter({ positions, value, onChange }) {
  if (positions.length < 2) return null;
  const chip = (label, id) => (
    <button
      key={id || "todas"}
      type="button"
      aria-pressed={value === id}
      onClick={() => onChange(id)}
      className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold ${
        value === id ? "border-tnt bg-tnt text-onbrand" : "border-white/15 text-zinc-300 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Filtrar por posición" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {chip("Todas", "")}
      {positions.map((item) => chip(item, item))}
    </div>
  );
}

function PlayerDialog({ player, groupId, onClose, onError }) {
  const dialogRef = useRef(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
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
  }, [player.player_id, groupId, onError]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="player-history-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-panel p-5 font-body text-white backdrop:bg-black/80"
    >
      <h2 id="player-history-title" className="mb-4 break-words font-display text-2xl font-black uppercase italic">{player.name}</h2>
      {history ? <PlayerRatingHistory history={history} /> : <p role="status" className="text-zinc-300">Cargando…</p>}
      <button type="button" onClick={onClose} className="mt-5 min-h-11 w-full rounded-lg border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/5">
        Cerrar
      </button>
    </dialog>
  );
}

export default function RankingPage({ user, onAccessLost }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [honors, setHonors] = useState(null);
  const [groups, setGroups] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [myHistory, setMyHistory] = useState(null);
  const [position, setPosition] = useState("");
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
  const ownGroup = user.team_id?.startsWith("escuela") ? "escuela" : user.team_id;
  const group = groups?.find(({ id }) => id === requested) ?? groups?.find(({ id }) => id === ownGroup) ?? groups?.[0];
  const groupId = group?.id ?? null;

  useEffect(() => {
    if (!groupId) return undefined;
    let cancelled = false;
    setRanking(null);
    setMyHistory(null);
    setHonors(null);
    // Los premios son un extra: si fallan, el ranking se ve igual.
    getRankingHonors(groupId)
      .then((data) => {
        if (!cancelled) setHonors(data);
      })
      .catch(() => {});
    setPosition("");
    setError("");
    getRanking(groupId)
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
  }, [groupId, handleError]);

  const positions = ranking ? [...new Set(ranking.entries.map((entry) => entry.position))].sort() : [];
  const visible = ranking ? ranking.entries.filter((entry) => !position || entry.position === position) : [];

  const rowProps = (entry, index) => ({
    entry,
    place: position ? index + 1 : entry.rank,
    mine: entry.player_id === ranking.my_player_id,
    hasPrevious: ranking.has_previous,
    showMovement: !position,
    onOpen: () => setViewing(entry),
  });

  return (
    <div className="space-y-6">
      <RankingHero stacked={Boolean(group?.can_rate)} title="Ranking" subtitle={group ? `${group.name}${ranking?.week ? ` · ${weekLabel(ranking.week)}` : ""}` : undefined}>
        <div className="flex shrink-0 gap-2">
          <Link to={group ? `/app/ranking/recompensas?grupo=${group.id}` : "/app/ranking/recompensas"} className="flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-400 px-3 text-sm font-extrabold text-void hover:bg-amber-300">
            <Crown aria-hidden="true" className="h-4 w-4 fill-void/20" />
            Premios
          </Link>
          {group?.can_rate && (
            <Link to={`/app/ranking/notas?grupo=${group.id}`} className="flex min-h-11 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-extrabold text-void hover:bg-zinc-200">
              <PenLine aria-hidden="true" className="h-4 w-4" />
              Notas
            </Link>
          )}
        </div>
      </RankingHero>

      {groups && <GroupPicker groups={groups} groupId={groupId} onChange={(id) => setSearchParams({ grupo: id }, { replace: true })} />}

      {error && <p role="alert" className="rounded-lg border border-red-300/50 bg-panel p-3 text-sm font-semibold text-red-200">{error}</p>}
      {!error && (!groups || (groupId && !ranking)) && <p role="status" className="text-zinc-300">Cargando…</p>}
      {groups?.length === 0 && <p className="rounded-xl bg-panel p-4 text-sm text-zinc-300">Tu equipo todavía no tiene ranking.</p>}

      {ranking && !ranking.week && (
        <p className="rounded-xl bg-panel p-4 text-sm text-zinc-300">
          {group.can_rate ? "Todavía no has publicado ninguna semana. Pon las notas y publícala para que salga el ranking." : "El entrenador todavía no ha publicado ninguna semana."}
        </p>
      )}

      {ranking?.week && (
        <>
          <HonorsBanner honors={honors} />

          <PositionFilter positions={positions} value={position} onChange={setPosition} />

          {/* Con el filtro cambian los puestos: se vuelve a montar para que repita la entrada. */}
          <div key={`${groupId}-${position}`} className="space-y-4">
            {visible.length > 0 && (
              <ol aria-label="Podio" className="grid grid-cols-3 items-end gap-2 border-b-2 border-white/15 pt-6">
                {visible.slice(0, 3).map((entry, index) => (
                  <PodiumPlace key={entry.player_id} index={index} {...rowProps(entry, index)} />
                ))}
              </ol>
            )}
            {visible.length > 3 && (
              <ol start={4} aria-label="Resto de la clasificación" className="space-y-2">
                {visible.slice(3).map((entry, index) => (
                  <RankRow key={entry.player_id} delay={0.45 + index * 0.06} {...rowProps(entry, index + 3)} />
                ))}
              </ol>
            )}
          </div>

          <p className="text-center text-xs text-zinc-500">Media de las últimas 4 semanas publicadas</p>

          {ranking.pending.length > 0 && !position && (
            <section aria-labelledby="pending-title" className="rounded-xl border border-dashed border-white/15 p-4">
              <h2 id="pending-title" className="font-display font-extrabold uppercase italic">Aún sin puesto</h2>
              <p className="mt-1 text-sm text-zinc-400">Hacen falta al menos 2 semanas puntuadas de las últimas 4.</p>
              <p className="mt-2 text-sm text-zinc-200">{ranking.pending.map((person) => person.name).join(", ")}</p>
            </section>
          )}

          {myHistory && myHistory.weeks.length > 0 && (
            <section aria-labelledby="my-card-title" className="grain overflow-hidden rounded-2xl border border-tnt/40 bg-gradient-to-b from-tnt/20 to-panel p-5">
              <h2 id="my-card-title" className="mb-4 font-display text-2xl font-black uppercase italic">Tu ficha</h2>
              <PlayerRatingHistory history={myHistory} />
            </section>
          )}
        </>
      )}

      {viewing && <PlayerDialog player={viewing} groupId={groupId} onClose={() => setViewing(null)} onError={handleError} />}
    </div>
  );
}
