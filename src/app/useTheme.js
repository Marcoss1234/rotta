import { createContext, createElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clubHeaders, clubSlug } from "@/app/club.js";
import { buildRottaTheme, buildTheme, hexToRgb, resolveStyle, textOn, themeVariables } from "@/app/theme.js";
import { DEFAULT_STYLE } from "@/app/themes.js";

// Pinta toda la app con los colores del club y el modo (claro u oscuro) que elige cada persona.
// Los colores se guardan también en el móvil para que la app salga ya pintada al abrirla.

// Cada club guarda sus colores aparte: en un móvil con dos clubs no se mezclan.
const CLUB_KEY = `rotta-tema-club${clubSlug ? `-${clubSlug}` : ""}`;
const MODE_KEY = "rotta-modo";
const DEFAULT_CLUB = { brand: "#7C3AED", accent: "#22D3EE", mode: "dark", style: DEFAULT_STYLE };
export const MODE_CHOICES = ["club", "light", "dark", "auto"];

const readStorage = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};
const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento (modo privado): se pinta igual, solo que no se recuerda.
  }
};

const systemDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;

export function resolveThemeMode(choice, club) {
  if (choice === "light" || choice === "dark") return choice;
  if (choice === "auto") return systemDark() ? "dark" : "light";
  return club.mode;
}

const triplet = (hex) => hexToRgb(hex).join(" ");

/** Si dos ajustes del club se pintan igual (colores, modo y tema). */
export const sameClubTheme = (a, b) =>
  a.brand.toUpperCase() === b.brand.toUpperCase() && a.accent.toUpperCase() === b.accent.toUpperCase() && a.mode === b.mode && resolveStyle(a.style) === resolveStyle(b.style);

// Lo último que se pintó en este móvil, para que index.html lo ponga antes de cargar la app (sin parpadeo).
const PAINTED_KEY = "rotta-pintado";

// Lo que depende del color del club, en el modo de la persona y en oscuro (para la pista, la pizarra y el
// directo, que van siempre en oscuro: index.css cambia unas por otras dentro de .force-dark).
const CLUB_VARIABLES = {
  "club": "club", "club-ui": "clubUi", "club-text": "clubText", "club-label": "clubLabel", "club-soft": "clubSoft", "on-club": "onClub",
  "rotta": "rotta", "rotta-text": "rottaText", "on-rotta": "onRotta", "stripe": "stripe", "accent-ui": "accentUi",
  "live-club": "liveClub", "live-accent": "liveAccent",
};
const DARK_VARIABLES = ["club-ui", "club-text", "club-label", "club-soft", "rotta", "rotta-text", "on-rotta", "accent-ui"];

function applyRottaTheme(root, club, mode) {
  const style = resolveStyle(club.style);
  const rotta = buildRottaTheme(style, mode, club.brand, club.accent);
  const dark = mode === "dark" ? rotta : buildRottaTheme(style, "dark", club.brand, club.accent);
  root.dataset.rotta = style;
  Object.entries(CLUB_VARIABLES).forEach(([name, key]) => root.style.setProperty(`--c-${name}`, triplet(rotta[key])));
  DARK_VARIABLES.forEach((name) => root.style.setProperty(`--c-${name}-dark`, triplet(dark[CLUB_VARIABLES[name]])));
  // El segundo color de las pantallas de hoy (text-ember...) va ya ajustado para que se lea.
  root.style.setProperty("--c-ember-dark", triplet(dark.accentText));
  root.style.setProperty("--c-onember-dark", triplet(textOn(dark.accentText)));
  return rotta;
}

