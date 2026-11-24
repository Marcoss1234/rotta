// Preparación de las pruebas de la web (vitest + Testing Library + jsdom).
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

// jsdom tiene <dialog> y su `open`, pero no showModal() ni close(). Se completan como en el navegador, con sus
// errores, para que una prueba falle si el componente los usa mal:
// - showModal() en un diálogo ya abierto o fuera de la página lanza InvalidStateError;
// - Escape lanza «cancel» (cancelable) en el diálogo modal de más arriba y, si nadie lo cancela, lo cierra;
// - close() quita `open`, guarda el valor devuelto y lanza «close».
if (!HTMLDialogElement.prototype.showModal) {
  const modals = [];
  const FOCUSABLE = "[autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

  HTMLDialogElement.prototype.showModal = function showModal() {
    if (this.open) throw new DOMException("El diálogo ya está abierto", "InvalidStateError");
    if (!this.isConnected) throw new DOMException("El diálogo no está en la página", "InvalidStateError");
    this.setAttribute("open", "");
    modals.push(this);
    // Como el navegador: el foco va al primer elemento que lo admite (o al que tenga autofocus).
    (this.querySelector("[autofocus]") ?? this.querySelector(FOCUSABLE))?.focus();
  };

  HTMLDialogElement.prototype.close = function close(returnValue) {
    if (!this.open) return;
    this.removeAttribute("open");
    if (returnValue !== undefined) this.returnValue = returnValue;
    modals.splice(modals.indexOf(this), 1);
    this.dispatchEvent(new Event("close"));
  };

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || modals.length === 0) return;
    const top = modals[modals.length - 1];
    if (top.dispatchEvent(new Event("cancel", { cancelable: true }))) top.close();
  });
}
