const SIZE = 320;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const QUALITY = 0.82;

// Recorta al centro y reduce la foto antes de subirla. Al redibujarla también desaparecen
// los datos ocultos del archivo original, como el lugar donde se hizo.
export async function prepareAvatar(file) {
  if (!file.type.startsWith("image/")) throw new Error("Elige una imagen");
  if (file.size > MAX_FILE_BYTES) throw new Error("La imagen pesa demasiado");

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No se ha podido leer esta imagen. Prueba con otra en JPG o PNG");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff"; // Las imágenes con fondo transparente no quedan en negro.
  context.fillRect(0, 0, SIZE, SIZE);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("No se ha podido preparar la imagen");
  return blob;
}
