import { ClipboardList, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cx } from "@/app/ui/index.js";

const TABS = [
  { id: "plantilla", label: "Plantilla", icon: Users, path: "/app/plantillas" },
  { id: "pizarra", label: "Pizarra", icon: ClipboardList, path: "/app/plantillas/pizarra" },
];

// Plantilla y Pizarra son dos pantallas: enlaces (con aria-current), con aspecto de navegación (texto con una raya
// debajo, la del color del club en la elegida). Así no se confunden con las pestañas de dentro de una pantalla
// (Tabs de src/app/ui, en forma de interruptor), como Pista / Jugadores.
export default function RosterTabs({ active, teamId }) {
  return (
    <nav aria-label="Plantilla y pizarra" className="flex gap-6 border-b border-line">
      {TABS.map(({ id, label, icon: Icon, path }) => {
        const current = active === id;
        return (
          <Link
            key={id}
            to={teamId ? `${path}?equipo=${teamId}` : path}
            aria-current={current ? "page" : undefined}
            className={cx(
              "-mb-px flex min-h-11 items-center gap-2 border-b-2 px-0.5 text-sm font-semibold transition",
              "focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text",
              current ? "border-club-ui text-ink" : "border-transparent text-ink-muted hover:border-line hover:text-ink",
            )}
          >
            <Icon aria-hidden="true" className={cx("h-4 w-4", current && "text-club-ui")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
