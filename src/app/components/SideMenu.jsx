import { useEffect, useRef, useState } from "react";
import { ChevronRight, Volume2, VolumeX, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import Avatar from "@/app/components/Avatar.jsx";
import { roleLabel } from "@/app/roles.js";
import { setSoundEnabled, soundEnabled } from "@/app/components/board/boardSounds.js";
import ClubCrest from "@/app/components/ClubCrest.jsx";
import { useClubIdentity } from "@/app/clubIdentity.js";

const CLOSE_MS = 220;

// Menú lateral del móvil: entra desde la izquierda con todas las secciones. Abajo solo quedan las más usadas.
export default function SideMenu({ open, onClose, user, groups, unread }) {
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  const club = useClubIdentity();
  const panelRef = useRef(null);
  // Sonidos de la app (el "plup" de los botones y los golpes de la pizarra 3D).
  const [sound, setSound] = useState(soundEnabled);

  // Al cerrar se deja un momento montado para que salga deslizándose.
  useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
      return undefined;
    }
    if (!shown) return undefined;
    setClosing(true);
    const timer = setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open, shown]);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!shown) return null;
  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar el menú"
        onClick={onClose}
        data-no-press
        className={`absolute inset-0 h-full w-full cursor-default bg-canvas/75 backdrop-blur-[2px] ${closing ? "side-menu-backdrop-out" : "side-menu-backdrop-in"}`}
      />
      <nav
        ref={panelRef}
        tabIndex={-1}
        aria-label="Menú"
        className={`absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col overflow-y-auto bg-overlay pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-ink shadow-overlay outline-none ${
          closing ? "side-menu-out" : "side-menu-in"
        }`}
      >
        <div className="relative overflow-hidden p-4 pb-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ClubCrest className="h-8 w-8 shrink-0" rottaClassName="rounded-[30%] object-cover" />
              <span className="font-title text-base text-ink">{club.name}</span>
            </span>
            <button type="button" onClick={onClose} aria-label="Cerrar el menú" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-control text-ink-muted hover:bg-raised hover:text-ink">
              <X aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>
          <NavLink to="/app/perfil" onClick={onClose} className="mt-4 flex items-center gap-3 rounded-card bg-raised p-2.5 transition-ui hover:bg-card">
            <Avatar name={user.name} picture={user.picture} className="h-12 w-12 text-base" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-title text-lg leading-tight text-ink">{user.name}</span>
              <span className="block text-xs font-semibold text-ink-muted">{roleLabel(user.role)} · Ver perfil</span>
            </span>
            <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-muted" />
          </NavLink>
        </div>

        <div className="side-menu-items flex-1 space-y-4 p-3">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1 text-xs font-semibold text-ink-muted">{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map(({ to, end, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex min-h-12 items-center gap-3 rounded-control px-4 text-[15px] font-semibold transition-ui ${
                          isActive ? "ui-selected" : "text-ink hover:bg-raised"
                        }`
                      }
                    >
                      <span className="relative flex">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                        {to === "/app/chat" && unread && <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-club ring-2 ring-overlay" />}
                      </span>
                      <span className="flex-1">{label}</span>
                      {to === "/app/chat" && unread && <span className="sr-only">(mensajes sin leer)</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <button
            type="button"
            role="switch"
            aria-checked={sound}
            onClick={() => {
              setSoundEnabled(!sound);
              setSound(!sound);
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-control px-4 text-left text-[15px] font-semibold text-ink transition-ui hover:bg-raised"
          >
            {sound ? <Volume2 aria-hidden="true" className="h-5 w-5" /> : <VolumeX aria-hidden="true" className="h-5 w-5" />}
            <span className="flex-1">Sonidos</span>
            <span className={`relative h-6 w-11 rounded-full ring-1 ring-inset transition-colors ${sound ? "bg-club ring-club-edge" : "bg-raised ring-control"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full shadow transition-all ${sound ? "left-[1.375rem] bg-on-club" : "left-0.5 bg-ink-muted"}`} />
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
