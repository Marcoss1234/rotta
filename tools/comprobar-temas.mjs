// Comprueba que los tres temas de Rotta se leen bien con CUALQUIER color de club, en claro y en oscuro.
// Prueba los colores de la paleta, casos difíciles y un barrido de todo el círculo de color,
// cada uno con varios segundos colores, contra los mínimos de themeContrastChecks (WCAG 2.2 AA).
// Si alguna combinación no llega, lo dice y termina con error (código 1).
//
// Uso:  npm run comprobar-temas
//       node tools/comprobar-temas.mjs --avisos       también cuenta los avisos que verá el administrador
//       node tools/comprobar-temas.mjs --sin-reglas   sin los ajustes automáticos (debe fallar: prueba que el script detecta fallos)
import { readdirSync, readFileSync } from "node:fs";
import { buildRottaTheme, contrast, PALETTES, themeContrastChecks } from "../src/app/theme.js";
import { DEFAULT_STYLE, STYLES } from "../src/app/themes.js";

const withoutRules = process.argv.includes("--sin-reglas");
const showWarnings = process.argv.includes("--avisos");

const hsl = (hue, saturation, lightness) => {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};

// Casos difíciles: blanco, negro, gris, amarillo puro, verde de «Voy», y colores casi iguales a los de Rotta.
// Extremos para el escenario: blancos, amarillos y dorados (el resplandor se oscurece) y tonos muy oscuros (el botón
// principal necesita borde).
const HARD = [
  "#FFFFFF", "#000000", "#111827", "#6B7280", "#FFEB00", "#84CC16", "#16A34A", "#F97316", "#FF4D00", "#1E3A8A", "#38BDF8", "#C7F23A", "#1E2F7A", "#8FA8FF",
  "#FAFAFA", "#FFF7D6", "#FFFF00", "#FDE047", "#F5C542", "#E8B923", "#D4A017", "#B8860B",
  "#0B0C0F", "#050A1F", "#1A0000", "#00140A", "#140A1F", "#0A1230", "#170E09", "#0B140D",
];
const sweep = [];
for (let hue = 0; hue < 360; hue += 10) {
  for (const saturation of [0, 40, 75, 100]) {
    for (let lightness = 5; lightness <= 97; lightness += 4) sweep.push(hsl(hue, saturation, lightness));
  }
}
const clubColors = [...new Set([...PALETTES.flatMap((palette) => [palette.brand, palette.accent]), ...HARD, ...sweep].map((color) => color.toUpperCase()))];
const secondColors = (brand) => [brand, "#FFFFFF", "#F5C542"];

// La web (src/app/themes.js) y el servidor (backend/club_settings.py) tienen que permitir los mismos temas
// y el mismo por defecto. (backend/tests/test_club_settings.py lo comprueba también desde Python.)
const backend = readFileSync(new URL("../backend/club_settings.py", import.meta.url), "utf8");
const backendStyles = [...(backend.match(/^ThemeStyle = Literal\[([^\]]*)\]/m)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1]);
const backendDefault = backend.match(/^DEFAULT_STYLE = "([^"]+)"/m)?.[1];
const sameStyles = backendStyles.length > 0 && [...backendStyles].sort().join() === [...STYLES].sort().join() && backendDefault === DEFAULT_STYLE;

