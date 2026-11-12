// Captura de gestos: herramienta solo para el ordenador (npm run dev). No forma parte de la app.
// Saca de un vídeo, fotograma a fotograma, dónde están las articulaciones (MediaPipe Pose, de Google,
// que funciona dentro del navegador: el vídeo no sale del ordenador) y lo pasa a las posturas del muñeco.
// Lo guardado va a src/app/character/captured-gestures.json, que usan el perfil y la pizarra.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createPlayer, keyPose, posePlayer, studioLighting } from "@/app/character/character3D.js";
import { capturedGestures } from "@/app/character/gestureTimes.js";
import { lookFromSeed } from "@/app/character/looks.js";

// Al guardar cambia captured-gestures.json: sin esto la página se recargaría y perderías el análisis.
if (import.meta.hot) import.meta.hot.accept(["/src/app/character/gestureTimes.js", "/src/app/character/character3D.js"], () => {});

const MEDIAPIPE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task";

const GESTURES = {
  remate: "Remate",
  saque: "Saque",
  recepcion: "Recepción",
  colocacion: "Colocación",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

// Puntos de MediaPipe que usamos (izquierda y derecha son las de la persona).
const LM = {
  lEar: 7, rEar: 8, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16, lIndex: 19, rIndex: 20,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28, lHeel: 29, rHeel: 30, lFoot: 31, rFoot: 32,
};
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32], [27, 29], [28, 30], [15, 19], [16, 20]];

// Del muñeco a tamaño 1: de los tobillos a la altura de los hombros (postura de pie).
const FIGURE_SHOULDERS_OVER_FEET = 1.38;
const FOOT_HEIGHT = 0.04;
// Lo que tarda en pasar de la postura de espera al primer fotograma (y del último a la espera).
// Cómo entra y sale cada gesto desde la postura de espera (posturas clave y milisegundos de cada tramo).
// En el remate y el bloqueo, antes del vídeo va la batida (agacharse e impulsarse) y después la caída.
const ENTRIES = {
  remate: [["ready"], ["spikeLoad", 300], ["spikeRise", 110], ["clip", 90]],
  bloqueo: [["ready"], ["blockLoad", 220], ["clip", 120]],
};
const EXITS = {
  remate: [["clip"], ["land", 180], ["ready", 300]],
  bloqueo: [["clip"], ["land", 160], ["ready", 260]],
};
const DEFAULT_ENTRY = [["ready"], ["clip", 320]];
const DEFAULT_EXIT = [["clip"], ["ready", 320]];
const OUTPUT_FPS = 60;

const $ = (id) => document.getElementById(id);
const video = $("video");
const overlay = $("overlay");
const status = (text) => {
  $("status").textContent = text;
};

const state = {
  gesture: "remate",
  fps: 30,
  raw: null, // [{ image, world }] por fotograma analizado
  start: 0,
  end: 0,
  hit: 0,
  frame: 0,
  playing: false,
  playStart: 0,
  draft: null,
  takeoff: null,
  landing: null,
};

// ---------- Panel ----------
Object.entries(GESTURES).forEach(([value, label]) => {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = `${label}${capturedGestures[value] ? " · capturado" : ""}`;
  $("gesture").append(option);
});
$("gesture").value = state.gesture;
$("gesture").addEventListener("change", (event) => {
  state.gesture = event.target.value;
  rebuild();
});

const sliderText = (id, format) => {
  const input = $(id);
  const out = $(`${id}Out`);
  const show = () => {
    out.textContent = format(Number(input.value));
  };
  input.addEventListener("input", show);
  show();
};
sliderText("fps", (value) => String(value));
sliderText("speed", (value) => `${value.toFixed(2).replace(/0$/, "").replace(".", ",")}×`);
sliderText("smooth", (value) => value.toFixed(1).replace(".", ","));
sliderText("slowmo", (value) => (value <= 1 ? "no" : `${String(value).replace(".", ",")}×`));
sliderText("jumpHeight", (value) => `${value.toFixed(2).replace(".", ",")} m`);
sliderText("airTime", (value) => `${value.toFixed(2).replace(".", ",")} s`);
sliderText("hang", (value) => value.toFixed(2).replace(/0$/, "").replace(".", ","));
$("fps").addEventListener("input", (event) => {
  state.fps = Number(event.target.value);
});
["speed", "smooth", "mirror", "travel", "slowmo", "jumpHeight", "manualJump", "bookends", "airTime", "hang", "peakHit"].forEach((id) => $(id).addEventListener("input", () => rebuild()));

