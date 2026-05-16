# Simplify Monorepo Audit — Catalog

## Schema

Living document for the `simplify-monorepo-audit` goal. Phase A (T001) seeds the
workspace map. Phase B (T002–T007) appends findings. Phase C (T100/T101) ranks
them and produces a worker queue / backlog.

### Finding entry schema

Each entry under `1_findings` MUST have these fields:

- `id` — `F###` (zero-padded, monotonic across waves).
- `package(s)` — comma-separated list of workspace package names (or paths).
- `kind` — one of: `architectural`, `duplication`, `suboptimal`, `complexity`, `dead_strut`, `risk`.
- `severity` — `P0` | `P1` | `P2` | `P3`.
- `impact` — `high` | `med` | `low`.
- `confidence` — `high` | `med` | `low`.
- `reversibility` — `high` | `med` | `low`.
- `est_effort_h` — number (hours).
- `evidence_paths` — list of repo-relative file paths.
- `summary` — one paragraph, ≤3 sentences.
- `proposed_fix` — one paragraph, ≤3 sentences.

### Workspace map columns

`0_workspace_map` is one row per workspace package:

| Package | Path | Purpose (≤12 words) | Owner doc | Has tests? | Last touched (short SHA + date) |

- **Has tests?** = `Y` if package has a `test/` dir or any `*.test.ts(x)` file (excluding `node_modules` and `dist`); else `N`.
- **Owner doc** = relative path under `docs/current/owners/**` if present, else `—`.
- **Last touched** = `git log -1 --format='%h %ad' --date=short -- <path>`.

Vendored snapshots under `demo/*/node_modules/**` and `apps/platform/blueprint/services/*/node_modules/**` are out of scope.

## 0_workspace_map

| Package | Path | Purpose (≤12 words) | Owner doc | Has tests? | Last touched (short SHA + date) |
|---|---|---|---|---|---|
| @rntme/cli | apps/cli | rntme CLI — create and operate services from artifacts | docs/current/owners/apps/cli.md | Y | 15c9d005 2026-05-14 |
| @rntme/landing | apps/landing | Astro landing site workspace for rntme.com | docs/current/owners/apps/landing.md | Y | 4f7b6753 2026-05-10 |
| @rntme/platform-blueprint | apps/platform | Platform-as-blueprint authoring surface + native handler stubs | docs/current/owners/apps/platform.md | Y | 8c126e2c 2026-05-15 |
| @rntme/platform-ui | apps/platform/ui-module | Platform-specific UI module for the control plane | docs/current/owners/apps/platform.md | Y | cdf20888 2026-05-15 |
| @rntme/demo-cv-extract-blueprint | demo/cv-extract-blueprint | Demo project blueprint for CV extraction workflows | docs/current/owners/demo/cv-extract-blueprint.md | Y | 11ab519f 2026-05-14 |
| (blueprint source, no package.json) | demo/notes-blueprint | Demo notes blueprint sources (no package.json) | docs/current/owners/demo/notes-blueprint.md | N | 682c5a5d 2026-05-13 |
| (blueprint source, no package.json) | demo/order-fulfillment-blueprint | Demo order-fulfillment blueprint sources (no package.json) | docs/current/owners/demo/order-fulfillment-blueprint.md | N | b6850f62 2026-05-07 |
| @rntme/conformance-ai-llm | modules/ai-llm/conformance | Conformance scenarios for AI/LLM canonical contract v1 | docs/current/owners/modules/ai-llm/conformance.md | Y | 4f7b6753 2026-05-10 |
| @rntme/ai-llm-openrouter | modules/ai-llm/openrouter | OpenRouter vendor module for AI/LLM canonical contract | docs/current/owners/modules/ai-llm/openrouter.md | Y | 6d4b4bed 2026-05-13 |
| @rntme/analytics-google-analytics | modules/analytics/google-analytics | Google Analytics 4 UI module (analytics category) | docs/current/owners/modules/analytics/google-analytics.md | Y | 4f7b6753 2026-05-10 |
| @rntme/crm-amocrm | modules/crm/amocrm | amoCRM vendor module for CRM canonical contract | docs/current/owners/modules/crm/amocrm.md | Y | 4f7b6753 2026-05-10 |
| @rntme/crm-bitrix24 | modules/crm/bitrix24 | Bitrix24 vendor module for CRM canonical contract | docs/current/owners/modules/crm/bitrix24.md | Y | 4f7b6753 2026-05-10 |
| @rntme/conformance-crm | modules/crm/conformance | Conformance scenarios for CRM canonical contract v1 | docs/current/owners/modules/crm/conformance.md | Y | 4f7b6753 2026-05-10 |
| @rntme/identity-auth0 | modules/identity/auth0 | Auth0 vendor module for Identity canonical contract | docs/current/owners/modules/identity/auth0.md | Y | 89b7299d 2026-05-14 |
| @rntme/identity-clerk | modules/identity/clerk | Clerk vendor module for Identity canonical contract | docs/current/owners/modules/identity/clerk.md | Y | 4f7b6753 2026-05-10 |
| @rntme/conformance-identity | modules/identity/conformance | Per-RPC conformance scenarios for Identity contract | docs/current/owners/modules/identity/conformance.md | Y | 4f7b6753 2026-05-10 |
| @rntme/identity-workos | modules/identity/workos | WorkOS vendor module for Identity canonical contract | docs/current/owners/modules/identity/workos.md | Y | 4f7b6753 2026-05-10 |
| @rntme/conformance-marketing-site | modules/marketing-site/conformance | Conformance scenarios for marketing-site canonical contract | — | Y | 9677d326 2026-05-13 |
| @rntme/marketing-site-static | modules/marketing-site/static-html | Static HTML vendor module for marketing-site contract | — | Y | 1cb33470 2026-05-13 |
| @rntme/presentation-md-mermaid | modules/presentation/md-mermaid | Markdown + Mermaid UI module for rntme | docs/current/owners/modules/presentation/md-mermaid.md | Y | 4f7b6753 2026-05-10 |
| @rntme/presentation-tiptap | modules/presentation/tiptap | Tiptap rich text UI module for rntme | docs/current/owners/modules/presentation/tiptap.md | Y | 4f7b6753 2026-05-10 |
| @rntme/conformance-storage | modules/storage/conformance | Per-RPC conformance scenarios for Storage contract | — | Y | 4f7b6753 2026-05-10 |
| @rntme/storage-s3 | modules/storage/s3 | S3-compatible vendor module for Storage contract | docs/current/owners/modules/storage/s3.md | Y | 3b95c429 2026-05-13 |
| @rntme/bindings | packages/artifacts/bindings | HTTP bindings artifact + OpenAPI 3.1 generator for Graph IR | docs/current/owners/packages/artifacts/bindings.md | Y | 6d4ed92a 2026-05-13 |
| @rntme/blueprint | packages/artifacts/blueprint | Project-first blueprint folder parser/validator | docs/current/owners/packages/artifacts/blueprint.md | Y | 15c9d005 2026-05-14 |
| @rntme/graph-ir-compiler | packages/artifacts/graph-ir-compiler | Graph IR → SQL compiler (SQLite target, MVP Tier 1) | docs/current/owners/packages/artifacts/graph-ir-compiler.md | Y | 4de567cd 2026-05-14 |
| @rntme/init | packages/artifacts/init | Project-level lifecycle init artifact parser/validator | docs/current/owners/packages/artifacts/init.md | Y | 4f7b6753 2026-05-10 |
| @rntme/pdm | packages/artifacts/pdm | PDM parser/validator/resolver with stateMachine extension | docs/current/owners/packages/artifacts/pdm.md | Y | 4f7b6753 2026-05-10 |
| @rntme/qsm | packages/artifacts/qsm | QSM parser/validator/DDL + handler derivation/resolver | docs/current/owners/packages/artifacts/qsm.md | Y | 4f7b6753 2026-05-10 |
| @rntme/seed | packages/artifacts/seed | Seed event-store from declarative seed.json envelopes | docs/current/owners/packages/artifacts/seed.md | Y | 4f7b6753 2026-05-10 |
| @rntme/artifact-shared | packages/artifacts/_shared | Shared Result/Ok/Err algebra used across artifacts | — | Y | ef9d1fbb 2026-05-10 |
| @rntme/ui | packages/artifacts/ui | UI artifact compiler | docs/current/owners/packages/artifacts/ui.md | Y | 45ae3358 2026-05-13 |
| @rntme/workflows | packages/artifacts/workflows | Project-level workflow artifact parser/validator (BPMN/Operaton) | docs/current/owners/packages/artifacts/workflows.md | Y | b8a94c4f 2026-05-10 |
| @rntme/contracts-ai-llm-v1 | packages/contracts/ai-llm/v1 | Canonical AI/LLM contract v1 (16 CloudEvents) | docs/current/owners/packages/contracts/ai-llm/v1.md | Y | 4f7b6753 2026-05-10 |
| @rntme/contracts-analytics-v1 | packages/contracts/analytics/v1 | Canonical UI contract for analytics vendor category (v1) | docs/current/owners/packages/contracts/analytics/v1.md | Y | 4f7b6753 2026-05-10 |
| @rntme/contracts-client-runtime-v1 | packages/contracts/client-runtime/v1 | Client runtime contract — types/hooks/providers for client blocks | docs/current/owners/packages/contracts/client-runtime/v1.md | Y | 4f7b6753 2026-05-10 |
| @rntme/contracts-common-v1 | packages/contracts/_common/v1 | Shared cross-category protobuf primitives | docs/current/owners/packages/contracts/_common/v1.md | Y | 4f7b6753 2026-05-10 |
| @rntme/contracts-crm-v1 | packages/contracts/crm/v1 | Canonical CRM contract v1 (21 CloudEvents) | docs/current/owners/packages/contracts/crm/v1.md | Y | 4f7b6753 2026-05-10 |
| @rntme/contracts-handlers-v1 | packages/contracts/handlers/v1 | Code command handler contract for runtime executor | docs/current/owners/packages/contracts/handlers/v1.md | Y | 4f7b6753 2026-05-10 |
| @rntme/contracts-identity-v1 | packages/contracts/identity/v1 | Canonical Identity contract v1 (17 CloudEvents) | docs/current/owners/packages/contracts/identity/v1.md | Y | 4f7b6753 2026-05-10 |
| @rntme/contracts-marketing-site-v1 | packages/contracts/marketing-site/v1 | Canonical marketing-site contract v1 | docs/current/owners/packages/contracts/marketing-site.md | Y | ddb20895 2026-05-13 |
| @rntme/contracts-module-v1 | packages/contracts/module/v1 | Module manifest contract — JSON shape of module.json | docs/current/owners/packages/contracts/module/v1.md | Y | 9fe8e119 2026-05-13 |
| @rntme/contracts-provisioner-v1 | packages/contracts/provisioner/v1 | Provisioner runtime contract for vendor modules | docs/current/owners/packages/contracts/provisioner/v1.md | Y | 4f7b6753 2026-05-10 |
| @rntme/contracts-storage-v1 | packages/contracts/storage/v1 | Canonical Storage contract v1 (six file events) | — | Y | 4f7b6753 2026-05-10 |
| @rntme/deploy-core | packages/deploy/deploy-core | Target-neutral project deployment planning | docs/current/owners/packages/deploy/deploy-core.md | Y | 15c9d005 2026-05-14 |
| @rntme/deploy-dokploy | packages/deploy/deploy-dokploy | Dokploy target adapter for project deployments | docs/current/owners/packages/deploy/deploy-dokploy.md | Y | 15c9d005 2026-05-14 |
| @rntme/deploy-runner | packages/deploy/deploy-runner | Pure deploy orchestrator library (CLI + platform) | docs/current/owners/packages/deploy/deploy-runner.md | Y | 15c9d005 2026-05-14 |
| @rntme/deploy-bundle-input | packages/platform/deploy-bundle-input | Lift materialized blueprint bundle into deploy-core input | docs/current/owners/packages/platform/deploy-bundle-input.md | Y | 2d6caaca 2026-05-14 |
| @rntme/platform-core | packages/platform/platform-core | Platform control-plane: domain, use-cases, seam interfaces | docs/current/owners/packages/platform/platform-core.md | Y | 4b1796c8 2026-05-13 |
| @rntme/platform-storage | packages/platform/platform-storage | Postgres (Drizzle + RLS) and rustfs adapters for platform-core | docs/current/owners/packages/platform/platform-storage.md | Y | 4b1796c8 2026-05-13 |
| @rntme/bindings-grpc | packages/runtime/bindings-grpc | gRPC surface for bindings — emits .proto, serves via grpc-js | docs/current/owners/packages/runtime/bindings-grpc.md | Y | 4f7b6753 2026-05-10 |
| @rntme/bindings-http | packages/runtime/bindings-http | Hono-based HTTP runtime for bindings | docs/current/owners/packages/runtime/bindings-http.md | Y | 16f563b8 2026-05-13 |
| @rntme/bpmn-worker | packages/runtime/bpmn-worker | BPMN worker bridge: Kafka → Operaton → gRPC commands | docs/current/owners/packages/runtime/bpmn-worker.md | Y | 15c9d005 2026-05-14 |
| @rntme/event-store | packages/runtime/event-store | SQLite-backed event store + Kafka publication relay | docs/current/owners/packages/runtime/event-store.md | Y | 4f7b6753 2026-05-10 |
| @rntme/projection-consumer | packages/runtime/projection-consumer | Idempotent Kafka → SQLite projection consumer (read-side) | docs/current/owners/packages/runtime/projection-consumer.md | Y | 4f7b6753 2026-05-10 |
| @rntme/runtime | packages/runtime/runtime | Zero-code runtime: PDM/QSM/graphs/bindings/ui → HTTP | docs/current/owners/packages/runtime/runtime.md | Y | 15c9d005 2026-05-14 |
| @rntme/sqlite | packages/runtime/sqlite | Shared SQLite port over bun:sqlite (only allowed driver) | docs/current/owners/packages/runtime/sqlite.md | Y | 4f7b6753 2026-05-10 |
| @rntme/ui-runtime | packages/runtime/ui-runtime | UI runtime package | docs/current/owners/packages/runtime/ui-runtime.md | Y | 66e64829 2026-05-13 |
| @rntme/bundle-publish | packages/tooling/bundle-publish | Folder → deterministic tar+gzip+sha256 bundle → S3 PUT | docs/current/owners/packages/tooling/bundle-publish.md | Y | 4f7b6753 2026-05-10 |
| @rntme/module-scaffold | packages/tooling/module-scaffold | Examples and scaffolding for rntme module authors | docs/current/owners/packages/tooling/module-scaffold.md | Y | 4f7b6753 2026-05-10 |

**Counts:** 60 rows total. 58 workspace packages (have `package.json`) + 2 non-vendored demo blueprint sources (`demo/notes-blueprint`, `demo/order-fulfillment-blueprint`) which lack a `package.json` but ship source artifacts.

**Missing owner docs (3):** `@rntme/artifact-shared` (`packages/artifacts/_shared`), `@rntme/conformance-marketing-site` (`modules/marketing-site/conformance`), `@rntme/marketing-site-static` (`modules/marketing-site/static-html`), `@rntme/conformance-storage` (`modules/storage/conformance`), `@rntme/contracts-storage-v1` (`packages/contracts/storage/v1`). _(There are 5 — `marketing-site/conformance` and `marketing-site/static-html` both lack files; the `modules/marketing-site.md` owner doc exists at the category level only.)_

**Other notes:**
- `apps/platform/ui-module` shares its owner doc with `apps/platform`.
- `modules/marketing-site/` has only a category-level owner doc (`docs/current/owners/modules/marketing-site.md`); per-vendor docs missing.
- All packages with a `package.json` have either a `test/` directory or `*.test.ts(x)` files — zero packages reported `N`.
- `demo/notes-blueprint` and `demo/order-fulfillment-blueprint` are blueprint source trees (no JS sources of their own, hence `N` tests) — they are demo inputs, not workspace members.

## 1_findings

### Wave 1 — packages/runtime

- **id:** F001
  - **package(s):** @rntme/bindings-http, @rntme/bindings-grpc, @rntme/runtime
  - **kind:** architectural
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 4
  - **evidence_paths:**
    - packages/runtime/bindings-http/src/operation-contract.ts
    - packages/runtime/bindings-http/package.json (exports `./operation-contract`)
    - packages/runtime/bindings-grpc/src/server/handler.ts (line 3)
    - packages/runtime/bindings-grpc/src/server/errors.ts (line 2)
    - packages/runtime/bindings-grpc/src/types.ts (line 2)
    - packages/runtime/runtime/src/plugins/http-surface.ts (line 16)
    - packages/runtime/runtime/src/plugins/grpc-surface.ts (line 6)
    - packages/runtime/runtime/src/plugins/executors/graph-operation-executor.ts (line 11)
    - packages/runtime/runtime/src/plugins/executors/native-operation-executor.ts (line 6)
    - packages/runtime/runtime/src/start/runtime-config.ts (line 5)
    - packages/runtime/runtime/src/start/build-grpc-surface.ts (line 2)
  - **summary:** The `OperationExecutor` interface is the canonical seam consumed by every runtime surface (HTTP, gRPC, runtime executors, runtime config). It lives inside `@rntme/bindings-http` and is reached via the deep export `@rntme/bindings-http/operation-contract`. As a consequence `bindings-grpc` declares a workspace dep on `bindings-http` just to import a 21-line type file, and gRPC-only stacks must ship the entire Hono HTTP runtime.
  - **proposed_fix:** Promote the operation contract into a tiny new package (or move it under `packages/contracts/runtime-operation/v1`) and have `bindings-http`, `bindings-grpc`, and `runtime` depend on that. Remove the `bindings-http -> bindings-grpc` dep edge after the move.

- **id:** F002
  - **package(s):** @rntme/runtime, @rntme/bpmn-worker
  - **kind:** architectural
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 6
  - **evidence_paths:**
    - packages/runtime/runtime/src/plugins/interfaces.ts (lines 37-40 Surface)
    - packages/runtime/runtime/src/plugins/grpc-surface.ts (lines 23-25 — `mount` is `/* no-op */`)
    - packages/runtime/runtime/src/start/start-service.ts (lines 147-194 — HttpSurface goes through the surfaces loop; GrpcSurface is bolted on outside it via `buildGrpcSurface` + manual listen)
    - packages/runtime/runtime/src/plugins/contract-tests.ts (lines 112-119 — `runGrpcSurfaceContract` asserts `mount` is a no-op)
    - packages/runtime/runtime/src/start/build-grpc-surface.ts (whole file — separate bolt-on factory)
  - **summary:** The `Surface` interface promises `mount(app, ctx)` is the lifecycle entry, but `GrpcSurface.mount` is an empty stub; the contract test even certifies that. gRPC is instead spun up via a parallel `buildGrpcSurface` factory after the Hono `serve()` call, so the abstraction does not actually unify HTTP and gRPC.
  - **proposed_fix:** Either split `Surface` into `HttpMount` (Hono-only) and `Listener` (own port + listen/stop) so each protocol implements only what it needs, or fold gRPC startup back into start-service as an explicit step and delete `GrpcSurface implements Surface`. The current half-strategy adds noise without providing extensibility.

- **id:** F003
  - **package(s):** @rntme/bindings-grpc, @rntme/bpmn-worker
  - **kind:** duplication
  - **severity:** P1
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 3
  - **evidence_paths:**
    - packages/runtime/bindings-grpc/src/emit/ids.ts (lines 1-27 — `sanitizeToProtoIdent`, `camelToPascal`, `toSnakeCase`, `bindingIdToRpcName`)
    - packages/runtime/bpmn-worker/src/command-client.ts (lines 184-204 — same four functions, verbatim)
    - packages/runtime/bindings-grpc/src/server/handler.ts (lines 89-116 — `jsonToStruct` / `jsonToValue` encoder)
    - packages/runtime/bpmn-worker/src/command-client.ts (lines 160-182 — `structToJson` / `protoValueToJson` decoder — inverse of the above)
    - packages/runtime/bindings-grpc/src/server/create-server.ts (lines 8-29 — `buildServiceDefinition` from protobufjs methods)
    - packages/runtime/bpmn-worker/src/command-client.ts (lines 96-114 — `toServiceDefinition`, same protobufjs method-walk pattern)
  - **summary:** bpmn-worker has copied the proto-identifier helpers, the JSON↔google.protobuf.Struct codec, and the protobufjs ServiceDefinition builder from bindings-grpc. Three independent reimplementations of the same gRPC-glue code (also see grpc-adapter-client for a third client variant) for what is effectively one "talk Struct over grpc-js" capability.
  - **proposed_fix:** Extract a `@rntme/grpc-codec` (or fold into a future `@rntme/runtime-grpc`) housing `sanitizeToProtoIdent` / `toSnakeCase` / `bindingIdToRpcName`, `jsonToStruct` / `structToJson`, and `buildServiceDefinition(root, service)`. Replace the three call sites.

- **id:** F004
  - **package(s):** @rntme/bpmn-worker
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 3
  - **evidence_paths:**
    - packages/runtime/bpmn-worker/src/worker.ts (lines 20-121 — `runWorkflowEventOnce`, Kafka-driven path: starts process, then loop fetchAndLock → dispatch native/grpc → completeTask/failTask)
    - packages/runtime/bpmn-worker/src/poll-loop.ts (lines 21-60 — `runPollOnce`, Operaton-poll path: fetchAndLock → dispatch native → completeTask/failTask)
    - packages/runtime/bpmn-worker/src/bin/poll.ts (uses runPollLoop; can never reach the grpc/service-task branch)
    - packages/runtime/bpmn-worker/src/bin/worker.ts (uses runWorkflowEventOnce via run.ts; has both branches)
  - **summary:** Two task-dispatch loops sit side by side. `runWorkflowEventOnce` includes the full native/grpc/service-task branching; `runPollOnce` is a strict subset that only handles native tasks and emits `WORKFLOW_TASK_HANDLER_MISSING` for everything else. The shared portions (mapping evaluation, lock/complete/fail wiring, error message conventions) are encoded twice with subtle drift.
  - **proposed_fix:** Collapse to a single `dispatchTask(task, ctx)` helper invoked by both entry points; let the entry point decide whether to start a process first and whether grpc service-task dispatch is enabled. Drop the duplicate inline branches.

