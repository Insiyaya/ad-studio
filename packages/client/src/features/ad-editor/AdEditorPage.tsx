/**
 * Timeline editor page - the primary creation surface.
 *
 * Layout (top to bottom):
 *   Header     - project name, undo/redo, save, export
 *   Canvas     - live canvas preview (same renderer as AdPreviewPage)
 *   Timeline   - multi-track editor with playhead
 *   Properties - right-side panel for selected clip
 */

import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdProject } from '@shared/hooks/useAdProject';
import { Button, Skeleton } from '@shared/components';
import { useMediaTimeline } from './hooks/useMediaTimeline';
import { Timeline } from './Timeline';
import { PropertiesPanel } from './PropertiesPanel';
import { CanvasPreview } from './CanvasPreview';
import { ExportDialog } from '../export/ExportDialog';
import styles from './AdEditorPage.module.css';

export const AdEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { project, loading, error, update } = useAdProject(id ?? null);

  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Timeline state is managed locally; persisted on save
  const timelineHook = useMediaTimeline(
    project?.timeline ?? { duration: 30, tracks: [] }
  );

  const handleSave = useCallback(async (): Promise<void> => {
    if (!project) return;
    setSaving(true);
    await update({ timeline: timelineHook.timeline });
    setSaving(false);
  }, [project, update, timelineHook.timeline]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <Skeleton width={120} height={20} />
          <Skeleton width={300} height={32} />
          <Skeleton width={120} height={32} />
        </div>
        <Skeleton width="100%" height="calc(100vh - 60px)" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className={styles.errorState}>
        <p>{error ?? 'Project not found'}</p>
        <Button onClick={() => navigate('/')}>Start over</Button>
      </div>
    );
  }

  const selectedInfo = timelineHook.getSelectedClip();

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backLink} onClick={() => navigate(`/project/${project.id}/preview`)}>
            ← Preview
          </button>
          <span className={styles.projectName}>{project.name}</span>
        </div>

        <div className={styles.headerCenter}>
          <button
            className={styles.iconBtn}
            onClick={timelineHook.undo}
            disabled={!timelineHook.canUndo}
            title="Undo (⌘Z)"
            aria-label="Undo"
          >
            ↩
          </button>
          <button
            className={styles.iconBtn}
            onClick={timelineHook.redo}
            disabled={!timelineHook.canRedo}
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
          >
            ↪
          </button>
        </div>

        <div className={styles.headerRight}>
          <Button variant="ghost" size="sm" loading={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setExportOpen(true)}>
            Export
          </Button>
        </div>
      </header>

      {/* Canvas + Properties panel */}
      <div className={styles.workArea}>
        <div className={styles.canvasArea}>
          <CanvasPreview
            timeline={timelineHook.timeline}
            currentTime={timelineHook.playheadPosition}
          />
        </div>

        {/* Properties panel */}
        <aside className={styles.propertiesArea}>
          <PropertiesPanel
            selection={selectedInfo}
            onUpdateClip={(trackId, clipId, patch) =>
              timelineHook.updateClip(trackId, clipId, patch)
            }
          />
        </aside>
      </div>

      {/* Timeline */}
      <div className={styles.timelineArea}>
        <Timeline
          timeline={timelineHook.timeline}
          selectedClipId={timelineHook.selectedClipId}
          playheadPosition={timelineHook.playheadPosition}
          onSelectClip={timelineHook.selectClip}
          onMoveClip={timelineHook.moveClip}
          onResizeClip={timelineHook.resizeClip}
          onToggleMute={timelineHook.toggleTrackMute}
          onToggleLock={timelineHook.toggleTrackLock}
          onSeek={timelineHook.setPlayheadPosition}
        />
      </div>

      {/* Export dialog */}
      <ExportDialog
        open={exportOpen}
        project={project}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
};
