// Editor de gestos: herramienta solo para el ordenador (npm run dev). No forma parte de la app.
// Tocas una parte del cuerpo y la mueves con barras (adelante/atrás, a los lados, arriba/abajo, girar).
// Lo guardado va a tools/editor-gestos/gestures.json, que es lo que luego usan el perfil y la pizarra.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { studioLighting } from "@/app/character/character3D.js";
import { DEFAULT_DURATIONS, baseOf, customTimes, gestureDuration, gestureKeys, gesturePlan, labelOf } from "@/app/character/gestureTimes.js";
import { lookFromSeed } from "@/app/character/looks.js";
import { createRealPlayer } from "./realPlayer.js";

// Al guardar cambia gestures.json: sin esto la página se recargaría y perderías lo que estás haciendo.
if (import.meta.hot) import.meta.hot.accept(["/tools/editor-gestos/realPlayer.js", "/src/app/character/gestureTimes.js", "/src/app/character/character3D.js"], () => {});

const GESTURES = {
  recepcion: "Recepción",
  colocacion: "Colocación",
  remate: "Remate",
  saque: "Saque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  toques: "Toques de antebrazo (perfil)",
  dedos: "Toques de dedos (perfil)",
  brazos: "Celebración: brazos arriba",
  puno: "Celebración: puño",
};
const KEY_NAMES = {
  stand: "De pie", ready: "Espera", reception: "Recepción", set: "Colocación: preparar", setPush: "Colocación: empujar",
  blockLoad: "Bloqueo: agacharse", block: "Bloqueo: arriba", spikeLoad: "Remate: batida", spikeRise: "Remate: impulso", spikeArm: "Remate: armar brazo",
  spikeHit: "Remate: golpe", spikeFollow: "Remate: final", land: "Caída", serveToss: "Saque: lanzar", serveHit: "Saque: golpe",
  serveFollow: "Saque: final", digLow: "Defensa: abajo", digDive: "Defensa: plancha", bumpReady: "Antebrazos: preparar",
  bumpHit: "Antebrazos: golpe", cheer: "Brazos arriba", fistLoad: "Puño: preparar", fistPump: "Puño: golpe",
};
const nameOf = (key) => KEY_NAMES[key] ?? labelOf(key) ?? key;
const isExtra = (key) => key.startsWith("extra_");

const CENTER_PARTS = [
  ["pelvis", "Cadera ↑ (tronco)"], ["pelvis_legs", "Cadera ↓ (piernas)"], ["spine_01", "Tronco bajo"], ["spine_02", "Tronco medio"], ["spine_03", "Pecho"], ["neck_01", "Cuello"], ["Head", "Cabeza"],
];
const SIDE_PARTS = [
  ["clavicle", "Hombro"], ["upperarm", "Brazo"], ["lowerarm", "Antebrazo"], ["hand", "Mano"], ["thumb_01", "Pulgar"],
  ["thigh", "Muslo"], ["calf", "Pierna"], ["foot", "Pie"],
];
const PLATFORM = ["reception", "bumpReady", "bumpHit", "digLow", "digDive"];
const SETTING = ["set", "setPush"];
const DEG = Math.PI / 180;

// Qué barras salen para cada parte. Cada barra gira alrededor de un eje del jugador (x: de lado a lado,
// y: de pies a cabeza, z: de espalda a pecho) o de su propio largo ("largo"). `sign` da el sentido de la barra.
function controlsFor(name) {
  const base = name.replace(/_(l|r)$/, "");
  if (name === "pelvis_legs") {
    return [
      { label: "Girar piernas", axis: "y", sign: 1 },
      { label: "Piernas atrás ↔ adelante", axis: "x", sign: -1 },
      { label: "Inclinar a un lado", axis: "z", sign: 1 },
    ];
  }
  if (name === "pelvis") {
    return [
      { label: "Girar cadera", axis: "y", sign: 1 },
      { label: "Echar atrás ↔ adelante", axis: "x", sign: 1 },
      { label: "Inclinar a un lado", axis: "z", sign: 1 },
      { label: "Bajar ↔ Subir", move: "y", min: -0.5, max: 0.3, step: 0.005, unit: "m" },
      { label: "Atrás ↔ Adelante", move: "z", min: -0.4, max: 0.4, step: 0.005, unit: "m" },
    ];
  }
  if (["spine_01", "spine_02", "spine_03", "neck_01", "Head"].includes(base)) {
    return [
      { label: "Atrás ↔ Adelante", axis: "x", sign: 1 },
      { label: "Inclinar a un lado", axis: "z", sign: 1 },
      { label: "Girar", axis: "y", sign: 1 },
    ];
  }
  if (base === "clavicle") {
    return [
      { label: "Atrás ↔ Adelante", axis: "y", sign: -1 },
      { label: "Abajo ↔ Arriba", axis: "z", sign: 1 },
    ];
  }
  if (base === "foot") {
    return [
      { label: "Punta abajo ↔ arriba", axis: "x", sign: -1 },
      { label: "Hacia dentro ↔ fuera", axis: "y", sign: 1 },
    ];
  }
  return [
    { label: "Atrás ↔ Adelante", axis: "x", sign: -1 },
    { label: "Dentro ↔ Fuera", axis: "z", sign: 1 },
    { label: "Girar sobre sí", axis: "largo", sign: 1 },
  ];
}

