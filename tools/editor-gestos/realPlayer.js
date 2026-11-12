import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { actionTimeline, canvasTexture, keyPosePoints, posePoints } from "@/app/character/character3D.js";
import { baseOf } from "@/app/character/gestureTimes.js";
import savedGestures from "./gestures.json";

// En el ordenador, al guardar posturas desde el editor se actualizan aquí sin recargar ninguna página.
if (import.meta.hot) {
  import.meta.hot.accept("./gestures.json", (updated) => {
    if (!updated) return;
    Object.keys(savedGestures).forEach((key) => delete savedGestures[key]);
    Object.assign(savedGestures, updated.default);
  });
}
import { accentHex, hairHex } from "@/app/character/looks.js";

// Jugador con modelo de verdad (Universal Base Characters de Quaternius, CC0), vestido con la equipación
// del club y movido con las mismas posturas que el muñeco.
// Aparcado: solo para el editor de gestos (npm run dev). No se publica.
const BASE = "/tools/editor-gestos/modelos/jugadores/";
const loader = new GLTFLoader();
const cache = new Map();
const load = (name) => {
  if (!cache.has(name)) {
    cache.set(name, new Promise((resolve, reject) => loader.load(`${BASE}${name}.gltf`, resolve, undefined, reject)));
  }
  return cache.get(name);
};

// Los peinados que trae el pack; los del editor que no existen van al más parecido.
const HAIR_FILES = {
  raya: "pelo-raya",
  corto: "pelo-raya",
  tupe: "pelo-raya",
  rizos: "pelo-rapado",
  rapado: "pelo-rapado",
  melena: "pelo-melena",
  media: "pelo-melena",
  trenza: "pelo-melena",
  coleta: "pelo-monos",
  "moño": "pelo-monos",
  calvo: null,
};
export const REAL_HAIR_STYLES = [
  { id: "raya", label: "Raya" },
  { id: "rapado", label: "Rapado" },
  { id: "melena", label: "Melena" },
  { id: "moño", label: "Moños" },
  { id: "calvo", label: "Sin pelo" },
];
const hairFile = (look) => {
  const file = HAIR_FILES[look.hair] ?? "pelo-raya";
  return file === "pelo-rapado" && look.build === "female" ? "pelo-rapado-chica" : file;
};
// Tono de piel: el modelo viene en un tono medio y se aclara u oscurece sin perder sus sombras.
const SKIN_POWER = { s1: 1.35, s2: 1.25, s3: 1.05, s4: 0.9, s5: 0.72, s6: 0.56 };

const JERSEYS = {
  home: { shirt: "#0b0b0e", shorts: "#111114", text: "#ffffff" },
  libero: { shirt: "#fcd34d", shorts: "#111114", text: "#09090b" },
};

function backTexture(number, name, jersey) {
  return canvasTexture(256, 256, (context) => {
    context.clearRect(0, 0, 256, 256);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = jersey.text;
    if (name) {
      context.font = "800 30px Arial, Helvetica, sans-serif";
      context.fillText(name.toUpperCase().slice(0, 10), 128, 48, 230);
    }
    context.font = "900 140px Arial, Helvetica, sans-serif";
    context.fillText(String(number ?? ""), 128, 150);
  });
}