function loadVideo(url) {
  video.src = url;
  $("drop").hidden = true;
  status("Vídeo cargado. Pulsa «Analizar vídeo».");
  video.addEventListener(
    "loadedmetadata",
    () => {
      $("analyze").disabled = false;
      fitOverlay();
      status(`Vídeo de ${video.duration.toFixed(1).replace(".", ",")} s (${video.videoWidth}×${video.videoHeight}). Pulsa «Analizar vídeo».`);
    },
    { once: true },
  );
}
$("file").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) loadVideo(URL.createObjectURL(file));
});
// Para probar: ?video=videos/remate.mp4 (la carpeta videos no se sube a git).
const fromQuery = new URLSearchParams(location.search).get("video");
if (fromQuery) loadVideo(fromQuery);

function fitOverlay() {
  const box = $("videoBox").getBoundingClientRect();
  const scale = Math.min(box.width / video.videoWidth, box.height / video.videoHeight) || 1;
  const width = video.videoWidth * scale;
  const height = video.videoHeight * scale;
  [video, overlay].forEach((element) => {
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
  });
  overlay.width = width;
  overlay.height = height;
  drawOverlay();
}
window.addEventListener("resize", fitOverlay);

// ---------- Análisis con MediaPipe ----------
let landmarker = null;
async function createLandmarker() {
  const vision = await import(/* @vite-ignore */ `${MEDIAPIPE}/vision_bundle.mjs`);
  const fileset = await vision.FilesetResolver.forVisionTasks(`${MEDIAPIPE}/wasm`);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.3,
    minPosePresenceConfidence: 0.3,
    minTrackingConfidence: 0.3,
  });
  try {
    return await vision.PoseLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    return vision.PoseLandmarker.createFromOptions(fileset, options("CPU"));
  }
}

const seek = (time) =>
  new Promise((resolve) => {
    video.addEventListener("seeked", resolve, { once: true });
    video.currentTime = time;
  });

// Zona con imagen de verdad (sin bandas negras), mirando varios fotogramas.
async function contentBox() {
  const probe = document.createElement("canvas");
  probe.width = 192;
  probe.height = Math.max(1, Math.round((192 * video.videoHeight) / video.videoWidth));
  const context = probe.getContext("2d", { willReadFrequently: true });
  let left = probe.width;
  let right = 0;
  let top = probe.height;
  let bottom = 0;
  for (const fraction of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    await seek(video.duration * fraction);
    context.drawImage(video, 0, 0, probe.width, probe.height);
    const { data } = context.getImageData(0, 0, probe.width, probe.height);
    for (let y = 0; y < probe.height; y += 1) {
      for (let x = 0; x < probe.width; x += 1) {
        const at = (y * probe.width + x) * 4;
        if (data[at] + data[at + 1] + data[at + 2] > 60) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
  }
  const scale = video.videoWidth / probe.width;
  if (right <= left || bottom <= top) return { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight };
  const x = Math.max(0, Math.floor((left - 1) * scale));
  const y = Math.max(0, Math.floor((top - 1) * scale));
  return {
    x,
    y,
    width: Math.min(video.videoWidth - x, Math.ceil((right - left + 3) * scale)),
    height: Math.min(video.videoHeight - y, Math.ceil((bottom - top + 3) * scale)),
  };
}

$("analyze").addEventListener("click", async () => {
  $("analyze").disabled = true;
  const bar = $("progress");
  bar.hidden = false;
  try {
    status("Preparando el detector (la primera vez descarga unos 30 MB)…");
    landmarker ??= await createLandmarker();
    const total = Math.floor(video.duration * state.fps);
    const raw = [];
    video.pause();
    // Sin las bandas negras la persona sale más grande y se detecta mucho mejor.
    const box = await contentBox();
    const crop = document.createElement("canvas");
    crop.width = box.width;
    crop.height = box.height;
    const cropContext = crop.getContext("2d");
    const back = (marks) =>
      marks?.map((mark) => ({ ...mark, x: (box.x + mark.x * box.width) / video.videoWidth, y: (box.y + mark.y * box.height) / video.videoHeight })) ?? null;
    for (let index = 0; index <= total; index += 1) {
      await seek(Math.min(video.duration - 0.001, index / state.fps));
      cropContext.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
      const result = landmarker.detectForVideo(crop, Math.round((index * 1000) / state.fps) + 1);
      raw.push({ image: back(result.landmarks?.[0]), world: result.worldLandmarks?.[0] ?? null });
      bar.value = index / total;
      if (index % 5 === 0) status(`Analizando… ${Math.round((index / total) * 100)} %`);
    }
    const found = raw.filter((item) => item.world).length;
    if (found < 10) throw new Error("No se ha encontrado a nadie en el vídeo. Prueba con otro con el cuerpo entero.");
    remember(raw);
    useAnalysis(raw, found);
  } catch (error) {
    status(error.message || "No se ha podido analizar el vídeo");
  } finally {
    bar.hidden = true;
    $("analyze").disabled = false;
  }
});

// El análisis se guarda en esta pestaña: si la página se recarga, no hay que repetirlo.
const cacheKey = () => `captura-gestos:${video.currentSrc.split("/").pop()}:${video.duration.toFixed(2)}:${state.fps}`;
const slim = (marks) => marks && marks.map((mark) => ({ x: +mark.x.toFixed(4), y: +mark.y.toFixed(4), z: +mark.z.toFixed(4) }));
function remember(raw) {
  try {
    sessionStorage.setItem(cacheKey(), JSON.stringify(raw.map((item) => ({ image: slim(item.image), world: slim(item.world) }))));
  } catch {
    // Si no cabe, se analiza otra vez al recargar.
  }
}
video.addEventListener("loadedmetadata", () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(cacheKey()) ?? "null");
    if (saved) useAnalysis(saved, saved.filter((item) => item.world).length);
  } catch {
    // Sin análisis guardado.
  }
});

