/**
 * Structured application error type.
 *
 * WHY a custom error class over plain Error:
 * - Carries HTTP status code, machine-readable code, and optional field-level
 *   validation details — everything the error handler middleware needs to build
 *   a well-shaped ApiErrorBody response without any instanceof guessing.
 * - Keeps controller code clean: `throw new AppError(404, 'NOT_FOUND', '...')`
 *   vs manually constructing error response objects everywhere.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
    // Restore prototype chain — required when extending built-in classes in TS
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Common factory helpers ─────────────────────────────────────────────────

export function notFound(resource: string, id: string): AppError {
  return new AppError(404, 'NOT_FOUND', `${resource} '${id}' not found`);
}

export function badRequest(message: string, details?: Record<string, string[]>): AppError {
  return new AppError(400, 'BAD_REQUEST', message, details);
}

export function conflict(message: string): AppError {
  return new AppError(409, 'CONFLICT', message);
}

export function internalError(message = 'An unexpected error occurred'): AppError {
  return new AppError(500, 'INTERNAL_ERROR', message);
}
