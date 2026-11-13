import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOX_HEIGHT_M, BOX_SIZE, COURT_HEIGHT as H, COURT_WIDTH as W, boxUnder, roundCoord, tokenPosition } from "@/app/boards.js";
import { actionDuration, actionLabel, contactTime, poseOf, takeoffTime } from "@/app/boardRecording.js";
import { playBounce, playFx, playHit, playStep, setSoundEnabled, soundEnabled, unlockSound } from "@/app/components/board/boardSounds.js";
import { UP, canvasTexture, createPlayer, labelSprite, posePlayer, studioLighting, turnTowards } from "@/app/character/character3D.js";

// Visor 3D de verdad: la misma jugada que en 2D, pero en una pista por la que te puedes mover.
// Escala: 1 unidad de pista son 10 cm (la pista mide 9 × 18 m), y el muñeco mide 1,75 m.
const M = 0.1;
const FIG = 1.75 / 24;
const NET_HEIGHTS = { masculino: 2.43, playa: 2.43 };
const netHeight = (teamId) => NET_HEIGHTS[teamId] ?? 2.24;
let NET_TOP = 2.43;
const NET_DEPTH = 1;
const BALL_R = 0.16;
const WALK_SPEED = 0.006;
const RUN_SPEED = 0.018;

export const CAMERAS = [
  { id: "detras", label: "Detrás", position: [0, 4.2, 15.5], target: [0, 0.8, 0] },
  { id: "lateral", label: "Lateral", position: [15, 6.5, 6.5], target: [0, 0.8, 0] },
  { id: "arriba", label: "Arriba", position: [0, 27, 0.1], target: [0, 0, 0] },
  { id: "red", label: "Red", position: [4.5, 3.4, -6.5], target: [-1, 1.4, 2.2] },
  { id: "rival", label: "Rival", position: [0, 4.2, -15.5], target: [0, 0.8, 0] },
  { id: "balon", label: "Balón", follow: true },
];

// En pantallas en vertical (móvil) se ve poco de ancho: la cámara sube y el ángulo se abre algo.
const HINT_KEY = "tnt-pizarra-3d-aviso";
const PORTRAIT_CAMERAS = {
  detras: { position: [0, 7.2, 12.2], target: [0, 0.3, 2.2] },
  rival: { position: [0, 7.2, -12.2], target: [0, 0.3, -2.2] },
};
const isPortrait = (aspect) => aspect < 0.85;
function cameraPreset(id, aspect) {
  const preset = CAMERAS.find((item) => item.id === id);
  if (!preset || preset.follow) return preset;
  return isPortrait(aspect) && PORTRAIT_CAMERAS[id] ? { ...preset, ...PORTRAIT_CAMERAS[id] } : preset;
}
const fovFor = (aspect) => Math.min(68, Math.max(45, (2 * Math.atan(Math.tan((28 * Math.PI) / 180) / Math.max(0.3, aspect)) * 180) / Math.PI));

export function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

const toWorld = (x, y) => new THREE.Vector3((x * W - W / 2) * M, 0, (y * H - H / 2) * M);
// Al revés: un punto del suelo a coordenadas de la pizarra (de 0 a 1).
const fromWorld = (point) => ({ x: point.x / M / W + 0.5, y: point.z / M / H + 0.5 });

// ---------- Texturas dibujadas en un lienzo ----------
// Balón Molten: paneles verdes, rojos y blancos en espiral.
function moltenTexture() {
  return canvasTexture(512, 256, (context, width, height) => {
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    const colors = ["#0F8A3C", "#FFFFFF", "#D7262E", "#FFFFFF", "#0F8A3C", "#FFFFFF", "#D7262E", "#FFFFFF"];
    const band = width / colors.length;
    colors.forEach((color, index) => {
      context.fillStyle = color;
      context.beginPath();
      for (let y = 0; y <= height; y += 4) {
        const shift = Math.sin((y / height) * Math.PI * 2 + index) * 28;
        const x = index * band + shift;
        if (y === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      for (let y = height; y >= 0; y -= 4) {
        const shift = Math.sin((y / height) * Math.PI * 2 + index + 1) * 28;
        context.lineTo((index + 1) * band + shift, y);
      }
      context.closePath();
      context.fill();
    });
    context.strokeStyle = "rgba(63,63,70,0.55)";
    context.lineWidth = 2;
    for (let index = 0; index <= colors.length; index += 1) {
      context.beginPath();
      for (let y = 0; y <= height; y += 4) {
        const x = index * band + Math.sin((y / height) * Math.PI * 2 + index) * 28;
        if (y === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
  });
}

function netTexture() {
  const texture = canvasTexture(256, 64, (context, width, height) => {
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "rgba(20,20,24,0.9)";
    context.lineWidth = 2;
    for (let x = 0; x <= width; x += 8) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 8) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 1.2);
  return texture;
}

function numberTexture(number, jersey) {
  return canvasTexture(128, 128, (context, width, height) => {
    context.fillStyle = jersey.shirt;
    context.fillRect(0, 0, width, height);
    context.fillStyle = jersey.number;
    context.font = "900 78px Arial, Helvetica, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(number ?? ""), width / 2, height / 2 + 4);
  });
}

// ---------- Pabellón ----------
function buildArena(scene, beach) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 70), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const free = new THREE.Mesh(new THREE.PlaneGeometry(15, 24), new THREE.MeshStandardMaterial({ color: beach ? 0xd8bb78 : 0x1e5a7a, roughness: 0.85 }));
  free.rotation.x = -Math.PI / 2;
  free.position.y = 0.002;
  free.receiveShadow = true;
  scene.add(free);

  const court = new THREE.Mesh(new THREE.PlaneGeometry(9, 18), new THREE.MeshStandardMaterial({ color: beach ? 0xe8cf95 : 0xc9793f, roughness: 0.7 }));
  court.rotation.x = -Math.PI / 2;
  court.position.y = 0.004;
  court.receiveShadow = true;
  scene.add(court);

  if (!beach) {
    [-1.5, 1.5].forEach((z) => {
      const zone = new THREE.Mesh(new THREE.PlaneGeometry(9, 3), new THREE.MeshStandardMaterial({ color: 0xd98b4f, roughness: 0.7 }));
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(0, 0.005, z);
      zone.receiveShadow = true;
      scene.add(zone);
    });
  }

  const lineMaterial = new THREE.MeshStandardMaterial({ color: beach ? 0x1d4ed8 : 0xffffff, roughness: 0.5 });
  const line = (width, depth, x, z) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), lineMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.007, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  line(0.05, 18.05, -4.5, 0);
  line(0.05, 18.05, 4.5, 0);
  line(9.05, 0.05, 0, -9);
  line(9.05, 0.05, 0, 9);
  line(9, 0.05, 0, 0);
  if (!beach) {
    line(9, 0.05, 0, -3);
    line(9, 0.05, 0, 3);
  }

  // Gradas a los dos lados largos.
  const stand = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 });
  const seat = new THREE.MeshStandardMaterial({ color: 0xff3800, roughness: 0.6 });
  [-1, 1].forEach((side) => {
    for (let row = 0; row < 5; row += 1) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1, 0.45 * (row + 1), 24), stand);
      step.position.set(side * (10.5 + row), 0.225 * (row + 1), 0);
      step.receiveShadow = true;
      scene.add(step);
      const seats = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 23), seat);
      seats.position.set(side * (10.5 + row), 0.45 * (row + 1) + 0.03, 0);
      scene.add(seats);
    }
  });
}

function buildNet(scene, top) {
  NET_TOP = top;
  const group = new THREE.Group();
  const halfWidth = 5;
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.4, roughness: 0.4 });
  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, NET_TOP + 0.2, 12), postMaterial);
    post.position.set(side * halfWidth, (NET_TOP + 0.2) / 2, 0);
    post.castShadow = true;
    group.add(post);
    // Antenas rojas y blancas encima de cada línea lateral.
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.8, 6),
      new THREE.MeshStandardMaterial({ color: 0xff3800 }),
    );
    antenna.position.set(side * 4.5, NET_TOP + 0.4 - NET_DEPTH / 2 + 0.5, 0);
    group.add(antenna);
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(halfWidth * 2, NET_DEPTH),
    new THREE.MeshStandardMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  mesh.position.set(0, NET_TOP - NET_DEPTH / 2, 0);
  group.add(mesh);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.07, 0.02), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  tape.position.set(0, NET_TOP - 0.035, 0);
  tape.castShadow = true;
  group.add(tape);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  bottom.position.set(0, NET_TOP - NET_DEPTH, 0);
  group.add(bottom);
  scene.add(group);
}

