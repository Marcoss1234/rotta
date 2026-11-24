import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import ClubCrest from "@/app/components/ClubCrest.jsx";
import { deleteClubCrest, prepareCrest, saveClubName, uploadClubCrest, useClubIdentity } from "@/app/clubIdentity.js";

// Solo administradores: el nombre y el escudo del club. Salen en la entrada, el menú y el título de la app.
export default function ClubIdentitySettings() {
  const club = useClubIdentity();
  const [name, setName] = useState(club.custom.name ?? "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const changedName = name.trim() !== (club.custom.name ?? "") && name.trim().length > 0;

  const run = async (what, action, done) => {
    setBusy(what);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(done);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy("");
    }
  };

  const saveName = (event) => {
    event.preventDefault();
    run("name", () => saveClubName(name.trim()), "Guardado: todo el club ya ve este nombre.");
  };

  const chooseCrest = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) run("crest", async () => uploadClubCrest(await prepareCrest(file)), "Escudo guardado.");
  };

  return (
    <div className="space-y-3 border-t border-white/10 pt-4">
      <div>
        <h3 className="text-sm font-extrabold">Nombre y escudo del club</h3>
        <p className="text-xs text-zinc-400">Solo administradores. Salen al entrar, en el menú y en el título de la app.</p>
      </div>

      <div className="flex items-center gap-3 rounded-lg bg-void/60 p-2.5">
        <ClubCrest className="h-16 w-16 shrink-0" alt={club.custom.crest ? `Escudo de ${club.name}` : "Sin escudo: sale el de Rotta"} />
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => fileRef.current?.click()}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-tnt px-4 text-sm font-bold text-onbrand disabled:opacity-60"
          >
            <ImagePlus aria-hidden="true" className="h-4 w-4" />
            {busy === "crest" ? "Subiendo…" : club.custom.crest ? "Cambiar escudo" : "Subir escudo"}
          </button>
          {club.custom.crest && (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => run("crest", deleteClubCrest, "Escudo quitado: vuelve a salir el de Rotta.")}
              className="flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-zinc-200 ring-1 ring-white/15 hover:bg-white/5 disabled:opacity-60"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Quitar
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseCrest} className="sr-only" aria-label="Elegir el escudo del club" tabIndex={-1} />
        </div>
      </div>
      <p className="text-xs text-zinc-400">Mejor en PNG con el fondo transparente. Se ve entero, sin recortar.</p>

      <form onSubmit={saveName} className="flex gap-2">
        <label className="sr-only" htmlFor="club-name">Nombre del club</label>
        <input
          id="club-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          placeholder="Ej.: C.V. Los Pinos"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-void/60 px-4 text-sm text-white placeholder:text-zinc-500"
        />
        <button type="submit" disabled={!changedName || Boolean(busy)} className="min-h-11 shrink-0 rounded-full bg-tnt px-4 text-sm font-bold text-onbrand disabled:opacity-50">
          {busy === "name" ? "Guardando…" : "Guardar"}
        </button>
      </form>

      {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm font-semibold text-emerald-300">{message}</p>}
    </div>
  );
}
