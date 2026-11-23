const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function token() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  }
  return data as T;
}

export const authApi = {
  register: (body: { email: string; password: string; username: string }) =>
    api<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    api<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () => api<User>('/api/auth/me'),
};

export const serversApi = {
  list: () => api<Server[]>('/api/servers'),
  get: (id: string) => api<ServerDetail>(`/api/servers/${id}`),
  create: (body: { name: string; iconUrl?: string }) =>
    api<Server>('/api/servers', { method: 'POST', body: JSON.stringify(body) }),
  createChannel: (serverId: string, body: { name: string; type?: 'TEXT' | 'VOICE'; categoryId?: string }) =>
    api(`/api/servers/${serverId}/channels`, { method: 'POST', body: JSON.stringify(body) }),
  createInvite: (serverId: string) =>
    api<{ code: string }>(`/api/servers/${serverId}/invites`, { method: 'POST', body: '{}' }),
  join: (code: string) =>
    api<{ serverId: string }>(`/api/servers/join/${code}`, { method: 'POST' }),
};

export const messagesApi = {
  list: (channelId: string, cursor?: string) =>
    api<{ messages: Message[]; nextCursor: string | null }>(
      `/api/messages/channels/${channelId}${cursor ? `?cursor=${cursor}` : ''}`
    ),
  send: (channelId: string, content: string) =>
    api<Message>(`/api/messages/channels/${channelId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  edit: (messageId: string, content: string) =>
    api<Message>(`/api/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),
  remove: (messageId: string) =>
    api(`/api/messages/${messageId}`, { method: 'DELETE' }),
  react: (messageId: string, emoji: string) =>
    api(`/api/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),
};

export const friendsApi = {
  list: () => api<FriendsPayload>('/api/friends'),
  request: (body: { userId?: string; tag?: string }) =>
    api('/api/friends/request', { method: 'POST', body: JSON.stringify(body) }),
  accept: (id: string) => api(`/api/friends/${id}/accept`, { method: 'POST' }),
  decline: (id: string) => api(`/api/friends/${id}/decline`, { method: 'POST' }),
};

export const dmsApi = {
  list: () => api<DmChannel[]>('/api/dms'),
  open: (userId: string) =>
    api<DmChannel>('/api/dms/open', { method: 'POST', body: JSON.stringify({ userId }) }),
  messages: (channelId: string, cursor?: string) =>
    api<{ messages: Message[]; nextCursor: string | null }>(
      `/api/dms/${channelId}/messages${cursor ? `?cursor=${cursor}` : ''}`
    ),
  send: (channelId: string, content: string) =>
    api<Message>(`/api/dms/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

export type User = {
  id: string;
  email?: string;
  username: string;
  discriminator: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  status?: string;
  tag?: string;
};

export type Server = {
  id: string;
  name: string;
  iconUrl?: string | null;
  ownerId: string;
  channels?: Channel[];
  categories?: Category[];
};

export type Channel = {
  id: string;
  serverId: string;
  categoryId?: string | null;
  name: string;
  type: 'TEXT' | 'VOICE';
  topic?: string | null;
  position: number;
};

export type Category = {
  id: string;
  serverId: string;
  name: string;
  position: number;
};

export type ServerDetail = Server & {
  roles: Role[];
  members: {
    id: string;
    user: User;
    roles: { role: Role }[];
  }[];
};

export type Role = {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: string;
  hoist: boolean;
};

export type Message = {
  id: string;
  channelId?: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  author: User;
  attachments?: { id: string; url: string; filename: string }[];
  reactions?: { id: string; emoji: string; userId: string }[];
};

export type FriendsPayload = {
  friends: { id: string; user: User }[];
  incoming: { id: string; user: User }[];
  outgoing: { id: string; user: User }[];
  blocked: { id: string; user: User }[];
};

export type DmChannel = {
  id: string;
  participants: User[];
  lastMessage?: Message | null;
};
