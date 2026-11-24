// Temas de Rotta: cada club elige su color (de una paleta o el suyo propio)
// y cada persona elige claro, oscuro o automático. Todo sale de aquí como variables CSS.
import { DEFAULT_STYLE, THEME_MEANINGS, THEMES } from "./themes.js";

// Cada club tiene dos colores: el principal (botones, cabecera) y el de acento (detalles).
export const PALETTES = [
  { id: "blanco-azul", name: "Blanco y azul", brand: "#1D4ED8", accent: "#F59E0B", mode: "light" },
  { id: "negro-azul", name: "Negro y azul", brand: "#3B82F6", accent: "#22D3EE", mode: "dark" },
  { id: "negro-rojo", name: "Negro y rojo", brand: "#E11D2E", accent: "#F5C542", mode: "dark" },
  { id: "blanco-verde", name: "Blanco y verde", brand: "#15803D", accent: "#EAB308", mode: "light" },
  { id: "negro-dorado", name: "Negro y dorado", brand: "#E8B923", accent: "#60A5FA", mode: "dark" },
  { id: "blanco-morado", name: "Blanco y morado", brand: "#7C3AED", accent: "#EC4899", mode: "light" },
  { id: "negro-naranja", name: "Negro y naranja", brand: "#FF4D00", accent: "#FFD400", mode: "dark" },
  { id: "blanco-granate", name: "Blanco y granate", brand: "#9F1239", accent: "#D4A017", mode: "light" },
];

// Colores con significado, iguales en todos los clubs (se ajustan un poco a claro u oscuro).
const MEANINGS = {
  light: { success: "#16A34A", gold: "#D99A00", danger: "#DC2626", info: "#0284C7", calendar: "#E5383B" },
  dark: { success: "#22C55E", gold: "#F5C542", danger: "#F43F5E", info: "#38BDF8", calendar: "#E5383B" },
};

// Colores para los avatares: cada persona sale siempre del mismo.
export const AVATAR_COLORS = ["#F97316", "#0EA5E9", "#A855F7", "#10B981", "#EC4899", "#EAB308", "#6366F1", "#14B8A6"];
export const avatarColor = (name) => AVATAR_COLORS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length];

// Fondos y textos neutros de cada modo; el color del club va encima.
const BASES = {
  // En claro, el fondo es gris y las tarjetas blancas llevan borde y sombra: así no se funden.
  light: {
    // Sin blanco puro: deslumbra en el móvil. Fondo gris medio y tarjetas en blanco roto.
    bg: "#DEE2E8",
    surface: "#F4F5F8",
    raised: "#E8EBF0",
    text: "#1A1D24",
    muted: "#5B6170",
    border: "#D3D8E0",
    shadow: "0 1px 2px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.06)",
  },
  dark: { bg: "#0B0C0F", surface: "#15171C", raised: "#1E2128", text: "#F4F5F7", muted: "#9AA0AD", border: "#262A33", shadow: "none" },
};

const clamp = (value, min = 0, max = 255) => Math.min(max, Math.max(min, value));

export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
  const number = Number.parseInt(full, 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

const rgbToHex = (rgb) => `#${rgb.map((value) => Math.round(clamp(value)).toString(16).padStart(2, "0")).join("")}`;

// Mezcla dos colores: amount 0 = el primero, 1 = el segundo.
export const mix = (from, to, amount) => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex(a.map((value, index) => value + (b[index] - value) * amount));
};

