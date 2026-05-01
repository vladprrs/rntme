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
RUN node -e "const fs=require('fs');const p=require('./package.json');delete p.devDependencies;fs.writeFileSync('package.json', JSON.stringify(p));"
RUN pnpm --filter @rntme/identity-auth0 --prod deploy /out

FROM node:20-alpine
WORKDIR /srv

COPY --from=builder /out ./

ENV NODE_ENV=production \
    PORT=50051 \
    HTTP_PORT=50052

USER node
EXPOSE 50051 50052
CMD ["node", "dist/bin/server.js"]
