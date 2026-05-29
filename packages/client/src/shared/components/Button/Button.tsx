import React from 'react';
import { Spinner } from '../Spinner/Spinner';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      className = '',
      ...rest
    },
    ref
  ) => {
    const classes = [
      styles.button,
      styles[variant],
      styles[size],
      loading ? styles.loading : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled ?? loading}
        {...rest}
      >
        {loading ? (
          <Spinner size="sm" color={variant === 'ghost' ? 'primary' : 'white'} />
        ) : leftIcon ? (
          <span className={styles.icon} aria-hidden="true">{leftIcon}</span>
        ) : null}
        {children && <span className={styles.label}>{children}</span>}
        {!loading && rightIcon && (
          <span className={styles.icon} aria-hidden="true">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
