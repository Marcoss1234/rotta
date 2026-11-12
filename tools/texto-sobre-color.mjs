// Una vez: marca las zonas con fondo de color para que su texto se lea en claro y en oscuro.
// - Fondo del color del club (bg-tnt, from-tnt...): text-white -> text-onbrand (o se añade).
// - Fondo de un color fuerte (rojo, verde, azul...): text-white -> text-snow (blanco siempre).
// Dentro de esas zonas, src/index.css hace que "white" vuelva a ser el color que se lee encima.
// Uso: node tools/texto-sobre-color.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "app");
const BRAND = /(^|\s)(bg-tnt|from-tnt)(?![\w/-])/;
const STRONG = /(^|\s)(bg|from)-(red|emerald|green|sky|blue|rose|violet|indigo|orange)-(500|600|700)(?![\w/-])/;
const TEXT_COLOR = /(^|\s)text-(white|snow|onbrand|onember|void|tnt|ember|black|zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?=[\s/-]|$)/;

function fix(classes) {
  const brand = BRAND.test(classes);
  const strong = !brand && STRONG.test(classes);
  if (!brand && !strong) return classes;
  const target = brand ? "text-onbrand" : "text-snow";
  if (/(^|\s)text-white(?=[\s/]|$)/.test(classes)) return classes.replace(/(^|\s)text-white(?=[\s/]|$)/g, `$1${target}`);
  if (TEXT_COLOR.test(classes)) return classes;
  return `${classes} ${target}`;
}

let files = 0;
let changes = 0;
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) walk(file);
    else if (name.endsWith(".jsx")) {
      const before = fs.readFileSync(file, "utf8");
      let count = 0;
      const after = before.replace(/(["`])([^"`\n]*?(?:bg-|from-)[^"`\n]*?)\1/g, (match, quote, body) => {
        // Las plantillas con ${...} se tratan por trozos para no tocar el código de dentro.
        const fixed = body
          .split(/(\$\{[^}]*\})/)
          .map((part) => (part.startsWith("${") ? part : fix(part)))
          .join("");
        if (fixed !== body) count += 1;
        return `${quote}${fixed}${quote}`;
      });
      if (after !== before) {
        fs.writeFileSync(file, after);
        files += 1;
        changes += count;
      }
    }
  }
};
walk(root);
console.log(`${changes} cambios en ${files} archivos`);
