import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
// Camisetas del club (local, líbero y rival) y abreviatura de cada posición.
export const JERSEYS = {
  home: { shirt: "#09090B", trim: "#FFFFFF", number: "#FFFFFF" },
  libero: { shirt: "#FCD34D", trim: "#09090B", number: "#09090B" },
  rival: { shirt: "#FF3800", trim: "#FFFFFF", number: "#FFFFFF" },
  // Entrenador: chándal gris oscuro con el naranja del club.
  coach: { shirt: "#27272A", trim: "#FF3800", number: "#FF8A3D" },
};
export const POSITION_SHORT = { Líbero: "LIB", Colocador: "COL", Receptor: "REC", Central: "CEN", Opuesto: "OPU" };
import { ACTION_KEYS, baseOf, capturedOf, gesturePlan, jumpAt } from "@/app/character/gestureTimes.js";
import { accentHex, hairHex, hairHex2, lookFromSeed, normalizeLook, skinHex } from "@/app/character/looks.js";

// El muñeco 3D: el mismo en la pizarra y en el perfil. Mide 1,75 m y las medidas van en metros.

export const UP = new THREE.Vector3(0, 1, 0);

// ---------- Texturas dibujadas en un lienzo ----------
export function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function labelSprite(text, { background = "rgba(0,0,0,0.78)", color = "#FFFFFF", accent = "", accentColor = "#FF8800", width = 1.1 } = {}) {
  const texture = canvasTexture(256, 64, (context, w, h) => {
    context.font = "700 30px Arial, Helvetica, sans-serif";
    const total = context.measureText(text).width + (accent ? context.measureText(` ${accent}`).width : 0);
    const boxWidth = Math.min(w - 4, total + 28);
    const left = (w - boxWidth) / 2;
    context.fillStyle = background;
    context.beginPath();
    context.roundRect(left, 8, boxWidth, h - 16, 18);
    context.fill();
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.fillText(text, left + 14, h / 2 + 1);
    if (accent) {
      context.fillStyle = accentColor;
      context.fillText(` ${accent}`, left + 14 + context.measureText(text).width, h / 2 + 1);
    }
  });
  // Mismo tamaño en pantalla esté cerca o lejos: si no, los de cerca tapan media pista.
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, sizeAttenuation: false }));
  sprite.scale.set(width * 0.11, (width * 0.11) / 4, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// ---------- Cuerpo ----------
function placeLimb(mesh, from, to) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length() || 0.001;
  mesh.position.copy(from).addScaledVector(direction, 0.5);
  // Grosor según la complexión de cada uno (ver bodyShape); el largo, el del hueso.
  const [wide, deep] = mesh.userData.girth ?? [1, 1];
  mesh.scale.set(wide, length, deep);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
}

// Rotta: la cabeza un poco más grande que la de una persona, como un personaje de videojuego.
// Así se reconoce a cada uno en el móvil. Todo lo que cuelga de la cabeza (pelo, gafas, corona) crece con ella.
export const HEAD_GROW = 1.38;

// Brillo de contorno: los bordes del personaje se iluminan un poco y se despegan del fondo, como una figura.
// Va dentro del material (no son mallas extra), así que no pesa aunque haya doce en la pizarra.
export function withRim(material, color = 0xfff1e6, strength = 0.32) {
  const rimColor = new THREE.Color(color);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: rimColor };
    shader.uniforms.rimStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform vec3 rimColor;\nuniform float rimStrength;\nvoid main() {")
      .replace(
        "#include <opaque_fragment>",
        "float rimFactor = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);\noutgoingLight += rimColor * rimFactor * rimStrength;\n#include <opaque_fragment>",
      );
  };
  material.customProgramCacheKey = () => `rim-${strength}`;
  return material;
}

// Brazo o pierna con músculo: de `start` (radio en el punto de partida) crece hasta `peak` hacia `at`
// (0 = partida, 1 = llegada) y baja a `end`. Mismo tamaño y orientación que un cilindro de alto 1.
function muscle(start, peak, end, at, material, segments = 28) {
  const steps = 16;
  const extra = peak - (start + (end - start) * at);
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    // El bulto sube suave hasta `at` y baja suave hasta el final.
    const u = t < at ? (t / at) * 0.5 : 0.5 + ((t - at) / (1 - at)) * 0.5;
    points.push(new THREE.Vector2(start + (end - start) * t + extra * Math.sin(Math.PI * u), t - 0.5));
  }
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(points, segments), material);
  mesh.castShadow = true;
  return mesh;
}

// Un segmento que se estrecha: `start` es el radio en el punto de partida y `end` en el de llegada.
function taper(start, end, material, segments = 28) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(end, start, 1, segments, 1, true), material);
  mesh.castShadow = true;
  return mesh;
}

// Tronco con forma: cadera, cintura, pecho y hombros, algo plano de delante a atrás.
// Dos complexiones, sin exagerar: la femenina con hombros algo más estrechos, cintura marcada
// y caderas un poco más anchas.
const BUILDS = {
  male: {
    torso: [[0.0, 0.17], [0.12, 0.155], [0.32, 0.165], [0.55, 0.19], [0.78, 0.205], [0.92, 0.19], [1.0, 0.11]],
    depth: 0.72, shoulder: 0.19, hip: 0.1, shorts: 0.38, sleeve: 0.42, height: 1,
  },
  female: {
    torso: [[0.0, 0.178], [0.1, 0.17], [0.3, 0.138], [0.52, 0.16], [0.7, 0.172], [0.88, 0.168], [1.0, 0.1]],
    depth: 0.76, shoulder: 0.168, hip: 0.108, shorts: 0.22, sleeve: 0.28, height: 0.96,
  },
};

// Estatura: el muñeco a tamaño 1 mide esto de los pies a lo alto de la cabeza (sin contar el pelo),
// y la pista está en metros. Así, quien mide 1,70 sale de 1,70 al lado de la red.
export const FIGURE_HEIGHT_M = 1.69;
export const DEFAULT_HEIGHT_CM = { male: 180, female: 170 };

export function figureScale(heightCm, female = false) {
  const valid = Number.isFinite(heightCm) && heightCm >= 120 && heightCm <= 230;
  const cm = valid ? heightCm : DEFAULT_HEIGHT_CM[female ? "female" : "male"];
  return cm / 100 / FIGURE_HEIGHT_M;
}

// Peso y músculo (0-100, 50 es lo normal) pasados a cuánto engorda cada parte.
// El peso ensancha sobre todo tronco (barriga), muslos y brazos; el músculo, brazos, hombros y piernas.
export function bodyShape(look) {
  const level = (value) => (Math.max(0, Math.min(100, Number.isFinite(value) ? value : 50)) - 50) / 50;
  const weight = level(look?.weight);
  const muscle = level(look?.muscle);
  const grow = (byWeight, byMuscle) => 1 + byWeight * weight + byMuscle * muscle;
  return {
    torsoWide: grow(0.16, 0.08),
    torsoDeep: grow(0.3, 0.06),
    shoulders: grow(0.07, 0.1),
    hips: grow(0.14, 0.02),
    upperArm: grow(0.2, 0.3),
    foreArm: grow(0.14, 0.18),
    thigh: grow(0.24, 0.16),
    shin: grow(0.14, 0.12),
    neck: grow(0.18, 0.22),
  };
}

function torsoGeometry(build) {
  const profile = build.torso.map(([height, radius]) => new THREE.Vector2(radius, height));
  const geometry = new THREE.LatheGeometry(profile, 48);
  geometry.translate(0, -0.5, 0);
  geometry.scale(1, 1, build.depth);
  return geometry;
}

// Camisetas especiales de la tienda: color de la tela, ribete, dorsal y el dibujo del pecho.
export const SPECIAL_SHIRTS = {
  bomba: { shirt: "#0b0b0f", trim: "#ff3800", number: "#ff8a00" },
  fuego: { shirt: "#7f1d1d", trim: "#facc15", number: "#fde047" },
  rayo: { shirt: "#0f172a", trim: "#22d3ee", number: "#67e8f9" },
  oro: { shirt: "#141210", trim: "#e8b923", number: "#f5c542" },
  telarana: { shirt: "#0a0a0b", trim: "#f4f4f5", number: "#ffffff" },
  cuervo: { shirt: "#111113", trim: "#ff6b00", number: "#ff8a1f" },
};

// ---------- Estampado de toda la camiseta ----------
// La tela envuelve el tronco y las mangas: x da la vuelta al cuerpo (el pecho queda en el centro) e
// y va de arriba (cuello) a abajo. Cada camiseta especial tiene su estampado y sus ribetes.
const PATTERN_W = 512;
const PATTERN_H = 256;

function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function hems(context, color, accent = null) {
  // Cuello arriba y bajo abajo: una franja de color con un hilo fino.
  context.fillStyle = color;
  context.fillRect(0, 0, PATTERN_W, 12);
  context.fillRect(0, PATTERN_H - 16, PATTERN_W, 16);
  if (accent) {
    context.fillStyle = accent;
    context.fillRect(0, 14, PATTERN_W, 3);
    context.fillRect(0, PATTERN_H - 21, PATTERN_W, 3);
  }
}

function sidePanels(context, color, width = 34) {
  // Paneles laterales (bajo los brazos): x = 0,25 y 0,75 de la vuelta.
  [0.25, 0.75].forEach((at) => {
    context.fillStyle = color;
    context.fillRect(PATTERN_W * at - width / 2, 0, width, PATTERN_H);
  });
}

