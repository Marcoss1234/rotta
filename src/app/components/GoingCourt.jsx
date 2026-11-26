import { positionTone } from "@/app/components/RankingVisuals.jsx";
import { isBeachTeam } from "@/app/teams.js";

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

// La pista de Rotta para quien va (Premium deportivo): no es la de Plantilla ni la pizarra. Suelo, líneas y chapas
// con el carácter de cada identidad (court-* en index.css): Lima líneas nítidas y chapas casi cuadradas, Naranja
// suelo cálido y aro grueso, Tinta líneas finas como un acta. En vóley playa, arena y sin líneas de ataque.
// Medidas de una pista de 18 × 9 m: la red en el centro y la línea de ataque a 3 m.
function MiniCourt({ beach }) {
  const attack = (178 * 3) / 18;
  return (
    <svg viewBox="0 0 190 100" aria-hidden="true" className="absolute inset-0 h-full w-full">
      <rect className="court-floor" x="6" y="6" width="178" height="88" rx="1.5" />
      {!beach && <rect className="court-front" x={95 - attack} y="6" width={attack * 2} height="88" />}
      <rect className="court-line" x="6" y="6" width="178" height="88" rx="1.5" />
      {!beach && (
        <g className="court-line">
          <line x1={95 - attack} y1="6" x2={95 - attack} y2="94" />
          <line x1={95 + attack} y1="6" x2={95 + attack} y2="94" />
        </g>
      )}
      <line className="court-net" x1="95" y1="2" x2="95" y2="98" />
      <circle className="court-post" cx="95" cy="2" r="1.6" />
      <circle className="court-post" cx="95" cy="98" r="1.6" />
    </svg>
  );
}

function CourtPlayer({ person, spot, mine }) {
  const short = POSITION_SHORT[person.position];
  return (
    <span
      title={person.name}
      style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, width: "22%", fontSize: "3.4cqw" }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      data-mine={mine || undefined}
    >
      <span className="relative block w-[54%]">
        <span style={{ fontSize: "4.2cqw" }} className={`court-chip flex aspect-square items-center justify-center overflow-hidden font-extrabold text-ink ${mine ? "court-chip-mine" : ""}`}>
          {person.picture ? (
            <img src={person.picture} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            initialsOf(person.name)
          )}
        </span>
        {person.number !== null && person.number !== undefined && (
          <span style={{ fontSize: "2.8cqw", minWidth: "4.4cqw", padding: "0.3cqw 0.6cqw" }} className="court-number absolute -bottom-[8%] -right-[26%] text-center font-extrabold leading-none">
            {person.number}
          </span>
        )}
      </span>
      <span className="court-name mt-[0.8cqw] flex max-w-full gap-[0.8cqw] px-[0.9cqw] font-semibold leading-[1.45]">
        <span className="min-w-0 truncate">{person.name.trim().split(/\s+/)[0]}</span>
        {short && <span className={`shrink-0 font-bold ${positionTone(person.position).label}`}>{short}</span>}
      </span>
    </span>
  );
}

const SUMMARY_POSITIONS = ["Colocador", "Receptor", "Opuesto", "Central", "Líbero"];

// De un vistazo, cuántos hay de cada posición: si falta un colocador, se ve. Con el punto del color de su puesto.
function PositionCounts({ people }) {
  return (
    <ul aria-label="Quien va, por posición" className="grid grid-cols-5 gap-1">
      {SUMMARY_POSITIONS.map((position) => {
        const count = people.filter((person) => person.position === position).length;
        return (
          <li key={position} className={`flex flex-col items-center gap-0.5 rounded-inner py-1.5 ${count === 0 ? "opacity-45" : "bg-ink/[0.06]"}`}>
            <span className="font-score text-xl leading-none text-ink">{count}</span>
            <span aria-hidden="true" className="flex items-center gap-1 text-[11px] font-semibold text-ink-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${positionTone(position).dot}`} />
              {POSITION_SHORT[position]}
            </span>
            <span className="sr-only">{position}</span>
          </li>
        );
      })}
    </ul>
  );
}

// La pista de este entrenamiento o partido: quien dice que va aparece en ella. Solo enseña: no se arrastra ni se
// coloca nada (para eso está la pizarra). Siempre en oscuro, también dentro de una tarjeta clara (HelpCard).
export default function GoingCourt({ teamId, people, currentUserId }) {
  const shown = people.slice(0, COURT_SPOTS.length);
  const extra = people.length - shown.length;
  const beach = isBeachTeam(teamId);
  const label = people.length === 0
    ? "Pista vacía: todavía nadie ha dicho que va"
    : `En la pista, ${people.length === 1 ? "va" : "van"}: ${people.map((person) => (person.position ? `${person.name}, ${person.position}` : person.name)).join("; ")}`;

  return (
    <div className="force-dark mx-auto w-full max-w-2xl space-y-2">
      <div
        role="img"
        aria-label={label}
        className={`going-court relative w-full overflow-hidden rounded-inner [container-type:inline-size] ${beach ? "going-court-beach" : ""}`}
        style={{ aspectRatio: "190 / 100" }}
        data-testid="mini-court"
      >
        <MiniCourt beach={beach} />
        {people.length === 0 && (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-[6cqw] text-center font-semibold text-ink-muted" style={{ fontSize: "4.2cqw" }}>
            Aún no va nadie
          </span>
        )}
        {shown.map((person, index) => (
          <CourtPlayer key={person.id} person={person} spot={COURT_SPOTS[index]} mine={person.id === currentUserId} />
        ))}
        {extra > 0 && (
          <span className="court-number absolute bottom-[5%] right-[3%] px-[2cqw] font-bold" style={{ fontSize: "3.8cqw" }}>
            +{extra}
          </span>
        )}
      </div>
      {people.length > 0 && <PositionCounts people={people} />}
    </div>
  );
}
