import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, UserPlus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { createPlayer, deletePlayer, listPlayers, listTeamFamily, listTeams, updatePlayer } from "@/app/api.js";
import Avatar from "@/app/components/Avatar.jsx";
import CourtBoard from "@/app/components/CourtBoard.jsx";
import RosterTabs from "@/app/components/board/RosterTabs.jsx";
import PlayerDialog from "@/app/components/PlayerDialog.jsx";
import PlayerProfileDialog from "@/app/components/PlayerProfileDialog.jsx";
import { GroupPicker, RankingHero } from "@/app/components/RankingVisuals.jsx";
import { isStaff, POSITIONS } from "@/app/roles.js";

function RosterPositionTag({ position }) {
  return (
    <span className="inline-block -skew-x-12 bg-tnt px-1.5 py-px text-[10px] font-extrabold text-onbrand">
      <span className="inline-block skew-x-12">{position}</span>
    </span>
  );
}

function PlayerCardContent({ player }) {
  const preferred = player.preferred_positions.filter((position) => position !== player.position);
  return (
    <>
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-tnt text-onbrand" />
      <Avatar name={player.name} picture={player.picture} className="h-10 w-10 text-xs ring-1 ring-white/10" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block break-words font-display text-sm font-black leading-tight">{player.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1">
          <RosterPositionTag position={player.position} />
          {preferred.map((position) => (
            <span key={position} className="rounded border border-white/15 px-1.5 text-[10px] font-semibold text-zinc-400">
              <span className="sr-only">También prefiere </span>{position}
            </span>
          ))}
        </span>
        {player.phone && (
          <span className="mt-1 flex items-center gap-1.5 text-xs text-zinc-300">
            <Phone aria-hidden="true" className="h-3 w-3 shrink-0 text-zinc-500" />{player.phone}
          </span>
        )}
        {player.email && (
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-300">
            <Mail aria-hidden="true" className="h-3 w-3 shrink-0 text-zinc-500" /><span className="min-w-0 break-words">{player.email}</span>
          </span>
        )}
      </span>
      {player.number !== null && (
        <span className="shrink-0 bg-tnt bg-clip-text pr-1 font-display text-3xl font-black leading-none tabular-nums text-transparent text-onbrand">
          <span className="sr-only">Dorsal </span>{player.number}
        </span>
      )}
    </>
  );
}

function SquadSummary({ players }) {
  const counts = POSITIONS
    .map((position) => ({ position, count: players.filter((player) => player.position === position).length }))
    .filter(({ count }) => count > 0);
  if (counts.length === 0) return null;
  return (
    <ul aria-label="Jugadores por posición" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {counts.map(({ position, count }) => (
        <li key={position} className="flex shrink-0 items-center gap-2 rounded-xl border border-white/5 bg-panel px-3 py-2">
          <span className="font-display text-2xl font-black leading-none tabular-nums text-ember">{count}</span>
          <span className="text-xs font-bold text-zinc-300">{position}</span>
        </li>
      ))}
    </ul>
  );
}

const CARD_CLASS =
  "relative flex min-h-16 w-full items-center gap-2.5 overflow-hidden rounded-lg border border-white/5 bg-gradient-to-r from-white/[0.05] to-panel py-2 pl-3.5 pr-3";

