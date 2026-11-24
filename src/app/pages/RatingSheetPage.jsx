import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Trophy, Zap } from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { getRatingSheet, listRankingGroups, publishRatingWeek, saveRating } from "@/app/api.js";
import Avatar from "@/app/components/Avatar.jsx";
import RatingDialog from "@/app/components/RatingDialog.jsx";
import { AnimatedBar, GroupPicker, OverallNumber, PositionTag, RankingHero } from "@/app/components/RankingVisuals.jsx";
import { currentMonday, shiftWeek, weekLabel } from "@/app/ranking.js";
import { Notice } from "@/app/ui/index.js";

export default function RatingSheetPage({ onAccessLost }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState(null);
  const [week, setWeek] = useState(currentMonday);
  const [sheet, setSheet] = useState(null);
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
  const groupId = (groups?.find(({ id }) => id === requested) ?? groups?.[0])?.id ?? null;

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
      handleError(requestError);
    } finally {
      setPublishing(false);
    }
  };

  if (groups?.length === 0) return <Navigate to="/app/ranking" replace />;

  const rated = sheet?.rows.filter((row) => row.rating).length ?? 0;
  const missing = (sheet?.rows.length ?? 0) - rated;
  const isCurrent = week === currentMonday();

  return (
    <div className="space-y-6">
      <RankingHero title="Notas" subtitle={isCurrent ? `Esta semana · ${weekLabel(week)}` : `Semana ${weekLabel(week)}`}>
        <Link to={`/app/ranking${groupId ? `?grupo=${groupId}` : ""}`} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-extrabold text-void hover:bg-zinc-200">
          <Trophy aria-hidden="true" className="h-4 w-4" />
          Ranking
        </Link>
      </RankingHero>

      {groups && <GroupPicker groups={groups} groupId={groupId} onChange={(id) => setSearchParams({ grupo: id }, { replace: true })} />}

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-panel p-2">
        <button type="button" aria-label="Semana anterior" onClick={() => setWeek((current) => shiftWeek(current, -1))} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/5">
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <p className="text-center font-display text-sm font-extrabold" aria-live="polite">
          {isCurrent ? "Esta semana" : weekLabel(week)}
        </p>
        <button type="button" aria-label="Semana siguiente" disabled={isCurrent} onClick={() => setWeek((current) => shiftWeek(current, 1))} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/5 disabled:opacity-30">
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {!error && !sheet && <p role="status" className="text-zinc-300">Cargando…</p>}

      {sheet && (
        <>
          <div className="rounded-3xl bg-panel p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className={`rounded px-2 py-0.5 text-[11px] font-extrabold ${sheet.published ? "bg-emerald-300/20 text-emerald-200" : "bg-ember/20 text-ember"}`}>
                {sheet.published ? "Publicada" : "Borrador"}
              </span>
              <span className="font-display text-lg font-extrabold tabular-nums">{rated}<span className="text-zinc-500">/{sheet.rows.length}</span></span>
            </div>
            <AnimatedBar percent={sheet.rows.length ? (rated / sheet.rows.length) * 100 : 0} className="h-2" />
            <p className="mt-2 text-xs text-zinc-400">
              {sheet.published ? "Los cambios se aplican al ranking al momento." : "Los jugadores no verán nada hasta que la publiques."}
            </p>
          </div>

          {sheet.rows.length === 0 && <p className="rounded-3xl bg-panel p-4 text-sm text-zinc-300">Este equipo aún no tiene jugadores.</p>}

          <ul className="space-y-2">
            {sheet.rows.map((row) => (
              <li key={row.player_id}>
                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  aria-label={`Poner notas a ${row.name}`}
                  className={`flex min-h-[4.25rem] w-full items-center gap-3 rounded-xl border px-3 py-2.5 hover:border-white/25 ${row.rating ? "border-white/5 bg-panel" : "border-dashed border-white/15"}`}
                >
                  <Avatar name={row.name} picture={row.picture} />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block break-words font-bold">{row.name}</span>
                    <span className="mt-0.5 block"><PositionTag position={row.rating?.position ?? row.position} /></span>
                  </span>
                  {row.rating ? (
                    <OverallNumber overall={row.rating.overall} className="text-3xl" />
                  ) : (
                    <span className="rounded-full bg-tnt/15 px-3 py-1 text-xs font-bold text-ember">Puntuar</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {!sheet.published && rated > 0 && (
            <div className="rounded-3xl bg-panel p-4">
              {confirming ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-200">
                    {missing > 0
                      ? `Faltan ${missing === 1 ? "1 jugador" : `${missing} jugadores`} por puntuar: esa semana no les contará. ¿Publicar?`
                      : "¿Publicar la semana? El ranking se actualizará para todo el equipo."}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={publishing} onClick={() => setConfirming(false)} className="min-h-11 rounded-full border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-50">
                      Todavía no
                    </button>
                    <button type="button" disabled={publishing} onClick={publish} className="min-h-11 rounded-full bg-tnt px-4 text-sm font-bold text-onbrand disabled:opacity-50">
                      {publishing ? "Publicando…" : "Sí, publicar"}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-tnt px-4 font-display text-lg font-extrabold text-onbrand">
                  <Zap aria-hidden="true" className="h-5 w-5 fill-white" />
                  Publicar semana
                </button>
              )}
            </div>
          )}
        </>
      )}

      {editing && <RatingDialog row={editing} skills={sheet.skills} weights={sheet.weights} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
