import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, type ErrorCode } from '../utils/app-error';

/**
 * Canonical error envelope shape. The `success` discriminator matches the
 * contract shared with the business-logic layer (see `src/types/api.types.ts`
 * which is owned by the typescript-pro layer).
 */
interface ErrorResponseEnvelope {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Shape of the body-parser error emitted by `express.json()` when a request
 * carries `Content-Type: application/json` but the body is malformed. The
 * runtime shape uses `type === 'entity.parse.failed'` and a numeric `status`;
 * we check for the presence of those fields rather than rely on `instanceof`
 * because body-parser's own `SyntaxError` is not exported for typing.
 */
interface BodyParserError {
  type: string;
  status?: number;
}

function isBodyParseError(err: unknown): err is BodyParserError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: unknown }).type === 'entity.parse.failed'
  );
}

/**
 * 404 handler for routes that did not match any registered endpoint.
 * Expressed as a request handler so it can be mounted after the main router
 * and delegate to the global error middleware via `next(err)`.
 */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound('Route'));
};

/**
 * Global error middleware. Must be the very last middleware mounted on the
 * Express app so that it receives any `next(err)` bubbled up from handlers.
 */
export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const payload: ErrorResponseEnvelope = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
    res.status(err.statusCode).json(payload);
    return;
  }

  // Client-side failure from `express.json()` when the body is not valid
  // JSON. Surface as a 400 BAD_REQUEST rather than letting it fall through
  // to the generic 500 branch below — malformed JSON is user input, not a
  // server fault, and logging a stack for every such request is noise.
  if (isBodyParseError(err)) {
    const payload: ErrorResponseEnvelope = {
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON body',
      },
    };
    res.status(400).json(payload);
    return;
  }

  // Unexpected error: log the full detail server-side, but never leak the
  // stack or internal message to the client.
  // eslint-disable-next-line no-console
  console.error('[error.middleware] Unhandled error:', err);

  const payload: ErrorResponseEnvelope = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  };
  res.status(500).json(payload);
};