const stage = document.getElementById("stage");
const panel = document.getElementById("panel");
const status = (text) => { document.getElementById("status").textContent = text; };

// ---------- Escena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a0d08);
studioLighting(renderer, scene, 0.8);
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2a22, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(2, 5, 4);
scene.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshStandardMaterial({ color: 0xc46a35, roughness: 0.85 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const camera = new THREE.PerspectiveCamera(35, 1, 0.02, 60);
camera.position.set(1.6, 1.5, 3.2);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 1, 0);
orbit.enableDamping = true;

// Balón de referencia para colocar bien las manos.
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 20), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }));
ball.visible = false;
scene.add(ball);

const resize = () => {
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  camera.aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(stage);
resize();

// ---------- Estado ----------
const state = {
  build: "male", gesture: "recepcion", pose: "reception", part: null, playing: false, linked: true,
  drafts: {}, deleted: new Set(), history: [], values: [], base: null, dirty: false,
};
let rig = null;
const markers = new Map();
// Para revisar desde la consola si algo no cuadra.
window.editorGestos = { get rig() { return rig; }, state, camera, get orbit() { return orbit; }, selectPart: (name) => selectPart(name) };

async function loadRig() {
  status("Cargando jugador…");
  if (rig) scene.remove(rig.group);
  const look = { ...lookFromSeed("editor", state.build === "female"), hair: "raya", hair_color: "castano" };
  rig = await createRealPlayer(look, { number: 7, name: "Gestos" });
  scene.add(rig.group);
  rig.group.updateMatrixWorld(true);
  markers.forEach((marker) => scene.remove(marker));
  markers.clear();
  pickableBones().forEach((name) => {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false }));
    marker.renderOrder = 20;
    marker.userData.bone = name;
    scene.add(marker);
    markers.set(name, marker);
  });
  Object.assign(rig.editor.overrides, state.drafts);
  openPose(state.pose);
}

function pickableBones() {
  const names = CENTER_PARTS.map(([name]) => name).filter((name) => rig.editor.bones[name]);
  ["l", "r"].forEach((side) => SIDE_PARTS.forEach(([name]) => {
    if (rig.editor.bones[`${name}_${side}`]) names.push(`${name}_${side}`);
  }));
  return names;
}

// ---------- Posturas ----------
function currentSnapshot() {
  const snapshot = rig.editor.takeSnapshot();
  if (ball.visible) snapshot.ball = rig.editor.root.worldToLocal(ball.position.clone()).toArray().map((value) => +value.toFixed(4));
  return snapshot;
}

function storeDraft() {
  if (!rig || !state.pose || !state.dirty) return;
  state.drafts[state.pose] = currentSnapshot();
  rig.editor.overrides[state.pose] = state.drafts[state.pose];
  state.dirty = false;
  rememberDrafts();
}

const DRAFTS_KEY = "editor-gestos-borradores";
function rememberDrafts() {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify({ drafts: state.drafts, deleted: [...state.deleted], times: state.timesDirty ? customTimes : null }));
  } catch {
    // Sin almacenamiento, los cambios sin guardar solo viven mientras no se recargue.
  }
}
function recoverDrafts() {
  try {
    const stored = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? "null");
    if (stored?.drafts) state.drafts = stored.drafts;
    if (stored?.deleted) state.deleted = new Set(stored.deleted);
    if (stored?.times) {
      Object.keys(customTimes).forEach((key) => delete customTimes[key]);
      Object.assign(customTimes, stored.times);
      state.timesDirty = true;
    }
  } catch {
    // Nada que recuperar.
  }
}

