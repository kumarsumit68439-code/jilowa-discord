import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { socketUserFromToken, type AuthUser } from '../lib/auth.js';
import { assertChannelAccess } from '../middleware/rbac.js';

type AuthedSocket = Socket & { user: AuthUser };

const online = new Map<string, Set<string>>();

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      (socket.handshake.headers.authorization?.replace('Bearer ', '') as string | undefined);
    const user = socketUserFromToken(token);
    if (!user) {
      next(new Error('Unauthorized'));
      return;
    }
    (socket as AuthedSocket).user = user;
    next();
  });

  io.on('connection', async (raw) => {
    const socket = raw as AuthedSocket;
    const userId = socket.user.id;

    if (!online.has(userId)) online.set(userId, new Set());
    online.get(userId)!.add(socket.id);

    await prisma.user.update({ where: { id: userId }, data: { status: 'ONLINE' } });
    io.emit('presence:update', { userId, status: 'ONLINE' });

    const memberships = await prisma.serverMember.findMany({
      where: { userId },
      select: { serverId: true },
    });
    for (const m of memberships) {
      socket.join(`server:${m.serverId}`);
    }

    socket.on('channel:join', async (channelId: string, cb?: (r: { ok: boolean }) => void) => {
      const ok = await assertChannelAccess(userId, channelId);
      if (!ok) {
        cb?.({ ok: false });
        return;
      }
      socket.join(`channel:${channelId}`);
      cb?.({ ok: true });
    });

    socket.on('channel:leave', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('typing:start', async (payload: { channelId: string }) => {
      if (!(await assertChannelAccess(userId, payload.channelId))) return;
      socket.to(`channel:${payload.channelId}`).emit('typing:start', {
        channelId: payload.channelId,
        userId,
        username: socket.user.username,
      });
    });

    socket.on('typing:stop', async (payload: { channelId: string }) => {
      if (!(await assertChannelAccess(userId, payload.channelId))) return;
      socket.to(`channel:${payload.channelId}`).emit('typing:stop', {
        channelId: payload.channelId,
        userId,
      });
    });

    socket.on(
      'message:create',
      async (
        payload: { channelId: string; content: string },
        cb?: (r: { ok: boolean; message?: unknown; error?: string }) => void
      ) => {
        try {
          if (!(await assertChannelAccess(userId, payload.channelId))) {
            cb?.({ ok: false, error: 'Forbidden' });
            return;
          }
          if (!payload.content?.trim()) {
            cb?.({ ok: false, error: 'Empty' });
            return;
          }
          const message = await prisma.message.create({
            data: {
              channelId: payload.channelId,
              authorId: userId,
              content: payload.content.trim().slice(0, 4000),
            },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  discriminator: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              attachments: true,
              reactions: true,
            },
          });
          io.to(`channel:${payload.channelId}`).emit('message:create', message);
          cb?.({ ok: true, message });
        } catch (e) {
          cb?.({ ok: false, error: e instanceof Error ? e.message : 'Error' });
        }
      }
    );

    socket.on(
      'voice:join',
      async (
        payload: { channelId: string },
        cb?: (r: { ok: boolean; peers?: string[] }) => void
      ) => {
        if (!(await assertChannelAccess(userId, payload.channelId))) {
          cb?.({ ok: false });
          return;
        }
        const channel = await prisma.channel.findUnique({ where: { id: payload.channelId } });
        if (!channel || channel.type !== 'VOICE') {
          cb?.({ ok: false });
          return;
        }
        await prisma.voiceState.upsert({
          where: {
            channelId_userId: { channelId: payload.channelId, userId },
          },
          create: { channelId: payload.channelId, userId },
          update: {},
        });
        socket.join(`voice:${payload.channelId}`);
        const peers = await prisma.voiceState.findMany({
          where: { channelId: payload.channelId },
          select: { userId: true },
        });
        const peerIds: string[] = peers.map((p: { userId: string }) => p.userId);
        io.to(`server:${channel.serverId}`).emit('voice:state', {
          channelId: payload.channelId,
          users: peerIds,
        });
        socket.to(`voice:${payload.channelId}`).emit('voice:user-joined', {
          userId,
          channelId: payload.channelId,
        });
        cb?.({ ok: true, peers: peerIds });
      }
    );

    socket.on('voice:leave', async (payload: { channelId: string }) => {
      await prisma.voiceState.deleteMany({
        where: { channelId: payload.channelId, userId },
      });
      socket.leave(`voice:${payload.channelId}`);
      const channel = await prisma.channel.findUnique({ where: { id: payload.channelId } });
      if (channel) {
        const peers = await prisma.voiceState.findMany({
          where: { channelId: payload.channelId },
          select: { userId: true },
        });
        const peerIds: string[] = peers.map((p: { userId: string }) => p.userId);
        io.to(`server:${channel.serverId}`).emit('voice:state', {
          channelId: payload.channelId,
          users: peerIds,
        });
      }
      socket.to(`voice:${payload.channelId}`).emit('voice:user-left', {
        userId,
        channelId: payload.channelId,
      });
    });

    socket.on('webrtc:signal', (payload: { toUserId: string; data: unknown }) => {
      const targets = online.get(payload.toUserId);
      if (!targets) return;
      for (const sid of targets) {
        io.to(sid).emit('webrtc:signal', { fromUserId: userId, data: payload.data });
      }
    });

    socket.on('disconnect', async () => {
      const set = online.get(userId);
      set?.delete(socket.id);
      if (set && set.size === 0) {
        online.delete(userId);
        await prisma.user.update({ where: { id: userId }, data: { status: 'OFFLINE' } });
        await prisma.voiceState.deleteMany({ where: { userId } });
        io.emit('presence:update', { userId, status: 'OFFLINE' });
      }
    });
  });

  return io;
}
