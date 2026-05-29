/**
 * Lightweight request validation helpers.
 *
 * WHY no external schema library (Zod, Joi, etc.):
 * Adding a schema library just for two routes introduces a dependency and
 * learning curve for no additional type safety benefit here — TypeScript
 * already enforces the validated shape once we cast. These helpers stay
 * readable and replaceable.
 *
 * Each validator function returns typed data or throws an AppError with
 * field-level details that the error handler converts to a 400 response.
 */

import { badRequest } from '../../lib/errors';
import type { CreateCrawlRequestBody, UpdateProjectRequestBody } from '../../types/api';
import type { AdProject } from '../../types/project';

// ── URL validation ─────────────────────────────────────────────────────────

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Validates and normalises the URL from a crawl request body.
 * Throws AppError(400) for missing, malformed, or non-HTTP(S) URLs.
 */
export function validateCrawlBody(body: unknown): CreateCrawlRequestBody {
  if (!body || typeof body !== 'object') {
    throw badRequest('Request body must be a JSON object');
  }

  const raw = (body as Record<string, unknown>)['url'];

  if (typeof raw !== 'string' || raw.trim() === '') {
    throw badRequest('Validation failed', { url: ['url is required and must be a non-empty string'] });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw badRequest('Validation failed', { url: ['url must be a valid URL (e.g. https://example.com)'] });
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw badRequest('Validation failed', { url: ['url must use http or https'] });
  }

  return { url: parsed.href };
}

// ── Project update validation ──────────────────────────────────────────────

const VALID_RESOLUTIONS = new Set<AdProject['exportSettings']['resolution']>([
  '1920x1080',
  '1080x1920',
  '1080x1080',
]);
const VALID_ASPECT_RATIOS = new Set<AdProject['exportSettings']['aspectRatio']>([
  '16:9',
  '9:16',
  '1:1',
]);
const VALID_FORMATS = new Set<AdProject['exportSettings']['format']>(['mp4', 'webm']);
const VALID_FPS = new Set<AdProject['exportSettings']['fps']>([30, 60]);

/**
 * Validates and narrows the body of a PUT /api/projects/:id request.
 * All fields are optional — only present fields are validated.
 */
export function validateUpdateProjectBody(body: unknown): UpdateProjectRequestBody {
  if (!body || typeof body !== 'object') {
    throw badRequest('Request body must be a JSON object');
  }

  const b = body as Record<string, unknown>;
  const errors: Record<string, string[]> = {};

  if ('name' in b) {
    if (typeof b['name'] !== 'string' || (b['name'] as string).trim() === '') {
      errors['name'] = ['name must be a non-empty string'];
    }
  }

  if ('voiceoverScript' in b) {
    if (b['voiceoverScript'] !== null && typeof b['voiceoverScript'] !== 'string') {
      errors['voiceoverScript'] = ['voiceoverScript must be a string or null'];
    }
  }

  if ('exportSettings' in b && b['exportSettings'] != null) {
    const es = b['exportSettings'] as Record<string, unknown>;
    const esErrors: string[] = [];

    if ('resolution' in es && !VALID_RESOLUTIONS.has(es['resolution'] as AdProject['exportSettings']['resolution'])) {
      esErrors.push(`resolution must be one of: ${[...VALID_RESOLUTIONS].join(', ')}`);
    }
    if ('aspectRatio' in es && !VALID_ASPECT_RATIOS.has(es['aspectRatio'] as AdProject['exportSettings']['aspectRatio'])) {
      esErrors.push(`aspectRatio must be one of: ${[...VALID_ASPECT_RATIOS].join(', ')}`);
    }
    if ('format' in es && !VALID_FORMATS.has(es['format'] as AdProject['exportSettings']['format'])) {
      esErrors.push(`format must be one of: ${[...VALID_FORMATS].join(', ')}`);
    }
    if ('fps' in es && !VALID_FPS.has(es['fps'] as AdProject['exportSettings']['fps'])) {
      esErrors.push('fps must be 30 or 60');
    }

    if (esErrors.length > 0) {
      errors['exportSettings'] = esErrors;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw badRequest('Validation failed', errors);
  }

  // Safe to cast — all present fields have been validated
  return b as unknown as UpdateProjectRequestBody;
}
