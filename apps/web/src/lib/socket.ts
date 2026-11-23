import { io, Socket } from 'socket.io-client';

const WS = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  socket?.disconnect();
  socket = io(WS, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
