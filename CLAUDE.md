# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Primary agent-facing doc

Read [`AGENTS.md`](AGENTS.md) first. It is the research map: repository layout, package layering, project-wide conventions (`Result<T>`, branded `Validated*` types, error-code naming, SQLite target), task-indexed "how to do X" recipes, anti-patterns, and a decision index. Per-package `README.md` files are the authoritative source for each package's internals and have a uniform template (File map / Quick start / API / Invariants & gotchas / Out of scope / Where to look first / Specs).

> Note: `graph_ir_rc_7.md` is gitignored (IR source of truth is local-only); `docs/superpowers/plans/`, `specs/`, and `reports/` are tracked so README and `AGENTS.md` spec links resolve for other contributors.

## Product positioning

Two layers of framing, and they must not collapse into one:

- **Internal framing** — used in this file, [`AGENTS.md`](AGENTS.md), specs, architecture docs, code comments, per-package READMEs. rntme is an **artifact-driven runtime**: seven strictly-validated JSON artifacts (PDM, QSM, Graph IR, bindings, UI, seed, manifest) compile through a four-layer validator onto an event-sourced SQLite runtime. CQRS / event sourcing / branded `Validated*` types / plugin seams (`DbDriver`, `EventBus`, `Surface`) are **consequences** of the repeatability goal, not the identity of the product.
- **Market framing** — used in [`README.md`](README.md) hero, [`vision.md`](vision.md), landing copy, pitches, YC application, buyer-facing blog posts. rntme is *"the safe runtime for AI-generated business workflow apps."* Buyers see ONE bounded authoring object — a **validated service blueprint** — not seven artifacts. Primary wedge: approvals, ticketing, customer-ops, onboarding, internal admin / back-office. The seven-artifact pipeline is internal IR; it does not appear in market-facing surfaces.

Source of truth for positioning: [`README.md`](README.md) hero block and [`vision.md`](vision.md) (ICP, wedge, substitutes, canonical one-liner / 30-second / vision pitches).

**When editing**, match the framing to the audience of the file. Never leak "artifact-driven runtime", "CQRS", "Graph IR", "PDM/QSM" into market-facing copy. Never water the internal artifact vocabulary down to marketing language inside architecture docs or code.

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

rntme is a pnpm workspace that produces a typed CQRS / event-sourced backend from seven JSON artifacts (PDM, QSM, Graph IR, bindings, UI, seed, manifest). `@rntme/pdm` is the domain model. `@rntme/qsm` declares read-side projections on top of PDM (and owns the relation metadata used for JOINs, post-2026-04-16 migration). `@rntme/graph-ir-compiler` parses/validates/lowers the rc7 Graph IR (`graph_ir_rc_7.md`) to SQLite; it also drives command execution via `@rntme/event-store` (SQLite event log with optimistic concurrency, monotonic publish cursor, Kafka-style relay). `@rntme/projection-consumer` applies envelope events idempotently to projection tables. `@rntme/bindings` is the HTTP-surface artifact with a four-layer validator (parse → structural → references → consistency) and an OpenAPI 3.1 emitter; `@rntme/bindings-http` is the Hono runtime. `@rntme/ui` compiles a JSON UI artifact; `@rntme/ui-runtime` serves both a Hono sub-router and a React SPA built via esbuild. `@rntme/seed` applies declarative event envelopes before the relay starts. `@rntme/runtime` orchestrates everything from a service manifest: it validates, boots DbDriver/EventBus/Surface plugin seams (defaults: `BetterSqliteDriver`, `InMemoryBus`, `HttpSurface`), wires the event pipeline, applies seed, mounts bindings at `/api` and UI at `/`. `demo/issue-tracker-api` is the end-to-end worked example — `src/server.ts` is a thin entry; everything else is declarative JSON under `artifacts/`.

## Non-obvious conventions

- **Authoring is JSON only.** No YAML, no TOML.
- **Validators are layered and fail-fast.** The four standard layers are **parse → structural → references → consistency**, in that order. Bypassing a layer (even on "trusted" input) loses downstream error codes.
- **`Result<T>` everywhere; no exceptions in validation or compile pipelines.** Failure is signalled with `{ ok: false; errors }`, never by throwing.
- **Branded `Validated*` types are only constructed by their validators.** A TypeScript cast into a `Validated*` brand defeats the validator handshake — don't.
- **Error codes follow the `<PKG>_<LAYER>_<KIND>` format.**
- **Kafka topic names carry no version suffix.** Topics follow `rntme.{svc}.{agg}`. A breaking event change uses a new `eventType`, not a new topic version.
- **CloudEvents 1.0 envelope end-to-end.** Do not extend the envelope shape ad-hoc; changes to envelope fields are a spec-level concern (see `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md`).
- **Single-writer event log.** The event store is the only write path; optimistic concurrency and the monotonic publish cursor depend on it. Do not introduce a parallel writer or a per-projection write path.
- **No line numbers in "Where to look first" pointers** — use function/file names (lines drift).
- **Specs in `docs/superpowers/specs/` are source of truth.** Code that disagrees with a spec is a bug, not an "implementation refinement". Note: `graph_ir_rc_7.md` is historical — it was the first-step IR spec and has been superseded by later specs (`2026-04-13-graph-ir-sql-compiler-mvp-design.md`, `2026-04-14-mutations-design.md`, `2026-04-16-qsm-relations-migration-design.md`, `2026-04-17-cloudevents-envelope-design.md`, …). Do not treat it as canon.
