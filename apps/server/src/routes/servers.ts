import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { getUser, requireAuth } from '../lib/auth.js';
import { DEFAULT_EVERYONE, ADMIN_ALL, Permissions } from '../lib/permissions.js';
import { requireServerPermission } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const user = getUser(req);
  const memberships = await prisma.orm.public.ServerMember
    .where({ userId: user.id })
    .include('server', (s) =>
      s
        .include('channels', (c) => c.orderBy((ch) => ch.position.asc()))
        .include('categories', (cat) => cat.orderBy((c) => c.position.asc()))
    )
    .all();
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

  const server = await prisma.transaction(async (tx) => {
    const s = await tx.orm.public.Server.create({
      name: body.data.name,
      ...(body.data.iconUrl !== undefined ? { iconUrl: body.data.iconUrl } : {}),
      ownerId: user.id,
    });
    const everyone = await tx.orm.public.Role.create({
      serverId: s.id,
      name: '@everyone',
      color: '#99AAB5',
      position: 0,
      permissions: DEFAULT_EVERYONE,
    });
    await tx.orm.public.Role.create({
      serverId: s.id,
      name: 'Admin',
      color: '#F23F43',
      position: 1,
      permissions: ADMIN_ALL,
      hoist: true,
    });
    const member = await tx.orm.public.ServerMember.create({
      serverId: s.id,
      userId: user.id,
    });
    await tx.orm.public.MemberRole.create({ memberId: member.id, roleId: everyone.id });
    const cat = await tx.orm.public.Category.create({
      serverId: s.id,
      name: 'Text Channels',
      position: 0,
    });
    await tx.orm.public.Channel.createAll([
      { serverId: s.id, categoryId: cat.id, name: 'general', type: 'TEXT', position: 0 },
      { serverId: s.id, name: 'General', type: 'VOICE', position: 0 },
    ]);
    return tx.orm.public.Server
      .where({ id: s.id })
      .include('channels')
      .include('categories')
      .include('roles')
      .first();
  });

  res.status(201).json(server);
});

router.get('/:serverId', async (req, res) => {
  const user = getUser(req);
  const member = await prisma.orm.public.ServerMember
    .where({ serverId: req.params.serverId, userId: user.id })
    .first();
  if (!member) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const server = await prisma.orm.public.Server
    .where({ id: req.params.serverId })
    .include('channels', (c) => c.orderBy((ch) => ch.position.asc()))
    .include('categories', (cat) => cat.orderBy((c) => c.position.asc()))
    .include('roles', (r) => r.orderBy((ro) => ro.position.desc()))
    .include('members', (m) =>
      m
        .include('user', (u) =>
          u.select('id', 'username', 'discriminator', 'displayName', 'avatarUrl', 'status')
        )
        .include('roles', (mr) => mr.include('role'))
    )
    .first();
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
    const countRow = await prisma.orm.public.Channel
      .where({ serverId: req.params.serverId })
      .aggregate((a) => ({ total: a.count() }));
    const channel = await prisma.orm.public.Channel.create({
      serverId: req.params.serverId,
      name: body.data.name.toLowerCase().replace(/\s+/g, '-'),
      type: body.data.type,
      ...(body.data.categoryId !== undefined ? { categoryId: body.data.categoryId } : {}),
      ...(body.data.topic !== undefined ? { topic: body.data.topic } : {}),
      position: countRow.total,
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
    const invite = await prisma.orm.public.Invite.create({
      code,
      serverId: req.params.serverId,
      creatorId: user.id,
      ...(body.success && body.data.maxUses !== undefined
        ? { maxUses: body.data.maxUses }
        : {}),
      ...(expiresAt !== null ? { expiresAt } : {}),
    });
    res.status(201).json(invite);
  }
);

router.post('/join/:code', async (req, res) => {
  const user = getUser(req);
  const invite = await prisma.orm.public.Invite
    .where({ code: req.params.code })
    .first();
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
  const existing = await prisma.orm.public.ServerMember
    .where({ serverId: invite.serverId, userId: user.id })
    .first();
  if (existing) {
    res.json({ serverId: invite.serverId, alreadyMember: true });
    return;
  }
  const everyone = await prisma.orm.public.Role
    .where({ serverId: invite.serverId, name: '@everyone' })
    .first();
  await prisma.transaction(async (tx) => {
    const member = await tx.orm.public.ServerMember.create({
      serverId: invite.serverId,
      userId: user.id,
    });
    if (everyone) {
      await tx.orm.public.MemberRole.create({
        memberId: member.id,
        roleId: everyone.id,
      });
    }
    const current = await tx.orm.public.Invite
      .where({ id: invite.id })
      .forUpdate()
      .first();
    await tx.orm.public.Invite
      .where({ id: invite.id })
      .update({ uses: (current?.uses ?? invite.uses) + 1 });
  });
  const io = req.app.get('io');
  io?.to(`server:${invite.serverId}`).emit('member:joined', {
    userId: user.id,
    serverId: invite.serverId,
  });
  res.status(201).json({ serverId: invite.serverId });
});

export default router;
