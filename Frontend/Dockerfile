# Two-stage: compile the SPA, then serve the static output from nginx.
#
# Vite inlines VITE_* variables at BUILD time, so they are build args rather
# than runtime env. They are deliberately set to same-origin relative paths
# by default (see docker-compose.yml) so nginx proxies the API and the image
# stays portable between local and Azure without a rebuild.

# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . ./

ARG VITE_API_URL=/api/v3
ARG VITE_BACKEND_V4_URL=
ARG VITE_STORE_LOGS_API_URL=/api/v1
ARG VITE_SOCKET_URL=
ARG VITE_CRYPTO_PASSWORD
ARG VITE_PASSWORD_IV
ARG VITE_SHOW_EMP_AI_ASSISTANT=false
ARG VITE_ADDON_SUPERADMIN_ORG_ID=

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_BACKEND_V4_URL=${VITE_BACKEND_V4_URL} \
    VITE_STORE_LOGS_API_URL=${VITE_STORE_LOGS_API_URL} \
    VITE_SOCKET_URL=${VITE_SOCKET_URL} \
    VITE_CRYPTO_PASSWORD=${VITE_CRYPTO_PASSWORD} \
    VITE_PASSWORD_IV=${VITE_PASSWORD_IV} \
    VITE_SHOW_EMP_AI_ASSISTANT=${VITE_SHOW_EMP_AI_ASSISTANT} \
    VITE_ADDON_SUPERADMIN_ORG_ID=${VITE_ADDON_SUPERADMIN_ORG_ID}

RUN npm run build

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
