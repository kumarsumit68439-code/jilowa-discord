'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Compass, Home } from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import type { Server } from '@/lib/api';

export function ServerRail({
  servers,
  onCreate,
  onJoin,
}: {
  servers: Server[];
  onCreate: () => void;
  onJoin: () => void;
}) {
  const path = usePathname();

  return (
    <nav className="flex w-[72px] shrink-0 flex-col items-center gap-2 bg-discord-sidebar py-3">
      <Link
        href="/channels/@me"
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-[24px] bg-discord-bg text-white transition-all hover:rounded-[16px] hover:bg-discord-blurple',
          path.startsWith('/channels/@me') && 'rounded-[16px] bg-discord-blurple'
        )}
        title="Direct Messages"
      >
        <Home className="h-5 w-5" />
      </Link>

      <div className="my-1 h-0.5 w-8 rounded bg-discord-active" />

      <div className="flex max-h-[calc(100vh-160px)] flex-col gap-2 overflow-y-auto">
        {servers.map((s) => {
          const active = path.includes(s.id);
          return (
            <Link
              key={s.id}
              href={`/channels/${s.id}`}
              title={s.name}
              className={cn(
                'relative flex h-12 w-12 items-center justify-center rounded-[24px] bg-discord-bg text-sm font-semibold text-white transition-all hover:rounded-[16px] hover:bg-discord-blurple',
                active && 'rounded-[16px] bg-discord-blurple'
              )}
            >
              {active && (
                <span className="absolute -left-3 h-10 w-1 rounded-r bg-white" />
              )}
              {s.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.iconUrl} alt="" className="h-12 w-12 rounded-[inherit] object-cover" />
              ) : (
                initials(s.name)
              )}
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="mt-1 flex h-12 w-12 items-center justify-center rounded-[24px] bg-discord-bg text-discord-green transition-all hover:rounded-[16px] hover:bg-discord-green hover:text-white"
        title="Add a Server"
      >
        <Plus className="h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={onJoin}
        className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-discord-bg text-discord-green transition-all hover:rounded-[16px] hover:bg-discord-green hover:text-white"
        title="Join via Invite"
      >
        <Compass className="h-5 w-5" />
      </button>
    </nav>
  );
}
