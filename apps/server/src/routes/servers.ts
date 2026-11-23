import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getUser, requireAuth } from '../lib/auth.js';
import { DEFAULT_EVERYONE, ADMIN_ALL, Permissions } from '../lib/permissions.js';
import { requireServerPermission } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const user = getUser(req);
  const memberships = await prisma.serverMember.findMany({
    where: { userId: user.id },
    include: {
      server: {
        include: {
          channels: { orderBy: { position: 'asc' } },
          categories: { orderBy: { position: 'asc' } },
        },
      },
    },
  });
  res.json(memberships.map((m) => m.server));
});

router.post('/', async (req, res) => {
  const user = getUser(req);
  const body = z
    .object({ name: z.string().min(2).max(100), iconUrl: z.string().url().optional() })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }

  const server = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const s = await tx.server.create({
      data: {
        name: body.data.name,
        iconUrl: body.data.iconUrl,
        ownerId: user.id,
      },
    });
    const everyone = await tx.role.create({
      data: {
        serverId: s.id,
        name: '@everyone',
        color: '#99AAB5',
        position: 0,
        permissions: DEFAULT_EVERYONE,
      },
    });
    await tx.role.create({
      data: {
        serverId: s.id,
        name: 'Admin',
        color: '#F23F43',
        position: 1,
        permissions: ADMIN_ALL,
        hoist: true,
      },
    });
    const member = await tx.serverMember.create({
      data: { serverId: s.id, userId: user.id },
    });
    await tx.memberRole.create({ data: { memberId: member.id, roleId: everyone.id } });
    const cat = await tx.category.create({
      data: { serverId: s.id, name: 'Text Channels', position: 0 },
    });
    await tx.channel.createMany({
      data: [
        { serverId: s.id, categoryId: cat.id, name: 'general', type: 'TEXT', position: 0 },
        { serverId: s.id, name: 'General', type: 'VOICE', position: 0 },
      ],
    });
    return tx.server.findUnique({
      where: { id: s.id },
      include: { channels: true, categories: true, roles: true },
    });
  });

  res.status(201).json(server);
});

router.get('/:serverId', async (req, res) => {
  const user = getUser(req);
  const member = await prisma.serverMember.findUnique({
    where: {
      serverId_userId: { serverId: req.params.serverId, userId: user.id },
    },
  });
  if (!member) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const server = await prisma.server.findUnique({
    where: { id: req.params.serverId },
    include: {
      channels: { orderBy: { position: 'asc' } },
      categories: { orderBy: { position: 'asc' } },
      roles: { orderBy: { position: 'desc' } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              discriminator: true,
              displayName: true,
              avatarUrl: true,
              status: true,
            },
          },
          roles: { include: { role: true } },
        },
      },
    },
  });
  res.json(server);
});

router.post(
  '/:serverId/channels',
  requireServerPermission(Permissions.MANAGE_CHANNELS),
  async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).max(100),
        type: z.enum(['TEXT', 'VOICE']).default('TEXT'),
        categoryId: z.string().optional(),
        topic: z.string().max(1024).optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.flatten() });
      return;
    }
    const count = await prisma.channel.count({ where: { serverId: req.params.serverId } });
    const channel = await prisma.channel.create({
      data: {
        serverId: req.params.serverId,
        name: body.data.name.toLowerCase().replace(/\s+/g, '-'),
        type: body.data.type,
        categoryId: body.data.categoryId,
        topic: body.data.topic,
        position: count,
      },
    });
    const io = req.app.get('io');
    io?.to(`server:${req.params.serverId}`).emit('channel:created', channel);
    res.status(201).json(channel);
  }
);

router.post(
  '/:serverId/invites',
  requireServerPermission(Permissions.CREATE_INSTANT_INVITE),
  async (req, res) => {
    const user = getUser(req);
    const body = z
      .object({
        maxUses: z.number().int().positive().optional(),
        expiresInHours: z.number().positive().optional(),
      })
      .safeParse(req.body || {});
    const code = nanoid(8);
    const expiresAt =
      body.success && body.data.expiresInHours
        ? new Date(Date.now() + body.data.expiresInHours * 3600_000)
        : null;
    const invite = await prisma.invite.create({
      data: {
        code,
        serverId: req.params.serverId,
        creatorId: user.id,
        maxUses: body.success ? body.data.maxUses ?? null : null,
        expiresAt,
      },
    });
    res.status(201).json(invite);
  }
);

router.post('/join/:code', async (req, res) => {
  const user = getUser(req);
  const invite = await prisma.invite.findUnique({ where: { code: req.params.code } });
  if (!invite) {
    res.status(404).json({ error: 'Invalid invite' });
    return;
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    res.status(410).json({ error: 'Invite expired' });
    return;
  }
  if (invite.maxUses != null && invite.uses >= invite.maxUses) {
    res.status(410).json({ error: 'Invite max uses reached' });
    return;
  }
  const existing = await prisma.serverMember.findUnique({
    where: {
      serverId_userId: { serverId: invite.serverId, userId: user.id },
    },
  });
  if (existing) {
    res.json({ serverId: invite.serverId, alreadyMember: true });
    return;
  }
  const everyone = await prisma.role.findFirst({
    where: { serverId: invite.serverId, name: '@everyone' },
  });
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const member = await tx.serverMember.create({
      data: { serverId: invite.serverId, userId: user.id },
    });
    if (everyone) {
      await tx.memberRole.create({
        data: { memberId: member.id, roleId: everyone.id },
      });
    }
    await tx.invite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } },
    });
  });
  const io = req.app.get('io');
  io?.to(`server:${invite.serverId}`).emit('member:joined', {
    userId: user.id,
    serverId: invite.serverId,
  });
  res.status(201).json({ serverId: invite.serverId });
});

export default router;
