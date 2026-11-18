// Opciones del personaje. Deben coincidir con backend/characters.py.
// Sin Three.js: lo usan también el editor y la pizarra 2D.

export const SKINS = [
  { id: "s1", hex: "#ecc3a5" },
  { id: "s2", hex: "#f2d2bb" },
  { id: "s3", hex: "#e0b28c" },
  { id: "s4", hex: "#c18a62" },
  { id: "s5", hex: "#8d5a3b" },
  { id: "s6", hex: "#5b3a29" },
];

export const HAIR_STYLES = [
  { id: "corto", label: "Corto" },
  { id: "rapado", label: "Rapado" },
  { id: "tupe", label: "Tupé" },
  { id: "rizos", label: "Rizos" },
  { id: "raya", label: "Raya" },
  { id: "coleta", label: "Coleta" },
  { id: "moño", label: "Moño" },
  { id: "melena", label: "Melena" },
  { id: "trenza", label: "Trenza" },
  { id: "media", label: "Media melena" },
  { id: "calvo", label: "Sin pelo" },
];

export const HAIR_COLORS = [
  { id: "negro", label: "Negro", hex: "#1c1917" },
  { id: "moreno", label: "Moreno", hex: "#2b1d16" },
  { id: "castano-oscuro", label: "Castaño oscuro", hex: "#3b2a20" },
  { id: "castano", label: "Castaño", hex: "#5a3825" },
  { id: "avellana", label: "Avellana", hex: "#7a4e2d" },
  { id: "rubio-oscuro", label: "Rubio oscuro", hex: "#a9773f" },
  { id: "rubio", label: "Rubio", hex: "#c8a165" },
  { id: "pelirrojo", label: "Pelirrojo", hex: "#8c3b1f" },
  { id: "platino", label: "Platino", hex: "#e7dcc0" },
  { id: "gris", label: "Gris", hex: "#9ca3af" },
  { id: "azul", label: "Azul", hex: "#2563eb" },
  { id: "rosa", label: "Rosa", hex: "#ec4899" },
  // De la tienda (`shop` es el objeto que hay que haber comprado). Deben coincidir con backend/shop.py.
  { id: "neon-verde", label: "Verde neón", hex: "#39ff14", shop: "hair:neon-verde" },
  { id: "neon-rosa", label: "Rosa neón", hex: "#ff2bd6", shop: "hair:neon-rosa" },
  { id: "morado", label: "Morado galaxia", hex: "#7c3aed", shop: "hair:morado" },
  { id: "fuego", label: "Rojo fuego", hex: "#e11d1d", shop: "hair:fuego" },
  { id: "plata", label: "Plateado", hex: "#d7dce2", shop: "hair:plata" },
  { id: "oro", label: "Dorado", hex: "#f5c542", shop: "hair:oro" },
];

export const EYES = [
  { id: "round", label: "Redondos" },
  { id: "almond", label: "Rasgados" },
  { id: "smiley", label: "Sonrientes" },
];

export const MOUTHS = [
  { id: "smile", label: "Sonrisa" },
  { id: "grin", label: "Risa" },
  { id: "open", label: "Abierta" },
  { id: "soft", label: "Pequeña" },
  { id: "line", label: "Seria" },
];

export const BEARDS = [
  { id: "none", label: "Nada" },
  { id: "stubble", label: "Sin afeitar" },
  { id: "short", label: "Barba corta" },
  { id: "full", label: "Barba poblada" },
  { id: "moustache", label: "Bigote" },
  { id: "goatee", label: "Perilla" },
  { id: "moustache_goatee", label: "Bigote y perilla" },
];

// Segundo color del pelo ("Sin" = de un solo color) y cómo se reparte.
export const HAIR_COLORS_2 = [{ id: "none", label: "Sin", hex: null }, ...HAIR_COLORS];
export const HAIR_SPLITS = [
  { id: "vertical", label: "Mitad y mitad" },
  { id: "horizontal", label: "Arriba y abajo" },
];