function defaultBall(poseName) {
  const e = rig.editor;
  if (PLATFORM.includes(poseName)) {
    const point = e.world("lowerarm_l").lerp(e.world("hand_l"), 0.78).lerp(e.world("lowerarm_r").lerp(e.world("hand_r"), 0.78), 0.5);
    return point.add(new THREE.Vector3(0, 0.16, 0));
  }
  if (SETTING.includes(poseName)) return e.world("Head").add(new THREE.Vector3(0, 0.3, 0.12));
  return null;
}

function stopPlaying() {
  if (!state.playing) return;
  state.playing = false;
  status("Listo.");
}

function openPose(poseName) {
  stopPlaying();
  storeDraft();
  state.pose = poseName;
  state.history = [];
  const snapshot = state.drafts[poseName] ?? (state.deleted.has(poseName) ? rig.editor.computedKeyPose(poseName) : rig.editor.keyPose(poseName));
  rig.editor.applySnapshot(snapshot);
  const ballAt = snapshot.ball ? rig.editor.root.localToWorld(new THREE.Vector3().fromArray(snapshot.ball)) : defaultBall(poseName);
  ball.visible = Boolean(ballAt);
  if (ballAt) ball.position.copy(ballAt);
  selectPart(state.part);
}

function pushHistory() {
  state.history.push(currentSnapshot());
  if (state.history.length > 60) state.history.shift();
}

// Al elegir una parte, las barras empiezan en 0 sobre la postura que haya en ese momento.
function selectPart(name) {
  if (state.playing) {
    stopPlaying();
    openPose(state.pose);
    return selectPart(name);
  }
  storeDraft();
  state.part = name;
  state.base = rig ? currentSnapshot() : null;
  state.ballBase = ball.position.clone();
  state.values = name ? (name === "ball" ? [0, 0, 0] : controlsFor(name).map(() => 0)) : [];
  // Las barras de los dedos empiezan donde están ahora los dedos.
  const hand = name && name.startsWith("hand_") && rig ? rig.editor.handState(name.endsWith("_l") ? 0 : 1) : { curl: 0, spread: 0 };
  state.fingers = [[hand.curl, hand.spread], [hand.curl, hand.spread]];
  state.fingersStart = [hand.curl, hand.spread];
  state.touched = false;
  const lit = name === "pelvis_legs" ? "pelvis" : name;
  markers.forEach((marker, bone) => marker.material.color.set(bone === lit || bone === partnerOf(name) && state.linked ? 0xff3800 : 0xfacc15));
  render();
}

const partnerOf = (name) => (name && /_(l|r)$/.test(name) ? name.replace(/_(l|r)$/, (match) => (match === "_l" ? "_r" : "_l")) : null);

// Ejes del jugador en el mundo (el jugador mira a +z; su izquierda es +x).
const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

function axisFor(bone, control) {
  if (control.axis !== "largo") return AXES[control.axis].clone();
  const child = bone.children.find((object) => object.isBone);
  if (!child) return AXES.y.clone();
  return child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
}

