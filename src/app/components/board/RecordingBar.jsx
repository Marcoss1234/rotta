import { Circle, Footprints, Layers, Pause, Play, Square, Trash2 } from "lucide-react";
import { MAX_RECORDING_MS, PLAYBACK_SPEEDS } from "@/app/boardRecording.js";

const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

// `marks` son los momentos en que algún jugador hace una acción: se ven como puntos sobre la barra.
// wide: en el panel del ordenador (al lado de la cancha), cada parte con su título y los botones a todo el ancho.
const PanelTitle = ({ children }) => <h2 className="mb-2 text-xs font-bold text-ink-muted">{children}</h2>;
const wideButton = "flex min-h-12 w-full items-center gap-2.5 rounded-control border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white transition-ui hover:border-white/25 hover:bg-white/10";

export default function RecordingBar({ editable, hasRecording, recording, overdub, countdown, elapsed, playback, marks = [], onStart, onOverdub, onStop, onDelete, onPlan, wide = false }) {
  if (recording) {
    return (
      <div className={wide ? "flex flex-col-reverse gap-3" : "flex min-h-14 items-center gap-2 px-2 py-1.5"}>
        <button type="button" onClick={onStop} className={wide ? "flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-white px-4 text-sm font-extrabold text-void" : "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-extrabold text-void"}>
          <Square aria-hidden="true" className="h-3.5 w-3.5 fill-void" />
          Parar y guardar
        </button>
        <p aria-live="off" className="min-w-0 flex-1 text-xs font-semibold text-white/60">
          <span className="mr-1.5 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 align-baseline motion-reduce:animate-none text-snow" aria-hidden="true" />
          {countdown !== null
            ? "Prepárate: la jugada va a empezar"
            : elapsed > 0
              ? `${overdub ? "Grabando encima" : "Grabando"} ${clock(elapsed)} / ${clock(MAX_RECORDING_MS)}`
              : "Mueve a un jugador para empezar"}
        </p>
      </div>
    );
  }

  if (!hasRecording) {
    if (!editable) return null;
    return (
      <div className={wide ? "flex flex-col gap-2" : "flex min-h-14 items-center gap-2 px-2 py-1.5"}>
        {wide && <PanelTitle>Crear la jugada</PanelTitle>}
        <button type="button" onClick={onStart} className={wide ? `${wideButton} border-red-400/50` : "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-red-400/60 px-3 text-xs font-extrabold text-white hover:bg-red-400/10"}>
          <Circle aria-hidden="true" className="h-3.5 w-3.5 fill-red-500 text-red-500" />
          Grabar jugada
        </button>
        {onPlan ? (
          <button type="button" onClick={onPlan} className={wide ? "ui-btn-primary flex min-h-12 w-full items-center gap-2.5 rounded-control bg-club px-3 text-sm font-extrabold text-on-club" : "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-club px-3 text-xs font-extrabold text-on-club"}>
            <Footprints aria-hidden="true" className="h-4 w-4" />
            Jugada por pasos
          </button>
        ) : (
          <p className="min-w-0 flex-1 text-xs text-ink-muted">Graba los movimientos y luego reprodúcelos.</p>
        )}
      </div>
    );
  }

  const percent = playback.duration ? (playback.time / playback.duration) * 100 : 0;

  const chip = wide ? wideButton : "flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3 text-xs font-bold text-white hover:bg-white/10";
  return (
    <div className={wide ? "flex flex-col gap-5" : ""}>
    {wide && <PanelTitle>Reproducir</PanelTitle>}
    {/* Velocidad siempre a la vista: un toque y se ve más lenta o más rápida. */}
    <div role="radiogroup" aria-label="Velocidad de la jugada" className={wide ? "order-2 flex flex-col gap-2" : "flex items-center gap-1.5 px-2 pt-2"}>
      <span className="shrink-0 text-xs font-bold text-ink-muted">Velocidad</span>
      <div className={`flex min-w-0 flex-1 gap-1 bg-white/[0.04] p-1 ${wide ? "rounded-control ring-1 ring-inset ring-white/10" : "rounded-full"}`}>
        {PLAYBACK_SPEEDS.map((speed) => {
          const active = playback.speed === speed;
          return (
            <button
              key={speed}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => playback.setSpeed(speed)}
              className={`min-h-9 min-w-0 flex-1 rounded-full text-xs font-extrabold tabular-nums transition-colors ${active ? "bg-club text-on-club shadow" : "text-white/80 hover:bg-white/10"}`}
            >
              {String(speed).replace(".", ",")}x
            </button>
          );
        })}
      </div>
    </div>
    <div className={wide ? "order-1 -mt-3 flex items-center gap-3 rounded-control bg-white/[0.04] p-3 ring-1 ring-inset ring-white/10" : "flex min-h-14 items-center gap-1.5 px-2 py-1.5"}>
      <button
        type="button"
        onClick={playback.toggle}
        aria-label={playback.playing ? "Pausar" : "Reproducir jugada"}
        className={`ui-btn-primary flex shrink-0 items-center justify-center rounded-full bg-club text-on-club ${wide ? "h-12 w-12" : "h-11 w-11"}`}
      >
        {playback.playing ? <Pause aria-hidden="true" className="h-5 w-5 fill-current" /> : <Play aria-hidden="true" className="h-5 w-5 fill-current" />}
      </button>
      <label htmlFor="board-playback" className="sr-only">Momento de la jugada</label>
      <div className="relative flex min-w-0 flex-1 items-center">
      <input
        id="board-playback"
        type="range"
        min="0"
        max={playback.duration}
        step="10"
        value={playback.time}
        onPointerDown={playback.pause}
        onChange={(event) => playback.seek(Number(event.target.value))}
        aria-valuetext={clock(playback.time)}
        style={{ "--fill": `${percent}%` }}
        className="rating-range w-full min-w-0"
      />
      {playback.duration > 0 &&
        marks.map((mark) => (
          <span
            key={`${mark.id}-${mark.t}`}
            aria-hidden="true"
            title={mark.label}
            className="pointer-events-none absolute -top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-club-ui ring-2 ring-panel"
            style={{ left: `${Math.min(100, (mark.t / playback.duration) * 100)}%` }}
          />
        ))}
      </div>
      {(playback.active || wide) && <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-white/80">{clock(playback.active ? playback.time : playback.duration)}</span>}
      {playback.active && (
        <button type="button" onClick={playback.reset} aria-label="Volver al principio" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/5">
          <Square aria-hidden="true" className="h-4 w-4 fill-white" />
        </button>
      )}
    </div>
      {editable && !playback.active && (
        // Lo que se puede hacer con la jugada ya grabada, cada cosa con su nombre.
        <div className={wide ? "order-3" : ""}>
        {wide && <PanelTitle>Cambiar la jugada</PanelTitle>}
        <div className={wide ? "grid grid-cols-2 gap-2" : "flex items-center gap-1.5 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
          {onPlan && (
            <button type="button" onClick={onPlan} className={chip}>
              <Footprints aria-hidden="true" className="h-4 w-4" />
              Por pasos
            </button>
          )}
          <button type="button" onClick={onOverdub} className={chip}>
            <Layers aria-hidden="true" className="h-4 w-4" />
            Grabar encima
          </button>
          <button type="button" onClick={onStart} className={chip}>
            <Circle aria-hidden="true" className="h-3.5 w-3.5 fill-red-500 text-red-500" />
            Grabar de nuevo
          </button>
          <button type="button" onClick={onDelete} className={`${chip} ml-auto border-transparent text-ink-muted hover:text-red-200 ${wide ? "col-span-2 justify-center" : ""}`}>
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Borrar grabación
          </button>
        </div>
        </div>
      )}
    </div>
  );
}
