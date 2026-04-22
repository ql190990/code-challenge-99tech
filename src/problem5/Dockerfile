# syntax=docker/dockerfile:1.7
#
# Problem 5 Product CRUD API — multi-stage image with development and production targets.
#
# Stage 1 ("builder") installs all dependencies and compiles TypeScript →
# JavaScript into `dist/`. This stage is shared by both production and development paths.
#
# Stage 2 ("runtime") carries only production dependencies and the compiled
# output, yielding a ~180 MB final image that runs as a non-root user.
# This is the default target when `docker build .` is called without
# `--target`, maintaining backward compatibility with existing scripts.
#
# Stage 3 ("dev") provides a development environment with hot reload and
# debugger support. Source code is mounted at runtime from the host; the
# image installs all dev dependencies upfront and runs ts-node-dev with
# the Node inspector enabled. User stays root in dev for bind-mount
# permission convenience.
#
# The original audit recommended Node 18 Alpine; bumped to Node 22 Alpine
# here because Node 18 reached end-of-life on 2025-04-30 and shipping an
# EOL runtime in a production image is an immediate technical-debt flag.
# Node 22 is the current Active LTS (Oct 2024 – Apr 2027).

# ---------------------------------------------------------------------------
# Stage 1: builder
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# libc6-compat + openssl are required by Prisma's query engine binary on
# Alpine (musl). Without openssl the engine fails to load at runtime.
RUN apk add --no-cache libc6-compat openssl

# Install all dependencies (dev + prod) using the lockfile for
# reproducibility. `npm ci` fails fast on any lockfile drift.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Copy sources and compile. The `postinstall` hook in Prisma already ran
# during `npm ci`, so the client is generated into node_modules.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app

# Same Prisma runtime deps, plus tini for signal forwarding.
RUN apk add --no-cache libc6-compat openssl tini

# Non-root runtime identity. Fixed numeric uid/gid so Kubernetes
# `runAsUser: 1001` manifests can match.
RUN addgroup -g 1001 -S nodejs \
 && adduser -S -u 1001 -G nodejs api

# Install production-only dependencies. Prisma's postinstall regenerates
# the client against the schema copied here.
COPY --chown=api:nodejs package.json package-lock.json ./
COPY --chown=api:nodejs prisma ./prisma
RUN npm ci --omit=dev \
 && npm cache clean --force

# Copy the compiled JavaScript output from the builder stage.
COPY --from=builder --chown=api:nodejs /app/dist ./dist

USER api

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# tini is PID 1 so SIGTERM/SIGINT forward to Node and `src/server.ts`
# can run its graceful-shutdown path (close the HTTP server, then
# `disconnectPrisma`).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]

# Container orchestrators (Docker, k8s, ECS, Nomad) read this to decide
# whether the container is healthy. Uses the Node runtime that's already
# present — no need to install wget/curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# ---------------------------------------------------------------------------
# Stage 3: dev
# ---------------------------------------------------------------------------
FROM node:22-alpine AS dev

WORKDIR /app

# libc6-compat + openssl required by Prisma, same as builder stage.
RUN apk add --no-cache libc6-compat openssl

# Install all dependencies (dev + prod) from package-lock for reproducibility.
# Source code is mounted at runtime by docker-compose, not copied here.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Development environment: run ts-node-dev with debugger enabled. The
# debugger binds to 0.0.0.0:9229 so external debuggers can attach from
# the host. User stays root in dev (bind-mount permission convenience).
ENV NODE_ENV=development \
    PORT=3000

EXPOSE 3000 9229

# Run ts-node-dev with hot reload (--respawn) and inspect enabled for
# external debuggers. The container will auto-restart if files change
# thanks to --respawn.
CMD ["npm", "run", "dev", "--", "--inspect=0.0.0.0:9229"]
