import { useId, useRef } from "react";
import { CourtDrawing } from "@/app/components/CourtBoard.jsx";
import BoardScene, { BALL_RADIUS, BallShape } from "@/app/components/board/BoardScene.jsx";
import { COURT_HEIGHT as H, COURT_WIDTH as W, tokenPosition } from "@/app/boards.js";
import { actionDuration, actionLabel, contactTime, poseOf } from "@/app/boardRecording.js";

// El nombre de la acción encima del jugador mientras la hace.
export function ActionTag({ action, y, scale = 1 }) {
  const label = actionLabel(action.action, action.tempo).toUpperCase();
  const width = label.length * 2.3 * scale + 3 * scale;
  const fade = Math.min(1, Math.sin(Math.PI * action.progress) * 3);
  return (
    <g opacity={fade.toFixed(2)} pointerEvents="none">
      <rect x={-width / 2} y={y - 4 * scale} width={width} height={4.6 * scale} rx={2.2 * scale} fill="#FF3800" stroke="#FFFFFF" strokeWidth={0.35 * scale} />
      <text x="0" y={y - 0.6 * scale} textAnchor="middle" fontSize={3.1 * scale} fontWeight="900" fill="#FFFFFF">{label}</text>
    </g>
  );
}

// "Falso 3D": el suelo (pista, flechas, zonas, dibujos) se inclina con CSS y las chapas, el balón
// y la red se pintan de pie encima, en el sitio donde cae cada punto del suelo inclinado.
const TILT = (52 * Math.PI) / 180;
const SIN = Math.sin(TILT);
const COS = Math.cos(TILT);
const DEPTH = 2.1 * H;
const NET_Y = 95;
// La red, algo más alta que los jugadores, como en la realidad.
const NET_HEIGHT = 33;
const PAD_TOP = 46;
const PAD_BOTTOM = 10;
const FLOOR_TYPES = new Set(["zone", "stroke", "arrow", "text", "prop"]);
// En 3D las chapas de cerca crecen: un poco más pequeñas para que no tapen la pista.
const STANDING_SIZE = 0.82;
// Los muñecos, algo más altos que una chapa para que se lean bien.
const FIGURE_SIZE = 1.3;

// Las medidas del 3D para la pista entera o la media (solo nuestro campo).
export function geometry3d(half) {
  const top = half ? H / 2 : 0;
  const height = half ? H / 2 : H;
  const centerY = top + height / 2;
  const project = (x, y) => {
    const offset = y - centerY;
    const scale = DEPTH / (DEPTH - offset * SIN);
    return { x: W / 2 + (x - W / 2) * scale, y: centerY + offset * COS * scale, scale };
  };
  const far = project(0, top);
  const near = project(0, top + height);
  const minX = W / 2 - (W / 2) * near.scale;
  const box = { x: minX, y: far.y - PAD_TOP * far.scale, width: W * near.scale, height: 0 };
  box.height = near.y + PAD_BOTTOM - box.y;
  return { top, height, centerY, project, box };
}

function Net({ geometry }) {
  const left = geometry.project(2, NET_Y);
  const right = geometry.project(98, NET_Y);
  const lift = NET_HEIGHT * left.scale;
  const tape = 2.2 * left.scale;
  const mesh = [];
  for (let x = 4; x < 98; x += 4) {
    const point = geometry.project(x, NET_Y);
    mesh.push(<line key={x} x1={point.x} y1={point.y - lift + tape} x2={point.x} y2={point.y - lift * 0.42} stroke="rgba(255,255,255,0.28)" strokeWidth="0.35" />);
  }
  const rows = [0.55, 0.7, 0.85].map((part) => (
    <line key={part} x1={left.x} y1={left.y - lift * part} x2={right.x} y2={right.y - lift * part} stroke="rgba(255,255,255,0.22)" strokeWidth="0.35" />
  ));
  return (
    <g aria-hidden="true" pointerEvents="none">
      <polygon points={`${left.x},${left.y - lift} ${right.x},${right.y - lift} ${right.x},${right.y - lift * 0.42} ${left.x},${left.y - lift * 0.42}`} fill="rgba(10,10,12,0.35)" />
      {mesh}
      {rows}
      <line x1={left.x} y1={left.y - lift + tape / 2} x2={right.x} y2={right.y - lift + tape / 2} stroke="#FFFFFF" strokeWidth={tape} />
      <line x1={left.x} y1={left.y - lift * 0.42} x2={right.x} y2={right.y - lift * 0.42} stroke="#FFFFFF" strokeWidth="0.6" />
      {[left, right].map((post, index) => (
        <g key={index}>
          <line x1={post.x} y1={post.y} x2={post.x} y2={post.y - lift - 1.5} stroke="#D4D4D8" strokeWidth="1.3" strokeLinecap="round" />
          <line x1={post.x} y1={post.y - lift} x2={post.x} y2={post.y - lift - 7 * post.scale} stroke="#FF3800" strokeWidth="0.7" strokeDasharray="1.2 1.2" />
        </g>
      ))}
    </g>
  );
}


