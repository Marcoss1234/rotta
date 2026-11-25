import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// Pantallas de antes de entrar: permisos, acceso pendiente o rechazado y contraseña temporal.
vi.mock("@/app/api.js", () => ({
  logout: vi.fn().mockResolvedValue(null),
  saveConsent: vi.fn(),
  changePassword: vi.fn(),
}));
vi.mock("@/app/clubIdentity.js", () => ({
  ROTTA: { name: "Rotta", crest: "/rotta-logo.svg" },
  useClubIdentity: () => ({ name: "Club Prueba", crest: "/escudo.png", custom: { name: true, crest: true } }),
}));
import * as api from "@/app/api.js";
import AccessStatusPage from "./AccessStatusPage.jsx";
import ChangePasswordPage from "./ChangePasswordPage.jsx";
import ConsentPage from "./ConsentPage.jsx";

const USER = { id: "u1", name: "Ana Prueba", username: "ana.prueba", email: null, status: "pending" };
const apiError = (message, status) => Object.assign(new Error(message), { status });

beforeEach(() => vi.clearAllMocks());

describe("ConsentPage", () => {
  const setup = (props = {}) => {
    const onSaved = vi.fn();
    const onSignedOut = vi.fn();
    render(<ConsentPage user={USER} onSaved={onSaved} onSignedOut={onSignedOut} {...props} />);
    return { onSaved, onSignedOut };
  };
  const accept = () => screen.getByRole("button", { name: /Aceptar y entrar/ });

  it("no se puede aceptar hasta elegir edad, fotos y marcar la política", () => {
    setup();
    expect(accept().disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /14 años o más/ }));
    fireEvent.click(screen.getByRole("radio", { name: /sin foto/ }));
    expect(accept().disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(accept().disabled).toBe(false);
  });

  it("menor de 14: pide el nombre de quien da el permiso (3 letras o más) y lo manda", async () => {
    const { onSaved } = setup();
    api.saveConsent.mockResolvedValue({ id: "u1" });
    fireEvent.click(screen.getByRole("radio", { name: /menor de 14/ }));
    fireEvent.click(screen.getByRole("radio", { name: /se puede ver mi foto/ }));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(accept().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/madre, el padre o el tutor/), { target: { value: "  Luis Prueba " } });
    expect(accept().disabled).toBe(false);
    await act(async () => fireEvent.click(accept()));
    expect(api.saveConsent).toHaveBeenCalledWith({ adult: false, photos: true, guardian_name: "Luis Prueba" });
    expect(onSaved).toHaveBeenCalledWith({ id: "u1" });
  });

  it("mayor de 14: no manda tutor; si el servidor falla, lo dice", async () => {
    setup();
    api.saveConsent.mockRejectedValue(apiError("Algo ha fallado. Inténtalo de nuevo", 500));
    fireEvent.click(screen.getByRole("radio", { name: /14 años o más/ }));
    fireEvent.click(screen.getByRole("radio", { name: /sin foto/ }));
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => fireEvent.click(accept()));
    expect(api.saveConsent).toHaveBeenCalledWith({ adult: true, photos: false, guardian_name: null });
    expect(screen.getByRole("alert").textContent).toMatch(/Algo ha fallado/);
  });

  it("No acepto: cierra la sesión", async () => {
    const { onSignedOut } = setup();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /No acepto/ })));
    expect(api.logout).toHaveBeenCalled();
    expect(onSignedOut).toHaveBeenCalled();
  });

  it("desde Perfil: viene relleno, sin casilla de la política, con Guardar y Cancelar", async () => {
    const onCancel = vi.fn();
    const { onSaved } = setup({ initial: { adult: true, photos: true }, onCancel });
    api.saveConsent.mockResolvedValue({ id: "u1" });
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("radio", { name: /se puede ver mi foto/ }).getAttribute("aria-checked") ?? String(screen.getByRole("radio", { name: /se puede ver mi foto/ }).checked)).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /sin foto/ }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar permisos" })));
    expect(api.saveConsent).toHaveBeenCalledWith({ adult: true, photos: false, guardian_name: null });
    expect(onSaved).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("AccessStatusPage", () => {
  it("pendiente: comprobar de nuevo y cerrar sesión; enseña con qué cuenta has entrado", async () => {
    const onRefresh = vi.fn();
    const onSignedOut = vi.fn();
    render(<AccessStatusPage user={USER} onRefresh={onRefresh} onSignedOut={onSignedOut} />);
    expect(screen.getByText("@ana.prueba")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar de nuevo" }));
    expect(onRefresh).toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" })));
    expect(api.logout).toHaveBeenCalled();
    expect(onSignedOut).toHaveBeenCalled();
  });

  it("rechazado: no hay comprobar de nuevo", () => {
    render(<AccessStatusPage user={{ ...USER, status: "rejected" }} onRefresh={vi.fn()} onSignedOut={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/No tienes acceso/);
    expect(screen.queryByRole("button", { name: "Comprobar de nuevo" })).toBeNull();
  });
});

describe("ChangePasswordPage (contraseña temporal)", () => {
  const setup = () => {
    const onChanged = vi.fn();
    const onSignedOut = vi.fn();
    render(<ChangePasswordPage onChanged={onChanged} onSignedOut={onSignedOut} />);
    return { onChanged, onSignedOut };
  };
  const submit = async () => act(async () => fireEvent.click(screen.getByRole("button", { name: /Cambiar contraseña/ })));

  it("la nueva necesita 8 caracteres o más", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Contraseña temporal"), { target: { value: "temporal123456" } });
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "corta" } });
    await submit();
    expect(screen.getByRole("alert").textContent).toMatch(/8 caracteres/);
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it("la cambia y avisa a la app; autocompletado correcto", async () => {
    const { onChanged } = setup();
    api.changePassword.mockResolvedValue({ id: "u1", must_change_password: false });
    expect(screen.getByLabelText("Contraseña temporal").getAttribute("autocomplete")).toBe("current-password");
    expect(screen.getByLabelText("Nueva contraseña").getAttribute("autocomplete")).toBe("new-password");
    fireEvent.change(screen.getByLabelText("Contraseña temporal"), { target: { value: "temporal123456" } });
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "nueva-segura-1" } });
    await submit();
    expect(api.changePassword).toHaveBeenCalledWith("temporal123456", "nueva-segura-1");
    expect(onChanged).toHaveBeenCalledWith({ id: "u1", must_change_password: false });
  });

  it("si la temporal no es correcta, lo dice el servidor", async () => {
    setup();
    api.changePassword.mockRejectedValue(apiError("La contraseña actual no es correcta", 400));
    fireEvent.change(screen.getByLabelText("Contraseña temporal"), { target: { value: "mala" } });
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "nueva-segura-1" } });
    await submit();
    expect(screen.getByRole("alert").textContent).toMatch(/no es correcta/);
  });

  it("cerrar sesión sale aunque no haya conexión", async () => {
    api.logout.mockRejectedValueOnce(apiError("No se ha podido conectar con el servidor", 0));
    const { onSignedOut } = setup();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" })));
    expect(onSignedOut).toHaveBeenCalled();
  });

  it("cerrar sesión", async () => {
    const { onSignedOut } = setup();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" })));
    expect(api.logout).toHaveBeenCalled();
    expect(onSignedOut).toHaveBeenCalled();
  });
});