- **id:** F005
  - **package(s):** @rntme/bindings-http, @rntme/runtime
  - **kind:** architectural
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/runtime/bindings-http/src/middleware/index.ts (whole file — exports requestId, requestLogger, errorHandler, cors, bodyLimit, rateLimit, securityHeaders, sameOriginOnly)
    - packages/runtime/bindings-http/src/middleware/*.ts (eight generic Hono middleware modules)
    - packages/runtime/runtime/src/plugins/http-surface.ts (lines 3-15 — imports them all from `@rntme/bindings-http`)
    - docs/current/owners/packages/runtime/bindings-http.md (calls them "generic HTTP middleware ... the canonical home")
  - **summary:** `@rntme/bindings-http` is documented and named as the Hono router for `ValidatedBindings`, but it also hosts every generic Hono middleware (rate-limit, CORS, security headers, request-id, etc.) that `runtime`'s `HttpSurface` mounts before the bindings router. Together with F001 this makes `bindings-http` a de-facto "runtime HTTP" package that any HTTP consumer must pull in, even when they neither parse nor serve binding artifacts.
  - **proposed_fix:** Move the eight middleware modules and `InMemoryRateLimiter` to `@rntme/runtime` (or a new `@rntme/runtime-http`) since their only consumer is `HttpSurface`. Keep `bindings-http` focused on the `createBindingsRouter` + operation-handler that actually depend on `ValidatedBindings`.

- **id:** F006
  - **package(s):** @rntme/runtime, @rntme/artifacts/blueprint
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/runtime/runtime/src/load/load-service.ts (lines 51-118 — SCALAR_PRIMITIVES, asScalarPrimitive, parseInputType, parseOutputType, toGraphSignature)
    - packages/artifacts/blueprint/src/compose/binding-resolvers.ts (lines 79-128 — parseInputType, parseFieldType, parseOutputType, toGraphSignature)
  - **summary:** Both packages reparse the `bindings.json` graph signature input/output strings (`scalar`, `list<scalar>`, `row<Shape>`, `rowset<Shape>`) with hand-rolled regex. The blueprint version supports `array<scalar>` for fields, the runtime version supports `list<scalar>` for inputs — the schemas have already drifted between the two parsers.
  - **proposed_fix:** Move `parseInputType` / `parseOutputType` / `parseFieldType` into `@rntme/bindings` (or `@rntme/artifact-shared`) as the canonical type-string parser, return a typed `Result`. Delete both copies. (Cross-wave: blueprint side belongs to Wave 2 — flag there.)

- **id:** F007
  - **package(s):** @rntme/runtime
  - **kind:** suboptimal
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 3
  - **evidence_paths:**
    - packages/runtime/runtime/src/start/runtime-config.ts (354 lines, lines 27-43 — 15 hand-curated error codes; lines 103-354 — imperative duck-typing validators per field)
    - packages/runtime/runtime/src/manifest/schema.ts (line 1 — same package already uses zod for manifest validation)
  - **summary:** `runtime-config.ts` validates `RuntimeConfig` with 350+ lines of imperative `hasFunction(...)` duck-typing, a hand-grown error union, and per-field validator functions. The same package already uses zod (with strict schemas) for the manifest. Net effect: two validation idioms in one package, with the heavier one applied to the simpler input.
  - **proposed_fix:** Re-express `RuntimeConfig` as a zod schema (using `z.custom()` for the `DbDriver` / `EventBus` / `Surface` shape predicates), and let zod produce the error array. Eliminates ~250 LoC, kills the bespoke error-code union, and unifies the validation style.

- **id:** F008
  - **package(s):** @rntme/runtime
  - **kind:** dead_strut
  - **severity:** P3
  - **impact:** low
  - **confidence:** med
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/runtime/runtime/src/plugins/interfaces.ts (lines 11-18 — DbDriver, DbOpenOpts, DbHandle)
    - packages/runtime/runtime/src/plugins/bun-sqlite-driver.ts (whole file — 8 lines wrapping openSqliteDatabase)
    - packages/runtime/runtime/src/plugins/contract-tests.ts (lines 6-31 — runDbDriverContract)
    - packages/runtime/runtime/test/integration/plugin-contracts.test.ts (only call site of runDbDriverContract: the in-tree driver)
  - **summary:** `DbDriver` is a one-method interface with exactly one implementation (`BunSqliteDriver` — eight lines forwarding to `openSqliteDatabase`). The owner doc hints at `@rntme/db-turso` as a second impl, but Turso is SQLite-compatible and would target `@rntme/sqlite` directly; the strategy seam carries no payload. `runDbDriverContract` is only ever run against the one driver it abstracts.
  - **proposed_fix:** Inline `BunSqliteDriver` into `start-service.ts` (or delete it and call `openSqliteDatabase` directly), drop the `DbDriver` interface from `RuntimeConfig`, and either remove `runDbDriverContract` or repurpose it as an `@rntme/sqlite` self-test.

- **id:** F009
  - **package(s):** @rntme/runtime, @rntme/projection-consumer
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/runtime/projection-consumer/src/kafka/in-memory.ts (lines 25-73 — createInMemoryKafkaConsumer: queue + poll loop + topic-filtering of single topic)
    - packages/runtime/runtime/src/plugins/in-memory-bus.ts (lines 16-105 — InMemoryBus: queue + topicPatternMatches + createTopicConsumer poll loop, decodes via fromCloudEventWire only to immediately re-publish the same envelope)
  - **summary:** Two implementations of an in-memory Kafka adapter. Both back the `KafkaConsumer` async-iterator contract and both do their own poll/cursor bookkeeping; `InMemoryBus` additionally round-trips every produced message through `toCloudEventWire` → `fromCloudEventWire` even though the message never leaves the process. The duplication makes the consumer-contract "what counts as a partition?" question diverge across the two adapters (in-memory.ts: always partition 0; in-memory-bus.ts: stable cursor across consumers).
  - **proposed_fix:** Have `InMemoryBus` build on `createInMemoryKafkaConsumer` (one consumer per `bus.consumer(...)` call, the bus owns the shared message buffer and routes by topic pattern). Drop the CE wire round-trip for in-process delivery.

- **id:** F010
  - **package(s):** @rntme/bpmn-worker, @rntme/runtime
  - **kind:** duplication
  - **severity:** P3
  - **impact:** low
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/runtime/bpmn-worker/src/env.ts (whole file — RNTME_EVENT_BUS_* parser; bare plaintext/sasl_ssl, no SCRAM mechanism, no connection-timeout knob)
    - packages/runtime/runtime/src/start/runtime-env.ts (lines 76-148 — full RNTME_EVENT_BUS_* parser with SCRAM mechanism, SASL credentials, connection-timeout validation, topic-prefix)
    - packages/runtime/bpmn-worker/src/kafka-consumer.ts (lines 27-78 — bpmn-worker rolls its own kafkajs consumer instead of reusing runtime's KafkaJsEventBus)
  - **summary:** bpmn-worker and runtime each parse `RNTME_EVENT_BUS_BROKERS` / `_PROTOCOL` / `_TOPIC_PREFIX` independently; the bpmn-worker version is a strict subset and will silently fail in production when the operator sets `sasl_ssl` (it returns `plaintext`-equivalent config). bpmn-worker also instantiates its own kafkajs client rather than reusing `KafkaJsEventBus`.
  - **proposed_fix:** Extract a shared `runtime-event-bus-env` helper (or move bpmn-worker onto the runtime KafkaJsEventBus + `buildKafkaJsClientConfigFromEnv`). Keeping two parsers in lockstep is fragile and one is already silently incomplete.

### Wave 2 — packages/artifacts

- **id:** F011
  - **package(s):** @rntme/bindings, @rntme/blueprint, @rntme/runtime
  - **kind:** duplication
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 3
  - **evidence_paths:**
    - packages/artifacts/bindings/src/types/resolvers.ts (lines 3-52 — SCALAR_PRIMITIVES, isScalarPrimitive, FieldType, InputType, OutputType, GraphSignature)
    - packages/artifacts/blueprint/src/compose/binding-resolvers.ts (lines 75-102 — parseScalar, parseInputType, parseFieldType, parseOutputType)
    - packages/runtime/runtime/src/load/load-service.ts (lines 51-118 — SCALAR_PRIMITIVES, asScalarPrimitive, parseInputType, parseOutputType, toGraphSignature)
  - **summary:** Wave-2 confirmation of F006: `bindings` already owns the canonical scalar/input/field/output type catalogue (with `isScalarPrimitive`), yet both `blueprint/compose/binding-resolvers.ts` and `runtime/load/load-service.ts` reparse `scalar | list<T> | row<Shape> | array<T>` strings with their own hand-rolled regex. The two reimplementations have already drifted: blueprint accepts `array<scalar>` for fields; runtime accepts `list<scalar>` for inputs but throws on unknown shapes; blueprint returns nullable instead.
  - **proposed_fix:** Promote `parseInputType` / `parseFieldType` / `parseOutputType` / `toGraphSignature` into `@rntme/bindings` next to `isScalarPrimitive`. Have `blueprint` and `runtime` import them. Pairs with F006.

- **id:** F012
  - **package(s):** @rntme/graph-ir-compiler, @rntme/seed, @rntme/event-store
  - **kind:** architectural
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 4
  - **evidence_paths:**
    - .dependency-cruiser.cjs (lines around `artifacts-must-not-import-runtime` — explicitly forbids `^packages/artifacts/` → `^packages/runtime/`)
    - packages/artifacts/graph-ir-compiler/src/types/operation.ts (lines 1-2 — imports `SqliteDatabase`, `ActorRef`, `EventStore` from runtime packages)
    - packages/artifacts/graph-ir-compiler/src/command-runtime/replay.ts (line 1 — `EventEnvelope`)
    - packages/artifacts/graph-ir-compiler/src/operation/execute.ts (line 1 — `AppendEventInput`)
    - packages/artifacts/graph-ir-compiler/src/execute/execute.ts, operation/local-read.ts (SqliteDatabase, SqliteParams)
    - packages/artifacts/seed/src/{types,validate,wrap-payloads,apply}.ts (`EventEnvelope`, `EventStore`, `ConcurrencyConflict`, `SqliteEventStore`)
  - **summary:** Both `graph-ir-compiler` and `seed` import directly from `@rntme/event-store` and `@rntme/sqlite`, which the dependency-cruiser rule `artifacts-must-not-import-runtime` explicitly forbids. The rule does not exempt event-store/sqlite, so either the rule is being silently bypassed or the build is misconfigured. Effectively, the entire `command-runtime/` + `operation/execute.ts` + `seed/apply.ts` directories belong in runtime, not in artifacts.
  - **proposed_fix:** Move `graph-ir-compiler/src/{command-runtime,operation/execute,execute,operation/local-read}` and `seed/{apply,bin/cli}` to a new `@rntme/runtime-graph` or fold into `@rntme/runtime`. Keep the compile-side (parse/validate/normalize/semantic-plan/relational/lower/emit-plan) artifact-pure. Or, if the canonical event/sqlite shapes should be artifact-visible, hoist them into `packages/contracts/` (Turso-target memory says SQL stays SQLite forever, so a contract is fine).

- **id:** F013
  - **package(s):** @rntme/blueprint, @rntme/graph-ir-compiler
  - **kind:** duplication
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 5
  - **evidence_paths:**
    - packages/artifacts/blueprint/src/compose/service-graphs.ts (lines 12-65 — `INPUT_MODES`, `isInputMode`, `isValidShapes`, `isValidGraph`: 100+ lines of hand-rolled type predicates over `graphs/*.json`)
    - packages/artifacts/blueprint/src/compose/binding-resolvers.ts (lines 75-158 — second pass of parsing the same authoring spec into `GraphSignature`)
    - packages/artifacts/graph-ir-compiler/src/parse/schema.ts (lines 1-374 — `AuthoringSpecSchema` zod schema covering exactly this shape)
    - packages/artifacts/graph-ir-compiler/src/parse/parse.ts (`parseAuthoringSpec`)
  - **summary:** Blueprint's `readServiceGraphSpec` validates per-graph JSON with hand-rolled `isRecord` / `isValidGraph` predicates that throw bare strings, then `createServiceBindingResolvers` re-parses the same fields again to compute the `GraphSignature`. Meanwhile `@rntme/graph-ir-compiler` already exports `parseAuthoringSpec` + `AuthoringSpecSchema` (zod) that produces a fully-typed `AuthoringSpecOutput` from the same input. Two parsers for one IR.
  - **proposed_fix:** Have `service-graphs.ts` read each `graphs/*.json` and call `parseAuthoringSpec`; drop `isValidGraph` / `isInputMode` / `isValidShapes`. Derive the `GraphSignature` from the canonical parsed shape (or expose a `toGraphSignature` helper from graph-ir-compiler) instead of re-walking JSON. Matches the board constraint "graph-ir-compiler vs blueprint compilation overlap".

- **id:** F014
  - **package(s):** @rntme/graph-ir-compiler, @rntme/bindings-http
  - **kind:** architectural
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/runtime/bindings-http/src/operation-contract.ts (entire 21-line file — depends on `OperationExecutionContext`, `OperationResult` from `@rntme/graph-ir-compiler`)
    - packages/artifacts/graph-ir-compiler/src/types/operation.ts (lines 49-79 — owns `CompiledOperation`, `OperationExecutionContext`, `OperationResult`)
    - packages/artifacts/graph-ir-compiler/src/operation/execute.ts (line 23 — `executeOperation` already operates on these types)
    - packages/runtime/runtime/src/plugins/executors/graph-operation-executor.ts (lines 2-3 — wraps `executeOperation` to satisfy `OperationExecutor`)
  - **summary:** Cross-wave confirmation of F001: the `OperationExecutor` interface lives in `bindings-http` but every type it touches (`OperationExecutionContext`, `OperationResult`, `CompiledOperation`) is owned by `graph-ir-compiler`, and the canonical implementation `executeOperation` is also in `graph-ir-compiler`. Putting the seam in `bindings-http` forces gRPC consumers to depend on the HTTP package (see F001/F003).
  - **proposed_fix:** Promote `OperationExecutor` (+ Input/Output/Error types) into `@rntme/graph-ir-compiler/operation` next to `executeOperation`. Re-export from there; remove the `@rntme/bindings-http/operation-contract` deep export. Resolves F001 from the graph-ir-compiler side.

- **id:** F015
  - **package(s):** @rntme/seed, @rntme/graph-ir-compiler
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 3
  - **evidence_paths:**
    - packages/artifacts/seed/src/wrap-payloads.ts (lines 17-43 — builds `{before, after}` event envelope from flat seed `data` using `affects`, `stateField`, `isCreation`)
    - packages/artifacts/graph-ir-compiler/src/emit/payload.ts (lines 44-64 — `derivePayload` builds `{before, after}` from `EmitPlan.affects` + `toState` + `isCreation`)
    - packages/artifacts/seed/src/validate.ts (lines 194-248 — `simulateStateMachines`: per-subject state replay + transition legality check)
    - packages/artifacts/graph-ir-compiler/src/command-runtime/{replay,transition}.ts (lines 8-22 and 4-35 — same replay + `checkTransitionLegal` for runtime)
  - **summary:** Seed and graph-ir-compiler each maintain their own copy of two intertwined operations: (a) replaying per-subject state forward and checking that an event's `from`-state matches the current state, and (b) shaping `{before, after}` envelope payloads from a flat field map + state-machine spec. Drift risk is real because seed treats `null`/missing fields differently from `derivePayload`.
  - **proposed_fix:** Extract canonical helpers — `replayState`, `checkTransition`, `buildBeforeAfterPayload` — to a single owner (most naturally `graph-ir-compiler/command-runtime`, alongside F012's move). Have seed import them. Removes one source of seed-vs-runtime divergence.

- **id:** F016
  - **package(s):** @rntme/blueprint
  - **kind:** architectural
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/artifacts/blueprint/src/load/materialize.ts (line 5 — `import type { CanonicalBundle } from '@rntme/platform-core'`)
    - packages/artifacts/blueprint/src/load/materialize-and-compose.ts (line 2 — same)
    - packages/artifacts/blueprint/src/index.ts (line 33 — re-exports `CanonicalBundle` from `@rntme/platform-core`)
    - .dependency-cruiser.cjs (`artifacts-must-not-import-runtime`; platform→artifacts is the natural direction)
  - **summary:** `@rntme/blueprint` (an artifact package) imports `CanonicalBundle` from `@rntme/platform-core` (a platform package) and re-exports it. Layering goes the wrong way: platform-core consumes artifacts to assemble bundles, not vice versa. The re-export hides the inversion from downstream consumers but the dependency edge is still there.
  - **proposed_fix:** Move `CanonicalBundle`'s definition into `@rntme/blueprint` (it describes a materialized blueprint, which is the blueprint package's vocabulary) or into a `packages/contracts/blueprint-bundle` contract. Have `@rntme/platform-core` import it. Removes the blueprint→platform-core edge.

- **id:** F017
  - **package(s):** @rntme/graph-ir-compiler
  - **kind:** dead_strut
  - **severity:** P3
  - **impact:** low
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 1
  - **evidence_paths:**
    - packages/artifacts/graph-ir-compiler/src/index.ts (lines 64-129 — `CompileOptions = { target?: 'sqlite' }` declared; `_options` argument leading-underscored and ignored in `compile()`; `options?` threaded but never read in `run()` or `lowerToSqlite`)
    - docs/current/owners/packages/artifacts/graph-ir-compiler.md (likely names sqlite as the only target; Turso-target memory: SQL stays SQLite-dialect forever)
  - **summary:** `CompileOptions { target?: 'sqlite' }` is a single-value option with the only value being the default. The `compile()` argument is named `_options` (leading-underscore convention for "unused"). Per repo direction (Turso = SQLite-compatible Rust rewrite, no Postgres target planned), no second target will ever be added.
  - **proposed_fix:** Remove `CompileOptions`, `_options`, `options?` arguments from `compile` / `run`. Inline the single sqlite emit path. Repurpose to future `EmitOptions` only if/when an actual non-sqlite emitter lands.

- **id:** F018
  - **package(s):** @rntme/artifact-shared, @rntme/bindings, @rntme/init, @rntme/workflows
  - **kind:** suboptimal
  - **severity:** P3
  - **impact:** low
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/artifacts/bindings/src/parse/parse.ts (entire 29-line file)
    - packages/artifacts/init/src/parse/parse.ts (entire 28-line file)
    - packages/artifacts/workflows/src/parse/parse.ts (entire 29-line file)
    - packages/artifacts/_shared/src/parse.ts (`parseWithSchema` already encapsulates the JSON.parse → zod → fromIssue triangle)
  - **summary:** `parseBindingArtifact`, `parseInitArtifact`, `parseWorkflowArtifact` are byte-for-byte the same template — only the schema constant and the `ERROR_CODES.X_PARSE_SCHEMA_VIOLATION` key differ. The current `parseWithSchema` helper still requires every caller to repeat the same `{ fromJson, fromIssue }` shape with identical bodies.
  - **proposed_fix:** Add a thin `parseUniformSchema(input, schema, { layer, code })` to `@rntme/artifact-shared` that constructs the `fromJson`/`fromIssue` builders internally for the dominant case (uniform layer+code). Keep the lower-level `parseWithSchema` for seed's `[N]`-formatting variant. Saves ~60 LoC and removes a copy-pasted template.

- **id:** F019
  - **package(s):** @rntme/pdm, @rntme/qsm
  - **kind:** suboptimal
  - **severity:** P3
  - **impact:** low
  - **confidence:** med
  - **reversibility:** high
  - **est_effort_h:** 1
  - **evidence_paths:**
    - packages/artifacts/pdm/src/load/load-dir.ts (lines 26-32 — flattens every I/O kind into one `PDM_PARSE_DIR_INVALID` code)
    - packages/artifacts/qsm/src/load/load-dir.ts (lines 14-61 — qsm has 7 distinct codes covering the same `LoadArtifactDirFailureKind` enum)
    - packages/artifacts/_shared/src/load.ts (lines 7-13 — defines six failure kinds: `index-missing`, `leaf-dir-missing`, `index-json-invalid`, `index-schema-invalid`, `leaf-json-invalid`, `read-failed`)
  - **summary:** `_shared/load.ts` exposes a tagged `LoadArtifactDirFailureKind` enum, but `pdm` collapses all six kinds into a single `PDM_PARSE_DIR_INVALID` error code while `qsm` switches on the kind and maps to seven distinct codes. The signal/observability of pdm-dir failures is strictly worse than qsm without any visible reason for the asymmetry.
  - **proposed_fix:** Mirror qsm's `switch` mapping in pdm (split into `PDM_PARSE_DIR_INDEX_MISSING`, `PDM_PARSE_DIR_ENTITIES_MISSING`, `PDM_PARSE_DIR_INDEX_JSON_INVALID`, etc.). Or, more cleanly, have `_shared` provide a default mapper keyed on package prefix so both loaders share one builder.

### Wave 3 — packages/contracts

- **id:** F020
  - **package(s):** @rntme/contracts-client-runtime-v1
  - **kind:** architectural
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 4
  - **evidence_paths:**
    - packages/contracts/client-runtime/v1/src/operation-registry.ts (49 lines — `createOperationRegistry` runtime factory with `Map<>` state)
    - packages/contracts/client-runtime/v1/src/lifecycle-bus.ts (34 lines — `createLifecycleBus` runtime factory)
    - packages/contracts/client-runtime/v1/src/transport-chain.ts (25 lines — `createTransportChain` middleware composer)
    - packages/contracts/client-runtime/v1/src/hooks.ts (63 lines — React Context + `useTransport`/`useStateStore`/`useOperationRegistry`/`useOperation`/`useModuleAction` hooks)
    - packages/contracts/client-runtime/v1/src/visibility.ts (38 lines — `evaluateVisible` with deepEq/contains helpers)
    - packages/contracts/client-runtime/v1/src/router.ts (38 lines — `matchRoute` / `expandTemplate` route matcher)
    - packages/contracts/client-runtime/v1/src/module-context.ts (`createModuleBootContext` wires Store+Bus+Chain+Registry into a boot context)
    - packages/contracts/client-runtime/v1/package.json (lines 30-34 — `dependencies: @json-render/core`; `peerDependencies: react ^19`)
  - **summary:** `@rntme/contracts-client-runtime-v1` is not a contract package — it is a small client-side runtime mini-framework: React Context + hooks, a route matcher, a middleware composer, an in-memory registry, a visibility evaluator, and a lifecycle event bus. It ships factory functions (not just types) and depends on `react` + `@json-render/core`. A real schema-only contract should not carry runtime code or framework dependencies; that's why every vendor module pulls in React just to declare types.
  - **proposed_fix:** Split into two packages: (a) `@rntme/contracts-client-runtime-v1` keeps ONLY the types (`ModuleBootContext`, `OperationRegistry`, `LifecycleBus`, `LifecycleEvents`, `TransportChain`, `TransportMiddleware`, `RouteMatch`, `Visible`, `OperationHandler`, `Unregister`) with no `react`/`@json-render/core` dependency; (b) `@rntme/client-runtime` (or fold into `@rntme/ui-runtime`) owns the factories, hooks, providers, and route/visibility helpers. Vendor modules that only need types lose the React peer dep.

- **id:** F021
  - **package(s):** @rntme/contracts-provisioner-v1, @rntme/artifact-shared, @rntme/deploy-core
  - **kind:** duplication
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/contracts/provisioner/v1/src/result.ts (lines 1-8 — `Ok`/`Err`/`Result` definition; comment "Mirrors @rntme/deploy-core's Result")
    - packages/deploy/deploy-core/src/result.ts (lines 3-10 — identical `Ok`/`Err`/`Result` plus `ok`/`err`/`isOk`/`isErr` helpers)
    - packages/artifacts/_shared/src/result.ts (lines 1-8 — identical `Ok`/`Err`/`Result` plus helpers)
  - **summary:** Three packages each re-declare `Result<T, E> = Ok<T> | Err<E>` with the same `{ ok, value }` / `{ ok, errors[] }` shape. The provisioner contract's `result.ts` even includes a comment acknowledging the mirror (and explaining the duplication: "this leaf package owns only the type so it stays dependency-free"). Practical effect: vendor provisioners return a `Result` that is structurally identical but nominally distinct from `deploy-core`'s, so downstream code casts between them.
  - **proposed_fix:** Promote `Result`/`Ok`/`Err` (type only) into a single tiny `@rntme/result` or into `packages/contracts/_common/v1` as `commonV1.Result`. `deploy-core` and `artifact-shared` keep the `ok`/`err`/`isOk`/`isErr` helpers and re-export the type. Drop the standalone copy in `contracts/provisioner/v1/src/result.ts`. Same cardinal duplication problem as F003/F011 but for the universal `Result` algebra.

- **id:** F022
  - **package(s):** @rntme/contracts-module-v1, @rntme/contracts-marketing-site-v1
  - **kind:** suboptimal
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 1
  - **evidence_paths:**
    - packages/contracts/module/v1/package.json (line 32 — `"zod": "^3.24.2"`)
    - packages/contracts/marketing-site/v1/package.json (line ~30 — `"zod": "^4.0.0"`)
    - packages/contracts/module/v1/src/manifest-shape.ts (uses `z.ZodIssueCode.custom`, `superRefine`)
    - packages/contracts/marketing-site/v1/src/schema.ts (uses `MarketingSiteV1ConfigSchema = z.object(...)`)
  - **summary:** Two contract packages declare different major zod versions in the same workspace: `contracts-module-v1` uses zod `^3.24.2`, `contracts-marketing-site-v1` uses zod `^4.0.0`. Zod 3→4 has API differences (issue code enums, refinement APIs). Anything that imports both packages — and there are downstream packages that resolve manifests AND validate marketing-site configs — risks resolving two zod copies with incompatible types.
  - **proposed_fix:** Pin a single zod version (workspace catalog or peer-dep + root-level pin). Choose zod 3 if module/v1 has the larger surface area (it does — 402 lines of refinements vs 64 in marketing-site), and back-port marketing-site to match. Re-run typecheck across consumers.

- **id:** F023
  - **package(s):** @rntme/contracts-ai-llm-v1, @rntme/contracts-storage-v1, @rntme/contracts-identity-v1, @rntme/contracts-crm-v1, @rntme/contracts-marketing-site-v1
  - **kind:** suboptimal
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 3
  - **evidence_paths:**
    - packages/contracts/ai-llm/v1/src/error-codes.ts (lines 3-30 — exports `errorCodes`, `ErrorLayer`, `ErrorCode`, `isErrorCode`, `layerOf`; layers = structural/references/consistency/vendor)
    - packages/contracts/storage/v1/src/error-codes.ts (lines 3-40 — exports `errorCodes`, `ErrorLayer`, `ErrorCode`, `isErrorCode`, `layerOf`; layers = structural/references/consistency/auth/vendor/provisioner)
    - packages/contracts/identity/v1/src/error-codes.ts (lines 3-21 — exports `errorCodes`, `IdentityErrorLayer`, `IdentityErrorCode`, `allErrorCodes`; NO `isErrorCode`/`layerOf`; layers = structural/references/consistency/vendor)
    - packages/contracts/crm/v1/src/error-codes.ts (lines 3-19 — same shape as identity: `CrmErrorLayer`/`CrmErrorCode`/`allErrorCodes`, no `is`/`layerOf`)
    - packages/contracts/marketing-site/v1/src/error-codes.ts (lines 3-12 — `MarketingSiteErrorCodes` with layers = validate/provision; only `allErrorCodes`)
  - **summary:** Five canonical contracts each ship their own `error-codes.ts` with three divergent shapes: (a) ai-llm + storage expose `ErrorCode`/`ErrorLayer`/`isErrorCode`/`layerOf` (helpers); (b) identity + crm use prefixed names (`IdentityErrorCode`, `CrmErrorLayer`) with `allErrorCodes` and **no helpers**; (c) marketing-site uses an entirely different layer taxonomy (`validate`/`provision` instead of `structural`/`references`/`consistency`/`vendor`). Storage adds a 6th layer (`provisioner`). The `errorCodes.json` schema is the only common ground; everything else has drifted, and `isErrorCode`/`layerOf` only exist where the author bothered to write them.
  - **proposed_fix:** Define a single `buildErrorCodesApi(layers)` factory in `@rntme/contracts-common-v1` that, given a `Record<layer, readonly string[]>`, returns `{ errorCodes, allErrorCodes, ErrorCode, ErrorLayer, isErrorCode, layerOf }`. Each contract's `error-codes.ts` becomes a 5-line wrapper. Standardize the layer taxonomy across canonical contracts (marketing-site adopts the same four/six layers as the rest). Eliminates 5x copy-paste of the same JSON-loader pattern and forces parity.

- **id:** F024
  - **package(s):** @rntme/contracts-ai-llm-v1, @rntme/contracts-storage-v1, @rntme/contracts-identity-v1, @rntme/contracts-crm-v1
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/contracts/ai-llm/v1/scripts/gen.mjs (54 lines)
    - packages/contracts/identity/v1/scripts/gen.mjs (54 lines)
    - packages/contracts/storage/v1/scripts/gen.mjs (54 lines)
    - packages/contracts/crm/v1/scripts/gen.mjs (65 lines)
    - packages/contracts/_common/v1/scripts/gen.mjs (sibling pattern)
    - (diff ai-llm/scripts/gen.mjs vs storage/scripts/gen.mjs: only 3 lines — entry proto filename, namespace dir, file symlink)
  - **summary:** Five `scripts/gen.mjs` proto-generation scripts (ai-llm, storage, identity, crm, _common) are near-byte-identical. The diff between ai-llm and storage is exactly the protoEntry, the protoDeps namespace path, and one symlink target. Each script builds an isolated `proto-deps/` tree of symlinks into `_common/proto/`, runs pbjs/pbts, then post-processes ESM imports. Any improvement (e.g. switching from protobufjs to protoc-gen-es, adding deterministic output) must be applied 5x.
  - **proposed_fix:** Extract a shared script `packages/contracts/_shared/build-proto.mjs` (or scripts/) that takes `{ entry, namespaceDir, depsSymlinks }` as input. Each contract package's `scripts/gen.mjs` becomes a 5-line invocation. Same shape as F018 ("uniform parse" template).

- **id:** F025
  - **package(s):** @rntme/contracts-analytics-v1
  - **kind:** dead_strut
  - **severity:** P3
  - **impact:** low
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 1
  - **evidence_paths:**
    - packages/contracts/analytics/v1/src/index.ts (entire 3-line file: `analyticsV1Operations = ['track', 'identify']`)
    - packages/contracts/analytics/v1/test/exports.test.ts (only consumer — its own test)
    - (no `import.*contracts-analytics-v1` anywhere in apps/, modules/, packages/ source — only `modules/analytics/google-analytics` exists as a vendor module but does not import the contract)
  - **summary:** `@rntme/contracts-analytics-v1` exports a 2-element string-literal array and a `(typeof)[number]` type — three lines total. No vendor module, runtime package, or platform code imports it; the only consumer is its own `exports.test.ts`. Meanwhile `modules/analytics/google-analytics` exists as a workspace package without consuming this contract. This is either a placeholder for unfinished work or a stub left after a refactor.
  - **proposed_fix:** Either delete the package and inline the operation list where it is needed when analytics actually has consumers, or wire `modules/analytics/google-analytics` to import `analyticsV1Operations`. If the contract is forward-looking, mark it `private: true` (already is) and add a clear status note in README; otherwise remove.

- **id:** F026
  - **package(s):** @rntme/contracts-handlers-v1
  - **kind:** dead_strut
  - **severity:** P3
  - **impact:** low
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 0
  - **evidence_paths:**
    - packages/contracts/handlers/v1/package.json (line 34 — `"@rntme/bindings-http": "workspace:*"` in devDependencies)
    - packages/contracts/handlers/v1/src/ (handlers.ts + index.ts — no bindings-http import)
    - packages/contracts/handlers/v1/test/unit/contract-shape.test.ts (no bindings-http import)
  - **summary:** `@rntme/contracts-handlers-v1` declares `@rntme/bindings-http: workspace:*` as a devDependency but the package's source and tests never import from `bindings-http`. The devDep adds the entire HTTP runtime to the contract's install graph for no reason.
  - **proposed_fix:** Remove the `@rntme/bindings-http` devDependency from `packages/contracts/handlers/v1/package.json`. (Suspected leftover from a deleted compat test — pairs naturally with F001/F014 if `OperationExecutor` moves out of bindings-http into a contract.)

- **id:** F027
  - **package(s):** @rntme/contracts-module-v1, @rntme/contracts-marketing-site-v1
  - **kind:** architectural
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 3
  - **evidence_paths:**
    - packages/contracts/module/v1/src/manifest-shape.ts (402 lines — zod schemas + 100-line `superRefine` performing duplicate-name checks, `appliesTo` cross-reference validation, asset-id uniqueness, preset-path uniqueness; exports `parseModuleManifest`)
    - packages/contracts/marketing-site/v1/src/index.ts (lines 34-55 — exports `validateMarketingSiteConfig` with issue-to-error-code mapping logic)
    - packages/contracts/marketing-site/v1/src/schema.ts (the actual schema)
    - packages/contracts/module/v1/src/index.ts (exports `parseModuleManifest`)
  - **summary:** Two contract packages (`module/v1`, `marketing-site/v1`) ship not just the schema but also a `parse*`/`validate*` function plus issue-mapping logic that walks zod issues and rewrites them into custom error-code unions. The 402-line `manifest-shape.ts` is mostly cross-field consistency checks — those are domain logic, not contract shape. By comparison, ai-llm/storage/identity/crm contracts are pure type/proto declarations. The asymmetry means consumers must use the contract's parser (which can drift) instead of running their own validation off the published schema.
  - **proposed_fix:** Split each into two files: (a) `src/schema.ts` — zod schemas only, no refinements that encode business rules; (b) `src/validate.ts` — refinement passes + parse helpers. Consider whether the validate layer belongs in the contract package at all or in a `module-validator` / `marketing-site-validator` artifact package. Establish a rule "contracts ship types + schemas; validators live in consuming packages."

- **id:** F028
  - **package(s):** @rntme/contracts-storage-v1
  - **kind:** suboptimal
  - **severity:** P3
  - **impact:** low
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 1
  - **evidence_paths:**
    - docs/goals/simplify-monorepo-audit/notes/audit-catalog.md (workspace map row — "Has owner doc? —" for `packages/contracts/storage/v1`)
    - (no file at `docs/current/owners/packages/contracts/storage/v1.md`)
    - docs/current/owners/packages/contracts/ai-llm/v1.md, crm/v1.md, identity/v1.md, marketing-site.md, module/v1.md, provisioner/v1.md, _common/v1.md, handlers/v1.md, client-runtime/v1.md, analytics/v1.md (all exist)
  - **summary:** Among the eleven `packages/contracts/**/v1` packages, only `@rntme/contracts-storage-v1` has no owner doc under `docs/current/owners/packages/contracts/storage/`. T001 already flagged this; T004 confirms by inspection. The repo's local READMEs are stubs that link to owner docs, so a missing owner doc means the contract is effectively unowned.
  - **proposed_fix:** Add `docs/current/owners/packages/contracts/storage/v1.md` mirroring `ai-llm/v1.md`'s template (purpose, surface, proto entry, error layers, current consumers, open questions). Repeat the same fix for the three missing owner docs flagged in T001 workspace-map notes (artifact-shared, conformance-marketing-site, marketing-site-static, conformance-storage) — but those are out-of-wave.

### Wave 4 — packages/platform + packages/deploy

- **id:** F029
  - **package(s):** @rntme/platform-core, @rntme/deploy-core, @rntme/artifact-shared, @rntme/contracts-provisioner-v1
  - **kind:** duplication
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/deploy/deploy-core/src/result.ts (lines 1-10 — `Ok`/`Err`/`Result`/`ok`/`err`/`isOk`/`isErr`)
    - packages/contracts/provisioner/v1/src/result.ts (lines 1-8 — type-only mirror with explicit "Mirrors @rntme/deploy-core's Result" comment)
    - packages/artifacts/_shared/src/result.ts (lines 1-8 — type + helpers)
    - packages/platform/platform-core/src/types/result.ts (re-exports its own `Result`/`Ok`/`Err`; `isOk` used across deploy-runner handlers)
    - packages/platform/platform-core/src/index.ts (line 1 — exports `isOk`, `ok`, `err`, `Result`)
  - **summary:** Wave 4 confirmation of F021: the `Result<T,E>` algebra is now defined in FOUR places — `artifact-shared`, `contracts-provisioner-v1`, `deploy-core`, AND `platform-core` — all with identical `{ ok, value }` / `{ ok: false, errors[] }` shapes. The `deploy-runner` handlers (`compose-handler.ts:2`, `apply-handler.ts:1`, `plan-handler.ts:1`, etc.) all `import { isOk } from '@rntme/platform-core'`, while `deploy-core` uses its own `isOk`; the two are structurally identical but nominally distinct, so cross-package values must be re-typed.
  - **proposed_fix:** Promote the type-only `Result`/`Ok`/`Err` to `packages/contracts/_common/v1` (or a tiny `@rntme/result`) and have all four packages import it. Keep `ok`/`err`/`isOk`/`isErr` helpers in one location (`artifact-shared` is natural). Extends F021 — adds the 4th location nobody flagged.

- **id:** F030
  - **package(s):** @rntme/platform-storage, @rntme/platform-core
  - **kind:** dead_strut
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/platform/platform-core/src/deploy-adapter/seam.ts (whole file — `DeployAdapter`, `DeployAdapterInput`, `DeployAdapterResult`, `DeployAdapterSuccess`, `DeployAdapterFailure`, `DeployAdapterLogLine`)
    - packages/platform/platform-core/src/deploy-adapter/fake.ts (whole file — `createFakeDeployAdapter`)
    - packages/platform/platform-core/src/index.ts (lines 59-66 — only re-export site)
    - (no consumer: `grep -r "DeployAdapter\|createFakeDeployAdapter"` outside the seam dir and index.ts returns zero hits)
  - **summary:** The "internal deploy-adapter seam" documented in `docs/current/owners/packages/platform/platform-core.md` lines 30-35 is exported but unused. No package in `packages/` or `apps/` imports `DeployAdapter`, `DeployAdapterInput`, `DeployAdapterResult`, or `createFakeDeployAdapter` outside the file that defines them and the barrel that re-exports them. The owner doc even acknowledges "temporary internal seam … while Dokploy execution still lives in existing deploy packages" — it was a forward-looking strategy interface that never landed because `@rntme/deploy-runner` took over the orchestration role.
  - **proposed_fix:** Delete `packages/platform/platform-core/src/deploy-adapter/` and the 6 export lines in `index.ts`. The actual seam is now `RunDeploymentInputs` in `@rntme/deploy-runner/src/types.ts`. Removes ~80 LoC of unused interface plus the misleading owner-doc paragraph.

- **id:** F031
  - **package(s):** @rntme/platform-storage, apps/platform/blueprint/services/deployments
  - **kind:** duplication
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 3
  - **evidence_paths:**
    - packages/platform/platform-storage/src/secret/aes-gcm-cipher.ts (lines 49-76 — canonical `encrypt`/`decrypt` using `createCipheriv`/`createDecipheriv` AES-256-GCM with 12-byte nonce + 16-byte auth tag)
    - apps/platform/blueprint/services/deployments/handlers/start-deployment.ts (lines 537-558 — `readRuntimeSecretKey` + `decryptRuntimeSecret` reimplements AES-256-GCM decrypt by hand using `createDecipheriv`)
    - apps/platform/blueprint/services/deployments/handlers/deploy-targets.ts (lines 29, 406-450 — `readRuntimeSecretKey` + custom `encryptRuntimeSecret` reimplements AES-256-GCM encrypt using `createCipheriv` + `randomBytes`)
    - packages/platform/platform-storage/src/secret/aes-gcm-cipher.ts (lines 79-88 — `parseKey` validates `/^[0-9a-fA-F]{64}$/`)
    - apps/platform/blueprint/services/deployments/handlers/start-deployment.ts (lines 540-548) and deploy-targets.ts (lines 409-425 — re-implement the same `/^[0-9a-fA-F]{64}$/` validation, with different error codes: `DEPLOY_TARGET_SECRET_STORAGE_UNAVAILABLE` vs `PLATFORM_STORAGE_DB_UNAVAILABLE`)
  - **summary:** The runtime-native platform deployment handlers (`start-deployment.ts`, `deploy-targets.ts`) reimplement AES-256-GCM crypto by hand instead of using the existing `AesGcmSecretCipher` class. Three copies of `PLATFORM_SECRET_ENCRYPTION_KEY` env parsing, two copies of the encrypt path, two copies of the decrypt path. Each copy has slightly different error codes for the same failure mode, which leaks into the API responses CLI/UI see.
  - **proposed_fix:** Have both handlers import `AesGcmSecretCipher.fromEnv(process.env)` from `@rntme/platform-storage` (or expose a constructor that takes a `Buffer` key directly so handler code stays env-agnostic). The handlers shed ~80 LoC and align error codes with the canonical `SecretCipher` seam. Cross-cuts the `rntme_platform_redeploy_secret` memory — runtime-native deploys parse the same env var the platform-storage adapter already owns.

- **id:** F032
  - **package(s):** @rntme/platform-storage
  - **kind:** suboptimal
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 6
  - **evidence_paths:**
    - packages/platform/platform-storage/src/schema/*.ts (12 tables defined as Drizzle pgTable schemas)
    - packages/platform/platform-storage/src/pg/pool.ts (lines 1-16 — `drizzle(pool)` factory)
    - packages/platform/platform-storage/src/repos/pg-deployment-repo.ts (14 raw `this.db.query` calls, lines 33-39, 67-73, 312-323, …)
    - packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts (5 raw queries)
    - packages/platform/platform-storage/src/repos/pg-project-version-repo.ts (10 raw queries)
    - packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts (10 raw queries)
    - packages/platform/platform-storage/src/repos/pg-outbox-repo.ts (2 raw queries)
    - packages/platform/platform-storage/src/repos/pg-deploy-stage-state-repo.ts (uses Drizzle `eq`/`and` with `NodePgDatabase`)
    - packages/platform/platform-storage/src/repos/pg-membership-mirror-repo.ts (uses Drizzle)
    - packages/platform/platform-storage/src/repos/pg-account-repo.ts (uses Drizzle)
    - packages/platform/platform-storage/src/repos/pg-workos-event-log-repo.ts (uses Drizzle)
  - **summary:** Schema is declared with Drizzle (`pgTable`/`pgEnum` in every file under `schema/`), but only 4/12 repos actually use Drizzle's query builder. The other 8 — including the highest-traffic `pg-deployment-repo` and `pg-project-operation-repo` — hand-write SQL strings against `this.db.query(\`SELECT ...\`)` with `$1`/`$2` positional params, manual `row['col']` mapping, and bespoke `rowToDeployment`/`rowToOperation` deserializers. Two idioms living in the same package; schema changes need to be applied twice (Drizzle migration + every hand-rolled SQL string).
  - **proposed_fix:** Pick one idiom. The Drizzle schema already exists, so port the raw-SQL repos to Drizzle's query builder (`db.select().from(deployment).where(...)`) and drop the hand-rolled row-to-object mappers. Drizzle's typed inference replaces the `DbRow = Record<string, unknown>` casts and gives compile-time safety. Alternatively, if performance/feature reasons exist for raw SQL, document them and remove the schema declarations for those tables; do not maintain both.

- **id:** F033
  - **package(s):** @rntme/platform-storage
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 1
  - **evidence_paths:**
    - packages/platform/platform-storage/src/repos/pg-deployment-repo.ts (lines 523-549 — local `withOptionalTransaction` + lines 551-575 — local `withSystemRlsDisabled`)
    - packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts (lines 392+ — local `withOptionalTransaction`)
    - packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts (lines 318+ — local `withSystemRlsDisabled`)
    - packages/platform/platform-storage/src/pg/tx.ts (`withTransaction(pool, orgId, fn)` — the canonical RLS-aware transaction helper)
  - **summary:** Three repos each carry their own private `withOptionalTransaction` / `withSystemRlsDisabled` helpers (4 copies total), even though `pg/tx.ts` already exposes the canonical `withTransaction`. The local copies subtly differ: deployment-repo's `withSystemRlsDisabled` calls `SET LOCAL row_security = off`, while project-operation-repo's calls `SET row_security = off` — the same correctness bug split across two files.
  - **proposed_fix:** Move `withOptionalTransaction` + `withSystemRlsDisabled` into `pg/tx.ts` next to `withTransaction`. Have all three repos import them. Diff the two `withSystemRlsDisabled` variants and pick the correct one (LOCAL is safer — resets on tx end).

- **id:** F034
  - **package(s):** @rntme/platform-storage, @rntme/platform-core
  - **kind:** risk
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 1
  - **evidence_paths:**
    - packages/platform/platform-storage/src/repos/pg-deployment-repo.ts (lines 312-335 — `findStaleRunning` query: `WHERE status='running' AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - …)`)
    - packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts (lines 219-242 — identical predicate: `WHERE status='running' AND (last_heartbeat_at IS NULL OR last_heartbeat_at < …)`)
    - packages/platform/platform-core/src/repos/deployment-repo.ts (line 102 — interface declares `findStaleRunning`)
    - packages/platform/platform-core/src/repos/project-operation-repo.ts (line 68 — same)
    - apps/platform/blueprint/services/deployments/handlers (no sweep over `queued` rows, no equivalent reconciliation cron found)
  - **summary:** Confirmation of the `rntme_orphan_detect_queued_gap` memory: both `findStaleRunning` queries match only `status='running'`. A deployment or project-operation that gets stuck in `queued` (e.g. worker crash before `transition('queued' → 'running')`) is never returned by the orphan sweep and blocks `hasActiveForProject`/`hasActiveForProjectTarget` indefinitely. `hasActiveForProject` (line 337) treats both `'queued'` and `'running'` as live; so a forever-queued row blocks all subsequent update/delete operations.
  - **proposed_fix:** Change both `findStaleRunning` predicates to `WHERE status IN ('queued','running') AND (...)`. Or split into two interface methods (`findStaleQueued`/`findStaleRunning`) with different staleness thresholds — queued rows that never started after N seconds are clearer signal than running rows that lost heartbeat. Either way, the current query is silently wrong for the most common operator failure mode.

- **id:** F035
  - **package(s):** @rntme/deploy-runner, @rntme/platform-core, @rntme/deploy-dokploy
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 3
  - **evidence_paths:**
    - packages/deploy/deploy-runner/src/deploy-target-types.ts (lines 1-190 — full structural mirror of platform-core's `DeployTarget`/`EventBusConfig`/`KafkaSecurity`/`DeployTargetModules`/`DeployTargetWorkflows`/`DeployTargetStorage`/`DeployTargetAuthConfig`/`DeployTargetManualAccess`/`PolicyValues`/`VerificationReport`/`VerificationCheck`/`WorkloadStatus`)
    - packages/deploy/deploy-runner/src/dokploy-client-factory.ts (lines 18-44 — `EncryptedSecret`/`SecretCipher`/`DokployTargetWithSecret`/`ParseTargetSecretResult` mirrors)
    - packages/deploy/deploy-runner/package.json (declares `@rntme/platform-core: workspace:*` as a direct dependency)
  - **summary:** `deploy-target-types.ts` opens with "intentionally kept import-free of platform-core so deploy-runner has no dependency on it" — but `package.json` already declares the dep and `handlers/*.ts`, `db-teardowns.ts`, `project-delete.ts`, `platform-context.ts` all import platform-core directly. The header comment is stale and the 190 LoC of duplicated zod-inferred types are pure maintenance burden (`exactOptionalPropertyTypes` carve-outs, `KafkaSecurityPlaintext | KafkaSecuritySaslSsl`, the whole shape). Same pattern in `dokploy-client-factory.ts` for `EncryptedSecret`/`SecretCipher`/`DokployTargetWithSecret`.
  - **proposed_fix:** Either (a) accept the platform-core dep in the pure layer too and delete `deploy-target-types.ts` + the `dokploy-client-factory.ts` mirrors, OR (b) move the shared types into `@rntme/contracts-deploy-target-v1` (a tiny new zod-free contract) and have both platform-core and deploy-runner import it. Option (a) is simpler given the runner already imports platform-core in the glue layer.

- **id:** F036
  - **package(s):** @rntme/deploy-bundle-input, @rntme/bindings-grpc, packages/contracts/*/v1/proto
  - **kind:** architectural
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 4
  - **evidence_paths:**
    - packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts (line 6 — `import { emitProto } from '@rntme/bindings-grpc'`; line 818-835 — `findWorkspaceRoot()` walks parent dirs looking for `packages/runtime/ui-runtime/package.json`; line 837-845 — `readUiRuntimeCss` reads `packages/runtime/ui-runtime/build/main.css` from disk)
    - packages/platform/deploy-bundle-input/src/contract-protos.ts (lines 19-24 — hard-coded `packages/contracts/<category>/v1/proto/*.proto` paths; lines 73-88 — second copy of `findWorkspaceRootForContracts()`)
    - packages/platform/deploy-bundle-input/src/runtime-module-wiring.ts (lines 158-174 — `contractProtoForModuleKey` hard-codes vendor-category mapping (`identity-`, `openrouter`, `ai-llm`, `storage`); throws on unknown)
    - packages/platform/deploy-bundle-input/package.json (dependencies: `@rntme/bindings-grpc`, `@rntme/blueprint`, `@rntme/deploy-core` — runtime dep edge)
  - **summary:** `deploy-bundle-input` (which the doc calls a "platform" package) reaches into the workspace filesystem at runtime to read proto sources and runtime CSS via two independent `findWorkspaceRoot` walks, and it hard-codes the `category → proto path` mapping that already lives implicitly in `contracts-module-v1`'s manifest schema. It also depends on `@rntme/bindings-grpc` (a runtime package) just for `emitProto`. The current layering: deploy-time bundler reads runtime build artifacts (CSS) from disk and runtime grpc emitter from JS — making bundling order-dependent on `bun run build` for `ui-runtime`, and bundling itself unable to run inside a deployed container.
  - **proposed_fix:** (1) Ship canonical contract protos via the contract packages' own `package.json#exports` (e.g. `@rntme/contracts-identity-v1/proto`) and resolve them through `createRequire`/`import.meta.resolve` instead of monorepo path walks; the contract proto loader belongs in each contract package. (2) Replace `contractProtoForModuleKey` with a lookup via `module.json#category` from the catalog. (3) Either move `readUiRuntimeCss` to a deploy step that explicitly runs after `ui-runtime` build, or have `ui-runtime` publish its built CSS as a package export. (4) Move `emitProto` out of `bindings-grpc` into a tiny `@rntme/proto-emitter` (or fold into bundles) to break the runtime → platform deps edge.

- **id:** F037
  - **package(s):** @rntme/deploy-dokploy, @rntme/deploy-core
  - **kind:** suboptimal
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 4
  - **evidence_paths:**
    - packages/deploy/deploy-dokploy/src/compose-yaml.ts (entire 88-line file — hand-built YAML via `lines.push('  ' + service.name + ':')`, `yamlScalar()` regex-quote helper, `expose:`/`environment:`/`volumes:`/`deploy:` blocks)
    - packages/deploy/deploy-dokploy/src/nginx.ts (entire 317-line file — string-built nginx config: `lines.push('upstream rntme_auth_…')`, hand-quoted server blocks, hand-emitted `auth_request` directives)
    - packages/deploy/deploy-dokploy/src/render.ts (1307 lines — huge render function building Compose model objects then handing them to compose-yaml/nginx for stringification)
    - packages/deploy/deploy-dokploy/src/apply.ts (1109 lines — applies the rendered output via Dokploy HTTP client)
  - **summary:** Both compose YAML and nginx config are built by string concatenation with ad-hoc escaping (`yamlScalar`: `/^[A-Za-z0-9._/:@{}$-]+$/` is the only sentinel for "needs JSON-quoting"). A volume source containing a comma, or an env value with a single quote that happens to match the regex, can silently emit invalid YAML/nginx. The renderer also has no schema validation step over the rendered string before it leaves the package; the only defence is integration tests with hard-coded golden outputs. With ~1.4K LoC of stringly-typed rendering, every Dokploy/nginx feature add is high-friction and high-bug-risk.
  - **proposed_fix:** (a) For Compose: emit an `RenderedComposeDocument` object and serialize via `yaml` (the npm package) at the boundary; let the library handle escaping. (b) For nginx: keep the structural `RenderedNginxConfig` already half-built in `nginx.ts` and use a small template engine (or a typed builder that yields lines) so directive emission isn't `lines.push()` everywhere. Both moves shrink the per-file LoC dramatically and remove the "did we forget to quote this?" class of bug.

- **id:** F038
  - **package(s):** @rntme/deploy-bundle-input
  - **kind:** architectural
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts (lines 132-155 — `platformServicePersistence` hard-codes `projectName === 'rntme-platform'` and service slugs `'tokens'`, `'projects'`, `'deployments'` to inject `volumeName: 'rntme-platform-control-data'` and SQLite file paths)
    - apps/platform/blueprint/services/{tokens,projects,deployments}/ (the services this branch targets)
    - docs/current/owners/packages/platform/deploy-bundle-input.md (lines 43-53 — owner doc surfaces this carve-out as "platform control-plane persistence")
  - **summary:** The deploy-bundle-input library (a general-purpose materialized-blueprint → deploy-core input transform) special-cases one specific project (`rntme-platform`) and three specific service slugs by name to attach persistent volumes. The persistence shape is already in `ComposedProjectService.persistence` (defined in `@rntme/deploy-core`), so the platform blueprint should encode this in `project.json`/`service.json` and let the generic transform pass it through — instead it's hidden inside the deploy-bundle-input transform where any other project named `rntme-platform` would inherit the same volume layout accidentally.
  - **proposed_fix:** Move the persistence declaration into the platform blueprint's service-level JSON (e.g. `apps/platform/blueprint/services/{tokens,projects,deployments}/persistence.json` or extend `service.spec.json`). Have `@rntme/blueprint` carry it into `ComposedBlueprint.services[].persistence`. Delete `platformServicePersistence` from `to-deploy-core-input.ts`. Same shape as F006/F011 — platform-specific knowledge has leaked into a "generic" transform.


### Wave 5 — apps/

- **id:** F039
  - **package(s):** @rntme/platform-ui (apps/platform/ui-module)
  - **kind:** architectural
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 8
  - **evidence_paths:**
    - apps/platform/ui-module/src/components.tsx (3746 LoC, single file)
    - apps/platform/ui-module/src/components.tsx (lines 250-441 `PlatformDataTable` + helpers; 308-441 `PlatformTokenIssuer`; 464-556 `PlatformPageHeader`; 572-700 `PlatformSummaryGrid`; 778-1660 `PlatformDataModelExplorer` + 25+ sub-renderers `renderEntityDetail`, `renderEntityFields`, `renderEntityRelationships`, `renderProjectionExplorer`, `renderRelationshipDiagram`, …; 1661-1755 `PlatformPanel`; 1690-1756 `PlatformServicesPanel`; 1826-1875 `PlatformTimeline`; 1877-1928 `PlatformAlertList`; 1930-1985 `PlatformBanner`; 1985-2025 `PlatformEmptyState`; 2026-2178 `PlatformSidebar`+`crumbsFromPath`; 2180-2348 `PlatformTopbar`; 2501-2870 `PlatformAPIExplorer` + 12 internal renderers `renderAPIDetail`, `renderOverviewPane`, `renderRawPane`, `renderRequestPane`, `renderResponsePane`, `renderExamplesPane`, `renderAPIParameterSheet`; 3739-3746 `PlatformPage`/`PlatformBox`)
    - apps/platform/ui-module/src/components.tsx (50 hook calls of `useState`/`useEffect`/`useMemo`/`useCallback`/`useTransport` across the file — per-screen ad-hoc state is implemented as per-component `useState` inside the same module, including in-component filter/search/active-tab/selection/sheet state for the two explorers)
  - **summary:** `components.tsx` is a 3.7K-LoC monolithic file holding ~25 platform UI components plus dozens of internal `render*` sub-functions for two large explorers (`PlatformDataModelExplorer` ≈ 880 LoC, `PlatformAPIExplorer` ≈ 370 LoC of component + ~370 LoC of internal renderers). Routing helpers, badge utilities, template resolvers, JSON tree renderers, side-sheet logic, and clipboard helpers all live alongside the components in one file. The two explorers reimplement the same "left tree with filter + search + selected detail + side-sheet" shape twice from scratch with no shared abstraction (different state shapes, different `useState` keys, different selection bookkeeping). All component-local state for filters/search/selected-item/sheet-open is `useState` inside the component — there is no shared "explorer state" hook and no shared `useFilteredTree` / `useSelectionWithSheet` primitive. This file is the load-bearing audit trigger for "per-screen ad-hoc state, duplicated explorer/editor patterns".
  - **proposed_fix:** Split `components.tsx` into one file per top-level component (`platform-data-model-explorer.tsx`, `platform-api-explorer.tsx`, `platform-page-header.tsx`, `platform-sidebar.tsx`, `platform-topbar.tsx`, …). Extract a shared `useExplorerState({rows, query, selected, sheet})` hook plus a `PlatformExplorerShell` layout that takes `{ leftTree, detailPane, sidesheet }` slots, and migrate both explorers onto it (they already share the structural pattern). Move template/clipboard/JSON-preview helpers into a small `internal/util.ts`. This change is mechanical and unblocks future explorers (graph explorer, UI-component explorer, audit explorer) from copy-pasting the same scaffold.

- **id:** F040
  - **package(s):** @rntme/platform-ui (apps/platform/ui-module), apps/platform/blueprint
  - **kind:** suboptimal
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - apps/platform/ui-module/module.json (lines 9, 10, 14 — `PlatformPageHeader.props` declares `eyebrow,title,meta,statePath,actions`; `PlatformSidebar.props` declares `brand,version,contextLabel,contextName,contextMeta,items,cliVersion`; `PlatformTopbar.props` declares only `crumbs,actions`; `PlatformAPIExplorer.props` declares only `endpointsStatePath,summaryStatePath,endpointDetailPathTemplate`; `PlatformDataTable.props` declares only `statePath,columns`)
    - apps/platform/blueprint/services/app/ui/screens/api.spec.json (lines 53-54 — passes `graphHrefTemplate` and `pdmHrefTemplate` to `PlatformAPIExplorer`)
    - apps/platform/ui-module/src/components.tsx (lines 2510, 2517, 2889-2890 — `PlatformAPIExplorer` accepts `graphHrefTemplate`, `pdmHrefTemplate`)
    - apps/platform/blueprint/services/app/ui/layouts/main.spec.json (lines 22, 27, 33, 39, 45, 51 — sidebar items use `hrefTemplate`, `matchPattern`, and `section`; line 65 — topbar uses `crumbsFromRoute`)
    - apps/platform/ui-module/src/components.tsx (lines 162, 215, 224-247 — `PlatformDataTable` columns implement `hrefTemplate`, `hrefTemplateMap`, `value`; lines 199-203 — `PlatformPageHeader` actions implement `hrefTemplate`)
    - apps/platform/blueprint/services/app/ui/screens/audit.spec.json (lines 29-41 — column uses `hrefTemplateMap.{typeField,byType}` shape)
    - docs/current/owners/apps/platform.md (lines 248-376 — owner doc describes most of these props as the canonical screen-spec API, so the manifest is the lagging artifact)
  - **summary:** `module.json` (the platform-ui component manifest used for spec validation and component-registry typing) is significantly out of date relative to what `components.tsx` actually accepts and what every screen spec passes. At least 7 props are missing from the manifest: `PlatformAPIExplorer.graphHrefTemplate`, `PlatformAPIExplorer.pdmHrefTemplate`, `PlatformSidebar.items[].hrefTemplate`, `PlatformSidebar.items[].matchPattern`, `PlatformSidebar.items[].section`, `PlatformTopbar.crumbsFromRoute`, `PlatformTopbar.actions[].hrefTemplate`, `PlatformPageHeader.actions[].hrefTemplate`, `PlatformDataTable.columns[].hrefTemplate`/`hrefTemplateMap`/`value`. Today this drift is hidden because the runtime ignores unknown props and the spec-validation contract evidently does not whitelist props; but the manifest is the only place a downstream consumer (or skill, or generator) can discover the contract. Same shape as F029/F038: blueprint and module package have drifted in lockstep without the manifest catching up.
  - **proposed_fix:** Either (a) make `module.json` the source of truth and regenerate it from a TypeScript declaration of each component's props (single source — file lives next to the component), OR (b) drop `module.json#client.components` entirely if it is no longer validated against and rely on TypeScript prop types in the component source. Option (a) is structurally similar to how `bindings.json` and graph `signature.inputs` are kept honest. A test in `apps/platform/blueprint/test/platform-ui.test.ts` that asserts every prop passed by any screen `*.spec.json` is declared in `module.json` would catch future drift in CI.

- **id:** F041
  - **package(s):** apps/platform/blueprint (services/app/ui/screens)
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 3
  - **evidence_paths:**
    - apps/platform/blueprint/services/app/ui/screens/data-model.spec.json (lines 8-39 — `header` with 4 cross-link actions: Back/API/UI/Graph)
    - apps/platform/blueprint/services/app/ui/screens/api.spec.json (lines 9-40 — `header` with 4 cross-link actions: Back/Data model/UI/Graph)
    - apps/platform/blueprint/services/app/ui/screens/ui.spec.json (lines 9-40 — `header` with 4 cross-link actions: Back/Data model/API/Graph)
    - apps/platform/blueprint/services/app/ui/screens/graph.spec.json (lines 9-40 — `header` with 4 cross-link actions: Back/Data model/API/UI)
    - apps/platform/blueprint/services/app/ui/screens/project.spec.json (lines 9-42 — same actions array without Back)
    - apps/platform/blueprint/services/app/ui/screens/data-model.screen.json / api.screen.json / ui.screen.json / graph.screen.json (every one shares the `/data/summary` binding to `projects.getProjectArtifactSummary` with the same `{projectId: {$state: "/route/params/projectId"}}` params block)
  - **summary:** The four artifact explorer screens (`data-model`, `api`, `ui`, `graph`) each redeclare the same `PlatformPageHeader` with the same "Back to project + 3 sibling tabs" action list, plus the same `PlatformSummaryGrid { statePath: "/data/summary" }` element and the same `/data/summary` data binding. The cross-link array is also stamped onto the parent `project.spec.json` header (without the Back action). Adding a new artifact explorer (e.g. workflows, BPMN, schemas) requires updating 5 spec files in lockstep; renaming `/api` to `/endpoints` is a 5-file change. There is no "artifact-explorers" macro or shared header fragment, even though `module.json#client.presets` already declares a `fragment` preset mechanism (used today only for `service-card`).
  - **proposed_fix:** Introduce a screen-spec composition mechanism — either (a) a per-project "screen partials" file that explorer screens `$ref` into, or (b) extend `module.json#presets` so a `PlatformExplorerHeader { eyebrow, title, currentTab }` fragment expands to the full action set at compose time. The latter is closer to existing project conventions. Either fix also pairs naturally with F039's `PlatformExplorerShell` consolidation: one component, one shared header preset.

- **id:** F042
  - **package(s):** apps/platform/blueprint (per-service `bindings/bindings.json`)
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 2
  - **evidence_paths:**
    - apps/platform/blueprint/services/deployments/bindings/bindings.json (every read binding repeats `inputFrom: { authorization: {from:"header",name:"authorization",required:true}, sessionSubject: {from:"header",name:"x-rntme-user-sub",required:false}, sessionStatus: {from:"header",name:"x-rntme-session-status",required:false} }` — listDeployTargets, listDeployments, getDeployment, readDeploymentLogs, readDeployStages, startDeployment, createDeployTarget, updateDeployTarget all carry the same 3-line block)
    - apps/platform/blueprint/services/projects/bindings/bindings.json (same 3-key `inputFrom.{authorization,sessionSubject,sessionStatus}` repeated on `listProjects`, `listProjectServices`, `getProjectArtifactSummary`, `getProjectArtifact`, `listProjectDataModel`, `listProjectEndpoints`, `getProjectEndpointDetail`, `listProjectUiComponents`, `listProjectGraphs`, `publishProjectBundle`)
    - apps/platform/blueprint/services/audit/bindings/bindings.json + organizations/bindings/bindings.json + tokens/bindings/bindings.json (same 3-key block on every authenticated binding)
    - apps/platform/blueprint/services/*/operations.json (mirror copy: every operation declares `authorization`, `sessionSubject`, `sessionStatus` as input params; ~30 operations × 3 fields each)
  - **summary:** Every authenticated binding in every service declares the same 3-header `inputFrom` block (`authorization` from `header authorization`, `sessionSubject` from `x-rntme-user-sub`, `sessionStatus` from `x-rntme-session-status`). The same 3 inputs are then repeated in each operation's `operations.json#input` block. With ~30 platform bindings, that's ~90 redundant input declarations whose only variation is the rare binding that drops `sessionStatus` (legacy). Adding a 4th forwarded header — currently planned as `X-Rntme-User-Audience` per the owner doc — is a ~30-file edit, and the parent `project.json#middleware.auth` already knows which providers it walks. The platform-tokens/auth0 providers already inject these headers at the edge — repeating them per-binding is a bindings-shape limitation, not a semantic difference.
  - **proposed_fix:** Add a binding-level macro `inputFrom: { $extends: "platform-session-headers" }` (resolved by `@rntme/blueprint` at compose-time) OR collapse session-forwarding into a single declarative line on the mount itself (the `mounts[].use: ["requestContext","auth"]` middleware already knows it must forward these headers). The native operation contract should consume the session as one object (`session: {subject?, status?, audience?}`), not three separate string inputs. This is the same fix-class as F006/F011 ("platform-specific knowledge inlined into a generic transform") but at the binding-shape layer.

- **id:** F043
  - **package(s):** @rntme/cli (apps/cli/src/deploy-engine), @rntme/platform-blueprint (services/deployments/handlers)
  - **kind:** duplication
  - **severity:** P1
  - **impact:** high
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - apps/cli/src/deploy-engine/resolve-provisioner.ts (lines 8-65 — `createCliResolveProvisioner`, `resolveBundledProvisioner`, `provisionerKey`, `resolvePackageRoot`, `resolvePackageEntry`, `importProvisioner`)
    - apps/platform/blueprint/services/deployments/handlers/start-deployment.ts (lines 601-663 — `createRuntimeResolveProvisioner`, `resolveBundleAssetProvisioner`, `resolveBundledProvisioner`, `resolvePackageRoot`, `resolvePackageEntry`, `importProvisioner` — bytewise-identical for the four shared helpers)
    - both files import `ResolveProvisioner` from `@rntme/deploy-runner`
    - memory: rntme_provisioner_resolver_gap (PR #134 already flagged the resolver as fragile because `node_modules` placement is hostile in the platform-http bundle)
  - **summary:** The provisioner-resolution helpers (`resolveBundledProvisioner`, `provisionerKey`, `resolvePackageRoot`, `resolvePackageEntry`, `importProvisioner`) are bytewise duplicated between `apps/cli/src/deploy-engine/resolve-provisioner.ts` (used by `rntme deploy` and `rntme platform up`) and `apps/platform/blueprint/services/deployments/handlers/start-deployment.ts` (used by runtime-native deployment start). The platform handler has one extra branch — `resolveBundleAssetProvisioner` that reads from `assets/provisioners/<safe>.entry.js` — but the legacy `resolveBundledProvisioner` / package-entry fallback path is identical. There is no shared package for this code; both files are independent reimplementations of the same ResolveProvisioner contract. Two consequences: (a) any fix to provisioner resolution must land in two places, and (b) the rntme_provisioner_resolver_gap memory's underlying cause (node_modules unreachable from the deployed bundle) is currently solved per-file.
  - **proposed_fix:** Move the four shared helpers into `@rntme/deploy-runner` (or a tiny new `@rntme/provisioner-resolve`) and export `{ buildResolveProvisioner(opts: { bundleAssetDir?: string, manifestPath?: string }) }`. CLI calls it with `manifestPath = ".provisioners/manifest.json"`, runtime calls it with `bundleAssetDir = "assets/provisioners"`. Eliminates the byte-duplicated code and centralizes the resolver's path-safety invariants (the `back === '..' || back.startsWith('../')` checks are currently independently maintained in both files).

- **id:** F044
  - **package(s):** @rntme/cli (apps/cli/src/commands/project)
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 1
  - **evidence_paths:**
    - apps/cli/src/commands/project/deployment-watch.ts (lines 26-61 — `watchUntilTerminal` polling loop: `await endpoints.deployments.show` + `await endpoints.deployments.logs` + print + sleep until status is in `TERMINAL`)
    - apps/cli/src/commands/project/operation-watch.ts (lines 17-54 — `watchProjectOperationUntilTerminal`: same polling shape, calls `endpoints.projectOperations.show` + `endpoints.projectOperations.logs`)
    - apps/cli/src/commands/project/deployment-watch.ts (lines 101-103) and apps/cli/src/commands/project/operation-watch.ts (lines 102-104) — each file ends with its own `function sleep(ms): Promise<void>` copy
    - both files define an identical `TERMINAL` Set sentinel and a `sinceLineId = 0` log-cursor loop
  - **summary:** `watchUntilTerminal` (deployment) and `watchProjectOperationUntilTerminal` (project operation) are the same polling loop reimplemented twice: same `pollIntervalMs = 2_000` default, same `Date.now() - started > timeoutMs` timeout guard, same log-printing block, same `printLogs` flag, same private `sleep` helper. They differ only in the `endpoints.*.show`/`.logs` namespace and the response key (`deployment` vs `operation`). The CLI plans to add a third watcher (the harness already has the shape for it — `harness.ts` returns `Result<T>` from any command), so the duplication will compound.
  - **proposed_fix:** Add a `pollUntilTerminal<T>({ show, logs, isTerminal, printLog })` helper in `apps/cli/src/commands/poll-until-terminal.ts`. Both watchers become 5-line adapters that pass `endpoints.deployments` or `endpoints.projectOperations`. Move `sleep` into `apps/cli/src/util/sleep.ts` (it would replace 2 separate copies and any future ones).

- **id:** F045
  - **package(s):** apps/landing
  - **kind:** dead-code
  - **severity:** P3
  - **impact:** low
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 1
  - **evidence_paths:**
    - apps/landing/src/components/LiveDemoCard.astro (40 LoC) — no consumer; `grep -rn "LiveDemoCard"` outside the file's own `.test.ts` returns no matches in `src/pages` or `src/layouts`
    - apps/landing/src/components/MicroJobs.astro (73 LoC) — no consumer
    - apps/landing/src/components/SnowflakeToRuntime.astro (46 LoC) — no consumer
    - apps/landing/src/pages/index.astro (only imports `AhaSection`, `AntiFit`, `BaseLayout`, `BestFit`, `Compare`, `Footer`, `Hero`, `HowItWorks`, `Objections`, `PilotForm`, `Problem`)
    - apps/landing/src/components/LiveDemoCard.test.ts (still imports and tests `LiveDemoCard.astro` even though no page renders it)
    - memory: feedback_landing_overdrive (2026-04-20 reverted §06 motion overlay) — these three components survived that revert as orphans
  - **summary:** Three landing-page components have no import path from `src/pages/index.astro` (the only marketing page) or from `src/layouts/BaseLayout.astro`. `LiveDemoCard.astro` is exercised by a unit test (`LiveDemoCard.test.ts`) but never rendered to a user. `MicroJobs.astro` and `SnowflakeToRuntime.astro` have neither a render site nor a test. They match the "landing-site dead struts" hypothesis for Wave 5 priority #5. The previous landing-overdrive revert appears to have removed render sites but left the component files behind.
  - **proposed_fix:** Delete `LiveDemoCard.astro` + `LiveDemoCard.test.ts` (and the `shouldRenderDemo.ts` helper they depend on — verify with one more grep), `MicroJobs.astro`, and `SnowflakeToRuntime.astro`. Pre-stable stage permits straight deletion (no back-compat needed per project_pre_stable_stage memory). Optionally add an ESLint/depcruise rule that fails if any component under `apps/landing/src/components/` has no inbound import from `pages/` or `layouts/`.

- **id:** F046
  - **package(s):** @rntme/cli (apps/cli/src/commands/project/publish.ts)
  - **kind:** suboptimal
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 1
  - **evidence_paths:**
    - apps/cli/src/commands/project/publish.ts (lines 51-61 — on compose failure: `composed.errors.map((e) => \`${e.code}: ${e.message}\`).join('; ')` collapses every validation error into one semicolon-separated string passed as the `CLI_VALIDATE_LOCAL_FAILED` message)
    - apps/cli/src/commands/project/publish.ts (line 57 — `undefined` is passed as `cause`, then the full `composed.errors` array is passed as the 4th positional arg, which the `cliError` factory may or may not preserve in JSON output)
    - apps/cli/src/commands/project/publish.ts (lines 38-39 — human render emits just the digest/size; nothing surfaces per-artifact paths)
    - apps/cli/src/commands/deploy.ts (uses `loadBlueprintForDeploy` which preserves the first compose error's code but stringifies the rest the same way at apps/cli/src/deploy-engine/load-blueprint.ts:26-32)
    - memory: rntme_cli_dist_silent_stale (2026-05-?) — describes the same shape: server returns bare `BLUEPRINT_*_INVALID` and the CLI surfaces no cause
  - **summary:** CLI publish/deploy both collapse `composed.errors[]` (structured per-artifact validation failures from `@rntme/blueprint`) into a single semicolon-joined string for the human-readable message, and the JSON-output path's preservation of the structured array is incidental. When a multi-file blueprint has 6 different validation errors, the user sees a one-line error of joined codes; there is no per-artifact-path output. This matches the F018 hypothesis ("divergent error fidelity") for the CLI side and the `rntme_cli_dist_silent_stale` memory's observation that publish failures arrive as bare codes.
  - **proposed_fix:** In `publish.ts` and `load-blueprint.ts`, keep the full `composed.errors[]` on the `CliError` (the `cause` slot is the natural home) and add a `--verbose`-aware renderer in `apps/cli/src/output/format.ts` that prints each error's `code`, `message`, and `artifactPath` (when present). The structured payload is already in `composed.errors`; only the renderer is missing.

- **id:** F047
  - **package(s):** apps/platform (package layout)
  - **kind:** architectural
  - **severity:** P3
  - **impact:** low
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 1
  - **evidence_paths:**
    - apps/platform/package.json (line 2 — `"name": "@rntme/platform-blueprint"`; lines 7-10 — `scripts: { "test": "bun test blueprint/test", "typecheck": "tsc -p tsconfig.check.json" }`; no `build`, no `lint`, no reference to ui-module)
    - apps/platform/ui-module/package.json (separately-named `@rntme/platform-ui`; its own `build`, `test`, `typecheck`, `lint` scripts)
    - docs/current/owners/apps/platform.md (lines 244-249 — describes both `apps/platform/blueprint` and `apps/platform/ui-module` as part of "the platform UI" under one owner doc; matches T001 anomaly that flagged shared ownership)
    - apps/platform/ui-module/module.json + apps/platform/blueprint/project.json line 25 — the two packages cross-reference (`project.json#modules.platformUi.package: "@rntme/platform-ui"`) and so must be co-versioned
    - grep across repo shows `@rntme/platform-ui` is only consumed by `apps/platform/blueprint`; no external consumer
  - **summary:** `apps/platform/` houses two formally-independent npm packages (`@rntme/platform-blueprint` at `package.json` and `@rntme/platform-ui` at `ui-module/package.json`) that ship together, version together, are owned by one doc, are never consumed independently, and don't expose their cross-dependency through workspace metadata (the blueprint's `package.json` doesn't list `@rntme/platform-ui` as a dep — it discovers it via `project.json#modules`). The split exists only because the runtime composition model wants `@rntme/platform-ui` to look like a vendor module; meanwhile the blueprint's own tests can't test ui-module-rendered output because they're separate test commands. This is the structural cause of the T001 ownership anomaly.
  - **proposed_fix:** Either (a) collapse `apps/platform/ui-module` into `apps/platform/ui/` and have a single `@rntme/platform` package register both the blueprint and the UI module from one source tree (the runtime composition can still treat the UI as a module via an in-package manifest), OR (b) move `apps/platform/ui-module` to `packages/platform/platform-ui/` to match where every other consumed package lives, and update `apps/platform/blueprint/project.json` to reference it via the standard packages path. Option (b) is the smaller diff and removes the `apps/platform/`-as-multi-package shape. Either fix unblocks T001's owner-doc cleanup.

- **id:** F048
  - **package(s):** apps/platform/blueprint (services/app/ui/screens/deployment.spec.json), @rntme/platform-ui
  - **kind:** bug
  - **severity:** P3
  - **impact:** low
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 0
  - **evidence_paths:**
    - apps/platform/blueprint/services/app/ui/screens/deployment.spec.json (lines 14-19 — header action `"Back to deployments"` uses `hrefTemplate: "/{orgId}"` which resolves to the org dashboard, not the deployments list)
    - apps/platform/blueprint/services/app/ui/screens/deployments.spec.json (the actual deployments list lives at the `deployments.screen.json` route, not at `/{orgId}`)
    - apps/platform/blueprint/services/app/ui/layouts/main.spec.json (lines 30-35 — sidebar item "Deployments" routes to `/{orgId}/projects/{projectId}/deployments`)
  - **summary:** The single-deployment screen's "Back to deployments" header action templates to `/{orgId}`, which is the org dashboard route, not the deployments list. The actual deployments listing route is `/{orgId}/projects/{projectId}/deployments` (per the sidebar in `main.spec.json`). The button text says "Back to deployments" but the destination is the org dashboard. Cosmetic UX bug; safe to fix.
  - **proposed_fix:** Change `deployment.spec.json` line 18 to `"hrefTemplate": "/{orgId}/projects/{projectId}/deployments"`. Verify the screen receives `projectId` in `/route/params` first; if not, fall back to the org's deployments index (which doesn't exist as a route today — that's a separate gap and may warrant a new screen).

### Wave 6 — packages/tooling + non-vendored demo sources

- **id:** F049
  - **package(s):** demo/notes-blueprint, demo/order-fulfillment-blueprint, demo/cv-extract-blueprint, @rntme/blueprint
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 6
  - **evidence_paths:**
    - demo/cv-extract-blueprint/project.json (line 9 — `"package": "@rntme/ai-llm-openrouter"`; line 16 — `"package": "@rntme/storage-s3"`; line 24 — `"package": "@rntme/marketing-site-static"` — all canonical scoped names)
    - demo/notes-blueprint/project.json (line 12 — `"package": "rntme_identity_auth0"` — snake_case dir alias)
    - packages/artifacts/blueprint/src/compose/modules.ts (lines 209-226 — `workspacePackagePathSegments`: an explicit `/^rntme_([a-z0-9]+(?:-[a-z0-9]+)*)_([a-z0-9]+(?:-[a-z0-9]+)*)$/` regex maps `rntme_<cat>_<vendor>` → `modules/<cat>/<vendor>` solely because the notes demo committed to that form)
    - demo/notes-blueprint/node_modules/rntme_identity_auth0/ (vendored under snake_case path, matching the project.json alias)
    - demo/cv-extract-blueprint/node_modules/@rntme/ai-llm-openrouter (presumably scoped — not opened due to exclusion, but vendor:check confirms via package.json reads)
  - **summary:** The three demos disagree on how to spell `project.json#modules.<key>.package`. cv-extract uses the canonical npm scoped name (`@rntme/ai-llm-openrouter`); notes uses the snake_case vendored-directory alias (`rntme_identity_auth0`). Both work because `@rntme/blueprint`'s `workspacePackagePathSegments` has a dedicated alias-matching branch with a regex carrying the entire mapping rule. This is unnecessary surface area sustained only because two demos drifted, and it doubles the namespace authors have to learn.
  - **proposed_fix:** Pick one form (canonical scoped name is the simpler default) and rewrite `demo/notes-blueprint/project.json#modules.identity.package` to `@rntme/identity-auth0`, then rename the vendored copy at `demo/notes-blueprint/node_modules/rntme_identity_auth0/` to `demo/notes-blueprint/node_modules/@rntme/identity-auth0/`. Delete the `rntme_<cat>_<vendor>` alias branch from `workspacePackagePathSegments` (~12 lines). One source of truth for module reference; one less corridor of cleverness in the loader.

- **id:** F050
  - **package(s):** @rntme/blueprint, @rntme/ui, @rntme/bindings, demo/*, apps/platform/blueprint
  - **kind:** dead_strut
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 5
  - **evidence_paths:**
    - demo/cv-extract-blueprint/services/app/bindings/bindings.json:5 — `"pdmRef": "../../../pdm"`
    - demo/notes-blueprint/services/app/bindings/bindings.json:4 — `"pdmRef": "../../pdm"`
    - demo/order-fulfillment-blueprint/services/orders/bindings/bindings.json:4 — `"pdmRef": "../../pdm"`
    - demo/cv-extract-blueprint/services/app/ui/manifest.json:3 — `"pdmRef": "../../../pdm"`
    - demo/notes-blueprint/services/app/ui/manifest.json:3 — `"pdmRef": "../../pdm"`
    - packages/artifacts/bindings/src/types/artifact.ts:49-50 + parse/schema.ts:125-126 — parsed and stored as required strings
    - packages/runtime/runtime/src/load/load-service.ts:224 — `pdmRef: \`${serviceName}.domain.${serviceVersion}\`` — runtime OVERWRITES pdmRef to a synthesized identifier; the authored string is never read
    - grep `pdmRef` across `packages/artifacts/blueprint/src` returns zero hits (loader doesn't follow the ref either)
  - **summary:** Every demo's `bindings.json` and `manifest.json` carries `pdmRef`, `qsmRef`, `graphSpecRef`, `bindingsRef` relative-path strings. Three demos disagree on the path depth — cv-extract uses `../../../pdm`, notes/order-fulfillment use `../../pdm` from the same dir depth — yet all three pass validation, all three deploy, all three test green. Investigation shows the runtime synthesizes its own `pdmRef` (`${serviceName}.domain.${serviceVersion}`) and the blueprint compose step never resolves these paths. Same shape as F045's spec-file lockstep: documentation-only fields that the validator pretends to require. F018 hypothesis (divergent error fidelity) extends here — silently accepting wrong paths and overwriting them is the lowest possible fidelity.
  - **proposed_fix:** Either (a) make the fields optional and stop writing them in `vendor-sync`-style generators, drop them from authored demos, and remove from the schema; or (b) actually resolve them and fail loudly when the path is wrong. (a) is right because the runtime already constructs the correct identifier. Touch points: `packages/artifacts/bindings/src/parse/schema.ts`, `packages/artifacts/ui/src/parse/schema.ts`, all spec.json/manifest.json/bindings.json files. ~30 deletions across 30+ JSON files plus 2 schema edits.

- **id:** F051
  - **package(s):** demo/cv-extract-blueprint, demo/notes-blueprint, demo/order-fulfillment-blueprint
  - **kind:** duplication
  - **severity:** P2
  - **impact:** med
  - **confidence:** med
  - **reversibility:** med
  - **est_effort_h:** 4
  - **evidence_paths:**
    - demo/cv-extract-blueprint/services/app/graphs/getResume.json (2-node graph: `findOne` + `result`)
    - demo/notes-blueprint/services/app/graphs/getNote.json (5-node graph: `call` session + `findMany` + `filter` + `limit` + `result`)
    - demo/order-fulfillment-blueprint/services/orders/graphs/getOrder.json (4-node graph: `findMany` + `filter` + `limit` + `result`)
    - packages/artifacts/graph-ir-compiler/src/types/canonical.ts:16 + src/canonical/normalize.ts:45 — `findOne` is a first-class supported kind
    - demo/cv-extract-blueprint/services/app/qsm/projections/ResumeView.json + demo/notes-blueprint/.../NoteView.json + demo/order-fulfillment-blueprint/.../OrderView.json — all three `entity-mirror` projections with identical 5-line shape and only the entity name + exposed columns differing
  - **summary:** The three demos express the same "get-by-id" semantic in three different graph topologies despite `findOne` being fully supported. notes and order-fulfillment use `findMany` + `filter eq id` + `limit 1`, which compiles to less direct SQL than `findOne`'s where-clause path. cv-extract uses the canonical 2-node form. The longer form looks templatey — order-fulfillment (newest demo) inherited it from notes (legacy). Same with the `entity-mirror` projection — three demos paste a 5-line stub that differs only in entity/exposed-cols.
  - **proposed_fix:** Migrate `getNote.json` and `getOrder.json` to the `findOne` shape used in `getResume.json` (the auth check in notes belongs in middleware, not in the graph — see F042). Consider documenting "canonical CRUD graph shapes" in the cv-extract demo as the reference, and link notes/order-fulfillment back to it. For `entity-mirror` projections, add a `kind: "entity-mirror-default"` shortcut so the projection file degenerates to `{ "kind": "entity-mirror-default", "entity": "Note" }` — currently every demo authors the same boilerplate.

- **id:** F052
  - **package(s):** scripts/vendor-check.mjs, scripts/vendor-sync.mjs
  - **kind:** suboptimal
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 3
  - **evidence_paths:**
    - scripts/vendor-check.mjs (lines 20-54 — `listSourceOfTruthModules` + `listVendoredCopies`; lines 89-109 — only compares `module.json` and `package.json` byte-equality after CRLF normalization)
    - scripts/vendor-sync.mjs (lines 20-54 — identical `listSourceOfTruthModules` + `listVendoredCopies` copy-pasted; lines 90-99 — copies the same files plus `dist/`)
    - F040 (catalog) — `module.json` shape drift between blueprint usage and module manifest exists right now in `apps/platform/ui-module/module.json`; vendor:check would not catch this because (i) `apps/platform/ui-module` isn't a vendored module under `demo/*/node_modules`, and (ii) even if it were, the check is byte-equality not schema-validation
    - F045 / F029 — module manifest semantic drift; vendor:check is silent on missing props
  - **summary:** `vendor-check.mjs` and `vendor-sync.mjs` share ~50 lines of identical helpers (`listSourceOfTruthModules`, `listVendoredCopies`, the dir-name encoder), and only compare byte-equality of `module.json`/`package.json`. They do not validate `module.json` against a schema. So if `apps/platform/ui-module/module.json` is missing props that `components.tsx` actually accepts (F040), or if any vendored copy's `module.json` is structurally invalid, vendor:check passes. The check protects against "vendored copy diverged from source-of-truth" but not "source-of-truth is wrong"; for the audit's manifest-drift hypotheses (F029/F040/F045) this means there is zero CI gate today.
  - **proposed_fix:** Extract a shared `scripts/_vendor-modules.mjs` with the two helpers + dir-name encoder. Add an optional `--validate-manifest` flag (or run it always) that imports `parseModuleManifest` from `@rntme/blueprint` and runs it against each `module.json` it finds. This closes the F029/F040/F045 manifest-drift detection gap with one tool people already run. Alternative: have `bun run build` on each module-package fail if its `module.json` doesn't match its `components.tsx` exports — but that's a much larger TS-type project.

- **id:** F053
  - **package(s):** @rntme/bundle-publish, @rntme/module-scaffold, @rntme/artifact-shared
  - **kind:** duplication
  - **severity:** P3
  - **impact:** low
  - **confidence:** high
  - **reversibility:** high
  - **est_effort_h:** 2
  - **evidence_paths:**
    - packages/tooling/bundle-publish/src/result.ts (3 lines — a standalone `Result<T, E>` algebra with `ok`/`err` helpers)
    - packages/artifacts/_shared/src/result.ts (the workspace-shared Result; F018 already inventoried at least three other Result implementations across the repo)
    - packages/tooling/module-scaffold/src/index.ts (lines 1-3 — exports `VERSION = '0.0.0'` and `exampleHandlers`; the package's only purpose is to provide a single `echo` handler example)
    - packages/tooling/module-scaffold/test/unit/handlers.test.ts (27 lines)
    - packages/tooling/module-scaffold/test/unit/_smoke.test.ts (34 lines — re-tests the same `echo` handler with the same `CommandExecutionContext`)
  - **summary:** Two minor issues in `packages/tooling/`. (1) `bundle-publish` ships its own 3-line `Result<T,E>` instead of importing `@rntme/artifact-shared` — one more replica of the type-algebra duplication F018 already flagged. (2) `module-scaffold` is a one-handler "example" package whose two test files (`handlers.test.ts`, `_smoke.test.ts`) both verify the same `echo` handler's correlation-id propagation and have the same `mkCtx` shape inlined twice; the package's whole `src/` is 19 lines.
  - **proposed_fix:** (1) Replace `bundle-publish/src/result.ts` with `import { ok, err, type Result } from '@rntme/artifact-shared'` and add the dep — closes one F018 instance. (2) Either delete one of the two test files (`_smoke.test.ts` is a strict subset of `handlers.test.ts`) or fold `module-scaffold` into a `docs/examples/handlers.md` example since the entire package is a single async function — it's a 19-line "example" wearing a tsconfig/eslint/build/publish hat.

- **id:** F054
  - **package(s):** demo/cv-extract-blueprint, demo/notes-blueprint, demo/order-fulfillment-blueprint
  - **kind:** architectural
  - **severity:** P2
  - **impact:** med
  - **confidence:** high
  - **reversibility:** med
  - **est_effort_h:** 6
  - **evidence_paths:**
    - demo/cv-extract-blueprint/ — has `package.json`, `tsconfig.json`, `scripts/`, `test/` (composition + landing + smoke + integration + live), `landing/`, vendored `node_modules`
    - demo/notes-blueprint/ — only `pdm/`, `services/`, `project.json`, `README.md`, vendored `node_modules`; no `package.json`, no tests
    - demo/order-fulfillment-blueprint/ — only `pdm/`, `services/`, `workflows/`, `project.json`, `README.md`; no `package.json`, no tests, no vendored `node_modules`
    - package.json line `"demo/*"` workspace pattern — Bun silently skips the two demos without package.json
    - demo/cv-extract-blueprint/test/integration/runtime-readback.test.ts (lines 6-13 — imports `../../../../packages/artifacts/blueprint/src/index.js` directly, four dirs deep; bypasses the workspace `@rntme/blueprint` resolution)
    - demo/cv-extract-blueprint/test/landing-deploy.test.ts (lines 9 — imports `../../../apps/cli/src/bundle/build.js` — demo tests apps/cli internals)
  - **summary:** The three demos sit at three different points of formality: cv-extract is a full workspace package with deep-relative imports into `packages/.../src/index.js` and tests that exercise `apps/cli` internals; notes is a data-only blueprint with vendored modules but no package.json or tests; order-fulfillment is data-only with no vendored modules and no tests at all. There is no documented contract for what a "demo blueprint" is supposed to look like, so the integration coverage is concentrated in one demo while the other two are documentation. cv-extract reaches across four dir levels into `packages/.../src/` rather than using the workspace package, which couples the demo to package internals.
  - **proposed_fix:** Decide what a demo blueprint is. Two coherent endpoints: (a) all three become pure project blueprints (no package.json, no tests; promote cv-extract's integration tests to `packages/runtime/runtime/test/integration/` as canonical end-to-end suites that load the demo dirs); (b) all three become real workspace packages with a shared `@rntme/demo-blueprint-harness` providing `loadAndStart()` so each demo can have its own minimal smoke test. (a) is much smaller and matches the principle that demos are reference material; (b) duplicates harness setup three ways and is the trajectory we're already on with cv-extract. Pick (a). As part of the move, replace deep-relative imports with workspace package names.

## 2_ranking

Ranked merged findings. Score = `(impact * confidence) / risk` where `impact/confidence` ∈ {H=3, M=2, L=1} and `risk` is derived from `reversibility` (H=1, M=2, L=3). Ties broken by (a) more reversible first, (b) lower est_effort_h first.

### Rank #1 — F021 (merged_from: [F021, F029, F053-bundle-publish]) — duplication, P1
- packages: @rntme/artifact-shared, @rntme/contracts-provisioner-v1, @rntme/deploy-core, @rntme/platform-core, @rntme/bundle-publish
- score: 9.00 (impact=H, confidence=H, reversibility=H, est_effort_h=3)
- summary: `Result<T,E>` algebra is independently re-declared in FIVE places (artifact-shared, contracts-provisioner-v1, deploy-core, platform-core, bundle-publish). The provisioner contract even ships a comment apologising for the mirror. Shapes are structurally identical but nominally distinct, so cross-package values are silently re-typed at every seam.
- proposed_fix: Promote type-only `Result`/`Ok`/`Err` into `packages/contracts/_common/v1` (or a new tiny `@rntme/result`). Keep `ok`/`err`/`isOk`/`isErr` helpers in `artifact-shared` and re-export the type from each existing location during the transition. Delete the four duplicate type declarations.
- evidence_paths:
  - packages/contracts/provisioner/v1/src/result.ts
  - packages/deploy/deploy-core/src/result.ts
  - packages/artifacts/_shared/src/result.ts
  - packages/platform/platform-core/src/types/result.ts
  - packages/platform/platform-core/src/index.ts
  - packages/tooling/bundle-publish/src/result.ts
- judge_notes: Highest score (9.0) and lowest effort (3h). Reversible because the type-only definitions are structurally identical so a mass-import rewrite is mechanical. **Run this slice first** — it removes type-friction that subsequent slices (F031, F034, F043, F046) repeatedly hit when threading Result across boundaries. No blocking dependency; F053's bundle-publish line item collapses into this entry.

### Rank #2 — F006 (merged_from: [F006, F011]) — duplication, P1
- packages: @rntme/bindings, @rntme/blueprint, @rntme/runtime
- score: 9.00 (impact=H, confidence=H, reversibility=H, est_effort_h=3)
- summary: The `scalar | list<T> | row<Shape> | rowset<Shape>` type-string parser is reimplemented (with regex) in BOTH `@rntme/blueprint/compose/binding-resolvers.ts` AND `@rntme/runtime/load/load-service.ts`. The two implementations have already drifted: blueprint accepts `array<scalar>` for fields, runtime accepts `list<scalar>` for inputs. `@rntme/bindings` already owns `isScalarPrimitive` — the canonical home is obvious.
- proposed_fix: Move `parseInputType` / `parseFieldType` / `parseOutputType` / `toGraphSignature` into `@rntme/bindings` next to `isScalarPrimitive`, return typed `Result`. Have blueprint and runtime import them. Drop the two regex-based copies.
- evidence_paths:
  - packages/artifacts/bindings/src/types/resolvers.ts
  - packages/artifacts/blueprint/src/compose/binding-resolvers.ts
  - packages/runtime/runtime/src/load/load-service.ts
- judge_notes: Same score as F021 but landing this AFTER F021 lets the canonical parser return a real `Result<GraphSignature, ParseError>`. Standalone slice; high reversibility.

### Rank #3 — F034 — risk, P1
- packages: @rntme/platform-storage, @rntme/platform-core
- score: 9.00 (impact=H, confidence=H, reversibility=H, est_effort_h=1)
- summary: `findStaleRunning` in `pg-deployment-repo` and `pg-project-operation-repo` matches only `status='running'`, so a row stuck in `queued` (worker crash before transition) is never swept; `hasActiveForProject` treats both `queued` and `running` as live, so a forever-queued row blocks all subsequent update/delete operations for that project. Confirms the `rntme_orphan_detect_queued_gap` memory.
- proposed_fix: Change both `findStaleRunning` predicates to `WHERE status IN ('queued','running') AND (...)`. Optionally split into two interface methods with different staleness thresholds. Trivial fix, real correctness bug.
- evidence_paths:
  - packages/platform/platform-storage/src/repos/pg-deployment-repo.ts (lines 312-335)
  - packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts (lines 219-242)
  - packages/platform/platform-core/src/repos/deployment-repo.ts
  - packages/platform/platform-core/src/repos/project-operation-repo.ts
- judge_notes: Highest score with the lowest effort (1h) — must-do. Pure correctness fix; no dependency on other slices. Could run in parallel with F021/F006 (disjoint `allowed_files`).

### Rank #4 — F031 — duplication, P1
- packages: @rntme/platform-storage, apps/platform/blueprint/services/deployments
- score: 9.00 (impact=H, confidence=H, reversibility=H, est_effort_h=3)
- summary: The deployments service handlers (`start-deployment.ts`, `deploy-targets.ts`) hand-roll AES-256-GCM encrypt/decrypt + `PLATFORM_SECRET_ENCRYPTION_KEY` parsing instead of using the canonical `AesGcmSecretCipher` from `@rntme/platform-storage`. Three copies of key parsing, two copies of encrypt, two of decrypt — each with subtly different error codes leaking into API responses.
- proposed_fix: Have both handlers import `AesGcmSecretCipher.fromEnv(process.env)` (or a constructor taking a `Buffer` key). Align error codes. Cross-cuts `rntme_platform_redeploy_secret` memory.
- evidence_paths:
  - packages/platform/platform-storage/src/secret/aes-gcm-cipher.ts
  - apps/platform/blueprint/services/deployments/handlers/start-deployment.ts (lines 537-558)
  - apps/platform/blueprint/services/deployments/handlers/deploy-targets.ts (lines 29, 406-450)
- judge_notes: Sensitive code path (crypto) — Worker must run the deployments smoke test and platform redeploy via `.env` after the swap. Slightly higher risk than its reversibility score suggests because a crypto seam bug would silently corrupt stored secrets — verify by encrypt-then-decrypt round-trip against existing rows.

### Rank #5 — F040 — suboptimal, P1
- packages: @rntme/platform-ui, apps/platform/blueprint
- score: 9.00 (impact=H, confidence=H, reversibility=H, est_effort_h=2)
- summary: `apps/platform/ui-module/module.json` omits ≥7 props that screen specs pass and `components.tsx` actually accepts (`graphHrefTemplate`, `pdmHrefTemplate`, sidebar `items[].{hrefTemplate,matchPattern,section}`, topbar `crumbsFromRoute`, action `hrefTemplate`s, datatable `hrefTemplate/hrefTemplateMap/value`). The manifest is the only published contract; today drift is hidden because the runtime ignores unknown props.
- proposed_fix: Either (a) make `module.json` the source of truth and add a test in `apps/platform/blueprint/test/platform-ui.test.ts` asserting every prop used by any screen spec is declared in the manifest; or (b) drop `module.json#client.components` and rely on TS prop types. Option (a) is the smaller diff and lands the CI gate.
- evidence_paths:
  - apps/platform/ui-module/module.json
  - apps/platform/ui-module/src/components.tsx
  - apps/platform/blueprint/services/app/ui/screens/{api,audit,data-model,deployment,deployments,graph,project-version,ui}.spec.json
  - apps/platform/blueprint/services/app/ui/layouts/main.spec.json
- judge_notes: The drift-detection test is the load-bearing artefact. Pairs with F052 (vendor-check schema validation) — together they close the manifest-drift gate. Run before F041 so a "shared header preset" doesn't silently miss props.

### Rank #6 — F043 — duplication, P1
- packages: @rntme/cli, @rntme/platform-blueprint, @rntme/deploy-runner
- score: 9.00 (impact=H, confidence=H, reversibility=H, est_effort_h=2)
- summary: `resolveBundledProvisioner` + `provisionerKey` + `resolvePackageRoot` + `resolvePackageEntry` + `importProvisioner` are bytewise duplicated between `apps/cli/src/deploy-engine/resolve-provisioner.ts` and `apps/platform/blueprint/services/deployments/handlers/start-deployment.ts`. Two homes for the same `ResolveProvisioner` contract impl from `@rntme/deploy-runner`.
- proposed_fix: Move the shared helpers into `@rntme/deploy-runner` and export `buildResolveProvisioner({ bundleAssetDir?, manifestPath? })`. CLI passes `manifestPath`; runtime handler passes `bundleAssetDir`. Removes the path-safety check (`back === '..' || back.startsWith('../')`) drift.
- evidence_paths:
  - apps/cli/src/deploy-engine/resolve-provisioner.ts (lines 8-65)
  - apps/platform/blueprint/services/deployments/handlers/start-deployment.ts (lines 601-663)
  - packages/deploy/deploy-runner/src/types.ts
- judge_notes: Reduces "two places to land a bundle-resolution fix" to one. Run after F021 so the helper can return the unified `Result`.

### Rank #7 — F022 — suboptimal, P2
- packages: @rntme/contracts-module-v1, @rntme/contracts-marketing-site-v1
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=1)
- summary: Two contract packages in the same workspace declare incompatible zod majors (`^3.24.2` vs `^4.0.0`). Any downstream that imports both will resolve two zod copies with incompatible types/runtimes.
- proposed_fix: Pin a single zod version (workspace catalog or root-level pin). Choose zod 3 since module/v1 has the larger refinement surface (402 LoC vs 64). Back-port marketing-site.
- evidence_paths:
  - packages/contracts/module/v1/package.json (line 32)
  - packages/contracts/marketing-site/v1/package.json (line ~30)
  - packages/contracts/module/v1/src/manifest-shape.ts
  - packages/contracts/marketing-site/v1/src/schema.ts
- judge_notes: 1h fix with high impact across consumers. Should run early to avoid any later slice (F040, F052) typing against the wrong zod version.

### Rank #8 — F033 — duplication, P2
- packages: @rntme/platform-storage
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=1)
- summary: `withOptionalTransaction` and `withSystemRlsDisabled` are reimplemented locally inside three repos (4 copies total) despite `pg/tx.ts` already exposing the canonical `withTransaction`. The two `withSystemRlsDisabled` copies even use different `SET LOCAL row_security = off` vs `SET row_security = off` — same correctness bug split across files.
- proposed_fix: Move both helpers into `pg/tx.ts`. Standardise on `SET LOCAL` (safer — resets on tx end). Import from three repo sites.
- evidence_paths:
  - packages/platform/platform-storage/src/repos/pg-deployment-repo.ts (lines 523-575)
  - packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts (~line 392)
  - packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts (~line 318)
  - packages/platform/platform-storage/src/pg/tx.ts
- judge_notes: Independent of all other slices. Cheap. Catches a real RLS-scope bug, not just dedup. Run before F032 (Drizzle migration) so the Drizzle repos converge onto the unified helper.

### Rank #9 — F030 — dead_strut, P2
- packages: @rntme/platform-core, @rntme/platform-storage
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=2)
- summary: `platform-core/src/deploy-adapter/` (DeployAdapter, DeployAdapterInput, DeployAdapterResult, DeployAdapterSuccess, DeployAdapterFailure, DeployAdapterLogLine, createFakeDeployAdapter) has zero consumers outside its own dir + the barrel. The "internal seam" was superseded by `RunDeploymentInputs` in `@rntme/deploy-runner`.
- proposed_fix: Delete `packages/platform/platform-core/src/deploy-adapter/` and its 6 export lines in `index.ts`. Remove the matching paragraph from `docs/current/owners/packages/platform/platform-core.md`.
- evidence_paths:
  - packages/platform/platform-core/src/deploy-adapter/seam.ts
  - packages/platform/platform-core/src/deploy-adapter/fake.ts
  - packages/platform/platform-core/src/index.ts (lines 59-66)
  - docs/current/owners/packages/platform/platform-core.md (lines 30-35)
- judge_notes: Pure deletion. Cleaner once F021 lands (the deleted types reference `Result`). Run in parallel with F033 — disjoint `allowed_files`.

### Rank #10 — F037 — suboptimal, P2
- packages: @rntme/deploy-dokploy
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=4)
- summary: Compose YAML and nginx config are both built by string concatenation with ad-hoc escaping (`yamlScalar` uses a single regex sentinel for "needs JSON-quoting"). ~1.4K LoC of stringly-typed rendering. Volume sources containing commas or env values with single quotes that happen to match the regex can silently emit invalid YAML/nginx; only golden-file tests guard against it.
- proposed_fix: (a) Compose — emit an object then serialize with the `yaml` npm package at the boundary. (b) nginx — keep the structural `RenderedNginxConfig` already half-built and use a typed builder yielding lines, not `lines.push()` everywhere.
- evidence_paths:
  - packages/deploy/deploy-dokploy/src/compose-yaml.ts
  - packages/deploy/deploy-dokploy/src/nginx.ts
  - packages/deploy/deploy-dokploy/src/render.ts
  - packages/deploy/deploy-dokploy/src/apply.ts
