import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/app/api.js", () => ({
  listPlayedMatches: vi.fn(),
  listTeams: vi.fn(),
  changeLiveMvp: vi.fn(),
  deleteMatch: vi.fn(),
  updateMatch: vi.fn(),
}));
import * as api from "@/app/api.js";
import PlayedMatchesPage, { summarize } from "./PlayedMatchesPage.jsx";

const match = (id, kind, sets, extra = {}) => ({ id, team_id: "femenino", date: "2026-11-0" + id, time: "18:00", opponent: `Rival ${id}`, kind, location: "", notes: "", sets, can_edit: false, players: [], ...extra });
const WIN = [{ us: 25, them: 20 }, { us: 25, them: 22 }, { us: 25, them: 18 }];
const LOSS = [{ us: 20, them: 25 }, { us: 25, them: 22 }, { us: 18, them: 25 }, { us: 19, them: 25 }];

async function renderPage(matches, url = "/app/partidos/jugados?equipo=femenino") {
  api.listPlayedMatches.mockResolvedValue(matches);
  api.listTeams.mockResolvedValue([{ id: "femenino", name: "Club Senior Femenino" }]);
  await act(async () => {
    render(<MemoryRouter initialEntries={[url]}><PlayedMatchesPage user={{ team_id: "femenino" }} onAccessLost={() => {}} /></MemoryRouter>);
  });
}
const kinds = () => within(screen.getByTestId("played-kinds"));

beforeEach(() => vi.clearAllMocks());

describe("summarize (franja de resumen)", () => {
  it("cuenta victorias, derrotas y sets solo con los partidos que tienen resultado", () => {
    expect(summarize([match(1, "liga", WIN), match(2, "liga", LOSS), match(3, "liga", [])])).toEqual({ played: 3, withResult: 2, win: 1, loss: 1, draw: 0, setsFor: 4, setsAgainst: 3 });
  });
  it("sin ningún resultado no inventa ceros de victorias", () => {
    expect(summarize([match(1, "liga", [])])).toMatchObject({ played: 1, withResult: 0 });
  });
});

describe("Partidos jugados", () => {
  it("filtro por tipo: contadores, «Otros» solo si hay, y abre el tipo del primer partido", async () => {
    await renderPage([match(1, "liga", WIN), match(2, "liga", LOSS), match(3, "amistoso", WIN)]);
    expect(kinds().queryByRole("button", { name: /^Otros/ })).toBeNull();
    expect(kinds().getByRole("button", { name: /^Liga/ }).getAttribute("aria-pressed")).toBe("true");
    expect(kinds().getByRole("button", { name: /^Liga/ }).textContent).toBe("Liga2");
    expect(screen.getAllByTestId("played-match")).toHaveLength(2);
    fireEvent.click(kinds().getByRole("button", { name: /^Amistosos/ }));
    expect(screen.getAllByTestId("played-match")).toHaveLength(1);
  });

  it("respeta ?tipo= y muestra el estado vacío del tipo elegido", async () => {
    await renderPage([match(1, "liga", WIN)], "/app/partidos/jugados?equipo=femenino&tipo=torneo");
    expect(kinds().getByRole("button", { name: /^Torneo/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Todavía no hay partidos en Torneo.")).toBeTruthy();
    expect(screen.queryByTestId("played-summary")).toBeNull();
  });

  it("victoria, derrota y el resumen del tipo (con aviso de los que no tienen resultado)", async () => {
    await renderPage([match(1, "liga", WIN), match(2, "liga", LOSS), match(3, "liga", [])]);
    const [win, loss] = screen.getAllByTestId("match-result");
    expect(win.textContent).toContain("Victoria");
    expect(loss.textContent).toContain("Derrota");
    expect(screen.getByText("Resultado sin apuntar")).toBeTruthy();
    const summary = screen.getByTestId("played-summary");
    expect(summary.textContent).toContain("Partidos3");
    expect(summary.textContent).toContain("Victorias1");
    expect(summary.textContent).toContain("Derrotas1");
    expect(summary.textContent).toContain("Sets (favor–contra)4–3");
    expect(summary.textContent).toContain("1 partido sin resultado no cuenta");
  });

  it("si ningún partido tiene resultado, el resumen no enseña victorias ni sets", async () => {
    await renderPage([match(1, "liga", [])]);
    const summary = screen.getByTestId("played-summary");
    expect(summary.textContent).toContain("Sin resultados apuntados todavía.");
    expect(summary.textContent).not.toContain("Victorias");
  });

  it("MVP: el menú solo para quien edita (y cambia el MVP); el resto lo ve en dorado", async () => {
    api.changeLiveMvp.mockResolvedValue({});
    const players = [{ player_id: "p1", name: "Carmen" }, { player_id: "p2", name: "Lucía" }];
    await renderPage([
      match(1, "liga", WIN, { can_edit: true, live_id: "l1", players, mvp_player_id: "p1", mvp: "Carmen" }),
      match(2, "liga", WIN, { live_id: "l2", players, mvp: "Lucía" }),
    ]);
    const select = screen.getByRole("combobox", { name: "MVP" });
    expect(select.value).toBe("p1");
    await act(async () => fireEvent.change(select, { target: { value: "p2" } }));
    expect(api.changeLiveMvp).toHaveBeenCalledWith("l1", "p2");
    const [, readOnly] = screen.getAllByTestId("match-mvp");
    expect(readOnly.textContent).toBe("MVP·Lucía");
  });

  it("«Ver informe» solo en los partidos del directo y el lápiz solo para quien edita", async () => {
    await renderPage([match(1, "liga", WIN, { live_id: "l1", can_edit: true }), match(2, "liga", WIN)]);
    const links = screen.getAllByRole("link", { name: "Ver informe" });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/app/directo/l1");
    expect(screen.getAllByRole("button", { name: /^Editar el partido/ })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Partidos" }).getAttribute("href")).toBe("/app?equipo=femenino&pestana=partidos");
  });
});
