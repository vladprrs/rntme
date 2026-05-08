# Build from the repository root:
#   docker build -f modules/storage/s3/Dockerfile -t ghcr.io/vladprrs/rntme-storage-s3:dev .

FROM node:20-alpine AS deps
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY modules/storage ./modules/storage

RUN pnpm install --frozen-lockfile
RUN pnpm -F @rntme/storage-s3 run build:image
RUN node -e "const fs=require('fs');const p=require('./package.json');delete p.devDependencies;fs.writeFileSync('package.json', JSON.stringify(p));"
RUN pnpm --filter @rntme/storage-s3 --prod deploy /out

FROM oven/bun:1-alpine
WORKDIR /srv

COPY --from=deps /out ./

ENV NODE_ENV=production \
    PORT=50051 \
    STORAGE_S3_PENDING_STORE_PATH=/data/storage.sqlite \
    STORAGE_S3_IDEMPOTENCY_TTL_HOURS=24

VOLUME /data
EXPOSE 50051
CMD ["bun", "dist/bin/server.js"]
