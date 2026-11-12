import { X } from "lucide-react";

// Bocadillo encima del botón "Menú" para quien aún no lo ha abierto nunca: dice qué hay dentro.
export default function MenuHint({ hidden, onOpen, onDismiss }) {
  const names = hidden.slice(0, 3).join(", ");
  return (
    <div role="status" className="menu-hint pointer-events-none fixed bottom-[calc(4.6rem+env(safe-area-inset-bottom))] right-2 z-[55] w-64 md:hidden">
      <div className="pointer-events-auto relative rounded-2xl bg-white p-3 pr-9 text-void shadow-[0_10px_30px_rgba(0,0,0,0.55)]">
        <p className="text-[11px] font-black uppercase tracking-wider text-tnt">¡Nuevo menú!</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug">
          Aquí tienes {names}
          {hidden.length > 3 ? " y más" : ""}. Toca «Menú» para abrirlo.
        </p>
        <button type="button" onClick={onOpen} className="mt-2 min-h-9 rounded-full bg-tnt px-3 text-xs font-extrabold text-onbrand">
          Abrir el menú
        </button>
        <button type="button" onClick={onDismiss} aria-label="Cerrar el aviso" className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-black/5">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
        {/* Flecha hacia el botón Menú, abajo a la derecha. */}
        <span aria-hidden="true" className="absolute -bottom-1.5 right-7 h-3 w-3 rotate-45 bg-white" />
      </div>
    </div>
  );
}
