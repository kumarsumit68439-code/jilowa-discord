'use client';

import Link from 'next/link';
import { Hash, Volume2, ChevronDown, Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ServerDetail, Channel } from '@/lib/api';
import { useApp } from '@/store/app';

export function ChannelSidebar({
  server,
  activeChannelId,
  onCreateChannel,
  onInvite,
}: {
  server: ServerDetail;
  activeChannelId: string | null;
  onCreateChannel: () => void;
  onInvite: () => void;
}) {
  const voiceUsers = useApp((s) => s.voiceUsers);
  const categories = server.categories || [];
  const channels = server.channels || [];

  const uncategorized = channels.filter((c) => !c.categoryId);
  const textUncat = uncategorized.filter((c) => c.type === 'TEXT');
  const voiceUncat = uncategorized.filter((c) => c.type === 'VOICE');

  return (
    <div className="flex w-60 shrink-0 flex-col bg-discord-channel">
      <button
        type="button"
        className="flex h-12 items-center justify-between border-b border-black/20 px-4 shadow-sm hover:bg-discord-hover"
      >
        <span className="truncate font-semibold text-white">{server.name}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-discord-muted" />
      </button>

      <div className="flex gap-1 px-2 py-2">
        <button
          type="button"
          onClick={onInvite}
          className="flex-1 rounded bg-discord-darkest px-2 py-1 text-xs text-discord-muted hover:text-white"
        >
          Invite
        </button>
        <button
          type="button"
          onClick={onCreateChannel}
          className="rounded bg-discord-darkest px-2 py-1 text-discord-muted hover:text-white"
          title="Create Channel"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {categories
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((cat) => {
            const catCh = channels
              .filter((c) => c.categoryId === cat.id)
              .sort((a, b) => a.position - b.position);
            return (
              <div key={cat.id} className="mt-4">
                <div className="mb-1 flex items-center gap-1 px-1 text-[11px] font-bold uppercase tracking-wide text-discord-muted">
                  <ChevronDown className="h-3 w-3" />
                  {cat.name}
                </div>
                {catCh.map((ch) => (
                  <ChannelRow
                    key={ch.id}
                    channel={ch}
                    serverId={server.id}
                    active={activeChannelId === ch.id}
                    voiceUserIds={voiceUsers[ch.id] || []}
                  />
                ))}
              </div>
            );
          })}

        {(textUncat.length > 0 || voiceUncat.length > 0) && (
          <div className="mt-4">
            {[...textUncat, ...voiceUncat]
              .sort((a, b) => a.position - b.position)
              .map((ch) => (
                <ChannelRow
                  key={ch.id}
                  channel={ch}
                  serverId={server.id}
                  active={activeChannelId === ch.id}
                  voiceUserIds={voiceUsers[ch.id] || []}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelRow({
  channel,
  serverId,
  active,
  voiceUserIds,
}: {
  channel: Channel;
  serverId: string;
  active: boolean;
  voiceUserIds: string[];
}) {
  const Icon = channel.type === 'VOICE' ? Volume2 : Hash;
  return (
    <div>
      <Link
        href={`/channels/${serverId}/${channel.id}`}
        className={cn(
          'group flex items-center gap-1.5 rounded px-2 py-1.5 text-discord-muted hover:bg-discord-hover hover:text-discord-text',
          active && 'bg-discord-active text-white'
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-70" />
        <span className="truncate text-sm">{channel.name}</span>
      </Link>
      {channel.type === 'VOICE' && voiceUserIds.length > 0 && (
        <div className="ml-6 text-xs text-discord-muted">
          {voiceUserIds.length} in voice
        </div>
      )}
    </div>
  );
}
