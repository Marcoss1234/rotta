import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import { BUTTON_VARIANTS, Button, IconButton, LinkButton } from "./Button.jsx";

describe("Button", () => {
  it("cada variante lleva sus colores del tema", () => {
    for (const [variant, classes] of Object.entries(BUTTON_VARIANTS)) {
      render(<Button variant={variant}>{variant}</Button>);
      const button = screen.getByRole("button", { name: variant });
      for (const name of classes.split(" ")) expect(button.classList.contains(name)).toBe(true);
    }
    expect(screen.getByRole("button", { name: "primary" }).className).toContain("bg-club");
  });

  it("es type=button por defecto (no envía formularios sin querer) y responde al clic", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    const button = screen.getByRole("button", { name: "Guardar" });
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ocupado: se desactiva, avisa con aria-busy, enseña el texto de espera y no responde", () => {
    const onClick = vi.fn();
    render(<Button busy busyLabel="Guardando…" onClick={onClick}>Guardar</Button>);
    const button = screen.getByRole("button", { name: "Guardando…" });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("desactivado: no responde al clic", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Borrar</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("IconButton se nombra con su etiqueta (para lectores de pantalla) y la enseña al pasar el ratón", () => {
    render(<IconButton icon={Plus} label="Añadir evento" />);
    const button = screen.getByRole("button", { name: "Añadir evento" });
    expect(button.getAttribute("title")).toBe("Añadir evento");
  });

  it("LinkButton es un enlace de verdad", () => {
    render(<LinkButton href="https://maps.example/x" target="_blank" rel="noopener noreferrer">Cómo llegar</LinkButton>);
    const link = screen.getByRole("link", { name: "Cómo llegar" });
    expect(link.getAttribute("href")).toBe("https://maps.example/x");
    expect(link.className).toContain("ring-control");
  });
});
