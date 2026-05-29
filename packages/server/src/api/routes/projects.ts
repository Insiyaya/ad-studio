import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';
import { projectStore } from '../../services/projects/store';
import { validateUpdateProjectBody } from '../middleware/validate';
import { notFound } from '../../lib/errors';
import type {
  GetProjectResponseBody,
  UpdateProjectResponseBody,
} from '../../types/api';

export const projectsRouter = Router();

projectsRouter.get('/:id', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { id } = req.params;

    if (!id) {
      next(notFound('Project', ''));
      return;
    }

    const project = projectStore.get(id);
    if (!project) {
      next(notFound('Project', id));
      return;
    }

    const body: GetProjectResponseBody = { project };
    res.json(body);
  } catch (err) {
    next(err);
  }
});


projectsRouter.put('/:id', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { id } = req.params;

    if (!id) {
      next(notFound('Project', ''));
      return;
    }

    if (!projectStore.has(id)) {
      next(notFound('Project', id));
      return;
    }

    const patch = validateUpdateProjectBody(req.body);

   
    const update: Parameters<typeof projectStore.update>[1] = {};

    if (patch.name !== undefined) update.name = patch.name;
    if (patch.timeline !== undefined) update.timeline = patch.timeline;
    if (patch.voiceoverScript !== undefined) update.voiceoverScript = patch.voiceoverScript;
    if (patch.exportSettings !== undefined) update.exportSettings = {
      ...projectStore.get(id)?.exportSettings,
      ...patch.exportSettings,
    } as typeof update.exportSettings;

    const updated = projectStore.update(id, update);

    if (!updated) {
      next(notFound('Project', id));
      return;
    }

    logger.info('Project updated', { projectId: id, fields: Object.keys(update) });

    const body: UpdateProjectResponseBody = { project: updated };
    res.json(body);
  } catch (err) {
    next(err);
  }
});
