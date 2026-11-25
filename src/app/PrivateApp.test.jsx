import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Las puertas de la app: qué pantalla sale según la sesión. Las pantallas de dentro se sustituyen por un texto.
vi.mock("@/app/api.js", () => ({
  getMe: vi.fn(),
  logout: vi.fn().mockResolvedValue(null),
  getAuthConfig: vi.fn().mockResolvedValue({ google_client_id: "" }),
  loginWithGoogle: vi.fn(),
  loginWithPassword: vi.fn(),
  registerAccount: vi.fn(),
  saveConsent: vi.fn(),
  changePassword: vi.fn(),
}));
vi.mock("@/app/teams.js", () => ({ loadClubStructure: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/app/clubIdentity.js", () => ({
  ROTTA: { name: "Rotta", crest: "/rotta-logo.svg" },
  useClubIdentity: () => ({ name: "Club Prueba", crest: "/escudo.png", custom: { name: true, crest: true } }),
  loadClubIdentity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/notifications.js", () => ({ syncPushSubscription: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/app/useAppViewport.js", () => ({ default: () => {} }));
vi.mock("@/app/components/AppLayout.jsx", () => ({ default: ({ children }) => <div data-testid="app-layout">{children}</div> }));
vi.mock("@/app/pages/HomePage.jsx", () => ({ default: () => <p>Pantalla de Inicio</p> }));
vi.mock("@/app/pages/AccessRequestsPage.jsx", () => ({ default: () => <p>Solicitudes</p> }));
vi.mock("@/app/pages/LiveMatchPage.jsx", () => ({ default: () => <p>Directo</p> }));
vi.mock("@/app/pages/ShopPage.jsx", () => ({ default: () => <p>Tienda</p> }));
vi.mock("@/app/pages/ChatPage.jsx", () => ({ default: () => <p>Chat</p> }));
vi.mock("@/app/pages/EventsPage.jsx", () => ({ default: () => <p>Eventos</p> }));
vi.mock("@/app/pages/PlayedMatchesPage.jsx", () => ({ default: () => <p>Partidos jugados</p> }));
vi.mock("@/app/pages/ProfilePage.jsx", () => ({ default: () => <p>Perfil</p> }));
vi.mock("@/app/pages/RankingPage.jsx", () => ({ default: () => <p>Ranking</p> }));
vi.mock("@/app/pages/RewardsPage.jsx", () => ({ default: () => <p>Premios</p> }));
vi.mock("@/app/pages/RatingSheetPage.jsx", () => ({ default: () => <p>Notas</p> }));
vi.mock("@/app/pages/RosterPage.jsx", () => ({ default: () => <p>Plantilla</p> }));
vi.mock("@/app/pages/UsersPage.jsx", () => ({ default: () => <p>Usuarios</p> }));
vi.mock("@/app/pages/BoardsPage.jsx", () => ({ default: () => <p>Pizarra</p> }));
vi.mock("@/app/pages/BoardEditorPage.jsx", () => ({ default: () => <p>Editor</p> }));

import * as api from "@/app/api.js";
import { POLICY_VERSION } from "@/app/privacy.js";
import PrivateApp from "./PrivateApp.jsx";

const CONSENT = { version: POLICY_VERSION, adult: true, photos: true };
const user = (extra = {}) => ({ id: "u1", name: "Ana Prueba", username: "ana.prueba", email: null, status: "approved", role: "jugador", team_id: "femenino", must_change_password: false, consent: CONSENT, ...extra });
const apiError = (message, status) => Object.assign(new Error(message), { status });

async function renderApp(path = "/app") {
  await act(async () => {
    // Como en App.jsx: la app vive en /app/*.
    render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/app/*" element={<PrivateApp />} /></Routes></MemoryRouter>);
  });
}

beforeEach(() => vi.clearAllMocks());

describe("PrivateApp: puertas de entrada", () => {
  it("mientras se pide la sesión, avisa de que está cargando", async () => {
    api.getMe.mockImplementation(() => new Promise(() => {}));
    await renderApp();
    expect(screen.getByRole("status").textContent).toMatch(/Cargando/);
  });

  it("sin conexión: error y Reintentar vuelve a pedir la sesión", async () => {
    api.getMe.mockRejectedValueOnce(apiError("No se ha podido conectar con el servidor", 0));
    await renderApp();
    expect(screen.getByRole("alert").textContent).toMatch(/No se ha podido conectar/);
    api.getMe.mockResolvedValueOnce(user());
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reintentar" })));
    expect(api.getMe).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Pantalla de Inicio")).toBeTruthy();
  });

  it("sin sesión (401): la pantalla de entrar", async () => {
    api.getMe.mockRejectedValue(apiError("Inicia sesión", 401));
    await renderApp();
    expect(screen.getByLabelText("Usuario")).toBeTruthy();
    expect(screen.queryByTestId("app-layout")).toBeNull();
  });

  it("con contraseña temporal: lo primero es cambiarla, antes que los permisos", async () => {
    api.getMe.mockResolvedValue(user({ must_change_password: true, consent: null, status: "pending" }));
    await renderApp();
    expect(screen.getByLabelText("Contraseña temporal")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("sin permisos aceptados (o de otra versión): los permisos, antes que el estado del acceso", async () => {
    api.getMe.mockResolvedValue(user({ status: "pending", consent: { version: "2020-01", adult: true, photos: true } }));
    await renderApp();
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
    expect(screen.queryByText(/pendiente/i)).toBeNull();
  });

  it("pendiente: el aviso de acceso pendiente", async () => {
    api.getMe.mockResolvedValue(user({ status: "pending", role: null, team_id: null }));
    await renderApp();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/pendiente/i);
    expect(screen.queryByTestId("app-layout")).toBeNull();
  });

  it("rechazado: sin acceso", async () => {
    api.getMe.mockResolvedValue(user({ status: "rejected", role: null, team_id: null }));
    await renderApp();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/No tienes acceso/);
  });

  it("aprobado: la app", async () => {
    api.getMe.mockResolvedValue(user());
    await renderApp();
    expect(screen.getByTestId("app-layout")).toBeTruthy();
    expect(screen.getByText("Pantalla de Inicio")).toBeTruthy();
  });

  it("solicitudes: un jugador vuelve a Inicio", async () => {
    api.getMe.mockResolvedValue(user());
    await renderApp("/app/solicitudes");
    expect(screen.getByText("Pantalla de Inicio")).toBeTruthy();
  });

  it("solicitudes sí para un entrenador", async () => {
    api.getMe.mockResolvedValue(user({ role: "entrenador" }));
    await renderApp("/app/solicitudes");
    expect(screen.getByText("Solicitudes")).toBeTruthy();
  });
});
