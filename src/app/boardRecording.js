import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gestureDuration, hitFraction, takeoffFraction } from "@/app/character/gestureTimes.js";

export const MAX_RECORDING_MS = 120000;
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2];
export const COUNTDOWN_SECONDS = 3;
const SAMPLE_MS = 40;
const SAMPLE_DISTANCE = 0.002;
const MAX_TRACK_POINTS = 3000;
const PAUSE_MS = 150;

const round = (value) => Math.round(value * 10000) / 10000;
export const isRecordable = (element) => element?.type === "token" || element?.type === "ball";

// Lo que puede hacer un jugador en un momento de la jugada y cuánto dura cada gesto.
export const PLAYER_ACTIONS = [
  { value: "saque", label: "Sacar", duration: 1000 },
  { value: "recepcion", label: "Recibir", duration: 750 },
  { value: "colocacion", label: "Colocar", duration: 750 },
  { value: "remate", label: "Rematar", duration: 950 },
  { value: "bloqueo", label: "Bloquear", duration: 850 },
  { value: "defensa", label: "Defender", duration: 850 },
];
// Lo que hace un entrenador en los ejercicios: un balón fácil (free) o uno fuerte para defender.
export const COACH_ACTIONS = [
  { value: "free", label: "Free", duration: 750 },
  { value: "fuerte", label: "Fuerte", duration: 1000 },
];
// Con qué gesto del muñeco se hace cada acción del entrenador: la free con las dos manos por arriba
// (como colocar) y la fuerte con un golpe por arriba sin saltar (como el saque).
const POSE_OF = { free: "colocacion", fuerte: "saque" };
export const poseOf = (value) => POSE_OF[value] ?? value;
const ACTION_BY_VALUE = Object.fromEntries([...PLAYER_ACTIONS, ...COACH_ACTIONS].map((item) => [item.value, item]));
// Tiempos de colocación: cuanto más bajo el número, más rápida y más baja va la bola.
export const SET_TEMPOS = [
  { value: "3", label: "Tiempo 3", short: "T3", hint: "Muy alta: sube y cae donde la mandas" },
  { value: "2", label: "Tiempo 2", short: "T2", hint: "Media altura, más rápida" },
  { value: "1", label: "Tiempo 1", short: "T1", hint: "Rápida y baja, al central" },
  { value: "menos", label: "Tiempo menos", short: "T−", hint: "Rapidísima y plana: a la mano del atacante, que ya está arriba" },
];
const TEMPO_BY_VALUE = Object.fromEntries(SET_TEMPOS.map((item) => [item.value, item]));
export const tempoLabel = (tempo) => TEMPO_BY_VALUE[tempo]?.label ?? "";
export const actionLabel = (value, tempo = null) => {
  const label = ACTION_BY_VALUE[value]?.label ?? value;
  return tempo && TEMPO_BY_VALUE[tempo] ? `${label} ${TEMPO_BY_VALUE[tempo].short}` : label;
};
// Si se ha ajustado el ritmo del gesto en el editor, manda esa duración.
export const actionDuration = (value) => gestureDuration(poseOf(value), ACTION_BY_VALUE[value]?.duration ?? 800);
// Cuánto tarda cada gesto, desde que empieza, en tocar el balón.
const CONTACT_MS = { saque: 550, recepcion: 360, colocacion: 360, remate: 500, bloqueo: 380, defensa: 360 };
// Cuánto tarda cada gesto en despegar del suelo (null si no salta).
export const takeoffTime = (value) => {
  const fraction = takeoffFraction(poseOf(value));
  return fraction === null ? null : fraction * actionDuration(value);
};
export const contactTime = (value) => {
  const fraction = hitFraction(poseOf(value));
  return fraction === null ? CONTACT_MS[poseOf(value)] ?? 400 : fraction * actionDuration(value);
};

// La acción que está haciendo cada jugador en este momento y por dónde va (de 0 a 1).
export function actionsAt(recording, time) {
  const current = new Map();
  (recording?.actions ?? []).forEach((item) => {
    const progress = (time - item.t) / actionDuration(item.action);
    if (progress >= 0 && progress <= 1) current.set(item.id, { action: item.action, progress, tempo: item.tempo ?? null });
  });
  return current;
}

// Añade o quita una acción. Una acción por jugador y momento: si ya hay una muy cerca, se sustituye.
export function withAction(actions, id, t, action, tempo = null) {
  const others = (actions ?? []).filter((item) => !(item.id === id && Math.abs(item.t - t) < 250));
  const item = { id, t: Math.max(0, Math.round(t)), action };
  if (action === "colocacion" && tempo) item.tempo = tempo;
  const next = action ? [...others, item] : others;
  return next.sort((a, b) => a.t - b.t);
}

// Con `base`, la toma nueva se suma a una grabación que ya existe.
export function createRecorder(elements, base = null) {
  return {
    start: new Map(elements.filter(isRecordable).map((element) => [element.id, [element.x, element.y]])),
    startedAt: null,
    tracks: new Map(),
    base: base ? new Map(base.tracks.map((track) => [track.id, track.points])) : null,
    baseDuration: base?.duration_ms ?? 0,
    actions: [...(base?.actions ?? [])],
  };
}

export const recorderElapsed = (recorder) => (recorder?.startedAt ? performance.now() - recorder.startedAt : 0);

function firstPoints(recorder, element, t) {
  // Si ya tenía recorrido, se conserva hasta el momento en que lo coges.
  const kept = recorder.base?.get(element.id)?.filter((point) => point[0] < t) ?? [];
  if (kept.length > 0) return kept;
  const [x, y] = recorder.start.get(element.id) ?? [element.x, element.y];
  return [[0, x, y]];
}

