import { useState } from "react";
import { CalendarCheck, MessagesSquare, Trophy, Volleyball, WifiOff } from "lucide-react";
import ClubCrest from "@/app/components/ClubCrest.jsx";
import RotationMark from "@/app/components/RotationMark.jsx";
import { useClubIdentity } from "@/app/clubIdentity.js";
import { Button, cx } from "@/app/ui/index.js";

// Las pantallas de antes de entrar (entrar, contraseña temporal, permisos, acceso pendiente, cargando...)
// comparten este marco: primero el club (escudo y nombre) y, discreta, la firma «con Rotta».
// - Móvil y tableta: arriba una franja con el club y debajo la tarjeta del formulario.
// - Ordenador (desde 1024 px): pantalla partida; a la izquierda el club, a la derecha el formulario.
// Solo colores del tema: el del club va de acento (la rayita bajo el nombre y el botón principal).

export const TAGLINE = "Tu club en el móvil: entrenos, partidos y chat";

// Lo que se hace en la app (solo en el ordenador, donde hay sitio).
const HIGHLIGHTS = [
  { icon: CalendarCheck, title: "Voy o no voy", text: "Di si vas a cada entreno y partido, y mira quién va." },
  { icon: MessagesSquare, title: "Chat del club", text: "Con tu equipo, con todo el club y con las familias." },
  { icon: Trophy, title: "Ranking y premios", text: "La nota de la semana, el podio y los Club Coins." },
];

// Líneas de una pista de fondo, muy suaves (el mismo dibujo que la cabecera de Inicio).
function CourtLines() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -bottom-40 -right-40 h-72 w-[30rem] rotate-[-18deg] sm:-bottom-28 sm:-right-32 rounded-sm border-[3px] border-ink/10 lg:-bottom-16 lg:h-[26rem] lg:w-[44rem]">
        <span className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-ink/15" />
        <span className="absolute inset-y-0 left-[33.3%] w-[3px] bg-ink/10" />
        <span className="absolute inset-y-0 left-[66.6%] w-[3px] bg-ink/10" />
      </div>
      <Volleyball className="absolute bottom-6 right-6 hidden h-16 w-16 sm:block rotate-12 text-ink/10 lg:bottom-12 lg:right-14 lg:h-24 lg:w-24" strokeWidth={1.3} />
    </div>
  );
}

/** «con Rotta»: la firma del producto, siempre discreta. */
export function RottaSignature({ className }) {
  return (
    <p className={cx("flex items-center gap-1.5 text-xs font-semibold text-ink-muted", className)}>
      <span>con</span>
      <RotationMark className="h-4 w-4 text-rotta-text" />
      <span className="font-display text-sm font-extrabold text-ink">Rotta</span>
    </p>
  );
}

/** El club: escudo, nombre (con la rayita de su color) y la frase. `as`: h1 solo en la pantalla de entrar. */
export function ClubBrand({ as: Tag = "p", compact = false }) {
  const club = useClubIdentity();
  return (
    <div className={cx("flex flex-col items-center text-center lg:items-start lg:text-left", compact ? "gap-2" : "gap-3")}>
      <ClubCrest className={compact ? "h-14 w-14 lg:h-20 lg:w-20" : "h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24"} alt={`Escudo de ${club.name}`} />
      <div className="space-y-2">
        <Tag className={cx("font-display font-extrabold leading-[1.05] tracking-tight text-ink", compact ? "text-2xl sm:text-3xl lg:text-5xl" : "text-[2rem] sm:text-4xl lg:text-5xl")}>
          {club.name}
        </Tag>
        <span aria-hidden="true" className="mx-auto block h-1 w-10 rounded-full bg-club lg:mx-0" />
        <p className="text-sm text-ink-muted sm:text-base">{TAGLINE}</p>
      </div>
    </div>
  );
}

/**
 * El marco de las pantallas de entrada.
 * brandAs: "h1" si el título de la pantalla es el propio club (entrar); si no, el título va en la tarjeta.
 * compact: franja más baja en el móvil (pantallas con más contenido, como los permisos).
 */
