import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

/**
 * Shimmering placeholder for loading states.
 * Use instead of spinners for content areas that have a predictable shape.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height = '1em',
  borderRadius,
  className = '',
}) => (
  <span
    className={[styles.skeleton, className].filter(Boolean).join(' ')}
    style={{
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      borderRadius,
    }}
    aria-hidden="true"
  />
);
