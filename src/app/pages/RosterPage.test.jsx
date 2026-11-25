import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/app/api.js", () => ({
  listTeams: vi.fn(),
  listPlayers: vi.fn(),
  listTeamFamily: vi.fn(),
  createPlayer: vi.fn(),
  updatePlayer: vi.fn(),
  deletePlayer: vi.fn(),
  getPlayerProfile: vi.fn(),
}));
// El personaje en 3D no hace falta aquí (y jsdom no tiene WebGL).
vi.mock("@/app/character/AvatarStage.jsx", () => ({ default: () => null }));
import * as api from "@/app/api.js";
import RosterPage from "./RosterPage.jsx";

const TEAMS = [{ id: "femenino", name: "Club Senior Femenino" }, { id: "masculino", name: "Club Masculino" }];
const player = (id, name, extra = {}) => ({ id, team_id: "femenino", name, position: "Sin definir", preferred_positions: [], number: null, court: null, linked: false, picture: "", ...extra });
const LUCIA = player("p1", "Lucía Pérez", { position: "Central", number: 7, phone: "600 111 222", email: "lucia@example.com" });
const MARTA = player("p2", "Marta Ruiz", { position: "Líbero", number: 3, court: { x: 0.5, y: 0.8 }, linked: true });
const COACH = { team_id: "femenino", role: "entrenador" };
const PLAYER_USER = { team_id: "femenino", role: "jugador" };
const apiError = (message, status) => Object.assign(new Error(message), { status });

async function renderPage({ user = COACH, players = [LUCIA, MARTA], onAccessLost = vi.fn() } = {}) {
  api.listTeams.mockResolvedValue(TEAMS);
  api.listPlayers.mockResolvedValue(players);
  api.listTeamFamily.mockResolvedValue([]);
  api.getPlayerProfile.mockImplementation((id) => new Promise(() => id));
  await act(async () => {
    render(<MemoryRouter initialEntries={["/app/plantillas"]}><RosterPage user={user} onAccessLost={onAccessLost} /></MemoryRouter>);
  });
  return { onAccessLost };
}
const showList = () => fireEvent.click(screen.getByRole("tab", { name: /Jugadores/ }));
const openProfile = (name) => fireEvent.click(screen.getByRole("button", { name: `Ver la ficha de ${name}` }));

beforeEach(() => vi.clearAllMocks());

