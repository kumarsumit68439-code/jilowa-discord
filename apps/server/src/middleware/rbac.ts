import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  hasPermission,
  mergePermissions,
  type PermissionFlag,
  Permissions,
} from '../lib/permissions.js';
import { getUser } from '../lib/auth.js';

export async function getMemberPermissions(
  serverId: string,
  userId: string
): Promise<bigint | null> {
  const member = await prisma.orm.public.ServerMember
    .where({ serverId, userId })
    .include('roles', (r) => r.include('role'))
    .include('server')
    .first();
  if (!member) return null;
  if (member.server.ownerId === userId) {
    return Object.values(Permissions).reduce((a, b) => a | b, 0n);
  }
  const bits = member.roles.map((r) => r.role.permissions);
  return mergePermissions(bits.length ? bits : [0n]);
}

export function requireServerPermission(flag: PermissionFlag): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = getUser(req);
      const serverId = (req.params.serverId || req.body?.serverId) as string;
      if (!serverId) {
        res.status(400).json({ error: 'serverId required' });
        return;
      }
      const perms = await getMemberPermissions(serverId, user.id);
      if (perms === null) {
        res.status(403).json({ error: 'Not a member of this server' });
        return;
      }
      if (!hasPermission(perms, flag)) {
        res.status(403).json({ error: 'Missing permission' });
        return;
      }
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

export async function assertChannelAccess(
  userId: string,
  channelId: string
): Promise<boolean> {
  const channel = await prisma.orm.public.Channel
    .select('serverId')
    .first({ id: channelId });
  if (!channel) return false;
  const member = await prisma.orm.public.ServerMember
    .where({ serverId: channel.serverId, userId })
    .first();
  return !!member;
}
