'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, MessageSquare } from 'lucide-react';
import { friendsApi, dmsApi, type FriendsPayload, type DmChannel } from '@/lib/api';
import { initials } from '@/lib/utils';

export default function MePage() {
  const router = useRouter();
  const [friends, setFriends] = useState<FriendsPayload | null>(null);
  const [dms, setDms] = useState<DmChannel[]>([]);
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'online' | 'pending' | 'add'>('online');

  async function refresh() {
    const [f, d] = await Promise.all([friendsApi.list(), dmsApi.list()]);
    setFriends(f);
    setDms(d);
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  async function addFriend(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await friendsApi.request({ tag });
      setTag('');
      await refresh();
      setTab('pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function openDm(userId: string) {
    const ch = await dmsApi.open(userId);
    router.push(`/channels/@me/${ch.id}`);
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* DM sidebar */}
      <div className="flex w-60 shrink-0 flex-col bg-discord-channel">
        <div className="p-2">
          <input
            placeholder="Find or start a conversation"
            className="w-full rounded bg-discord-darkest px-2 py-1.5 text-sm text-white placeholder:text-discord-muted"
            readOnly
          />
        </div>
        <div className="px-2 text-xs font-bold uppercase text-discord-muted">Direct Messages</div>
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {dms.map((d) => {
            const other = d.participants[0];
            if (!other) return null;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => router.push(`/channels/@me/${d.id}`)}
                className="mb-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-discord-muted hover:bg-discord-hover hover:text-white"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-blurple text-xs text-white">
                  {initials(other.displayName || other.username)}
                </div>
                <span className="truncate text-sm">{other.displayName || other.username}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Friends main */}
      <div className="flex min-w-0 flex-1 flex-col bg-discord-bg">
        <header className="flex h-12 items-center gap-4 border-b border-black/20 px-4">
          <UserPlus className="h-5 w-5 text-discord-muted" />
          <span className="font-semibold text-white">Friends</span>
          <div className="h-6 w-px bg-discord-active" />
          {(['online', 'pending', 'add'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-2 py-1 text-sm capitalize ${
                tab === t ? 'bg-discord-active text-white' : 'text-discord-muted hover:text-white'
              }`}
            >
              {t === 'add' ? 'Add Friend' : t}
            </button>
          ))}
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'add' && (
            <form onSubmit={addFriend} className="max-w-lg">
              <h2 className="text-lg font-bold text-white">Add Friend</h2>
              <p className="mt-1 text-sm text-discord-muted">
                Enter a username#0000 tag.
              </p>
              {error && <p className="mt-2 text-sm text-discord-red">{error}</p>}
              <div className="mt-4 flex gap-2">
                <input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Username#0000"
                  className="flex-1 rounded bg-discord-darkest px-3 py-2 text-white"
                />
                <button type="submit" className="rounded bg-discord-blurple px-4 py-2 text-sm text-white">
                  Send Request
                </button>
              </div>
            </form>
          )}

          {tab === 'online' &&
            (friends?.friends || []).map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between border-b border-white/5 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-discord-blurple text-sm text-white">
                    {initials(f.user.displayName || f.user.username)}
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {f.user.displayName || f.user.username}
                    </div>
                    <div className="text-xs text-discord-muted">
                      {f.user.username}#{f.user.discriminator}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openDm(f.user.id)}
                  className="rounded-full bg-discord-darkest p-2 text-discord-muted hover:text-white"
                  title="Message"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              </div>
            ))}

          {tab === 'pending' && (
            <>
              <h3 className="mb-2 text-xs font-bold uppercase text-discord-muted">Incoming</h3>
              {(friends?.incoming || []).map((f) => (
                <div key={f.id} className="mb-2 flex items-center justify-between">
                  <span className="text-white">
                    {f.user.username}#{f.user.discriminator}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await friendsApi.accept(f.id);
                        refresh();
                      }}
                      className="rounded bg-discord-green px-3 py-1 text-sm text-white"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await friendsApi.decline(f.id);
                        refresh();
                      }}
                      className="rounded bg-discord-active px-3 py-1 text-sm text-white"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              ))}
              <h3 className="mb-2 mt-4 text-xs font-bold uppercase text-discord-muted">Outgoing</h3>
              {(friends?.outgoing || []).map((f) => (
                <div key={f.id} className="text-discord-muted">
                  {f.user.username}#{f.user.discriminator}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
