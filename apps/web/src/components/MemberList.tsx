'use client';

import type { ServerDetail } from '@/lib/api';
import { useApp } from '@/store/app';
import { cn, initials } from '@/lib/utils';

export function MemberList({ server }: { server: ServerDetail }) {
  const presence = useApp((s) => s.presence);
  const members = server.members || [];

  const online = members.filter((m) => {
    const st = presence[m.user.id] || m.user.status || 'OFFLINE';
    return st !== 'OFFLINE';
  });
  const offline = members.filter((m) => {
    const st = presence[m.user.id] || m.user.status || 'OFFLINE';
    return st === 'OFFLINE';
  });

  return (
    <aside className="hidden w-60 shrink-0 overflow-y-auto bg-discord-channel px-2 py-4 lg:block">
      {online.length > 0 && (
        <>
          <h3 className="mb-2 px-2 text-xs font-bold uppercase text-discord-muted">
            Online — {online.length}
          </h3>
          {online.map((m) => (
            <MemberRow
              key={m.id}
              name={m.user.displayName || m.user.username}
              status={presence[m.user.id] || m.user.status || 'ONLINE'}
              color={m.roles[0]?.role.color}
            />
          ))}
        </>
      )}
      {offline.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 px-2 text-xs font-bold uppercase text-discord-muted">
            Offline — {offline.length}
          </h3>
          {offline.map((m) => (
            <MemberRow
              key={m.id}
              name={m.user.displayName || m.user.username}
              status="OFFLINE"
              color={m.roles[0]?.role.color}
            />
          ))}
        </>
      )}
    </aside>
  );
}

function MemberRow({
  name,
  status,
  color,
}: {
  name: string;
  status: string;
  color?: string;
}) {
  const dot =
    status === 'ONLINE'
      ? 'bg-discord-green'
      : status === 'IDLE'
        ? 'bg-yellow-500'
        : status === 'DND'
          ? 'bg-discord-red'
          : 'bg-gray-500';

  return (
    <div className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-discord-hover">
      <div className="relative">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-blurple text-xs font-semibold text-white">
          {initials(name)}
        </div>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-discord-channel',
            dot
          )}
        />
      </div>
      <span className="truncate text-sm" style={color ? { color } : undefined}>
        {name}
      </span>
    </div>
  );
}
