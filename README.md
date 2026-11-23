# Jilowa Discord — Production clone foundation

**Step 1:** `apps/server/prisma/schema.prisma` — full PostgreSQL model  
**Step 2:** `apps/server` — Express REST + Socket.io real-time engine

No mock users. All routes and socket events read/write PostgreSQL via Prisma.

## Quick start (backend)

```bash
cd apps/server
cp .env.example .env
# set DATABASE_URL to a real Postgres (local or Neon/Supabase)
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Health: `GET http://localhost:4000/health`

### Auth
- `POST /api/auth/register` `{ email, password, username }` → JWT + `username#####`
- `POST /api/auth/login` `{ email, password }` → JWT
- `GET /api/auth/me` Bearer token

### Servers
- `GET /api/servers` — servers you belong to (DB)
- `POST /api/servers` — create server + @everyone + Admin + #general + voice
- `GET /api/servers/:serverId` — channels, roles, members with presence fields
- `POST /api/servers/:serverId/channels` — requires MANAGE_CHANNELS
- `POST /api/servers/:serverId/invites` — real invite codes
- `POST /api/servers/join/:code` — join via invite

### Messages
- `GET /api/messages/channels/:channelId?cursor=&limit=` — paginated history
- `POST /api/messages/channels/:channelId` `{ content }`
- `PATCH/DELETE /api/messages/:messageId`
- Reactions: `POST /api/messages/:messageId/reactions`

### Socket.io (`auth: { token: JWT }`)
| Event | Direction | Purpose |
|-------|-----------|--------|
| `presence:update` | server→client | ONLINE/OFFLINE |
| `channel:join` / `leave` | client→server | room membership |
| `typing:start` / `stop` | both | typing indicators |
| `message:create` | both | live chat + DB write |
| `voice:join` / `leave` | both | voice state in DB |
| `voice:state` | server→client | who is in VC |
| `webrtc:signal` | both | WebRTC signaling relay |

## Step 3–4 (next)
Frontend Next.js App Router, LiveKit tokens, S3 uploads — continue in follow-up commits.

## Env
See `apps/server/.env.example`.
