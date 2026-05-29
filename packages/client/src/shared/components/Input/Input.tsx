import React from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helper,
      leftElement,
      rightElement,
      id,
      className = '',
      ...rest
    },
    ref
  ) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}
        <div className={[styles.inputWrapper, error ? styles.hasError : ''].join(' ')}>
          {leftElement && (
            <span className={styles.leftElement} aria-hidden="true">
              {leftElement}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              styles.input,
              leftElement ? styles.hasLeft : '',
              rightElement ? styles.hasRight : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined
            }
            {...rest}
          />
          {rightElement && (
            <span className={styles.rightElement} aria-hidden="true">
              {rightElement}
            </span>
          )}
        </div>
        {error && (
          <span id={`${inputId}-error`} className={styles.error} role="alert">
            {error}
          </span>
        )}
        {!error && helper && (
          <span id={`${inputId}-helper`} className={styles.helper}>
            {helper}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