// ---------- Muñecos ----------
// Un muñeco sencillo con "esqueleto": cadera, hombros, rodillas, codos y manos. Los pies están en (0, 0)
// y crece hacia arriba. `stride` (-1 a 1) es el paso al correr; `crouch` (0 a 1), cuánto se agacha.
const LIMB = "#E4E4E7";
const SHORTS = "#27272A";
export const JERSEYS = {
  home: { shirt: "#09090B", trim: "#FFFFFF", number: "#FFFFFF" },
  libero: { shirt: "#FCD34D", trim: "#09090B", number: "#09090B" },
  rival: { shirt: "#FF3800", trim: "#FFFFFF", number: "#FFFFFF" },
};
export const POSITION_SHORT = { Líbero: "LIB", Colocador: "COL", Receptor: "REC", Central: "CEN", Opuesto: "OPU" };

// `run` (0 a 1) pasa de andar a correr: zancada más larga, rodillas arriba, brazos doblados
// y el cuerpo que bota en cada paso.
export function pose(stride, crouch, run = 0) {
  const flight = run * 1.4 * Math.abs(stride);
  const hip = { x: 0, y: -11 + crouch * 2.6 + run * 0.8 - flight };
  const reach = 2.6 + run * 1.6;
  const lift = 1.6 + run * 3.4;
  const footLeft = { x: -2 + stride * reach, y: -Math.max(0, stride) * lift - flight };
  const footRight = { x: 2 - stride * reach, y: -Math.max(0, -stride) * lift - flight };
  // Al correr, la rodilla de la pierna que va delante sube mucho.
  const knee = (foot, side, forward) => ({
    x: (hip.x + foot.x) / 2 + side * (0.4 + crouch * 1.2),
    y: (hip.y + foot.y) / 2 - 0.3 - run * Math.max(0, forward) * 2.4,
  });
  const shoulderY = hip.y - 7.2 + crouch * 0.6 + run * 0.5;
  // Andando, brazos casi estirados; corriendo, doblados en ángulo y balanceándose fuerte.
  const hand = (side) => ({
    x: side * (5.6 - crouch * 1.2 - run * 1.8),
    y: hip.y + 0.6 - crouch * 2 - run * 3.4 + side * stride * (2.2 + run * 2.6),
  });
  const elbow = (side, target) => ({ x: side * (5.3 + run * 0.6), y: (shoulderY + target.y) / 2 + 0.4 + run * 1.6 });
  const handLeft = hand(-1);
  const handRight = hand(1);
  return {
    hip,
    shoulderY,
    head: { x: 0, y: shoulderY - 3.4 },
    legs: [
      [hip.x - 1.5, hip.y, knee(footLeft, -1, stride), footLeft],
      [hip.x + 1.5, hip.y, knee(footRight, 1, -stride), footRight],
    ],
    arms: [
      [-3.7, shoulderY + 0.5, elbow(-1, handLeft), handLeft],
      [3.7, shoulderY + 0.5, elbow(1, handRight), handRight],
    ],
  };
}


// ---------- Acciones ----------
const mix = (a, b, weight) => ({ x: a.x + (b.x - a.x) * weight, y: a.y + (b.y - a.y) * weight });
const between = (value, start, end) => Math.min(1, Math.max(0, (value - start) / (end - start)));

