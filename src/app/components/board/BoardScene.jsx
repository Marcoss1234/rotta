import { useEffect, useId, useRef, useState } from "react";
import { CourtDrawing } from "@/app/components/CourtBoard.jsx";
import { COURT_HEIGHT as H, COURT_WIDTH as W, tokenPosition } from "@/app/boards.js";
import { actionLabel } from "@/app/boardRecording.js";

const JUMPING_ACTIONS = new Set(["remate", "bloqueo", "saque"]);
// Saltar: la chapa crece; recibir o defender: se aplasta un poco.
const actionScale = ({ action, progress }) => 1 + Math.sin(Math.PI * progress) * (JUMPING_ACTIONS.has(action) ? 0.35 : -0.15);

export const TOKEN_RADIUS = 7.5;
const HANDLE_RADIUS = 3.2;
const PASS_COLOR = "#0A0A0C";
const MOVE_COLOR = "#FFFFFF";

// La pista con su tamaño. En media pista se ve solo el campo propio, el de abajo.
export function CourtFrame({ half, beach, className = "", style, children }) {
  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`} style={{ aspectRatio: half ? `${W} / ${H / 2}` : `${W} / ${H}`, ...style }}>
      <div data-court-layers className="absolute inset-x-0 bottom-0" style={{ height: half ? "200%" : "100%" }}>
        <CourtDrawing beach={beach} />
        {children}
      </div>
    </div>
  );
}

const ROLE_SHORT = { Líbero: "LIB", Colocador: "COL", Receptor: "REC", Central: "CEN", Opuesto: "OPU" };

// Igual que las chapas de Plantilla. Los rivales van en naranja para distinguirlos.
export function TokenShape({ element, player, clipId, selected, zone, lifted, photos }) {
  const cx = element.x * W;
  const cy = element.y * H;
  const rival = element.side === "rival";
  const position = tokenPosition(element, player);
  const libero = !rival && position === "Líbero";
  const fill = rival ? "#FF3800" : libero ? "#FCD34D" : "#09090B";
  const border = libero ? "#FCD34D" : "#FFFFFF";
  const number = player?.number ?? null;
  const center = number ?? element.label;
  // Una sola línea corta ("Ana · REC") para que las de al lado no se pisen.
  const role = position && position !== "Sin definir" ? ROLE_SHORT[position] ?? "" : "";
  const name = (element.name ?? "").trim().split(/\s+/)[0] ?? "";
  const pillWidth = Math.max((name.length + (role ? role.length + 1.2 : 0)) * 2.15, 7) + 2.6;
  const pillHeight = 5.2;
  const pillTop = cy + TOKEN_RADIUS + 0.5;
  const picture = photos ? player?.picture : null;

  return (
    <g data-el={element.id} style={{ cursor: "grab" }}>
      {/* La sombra se separa al levantar la chapa, como si la despegaras de la pizarra. */}
      <circle cx={cx + (lifted ? 1.2 : 0)} cy={cy + (lifted ? 3.6 : 0.9)} r={TOKEN_RADIUS + (lifted ? 0.6 : 0)} fill={lifted ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.35)"} />
      {element.highlight && (
        <circle className="board-pulse" cx={cx} cy={cy} r={TOKEN_RADIUS + 2.4} fill="rgba(255,56,0,0.18)" stroke="#FF3800" strokeWidth="1.3" />
      )}
      {selected && <circle cx={cx} cy={cy} r={TOKEN_RADIUS + 2} fill="none" stroke="#FFFFFF" strokeWidth="0.8" strokeDasharray="2 1.4" />}
      <circle cx={cx} cy={cy} r={TOKEN_RADIUS} fill={fill} stroke={element.highlight ? "#FF8800" : border} strokeWidth="1.1" />
      {picture ? (
        <>
          <clipPath id={clipId}><circle cx={cx} cy={cy} r={TOKEN_RADIUS - 0.6} /></clipPath>
          <image href={picture} x={cx - TOKEN_RADIUS} y={cy - TOKEN_RADIUS} width={TOKEN_RADIUS * 2} height={TOKEN_RADIUS * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
          {number !== null && (
            <>
              <circle cx={cx + 6.4} cy={cy + 5.6} r="3.3" fill="#09090B" stroke="#FFFFFF" strokeWidth="0.7" />
              <text x={cx + 6.4} y={cy + 6.9} textAnchor="middle" fontSize="3.6" fontWeight="900" fill="#FFFFFF">{number}</text>
            </>
          )}
        </>
      ) : (
        <text x={cx} y={cy + 1.9} textAnchor="middle" fontSize="5.2" fontWeight="900" fill={libero ? "#09090B" : "#FFFFFF"}>{center}</text>
      )}
      {zone && (
        <g>
          <circle cx={cx - 6.3} cy={cy - 5.7} r="2.9" fill={rival ? "#FFFFFF" : "#FF3800"} stroke={rival ? "#FF3800" : "#FFFFFF"} strokeWidth="0.55" />
          <text x={cx - 6.3} y={cy - 4.5} textAnchor="middle" fontSize="3.5" fontWeight="900" fill={rival ? "#FF3800" : "#FFFFFF"}>{zone}</text>
        </g>
      )}
      {(name || role) && <rect x={cx - pillWidth / 2} y={pillTop} width={pillWidth} height={pillHeight} rx="1.8" fill="rgba(0,0,0,0.75)" />}
      {(name || role) && (
        <text x={cx} y={pillTop + 3.7} textAnchor="middle" fontSize="3.5" fontWeight="700" fill="#FFFFFF">
          {name}
          {role && <tspan fill={rival ? "#FFD2BF" : "#FF8800"} fontWeight="900" fontSize="3">{name ? " " : ""}{role}</tspan>}
        </text>
      )}
    </g>
  );
}

// `progress` < 1 mientras la flecha se está dibujando al reproducir la jugada.
function ArrowShape({ element, markerPrefix, selected, progress = 1 }) {
  if (progress <= 0) return null;
  const color = element.style === "pass" ? PASS_COLOR : MOVE_COLOR;
  const line = {
    x1: element.x1 * W,
    y1: element.y1 * H,
    x2: (element.x1 + (element.x2 - element.x1) * progress) * W,
    y2: (element.y1 + (element.y2 - element.y1) * progress) * H,
  };
  return (
    <g data-el={element.id}>
      <line {...line} stroke="transparent" strokeWidth="9" strokeLinecap="round" />
      <line
        {...line}
        stroke={selected ? "#FFD400" : color}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeDasharray={element.style === "pass" ? "3 2.4" : undefined}
        markerEnd={`url(#${markerPrefix}-${element.style})`}
      />
    </g>
  );
}

