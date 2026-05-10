# Build from the repository root:
#   docker build -f modules/identity/auth0/Dockerfile -t ghcr.io/vladprrs/rntme-identity-auth0:dev .

FROM oven/bun:1.3.13-alpine AS builder
WORKDIR /build

COPY . .

RUN bun install --frozen-lockfile
# build:image skips tsconfig.client.json — the auth0 image runs only the gRPC
# server, and the client TS imports @rntme/contracts-client-runtime-v1 which is
# already copied via packages/contracts (consumed by the runtime image's
# bundling step instead).
RUN bun run -F @rntme/identity-auth0 build:image

FROM oven/bun:1.3.13-alpine
WORKDIR /srv/modules/identity/auth0

COPY --from=builder /build /srv

ENV NODE_ENV=production \
    PORT=50051 \
    HTTP_PORT=50052

USER bun
EXPOSE 50051 50052
CMD ["bun", "dist/bin/server.js"]