- judge_notes: Deploy-affecting — Worker must run Dokploy redeploy smoke via repo `.env` after the swap. Higher than its score suggests because it removes a class of silent-corruption bugs. 4h is the heaviest "fits in tranche" slice; consider deferring if budget gets tight.

### Rank #11 — F044 — duplication, P2
- packages: @rntme/cli
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=1)
- summary: `watchUntilTerminal` (deployment) and `watchProjectOperationUntilTerminal` (project operation) are the same polling loop reimplemented twice with their own `sleep` helpers, `TERMINAL` sentinels, and log-cursor bookkeeping.
- proposed_fix: Extract `pollUntilTerminal<T>({ show, logs, isTerminal, printLog })` into `apps/cli/src/commands/poll-until-terminal.ts`. Both watchers become 5-line adapters. Move `sleep` into `apps/cli/src/util/sleep.ts`.
- evidence_paths:
  - apps/cli/src/commands/project/deployment-watch.ts
  - apps/cli/src/commands/project/operation-watch.ts
- judge_notes: Cheap, fully reversible. Independent of all other slices. Good "fits in remaining budget" candidate.

### Rank #12 — F046 — suboptimal, P2
- packages: @rntme/cli
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=1)
- summary: `apps/cli/src/commands/project/publish.ts` collapses `composed.errors[]` (structured per-artifact validation failures) into a semicolon-joined one-liner; structured payload preservation in JSON output is incidental. Same shape in `load-blueprint.ts` for `rntme deploy`. Matches `rntme_cli_dist_silent_stale` memory.
- proposed_fix: Keep the full `composed.errors[]` on the `CliError.cause` slot and add a `--verbose`-aware renderer in `apps/cli/src/output/format.ts` that prints each error's `code`, `message`, `artifactPath`.
- evidence_paths:
  - apps/cli/src/commands/project/publish.ts (lines 51-61)
  - apps/cli/src/deploy-engine/load-blueprint.ts (lines 26-32)
  - apps/cli/src/output/format.ts
