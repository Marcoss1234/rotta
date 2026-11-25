import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/app/clubIdentity.js", () => ({
  useClubIdentity: () => ({ name: "Club Prueba", crest: "/escudo.png", custom: { name: true } }),
}));
import WelcomeCard from "./WelcomeCard.jsx";
import { resetWelcomeForTests, useWelcomeVisible } from "@/app/welcome.js";

const PLAYER = { id: "u1", role: "jugador" };
const FAMILY = { id: "u2", role: "familia" };
const show = (user) => render(<MemoryRouter><WelcomeCard user={user} /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  act(() => resetWelcomeForTests());
});

describe("WelcomeCard", () => {
  it("la primera vez sale, con el nombre del club y tres atajos", () => {
    show(PLAYER);
    expect(screen.getByRole("heading", { name: "Te damos la bienvenida a Club Prueba" })).toBeTruthy();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/app/chat", "/app/perfil", "/app/ranking"]);
  });

  it("a una familia no le manda al ranking (no lo ve), sino a los eventos", () => {
    show(FAMILY);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/app/chat", "/app/perfil", "/app/eventos"]);
  });

  it("sale una sola vez en este móvil: en otra visita ya no", () => {
    const first = show(PLAYER);
    first.unmount();
    // Otra visita (la app se vuelve a abrir): ya está apuntada como vista.
    act(() => resetWelcomeForTests());
    show(PLAYER);
    expect(screen.queryByTestId("welcome-card")).toBeNull();
  });

  it("en la misma visita sigue a la vista al volver a Inicio, hasta que se cierra", () => {
    const first = show(PLAYER);
    first.unmount();
    show(PLAYER);
    expect(screen.getByTestId("welcome-card")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar la bienvenida" }));
    expect(screen.queryByTestId("welcome-card")).toBeNull();
  });

  it("cada persona tiene la suya (otra cuenta en el mismo móvil la ve)", () => {
    show(PLAYER).unmount();
    act(() => resetWelcomeForTests());
    show(FAMILY);
    expect(screen.getByTestId("welcome-card")).toBeTruthy();
  });

  it("usar un atajo también la cierra", () => {
    show(PLAYER);
    fireEvent.click(screen.getByRole("link", { name: /Saluda en el chat/ }));
    expect(screen.queryByTestId("welcome-card")).toBeNull();
  });

  it("mientras está a la vista, avisa (para que el aviso del menú espere)", () => {
    const { result } = renderHook(() => useWelcomeVisible());
    expect(result.current).toBe(false);
    show(PLAYER);
    expect(result.current).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar la bienvenida" }));
    expect(result.current).toBe(false);
  });
});
