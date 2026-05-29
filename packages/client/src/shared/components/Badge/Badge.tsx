import React from 'react';
import styles from './Badge.module.css';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,}) => (
  <span className={[styles.badge, styles[variant], styles[size]].join(' ')}>
    {dot && <span className={styles.dot} aria-hidden="true" />}
    {children}
  </span>
  
);

