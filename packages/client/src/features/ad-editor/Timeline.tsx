/**
 * Multi-track timeline editor.
 *
 * Renders one row per track. Each track shows its clips as coloured blocks
 * positioned and sized according to their startTime and duration.
 *
 * Clicking a clip selects it (shows in PropertiesPanel).
 * Dragging a clip moves it horizontally (changes startTime).
 * The playhead is a vertical line that the user can drag to seek.
 *
 * WHY not a library: a drag-and-drop timeline library would add hundreds of
 * kB to the bundle and fight against our custom types. A thin hand-rolled
 * implementation is sufficient for a 5-track, 30-second timeline.
 */

import React, { useRef, useCallback } from 'react';
import type { AdTimeline, Track, Clip, TrackType } from '@shared/types';
import styles from './Timeline.module.css';

// Pixels per second - controls zoom
const PX_PER_SEC = 20;

// Track color map - matches design tokens
const TRACK_COLORS: Record<TrackType, string> = {
  images:    'var(--color-track-images)',
  text:      'var(--color-track-text)',
  voiceover: 'var(--color-track-voiceover)',
  music:     'var(--color-track-music)',
  overlay:   'var(--color-track-overlay)',
};

interface TimelineProps {
  timeline: AdTimeline;
  selectedClipId: string | null;
  playheadPosition: number;
  onSelectClip: (id: string | null) => void;
  onMoveClip: (trackId: string, clipId: string, startTime: number) => void;
  onResizeClip: (trackId: string, clipId: string, duration: number) => void;
  onToggleMute: (trackId: string) => void;
  onToggleLock: (trackId: string) => void;
  onSeek: (time: number) => void;
}

const RULER_MARK_INTERVAL = 5; // seconds between ruler marks

export const Timeline: React.FC<TimelineProps> = ({
  timeline,
  selectedClipId,
  playheadPosition,
  onSelectClip,
  onMoveClip,
  onToggleMute,
  onToggleLock,
  onSeek,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    trackId: string;
    clipId: string;
    startX: number;
    startTime: number;
  } | null>(null);

  const timeToX = (t: number): number => t * PX_PER_SEC;
  const xToTime = (x: number): number => x / PX_PER_SEC;
  const totalWidth = timeline.duration * PX_PER_SEC;

  // ── Clip drag ─────────────────────────────────────────────────────────────

  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, track: Track, clip: Clip): void => {
      if (track.locked) return;
      e.stopPropagation();
      onSelectClip(clip.id);

      dragState.current = {
        trackId: track.id,
        clipId: clip.id,
        startX: e.clientX,
        startTime: clip.startTime,
      };

      const onMouseMove = (mv: MouseEvent): void => {
        if (!dragState.current) return;
        const dx = mv.clientX - dragState.current.startX;
        const dt = xToTime(dx);
        const newStart = Math.max(0, dragState.current.startTime + dt);
        onMoveClip(dragState.current.trackId, dragState.current.clipId, newStart);
      };

      const onMouseUp = (): void => {
        dragState.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [onSelectClip, onMoveClip]
  );

  // ── Ruler click → seek ────────────────────────────────────────────────────

  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
      onSeek(Math.max(0, Math.min(xToTime(x), timeline.duration)));
    },
    [onSeek, timeline.duration]
  );

  // Ruler marks
  const rulerMarks: number[] = [];
  for (let t = 0; t <= timeline.duration; t += RULER_MARK_INTERVAL) {
    rulerMarks.push(t);
  }

  return (
    <div className={styles.container}>
      {/* Track labels (left sidebar) */}
      <div className={styles.labels}>
        <div className={styles.rulerLabel} />
        {timeline.tracks.map((track) => (
          <div key={track.id} className={styles.trackLabel}>
            <div
              className={styles.trackColorBar}
              style={{ backgroundColor: TRACK_COLORS[track.type] }}
            />
            <span className={styles.trackName}>{track.label}</span>
            <div className={styles.trackActions}>
              <button
                className={[styles.trackAction, track.muted ? styles.active : ''].join(' ')}
                onClick={() => onToggleMute(track.id)}
                title={track.muted ? 'Unmute' : 'Mute'}
                aria-label={track.muted ? 'Unmute track' : 'Mute track'}
              >
                {track.muted ? '🔇' : '🔊'}
              </button>
              <button
                className={[styles.trackAction, track.locked ? styles.active : ''].join(' ')}
                onClick={() => onToggleLock(track.id)}
                title={track.locked ? 'Unlock' : 'Lock'}
                aria-label={track.locked ? 'Unlock track' : 'Lock track'}
              >
                {track.locked ? '🔒' : '🔓'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable timeline body */}
      <div className={styles.scrollArea} ref={scrollRef}>
        <div className={styles.inner} style={{ width: totalWidth + 40 }}>
          {/* Ruler */}
          <div className={styles.ruler} onClick={handleRulerClick} role="presentation">
            {rulerMarks.map((t) => (
              <div
                key={t}
                className={styles.rulerMark}
                style={{ left: timeToX(t) }}
              >
                <span className={styles.rulerLabel2}>{t}s</span>
              </div>
            ))}
            {/* Playhead */}
            <div
              className={styles.playhead}
              style={{ left: timeToX(playheadPosition) }}
              aria-hidden="true"
            />
          </div>

          {/* Track rows */}
          {timeline.tracks.map((track) => (
            <div
              key={track.id}
              className={[styles.trackRow, track.locked ? styles.locked : ''].join(' ')}
              onClick={() => onSelectClip(null)}
            >
              {track.clips.map((clip) => (
                <div
                  key={clip.id}
                  className={[
                    styles.clip,
                    clip.id === selectedClipId ? styles.selected : '',
                    track.locked ? styles.clipLocked : '',
                  ].join(' ')}
                  style={{
                    left: timeToX(clip.startTime),
                    width: Math.max(timeToX(clip.duration), 4),
                    backgroundColor: TRACK_COLORS[track.type],
                  }}
                  onMouseDown={(e) => handleClipMouseDown(e, track, clip)}
                  role="button"
                  tabIndex={0}
                  aria-selected={clip.id === selectedClipId}
                  aria-label={`${track.label} clip at ${clip.startTime}s`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelectClip(clip.id);
                  }}
                >
                  <span className={styles.clipLabel}>
                    {clip.data.type === 'text'
                      ? clip.data.content.slice(0, 20)
                      : clip.data.type === 'image'
                      ? 'Image'
                      : clip.data.type === 'audio'
                      ? (clip.data.script ? 'Voiceover' : 'Music')
                      : 'Overlay'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
