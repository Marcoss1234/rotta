import { useState } from "react";
import { changePassword } from "@/app/api.js";
import PasswordField from "@/app/components/PasswordField.jsx";
import { Button, Notice } from "@/app/ui/index.js";

// Cambiar la contraseña: desde Perfil y en la pantalla de la contraseña temporal (`block`: botón a todo el ancho).
export default function PasswordChangeForm({ currentLabel = "Contraseña actual", onChanged, block = false }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (next.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const user = await changePassword(current, next);
      setCurrent("");
      setNext("");
      onChanged(user);
    } catch (changeError) {
      setError(changeError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PasswordField id="current-password" label={currentLabel} value={current} onChange={setCurrent} autoComplete="current-password" disabled={busy} />
      <PasswordField id="new-password" label="Nueva contraseña" value={next} onChange={setNext} autoComplete="new-password" hint="Al menos 8 caracteres." disabled={busy} />
      {error && <Notice tone="error" inline>{error}</Notice>}
      <Button type="submit" size={block ? "lg" : "md"} block={block} busy={busy} busyLabel="Guardando…" className={block ? undefined : "w-full md:w-auto"}>
        Cambiar contraseña
      </Button>
    </form>
  );
}
