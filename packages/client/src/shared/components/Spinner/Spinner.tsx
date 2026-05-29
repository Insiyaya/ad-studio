import React from 'react';
import styles from './Spinner.module.css';

export type SpinnerSize = 'sm' | 'md' | 'lg';
export type SpinnerColor = 'primary' | 'secondary' | 'white' | 'muted';

interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  /** Accessible label - defaults to "Loading" */
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  label = 'Loading',
}) => (
  <span
    className={[styles.spinner, styles[size], styles[color]].join(' ')}
    role="status"
    aria-label={label}
  />
);