- judge_notes: 1h. Fixes a real operator-facing usability bug (publish failures are unreadable today). Run after F021 so the error array can carry a typed Result.

### Rank #13 — F023 — suboptimal, P2
- packages: @rntme/contracts-ai-llm-v1, -storage-v1, -identity-v1, -crm-v1, -marketing-site-v1
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=3)
- summary: Five canonical contracts ship divergent `error-codes.ts` shapes — (a) ai-llm/storage have `ErrorCode/ErrorLayer/isErrorCode/layerOf` helpers; (b) identity/crm use prefixed names with no helpers; (c) marketing-site uses entirely different layer taxonomy (`validate`/`provision`). Storage adds a 6th layer.
- proposed_fix: Define `buildErrorCodesApi(layers)` in `@rntme/contracts-common-v1` and have each contract's `error-codes.ts` become a 5-line wrapper. Standardise the layer taxonomy.
- evidence_paths:
  - packages/contracts/ai-llm/v1/src/error-codes.ts
  - packages/contracts/storage/v1/src/error-codes.ts
  - packages/contracts/identity/v1/src/error-codes.ts
  - packages/contracts/crm/v1/src/error-codes.ts
  - packages/contracts/marketing-site/v1/src/error-codes.ts
- judge_notes: Forces parity across canonical contracts. Independent of seam slices. Pairs naturally with F024 (proto-gen extraction) — same `_common` move.

