/**
 * In-memory crawl job store with EventEmitter-based pub/sub.
 *
 * WHY events instead of polling: the WebSocket server subscribes once to
 * 'job:updated', 'job:complete', and 'job:error' events. When the crawl
 * runner mutates a job, all WebSocket clients subscribed to that job are
 * notified immediately — no polling, no shared mutable cursor.
 *
 * WHY in-memory vs Redis pub/sub: for a single-process prototype this is
 * equivalent. In a horizontally-scaled deployment, replace this with a
 * Redis Streams adapter behind the same interface — zero changes to callers.
 */

import { EventEmitter } from 'events';
import type { CrawlJob, CrawlStep, CrawlStatus } from '../types/crawl';

// Typed event map keeps EventEmitter usage honest
export type JobStoreEventMap = {
  'job:updated': [job: CrawlJob];
  'job:complete': [job: CrawlJob];
  'job:error': [job: CrawlJob];
};

class JobStore extends EventEmitter {
  private readonly jobs = new Map<string, CrawlJob>();

  /** Stores a new job. Overwrites any existing job with the same id. */
  set(job: CrawlJob): void {
    this.jobs.set(job.id, job);
  }

  get(id: string): CrawlJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Applies a partial update, bumps updatedAt, and emits the appropriate event.
   * Returns the updated job, or null if the job doesn't exist.
   */
  update(id: string, patch: Partial<Omit<CrawlJob, 'id' | 'createdAt'>>): CrawlJob | null {
    const existing = this.jobs.get(id);
    if (!existing) return null;

    const updated: CrawlJob = { ...existing, ...patch, updatedAt: Date.now() };
    this.jobs.set(id, updated);

    if (updated.status === 'complete') {
      this.emit('job:complete', updated);
    } else if (updated.status === 'failed') {
      this.emit('job:error', updated);
    } else {
      this.emit('job:updated', updated);
    }

    return updated;
  }

  /** Typed event subscription wrappers */
  onUpdated(listener: (job: CrawlJob) => void): this {
    return this.on('job:updated', listener);
  }

  onComplete(listener: (job: CrawlJob) => void): this {
    return this.on('job:complete', listener);
  }

  onError(listener: (job: CrawlJob) => void): this {
    return this.on('job:error', listener);
  }
}

/** Singleton — shared by crawl runner, WebSocket server, and API routes */
export const jobStore = new JobStore();

// ── Step helpers — called by the crawl runner to advance step state ────────

export type StepName = 'connecting' | 'extracting_assets' | 'analyzing_brand' | 'generating_concept';

const STEP_ORDER: StepName[] = [
  'connecting',
  'extracting_assets',
  'analyzing_brand',
  'generating_concept',
];

const STEP_LABELS: Record<StepName, string> = {
  connecting: 'Connecting',
  extracting_assets: 'Extracting assets',
  analyzing_brand: 'Analysing brand',
  generating_concept: 'Generating ad concept',
};

/** Returns a fresh CrawlStep in 'pending' state */
export function makePendingStep(name: StepName): CrawlStep {
  return {
    status: 'pending',
    label: STEP_LABELS[name],
    startedAt: null,
    completedAt: null,
    error: null,
  };
}

/**
 * Advances a job's step state machine:
 * - Marks the previous step (if any) as 'complete'
 * - Marks the current step as 'processing'
 * - Updates the job's overall status to match the current step name
 */
export function advanceJobStep(jobId: string, step: StepName): CrawlJob | null {
  const job = jobStore.get(jobId);
  if (!job) return null;

  const stepIndex = STEP_ORDER.indexOf(step);
  const now = Date.now();

  // Complete the previous step
  const updatedSteps = { ...job.steps };

  if (stepIndex > 0) {
    const prevStep = STEP_ORDER[stepIndex - 1];
    if (prevStep) {
      updatedSteps[prevStep] = {
        ...updatedSteps[prevStep],
        status: 'complete',
        completedAt: now,
      };
    }
  }

  // Start the current step
  updatedSteps[step] = {
    ...updatedSteps[step],
    status: 'processing',
    startedAt: now,
  };

  const status: CrawlStatus = step;

  return jobStore.update(jobId, { steps: updatedSteps, status });
}

/**
 * Marks all remaining steps as errored and sets the job to 'failed'.
 */
export function failJobStep(jobId: string, step: StepName, errorMessage: string): CrawlJob | null {
  const job = jobStore.get(jobId);
  if (!job) return null;

  const now = Date.now();
  const updatedSteps = { ...job.steps };
  updatedSteps[step] = {
    ...updatedSteps[step],
    status: 'error',
    completedAt: now,
    error: errorMessage,
  };

  return jobStore.update(jobId, {
    steps: updatedSteps,
    status: 'failed',
    error: errorMessage,
  });
}
