# stage 1 - builder
FROM oven/bun:1.3.13-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN bun install --frozen-lockfile
RUN bun run -F @rntme/platform-http build

# stage 2 - runtime
FROM oven/bun:1.3.13-slim AS runtime
WORKDIR /app

COPY --from=builder /app /app

WORKDIR /app/apps/platform-http
EXPOSE 3000
CMD ["bun", "dist/bin/server.js"]
