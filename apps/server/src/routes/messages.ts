import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUser, requireAuth } from '../lib/auth.js';
import { assertChannelAccess } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const authorSelect = {
  id: true,
  username: true,
  discriminator: true,
  displayName: true,
  avatarUrl: true,
} as const;

router.get('/channels/:channelId', async (req, res) => {
  const user = getUser(req);
  const ok = await assertChannelAccess(user.id, req.params.channelId);
  if (!ok) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cursor = req.query.cursor as string | undefined;
  const take = Math.min(Number(req.query.limit) || 50, 100);
  const messages = await prisma.message.findMany({
    where: { channelId: req.params.channelId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      author: { select: authorSelect },
      attachments: true,
      reactions: true,
    },
  });
  res.json({ messages: messages.reverse(), nextCursor: messages[0]?.id ?? null });
});

router.post('/channels/:channelId', async (req, res) => {
  const user = getUser(req);
  const ok = await assertChannelAccess(user.id, req.params.channelId);
  if (!ok) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const body = z.object({ content: z.string().min(1).max(4000) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'content required' });
    return;
  }
  const message = await prisma.message.create({
    data: {
      channelId: req.params.channelId,
      authorId: user.id,
      content: body.data.content,
    },
    include: {
      author: { select: authorSelect },
      attachments: true,
      reactions: true,
    },
  });
  const io = req.app.get('io');
  io?.to(`channel:${req.params.channelId}`).emit('message:create', message);
  res.status(201).json(message);
});

router.patch('/:messageId', async (req, res) => {
  const user = getUser(req);
  const body = z.object({ content: z.string().min(1).max(4000) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'content required' });
    return;
  }
  const existing = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!existing || existing.authorId !== user.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const message = await prisma.message.update({
    where: { id: existing.id },
    data: { content: body.data.content, editedAt: new Date() },
    include: {
      author: { select: authorSelect },
      attachments: true,
      reactions: true,
    },
  });
  const io = req.app.get('io');
  io?.to(`channel:${message.channelId}`).emit('message:update', message);
  res.json(message);
});

router.delete('/:messageId', async (req, res) => {
  const user = getUser(req);
  const existing = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!existing || existing.authorId !== user.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  await prisma.message.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), content: '' },
  });
  const io = req.app.get('io');
  io?.to(`channel:${existing.channelId}`).emit('message:delete', {
    id: existing.id,
    channelId: existing.channelId,
  });
  res.status(204).end();
});

router.post('/:messageId/reactions', async (req, res) => {
  const user = getUser(req);
  const body = z.object({ emoji: z.string().min(1).max(32) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'emoji required' });
    return;
  }
  const existing = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const ok = await assertChannelAccess(user.id, existing.channelId);
  if (!ok) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const reaction = await prisma.reaction.upsert({
    where: {
      messageId_userId_emoji: {
        messageId: existing.id,
        userId: user.id,
        emoji: body.data.emoji,
      },
    },
    create: {
      messageId: existing.id,
      userId: user.id,
      emoji: body.data.emoji,
    },
    update: {},
  });
  const io = req.app.get('io');
  io?.to(`channel:${existing.channelId}`).emit('reaction:add', reaction);
  res.status(201).json(reaction);
});

export default router;
