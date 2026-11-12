import { COURT_HEIGHT as H, COURT_WIDTH as W, roundCoord } from "@/app/boards.js";
import { MAX_RECORDING_MS, actionDuration, contactTime, takeoffTime } from "@/app/boardRecording.js";

// Jugada por pasos: en cada paso un jugador juega el balón (saca, recibe, coloca…) y lo manda a un punto.
// A partir de ahí se calcula sola la grabación: quién corre a dónde, cuándo vuela el balón y cuándo hace cada gesto.

// Cada toque tiene su velocidad: el remate va como un tiro, la colocación y la recepción van más bombeadas.
const FLIGHT_PACE = { saque: 0.95, recepcion: 1.15, colocacion: 1.05, remate: 0.55, bloqueo: 0.6, defensa: 1.15 };
const START_MS = 400;
const END_PAUSE_MS = 700;
const MIN_RUN_MS = 250;
// Carrera de colocarse: rápida (unos 12 m/s, más de lo real) para que la jugada sea dinámica y siempre llegue.
const RUN_MS_PER_UNIT = 8;

const distance = (a, b) => Math.hypot((a.x - b.x) * W, (a.y - b.y) * H);
// El balón tarda más cuanto más lejos va: un saque cruza la pista en algo más de un segundo y medio.
// Los tiempos de colocación: el 3 tarda bastante más (sube mucho), el menos es casi instantáneo.
const TEMPO_PACE = { 3: 1.75, 2: 1.05, 1: 0.62, menos: 0.42 };
const flightTime = (from, to, action, tempo = null) =>
  Math.round((380 + distance(from, to) * 6.5) * (action === "colocacion" && TEMPO_PACE[tempo] ? TEMPO_PACE[tempo] : FLIGHT_PACE[action] ?? 1));
// El servidor guarda milisegundos enteros (los gestos ajustados a mano dan tiempos con decimales).
const actionItem = (id, time, step) => {
  const t = Math.max(0, Math.round(time));
  return step.action === "colocacion" && step.tempo ? { id, t, action: step.action, tempo: step.tempo } : { id, t, action: step.action };
};
const point = (time, spot) => [Math.max(0, Math.round(time)), roundCoord(spot.x), roundCoord(spot.y)];

// De dónde sale el balón en cada paso: del primer jugador, y luego de donde cayó el anterior.
export function stepOrigins(steps, elements) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const origins = [];
  steps.forEach((step, index) => {
    if (index === 0) {
      const player = byId.get(step.playerId);
      origins.push(player ? { x: player.x, y: player.y } : null);
    } else {
      origins.push(steps[index - 1].target);
    }
  });
  return origins;
}

// Flechas para ver la jugada mientras se prepara: el balón en discontinua y las carreras en continua.
export function planPreview(steps, elements, pendingMoves = []) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const origins = stepOrigins(steps, elements);
  const arrows = [];
  // Dónde está cada uno a medida que avanza la jugada.
  const whereIs = new Map(elements.map((element) => [element.id, { x: element.x, y: element.y }]));
  const moveArrows = (moves, key) => {
    (moves ?? []).forEach((move, moveIndex) => {
      const from = whereIs.get(move.playerId);
      if (!from) return;
      arrows.push({ id: `plan-move-${key}-${moveIndex}`, type: "arrow", style: "move", x1: from.x, y1: from.y, x2: move.target.x, y2: move.target.y });
      whereIs.set(move.playerId, move.target);
    });
  };
  steps.forEach((step, index) => {
    const origin = origins[index];
    const player = whereIs.get(step.playerId) ?? byId.get(step.playerId);
    if (index > 0 && player && origin && distance(player, origin) > 3) {
      arrows.push({ id: `plan-run-${index}`, type: "arrow", style: "move", x1: player.x, y1: player.y, x2: origin.x, y2: origin.y });
    }
    if (index > 0 && origin) whereIs.set(step.playerId, origin);
    if (origin && step.target) {
      arrows.push({ id: `plan-ball-${index}`, type: "arrow", style: "pass", x1: origin.x, y1: origin.y, x2: step.target.x, y2: step.target.y });
    }
    moveArrows(step.moves, index);
  });
  moveArrows(pendingMoves, "next");
  return arrows;
}

