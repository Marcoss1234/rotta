import { removePushSubscription, savePushSubscription } from "@/app/api.js";

const SCOPE = "/app";

const isIphone = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

// ready: se pueden activar. needs-install: es un iPhone y la app no está en la pantalla de inicio.
export function pushAvailability() {
  if (isIphone() && !isInstalled()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission === "denied" ? "denied" : "ready";
}

function keyToBytes(key) {
  const base64 = (key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

export async function currentPushSubscription() {
  if (pushAvailability() === "unsupported" || pushAvailability() === "needs-install") return null;
  const registration = await navigator.serviceWorker.getRegistration(SCOPE);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

const SUBSCRIBE_TIMEOUT_MS = 20000;

// El detalle sale en el mensaje de error: sin él no se puede saber qué ha pasado en el móvil de cada uno.
const deviceInfo = () =>
  navigator.userAgent.match(/Android [\d.]+|(?:SamsungBrowser|HuaweiBrowser|EdgA|OPR|Firefox|Chrome)\/\d+/g)?.join(" · ") ?? "navegador desconocido";

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new DOMException("el móvil no responde", "TimeoutError")), SUBSCRIBE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function createSubscription(publicKey) {
  await navigator.serviceWorker.register("/sw.js", { scope: SCOPE });
  const registration = await navigator.serviceWorker.ready;
  return (
    (await registration.pushManager.getSubscription()) ??
    registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) })
  );
}

// Hay que llamarla justo al pulsar un botón: el móvil no deja pedir permiso de otra forma.
export async function enablePush(publicKey) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(`El móvil no ha dado permiso (${permission} · ${deviceInfo()})`);
  let subscription;
  try {
    subscription = await withTimeout(createSubscription(publicKey));
  } catch (error) {
    throw new Error(`No se ha podido apuntar este móvil (${error.name}: ${error.message} · ${deviceInfo()})`);
  }
  await savePushSubscription(subscription.toJSON());
}

export async function disablePush() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await removePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}

// Al entrar: el móvil apuntado queda a nombre de quien ha iniciado sesión.
export async function syncPushSubscription() {
  const subscription = await currentPushSubscription();
  if (subscription) await savePushSubscription(subscription.toJSON());
}

// Al cerrar sesión deja de llegar, pero el móvil sigue con permiso para la próxima vez.
export async function forgetPushSubscription() {
  const subscription = await currentPushSubscription();
  if (subscription) await removePushSubscription(subscription.endpoint);
}