export function AuthShell({ children, brandAs = "p", compact = false }) {
  const club = useClubIdentity();
  // Si el club no tiene nombre ni escudo propios, ya sale Rotta arriba: la firma sobra.
  const ownBrand = Boolean(club.custom?.name || club.custom?.crest);
  return (
    <div className="flex min-h-dvh flex-col bg-canvas font-body text-ink lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside
        className={cx(
          "relative isolate shrink-0 overflow-hidden bg-raised px-6 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:px-14 lg:py-14",
          // En la tableta la franja es más alta y el club queda en su centro: así no sobra media pantalla abajo.
          "sm:flex sm:flex-col sm:justify-center",
          compact ? "pb-14 pt-8 sm:min-h-[30vh] sm:pb-20 sm:pt-12" : "pb-16 pt-12 sm:min-h-[40vh] sm:pb-24 sm:pt-16",
          "lg:min-h-0",
        )}
        data-testid="auth-club-panel"
      >
        <CourtLines />
        <div className="mx-auto w-full max-w-md lg:mx-0 lg:mt-[8vh]">
          <ClubBrand as={brandAs} compact={compact} />
          <ul className="mt-12 hidden max-w-sm space-y-5 lg:block" aria-label="Qué puedes hacer en la app">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-club-ui shadow-card ring-1 ring-line">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-display text-base font-bold text-ink">{title}</span>
                  <span className="block text-sm text-ink-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        {ownBrand && <RottaSignature className="hidden lg:flex" />}
      </aside>

      <main className="relative flex flex-1 flex-col px-4 sm:px-6 lg:justify-center lg:px-12 lg:py-12">
        {/* En el móvil la tarjeta sube un poco sobre la franja del club. */}
        <div className="-mt-8 flex flex-1 flex-col sm:-mt-12 sm:pb-12 lg:mt-0 lg:flex-none lg:pb-0">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
        <footer className="mx-auto flex w-full max-w-md flex-wrap items-center justify-between gap-x-4 gap-y-2 py-6 lg:mt-10 lg:py-0">
          <a href="/app/privacidad" className="inline-flex min-h-11 items-center text-xs font-semibold text-ink-muted underline underline-offset-2 hover:text-ink">
            Política de privacidad
          </a>
          {ownBrand && <RottaSignature className="lg:hidden" />}
        </footer>
      </main>
    </div>
  );
}

/** La tarjeta del formulario o del aviso. title: el h1 de la pantalla (si no lo es el club). */
export function AuthCard({ title, description, icon: Icon, children, className }) {
  return (
    <section className={cx("rounded-card bg-card p-5 shadow-card ring-1 ring-line sm:p-7", className)}>
      {(title || Icon) && (
        <header className="mb-5 space-y-2">
          {Icon && (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-club-soft text-club-ui">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
          )}
          {title && <h1 className="font-display text-2xl font-extrabold leading-tight text-ink sm:text-[1.75rem]">{title}</h1>}
          {description && <div className="text-sm leading-relaxed text-ink-muted">{description}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

// Pantalla completa sencilla (cargando, sin conexión): el escudo en el centro y la firma abajo.
function CenteredScreen({ children }) {
  const club = useClubIdentity();
  const ownBrand = Boolean(club.custom?.name || club.custom?.crest);
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden bg-canvas px-6 text-center font-body text-ink">
      <CourtLines />
      {children}
      {ownBrand && <RottaSignature className="absolute bottom-8" />}
    </div>
  );
}

/** Mientras se abre la app: el escudo del club y la marca de Rotta girando (quieta si se prefiere menos movimiento). */
export function AuthLoading() {
  const club = useClubIdentity();
  return (
    <CenteredScreen>
      <ClubCrest className="h-20 w-20 sm:h-24 sm:w-24" alt="" />
      <p className="font-display text-xl font-extrabold">{club.name}</p>
      <RotationMark className="h-8 w-8 text-rotta-text motion-safe:animate-[spin_2.4s_linear_infinite]" />
      <p role="status" className="sr-only">Cargando…</p>
    </CenteredScreen>
  );
}

/** Sin conexión con el servidor: qué pasa y Reintentar (con su estado mientras lo intenta). */
export function AuthError({ onRetry }) {
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  };
  return (
    <CenteredScreen>
      <ClubCrest className="h-16 w-16 sm:h-20 sm:w-20" alt="" />
      <div className="w-full max-w-sm space-y-4 rounded-card bg-card p-6 shadow-card ring-1 ring-line">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-raised text-ink-muted">
          <WifiOff aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="space-y-1.5">
          <div role="alert">
            <h1 className="font-display text-xl font-extrabold leading-tight">No se ha podido conectar con el servidor</h1>
          </div>
          <p className="text-sm text-ink-muted">Comprueba tu conexión. Si el servidor estaba parado, puede tardar un poco en arrancar.</p>
        </div>
        <Button block busy={busy} busyLabel="Conectando…" onClick={retry}>Reintentar</Button>
      </div>
    </CenteredScreen>
  );
}
