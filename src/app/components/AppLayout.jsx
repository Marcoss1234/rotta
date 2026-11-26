import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, CircleUser, ClipboardList, History, House, Menu, MessagesSquare, Presentation, ShoppingBag, Trophy, UserCog, UserPlus, Users } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { listChatChannels } from "@/app/api.js";
import Avatar from "@/app/components/Avatar.jsx";
import MenuHint from "@/app/components/MenuHint.jsx";
import SideMenu from "@/app/components/SideMenu.jsx";
import TapSplash from "@/app/components/TapSplash.jsx";
import usePolling from "@/app/usePolling.js";
import ClubCrest from "@/app/components/ClubCrest.jsx";
import { useClubIdentity } from "@/app/clubIdentity.js";
import { useWelcomeVisible } from "@/app/welcome.js";
import { roleLabel } from "@/app/roles.js";

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

// En escritorio caben todas las secciones a la vista, agrupadas (Perfil va abajo, con tu cara).
function desktopGroups(items, user) {
  const staff = user.role === "admin" || user.role === "entrenador";
  const find = (to) => items.find((item) => item.to === to);
  const team = ["/app", "/app/plantillas", "/app/ranking", "/app/eventos"].map(find).filter(Boolean);
  const club = [
    find(CHAT_PATH),
    { to: "/app/tienda", label: "Tienda Club", icon: ShoppingBag },
    ...(user.role === "familia" ? [] : [{ to: "/app/plantillas/pizarra", label: "Pizarra", icon: Presentation }]),
    { to: "/app/partidos/jugados", label: "Partidos jugados", icon: History },
  ].filter(Boolean);
  const manage = [
    ...(staff ? [{ to: "/app/ranking/notas", label: "Notas del ranking", icon: ClipboardList }] : []),
    ...(staff ? [{ to: "/app/solicitudes", label: "Solicitudes de acceso", icon: UserPlus }] : []),
    find("/app/usuarios"),
  ].filter(Boolean);
  return [
    { title: "Equipo", items: team },
    { title: "Club", items: club },
    ...(manage.length ? [{ title: "Gestión", items: manage }] : []),
  ];
}

// La pizarra y el directo ocupan toda la pantalla: ahí la barra de abajo no flota encima de sus controles.
// Pantallas ya rediseñadas con su propia distribución de escritorio (Premium deportivo): usan todo el ancho
// (hasta 1.200 px). Las demás siguen en su columna de 768 px hasta que se rediseñen.
const WIDE_PATHS = new Set(["/app"]);

const isImmersive = (pathname) => pathname.startsWith("/app/plantillas/pizarra/") || pathname.startsWith("/app/directo/");

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
      <span aria-hidden="true" className="absolute h-2.5 w-2.5 rounded-full bg-club ring-2 ring-canvas" />
      <span className="sr-only"> (mensajes sin leer)</span>
    </>
  );
}

