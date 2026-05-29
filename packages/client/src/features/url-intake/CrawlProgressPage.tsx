/**
 * Crawl progress page - shown while the backend processes the URL.
 *
 * Receives real-time updates via WebSocket and renders the step-by-step
 * progress indicator. When the crawl completes, automatically navigates
 * to the ad preview page. On failure, shows an error with a retry option.
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrawlProgress } from '@shared/hooks/useCrawlProgress';
import { StepProgress, Button, Skeleton } from '@shared/components';
import type { ProgressStep } from '@shared/components';
import type { CrawlJob, CrawlStepStatus } from '@shared/types';
import styles from './CrawlProgressPage.module.css';

// Map server step status to the ProgressStep component status
function toStepStatus(s: CrawlStepStatus): ProgressStep['status'] {
  return s;
}

function jobToSteps(job: CrawlJob): ProgressStep[] {
  return [
    {
      id: 'connecting',
      label: job.steps.connecting.label,
      status: toStepStatus(job.steps.connecting.status),
    },
    {
      id: 'extracting_assets',
      label: job.steps.extracting_assets.label,
      status: toStepStatus(job.steps.extracting_assets.status),
    },
    {
      id: 'analyzing_brand',
      label: job.steps.analyzing_brand.label,
      status: toStepStatus(job.steps.analyzing_brand.status),
    },
    {
      id: 'generating_concept',
      label: job.steps.generating_concept.label,
      status: toStepStatus(job.steps.generating_concept.status),
    },
  ];
}

const LOADING_STEPS: ProgressStep[] = [
  { id: 'a', label: 'Connecting', status: 'pending' },
  { id: 'b', label: 'Extracting assets', status: 'pending' },
  { id: 'c', label: 'Analysing brand', status: 'pending' },
  { id: 'd', label: 'Generating ad concept', status: 'pending' },
];

export const CrawlProgressPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { job, isConnecting } = useCrawlProgress(jobId ?? null);

  // Auto-navigate when the job completes
  useEffect(() => {
    if (job?.status === 'complete' && job.projectId) {
      // Small delay lets the user see the "complete" state before navigating
      const timer = setTimeout(() => {
        navigate(`/project/${job.projectId}/preview`);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [job, navigate]);

  const steps = job ? jobToSteps(job) : LOADING_STEPS;
  const isFailed = job?.status === 'failed';
  const isComplete = job?.status === 'complete';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backLink} onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true">▶</span>
          <span className={styles.logoText}>Ad Studio</span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          {/* URL being crawled */}
          <div className={styles.urlRow}>
            <span className={styles.urlLabel}>Crawling</span>
            {job ? (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.urlValue}
              >
                {job.url}
              </a>
            ) : (
              <Skeleton width={280} height={18} />
            )}
          </div>

          {/* Status header */}
          <div className={styles.statusRow}>
            <h1 className={styles.title}>
              {isConnecting && 'Connecting…'}
              {!isConnecting && !isFailed && !isComplete && 'Analysing your brand'}
              {isComplete && 'Brand analysed!'}
              {isFailed && 'Something went wrong'}
            </h1>
            {!isFailed && !isComplete && (
              <p className={styles.subtitle}>
                We&apos;re extracting images, colors, and copy from your site.
                <br />
                This takes about 10–20 seconds.
              </p>
            )}
          </div>

          {/* Step list */}
          <div className={styles.steps}>
            <StepProgress steps={steps} />
          </div>

          {/* Error state */}
          {isFailed && (
            <div className={styles.errorBox}>
              <p className={styles.errorText}>
                {job?.error ?? 'The crawl failed. This may be due to a network issue or an inaccessible URL.'}
              </p>
              <Button variant="secondary" onClick={() => navigate('/')}>
                Try a different URL
              </Button>
            </div>
          )}

          {/* Complete state - shown briefly before auto-navigate */}
          {isComplete && (
            <div className={styles.completeBox}>
              <p className={styles.completeText}>
                Extracted {job?.result?.images.length ?? 0} images and{' '}
                {job?.result?.colors.all.length ?? 0} brand colors.
                Opening ad preview…
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
