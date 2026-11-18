import { ChevronRight, Coins, Crown, Medal, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

const PLACE_STYLE = {
  1: "bg-amber-300/15 text-amber-200 ring-amber-300/40",
  2: "bg-zinc-200/10 text-zinc-100 ring-zinc-200/30",
  3: "bg-orange-400/15 text-orange-200 ring-orange-400/40",
};

const CROWN_TEXT = {
  month: "Llevas la corona del mejor del mes",
  gold: "Llevas la corona de oro: Top 1 de la semana",
  silver: "Llevas la corona de plata: Top 2 de la semana",
  bronze: "Llevas la corona de bronce: Top 3 de la semana",
};

function whenLabel(iso) {
  const date = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Club Coins del perfil: el saldo en grande, los premios ganados y de dónde han salido los últimos coins.
export default function CoinsCard({ coins }) {
  if (!coins) return null;
  const amount = coins.balance.toLocaleString("es-ES");
  return (
    <section aria-labelledby="coins-title" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400/[0.14] via-panel to-panel p-4 ring-1 ring-amber-300/25">
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-amber-950 shadow-[0_4px_18px_rgba(245,197,66,0.45)]">
          <Coins className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="coins-title" className="text-xs font-extrabold text-amber-200/80">Club Coins</h2>
          <p className="font-display text-3xl font-black leading-none tabular-nums text-white">{amount}</p>
        </div>
        <Link to="/app/tienda" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 pl-3 pr-2 text-sm font-black text-void shadow-[0_4px_14px_rgba(245,197,66,0.35)]">
          <ShoppingBag aria-hidden="true" className="h-4 w-4" />
          Tienda
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      {coins.crown && (
        <p className="relative mt-3 flex items-center gap-2 rounded-lg bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100">
          <Crown aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-300" />
          {CROWN_TEXT[coins.crown]}
        </p>
      )}

      {coins.honors.length > 0 && (
        <div className="relative mt-3">
          <h3 className="text-[11px] font-bold text-zinc-400">Tus premios</h3>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {coins.honors.map((honor) => (
              <li
                key={`${honor.group_id}-${honor.kind}-${honor.period}`}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${PLACE_STYLE[honor.place] ?? PLACE_STYLE[3]}`}
              >
                {honor.kind === "month" && honor.place === 1 ? <Crown aria-hidden="true" className="h-3.5 w-3.5" /> : <Medal aria-hidden="true" className="h-3.5 w-3.5" />}
                {honor.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative mt-3">
        <h3 className="text-[11px] font-bold text-zinc-400">Últimos movimientos</h3>
        {coins.entries.length === 0 ? (
          <p className="mt-1.5 text-sm text-zinc-400">
            Aún no tienes coins. Se ganan quedando en el podio del ranking, siendo el mejor del mes y respondiendo a la asistencia de los entrenos.
          </p>
        ) : (
          <ul className="mt-1.5 divide-y divide-white/5">
            {coins.entries.map((entry, index) => (
              <li key={index} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0 truncate text-zinc-200">{entry.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-zinc-500">{whenLabel(entry.created_at)}</span>
                  <span className={`font-extrabold tabular-nums ${entry.amount >= 0 ? "text-amber-300" : "text-red-300"}`}>
                    {entry.amount >= 0 ? "+" : ""}
                    {entry.amount}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