const smoothStep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- La ropa: una copia del cuerpo "planchada" que pasa por fuera sin marcar nada ----------
function drapeGarment(source, d) {
  const geometry = source.clone();
  const pos = geometry.attributes.position;
  const count = pos.count;
  geometry.setAttribute("restPos", pos.clone());
  geometry.computeVertexNormals();
  const smooth = smoothStep;

  // Vértices repetidos por las costuras de la textura: se tratan como uno solo.
  const keyOf = (i) => `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
  const ids = new Map();
  const unique = new Int32Array(count);
  const members = [];
  for (let i = 0; i < count; i += 1) {
    const key = keyOf(i);
    let id = ids.get(key);
    if (id === undefined) {
      id = members.length;
      ids.set(key, id);
      members.push([]);
    }
    unique[i] = id;
    members[id].push(i);
  }
  const n = members.length;
  const p = new Float32Array(n * 3);
  const normal = new Float32Array(n * 3);
  const nrm = geometry.attributes.normal;
  members.forEach((list, id) => {
    const i = list[0];
    p[id * 3] = pos.getX(i);
    p[id * 3 + 1] = pos.getY(i);
    p[id * 3 + 2] = pos.getZ(i);
    let x = 0;
    let y = 0;
    let z = 0;
    list.forEach((j) => {
      x += nrm.getX(j);
      y += nrm.getY(j);
      z += nrm.getZ(j);
    });
    const length = Math.hypot(x, y, z) || 1;
    normal[id * 3] = x / length;
    normal[id * 3 + 1] = y / length;
    normal[id * 3 + 2] = z / length;
  });
  const original = p.slice();

  const neighbours = Array.from({ length: n }, () => new Set());
  const index = geometry.index.array;
  for (let t = 0; t < index.length; t += 3) {
    const a = unique[index[t]];
    const b = unique[index[t + 1]];
    const c = unique[index[t + 2]];
    neighbours[a].add(b).add(c);
    neighbours[b].add(a).add(c);
    neighbours[c].add(a).add(b);
  }
  const lists = neighbours.map((set) => [...set]);

  // 1 camiseta, 3 pantalón. Con margen, para que el borde recortado también quede alisado.
  const kindOf = (x, y, z, margin) => {
    const ax = Math.abs(x);
    const neckline = d.neck + 0.09 * smooth(0.06, 0.13, ax) - (z > 0 ? 0.07 * (1 - smooth(0, 0.11, ax)) : 0.012);
    if (y >= d.hip - 0.05 - margin && y <= neckline + margin && ax <= d.sleeve + margin) return 1;
    if (y >= d.thigh - margin && y <= d.hip + 0.03 + margin) return 3;
    return 0;
  };
  const kind = new Uint8Array(n);
  for (let id = 0; id < n; id += 1) kind[id] = kindOf(original[id * 3], original[id * 3 + 1], original[id * 3 + 2], 0.03);

  // Planchado (Taubin): borra músculos y huecos sin encoger la prenda.
  const step = (factor) => {
    const next = p.slice();
    for (let id = 0; id < n; id += 1) {
      if (!kind[id]) continue;
      const list = lists[id];
      if (!list.length) continue;
      let x = 0;
      let y = 0;
      let z = 0;
      list.forEach((o) => {
        x += p[o * 3];
        y += p[o * 3 + 1];
        z += p[o * 3 + 2];
      });
      next[id * 3] += (x / list.length - p[id * 3]) * factor;
      next[id * 3 + 1] += (y / list.length - p[id * 3 + 1]) * factor;
      next[id * 3 + 2] += (z / list.length - p[id * 3 + 2]) * factor;
    }
    p.set(next);
  };
  for (let iteration = 0; iteration < 40; iteration += 1) {
    step(0.55);
    step(-0.58);
  }

  // Por respeto: el pantalón pasa recto entre los glúteos y por la entrepierna, sin meterse.
  const SLICE = 0.012;
  const back = new Map();
  const front = new Map();
  for (let id = 0; id < n; id += 1) {
    if (kind[id] !== 3) continue;
    const ax = Math.abs(original[id * 3]);
    if (ax < 0.035 || ax > 0.15) continue;
    const k = Math.round(original[id * 3 + 1] / SLICE);
    const z = p[id * 3 + 2];
    if (original[id * 3 + 2] < 0) back.set(k, Math.min(back.get(k) ?? Infinity, z));
    else front.set(k, Math.max(front.get(k) ?? -Infinity, z));
  }
  const near = (map, k) => {
    for (let off = 0; off < 4; off += 1) {
      for (const kk of [k - off, k + off]) if (map.has(kk)) return map.get(kk);
    }
    return null;
  };
  for (let id = 0; id < n; id += 1) {
    if (kind[id] !== 3 && !(kind[id] === 1 && original[id * 3 + 1] < d.hip + 0.02)) continue;
    const oy = original[id * 3 + 1];
    if (oy < d.crotch - 0.06) continue;
    const ax = Math.abs(original[id * 3]);
    const weight = (1 - smooth(0.03, 0.1, ax)) * smooth(d.crotch - 0.06, d.crotch - 0.01, oy);
    if (weight <= 0) continue;
    const k = Math.round(oy / SLICE);
    if (original[id * 3 + 2] < 0) {
      const limit = near(back, k);
      if (limit !== null && p[id * 3 + 2] > limit - 0.004) p[id * 3 + 2] += (limit - 0.004 - p[id * 3 + 2]) * weight;
    } else {
      const limit = near(front, k);
      if (limit !== null && p[id * 3 + 2] < limit + 0.004) p[id * 3 + 2] += (limit + 0.004 - p[id * 3 + 2]) * weight;
    }
  }
  for (let iteration = 0; iteration < 8; iteration += 1) {
    step(0.5);
    step(-0.52);
  }

  // Siempre por fuera de la piel, con más holgura hacia el bajo.
  for (let id = 0; id < n; id += 1) {
    if (!kind[id]) continue;
    const ox = original[id * 3];
    const oy = original[id * 3 + 1];
    const oz = original[id * 3 + 2];
    const nx = normal[id * 3];
    const ny = normal[id * 3 + 1];
    const nz = normal[id * 3 + 2];
    const ax = Math.abs(ox);
    let gap;
    if (kind[id] === 3) gap = 0.02 + 0.016 * smooth(d.crotch, d.thigh, oy) + (oz < 0 ? 0.008 : 0);
    else if (ax > d.shoulder) gap = 0.006 + 0.01 * smooth(d.shoulder, d.sleeve, ax);
    else gap = 0.009 + 0.016 * smooth(d.neck - (d.neck - d.hip) * 0.5, d.hip - 0.05, oy);
    const outward = (p[id * 3] - ox) * nx + (p[id * 3 + 1] - oy) * ny + (p[id * 3 + 2] - oz) * nz;
    if (outward < gap) {
      p[id * 3] += nx * (gap - outward);
      p[id * 3 + 1] += ny * (gap - outward);
      p[id * 3 + 2] += nz * (gap - outward);
    }
  }

  members.forEach((list, id) => list.forEach((i) => pos.setXYZ(i, p[id * 3], p[id * 3 + 1], p[id * 3 + 2])));
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  members.forEach((list) => {
    let x = 0;
    let y = 0;
    let z = 0;
    list.forEach((i) => {
      x += normals.getX(i);
      y += normals.getY(i);
      z += normals.getZ(i);
    });
    const length = Math.hypot(x, y, z) || 1;
    list.forEach((i) => normals.setXYZ(i, x / length, y / length, z / length));
  });
  return geometry;
}

// Cuerpo de jugador normal: los modelos gratuitos son de superhéroe. Se alisa la musculatura y se afina
// un poco el cuerpo; cara, manos y pies se quedan como están (con transición suave).
function normalizeBody(source, d) {
  const geometry = source.clone();
  const pos = geometry.attributes.position;
  const count = pos.count;
  geometry.computeVertexNormals();
  const nrm = geometry.attributes.normal;
  const keyOf = (i) => `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
  const ids = new Map();
  const unique = new Int32Array(count);
  const members = [];
  for (let i = 0; i < count; i += 1) {
    const key = keyOf(i);
    let id = ids.get(key);
    if (id === undefined) {
      id = members.length;
      ids.set(key, id);
      members.push([]);
    }
    unique[i] = id;
    members[id].push(i);
  }
  const n = members.length;
  const p = new Float32Array(n * 3);
  const normal = new Float32Array(n * 3);
  members.forEach((list, id) => {
    const i = list[0];
    p[id * 3] = pos.getX(i);
    p[id * 3 + 1] = pos.getY(i);
    p[id * 3 + 2] = pos.getZ(i);
    let x = 0;
    let y = 0;
    let z = 0;
    list.forEach((j) => {
      x += nrm.getX(j);
      y += nrm.getY(j);
      z += nrm.getZ(j);
    });
    const length = Math.hypot(x, y, z) || 1;
    normal[id * 3] = x / length;
    normal[id * 3 + 1] = y / length;
    normal[id * 3 + 2] = z / length;
  });
  const lists = Array.from({ length: n }, () => new Set());
  const index = geometry.index.array;
  for (let t = 0; t < index.length; t += 3) {
    const a = unique[index[t]];
    const b = unique[index[t + 1]];
    const c = unique[index[t + 2]];
    lists[a].add(b).add(c);
    lists[b].add(a).add(c);
    lists[c].add(a).add(b);
  }
  const neighbours = lists.map((set) => [...set]);
  // Cuánto se toca cada punto: nada en la cabeza, las manos y los pies.
  const weight = new Float32Array(n);
  const slim = new Float32Array(n);
  for (let id = 0; id < n; id += 1) {
    const x = Math.abs(p[id * 3]);
    const y = p[id * 3 + 1];
    const keepHead = smoothStep(d.neckTop - 0.06, d.neckTop + 0.01, y);
    const keepHands = smoothStep(d.wrist - 0.1, d.wrist - 0.03, x) * (y > d.hip ? 1 : 0);
    const keepFeet = 1 - smoothStep(d.ankle, d.ankle + 0.08, y);
    const w = (1 - keepHead) * (1 - keepHands) * (1 - keepFeet);
    weight[id] = w;
    // Más en brazos y hombros, que es donde más se nota el superhéroe.
    const arms = y > d.hip && x > d.shoulder * 0.8 ? 1 : 0;
    slim[id] = w * (arms ? 0.011 : y > d.hip ? 0.008 : 0.006);
  }
  const step = (factor) => {
    const next = p.slice();
    for (let id = 0; id < n; id += 1) {
      const w = weight[id];
      if (w <= 0) continue;
      const list = neighbours[id];
      if (!list.length) continue;
      let x = 0;
      let y = 0;
      let z = 0;
      list.forEach((o) => {
        x += p[o * 3];
        y += p[o * 3 + 1];
        z += p[o * 3 + 2];
      });
      next[id * 3] += (x / list.length - p[id * 3]) * factor * w;
      next[id * 3 + 1] += (y / list.length - p[id * 3 + 1]) * factor * w;
      next[id * 3 + 2] += (z / list.length - p[id * 3 + 2]) * factor * w;
    }
    p.set(next);
  };
  for (let iteration = 0; iteration < 14; iteration += 1) {
    step(0.5);
    step(-0.53);
  }
  for (let id = 0; id < n; id += 1) {
    p[id * 3] -= normal[id * 3] * slim[id];
    p[id * 3 + 1] -= normal[id * 3 + 1] * slim[id];
    p[id * 3 + 2] -= normal[id * 3 + 2] * slim[id];
  }
  members.forEach((list, id) => list.forEach((i) => pos.setXYZ(i, p[id * 3], p[id * 3 + 1], p[id * 3 + 2])));
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  members.forEach((list) => {
    let x = 0;
    let y = 0;
    let z = 0;
    list.forEach((i) => {
      x += normals.getX(i);
      y += normals.getY(i);
      z += normals.getZ(i);
    });
    const length = Math.hypot(x, y, z) || 1;
    list.forEach((i) => normals.setXYZ(i, x / length, y / length, z / length));
  });
  return geometry;
}
const bodies = new Map();

