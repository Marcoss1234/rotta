import { Coins, Crown } from "lucide-react";
import Avatar from "@/app/components/Avatar.jsx";

const MEDAL = {
  1: { label: "Oro", ring: "ring-amber-300", text: "text-amber-200" },
  2: { label: "Plata", ring: "ring-zinc-200", text: "text-zinc-100" },
  3: { label: "Bronce", ring: "ring-orange-400", text: "text-orange-200" },
};

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const monthName = (period) => MONTHS[Number(period.slice(5, 7)) - 1] ?? "";

// Los premios que se llevan ahora la corona: el mejor del mes y el podio de la última semana publicada.
export default function HonorsBanner({ honors }) {
  if (!honors || (honors.week.length === 0 && honors.month.length === 0)) return null;
  const champion = honors.month.find((entry) => entry.place === 1);
  return (
    <section aria-label="Premios" className="space-y-2.5">
      {champion && (
        <div className="relative flex items-center gap-3 overflow-hidden rounded-card bg-gold/10 p-3 ring-1 ring-inset ring-gold/40">
          <div aria-hidden="true" className="pointer-events-none absolute -left-6 top-0 h-full w-24 bg-amber-300/20 blur-2xl" />
          <span className="relative">
            <Avatar name={champion.name} picture={champion.picture} className="h-12 w-12 text-lg ring-2 ring-amber-300" />
            <Crown aria-hidden="true" className="absolute -top-3 left-1/2 h-5 w-5 -translate-x-1/2 fill-amber-300 text-amber-500" />
          </span>
          <div className="relative min-w-0 flex-1">
            <p className="text-xs font-extrabold text-amber-200">
              {honors.month_title} de {monthName(champion.period)}
            </p>
            <p className="truncate font-display text-lg font-extrabold text-white">{champion.name}</p>
          </div>
          <span className="relative flex shrink-0 items-center gap-1 rounded-full bg-amber-300/15 px-2 py-1 text-xs font-extrabold text-amber-200">
            <Coins aria-hidden="true" className="h-3.5 w-3.5" />+{champion.coins}
          </span>
        </div>
      )}
      {honors.week.length > 0 && (
        <div className="rounded-2xl bg-panel p-3 ring-1 ring-white/5">
          <p className="text-xs font-extrabold text-zinc-400">Premios de la semana</p>
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {honors.week.map((entry) => {
              const medal = MEDAL[entry.place] ?? MEDAL[3];
              return (
                <li key={entry.player_id} className="flex min-w-0 flex-col items-center gap-1 text-center">
                  <Avatar name={entry.name} picture={entry.picture} className={`h-10 w-10 text-sm ring-2 ${medal.ring}`} />
                  <span className="w-full truncate text-xs font-bold text-white">{entry.name.split(" ")[0]}</span>
                  <span className={`flex items-center gap-1 text-xs font-extrabold ${medal.text}`}>
                    {medal.label} · <Coins aria-hidden="true" className="h-3 w-3" />+{entry.coins}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
