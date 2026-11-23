import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  comparePassword,
  getUser,
  hashPassword,
  nextDiscriminator,
  requireAuth,
  signToken,
} from '../lib/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password, username } = parsed.data;
  const exists = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (exists) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  const discriminator = await nextDiscriminator(username);
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      username,
      discriminator,
      displayName: username,
      status: 'ONLINE',
    },
  });
  const token = signToken({
    id: user.id,
    email: user.email,
    username: user.username,
    discriminator: user.discriminator,
  });
  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      discriminator: user.discriminator,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      tag: `${user.username}#${user.discriminator}`,
    },
  });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body' });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user?.passwordHash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const ok = await comparePassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { status: 'ONLINE' } });
  const token = signToken({
    id: user.id,
    email: user.email,
    username: user.username,
    discriminator: user.discriminator,
  });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      discriminator: user.discriminator,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      tag: `${user.username}#${user.discriminator}`,
    },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = getUser(req);
  const db = await prisma.user.findUnique({ where: { id: user.id } });
  if (!db) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    id: db.id,
    email: db.email,
    username: db.username,
    discriminator: db.discriminator,
    displayName: db.displayName,
    avatarUrl: db.avatarUrl,
    bio: db.bio,
    status: db.status,
    tag: `${db.username}#${db.discriminator}`,
  });
});

export default router;
