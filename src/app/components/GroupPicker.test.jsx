import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GroupPicker } from "./RankingVisuals.jsx";

const GROUPS = [
  { id: "masculino", name: "Club Senior Masculino" },
  { id: "femenino", name: "Club Senior Femenino" },
  { id: "escuela-lm", name: "Escuela LM" },
];

describe("GroupPicker (elegir equipo)", () => {
  it("con un solo equipo no sale", () => {
    const { container } = render(<GroupPicker groups={[GROUPS[0]]} groupId="masculino" onChange={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("es un grupo «Elegir equipo» con los nombres sin «Club Senior» y el elegido marcado", () => {
    render(<GroupPicker groups={GROUPS} groupId="femenino" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Elegir equipo" })).toBeTruthy();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Masculino", "Femenino", "Escuela LM"]);
    expect(screen.getByRole("button", { name: "Femenino" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Masculino" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("al tocar un equipo avisa con su id (también si ya estaba elegido, como antes)", () => {
    const onChange = vi.fn();
    render(<GroupPicker groups={GROUPS} groupId="femenino" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Escuela LM" }));
    fireEvent.click(screen.getByRole("button", { name: "Femenino" }));
    expect(onChange.mock.calls).toEqual([["escuela-lm"], ["femenino"]]);
  });

  it("es una sola fila que se desliza en el móvil", () => {
    render(<GroupPicker groups={GROUPS} groupId="femenino" onChange={() => {}} />);
    const group = screen.getByRole("group", { name: "Elegir equipo" });
    expect(group.className).toContain("overflow-x-auto");
    expect(group.className).not.toContain("flex-wrap");
  });
});