const SHIRT_PATTERNS = {
  bomba(context) {
    context.fillStyle = "#0b0b0f";
    context.fillRect(0, 0, PATTERN_W, PATTERN_H);
    // Fuego que sube desde abajo por toda la vuelta.
    const glow = context.createLinearGradient(0, PATTERN_H, 0, PATTERN_H * 0.45);
    glow.addColorStop(0, "rgba(255,90,0,0.85)");
    glow.addColorStop(0.5, "rgba(255,56,0,0.35)");
    glow.addColorStop(1, "rgba(255,56,0,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, PATTERN_W, PATTERN_H);
    // Estallidos y chispas repartidos.
    const random = seeded(7);
    for (let index = 0; index < 26; index += 1) {
      const x = random() * PATTERN_W;
      const y = 20 + random() * (PATTERN_H - 60);
      const size = 5 + random() * 11;
      context.fillStyle = random() > 0.5 ? "#ff8a00" : "#ffd23f";
      spikyBurst(context, x, y, size, size * 0.45, 7, random() * 3);
      context.fill();
    }
    for (let index = 0; index < 90; index += 1) {
      context.fillStyle = `rgba(255,${150 + Math.floor(random() * 100)},0,${0.4 + random() * 0.6})`;
      context.beginPath();
      context.arc(random() * PATTERN_W, random() * PATTERN_H, 0.8 + random() * 1.8, 0, Math.PI * 2);
      context.fill();
    }
    // Rayas de peligro a los lados.
    [0.25, 0.75].forEach((at) => {
      context.save();
      context.beginPath();
      context.rect(PATTERN_W * at - 18, 0, 36, PATTERN_H);
      context.clip();
      for (let y = -40; y < PATTERN_H + 40; y += 18) {
        context.fillStyle = "#ff3800";
        context.beginPath();
        context.moveTo(PATTERN_W * at - 20, y);
        context.lineTo(PATTERN_W * at + 20, y - 20);
        context.lineTo(PATTERN_W * at + 20, y - 11);
        context.lineTo(PATTERN_W * at - 20, y + 9);
        context.closePath();
        context.fill();
      }
      context.restore();
    });
    hems(context, "#ff3800", "#ffd23f");
  },
  fuego(context) {
    const base = context.createLinearGradient(0, 0, 0, PATTERN_H);
    base.addColorStop(0, "#3b0a0a");
    base.addColorStop(0.55, "#7f1d1d");
    base.addColorStop(1, "#b91c1c");
    context.fillStyle = base;
    context.fillRect(0, 0, PATTERN_W, PATTERN_H);
    // Tres capas de llamas alrededor de todo el cuerpo.
    const flames = (color, height, count, offset) => {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(0, PATTERN_H);
      for (let index = 0; index <= count; index += 1) {
        const x = (index / count) * PATTERN_W;
        const peak = PATTERN_H - height * (0.55 + (((index * 37 + offset) % 9) / 9) * 0.6);
        context.quadraticCurveTo(x - PATTERN_W / count / 2, peak + height * 0.5, x, peak);
        context.quadraticCurveTo(x + PATTERN_W / count / 3, peak + height * 0.55, x + PATTERN_W / count / 2, PATTERN_H - height * 0.25);
      }
      context.lineTo(PATTERN_W, PATTERN_H);
      context.closePath();
      context.fill();
    };
    flames("#ef4444", 190, 14, 0);
    flames("#f97316", 140, 18, 3);
    flames("#facc15", 80, 22, 5);
    // Brasas que suben.
    const random = seeded(11);
    for (let index = 0; index < 70; index += 1) {
      context.fillStyle = `rgba(253,224,71,${0.3 + random() * 0.7})`;
      context.beginPath();
      context.arc(random() * PATTERN_W, random() * PATTERN_H * 0.7, 1 + random() * 2, 0, Math.PI * 2);
      context.fill();
    }
    hems(context, "#facc15");
  },
  rayo(context) {
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, PATTERN_W, PATTERN_H);
    // Rejilla eléctrica muy suave.
    context.strokeStyle = "rgba(34,211,238,0.12)";
    context.lineWidth = 1;
    for (let x = 0; x < PATTERN_W; x += 16) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, PATTERN_H);
      context.stroke();
    }
    for (let y = 0; y < PATTERN_H; y += 16) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(PATTERN_W, y);
      context.stroke();
    }
    // Rayos repartidos, con brillo.
    const random = seeded(23);
    context.shadowColor = "#22d3ee";
    context.shadowBlur = 8;
    for (let index = 0; index < 16; index += 1) {
      const x = random() * PATTERN_W;
      const y = random() * (PATTERN_H - 70);
      const scale = 0.35 + random() * 0.4;
      context.fillStyle = random() > 0.5 ? "#facc15" : "#67e8f9";
      context.beginPath();
      [[0, 0], [22, 0], [10, 34], [26, 34], [-6, 86], [4, 48], [-12, 48]].forEach(([px, py], point) => {
        const method = point === 0 ? "moveTo" : "lineTo";
        context[method](x + px * scale, y + py * scale);
      });
      context.closePath();
      context.fill();
    }
    context.shadowBlur = 0;
    // Franjas de neón en diagonal a los lados.
    sidePanels(context, "rgba(34,211,238,0.35)", 10);
    hems(context, "#22d3ee", "#facc15");
  },
  oro(context) {
    context.fillStyle = "#141210";
    context.fillRect(0, 0, PATTERN_W, PATTERN_H);
    // Raya diplomática dorada.
    for (let x = 4; x < PATTERN_W; x += 14) {
      context.fillStyle = x % 28 === 4 ? "rgba(232,185,35,0.55)" : "rgba(232,185,35,0.2)";
      context.fillRect(x, 0, 1.5, PATTERN_H);
    }
    // Estrellitas doradas repartidas.
    const random = seeded(31);
    context.fillStyle = "#f5c542";
    for (let index = 0; index < 22; index += 1) {
      spikyBurst(context, random() * PATTERN_W, 24 + random() * (PATTERN_H - 60), 4 + random() * 3, 1.8, 5, -Math.PI / 2);
      context.fill();
    }
    // Paneles laterales dorados con brillo.
    [0.25, 0.75].forEach((at) => {
      const panel = context.createLinearGradient(PATTERN_W * at - 22, 0, PATTERN_W * at + 22, 0);
      panel.addColorStop(0, "#8a6512");
      panel.addColorStop(0.5, "#fff3b0");
      panel.addColorStop(1, "#8a6512");
      context.fillStyle = panel;
      context.fillRect(PATTERN_W * at - 22, 0, 44, PATTERN_H);
    });
    hems(context, "#e8b923", "#fff3b0");
  },
  telarana(context) {
    context.fillStyle = "#0a0a0b";
    context.fillRect(0, 0, PATTERN_W, PATTERN_H);
    // Telarañas por toda la camiseta, desde varios centros.
    const web = (cx, cy, size, alpha) => {
      context.strokeStyle = `rgba(255,255,255,${alpha})`;
      context.lineWidth = 1.4;
      const spokes = 10;
      for (let index = 0; index < spokes; index += 1) {
        const angle = (index / spokes) * Math.PI * 2;
        context.beginPath();
        context.moveTo(cx, cy);
        context.lineTo(cx + Math.cos(angle) * size, cy + Math.sin(angle) * size);
        context.stroke();
      }
      for (let ring = 1; ring <= 5; ring += 1) {
        const radius = (size / 5) * ring;
        context.beginPath();
        for (let index = 0; index <= spokes; index += 1) {
          const angle = (index / spokes) * Math.PI * 2;
          const next = ((index + 1) / spokes) * Math.PI * 2;
          if (index === 0) context.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
          if (index < spokes) {
            const mid = (angle + next) / 2;
            context.quadraticCurveTo(cx + Math.cos(mid) * radius * 0.84, cy + Math.sin(mid) * radius * 0.84, cx + Math.cos(next) * radius, cy + Math.sin(next) * radius);
          }
        }
        context.stroke();
      }
    };
    [[0, 0], [128, 230], [256, 40], [384, 220], [512, 0], [0, 256], [512, 256], [256, 256]].forEach(([x, y]) => web(x, y, 130, 0.55));
    // Arañitas colgando de un hilo.
    const random = seeded(41);
    for (let index = 0; index < 8; index += 1) {
      const x = 30 + random() * (PATTERN_W - 60);
      const y = 40 + random() * 140;
      context.strokeStyle = "rgba(255,255,255,0.7)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, y);
      context.stroke();
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.ellipse(x, y + 4, 3.2, 4.5, 0, 0, Math.PI * 2);
      context.fill();
      [-1, 1].forEach((side) => {
        [-3, 0, 3, 6].forEach((dy) => {
          context.beginPath();
          context.moveTo(x, y + 4);
          context.lineTo(x + side * 7, y + dy);
          context.stroke();
        });
      });
    }
    hems(context, "#f4f4f5");
  },
  cuervo(context) {
    context.fillStyle = "#111113";
    context.fillRect(0, 0, PATTERN_W, PATTERN_H);
    // Plumas cayendo por toda la camiseta.
    const random = seeded(53);
    for (let index = 0; index < 34; index += 1) {
      const x = random() * PATTERN_W;
      const y = random() * PATTERN_H;
      const length = 18 + random() * 22;
      const angle = -0.9 + random() * 1.8;
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      const feather = context.createLinearGradient(0, -length / 2, 0, length / 2);
      feather.addColorStop(0, "#2a2a30");
      feather.addColorStop(1, random() > 0.4 ? "#ff6b00" : "#3f3f46");
      context.fillStyle = feather;
      context.beginPath();
      context.moveTo(0, -length / 2);
      context.quadraticCurveTo(length * 0.28, 0, 0, length / 2);
      context.quadraticCurveTo(-length * 0.28, 0, 0, -length / 2);
      context.fill();
      context.strokeStyle = "rgba(255,107,0,0.8)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, -length / 2);
      context.lineTo(0, length / 2 + 4);
      context.stroke();
      context.restore();
    }
    // Rayas laterales naranjas como una equipación de anime.
    [0.25, 0.75].forEach((at) => {
      context.fillStyle = "#ff6b00";
      context.fillRect(PATTERN_W * at - 14, 0, 9, PATTERN_H);
      context.fillStyle = "#ffffff";
      context.fillRect(PATTERN_W * at - 3, 0, 4, PATTERN_H);
      context.fillStyle = "#ff6b00";
      context.fillRect(PATTERN_W * at + 5, 0, 9, PATTERN_H);
    });
    hems(context, "#ff6b00", "#ffffff");
  },
};

