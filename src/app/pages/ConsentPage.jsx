import { useId, useState } from "react";
import { Camera, CameraOff, ShieldCheck, UserRound, Users } from "lucide-react";
import { logout, saveConsent } from "@/app/api.js";
import { AuthCard, AuthShell } from "@/app/components/auth/AuthShell.jsx";
import { Button, Field, Input, Notice, cx } from "@/app/ui/index.js";

// Al entrar por primera vez (o si cambia la política): aceptar la privacidad, decir si es mayor de 14
// y, si no, quién da el permiso; y aparte, si se pueden ver sus fotos.
// También sirve desde el perfil para cambiar el permiso de fotos (`initial` y `onCancel`).
// Las opciones son radios de verdad (se eligen con las flechas del teclado), con aspecto de tarjeta.

function Choice({ name, checked, onSelect, icon: Icon, title, text }) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-card p-3.5 ring-1 ring-inset transition",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rotta-text",
        checked ? "bg-club-soft ring-club-ui" : "bg-card ring-line hover:ring-control",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="mt-0.5 h-5 w-5 shrink-0 accent-club focus:outline-none" />
      <Icon aria-hidden="true" className={cx("mt-0.5 h-5 w-5 shrink-0", checked ? "text-club-ui" : "text-ink-muted")} />
      <span className="min-w-0">
        <span className="block font-bold text-ink">{title}</span>
        <span className="block text-sm text-ink-muted">{text}</span>
      </span>
    </label>
  );
}

function Group({ legend, children }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-bold text-ink">{legend}</legend>
      {children}
    </fieldset>
  );
}

// Qué falta para poder seguir, en palabras (se lee junto al botón).
function missingParts({ read, adult, needsGuardian, guardian, photos, askRead }) {
  const missing = [];
  if (adult === null) missing.push("decir quién usa la cuenta");
  if (needsGuardian && guardian.trim().length < 3) missing.push("el nombre de quien da el permiso");
  if (photos === null) missing.push("elegir lo de las fotos");
  if (askRead && !read) missing.push("marcar que has leído la política");
  return missing;
}

const joinParts = (parts) => (parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`);

export default function ConsentPage({ user, initial = null, onSaved, onSignedOut, onCancel }) {
  const ids = useId();
  const [adult, setAdult] = useState(initial ? initial.adult : null);
  const [guardian, setGuardian] = useState("");
  const [photos, setPhotos] = useState(initial ? initial.photos : null);
  const [read, setRead] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsGuardian = adult === false;
  const missing = missingParts({ read, adult, needsGuardian, guardian, photos, askRead: !initial });
  const ready = missing.length === 0;

  const submit = async (event) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      onSaved(await saveConsent({ adult, photos, guardian_name: needsGuardian ? guardian.trim() : null }));
    } catch (saveError) {
      setError(saveError.message);
      setBusy(false);
    }
  };

  const leave = async () => {
    await logout().catch(() => {});
    onSignedOut?.();
  };

  const policyLink = (
    <a href="/app/privacidad" target="_blank" rel="noreferrer" className="font-semibold text-ink underline underline-offset-2 hover:text-club-text">
      política de privacidad
    </a>
  );

  const form = (
    <form onSubmit={submit} className="space-y-6">
      <Group legend="¿Quién va a usar esta cuenta?">
        <Choice name={`${ids}-edad`} checked={adult === true} onSelect={() => setAdult(true)} icon={UserRound} title="Tengo 14 años o más" text="Acepto yo." />
        <Choice name={`${ids}-edad`} checked={adult === false} onSelect={() => setAdult(false)} icon={Users} title="Es un menor de 14 años" text="Lo acepta su madre, padre o tutor." />
        {needsGuardian && (
          <Field id={`${ids}-tutor`} label="Nombre de quien da el permiso" hint="Su madre, su padre o su tutor legal." className="pt-2">
            <Input id={`${ids}-tutor`} value={guardian} onChange={(event) => setGuardian(event.target.value)} maxLength={80} autoComplete="name" placeholder="Nombre y apellidos" hint="Su madre, su padre o su tutor legal." />
          </Field>
        )}
      </Group>

      <Group legend="Fotos">
        <Choice name={`${ids}-fotos`} checked={photos === true} onSelect={() => setPhotos(true)} icon={Camera} title="Sí, se puede ver mi foto" text="La del perfil o la de Google, junto a mi nombre." />
        <Choice name={`${ids}-fotos`} checked={photos === false} onSelect={() => setPhotos(false)} icon={CameraOff} title="No, sin foto" text="Saldrán solo mis iniciales." />
      </Group>

      {!initial && (
        <label className="flex cursor-pointer items-start gap-3 rounded-card bg-raised p-3.5 text-sm text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rotta-text">
          <input type="checkbox" checked={read} onChange={(event) => setRead(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-club focus:outline-none" />
          <span>He leído la política de privacidad y acepto que el club use estos datos para organizarse. Puedo borrar mi cuenta cuando quiera.</span>
        </label>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <div className="space-y-2">
        <Button type="submit" size="lg" block disabled={!ready} busy={busy} busyLabel="Guardando…" aria-describedby={ready ? undefined : `${ids}-falta`}>
          {initial ? "Guardar permisos" : "Aceptar y entrar"}
        </Button>
        {!ready && (
          <p id={`${ids}-falta`} className="text-center text-sm text-ink-muted">
            Para seguir falta {joinParts(missing)}.
          </p>
        )}
        {onCancel ? (
          <Button variant="quiet" block onClick={onCancel}>Cancelar</Button>
        ) : (
          <Button variant="secondary" block onClick={leave}>No acepto · Salir</Button>
        )}
      </div>
    </form>
  );

  const description = (
    <p>
      La app guarda datos tuyos para organizar el club: tu ficha, si vas a entrenar, las notas, el chat… Lo tienes todo explicado en la {policyLink}.
    </p>
  );

  // Desde el perfil, sin el marco de la entrada: solo la tarjeta, centrada.
  if (initial) {
    return (
      <div className="min-h-dvh bg-canvas px-4 py-8 font-body text-ink">
        <div className="mx-auto max-w-md">
          <AuthCard icon={ShieldCheck} title="Tus permisos" description={description}>{form}</AuthCard>
        </div>
      </div>
    );
  }

  return (
    <AuthShell compact>
      <AuthCard icon={ShieldCheck} title={`Antes de entrar, ${user.name.split(" ")[0]}`} description={description}>{form}</AuthCard>
    </AuthShell>
  );
}
