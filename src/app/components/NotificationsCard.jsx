import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { getNotificationStatus, updateNotificationPreferences } from "@/app/api.js";
import { currentPushSubscription, disablePush, enablePush, pushAvailability } from "@/app/notifications.js";

const DISMISSED_KEY = "tnt-avisos-oculto";
const KINDS = [
  { id: "chat", label: "Mensajes del chat" },
  { id: "matches", label: "Partidos" },
  { id: "ranking", label: "Ranking" },
];
const AVAILABILITY_HELP = {
  "needs-install": "En iPhone, primero instala la app en la pantalla de inicio y ábrela desde su icono.",
  denied: "Las tienes bloqueadas. Actívalas en los ajustes de tu móvil, dentro de las notificaciones de esta app.",
  unsupported: "Este navegador no permite recibir notificaciones.",
};

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

function Switch({ label, checked, disabled, onChange }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-zinc-200">
      {label}
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-white/15 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-tnt peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white peer-disabled:opacity-50" />
    </label>
  );
}

// variant "banner": aviso que se puede cerrar, en Inicio. variant "card": los ajustes, en Perfil.
export default function NotificationsCard({ variant = "card" }) {
  const [status, setStatus] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [availability, setAvailability] = useState(pushAvailability);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const banner = variant === "banner";

  useEffect(() => {
    let cancelled = false;
    Promise.all([getNotificationStatus(), currentPushSubscription()])
      .then(([data, subscription]) => {
        if (cancelled) return;
        setStatus(data);
        setSubscribed(Boolean(subscription));
      })
      .catch(() => {
        // Son un extra: si fallan, la pantalla sigue funcionando sin esta tarjeta.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.enabled) return null;
  if (banner && (dismissed || subscribed || availability !== "ready")) return null;

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setAvailability(pushAvailability());
      setBusy(false);
    }
  };

  const activate = () =>
    run(async () => {
      await enablePush(status.public_key);
      setSubscribed(true);
    });
  const deactivate = () =>
    run(async () => {
      await disablePush();
      setSubscribed(false);
    });
  const changeKind = (kind, value) =>
    run(async () => {
      const preferences = await updateNotificationPreferences({ [kind]: value });
      setStatus((current) => ({ ...current, preferences }));
    });

  if (banner) {
    return (
      <aside aria-label="Activar notificaciones" className="relative rounded-2xl border border-tnt/60 bg-gradient-to-r from-tnt/25 to-panel p-4">
        <button
          type="button"
          onClick={() => {
            storeDismissed();
            setDismissed(true);
          }}
          aria-label="Ocultar este aviso"
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-300 hover:text-white"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
        <p className="flex items-center gap-2 pr-8 font-display text-lg font-black uppercase italic leading-tight">
          <Bell aria-hidden="true" className="h-5 w-5 shrink-0 fill-tnt text-tnt" />
          Activa los avisos
        </p>
        <p className="mt-1 text-sm text-zinc-200">Entérate de los mensajes, los partidos y el ranking aunque tengas la app cerrada.</p>
        <button type="button" disabled={busy} onClick={activate} className="mt-3 min-h-11 w-full rounded-lg bg-tnt px-4 text-sm font-bold text-onbrand disabled:opacity-60">
          {busy ? "Activando…" : "Activar notificaciones"}
        </button>
        {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-300">{error}</p>}
      </aside>
    );
  }

  return (
    <section aria-labelledby="notifications-title" className="space-y-3 rounded-xl bg-panel p-4">
      <h2 id="notifications-title" className="flex items-center gap-2 font-display text-lg font-bold">
        <Bell aria-hidden="true" className="h-5 w-5 text-tnt" />
        Notificaciones
      </h2>
      {availability !== "ready" && !subscribed ? (
        <p className="text-sm text-zinc-300">{AVAILABILITY_HELP[availability]}</p>
      ) : (
        <>
          <Switch label="Activar en este móvil" checked={subscribed} disabled={busy} onChange={(value) => (value ? activate() : deactivate())} />
          {subscribed && (
            <fieldset className="border-t border-white/10 pt-1">
              <legend className="sr-only">Qué avisos quieres recibir</legend>
              {KINDS.map(({ id, label }) => (
                <Switch key={id} label={label} checked={status.preferences[id]} disabled={busy} onChange={(value) => changeKind(id, value)} />
              ))}
            </fieldset>
          )}
        </>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
    </section>
  );
}
