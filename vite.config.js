import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GESTURES_FILE = path.resolve(__dirname, "tools/editor-gestos/gestures.json");
const TIMES_FILE = path.resolve(__dirname, "src/app/character/gesture-times.json");
const CAPTURES_FILE = path.resolve(__dirname, "src/app/character/captured-gestures.json");

// Solo en el ordenador (npm run dev): el editor de gestos guarda aquí las posturas.
// No existe en la app publicada.
function gestureEditorSave() {
  return {
    name: "guardar-gestos",
    apply: "serve",
    configureServer(server) {
      const saveTo = (file) => (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 8_000_000) req.destroy();
        });
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Formato no válido");
            fs.writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);
            res.statusCode = 204;
            res.end();
          } catch (error) {
            res.statusCode = 400;
            res.end(String(error.message));
          }
        });
      };
      server.middlewares.use("/__guardar-gestos", saveTo(GESTURES_FILE));
      server.middlewares.use("/__guardar-tiempos", saveTo(TIMES_FILE));
      server.middlewares.use("/__guardar-captura", saveTo(CAPTURES_FILE));
    },
  };
}

export default defineConfig({
  plugins: [react(), gestureEditorSave()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Pruebas de la web (npm test): componentes de React en un navegador simulado (jsdom).
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
  },
  server: {
    proxy: {
      // La demo (npm run demo) usa otro puerto para no chocar con el backend normal.
      "/api": `http://127.0.0.1:${process.env.API_PORT || 8000}`,
    },
  },
});
