import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { RottaSignature } from "@/app/components/auth/AuthShell.jsx";
import { LinkButton } from "@/app/ui/index.js";

// Política de privacidad de Rotta. Se ve sin iniciar sesión (/app/privacidad).
// El responsable es cada club; Rotta trata los datos por encargo suyo.
// Si cambia algo importante, hay que subir POLICY_VERSION (src/app/privacy.js y backend/privacy.py).
// TODO (multi-club): poner el nombre y el contacto del club de quien la lee.

const UPDATED = "12 de noviembre de 2026";

// Los apartados, en orden: con ellos se hace el índice (en el ordenador, a la izquierda).
export const SECTIONS = [
  "Quién se encarga de tus datos",
  "Qué datos guarda la app",
  "Para qué los usamos",
  "Quién los ve",
  "Menores de 14 años",
  "Dónde se guardan",
  "Cuánto tiempo",
  "Tus derechos",
];

export const sectionId = (title) =>
  title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function Section({ title, children }) {
  return (
    <section id={sectionId(title)} aria-labelledby={`${sectionId(title)}-titulo`} className="scroll-mt-6 space-y-2.5 border-t border-line pt-6 first:border-t-0 first:pt-0">
      <h2 id={`${sectionId(title)}-titulo`} className="font-display text-xl font-extrabold text-ink">{title}</h2>
      <div className="space-y-2.5 text-[15px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacidad | Rotta";
  }, []);

  return (
    <div className="min-h-dvh bg-canvas px-5 py-8 font-body text-ink md:px-8 lg:py-12">
      <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <nav aria-label="Apartados de la política" className="sticky top-12 space-y-1">
            <p className="mb-2 text-xs font-bold text-ink-muted">En esta página</p>
            {SECTIONS.map((title) => (
              <a key={title} href={`#${sectionId(title)}`} className="block rounded-control px-3 py-1.5 text-sm text-ink-muted hover:bg-raised hover:text-ink">
                {title}
              </a>
            ))}
          </nav>
        </aside>

      <article className="max-w-2xl space-y-8">
        <LinkButton href="/app" icon={ArrowLeft} size="sm" variant="secondary">Volver a la app</LinkButton>
        <header className="space-y-2">
          <h1 className="font-display text-4xl font-extrabold leading-tight md:text-5xl">Política de privacidad</h1>
          <p className="text-sm text-ink-muted">Rotta · Gestor de clubs · Actualizada el {UPDATED}</p>
        </header>

        <div className="space-y-6 rounded-card bg-card p-5 shadow-card ring-1 ring-line md:p-8">
        <Section title="Quién se encarga de tus datos">
          <p>
            <strong className="font-bold text-ink">Tu club</strong>, el que te ha dado acceso a la app, es el responsable de tus datos: decide
            qué se apunta y para qué. <strong className="font-bold text-ink">Rotta</strong> es la herramienta que usa el club y guarda los datos por
            encargo suyo, sin usarlos para nada más.
          </p>
          <p>Para cualquier cosa sobre tus datos, habla con tu club (sus entrenadores o la directiva).</p>
        </Section>

        <Section title="Qué datos guarda la app">
          <ul className="list-disc space-y-1 pl-5">
            <li>Tu cuenta: nombre, correo o usuario, y la foto si la subes o viene de Google.</li>
            <li>Tu ficha en el club: equipo, posición, dorsal, altura y teléfono o correo si los pone el entrenador.</li>
            <li>Si vas o no a entrenos y partidos.</li>
            <li>Las notas del ranking que pone el entrenador, con sus comentarios, y los premios y coins.</li>
            <li>Los mensajes e imágenes que envías por el chat.</li>
            <li>Tu personaje de la app y lo que compras en la tienda con coins (no hay dinero real).</li>
            <li>Si los activas, los datos técnicos para mandarte avisos al móvil.</li>
          </ul>
        </Section>

        <Section title="Para qué los usamos">
          <p>
            Solo para organizar el club: entrenamientos, partidos, comunicación entre jugadores, entrenadores y familias, y el ranking.
            No hay publicidad, no vendemos tus datos y no se los damos a nadie para otra cosa.
          </p>
          <p>
            Se hace porque formas parte del club y lo aceptas al entrar en la app. Puedes retirar ese permiso cuando quieras borrando
            tu cuenta.
          </p>
        </Section>

        <Section title="Quién los ve">
          <ul className="list-disc space-y-1 pl-5">
            <li>Tus compañeros ven tu nombre, foto, posición, si vas a entrenar y tu nota media del ranking.</li>
            <li>Los comentarios de las notas solo los ves tú, tus entrenadores y los administradores del club.</li>
            <li>Las familias solo ven los horarios, partidos y el chat de familias.</li>
          </ul>
        </Section>

        <Section title="Menores de 14 años">
          <p>
            Por ley, para que un menor de 14 años use la app hace falta el permiso de su madre, padre o tutor. Al entrar, la app lo pide y
            guarda el nombre de quien lo da. También pide aparte permiso para las fotos: sin él, no se ve ni se puede subir foto del menor.
          </p>
        </Section>

        <Section title="Dónde se guardan">
          <p>
            En servicios de internet que la app usa para funcionar: el alojamiento de la web (Vercel), la base de datos (MongoDB Atlas),
            el inicio de sesión con Google si lo usas y los servicios de avisos de Google, Apple o Mozilla. Algunos pueden guardar datos
            fuera de la Unión Europea, siempre con las garantías que pide la ley.
          </p>
        </Section>

        <Section title="Cuánto tiempo">
          <p>Mientras tengas cuenta. Si la borras, se borran tus datos en el momento (las copias de seguridad se renuevan en pocas semanas).</p>
        </Section>

        <Section title="Tus derechos">
          <p>
            Puedes ver, corregir o borrar tus datos, oponerte a que se usen, limitarlos o pedir una copia. Casi todo lo puedes hacer tú
            desde tu perfil, incluido <strong className="font-bold text-ink">borrar tu cuenta</strong>. Para lo demás, habla con tu club.
          </p>
          <p>
            Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos
            (<a className="font-semibold text-ink underline underline-offset-2 hover:text-club-text" href="https://www.aepd.es">www.aepd.es</a>).
          </p>
        </Section>
        </div>

        <RottaSignature />
      </article>
      </div>
    </div>
  );
}
