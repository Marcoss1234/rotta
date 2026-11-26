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
        // Campos de texto: las esquinas del tema, pero nunca de pastilla.
        field: "min(var(--radius-control), 0.875rem)",
        // Premium deportivo: piezas dentro de una tarjeta y chips (cada identidad las suyas).
        inner: "var(--radius-inner)",
        chip: "var(--radius-chip)",
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
        // Borde del botón principal y de lo relleno con el color del club (theme.js, clubEdge).
        "club-edge": themed("club-edge"),
        "club-text": themed("club-text"),
        "club-label": themed("club-label"),
        "club-soft": themed("club-soft"),
        "on-club": themed("on-club"),
        rotta: themed("rotta"),
        "rotta-text": themed("rotta-text"),
        "on-rotta": themed("on-rotta"),
        stripe: themed("stripe"),
        // Premium deportivo: ventanas y menús (overlay) y el escenario, siempre oscuro (stage).
        overlay: themed("overlay"),
        stage: themed("stage"),
        "stage-ink": themed("stage-ink"),
        "stage-muted": themed("stage-muted"),
        "stage-line": themed("stage-line"),
        // Con el color del club, ya ajustados para que el texto del escenario se lea (theme.js).
        "glow-club": themed("glow-club"),
        "glow-rotta": themed("glow-rotta"),
        "club-on-stage": themed("club-on-stage"),
        "rotta-on-stage": themed("rotta-on-stage"),
        "stage-edge": themed("stage-edge"),
        "accent-ui": themed("accent-ui"),
        "live-club": themed("live-club"),
        "live-accent": themed("live-accent"),
        voy: themed("success"),
        "voy-text": themed("success-text"),
        danger: themed("danger"),
        "danger-text": themed("danger-text"),
        gold: themed("gold"),
        "gold-text": themed("gold-text"),
        // Advertencias (ui/Notice tone="warning"): ámbar, distinto del dorado de los coins.
        warning: themed("warning"),
        "warning-text": themed("warning-text"),
        // Rojo de hoja de calendario (DateBadge): igual en todos los temas.
        calendar: themed("calendar"),
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Fondo de tarjeta del tema para los componentes de src/app/ui (a diferencia de bg-panel, no le afectan
        // las reglas antiguas de index.css para tarjetas dentro de tarjetas).
        card: { DEFAULT: themed("panel"), foreground: themed("white") },
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
      boxShadow: {
        // Sombra de las tarjetas: solo en claro (index.css); en oscuro separa el borde.
        card: "var(--shadow-card)",
        // Premium deportivo: la profundidad de cada identidad (tarjetas) y la de ventanas y menús.
        depth: "var(--shadow-depth)",
        overlay: "var(--shadow-overlay)",
      },
      fontSize: {
        // Escala de Premium deportivo: 12 · 14 · 16 · 20 · 24 (las de Tailwind: xs, sm, base, xl, 2xl) y estas tres.
        // xs: 12 px como mínimo también en el móvil compacto (allí 1 rem son 15 px).
        xs: ["max(0.75rem, 12px)", { lineHeight: "1rem" }],
        title: ["1.5rem", { lineHeight: "1.1" }],
        display: ["2.5rem", { lineHeight: "1" }],
        hero: ["4rem", { lineHeight: "0.9" }],
      },
      spacing: {
        // Margen de la pantalla (20 px en el móvil, 32 en escritorio), entre bloques (32) y dentro de las tarjetas (20 / 24).
        gutter: "var(--space-gutter)",
        section: "var(--space-section)",
        card: "var(--space-card)",
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
