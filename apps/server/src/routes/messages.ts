import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUser, requireAuth } from '../lib/auth.js';
import { assertChannelAccess } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const AUTHOR_FIELDS = ['id', 'username', 'discriminator', 'displayName', 'avatarUrl'] as const;

function messageWithRelations(id: string) {
  return prisma.orm.public.Message
    .where({ id })
    .include('author', (a) => a.select(...AUTHOR_FIELDS))
    .include('attachments')
    .include('reactions')
    .first();
}

router.get('/channels/:channelId', async (req, res) => {
  const user = getUser(req);
  const ok = await assertChannelAccess(user.id, req.params.channelId);
  if (!ok) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cursor = req.query.cursor as string | undefined;
  const take = Math.min(Number(req.query.limit) || 50, 100);
  let cursorRow: { createdAt: Date | null } | null = null;
  if (cursor) {
    cursorRow = await prisma.orm.public.Message
      .select('createdAt')
      .where({ id: cursor })
      .first();
    if (!cursorRow) {
      res.status(404).json({ error: 'Cursor not found' });
      return;
    }
  }
  const page = await prisma.orm.public.Message
    .where((m) => m.channelId.eq(req.params.channelId))
    .where((m) => m.deletedAt.isNull())
    .include('author', (a) => a.select(...AUTHOR_FIELDS))
    .include('attachments')
    .include('reactions')
    .orderBy([(m) => m.createdAt.desc(), (m) => m.id.desc()])
    .cursor(cursorRow ? { createdAt: cursorRow.createdAt, id: cursor } : {})
    .limit(take)
    .all();
  const messages = [...page].reverse();
  res.json({ messages, nextCursor: messages[0]?.id ?? null });
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
  const created = await prisma.orm.public.Message.create({
    channelId: req.params.channelId,
    authorId: user.id,
    content: body.data.content,
  });
  const message = await messageWithRelations(created.id);
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
  const existing = await prisma.orm.public.Message
    .where({ id: req.params.messageId })
    .first();
  if (!existing || existing.authorId !== user.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  await prisma.orm.public.Message
    .where({ id: existing.id })
    .update({ content: body.data.content, editedAt: new Date() });
  const message = await messageWithRelations(existing.id);
  const io = req.app.get('io');
  io?.to(`channel:${message?.channelId ?? existing.channelId}`).emit('message:update', message);
  res.json(message);
});

router.delete('/:messageId', async (req, res) => {
  const user = getUser(req);
  const existing = await prisma.orm.public.Message
    .where({ id: req.params.messageId })
    .first();
  if (!existing || existing.authorId !== user.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  await prisma.orm.public.Message
    .where({ id: existing.id })
    .update({ deletedAt: new Date(), content: '' });
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
  const existing = await prisma.orm.public.Message
    .where({ id: req.params.messageId })
    .first();
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const ok = await assertChannelAccess(user.id, existing.channelId);
  if (!ok) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  await prisma.orm.public.Reaction.createAndCount(
    [
      {
        messageId: existing.id,
        userId: user.id,
        emoji: body.data.emoji,
      },
    ],
    { onConflict: 'skip', conflictOn: ['messageId', 'userId', 'emoji'] }
  );
  const reaction = await prisma.orm.public.Reaction
    .where({
      messageId: existing.id,
      userId: user.id,
      emoji: body.data.emoji,
    })
    .first();  const io = req.app.get('io');
  io?.to(`channel:${existing.channelId}`).emit('reaction:add', reaction);
  res.status(201).json(reaction);
});

export default router;
