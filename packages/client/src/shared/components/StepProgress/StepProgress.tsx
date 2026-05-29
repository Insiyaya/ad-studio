/**
 * Multi-step crawl progress indicator.
 *
 * Renders each step with a status icon, label, and optional detail text.
 * Matches the CrawlStep state machine from the server exactly.
 */
import React from 'react';
import { Spinner } from '../Spinner/Spinner';
import styles from './StepProgress.module.css';

export type StepStatus = 'pending' | 'processing' | 'complete' | 'error';

export interface ProgressStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

interface StepProgressProps {
  steps: ProgressStep[];
}

const ICON: Record<StepStatus, React.ReactNode> = {
  pending: <span className={styles.iconPending} />,
  processing: <Spinner size="sm" color="primary" />,
  complete: (
    <svg className={styles.iconComplete} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="var(--color-success)" />
      <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg className={styles.iconError} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="var(--color-error)" />
      <path d="M8 5v4M8 10.5v.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

export const StepProgress: React.FC<StepProgressProps> = ({ steps }) => (
  <ol className={styles.list} aria-label="Progress steps">
    {steps.map((step, i) => (
      <li key={step.id} className={[styles.step, styles[step.status]].join(' ')}>
        <div className={styles.iconCell}>
          <div className={styles.iconWrapper}>{ICON[step.status]}</div>
          {i < steps.length - 1 && (
            <div
              className={[
                styles.connector,
                step.status === 'complete' ? styles.connectorComplete : '',
              ].join(' ')}
            />
          )}
        </div>
        <div className={styles.content}>
          <span className={styles.label}>{step.label}</span>
          {step.detail && <span className={styles.detail}>{step.detail}</span>}
        </div>
      </li>
    ))}
  </ol>
);
