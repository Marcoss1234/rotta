import { useSyncExternalStore } from "react";
import { clubHeaders, clubSlug } from "@/app/club.js";

// El nombre y el escudo del club (backend/club_settings.py). Si el club no ha puesto los suyos,
// salen los de Rotta. Se guardan también en el móvil para que la pantalla de entrada salga ya
// con ellos, y loadClubIdentity() los pone al día al abrir la app.

export const ROTTA = { name: "Rotta", crest: "/rotta-logo.svg" };

// Cada club aparte: en un móvil con dos clubs no se mezclan.
const KEY = `rotta-club-identidad${clubSlug ? `-${clubSlug}` : ""}`;

const read = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
};

const shown = (saved) => ({ name: saved.name || ROTTA.name, crest: saved.crest || ROTTA.crest, custom: saved });

let current = shown(read());
const listeners = new Set();

function publish(saved) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Sin almacenamiento (modo privado): vale para esta visita.
  }
  current = shown(saved);
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** { name, crest, custom }: lo que se enseña y, en `custom`, lo que ha puesto el club (sin los de Rotta). */
export const useClubIdentity = () => useSyncExternalStore(subscribe, () => current);

export async function loadClubIdentity() {
  try {
    const response = await fetch("/api/club/identity", { credentials: "include", headers: clubHeaders() });
    if (response.ok) publish(await response.json());
  } catch {
    // Sin conexión: se queda con lo que había en el móvil.
  }
}

async function send(path, options) {
  let response;
  try {
    response = await fetch(path, { credentials: "same-origin", ...options, headers: clubHeaders(options.headers ?? {}) });
  } catch {
    throw new Error("No se ha podido conectar con el servidor");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : "No se ha podido guardar";
    throw new Error(response.status === 422 ? "El nombre tiene que tener entre 2 y 40 letras" : detail);
  }
  publish(data);
  return data;
}

export const saveClubName = (name) =>
  send("/api/club/identity", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });

export const uploadClubCrest = (blob) => send("/api/club/crest", { method: "PUT", headers: { "Content-Type": blob.type }, body: blob });

export const deleteClubCrest = () => send("/api/club/crest", { method: "DELETE" });

const CREST_SIZE = 256;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

// El escudo entero (sin recortar) en un cuadrado de 256 px, con su fondo transparente si lo tiene.
// Al redibujarlo también desaparecen los datos ocultos del archivo original.
export async function prepareCrest(file) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") throw new Error("Elige una imagen en PNG, JPG o WebP");
  if (file.size > MAX_FILE_BYTES) throw new Error("La imagen pesa demasiado");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No se ha podido leer esta imagen. Prueba con otra en PNG o JPG");
  }
  const scale = Math.min(CREST_SIZE / bitmap.width, CREST_SIZE / bitmap.height);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = CREST_SIZE;
  canvas.height = CREST_SIZE;
  canvas.getContext("2d").drawImage(bitmap, (CREST_SIZE - width) / 2, (CREST_SIZE - height) / 2, width, height);
  bitmap.close();
  // WebP guarda la transparencia y pesa poco; si el navegador no sabe hacerlo, sale PNG.
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error("No se ha podido preparar la imagen");
  return blob;
}
