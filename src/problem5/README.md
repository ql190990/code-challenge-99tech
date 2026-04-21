# Problem 5 — A Crude Server

A CRUD backend service built with **Express.js + TypeScript**, connected to a
simple database for persistence.

## Endpoints (planned)

| Method | Path | Description |
|---|---|---|
| POST   | `/resources`       | Create a resource |
| GET    | `/resources`       | List resources with basic filters |
| GET    | `/resources/:id`   | Get details of a resource |
| PUT    | `/resources/:id`   | Update resource details |
| DELETE | `/resources/:id`   | Delete a resource |

## Run

```bash
cd src/problem5
cp .env.example .env
npm install
npm run migrate   # set up database
npm run dev       # start dev server
```

## Stack

- Express.js, TypeScript
- Prisma ORM + SQLite (simple, zero-setup)
- Zod for request validation

_To be implemented._
