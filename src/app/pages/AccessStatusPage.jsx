import { useState } from "react";
import { logout } from "@/app/api.js";
import { accountLabel } from "@/app/roles.js";

export default function AccessStatusPage({ user, onSignedOut, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const rejected = user.status === "rejected";

  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      onSignedOut();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-void px-6 text-center font-body text-white">
      <div className="w-full max-w-sm space-y-5">
        <img src="/rotta-logo.svg" alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />
        <h1 className="font-display text-2xl font-extrabold">
          {rejected ? "No tienes acceso" : "Tu acceso está pendiente"}
        </h1>
        <p className="text-base leading-relaxed text-zinc-300">
          {rejected
            ? "Si crees que es un error, habla con un administrador del club."
            : "Un administrador del club tiene que aprobarlo. Cuando lo haga, podrás entrar con esta cuenta."}
        </p>
        <p className="break-words text-sm text-zinc-400">{accountLabel(user)}</p>
        <div className="flex flex-col gap-2">
          {!rejected && (
            <button
              type="button"
              onClick={onRefresh}
              className="min-h-11 rounded-full bg-white font-semibold text-zinc-900 hover:bg-zinc-200"
            >
              Comprobar de nuevo
            </button>
          )}
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="min-h-11 rounded-full border border-white/20 font-semibold text-white hover:bg-white/5 disabled:opacity-60"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
