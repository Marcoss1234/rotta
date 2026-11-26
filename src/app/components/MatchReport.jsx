import { ArrowLeft, Flame, Pencil, ShieldAlert, Target, Timer, Trophy, TrendingUp } from "lucide-react";

const SKILL_LABEL = { saque: "Saque", recepcion: "Recepción", colocacion: "Colocación", ataque: "Ataque", bloqueo: "Bloqueo", defensa: "Defensa" };
const POSITION_SHORT = { Líbero: "LIB", Colocador: "COL", Receptor: "REC", Central: "CEN", Opuesto: "OPU" };
const firstName = (name) => name.trim().split(/\s+/)[0];

// Color del porcentaje de acierto: verde si va bien, ámbar a medias y rojo si falla mucho.
const tone = (percent) => (percent === null ? "text-zinc-500" : percent >= 65 ? "text-emerald-300" : percent >= 45 ? "text-amber-200" : "text-red-300");
const barTone = (percent) => (percent >= 65 ? "bg-emerald-400" : percent >= 45 ? "bg-amber-300" : "bg-red-400");

function Section({ icon: Icon, title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 font-display text-base font-extrabold text-zinc-100">
        <Icon aria-hidden="true" className="h-4 w-4 text-club-ui" />
        {title}
      </h2>
      {children}
    </section>
  );
}

