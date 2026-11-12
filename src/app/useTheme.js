import { createContext, createElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { clubHeaders, clubSlug } from "@/app/club.js";
import { buildTheme, hexToRgb, themeVariables } from "@/app/theme.js";

// Pinta toda la app con los colores del club y el modo (claro u oscuro) que elige cada persona.
// Los colores se guardan también en el móvil para que la app salga ya pintada al abrirla.

// Cada club guarda sus colores aparte: en un móvil con dos clubs no se mezclan.
const CLUB_KEY = `rotta-tema-club${clubSlug ? `-${clubSlug}` : ""}`;
const MODE_KEY = "rotta-modo";
const DEFAULT_CLUB = { brand: "#7C3AED", accent: "#22D3EE", mode: "dark" };
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

export function applyTheme(club, choice) {
  const mode = resolveThemeMode(choice, club);
  const theme = buildTheme(club.brand, mode, club.accent);
  const root = document.documentElement;
  root.dataset.theme = mode;
  // Si el texto encima del color del club es claro u oscuro (lo usa src/theme-palette.css).
  root.dataset.onbrand = theme.onBrand === "#FFFFFF" ? "light" : "dark";
  // Lo que usan las clases de siempre (bg-tnt, text-ember...) y el código nuevo (var(--brand)...).
  root.style.setProperty("--c-tnt", triplet(theme.brand));
  root.style.setProperty("--c-tntdeep", triplet(theme.brandStrong));
  root.style.setProperty("--c-ember", triplet(theme.accent));
  root.style.setProperty("--c-onbrand", triplet(theme.onBrand));
  root.style.setProperty("--c-onbrand-inverse", triplet(theme.onBrand === "#FFFFFF" ? "#0F1115" : "#FFFFFF"));
  root.style.setProperty("--c-onember", triplet(theme.onAccent));
  Object.entries(themeVariables(theme)).forEach(([name, value]) => {
    if (name.startsWith("--")) root.style.setProperty(name, value);
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.bg);
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
  const [club, setClub] = useState(() => readStorage(CLUB_KEY, DEFAULT_CLUB));
  const [choice, setChoice] = useState(() => readStorage(MODE_KEY, "club"));
  const [, setSystemTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchClubTheme()
      .then((saved) => {
        if (cancelled) return;
        writeStorage(CLUB_KEY, saved);
        setClub(saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
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

  const value = useMemo(() => ({ club, choice, theme, chooseMode, previewClub }), [club, choice, theme, chooseMode, previewClub]);
  return createElement(ThemeContext.Provider, { value }, children);
}
