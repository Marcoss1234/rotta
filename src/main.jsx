import React from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.jsx";
import "@/app/installPrompt.js";
import "@/index.css";
import { applyStoredTheme } from "@/app/useTheme.js";

// Los colores del club, antes de pintar nada: así la app no parpadea al abrirla.
applyStoredTheme();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
