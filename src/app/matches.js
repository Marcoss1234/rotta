export const MATCH_KINDS = [
  { value: "amistoso", label: "Amistoso" },
  { value: "liga", label: "Liga" },
  { value: "torneo", label: "Torneo" },
  { value: "otro", label: "Otro" },
];

export const matchKindLabel = (kind) => MATCH_KINDS.find((item) => item.value === kind)?.label ?? "Partido";

export function setsWon(sets) {
  const won = sets.filter((set) => set.us > set.them).length;
  return { won, lost: sets.length - won };
}

// Fecha de hoy en el móvil, como AAAA-MM-DD.
export const localToday = () => new Date().toLocaleDateString("sv-SE");

const fromIso = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export function matchDayLabel(iso) {
  const today = fromIso(localToday());
  const days = Math.round((fromIso(iso) - today) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  const label = fromIso(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const mapsUrl = (place) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

// Solo se abren tal cual los enlaces de mapas conocidos; cualquier otro enlace se trata como texto.
function isMapLink(url) {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^www\./, "");
  if (host === "maps.app.goo.gl" || host === "maps.apple.com" || host === "maps.google.com") return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  return /^google\.[a-z.]{2,6}$/.test(host) && url.pathname.startsWith("/maps");
}

// El lugar puede ser una dirección, un enlace de Google Maps pegado de WhatsApp, o las dos cosas.
export function placeInfo(location) {
  const text = location.trim();
  const found = text.match(/https?:\/\/\S+/);
  if (found) {
    try {
      const url = new URL(found[0]);
      if (isMapLink(url)) {
        const label = text.replace(found[0], "").replace(/\s{2,}/g, " ").trim();
        return { label: label || "Ubicación en el mapa", url: url.href };
      }
    } catch {
      // Enlace mal escrito: se queda como texto.
    }
  }
  return { label: text, url: mapsUrl(text) };
}