function shirtPatternTexture(special) {
  const texture = canvasTexture(PATTERN_W, PATTERN_H, (context) => SHIRT_PATTERNS[special](context));
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function spikyBurst(context, x, y, outer, inner, points, rotation = 0) {
  context.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer * (0.82 + ((index * 37) % 7) / 30) : inner;
    const angle = rotation + (index * Math.PI) / points;
    context.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  context.closePath();
}

function tntWord(context, x, y, size, fill, stroke) {
  context.font = `italic 900 ${size}px Arial Black, Arial, Helvetica, sans-serif`;
  context.lineJoin = "round";
  context.lineWidth = size * 0.16;
  context.strokeStyle = stroke;
  context.strokeText("Club", x, y);
  context.fillStyle = fill;
  context.fillText("Club", x, y);
}

const SHIRT_ART = {
  // Bomba explotando: estallido naranja y amarillo, la bomba con su mecha encendida y Club encima.
  bomba(context, width) {
    const cx = width / 2;
    const glow = context.createRadialGradient(cx, 112, 10, cx, 112, 120);
    glow.addColorStop(0, "rgba(255,240,150,0.95)");
    glow.addColorStop(0.35, "rgba(255,140,0,0.9)");
    glow.addColorStop(0.7, "rgba(255,56,0,0.75)");
    glow.addColorStop(1, "rgba(255,56,0,0)");
    context.fillStyle = glow;
    spikyBurst(context, cx, 112, 118, 62, 13, 0.2);
    context.fill();
    context.fillStyle = "rgba(255,250,210,0.9)";
    spikyBurst(context, cx, 112, 62, 34, 9, 0.5);
    context.fill();
    // Trozos que salen volando.
    context.fillStyle = "#ffb000";
    [[30, 40, 7], [222, 48, 6], [24, 170, 5], [232, 160, 7], [60, 22, 4], [196, 20, 5]].forEach(([x, y, r]) => {
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
    });
    // La bomba.
    const bomb = context.createRadialGradient(cx - 14, 108, 4, cx, 122, 42);
    bomb.addColorStop(0, "#52525b");
    bomb.addColorStop(1, "#09090b");
    context.fillStyle = bomb;
    context.beginPath();
    context.arc(cx, 124, 38, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#27272a";
    context.fillRect(cx + 14, 80, 18, 14);
    context.strokeStyle = "#a16207";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(cx + 23, 80);
    context.quadraticCurveTo(cx + 30, 58, cx + 50, 56);
    context.stroke();
    context.fillStyle = "#fff7ae";
    spikyBurst(context, cx + 52, 55, 13, 5, 6);
    context.fill();
    tntWord(context, cx, 128, 50, "#ffffff", "#ff3800");
  },
  // Llamas subiendo desde abajo y Club ardiendo.
  fuego(context, width) {
    const flames = (color, scale, offset) => {
      context.fillStyle = color;
      context.beginPath();
      const base = 214;
      context.moveTo(20, base);
      for (let index = 0; index <= 7; index += 1) {
        const x = 20 + (index / 7) * (width - 40);
        const peak = base - (34 + ((index * 53 + offset) % 40)) * scale;
        context.quadraticCurveTo(x - 9, peak + 30, x, peak);
        context.quadraticCurveTo(x + 9, peak + 36, x + (width - 40) / 14, base - 18 * scale);
      }
      context.lineTo(width - 20, base);
      context.closePath();
      context.fill();
    };
    flames("#ef4444", 2.1, 0);
    flames("#f97316", 1.6, 17);
    flames("#facc15", 1.05, 31);
    context.shadowColor = "#ff7a00";
    context.shadowBlur = 18;
    tntWord(context, width / 2, 92, 66, "#fff7ed", "#b91c1c");
    context.shadowBlur = 0;
  },
  // Rayos eléctricos alrededor de Club.
  rayo(context, width) {
    const bolt = (x, y, scale, color) => {
      context.fillStyle = color;
      context.beginPath();
      [[0, 0], [22, 0], [10, 34], [26, 34], [-6, 86], [4, 48], [-12, 48]].forEach(([px, py], index) => {
        const method = index === 0 ? "moveTo" : "lineTo";
        context[method](x + px * scale, y + py * scale);
      });
      context.closePath();
      context.fill();
    };
    context.shadowColor = "#22d3ee";
    context.shadowBlur = 16;
    bolt(28, 30, 1.2, "#facc15");
    bolt(198, 40, 1.05, "#67e8f9");
    bolt(120, 150, 0.8, "#facc15");
    tntWord(context, width / 2, 106, 68, "#e0f2fe", "#0891b2");
    context.shadowBlur = 0;
  },
  // Telaraña en blanco y negro: hilos desde el centro, anillos y una araña con Club debajo.
  telarana(context, width) {
    const cx = width / 2;
    const cy = 96;
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 2.2;
    const spokes = 12;
    for (let index = 0; index < spokes; index += 1) {
      const angle = (index / spokes) * Math.PI * 2;
      context.beginPath();
      context.moveTo(cx, cy);
      context.lineTo(cx + Math.cos(angle) * 150, cy + Math.sin(angle) * 150);
      context.stroke();
    }
    // Anillos que cuelgan un poco entre hilo e hilo, como una telaraña de verdad.
    [22, 44, 68, 94, 122].forEach((radius) => {
      context.lineWidth = radius > 90 ? 1.6 : 2;
      context.beginPath();
      for (let index = 0; index <= spokes; index += 1) {
        const angle = (index / spokes) * Math.PI * 2;
        const next = ((index + 1) / spokes) * Math.PI * 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (index === 0) context.moveTo(x, y);
        const mid = (angle + next) / 2;
        const sag = radius * 0.82;
        if (index < spokes) context.quadraticCurveTo(cx + Math.cos(mid) * sag, cy + Math.sin(mid) * sag, cx + Math.cos(next) * radius, cy + Math.sin(next) * radius);
      }
      context.stroke();
    });
    // La araña en el centro.
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    [-1, 1].forEach((side) => {
      [[-14, -18], [-18, -4], [-18, 8], [-12, 20]].forEach(([dx, dy]) => {
        context.beginPath();
        context.moveTo(cx, cy + dy * 0.2);
        context.quadraticCurveTo(cx + side * 10, cy + dy * 0.8 - 6, cx + side * -dx, cy + dy);
        context.stroke();
      });
    });
    context.beginPath();
    context.ellipse(cx, cy - 7, 6, 7, 0, 0, Math.PI * 2);
    context.ellipse(cx, cy + 8, 8, 11, 0, 0, Math.PI * 2);
    context.fill();
    tntWord(context, cx, 190, 50, "#ffffff", "#0a0a0b");
  },
  // Cuervo en negro y naranja: alas abiertas, líneas de velocidad y Club con contorno naranja.
  cuervo(context, width) {
    const cx = width / 2;
    // Líneas de velocidad, como en una viñeta.
    context.strokeStyle = "rgba(255,107,0,0.55)";
    for (let index = 0; index < 22; index += 1) {
      const angle = (index / 22) * Math.PI * 2;
      context.lineWidth = index % 2 ? 2 : 4;
      context.beginPath();
      context.moveTo(cx + Math.cos(angle) * 70, 100 + Math.sin(angle) * 70);
      context.lineTo(cx + Math.cos(angle) * 140, 100 + Math.sin(angle) * 140);
      context.stroke();
    }
    // Alas: plumas en abanico a cada lado.
    [-1, 1].forEach((side) => {
      for (let feather = 0; feather < 6; feather += 1) {
        const angle = -0.15 - feather * 0.2;
        const length = 92 - feather * 7;
        const baseX = cx + side * 16;
        const tipX = baseX + side * Math.cos(angle) * length;
        const tipY = 92 + Math.sin(angle) * length * 0.75;
        const gradient = context.createLinearGradient(baseX, 92, tipX, tipY);
        gradient.addColorStop(0, "#1f1f23");
        gradient.addColorStop(0.6, "#2a2a30");
        gradient.addColorStop(1, "#ff6b00");
        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(baseX, 86);
        context.quadraticCurveTo(baseX + side * length * 0.5, tipY - 14, tipX, tipY);
        context.quadraticCurveTo(baseX + side * length * 0.45, tipY + 14, baseX, 106);
        context.closePath();
        context.fill();
        context.strokeStyle = "#ff6b00";
        context.lineWidth = 1.2;
        context.stroke();
      }
    });
    // Cuerpo y cabeza del cuervo con su pico.
    context.fillStyle = "#18181b";
    context.strokeStyle = "#ff6b00";
    context.lineWidth = 2.5;
    context.beginPath();
    context.ellipse(cx, 104, 15, 26, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(cx, 70, 12, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#ff6b00";
    context.beginPath();
    context.moveTo(cx - 4, 70);
    context.lineTo(cx + 4, 70);
    context.lineTo(cx, 84);
    context.closePath();
    context.fill();
    context.fillStyle = "#ffffff";
    [-5, 5].forEach((dx) => {
      context.beginPath();
      context.arc(cx + dx, 67, 2.2, 0, Math.PI * 2);
      context.fill();
    });
    tntWord(context, cx, 176, 56, "#ffffff", "#ff6b00");
  },
  // Edición de oro: escudo dorado con estrellas.
  oro(context, width) {
    const cx = width / 2;
    const gold = context.createLinearGradient(cx - 70, 30, cx + 70, 190);
    gold.addColorStop(0, "#fff3b0");
    gold.addColorStop(0.45, "#e8b923");
    gold.addColorStop(1, "#8a6512");
    context.fillStyle = gold;
    context.beginPath();
    context.moveTo(cx, 26);
    context.lineTo(cx + 72, 48);
    context.quadraticCurveTo(cx + 74, 150, cx, 196);
    context.quadraticCurveTo(cx - 74, 150, cx - 72, 48);
    context.closePath();
    context.fill();
    context.strokeStyle = "#fff3b0";
    context.lineWidth = 4;
    context.stroke();
    tntWord(context, cx, 112, 50, "#141210", "#fff3b0");
    context.fillStyle = "#fff3b0";
    [-36, 0, 36].forEach((dx) => {
      spikyBurst(context, cx + dx, 62, 9, 4, 5, -Math.PI / 2);
      context.fill();
    });
  },
};

function shirtTexture({ jersey, number, name, back, crest, special = null }) {
  return canvasTexture(256, 256, (context, width) => {
    context.clearRect(0, 0, width, 256);
    context.textAlign = "center";
    context.textBaseline = "middle";
    if (back) {
      if (name) {
        context.fillStyle = jersey.number;
        context.font = "800 34px Arial, Helvetica, sans-serif";
        context.fillText(name.toUpperCase().slice(0, 10), width / 2, 46, width - 20);
      }
      context.font = "900 150px Arial, Helvetica, sans-serif";
      context.lineWidth = 6;
      context.strokeStyle = jersey.trim;
      context.strokeText(String(number ?? ""), width / 2, 150);
      context.fillStyle = jersey.number;
      context.fillText(String(number ?? ""), width / 2, 150);
    } else if (special && SHIRT_ART[special]) {
      // Camiseta especial: el dibujo ocupa el pecho y el dorsal va pequeño debajo.
      SHIRT_ART[special](context, width);
      // El dibujo se funde con la tela hacia los bordes: así no se ve un cuadro pegado encima.
      context.globalCompositeOperation = "destination-in";
      const fade = context.createRadialGradient(width / 2, 118, 70, width / 2, 118, 126);
      fade.addColorStop(0, "rgba(0,0,0,1)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = fade;
      context.fillRect(0, 0, width, 256);
      context.globalCompositeOperation = "source-over";
      context.font = "900 34px Arial, Helvetica, sans-serif";
      context.lineWidth = 5;
      context.strokeStyle = "#000000";
      context.strokeText(String(number ?? ""), width / 2, 222);
      context.fillStyle = jersey.number;
      context.fillText(String(number ?? ""), width / 2, 222);
    } else {
      context.font = "900 92px Arial, Helvetica, sans-serif";
      context.fillStyle = jersey.number;
      context.fillText(String(number ?? ""), width / 2, 150);
      if (crest) {
        // Escudo del club en el pecho.
        context.fillStyle = "#FF3800";
        context.beginPath();
        context.arc(width * 0.27, 62, 26, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#FFFFFF";
        context.font = "900 20px Arial, Helvetica, sans-serif";
        context.fillText("Club", width * 0.27, 63);
      }
    }
  });
}

function shortsTexture(jersey) {
  return canvasTexture(128, 32, (context, width, height) => {
    context.fillStyle = "#27272A";
    context.fillRect(0, 0, width, height);
    // Franja lateral a los dos lados.
    context.fillStyle = jersey.stripe;
    context.fillRect(width * 0.24, 0, 6, height);
    context.fillRect(width * 0.74, 0, 6, height);
  });
}

// ---------- Caras y peinados ----------
// La cara se dibuja en la textura de la cabeza. En una esfera, la parte de delante queda en el 75 % del ancho.
// Iris y pupilas en una capa propia, recortada por el blanco del ojo, para que los ojos puedan
// moverse sin mover la cabeza. Devuelve null con los ojos sonrientes (no hay iris que mover).
// Ojos más grandes que los de una persona: dan expresión al personaje.
const EYE_GROW = 1.55;
// Separación de cada ojo al centro de la cara, en la textura (antes 28: con ojos más grandes, algo más).
const EYE_GAP = 31;
function eyeSize(look) {
  return look.eyes === "almond" ? { width: 11 * EYE_GROW, height: 6.5 * EYE_GROW } : { width: 9.5 * EYE_GROW, height: 9 * EYE_GROW };
}

function eyeLayer(look) {
  if (look.eyes === "smiley") return null;
  const { width, height } = eyeSize(look);
  const eyes = (draw) => canvasTexture(512, 256, (context, w) => {
    [-1, 1].forEach((side) => draw(context, w * 0.75 + side * EYE_GAP, 122));
  });
  const iris = eyes((context, x, y) => {
    const radius = 6 * EYE_GROW;
    const gradient = context.createRadialGradient(x, y + 2, 1, x, y, radius);
    gradient.addColorStop(0, "#9a6a3e");
    gradient.addColorStop(1, "#3b2416");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y + 0.5, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#0b0b0d";
    context.beginPath();
    context.arc(x, y + 0.5, radius * 0.5, 0, Math.PI * 2);
    context.fill();
    // Dos brillos: uno grande arriba y uno pequeño abajo. Es lo que da vida a la mirada.
    context.fillStyle = "#FFFFFF";
    context.beginPath();
    context.arc(x - radius * 0.38, y - radius * 0.38, radius * 0.32, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x + radius * 0.35, y + radius * 0.4, radius * 0.14, 0, Math.PI * 2);
    context.fill();
  });
  // Máscara: solo se ve el iris dentro del blanco del ojo (un pelín más pequeño que el contorno).
  const mask = canvasTexture(512, 256, (context, w, h) => {
    context.fillStyle = "#000";
    context.fillRect(0, 0, w, h);
    context.fillStyle = "#fff";
    [-1, 1].forEach((side) => {
      context.beginPath();
      context.ellipse(w * 0.75 + side * EYE_GAP, 122, width - 1.2, height - 1.2, 0, 0, Math.PI * 2);
      context.fill();
    });
  });
  mask.colorSpace = THREE.NoColorSpace;
  return { iris, mask };
}

// Párpados cerrados: piel sobre los ojos y la línea de las pestañas. Se ve un instante al parpadear.
function eyelidTexture(look, skin) {
  const { width, height } = eyeSize(look);
  return canvasTexture(512, 256, (context, w) => {
    [-1, 1].forEach((side) => {
      const x = w * 0.75 + side * EYE_GAP;
      context.fillStyle = skin;
      context.beginPath();
      context.ellipse(x, 122, width + 2, height + 2, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#27272a";
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(x, 120, width, height * 0.45, 0, Math.PI * 0.1, Math.PI * 0.9);
      context.stroke();
    });
  });
}

function faceTexture(look, female, hairColor, skin) {
  const browWeight = female ? 3 : 5;
  return canvasTexture(512, 256, (context, width) => {
    context.fillStyle = skin;
    context.fillRect(0, 0, width, 256);
    const cx = width * 0.75;
    const eyeY = 122;
    const ink = "#27272a";
    // Barba y bigote, debajo de todo lo demás. La boca va hacia la línea 170 y la nariz tapa hasta la 160.
    const beard = look.beard === "beard" ? "short" : look.beard;
    const fullBeard = beard === "stubble" || beard === "short";
    const withMoustache = beard === "short" || beard === "full" || beard === "moustache" || beard === "moustache_goatee";
    const withGoatee = beard === "goatee" || beard === "moustache_goatee";
    context.fillStyle = hairColor;
    // La barba ocupa solo la parte de abajo de la cara: de oreja a oreja por la mandíbula, con el borde
    // de arriba por debajo de los pómulos (las mejillas de arriba quedan limpias). En la textura, de frente
    // está en cx y las orejas quedan a unos 125 px a cada lado; los ojos van en la línea 122.
    const jawBeard = (reach, top, cheek, bottom) => {
      context.beginPath();
      context.moveTo(cx - reach, top);
      // Borde de arriba: de la patilla baja por la mejilla hasta la comisura y sube hasta el otro lado.
      context.quadraticCurveTo(cx - reach * 0.45, cheek - 4, cx - 30, cheek + 6);
      context.quadraticCurveTo(cx, cheek + 2, cx + 30, cheek + 6);
      context.quadraticCurveTo(cx + reach * 0.45, cheek - 4, cx + reach, top);
      // Por detrás baja por la mandíbula hasta debajo de la barbilla.
      context.quadraticCurveTo(cx + reach * 1.02, bottom - 30, cx + reach * 0.55, bottom - 10);
      context.quadraticCurveTo(cx, bottom + 10, cx - reach * 0.55, bottom - 10);
      context.quadraticCurveTo(cx - reach * 1.02, bottom - 30, cx - reach, top);
      context.closePath();
      context.fill();
    };
    if (fullBeard) {
      context.globalAlpha = beard === "stubble" ? 0.3 : 0.95;
      jawBeard(108, 138, 158, 214);
      context.globalAlpha = 1;
    }
    if (beard === "full") {
      // Barba poblada: más ancha (hasta las orejas), un poco más alta en las mejillas y más larga.
      // Va pintada en la cara, sin piezas que sobresalgan.
      jawBeard(124, 132, 152, 226);
      // Un poco más oscura por el borde de abajo, para que tenga algo de volumen sin salirse.
      context.globalAlpha = 0.25;
      context.fillStyle = "#000";
      context.beginPath();
      context.ellipse(cx, 214, 34, 12, 0, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = hairColor;
    }
    if (withGoatee) {
      // Perilla: del labio de abajo a la punta de la barbilla.
      context.beginPath();
      context.moveTo(cx - 13, 180);
      context.quadraticCurveTo(cx - 15, 206, cx, 214);
      context.quadraticCurveTo(cx + 15, 206, cx + 13, 180);
      context.quadraticCurveTo(cx, 186, cx - 13, 180);
      context.fill();
    }
    if (withMoustache) {
      // Bigote encima de la boca, un poco caído por los lados.
      context.beginPath();
      context.moveTo(cx, 162);
      context.quadraticCurveTo(cx - 12, 158, cx - 21, 165);
      context.quadraticCurveTo(cx - 23, 171, cx - 17, 170);
      context.quadraticCurveTo(cx - 8, 166, cx, 168);
      context.quadraticCurveTo(cx + 8, 166, cx + 17, 170);
      context.quadraticCurveTo(cx + 23, 171, cx + 21, 165);
      context.quadraticCurveTo(cx + 12, 158, cx, 162);
      context.fill();
    }
    if (beard === "short" || beard === "full") {
      // Un hueco de piel para los labios, para que se vea la boca dentro de la barba.
      context.fillStyle = skin;
      context.beginPath();
      context.ellipse(cx, 175, 13, 6, 0, 0, Math.PI * 2);
      context.fill();
    }
    // Cejas del color del pelo.
    context.strokeStyle = hairColor;
    context.lineCap = "round";
    context.lineWidth = browWeight;
    [-1, 1].forEach((side) => {
      context.beginPath();
      context.moveTo(cx + side * 48, eyeY - 24);
      context.quadraticCurveTo(cx + side * EYE_GAP, eyeY - 33, cx + side * 16, eyeY - 25);
      context.stroke();
    });
    // Ojos con blanco, iris de color, pupila y brillo; el párpado de arriba un poco más marcado.
    [-1, 1].forEach((side) => {
      const x = cx + side * EYE_GAP;
      if (look.eyes === "smiley") {
        context.lineWidth = 4.5;
        context.strokeStyle = ink;
        context.beginPath();
        context.arc(x, eyeY + 5, 9, Math.PI * 1.12, Math.PI * 1.88);
        context.stroke();
        return;
      }
      const { width, height } = eyeSize(look);
      context.save();
      context.beginPath();
      context.ellipse(x, eyeY, width, height, 0, 0, Math.PI * 2);
      context.fillStyle = "#FBFAF7";
      context.fill();
      context.clip();
      // Sombra suave del párpado.
      context.fillStyle = "rgba(60,40,30,0.18)";
      context.fillRect(x - width, eyeY - height, width * 2, 2.5);
      context.restore();
      context.strokeStyle = ink;
      context.lineWidth = female ? 3 : 2.4;
      context.beginPath();
      context.ellipse(x, eyeY, width, height, 0, Math.PI * 1.05, Math.PI * 1.95);
      context.stroke();
      if (look.eyeliner) {
        // Raya gruesa en el párpado de arriba con la "colita" hacia fuera.
        context.strokeStyle = "#0b0b0d";
        context.fillStyle = "#0b0b0d";
        context.lineWidth = 3.6;
        context.beginPath();
        context.ellipse(x, eyeY, width + 0.6, height + 0.6, 0, Math.PI * 1.08, Math.PI * 1.92);
        context.stroke();
        const outer = x + side * (width + 0.4);
        context.beginPath();
        context.moveTo(outer, eyeY - 1.5);
        context.lineTo(outer + side * 8, eyeY - height * 0.95);
        context.lineTo(outer - side * 1.5, eyeY - height * 0.55);
        context.closePath();
        context.fill();
      }
      if (female) {
        // Pestañas.
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + side * (width - 1), eyeY - height * 0.55);
        context.lineTo(x + side * (width + 4), eyeY - height - 1);
        context.stroke();
      }
    });
    // Mejillas: siempre un poco de color, que da vida; más si eligió coloretes. Y pecas.
    {
      context.fillStyle = look.blush ? "rgba(244,114,128,0.32)" : "rgba(244,114,128,0.13)";
      [-1, 1].forEach((side) => {
        context.beginPath();
        context.ellipse(cx + side * 40, 146, 11, 6, 0, 0, Math.PI * 2);
        context.fill();
      });
    }
    if (look.freckles) {
      context.fillStyle = "rgba(140,90,60,0.55)";
      [[-36, 138], [-30, 144], [-42, 145], [36, 138], [30, 144], [42, 145]].forEach(([dx, y]) => {
        context.beginPath();
        context.arc(cx + dx, y, 1.6, 0, Math.PI * 2);
        context.fill();
      });
    }
    // Boca: algo por debajo de la nariz, para que la nariz no la tape.
    context.strokeStyle = "#9f3a3a";
    context.fillStyle = "#9f3a3a";
    context.lineWidth = 3.5;
    context.beginPath();
    if (look.mouth === "smile") {
      context.arc(cx, 164, 12, Math.PI * 0.2, Math.PI * 0.8);
      context.stroke();
    } else if (look.mouth === "grin" || look.mouth === "open") {
      context.moveTo(cx - 16, 168);
      context.quadraticCurveTo(cx, 192, cx + 16, 168);
      context.closePath();
      context.fill();
      context.fillStyle = "#FFFFFF";
      context.fillRect(cx - 11, 168, 22, 4);
    } else if (look.mouth === "soft") {
      context.arc(cx, 168, 7, Math.PI * 0.25, Math.PI * 0.75);
      context.stroke();
    } else {
      context.moveTo(cx - 9, 174);
      context.lineTo(cx + 9, 173);
      context.stroke();
    }
  });
}

// Piezas de pelo pegadas a la cabeza (radio 0,112, delante es z negativa).
// Pelo de dos colores: cada punto del pelo toma un color según su lado (mitad y mitad) o su altura
// (arriba y abajo). Con colores por vértice vale para cualquier peinado.
function paintTwoTone(holder, material, hairColor, hairColor2, split) {
  const first = new THREE.Color(hairColor);
  const second = new THREE.Color(hairColor2);
  material.vertexColors = true;
  material.color.set(0xffffff);
  material.needsUpdate = true;
  const point = new THREE.Vector3();
  holder.children.forEach((mesh) => {
    if (mesh.material !== material) return;
    mesh.updateMatrix();
    const position = mesh.geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(mesh.matrix);
      // Mitad y mitad: izquierda y derecha vistas de frente. Arriba y abajo: la raya va a media cabeza.
      const useSecond = split === "horizontal" ? point.y < 0.035 : point.x > 0;
      (useSecond ? second : first).toArray(colors, index * 3);
    }
    mesh.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  });
}

// Corona de premio del ranking: oro, plata o bronce para el podio de la semana; la del mejor del mes
// es más grande, de oro y con piedras rojas. Va encima del pelo, un poco echada hacia atrás.
const CROWN_METALS = { gold: 0xf5c542, silver: 0xd7dce2, bronze: 0xc47a3a, month: 0xffcf3f };
const CROWN_LIFT = { rizos: 0.022, tupe: 0.02, moño: 0.012, corto: 0.008, raya: 0.008, media: 0.006, melena: 0.006 };

// Gafas de la tienda. Se dibujan a tamaño real (la cabeza está estirada y las deformaría) y por delante
// de la cara, que mira hacia -z. Montura con grosor, cristales y patillas que rodean la cabeza.
const HEAD_SCALE = [1.16, 1.34, 1.2];

function roundedRect(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function lensShape(type, grow = 0) {
  if (type === "redondas") {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 0.024 + grow, 0, Math.PI * 2, false);
    return shape;
  }
  if (type === "deporte") return roundedRect(0.138 + grow * 2, 0.04 + grow * 2, 0.018 + grow);
  return roundedRect(0.052 + grow * 2, 0.036 + grow * 2, 0.013 + grow);
}

export function addGlasses(head, type) {
  if (!type || type === "none") return null;
  const glasses = new THREE.Group();
  glasses.position.set(0, 0.017, -0.113);
  glasses.scale.set(1 / HEAD_SCALE[0], 1 / HEAD_SCALE[1], 1 / HEAD_SCALE[2]);
  const frame = new THREE.MeshStandardMaterial({
    color: type === "redondas" ? 0xc9a227 : 0x111114,
    metalness: type === "redondas" ? 0.85 : 0.35,
    roughness: type === "redondas" ? 0.25 : 0.4,
    side: THREE.DoubleSide,
  });
  const lens =
    type === "deporte"
      ? new THREE.MeshPhysicalMaterial({ color: 0xff5a1f, metalness: 0.9, roughness: 0.06, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, side: THREE.DoubleSide })
      : type === "sol"
        ? new THREE.MeshPhysicalMaterial({ color: 0x0c0c10, metalness: 0.55, roughness: 0.08, clearcoat: 1, side: THREE.DoubleSide })
        : new THREE.MeshPhysicalMaterial({ color: 0xdbeafe, roughness: 0.05, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const thickness = type === "redondas" ? 0.0045 : 0.0055;
  const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.0012, bevelThickness: 0.0012, bevelSegments: 2, curveSegments: 24 });

  // Lo que hay que rodear: la cabeza mide unos 0.12 de ancho a cada lado y la oreja queda en z ≈ 0.
  const TEMPLE_X = 0.127;
  const EAR_Z = 0.13;
  // Patilla: de la esquina de la montura sale hacia fuera y luego va recta por el costado hasta la oreja.
  const addArms = (cornerX, cornerZ) => {
    [-1, 1].forEach((side) => {
      const hingeEnd = 0.03;
      const dx = TEMPLE_X - cornerX;
      const dz = hingeEnd - cornerZ;
      const hingeLength = Math.hypot(dx, dz);
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.007, hingeLength), frame);
      hinge.position.set(side * (cornerX + dx / 2), 0.004, cornerZ + dz / 2);
      hinge.rotation.y = side * Math.atan2(dx, dz);
      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.006, EAR_Z - hingeEnd), frame);
      temple.position.set(side * TEMPLE_X, 0.004, (EAR_Z + hingeEnd) / 2);
      glasses.add(hinge, temple);
    });
  };

  if (type === "deporte") {
    // Pantalla deportiva: más alta en el centro, afinada a los lados y con hueco para la nariz.
    // Se dibuja plana y luego se curva sobre un cilindro para que envuelva la cara.
    const radius = 0.14;
    const shield = new THREE.Shape();
    shield.moveTo(-0.077, 0.012);
    shield.quadraticCurveTo(-0.04, 0.026, 0, 0.024);
    shield.quadraticCurveTo(0.04, 0.026, 0.077, 0.012);
    shield.quadraticCurveTo(0.08, -0.004, 0.066, -0.014);
    shield.quadraticCurveTo(0.04, -0.028, 0.016, -0.018);
    shield.quadraticCurveTo(0.006, -0.004, 0, -0.004);
    shield.quadraticCurveTo(-0.006, -0.004, -0.016, -0.018);
    shield.quadraticCurveTo(-0.04, -0.028, -0.066, -0.014);
    shield.quadraticCurveTo(-0.08, -0.004, -0.077, 0.012);
    const bend = (geometry) => {
      const position = geometry.attributes.position;
      for (let index = 0; index < position.count; index += 1) {
        const x = position.getX(index);
        const angle = x / radius;
        position.setX(index, radius * Math.sin(angle));
        position.setZ(index, position.getZ(index) + radius - radius * Math.cos(angle));
      }
      geometry.computeVertexNormals();
      return geometry;
    };
    const visor = new THREE.Mesh(bend(new THREE.ShapeGeometry(shield, 24)), lens);
    // Barra de arriba siguiendo el borde superior.
    const topPoints = [];
    for (let step = 0; step <= 16; step += 1) {
      const x = -0.077 + (0.154 * step) / 16;
      const y = 0.012 + 0.013 * (1 - (x / 0.077) ** 2);
      const angle = x / radius;
      topPoints.push(new THREE.Vector3(radius * Math.sin(angle), y + 0.002, radius - radius * Math.cos(angle) - 0.001));
    }
    const brow = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(topPoints), 32, 0.0035, 8, false), frame);
    glasses.add(visor, brow);
    const cornerAngle = 0.077 / radius;
    addArms(radius * Math.sin(cornerAngle), radius - radius * Math.cos(cornerAngle));
  } else {
    // Montura: el contorno con el hueco del cristal.
    [-0.04, 0.04].forEach((x) => {
      const outer = lensShape(type, thickness);
      outer.holes.push(lensShape(type));
      const rim = new THREE.Mesh(extrude(outer, 0.006), frame);
      rim.position.set(x, 0, -0.003);
      const glass = new THREE.Mesh(extrude(lensShape(type), 0.0015), lens);
      glass.position.set(x, 0, 0);
      glasses.add(rim, glass);
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.005), frame);
    bridge.position.set(0, 0.006, 0);
    glasses.add(bridge);
    addArms(type === "redondas" ? 0.068 : 0.071, 0.002);
  }
  head.add(glasses);
  return glasses;
}