// Balón con los colores de un Molten (verde, rojo y blanco en espiral).
export const BALL_RADIUS = 5;
const BALL_PANELS = ["#0F8A3C", "#D7262E", "#FFFFFF"];
const polar = (degrees, scale = 1) => {
  const radians = (degrees * Math.PI) / 180;
  return `${(Math.cos(radians) * BALL_RADIUS * scale).toFixed(2)} ${(Math.sin(radians) * BALL_RADIUS * scale).toFixed(2)}`;
};
// Una "aspa" curvada del centro al borde: tres giradas forman la espiral del balón.
const BALL_SWIRL = `M0 0 Q${polar(-40, 0.75)} ${polar(0)} A${BALL_RADIUS} ${BALL_RADIUS} 0 0 1 ${polar(105)} Q${polar(60, 0.55)} 0 0 Z`;

// El giro sale de dónde está: al llevarlo a la derecha rueda hacia la derecha, a la izquierda al revés,
// y en vertical no gira. Así también rueda solo al reproducir una jugada grabada.
const ballSpin = (x) => ((x * W) / BALL_RADIUS) * (180 / Math.PI);

// `height`: en la vista de arriba, el balón en el aire se ve algo más grande y con la sombra separada.
export function BallShape({ element, selected, lifted, height = 0, flash = 0 }) {
  const cx = element.x * W;
  const cy = element.y * H;
  const grow = 1 + Math.min(0.6, height / 90);
  const shadowGap = lifted ? 4 : 0.9 + Math.min(10, height * 0.16);
  return (
    <g data-el={element.id} style={{ cursor: "grab" }}>
      <circle cx={cx + (lifted ? 1.4 : height * 0.06)} cy={cy + shadowGap} r={BALL_RADIUS * (1 - Math.min(0.35, height / 140))} fill={lifted || height > 1 ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.3)"} />
      {flash > 0 && (
        <circle cx={cx} cy={cy} r={BALL_RADIUS * grow * (1.3 + (1 - flash) * 1.8)} fill="rgba(255,255,255,0.25)" stroke="#FFFFFF" strokeOpacity={flash} strokeWidth="0.8" />
      )}
      <g transform={`translate(${cx} ${cy}) rotate(${ballSpin(element.x).toFixed(1)}) scale(${grow.toFixed(3)})`}>
        <circle r={BALL_RADIUS} fill="#FFFFFF" />
        {BALL_PANELS.map((color, index) => (
          <path key={color} d={BALL_SWIRL} transform={`rotate(${index * 120})`} fill={color} stroke="#3F3F46" strokeWidth="0.25" strokeLinejoin="round" />
        ))}
        <circle r={BALL_RADIUS * 0.16} fill="#FFFFFF" stroke="#3F3F46" strokeWidth="0.2" />
      </g>
      <circle cx={cx - 1.6 * grow} cy={cy - 1.8 * grow} r={BALL_RADIUS * 0.32 * grow} fill="rgba(255,255,255,0.35)" />
      <circle cx={cx} cy={cy} r={BALL_RADIUS * grow} fill="none" stroke={selected ? "#FFD400" : "#0A0A0C"} strokeWidth={selected ? 1.4 : 0.7} />
    </g>
  );
}

