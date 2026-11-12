import { createContext, useContext, useState } from "react";
import { Check, Lock, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import {
  ACCENTS,
  BEARDS,
  BUILDS,
  CELEBRATIONS,
  EYES,
  FX_COLOCACION,
  FX_RECEPCION,
  FX_REMATE,
  GLASSES,
  HAIR_COLORS,
  HAIR_COLORS_2,
  HAIR_SPLITS,
  HAIR_STYLES,
  KNEEPADS,
  MOUTHS,
  SHIRTS,
  SHOES,
  SKINS,
} from "@/app/character/looks.js";

const TABS = [
  { id: "cuerpo", label: "Cuerpo" },
  { id: "pelo", label: "Pelo" },
  { id: "cara", label: "Cara" },
  { id: "equipo", label: "Equipación" },
  { id: "celebracion", label: "Celebración" },
];

// Lo de la tienda: qué tienes comprado y qué hacer al tocar algo que aún no tienes.
const ShopContext = createContext({ owned: new Set(), onLocked: () => {} });
const isLocked = (option, owned) => Boolean(option.shop) && !owned.has(option.shop);

function Group({ title, children }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">{title}</legend>
      {children}
    </fieldset>
  );
}

function Chips({ options, value, onChange }) {
  const { owned, onLocked } = useContext(ShopContext);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const locked = isLocked(option, owned);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => (locked ? onLocked(option) : onChange(option.id))}
            className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
              value === option.id ? "border-tnt bg-tnt text-onbrand" : locked ? "border-amber-300/30 text-zinc-400" : "border-white/15 text-zinc-200 hover:bg-white/5"
            }`}
          >
            {locked && <Lock aria-label="De la tienda" className="h-3.5 w-3.5 text-amber-300" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Colores en círculo; "Sin" sale tachado.
function Swatches({ options, value, onChange, label }) {
  const { owned, onLocked } = useContext(ShopContext);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value === option.id;
        const locked = isLocked(option, owned);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            aria-label={`${label}: ${option.label ?? option.id}${locked ? " (de la tienda)" : ""}`}
            title={option.label}
            onClick={() => (locked ? onLocked(option) : onChange(option.id))}
            className={`relative flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 ring-offset-panel transition ${selected ? "ring-2 ring-white" : "ring-1 ring-white/20 hover:ring-white/50"}`}
            style={{ background: option.hex ?? "transparent" }}
          >
            {!option.hex && <span aria-hidden="true" className="h-0.5 w-7 rotate-45 rounded bg-zinc-400" />}
            {locked && (
              <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45">
                <Lock className="h-4 w-4 text-amber-300" />
              </span>
            )}
            {selected && option.hex && (
              <Check aria-hidden="true" className={`h-5 w-5 ${["#f4f4f5", "#facc15", "#e7dcc0", "#f2d2bb", "#d9d2cb", "#e0b28c"].includes(option.hex) ? "text-zinc-900" : "text-white"}`} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Barra de 0 a 100 con lo que significa cada extremo.
function Slider({ label, value, onChange, low, high }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value ?? 50}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full cursor-pointer accent-tnt"
      />
      <span aria-hidden="true" className="flex justify-between text-xs font-semibold text-zinc-400">
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </label>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold ${value ? "border-tnt bg-tnt text-onbrand" : "border-white/15 text-zinc-200 hover:bg-white/5"}`}
    >
      {label}
    </button>
  );
}