### Rank #14 — F024 — duplication, P2
- packages: @rntme/contracts-ai-llm-v1, -storage-v1, -identity-v1, -crm-v1
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=2)
- summary: 4 (or 5 including _common) `scripts/gen.mjs` proto-generation scripts diff by ≤3 lines. Each rebuilds an isolated `proto-deps/` symlink tree, runs pbjs/pbts, post-processes ESM imports.
- proposed_fix: Extract `packages/contracts/_shared/build-proto.mjs` taking `{ entry, namespaceDir, depsSymlinks }`. Each contract's `gen.mjs` becomes a 5-line invocation.
- evidence_paths:
  - packages/contracts/ai-llm/v1/scripts/gen.mjs
  - packages/contracts/identity/v1/scripts/gen.mjs
  - packages/contracts/storage/v1/scripts/gen.mjs
  - packages/contracts/crm/v1/scripts/gen.mjs
- judge_notes: Independent. Reversible. Pairs with F023 — same `_common` extraction motif. Run after F022 (zod pin) so the build doesn't fight a major-version mismatch.

### Rank #15 — F041 — duplication, P2
- packages: apps/platform/blueprint (services/app/ui/screens)
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=3)
- summary: Four artifact-explorer screens (`data-model`, `api`, `ui`, `graph`) each redeclare the same `PlatformPageHeader` with "Back + 3 sibling tabs" actions and the same `/data/summary` binding. Same actions also stamped on `project.spec.json`. Adding a 5th explorer or renaming a route is a 5-file lockstep edit.
- proposed_fix: Either (a) per-project screen-partial `$ref` mechanism, or (b) extend `module.json#presets` so `PlatformExplorerHeader { eyebrow, title, currentTab }` expands at compose time. (b) matches existing `service-card` preset convention.
- evidence_paths:
  - apps/platform/blueprint/services/app/ui/screens/data-model.spec.json
  - apps/platform/blueprint/services/app/ui/screens/api.spec.json
  - apps/platform/blueprint/services/app/ui/screens/ui.spec.json
  - apps/platform/blueprint/services/app/ui/screens/graph.spec.json
  - apps/platform/blueprint/services/app/ui/screens/project.spec.json
  - apps/platform/ui-module/module.json (presets section)
