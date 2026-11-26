import { useEffect, useRef, useState } from "react";
import { Check, Info } from "lucide-react";
import CourtStands from "@/app/components/CourtStands.jsx";
import { positionTone } from "@/app/components/RankingVisuals.jsx";
import { POSITIONS } from "@/app/roles.js";
import { Button, IconButton, cx } from "@/app/ui/index.js";

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

// `stretch`: llena el hueco aunque la pista quede algo más ancha de lo real (el directo en el móvil).
// `themed` (Premium deportivo): suelo y líneas con el carácter de la identidad del club (court-* en index.css, como la
// pista de Inicio), en vez del parqué naranja. Lo usan Plantilla y el directo; la pizarra sigue con la pista realista.
export function CourtDrawing({ beach, horizontal = false, showZones = true, stretch = false, themed = false }) {
  if (themed) return <ThemedCourt beach={beach} horizontal={horizontal} showZones={showZones} stretch={stretch} />;
  const floor = beach ? "#e8cf95" : "#c9793f";
  const frontZone = beach ? "#e8cf95" : "#d98b4f";
  const line = beach ? "#1d4ed8" : "#ffffff";

  return (
    <svg viewBox={horizontal ? "0 0 190 100" : "0 0 100 190"} preserveAspectRatio={stretch ? "none" : undefined} aria-hidden="true" className="absolute inset-0 h-full w-full">
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

// La misma pista (mismas medidas y zonas) dibujada con los colores de la identidad. El contenedor lleva going-court
// (fondo del escenario) y, en playa, going-court-beach.
function ThemedCourt({ beach, horizontal, showZones, stretch }) {
  return (
    <svg viewBox={horizontal ? "0 0 190 100" : "0 0 100 190"} preserveAspectRatio={stretch ? "none" : undefined} aria-hidden="true" className="absolute inset-0 h-full w-full">
      <g transform={horizontal ? "translate(0 100) rotate(-90)" : undefined}>
        <rect className="court-floor" x="5" y="5" width="90" height="180" />
        {!beach && <rect className="court-front" x="5" y="65" width="90" height="60" />}
        <rect className="court-line" x="5" y="5" width="90" height="180" />
        {!beach && (
          <g className="court-line">
            <line x1="5" y1="65" x2="95" y2="65" />
            <line x1="5" y1="125" x2="95" y2="125" />
          </g>
        )}
        {!beach && showZones && (
          <g className="court-zones" fontSize="7" fontWeight="700" textAnchor="middle">
            <text x="20" y="38">1</text><text x="50" y="38">6</text><text x="80" y="38">5</text>
            <text x="20" y="84">2</text><text x="50" y="84">3</text><text x="80" y="84">4</text>
            <text x="20" y="112">4</text><text x="50" y="112">3</text><text x="80" y="112">2</text>
            <text x="20" y="158">5</text><text x="50" y="158">6</text><text x="80" y="158">1</text>
          </g>
        )}
        <line className="court-net" x1="2" y1="95" x2="98" y2="95" />
        <circle className="court-post" cx="2" cy="95" r="1.4" />
        <circle className="court-post" cx="98" cy="95" r="1.4" />
      </g>
    </svg>
  );
}

// La chapa: el aro del color de su puesto (el mismo de PositionTag); el líbero, rellena de su color.
// Debajo, el nombre y el puesto a 12 px, el puesto en su color. La pista va siempre en oscuro (force-dark).
// compact: algo más estrecha (la cancha del móvil, que va al lado del banquillo).
function Badge({ player, lifted = false, compact = false }) {
  const role = player.position && player.position !== "Sin definir" ? player.position : "";
  const tone = positionTone(player.position);
  const libero = player.position === "Líbero";
  return (
    <span className={`flex select-none flex-col items-center gap-0.5 ${compact ? "w-[4.5rem]" : "w-20"}`}>
      <span
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] text-sm font-extrabold shadow-[0_3px_8px_rgba(0,0,0,0.55)] motion-safe:transition-transform ${
          libero ? tone.chip : `${tone.chip} bg-zinc-950 text-white`
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
              <span className="absolute -bottom-1 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-950 px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
                {player.number}
              </span>
            )}
          </>
        ) : (
          player.number ?? initials(player.name)
        )}
      </span>
      <span className="flex max-w-full flex-col items-center rounded-md bg-black/75 px-1.5 py-0.5 text-center backdrop-blur-[2px]">
        <span className="max-w-full truncate text-xs font-semibold leading-4 text-snow">{shortName(player.name)}</span>
        {role && <span className={`max-w-full truncate text-xs font-medium leading-4 ${tone.label}`}>{role}</span>}
      </span>
    </span>
  );
}

