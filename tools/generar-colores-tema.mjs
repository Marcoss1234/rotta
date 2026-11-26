// Genera src/theme-palette.css: los colores de Tailwind como variables que se invierten en modo claro,
// y los seis bloques de los temas de Rotta (Lima, Naranja y Tinta × claro y oscuro, de src/app/themes.js).
// Así las clases de siempre (text-white, bg-zinc-800, text-amber-200...) funcionan en claro y en oscuro,
// y los grises (zinc, slate, gray...) toman el tono de cada tema sin tocar las pantallas.
// Uso: node tools/generar-colores-tema.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import colors from "tailwindcss/colors.js";

import { DEFAULT_STYLE, THEME_MEANINGS, THEMES } from "../src/app/themes.js";
import { FAMILIES } from "./tema-familias.js";

const STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
// En claro, cada tono se cambia por su opuesto: un gris claro sobre negro pasa a gris oscuro sobre blanco.
const MIRROR = { 50: "950", 100: "900", 200: "800", 300: "700", 400: "600", 500: "500", 600: "400", 700: "300", 800: "200", 900: "100", 950: "50" };

// Los tonos medios de los colores (500-700) no se invierten: son fondos de botones y avisos con texto blanco.
const NEUTRALS = new Set(["slate", "gray", "zinc", "neutral", "stone"]);
const KEEP = new Set(["500", "600", "700"]);

const triplet = (hex) => {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16)).join(" ");
};

