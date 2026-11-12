import { useState } from "react";
import { Check, Moon, Palette, Sun, SunMoon } from "lucide-react";
import { PALETTES, buildTheme, contrast } from "@/app/theme.js";
import { saveClubTheme, useThemeControls } from "@/app/useTheme.js";

const MODES = [
  { id: "club", label: "Del club", icon: Palette },
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Oscuro", icon: Moon },
  { id: "auto", label: "Auto", icon: SunMoon },
];

const sameColors = (a, b) => a.brand.toUpperCase() === b.brand.toUpperCase() && a.accent.toUpperCase() === b.accent.toUpperCase() && a.mode === b.mode;

// Lo que ve cada persona: claro, oscuro o como el móvil. Se guarda en este móvil.
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
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-bold transition-colors ${choice === id ? "bg-tnt text-onbrand" : "bg-void/60 text-zinc-300 hover:text-white"}`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

// Solo administradores: los dos colores del club y si su app es clara u oscura. Se ve al momento y se guarda para todos.
function ClubColors() {
  const { club, previewClub } = useThemeControls();
  const [saved, setSaved] = useState(club);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = !sameColors(club, saved);
  const lowContrast = contrast(club.brand, buildTheme(club.brand, club.mode, club.accent).surface) < 3;

  const pick = (next) => {
    setMessage("");
    previewClub({ ...club, ...next });
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const stored = await saveClubTheme(club);
      setSaved(stored);
      previewClub(stored);
      setMessage("Guardado: todo el club ya ve estos colores.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-white/10 pt-4">
      <div>
        <h3 className="text-sm font-extrabold">Colores del club</h3>
        <p className="text-xs text-zinc-400">Solo administradores. Lo cambias aquí y lo ve todo el club.</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {PALETTES.map((palette) => {
          const active = sameColors(club, palette);
          return (
            <button
              key={palette.id}
              type="button"
              aria-pressed={active}
              onClick={() => pick({ brand: palette.brand, accent: palette.accent, mode: palette.mode })}
              className={`flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold ring-1 ${active ? "bg-white/10 ring-tnt" : "ring-white/10 hover:bg-white/5"}`}
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
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-void/60 p-2.5">
        {[["brand", "Principal"], ["accent", "Segundo"]].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-xs font-semibold">
            <input type="color" value={club[key]} onChange={(event) => pick({ [key]: event.target.value.toUpperCase() })} className="h-10 w-12 cursor-pointer rounded-md border border-white/15 bg-transparent p-0.5" />
            {label}
          </label>
        ))}
        <div role="radiogroup" aria-label="Fondo del club" className="flex gap-1">
          {[["dark", "Oscuro"], ["light", "Claro"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={club.mode === value}
              onClick={() => pick({ mode: value })}
              className={`min-h-10 rounded-md px-2.5 text-xs font-bold ${club.mode === value ? "bg-tnt text-onbrand" : "text-zinc-300 ring-1 ring-white/15"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {lowContrast && <p className="text-xs text-amber-300">Ese color se ve poco sobre el fondo: los textos en color se ajustan solos.</p>}
      {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm font-semibold text-emerald-300">{message}</p>}
      {changed && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => previewClub(saved)} className="min-h-11 rounded-lg text-sm font-bold text-zinc-200 ring-1 ring-white/15 hover:bg-white/5">
            Deshacer
          </button>
          <button type="button" disabled={busy} onClick={save} className="min-h-11 rounded-lg bg-tnt text-sm font-bold text-onbrand disabled:opacity-60">
            {busy ? "Guardando…" : "Guardar para todos"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ThemeSettingsCard({ isAdmin }) {
  return (
    <section aria-labelledby="theme-title" className="space-y-3 rounded-xl bg-panel p-4">
      <div>
        <h2 id="theme-title" className="font-display text-xl font-black uppercase italic">Apariencia</h2>
        <p className="text-sm text-zinc-400">"Del club" usa el fondo que ha elegido tu club; "Auto" sigue a tu móvil.</p>
      </div>
      <ModePicker />
      {isAdmin && <ClubColors />}
    </section>
  );
}