// Aplica las barras a la parte elegida (y a la del otro lado, en espejo, si están unidas).
function applyControls() {
  const editor = rig.editor;
  editor.applySnapshot(state.base);
  if (state.part === "ball") {
    ball.position.copy(state.ballBase).add(new THREE.Vector3(state.values[0], state.values[1], state.values[2]));
    return;
  }
  const controls = controlsFor(state.part);
  const targets = [[state.part]];
  const partner = partnerOf(state.part);
  if (state.linked && partner && editor.bones[partner]) targets.push([partner]);
  targets.forEach(([name]) => {
    const lower = name === "pelvis_legs";
    const bone = editor.bones[lower ? "pelvis" : name];
    // Cadera hacia abajo: el tronco se queda como estaba y se mueven las piernas.
    const spine = lower ? editor.bones.spine_01 : null;
    const spineQ = spine ? spine.getWorldQuaternion(new THREE.Quaternion()) : null;
    // El lado derecho es el espejo del izquierdo: la izquierda del jugador es +x, así que "fuera" cambia de signo.
    const sideSign = name.endsWith("_r") ? -1 : 1;
    const legs = name === "pelvis" && !lower ? ["l", "r"].map((side) => {
      const thigh = editor.bones[`thigh_${side}`];
      const calf = editor.bones[`calf_${side}`];
      const foot = editor.bones[`foot_${side}`];
      return {
        thigh,
        calf,
        thighQ: thigh.getWorldQuaternion(new THREE.Quaternion()),
        calfQ: calf.getWorldQuaternion(new THREE.Quaternion()),
        footQ: foot.getWorldQuaternion(new THREE.Quaternion()),
        foot,
      };
    }) : null;
    const arm = name.startsWith("clavicle_") ? editor.bones[name.replace("clavicle", "upperarm")] : null;
    const elbow = arm ? editor.bones[name.replace("clavicle", "lowerarm")] : null;
    const armDirection = arm ? elbow.getWorldPosition(new THREE.Vector3()).sub(arm.getWorldPosition(new THREE.Vector3())).normalize() : null;
    controls.forEach((control, index) => {
      const value = state.values[index];
      if (!value) return;
      if (control.move) {
        const worldPelvis = bone.getWorldPosition(new THREE.Vector3());
        worldPelvis[control.move] += value * editor.scale;
        bone.position.copy(bone.parent.worldToLocal(worldPelvis));
        bone.updateMatrixWorld(true);
        return;
      }
      let angle = value * DEG * control.sign;
      // Girar alrededor de y o z se refleja de un lado a otro; alrededor de x (adelante/atrás) no.
      if (control.axis === "z" || control.axis === "y") angle *= sideSign;
      if (control.axis === "largo") angle *= sideSign;
      editor.rotateWorld(bone, axisFor(bone, control), angle);
    });
    if (spine) {
      spine.quaternion.copy(spine.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(spineQ));
      spine.updateMatrixWorld(true);
    }
    if (legs) {
      // Muslos, piernas y pies vuelven a su orientación de antes: solo gira la cadera (y el tronco encima).
      legs.forEach(({ thigh, calf, foot, thighQ, calfQ, footQ }) => {
        [[thigh, thighQ], [calf, calfQ], [foot, footQ]].forEach(([bone, wanted]) => {
          bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wanted));
          bone.updateMatrixWorld(true);
        });
      });
    }
    if (arm) {
      const now = elbow.getWorldPosition(new THREE.Vector3()).sub(arm.getWorldPosition(new THREE.Vector3())).normalize();
      const axis = new THREE.Vector3().crossVectors(now, armDirection);
      if (axis.lengthSq() > 1e-10) editor.rotateWorld(arm, axis.normalize(), now.angleTo(armDirection));
    }
    if (name.startsWith("hand_")) {
      // Dedos: las dos manos igual cuando van unidas.
      const [curl, spread] = state.fingers[0];
      const [curl0, spread0] = state.fingersStart;
      // Solo se tocan los dedos si se ha movido su barra.
      if (curl !== curl0 || spread !== spread0) editor.shapeHand(name.endsWith("_l") ? 0 : 1, curl, spread);
    }
  });
}

function onSliderInput() {
  if (!state.touched) {
    state.history.push(state.base);
    state.touched = true;
  }
  applyControls();
}
function onSliderChange() {
  state.dirty = true;
  storeDraft();
  render();
}

// ---------- Posturas añadidas ----------
function addPose(label) {
  if (!label) {
    status("Escribe un nombre para la postura nueva.");
    return;
  }
  storeDraft();
  const name = `extra_${Date.now().toString(36)}`;
  const after = state.pose;
  changeTimes((plan) => {
    const index = plan.keys.findIndex(([, key]) => key === after);
    const at = index < 0 ? plan.keys.length - 1 : index;
    const seconds = secondsOf(plan);
    plan.keys.splice(at + 1, 0, [0, name]);
    seconds.splice(at, 0, 0.15);
    plan.bases = { ...(plan.bases ?? {}), [name]: baseOf(after) ?? after };
    plan.labels = { ...(plan.labels ?? {}), [name]: label };
    if (plan.jumpKeys) plan.jumpKeys = plan.jumpKeys.map((key) => (key > at ? key + 1 : key));
    applySeconds(plan, seconds);
  });
  // Empieza siendo una copia de la postura de la que sale.
  state.drafts[name] = currentSnapshot();
  rig.editor.overrides[name] = state.drafts[name];
  rememberDrafts();
  status(`Añadida «${label}» después de «${nameOf(after)}». Muévela y dale a Guardar.`);
  openPose(name);
}

