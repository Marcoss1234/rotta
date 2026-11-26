import { afterEach, describe, expect, it, vi } from "vitest";
import example from "../../tools/estructura-ejemplo.json";
import { groupOfTeam, loadClubStructure, ownGroupOf } from "./teams.js";

describe("grupo del ranking por defecto", () => {
  it("con los equipos de serie: el de su equipo (la Escuela junta dos)", () => {
    expect(ownGroupOf({ team_id: "masculino" })).toBe("masculino");
    expect(ownGroupOf({ team_id: "escuela-mj" })).toBe("escuela");
    expect(groupOfTeam("playa")).toBeNull();
    expect(ownGroupOf({ team_id: "playa" })).toBeNull();
  });

  it("un entrenador sin equipo: el del primer equipo que entrena", () => {
    expect(ownGroupOf({ team_id: null, coached_team_ids: ["playa", "escuela-lm"] })).toBe("escuela");
    expect(ownGroupOf({})).toBeNull();
  });

  describe("con los equipos de otro club", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("no supone nombres: un jugador del Alevín B abre el grupo Alevín", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => example })));
      await loadClubStructure();
      expect(ownGroupOf({ team_id: "alevin-b" })).toBe("alevin");
      expect(ownGroupOf({ team_id: "senior" })).toBe("senior");
      expect(ownGroupOf({ team_id: "escuela-mj" })).toBeNull();
    });
  });
});
