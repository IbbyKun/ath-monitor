# store-logs-api (NestJS) — needs a TypeScript build step, and ffmpeg at
# runtime for the screen-recording transcode in desktop/utils/file.utils.ts.
#
# Build context MUST be Backend/ (same reason as Backend/Dockerfile: this
# service imports the shared ../../../../../../config/config.js). Keeping
# Backend/store-logs-api -> /app/store-logs-api and Backend/config -> /app/config
# preserves that path both in src/ and in the compiled dist/ tree, since dist
# mirrors src's depth.

# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY config ./config
COPY store-logs-api/package*.json ./store-logs-api/
WORKDIR /app/store-logs-api
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY store-logs-api/ ./
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

COPY config ./config

WORKDIR /app/store-logs-api
COPY store-logs-api/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund

COPY --from=builder /app/store-logs-api/dist ./dist
# Sequelize/mongo migration definitions are read at runtime by the migrate scripts.
COPY store-logs-api/mysql-migrations ./mysql-migrations
COPY store-logs-api/mongo-migrations ./mongo-migrations
COPY store-logs-api/.sequelizerc ./.sequelizerc

CMD ["node", "dist/main.js"]
