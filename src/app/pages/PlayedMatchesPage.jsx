import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trophy } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { changeLiveMvp, deleteMatch, listPlayedMatches, listTeams, updateMatch } from "@/app/api.js";
import { DateBadge, EventPlace, MatchNotes } from "@/app/components/MatchInfo.jsx";
import MatchDialog from "@/app/components/MatchDialog.jsx";
import { RankingHero } from "@/app/components/RankingVisuals.jsx";
import { placeInfo, setsWon, matchKindLabel } from "@/app/matches.js";
import { defaultTeamId, isTeamId } from "@/app/teams.js";
import { Notice } from "@/app/ui/index.js";

const KIND_TABS = [
  { value: "amistoso", label: "Amistosos" },
  { value: "liga", label: "Liga" },
  { value: "torneo", label: "Torneo" },
  { value: "otro", label: "Otros" },
];

function MatchResult({ sets }) {
  const { won, lost } = setsWon(sets);
  const outcome = won > lost ? "Victoria" : won < lost ? "Derrota" : "Empate";
  return (
    <div className="rounded-xl bg-void/60 p-3" data-testid="match-result">
      <div className="flex items-center justify-between gap-3">
        <p className={`font-display text-xl font-extrabold ${won > lost ? "text-ember" : "text-zinc-300"}`}>{outcome}</p>
        <p className="font-display text-4xl font-extrabold leading-none">
          <span className="sr-only">Sets ganados y perdidos: </span>
          {won}<span className="mx-1.5 text-zinc-500">-</span>{lost}
        </p>
      </div>
      <ol className="mt-2.5 grid auto-cols-fr grid-flow-col gap-1.5">
        {sets.map((set, index) => (
          <li key={index} className={`rounded-lg py-1.5 text-center ${set.us > set.them ? "bg-green-500/20" : "bg-red-500/20"}`}>
            <p className="text-[10px] font-semibold text-zinc-400">Set {index + 1}</p>
            <p className={`text-sm font-extrabold tabular-nums ${set.us > set.them ? "text-green-400" : "text-red-400"}`}>{set.us}-{set.them}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

// El entrenador elige el MVP de un menú con los que jugaron (o «Sin MVP»).
function MvpPicker({ match, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = match.mvp_player_id ?? "";
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-bold text-amber-200">
        <span aria-hidden="true">🏆</span>
        MVP:
        <select
          value={current}
          disabled={busy}
          onChange={async (event) => {
            setBusy(true);
            setError("");
            try {
              await changeLiveMvp(match.live_id, event.target.value || null);
              await onChange();
            } catch (requestError) {
              setError(requestError.message);
            } finally {
              setBusy(false);
            }
          }}
          className="min-h-11 min-w-0 flex-1 rounded-full border border-amber-300/40 bg-void px-2 text-sm font-bold text-white disabled:opacity-50"
        >
          <option value="">Sin MVP</option>
          {match.players.map((player) => (
            <option key={player.player_id} value={player.player_id}>
              {player.name}
            </option>
          ))}
        </select>
      </label>
      {error && <Notice tone="error" inline size="sm" className="mt-1">{error}</Notice>}
    </div>
  );
}

function PlayedMatchRow({ match, onEdit, onReload }) {
  return (
    <li className="space-y-2.5 rounded-2xl ring-1 ring-white/10 bg-panel p-3" data-testid="played-match">
      <div className="flex items-center gap-3">
        <DateBadge iso={match.date} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-base font-semibold text-zinc-300">contra <span className="text-white">{match.opponent}</span></p>
          <p className="mt-0.5 text-xs font-bold text-ember">{matchKindLabel(match.kind)} · {match.time}</p>
        </div>
        {match.can_edit && (
          <button type="button" onClick={() => onEdit(match)} aria-label={`Editar el partido contra ${match.opponent}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/5 hover:text-white">
            <Pencil aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>
      {match.sets.length > 0 ? <MatchResult sets={match.sets} /> : <p className="text-sm text-zinc-400">Resultado sin apuntar</p>}
      {match.can_edit && match.live_id && match.players.length > 0 ? (
        <MvpPicker match={match} onChange={onReload} />
      ) : (
        match.mvp && (
          <p className="flex items-center gap-1.5 text-sm font-bold text-amber-200">
            <span aria-hidden="true">🏆</span> MVP: {match.mvp}
          </p>
        )
      )}
      {match.live_id && (
        <Link
          to={`/app/directo/${match.live_id}`}
          className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-amber-400 px-4 font-display text-sm font-bold text-amber-950"
        >
          <Trophy aria-hidden="true" className="h-4 w-4" />
          Ver informe
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      )}
      {match.location && <EventPlace place={placeInfo(match.location).label} url={placeInfo(match.location).url} />}
      {match.notes && <MatchNotes notes={match.notes} />}
    </li>
  );
}

function KindTabs({ tabs, active, counts, onChange }) {
  return (
    <div className={`grid gap-1 rounded-2xl ring-1 ring-white/10 bg-panel p-1 ${tabs.length === 4 ? "grid-cols-4" : "grid-cols-3"}`} data-testid="played-kinds">
      {tabs.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={value === active}
          onClick={() => onChange(value)}
          className={`flex min-h-14 flex-col items-center justify-center rounded-xl font-display font-extrabold transition-colors ${
            value === active ? "bg-tnt text-onbrand" : "text-zinc-300 hover:bg-white/5 hover:text-white"
          }`}
        >
          <span className="text-[13px] leading-tight">{label}</span>
          <span className="text-lg leading-tight tabular-nums">{counts[value] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

export default function PlayedMatchesPage({ user, onAccessLost }) {
  const [searchParams] = useSearchParams();
  const requested = searchParams.get("equipo");
  const teamId = isTeamId(requested) ? requested : isTeamId(user.team_id) ? user.team_id : defaultTeamId();
  const [teamName, setTeamName] = useState("");
  const [played, setPlayed] = useState(null);
  const [selected, setSelected] = useState(searchParams.get("tipo"));
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setPlayed(await listPlayedMatches(teamId));
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) onAccessLost();
      else setError(requestError.message);
    }
  }, [teamId, onAccessLost]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    listTeams()
      .then((teams) => setTeamName(teams.find((team) => team.id === teamId)?.name ?? ""))
      .catch(() => {
        // Es solo el subtítulo: la lista avisa si se ha perdido el acceso.
      });
  }, [teamId]);

  // Un 401 o 403 al guardar significa que ha cambiado tu acceso; el resto se muestra en el formulario.
  const guarded = async (action) => {
    try {
      await action();
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) onAccessLost();
      throw requestError;
    }
    setEditing(null);
    load();
  };

  const counts = {};
  (played ?? []).forEach((match) => {
    counts[match.kind] = (counts[match.kind] ?? 0) + 1;
  });
  // "Otros" solo aparece si hay alguno, para no dejar una pestaña siempre vacía.
  const tabs = KIND_TABS.filter(({ value }) => value !== "otro" || counts.otro);
  const wanted = selected ?? played?.[0]?.kind;
  const active = tabs.some(({ value }) => value === wanted) ? wanted : tabs[0].value;
  const shown = (played ?? []).filter((match) => match.kind === active);
  const activeLabel = tabs.find(({ value }) => value === active).label;

  return (
    <div className="space-y-6">
      <RankingHero title="Jugados" subtitle={teamName} stacked>
        <Link to={`/app?equipo=${teamId}&pestana=partidos`} className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-white pl-2 pr-3 text-sm font-extrabold text-void hover:bg-zinc-200">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Partidos
        </Link>
      </RankingHero>

      {error && <Notice tone="error">{error}</Notice>}
      {!error && !played && <p role="status" className="text-zinc-300">Cargando…</p>}

      {played && (
        <>
          <KindTabs tabs={tabs} active={active} counts={counts} onChange={setSelected} />
          {shown.length === 0 ? (
            <p className="rounded-3xl bg-panel p-4 text-sm text-zinc-400">Todavía no hay partidos en {activeLabel}.</p>
          ) : (
            <ul className="space-y-2">
              {shown.map((match) => (
                <PlayedMatchRow key={match.id} match={match} onEdit={setEditing} onReload={load} />
              ))}
            </ul>
          )}
        </>
      )}

      {editing && (
        <MatchDialog
          match={editing}
          teams={[]}
          defaultTeamId={teamId}
          onSave={(values) => guarded(() => updateMatch(editing.id, values))}
          onDelete={() => guarded(() => deleteMatch(editing.id))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
