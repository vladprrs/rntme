# Bun-First Toolchain Migration Design

Date: 2026-05-09
Status: approved for planning

## Context

rntme currently uses `pnpm@9.12.0`, Node 20, `tsc`, Vitest, and targeted `esbuild`/`tsx` scripts across a 57-package workspace. The decision system already names Bun as the open tooling migration candidate under F8/G5: reduce duplicated tooling and prefer current, broadly adopted tools.

This spec chooses a big-bang migration to Bun as the project runtime and development toolchain, while keeping one explicit exception: `tsc` remains for typechecking and declaration emit. The long-term target is Bun-native raw TypeScript package consumption, but that package-consumer contract change is deferred to a later 2A migration.

## Goals

- Make Bun the default package manager, script runner, test runner, bundler, runtime, Docker runtime, and SQLite driver.
- Remove pnpm, Vitest, esbuild, tsx, Node runtime entrypoints, and better-sqlite3 from current project surfaces.
- Preserve typed package contracts through `tsc` until the project intentionally changes package consumption to Bun-native raw TypeScript.
- Keep artifact semantics stable: blueprint-level `"engine": "sqlite"` remains SQLite, implemented by Bun.
- Update current docs, CI, scripts, Dockerfiles, and decision-system records to reflect the new canonical toolchain.

## Non-Goals

- Do not implement raw `.ts` package consumption in this migration.
- Do not remove `tsc` from typecheck or `.d.ts` emit yet.
- Do not rewrite working Node-standard APIs such as `node:fs`, `node:crypto`, `Buffer`, or streams merely to make code look Bun-specific.
- Do not bulk-edit historical specs or plans that mention pnpm, Node, Vitest, or esbuild as historical evidence.

## Chosen Approach

Use a Bun-first big-bang migration with a narrow `tsc` exception.

Bun becomes the root package manager, script runner, test runner, bundler, runtime, Docker runtime, and SQLite implementation. `tsc` remains only for `typecheck` and declaration emit for packages that expose typed library surfaces.

This approach is intentionally more direct than runtime-only migration, but less disruptive than immediate 2A raw TypeScript package publishing. It preserves current package API expectations while still removing the fragmented pnpm/Vitest/esbuild/tsx/better-sqlite3 runtime path.

## Future Direction: 2A

The desired long-term state is Bun-native raw TypeScript package consumption:

- packages can expose `.ts` sources directly where appropriate;
- Bun is the package-consumer contract for rntme packages;
- `tsc` can be removed once declaration emit is no longer required for the current package model.

That is not part of this migration. It needs a separate spec because it changes the external TypeScript/Node consumer story for `@rntme/*` packages.

## Toolchain Boundary

- Root project manager: Bun with `bun.lock`.
- Root package metadata owns workspace globs; `pnpm-workspace.yaml` is removed.
- Current root commands become:
  - `bun install --frozen-lockfile`
  - `bun run build`
  - `bun run typecheck`
  - `bun run test`
  - `bun run lint`
  - `bun run depcruise`
  - `bun run vendor:check`
- `pnpm -r` and `pnpm -F` disappear from current scripts, CI, Dockerfiles, and current docs.
- Package dependency build orchestration uses Bun workspace filters where possible. If Bun filters do not provide the required ordering or topology, an explicit repo script under `scripts/` may orchestrate it.
- `tsc` is allowed only for typechecking and `.d.ts` emit. Build and runtime execution should prefer Bun.

## SQLite Migration

The project currently uses a small synchronous SQLite API surface:

- `prepare().run/get/all`
- `exec`
- `transaction(fn)` and `transaction(fn).immediate`
- `pragma`
- `close`
- `RunResult.changes`
- `RunResult.lastInsertRowid`
- positional parameters and named object parameters
- manual `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`

This maps well to `bun:sqlite`, but the migration should not spread direct Bun imports across every package. Instead, introduce a shared minimal SQLite port, for example `SqliteDatabase` / `SqliteStatement`, and make `bun:sqlite` the only implementation after the migration.

Specific rules:

- Remove `better-sqlite3` and `@types/better-sqlite3` from production and test dependencies.
- Replace `BetterSqlite3.Database` branded types with the shared SQLite port.
- Update runtime `DbDriver` to return the shared port, not a better-sqlite3 database.
- Generalize the existing `modules/storage/s3/src/pending-store.ts` `DatabaseLike` pattern into the common port.
- Replace `db.pragma(...)` usage with a portable helper or driver method, backed by SQL PRAGMA execution in Bun.
- Open Bun databases in the mode needed to preserve named parameter behavior. Current event-store SQL uses names like `@subject` but passes object keys like `subject`, so the implementation should use Bun strict binding or normalize parameter keys.
- Normalize BLOB reads. Bun returns SQLite BLOB values as `Uint8Array`; OpenRouter idempotency currently expects `Buffer`.
- Preserve domain error mapping for unique constraints and optimistic concurrency.

SQLite verification gates:

- event-store append, read, cursor, delivery, and schema tests;
- projection consumer rollback, idempotency, and seen-events tests;
- graph operation read and e2e tests;
- OpenRouter idempotency tests, including BLOB payload round trip;
- storage-s3 pending-store tests;
- compatibility tests for named params, `lastInsertRowid`, `changes`, WAL PRAGMA, and unique constraint error shape.