// Se puede quitar cualquier paso menos la postura de partida y la de vuelta.
function canRemove(name) {
  const keys = planFor(state.gesture).keys;
  return keys.some(([, key], index) => key === name && index > 0 && index < keys.length - 1);
}

// Quita el paso del gesto (también si se repite para aguantar). Su tiempo pasa al paso anterior.
function removePose(name) {
  changeTimes((plan) => {
    for (;;) {
      const index = plan.keys.findIndex(([, key], position) => key === name && position > 0 && position < plan.keys.length - 1);
      if (index < 0) break;
      const seconds = secondsOf(plan);
      seconds.splice(index - 1, 2, seconds[index - 1] + seconds[index]);
      plan.keys.splice(index, 1);
      if (plan.jumpKeys) plan.jumpKeys = plan.jumpKeys.map((key) => (key >= index ? Math.max(0, key - 1) : key));
      applySeconds(plan, seconds);
    }
  });
  // Las posturas añadidas desaparecen del todo; las de serie solo salen de este gesto.
  if (isExtra(name)) {
    delete state.drafts[name];
    delete rig.editor.overrides[name];
    state.deleted.add(name);
  }
  rememberDrafts();
  status(`Quitada «${nameOf(name)}» de este gesto. Dale a Guardar para que quede así (o a Tiempos de serie para recuperar los pasos originales).`);
  openPose(gestureKeys(state.gesture)[0]);
}

// ---------- Tiempos ----------
// El ritmo del gesto que se está viendo, listo para tocar (y cambiado en vivo al mover las barras).
function planFor(gesture) {
  const base = gesturePlan(gesture);
  const keys = base.keys.map(([time, name]) => [time, name]);
  let jumpKeys = base.jumpKeys ?? null;
  if (!jumpKeys && base.jump) {
    const nearest = (fraction) => keys.reduce((best, [time], index) => (Math.abs(time - fraction) < Math.abs(keys[best][0] - fraction) ? index : best), 0);
    jumpKeys = [nearest(base.jump[0]), nearest(base.jump[1])];
  }
  return {
    duration: gestureDuration(gesture, DEFAULT_DURATIONS[gesture]),
    keys,
    jumpKeys,
    jump: base.jump ? [...base.jump] : null,
    hang: base.hang ?? 1,
    // Las posturas añadidas guardan de qué postura parten y su nombre.
    bases: { ...(base.bases ?? {}) },
    labels: { ...(base.labels ?? {}) },
  };
}

const secondsOf = (plan) => plan.keys.slice(1).map(([time], index) => +(((time - plan.keys[index][0]) * plan.duration) / 1000).toFixed(2));

// Recalcula los momentos de cada postura a partir de los segundos de cada paso.
function applySeconds(plan, seconds) {
  const total = Math.max(0.1, seconds.reduce((sum, value) => sum + value, 0));
  let elapsed = 0;
  plan.keys[0][0] = 0;
  seconds.forEach((value, index) => {
    elapsed += value;
    plan.keys[index + 1][0] = +(elapsed / total).toFixed(4);
  });
  plan.duration = Math.round(total * 1000);
  if (plan.jump && plan.jumpKeys) plan.jump = [plan.keys[plan.jumpKeys[0]][0], plan.keys[plan.jumpKeys[1]][0], plan.jump[2]];
}

function changeTimes(update) {
  const plan = planFor(state.gesture);
  update(plan);
  customTimes[state.gesture] = plan;
  state.timesDirty = true;
  rememberDrafts();
}

