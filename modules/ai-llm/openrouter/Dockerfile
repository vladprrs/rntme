# Build from the repository root:
#   docker build -f modules/ai-llm/openrouter/Dockerfile -t ghcr.io/vladprrs/rntme-ai-llm-openrouter:dev .

FROM node:20-alpine AS builder
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY modules/ai-llm ./modules/ai-llm

RUN pnpm install --frozen-lockfile
RUN pnpm -F @rntme/ai-llm-openrouter run build:image
RUN node -e "const fs=require('fs');const p=require('./package.json');delete p.devDependencies;fs.writeFileSync('package.json', JSON.stringify(p));"
RUN pnpm --filter @rntme/ai-llm-openrouter --prod deploy /out

FROM node:20-alpine
WORKDIR /srv

COPY --from=builder /out ./

ENV NODE_ENV=production \
    PORT=50051 \
    OPENROUTER_BASE_URL=https://openrouter.ai/api/v1 \
    OPENROUTER_IDEMPOTENCY_MODE=sqlite \
    OPENROUTER_IDEMPOTENCY_PATH=/data/idempotency.sqlite

VOLUME /data
USER node
EXPOSE 50051
CMD ["node", "dist/bin/server.js"]
