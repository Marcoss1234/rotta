import { useEffect, useRef, useState } from "react";
import { Check, Moon, Palette, Sun, SunMoon } from "lucide-react";
import { PALETTES, buildRottaTheme, resolveStyle } from "@/app/theme.js";
import { STYLES, THEMES } from "@/app/themes.js";
import { saveClubTheme, sameClubTheme, useThemeControls } from "@/app/useTheme.js";
import ClubIdentitySettings from "@/app/components/ClubIdentitySettings.jsx";
import ThemePreview from "@/app/components/ThemePreview.jsx";
import { Notice } from "@/app/ui/index.js";

const MODES = [
  { id: "club", label: "Del club", icon: Palette },
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Oscuro", icon: Moon },
  { id: "auto", label: "Auto", icon: SunMoon },
];

const same = (a, b) => a.toUpperCase() === b.toUpperCase();
const samePalette = (club, palette) => same(club.brand, palette.brand) && same(club.accent, palette.accent) && club.mode === palette.mode;

// Lo que avisa buildRottaTheme (src/app/theme.js) cuando el color elegido necesita ajustes.
const WARNINGS = {
  "similar-rotta": "Tu color principal se parece mucho al de este tema: los detalles de Rotta pasan a tu color. Si quieres que se distingan, prueba otro tema.",
  "similar-voy": "Tu color principal se parece al verde de «Voy». «Voy» siempre lleva su ✓ y su palabra, pero puede confundir.",
  colorless: "Es blanco, negro o gris: lo seleccionado irá en el color del texto y el escudo llevará borde.",
  "text-adjusted": "Como texto se leería mal: los textos irán en el color normal, con tu color en puntos y rellenos.",
  "low-contrast": "Sobre las tarjetas se ve poco: rayas, iconos y bordes usan una versión ajustada; el escudo y los botones quedan con tu color.",
};
const MODE_NAMES = { light: "en claro", dark: "en oscuro" };

function clubWarnings(club) {
  const found = new Map();
  for (const mode of ["light", "dark"]) {
    for (const warning of buildRottaTheme(club.style, mode, club.brand, club.accent).warnings) {
      found.set(warning, [...(found.get(warning) ?? []), mode]);
    }
  }
  return [...found].map(([warning, modes]) => `${WARNINGS[warning]}${modes.length === 1 ? ` (${MODE_NAMES[modes[0]]})` : ""}`);
}

