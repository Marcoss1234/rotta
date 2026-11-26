import { describe, expect, it } from "vitest";
import { buildRottaTheme, contrast, mix, stageZones, STAGE_ROTTA_GLOW, themeContrastChecks } from "./theme.js";
import { STYLES } from "./themes.js";

// Escenario (Premium deportivo): el resplandor nunca puede perjudicar la lectura, con ningún color de club.
// tools/comprobar-temas.mjs barre miles de colores; aquí quedan fijados los extremos y el comportamiento.

const EXTREMES = {
  blancos: ["#FFFFFF", "#FAFAFA", "#FFF7D6"],
  amarillos: ["#FFFF00", "#FFEB00", "#FDE047"],
  dorados: ["#F5C542", "#E8B923", "#D4A017", "#B8860B"],
  "muy oscuros": ["#000000", "#0B0C0F", "#050A1F", "#1A0000", "#00140A", "#140A1F"],
};
const NORMAL = ["#7C3AED", "#E11D2E", "#1D4ED8", "#15803D", "#FF4D00"];
const MODES = ["dark", "light"];
const STAGE_CHECK = /escenario|resplandor|ventana|Borde de tarjeta|Elegido|gráfica/;

describe("todo lo del escenario se lee con colores de club extremos", () => {
  for (const [kind, colors] of Object.entries(EXTREMES)) {
    it.each(STYLES)(`%s con clubs ${kind}`, (style) => {
      for (const mode of MODES) {
        for (const brand of colors) {
          for (const accent of [brand, "#FFFFFF", "#000000"]) {
            const theme = buildRottaTheme(style, mode, brand, accent);
            for (const [name, color, ground, minimum] of themeContrastChecks(theme).filter(([name]) => STAGE_CHECK.test(name))) {
              expect(contrast(color, ground), `${style} ${mode} ${brand}: ${name}`).toBeGreaterThanOrEqual(minimum - 1e-9);
            }
          }
        }
      }
    });
  }
});

describe("resplandor del club", () => {
  it.each(STYLES)("%s: con un color de club normal, el resplandor es el color del club tal cual", (style) => {
    for (const brand of NORMAL) expect(buildRottaTheme(style, "dark", brand).glowClub.toUpperCase()).toBe(brand);
  });

  it.each(STYLES)("%s: con un club blanco, amarillo o dorado, se oscurece sin cambiar de tono", (style) => {
    for (const brand of ["#FFFFFF", "#FFFF00", "#F5C542"]) {
      const { glowClub } = buildRottaTheme(style, "dark", brand);
      expect(glowClub.toUpperCase()).not.toBe(brand);
      // Oscurecer es mezclar con negro: la proporción entre canales se mantiene (mismo tono).
      const [r, g, b] = [1, 3, 5].map((index) => Number.parseInt(glowClub.slice(index, index + 2), 16));
      const [R, G, B] = [1, 3, 5].map((index) => Number.parseInt(brand.slice(index, index + 2), 16));
      if (G && g) expect(Math.abs(r / g - R / G)).toBeLessThan(0.1);
      if (G && g) expect(Math.abs(b / g - B / G)).toBeLessThan(0.1);
    }
  });

  it.each(STYLES)("%s: el escenario es igual en claro y en oscuro", (style) => {
    for (const brand of [...NORMAL, "#FFFFFF", "#000000"]) {
      const dark = buildRottaTheme(style, "dark", brand);
      const light = buildRottaTheme(style, "light", brand);
      for (const key of ["stage", "stageText", "stageMuted", "glowClub", "glowRotta", "clubOnStage", "rottaOnStage", "stageEdge"]) {
        expect(light[key], `${style} ${brand} ${key}`).toBe(dark[key]);
      }
    }
  });

  it("las zonas son el fondo, cada resplandor y donde se juntan", () => {
    const zones = stageZones("#0A1230", "#7C3AED", "#8FA8FF", 0.45);
    expect(zones).toHaveLength(4);
    expect(zones[0]).toBe("#0A1230");
    expect(zones[1]).toBe(mix("#0A1230", "#7C3AED", 0.45));
    expect(zones[3]).toBe(mix(zones[1], "#8FA8FF", STAGE_ROTTA_GLOW));
  });
});

describe("botón principal sobre el escenario", () => {
  it.each(STYLES)("%s: un club muy oscuro lleva borde para no desaparecer", (style) => {
    for (const brand of EXTREMES["muy oscuros"]) {
      const theme = buildRottaTheme(style, "dark", brand);
      expect(theme.stageEdge).not.toBe(brand);
      for (const zone of stageZones(theme.stage, theme.glowClub, theme.glowRotta, theme.glow)) {
        expect(contrast(theme.stageEdge, zone)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it.each(STYLES)("%s: un club claro que ya se distingue no necesita borde", (style) => {
    expect(buildRottaTheme(style, "dark", "#FFFFFF").stageEdge).toBe("#FFFFFF");
    expect(buildRottaTheme(style, "dark", "#FFEB00").stageEdge).toBe("#FFEB00");
  });
});

describe("el segundo color del club no cambia nada del escenario", () => {
  it.each(STYLES)("%s: con cualquier segundo color, el escenario es el mismo", (style) => {
    for (const brand of [...NORMAL, "#FFFFFF", "#000000"]) {
      const base = buildRottaTheme(style, "dark", brand, brand);
      for (const accent of ["#FFFFFF", "#000000", "#22D3EE", "#F5C542"]) {
        const other = buildRottaTheme(style, "dark", brand, accent);
        for (const key of ["glowClub", "glowRotta", "clubOnStage", "rottaOnStage", "stageEdge"]) expect(other[key]).toBe(base[key]);
      }
    }
  });
});

describe("botón principal fuera del escenario", () => {
  it.each(STYLES)("%s: un club blanco en claro y uno casi negro en oscuro llevan borde; uno normal no lo necesita", (style) => {
    const white = buildRottaTheme(style, "light", "#FFFFFF");
    const black = buildRottaTheme(style, "dark", "#0B0C0F");
    for (const theme of [white, black]) {
      expect(theme.clubEdge).not.toBe(theme.club);
      for (const ground of [theme.surface, theme.bg, theme.raised]) expect(contrast(theme.clubEdge, ground)).toBeGreaterThanOrEqual(3);
    }
    // Un color que ya se distingue no cambia: morado en claro, rojo en oscuro.
    expect(buildRottaTheme(style, "light", "#7C3AED").clubEdge).toBe("#7C3AED");
    expect(buildRottaTheme(style, "dark", "#E11D2E").clubEdge).toBe("#E11D2E");
  });
});
