# Build from the repository root:
#   docker build -f modules/storage/s3/Dockerfile -t ghcr.io/vladprrs/rntme-storage-s3:dev .

FROM oven/bun:1.3.13-alpine AS deps
WORKDIR /build

COPY . .

RUN bun install --frozen-lockfile
RUN bun run -F @rntme/storage-s3 build:image

FROM oven/bun:1.3.13-alpine
WORKDIR /srv/modules/storage/s3

COPY --from=deps /build /srv

ENV NODE_ENV=production \
    PORT=50051 \
    STORAGE_S3_PENDING_STORE_PATH=/data/storage.sqlite \
    STORAGE_S3_IDEMPOTENCY_TTL_HOURS=24

VOLUME /data
EXPOSE 50051
CMD ["bun", "dist/bin/server.js"]
