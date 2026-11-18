import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Coins, Crown, ShoppingBag } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getProfile, getRankingHonors, listRankingGroups } from "@/app/api.js";
import { lookFromSeed, normalizeLook } from "@/app/character/looks.js";
import Avatar from "@/app/components/Avatar.jsx";
import HonorsBanner from "@/app/components/HonorsBanner.jsx";
import { RankingHero } from "@/app/components/RankingVisuals.jsx";

const AvatarStage = lazy(() => import("@/app/character/AvatarStage.jsx"));

function canDraw3D() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

// Las cuatro coronas que se pueden llevar, en el orden en que se ven en el escaparate.
const CROWNS = [
  { id: "month", label: "Del mes", chip: "ring-amber-300 bg-amber-300 text-void", icon: "fill-amber-300 text-amber-500" },
  { id: "gold", label: "Oro", chip: "ring-amber-300 bg-amber-400/20 text-amber-200", icon: "fill-amber-300 text-amber-300" },
  { id: "silver", label: "Plata", chip: "ring-zinc-300 bg-zinc-300/20 text-zinc-100", icon: "fill-zinc-300 text-zinc-300" },
  { id: "bronze", label: "Bronce", chip: "ring-orange-400 bg-orange-400/20 text-orange-200", icon: "fill-orange-400 text-orange-400" },
];

const PLACE_STYLES = {
  1: { label: "1º", ring: "ring-amber-300", text: "text-amber-300", crown: "fill-amber-300 text-amber-300" },
  2: { label: "2º", ring: "ring-zinc-300", text: "text-zinc-200", crown: "fill-zinc-300 text-zinc-300" },
  3: { label: "3º", ring: "ring-orange-400", text: "text-orange-300", crown: "fill-orange-400 text-orange-400" },
};

// Qué hay que hacer para llevar cada corona y lo que se gana con ella.
function crownStory(crown, prizes, monthTitle) {
  if (!prizes) return null;
  if (crown === "month") {
    return { title: monthTitle ?? "Jugador del mes", how: "La mejor media de todas las semanas del mes.", coins: prizes.month[0]?.coins, lasts: "La llevas todo el mes siguiente." };
  }
  const place = { gold: 1, silver: 2, bronze: 3 }[crown];
  return {
    title: `${place}º de la semana`,
    how: `${place === 1 ? "La mejor nota" : place === 2 ? "La segunda mejor nota" : "La tercera mejor nota"} de la semana publicada.`,
    coins: prizes.week.find((prize) => prize.place === place)?.coins,
    lasts: "La llevas hasta que se publique la semana siguiente.",
  };
}

