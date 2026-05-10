# @rntme/artifact-shared

Shared algebra used across the artifact pipeline (`bindings`, `blueprint`,
`graph-ir-compiler`, `pdm`, `qsm`, `seed`, `ui`, `workflows`). Provides the
parameterized `Result<T, E>` discriminated union and the `ok` / `err` /
`isOk` / `isErr` constructors.

Each consumer keeps its own `Layer` / `*ErrorCode` / `*Error` types and
`ERROR_CODES` table; only the algebra is shared.

Local commands:
- `bun test`
- `bun run typecheck`
- `bun run build`
- `bun run lint`
