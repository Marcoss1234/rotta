import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Field } from "./Field.jsx";
import { PasswordInput } from "./PasswordInput.jsx";

const renderField = (props = {}) =>
  render(
    <Field id="clave" label="Contraseña" hint="Al menos 8 caracteres." error={props.error}>
      <PasswordInput id="clave" autoComplete="current-password" hint="Al menos 8 caracteres." value="" onChange={() => {}} {...props} />
    </Field>,
  );

describe("PasswordInput", () => {
  it("es un campo de contraseña con su etiqueta, sin correcciones del teclado y con el autocompletado que se le pida", () => {
    renderField();
    const input = screen.getByLabelText("Contraseña");
    expect(input.type).toBe("password");
    expect(input.getAttribute("autocomplete")).toBe("current-password");
    expect(input.getAttribute("autocapitalize")).toBe("none");
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.getAttribute("maxlength")).toBe("128");
    expect(input.getAttribute("aria-describedby")).toBe("clave-ayuda");
  });

  it("el ojo enseña y oculta la contraseña, y dice qué hará", () => {
    renderField();
    const input = screen.getByLabelText("Contraseña");
    const eye = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(eye.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(eye);
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("el nombre del botón se puede cambiar (contraseña temporal, nueva...)", () => {
    renderField({ what: "contraseña temporal" });
    expect(screen.getByRole("button", { name: "Mostrar contraseña temporal" })).toBeTruthy();
  });

  it("con error: marcado y enlazado con su mensaje", () => {
    renderField({ error: "Escribe la contraseña" });
    const input = screen.getByLabelText("Contraseña");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("clave-error");
  });

  it("el ojo no envía el formulario", () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput id="clave" aria-label="Contraseña" value="" onChange={() => {}} />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
