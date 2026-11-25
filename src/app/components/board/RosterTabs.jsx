import { ClipboardList, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cx } from "@/app/ui/index.js";

const TABS = [
  { id: "plantilla", label: "Plantilla", icon: Users, path: "/app/plantillas" },
  { id: "pizarra", label: "Pizarra", icon: ClipboardList, path: "/app/plantillas/pizarra" },
];

// Plantilla y Pizarra son dos pantallas: por eso son enlaces (con aria-current), no pestañas. Mismo aspecto que
// las pestañas de src/app/ui (Tabs) para que se reconozcan igual.
export default function RosterTabs({ active, teamId }) {
  return (
    <nav aria-label="Plantilla y pizarra" className="grid grid-cols-2 gap-1 rounded-control bg-raised p-1">
      {TABS.map(({ id, label, icon: Icon, path }) => {
        const current = active === id;
        return (
          <Link
            key={id}
            to={teamId ? `${path}?equipo=${teamId}` : path}
            aria-current={current ? "page" : undefined}
            className={cx(
              "flex min-h-11 items-center justify-center gap-2 rounded-control text-sm font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text",
              current ? "bg-card text-ink shadow-card ring-1 ring-inset ring-control" : "text-ink-muted hover:text-ink",
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
