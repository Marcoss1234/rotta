import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import GoingCourt, { COURT_SPOTS } from "./GoingCourt.jsx";

const person = (id, name, position, extra = {}) => ({ id, name, position, picture: "", number: null, ...extra });

describe("GoingCourt", () => {
  it("dice en voz alta quién va y con qué puesto, y los pone en la pista", () => {
    render(<GoingCourt teamId="femenino" people={[person("a", "Lucía Navarro", "Colocador"), person("b", "Elena Rubio", "Central")]} currentUserId={null} />);
    const court = screen.getByRole("img", { name: /En la pista, van: Lucía Navarro, Colocador; Elena Rubio, Central/ });
    expect(within(court).getByText("Lucía")).toBeTruthy();
    expect(within(court).getByText("COL")).toBeTruthy();
  });

  it("tu chapa se distingue (aro del color del club)", () => {
    const { container } = render(<GoingCourt teamId="femenino" people={[person("me", "Carmen López", "Receptor"), person("b", "Sara Molina", "Opuesto")]} currentUserId="me" />);
    expect(container.querySelectorAll(".court-chip-mine")).toHaveLength(1);
    expect(container.querySelector("[data-mine]").getAttribute("title")).toBe("Carmen López");
  });

  it("vacía: lo dice y no enseña el resumen por posición", () => {
    render(<GoingCourt teamId="femenino" people={[]} currentUserId={null} />);
    expect(screen.getByRole("img", { name: /todavía nadie ha dicho que va/ })).toBeTruthy();
    expect(screen.getByText("Aún no va nadie")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Quien va, por posición" })).toBeNull();
  });

  it("resumen por posición: cuántos de cada una", () => {
    render(<GoingCourt teamId="femenino" people={[person("a", "A B", "Central"), person("b", "C D", "Central"), person("c", "E F", "Líbero")]} currentUserId={null} />);
    const summary = screen.getByRole("list", { name: "Quien va, por posición" });
    expect(within(summary).getByText("Central").parentElement.textContent).toContain("2");
    expect(within(summary).getByText("Líbero").parentElement.textContent).toContain("1");
  });

  it("si van más de los que caben, el resto como +N", () => {
    const many = Array.from({ length: COURT_SPOTS.length + 3 }, (_, index) => person(`p${index}`, `Persona ${index}`, "Receptor"));
    render(<GoingCourt teamId="femenino" people={many} currentUserId={null} />);
    expect(screen.getByText("+3")).toBeTruthy();
  });
});
