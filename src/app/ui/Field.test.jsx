import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Field, Input, Select, Textarea } from "./Field.jsx";

describe("Field e Input", () => {
  it("la etiqueta nombra al campo y marca lo opcional", () => {
    render(<Field id="lugar" label="Lugar" optional><Input id="lugar" /></Field>);
    const input = screen.getByRole("textbox", { name: "Lugar (opcional)" });
    expect(input.id).toBe("lugar");
  });

  it("la ayuda queda enlazada al campo", () => {
    render(<Field id="equipo" label="Equipo" hint="Puedes cambiarlo más tarde."><Input id="equipo" hint="Puedes cambiarlo más tarde." /></Field>);
    const input = screen.getByRole("textbox", { name: "Equipo" });
    expect(document.getElementById(input.getAttribute("aria-describedby")).textContent).toBe("Puedes cambiarlo más tarde.");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("un error marca el campo como no válido, se enlaza y sustituye a la ayuda", () => {
    const error = "Ese dorsal ya lo tiene otra jugadora.";
    render(<Field id="dorsal" label="Dorsal" hint="Del 1 al 99" error={error}><Input id="dorsal" hint="Del 1 al 99" error={error} /></Field>);
    const input = screen.getByRole("textbox", { name: "Dorsal" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")).textContent).toBe(error);
    expect(screen.queryByText("Del 1 al 99")).toBeNull();
  });

  it("se escribe en él y respeta disabled", () => {
    const onChange = vi.fn();
    render(<><Input id="a" aria-label="Nombre" onChange={onChange} /><Input id="b" aria-label="Bloqueado" disabled /></>);
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Carmen" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Bloqueado" }).disabled).toBe(true);
  });

  it("Textarea y Select funcionan con su etiqueta", () => {
    const onChange = vi.fn();
    render(
      <>
        <Field id="notas" label="Notas"><Textarea id="notas" /></Field>
        <Field id="sel" label="Equipo"><Select id="sel" defaultValue="f" onChange={onChange}><option value="f">Femenino</option><option value="m">Masculino</option></Select></Field>
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Notas" }).tagName).toBe("TEXTAREA");
    const select = screen.getByRole("combobox", { name: "Equipo" });
    fireEvent.change(select, { target: { value: "m" } });
    expect(select.value).toBe("m");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
