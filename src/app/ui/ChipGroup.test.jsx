import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChipGroup } from "./ChipGroup.jsx";

const OPTIONS = [
  { value: "colocador", label: "Colocador" },
  { value: "central", label: "Central", count: 2 },
  { value: "libero", label: "Líbero" },
];

function Controlled({ multiple, initial }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <ChipGroup label="Posiciones" options={OPTIONS} multiple={multiple} value={value} onChange={setValue} />
      <output>{JSON.stringify(value)}</output>
    </>
  );
}
const chip = (name) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const pressed = (name) => chip(name).getAttribute("aria-pressed");

describe("ChipGroup", () => {
  it("es un grupo con nombre", () => {
    render(<Controlled initial="central" />);
    expect(screen.getByRole("group", { name: "Posiciones" })).toBeTruthy();
  });

  it("una sola opción: elegir otra cambia la elegida", () => {
    render(<Controlled initial="central" />);
    expect(pressed("Central")).toBe("true");
    fireEvent.click(chip("Líbero"));
    expect(pressed("Líbero")).toBe("true");
    expect(pressed("Central")).toBe("false");
    expect(screen.getByRole("status").textContent).toBe('"libero"');
  });

  it("varias opciones: un clic añade y otro clic quita", () => {
    render(<Controlled multiple initial={["colocador"]} />);
    fireEvent.click(chip("Central"));
    expect(screen.getByRole("status").textContent).toBe('["colocador","central"]');
    expect(pressed("Central")).toBe("true");
    fireEvent.click(chip("Colocador"));
    expect(screen.getByRole("status").textContent).toBe('["central"]');
    expect(pressed("Colocador")).toBe("false");
  });

  it("lo elegido se marca con la manera de cada identidad (ui-selected) y lo demás con contorno", () => {
    render(<Controlled initial="central" />);
    expect(chip("Central").className).toContain("ui-selected");
    expect(chip("Central").className).toContain("rounded-chip");
    expect(chip("Colocador").className).not.toContain("ui-selected");
    expect(chip("Colocador").className).toContain("ring-line");
    fireEvent.click(chip("Colocador"));
    expect(chip("Colocador").className).toContain("ui-selected");
    expect(chip("Central").className).not.toContain("ui-selected");
  });

  it("enseña el contador de cada opción", () => {
    render(<Controlled initial="central" />);
    expect(chip("Central").textContent).toBe("Central2");
  });

  it("con scroll: difumina el borde por donde quedan opciones y deja de hacerlo al llegar al final", () => {
    // jsdom no mide: se simula una fila de 300 px con 600 px de opciones.
    const sizes = { scrollWidth: 600, clientWidth: 300 };
    const restore = Object.keys(sizes).map((key) => {
      const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key);
      Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => sizes[key] });
      // Son de Element.prototype: basta con quitar la copia de HTMLElement.
      return () => (original ? Object.defineProperty(HTMLElement.prototype, key, original) : delete HTMLElement.prototype[key]);
    });
    try {
      render(<ChipGroup label="Equipo" scroll value="a" onChange={() => {}} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} />);
      const group = screen.getByRole("group", { name: "Equipo" });
      expect(group.dataset.fade).toBe("derecha");
      // (jsdom no conoce mask-image: la máscara se comprueba en el navegador; aquí, qué bordes se difuminan).
      group.scrollLeft = 300;
      fireEvent.scroll(group);
      expect(group.dataset.fade).toBe("izquierda");
    } finally {
      restore.forEach((undo) => undo());
    }
  });

  it("sin scroll no difumina nada", () => {
    render(<Controlled initial="central" />);
    expect(screen.getByRole("group").dataset.fade).toBeUndefined();
  });
});
