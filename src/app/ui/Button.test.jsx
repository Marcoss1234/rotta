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

  it("el principal lleva la línea de luz; el secundario va relleno, con su borde de 3:1, y con menos protagonismo", () => {
    render(<><Button>Guardar</Button><Button variant="secondary">Cancelar</Button></>);
    const primary = screen.getByRole("button", { name: "Guardar" });
    const secondary = screen.getByRole("button", { name: "Cancelar" });
    expect(primary.className).toContain("ui-btn-primary");
    expect(secondary.className).toContain("bg-raised");
    expect(secondary.className).toContain("ring-control");
    expect(secondary.className).not.toContain("bg-club");
  });

  it("on-stage: para dentro del escenario, con el texto del escenario", () => {
    render(<Button variant="on-stage">No voy</Button>);
    const button = screen.getByRole("button", { name: "No voy" });
    expect(button.className).toContain("text-stage-ink");
    expect(button.className).not.toContain("bg-club");
  });

  it("los tamaños: 40, 44 y 52 px de alto como mínimo (táctil)", () => {
    render(<><Button size="sm">S</Button><Button>M</Button><Button size="lg">L</Button></>);
    expect(screen.getByRole("button", { name: "S" }).className).toContain("min-h-10");
    expect(screen.getByRole("button", { name: "M" }).className).toContain("min-h-11");
    expect(screen.getByRole("button", { name: "L" }).className).toContain("min-h-[3.25rem]");
  });

  it("las transiciones siguen el ritmo de la identidad", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" }).className).toContain("transition-ui");
  });

  it("LinkButton es un enlace de verdad", () => {
    render(<LinkButton href="https://maps.example/x" target="_blank" rel="noopener noreferrer">Cómo llegar</LinkButton>);
    const link = screen.getByRole("link", { name: "Cómo llegar" });
    expect(link.getAttribute("href")).toBe("https://maps.example/x");
    expect(link.className).toContain("ring-control");
  });
});
