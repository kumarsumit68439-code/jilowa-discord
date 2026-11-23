import { Server } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { socketUserFromToken } from '../lib/auth.js';
import { assertChannelAccess } from '../middleware/rbac.js';
const online = new Map();
export function createSocketServer(httpServer, corsOrigin) {
    const io = new Server(httpServer, {
        cors: {
            origin: corsOrigin,
            credentials: true,
        },
        path: '/socket.io',
    });
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token ||
            socket.handshake.headers.authorization?.replace('Bearer ', '');
        const user = socketUserFromToken(token);
        if (!user) {
            next(new Error('Unauthorized'));
            return;
        }
        socket.user = user;
        next();
    });
    io.on('connection', async (raw) => {
        const socket = raw;
        const userId = socket.user.id;
        if (!online.has(userId))
            online.set(userId, new Set());
        online.get(userId).add(socket.id);
        await prisma.orm.public.User.where({ id: userId }).update({ status: 'ONLINE' });
        io.emit('presence:update', { userId, status: 'ONLINE' });
        const memberships = await prisma.orm.public.ServerMember
            .select('serverId')
            .where({ userId })
            .all();
        for (const m of memberships) {
            socket.join(`server:${m.serverId}`);
        }
        socket.on('channel:join', async (channelId, cb) => {
            const ok = await assertChannelAccess(userId, channelId);
            if (!ok) {
                cb?.({ ok: false });
                return;
            }
            socket.join(`channel:${channelId}`);
            cb?.({ ok: true });
        });
        socket.on('channel:leave', (channelId) => {
            socket.leave(`channel:${channelId}`);
        });
        socket.on('typing:start', async (payload) => {
            if (!(await assertChannelAccess(userId, payload.channelId)))
                return;
            socket.to(`channel:${payload.channelId}`).emit('typing:start', {
                channelId: payload.channelId,
                userId,
                username: socket.user.username,
            });
        });
        socket.on('typing:stop', async (payload) => {
            if (!(await assertChannelAccess(userId, payload.channelId)))
                return;
            socket.to(`channel:${payload.channelId}`).emit('typing:stop', {
                channelId: payload.channelId,
                userId,
            });
        });
        socket.on('message:create', async (payload, cb) => {
            try {
                if (!(await assertChannelAccess(userId, payload.channelId))) {
                    cb?.({ ok: false, error: 'Forbidden' });
                    return;
                }
                if (!payload.content?.trim()) {
                    cb?.({ ok: false, error: 'Empty' });
                    return;
                }
                const created = await prisma.orm.public.Message.create({
                    channelId: payload.channelId,
                    authorId: userId,
                    content: payload.content.trim().slice(0, 4000),
                });
                const message = await prisma.orm.public.Message
                    .where({ id: created.id })
                    .include('author', (a) => a.select('id', 'username', 'discriminator', 'displayName', 'avatarUrl'))
                    .include('attachments')
                    .include('reactions')
                    .first();
                io.to(`channel:${payload.channelId}`).emit('message:create', message);
                cb?.({ ok: true, message });
            }
            catch (e) {
                cb?.({ ok: false, error: e instanceof Error ? e.message : 'Error' });
            }
        });
        socket.on('voice:join', async (payload, cb) => {
            if (!(await assertChannelAccess(userId, payload.channelId))) {
                cb?.({ ok: false });
                return;
            }
            const channel = await prisma.orm.public.Channel.first({ id: payload.channelId });
            if (!channel || channel.type !== 'VOICE') {
                cb?.({ ok: false });
                return;
            }
            await prisma.orm.public.VoiceState.createAndCount([{ channelId: payload.channelId, userId }], { onConflict: 'skip', conflictOn: ['channelId', 'userId'] });
            socket.join(`voice:${payload.channelId}`);
            const peers = await prisma.orm.public.VoiceState
                .select('userId')
                .where({ channelId: payload.channelId })
                .all();
            const peerIds = peers.map((p) => p.userId);
            io.to(`server:${channel.serverId}`).emit('voice:state', {
                channelId: payload.channelId,
                users: peerIds,
            });
            socket.to(`voice:${payload.channelId}`).emit('voice:user-joined', {
                userId,
                channelId: payload.channelId,
            });
            cb?.({ ok: true, peers: peerIds });
        });
        socket.on('voice:leave', async (payload) => {
            await prisma.orm.public.VoiceState
                .where({ channelId: payload.channelId, userId })
                .deleteAll();
            socket.leave(`voice:${payload.channelId}`);
            const channel = await prisma.orm.public.Channel.first({ id: payload.channelId });
            if (channel) {
                const peers = await prisma.orm.public.VoiceState
                    .select('userId')
                    .where({ channelId: payload.channelId })
                    .all();
                const peerIds = peers.map((p) => p.userId);
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
        socket.on('webrtc:signal', (payload) => {
            const targets = online.get(payload.toUserId);
            if (!targets)
                return;
            for (const sid of targets) {
                io.to(sid).emit('webrtc:signal', { fromUserId: userId, data: payload.data });
            }
        });
        socket.on('disconnect', async () => {
            const set = online.get(userId);
            set?.delete(socket.id);
            if (set && set.size === 0) {
                online.delete(userId);
                await prisma.orm.public.User.where({ id: userId }).update({ status: 'OFFLINE' });
                await prisma.orm.public.VoiceState.where({ userId }).deleteAll();
                io.emit('presence:update', { userId, status: 'OFFLINE' });
            }
        });
    });
    return io;
}
