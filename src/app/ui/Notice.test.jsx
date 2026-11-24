import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, EmptyState, Notice } from "./Notice.jsx";

describe("Notice", () => {
  it("un error se anuncia en voz alta (role=alert) con el tono de peligro", () => {
    render(<Notice tone="error">No se ha podido guardar.</Notice>);
    const notice = screen.getByRole("alert");
    expect(notice.textContent).toBe("No se ha podido guardar.");
    expect(notice.className).toContain("text-danger-text");
  });

  it("éxito e información son avisos tranquilos (role=status)", () => {
    render(<><Notice tone="success">Guardado.</Notice><Notice>Es en el pabellón.</Notice></>);
    const [success, info] = screen.getAllByRole("status");
    expect(success.textContent).toBe("Guardado.");
    expect(success.className).toContain("text-voy-text");
    expect(info.textContent).toBe("Es en el pabellón.");
    expect(info.className).toContain("text-ink");
  });

  it("EmptyState enseña su frase y su acción", () => {
    render(<EmptyState action={<button type="button">Añadir evento</button>}>No hay nada este mes.</EmptyState>);
    expect(screen.getByText("No hay nada este mes.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Añadir evento" })).toBeTruthy();
  });

  it("Badge usa el tono pedido", () => {
    render(<><Badge tone="club">Partido</Badge><Badge>Evento</Badge></>);
    expect(screen.getByText("Partido").className).toContain("bg-club");
    expect(screen.getByText("Evento").className).toContain("bg-raised");
  });
});