function useAnalysis(raw, found) {
  {
    state.raw = raw;
    state.start = raw.findIndex((item) => item.world);
    state.end = raw.length - 1 - [...raw].reverse().findIndex((item) => item.world);
    state.hit = Math.round((state.start + state.end) / 2);
    const timeline = $("timeline");
    timeline.max = String(raw.length - 1);
    timeline.disabled = false;
    ["setStart", "setHit", "setEnd", "setTakeoff", "setLanding", "play", "save"].forEach((id) => {
      $(id).disabled = false;
    });
    status(`Listo: persona encontrada en ${found} de ${raw.length} fotogramas. Recorta, marca el golpe y pulsa «Ver gesto».`);
    rebuild();
    showFrame(state.hit);
  }
}

// ---------- Fotograma a fotograma ----------
const timeOf = (index) => `${(index / state.fps).toFixed(2).replace(".", ",")} s`;
function showMarks() {
  $("startOut").textContent = state.raw ? timeOf(state.start) : "–";
  $("hitOut").textContent = state.raw ? timeOf(state.hit) : "–";
  $("endOut").textContent = state.raw ? timeOf(state.end) : "–";
  $("takeoffOut").textContent = state.raw ? timeOf(state.takeoff ?? state.start) : "–";
  $("landingOut").textContent = state.raw ? timeOf(state.landing ?? state.end) : "–";
}
$("setTakeoff").addEventListener("click", () => {
  state.takeoff = state.frame;
  $("manualJump").checked = true;
  rebuild();
});
$("setLanding").addEventListener("click", () => {
  state.landing = state.frame;
  $("manualJump").checked = true;
  rebuild();
});

async function showFrame(index) {
  state.frame = index;
  $("timeline").value = String(index);
  await seek(Math.min(video.duration - 0.001, index / state.fps));
  drawOverlay();
}
$("timeline").addEventListener("input", (event) => {
  state.playing = false;
  showFrame(Number(event.target.value));
});
$("setStart").addEventListener("click", () => {
  state.start = Math.min(state.frame, state.end - 2);
  state.hit = Math.max(state.hit, state.start);
  rebuild();
});
$("setEnd").addEventListener("click", () => {
  state.end = Math.max(state.frame, state.start + 2);
  state.hit = Math.min(state.hit, state.end);
  rebuild();
});
$("setHit").addEventListener("click", () => {
  state.hit = Math.min(state.end, Math.max(state.start, state.frame));
  rebuild();
});

