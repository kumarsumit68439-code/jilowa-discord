/** Discord-style permission bitfield */
export const Permissions = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_SERVER: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
} as const;

export type PermissionFlag = (typeof Permissions)[keyof typeof Permissions];

export const DEFAULT_EVERYONE =
  Permissions.VIEW_CHANNEL |
  Permissions.SEND_MESSAGES |
  Permissions.READ_MESSAGE_HISTORY |
  Permissions.ADD_REACTIONS |
  Permissions.CONNECT |
  Permissions.SPEAK |
  Permissions.ATTACH_FILES |
  Permissions.EMBED_LINKS;

export const ADMIN_ALL = Object.values(Permissions).reduce((a, b) => a | b, 0n);

export function hasPermission(bitfield: bigint, flag: PermissionFlag): boolean {
  if ((bitfield & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) return true;
  return (bitfield & flag) === flag;
}

export function mergePermissions(fields: bigint[]): bigint {
  return fields.reduce((a, b) => a | b, 0n);
}
