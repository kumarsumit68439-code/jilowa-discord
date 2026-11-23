'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { serversApi, type ServerDetail, type Channel } from '@/lib/api';
import { ChannelSidebar } from '@/components/ChannelSidebar';
import { MemberList } from '@/components/MemberList';
import { ChatArea } from '@/components/ChatArea';
import { InviteModal } from '@/components/Modals';
import { useApp } from '@/store/app';
import { getSocket } from '@/lib/socket';

export default function ChannelPage() {
  const { serverId, channelId } = useParams<{ serverId: string; channelId: string }>();
  const [server, setServer] = useState<ServerDetail | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const setActiveServer = useApp((s) => s.setActiveServer);
  const setActiveChannelId = useApp((s) => s.setActiveChannelId);

  useEffect(() => {
    serversApi
      .get(serverId)
      .then((s) => {
        setServer(s);
        setActiveServer(s);
      })
      .catch(console.error);
    setActiveChannelId(channelId);
  }, [serverId, channelId, setActiveServer, setActiveChannelId]);

  const channel: Channel | undefined = server?.channels?.find((c) => c.id === channelId);

  async function joinVoice() {
    getSocket()?.emit('voice:join', { channelId }, () => {});
  }

  if (!server) {
    return (
      <div className="flex flex-1 items-center justify-center text-discord-muted">Loading…</div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <ChannelSidebar
        server={server}
        activeChannelId={channelId}
        onCreateChannel={async () => {
          const name = prompt('Channel name');
          if (!name) return;
          await serversApi.createChannel(serverId, { name, type: 'TEXT' });
          setServer(await serversApi.get(serverId));
        }}
        onInvite={async () => {
          const inv = await serversApi.createInvite(serverId);
          setInviteCode(inv.code);
          setInviteOpen(true);
        }}
      />
      {channel?.type === 'TEXT' ? (
        <ChatArea channel={channel} />
      ) : channel?.type === 'VOICE' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-discord-bg">
          <p className="text-discord-muted">Voice channel: {channel.name}</p>
          <button
            type="button"
            onClick={joinVoice}
            className="rounded bg-discord-green px-6 py-2 font-medium text-white"
          >
            Join Voice
          </button>
          <p className="max-w-sm text-center text-xs text-discord-muted">
            Voice state is stored in DB and broadcast via Socket.io. Wire LiveKit SDK here for actual audio.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-discord-muted">Channel not found</div>
      )}
      <MemberList server={server} />
      <InviteModal open={inviteOpen} code={inviteCode} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