// La grabación completa a partir de los pasos. Devuelve también dónde tiene que estar el balón al empezar.
export function buildPlay(steps, elements, ballId) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const first = byId.get(steps[0].playerId);
  const ballStart = { x: Math.min(0.97, first.x + 0.045), y: first.y };
  const ballPoints = [point(0, ballStart)];
  const runs = new Map();
  const actions = [];
  const whereIs = new Map(elements.map((element) => [element.id, { x: element.x, y: element.y }]));

  let lastTime = 0;
  // Los jugadores que se colocan en un paso salen cuando se toca el balón en ese paso.
  const applyMoves = (step, from) => {
    (step.moves ?? []).forEach(({ playerId, target: to }) => {
      const start = whereIs.get(playerId);
      if (!start || distance(start, to) < 1) return;
      const points = runs.get(playerId) ?? [point(0, start)];
      const runStart = Math.max(from, points.at(-1)[0] + 1);
      const runEnd = runStart + Math.max(MIN_RUN_MS, distance(start, to) * RUN_MS_PER_UNIT);
      points.push(point(runStart, start), point(runEnd, to));
      runs.set(playerId, points);
      whereIs.set(playerId, to);
      lastTime = Math.max(lastTime, runEnd);
    });
  };

  let contact = START_MS + contactTime(steps[0].action);
  actions.push(actionItem(steps[0].playerId, START_MS, steps[0]));
  ballPoints.push(point(contact, ballStart));
  let ballAt = ballStart;
  lastTime = contact + actionDuration(steps[0].action);

  for (let index = 1; index <= steps.length; index += 1) {
    applyMoves(steps[index - 1], contact);
    const target = steps[index - 1].target;
    if (!target) break;
    const arrival = contact + flightTime(ballAt, target, steps[index - 1].action, steps[index - 1].tempo);
    ballPoints.push(point(arrival, target));
    lastTime = Math.max(lastTime, arrival);

    const step = steps[index];
    if (step) {
      // El siguiente corre hasta donde cae el balón y llega justo para jugarlo.
      const actionStart = arrival - contactTime(step.action);
      const from = whereIs.get(step.playerId);
      if (from && distance(from, target) > 1) {
        const points = runs.get(step.playerId) ?? [point(0, from)];
        // Sale cuando el balón sale del anterior; si ya venía de correr, desde donde se quedó.
        // Si el gesto salta (remate, bloqueo…), la carrera es su batida: empieza con el gesto y acaba justo
        // al despegar, así nunca va volando de lado.
        const takeoff = takeoffTime(step.action);
        const runStart = Math.max(takeoff === null ? contact : Math.min(contact, actionStart), points.at(-1)[0] + 1);
        const runEnd = takeoff === null ? Math.max(runStart + MIN_RUN_MS, actionStart) : Math.max(runStart + 150, actionStart + takeoff);
        points.push(point(runStart, from), point(runEnd, target));
        runs.set(step.playerId, points);
        whereIs.set(step.playerId, target);
      }
      actions.push(actionItem(step.playerId, Math.max(0, actionStart), step));
      // Un punto repetido separa cada vuelo del balón: así sube y baja en arco en cada toque.
      ballPoints.push(point(arrival + 1, target));
      lastTime = Math.max(lastTime, actionStart + actionDuration(step.action));
    }
    contact = arrival;
    ballAt = target;
  }

  const tracks = [{ id: ballId, points: ballPoints }, ...[...runs].map(([id, points]) => ({ id, points }))];
  const duration = Math.min(MAX_RECORDING_MS, Math.round(lastTime + END_PAUSE_MS));
  return { recording: { duration_ms: duration, tracks, actions }, ballStart };
}
