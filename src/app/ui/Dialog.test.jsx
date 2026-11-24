import { StrictMode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Dialog } from "./Dialog.jsx";

function Opener({ busy = false, onClose = () => {} }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir</button>
      {open && (
        <Dialog title="Editar evento" description="Cambia lo que quieras." busy={busy} onClose={() => { onClose(); setOpen(false); }}>
          <input aria-label="Qué es" />
        </Dialog>
      )}
    </>
  );
}
const dialog = () => screen.getByRole("dialog", { name: "Editar evento" });
const escape = () => fireEvent.keyDown(document.activeElement, { key: "Escape" });

describe("Dialog", () => {
  it("se abre como modal, con su título como nombre y el foco dentro", () => {
    render(<Opener />);
    expect(dialog().open).toBe(true);
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(screen.getByText("Cambia lo que quieras.")).toBeTruthy();
  });

  it("Escape lo cierra", () => {
    const onClose = vi.fn();
    render(<Opener onClose={onClose} />);
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("la X lo cierra", () => {
    const onClose = vi.fn();
    render(<Opener onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("mientras guarda no se deja cerrar: ni con Escape ni con la X", () => {
    const onClose = vi.fn();
    render(<Opener busy onClose={onClose} />);
    escape();
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog().open).toBe(true);
    const close = screen.getByRole("button", { name: "Cerrar" });
    expect(close.disabled).toBe(true);
    fireEvent.click(close);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("al quitarlo de la página se cierra (y se puede volver a abrir)", () => {
    render(<Opener />);
    const element = dialog();
    escape();
    expect(element.open).toBe(false);
    act(() => screen.getByRole("button", { name: "Abrir" }).click());
    expect(dialog().open).toBe(true);
  });

  it("aguanta el doble montaje de StrictMode sin abrir dos veces", () => {
    expect(() => render(<StrictMode><Opener /></StrictMode>)).not.toThrow();
    expect(dialog().open).toBe(true);
  });
});
