# Jilowa Discord — Production Discord clone

**Zero mock data.** PostgreSQL + Prisma + Express + Socket.io + Next.js App Router.

| Layer | Status |
|-------|--------|
| Prisma schema | ✅ |
| Express REST + Socket.io | ✅ |
| Next.js frontend (auth, servers, chat, friends, DMs) | ✅ |
| Deploy guide | ✅ [DEPLOY.md](./DEPLOY.md) |

## Critical deploy note

- **Frontend → Vercel** (`apps/web`)
- **API + WebSockets → Railway** (`apps/server`) — Socket.io does **not** run on Vercel serverless
- **Postgres → Neon / Supabase**

Full steps: **[DEPLOY.md](./DEPLOY.md)**

## Local

```bash
npm install
cp apps/server/.env.example apps/server/.env
# set DATABASE_URL + JWT_SECRET

cp apps/web/.env.example apps/web/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000
# NEXT_PUBLIC_WS_URL=http://localhost:4000

npm run db:push
npm run dev:server   # :4000
npm run dev:web      # :3000
```

## Features wired to real DB + sockets

- Register / login (JWT, username#0001)
- Create / join servers (invites)
- Channels, live messages, typing indicators, presence
- Friends + 1:1 DMs
- Roles bitfield RBAC on API
- Voice channel presence in DB (audio = LiveKit next)
