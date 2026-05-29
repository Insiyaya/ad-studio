/**
 * Global Zustand store.
 *
 * Holds the top-level application state that is shared across features:
 * - Active crawl job (while URL is being processed)
 * - Active project (once a crawl completes or a project is loaded)
 *
 * WHY Zustand over React context: no Provider wrapping, no re-render cascade.
 * Each component subscribes to exactly the slices it needs.
 *
 * Feature-local state (e.g. timeline selection, player position) lives in
 * custom hooks inside those features - not in this global store.
 */

import { create } from 'zustand';
import type { CrawlJob, AdProject } from '../types';

interface AdStudioStore {
  // ── Crawl state ──────────────────────────────────────────────────────────
  crawlJob: CrawlJob | null;
  setCrawlJob: (job: CrawlJob | null) => void;

  // ── Project state ─────────────────────────────────────────────────────────
  project: AdProject | null;
  setProject: (project: AdProject | null) => void;
  /** Applies a shallow merge to the in-memory project (optimistic update) */
  patchProject: (patch: Partial<AdProject>) => void;

  // ── Reset ─────────────────────────────────────────────────────────────────
  /** Clears all state - called when the user starts a new ad */
  reset: () => void;
}

export const useAdStudioStore = create<AdStudioStore>((set) => ({
  crawlJob: null,
  setCrawlJob: (job) => set({ crawlJob: job }),

  project: null,
  setProject: (project) => set({ project }),
  patchProject: (patch) =>
    set((state) =>
      state.project
        ? { project: { ...state.project, ...patch, updatedAt: Date.now() } }
        : state
    ),

  reset: () => set({ crawlJob: null, project: null }),
}));