function timeBar(label, value, { min, max, step, unit, digits = 2 }, onValue) {
  const output = el("span", { textContent: `${Number(value).toFixed(digits)}${unit}`, style: "font-variant-numeric:tabular-nums;color:#a1a1aa;font-size:12px;text-align:right" });
  const input = el("input", { type: "range", min, max, step, value });
  input.addEventListener("input", () => {
    output.textContent = `${Number(input.value).toFixed(digits)}${unit}`;
    onValue(Number(input.value));
  });
  input.addEventListener("change", () => render());
  return el("label", { className: "slider", style: "grid-template-columns:150px 1fr 48px" }, [el("span", { textContent: label }), input, output]);
}

function timeControls() {
  const plan = planFor(state.gesture);
  const seconds = secondsOf(plan);
  const rows = seconds.map((value, index) => {
    const from = plan.keys[index][1];
    const to = plan.keys[index + 1][1];
    const label = from === to ? `Aguantar: ${nameOf(to)}` : `${nameOf(from)} → ${nameOf(to)}`;
    return timeBar(label, value, { min: 0.02, max: 2, step: 0.02, unit: "s" }, (next) => {
      changeTimes((draft) => {
        const all = secondsOf(draft);
        all[index] = next;
        applySeconds(draft, all);
      });
    });
  });
  rows.push(el("p", { className: "hint", textContent: `Dura en total ${(plan.duration / 1000).toFixed(2)} s.` }));
  if (plan.jump && plan.jumpKeys) {
    const keySelect = (label, which) => {
      const select = el("select", {
        onchange: (event) => {
          changeTimes((draft) => {
            draft.jumpKeys[which] = Number(event.target.value);
            draft.jump = [draft.keys[draft.jumpKeys[0]][0], draft.keys[draft.jumpKeys[1]][0], draft.jump[2]];
          });
          render();
        },
      });
      plan.keys.forEach(([, name], index) => select.append(el("option", { value: index, textContent: `${index + 1}. ${nameOf(name)}`, selected: index === plan.jumpKeys[which] })));
      return el("label", { className: "slider", style: "grid-template-columns:110px 1fr" }, [el("span", { textContent: label }), select]);
    };
    rows.push(
      el("h2", { textContent: "Salto" }),
      keySelect("Despega en", 0),
      keySelect("Cae en", 1),
      timeBar("Altura", plan.jump[2], { min: 0, max: 1.2, step: 0.02, unit: " m" }, (next) => changeTimes((draft) => { draft.jump[2] = next; })),
      timeBar("Aguantar en el aire", Math.round((1 - plan.hang) / 0.007), { min: 0, max: 100, step: 1, unit: "%", digits: 0 }, (next) => changeTimes((draft) => { draft.hang = +(1 - next * 0.007).toFixed(3); })),
    );
  }
  rows.push(el("div", { className: "row", style: "margin-top:6px" }, [
    button("Tiempos de serie", () => {
      delete customTimes[state.gesture];
      state.timesDirty = true;
      status("Este gesto vuelve a sus tiempos de serie. Dale a Guardar para que quede así.");
      render();
    }),
  ]));
  return rows;
}

async function save() {
  storeDraft();
  if (state.timesDirty) {
    const timesResponse = await fetch("/__guardar-tiempos", { method: "POST", body: JSON.stringify(customTimes) });
    if (!timesResponse.ok) {
      status(`No se han podido guardar los tiempos: ${await timesResponse.text()}`);
      return;
    }
    state.timesDirty = false;
  }
  const data = { ...rig.editor.saved };
  state.deleted.forEach((name) => delete data[name]);
  Object.assign(data, state.drafts);
  const response = await fetch("/__guardar-gestos", { method: "POST", body: JSON.stringify(data) });
  if (!response.ok) {
    status(`No se ha podido guardar: ${await response.text()}`);
    return;
  }
  Object.keys(rig.editor.saved).forEach((name) => delete rig.editor.saved[name]);
  Object.assign(rig.editor.saved, data);
  state.drafts = {};
  state.deleted.clear();
  rememberDrafts();
  status(`Guardado (${Object.keys(data).length} posturas tuyas). El perfil ya las usa.`);
  render();
}

// ---------- Panel ----------
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  children.forEach((child) => node.append(child));
  return node;
};
const button = (text, onClick, className = "") => el("button", { textContent: text, onclick: onClick, className });

