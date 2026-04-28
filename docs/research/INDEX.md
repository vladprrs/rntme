# Research Index

This directory contains dependency and technology research documents for the rntme monorepo.

| Technology | Current version(s) | Latest stable | Recommendation | Document |
|---|---|---|---|---|
| pino | ^9.0.0 – ^9.5.0 | 10.3.1 | KEEP + UPGRADE | [pino/README.md](./pino/README.md) |
| zod | ^4.0.0 (4.3.6) | 4.3.6 | KEEP + UPGRADE (patch) | [zod/README.md](./zod/README.md) |
| @grpc/grpc-js + @grpc/proto-loader | ^1.10.0 – ^1.14.3 / ^0.7.13 | 1.14.3 / 0.8.0 | KEEP + UPGRADE + migrate bindings-grpc to proto-loader | [grpc-grpc-js-plus-grpc-proto-loader/README.md](./grpc-grpc-js-plus-grpc-proto-loader/README.md) |
| protobufjs + protobufjs-cli | ^7.2.0 – ^8.0.1 / ^2.0.1 | 7.5.6 / 8.0.3 / 2.0.3 | KEEP + UPGRADE (unify to 8.x, patch CVE-2026-41242) | [protobufjs-plus-protobufjs-cli/README.md](./protobufjs-plus-protobufjs-cli/README.md) |
| drizzle-orm + drizzle-kit | ^0.36.0 / ^0.30.0 (0.36.4 / 0.30.6) | 0.45.2 / 0.31.10 | KEEP + UPGRADE (security fix + migration infra) | [drizzle-orm-plus-drizzle-kit/README.md](./drizzle-orm-plus-drizzle-kit/README.md) |
| @bitrix24/b24jssdk | 1.0.5 | 1.0.5 | KEEP PINNED (already on latest) | [bitrix24-b24jssdk/README.md](./bitrix24-b24jssdk/README.md) |
| auth0 | 4.28.0 | 5.8.0 | KEEP + UPGRADE (with planned spike) | [auth0/README.md](./auth0/README.md) |
| @json-render/core + @json-render/react + @json-render/shadcn | ^0.17.0 | 0.18.0 | KEEP + UPGRADE | [json-render-core-plus-json-render-react-plus-json-render-shadcn/README.md](./json-render-core-plus-json-render-react-plus-json-render-shadcn/README.md) |

## Contributing

When adding a new research document:
1. Create a directory under `docs/research/<technology>/`
2. Write `README.md` following the template from the research issue
3. Update this `INDEX.md` with a new row
