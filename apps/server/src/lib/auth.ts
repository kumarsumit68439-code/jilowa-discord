import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from './prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const JWT_EXPIRES = (process.env.JWT_EXPIRES || '7d') as SignOptions['expiresIn'];

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  discriminator: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
      discriminator: user.discriminator,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (!p.sub || !p.email) return null;
    return {
      id: String(p.sub),
      email: String(p.email),
      username: String(p.username || ''),
      discriminator: String(p.discriminator || '0000'),
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function nextDiscriminator(username: string): Promise<string> {
  const existing = await prisma.user.findMany({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: { discriminator: true },
  });
  const used = new Set(existing.map((e) => e.discriminator));
  for (let i = 1; i <= 9999; i++) {
    const d = String(i).padStart(4, '0');
    if (!used.has(d)) return d;
  }
  throw new Error('No discriminators left for this username');
}

/** Ensures req.user is set; use after this for authenticated routes */
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = token ? verifyToken(token) : null;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.user = user;
  next();
};

export function getUser(req: Request): AuthUser {
  if (!req.user) throw new Error('requireAuth missing');
  return req.user;
}

export function socketUserFromToken(token?: string): AuthUser | null {
  if (!token) return null;
  return verifyToken(token);
}