function luminance(hex) {
  const channel = (value) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Contraste WCAG entre dos colores (1 a 21). Texto normal necesita 4,5; botones y textos grandes, 3.
export function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Aclara u oscurece el color hasta que se lea bien sobre el fondo.
function readableOn(color, background, minimum) {
  const towards = luminance(background) > 0.5 ? "#000000" : "#FFFFFF";
  let result = color;
  for (let step = 1; step <= 20 && contrast(result, background) < minimum; step += 1) {
    result = mix(color, towards, step * 0.05);
  }
  return result;
}

/** Todo lo que necesita la app para pintarse con un color de club y un modo. */
export function buildTheme(brand, mode, accent = brand) {
  const base = BASES[mode];
  const meanings = MEANINGS[mode];
  // Texto encima del color del club: blanco o casi negro, el que se lea mejor.
  const onBrand = contrast(brand, "#FFFFFF") >= contrast(brand, "#0F1115") ? "#FFFFFF" : "#0F1115";
  // El color del club como texto o icono sobre el fondo (un amarillo sobre blanco se oscurece un poco).
  const brandText = readableOn(brand, base.surface, 4.5);
  return {
    mode,
    brand,
    onBrand,
    brandText,
    brandSoft: mix(base.surface, brand, mode === "dark" ? 0.18 : 0.1),
    brandStrong: mix(brand, "#000000", 0.25),
    accent,
    onAccent: contrast(accent, "#FFFFFF") >= contrast(accent, "#0F1115") ? "#FFFFFF" : "#0F1115",
    accentText: readableOn(accent, base.surface, 4.5),
    accentSoft: mix(base.surface, accent, mode === "dark" ? 0.2 : 0.16),
    ...meanings,
    infoSoft: mix(base.surface, meanings.info, mode === "dark" ? 0.2 : 0.14),
    successSoft: mix(base.surface, meanings.success, mode === "dark" ? 0.2 : 0.14),
    goldText: readableOn(meanings.gold, base.surface, 3),
    ...base,
    // Avisos para el que elige un color personalizado.
    warnings: [
      contrast(brand, base.surface) < 3 && "Este color se ve poco sobre el fondo: los textos en color se ajustan solos.",
    ].filter(Boolean),
  };
}

/** Las variables CSS del tema, para ponerlas en el estilo de la raíz. */
export function themeVariables(theme) {
  return {
    "--brand": theme.brand,
    "--on-brand": theme.onBrand,
    "--brand-text": theme.brandText,
    "--brand-soft": theme.brandSoft,
    "--brand-strong": theme.brandStrong,
    "--bg": theme.bg,
    "--surface": theme.surface,
    "--raised": theme.raised,
    "--text": theme.text,
    "--muted": theme.muted,
    "--line": theme.border,
    "--card-shadow": theme.shadow,
    "--accent": theme.accent,
    "--on-accent": theme.onAccent,
    "--accent-text": theme.accentText,
    "--accent-soft": theme.accentSoft,
    "--success": theme.success,
    "--success-soft": theme.successSoft,
    "--gold": theme.gold,
    "--gold-text": theme.goldText,
    "--danger": theme.danger,
    "--info": theme.info,
    "--info-soft": theme.infoSoft,
    "--calendar": theme.calendar,
    colorScheme: theme.mode,
  };
}

/** Claro, oscuro o el del móvil. */
export function resolveMode(choice, paletteMode) {
  if (choice === "light" || choice === "dark") return choice;
  if (choice === "club") return paletteMode;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// ---------- Temas Lima, Naranja y Tinta (src/app/themes.js) ----------
// Todavía no los usa la app: esto es la base. tools/comprobar-temas.mjs prueba todas las combinaciones.

// Parecido entre dos colores tal y como los ve el ojo (OKLab): 0 = iguales; por debajo de 15, «casi iguales».
const linear = (value) => {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};
function oklab(hex) {
  const [r, g, b] = hexToRgb(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function colorDistance(a, b) {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 100;
}
/** Cuánto color tiene (0 = blanco, negro o gris). */
export function colorfulness(hex) {
  const [, a, b] = oklab(hex);
  return Math.hypot(a, b) * 100;
}

export const SIMILAR_COLORS = 15; // por debajo, dos colores se ven casi iguales
const COLORLESS = 4; // por debajo, el color del club es blanco, negro o gris
const TOO_CHANGED = 25; // si para leerse como texto cambia más que esto, ya no parece el color del club
const VOY_GREEN = "#16A34A";

/** Aclara u oscurece el color, a pasos pequeños, hasta llegar al mínimo sobre TODOS los fondos. */
export function readableOnAll(color, backgrounds, minimum) {
  const towards = luminance(backgrounds[0]) > 0.3 ? "#000000" : "#FFFFFF";
  for (let step = 0; step <= 40; step += 1) {
    const candidate = mix(color, towards, step * 0.025);
    if (backgrounds.every((background) => contrast(candidate, background) >= minimum)) return candidate;
  }
  return towards;
}

/** Blanco, casi negro o negro: el que mejor se lea encima del color. */
export const textOn = (fill) => ["#FFFFFF", "#0F1115", "#000000"].reduce((best, option) => (contrast(option, fill) > contrast(best, fill) ? option : best));

export const resolveStyle = (style) => (THEMES[style] ? style : DEFAULT_STYLE);

/**
 * Todos los colores de un tema de Rotta con el color del club, ya ajustados para que se lean.
 * Reglas:
 * - El color del club se usa tal cual en rellenos (escudo, botones) con texto blanco u oscuro encima.
 * - Como texto (clubText) se ajusta a 4,5:1; como raya, icono o borde (clubUi), a 3:1.
 * - Si como texto cambia demasiado (un dorado sobre blanco), el texto va en el color normal (clubLabel).
 * - Sin color (blanco, negro, gris): lo seleccionado va en el color del texto.
 * - Si se parece mucho al color de Rotta, Rotta le cede el sitio.
 * - El segundo color solo es adorno (franjas): si no se distingue del fondo o del principal, se usa el principal.
 */
export function buildRottaTheme(style, mode, brand, accent = brand) {
  const theme = THEMES[resolveStyle(style)];
  const base = theme[mode];
  const meanings = THEME_MEANINGS[mode];
  const grounds = [base.surface, base.bg, base.raised];
  const colorless = colorfulness(brand) < COLORLESS;

  const clubSoft = mix(base.surface, colorless ? base.text : brand, mode === "dark" ? 0.16 : 0.1);
  const clubText = colorless ? base.text : readableOnAll(brand, grounds, 4.5);
  const textChange = colorDistance(brand, clubText);
  const clubLabel = textChange > TOO_CHANGED ? base.text : clubText;
  const clubUi = colorless ? base.text : readableOnAll(brand, [...grounds, clubSoft], 3);

  const yields = !colorless && colorDistance(brand, base.rotta) < SIMILAR_COLORS;
  const rotta = yields ? brand : base.rotta;
  const rottaText = yields ? clubText : readableOnAll(base.rottaText, grounds, 4.5);
  const stripe = colorDistance(accent, base.bg) < 8 || colorDistance(accent, brand) < 6 ? brand : accent;

  const warnings = [
    yields && "similar-rotta",
    colorDistance(brand, VOY_GREEN) < SIMILAR_COLORS && "similar-voy",
    colorless && "colorless",
    !colorless && textChange > TOO_CHANGED && "text-adjusted",
    !colorless && contrast(brand, base.surface) < 3 && "low-contrast",
  ].filter(Boolean);

  return {
    style: resolveStyle(style),
    mode,
    shape: theme.shape,
    numbers: theme.numbers,
    decoration: theme.decoration,
    ...base,
    ...meanings,
    club: brand,
    onClub: textOn(brand),
    clubText,
    clubLabel,
    clubUi,
    clubSoft,
    rotta,
    onRotta: textOn(rotta),
    rottaText,
    focus: rottaText,
    stripe,
    warnings,
  };
}

/**
 * Lo que tiene que cumplirse en cualquier tema (WCAG 2.2 AA): [qué es, color, fondo, mínimo].
 * Texto 4,5:1; rayas, iconos, bordes de campos y foco 3:1.
 */
export function themeContrastChecks(theme) {
  return [
    ["Texto sobre fondo", theme.text, theme.bg, 4.5],
    ["Texto sobre tarjeta", theme.text, theme.surface, 4.5],
    ["Texto sobre relleno", theme.text, theme.raised, 4.5],
    ["Texto secundario sobre tarjeta", theme.muted, theme.surface, 4.5],
    ["Texto secundario sobre fondo", theme.muted, theme.bg, 4.5],
    ["Texto secundario sobre relleno", theme.muted, theme.raised, 4.5],
    ["Enlace de Rotta sobre tarjeta", theme.rottaText, theme.surface, 4.5],
    ["Enlace de Rotta sobre fondo", theme.rottaText, theme.bg, 4.5],
    ["Enlace de Rotta sobre relleno", theme.rottaText, theme.raised, 4.5],
    ["Texto sobre insignia de Rotta", theme.onRotta, theme.rotta, 4.5],
    ["Texto del botón del club", theme.onClub, theme.club, 4.5],
    ["Texto en color del club sobre tarjeta", theme.clubLabel, theme.surface, 4.5],
    ["Texto en color del club sobre fondo", theme.clubLabel, theme.bg, 4.5],
    ["Seleccionado: texto sobre su fondo", theme.text, theme.clubSoft, 4.5],
    ["Seleccionado: icono sobre su fondo", theme.clubUi, theme.clubSoft, 3],
    ["Indicador del club sobre tarjeta", theme.clubUi, theme.surface, 3],
    ["Indicador del club sobre fondo", theme.clubUi, theme.bg, 3],
    ["Borde de campo sobre tarjeta", theme.control, theme.surface, 3],
    ["Borde de campo sobre fondo", theme.control, theme.bg, 3],
    ["Foco del teclado sobre fondo", theme.focus, theme.bg, 3],
    ["Foco del teclado sobre tarjeta", theme.focus, theme.surface, 3],
    ["Texto del botón Voy", "#FFFFFF", theme.success, 4.5],
    ["Texto verde sobre tarjeta", theme.successText, theme.surface, 4.5],
    ["Texto del botón de peligro", "#FFFFFF", theme.danger, 4.5],
    ["Texto rojo sobre tarjeta", theme.dangerText, theme.surface, 4.5],
    ["Texto dorado sobre tarjeta", theme.goldText, theme.surface, 4.5],
  ];
}