function ElementShape({ element, player, uid, selected, zone, progress, lifted = false, photos = true, height = 0, flash = 0 }) {
  switch (element.type) {
    case "token":
      return <TokenShape element={element} player={player} clipId={`${uid}-clip-${element.id}`} selected={selected} zone={zone} lifted={lifted} photos={photos} />;
    case "ball":
      return <BallShape element={element} selected={selected} lifted={lifted} height={height} flash={flash} />;
    case "arrow":
      return <ArrowShape element={element} markerPrefix={`${uid}-arrow`} selected={selected} progress={progress} />;
    case "zone":
      return (
        <rect
          data-el={element.id}
          x={element.x * W}
          y={element.y * H}
          width={element.w * W}
          height={element.h * H}
          rx="1.5"
          fill="rgba(255,255,255,0.22)"
          stroke={selected ? "#FFD400" : "#FFFFFF"}
          strokeWidth="0.8"
          strokeDasharray="2.4 1.8"
        />
      );
    case "text":
      return (
        <text
          data-el={element.id}
          x={element.x * W}
          y={element.y * H}
          textAnchor="middle"
          fontSize="6"
          fontWeight="800"
          fill={selected ? "#FFD400" : "#FFFFFF"}
          stroke="#0A0A0C"
          strokeWidth="1.3"
          paintOrder="stroke"
          style={{ cursor: "grab" }}
        >
          {element.text}
        </text>
      );
    case "stroke": {
      const points = element.points.map(([x, y]) => `${x * W},${y * H}`).join(" ");
      return (
        <g data-el={element.id}>
          <polyline points={points} fill="none" stroke="transparent" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={points} fill="none" stroke={selected ? "#FFD400" : "#FFFFFF"} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    }
    default:
      return null;
  }
}

function Handles({ element }) {
  const spots =
    element?.type === "arrow"
      ? [["start", element.x1, element.y1], ["end", element.x2, element.y2]]
      : element?.type === "zone"
        ? [["corner", element.x + element.w, element.y + element.h]]
        : [];
  return spots.map(([handle, x, y]) => (
    <circle key={handle} data-handle={handle} cx={x * W} cy={y * H} r={HANDLE_RADIUS} fill="#FFD400" stroke="#0A0A0C" strokeWidth="0.7" />
  ));
}

const LAYERS = ["zone", "stroke", "arrow", "token", "ball", "text"];
const TRAIL_MS = 420;
// Un salto así de grande no es un movimiento (deshacer, poner una alineación…): no deja estela.
const TRAIL_JUMP = 0.2;

// Guarda por dónde ha pasado cada balón en el último medio segundo para pintar su estela.
function useBallTrails(elements, enabled) {
  const trails = useRef(new Map());
  const frame = useRef(null);
  const [, redraw] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const now = performance.now();
    const balls = elements.filter((element) => element.type === "ball");
    let moved = false;
    balls.forEach((ball) => {
      const points = trails.current.get(ball.id) ?? [];
      const last = points.at(-1);
      if (last && last.x === ball.x && last.y === ball.y) return;
      if (last && Math.hypot(ball.x - last.x, ball.y - last.y) > TRAIL_JUMP) points.length = 0;
      points.push({ x: ball.x, y: ball.y, t: now });
      trails.current.set(ball.id, points);
      moved = true;
    });
    const ids = new Set(balls.map((ball) => ball.id));
    [...trails.current.keys()].forEach((id) => {
      if (!ids.has(id)) trails.current.delete(id);
    });
    if (!moved || frame.current !== null) return;
    // Se sigue pintando hasta que la estela se apaga del todo, aunque el balón ya esté quieto.
    const tick = () => {
      const cutoff = performance.now() - TRAIL_MS;
      let alive = false;
      trails.current.forEach((points) => {
        while (points.length > 1 && points[0].t < cutoff) points.shift();
        if (points.length > 1) alive = true;
      });
      redraw((count) => count + 1);
      frame.current = alive ? requestAnimationFrame(tick) : null;
    };
    frame.current = requestAnimationFrame(tick);
  }, [elements, enabled]);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  return enabled ? trails.current : null;
}

