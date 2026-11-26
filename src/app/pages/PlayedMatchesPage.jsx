import { useCallback, useEffect, useState } from "react";
import { useMediaQuery } from "@/app/useMediaQuery.js";
import { ChartColumn, Check, ChevronLeft, Pencil, Trophy } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { changeLiveMvp, deleteMatch, listPlayedMatches, listTeams, updateMatch } from "@/app/api.js";
import { DateBadge, EventPlace, MatchNotes } from "@/app/components/MatchInfo.jsx";
import MatchDialog from "@/app/components/MatchDialog.jsx";
import { placeInfo, setsWon, matchKindLabel } from "@/app/matches.js";
import { defaultTeamId, isTeamId } from "@/app/teams.js";
import { Badge, Card, ChipGroup, EmptyState, IconButton, LinkButton, Notice, PageHeader, Select, cx } from "@/app/ui/index.js";

const KIND_TABS = [
  { value: "amistoso", label: "Amistosos" },
  { value: "liga", label: "Liga" },
  { value: "torneo", label: "Torneo" },
  { value: "otro", label: "Otros" },
];

// Victoria, derrota o empate según los sets. La victoria destaca (verde); la derrota, en rojo suave; el empate, neutro.
export function matchOutcome(sets) {
  const { won, lost } = setsWon(sets);
  return { won, lost, outcome: won > lost ? "win" : won < lost ? "loss" : "draw" };
}
const OUTCOME = {
  win: { label: "Victoria", tone: "voy", icon: Check },
  loss: { label: "Derrota", tone: "danger-soft" },
  draw: { label: "Empate", tone: "neutral" },
};

/**
 * Resumen de los partidos de un tipo: cuántos, victorias, derrotas (y empates) y sets a favor y en contra.
 * Solo cuentan los partidos con resultado apuntado; los que no lo tienen se dicen aparte para no engañar.
 */
export function summarize(matches) {
  const withResult = matches.filter((match) => match.sets.length > 0);
  const totals = { played: matches.length, withResult: withResult.length, win: 0, loss: 0, draw: 0, setsFor: 0, setsAgainst: 0 };
  for (const match of withResult) {
    const { won, lost, outcome } = matchOutcome(match.sets);
    totals[outcome] += 1;
    totals.setsFor += won;
    totals.setsAgainst += lost;
  }
  return totals;
}

function Stat({ label, value, className }) {
  return (
    <div className="min-w-0">
      <dt className="whitespace-nowrap text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className={cx("font-score text-xl leading-tight text-ink md:text-2xl", className)}>{value}</dd>
    </div>
  );
}

// La franja de arriba: el marcador del tipo elegido.
function SeasonSummary({ matches, label }) {
  const totals = summarize(matches);
  const missing = totals.played - totals.withResult;
  return (
    <Card as="section" aria-label={`Resumen de ${label}`} padding="sm" className="space-y-1.5" data-testid="played-summary">
      {/* En una sola tira: cada dato ocupa lo que necesita (así cabe hasta en un móvil pequeño). */}
      <dl className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <Stat label="Partidos" value={totals.played} />
        {totals.withResult > 0 ? (
          <>
            <Stat label="Victorias" value={totals.win} className="text-voy-text" />
            <Stat label={totals.draw > 0 ? "Derrotas · empates" : "Derrotas"} value={totals.draw > 0 ? `${totals.loss} · ${totals.draw}` : totals.loss} className="text-danger-text" />
            <Stat label="Sets (favor–contra)" value={`${totals.setsFor}–${totals.setsAgainst}`} />
          </>
        ) : (
          <p className="flex-1 self-end text-right text-sm text-ink-muted">Sin resultados apuntados todavía.</p>
        )}
      </dl>
      {totals.withResult > 0 && missing > 0 && (
        <p className="text-xs text-ink-muted">{missing === 1 ? "1 partido sin resultado no cuenta" : `${missing} partidos sin resultado no cuentan`} en victorias, derrotas ni sets.</p>
      )}
    </Card>
  );
}