export default function CharacterEditor({ look, onChange, onTabChange, owned = [] }) {
  const [tab, setTabState] = useState("cuerpo");
  const [lockedPick, setLockedPick] = useState(null);
  const shop = { owned: new Set(owned), onLocked: setLockedPick };
  // Quien lo usa se entera de la pestaña para encuadrar al personaje.
  const setTab = (id) => {
    setTabState(id);
    onTabChange?.(id);
  };
  const set = (field) => (value) => onChange({ ...look, [field]: value });
  const skinOptions = SKINS.map((skin, index) => ({ ...skin, label: `Tono ${index + 1}` }));

  return (
    <ShopContext.Provider value={shop}>
    <div className="space-y-4">
      {lockedPick && (
        <div role="status" className="flex items-center gap-3 rounded-xl bg-amber-300/10 p-3 ring-1 ring-amber-300/30">
          <Lock aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-300" />
          <p className="min-w-0 flex-1 text-sm font-semibold text-amber-50">«{lockedPick.label}» es de la tienda: cómpralo con tus Club Coins.</p>
          <Link to="/app/tienda" className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-amber-400 px-3 text-xs font-black text-void">
            <ShoppingBag aria-hidden="true" className="h-4 w-4" />
            Tienda
          </Link>
        </div>
      )}
      <div role="tablist" aria-label="Qué cambiar" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-11 shrink-0 rounded-lg px-3.5 font-display text-sm font-black uppercase italic ${
              tab === item.id ? "bg-tnt text-onbrand" : "text-zinc-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="space-y-5">
        {tab === "cuerpo" && (
          <>
            <Group title="Complexión"><Chips options={BUILDS} value={look.build} onChange={set("build")} /></Group>
            <Group title="Peso"><Slider label="Peso" value={look.weight} onChange={set("weight")} low="Delgado" high="Grueso" /></Group>
            <Group title="Músculo"><Slider label="Músculo" value={look.muscle} onChange={set("muscle")} low="Poco" high="Mucho" /></Group>
            <p className="text-xs text-zinc-400">La estatura se pone más abajo, en «En la pista».</p>
            <Group title="Piel"><Swatches label="Piel" options={skinOptions} value={look.skin} onChange={set("skin")} /></Group>
          </>
        )}
        {tab === "pelo" && (
          <>
            <Group title="Peinado"><Chips options={HAIR_STYLES} value={look.hair} onChange={set("hair")} /></Group>
            <Group title="Color"><Swatches label="Color de pelo" options={HAIR_COLORS} value={look.hair_color} onChange={set("hair_color")} /></Group>
            <Group title="Segundo color"><Swatches label="Segundo color de pelo" options={HAIR_COLORS_2} value={look.hair_color2 ?? "none"} onChange={set("hair_color2")} /></Group>
            {look.hair_color2 && look.hair_color2 !== "none" && (
              <Group title="Cómo van los dos colores"><Chips options={HAIR_SPLITS} value={look.hair_split ?? "vertical"} onChange={set("hair_split")} /></Group>
            )}
          </>
        )}
        {tab === "cara" && (
          <>
            <Group title="Ojos"><Chips options={EYES} value={look.eyes} onChange={set("eyes")} /></Group>
            <Group title="Boca"><Chips options={MOUTHS} value={look.mouth} onChange={set("mouth")} /></Group>
            <Group title="Barba"><Chips options={BEARDS} value={look.beard} onChange={set("beard")} /></Group>
            <Group title="Detalles">
              <div className="flex flex-wrap gap-1.5">
                <Toggle label="Pecas" value={look.freckles} onChange={set("freckles")} />
                <Toggle label="Colorete" value={look.blush} onChange={set("blush")} />
                <Toggle label="Eyeliner" value={Boolean(look.eyeliner)} onChange={set("eyeliner")} />
              </div>
            </Group>
            <Group title="Gafas"><Chips options={GLASSES} value={look.glasses ?? "none"} onChange={set("glasses")} /></Group>
          </>
        )}
        {tab === "equipo" && (
          <>
            <Group title="Camiseta"><Chips options={SHIRTS} value={look.shirt ?? "normal"} onChange={set("shirt")} /></Group>
            <Group title="Cinta del pelo"><Swatches label="Cinta" options={ACCENTS} value={look.headband} onChange={set("headband")} /></Group>
            <Group title="Muñequeras"><Swatches label="Muñequeras" options={ACCENTS} value={look.wristbands} onChange={set("wristbands")} /></Group>
            <Group title="Rodilleras"><Swatches label="Rodilleras" options={KNEEPADS} value={look.kneepads} onChange={set("kneepads")} /></Group>
            <Group title="Zapatillas"><Swatches label="Zapatillas" options={SHOES} value={look.shoes} onChange={set("shoes")} /></Group>
          </>
        )}
        {tab === "celebracion" && (
          <>
            <Group title="Qué hace cuando lo tocas">
              <Chips options={CELEBRATIONS} value={look.celebration} onChange={set("celebration")} />
            </Group>
            <p className="text-xs text-zinc-400">Efectos que salen en la pizarra 3D cuando tu jugador hace esa acción:</p>
            <Group title="Remate"><Chips options={FX_REMATE} value={look.fx_remate ?? "none"} onChange={set("fx_remate")} /></Group>
            <Group title="Recepción"><Chips options={FX_RECEPCION} value={look.fx_recepcion ?? "none"} onChange={set("fx_recepcion")} /></Group>
            <Group title="Colocación"><Chips options={FX_COLOCACION} value={look.fx_colocacion ?? "none"} onChange={set("fx_colocacion")} /></Group>
          </>
        )}
      </div>
    </div>
    </ShopContext.Provider>
  );
}