function bar(label, value, { min = -90, max = 90, step = 1, unit = "°" }, onValue) {
  const output = el("span", { textContent: `${value}${unit}`, style: "font-variant-numeric:tabular-nums;color:#a1a1aa;font-size:12px;text-align:right" });
  const input = el("input", { type: "range", min, max, step, value });
  input.addEventListener("input", () => {
    const number = Number(input.value);
    output.textContent = `${unit === "m" ? number.toFixed(2) : number}${unit}`;
    onValue(number);
    onSliderInput();
  });
  input.addEventListener("change", onSliderChange);
  return el("label", { className: "slider", style: "grid-template-columns:120px 1fr 44px" }, [el("span", { textContent: label }), input, output]);
}

function partControls() {
  if (!state.part) return [el("p", { className: "hint", textContent: "Toca un punto amarillo del jugador o un botón de arriba." })];
  if (state.part === "ball") {
    return ["Izquierda ↔ Derecha", "Abajo ↔ Arriba", "Atrás ↔ Adelante"].map((label, index) =>
      bar(label, state.values[index], { min: -0.8, max: 0.8, step: 0.01, unit: "m" }, (value) => {
        state.values[index] = [-value, value, value][index];
      }));
  }
  const rows = controlsFor(state.part).map((control, index) =>
    bar(control.label, state.values[index], control.move ? control : {}, (value) => { state.values[index] = value; }));
  if (state.part.startsWith("hand_")) {
    rows.push(
      bar("Estirados ↔ Puño", state.fingers[0][0], { min: 0, max: 1, step: 0.01, unit: "" }, (value) => { state.fingers[0][0] = value; state.fingers[1][0] = value; }),
      bar("Juntos ↔ Abiertos", state.fingers[0][1], { min: 0, max: 0.4, step: 0.01, unit: "" }, (value) => { state.fingers[0][1] = value; state.fingers[1][1] = value; }),
    );
  }
  return rows;
}

function partLabel(name) {
  if (name === "ball") return "Balón";
  const center = CENTER_PARTS.find(([bone]) => bone === name);
  if (center) return center[1];
  const side = SIDE_PARTS.find(([bone]) => name.startsWith(`${bone}_`));
  return side ? `${side[1]} ${name.endsWith("_l") ? "izquierdo" : "derecho"}` : name;
}

