import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/app/api.js", () => ({
  listPendingUsers: vi.fn(),
  listTeams: vi.fn(),
  reviewAccess: vi.fn(),
}));
import * as api from "@/app/api.js";
import AccessRequestsPage from "./AccessRequestsPage.jsx";

const TEAMS = [{ id: "femenino", name: "Club Senior Femenino" }, { id: "escuela", name: "Club Escuela" }];
const PEOPLE = [
  { id: "p1", name: "Ana Prueba", username: "ana.prueba", email: null, has_password: true, picture: "" },
  { id: "p2", name: "Luis Prueba", username: null, email: "luis@ejemplo.test", has_password: false, picture: "" },
];
const apiError = (message, status) => Object.assign(new Error(message), { status });

async function renderPage(people = PEOPLE) {
  const onAccessLost = vi.fn();
  api.listPendingUsers.mockResolvedValue(people);
  api.listTeams.mockResolvedValue(TEAMS);
  await act(async () => {
    render(<MemoryRouter><AccessRequestsPage onAccessLost={onAccessLost} /></MemoryRouter>);
  });
  return { onAccessLost };
}
const card = (name) => screen.getAllByTestId("access-request").find((item) => item.textContent.includes(name));

beforeEach(() => vi.clearAllMocks());

describe("AccessRequestsPage", () => {
  it("lista quién espera, con el aviso de identidad solo para quien entra con contraseña", async () => {
    await renderPage();
    expect(screen.getAllByTestId("access-request")).toHaveLength(2);
    expect(within(card("Ana Prueba")).getByText(/confirma que es quien dice/)).toBeTruthy();
    expect(within(card("Luis Prueba")).queryByText(/confirma que es quien dice/)).toBeNull();
    expect(within(card("Luis Prueba")).getByText("luis@ejemplo.test")).toBeTruthy();
  });

  it("aceptar necesita equipo; manda rol y equipo y quita la tarjeta", async () => {
    await renderPage();
    api.reviewAccess.mockResolvedValue({});
    const ana = within(card("Ana Prueba"));
    expect(ana.getByRole("button", { name: "Aceptar" }).disabled).toBe(true);
    fireEvent.change(ana.getByLabelText("Entra como"), { target: { value: "familia" } });
    fireEvent.change(ana.getByLabelText("Equipo"), { target: { value: "escuela" } });
    await act(async () => fireEvent.click(ana.getByRole("button", { name: "Aceptar" })));
    expect(api.reviewAccess).toHaveBeenCalledWith("p1", { status: "approved", role: "familia", team_id: "escuela" });
    expect(screen.getAllByTestId("access-request")).toHaveLength(1);
  });

  it("un entrenador solo puede dar entrada como jugador o familia", async () => {
    await renderPage();
    const options = within(within(card("Ana Prueba")).getByLabelText("Entra como")).getAllByRole("option").map((option) => option.value);
    expect(options).toEqual(["jugador", "familia"]);
  });

  it("rechazar no pide equipo", async () => {
    await renderPage();
    api.reviewAccess.mockResolvedValue({});
    await act(async () => fireEvent.click(within(card("Luis Prueba")).getByRole("button", { name: "Rechazar" })));
    expect(api.reviewAccess).toHaveBeenCalledWith("p2", { status: "rejected" });
  });

  it("ya resuelta por otra persona (409): el aviso en su tarjeta, que sigue ahí", async () => {
    await renderPage();
    api.reviewAccess.mockRejectedValue(apiError("Esta solicitud ya se ha resuelto", 409));
    await act(async () => fireEvent.click(within(card("Luis Prueba")).getByRole("button", { name: "Rechazar" })));
    expect(within(card("Luis Prueba")).getByRole("alert").textContent).toMatch(/ya se ha resuelto/);
  });

  it("si ya no tienes permiso (403), avisa a la app", async () => {
    const { onAccessLost } = await renderPage();
    api.reviewAccess.mockRejectedValue(apiError("Solo para entrenadores y administradores", 403));
    await act(async () => fireEvent.click(within(card("Luis Prueba")).getByRole("button", { name: "Rechazar" })));
    expect(onAccessLost).toHaveBeenCalled();
  });

  it("sin nadie esperando, lo dice", async () => {
    await renderPage([]);
    expect(screen.getByText("No hay nadie esperando acceso.")).toBeTruthy();
  });
});
