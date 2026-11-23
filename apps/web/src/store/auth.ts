'use client';

import { create } from 'zustand';
import { authApi, type User } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,
  setSession: (token, user) => {
    localStorage.setItem('token', token);
    connectSocket(token);
    set({ token, user, loading: false });
  },
  logout: () => {
    localStorage.removeItem('token');
    disconnectSocket();
    set({ token: null, user: null, loading: false });
  },
  hydrate: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const user = await authApi.me();
      connectSocket(token);
      set({ token, user, loading: false });
    } catch {
      localStorage.removeItem('token');
      set({ token: null, user: null, loading: false });
    }
  },
}));