// ---------- Grises con el tono de cada tema (OKLab: misma claridad que el gris de Tailwind, otro matiz) ----------
const toLinear = (value) => {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};
const toGamma = (value) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
function hexToOklab(hex) {
  const clean = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((index) => toLinear(Number.parseInt(clean.slice(index, index + 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToHex([lightness, a, b]) {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return `#${rgb.map((value) => Math.round(Math.min(1, Math.max(0, toGamma(value))) * 255).toString(16).padStart(2, "0")).join("")}`;
}
/** El gris de Tailwind con la claridad de siempre y el matiz del texto secundario del tema (menos color en los casi blancos). */
function tintedGray(hex, tint) {
  const [lightness] = hexToOklab(hex);
  const [, a, b] = hexToOklab(tint);
  const fade = 1 - Math.max(0, (lightness - 0.85) / 0.15) * 0.6;
  return oklabToHex([lightness, a * fade, b * fade]);
}

// ---------- Bloques ----------
const familyLines = (family, light, tint) =>
  STEPS.map((step) => {
    const source = colors[family][light && (NEUTRALS.has(family) || !KEEP.has(step)) ? MIRROR[step] : step];
    const value = NEUTRALS.has(family) && tint ? tintedGray(source, tint) : source;
    return `  --c-${family}-${step}: ${triplet(value)};`;
  });
const palette = (light, tint) => FAMILIES.flatMap((family) => familyLines(family, light, tint));
const neutrals = (light, tint) => FAMILIES.filter((family) => NEUTRALS.has(family)).flatMap((family) => familyLines(family, light, tint));

// Los nombres de siempre (void, surface, panel, white) y los nuevos (raised, line, control, muted...).
function semantic(mode) {
  const meanings = THEME_MEANINGS[mode];
  return (theme) => [
    `  --c-void: ${triplet(theme.bg)};`,
    `  --c-surface: ${triplet(theme.surface)};`,
    `  --c-panel: ${triplet(theme.surface)};`,
    `  --c-raised: ${triplet(theme.raised)};`,
    `  --c-line: ${triplet(theme.line)};`,
    `  --c-control: ${triplet(theme.control)};`,
    `  --c-white: ${triplet(theme.text)};`,
    `  --c-muted: ${triplet(theme.muted)};`,
    `  --c-success: ${triplet(meanings.success)};`,
    `  --c-success-text: ${triplet(meanings.successText)};`,
    `  --c-danger: ${triplet(meanings.danger)};`,
    `  --c-danger-text: ${triplet(meanings.dangerText)};`,
    `  --c-gold: ${triplet(meanings.gold)};`,
    `  --c-gold-text: ${triplet(meanings.goldText)};`,
    `  --c-calendar: ${triplet(meanings.calendar)};`,
    `  --c-warning: ${triplet(meanings.warning)};`,
    `  --c-warning-text: ${triplet(meanings.warningText)};`,
    // Premium deportivo: ventanas y profundidad de las tarjetas (cada identidad a su manera). Nombres nuevos
    // (--shadow-depth, --card-border, --hair): --shadow-card sigue siendo el de siempre hasta migrar las piezas.
    `  --c-overlay: ${triplet(theme.overlay)};`,
    `  --hair: ${theme.hair === "none" ? "transparent" : theme.hair};`,
    `  --shadow-depth: ${theme.shadow === "none" ? "0 0 #0000" : theme.shadow};`,
    `  --shadow-overlay: ${theme.overlayShadow};`,
    `  --card-border: ${theme.cardBorder === "line" ? "rgb(var(--c-line))" : "transparent"};`,
  ];
}

// Lo que no depende del modo: la personalidad de cada identidad y el escenario (siempre oscuro).
const personality = (theme) => [
  `  --radius-card: ${theme.radius.card};`,
  `  --radius-inner: ${theme.radius.inner};`,
  `  --radius-control: ${theme.radius.control};`,
  `  --radius-chip: ${theme.radius.chip};`,
  `  --num-width: ${theme.numbers.width};`,
  `  --num-weight: ${theme.numbers.weight};`,
  `  --num-tracking: ${theme.numbers.tracking};`,
  `  --title-width: ${theme.titles.width};`,
  `  --title-weight: ${theme.titles.weight};`,
  `  --glow: ${theme.glow};`,
  `  --motion: ${theme.motion.ms}ms;`,
  `  --ease: ${theme.motion.ease};`,
  `  --chart-line: ${theme.chart.line}px;`,
  `  --c-stage: ${triplet(theme.stage.bg)};`,
  `  --c-stage-ink: ${triplet(theme.stage.text)};`,
  `  --c-stage-muted: ${triplet(theme.stage.muted)};`,
  `  --c-stage-line: ${triplet(theme.stage.line)};`,
];
const block = (selectors, lines) => `${selectors.join(",\n")} {\n${lines.join("\n")}\n}\n`;

const fallback = THEMES[DEFAULT_STYLE];
const out = [
  "/* Generado por tools/generar-colores-tema.mjs: no se edita a mano. */",
  `/* Sin tema elegido (antes de que arranque la app) vale ${DEFAULT_STYLE}. */`,
  block([":root"], palette(false, fallback.dark.muted)),
  block([':root[data-theme="light"]'], palette(true, fallback.light.muted)),
  "/* Dentro de una zona de color (el del club con texto blanco, o un rojo, verde...) se usan los tonos de\n   modo oscuro: son los que se leen sobre un fondo fuerte, también con la app en claro. */",
  block([':root[data-theme="light"][data-onbrand="light"] .text-onbrand', ':root[data-theme="light"] .text-snow', ':root[data-theme="light"] .force-dark'], palette(false, fallback.dark.muted)),
  "/* Con un color de club claro (amarillo, dorado...) el texto encima es oscuro: tonos de modo claro. */",
  block([':root[data-theme="dark"][data-onbrand="dark"] .text-onbrand'], palette(true, fallback.light.muted)),
];

for (const [style, theme] of Object.entries(THEMES)) {
  const root = `:root[data-rotta="${style}"]`;
  const light = `${root}[data-theme="light"]`;
  out.push(`/* ---------- ${theme.name}: ${theme.description} ---------- */`);
  out.push(
    block([root], [
      ...neutrals(false, theme.dark.muted),
      ...semantic("dark")(theme.dark),
      ...personality(theme),
    ]),
  );
  out.push(block([light], [...neutrals(true, theme.light.muted), ...semantic("light")(theme.light)]));
  out.push(block([`${light}[data-onbrand="light"] .text-onbrand`, `${light} .text-snow`], neutrals(false, theme.dark.muted)));
  // La pista, la pizarra y el directo van siempre en oscuro: con los colores oscuros de este mismo tema.
  out.push(block([`${light} .force-dark`], [...neutrals(false, theme.dark.muted), ...semantic("dark")(theme.dark)]));
  out.push(block([`${root}[data-theme="dark"][data-onbrand="dark"] .text-onbrand`], neutrals(true, theme.light.muted)));
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
fs.writeFileSync(path.join(projectRoot, "src", "theme-palette.css"), out.join("\n"));
console.log(`Escrito src/theme-palette.css (${FAMILIES.length} familias, ${Object.keys(THEMES).length} temas × claro y oscuro)`);
