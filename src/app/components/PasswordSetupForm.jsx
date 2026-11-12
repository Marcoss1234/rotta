import { useState } from "react";
import { setUpPassword } from "@/app/api.js";
import PasswordField, { fieldClass, fieldLabelClass } from "@/app/components/PasswordField.jsx";

const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
// Los mismos que rechaza el servidor: harían creer que la cuenta es del club.
const RESERVED = new Set(["admin", "administrador", "administracion", "root", "club", "tnt", "entrenador", "soporte"]);

export default function PasswordSetupForm({ onDone }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const name = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(name)) {
      setError("El usuario debe tener de 3 a 30 caracteres: letras sin acentos, números, punto, guion o guion bajo");
      return;
    }
    if (RESERVED.has(name)) {
      setError(`"${name}" está reservado. Usa tu nombre, por ejemplo marcos.nino`);
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password.toLowerCase().includes(name)) {
      setError("La contraseña no puede contener tu usuario");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const user = await setUpPassword(name, password);
      setPassword("");
      onDone(user);
    } catch (setupError) {
      setError(setupError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="setup-username" className={fieldLabelClass}>Usuario</label>
        <input
          id="setup-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={30}
          required
          disabled={busy}
          aria-describedby="setup-username-hint"
          className={fieldClass}
        />
        <p id="setup-username-hint" className="mt-1 text-xs text-zinc-400">Por ejemplo, marcos.nino</p>
      </div>
      <PasswordField id="setup-password" label="Contraseña" value={password} onChange={setPassword} autoComplete="new-password" hint="Al menos 8 caracteres." disabled={busy} />
      {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-11 w-full rounded-lg bg-tnt px-6 font-bold text-onbrand disabled:opacity-60 md:w-auto">
        {busy ? "Guardando…" : "Crear usuario y contraseña"}
      </button>
    </form>
  );
}
