import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, ImagePlus, SendHorizontal, Trash2, X } from "lucide-react";
import {
  deleteChatMessage,
  listChatMessages,
  markChatRead,
  sendChatImage,
  sendChatMessage,
  startChatTyping,
  stopChatTyping,
} from "@/app/api.js";
import { prepareChatImage } from "@/app/chatImage.js";
import Avatar from "@/app/components/Avatar.jsx";
import HelpCard from "@/app/components/HelpCard.jsx";
import { roleLabel } from "@/app/roles.js";
import usePolling from "@/app/usePolling.js";
import useVisibleViewport from "@/app/useVisibleViewport.js";
import { Notice } from "@/app/ui/index.js";

const MESSAGES_POLL_MS = 3000;
const TYPING_PING_MS = 3000;
const MAX_LENGTH = 1000;
const NEAR_BOTTOM_PX = 80;

const dayKey = (iso) => new Date(iso).toDateString();
const timeOf = (iso) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

function dayLabel(iso) {
  const key = dayKey(iso);
  if (key === new Date().toDateString()) return "Hoy";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === yesterday.toDateString()) return "Ayer";
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function typingLabel(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0].split(/\s+/)[0]} está escribiendo…`;
  return `${names.length} personas están escribiendo…`;
}

// El nombre de cada persona lleva su color. Las burbujas van todas iguales y la tuya, en naranja.
const AUTHOR_COLORS = [
  "text-red-500",
  "text-blue-400",
  "text-emerald-400",
  "text-yellow-400",
  "text-orange-400",
  "text-violet-400",
  "text-fuchsia-400",
  "text-cyan-400",
];

// Sale siempre el mismo color para la misma persona, en todos los móviles y aunque cambie de nombre.
function authorColor(authorId) {
  let hash = 0;
  for (const character of authorId) hash = (hash * 31 + character.codePointAt(0)) % 9973;
  return AUTHOR_COLORS[hash % AUTHOR_COLORS.length];
}

// La foto se ve entera, sin recortar, con su forma reservada desde el principio para que el chat no salte al cargar.
function MessageImage({ image, author, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(image)}
      aria-label={`Ver en grande la foto de ${author}`}
      className="-mx-1.5 mb-1 block overflow-hidden rounded-xl bg-black/30"
      style={{ aspectRatio: `${image.width} / ${image.height}`, width: "100%", maxWidth: `min(16rem, calc(18rem * ${image.width / image.height}))` }}
    >
      <img src={image.url} alt="" loading="lazy" width={image.width} height={image.height} className="h-full w-full object-cover" />
    </button>
  );
}

// Foto a pantalla completa. Se cierra con la X, tocando fuera o con Escape.
function ImageViewer({ image, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      aria-label="Foto"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 h-full max-h-none w-full max-w-none bg-black/95 p-0 backdrop:bg-black/90"
    >
      <div className="flex h-full w-full items-center justify-center p-3" onClick={onClose}>
        <img src={image.url} alt="Foto del chat" className="max-h-full max-w-full rounded-lg object-contain" onClick={(event) => event.stopPropagation()} />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar la foto"
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <X aria-hidden="true" className="h-6 w-6" />
      </button>
    </dialog>
  );
}

function Message({ message, grouped, onDelete, onOpenImage, onHelpChange, onAccessLost }) {
  const staffRole = message.author_role === "admin" || message.author_role === "entrenador";
  const color = authorColor(message.author_id);
  return (
    <li className={`message-in group flex items-center gap-1 ${message.mine ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-3"}`}>
      {!message.mine && (
        <span className="w-8 shrink-0 self-start">
          {!grouped && <Avatar name={message.author} picture={message.author_picture} className="h-8 w-8 text-xs" />}
        </span>
      )}
      <div
        className={`${message.help ? "w-[85%] max-w-md" : "max-w-[85%] md:max-w-[75%]"} rounded-2xl px-3 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.35)] ${
          message.mine ? "rounded-br-md bg-tnt text-onbrand" : "rounded-bl-md bg-zinc-800 text-zinc-50"
        }`}
      >
        {!message.mine && !grouped && (
          <p className={`mb-0.5 break-words text-xs font-extrabold ${color}`}>
            {message.author}
            {staffRole && <span className="font-semibold text-ember"> · {roleLabel(message.author_role)}</span>}
          </p>
        )}
        {message.image && <MessageImage image={message.image} author={message.author} onOpen={onOpenImage} />}
        {message.text && <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{message.text}</p>}
        {message.help && <HelpCard help={message.help} mine={message.mine} onChange={(card) => onHelpChange(message.id, card)} onAccessLost={onAccessLost} />}
        <p className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${message.mine ? "text-white/80" : "text-zinc-300"}`}>
          {timeOf(message.created_at)}
          {message.mine && (message.seen ? (
            <CheckCheck role="img" aria-label="Visto" className="h-4 w-4 text-white" />
          ) : (
            <Check role="img" aria-label="Enviado" className="h-4 w-4" />
          ))}
        </p>
      </div>
      {message.can_delete && (
        <button
          type="button"
          onClick={() => onDelete(message)}
          aria-label={`Borrar el mensaje de ${message.mine ? "ti" : message.author}: ${message.text ? message.text.slice(0, 40) : "foto"}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-red-300"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

export default function ChatConversation({ channel, onBack, onRead, onAccessLost }) {
  const [messages, setMessages] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [typing, setTyping] = useState([]);
  // Foto elegida para enviar (ya reducida) y la que se está viendo en grande.
  const [photo, setPhoto] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [viewing, setViewing] = useState(null);
  const fileRef = useRef(null);
  const lastTypingPing = useRef(0);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true);
  const restoreFrom = useRef(null);
  const latestSeen = useRef(null);
  const olderLoaded = useRef(false);
  const changes = useRef(0);
  const viewport = useVisibleViewport();

  // Al abrirse el teclado la lista encoge: si estabas al final, sigues viendo el último mensaje.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  // Si sales del chat con algo a medio escribir, los demás dejan de verte escribiendo.
  useEffect(() => () => {
    if (lastTypingPing.current) stopChatTyping(channel.id).catch(() => {});
  }, [channel.id]);

  const changeText = (value) => {
    setText(value);
    if (!value.trim()) {
      if (lastTypingPing.current) stopChatTyping(channel.id).catch(() => {});
      lastTypingPing.current = 0;
    } else if (Date.now() - lastTypingPing.current > TYPING_PING_MS) {
      lastTypingPing.current = Date.now();
      // Es solo un aviso: si falla, el mensaje se puede enviar igual.
      startChatTyping(channel.id).catch(() => {});
    }
  };

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401 || requestError.status === 403) {
      onAccessLost();
      onBack();
      return;
    }
    setError(requestError.message);
  }, [onAccessLost, onBack]);

  const markLatestRead = useCallback(async (latest) => {
    if (!latest || latest.id === latestSeen.current) return;
    latestSeen.current = latest.id;
    // Si se está leyendo otra pestaña o más arriba no pasa nada: solo afecta al contador.
    await markChatRead(channel.id).catch(() => {});
    onRead();
  }, [channel.id, onRead]);

  // Al apuntarse a una ayuda se ve al momento; el siguiente repaso del chat trae lo de los demás.
  const updateHelp = useCallback((messageId, card) => {
    setMessages((current) => current?.map((item) => (item.id === messageId ? { ...item, help: card } : item)));
  }, []);

  const replaceLatest = useCallback((page) => {
    setMessages((current) => {
      // Lo que ya se había cargado de antes se conserva; la última página manda (también en lo borrado).
      const start = page.messages[0]?.created_at;
      const older = olderLoaded.current && start ? (current ?? []).filter((item) => item.created_at < start) : [];
      return [...older, ...page.messages];
    });
    if (!olderLoaded.current) setHasMore(page.has_more);
    markLatestRead(page.messages.at(-1));
  }, [markLatestRead]);

  const poll = useCallback(async () => {
    const changesBefore = changes.current;
    try {
      const page = await listChatMessages(channel.id);
      // Si mientras tanto has enviado o borrado algo, esta respuesta ya está desfasada.
      if (changesBefore !== changes.current) return;
      replaceLatest(page);
      setTyping(page.typing);
      setError("");
    } catch (requestError) {
      handleError(requestError);
    }
  }, [channel.id, handleError, replaceLatest]);

  usePolling(poll, MESSAGES_POLL_MS);

  const onScroll = () => {
    const list = listRef.current;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
  };

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (restoreFrom.current !== null) {
      // Al cargar mensajes anteriores, lo que estabas leyendo se queda en su sitio.
      list.scrollTop = list.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (stickToBottom.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  const loadOlder = async () => {
    setLoadingOlder(true);
    setError("");
    try {
      const page = await listChatMessages(channel.id, messages[0].id);
      olderLoaded.current = true;
      restoreFrom.current = listRef.current.scrollHeight - listRef.current.scrollTop;
      stickToBottom.current = false;
      setMessages((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...page.messages.filter((item) => !known.has(item.id)), ...current];
      });
      setHasMore(page.has_more);
    } catch (requestError) {
      // El primero que se veía se ha borrado mientras tanto: se vuelve a pedir desde el final.
      if (requestError.status === 404) poll();
      else handleError(requestError);
    } finally {
      setLoadingOlder(false);
    }
  };

  // La vista previa usa una dirección temporal que hay que soltar al cambiarla o al salir.
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.preview);
  }, [photo]);

  const choosePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // Así se puede volver a elegir la misma foto.
    if (!file) return;
    setPreparing(true);
    setError("");
    try {
      const prepared = await prepareChatImage(file);
      setPhoto({ ...prepared, preview: URL.createObjectURL(prepared.blob) });
    } catch (prepareError) {
      setError(prepareError.message);
    } finally {
      setPreparing(false);
    }
  };

  const send = async (event) => {
    event?.preventDefault();
    const clean = text.trim();
    if ((!clean && !photo) || sending) return;
    setSending(true);
    setError("");
    try {
      const sent = photo ? await sendChatImage(channel.id, photo, clean) : await sendChatMessage(channel.id, clean);
      changes.current += 1;
      lastTypingPing.current = 0; // El servidor ya lo ha quitado al recibir el mensaje.
      setText("");
      setPhoto(null);
      stickToBottom.current = true;
      setMessages((current) => (current?.some((item) => item.id === sent.id) ? current : [...(current ?? []), sent]));
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const remove = async (message) => {
    if (!window.confirm("¿Borrar este mensaje? Desaparecerá para todos.")) return;
    setError("");
    try {
      await deleteChatMessage(message.id);
      changes.current += 1;
      setMessages((current) => current.filter((item) => item.id !== message.id));
    } catch (requestError) {
      if (requestError.status === 404) setMessages((current) => current.filter((item) => item.id !== message.id));
      else handleError(requestError);
    }
  };

  const onKeyDown = (event) => {
    // En el móvil, Intro hace un salto de línea y se envía con el botón.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
      event.preventDefault();
      send();
    }
  };

  return (
    <section
      aria-label={`Chat ${channel.label}`}
      style={viewport ? { "--chat-top": `${viewport.top}px`, "--chat-height": `${viewport.height}px` } : undefined}
      className="fixed inset-x-0 top-[var(--chat-top,0px)] z-50 flex h-[var(--chat-height,100dvh)] min-w-0 flex-col overflow-hidden bg-void md:static md:h-auto md:min-h-0 md:flex-1 md:rounded-3xl md:ring-1 md:ring-white/10"
    >
      <header className="relative flex min-h-16 shrink-0 items-center gap-2 bg-tnt px-2 pt-[env(safe-area-inset-top)] md:px-4 md:pt-0 text-onbrand">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver a los chats"
          className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 md:hidden"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <span aria-hidden="true" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
          <channel.Icon className="h-5 w-5 text-tnt" />
        </span>
        <div className="relative min-w-0 flex-1 pl-1">
          <h2 className="truncate font-display text-xl font-extrabold leading-tight">{channel.label}</h2>
          <p aria-live="polite" className="truncate text-xs font-semibold text-white/90 empty:hidden">{typingLabel(typing)}</p>
        </div>
      </header>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] px-3 py-2 [background-size:18px_18px]"
        data-lenis-prevent
      >
        {!messages && !error && <p role="status" className="p-2 text-zinc-300">Cargando…</p>}
        {messages?.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-400">Todavía no hay mensajes. Escribe el primero.</p>
        )}
        {hasMore && messages?.length > 0 && (
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-semibold hover:bg-white/5 disabled:opacity-60"
            >
              {loadingOlder ? "Cargando…" : "Ver mensajes anteriores"}
            </button>
          </div>
        )}
        <ol aria-live="polite" aria-relevant="additions">
          {messages?.map((message, index) => {
            const previous = messages[index - 1];
            const newDay = !previous || dayKey(previous.created_at) !== dayKey(message.created_at);
            const grouped = !newDay && previous.author === message.author && previous.mine === message.mine;
            return (
              <Fragment key={message.id}>
                {newDay && (
                  <li className="mt-4 flex items-center gap-3 first:mt-1">
                    <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
                    <span className="font-display text-xs font-extrabold text-ember">{dayLabel(message.created_at)}</span>
                    <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
                  </li>
                )}
                <Message message={message} grouped={grouped} onDelete={remove} onOpenImage={setViewing} onHelpChange={updateHelp} onAccessLost={onAccessLost} />
              </Fragment>
            );
          })}
        </ol>
      </div>

      {error && <Notice tone="error" className="mx-3 mb-2">{error}</Notice>}

      {photo && (
        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-panel px-3 pt-2">
          <img src={photo.preview} alt="Foto que vas a enviar" className="h-20 w-20 rounded-lg object-cover" />
          <p className="flex-1 text-sm text-zinc-300">Escribe un texto si quieres y pulsa enviar.</p>
          <button
            type="button"
            onClick={() => setPhoto(null)}
            aria-label="Quitar la foto"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      )}

      <form onSubmit={send} className="flex shrink-0 items-end gap-2 border-t border-white/10 bg-panel p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-2">
        <input ref={fileRef} type="file" accept="image/*" onChange={choosePhoto} className="hidden" tabIndex={-1} aria-hidden="true" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={preparing || sending}
          aria-label={preparing ? "Preparando la foto…" : "Adjuntar una foto"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <ImagePlus aria-hidden="true" className={`h-5 w-5 ${preparing ? "animate-pulse" : ""}`} />
        </button>
        <label htmlFor="chat-message" className="sr-only">Mensaje para {channel.label}</label>
        <textarea
          id="chat-message"
          ref={inputRef}
          value={text}
          onChange={(event) => changeText(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MAX_LENGTH}
          placeholder={photo ? "Añade un texto (opcional)" : "Escribe un mensaje"}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-white/15 bg-void px-4 py-2.5 text-base [field-sizing:content] placeholder:text-zinc-500 focus:border-tnt focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || preparing || (!text.trim() && !photo)}
          onMouseDown={(event) => event.preventDefault()}
          aria-label="Enviar mensaje"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tnt text-onbrand disabled:opacity-40"
        >
          <SendHorizontal aria-hidden="true" className="h-5 w-5" />
        </button>
      </form>

      {viewing && <ImageViewer image={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
