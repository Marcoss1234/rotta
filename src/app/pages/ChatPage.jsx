import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Heart, Megaphone, MessagesSquare, Volleyball } from "lucide-react";
import { RankingHero } from "@/app/components/RankingVisuals.jsx";
import { listChatChannels } from "@/app/api.js";
import ChatConversation from "@/app/components/ChatConversation.jsx";
import usePolling from "@/app/usePolling.js";
import { Notice } from "@/app/ui/index.js";

const CHANNELS_POLL_MS = 15000;

const channelLabel = (channel) => channel.name.replace(/^Club /, "");

const channelIcon = (channel) => ({ general: Megaphone, familia: Heart })[channel.id] ?? Volleyball;

function lastMessageTime(iso) {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return date.toLocaleString("es-ES", isToday ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
}

function ChannelList({ channels, selectedId, onSelect }) {
  return (
    <ul className="space-y-1.5">
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
              className={`relative flex min-h-[4.5rem] w-full items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-left transition-colors ${
                selected ? "bg-tnt/15 ring-2 ring-tnt" : "bg-panel ring-1 ring-white/10 hover:ring-white/25"
              }`}
            >
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tnt text-onbrand">
                <Icon className="h-5 w-5 text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-display text-base font-extrabold leading-tight">{channelLabel(channel)}</span>
                  {channel.last_message && (
                    <span className={`shrink-0 text-[11px] font-semibold ${unread ? "text-ember" : "text-zinc-500"}`}>{lastMessageTime(channel.last_message.created_at)}</span>
                  )}
                </span>
                <span className={`mt-0.5 block truncate text-[13px] ${unread ? "font-semibold text-white" : "text-zinc-400"}`}>
                  {channel.last_message ? `${channel.last_message.author}: ${channel.last_message.text}` : "Sin mensajes todavía"}
                </span>
              </span>
              {unread && (
                <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-tnt px-1.5 font-display text-xs font-extrabold text-onbrand">
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
        <RankingHero title="Chat" subtitle={totalUnread > 0 ? (totalUnread === 1 ? "1 mensaje sin leer" : `${totalUnread} mensajes sin leer`) : "Todo leído"} />
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {!error && !channels && <p role="status" className="text-zinc-300">Cargando…</p>}

      {channels && (
        <div className="flex min-h-0 flex-1 gap-4">
          <section aria-label="Chats" className={`min-h-0 overflow-y-auto md:block md:w-72 md:shrink-0 ${selected ? "hidden" : "w-full"}`}>
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
            <div className="hidden flex-1 flex-col items-center justify-center gap-3 rounded-2xl ring-1 ring-white/10 bg-panel md:flex">
              <MessagesSquare aria-hidden="true" className="h-12 w-12 text-tnt" />
              <p className="font-display text-2xl font-extrabold">Elige un chat</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
