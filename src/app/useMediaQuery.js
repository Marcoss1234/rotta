import { useEffect, useState } from "react";

const matches = (query) => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);

/** true mientras la pantalla cumpla la media query (p. ej. "(min-width: 1024px)"). Sin matchMedia, false. */
export function useMediaQuery(query) {
  const [value, setValue] = useState(() => matches(query));
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return undefined;
    const update = () => setValue(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return value;
}
