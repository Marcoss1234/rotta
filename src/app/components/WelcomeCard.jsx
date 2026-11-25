import { useEffect, useState } from "react";
import { CalendarDays, CircleUser, MessagesSquare, Trophy, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useClubIdentity } from "@/app/clubIdentity.js";
import { IconButton, cx } from "@/app/ui/index.js";
import { claimWelcome, dismissWelcome, wantsWelcome } from "@/app/welcome.js";

// Tres atajos para empezar, que existen para cada tipo de cuenta (las familias no ven el ranking).
function shortcuts(user) {
  return [
    { to: "/app/chat", icon: MessagesSquare, title: "Saluda en el chat", text: "Tu equipo y el club te leen ahí." },
    { to: "/app/perfil", icon: CircleUser, title: "Prepara tu perfil", text: "Tu personaje, tu foto y los avisos del móvil." },
    user.role === "familia"
      ? { to: "/app/eventos", icon: CalendarDays, title: "Mira los eventos", text: "Lo que organiza el club." }
      : { to: "/app/ranking", icon: Trophy, title: "Mira el ranking", text: "La nota de la semana y los premios." },
  ];
}

/** Bienvenida pequeña en Inicio: sale una vez por club, persona y móvil, y se cierra con la X o con un atajo. */
export default function WelcomeCard({ user }) {
  const club = useClubIdentity();
  const [visible, setVisible] = useState(() => wantsWelcome(user.id));
  useEffect(() => {
    if (visible) claimWelcome(user.id);
  }, [visible, user.id]);
  if (!visible) return null;

  const close = () => {
    dismissWelcome();
    setVisible(false);
  };

  return (
    <section aria-labelledby="welcome-title" className="relative rounded-card bg-card p-3.5 shadow-card ring-1 ring-line md:p-4" data-testid="welcome-card">
      <IconButton icon={X} label="Cerrar la bienvenida" size="sm" onClick={close} className="absolute right-2 top-2" />
      <div className="pr-10">
        <h2 id="welcome-title" className="font-display text-base font-extrabold leading-tight text-ink md:text-lg">Te damos la bienvenida a {club.name}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">Unas ideas para empezar</p>
      </div>
      {/* En el móvil, tres atajos en fila (icono y título); en el ordenador, con su explicación. */}
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {shortcuts(user).map(({ to, icon: Icon, title, text }) => (
          <li key={to}>
            <Link
              to={to}
              onClick={close}
              className={cx(
                "flex h-full flex-col items-center gap-1.5 rounded-card bg-raised px-2 py-2.5 text-center transition md:flex-row md:gap-3 md:px-3 md:text-left",
                "hover:ring-1 hover:ring-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-club-soft text-club-ui">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold leading-tight text-ink md:text-sm">{title}</span>
                <span className="mt-0.5 hidden text-xs text-ink-muted md:block">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