// Cómo se mueve el cuerpo en cada acción. `progress` va de 0 a 1 a lo largo del gesto.
// Devuelve cuánto se agacha, cuánto salta, cuánto se inclina y dónde van codos y manos (y pies si cambian).
export function actionShape(action, progress, shoulderY) {
  const swell = Math.sin(Math.PI * progress);
  const hold = Math.min(1, swell * 2.5);
  const top = shoulderY;
  switch (action) {
    case "recepcion":
      // Se agacha con los brazos juntos y estirados delante, haciendo plano.
      return {
        crouch: 0.25 + 0.75 * hold,
        hands: [{ x: -1, y: top + 9.5 }, { x: 1, y: top + 9.5 }],
        elbows: [{ x: -3, y: top + 5.4 }, { x: 3, y: top + 5.4 }],
        weight: hold,
      };
    case "colocacion":
      // Manos juntas por encima de la frente, como un triángulo.
      return {
        crouch: 0.25 * (1 - hold),
        jump: 1.2 * swell,
        hands: [{ x: -1.5, y: top - 8.2 }, { x: 1.5, y: top - 8.2 }],
        elbows: [{ x: -4.2, y: top - 3.2 }, { x: 4.2, y: top - 3.2 }],
        weight: hold,
      };
    case "bloqueo":
      // Salta con los dos brazos estirados hacia arriba.
      return {
        crouch: progress < 0.15 ? 0.8 : progress > 0.86 ? ((progress - 0.86) / 0.14) * 0.7 : 0,
        jump: 7.5 * swell,
        tuck: 0.6 * swell,
        hands: [{ x: -2.6, y: top - 9.5 }, { x: 2.6, y: top - 9.5 }],
        elbows: [{ x: -3.4, y: top - 4.6 }, { x: 3.4, y: top - 4.6 }],
        weight: hold,
      };
    case "remate": {
      // Carrera, salto con el brazo armado atrás y golpe arriba justo cuando llega el balón; luego el brazo baja.
      const contact = contactTime("remate") / actionDuration("remate");
      const cock = between(progress, 0.08, contact - 0.16);
      const swing = between(progress, contact - 0.16, contact);
      const follow = between(progress, contact, contact + 0.2);
      const rightHand = mix(mix(mix({ x: 5.4, y: top + 2 }, { x: 4.8, y: top - 6.5 }, cock), { x: 2, y: top - 11 }, swing), { x: 1, y: top + 3 }, follow);
      const rightElbow = mix(mix(mix({ x: 5.4, y: top + 0.5 }, { x: 6.2, y: top - 1.2 }, cock), { x: 3.2, y: top - 6.6 }, swing), { x: 3, y: top - 0.5 }, follow);
      return {
        // Se agacha para la batida y vuelve a flexionar al caer.
        crouch: progress < 0.12 ? 0.9 : progress > 0.86 ? ((progress - 0.86) / 0.14) * 0.8 : 0,
        jump: 10 * swell,
        tuck: 0.8 * swell,
        hands: [mix(mix({ x: -4.6, y: top + 2 }, { x: -3.2, y: top - 9 }, cock), { x: -3.8, y: top + 4 }, follow), rightHand],
        elbows: [mix(mix({ x: -5, y: top + 0.5 }, { x: -4, y: top - 4 }, cock), { x: -4.6, y: top + 1.5 }, follow), rightElbow],
        weight: hold,
        strikeHand: 1,
      };
    }
    case "saque": {
      // Lanza el balón con la izquierda, arma la derecha y golpea arriba en el momento del contacto.
      const contact = contactTime("saque") / actionDuration("saque");
      const toss = between(progress, 0.04, 0.28);
      const drop = between(progress, 0.42, 0.7);
      const cock = between(progress, 0.18, contact - 0.12);
      const swing = between(progress, contact - 0.12, contact);
      const follow = between(progress, contact, contact + 0.22);
      return {
        jump: 3 * Math.sin(Math.PI * between(progress, 0.3, 0.85)),
        hands: [
          mix(mix({ x: -2.6, y: top + 6 }, { x: -1.8, y: top - 9.5 }, toss), { x: -3.6, y: top + 3 }, drop),
          mix(mix(mix({ x: 4.6, y: top + 5 }, { x: 4.8, y: top - 7 }, cock), { x: 2, y: top - 11 }, swing), { x: 1, y: top + 3 }, follow),
        ],
        elbows: [
          mix(mix({ x: -4, y: top + 2 }, { x: -3, y: top - 4.4 }, toss), { x: -4.4, y: top + 1 }, drop),
          mix(mix(mix({ x: 5, y: top + 1.6 }, { x: 6.2, y: top - 1.4 }, cock), { x: 3.2, y: top - 6.6 }, swing), { x: 3, y: top - 0.5 }, follow),
        ],
        weight: Math.min(1, progress * 6, (1 - progress) * 4),
        strikeHand: 1,
      };
    }
    case "defensa":
      // Se agacha mucho y se tira hacia un lado con los brazos estirados.
      return {
        crouch: 0.25 + 0.75 * hold,
        lean: 28 * swell,
        hands: [{ x: 2.6, y: top + 8.5 }, { x: 6.8, y: top + 6.5 }],
        elbows: [{ x: -0.6, y: top + 4.6 }, { x: 5.4, y: top + 3.4 }],
        weight: hold,
      };
    default:
      return null;
  }
}

