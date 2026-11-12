import { useState, useSyncExternalStore } from "react";
import { Download, EllipsisVertical, Share, SquarePlus, X } from "lucide-react";
import { canPromptInstall, installPlatform, promptInstall, subscribeToInstall } from "@/app/installPrompt.js";

const DISMISSED_KEY = "tnt-instalar-oculto";

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function storeDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Sin almacenamiento, volverá a salir la próxima vez.
  }
}

function Step({ number, children }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-snug text-zinc-200">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tnt text-xs font-bold text-onbrand">{number}</span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  );
}

const inlineIcon = "mx-0.5 inline h-4 w-4 align-text-bottom";

function IphoneSteps() {
  return (
    <ol className="space-y-2.5" data-testid="install-ios-steps">
      <Step number={1}>Abre esta página en <strong>Safari</strong>. Si vienes de WhatsApp, usa la opción de abrir en Safari.</Step>
      <Step number={2}>
        Pulsa <strong>Compartir</strong> <Share aria-hidden="true" className={inlineIcon} />, abajo o arriba de la pantalla. Si no lo ves, está dentro del botón <strong>···</strong>.
      </Step>
      <Step number={3}>
        Baja y elige <strong>Añadir a pantalla de inicio</strong> <SquarePlus aria-hidden="true" className={inlineIcon} />.
      </Step>
      <Step number={4}>Pulsa <strong>Añadir</strong>. Ya puedes abrirla desde el icono del Club.</Step>
    </ol>
  );
}

function AndroidManualSteps() {
  return (
    <ol className="space-y-2.5" data-testid="install-android-steps">
      <Step number={1}>Abre esta página en <strong>Chrome</strong>.</Step>
      <Step number={2}>
        Pulsa el menú <EllipsisVertical aria-hidden="true" className={inlineIcon} />, arriba a la derecha.
      </Step>
      <Step number={3}>Elige <strong>Instalar app</strong> o <strong>Añadir a pantalla de inicio</strong>.</Step>
    </ol>
  );
}

// variant "banner": aviso que se puede cerrar, en Inicio. variant "card": siempre visible, en Perfil.
export default function InstallCard({ variant = "card" }) {
  const canPrompt = useSyncExternalStore(subscribeToInstall, canPromptInstall);
  const [platform] = useState(installPlatform);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const banner = variant === "banner";

  if (platform === "installed" || installed) return null;
  if (banner && dismissed) return null;
  if (platform === "desktop" && !canPrompt) return null;
  if (banner && platform === "desktop") return null;

  const install = async () => {
    if (await promptInstall()) setInstalled(true);
  };
  const dismiss = () => {
    storeDismissed();
    setDismissed(true);
  };

  return (
    <section aria-labelledby={`install-title-${variant}`} className="rounded-xl border border-tnt/60 bg-panel p-4" data-testid={`install-${variant}`}>
      <div className="flex items-start gap-3">
        <img src="/rotta-logo.svg" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h2 id={`install-title-${variant}`} className="font-display text-base font-bold">Ten la app en tu móvil</h2>
          <p className="text-sm text-zinc-300">Con su icono en la pantalla de inicio, sin buscar el enlace en WhatsApp.</p>
        </div>
        {banner && (
          <button type="button" onClick={dismiss} aria-label="Ocultar este aviso" className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mt-3">
        {canPrompt ? (
          <button type="button" onClick={install} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-tnt font-bold text-onbrand md:w-auto md:px-6">
            <Download aria-hidden="true" className="h-5 w-5" />
            Instalar app
          </button>
        ) : (
          <>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
              className="min-h-11 w-full rounded-lg bg-tnt font-bold text-onbrand md:w-auto md:px-6"
            >
              {open ? "Ocultar pasos" : "Ver cómo se hace"}
            </button>
            {open && <div className="mt-3">{platform === "ios" ? <IphoneSteps /> : <AndroidManualSteps />}</div>}
          </>
        )}
      </div>
    </section>
  );
}
