import { useId, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TabPanel, Tabs } from "./Tabs.jsx";

const ITEMS = [
  { id: "entrenos", label: "Entrenamientos" },
  { id: "partidos", label: "Partidos", count: 2 },
  { id: "torneos", label: "Torneos", disabled: true },
  { id: "notas", label: "Notas" },
];

function Group({ label, onChange = () => {} }) {
  const [value, setValue] = useState("entrenos");
  const id = useId();
  return (
    <section aria-label={label}>
      <Tabs id={id} label={label} items={ITEMS} value={value} onChange={(next) => { setValue(next); onChange(next); }} />
      {ITEMS.map((item) => <TabPanel key={item.id} tabsId={id} tab={item.id} value={value}>Contenido de {item.label}</TabPanel>)}
    </section>
  );
}

const tab = (name, scope = screen) => scope.getByRole("tab", { name: new RegExp(`^${name}`) });

describe("Tabs", () => {
  it("marca la elegida y solo ella entra en el orden del tabulador", () => {
    render(<Group label="Qué ver" />);
    expect(tab("Entrenamientos").getAttribute("aria-selected")).toBe("true");
    expect(tab("Entrenamientos").tabIndex).toBe(0);
    expect(tab("Partidos").getAttribute("aria-selected")).toBe("false");
    expect(tab("Partidos").tabIndex).toBe(-1);
  });

  it("la elegida lleva la manera de marcar de la identidad (ui-selected), 44 px de alto y su contador marcado", () => {
    render(<Group label="Qué ver" />);
    expect(tab("Entrenamientos").className).toContain("ui-selected");
    expect(tab("Entrenamientos").className).toContain("min-h-11");
    expect(tab("Partidos").className).not.toContain("ui-selected");
    // El contador lleva ui-count: en Naranja, dentro de lo elegido, cambia a los colores que se leen sobre el club.
    expect(within(tab("Partidos")).getByText("2").className).toContain("ui-count");
    fireEvent.click(tab("Partidos"));
    expect(tab("Partidos").className).toContain("ui-selected");
    expect(tab("Entrenamientos").className).not.toContain("ui-selected");
  });

  it("con un clic cambia de pestaña y de panel", () => {
    const onChange = vi.fn();
    render(<Group label="Qué ver" onChange={onChange} />);
    fireEvent.click(tab("Partidos"));
    expect(onChange).toHaveBeenCalledWith("partidos");
    expect(tab("Partidos").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Contenido de Partidos");
  });

  it("cada pestaña apunta a su panel y cada panel a su pestaña", () => {
    render(<Group label="Qué ver" />);
    for (const item of ITEMS) {
      const button = tab(item.label);
      const panel = document.getElementById(button.getAttribute("aria-controls"));
      expect(panel).not.toBeNull();
      expect(panel.getAttribute("role")).toBe("tabpanel");
      expect(panel.getAttribute("aria-labelledby")).toBe(button.id);
      expect(panel.hidden).toBe(item.id !== "entrenos");
    }
  });

  it("dos grupos en la misma pantalla no repiten identificadores", () => {
    render(<><Group label="Primero" /><Group label="Segundo" /></>);
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    const first = within(screen.getByRole("region", { name: "Primero" }));
    const second = within(screen.getByRole("region", { name: "Segundo" }));
    expect(tab("Partidos", first).getAttribute("aria-controls")).not.toBe(tab("Partidos", second).getAttribute("aria-controls"));
  });

  it("teclado: flechas (dando la vuelta), Inicio y Fin; se salta la desactivada y mueve el foco", () => {
    render(<Group label="Qué ver" />);
    const press = (key) => fireEvent.keyDown(document.activeElement, { key });
    tab("Entrenamientos").focus();
    press("ArrowRight");
    expect(document.activeElement).toBe(tab("Partidos"));
    expect(tab("Partidos").getAttribute("aria-selected")).toBe("true");
    press("ArrowRight"); // Torneos está desactivada
    expect(document.activeElement).toBe(tab("Notas"));
    press("ArrowRight"); // da la vuelta
    expect(document.activeElement).toBe(tab("Entrenamientos"));
    press("ArrowLeft");
    expect(document.activeElement).toBe(tab("Notas"));
    press("Home");
    expect(document.activeElement).toBe(tab("Entrenamientos"));
    press("End");
    expect(document.activeElement).toBe(tab("Notas"));
    expect(screen.getByRole("tabpanel").textContent).toBe("Contenido de Notas");
  });

  it("una pestaña desactivada no se puede elegir", () => {
    const onChange = vi.fn();
    render(<Group label="Qué ver" onChange={onChange} />);
    expect(tab("Torneos").disabled).toBe(true);
    fireEvent.click(tab("Torneos"));
    expect(onChange).not.toHaveBeenCalled();
    expect(tab("Entrenamientos").getAttribute("aria-selected")).toBe("true");
  });

  it("sin paneles (hasPanels=false) no apunta a nada que no exista", () => {
    render(<Tabs label="Filtro" hasPanels={false} items={ITEMS} value="entrenos" onChange={() => {}} />);
    expect(tab("Entrenamientos").hasAttribute("aria-controls")).toBe(false);
  });
});
