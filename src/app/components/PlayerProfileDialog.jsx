import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Award, Crown, Medal, Trophy, X } from "lucide-react";
import { getPlayerProfile } from "@/app/api.js";
import { MovementPill, OverallNumber, PositionTag } from "@/app/components/RankingVisuals.jsx";
import { lookFromSeed, normalizeLook } from "@/app/character/looks.js";
import { weekLabel } from "@/app/ranking.js";

const AvatarStage = lazy(() => import("@/app/character/AvatarStage.jsx"));

// El personaje de alguien del club: el que se ha hecho, o uno por defecto si aún no lo ha creado.
export const lookOf = (player) => normalizeLook(player.character) ?? lookFromSeed(player.id, player.team_id === "femenino");

const TITLE_ICONS = { week: Medal, month: Crown, mvp: Trophy };
const TITLE_TONES = {
  week: "bg-amber-300/10 text-amber-100 ring-amber-300/30",
  month: "bg-orange-400/15 text-orange-100 ring-orange-300/40",
  mvp: "bg-yellow-300/15 text-yellow-100 ring-yellow-300/40",
};

// La ficha de un jugador que ve todo el club: su personaje en 3D, sus títulos y cómo va en el ranking.
// Los entrenadores pueden quitarlo de la plantilla desde aquí (`onDelete`).
export default function PlayerProfileDialog({ player, onClose, onDelete = null, onError = () => {} }) {
  const dialogRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPlayerProfile(player.id)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((error) => {
        if (!cancelled) onError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [player.id, onError]);

  const shown = profile?.player ?? player;
  const counts = profile?.counts;
  const ranking = profile?.ranking;
  const firstName = shown.name.split(" ")[0];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="player-profile-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-surface p-0 font-body text-white backdrop:bg-black/80"
    >
      {/* El personaje, con su nombre, dorsal y corona si la lleva. */}
      <div className="relative h-72 bg-gradient-to-b from-tnt/25 via-panel to-surface">
        <Suspense fallback={<p role="status" className="flex h-full items-center justify-center text-sm text-zinc-400">Cargando su personaje…</p>}>
          <AvatarStage look={lookOf(shown)} name={firstName} number={shown.number} position={shown.position} heightCm={shown.height_cm} crown={shown.crown} />
        </Suspense>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60">
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <h2 id="player-profile-title" className="break-words font-display text-2xl font-extrabold leading-tight">{shown.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            <PositionTag position={shown.position} />
            {shown.number !== null && shown.number !== undefined && <span className="font-display font-extrabold text-tnt">#{shown.number}</span>}
            {!shown.linked && <span className="text-xs text-zinc-500">Sin cuenta en la app</span>}
          </p>
        </div>

        {!profile ? (
          <p role="status" className="text-sm text-zinc-400">Cargando su ficha…</p>
        ) : (
          <>
            {/* Ranking: el puesto ahora mismo y su nota. */}
            {ranking ? (
              <section aria-label="Ranking" className="rounded-2xl bg-panel p-3 ring-1 ring-white/10">
                <p className="text-[11px] font-bold text-zinc-400">Ranking · {ranking.group_name}</p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="font-display text-4xl font-extrabold leading-none">
                    {ranking.rank}º<span className="ml-1 text-base text-zinc-500">de {ranking.of}</span>
                  </span>
                  <span className="ml-auto text-right">
                    <OverallNumber overall={ranking.overall} className="text-3xl" />
                    <span className="block text-[11px] text-zinc-400">media</span>
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
                  <MovementPill value={ranking.movement} hasPrevious />
                  {ranking.week_overall !== null && ranking.week_overall !== undefined && <span>Esta semana: {Math.round(ranking.week_overall)}</span>}
                  {ranking.week && <span className="ml-auto text-zinc-500">{weekLabel(ranking.week)}</span>}
                </div>
              </section>
            ) : (
              <p className="rounded-2xl bg-panel p-3 text-sm text-zinc-400 ring-1 ring-white/10">Todavía no sale en el ranking.</p>
            )}

            {/* Lo que ha ganado, de un vistazo. */}
            <section aria-label="Palmarés" className="grid grid-cols-4 gap-1.5 text-center">
              {[
                ["Semana", counts.week_wins, "mejor"],
                ["Podios", counts.week_podiums, "semana"],
                ["Mes", counts.month_wins, "mejor"],
                ["MVP", counts.mvp, "partidos"],
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded-xl bg-panel px-1 py-2 ring-1 ring-white/10">
                  <span className="block font-display text-2xl font-extrabold leading-none text-amber-200">{value}</span>
                  <span className="mt-1 block text-[11px] font-bold leading-tight">{label}</span>
                  <span className="block text-[10px] text-zinc-500">{hint}</span>
                </div>
              ))}
            </section>

            {/* Sus títulos, del más reciente al más antiguo. */}
            <section aria-label="Títulos" className="space-y-1.5">
              <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
                <Award aria-hidden="true" className="h-3.5 w-3.5" />
                Títulos
              </h3>
              {profile.titles.length === 0 ? (
                <p className="text-sm text-zinc-400">Aún no tiene títulos. ¡A por el primero!</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {profile.titles.slice(0, 12).map((title, index) => {
                    const Icon = TITLE_ICONS[title.kind] ?? Award;
                    return (
                      <li key={`${title.kind}-${title.period}-${index}`} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${TITLE_TONES[title.kind] ?? "bg-white/5 text-zinc-200 ring-white/10"}`}>
                        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        {title.title}
                        {title.kind === "week" && <span className="text-[10px] opacity-70">· {weekLabel(title.period)}</span>}
                        {title.current && <span className="rounded-full bg-white/15 px-1.5 text-[10px] font-extrabold">Ahora</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {onDelete && (
          <div className="border-t border-white/10 pt-3">
            {confirmingDelete ? (
              <div className="space-y-2">
                <p className="text-sm text-zinc-300">¿Quitar a {firstName} de la plantilla? No se puede deshacer.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={() => setConfirmingDelete(false)} className="min-h-11 rounded-full border border-white/30 text-sm font-semibold hover:bg-white/5">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await onDelete();
                      setBusy(false);
                    }}
                    className="min-h-11 rounded-full border border-red-300 text-sm font-bold text-red-200 hover:bg-red-300/10 disabled:opacity-50"
                  >
                    Sí, quitar
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmingDelete(true)} className="text-xs font-semibold text-red-300 underline-offset-2 hover:underline">
                Quitar de la plantilla
              </button>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
