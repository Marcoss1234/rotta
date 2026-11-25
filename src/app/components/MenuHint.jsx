import { X } from "lucide-react";
import { Button, IconButton } from "@/app/ui/index.js";

// Bocadillo encima del botón "Menú" para quien aún no lo ha abierto nunca: dice qué hay dentro.
// Colores del tema (tarjeta, texto y el botón del club), en claro y en oscuro.
export default function MenuHint({ hidden, onOpen, onDismiss }) {
  const names = hidden.slice(0, 3).join(", ");
  return (
    <div role="status" className="menu-hint pointer-events-none fixed bottom-[calc(4.6rem+env(safe-area-inset-bottom))] right-2 z-[55] w-64 md:hidden">
      <div className="pointer-events-auto relative rounded-card bg-card p-3 pr-10 text-ink shadow-card ring-1 ring-control">
        <p className="text-xs font-bold text-club-label">Más secciones en el menú</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug">
          Aquí tienes {names}
          {hidden.length > 3 ? " y más" : ""}.
        </p>
        <Button size="sm" onClick={onOpen} className="mt-2">Abrir el menú</Button>
        <IconButton icon={X} label="Cerrar el aviso" size="sm" onClick={onDismiss} className="absolute right-0.5 top-0.5" />
        {/* Flecha hacia el botón Menú, abajo a la derecha. */}
        <span aria-hidden="true" className="absolute -bottom-1.5 right-7 h-3 w-3 rotate-45 bg-card ring-1 ring-control [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
      </div>
    </div>
  );
}
