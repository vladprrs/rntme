# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Primary agent-facing doc

Read [`AGENTS.md`](AGENTS.md) first. It is the research map: repository layout, package layering, project-wide conventions (`Result<T>`, branded `Validated*` types, error-code naming, SQLite target), task-indexed "how to do X" recipes, anti-patterns, and a decision index. Per-package `README.md` files are the authoritative source for each package's internals and have a uniform template (File map / Quick start / API / Invariants & gotchas / Out of scope / Where to look first / Specs).

> Note: `graph_ir_rc_7.md` is gitignored (IR source of truth is local-only); `docs/superpowers/plans/`, `specs/`, and `reports/` are tracked so README and `AGENTS.md` spec links resolve for other contributors.

## Commands

Node 20+, pnpm 9.12+. From the workspace root:

| Command | Effect |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install deps |
| `pnpm -r run build` | `tsc` per package (plus esbuild SPA build for `ui-runtime`) |
| `pnpm -r run typecheck` | Typecheck-only pass (`tsconfig.check.json`) |
| `pnpm -r run test` | Vitest in every package |
| `pnpm -r run lint` | ESLint across `src/` and `test/` |
| `pnpm -F @rntme/<pkg> test` | One package's tests |
| `pnpm -F @rntme/<pkg> test:watch` | Watch mode for one package |
| `pnpm -F @rntme/<pkg> vitest run <file>` | Single test file |
| `pnpm -F @rntme/issue-tracker-api-demo start` | Run the demo on `:3000` |
| `pnpm validate:issue-tracker-seed` | Validate the demo's `seed.json` via the seed CLI |

Test categories live under each package's `test/` directory: `unit/`, `integration/`, `e2e/`, with fixtures in `test/fixtures/`.

## Architecture in one paragraph

rntme is a pnpm workspace that produces a typed CQRS / event-sourced backend from four JSON artifacts. `@rntme/pdm` is the domain model. `@rntme/qsm` declares read-side projections on top of PDM (and owns the relation metadata used for JOINs, post-2026-04-16 migration). `@rntme/graph-ir-compiler` parses/validates/lowers the rc7 Graph IR (`graph_ir_rc_7.md`) to SQLite; it also drives command execution via `@rntme/event-store` (SQLite event log with optimistic concurrency, monotonic publish cursor, Kafka-style relay). `@rntme/projection-consumer` applies envelope events idempotently to projection tables. `@rntme/bindings` is the HTTP-surface artifact with a four-layer validator (parse → structural → references → consistency) and an OpenAPI 3.1 emitter; `@rntme/bindings-http` is the Hono runtime. `@rntme/ui` compiles a JSON UI artifact; `@rntme/ui-runtime` serves both a Hono sub-router and a React SPA built via esbuild. `@rntme/seed` applies declarative event envelopes before the relay starts. `@rntme/runtime` orchestrates everything from a service manifest: it validates, boots DbDriver/EventBus/Surface plugin seams (defaults: `BetterSqliteDriver`, `InMemoryBus`, `HttpSurface`), wires the event pipeline, applies seed, mounts bindings at `/api` and UI at `/`. `demo/issue-tracker-api` is the end-to-end worked example — `src/server.ts` is a thin entry; everything else is declarative JSON under `artifacts/`.

## Non-obvious conventions

- **SQLite forever.** Scale-out is Turso (SQLite-compatible Rust), not Postgres. Do not introduce Postgres-specific SQL or a second dialect branch in `graph-ir-compiler/src/lower/sqlite/`.
- **Authoring is JSON only.** No YAML, no TOML.
- **Validators are layered and fail-fast.** Bypassing a layer (even on "trusted" input) loses downstream error codes.
- **`Result<T>` everywhere; branded `Validated*` types.** Casting into a brand defeats the validator handshake — don't.
- **Error codes are stable API.** Append, never reorder or delete; format is `<PKG>_<LAYER>_<KIND>`.
- **No line numbers in "Where to look first" pointers** — use function/file names (lines drift).
- **Specs in `docs/superpowers/specs/` are source of truth.** Code that disagrees with a spec is a bug. Do not edit `graph_ir_rc_7.md` to match a code bug.
