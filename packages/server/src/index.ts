/**
 * Ad Studio server entry point.
 *
 * Wires together:
 * - Express app with security middleware (helmet, cors, rate limiting)
 * - REST API routes under /api
 * - Static file serving for the storage directory
 * - WebSocket server for real-time crawl progress
 * - Graceful shutdown: close Puppeteer browser + HTTP server on SIGTERM/SIGINT
 *
 * WHY http.createServer instead of app.listen:
 * The `ws` library attaches to an http.Server instance, not to Express directly.
 * Sharing one port for both HTTP and WebSocket is the correct approach.
 */

import http from 'http';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { env } from './config/env';
import { logger } from './config/logger';
import { router as apiRouter } from './api/index';
import { errorHandler } from './api/middleware/errorHandler';
import { initWsServer } from './jobs/wsServer';
import { closeBrowser } from './services/crawler/index';

// ── Express setup ──────────────────────────────────────────────────────────

const app = express();

// Security hardening — sets sensible HTTP headers
app.use(helmet());

// CORS — in development allow any origin so ngrok tunnels work out of the box;
// in production lock it to the configured client origin.
app.use(
  cors({
    origin: env.nodeEnv === 'development' ? true : env.clientOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting — 120 requests per minute per IP
// WHY 120: accommodates polling (e.g. status checks every 1s) + burst headroom
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests — try again in a minute' } },
  })
);

// Body parsing
app.use(express.json({ limit: '5mb' }));

// Serve the local storage directory at /storage
// In production, this path is served from Oracle Object Storage instead
app.use(
  '/storage',
  express.static(path.resolve(process.cwd(), env.storage.localPath), {
    maxAge: '1h',
    immutable: false,
  })
);

// API routes
app.use('/api', apiRouter);

// Catch-all 404 for unmatched API paths
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Error handler must be last
app.use(errorHandler);

// ── HTTP + WebSocket server ────────────────────────────────────────────────

const server = http.createServer(app);

const wss = new WebSocketServer({ server });
initWsServer(wss);

server.listen(env.port, () => {
  logger.info('Ad Studio server started', {
    port: env.port,
    nodeEnv: env.nodeEnv,
    clientOrigin: env.clientOrigin,
    storageProvider: env.storage.provider,
    featureRealAi: env.features.realAi,
    featureFfmpeg: env.features.ffmpegExport,
  });
});

// ── Graceful shutdown ──────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal} — shutting down gracefully`);

  // Close Puppeteer browser (releases Chrome process + file descriptors)
  await closeBrowser().catch((err: unknown) => {
    logger.warn('Failed to close Puppeteer browser during shutdown', { err });
  });

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force-exit if shutdown hangs beyond 10 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection', { reason });
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception — forcing exit', { err });
  process.exit(1);
});
