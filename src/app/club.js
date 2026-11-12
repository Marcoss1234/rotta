// De qué club es esta app. Se averigua una vez al abrirla:
// - ?club=codigo en la dirección (y se recuerda en el móvil),
// - o el subdominio, si la web está en VITE_ROOT_DOMAIN (tnt.rotta.app -> "tnt"),
// - o el último club que se usó en este móvil.
// Sin club, el servidor usa su club por defecto (instalaciones de un solo club).

const KEY = "rotta-club";
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

const read = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const remember = (slug) => {
  try {
    window.localStorage.setItem(KEY, slug);
  } catch {
    // Sin almacenamiento: vale para esta visita.
  }
};

function detectClub() {
  const fromLink = new URLSearchParams(window.location.search).get("club")?.toLowerCase();
  if (fromLink && SLUG.test(fromLink)) {
    remember(fromLink);
    return fromLink;
  }
  const root = import.meta.env.VITE_ROOT_DOMAIN;
  const host = window.location.hostname.toLowerCase();
  if (root && host.endsWith(`.${root}`)) {
    const slug = host.slice(0, -root.length - 1);
    if (SLUG.test(slug)) return slug;
  }
  const saved = read();
  return saved && SLUG.test(saved) ? saved : null;
}

export const clubSlug = detectClub();

/** Las cabeceras que dicen al servidor de qué club es la petición. */
export const clubHeaders = (headers = {}) => (clubSlug ? { ...headers, "X-Club": clubSlug } : headers);
