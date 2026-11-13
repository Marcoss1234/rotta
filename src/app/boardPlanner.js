import { COURT_HEIGHT as H, COURT_WIDTH as W, roundCoord } from "@/app/boards.js";
import { MAX_RECORDING_MS, actionDuration, contactTime, takeoffTime } from "@/app/boardRecording.js";

// Jugada por pasos: en cada paso un jugador juega el balón (saca, recibe, coloca…) y lo manda a un punto.
// A partir de ahí se calcula sola la grabación: quién corre a dónde, cuándo vuela el balón y cuándo hace cada gesto.

// Cada toque tiene su velocidad: el remate va como un tiro, la colocación y la recepción van más bombeadas.
const FLIGHT_PACE = { saque: 0.95, recepcion: 1.15, colocacion: 1.05, remate: 0.55, bloqueo: 0.6, defensa: 1.15, free: 1.3, fuerte: 0.5 };
const START_MS = 400;
// "Balón nuevo": el anterior se queda donde cayó y, tras esta pausa, quien juega saca otro de la mano.
const FRESH_PAUSE_MS = 700;
// Como en el servidor: los pasos que se guardan de una jugada.
const MAX_PLAN_STEPS = 60;
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

// De dónde sale el balón en cada paso: del primer jugador, y luego de donde cayó el anterior
// (con balón nuevo, del que lo juega: null aquí, porque depende de dónde esté en ese momento).
export function stepOrigins(steps, elements) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const origins = [];
  steps.forEach((step, index) => {
    if (index === 0) {
      const player = byId.get(step.playerId);
      origins.push(player ? { x: player.x, y: player.y } : null);
    } else {
      origins.push(step.fresh ? null : steps[index - 1].target);
    }
  });
  return origins;
}

// Flechas para ver la jugada mientras se prepara: el balón en discontinua y las carreras en continua.
// Con muchos pasos (un ejercicio en fila) solo se ven los últimos, para que no se llene la pista de flechas.
const PREVIEW_STEPS = 4;
export function planPreview(steps, elements, pendingMoves = []) {
  const arrows = [];
  const runArrow = (id, from, to) => {
    if (from && to && distance(from, to) > 3) arrows.push({ id, type: "arrow", style: "move", x1: from.x, y1: from.y, x2: to.x, y2: to.y });
  };
  const shownFrom = steps.length - PREVIEW_STEPS;
  const whereIs = walkPlan(steps, elements, ({ step, index, origin, from, moves, back }) => {
    if (index < shownFrom) return;
    if (index > 0 && !step.fresh) runArrow(`plan-run-${index}`, from, origin);
    if (origin && step.target) {
      arrows.push({ id: `plan-ball-${index}`, type: "arrow", style: "pass", x1: origin.x, y1: origin.y, x2: step.target.x, y2: step.target.y });
    }
    moves.forEach((move, moveIndex) => runArrow(`plan-move-${index}-${moveIndex}`, move.from, move.target));
    back.forEach((move, moveIndex) => runArrow(`plan-back-${index}-${moveIndex}`, move.from, move.target));
  });
  (pendingMoves ?? []).forEach((move, moveIndex) => runArrow(`plan-move-next-${moveIndex}`, whereIs.get(move.playerId), move.target));
  return arrows;
}

// ---------- Ejercicios en fila ----------
// Jugadores del mismo campo a menos de 1,3 m unos de otros forman una fila. Si el que juega "vuelve a la fila",
// se va al final y los demás avanzan un puesto, como en el entreno.
// Las filas se crean con el botón "Fila": cada jugador lleva el nombre de su fila (`line`).
export function findLines(elements) {
  const groups = new Map();
  elements.forEach((element) => {
    if (element.type === "token" && element.line) groups.set(element.line, [...(groups.get(element.line) ?? []), element]);
  });
  return [...groups.values()];
}

function createLines(elements) {
  const lineOf = new Map();
  findLines(elements).forEach((members) => {
    const rule = members[0].line_rule === "remate" ? "remate" : "toque";
    // Al rematar el orden es el de la fila tal como se creó: el último es el que espera para entrar.
    const line = rule === "remate"
      ? { members, rule, order: members.map((member) => member.id), slots: members.map((member) => ({ x: member.x, y: member.y })) }
      : { members, rule, order: null, slots: null };
    members.forEach((member) => lineOf.set(member.id, line));
  });
  return lineOf;
}

export const inLine = (elements, playerId) => createLines(elements).has(playerId);
export const lineRuleOf = (elements, playerId) => createLines(elements).get(playerId)?.rule ?? null;

