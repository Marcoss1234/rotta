import { useEffect, useRef, useState } from "react";
import { ChevronRight, Volume2, VolumeX, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import Avatar from "@/app/components/Avatar.jsx";
import { roleLabel } from "@/app/roles.js";
import { playTest, setSoundEnabled, soundEnabled, soundStatus, unlockSound } from "@/app/components/board/boardSounds.js";

const CLOSE_MS = 220;

// Menú lateral del móvil: entra desde la izquierda con todas las secciones. Abajo solo quedan las más usadas.
export default function SideMenu({ open, onClose, user, groups, unread }) {
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);
  // Sonidos de la app (el "plup" de los botones y los golpes de la pizarra 3D).
  const [sound, setSound] = useState(soundEnabled);
  // «Probar sonido»: suena una melodía corta y explica qué pasa si no se oye.
  const [soundCheck, setSoundCheck] = useState(null);
  const testSound = () => {
    unlockSound();
    setTimeout(() => {
      playTest();
      setSoundCheck(soundStatus());
    }, 250);
  };

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
        className={`absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-[2px] ${closing ? "side-menu-backdrop-out" : "side-menu-backdrop-in"}`}
      />
      <nav
        ref={panelRef}
        tabIndex={-1}
        aria-label="Menú"
        className={`absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col overflow-y-auto bg-surface pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-[8px_0_40px_rgba(0,0,0,0.6)] outline-none ${
          closing ? "side-menu-out" : "side-menu-in"
        }`}
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-tnt via-tnt to-tntdeep p-4 pb-5 text-onbrand">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <img src="/rotta-logo.svg" alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/30" />
              <span className="font-display text-sm font-extrabold uppercase italic tracking-wide">Rotta</span>
            </span>
            <button type="button" onClick={onClose} aria-label="Cerrar el menú" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10">
              <X aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>
          <NavLink to="/app/perfil" onClick={onClose} className="mt-4 flex items-center gap-3 rounded-xl bg-black/20 p-2.5 hover:bg-black/30">
            <Avatar name={user.name} picture={user.picture} className="h-12 w-12 text-base ring-2 ring-white/40" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg font-black italic leading-tight">{user.name}</span>
              <span className="block text-xs font-semibold text-white/80">{roleLabel(user.role)} · Ver perfil</span>
            </span>
            <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-white/70" />
          </NavLink>
        </div>

        <div className="side-menu-items flex-1 space-y-4 p-3">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map(({ to, end, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold ${
                          isActive ? "bg-gradient-to-r from-tnt to-ember text-onbrand shadow-[0_4px_14px_rgba(255,56,0,0.3)]" : "text-zinc-200 hover:bg-white/5"
                        }`
                      }
                    >
                      <span className="relative flex">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                        {to === "/app/chat" && unread && <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-tnt ring-2 ring-surface text-onbrand" />}
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
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold text-zinc-200 hover:bg-white/5"
          >
            {sound ? <Volume2 aria-hidden="true" className="h-5 w-5" /> : <VolumeX aria-hidden="true" className="h-5 w-5" />}
            <span className="flex-1">Sonidos</span>
            <span className={`relative h-6 w-11 rounded-full transition-colors ${sound ? "bg-tnt" : "bg-white/15"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${sound ? "left-[1.375rem]" : "left-0.5"}`} />
            </span>
          </button>
          <button type="button" onClick={testSound} className="ml-11 min-h-10 rounded-lg px-3 text-left text-sm font-semibold text-tnt hover:bg-white/5">
            Probar sonido
          </button>
          {soundCheck && (
            <div role="status" className="mx-3 space-y-1 rounded-xl bg-white/[0.04] p-3 text-xs text-zinc-300 ring-1 ring-white/10">
              <p className="font-bold text-white">¿Has oído tres notas?</p>
              {soundCheck.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p className="pt-1 text-[10px] text-zinc-500">{soundCheck.technical}</p>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
