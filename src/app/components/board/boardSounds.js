// Sonidos de la pizarra 3D, hechos al vuelo con Web Audio (no hay archivos que descargar):
// golpes al balón, botes en el suelo y pasos. Suenan en un "pabellón" con algo de eco.
const STORAGE_KEY = "pizarra-sonido";

let context = null;
let master = null;
let room = null;
let noise = null;

export function soundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Sin almacenamiento: vale solo para esta vez.
  }
  if (on) unlockSound();
  else stopSilentLoop();
}

// En el iPhone, el modo silencio apaga los sonidos de las webs. Para que suenen igual (como los de un vídeo):
// - en iOS 17 o más, se le dice al navegador que son sonidos de "reproducción" (`audioSession`);
// - y, para los demás, un audio mudo que se queda sonando en bucle mientras la app está abierta: mientras
//   suena, el móvil está en modo "reproducción" y deja oír el resto. Si se parara, volvería a silenciarlo.
// Se para al salir de la app (para que no salga en la pantalla de bloqueo) y vuelve con el siguiente toque.
const SILENT_AUDIO = "data:audio/wav;base64,UklGRt0BAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YbkBAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=";
let silentLoop = null;
// Lo que ha fallado al intentar sonar, para el botón «Probar sonido».
const problems = { silent: null, resume: null };
function setPlaybackSession() {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== "playback") navigator.audioSession.type = "playback";
  } catch {
    // Navegador sin esta opción: vale el audio mudo.
  }
}
if (typeof navigator !== "undefined" && soundEnabled()) setPlaybackSession();
function soundEvenOnSilentMode() {
  if (!soundEnabled()) return;
  setPlaybackSession();
  preparePlayers();
  try {
    if (!silentLoop) {
      silentLoop = new window.Audio(SILENT_AUDIO);
      silentLoop.loop = true;
      silentLoop.setAttribute("x-webkit-airplay", "deny");
      silentLoop.setAttribute("playsinline", "");
    }
    if (silentLoop.paused && !usedMedia) {
      silentLoop
        .play()
        .then(() => {
          problems.silent = null;
        })
        .catch((error) => {
          problems.silent = error?.name ?? "error";
        });
    }
  } catch {
    // Si no se puede, al menos suena con el móvil sin silencio.
  }
}
function stopSilentLoop() {
  silentLoop?.pause();
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") stopSilentLoop();
  });
}

// El navegador solo deja sonar después de que la persona toque algo: se llama al pulsar.
// El motor de sonido: el volumen general, un limitador (que no cruja el altavoz) y el eco de pabellón.
// `wireGraph` monta lo mismo sobre cualquier motor: el de verdad o el que prepara un sonido en segundo plano.
// El eco tiene que ir a la misma frecuencia que su motor; por eso se guarda uno por frecuencia.
const sharedImpulses = new Map();
let sharedNoise = null;
function wireGraph(audio) {
  context = audio;
  master = audio.createGain();
  master.gain.value = 0.8;
  // Compresor al final: el remate puede sonar muy fuerte sin que cruja el altavoz.
  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 6;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  master.connect(limiter).connect(audio.destination);
  // Eco corto de pabellón (el eco y el ruido se calculan una vez y se reutilizan).
  if (!sharedImpulses.has(audio.sampleRate)) sharedImpulses.set(audio.sampleRate, impulse(audio, 0.9, 3.2));
  room = audio.createConvolver();
  room.buffer = sharedImpulses.get(audio.sampleRate);
  const wet = audio.createGain();
  wet.gain.value = 0.22;
  room.connect(wet).connect(master);
  if (!sharedNoise) {
    sharedNoise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = sharedNoise.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  }
  noise = sharedNoise;
}
function buildContext(Audio) {
  wireGraph(new Audio());
  stoppedSince = null;
}