function drawOverlay() {
  const context = overlay.getContext("2d");
  context.clearRect(0, 0, overlay.width, overlay.height);
  const marks = state.raw?.[state.frame]?.image;
  if (!marks) return;
  const inside = state.frame >= state.start && state.frame <= state.end;
  context.lineWidth = 3;
  context.strokeStyle = state.frame === state.hit ? "#facc15" : inside ? "#ff3800" : "#a1a1aa";
  BONES.forEach(([from, to]) => {
    context.beginPath();
    context.moveTo(marks[from].x * overlay.width, marks[from].y * overlay.height);
    context.lineTo(marks[to].x * overlay.width, marks[to].y * overlay.height);
    context.stroke();
  });
  context.fillStyle = "#ffffff";
  marks.forEach((mark, index) => {
    if (index < 11 && index !== 7 && index !== 8) return;
    context.beginPath();
    context.arc(mark.x * overlay.width, mark.y * overlay.height, 3, 0, Math.PI * 2);
    context.fill();
  });
}

// ---------- Del vídeo a las posturas del muñeco ----------
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)))];
};

// Rellena los fotogramas sin persona con los de al lado.
function filled(raw) {
  const valid = raw.map((item, index) => (item.world ? index : -1)).filter((index) => index >= 0);
  return raw.map((item, index) => {
    if (item.world) return item;
    const before = [...valid].reverse().find((other) => other < index);
    const after = valid.find((other) => other > index);
    return raw[before ?? after] ?? raw[after];
  });
}

// Suavizado gaussiano en el tiempo de una serie de números.
function smoothSeries(values, sigma) {
  if (sigma <= 0) return values;
  const radius = Math.ceil(sigma * 2.5);
  const weights = Array.from({ length: radius * 2 + 1 }, (_, index) => Math.exp(-((index - radius) ** 2) / (2 * sigma * sigma)));
  return values.map((_, index) => {
    let sum = 0;
    let total = 0;
    weights.forEach((weight, offset) => {
      const at = index + offset - radius;
      if (at < 0 || at >= values.length) return;
      sum += values[at] * weight;
      total += weight;
    });
    return sum / total;
  });
}