function BallTrails({ trails }) {
  const now = performance.now();
  const segments = [];
  trails.forEach((points, id) => {
    for (let index = 1; index < points.length; index += 1) {
      const fade = 1 - (now - points[index].t) / TRAIL_MS;
      if (fade <= 0) continue;
      segments.push(
        <line
          key={`${id}-${points[index].t}`}
          x1={points[index - 1].x * W}
          y1={points[index - 1].y * H}
          x2={points[index].x * W}
          y2={points[index].y * H}
          stroke="#FFFFFF"
          strokeOpacity={fade * 0.55}
          strokeWidth={BALL_RADIUS * 1.5 * fade}
          strokeLinecap="round"
        />,
      );
    }
  });
  return <g aria-hidden="true" pointerEvents="none">{segments}</g>;
}

const NET_Y = 95;
const NET_SHAKE_MS = 650;

// La red tiembla cuando un balón la cruza; la onda sale del punto por donde pasa.
function NetShake({ x, onDone }) {
  const [age, setAge] = useState(0);
  // La pista se vuelve a pintar en cada fotograma al reproducir: el temblor no debe empezar de nuevo.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const started = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = now - started;
      if (elapsed >= NET_SHAKE_MS) {
        done.current();
        return;
      }
      setAge(elapsed);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const strength = 2.4 * Math.exp(-age / 180);
  const wave = (offset) => {
    const points = [];
    for (let px = 2; px <= 98; px += 2) {
      const spread = Math.exp(-(((px - x) / 22) ** 2));
      points.push(`${px},${(NET_Y + offset + strength * spread * Math.sin(age / 28 + px / 6)).toFixed(2)}`);
    }
    return points.join(" ");
  };
  return (
    <g aria-hidden="true" pointerEvents="none">
      <polyline points={wave(-1.6)} fill="none" stroke="#FFFFFF" strokeWidth="0.6" />
      <polyline points={wave(1.6)} fill="none" stroke="#FFFFFF" strokeWidth="0.6" />
      <circle cx={x} cy={NET_Y} r={2 + age / 60} fill="none" stroke="#FFFFFF" strokeOpacity={Math.max(0, 0.8 - age / NET_SHAKE_MS)} strokeWidth="0.8" />
    </g>
  );
}

// Detecta cuándo un balón pasa de un campo al otro.
function useNetCrossing(elements, enabled) {
  const previous = useRef(new Map());
  const [shake, setShake] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    const net = NET_Y / H;
    elements.forEach((element) => {
      if (element.type !== "ball") return;
      const before = previous.current.get(element.id);
      previous.current.set(element.id, { x: element.x, y: element.y });
      if (!before || (before.y - net) * (element.y - net) >= 0) return;
      if (Math.hypot(element.x - before.x, element.y - before.y) > TRAIL_JUMP) return;
      const along = (net - before.y) / (element.y - before.y);
      setShake({ x: (before.x + (element.x - before.x) * along) * W, key: performance.now() });
    });
  }, [elements, enabled]);
  return [shake, () => setShake(null)];
}

