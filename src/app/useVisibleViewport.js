import { useEffect, useState } from "react";

// Parte de la pantalla que se ve de verdad: en el móvil, el teclado la reduce sin cambiar 100dvh.
export default function useVisibleViewport() {
  const [box, setBox] = useState(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const update = () => setBox({ top: viewport.offsetTop, height: viewport.height });
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return box;
}
