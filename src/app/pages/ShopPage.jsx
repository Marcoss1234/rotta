import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Coins, Crown, Flame, Glasses, Lock, Orbit, Shirt, ShoppingBag, Snowflake, Sparkles, Star, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { buyShopItem, getProfile, getShop, saveCharacter } from "@/app/api.js";
import { lookFromSeed, normalizeLook } from "@/app/character/looks.js";
import CoinBurst from "@/app/components/CoinBurst.jsx";
import { Notice } from "@/app/ui/index.js";

const AvatarStage = lazy(() => import("@/app/character/AvatarStage.jsx"));
// Los efectos se enseñan con tu personaje haciendo el gesto en la pista 3D, como en la pizarra.
const ShopActionStage = lazy(() => import("@/app/components/ShopActionStage.jsx"));

// `focus` es el encuadre del editor del personaje: la cabeza para el pelo y las gafas, el cuerpo para lo demás.
const CATEGORIES = [
  { id: "camisetas", label: "Camisetas", focus: "pecho" },
  { id: "efectos", label: "Efectos en pista", focus: null },
  { id: "pelo", label: "Pelo", focus: "pelo" },
  { id: "equipacion", label: "Cinta y muñequeras", focus: "equipo" },
  { id: "zapatillas", label: "Zapatillas", focus: "equipo" },
  { id: "gafas", label: "Gafas", focus: "cara" },
];

function canDraw3D() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

// Cómo queda el personaje con ese objeto puesto.
function wearing(look, item) {
  const [kind, value] = item.id.split(":");
  if (kind === "hair") return { ...look, hair_color: value };
  if (kind === "accent") return { ...look, headband: value, wristbands: value };
  if (kind === "shoes") return { ...look, shoes: value };
  if (kind === "glasses") return { ...look, glasses: value };
  if (kind === "shirt") return { ...look, shirt: value };
  if (["remate", "recepcion", "colocacion"].includes(kind)) return { ...look, [`fx_${kind}`]: value };
  return look;
}

function isWorn(look, item) {
  const [kind, value] = item.id.split(":");
  if (kind === "hair") return look.hair_color === value || look.hair_color2 === value;
  if (kind === "accent") return look.headband === value || look.wristbands === value;
  if (kind === "shoes") return look.shoes === value;
  if (kind === "glasses") return look.glasses === value;
  if (kind === "shirt") return look.shirt === value;
  if (["remate", "recepcion", "colocacion"].includes(kind)) return look[`fx_${kind}`] === value;
  return false;
}

// Fondo de cada camiseta en la tarjeta de la tienda.
const SHIRT_LOOKS = {
  "shirt:rayo": "radial-gradient(circle at 30% 30%, #67e8f9, transparent 55%), linear-gradient(135deg, #0f172a, #1e3a8a)",
  "shirt:fuego": "linear-gradient(0deg, #facc15, #f97316 35%, #b91c1c 70%, #450a0a)",
  "shirt:bomba": "radial-gradient(circle at 50% 45%, #fff7ae, #ff8a00 30%, #ff3800 55%, #0b0b0f 75%)",
  "shirt:oro": "linear-gradient(135deg, #fff3b0, #e8b923 45%, #8a6512)",
  "shirt:telarana":
    "repeating-conic-gradient(from 0deg at 50% 45%, rgba(255,255,255,0.85) 0deg 2deg, transparent 2deg 30deg), repeating-radial-gradient(circle at 50% 45%, transparent 0 9px, rgba(255,255,255,0.8) 9px 10.5px), #0a0a0b",
  "shirt:cuervo": "repeating-conic-gradient(from 0deg at 50% 45%, rgba(255,107,0,0.6) 0deg 4deg, transparent 4deg 16deg), radial-gradient(circle at 50% 45%, #2a2a30 30%, #111113 70%)",
};

// Icono de cada efecto y del gesto en el que sale.
const FX_ICONS = { fuego: Flame, rayo: Zap, galaxia: Orbit, oro: Crown, hielo: Snowflake, estrellas: Star };
const FX_ACTION = { remate: "Remate", recepcion: "Recepción", colocacion: "Colocación" };

