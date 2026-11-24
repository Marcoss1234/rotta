import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import MatchDialog from "./MatchDialog.jsx";

const TEAMS = [{ id: "femenino", name: "Club Senior Femenino" }, { id: "masculino", name: "Club Masculino" }];
const PLAYED = { id: "m1", team_id: "femenino", date: "2020-05-10", time: "18:00", opponent: "CV Bahía", kind: "liga", location: "", notes: "", sets: [{ us: 25, them: 20 }] };

const setup = (props = {}) => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<MatchDialog teams={TEAMS} defaultTeamId="femenino" onSave={onSave} onDelete={onDelete} onClose={onClose} {...props} />);
  return { onSave, onDelete, onClose };
};
const type = (name, value) => fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
const submit = async () => act(async () => fireEvent.click(screen.getByRole("button", { name: /^(Guardar|Crear partido)$/ })));

describe("MatchDialog", () => {
  it("crear: pide el rival y manda el equipo; un partido de hoy aún no tiene sets", async () => {
    const { onSave } = setup();
    expect(screen.getByRole("dialog", { name: "Nuevo partido" })).toBeTruthy();
    expect(screen.queryByTestId("match-result-fields")).toBeNull();
    // Vacío, el navegador no deja enviar (required); con solo espacios, avisa el formulario.
    expect(screen.getByRole("textbox", { name: "Rival" }).required).toBe(true);
    type("Rival", "   ");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("Escribe contra quién se juega");
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox", { name: "Equipo" }), { target: { value: "masculino" } });
    type("Rival", "CV Mirador");
    await submit();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ team_id: "masculino", opponent: "CV Mirador", sets: [] });
  });

  it("editar: no manda el equipo; los sets en blanco no cuentan", async () => {
    const { onSave } = setup({ match: PLAYED });
    expect(screen.getByRole("dialog", { name: "Editar partido" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Equipo" })).toBeNull();
    expect(screen.getByTestId("match-result-fields")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Añadir set" }));
    type("Set 2, puntos de Club", "22");
    type("Set 2, puntos del rival", "25");
    await submit();
    const data = onSave.mock.calls[0][0];
    expect(data).not.toHaveProperty("team_id");
    expect(data.sets).toEqual([{ us: 25, them: 20 }, { us: 22, them: 25 }]);
  });

  it("no deja guardar un set empatado ni uno a medias", async () => {
    const { onSave } = setup({ match: PLAYED });
    type("Set 1, puntos del rival", "25");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("El set 1 no puede acabar empatado");
    type("Set 1, puntos del rival", "");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("Faltan puntos en el set 1");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("los puntos solo admiten números y como mucho 5 sets", () => {
    setup({ match: PLAYED });
    type("Set 1, puntos de Club", "2a5");
    expect(screen.getByRole("textbox", { name: "Set 1, puntos de Club" }).value).toBe("25");
    for (let index = 0; index < 4; index += 1) {
      const add = screen.queryByRole("button", { name: "Añadir set" });
      if (add) fireEvent.click(add);
    }
    expect(screen.getAllByRole("textbox", { name: /puntos de Club/ })).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Añadir set" })).toBeNull();
  });

  it("borrar pide confirmación", async () => {
    const { onDelete } = setup({ match: PLAYED });
    fireEvent.click(screen.getByRole("button", { name: "Borrar partido" }));
    expect(screen.getByText(/¿Borrar este partido\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Borrar partido" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" })));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("mientras guarda no se cierra con Escape", async () => {
    let finish;
    const onSave = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const onClose = vi.fn();
    render(<MatchDialog match={PLAYED} teams={[]} defaultTeamId="femenino" onSave={onSave} onDelete={vi.fn()} onClose={onClose} />);
    await submit();
    expect(screen.getByRole("button", { name: "Guardando…" }).disabled).toBe(true);
    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish());
  });
});
