import { useState } from "react";
import { DatabaseBackup, Download } from "lucide-react";
import { downloadBackup } from "@/app/api.js";

const LAST_KEY = "tnt-ultima-copia";

function readLast() {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

function lastLabel(iso) {
  if (!iso) return "Todavía no has descargado ninguna desde este dispositivo.";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Última copia descargada hoy.";
  if (days === 1) return "Última copia descargada ayer.";
  return `Última copia descargada hace ${days} días.`;
}

// Copia de seguridad para administradores: un archivo con todo lo que cuesta rehacer
// (usuarios, plantillas, asistencia, partidos, eventos, notas, horarios, pizarra y chat).
export default function BackupCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState(readLast);

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const { blob, name } = await downloadBackup();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const now = new Date().toISOString();
      try {
        localStorage.setItem(LAST_KEY, now);
      } catch {
        // Sin almacenamiento: no se recuerda la fecha.
      }
      setLast(now);
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setBusy(false);
    }
  };

  const old = !last || Date.now() - new Date(last).getTime() > 7 * 86400000;
  return (
    <section aria-labelledby="backup-title" className="rounded-3xl ring-1 ring-white/10 bg-panel p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-ember">
          <DatabaseBackup className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="backup-title" className="text-sm font-bold">Copia de seguridad</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Descarga un archivo con todo lo del club: usuarios, plantillas, asistencia, partidos, eventos, notas, horarios, jugadas y chat.
            Guárdalo en tu ordenador o en Google Drive. Las fotos y las contraseñas no van en la copia.
          </p>
          <p className={`mt-2 text-xs font-semibold ${old ? "text-amber-300" : "text-zinc-400"}`}>
            {lastLabel(last)}
            {old ? " Conviene hacer una a la semana." : ""}
          </p>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-300/50 p-2 text-sm font-semibold text-red-200">{error}</p>}
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-void hover:bg-zinc-200 disabled:opacity-60 sm:w-auto sm:px-4"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        {busy ? "Preparando la copia…" : "Descargar copia"}
      </button>
    </section>
  );
}
