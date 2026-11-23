import http from 'http';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import serverRoutes from './routes/servers.js';
import messageRoutes from './routes/messages.js';
import { createSocketServer } from './socket/index.js';
import service from './service.mjs';

const PORT = service.port();
const appInput = service.input();
const CORS_ORIGIN = appInput.corsOrigin
  ? appInput.corsOrigin.split(',')
  : ['http://localhost:3000'];
const app = express();

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'jilowa-discord-server' });
});

app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/messages', messageRoutes);

const server = http.createServer(app);
const io = createSocketServer(server, CORS_ORIGIN);
app.set('io', io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`API + Socket.io listening on :${PORT}`);
});
