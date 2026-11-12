// Temas de Rotta: cada club elige su color (de una paleta o el suyo propio)
// y cada persona elige claro, oscuro o automático. Todo sale de aquí como variables CSS.

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
