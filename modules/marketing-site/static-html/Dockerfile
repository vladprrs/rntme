# Build from the repository root:
#   docker build -f modules/marketing-site/static-html/Dockerfile -t ghcr.io/vladprrs/rntme-marketing-site-static:dev .

FROM oven/bun:1.3.13-alpine AS builder
WORKDIR /build

COPY . .

RUN bun install --frozen-lockfile
RUN bun run -F @rntme/marketing-site-static build

FROM oven/bun:1.3.13-alpine
WORKDIR /srv/modules/marketing-site/static-html

COPY --from=builder /build /srv

ENV NODE_ENV=production
USER bun
CMD ["bun", "dist/provisioner.entry.js"]