- judge_notes: Run **after** F040 (so the manifest gate catches preset prop drift) and ideally after F039 (so the `PlatformExplorerShell` and the preset header land together).

### Rank #16 — F049 — duplication, P2
- packages: @rntme/blueprint, demo/cv-extract-blueprint, demo/notes-blueprint, demo/order-fulfillment-blueprint
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=6)
- summary: Demos disagree on `project.json#modules.<key>.package` spelling — cv-extract uses canonical scoped names (`@rntme/ai-llm-openrouter`), notes uses snake_case dir-alias (`rntme_identity_auth0`). Both work because `@rntme/blueprint`'s `workspacePackagePathSegments` carries an entire alias regex branch.
- proposed_fix: Pick canonical scoped names. Rewrite `demo/notes-blueprint/project.json` and rename the vendored copy at `demo/notes-blueprint/node_modules/rntme_identity_auth0/` to `demo/notes-blueprint/node_modules/@rntme/identity-auth0/`. Delete the alias branch from `workspacePackagePathSegments`.
- evidence_paths:
  - demo/cv-extract-blueprint/project.json (lines 9, 16, 24)
  - demo/notes-blueprint/project.json (line 12)
  - packages/artifacts/blueprint/src/compose/modules.ts (lines 209-226)
- judge_notes: Borderline-rename, but the payoff is real (deletes a regex-branch in the loader). Goal's likely_misfire applies to **pure** renames; this also removes loader code. Keep in ranked list.

### Rank #17 — F050 — dead_strut, P2
- packages: @rntme/blueprint, @rntme/ui, @rntme/bindings, demo/*, apps/platform/blueprint
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=5)
- summary: Every demo's `bindings.json`/`manifest.json` carries `pdmRef`/`qsmRef`/`graphSpecRef`/`bindingsRef` relative-path strings. Three demos disagree on path depth, all pass validation, all deploy. Runtime synthesises `pdmRef = ${serviceName}.domain.${serviceVersion}` and never reads the authored value; the blueprint compose step doesn't resolve the paths either.
- proposed_fix: Make the fields optional, drop them from authored demos and spec.json/manifest.json files, remove from schemas. (~30 deletions across JSON files + 2 schema edits.)
- evidence_paths:
  - demo/cv-extract-blueprint/services/app/bindings/bindings.json:5
  - demo/notes-blueprint/services/app/bindings/bindings.json:4
  - demo/order-fulfillment-blueprint/services/orders/bindings/bindings.json:4
  - packages/artifacts/bindings/src/parse/schema.ts:125-126
  - packages/runtime/runtime/src/load/load-service.ts:224
- judge_notes: Mechanical but architecturally meaningful — removes documentation-only fields the validator pretends to enforce. Run after F018 (uniform parse helpers) so schema deletions propagate cleanly.

### Rank #18 — F052 — suboptimal, P2
- packages: scripts/vendor-check.mjs, scripts/vendor-sync.mjs
- score: 6.00 (impact=M, confidence=H, reversibility=H, est_effort_h=3)
- summary: `vendor-check.mjs` and `vendor-sync.mjs` share ~50 lines of identical helpers and only compare byte-equality. No `module.json` schema validation, so manifest drift (F040, F029, F045) is uncaught by CI.
- proposed_fix: Extract shared `scripts/_vendor-modules.mjs`. Add a `--validate-manifest` flag (or run it always) that imports `parseModuleManifest` from `@rntme/blueprint` (after fixing the schema) and validates each `module.json`.
- evidence_paths:
  - scripts/vendor-check.mjs (lines 20-54, 89-109)
  - scripts/vendor-sync.mjs (lines 20-54, 90-99)
  - packages/contracts/module/v1/src/manifest-shape.ts
- judge_notes: This is the CI gate that closes the F040 drift hypothesis. Run AFTER F040 (so the schema reflects reality) — otherwise the gate fails on existing manifests.

### Rank #19 — F001 (merged_from: [F001, F014, F026]) — architectural, P1
- packages: @rntme/bindings-http, @rntme/bindings-grpc, @rntme/runtime, @rntme/graph-ir-compiler, @rntme/contracts-handlers-v1
- score: 4.50 (impact=H, confidence=H, reversibility=M, est_effort_h=6)
- summary: The `OperationExecutor` seam lives in `@rntme/bindings-http` (deep export `/operation-contract`) but every type it references (`OperationExecutionContext`, `OperationResult`, `CompiledOperation`) is owned by `@rntme/graph-ir-compiler` and the canonical impl `executeOperation` is also there. As a consequence `bindings-grpc` declares a workspace dep on `bindings-http` for a 21-line type file, and gRPC-only stacks must ship the entire Hono runtime. `contracts-handlers-v1` even carries a phantom `bindings-http` devDep — suspected leftover from an abandoned move attempt.
- proposed_fix: Promote `OperationExecutor` (+ Input/Output/Error) into `@rntme/graph-ir-compiler/operation` next to `executeOperation`. Re-export from there. Remove the `@rntme/bindings-http/operation-contract` deep export and the `@rntme/bindings-http` devDep from `contracts-handlers-v1`.
- evidence_paths:
  - packages/runtime/bindings-http/src/operation-contract.ts
  - packages/runtime/bindings-http/package.json
  - packages/runtime/bindings-grpc/src/server/{handler,errors}.ts
  - packages/runtime/bindings-grpc/src/types.ts
  - packages/runtime/runtime/src/plugins/{http-surface,grpc-surface}.ts
  - packages/runtime/runtime/src/plugins/executors/{graph-operation-executor,native-operation-executor}.ts
  - packages/artifacts/graph-ir-compiler/src/types/operation.ts
  - packages/artifacts/graph-ir-compiler/src/operation/execute.ts
  - packages/contracts/handlers/v1/package.json (line 34 phantom devDep)
- judge_notes: Highest-value seam relocation. Reversibility is **medium** because consumers reach via deep-export paths that must all rewrite together (15+ call sites). Sequence: land AFTER F021 (Result first). UNBLOCKS F003 (gRPC codec dedup) by removing the cross-package `bindings-http→bindings-grpc` edge.

### Rank #20 — F012 — architectural, P1
- packages: @rntme/graph-ir-compiler, @rntme/seed, @rntme/event-store
- score: 4.50 (impact=H, confidence=H, reversibility=M, est_effort_h=4)
- summary: `graph-ir-compiler` and `seed` directly import `EventStore`, `SqliteDatabase`, `EventEnvelope` from runtime packages despite the depcruise rule `artifacts-must-not-import-runtime` explicitly forbidding it. Either the rule is silently bypassed or the build is misconfigured. The `command-runtime/`, `operation/execute.ts`, and `seed/apply.ts` directories are runtime code wearing an artifact hat.
- proposed_fix: Move `graph-ir-compiler/{command-runtime,operation/execute,execute,operation/local-read}` and `seed/{apply,bin/cli}` into a new `@rntme/runtime-graph` (or fold into `@rntme/runtime`). Keep compile-side artifact-pure. Or hoist the canonical `EventEnvelope`/`SqliteDatabase` shapes into `packages/contracts/` (SQLite-forever per `rntme_turso_target` memory).
- evidence_paths:
  - .dependency-cruiser.cjs
  - packages/artifacts/graph-ir-compiler/src/types/operation.ts
  - packages/artifacts/graph-ir-compiler/src/command-runtime/replay.ts
  - packages/artifacts/graph-ir-compiler/src/operation/execute.ts
  - packages/artifacts/graph-ir-compiler/src/{execute/execute,operation/local-read}.ts
  - packages/artifacts/seed/src/{types,validate,wrap-payloads,apply}.ts
- judge_notes: First confirm depcruise is actually running and the rule is enforced (Scout T003 receipt notes the rule may be silently bypassed). UNBLOCKS F015 (seed-vs-graph-ir replay dedup) — both must live in the new home together.

### Rank #21 — F013 — duplication, P1
- packages: @rntme/blueprint, @rntme/graph-ir-compiler
- score: 4.50 (impact=H, confidence=H, reversibility=M, est_effort_h=5)
- summary: Blueprint validates per-graph JSON with hand-rolled `isRecord`/`isValidGraph` predicates that throw bare strings, then re-parses to compute `GraphSignature`. Meanwhile `@rntme/graph-ir-compiler` exports `parseAuthoringSpec` + `AuthoringSpecSchema` covering exactly the same shape. Two parsers for one IR.
- proposed_fix: Have `service-graphs.ts` call `parseAuthoringSpec`; drop `isValidGraph`/`isInputMode`/`isValidShapes`. Derive `GraphSignature` from canonical parsed shape (or expose `toGraphSignature` from graph-ir-compiler).
- evidence_paths:
  - packages/artifacts/blueprint/src/compose/service-graphs.ts (lines 12-65)
  - packages/artifacts/blueprint/src/compose/binding-resolvers.ts (lines 75-158)
  - packages/artifacts/graph-ir-compiler/src/parse/schema.ts
  - packages/artifacts/graph-ir-compiler/src/parse/parse.ts
- judge_notes: Pairs with F006 (both touch binding-resolvers.ts). Order: F006 first (extracts the type-string parser), then F013 (replaces the JSON-walk validator with `parseAuthoringSpec`). Reversibility is medium because blueprint test fixtures will need updating to typed parse errors.

### Rank #22 — F016 — architectural, P1
- packages: @rntme/blueprint, @rntme/platform-core
- score: 4.50 (impact=H, confidence=H, reversibility=M, est_effort_h=2)
- summary: `@rntme/blueprint` imports `CanonicalBundle` from `@rntme/platform-core` and re-exports it. Layering goes the wrong way (platform consumes artifacts to assemble bundles, not vice versa). The re-export hides the inversion but the dep edge is still there.
- proposed_fix: Move `CanonicalBundle`'s definition into `@rntme/blueprint` (it describes a materialized blueprint — blueprint vocabulary) or into a `packages/contracts/blueprint-bundle` contract. Have `@rntme/platform-core` import from there.
- evidence_paths:
  - packages/artifacts/blueprint/src/load/materialize.ts (line 5)
  - packages/artifacts/blueprint/src/load/materialize-and-compose.ts (line 2)
  - packages/artifacts/blueprint/src/index.ts (line 33)
  - .dependency-cruiser.cjs
- judge_notes: 2h architectural fix. UNBLOCKS F038 (platform-specific persistence move) — both touch how `ComposedBlueprint`/`CanonicalBundle` is shaped. Run after F012 to keep the layering-fix slices coherent.

### Rank #23 — F020 — architectural, P1
- packages: @rntme/contracts-client-runtime-v1
- score: 4.50 (impact=H, confidence=H, reversibility=M, est_effort_h=4)
- summary: `@rntme/contracts-client-runtime-v1` is not a contract — it ships factory functions (`createOperationRegistry`, `createLifecycleBus`, `createTransportChain`, `createModuleBootContext`), React Context + hooks, a route matcher, and depends on `react` + `@json-render/core`. Every vendor module pulls React in just to declare types.
- proposed_fix: Split into (a) types-only `@rntme/contracts-client-runtime-v1` (no react/json-render deps); (b) `@rntme/client-runtime` (or fold into `@rntme/ui-runtime`) for factories/hooks/providers.
- evidence_paths:
  - packages/contracts/client-runtime/v1/src/operation-registry.ts
  - packages/contracts/client-runtime/v1/src/lifecycle-bus.ts
  - packages/contracts/client-runtime/v1/src/transport-chain.ts
  - packages/contracts/client-runtime/v1/src/hooks.ts
  - packages/contracts/client-runtime/v1/src/visibility.ts
  - packages/contracts/client-runtime/v1/src/router.ts
  - packages/contracts/client-runtime/v1/src/module-context.ts
  - packages/contracts/client-runtime/v1/package.json (lines 30-34)
- judge_notes: Medium reversibility because every vendor module's package.json must update. Worth doing but downstream slices (F040, F041) don't block on it. Run AFTER F022 (zod pin) so the new package starts on the chosen major.

### Rank #24 — F032 — suboptimal, P1
- packages: @rntme/platform-storage
- score: 4.50 (impact=H, confidence=H, reversibility=M, est_effort_h=6)
- summary: Schema is declared with Drizzle (`pgTable`/`pgEnum`), but only 4/12 repos use the Drizzle query builder. The other 8 — including the highest-traffic `pg-deployment-repo` and `pg-project-operation-repo` — hand-write SQL with `$1`/`$2` params and bespoke `rowToX` mappers. Two idioms in one package; schema changes need applying twice.
- proposed_fix: Pick one idiom. Port raw-SQL repos to Drizzle's query builder (`db.select().from(deployment).where(...)`). Drop `DbRow` casts.
- evidence_paths:
  - packages/platform/platform-storage/src/schema/*.ts
  - packages/platform/platform-storage/src/repos/pg-deployment-repo.ts (14 raw queries)
  - packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts
  - packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts
  - packages/platform/platform-storage/src/repos/pg-project-version-repo.ts
  - packages/platform/platform-storage/src/repos/pg-outbox-repo.ts
- judge_notes: Heaviest 6h slice. Run AFTER F033 (transaction helpers consolidated) and AFTER F034 (orphan query fixed first — easier in raw SQL than in mid-migration Drizzle).

### Rank #25 — F036 — architectural, P1
- packages: @rntme/deploy-bundle-input, @rntme/bindings-grpc, @rntme/ui-runtime, packages/contracts/*/v1
- score: 4.50 (impact=H, confidence=H, reversibility=M, est_effort_h=4)
- summary: `deploy-bundle-input` walks the workspace filesystem at runtime via two independent `findWorkspaceRoot` helpers to read proto sources and `ui-runtime/build/main.css`, and hard-codes `category → proto path` mapping. It also depends on `@rntme/bindings-grpc` (runtime package) just for `emitProto`. Bundling is order-dependent on `bun run build` and cannot run inside a deployed container.
- proposed_fix: (1) Ship contract protos via `package.json#exports`; resolve through `createRequire`/`import.meta.resolve`. (2) Replace `contractProtoForModuleKey` with a lookup via `module.json#category`. (3) Have `ui-runtime` publish CSS via package exports. (4) Move `emitProto` into a tiny `@rntme/proto-emitter`.
- evidence_paths:
  - packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts (lines 6, 818-845)
  - packages/platform/deploy-bundle-input/src/contract-protos.ts (lines 19-24, 73-88)
  - packages/platform/deploy-bundle-input/src/runtime-module-wiring.ts (lines 158-174)
  - packages/platform/deploy-bundle-input/package.json
