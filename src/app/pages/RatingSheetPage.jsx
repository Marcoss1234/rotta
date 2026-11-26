import { Fragment, useCallback, useEffect, useState } from "react";
import { useMediaQuery } from "@/app/useMediaQuery.js";
import { ChevronLeft, ChevronRight, MessageSquareText, PenLine, Trophy, Zap } from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { getRatingSheet, listRankingGroups, publishRatingWeek, saveRating } from "@/app/api.js";
import Avatar from "@/app/components/Avatar.jsx";
import RatingDialog from "@/app/components/RatingDialog.jsx";
import { AnimatedBar, GroupPicker, OverallNumber, PositionTag, SHORT_LABELS } from "@/app/components/RankingVisuals.jsx";
import { currentMonday, formatScore, shiftWeek, weekLabel } from "@/app/ranking.js";
import { Button, ChipGroup, Dialog, IconButton, LinkButton, Notice, PageHeader } from "@/app/ui/index.js";

// Borrador o publicada: el estado de la semana, con su color con significado (ámbar: aún no lo ve nadie; verde: ya
// cuenta en el ranking), el mismo en todas las identidades.
function WeekState({ published }) {
  return published ? (
    <span className="inline-flex items-center rounded-full bg-voy/10 px-2 py-0.5 text-xs font-bold text-voy-text ring-1 ring-inset ring-voy/30">Publicada</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-bold text-warning-text ring-1 ring-inset ring-warning/40">Borrador</span>
  );
}

// Elegir la semana: flechas a los lados y, en medio, cuál es y su estado.
// children: en el móvil, el progreso y «Publicar» van dentro del mismo bloque (todo lo de la semana junto).
function WeekStepper({ week, published, onChange, children }) {
  const isCurrent = week === currentMonday();
  return (
    <div className="ui-card rounded-card bg-card">
    <div className="flex items-center gap-1 p-1">
      <IconButton icon={ChevronLeft} label="Semana anterior" onClick={() => onChange(shiftWeek(week, -1))} />
      <p className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center" aria-live="polite">
        <span className="font-title text-base text-ink">{isCurrent ? "Esta semana" : "Semana"}</span>
        <span className="text-sm text-ink-muted">{weekLabel(week)}</span>
        {published !== null && <WeekState published={published} />}
      </p>
      <IconButton icon={ChevronRight} label="Semana siguiente" disabled={isCurrent} onClick={() => onChange(shiftWeek(week, 1))} className="disabled:opacity-30" />
    </div>
    {children && <div className="border-t border-line lg:hidden">{children}</div>}
    </div>
  );
}

// Cuántos llevas puntuados, qué significa el estado de la semana y el botón para publicarla.
function Progress({ sheet, rated, onPublish, compact }) {
  const total = sheet.rows.length;
  const canPublish = !sheet.published && rated > 0;
  return (
    <section aria-label="Estado de la semana" className={compact ? "p-3" : "ui-card space-y-3 rounded-card bg-card p-card"}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-muted">
            <span className="font-score text-xl text-ink">{rated}</span>/{total} con nota
          </p>
          <AnimatedBar percent={total ? (rated / total) * 100 : 0} className="mt-1.5 h-2" />
        </div>
        {canPublish && compact && (
          <Button icon={Zap} onClick={onPublish}>Publicar</Button>
        )}
      </div>
      <p className={`text-xs text-ink-muted ${compact ? "mt-2" : ""}`}>
        {sheet.published ? "Los cambios se aplican al ranking al momento." : "Los jugadores no verán nada hasta que la publiques."}
      </p>
      {canPublish && !compact && (
        <Button icon={Zap} size="lg" block onClick={onPublish}>Publicar semana</Button>
      )}
    </section>
  );
}

