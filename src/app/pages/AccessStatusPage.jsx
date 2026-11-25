import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Hourglass, UserX } from "lucide-react";
import { logout } from "@/app/api.js";
import { AuthCard, AuthShell } from "@/app/components/auth/AuthShell.jsx";
import { accountLabel } from "@/app/roles.js";
import { Button, cx } from "@/app/ui/index.js";

// Al volver a la app (otra pestaña, el móvil desbloqueado...) se comprueba sola si ya te han aprobado.
// Como mucho una vez cada medio minuto, y nunca mientras la app está en segundo plano: nada de consultas constantes.
export const AUTO_CHECK_MS = 30_000;

const timeLabel = (date) => date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

function Step({ done, title, text }) {
  return (
    <li className="flex gap-3">
      <span
        className={cx(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
          // Hecho en verde (Voy) y en espera en ámbar: colores con significado, iguales con cualquier club.
          done ? "bg-voy/15 text-voy-text ring-voy/40" : "bg-warning/10 text-warning-text ring-warning/40",
        )}
      >
        {done ? <Check aria-hidden="true" className="h-4 w-4" /> : <Hourglass aria-hidden="true" className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="block text-sm font-bold text-ink">
          {title}
          <span className="sr-only">{done ? " (hecho)" : " (en espera)"}</span>
        </span>
        {text && <span className="block text-sm text-ink-muted">{text}</span>}
      </span>
    </li>
  );
}

export default function AccessStatusPage({ user, onSignedOut, onRefresh }) {
  const [signingOut, setSigningOut] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);
  const lastCheck = useRef(0);
  const rejected = user.status === "rejected";

  const check = useCallback(async () => {
    lastCheck.current = Date.now();
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      // Si te han aprobado, esta pantalla ya no está; si no, se dice cuándo se ha mirado.
      setChecking(false);
      setCheckedAt(new Date());
    }
  }, [onRefresh]);

  useEffect(() => {
    if (rejected) return undefined;
    const onReturn = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheck.current < AUTO_CHECK_MS) return;
      check();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("online", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("online", onReturn);
    };
  }, [rejected, check]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // Sin conexión también se sale: la sesión caduca sola.
    } finally {
      onSignedOut();
    }
  };

  const account = (
    <p className="mt-5 break-words rounded-card bg-raised px-3.5 py-2.5 text-sm text-ink-muted">
      Has entrado como <span className="font-semibold text-ink">{accountLabel(user)}</span>
    </p>
  );

  if (rejected) {
    return (
      <AuthShell>
        <AuthCard
          icon={UserX}
          iconTone="neutral"
          title="No tienes acceso"
          description="El club no ha aprobado esta cuenta. Si crees que es un error, habla con un entrenador o un administrador del club."
        >
          {account}
          <Button variant="secondary" size="lg" block onClick={signOut} disabled={signingOut} className="mt-5">Cerrar sesión</Button>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard icon={Hourglass} iconTone="warning" title="Tu acceso está pendiente" description="Ya casi está. Solo falta que el club te dé acceso.">
        <ol className="space-y-4" aria-label="Pasos para entrar">
          <Step done title="Cuenta creada" />
          <Step done title="Permisos aceptados" />
          <Step title="Aprobación del club" text="Un entrenador o un administrador te dará acceso a tu equipo. Al hacerlo, entrarás directamente." />
        </ol>
        {account}
        <div className="mt-5 space-y-2">
          <Button size="lg" block busy={checking} busyLabel="Comprobando…" onClick={check}>Comprobar de nuevo</Button>
          <p role="status" className="min-h-5 text-center text-xs text-ink-muted">
            {checkedAt && !checking ? `Sigue pendiente · comprobado a las ${timeLabel(checkedAt)}` : "También lo comprobamos al volver a la app."}
          </p>
          <Button variant="quiet" block onClick={signOut} disabled={signingOut}>Cerrar sesión</Button>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