export default function AppLayout({ isAdmin, user, children }) {
  const { pathname } = useLocation();
  const items = navItems(isAdmin, user, pathname);
  const unread = useUnreadChat(pathname);
  const club = useClubIdentity();
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
  // Mientras la bienvenida de Inicio está a la vista, el aviso del menú espera (no se amontonan).
  const welcomeVisible = useWelcomeVisible();
  const showHint = !menuSeen && hintReady && !hintDismissed && !welcomeVisible && pathname === "/app";

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
  const immersive = isImmersive(pathname);
  // En escritorio se marca la sección más concreta que coincida (Pizarra y no también Plantillas; Notas y no
  // también Ranking). Inicio, como siempre, también con partidos jugados y solicitudes si no tienen la suya.
  const sideGroups = desktopGroups(items, user);
  const sideActive = sideGroups
    .flatMap((group) => group.items.map((item) => item.to))
    .filter((to) => (to === "/app" ? pathname === "/app" : pathname === to || pathname.startsWith(`${to}/`)))
    .sort((a, b) => b.length - a.length)[0] ?? (pathname.startsWith("/app/perfil") ? null : "/app");

  // Premium deportivo: el marco (app-frame, app-topbar, app-nav, app-sidebar en index.css) tiene la misma
  // estructura en Lima, Naranja y Tinta; cambia su carácter: Lima barra recta pegada abajo con raya en lo elegido
  // y fondo con rejilla sutil; Naranja pastilla flotante; Tinta barra de cristal translúcida.
  return (
    <div className="app-frame fixed inset-0 flex flex-col bg-canvas font-body text-ink md:static md:min-h-screen md:flex-row">
      <TapSplash disabled={pathname.startsWith("/app/plantillas/pizarra/")} />
      <SideMenu open={menuOpen} onClose={closeMenu} user={user} groups={menuGroups(items, user)} unread={unread} />
      {showHint && <MenuHint hidden={hiddenLabels} onOpen={openMenu} onDismiss={() => setHintDismissed(true)} />}

      {/* Escritorio: el club arriba, las secciones agrupadas y tu perfil abajo. */}
      <aside className="app-sidebar hidden w-[17rem] shrink-0 flex-col gap-7 px-4 py-6 md:sticky md:top-0 md:flex md:h-screen">
        <div className="flex items-center gap-3 px-2">
          <ClubCrest className="h-10 w-10 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate font-title text-lg leading-tight text-ink">{club.name}</span>
            <span className="block text-xs text-ink-muted">con Rotta</span>
          </span>
        </div>
        <nav aria-label="Secciones" className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {sideGroups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1.5 text-xs font-semibold text-ink-muted">{group.title}</p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map(({ to, label, icon }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      aria-current={sideActive === to ? "page" : undefined}
                      className={`app-sidebar-item flex min-h-10 items-center gap-3 rounded-control px-3 text-sm font-semibold transition-ui ${
                        sideActive === to ? "ui-selected" : "text-ink-muted hover:bg-raised hover:text-ink"
                      }`}
                    >
                      <span className="relative flex">
                        <NavIcon to={to} icon={icon} user={user} className="h-[18px] w-[18px]" />
                        <span className="absolute -right-1 -top-1 flex"><UnreadDot to={to} unread={unread} /></span>
                      </span>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <NavLink
          to="/app/perfil"
          className={({ isActive: active }) =>
            `flex items-center gap-3 rounded-card p-2.5 transition-ui ${active ? "ui-selected" : "hover:bg-raised"}`
          }
        >
          <Avatar name={user.name} picture={user.picture} className="h-10 w-10 shrink-0 text-sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
            <span className="block text-xs text-ink-muted">{roleLabel(user.role)} · Perfil</span>
          </span>
        </NavLink>
      </aside>

      {/* Móvil: el club arriba, compacto (no en la pizarra ni en el directo, que ocupan toda la pantalla). */}
      {!immersive && (
        <header className="app-topbar flex shrink-0 items-center gap-3 px-gutter pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))] md:hidden">
          <ClubCrest className="h-8 w-8 shrink-0" rottaClassName="rounded-[30%] object-cover" />
          <span className="min-w-0 flex-1 truncate font-title text-base leading-tight text-ink">{club.name}</span>
          <Link to="/app/perfil" aria-label="Tu perfil" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text">
            <Avatar name={user.name} picture={user.picture} className="h-9 w-9 text-xs" />
          </Link>
        </header>
      )}

      <main
        ref={mainRef}
        className={`app-main mx-auto min-h-0 w-full ${WIDE_PATHS.has(pathname) ? "max-w-6xl" : "max-w-3xl"} flex-1 overflow-y-auto overscroll-contain px-gutter pt-4 md:overflow-visible md:pb-12 md:pt-10 ${
          immersive ? "pb-6" : "app-main-under-nav"
        }`}
      >
        <div key={animated ? pathname : "sin-animacion"} className={animated ? "page-enter h-full" : "h-full"}>
          {children}
        </div>
      </main>

      <nav aria-label="Secciones" data-bottom-menu className={`app-nav md:hidden ${immersive ? "app-nav-static" : ""}`}>
        {bottomItems.map(({ to, end, label, icon }) => (
          <NavLink key={to} to={to} end={end} className="app-nav-item">
            <span className="app-nav-icon relative flex">
              <NavIcon to={to} icon={icon} user={user} className="h-[22px] w-[22px]" />
              <span className="absolute -right-1 -top-1 flex"><UnreadDot to={to} unread={unread} /></span>
            </span>
            <span className="app-nav-label">{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={openMenu}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          data-active={!inBottom || undefined}
          className="app-nav-item"
        >
          <span className="app-nav-icon relative flex">
            {!menuSeen && <span aria-hidden="true" className="menu-attention absolute -inset-2 rounded-full" />}
            <Menu aria-hidden="true" className="relative h-[22px] w-[22px]" />
            {!menuSeen && <span aria-hidden="true" className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-club ring-2 ring-canvas" />}
          </span>
          <span className="app-nav-label">Menú</span>
          {!menuSeen && <span className="sr-only"> (nuevo)</span>}
        </button>
      </nav>
    </div>
  );
}
