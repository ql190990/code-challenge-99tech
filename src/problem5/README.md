# Problem 5 — Product CRUD API

## Overview

A production-oriented CRUD REST API for managing products, built with
Express, TypeScript, Prisma, and Zod on PostgreSQL. The schema, migrations,
and integration tests all target the same database engine so there is no
provider drift between development, testing, and production.

## Prerequisites

- Docker and Docker Compose — primary runtime for the dev stack.
- Node.js **>= 18** and npm — only required for the "host-level" alternative
  (running `npm run dev` / `npm test` against a Postgres container).
- The repo ships two compose files:
  - [`docker-compose.yml`](./docker-compose.yml) — development stack: PostgreSQL
    16 + Express app with **hot reload** (`ts-node-dev`) and a **Node debugger**
    on port `9229`.
  - [`docker-compose.prod.yml`](./docker-compose.prod.yml) — production stack:
    compiled image from the `runtime` Dockerfile target, non-root, healthcheck.

## Quick Start

The shortest path to a running API is the **containerised dev stack** — one
command brings up PostgreSQL and the app, with source-code hot reload baked
in:

```bash
# 1. Copy the dev env template for the compose network (postgres:5432)
cp .env.docker.example .env.docker

# 2. Build the dev image and start both services in the background
docker compose up -d --build

# 3. Apply the initial migration — mandatory on a fresh volume
docker compose exec api npm run db:migrate -- --name init

# 4. Smoke test
curl http://localhost:3000/api/health
#    → {"success":true,"data":{"status":"ok"}}
```

The server listens on <http://localhost:3000>. Health check: `GET /api/health`.
Tear down with `docker compose down` (preserves the DB volume) or
`docker compose down -v` (wipes the volume and re-runs `docker/init-db.sql`
on the next `up`, which recreates the `problem5_test` sibling database).

