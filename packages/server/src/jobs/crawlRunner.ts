/**
 * Crawl job runner.
 *
 * Orchestrates the full URL-to-project pipeline:
 *   1. Crawl the URL via Puppeteer (asset extraction + brand analysis)
 *   2. Generate a voiceover script from the brand data
 *   3. Build a default AdProject timeline from the results
 *   4. Persist the project and mark the crawl job complete
 *
 * WHY no BullMQ here: BullMQ adds durability (survive restarts, retry on crash)
 * and horizontal scaling. For the prototype, async fire-and-forget gives
 * identical UX with zero infrastructure dependency. The runner signature is
 * queue-agnostic — wrapping it in a BullMQ Worker is a one-function change.
 *
 * Progress updates are pushed to the jobStore, which the WebSocket server
 * listens to and forwards to subscribed clients in real time.
 */

import { logger } from '../config/logger';
import { crawlUrl } from '../services/crawler/index';
import { aiServices } from '../services/ai/index';
import { buildDefaultProject } from '../services/projects/builder';
import { projectStore } from '../services/projects/store';
import {
  jobStore,
  advanceJobStep,
  failJobStep,
  type StepName,
} from './jobStore';

/**
 * Kicks off the crawl pipeline for the given job ID in the background.
 *
 * The returned Promise resolves once the job has been enqueued (not completed).
 * Callers should not await the inner pipeline — it runs asynchronously.
 */
export function enqueueCrawlJob(jobId: string, url: string): void {
  // Fire and forget — errors are caught inside and written to the job store
  void runCrawlPipeline(jobId, url);
}

// ── Pipeline implementation ────────────────────────────────────────────────

async function runCrawlPipeline(jobId: string, url: string): Promise<void> {
  logger.info('Crawl pipeline started', { jobId, url });

  let currentStep: StepName = 'connecting';

  try {
    // Step callbacks fired by the crawler as it progresses.
    // Each callback transitions the job's step state machine.
    const onStep = (step: StepName): void => {
      currentStep = step;
      advanceJobStep(jobId, step);
      logger.debug('Crawl step advanced', { jobId, step });
    };

    const brandAssets = await crawlUrl(url, onStep);

    // Crawl is done — now generate the ad concept (step 4)
    advanceJobStep(jobId, 'generating_concept');

    logger.debug('Generating voiceover script', { jobId, businessName: brandAssets.businessName });
    const scriptResult = await aiServices.scriptGeneration.generate({
      businessName:         brandAssets.businessName,
      description:          brandAssets.metaDescription ?? '',
      tagline:              brandAssets.tagline,
      targetDurationSeconds: 30,
      tone:                 'professional',
      keywords:             brandAssets.keywords,
      sourceUrl:            brandAssets.sourceUrl,
      contactInfo:          brandAssets.contactInfo,
    });

    // Build the project and persist it
    const project = buildDefaultProject({
      crawlJobId:      jobId,
      brandAssets,
      voiceoverScript: scriptResult.script,
      sceneCopy:       scriptResult.sceneCopy,
    });

    projectStore.set(project);

    // Mark the final step complete and the job as a whole done.
    // Re-fetch the job to get the latest step state before patching.
    const completedJob = jobStore.get(jobId);
    if (completedJob) {
      const finalSteps = {
        ...completedJob.steps,
        generating_concept: {
          ...completedJob.steps.generating_concept,
          status: 'complete' as const,
          completedAt: Date.now(),
        },
      };

      jobStore.update(jobId, {
        status: 'complete',
        result: brandAssets,
        projectId: project.id,
        steps: finalSteps,
      });
    }

    logger.info('Crawl pipeline complete', {
      jobId,
      projectId: project.id,
      imagesExtracted: brandAssets.images.length,
      scriptWordCount: scriptResult.wordCount,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
        ? err
        : JSON.stringify(err) || 'Unknown error during crawl';
    const stack = err instanceof Error ? err.stack : String(err);
    logger.error(`Crawl pipeline failed ${message}`, { jobId, url, step: currentStep, stack });
    failJobStep(jobId, currentStep, message);
  }
}