// Desde cuándo el motor no está sonando ("suspended" o "interrupted").
let stoppedSince = null;
// En el iPhone (iOS 18) el motor a veces se queda parado y no vuelve aunque se le pida: si al tocar lleva
// parado más de este tiempo, se tira y se hace uno nuevo en ese mismo toque, que sí arranca.
const STUCK_MS = 700;
const MAX_REBUILDS = 3;

// El navegador solo deja sonar después de que la persona toque algo: se llama al pulsar.
export function unlockSound() {
  if (typeof window === "undefined") return null;
  soundEvenOnSilentMode();
  const Audio = window.AudioContext ?? window.webkitAudioContext;
  if (!Audio) return null;
  if (context && context.state !== "running") {
    const now = performance.now();
    if (stoppedSince === null) stoppedSince = now;
    else if (now - stoppedSince > STUCK_MS && (problems.rebuilt ?? 0) < MAX_REBUILDS) {
      problems.rebuilt = (problems.rebuilt ?? 0) + 1;
      context.close().catch(() => {});
      context = null;
    }
  }
  if (!context) buildContext(Audio);
  // El iPhone deja el sonido "suspended" o "interrupted" (tras una llamada, otra app con audio o volver de
  // segundo plano): con cualquiera de los dos, el siguiente toque lo vuelve a encender.
  if (context.state !== "running") {
    const current = context;
    current
      .resume()
      .then(() => {
        problems.resume = null;
        if (current === context && current.state === "running") stoppedSince = null;
      })
      .catch((error) => {
        if (current === context) problems.resume = error?.name ?? "error";
      });
  } else {
    stoppedSince = null;
  }
  return context;
}

function impulse(audio, seconds, decay) {
  const length = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(2, length, audio.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** decay;
  }
  return buffer;
}

// ---------- Plan B: si el iPhone bloquea el motor, cada sonido se prepara aparte y suena como un audio ----------
// Algunos iPhone (iOS 18) dejan el motor de sonido parado para siempre, pero sí dejan sonar audios normales
// (como el bucle mudo). Entonces cada sonido se dibuja en un motor "de mentira" que no necesita permiso
// (OfflineAudioContext), se convierte en un audio WAV y lo toca uno de estos reproductores.
const SAMPLE_RATE = 44100;
const players = [];
let nextPlayer = 0;
// Los reproductores se "estrenan" al tocar la pantalla: después el iPhone les deja sonar sin tocar.
function preparePlayers() {
  if (typeof window === "undefined") return;
  while (players.length < 6) {
    const player = new window.Audio();
    player.setAttribute("playsinline", "");
    player.setAttribute("x-webkit-airplay", "deny");
    players.push(player);
  }
  players.forEach((player) => {
    if (player.dataset.primed) return;
    player.dataset.primed = "1";
    player.src = SILENT_AUDIO;
    player
      .play()
      .then(() => {
        // Si mientras tanto ya le han puesto un sonido de verdad, no se toca.
        if (player.src === SILENT_AUDIO) player.pause();
      })
      .catch(() => {});
  });
}

