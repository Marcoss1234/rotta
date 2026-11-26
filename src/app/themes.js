// Los tres temas de Rotta: tres apariencias de la misma app (misma estructura, letras y funciones).
// Solo datos: los cálculos con el color del club están en theme.js y los comprueba tools/comprobar-temas.mjs.
// Para añadir un tema, se añade aquí una entrada con sus dos modos y se pasa `npm run comprobar-temas`.
//
// Cada modo tiene:
//   bg       fondo de la pantalla           surface  tarjetas             raised   rellenos dentro de tarjetas
//   line     líneas finas de adorno          control  borde de campos y casillas (mínimo 3:1)
//   text     texto                           muted    texto secundario (mínimo 4,5:1)
//   rotta    color propio de Rotta (rellenos: insignias, marcas)
//   rottaText  el color de Rotta cuando es texto o icono (enlaces), ya legible sobre los fondos
//   overlay  ventanas, menús y barra de navegación (por encima de las tarjetas)
//   hair     la línea de luz arriba de cada tarjeta («none» si esa identidad no la lleva)
//   shadow   sombra de las tarjetas · overlayShadow  la de las ventanas · cardBorder  «line» o «none»
//
// Premium deportivo: además de los colores, cada identidad tiene su personalidad (rasgos que no son color):
//   radius     esquinas: card (tarjeta), inner (pieza dentro de una tarjeta), control (botones), chip
//   numbers    números de marcador: width (anchura de Bricolage), weight, tracking (espacio entre letras)
//   titles     títulos: width y weight
//   depth      cómo se separan las superficies: «plana» (bordes), «volumen» (sombras), «cristal» (línea de luz)
//   selected   cómo se marca lo elegido: «barra» (tono suave y raya abajo), «relleno» (color del club entero),
//              «contorno» (tono suave y borde)
//   decoration adorno del escenario: «lineas» (de pista), «balon» (costuras), «acta» (cuadrícula del acta)
//   glow       fuerza del resplandor del club en el escenario (0 a 1)
//   chart      gráficas: line (grosor), point («cuadrado», «redondo», «hueco»), grid («discontinua»,
//              «ninguna», «continua»), cap (final de la línea y de las barras: «recto» o «redondo»)
//   motion     animaciones: ms y ease (se apagan con «reducir movimiento»)
//   stage      el escenario: siempre oscuro, también con la app en claro (bg, text, muted, line)
// `shape` y `numbers` de antes se mantienen (los usan pantallas y la vista previa): valen lo mismo que
// radius.card/control y numbers.width/weight.

export const DEFAULT_STYLE = "tinta";