export function addCrown(head, crown, hairStyle) {
  const color = CROWN_METALS[crown];
  if (!color) return null;
  const big = crown === "month";
  const metal = new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.28, emissive: color, emissiveIntensity: 0.12 });
  const crownGroup = new THREE.Group();
  crownGroup.position.set(0, 0.088 + (CROWN_LIFT[hairStyle] ?? 0), -0.012);
  crownGroup.rotation.x = -0.28;
  crownGroup.scale.setScalar(1.25);
  const radius = big ? 0.074 : 0.064;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.94, big ? 0.03 : 0.024, 28, 1, true), metal);
  band.material.side = THREE.DoubleSide;
  crownGroup.add(band);
  const points = big ? 8 : 6;
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(big ? 0.014 : 0.012, big ? 0.04 : 0.03, 8), metal);
    spike.position.set(Math.sin(angle) * radius, (big ? 0.03 : 0.024) / 2 + (big ? 0.02 : 0.015), Math.cos(angle) * radius);
    crownGroup.add(spike);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.007 : 0.006, 10, 8), metal);
    tip.position.set(spike.position.x, spike.position.y + (big ? 0.021 : 0.016), spike.position.z);
    crownGroup.add(tip);
  }
  if (big) {
    // Piedras rojas alrededor de la banda.
    const gem = new THREE.MeshStandardMaterial({ color: 0xd3122f, metalness: 0.3, roughness: 0.15, emissive: 0x6b0010, emissiveIntensity: 0.4 });
    for (let index = 0; index < points; index += 1) {
      const angle = ((index + 0.5) / points) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 10), gem);
      stone.position.set(Math.sin(angle) * (radius + 0.002), 0, Math.cos(angle) * (radius + 0.002));
      crownGroup.add(stone);
    }
  }
  crownGroup.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  head.add(crownGroup);
  return crownGroup;
}

