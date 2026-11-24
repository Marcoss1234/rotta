import { Link } from "react-router-dom";

const TABS = [
  { id: "plantilla", label: "Plantilla", path: "/app/plantillas" },
  { id: "pizarra", label: "Pizarra", path: "/app/plantillas/pizarra" },
];

export default function RosterTabs({ active, teamId }) {
  return (
    <nav aria-label="Plantilla y pizarra" className="grid grid-cols-2 gap-1 rounded-full bg-panel p-1 ring-1 ring-white/10">
      {TABS.map(({ id, label, path }) => (
        <Link
          key={id}
          to={teamId ? `${path}?equipo=${teamId}` : path}
          aria-current={active === id ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center rounded-full text-sm font-semibold ${
            active === id ? "bg-tnt text-onbrand" : "text-zinc-300 hover:text-white"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