function PrizeColumn({ title, when, prizes, firstTitle }) {
  return (
    <div className="rounded-3xl bg-panel p-4 ring-1 ring-white/10">
      <h2 className="font-display text-xl font-extrabold leading-tight">{title}</h2>
      <p className="text-xs text-zinc-400">{when}</p>
      <ol className="mt-3 space-y-2.5">
        {prizes.map(({ place, coins }) => {
          const style = PLACE_STYLES[place] ?? PLACE_STYLES[3];
          return (
            <li key={place} className="flex items-center gap-2.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-void ring-2 ${style.ring}`}>
                <Crown aria-hidden="true" className={`h-4 w-4 ${style.crown}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-display text-base font-extrabold leading-none ${style.text}`}>{style.label} puesto</span>
                {place === 1 && firstTitle && <span className="block text-[11px] font-semibold text-zinc-400">y el título de {firstTitle.toLowerCase()}</span>}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-sm font-extrabold tabular-nums text-amber-200">
                <Coins aria-hidden="true" className="h-3.5 w-3.5" />+{coins}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Las coronas puestas en tu propio personaje: así se ve lo que te llevas antes de ganarlo.
function CrownShowcase({ profile, prizes, monthTitle }) {
  const [crown, setCrown] = useState("month");
  const with3D = useMemo(canDraw3D, []);
  const look = useMemo(
    () => normalizeLook(profile.character) ?? lookFromSeed(profile.player?.id ?? profile.user.id, profile.user.team_id === "femenino"),
    [profile],
  );
  const story = crownStory(crown, prizes, monthTitle);
  const chosen = CROWNS.find((item) => item.id === crown);

  return (
    <section aria-labelledby="showcase-title" className="overflow-hidden rounded-3xl bg-gradient-to-b from-amber-950 via-surface to-void ring-1 ring-amber-300/25">
      <h2 id="showcase-title" className="sr-only">Pruébate las coronas</h2>
      <div className="relative h-[19rem] md:h-[24rem]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-6 mx-auto h-56 w-56 rounded-full bg-amber-400/25 blur-3xl" />
        {with3D ? (
          <Suspense fallback={<p role="status" className="flex h-full items-center justify-center text-sm text-zinc-400">Cargando tu personaje…</p>}>
            <AvatarStage
              look={look}
              name={profile.user.name.split(" ")[0]}
              number={profile.player?.number}
              position={profile.player?.position}
              heightCm={profile.height_cm ?? null}
              crown={crown}
              focus="cara"
            />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="relative">
              <Avatar name={profile.user.name} picture={profile.user.picture} className="h-36 w-36 text-5xl ring-4 ring-amber-300/60" />
              <Crown aria-hidden="true" className={`absolute -top-9 left-1/2 h-14 w-14 -translate-x-1/2 ${chosen.icon}`} />
            </span>
          </div>
        )}
        <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-extrabold text-amber-200">Pruébatela</p>
      </div>

      <div className="space-y-3 p-4 pt-0">
        <div role="radiogroup" aria-label="Corona" className="grid grid-cols-4 gap-1.5">
          {CROWNS.map((item) => {
            const active = item.id === crown;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCrown(item.id)}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-xs font-extrabold ring-2 transition ${active ? item.chip : "bg-white/5 text-zinc-300 ring-transparent hover:bg-white/10"}`}
              >
                <Crown aria-hidden="true" className={`h-4 w-4 ${item.icon}`} />
                {item.label}
              </button>
            );
          })}
        </div>
        {story && (
          <div className="flex items-start justify-between gap-3 rounded-xl bg-black/30 p-3">
            <div className="min-w-0">
              <p className="font-display text-xl font-extrabold leading-tight text-white">{story.title}</p>
              <p className="text-sm text-zinc-300">{story.how}</p>
              <p className="text-xs text-zinc-400">{story.lasts}</p>
            </div>
            {story.coins != null && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-base font-extrabold tabular-nums text-void">
                <Coins aria-hidden="true" className="h-4 w-4" />+{story.coins}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function RewardsPage({ user, onAccessLost }) {
  const [searchParams] = useSearchParams();
  const [groups, setGroups] = useState(null);
  const [honors, setHonors] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401 || requestError.status === 403) onAccessLost();
    else setError(requestError.message);
  }, [onAccessLost]);

  useEffect(() => {
    listRankingGroups().then(setGroups).catch(handleError);
    // Sin personaje se ve igual todo lo demás.
    getProfile().then(setProfile).catch(() => {});
  }, [handleError]);

  const requested = searchParams.get("grupo");
  const ownGroup = user.team_id?.startsWith("escuela") ? "escuela" : user.team_id;
  const group = groups?.find(({ id }) => id === requested) ?? groups?.find(({ id }) => id === ownGroup) ?? groups?.[0];
  const groupId = group?.id ?? null;

  useEffect(() => {
    if (!groupId) return;
    getRankingHonors(groupId).then(setHonors).catch(handleError);
  }, [groupId, handleError]);

  const prizes = honors?.prizes;
  const holders = honors && (honors.week.length > 0 || honors.month.length > 0);

  return (
    <div className="space-y-6">
      <Link to={groupId ? `/app/ranking?grupo=${groupId}` : "/app/ranking"} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-zinc-300 hover:text-white">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Volver al ranking
      </Link>

      <RankingHero title="Premios" subtitle="Lo que te llevas por quedar en el podio" />

      {error && <p role="alert" className="rounded-2xl border border-red-300/50 bg-panel p-3 text-sm font-semibold text-red-200">{error}</p>}

      {profile && <CrownShowcase profile={profile} prizes={prizes} monthTitle={honors?.month_title} />}

      {!prizes && !error && <p role="status" className="text-zinc-300">Cargando…</p>}
      {prizes && (
        <div className="grid gap-3 sm:grid-cols-2">
          <PrizeColumn title="Cada semana" when="Por la nota de la semana, cuando el entrenador la publica." prizes={prizes.week} />
          <PrizeColumn title="Cada mes" when="Al empezar el mes, a las mejores medias del mes anterior." prizes={prizes.month} firstTitle={honors.month_title} />
        </div>
      )}

      {prizes && (
        <ul className="space-y-1.5 rounded-3xl bg-panel p-4 text-sm text-zinc-300 ring-1 ring-white/5">
          <li>· Si hay empate, se comparte el puesto y el premio.</li>
          <li>· La corona se ve en tu personaje y en la pizarra mientras la tengas.</li>
          <li>· El podio de premios va por la nota de esa semana; la tabla del ranking es la media de las últimas 4.</li>
        </ul>
      )}

      {holders && (
        <section aria-labelledby="holders-title" className="space-y-2">
          <h2 id="holders-title" className="font-display text-2xl font-extrabold">Ahora llevan corona</h2>
          <HonorsBanner honors={honors} />
        </section>
      )}

      <Link to="/app/tienda" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 font-extrabold text-void hover:bg-amber-300">
        <ShoppingBag aria-hidden="true" className="h-5 w-5" />
        Gástalos en la tienda
      </Link>
    </div>
  );
}