function wavOf(buffer) {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = 44 + frames * channels * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, bytes - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * channels * 2, true);
  const data = [...Array(channels)].map((_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, data[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}

function playThroughMedia(seconds, draw) {
  const Offline = window.OfflineAudioContext ?? window.webkitOfflineAudioContext;
  if (!Offline) return;
  const offline = new Offline(2, Math.ceil(SAMPLE_RATE * seconds), SAMPLE_RATE);
  const saved = { context, master, room, noise };
  try {
    wireGraph(offline);
    draw();
  } catch (error) {
    problems.media = error?.name ?? "error";
  } finally {
    context = saved.context;
    master = saved.master;
    room = saved.room;
    noise = saved.noise;
  }
  stopSilentLoop();
  const play = (player, url) => {
    if (player.dataset.url && player.dataset.url !== url) URL.revokeObjectURL(player.dataset.url);
    player.dataset.url = url;
    player.src = url;
    return player.play();
  };
  offline
    .startRendering()
    .then((buffer) => {
      const url = URL.createObjectURL(wavOf(buffer));
      const player = players.length ? players[nextPlayer % players.length] : new window.Audio();
      nextPlayer += 1;
      return play(player, url).catch(() => {
        const fresh = new window.Audio();
        fresh.setAttribute("playsinline", "");
        return play(fresh, url);
      });
    })
    .then(() => {
      problems.media = null;
      usedMedia = true;
    })
    .catch((error) => {
      problems.media = error?.name ?? "error";
    });
}
let usedMedia = false;

// Todos los sonidos pasan por aquí: con el motor si funciona; si el iPhone lo tiene bloqueado, por el plan B.
function perform(seconds, draw, { skipOnPlanB = false } = {}) {
  if (!soundEnabled() || typeof window === "undefined") return;
  if (context && context.state === "running") {
    draw();
    return;
  }
  if (skipOnPlanB) return;
  playThroughMedia(seconds, draw);
}


// «Probar sonido»: tres notas claras, más fuertes que el plup, para saber si se oye.
export function playTest() {
  perform(0.9, () => {
    const now = context.currentTime + 0.02;
    [660, 880, 1320].forEach((frequency, index) => {
      const osc = context.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = frequency;
      const gain = context.createGain();
      const at = now + index * 0.14;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.5, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      osc.connect(gain).connect(master);
      osc.start(at);
      osc.stop(at + 0.4);
    });
  });
}

// Cómo está el sonido ahora mismo, explicado para quien no sabe de esto.
export function soundStatus() {
  const lines = [];
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) ? navigator.userAgent.match(/OS (\d+)_(\d+)/) : null;
  if (!soundEnabled()) lines.push("Los sonidos están apagados en el interruptor «Sonidos».");
  if (!context) lines.push("El sonido aún no se ha activado: toca otra vez el botón.");
  else if (context.state !== "running") lines.push(usedMedia ? "El iPhone tiene parado el motor de sonido, pero suena por el plan B (como un audio normal)." : `El navegador tiene el sonido parado (${context.state}).`);
  if (problems.resume) lines.push(`No ha dejado encender el sonido (${problems.resume}).`);
  if (problems.media) lines.push(`El plan B tampoco ha podido sonar (${problems.media}).`);
  if (problems.silent) lines.push(`El truco para el modo silencio ha fallado (${problems.silent}).`);
  if (silentLoop && silentLoop.paused && !problems.silent && !usedMedia) lines.push("El audio para el modo silencio está parado.");
  const session = typeof navigator !== "undefined" && navigator.audioSession ? navigator.audioSession.type : null;
  if (ios && !session) lines.push(`iOS ${ios[1]}.${ios[2]}: el modo de sonido de iOS 17 no está disponible.`);
  if (lines.length === 0) lines.push("Todo en marcha: si no lo has oído, sube el volumen con los botones del lateral con la app abierta y mira que no tengas auriculares conectados.");
  const technical = [
    `estado: ${context?.state ?? "sin crear"}`,
    `sesión: ${session ?? "no"}`,
    `bucle: ${silentLoop ? (silentLoop.paused ? "parado" : "sonando") : "no"}`,
    `rehecho: ${problems.rebuilt ?? 0}`,
    `plan B: ${usedMedia ? "sí" : "no"}${problems.media ? ` (${problems.media})` : ""}`,
    navigator.standalone || window.matchMedia?.("(display-mode: standalone)").matches ? "abierta desde el icono" : "abierta en el navegador",
    ios ? `iOS ${ios[1]}.${ios[2]}` : "no iPhone",
  ].join(" · ");
  return { lines, technical };
}

// "Plup": una burbujita al tocar un botón de la app. Corta y suave, sin eco.
export function playTap() {
  perform(0.25, () => {
    const now = context.currentTime;
    const bubble = context.createOscillator();
    bubble.type = "sine";
    bubble.frequency.setValueAtTime(360, now);
    bubble.frequency.exponentialRampToValueAtTime(950, now + 0.065);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    bubble.connect(gain).connect(master);
    bubble.start(now);
    bubble.stop(now + 0.14);
  });
}

// Salida de un sonido: volumen y lado (izquierda/derecha), y una parte al eco.
function output(volume, pan) {
  const gain = context.createGain();
  gain.gain.value = volume;
  const panner = context.createStereoPanner ? context.createStereoPanner() : null;
  if (panner) {
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.connect(panner);
    panner.connect(master);
    panner.connect(room);
  } else {
    gain.connect(master);
    gain.connect(room);
  }
  return gain;
}

// Golpe sordo: un tono que cae de `from` a `to` Hz.
function thump(destination, at, { from, to, length, level }) {
  const osc = context.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + length);
  const env = context.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level, at + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(env).connect(destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

// Chasquido de ruido filtrado: la piel contra el balón, la suela contra el suelo.
function slap(destination, at, { type, frequency, q = 1, length, level }) {
  const source = context.createBufferSource();
  source.buffer = noise;
  source.playbackRate.value = 0.9 + Math.random() * 0.2;
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const env = context.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level, at + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(filter).connect(env).connect(destination);
  source.start(at, Math.random() * 0.5);
  source.stop(at + length + 0.02);
}

// Cada toque suena distinto: el remate y el saque, un "¡pum!" seco; la recepción, más sordo;
// la colocación, un toque corto de dedos; el bloqueo, un manotazo.
const HITS = {
  remate: { thump: { from: 190, to: 55, length: 0.16, level: 0.9 }, slap: { type: "highpass", frequency: 900, length: 0.09, level: 0.85 } },
  saque: { thump: { from: 170, to: 55, length: 0.14, level: 0.75 }, slap: { type: "highpass", frequency: 1000, length: 0.08, level: 0.7 } },
  recepcion: { thump: { from: 140, to: 60, length: 0.13, level: 0.6 }, slap: { type: "lowpass", frequency: 1100, length: 0.07, level: 0.45 } },
  defensa: { thump: { from: 150, to: 60, length: 0.12, level: 0.62 }, slap: { type: "lowpass", frequency: 1300, length: 0.07, level: 0.5 } },
  colocacion: { thump: { from: 240, to: 120, length: 0.06, level: 0.28 }, slap: { type: "bandpass", frequency: 1700, q: 1.2, length: 0.045, level: 0.3 } },
  bloqueo: { thump: { from: 160, to: 60, length: 0.12, level: 0.7 }, slap: { type: "highpass", frequency: 700, length: 0.09, level: 0.7 } },
};

// Saturación para que el remate "rompa" como un disparo.
let crunch = null;
function distortion() {
  if (crunch) return crunch;
  crunch = new Float32Array(1024);
  for (let index = 0; index < crunch.length; index += 1) {
    const x = (index / (crunch.length - 1)) * 2 - 1;
    crunch[index] = Math.tanh(x * 3.2);
  }
  return crunch;
}

// El remate: un estampido. Golpe grave que retumba, chasquido seco encima y una cola larga de pabellón.
function playSpike(volume, pan, power) {
  const at = context.currentTime + 0.005;
  const out = output(volume * power, pan);
  const shaper = context.createWaveShaper();
  shaper.curve = distortion();
  shaper.oversample = "4x";
  const drive = context.createGain();
  drive.gain.value = 0.9;
  drive.connect(shaper).connect(out);
  // Bombo grave que baja hasta casi no oírse: el "¡PUM!".
  thump(drive, at, { from: 140, to: 32, length: 0.42, level: 1 });
  thump(drive, at, { from: 70, to: 28, length: 0.5, level: 0.9 });
  // Chasquido: la palma contra el balón, muy corto y muy fuerte.
  slap(drive, at, { type: "highpass", frequency: 1500, length: 0.03, level: 0.7 });
  // Explosión de ruido ancho que se apaga rápido (la "pólvora").
  slap(drive, at, { type: "lowpass", frequency: 2600, length: 0.22, level: 0.55 });
  // Retumbe extra en el eco del pabellón.
  const tail = context.createGain();
  tail.gain.value = 0.35 * volume * power;
  tail.connect(room);
  slap(tail, at + 0.01, { type: "lowpass", frequency: 500, length: 0.6, level: 0.9 });
}

export function playHit(action, { volume = 1, pan = 0 } = {}) {
  perform(1.3, () => {
    if (action === "remate") {
      playSpike(Math.min(0.42, volume * 0.6), pan, 1);
      return;
    }
    if (action === "saque") {
      playSpike(Math.min(0.32, volume * 0.45), pan, 0.65);
      return;
    }
    const sound = HITS[action] ?? HITS.recepcion;
    const at = context.currentTime + 0.005;
    const out = output(volume, pan);
    thump(out, at, sound.thump);
    slap(out, at, sound.slap);
  });
}

// ---------- Sonidos de los efectos de la tienda (suenan encima del golpe normal) ----------
// Un tono que va de `from` a `to` Hz y se apaga.
function tone(destination, at, { type = "sine", from, to = from, length, level, attack = 0.004 }) {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + length);
  const env = context.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(env).connect(destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

// Ruido con un filtro que puede moverse (un soplido que sube, un chisporroteo…).
function hiss(destination, at, { type, from, to = from, q = 0.8, length, level, attack = 0.003 }) {
  const source = context.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, at);
  if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, at + length);
  const env = context.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(filter).connect(env).connect(destination);
  source.start(at, Math.random() * 0.5);
  source.stop(at + length + 0.02);
}

// Campanita metálica (moneda, hielo): el tono y sus armónicos "de campana", que se apagan rápido.
function bell(destination, at, frequency, level, length = 0.35) {
  [[1, 1], [2.76, 0.45], [5.4, 0.2]].forEach(([ratio, share]) => tone(destination, at, { from: frequency * ratio, length: length / ratio ** 0.3, level: level * share, attack: 0.002 }));
}

const random = (low, high) => low + Math.random() * (high - low);

const FX_SOUNDS = {
  // Eléctrico: chisporroteo de descargas y un "zzzap" que cae.
  rayo(out, at, power) {
    for (let index = 0; index < 10; index += 1) {
      const when = at + index * 0.03 + random(0, 0.02);
      tone(out, when, { type: "sawtooth", from: random(90, 220), to: 50, length: 0.045, level: 0.22 * power });
      hiss(out, when, { type: "highpass", from: random(3000, 6500), length: 0.025, level: 0.4 * power });
    }
    tone(out, at, { type: "square", from: 2200, to: 110, length: 0.3, level: 0.1 * power });
    hiss(out, at, { type: "bandpass", from: 5000, to: 900, q: 3, length: 0.35, level: 0.25 * power });
  },
  // Fuego: llamarada que sube (soplido) y brasas que crepitan.
  fuego(out, at, power) {
    hiss(out, at, { type: "lowpass", from: 260, to: 3400, length: 0.55, level: 0.75 * power, attack: 0.06 });
    tone(out, at, { from: 95, to: 38, length: 0.4, level: 0.5 * power });
    for (let index = 0; index < 16; index += 1) {
      hiss(out, at + random(0.05, 0.75), { type: "highpass", from: random(1800, 4200), length: random(0.01, 0.03), level: random(0.15, 0.4) * power });
    }
  },
  // Galaxia: barrido cósmico que cae, con un brillo de estrellas por encima.
  galaxia(out, at, power) {
    [0, 7, 12, 19].forEach((semitones, index) => {
      const ratio = 2 ** (semitones / 12);
      tone(out, at + index * 0.025, { type: index % 2 ? "triangle" : "sine", from: 900 * ratio, to: 160 * ratio, length: 1, level: 0.11 * power, attack: 0.03 });
    });
    hiss(out, at, { type: "bandpass", from: 6000, to: 400, q: 2, length: 0.9, level: 0.2 * power, attack: 0.05 });
    for (let index = 0; index < 9; index += 1) tone(out, at + random(0.08, 0.7), { from: random(2600, 5200), length: 0.12, level: 0.05 * power });
  },
  // Oro: lluvia de monedas que tintinean.
  oro(out, at, power) {
    const coins = Math.round(8 + power * 8);
    for (let index = 0; index < coins; index += 1) {
      bell(out, at + random(0, 0.55) * (index / coins + 0.3), random(2300, 4300), random(0.08, 0.16) * power);
    }
    hiss(out, at, { type: "highpass", from: 7000, length: 0.12, level: 0.15 * power });
  },
  // Hielo: crujido de cristal y tintineos agudos.
  hielo(out, at, power) {
    hiss(out, at, { type: "highpass", from: 4500, length: 0.07, level: 0.55 * power });
    hiss(out, at + 0.04, { type: "bandpass", from: 7000, to: 2500, q: 1.5, length: 0.35, level: 0.3 * power });
    for (let index = 0; index < 7; index += 1) bell(out, at + random(0.02, 0.4), random(3200, 6400), 0.07 * power, 0.25);
  },
  // Estrellas: arpegio que sube, como un hechizo.
  estrellas(out, at, power) {
    [1320, 1568, 1760, 2093, 2637, 3136].forEach((frequency, index) => {
      tone(out, at + index * 0.055, { type: "triangle", from: frequency, length: 0.35, level: 0.12 * power, attack: 0.006 });
      tone(out, at + index * 0.055, { from: frequency * 2, length: 0.2, level: 0.04 * power });
    });
  },
};

// Sonido del efecto de un golpe: más fuerte en el remate que en la recepción o la colocación.
export function playFx(name, action, { volume = 1, pan = 0 } = {}) {
  perform(1.5, () => {
    const recipe = FX_SOUNDS[name];
    if (!recipe) return;
    const power = action === "remate" ? 1 : 0.65;
    const out = output(Math.min(0.55, volume * 0.75), pan);
    recipe(out, context.currentTime + 0.01, power);
  });
}

// El balón bota en el suelo: más fuerte cuanto más rápido llega.
export function playBounce({ strength = 1, volume = 1, pan = 0 } = {}) {
  perform(0.8, () => {
    const level = Math.max(0.05, Math.min(1, strength));
    const at = context.currentTime + 0.005;
    const out = output(volume * level, pan);
    thump(out, at, { from: 150, to: 50, length: 0.14, level: 0.85 });
    slap(out, at, { type: "bandpass", frequency: 800, q: 0.8, length: 0.06, level: 0.55 });
  });
}

// Un paso: golpecito de zapatilla y, corriendo, alguna vez el chirrido de la goma en la pista.
export function playStep({ run = 0, volume = 1, pan = 0 } = {}) {
  perform(0.3, () => {
    const at = context.currentTime + 0.005;
    const out = output(volume * (0.35 + run * 0.4), pan);
    slap(out, at, { type: "bandpass", frequency: 380 + Math.random() * 160, q: 1.4, length: 0.05, level: 0.5 });
    if (run > 0.6 && Math.random() < 0.18) {
      const osc = context.createOscillator();
      osc.type = "triangle";
      const pitch = 2100 + Math.random() * 900;
      osc.frequency.setValueAtTime(pitch, at);
      osc.frequency.linearRampToValueAtTime(pitch * 1.12, at + 0.07);
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(0.05, at + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
      osc.connect(env).connect(out);
      osc.start(at);
      osc.stop(at + 0.11);
    }
  }, { skipOnPlanB: true });
}
