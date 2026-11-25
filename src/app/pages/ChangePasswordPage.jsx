import { useState } from "react";
import { KeyRound } from "lucide-react";
import { logout } from "@/app/api.js";
import { AuthCard, AuthShell } from "@/app/components/auth/AuthShell.jsx";
import PasswordChangeForm from "@/app/components/PasswordChangeForm.jsx";
import { Button } from "@/app/ui/index.js";

// Al entrar con la contraseña temporal que da un administrador: hay que cambiarla antes de seguir.
export default function ChangePasswordPage({ onChanged, onSignedOut }) {
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
    } catch {
      // Sin conexión también se sale: la sesión caduca sola.
    } finally {
      onSignedOut();
    }
  };

  return (
    <AuthShell>
      <AuthCard
        icon={KeyRound}
        title="Elige una contraseña nueva"
        description="Has entrado con la contraseña temporal que te ha dado el club. Cámbiala por una tuya para seguir."
      >
        <PasswordChangeForm currentLabel="Contraseña temporal" onChanged={onChanged} block />
        <Button variant="quiet" block onClick={signOut} disabled={busy} className="mt-3">Cerrar sesión</Button>
      </AuthCard>
    </AuthShell>
  );
}
