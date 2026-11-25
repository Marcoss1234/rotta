import { useCallback, useEffect, useId, useState } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, Mail, Phone, UserPlus, Users } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { createPlayer, deletePlayer, listPlayers, listTeamFamily, listTeams, updatePlayer } from "@/app/api.js";
import Avatar from "@/app/components/Avatar.jsx";
import CourtBoard from "@/app/components/CourtBoard.jsx";
import RosterTabs from "@/app/components/board/RosterTabs.jsx";
import PlayerDialog from "@/app/components/PlayerDialog.jsx";
import PlayerProfileDialog from "@/app/components/PlayerProfileDialog.jsx";
import { GroupPicker, PositionTag, positionTone, RankingHero } from "@/app/components/RankingVisuals.jsx";
import { isStaff, POSITIONS } from "@/app/roles.js";
import { isBeachTeam } from "@/app/teams.js";
import { useMediaQuery } from "@/app/useMediaQuery.js";
import { Button, cx, EmptyState, Notice, TabPanel, Tabs } from "@/app/ui/index.js";

// En el ordenador (desde 1024 px) la pista y los jugadores van en dos columnas; en el móvil y la tableta, en dos
// vistas para no tener que bajar por toda la pista, el banquillo y las gradas hasta llegar a la lista.
const WIDE = "(min-width: 1024px)";

const playersLabel = (count) => (count === 1 ? "1 jugador" : `${count} jugadores`);

// El dorsal, grande y neutro; el color del club solo en una rayita debajo.
function Dorsal({ number }) {
  if (number === null || number === undefined) return null;
  return (
    <span className="flex shrink-0 flex-col items-center gap-1 pr-1">
      <span className="font-display text-4xl font-extrabold leading-none tabular-nums text-ink">
        <span className="sr-only">Dorsal </span>{number}
      </span>
      <span aria-hidden="true" className="h-1 w-5 rounded-full bg-club" />
    </span>
  );
}

function PlayerCardContent({ player }) {
  const preferred = player.preferred_positions.filter((position) => position !== player.position);
  return (
    <>
      <Avatar name={player.name} picture={player.picture} className="h-12 w-12 text-sm" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block break-words font-display text-base font-bold leading-tight text-ink">{player.name}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1">
          <PositionTag position={player.position} />
          {preferred.map((position) => (
            <span key={position} className="rounded-full px-2 py-0.5 text-xs font-semibold text-ink-muted ring-1 ring-inset ring-line">
              <span className="sr-only">También prefiere </span>{position}
            </span>
          ))}
        </span>
        {/* El contacto solo llega del servidor a entrenadores y administradores. */}
        {player.phone && (
          <span className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <Phone aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{player.phone}
          </span>
        )}
        {player.email && (
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 break-words">{player.email}</span>
          </span>
        )}
      </span>
      <Dorsal number={player.number} />
    </>
  );
}

// Cuántos hay en cada puesto, encima de la lista: el número grande y el punto del color de la posición.
function SquadSummary({ players }) {
  const counts = POSITIONS
    .map((position) => ({ position, count: players.filter((player) => player.position === position).length }))
    .filter(({ count }) => count > 0);
  if (counts.length === 0) return null;
  return (
    <ul aria-label="Jugadores por posición" className="flex flex-wrap gap-1.5">
      {counts.map(({ position, count }) => (
        <li key={position} className="flex items-center gap-1.5 rounded-control bg-raised py-1 pl-2.5 pr-3">
          <span aria-hidden="true" className={cx("h-2 w-2 rounded-full", positionTone(position).dot)} />
          <span className="font-display text-base font-extrabold leading-none tabular-nums text-ink">{count}</span>
          <span className="text-sm font-semibold text-ink-muted">{position}</span>
        </li>
      ))}
    </ul>
  );
}