// Una barra partida en dos: de dónde salieron los puntos.
function SplitBar({ label, total, parts }) {
  return (
    <div className="rounded-2xl bg-panel p-3 ring-1 ring-white/10">
      <p className="flex items-baseline justify-between text-sm font-bold">
        {label}
        <span className="font-display text-xl font-extrabold tabular-nums">{total}</span>
      </p>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-white/5">
        {parts.map((part) => (part.value > 0 ? <span key={part.label} className={part.color} style={{ width: `${(part.value * 100) / Math.max(1, total)}%` }} /> : null))}
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-zinc-300">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-2">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${part.color}`} />
            <span className="flex-1">{part.label}</span>
            <span className="font-bold tabular-nums text-white">{part.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Name({ person }) {
  const short = POSITION_SHORT[person.position];
  return (
    <span className="font-bold">
      {firstName(person.name)}
      {short && <span className="ml-1 text-[10px] text-ember">{short}</span>}
    </span>
  );
}

// El informe al terminar el partido: resultado, cómo llegaron los puntos, cada fundamento y cada jugador.
export default function MatchReport({ game, onClose, onChangeMvp = null }) {
  const report = game.report;
  const won = game.won.us > game.won.them;
  const ourPoints = report.origin.us_by_us + report.origin.us_by_them;
  const theirPoints = report.origin.them_by_us + report.origin.them_by_them;
  const played = report.players.filter((player) => player.good + player.bad > 0);
  const quiet = report.players.filter((player) => player.good + player.bad === 0);

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-void md:left-[17rem]">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-white/10 bg-void/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
        <button type="button" onClick={onClose} aria-label="Ver la pista del partido" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10">
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold">Informe del partido</h1>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 px-3 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4">
        {/* Resultado */}
        <div className={`rounded-2xl p-4 text-center ring-1 ${won ? "bg-voy/10 ring-voy/30" : "bg-danger/10 ring-danger/30"}`}>
          <p className={`font-display text-3xl font-extrabold ${won ? "text-voy-text" : "text-danger-text"}`}>{won ? "Victoria" : "Derrota"}</p>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 font-display text-2xl font-extrabold leading-tight">
            <span>Club</span>
            <span className="tabular-nums">
              {game.won.us} - {game.won.them}
            </span>
            <span>{game.opponent}</span>
          </p>
          <ol className="mt-3 flex flex-wrap justify-center gap-1.5">
            {report.sets.map((set, index) => (
              <li key={index} className={`rounded-lg px-2.5 py-1 text-sm font-extrabold tabular-nums ${set.us > set.them ? "bg-voy/10 text-voy-text" : "bg-danger/10 text-danger-text"}`}>
                <span className="mr-1 text-[10px] font-bold text-white/60">S{index + 1}</span>
                {set.us}-{set.them}
              </li>
            ))}
          </ol>
          {(game.mvp || onChangeMvp) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {game.mvp && (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 text-sm font-bold text-amber-100 ring-1 ring-amber-300/40">
                  <Trophy aria-hidden="true" className="h-4 w-4 text-amber-300" />
                  MVP: {game.mvp.name}
                </p>
              )}
              {onChangeMvp && (
                <button type="button" onClick={onChangeMvp} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-zinc-200 ring-1 ring-white/20 hover:bg-white/5">
                  <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                  {game.mvp ? "Cambiar MVP" : "Elegir MVP"}
                </button>
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-zinc-400">
            Acciones apuntadas: <span className="font-bold text-emerald-300">✓{report.total.good}</span> · <span className="font-bold text-red-300">✗{report.total.bad}</span>
          </p>
        </div>

        {/* De dónde salieron los puntos */}
        <Section icon={Target} title="Cómo llegaron los puntos">
          <div className="grid gap-2 sm:grid-cols-2">
            <SplitBar
              label="Puntos del Club"
              total={ourPoints}
              parts={[
                { label: "Por aciertos nuestros (saque, ataque, bloqueo…)", value: report.origin.us_by_us, color: "bg-emerald-400" },
                { label: "Por fallos del rival", value: report.origin.us_by_them, color: "bg-club text-on-club" },
              ]}
            />
            <SplitBar
              label={`Puntos de ${game.opponent}`}
              total={theirPoints}
              parts={[
                { label: "Por fallos nuestros", value: report.origin.them_by_us, color: "bg-red-400" },
                { label: "Por aciertos del rival", value: report.origin.them_by_them, color: "bg-rival text-snow" },
              ]}
            />
          </div>
        </Section>

        {/* Cada fundamento */}
        {report.skills.length > 0 && (
          <Section icon={TrendingUp} title="Por fundamento">
            <ul className="space-y-2">
              {report.skills.map((item) => (
                <li key={item.skill} className="rounded-2xl bg-panel p-3 ring-1 ring-white/10">
                  <div className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm font-extrabold">{SKILL_LABEL[item.skill]}</span>
                    <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-red-400/30">
                      <span className={`block h-full ${barTone(item.percent)}`} style={{ width: `${item.percent}%` }} />
                    </div>
                    <span className={`w-12 shrink-0 text-right font-display text-lg font-extrabold tabular-nums ${tone(item.percent)}`}>{item.percent}%</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    <span className="font-bold text-emerald-300">✓{item.good}</span> aciertos{item.perfect > 0 && <> (<span className="font-bold text-amber-300">★{item.perfect}</span> {item.perfect === 1 ? "perfecta" : "perfectas"})</>} · <span className="font-bold text-red-300">✗{item.bad}</span> fallos
                  </p>
                  {(item.best || item.worst) && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <p className="rounded-lg bg-emerald-400/10 px-2 py-1.5 text-emerald-100">
                        <span className="block text-[10px] font-bold text-emerald-300/80">Más aciertos</span>
                        {item.best ? (
                          <>
                            <Name person={item.best} /> · ✓{item.best.count}
                          </>
                        ) : (
                          "—"
                        )}
                      </p>
                      <p className="rounded-lg bg-red-400/10 px-2 py-1.5 text-red-100">
                        <span className="block text-[10px] font-bold text-red-300/80">Más fallos</span>
                        {item.worst ? (
                          <>
                            <Name person={item.worst} /> · ✗{item.worst.count}
                          </>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Cada jugador, del que mejor balance tiene al que peor */}
        <Section icon={Flame} title="Jugadores">
          {played.length === 0 ? (
            <p className="rounded-2xl bg-panel p-3 text-sm text-zinc-400 ring-1 ring-white/10">No se apuntaron aciertos ni fallos de jugadores.</p>
          ) : (
            <ol className="space-y-2">
              {played.map((player, index) => (
                <li key={player.player_id} className="rounded-2xl bg-panel p-3 ring-1 ring-white/10">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold ${index === 0 ? "bg-amber-300 text-void" : "bg-white/10 text-white"}`}>{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block">
                        <Name person={player} />
                        {player.number !== null && player.number !== undefined && <span className="ml-1.5 text-xs text-zinc-500">#{player.number}</span>}
                      </span>
                      <span className="block text-xs text-zinc-400">
                        <span className="font-bold text-emerald-300">✓{player.good}</span> · <span className="font-bold text-red-300">✗{player.bad}</span>
                        {player.perfect > 0 && <> · <span className="font-bold text-amber-300">★{player.perfect}</span> {player.perfect === 1 ? "perfecta" : "perfectas"}</>}
                        {player.points > 0 && <> · {player.points} {player.points === 1 ? "punto ganado" : "puntos ganados"}</>}
                        {player.errors > 0 && <> · {player.errors} {player.errors === 1 ? "punto regalado" : "puntos regalados"}</>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block font-display text-xl font-extrabold tabular-nums ${player.balance > 0 ? "text-emerald-300" : player.balance < 0 ? "text-red-300" : "text-zinc-300"}`}>
                        {player.balance > 0 ? `+${player.balance}` : player.balance}
                      </span>
                      <span className={`block text-[11px] font-bold tabular-nums ${tone(player.percent)}`}>{player.percent}% acierto</span>
                    </span>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {player.skills.map((item) => (
                      <li key={item.skill} className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold text-zinc-200">
                        {SKILL_LABEL[item.skill]} {item.good > 0 && <span className="text-emerald-300">✓{item.good}</span>} {item.perfect > 0 && <span className="text-amber-300">★{item.perfect}</span>} {item.bad > 0 && <span className="text-red-300">✗{item.bad}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
          {quiet.length > 0 && <p className="px-1 text-xs text-zinc-500">Sin acciones apuntadas: {quiet.map((player) => firstName(player.name)).join(", ")}.</p>}
        </Section>

        {/* Cada set */}
        {report.sets.length > 0 && (
          <Section icon={ShieldAlert} title="Set a set">
            <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-[10px] text-zinc-400">
                  <tr>
                    <th scope="col" className="px-3 py-2">Set</th>
                    <th scope="col" className="px-2 py-2">Marcador</th>
                    <th scope="col" className="px-2 py-2 text-center">Aciertos</th>
                    <th scope="col" className="px-2 py-2 text-center">Fallos</th>
                    <th scope="col" className="px-2 py-2 text-center">Pts por fallo nuestro</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sets.map((set, index) => (
                    <tr key={index} className="border-t border-white/5 bg-panel">
                      <td className="px-3 py-2 font-bold">{index + 1}</td>
                      <td className={`px-2 py-2 font-extrabold tabular-nums ${set.us > set.them ? "text-voy-text" : "text-danger-text"}`}>
                        {set.us}-{set.them}
                      </td>
                      <td className="px-2 py-2 text-center font-bold tabular-nums text-emerald-300">{set.good ?? "—"}</td>
                      <td className="px-2 py-2 text-center font-bold tabular-nums text-red-300">{set.bad ?? "—"}</td>
                      <td className="px-2 py-2 text-center font-bold tabular-nums text-zinc-200">{set.them_by_us ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Rachas y otros datos */}
        <Section icon={Timer} title="Otros datos">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["Mejor racha Club", `${report.runs.us} seguidos`],
              [`Mejor racha ${game.opponent}`, `${report.runs.them} seguidos`],
              ["Mayor ventaja Club", `+${report.max_lead.us}`],
              [`Mayor ventaja ${game.opponent}`, `+${report.max_lead.them}`],
              ["Tiempos muertos Club", report.timeouts.us],
              [`Tiempos muertos ${game.opponent}`, report.timeouts.them],
              ["Aciertos del equipo (sin jugador)", report.team.good],
              ["Fallos del equipo (sin jugador)", report.team.bad],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-panel p-3 ring-1 ring-white/10">
                <dt className="text-[11px] font-bold leading-tight text-zinc-400">{label}</dt>
                <dd className="font-display text-xl font-extrabold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  );
}
