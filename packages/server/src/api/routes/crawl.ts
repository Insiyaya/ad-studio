/**
 * Crawl API routes.
 *
 * POST /api/crawl
 *   Creates a new crawl job, starts the pipeline in the background,
 *   and returns the job ID immediately. The client polls status via
 *   GET or subscribes to real-time updates via WebSocket.
 *
 * GET /api/crawl/:id/status
 *   Returns the full CrawlJob object including step-by-step progress,
 *   the extracted brand assets (once complete), and the projectId.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../config/logger';
import { jobStore, makePendingStep } from '../../jobs/jobStore';
import { enqueueCrawlJob } from '../../jobs/crawlRunner';
import { validateCrawlBody } from '../middleware/validate';
import { notFound } from '../../lib/errors';
import type { CreateCrawlResponseBody, CrawlStatusResponseBody } from '../../types/api';
import type { CrawlJob, CrawlSteps } from '../../types/crawl';

export const crawlRouter = Router();

// ── POST /api/crawl ────────────────────────────────────────────────────────

crawlRouter.post('/', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { url } = validateCrawlBody(req.body);

    const jobId = uuidv4();
    const now = Date.now();

    const steps: CrawlSteps = {
      connecting: makePendingStep('connecting'),
      extracting_assets: makePendingStep('extracting_assets'),
      analyzing_brand: makePendingStep('analyzing_brand'),
      generating_concept: makePendingStep('generating_concept'),
    };

    const job: CrawlJob = {
      id: jobId,
      url,
      status: 'queued',
      steps,
      result: null,
      projectId: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };

    jobStore.set(job);
    enqueueCrawlJob(jobId, url);

    logger.info('Crawl job created', { jobId, url });

    const body: CreateCrawlResponseBody = {
      jobId,
      status: 'queued',
      message: 'Crawl job created. Subscribe to WebSocket or poll /api/crawl/:id/status for updates.',
    };

    res.status(202).json(body);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/crawl/:id/status ──────────────────────────────────────────────

crawlRouter.get('/:id/status', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { id } = req.params;

    // id comes from URL params — present since the route pattern requires it,
    // but the compiler doesn't know that without runtime coercion
    if (!id) {
      next(notFound('CrawlJob', ''));
      return;
    }

    const job = jobStore.get(id);
    if (!job) {
      next(notFound('CrawlJob', id));
      return;
    }

    const body: CrawlStatusResponseBody = { job };
    res.json(body);
  } catch (err) {
    next(err);
  }
});
