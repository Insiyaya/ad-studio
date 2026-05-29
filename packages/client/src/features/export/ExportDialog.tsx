/**
 * Export dialog - format, resolution, and aspect ratio selection.
 *
 * Triggers the mock video composition service when the user confirms.
 * Shows progressive rendering feedback while compositing.
 *
 * In production with FEATURE_FFMPEG_EXPORT=true, the POST to /api/export
 * would kick off a real FFmpeg job and the progress would be tracked
 * via WebSocket.
 */

import React, { useState } from 'react';
import { Button, Badge } from '@shared/components';
import type { AdProject, ExportResolution, AspectRatio, ExportFormat } from '@shared/types';
import styles from './ExportDialog.module.css';

interface ExportDialogProps {
  open: boolean;
  project: AdProject;
  onClose: () => void;
}

type ExportStep = 'configure' | 'exporting' | 'done';

const RESOLUTION_OPTIONS: { value: ExportResolution; label: string; aspect: AspectRatio }[] = [
  { value: '1920x1080', label: '1920 × 1080', aspect: '16:9' },
  { value: '1080x1920', label: '1080 × 1920', aspect: '9:16' },
  { value: '1080x1080', label: '1080 × 1080', aspect: '1:1' },
];

const ASPECT_LABELS: Record<AspectRatio, string> = {
  '16:9': 'Widescreen (CTV)',
  '9:16': 'Vertical (Mobile)',
  '1:1':  'Square (Social)',
};

export const ExportDialog: React.FC<ExportDialogProps> = ({ open, project, onClose }) => {
  const [resolution, setResolution] = useState<ExportResolution>(
    project.exportSettings.resolution
  );
  const [format, setFormat] = useState<ExportFormat>(project.exportSettings.format);
  const [fps, setFps] = useState<30 | 60>(project.exportSettings.fps);
  const [step, setStep] = useState<ExportStep>('configure');
  const [progress, setProgress] = useState(0);

  if (!open) return null;

  const selectedOption = RESOLUTION_OPTIONS.find((o) => o.value === resolution);

  const handleExport = async (): Promise<void> => {
    setStep('exporting');
    setProgress(0);

    // Simulate progressive composition
    for (let p = 0; p <= 100; p += 10) {
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      setProgress(p);
    }

    setStep('done');
  };

  const handleClose = (): void => {
    setStep('configure');
    setProgress(0);
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleClose} role="presentation">
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
      >
        <div className={styles.header}>
          <h2 id="export-title" className={styles.title}>Export Ad</h2>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">✕</button>
        </div>

        {step === 'configure' && (
          <>
            <div className={styles.body}>
              {/* Resolution */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Resolution & Aspect Ratio</h3>
                <div className={styles.resolutionGrid}>
                  {RESOLUTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={[
                        styles.resOption,
                        resolution === opt.value ? styles.resOptionSelected : '',
                      ].join(' ')}
                      onClick={() => setResolution(opt.value)}
                    >
                      <div className={styles.resAspect} data-ratio={opt.aspect}>
                        <div
                          className={styles.resAspectBox}
                          style={{
                            aspectRatio: opt.aspect.replace(':', '/'),
                          }}
                        />
                      </div>
                      <div className={styles.resInfo}>
                        <span className={styles.resLabel}>{opt.label}</span>
                        <span className={styles.resDesc}>{ASPECT_LABELS[opt.aspect]}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Format & FPS */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Format</h3>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Container</span>
                    <div className={styles.segmented}>
                      {(['mp4', 'webm'] as ExportFormat[]).map((f) => (
                        <button
                          key={f}
                          className={[styles.segBtn, format === f ? styles.segBtnActive : ''].join(' ')}
                          onClick={() => setFormat(f)}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Frame rate</span>
                    <div className={styles.segmented}>
                      {([30, 60] as const).map((f) => (
                        <button
                          key={f}
                          className={[styles.segBtn, fps === f ? styles.segBtnActive : ''].join(' ')}
                          onClick={() => setFps(f)}
                        >
                          {f} fps
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Summary */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Summary</h3>
                <div className={styles.summary}>
                  <div className={styles.summaryRow}>
                    <span>Duration</span>
                    <span>{project.timeline.duration}s</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Resolution</span>
                    <span>{selectedOption?.label ?? resolution}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Format</span>
                    <span>{format.toUpperCase()} at {fps} fps</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Estimated size</span>
                    <span>~8.5 MB</span>
                  </div>
                </div>
              </section>
            </div>

            <div className={styles.footer}>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button variant="primary" onClick={() => void handleExport()}>
                Start Export
              </Button>
            </div>
          </>
        )}

        {step === 'exporting' && (
          <div className={styles.body}>
            <div className={styles.exportingState}>
              <div className={styles.progressRing}>
                <svg viewBox="0 0 48 48" className={styles.progressSvg} aria-hidden="true">
                  <circle cx="24" cy="24" r="20" className={styles.progressBg} />
                  <circle
                    cx="24" cy="24" r="20"
                    className={styles.progressFill}
                    style={{
                      strokeDashoffset: 125.6 * (1 - progress / 100),
                    }}
                  />
                </svg>
                <span className={styles.progressLabel}>{progress}%</span>
              </div>
              <p className={styles.exportingText}>Compositing your ad…</p>
              <p className={styles.exportingSubtext}>
                Combining {project.timeline.tracks.length} tracks into a{' '}
                {project.timeline.duration}s {format.toUpperCase()} file
              </p>
            </div>
          </div>
        )}

        {step === 'done' && (
          <>
            <div className={styles.body}>
              <div className={styles.doneState}>
                <div className={styles.doneIcon} aria-hidden="true">✓</div>
                <h3 className={styles.doneTitle}>Export Complete</h3>
                <p className={styles.doneDesc}>
                  Your {project.timeline.duration}s ad has been rendered successfully.
                </p>
                <Badge variant="success">~8.5 MB · {resolution} · {format.toUpperCase()}</Badge>
              </div>
            </div>
            <div className={styles.footer}>
              <Button variant="ghost" onClick={handleClose}>Close</Button>
              <Button
                variant="primary"
                onClick={() => {
                  // Mock download - in production this hits the storage URL
                  const a = document.createElement('a');
                  a.href = `/storage/mock/render-${project.id}.mp4`;
                  a.download = `${project.name.replace(/\s+/g, '-')}.mp4`;
                  a.click();
                }}
              >
                Download
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
