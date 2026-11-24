import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { joinHelp, leaveHelp } from "@/app/api.js";
import CoinBurst from "@/app/components/CoinBurst.jsx";
import GoingCourt from "@/app/components/GoingCourt.jsx";
import { Notice } from "@/app/ui/index.js";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function dayLabel(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${WEEKDAYS[date.getDay()]} ${day} ${MONTHS[month - 1]}`;
}

// Petición de ayuda dentro del chat: la pista con todos los que van (se actualiza con el chat) y el botón "Voy".
export default function HelpCard({ help, mine, onChange, onAccessLost }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [burst, setBurst] = useState(null);

  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      const card = help.joined ? await leaveHelp(help.id) : await joinHelp(help.id);
      if (card.coins_change) setBurst({ amount: card.coins_change, status: "button", key: Date.now() });
      onChange(card);
    } catch (requestError) {
      if (requestError.status === 401) onAccessLost?.();
      else setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const count = help.going.length;
  return (
    <div className={`mt-2 space-y-2 rounded-xl p-2 ${mine ? "bg-black/20" : "bg-void/60"}`}>
      <p className="flex items-center gap-1.5 text-xs font-extrabold">
        <LifeBuoy aria-hidden="true" className="h-4 w-4 text-sky-300" />
        <span className="min-w-0 flex-1 truncate">
          {help.team_name.replace(/^Club /, "")} · {dayLabel(help.date)}
          {help.start ? ` · ${help.start}` : ""}
        </span>
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 tabular-nums">{count === 1 ? "Va 1" : `Van ${count}`}</span>
      </p>
      <GoingCourt teamId={help.team_id} people={help.going} currentUserId={null} />
      {help.past ? (
        <p className="text-center text-xs font-semibold text-zinc-300">Este entreno ya pasó.</p>
      ) : help.own_team ? (
        <p className="text-center text-xs font-semibold text-zinc-300">Es tu equipo: di si vas desde el inicio.</p>
      ) : (
        <span className="relative block">
          <button
            type="button"
            disabled={busy}
            aria-pressed={help.joined}
            onClick={toggle}
            className={`min-h-11 w-full rounded-full font-display text-base font-extrabold disabled:opacity-60 ${
              help.joined ? "border border-white/30 text-white hover:bg-white/10" : "bg-gradient-to-r from-sky-500 to-sky-600 text-snow shadow-[0_4px_14px_rgba(14,165,233,0.35)]"
            }`}
          >
            {help.joined ? "Ya no puedo ir" : `Voy · +${help.coins} coins`}
          </button>
          {burst && <CoinBurst burst={burst} />}
        </span>
      )}
      {help.joined && !help.past && <p className="text-center text-xs font-semibold text-sky-200">¡Apuntado! Sales en su lista de ese día.</p>}
      {error && <Notice tone="error" inline size="sm">{error}</Notice>}
    </div>
  );
}
