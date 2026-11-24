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

  it("enseña el contador de cada opción", () => {
    render(<Controlled initial="central" />);
    expect(chip("Central").textContent).toBe("Central2");
  });
});