// Un recuadro discontinuo alrededor de cada fila, para ver al preparar la jugada qué jugadores cuentan como fila.
// `shown`: las fichas donde están en este paso (las filas se mueven).
const MARK_PAD = 12;
export function lineMarks(elements, shown = elements) {
  const at = new Map(shown.map((element) => [element.id, element]));
  return findLines(elements).map((members, index) => {
    const spots = members.map((member) => at.get(member.id) ?? member);
    const xs = spots.map((spot) => spot.x * W);
    const ys = spots.map((spot) => spot.y * H);
    const x = Math.min(...xs) - MARK_PAD;
    const y = Math.min(...ys) - MARK_PAD;
    return { id: `line-mark-${index}`, type: "line-mark", x: x / W, y: y / H, w: (Math.max(...xs) + MARK_PAD - x) / W, h: (Math.max(...ys) + MARK_PAD - y) / H };
  });
}

// En una fila, cada uno vuelve al final después de su último toque: si vuelve a jugar antes de que toque
// otro de su fila (recibe y luego remata), se queda; si el siguiente de su fila es otro, o ya no hay más, vuelve.
function backFlags(steps, lineOf) {
  return steps.map((step, index) => {
    const line = lineOf.get(step.playerId);
    if (!line) return false;
    // Fila «al rematar» (japo): solo cambia quien remata.
    if (line.rule === "remate") return step.action === "remate";
    for (const later of steps.slice(index + 1)) {
      if (later.playerId === step.playerId) return false;
      if (lineOf.get(later.playerId) === line) return true;
    }
    return true;
  });
}

// El que acaba de jugar va al final de su fila y los demás avanzan. Devuelve adónde va cada uno.
function backToLine(lineOf, playerId) {
  const line = lineOf.get(playerId);
  if (!line) return [];
  if (line.rule === "remate") {
    // El que remata se cambia por el último de la fila; los demás se quedan donde están.
    const from = line.order.indexOf(playerId);
    const last = line.order.length - 1;
    if (from < 0 || from === last) return [];
    const waiting = line.order[last];
    line.order[last] = playerId;
    line.order[from] = waiting;
    return [
      { playerId, target: line.slots[last] },
      { playerId: waiting, target: line.slots[from] },
    ];
  }
  if (!line.order) {
    // El primero de la fila es el primero que juega; detrás, los demás por cercanía a él.
    const first = line.members.find((member) => member.id === playerId);
    const sorted = [...line.members].sort((a, b) => distance(a, first) - distance(b, first));
    line.order = sorted.map((member) => member.id);
    line.slots = sorted.map((member) => ({ x: member.x, y: member.y }));
  }
  line.order = [...line.order.filter((id) => id !== playerId), playerId];
  return line.order.map((id, index) => ({ playerId: id, target: line.slots[index] }));
}

// Recorre los pasos y va diciendo dónde está cada uno. Al final devuelve las posiciones tras el último paso.
function walkPlan(steps, elements, visit = () => {}) {
  const origins = stepOrigins(steps, elements);
  const whereIs = new Map(elements.map((element) => [element.id, { x: element.x, y: element.y }]));
  const lineOf = createLines(elements);
  const backs = backFlags(steps, lineOf);
  const go = (move) => {
    const from = whereIs.get(move.playerId);
    whereIs.set(move.playerId, move.target);
    return { ...move, from };
  };
  steps.forEach((step, index) => {
    const from = whereIs.get(step.playerId);
    const origin = step.fresh && index > 0 ? from : origins[index];
    if (index > 0 && origin && !step.fresh) whereIs.set(step.playerId, origin);
    const moves = (step.moves ?? []).filter((move) => whereIs.has(move.playerId)).map(go);
    const back = backs[index] ? backToLine(lineOf, step.playerId).map(go) : [];
    visit({ step, index, origin, from, moves, back });
  });
  return whereIs;
}

// Dónde está cada uno después de los pasos ya puestos: así, al preparar la jugada, se toca al que toca.
export function planPositions(steps, elements) {
  const whereIs = walkPlan(steps, elements);
  return elements.map((element) => {
    const spot = whereIs.get(element.id);
    return spot && element.type === "token" && (spot.x !== element.x || spot.y !== element.y) ? { ...element, x: spot.x, y: spot.y } : element;
  });
}

