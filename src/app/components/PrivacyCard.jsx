import { useState } from "react";
import { createPortal } from "react-dom";
import { Camera, CameraOff, FileText, ShieldCheck, Trash2 } from "lucide-react";
import { deleteAccount } from "@/app/api.js";
import ConsentPage from "@/app/pages/ConsentPage.jsx";

// En el perfil: los permisos que se dieron (y cambiarlos), la política y borrar la cuenta.
export default function PrivacyCard({ user, onUserChanged, onSignedOut }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const consent = user.consent ?? {};

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteAccount();
      onSignedOut();
    } catch (deleteError) {
      setError(deleteError.message);
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="privacy-title" className="space-y-3 rounded-xl bg-panel p-4">
      <h2 id="privacy-title" className="flex items-center gap-2 font-display text-xl font-black uppercase italic">
        <ShieldCheck aria-hidden="true" className="h-5 w-5 text-tnt" />
        Privacidad
      </h2>
      <ul className="space-y-1.5 text-sm">
        <li className="flex items-center gap-2 text-zinc-300">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-400" />
          {consent.adult === false ? "Permiso dado por su madre, padre o tutor" : "Política aceptada"}
        </li>
        <li className="flex items-center gap-2 text-zinc-300">
          {consent.photos === false ? <CameraOff aria-hidden="true" className="h-4 w-4 text-zinc-400" /> : <Camera aria-hidden="true" className="h-4 w-4 text-emerald-400" />}
          {consent.photos === false ? "Sin foto: salen tus iniciales" : "Se puede ver tu foto"}
        </li>
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => setEditing(true)} className="min-h-11 rounded-lg text-sm font-bold text-zinc-100 ring-1 ring-white/15 hover:bg-white/5">
          Cambiar permisos
        </button>
        <a href="/app/privacidad" target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-bold text-zinc-100 ring-1 ring-white/15 hover:bg-white/5">
          <FileText aria-hidden="true" className="h-4 w-4" />
          Política de privacidad
        </a>
      </div>

      <div className="border-t border-white/10 pt-3">
        {!deleting ? (
          <button type="button" onClick={() => setDeleting(true)} className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-red-300 hover:text-red-200">
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Borrar mi cuenta
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-red-400/40 bg-red-500/10 p-3">
            <p className="text-sm font-bold text-red-200">Se borrará todo y no se puede deshacer:</p>
            <p className="text-sm text-zinc-300">
              tu cuenta, tu ficha en la plantilla, tus notas y premios del ranking, tus coins y compras, tus mensajes e imágenes del chat y
              si ibas a entrenar. Si vuelves, empezarás de cero.
            </p>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Escribe BORRAR para confirmar</span>
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                className="min-h-11 w-full rounded-lg border border-white/15 bg-void px-3 font-bold tracking-widest text-white focus:border-red-400 focus:outline-none"
              />
            </label>
            {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleting(false);
                  setTyped("");
                }}
                className="min-h-11 rounded-lg text-sm font-bold text-zinc-200 ring-1 ring-white/15"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={typed.trim().toUpperCase() !== "BORRAR" || busy}
                onClick={remove}
                className="min-h-11 rounded-lg bg-red-600 text-sm font-bold text-snow disabled:opacity-40"
              >
                {busy ? "Borrando…" : "Borrar para siempre"}
              </button>
            </div>
          </div>
        )}
      </div>

      {editing &&
        createPortal(
          <div className="fixed inset-0 z-[60] overflow-y-auto bg-void">
            <ConsentPage
              user={user}
              initial={{ adult: consent.adult ?? true, photos: consent.photos ?? true }}
              onSaved={(updated) => {
                setEditing(false);
                onUserChanged(updated);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>,
          document.body,
        )}
    </section>
  );
}