function addHair(head, style, accent, hairColor, hairColor2 = null, split = "vertical") {
  if (style === "calvo") return;
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(hairColor), roughness: 0.9 });
  // La cabeza es algo más pequeña que el pelo dibujado: todo el pelo se ajusta a su tamaño.
  const holder = new THREE.Group();
  holder.scale.setScalar(0.93);
  head.add(holder);
  const piece = (geometry, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], pieceMaterial = material) => {
    const mesh = new THREE.Mesh(geometry, pieceMaterial);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    holder.add(mesh);
    return mesh;
  };
  // Por delante el pelo se queda en la frente, por encima de las cejas.
  const cap = (radius, cover, tilt) => piece(new THREE.SphereGeometry(radius, 22, 14, 0, Math.PI * 2, 0, Math.PI * Math.min(cover, 0.46)), [0, 0, 0], [tilt + 0.05, 0, 0]);
  // Casquete que baja por los lados y por detrás pero deja la cara libre.
  const sides = (radius, cover) =>
    piece(new THREE.SphereGeometry(radius, 22, 14, Math.PI * 1.5 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * cover));
  const tie = () => new THREE.MeshStandardMaterial({ color: accent });

  switch (style) {
    case "rapado":
      cap(0.115, 0.5, 0.28);
      break;
    case "tupe":
      cap(0.118, 0.55, 0.35);
      piece(new THREE.SphereGeometry(0.07, 14, 10), [0, 0.085, -0.06], [0.4, 0, 0], [1.2, 0.55, 1]);
      break;
    case "rizos":
      cap(0.118, 0.55, 0.35);
      for (let index = 0; index < 9; index += 1) {
        const angle = (index / 9) * Math.PI * 2;
        piece(new THREE.SphereGeometry(0.036, 10, 8), [Math.cos(angle) * 0.07, 0.095 + Math.sin(index * 1.7) * 0.01, Math.sin(angle) * 0.07 + 0.01]);
      }
      break;
    case "raya":
      cap(0.119, 0.56, 0.35);
      piece(new THREE.BoxGeometry(0.15, 0.03, 0.08), [-0.02, 0.1, -0.05], [0.25, 0, -0.2]);
      break;
    case "moño":
      sides(0.12, 0.62);
      cap(0.12, 0.55, 0.3);
      piece(new THREE.SphereGeometry(0.058, 14, 10), [0, 0.1, 0.075]);
      piece(new THREE.TorusGeometry(0.035, 0.008, 6, 14), [0, 0.07, 0.07], [0.9, 0, 0], [1, 1, 1], tie());
      break;
    case "melena":
      sides(0.123, 0.66);
      cap(0.122, 0.55, 0.3);
      // Pelo suelto que cae por detrás hasta los hombros.
      piece(new THREE.CylinderGeometry(0.112, 0.13, 0.24, 18, 1, true, -Math.PI / 2, Math.PI), [0, -0.12, 0.012]).material.side = THREE.DoubleSide;
      break;
    case "trenza":
      sides(0.12, 0.6);
      cap(0.12, 0.55, 0.3);
      for (let index = 0; index < 5; index += 1) {
        piece(new THREE.SphereGeometry(0.03 - index * 0.002, 10, 8), [0, -0.02 - index * 0.045, 0.125 + index * 0.012]);
      }
      piece(new THREE.TorusGeometry(0.02, 0.006, 6, 12), [0, -0.235, 0.18], [1.2, 0, 0], [1, 1, 1], tie());
      break;
    case "media":
      // Media melena corta (tipo bob) con flequillo.
      sides(0.125, 0.7);
      cap(0.124, 0.55, 0.2);
      piece(new THREE.SphereGeometry(0.06, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.078, -0.07], [-0.75, 0, 0], [1.3, 0.42, 0.7]);
      break;
    case "coleta":
      sides(0.12, 0.6);
      cap(0.12, 0.55, 0.3);
      piece(new THREE.SphereGeometry(0.045, 12, 8), [0, 0.03, 0.115]);
      piece(new THREE.TorusGeometry(0.03, 0.009, 6, 14), [0, 0.02, 0.15], [0, 0, 0], [1, 1, 1], tie());
      piece(new THREE.CylinderGeometry(0.035, 0.012, 0.22, 10), [0, -0.08, 0.17], [-0.35, 0, 0]);
      break;
    default:
      cap(0.118, 0.55, 0.35);
  }
  if (hairColor2) paintTwoTone(holder, material, hairColor, hairColor2, split);
}

