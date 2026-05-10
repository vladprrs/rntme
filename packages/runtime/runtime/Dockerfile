# Build from repo root:
#   docker build -f packages/runtime/runtime/Dockerfile -t ghcr.io/vladprrs/rntme-runtime:dev .

FROM oven/bun:1.3.13-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /build
COPY . .
RUN bun install --frozen-lockfile \
  && bun run --filter "@rntme/*" build

FROM oven/bun:1.3.13-alpine
WORKDIR /srv
COPY --from=builder /build /srv
RUN bun -e "await import('/srv/packages/runtime/runtime/dist/load/load-service.js'); await import('node:fs/promises').then(fs => fs.access('/srv/packages/runtime/runtime/assets/protos/identity-auth0.proto'))"
ENV NODE_ENV=production \
    RNTME_ARTIFACTS_DIR=/srv/artifacts \
    RNTME_HTTP_PORT=3000
USER bun
EXPOSE 3000
ENTRYPOINT ["bun", "packages/runtime/runtime/dist/bin/runtime.js", "start"]
CMD ["/srv/artifacts"]
