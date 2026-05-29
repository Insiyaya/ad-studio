/**
 * Timeline state machine hook.
 *
 * Manages:
 * - Selected clip (for the properties panel)
 * - Playhead position (shared with canvas preview)
 * - Undo/redo stack (limited to 30 states)
 * - Clip mutation operations (add, remove, update, move)
 *
 * WHY a custom hook over Zustand: timeline state is local to the editor
 * view and doesn't need to persist across page navigation. The project
 * gets saved to the store/API explicitly when the user clicks Save.
 */

import { useState, useCallback, useRef } from 'react';
import type { AdTimeline, Track, Clip } from '@shared/types';

const MAX_UNDO_STACK = 30;

interface UseMediaTimelineResult {
  timeline: AdTimeline;
  selectedClipId: string | null;
  playheadPosition: number;

  // Playhead
  setPlayheadPosition: (position: number) => void;

  // Selection
  selectClip: (clipId: string | null) => void;

  // Mutations
  updateClip: (trackId: string, clipId: string, patch: Partial<Clip['data']>) => void;
  moveClip: (trackId: string, clipId: string, newStartTime: number) => void;
  resizeClip: (trackId: string, clipId: string, newDuration: number) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /** Returns the currently selected clip, or null */
  getSelectedClip: () => { track: Track; clip: Clip } | null;
}

export function useMediaTimeline(initialTimeline: AdTimeline): UseMediaTimelineResult {
  const [timeline, setTimeline] = useState<AdTimeline>(initialTimeline);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [playheadPosition, setPlayheadPosition] = useState(0);

  // Undo/redo stacks hold serialized timeline snapshots
  const undoStack = useRef<AdTimeline[]>([]);
  const redoStack = useRef<AdTimeline[]>([]);

  const pushUndo = useCallback((prev: AdTimeline): void => {
    undoStack.current.push(prev);
    if (undoStack.current.length > MAX_UNDO_STACK) {
      undoStack.current.shift();
    }
    redoStack.current = []; // Clear redo on new action
  }, []);

  const mutate = useCallback(
    (updater: (prev: AdTimeline) => AdTimeline): void => {
      setTimeline((prev) => {
        pushUndo(prev);
        return updater(prev);
      });
    },
    [pushUndo]
  );

  const selectClip = useCallback((clipId: string | null): void => {
    setSelectedClipId(clipId);
  }, []);

  const updateClip = useCallback(
    (trackId: string, clipId: string, patch: Partial<Clip['data']>): void => {
      mutate((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) =>
          track.id !== trackId
            ? track
            : {
                ...track,
                clips: track.clips.map((clip) =>
                  clip.id !== clipId
                    ? clip
                    : { ...clip, data: { ...clip.data, ...patch } as Clip['data'] }
                ),
              }
        ),
      }));
    },
    [mutate]
  );

  const moveClip = useCallback(
    (trackId: string, clipId: string, newStartTime: number): void => {
      mutate((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) =>
          track.id !== trackId
            ? track
            : {
                ...track,
                clips: track.clips.map((clip) =>
                  clip.id !== clipId
                    ? clip
                    : { ...clip, startTime: Math.max(0, newStartTime) }
                ),
              }
        ),
      }));
    },
    [mutate]
  );

  const resizeClip = useCallback(
    (trackId: string, clipId: string, newDuration: number): void => {
      mutate((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) =>
          track.id !== trackId
            ? track
            : {
                ...track,
                clips: track.clips.map((clip) =>
                  clip.id !== clipId
                    ? clip
                    : { ...clip, duration: Math.max(0.5, newDuration) }
                ),
              }
        ),
      }));
    },
    [mutate]
  );

  const toggleTrackMute = useCallback(
    (trackId: string): void => {
      mutate((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) =>
          track.id !== trackId ? track : { ...track, muted: !track.muted }
        ),
      }));
    },
    [mutate]
  );

  const toggleTrackLock = useCallback(
    (trackId: string): void => {
      mutate((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) =>
          track.id !== trackId ? track : { ...track, locked: !track.locked }
        ),
      }));
    },
    [mutate]
  );

  const undo = useCallback((): void => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setTimeline((current) => {
      redoStack.current.push(current);
      return prev;
    });
  }, []);

  const redo = useCallback((): void => {
    const next = redoStack.current.pop();
    if (!next) return;
    setTimeline((current) => {
      undoStack.current.push(current);
      return next;
    });
  }, []);

  const getSelectedClip = useCallback((): { track: Track; clip: Clip } | null => {
    if (!selectedClipId) return null;
    for (const track of timeline.tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) return { track, clip };
    }
    return null;
  }, [selectedClipId, timeline]);

  return {
    timeline,
    selectedClipId,
    playheadPosition,
    setPlayheadPosition,
    selectClip,
    updateClip,
    moveClip,
    resizeClip,
    toggleTrackMute,
    toggleTrackLock,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    getSelectedClip,
  };
}
