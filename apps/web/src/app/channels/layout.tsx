'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { useApp } from '@/store/app';
import { serversApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { ServerRail } from '@/components/ServerRail';
import { CreateServerModal, JoinServerModal } from '@/components/Modals';

export default function ChannelsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { user, loading, hydrate, logout } = useAuth();
  const { servers, setServers, setPresence, setVoiceUsers } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    serversApi.list().then(setServers).catch(console.error);
  }, [user, setServers]);

  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;
    const onPresence = (p: { userId: string; status: string }) => setPresence(p.userId, p.status);
    const onVoice = (p: { channelId: string; users: string[] }) => setVoiceUsers(p.channelId, p.users);
    sock.on('presence:update', onPresence);
    sock.on('voice:state', onVoice);
    return () => {
      sock.off('presence:update', onPresence);
      sock.off('voice:state', onVoice);
    };
  }, [user, setPresence, setVoiceUsers]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center bg-discord-darkest text-discord-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <ServerRail
        servers={servers}
        onCreate={() => setCreateOpen(true)}
        onJoin={() => setJoinOpen(true)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {children}
        <div className="flex h-12 items-center gap-2 border-t border-black/20 bg-discord-channel px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-blurple text-xs font-bold text-white">
            {(user.displayName || user.username).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">
              {user.displayName || user.username}
            </div>
            <div className="truncate text-xs text-discord-muted">
              {user.username}#{user.discriminator}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="rounded px-2 py-1 text-xs text-discord-muted hover:bg-discord-hover hover:text-white"
          >
            Log out
          </button>
        </div>
      </div>

      <CreateServerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (id) => {
          const list = await serversApi.list();
          setServers(list);
          router.push(`/channels/${id}`);
        }}
      />
      <JoinServerModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={async (id) => {
          const list = await serversApi.list();
          setServers(list);
          router.push(`/channels/${id}`);
        }}
      />
    </div>
  );
}
