# Dependency Research Index

This index consolidates the RNT-293 dependency research queue. Each document is research-only evidence for future migration planning; runtime dependency changes belong in separate implementation issues.

| Issue | Dependency area | Research document |
|---|---|---|
| RNT-298 | hono + @hono/node-server + @hono/zod-openapi | [README.md](hono-plus-hono-node-server-plus-hono-zod-openapi/README.md) |
| RNT-299 | better-sqlite3 | [README.md](better-sqlite3/README.md) |
| RNT-300 | pino | [README.md](pino/README.md) |
| RNT-301 | @grpc/grpc-js + @grpc/proto-loader | [README.md](grpc-grpc-js-plus-grpc-proto-loader/README.md) |
| RNT-302 | protobufjs + protobufjs-cli | [README.md](protobufjs-plus-protobufjs-cli/README.md) |
| RNT-303 | drizzle-orm + drizzle-kit | [README.md](drizzle-orm-plus-drizzle-kit/README.md) |
| RNT-304 | @clerk/backend | [README.md](clerk-backend/README.md) |
| RNT-305 | auth0 | [README.md](auth0/README.md) |
| RNT-306 | @workos-inc/node | [README.md](workos-inc-node/README.md) |
| RNT-307 | @bitrix24/b24jssdk | [README.md](bitrix24-b24jssdk/README.md) |
| RNT-308 | @shevernitskiy/amo | [README.md](shevernitskiy-amo/README.md) |
| RNT-309 | react + react-dom | [README.md](react-plus-react-dom/README.md) |
| RNT-310 | @json-render/core + @json-render/react + @json-render/shadcn | [README.md](json-render-core-plus-json-render-react-plus-json-render-shadcn/README.md) |
| RNT-311 | tailwindcss + @tailwindcss/cli | [README.md](tailwindcss-plus-tailwindcss-cli/README.md) |
| RNT-312 | astro + @astrojs/react + @astrojs/mdx | [README.md](astro-plus-astrojs-react-plus-astrojs-mdx/README.md) |
| RNT-313 | vitest + @vitest/ui | [README.md](vitest-plus-vitest-ui/README.md) |
| RNT-314 | testcontainers + @testcontainers/postgresql | [README.md](testcontainers-plus-testcontainers-postgresql/README.md) |
| RNT-315 | msw | [README.md](msw/README.md) |
| RNT-316 | fast-check | [README.md](fast-check/README.md) |
| RNT-317 | @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner | [README.md](aws-sdk-client-s3-plus-aws-sdk-s3-request-presigner/README.md) |
| RNT-318 | prom-client | [README.md](prom-client/README.md) |
| RNT-319 | eslint + @eslint/js + @typescript-eslint + prettier | [README.md](eslint-plus-eslint-js-plus-typescript-eslint-plus-prettier/README.md) |
| RNT-320 | tsx + esbuild | [README.md](tsx-plus-esbuild/README.md) |
| RNT-321 | Docker node:20-alpine/slim runtime images | [README.md](docker-node-20-alpine-slim-runtime-images/README.md) |
| RNT-322 | GitHub Actions workflow stack | [README.md](github-actions-workflow-stack/README.md) |
| RNT-323 | zod | [README.md](zod/README.md) |
| RNT-324 | pg | [README.md](pg/README.md) |
| RNT-325 | TypeScript | [README.md](typescript/README.md) |

## Follow-up Migration Waves

- Runtime and security critical: Node/Docker base images, GitHub Actions hardening, auth/identity SDKs, storage/database clients.
- Core runtime contracts: Hono, Zod, gRPC, Protobuf, SQLite, Drizzle, and Postgres.
- UI, tooling, and test batches: React, Astro, JSON Render, Tailwind, Vitest, Testcontainers, MSW, fast-check, TypeScript, ESLint, tsx, and esbuild.
