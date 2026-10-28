import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import { runMigrations } from './storage/migrations';
import { telemetryRouter } from './routes/telemetry';
import { layoutsRouter } from './routes/layouts';
import { setupWebSocket, broadcastTelemetry } from './services/telemetrySimulator';

// ─────────────────────────────────────────────────────────────────────────────
// SINGULARITY / ORBITRA Mission Control Backend Server
// Supports HTTP API, WebSockets, and SPA Frontend Hosting for Render / Cloud
// ─────────────────────────────────────────────────────────────────────────────

// Run DB migrations at startup
runMigrations();

const app = express();
const server = http.createServer(app);

const PORT = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3001;

// Attach WebSocket server on the same HTTP server instance
setupWebSocket(server);

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Prevents blocking Three.js textures, WSS & canvas
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'singularity-mission-control',
    version: '1.0.0',
    timestamp: Date.now(),
  });
});

// Broadcast endpoint for external hardware bridges / scripts
app.post('/api/telemetry/publish', (req, res) => {
  if (!req.body) {
    res.status(400).json({ error: 'Missing packet payload' });
    return;
  }
  broadcastTelemetry(req.body);
  res.json({ status: 'broadcasted', timestamp: Date.now() });
});

// REST API routes
app.use('/api/telemetry', telemetryRouter);
app.use('/api/layouts', layoutsRouter);

// Frontend static files resolution (in Docker or local production)
const FRONTEND_DIST =
  process.env['FRONTEND_PATH'] ||
  path.resolve(__dirname, '../../Frontend/dist');

if (fs.existsSync(FRONTEND_DIST)) {
  console.log(`[Static] Serving frontend assets from: ${FRONTEND_DIST}`);
  app.use(express.static(FRONTEND_DIST));

  // SPA fallback for client-side routing (Express 5 compatible)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/health')) {
      return res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    }
    next();
  });
} else {
  console.log(`[Static] Frontend dist not found at ${FRONTEND_DIST} (API-only mode)`);
}

// 404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start HTTP + WebSocket server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌌 SINGULARITY Mission Control online at http://0.0.0.0:${PORT}`);
  console.log(`   Health:         http://localhost:${PORT}/health`);
  console.log(`   Telemetry API:  http://localhost:${PORT}/api/telemetry`);
  console.log(`   WebSocket Feed: ws://localhost:${PORT}\n`);
});

export default app;
