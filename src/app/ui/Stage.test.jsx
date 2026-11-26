import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stage } from "./Stage.jsx";
import { StatTile } from "./StatTile.jsx";

describe("Stage", () => {
  it("es oscuro siempre (stage + force-dark) y lleva el adorno de las tres identidades (index.css enseña uno)", () => {
    render(<Stage aria-label="Próximo entrenamiento"><p>20:45</p></Stage>);
    const stage = screen.getByRole("region", { name: "Próximo entrenamiento" });
    expect(stage.className).toContain("stage");
    expect(stage.className).toContain("force-dark");
    for (const name of ["stage-deco-lineas", "stage-deco-balon", "stage-deco-acta"]) expect(stage.querySelector(`.${name}`)).not.toBeNull();
    // El adorno no se lee en voz alta.
    expect(stage.querySelector(".stage-decoration").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("20:45")).toBeTruthy();
  });

  it("sin adorno si se pide", () => {
    render(<Stage aria-label="Marcador" decoration={false}>3-1</Stage>);
    expect(screen.getByRole("region", { name: "Marcador" }).querySelector(".stage-decoration")).toBeNull();
  });
});

describe("StatTile", () => {
  it("el número va con la letra de marcador y en el color del texto", () => {
    const { container } = render(<StatTile label="Puesto" value={1} suffix="º" caption="de 12" />);
    const value = container.querySelector(".font-score");
    expect(value.textContent).toBe("1º");
    expect(value.className).toContain("font-score");
    expect(value.className).toContain("text-ink");
    expect(screen.getByText("de 12")).toBeTruthy();
  });

  it("dorado solo cuando se pide (una nota de 85 o más, los coins)", () => {
    render(<StatTile label="Nota global" value={93} emphasis="gold" />);
    expect(screen.getByText("93").className).toContain("text-gold-text");
  });
});
