import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./PageHeader.jsx";

describe("PageHeader", () => {
  it("es la cabecera de la pantalla: un único título principal, compacto y con la letra de la identidad", () => {
    render(<PageHeader title="Ranking" subtitle="Femenino · del 23 al 29 nov" />);
    const title = screen.getByRole("heading", { level: 1, name: "Ranking" });
    expect(title.className).toContain("font-title");
    expect(title.className).toContain("text-title");
    expect(screen.getByText("Femenino · del 23 al 29 nov")).toBeTruthy();
    expect(title.closest("header").className).toContain("app-page-header");
  });

  it("pone los botones a la derecha, o debajo si se pide", () => {
    const { rerender } = render(<PageHeader title="Notas" actions={<button type="button">Ranking</button>} />);
    expect(screen.getByRole("button", { name: "Ranking" })).toBeTruthy();
    expect(screen.getByRole("banner").className).toContain("justify-between");
    rerender(<PageHeader title="Notas" stacked actions={<button type="button">Ranking</button>} />);
    expect(screen.getByRole("banner").className).toContain("flex-col");
  });
});
