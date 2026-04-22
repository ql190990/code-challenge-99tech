# Postman Collection — Problem 5

Importable Postman artefacts for exercising every endpoint of the Product CRUD API.

## Files

- [`problem5.postman_collection.json`](./problem5.postman_collection.json) — the collection (8 folders, 28 requests, full assertions).
- [`problem5.postman_environment.json`](./problem5.postman_environment.json) — the environment with `baseUrl`, `productId`, `unknownId`, `malformedId` defined.

## Quick start

1. Start the API server:
   ```bash
   cd src/problem5
   docker compose up -d
   cp .env.example .env
   npm install
   npm run db:migrate -- --name init
   npm run dev
   ```
2. Open Postman → **Import** → select both JSON files.
3. Pick the **Problem 5 — Local** environment from the top-right dropdown.
4. Open the **00 — Smoke Test Flow** folder, click **Run** in the Collection Runner. Five requests execute end-to-end (health → create → get → patch → delete → 404 verify) and capture the created `productId` for the lifecycle.
5. Run any other folder individually, or run the entire collection to exercise all 28 cases at once.

## Folder map

| # | Folder | Requests | Purpose |
|---|---|---:|---|
| 00 | Smoke Test Flow | 5 | Ordered happy-path lifecycle; captures `productId` |
| 01 | Health | 1 | `GET /api/health` |
| 02 | Products \| Create | 8 | 201 happy paths + every 400 validation case + malformed JSON |
| 03 | Products \| List | 7 | Defaults, filters, pagination, invalid query params |
| 04 | Products \| Get by ID | 2 | 404 unknown CUID + 400 malformed |
| 05 | Products \| Update (PATCH) | 4 | Empty body, unknown id, malformed id, extra field |
| 06 | Products \| Delete | 2 | Unknown id 404, malformed id 400 |
| 07 | Negative cases \| Misc | 3 | Unknown route 404, unmapped verb 404, body-size 413 |

Each request carries Tests-tab assertions so the Collection Runner reports pass/fail per case (114 assertions total).

## Variables

| Variable | Default | Notes |
|---|---|---|
| `baseUrl` | `http://localhost:3000` | Override per environment (staging, etc.). |
| `productId` | *(empty)* | Auto-populated by the Smoke Test Flow's Create step. |
| `unknownId` | `cjld2cjxh0000qzrmn831i7rn` | Well-formed CUID guaranteed not to exist. |
| `malformedId` | `not-a-cuid` | Fails the `z.string().cuid()` validator → 400. |

## CLI execution (Newman)

Run the entire collection from CI or the terminal:

```bash
npm install -g newman
newman run problem5.postman_collection.json -e problem5.postman_environment.json
```

Newman exits non-zero on any test failure, so it doubles as a black-box smoke gate in a CI pipeline.

## Notes on edge cases

- **Body-size case (07)** uses a pre-request script to generate a 17 KB body at runtime; do not edit the static body field.
- **Unmapped verb case (07)** sends `PUT /api/products`. The `notFoundHandler` returns 404 because no PUT route is registered (PUT was intentionally replaced by PATCH per RFC 7231 — see project README).
- **Malformed JSON case (02)** confirms the `entity.parse.failed` branch in the global error middleware returns `400 BAD_REQUEST` instead of leaking a 500 with a stack trace.