function render() {
  if (!rig) return;
  const saved = rig.editor.saved;
  const linkable = Boolean(partnerOf(state.part));
  panel.replaceChildren(
    el("h1", { textContent: "Editor de gestos" }),
    el("p", { className: "hint", textContent: "Elige gesto y postura, toca una parte y muévela con las barras. Verde = guardada, amarillo = cambiada sin guardar." }),

    el("h2", { textContent: "Gesto" }),
    (() => {
      const select = el("select", { onchange: (event) => { state.gesture = event.target.value; openPose(gestureKeys(state.gesture)[0]); } });
      Object.entries(GESTURES).forEach(([value, label]) => select.append(el("option", { value, textContent: label, selected: value === state.gesture })));
      return select;
    })(),
    el("h2", { textContent: "Postura" }),
    el("div", { className: "row" }, gestureKeys(state.gesture).map((name) => {
      const flag = state.drafts[name] ? "draft" : saved[name] && !state.deleted.has(name) ? "saved" : "";
      return button(nameOf(name), () => openPose(name), `${name === state.pose ? "on" : ""} ${flag}`);
    })),
    // Añadir una postura nueva justo después de la que estás viendo (empieza siendo una copia).
    el("div", { className: "row", style: "margin-top:6px" }, [
      el("input", { id: "new-pose", placeholder: "Nombre de la postura nueva", style: "flex:1;min-height:34px;border-radius:8px;border:1px solid #ffffff2e;background:#0a0a0c;color:#fff;padding:0 10px" }),
      button("Añadir después de esta", () => addPose(document.getElementById("new-pose").value.trim())),
      canRemove(state.pose) ? button("Quitar esta postura", () => removePose(state.pose)) : "",
    ]),

    el("h2", { textContent: "Parte del cuerpo" }),
    el("div", { className: "row" }, [
      ...CENTER_PARTS.map(([name, label]) => button(label, () => selectPart(name), name === state.part ? "on" : "")),
      button("Balón", () => { ball.visible = true; selectPart("ball"); }, state.part === "ball" ? "on" : ""),
    ]),
    el("div", { className: "row", style: "margin-top:6px" }, SIDE_PARTS.flatMap(([name, label]) => ["l", "r"].map((side) => {
      const full = `${name}_${side}`;
      return button(`${label} ${side === "l" ? "izq" : "der"}`, () => selectPart(full), full === state.part ? "on" : "");
    }))),

    el("h2", { textContent: state.part ? `Mover: ${partLabel(state.part)}` : "Mover" }),
    linkable
      ? el("label", { style: "display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:6px" }, [
        el("input", {
          type: "checkbox",
          checked: state.linked,
          onchange: (event) => {
            state.linked = event.target.checked;
            selectPart(state.part);
          },
        }),
        el("span", { textContent: "Mover los dos lados a la vez (en espejo)" }),
      ])
      : "",
    ...partControls(),
    state.part ? el("div", { className: "row", style: "margin-top:6px" }, [button("Barras a 0", () => { selectPart(state.part); })]) : "",

    el("h2", { textContent: "Tiempos del gesto" }),
    el("p", { className: "hint", textContent: "Cuánto tarda cada paso. Mueve y dale a Reproducir gesto para verlo." }),
    ...timeControls(),

    el("h2", { textContent: "Herramientas" }),
    el("div", { className: "row" }, [
      button("Deshacer", () => {
        const previous = state.history.pop();
        if (!previous) return;
        rig.editor.applySnapshot(previous);
        state.dirty = true;
        selectPart(state.part);
      }),
      button(state.playing ? "Parar" : "Reproducir gesto", () => {
        storeDraft();
        if (state.playing) {
          openPose(state.pose);
          return;
        }
        state.playing = true;
        state.playStart = performance.now();
        status(`Reproduciendo «${GESTURES[state.gesture]}» con tus posturas… (toca cualquier cosa para parar)`);
        render();
      }, state.playing ? "on" : ""),
      button(ball.visible ? "Ocultar balón" : "Ver balón", () => { ball.visible = !ball.visible; state.dirty = true; storeDraft(); render(); }),
      button("Volver a la mía (calculada)", () => {
        pushHistory();
        delete state.drafts[state.pose];
        delete rig.editor.overrides[state.pose];
        state.deleted.add(state.pose);
        rig.editor.applySnapshot(rig.editor.computedKeyPose(state.pose));
        status("Esta postura vuelve a ser la calculada. Dale a Guardar para que quede así.");
        selectPart(state.part);
      }),
    ]),
    el("h2", { textContent: "Cuerpo para probar" }),
    el("div", { className: "row" }, [
      button("Chico", () => { storeDraft(); state.build = "male"; loadRig(); }, state.build === "male" ? "on" : ""),
      button("Chica", () => { storeDraft(); state.build = "female"; loadRig(); }, state.build === "female" ? "on" : ""),
    ]),
    el("div", { className: "row", style: "margin-top:16px" }, [button("Guardar", save, "primary")]),
  );
}

// Tocar un punto amarillo elige esa parte.
const raycaster = new THREE.Raycaster();
let down = null;
renderer.domElement.addEventListener("pointerdown", (event) => { down = { x: event.clientX, y: event.clientY }; });
renderer.domElement.addEventListener("pointerup", (event) => {
  if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
  const box = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1), camera);
  const hit = raycaster.intersectObjects([...markers.values()])[0];
  if (hit) selectPart(hit.object.userData.bone);
});

renderer.setAnimationLoop((now) => {
  if (rig && state.playing) {
    const length = gestureDuration(state.gesture, DEFAULT_DURATIONS[state.gesture]);
    const progress = ((now - state.playStart) % (length + 400)) / length;
    rig.pose({ stride: 0, run: 0, amount: 0, action: { action: state.gesture, progress: Math.min(1, progress) }, time: now });
  }
  if (rig) {
    rig.group.updateMatrixWorld(true);
    markers.forEach((marker, bone) => {
      rig.editor.bones[bone].getWorldPosition(marker.position);
      marker.visible = !state.playing;
    });
  }
  orbit.update();
  renderer.render(scene, camera);
});

recoverDrafts();
state.gesture = "remate";
state.pose = Object.keys(state.drafts)[0] ?? "spikeLoad";
loadRig().then(() => status(Object.keys(state.drafts).length ? "Listo. He recuperado tus cambios sin guardar (en amarillo)." : "Listo. Elige un gesto, una postura y toca una parte."));
