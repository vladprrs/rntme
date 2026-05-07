# Workflow-runtime gap roadmap - hub

This file supersedes the original 2026-04-14 Medusa-class roadmap snapshot. The
Medusa/commerce comparison remains useful as a stress test, but it is no longer
the product frame. Current rntme positioning is the safe runtime for
AI-generated business workflow apps: a validated project blueprint folder
(`project.json`, project-level PDM, service folders, integration modules)
becomes working APIs and declarative UI with zero service-specific code.

## Current frame

Source of truth:

- `vision.md` and `README.md`: market frame is repeatable workflow services,
  not first-app magic or a commerce platform clone.
- `CLAUDE.md`: internal frame is an artifact-driven runtime authored as a
  project blueprint; service-level artifacts are compiler IR.
- `docs/history/specs/historical/2026-04-23-project-first-blueprint-design.md`:
  the canonical authoring/versioning/deploy unit is the project blueprint
  folder.
- `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md`:
  modules, gRPC surface, pre-fetch steps, callback bindings, and idempotency
  chain.
- `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md`:
  project-level deploy planning lives in `rntme-cli`, while runtime still boots
  one service at a time.

## Target case

The target case is no longer "build a small commerce-api that proves Medusa
parity." The target case is:

- A project blueprint can describe one workflow-heavy business app made of one
  or more domain services and integration modules.
- The runtime can validate, compose, serve, inspect, and deploy that app without
  service-specific code.
- Agents can safely author and revise the blueprint because validators, stable
  contracts, generated OpenAPI/protobuf, schema governance, and runtime
  idempotency catch invalid changes early.
- The first canonical demo should be aligned with the wedge classes in
  `vision.md`: approvals, ticketing, customer-ops, onboarding, internal admin,
  or back-office. Commerce remains a high-complexity stress test, not the next
  default demo.

## Snapshot today

- **Project blueprint composition is partially implemented.**
  `packages/artifacts/blueprint` loads `project.json`, project-level PDM, service
  descriptors/artifacts, routes/middleware, project-routed binding registry, and
  service UI compilation (`packages/artifacts/blueprint/README.md`). `@rntme/runtime`
  still loads a single service artifact folder via `packages/runtime/runtime/src/load/load-service.ts`.
- **PDM remains flat and scalar.** The type system in
  `packages/artifacts/pdm/src/types/artifact.ts` still supports only
  `integer | decimal | string | boolean | date | datetime`, local relations,
  entity ownership, keys, and entity state machines. There is no money, enum,
  json/struct, `deletedAt`, migration/version artifact, or foreign-service ref.
- **QSM has entity mirrors plus derived projections.** `packages/artifacts/qsm` supports
  `backing: "entity-mirror" | "derived"` and `source: { graph }`;
  `packages/runtime/projection-consumer` applies mirror handlers with
  `last_event_version` and derived handlers with `seen_events`.
- **Graph IR still lacks explicit `Join` lowering.** `RelJoin` is typed in
  `packages/artifacts/graph-ir-compiler/src/types/relational.ts`, but
  `packages/artifacts/graph-ir-compiler/src/lower/sqlite/lower.ts` still falls through
  for `Join`; dot-navigation auto-joins exist only for scalar field paths.
- **Command runtime remains single-aggregate.** `compileCommand` still rejects
  multiple emitted aggregate types with `CMD_MULTI_AGGREGATE_NOT_ALLOWED`;
  `executeCommand` still builds one stream append request even though
  `@rntme/event-store` accepts an array of append requests.
- **HTTP bindings are materially ahead of the old gap doc.**
  `packages/artifacts/bindings` includes `exposure`, `inputFrom`, redirect
  response shapes, callback-oriented GET validation, and allowed redirect hosts.
  `packages/runtime/bindings-http` includes idempotency middleware/cache,
  operation routing, render-response, correlation middleware, pino logger, and
  metrics hooks.
