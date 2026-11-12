import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { canvasTexture, createPlayer, disposeObject, posePlayer, studioLighting } from "@/app/character/character3D.js";
import { gestureDuration, hitFraction } from "@/app/character/gestureTimes.js";

// El personaje en el perfil: se queda solo dando toques, colocándose el balón o mirando a la grada,
// y al tocarlo hace su celebración.
const BALL_R = 0.105;
const DURATIONS = { toques: 1000, dedos: 950, remate: 1700, brazos: 1500, puno: 1500 };
// Lo que hace solo, en bucle: [gesto, veces]. `null` es quedarse quieto un rato.
const PLAYLIST = [["toques", 6], [null, 1], ["dedos", 5], [null, 1]];
const REST_MS = 1800;

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
        const x = index * band + Math.sin((y / height) * Math.PI * 2) * band * 0.6;
        if (y === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      for (let y = height; y >= 0; y -= 4) context.lineTo(index * band + band + Math.sin((y / height) * Math.PI * 2) * band * 0.6, y);
      context.fill();
    });
  });
}

function floorTexture() {
  return canvasTexture(512, 512, (context, width, height) => {
    const gradient = context.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, "#D9824A");
    gradient.addColorStop(0.62, "#B8602F");
    gradient.addColorStop(1, "rgba(10,10,12,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(255,255,255,0.85)";
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(width * 0.1, height * 0.68);
    context.lineTo(width * 0.9, height * 0.68);
    context.stroke();
  });
}

// Altura del balón en los toques: sube desde las manos y vuelve a caer justo al tocar de nuevo.
// Encuadres fijos mientras se edita el personaje, según la pestaña abierta.
// Los de la cabeza se calculan sobre dónde está su cabeza (cambia con la altura y el peinado).
const DEFAULT_VIEW = { target: new THREE.Vector3(0, 1.05, 0), camera: new THREE.Vector3(0, 1.45, 5.1) };
const FULL_VIEW = { target: new THREE.Vector3(0, 0.98, 0), camera: new THREE.Vector3(0, 1.2, 4.7) };
const HEAD_OFFSETS = {
  cara: new THREE.Vector3(0, 0.03, 1.15),
  pelo: new THREE.Vector3(0.6, 0.22, 1.0),
};

// Los encuadres están hechos para alguien de 1,80 m; con alguien más alto la cámara se aleja
// lo justo para que quepa. Con alguien más bajo no se acerca: así se nota que es más bajo.
const fitOf = (rig) => Math.max(1, (rig?.scale ?? 1) / 1.065);
const scaled = (view, fit) => ({ target: view.target.clone().multiplyScalar(fit), camera: view.camera.clone().multiplyScalar(fit) });

const juggle = (progress, contact, height) => {
  const since = (((progress - contact) % 1) + 1) % 1;
  return 4 * height * since * (1 - since);
};