export const THEMES = {
  lima: {
    name: "Rotta Lima",
    traits: ["Esquinas más rectas", "Números estrechos de marcador", "Fondos con un toque verde"],
    description: "Deportivo, moderno y tecnológico",
    shape: { card: "12px", control: "10px" },
    numbers: { width: "76%", weight: 700, tracking: "-0.01em" },
    decoration: "lineas",
    radius: { card: "12px", inner: "8px", control: "10px", chip: "8px" },
    titles: { width: "80%", weight: 700 },
    depth: "plana",
    selected: "barra",
    glow: 0.3,
    chart: { line: 1.5, point: "cuadrado", grid: "discontinua", cap: "recto" },
    motion: { ms: 120, ease: "ease-out" },
    stage: { bg: "#0B140D", text: "#EEF3EA", muted: "#A9B6A5", line: "#26332A" },
    dark: {
      bg: "#0A0D0B", surface: "#131814", raised: "#1C231D", line: "#242D25", control: "#6A7867", text: "#EEF3EA", muted: "#93A08F", rotta: "#C7F23A", rottaText: "#C7F23A",
      overlay: "#1E2720", hair: "none", shadow: "none", overlayShadow: "0 0 0 1px rgb(255 255 255 / 0.06), 0 24px 48px -16px rgb(0 0 0 / 0.7)", cardBorder: "line",
    },
    light: {
      bg: "#F1F4EC", surface: "#FFFFFF", raised: "#E8ECE0", line: "#D3DAC7", control: "#7F8973", text: "#11160F", muted: "#5A6553", rotta: "#C7F23A", rottaText: "#4B6A00",
      overlay: "#FFFFFF", hair: "none", shadow: "0 1px 0 rgb(17 22 15 / 0.08)", overlayShadow: "0 0 0 1px rgb(17 22 15 / 0.08), 0 24px 48px -20px rgb(17 22 15 / 0.3)", cardBorder: "line",
    },
  },
  naranja: {
    name: "Rotta Naranja",
    traits: ["Formas redondas", "Números anchos y con peso", "Fondos cálidos"],
    description: "Voleibol y personalidad",
    shape: { card: "26px", control: "999px" },
    numbers: { width: "100%", weight: 800, tracking: "-0.03em" },
    decoration: "balon",
    radius: { card: "26px", inner: "18px", control: "999px", chip: "999px" },
    titles: { width: "96%", weight: 800 },
    depth: "volumen",
    selected: "relleno",
    glow: 0.4,
    chart: { line: 3, point: "redondo", grid: "ninguna", cap: "redondo" },
    motion: { ms: 220, ease: "cubic-bezier(0.3, 1.3, 0.5, 1)" },
    stage: { bg: "#170E09", text: "#F8EFE7", muted: "#C2B1A3", line: "#36291F" },
    dark: {
      bg: "#110C09", surface: "#1B1511", raised: "#261E18", line: "#30261E", control: "#7F6A58", text: "#F8EFE7", muted: "#AE9C8E", rotta: "#FF6B1F", rottaText: "#FF8442",
      overlay: "#2A201A", hair: "rgb(255 255 255 / 0.04)", shadow: "0 18px 40px -22px rgb(0 0 0 / 0.8)", overlayShadow: "0 28px 56px -18px rgb(0 0 0 / 0.8)", cardBorder: "none",
    },
    light: {
      bg: "#F6F2EE", surface: "#FFFFFF", raised: "#EFE8E1", line: "#E5DAD0", control: "#94806F", text: "#1D140E", muted: "#6D5C4F", rotta: "#F25C05", rottaText: "#B03F00",
      overlay: "#FFFFFF", hair: "none", shadow: "0 2px 4px rgb(60 30 10 / 0.05), 0 18px 40px -20px rgb(60 30 10 / 0.28)", overlayShadow: "0 4px 8px rgb(60 30 10 / 0.06), 0 32px 64px -24px rgb(60 30 10 / 0.35)", cardBorder: "none",
    },
  },
  tinta: {
    name: "Rotta Tinta",
    traits: ["Formas suaves", "Números finos y elegantes", "Fondos azul tinta"],
    description: "Elegante, profesional y sobrio",
    shape: { card: "20px", control: "999px" },
    numbers: { width: "90%", weight: 600, tracking: "-0.02em" },
    decoration: "acta",
    radius: { card: "20px", inner: "12px", control: "999px", chip: "999px" },
    titles: { width: "88%", weight: 650 },
    depth: "cristal",
    selected: "contorno",
    glow: 0.45,
    chart: { line: 2, point: "hueco", grid: "continua", cap: "redondo" },
    motion: { ms: 180, ease: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    stage: { bg: "#0A1230", text: "#F4F6FB", muted: "#AEB8D2", line: "#24305A" },
    dark: {
      bg: "#090D18", surface: "#10172A", raised: "#172036", line: "#1F2943", control: "#6A779C", text: "#E9EDF6", muted: "#8E99B4", rotta: "#8FA8FF", rottaText: "#A7BAFF",
      overlay: "#1B2742", hair: "rgb(255 255 255 / 0.07)", shadow: "none", overlayShadow: "0 0 0 1px rgb(255 255 255 / 0.06), 0 24px 48px -16px rgb(0 0 0 / 0.7)", cardBorder: "line",
    },
    light: {
      bg: "#F3F4F8", surface: "#FFFFFF", raised: "#EAEDF4", line: "#DCE1EC", control: "#7A859F", text: "#0E1530", muted: "#59627C", rotta: "#1E2F7A", rottaText: "#1E2F7A",
      overlay: "#FFFFFF", hair: "none", shadow: "0 1px 2px rgb(14 21 48 / 0.05), 0 14px 32px -18px rgb(14 21 48 / 0.22)", overlayShadow: "0 0 0 1px rgb(14 21 48 / 0.06), 0 28px 56px -20px rgb(14 21 48 / 0.32)", cardBorder: "line",
    },
  },
};

export const STYLES = Object.keys(THEMES);

// Colores con significado: iguales en los tres temas, solo cambian algo entre claro y oscuro.
// El botón «Voy» (success) es #15803D: con texto blanco da 5:1 (el #16A34A de antes daba 3,3:1).
// El rojo de calendario (la cabecera de DateBadge) es #D42A2E: con texto blanco da 5:1 (el #E5383B daba 4,2:1).
export const THEME_MEANINGS = {
  dark: { success: "#15803D", successText: "#4ADE80", danger: "#DC2626", dangerText: "#FB7185", gold: "#F5C542", goldText: "#F5C542", warning: "#D97706", warningText: "#FBBF24", info: "#38BDF8", calendar: "#D42A2E" },
  light: { success: "#15803D", successText: "#166534", danger: "#DC2626", dangerText: "#B91C1C", gold: "#D99A00", goldText: "#8A6100", warning: "#D97706", warningText: "#92400E", info: "#0369A1", calendar: "#D42A2E" },
};