// Repite la vuelta ya hecha con el primero de cada fila, hasta que hayan jugado todos.
// Vale para cualquier ejercicio: los que no están en fila (colocador fijo, entrenador…) repiten siempre,
// y de cada fila juega el primero, que vuelve a la fila tras su último toque de la vuelta.
export function repeatInLines(steps, elements, maxSteps = MAX_PLAN_STEPS) {
  const lineOf = createLines(elements);
  if (steps.length === 0 || steps.some((step) => !step.target)) return null;
  const lines = new Set(steps.filter((step) => lineOf.has(step.playerId)).map((step) => lineOf.get(step.playerId)));
  if (lines.size === 0) return null;
  const backs = backFlags(steps, lineOf);
  // En las filas «al rematar»: en qué sitio de la fila estaba cada uno al empezar la primera vuelta.
  const slotAtStart = new Map();
  steps.forEach((step) => {
    const line = lineOf.get(step.playerId);
    if (line?.rule === "remate") slotAtStart.set(step.playerId, line.order.indexOf(step.playerId));
  });
  const played = new Set();
  steps.forEach((step, index) => {
    if (backs[index]) backToLine(lineOf, step.playerId);
    played.add(step.playerId);
  });
  const everyone = [...lines].flatMap((line) => line.members.map((member) => member.id));
  const result = [...steps];
  // Si la vuelta acaba lejos de quien la empieza (un remate al otro campo), cada vuelta empieza con balón nuevo.
  const starter = elements.find((element) => element.id === steps[0].playerId);
  const fresh = !starter || distance(starter, steps.at(-1).target) > 9;
  // Con «al rematar» y más de uno esperando, el del medio no llega a entrar: se para tras unas cuantas vueltas.
  const maxRounds = Math.max(...[...lines].map((line) => line.members.length));
  let rounds = 1;
  while (everyone.some((id) => !played.has(id)) && rounds < maxRounds + 1 && result.length + steps.length <= maxSteps) {
    rounds += 1;
    // Quién es el primero de cada fila al empezar esta vuelta: ese hace todo lo que hacía el de la primera.
    // En las de «al rematar», quien esté ahora en el mismo sitio de la fila.
    const fronts = new Map([...lines].map((line) => [line, line.order[0]]));
    const orders = new Map([...lines].map((line) => [line, [...line.order]]));
    const who = (playerId) => {
      const line = lineOf.get(playerId);
      if (!line) return playerId;
      return line.rule === "remate" ? orders.get(line)[slotAtStart.get(playerId)] : fronts.get(line);
    };
    steps.forEach((model, index) => {
      const playerId = who(model.playerId);
      const step = { ...model, playerId, moves: (model.moves ?? []).map((move) => ({ ...move, playerId: who(move.playerId) })) };
      if (index === 0) step.fresh = fresh || Boolean(model.fresh);
      result.push(step);
      if (backs[index]) backToLine(lineOf, playerId);
      played.add(playerId);
    });
  }
  return result.length > steps.length ? result : null;
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
  const lineOf = createLines(elements);
  const backs = backFlags(steps, lineOf);

  let lastTime = 0;
  const runTo = (playerId, to, from) => {
    const start = whereIs.get(playerId);
    if (!start || distance(start, to) < 1) return;
    const points = runs.get(playerId) ?? [point(0, start)];
    const runStart = Math.max(from, points.at(-1)[0] + 1);
    const runEnd = runStart + Math.max(MIN_RUN_MS, distance(start, to) * RUN_MS_PER_UNIT);
    points.push(point(runStart, start), point(runEnd, to));
    runs.set(playerId, points);
    whereIs.set(playerId, to);
    lastTime = Math.max(lastTime, runEnd);
  };
  // Los jugadores que se colocan en un paso salen cuando se toca el balón en ese paso.
  const applyMoves = (step, from) => (step.moves ?? []).forEach(({ playerId, target }) => runTo(playerId, target, from));
  // Vuelta a la fila: al acabar su gesto, el que ha jugado va al final y los de su fila avanzan.
  let pendingBack = null;
  const queueBack = (index, actionStart) => {
    const step = steps[index];
    pendingBack = backs[index] ? { playerId: step.playerId, time: actionStart + actionDuration(step.action) } : null;
  };
  const applyBack = () => {
    if (!pendingBack) return;
    backToLine(lineOf, pendingBack.playerId).forEach(({ playerId, target }) => runTo(playerId, target, pendingBack.time));
    pendingBack = null;
  };

  let contact = START_MS + contactTime(steps[0].action);
  actions.push(actionItem(steps[0].playerId, START_MS, steps[0]));
  ballPoints.push(point(contact, ballStart));
  let ballAt = ballStart;
  lastTime = contact + actionDuration(steps[0].action);
  queueBack(0, START_MS);

  for (let index = 1; index <= steps.length; index += 1) {
    applyMoves(steps[index - 1], contact);
    applyBack();
    const target = steps[index - 1].target;
    if (!target) break;
    const arrival = contact + flightTime(ballAt, target, steps[index - 1].action, steps[index - 1].tempo);
    ballPoints.push(point(arrival, target));
    lastTime = Math.max(lastTime, arrival);

    const step = steps[index];
    if (step?.fresh) {
      // Balón nuevo: el de antes se queda en el suelo y quien juega lanza otro desde donde está.
      const spot = whereIs.get(step.playerId);
      const hand = { x: Math.min(0.97, spot.x + 0.045), y: spot.y };
      const actionStart = arrival + FRESH_PAUSE_MS;
      const hit = actionStart + contactTime(step.action);
      ballPoints.push(point(arrival + FRESH_PAUSE_MS / 2, target), point(arrival + FRESH_PAUSE_MS / 2 + 1, hand), point(hit, hand));
      actions.push(actionItem(step.playerId, actionStart, step));
      queueBack(index, actionStart);
      lastTime = Math.max(lastTime, actionStart + actionDuration(step.action));
      contact = hit;
      ballAt = hand;
      continue;
    }
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
      queueBack(index, actionStart);
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
