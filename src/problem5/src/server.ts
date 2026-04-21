import 'dotenv/config';
import type { Server } from 'http';
import app from './app';
import { disconnectPrisma } from './utils/prisma';

const DEFAULT_PORT = 3000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_HEADERS_TIMEOUT_MS = 10_000;

function parseNumericEnv(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const PORT = parseNumericEnv(process.env.PORT, DEFAULT_PORT);
const SHUTDOWN_TIMEOUT_MS = parseNumericEnv(
  process.env.SHUTDOWN_TIMEOUT_MS,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
);

const server: Server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${PORT}`);
});

// Bound socket-level timeouts so that slow-body / slowloris-style clients
// cannot tie up file descriptors for the Node default (5 minutes). Override
// via env for environments that legitimately expect long-lived requests.
server.requestTimeout = parseNumericEnv(
  process.env.REQUEST_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
);
server.headersTimeout = parseNumericEnv(
  process.env.HEADERS_TIMEOUT_MS,
  DEFAULT_HEADERS_TIMEOUT_MS,
);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[server] ${signal} received, shutting down gracefully`);

  server.close(async (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error('[server] error while closing HTTP server:', err);
      process.exitCode = 1;
    }

    try {
      await disconnectPrisma();
    } catch (disconnectErr) {
      // eslint-disable-next-line no-console
      console.error('[server] error while disconnecting Prisma:', disconnectErr);
      process.exitCode = 1;
    }

    process.exit(process.exitCode ?? 0);
  });

  // Forcefully exit if shutdown takes too long (e.g. hanging sockets).
  // Tunable via `SHUTDOWN_TIMEOUT_MS` for k8s-style terminationGracePeriod.
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('[server] forced shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

export default server;
