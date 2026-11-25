import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/api.js", () => ({
  getAuthConfig: vi.fn().mockResolvedValue({ google_client_id: "" }),
  loginWithGoogle: vi.fn(),
  loginWithPassword: vi.fn(),
  registerAccount: vi.fn(),
}));
vi.mock("@/app/clubIdentity.js", () => ({
  ROTTA: { name: "Rotta", crest: "/rotta-logo.svg" },
  useClubIdentity: () => ({ name: "Club Prueba", crest: "/escudo.png", custom: { name: true, crest: true } }),
}));
import * as api from "@/app/api.js";
import LoginPage from "./LoginPage.jsx";

const apiError = (message, status) => Object.assign(new Error(message), { status });
const setup = () => {
  const onSignedIn = vi.fn();
  render(<LoginPage onSignedIn={onSignedIn} />);
  return { onSignedIn };
};
// Entrar o Crear cuenta: hoy son botones con aria-pressed; en el rediseño, pestañas.
const mode = (name) => [...screen.queryAllByRole("tab", { name }), ...screen.queryAllByRole("button", { name }).filter((button) => button.type !== "submit")][0];
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submitButton = (name) => screen.getAllByRole("button", { name }).find((button) => button.type === "submit");
const submit = async (name) => act(async () => fireEvent.click(submitButton(name)));

beforeEach(() => vi.clearAllMocks());

describe("LoginPage", () => {
  it("se ve el club y la política de privacidad; ni Google ni la demo salen sin pedirlos", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Club Prueba");
    expect(screen.getByRole("link", { name: /Política de privacidad/ }).getAttribute("href")).toBe("/app/privacidad");
    expect(screen.queryByTestId("google-button")).toBeNull();
    expect(screen.queryByText(/Demo/)).toBeNull();
  });

  it("entrar: manda el usuario sin espacios y avisa a la app", async () => {
    const { onSignedIn } = setup();
    api.loginWithPassword.mockResolvedValue({ id: "u1" });
    type("Usuario", "  ana.prueba ");
    type("Contraseña", "secreta-123");
    await submit("Entrar");
    expect(api.loginWithPassword).toHaveBeenCalledWith("ana.prueba", "secreta-123");
    expect(onSignedIn).toHaveBeenCalledWith({ id: "u1" });
  });

  it("entrar mal: el mensaje del servidor y se puede volver a intentar", async () => {
    const { onSignedIn } = setup();
    api.loginWithPassword.mockRejectedValue(apiError("Usuario o contraseña incorrectos", 401));
    type("Usuario", "ana.prueba");
    type("Contraseña", "mala");
    await submit("Entrar");
    expect(screen.getByRole("alert").textContent).toMatch("Usuario o contraseña incorrectos");
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(submitButton("Entrar").disabled).toBe(false);
  });

  it("demasiados intentos (429): se enseña el aviso del servidor", async () => {
    setup();
    api.loginWithPassword.mockRejectedValue(apiError("Demasiados intentos. Espera unos minutos y vuelve a probar", 429));
    type("Usuario", "ana.prueba");
    type("Contraseña", "mala");
    await submit("Entrar");
    expect(screen.getByRole("alert").textContent).toMatch(/Demasiados intentos/);
  });

  it("autocompletado correcto para los gestores de contraseñas", () => {
    setup();
    expect(screen.getByLabelText("Usuario").getAttribute("autocomplete")).toBe("username");
    expect(screen.getByLabelText("Contraseña").getAttribute("autocomplete")).toBe("current-password");
    fireEvent.click(mode("Crear cuenta"));
    expect(screen.getByLabelText("Nombre y apellidos").getAttribute("autocomplete")).toBe("name");
    expect(screen.getByLabelText("Contraseña").getAttribute("autocomplete")).toBe("new-password");
  });

  it("cambiar entre Entrar y Crear cuenta borra la contraseña escrita", () => {
    setup();
    type("Contraseña", "secreta-123");
    fireEvent.click(mode("Crear cuenta"));
    expect(screen.getByLabelText("Contraseña").value).toBe("");
  });

  it("ver y ocultar la contraseña", () => {
    setup();
    const input = screen.getByLabelText("Contraseña");
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(input.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(input.type).toBe("password");
  });

  it("crear cuenta: comprueba los datos antes de llamar al servidor", async () => {
    setup();
    fireEvent.click(mode("Crear cuenta"));
    const tries = [
      [{ name: "A", user: "ana.prueba", pass: "secreta-123" }, /nombre y apellidos/],
      [{ name: "Ana Prueba", user: "Ana Prueba", pass: "secreta-123" }, /3 a 30/],
      [{ name: "Ana Prueba", user: "ana.prueba", pass: "corta" }, /8 caracteres/],
      [{ name: "Ana Prueba", user: "ana.prueba", pass: "xxana.pruebaxx" }, /no puede contener tu usuario/],
    ];
    for (const [{ name, user, pass }, message] of tries) {
      type("Nombre y apellidos", name);
      type("Usuario", user);
      type("Contraseña", pass);
      await submit("Crear cuenta");
      expect(screen.getByRole("alert").textContent).toMatch(message);
    }
    expect(api.registerAccount).not.toHaveBeenCalled();
  });

  it("crear cuenta: manda nombre limpio y usuario en minúsculas", async () => {
    const { onSignedIn } = setup();
    api.registerAccount.mockResolvedValue({ id: "u2", status: "pending" });
    fireEvent.click(mode("Crear cuenta"));
    type("Nombre y apellidos", "  Ana Prueba ");
    type("Usuario", "Ana.Prueba");
    type("Contraseña", "secreta-123");
    await submit("Crear cuenta");
    expect(api.registerAccount).toHaveBeenCalledWith({ name: "Ana Prueba", username: "ana.prueba", password: "secreta-123" });
    expect(onSignedIn).toHaveBeenCalled();
  });

  it("crear cuenta con un usuario ya en uso (409): el aviso del servidor", async () => {
    setup();
    api.registerAccount.mockRejectedValue(apiError("Ese nombre de usuario ya está en uso", 409));
    fireEvent.click(mode("Crear cuenta"));
    type("Nombre y apellidos", "Ana Prueba");
    type("Usuario", "ana.prueba");
    type("Contraseña", "secreta-123");
    await submit("Crear cuenta");
    expect(screen.getByRole("alert").textContent).toMatch(/ya está en uso/);
  });
});
