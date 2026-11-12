import { useState } from "react";
import { logout } from "@/app/api.js";
import PasswordChangeForm from "@/app/components/PasswordChangeForm.jsx";

export default function ChangePasswordPage({ onChanged, onSignedOut }) {
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      onSignedOut();
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-void px-6 py-8 font-body text-white">
      <div className="mx-auto w-full max-w-sm space-y-5">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-extrabold">Elige una contraseña nueva</h1>
          <p className="text-base leading-relaxed text-zinc-300">Has entrado con una contraseña temporal. Cámbiala para seguir.</p>
        </div>
        <PasswordChangeForm currentLabel="Contraseña temporal" onChanged={onChanged} />
        <button type="button" onClick={signOut} disabled={busy} className="min-h-11 w-full text-sm font-semibold text-zinc-300 hover:text-white disabled:opacity-60">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