// `player.character` es el personaje que ha elegido; si no tiene, sale el de siempre según su ficha.
// `showLabel`: el nombre flotando encima, como en la pizarra.
export function createPlayer(scene, element, player, position, female = false, { showLabel = true } = {}) {
  const look = normalizeLook(player?.character) ?? lookFromSeed(player?.id ?? element.player_id ?? element.id, female);
  const isFemale = look.build === "female";
  const shape = bodyShape(look);
  const base0 = isFemale ? BUILDS.female : BUILDS.male;
  const build = { ...base0, shoulder: base0.shoulder * shape.shoulders, hip: base0.hip * shape.hips };
  const rival = element.side === "rival";
  const base = rival ? JERSEYS.rival : element.side === "coach" ? JERSEYS.coach : position === "Líbero" ? JERSEYS.libero : JERSEYS.home;
  // La camiseta especial de la tienda solo se ve con la equipación de casa (el rival va de blanco).
  const special = !rival && SPECIAL_SHIRTS[look.shirt] ? look.shirt : null;
  const jersey = special ? { ...base, ...SPECIAL_SHIRTS[special], stripe: SPECIAL_SHIRTS[special].trim } : { ...base, stripe: rival ? "#FFFFFF" : "#FF3800" };
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const skinColor = skinHex(look.skin);
  const hairColor = hairHex(look.hair_color);
  // Piel con un brillo suave y tela con el reflejo de la ropa de deporte.
  // La piel con un poco de calor propio: en la sombra no se queda gris (como si la luz la atravesara un poco).
  const skin = withRim(
    new THREE.MeshPhysicalMaterial({ color: skinColor, roughness: 0.6, sheen: 0.25, sheenRoughness: 0.6, sheenColor: 0xffb49a, emissive: 0x5a2410, emissiveIntensity: 0.12 }),
    0xffc9a8,
    0.18,
  );
  const fabric = (color, roughness = 0.72) =>
    withRim(new THREE.MeshPhysicalMaterial({ color, roughness, sheen: 0.9, sheenRoughness: 0.45, sheenColor: 0xbfbfbf }), 0xffffff, 0.22);
  const shirt = fabric(special ? "#ffffff" : jersey.shirt);
  // Las especiales llevan su estampado por todo el cuerpo y las mangas.
  if (special) shirt.map = shirtPatternTexture(special);
  const trim = fabric(jersey.trim);
  const shorts = fabric(0x27272a, 0.8);
  const pads = fabric(accentHex(look.kneepads) ?? "#18181b", 0.85);
  const socks = fabric(0xf4f4f5, 0.85);
  const add = (mesh) => {
    body.add(mesh);
    return mesh;
  };
  const pair = (make) => [add(make()), add(make())];

  const parts = {
    shortLegs: pair(() => taper(0.098, 0.088, shorts)),
    thighs: pair(() => muscle(0.09, 0.104, 0.064, 0.3, skin)),
    kneePads: pair(() => taper(0.074, 0.07, pads)),
    shins: pair(() => muscle(0.062, 0.082, 0.044, 0.26, skin)),
    socks: pair(() => taper(0.054, 0.05, socks)),
    sleeves: pair(() => taper(0.068, 0.062, shirt)),
    upperArms: pair(() => muscle(0.055, 0.066, 0.047, 0.42, skin)),
    foreArms: pair(() => muscle(0.049, 0.06, 0.037, 0.22, skin)),
  };
  const wristColor = accentHex(look.wristbands);
  if (wristColor) {
    const band = fabric(wristColor, 0.9);
    parts.wristbands = pair(() => taper(0.05, 0.047, band));
  }
  const sphere = (radius, material, girth = 1) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 18), material);
    mesh.castShadow = true;
    mesh.scale.setScalar(girth);
    return add(mesh);
  };
  const thick = (meshes, wide, deep = wide) => meshes?.forEach((mesh) => {
    mesh.userData.girth = [wide, deep];
  });
  thick(parts.shortLegs, shape.thigh);
  thick(parts.thighs, shape.thigh);
  thick(parts.kneePads, shape.shin);
  thick(parts.shins, shape.shin);
  thick(parts.socks, shape.shin);
  thick(parts.sleeves, shape.upperArm);
  thick(parts.upperArms, shape.upperArm);
  thick(parts.foreArms, shape.foreArm);
  thick(parts.wristbands, shape.foreArm);
  // Mano con forma: palma alargada que sigue al antebrazo y el pulgar a un lado.
  const hand = (sign) => {
    const holder = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.044, 24, 16), skin);
    palm.scale.set(1.0, 1.6, 0.68);
    palm.position.y = 0.035;
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.03, 4, 10), skin);
    thumb.position.set(sign * 0.03, 0.022, -0.012);
    thumb.rotation.z = sign * -0.6;
    palm.castShadow = true;
    thumb.castShadow = true;
    holder.add(palm, thumb);
    return add(holder);
  };
  const joints = {
    knees: [sphere(0.074, pads, shape.shin), sphere(0.074, pads, shape.shin)],
    elbows: [sphere(0.05, skin, shape.foreArm), sphere(0.05, skin, shape.foreArm)],
    hands: [hand(-1), hand(1)],
    shoulders: [sphere(0.074, shirt, shape.upperArm), sphere(0.074, shirt, shape.upperArm)],
  };
  // Tapas en los extremos para que no se vea por dentro de ninguna pieza.
  const caps = {
    hips: [sphere(0.094, shorts, shape.thigh), sphere(0.094, shorts, shape.thigh)],
    ankles: [sphere(0.05, socks, shape.shin), sphere(0.05, socks, shape.shin)],
    wrists: [sphere(0.041, skin, shape.foreArm), sphere(0.041, skin, shape.foreArm)],
  };
  // Zapatillas del color elegido con la suela del club.
  const shoeColor = accentHex(look.shoes) ?? "#ffffff";
  const shoes = [0, 1].map(() => {
    const shoe = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.14, 8, 20), new THREE.MeshPhysicalMaterial({ color: shoeColor, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.4 }));
    upper.rotation.x = Math.PI / 2;
    upper.scale.set(1, 1, 0.82);
    upper.position.set(0, 0.048, -0.015);
    const soleShape = new THREE.Shape();
    soleShape.absellipse(0, 0, 0.055, 0.135, 0, Math.PI * 2);
    const soleGeometry = new THREE.ExtrudeGeometry(soleShape, { depth: 0.022, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 3, curveSegments: 24 });
    soleGeometry.rotateX(Math.PI / 2);
    const sole = new THREE.Mesh(soleGeometry, new THREE.MeshStandardMaterial({ color: rival ? 0x18181b : shoeColor === "#ff3800" ? 0xffffff : 0xff3800, roughness: 0.6 }));
    sole.position.set(0, 0.028, -0.015);
    upper.castShadow = true;
    sole.castShadow = true;
    shoe.add(upper, sole);
    return add(shoe);
  });

  const torso = add(new THREE.Mesh(torsoGeometry(build), shirt));
  torso.castShadow = true;
  torso.userData.girth = [shape.torsoWide, shape.torsoDeep];
  const number = player?.number ?? element.label;
  const decal = (texture) => new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.85, depthWrite: false });
  const front = add(new THREE.Mesh(new THREE.PlaneGeometry(special ? 0.32 : 0.3, special ? 0.32 : 0.3), decal(shirtTexture({ jersey, number, back: false, crest: !rival, special }))));
  front.rotation.y = Math.PI;
  const back = add(new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), decal(shirtTexture({ jersey, number, name: element.name, back: true }))));
  // Cuello de pico con el color del ribete.
  const collar = add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 18), trim));
  collar.rotation.x = Math.PI / 2;
  collar.visible = false;
  const waist = add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.185, 0.16, 18, 1, true), new THREE.MeshStandardMaterial({ map: shortsTexture(jersey), roughness: 0.9, side: THREE.DoubleSide })));
  waist.castShadow = true;
  waist.scale.set(shape.torsoWide, 1, shape.torsoDeep);

  const neck = add(taper(0.05, 0.046, skin));
  neck.userData.girth = [shape.neck * 1.3, shape.neck * 1.3];
  const faceMap = faceTexture(look, isFemale, hairColor, skinColor);
  const head = add(new THREE.Mesh(new THREE.SphereGeometry(0.104, 48, 32), withRim(new THREE.MeshPhysicalMaterial({ map: faceMap, roughness: 0.6, sheen: 0.25, sheenRoughness: 0.6, sheenColor: 0xffb49a }), 0xffc9a8, 0.18)));
  head.scale.set(1.16 * HEAD_GROW, 1.34 * HEAD_GROW, 1.2 * HEAD_GROW);
  head.castShadow = true;
  const eyeTextures = eyeLayer(look);
  if (eyeTextures) {
    const eyeShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.1045, 48, 32),
      new THREE.MeshStandardMaterial({ map: eyeTextures.iris, alphaMap: eyeTextures.mask, transparent: true, depthWrite: false, roughness: 0.25 }),
    );
    head.add(eyeShell);
  }
  // Párpados para parpadear (encima de los ojos) y la cara contenta para celebrar, que se hace al usarla.
  let lids = null;
  if (look.eyes !== "smiley") {
    lids = new THREE.Mesh(
      new THREE.SphereGeometry(0.1049, 48, 32),
      new THREE.MeshStandardMaterial({ map: eyelidTexture(look, skinColor), transparent: true, depthWrite: false, roughness: 0.6 }),
    );
    lids.visible = false;
    head.add(lids);
  }
  const faces = { normal: faceMap, happy: null, make: () => faceTexture({ ...look, mouth: "grin" }, isFemale, hairColor, skinColor) };
  // Para liberar las dos caras al quitar el personaje (solo una está puesta en cada momento).
  head.userData.faces = faces;
  // Orejas y nariz con volumen: la cabeza deja de ser una bola pintada.
  const headPiece = (geometry, position, scale) => {
    const mesh = new THREE.Mesh(geometry, skin);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    head.add(mesh);
    return mesh;
  };
  [-1, 1].forEach((sign) => headPiece(new THREE.SphereGeometry(0.026, 20, 14), [sign * 0.099, -0.005, 0.004], [0.42, 0.95, 0.72]));
  headPiece(new THREE.SphereGeometry(0.017, 20, 14), [0, -0.022, -0.1], [0.85, 1.05, 0.95]);
  addHair(head, look.hair, rival ? 0xffffff : 0xff3800, hairColor, hairHex2(look.hair_color2), look.hair_split);
  const headbandColor = accentHex(look.headband);
  if (headbandColor) {
    // Cinta en la frente, algo más alta por detrás.
    const headband = new THREE.Mesh(new THREE.TorusGeometry(0.094, 0.016, 8, 28), new THREE.MeshStandardMaterial({ color: headbandColor, roughness: 0.9 }));
    headband.position.y = 0.055;
    headband.rotation.x = Math.PI / 2 - 0.22;
    headband.scale.set(1, 1, 0.9);
    head.add(headband);
  }
  addCrown(head, player?.crown, look.hair);
  addGlasses(head, look.glasses);

  let name = null;
  if (showLabel) {
    const firstName = (element.name ?? "").trim().split(/\s+/)[0];
    name = labelSprite(firstName || element.label, { accent: POSITION_SHORT[position] ?? "", width: firstName ? 1.1 : 0.6 });
    group.add(name);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0xff3800, transparent: true, opacity: 0.8 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  ring.visible = Boolean(element.highlight);
  group.add(ring);

  scene.add(group);
  return {
    group, body, parts, joints, caps, shoes, torso, front, back, collar, waist, neck, head, name, ring, rival, build, look, shape,
    // Tamaño a escala real según lo que mide (o una estatura normal si no la ha puesto).
    scale: figureScale(player?.height_cm, isFemale),
    eyes: eyeTextures?.iris ?? null, eyeLook: new THREE.Vector2(), lids, faces, nextBlink: 0,
    tag: null, tagKey: "", motion: null, smooth: new Map(), yaw: rival ? Math.PI : 0,
  };
}

const along = (from, to, amount) => from.clone().lerp(to, amount);