// ---------- Balón: altura en cada momento ----------
// El balón se toca a la altura de las manos de cada gesto (calculada con la misma postura del muñeco),
// sube y baja según el tipo de toque y, si cae al suelo, bota.
const CONTACT_MATCH_MS = 140;
const FLASH_MS = 220;
const HOLD_HEIGHT = 12;
const OVERHEAD = new Set(["saque", "remate", "colocacion", "bloqueo"]);

function handHeight(action) {
  const top = pose(0, 0).shoulderY;
  const progress = contactTime(action) / actionDuration(action);
  const shape = actionShape(poseOf(action), progress, top);
  const hand = shape.strikeHand !== undefined ? shape.hands[shape.strikeHand] : { y: (shape.hands[0].y + shape.hands[1].y) / 2 };
  const reach = (-hand.y + (shape.jump ?? 0)) * FIGURE_SIZE;
  // Por arriba el balón queda justo encima de la mano; con los antebrazos, apoyado encima.
  return Math.max(0, reach - (OVERHEAD.has(poseOf(action)) ? 2 : 1));
}
const CONTACT_HEIGHT = Object.fromEntries(["saque", "recepcion", "colocacion", "remate", "bloqueo", "defensa", "free", "fuerte"].map((action) => [action, handHeight(action)]));
const TOSS_EXTRA = 16;

// Altura en mitad del vuelo según quién lo toca: recepción y colocación bombeadas, remate hacia abajo.
// Cuánto sube la colocación por encima de la mano (en las unidades de altura de la pizarra:
// unas 18 son un metro). El tiempo 3 sube casi 3 m; el tiempo menos va casi plano.
const TEMPO_RISE = { 3: 52, 2: 24, 1: 10, menos: 3 };

function middleHeight(action, from, to, distance) {
  switch (action) {
    case "saque":
      return Math.max(from, to, NET_HEIGHT + 12);
    case "recepcion":
      return Math.max(from, to) + 38;
    case "colocacion":
      return Math.max(from, to) + 26;
    case "defensa":
      return Math.max(from, to) + 34;
    case "remate":
      return (from + to) / 2 - 4;
    case "bloqueo":
      return (from + to) / 2 + 6;
    // Entrenador: la free sale bombeada y fácil; la fuerte, tensa y hacia abajo.
    case "free":
      return Math.max(from, to) + 40;
    case "fuerte":
      return (from + to) / 2 - 2;
    default:
      return Math.max(from, to) + Math.min(40, distance * 0.45);
  }
}

function flightsOf(points) {
  const flights = [];
  let start = 0;
  for (let index = 1; index <= points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const stopped = !current || (current[1] === previous[1] && current[2] === previous[2]);
    if (!stopped) continue;
    const first = points[start];
    const last = previous;
    const distance = Math.hypot((last[1] - first[1]) * W, (last[2] - first[2]) * H);
    if (last[0] > first[0] && distance > 0) flights.push({ t0: first[0], t1: last[0], distance });
    start = index;
  }
  return flights;
}

