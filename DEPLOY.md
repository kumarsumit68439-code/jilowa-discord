# Deploy Jilowa Discord (Production)

**Architecture (required):**

| Piece | Host | Why |
|-------|------|-----|
| Next.js frontend | **Vercel** | Serverless OK |
| Express + Socket.io API | **Railway** (or Render/Fly) | WebSockets need a long-lived process — **not** Vercel |
| PostgreSQL | **Neon** or Supabase | Managed Postgres |

Socket.io **cannot** run on Vercel serverless. Do not put the API root on Vercel.

---

## 1. Database (Neon — free tier works)

1. https://neon.tech → create project
2. Copy connection string → `DATABASE_URL`

---

## 2. Backend on Railway

1. https://railway.app → New Project → Deploy from GitHub → `jilowa-discord`
2. **Root Directory:** `apps/server`
3. Variables:

```
DATABASE_URL=<neon connection string>
JWT_SECRET=<long random string>
JWT_EXPIRES=7d
PORT=4000
CORS_ORIGIN=https://YOUR-VERCEL-APP.vercel.app
```

4. Railway will use `railway.toml`:
   - build: `prisma generate` + `tsc`
   - start: `prisma db push` + `node dist/index.js`
5. Generate public domain → e.g. `https://jilowa-api.up.railway.app`
6. Health check: `GET /health`

---

## 3. Frontend on Vercel

1. https://vercel.com → Import `jilowa-discord`
2. **Root Directory:** `apps/web`
3. Framework: Next.js
4. Environment variables:

```
NEXT_PUBLIC_API_URL=https://jilowa-api.up.railway.app
NEXT_PUBLIC_WS_URL=https://jilowa-api.up.railway.app
```

5. Deploy

6. Update Railway `CORS_ORIGIN` to the real Vercel URL and redeploy API once.

---

## 4. Local full stack

```bash
# Postgres running locally or Neon URL in apps/server/.env
cd apps/server && cp .env.example .env   # edit DATABASE_URL, JWT_SECRET
npm install   # from repo root
npx prisma db push -w apps/server
npm run dev:server   # :4000
npm run dev:web      # :3000
```

`apps/web/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

---

## 5. Verify production

1. Open Vercel URL → Register
2. Create server → #general appears from DB
3. Open second browser / incognito → second user → join invite → live messages via Socket.io
4. Friends: Add Friend with `username#0001` tag

---

## Optional later

- LiveKit for real voice audio (keys in server env)
- UploadThing / R2 for attachments
- Custom domains on Vercel + Railway
