FROM oven/bun:1.3.13-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache python3 make g++
COPY . .
RUN bun install --frozen-lockfile

FROM deps AS build
RUN bun run -F @rntme/bpmn-worker build

FROM oven/bun:1.3.13-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo
USER bun
CMD ["bun", "packages/runtime/bpmn-worker/dist/bin/worker.js"]
