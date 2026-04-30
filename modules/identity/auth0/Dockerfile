# Build from the repository root:
#   docker build -f modules/identity/auth0/Dockerfile -t ghcr.io/vladprrs/rntme-identity-auth0:dev .

FROM node:20-alpine AS builder
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY modules/identity ./modules/identity

RUN pnpm install --frozen-lockfile
RUN pnpm -F @rntme/identity-auth0... build

FROM node:20-alpine
WORKDIR /srv

COPY --from=builder /build/modules/identity/auth0/dist ./dist
COPY --from=builder /build/modules/identity/auth0/package.json ./package.json
COPY --from=builder /build/modules/identity/auth0/module.json ./module.json
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/packages/contracts ./packages/contracts

ENV NODE_ENV=production \
    PORT=50051

USER node
EXPOSE 50051
CMD ["node", "dist/bin/server.js"]