function buildCapture() {
  if (!state.raw) return null;
  const sigma = Number($("smooth").value);
  const mirror = $("mirror").checked;
  const travel = $("travel").checked;
  const raw = filled(state.raw);
  const width = video.videoWidth;
  const height = video.videoHeight;
  const count = raw.length;

  // Mundo de MediaPipe (metros, centro en la cadera, y hacia abajo) a nuestros ejes (y hacia arriba).
  const ids = Object.values(LM);
  const world = {};
  const image = {};
  ids.forEach((id) => {
    world[id] = ["x", "y", "z"].map((axis, axisIndex) =>
      smoothSeries(raw.map((item) => (axisIndex === 0 ? 1 : -1) * item.world[id][axis]), sigma),
    );
    image[id] = ["x", "y"].map((axis) => smoothSeries(raw.map((item) => item.image[id][axis] * (axis === "x" ? width : height)), sigma));
  });
  const W = (id, frame) => new THREE.Vector3(world[id][0][frame], world[id][1][frame], world[id][2][frame]);
  const I = (id, frame) => new THREE.Vector2(image[id][0][frame], image[id][1][frame]);

  // Píxeles por metro: largo de la pierna en el vídeo frente a su largo real.
  const ratios = [];
  for (let frame = 0; frame < count; frame += 1) {
    [[LM.lHip, LM.lAnkle], [LM.rHip, LM.rAnkle], [LM.lShoulder, LM.lHip], [LM.rShoulder, LM.rHip]].forEach(([a, b]) => {
      const meters = W(a, frame).distanceTo(W(b, frame));
      if (meters > 0.2) ratios.push(I(a, frame).distanceTo(I(b, frame)) / meters);
    });
  }
  const pxPerMeter = median(ratios);

  // Suelo: lo más bajo que llegan los pies en el vídeo (la cámara está quieta).
  const footIds = [LM.lAnkle, LM.rAnkle, LM.lHeel, LM.rHeel, LM.lFoot, LM.rFoot];
  const footBottom = Array.from({ length: count }, (_, frame) => Math.max(...footIds.map((id) => image[id][1][frame])));
  const groundPx = percentile(footBottom, 0.95);
  const hipPx = Array.from({ length: count }, (_, frame) => (image[LM.lHip][1][frame] + image[LM.rHip][1][frame]) / 2);
  let hipHeight = hipPx.map((value) => (groundPx - value) / pxPerMeter);
  if ($("manualJump").checked) {
    // La cámara se mueve: apoyado, la cadera está a la altura de su pie más bajo; en el aire, una parábola.
    const planted = Array.from({ length: count }, (_, frame) => -Math.min(...footIds.map((id) => world[id][1][frame])));
    // Despegue y caída pueden quedar fuera del trozo elegido (vídeo que empieza o acaba en el aire).
    const takeoff = Math.min(state.takeoff ?? state.start, state.end - 1);
    const landing = $("peakHit").checked ? 2 * state.hit - takeoff : Math.max(takeoff + 1, state.landing ?? state.end);
    const hangPower = 1 - 0.45 * Number($("hang").value);
    const plantedAt = (frame) => planted[Math.min(state.end, Math.max(state.start, frame))];
    const jump = Number($("jumpHeight").value);
    hipHeight = planted.map((value, frame) => {
      if (frame <= takeoff || frame >= landing) return value;
      const s = (frame - takeoff) / (landing - takeoff);
      return plantedAt(takeoff) + (plantedAt(landing) - plantedAt(takeoff)) * s + jump * Math.pow(4 * s * (1 - s), hangPower);
    });
  }

  // Hacia dónde mira de media: el muñeco mira hacia -z, con su derecha en +x.
  const forward = new THREE.Vector3();
  for (let frame = state.start; frame <= state.end; frame += 1) {
    const right = W(LM.rHip, frame).sub(W(LM.lHip, frame)).add(W(LM.rShoulder, frame).sub(W(LM.lShoulder, frame)));
    forward.add(new THREE.Vector3(right.z, 0, -right.x));
  }
  const turn = Math.PI - Math.atan2(forward.x, forward.z);
  const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn);
  // Avance hacia delante (carrera de la batida), medido en el vídeo por la cadera.
  const facingRight = forward.x >= 0 ? 1 : -1;
  const hipX = Array.from({ length: count }, (_, frame) => (image[LM.lHip][0][frame] + image[LM.rHip][0][frame]) / 2);

  const at = (id, frame) => {
    const point = W(id, frame).applyQuaternion(spin);
    point.y += hipHeight[frame];
    return point;
  };
  const mid = (a, b, frame) => at(a, frame).lerp(at(b, frame), 0.5);
  const raws = [];
  for (let frame = state.start; frame <= state.end; frame += 1) {
    const side = (left, right) => [left, right];
    const pose = {
      p: mid(LM.lHip, LM.rHip, frame),
      c: mid(LM.lShoulder, LM.rShoulder, frame),
      h: mid(LM.lEar, LM.rEar, frame),
      e: side(at(LM.lElbow, frame), at(LM.rElbow, frame)),
      a: side(at(LM.lWrist, frame).lerp(at(LM.lIndex, frame), 0.35), at(LM.rWrist, frame).lerp(at(LM.rIndex, frame), 0.35)),
      k: side(at(LM.lKnee, frame), at(LM.rKnee, frame)),
      f: side(
        at(LM.lAnkle, frame).add(at(LM.lHeel, frame)).add(at(LM.lFoot, frame)).multiplyScalar(1 / 3),
        at(LM.rAnkle, frame).add(at(LM.rHeel, frame)).add(at(LM.rFoot, frame)).multiplyScalar(1 / 3),
      ),
      forward: travel ? ((hipX[frame] - hipX[state.start]) / pxPerMeter) * facingRight : 0,
    };
    raws.push(pose);
  }

  // Tamaño: que de pie tenga la misma altura de hombros que el muñeco.
  const standing = percentile(raws.map((pose) => pose.c.y - Math.min(pose.f[0].y, pose.f[1].y)), 0.9);
  const scale = FIGURE_SHOULDERS_OVER_FEET / standing;
  // Que los pies apoyados queden justo en el suelo.
  const lowest = percentile(raws.map((pose) => Math.min(pose.f[0].y, pose.f[1].y) * scale), 0.1);
  const lift = FOOT_HEIGHT - lowest;

  const out = (point, forwardShift) => {
    const x = (mirror ? -point.x : point.x) * scale;
    return [round(x), round(Math.max(0.02, point.y * scale + lift)), round(point.z * scale - forwardShift * scale)];
  };
  const pairOut = (pair, shift) => (mirror ? [out(pair[1], shift), out(pair[0], shift)] : [out(pair[0], shift), out(pair[1], shift)]);
  const frames = raws.map((pose) => {
    const chest = out(pose.c, pose.forward);
    chest[1] = round(chest[1] + 0.03);
    return {
      p: out(pose.p, pose.forward),
      c: chest,
      h: out(pose.h, pose.forward),
      e: pairOut(pose.e, pose.forward),
      a: pairOut(pose.a, pose.forward),
      k: pairOut(pose.k, pose.forward),
      f: pairOut(pose.f, pose.forward),
    };
  });
  // Con salto a mano, la cámara lenta sale de cuánto tiene que tardar del despegue al golpe.
  if ($("manualJump").checked) {
    const takeoffFrame = Math.max(state.start, state.takeoff ?? state.start);
    const videoSeconds = (state.hit - takeoffFrame) / state.fps;
    if (videoSeconds > 0) {
      const slowmo = Math.min(30, Math.max(1, videoSeconds / Number($("airTime").value)));
      $("slowmo").value = String(Math.round(slowmo * 2) / 2);
      $("slowmoOut").textContent = `${String(Math.round(slowmo * 2) / 2).replace(".", ",")}×`;
    }
  }
  // Duración de verdad: lo que dura en el vídeo, quitando la cámara lenta, y a la velocidad elegida.
  const clipMs = ((state.end - state.start) / state.fps) * 1000 / Number($("slowmo").value) / Number($("speed").value);
  // Se guarda a 60 posturas por segundo de gesto: con la cámara lenta salen muchas más de las necesarias.
  const hold = $("manualJump").checked ? Number($("hang").value) : 0;
  const hitClip = state.hit - state.start;
  const spread = Math.max(2, frames.length * 0.12);
  // Cuánto tiempo de gesto dura cada fotograma del vídeo: más cerca del golpe, más.
  const stretch = frames.map((_, frame) => 1 + 0.8 * hold * Math.exp(-(((frame - hitClip) / spread) ** 2)));
  const clock = [0];
  for (let frame = 1; frame < frames.length; frame += 1) clock.push(clock[frame - 1] + (stretch[frame - 1] + stretch[frame]) / 2);
  const total = clock.at(-1) || 1;
  const stretchedMs = clipMs * (total / Math.max(1, frames.length - 1));
  const wanted = Math.max(2, Math.round((stretchedMs / 1000) * OUTPUT_FPS) + 1);
  const resampled = Array.from({ length: wanted }, (_, index) => {
    const time = (index / (wanted - 1)) * total;
    let low = 0;
    while (low < frames.length - 2 && clock[low + 1] < time) low += 1;
    const t = Math.min(1, Math.max(0, (time - clock[low]) / ((clock[low + 1] - clock[low]) || 1)));
    return mixPose(frames[low], frames[low + 1], t);
  });
  const spacing = stretchedMs / (wanted - 1);
  let all = resampled;
  let hitIndex = (clock[hitClip] / total) * (wanted - 1);
  let takeoff = 0;
  if ($("bookends").checked) {
    // Entra y sale desde la postura de espera, para que encaje con el resto de la jugada.
    const ease = (t) => t * t * (3 - 2 * t);
    const chain = (links, clipPose) => {
      const poses = links.map(([name]) => (name === "clip" ? clipPose : keyPose(name)));
      const out = [];
      links.slice(1).forEach(([, ms], index) => {
        // Bajar desde el aire tarda lo que marca la gravedad según la altura a la que esté.
        const drop = poses[index].p[1] - poses[index + 1].p[1];
        const falling = links[index][0] === "clip" && drop > 0.05 ? Math.sqrt((2 * drop) / 9.8) * 1000 : 0;
        const steps = Math.max(2, Math.round(Math.max(ms, falling) / spacing));
        for (let step = 0; step < steps; step += 1) out.push(mixPose(poses[index], poses[index + 1], ease(step / steps)));
      });
      return out;
    };
    const before = chain(ENTRIES[state.gesture] ?? DEFAULT_ENTRY, resampled[0]);
    const after = chain(EXITS[state.gesture] ?? DEFAULT_EXIT, resampled.at(-1)).slice(1);
    after.push(keyPose("ready"));
    all = [...before, ...resampled, ...after];
    hitIndex += before.length;
    takeoff = before.length;
  }
  const lead = all.length - resampled.length;
  return {
    duration: Math.round(spacing * (all.length - 1)),
    hit: round(hitIndex / (all.length - 1)),
    // Cuándo deja el suelo (para que en la pizarra acabe de correr antes de saltar).
    takeoff: round(takeoff / (all.length - 1)),
    frames: all,
    // Dónde empieza y acaba el trozo de vídeo dentro del gesto (solo para esta herramienta).
    clipStart: round(takeoff / (all.length - 1)),
    clipEnd: round((takeoff + resampled.length - 1) / (all.length - 1)),
  };
}
const round = (value) => Math.round(value * 1000) / 1000;
const mixPoint = (a, b, t) => a.map((value, index) => round(value + (b[index] - value) * t));
function mixPose(a, b, t) {
  const out = {};
  ["p", "c", "h"].forEach((key) => {
    out[key] = mixPoint(a[key], b[key], t);
  });
  ["e", "a", "k", "f"].forEach((key) => {
    out[key] = [mixPoint(a[key][0], b[key][0], t), mixPoint(a[key][1], b[key][1], t)];
  });
  return out;
}