export function applyTheme(club, choice) {
  const mode = resolveThemeMode(choice, club);
  const theme = buildTheme(club.brand, mode, club.accent);
  const root = document.documentElement;
  root.dataset.theme = mode;
  const rotta = applyRottaTheme(root, club, mode);
  // Si el texto encima del color del club es claro u oscuro (lo usa src/theme-palette.css).
  root.dataset.onbrand = theme.onBrand === "#FFFFFF" ? "light" : "dark";
  // Lo que usan las clases de siempre (bg-tnt, text-ember...) y el código nuevo (var(--brand)...).
  root.style.setProperty("--c-tnt", triplet(theme.brand));
  root.style.setProperty("--c-tntdeep", triplet(theme.brandStrong));
  root.style.setProperty("--c-ember", triplet(rotta.accentText));
  root.style.setProperty("--c-onbrand", triplet(theme.onBrand));
  root.style.setProperty("--c-onbrand-inverse", triplet(theme.onBrand === "#FFFFFF" ? "#0F1115" : "#FFFFFF"));
  root.style.setProperty("--c-onember", triplet(textOn(rotta.accentText)));
  Object.entries(themeVariables(theme)).forEach(([name, value]) => {
    if (name.startsWith("--")) root.style.setProperty(name, value);
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", rotta.bg);
  try {
    window.localStorage.setItem(PAINTED_KEY, JSON.stringify({ theme: mode, rotta: rotta.style, onbrand: root.dataset.onbrand, vars: root.style.cssText, bg: rotta.bg }));
  } catch {
    // Sin almacenamiento: la próxima vez la app tardará un instante más en salir con sus colores.
  }
  return theme;
}

export async function fetchClubTheme() {
  const response = await fetch("/api/club/theme", { credentials: "include", headers: clubHeaders() });
  if (!response.ok) throw new Error("No se pudieron cargar los colores del club");
  return response.json();
}

export async function saveClubTheme(club) {
  const response = await fetch("/api/club/theme", {
    method: "PUT",
    credentials: "include",
    headers: clubHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(club),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail ?? "No se pudieron guardar los colores");
  writeStorage(CLUB_KEY, data);
  return data;
}

// Al cargar la página, antes de que React pinte nada: así no se ve un parpadeo de colores.
export function applyStoredTheme() {
  applyTheme(readStorage(CLUB_KEY, DEFAULT_CLUB), readStorage(MODE_KEY, "club"));
}

const ThemeContext = createContext(null);

/** Los colores del club y el modo de esta persona, para cualquier pantalla que los quiera cambiar. */
export const useThemeControls = () => useContext(ThemeContext);

/** Envuelve toda la app: carga los colores del club y los aplica. */
export function ThemeProvider({ children }) {
  // `club` es lo que se pinta (puede ser una vista previa del administrador); `savedClub`, lo guardado en el club.
  const [savedClub, setSavedClub] = useState(() => readStorage(CLUB_KEY, DEFAULT_CLUB));
  const [club, setClub] = useState(savedClub);
  const [choice, setChoice] = useState(() => readStorage(MODE_KEY, "club"));
  const [, setSystemTick] = useState(0);
  const previewing = useRef(false);
  previewing.current = !sameClubTheme(club, savedClub);

  // Lo guardado en el servidor: al abrir la app y cada vez que se vuelve a ella (si un administrador lo ha
  // cambiado, el resto lo ve sin cerrarla). Mientras un administrador prueba colores, no se le pisan.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      fetchClubTheme()
        .then((saved) => {
          if (cancelled) return;
          writeStorage(CLUB_KEY, saved);
          setSavedClub(saved);
          if (!previewing.current) setClub(saved);
        })
        .catch(() => {});
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // "Auto" sigue al móvil también si cambia mientras la app está abierta.
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return undefined;
    const update = () => setSystemTick((tick) => tick + 1);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const theme = useMemo(() => buildTheme(club.brand, resolveThemeMode(choice, club), club.accent), [club, choice]);
  useLayoutEffect(() => {
    applyTheme(club, choice);
  });

  const chooseMode = useCallback((next) => {
    writeStorage(MODE_KEY, next);
    setChoice(next);
  }, []);
  const previewClub = useCallback((next) => setClub(next), []);
  // Después de guardar: lo guardado pasa a ser lo de todos (y lo que se pinta).
  const commitClub = useCallback((stored) => {
    setSavedClub(stored);
    setClub(stored);
  }, []);

  const value = useMemo(
    () => ({ club, savedClub, choice, theme, chooseMode, previewClub, commitClub }),
    [club, savedClub, choice, theme, chooseMode, previewClub, commitClub],
  );
  return createElement(ThemeContext.Provider, { value }, children);
}
