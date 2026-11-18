import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, CheckCircle2, Coins, Crown, Flame, Home, MessageCircle, Moon, Palette, Sun, SunMoon, Trophy, Users } from "lucide-react";
import { PALETTES, avatarColor, buildTheme, contrast, resolveMode, themeVariables } from "@/app/theme.js";

// Prueba de temas: así se vería la pantalla de inicio con los colores de cada club.
// Todavía no cambia el resto de la app; sirve para elegir el estilo.

const MODES = [
  { id: "club", label: "Del club", icon: Palette },
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Oscuro", icon: Moon },
  { id: "auto", label: "Auto", icon: SunMoon },
];

const TEAMS = ["Femenino", "Masculino", "Escuela", "Playa"];
const GOING = ["Lucía Navarro", "Marta Gil", "Elena Rubio", "Sara Molina", "Paula Herrera", "Irene Castro"];
const PODIUM = [
  { name: "Carmen", score: "8,9", place: 1, crown: "#F5C542", height: "h-10" },
  { name: "Lucía", score: "8,4", place: 2, crown: "#C9D0D8", height: "h-7" },
  { name: "Marta", score: "8,1", place: 3, crown: "#C47A3A", height: "h-5" },
];
const initials = (name) => {
  const parts = name.split(" ");
  return (parts.length > 1 ? parts.map((part) => part[0]).join("") : name).slice(0, 2).toUpperCase();
};

function Swatch({ palette, active, onPick }) {
  const preview = buildTheme(palette.brand, palette.mode, palette.accent);
  return (
    <button
      type="button"
      onClick={() => onPick(palette)}
      aria-pressed={active}
      className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-sm font-semibold transition ${active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"}`}
    >
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: preview.bg }}>
        <span className="absolute inset-y-0 right-0 w-1/2" style={{ background: palette.brand }} />
        <span className="absolute bottom-0 right-0 h-1/2 w-1/2" style={{ background: palette.accent }} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">{palette.name}</span>
      {active && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
    </button>
  );
}

