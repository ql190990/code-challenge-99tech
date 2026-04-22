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
 * Shape of the body-parser error emitted by `express.json()`. `type` is the
 * machine-readable failure class (`entity.parse.failed` for malformed JSON,
 * `entity.too.large` for payloads over the configured limit); `status` is
 * the HTTP code body-parser recommends. We check for property presence
 * rather than rely on `instanceof` because body-parser's errors are not
 * exported for typing.
 */
interface BodyParserError {
  type: string;
  status?: number;
}

function isBodyParserError(err: unknown, expectedType: string): err is BodyParserError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: unknown }).type === expectedType
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
  if (isBodyParserError(err, 'entity.parse.failed')) {
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

  // Body above the configured 16 KB limit — a client error, not a server
  // fault. Return 413 PAYLOAD_TOO_LARGE with a clear envelope instead of a
  // generic 500 with a logged stack.
  if (isBodyParserError(err, 'entity.too.large')) {
    const payload: ErrorResponseEnvelope = {
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds the 16KB limit',
      },
    };
    res.status(413).json(payload);
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