function rebuild() {
  showMarks();
  drawOverlay();
  state.draft = buildCapture();
  if (state.draft) {
    // Se prueba en vivo con el mismo código que usan el perfil y la pizarra.
    capturedGestures[state.gesture] = state.draft;
    $("saveInfo").textContent = `${state.draft.frames.length} posturas · dura ${(state.draft.duration / 1000).toFixed(2).replace(".", ",")} s · golpe al ${Math.round(state.draft.hit * 100)} %`;
  }
}

// ---------- Guardar ----------
async function store(message) {
  const response = await fetch("/__guardar-captura", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(capturedGestures),
  });
  status(response.ok ? message : "No se ha podido guardar");
}
$("save").addEventListener("click", () => {
  rebuild();
  store(`Guardado: el ${GESTURES[state.gesture].toLowerCase()} de la app ya usa este gesto.`);
});
$("remove").addEventListener("click", () => {
  delete capturedGestures[state.gesture];
  store(`Quitado: el ${GESTURES[state.gesture].toLowerCase()} vuelve a las posturas hechas a mano.`);
});

// ---------- Vista 3D ----------
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);
studioLighting(renderer, scene, 0.5);
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2a22, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(3, 6, 4);
sun.castShadow = true;
scene.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshStandardMaterial({ color: 0xc9793f, roughness: 0.8 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
camera.position.set(4.4, 2.0, 2.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.25, 0);
const rig = createPlayer(scene, { id: "c", side: "home", name: "", label: "" }, { id: "c", number: 7, character: lookFromSeed("captura", false) }, "Receptor", false, { showLabel: false });
rig.group.scale.setScalar(rig.scale);
rig.group.rotation.y = 0;

function resize() {
  const { clientWidth, clientHeight } = stage;
  renderer.setSize(clientWidth, clientHeight);
  camera.aspect = clientWidth / Math.max(1, clientHeight);
  camera.updateProjectionMatrix();
}
resize();
new ResizeObserver(resize).observe(stage);

$("play").addEventListener("click", () => {
  state.playing = !state.playing;
  state.playStart = performance.now();
  $("play").classList.toggle("on", state.playing);
  $("play").textContent = state.playing ? "■ Parar" : "▶ Ver gesto";
});

function tick(now) {
  requestAnimationFrame(tick);
  let progress = null;
  if (state.draft) {
    if (state.playing) {
      // En bucle, con un respiro entre vez y vez.
      const cycle = state.draft.duration + 600;
      const elapsed = (now - state.playStart) % cycle;
      progress = Math.min(1, elapsed / state.draft.duration);
    } else if (state.frame >= state.start && state.frame <= state.end) {
      progress = state.draft.clipStart + ((state.frame - state.start) / (state.end - state.start)) * (state.draft.clipEnd - state.draft.clipStart);
    }
  }
  const action = progress === null ? null : { action: state.gesture, progress };
  posePlayer(rig, { stride: 0, run: 0, amount: 0, action, time: now });
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(tick);
status("Elige un vídeo a la derecha.");

// Para depurar desde la consola.
window.capturaGestos = { state, buildCapture, capturedGestures, camera, controls };
