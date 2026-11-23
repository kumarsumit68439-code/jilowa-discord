'use client';

import { useState } from 'react';
import { serversApi } from '@/lib/api';

export function CreateServerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (serverId: string) => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const s = await serversApi.create({ name });
      onCreated(s.id);
      setName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-discord-bg p-6">
        <h2 className="text-xl font-bold text-white">Create a server</h2>
        <p className="mt-1 text-sm text-discord-muted">Your server is where you and your friends hang out.</p>
        {error && <p className="mt-2 text-sm text-discord-red">{error}</p>}
        <label className="mt-4 block text-xs font-bold uppercase text-discord-muted">Server name</label>
        <input
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full rounded bg-discord-darkest px-3 py-2 text-white"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-discord-blurple px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

export function JoinServerModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined: (serverId: string) => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await serversApi.join(code.trim());
      onJoined(r.serverId);
      setCode('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-discord-bg p-6">
        <h2 className="text-xl font-bold text-white">Join a server</h2>
        <p className="mt-1 text-sm text-discord-muted">Enter an invite code below.</p>
        {error && <p className="mt-2 text-sm text-discord-red">{error}</p>}
        <label className="mt-4 block text-xs font-bold uppercase text-discord-muted">Invite code</label>
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="abc123XY"
          className="mt-2 w-full rounded bg-discord-darkest px-3 py-2 text-white"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-discord-blurple px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Join Server
          </button>
        </div>
      </form>
    </div>
  );
}

export function InviteModal({
  open,
  code,
  onClose,
}: {
  open: boolean;
  code: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg bg-discord-bg p-6">
        <h2 className="text-xl font-bold text-white">Invite friends</h2>
        <p className="mt-2 text-sm text-discord-muted">Share this code:</p>
        <code className="mt-3 block rounded bg-discord-darkest px-4 py-3 text-lg text-discord-link">
          {code}
        </code>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded bg-discord-blurple py-2 text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}
