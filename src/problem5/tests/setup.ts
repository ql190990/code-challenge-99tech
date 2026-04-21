/**
 * Jest setup executed once before the test files are required.
 *
 * We pin `NODE_ENV=test` so the Prisma client is created with the
 * noise-suppressed log level (see `src/utils/prisma.ts`). `DATABASE_URL`
 * is expected to be provided by the `pretest` npm script — it points at
 * a sibling `problem5_test` PostgreSQL database so tests never touch the
 * developer's primary dataset.
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

if (!process.env.DATABASE_URL) {
  throw new Error(
    '[tests/setup] DATABASE_URL is not set. Run `npm test` (the script sets it to the problem5_test database) and make sure `docker compose up -d` is running.',
  );
}
