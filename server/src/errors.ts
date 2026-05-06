/**
 * GitMesh HTTP error primitives.
 *
 * Provides a lightweight exception hierarchy for returning structured
 * error responses from Express route handlers.
 */

export class HttpError extends Error {
  readonly statusCode: number;
  readonly errorDetails?: unknown;

  constructor(statusCode: number, description: string, errorDetails?: unknown) {
    super(description);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.errorDetails = errorDetails;
    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
  }

  /** Alias kept for backward-compat with middleware that reads `.status`. */
  get status(): number {
    return this.statusCode;
  }

  /** Alias kept for backward-compat with middleware that reads `.details`. */
  get details(): unknown {
    return this.errorDetails;
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      statusCode: this.statusCode,
      ...(this.errorDetails != null ? { details: this.errorDetails } : {}),
    };
  }
}

/* ─── factory helpers ────────────────────────────────────── */

export const badRequest = (message: string, details?: unknown): HttpError =>
  new HttpError(400, message, details);

export const unauthorized = (message = "Unauthorized"): HttpError =>
  new HttpError(401, message);

export const forbidden = (message = "Forbidden"): HttpError =>
  new HttpError(403, message);

export const notFound = (message = "Not found"): HttpError =>
  new HttpError(404, message);

export const conflict = (message: string, details?: unknown): HttpError =>
  new HttpError(409, message, details);

export const unprocessable = (message: string, details?: unknown): HttpError =>
  new HttpError(422, message, details);
