/**
 * Top-level React error boundary.
 *
 * WHY a class component: React error boundaries can only be implemented as
 * class components - there is no hook equivalent. This is intentional React
 * design; the class pattern makes the error lifecycle explicit.
 *
 * In production, the caught error would be sent to an error tracking service
 * (Sentry, Datadog RUM) before rendering the fallback UI.
 */

import React from 'react';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryState {
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Production: send to error tracking service here
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ error: null });
    window.location.href = '/';
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.icon} aria-hidden="true">⚠</div>
            <h1 className={styles.title}>Something went wrong</h1>
            <p className={styles.description}>
              An unexpected error occurred. The error has been logged.
            </p>
            <details className={styles.details}>
              <summary className={styles.summary}>Error details</summary>
              <pre className={styles.stack}>{this.state.error.message}</pre>
            </details>
            <button className={styles.resetButton} onClick={this.handleReset}>
              Return to home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
