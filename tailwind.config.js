import tailwindcssAnimate from "tailwindcss-animate";
import { FAMILIES } from "./tools/tema-familias.js";

// Los colores van por variables (src/index.css y src/theme-palette.css): así cambian con el tema del club
// y con claro u oscuro sin tocar las clases. "snow" es blanco siempre (texto encima de un color).
const themed = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const families = Object.fromEntries(FAMILIES.map((family) => [family, Object.fromEntries(STEPS.map((step) => [step, themed(`${family}-${step}`)]))]));

/** @type {import('tailwindcss').Config} */
export default {
  blocklist: ["overline"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        // Del tema: Lima más recto, Naranja más redondo, Tinta entre medias.
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        ...families,
        white: themed("white"),
        snow: themed("snow"),
        void: themed("void"),
        surface: themed("surface"),
        panel: themed("panel"),
        tnt: themed("tnt"),
        tntdeep: themed("tntdeep"),
        ember: themed("ember"),
        onbrand: themed("onbrand"),
        onember: themed("onember"),
        // Nombres con significado (temas de Rotta). Los de arriba (void, panel, tnt, ember...) siguen valiendo
        // mientras las pantallas los usen.
        canvas: themed("void"),
        raised: themed("raised"),
        line: themed("line"),
        control: themed("control"),
        ink: themed("white"),
        "ink-muted": themed("muted"),
        club: themed("club"),
        "club-ui": themed("club-ui"),
        "club-text": themed("club-text"),
        "club-label": themed("club-label"),
        "club-soft": themed("club-soft"),
        "on-club": themed("on-club"),
        rotta: themed("rotta"),
        "rotta-text": themed("rotta-text"),
        "on-rotta": themed("on-rotta"),
        stripe: themed("stripe"),
        "accent-ui": themed("accent-ui"),
        "live-club": themed("live-club"),
        "live-accent": themed("live-accent"),
        voy: themed("success"),
        "voy-text": themed("success-text"),
        danger: themed("danger"),
        "danger-text": themed("danger-text"),
        gold: themed("gold"),
        "gold-text": themed("gold-text"),
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        // El borde por defecto de todo (index.css: `* { @apply border-border }`) sigue al tema.
        border: themed("line"),
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        // Rotta: títulos con carácter (Bricolage Grotesque) y texto limpio (Instrument Sans).
        display: ['"Bricolage Grotesque"', '"Instrument Sans"', "sans-serif"],
        body: ['"Instrument Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
