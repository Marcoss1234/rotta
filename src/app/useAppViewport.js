import { useEffect } from "react";

const APP_VIEWPORT = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
const KEYBOARD_CLOSE_MS = 100;

const isTyping = () => {
  const element = document.activeElement;
  return Boolean(element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName)));
};

// Sin zoom dentro de la app. La web pública no pasa por aquí y se puede ampliar con normalidad.
export default function useAppViewport() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const root = document.documentElement;
    const original = meta?.getAttribute("content");
    meta?.setAttribute("content", APP_VIEWPORT);
    root.classList.add("app-no-zoom");

    // iPhone ignora user-scalable=no, así que el gesto de pellizcar se corta aparte.
    const cancel = (event) => event.preventDefault();
    const cancelPinch = (event) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    // Al cerrarse el teclado, iPhone puede dejar la pantalla desplazada: esto la recoloca.
    // La página con menú no se desplaza nunca; en las demás (acceso, contraseña) no hay que moverla.
    let timer;
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!isTyping() && root.classList.contains("app-shell")) window.scrollTo(0, 0);
      }, KEYBOARD_CLOSE_MS);
    };

    document.addEventListener("gesturestart", cancel);
    document.addEventListener("touchmove", cancelPinch, { passive: false });
    document.addEventListener("focusout", settle);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("gesturestart", cancel);
      document.removeEventListener("touchmove", cancelPinch);
      document.removeEventListener("focusout", settle);
      root.classList.remove("app-no-zoom");
      if (original) meta.setAttribute("content", original);
    };
  }, []);
}
