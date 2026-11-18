import { useCallback, useEffect, useState } from "react";
import { Clock, Copy, Lock, Play, Plus, Trash2, Users } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createBoard, deleteBoard, listBoards, listTeams } from "@/app/api.js";
import ConfirmDialog from "@/app/components/board/ConfirmDialog.jsx";
import BoardScene, { CourtFrame } from "@/app/components/board/BoardScene.jsx";
import RosterTabs from "@/app/components/board/RosterTabs.jsx";
import { GroupPicker, RankingHero } from "@/app/components/RankingVisuals.jsx";
import { boardKindLabel, emptyBoard, loadClubPlayers } from "@/app/boards.js";

// "Hoy", "Ayer", "Hace 3 días" o la fecha.
function updatedLabel(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const seconds = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

// Una jugada en la lista: la pista en grande, y de un vistazo si se puede reproducir, cuánto dura y cuántos juegan.
function BoardCard({ board, rosterById, beach, canEdit, canDuplicate, busy, onOpen, onDuplicate, onDelete }) {
  const elements = board.steps[0]?.elements ?? [];
  const players = elements.filter((element) => element.type === "token" && element.side !== "rival").length;
  const rivals = elements.filter((element) => element.type === "token" && element.side === "rival").length;
  const recording = board.recording;
  const touches = recording?.actions?.length ?? 0;
  return (
    <li className="relative">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-stretch gap-3 overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.06] to-panel p-2.5 text-left transition-colors hover:border-white/25"
      >
        <span className="relative w-20 shrink-0">
          <CourtFrame half={board.court === "half"} beach={beach} className="w-20 shadow-[0_6px_18px_rgba(0,0,0,0.5)]">
            <BoardScene elements={elements} rosterById={rosterById} photos={false} />
          </CourtFrame>
          {recording && (
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tnt shadow-[0_4px_14px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-110 text-onbrand">
                <Play className="h-4 w-4 translate-x-px fill-white text-white" />
              </span>
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-0.5 pr-10">
          <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold">
            <span className="text-ember">{boardKindLabel(board.kind)}</span>
            {board.private && (
              <span className="flex items-center gap-1 rounded bg-sky-400/15 px-1.5 py-px text-sky-300">
                <Lock aria-hidden="true" className="h-2.5 w-2.5" />
                Solo tú
              </span>
            )}
            {canEdit && !board.private && (board.published ? (
              <span className="rounded bg-emerald-400/15 px-1.5 py-px text-emerald-300">Publicada</span>
            ) : (
              <span className="rounded bg-white/10 px-1.5 py-px text-zinc-300">Borrador</span>
            ))}
          </span>
          <span className="block break-words font-display text-lg font-extrabold leading-tight">{board.name}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-zinc-400">
            {recording ? (
              <span className="flex items-center gap-1 text-zinc-200">
                <Play aria-hidden="true" className="h-3 w-3 fill-current" />
                {seconds(recording.duration_ms)}
                {touches > 0 && <span className="text-zinc-400">· {touches} {touches === 1 ? "toque" : "toques"}</span>}
              </span>
            ) : (
              <span>Sin jugada grabada</span>
            )}
            {players > 0 && (
              <span className="flex items-center gap-1">
                <Users aria-hidden="true" className="h-3 w-3" />
                {players}
                {rivals > 0 ? ` vs ${rivals}` : ""}
              </span>
            )}
            {board.updated_at && (
              <span className="flex items-center gap-1">
                <Clock aria-hidden="true" className="h-3 w-3" />
                {updatedLabel(board.updated_at)}
              </span>
            )}
          </span>
        </span>
      </button>
      {canDuplicate && (
        <button
          type="button"
          disabled={busy}
          onClick={onDuplicate}
          aria-label={`Duplicar ${board.name}`}
          title="Duplicar"
          className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          <Copy aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          aria-label={`Borrar ${board.name}`}
          title="Borrar"
          className="absolute bottom-1.5 right-1.5 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

export default function BoardsPage({ user, onAccessLost }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [teams, setTeams] = useState(null);
  const [data, setData] = useState(null);
  const [rosterById, setRosterById] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401) {
      onAccessLost();
      return;
    }
    setError(requestError.message);
  }, [onAccessLost]);

  useEffect(() => {
    listTeams().then(setTeams).catch(handleError);
  }, [handleError]);

  const requested = searchParams.get("equipo") ?? user.team_id;
  const teamId = teams?.some((team) => team.id === requested) ? requested : teams?.[0]?.id ?? null;
  const team = teams?.find((item) => item.id === teamId);

  useEffect(() => {
    if (!teamId) return undefined;
    let cancelled = false;
    setData(null);
    setError("");
    listBoards(teamId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((requestError) => {
        if (!cancelled) handleError(requestError);
      });
    loadClubPlayers()
      .then(({ players }) => {
        if (!cancelled) setRosterById(Object.fromEntries(players.map((player) => [player.id, player])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [teamId, handleError]);

  const create = async (content) => {
    setBusy(true);
    setError("");
    try {
      const board = await createBoard(content);
      navigate(`/app/plantillas/pizarra/${board.id}`);
    } catch (requestError) {
      handleError(requestError);
      setBusy(false);
    }
  };

  // Papelera de la lista: después de confirmar, se borra y desaparece sin recargar.
  const remove = async (board) => {
    setDeleting(null);
    setBusy(true);
    setError("");
    try {
      await deleteBoard(board.id);
      setData((current) => current && { ...current, boards: current.boards.filter((item) => item.id !== board.id) });
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = (board) =>
    create({ team_id: board.team_id, name: `${board.name} (copia)`.slice(0, 60), kind: board.kind, court: board.court, published: false, steps: board.steps, recording: board.recording });

  return (
    <div className="space-y-6">
      <RankingHero stacked title="Pizarra" subtitle={team?.name}>
        {data?.can_create && (
          <button type="button" disabled={busy} onClick={() => create(emptyBoard(teamId))} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-extrabold text-void hover:bg-zinc-200 disabled:opacity-60">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Nueva
          </button>
        )}
      </RankingHero>

      {teams && <GroupPicker groups={teams} groupId={teamId} onChange={(id) => setSearchParams({ equipo: id }, { replace: true })} />}

      <RosterTabs active="pizarra" teamId={teamId} />

      {error && <p role="alert" className="rounded-2xl border border-red-300/50 bg-panel p-3 text-sm font-semibold text-red-200">{error}</p>}
      {!error && !data && <p role="status" className="text-zinc-300">Cargando…</p>}

      {data?.boards.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-panel px-4 py-8 text-center">
          <p className="font-display text-xl font-extrabold">{data.can_edit ? "Todavía no hay jugadas" : "Aún no hay jugadas"}</p>
          <p className="max-w-xs text-sm text-zinc-400">
            {data.can_edit
              ? "Coloca a tus jugadores, dibuja la jugada o créala paso a paso, y publícala para que la vea el equipo."
              : "Cuando el entrenador publique una jugada, aparecerá aquí. Mientras, puedes hacerte las tuyas: solo las ves tú."}
          </p>
          {data.can_create && (
            <button type="button" disabled={busy} onClick={() => create(emptyBoard(teamId))} className="flex min-h-11 items-center gap-1.5 rounded-full bg-tnt px-4 text-sm font-extrabold text-onbrand disabled:opacity-60">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Crear la primera jugada
            </button>
          )}
        </div>
      )}

      {data?.boards.length > 0 &&
        // Las del equipo primero y, si las hay, las tuyas propias aparte.
        [
          ["team", "Del equipo", data.boards.filter((board) => !board.private)],
          ["mine", "Mis jugadas", data.boards.filter((board) => board.private)],
        ]
          .filter(([, , list]) => list.length > 0)
          .map(([key, title, list], _index, groups) => (
            <section key={key} aria-label={title} className="space-y-2">
              {groups.length > 1 && (
                <h2 className="flex items-center gap-2 px-1 font-display text-sm font-extrabold text-zinc-300">
                  {key === "mine" && <Lock aria-hidden="true" className="h-3.5 w-3.5 text-sky-300" />}
                  {title}
                  {key === "mine" && <span className="font-body text-xs font-semibold normal-case not-italic tracking-normal text-zinc-500">· solo las ves tú</span>}
                </h2>
              )}
              <ul className="stagger-in grid gap-2.5 sm:grid-cols-2">
                {list.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    rosterById={rosterById}
                    beach={teamId === "playa"}
                    canEdit={data.can_edit}
                    canDuplicate={data.can_create}
                    busy={busy}
                    onOpen={() => navigate(`/app/plantillas/pizarra/${board.id}`)}
                    onDuplicate={() => duplicate(board)}
                    onDelete={board.can_edit ? () => setDeleting(board) : undefined}
                  />
                ))}
              </ul>
            </section>
          ))}
      {deleting && (
        <ConfirmDialog
          message={`¿Seguro que quieres borrar «${deleting.name}»? No se puede recuperar.`}
          confirmLabel="Borrar"
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
