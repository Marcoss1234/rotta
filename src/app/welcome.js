import { useSyncExternalStore } from "react";
import { clubSlug } from "@/app/club.js";

// La bienvenida de Inicio sale una sola vez por club, persona y móvil. Se apunta como vista al enseñarla, pero
// sigue a la vista durante esa visita hasta que se cierra (así no desaparece al ir y volver a Inicio).
// Mientras está a la vista, el aviso del menú (MenuHint) espera: así no se amontonan los avisos.

const keyFor = (userId) => `rotta-bienvenida-${clubSlug || "club"}-${userId}`;

let visibleFor = null;
const listeners = new Set();
const publish = (value) => {
  visibleFor = value;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function alreadySeen(userId) {
  try {
    return window.localStorage.getItem(keyFor(userId)) === "1";
  } catch {
    // Sin almacenamiento no se puede recordar: mejor no enseñarla cada vez.
    return true;
  }
}

function markSeen(userId) {
  try {
    window.localStorage.setItem(keyFor(userId), "1");
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
}

/** ¿Hay que enseñar la bienvenida a esta persona? (Solo mira: no apunta nada.) */
export const wantsWelcome = (userId) => visibleFor === userId || !alreadySeen(userId);

/** Al enseñarla: se apunta como vista en este móvil y queda a la vista hasta que se cierre. */
export function claimWelcome(userId) {
  markSeen(userId);
  if (visibleFor !== userId) publish(userId);
}

export const dismissWelcome = () => publish(null);

/** true mientras la bienvenida está a la vista. */
export const useWelcomeVisible = () => useSyncExternalStore(subscribe, () => visibleFor !== null);

// Solo para las pruebas.
export const resetWelcomeForTests = () => publish(null);