// Los componentes comunes (src/app/ui) solo pueden usar colores del tema: nada de hexadecimales ni de las
// familias de Tailwind (zinc, white, emerald...) ni de los alias antiguos (tnt, ember, void).
const UI_DIR = new URL("../src/app/ui/", import.meta.url);
const FIXED = [
  [/#[0-9a-fA-F]{3,8}\b/g, "color en hexadecimal"],
  [/\b(?:bg|text|ring|border|from|via|to|fill|stroke|outline|divide|placeholder|shadow|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|tnt|tntdeep|ember|void|onbrand|onember)\b/g, "color fijo de Tailwind o alias antiguo"],
  [/\brgba?\(/g, "rgb() escrito a mano"],
];
// El segundo color del club es solo de marca y adorno: una pieza común no lo usa para dar información (estados,
// notas, asistencia, errores). Solo el escenario (Stage.jsx) puede llevar la franja (`stripe`) como adorno.
const SECOND_COLOR = /\b(?:bg|text|ring|border|from|via|to|fill|stroke|outline|divide|shadow|decoration|caret)-(?:accent-ui|live-accent|stripe)\b/g;
const fixedColors = readdirSync(UI_DIR)
  .filter((name) => /\.(jsx?|css)$/.test(name))
  .flatMap((name) => {
    const source = readFileSync(new URL(name, UI_DIR), "utf8");
    const fixed = FIXED.flatMap(([pattern, what]) => [...source.matchAll(pattern)].map((match) => `${name}: ${what} «${match[0]}»`));
    const second = [...source.matchAll(SECOND_COLOR)]
      .filter((match) => !(name === "Stage.jsx" && match[0].endsWith("-stripe")))
      .map((match) => `${name}: segundo color del club dando información «${match[0]}»`);
    return [...fixed, ...second];
  });

// Sin reglas: el color del club tal cual en todas partes (lo que pasaría sin theme.js).
const raw = (theme) => ({
  ...theme,
  clubText: theme.club,
  clubLabel: theme.club,
  clubUi: theme.club,
  onClub: contrast(theme.club, "#FFFFFF") >= contrast(theme.club, "#0F1115") ? "#FFFFFF" : "#0F1115",
  accentText: theme.accent,
  accentUi: theme.accent,
  liveClub: theme.club,
  liveAccent: theme.accent,
  clubEdge: theme.club,
  glowClub: theme.club,
  clubOnStage: theme.club,
  stageEdge: theme.club,
});

let total = 0;
const failures = new Map();
const warnings = new Map();
for (const style of STYLES) {
  for (const mode of ["dark", "light"]) {
    for (const brand of clubColors) {
      for (const accent of secondColors(brand)) {
        const built = buildRottaTheme(style, mode, brand, accent);
        const theme = withoutRules ? raw(built) : built;
        for (const [name, color, background, minimum] of themeContrastChecks(theme)) {
          total += 1;
          const ratio = contrast(color, background);
          if (ratio + 1e-9 < minimum) {
            const key = `${style} ${mode === "dark" ? "oscuro" : "claro"} · ${name}`;
            const entry = failures.get(key) ?? { count: 0, example: `club ${brand}: ${ratio.toFixed(2)}:1 (mínimo ${minimum}:1)` };
            entry.count += 1;
            failures.set(key, entry);
          }
        }
        if (accent === brand) {
          for (const warning of built.warnings) {
            const key = `${style} ${mode} · ${warning}`;
            warnings.set(key, (warnings.get(key) ?? 0) + 1);
          }
        }
      }
    }
  }
}

console.log(`Temas: ${STYLES.join(", ")} · claro y oscuro · ${clubColors.length} colores de club · 3 segundos colores${withoutRules ? " · SIN reglas automáticas" : ""}`);
console.log(`${total.toLocaleString("es-ES")} comprobaciones de contraste.`);
if (showWarnings) {
  console.log("\nAvisos que vería el administrador (no son fallos):");
  for (const [key, count] of warnings) console.log(`  ${key}: ${count} colores`);
}
if (sameStyles) {
  console.log(`✓ La web y el servidor permiten los mismos temas (${STYLES.join(", ")}; por defecto ${DEFAULT_STYLE}).`);
} else {
  console.error(`\n✗ Los temas no coinciden: web ${STYLES.join(", ")} (por defecto ${DEFAULT_STYLE}), servidor ${backendStyles.join(", ") || "no encontrados"} (por defecto ${backendDefault ?? "no encontrado"}).`);
  process.exitCode = 1;
}
if (fixedColors.length) {
  console.error(`\n✗ Colores fijos en src/app/ui (tienen que ser del tema):\n  ${fixedColors.join("\n  ")}`);
  process.exitCode = 1;
} else {
  console.log("✓ Los componentes de src/app/ui solo usan colores del tema.");
}
if (failures.size) {
  const count = [...failures.values()].reduce((sum, entry) => sum + entry.count, 0);
  console.error(`\n✗ ${count.toLocaleString("es-ES")} combinaciones no llegan al mínimo:`);
  for (const [key, entry] of failures) console.error(`  ${key}: ${entry.count} casos (p. ej. ${entry.example})`);
  process.exitCode = 1;
} else {
  console.log("✓ Todas las combinaciones cumplen los mínimos.");
}
