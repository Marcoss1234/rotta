import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Award, Crown, Mail, Medal, Pencil, Phone, Trophy, X } from "lucide-react";
import { getPlayerProfile } from "@/app/api.js";
import { MovementPill, OverallNumber, PositionTag } from "@/app/components/RankingVisuals.jsx";
import { lookFromSeed, normalizeLook } from "@/app/character/looks.js";
import { weekLabel } from "@/app/ranking.js";
import { Badge, Button, cx, Notice } from "@/app/ui/index.js";

const AvatarStage = lazy(() => import("@/app/character/AvatarStage.jsx"));

// El personaje de alguien del club: el que se ha hecho, o uno por defecto si aún no lo ha creado.
export const lookOf = (player) => normalizeLook(player.character) ?? lookFromSeed(player.id, player.team_id === "femenino");

const TITLE_ICONS = { week: Medal, month: Crown, mvp: Trophy };
// Los títulos van en tonos de oro (premios): las familias de Tailwind siguen al modo claro u oscuro.
const TITLE_TONES = {
  week: "bg-amber-300/10 text-amber-200 ring-amber-300/30",
  month: "bg-orange-400/10 text-orange-200 ring-orange-300/40",
  mvp: "bg-yellow-300/10 text-yellow-200 ring-yellow-300/40",
};

const hasNumber = (player) => player.number !== null && player.number !== undefined;

function SectionLabel({ icon: Icon, children }) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
      {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
      {children}
    </h3>
  );
}

/**
 * La ficha de un jugador que ve todo el club: su personaje en 3D, sus títulos y cómo va en el ranking.
 * Entrenadores y administradores: `onEdit` abre el formulario y `onDelete` lo quita de la plantilla (si falla,
 * el aviso sale aquí). Quien tiene cuenta se quita desde Usuarios. El contacto solo llega del servidor a ellos.
 */
