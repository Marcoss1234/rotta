import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader } from "./Card.jsx";

describe("Card", () => {
  it("base: la tarjeta con la profundidad de la identidad (ui-card), su esquina y el relleno de 20/24 px", () => {
    render(<Card aria-label="Base">Hola</Card>);
    const card = screen.getByRole("region", { name: "Base" });
    expect(card.tagName).toBe("SECTION");
    for (const name of ["rounded-card", "bg-card", "ui-card", "p-card"]) expect(card.className).toContain(name);
  });

  it("raised: dentro de otra tarjeta, con la esquina «dentro» (más pequeña)", () => {
    render(<Card level="raised" aria-label="Dentro">Hola</Card>);
    const card = screen.getByRole("region", { name: "Dentro" });
    expect(card.className).toContain("rounded-inner");
    expect(card.className).toContain("bg-raised");
    expect(card.className).not.toContain("ui-card");
  });

  it("overlay: por encima de todo, con su superficie y su sombra", () => {
    render(<Card level="overlay" aria-label="Menú">Hola</Card>);
    const card = screen.getByRole("region", { name: "Menú" });
    expect(card.className).toContain("bg-overlay");
    expect(card.className).toContain("shadow-overlay");
  });

  it("outline y accent siguen como antes", () => {
    render(<><Card level="outline" aria-label="Contorno">a</Card><Card level="accent" aria-label="Tuyo">b</Card></>);
    expect(screen.getByRole("region", { name: "Contorno" }).className).toContain("ring-line");
    expect(screen.getByRole("region", { name: "Tuyo" }).className).toContain("bg-club-soft");
  });

  it("interactive: cambia al pasar el ratón, con el ritmo de la identidad", () => {
    render(<Card interactive aria-label="Toca">Hola</Card>);
    const card = screen.getByRole("region", { name: "Toca" });
    expect(card.className).toContain("ui-card-interactive");
    expect(card.className).toContain("transition-ui");
  });

  it("los rellenos y la etiqueta se pueden cambiar", () => {
    render(<Card as="article" padding="sm" aria-label="Pequeña">Hola</Card>);
    const card = screen.getByRole("article", { name: "Pequeña" });
    expect(card.className).toContain("p-3");
    expect(card.className).not.toContain("p-card");
  });
});

describe("CardHeader", () => {
  it("el título va con la letra de títulos de la identidad", () => {
    render(<CardHeader title="Próximo partido" subtitle="Liga" />);
    const title = screen.getByRole("heading", { name: "Próximo partido" });
    expect(title.className).toContain("font-title");
    expect(screen.getByText("Liga")).toBeTruthy();
  });
});