// `clockMs` es el momento de la reproducción cuando se graba encima de otra toma.
export function recordPosition(recorder, element, clockMs = null) {
  const now = performance.now();
  recorder.startedAt ??= now;
  const t = Math.round(clockMs ?? now - recorder.startedAt);
  let track = recorder.tracks.get(element.id);
  if (!track) {
    track = { points: firstPoints(recorder, element, t), latest: null };
    recorder.tracks.set(element.id, track);
  }
  const previous = track.points.at(-1);
  if (t <= previous[0]) return;
  // Se queda quieta mientras no la mueves: sin este punto, la pausa se vería como un avance lento.
  if (t - previous[0] > PAUSE_MS && track.points.length < MAX_TRACK_POINTS) track.points.push([t - 1, previous[1], previous[2]]);
  const last = track.points.at(-1);
  track.latest = [t, round(element.x), round(element.y)];
  const moved = Math.hypot(element.x - last[1], element.y - last[2]);
  if (t - last[0] >= SAMPLE_MS && moved >= SAMPLE_DISTANCE && track.points.length < MAX_TRACK_POINTS) {
    track.points.push(track.latest);
  }
}

// Apunta una acción en el momento actual de la grabación.
export function recordAction(recorder, id, action, clockMs = null, tempo = null) {
  const t = clockMs ?? recorderElapsed(recorder);
  recorder.actions = withAction(recorder.actions, id, t, action, tempo);
  return t;
}

// Devuelve la grabación, o null si no se ha movido nadie ni se ha apuntado ninguna acción nueva.
export function finishRecorder(recorder, baseActions = []) {
  if (!recorder) return null;
  const newActions = recorder.actions.length !== baseActions.length || recorder.actions.some((item, index) => item !== baseActions[index]);
  if (recorder.tracks.size === 0 && !newActions) return null;
  const merged = new Map(recorder.base ?? []);
  recorder.tracks.forEach((track, id) => {
    const points = [...track.points];
    if (track.latest && track.latest[0] > points.at(-1)[0]) points.push(track.latest);
    merged.set(id, points);
  });
  const tracks = [...merged].map(([id, points]) => ({ id, points }));
  const actions = recorder.actions.filter((item) => item.t <= MAX_RECORDING_MS);
  const duration = Math.max(
    recorder.baseDuration,
    ...tracks.map((track) => track.points.at(-1)[0]),
    ...actions.map((item) => item.t + actionDuration(item.action)),
    1,
  );
  return { duration_ms: Math.min(duration, MAX_RECORDING_MS), tracks, actions };
}

function positionAt(points, time) {
  if (time >= points.at(-1)[0]) return points.at(-1);
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle][0] <= time) low = middle;
    else high = middle;
  }
  const [t1, x1, y1] = points[low];
  const [t2, x2, y2] = points[high];
  const progress = t2 === t1 ? 1 : (time - t1) / (t2 - t1);
  return [time, x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress];
}

function applyRecording(elements, recording, time, isLive) {
  const tracks = new Map((recording.tracks ?? []).map((track) => [track.id, track.points]));
  return elements.map((element) => {
    const points = tracks.get(element.id);
    if (!points || !isRecordable(element) || isLive?.(element.id)) return element;
    const [, x, y] = positionAt(points, time);
    return { ...element, x, y };
  });
}

// `isLive` dice qué fichas estás moviendo tú ahora: esas no siguen la grabación anterior.
// `tailMs`: tiempo de más al final (los botes del balón cuando acaba en el suelo).
export function useBoardPlayback(recording, elements, isLive, tailMs = 0) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const clock = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const overdubbing = useRef(false);
  const duration = recording?.duration_ms ? recording.duration_ms + tailMs : 0;

  const seek = useCallback((value) => {
    clock.current = value;
    setTime(value);
  }, []);

  const reset = useCallback(() => {
    overdubbing.current = false;
    setPlaying(false);
    seek(0);
  }, [seek]);

  // Solo vuelve al principio si cambian los movimientos: añadir una acción en pausa no mueve el tiempo.
  const tracks = recording?.tracks;
  useEffect(() => {
    reset();
  }, [tracks, duration, reset]);

  useEffect(() => {
    if (!playing) return undefined;
    let frame;
    let last = performance.now();
    const tick = (now) => {
      // El primer fotograma puede llegar con una hora algo anterior: nunca se retrocede.
      clock.current += Math.max(0, now - last) * speedRef.current;
      last = now;
      // Al acabar, cada uno vuelve a su sitio. Grabando encima, se sigue mientras quieras.
      if (clock.current >= duration && !overdubbing.current) {
        reset();
        return;
      }
      setTime(clock.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, reset]);

  const startOverdub = useCallback(() => {
    overdubbing.current = true;
    seek(0);
    setPlaying(true);
  }, [seek]);

  const active = playing || time > 0;
  const shown = useMemo(
    () => (active && recording ? applyRecording(elements, recording, time, isLive) : elements),
    // `isLive` cambia en cada render, pero su respuesta solo importa cuando avanza el tiempo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, recording, elements, time],
  );

  return {
    playing,
    time,
    speed,
    duration,
    active,
    shown,
    seek,
    reset,
    setSpeed,
    startOverdub,
    clock: () => clock.current,
    toggle: () => setPlaying((value) => !value),
    pause: () => setPlaying(false),
  };
}
