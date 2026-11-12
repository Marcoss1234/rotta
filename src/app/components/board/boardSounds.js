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
}

// El navegador solo deja sonar después de que la persona toque algo: se llama al pulsar.
export function unlockSound() {
  if (typeof window === "undefined") return null;
  const Audio = window.AudioContext ?? window.webkitAudioContext;
  if (!Audio) return null;
  if (!context) {
    context = new Audio();
    master = context.createGain();
    master.gain.value = 0.8;
    // Compresor al final: el remate puede sonar muy fuerte sin que cruja el altavoz.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.2;
    master.connect(limiter).connect(context.destination);
    // Eco corto de pabellón.
    room = context.createConvolver();
    room.buffer = impulse(context, 0.9, 3.2);
    const wet = context.createGain();
    wet.gain.value = 0.22;
    room.connect(wet).connect(master);
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  }
  if (context.state === "suspended") context.resume().catch(() => {});
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

const ready = () => context && context.state === "running" && soundEnabled();

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
  if (!ready()) return;
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
}

// El balón bota en el suelo: más fuerte cuanto más rápido llega.
export function playBounce({ strength = 1, volume = 1, pan = 0 } = {}) {
  if (!ready()) return;
  const level = Math.max(0.05, Math.min(1, strength));
  const at = context.currentTime + 0.005;
  const out = output(volume * level, pan);
  thump(out, at, { from: 150, to: 50, length: 0.14, level: 0.85 });
  slap(out, at, { type: "bandpass", frequency: 800, q: 0.8, length: 0.06, level: 0.55 });
}

// Un paso: golpecito de zapatilla y, corriendo, alguna vez el chirrido de la goma en la pista.
export function playStep({ run = 0, volume = 1, pan = 0 } = {}) {
  if (!ready()) return;
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
}