Reference: Bun SQLite docs document the native synchronous driver, prepared statements, transactions, WAL PRAGMA usage, BLOB conversion, and integer behavior: <https://bun.sh/docs/runtime/sqlite>.

## Tests, Build, And Scripts

- Replace Vitest with `bun test` as the default test runner.
- Inventory and migrate Vitest-specific APIs before bulk conversion: `vi.fn`, fake timers, matcher differences, config/env setup, and skipped container tests.
- Remove `vitest.config.ts` files unless a concrete blocker is documented and approved. The target state is no Vitest.
- Replace `esbuild` and `tsx` usages with `bun build` and `bun run <ts-file>`.
- Provisioner bundles, UI client builds, and TypeScript script execution should use Bun-native capabilities unless `tsc` declaration emit is required.
- Current package build scripts may keep `tsc -p tsconfig.json` only when the package needs declarations or typechecked JS output as part of its typed library contract.

Build and test verification gates:

- `bun install --frozen-lockfile`
- `bun run build`
- `bun run typecheck`
- `bun run test`
- `bun run lint`
- `bun run depcruise`
- `bun run vendor:check`
- targeted smoke tests for generated provisioner bundles and the UI bundle.

## Runtime, CLI, Docker, And Serving

- Bun is the runtime requirement for rntme development and deployed rntme-owned containers.
- CLI, platform HTTP app, service runtime, and vendor module server entrypoints run under Bun.
- While the `tsc` exception remains, executable packages may still run emitted JS via Bun. Raw `.ts` entrypoints wait for the future 2A migration.
- Direct executable shebangs move from `#!/usr/bin/env node` to `#!/usr/bin/env bun` where applicable.
- Dockerfiles switch from Node images, Corepack, and pnpm to Bun images and Bun install/build/test flows.
- Hono HTTP serving should prefer `Bun.serve` with the existing `app.fetch` surface instead of `@hono/node-server` where lifecycle needs are covered.
- Runtime lifecycle behavior must remain stable: bound port detection, graceful stop, shutdown timeout, health, metrics, and tests that assert close behavior.
- gRPC remains on `@grpc/grpc-js` unless a separate Bun-native alternative is proven and justified. Existing `scratch/bun-grpc-smoke` shows Bun plus `@grpc/grpc-js` can round-trip; promote that into a regression check or documented compatibility gate.
- Node standard built-ins remain allowed when Bun supports them.

Runtime verification gates:

- CLI `--version` and representative command tests under Bun.
- Platform HTTP startup, health, and OpenAPI route tests under Bun.
- Runtime service startup/shutdown tests under Bun.
- gRPC server/client integration tests under Bun.
- Docker image tests prove containers start with Bun and do not require Corepack or pnpm.

## Documentation And Decision System

Update current documentation, not historical records:

- `docs/decision-system.md`
  - Replace the current tooling default with Bun-first plus the scoped `tsc` exception.
  - Record future 2A as a follow-up open question.
- `AGENTS.md` and `CLAUDE.md`
  - Replace common commands with Bun equivalents.
  - Update prerequisites from Node 20 + pnpm to Bun plus the `tsc` exception.
- Root `README.md`
  - Update quickstart and tooling requirements.
- Local README stubs
  - Update command hints where they currently tell agents to run `pnpm -F ...`.
- Owner docs under `docs/current/owners/**`
  - Update only surfaces whose current behavior changes: runtime, event-store/projection SQLite, CLI, platform-http, and Bun-affected vendor modules.
- Do not bulk-edit archived specs/plans under `docs/history/**`.

This is a `current-default` tooling replacement justified by F8 and G5. No goal change is required.

## Error Handling And Compatibility

- This is a big-bang pre-stable migration. No pnpm, Node runtime, Vitest, esbuild, tsx, or better-sqlite3 compatibility shim remains unless a concrete blocker is documented and approved.
- Any package that cannot migrate cleanly must fail plan review rather than silently keep the old toolchain.
- `tsc` is the only planned exception and is scoped to typecheck and declaration emit.
- SQLite migration must preserve existing domain errors: `DuplicateEventId`, `ConcurrencyConflict`, event-store schema errors, idempotency duplicate behavior, and projection rollback behavior.
- Runtime migration must preserve externally visible behavior: HTTP routes, gRPC surfaces, CLI commands, health/metrics, Docker entrypoints, and generated provisioner bundles.
- Bun-specific behavior becomes current truth. Node compatibility is no longer a default guarantee for rntme-owned runtime surfaces.

## Acceptance Criteria

- No `pnpm` command remains in current docs, scripts, CI, or Docker surfaces.
- No `vitest`, `esbuild`, `tsx`, or `better-sqlite3` dependency remains unless explicitly justified by an approved blocker. The expected target is zero.
- `bun.lock` is the only root JavaScript lockfile.
- `bun run build`, `bun run typecheck`, `bun run test`, `bun run lint`, `bun run depcruise`, and `bun run vendor:check` pass.
- Docker images build and run with Bun.
- SQLite compatibility tests prove named params, transactions, WAL, `changes`, `lastInsertRowid`, BLOB normalization, and constraint error mapping.
- Decision-system and current docs reflect Bun as the canonical current-default toolchain.