// Si el último vuelo de algún balón acaba en el suelo (nadie lo toca), la jugada se alarga
// lo justo para verlo botar unas veces antes de terminar.
export const BOUNCE_TAIL_MS = 1400;
export function bounceTailMs(recording, ballIds) {
  if (!recording) return 0;
  const contacts = (recording.actions ?? []).map((item) => item.t + contactTime(item.action));
  let end = 0;
  (recording.tracks ?? []).forEach((track) => {
    if (ballIds && !ballIds.has(track.id)) return;
    const last = flightsOf(track.points).at(-1);
    if (last && !contacts.some((at) => Math.abs(at - last.t1) < CONTACT_MATCH_MS)) end = Math.max(end, last.t1 + BOUNCE_TAIL_MS);
  });
  return Math.max(0, end - (recording.duration_ms ?? 0));
}

// Altura de cada balón y el destello de cada toque en este momento de la jugada.
export function ballStateAt(recording, time, ballIds) {
  const heights = new Map();
  const flashes = new Map();
  if (!recording) return { heights, flashes };
  const contacts = (recording.actions ?? []).map((item) => ({ ...item, at: item.t + contactTime(item.action) }));
  const contactNear = (moment) => contacts.find((item) => Math.abs(item.at - moment) < CONTACT_MATCH_MS) ?? null;

  (recording.tracks ?? []).forEach((track) => {
    if (ballIds && !ballIds.has(track.id)) return;
    const flights = flightsOf(track.points);
    const flight = flights.find((item) => time >= item.t0 && time <= item.t1);
    let height = 0;
    if (flight) {
      const from = contactNear(flight.t0);
      const to = contactNear(flight.t1);
      const h0 = from ? CONTACT_HEIGHT[from.action] : 0;
      const h1 = to ? CONTACT_HEIGHT[to.action] : 0;
      const middle = from?.action === "colocacion" && TEMPO_RISE[from.tempo] !== undefined
        ? Math.max(h0, h1) + TEMPO_RISE[from.tempo]
        : middleHeight(from?.action, h0, h1, flight.distance);
      const control = (4 * middle - h0 - h1) / 2;
      const p = (time - flight.t0) / (flight.t1 - flight.t0);
      height = (1 - p) * (1 - p) * h0 + 2 * (1 - p) * p * control + p * p * h1;
    } else {
      const next = flights.find((item) => item.t0 > time);
      const previous = [...flights].reverse().find((item) => item.t1 < time);
      const serve = next && contactNear(next.t0)?.action === "saque" ? contactNear(next.t0) : null;
      if (serve && time >= serve.t) {
        // El saque: el balón sube desde la mano, llega arriba y baja justo a la mano que golpea.
        const q = Math.min(1, (time - serve.t) / (serve.at - serve.t));
        const peak = CONTACT_HEIGHT.saque + TOSS_EXTRA;
        height = q < 0.62 ? HOLD_HEIGHT + (peak - HOLD_HEIGHT) * (1 - (1 - q / 0.62) ** 2) : peak - (peak - CONTACT_HEIGHT.saque) * ((q - 0.62) / 0.38) ** 2;
      } else if (!previous) {
        // Antes del primer toque lo tiene en la mano quien empieza, o está en el suelo.
        height = next && contactNear(next.t0) ? HOLD_HEIGHT : 0;
      } else {
        const landed = contactNear(previous.t1);
        if (landed) {
          height = CONTACT_HEIGHT[landed.action];
        } else {
          // Cae al suelo y bota un par de veces.
          const since = time - previous.t1;
          height = 7 * Math.exp(-since / 260) * Math.abs(Math.sin(since / 115));
        }
      }
    }
    heights.set(track.id, Math.max(0, height));
    contacts.forEach((item) => {
      const age = time - item.at;
      if (age < 0 || age > FLASH_MS) return;
      if (flights.some((other) => Math.abs(other.t0 - item.at) < CONTACT_MATCH_MS || Math.abs(other.t1 - item.at) < CONTACT_MATCH_MS)) {
        flashes.set(track.id, 1 - age / FLASH_MS);
      }
    });
  });
  return { heights, flashes };
}

