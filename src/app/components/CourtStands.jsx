import Avatar from "@/app/components/Avatar.jsx";

const SIDE_ROWS = 9;
const SIDE_COLUMNS = 2;
const PHONE_COLUMNS = 4;
const PHONE_MIN_ROWS = 2;

// Del centro hacia fuera: 4, 5, 3, 6, 2… Así la gente se sienta primero en la zona central.
function centerOut(count) {
  const middle = Math.floor((count - 1) / 2);
  const order = [middle];
  for (let step = 1; order.length < count; step += 1) {
    if (middle + step < count) order.push(middle + step);
    if (middle - step >= 0) order.push(middle - step);
  }
  return order;
}

// Las chapas son solo para mirar: no se mueven.
function Seat({ person }) {
  const seatClass =
    "flex min-h-[4.25rem] items-center justify-center rounded-t-2xl rounded-b-md border-b-4 border-sky-950 bg-gradient-to-b from-sky-800/55 to-sky-900/40";

  if (!person) return <li aria-hidden="true" className={`${seatClass} opacity-50`} />;
  return (
    <li className={seatClass}>
      <span className="flex w-14 flex-col items-center gap-0.5">
        <Avatar name={person.name} picture={person.picture} className="h-10 w-10 border-2 border-sky-300 text-xs shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
        <span className="max-w-full truncate rounded bg-black/80 px-1 text-[11px] font-semibold leading-4 text-white" title={person.name}>
          {person.name.trim().split(/\s+/)[0]}
        </span>
      </span>
    </li>
  );
}

// En pantallas grandes, una grada a cada lado: primero se llena la fila junto a la pista, desde el centro.
export function CourtSideStands({ people, side, label }) {
  const rows = Math.max(SIDE_ROWS, Math.ceil(people.length / SIDE_COLUMNS));
  const frontColumn = side === "left" ? 1 : 0;
  const backColumn = 1 - frontColumn;
  const seats = Array(rows * SIDE_COLUMNS).fill(null);
  const order = centerOut(rows);
  [frontColumn, backColumn]
    .flatMap((column) => order.map((row) => row * SIDE_COLUMNS + column))
    .forEach((seat, index) => {
      seats[seat] = people[index] ?? null;
    });

  return (
    <aside aria-label={label} className="hidden min-h-0 flex-col gap-1 lg:flex" data-testid={`court-stands-${side}`}>
      <p aria-hidden="true" className="text-center text-xs font-bold text-zinc-300">Gradas</p>
      <ul
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
        className="grid min-h-0 flex-1 grid-cols-2 gap-1 rounded-lg bg-void/70 p-1"
      >
        {seats.map((person, index) => <Seat key={person?.id ?? `libre-${index}`} person={person} />)}
      </ul>
    </aside>
  );
}

// En el móvil no caben a los lados: van debajo, y cada fila se llena desde el centro.
export default function CourtStands({ family }) {
  const rowCount = Math.max(PHONE_MIN_ROWS, Math.ceil(family.length / PHONE_COLUMNS));
  const order = centerOut(PHONE_COLUMNS);
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
    const row = Array(PHONE_COLUMNS).fill(null);
    family.slice(rowIndex * PHONE_COLUMNS, (rowIndex + 1) * PHONE_COLUMNS).forEach((person, index) => {
      row[order[index]] = person;
    });
    return row;
  });

  return (
    <section aria-labelledby="stands-title" className="mx-auto mt-3 max-w-sm rounded-lg border border-white/15 p-3 lg:hidden" data-testid="court-stands">
      <h3 id="stands-title" className="font-display text-sm font-extrabold uppercase italic tracking-wide text-zinc-200">Gradas · {family.length}</h3>
      {family.length === 0 && <p className="mt-1 text-sm text-zinc-400">Todavía no hay familias en este equipo.</p>}
      <div className="mt-2 space-y-1 rounded-lg bg-void/70 p-1">
        {rows.map((row, rowIndex) => (
          <ul key={rowIndex} className="grid grid-cols-4 gap-1">
            {row.map((person, index) => <Seat key={person?.id ?? `libre-${index}`} person={person} />)}
          </ul>
        ))}
      </div>
    </section>
  );
}
