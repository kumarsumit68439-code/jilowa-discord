# Jilowa Discord — Production Discord clone

**Zero mock data.** Every route and socket event reads/writes PostgreSQL via Prisma.

| Layer | Status |
|-------|--------|
| Step 1 — Prisma schema (Users, Servers, Roles, Channels, Messages, DMs, Friends, Invites, Voice) | ✅ Done |
| Step 2 — Express REST + Socket.io real-time engine | ✅ Done |
| Step 3 — Next.js App Router frontend | ⏳ Next |
| Step 4 — LiveKit voice + S3 uploads + deploy | ⏳ Next |

## Quick start (backend only)

```bash
cd apps/server
cp .env.example .env
# set DATABASE_URL to real Postgres (local / Neon / Supabase)
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Health: `GET http://localhost:4000/health`

## REST API

All authenticated routes require `Authorization: Bearer <JWT>`.

### Auth
| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/api/auth/register` | `{ email, password, username }` | Returns JWT + `username#####` |
| POST | `/api/auth/login` | `{ email, password }` | Returns JWT |
| GET | `/api/auth/me` | — | Current user profile |

### Servers
| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/api/servers` | — | Servers you belong to |
| POST | `/api/servers` | — | Creates server + @everyone + Admin + #general + voice |
| GET | `/api/servers/:serverId` | member | Channels, roles, members + presence |
| POST | `/api/servers/:serverId/channels` | MANAGE_CHANNELS | Create text/voice channel |
| POST | `/api/servers/:serverId/invites` | CREATE_INSTANT_INVITE | Real invite codes |
| POST | `/api/servers/join/:code` | — | Join via invite (DB membership) |

### Roles (RBAC)
| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/servers/:serverId/roles` | VIEW_CHANNEL |
| POST | `/api/servers/:serverId/roles` | MANAGE_ROLES |
| PATCH | `/api/servers/:serverId/roles/:roleId` | MANAGE_ROLES |
| DELETE | `/api/servers/:serverId/roles/:roleId` | MANAGE_ROLES |
| POST | `/api/servers/:serverId/roles/:roleId/members/:userId` | MANAGE_ROLES |
| DELETE | `/api/servers/:serverId/roles/:roleId/members/:userId` | MANAGE_ROLES |

Permissions are Discord-style **bitfields** (`BigInt`). Owner always has all flags.

### Messages
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/messages/channels/:channelId?cursor=&limit=` | Cursor pagination |
| POST | `/api/messages/channels/:channelId` | `{ content }` |
| PATCH | `/api/messages/:messageId` | Own messages only |
| DELETE | `/api/messages/:messageId` | Soft-delete |
| POST | `/api/messages/:messageId/reactions` | `{ emoji }` |

### Friends
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/friends` | friends / incoming / outgoing / blocked |
| POST | `/api/friends/request` | `{ userId }` or `{ tag: "user#1234" }` |
| POST | `/api/friends/:id/accept` | |
| POST | `/api/friends/:id/decline` | |
| POST | `/api/friends/:id/block` | |

### Direct Messages
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/dms` | Your DM channels + last message |
| POST | `/api/dms/open` | `{ userId }` — open or create 1:1 |
| GET | `/api/dms/:channelId/messages` | Cursor pagination |
| POST | `/api/dms/:channelId/messages` | `{ content }` |

## Socket.io

Connect with `auth: { token: JWT }` (or `Authorization` header).

| Event | Direction | Purpose |
|-------|-----------|--------|
| `presence:update` | S→C | `{ userId, status }` ONLINE/OFFLINE |
| `channel:join` / `leave` | C→S | Room membership (access-checked) |
| `typing:start` / `stop` | both | Typing indicators |
| `message:create` | both | Live chat + DB write |
| `message:update` / `delete` | S→C | From REST patches |
| `reaction:add` | S→C | |
| `voice:join` / `leave` | C→S | VoiceState in DB |
| `voice:state` | S→C | Who is in a VC |
| `voice:user-joined` / `left` | S→C | |
| `webrtc:signal` | both | WebRTC signaling relay |
| `dm:message` | S→C | DM to `user:{id}` room |
| `friend:request` / `accepted` | S→C | Friend events |
| `channel:created` | S→C | New channel in server |
| `member:joined` | S→C | |
| `role:created` / `updated` / `deleted` | S→C | |
| `member:roles` | S→C | Role assign/remove |

## Env (`apps/server/.env`)

```
DATABASE_URL=postgresql://...
JWT_SECRET=long-random-string
JWT_EXPIRES=7d
PORT=4000
CORS_ORIGIN=http://localhost:3000
# Optional later:
# LIVEKIT_API_KEY=
# LIVEKIT_API_SECRET=
# LIVEKIT_URL=
```

## Repo layout

```
apps/server/
  prisma/schema.prisma   # Step 1 — full model
  src/
    index.ts             # Express + HTTP + Socket.io bootstrap
    lib/auth.ts          # JWT, bcrypt, discriminator
    lib/permissions.ts   # Discord-style bitfield
    lib/prisma.ts
    middleware/rbac.ts   # requireServerPermission, assertChannelAccess
    routes/
      auth.ts
      servers.ts
      messages.ts
      friends.ts
      dms.ts
      roles.ts
    socket/index.ts      # Real-time engine
```