The [Running with Docker Compose](#running-with-docker-compose) section
below covers the dev and prod flows in full, including the hot-reload /
debugger wiring and the production checklist.

### Alternative: host-level Node (without the app container)

Prefer running the server directly on the host with `npm run dev`? Start
only the PostgreSQL service, then use the host-level env template that
targets `localhost:5433` instead of the compose network hostname:

```bash
# 1. Start PostgreSQL 16 only (creates `problem5` + `problem5_test`)
docker compose up -d postgres

# 2. Copy the host env template (DATABASE_URL=localhost:5433)
cp .env.example .env

# 3. Install dependencies and migrate
npm install
npm run db:migrate -- --name init

# 4. Run the dev server on the host
npm run dev
```

This path shares the same PostgreSQL container as the full stack, so
switching between `npm run dev` (host) and `docker compose up api` (in
compose) is a matter of stopping one and starting the other. Do not run
both at the same time — both bind to host port `3000`.

> **Reviewer shortcut — 30-second smoke test.**
> Once the server is up (either via `docker compose up -d --build` or the host-level path above), import [`postman/problem5.postman_collection.json`](./postman/problem5.postman_collection.json) and [`postman/problem5.postman_environment.json`](./postman/problem5.postman_environment.json) into Postman and run the `00 — Smoke Test Flow` folder via the Collection Runner. Five requests execute end-to-end (health → create → get → patch → delete → 404 verify) and every assertion passes on a clean DB.
>
> CLI equivalent: `npx newman run postman/problem5.postman_collection.json -e postman/problem5.postman_environment.json`. See [`postman/README.md`](./postman/README.md) for the full folder map (33 requests / 85 assertions covering happy paths, validation errors, 404s, malformed JSON, oversized bodies, unmapped verbs).

## Running with Docker Compose

Two Docker Compose configurations are provided: one for development with hot reload
and debugger support, and one for production with a compiled image and optimized settings.

### Development environment

The development compose brings up both PostgreSQL and the Express app with source-code
hot reload and Node debugger support.

```bash
# 1. Copy the dev environment template
cp .env.docker.example .env.docker

# 2. Build the dev image and start both services
docker compose up -d --build

# 3. Apply the initial migration (first run only — Prisma stores its
#    history in prisma/migrations; subsequent `compose up` skips this).
docker compose exec api npm run db:migrate -- --name init

# 4. Watch logs and test the API
docker compose logs -f api &
curl http://localhost:3000/api/health

# 5. Bring everything down (preserves the database volume)
docker compose down

# 6. Full reset (wipes the database and re-runs docker/init-db.sql next time)
docker compose down -v
```

**First-run reminder:** the migrate step (command 3) is mandatory on a
fresh volume — without it the `Product` table does not exist and any
write endpoint returns `500`. The reviewer shortcut assumes you have
already run it.

**Hot reload:** Edit any file in `src/`, `prisma/`, or the TypeScript configuration,
and `ts-node-dev` (running inside the container) will detect the change and restart
the process automatically. No container rebuild required.

**Debugger:** The Node inspector listens on `localhost:9229`. Connect with VS Code's
built-in debugger (set `"port": 9229` in your launch configuration) or Chrome DevTools
(`chrome://inspect`).

### Production environment

The production compose builds a minimal image from the production Dockerfile target,
requires externally-supplied environment configuration, and includes PostgreSQL for
convenience (which you can replace with a managed database in real deployments).

```bash
# 1. Copy the production environment template and edit it
cp .env.production.example .env.production
# Update DATABASE_URL to point at your managed database (RDS, Cloud SQL, etc.)

# 2. Build and start the production stack
docker compose -f docker-compose.prod.yml up -d --build

# 3. Apply migrations against the target database (first run only).
#    For production pipelines this should happen from a one-shot job,
#    not from inside the long-running container.
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# 4. Check logs and verify health
docker compose -f docker-compose.prod.yml logs -f api
curl http://localhost:3000/api/health

# 5. Tear down
docker compose -f docker-compose.prod.yml down
```

**No hot reload in production:** The app runs compiled JavaScript (`dist/`) that was
built at image-build time. Any code changes require a fresh image build and
container restart.

**Security notes:** The runtime image runs as a non-root user (`api:1001`), uses
Alpine Linux for minimal attack surface, and includes `tini` for proper signal
forwarding. A `HEALTHCHECK` is included so orchestrators (Docker Swarm, Kubernetes)
can detect unhealthy instances and evict them.

### Dockerfile structure

The Dockerfile uses three stages, selectable via `--target`:

| Stage      | Base image              | Purpose                                                                                                                  |
|------------|-------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `builder`  | `node:22-alpine`        | Installs all dependencies (dev + prod), compiles TypeScript to `dist/`, and prepares Prisma client. Intermediate only.  |
| `runtime`  | `node:22-alpine`        | Production image (default). Copies only production dependencies and compiled `dist/`. Runs as non-root. ~180 MB.          |
| `dev`      | `node:22-alpine`        | Development image. Installs all dependencies (dev + prod), expects source code mounted at runtime. User is root.          |

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

A machine-readable [`openapi.yaml`](./openapi.yaml) ships alongside this
README and can be imported into Swagger UI, Redoc, `openapi-typescript`
code generators, Prism mock servers, or any OpenAPI 3.0 tool. Every
request/response documented below has a matching schema in that file.

The full list of requests below also has a matching Postman collection in
[`postman/`](./postman/) — every curl example has an equivalent request
with Tests-tab assertions. Reviewers who prefer clicking over pasting
can skip to the [Postman / Newman section](#postman--newman) below.

### Error codes

Every error path returns a stable envelope with a machine-readable `code`
string. The table below is the canonical reference; `error.code` values
are part of the public contract and will not be renamed without a
deprecation cycle.

| HTTP | `error.code`            | When emitted                                                                                       | `details` field       | Client action                                                                 |
|-----:|-------------------------|----------------------------------------------------------------------------------------------------|-----------------------|-------------------------------------------------------------------------------|
|  400 | `VALIDATION_ERROR`      | Zod schema rejected body / query / params (missing required fields, wrong types, unknown keys under `.strict()`, bounds violation). | Zod `flatten()` output with `formErrors` + `fieldErrors`. | Fix the offending field(s); do not retry the same payload.                    |
|  400 | `BAD_REQUEST`           | Malformed JSON body: `Content-Type: application/json` with a non-JSON payload (body-parser `entity.parse.failed`). | Absent.               | Fix the serialisation; then retry.                                            |
|  404 | `NOT_FOUND`             | Resource with the given id does not exist, or the route itself is not mapped.                      | Absent.               | Check the id / route; do not retry with the same value.                       |
|  413 | `PAYLOAD_TOO_LARGE`     | Request body exceeds the 16 KB limit on `express.json({ limit: '16kb' })`.                         | Absent.               | Split the payload or reduce its size; do not retry as-is.                     |
|  500 | `INTERNAL_SERVER_ERROR` | Unhandled exception reached the global error middleware. Stack logged server-side; never leaked.   | Absent.               | Retry with exponential backoff. If persistent, check server logs / open issue. |

- `success: true` responses never carry an `error` field and always carry `data`.
- Successful list responses additionally carry a top-level `meta: { page, limit, total }`.
- `204 No Content` (DELETE success) returns an empty body and no envelope.
- The set of codes above is closed for v1. Future additions append new values rather than repurposing existing ones.

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

## Postman / Newman

A ready-to-run Postman collection exercises every endpoint and every
documented error case. It is the fastest way for a reviewer to poke the
API without typing curl commands, and the same artefact doubles as a
black-box smoke gate in CI via Newman.

### Files

- [`postman/problem5.postman_collection.json`](./postman/problem5.postman_collection.json) — 8 folders, 33 requests, 85 Tests-tab assertions.
- [`postman/problem5.postman_environment.json`](./postman/problem5.postman_environment.json) — `baseUrl`, `productId`, `unknownId`, `malformedId`.
- [`postman/README.md`](./postman/README.md) — folder-by-folder map and CLI instructions.

### Import and run (GUI)

1. Postman → **Import** → select both JSON files.
2. Choose the **Problem 5 — Local** environment from the top-right dropdown.
3. Open the **00 — Smoke Test Flow** folder and click **Run** in the
   Collection Runner. The flow captures `productId` from the Create step
   and feeds it into Get / Patch / Delete automatically.
4. Run any other folder individually, or run the entire collection to
   exercise all 33 cases at once.

### Run from the terminal (Newman)

```bash
npm install -g newman          # one-time
newman run postman/problem5.postman_collection.json \
       -e postman/problem5.postman_environment.json
```

Newman exits non-zero on any failed assertion, so it works as-is in a CI
pipeline (GitHub Actions: `uses: matt-ball/newman-action@master`).
Expected output on a healthy build:

```
iterations:  1/1
requests:    33/33
assertions:  85/85
duration:    ~1s
```

### What the collection covers

| Folder | Requests | Focus |
|---|---:|---|
| **00** — Smoke Test Flow | 5 | Ordered happy-path lifecycle (health → create → get → patch → delete → 404 verify) |
| **01** — Health | 1 | `GET /api/health` → 200 |
| **02** — Create | 8 | 201 full + minimal body; 400 for empty body / negative price / empty name / wrong types / extra field (Zod `.strict()`) / malformed JSON |
| **03** — List | 7 | Defaults, category filter, case-insensitive `ILIKE` name filter, combined + pagination, invalid `page`, `limit` over cap, `page=0` |
| **04** — Get by ID | 2 | 404 unknown CUID, 400 malformed |
| **05** — Update (PATCH) | 4 | 400 empty body, 404 unknown, 400 malformed, 400 extra field |
| **06** — Delete | 2 | 404 unknown, 400 malformed |
| **07** — Negative cases | 3 | 404 unknown route, 404 unmapped verb (`PUT /api/products`), 413 body over 16 KB limit |

Each request has assertions on status code, envelope shape, and — where
relevant — the specific `error.code` string, so a passing collection is
strong evidence the API honours its documented contract.

## Project Structure

```
problem5/
├── docker/
│   └── init-db.sql                        # Creates `problem5_test` alongside the dev DB on first `docker compose up`
├── postman/
│   ├── problem5.postman_collection.json   # 8 folders, 33 requests, 85 Tests-tab assertions
│   ├── problem5.postman_environment.json  # baseUrl, productId, unknownId, malformedId
│   └── README.md                          # Import & Newman instructions
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
├── .env.example               # Template for host-level `npm run dev` (localhost:5433)
├── .env.docker.example        # Template for dev `docker compose up` (postgres:5432 via compose network)
├── .env.production.example    # Template for prod `docker compose.prod.yml up` — requires external database URL
├── .dockerignore               # Excludes source-only / dev-only paths from the build context
├── Dockerfile                 # Multi-stage image: builder, runtime (default), dev targets
├── docker-compose.yml         # Development: PostgreSQL 16 + hot-reload app with debugger
├── docker-compose.prod.yml    # Production: PostgreSQL 16 (commented option for managed DB) + compiled app
├── jest.config.js             # Jest configuration (ts-jest preset)
├── package.json               # Scripts, dependencies, engines
├── tsconfig.json              # Strict TypeScript configuration
└── tsconfig.test.json         # Extends tsconfig for the test sources
```

### Validation pipeline (Zod + Express v4/v5 compatibility)

Request validation is the only non-obvious architectural choice in the
codebase and deserves one paragraph in this README so future contributors
do not rediscover the trade-off from inline comments.

**The pattern.** Every route passes its payload through
`validate(schema, source)`
([`src/middlewares/validate.middleware.ts`](./src/middlewares/validate.middleware.ts)),
where `schema` is a Zod schema owned by the type layer and `source` is
one of `'body' | 'query' | 'params'`. On success the middleware places
the parsed (and *coerced* — page/limit arrive as strings from the URL)
object on `res.locals.validated[source]` and calls `next()`; on failure
it throws `AppError.validation(zodError.flatten())` which the global
error middleware renders as `400 VALIDATION_ERROR`. Controllers read the
typed payload with the `readValidated<T>(res, source)` helper in
[`src/controllers/product.controller.ts`](./src/controllers/product.controller.ts).

**Why `res.locals` and not `req[source]`.** Express v4 treats `req.body`,
`req.query`, and `req.params` as mutable plain objects. Express v5 turns
`req.query` and `req.params` into read-only getters; assigning to them is
silently ignored on v5 and hard-breaks if a consumer caches the getter.
The `res.locals.validated[source]` slot sidesteps the v4/v5 split
entirely — the middleware does the same thing, and the controller reads
from the same place, on both major versions. The middleware additionally
attempts an `Object.defineProperty` fallback so legacy code that reads
`req.query` still sees coerced data, but the canonical source is
`res.locals`.

**Fail-loud controller read.** `readValidated<T>` throws if the validated
slot is missing, rather than silently falling back to the raw
`req[source]`. This converts "forgot to wire `validate(...)` on a new
route" from a silent production bypass into a loud 500 during
development, which is the right failure mode for a contract primitive.

**Adding a new route.** Define (or reuse) a Zod schema in
[`src/types/product.types.ts`](./src/types/product.types.ts), wire it in
[`src/routes/product.routes.ts`](./src/routes/product.routes.ts) as
`validate(mySchema, 'body' | 'query' | 'params')`, then read the typed
payload in the controller with
`readValidated<z.infer<typeof mySchema>>(res, '<source>')`. The router
file is the single source of truth for which schema validates which
endpoint; the router-to-controller contract (see the `validate(...)` +
`productController.*` lines) is intentionally the only place a grep for
"what happens when this endpoint is hit" has to stop.

## Testing

Two complementary test layers ship with the project:

- **Jest + Supertest** (white-box): 16 integration tests against the
  exported Express app, backed by a real PostgreSQL instance
  (`problem5_test`). This is what CI runs on every commit.
- **Newman** (black-box): 85 assertions across 33 Postman requests against
  a live server on `localhost:3000`. See
  [Postman / Newman](#postman--newman) above.

```bash
# Start only PostgreSQL — Jest spawns its own Express app in-process, so
# the `api` container is not needed and would waste the host port 3000.
docker compose up -d postgres

# White-box (Jest — pretest pushes the schema to `problem5_test`)
npm test

# Black-box (Newman — requires a server on :3000; start the container
# stack or run `npm run dev` on the host first)
docker compose up -d --build api
newman run postman/problem5.postman_collection.json \
       -e postman/problem5.postman_environment.json
```

The Jest suite covers happy paths, validation errors, malformed JSON
bodies, and not-found responses; it runs serially (`--runInBand`) to keep
the Prisma connection pool predictable. The Postman collection layers on
the "outside-in" concerns Jest does not: oversized body payloads
(413 `PAYLOAD_TOO_LARGE`), unmapped HTTP verbs, unknown routes, and
HTTP-envelope contracts visible only over the wire.

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
