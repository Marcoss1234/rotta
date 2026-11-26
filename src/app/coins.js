import { useEffect, useState } from "react";
import { getCoins } from "@/app/api.js";

// Las coins de quien ha entrado, compartidas entre pantallas: la barra de arriba del móvil las enseña siempre y se
// pone al día cuando Inicio (contestar, destacados, partidos) o la tienda (comprar) las cambian.
const EVENT = "rotta-coins";
let current = null;

/** Avisa de las coins nuevas (o de parte: { balance }), que se juntan con lo que ya se sabía. */
export function publishCoins(coins) {
  if (!coins) return;
  current = { ...(current ?? {}), ...coins };
  window.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
}

/** Las coins para enseñarlas; las pide al servidor la primera vez. Si fallan, null (no se enseñan). */
export function useCoins(enabled = true) {
  const [coins, setCoins] = useState(current);
  useEffect(() => {
    if (!enabled) return undefined;
    const update = (event) => setCoins(event.detail);
    window.addEventListener(EVENT, update);
    getCoins().then(publishCoins).catch(() => {});
    return () => window.removeEventListener(EVENT, update);
  }, [enabled]);
  return enabled ? coins : null;
}

/** «Buenos días», «Buenas tardes» o «Buenas noches» según la hora. */
export function greeting(hour = new Date().getHours()) {
  if (hour >= 6 && hour < 14) return "Buenos días";
  if (hour >= 14 && hour < 21) return "Buenas tardes";
  return "Buenas noches";
}