function PersonDot({ name, size = "h-8 w-8", ring = "ring-[var(--surface)]" }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ${ring}`} style={{ background: avatarColor(name) }}>
      {initials(name)}
    </span>
  );
}

function PhonePreview({ theme }) {
  return (
    <div style={themeVariables(theme)} className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[2.2rem] border-[10px] border-zinc-900 shadow-2xl">
      <div className="flex h-[780px] flex-col bg-[var(--bg)] font-body text-[var(--text)]">
        {/* Cabecera con el escudo del club */}
        <header className="flex items-center justify-between px-4 pb-2 pt-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-black text-[var(--on-brand)] ring-2 ring-[var(--accent)]">CV</span>
            <div className="leading-tight">
              <p className="text-sm font-extrabold">C.V. Club</p>
              <p className="text-xs text-[var(--muted)]">Senior Femenino</p>
            </div>
          </div>
          <PersonDot name="Carmen López" size="h-9 w-9" ring="ring-[var(--accent)]" />
        </header>

        <main className="flex-1 space-y-3 overflow-hidden px-4 py-2">
          {/* Saludo: degradado con el color del club y un toque del segundo color */}
          <section className="relative overflow-hidden rounded-2xl p-4 text-[var(--on-brand)]" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-strong))" }}>
            <div aria-hidden="true" className="absolute -right-12 -top-14 h-36 w-36 rounded-full bg-[var(--accent)] opacity-60" />
            <div aria-hidden="true" className="absolute -right-2 top-16 h-16 w-16 rounded-full bg-white/15" />
            <p className="relative text-xs font-semibold opacity-85">Jueves 12 de noviembre</p>
            <h2 className="relative mt-1 font-display text-3xl font-black leading-none">Hola, Carmen</h2>
            <div className="relative mt-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-extrabold text-[var(--text)]">
                <Coins aria-hidden="true" className="h-3.5 w-3.5 text-[var(--gold)]" />1.225
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-extrabold text-[var(--on-accent)]">
                <Crown aria-hidden="true" className="h-3.5 w-3.5" />Jugadora del mes
              </span>
              <span className="flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-xs font-bold">
                <Flame aria-hidden="true" className="h-3.5 w-3.5" />6 entrenos seguidos
              </span>
            </div>
          </section>

          {/* Equipos */}
          <div className="flex gap-1.5 overflow-hidden">
            {TEAMS.map((team, index) => (
              <span
                key={team}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${index === 0 ? "bg-[var(--brand)] text-[var(--on-brand)]" : "bg-[var(--surface)] text-[var(--muted)] shadow-[var(--card-shadow)] ring-1 ring-[var(--line)]"}`}
              >
                {team}
              </span>
            ))}
          </div>

          {/* Próximo entreno */}
          <section className="rounded-2xl bg-[var(--surface)] p-3.5 shadow-[var(--card-shadow)] ring-1 ring-[var(--line)]">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--muted)]"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5 text-[var(--calendar)]" />Próximo entreno</p>
              <span className="flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--success)]">
                <CheckCircle2 aria-hidden="true" className="h-3 w-3" />Vas
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="w-14 shrink-0 overflow-hidden rounded-xl bg-white text-center shadow-sm ring-1 ring-black/10">
                <span className="block bg-[var(--calendar)] py-0.5 text-[10px] font-extrabold text-white">Nov</span>
                <span className="block pb-1 pt-0.5 font-display text-2xl font-black leading-none text-zinc-900">12</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-black leading-tight">20:45 – 22:15</p>
                <p className="text-xs text-[var(--muted)]">Pabellón municipal</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--success)] text-sm font-extrabold text-white">
                <Check aria-hidden="true" className="h-4 w-4" />Voy
              </button>
              <button type="button" className="min-h-11 rounded-xl text-sm font-bold text-[var(--muted)] ring-1 ring-[var(--line)]">No voy</button>
            </div>
            <div className="mt-3 flex items-center">
              <div className="flex -space-x-1.5">
                {GOING.map((name) => (
                  <PersonDot key={name} name={name} />
                ))}
              </div>
              <span className="pl-2 text-xs font-semibold text-[var(--success)]">9 van</span>
              <span className="pl-1 text-xs text-[var(--muted)]">· 2 no</span>
            </div>
          </section>

          {/* Ranking */}
          <section className="rounded-2xl bg-[var(--surface)] p-3.5 shadow-[var(--card-shadow)] ring-1 ring-[var(--line)]">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--muted)]"><Trophy aria-hidden="true" className="h-3.5 w-3.5 text-[var(--gold)]" />Ranking de la semana</p>
              <span className="text-xs font-semibold text-[var(--brand-text)]">Ver todo</span>
            </div>
            <ol className="mt-3 grid grid-cols-3 items-end gap-2 text-center">
              {[PODIUM[1], PODIUM[0], PODIUM[2]].map((entry) => (
                <li key={entry.name} className="flex flex-col items-center gap-1">
                  <Crown aria-hidden="true" className="h-4 w-4" style={{ color: entry.crown, fill: entry.crown }} />
                  <PersonDot name={entry.name} size={entry.place === 1 ? "h-11 w-11" : "h-9 w-9"} ring="ring-transparent" />
                  <span className="text-xs font-bold">{entry.name}</span>
                  <div className={`flex w-full items-start justify-center rounded-t-lg pt-0.5 ${entry.height}`} style={{ background: `linear-gradient(180deg, ${entry.crown}, ${entry.crown}99)` }}>
                    <span className="font-display text-base font-black leading-none text-zinc-900">{entry.score}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Chat */}
          <section className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-3 shadow-[var(--card-shadow)] ring-1 ring-[var(--line)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--info-soft)] text-[var(--info)]">
              <MessageCircle aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Chat del equipo</p>
              <p className="truncate text-xs text-[var(--muted)]">Javier: el jueves trabajamos recepción…</p>
            </div>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[11px] font-bold text-white">3</span>
          </section>
        </main>

        {/* Menú de abajo */}
        <nav className="grid grid-cols-5 border-t border-[var(--line)] bg-[var(--surface)] px-2 pb-4 pt-2 text-[11px] font-semibold">
          {[["Inicio", Home], ["Equipo", Users], ["Ranking", Trophy], ["Agenda", CalendarDays], ["Chat", MessageCircle]].map(([label, Icon], index) => (
            <span key={label} className={`relative flex flex-col items-center gap-1 ${index === 0 ? "text-[var(--brand-text)]" : "text-[var(--muted)]"}`}>
              {index === 0 && <span aria-hidden="true" className="absolute -top-2 h-1 w-8 rounded-full bg-[var(--accent)]" />}
              <Icon aria-hidden="true" className="h-5 w-5" />
              {label}
              {label === "Chat" && <span aria-hidden="true" className="absolute right-3 top-0 h-2 w-2 rounded-full bg-[var(--danger)]" />}
            </span>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function ThemeLabPage() {
  const [paletteId, setPaletteId] = useState(PALETTES[0].id);
  const [custom, setCustom] = useState("#0EA5E9");
  const [customAccent, setCustomAccent] = useState("#F97316");
  const [customMode, setCustomMode] = useState("light");
  const [modeChoice, setModeChoice] = useState("club");
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return undefined;
    const update = () => setSystemDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const palette =
    paletteId === "custom"
      ? { id: "custom", name: "Personalizado", brand: custom, accent: customAccent, mode: customMode }
      : PALETTES.find(({ id }) => id === paletteId);
  const mode = modeChoice === "auto" ? (systemDark ? "dark" : "light") : resolveMode(modeChoice, palette.mode);
  const theme = useMemo(() => buildTheme(palette.brand, mode, palette.accent), [palette.brand, palette.accent, mode]);

  const pickCustom = (setter) => (event) => {
    setter(event.target.value);
    setPaletteId("custom");
  };

  return (
    <div className="min-h-screen bg-zinc-100 font-body text-zinc-900">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:py-10">
        <div className="space-y-5">
          <header>
            <p className="text-xs font-extrabold text-zinc-500">Rotta · prueba de temas</p>
            <h1 className="mt-1 font-display text-3xl font-black leading-tight md:text-4xl">Los colores de tu club</h1>
            <p className="mt-1 max-w-prose text-sm text-zinc-600">
              El club elige sus dos colores una vez y toda la app se tiñe. Cada persona elige si la ve en claro u oscuro.
              Verde, dorado y rojo significan lo mismo en todos los clubs: vas, coins y mensajes nuevos.
            </p>
          </header>

          <section aria-labelledby="palettes-title" className="space-y-2.5">
            <h2 id="palettes-title" className="text-sm font-extrabold">Paletas</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PALETTES.map((item) => (
                <Swatch key={item.id} palette={item} active={item.id === paletteId} onPick={(picked) => setPaletteId(picked.id)} />
              ))}
            </div>
          </section>

          <section aria-labelledby="custom-title" className={`space-y-2.5 rounded-2xl border p-3.5 ${paletteId === "custom" ? "border-zinc-900 bg-white" : "border-zinc-200 bg-white/60"}`}>
            <h2 id="custom-title" className="text-sm font-extrabold">Colores propios del club</h2>
            <div className="flex flex-wrap items-center gap-3">
              {[["Principal", custom, setCustom], ["Segundo color", customAccent, setCustomAccent]].map(([label, value, setter]) => (
                <label key={label} className="flex items-center gap-2 text-sm font-semibold">
                  <input type="color" value={value} onChange={pickCustom(setter)} className="h-11 w-14 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1" />
                  <span className="leading-tight">
                    {label}
                    <span className="block font-mono text-[11px] text-zinc-500">{value}</span>
                  </span>
                </label>
              ))}
              <div role="radiogroup" aria-label="Fondo de los colores propios" className="flex gap-1.5">
                {[["light", "Fondo blanco"], ["dark", "Fondo negro"]].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={customMode === value}
                    onClick={() => {
                      setCustomMode(value);
                      setPaletteId("custom");
                    }}
                    className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${customMode === value ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {paletteId === "custom" && (
              <p className="text-xs text-zinc-600">
                Contraste con el fondo: {contrast(theme.brand, theme.surface).toFixed(1).replace(".", ",")}
                {theme.warnings.length > 0 ? ` · ${theme.warnings[0]}` : " · Se lee bien."}
              </p>
            )}
          </section>

          <section aria-labelledby="mode-title" className="space-y-2.5">
            <h2 id="mode-title" className="text-sm font-extrabold">Cómo la ve cada persona</h2>
            <div role="radiogroup" aria-label="Modo" className="grid grid-cols-4 gap-1.5 sm:max-w-md">
              {MODES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={modeChoice === id}
                  onClick={() => setModeChoice(id)}
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-bold ${modeChoice === id ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-zinc-400"}`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">"Del club" usa el fondo de la paleta; "Auto" sigue al móvil.</p>
          </section>
        </div>

        <div className="lg:sticky lg:top-6">
          <PhonePreview theme={theme} />
        </div>
      </div>
    </div>
  );
}
