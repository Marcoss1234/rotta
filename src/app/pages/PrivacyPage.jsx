import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

// Política de privacidad de Rotta. Se ve sin iniciar sesión (/app/privacidad).
// El responsable es cada club; Rotta trata los datos por encargo suyo.
// Si cambia algo importante, hay que subir POLICY_VERSION (src/app/privacy.js y backend/privacy.py).
// TODO (multi-club): poner el nombre y el contacto del club de quien la lee.

const UPDATED = "12 de noviembre de 2026";

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      <div className="space-y-2 text-[15px] leading-relaxed text-zinc-300">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacidad | Rotta";
  }, []);

  return (
    <div className="min-h-screen bg-void px-5 py-8 font-body text-white">
      <article className="mx-auto max-w-2xl space-y-7">
        <a href="/app" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-zinc-300 hover:text-white">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Volver a la app
        </a>
        <header className="space-y-1">
          <h1 className="font-display text-4xl font-extrabold leading-tight">Política de privacidad</h1>
          <p className="text-sm text-zinc-400">Rotta · Gestor de clubs · Actualizada el {UPDATED}</p>
        </header>

        <Section title="Quién se encarga de tus datos">
          <p>
            <strong className="text-white">Tu club</strong>, el que te ha dado acceso a la app, es el responsable de tus datos: decide
            qué se apunta y para qué. <strong className="text-white">Rotta</strong> es la herramienta que usa el club y guarda los datos por
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
            desde tu perfil, incluido <strong className="text-white">borrar tu cuenta</strong>. Para lo demás, habla con tu club.
          </p>
          <p>
            Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos
            (<a className="font-semibold text-ember underline" href="https://www.aepd.es">www.aepd.es</a>).
          </p>
        </Section>
      </article>
    </div>
  );
}
