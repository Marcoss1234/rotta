import { useEffect, useRef, useState } from "react";
import BoardScene from "@/app/components/board/BoardScene.jsx";
import { isRecordable } from "@/app/boardRecording.js";
import { COURT_HEIGHT, COURT_WIDTH, moveHandle, moveLine, newElementId, roundCoord, translateElement } from "@/app/boards.js";

const TAP_DISTANCE = 0.006;
// Dos toques en menos de esto sobre la misma chapa son un doble toque.
const DOUBLE_TAP_MS = 280;
const MIN_SHAPE = 0.03;
// Jugada por pasos: mantener pulsado a un jugador (o arrastrarlo) marca a dónde se mueve en ese paso.
const HOLD_MS = 350;
const MIN_MOVE = 0.04;
const PEN_STEP = 0.006;
const MAX_PEN_POINTS = 400;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function arrowBetween(start, end, style, id) {
  return { id, type: "arrow", style, x1: roundCoord(start.x), y1: roundCoord(start.y), x2: roundCoord(end.x), y2: roundCoord(end.y) };
}

function zoneBetween(start, end, id) {
  const x = roundCoord(Math.min(start.x, end.x));
  const y = roundCoord(Math.min(start.y, end.y));
  return { id, type: "zone", x, y, w: roundCoord(Math.abs(end.x - start.x)), h: roundCoord(Math.abs(end.y - start.y)) };
}

