import { useEffect, useRef, useState } from "react";
import CourtStands, { CourtSideStands } from "@/app/components/CourtStands.jsx";
import { POSITIONS } from "@/app/roles.js";

const DRAG_THRESHOLD = 4;
// Con el dedo la chapa sube un poco para que se vea; con ratón va justo debajo del puntero.
const TOUCH_LIFT = 56;
const KEYBOARD_STEP = 0.02;
const EDGE_SCROLL_TOP = 60;
const EDGE_SCROLL_BOTTOM = 40;
const EDGE_SCROLL_STEP = 8;
const clamp = (value) => Math.min(0.97, Math.max(0.03, value));

const shortName = (name) => name.trim().split(/\s+/)[0];
const initials = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");

export function CourtDrawing({ beach, horizontal = false, showZones = true }) {
  const floor = beach ? "#e8cf95" : "#c9793f";
  const frontZone = beach ? "#e8cf95" : "#d98b4f";
  const line = beach ? "#1d4ed8" : "#ffffff";

  return (
    <svg viewBox={horizontal ? "0 0 190 100" : "0 0 100 190"} aria-hidden="true" className="absolute inset-0 h-full w-full">
      <g transform={horizontal ? "translate(0 100) rotate(-90)" : undefined}>
      <rect x="0" y="0" width="100" height="190" fill={beach ? "#d8bb78" : "#1f2937"} />
      <rect x="5" y="5" width="90" height="180" fill={floor} />
      <rect x="5" y="65" width="90" height="60" fill={frontZone} />
      <rect x="5" y="5" width="90" height="180" fill="none" stroke={line} strokeWidth="0.9" />
      {!beach && (
        <g stroke={line} strokeWidth="0.6">
          <line x1="5" y1="65" x2="95" y2="65" />
          <line x1="5" y1="125" x2="95" y2="125" />
        </g>
      )}

      {!beach && showZones && (
        <g fontSize="7" fontWeight="700" textAnchor="middle" fill="rgba(255,255,255,0.32)">
          <text x="20" y="38">1</text><text x="50" y="38">6</text><text x="80" y="38">5</text>
          <text x="20" y="84">2</text><text x="50" y="84">3</text><text x="80" y="84">4</text>
          <text x="20" y="112">4</text><text x="50" y="112">3</text><text x="80" y="112">2</text>
          <text x="20" y="158">5</text><text x="50" y="158">6</text><text x="80" y="158">1</text>
        </g>
      )}

      <rect x="2" y="93.4" width="96" height="3.2" fill="rgba(10,10,12,0.6)" stroke="#ffffff" strokeWidth="0.5" />
      <circle cx="2" cy="95" r="1.4" fill="#ffffff" />
      <circle cx="98" cy="95" r="1.4" fill="#ffffff" />
      </g>
    </svg>
  );
}