// Solo dibuja: la pizarra interactiva y las miniaturas de la biblioteca usan esto mismo.
// `effects` lleva los efectos del momento: el salto de una chapa y el bote de un balón.
export default function BoardScene({ elements, rosterById = {}, selectedId = null, draft = [], svgRef, svgProps, label, trails: showTrails = false, arrowProgress = null, zones = null, liftedId = null, effects = null, photos = true, actions = null, heights = null, flashes = null }) {
  const uid = useId().replace(/:/g, "");
  const trails = useBallTrails(elements, showTrails);
  const [shake, clearShake] = useNetCrossing(elements, showTrails);
  const ordered = LAYERS.flatMap((type) => elements.filter((element) => element.type === type));
  const selected = elements.find((element) => element.id === selectedId);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="absolute inset-0 h-full w-full select-none" {...svgProps}>
      <defs>
        {[["move", MOVE_COLOR], ["pass", PASS_COLOR]].map(([style, color]) => (
          <marker key={style} id={`${uid}-arrow-${style}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill={color} />
          </marker>
        ))}
      </defs>
      {shake && <NetShake key={shake.key} x={shake.x} onDone={clearShake} />}
      {ordered.map((element) => {
        const jump = effects?.jump?.id === element.id ? effects.jump : null;
        const bounce = effects?.bounce?.id === element.id ? effects.bounce : null;
        const lifted = element.id === liftedId;
        const animation = jump ? "board-jump" : bounce ? "board-bounce" : lifted ? "board-lifted" : "";
        const doing = element.type === "token" ? actions?.get(element.id) : null;
        const cx = (element.x ?? 0) * W;
        const cy = (element.y ?? 0) * H;
        return (
          <g key={element.id}>
            {element.type === "ball" && trails && <BallTrails trails={new Map([[element.id, trails.get(element.id) ?? []]])} />}
            <g
              key={jump?.key ?? bounce?.key ?? "still"}
              className={animation ? `board-fx ${animation}` : undefined}
              transform={doing ? `translate(${cx} ${cy}) scale(${actionScale(doing).toFixed(3)}) translate(${-cx} ${-cy})` : undefined}
            >
              <ElementShape
                element={element}
                player={rosterById[element.player_id]}
                uid={uid}
                selected={element.id === selectedId}
                zone={zones?.get(element.id)}
                progress={arrowProgress?.get(element.id) ?? 1}
                lifted={lifted}
                photos={photos}
                height={heights?.get(element.id) ?? 0}
                flash={flashes?.get(element.id) ?? 0}
              />
            </g>
          </g>
        );
      })}
      {actions &&
        elements
          .filter((element) => element.type === "token" && actions.has(element.id))
          .map((element) => {
            const doing = actions.get(element.id);
            const label = actionLabel(doing.action, doing.tempo).toUpperCase();
            const width = label.length * 2.6 + 4;
            const x = element.x * W;
            const y = element.y * H - TOKEN_RADIUS * actionScale(doing) - 3;
            return (
              <g key={`action-${element.id}`} opacity={Math.min(1, Math.sin(Math.PI * doing.progress) * 3).toFixed(2)} pointerEvents="none">
                <rect x={x - width / 2} y={y - 4.6} width={width} height={5.2} rx="2.4" fill="#FF3800" stroke="#FFFFFF" strokeWidth="0.4" />
                <text x={x} y={y - 0.8} textAnchor="middle" fontSize="3.5" fontWeight="900" fill="#FFFFFF">{label}</text>
              </g>
            );
          })}
      {effects?.ripple && (
        <circle
          key={effects.ripple.key}
          aria-hidden="true"
          pointerEvents="none"
          className="board-fx board-ring"
          cx={effects.ripple.x * W}
          cy={effects.ripple.y * H + 1}
          r={BALL_RADIUS}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="0.9"
        />
      )}
      {effects?.jump && (
        <circle
          key={`flash-${effects.jump.key}`}
          aria-hidden="true"
          pointerEvents="none"
          className="board-fx board-ring"
          cx={(elements.find((element) => element.id === effects.jump.id)?.x ?? 0) * W}
          cy={(elements.find((element) => element.id === effects.jump.id)?.y ?? 0) * H}
          r={TOKEN_RADIUS}
          fill="rgba(255,56,0,0.35)"
          stroke="#FF8800"
          strokeWidth="0.8"
        />
      )}
      {draft.map((element) => (
        <ElementShape key={element.id} element={element} uid={uid} selected={false} />
      ))}
      <Handles element={selected} />
    </svg>
  );
}
