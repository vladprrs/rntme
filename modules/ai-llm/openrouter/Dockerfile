# Build from the repository root:
#   docker build -f modules/ai-llm/openrouter/Dockerfile -t ghcr.io/vladprrs/rntme-ai-llm-openrouter:dev .

FROM oven/bun:1.3.13-alpine AS builder
WORKDIR /build

COPY . .

RUN bun install --frozen-lockfile
RUN bun run -F @rntme/ai-llm-openrouter build:image

FROM oven/bun:1.3.13-alpine
WORKDIR /srv/modules/ai-llm/openrouter

COPY --from=builder /build /srv

ENV NODE_ENV=production \
    PORT=50051 \
    OPENROUTER_BASE_URL=https://openrouter.ai/api/v1 \
    OPENROUTER_IDEMPOTENCY_MODE=sqlite \
    OPENROUTER_IDEMPOTENCY_PATH=/data/idempotency.sqlite

VOLUME /data
USER bun
EXPOSE 50051
CMD ["bun", "dist/bin/server.js"]
