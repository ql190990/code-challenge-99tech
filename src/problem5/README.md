# Problem 5 — Product CRUD API

## Overview

A production-oriented CRUD REST API for managing products, built with
Express, TypeScript, Prisma, and Zod on PostgreSQL. The schema, migrations,
and integration tests all target the same database engine so there is no
provider drift between development, testing, and production.

## Prerequisites

- Node.js **>= 18**
- npm (bundled with Node)
- Docker and Docker Compose — the bundled `docker-compose.yml` provides the
  PostgreSQL 16 instance used by both `npm run dev` and `npm test`.

## Quick Start

```bash
# 1. Start PostgreSQL 16 (creates both `problem5` and `problem5_test` databases)
docker compose up -d

# 2. Copy the environment template
cp .env.example .env

# 3. Install dependencies (triggers `prisma generate` via the Prisma postinstall hook)
npm install

# 4. Apply the initial migration against the dev database
npm run db:migrate -- --name init

# 5. Start the dev server
npm run dev
```

The server listens on <http://localhost:3000>. Health check: `GET /api/health`.

Stop the database with `docker compose down`. Add `-v` if you want to wipe
the named volume and start over — that will re-run `docker/init-db.sql` on
the next `up`, which recreates the `problem5_test` sibling database.

## Environment Variables

| Variable       | Required | Default                                                                      | Description                                                        |
|----------------|----------|------------------------------------------------------------------------------|--------------------------------------------------------------------|
| `DATABASE_URL` | yes      | `postgresql://postgres:postgres@localhost:5433/problem5?schema=public`       | PostgreSQL connection string. Must match the port mapping in `docker-compose.yml`. |
| `PORT`         | no       | `3000`                                                                       | HTTP port the Express server binds to.                             |
| `NODE_ENV`     | no       | `development`                                                                | Standard Node environment flag. Controls Prisma log verbosity.     |

Optional tuning knobs (all take effect on next server start):

| Variable                 | Default      | Purpose                                                  |
|--------------------------|--------------|----------------------------------------------------------|
| `CORS_ALLOWED_ORIGINS`   | *(disabled)* | Comma-separated allowlist (e.g. `https://app.example.com`). Set to `*` to mirror the permissive dev default. When unset, CORS responses have no `Access-Control-Allow-Origin` header and browsers cannot read responses cross-origin. |
| `TRUST_PROXY`            | `1`          | `app.set('trust proxy', …)` — one hop suits most reverse proxies (nginx / ALB / k8s ingress). Any valid Express value is accepted. |
| `REQUEST_TIMEOUT_MS`     | `30000`      | HTTP server `requestTimeout`. Caps slow-body / slowloris socket lifetime. |
| `HEADERS_TIMEOUT_MS`     | `10000`      | HTTP server `headersTimeout`. Clients must finish sending headers within this window. |
| `SHUTDOWN_TIMEOUT_MS`    | `10000`      | Forced-exit deadline after `SIGINT` / `SIGTERM`. Tune to match k8s `terminationGracePeriodSeconds`. |

## API Documentation

All endpoints are prefixed with `/api`. Successful responses follow the
envelope `{ "success": true, "data": ... }`; failures follow
`{ "success": false, "error": { "code", "message", "details?" } }`.

### Health

- `GET /api/health`

```bash
curl http://localhost:3000/api/health
```

```json
{ "success": true, "data": { "status": "ok" } }
```

### Create a product — `POST /api/products`

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mechanical Keyboard",
    "description": "Hot-swappable 75% layout",
    "price": 149.99,
    "category": "peripherals"
  }'
```

Response `201 Created`:

```json
{
  "success": true,
  "data": {
    "id": "clv8a3kx10000u7o7m5b9dq4j",
    "name": "Mechanical Keyboard",
    "description": "Hot-swappable 75% layout",
    "price": 149.99,
    "category": "peripherals",
    "createdAt": "2026-04-21T10:00:00.000Z",
    "updatedAt": "2026-04-21T10:00:00.000Z"
  }
}
```

Validation failure `400 Bad Request`:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "formErrors": [],
      "fieldErrors": { "price": ["Expected number, received string"] }
    }
  }
}
```

### List products — `GET /api/products`

Supports basic filters: `name` (substring, case-insensitive — compiles to
`ILIKE` on PostgreSQL) and `category` (exact match), plus `page` (default
`1`) and `limit` (default `10`, max `100`) for pagination.

```bash
curl "http://localhost:3000/api/products?category=peripherals&name=keyboard&page=1&limit=20"
```

Response `200 OK`:

```json
{
  "success": true,
  "data": [
    {
      "id": "clv8a3kx10000u7o7m5b9dq4j",
      "name": "Mechanical Keyboard",
      "description": "Hot-swappable 75% layout",
      "price": 149.99,
      "category": "peripherals",
      "createdAt": "2026-04-21T10:00:00.000Z",
      "updatedAt": "2026-04-21T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

### Get a product by id — `GET /api/products/:id`

```bash
curl http://localhost:3000/api/products/clv8a3kx10000u7o7m5b9dq4j
```

Response `200 OK`:

```json
{
  "success": true,
  "data": {
    "id": "clv8a3kx10000u7o7m5b9dq4j",
    "name": "Mechanical Keyboard",
    "description": "Hot-swappable 75% layout",
    "price": 149.99,
    "category": "peripherals",
    "createdAt": "2026-04-21T10:00:00.000Z",
    "updatedAt": "2026-04-21T10:00:00.000Z"
  }
}
```

Not-found `404 Not Found`:

```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "Product not found" }
}
```

### Update a product — `PATCH /api/products/:id`

Partial update: send only the fields you want to change. The endpoint uses
`PATCH` (not `PUT`) because the body is a merge, not a full replacement —
this matches RFC 7231 §4.3.4. At least one field must be provided.

```bash
curl -X PATCH http://localhost:3000/api/products/clv8a3kx10000u7o7m5b9dq4j \
  -H "Content-Type: application/json" \
  -d '{ "price": 129.99 }'