// Lo que ve cada persona: claro, oscuro o como el móvil. Se guarda en este móvil y no lo cambia el club.
function ModePicker() {
  const { choice, chooseMode } = useThemeControls();
  return (
    <div role="radiogroup" aria-label="Cómo ves la app" className="grid grid-cols-4 gap-1.5">
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={choice === id}
          onClick={() => chooseMode(id)}
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-bold transition-colors ${choice === id ? "bg-brand text-onbrand" : "bg-void/60 text-white/80 hover:text-white"}`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

// Los tres temas de Rotta, cada uno con su vista pequeña (oscuro y claro) con los colores del club.
function StylePicker({ club, onPick }) {
  const current = resolveStyle(club.style);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-extrabold">Tema de Rotta</legend>
      <div role="radiogroup" aria-label="Tema de Rotta" className="grid gap-2 sm:grid-cols-3">
        {STYLES.map((style) => {
          const theme = THEMES[style];
          const active = current === style;
          return (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick({ style })}
              className={`flex flex-col overflow-hidden rounded-2xl text-left ring-1 transition-colors ${active ? "ring-2 ring-tnt" : "ring-white/10 hover:ring-white/30"}`}
            >
              <span className="grid h-28 grid-cols-2">
                <ThemePreview compact style={style} mode="dark" brand={club.brand} accent={club.accent} />
                <ThemePreview compact style={style} mode="light" brand={club.brand} accent={club.accent} />
              </span>
              <span className="flex flex-1 flex-col gap-1 p-3">
                <span className="flex items-center justify-between gap-2 text-sm font-extrabold">
                  {theme.name}
                  {active && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-tnt" />}
                </span>
                <span className="text-xs font-semibold text-white/80">{theme.description}</span>
                <span className="text-xs text-ink-muted">{theme.traits.join(" · ")}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// Solo administradores: tema de Rotta, los dos colores del club y su modo recomendado. Se ve al momento en
// toda la app (solo en este móvil) y, al guardar, lo ve todo el club. El modo de cada persona no se toca.
function ClubColors() {
  const { club, savedClub: saved, previewClub, commitClub } = useThemeControls();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = !sameClubTheme(club, saved);
  const warnings = clubWarnings(club);

  // Si se sale de Apariencia sin guardar, la app vuelve a los colores guardados.
  const pending = useRef({ changed, saved });
  pending.current = { changed, saved };
  useEffect(() => () => {
    if (pending.current.changed) previewClub(pending.current.saved);
  }, [previewClub]);

  const pick = (next) => {
    setMessage("");
    previewClub({ ...club, ...next });
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const stored = await saveClubTheme({ ...club, style: resolveStyle(club.style) });
      commitClub(stored);
      setMessage("Guardado: todo el club verá esta apariencia al abrir la app.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 border-t border-white/10 pt-4">
      <div>
        <h3 className="text-base font-extrabold">Apariencia del club</h3>
        <p className="text-xs text-ink-muted">Solo administradores. Lo que elijas aquí lo ve todo el club; cada persona sigue eligiendo arriba si la ve en claro u oscuro.</p>
      </div>

      <StylePicker club={club} onPick={pick} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-extrabold">Colores del club</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {PALETTES.map((palette) => {
            const active = samePalette(club, palette);
            return (
              <button
                key={palette.id}
                type="button"
                aria-pressed={active}
                onClick={() => pick({ brand: palette.brand, accent: palette.accent, mode: palette.mode })}
                className={`flex min-h-11 items-center gap-2 rounded-full px-2 text-left text-xs font-semibold ring-1 ${active ? "bg-white/10 ring-tnt" : "ring-white/10 hover:bg-white/5"}`}
              >
                <span aria-hidden="true" className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/20" style={{ background: palette.mode === "dark" ? "#0B0C0F" : "#F4F5F8" }}>
                  <span className="absolute inset-y-0 right-0 w-1/2" style={{ background: palette.brand }} />
                  <span className="absolute bottom-0 right-0 h-1/2 w-1/2" style={{ background: palette.accent }} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">{palette.name}</span>
                {active && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-tnt" />}
              </button>
            );
          })}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["brand", "Color principal", "Escudo, botones y lo que está seleccionado."],
            ["accent", "Segundo color", "Franjas, detalles y el banner del partido en directo."],
          ].map(([key, label, help]) => (
            <label key={key} className="flex items-center gap-3 rounded-xl bg-void/60 p-2.5">
              <input type="color" value={club[key]} onChange={(event) => pick({ [key]: event.target.value.toUpperCase() })} className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-white/15 bg-transparent p-0.5" />
              <span className="min-w-0">
                <span className="block text-xs font-bold">{label} <span className="font-mono font-semibold text-ink-muted">{club[key].toUpperCase()}</span></span>
                <span className="block text-xs text-ink-muted">{help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-extrabold">Modo del club</legend>
        <p className="text-xs text-ink-muted">El que ve quien tiene «Del club» elegido. Quien elige claro, oscuro o auto sigue con lo suyo.</p>
        <div role="radiogroup" aria-label="Modo del club" className="flex gap-1">
          {[["dark", "Oscuro"], ["light", "Claro"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={club.mode === value}
              onClick={() => pick({ mode: value })}
              className={`min-h-10 rounded-md px-3 text-xs font-bold ${club.mode === value ? "bg-brand text-onbrand" : "text-white/80 ring-1 ring-white/15"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <section aria-label="Vista previa" className="space-y-2">
        <h4 className="text-sm font-extrabold">Así lo verá tu club</h4>
        <div className="grid gap-2 min-[480px]:grid-cols-2">
          {["light", "dark"].map((mode) => (
            <figure key={mode} className="space-y-1">
              <figcaption className="flex items-center gap-1.5 text-xs font-bold text-white/80">
                {mode === "light" ? "Claro" : "Oscuro"}
                {club.mode === mode && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-white/80">del club</span>}
              </figcaption>
              <div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
                <ThemePreview style={club.style} mode={mode} brand={club.brand} accent={club.accent} />
              </div>
            </figure>
          ))}
        </div>
      </section>

      {warnings.length > 0 && (
        <Notice tone="warning" as="div" size="sm" announce={false}>
          <ul className="space-y-1">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </Notice>
      )}
      {error && <Notice tone="error" inline>{error}</Notice>}
      {message && <Notice tone="success" inline>{message}</Notice>}
      {changed && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => previewClub(saved)} className="min-h-11 rounded-full text-sm font-bold text-white/60 ring-1 ring-white/15 hover:bg-white/5">
            Deshacer
          </button>
          <button type="button" disabled={busy} onClick={save} className="min-h-11 rounded-full bg-brand text-sm font-bold text-onbrand disabled:opacity-60">
            {busy ? "Guardando…" : "Guardar para todos"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ThemeSettingsCard({ isAdmin }) {
  return (
    <section aria-labelledby="theme-title" className="space-y-3 rounded-3xl bg-card p-4">
      <div>
        <h2 id="theme-title" className="font-display text-xl font-extrabold">Apariencia</h2>
        <p className="text-sm text-ink-muted">Solo para ti, en este móvil: «Del club» usa el modo que recomienda tu club; «Auto» sigue a tu móvil.</p>
      </div>
      <ModePicker />
      {isAdmin && <ClubIdentitySettings />}
      {isAdmin && <ClubColors />}
    </section>
  );
}
