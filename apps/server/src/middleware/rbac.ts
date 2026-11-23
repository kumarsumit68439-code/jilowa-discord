import type { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { hasPermission, mergePermissions, type PermissionFlag, Permissions } from '../lib/permissions.js';
import type { AuthedRequest } from '../lib/auth.js';

export async function getMemberPermissions(serverId: string, userId: string): Promise<bigint | null> {
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    include: { roles: { include: { role: true } }, server: true },
  });
  if (!member) return null;
  if (member.server.ownerId === userId) {
    return Object.values(Permissions).reduce((a, b) => a | b, 0n);
  }
  const bits = member.roles.map((r) => r.role.permissions);
  // @everyone role fallback: roles with name @everyone or empty list uses VIEW+SEND defaults via seed
  return mergePermissions(bits.length ? bits : [0n]);
}

export function requireServerPermission(flag: PermissionFlag) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const serverId = (req.params.serverId || req.body.serverId) as string;
    if (!serverId) {
      res.status(400).json({ error: 'serverId required' });
      return;
    }
    const perms = await getMemberPermissions(serverId, req.user.id);
    if (perms === null) {
      res.status(403).json({ error: 'Not a member of this server' });
      return;
    }
    if (!hasPermission(perms, flag)) {
      res.status(403).json({ error: 'Missing permission' });
      return;
    }
    next();
  };
}

export async function assertChannelAccess(userId: string, channelId: string): Promise<boolean> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { serverId: true },
  });
  if (!channel) return false;
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: channel.serverId, userId } },
  });
  return !!member;
}
