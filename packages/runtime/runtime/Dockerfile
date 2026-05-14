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
ENV NODE_ENV=production \
    NODE_PATH=/srv/apps/platform/node_modules:/srv/packages/runtime/runtime/node_modules:/srv/apps/cli/node_modules:/srv/node_modules \
    RNTME_ARTIFACTS_DIR=/srv/artifacts \
    RNTME_HTTP_PORT=3000
RUN bun -e "const {mkdtemp,writeFile,access}=await import('node:fs/promises'); const {tmpdir}=await import('node:os'); const {join}=await import('node:path'); const {pathToFileURL}=await import('node:url'); await import('/srv/packages/runtime/runtime/dist/load/load-service.js'); await access('/srv/packages/runtime/runtime/assets/protos/identity-auth0.proto'); const dir=await mkdtemp(join(tmpdir(),'rntme-native-handler-')); const file=join(dir,'handler.js'); await writeFile(file, \"await import('@rntme/blueprint'); await import('@rntme/deploy-runner');\\n\"); await import(pathToFileURL(file).href);"
USER bun
EXPOSE 3000
ENTRYPOINT ["bun", "packages/runtime/runtime/dist/bin/runtime.js", "start"]
CMD ["/srv/artifacts"]
