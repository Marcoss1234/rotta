// Android avisa una sola vez y muy pronto de que se puede instalar: hay que guardarlo
// antes de que cargue la parte privada, por eso este archivo se importa desde main.jsx.
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  notify();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  notify();
});

export const subscribeToInstall = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const canPromptInstall = () => Boolean(deferredPrompt);

export async function promptInstall() {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  notify();
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  return outcome === "accepted";
}

export function installPlatform() {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (standalone) return "installed";
  const agent = window.navigator.userAgent;
  // Los iPad modernos se presentan como un Mac, pero con pantalla táctil.
  if (/iphone|ipad|ipod/i.test(agent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(agent)) return "android";
  return "desktop";
}