export default function AvatarStage({ look, name, number, position, heightCm = null, crown = null, playRef, focus = null, className = "" }) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);

  // Escena, luces y bucle: una sola vez.
  useEffect(() => {
    const mount = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const environment = studioLighting(renderer, scene, 0.55);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 1.45, 5.1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.05, 0);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minPolarAngle = Math.PI * 0.32;
    controls.maxPolarAngle = Math.PI * 0.52;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = !calm;
    controls.autoRotateSpeed = 0.7;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2a22, 0.6));
    const key = new THREE.SpotLight(0xfff4ea, 32, 14, Math.PI / 6, 0.5, 1.2);
    key.position.set(1.8, 5, 3);
    key.target.position.set(0, 0.9, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    scene.add(key, key.target);
    // Contraluz naranja del club.
    const rim = new THREE.DirectionalLight(0xff6a2b, 1.6);
    rim.position.set(-2.5, 2.5, -3);
    scene.add(rim);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshStandardMaterial({ map: floorTexture(), transparent: true, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 18), new THREE.MeshStandardMaterial({ map: moltenTexture(), roughness: 0.45 }));
    ball.castShadow = true;
    ball.visible = false;
    scene.add(ball);

    const state = { renderer, scene, camera, controls, ball, rig: null, frame: 0, visible: true, calm, special: null, step: 0, count: 0, started: performance.now(), shot: null, focus: null, returning: false };
    stateRef.current = state;

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    // Fuera de la pantalla no se dibuja: así no gasta batería.
    const seen = new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting;
    });
    seen.observe(mount);

    // Qué está haciendo ahora mismo.
    const currentMove = (now) => {
      if (state.special) {
        const progress = (now - state.special.started) / gestureDuration(state.special.name, DURATIONS[state.special.name]);
        if (progress < 1) return { name: state.special.name, progress };
        state.special = null;
        state.shot = null;
        state.started = now;
        state.count = 0;
      }
      // Editando o sin animaciones: quieto, de pie.
      if (calm || state.focus) return { name: null, progress: 0 };
      const [name, times] = PLAYLIST[state.step];
      const length = name ? gestureDuration(name, DURATIONS[name]) : REST_MS;
      const elapsed = now - state.started;
      if (elapsed >= length) {
        state.started = now;
        state.count += 1;
        if (state.count >= times) {
          state.count = 0;
          state.step = (state.step + 1) % PLAYLIST.length;
        }
        return currentMove(now);
      }
      return { name, progress: elapsed / length };
    };

    // Lleva la cámara poco a poco al encuadre de la pestaña; al terminar de editar, vuelve al de siempre.
    const frameCamera = () => {
      let view = null;
      if (state.focus) {
        const offset = HEAD_OFFSETS[state.focus];
        if (state.focus === "pecho" && state.rig?.head) {
          // El pecho, para ver bien el dibujo de la camiseta.
          const chest = state.rig.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.42, 0));
          view = { target: chest, camera: chest.clone().add(new THREE.Vector3(0, 0.08, 1.75)) };
        } else if (offset && state.rig?.head) {
          const head = state.rig.head.getWorldPosition(new THREE.Vector3());
          view = { target: head, camera: head.clone().add(offset) };
        } else {
          view = scaled(FULL_VIEW, fitOf(state.rig));
        }
      } else if (state.returning) {
        view = scaled(DEFAULT_VIEW, fitOf(state.rig));
      }
      if (!view) return;
      controls.target.lerp(view.target, 0.1);
      camera.position.lerp(view.camera, 0.1);
      if (!state.focus && camera.position.distanceTo(view.camera) < 0.02) {
        state.returning = false;
        controls.enableRotate = true;
        controls.autoRotate = !calm;
      }
    };

    // Si salta (remate, brazos arriba…), la cámara sube con él para que no se salga por arriba.
    const headAt = new THREE.Vector3();
    const followJump = () => {
      if (!state.rig?.head || state.focus) return;
      const head = state.rig.head.getWorldPosition(headAt).y;
      if (state.restHead === null || state.restHead === undefined) state.restHead = head;
      if (!state.special) state.restHead += (head - state.restHead) * 0.05;
      const wanted = Math.max(0, head - state.restHead) * 0.95;
      const lift = state.cameraLift ?? 0;
      const next = lift + (wanted - lift) * 0.4;
      camera.position.y += next - lift;
      controls.target.y += next - lift;
      state.cameraLift = next;
    };

    const handPoint = (index) => (state.rig.real ? state.rig.handPoint(index) : state.rig.joints.hands[index].getWorldPosition(new THREE.Vector3()));

    const tick = (now) => {
      state.frame = requestAnimationFrame(tick);
      if (!state.visible || document.hidden || !state.rig) return;
      const move = currentMove(now);
      // Sigue el balón con la mirada; si no hay balón, mira a quien le está viendo.
      const lookAt = ball.visible ? ball.position.clone() : camera.position.clone();
      const options = { stride: 0, run: 0, amount: 0, action: move.name ? { action: move.name, progress: move.progress } : null, time: now, lookAt };
      if (state.rig.real) state.rig.pose(options);
      else posePlayer(state.rig, options);
      state.rig.group.updateMatrixWorld(true);

      ball.visible = ["toques", "dedos", "remate"].includes(move.name);
      if (move.name === "toques" || move.name === "dedos") {
        // El balón cae siempre sobre la plataforma de antebrazos o en la copa de las manos, estén donde estén.
        const toques = move.name === "toques";
        const contact = toques && state.rig.platformPoint ? state.rig.platformPoint() : handPoint(0).lerp(handPoint(1), 0.5);
        const height = toques ? 0.85 : 0.6;
        const lift = toques ? BALL_R + 0.05 : BALL_R + 0.02;
        ball.position.set(contact.x, contact.y + lift + juggle(move.progress, 0.5, height), contact.z + (toques ? 0 : 0.02));
        ball.rotation.x += move.name === "toques" ? -0.06 : 0.04;
      } else if (move.name === "remate") {
        // El balón llega a la mano justo en el golpe del gesto (el remate capturado golpea en lo más alto).
        const hit = hitFraction("remate") ?? 0.53;
        if (move.progress < hit) {
          // Baja desde arriba hasta la mano que remata.
          const target = handPoint(1);
          const from = new THREE.Vector3(0.6, 3.6, -0.9);
          const t = Math.max(0, (move.progress - 0.2) / (hit - 0.2));
          ball.position.lerpVectors(from, target.add(new THREE.Vector3(0, 0.1, -0.05)), t);
          state.shot = ball.position.clone();
        } else {
          // Sale disparado hacia delante y abajo.
          const t = Math.min(1, (move.progress - hit) / 0.18);
          const start = state.shot ?? ball.position.clone();
          ball.position.lerpVectors(start, new THREE.Vector3(-0.4, BALL_R, 3.5), t);
          ball.visible = t < 1;
        }
        ball.rotation.x -= 0.25;
      }
      frameCamera();
      followJump();
      controls.update();
      renderer.render(scene, camera);
    };
    state.frame = requestAnimationFrame(tick);

    // Tocarlo (sin arrastrar) lanza su celebración.
    let down = null;
    const onDown = (event) => {
      down = { x: event.clientX, y: event.clientY };
    };
    const onUp = (event) => {
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 8) state.play?.();
      down = null;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(state.frame);
      observer.disconnect();
      seen.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      disposeObject(scene);
      environment.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  // El jugador se rehace cada vez que cambia algo del personaje: primero el modelo de verdad;
  // si no carga, el muñeco de siempre.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return undefined;
    const swap = (rig) => {
      if (state.rig) {
        state.scene.remove(state.rig.group);
        // El modelo real comparte mallas y texturas con los demás: solo se libera el muñeco.
        if (!state.rig.real) disposeObject(state.rig.group);
      }
      state.rig = rig;
      state.restHead = null;
      if (!state.focus) {
        // Mismo ángulo de cámara, a la distancia que toca para su estatura.
        const fit = fitOf(rig);
        const { target, camera } = scaled(DEFAULT_VIEW, fit);
        const offset = state.camera.position.clone().sub(state.controls.target).setLength(camera.distanceTo(target));
        state.controls.target.copy(target);
        state.camera.position.copy(target).add(offset);
      }
    };
    const fallback = () => {
      const rig = createPlayer(state.scene, { id: "yo", side: "home", name, label: number ?? "" }, { id: "yo", number, character: look, height_cm: heightCm, crown }, position, look.build === "female", { showLabel: false });
      rig.group.scale.setScalar(rig.scale);
      // De cara a la cámara.
      rig.group.rotation.y = Math.PI;
      rig.group.traverse((child) => {
        if (child.isMesh) child.castShadow = true;
      });
      swap(rig);
    };
    fallback();
    return undefined;
  }, [look, name, number, position, heightCm, crown]);

  // Editando: cámara quieta y encuadre según la pestaña.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const was = state.focus;
    state.focus = focus;
    if (focus) {
      state.controls.autoRotate = false;
      state.controls.enableRotate = false;
      state.returning = false;
      // Al entrar en la pestaña de celebración, la enseña una vez.
      if (focus === "celebracion" && was !== "celebracion") state.play?.();
    } else if (was) {
      state.returning = true;
    }
  }, [focus]);

  // Para que el botón de fuera también pueda lanzar la celebración.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const changed = state.celebration !== undefined && state.celebration !== look.celebration;
    state.celebration = look.celebration;
    state.play = (restart = false) => {
      if (state.special && !restart) return;
      state.special = { name: look.celebration, started: performance.now() };
      state.shot = null;
    };
    if (playRef) playRef.current = state.play;
    // Si eliges otra celebración mientras editas, la ves al momento.
    if (changed && state.focus === "celebracion") state.play(true);
  }, [look.celebration, playRef]);

  return <div ref={mountRef} className={`relative h-full w-full cursor-pointer ${className}`} />;
}
