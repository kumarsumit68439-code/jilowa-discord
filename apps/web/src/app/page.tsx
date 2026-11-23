'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';

export default function Home() {
  const router = useRouter();
  const { user, loading, hydrate } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/channels/@me' : '/login');
  }, [user, loading, router]);

  return (
    <div className="flex h-full items-center justify-center bg-discord-darkest text-discord-muted">
      Loading…
    </div>
  );
}
