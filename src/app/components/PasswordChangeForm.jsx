import { useState } from "react";
import { changePassword } from "@/app/api.js";
import PasswordField from "@/app/components/PasswordField.jsx";
import { Notice } from "@/app/ui/index.js";

export default function PasswordChangeForm({ currentLabel = "Contraseña actual", onChanged }) {
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
    <form onSubmit={submit} className="space-y-3">
      <PasswordField id="current-password" label={currentLabel} value={current} onChange={setCurrent} autoComplete="current-password" disabled={busy} />
      <PasswordField id="new-password" label="Nueva contraseña" value={next} onChange={setNext} autoComplete="new-password" hint="Al menos 8 caracteres." disabled={busy} />
      {error && <Notice tone="error" inline>{error}</Notice>}
      <button type="submit" disabled={busy} className="min-h-11 w-full rounded-full bg-tnt px-6 font-bold text-onbrand disabled:opacity-60 md:w-auto">
        {busy ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
