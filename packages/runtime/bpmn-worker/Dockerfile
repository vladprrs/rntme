FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm -F @rntme/bpmn-worker build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=deps /repo/node_modules /app/node_modules
COPY --from=build /repo/packages/runtime/bpmn-worker/dist /app/dist
COPY --from=build /repo/packages/runtime/bpmn-worker/package.json /app/package.json
CMD ["node", "/app/dist/bin/worker.js"]