export default function RosterPage({ user, onAccessLost }) {
  const [teams, setTeams] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [players, setPlayers] = useState(null);
  const [family, setFamily] = useState([]);
  const [error, setError] = useState("");
  // `editing` solo para añadir un jugador nuevo; tocar a uno abre su ficha (`viewing`), que ve todo el club.
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const canEdit = isStaff(user);
  const [searchParams] = useSearchParams();
  const requestedTeam = searchParams.get("equipo") ?? user.team_id;
  const team = teams?.find((item) => item.id === teamId);

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401 || requestError.status === 403) {
      onAccessLost();
      return;
    }
    setError(requestError.message);
  }, [onAccessLost]);

  useEffect(() => {
    listTeams()
      .then((items) => {
        setTeams(items);
        setTeamId(items.some((item) => item.id === requestedTeam) ? requestedTeam : items[0]?.id ?? null);
      })
      .catch(handleError);
  }, [handleError, requestedTeam]);

  const load = useCallback(async (id) => {
    setPlayers(null);
    setError("");
    try {
      setPlayers(await listPlayers(id));
    } catch (requestError) {
      handleError(requestError);
    }
  }, [handleError]);

  useEffect(() => {
    if (teamId) load(teamId);
  }, [teamId, load]);

  useEffect(() => {
    if (!teamId) return undefined;
    let cancelled = false;
    setFamily([]);
    // Las gradas son un extra: si fallan, la plantilla se sigue viendo.
    listTeamFamily(teamId)
      .then((items) => {
        if (!cancelled) setFamily(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const finishEditing = (nextTeamId) => {
    setEditing(null);
    if (nextTeamId === teamId) load(teamId);
    else setTeamId(nextTeamId);
  };

  // Un 401 o 403 al guardar significa que ha cambiado tu acceso; el resto se muestra en el formulario.
  const guarded = async (action) => {
    try {
      return await action();
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) onAccessLost();
      throw requestError;
    }
  };

  const save = async (values) => {
    const saved = await guarded(() =>
      editing.player ? updatePlayer(editing.player.id, values) : createPlayer(values),
    );
    finishEditing(saved.team_id);
  };

  // La chapa se mueve al momento en pantalla; si el servidor no lo guarda, vuelve a su sitio.
  const moveOnCourt = async (player, court) => {
    const setCourt = (value) =>
      setPlayers((current) => current?.map((item) => (item.id === player.id ? { ...item, court: value } : item)));
    setCourt(court);
    setError("");
    try {
      await updatePlayer(player.id, { court });
    } catch (requestError) {
      setCourt(player.court);
      handleError(requestError);
    }
  };

  // El puesto cambia al momento en pantalla; si el servidor no lo guarda, vuelve al anterior.
  const changePosition = async (player, position) => {
    const setPosition = (value) =>
      setPlayers((current) => current?.map((item) => (item.id === player.id ? { ...item, position: value } : item)));
    setPosition(position);
    setError("");
    try {
      await updatePlayer(player.id, { position });
    } catch (requestError) {
      setPosition(player.position);
      handleError(requestError);
    }
  };

  const remove = async () => {
    try {
      await guarded(() => deletePlayer(viewing.id));
      setViewing(null);
      load(teamId);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="space-y-6">
      <RankingHero
        stacked
        title="Plantilla"
        subtitle={team ? `${team.name}${players ? ` · ${players.length === 1 ? "1 jugador" : `${players.length} jugadores`}` : ""}` : undefined}
      >
        {canEdit && teams && (
          <button
            type="button"
            onClick={() => setEditing({ player: null })}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-extrabold text-void hover:bg-zinc-200"
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            Añadir
          </button>
        )}
      </RankingHero>

      {teams && <GroupPicker groups={teams} groupId={teamId} onChange={setTeamId} />}

      {teams && <RosterTabs active="plantilla" teamId={teamId} />}

      {players && <SquadSummary players={players} />}

      {error && <p role="alert" className="sticky top-2 z-30 rounded-lg border border-red-300/50 bg-panel p-3 text-sm font-semibold text-red-200">{error}</p>}
      {!error && (!teams || !players) && <p role="status" className="text-zinc-300">Cargando…</p>}

      {players && (
        <CourtBoard players={players} family={family} canEdit={canEdit} beach={teamId === "playa"} onMove={moveOnCourt} onChangePosition={changePosition} />
      )}

      {players && (
        <section aria-labelledby="squad-title" className="space-y-3">
          <h2 id="squad-title" className="font-display text-2xl font-black">Jugadores</h2>
          {players.length === 0 && (
            <p className="rounded-xl bg-panel p-4 text-sm text-zinc-300">
              {canEdit ? "Este equipo aún no tiene jugadores. Añade el primero." : "Este equipo aún no tiene jugadores."}
            </p>
          )}
          <ul key={teamId} className="grid gap-1.5 md:grid-cols-2">
            {players.map((player, index) => (
              <motion.li
                key={player.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
              >
                <button
                  type="button"
                  onClick={() => setViewing(player)}
                  aria-label={`Ver la ficha de ${player.name}`}
                  className={`${CARD_CLASS} hover:border-white/25`}
                >
                  <PlayerCardContent player={player} />
                </button>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      {editing && (
        <PlayerDialog
          player={null}
          teams={teams}
          defaultTeamId={teamId}
          onSave={save}
          onDelete={() => {}}
          onClose={() => setEditing(null)}
        />
      )}
      {viewing && <PlayerProfileDialog player={viewing} onClose={() => setViewing(null)} onDelete={canEdit ? remove : null} onError={handleError} />}
    </div>
  );
}