function PlayerList({ players, teamId, canEdit, onOpen, onAdd }) {
  return (
    <section aria-labelledby="squad-title" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="squad-title" className="font-display text-lg font-extrabold leading-tight text-ink">Jugadores</h2>
        <p className="text-xs font-semibold text-ink-muted">{playersLabel(players.length)}</p>
      </div>
      <SquadSummary players={players} />
      {players.length === 0 ? (
        <EmptyState action={canEdit && <Button icon={UserPlus} size="sm" onClick={onAdd}>Añadir jugador</Button>}>
          {canEdit ? "Este equipo aún no tiene jugadores. Añade el primero." : "Este equipo aún no tiene jugadores."}
        </EmptyState>
      ) : (
        <ul key={teamId} className="space-y-2" data-testid="roster-list">
          {players.map((player, index) => (
            <motion.li
              key={player.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
            >
              <button
                type="button"
                onClick={() => onOpen(player)}
                aria-label={`Ver la ficha de ${player.name}`}
                className={cx(
                  "flex min-h-[4.75rem] w-full items-center gap-3 rounded-card bg-card px-3 py-3 shadow-card ring-1 ring-line transition",
                  "hover:ring-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text",
                )}
              >
                <PlayerCardContent player={player} />
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Mientras carga: la forma de la lista, sin saltos al llegar los datos.
function RosterLoading() {
  return (
    <div className="space-y-2" aria-hidden="true" data-testid="roster-loading">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex min-h-[4.75rem] items-center gap-3 rounded-card bg-card px-3 shadow-card ring-1 ring-line">
          <span className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-raised" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-2/3 animate-pulse rounded-full bg-raised" />
            <span className="block h-3 w-1/4 animate-pulse rounded-full bg-raised" />
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RosterPage({ user, onAccessLost }) {
  const [teams, setTeams] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [players, setPlayers] = useState(null);
  const [family, setFamily] = useState([]);
  const [error, setError] = useState("");
  // `editing`: el formulario de añadir ({ player: null }) o editar ({ player }); `viewing`: la ficha abierta.
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [view, setView] = useState("pista");
  const viewsId = useId();
  const wide = useMediaQuery(WIDE);
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
    const editingPlayer = editing.player;
    const saved = await guarded(() => (editingPlayer ? updatePlayer(editingPlayer.id, values) : createPlayer(values)));
    setEditing(null);
    if (saved.team_id === teamId) load(teamId);
    else setTeamId(saved.team_id);
    // Si se editó desde su ficha y sigue en este equipo, se vuelve a la ficha ya al día.
    if (editingPlayer && saved.team_id === teamId) setViewing({ ...editingPlayer, ...saved });
  };

  // Editar desde la ficha: se cierra la ficha y se abre el formulario; al cancelar, se vuelve a la ficha.
  const startEditing = () => {
    setEditing({ player: viewing });
    setViewing(null);
  };
  const cancelEditing = () => {
    if (editing.player) setViewing(editing.player);
    setEditing(null);
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

  // Quitar desde la ficha: si falla, el aviso sale en la propia ficha.
  const remove = async () => {
    await guarded(() => deletePlayer(viewing.id));
    setViewing(null);
    load(teamId);
  };

  const openAdd = () => setEditing({ player: null });
  const court = players && (
    <CourtBoard players={players} family={family} canEdit={canEdit} beach={isBeachTeam(teamId)} onMove={moveOnCourt} onChangePosition={changePosition} />
  );
  const list = players && <PlayerList players={players} teamId={teamId} canEdit={canEdit} onOpen={setViewing} onAdd={openAdd} />;

  return (
    <div className="space-y-5">
      <RankingHero title="Plantilla" subtitle={team ? `${team.name}${players ? ` · ${playersLabel(players.length)}` : ""}` : undefined}>
        {canEdit && teams && <Button icon={UserPlus} onClick={openAdd}>Añadir</Button>}
      </RankingHero>

      {teams && <GroupPicker groups={teams} groupId={teamId} onChange={setTeamId} />}

      {teams && <RosterTabs active="plantilla" teamId={teamId} />}

      {error && <div className="sticky top-2 z-30 rounded-card bg-card"><Notice tone="error">{error}</Notice></div>}
      {!error && (!teams || !players) && (
        <>
          <p role="status" className="sr-only">Cargando la plantilla…</p>
          <RosterLoading />
        </>
      )}

      {players && wide && (
        <div className="grid grid-cols-2 items-start gap-5" data-testid="roster-columns">
          {court}
          {list}
        </div>
      )}

      {players && !wide && (
        <div className="space-y-4">
          <Tabs
            id={viewsId}
            label="Ver la pista o la lista de jugadores"
            value={view}
            onChange={setView}
            items={[
              { id: "pista", label: "Pista", icon: LayoutGrid },
              { id: "jugadores", label: "Jugadores", icon: Users, count: players.length },
            ]}
          />
          <TabPanel tabsId={viewsId} tab="pista" value={view}>{court}</TabPanel>
          <TabPanel tabsId={viewsId} tab="jugadores" value={view}>{list}</TabPanel>
        </div>
      )}

      {editing && (
        <PlayerDialog
          player={editing.player}
          teams={teams}
          defaultTeamId={teamId}
          onSave={save}
          onClose={cancelEditing}
        />
      )}
      {viewing && (
        <PlayerProfileDialog
          player={viewing}
          onClose={() => setViewing(null)}
          onEdit={canEdit ? startEditing : null}
          onDelete={canEdit ? remove : null}
          onError={handleError}
        />
      )}
    </div>
  );
}