// Medidas del cuerpo en reposo, en el espacio de la malla.
function measure(scene, mesh) {
  scene.updateMatrixWorld(true);
  const bone = (name) => mesh.worldToLocal(scene.getObjectByName(name).getWorldPosition(new THREE.Vector3()));
  const neck = bone("neck_01").y;
  const pelvis = bone("pelvis").y;
  const thigh = bone("thigh_l");
  const calf = bone("calf_l");
  const foot = bone("foot_l");
  const upper = bone("upperarm_l");
  const lower = bone("lowerarm_l");
  const hand = bone("hand_l");
  const shoulder = Math.abs(upper.x);
  return {
    neckTop: neck,
    neck: neck - (neck - pelvis) * 0.04,
    hip: pelvis + (neck - pelvis) * 0.08,
    thigh: thigh.y - (thigh.y - calf.y) * 0.42,
    knee: calf.y,
    ankle: foot.y,
    sleeve: shoulder + (Math.abs(lower.x) - shoulder) * 0.55,
    wrist: Math.abs(hand.x),
    shoulder,
    crotch: thigh.y - 0.1,
    pelvisY: pelvis,
    backBox: new THREE.Vector4(-shoulder * 0.9, pelvis + (neck - pelvis) * 0.35, shoulder * 1.8, (neck - pelvis) * 0.6),
  };
}

// La geometría de la ropa se calcula una vez por cuerpo y se comparte.
const garments = new Map();

const KIT_UNIFORMS = `
uniform float uKit, uSkin, uNeck, uHip, uThigh, uKnee, uAnkle, uSleeve, uWrist;
uniform vec3 uShirt, uShorts, uPads, uShoes, uWristband;
uniform float uHasWristband;
uniform sampler2D uBack;
uniform vec4 uBackBox;`;