function MatchResult({ sets }) {
  const { won, lost, outcome } = matchOutcome(sets);
  const { label, tone, icon: Icon } = OUTCOME[outcome];
  return (
    <div className="space-y-2 rounded-field bg-raised p-2.5" data-testid="match-result">
      <div className="flex items-center justify-between gap-3">
        <Badge tone={tone} className="gap-1 px-2.5 py-1 text-sm">
          {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />}
          {label}
        </Badge>
        <p className="font-score text-3xl leading-none text-ink">
          <span className="sr-only">Sets ganados y perdidos: </span>
          {won}<span className="mx-1 text-ink-muted">–</span>{lost}
        </p>
      </div>
      <ol className="grid auto-cols-fr grid-flow-col gap-1.5">
        {sets.map((set, index) => {
          const ours = set.us > set.them;
          return (
            <li key={index} className={cx("rounded-field py-1 text-center", ours ? "bg-voy/10 text-voy-text" : "bg-danger/10 text-danger-text")}>
              <p className="text-xs font-semibold">Set {index + 1}</p>
              <p className="font-score text-base">{set.us}-{set.them}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// El MVP: lo único dorado de la tarjeta. El entrenador lo elige de un menú con los que jugaron (o «Sin MVP»).
function MvpStrip({ children }) {
  return (
    <div className="flex min-h-11 items-center gap-2.5 rounded-field bg-gold/10 px-2.5 py-1.5 ring-1 ring-inset ring-gold/30" data-testid="match-mvp">
      <Trophy aria-hidden="true" className="h-5 w-5 shrink-0 text-gold-text" />
      {children}
    </div>
  );
}

function MvpPicker({ match, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = match.mvp_player_id ?? "";
  const id = `mvp-${match.id}`;
  return (
    <div>
      <MvpStrip>
        <label htmlFor={id} className="shrink-0 text-sm font-bold text-gold-text">MVP</label>
        <div className="min-w-0 flex-1">
          <Select
            id={id}
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
            className="font-semibold"
          >
            <option value="">Sin MVP</option>
            {match.players.map((player) => (
              <option key={player.player_id} value={player.player_id}>
                {player.name}
              </option>
            ))}
          </Select>
        </div>
      </MvpStrip>
      {error && <Notice tone="error" inline size="sm" className="mt-1">{error}</Notice>}
    </div>
  );
}

// Un partido jugado: quién, cuándo y de qué tipo arriba; el resultado con sus sets; el MVP y el informe en una
// misma franja (uno al lado del otro si caben); el sitio y las notas al final.
function PlayedMatchRow({ match, onEdit, onReload }) {
  const mvp = match.can_edit && match.live_id && match.players.length > 0 ? (
    <MvpPicker match={match} onChange={onReload} />
  ) : (
    match.mvp && (
      <MvpStrip>
        <p className="min-w-0 text-sm">
          <span className="font-bold text-gold-text">MVP</span>
          <span className="mx-1.5 text-ink-muted">·</span>
          <span className="font-bold text-ink">{match.mvp}</span>
        </p>
      </MvpStrip>
    )
  );
  return (
    <Card as="li" padding="sm" className="flex flex-col gap-2.5" data-testid="played-match">
      <div className="flex items-center gap-3">
        <DateBadge iso={match.date} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink-muted">contra</p>
          <p className="break-words font-display text-lg font-extrabold leading-tight text-ink">{match.opponent}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{matchKindLabel(match.kind)} · {match.time}</p>
        </div>
        {match.can_edit && <IconButton icon={Pencil} label={`Editar el partido contra ${match.opponent}`} onClick={() => onEdit(match)} />}
      </div>
      {match.sets.length > 0 ? (
        <MatchResult sets={match.sets} />
      ) : (
        <p className="rounded-field bg-raised px-3 py-2.5 text-sm text-ink-muted">Resultado sin apuntar</p>
      )}
      {(mvp || match.live_id) && (
        <div className="flex flex-wrap items-start gap-2">
          {mvp && <div className="min-w-[12rem] flex-1">{mvp}</div>}
          {match.live_id && (
            <LinkButton as={Link} to={`/app/directo/${match.live_id}`} icon={ChartColumn} className={mvp ? "flex-1 min-[420px]:flex-none" : "w-full"}>
              Ver informe
            </LinkButton>
          )}
        </div>
      )}
      {match.location && <EventPlace place={placeInfo(match.location).label} url={placeInfo(match.location).url} />}
      {match.notes && <MatchNotes notes={match.notes} />}
    </Card>
  );
}

function KindTabs({ tabs, active, counts, onChange }) {
  return (
    <div data-testid="played-kinds">
      <ChipGroup label="Tipo de partido" options={tabs.map(({ value, label }) => ({ value, label, count: counts[value] ?? 0 }))} value={active} onChange={onChange} />
    </div>
  );
}

export default function PlayedMatchesPage({ user, onAccessLost }) {
  const phone = useMediaQuery("(max-width: 767px)");
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

  // Pantalla fija en el móvil (Premium deportivo): arriba la cabecera, el tipo de partido y el resumen; la lista de
  // partidos se desliza por dentro. En escritorio, dos columnas de partidos a todo el ancho.
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 md:h-auto">
      {/* En el móvil, los tipos de partido van en la línea de la cabecera y «Partidos» queda como flecha. */}
      <PageHeader
        title="Jugados"
        subtitle={phone && played ? <KindTabs tabs={tabs} active={active} counts={counts} onChange={setSelected} /> : teamName}
        actions={
          <LinkButton as={Link} size="sm" to={`/app?equipo=${teamId}&pestana=partidos`} icon={ChevronLeft} className={phone ? "w-10 px-0" : "pl-2"} title="Partidos">
            {phone ? <span className="sr-only">Partidos</span> : "Partidos"}
          </LinkButton>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}
      {!error && !played && <p role="status" className="text-ink-muted">Cargando…</p>}

      {played && (
        <>
          {!phone && <KindTabs tabs={tabs} active={active} counts={counts} onChange={setSelected} />}
          {shown.length === 0 ? (
            <EmptyState>Todavía no hay partidos en {activeLabel}.</EmptyState>
          ) : (
            <>
              <SeasonSummary matches={shown} label={activeLabel} />
              <div className="-mx-gutter min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pb-2 md:mx-0 md:overflow-visible md:px-0" data-testid="played-scroll">
                {/* Dos columnas solo con sitio de verdad (ordenador ancho); en móvil y tableta, una. */}
                <ul className="grid items-start gap-3 lg:grid-cols-2">
                  {shown.map((match) => (
                    <PlayedMatchRow key={match.id} match={match} onEdit={setEditing} onReload={load} />
                  ))}
                </ul>
              </div>
            </>
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
