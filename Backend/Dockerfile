# Generic image for the seven plain-Node (Express) backend services.
#
# Build context MUST be Backend/ — five of the services `require()` the shared
# Backend/config/config.js via relative paths that climb out of their own
# folder (e.g. admin/src/jobs/.../handlers/IDL.js -> ../../../../../../config/config).
# Copying Backend/<service> to /app/<service> and Backend/config to /app/config
# preserves that exact depth, so no source changes are needed.
#
# Usage (see docker-compose.yml):
#   build:
#     context: ./Backend
#     args: { SERVICE: admin, ENTRY: adminApi.js }

FROM node:22-bookworm-slim

# Build toolchain for packages with native addons (bcrypt, sqlite3, etc.), plus
# the shared libraries those addons dlopen at runtime. skia-canvas — pulled in by
# @loskir/styled-qr-code-node for the MFA QR codes — needs fontconfig and the
# font stack, and fails at require-time without them
# ("libfontconfig.so.1: cannot open shared object file").
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates curl \
      fontconfig libfontconfig1 fonts-dejavu-core \
      libfreetype6 libpng16-16 libjpeg62-turbo \
 && rm -rf /var/lib/apt/lists/*

ARG SERVICE
ARG ENTRY
ENV SERVICE=${SERVICE} \
    ENTRY=${ENTRY} \
    NODE_ENV=production

WORKDIR /app

# Shared config module first — it changes far less often than service code,
# so it stays cached across rebuilds of any individual service.
COPY config ./config

# Install deps before copying the rest of the source so dependency layers are
# reused when only application code changes.
COPY ${SERVICE}/package*.json ./${SERVICE}/
WORKDIR /app/${SERVICE}
# --legacy-peer-deps: this repo has real peer-dependency conflicts (admin's
# nodemailer vs nodemailer-mock is the known one). Applied uniformly so a
# conflict in any service doesn't fail the build.
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund

COPY ${SERVICE}/ ./

# `npm start` is not used on purpose: every service's start script shells out to
# pm2 (and some have a `prestart: npm i`). The container runtime already handles
# restarts, so run node directly.
CMD ["sh", "-c", "exec node $ENTRY"]
