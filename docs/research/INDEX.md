# rntme Dependency Research Index

This directory contains research-only documents for libraries, tools, and infrastructure dependencies used by rntme. Each document captures current versions, latest stable versions, alternatives, architecture patterns, pitfalls, and concrete migration recommendations.

## Research Documents

| Dependency / Technology | Current Version in rntme | Latest Stable | Status | Doc |
|---|---|---|---|---|
| Docker node:20-alpine/slim runtime images | node:20-slim / node:20-alpine | node:22.22.2 / node:24.15.0 | **Node 20 EOL 2026-04-30 — urgent migration needed** | [docker-node-20-alpine-slim-runtime-images](./docker-node-20-alpine-slim-runtime-images/README.md) |
| testcontainers + @testcontainers/postgresql | ^10.13.0 (10.28.0) | 11.14.0 | Ready for upgrade | [testcontainers-plus-testcontainers-postgresql](./testcontainers-plus-testcontainers-postgresql/README.md) |
| @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner | ^3.650.0 (lockfile: 3.1038.0) | 3.1038.0 | **Keep + Upgrade** — bump declared range; no breaking changes | [aws-sdk-client-s3-plus-aws-sdk-s3-request-presigner](./aws-sdk-client-s3-plus-aws-sdk-s3-request-presigner/README.md) |
| Bitrix24 B24 JS SDK | TBD | TBD | TBD | [bitrix24-b24jssdk](./bitrix24-b24jssdk/README.md) |
| Drizzle ORM + Drizzle Kit | TBD | TBD | TBD | [drizzle-orm-plus-drizzle-kit](./drizzle-orm-plus-drizzle-kit/README.md) |

## How to Add a New Research Document

1. Create a new directory under `docs/research/<dependency-name>/`.
2. Write `README.md` following the template from the issue specification.
3. Update this `INDEX.md` with a new row.
4. Open a PR on a branch named `research/<topic>-RNT-XXX`.
5. Post a final Multica comment summarizing findings, decisions, and follow-up tasks.
