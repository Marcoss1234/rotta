// Ritmo de cada gesto: qué postura clave toca en cada momento (de 0 a 1), cuánto dura y cómo es el salto.
// Sin Three.js: lo usan el muñeco, el jugador real, la grabación de jugadas y el editor de gestos.
// Los tiempos que ajustes en el editor se guardan en gesture-times.json y mandan sobre estos.
import savedTimes from "@/app/character/gesture-times.json";
import savedCaptures from "@/app/character/captured-gestures.json";

export const ACTION_KEYS = {
  saque: { keys: [[0, "stand"], [0.32, "serveToss"], [0.48, "serveToss"], [0.55, "serveHit"], [0.78, "serveFollow"], [1, "stand"]], jump: [0.3, 0.85, 0.22] },
  recepcion: { keys: [[0, "ready"], [0.22, "receptionLoad"], [0.42, "reception"], [0.66, "receptionFollow"], [1, "ready"]] },
  colocacion: { keys: [[0, "ready"], [0.2, "set"], [0.42, "set"], [0.56, "setPush"], [0.7, "setFollow"], [1, "ready"]], jump: [0.5, 0.8, 0.08] },
  remate: { keys: [[0, "ready"], [0.12, "spikeLoad"], [0.22, "spikeRise"], [0.32, "spikeArm"], [0.46, "spikeArm"], [0.53, "spikeHit"], [0.7, "spikeFollow"], [0.88, "land"], [1, "ready"]], jump: [0.16, 0.88, 0.8] },
  bloqueo: { keys: [[0, "ready"], [0.14, "blockLoad"], [0.32, "block"], [0.5, "blockReach"], [0.66, "block"], [0.86, "land"], [1, "ready"]], jump: [0.16, 0.86, 0.6] },
  defensa: { keys: [[0, "ready"], [0.22, "digLow"], [0.42, "digLow"], [0.62, "digDive"], [0.85, "digDive"], [1, "ready"]] },
  // Las del perfil.
  toques: { keys: [[0, "bumpReady"], [0.42, "bumpHit"], [0.56, "bumpHit"], [1, "bumpReady"]] },
  dedos: { keys: [[0, "set"], [0.4, "setPush"], [0.56, "setPush"], [1, "set"]] },
  brazos: { keys: [[0, "ready"], [0.2, "blockLoad"], [0.42, "cheer"], [0.78, "cheer"], [0.9, "land"], [1, "ready"]], jump: [0.22, 0.86, 0.5] },
  puno: { keys: [[0, "ready"], [0.18, "fistLoad"], [0.34, "fistPump"], [0.5, "fistLoad"], [0.66, "fistPump"], [0.82, "fistLoad"], [1, "ready"]] },
  // Baile: el peso de un lado a otro con un brazo arriba, cambiando al ritmo.
  baile: { keys: [[0, "ready"], [0.12, "danceA"], [0.25, "danceB"], [0.38, "danceA"], [0.5, "danceB"], [0.62, "danceA"], [0.75, "danceB"], [0.88, "danceA"], [1, "ready"]] },
  // Avión: brazos en cruz, inclinándose a un lado y a otro.
  avion: { keys: [[0, "ready"], [0.15, "planeLevel"], [0.3, "planeA"], [0.5, "planeB"], [0.7, "planeA"], [0.85, "planeLevel"], [1, "ready"]] },
  // Salto con giro: se agacha, salta con los brazos arriba dando una vuelta entera y cae.
  giro: { keys: [[0, "ready"], [0.18, "blockLoad"], [0.38, "cheer"], [0.72, "cheer"], [0.86, "land"], [1, "ready"]], jump: [0.2, 0.84, 0.45] },
};

// Duración de cada gesto si no se ha ajustado (en milisegundos).
export const DEFAULT_DURATIONS = {
  saque: 1000, recepcion: 750, colocacion: 750, remate: 950, bloqueo: 850, defensa: 850,
  toques: 1000, dedos: 950, remate_perfil: 1700, brazos: 1500, puno: 1500, baile: 1700, avion: 1800, giro: 1300,
};

// El editor cambia este objeto en vivo mientras ajustas, para verlo al reproducir.
export const customTimes = { ...savedTimes };

// En el ordenador, al guardar tiempos desde el editor se actualizan aquí sin recargar ninguna página.
if (import.meta.hot) {
  import.meta.hot.accept("./gesture-times.json", (updated) => {
    if (!updated) return;
    Object.keys(customTimes).forEach((key) => delete customTimes[key]);
    Object.assign(customTimes, updated.default);
  });
}

// Gestos sacados de un vídeo (herramienta de captura): una postura por fotograma. Si existe, manda sobre
// las posturas hechas a mano. Formato: { duration (ms), hit (0-1, momento del toque), frames: [postura…] }.
export const capturedGestures = { ...savedCaptures };
if (import.meta.hot) {
  import.meta.hot.accept("./captured-gestures.json", (updated) => {
    if (!updated) return;
    Object.keys(capturedGestures).forEach((key) => delete capturedGestures[key]);
    Object.assign(capturedGestures, updated.default);
  });
}
export const capturedOf = (action) => (capturedGestures[action]?.frames?.length ? capturedGestures[action] : null);

export const gesturePlan = (action) => customTimes[action] ?? ACTION_KEYS[action];

// Las posturas que añades en el editor: de cuál de serie parten y cómo se llaman.
export function baseOf(name) {
  for (const plan of Object.values(customTimes)) {
    if (plan?.bases?.[name]) return plan.bases[name];
  }
  return null;
}
export function labelOf(name) {
  for (const plan of Object.values(customTimes)) {
    if (plan?.labels?.[name]) return plan.labels[name];
  }
  return null;
}
// Las posturas de un gesto, en orden y sin repetir.
export const gestureKeys = (action) => [...new Set(gesturePlan(action).keys.map(([, name]) => name))];
export const gestureDuration = (action, fallback) =>
  capturedOf(action)?.duration ?? customTimes[action]?.duration ?? fallback ?? DEFAULT_DURATIONS[action] ?? 800;

// La postura en la que se toca el balón: con tiempos propios, el contacto cae en ese momento.
const HIT_KEY = { remate: "spikeHit", saque: "serveHit", colocacion: "setPush", recepcion: "reception", bloqueo: "blockReach", defensa: "digDive" };
export function hitFraction(action) {
  const captured = capturedOf(action);
  if (captured && Number.isFinite(captured.hit)) return captured.hit;
  const plan = customTimes[action];
  if (!plan) return null;
  const key = plan.keys.find(([, name]) => name === HIT_KEY[action]);
  return key ? key[0] : null;
}

// En qué momento del gesto (0-1) deja el suelo, o null si no salta.
export function takeoffFraction(action) {
  const captured = capturedOf(action);
  if (captured) return Number.isFinite(captured.takeoff) ? captured.takeoff : null;
  const jump = gesturePlan(action)?.jump;
  return jump && jump[2] > 0 ? jump[0] : null;
}

// Altura del salto en este momento. `hang` por debajo de 1 hace que aguante más arriba.
export function jumpAt(plan, progress) {
  const [start, end, height] = plan.jump ?? [0, 1, 0];
  const air = Math.min(1, Math.max(0, (progress - start) / (end - start)));
  return height * Math.pow(Math.sin(Math.PI * air), plan.hang ?? 1);
}