describe("Plantilla", () => {
  it("en el móvil: dos vistas, Pista y Jugadores (con el número)", async () => {
    await renderPage();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Pista", "Jugadores2"]);
    expect(screen.getByTestId("court")).toBeTruthy();
    expect(screen.queryByTestId("roster-list")).toBeNull();
    showList();
    expect(screen.queryByTestId("court")).toBeNull();
    expect(within(screen.getByTestId("roster-list")).getAllByRole("button")).toHaveLength(2);
  });

  it("en el ordenador: pista y jugadores a la vez, en dos columnas y sin pestañas", async () => {
    window.matchMedia = (query) => ({ matches: query === "(min-width: 1024px)", addEventListener() {}, removeEventListener() {} });
    try {
      await renderPage();
      expect(screen.queryByRole("tab")).toBeNull();
      const columns = screen.getByTestId("roster-columns");
      expect(within(columns).getByTestId("court")).toBeTruthy();
      expect(within(columns).getByTestId("roster-list")).toBeTruthy();
    } finally {
      delete window.matchMedia;
    }
  });

  it("resumen por posición (encima de la lista) y contacto para el cuerpo técnico", async () => {
    await renderPage();
    expect(screen.queryByRole("list", { name: "Jugadores por posición" })).toBeNull();
    showList();
    const summary = screen.getByRole("list", { name: "Jugadores por posición" });
    expect(within(summary).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["1Líbero", "1Central"]);
    expect(screen.getByText("600 111 222")).toBeTruthy();
  });

  it("lista vacía: lo dice y el entrenador puede añadir desde ahí", async () => {
    await renderPage({ players: [] });
    showList();
    expect(screen.getByText("Este equipo aún no tiene jugadores. Añade el primero.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Añadir jugador" }));
    expect(screen.getByRole("dialog", { name: "Añadir jugador" })).toBeTruthy();
  });

  it("un jugador no ve Añadir ni Editar, y la pista es solo para mirar", async () => {
    await renderPage({ user: PLAYER_USER, players: [player("p1", "Lucía Pérez", { position: "Central", number: 7 })] });
    expect(screen.queryByRole("button", { name: "Añadir" })).toBeNull();
    expect(screen.queryByTestId("court-token")).toBeNull();
    showList();
    openProfile("Lucía Pérez");
    expect(screen.getByRole("dialog", { name: "Lucía Pérez" })).toBeTruthy();
    expect(screen.queryByTestId("profile-staff-actions")).toBeNull();
  });

  it("editar desde la ficha: abre el formulario relleno, Cancelar vuelve a la ficha", async () => {
    await renderPage();
    showList();
    openProfile("Lucía Pérez");
    fireEvent.click(screen.getByRole("button", { name: "Editar datos" }));
    expect(screen.getByRole("dialog", { name: "Editar jugador" })).toBeTruthy();
    expect(screen.getByLabelText("Teléfono").value).toBe("600 111 222");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog", { name: "Editar jugador" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Lucía Pérez" })).toBeTruthy();
  });

  it("editar y guardar: manda solo lo cambiado, recarga y vuelve a la ficha al día", async () => {
    await renderPage();
    api.updatePlayer.mockResolvedValue({ ...LUCIA, number: 9 });
    showList();
    openProfile("Lucía Pérez");
    fireEvent.click(screen.getByRole("button", { name: "Editar datos" }));
    fireEvent.change(screen.getByLabelText("Dorsal", { exact: false }), { target: { value: "9" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar" })));
    expect(api.updatePlayer).toHaveBeenCalledWith("p1", { number: 9 });
    expect(api.listPlayers).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("dialog", { name: "Lucía Pérez" })).toBeTruthy();
  });

  it("cambiar de equipo al guardar lleva al nuevo equipo", async () => {
    await renderPage();
    api.updatePlayer.mockResolvedValue({ ...LUCIA, team_id: "masculino" });
    showList();
    openProfile("Lucía Pérez");
    fireEvent.click(screen.getByRole("button", { name: "Editar datos" }));
    fireEvent.change(screen.getByLabelText("Equipo"), { target: { value: "masculino" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar" })));
    expect(api.updatePlayer).toHaveBeenCalledWith("p1", { team_id: "masculino" });
    expect(api.listPlayers).toHaveBeenLastCalledWith("masculino");
    expect(screen.getByRole("button", { name: "Masculino" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("con cuenta: en la ficha no se ofrece quitar, se explica por qué", async () => {
    await renderPage();
    showList();
    openProfile("Marta Ruiz");
    expect(screen.queryByRole("button", { name: "Quitar de la plantilla" })).toBeNull();
    expect(screen.getByText(/quítale el equipo o el acceso desde Usuarios/)).toBeTruthy();
  });

  it("quitar falla: el aviso sale en la ficha", async () => {
    await renderPage();
    api.deletePlayer.mockRejectedValue(apiError("Algo ha fallado. Inténtalo de nuevo", 500));
    showList();
    openProfile("Lucía Pérez");
    fireEvent.click(screen.getByRole("button", { name: "Quitar de la plantilla" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sí, quitar" })));
    expect(within(screen.getByRole("dialog", { name: "Lucía Pérez" })).getByRole("alert").textContent).toBe("Algo ha fallado. Inténtalo de nuevo");
  });

  it("cambiar el puesto desde la pista; si el servidor falla, vuelve al anterior", async () => {
    await renderPage();
    api.updatePlayer.mockRejectedValue(apiError("No se ha podido conectar con el servidor", 0));
    const token = screen.getAllByTestId("court-token").find((item) => item.dataset.player === "Marta Ruiz");
    fireEvent.keyDown(token, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: /Marta Ruiz/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Líbero" }).getAttribute("aria-pressed")).toBe("true");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Opuesto" })));
    expect(api.updatePlayer).toHaveBeenCalledWith("p2", { position: "Opuesto" });
    expect(screen.getByRole("alert").textContent).toBe("No se ha podido conectar con el servidor");
    // Vuelve a Líbero.
    expect(screen.getByRole("button", { name: /Mover a Marta Ruiz, dorsal 3, Líbero/ })).toBeTruthy();
  });

  it("teclado en la pista: flechas mueven la chapa y Suprimir la devuelve al banquillo", async () => {
    await renderPage();
    api.updatePlayer.mockResolvedValue({});
    const marta = () => screen.getByRole("button", { name: /Mover a Marta Ruiz/ });
    await act(async () => fireEvent.keyDown(marta(), { key: "ArrowRight" }));
    expect(api.updatePlayer).toHaveBeenLastCalledWith("p2", { court: { x: 0.52, y: 0.8 } });
    await act(async () => fireEvent.keyDown(marta(), { key: "Delete" }));
    expect(api.updatePlayer).toHaveBeenLastCalledWith("p2", { court: null });
    expect(within(screen.getByTestId("court-bench")).getAllByTestId("court-token")).toHaveLength(2);
  });

  it("mover una chapa falla: vuelve a su sitio", async () => {
    await renderPage();
    api.updatePlayer.mockRejectedValue(apiError("No se ha podido conectar con el servidor", 0));
    const lucia = screen.getByRole("button", { name: /Mover a Lucía Pérez/ });
    expect(within(screen.getByTestId("court-bench")).getAllByTestId("court-token")).toHaveLength(1);
    await act(async () => fireEvent.keyDown(lucia, { key: "ArrowUp" }));
    expect(api.updatePlayer).toHaveBeenCalledWith("p1", { court: { x: 0.5, y: 0.73 } });
    expect(within(screen.getByTestId("court-bench")).getAllByTestId("court-token")).toHaveLength(1);
  });

  it("un 403 al mover la chapa avisa de que se ha perdido el acceso", async () => {
    const { onAccessLost } = await renderPage();
    api.updatePlayer.mockRejectedValue(apiError("Solo para entrenadores y administradores", 403));
    await act(async () => fireEvent.keyDown(screen.getByRole("button", { name: /Mover a Marta Ruiz/ }), { key: "ArrowLeft" }));
    expect(onAccessLost).toHaveBeenCalled();
  });

  it("ventanita de puesto: el foco empieza en su puesto actual, no en el primero", async () => {
    await renderPage();
    fireEvent.keyDown(screen.getByRole("button", { name: /Mover a Marta Ruiz/ }), { key: "Enter" });
    expect(document.activeElement.textContent).toBe("Líbero");
    expect(within(screen.getByRole("dialog", { name: /Marta Ruiz/ })).getAllByRole("button", { pressed: true }).map((item) => item.textContent)).toEqual(["Líbero"]);
  });

  it("chapas: el puesto se escribe a 12 px en su color, y el líbero lleva la chapa de su color", async () => {
    await renderPage();
    const marta = screen.getByRole("button", { name: /Mover a Marta Ruiz/ });
    const role = within(marta).getByText("Líbero");
    expect(role.className).toContain("text-xs");
    expect(role.className).toContain("text-sky-300");
    expect(within(marta).getByText("3").className).toContain("bg-sky-400");
    expect(within(screen.getByRole("button", { name: /Mover a Lucía Pérez/ })).getByText("7").className).toContain("border-amber-400");
  });

  it("gradas vacías: una línea, sin asientos", async () => {
    await renderPage();
    const stands = screen.getByTestId("court-stands");
    expect(stands.textContent).toContain("Todavía no hay familias en este equipo.");
    expect(within(stands).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("gradas con familias: sus asientos con cada persona", async () => {
    api.listTeamFamily.mockResolvedValue([{ id: "f1", name: "Rosa Jiménez", picture: "" }]);
    api.listTeams.mockResolvedValue(TEAMS);
    api.listPlayers.mockResolvedValue([LUCIA]);
    api.getPlayerProfile.mockImplementation(() => new Promise(() => {}));
    await act(async () => {
      render(<MemoryRouter><RosterPage user={COACH} onAccessLost={() => {}} /></MemoryRouter>);
    });
    expect(within(screen.getByTestId("court-stands")).getByText("Rosa")).toBeTruthy();
  });
});