function Limb({ from, joint, to, width }) {
  return (
    <polyline
      points={`${from[0]},${from[1]} ${joint.x},${joint.y} ${to.x},${to.y}`}
      fill="none"
      stroke={LIMB}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function PlayerFigure({ element, player, position, zone, stride = 0, crouch = 0, run = 0, action = null, photos, clipId }) {
  const rival = element.side === "rival";
  const jersey = rival ? JERSEYS.rival : element.side === "coach" ? JERSEYS.coach : position === "Líbero" ? JERSEYS.libero : JERSEYS.home;
  const number = player?.number ?? element.label;
  const picture = photos ? player?.picture : null;
  // Si está haciendo una acción, el gesto manda sobre el andar o correr.
  const shape = action ? actionShape(poseOf(action.action), action.progress, pose(0, 0).shoulderY) : null;
  const body = pose(shape ? stride * (1 - shape.weight) : stride, shape?.crouch ?? crouch, shape ? 0 : run);
  if (shape) {
    body.arms = body.arms.map(([x, y, elbow, hand], index) => [x, y, mix(elbow, shape.elbows[index], shape.weight), mix(hand, shape.hands[index], shape.weight)]);
    if (shape.tuck) {
      // En el aire se recogen las piernas.
      body.legs = body.legs.map(([x, y, knee, foot]) => [x, y, { x: knee.x, y: knee.y - shape.tuck * 2 }, { x: foot.x * 0.8, y: foot.y - shape.tuck * 3.2 }]);
    }
  }
  const jump = shape?.jump ?? 0;
  const lean = shape?.lean ?? 0;
  const shortRole = POSITION_SHORT[position] ?? "";
  const name = element.name;
  const pillWidth = Math.max(name.length * 2.2 + (shortRole ? 8 : 0), 7) + 2;

  return (
    <g>
      {/* La sombra se queda en el suelo y se encoge al saltar. */}
      <ellipse cx="0" cy="0" rx={3.6 * Math.max(0.45, 1 - jump / 18)} ry={1.35 * Math.max(0.45, 1 - jump / 18)} fill="rgba(0,0,0,0.45)" />
      {element.highlight && (
        <ellipse className="board-pulse" cx="0" cy="0" rx="7" ry="2.6" fill="rgba(255,56,0,0.25)" stroke="#FF3800" strokeWidth="0.9" />
      )}
      <g transform={`translate(0 ${(-jump).toFixed(2)}) rotate(${lean.toFixed(1)} 0 0)`}>
      {body.legs.map(([x, y, joint, foot], index) => (
        <g key={`leg-${index}`}>
          <Limb from={[x, y]} joint={joint} to={foot} width={2.3} />
          <ellipse cx={foot.x} cy={foot.y - 0.3} rx="1.5" ry="0.8" fill="#FFFFFF" stroke="#18181B" strokeWidth="0.3" />
        </g>
      ))}
      {/* Pantalón */}
      <path d={`M${-3.3} ${body.hip.y - 1} L3.3 ${body.hip.y - 1} L3.6 ${body.hip.y + 2.4} L0.4 ${body.hip.y + 2.4} L0 ${body.hip.y + 1.2} L-0.4 ${body.hip.y + 2.4} L-3.6 ${body.hip.y + 2.4} Z`} fill={SHORTS} />
      {/* Camiseta con dorsal */}
      <path
        d={`M-3.9 ${body.shoulderY} Q0 ${body.shoulderY - 1} 3.9 ${body.shoulderY} L3.4 ${body.hip.y - 0.4} Q0 ${body.hip.y + 0.4} -3.4 ${body.hip.y - 0.4} Z`}
        fill={jersey.shirt}
        stroke={jersey.trim}
        strokeWidth="0.45"
      />
      <text x="0" y={(body.shoulderY + body.hip.y) / 2 + 1.6} textAnchor="middle" fontSize="4.2" fontWeight="900" fill={jersey.number}>
        {number}
      </text>
      {body.arms.map(([x, y, joint, hand], index) => (
        <Limb key={`arm-${index}`} from={[x, y]} joint={joint} to={hand} width={1.8} />
      ))}
      {/* Cabeza: con su foto si la tiene */}
      <circle cx={body.head.x} cy={body.head.y} r="2.6" fill={LIMB} />
      {picture && (
        <>
          <clipPath id={clipId}><circle cx={body.head.x} cy={body.head.y} r="2.45" /></clipPath>
          <image href={picture} x={body.head.x - 2.6} y={body.head.y - 2.6} width="5.2" height="5.2" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
        </>
      )}
      <circle cx={body.head.x} cy={body.head.y} r="2.6" fill="none" stroke={jersey.shirt} strokeWidth="0.45" />
      </g>
      {zone && (
        <g>
          <circle cx="4.6" cy={body.head.y - 1} r="2.3" fill={rival ? "#FFFFFF" : "#FF3800"} stroke={rival ? "#FF3800" : "#FFFFFF"} strokeWidth="0.45" />
          <text x="4.6" y={body.head.y} textAnchor="middle" fontSize="2.8" fontWeight="900" fill={rival ? "#FF3800" : "#FFFFFF"}>{zone}</text>
        </g>
      )}
      {(name || shortRole) && (
        <g>
          <rect x={-pillWidth / 2} y="1.4" width={pillWidth} height="4.4" rx="1.6" fill="rgba(0,0,0,0.78)" />
          <text x={shortRole && name ? -pillWidth / 2 + 1 : 0} y="4.6" textAnchor={shortRole && name ? "start" : "middle"} fontSize="3.2" fontWeight="700" fill="#FFFFFF">
            {name}
            {shortRole && <tspan fill="#FF8800" dx={name ? "1" : "0"}>{shortRole}</tspan>}
          </text>
        </g>
      )}
      {/* La acción, debajo del nombre: arriba taparía los brazos justo en el golpe. */}
      {action && <ActionTag action={action} y={11.2} />}
    </g>
  );
}

// Lleva la cuenta de cuánto se ha movido cada muñeco para que mueva las piernas al correr.
// Por debajo de esta velocidad (unidades de pista por milisegundo) anda; por encima, corre del todo.
const WALK_SPEED = 0.006;
const RUN_SPEED = 0.018;

// Lleva la cuenta de cuánto y cómo de rápido se mueve cada muñeco: andando o corriendo según la velocidad.
function useStride(elements) {
  const motion = useRef(new Map());
  const strides = new Map();
  const now = performance.now();
  elements.forEach((element) => {
    if (element.type !== "token") return;
    const previous = motion.current.get(element.id);
    const distance = previous ? Math.hypot((element.x - previous.x) * W, (element.y - previous.y) * H) : 0;
    // Un salto grande (deshacer, poner una alineación) no es correr.
    const step = distance < 25 ? distance : 0;
    const elapsed = Number.isFinite(previous?.t) ? Math.max(1, now - previous.t) : 16;
    const speed = step / elapsed;
    const runTarget = Math.min(1, Math.max(0, (speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)));
    const lastRun = Number.isFinite(previous?.run) ? previous.run : 0;
    const run = lastRun + (runTarget - lastRun) * 0.25;
    // Corriendo se dan más pasos por la misma distancia.
    const phase = (Number.isFinite(previous?.phase) ? previous.phase : 0) + step * (0.7 + run * 0.6);
    const target = step > 0.05 ? 1 : 0;
    const lastAmount = Number.isFinite(previous?.amount) ? previous.amount : 0;
    const amount = lastAmount + (target - lastAmount) * 0.35;
    motion.current.set(element.id, { x: element.x, y: element.y, phase, amount, run, t: now });
    strides.set(element.id, { stride: Math.sin(phase) * amount, run: run * amount });
  });
  return strides;
}

// Lo que va de pie, ordenado de lejos a cerca para que lo de delante tape a lo de detrás.
function StandingLayer({ elements, rosterById, geometry, heights, flashes, zones, selectedId, photos, actions }) {
  const uid = useId().replace(/:/g, "");
  const strides = useStride(elements);
  const standing = elements
    .filter((element) => element.type === "token" || element.type === "ball")
    // El balón se pinta por delante de quien lo toca (están en el mismo sitio), si no quedaría tapado por su cuerpo.
    .map((element) => ({ element, depth: element.y * H + (element.type === "ball" ? 1.5 : 0) }));
  const items = [...standing, { net: true, depth: NET_Y }].sort((a, b) => a.depth - b.depth);

  return items.map((item) => {
    if (item.net) {
      const visible = NET_Y >= geometry.top && NET_Y <= geometry.top + geometry.height;
      return visible ? <Net key="net" geometry={geometry} /> : null;
    }
    const { element } = item;
    if (element.y * H < geometry.top - 2) return null;
    const floor = geometry.project(element.x * W, element.y * H);
    const size = floor.scale * STANDING_SIZE;
    if (element.type === "token") {
      const player = rosterById[element.player_id];
      return (
        <g key={element.id}>
          <g transform={`translate(${floor.x} ${floor.y}) scale(${(size * FIGURE_SIZE).toFixed(3)})`}>
            <g className="board-fx board-idle">
              <PlayerFigure
                element={element}
                player={player}
                position={tokenPosition(element, player)}
                zone={zones?.get(element.id)}
                stride={strides.get(element.id)?.stride ?? 0}
                run={strides.get(element.id)?.run ?? 0}
                action={actions?.get(element.id) ?? null}
                crouch={0.25}
                photos={photos}
                clipId={`${uid}-head-${element.id}`}
              />
            </g>
          </g>
        </g>
      );
    }
    const height = element.type === "ball" ? heights.get(element.id) ?? 0 : 0;
    const radius = BALL_RADIUS;
    const standY = floor.y - (radius + height) * size;
    const placed = { ...element, x: floor.x / W, y: standY / H };
    const shadow = Math.max(0.35, 1 - height / 50);
    return (
      <g key={element.id}>
        <ellipse cx={floor.x} cy={floor.y} rx={radius * 0.95 * size * shadow} ry={radius * 0.38 * size * shadow} fill="rgba(0,0,0,0.45)" />
        <g transform={`translate(${floor.x} ${standY}) scale(${size.toFixed(3)}) translate(${-floor.x} ${-standY})`}>
          <BallShape element={placed} selected={element.id === selectedId} />
          {flashes?.get(element.id) > 0 && (
            <circle
              cx={floor.x}
              cy={standY}
              r={BALL_RADIUS * (1.3 + (1 - flashes.get(element.id)) * 1.8)}
              fill="rgba(255,255,255,0.25)"
              stroke="#FFFFFF"
              strokeOpacity={flashes.get(element.id)}
              strokeWidth="0.8"
            />
          )}
        </g>
      </g>
    );
  });
}

export default function Board3D({ elements, rosterById, half, beach, maxWidth, maxHeight, heights, flashes = null, arrowProgress, zones, selectedId, photos = true, label, actions = null }) {
  const geometry = geometry3d(half);
  const { box } = geometry;
  const unit = Math.min(maxWidth / box.width, maxHeight / box.height);
  if (!(unit > 0)) return null;
  const floorWidth = W * unit;
  const floorHeight = geometry.height * unit;
  // El centro del suelo inclinado coincide con su centro sin inclinar: es el punto de fuga de CSS.
  const floorLeft = (0 - box.x) * unit;
  const floorTop = (geometry.centerY - box.y) * unit - floorHeight / 2;

  return (
    <div role="img" aria-label={label} data-court-3d className="relative" style={{ width: box.width * unit, height: box.height * unit }}>
      <div
        className="absolute"
        style={{ left: floorLeft, top: floorTop, width: floorWidth, height: floorHeight, perspective: `${DEPTH * unit}px`, perspectiveOrigin: "50% 50%" }}
      >
        <div
          data-court-floor
          className="relative h-full w-full overflow-hidden rounded-sm shadow-[0_30px_60px_rgba(0,0,0,0.7)]"
          style={{ transform: `rotateX(${TILT}rad)`, transformOrigin: "50% 50%" }}
        >
          <div data-court-layers className="absolute inset-x-0 bottom-0" style={{ height: half ? "200%" : "100%" }}>
            <CourtDrawing beach={beach} />
            <BoardScene elements={elements.filter((element) => FLOOR_TYPES.has(element.type))} arrowProgress={arrowProgress} label="" />
          </div>
        </div>
      </div>
      <svg
        data-court-standing
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
        overflow="visible"
        aria-hidden="true"
      >
        <StandingLayer elements={elements} rosterById={rosterById} geometry={geometry} heights={heights} flashes={flashes} zones={zones} selectedId={selectedId} photos={photos} actions={actions} />
      </svg>
    </div>
  );
}
