/**
 * Centralised Express error handler.
 *
 * Must be registered LAST in the middleware chain (after all routes).
 * Express identifies error handlers by their 4-argument signature.
 *
 * Converts AppError instances to structured ApiErrorBody responses.
 * Unexpected errors (non-AppError) are logged with full stack trace and
 * returned as generic 500s — never leak internal details to the client.
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';
import { AppError } from '../../lib/errors';
import type { ApiErrorBody } from '../../types/api';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express error handler requires 4 params
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    // Known operational error — structured response, no stack trace leak
    if (err.statusCode >= 500) {
      logger.error('Application error', { code: err.code, message: err.message });
    } else {
      logger.warn('Client error', { code: err.code, message: err.message, status: err.statusCode });
    }

    const body: ApiErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };

    res.status(err.statusCode).json(body);
    return;
  }

  // Unexpected error — log everything, return safe generic message
  logger.error('Unhandled error', { err });

  const body: ApiErrorBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };

  res.status(500).json(body);
}
