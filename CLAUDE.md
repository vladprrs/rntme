# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Primary agent-facing doc

Read [`AGENTS.md`](AGENTS.md) first. It is the research map: repository layout, package layering, project-wide conventions (`Result<T>`, branded `Validated*` types, error-code naming, SQLite target), task-indexed "how to do X" recipes, anti-patterns, and a decision index. Per-package `README.md` files are the authoritative source for each package's internals and have a uniform template (File map / Quick start / API / Invariants & gotchas / Out of scope / Where to look first / Specs).

> Note: `graph_ir_rc_7.md` is gitignored (IR source of truth is local-only); `docs/superpowers/plans/`, `specs/`, and `reports/` are tracked so README and `AGENTS.md` spec links resolve for other contributors.

## Product positioning

Two layers of framing, and they must not collapse into one:

- **Internal framing** — used in this file, [`AGENTS.md`](AGENTS.md), specs, architecture docs, code comments, per-package READMEs. rntme is an **artifact-driven runtime authored as a project blueprint**. The project blueprint folder is the canonical authoring/versioning/deploy unit. Inside, services compose from JSON artifacts: PDM is project-shared; QSM, Graph IR, bindings, UI, seed, and manifest are per-service. CQRS / event sourcing / branded `Validated*` types / plugin seams (`DbDriver`, `EventBus`, `Surface`) / executor seams (`CommandExecutor`, `QueryExecutor`) are **consequences** of the repeatability goal, not the identity of the product.
- **Market framing** — used in [`README.md`](README.md) hero, [`vision.md`](vision.md), landing copy, pitches, YC application, buyer-facing blog posts. rntme is *"the safe runtime for AI-generated business workflow apps."* Buyers see ONE bounded authoring object — a **validated project blueprint** — not the internal multi-service or multi-artifact decomposition. Primary wedge: approvals, ticketing, customer-ops, onboarding, internal admin / back-office. The project blueprint may technically contain multiple services + integration modules; from the buyer's perspective it is a single business app.

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

Test categories live under each package's `test/` directory: `unit/`, `integration/`, `e2e/`, with fixtures in `test/fixtures/`.

## Architecture in one paragraph

rntme is a pnpm workspace that produces an event-sourced backend from a validated project blueprint folder (`project.json` + project-level PDM + N services + modules). `@rntme/blueprint` parses `project.json`, validates project routes/middleware/PDM, discovers service artifacts, and builds a project-routed binding registry. The shape every module exposes via `module.json` lives in the leaf contract `@rntme/contracts-module-v1` (`packages/contracts/module/v1/`); the provisioner runtime contract (`ProvisionerContract`, env-mapping types) lives in `@rntme/contracts-provisioner-v1`; and the browser module contract (`ModuleBootContext`, hooks/providers, operation registry, transport chain, visibility, router helpers) lives in `@rntme/contracts-client-runtime-v1`. Blueprint and `@rntme/deploy-core` import the manifest contract; deploy-core and any vendor module with a provisioner block import the provisioner contract; UI-bearing modules and `@rntme/ui-runtime` import the client-runtime contract instead of depending on runtime internals. Service-level primitives are `@rntme/pdm` for the project-shared domain model, `@rntme/qsm` for per-service projections, `@rntme/graph-ir-compiler`, `@rntme/event-store`, `@rntme/projection-consumer`, `@rntme/seed`, `@rntme/bindings` + `@rntme/bindings-http`, `@rntme/bindings-grpc`, and `@rntme/ui` + `@rntme/ui-runtime`. UI modules live under `modules/<category>/<vendor>/` with a `module.json` `client` block; identity providers are mixed modules whose `client.boot` initializes the browser SDK, registers Bearer transport middleware, writes `/auth/status` and `/auth/user` state, whose `client.components` ship `LoginScreen`/`UserBadge`, and whose `client.operations` expose `login`/`logout`. `project.json#modules` maps local keys to `{ package, publicConfig? }` and `@rntme/blueprint` compose merges manifests into a project catalog, validates `publicConfig` against each module schema, and exposes `catalogManifest`, `virtualEntrySource`, and `publicConfigJson` on the composed result. The executor seam (`CommandExecutor` / `QueryExecutor`) lets generated surfaces call commands and queries while modules (`@rntme/module-skeleton`, identity modules, `manifest.modules[]`, auth/request pre-fetch middleware, idempotency cache) compose integration behavior around services. `@rntme/runtime` is still the boot orchestrator for a single service; project-level intake is deferred. `@rntme/deploy-core` + `@rntme/deploy-dokploy` handle deployment planning/adapters; the platform control plane now stores encrypted Dokploy deploy targets, queues deployment records, runs the executor from immutable project-version bundles, and records apply/smoke evidence. The deploy pipeline runs `provision → plan → render → apply → verify` (provision sequenced before plan so blueprint vars can resolve `provision.*` outputs); modules can declare a `provisioner` block in `module.json` to reconcile external state (Auth0 clients, third-party API resources) and feed env vars into render via `provisionResult`/`provisionResultCiphertext`. `demo/notes-blueprint/` is the canonical project-shape example.

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
- **Every plan must include a documentation-touch task.** Any plan whose code changes affect a per-package README, `AGENTS.md` (§3 layering / §6 how-tos / §10 glossary), `README.md` (packages table / dep graph / MVP scope), this file's "Architecture in one paragraph" or "Product positioning", `docs/architecture.md`, or `vision.md` MUST land those doc updates in the same PR as the code. See `AGENTS.md §11` for the checklist; see `docs/superpowers/specs/done/2026-04-26-docs-refresh-after-project-first-pivot-design.md` for the cost evidence of letting drift accumulate (PR-12-to-PR-16 window). "No docs need updating" is a valid outcome — but it must be a recorded decision in the plan, not an omission.
