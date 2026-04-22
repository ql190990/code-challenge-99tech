/**
 * Application-level error hierarchy used by every layer of the API.
 *
 * The shape of this module is a LOCKED CONTRACT — the business-logic layer
 * (controllers, services, middlewares) imports `AppError` and `ErrorCode`
 * from here and relies on the static factory helpers below. Do not change
 * the public signatures without coordinating with the consumer.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static notFound(resource: string): AppError {
    return new AppError(404, 'NOT_FOUND', `${resource} not found`);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details: unknown): AppError {
    return new AppError(400, 'VALIDATION_ERROR', 'Validation failed', details);
  }
}
