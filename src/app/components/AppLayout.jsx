import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, CircleUser, ClipboardList, History, House, Menu, MessagesSquare, Presentation, ShoppingBag, Trophy, UserCog, UserPlus, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { listChatChannels } from "@/app/api.js";
import Avatar from "@/app/components/Avatar.jsx";
import MenuHint from "@/app/components/MenuHint.jsx";
import SideMenu from "@/app/components/SideMenu.jsx";
import TapSplash from "@/app/components/TapSplash.jsx";
import usePolling from "@/app/usePolling.js";

const UNREAD_POLL_MS = 30000;
const CHAT_PATH = "/app/chat";

function navItems(isAdmin, user, pathname) {
  return [
    // Los partidos jugados y las solicitudes se abren desde Inicio y siguen contando como Inicio.
    { to: "/app", end: !/^\/app\/(partidos|solicitudes)/.test(pathname), label: "Inicio", icon: House },
    { to: "/app/plantillas", label: "Plantillas", icon: Users },
    // El servidor tampoco enseña el ranking a las familias.
    ...(user.role === "familia" ? [] : [{ to: "/app/ranking", label: "Ranking", icon: Trophy }]),
    { to: CHAT_PATH, label: "Chat", icon: MessagesSquare },
    ...(isAdmin ? [{ to: "/app/usuarios", label: "Usuarios", icon: UserCog }] : []),
    { to: "/app/eventos", label: "Eventos", icon: CalendarDays },
    { to: "/app/perfil", label: "Perfil", icon: CircleUser },
  ];
}

// En el móvil, abajo solo van estas; el resto (y lo que se vaya añadiendo) está en el menú lateral.
const BOTTOM_PATHS = ["/app", "/app/plantillas", "/app/ranking", "/app/chat"];

function menuGroups(items, user) {
  const staff = user.role === "admin" || user.role === "entrenador";
  const more = [
    { to: "/app/tienda", label: "Tienda Club", icon: ShoppingBag },
    ...(user.role === "familia" ? [] : [{ to: "/app/plantillas/pizarra", label: "Pizarra", icon: Presentation }]),
    { to: "/app/partidos/jugados", label: "Partidos jugados", icon: History },
    ...(staff ? [{ to: "/app/ranking/notas", label: "Notas del ranking", icon: ClipboardList }] : []),
    ...(staff ? [{ to: "/app/solicitudes", label: "Solicitudes de acceso", icon: UserPlus }] : []),
  ];
  return [
    { title: "Secciones", items },
    { title: "Más", items: more },
  ];
}

