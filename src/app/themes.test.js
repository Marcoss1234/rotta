import { describe, expect, it } from "vitest";
import { STYLES, THEMES } from "./themes.js";

// Premium deportivo: Lima, Naranja y Tinta comparten estructura, pero cada una tiene que seguir siendo
// reconocible. Aquí se comprueban los rasgos que definen a cada una (no solo su color) y que no falte nada.

const px = (value) => (value === "999px" ? Infinity : Number.parseFloat(value));
const pct = (value) => Number.parseFloat(value);
const MODE_KEYS = ["bg", "surface", "raised", "line", "control", "text", "muted", "rotta", "rottaText", "overlay", "hair", "shadow", "overlayShadow", "cardBorder"];
const HEX = /^#[0-9A-F]{6}$/i;

describe("tokens completos", () => {
  it.each(STYLES)("%s tiene todos los tokens en claro y en oscuro", (style) => {
    const theme = THEMES[style];
    for (const mode of ["dark", "light"]) {
      for (const key of MODE_KEYS) expect(theme[mode][key], `${style} ${mode} ${key}`).toBeTruthy();
      expect(theme[mode].overlay).toMatch(HEX);
      expect(["line", "none"]).toContain(theme[mode].cardBorder);
    }
    for (const key of ["bg", "text", "muted", "line"]) expect(theme.stage[key]).toMatch(HEX);
    for (const key of ["card", "inner", "control", "chip"]) expect(theme.radius[key]).toMatch(/^\d+px$/);
    expect(theme.titles.width).toMatch(/%$/);
    expect(theme.glow).toBeGreaterThan(0);
    expect(theme.glow).toBeLessThanOrEqual(0.5);
    expect(theme.motion.ms).toBeGreaterThan(0);
  });

  it.each(STYLES)("%s: lo de antes (shape, numbers) vale lo mismo que lo nuevo", (style) => {
    const theme = THEMES[style];
    expect(theme.shape).toEqual({ card: theme.radius.card, control: theme.radius.control });
    expect(theme.numbers.width).toBeTruthy();
    expect(theme.numbers.weight).toBeGreaterThan(0);
  });

  it.each(STYLES)("%s: las piezas de dentro tienen menos esquina que la tarjeta", (style) => {
    const { radius } = THEMES[style];
    expect(px(radius.inner)).toBeLessThan(px(radius.card));
  });
});

describe("cada identidad tiene su personalidad", () => {
  const { lima, naranja, tinta } = THEMES;
  const others = (style) => STYLES.filter((other) => other !== style).map((other) => THEMES[other]);

  it("cada una tiene su forma de dar profundidad, de marcar lo elegido, su adorno y sus gráficas", () => {
    for (const key of ["depth", "selected", "decoration"]) {
      expect(new Set(STYLES.map((style) => THEMES[style][key])).size, key).toBe(STYLES.length);
    }
    expect(new Set(STYLES.map((style) => THEMES[style].chart.point)).size).toBe(STYLES.length);
    expect(new Set(STYLES.map((style) => THEMES[style].chart.grid)).size).toBe(STYLES.length);
  });

  it("Lima, pista técnica: plana, esquinas rectas, números estrechos de marcador y movimiento rápido", () => {
    expect(lima.depth).toBe("plana");
    expect(lima.selected).toBe("barra");
    expect(lima.decoration).toBe("lineas");
    expect(lima.chart).toMatchObject({ point: "cuadrado", grid: "discontinua", cap: "recto" });
    for (const other of others("lima")) {
      expect(px(lima.radius.card)).toBeLessThan(px(other.radius.card));
      expect(px(lima.radius.control)).toBeLessThan(px(other.radius.control));
      expect(pct(lima.numbers.width)).toBeLessThan(pct(other.numbers.width));
      expect(pct(lima.titles.width)).toBeLessThan(pct(other.titles.width));
      expect(lima.motion.ms).toBeLessThan(other.motion.ms);
    }
    // Plana: sin sombras con desenfoque ni línea de luz; se separa con bordes.
    for (const mode of ["dark", "light"]) {
      expect(lima[mode].cardBorder).toBe("line");
      expect(lima[mode].hair).toBe("none");
      expect(lima[mode].shadow === "none" || /^0 1px 0 /.test(lima[mode].shadow)).toBe(true);
    }
  });

  it("Naranja, pabellón: con volumen, redonda, números anchos y pesados, lo elegido con el color del club", () => {
    expect(naranja.depth).toBe("volumen");
    expect(naranja.selected).toBe("relleno");
    expect(naranja.decoration).toBe("balon");
    expect(naranja.chart).toMatchObject({ point: "redondo", grid: "ninguna", cap: "redondo" });
    for (const other of others("naranja")) {
      expect(px(naranja.radius.card)).toBeGreaterThan(px(other.radius.card));
      expect(pct(naranja.numbers.width)).toBeGreaterThan(pct(other.numbers.width));
      expect(naranja.numbers.weight).toBeGreaterThan(other.numbers.weight);
      expect(naranja.titles.weight).toBeGreaterThan(other.titles.weight);
      expect(naranja.chart.line).toBeGreaterThan(other.chart.line);
    }
    // Volumen: sombras en los dos modos y sin borde.
    for (const mode of ["dark", "light"]) {
      expect(naranja[mode].shadow).not.toBe("none");
      expect(naranja[mode].cardBorder).toBe("none");
    }
  });

  it("Tinta, acta: cristal, formas suaves, números finos y el resplandor más amplio", () => {
    expect(tinta.depth).toBe("cristal");
    expect(tinta.selected).toBe("contorno");
    expect(tinta.decoration).toBe("acta");
    expect(tinta.chart).toMatchObject({ point: "hueco", grid: "continua" });
    for (const other of others("tinta")) {
      expect(tinta.numbers.weight).toBeLessThan(other.numbers.weight);
      expect(tinta.glow).toBeGreaterThan(other.glow);
    }
    // Cristal: línea de luz en oscuro; en claro, borde fino y sombra suave.
    expect(tinta.dark.hair).not.toBe("none");
    expect(tinta.light.cardBorder).toBe("line");
    expect(tinta.light.shadow).not.toBe("none");
  });
});