export const ACCENTS = [
  { id: "none", label: "Sin", hex: null },
  { id: "blanco", label: "Blanco", hex: "#f4f4f5" },
  { id: "negro", label: "Negro", hex: "#18181b" },
  { id: "naranja", label: "Naranja", hex: "#ff3800" },
  { id: "azul", label: "Azul", hex: "#2563eb" },
  { id: "rosa", label: "Rosa", hex: "#ec4899" },
  { id: "amarillo", label: "Amarillo", hex: "#facc15" },
  { id: "verde", label: "Verde", hex: "#22c55e" },
  { id: "morado", label: "Morado", hex: "#8b5cf6" },
  { id: "fuego", label: "Rojo fuego", hex: "#e11d1d", shop: "accent:fuego" },
  { id: "neon", label: "Neón", hex: "#39ff14", shop: "accent:neon" },
  { id: "oro", label: "Dorado", hex: "#e8b923", shop: "accent:oro" },
];

export const KNEEPADS = ACCENTS.filter(({ id }) => ["negro", "blanco", "naranja", "azul", "rosa"].includes(id));
// Las zapatillas de la tienda se compran aparte de la cinta y las muñequeras.
export const SHOES = ACCENTS.filter(({ id }) => ["blanco", "negro", "naranja", "azul", "rosa", "amarillo", "neon", "oro"].includes(id)).map((item) =>
  item.shop ? { ...item, shop: `shoes:${item.id}` } : item,
);

// Camisetas especiales (solo de la tienda). Deben coincidir con backend/shop.py.
export const SHIRTS = [
  { id: "normal", label: "La del club" },
  { id: "rayo", label: "Club Rayo", shop: "shirt:rayo" },
  { id: "fuego", label: "Club Fuego", shop: "shirt:fuego" },
  { id: "bomba", label: "Club Bomba", shop: "shirt:bomba" },
  { id: "telarana", label: "Club Telaraña", shop: "shirt:telarana" },
  { id: "cuervo", label: "Club Cuervo", shop: "shirt:cuervo" },
  { id: "oro", label: "Club Oro", shop: "shirt:oro" },
];

// Efectos en la pizarra 3D (de la tienda). Deben coincidir con backend/shop.py.
export const FX_REMATE = [
  { id: "none", label: "Normal" },
  { id: "fuego", label: "Fuego", shop: "remate:fuego" },
  { id: "rayo", label: "Eléctrico", shop: "remate:rayo" },
  { id: "galaxia", label: "Galaxia", shop: "remate:galaxia" },
  { id: "oro", label: "Oro", shop: "remate:oro" },
];
const fxOptions = (action, extra) => [
  { id: "none", label: "Normal" },
  { id: "fuego", label: "Fuego", shop: `${action}:fuego` },
  { id: "rayo", label: "Eléctrico", shop: `${action}:rayo` },
  { id: "galaxia", label: "Galaxia", shop: `${action}:galaxia` },
  { id: "oro", label: "Oro", shop: `${action}:oro` },
  ...extra,
];
export const FX_RECEPCION = fxOptions("recepcion", [{ id: "hielo", label: "Hielo", shop: "recepcion:hielo" }]);
export const FX_COLOCACION = fxOptions("colocacion", [{ id: "estrellas", label: "Estrellas", shop: "colocacion:estrellas" }]);

export const GLASSES = [
  { id: "none", label: "Sin gafas" },
  { id: "redondas", label: "Redondas", shop: "glasses:redondas" },
  { id: "sol", label: "De sol", shop: "glasses:sol" },
  { id: "deporte", label: "Deportivas", shop: "glasses:deporte" },
];

// Lo que se puede elegir sin comprar nada (para el azar).
const free = (list) => list.filter((item) => !item.shop);

export const BUILDS = [
  { id: "male", label: "Chico" },
  { id: "female", label: "Chica" },
];

export const CELEBRATIONS = [
  { id: "brazos", label: "Salto con los brazos arriba" },
  { id: "puno", label: "Puño cerrado" },
  { id: "baile", label: "Baile" },
  { id: "avion", label: "Avión" },
  { id: "giro", label: "Salto con giro" },
];

