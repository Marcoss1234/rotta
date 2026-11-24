import { useState } from "react";
import { Camera, CameraOff, ShieldCheck, UserRound, Users } from "lucide-react";
import { logout, saveConsent } from "@/app/api.js";
import { Notice } from "@/app/ui/index.js";

// Al entrar por primera vez (o si cambia la política): aceptar la privacidad, decir si es mayor de 14
// y, si no, quién da el permiso; y aparte, si se pueden ver sus fotos.
// También sirve desde el perfil para cambiar el permiso de fotos (`initial` y `onCancel`).

function Choice({ checked, onSelect, icon: Icon, title, text }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left ring-2 transition-colors ${checked ? "bg-tnt/15 ring-tnt" : "bg-panel ring-white/10 hover:ring-white/25"}`}
    >
      <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${checked ? "text-tnt" : "text-zinc-400"}`} />
      <span>
        <span className="block font-bold text-white">{title}</span>
        <span className="block text-sm text-zinc-400">{text}</span>
      </span>
    </button>
  );
}

export default function ConsentPage({ user, initial = null, onSaved, onSignedOut, onCancel }) {
  const [adult, setAdult] = useState(initial ? initial.adult : null);
  const [guardian, setGuardian] = useState("");
  const [photos, setPhotos] = useState(initial ? initial.photos : null);
  const [read, setRead] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsGuardian = adult === false;
  const ready = read && adult !== null && photos !== null && (!needsGuardian || guardian.trim().length >= 3);

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

  return (
    <div className="min-h-screen bg-void px-5 py-8 font-body text-white">
      <form onSubmit={submit} className="mx-auto max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <ShieldCheck aria-hidden="true" className="mx-auto h-10 w-10 text-tnt" />
          <h1 className="font-display text-3xl font-extrabold">{initial ? "Tus permisos" : `Antes de entrar, ${user.name.split(" ")[0]}`}</h1>
          <p className="text-sm text-zinc-400">
            La app guarda datos tuyos para organizar el club: tu ficha, si vas a entrenar, las notas, el chat… Lo tienes todo explicado en la{" "}
            <a href="/app/privacidad" target="_blank" rel="noreferrer" className="font-semibold text-ember underline">política de privacidad</a>.
          </p>
        </header>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-extrabold">¿Quién va a usar esta cuenta?</legend>
          <div role="radiogroup" className="space-y-2">
            <Choice checked={adult === true} onSelect={() => setAdult(true)} icon={UserRound} title="Tengo 14 años o más" text="Acepto yo." />
            <Choice
              checked={adult === false}
              onSelect={() => setAdult(false)}
              icon={Users}
              title="Es un menor de 14 años"
              text="Lo acepta su madre, padre o tutor."
            />
          </div>
          {needsGuardian && (
            <label className="block space-y-1 pt-1">
              <span className="text-sm font-semibold">Nombre de la madre, el padre o el tutor que da el permiso</span>
              <input
                value={guardian}
                onChange={(event) => setGuardian(event.target.value)}
                maxLength={80}
                autoComplete="name"
                className="min-h-11 w-full rounded-lg border border-white/15 bg-panel px-3 text-white placeholder:text-zinc-500 focus:border-tnt focus:outline-none"
                placeholder="Nombre y apellidos"
              />
            </label>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-extrabold">Fotos</legend>
          <div role="radiogroup" className="space-y-2">
            <Choice checked={photos === true} onSelect={() => setPhotos(true)} icon={Camera} title="Sí, se puede ver mi foto" text="La del perfil o la de Google, junto a mi nombre." />
            <Choice checked={photos === false} onSelect={() => setPhotos(false)} icon={CameraOff} title="No, sin foto" text="Saldrán solo mis iniciales." />
          </div>
        </fieldset>

        {!initial && (
          <label className="flex items-start gap-3 rounded-2xl bg-panel p-3 text-sm">
            <input type="checkbox" checked={read} onChange={(event) => setRead(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-tnt" />
            <span>He leído la política de privacidad y acepto que el club use estos datos para organizarse. Puedo borrar mi cuenta cuando quiera.</span>
          </label>
        )}

        {error && <Notice tone="error" inline>{error}</Notice>}

        <div className="space-y-2">
          <button type="submit" disabled={!ready || busy} className="min-h-12 w-full rounded-full bg-tnt font-bold text-onbrand disabled:opacity-40">
            {busy ? "Guardando…" : initial ? "Guardar permisos" : "Aceptar y entrar"}
          </button>
          {onCancel ? (
            <button type="button" onClick={onCancel} className="min-h-11 w-full rounded-full text-sm font-semibold text-zinc-300 hover:text-white">
              Cancelar
            </button>
          ) : (
            <button type="button" onClick={leave} className="min-h-11 w-full rounded-full text-sm font-semibold text-zinc-400 hover:text-white">
              No acepto · Salir
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
