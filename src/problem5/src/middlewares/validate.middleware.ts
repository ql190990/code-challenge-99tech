import type { RequestHandler } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { AppError } from '../utils/app-error';

/**
 * The portion of the request we want to validate.
 */
export type ValidationSource = 'body' | 'query' | 'params';

/**
 * Express v5 made `req.query` and `req.params` read-only getters. Re-assigning
 * `req.query = parsed` throws at runtime. To keep the controllers agnostic of
 * the Express version while still giving them a fully-typed, parsed payload,
 * we take a two-pronged approach:
 *
 *   1. We always stash the parsed value on `res.locals.validated[source]`,
 *      which is the canonical place controllers should read from when they
 *      care about strict typing.
 *
 *   2. For `body` we also replace `req.body` in-place (it remains writable in
 *      Express v4 and v5), so existing consumers that read from `req.body`
 *      continue to work and receive the coerced/stripped value.
 *
 *   3. For `query` and `params` we attempt `Object.defineProperty` to expose
 *      the parsed value as a data property. If the host Express build rejects
 *      the redefinition, we silently fall back to `res.locals.validated`
 *      (which the controllers are wired to read).
 *
 * Validation failures are surfaced as `AppError.validation(zodError.flatten())`
 * via `next(err)` so the global error handler produces a uniform envelope.
 */
export function validate(schema: ZodSchema, source: ValidationSource): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const zodError: ZodError = result.error;
      next(AppError.validation(zodError.flatten()));
      return;
    }

    const parsed = result.data;

    const locals = res.locals as { validated?: Partial<Record<ValidationSource, unknown>> };
    if (!locals.validated) {
      locals.validated = {};
    }
    locals.validated[source] = parsed;

    if (source === 'body') {
      req.body = parsed;
    } else {
      try {
        Object.defineProperty(req, source, {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch {
        // Express v5 may reject redefinition on `query` / `params`.
        // Controllers should read from `res.locals.validated[source]` in that
        // case — the value is already stashed above.
      }
    }

    next();
  };
}
