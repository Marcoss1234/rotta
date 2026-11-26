import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookmarkPlus, Check, ChevronDown, Download, Film, ListOrdered, Maximize2, MoreHorizontal, MousePointer2, Play, Repeat, RotateCcw, RotateCw, Share2, X, UserPlus, MoveUpRight, Pencil, Redo2, RectangleHorizontal, Trash2, Type, Undo2, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { createBoardLineup, deleteBoard, deleteBoardLineup, getBoard, listBoardLineups, renameBoardLineup, updateBoard, updatePlayer } from "@/app/api.js";
import AddPlayersDialog from "@/app/components/board/AddPlayersDialog.jsx";
import ConfirmDialog from "@/app/components/board/ConfirmDialog.jsx";
import LineupsDialog from "@/app/components/board/LineupsDialog.jsx";
import NameDialog from "@/app/components/board/NameDialog.jsx";
import LineDialog from "@/app/components/board/LineDialog.jsx";
import RecordingBar from "@/app/components/board/RecordingBar.jsx";
import BoardCanvas from "@/app/components/board/BoardCanvas.jsx";
import { CourtFrame } from "@/app/components/board/BoardScene.jsx";
import Board3D, { ballStateAt, bounceTailMs } from "@/app/components/board/Board3D.jsx";

// El visor 3D de verdad pesa: solo se descarga al abrirlo.
const Viewer3D = lazy(() => import("@/app/components/board/Viewer3D.jsx"));
const HAS_WEBGL = (() => {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
})();
import TokenDialog from "@/app/components/board/TokenDialog.jsx";
import { COUNTDOWN_SECONDS, MAX_RECORDING_MS, actionDuration, actionLabel, actionsAt, createRecorder, finishRecorder, recordAction, recordPosition, recorderElapsed, useBoardPlayback, withAction } from "@/app/boardRecording.js";
import ActionDialog from "@/app/components/board/ActionDialog.jsx";
import { buildPlay, inLine, lineMarks, lineRuleOf, planPositions, planPreview, repeatInLines } from "@/app/boardPlanner.js";
import { COURT_HEIGHT, COURT_WIDTH, BOARD_KINDS, applyLineup, blendElements, boardKindLabel, canRotate, lineupTokens, loadClubPlayers, newBall, newLine, newProp, nextLineupName, rivalToken, rotateElements, rotationZones, roundCoord, tokenFromPlayer } from "@/app/boards.js";
import { recordBoardVideo, videoFileName, videoType } from "@/app/boardVideo.js";
import { isBeachTeam } from "@/app/teams.js";
import { Notice } from "@/app/ui/index.js";
import { useMediaQuery } from "@/app/useMediaQuery.js";

const SAVE_DELAY_MS = 900;
const ROTATE_MS = 650;
const ZONES_SHOWN_MS = 2500;
// Al reproducir, cada flecha tarda como mucho esto en dibujarse.
const ARROW_DRAW_MS = 700;
const easeInOut = (value) => (value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2);

// Reparte el dibujo de las flechas a lo largo de la grabación, en el orden en que se pusieron.
function arrowProgressAt(elements, time, duration) {
  const arrows = elements.filter((element) => element.type === "arrow");
  if (arrows.length === 0 || duration <= 0) return null;
  const slot = duration / arrows.length;
  const drawTime = Math.min(ARROW_DRAW_MS, slot);
  return new Map(arrows.map((arrow, index) => [arrow.id, Math.min(1, Math.max(0, (time - index * slot) / drawTime))]));
}
const HISTORY_LIMIT = 50;
const TOOLS = [
  { id: "move", label: "Mover", icon: MousePointer2 },
  { id: "arrow", label: "Flecha", icon: MoveUpRight },
  { id: "zone", label: "Zona", icon: RectangleHorizontal },
  { id: "text", label: "Texto", icon: Type },
  { id: "pen", label: "Lápiz", icon: Pencil },
];
const STATUS_LABEL = { saving: "Guardando…", saved: "Guardado", error: "No se ha guardado" };

