import { useEffect, useRef } from "react";

// Balón de vóley blanco, pequeño, con sus tres franjas.
const BALL_SVG = `
<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
  <circle cx="12" cy="12" r="10.6" fill="#ffffff" stroke="rgba(0,0,0,0.18)" stroke-width="0.8"/>
  <g fill="none" stroke="#c9ccd3" stroke-width="1.3" stroke-linecap="round">
    <path d="M12 1.6c-1.6 4.4-1.2 8.2 1.2 10.6"/>
    <path d="M13.2 12.2c4.6-.2 7.6 1.6 9 4.4"/>
    <path d="M13.2 12.2c-2.4 3.8-5.8 5.8-9.4 5.9"/>
    <path d="M3.6 6.4c3 .3 6.2 2 9.6 5.8"/>
  </g>
</svg>`;

const SIZE = 22;

// Cada toque deja un "splash": un balón que aparece girando y un aro que se abre. No bloquea nada:
// va en una capa por encima que no recibe toques. En la pizarra no sale para no tapar lo que se dibuja.
export default function TapSplash({ disabled = false }) {
  const layerRef = useRef(null);

  useEffect(() => {
    if (disabled) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const layer = layerRef.current;
    if (!layer) return undefined;

    const onDown = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest?.("[data-no-splash], input, textarea, select, canvas")) return;
      const splash = document.createElement("span");
      splash.className = "tap-splash";
      splash.style.left = `${event.clientX}px`;
      splash.style.top = `${event.clientY}px`;
      const ring = document.createElement("span");
      ring.className = "tap-splash-ring";
      const ball = document.createElement("span");
      ball.className = "tap-splash-ball";
      ball.style.width = `${SIZE}px`;
      ball.style.height = `${SIZE}px`;
      ball.innerHTML = BALL_SVG;
      splash.append(ring, ball);
      layer.append(splash);
      // Por si el navegador no avisa del final de la animación (pestaña en segundo plano).
      const remove = () => splash.remove();
      ball.addEventListener("animationend", remove, { once: true });
      setTimeout(remove, 900);
    };

    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, [disabled]);

  return <div ref={layerRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" />;
}
