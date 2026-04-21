import { PrismaClient } from '@prisma/client';

/**
 * Lazily-initialised singleton Prisma client.
 *
 * We keep the instance on `globalThis` so that:
 *   - Multiple modules importing this file share the same client.
 *   - ts-node-dev and jest (which re-require modules) don't spawn a new
 *     connection pool on every reload.
 *
 * Consumers should always import the named `prisma` export; they should
 * never instantiate `PrismaClient` directly.
 */

type PrismaGlobal = typeof globalThis & {
  __problem5Prisma?: PrismaClient;
};

const globalForPrisma = globalThis as PrismaGlobal;

function createPrismaClient(): PrismaClient {
  // Silence Prisma's error-level logs in the test environment — the
  // repository intentionally catches `P2025` to map missing records to
  // clean 404s, but Prisma writes to stderr regardless of whether the
  // caller handles the error, producing noisy test output for
  // deliberately-provoked "not found" paths.
  const env = process.env.NODE_ENV ?? 'development';
  const log = env === 'test'
    ? []
    : env === 'development'
      ? (['warn', 'error'] as const)
      : (['error'] as const);
  return new PrismaClient({ log: [...log] });
}

export const prisma: PrismaClient =
  globalForPrisma.__problem5Prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__problem5Prisma = prisma;
}

/**
 * Cleanly disconnect the shared Prisma client. Invoked by graceful server
 * shutdown and by Jest's global teardown so the process can exit cleanly.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  if (globalForPrisma.__problem5Prisma) {
    delete globalForPrisma.__problem5Prisma;
  }
}