// ---------- Posturas clave (sacadas de fotos de jugadores de verdad) ----------
// Cada postura da la posición de las articulaciones en metros: x a la derecha, y hacia arriba, z hacia atrás
// (delante es z negativa). p: pelvis, c: pecho, h: cabeza, y por parejas [izquierda, derecha]:
// e: codos, a: manos, k: rodillas, f: pies.
const pair = (x, y, z) => [[-x, y, z], [x, y, z]];
const KEY_POSES = {
  // De pie, relajada: para andar.
  stand: { p: [0, 0.95, 0], c: [0, 1.45, 0], h: [0, 1.66, -0.01], e: pair(0.24, 1.18, 0), a: pair(0.24, 0.93, -0.04), k: pair(0.11, 0.5, -0.03), f: pair(0.12, 0.04, 0) },
  // Posición de espera: piernas abiertas y flexionadas, peso delante, manos preparadas.
  ready: { p: [0, 0.8, 0.1], c: [0, 1.28, -0.1], h: [0, 1.5, -0.17], e: pair(0.28, 1.05, -0.2), a: pair(0.2, 0.95, -0.4), k: pair(0.21, 0.46, -0.14), f: pair(0.26, 0.04, 0.04) },
  // Recepción de antebrazos: sentadilla profunda, tronco inclinado y los brazos juntos y estirados delante.
  reception: { p: [0, 0.6, 0.18], c: [0, 1.05, -0.18], h: [0, 1.27, -0.28], e: pair(0.11, 0.86, -0.39), a: pair(0.03, 0.7, -0.6), k: pair(0.25, 0.47, -0.25), f: pair(0.31, 0.04, 0.02) },
  // Colocación: rodillas flexionadas, codos abiertos y las manos encima de la frente formando un triángulo.
  set: { p: [0, 0.86, 0.03], c: [0, 1.37, 0], h: [0, 1.59, -0.03], e: pair(0.3, 1.6, -0.16), a: pair(0.11, 1.84, -0.2), k: pair(0.16, 0.47, -0.1), f: pair(0.19, 0.04, 0.03) },
  setPush: { p: [0, 0.95, 0], c: [0, 1.45, -0.02], h: [0, 1.67, -0.04], e: pair(0.25, 1.77, -0.18), a: pair(0.09, 2.02, -0.27), k: pair(0.12, 0.51, -0.04), f: pair(0.14, 0.05, 0.02) },
  // Bloqueo: agachado para saltar y luego brazos estirados arriba y adelante, por encima de la red.
  blockLoad: { p: [0, 0.72, 0.06], c: [0, 1.2, -0.06], h: [0, 1.42, -0.1], e: pair(0.3, 1.18, -0.12), a: pair(0.22, 1.36, -0.26), k: pair(0.17, 0.44, -0.14), f: pair(0.18, 0.04, 0.03) },
  block: { p: [0, 0.95, 0.02], c: [0, 1.45, -0.05], h: [0, 1.66, -0.07], e: pair(0.21, 1.76, -0.12), a: pair(0.22, 2.04, -0.3), k: pair(0.12, 0.53, -0.06), f: pair(0.12, 0.09, 0.07) },
  // Remate: batida con los brazos atrás, en el aire el cuerpo arqueado con el brazo armado detrás de la cabeza
  // y el otro apuntando al balón, golpe por delante en lo más alto y el brazo baja cruzando.
  spikeLoad: { p: [0, 0.7, 0.06], c: [0, 1.13, -0.2], h: [0, 1.33, -0.3], e: pair(0.24, 1.0, 0.25), a: pair(0.22, 0.95, 0.46), k: pair(0.15, 0.44, -0.16), f: pair(0.2, 0.04, 0.05) },
  // Impulso: despegando, los brazos suben por delante y las piernas se estiran.
  spikeRise: { p: [0, 0.86, 0.03], c: [0, 1.36, -0.08], h: [0, 1.58, -0.14], e: pair(0.24, 1.4, -0.2), a: pair(0.2, 1.6, -0.32), k: pair(0.13, 0.5, -0.1), f: pair(0.15, 0.1, 0.05) },
  spikeArm: {
    p: [0, 0.95, 0], c: [0, 1.42, 0.13], h: [0, 1.62, 0.09],
    e: [[-0.22, 1.7, -0.08], [0.33, 1.72, 0.22]], a: [[-0.18, 2.0, -0.3], [0.22, 1.9, 0.4]],
    k: pair(0.12, 0.56, -0.12), f: pair(0.13, 0.36, 0.36),
  },
  spikeHit: {
    p: [0, 0.95, 0.02], c: [0, 1.44, -0.08], h: [0, 1.65, -0.09],
    e: [[-0.28, 1.22, -0.12], [0.24, 1.82, -0.06]], a: [[-0.16, 1.05, -0.22], [0.17, 2.12, -0.22]],
    k: pair(0.12, 0.56, -0.1), f: pair(0.11, 0.3, 0.16),
  },
  spikeFollow: {
    p: [0, 0.93, 0.02], c: [0, 1.38, -0.16], h: [0, 1.58, -0.24],
    e: [[-0.27, 1.12, -0.04], [0.16, 1.2, -0.26]], a: [[-0.26, 0.92, -0.02], [-0.04, 0.96, -0.3]],
    k: pair(0.14, 0.5, -0.15), f: pair(0.14, 0.1, 0.04),
  },
  land: { p: [0, 0.7, 0.1], c: [0, 1.18, -0.12], h: [0, 1.4, -0.2], e: pair(0.3, 1.0, -0.12), a: pair(0.28, 0.82, -0.22), k: pair(0.2, 0.43, -0.18), f: pair(0.22, 0.04, 0.03) },
  // Saque: lanza con la izquierda con el pie izquierdo delante, arma la derecha, golpea arriba y el brazo baja.
  serveToss: {
    p: [0, 0.93, 0], c: [0, 1.43, 0.04], h: [0, 1.64, 0.01],
    e: [[-0.15, 1.75, -0.1], [0.32, 1.66, 0.16]], a: [[-0.1, 2.05, -0.16], [0.2, 1.86, 0.32]],
    k: [[-0.12, 0.5, -0.2], [0.14, 0.5, 0.1]], f: [[-0.13, 0.04, -0.26], [0.15, 0.04, 0.2]],
  },
  serveHit: {
    p: [0, 0.95, -0.02], c: [0, 1.45, -0.08], h: [0, 1.66, -0.09],
    e: [[-0.26, 1.2, -0.1], [0.24, 1.8, -0.06]], a: [[-0.2, 1.0, -0.18], [0.16, 2.1, -0.2]],
    k: [[-0.12, 0.5, -0.2], [0.14, 0.52, 0.06]], f: [[-0.13, 0.04, -0.26], [0.15, 0.06, 0.16]],
  },
  serveFollow: {
    p: [0, 0.9, -0.06], c: [0, 1.38, -0.18], h: [0, 1.58, -0.24],
    e: [[-0.26, 1.15, -0.06], [0.18, 1.18, -0.28]], a: [[-0.24, 0.95, -0.04], [0.0, 0.98, -0.34]],
    k: [[-0.12, 0.48, -0.24], [0.13, 0.5, -0.02]], f: [[-0.13, 0.04, -0.28], [0.14, 0.12, 0.1]],
  },
  // Defensa: muy abajo con los brazos delante y luego plancha estirándose hacia el balón.
  digLow: { p: [0, 0.52, 0.16], c: [0, 0.93, -0.27], h: [0, 1.1, -0.4], e: pair(0.12, 0.7, -0.52), a: pair(0.05, 0.54, -0.72), k: pair(0.29, 0.4, -0.2), f: pair(0.38, 0.04, 0.05) },
  digDive: {
    p: [0, 0.3, 0.36], c: [0, 0.33, -0.22], h: [0, 0.36, -0.44],
    e: pair(0.16, 0.3, -0.64), a: pair(0.1, 0.24, -0.94), k: pair(0.14, 0.24, 0.76), f: pair(0.15, 0.3, 1.14),
  },
  // Toques de antebrazos para uno mismo: brazos juntos delante y las piernas empujan en cada toque.
  bumpReady: { p: [0, 0.78, 0.08], c: [0, 1.27, -0.1], h: [0, 1.5, -0.16], e: pair(0.11, 1.05, -0.31), a: pair(0.03, 0.86, -0.52), k: pair(0.2, 0.45, -0.14), f: pair(0.26, 0.04, 0.04) },
  bumpHit: { p: [0, 0.88, 0.04], c: [0, 1.38, -0.08], h: [0, 1.6, -0.14], e: pair(0.11, 1.17, -0.33), a: pair(0.03, 1.0, -0.58), k: pair(0.16, 0.49, -0.1), f: pair(0.26, 0.04, 0.04) },
  // Celebraciones.
  cheer: { p: [0, 0.95, 0], c: [0, 1.45, 0.02], h: [0, 1.68, 0], e: pair(0.36, 1.76, 0), a: pair(0.46, 2.06, -0.02), k: pair(0.12, 0.53, -0.04), f: pair(0.13, 0.06, 0.03) },
  fistLoad: {
    p: [0, 0.9, 0.02], c: [0, 1.4, -0.04], h: [0, 1.62, -0.06],
    e: [[-0.24, 1.15, -0.02], [0.3, 1.45, -0.1]], a: [[-0.22, 0.92, -0.06], [0.24, 1.74, -0.18]],
    k: [[-0.12, 0.5, -0.04], [0.13, 0.64, -0.24]], f: [[-0.13, 0.04, 0], [0.13, 0.26, -0.1]],
  },
  fistPump: {
    p: [0, 0.86, 0.05], c: [0, 1.34, -0.12], h: [0, 1.56, -0.16],
    e: [[-0.24, 1.13, -0.02], [0.3, 1.18, -0.12]], a: [[-0.22, 0.9, -0.06], [0.18, 1.0, -0.26]],
    k: [[-0.12, 0.48, -0.06], [0.14, 0.47, -0.12]], f: [[-0.13, 0.04, 0], [0.14, 0.04, 0]],
  },
};

// Cada gesto encadena posturas a lo largo de su duración: está en gestureTimes.js (con lo que ajustes en el editor).

const JOINTS = ["p", "c", "h"];
const PAIRS = ["e", "a", "k", "f"];
const smoothStep = (value) => value * value * (3 - 2 * value);
const mixPoint = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function mixPoses(a, b, t) {
  const out = {};
  JOINTS.forEach((joint) => {
    out[joint] = mixPoint(a[joint], b[joint], t);
  });
  PAIRS.forEach((joint) => {
    out[joint] = [mixPoint(a[joint][0], b[joint][0], t), mixPoint(a[joint][1], b[joint][1], t)];
  });
  return out;
}

// Una postura añadida en el editor usa, en el muñeco, la de serie de la que parte.
const poseOf = (name) => KEY_POSES[name] ?? KEY_POSES[baseOf(name)] ?? KEY_POSES.ready;

// Gesto capturado de vídeo: se interpola entre los dos fotogramas que tocan. El salto ya va en las posturas.
// Una postura clave tal cual (para la herramienta de captura, que empieza y acaba en ellas).
export const keyPose = (name) => poseOf(name);

function capturedPose(captured, progress) {
  const { frames } = captured;
  const at = Math.min(1, Math.max(0, progress)) * (frames.length - 1);
  const index = Math.min(frames.length - 2, Math.floor(at));
  if (index < 0) return frames[0];
  return mixPoses(frames[index], frames[index + 1], at - index);
}

function actionPose(action, progress) {
  const captured = capturedOf(action);
  if (captured) return { pose: capturedPose(captured, progress), jump: 0 };
  const plan = gesturePlan(action);
  if (!plan) return null;
  const { keys } = plan;
  let pose = poseOf(keys[0][1]);
  for (let index = 1; index < keys.length; index += 1) {
    const [start, from] = keys[index - 1];
    const [end, to] = keys[index];
    if (progress <= end) {
      pose = mixPoses(poseOf(from), poseOf(to), smoothStep(Math.min(1, Math.max(0, (progress - start) / (end - start)))));
      break;
    }
    pose = poseOf(to);
  }
  return { pose, jump: jumpAt(plan, progress) };
}

// Andar o correr a partir de la postura de pie: zancada adelante y atrás, rodillas arriba,
// brazos doblados que se balancean y el tronco inclinado hacia delante.
function runPose(stride, run, amount) {
  const base = mixPoses(KEY_POSES.ready, KEY_POSES.stand, Math.min(1, amount * 1.5));
  const out = mixPoses(base, base, 0);
  const lean = 0.06 + run * 0.14;
  out.p = [0, base.p[1] - run * 0.05 + Math.abs(stride) * run * 0.04, base.p[2]];
  out.c = [0, base.c[1] - run * 0.06, base.c[2] - lean * amount];
  out.h = [0, base.h[1] - run * 0.06, base.h[2] - lean * amount * 1.3];
  [0, 1].forEach((index) => {
    const step = (index === 0 ? stride : -stride) * amount;
    const lift = Math.max(0, step) * (0.14 + run * 0.2);
    const reach = 0.3 + run * 0.18;
    out.f[index] = [base.f[index][0] * (1 - amount * 0.4), 0.04 + lift, base.f[index][2] - step * reach];
    out.k[index] = [base.k[index][0] * (1 - amount * 0.3), base.k[index][1] + lift * 0.9, base.k[index][2] - step * reach * 0.5 - lift * 0.8];
    const swing = (index === 0 ? -stride : stride) * amount * (0.24 + run * 0.12);
    const bend = run * amount;
    out.e[index] = [base.e[index][0], base.e[index][1] + bend * 0.02, base.e[index][2] + swing * 0.5 + bend * 0.12];
    out.a[index] = [base.a[index][0] * (1 - bend * 0.2), base.a[index][1] + bend * 0.2, base.a[index][2] - swing];
  });
  return out;
}

// Mano con la que se toca el balón en cada gesto (índice), o las dos (null).
const STRIKE_HAND = { saque: 1, remate: 1 };
const vec = (point) => new THREE.Vector3(point[0], point[1], point[2]);

// Puntos del cuerpo para un momento del gesto (en metros, delante es z negativa). Los usa el muñeco
// y también el jugador con modelo real, que orienta sus huesos hacia estos puntos.
export function posePoints(store, { stride, run, amount, action, time }, build = BUILDS.male) {
  const doing = action ? actionPose(action.action, action.progress) : null;
  let joints = doing ? doing.pose : runPose(stride, run, amount);
  if (!doing && amount < 0.05) {
    // En espera, un balanceo muy suave del peso.
    const sway = Math.sin(time / 480) * 0.012;
    joints = { ...joints, p: [joints.p[0] + sway, joints.p[1], joints.p[2]], c: [joints.c[0] + sway * 1.4, joints.c[1], joints.c[2]], h: [joints.h[0] + sway * 1.6, joints.h[1], joints.h[2]] };
  }
  const smooth = (key, point, amountSmooth = 0.4) => {
    const target = vec(point);
    const previous = store.get(key);
    if (!previous) {
      store.set(key, target.clone());
      return target;
    }
    previous.lerp(target, amountSmooth);
    return previous.clone();
  };
  return pointsOf(joints, smooth, build, doing?.jump ?? 0, action ? STRIKE_HAND[action.action] ?? null : null, store);
}