// Personajes guardados con opciones que ya no existen: la celebración del remate pasa a brazos
// arriba y la barba de antes ("beard") a barba corta. Lo nuevo empieza con su valor de siempre.
export const normalizeLook = (look) =>
  look && {
    ...look,
    celebration: CELEBRATIONS.some((item) => item.id === look.celebration) ? look.celebration : "brazos",
    beard: look.beard === "beard" ? "short" : look.beard ?? "none",
    hair_color2: look.hair_color2 ?? "none",
    hair_split: look.hair_split ?? "vertical",
    eyeliner: Boolean(look.eyeliner),
    glasses: look.glasses ?? "none",
    shirt: look.shirt ?? "normal",
    fx_remate: look.fx_remate ?? "none",
    fx_recepcion: look.fx_recepcion ?? "none",
    fx_colocacion: look.fx_colocacion ?? "none",
  };

const byId = (list, id, fallback = list[0]) => list.find((item) => item.id === id) ?? fallback;
export const skinHex = (id) => byId(SKINS, id).hex;
export const hairHex = (id) => byId(HAIR_COLORS, id).hex;
export const hairHex2 = (id) => (id && id !== "none" ? byId(HAIR_COLORS, id, null)?.hex ?? null : null);
export const accentHex = (id) => byId(ACCENTS, id, ACCENTS[0]).hex;

// El mismo azar de siempre: a cada jugador sin personaje le sale siempre la misma cara y el mismo pelo.
export function seededRandom(key) {
  let hash = 2166136261;
  for (const char of String(key)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
}
const pick = (random, list) => list[Math.floor(random() * list.length) % list.length];

// La lista antigua de colores (con el negro dos veces): así no le cambia la cara a nadie.
const SEED_HAIR = ["negro", "negro", "moreno", "castano-oscuro", "castano", "avellana", "rubio-oscuro", "rubio", "pelirrojo"];

export function lookFromSeed(seed, female) {
  const random = seededRandom(seed);
  const hairColor = pick(random, SEED_HAIR);
  const eyes = pick(random, ["round", "almond", "smiley"]);
  const mouth = pick(random, female ? ["smile", "smile", "open", "soft"] : ["smile", "line", "grin", "soft"]);
  const blush = female ? random() < 0.8 : random() < 0.25;
  const freckles = random() < 0.18;
  const hair = pick(random, female ? ["coleta", "moño", "melena", "trenza", "media"] : ["corto", "rapado", "tupe", "rizos", "raya"]);
  return {
    build: female ? "female" : "male",
    skin: "s1",
    hair,
    hair_color: hairColor,
    eyes,
    mouth,
    beard: "none",
    freckles,
    blush,
    headband: "none",
    wristbands: "none",
    kneepads: "negro",
    shoes: "blanco",
    celebration: "brazos",
    weight: 50,
    muscle: 50,
    hair_color2: "none",
    hair_split: "vertical",
    eyeliner: false,
    glasses: "none",
    shirt: "normal",
    fx_remate: "none",
    fx_recepcion: "none",
    fx_colocacion: "none",
  };
}

// Uno al azar para el botón de "Sorpréndeme".
export function randomLook(current) {
  const random = Math.random;
  const female = current.build === "female";
  return {
    ...current,
    skin: pick(random, SKINS).id,
    hair: pick(random, HAIR_STYLES).id,
    hair_color: pick(random, free(HAIR_COLORS)).id,
    eyes: pick(random, EYES).id,
    mouth: pick(random, MOUTHS).id,
    beard: female ? "none" : pick(random, BEARDS).id,
    freckles: random() < 0.25,
    blush: random() < (female ? 0.7 : 0.3),
    headband: random() < 0.4 ? pick(random, free(ACCENTS).slice(1)).id : "none",
    wristbands: random() < 0.4 ? pick(random, free(ACCENTS).slice(1)).id : "none",
    kneepads: pick(random, KNEEPADS).id,
    shoes: pick(random, free(SHOES)).id,
    // Lo comprado (pelo especial, gafas…) se queda como estaba.
    ...(current.glasses ? { glasses: current.glasses } : {}),
  };
}

export const sameLook = (a, b) => JSON.stringify(a) === JSON.stringify(b);
