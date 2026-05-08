# Build from the repository root:
#   docker build -f modules/marketing-site/static-html/Dockerfile -t ghcr.io/vladprrs/rntme-marketing-site-static:dev .

FROM node:20-alpine AS builder
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY modules/marketing-site ./modules/marketing-site

RUN pnpm install --frozen-lockfile
RUN pnpm -F @rntme/marketing-site-static run build
RUN node -e "const fs=require('fs');const p=require('./package.json');delete p.devDependencies;fs.writeFileSync('package.json', JSON.stringify(p));"
RUN pnpm --filter @rntme/marketing-site-static --prod deploy /out

FROM node:20-alpine
WORKDIR /srv

COPY --from=builder /out ./

ENV NODE_ENV=production
USER node
CMD ["node", "dist/provisioner.entry.js"]
