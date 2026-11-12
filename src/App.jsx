import { Suspense, lazy } from "react";
import { MotionConfig } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/app/useTheme.js";

const PrivateApp = lazy(() => import("@/app/PrivateApp.jsx"));
// Prueba de temas: se ve sin entrar en la app.
const ThemeLabPage = lazy(() => import("@/app/pages/ThemeLabPage.jsx"));

// De momento Rotta es solo la app; la web de presentación vendrá más adelante.
export default function App() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Routes>
            <Route
              path="/app/*"
              element={
                <Suspense fallback={<div className="min-h-screen bg-void" />}>
                  <PrivateApp />
                </Suspense>
              }
            />
            <Route
              path="/tema"
              element={
                <Suspense fallback={<div className="min-h-screen bg-zinc-100" />}>
                  <ThemeLabPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  );
}
