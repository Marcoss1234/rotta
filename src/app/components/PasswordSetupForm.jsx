import { useState } from "react";
import { setUpPassword } from "@/app/api.js";
import PasswordField from "@/app/components/PasswordField.jsx";
import { Button, Field, Input, Notice } from "@/app/ui/index.js";

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
    <form onSubmit={submit} className="space-y-4">
      <Field id="setup-username" label="Usuario" hint="Por ejemplo, marcos.nino">
        <Input
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
          hint="Por ejemplo, marcos.nino"
        />
      </Field>
      <PasswordField id="setup-password" label="Contraseña" value={password} onChange={setPassword} autoComplete="new-password" hint="Al menos 8 caracteres." disabled={busy} />
      {error && <Notice tone="error" inline>{error}</Notice>}
      <Button type="submit" busy={busy} busyLabel="Guardando…" className="w-full md:w-auto">Crear usuario y contraseña</Button>
    </form>
  );
}
