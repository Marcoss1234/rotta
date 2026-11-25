import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import PlayerDialog, { readPlayerForm } from "./PlayerDialog.jsx";

const TEAMS = [{ id: "femenino", name: "Club Senior Femenino" }, { id: "masculino", name: "Club Masculino" }];
const PLAYER = { id: "p1", team_id: "femenino", name: "Lucía Pérez", position: "Central", number: 7, phone: "600 111 222", email: "lucia@example.com", linked: false };
const LINKED = { ...PLAYER, id: "p2", name: "Marta Ruiz", number: null, phone: null, email: null, linked: true };

const setup = (props = {}) => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<PlayerDialog player={null} teams={TEAMS} defaultTeamId="femenino" onSave={onSave} onClose={onClose} {...props} />);
  return { onSave, onDelete, onClose };
};
const field = (name) => screen.getByLabelText(name, { exact: false });
const type = (name, value) => fireEvent.change(field(name), { target: { value } });
const submit = async () => act(async () => fireEvent.click(screen.getByRole("button", { name: /^(Guardar|Añadir)$/ })));
const apiError = (message, status) => Object.assign(new Error(message), { status });

describe("readPlayerForm (limpieza de datos)", () => {
  const base = { name: "", team_id: "femenino", position: "Sin definir", number: "", phone: "", email: "" };
  it("quita espacios de más, deja null lo vacío y pasa el correo a minúsculas", () => {
    const { errors, values } = readPlayerForm({ ...base, name: "  Ana   García  ", number: "07", phone: " 600 111 222 ", email: " Ana@Example.COM " });
    expect(errors).toEqual({});
    expect(values).toEqual({ name: "Ana García", team_id: "femenino", position: "Sin definir", number: 7, phone: "600 111 222", email: "ana@example.com" });
  });
  it("dorsal vacío es null y el 0 vale", () => {
    expect(readPlayerForm({ ...base, name: "Ana" }).values.number).toBeNull();
    expect(readPlayerForm({ ...base, name: "Ana", number: 0 }).values.number).toBe(0);
  });
  it("marca cada campo que no vale", () => {
    const { errors } = readPlayerForm({ ...base, name: " a ", number: "100", phone: "abc", email: "sin-arroba" });
    expect(Object.keys(errors).sort()).toEqual(["email", "name", "number", "phone"]);
  });
});

describe("PlayerDialog", () => {
  it("añadir: manda todos los datos limpios con el equipo elegido", async () => {
    const { onSave } = setup();
    expect(screen.getByRole("dialog", { name: "Añadir jugador" })).toBeTruthy();
    type("Nombre y apellidos", "  Ana  García ");
    fireEvent.change(field("Equipo"), { target: { value: "masculino" } });
    fireEvent.change(field("Posición"), { target: { value: "Líbero" } });
    type("Dorsal", "12");
    await submit();
    expect(onSave).toHaveBeenCalledWith({ name: "Ana García", team_id: "masculino", position: "Líbero", number: 12, phone: null, email: null });
  });

  it("no envía con el nombre vacío y lo dice en su campo", async () => {
    const { onSave } = setup();
    type("Nombre y apellidos", "   ");
    await submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(field("Nombre y apellidos").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Escribe su nombre y apellidos")).toBeTruthy();
    // Al escribir, el aviso se va.
    type("Nombre y apellidos", "Ana");
    expect(screen.queryByText("Escribe su nombre y apellidos")).toBeNull();
  });

  it("el dorsal solo admite cifras", () => {
    setup();
    type("Dorsal", "1a2");
    expect(field("Dorsal").value).toBe("12");
  });

  it("dorsal repetido (409): el aviso va en el campo Dorsal y se puede volver a intentar", async () => {
    const { onSave } = setup();
    onSave.mockRejectedValueOnce(apiError("Ese dorsal ya está en uso en este equipo", 409));
    type("Nombre y apellidos", "Ana García");
    type("Dorsal", "7");
    await submit();
    expect(field("Dorsal").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Ese dorsal ya está en uso en este equipo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Añadir" }).disabled).toBe(false);
    type("Dorsal", "8");
    await submit();
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("otros errores del servidor salen en un aviso", async () => {
    const { onSave } = setup();
    onSave.mockRejectedValueOnce(apiError("No se ha podido conectar con el servidor", 0));
    type("Nombre y apellidos", "Ana García");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("No se ha podido conectar con el servidor");
  });

  it("editar: rellena sus datos y manda solo lo que cambia", async () => {
    const { onSave } = setup({ player: PLAYER });
    expect(screen.getByRole("dialog", { name: "Editar jugador" })).toBeTruthy();
    expect(field("Nombre y apellidos").value).toBe("Lucía Pérez");
    expect(field("Dorsal").value).toBe("7");
    expect(field("Teléfono").value).toBe("600 111 222");
    type("Dorsal", "");
    type("Correo", "");
    await submit();
    expect(onSave).toHaveBeenCalledWith({ number: null, email: null });
  });

  it("editar: cambiar de equipo avisa de que vuelve al banquillo y manda el equipo", async () => {
    const { onSave } = setup({ player: PLAYER });
    expect(screen.getByText(/empieza en el banquillo/)).toBeTruthy();
    fireEvent.change(field("Equipo"), { target: { value: "masculino" } });
    await submit();
    expect(onSave).toHaveBeenCalledWith({ team_id: "masculino" });
  });

  it("editar sin cambios cierra sin llamar al servidor", async () => {
    const { onSave, onClose } = setup({ player: PLAYER });
    await submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("con cuenta: el equipo no se cambia aquí y no se puede quitar", async () => {
    const { onSave, onDelete } = setup({ player: LINKED, onDelete: vi.fn() });
    expect(field("Equipo").disabled).toBe(true);
    expect(screen.getByText(/su equipo se cambia desde Usuarios/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Quitar de la plantilla" })).toBeNull();
    expect(screen.getByText(/quítale el equipo o el acceso desde Usuarios/)).toBeTruthy();
    type("Nombre y apellidos", "Marta Ruiz López");
    await submit();
    expect(onSave).toHaveBeenCalledWith({ name: "Marta Ruiz López" });
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("quitar de la plantilla pide confirmación", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    setup({ player: PLAYER, onDelete });
    fireEvent.click(screen.getByRole("button", { name: "Quitar de la plantilla" }));
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Quitar de la plantilla" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sí, quitar" })));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("sin onDelete no ofrece quitar", () => {
    setup({ player: PLAYER });
    expect(screen.queryByRole("button", { name: "Quitar de la plantilla" })).toBeNull();
  });

  it("mientras guarda no se puede cerrar con Escape", async () => {
    let finish;
    const { onSave, onClose } = setup();
    onSave.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    type("Nombre y apellidos", "Ana García");
    await submit();
    expect(screen.getByRole("button", { name: "Guardando…" }).disabled).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish());
  });
});
