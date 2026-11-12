// Genera src/theme-palette.css: los colores de Tailwind como variables que se invierten en modo claro.
// Así las clases de siempre (text-white, bg-zinc-800, text-amber-200...) funcionan en claro y en oscuro.
// Uso: node tools/generar-colores-tema.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import colors from "tailwindcss/colors.js";

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

const dark = [];
const light = [];
for (const family of FAMILIES) {
  for (const step of STEPS) {
    dark.push(`  --c-${family}-${step}: ${triplet(colors[family][step])};`);
    const lightStep = !NEUTRALS.has(family) && KEEP.has(step) ? step : MIRROR[step];
    light.push(`  --c-${family}-${step}: ${triplet(colors[family][lightStep])};`);
  }
}

const css = `/* Generado por tools/generar-colores-tema.mjs: no se edita a mano. */
:root {
${dark.join("\n")}
}

:root[data-theme="light"] {
${light.join("\n")}
}

/* Dentro de una zona de color (el del club con texto blanco, o un rojo, verde...) se usan los tonos de
   modo oscuro: son los que se leen sobre un fondo fuerte, también con la app en claro. */
:root[data-theme="light"][data-onbrand="light"] .text-onbrand,
:root[data-theme="light"] .text-snow,
:root[data-theme="light"] .force-dark {
${dark.join("\n")}
}

/* Con un color de club claro (amarillo, dorado...) el texto encima es oscuro: tonos de modo claro. */
:root[data-theme="dark"][data-onbrand="dark"] .text-onbrand {
${light.join("\n")}
}
`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
fs.writeFileSync(path.join(root, "src", "theme-palette.css"), css);
console.log(`Escrito src/theme-palette.css (${FAMILIES.length} familias)`);
