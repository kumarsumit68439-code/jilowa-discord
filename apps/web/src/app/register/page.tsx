'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token, user } = await authApi.register({ email, password, username });
      setSession(token, user);
      router.push('/channels/@me');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Register failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#5865f2] p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-lg bg-discord-darkest p-8 shadow-xl"
      >
        <h1 className="text-center text-2xl font-bold text-white">Create an account</h1>

        {error && (
          <p className="mt-4 rounded bg-discord-red/20 px-3 py-2 text-sm text-discord-red">{error}</p>
        )}

        <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-discord-muted">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded bg-[#1e1f22] px-3 py-2.5 text-sm text-white"
        />

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-discord-muted">
          Username
        </label>
        <input
          required
          pattern="[a-zA-Z0-9_]{2,32}"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-2 w-full rounded bg-[#1e1f22] px-3 py-2.5 text-sm text-white"
          placeholder="letters, numbers, underscore"
        />

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-discord-muted">
          Password
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded bg-[#1e1f22] px-3 py-2.5 text-sm text-white"
        />

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded bg-discord-blurple py-2.5 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Continue'}
        </button>

        <p className="mt-4 text-sm text-discord-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-discord-link hover:underline">
            Log In
          </Link>
        </p>
      </form>
    </div>
  );
}
