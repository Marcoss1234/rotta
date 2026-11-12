const MAX_SIDE = 1600;
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const QUALITY = 0.8;

// Reduce la foto antes de mandarla al chat: el lado más largo se queda en 1600 px y en JPG.
// Al redibujarla también desaparecen los datos ocultos del archivo original, como el lugar donde se hizo.
export async function prepareChatImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Elige una imagen");
  if (file.size > MAX_FILE_BYTES) throw new Error("La imagen pesa demasiado");

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No se ha podido leer esta imagen. Prueba con otra en JPG o PNG");
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff"; // Las imágenes con fondo transparente no quedan en negro.
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("No se ha podido preparar la imagen");
  return { blob, width, height };
}
