import { COURT_HEIGHT as H, COURT_WIDTH as W } from "@/app/boards.js";
import { geometry3d } from "@/app/components/board/Board3D.jsx";

// Píxeles por unidad de pista al convertir el dibujo en imagen: así no sale borroso.
const IMAGE_SCALE = 8;
// Grosor de cada franja del suelo inclinado, en unidades de pista.
const STRIP = 0.5;

// Vertical, como un vídeo de móvil: así se ve bien al mandarlo por WhatsApp.
const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;
const FPS = 30;
// Un momento quieto al principio y al final para que se entienda la jugada.
const HOLD_MS = 700;
// MP4 primero: WhatsApp e iPhone lo abren sin problemas. WebM si el navegador no sabe hacer MP4.
const TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];

export function videoType() {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined") return null;
  if (!HTMLCanvasElement.prototype.captureStream) return null;
  return TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

const extensionOf = (type) => (type.startsWith("video/mp4") ? "mp4" : "webm");

export const videoFileName = (name, type) =>
  `${(name || "jugada")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "jugada"}.${extensionOf(type)}`;

// La pista tal como se ve ahora (dibujo + jugada) convertida en una imagen.
function svgImage(svg) {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return image.decode().then(() => image);
}

function courtImage(frame, half) {
  const layers = [...frame.children].filter((child) => child.tagName.toLowerCase() === "svg");
  const inner = layers
    .map((layer) => {
      const clone = layer.cloneNode(true);
      clone.removeAttribute("class");
      clone.setAttribute("x", "0");
      clone.setAttribute("y", "0");
      clone.setAttribute("width", String(W));
      clone.setAttribute("height", String(H));
      return new XMLSerializer().serializeToString(clone);
    })
    .join("");
  const viewBox = half ? `0 ${H / 2} ${W} ${H / 2}` : `0 0 ${W} ${H}`;
  const height = half ? H / 2 : H;
  return svgImage(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${W * IMAGE_SCALE}" height="${height * IMAGE_SCALE}" font-family="Arial, Helvetica, sans-serif">${inner}</svg>`,
  );
}

// En 3D: el suelo plano por un lado y lo que va de pie (chapas, balón, red) por otro.
async function scene3d(root, half) {
  const floor = await courtImage(root.querySelector("[data-court-layers]"), half);
  const standingSvg = root.querySelector("[data-court-standing]").cloneNode(true);
  const { box } = geometry3d(half);
  standingSvg.removeAttribute("class");
  standingSvg.setAttribute("width", String(box.width * IMAGE_SCALE));
  standingSvg.setAttribute("height", String(box.height * IMAGE_SCALE));
  standingSvg.setAttribute("font-family", "Arial, Helvetica, sans-serif");
  const standing = await svgImage(new XMLSerializer().serializeToString(standingSvg));
  return { floor, standing };
}

function drawBackground(context, title) {
  context.fillStyle = "#0A0A0C";
  context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  const glow = context.createRadialGradient(VIDEO_WIDTH / 2, VIDEO_HEIGHT / 2, 50, VIDEO_WIDTH / 2, VIDEO_HEIGHT / 2, 700);
  glow.addColorStop(0, "rgba(255,56,0,0.16)");
  glow.addColorStop(1, "rgba(255,56,0,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  const band = context.createLinearGradient(0, 0, VIDEO_WIDTH, 0);
  band.addColorStop(0, "#FF3800");
  band.addColorStop(1, "#FF8800");
  context.fillStyle = band;
  context.fillRect(0, 0, VIDEO_WIDTH, 8);
  context.fillStyle = "#FFFFFF";
  context.font = "italic 900 52px Arial, Helvetica, sans-serif";
  context.textAlign = "center";
  context.fillText(title.toUpperCase().slice(0, 26), VIDEO_WIDTH / 2, 100, VIDEO_WIDTH - 60);
  context.fillStyle = "#A1A1AA";
  context.font = "700 26px Arial, Helvetica, sans-serif";
  context.fillText("ROTTA · PIZARRA", VIDEO_WIDTH / 2, VIDEO_HEIGHT - 50);
}

// Graba la pista mientras se reproduce la jugada. `play` la arranca y `isPlaying` dice si sigue.
// Con `view3d`, `frame` es la vista 3D entera y se pinta igual que en pantalla: el suelo por franjas.
// Con `webgl`, `frame` es el lienzo del visor 3D y se graba tal cual lo ve la cámara.
export async function recordBoardVideo({ frame, half, title, type, play, isPlaying, onProgress, view3d = false, webgl = false }) {
  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const context = canvas.getContext("2d");
  const area = { top: 150, bottom: VIDEO_HEIGHT - 110, margin: 40 };
  const ratio = W / (half ? H / 2 : H);
  const maxHeight = area.bottom - area.top;
  const courtWidth = Math.min(VIDEO_WIDTH - area.margin * 2, maxHeight * ratio);
  const courtHeight = courtWidth / ratio;
  const courtX = (VIDEO_WIDTH - courtWidth) / 2;
  const courtY = area.top + (maxHeight - courtHeight) / 2;

  const geometry = view3d ? geometry3d(half) : null;
  const paint3d = ({ floor, standing }) => {
    const { box, project, top, height } = geometry;
    const unit = Math.min((VIDEO_WIDTH - area.margin * 2) / box.width, maxHeight / box.height);
    const originX = (VIDEO_WIDTH - box.width * unit) / 2;
    const originY = area.top + (maxHeight - box.height * unit) / 2;
    const toX = (x) => originX + (x - box.x) * unit;
    const toY = (y) => originY + (y - box.y) * unit;
    // Cada franja horizontal del suelo se estrecha y se acerca según lo lejos que esté.
    for (let offset = 0; offset < height; offset += STRIP) {
      const near = project(0, top + offset);
      const next = project(0, top + Math.min(height, offset + STRIP));
      const width = W * near.scale;
      context.drawImage(
        floor,
        0, offset * IMAGE_SCALE, W * IMAGE_SCALE, STRIP * IMAGE_SCALE,
        toX(W / 2 - width / 2), toY(near.y), width * unit, (next.y - near.y) * unit + 0.6,
      );
    }
    context.drawImage(standing, originX, originY, box.width * unit, box.height * unit);
  };

  let lastImage = null;
  const paintCamera = (source) => {
    const width = VIDEO_WIDTH;
    const height = maxHeight + 60;
    const scale = Math.max(width / source.width, height / source.height);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    context.drawImage(source, (source.width - sourceWidth) / 2, (source.height - sourceHeight) / 2, sourceWidth, sourceHeight, 0, area.top - 30, width, height);
  };
  const paint = (scene) => {
    drawBackground(context, title);
    if (webgl) {
      paintCamera(scene);
      return;
    }
    if (view3d) {
      paint3d(scene);
      return;
    }
    context.save();
    context.shadowColor = "rgba(0,0,0,0.6)";
    context.shadowBlur = 40;
    context.shadowOffsetY = 14;
    context.drawImage(scene, courtX, courtY, courtWidth, courtHeight);
    context.restore();
  };
  const draw = async () => {
    lastImage = webgl ? frame : view3d ? await scene3d(frame, half) : await courtImage(frame, half);
    paint(lastImage);
  };

  await draw();
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.start(250);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  // Quieto, pero repintando: algunos navegadores no graban nada si el lienzo no cambia.
  const hold = async () => {
    const until = performance.now() + HOLD_MS;
    while (performance.now() < until) {
      paint(lastImage);
      await wait(1000 / FPS);
    }
  };

  await hold();
  play();
  await nextFrame();
  // Se dibuja lo que hay en pantalla en cada fotograma; si uno tarda, se salta y se pinta el siguiente.
  while (isPlaying()) {
    try {
      await draw();
    } catch {
      // Un fotograma que no se pudo convertir: se sigue con el siguiente.
    }
    onProgress?.();
    await nextFrame();
  }
  await hold();
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  return new Blob(chunks, { type: type.split(";")[0] });
}
