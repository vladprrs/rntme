# stage 1 — builder
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter '@rntme/platform-http...' build

# stage 2 — runtime
FROM node:20-slim AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY --from=builder /app /app

WORKDIR /app/apps/platform-http
EXPOSE 3000
CMD ["node", "dist/bin/server.js"]