- judge_notes: Deploy-affecting — Worker must include a Dokploy smoke. Run AFTER F040+F052 (manifest source-of-truth) and AFTER F038 (platform persistence move) so the special-cases are gone first.

### Rank #26 — F039 — architectural, P1
- packages: @rntme/platform-ui
- score: 4.50 (impact=H, confidence=H, reversibility=M, est_effort_h=8)
- summary: `apps/platform/ui-module/src/components.tsx` is 3746 LoC in one file with ~25 components plus dozens of internal `render*` sub-functions. Two large explorers (`PlatformDataModelExplorer`, `PlatformAPIExplorer`) reimplement the same "left tree with filter + search + selected detail + side-sheet" twice with no shared abstraction. 50 hook calls of `useState`/`useEffect`/`useMemo` per-component.
- proposed_fix: Split into one file per top-level component. Extract `useExplorerState({rows, query, selected, sheet})` + `PlatformExplorerShell` slot layout. Move helpers into `internal/util.ts`.
- evidence_paths:
  - apps/platform/ui-module/src/components.tsx (entire file)
- judge_notes: Largest slice (8h). Run AFTER F040 (manifest gate) so the file-split doesn't silently lose prop declarations. UNBLOCKS F041 (shared explorer header preset). Mostly mechanical but big — may need to be split into two worker slices (split-files first, extract-hook second).

### Rank #27 — F003 — duplication, P1
- packages: @rntme/bindings-grpc, @rntme/bpmn-worker
- score: 3.00 (impact=M, confidence=H, reversibility=H, est_effort_h=3)
- summary: bpmn-worker copies the proto-identifier helpers, JSON↔Struct codec, and ServiceDefinition builder from bindings-grpc. Three independent reimplementations of the same "talk Struct over grpc-js" capability.
- proposed_fix: Extract `@rntme/grpc-codec` (or fold into a future `@rntme/runtime-grpc`) housing `sanitizeToProtoIdent`/`toSnakeCase`/`bindingIdToRpcName`, `jsonToStruct`/`structToJson`, `buildServiceDefinition`. Replace three call sites.
- evidence_paths:
  - packages/runtime/bindings-grpc/src/emit/ids.ts (lines 1-27)
  - packages/runtime/bpmn-worker/src/command-client.ts (lines 96-204)
  - packages/runtime/bindings-grpc/src/server/handler.ts (lines 89-116)
  - packages/runtime/bindings-grpc/src/server/create-server.ts (lines 8-29)
- judge_notes: UNBLOCKED by F001 (once `bindings-http` is no longer the de facto runtime-http home, splitting out grpc-codec is cleaner). Run after F001.

### Rank #28 — F015 — duplication, P2
- packages: @rntme/seed, @rntme/graph-ir-compiler
- score: 3.00 (impact=M, confidence=H, reversibility=M, est_effort_h=3)
- summary: Seed and graph-ir-compiler each maintain their own `replayState`, `checkTransitionLegal`, and `{before, after}` envelope builder. Drift: seed treats null/missing fields differently from `derivePayload`.
- proposed_fix: Extract canonical helpers (`replayState`, `checkTransition`, `buildBeforeAfterPayload`) to one owner (most naturally `graph-ir-compiler/command-runtime`). Pairs with F012's move.
- evidence_paths:
  - packages/artifacts/seed/src/wrap-payloads.ts (lines 17-43)
  - packages/artifacts/graph-ir-compiler/src/emit/payload.ts (lines 44-64)
  - packages/artifacts/seed/src/validate.ts (lines 194-248)
  - packages/artifacts/graph-ir-compiler/src/command-runtime/{replay,transition}.ts
- judge_notes: Blocked-by F012 (the new runtime-graph home). Land together for cleanest history.

### Rank #29 — F035 — duplication, P2
- packages: @rntme/deploy-runner, @rntme/platform-core, @rntme/deploy-dokploy
- score: 3.00 (impact=M, confidence=H, reversibility=M, est_effort_h=3)
- summary: `deploy-runner/src/deploy-target-types.ts` is a 190-LoC structural mirror of platform-core's `DeployTarget` family, opening with a "intentionally kept import-free" comment that is stale — the package.json already declares the dep and handlers/glue already import platform-core directly.
- proposed_fix: (a) Accept the dep in the pure layer and delete `deploy-target-types.ts` + `dokploy-client-factory.ts` mirrors, OR (b) move shared types into `@rntme/contracts-deploy-target-v1`. (a) is simpler given the runner already imports platform-core.
- evidence_paths:
  - packages/deploy/deploy-runner/src/deploy-target-types.ts
  - packages/deploy/deploy-runner/src/dokploy-client-factory.ts (lines 18-44)
  - packages/deploy/deploy-runner/package.json
- judge_notes: Independent. Run after F021 so `Result`-typing in the mirror is identical when deleted.

### Rank #30 — F038 — architectural, P2
- packages: @rntme/deploy-bundle-input
- score: 3.00 (impact=M, confidence=H, reversibility=M, est_effort_h=2)
- summary: `deploy-bundle-input` special-cases `projectName === 'rntme-platform'` and three specific service slugs by name to inject volume + SQLite paths. Any other project named `rntme-platform` would inherit the layout accidentally. The persistence shape is already in `ComposedProjectService.persistence`.
- proposed_fix: Move persistence into the platform blueprint's service-level JSON (extend `service.spec.json` or add `persistence.json`). Have `@rntme/blueprint` carry it through `ComposedBlueprint`. Delete `platformServicePersistence`.
- evidence_paths:
  - packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts (lines 132-155)
  - apps/platform/blueprint/services/{tokens,projects,deployments}/
  - docs/current/owners/packages/platform/deploy-bundle-input.md
- judge_notes: Blocked-by F016 (blueprint→platform-core re-layering) so `ComposedBlueprint` is the canonical home. Then unblocks F036 (deploy-bundle-input cleanup).

