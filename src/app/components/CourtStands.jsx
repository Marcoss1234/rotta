import Avatar from "@/app/components/Avatar.jsx";

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

// Las gradas van debajo de la pista (también en el ordenador, donde la pista va en su columna), y cada fila
// se llena desde el centro.
export default function CourtStands({ family }) {
  // Sin familias, solo una línea: no hace falta enseñar asientos vacíos.
  if (family.length === 0) {
    return (
      <section aria-labelledby="stands-title" className="force-dark mx-auto mt-3 flex max-w-sm items-baseline justify-between gap-3 rounded-card bg-raised px-3 py-2.5 text-ink" data-testid="court-stands">
        <h3 id="stands-title" className="font-display text-sm font-extrabold">Gradas</h3>
        <p className="text-right text-xs text-ink-muted">Todavía no hay familias en este equipo.</p>
      </section>
    );
  }
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
    <section aria-labelledby="stands-title" className="force-dark mx-auto mt-3 max-w-sm rounded-card bg-raised p-3 text-ink" data-testid="court-stands">
      <h3 id="stands-title" className="flex items-baseline justify-between font-display text-sm font-extrabold text-ink">
        Gradas <span className="font-body text-xs font-semibold text-ink-muted">{family.length}</span>
      </h3>
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
