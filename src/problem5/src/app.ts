import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorMiddleware, notFoundHandler } from './middlewares/error.middleware';
import apiRouter from './routes';

/**
 * Parse a comma-separated allowlist of CORS origins. An empty value means
 * "reflect origin-disabled" (no CORS headers, so browsers cannot read
 * responses cross-origin). The value `*` means "reflect any origin" and is
 * intended for local development only.
 */
function resolveCorsOptions(): CorsOptions {
  const raw = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (!raw || raw === '*') {
    // `*` is the documented dev default; explicitly set it here so an empty
    // env var does not accidentally enable CORS everywhere.
    return { origin: raw === '*' ? '*' : false };
  }
  const allowlist = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return {
    origin: allowlist,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    maxAge: 600,
  };
}

/**
 * Build and return the Express application. The function is side-effect free
 * so that the same app can be booted by `server.ts` for production and
 * instantiated inside Supertest in the test suite.
 */
export function createApp(): Express {
  const app = express();

  // Trust a single hop of reverse proxy (common when fronted by nginx / ALB
  // / k8s ingress). Required for future IP-based rate limiting to see the
  // client IP via `X-Forwarded-For`. Configurable via `TRUST_PROXY`.
  const trustProxy = process.env.TRUST_PROXY ?? '1';
  app.set('trust proxy', trustProxy);

  // Switch off the nested-object query parser (default is `extended` via
  // `qs`). We only accept scalar query parameters, and the simple parser
  // defends against HTTP parameter pollution shapes like
  // `?name[$ne]=…` or `?x[__proto__][polluted]=1`.
  app.set('query parser', 'simple');

  // Helmet defaults are sensible but include a `Cross-Origin-Resource-Policy:
  // same-origin` header that silently contradicts the permissive CORS
  // allowlist for a JSON API. Loosen it to `cross-origin` so that CORS is
  // the single authority on cross-origin reads.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors(resolveCorsOptions()));

  // Bound the JSON body size. 16kb is plenty for a Product payload and
  // prevents a concurrency-amplified DoS where each request queues 100kB
  // of JSON for parsing.
  app.use(express.json({ limit: '16kb', strict: true }));

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorMiddleware);

  return app;
}

const app = createApp();

export default app;
