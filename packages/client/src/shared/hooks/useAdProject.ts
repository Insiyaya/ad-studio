/**
 * Project CRUD hook.
 *
 * Fetches the project on mount, provides an update function that calls the
 * API and applies an optimistic local patch. All 3 async states are
 * represented: loading, error, success.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../lib/apiClient';
import { useAdStudioStore } from '../lib/store';
import type {
  AdProject,
  GetProjectResponseBody,
  UpdateProjectRequestBody,
  UpdateProjectResponseBody,
} from '../types';

interface UseAdProjectResult {
  project: AdProject | null;
  loading: boolean;
  error: string | null;
  update: (patch: UpdateProjectRequestBody) => Promise<AdProject | null>;
  reload: () => void;
}

export function useAdProject(projectId: string | null): UseAdProjectResult {
  const setProject = useAdStudioStore((s) => s.setProject);
  const patchProject = useAdStudioStore((s) => s.patchProject);
  const storeProject = useAdStudioStore((s) => s.project);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    apiClient
      .get<GetProjectResponseBody>(`/api/projects/${projectId}`)
      .then((data) => {
        setProject(data.project);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof ApiError ? err.message : 'Failed to load project';
        setError(message);
        setLoading(false);
      });
  }, [projectId, fetchKey, setProject]);

  const update = useCallback(
    async (patch: UpdateProjectRequestBody): Promise<AdProject | null> => {
      if (!projectId) return null;

      // Optimistic update - UI reflects the change before the server confirms
      if (patch.timeline) patchProject({ timeline: patch.timeline });
      if (patch.name) patchProject({ name: patch.name });
      if (patch.voiceoverScript !== undefined) {
        patchProject({ voiceoverScript: patch.voiceoverScript });
      }

      try {
        const data = await apiClient.put<UpdateProjectResponseBody>(
          `/api/projects/${projectId}`,
          patch
        );
        setProject(data.project);
        return data.project;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to save project';
        setError(message);
        return null;
      }
    },
    [projectId, setProject, patchProject]
  );

  const reload = useCallback(() => setFetchKey((k) => k + 1), []);

  return {
    project: storeProject,
    loading,
    error,
    update,
    reload,
  };
}