// ---------- Jugadores ----------
// ---------- Componente ----------
// `teamId`: el equipo de la jugada. En el femenino, las rivales también son chicas.
// `showcase`: cámara fija ({ position, target }) y sin botones, para enseñar un gesto (la tienda).
// `onMove(id, x, y, terminado)`: si llega, se pueden arrastrar jugadores, conos y cajónes con el dedo.
export default function Viewer3D({ elements, rosterById, heights, flashes, actions, beach, teamId, showcase = null, onMove = null }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const latest = useRef({ elements, rosterById, heights, flashes, actions, teamId, onMove });
  latest.current = { elements, rosterById, heights, flashes, actions, teamId, onMove };
  const [camera, setCamera] = useState("detras");
  const [sound, setSound] = useState(soundEnabled);
  const [hint, setHint] = useState(() => {
    try {
      const seen = Number(localStorage.getItem(HINT_KEY) ?? 0);
      localStorage.setItem(HINT_KEY, String(seen + 1));
      return seen < 3;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (!hint) return undefined;
    const timer = setTimeout(() => setHint(false), 5000);
    return () => clearTimeout(timer);
  }, [hint]);
  const cameraRef = useRef(camera);

  useEffect(() => {
    const mount = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    // Calidad que se ajusta sola: empieza con la del dispositivo (sin pasar de unos 2,5 millones de
    // píxeles) y, si el 3D va lento, la baja hasta que vaya fluido.
    const quality = { ratio: Math.min(2, window.devicePixelRatio), frames: 0, spent: 0, last: 0 };
    const MAX_PIXELS = 2_500_000;
    const fitRatio = () => {
      const area = Math.max(1, mount.clientWidth * mount.clientHeight);
      return Math.min(quality.ratio, Math.sqrt(MAX_PIXELS / area));
    };
    renderer.setPixelRatio(fitRatio());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("data-viewer-canvas", "");
    // En la tienda la cámara no se mueve: así se puede seguir bajando por la página con el dedo.
    renderer.domElement.style.touchAction = showcase ? "auto" : "none";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0c);
    const environment = studioLighting(renderer, scene, 0.35);
    scene.fog = new THREE.Fog(0x0a0a0c, 30, 60);
    const view = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    const startAspect = mount.clientWidth / Math.max(1, mount.clientHeight);
    const start = showcase ?? cameraPreset(CAMERAS[0].id, startAspect);
    view.fov = fovFor(startAspect);
    view.position.set(...start.position);

    const controls = new OrbitControls(view, renderer.domElement);
    controls.target.set(...start.target);
    controls.enableDamping = true;
    controls.enabled = !showcase;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 2;
    controls.maxDistance = 45;
    controls.addEventListener("start", () => {
      // Si mueves tú la cámara, deja de seguir al balón.
      if (cameraRef.current === "balon") {
        cameraRef.current = "libre";
        setCamera("libre");
      }
      sceneRef.current.flight = null;
    });

    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 16, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    buildArena(scene, beach);
    buildNet(scene, netHeight(latest.current.teamId));

    const ballMaterial = new THREE.MeshStandardMaterial({ map: moltenTexture(), roughness: 0.45 });
    const flashMaterial = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });

    const state = { renderer, scene, view, controls, players: new Map(), balls: new Map(), props: new Map(), drag: null, flight: null, frame: 0, effects: [], shake: 0, lastNow: 0 };
    sceneRef.current = state;
    // Solo en el ordenador (npm run dev), para revisar la escena desde la consola.
    if (import.meta.env.DEV) window.__visor3d = state;

    // ---------- Efectos: estela del balón, ondas y chispas en cada golpe, polvo al botar ----------
    // Sin mipmaps: al verse pequeñas, las chispas seguían saliendo como cuadraditos.
    const roundTexture = (texture) => {
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      return texture;
    };
    const glow = roundTexture(canvasTexture(64, 64, (context, width, height) => {
      const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 30);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.3, "rgba(255,255,255,0.6)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }));
    // Destello en estrella: rayos de luz finos desde el centro, para que el golpe tenga fuerza.
    const starburst = roundTexture(canvasTexture(256, 256, (context) => {
      context.translate(128, 128);
      const rays = 14;
      for (let index = 0; index < rays; index += 1) {
        const angle = (index / rays) * Math.PI * 2 + (index % 2 ? 0.08 : 0);
        const length = index % 2 ? 80 : 124;
        const gradient = context.createLinearGradient(0, 0, Math.cos(angle) * length, Math.sin(angle) * length);
        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(Math.cos(angle - 0.05) * 6, Math.sin(angle - 0.05) * 6);
        context.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
        context.lineTo(Math.cos(angle + 0.05) * 6, Math.sin(angle + 0.05) * 6);
        context.closePath();
        context.fill();
      }
      const core = context.createRadialGradient(0, 0, 0, 0, 0, 40);
      core.addColorStop(0, "rgba(255,255,255,1)");
      core.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = core;
      context.fillRect(-128, -128, 256, 256);
    }));
    const glowSprite = (color) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sprite.renderOrder = 12;
      return sprite;
    };
    const ringGeometry = new THREE.RingGeometry(0.82, 1, 56);
    const ringMesh = (color) => {
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      ring.renderOrder = 11;
      return ring;
    };
    const FIRE = new THREE.Color(0xff5a1f);
    const GOLD = new THREE.Color(0xffc94d);
    const WHITE = new THREE.Color(0xffffff);
    // Un efecto vive `life` segundos; `update(t, dt)` lo dibuja con t de 0 a 1.
    const addEffect = (object, life, update) => {
      scene.add(object);
      state.effects.push({ object, life, age: 0, update });
    };
    const easeOut = (t) => 1 - (1 - t) ** 3;

    // Efectos especiales de la tienda: cada jugador lleva los suyos en su personaje.
    const FX_THEMES = {
      fuego: { colors: [0xff5a1f, 0xffc94d, 0xff2a00], trail: 0xff5a1f, flames: true },
      rayo: { colors: [0x22d3ee, 0xfacc15, 0xffffff], trail: 0x67e8f9, bolts: true },
      galaxia: { colors: [0x8b5cf6, 0x38bdf8, 0xec4899, 0xffffff], trail: 0xa855f7, stars: true },
      oro: { colors: [0xffc94d, 0xfff3b0, 0xe8b923], trail: 0xffd34d, stars: true },
      hielo: { colors: [0x7dd3fc, 0xe0f2fe, 0xffffff], trail: 0x7dd3fc },
      estrellas: { colors: [0xfff3b0, 0xffffff, 0xfacc15], trail: 0xfff3b0, stars: true },
    };
    // Cada efecto sabe cómo se llama (para su sonido y su animación propia).
    Object.entries(FX_THEMES).forEach(([name, theme]) => {
      theme.name = name;
    });
    const FX_FIELD = { remate: "fx_remate", recepcion: "fx_recepcion", colocacion: "fx_colocacion" };
    const fxOf = (rig, action) => FX_THEMES[rig.look?.[FX_FIELD[action]]] ?? null;
    const pickColor = (theme) => new THREE.Color(theme.colors[Math.floor(Math.random() * theme.colors.length)]);
    // El fuego brilla sumando luz; el resto se pinta con su color tal cual para que no se vea blanco
    // sobre el parqué claro.
    const fxSprite = (theme, color = pickColor(theme)) => {
      const sprite = glowSprite(color);
      if (!theme.flames) sprite.material.blending = THREE.NormalBlending;
      return sprite;
    };
    const fxRing = (theme, color) => {
      const ring = ringMesh(color);
      if (!theme.flames) ring.material.blending = THREE.NormalBlending;
      return ring;
    };

    // El golpe con efecto: doble onda, destello grande y una lluvia de partículas del color del efecto.
    // Recepción con efecto: onda en el suelo, escudo de energía delante de los brazos y una fuente que sube.
    const receptionShow = (point, theme, feet) => {
      takeoffBlast(feet, theme);
      const shield = new THREE.Sprite(new THREE.SpriteMaterial({ map: shockTexture, color: new THREE.Color(theme.colors[0]), transparent: true, depthWrite: false, blending: theme.flames ? THREE.AdditiveBlending : THREE.NormalBlending }));
      shield.position.copy(point);
      shield.renderOrder = 13;
      addEffect(shield, 0.5, (t) => {
        shield.scale.setScalar(0.5 + easeOut(t) * 1.1);
        shield.material.opacity = (1 - t) * 0.95;
      });
      const inner = fxSprite(theme, new THREE.Color(theme.colors[1] ?? theme.colors[0]));
      inner.position.copy(point);
      addEffect(inner, 0.35, (t) => {
        inner.scale.setScalar(0.9 * (1 - t * 0.3));
        inner.material.opacity = 1 - t;
      });
      for (let index = 0; index < 34; index += 1) {
        const drop = fxSprite(theme);
        drop.position.copy(point);
        const velocity = new THREE.Vector3((Math.random() - 0.5) * 2.4, 3 + Math.random() * 3.5, (Math.random() - 0.5) * 2.4);
        const size = 0.06 + Math.random() * 0.07;
        addEffect(drop, 0.6 + Math.random() * 0.4, (t, dt) => {
          velocity.y -= 7 * dt;
          drop.position.addScaledVector(velocity, dt);
          drop.scale.setScalar(size * (1 - t * 0.6));
          drop.material.opacity = 1 - t;
        });
      }
      for (let index = 0; index < 16; index += 1) auraParticle(feet.clone().add(new THREE.Vector3(0, 0.1, 0)), theme, 1.3);
    };

    // Colocación con efecto: espiral de partículas que sube con el balón y destellos en las manos.
    const setShow = (point, theme) => {
      const hands = fxSprite(theme, new THREE.Color(theme.colors[0]));
      hands.position.copy(point);
      addEffect(hands, 0.4, (t) => {
        hands.scale.setScalar(1.1 * (1 - t * 0.4));
        hands.material.opacity = 1 - t;
      });
      const turns = 2.5;
      for (let index = 0; index < 40; index += 1) {
        const spark = fxSprite(theme);
        const offset = index / 40;
        const size = 0.06 + Math.random() * 0.05;
        addEffect(spark, 0.9, (t) => {
          const progress = Math.min(1, t * 1.4 + offset * 0.3);
          const angle = (offset + progress) * Math.PI * 2 * turns;
          const radius = 0.35 * (1 - progress * 0.6);
          spark.position.set(point.x + Math.cos(angle) * radius, point.y + progress * 1.6, point.z + Math.sin(angle) * radius);
          const twinkle = theme.stars ? 0.6 + Math.abs(Math.sin(t * 30 + index)) * 0.6 : 1;
          spark.scale.setScalar(size * twinkle * (1 - t * 0.5));
          spark.material.opacity = 1 - t;
        });
      }
      // Anillo horizontal que sube como si empujara el balón.
      const ring = fxRing(theme, new THREE.Color(theme.colors[0]));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(point);
      addEffect(ring, 0.55, (t) => {
        ring.position.y = point.y + t * 0.9;
        ring.scale.setScalar(0.25 + easeOut(t) * 0.5);
        ring.material.opacity = (1 - t) * 0.9;
      });
    };

    // ---------- La firma de cada efecto: lo que lo hace distinto de los demás ----------
    // Destello de luz de su color: ilumina la pista y a los jugadores un instante.
    // Una sola luz que se mueve (añadir y quitar luces haría que todo se recalculara y diera tirones).
    const fxLight = new THREE.PointLight(0xffffff, 0, 9, 2);
    scene.add(fxLight);
    const flashLight = (point, color, power) => {
      fxLight.color.set(color);
      fxLight.position.copy(point);
      const peak = 20 + power * 34;
      addEffect(new THREE.Object3D(), 0.45, (t) => {
        fxLight.intensity = peak * (1 - t) ** 2;
      });
    };
    const randomDirection = () => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();

    // Fuego. Una llama: nace amarilla casi blanca, pasa a naranja y a rojo, sube, se estira y se apaga.
    const flame = (position, { size = 0.2, velocity = new THREE.Vector3(0, 1.5, 0), life = 0.6, stretch = 1.6, drag = 0 } = {}) => {
      const sprite = glowSprite(new THREE.Color(0xfff1a8));
      sprite.position.copy(position);
      const sway = Math.random() * Math.PI * 2;
      addEffect(sprite, life * (0.8 + Math.random() * 0.4), (t, dt) => {
        if (drag) velocity.multiplyScalar(1 - drag * dt);
        velocity.y += 1.2 * dt;
        sprite.position.addScaledVector(velocity, dt);
        sprite.position.x += Math.sin(t * 16 + sway) * 0.005;
        sprite.material.color.setRGB(1, Math.max(0.1, 0.95 - t * 1.2), Math.max(0, 0.65 - t * 1.9));
        sprite.scale.set(size * (1 - t * 0.35), size * (stretch + t * 0.8), 1);
        sprite.material.opacity = (1 - t) ** 1.1;
      });
    };
    const smokePuff = (position, size = 0.35, life = 1.2) => {
      const smoke = glowSprite(new THREE.Color(0x27272a));
      smoke.material.blending = THREE.NormalBlending;
      smoke.position.copy(position);
      const rise = 0.4 + Math.random() * 0.6;
      const drift = new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
      addEffect(smoke, life, (t, dt) => {
        smoke.position.y += rise * dt;
        smoke.position.addScaledVector(drift, dt);
        smoke.scale.setScalar(size * (0.6 + t * 1.6));
        smoke.material.opacity = Math.sin(Math.PI * t) * 0.4;
      });
    };
    // Brasas: chispitas muy brillantes que salen disparadas, caen y parpadean.
    const embers = (point, count, speed = 3, spread = new THREE.Vector3(0, 0.6, 0)) => {
      for (let index = 0; index < count; index += 1) {
        const ember = glowSprite(new THREE.Color(Math.random() < 0.5 ? 0xffd166 : 0xff7a1a));
        ember.position.copy(point);
        const velocity = randomDirection().add(spread).normalize().multiplyScalar(speed * (0.4 + Math.random()));
        const size = 0.035 + Math.random() * 0.04;
        addEffect(ember, 0.7 + Math.random() * 0.7, (t, dt) => {
          velocity.y -= 4 * dt;
          velocity.multiplyScalar(1 - 1.2 * dt);
          ember.position.addScaledVector(velocity, dt);
          ember.scale.setScalar(size * (Math.random() < 0.15 ? 0.4 : 1) * (1 - t * 0.5));
          ember.material.opacity = 1 - t;
        });
      }
    };

    // Al rematar: bola de fuego que explota, un anillo de llamas que se abre de cara al golpe, brasas y humo.
    const fireSignature = (point, power, direction = new THREE.Vector3(0, -0.4, -1)) => {
      [[0xffffff, 0.7, 0.18], [0xffd166, 1.15, 0.3], [0xff5a1f, 1.6, 0.42], [0xb91c1c, 2, 0.55]].forEach(([color, grow, life]) => {
        const ball = glowSprite(new THREE.Color(color));
        ball.position.copy(point);
        addEffect(ball, life, (t) => {
          ball.scale.setScalar((0.35 + power * 0.5) * grow * (0.4 + easeOut(t)));
          ball.material.opacity = (1 - t) ** 1.3;
        });
      });
      // Anillo de fuego perpendicular al golpe.
      const axis = direction.clone().normalize();
      const side = new THREE.Vector3().crossVectors(axis, UP).normalize();
      if (side.lengthSq() < 0.01) side.set(1, 0, 0);
      const up = new THREE.Vector3().crossVectors(side, axis).normalize();
      const flamesInRing = Math.round(14 + power * 14);
      for (let index = 0; index < flamesInRing; index += 1) {
        const angle = (index / flamesInRing) * Math.PI * 2;
        const out = side.clone().multiplyScalar(Math.cos(angle)).addScaledVector(up, Math.sin(angle));
        flame(point.clone().addScaledVector(out, 0.15), { size: 0.16 + power * 0.1, velocity: out.multiplyScalar(2.6 + power * 2), life: 0.5, stretch: 1.3, drag: 2.5 });
      }
      // Llamas que suben desde el golpe.
      for (let index = 0; index < Math.round(8 + power * 10); index += 1) {
        flame(point.clone().add(randomDirection().multiplyScalar(0.15)), { size: 0.2 + Math.random() * 0.2 * power, velocity: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1 + Math.random() * 1.8, (Math.random() - 0.5) * 0.8), life: 0.7 });
      }
      embers(point, Math.round(16 + power * 24), 3 + power * 2.5, axis.clone().multiplyScalar(0.8));
      for (let index = 0; index < Math.round(3 + power * 3); index += 1) smokePuff(point.clone().add(randomDirection().multiplyScalar(0.25)), 0.35 + Math.random() * 0.25, 1.3);
    };

    // El balón ardiendo en el aire: llamas grandes que lo envuelven y una cola de fuego y humo (como un cometa).
    const fireComet = (position) => {
      flame(position.clone().add(randomDirection().multiplyScalar(0.06)), { size: 0.2 + Math.random() * 0.14, velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4), life: 0.45, stretch: 1.4 });
      if (Math.random() < 0.5) flame(position.clone(), { size: 0.12, velocity: new THREE.Vector3(0, 0.3, 0), life: 0.6, stretch: 1.1 });
      if (Math.random() < 0.12) smokePuff(position.clone(), 0.22, 0.9);
      if (Math.random() < 0.3) embers(position, 1, 1.2);
    };

    // El balón cae ardiendo: estallan llamas del suelo, un anillo de fuego recorre la pista y queda una quemadura.
    const scorchTexture = roundTexture(canvasTexture(128, 128, (context) => {
      const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, "rgba(10,6,4,0.95)");
      gradient.addColorStop(0.45, "rgba(30,14,6,0.75)");
      gradient.addColorStop(0.75, "rgba(90,30,8,0.35)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }));
    const scorchGeometry = new THREE.PlaneGeometry(1, 1);
    const fireLanding = (point) => {
      const scorch = new THREE.Mesh(scorchGeometry, new THREE.MeshBasicMaterial({ map: scorchTexture, transparent: true, depthWrite: false }));
      scorch.rotation.x = -Math.PI / 2;
      scorch.position.set(point.x, 0.012, point.z);
      scorch.renderOrder = 2;
      addEffect(scorch, 3, (t) => {
        scorch.scale.setScalar(0.4 + easeOut(Math.min(1, t * 6)) * 1.1);
        scorch.material.opacity = t < 0.7 ? 0.9 : 0.9 * (1 - (t - 0.7) / 0.3);
      });
      const ground = new THREE.Vector3(point.x, 0.05, point.z);
      for (let index = 0; index < 16; index += 1) {
        flame(ground.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4)), { size: 0.22 + Math.random() * 0.22, velocity: new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 2.2, (Math.random() - 0.5) * 0.6), life: 0.8 });
      }
      for (let index = 0; index < 22; index += 1) {
        const angle = (index / 22) * Math.PI * 2;
        const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        flame(ground.clone().addScaledVector(out, 0.2), { size: 0.17, velocity: out.multiplyScalar(3.2).setY(0.4), life: 0.55, stretch: 1.5, drag: 3 });
      }
      embers(ground, 26, 3.5, new THREE.Vector3(0, 1.2, 0));
      for (let index = 0; index < 4; index += 1) smokePuff(ground.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.2, (Math.random() - 0.5) * 0.5)), 0.45, 1.6);
    };

    // Al saltar a rematar: una columna de llamas alrededor del jugador.
    const firePillar = (position) => {
      for (let index = 0; index < 22; index += 1) {
        const angle = (index / 22) * Math.PI * 2;
        const spot = new THREE.Vector3(position.x + Math.cos(angle) * 0.35, 0.05, position.z + Math.sin(angle) * 0.35);
        flame(spot, { size: 0.18 + Math.random() * 0.12, velocity: new THREE.Vector3(Math.cos(angle) * 0.2, 2.4 + Math.random() * 1.6, Math.sin(angle) * 0.2), life: 0.65 });
      }
      embers(new THREE.Vector3(position.x, 0.1, position.z), 14, 2.5, new THREE.Vector3(0, 1.5, 0));
    };

    // Rayo: descargas con ramas que parpadean y cambian de forma, y arcos eléctricos alrededor del balón.
    const zigzag = (from, direction, length, steps, jitter) => {
      const points = [from.clone()];
      for (let step = 1; step <= steps; step += 1) {
        points.push(from.clone().addScaledVector(direction, (step / steps) * length).add(randomDirection().multiplyScalar(Math.random() * jitter)));
      }
      return points;
    };
    const electricLine = (color) => {
      const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      line.renderOrder = 15;
      line.userData.ownsGeometry = true;
      return line;
    };
    const lightningSignature = (point, power) => {
      const bolts = Math.round(4 + power * 5);
      for (let bolt = 0; bolt < bolts; bolt += 1) {
        const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.35, Math.random() - 0.5).normalize();
        const length = 0.9 + Math.random() * 1.3 * power;
        const line = electricLine(bolt % 3 === 0 ? 0xfacc15 : 0xa5f3fc);
        line.geometry.setFromPoints(zigzag(point, direction, length, 9, 0.28));
        // Rama que sale de la mitad del rayo.
        const branch = electricLine(0xe0f2fe);
        const fork = point.clone().addScaledVector(direction, length * 0.45);
        const branchDirection = direction.clone().add(randomDirection().multiplyScalar(0.9)).normalize();
        branch.geometry.setFromPoints(zigzag(fork, branchDirection, length * 0.5, 5, 0.18));
        addEffect(line, 0.34, (t) => {
          if (Math.random() < 0.25) line.geometry.setFromPoints(zigzag(point, direction, length, 9, 0.28));
          line.material.opacity = (Math.random() < 0.3 ? 0.2 : 1) * (1 - t);
        });
        addEffect(branch, 0.24, (t) => {
          branch.material.opacity = (Math.random() < 0.35 ? 0.15 : 0.9) * (1 - t);
        });
      }
      for (let arc = 0; arc < 5; arc += 1) {
        const line = electricLine(arc % 2 ? 0x67e8f9 : 0xffffff);
        addEffect(line, 0.5, (t) => {
          const angle = Math.random() * Math.PI * 2;
          const radius = 0.2 + Math.random() * 0.15;
          const from = point.clone().add(new THREE.Vector3(Math.cos(angle) * radius, (Math.random() - 0.5) * 0.3, Math.sin(angle) * radius));
          const to = point.clone().add(new THREE.Vector3(Math.cos(angle + 1.5) * radius, (Math.random() - 0.5) * 0.3, Math.sin(angle + 1.5) * radius));
          line.geometry.setFromPoints(zigzag(from, to.clone().sub(from).normalize(), from.distanceTo(to), 5, 0.07));
          line.material.opacity = (1 - t) * (Math.random() < 0.2 ? 0.2 : 1);
        });
      }
    };

    // Galaxia: una galaxia espiral de verdad. Miles de estrellitas en brazos que giran: el centro amarillento,
    // los brazos morados y rosas y las puntas azules. Va en un solo dibujo (Points), así no pesa en el móvil.
    const galaxyGeometry = (() => {
      const count = 1400;
      const arms = 3;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const core = new THREE.Color(0xfff3d6);
      const purple = new THREE.Color(0xa855f7);
      const pink = new THREE.Color(0xec4899);
      const blue = new THREE.Color(0x38bdf8);
      const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      for (let index = 0; index < count; index += 1) {
        // Más estrellas cerca del centro; los brazos se enroscan hacia fuera.
        const distance = Math.random() ** 0.85;
        const arm = (index % arms) * ((Math.PI * 2) / arms);
        const angle = arm + distance * 3.4 + gauss() * 0.32 * (1 - distance * 0.4);
        const radius = 0.04 + distance + gauss() * 0.05;
        positions[index * 3] = Math.cos(angle) * radius;
        positions[index * 3 + 1] = Math.sin(angle) * radius;
        positions[index * 3 + 2] = gauss() * 0.05 * (1 - distance);
        const color = distance < 0.35 ? core.clone().lerp(purple, distance / 0.35) : purple.clone().lerp(Math.random() < 0.35 ? pink : blue, (distance - 0.35) / 0.65);
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
        colors.set([color.r, color.g, color.b], index * 3);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      return geometry;
    })();
    const galaxySignature = (point, theme, power, direction, action) => {
      const shield = action === "recepcion";
      const galaxy = new THREE.Points(
        galaxyGeometry,
        new THREE.PointsMaterial({ size: 0.11, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
      );
      galaxy.renderOrder = 14;
      galaxy.position.copy(point);
      if (shield) {
        // En la recepción: de pie delante de los brazos, como una pared que para el balón, mirando hacia donde viene.
        const facing = direction.clone().setY(0);
        if (facing.lengthSq() < 0.001) facing.set(0, 0, -1);
        facing.normalize();
        galaxy.position.addScaledVector(facing, 0.12);
        galaxy.lookAt(galaxy.position.clone().add(facing));
      } else {
        // De cara a la cámara e inclinada, como en las fotos: así se ve la espiral desde cualquier vista.
        galaxy.lookAt(view.position);
        galaxy.rotateX(-0.45);
      }
      const size = shield ? 0.95 : 1.1 + power * 1.3;
      const spin = 2.2 + Math.random() * 0.6;
      addEffect(galaxy, 1.6, (t, dt) => {
        galaxy.rotateZ(spin * dt * (1.4 - t));
        galaxy.scale.setScalar(size * (0.25 + easeOut(Math.min(1, t * 1.6)) * 0.95));
        galaxy.material.opacity = Math.min(1, t * 6) * (1 - t) ** 1.4;
      });
      // El centro brilla y una nebulosa suave alrededor.
      const center = glowSprite(new THREE.Color(0xfff7e0));
      center.position.copy(point);
      addEffect(center, 1.2, (t) => {
        center.scale.setScalar((0.7 + power * 0.5) * (0.7 + Math.sin(t * 9) * 0.08));
        center.material.opacity = (1 - t) ** 1.5;
      });
      [[0x7c3aed, 1], [0xec4899, 0.75]].forEach(([color, share], layer) => {
        const nebula = glowSprite(new THREE.Color(color));
        nebula.position.copy(point);
        addEffect(nebula, 1.4, (t) => {
          nebula.scale.setScalar((1.2 + power * 1.5) * share * (0.5 + easeOut(t) * 0.8));
          nebula.material.rotation = t * (1.5 + layer);
          nebula.material.opacity = Math.sin(Math.PI * t) * 0.45;
        });
      });
    };

    // Oro: monedas de oro de verdad que salen girando, caen y botan en la pista.
    const coinGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.012, 18);
    const coinMaterial = new THREE.MeshStandardMaterial({ color: 0xffc94d, metalness: 1, roughness: 0.28, emissive: 0x7a5200, emissiveIntensity: 0.35 });
    const goldSignature = (point, power) => {
      const coins = Math.round(8 + power * 10);
      for (let index = 0; index < coins; index += 1) {
        const coin = new THREE.Mesh(coinGeometry, coinMaterial.clone());
        coin.castShadow = true;
        coin.position.copy(point);
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 2.4 * power;
        const velocity = new THREE.Vector3(Math.cos(angle) * speed, 1.5 + Math.random() * 2.5, Math.sin(angle) * speed);
        const spin = new THREE.Vector3(Math.random() * 14, Math.random() * 14, Math.random() * 14);
        addEffect(coin, 1.7, (t, dt) => {
          velocity.y -= 9.8 * dt;
          coin.position.addScaledVector(velocity, dt);
          if (coin.position.y < 0.012) {
            coin.position.y = 0.012;
            velocity.y = Math.abs(velocity.y) * 0.45;
            velocity.x *= 0.7;
            velocity.z *= 0.7;
            spin.multiplyScalar(0.6);
          }
          coin.rotation.x += spin.x * dt;
          coin.rotation.y += spin.y * dt;
          coin.rotation.z += spin.z * dt;
          coin.scale.setScalar(t > 0.8 ? (1 - t) / 0.2 : 1);
        });
      }
    };

    // Hielo: esquirlas de hielo que salen disparadas y escarcha que se abre en el suelo.
    const shardGeometry = new THREE.ConeGeometry(0.035, 0.18, 5);
    const shardMaterial = new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x38bdf8, emissiveIntensity: 0.4, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.9 });
    const iceSignature = (point, direction, power) => {
      const shards = Math.round(8 + power * 10);
      for (let index = 0; index < shards; index += 1) {
        const shard = new THREE.Mesh(shardGeometry, shardMaterial.clone());
        shard.position.copy(point);
        const velocity = direction.clone().multiplyScalar(0.8).add(randomDirection()).normalize().multiplyScalar(2 + Math.random() * 3.5 * power);
        const size = 0.7 + Math.random() * 0.9;
        shard.scale.setScalar(size);
        addEffect(shard, 0.7 + Math.random() * 0.4, (t, dt) => {
          velocity.y -= 5 * dt;
          shard.position.addScaledVector(velocity, dt);
          shard.quaternion.setFromUnitVectors(UP, velocity.clone().normalize());
          shard.material.opacity = 0.9 * (1 - t);
        });
      }
      const frost = fxRing({ flames: false }, new THREE.Color(0xe0f2fe));
      frost.rotation.x = -Math.PI / 2;
      frost.position.set(point.x, 0.02, point.z);
      addEffect(frost, 0.9, (t) => {
        frost.scale.setScalar(0.2 + easeOut(t) * (1 + power * 1.2));
        frost.material.opacity = (1 - t) * 0.8;
      });
      for (let index = 0; index < 8; index += 1) {
        const mist = glowSprite(new THREE.Color(0xf0f9ff));
        mist.material.blending = THREE.NormalBlending;
        mist.position.copy(point).add(randomDirection().multiplyScalar(0.2));
        const size = 0.3 + Math.random() * 0.25;
        addEffect(mist, 0.9, (t) => {
          mist.scale.setScalar(size * (0.6 + t));
          mist.material.opacity = Math.sin(Math.PI * t) * 0.4;
        });
      }
    };

    // Estrellas: estrellas de cinco puntas que salen girando y titilando.
    const starTexture = roundTexture(canvasTexture(64, 64, (context) => {
      context.translate(32, 32);
      context.beginPath();
      for (let index = 0; index < 10; index += 1) {
        const radius = index % 2 ? 11 : 28;
        const angle = -Math.PI / 2 + (index * Math.PI) / 5;
        context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      context.closePath();
      context.shadowColor = "white";
      context.shadowBlur = 8;
      context.fillStyle = "white";
      context.fill();
    }));
    const starSignature = (point, theme, power) => {
      const stars = Math.round(10 + power * 12);
      for (let index = 0; index < stars; index += 1) {
        const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture, color: pickColor(theme), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        star.renderOrder = 14;
        star.position.copy(point);
        const velocity = randomDirection().multiplyScalar(1 + Math.random() * 2.2 * power);
        const size = 0.12 + Math.random() * 0.14;
        const spin = (Math.random() - 0.5) * 10;
        addEffect(star, 0.9 + Math.random() * 0.4, (t, dt) => {
          velocity.multiplyScalar(1 - 2.2 * dt);
          star.position.addScaledVector(velocity, dt);
          star.material.rotation += spin * dt;
          star.scale.setScalar(size * (0.7 + Math.abs(Math.sin(t * 16 + index)) * 0.5) * (1 - t * 0.4));
          star.material.opacity = 1 - t * t;
        });
      }
    };

    const SIGNATURES = {
      fuego: (point, theme, power, direction) => fireSignature(point, power, direction),
      rayo: (point, theme, power) => lightningSignature(point, power),
      galaxia: galaxySignature,
      oro: (point, theme, power) => goldSignature(point, power),
      hielo: (point, theme, power, direction) => iceSignature(point, direction, power),
      estrellas: starSignature,
    };
    const themeSignature = (point, theme, power, direction, action) => {
      flashLight(point, theme.colors[0], power);
      SIGNATURES[theme.name]?.(point, theme, power, direction, action);
    };

    const themedBurst = (point, theme, power, direction = new THREE.Vector3(0, -0.4, -1).normalize(), action = "remate", feet = null) => {
      themeSignature(point, theme, power, direction, action);
      if (action === "recepcion") receptionShow(point, theme, feet ?? point.clone().setY(0));
      else if (action === "colocacion") setShow(point, theme);
      forceImpact(point, direction, power, theme.colors, Boolean(theme.flames));
      if (theme.stars) {
        // Estrellitas que se quedan flotando un momento alrededor del golpe.
        for (let index = 0; index < 14; index += 1) {
          const star = fxSprite(theme);
          star.position.copy(point).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8));
          const size = 0.05 + Math.random() * 0.05;
          addEffect(star, 0.6 + Math.random() * 0.4, (t) => {
            star.scale.setScalar(size * (0.5 + Math.abs(Math.sin(t * 18 + index)) * 0.8) * (1 - t * 0.5));
            star.material.opacity = 1 - t;
          });
        }
      }
      if (theme.bolts) {
        // Rayos que salen del balón en zigzag.
        for (let bolt = 0; bolt < 5; bolt += 1) {
          const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
          const points = [point.clone()];
          for (let step = 1; step <= 6; step += 1) {
            const next = point.clone().addScaledVector(direction, step * 0.28);
            next.add(new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25));
            points.push(next);
          }
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: bolt % 2 ? 0xfacc15 : 0x67e8f9, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
          );
          addEffect(line, 0.25, (t) => {
            line.material.opacity = 1 - t;
          });
        }
      }
      state.shake = Math.max(state.shake, 0.12 + power * 0.08);
    };

    // Antes de rematar con efecto: al despegar sale una onda del suelo y el jugador va dejando partículas.
    const takeoffBlast = (position, theme) => {
      const ring = fxRing(theme, new THREE.Color(theme.colors[0]));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(position.x, 0.02, position.z);
      addEffect(ring, 0.55, (t) => {
        ring.scale.setScalar(0.2 + easeOut(t) * 1.6);
        ring.material.opacity = (1 - t) * 0.9;
      });
      for (let index = 0; index < 18; index += 1) {
        const puff = fxSprite(theme);
        const angle = Math.random() * Math.PI * 2;
        puff.position.set(position.x + Math.cos(angle) * 0.25, 0.05, position.z + Math.sin(angle) * 0.25);
        const velocity = new THREE.Vector3(Math.cos(angle) * 0.8, 1.5 + Math.random() * 2.5, Math.sin(angle) * 0.8);
        const size = 0.12 + Math.random() * 0.12;
        addEffect(puff, 0.5 + Math.random() * 0.3, (t, dt) => {
          puff.position.addScaledVector(velocity, dt);
          puff.scale.setScalar(size * (1 - t * 0.6));
          puff.material.opacity = 1 - t;
        });
      }
    };
    // Lo que va soltando el balón por detrás tras un golpe con efecto: pequeño y discreto.
    const trailParticle = (position, theme) => {
      if (theme.bolts) {
        // Rayito: tres tramos en zigzag que se apagan enseguida.
        const points = [position.clone()];
        for (let step = 0; step < 3; step += 1) {
          points.push(points[step].clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18)));
        }
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: Math.random() > 0.5 ? 0x67e8f9 : 0xfacc15, transparent: true, depthWrite: false }),
        );
        addEffect(line, 0.18, (t) => {
          line.material.opacity = 1 - t;
        });
        return;
      }
      const bit = fxSprite(theme);
      bit.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1));
      const size = theme.flames ? 0.09 + Math.random() * 0.05 : 0.05 + Math.random() * 0.04;
      const rise = theme.flames ? 0.6 : 0.1;
      addEffect(bit, 0.3 + Math.random() * 0.25, (t, dt) => {
        bit.position.y += rise * dt;
        // Las estrellitas titilan; la llama se va haciendo pequeña.
        const twinkle = theme.stars ? 0.55 + Math.abs(Math.sin(t * 25)) * 0.45 : 1;
        bit.scale.setScalar(size * (1 - t * 0.7) * twinkle);
        bit.material.opacity = (1 - t) * 0.95;
      });
    };
    const auraParticle = (position, theme, height) => {
      const spot = position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.45, Math.random() * height, (Math.random() - 0.5) * 0.45));
      const ember = fxSprite(theme);
      ember.position.copy(spot);
      const rise = (theme.flames ? 1.6 : 0.8) + Math.random();
      const size = 0.13 + Math.random() * 0.12;
      addEffect(ember, 0.35 + Math.random() * 0.25, (t, dt) => {
        ember.position.y += rise * dt;
        ember.scale.setScalar(size * (1 - t));
        ember.material.opacity = (1 - t) * 0.9;
      });
    };

    // Onda de choque: un anillo difuminado (aire comprimido), no una raya dura.
    const shockTexture = roundTexture(canvasTexture(256, 256, (context) => {
      const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.5, "rgba(255,255,255,0)");
      gradient.addColorStop(0.7, "rgba(255,255,255,0.55)");
      gradient.addColorStop(0.8, "rgba(255,255,255,0.9)");
      gradient.addColorStop(0.88, "rgba(255,255,255,0.3)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 256, 256);
    }));
    const streakMaterial = (color, additive) =>
      new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });

    // El golpe con fuerza: destello, onda de choque y líneas y chispas disparadas hacia donde sale el balón.
    // `direction` va del jugador hacia delante y hacia abajo (un remate), `colors` son los del efecto.
    const forceImpact = (point, direction, power, colors, additive = true) => {
      state.hush = { point: point.clone(), at: performance.now() };
      const pick = () => new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
      // Destello en estrella: rayos de luz que giran un poco y se apagan enseguida.
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: starburst, color: new THREE.Color(0xffffff), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      core.renderOrder = 14;
      core.position.copy(point);
      const spin = (Math.random() - 0.5) * 2;
      addEffect(core, 0.22, (t) => {
        core.scale.setScalar((0.9 + power * 1.4) * (0.7 + easeOut(t) * 0.5));
        core.material.rotation = spin * t;
        core.material.opacity = (1 - t) ** 1.3;
      });
      const tint = new THREE.Sprite(new THREE.SpriteMaterial({ map: starburst, color: new THREE.Color(colors[0]), transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
      tint.renderOrder = 13;
      tint.position.copy(point);
      addEffect(tint, 0.42, (t) => {
        tint.scale.setScalar((1.6 + power * 2.4) * (0.6 + easeOut(t) * 0.6));
        tint.material.rotation = -spin * t + 0.2;
        tint.material.opacity = (1 - t) * 0.85;
      });
      const halo = glowSprite(new THREE.Color(colors[0]));
      if (!additive) halo.material.blending = THREE.NormalBlending;
      halo.position.copy(point);
      addEffect(halo, 0.28, (t) => {
        halo.scale.setScalar((0.8 + power * 1.3) * (0.6 + t * 0.6));
        halo.material.opacity = (1 - t) * 0.8;
      });
      // Onda de choque que se abre muy rápido y se desvanece (una sola, suave).
      const shock = new THREE.Sprite(new THREE.SpriteMaterial({ map: shockTexture, color: new THREE.Color(colors[0]).lerp(new THREE.Color(0xffffff), 0.35), transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
      shock.position.copy(point);
      shock.renderOrder = 13;
      addEffect(shock, 0.36, (t) => {
        shock.scale.setScalar(0.2 + easeOut(t) * (1.6 + power * 2));
        shock.material.opacity = (1 - t) ** 1.5;
      });
      // Segunda onda, un instante después y más grande: el golpe "retumba".
      const echo = new THREE.Sprite(shock.material.clone());
      echo.position.copy(point);
      echo.renderOrder = 13;
      addEffect(echo, 0.5, (t) => {
        const late = Math.max(0, (t - 0.25) / 0.75);
        echo.scale.setScalar(0.2 + easeOut(late) * (2.4 + power * 2.6));
        echo.material.opacity = late > 0 ? (1 - late) ** 2 * 0.7 : 0;
      });
      // Líneas de fuerza: rectas cortas que salen disparadas en la dirección del golpe.
      const streaks = Math.round(14 + power * 18);
      for (let index = 0; index < streaks; index += 1) {
        const spread = new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.9);
        const velocity = direction.clone().add(spread).normalize().multiplyScalar(5 + Math.random() * 7 * power);
        const length = 0.25 + Math.random() * 0.45 * power;
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), velocity.clone().normalize().multiplyScalar(-length)]);
        const line = new THREE.Line(geometry, streakMaterial(pick(), additive));
        line.renderOrder = 12;
        line.position.copy(point);
        addEffect(line, 0.22 + Math.random() * 0.15, (t, dt) => {
          line.position.addScaledVector(velocity, dt);
          line.scale.setScalar(1 - t * 0.5);
          line.material.opacity = 1 - t;
        });
      }
      // Chispas, también hacia donde va el golpe (y algunas rebotando hacia atrás).
      const sparks = Math.round(16 + power * 34);
      for (let index = 0; index < sparks; index += 1) {
        const spark = glowSprite(pick());
        if (!additive) spark.material.blending = THREE.NormalBlending;
        spark.position.copy(point);
        const forward = Math.random() < 0.75;
        const base = forward ? direction.clone() : direction.clone().multiplyScalar(-0.4);
        const velocity = base.add(new THREE.Vector3((Math.random() - 0.5) * 1.4, Math.random() * 0.9 - 0.2, (Math.random() - 0.5) * 1.4)).normalize().multiplyScalar(2 + Math.random() * 5 * power);
        const size = 0.06 + Math.random() * 0.09;
        addEffect(spark, 0.4 + Math.random() * 0.5, (t, dt) => {
          velocity.y -= 6 * dt;
          velocity.multiplyScalar(1 - 2.5 * dt);
          spark.position.addScaledVector(velocity, dt);
          spark.scale.setScalar(size * (1 - t));
          spark.material.opacity = 1 - t * t;
        });
      }
    };

    // Golpe al balón: los fuertes (remate, saque, bloqueo) con onda de choque y líneas de fuerza;
    // los suaves, solo un destello.
    const burst = (point, action, direction = new THREE.Vector3(0, -0.4, -1).normalize()) => {
      const strong = { remate: 1, fuerte: 0.9, saque: 0.7, bloqueo: 0.6 }[action];
      if (strong) {
        forceImpact(point, direction, strong, [0xffffff, 0xf4f4f5, 0xe0f2fe]);
        state.shake = Math.max(state.shake, strong >= 1 ? 0.12 : strong >= 0.7 ? 0.06 : 0);
        return;
      }
      const soft = glowSprite(new THREE.Color(0xffffff));
      soft.position.copy(point);
      addEffect(soft, 0.2, (t) => {
        soft.scale.setScalar(0.7 * (1 - t * 0.5));
        soft.material.opacity = (1 - t) * 0.9;
      });
    };
    // Bote: onda plana en el suelo y un poco de polvo. Tras un remate, en fuego y mucho más grande.
    const floorImpact = (point, strength, hot, theme = null) => {
      const ring = ringMesh(theme ? new THREE.Color(theme.colors[0]) : hot ? FIRE : WHITE);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(point.x, 0.015, point.z);
      const size = 0.35 + strength * 1.2 + (hot ? 1.6 : 0);
      addEffect(ring, 0.5 + (hot ? 0.3 : 0), (t) => {
        ring.scale.setScalar(0.1 + easeOut(t) * size);
        ring.material.opacity = (1 - t) * (hot ? 0.9 : 0.35 + strength * 0.4);
      });
      const dust = Math.round(4 + strength * 8 + (hot ? 14 : 0));
      for (let index = 0; index < dust; index += 1) {
        const puff = glowSprite(theme ? pickColor(theme) : hot ? (Math.random() < 0.5 ? FIRE : GOLD) : new THREE.Color(0xd8c7b0));
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.6 + Math.random() * 1.2) * (hot ? 2.2 : 1);
        const velocity = new THREE.Vector3(Math.cos(angle) * speed, 0.4 + Math.random() * (hot ? 2.5 : 0.8), Math.sin(angle) * speed);
        puff.position.set(point.x, 0.05, point.z);
        const size = (hot ? 0.16 : 0.12) + Math.random() * 0.1;
        addEffect(puff, 0.4 + Math.random() * 0.35, (t, dt) => {
          velocity.y -= 4 * dt;
          puff.position.addScaledVector(velocity, dt);
          if (puff.position.y < 0.03) puff.position.y = 0.03;
          puff.scale.setScalar(size * (0.6 + t));
          puff.material.opacity = (1 - t) * (hot ? 0.9 : 0.45);
        });
      }
      if (hot) state.shake = Math.max(state.shake, 0.1);
    };

    const updateEffects = (dt) => {
      state.effects = state.effects.filter((effect) => {
        effect.age += dt;
        const t = effect.age / effect.life;
        if (t >= 1) {
          scene.remove(effect.object);
          effect.object.material?.dispose();
          if (effect.object.userData.ownsGeometry) effect.object.geometry.dispose();
          return false;
        }
        effect.update(t, dt);
        return true;
      });
    };

    // El navegador solo deja sonar tras tocar algo (por ejemplo, el botón de reproducir).
    const unlock = () => unlockSound();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    // Volumen según lo lejos que esté de la cámara, y a la izquierda o derecha según dónde se vea.
    const placeSound = (point) => {
      const distance = view.position.distanceTo(point);
      const screen = point.clone().project(view);
      return { volume: Math.min(1, 7 / (4 + distance)), pan: Math.max(-1, Math.min(1, screen.x)) * 0.7 };
    };

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setPixelRatio(fitRatio());
      renderer.setSize(width, height);
      view.aspect = width / Math.max(1, height);
      view.fov = fovFor(view.aspect);
      view.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const syncPlayers = (current, now) => {
      const seen = new Set();
      const firstBall = current.elements.find((element) => element.type === "ball");
      const ballSpot = firstBall ? toWorld(firstBall.x, firstBall.y) : null;
      state.strikes = [];
      current.elements.forEach((element) => {
        if (element.type !== "token") return;
        seen.add(element.id);
        const player = current.rosterById[element.player_id];
        const position = tokenPosition(element, player);
        // Complexión femenina para las jugadoras del femenino (y las rivales en una jugada del femenino).
        const female = player ? player.team_id === "femenino" : current.teamId === "femenino";
        const key = `${element.name}|${element.label}|${position}|${player?.number}|${player?.picture}|${element.side}|${female}|${player?.height_cm}|${JSON.stringify(player?.character ?? null)}`;
        let rig = state.players.get(element.id);
        if (rig && rig.key !== key) {
          scene.remove(rig.group);
          rig = null;
        }
        if (!rig) {
          rig = createPlayer(scene, element, player, position, female);
          rig.group.scale.setScalar(rig.scale);
          rig.key = key;
          state.players.set(element.id, rig);
        }
        const at = toWorld(element.x, element.y);
        // Andar o correr según lo rápido que se mueve.
        const previous = rig.motion;
        const distance = previous ? Math.hypot((element.x - previous.x) * W, (element.y - previous.y) * H) : 0;
        const step = distance < 25 ? distance : 0;
        const elapsed = previous ? Math.max(1, now - previous.t) : 16;
        const speed = step / elapsed;
        const runTarget = Math.min(1, Math.max(0, (speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)));
        const run = (previous?.run ?? 0) + (runTarget - (previous?.run ?? 0)) * 0.25;
        const phase = (previous?.phase ?? 0) + step * (0.7 + run * 0.6);
        const amount = (previous?.amount ?? 0) + ((step > 0.05 ? 1 : 0) - (previous?.amount ?? 0)) * 0.35;
        rig.motion = { x: element.x, y: element.y, t: now, run, phase, amount };
        // Un paso cada media zancada, solo mientras se reproduce la jugada.
        if (current.actions && previous && amount > 0.4 && Math.floor(phase / Math.PI) !== Math.floor((previous.phase ?? 0) / Math.PI)) {
          playStep({ run, ...placeSound(at) });
        }

        rig.group.position.copy(at);
        // Subido a un cajón: de pie encima (un entrenador dando balones, un jugador bloqueando…).
        rig.group.position.y = boxUnder(current.elements, element.x, element.y) ? BOX_HEIGHT_M : 0;
        rig.group.userData.elementId = element.id;
        // Hacia dónde mira: a donde corre si va rápido; si no, al balón (sin dar la espalda a la red).
        // Mira hacia la red de la mitad en la que está (un rival puesto en tu campo también mira a la red).
        const baseYaw = at.z >= 0 ? 0 : Math.PI;
        let wanted = baseYaw;
        // El balón de verdad (con su altura) para seguirlo con la cabeza y los ojos.
        const ballNow = [...state.balls.values()][0]?.mesh.position ?? ballSpot;
        let ballInSight = false;
        if (previous && run * amount > 0.35 && step > 0.05) {
          wanted = Math.atan2(-(element.x - previous.x) * W, -(element.y - previous.y) * H);
        } else if (ballSpot && ballSpot.distanceTo(at) > 0.4) {
          const toBall = Math.atan2(-(ballSpot.x - at.x), -(ballSpot.z - at.z));
          let offset = toBall - baseYaw;
          while (offset > Math.PI) offset -= Math.PI * 2;
          while (offset < -Math.PI) offset += Math.PI * 2;
          // Delante o a un lado: se gira hacia él. Si queda detrás, sigue mirando a la red
          // (antes intentaba girarse hacia atrás y se quedaba mirando de lado).
          if (Math.abs(offset) < 1.75) {
            wanted = baseYaw + Math.max(-1.3, Math.min(1.3, offset));
            ballInSight = true;
          }
        } else if (ballSpot) {
          ballInSight = true;
        }
        rig.yaw = turnTowards(rig.yaw, wanted, 0.12);
        rig.group.rotation.y = rig.yaw;
        rig.ring.visible = Boolean(element.highlight);
        const action = current.actions?.get(element.id) ?? null;
        // Las acciones del entrenador se hacen con el gesto de un jugador (free = colocar, fuerte = golpe por arriba).
        const poseAction = action ? { ...action, action: poseOf(action.action) } : null;
        const strikeHand = posePlayer(rig, { stride: Math.sin(phase), run, amount, action: poseAction, time: now, lookAt: ballInSight && ballNow ? ballNow.clone() : null });
        // El golpe suena justo al tocar el balón (si se salta o se rebobina, no).
        if (action) {
          const before = rig.lastAction;
          const hitAt = contactTime(action.action) / actionDuration(action.action);
          if (before && before.action === action.action && before.progress < hitAt && action.progress >= hitAt && action.progress - before.progress < 0.3) {
            rig.group.updateMatrixWorld(true);
            const handsNow = rig.joints.hands.map((hand) => hand.getWorldPosition(new THREE.Vector3()));
            let point = strikeHand === null ? handsNow[0].lerp(handsNow[1], 0.5) : handsNow[strikeHand];
            const nearest = [...state.balls.values()].sort((a, b) => a.mesh.position.distanceTo(point) - b.mesh.position.distanceTo(point))[0];
            const theme = fxOf(rig, action.action);
            // Con efecto, la estela la coge el balón más cercano aunque no llegue justo a la mano.
            if (nearest && nearest.mesh.position.distanceTo(point) < (theme ? 4 : 1.6)) {
              point = nearest.mesh.position.clone();
              nearest.theme = theme;
              if (theme) {
                nearest.hot = now;
                nearest.heat = 1;
              } else if (action.action === "remate" || action.action === "saque") {
                nearest.hot = now;
                nearest.heat = action.action === "remate" ? 1 : 0.6;
              }
            }
            playHit(action.action, placeSound(point));
            if (theme) playFx(theme.name, action.action, placeSound(point));
            const facing = new THREE.Vector3(-Math.sin(rig.yaw), 0, -Math.cos(rig.yaw));
            const down = action.action === "remate" ? -0.55 : action.action === "saque" ? -0.15 : 0.35;
            const direction = facing.add(new THREE.Vector3(0, down, 0)).normalize();
            if (theme) themedBurst(point, theme, action.action === "remate" ? 1 : 0.6, direction, action.action, rig.group.position.clone());
            else burst(point, action.action, direction);
          }
        }
        // Remate con efecto: onda al despegar y partículas mientras está en el aire.
        const spikeFx = action?.action === "remate" ? fxOf(rig, "remate") : null;
        if (spikeFx) {
          const before = rig.lastAction;
          const duration = actionDuration("remate");
          const takeoff = (takeoffTime("remate") ?? contactTime("remate") * 0.6) / duration;
          const hit = contactTime("remate") / duration;
          if (before && before.action === "remate" && before.progress < takeoff && action.progress >= takeoff) {
            takeoffBlast(rig.group.position, spikeFx);
            if (spikeFx.flames) firePillar(rig.group.position);
          }
          if (action.progress >= takeoff && action.progress <= hit + 0.12) {
            for (let index = 0; index < 3; index += 1) auraParticle(rig.group.position.clone().add(new THREE.Vector3(0, 0.3, 0)), spikeFx, 1.9);
          }
        }
        rig.lastAction = action;
        if (action) {
          // Cerca del momento del toque, el balón va a la mano (o a los antebrazos) de quien lo juega.
          const contact = contactTime(action.action) / actionDuration(action.action);
          const gap = Math.abs(action.progress - contact);
          if (gap < 0.14) {
            rig.group.updateMatrixWorld(true);
            const hands = rig.joints.hands.map((hand) => hand.getWorldPosition(new THREE.Vector3()));
            const point = strikeHand === null ? hands[0].clone().lerp(hands[1], 0.5) : hands[strikeHand];
            const overhead = ["saque", "remate", "colocacion", "bloqueo"].includes(poseOf(action.action));
            point.y += overhead ? 0.13 : 0.1;
            state.strikes.push({ at, point, weight: 1 - gap / 0.14 });
          }
        }

        // Etiqueta de la acción mientras la hace.
        const tagKey = action ? `${action.action}|${action.tempo ?? ""}` : "";
        if (tagKey !== rig.tagKey) {
          if (rig.tag) rig.group.remove(rig.tag);
          rig.tag = tagKey ? labelSprite(actionLabel(action.action, action.tempo).toUpperCase(), { background: "#FF3800", width: 0.9 }) : null;
          if (rig.tag) rig.group.add(rig.tag);
          rig.tagKey = tagKey;
        }
        // Los textos se apartan un momento cuando hay un golpe fuerte cerca, para no tapar el efecto.
        const hush = state.hush;
        const hushed = hush && performance.now() - hush.at < HUSH_MS && rig.group.position.distanceTo(hush.point.clone().setY(0)) < HUSH_RADIUS;
        rig.labelFade = (rig.labelFade ?? 1) + ((hushed ? 0 : 1) - (rig.labelFade ?? 1)) * (hushed ? 0.35 : 0.12);
        if (rig.name) rig.name.material.opacity = rig.labelFade;
        if (rig.tag) {
          rig.tag.position.set(0, rig.body.position.y + 2.32, 0);
          rig.tag.material.opacity = Math.min(1, Math.sin(Math.PI * action.progress) * 3) * rig.labelFade;
        }
      });
      [...state.players.keys()].forEach((id) => {
        if (!seen.has(id)) {
          scene.remove(state.players.get(id).group);
          state.players.delete(id);
        }
      });
    };

    // Conos y cajónes.
    const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xff6a13, roughness: 0.55 });
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0xc08a4e, roughness: 0.8 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.85 });
    const buildProp = (kind) => {
      const group = new THREE.Group();
      if (kind === "cone") {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.24), coneMaterial);
        base.position.y = 0.0125;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.3, 24), coneMaterial);
        cone.position.y = 0.175;
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.06, 0.05, 24), stripeMaterial);
        stripe.position.y = 0.2;
        group.add(base, cone, stripe);
      } else {
        const width = BOX_SIZE.w * M;
        const depth = BOX_SIZE.h * M;
        const body = new THREE.Mesh(new THREE.BoxGeometry(width, BOX_HEIGHT_M, depth), woodMaterial);
        body.position.y = BOX_HEIGHT_M / 2;
        const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.03, depth + 0.02), woodDark);
        top.position.y = BOX_HEIGHT_M - 0.015;
        group.add(body, top);
        // Asas a los lados, como los cajónes de pliometría.
        [-1, 1].forEach((side) => {
          const grip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.012), woodDark);
          grip.position.set(0, BOX_HEIGHT_M * 0.72, side * (depth / 2 + 0.002));
          group.add(grip);
        });
      }
      group.traverse((object) => {
        object.castShadow = true;
        object.receiveShadow = true;
      });
      return group;
    };
    const syncProps = (current) => {
      const seen = new Set();
      current.elements.forEach((element) => {
        if (element.type !== "prop") return;
        seen.add(element.id);
        let prop = state.props.get(element.id);
        if (prop && prop.kind !== element.kind) {
          scene.remove(prop.group);
          prop = null;
        }
        if (!prop) {
          prop = { kind: element.kind, group: buildProp(element.kind) };
          prop.group.userData.elementId = element.id;
          scene.add(prop.group);
          state.props.set(element.id, prop);
        }
        prop.group.position.copy(toWorld(element.x, element.y));
      });
      [...state.props.keys()].forEach((id) => {
        if (!seen.has(id)) {
          scene.remove(state.props.get(id).group);
          state.props.delete(id);
        }
      });
    };

    // Arrastrar con el dedo: si se toca a un jugador (o un cono, un cajón), se mueve por el suelo
    // y la cámara se queda quieta; si se toca la pista, la cámara gira como siempre.
    const raycaster = new THREE.Raycaster();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointerRay = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, view);
      return raycaster;
    };
    const floorPoint = (event) => pointerRay(event).ray.intersectPlane(floor, new THREE.Vector3());
    const onDragStart = (event) => {
      if (!latest.current.onMove || state.drag || (event.pointerType === "mouse" && event.button !== 0)) return;
      const targets = [...[...state.players.values()].map((rig) => rig.group), ...[...state.props.values()].map((prop) => prop.group)];
      const hit = pointerRay(event).intersectObjects(targets, true).find((item) => !item.object.isSprite);
      if (!hit) return;
      let object = hit.object;
      while (object && !object.userData.elementId) object = object.parent;
      const element = object && latest.current.elements.find((item) => item.id === object.userData.elementId);
      const start = floorPoint(event);
      if (!element || !start) return;
      // Que no le llegue a la cámara.
      event.stopPropagation();
      mount.setPointerCapture?.(event.pointerId);
      state.drag = { id: element.id, pointerId: event.pointerId, offset: new THREE.Vector3().subVectors(toWorld(element.x, element.y), start), moved: false, last: null };
    };
    const onDragMove = (event) => {
      const drag = state.drag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.stopPropagation();
      const point = floorPoint(event);
      if (!point) return;
      const spot = fromWorld(point.add(drag.offset));
      drag.moved = true;
      drag.last = { x: roundCoord(spot.x), y: roundCoord(spot.y) };
      latest.current.onMove?.(drag.id, drag.last.x, drag.last.y, false);
    };
    const onDragEnd = (event) => {
      const drag = state.drag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.stopPropagation();
      state.drag = null;
      if (drag.moved && drag.last) latest.current.onMove?.(drag.id, drag.last.x, drag.last.y, true);
    };
    // En fase de captura, en el contenedor: así llega antes que a los controles de la cámara.
    mount.addEventListener("pointerdown", onDragStart, true);
    mount.addEventListener("pointermove", onDragMove, true);
    mount.addEventListener("pointerup", onDragEnd, true);
    mount.addEventListener("pointercancel", onDragEnd, true);

    const TRAIL = 18;
    // Cuánto tiempo y a qué distancia se apartan los textos tras un golpe fuerte.
    const HUSH_MS = 750;
    const HUSH_RADIUS = 3.2;
    const syncBalls = (current, now) => {
      const seen = new Set();
      current.elements.forEach((element) => {
        if (element.type !== "ball") return;
        seen.add(element.id);
        let ball = state.balls.get(element.id);
        if (!ball) {
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 20), ballMaterial);
          mesh.castShadow = true;
          // El destello del balón en cada toque, redondo (sin textura salía un cuadrado blanco).
          const flash = new THREE.Sprite(flashMaterial.clone());
          flash.material.map = glow;
          flash.material.blending = THREE.AdditiveBlending;
          flash.scale.set(0.9, 0.9, 1);
          scene.add(mesh);
          scene.add(flash);
          // Estela: bolitas de luz que siguen al balón y se apagan; más largas y en fuego tras un remate.
          const trail = Array.from({ length: TRAIL }, () => {
            const sprite = glowSprite(WHITE);
            sprite.visible = false;
            scene.add(sprite);
            return sprite;
          });
          ball = { mesh, flash, last: null, trail, history: [], glow: 0, hot: 0, heat: 0 };
          state.balls.set(element.id, ball);
        }
        const height = current.heights?.get(element.id) ?? 0;
        // La altura viene de la misma cuenta que en la vista inclinada: se pasa a metros.
        const lift = Math.max(0, ((height + 2) / 1.3) * FIG - 0.11);
        const at = toWorld(element.x, element.y);
        at.y = BALL_R + lift;
        // Un balón encima de un cajón (el del entrenador antes de lanzarlo) no se mete dentro.
        if (boxUnder(current.elements, element.x, element.y)) at.y = Math.max(at.y, BOX_HEIGHT_M + BALL_R);
        // Bote: venía cayendo y ya no baja, pegado al suelo. Suena más cuanto más alto venía.
        if (current.actions && ball.lift !== undefined) {
          const fall = ball.lift - lift;
          ball.peak = Math.max(ball.peak ?? 0, lift);
          if (ball.falling && fall <= 0 && ball.lift < 0.1 && Math.abs(fall) < 1) {
            const strength = Math.min(1, Math.sqrt(ball.peak / 2));
            const hot = ball.hot && now - ball.hot < 1800;
            playBounce({ strength: hot ? 1 : strength, ...placeSound(at) });
            floorImpact(at, strength, hot, hot ? ball.theme : null);
            if (hot && ball.theme?.flames) fireLanding(at);
            ball.hot = 0;
            ball.peak = 0;
          }
          ball.falling = fall > 0.002;
        } else {
          ball.falling = false;
          ball.peak = 0;
        }
        ball.lift = lift;
        if (ball.last) {
          const move = new THREE.Vector3().subVectors(at, ball.last);
          move.y = 0;
          const length = move.length();
          if (length > 0.0001 && length < 3) {
            const axis = new THREE.Vector3().crossVectors(UP, move).normalize();
            ball.mesh.rotateOnWorldAxis(axis, length / BALL_R);
          }
        }
        // Si alguien lo está tocando, el balón se acerca a su mano.
        const strike = (state.strikes ?? [])
          .filter((item) => Math.hypot(item.at.x - at.x, item.at.z - at.z) < 1.4)
          .sort((a, b) => b.weight - a.weight)[0];
        if (strike) at.lerp(strike.point, strike.weight);
        ball.mesh.position.copy(at);
        // Estela según lo rápido que va (en m/s) y si viene de un remate.
        const dt = Math.max(1, now - (ball.time ?? now - 16)) / 1000;
        const speed = ball.last ? at.distanceTo(ball.last) / dt : 0;
        const heatLife = ball.theme ? 2400 : 1400;
        const heat = ball.hot ? Math.max(0, 1 - (now - ball.hot) / heatLife) * ball.heat : 0;
        if (ball.theme && heat > 0.15 && ball.last && at.distanceTo(ball.last) > 0.01) {
          trailParticle(at, ball.theme);
          if (ball.theme.flames && heat > 0.3) fireComet(at);
        }
        const wanted = current.actions && speed < 60 ? Math.min(1, Math.max(0, (speed - 3) / 9) + heat) : 0;
        ball.glow += (wanted - ball.glow) * 0.25;
        ball.history.unshift(at.clone());
        ball.history.length = Math.min(ball.history.length, TRAIL);
        const color = WHITE.clone().lerp(ball.theme ? new THREE.Color(ball.theme.trail) : FIRE, Math.min(1, heat * 1.4));
        ball.trail.forEach((sprite, index) => {
          const spot = ball.history[index];
          sprite.visible = Boolean(spot) && ball.glow > 0.02;
          if (!sprite.visible) return;
          const fade = 1 - index / TRAIL;
          sprite.position.copy(spot);
          sprite.scale.setScalar(BALL_R * (2 + heat * (ball.theme ? 3.4 : 2.2)) * (0.35 + fade * 0.75));
          // Estela del efecto con su color de verdad (el fuego sigue sumando luz).
          sprite.material.blending = ball.theme && heat > 0.05 && !ball.theme.flames ? THREE.NormalBlending : THREE.AdditiveBlending;
          sprite.material.color.copy(color);
          sprite.material.opacity = ball.glow * fade * (0.55 + heat * 0.4);
        });
        ball.time = now;
        ball.last = at.clone();
        const flash = current.flashes?.get(element.id) ?? 0;
        ball.flash.position.copy(at);
        ball.flash.material.opacity = flash * 0.85;
        ball.flash.scale.setScalar(0.5 + (1 - flash) * 0.9);
      });
      [...state.balls.keys()].forEach((id) => {
        if (!seen.has(id)) {
          const ball = state.balls.get(id);
          scene.remove(ball.mesh);
          scene.remove(ball.flash);
          ball.trail.forEach((sprite) => {
            scene.remove(sprite);
            sprite.material.dispose();
          });
          state.balls.delete(id);
        }
      });
    };

    // Cada 40 fotogramas mira cuánto tarda cada uno: si pasa de unos 22 ms (menos de 45 por segundo), baja un poco.
    const adaptQuality = (now) => {
      if (quality.last) {
        quality.spent += now - quality.last;
        quality.frames += 1;
      }
      quality.last = now;
      if (quality.frames < 40) return;
      const average = quality.spent / quality.frames;
      quality.frames = 0;
      quality.spent = 0;
      if (average > 22 && quality.ratio > 0.6) {
        quality.ratio = Math.max(0.6, quality.ratio - 0.25);
        if (quality.ratio <= 1 && sun.castShadow && sun.shadow.mapSize.x > 1024) {
          sun.shadow.mapSize.set(1024, 1024);
          sun.shadow.map?.dispose();
          sun.shadow.map = null;
        }
      } else if (average < 14 && quality.ratio < Math.min(2, window.devicePixelRatio)) {
        quality.ratio = Math.min(Math.min(2, window.devicePixelRatio), quality.ratio + 0.25);
      } else {
        return;
      }
      renderer.setPixelRatio(fitRatio());
    };

    const tick = (now) => {
      const current = latest.current;
      syncProps(current);
      syncPlayers(current, now);
      syncBalls(current, now);
      const frameDt = Math.min(0.05, Math.max(0, (now - (state.lastNow || now)) / 1000));
      state.lastNow = now;
      updateEffects(frameDt);

      // Viaje de la cámara al elegir una vista.
      if (state.flight) {
        const progress = Math.min(1, (now - state.flight.started) / 700);
        const eased = 1 - (1 - progress) ** 3;
        view.position.lerpVectors(state.flight.fromPosition, state.flight.toPosition, eased);
        controls.target.lerpVectors(state.flight.fromTarget, state.flight.toTarget, eased);
        if (progress >= 1) state.flight = null;
      } else if (cameraRef.current === "balon") {
        const ball = [...state.balls.values()][0];
        if (ball) {
          const wanted = ball.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 7.5));
          view.position.lerp(wanted, 0.08);
          controls.target.lerp(ball.mesh.position, 0.12);
        }
      }
      controls.update();
      // Sacudida de cámara en los golpes fuertes.
      const jolt = new THREE.Vector3();
      if (state.shake > 0.001) {
        jolt.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(state.shake);
        view.position.add(jolt);
        state.shake *= 0.86;
      }
      renderer.render(scene, view);
      // Si la pestaña estaba oculta, el primer fotograma no cuenta.
      if (document.hidden) quality.last = 0;
      else adaptQuality(now);
      view.position.sub(jolt);
      state.frame = requestAnimationFrame(tick);
    };
    state.frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(state.frame);
      observer.disconnect();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      mount.removeEventListener("pointerdown", onDragStart, true);
      mount.removeEventListener("pointermove", onDragMove, true);
      mount.removeEventListener("pointerup", onDragEnd, true);
      mount.removeEventListener("pointercancel", onDragEnd, true);
      controls.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        materials.forEach((material) => {
          material.map?.dispose?.();
          material.dispose?.();
        });
      });
      environment.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [beach]);

  const chooseCamera = (id) => {
    const state = sceneRef.current;
    cameraRef.current = id;
    setCamera(id);
    const preset = cameraPreset(id, state?.view.aspect ?? 1);
    if (!state || !preset || preset.follow) return;
    state.flight = {
      started: performance.now(),
      fromPosition: state.view.position.clone(),
      toPosition: new THREE.Vector3(...preset.position),
      fromTarget: state.controls.target.clone(),
      toTarget: new THREE.Vector3(...preset.target),
    };
  };

  if (showcase) {
    return (
      <div className="absolute inset-0">
        <div ref={mountRef} data-viewer-3d className="absolute inset-0 overflow-hidden" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} data-viewer-3d className="absolute inset-0 overflow-hidden" />
      <div role="group" aria-label="Cámara" className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
        <div className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-panel/85 p-1 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CAMERAS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={camera === item.id}
              onClick={() => chooseCamera(item.id)}
              className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-bold ${camera === item.id ? "bg-tnt text-onbrand" : "text-zinc-200 hover:bg-white/10"}`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={sound}
            aria-label={sound ? "Quitar el sonido" : "Poner el sonido"}
            title={sound ? "Quitar el sonido" : "Poner el sonido"}
            onClick={() => {
              setSoundEnabled(!sound);
              setSound(!sound);
            }}
            className="flex min-h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-200 hover:bg-white/10"
          >
            {sound ? <Volume2 aria-hidden="true" className="h-4 w-4" /> : <VolumeX aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {hint && (
        <p className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-zinc-300">
          Arrastra para girar · pellizca o rueda para acercar
        </p>
      )}
    </div>
  );
}
