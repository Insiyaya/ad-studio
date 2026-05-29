/**
 * In-memory project store.
 *
 * WHY in-memory: projects are the user-facing work artefact. In production
 * they would be persisted to Oracle Autonomous Database (or any JSON-capable
 * store) so they survive restarts. For the prototype, in-memory gives the
 * same API contract with zero infrastructure dependency.
 *
 * The store interface is deliberately narrow — callers may not iterate all
 * projects or access internals. This keeps the upgrade path to a real DB clean.
 */

import type { AdProject } from '../../types/project';

class ProjectStore {
  private readonly projects = new Map<string, AdProject>();

  set(project: AdProject): void {
    this.projects.set(project.id, project);
  }

  get(id: string): AdProject | undefined {
    return this.projects.get(id);
  }

  /**
   * Applies a partial update to a project and bumps updatedAt.
   * Returns the updated project, or null if not found.
   */
  update(id: string, patch: Partial<Omit<AdProject, 'id' | 'createdAt'>>): AdProject | null {
    const existing = this.projects.get(id);
    if (!existing) return null;

    const updated: AdProject = { ...existing, ...patch, updatedAt: Date.now() };
    this.projects.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.projects.delete(id);
  }

  has(id: string): boolean {
    return this.projects.has(id);
  }
}

/** Singleton — shared across routes and services */
export const projectStore = new ProjectStore();