function ItemArt({ item }) {
  if (item.category === "efectos") {
    const [action, value] = item.id.split(":");
    const Icon = FX_ICONS[value] ?? Sparkles;
    return (
      <span
        className="fx-card relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl ring-2 ring-white/20"
        style={{ "--fx": item.hex, background: `radial-gradient(circle at 50% 45%, ${item.hex}cc, ${item.hex}33 45%, transparent 70%), #0b0b0f` }}
      >
        <span aria-hidden="true" className="fx-card-glow absolute inset-3 rounded-full" style={{ boxShadow: `0 0 26px 8px ${item.hex}` }} />
        <Icon aria-hidden="true" className="fx-card-icon relative h-10 w-10 text-white drop-shadow-[0_0_8px_var(--fx)]" strokeWidth={2.2} />
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-[9px] font-extrabold text-white/90">{FX_ACTION[action]}</span>
      </span>
    );
  }
  if (item.category === "camisetas") {
    return (
      <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.5)] ring-2 ring-white/20" style={{ background: SHIRT_LOOKS[item.id] }}>
        <Shirt aria-hidden="true" className="h-11 w-11 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
        <span className="absolute bottom-1 font-display text-[11px] font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">Club</span>
      </span>
    );
  }
  if (item.category === "gafas") {
    return (
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 text-white shadow-inner">
        <Glasses aria-hidden="true" className="h-8 w-8" />
      </span>
    );
  }
  return (
    <span
      className="block h-14 w-14 rounded-2xl shadow-[inset_0_-6px_12px_rgba(0,0,0,0.35),0_4px_14px_rgba(0,0,0,0.4)] ring-2 ring-white/20"
      style={{ background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55), transparent 45%), ${item.hex}` }}
    />
  );
}

export default function ShopPage({ onAccessLost }) {
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [profile, setProfile] = useState(null);
  const [look, setLook] = useState(null);
  const [category, setCategory] = useState("camisetas");
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [burst, setBurst] = useState(null);
  const with3D = useMemo(canDraw3D, []);

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401) onAccessLost();
    else setError(requestError.message);
  }, [onAccessLost]);

  useEffect(() => {
    Promise.all([getShop(), getProfile()])
      .then(([shopData, profileData]) => {
        setShop(shopData);
        setProfile(profileData);
        setLook(normalizeLook(profileData.character) ?? lookFromSeed(profileData.player?.id ?? profileData.user.id, profileData.user.team_id === "femenino"));
      })
      .catch(handleError);
  }, [handleError]);

  if (!shop || !look) {
    return <p role="status" className="text-zinc-300">{error || "Abriendo la tienda…"}</p>;
  }

  const items = shop.items.filter((item) => item.category === category);
  const selected = shop.items.find((item) => item.id === selectedId) ?? null;
  const preview = selected ? wearing(look, selected) : look;

  const buy = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await buyShopItem(selected.id);
      setShop((current) => ({ balance: result.balance, items: current.items.map((item) => (item.id === selected.id ? { ...item, owned: true } : item)) }));
      setBurst({ amount: -selected.price, status: "buy", key: Date.now() });
      setMessage(`¡${selected.name} ya es tuyo!`);
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const wear = async () => {
    setBusy(true);
    setError("");
    try {
      const next = wearing(look, selected);
      await saveCharacter(next);
      setLook(next);
      setMessage(`Ya llevas ${selected.name.toLowerCase()}.`);
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const missing = selected && !selected.owned ? Math.max(0, selected.price - shop.balance) : 0;

  return (
    <div className="space-y-6 pb-24">
      {/* Escaparate: tu personaje probándose lo que eliges. */}
      <section className="sticky top-0 z-20 overflow-hidden rounded-3xl bg-gradient-to-b from-amber-950 via-surface to-void ring-1 ring-amber-300/25 shadow-xl shadow-black/60">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-6 mx-auto h-48 w-48 rounded-full bg-amber-400/25 blur-3xl" />
        <div className="relative flex items-center justify-between gap-2 p-3">
          <button type="button" onClick={() => navigate(-1)} aria-label="Volver" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <ShoppingBag aria-hidden="true" className="h-6 w-6 text-amber-300" />
            Tienda
          </h1>
          <span className="relative flex items-center gap-1.5 rounded-full bg-black/40 py-1 pl-1 pr-3 text-sm font-extrabold ring-1 ring-amber-300/50">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-amber-950">
              <Coins className="h-4 w-4" />
            </span>
            <span className="tabular-nums">{shop.balance.toLocaleString("es-ES")}</span>
            {burst && <CoinBurst burst={burst} />}
          </span>
        </div>
        <div className="relative h-56 md:h-72">
          {with3D && selected?.category === "efectos" ? (
            <Suspense fallback={<p role="status" className="flex h-full items-center justify-center text-sm text-zinc-400">Preparando la pista…</p>}>
              <ShopActionStage key={selected.id.split(":")[0]} item={selected} look={preview} profile={profile} />
            </Suspense>
          ) : with3D ? (
            <Suspense fallback={<p role="status" className="flex h-full items-center justify-center text-sm text-zinc-400">Cargando tu personaje…</p>}>
              <AvatarStage look={preview} name={profile.user.name.split(" ")[0]} number={profile.player?.number} position={profile.player?.position} heightCm={profile.height_cm} focus={CATEGORIES.find((item) => item.id === category)?.focus} />
            </Suspense>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-zinc-400">Tu móvil no puede mostrar el personaje en 3D.</p>
          )}
          {selected && (
            <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-bold text-amber-200/90">
              Probándote: {selected.name}
            </p>
          )}
        </div>
      </section>

      <div role="tablist" aria-label="Qué quieres ver" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={category === item.id}
            onClick={() => setCategory(item.id)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-extrabold ${category === item.id ? "bg-amber-400 text-void" : "bg-white/5 text-zinc-300 hover:bg-white/10"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ul className="stagger-in grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {items.map((item) => {
          const chosen = selectedId === item.id;
          const worn = item.owned && isWorn(look, item);
          const affordable = shop.balance >= item.price;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={chosen}
                onClick={() => {
                  setSelectedId(chosen ? null : item.id);
                  setMessage("");
                  setError("");
                }}
                className={`relative flex h-full w-full flex-col items-center gap-2 rounded-2xl p-3 text-center transition ${
                  chosen ? "bg-amber-400/15 ring-2 ring-amber-300" : "bg-panel ring-1 ring-white/10 hover:ring-white/25"
                }`}
              >
                {worn && <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-snow">Puesto</span>}
                <ItemArt item={item} />
                <span className="text-sm font-bold leading-tight">{item.name}</span>
                {item.owned ? (
                  <span className="flex items-center gap-1 text-xs font-extrabold text-emerald-300">
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                    Tuyo
                  </span>
                ) : (
                  <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-extrabold tabular-nums ${affordable ? "bg-amber-400/15 text-amber-200" : "bg-white/5 text-zinc-400"}`}>
                    {!affordable && <Lock aria-hidden="true" className="h-3 w-3" />}
                    <Coins aria-hidden="true" className="h-3.5 w-3.5" />
                    {item.price.toLocaleString("es-ES")}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {(message || error) && (
        <Notice tone={error ? "error" : "success"}>{error || message}</Notice>
      )}

      {/* Lo que puedes hacer con lo elegido. */}
      {selected && (
        <div className="fixed inset-x-3 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 md:left-[calc(15rem+1.5rem)] md:right-6 md:bottom-6">
          <div className="mx-auto max-w-3xl">
            {!selected.owned ? (
              <button
                type="button"
                disabled={busy || missing > 0}
                onClick={buy}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 font-display text-lg font-extrabold text-void shadow-[0_10px_30px_rgba(245,158,11,0.45)] disabled:from-zinc-700 disabled:via-zinc-700 disabled:to-zinc-700 disabled:text-zinc-300 disabled:shadow-none"
              >
                {missing > 0 ? (
                  <>
                    <Lock aria-hidden="true" className="h-5 w-5" />
                    Te faltan {missing.toLocaleString("es-ES")} coins
                  </>
                ) : (
                  <>
                    <Coins aria-hidden="true" className="h-5 w-5" />
                    {busy ? "Comprando…" : `Comprar por ${selected.price.toLocaleString("es-ES")}`}
                  </>
                )}
              </button>
            ) : isWorn(look, selected) ? (
              <p className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 font-display text-lg font-extrabold text-emerald-200 ring-1 ring-emerald-400/40">
                <Check aria-hidden="true" className="h-5 w-5" />
                Lo llevas puesto
              </p>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={wear}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-tnt font-display text-lg font-extrabold text-onbrand shadow-[0_10px_30px_rgba(255,56,0,0.4)] disabled:opacity-60"
              >
                <Sparkles aria-hidden="true" className="h-5 w-5" />
                {busy ? "Poniéndotelo…" : "Ponérmelo"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