// Calcula el mayor tamaño de pista que cabe en el hueco disponible.
function useFittedCourt(half, sideSpace = 0) {
  // El hueco aparece cuando carga la jugada: con estado, la medida se hace en ese momento.
  const [box, setBox] = useState(null);
  const [width, setWidth] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ratio = COURT_WIDTH / (half ? COURT_HEIGHT / 2 : COURT_HEIGHT);

  useEffect(() => {
    if (!box) return undefined;
    const measure = () => {
      setWidth(Math.floor(Math.max(0, Math.min(box.clientWidth - sideSpace * 2, box.clientHeight * ratio))));
      setSize({ width: box.clientWidth, height: box.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [box, ratio, sideSpace]);

  return [setBox, width, size];
}

// Se recuerda en este móvil u ordenador si se prefiere ver la pizarra en 3D.
const VIEW_KEY = "tnt-pizarra-3d";
function readView3d() {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "1";
  } catch {
    return false;
  }
}
function storeView3d(value) {
  try {
    window.localStorage.setItem(VIEW_KEY, value ? "1" : "0");
  } catch {
    // Sin almacenamiento (modo privado): se elige cada vez.
  }
}


// El vídeo ya hecho: se puede ver, compartir (WhatsApp en el móvil) o descargar.
function VideoDialog({ video, onClose }) {
  const dialogRef = useRef(null);
  const canShare = typeof navigator !== "undefined" && navigator.canShare?.({ files: [video.file] });

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const share = async () => {
    try {
      await navigator.share({ files: [video.file], title: video.name });
    } catch {
      // Cancelado: no pasa nada.
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="video-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-white/15 bg-card p-4 font-body text-white backdrop:bg-black/80"
    >
      <h2 id="video-title" className="font-display text-xl font-extrabold">Vídeo listo</h2>
      <video src={video.url} controls playsInline className="mx-auto mt-3 max-h-[50dvh] rounded-lg bg-black" />
      <div className={`mt-4 grid gap-2 ${canShare ? "grid-cols-2" : "grid-cols-1"}`}>
        {canShare && (
          <button type="button" onClick={share} className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-club text-sm font-bold text-on-club">
            <Share2 aria-hidden="true" className="h-4 w-4" />
            Compartir
          </button>
        )}
        <a href={video.url} download={video.name} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ${canShare ? "border border-white/30 text-white" : "bg-club text-on-club"}`}>
          <Download aria-hidden="true" className="h-4 w-4" />
          Descargar
        </a>
      </div>
      <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full rounded-lg text-sm font-semibold text-white/80 hover:bg-white/5">Cerrar</button>
    </dialog>
  );
}

// Menú pequeño que se abre encima de todo; tocar fuera lo cierra.
function Popover({ onClose, className = "", label, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <button type="button" aria-label="Cerrar el menú" tabIndex={-1} onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-black/40" />
      <div role="menu" aria-label={label} className={`absolute z-50 w-64 max-w-[calc(100vw-1rem)] rounded-2xl border border-white/15 bg-card p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.7)] ${className}`}>
        {children}
      </div>
    </>
  );
}

function MenuItem({ icon: Icon, label, hint = null, danger = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold disabled:opacity-40 ${danger ? "text-red-200 hover:bg-red-400/10" : "text-white hover:bg-white/5"}`}
    >
      <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${danger ? "text-red-300" : "text-white/80"}`} />
      <span className="min-w-0 flex-1">
        {label}
        {hint && <span className="block text-xs font-normal text-ink-muted">{hint}</span>}
      </span>
    </button>
  );
}

const headerIconClass = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-void text-white/60 hover:text-white disabled:opacity-40";
const chipClass = "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3 text-xs font-bold text-white hover:bg-white/10";
// En el panel del ordenador: botones grandes que llenan su casilla de la rejilla, con icono y nombre.
const panelChipClass = "flex min-h-12 w-full items-center gap-2.5 rounded-control border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white transition-ui hover:border-white/25 hover:bg-white/10";
// Título de cada parte del panel del ordenador.
const PanelTitle = ({ children }) => <h2 className="mb-2 text-xs font-bold text-ink-muted">{children}</h2>;
const segmentClass = (on) => `min-h-9 rounded-md px-3 text-xs font-extrabold ${on ? "ui-selected" : "text-white/80 hover:text-white"}`;

// Botón de una opción entre dos (Se queda / Vuelve a la fila…).
const choiceClass = (on) =>
  `flex min-h-9 flex-1 items-center justify-center gap-1 rounded-full px-2 text-xs font-extrabold ${on ? "bg-club text-on-club" : "text-white/80"}`;

export default function BoardEditorPage({ onAccessLost }) {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [elements, setElements] = useState([]);
  const [club, setClub] = useState({ teams: [], players: [] });
  const [addingPlayers, setAddingPlayers] = useState(false);
  const [editingTokenId, setEditingTokenId] = useState(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [info, setInfo] = useState("");
  const [lineups, setLineups] = useState(null);
  const [lineupsError, setLineupsError] = useState("");
  const [showingLineups, setShowingLineups] = useState(false);
  const [savingLineup, setSavingLineup] = useState(false);
  const [namingLineup, setNamingLineup] = useState(false);
  // Fila nueva: primero cuántos jugadores (diálogo) y luego se toca dónde va.
  const [lineDialog, setLineDialog] = useState(false);
  const [lineSize, setLineSize] = useState(null);
  const [lineRule, setLineRule] = useState("toque");
  const [lineupSaveError, setLineupSaveError] = useState("");
  const [zonesFlash, setZonesFlash] = useState(false);
  const rotation = useRef(null);
  // Efectos del momento: salto de una chapa (doble toque), bote y onda de un balón al soltarlo.
  const [effects, setEffects] = useState(null);
  const [presenting, setPresenting] = useState(false);
  const [view3d, setView3d] = useState(readView3d);
  const [exporting, setExporting] = useState(false);
  const [video, setVideo] = useState(null);
  const sectionRef = useRef(null);
  const playbackRef = useRef(null);
  const exportStarted = useRef(0);
  const [confirming, setConfirming] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordElapsed, setRecordElapsed] = useState(0);
  const recorder = useRef(null);
  const stopRecordingRef = useRef(null);
  // A quién se le está eligiendo una acción y en qué momento de la jugada.
  const [actionTarget, setActionTarget] = useState(null);
  // Jugada por pasos: los pasos hechos y el que se está montando (jugador y acción).
  const [planner, setPlanner] = useState(null);
  const [overdub, setOverdub] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const ballIds = useMemo(() => new Set(elements.filter((element) => element.type === "ball").map((element) => element.id)), [elements]);
  const bounceTail = useMemo(() => bounceTailMs(board?.recording, ballIds), [board?.recording, ballIds]);
  const playback = useBoardPlayback(board?.recording, elements, (id) => recorder.current?.tracks.has(id), bounceTail);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [tool, setTool] = useState("move");
  // Abajo: "dibujar" (colocar y dibujar) o "jugada" (grabar y reproducir).
  const [mode, setMode] = useState(null);
  const [menu, setMenu] = useState(null);
  // Ordenador: los controles van en un panel a la derecha de la cancha, ordenados por partes y a todo el ancho.
  const panelQuery = useMediaQuery("(min-width: 1024px)");
  const wide = panelQuery && !presenting;
  const chip = wide ? panelChipClass : chipClass;
  const [arrowStyle, setArrowStyle] = useState("move");
  const [textValue, setTextValue] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const committed = useRef([]);
  const content = useRef(null);
  const dirty = useRef(false);
  const saving = useRef(null);
  const timer = useRef(null);

  const leave = useCallback((teamId) => navigate(`/app/plantillas/pizarra${teamId ? `?equipo=${teamId}` : ""}`), [navigate]);

  useEffect(() => {
    let cancelled = false;
    getBoard(boardId)
      .then((data) => {
        if (cancelled) return;
        setBoard(data);
        const first = data.steps[0].elements;
        setElements(first);
        committed.current = first;
        // Sin esto la jugada se sigue viendo, solo que con dorsales en vez de fotos.
        loadClubPlayers()
          .then((loaded) => {
            if (!cancelled) setClub(loaded);
          })
          .catch(() => {});
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (requestError.status === 401) onAccessLost();
        else setError(requestError.message);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, onAccessLost]);

  const persist = useCallback(async () => {
    clearTimeout(timer.current);
    if (saving.current) await saving.current;
    if (!dirty.current || !content.current) return;
    dirty.current = false;
    setStatus("saving");
    const { name, kind, court, published, steps, recording: savedRecording } = content.current;
    const request = updateBoard(boardId, { name: name.trim() || "Sin nombre", kind, court, published, steps, recording: savedRecording ?? null })
      .then(() => setStatus(dirty.current ? "saving" : "saved"))
      .catch((requestError) => {
        dirty.current = true;
        setStatus("error");
        if (requestError.status === 401) onAccessLost();
      })
      .finally(() => {
        saving.current = null;
      });
    saving.current = request;
    await request;
  }, [boardId, onAccessLost]);

  const scheduleSave = useCallback((nextBoard, nextElements) => {
    content.current = { ...nextBoard, steps: [{ elements: nextElements }] };
    dirty.current = true;
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(persist, SAVE_DELAY_MS);
  }, [persist]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Las alineaciones guardadas del equipo, solo para quien puede editar la jugada.
  const teamId = board?.team_id;
  const canEditBoard = Boolean(board?.can_edit) && !board?.private;
  useEffect(() => {
    if (!teamId || !canEditBoard) return undefined;
    let cancelled = false;
    listBoardLineups(teamId)
      .then((items) => {
        if (!cancelled) setLineups(items);
      })
      .catch((requestError) => {
        if (!cancelled) setLineupsError(requestError.message);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, canEditBoard]);

  useEffect(() => {
    if (!info) return undefined;
    const timeout = setTimeout(() => setInfo(""), 3000);
    return () => clearTimeout(timeout);
  }, [info]);

  useEffect(() => {
    if (!zonesFlash) return undefined;
    const timeout = setTimeout(() => setZonesFlash(false), ZONES_SHOWN_MS);
    return () => clearTimeout(timeout);
  }, [zonesFlash]);

  useEffect(() => () => cancelAnimationFrame(rotation.current), []);
  playbackRef.current = playback;

  useEffect(() => {
    if (!effects) return undefined;
    const timeout = setTimeout(() => setEffects(null), 700);
    return () => clearTimeout(timeout);
  }, [effects]);

  // Si se sale de pantalla completa con el botón del sistema, también se sale del modo presentación.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => () => {
    if (video) URL.revokeObjectURL(video.url);
  }, [video]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!recording) return undefined;
    const interval = setInterval(() => {
      const elapsed = overdub ? playback.clock() : recorderElapsed(recorder.current);
      setRecordElapsed(elapsed);
      if (elapsed >= MAX_RECORDING_MS) stopRecordingRef.current();
    }, 200);
    return () => clearInterval(interval);
    // `playback.clock` siempre lee el mismo reloj.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, overdub]);

  useEffect(() => {
    if (countdown === null) return undefined;
    if (countdown === 0) {
      setCountdown(null);
      playback.startOverdub();
      return undefined;
    }
    const timeout = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const commit = (next) => {
    const previous = committed.current;
    setHistory(({ past }) => ({ past: [...past, previous].slice(-HISTORY_LIMIT), future: [] }));
    committed.current = next;
    setElements(next);
    scheduleSave(board, next);
  };

  const onCanvasChange = (next, finished) => {
    if (finished && !recording) commit(next);
    else setElements(next);
  };

  const restore = (from, to) => {
    if (history[from].length === 0) return;
    const target = history[from].at(-1);
    setHistory({ [from]: history[from].slice(0, -1), [to]: [...history[to], committed.current] });
    committed.current = target;
    setElements(target);
    setSelectedId(null);
    scheduleSave(board, target);
  };

  const changeBoard = (changes) => {
    const next = { ...board, ...changes };
    setBoard(next);
    scheduleSave(next, committed.current);
  };

  const removeSelected = () => {
    commit(committed.current.filter((element) => element.id !== selectedId));
    setSelectedId(null);
  };

  const beginRecording = () => {
    playback.reset();
    setTool("move");
    setSelectedId(null);
    setNotice("");
    setRecordElapsed(0);
    recorder.current = createRecorder(committed.current);
    setRecording(true);
  };

  const startRecording = () => {
    if (board.recording) {
      setConfirming({ message: "¿Grabar de nuevo? Se sustituirá la grabación anterior.", confirmLabel: "Grabar", action: beginRecording });
    } else {
      beginRecording();
    }
  };

  // Se reproduce lo ya grabado y puedes mover a quien falte: al guardar se juntan las dos tomas.
  const startOverdub = () => {
    playback.reset();
    setTool("move");
    setSelectedId(null);
    setNotice("");
    setRecordElapsed(0);
    recorder.current = createRecorder(committed.current, board.recording);
    setOverdub(true);
    setRecording(true);
    setCountdown(COUNTDOWN_SECONDS);
  };

  const stopRecording = () => {
    const wasOverdub = overdub;
    const result = finishRecorder(recorder.current, wasOverdub ? board.recording?.actions ?? [] : []);
    setActionTarget(null);
    recorder.current = null;
    setRecording(false);
    setOverdub(false);
    setCountdown(null);
    playback.reset();
    // Cada uno vuelve a donde estaba antes de grabar.
    setElements(committed.current);
    if (result) changeBoard({ recording: result });
    else setNotice(wasOverdub ? "No has movido a nadie: la grabación sigue igual" : "No has movido a nadie: no se ha grabado nada");
  };
  stopRecordingRef.current = stopRecording;

  const deleteRecording = () => {
    setConfirming({ message: "¿Borrar la grabación de esta jugada?", confirmLabel: "Borrar", action: () => changeBoard({ recording: null }) });
  };

  const closeToken = () => {
    setEditingTokenId(null);
    setSelectedId(null);
  };

  const applyToken = async (changes, alsoRoster) => {
    const element = committed.current.find((item) => item.id === editingTokenId);
    if (!element) {
      closeToken();
      return;
    }
    setNotice("");
    let tokenChanges = changes;
    if (alsoRoster) {
      setTokenBusy(true);
      try {
        const saved = await updatePlayer(element.player_id, { position: changes.position });
        setClub((current) => ({
          ...current,
          players: current.players.map((player) => (player.id === saved.id ? { ...player, position: saved.position } : player)),
        }));
        // Ya coincide con su ficha: la jugada vuelve a seguirla.
        tokenChanges = { ...changes, position: null };
      } catch (requestError) {
        if (requestError.status === 401) onAccessLost();
        setNotice("En la jugada sí ha cambiado, pero no se ha podido guardar en su ficha");
      } finally {
        setTokenBusy(false);
      }
    }
    commit(committed.current.map((item) => (item.id === element.id ? { ...item, ...tokenChanges } : item)));
    closeToken();
  };

  const removeToken = () => {
    commit(committed.current.filter((item) => item.id !== editingTokenId));
    closeToken();
  };

  const saveLineup = async (name) => {
    const tokens = lineupTokens(committed.current);
    if (tokens.length === 0 || savingLineup) return;
    setSavingLineup(true);
    setLineupSaveError("");
    try {
      const saved = await createBoardLineup({ team_id: board.team_id, name, tokens });
      setLineups((current) => [saved, ...(current ?? [])]);
      setNamingLineup(false);
      setInfo(`Guardada «${saved.name}»`);
    } catch (requestError) {
      if (requestError.status === 401) onAccessLost();
      setLineupSaveError(requestError.message);
    } finally {
      setSavingLineup(false);
    }
  };

  const renameLineup = async (lineup, name) => {
    try {
      const renamed = await renameBoardLineup(lineup.id, name);
      setLineups((current) => current.map((item) => (item.id === renamed.id ? renamed : item)));
    } catch (requestError) {
      if (requestError.status === 401) onAccessLost();
      throw requestError;
    }
  };

  const putLineup = (lineup) => {
    commit(applyLineup(committed.current, lineup));
    setSelectedId(null);
    setShowingLineups(false);
    setInfo(`Puesta «${lineup.name}»`);
  };

  const removeLineup = async (lineup) => {
    setLineupsError("");
    try {
      await deleteBoardLineup(lineup.id);
      setLineups((current) => current.filter((item) => item.id !== lineup.id));
    } catch (requestError) {
      if (requestError.status === 401) onAccessLost();
      setLineupsError(requestError.message);
    }
  };

  // Rota a los seis de un equipo con una animación; al acabar queda guardado y se puede deshacer.
  const rotate = (side = "home") => {
    if (rotation.current) return;
    const from = committed.current;
    const next = rotateElements(from, side);
    if (!next) {
      setNotice(side === "home" ? "Para rotar, pon a 6 jugadores en tu campo" : "Para rotar al rival, pon a 6 rivales en su campo");
      return;
    }
    setSelectedId(null);
    setNotice("");
    setZonesFlash(true);
    const started = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - started) / ROTATE_MS);
      if (progress < 1) {
        setElements(blendElements(from, next, easeInOut(progress)));
        rotation.current = requestAnimationFrame(step);
        return;
      }
      rotation.current = null;
      commit(next);
    };
    rotation.current = requestAnimationFrame(step);
  };

  // Doble toque en una chapa: salta y queda marcada como atacante (otro doble toque la desmarca).
  // Si la jugada ya se hizo por pasos, se sigue donde se dejó: los pasos de antes se ven y se añaden más.
  const startPlanner = () => {
    playback.reset();
    setTool("move");
    setSelectedId(null);
    setView3d(false);
    const saved = board.recording?.plan ?? [];
    const ids = new Set(committed.current.map((element) => element.id));
    const usable = saved.length > 0 && saved.every((step) => ids.has(step.playerId) && (step.moves ?? []).every((move) => ids.has(move.playerId)));
    if (!usable) {
      setPlanner({ steps: [], playerId: null, action: null, moves: [] });
      return;
    }
    const last = saved.at(-1);
    // Si terminaba en un jugador sin mandar el balón, se retoma justo ahí: solo falta tocar adónde lo manda.
    if (!last.target) {
      setPlanner({ steps: saved.slice(0, -1), playerId: last.playerId, action: last.action, tempo: last.tempo ?? null, moves: last.moves ?? [], fresh: Boolean(last.fresh), resumed: true });
    } else {
      setPlanner({ steps: saved, playerId: null, action: null, moves: [], resumed: true });
    }
    setInfo(`Sigues en el paso ${saved.length + (last.target ? 1 : 0)}`);
  };

  const plannerStage = planner ? (!planner.playerId ? "player" : !planner.action ? "action" : "target") : null;

  const planTap = (point, tokenId) => {
    if (plannerStage === "player") {
      if (!tokenId) {
        setNotice(planner.steps.length === 0 ? "Toca a un jugador: el que tiene el balón" : "Toca al jugador que juega el balón");
        return;
      }
      // Por defecto se queda donde juega: la fila solo se usa si se pulsa "Vuelve a la fila".
      // El entrenador, a partir del segundo paso, suele lanzar un balón nuevo.
      const coach = elements.find((element) => element.id === tokenId)?.side === "coach";
      setPlanner({ ...planner, playerId: tokenId, fresh: planner.steps.length > 0 && coach });
    } else if (plannerStage === "target") {
      setPlanner({ ...planner, steps: [...planner.steps, { playerId: planner.playerId, action: planner.action, tempo: planner.tempo ?? null, target: point, moves: planner.moves ?? [], fresh: Boolean(planner.fresh) }], playerId: null, action: null, tempo: null, moves: [], fresh: false });
    }
  };

  // Mantener pulsado y arrastrar a un jugador: en este paso se coloca ahí (uno por jugador y paso).
  const planMove = (playerId, target) => {
    const moves = (planner.moves ?? []).filter((move) => move.playerId !== playerId);
    setPlanner({ ...planner, moves: [...moves, { playerId, target }] });
    const name = elements.find((element) => element.id === playerId)?.name || "Rival";
    setInfo(`${name} se moverá en el paso ${planner.steps.length + 1}`);
  };

  // Ejercicio en fila: con el primer pase de cada fila hecho, se completa solo hasta que pasan todos.
  const repeated = planner && plannerStage === "player" && !planner.moves?.length ? repeatInLines(planner.steps, elements) : null;
  const repeatPlan = () => {
    if (!repeated) return;
    setPlanner({ ...planner, steps: repeated });
    setInfo(`${repeated.length} pasos: ya han pasado todos`);
  };

  const undoPlanStep = () => {
    if (!planner.playerId && planner.moves?.length) setPlanner({ ...planner, moves: planner.moves.slice(0, -1) });
    else if (planner.action) setPlanner({ ...planner, action: null, playerId: null });
    else if (planner.playerId) setPlanner({ ...planner, playerId: null });
    else setPlanner({ ...planner, steps: planner.steps.slice(0, -1) });
  };

  // Crea la grabación con los pasos. "Terminar aquí" cierra con el último jugador sin mandar el balón a ningún sitio.
  const finishPlanner = (endHere = false) => {
    let steps = endHere && planner.action ? [...planner.steps, { playerId: planner.playerId, action: planner.action, tempo: planner.tempo ?? null, target: null, moves: planner.moves ?? [], fresh: Boolean(planner.fresh) }] : planner.steps;
    // Movimientos marcados después del último paso: van con ese último paso.
    if (!(endHere && planner.action) && planner.moves?.length && steps.length > 0) {
      const last = steps.at(-1);
      steps = [...steps.slice(0, -1), { ...last, moves: [...(last.moves ?? []).filter((move) => !planner.moves.some((other) => other.playerId === move.playerId)), ...planner.moves] }];
    }
    if (steps.length === 0) return;
    const apply = () => {
      let next = committed.current;
      let ball = next.find((element) => element.type === "ball");
      if (!ball) {
        ball = newBall(0);
        next = [...next, ball];
      }
      const { recording: played, ballStart } = buildPlay(steps, next, ball.id);
      const built = { ...played, plan: steps.map((step) => ({ playerId: step.playerId, action: step.action, ...(step.action === "colocacion" && step.tempo ? { tempo: step.tempo } : {}), target: step.target ? { x: roundCoord(step.target.x), y: roundCoord(step.target.y) } : null, moves: (step.moves ?? []).map((move) => ({ playerId: move.playerId, target: { x: roundCoord(move.target.x), y: roundCoord(move.target.y) } })), ...(step.fresh ? { fresh: true } : {}) })) };
      next = next.map((element) => (element.id === ball.id ? { ...element, x: ballStart.x, y: ballStart.y } : element));
      commit(next);
      changeBoard({ recording: built });
      setPlanner(null);
      setInfo("Jugada creada");
      // Se reproduce sola en cuanto la pista tiene la grabación nueva.
      setTimeout(() => playbackRef.current?.toggle(), 250);
    };
    if (board.recording && !planner.resumed) {
      setConfirming({ message: "¿Crear la jugada? Se sustituirá la grabación que ya tiene.", confirmLabel: "Crear", action: apply });
    } else {
      apply();
    }
  };

  // Tocar a un jugador grabando (o con la jugada en pausa) abre las acciones en ese momento.
  const openActions = (id) => {
    const time = recording ? (overdub ? playback.clock() : recorderElapsed(recorder.current)) : playback.time;
    setActionTarget({ id, time: Math.round(time), live: recording });
  };

  const targetActions = () => {
    if (!actionTarget) return [];
    const list = actionTarget.live ? recorder.current?.actions ?? [] : board.recording?.actions ?? [];
    return list.filter((item) => item.id === actionTarget.id);
  };

  const saveActions = (actions) => {
    const recordingNow = board.recording;
    const longest = Math.max(recordingNow?.duration_ms ?? 1, ...actions.map((item) => item.t + actionDuration(item.action)));
    changeBoard({ recording: { ...recordingNow, duration_ms: Math.min(MAX_RECORDING_MS, longest), actions } });
  };

  const chooseAction = (action, tempo = null) => {
    const { id, time, live } = actionTarget;
    if (live && recorder.current) recordAction(recorder.current, id, action, time, tempo);
    else saveActions(withAction(board.recording?.actions, id, time, action, tempo));
    const name = elements.find((element) => element.id === id)?.name || "Rival";
    setInfo(`${name}: ${actionLabel(action, tempo).toLowerCase()}`);
    setActionTarget(null);
  };

  const removeAction = (item) => {
    if (actionTarget?.live && recorder.current) {
      recorder.current.actions = recorder.current.actions.filter((other) => other !== item);
      setActionTarget({ ...actionTarget });
      return;
    }
    saveActions((board.recording?.actions ?? []).filter((other) => other !== item));
  };

  const markAttacker = (id) => {
    if (!board.can_edit) return;
    commit(committed.current.map((element) => (element.id === id ? { ...element, highlight: !element.highlight } : element)));
    setEffects({ jump: { id, key: performance.now() } });
  };

  const dropBall = (ball) => {
    const key = performance.now();
    setEffects({ bounce: { id: ball.id, key }, ripple: { x: ball.x, y: ball.y, key } });
  };

  const toggleView3d = () => {
    setTool("move");
    setSelectedId(null);
    setView3d((current) => {
      storeView3d(!current);
      return !current;
    });
  };

  const togglePresenting = async () => {
    if (presenting) {
      setPresenting(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      return;
    }
    setTool("move");
    setSelectedId(null);
    setPresenting(true);
    // En iPhone no hay pantalla completa para páginas: allí basta con esconder los menús.
    await sectionRef.current?.requestFullscreen?.().catch(() => {});
  };

  const exportVideo = async () => {
    const type = videoType();
    if (!board.recording) {
      setNotice("Graba la jugada para poder sacar el vídeo");
      return;
    }
    if (!type) {
      setNotice("Este navegador no puede crear vídeos");
      return;
    }
    await persist();
    setTool("move");
    setSelectedId(null);
    playback.reset();
    playback.setSpeed(1);
    setExporting(true);
    // Un par de fotogramas para que la pista se pinte sin fotos (no se pueden meter en el vídeo).
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const frame = sectionRef.current.querySelector(view3d ? (HAS_WEBGL ? "[data-viewer-canvas]" : "[data-court-3d]") : "[data-court-layers]");
      const blob = await recordBoardVideo({
        frame,
        half: board.court === "half",
        view3d,
        webgl: view3d && HAS_WEBGL,
        title: board.name,
        type,
        play: () => {
          exportStarted.current = performance.now();
          playbackRef.current.toggle();
        },
        isPlaying: () => playbackRef.current.playing || performance.now() - exportStarted.current < 400,
      });
      const name = videoFileName(board.name, type);
      setVideo({ url: URL.createObjectURL(blob), file: new File([blob], name, { type: blob.type }), name });
    } catch {
      setNotice("No se ha podido crear el vídeo");
    } finally {
      setExporting(false);
      playbackRef.current.reset();
    }
  };

  const clearAll = () => {
    setConfirming({
      message: "¿Vaciar la pista? Podrás deshacerlo.",
      confirmLabel: "Vaciar",
      action: () => {
        commit([]);
        setSelectedId(null);
      },
    });
  };

  const goBack = async () => {
    await persist();
    leave(board?.team_id);
  };

  const removeBoard = () => setConfirming({ message: "¿Borrar esta jugada? No se puede recuperar.", confirmLabel: "Borrar", action: deleteThisBoard });

  const deleteThisBoard = async () => {
    clearTimeout(timer.current);
    dirty.current = false;
    try {
      await deleteBoard(boardId);
      leave(board.team_id);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const half = board?.court === "half";
  const [courtBox, courtWidth, courtArea] = useFittedCourt(half, 0);

  if (error && !board) {
    return (
      <div className="space-y-3">
        <Notice tone="error">{error}</Notice>
        <button type="button" onClick={() => leave()} className="min-h-11 rounded-lg border border-white/30 px-4 text-sm font-semibold">Volver a la pizarra</button>
      </div>
    );
  }
  if (!board) return <p role="status" className="text-white/80">Cargando…</p>;

  const editable = board.can_edit;
  const rosterById = Object.fromEntries(club.players.map((player) => [player.id, player]));
  const placed = new Set(elements.map((element) => element.player_id).filter(Boolean));
  const rivals = elements.filter((element) => element.type === "token" && element.side === "rival").length;
  const balls = elements.filter((element) => element.type === "ball").length;
  const cones = elements.filter((element) => element.type === "prop" && element.kind === "cone").length;
  const homeOnCourt = lineupTokens(elements).length;
  // Altura del balón y destellos de cada toque mientras se reproduce la jugada.
  const ballState = playback.active
    ? ballStateAt(board.recording, playback.time, new Set(elements.filter((element) => element.type === "ball").map((element) => element.id)))
    : { heights: new Map(), flashes: new Map() };
  const editingToken = elements.find((element) => element.id === editingTokenId);
  // Arrastrar en el 3D: mientras se mueve solo se pinta; al soltar se guarda (y se puede deshacer).
  const move3d = (id, x, y, finished) => {
    const next = elements.map((element) => (element.id === id ? { ...element, x, y } : element));
    if (finished) commit(next);
    else setElements(next);
  };
  // Fila nueva donde se ha tocado, con jugadores de la plantilla que aún no están en la pista.
  const placeLine = (point) => {
    const size = lineSize;
    setLineSize(null);
    if (!size) return;
    const own = club.players.filter((player) => player.team_id === board.team_id);
    const others = club.players.filter((player) => player.team_id !== board.team_id);
    const tokens = newLine(size, point, [...own, ...others], committed.current, lineRule);
    commit([...committed.current, ...tokens]);
    setSelectedId(null);
    setInfo(`Fila de ${size} puesta. Arrastra el recuadro para moverla entera`);
  };

  const addElement = (element) => {
    commit([...committed.current, element]);
    setTool("move");
    setSelectedId(element.id);
  };
  // Con una jugada grabada se abre en "Jugada"; si no, en "Dibujar". Grabando o reproduciendo, siempre "Jugada".
  const shownMode = recording || playback.active || view3d ? "jugada" : mode ?? (board.recording ? "jugada" : "dibujar");
  const chooseMode = (next) => {
    if (next === "dibujar" && playback.active) playback.reset();
    setMode(next);
    setSelectedId(null);
    setTool("move");
  };
  const closeMenu = () => setMenu(null);
  const fromMenu = (action) => () => {
    setMenu(null);
    action();
  };

  return (
    <section ref={sectionRef} aria-label={`Pizarra: ${board.name}`} className={`force-dark fixed inset-0 z-50 flex flex-col bg-void pt-[env(safe-area-inset-top)] ${presenting ? "" : "md:left-[17rem] lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:grid-rows-[auto_minmax(0,1fr)]"}`}>
      {/* Escritorio: la cabecera arriba, la cancha a la izquierda con todo el alto y los controles en una columna a la
          derecha (antes iban debajo y la cancha quedaba pequeña). En el móvil, todo en columna como siempre. */}
      <header className={`relative shrink-0 border-b border-white/10 bg-card px-2 pb-2 pt-1.5 lg:col-span-2 ${presenting ? "hidden" : ""}`}>
        <div className="flex items-center gap-1">
          <button type="button" onClick={goBack} aria-label="Volver a la pizarra" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/10">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          {editable ? (
            <>
              <div className="min-w-0 flex-1">
                <label htmlFor="board-name" className="sr-only">Nombre de la jugada</label>
                <input
                  id="board-name"
                  value={board.name}
                  maxLength={60}
                  onChange={(event) => changeBoard({ name: event.target.value })}
                  className="block min-h-8 w-full truncate rounded-md bg-transparent px-1.5 font-display text-lg font-extrabold leading-tight text-white hover:bg-white/5 focus:bg-white/10 focus:outline-none"
                />
                <p aria-live="polite" className={`truncate px-1.5 text-[11px] font-semibold ${status === "error" ? "text-red-300" : "text-ink"}`}>
                  {boardKindLabel(board.kind)} · {STATUS_LABEL[status] ?? (board.private ? "Solo la ves tú" : board.published ? "Publicada" : "Borrador")}
                </p>
              </div>
              {!board.private && (
              <button
                type="button"
                aria-pressed={board.published}
                onClick={() => changeBoard({ published: !board.published })}
                className={`flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-extrabold ${
                  board.published ? "border border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "ui-btn-primary bg-club text-on-club"
                }`}
              >
                {board.published && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                {board.published ? "Publicada" : "Publicar"}
              </button>
              )}
            </>
          ) : (
            <>
              <h1 className="min-w-0 flex-1 truncate px-1 font-display text-xl font-extrabold">{board.name}</h1>
            </>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 pl-1">
          <div role="group" aria-label="Vista" className="flex shrink-0 rounded-lg border border-white/10 bg-void p-0.5">
            <button type="button" aria-pressed={!view3d} onClick={() => view3d && toggleView3d()} className={segmentClass(!view3d)}>2D</button>
            <button type="button" aria-pressed={view3d} onClick={() => !view3d && toggleView3d()} className={segmentClass(view3d)}>3D</button>
          </div>
          {editable && (
            <span className="min-w-0 flex-1 truncate px-1 text-xs font-semibold text-ink-muted">
              {boardKindLabel(board.kind)} · {half ? "Media pista" : "Pista entera"}
            </span>
          )}
          {!editable && <span className="flex-1" />}
          <div className="relative">
            <button type="button" onClick={() => setMenu(menu === "more" ? null : "more")} aria-expanded={menu === "more"} aria-label="Más opciones" className={`${headerIconClass} ${menu === "more" ? "border-white/40 text-white" : ""}`}>
              <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
            </button>
            {menu === "more" && (
              <Popover onClose={closeMenu} label="Más opciones" className="right-0 top-12">
                {editable && (
                  <div className="space-y-2 border-b border-white/10 px-2 pb-3 pt-1">
                    <label htmlFor="board-kind" className="block text-[11px] font-bold text-ink-muted">Tipo de jugada</label>
                    <select id="board-kind" value={board.kind} onChange={(event) => changeBoard({ kind: event.target.value })} className="min-h-10 w-full rounded-lg border border-white/10 bg-void px-2 text-sm font-semibold text-white [color-scheme:dark] focus:border-white/40 focus:outline-none">
                      {BOARD_KINDS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <p className="text-[11px] font-bold text-ink-muted">Pista</p>
                    <div role="group" aria-label="Tamaño de la pista" className="flex rounded-lg border border-white/10 bg-void p-0.5">
                      {[["full", "Entera"], ["half", "Media"]].map(([value, label]) => (
                        <button key={value} type="button" aria-pressed={board.court === value} onClick={() => changeBoard({ court: value })} className={`flex-1 ${segmentClass(board.court === value)}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-1">
                  <MenuItem icon={Maximize2} label="Presentar" hint="Pantalla completa, para enseñarla en el entreno" onClick={fromMenu(togglePresenting)} />
                  {board.recording && <MenuItem icon={Film} label="Sacar vídeo" hint="Para mandarlo por WhatsApp" disabled={exporting} onClick={fromMenu(exportVideo)} />}
                  {editable && <MenuItem icon={Trash2} label="Borrar esta jugada" danger onClick={fromMenu(removeBoard)} />}
                </div>
              </Popover>
            )}
          </div>
        </div>
      </header>

      <div ref={courtBox} className={`relative flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_center,rgb(var(--c-club-ui)/0.10),transparent_65%)] p-3 ${presenting ? "" : "lg:row-start-2"}`}>
        {view3d && HAS_WEBGL && (
          <Suspense fallback={<p role="status" className="text-sm text-white/80">Cargando 3D…</p>}>
            <Viewer3D
              elements={playback.shown}
              rosterById={rosterById}
              heights={ballState.heights}
              flashes={ballState.flashes}
              actions={playback.active ? actionsAt(board.recording, playback.time) : null}
              beach={isBeachTeam(board.team_id)}
              teamId={board.team_id}
              onMove={editable && !playback.active && !recording && !presenting && countdown === null ? move3d : null}
            />
          </Suspense>
        )}

        {view3d && !HAS_WEBGL && courtArea.width > 0 && (
          <Board3D
            elements={playback.shown}
            rosterById={rosterById}
            half={half}
            beach={isBeachTeam(board.team_id)}
            maxWidth={courtArea.width - 24}
            maxHeight={courtArea.height - 24}
            heights={ballState.heights}
            flashes={ballState.flashes}
            actions={playback.active ? actionsAt(board.recording, playback.time) : null}
            arrowProgress={playback.active ? arrowProgressAt(playback.shown, playback.time, playback.duration) : null}
            zones={board.kind === "rotacion" || zonesFlash ? rotationZones(playback.shown) : null}
            photos={!exporting}
            label={`Jugada ${board.name} en 3D, ${boardKindLabel(board.kind)}`}
          />
        )}

        {!view3d && courtWidth > 0 && (
          <CourtFrame half={half} beach={isBeachTeam(board.team_id)} className="shadow-[0_12px_40px_rgba(0,0,0,0.65)] ring-1 ring-white/10" style={{ width: courtWidth }}>
            <BoardCanvas
              elements={planner ? planPositions(planner.steps, playback.shown) : playback.shown}
              rosterById={rosterById}
              tool={lineSize ? "place-line" : tool}
              arrowStyle={arrowStyle}
              textValue={textValue}
              selectedId={planner ? planner.playerId : selectedId}
              readOnly={!editable || presenting || exporting || countdown !== null || (playback.playing && !recording)}
              actionTaps={playback.active && !playback.playing && !recording && Boolean(board.recording)}
              onActionTap={openActions}
              planning={Boolean(planner)}
              onPlanTap={planTap}
              onPlanMove={planMove}
              onPlaceLine={placeLine}
              extraDraft={planner ? [...lineMarks(elements), ...planPreview(planner.steps, elements, planner.moves)] : []}
              actions={playback.active ? actionsAt(board.recording, playback.time) : null}
              heights={ballState.heights}
              flashes={ballState.flashes}
              recording={recording}
              onRecordMove={(element) => recordPosition(recorder.current, element, overdub ? playback.clock() : null)}
              label={`Jugada ${board.name}, ${boardKindLabel(board.kind)}`}
              onChange={onCanvasChange}
              onSelect={setSelectedId}
              onTokenTap={setEditingTokenId}
              onTokenDoubleTap={markAttacker}
              onBallDrop={dropBall}
              effects={effects}
              photos={!exporting}
              trails
              arrowProgress={playback.active ? arrowProgressAt(playback.shown, playback.time, playback.duration) : null}
              zones={board.kind === "rotacion" || zonesFlash ? rotationZones(playback.shown) : null}
              onTextPlaced={() => {
                setTextValue("");
                setTool("move");
              }}
            />
          </CourtFrame>
        )}

        {presenting && (
          <button
            type="button"
            onClick={togglePresenting}
            aria-label="Salir de la presentación"
            className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-card/80 text-white backdrop-blur hover:bg-card"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        )}

        {exporting && (
          <p role="status" className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card/90 px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_6px_20px_rgba(0,0,0,0.5)] backdrop-blur">
            <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none text-snow" />
            Creando vídeo… {playback.duration ? Math.min(100, Math.round((playback.time / playback.duration) * 100)) : 0}%
          </p>
        )}

        {(notice || info) && (
          <p
            role="status"
            className={`pointer-events-none absolute left-1/2 top-3 z-20 max-w-[85%] -translate-x-1/2 rounded-full px-3.5 py-1.5 text-center text-xs font-bold shadow-[0_6px_20px_rgba(0,0,0,0.5)] ${
              notice ? "bg-red-500 text-snow" : "bg-emerald-400 text-void"
            }`}
          >
            {notice || info}
          </p>
        )}

        {countdown !== null && countdown > 0 && (
          <span aria-live="assertive" className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-9xl font-extrabold text-white [text-shadow:0_4px_24px_rgba(0,0,0,0.7)]">
            {countdown}
          </span>
        )}
      </div>

      <div className={`flex shrink-0 flex-col ${presenting ? "" : "lg:row-start-2 lg:min-h-0 lg:justify-start lg:gap-5 lg:overflow-y-auto lg:border-l lg:border-white/10 lg:bg-card lg:p-4"}`} data-testid="board-controls">
      {planner && (
        <div className="shrink-0 border-t border-white/10 bg-card px-2 pb-[env(safe-area-inset-bottom)] pt-2">
          <p aria-live="polite" className="px-1 text-sm font-bold text-white">
            <span className="mr-1.5 rounded-full bg-club px-2 py-0.5 text-xs font-extrabold text-on-club">Paso {planner.steps.length + 1}</span>
            {plannerStage === "player" && (planner.steps.length === 0 ? "Toca al jugador que tiene el balón" : "¿Quién juega ahora? Tócalo")}
            {plannerStage === "action" && "Elige qué hace"}
            {plannerStage === "target" && "Toca en la pista dónde manda el balón"}
          </p>
          <p className="px-1 pt-0.5 text-xs text-ink-muted">
            Mantén pulsado a un jugador y arrástralo para que se coloque en este paso
            {planner.moves?.length ? ` · ${planner.moves.length} ${planner.moves.length === 1 ? "movimiento" : "movimientos"}` : ""}
          </p>
          {/* Opciones del toque: en su propia fila, siempre a la vista (en el móvil no se pierden por la derecha). */}
          {plannerStage === "target" && inLine(elements, planner.playerId) && (
            <p className="px-1 pt-1 text-xs font-semibold text-orange-300">
              {lineRuleOf(elements, planner.playerId) === "remate"
                ? "Es de una fila «al rematar»: si remata, se cambia por el último de la fila."
                : "Es de una fila: tras su último toque vuelve al final y avanzan los demás."}
            </p>
          )}
          {plannerStage === "target" && planner.steps.length > 0 && (
            <div className="mt-2 space-y-1.5 px-1">
              {planner.steps.length > 0 && (
                <div role="group" aria-label="Qué balón juega" className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[11px] font-extrabold text-ink-muted">Balón</span>
                  <div className="flex flex-1 gap-0.5 rounded-full bg-void p-0.5 ring-1 ring-white/10">
                    <button type="button" aria-pressed={!planner.fresh} onClick={() => setPlanner({ ...planner, fresh: false })} className={choiceClass(!planner.fresh)}>
                      El que viene
                    </button>
                    <button type="button" aria-pressed={Boolean(planner.fresh)} onClick={() => setPlanner({ ...planner, fresh: true })} className={choiceClass(Boolean(planner.fresh))}>
                      <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[conic-gradient(#0F8A3C_0_33%,#D7262E_0_66%,#fff_0)] ring-1 ring-white" />
                      Balón nuevo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {repeated && (
            <button type="button" onClick={repeatPlan} className="mx-1 mt-2 flex min-h-11 w-[calc(100%-0.5rem)] items-center justify-center gap-1.5 rounded-full border border-club-ui bg-club/15 text-xs font-extrabold text-white">
              <Repeat aria-hidden="true" className="h-4 w-4" />
              Repetir hasta que pasen todos
            </button>
          )}
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" onClick={() => setPlanner(null)} className={`${chipClass} text-white/80`}>Cancelar</button>
            <button type="button" onClick={undoPlanStep} disabled={planner.steps.length === 0 && !planner.playerId && !planner.moves?.length} className={`${chipClass} disabled:opacity-40`}>
              <Undo2 aria-hidden="true" className="h-4 w-4" />
              Atrás
            </button>
            {plannerStage === "target" && (
              <button type="button" onClick={() => finishPlanner(true)} className={chipClass}>Terminar aquí</button>
            )}
            <button
              type="button"
              onClick={() => finishPlanner(false)}
              disabled={planner.steps.length === 0}
              className="ml-auto flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-club px-4 text-xs font-extrabold text-on-club disabled:opacity-40"
            >
              <Check aria-hidden="true" className="h-4 w-4" />
              Crear jugada
            </button>
          </div>
        </div>
      )}

      {editable && !presenting && !view3d && !planner && !recording && !exporting && (
        <div role="tablist" aria-label="Qué haces" className={`flex shrink-0 gap-1 bg-card ${wide ? "rounded-control bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10" : "border-t border-white/10 px-2 pt-2"}`}>
          {[["dibujar", "Dibujar", Pencil], ["jugada", "Jugada", Play]].map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={shownMode === id}
              onClick={() => chooseMode(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg font-display text-sm font-extrabold ${wide ? "min-h-11" : "min-h-10"} ${
                shownMode === id ? "ui-selected" : "text-white/80 hover:bg-white/5"
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={`shrink-0 bg-card empty:hidden ${planner || (editable && shownMode === "dibujar") ? "hidden" : ""} ${editable && !view3d || wide ? "" : "border-t border-white/10"} pb-[env(safe-area-inset-bottom)]`}>
        <RecordingBar
          wide={wide}
          editable={editable && !presenting && !exporting}
          hasRecording={Boolean(board.recording)}
          recording={recording}
          overdub={overdub}
          countdown={countdown}
          elapsed={recordElapsed}
          playback={playback}
          onStart={startRecording}
          onOverdub={startOverdub}
          onStop={stopRecording}
          onDelete={deleteRecording}
          onPlan={editable && !presenting ? startPlanner : null}
          marks={(board.recording?.actions ?? []).map((item) => ({ ...item, label: actionLabel(item.action) }))}
        />
      </div>

      {editable && !presenting && !view3d && !planner && shownMode === "dibujar" && (
        <footer className={`shrink-0 bg-card ${wide ? "flex flex-col gap-5" : "pb-[env(safe-area-inset-bottom)]"}`}>
          <section aria-label={tool === "move" ? "Añadir a la pista" : "Opciones de la herramienta"} className={wide ? "order-2" : ""}>
          {wide && tool === "move" && <PanelTitle>{selectedId ? "Lo elegido" : "Añadir a la pista"}</PanelTitle>}
          <div className={wide ? "grid grid-cols-2 gap-2" : "flex min-h-14 items-center gap-1.5 overflow-x-auto border-t border-white/5 px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
            {tool === "move" && selectedId && (
              <button type="button" onClick={removeSelected} className={`${chip} border-red-400/60 text-red-200 ${wide ? "col-span-2" : ""}`}>
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Quitar
              </button>
            )}
            {tool === "move" && !selectedId && (
              <>
                <button type="button" onClick={() => setAddingPlayers(true)} className={wide ? "ui-btn-primary col-span-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-club px-3 text-sm font-extrabold text-on-club" : "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-club px-3.5 text-xs font-extrabold text-on-club"}>
                  <UserPlus aria-hidden="true" className="h-4 w-4" />
                  Jugadores
                </button>
                <button type="button" onClick={() => setLineDialog(true)} className={chip}>
                  <span aria-hidden="true" className="flex flex-col gap-px">
                    <span className="h-1 w-3 rounded-full bg-orange-400" />
                    <span className="h-1 w-3 rounded-full bg-orange-400" />
                    <span className="h-1 w-3 rounded-full bg-orange-400" />
                  </span>
                  Fila
                </button>
                <button type="button" onClick={() => addElement(rivalToken(rivals))} className={chip}>
                  <span aria-hidden="true" className="h-3 w-3 rounded-full bg-club ring-1 ring-white" />
                  Rival
                </button>
                <button type="button" onClick={() => addElement(newBall(balls))} className={chip}>
                  <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[conic-gradient(#0F8A3C_0_33%,#D7262E_0_66%,#fff_0)] ring-1 ring-white" />
                  Balón
                </button>
                <button type="button" onClick={() => addElement(newProp("cone", cones))} className={chip}>
                  <span aria-hidden="true" className="h-0 w-0 border-x-[6px] border-b-[11px] border-x-transparent border-b-orange-500" />
                  Cono
                </button>
                <button type="button" onClick={() => addElement(newProp("box"))} className={chip}>
                  <span aria-hidden="true" className="h-2.5 w-3.5 rounded-[2px] bg-[#C08A4E] ring-1 ring-white" />
                  Cajón
                </button>
                {!board.private && (
                <div className="relative">
                  <button type="button" onClick={() => setMenu(menu === "lineup" ? null : "lineup")} aria-expanded={menu === "lineup"} className={chip}>
                    <Users aria-hidden="true" className="h-4 w-4" />
                    Alineación
                    {lineups?.length ? <span className="rounded-full bg-club px-1.5 text-xs font-extrabold text-on-club">{lineups.length}</span> : null}
                    <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
                )}
                <button type="button" onClick={() => rotate("home")} className={chip}>
                  <RotateCw aria-hidden="true" className="h-4 w-4" />
                  Rotar
                </button>
                {elements.length > 0 && <button type="button" onClick={clearAll} className={`${chip} ml-auto border-transparent text-ink-muted ${wide ? "col-span-2 justify-center" : ""}`}>Vaciar</button>}
              </>
            )}
            {tool === "arrow" && (
              <div role="group" aria-label="Tipo de flecha" className={wide ? "col-span-2 grid grid-cols-2 gap-2" : "flex gap-1.5"}>
                {[["move", "Movimiento"], ["pass", "Pase / balón"]].map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={arrowStyle === value} onClick={() => setArrowStyle(value)} className={`${chip} ${wide ? "justify-center" : ""} ${arrowStyle === value ? "border-club-ui bg-club text-on-club" : ""}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {tool === "text" && (
              <>
                <label htmlFor="board-text" className="sr-only">Texto para colocar en la pista</label>
                <input id="board-text" value={textValue} maxLength={60} onChange={(event) => setTextValue(event.target.value)} placeholder="Escribe y toca la pista" className="col-span-2 min-h-11 min-w-0 flex-1 rounded-lg border border-white/20 bg-void px-3 text-white placeholder:text-ink focus:border-white focus:outline-none" />
              </>
            )}
            {tool === "zone" && <span className="col-span-2 px-1 text-xs font-semibold text-white/80">Arrastra sobre la pista para marcar una zona.</span>}
            {tool === "pen" && <span className="col-span-2 px-1 text-xs font-semibold text-white/80">Dibuja con el dedo sobre la pista.</span>}
          </div>

          </section>

          <section aria-label="Herramientas" className={wide ? "order-1" : ""}>
          {wide && <PanelTitle>Herramientas</PanelTitle>}
          <div className={wide ? "flex items-stretch gap-1 rounded-control bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10" : "flex items-stretch border-t border-white/5 px-1"}>
            <div role="group" aria-label="Herramientas" className="flex min-w-0 flex-1">
              {TOOLS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={tool === id}
                  onClick={() => {
                    setTool(id);
                    setSelectedId(null);
                  }}
                  className={`group flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 font-bold ${wide ? "text-xs" : "text-[10px]"} ${tool === id ? "text-white" : "text-ink hover:text-white"}`}
                >
                  <span className={`flex h-7 w-11 items-center justify-center rounded-full ${tool === id ? "bg-club/20 text-club-ui" : ""}`}>
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  {label}
                </button>
              ))}
            </div>
            <div className="my-2 flex shrink-0 border-l border-white/10 pl-1">
              <button type="button" disabled={history.past.length === 0} onClick={() => restore("past", "future")} aria-label="Deshacer" className="flex w-11 items-center justify-center rounded-lg text-white/60 hover:bg-white/5 disabled:opacity-30">
                <Undo2 aria-hidden="true" className="h-5 w-5" />
              </button>
              <button type="button" disabled={history.future.length === 0} onClick={() => restore("future", "past")} aria-label="Rehacer" className="flex w-11 items-center justify-center rounded-lg text-white/60 hover:bg-white/5 disabled:opacity-30">
                <Redo2 aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>
          </section>
        </footer>
      )}
      </div>
      {menu === "lineup" && (
        <Popover onClose={closeMenu} label="Alineación" className="bottom-[calc(8.5rem+env(safe-area-inset-bottom))] left-2 lg:left-auto lg:right-2">
          <MenuItem icon={ListOrdered} label="Mis alineaciones" hint={lineups?.length ? `${lineups.length} guardadas` : "Todavía no hay ninguna"} onClick={fromMenu(() => setShowingLineups(true))} />
          <MenuItem icon={BookmarkPlus} label="Guardar esta alineación" hint={homeOnCourt === 0 ? "Pon antes a tus jugadores en la pista" : null} disabled={homeOnCourt === 0} onClick={fromMenu(() => setNamingLineup(true))} />
          <MenuItem icon={RotateCw} label="Rotar mi equipo" onClick={fromMenu(() => rotate("home"))} />
          {canRotate(elements, "rival") && <MenuItem icon={RotateCcw} label="Rotar el rival" onClick={fromMenu(() => rotate("rival"))} />}
        </Popover>
      )}

      {confirming && (
        <ConfirmDialog
          message={confirming.message}
          confirmLabel={confirming.confirmLabel}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null);
            confirming.action();
          }}
        />
      )}

      {editingToken && (
        <TokenDialog
          key={editingToken.id}
          element={editingToken}
          player={rosterById[editingToken.player_id]}
          busy={tokenBusy}
          onApply={applyToken}
          onRemove={removeToken}
          onClose={closeToken}
        />
      )}

      {namingLineup && (
        <NameDialog
          title="Guardar alineación"
          label="Nombre"
          initialName={nextLineupName(lineups ?? [])}
          confirmLabel="Guardar"
          busy={savingLineup}
          error={lineupSaveError}
          onConfirm={saveLineup}
          onCancel={() => {
            setNamingLineup(false);
            setLineupSaveError("");
          }}
        />
      )}

      {plannerStage === "action" && (
        <ActionDialog
          name={elements.find((element) => element.id === planner.playerId)?.name || elements.find((element) => element.id === planner.playerId)?.label || "este jugador"}
          time={null}
          actions={[]}
          coach={elements.find((element) => element.id === planner.playerId)?.side === "coach"}
          onChoose={(action, tempo = null) => setPlanner({ ...planner, action, tempo })}
          onRemove={() => {}}
          onClose={() => setPlanner({ ...planner, playerId: null })}
        />
      )}

      {actionTarget && (
        <ActionDialog
          name={elements.find((element) => element.id === actionTarget.id)?.name || elements.find((element) => element.id === actionTarget.id)?.label || "este jugador"}
          time={actionTarget.time}
          actions={targetActions()}
          coach={elements.find((element) => element.id === actionTarget.id)?.side === "coach"}
          onChoose={chooseAction}
          onRemove={removeAction}
          onClose={() => setActionTarget(null)}
        />
      )}

      {video && (
        <VideoDialog
          video={video}
          onClose={() => setVideo(null)}
        />
      )}

      {showingLineups && (
        <LineupsDialog
          lineups={lineups}
          error={lineupsError}
          onApply={putLineup}
          onRename={renameLineup}
          onDelete={removeLineup}
          onClose={() => setShowingLineups(false)}
        />
      )}

      {lineDialog && (
        <LineDialog
          onCancel={() => setLineDialog(false)}
          onConfirm={(size, rule) => {
            setLineDialog(false);
            setLineSize(size);
            setLineRule(rule);
            setTool("move");
            setInfo("Toca en la pista dónde va el primero de la fila");
          }}
        />
      )}
      {addingPlayers && (
        <AddPlayersDialog
          teams={club.teams}
          players={club.players}
          boardTeamId={board.team_id}
          placedIds={placed}
          onClose={() => setAddingPlayers(false)}
          onAdd={(chosen) => {
            commit([...committed.current, ...chosen.map((player, index) => tokenFromPlayer(player, placed.size + index))]);
            setAddingPlayers(false);
          }}
        />
      )}
    </section>
  );
}