function skinMaterial(material, uniforms) {
  const clone = material.clone();
  clone.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRest;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vRest;${KIT_UNIFORMS}`)
      .replace("#include <map_fragment>", `#include <map_fragment>
// Piel más clara u oscura sin perder las sombras del modelo.
diffuseColor.rgb = pow(diffuseColor.rgb, vec3(1.0 / uSkin));
float y = vRest.y;
float ax = abs(vRest.x);
// Debajo de la ropa, el cuerpo va del mismo color liso: si algo asoma, no se nota.
float shirt = step(uHip, y) * step(y, uNeck + 0.09 * smoothstep(0.06, 0.13, ax)) * step(ax, uSleeve);
float shorts = step(uThigh, y) * step(y, uHip + 0.02) * (1.0 - shirt);
float pads = step(uKnee - 0.06, y) * step(y, uKnee + 0.07);
float socks = step(uAnkle - 0.02, y) * step(y, uAnkle + 0.16);
float shoes = step(y, uAnkle - 0.02);
float sole = step(y, uAnkle - 0.085);
float band = uHasWristband * step(uWrist - 0.075, ax) * step(ax, uWrist - 0.02) * step(uNeck - 0.25, y);
vec3 kit = diffuseColor.rgb;
kit = mix(kit, uShirt, shirt * uKit);
kit = mix(kit, uShorts, shorts * uKit);
kit = mix(kit, uPads, pads);
kit = mix(kit, vec3(0.92), socks);
kit = mix(kit, uShoes, shoes);
kit = mix(kit, vec3(1.0, 0.22, 0.0), sole);
kit = mix(kit, uWristband, band);
diffuseColor.rgb = kit;`);
  };
  return clone;
}

function clothMaterial(uniforms) {
  const material = new THREE.MeshPhysicalMaterial({
    roughness: 0.82, sheen: 0.5, sheenRoughness: 0.55, sheenColor: new THREE.Color(0x5a5a5a), side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 restPos;\nvarying vec3 vRest;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = restPos;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vRest;${KIT_UNIFORMS}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
float ax = abs(vRest.x);
float neckline = uNeck + 0.09 * smoothstep(0.06, 0.13, ax) - (vRest.z > 0.0 ? 0.07 * (1.0 - smoothstep(0.0, 0.11, ax)) : 0.012);
bool inShirt = vRest.y >= uHip - 0.05 && vRest.y <= neckline && ax <= uSleeve;
bool isShorts = !inShirt && vRest.y >= uThigh && vRest.y <= uHip + 0.03;
if (uKit < 0.5 || (!inShirt && !isShorts)) discard;
diffuseColor.rgb = isShorts ? uShorts : uShirt;
vec3 orange = vec3(1.0, 0.22, 0.0);
// Dorsal y nombre en la espalda.
vec2 bu = vec2((vRest.x - uBackBox.x) / uBackBox.z, (vRest.y - uBackBox.y) / uBackBox.w);
if (!isShorts && vRest.z < 0.0 && bu.x > 0.0 && bu.x < 1.0 && bu.y > 0.0 && bu.y < 1.0) {
  vec4 number = texture2D(uBack, vec2(1.0 - bu.x, bu.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, number.rgb, number.a);
}
// Ribetes naranjas: cuello, puños, bajo de la camiseta y del pantalón.
if (!isShorts && vRest.y > neckline - 0.018 && ax < 0.13) diffuseColor.rgb = orange;
if (!isShorts && ax > uSleeve - 0.02) diffuseColor.rgb = orange;
if (!isShorts && vRest.y < uHip - 0.05 + 0.016) diffuseColor.rgb = orange;
if (isShorts && vRest.y < uThigh + 0.022) diffuseColor.rgb = orange;
// Sombra de la camiseta sobre el pantalón.
if (isShorts && vRest.y > uHip - 0.09) diffuseColor.rgb *= mix(1.0, 0.45, smoothstep(uHip - 0.09, uHip - 0.05, vRest.y));`);
  };
  return material;
}

// Pega una pieza (pelo, cejas, barba) al esqueleto del cuerpo, hueso a hueso por su nombre.
function attachPart(root, gltf, color) {
  const bones = {};
  root.traverse((object) => {
    if (object.isBone) bones[object.name] = object;
  });
  const meshes = [];
  gltf.scene.traverse((object) => {
    if (object.isSkinnedMesh) meshes.push(object);
  });
  return meshes.map((source) => {
    const mesh = new THREE.SkinnedMesh(source.geometry, source.material.clone());
    mesh.material.color.set(color);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const skeleton = new THREE.Skeleton(source.skeleton.bones.map((bone) => bones[bone.name]), source.skeleton.boneInverses);
    root.add(mesh);
    mesh.bind(skeleton, source.bindMatrix);
    return mesh;
  });
}

const CHAIN = [
  ["spine_01", "spine_02", "spine"],
  ["spine_02", "spine_03", "spine"],
  ["spine_03", "neck_01", "spine"],
  ["neck_01", "Head", "neck"],
  ["upperarm_l", "lowerarm_l", "upperarm", 0],
  ["lowerarm_l", "hand_l", "forearm", 0],
  ["upperarm_r", "lowerarm_r", "upperarm", 1],
  ["lowerarm_r", "hand_r", "forearm", 1],
  ["thigh_l", "calf_l", "thigh", 0],
  ["calf_l", "foot_l", "shin", 0],
  ["foot_l", "ball_l", "foot", 0],
  ["thigh_r", "calf_r", "thigh", 1],
  ["calf_r", "foot_r", "shin", 1],
  ["foot_r", "ball_r", "foot", 1],
];

const scratch = {
  a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), q3: new THREE.Quaternion(),
};

// Gira el hueso para que apunte (hacia su hijo) en la dirección pedida, en coordenadas del mundo.
function aimBone(bone, child, direction) {
  bone.getWorldPosition(scratch.a);
  child.getWorldPosition(scratch.b);
  const current = scratch.b.sub(scratch.a);
  if (current.lengthSq() < 1e-10) return;
  current.normalize();
  const delta = scratch.q.setFromUnitVectors(current, direction);
  const world = bone.getWorldQuaternion(scratch.q2);
  const wanted = delta.multiply(world);
  const parent = bone.parent.getWorldQuaternion(scratch.q3).invert();
  bone.quaternion.copy(parent.multiply(wanted));
  bone.updateMatrixWorld(true);
}

// Gira un hueso en el mundo alrededor de un eje.
function rotateWorld(bone, axis, angle) {
  if (!angle || axis.lengthSq() < 1e-10) return;
  const delta = scratch.q.setFromAxisAngle(axis, angle);
  const world = bone.getWorldQuaternion(scratch.q2);
  const wanted = delta.multiply(world);
  const parent = bone.parent.getWorldQuaternion(scratch.q3).invert();
  bone.quaternion.copy(parent.multiply(wanted));
  bone.updateMatrixWorld(true);
}

// Forma de las manos en cada gesto, sacada de fotos de técnica:
// - plataforma: una mano dentro de la otra, dedos cerrados y pulgares juntos apuntando abajo.
// - colocar: manos en copa sobre la frente, dedos abiertos y curvados, pulgares e índices en triángulo.
// - abierta: mano firme con la palma al balón (remate, saque). bloqueo: además dedos muy abiertos.
const HAND_SHAPES = {
  relajada: { orient: 0, curl: [0.35, 0.35, 0.25], spread: 0.04, thumb: null },
  plataforma: { orient: 1, curl: [0.45, 0.55, 0.35], spread: 0, thumb: "abajo" },
  colocar: { orient: 1, curl: [0.48, 0.52, 0.38], spread: 0.3, thumb: "triangulo" },
  abierta: { orient: 1, curl: [0.12, 0.1, 0.06], spread: 0.12, thumb: "abierto" },
  bloqueo: { orient: 1, curl: [0.08, 0.06, 0.04], spread: 0.3, thumb: "abierto" },
  puno: { orient: 0, curl: [1.5, 1.6, 1.3], spread: 0, thumb: "cerrado" },
};
const SHAPE_OF = {
  toques: "plataforma", recepcion: "plataforma", defensa: "plataforma",
  dedos: "colocar", colocacion: "colocar",
  remate: "abierta", saque: "abierta", brazos: "abierta",
  bloqueo: "bloqueo", puno: "puno",
};
const FINGERS = ["index", "middle", "ring", "pinky"];
// Forma de las manos en cada postura clave, cuando la calculo yo.
const SHAPE_OF_POSE = {
  reception: "plataforma", bumpReady: "plataforma", bumpHit: "plataforma", digLow: "plataforma", digDive: "plataforma",
  set: "colocar", setPush: "colocar",
  spikeLoad: "relajada", spikeRise: "abierta", spikeArm: "abierta", spikeHit: "abierta", spikeFollow: "abierta",
  serveToss: "abierta", serveHit: "abierta", serveFollow: "abierta",
  blockLoad: "relajada", block: "bloqueo", cheer: "abierta", fistLoad: "puno", fistPump: "puno",
};
// Mano con la que se toca el balón en cada gesto (índice), o las dos (null).
const STRIKES = { saque: 1, remate: 1 };

