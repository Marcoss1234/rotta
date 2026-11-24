import { useEffect, useState } from "react";
import { Check, Star } from "lucide-react";
import { getTrainingStars, saveTrainingStars } from "@/app/api.js";
import Avatar from "@/app/components/Avatar.jsx";
import { Notice } from "@/app/ui/index.js";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Siempre el día del entreno, para que se sepa de cuál son: "del jueves 12 de noviembre".
function dayLabel(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `del ${WEEKDAYS[date.getDay()]} ${day} de ${MONTHS[month - 1]}`;
}

// Destacados del entreno: el entrenador elige a los 3 que mejor lo han hecho y cada uno gana coins.
// Los demás ven quién ha sido destacado.
export default function TrainingStars({ teamId, onAccessLost }) {
  const [data, setData] = useState(null);
  const [chosen, setChosen] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    getTrainingStars(teamId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setChosen(result.stars.map((person) => person.id));
      })
      .catch((requestError) => {
        if (requestError.status === 401) onAccessLost();
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, onAccessLost]);

  if (!data?.date) return null;

  if (!data.can_star) {
    if (data.stars.length === 0) {
      // Aún sin elegir: se recuerda que el entrenador escoge a los mejores (y lo que ganan).
      return (
        <section aria-label="Destacados del entreno" className="flex items-center gap-3 rounded-2xl bg-panel p-3 ring-1 ring-amber-300/20">
          <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <Star key={index} className="h-5 w-5 fill-amber-300/25 text-amber-300/60" />
            ))}
          </span>
          <p className="min-w-0 flex-1 text-sm text-zinc-300">
            <span className="block text-[11px] font-extrabold text-amber-200">Los 3 mejores del entreno {dayLabel(data.date)}</span>
            El entrenador aún no los ha elegido. Cada uno gana <span className="font-bold text-amber-200">+{data.coins} coins</span>.
          </p>
        </section>
      );
    }
    return (
      <section aria-label="Destacados del entreno" className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400/15 to-panel p-3 ring-1 ring-amber-300/30">
        <Star aria-hidden="true" className="h-6 w-6 shrink-0 fill-amber-300 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold text-amber-200">Destacados del entreno {dayLabel(data.date)}</p>
          <p className="truncate font-bold">{data.stars.map((person) => person.name.split(" ")[0]).join(", ")}</p>
        </div>
        <div className="flex -space-x-2">
          {data.stars.map((person) => (
            <Avatar key={person.id} name={person.name} picture={person.picture} className="h-8 w-8 text-[10px] ring-2 ring-amber-300" />
          ))}
        </div>
      </section>
    );
  }

  const toggle = (id) => {
    setSaved(false);
    setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.length < data.max ? [...current, id] : current));
  };
  const changed = JSON.stringify([...chosen].sort()) !== JSON.stringify(data.stars.map((person) => person.id).sort());

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await saveTrainingStars(teamId, data.date, chosen);
      setData(result);
      setSaved(true);
    } catch (requestError) {
      if (requestError.status === 401) onAccessLost();
      else setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="stars-title" className="space-y-3 rounded-2xl bg-gradient-to-br from-amber-400/15 via-panel to-panel p-4 ring-1 ring-amber-300/30">
      <div className="flex items-start gap-3">
        <Star aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 fill-amber-300 text-amber-300" />
        <div className="min-w-0 flex-1">
          <h2 id="stars-title" className="font-display text-lg font-extrabold leading-tight">Destacados del entreno {dayLabel(data.date)}</h2>
          <p className="text-sm text-zinc-300">
            Elige a los {data.max} que mejor lo han hecho: cada uno gana +{data.coins} Club Coins.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-300/15 px-2 py-0.5 text-xs font-extrabold tabular-nums text-amber-200">
          {chosen.length}/{data.max}
        </span>
      </div>
      {data.going.length === 0 ? (
        <p className="text-sm text-zinc-400">Nadie dijo que iba a este entreno.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {data.going.map((person) => {
            const picked = chosen.includes(person.id);
            const full = !picked && chosen.length >= data.max;
            return (
              <li key={person.id}>
                <button
                  type="button"
                  aria-pressed={picked}
                  disabled={full}
                  onClick={() => toggle(person.id)}
                  className={`flex min-h-12 w-full items-center gap-2 rounded-xl px-2 text-left text-sm font-semibold disabled:opacity-40 ${
                    picked ? "bg-amber-400/20 text-white ring-2 ring-amber-300" : "bg-white/[0.04] text-zinc-200 ring-1 ring-white/10"
                  }`}
                >
                  <span className="relative shrink-0">
                    <Avatar name={person.name} picture={person.picture} className="h-8 w-8 text-[10px]" />
                    {picked && <Star aria-hidden="true" className="absolute -right-1 -top-1 h-4 w-4 fill-amber-300 text-amber-300" />}
                  </span>
                  <span className="min-w-0 truncate">{person.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <Notice tone="error" inline>{error}</Notice>}
      {(changed || saved) && data.going.length > 0 && (
        <button
          type="button"
          disabled={busy || !changed}
          onClick={save}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 font-display text-base font-extrabold text-void disabled:opacity-70"
        >
          {!changed && saved ? (
            <>
              <Check aria-hidden="true" className="h-5 w-5" />
              Guardado
            </>
          ) : busy ? (
            "Guardando…"
          ) : (
            `Dar +${data.coins} a ${chosen.length === 1 ? "1 jugador" : `${chosen.length} jugadores`}`
          )}
        </button>
      )}
    </section>
  );
}