// Los brazos miden siempre lo mismo y no pueden dar la vuelta de golpe: en algún fotograma del gesto
// capturado de vídeo el codo cae casi encima del hombro y, sin esto, el brazo giraba 360 grados.
const UPPER_ARM = 0.27;
const FOREARM = 0.26;
const MAX_TURN = 0.38; // radianes por fotograma (unos 22°): un brazo de verdad no gira más rápido.
const MIN_SEGMENT = 0.07;

function steadyBone(memory, key, from, to, length) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const previous = memory?.get(key);
  if (direction.length() < MIN_SEGMENT) {
    // Demasiado corto para saber hacia dónde apunta: sigue como estaba (o colgando, la primera vez).
    direction.copy(previous ?? new THREE.Vector3(0, -1, 0));
  }
  direction.normalize();
  if (previous) {
    const angle = previous.angleTo(direction);
    if (angle > MAX_TURN) {
      // Gira hacia la nueva dirección poco a poco, por el camino corto.
      const axis = new THREE.Vector3().crossVectors(previous, direction);
      if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0);
      direction.copy(previous).applyAxisAngle(axis.normalize(), MAX_TURN);
    }
  }
  memory?.set(key, direction.clone());
  return from.clone().addScaledVector(direction, length);
}

function pointsOf(joints, smooth, build, jump, strike, memory = null) {
  const pelvis = smooth("p", joints.p);
  const chest = smooth("c", joints.c);
  const head = smooth("h", joints.h);
  const torsoUp = new THREE.Vector3().subVectors(chest, pelvis).normalize();
  const side = new THREE.Vector3(1, 0, 0);
  const points = { pelvis, chest, head, torsoUp, hips: [], knees: [], feet: [], shoulders: [], elbows: [], hands: [], jump, strike };
  [0, 1].forEach((index) => {
    const sign = index === 0 ? -1 : 1;
    points.hips.push(pelvis.clone().addScaledVector(side, sign * build.hip));
    points.knees.push(smooth(`k${index}`, joints.k[index], 0.45));
    points.feet.push(smooth(`f${index}`, joints.f[index], 0.45));
    points.shoulders.push(chest.clone().addScaledVector(side, sign * build.shoulder).addScaledVector(torsoUp, -0.03));
    const shoulder = points.shoulders[index];
    const elbowTarget = smooth(`e${index}`, joints.e[index]);
    const handTarget = smooth(`a${index}`, joints.a[index]);
    const elbow = steadyBone(memory, `upper${index}`, shoulder, elbowTarget, UPPER_ARM);
    points.elbows.push(elbow);
    points.hands.push(steadyBone(memory, `fore${index}`, elbow, handTarget, FOREARM));
  });
  return points;
}

// Los puntos de una postura clave, tal cual (sin suavizar): para calcularla o editarla.
export function keyPosePoints(name, build = BUILDS.male) {
  return pointsOf(poseOf(name), (key, point) => vec(point), build, 0, null);
}

// Qué dos posturas clave tocan en este momento del gesto, cuánto de cada una y la altura del salto.
export function actionTimeline(action, progress) {
  const plan = gesturePlan(action);
  if (!plan) return null;
  const { keys } = plan;
  let result = { from: keys[0][1], to: keys[0][1], t: 0 };
  for (let index = 1; index < keys.length; index += 1) {
    const [start, from] = keys[index - 1];
    const [end, to] = keys[index];
    if (progress <= end) {
      result = { from, to, t: smoothStep(Math.min(1, Math.max(0, (progress - start) / (end - start)))) };
      break;
    }
    result = { from: to, to, t: 0 };
  }
  return { ...result, jump: jumpAt(plan, progress) };
}

// Qué posturas clave forman cada gesto, en orden (para el editor).
export const GESTURE_KEYS = Object.fromEntries(Object.entries(ACTION_KEYS).map(([name, plan]) => [name, [...new Set(plan.keys.map(([, key]) => key))]]));

export function posePlayer(rig, options) {
  const pts = posePoints(rig.smooth, options, rig.build);
  const { pelvis, chest, head: headPoint, torsoUp } = pts;

  [0, 1].forEach((index) => {
    const hip = pts.hips[index];
    const knee = pts.knees[index];
    const foot = pts.feet[index];
    placeLimb(rig.parts.shortLegs[index], hip, along(hip, knee, rig.build.shorts));
    placeLimb(rig.parts.thighs[index], along(hip, knee, 0.3), knee);
    placeLimb(rig.parts.kneePads[index], along(hip, knee, 0.86), along(knee, foot, 0.14));
    placeLimb(rig.parts.shins[index], knee, foot);
    placeLimb(rig.parts.socks[index], along(knee, foot, 0.62), foot);
    rig.caps.hips[index].position.copy(hip);
    rig.caps.ankles[index].position.copy(foot);
    rig.joints.knees[index].position.copy(knee);
    rig.shoes[index].position.set(foot.x, Math.max(0, foot.y - 0.04), foot.z - 0.04);
    // La zapatilla sigue la dirección de la espinilla cuando el pie se despega del suelo.
    rig.shoes[index].rotation.x = Math.min(1.2, Math.max(0, foot.y - 0.05) * 2.6);

    const shoulder = pts.shoulders[index];
    const elbow = pts.elbows[index];
    const hand = pts.hands[index];
    placeLimb(rig.parts.sleeves[index], shoulder, along(shoulder, elbow, rig.build.sleeve));
    placeLimb(rig.parts.upperArms[index], along(shoulder, elbow, 0.35), elbow);
    placeLimb(rig.parts.foreArms[index], elbow, hand);
    if (rig.parts.wristbands) placeLimb(rig.parts.wristbands[index], along(elbow, hand, 0.74), along(elbow, hand, 0.92));
    rig.joints.shoulders[index].position.copy(shoulder);
    rig.joints.elbows[index].position.copy(elbow);
    rig.joints.hands[index].position.copy(hand);
    // La mano sigue la dirección del antebrazo.
    rig.joints.hands[index].quaternion.setFromUnitVectors(UP, new THREE.Vector3().subVectors(hand, elbow).normalize());
    rig.caps.wrists[index].position.copy(hand);
  });

  placeLimb(rig.torso, pelvis, chest.clone().addScaledVector(torsoUp, 0.06));
  rig.waist.position.copy(pelvis).addScaledVector(torsoUp, -0.03);
  rig.waist.quaternion.copy(rig.torso.quaternion);
  const middle = along(pelvis, chest, 0.55);
  // Los dorsales siguen la inclinación del tronco.
  const turn = new THREE.Quaternion().setFromUnitVectors(UP, torsoUp);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(turn);
  // El número de la camiseta, pegado al pecho y a la espalda aunque el tronco sea más ancho.
  const chestDepth = 0.152 * (rig.shape?.torsoDeep ?? 1);
  rig.front.position.copy(middle).addScaledVector(forward, chestDepth);
  rig.back.position.copy(middle).addScaledVector(forward, -chestDepth).addScaledVector(torsoUp, 0.02);
  rig.front.quaternion.copy(turn).multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI));
  rig.back.quaternion.copy(turn);
  const neckBase = chest.clone().addScaledVector(torsoUp, 0.08);
  placeLimb(rig.neck, neckBase, along(neckBase, headPoint, 0.55));
  rig.collar.position.copy(neckBase);
  rig.collar.quaternion.copy(turn).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  // La cabeza es grande: se sube un poco para que no se hunda en los hombros.
  rig.head.position.copy(headPoint).addScaledVector(torsoUp, 0.035 + 0.07 * (HEAD_GROW - 1));
  // La cabeza mira hacia donde va el tronco, sin doblarse del todo...
  const headTurn = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), turn, 0.5);
  if (options.lookAt) {
    // ...y acompaña un poco hacia el balón (como mucho ~17°): el resto lo hacen los ojos.
    const local = rig.body.worldToLocal(options.lookAt.clone()).sub(rig.head.position);
    if (local.lengthSq() > 1e-6) {
      const wanted = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), local.normalize());
      const angle = headTurn.angleTo(wanted);
      headTurn.slerp(wanted, angle > 0.001 ? Math.min(0.35, 0.3 / angle) : 0);
    }
  }
  // Suavizado lento: la cabeza va con retraso, no persigue cada bote.
  rig.lookSmooth = (rig.lookSmooth ?? headTurn.clone()).slerp(headTurn, 0.08);
  rig.head.quaternion.copy(rig.lookSmooth);

  rig.body.position.y = pts.jump;
  rig.body.rotation.set(0, 0, 0);
  const now = options.time ?? performance.now();
  const actionName = typeof options.action === "string" ? options.action : options.action?.action ?? null;
  const still = !actionName && !options.stride && !options.run && !options.amount;
  if (still) {
    // Quieto: respira (el pecho se ensancha un poco) y se balancea muy poco.
    const breath = Math.sin(now * 0.0021) * 0.5 + 0.5;
    rig.torso.scale.x *= 1 + breath * 0.025;
    rig.torso.scale.z *= 1 + breath * 0.035;
    rig.body.rotation.z = Math.sin(now * 0.0009) * 0.012;
    rig.head.position.y += breath * 0.006;
  }
  if (rig.lids) {
    // Parpadea cada 2,5 a 6 segundos, durante un instante.
    if (!rig.nextBlink) rig.nextBlink = now + 1500 + Math.random() * 3000;
    rig.lids.visible = now >= rig.nextBlink && now < rig.nextBlink + 120;
    if (now >= rig.nextBlink + 120) rig.nextBlink = now + 2500 + Math.random() * 3500;
  }
  if (rig.faces) {
    // Al celebrar sonríe con la boca abierta.
    const happy = actionName === "brazos" || actionName === "puno";
    if (happy && !rig.faces.happy) rig.faces.happy = rig.faces.make();
    const wanted = happy ? rig.faces.happy : rig.faces.normal;
    if (rig.head.material.map !== wanted) {
      rig.head.material.map = wanted;
      rig.head.material.needsUpdate = true;
    }
  }
  if (rig.eyes) {
    // Los ojos siguen el punto con rapidez, dentro del blanco del ojo.
    let eyeX = 0;
    let eyeY = 0;
    if (options.lookAt) {
      rig.head.updateWorldMatrix(true, false);
      const seen = rig.head.worldToLocal(options.lookAt.clone()).multiply(rig.head.scale);
      const clamp = (value) => Math.max(-1, Math.min(1, value));
      eyeX = clamp(Math.atan2(seen.x, -seen.z) / 0.6);
      eyeY = clamp(Math.atan2(seen.y, Math.hypot(seen.x, seen.z)) / 0.5);
    }
    rig.eyeLook.lerp(new THREE.Vector2(eyeX, eyeY), 0.35);
    rig.eyes.offset.set((rig.eyeLook.x * 3.6) / 512, (-rig.eyeLook.y * 3.2) / 256);
  }
  if (rig.name) rig.name.position.set(0, rig.body.position.y + 2.15, 0);
  return pts.strike;
}

// Gira de forma suave hacia `target` por el camino corto.
export function turnTowards(current, target, amount) {
  let difference = target - current;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  return current + difference * amount;
}

// Luz de estudio: un entorno que se refleja en la piel y la ropa, y colores de cine en vez de planos.
export function studioLighting(renderer, scene, intensity = 0.6) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(new RoomEnvironment(), 0.04).texture;
  generator.dispose();
  scene.environment = environment;
  scene.environmentIntensity = intensity;
  return environment;
}

// Libera la memoria de todo lo que cuelga de un objeto.
export function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    child.userData?.faces?.normal?.dispose?.();
    child.userData?.faces?.happy?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    materials.forEach((material) => {
      material.map?.dispose?.();
      material.dispose?.();
    });
  });
}