// Hasta que alguien abre el menú por primera vez, el botón llama la atención y sale un aviso.
const MENU_SEEN_KEY = "tnt-menu-visto";
function readMenuSeen() {
  try {
    return localStorage.getItem(MENU_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}
function storeMenuSeen() {
  try {
    localStorage.setItem(MENU_SEEN_KEY, "1");
  } catch {
    // Sin almacenamiento: el aviso volverá a salir otro día, no pasa nada.
  }
}

// Dentro del chat ya se ve cada contador; fuera, el menú avisa de que hay algo sin leer.
function useUnreadChat(pathname) {
  const [unread, setUnread] = useState(false);
  const inChat = pathname.startsWith(CHAT_PATH);

  const check = useCallback(async () => {
    if (inChat) return;
    try {
      const channels = await listChatChannels();
      setUnread(channels.some((channel) => channel.unread > 0));
    } catch {
      // Es solo un aviso: si falla, cada pantalla ya muestra su propio error.
    }
  }, [inChat]);

  usePolling(check, UNREAD_POLL_MS);
  return unread && !inChat;
}

// En el menú, Perfil lleva tu foto en lugar del icono.
function NavIcon({ to, icon: Icon, user, className }) {
  if (to === "/app/perfil" && user.picture) {
    return <Avatar name={user.name} picture={user.picture} className={`${className} text-[9px]`} />;
  }
  return <Icon aria-hidden="true" className={className} />;
}

function UnreadDot({ to, unread }) {
  if (to !== CHAT_PATH || !unread) return null;
  return (
    <>
      <span aria-hidden="true" className="absolute h-2.5 w-2.5 rounded-full bg-tnt ring-2 ring-surface text-onbrand" />
      <span className="sr-only"> (mensajes sin leer)</span>
    </>
  );
}

export default function AppLayout({ isAdmin, user, children }) {
  const { pathname } = useLocation();
  const items = navItems(isAdmin, user, pathname);
  const unread = useUnreadChat(pathname);
  const mainRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [menuSeen, setMenuSeen] = useState(readMenuSeen);
  const [hintReady, setHintReady] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const openMenu = useCallback(() => {
    setMenuOpen(true);
    setMenuSeen(true);
    storeMenuSeen();
  }, []);
  // Abajo van las principales; si las del menú caben (4 o menos), no hace falta el botón.
  const bottomItems = items.filter((item) => BOTTOM_PATHS.includes(item.to));
  if (user.role === "familia" && bottomItems.length < 4) {
    const events = items.find((item) => item.to === "/app/eventos");
    if (events) bottomItems.push(events);
  }
  // Si estás en una sección que no está abajo, se marca "Menú".
  const inBottom = bottomItems.some((item) => (item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to)));

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // El aviso sale en Inicio, un momento después de entrar, para no taparlo todo de golpe.
  useEffect(() => {
    if (menuSeen || pathname !== "/app") return undefined;
    const timer = setTimeout(() => setHintReady(true), 1200);
    return () => clearTimeout(timer);
  }, [menuSeen, pathname]);

  const hiddenLabels = menuGroups(items, user)
    .flatMap((group) => group.items)
    .filter((item) => !bottomItems.some((bottom) => bottom.to === item.to))
    .map((item) => item.label);
  const showHint = !menuSeen && hintReady && !hintDismissed && pathname === "/app";

  // En el móvil la página no se desplaza: solo el contenido. Así el menú no tiene cómo moverse.
  useEffect(() => {
    document.documentElement.classList.add("app-shell");
    return () => document.documentElement.classList.remove("app-shell");
  }, []);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [pathname]);

  // Cada pantalla entra con su animación. La pizarra no: ocupa toda la pantalla y se mide al abrirse.
  const animated = !pathname.startsWith("/app/plantillas/pizarra/") && !pathname.startsWith("/app/directo/");

  return (
    <div className="fixed inset-0 flex flex-col bg-void font-body text-white md:static md:min-h-screen md:flex-row">
      <TapSplash disabled={pathname.startsWith("/app/plantillas/pizarra/")} />
      <SideMenu open={menuOpen} onClose={closeMenu} user={user} groups={menuGroups(items, user)} unread={unread} />
      {showHint && <MenuHint hidden={hiddenLabels} onOpen={openMenu} onDismiss={() => setHintDismissed(true)} />}
      <aside className="hidden w-60 shrink-0 flex-col gap-8 border-r border-white/10 bg-surface p-5 md:flex">
        <div className="flex items-center gap-3">
          <img src="/rotta-logo.svg" alt="" className="h-10 w-10 rounded-full object-cover" />
          <span className="font-display text-lg font-extrabold leading-tight">Rotta</span>
        </div>
        <nav aria-label="Secciones" className="flex flex-col gap-1">
          {items.map(({ to, end, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  isActive ? "bg-tnt text-onbrand" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <span className="relative flex">
                <NavIcon to={to} icon={icon} user={user} className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex"><UnreadDot to={to} unread={unread} /></span>
              </span>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main
        ref={mainRef}
        className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-6 md:overflow-visible md:px-8 md:pb-10 md:pt-8"
      >
        <div key={animated ? pathname : "sin-animacion"} className={animated ? "page-enter h-full" : "h-full"}>
          {children}
        </div>
      </main>

      <nav
        aria-label="Secciones"
        data-bottom-menu
        className="flex shrink-0 border-t border-white/10 bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {bottomItems.map(({ to, end, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs ${
                isActive ? "font-bold text-white" : "font-medium text-zinc-400"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span aria-hidden="true" className="nav-bar-in absolute inset-x-3 top-0 h-[3px] rounded-b bg-tnt text-onbrand" />}
                <span className={`relative flex ${isActive ? "nav-pop" : ""}`}>
                  <NavIcon to={to} icon={icon} user={user} className="h-[22px] w-[22px]" />
                  <span className="absolute -right-1 -top-1 flex"><UnreadDot to={to} unread={unread} /></span>
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={openMenu}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          className={`relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs ${
            !inBottom ? "font-bold text-white" : "font-medium text-zinc-400"
          }`}
        >
          {!inBottom && <span aria-hidden="true" className="nav-bar-in absolute inset-x-3 top-0 h-[3px] rounded-b bg-tnt text-onbrand" />}
          <span className="relative flex">
            {!menuSeen && <span aria-hidden="true" className="menu-attention absolute -inset-2 rounded-full" />}
            <Menu aria-hidden="true" className="relative h-[22px] w-[22px]" />
            {!menuSeen && <span aria-hidden="true" className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-tnt ring-2 ring-surface text-onbrand" />}
          </span>
          Menú
          {!menuSeen && <span className="sr-only"> (nuevo)</span>}
        </button>
      </nav>
    </div>
  );
}
