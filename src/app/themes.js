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

export const DEFAULT_STYLE = "tinta";

export const THEMES = {
  lima: {
    name: "Rotta Lima",
    description: "Deportivo, moderno y tecnológico",
    shape: { card: "14px", control: "12px" },
    numbers: { width: "78%", weight: 700 },
    decoration: "lineas",
    dark: { bg: "#0A0D0B", surface: "#131814", raised: "#1C231D", line: "#242D25", control: "#5C6B59", text: "#EEF3EA", muted: "#93A08F", rotta: "#C7F23A", rottaText: "#C7F23A" },
    light: { bg: "#F1F4EC", surface: "#FFFFFF", raised: "#E8ECE0", line: "#DCE2D2", control: "#848F78", text: "#11160F", muted: "#5A6553", rotta: "#C7F23A", rottaText: "#4B6A00" },
  },
  naranja: {
    name: "Rotta Naranja",
    description: "Voleibol y personalidad",
    shape: { card: "26px", control: "999px" },
    numbers: { width: "100%", weight: 800 },
    decoration: "balon",
    dark: { bg: "#110C09", surface: "#1B1511", raised: "#261E18", line: "#30261E", control: "#7F6A58", text: "#F8EFE7", muted: "#AE9C8E", rotta: "#FF6B1F", rottaText: "#FF8442" },
    light: { bg: "#F6F2EE", surface: "#FFFFFF", raised: "#EFE8E1", line: "#E5DAD0", control: "#9A8574", text: "#1D140E", muted: "#6D5C4F", rotta: "#F25C05", rottaText: "#B03F00" },
  },
  tinta: {
    name: "Rotta Tinta",
    description: "Elegante, profesional y sobrio",
    shape: { card: "18px", control: "999px" },
    numbers: { width: "90%", weight: 600 },
    decoration: "acta",
    dark: { bg: "#090D18", surface: "#10172A", raised: "#172036", line: "#1F2943", control: "#56638A", text: "#E9EDF6", muted: "#8E99B4", rotta: "#8FA8FF", rottaText: "#A7BAFF" },
    light: { bg: "#F3F4F8", surface: "#FFFFFF", raised: "#EAEDF4", line: "#DCE1EC", control: "#7A859F", text: "#0E1530", muted: "#59627C", rotta: "#1E2F7A", rottaText: "#1E2F7A" },
  },
};

export const STYLES = Object.keys(THEMES);

// Colores con significado: iguales en los tres temas, solo cambian algo entre claro y oscuro.
// El botón «Voy» (success) es #15803D: con texto blanco da 5:1 (el #16A34A de antes daba 3,3:1).
export const THEME_MEANINGS = {
  dark: { success: "#15803D", successText: "#4ADE80", danger: "#DC2626", dangerText: "#FB7185", gold: "#F5C542", goldText: "#F5C542", info: "#38BDF8", calendar: "#E5383B" },
  light: { success: "#15803D", successText: "#15803D", danger: "#DC2626", dangerText: "#B91C1C", gold: "#D99A00", goldText: "#8A6100", info: "#0369A1", calendar: "#E5383B" },
};
