'use client';

import { useEffect, useRef, useState } from 'react';
import { Hash, Send } from 'lucide-react';
import { messagesApi, type Message, type Channel } from '@/lib/api';
import { useApp } from '@/store/app';
import { getSocket } from '@/lib/socket';
import { initials } from '@/lib/utils';

export function ChatArea({ channel }: { channel: Channel }) {
  const {
    messages,
    setMessages,
    addMessage,
    typing,
    setTyping,
  } = useApp();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { messages: list } = await messagesApi.list(channel.id);
      if (!cancelled) setMessages(list);
      const sock = getSocket();
      sock?.emit('channel:join', channel.id);
    })();
    return () => {
      cancelled = true;
      getSocket()?.emit('channel:leave', channel.id);
    };
  }, [channel.id, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;

    const onCreate = (m: Message) => {
      if (m.channelId === channel.id || (m as Message & { channelId?: string }).channelId === channel.id) {
        addMessage(m);
      } else if (!m.channelId) {
        // socket payload may include channel via room only — still add if we're in room
        addMessage({ ...m, channelId: channel.id });
      }
    };
    const onTypingStart = (p: { channelId: string; userId: string; username: string }) => {
      if (p.channelId === channel.id) setTyping(p.channelId, p.userId, p.username, true);
    };
    const onTypingStop = (p: { channelId: string; userId: string }) => {
      if (p.channelId === channel.id) setTyping(p.channelId, p.userId, '', false);
    };

    sock.on('message:create', onCreate);
    sock.on('typing:start', onTypingStart);
    sock.on('typing:stop', onTypingStop);
    return () => {
      sock.off('message:create', onCreate);
      sock.off('typing:start', onTypingStart);
      sock.off('typing:stop', onTypingStop);
    };
  }, [channel.id, addMessage, setTyping]);

  function emitTyping() {
    const sock = getSocket();
    sock?.emit('typing:start', { channelId: channel.id });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      sock?.emit('typing:stop', { channelId: channel.id });
    }, 2000);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      // Prefer socket for real-time; fallback REST
      const sock = getSocket();
      if (sock?.connected) {
        sock.emit(
          'message:create',
          { channelId: channel.id, content },
          (r: { ok: boolean; message?: Message }) => {
            if (r?.ok && r.message) addMessage(r.message);
          }
        );
      } else {
        const m = await messagesApi.send(channel.id, content);
        addMessage(m);
      }
      getSocket()?.emit('typing:stop', { channelId: channel.id });
    } finally {
      setSending(false);
    }
  }

  const typingUsers = (typing[channel.id] || []).filter(Boolean);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-discord-bg">
      <header className="flex h-12 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
        <Hash className="h-5 w-5 text-discord-muted" />
        <span className="font-semibold text-white">{channel.name}</span>
        {channel.topic && (
          <>
            <span className="text-discord-muted">|</span>
            <span className="truncate text-sm text-discord-muted">{channel.topic}</span>
          </>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div key={m.id} className="group flex gap-3 hover:bg-black/5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-discord-blurple text-sm font-semibold text-white">
              {initials(m.author.displayName || m.author.username)}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-white">
                  {m.author.displayName || m.author.username}
                </span>
                <span className="text-xs text-discord-muted">
                  {new Date(m.createdAt).toLocaleString()}
                  {m.editedAt ? ' (edited)' : ''}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-[15px] text-discord-text">
                {m.content}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 text-xs text-discord-muted">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
        </div>
      )}

      <form onSubmit={send} className="p-4 pt-2">
        <div className="flex items-center gap-2 rounded-lg bg-discord-active px-4 py-2.5">
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              emitTyping();
            }}
            placeholder={`Message #${channel.name}`}
            className="flex-1 bg-transparent text-[15px] text-discord-text placeholder:text-discord-muted"
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="text-discord-muted hover:text-white disabled:opacity-40"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