### Rank #31 — F042 — duplication, P2
- packages: apps/platform/blueprint
- score: 3.00 (impact=M, confidence=H, reversibility=M, est_effort_h=2)
- summary: Every authenticated binding in every platform service declares the same 3-header `inputFrom.{authorization,sessionSubject,sessionStatus}` block. ~30 bindings × 3 fields. Adding a 4th forwarded header (planned: `X-Rntme-User-Audience`) is a ~30-file edit.
- proposed_fix: Add binding-level macro `inputFrom: { $extends: "platform-session-headers" }` resolved at compose-time, OR collapse session-forwarding into the mount middleware (`mounts[].use: ["requestContext","auth"]` already knows the headers). Operations should consume `session: {subject?, status?, audience?}` as one object.
- evidence_paths:
  - apps/platform/blueprint/services/{deployments,projects,audit,organizations,tokens}/bindings/bindings.json
  - apps/platform/blueprint/services/*/operations.json
- judge_notes: Touches the @rntme/blueprint compose layer (new $extends primitive). Run after F013 (parseAuthoringSpec adoption) so the extends primitive lives next to a clean parser.

### Rank #32 — F027 — architectural, P2
- packages: @rntme/contracts-module-v1, @rntme/contracts-marketing-site-v1
- score: 3.00 (impact=M, confidence=H, reversibility=M, est_effort_h=3)
- summary: Two contracts ship not just schema but also `parse*`/`validate*` + issue-mapping logic. `manifest-shape.ts` (402 LoC) is mostly cross-field business consistency checks. ai-llm/storage/identity/crm are pure types/proto — asymmetric.
- proposed_fix: Split each into `src/schema.ts` (zod schemas only) + `src/validate.ts` (refinements + parse helpers). Consider moving the validate layer into consuming packages. Establish rule: "contracts ship types + schemas; validators live in consumers."
- evidence_paths:
  - packages/contracts/module/v1/src/manifest-shape.ts
  - packages/contracts/marketing-site/v1/src/index.ts (lines 34-55)
  - packages/contracts/marketing-site/v1/src/schema.ts
  - packages/contracts/module/v1/src/index.ts
- judge_notes: Run after F022 (zod pin) and F040 (manifest source-of-truth fix). Reversibility is medium because every consumer of `parseModuleManifest` must rewire.

### Rank #33 — F002 — architectural, P1
- packages: @rntme/runtime
- score: 4.50 (impact=H, confidence=H, reversibility=M, est_effort_h=6)
- summary: `Surface.mount(app, ctx)` is promised as the lifecycle entry, but `GrpcSurface.mount` is `/* no-op */`; the contract test certifies the no-op. gRPC is spun up via parallel `buildGrpcSurface` factory after `serve()`. Half-strategy adds noise without extensibility.
- proposed_fix: Either split `Surface` into `HttpMount` (Hono-only) and `Listener` (own port + listen/stop) so each protocol implements only what it needs, OR fold gRPC startup into start-service as an explicit step and delete `GrpcSurface implements Surface`.
- evidence_paths:
  - packages/runtime/runtime/src/plugins/interfaces.ts (lines 37-40)
  - packages/runtime/runtime/src/plugins/grpc-surface.ts (lines 23-25)
  - packages/runtime/runtime/src/start/start-service.ts (lines 147-194)
  - packages/runtime/runtime/src/plugins/contract-tests.ts (lines 112-119)
  - packages/runtime/runtime/src/start/build-grpc-surface.ts
- judge_notes: Should rank higher by score (4.5/6h) but the slice is tangled with F001/F003 — the gRPC surface seam needs to settle before this gets cut. Run AFTER F001+F003.

### Rank #34 — F005 — architectural, P2
- packages: @rntme/bindings-http, @rntme/runtime
- score: 3.00 (impact=M, confidence=H, reversibility=M, est_effort_h=2)
- summary: `@rntme/bindings-http` hosts every generic Hono middleware (requestId, requestLogger, errorHandler, cors, bodyLimit, rateLimit, securityHeaders, sameOriginOnly) plus `InMemoryRateLimiter`. With F001's operation contract, the package is de facto runtime-http — every HTTP consumer pulls it in even when not parsing/serving binding artifacts.
- proposed_fix: Move middleware modules + `InMemoryRateLimiter` to `@rntme/runtime` (or new `@rntme/runtime-http`). Keep `bindings-http` focused on `createBindingsRouter` + operation handler that actually depend on `ValidatedBindings`.
- evidence_paths:
  - packages/runtime/bindings-http/src/middleware/index.ts
  - packages/runtime/bindings-http/src/middleware/*.ts
  - packages/runtime/runtime/src/plugins/http-surface.ts (lines 3-15)
  - docs/current/owners/packages/runtime/bindings-http.md
- judge_notes: Blocked-by F001 — move middleware only after operation-contract has left `bindings-http`. Together they make `bindings-http` actually be "HTTP bindings only".

### Rank #35 — F009 — duplication, P2
- packages: @rntme/runtime, @rntme/projection-consumer
- score: 3.00 (impact=M, confidence=H, reversibility=H, est_effort_h=2)
- summary: Two in-memory Kafka adapters. Both implement `KafkaConsumer` async-iterator; `InMemoryBus` additionally round-trips every produced message through `toCloudEventWire`→`fromCloudEventWire` despite never leaving the process. "What counts as a partition?" diverges between them.
- proposed_fix: Have `InMemoryBus` build on `createInMemoryKafkaConsumer` (one consumer per `bus.consumer(...)` call). Drop the CE wire round-trip for in-process delivery.
- evidence_paths:
  - packages/runtime/projection-consumer/src/kafka/in-memory.ts (lines 25-73)
  - packages/runtime/runtime/src/plugins/in-memory-bus.ts (lines 16-105)
- judge_notes: Independent. 2h.

### Rank #36 — F010 — duplication, P3
- packages: @rntme/bpmn-worker, @rntme/runtime
- score: 3.00 (impact=L, confidence=H, reversibility=H, est_effort_h=2)
- summary: `bpmn-worker/src/env.ts` parses `RNTME_EVENT_BUS_*` independently from `runtime/src/start/runtime-env.ts`. bpmn-worker version is a strict subset and silently fails when operator sets `sasl_ssl` (returns plaintext-equivalent). bpmn-worker also rolls its own kafkajs client instead of reusing `KafkaJsEventBus`.
- proposed_fix: Extract `runtime-event-bus-env` helper OR move bpmn-worker onto `KafkaJsEventBus` + `buildKafkaJsClientConfigFromEnv`.
- evidence_paths:
  - packages/runtime/bpmn-worker/src/env.ts
  - packages/runtime/runtime/src/start/runtime-env.ts (lines 76-148)
  - packages/runtime/bpmn-worker/src/kafka-consumer.ts (lines 27-78)
- judge_notes: Production risk (silent SASL fallback) but low confidence in customer impact today. Pair-with F004 (bpmn-worker dual dispatch).

### Rank #37 — F004 — duplication, P2
- packages: @rntme/bpmn-worker
- score: 3.00 (impact=M, confidence=H, reversibility=H, est_effort_h=3)
- summary: `runWorkflowEventOnce` (Kafka-driven) and `runPollOnce` (Operaton-poll) are the same task-dispatch loop with subtle drift. `runPollOnce` only handles native tasks and emits `WORKFLOW_TASK_HANDLER_MISSING` for everything else.
- proposed_fix: Collapse into `dispatchTask(task, ctx)` invoked by both entry points; entry-point decides whether to start a process first and whether grpc service-task dispatch is enabled.
- evidence_paths:
  - packages/runtime/bpmn-worker/src/worker.ts (lines 20-121)
  - packages/runtime/bpmn-worker/src/poll-loop.ts (lines 21-60)
  - packages/runtime/bpmn-worker/src/bin/{poll,worker}.ts
- judge_notes: Pairs with F010 — both live in bpmn-worker, both about consolidating runtime entry-points. Independent of seam slices.

### Rank #38 — F007 — suboptimal, P2
- packages: @rntme/runtime
- score: 3.00 (impact=M, confidence=H, reversibility=H, est_effort_h=3)
- summary: `runtime-config.ts` (354 LoC) validates `RuntimeConfig` with imperative `hasFunction(...)` duck-typing and a hand-grown error union; same package already uses zod for manifest. Two validation idioms.
- proposed_fix: Re-express `RuntimeConfig` as a zod schema (`z.custom()` for `DbDriver`/`EventBus`/`Surface` shape predicates). Eliminates ~250 LoC.
- evidence_paths:
  - packages/runtime/runtime/src/start/runtime-config.ts
  - packages/runtime/runtime/src/manifest/schema.ts
- judge_notes: Run after F022 (zod pinned) and F008 (DbDriver dead-strut removed — fewer shape predicates needed).

### Rank #39 — F018 — suboptimal, P3
- packages: @rntme/artifact-shared, @rntme/bindings, @rntme/init, @rntme/workflows
- score: 3.00 (impact=L, confidence=H, reversibility=H, est_effort_h=2)
- summary: `parseBindingArtifact`, `parseInitArtifact`, `parseWorkflowArtifact` are byte-identical 28-line templates differing only in schema constant and error code. `parseWithSchema` still requires every caller to repeat the `fromJson`/`fromIssue` shape.
- proposed_fix: Add `parseUniformSchema(input, schema, { layer, code })` to `@rntme/artifact-shared`. Saves ~60 LoC.
- evidence_paths:
  - packages/artifacts/{bindings,init,workflows}/src/parse/parse.ts
  - packages/artifacts/_shared/src/parse.ts
- judge_notes: Cheap. Run before F050 (the `*Ref` cleanup touches the same schemas).

### Rank #40 — F008 — dead_strut, P3
- packages: @rntme/runtime
- score: 2.00 (impact=L, confidence=M, reversibility=H, est_effort_h=2)
- summary: `DbDriver` is a one-method interface with exactly one implementation (`BunSqliteDriver` — 8 lines forwarding to `openSqliteDatabase`). Turso is SQLite-compatible and would target `@rntme/sqlite` directly. `runDbDriverContract` is only run against the one driver it abstracts.
- proposed_fix: Inline `BunSqliteDriver` into `start-service.ts` (or delete it and call `openSqliteDatabase`). Drop `DbDriver` from `RuntimeConfig`. Remove `runDbDriverContract` or repurpose as `@rntme/sqlite` self-test.
- evidence_paths:
  - packages/runtime/runtime/src/plugins/interfaces.ts (lines 11-18)
  - packages/runtime/runtime/src/plugins/bun-sqlite-driver.ts
  - packages/runtime/runtime/src/plugins/contract-tests.ts (lines 6-31)
  - packages/runtime/runtime/test/integration/plugin-contracts.test.ts
- judge_notes: Confidence is `med` (Turso pivot might still want a driver strata; per memory `rntme_turso_target`, Turso speaks SQLite directly, so the seam isn't needed). Independent of all other slices.

### Rank #41 — F051 — duplication, P2
- packages: demo/cv-extract-blueprint, demo/notes-blueprint, demo/order-fulfillment-blueprint
- score: 2.00 (impact=M, confidence=M, reversibility=M, est_effort_h=4)
- summary: Three demos express "get-by-id" in three different graph topologies despite `findOne` being a first-class kind. Three `entity-mirror` projections paste a 5-line stub differing only in entity name.
- proposed_fix: Migrate `getNote.json` and `getOrder.json` to the canonical `findOne` shape. Add `kind: "entity-mirror-default"` shortcut so projections degenerate to `{kind: "entity-mirror-default", entity: "Note"}`.
- evidence_paths:
  - demo/cv-extract-blueprint/services/app/graphs/getResume.json
  - demo/notes-blueprint/services/app/graphs/getNote.json
  - demo/order-fulfillment-blueprint/services/orders/graphs/getOrder.json
  - demo/*/services/.../qsm/projections/*.json
  - packages/artifacts/graph-ir-compiler/src/types/canonical.ts
- judge_notes: Confidence is `med` because the auth-check in notes belongs in middleware (per F042) — that migration must land first or be co-staged. Sequencing: F042 → F051.


## 3_worker_queue

_Execution budget started at: 2026-05-15T18:10:00Z. Cap: 900 worker-minutes. Per-worker receipts MUST increment `worker_minutes_spent`._

Total queued est_effort_h = 13 (exactly at cap with 2h buffer held in reserve for verify/audits per T100 receipt). Slices ordered for execution. Parallel-safety notes on each entry.

### Q1 — F034 — Fix stale-queued orphan sweep in platform-storage repos
- depends_on: none
- est_effort_h: 1
- score: 9.00
- packages: @rntme/platform-storage, @rntme/platform-core
- allowed_files: |
    packages/platform/platform-storage/src/repos/pg-deployment-repo.ts
    packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts
    packages/platform/platform-storage/test/**
    packages/platform/platform-core/src/repos/deployment-repo.ts
    packages/platform/platform-core/src/repos/project-operation-repo.ts
- verify:
  - bun run --filter @rntme/platform-storage typecheck
  - bun run --filter @rntme/platform-storage test
  - bun run --filter @rntme/platform-core typecheck
  - bun run lint
- stop_if:
  - findStaleRunning is used by code outside platform-storage/platform-core (re-scope needed).
  - Changing the predicate breaks any existing integration test fixture assuming a queued row is "live forever".
  - Renaming the method is required to express new semantics (split into two interface methods) — surface to Judge before touching deploy-runner/handler call sites.
- success_definition: |
    `findStaleRunning` in pg-deployment-repo and pg-project-operation-repo matches BOTH `queued` and `running` (e.g. `status IN ('queued','running')`). The interface contract in platform-core reflects the new semantics (rename or doc-only). A test exists in packages/platform/platform-storage/test/** that inserts a stale `queued` row, calls `findStaleRunning`, and asserts the row is returned. Simplify pass: collapse duplicated WHERE-clause snippets; ensure both repos use identical predicate text. This is a P1 correctness fix — confirms `rntme_orphan_detect_queued_gap` memory.

### Q2 — F033 — Consolidate withOptionalTransaction + withSystemRlsDisabled into pg/tx.ts
- depends_on: none (parallel-safe with Q1 — disjoint files in platform-storage repos; Q1 touches findStaleRunning predicate, Q2 touches transaction wrappers)
- est_effort_h: 1
- score: 6.00
- packages: @rntme/platform-storage
- allowed_files: |
    packages/platform/platform-storage/src/pg/tx.ts
    packages/platform/platform-storage/src/repos/pg-deployment-repo.ts
    packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts
    packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts
    packages/platform/platform-storage/test/**
- verify:
  - bun run --filter @rntme/platform-storage typecheck
  - bun run --filter @rntme/platform-storage test
  - bun run lint
- stop_if:
  - The four local copies have semantically diverged in ways that aren't reconcilable to a single helper (e.g. different RLS scopes intended).
  - `SET row_security = off` vs `SET LOCAL row_security = off` decision changes RLS scope for any non-test caller (surface to Judge).
- success_definition: |
    `pg/tx.ts` exports canonical `withOptionalTransaction` and `withSystemRlsDisabled` helpers. All three repo files (`pg-deployment-repo`, `pg-deploy-target-repo`, `pg-project-operation-repo`) import them; the four local reimplementations are deleted. The standardised version uses `SET LOCAL row_security = off` (tx-scoped). Simplify pass: 4 copies → 1 owner, fixes the divergent `SET LOCAL` vs `SET` RLS-scope bug at the same time. Pairs naturally with Q1 in the same package — Worker may batch the verify run.

### Q3 — F022 — Pin a single zod major across contract workspace packages
- depends_on: none (parallel-safe with Q1/Q2 — disjoint package; touches contracts/ not platform-storage)
- est_effort_h: 1
- score: 6.00
- packages: @rntme/contracts-module-v1, @rntme/contracts-marketing-site-v1
- allowed_files: |
    packages/contracts/module/v1/package.json
    packages/contracts/marketing-site/v1/package.json
    packages/contracts/marketing-site/v1/src/schema.ts
    packages/contracts/marketing-site/v1/src/index.ts
    packages/contracts/marketing-site/v1/test/**
- verify:
  - bun install --frozen-lockfile (re-resolve)
  - bun run --filter @rntme/contracts-marketing-site-v1 typecheck
  - bun run --filter @rntme/contracts-marketing-site-v1 test
  - bun run --filter @rntme/contracts-module-v1 typecheck
  - bun run --filter @rntme/contracts-module-v1 test
  - bun run lint
- stop_if:
  - Back-port to zod 3 requires marketing-site to lose a zod-4-only API that has no zod-3 equivalent without significant rewrite (>1h).
  - A consumer outside contracts/* pulls zod 4 explicitly — surface to Judge.
- success_definition: |
    `packages/contracts/marketing-site/v1/package.json` declares `zod: "^3.24.2"` matching `packages/contracts/module/v1/package.json`. `schema.ts` compiles and tests pass against zod 3. No `pnpm-lock`/`bun.lock` entry resolves two zod copies. Simplify pass: single zod copy in the dependency graph, eliminating the dual-major footgun before Q4–Q7 (which all transit contracts or build artefacts that touch zod). Run this before any slice that adds new zod schemas.

### Q4 — F021 — Promote Result<T,E> type-only into a single shared home; collapse 5 duplicates
- depends_on: none (independent of Q1–Q3 — they touch different packages; Q4 sets up Q5/Q7 to land on the unified type)
- est_effort_h: 3
- score: 9.00
- packages: @rntme/artifact-shared, @rntme/contracts-provisioner-v1, @rntme/deploy-core, @rntme/platform-core, @rntme/bundle-publish
- allowed_files: |
    packages/contracts/_common/v1/**
    packages/artifacts/_shared/src/result.ts
    packages/artifacts/_shared/src/index.ts
    packages/artifacts/_shared/test/**
    packages/contracts/provisioner/v1/src/result.ts
    packages/contracts/provisioner/v1/src/index.ts
    packages/deploy/deploy-core/src/result.ts
    packages/deploy/deploy-core/src/index.ts
    packages/platform/platform-core/src/types/result.ts
    packages/platform/platform-core/src/index.ts
    packages/tooling/bundle-publish/src/result.ts
    packages/tooling/bundle-publish/src/index.ts
    packages/contracts/_common/v1/package.json
- verify:
  - bun run typecheck
  - bun run test
  - bun run lint
  - bun run depcruise
- stop_if:
  - Promoting to `packages/contracts/_common/v1` requires a new workspace package and the dep-cruise rule "contracts depend only on contracts" cannot be satisfied — fall back to keeping type in `@rntme/artifact-shared` and re-exporting from the four other locations.
  - Any consumer transitively re-types `Result` via nominal pattern that the structural unification breaks (>5 sites needing rewrite) — surface to Judge to scope phase 2.
  - Any of the 5 duplicate files is re-exported via a deep-import path that downstream packages reach across module boundaries — must update all call sites.
- success_definition: |
    Exactly one `Result<T,E>` type declaration in the workspace, located in either `@rntme/contracts-common-v1` (preferred, contracts ownership) or `@rntme/artifact-shared` (fallback). The other four locations either (a) re-export the type from the canonical home during a transition window, OR (b) are deleted with their importers rewired. Helpers `ok`/`err`/`isOk`/`isErr` live in `@rntme/artifact-shared` (or are added to the canonical home). `bun run depcruise` passes — no new layering violation. Simplify pass: 5 type declarations → 1; the "// keeping in sync with artifact-shared — see comment" apology comment in `contracts/provisioner/v1/src/result.ts` is deleted. This is the load-bearing simplification that Q5 (F006 parser returns Result), Q7 (F043 helper returns Result), and several backlog slices (F046, F035, F029-derived sites) depend on.

### Q5 — F006 — Move scalar/list/row/rowset type-string parser into @rntme/bindings
- depends_on: [Q4] (parser is rewritten to return Result<GraphSignature, ParseError>)
- est_effort_h: 3
- score: 9.00
- packages: @rntme/bindings, @rntme/blueprint, @rntme/runtime
- allowed_files: |
    packages/artifacts/bindings/src/types/resolvers.ts
    packages/artifacts/bindings/src/index.ts
    packages/artifacts/bindings/test/**
    packages/artifacts/blueprint/src/compose/binding-resolvers.ts
    packages/artifacts/blueprint/test/**
    packages/runtime/runtime/src/load/load-service.ts
    packages/runtime/runtime/test/**
- verify:
  - bun run --filter @rntme/bindings typecheck
  - bun run --filter @rntme/bindings test
  - bun run --filter @rntme/blueprint typecheck
  - bun run --filter @rntme/blueprint test
  - bun run --filter @rntme/runtime typecheck
  - bun run --filter @rntme/runtime test
  - bun run lint
  - bun run depcruise
- stop_if:
  - The two existing implementations (blueprint regex parser vs runtime regex parser) have semantic divergence that cannot be reconciled without a behaviour change downstream (e.g. `array<scalar>` vs `list<scalar>` is a documented blueprint-author-facing alias). Surface drift to Judge before unifying.
  - Moving the parser to `@rntme/bindings` introduces a circular dep (bindings→blueprint or bindings→runtime). Re-evaluate target package.
- success_definition: |
    Canonical `parseInputType` / `parseFieldType` / `parseOutputType` / `toGraphSignature` live in `@rntme/bindings` next to `isScalarPrimitive`, each returning `Result<...,ParseError>` (using the Q4-unified Result). Both `@rntme/blueprint/compose/binding-resolvers.ts` and `@rntme/runtime/load/load-service.ts` import the canonical parser and DELETE their regex-based copies. Behavioural drift is reconciled to a single grammar (decision documented in code comment). Simplify pass: 2 regex parsers + 2 sets of bare-string `throw`s → 1 typed parser returning structured errors. `bun run depcruise` passes.

### Q6 — F040 — Make module.json the source of truth; add drift-detection test in platform-ui blueprint
- depends_on: none (parallel-safe with Q1/Q2/Q3 — different package; safe to run alongside Q4 because it doesn't touch Result-bearing code paths)
- est_effort_h: 2
- score: 9.00
- packages: @rntme/platform-ui (apps/platform/ui-module), apps/platform/blueprint
- allowed_files: |
    apps/platform/ui-module/module.json
    apps/platform/blueprint/test/platform-ui.test.ts
    apps/platform/blueprint/test/**
- verify:
  - bun run --filter @rntme/platform-ui typecheck
  - bun run --filter @rntme/platform-ui test
  - bun run --filter @rntme/platform-blueprint typecheck
  - bun run --filter @rntme/platform-blueprint test
  - bun run lint
- stop_if:
  - A screen spec passes a prop that the components.tsx implementation does NOT actually accept (drift goes both directions) — surface to Judge; that case implies a spec-vs-impl bug, not a manifest gap.
  - Manifest declaration shape (in module.json schema) cannot express a polymorphic prop (e.g. `hrefTemplateMap`) and would require a schema-shape change in `@rntme/contracts-module-v1` — scope creep, defer the affected prop to a separate slice.
- success_definition: |
    `apps/platform/ui-module/module.json` declares every prop that any `apps/platform/blueprint/services/app/ui/{screens,layouts}/*.spec.json` file passes to a `@rntme/platform-ui/*` component (specifically the ≥7 props from F040 evidence: `graphHrefTemplate`, `pdmHrefTemplate`, sidebar `items[].{hrefTemplate,matchPattern,section}`, topbar `crumbsFromRoute`, action `hrefTemplate`s, datatable `hrefTemplate/hrefTemplateMap/value`). A new (or extended) test in `apps/platform/blueprint/test/platform-ui.test.ts` walks every screen spec, collects component-prop usage, and asserts each prop is declared in `module.json`. Simplify pass: today drift is hidden; after this slice, adding an unknown prop to a screen fails CI. This is the prerequisite for Q-deferred F052 (vendor-check schema validation) and Q-deferred F041 (shared explorer header preset).

### Q7 — F043 — Extract resolveBundledProvisioner into @rntme/deploy-runner
- depends_on: [Q4] (helper returns Result; one path-safety code path consolidated against the unified Result)
- est_effort_h: 2
- score: 9.00
- packages: @rntme/cli, @rntme/platform-blueprint (apps/platform/blueprint), @rntme/deploy-runner
- allowed_files: |
    packages/deploy/deploy-runner/src/types.ts
    packages/deploy/deploy-runner/src/resolve-provisioner.ts
    packages/deploy/deploy-runner/src/index.ts
    packages/deploy/deploy-runner/test/**
    apps/cli/src/deploy-engine/resolve-provisioner.ts
    apps/cli/test/**
    apps/platform/blueprint/services/deployments/handlers/start-deployment.ts
    apps/platform/blueprint/test/**
- verify:
  - bun run --filter @rntme/deploy-runner typecheck
  - bun run --filter @rntme/deploy-runner test
  - bun run --filter @rntme/cli typecheck
  - bun run --filter @rntme/cli test
  - bun run --filter @rntme/platform-blueprint typecheck
  - bun run --filter @rntme/platform-blueprint test
  - bun run lint
  - bun run depcruise
- stop_if:
  - The CLI and handler call sites diverge in something beyond `manifestPath` vs `bundleAssetDir` (e.g. one needs an async hook, one doesn't) — surface to Judge for a re-shape of `buildResolveProvisioner({...})`.
  - Moving the helper into `@rntme/deploy-runner` introduces a runtime→artifact layering violation (depcruise fails) — relocate to `@rntme/deploy-core` instead.
  - The path-safety check (`back === '..' || back.startsWith('../')`) has subtly drifted in semantics between CLI and handler — surface to Judge before picking one canonical check.
- success_definition: |
    `@rntme/deploy-runner` exports `buildResolveProvisioner({ bundleAssetDir?, manifestPath? }): ResolveProvisioner` (or equivalent). Both `apps/cli/src/deploy-engine/resolve-provisioner.ts` and `apps/platform/blueprint/services/deployments/handlers/start-deployment.ts` import + use the shared builder; their hand-rolled `resolveBundledProvisioner` + `provisionerKey` + `resolvePackageRoot` + `resolvePackageEntry` + `importProvisioner` bodies are deleted (~57 LoC × 2 = ~115 LoC removed). The path-safety check exists in exactly one place. `bun run depcruise` passes. Simplify pass: two bytewise-duplicate contract impls → one builder; drift surface eliminated. Returns `Result<...>` typed against the Q4-unified type.

### Tranche 3 queue — Q15..Q17 (opened 2026-05-16)

Tranche 3 resumes from `notes/handoff-tranche2.md`. Cumulative budget at
tranche start: 235 / 900 worker-minutes; remaining headroom: 665 minutes.

#### Q15 — F058 — Fix CLI load-blueprint timeout flake
- status: **done** by T214
- est_effort_h: 0.25
- allowed_files: `apps/cli/test/unit/deploy-engine/load-blueprint.test.ts`
- verify:
  - `bun test apps/cli/test/unit/deploy-engine/load-blueprint.test.ts -t 'materializes project-folder assets for direct deploy bundleDir'`
  - `bun run --filter @rntme/cli typecheck`
  - `bun run --filter @rntme/cli lint`
  - `bun run --filter @rntme/cli test`
- receipt: scoped the known slow CV demo materialization test to a 15s Bun timeout. Full CLI test is green: 210 pass / 2 skip / 0 fail.

#### Q16 — F037 — Structural compose/nginx rendering in @rntme/deploy-dokploy
- status: **done** by T215
- est_effort_h: 4
- allowed_files: `packages/deploy/deploy-dokploy/**`, `bun.lock`, and owner doc only if public package gotchas change
- verify:
  - `bun install --frozen-lockfile`
  - `bun run --filter @rntme/deploy-dokploy typecheck`
  - `bun run --filter @rntme/deploy-dokploy test`
  - `bun run typecheck`
  - `bun run lint`
  - `bun run depcruise`
  - Dokploy redeploy smoke via repo `.env` if deploy output/apply behavior changes
- stop_if: golden outputs change beyond demonstrably equivalent formatting, or nginx cleanup becomes a broad rewrite unrelated to F037's correctness risk.
- receipt: Compose YAML now renders from a typed object model through `yaml@2.9.0`. A new regression test covers YAML-looking literal env strings (`true`, `123`, `{token}`) so they remain strings. Nginx was intentionally left unchanged because the existing renderer is already `EdgePlan`-driven with sanitizer and byte-exact golden tests; a broad builder rewrite would be lower-signal than the YAML correctness fix and outside the safe slice.

#### Q17 — F055 — Workspace-wide zod major unification
- status: **done** by T216
- est_effort_h: 3
- verify: `bun install --frozen-lockfile`, `bun run typecheck`, `bun run test`, `bun run lint`, `bun run depcruise`
- stop_if: the zod major choice conflicts with current package APIs or becomes larger than a dependency-policy slice.
- receipt: Zod 4 is now the canonical first-party major. `contracts-module-v1`, `contracts-marketing-site-v1`, and `runtime` moved from `zod ^3.24.2` to `^4.0.0`; module manifest record schemas were updated to Zod 4's two-argument `z.record(z.string(), valueSchema)` form. Workspace `bun install --frozen-lockfile`, typecheck, lint, depcruise, test, build, and vendor-check all pass. Remaining `zod@3` lockfile entries are external transitive aliases only (`astro`, `zod-to-json-schema`, `zod-to-ts`).


## 4_backlog

Items deferred from the ranked list. Includes (a) cosmetic-only P3 with low impact, (b) pure renames/moves with no architectural payoff (likely_misfire), (c) findings that became redundant after collapse.

- F045 — Three orphan landing components (`LiveDemoCard.astro`, `MicroJobs.astro`, `SnowflakeToRuntime.astro`). Pure deletion, P3, low impact; no architectural payoff. 1h cleanup, fine as a one-shot Worker task at end of tranche if budget remains.
- F047 — apps/platform two-package layout (`@rntme/platform-blueprint` + `@rntme/platform-ui`). Mostly a rename/move (option (b) in fix is moving `ui-module` to `packages/platform/platform-ui/`). **Likely_misfire** flagged — defer. Re-evaluate after F040 (manifest gate) lands; the cause of the split may be addressable inside the existing layout.
- F048 — Single one-line href bug in `deployment.spec.json` ("Back to deployments" routes to org dashboard). P3, 0h, cosmetic UX bug. Worker can fix in passing alongside another platform-blueprint slice.
- F017 — `CompileOptions.target` single-value option in graph-ir-compiler. P3 dead_strut, 1h. Worth a hygiene pass when F012 (runtime-graph extraction) is in flight, but not standalone-worthy.
- F019 — pdm load-dir flattens all six failure kinds into one error code while qsm exposes seven. Observability asymmetry, P3. 1h fix; defer unless an operator complains.
- F025 — `@rntme/contracts-analytics-v1` is a 3-line placeholder with no real consumer. P3, 1h. Defer — decide on delete-vs-wire when analytics work actually starts.
- F026 — Phantom `bindings-http` devDep in `contracts-handlers-v1`. P3, 0h. **Already absorbed into Rank #19 (F001 cluster)** — listed here for cross-ref only.
- F028 — Missing owner doc for `contracts-storage-v1`. P3, 1h. Defer to a docs cleanup tranche; not a Worker simplify slice.
- F053 (module-scaffold half) — `module-scaffold` is a 19-LoC example package with redundant test files. P3, 1h. The `bundle-publish` Result half collapsed into Rank #1; the module-scaffold cleanup defers unless someone touches the package.
- F054 — Three demos sit at three different points of formality (cv-extract full package vs notes/order-fulfillment data-only). 6h architectural decision but mostly reorganisation, not duplication or dead struts. Defer; doesn't fit the simplify-skill payoff curve in a 15h budget.

### Cross-references

- **F029** — fully collapsed into Rank #1 (F021).
- **F053 (bundle-publish Result half)** — fully collapsed into Rank #1 (F021).
- **F053 (module-scaffold half)** — backlogged above.
- **F014, F026** — collapsed into Rank #19 (F001).
- **F011** — collapsed into Rank #2 (F006).


### Newly surfaced by tranche 1 Worker execution (added by T999, 2026-05-15)

- **F055** — Wider workspace `zod` 4 vs 3 split. T202 closed `contracts-marketing-site-v1` only; `apps/cli`, `packages/runtime/bindings-http`, `packages/runtime/ui-runtime`, all `packages/artifacts/*`, `packages/deploy/deploy-core`, `packages/platform/platform-core` still pin `zod ^4`. P2, ~3h. Decide canonical major before the next contract-authoring slice. **CLOSED by Q17/T216 (Tranche 3, 2026-05-16).**
- **F056** — `modules/storage/s3/test/unit/server.test.ts` references `Buffer` without an eslint `env: { node: true }` declaration. Pre-existing lint failure surfaced repeatedly by T200/T201/T202 verify runs; out-of-scope for every Q1..Q7 slice. P3, ~0.25h. One-line eslintrc override or `import { Buffer } from "node:buffer"`.
- **F057** — `@rntme/artifact-shared` keeps a second (structurally compatible, mutable-fields) `Result<T,E>` shape after Q4. Q5 + Q7 chose it deliberately (already a dep of bindings + deploy-runner) but the workspace now has two type aliases for the same algebra. Unify with `@rntme/contracts-common-v1/result` once `_shared/package.json` is in scope. P2, ~1h. **CLOSED by Q10/T209 (Tranche 2, 2026-05-16).**

### Tranche-1-era findings closed by Tranche 2

- **F056** — CLOSED. Pre-fixed by user in commit `0a28dbb8` ("chore(docs): complete project cleanup", 2026-05-16) — `import { Buffer } from 'node:buffer'` added at line 2 of `modules/storage/s3/test/unit/server.test.ts`. Workspace `bun run lint` now exits 0. T207 confirmed via verification-only run.
- **F030, F031, F033, F044, F046, F052** — all closed by Q11/Q14/Q2/Q12/Q13/Q9 receipts. See `2_ranking` for their original entries.

### Newly surfaced by tranche 2 Worker execution (added by T1000, 2026-05-16)

- **F058** — `apps/cli/test/unit/deploy-engine/load-blueprint.test.ts > materializes project-folder assets for direct deploy bundleDir` consistently runs ~5.3s and trips the bun-test default 5000ms timeout. Predates Tranche 2 (last touch in commit `15c9d005`, unrelated to CLI watchers / poll helper / output renderer). Fix: bump per-test timeout via `it('...', { timeout: 15_000 }, …)` or pre-cache demo-blueprint module-resolution. P3, ~0.25h. *Surfaced by T211 isolated re-run.*
- **F052-observation** (policy note, not a fix) — All 5 `modules/<cat>/conformance/` packages (`marketing-site`, `storage`, `identity`, `ai-llm`, `crm`) intentionally ship no `module.json`. vendor-check (after Q9) skips them via `requireExists:false`. If audit policy later wants every `modules/**` package to expose a manifest, the gate is one boolean flip in `validateManifest`. P3, decision-only. *Surfaced by T208.*

### Tranche-2-era findings closed by Tranche 3

- **F058** — CLOSED by Q15/T214 (2026-05-16). The slow CV demo materialization test now has a scoped 15s timeout using Bun's typed third-argument overload. Verification: isolated test pass at ~5.8s, `@rntme/cli` typecheck/lint pass, and full `@rntme/cli` test pass (210 pass / 2 skip / 0 fail).
- **F037** — CLOSED by Q16/T215 (2026-05-16) for the load-bearing Compose YAML scalar correctness risk. `renderComposeYaml` now emits a typed object through `yaml@2.9.0`; deploy-dokploy tests, workspace typecheck/lint/depcruise/build, and live `platform up` smoke all pass. Nginx builder rewrite remains deferred as low-signal unless a future finding names a concrete unsafe directive class.
- **F055** — CLOSED by Q17/T216 (2026-05-16). First-party workspace packages now pin one Zod major (`^4.0.0`), Zod 4 record API adjustments are in source, and the module/marketing-site/runtime owner docs record the invariant. Lockfile `zod@3` entries are external transitive aliases only.

### Newly surfaced by tranche 3 Worker execution (added by T1001, 2026-05-16)

- **F059** — Root `bun run test` used Bun's default parallel filtered workspace runner and could strand a high-CPU package child (`@rntme/conformance-ai-llm`) even though that package's test command passed standalone in ~89ms. **CLOSED by Q17/T216 (2026-05-16):** the root `test` script now runs `bun run --filter '*' --sequential test`, preserving the documented `bun run test` command while making the workspace test gate deterministic.

### Memories retired by Tranche 2

- `rntme_cli_dist_silent_stale` — ready to retire (Q13/T212 closed the "CLI surfaces no cause" half). PM action after T1000.
