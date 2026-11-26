import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMediaQuery } from "@/app/useMediaQuery.js";
import { Heart, Megaphone, MessagesSquare, Volleyball } from "lucide-react";
import { listChatChannels } from "@/app/api.js";
import ChatConversation from "@/app/components/ChatConversation.jsx";
import usePolling from "@/app/usePolling.js";
import { Notice, PageHeader } from "@/app/ui/index.js";

const CHANNELS_POLL_MS = 15000;

const channelLabel = (channel) => channel.name.replace(/^Club /, "");

const channelIcon = (channel) => ({ general: Megaphone, familia: Heart })[channel.id] ?? Volleyball;

function lastMessageTime(iso) {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return date.toLocaleString("es-ES", isToday ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
}

// Los chats en filas dentro de un solo bloque (Premium deportivo, compacto). El elegido, con la manera de cada
// identidad (ui-selected); lo que está sin leer, en negrita y con el contador del club.
function ChannelList({ channels, selectedId, onSelect }) {
  return (
    <ul className="ui-card divide-y divide-line overflow-hidden rounded-card bg-card">
      {channels.map((channel) => {
        const Icon = channelIcon(channel);
        const selected = channel.id === selectedId;
        const unread = channel.unread > 0;
        return (
          <li key={channel.id}>
            <button
              type="button"
              onClick={() => onSelect(channel.id)}
              aria-current={selected ? "true" : undefined}
              className={`relative flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rotta-text ${
                selected ? "bg-club-soft" : "hover:bg-raised"
              }`}
            >
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-club text-on-club">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-title text-base leading-tight text-ink">{channelLabel(channel)}</span>
                  {channel.last_message && (
                    <span className={`shrink-0 text-xs font-semibold ${unread ? "text-club-ui" : "text-ink-muted"}`}>{lastMessageTime(channel.last_message.created_at)}</span>
                  )}
                </span>
                <span className={`mt-0.5 block truncate text-sm ${unread ? "font-semibold text-ink" : "text-ink-muted"}`}>
                  {channel.last_message ? `${channel.last_message.author}: ${channel.last_message.text}` : "Sin mensajes todavía"}
                </span>
              </span>
              {unread && (
                <span className="ui-count flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-club px-1.5 text-xs font-bold text-on-club">
                  <span className="sr-only">Sin leer: </span>
                  {channel.unread >= 100 ? "99+" : channel.unread}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function ChatPage({ onAccessLost }) {
  // En el móvil, «X mensajes sin leer» no hace falta: cada chat ya lleva su número.
  const phone = useMediaQuery("(max-width: 767px)");
  const [channels, setChannels] = useState(null);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("canal");
  const selected = channels?.find((channel) => channel.id === requestedId) ?? null;
  const totalUnread = channels?.reduce((total, channel) => total + channel.unread, 0) ?? 0;

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401 || requestError.status === 403) {
      onAccessLost();
      return;
    }
    setError(requestError.message);
  }, [onAccessLost]);

  const loadChannels = useCallback(async () => {
    try {
      setChannels(await listChatChannels());
      setError("");
    } catch (requestError) {
      handleError(requestError);
    }
  }, [handleError]);

  usePolling(loadChannels, CHANNELS_POLL_MS);

  const select = useCallback((id) => setSearchParams(id ? { canal: id } : {}), [setSearchParams]);
  const back = useCallback(() => select(null), [select]);

  // Si te cambian de equipo, ese chat deja de estar en tu lista: se vuelve a la lista.
  useEffect(() => {
    if (channels && requestedId && !selected) select(null);
  }, [channels, requestedId, selected, select]);

  // Lo que queda fuera son los márgenes de la app, para que solo se desplacen los mensajes.
  return (
    <div className="flex h-full flex-col gap-3 md:h-[calc(100dvh-4.5rem)]">
      <div className={`shrink-0 ${selected ? "hidden md:block" : ""}`}>
        <PageHeader title="Chat" subtitle={phone ? undefined : totalUnread > 0 ? (totalUnread === 1 ? "1 mensaje sin leer" : `${totalUnread} mensajes sin leer`) : "Todo leído"} />
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {!error && !channels && <p role="status" className="text-ink-muted">Cargando…</p>}

      {channels && (
        <div className="flex min-h-0 flex-1 gap-4">
          <section aria-label="Chats" className={`min-h-0 overflow-y-auto md:block md:w-80 md:shrink-0 ${selected ? "hidden" : "w-full"}`}>
            <ChannelList channels={channels} selectedId={selected?.id} onSelect={select} />
          </section>

          {selected ? (
            <ChatConversation
              key={selected.id}
              channel={{ ...selected, label: channelLabel(selected), Icon: channelIcon(selected) }}
              onBack={back}
              onRead={loadChannels}
              onAccessLost={onAccessLost}
            />
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center gap-3 rounded-card bg-raised md:flex">
              <MessagesSquare aria-hidden="true" className="h-12 w-12 text-club-ui" />
              <p className="font-title text-xl text-ink">Elige un chat</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
