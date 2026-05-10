# stage 1 - builder
FROM oven/bun:1.3.13-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN bun install --frozen-lockfile
# Build all workspace packages in topological order; platform-http's tsc resolves
# workspace dep types from each upstream package's emitted dist/.
RUN bun run --filter "@rntme/*" build

# stage 2 - runtime
FROM oven/bun:1.3.13-slim AS runtime
WORKDIR /app

COPY --from=builder /app /app

WORKDIR /app/apps/platform-http
EXPOSE 3000
CMD ["bun", "dist/bin/server.js"]
