import { Coins } from "lucide-react";

// Monedas que saltan hacia fuera desde el centro (ángulo en grados y distancia en px).
const SPARKS = [
  [-150, 46],
  [-115, 58],
  [-80, 52],
  [-45, 60],
  [-20, 44],
  [-165, 34],
  [-60, 36],
];

// "+5 coins" que sube y se desvanece encima de un botón; con números negativos sale en rojo y cae.
// `burst.key` cambia en cada respuesta para que la animación se repita.
export default function CoinBurst({ burst }) {
  if (!burst?.amount) return null;
  const gain = burst.amount > 0;
  return (
    <span key={burst.key} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      {gain &&
        SPARKS.map(([angle, distance], index) => (
          <span
            key={index}
            className="coin-spark absolute h-3 w-3 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_8px_rgba(245,197,66,0.8)]"
            style={{
              "--dx": `${Math.cos((angle * Math.PI) / 180) * distance}px`,
              "--dy": `${Math.sin((angle * Math.PI) / 180) * distance}px`,
              animationDelay: `${index * 25}ms`,
            }}
          />
        ))}
      <span
        className={`${gain ? "coin-burst-up" : "coin-burst-down"} flex items-center gap-1 rounded-full px-3 py-1 font-display text-lg font-extrabold shadow-lg ${
          gain ? "bg-gradient-to-r from-amber-300 to-amber-500 text-amber-950 shadow-amber-500/50" : "bg-red-500/90 text-white shadow-red-900/50"
        }`}
      >
        <Coins className="h-4 w-4" />
        {gain ? "+" : "−"}
        {Math.abs(burst.amount)} coins
      </span>
    </span>
  );
}
