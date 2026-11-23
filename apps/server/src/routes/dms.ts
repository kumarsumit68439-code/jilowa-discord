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

/** List DM channels for current user */
router.get('/', async (req, res) => {
  const user = getUser(req);
  const parts = await prisma.directMessageParticipant.findMany({
    where: { userId: user.id },
    include: {
      channel: {
        include: {
          participants: {
            include: { user: { select: userSelect } },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { author: { select: userSelect } },
          },
        },
      },
    },
  });
  res.json(
    parts.map((p) => ({
      id: p.channel.id,
      participants: p.channel.participants.map((x) => x.user),
      lastMessage: p.channel.messages[0] ?? null,
    }))
  );
});

/** Open or create 1:1 DM with another user */
router.post('/open', async (req, res) => {
  const user = getUser(req);
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'userId required' });
    return;
  }
  const otherId = body.data.userId;
  if (otherId === user.id) {
    res.status(400).json({ error: 'Cannot DM yourself' });
    return;
  }

  // Find existing 1:1 channel containing both users
  const myChannels = await prisma.directMessageParticipant.findMany({
    where: { userId: user.id },
    select: { channelId: true },
  });
  const channelIds = myChannels.map((c) => c.channelId);
  if (channelIds.length) {
    const shared = await prisma.directMessageParticipant.findFirst({
      where: {
        channelId: { in: channelIds },
        userId: otherId,
      },
      include: {
        channel: {
          include: {
            participants: { include: { user: { select: userSelect } } },
          },
        },
      },
    });
    if (shared) {
      res.json({
        id: shared.channel.id,
        participants: shared.channel.participants.map((p) => p.user),
      });
      return;
    }
  }

  const channel = await prisma.$transaction(async (tx) => {
    const ch = await tx.directMessageChannel.create({ data: {} });
    await tx.directMessageParticipant.createMany({
      data: [
        { channelId: ch.id, userId: user.id },
        { channelId: ch.id, userId: otherId },
      ],
    });
    return tx.directMessageChannel.findUnique({
      where: { id: ch.id },
      include: {
        participants: { include: { user: { select: userSelect } } },
      },
    });
  });

  res.status(201).json({
    id: channel!.id,
    participants: channel!.participants.map((p) => p.user),
  });
});

async function assertDmAccess(userId: string, channelId: string) {
  const p = await prisma.directMessageParticipant.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  return !!p;
}

router.get('/:channelId/messages', async (req, res) => {
  const user = getUser(req);
  if (!(await assertDmAccess(user.id, req.params.channelId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cursor = req.query.cursor as string | undefined;
  const take = Math.min(Number(req.query.limit) || 50, 100);
  const messages = await prisma.directMessage.findMany({
    where: { channelId: req.params.channelId },
    orderBy: { createdAt: 'desc' },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: { author: { select: userSelect } },
  });
  res.json({ messages: messages.reverse(), nextCursor: messages[0]?.id ?? null });
});

router.post('/:channelId/messages', async (req, res) => {
  const user = getUser(req);
  if (!(await assertDmAccess(user.id, req.params.channelId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const body = z.object({ content: z.string().min(1).max(4000) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'content required' });
    return;
  }
  const message = await prisma.directMessage.create({
    data: {
      channelId: req.params.channelId,
      authorId: user.id,
      content: body.data.content,
    },
    include: { author: { select: userSelect } },
  });

  const participants = await prisma.directMessageParticipant.findMany({
    where: { channelId: req.params.channelId },
  });
  const io = req.app.get('io');
  for (const p of participants) {
    io?.to(`user:${p.userId}`).emit('dm:message', {
      channelId: req.params.channelId,
      message,
    });
  }
  res.status(201).json(message);
});

export default router;