// Un jugador en la hoja: su posición, sus notas por habilidad en una línea y la nota global; sin nota, «Puntuar».
function SheetRow({ row, skills, onOpen }) {
  const rating = row.rating;
  const scored = rating ? skills.filter(({ id }) => rating.scores[id] !== undefined) : [];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Poner notas a ${row.name}`}
        className="flex min-h-[3.75rem] w-full items-center gap-3 px-3 py-2 text-left transition-ui hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rotta-text"
      >
        <Avatar name={row.name} picture={row.picture} className="h-10 w-10 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words text-sm font-semibold text-ink">{row.name}</span>
            <PositionTag position={rating?.position ?? row.position} />
            {rating?.comment && (
              <span title="Tiene comentario" className="text-ink-muted">
                <MessageSquareText aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="sr-only">Con comentario</span>
              </span>
            )}
          </span>
          {scored.length > 0 && (
            <span className="mt-1 block text-xs leading-snug text-ink-muted">
              {scored.map(({ id, label }, index) => (
                <Fragment key={id}>
                  {index > 0 && <span aria-hidden="true"> · </span>}
                  <span className="whitespace-nowrap">
                    {SHORT_LABELS[id] ?? label} <span className="font-semibold text-ink">{formatScore(rating.scores[id])}</span>
                  </span>
                </Fragment>
              ))}
            </span>
          )}
        </span>
        {rating ? (
          <OverallNumber overall={rating.overall} className="w-10 shrink-0 text-right text-2xl" />
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-club-soft px-3 py-1 text-xs font-bold text-club-ui">
            <PenLine aria-hidden="true" className="h-3.5 w-3.5" />
            Puntuar
          </span>
        )}
      </button>
    </li>
  );
}

const FILTERS = [
  { value: "", label: "Todos" },
  { value: "missing", label: "Sin nota" },
  { value: "rated", label: "Con nota" },
];

// Los equipos en la cabecera del móvil: pastillas que caben en una línea (sin deslizar).
function TeamChips({ groups, groupId, onChange }) {
  return <ChipGroup label="Elegir equipo" value={groupId} onChange={onChange} options={groups.map((group) => ({ value: group.id, label: group.name.replace(/^Club (Senior )?/, "") }))} />;
}

export default function RatingSheetPage({ onAccessLost }) {
  const phone = useMediaQuery("(max-width: 767px)");
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState(null);
  const [week, setWeek] = useState(currentMonday);
  const [sheet, setSheet] = useState(null);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401 || requestError.status === 403) {
      onAccessLost();
      return;
    }
    setError(requestError.message);
  }, [onAccessLost]);

  useEffect(() => {
    listRankingGroups()
      .then((items) => setGroups(items.filter((group) => group.can_rate)))
      .catch(handleError);
  }, [handleError]);

  const requested = searchParams.get("grupo");
  const group = groups?.find(({ id }) => id === requested) ?? groups?.[0] ?? null;
  const groupId = group?.id ?? null;

  useEffect(() => {
    if (!groupId) return undefined;
    let cancelled = false;
    setSheet(null);
    setConfirming(false);
    setError("");
    getRatingSheet(groupId, week)
      .then((data) => {
        if (!cancelled) setSheet(data);
      })
      .catch((requestError) => {
        if (!cancelled) handleError(requestError);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, week, handleError]);

  const save = async (values) => {
    let saved;
    try {
      saved = await saveRating({ group_id: groupId, week, player_id: editing.player_id, ...values });
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) onAccessLost();
      throw requestError;
    }
    setSheet((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.player_id === editing.player_id ? { ...row, rating: saved.rating } : row)),
    }));
    setEditing(null);
  };

  const publish = async () => {
    setPublishing(true);
    setError("");
    try {
      await publishRatingWeek(groupId, week);
      setSheet((current) => ({ ...current, published: true }));
      setConfirming(false);
    } catch (requestError) {
      setConfirming(false);
      handleError(requestError);
    } finally {
      setPublishing(false);
    }
  };

  if (groups?.length === 0) return <Navigate to="/app/ranking" replace />;

  const rated = sheet?.rows.filter((row) => row.rating).length ?? 0;
  const missing = (sheet?.rows.length ?? 0) - rated;
  const visible = sheet ? sheet.rows.filter((row) => (filter === "missing" ? !row.rating : filter === "rated" ? row.rating : true)) : [];

  // Pantalla fija en el móvil (Premium deportivo): arriba la cabecera, el equipo, la semana con su estado, cuántos
  // llevas y el botón de publicar; debajo, la lista de jugadores se desliza por dentro. Cada jugador se puntúa en
  // una hoja desde abajo. En escritorio: la lista a la izquierda y el estado de la semana fijo a la derecha.
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 md:h-auto">
      {/* En el móvil, los equipos van en la línea de la cabecera y «Ranking» queda como icono: una fila menos. */}
      <PageHeader
        title="Notas"
        subtitle={phone && groups?.length > 1 ? <TeamChips groups={groups} groupId={groupId} onChange={(id) => setSearchParams({ grupo: id }, { replace: true })} /> : group ? group.name : undefined}
        actions={
          <LinkButton as={Link} size="sm" variant="secondary" icon={Trophy} className={phone ? "w-10 px-0" : undefined} title="Ranking" to={`/app/ranking${groupId ? `?grupo=${groupId}` : ""}`}>
            {phone ? <span className="sr-only">Ranking</span> : "Ranking"}
          </LinkButton>
        }
      />

      {groups && !phone && <GroupPicker groups={groups} groupId={groupId} onChange={(id) => setSearchParams({ grupo: id }, { replace: true })} />}
      {groups?.length > 0 && (
        <WeekStepper week={week} published={sheet ? sheet.published : null} onChange={setWeek}>
          {sheet && sheet.rows.length > 0 && (
            <div className="lg:hidden">
              <Progress sheet={sheet} rated={rated} compact onPublish={() => setConfirming(true)} />
            </div>
          )}
        </WeekStepper>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {!error && (!groups || (groupId && !sheet)) && <p role="status" className="text-ink-muted">Cargando…</p>}

      {sheet && sheet.rows.length === 0 && <p className="rounded-card bg-raised p-4 text-sm text-ink-muted">Este equipo aún no tiene jugadores.</p>}

      {sheet && sheet.rows.length > 0 && (
        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
          <div className="-mx-gutter min-h-0 space-y-3 overflow-y-auto overscroll-contain px-gutter pb-2 md:mx-0 md:overflow-visible md:px-0" data-testid="rating-scroll">
            <ChipGroup
              label="Ver jugadores"
              scroll
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((item) => ({ ...item, count: item.value === "missing" ? missing : item.value === "rated" ? rated : sheet.rows.length }))}
            />
            {visible.length > 0 ? (
              <ul aria-label="Jugadores" className="ui-card divide-y divide-line overflow-hidden rounded-card bg-card">
                {visible.map((row) => (
                  <SheetRow key={row.player_id} row={row} skills={sheet.skills} onOpen={() => setEditing(row)} />
                ))}
              </ul>
            ) : (
              <p className="rounded-card bg-raised p-4 text-sm text-ink-muted">
                {filter === "missing" ? "Ya tienen nota todos los jugadores." : "Todavía no has puntuado a nadie esta semana."}
              </p>
            )}
          </div>

          <aside className="hidden lg:sticky lg:top-8 lg:block">
            <Progress sheet={sheet} rated={rated} onPublish={() => setConfirming(true)} />
          </aside>
        </div>
      )}

      {confirming && (
        <Dialog
          title="¿Publicar la semana?"
          onClose={() => setConfirming(false)}
          busy={publishing}
          placement="auto"
          footer={
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="lg" disabled={publishing} onClick={() => setConfirming(false)}>Todavía no</Button>
              <Button size="lg" icon={Zap} busy={publishing} busyLabel="Publicando…" onClick={publish}>Sí, publicar</Button>
            </div>
          }
        >
          {missing > 0 ? (
            <Notice tone="warning" announce={false}>
              Faltan {missing === 1 ? "1 jugador" : `${missing} jugadores`} por puntuar: esa semana no les contará. ¿Publicar?
            </Notice>
          ) : (
            <p className="text-sm text-ink">El ranking se actualizará para todo el equipo.</p>
          )}
        </Dialog>
      )}

      {editing && (
        <RatingDialog row={editing} skills={sheet.skills} weights={sheet.weights} published={sheet.published} onSave={save} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
