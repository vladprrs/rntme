# Build from repo root:
#   docker build -f packages/runtime/Dockerfile -t ghcr.io/vladprrs/rntme-runtime:dev .

FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY demo ./demo
RUN corepack enable \
  && pnpm install --frozen-lockfile \
  && pnpm -r --filter "@rntme/*" build

FROM node:20-alpine
WORKDIR /srv
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/packages ./packages
RUN node --input-type=module -e "await import('/srv/packages/runtime/dist/load/load-service.js'); await import('node:fs/promises').then(fs => fs.access('/srv/packages/runtime/assets/protos/identity-auth0.proto'))"
ENV NODE_ENV=production \
    RNTME_ARTIFACTS_DIR=/srv/artifacts \
    RNTME_HTTP_PORT=3000
USER node
EXPOSE 3000
ENTRYPOINT ["node", "packages/runtime/dist/bin/runtime.js", "start"]
CMD ["/srv/artifacts"]