function Badge({ player, lifted = false }) {
  const isLibero = player.position === "Líbero";
  // El dorsal va en la chapa; debajo, el nombre y el puesto en pequeño para que no tape la pista.
  const role = player.position && player.position !== "Sin definir" ? player.position : "";
  return (
    <span className="flex w-[4.5rem] select-none flex-col items-center gap-0.5">
      <span
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] text-sm font-black shadow-[0_3px_8px_rgba(0,0,0,0.55)] motion-safe:transition-transform ${
          isLibero ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white bg-zinc-950 text-white"
        } ${lifted ? "scale-110" : ""}`}
      >
        {player.picture ? (
          <>
            <img
              src={player.picture}
              alt=""
              draggable={false}
              referrerPolicy="no-referrer"
              className="pointer-events-none h-full w-full rounded-full object-cover"
            />
            {player.number !== null && (
              <span className="absolute -bottom-1 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-950 px-1 text-[10px] font-black text-white ring-2 ring-white">
                {player.number}
              </span>
            )}
          </>
        ) : (
          player.number ?? initials(player.name)
        )}
      </span>
      <span className="flex max-w-full flex-col items-center rounded-md bg-black/75 px-1.5 py-px text-center leading-none backdrop-blur-[2px]">
        <span className="max-w-full truncate text-[11px] font-semibold leading-4 text-white">{shortName(player.name)}</span>
        {role && <span className="max-w-full truncate pb-0.5 text-[9px] font-medium leading-3 tracking-wide text-zinc-300">{role}</span>}
      </span>
    </span>
  );
}

function Token({ player, canEdit, hidden, onPointerDown, onPointerUp, onKeyDown }) {
  const label = `${player.name}${player.number !== null ? `, dorsal ${player.number}` : ""}, ${player.position}`;
  const dimmed = hidden ? "opacity-30" : "";

  if (!canEdit) {
    return <div role="img" aria-label={label} title={player.name}><Badge player={player} /></div>;
  }
  return (
    <button
      type="button"
      data-testid="court-token"
      data-player={player.name}
      aria-label={`Mover a ${label}`}
      aria-describedby="court-help"
      title={player.name}
      onPointerDown={(event) => onPointerDown(event, player)}
      onPointerUp={(event) => onPointerUp(event, player)}
      onKeyDown={(event) => onKeyDown(event, player)}
      // touch-none y sin menú de "guardar imagen": en el móvil, mantener pulsada la chapa no debe abrir nada.
      className={`cursor-grab touch-none select-none rounded-lg [-webkit-touch-callout:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:cursor-grabbing ${dimmed}`}
    >
      <Badge player={player} />
    </button>
  );
}

// Un toque rápido en una chapa abre esta ventanita para cambiar el puesto sin salir de la pista.
function PositionPicker({ player, onPick, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="position-picker-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Al tocar fuera de la ventanita, se cierra.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xs rounded-2xl border border-white/15 bg-panel p-0 font-body text-white backdrop:bg-black/60"
    >
      <div className="p-4">
        <p id="position-picker-title" className="font-display text-lg font-bold">
          {player.name}
          {player.number !== null && <span className="ml-1.5 text-zinc-400">#{player.number}</span>}
        </p>
        <p className="text-sm text-zinc-400">Elige su puesto</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {POSITIONS.map((position) => {
            const current = position === player.position;
            return (
              <button
                key={position}
                type="button"
                aria-pressed={current}
                onClick={() => onPick(position)}
                className={`min-h-11 rounded-lg border text-sm font-semibold ${
                  current ? "border-tnt bg-tnt text-onbrand" : "border-white/20 text-zinc-100 hover:bg-white/5"
                }`}
              >
                {position}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onClose} className="mt-3 min-h-11 w-full rounded-lg text-sm font-semibold text-zinc-300 hover:bg-white/5">
          Cancelar
        </button>
      </div>
    </dialog>
  );
}

export default function CourtBoard({ players, family = [], canEdit, beach, onMove, onChangePosition }) {
  const courtRef = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const [picking, setPicking] = useState(null);
  const draggingId = drag?.player.id;

  useEffect(() => {
    if (!draggingId) return undefined;

    // Mientras se arrastra no se selecciona texto de la página.
    const body = document.body.style;
    body.userSelect = "none";
    body.webkitUserSelect = "none";

    // En pantallas bajas no cabe toda la cancha: con el dedo cerca del borde, la página se desplaza
    // sola aunque no se mueva. Abajo se cuenta el menú, que ocupa parte de la pantalla.
    let edgeDirection = 0;
    // En el móvil lo que se desplaza es el contenido; en el ordenador, la ventana.
    const content = courtRef.current?.closest("main");
    const scroller = content && content.scrollHeight > content.clientHeight ? content : window;
    const timer = window.setInterval(() => {
      if (edgeDirection !== 0) scroller.scrollBy(0, edgeDirection * EDGE_SCROLL_STEP);
    }, 16);

    const bottomLimit = () => {
      const menu = document.querySelector("[data-bottom-menu]");
      const menuHeight = menu && getComputedStyle(menu).display !== "none" ? menu.getBoundingClientRect().height : 0;
      return window.innerHeight - menuHeight - EDGE_SCROLL_BOTTOM;
    };

    const finish = () => {
      edgeDirection = 0;
      dragRef.current = null;
      setDrag(null);
    };
    const handleMove = (event) => {
      const current = dragRef.current;
      if (!current) return;
      const moved =
        current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > DRAG_THRESHOLD;
      dragRef.current = { ...current, x: event.clientX, y: event.clientY, moved };
      setDrag(dragRef.current);
      if (!moved) edgeDirection = 0;
      else if (event.clientY < EDGE_SCROLL_TOP) edgeDirection = -1;
      else if (event.clientY > bottomLimit()) edgeDirection = 1;
      else edgeDirection = 0;
    };
    const handleUp = (event) => {
      const current = dragRef.current;
      finish();
      if (!current) return;
      // Sin arrastrar: ha sido un toque, y se abre el cambio de puesto.
      if (!current.moved) {
        setPicking(current.player);
        return;
      }

      // Se coloca donde se ve la chapa, no donde está el dedo.
      const dropX = event.clientX;
      const dropY = event.clientY - current.lift;
      const rect = courtRef.current.getBoundingClientRect();
      const onCourt = dropX >= rect.left && dropX <= rect.right && dropY >= rect.top && dropY <= rect.bottom;
      if (onCourt) {
        onMoveRef.current(current.player, {
          x: clamp((dropX - rect.left) / rect.width),
          y: clamp((dropY - rect.top) / rect.height),
        });
      } else if (current.player.court) {
        onMoveRef.current(current.player, null);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") finish();
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.clearInterval(timer);
      body.userSelect = "";
      body.webkitUserSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("keydown", handleKey);
    };
  }, [draggingId]);

  const startDrag = (event, player) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = {
      player,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      lift: event.pointerType === "mouse" ? 0 : TOUCH_LIFT,
      moved: false,
    };
    setDrag(dragRef.current);
  };

  // Un toque muy rápido puede soltarse antes de que la pista empiece a escuchar el arrastre:
  // por eso el toque también se reconoce en la propia chapa.
  const endTap = (event, player) => {
    const current = dragRef.current;
    if (!current || current.moved || current.player.id !== player.id) return;
    dragRef.current = null;
    setDrag(null);
    setPicking(player);
  };

  // Alternativa con teclado: las flechas mueven la chapa y Suprimir la devuelve al banquillo.
  const handleTokenKey = (event, player) => {
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (steps[event.key]) {
      event.preventDefault();
      const base = player.court ?? { x: 0.5, y: 0.75 };
      const [dx, dy] = steps[event.key];
      onMove(player, { x: clamp(base.x + dx * KEYBOARD_STEP), y: clamp(base.y + dy * KEYBOARD_STEP) });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setPicking(player);
    } else if ((event.key === "Delete" || event.key === "Backspace") && player.court) {
      event.preventDefault();
      onMove(player, null);
    }
  };

  const onCourt = players.filter((player) => player.court);
  const onBench = players.filter((player) => !player.court);
  const moving = drag?.moved ? drag : null;
  const leftStand = family.filter((_, index) => index % 2 === 0);
  const rightStand = family.filter((_, index) => index % 2 === 1);

  return (
    <section aria-labelledby="court-title" className="rounded-2xl border border-white/5 bg-panel p-4">
      <h2 id="court-title" className="font-display text-2xl font-black uppercase italic">Pista</h2>
      {canEdit && (
        <p id="court-help" className="mt-1 text-xs text-zinc-400">
          Arrastra cada chapa a donde quieras. Se guarda sola, y si la sacas de la pista vuelve al banquillo. Tócala para cambiar su puesto.
          <span className="sr-only"> Con el teclado: flechas para mover, Intro para cambiar el puesto y Suprimir para devolverla al banquillo.</span>
        </p>
      )}

      <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)_minmax(0,1fr)] lg:gap-2">
      <CourtSideStands side="left" label="Gradas, lado izquierdo" people={leftStand} />
      <div
        ref={courtRef}
        data-testid="court"
        // isolate: el orden de las chapas solo cuenta dentro de la pista, nunca por encima del menú.
        className="relative isolate mx-auto w-full max-w-sm overflow-hidden rounded-lg"
        style={{ aspectRatio: "100 / 190" }}
      >
        <CourtDrawing beach={beach} />
        {onCourt.map((player) => (
          <div
            key={player.id}
            className="absolute -translate-x-1/2 -translate-y-[22px]"
            style={{
              left: `${player.court.x * 100}%`,
              top: `${player.court.y * 100}%`,
              zIndex: 1 + Math.round(player.court.y * 100),
            }}
          >
            <Token
              player={player}
              canEdit={canEdit}
              hidden={moving?.player.id === player.id}
              onPointerDown={startDrag}
              onPointerUp={endTap}
              onKeyDown={handleTokenKey}
            />
          </div>
        ))}
      </div>
      <CourtSideStands side="right" label="Gradas, lado derecho" people={rightStand} />
      </div>

      <div className="mx-auto mt-3 max-w-sm rounded-lg border border-white/15 p-3" data-testid="court-bench">
        <h3 className="font-display text-sm font-extrabold uppercase italic tracking-wide text-zinc-200">Banquillo · {onBench.length}</h3>
        {onBench.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-400">No hay nadie en el banquillo.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {onBench.map((player) => (
              <Token
                key={player.id}
                player={player}
                canEdit={canEdit}
                hidden={moving?.player.id === player.id}
                onPointerDown={startDrag}
                onPointerUp={endTap}
                onKeyDown={handleTokenKey}
              />
            ))}
          </div>
        )}
      </div>

      <CourtStands family={family} />

      {picking && (
        <PositionPicker
          player={picking}
          onClose={() => setPicking(null)}
          onPick={(position) => {
            setPicking(null);
            if (position !== picking.position) onChangePosition?.(picking, position);
          }}
        />
      )}

      {moving && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[22px]"
          style={{ left: moving.x, top: moving.y - moving.lift }}
        >
          <Badge player={moving.player} lifted />
        </div>
      )}
    </section>
  );
}
