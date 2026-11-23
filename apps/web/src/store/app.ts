'use client';

import { create } from 'zustand';
import type { Server, ServerDetail, Message, Channel, User } from '@/lib/api';

type AppState = {
  servers: Server[];
  activeServer: ServerDetail | null;
  activeChannelId: string | null;
  messages: Message[];
  typing: Record<string, string[]>; // channelId -> usernames
  presence: Record<string, string>; // userId -> status
  voiceUsers: Record<string, string[]>; // channelId -> userIds
  setServers: (s: Server[]) => void;
  setActiveServer: (s: ServerDetail | null) => void;
  setActiveChannelId: (id: string | null) => void;
  setMessages: (m: Message[]) => void;
  addMessage: (m: Message) => void;
  updateMessage: (m: Message) => void;
  removeMessage: (id: string) => void;
  setTyping: (channelId: string, userId: string, username: string, on: boolean) => void;
  setPresence: (userId: string, status: string) => void;
  setVoiceUsers: (channelId: string, users: string[]) => void;
};

export const useApp = create<AppState>((set, get) => ({
  servers: [],
  activeServer: null,
  activeChannelId: null,
  messages: [],
  typing: {},
  presence: {},
  voiceUsers: {},
  setServers: (servers) => set({ servers }),
  setActiveServer: (activeServer) => set({ activeServer }),
  setActiveChannelId: (activeChannelId) => set({ activeChannelId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (m) => {
    if (get().messages.some((x) => x.id === m.id)) return;
    set({ messages: [...get().messages, m] });
  },
  updateMessage: (m) =>
    set({ messages: get().messages.map((x) => (x.id === m.id ? m : x)) }),
  removeMessage: (id) => set({ messages: get().messages.filter((x) => x.id !== id) }),
  setTyping: (channelId, userId, username, on) => {
    const cur = get().typing[channelId] || [];
    const next = on
      ? cur.includes(username)
        ? cur
        : [...cur, username]
      : cur.filter((u) => u !== username);
    set({ typing: { ...get().typing, [channelId]: next } });
  },
  setPresence: (userId, status) =>
    set({ presence: { ...get().presence, [userId]: status } }),
  setVoiceUsers: (channelId, users) =>
    set({ voiceUsers: { ...get().voiceUsers, [channelId]: users } }),
}));