```

Response `200 OK`:

```json
{
  "success": true,
  "data": {
    "id": "clv8a3kx10000u7o7m5b9dq4j",
    "name": "Mechanical Keyboard",
    "description": "Hot-swappable 75% layout",
    "price": 129.99,
    "category": "peripherals",
    "createdAt": "2026-04-21T10:00:00.000Z",
    "updatedAt": "2026-04-21T10:05:00.000Z"
  }
}
```

### Delete a product — `DELETE /api/products/:id`

```bash
curl -X DELETE http://localhost:3000/api/products/clv8a3kx10000u7o7m5b9dq4j
```

Response `204 No Content` (empty body). Attempting to delete a
non-existent product returns the same `404 Not Found` envelope shown above.

## Project Structure

```
problem5/
├── docker/
│   └── init-db.sql            # Creates `problem5_test` alongside the dev DB on first `docker compose up`
├── prisma/
│   ├── migrations/            # Prisma migration history (PostgreSQL SQL)
│   └── schema.prisma          # Prisma data model (Product) — PostgreSQL provider
├── src/
│   ├── app.ts                 # Express app factory (middlewares, router, error handlers)
│   ├── server.ts              # Process entrypoint, port binding, graceful shutdown
│   ├── controllers/           # HTTP controllers (thin — delegate to services)
│   ├── middlewares/           # Cross-cutting middlewares (validation, error handling)
│   ├── repositories/          # Prisma-backed data access layer
│   ├── routes/                # Router composition (index + per-resource routes)
│   ├── services/              # Business logic, orchestrates repositories
│   ├── types/                 # Shared TypeScript + Zod schemas
│   └── utils/                 # Shared utilities (AppError, prisma singleton)
├── tests/                     # Jest + Supertest integration tests
├── .env.example               # Template for environment variables
├── docker-compose.yml         # PostgreSQL 16 for dev + test
├── jest.config.js             # Jest configuration (ts-jest preset)
├── package.json               # Scripts, dependencies, engines
├── tsconfig.json              # Strict TypeScript configuration
└── tsconfig.test.json         # Extends tsconfig for the test sources
```

## Testing

```bash
# Make sure the PostgreSQL container is running
docker compose up -d

# Run the suite (pretest pushes the schema to `problem5_test`)
npm test
```

The suite exercises each endpoint end-to-end against the `problem5_test`
database, covering happy paths, validation errors, malformed JSON bodies,
and not-found responses. Tests run serially (`--runInBand`) to keep the
Prisma connection pool predictable.

## Security & Operational Scope

This implementation satisfies the Problem 5 brief (CRUD interface,
persistence, configuration, documentation) but intentionally defers
several cross-cutting production concerns so the submission stays focused.
A production deployment would need to add, at minimum:

- **Authentication & authorisation.** Every endpoint today is unauthenticated.
  Add JWT Bearer or session-cookie middleware before the API router; gate
  writes behind a scoped role. `/api/health` can stay public.
- **Rate limiting.** No per-IP / per-token limiter is installed.
  `express-rate-limit` on `/api` (global) plus stricter caps on write
  endpoints closes the most obvious scraping / brute-force vectors.
- **Structured request logging.** Errors currently log to `stderr` via
  `console.error` with no request correlation. `pino-http` with a generated
  request id is a five-minute addition that makes incidents debuggable.
- **TLS.** The server listens on plaintext HTTP. Production should always be
  fronted by a TLS-terminating proxy; helmet already sets HSTS for HTTPS
  requests, so the remaining work is infrastructure, not application code.

Within-scope hardening that IS applied:

- **Strict JSON body limit** (16 kB) and bounded HTTP timeouts (see table
  above) to blunt slowloris-style attacks.
- **Query parser set to `simple`** (`app.ts`) — rejects HTTP Parameter
  Pollution / prototype-adjacent shapes like `?x[__proto__][polluted]=1`.
- **`app.set('trust proxy', 1)`** — rate limiters and `X-Forwarded-For`
  readers will see the real client IP when fronted by one reverse proxy.
- **Helmet** with `Cross-Origin-Resource-Policy: cross-origin` so that the
  CORS allowlist is the single authority on cross-origin reads.
- **Zod `.strict()`** on every request schema — rejects unknown fields to
  close silent-acceptance footguns.
- **Global error middleware** translates `express.json()` parse failures to
  a clean `400 BAD_REQUEST` rather than leaking a `500` with a stack trace.

## Notes on Data Model

- **`price: Float`.** The schema uses `Float` (PostgreSQL `DOUBLE
  PRECISION`) for developer ergonomics in this demo. For real money
  arithmetic a production build should migrate to `Decimal` (Prisma maps
  this to PostgreSQL `NUMERIC`) or store minor units as `Int` (cents) —
  either choice eliminates IEEE-754 rounding error on aggregates.
- **Indexes.** `@@index([category, createdAt(sort: Desc)])` serves the
  typical "list latest in category" query pattern with a single index
  traversal; `@@index([createdAt(sort: Desc)])` covers the plain list
  order. `name` is deliberately unindexed because `contains` produces a
  leading wildcard that a plain btree cannot serve. For large catalogues,
  add `CREATE EXTENSION pg_trgm` and a GIN index on `name` with
  `gin_trgm_ops`.
