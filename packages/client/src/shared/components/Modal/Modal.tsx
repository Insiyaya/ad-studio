/**
 * Custom modal component - replaces window.confirm() and alert().
 *
 * Uses a React portal so it renders at document.body regardless of DOM
 * nesting. Focus is trapped inside while open. Closes on Escape key or
 * backdrop click unless `persistent` is set.
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: ModalSize;
  /** When true, clicking the backdrop or pressing Escape does not close */
  persistent?: boolean;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  size = 'md',
  persistent = false,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open || persistent) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, persistent]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Auto-focus the dialog when it opens
  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (persistent) return;
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={[styles.dialog, styles[size]].join(' ')}
      >
        <div className={styles.header}>
          <h2 id="modal-title" className={styles.title}>{title}</h2>
          {!persistent && (
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close dialog"
            >
              ✕
            </button>
          )}
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  );
};
