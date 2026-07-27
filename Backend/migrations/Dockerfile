# One-shot schema loader. Runs to completion and exits — compose treats a
# clean exit as "completed successfully" so dependent services can wait on it.
#
# NOTE: index.js DROPS and recreates the database unless FRESH_DB=false.
# docker-compose sets FRESH_DB explicitly; never leave it unset in production.

FROM node:22-bookworm-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . ./

CMD ["node", "index.js"]
