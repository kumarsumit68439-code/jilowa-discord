'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { serversApi, type ServerDetail } from '@/lib/api';
import { ChannelSidebar } from '@/components/ChannelSidebar';
import { MemberList } from '@/components/MemberList';
import { InviteModal } from '@/components/Modals';
import { useApp } from '@/store/app';

export default function ServerHomePage() {
  const { serverId } = useParams<{ serverId: string }>();
  const router = useRouter();
  const [server, setServer] = useState<ServerDetail | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const setActiveServer = useApp((s) => s.setActiveServer);

  useEffect(() => {
    serversApi
      .get(serverId)
      .then((s) => {
        setServer(s);
        setActiveServer(s);
        const firstText = s.channels?.find((c) => c.type === 'TEXT');
        if (firstText) router.replace(`/channels/${serverId}/${firstText.id}`);
      })
      .catch(console.error);
  }, [serverId, router, setActiveServer]);

  if (!server) {
    return (
      <div className="flex flex-1 items-center justify-center text-discord-muted">Loading server…</div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <ChannelSidebar
        server={server}
        activeChannelId={null}
        onCreateChannel={async () => {
          const name = prompt('Channel name');
          if (!name) return;
          await serversApi.createChannel(serverId, { name, type: 'TEXT' });
          const s = await serversApi.get(serverId);
          setServer(s);
        }}
        onInvite={async () => {
          const inv = await serversApi.createInvite(serverId);
          setInviteCode(inv.code);
          setInviteOpen(true);
        }}
      />
      <div className="flex flex-1 items-center justify-center text-discord-muted">
        Select a channel
      </div>
      <MemberList server={server} />
      <InviteModal open={inviteOpen} code={inviteCode} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
