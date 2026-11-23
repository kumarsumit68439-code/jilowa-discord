'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { dmsApi, type Message, type User } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { initials } from '@/lib/utils';
import { Send } from 'lucide-react';

export default function DmChatPage() {
  const { dmId } = useParams<{ dmId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [peer, setPeer] = useState<User | null>(null);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const list = await dmsApi.list();
      const ch = list.find((d) => d.id === dmId);
      setPeer(ch?.participants[0] || null);
      const { messages: msgs } = await dmsApi.messages(dmId);
      setMessages(msgs);
    })().catch(console.error);
  }, [dmId]);

  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;
    const onDm = (p: { channelId: string; message: Message }) => {
      if (p.channelId === dmId) {
        setMessages((prev) =>
          prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]
        );
      }
    };
    sock.on('dm:message', onDm);
    return () => {
      sock.off('dm:message', onDm);
    };
  }, [dmId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText('');
    const m = await dmsApi.send(dmId, content);
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-discord-bg">
      <header className="flex h-12 items-center gap-2 border-b border-black/20 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-blurple text-xs text-white">
          {peer ? initials(peer.displayName || peer.username) : '?'}
        </div>
        <span className="font-semibold text-white">
          {peer ? peer.displayName || peer.username : 'DM'}
        </span>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div key={m.id} className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-discord-blurple text-sm text-white">
              {initials(m.author.displayName || m.author.username)}
            </div>
            <div>
              <div className="flex gap-2">
                <span className="font-medium text-white">
                  {m.author.displayName || m.author.username}
                </span>
                <span className="text-xs text-discord-muted">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-[15px] text-discord-text">{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="p-4">
        <div className="flex items-center gap-2 rounded-lg bg-discord-active px-4 py-2.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message @${peer?.username || 'user'}`}
            className="flex-1 bg-transparent text-discord-text placeholder:text-discord-muted"
          />
          <button type="submit" className="text-discord-muted hover:text-white">
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