- **gRPC is implemented as a runtime surface.** `packages/runtime/bindings-grpc`
  emits protobuf and mounts a grpc-js server; `packages/runtime` can enable a
  `GrpcSurface` from manifest `surface.grpc`.
- **Event pipeline is stronger than the old snapshot.** `packages/runtime/event-store`
  has CloudEvents-shaped envelopes, `delivery_tracking`, bounded relay
  attempts, DLQ emission, and service-segmented topic naming. The remaining
  event-driven gaps are schema registry/compatibility and production bus
  contracts.
- **Runtime/package operability exists but is not production-complete.**
  Runtime health/metrics are exposed through `packages/runtime/runtime/src/plugins/observability.ts`,
  while raw SQL inspection is no longer treated as a product surface
  (`@rntme/db-studio` is retired). The default runtime still uses `InMemoryBus`;
  project deployment production mode is intentionally rejected in the deploy
  spec until production bus/storage decisions land.
- **Canonical examples lag the model.** `demo/notes-blueprint`,
  `demo/order-fulfillment-blueprint`, and `demo/cv-extract-blueprint` exercise
  different slices, but there is still no single canonical production-grade
  runtime demo.

## Tier table

| Gap | Area | Maturity | Why it matters now |
| --- | --- | --- | --- |
| [Project-level runtime intake and canonical project demo](./infra-and-operability-gaps.md#p0-project-level-runtime-intake-and-canonical-project-demo) | Infra | P0 | Product promises project blueprints; runtime still boots one service. |
| [Schema registry + backward compatibility gate](./infra-and-operability-gaps.md#p0-schema-registry-backward-compatibility-gate) | Infra | P0 | Agents can silently break downstream event consumers today. |
| [Graph IR explicit joins](./queries-and-projections-gaps.md#p0-explicit-join-lowering-in-graph-ir) | Queries | P0 | Multi-entity workflow reads still require workaround paths. |
| [Intra-service multi-aggregate command](./commands-and-transactions-gaps.md#p0-intra-service-multi-aggregate-command-with-transactional-guarantee) | Commands | P0 | One business action often needs atomic fan-out inside one service. |
| [PDM structured type-system v2](./pdm-gaps.md#p0-pdm-structured-type-system-v2) | PDM | P0 | Agents need enums, json/structs, and money-like composites without conventions. |
| [Production bus/storage deploy contract](./infra-and-operability-gaps.md#p0-production-busstorage-deploy-contract) | Infra | P0 | Deploy pipeline can plan previews; production remains blocked by explicit runtime prerequisites. |
| [Idempotency contract in artifacts/OpenAPI/gRPC](./bindings-gaps.md#p1-idempotency-contract-in-artifacts-openapi-and-grpc) | Bindings | P1 | HTTP cache exists, but contract exposure and non-HTTP semantics remain incomplete. |
| [Error catalog with stable OpenAPI/protobuf codes](./bindings-gaps.md#p1-error-catalog-with-stable-codes-in-openapi-and-protobuf) | Bindings | P1 | Generated clients and BPMN workers need machine-readable failure branches. |
| [PDM foreign-service refs and project ownership semantics](./pdm-gaps.md#p1-foreign-service-refs-and-project-ownership-semantics) | PDM | P1 | Project-level PDM needs explicit service-boundary handles without fake local FKs. |
| [Observability and ops HTTP surfaces](./infra-and-operability-gaps.md#p1-observability-and-ops-http-surfaces) | Infra | P1 | Health/metrics exist; relay/projection DLQ and lag inspection need first-class surfaces. |
| [Cursor pagination](./queries-and-projections-gaps.md#p1-cursor-pagination) | Queries | P1 | Workflow admin lists need stable pagination under writes. |
| [Soft delete and schema evolution](./pdm-gaps.md#p2-soft-delete-and-schema-evolution) | PDM | P2 | Needed for production lifecycle/audit, not for the next project-demo slice. |
| [Multipart/file upload + object storage](./bindings-gaps.md#p2-multipartfile-upload-and-object-storage) | Bindings/Infra | P2 | Useful for attachments/media; not core to proving the runtime thesis. |
| [FTS/window analytics split](./queries-and-projections-gaps.md#p2-search-windowing-and-analytics-boundary) | Queries | P2 | Keep in-process SQLite search/reporting small; push broad analytics out. |
| [Snapshotting long-lived aggregates](./infra-and-operability-gaps.md#p2-event-store-snapshotting) | Infra | P2 | Performance follow-up once real long-lived aggregates exist. |

## Closed or downgraded since the original roadmap

- **HTTP Idempotency-Key middleware/storage:** mostly closed in
  `packages/runtime/bindings-http/src/idempotency/*` and router wiring; remaining work
  is contract-level exposure and gRPC/non-HTTP semantics.
- **gRPC/protobuf binding emit:** closed at package/runtime-surface level by
  `packages/runtime/bindings-grpc` and `packages/runtime/runtime/src/plugins/grpc-surface.ts`.
- **Derived projections/idempotency for non-mirror projections:** closed for the
  event-delta/UPSERT shape by `packages/artifacts/qsm`, `packages/runtime/projection-consumer`,
  and runtime derived-projection cross-validation.
- **Outbox/DLQ telemetry:** closed for delivery tracking and bounded relay
  attempts in `packages/runtime/event-store`.
- **Callbacks/pre-fetch/module wiring:** no longer a missing primitive;
  residual gaps are polish, docs, error contracts, and production hardening.
- **Medusa-class commerce demo as forcing function:** downgraded. Use it for
  stress testing money, nested shapes, joins, and multi-aggregate commands; do
  not let it override the workflow-runtime wedge.

## Dependency notes

- **Project runtime intake -> canonical demo -> deployment proof.** A project
  blueprint must boot as a project, not as hand-picked service folders, before a
  [DEV] agent can produce convincing live evidence.
- **PDM v2 -> QSM/Graph IR/bindings shape accuracy.** Enums, json/structs, and
  money-like composites must land in PDM before downstream packages can emit
  honest schemas, forms, SQL, and protobuf.
- **Explicit joins + multi-aggregate commands -> richer workflow services.**
  These unlock normal business flows like "approve request and create audit
  task" or "close ticket and emit follow-up work item" without service-specific
  code.
- **Schema registry -> safe agent iteration.** Event schemas and compatibility
  checks are the guardrail that lets agents update blueprints without silently
  breaking consumers.
- **Production bus/storage contract -> deploy pipeline production mode.**
  `rntme-cli` can plan previews now, but production should stay rejected until
  Kafka/Redpanda and persistent SQLite/libsql storage are explicit.

## Links

- [pdm-gaps.md](./pdm-gaps.md)
- [bindings-gaps.md](./bindings-gaps.md)
- [queries-and-projections-gaps.md](./queries-and-projections-gaps.md)
- [commands-and-transactions-gaps.md](./commands-and-transactions-gaps.md)
- [infra-and-operability-gaps.md](./infra-and-operability-gaps.md)
## Open product questions

1. **Canonical demo choice.** Should the next project-shaped demo be approvals,
   customer-ops, onboarding, or another workflow wedge? Recommended default:
   approvals, because it exercises state machines, roles, comments, audit, and
   multi-step review without forcing commerce-specific money/catalog scope.
2. **Project runtime boundary.** Should `@rntme/runtime` learn to boot a whole
   composed project, or should a thin project launcher orchestrate one runtime
   process per service plus gateway? Recommended default follows the deploy
   spec: separate service runtimes plus generated edge gateway.
3. **PDM v2 scope.** Do we ship `enum` + `json`/typed struct first, leaving
   `money` as a named composite pattern, or make `money` first-class
   immediately? Recommended default: `enum` + typed struct/json first; money is
   a composite recipe unless a commerce pilot appears.