// Convierte los gestos sobre la pista en cambios. Quien la usa guarda el resultado y lleva el deshacer.
export default function BoardCanvas({ elements, rosterById, tool, arrowStyle, textValue, selectedId, readOnly, label, onChange, onSelect, onTextPlaced, onTokenTap, onTokenDoubleTap, onBallDrop, onActionTap, actionTaps = false, planning = false, onPlanTap, onPlanMove, onPlaceLine, extraDraft = [], recording, onRecordMove, trails, arrowProgress, zones, effects, photos, actions, heights, flashes }) {
  const svgRef = useRef(null);
  // Uno por dedo: al grabar se puede mover a dos jugadores a la vez.
  const gestures = useRef(new Map());
  const latest = useRef(elements);
  const [draft, setDraft] = useState([]);
  const [liftedId, setLiftedId] = useState(null);
  const lastTap = useRef(null);

  useEffect(() => () => clearTimeout(lastTap.current?.timer), []);

  // Un toque abre la chapa; si llega otro enseguida, es un doble toque y no se abre nada.
  const tapToken = (id) => {
    const previous = lastTap.current;
    if (previous && previous.id === id && performance.now() - previous.at < DOUBLE_TAP_MS) {
      clearTimeout(previous.timer);
      lastTap.current = null;
      onTokenDoubleTap?.(id);
      return;
    }
    clearTimeout(previous?.timer);
    lastTap.current = {
      id,
      at: performance.now(),
      timer: setTimeout(() => {
        lastTap.current = null;
        onTokenTap(id);
      }, onTokenDoubleTap ? DOUBLE_TAP_MS : 0),
    };
  };

  useEffect(() => {
    latest.current = elements;
  }, [elements]);

  const pointAt = (event) => {
    const svg = svgRef.current;
    const matrix = svg.getScreenCTM().inverse();
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    return { x: Math.min(1, Math.max(0, point.x / COURT_WIDTH)), y: Math.min(1, Math.max(0, point.y / COURT_HEIGHT)) };
  };

  const update = (id, change) => {
    const next = latest.current.map((element) => (element.id === id ? change(element) : element));
    latest.current = next;
    onChange(next, false);
  };

  const onPointerDown = (event) => {
    if (readOnly || event.button > 0) return;
    const point = pointAt(event);
    const handle = event.target.closest?.("[data-handle]")?.dataset.handle;
    const hit = event.target.closest?.("[data-el]")?.dataset.el;
    event.currentTarget.setPointerCapture(event.pointerId);
    const hitElement = latest.current.find((element) => element.id === hit);

    // Jugada por pasos: cada toque elige un jugador o un punto de la pista.
    if (planning) {
      // Si el balón u otra cosa tapa al jugador, vale con tocar cerca de él.
      const nearest = latest.current
        .filter((element) => element.type === "token")
        .map((element) => ({ id: element.id, gap: Math.hypot((element.x - point.x) * COURT_WIDTH, (element.y - point.y) * COURT_HEIGHT) }))
        .sort((a, b) => a.gap - b.gap)[0];
      const player = hitElement?.type === "token" ? hit : nearest && nearest.gap < 9 ? nearest.id : null;
      const gesture = { type: "plan", start: point, hit: player, moving: false, timer: null };
      if (player) {
        // Al mantenerlo pulsado "se levanta" y ya se puede llevar a su sitio.
        gesture.timer = setTimeout(() => {
          gesture.moving = true;
          setLiftedId(player);
          navigator.vibrate?.(15);
        }, HOLD_MS);
      }
      gestures.current.set(event.pointerId, gesture);
      return;
    }
    // Con la jugada en pausa solo se puede tocar a un jugador para ponerle una acción.
    if (actionTaps) {
      if (hitElement?.type === "token") gestures.current.set(event.pointerId, { type: "action", id: hit, start: point });
      return;
    }
    if (recording) {
      if (isRecordable(hitElement)) {
        gestures.current.set(event.pointerId, { type: "record", id: hit, start: point, last: point, moved: false });
        setLiftedId(hit);
      }
      return;
    }
    if (tool === "move") {
      const lineHit = event.target.closest?.("[data-line]")?.dataset.line;
      if (!hit && lineHit) {
        onSelect(null);
        gestures.current.set(event.pointerId, { type: "line", id: lineHit, start: point, last: point, moved: false });
        return;
      }
      if (handle && selectedId) {
        gestures.current.set(event.pointerId, { type: "handle", id: selectedId, handle, moved: false });
      } else if (hit) {
        onSelect(hit);
        gestures.current.set(event.pointerId, { type: "move", id: hit, start: point, last: point, moved: false });
      } else {
        onSelect(null);
      }
      return;
    }
    onSelect(null);
    gestures.current.set(event.pointerId, { type: tool, start: point, points: [point], id: newElementId() });
  };

  const onPointerMove = (event) => {
    const current = gestures.current.get(event.pointerId);
    if (!current) return;
    const point = pointAt(event);

    if (current.type === "plan") {
      // Arrastrar desde un jugador también vale, sin esperar.
      if (current.hit && !current.moving && distance(point, current.start) >= TAP_DISTANCE * 3) {
        current.moving = true;
        setLiftedId(current.hit);
      }
      if (current.moving) {
        clearTimeout(current.timer);
        const player = latest.current.find((element) => element.id === current.hit);
        if (player) setDraft([{ ...arrowBetween({ x: player.x, y: player.y }, point, "move", "plan-drag"), id: "plan-drag" }]);
      }
      return;
    }
    if (current.type === "record") {
      // Un toque sin mover es para elegir una acción, no un movimiento.
      if (!current.moved && distance(point, current.start) < TAP_DISTANCE) return;
      current.moved = true;
      const { last } = current;
      let moved;
      update(current.id, (element) => {
        moved = translateElement(element, point.x - last.x, point.y - last.y);
        return moved;
      });
      current.last = point;
      onRecordMove(moved);
    } else if (current.type === "move") {
      if (!current.moved && distance(point, current.start) < TAP_DISTANCE) return;
      if (!current.moved) setLiftedId(current.id);
      current.moved = true;
      const { last } = current;
      update(current.id, (element) => translateElement(element, point.x - last.x, point.y - last.y));
      current.last = point;
    } else if (current.type === "line") {
      if (!current.moved && distance(point, current.start) < TAP_DISTANCE) return;
      current.moved = true;
      const next = moveLine(latest.current, current.id, point.x - current.last.x, point.y - current.last.y);
      latest.current = next;
      onChange(next, false);
      current.last = point;
    } else if (current.type === "handle") {
      current.moved = true;
      update(current.id, (element) => moveHandle(element, current.handle, point));
    } else if (current.type === "arrow") {
      setDraft([arrowBetween(current.start, point, arrowStyle, current.id)]);
    } else if (current.type === "zone") {
      setDraft([zoneBetween(current.start, point, current.id)]);
    } else if (current.type === "pen") {
      const last = current.points.at(-1);
      if (distance(point, last) >= PEN_STEP && current.points.length < MAX_PEN_POINTS) {
        current.points.push(point);
        setDraft([{ id: current.id, type: "stroke", points: current.points.map(({ x, y }) => [roundCoord(x), roundCoord(y)]) }]);
      }
    }
  };

  const add = (element) => {
    const next = [...latest.current, element];
    latest.current = next;
    onChange(next, true);
  };

  const finish = (event, cancelled) => {
    const current = gestures.current.get(event.pointerId);
    gestures.current.delete(event.pointerId);
    setDraft([]);
    if (current?.type === "record" || current?.type === "move") {
      setLiftedId(null);
      const dropped = latest.current.find((element) => element.id === current.id);
      if (dropped?.type === "ball" && current.moved) onBallDrop?.(dropped);
      if (current.type === "record" && !current.moved && !cancelled && dropped?.type === "token") onActionTap?.(current.id);
    }
    if (current?.type === "plan") {
      clearTimeout(current.timer);
      const point = pointAt(event);
      if (current.moving) {
        setLiftedId(null);
        const player = latest.current.find((element) => element.id === current.hit);
        if (!cancelled && player && distance(point, player) >= MIN_MOVE) onPlanMove?.(current.hit, point);
        return;
      }
      if (!cancelled && distance(point, current.start) < TAP_DISTANCE * 3) onPlanTap?.(current.start, current.hit);
      return;
    }
    if (current?.type === "action") {
      if (!cancelled && distance(pointAt(event), current.start) < TAP_DISTANCE * 3) onActionTap?.(current.id);
      return;
    }
    if (!current || current.type === "record") return;
    if (cancelled) {
      onChange(latest.current, Boolean(current.moved));
      return;
    }
    const point = pointAt(event);
    const far = distance(point, current.start ?? point) >= MIN_SHAPE;

    if ((current.type === "move" || current.type === "handle" || current.type === "line") && current.moved) onChange(latest.current, true);
    if (current.type === "place-line" && !far) onPlaceLine?.(point);
    if (current.type === "move" && !current.moved && latest.current.find((element) => element.id === current.id)?.type === "token") {
      tapToken(current.id);
    }
    if (current.type === "arrow" && far) add(arrowBetween(current.start, point, arrowStyle, current.id));
    if (current.type === "zone" && Math.abs(point.x - current.start.x) >= MIN_SHAPE && Math.abs(point.y - current.start.y) >= MIN_SHAPE) {
      add(zoneBetween(current.start, point, current.id));
    }
    if (current.type === "pen" && current.points.length >= 2) {
      add({ id: current.id, type: "stroke", points: current.points.map(({ x, y }) => [roundCoord(x), roundCoord(y)]) });
    }
    if (current.type === "text" && textValue.trim()) {
      add({ id: current.id, type: "text", x: roundCoord(point.x), y: roundCoord(point.y), text: textValue.trim() });
      onTextPlaced();
    }
  };

  return (
    <BoardScene
      elements={elements}
      rosterById={rosterById}
      selectedId={selectedId}
      draft={[...extraDraft, ...draft]}
      lineBoxes={tool === "move" && !planning && !recording && !actions}
      trails={trails}
      arrowProgress={arrowProgress}
      zones={zones}
      liftedId={liftedId}
      effects={effects}
      photos={photos}
      actions={actions}
      heights={heights}
      flashes={flashes}
      svgRef={svgRef}
      label={label}
      svgProps={
        readOnly
          ? undefined
          : {
              onPointerDown,
              onPointerMove,
              onPointerUp: (event) => finish(event, false),
              onPointerCancel: (event) => finish(event, true),
              style: { touchAction: "none", cursor: tool === "move" ? "default" : "crosshair" },
            }
      }
    />
  );
}
