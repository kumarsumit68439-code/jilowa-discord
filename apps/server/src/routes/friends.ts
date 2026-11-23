import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUser, requireAuth } from '../lib/auth.js';

const router = Router();
router.use(requireAuth);

const userSelect = {
  id: true,
  username: true,
  discriminator: true,
  displayName: true,
  avatarUrl: true,
  status: true,
} as const;

/** List friends + pending incoming/outgoing */
router.get('/', async (req, res) => {
  const user = getUser(req);
  const rows = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
    include: {
      userA: { select: userSelect },
      userB: { select: userSelect },
    },
  });

  const friends: unknown[] = [];
  const incoming: unknown[] = [];
  const outgoing: unknown[] = [];
  const blocked: unknown[] = [];

  for (const f of rows) {
    const other = f.userAId === user.id ? f.userB : f.userA;
    if (f.status === 'ACCEPTED') friends.push({ id: f.id, user: other });
    else if (f.status === 'BLOCKED') blocked.push({ id: f.id, user: other });
    else if (f.status === 'PENDING') {
      if (f.userAId === user.id) outgoing.push({ id: f.id, user: other });
      else incoming.push({ id: f.id, user: other });
    }
  }

  res.json({ friends, incoming, outgoing, blocked });
});

/** Send friend request by username#discriminator or userId */
router.post('/request', async (req, res) => {
  const user = getUser(req);
  const body = z
    .object({
      userId: z.string().optional(),
      tag: z.string().optional(), // username#1234
    })
    .safeParse(req.body);
  if (!body.success || (!body.data.userId && !body.data.tag)) {
    res.status(400).json({ error: 'userId or tag required' });
    return;
  }

  let targetId = body.data.userId;
  if (!targetId && body.data.tag) {
    const [username, disc] = body.data.tag.split('#');
    if (!username || !disc) {
      res.status(400).json({ error: 'tag must be username#1234' });
      return;
    }
    const t = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' }, discriminator: disc },
    });
    if (!t) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    targetId = t.id;
  }

  if (targetId === user.id) {
    res.status(400).json({ error: 'Cannot friend yourself' });
    return;
  }

  const [a, b] = user.id < targetId! ? [user.id, targetId!] : [targetId!, user.id];
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userAId: user.id, userBId: targetId! },
        { userAId: targetId!, userBId: user.id },
      ],
    },
  });
  if (existing) {
    if (existing.status === 'BLOCKED') {
      res.status(403).json({ error: 'Blocked' });
      return;
    }
    res.status(409).json({ error: 'Already friends or pending', friendship: existing });
    return;
  }

  const friendship = await prisma.friendship.create({
    data: {
      userAId: user.id, // requester
      userBId: targetId!,
      status: 'PENDING',
    },
    include: {
      userA: { select: userSelect },
      userB: { select: userSelect },
    },
  });

  const io = req.app.get('io');
  io?.to(`user:${targetId}`).emit('friend:request', {
    id: friendship.id,
    from: friendship.userA,
  });

  res.status(201).json(friendship);
});

router.post('/:friendshipId/accept', async (req, res) => {
  const user = getUser(req);
  const f = await prisma.friendship.findUnique({ where: { id: req.params.friendshipId } });
  if (!f || f.userBId !== user.id || f.status !== 'PENDING') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const updated = await prisma.friendship.update({
    where: { id: f.id },
    data: { status: 'ACCEPTED' },
    include: {
      userA: { select: userSelect },
      userB: { select: userSelect },
    },
  });
  const io = req.app.get('io');
  io?.to(`user:${f.userAId}`).emit('friend:accepted', { id: f.id, user: updated.userB });
  res.json(updated);
});

router.post('/:friendshipId/decline', async (req, res) => {
  const user = getUser(req);
  const f = await prisma.friendship.findUnique({ where: { id: req.params.friendshipId } });
  if (!f || (f.userAId !== user.id && f.userBId !== user.id)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  await prisma.friendship.delete({ where: { id: f.id } });
  res.status(204).end();
});

router.post('/:friendshipId/block', async (req, res) => {
  const user = getUser(req);
  const f = await prisma.friendship.findUnique({ where: { id: req.params.friendshipId } });
  if (!f || (f.userAId !== user.id && f.userBId !== user.id)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  // Ensure blocker is userA for consistency
  const otherId = f.userAId === user.id ? f.userBId : f.userAId;
  await prisma.friendship.delete({ where: { id: f.id } });
  const blocked = await prisma.friendship.create({
    data: { userAId: user.id, userBId: otherId, status: 'BLOCKED' },
  });
  res.json(blocked);
});

export default router;
