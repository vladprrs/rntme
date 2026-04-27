# rntme

[![CI](https://github.com/vladprrs/rntme/actions/workflows/ci.yml/badge.svg)](https://github.com/vladprrs/rntme/actions/workflows/ci.yml)

> **The safe runtime for AI-generated business workflow apps.**
>
> Coding agents can already help teams build a first app quickly, but every additional app tends to become a custom backend snowflake. rntme turns a validated project blueprint into working APIs and a UI on a standard runtime, so teams can create workflow-heavy business apps repeatably instead of reinventing architecture each time.

- 📖 **Vision, ICP, competitive landscape, GTM:** [`vision.md`](vision.md).
- 🧱 **Architecture deep-dive:** [`docs/architecture.md`](docs/architecture.md).
- 🤖 **Coding agents:** start with [`AGENTS.md`](AGENTS.md) — it has the research map, conventions, and task-indexed pointers.

## What rntme does

A team (or an agent) describes a working app as a **validated project blueprint**: a project blueprint folder containing `project.json` (project metadata, routing, and middleware), a project-level PDM, one or more services (each with its own QSM, Graph IR, bindings, UI, seed, and manifest), and integration modules. The rntme runtime validates the blueprint in layers and boots the services described by it, with project-level routing and middleware composing them into one HTTP surface — **with zero service-specific code**.

The durable unit is the project blueprint. Teams edit the blueprint; the runtime keeps the app consistent. Agents author blueprints; the runtime enforces what's valid. The second workflow starts from a copy of the first project blueprint, not from an empty repo.

**Where it fits.** rntme targets **stateful, workflow-heavy services** — approvals, ticketing, customer-ops consoles, onboarding flows, internal admin and back-office. That's the wedge; see [`vision.md`](vision.md) for the full ICP, JTBD, and competitive landscape.

**What we deliberately do not build:** a generic AI app builder (Lovable / Bolt / Firebase Studio), a backend-as-a-service (Supabase / Appwrite / Firebase), an internal-tools low-code platform (Retool / Appsmith / ToolJet / Budibase), or an agent runtime. rntme runs the services that agents describe, not the agents themselves.

## Under the hood

The project blueprint is the market-facing surface. Internally it compiles from a project-level layer (`project.json` plus project-level PDM) and per-service artifacts — **QSM** (read-side projections), **Graph IR** (queries + commands, carried by bindings / UI), **bindings** (HTTP surface), **UI**, **seed**, **manifest** — through a four-layer validator onto an event-sourced SQLite runtime.

The modules layer, executor seam (`CommandExecutor` / `QueryExecutor`), and gRPC surface add integration points without service-specific glue. CQRS, event-sourcing, SQLite / Turso, branded `Validated*` types, and plugin seams (`DbDriver`, `EventBus`, `Surface`) are **consequences** of the repeatability goal, not the identity of the product — they deliver extensibility without editing artifacts, migrations as event replay, and one-file-per-service scale-out.

From the project layer and service-level artifacts, the toolchain produces:

- SQLite DDL for projections and the event log.
- SQL for every query graph and a runtime to execute it.
- An event-sourced command runtime with optimistic concurrency, at-least-once Kafka-style relay, and bounded-retry DLQ.
- An idempotent projection consumer that keeps the read-side eventually consistent.
- An OpenAPI 3.1 document and a Hono HTTP surface.
- A declarative React SPA compiled from the `ui` artifact.

Organised as a pnpm monorepo. Each package has a single, testable responsibility and depends only on the packages strictly below it.

## Architecture at a glance

```mermaid
flowchart LR
    subgraph authors["Artifact authors"]
        AI["AI agent"]:::external
        HUM["Human"]:::external
    end
    subgraph blueprint["validated project blueprint (folder)"]
        direction TB
        PJSON["project.json<br/>routes + middleware + service registry"]:::project
        PPDM["project-level PDM"]:::project
        subgraph services["service-level artifacts x N"]
            direction TB
            QSM["QSM"]:::artifact
            IR["Graph IR"]:::artifact
            B["Bindings"]:::artifact
            UI["UI"]:::artifact
            S["Seed"]:::artifact
            M["Manifest"]:::artifact
        end
        MOD["modules x N<br/>(gRPC adapters)"]:::module
    end
    V["4-layer validator<br/>(parse → structural → reference → consistency)"]:::validator
    REG["project-routed bindings<br/>+ composed project model"]:::runtime
    R["rntme runtime<br/>(per-service today;<br/>project intake deferred)"]:::runtime
    DEPLOY["@rntme-cli/deploy-core<br/>+ deploy-dokploy"]:::deploy
    DB[("SQLite / Turso")]:::storage
    SVC["Running project<br/>(HTTP + UI)"]:::runtime

    AI --> blueprint
    HUM --> blueprint
    blueprint --> V --> REG --> R
    R --> DB
    R --> SVC
    blueprint --> DEPLOY

    classDef artifact fill:#1b3a5c,stroke:#4a90e2,color:#fff;
    classDef project fill:#1b3a5c,stroke:#4a90e2,color:#fff,stroke-width:3px;
    classDef module fill:#1b3a5c,stroke:#4a90e2,color:#fff,stroke-dasharray: 4 2;
    classDef validator fill:#5c3a1b,stroke:#e29a4a,color:#fff;
    classDef storage fill:#1b5c3a,stroke:#4ae29a,color:#fff;
    classDef runtime fill:#3a1b5c,stroke:#9a4ae2,color:#fff;
    classDef deploy fill:#3a1b5c,stroke:#9a4ae2,color:#fff,stroke-dasharray: 4 2;
    classDef external fill:#444,stroke:#999,color:#fff;
```

> **Deep dive:** [`docs/architecture.md`](docs/architecture.md) — full C4 (L1–L4), 18 diagrams, ~25-entry cross-cutting abstractions catalogue, and a diagnostic observations section across 9 lenses.

## The commercial platform (`platform.rntme.com`)

The `@rntme/runtime` stack is open-source and free — that's the trust engine. The commercial platform, hosted in the [`rntme-cli`](rntme-cli/) submodule and live at [`platform.rntme.com`](https://platform.rntme.com), is the monetization layer. It grows along four pillars:

1. **Control plane** — organizations, projects, services, environments, API tokens, RBAC, SSO (WorkOS-backed). *Partially live.*
2. **Registry** — publish and pull validated blueprints; content-addressed artifact bundles on S3-compatible storage; versions, tags, history, diff, lineage. *Partially live.*
3. **Deploy surface** — promote a blueprint version onto managed infra; environments; rollbacks; preview deploys. The platform now stores encrypted Dokploy deploy targets, queues deployment records from project versions, runs the `@rntme-cli/deploy-core` planner plus `@rntme-cli/deploy-dokploy` adapter, captures logs/apply results/smoke evidence, and exposes the flow through REST and the UI; see [`docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md`](docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md).
4. **Governance layer** — blueprint review UI for humans (including business users who never touch code); approval workflows; audit trail; policy gates that block bad blueprints before deploy.

Design: [`docs/superpowers/specs/done/2026-04-19-platform-api-design.md`](docs/superpowers/specs/done/2026-04-19-platform-api-design.md). Strategic context: [`vision.md`](vision.md) §8 *The future platform*.

## Packages

| Package | Purpose |
| ------- | ------- |
| [`@rntme/blueprint`](packages/blueprint) | Project-first blueprint folder parser/validator: loads `project.json`, project-level PDM, service artifacts, route/middleware composition, and the project-routed binding registry. |
| [`@rntme/pdm`](packages/pdm) | Platform Domain Model: project-shared entities, ownership classification, fields, relations, and optional stateMachine per entity; derives event-type specs from transitions. |
| [`@rntme/qsm`](packages/qsm) | Query-Side Materialized projections: declares per-service read-side tables, projection-per-file directories, relation metadata for JOINs, DDL, and event-handler specs. |
| [`@rntme/event-store`](packages/event-store) | SQLite-backed event log with optimistic concurrency + at-least-once Kafka relay. |
| [`@rntme/seed`](packages/seed) | Declarative `seed.json`: parse and validate envelopes against the PDM, append to the event store (used by `@rntme/runtime` for reference data). |
| [`@rntme/projection-consumer`](packages/projection-consumer) | Kafka → SQLite projection updater with three-layer idempotency and batch transactions. |
| [`@rntme/graph-ir-compiler`](packages/graph-ir-compiler) | Graph IR → SQLite compiler (query path) and state-machine-gated command runtime (command path) behind executor seams. |
| [`@rntme/bindings`](packages/bindings) | HTTP bindings artifact + four-layer validator + OpenAPI 3.1 emitter, including `pre[]`, callback bindings, input sources, and response shapes. |
| [`@rntme/bindings-http`](packages/bindings-http) | Hono sub-router that executes validated query/command bindings with pre-fetch orchestration, callback redirects, and idempotency cache support. |
| [`@rntme/bindings-grpc`](packages/bindings-grpc) | gRPC adapter surface for module and service integration through `CommandExecutor` / `QueryExecutor`. |
| [`@rntme/ui`](packages/ui) | UI artifact + four-layer validator; declarative per-service UI description with route-local `data` + `actions` bindings resolved through project-routed refs. |
| [`@rntme/ui-runtime`](packages/ui-runtime) | Hono sub-router + SPA bundle that executes `@rntme/ui` artifacts against the service's HTTP bindings. |
| [`@rntme/db-studio`](packages/db-studio) | libSQL Hrana v3 read-only HTTP endpoint over rntme's two SQLite handles, usable by any Hrana-compatible browser studio. |
| [`@rntme/runtime`](packages/runtime) | Service runtime: reads a folder of artifacts + `manifest.json`, wires executor seams, module pre-fetch/idempotency support, and serves the full HTTP surface. Published as both an npm package and the `ghcr.io/vladprrs/rntme-runtime` image. |
| [`@rntme/module-skeleton`](packages/module-skeleton) | Minimal scaffold package for the module-integration track; depends on `@rntme/runtime`. |
| **Canonical contracts (Identity track)** |  |
| [`@rntme/contracts-common-v1`](packages/contracts/_common/v1) | Shared cross-category protobuf primitives (`CanonicalRef`, `CommandContext`, `Name`, `ListRequest`/Filter/Sort, `Metadata`) imported by every category contract. |
| [`@rntme/contracts-ai-llm-v1`](packages/contracts/ai-llm/v1) | Canonical AI/LLM contract: `service AiLlmModule` (14 RPCs), Completion, AssistantThread, AsyncJob, sixteen CloudEvents payloads, MCP-shape tools, `AI_LLM_<LAYER>_<KIND>` error codes. |
| [`@rntme/contracts-identity-v1`](packages/contracts/identity/v1) | Canonical Identity contract: `service IdentityModule` (24 RPCs), six entity types, seventeen CloudEvents payloads, `IDENTITY_<LAYER>_<KIND>` error codes. |
| **Identity vendor track** |  |
| [`@rntme/conformance-identity`](modules/identity/conformance) | Per-RPC conformance scenarios for `@rntme/contracts-identity-v1`. Drift-tested against the canonical `service IdentityModule`. Imported by every Identity vendor module. |
| **AI/LLM vendor track** |  |
| [`@rntme/conformance-ai-llm`](modules/ai-llm/conformance) | AI/LLM conformance scenarios + fixtures (14 RPCs, binary media). Drift-tested against `service AiLlmModule`. Imported by every AI/LLM vendor module. |

| **Deployment (CLI-side)** |  |
| [`@rntme-cli/deploy-core`](rntme-cli/packages/deploy-core) | Target-neutral deployment plan model for validated/composed projects. |
| [`@rntme-cli/deploy-dokploy`](rntme-cli/packages/deploy-dokploy) | Dokploy adapter that renders and applies redacted deployment plans. |

### Demo

> **Deprecated historical reference.** `demo/issue-tracker-api` is a single-service example from the pre project-first model. Keep it useful for runtime smoke tests, but do not treat it as the canonical project blueprint example.

[`demo/issue-tracker-api`](demo/issue-tracker-api) is an end-to-end issue tracker — an example from the *ticketing* wedge class (alongside approvals, customer-ops, onboarding, back-office). It wires every package together: PDM with a stateMachine, QSM entity-mirror projections, 14 graphs (queries + commands), bindings → OpenAPI, a full event pipeline with the in-memory Kafka bridge, a Hono HTTP server, and a declarative UI served at `GET /ui`.

### Dependency graph

```mermaid
flowchart TB
    classDef pkg fill:#3a1b5c,stroke:#9a4ae2,color:#fff;
    classDef demo fill:#1b5c3a,stroke:#4ae29a,color:#fff;

    BP["@rntme/blueprint"]:::pkg
    PDM["@rntme/pdm"]:::pkg
    QSM["@rntme/qsm"]:::pkg
    ES["@rntme/event-store"]:::pkg
    GIR["@rntme/graph-ir-compiler"]:::pkg
    B["@rntme/bindings"]:::pkg
    BH["@rntme/bindings-http"]:::pkg
    BG["@rntme/bindings-grpc"]:::pkg
    UI["@rntme/ui"]:::pkg
    UIR["@rntme/ui-runtime"]:::pkg
    DS["@rntme/db-studio"]:::pkg
    PC["@rntme/projection-consumer"]:::pkg
    SD["@rntme/seed"]:::pkg
    RT["@rntme/runtime"]:::pkg
    MS["@rntme/module-skeleton"]:::pkg
    DEMO["demo/issue-tracker-api"]:::demo

    BP --> PDM & QSM
    QSM --> PDM
    GIR --> PDM & QSM & ES
    BH --> B & GIR & ES
    BG --> B & GIR & ES
    UIR --> UI
    PC --> ES & GIR & PDM & QSM
    SD --> ES & PDM
    RT --> BH & BG & UIR & DS & PC & SD & GIR & ES
    MS --> RT
    DEMO --> RT
```

Arrows mean "depends on". `pdm`, `event-store`, `bindings`, `ui`, and `db-studio` have no internal dependencies. `@rntme/blueprint` validates project composition and produces a project-routed binding registry consumed by `@rntme/bindings` / `@rntme/ui` for compilation. Project-level runtime intake — boot from a project blueprint folder rather than a single service folder — is **not yet wired** in `@rntme/runtime`; the runtime still boots one service at a time. See [`docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md`](docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md). `demo/issue-tracker-api` is the historical single-service consumer of `@rntme/runtime`.

## Quick start

Requirements: **Node.js ≥ 20**, **pnpm ≥ 9** (CI uses pnpm 9.12.0).

### Private submodule (`rntme-cli/`)

Some CLI code lives in a private submodule at `rntme-cli/` backed by
`vladprrs/rntme-cli`. Clone the monorepo with
`git clone --recurse-submodules https://github.com/vladprrs/rntme.git`, or
after a plain clone run `git submodule update --init --recursive`. New git
worktrees created with `git worktree add` do not initialise submodules
automatically — run `git submodule update --init --recursive` inside each
new worktree. External contributors without access to the private repo will
see `pnpm -r` skip `@rntme-cli/*` workspace members.

```bash
pnpm install
pnpm -r run build
pnpm -r run test
```

### Run a service with the runtime

The runtime is the production face of the project. Given a folder of artifacts it boots the whole stack with no user code:

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/demo/issue-tracker-api/artifacts:/srv/artifacts:ro" \
  ghcr.io/vladprrs/rntme-runtime:1.0
```

Or embed it (the demo does this):

```ts
import { loadService, startService } from '@rntme/runtime';
const loaded = loadService('./artifacts');
if (loaded.ok) await startService(loaded.value);
```

### Run the demo

```bash
pnpm -F @rntme/issue-tracker-api-demo start
# ➜ issue-tracker-api-demo listening on http://localhost:3000
# UI: http://localhost:3000/ui
```

```bash
curl -s 'http://localhost:3000/v1/issues?status=open&limit=5'

curl -s -X POST http://localhost:3000/v1/issues \
  -H 'content-type: application/json' \
  -H 'x-actor-id: alice' \
  -d '{"issueId":7001,"title":"Demo","projectId":1,"reporterId":1,"priority":"high","storyPoints":3}'
```

See [`demo/issue-tracker-api/README.md`](demo/issue-tracker-api/README.md) for the full route inventory, seed instructions and example flow.

## Developer commands

Each library package exposes the same scripts. Run them across all packages from the root, or for one package with `pnpm -F <name>`.

| Command | Effect |
| ------- | ------ |
| `pnpm -r run build` | `tsc -p tsconfig.json` in every package. |
| `pnpm -r run typecheck` | Typecheck-only pass with `tsconfig.check.json`. |
| `pnpm -r run test` | `vitest run` in every package (unit + integration + e2e + golden). |
| `pnpm -r run lint` | ESLint on `src/**` and `test/**`. |
| `pnpm -F <name> test:watch` | Vitest watch mode for one package. |
| `pnpm -F @rntme/issue-tracker-api-demo start` | Start the demo via `@rntme/runtime` (`tsx src/server.ts`; override port with `RNTME_HTTP_PORT`). |
| `pnpm -F @rntme/issue-tracker-api-demo start:runtime-cli` | Start via the `rntme-runtime start ./artifacts` CLI. |

CI runs `build → typecheck → test → lint` on every push and PR to `main` (see `.github/workflows/ci.yml`).

## Design docs and specs

- [`docs/architecture.md`](docs/architecture.md) — **top-down architecture overview** (C4 L1–L4, 18 mermaid diagrams, cross-cutting abstractions catalogue, diagnostic observations). Start here if you want depth.
- [`AGENTS.md`](AGENTS.md) — research map for coding agents: task-indexed pointers, conventions, per-package entry points.
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` — platform modules, gRPC adapters, executor seams, pre-fetch middleware, idempotency cache, and callback bindings.
- `docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md` — active umbrella spec for the project-first pivot: project blueprint folder, project-level PDM, service-level cross-service QSM, project routing/middleware, runtime deferred.
- `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md` — deploy pipeline: target-neutral planning, redacted previews, Dokploy rendering, and apply flow.
- `docs/superpowers/specs/done/2026-04-13-graph-ir-sql-compiler-mvp-design.md` — compiler scope and MVP deviations from rc7.
- `docs/superpowers/specs/done/2026-04-14-mutations-design.md` — CQRS / ES design: stateMachine, event envelope, command role, event store, relay, projection consumer.
- `docs/superpowers/specs/done/2026-04-14-bindings-design.md` — bindings artifact, four-layer validation, OpenAPI emission.
- `docs/superpowers/specs/done/2026-04-14-bindings-http-design.md` — Hono runtime for bindings.
- `docs/superpowers/specs/*.md` — active specs (e.g. CloudEvents envelope, DLQ, QSM relations migration, architecture overview, db-studio).
- `docs/superpowers/plans/*.md` — per-feature implementation plans.
- `docs/superpowers/reports/*.md` — gap analyses (spec vs. implementation).

## MVP / Tier 1 scope

What ships today:

- SQLite target only (`≥ 3.30`); **no PostgreSQL**, ksqlDB or other dialects. Scale-out target is **Turso** (SQLite-compatible Rust rewrite), not a different database.
- Both `entity-mirror` and `derived` projection backings are supported (derived projections are built from Graph IR sources).
- Single-writer event log; Kafka-style relay is at-least-once with per-stream ordering (partition key = `stream`), bounded retries, and a DLQ wrapper event on poison.
- The demo uses an in-memory Kafka bridge; plugging a real broker is a `KafkaProducer` / `KafkaConsumer` swap.
- One graph compiled per `compile()` call.
- Query nodes: `findMany`, `filter`, `map`, `reduce`, `sort`, `limit`. Command path adds `emit`.
- JSON authoring; no YAML.
- UI artifact (`@rntme/ui` + `@rntme/ui-runtime`): shadcn-catalog-based React SPA with route-local `data` (query bindings) and `actions` (command or navigation bindings), four-layer validation, `NextAppSpec`-compatible format. No SSR.
- CloudEvents 1.0 envelope end-to-end; topics follow `rntme.{svc}.{agg}` (no `.v1` suffix — breaking event changes use a new `eventType`, not a topic version).
- Read-only libSQL Hrana endpoint (`@rntme/db-studio`) over both runtime SQLite handles, usable from any Hrana-compatible browser studio.
- Project blueprint composition: `project.json` + project-level PDM + N services + modules; project routes/middleware validated; project-routed binding registry compiled. Runtime intake at the project level is not yet wired.
- Platform modules integration: `manifest.modules[]` declares external services; pre-fetch middleware (`pre[]`) supports `system` (idempotency-key) + `module-rpc` steps; HTTP idempotency cache (24h TTL); callback bindings (GET + 302). Module communication is gRPC-based (`@rntme/bindings-grpc`).

Out of scope for now: snapshots, multi-aggregate commands, list/`in` parameters, named predicate graphs, `distinct`, `lookupOne`, window functions, auth/authz, multi-tenancy, schema registry / breaking schema evolution.

## Glossary

| Term | Meaning |
| ---- | ------- |
| **PDM** | Platform Domain Model — entities, fields, relations, optional stateMachine per entity. |
| **QSM** | Query-Side Materialized projections — read-side tables derived from PDM. |
| **Graph IR** | Declarative DAG of operators (`findMany`, `filter`, …, `emit`) that compiles to SQL and/or events. |
| **Canonical Graph IR** | Normalised internal form without syntactic sugar. |
| **Semantic plan** | Typed, scope-resolved plan produced by the semantic layer of the compiler. |
| **Bindings** | Artifact mapping graphs to HTTP operations; input to OpenAPI generation. |
| **Event envelope** | Immutable event record (eventId, stream, version, actor, payload, schemaVersion, …). |
| **Aggregate** | Domain entity identified by `<aggregateType>-<aggregateId>`; stream of events. |
| **Relay** | Background loop that tails the event log and publishes to Kafka with a persistent cursor. |
| **Projection** | Materialised view kept up to date by the projection consumer. |
| **Entity-mirror** | Projection backing that mirrors an entity's exposed fields plus generated columns and idempotency columns. |
| **Emit node** | Graph IR node describing an event to append for a mutation. |
| **Result\<T\>** | `{ ok: true; value: T } \| { ok: false; errors: E[] }` — no exceptions in the validation pipeline. |
