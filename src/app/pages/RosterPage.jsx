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
import { GroupPicker, PositionTag, RankingHero } from "@/app/components/RankingVisuals.jsx";
import { isStaff, POSITIONS } from "@/app/roles.js";
import { isBeachTeam } from "@/app/teams.js";
import { Notice } from "@/app/ui/index.js";

function PlayerCardContent({ player }) {
  const preferred = player.preferred_positions.filter((position) => position !== player.position);
  return (
    <>
      <Avatar name={player.name} picture={player.picture} className="h-12 w-12 text-sm" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block break-words font-display text-base font-bold leading-tight">{player.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1">
          <PositionTag position={player.position} />
          {preferred.map((position) => (
            <span key={position} className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-zinc-400 ring-1 ring-inset ring-white/15">
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
        <span className="shrink-0 pr-1 font-display text-4xl font-extrabold leading-none tabular-nums text-white/90">
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
        <li key={position} className="flex shrink-0 items-center gap-2 rounded-full bg-panel py-1.5 pl-1.5 pr-4 ring-1 ring-inset ring-white/10">
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-tnt px-2 font-display text-base font-bold tabular-nums text-onbrand">{count}</span>
          <span className="text-sm font-semibold text-zinc-200">{position}</span>
        </li>
      ))}
    </ul>
  );
}

const CARD_CLASS =
  "relative flex min-h-[4.5rem] w-full items-center gap-3 overflow-hidden rounded-2xl bg-panel py-2.5 pl-3 pr-3 ring-1 ring-white/10";

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
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-void hover:bg-zinc-200"
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            Añadir
          </button>
        )}
      </RankingHero>

      {teams && <GroupPicker groups={teams} groupId={teamId} onChange={setTeamId} />}

      {teams && <RosterTabs active="plantilla" teamId={teamId} />}

      {players && <SquadSummary players={players} />}

      {error && <div className="sticky top-2 z-30 rounded-card bg-card"><Notice tone="error">{error}</Notice></div>}
      {!error && (!teams || !players) && <p role="status" className="text-zinc-300">Cargando…</p>}

      {players && (
        <CourtBoard players={players} family={family} canEdit={canEdit} beach={isBeachTeam(teamId)} onMove={moveOnCourt} onChangePosition={changePosition} />
      )}

      {players && (
        <section aria-labelledby="squad-title" className="space-y-3">
          <h2 id="squad-title" className="font-display text-2xl font-bold">Jugadores</h2>
          {players.length === 0 && (
            <p className="rounded-3xl bg-panel p-4 text-sm text-zinc-300">
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
                  className={`${CARD_CLASS} hover:ring-white/25`}
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
