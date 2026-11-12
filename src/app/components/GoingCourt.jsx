import { CourtDrawing } from "@/app/components/CourtBoard.jsx";

// Sitios en la pista para quien va, del centro hacia fuera y alternando los dos campos,
// para que con poca gente ya se vea repartida. Seis por campo: tres delante y tres detrás.
export const COURT_SPOTS = (() => {
  const rows = [
    { x: 0.37, y: 0.5 }, { x: 0.14, y: 0.5 },
    { x: 0.37, y: 0.2 }, { x: 0.37, y: 0.8 },
    { x: 0.14, y: 0.2 }, { x: 0.14, y: 0.8 },
  ];
  return rows.flatMap((spot) => [spot, { x: 1 - spot.x, y: spot.y }]);
})();

export const initialsOf = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");

const POSITION_SHORT = { Líbero: "LIB", Colocador: "COL", Receptor: "REC", Central: "CEN", Opuesto: "OPU" };

function CourtPlayer({ person, spot, mine }) {
  const short = POSITION_SHORT[person.position];
  return (
    <span
      title={person.name}
      style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, width: "22%", fontSize: "3.2cqw" }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
    >
      <span className="relative block w-[46%]">
        <span
          style={{ fontSize: "3.6cqw" }}
          className={`flex aspect-square items-center justify-center overflow-hidden rounded-full border-2 bg-zinc-950 font-black text-white shadow-[0_2px_6px_rgba(0,0,0,0.5)] ${mine ? "border-ember" : "border-white"}`}
        >
          {person.picture ? (
            <img src={person.picture} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            initialsOf(person.name)
          )}
        </span>
        {person.number !== null && person.number !== undefined && (
          <span style={{ fontSize: "3cqw", minWidth: "4.4cqw", padding: "0.3cqw 0.6cqw" }} className="absolute -bottom-[6%] -right-[24%] rounded-full bg-tnt text-center font-black leading-none text-onbrand">
            {person.number}
          </span>
        )}
      </span>
      <span className="mt-[0.5cqw] flex max-w-full gap-[0.8cqw] rounded bg-black/85 px-[0.8cqw] font-bold leading-[1.35] text-white">
        <span className="min-w-0 truncate">{person.name.trim().split(/\s+/)[0]}</span>
        {short && <span className="shrink-0 text-ember">{short}</span>}
      </span>
    </span>
  );
}

const SUMMARY_POSITIONS = ["Colocador", "Receptor", "Opuesto", "Central", "Líbero"];

// De un vistazo, cuántos hay de cada posición: si falta un colocador, se ve.
function PositionCounts({ people }) {
  return (
    <ul aria-label="Quien va, por posición" className="grid grid-cols-5 gap-1">
      {SUMMARY_POSITIONS.map((position) => {
        const count = people.filter((person) => person.position === position).length;
        return (
          <li key={position} className={`rounded-md bg-void/60 py-1 text-center ${count === 0 ? "opacity-50" : ""}`}>
            <span className={`block font-display text-lg font-black italic leading-none tabular-nums ${count > 0 ? "text-ember" : "text-zinc-400"}`}>{count}</span>
            <span aria-hidden="true" className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-zinc-300">{POSITION_SHORT[position]}</span>
            <span className="sr-only">{position}</span>
          </li>
        );
      })}
    </ul>
  );
}

// La pista de este entrenamiento o partido: quien dice que va aparece en ella, distinta de la de Plantilla.
export default function GoingCourt({ teamId, people, currentUserId }) {
  const shown = people.slice(0, COURT_SPOTS.length);
  const extra = people.length - shown.length;
  const label = people.length === 0
    ? "Pista vacía: todavía nadie ha dicho que va"
    : `En la pista, ${people.length === 1 ? "va" : "van"}: ${people.map((person) => (person.position ? `${person.name}, ${person.position}` : person.name)).join("; ")}`;

  return (
    <div className="mx-auto w-full max-w-xl space-y-1.5">
      <div
        role="img"
        aria-label={label}
        className="force-dark relative w-full overflow-hidden rounded-lg ring-1 ring-white/15 [container-type:inline-size]"
        style={{ aspectRatio: "190 / 100" }}
        data-testid="mini-court"
      >
        <CourtDrawing beach={teamId === "playa"} horizontal showZones={false} />
        {people.length === 0 && (
          <span className="absolute inset-x-0 bottom-[8%] text-center font-semibold text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]" style={{ fontSize: "4.5cqw" }}>
            Aún no va nadie
          </span>
        )}
        {shown.map((person, index) => (
          <CourtPlayer key={person.id} person={person} spot={COURT_SPOTS[index]} mine={person.id === currentUserId} />
        ))}
        {extra > 0 && (
          <span className="absolute bottom-[4%] right-[3%] rounded-full bg-tnt px-[2cqw] font-bold text-onbrand" style={{ fontSize: "4cqw" }}>
            +{extra}
          </span>
        )}
      </div>
      {people.length > 0 && <PositionCounts people={people} />}
    </div>
  );
}
