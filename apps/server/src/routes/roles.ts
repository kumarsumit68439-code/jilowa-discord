import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUser, requireAuth } from '../lib/auth.js';
import { Permissions } from '../lib/permissions.js';
import { requireServerPermission } from '../middleware/rbac.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

/** List roles for a server */
router.get(
  '/',
  requireServerPermission(Permissions.VIEW_CHANNEL),
  async (req, res) => {
    const roles = await prisma.role.findMany({
      where: { serverId: req.params.serverId },
      orderBy: { position: 'desc' },
    });
    // Serialize BigInt
    res.json(
      roles.map((r) => ({
        ...r,
        permissions: r.permissions.toString(),
      }))
    );
  }
);

/** Create role */
router.post(
  '/',
  requireServerPermission(Permissions.MANAGE_ROLES),
  async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).max(100),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#99AAB5'),
        permissions: z.string().optional(), // decimal string of bigint
        hoist: z.boolean().optional(),
        mentionable: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.flatten() });
      return;
    }
    const maxPos = await prisma.role.aggregate({
      where: { serverId: req.params.serverId },
      _max: { position: true },
    });
    const role = await prisma.role.create({
      data: {
        serverId: req.params.serverId,
        name: body.data.name,
        color: body.data.color,
        permissions: body.data.permissions ? BigInt(body.data.permissions) : 0n,
        hoist: body.data.hoist ?? false,
        mentionable: body.data.mentionable ?? false,
        position: (maxPos._max.position ?? 0) + 1,
      },
    });
    const io = req.app.get('io');
    io?.to(`server:${req.params.serverId}`).emit('role:created', {
      ...role,
      permissions: role.permissions.toString(),
    });
    res.status(201).json({ ...role, permissions: role.permissions.toString() });
  }
);

/** Update role */
router.patch(
  '/:roleId',
  requireServerPermission(Permissions.MANAGE_ROLES),
  async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).max(100).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        permissions: z.string().optional(),
        hoist: z.boolean().optional(),
        mentionable: z.boolean().optional(),
        position: z.number().int().optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.flatten() });
      return;
    }
    const existing = await prisma.role.findFirst({
      where: { id: req.params.roleId, serverId: req.params.serverId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    if (existing.name === '@everyone' && body.data.name) {
      res.status(400).json({ error: 'Cannot rename @everyone' });
      return;
    }
    const role = await prisma.role.update({
      where: { id: existing.id },
      data: {
        name: body.data.name,
        color: body.data.color,
        permissions: body.data.permissions ? BigInt(body.data.permissions) : undefined,
        hoist: body.data.hoist,
        mentionable: body.data.mentionable,
        position: body.data.position,
      },
    });
    const io = req.app.get('io');
    io?.to(`server:${req.params.serverId}`).emit('role:updated', {
      ...role,
      permissions: role.permissions.toString(),
    });
    res.json({ ...role, permissions: role.permissions.toString() });
  }
);

/** Delete role */
router.delete(
  '/:roleId',
  requireServerPermission(Permissions.MANAGE_ROLES),
  async (req, res) => {
    const existing = await prisma.role.findFirst({
      where: { id: req.params.roleId, serverId: req.params.serverId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    if (existing.name === '@everyone') {
      res.status(400).json({ error: 'Cannot delete @everyone' });
      return;
    }
    await prisma.role.delete({ where: { id: existing.id } });
    const io = req.app.get('io');
    io?.to(`server:${req.params.serverId}`).emit('role:deleted', {
      id: existing.id,
      serverId: req.params.serverId,
    });
    res.status(204).end();
  }
);

/** Assign role to member */
router.post(
  '/:roleId/members/:userId',
  requireServerPermission(Permissions.MANAGE_ROLES),
  async (req, res) => {
    const member = await prisma.serverMember.findUnique({
      where: {
        serverId_userId: {
          serverId: req.params.serverId,
          userId: req.params.userId,
        },
      },
    });
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    const role = await prisma.role.findFirst({
      where: { id: req.params.roleId, serverId: req.params.serverId },
    });
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    await prisma.memberRole.upsert({
      where: {
        memberId_roleId: { memberId: member.id, roleId: role.id },
      },
      create: { memberId: member.id, roleId: role.id },
      update: {},
    });
    const io = req.app.get('io');
    io?.to(`server:${req.params.serverId}`).emit('member:roles', {
      userId: req.params.userId,
      roleId: role.id,
      action: 'add',
    });
    res.status(201).json({ ok: true });
  }
);

/** Remove role from member */
router.delete(
  '/:roleId/members/:userId',
  requireServerPermission(Permissions.MANAGE_ROLES),
  async (req, res) => {
    const member = await prisma.serverMember.findUnique({
      where: {
        serverId_userId: {
          serverId: req.params.serverId,
          userId: req.params.userId,
        },
      },
    });
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    await prisma.memberRole.deleteMany({
      where: { memberId: member.id, roleId: req.params.roleId },
    });
    const io = req.app.get('io');
    io?.to(`server:${req.params.serverId}`).emit('member:roles', {
      userId: req.params.userId,
      roleId: req.params.roleId,
      action: 'remove',
    });
    res.status(204).end();
  }
);

export default router;
