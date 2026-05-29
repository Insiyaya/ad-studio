/**
 * API router — aggregates all route modules under /api.
 *
 * WHY a separate index rather than mounting directly in index.ts:
 * Routes are tested independently. The index.ts entry point only handles
 * infrastructure setup (server, WebSocket, static files). Keeping the
 * route tree separate makes integration testing straightforward.
 */

import { Router } from 'express';
import { crawlRouter } from './routes/crawl';
import { projectsRouter } from './routes/projects';

export const router = Router();

router.use('/crawl', crawlRouter);
router.use('/projects', projectsRouter);
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