// Carga y viste un jugador. Devuelve un objeto con `group`, `pose()` y `handPoint()`.
export async function createRealPlayer(look, { number, name, position } = {}) {
  const female = look.build === "female";
  const hairName = hairFile(look);
  const [body, hair, brows, beard] = await Promise.all([
    load(female ? "chica" : "chico"),
    hairName ? load(hairName) : null,
    load(female ? "cejas-chica" : "cejas"),
    look.beard !== "none" && !female ? load("barba") : null,
  ]);
  const root = cloneSkinned(body.scene);
  let skin = null;
  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.frustumCulled = false;
    }
    if (object.isSkinnedMesh && /Superhero/.test(object.material.name)) skin = object;
  });

  const dims = measure(root, skin);
  // Cuerpo de jugador normal en vez de superhéroe (calculado una vez por cuerpo) y menos relieve muscular.
  const bodyKey = female ? "chica" : "chico";
  if (!bodies.has(bodyKey)) bodies.set(bodyKey, normalizeBody(skin.geometry, dims));
  skin.geometry = bodies.get(bodyKey);
  if (skin.material.normalMap) skin.material.normalScale = new THREE.Vector2(0.35, 0.35);
  const jersey = position === "Líbero" ? JERSEYS.libero : JERSEYS.home;
  const uniforms = {
    uKit: { value: 1 },
    uSkin: { value: SKIN_POWER[look.skin] ?? 1 },
    uShirt: { value: new THREE.Color(jersey.shirt) },
    uShorts: { value: new THREE.Color(jersey.shorts) },
    uPads: { value: new THREE.Color(accentHex(look.kneepads) ?? "#18181b") },
    uShoes: { value: new THREE.Color(accentHex(look.shoes) ?? "#ffffff") },
    uWristband: { value: new THREE.Color(accentHex(look.wristbands) ?? "#ffffff") },
    uHasWristband: { value: accentHex(look.wristbands) ? 1 : 0 },
    uNeck: { value: dims.neck },
    uHip: { value: dims.hip },
    uThigh: { value: dims.thigh },
    uKnee: { value: dims.knee },
    uAnkle: { value: dims.ankle },
    uSleeve: { value: dims.sleeve },
    uWrist: { value: dims.wrist },
    uBack: { value: backTexture(number, name, jersey) },
    uBackBox: { value: dims.backBox },
  };
  skin.material = skinMaterial(skin.material, uniforms);

  const garmentKey = female ? "chica" : "chico";
  if (!garments.has(garmentKey)) garments.set(garmentKey, drapeGarment(skin.geometry, dims));
  const shell = new THREE.SkinnedMesh(garments.get(garmentKey), clothMaterial(uniforms));
  shell.castShadow = true;
  shell.receiveShadow = true;
  shell.frustumCulled = false;
  skin.parent.add(shell);
  shell.bind(skin.skeleton, skin.bindMatrix);

  const color = hairHex(look.hair_color);
  if (hair) attachPart(root, hair, color);
  attachPart(root, brows, color);
  if (beard) attachPart(root, beard, color);

  const group = new THREE.Group();
  group.add(root);

  const bones = {};
  root.traverse((object) => {
    if (object.isBone) bones[object.name] = object;
  });
  const rest = new Map(Object.values(bones).map((bone) => [bone, { q: bone.quaternion.clone(), p: bone.position.clone() }]));
  root.updateMatrixWorld(true);
  const pelvisRest = bones.pelvis.getWorldPosition(new THREE.Vector3());
  const restHeight = root.worldToLocal(pelvisRest.clone()).y;
  // Las posturas están hechas para 1,75 m con la pelvis a 0,95 m.
  const scale = restHeight / 0.95;
  const smooth = new Map();
  const toWorld = new THREE.Quaternion();
  const direction = new THREE.Vector3();
  // Del espacio de las posturas (delante es -z) al del modelo (delante es +z): media vuelta.
  const dirOf = (from, to) => direction.set(-(to.x - from.x), to.y - from.y, -(to.z - from.z)).normalize().applyQuaternion(toWorld);
  // Un vector de las posturas (delante es -z) en el mundo.
  const poseVector = (x, y, z) => new THREE.Vector3(-x, y, -z).normalize().applyQuaternion(toWorld);
  const sides = ["l", "r"];
  const world = (name) => bones[name].getWorldPosition(new THREE.Vector3());

  // Ejes de la mano: hacia dónde apuntan los dedos y hacia dónde mira la palma.
  function handFrame(side) {
    const s = sides[side];
    const hand = world(`hand_${s}`);
    const fingers = world(`middle_01_${s}`).sub(hand).normalize();
    const across = world(`index_01_${s}`).sub(world(`pinky_01_${s}`));
    const palm = new THREE.Vector3().crossVectors(across, fingers).normalize().multiplyScalar(palmSign[side]);
    return { fingers, palm, hand };
  }
  // En la postura en cruz del modelo las palmas miran al suelo: así se sabe qué lado es la palma.
  const palmSign = [1, 1];
  group.updateMatrixWorld(true);
  [0, 1].forEach((side) => {
    palmSign[side] = handFrame(side).palm.y > 0 ? -1 : 1;
  });
  // La cara mira a +z en reposo: se guarda esa dirección vista desde el hueso de la cabeza.
  const headRest = bones.Head.getWorldQuaternion(new THREE.Quaternion()).invert();
  const faceLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(headRest);
  const hands = [0, 1].map(() => ({ curl: [0.35, 0.35, 0.25], spread: 0.04, orient: 0, thumb: null }));
  // Largo del brazo y del antebrazo, para colocar las manos donde toca.
  const armLengths = [
    world("upperarm_l").distanceTo(world("lowerarm_l")),
    world("lowerarm_l").distanceTo(world("hand_l")),
  ];

  // Gira la mano entera para que dedos y palma apunten donde se pide (con un peso de 0 a 1).
  function orientHand(side, fingersWanted, palmWanted, weight) {
    if (weight <= 0.01) return;
    const current = handFrame(side);
    const basis = (f, p) => {
      const x = f.clone().normalize();
      const y = p.clone().addScaledVector(x, -p.dot(x)).normalize();
      return new THREE.Matrix4().makeBasis(x, y, new THREE.Vector3().crossVectors(x, y));
    };
    const from = basis(current.fingers, current.palm);
    const to = basis(fingersWanted, palmWanted);
    const delta = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
    const partial = new THREE.Quaternion().slerp(delta, weight);
    const bone = bones[`hand_${sides[side]}`];
    const wanted = partial.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wanted));
    bone.updateMatrixWorld(true);
  }

  function shapeFingers(side, state, thumbWanted) {
    const s = sides[side];
    const { palm } = handFrame(side);
    const middleBase = world(`middle_01_${s}`);
    FINGERS.forEach((finger) => {
      for (let joint = 1; joint <= 3; joint += 1) {
        const bone = bones[`${finger}_0${joint}_${s}`];
        const child = bones[joint === 3 ? `${finger}_04_leaf_${s}` : `${finger}_0${joint + 1}_${s}`];
        if (!bone || !child) continue;
        const along = world(child.name).sub(world(bone.name)).normalize();
        if (joint === 1 && finger !== "middle" && state.spread) {
          // Dedos abiertos: cada uno se separa del corazón.
          const away = world(bone.name).sub(middleBase);
          const axis = new THREE.Vector3().crossVectors(along, away).normalize();
          rotateWorld(bone, axis, state.spread * (finger === "ring" ? 0.5 : 1));
        }
        // Doblar el dedo hacia la palma.
        const dir = world(child.name).sub(world(bone.name)).normalize();
        rotateWorld(bone, new THREE.Vector3().crossVectors(dir, palm).normalize(), state.curl[joint - 1]);
      }
    });
    if (thumbWanted) {
      [["thumb_01", "thumb_02"], ["thumb_02", "thumb_03"], ["thumb_03", "thumb_04_leaf"]].forEach(([a, b]) => {
        const bone = bones[`${a}_${s}`];
        const child = bones[`${b}_${s}`];
        if (bone && child) aimBone(bone, child, thumbWanted.clone());
      });
    }
  }

  function poseHands(shapeName, points, immediate = false) {
    const shape = HAND_SHAPES[shapeName] ?? HAND_SHAPES.relajada;
    [0, 1].forEach((side) => {
      const state = hands[side];
      // En la plataforma la mano de abajo (derecha) envuelve con los dedos a la de arriba, que va casi estirada.
      let curlWanted = shape.curl;
      if (shapeName === "plataforma") curlWanted = side === 1 ? [0.95, 1.05, 0.75] : [0.25, 0.3, 0.2];
      // Cambio suave de una forma a otra (o directo, al calcular una postura fija).
      const k = immediate ? 1 : 0.3;
      state.curl = state.curl.map((value, index) => value + (curlWanted[index] - value) * k);
      state.spread += (shape.spread - state.spread) * k;
      state.orient += (shape.orient - state.orient) * k;
      const inward = side === 0 ? 1 : -1;
      const forearm = dirOf(points.elbows[side], points.hands[side]).clone();
      const up = poseVector(0, 1, 0);
      let fingersWanted = forearm;
      let palmWanted = null;
      if (shapeName === "plataforma") {
        // Una mano en la otra con las palmas hacia arriba; las dos apuntan por el centro, así no se cruzan.
        const both = dirOf(points.elbows[0], points.hands[0]).clone().add(dirOf(points.elbows[1], points.hands[1]).clone());
        fingersWanted = both.normalize().addScaledVector(up, -0.25).normalize();
        palmWanted = poseVector(inward * 0.15, 1, 0);
      } else if (shapeName === "colocar") {
        // Copa sobre la frente: dedos hacia arriba y atrás, palmas al balón (arriba y delante).
        fingersWanted = poseVector(-inward * 0.3, 1, 0.45);
        palmWanted = poseVector(inward * 0.4, 0.45, -0.8);
      } else if (shape.orient > 0) {
        palmWanted = poseVector(0, 0.1, -1);
      }
      if (palmWanted) orientHand(side, fingersWanted, palmWanted, state.orient);

      let thumb = null;
      if (shape.thumb) {
        const { fingers, palm, hand } = handFrame(side);
        const across = world(`thumb_01_${sides[side]}`).sub(hand);
        const thumbSide = across.addScaledVector(fingers, -across.dot(fingers)).normalize();
        if (shape.thumb === "abajo") thumb = fingers.clone().multiplyScalar(0.85).addScaledVector(up, -0.35).addScaledVector(palm, 0.35).addScaledVector(thumbSide, -0.15).normalize();
        else if (shape.thumb === "triangulo") thumb = poseVector(inward, -0.45, 0.35).addScaledVector(palm, 0.25).normalize();
        else if (shape.thumb === "abierto") thumb = thumbSide.clone().multiplyScalar(0.7).addScaledVector(fingers, 0.6).normalize();
        else thumb = palm.clone().multiplyScalar(0.6).addScaledVector(fingers, 0.5).addScaledVector(thumbSide, -0.3).normalize();
      }
      shapeFingers(side, state, thumb);
    });
  }

  // La cabeza (y algo el cuello) mira al punto que se le pide, sin pasarse de giro.
  function lookAt(target) {
    if (!target) return;
    const head = bones.Head;
    const from = head.getWorldPosition(new THREE.Vector3());
    const wanted = target.clone().sub(from).normalize();
    const current = faceLocal.clone().applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const angle = current.angleTo(wanted);
    if (angle < 0.01) return;
    const limited = Math.min(angle, 1.1);
    const axis = new THREE.Vector3().crossVectors(current, wanted).normalize();
    rotateWorld(bones.neck_01, axis, limited * 0.35);
    const now = faceLocal.clone().applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const left = Math.min(now.angleTo(wanted), 1.1 - limited * 0.35);
    rotateWorld(head, new THREE.Vector3().crossVectors(now, wanted).normalize(), left);
  }

  function resetToRest() {
    rest.forEach((value, bone) => {
      bone.quaternion.copy(value.q);
      bone.position.copy(value.p);
    });
    root.updateMatrixWorld(true);
  }

  // Coloca el esqueleto según unos puntos del cuerpo (posturas calculadas).
  function solve(points, shapeName, immediate = false) {
    resetToRest();
    const pelvisTarget = new THREE.Vector3(-points.pelvis.x * scale, (points.pelvis.y + points.jump) * scale, -points.pelvis.z * scale);
    const wantedWorld = root.localToWorld(pelvisTarget);
    bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(wantedWorld));
    root.updateMatrixWorld(true);
    group.getWorldQuaternion(toWorld);
    const platform = shapeName === "plataforma";
    const setting = shapeName === "colocar";
    // Colocación: cada mano a un lado del balón y el codo calculado para llegar (abierto, hacia fuera y abajo).
    const elbowsAt = [null, null];
    if (setting) {
      const middle = points.hands[0].clone().lerp(points.hands[1], 0.5);
      const ballCenter = root.localToWorld(new THREE.Vector3(-middle.x * scale, (middle.y + points.jump) * scale - 0.07, -middle.z * scale + 0.06));
      [0, 1].forEach((side) => {
        const outward = side === 0 ? -1 : 1;
        const shoulder = bones[`upperarm_${sides[side]}`].getWorldPosition(new THREE.Vector3());
        const target = ballCenter.clone().add(poseVector(outward, -0.15, 0.1).multiplyScalar(0.12));
        const toTarget = target.clone().sub(shoulder);
        const reach = Math.min(toTarget.length(), armLengths[0] + armLengths[1] - 0.001);
        const along = toTarget.normalize();
        const a = (armLengths[0] ** 2 - armLengths[1] ** 2 + reach ** 2) / (2 * reach);
        const h = Math.sqrt(Math.max(0, armLengths[0] ** 2 - a ** 2));
        const pole = poseVector(outward, -0.6, 0.15);
        pole.addScaledVector(along, -pole.dot(along)).normalize();
        const elbow = shoulder.clone().addScaledVector(along, a).addScaledVector(pole, h);
        elbowsAt[side] = { elbow, hand: shoulder.clone().addScaledVector(along, reach) };
      });
    }
    let meeting = null;
    if (platform) {
      const middle = points.hands[0].clone().lerp(points.hands[1], 0.5);
      meeting = root.localToWorld(new THREE.Vector3(-middle.x * scale, (middle.y + points.jump) * scale, -middle.z * scale));
      // Hombros hacia delante y hacia dentro: así los antebrazos quedan pegados.
      [0, 1].forEach((side) => {
        const clavicle = bones[`clavicle_${sides[side]}`];
        const arm = bones[`upperarm_${sides[side]}`];
        if (!clavicle || !arm) return;
        const outward = side === 0 ? -1 : 1;
        aimBone(clavicle, arm, poseVector(outward * 0.85, 0.08, -0.35));
      });
    }
    // Cada mano justo al lado de la otra; el punto se aleja hacia delante y abajo hasta donde llega
    // el brazo estirado, así no se pasa al otro lado ni se cruzan.
    const armTarget = (side) => {
      const shoulder = bones[`upperarm_${sides[side]}`].getWorldPosition(new THREE.Vector3());
      const length = armLengths[0] + armLengths[1];
      const start = meeting.clone().add(poseVector(side === 0 ? -1 : 1, 0, 0).multiplyScalar(0.03)).add(new THREE.Vector3(0, side === 0 ? 0.015 : 0, 0));
      const away = poseVector(0, -0.45, -1);
      const offset = start.clone().sub(shoulder);
      // |offset + away·t| = largo del brazo
      const b = 2 * offset.dot(away);
      const c = offset.lengthSq() - length * length;
      const t = Math.max(0, (-b + Math.sqrt(Math.max(0, b * b - 4 * c))) / 2);
      return start.addScaledVector(away, t).sub(shoulder).normalize();
    };
    CHAIN.forEach(([name, childName, part, side]) => {
      const bone = bones[name];
      const child = bones[childName];
      if (!bone || !child) return;
      let target;
      if (platform && (part === "upperarm" || part === "forearm")) target = armTarget(side);
      else if (setting && part === "upperarm") target = elbowsAt[side].elbow.clone().sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
      else if (setting && part === "forearm") target = elbowsAt[side].hand.clone().sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
      else if (part === "spine") target = dirOf(points.pelvis, points.chest);
      else if (part === "neck") target = dirOf(points.chest, points.head);
      else if (part === "upperarm") target = dirOf(points.shoulders[side], points.elbows[side]);
      else if (part === "forearm") target = dirOf(points.elbows[side], points.hands[side]);
      else if (part === "thigh") target = dirOf(points.hips[side], points.knees[side]);
      else if (part === "shin") target = dirOf(points.knees[side], points.feet[side]);
      else {
        const lift = Math.max(0, points.feet[side].y - 0.06);
        target = direction.set(0, -0.35 - lift * 2.5, 1).normalize().applyQuaternion(toWorld);
      }
      aimBone(bone, child, target.clone());
    });
    poseHands(shapeName, points, immediate);
  }

  // ---------- Posturas guardadas ----------
  // Una postura guardada es el giro de cada hueso (y la posición de la pelvis), relativo a su padre.
  const SAVED_BONES = Object.keys(bones).filter((name) => name !== "root");
  function takeSnapshot() {
    const snapshot = { bones: {}, pelvis: bones.pelvis.position.toArray().map((v) => +v.toFixed(5)) };
    SAVED_BONES.forEach((name) => {
      snapshot.bones[name] = bones[name].quaternion.toArray().map((v) => +v.toFixed(5));
    });
    return snapshot;
  }
  function applySnapshot(snapshot) {
    resetToRest();
    Object.entries(snapshot.bones).forEach(([name, values]) => {
      if (bones[name]) bones[name].quaternion.fromArray(values);
    });
    if (snapshot.pelvis) bones.pelvis.position.fromArray(snapshot.pelvis);
    root.updateMatrixWorld(true);
  }
  // Postura calculada por mí (si no hay una tuya guardada), una vez por postura.
  const computed = new Map();
  function computedKeyPose(name) {
    if (!computed.has(name)) {
      group.updateMatrixWorld(true);
      solve(keyPosePoints(name), SHAPE_OF_POSE[name] ?? SHAPE_OF_POSE[baseOf(name)] ?? "relajada", true);
      computed.set(name, { ...takeSnapshot(), computed: true });
    }
    return computed.get(name);
  }
  // El editor puede probar posturas sin guardarlas todavía.
  const overrides = {};
  const keyPose = (name) => overrides[name] ?? savedGestures[name] ?? computedKeyPose(name);

  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  // Eje de cada hueso (hacia su hijo), en su propio espacio: para separar "dirección" de "giro sobre sí".
  const twistAxis = new Map();
  Object.values(bones).forEach((bone) => {
    const child = bone.children.find((object) => object.isBone);
    if (child && child.position.lengthSq() > 1e-10) twistAxis.set(bone.name, child.position.clone().normalize());
  });
  function splitTwist(q, axis) {
    const projection = axis.clone().multiplyScalar(q.x * axis.x + q.y * axis.y + q.z * axis.z);
    const twist = new THREE.Quaternion(projection.x, projection.y, projection.z, q.w);
    if (twist.lengthSq() < 1e-12) twist.identity();
    else twist.normalize();
    const swing = q.clone().multiply(twist.clone().invert());
    return [swing, twist];
  }
  // Mezcla dos posturas (de 0 a 1) y sube el cuerpo con el salto.
  function blendKeyPoses(fromName, toName, t, jump) {
    const from = keyPose(fromName);
    const to = keyPose(toName);
    resetToRest();
    const keepTwist = Boolean(from.computed) !== Boolean(to.computed) ? (from.computed ? "to" : "from") : null;
    SAVED_BONES.forEach((name) => {
      const a = from.bones[name];
      const b = to.bones[name];
      if (!a && !b) return;
      qa.fromArray(a ?? b);
      qb.fromArray(b ?? a);
      const axis = twistAxis.get(name);
      if (!keepTwist || !axis) {
        bones[name].quaternion.copy(qa.slerp(qb, t));
        return;
      }
      // Dirección mezclada; giro sobre sí, el de la postura tuya.
      const [swingA] = splitTwist(qa, axis);
      const [swingB, twistB] = splitTwist(qb, axis);
      const [, twistA] = splitTwist(qa, axis);
      const twist = keepTwist === "from" ? twistA : twistB;
      bones[name].quaternion.copy(swingA.slerp(swingB, t).multiply(twist));
    });
    const pa = new THREE.Vector3().fromArray(from.pelvis);
    const pb = new THREE.Vector3().fromArray(to.pelvis);
    bones.pelvis.position.copy(pa.lerp(pb, t));
    root.updateMatrixWorld(true);
    if (jump) {
      const worldPelvis = bones.pelvis.getWorldPosition(new THREE.Vector3());
      worldPelvis.y += jump * scale;
      bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(worldPelvis));
      root.updateMatrixWorld(true);
    }
  }

  function pose(options) {
    const action = options.action;
    const timeline = action ? actionTimeline(action.action, action.progress) : null;
    if (timeline) {
      // Los gestos se hacen con las posturas clave (las tuyas si las has guardado).
      blendKeyPoses(timeline.from, timeline.to, timeline.t, timeline.jump);
      // Lo que se calcula entre frames (como andar) sigue teniendo dónde empezar.
      posePoints(smooth, options);
    } else {
      const points = posePoints(smooth, options);
      solve(points, "relajada");
    }
    lookAt(options.lookAt);
    return action ? STRIKES[action.action] ?? null : null;
  }

  // Punto de la plataforma de antebrazos (cerca de las muñecas), donde bota el balón en los toques.
  function platformPoint() {
    const point = (side) => world(`lowerarm_${sides[side]}`).lerp(world(`hand_${sides[side]}`), 0.78);
    return point(0).lerp(point(1), 0.5);
  }

  // Punto de la mano (un poco hacia los dedos), en el mundo: ahí va el balón.
  function handPoint(index) {
    const hand = bones[index === 0 ? "hand_l" : "hand_r"];
    const fingers = bones[index === 0 ? "middle_01_l" : "middle_01_r"];
    const a = hand.getWorldPosition(new THREE.Vector3());
    const b = fingers.getWorldPosition(new THREE.Vector3());
    return a.lerp(b, 0.8);
  }

  // Lo que necesita el editor de gestos.
  const editor = {
    bones, rest, takeSnapshot, applySnapshot, computedKeyPose, keyPose, resetToRest, rotateWorld,
    handFrame, world, sides, scale, root, overrides, saved: savedGestures,
    // Dedos de una mano: `curl` dobla y `spread` abre, sobre la postura que haya ahora.
    shapeHand(side, curl, spread) {
      const s = sides[side];
      FINGERS.forEach((finger) => {
        for (let joint = 1; joint <= 3; joint += 1) {
          const bone = bones[`${finger}_0${joint}_${s}`];
          if (bone) bone.quaternion.copy(rest.get(bone).q);
        }
      });
      root.updateMatrixWorld(true);
      shapeFingers(side, { curl: [1.35 * curl, 1.6 * curl, 1.05 * curl], spread }, null);
    },
    // Cuánto están cerrados ahora los dedos (de 0 a 1) y cuánto abiertos, para que la barra empiece ahí.
    handState(side) {
      const s = sides[side];
      const { fingers, palm } = handFrame(side);
      let bend = 0;
      let count = 0;
      ["index", "middle", "ring", "pinky"].forEach((finger) => {
        const a = world(`${finger}_01_${s}`);
        const tip = world(`${finger}_04_leaf_${s}`);
        const dir = tip.sub(a).normalize();
        bend += Math.atan2(dir.dot(palm), dir.dot(fingers));
        count += 1;
      });
      const curl = Math.min(1, Math.max(0, bend / count / 2.6));
      const spreadNow = world(`index_04_leaf_${s}`).distanceTo(world(`pinky_04_leaf_${s}`));
      return { curl: +curl.toFixed(2), spread: +Math.min(0.5, Math.max(0, (spreadNow - 0.06) * 2)).toFixed(2) };
    },
  };

  return { real: true, group, pose, handPoint, platformPoint, look, build: { height: 1 }, editor };
}