export default function PlayerProfileDialog({ player, onClose, onEdit = null, onDelete = null, onError = () => {} }) {
  const dialogRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  // Lo que llega de la lista (con el contacto, si eres del cuerpo técnico) y encima la ficha del servidor.
  const shown = { ...player, ...(profile?.player ?? {}) };
  const counts = profile?.counts;
  const ranking = profile?.ranking;
  const firstName = shown.name.split(" ")[0];
  const staff = Boolean(onEdit || onDelete);

  const confirmDelete = async () => {
    setBusy(true);
    setDeleteError("");
    try {
      await onDelete();
    } catch (error) {
      setDeleteError(error.message);
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="player-profile-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="!m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-card bg-card p-0 font-body text-ink shadow-card ring-1 ring-line backdrop:bg-canvas/75 backdrop:backdrop-blur-sm"
    >
      {/* El personaje, con su nombre, dorsal y corona si la lleva. */}
      <div className="relative h-72 bg-raised">
        <Suspense fallback={<p role="status" className="flex h-full items-center justify-center text-sm text-ink-muted">Cargando su personaje…</p>}>
          <AvatarStage look={lookOf(shown)} name={firstName} number={shown.number} position={shown.position} heightCm={shown.height_cm} crown={shown.crown} />
        </Suspense>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Cerrar"
          title="Cerrar"
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-card/85 text-ink shadow-card ring-1 ring-line backdrop-blur hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text disabled:opacity-50"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        {/* Quién es: nombre, puesto y dorsal grande y neutro (con la rayita del club). */}
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 id="player-profile-title" className="break-words font-display text-2xl font-extrabold leading-tight">{shown.name}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-1.5">
              <PositionTag position={shown.position} />
              {!shown.linked && <Badge>Sin cuenta en la app</Badge>}
            </p>
          </div>
          {hasNumber(shown) && (
            <p className="flex shrink-0 flex-col items-center gap-1">
              <span className="font-display text-5xl font-extrabold leading-none tabular-nums">
                <span className="sr-only">Dorsal </span>{shown.number}
              </span>
              <span aria-hidden="true" className="h-1 w-6 rounded-full bg-club" />
            </p>
          )}
        </div>

        {(shown.phone || shown.email) && (
          <section aria-label="Contacto" className="space-y-1">
            <SectionLabel>Contacto · solo lo ven entrenadores y administradores</SectionLabel>
            <ul className="space-y-1 text-sm">
              {shown.phone && (
                <li>
                  <a href={`tel:${shown.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-10 items-center gap-2 font-semibold text-ink underline-offset-2 hover:underline">
                    <Phone aria-hidden="true" className="h-4 w-4 text-ink-muted" />{shown.phone}
                  </a>
                </li>
              )}
              {shown.email && (
                <li>
                  <a href={`mailto:${shown.email}`} className="inline-flex min-h-10 max-w-full items-center gap-2 break-all font-semibold text-ink underline-offset-2 hover:underline">
                    <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted" />{shown.email}
                  </a>
                </li>
              )}
            </ul>
          </section>
        )}

        {!profile ? (
          <p role="status" className="text-sm text-ink-muted">Cargando su ficha…</p>
        ) : (
          <>
            {/* Ranking: el puesto ahora mismo y su nota. */}
            {ranking ? (
              <section aria-label="Ranking" className="rounded-card bg-raised p-4">
                <SectionLabel>Ranking · {ranking.group_name}</SectionLabel>
                <div className="mt-2 flex items-end gap-3">
                  <span className="font-display text-4xl font-extrabold leading-none">
                    {ranking.rank}º<span className="ml-1 text-base font-bold text-ink-muted">de {ranking.of}</span>
                  </span>
                  <span className="ml-auto text-right">
                    <OverallNumber overall={ranking.overall} className="text-3xl" />
                    <span className="block text-xs text-ink-muted">nota de la semana</span>
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-xs text-ink-muted">
                  <MovementPill value={ranking.movement} hasPrevious />
                  {ranking.week && <span className="ml-auto">{weekLabel(ranking.week)}</span>}
                </div>
              </section>
            ) : (
              <p className="rounded-card bg-raised p-4 text-sm text-ink-muted">Todavía no sale en el ranking.</p>
            )}

            {/* Lo que ha ganado, de un vistazo. */}
            <section aria-label="Palmarés" className="space-y-2">
              <SectionLabel icon={Trophy}>Palmarés</SectionLabel>
              <dl className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  ["Semana", counts.week_wins, "mejor"],
                  ["Podios", counts.week_podiums, "semana"],
                  ["Mes", counts.month_wins, "mejor"],
                  ["MVP", counts.mvp, "partidos"],
                ].map(([label, value, hint]) => (
                  <div key={label} className="flex flex-col-reverse rounded-card bg-raised px-1 py-2.5">
                    <dt className="mt-1 text-xs font-bold leading-tight text-ink">
                      {label}
                      <span className="block font-normal text-ink-muted">{hint}</span>
                    </dt>
                    <dd className={cx("font-display text-2xl font-extrabold leading-none tabular-nums", value > 0 ? "text-gold-text" : "text-ink-muted")}>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Sus títulos, del más reciente al más antiguo. */}
            <section aria-label="Títulos" className="space-y-2">
              <SectionLabel icon={Award}>Títulos</SectionLabel>
              {profile.titles.length === 0 ? (
                <p className="text-sm text-ink-muted">Aún no tiene títulos. ¡A por el primero!</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {profile.titles.slice(0, 12).map((title, index) => {
                    const Icon = TITLE_ICONS[title.kind] ?? Award;
                    return (
                      <li key={`${title.kind}-${title.period}-${index}`} className={cx("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", TITLE_TONES[title.kind] ?? "bg-raised text-ink ring-line")}>
                        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        {title.title}
                        {title.kind === "week" && <span className="opacity-80">· {weekLabel(title.period)}</span>}
                        {title.current && <span className="rounded-full bg-club px-1.5 font-extrabold text-on-club">Ahora</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {staff && (
          <div className="space-y-3 border-t border-line pt-4" data-testid="profile-staff-actions">
            {confirmingDelete ? (
              <div className="space-y-2">
                <p className="text-sm text-ink">¿Quitar a {firstName} de la plantilla? No se puede deshacer.</p>
                {deleteError && <Notice tone="error">{deleteError}</Notice>}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => setConfirmingDelete(false)}>Cancelar</Button>
                  <Button variant="danger" busy={busy} busyLabel="Quitando…" onClick={confirmDelete}>Sí, quitar</Button>
                </div>
              </div>
            ) : (
              <>
                {onEdit && <Button variant="secondary" icon={Pencil} block onClick={onEdit}>Editar datos</Button>}
                {onDelete && shown.linked && (
                  <Notice tone="info" announce={false} size="sm">Tiene cuenta en la app: para sacarlo de la plantilla, quítale el equipo o el acceso desde Usuarios.</Notice>
                )}
                {onDelete && !shown.linked && (
                  <Button variant="danger-quiet" size="sm" block onClick={() => setConfirmingDelete(true)}>Quitar de la plantilla</Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