function Token({ player, canEdit, hidden, onPointerDown, onPointerUp, onKeyDown, compact = false }) {
  const label = `${player.name}${player.number !== null ? `, dorsal ${player.number}` : ""}, ${player.position}`;
  const dimmed = hidden ? "opacity-30" : "";

  if (!canEdit) {
    return <div role="img" aria-label={label} title={player.name}><Badge player={player} compact={compact} /></div>;
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
      className={`cursor-grab touch-none select-none rounded-lg [-webkit-touch-callout:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rotta-text active:cursor-grabbing ${dimmed}`}
    >
      <Badge player={player} compact={compact} />
    </button>
  );
}

// Un toque rápido en una chapa abre esta ventanita para cambiar el puesto sin salir de la pista.
// Cada puesto con su color (el de PositionTag); el actual, marcado. Al tocar fuera, se cierra.
function PositionPicker({ player, onPick, onClose }) {
  const dialogRef = useRef(null);
  const currentRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    // El foco empieza en su puesto actual (no en el primero): así solo se ve una opción destacada.
    currentRef.current?.focus();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="position-picker-title"
      aria-describedby="position-picker-help"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="!m-auto w-[calc(100%-2rem)] max-w-xs rounded-card bg-card p-0 font-body text-ink shadow-card ring-1 ring-line backdrop:bg-canvas/75 backdrop:backdrop-blur-sm"
    >
      <div className="p-4">
        <p id="position-picker-title" className="flex items-baseline gap-2 font-display text-lg font-extrabold leading-tight">
          <span className="min-w-0 break-words">{player.name}</span>
          {player.number !== null && <span className="shrink-0 tabular-nums text-ink-muted">#{player.number}</span>}
        </p>
        <p id="position-picker-help" className="text-sm text-ink-muted">Elige su puesto</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {POSITIONS.map((position) => {
            const current = position === player.position;
            return (
              <button
                key={position}
                ref={current ? currentRef : undefined}
                type="button"
                aria-pressed={current}
                onClick={() => onPick(position)}
                className={cx(
                  "flex min-h-11 items-center gap-2 rounded-control px-3 text-left text-sm font-semibold ring-1 ring-inset transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text",
                  current ? "bg-club-soft text-ink ring-club-ui" : "text-ink ring-line hover:bg-raised hover:ring-control",
                )}
              >
                <span aria-hidden="true" className={cx("h-2 w-2 shrink-0 rounded-full", positionTone(position).dot)} />
                <span className="min-w-0 flex-1">{position}</span>
                {current && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-club-ui" />}
              </button>
            );
          })}
        </div>
        <Button variant="quiet" block onClick={onClose} className="mt-3">Cancelar</Button>
      </div>
    </dialog>
  );
}

// fit (móvil, pantalla fija): la cancha entera, con sus medidas de verdad, a la izquierda y tan alta como quepa; el
// banquillo a la derecha, en una columna que se desliza hacia abajo; las gradas, más abajo, deslizando la tarjeta.
// action: un botón al lado del título (en el móvil, abrir la lista de jugadores).
export default function CourtBoard({ players, family = [], canEdit, beach, onMove, onChangePosition, fit = false, action = null }) {
  const courtRef = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const [picking, setPicking] = useState(null);
  // En el móvil la explicación se abre con ⓘ (para dejarle sitio a la cancha); en el resto se ve siempre.
  const [helpOpen, setHelpOpen] = useState(false);
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

  return (
    <section
      aria-labelledby="court-title"
      className={fit ? "ui-card h-full min-h-0 overflow-y-auto overscroll-contain rounded-card bg-card p-3" : "ui-card rounded-card bg-card p-4 md:p-5"}
      data-testid="court-panel"
    >
      <div className={fit ? "flex h-full min-h-[26rem] flex-col" : undefined}>
      <div className={`flex shrink-0 justify-between gap-3 ${fit ? "items-center" : "items-baseline"}`}>
        <h2 id="court-title" className="font-title text-lg leading-tight text-ink">Pista</h2>
        <span className="flex items-center gap-1">
          <p className="text-xs font-semibold text-ink-muted">{onCourt.length} en pista</p>
          {action && <span className="ml-1">{action}</span>}
          {fit && canEdit && (
            <IconButton
              icon={Info}
              size="sm"
              label={helpOpen ? "Ocultar cómo se usa" : "Cómo se usa la pista"}
              aria-expanded={helpOpen}
              aria-controls="court-help"
              onClick={() => setHelpOpen((open) => !open)}
              className="-my-2 -mr-2"
            />
          )}
        </span>
      </div>
      {canEdit && (
        <p id="court-help" className={cx("mt-1 shrink-0 text-xs text-ink-muted", fit && !helpOpen && "sr-only")}>
          Arrastra cada chapa a donde quieras. Se guarda sola, y si la sacas de la pista vuelve al banquillo. Tócala para cambiar su puesto.
          <span className="sr-only"> Con el teclado: flechas para mover, Intro para cambiar el puesto y Suprimir para devolverla al banquillo.</span>
        </p>
      )}

      {/* fit: la cancha a la izquierda con sus medidas de verdad (tan alta como quepa) y el banquillo a la derecha. */}
      <div className={fit ? "mt-2 flex min-h-0 flex-1 gap-2" : undefined} style={fit ? { containerType: "size" } : undefined}>
      <div
        ref={courtRef}
        data-testid="court"
        // isolate: el orden de las chapas solo cuenta dentro de la pista, nunca por encima del menú.
        // force-dark: la pista, el banquillo y las gradas van siempre en oscuro (como la pizarra y el directo).
        className={`going-court force-dark relative isolate overflow-hidden rounded-inner ${fit ? "shrink-0" : "mx-auto mt-3 w-full max-w-sm"} ${beach ? "going-court-beach" : ""}`}
        // Con fit: 100 de ancho por 190 de largo, del alto que haya, dejando sitio al banquillo (6,5 rem) a la derecha.
        style={fit ? { aspectRatio: "100 / 190", height: "min(100cqh, (100cqw - 7rem) * 190 / 100)" } : { aspectRatio: "100 / 190" }}
      >
        <CourtDrawing beach={beach} themed />
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
              compact={fit}
              hidden={moving?.player.id === player.id}
              onPointerDown={startDrag}
              onPointerUp={endTap}
              onKeyDown={handleTokenKey}
            />
          </div>
        ))}
      </div>

      <div
        className={`force-dark rounded-card bg-raised text-ink ${fit ? "flex min-h-0 min-w-0 flex-1 flex-col p-2" : "mx-auto mt-3 max-w-sm p-3"}`}
        data-testid="court-bench"
      >
        <h3 className="flex shrink-0 items-baseline justify-between gap-1 font-display text-sm font-extrabold text-ink">
          Banquillo <span className="font-body text-xs font-semibold text-ink-muted">{onBench.length}</span>
        </h3>
        {onBench.length === 0 ? (
          <p className="mt-1 text-sm text-ink-muted">No hay nadie en el banquillo.</p>
        ) : (
          <div className={fit ? "no-scrollbar -mx-2 mt-1.5 flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto overscroll-contain px-2 pb-1" : "mt-2 flex flex-wrap gap-x-1.5 gap-y-2"}>
            {onBench.map((player) => (
              <Token
                key={player.id}
                player={player}
                canEdit={canEdit}
                compact={fit}
                hidden={moving?.player.id === player.id}
                onPointerDown={startDrag}
                onPointerUp={endTap}
                onKeyDown={handleTokenKey}
              />
            ))}
          </div>
        )}
      </div>
      </div>

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
          className="force-dark pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[22px]"
          style={{ left: moving.x, top: moving.y - moving.lift }}
        >
          <Badge player={moving.player} lifted />
        </div>
      )}
    </section>
  );
}
