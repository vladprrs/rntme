# Medusa-class roadmap — hub

Aggregates the five thematic gap catalogs into a single decision-framework for the next 2–3 iterations of rntme. The forcing function is a small `commerce-api` demo (Cart → Order) that we commit to building after the P0 subset closes.

## Context

rntme is a **per-service artifact-based runtime** inside a larger LLM-agent-driven DDD platform: agents talk to business users, decompose requests into DDD services, and emit rntme artifacts (PDM, QSM, graph-IR, bindings) per service, with each service running event-sourced + CQRS for evolution-without-rewrites. Cross-service orchestration goes to **Zeebe**; sync inter-service calls ride **gRPC**; downstream event transforms / analytics projections live in **ksqlDB**; the DB scale path is **Turso** (SQLite-compatible, Postgres is not a target). A future observability/validation UI will render every artifact so business users can visually verify logic before deploy. This roadmap surveys rntme against Medusa.js as a reference commerce-class system and uses a minimal-domain `commerce-api` demo (Cart → Order, intra-service) to force the gap list into concrete tiers. Design spec (gitignored, local working copy): [`../superpowers/specs/2026-04-14-medusa-class-roadmap-design.md`](../superpowers/specs/2026-04-14-medusa-class-roadmap-design.md).

## Target case

"Commerce-class complexity" for rntme, as the tier table below weighs gaps against, means:

- **Intra-service multi-aggregate ops.** A single command may touch more than one aggregate in the same service — e.g., `checkoutCart` transitions `Cart` to `completed` and creates an `Order` atomically in one SQLite transaction.
- **Long-running cross-service workflows sit outside rntme.** Payment capture, inventory reservation, shipping: each is a Zeebe BPMN process calling per-service gRPC endpoints. rntme emits the contracts; Zeebe drives the saga.
- **Multi-currency / multi-region awareness** as a declared, typed concept (not strings-and-conventions), even if the demo keeps `currency_code` as a placeholder field.
- **Artifact authorability for LLM agents.** The LLM must be able to write and modify artifacts predictably — closed type systems, stable error codes, declarative retry semantics. "Good for LLMs" is the primary DX axis for every gap below.
- **Visual validation by business users.** The UI renders PDM, QSM, graph-IR, and bindings artifacts for review before deploy. Every gap's "auth-impact" column distills the visualization payoff in 3–6 words.

## rntme snapshot today

- **PDM** (`packages/pdm/`) — per-service flat-entity schema; closed scalar primitive set (`integer | decimal | string | boolean | date | datetime`); state-machine first-class on entity; no nested/struct, no `money`, no soft-delete, no cross-service ref.
- **QSM** (`packages/qsm/`) — entity-mirror projections derived from PDM, one SQLite row per aggregate, three-layer idempotency (`last_event_id`, `last_event_version`, `applied_at`).
- **Graph-IR compiler** (`packages/graph-ir-compiler/src/types/relational.ts`) — 6 relational operators (`Scan`, `Filter`, `Project`, `Aggregate`, `Sort`, `Limit`, and a declared but unlowered `Join`) plus SQLite emit (`packages/graph-ir-compiler/src/lower/sqlite/lower.ts`). All SQL is strictly SQLite-dialect for Turso drop-in.
- **Command runtime** (`packages/graph-ir-compiler/src/command-runtime/`) — one-emit-per-command, one-aggregate-per-command; composite read prelude + guard + single emit (hard-reject on multi-aggregate at `compile.ts:80`).
- **Bindings emit** (`packages/bindings/`) — OpenAPI 3.1 emit from a declarative artifact; shapes cover scalars, arrays, nullability, decimal encoding; standard error envelopes for 400 / 409 / 422 / 500; per-op OpenAPI passthrough.
- **Bindings-http** (`packages/bindings-http/`) — Hono + Zod runtime; compiles artifact to routes; maps Zod / `CommandExecutionError` to declared error bodies; no `Idempotency-Key` middleware.
- **Event-store** (`packages/event-store/`) — SQLite `event_log` + `publish_cursor`, append-only, single-writer, OCC per stream; in-process polling relay publishes to Kafka at-least-once.
- **Projection-consumer** (`packages/projection-consumer/`) — Kafka → QSM apply inside `BEGIN IMMEDIATE → COMMIT → commitOffsets`; at-least-once + idempotent via monotone `last_event_version` guards.
- **Single-writer SQLite today**, Turso (libsql) on the horizon as a drop-in replacement for concurrent-write scale.
- **Demo** — `demo/issue-tracker-api/` exercises the full pipeline (commands, event-store, relay, Kafka bridge, projection-consumer); richest artifact is the `assignIssueWithCapacityGuard` composite command graph.

## Out of scope for rntme

- Cross-service workflow / saga runtime → **Zeebe** (sagas, long-running workflows with compensation).
- Service-to-service RPC transport → **gRPC layer** (separate from rntme; rntme only emits contracts).
- Downstream event transformation / cross-service analytics projections → **ksqlDB**.
- Plugin / module SDK for third parties (Medusa-style) → replaced by **LLM-agent artifact generation**.
- LLM agent logic itself → separate platform component.

## Cross-cutting tier table

Sorted by Maturity (P0 first), then Demo (demo-blocker first), then Area alphabetical within each sub-group.

| Gap | Area | Maturity | Demo | Auth-impact |
|-----|------|----------|------|-------------|
| [Idempotency-Key middleware + storage](./bindings-gaps.md#p0-demo-blocker-idempotency-key-middleware--storage) | Bindings | P0 | demo-blocker | retry-safe command authoring |
| [Intra-service multi-aggregate command with transactional guarantee](./commands-and-transactions-gaps.md#p0-demo-blocker-intra-service-multi-aggregate-command-with-transactional-guarantee) | Commands | P0 | demo-blocker | atomic fan-out in viz |
| [Money type (amount + currency) native in PDM](./pdm-gaps.md#p0-demo-blocker-money-type-amount--currency-native-in-pdm) | PDM | P0 | demo-blocker | unlocks LLM money emit |
| [Nested / embedded objects in entity](./pdm-gaps.md#p0-demo-blocker-nested--embedded-objects-in-entity) | PDM | P0 | demo-blocker | nested shape in entity cards |
| [Derived projections (computed cart totals / order sums)](./queries-and-projections-gaps.md#p0-demo-blocker-derived-projections-computed-cart-totals--order-sums) | Queries | P0 | demo-blocker | dashed derived-column edges |
| [Joins / aggregations in graph-IR](./queries-and-projections-gaps.md#p0-demo-blocker-joins--aggregations-in-graph-ir) | Queries | P0 | demo-blocker | join node in query viz |
| [gRPC/protobuf binding emit](./bindings-gaps.md#p0-non-blocker-grpcprotobuf-binding-emit) | Bindings | P0 | non-blocker | dual-transport capability card |
| [Outbox pattern for reliable event emission](./commands-and-transactions-gaps.md#p0-non-blocker-outbox-pattern-for-reliable-event-emission) | Commands | P0 | non-blocker | per-event publish badge |
| [Error catalog with stable codes in OpenAPI](./bindings-gaps.md#p1-demo-blocker-error-catalog-with-stable-codes-in-openapi) | Bindings | P1 | demo-blocker | typed error-code chips |
| [Medusa-style cross-module "link" to foreign-service-ref annotation](./pdm-gaps.md#p1-non-blocker-medusa-style-cross-module-link--foreign-service-ref-annotation) | PDM | P1 | non-blocker | dotted cross-service edges |
| [Soft-delete markers as first-class](./pdm-gaps.md#p1-non-blocker-soft-delete-markers-as-first-class) | PDM | P1 | non-blocker | soft-delete badge on rows |
| [Exactly-once semantics in projection-consumer](./commands-and-transactions-gaps.md#p1-non-blocker-exactly-once-semantics-in-projection-consumer) | Commands | P1 | non-blocker | enables counter projections |
| [Idempotency on API-level command retries](./commands-and-transactions-gaps.md#p1-non-blocker-idempotency-on-api-level-command-retries) | Commands | P1 | non-blocker | retry-safe checkout button |
| [Observability — structured logs, traces, metrics, and projection DLQ](./infra-and-operability-gaps.md#p1-non-blocker-observability--structured-logs-traces-metrics-and-projection-dlq) | Infra | P1 | non-blocker | pipeline-lag panel for ops |
| [Redis for low-latency pub/sub and cache — scope question](./infra-and-operability-gaps.md#p1-non-blocker-redis-for-low-latency-pubsub-and-cache--scope-question) | Infra | P1 | non-blocker | boundary clarified in diagram |
| [Turso (libsql) compatibility audit](./infra-and-operability-gaps.md#p1-non-blocker-turso-libsql-compatibility-audit) | Infra | P1 | non-blocker | per-package Turso-ready badge |
| [Discriminator / oneOf in responses](./bindings-gaps.md#p1-non-blocker-discriminator--oneof-in-responses) | Bindings | P1 | non-blocker | segmented variant editor |
| [Multipart / file upload handling](./bindings-gaps.md#p1-non-blocker-multipart--file-upload-handling) | Bindings | P1 | non-blocker | upload affordance in op card |
| [Cursor pagination](./queries-and-projections-gaps.md#p1-non-blocker-cursor-pagination) | Queries | P1 | non-blocker | cursor icon on Limit node |
| [Graph-IR visual readability](./queries-and-projections-gaps.md#p1-non-blocker-graph-ir-visual-readability) | Queries | P1 | non-blocker | stable node IDs for layout |
| [Webhooks/callbacks emit in OpenAPI 3.1](./bindings-gaps.md#p2-non-blocker-webhookscallbacks-emit-in-openapi-31) | Bindings | P2 | non-blocker | arrows to webhook receivers |
| [Scheduled / cron jobs primitive](./commands-and-transactions-gaps.md#p2-non-blocker-scheduled--cron-jobs-primitive) | Commands | P2 | non-blocker | scheduled-command lane in UI |
| [File/object storage abstraction](./infra-and-operability-gaps.md#p2-non-blocker-fileobject-storage-abstraction) | Infra | P2 | non-blocker | storage node in architecture |
| [Snapshotting for event-store on long-lived aggregates](./infra-and-operability-gaps.md#p2-non-blocker-snapshotting-for-event-store-on-long-lived-aggregates) | Infra | P2 | non-blocker | snapshot version in inspector |
| [Migrations / schema evolution](./pdm-gaps.md#p2-non-blocker-migrations--schema-evolution) | PDM | P2 | non-blocker | reviewable DDL diff cards |
| [Full-text search operator](./queries-and-projections-gaps.md#p2-non-blocker-full-text-search-operator) | Queries | P2 | non-blocker | search-icon node on scan |
| [Window functions (SQLite-compatible subset)](./queries-and-projections-gaps.md#p2-non-blocker-window-functions-sqlite-compatible-subset) | Queries | P2 | non-blocker | framed window over feed |

## Dependency notes

Chains where closing gap X unlocks gap Y (or the demo outright):

- **Money type in PDM → price emission in bindings → checkout workflow in demo.** Without `money` as a primitive, `unit_price` / `total` / `Order.total` cannot be typed consistently, bindings cannot emit currency-aware response shapes, and `checkoutCart` has no honest domain to operate on.
- **Nested / embedded objects in PDM → LineItem embedded in Cart snapshot → derived-totals projection.** Structural support for nested shapes lets QSM mirror the `LineItem[]` sub-shape; that in turn feeds the `cart.total` derived column.
- **Joins in graph-IR → `LineItem × Variant` enrichment → `addToCart` validation.** The `addToCart` read phase must join to `Variant` for price and `is_active`; without a lowered `Join` operator, the demo's central read cannot be authored declaratively.
- **Outbox pattern + intra-service multi-aggregate → reliable checkout without distributed saga for the demo.** The SQLite transaction is the compensation boundary for intra-service; a clean outbox guarantees the emitted `CartCompleted` + `OrderPlaced` reach Kafka exactly once per committed append. No Zeebe required inside the demo's single-service scope.
- **Idempotency-Key middleware → retry-safe bindings → LLM can author safe command retries.** The binding-layer middleware plus a stable `(commandId, Idempotency-Key) → CommandResult` cache lets `POST /v1/carts/:id/checkout` survive client retries; the error-catalog gap (P1) then lets the LLM branch on stable codes during retry.
- **Error catalog with stable codes → `oneOf` discriminator in responses → LLM-authored client narrowing.** Once error codes are an OpenAPI enum and responses carry tagged variants, the LLM can emit consumer code that narrows correctly instead of string-matching on `message`.
- **Graph-IR visual readability (stable node IDs) → viz UI diffing → LLM iterative edits visible to reviewers.** Without stable IDs the UI cannot diff "before" vs "after" versions of a query, so LLM edits look like full rewrites to business users.

## Links

- [pdm-gaps.md](./pdm-gaps.md)
- [bindings-gaps.md](./bindings-gaps.md)
- [queries-and-projections-gaps.md](./queries-and-projections-gaps.md)
- [commands-and-transactions-gaps.md](./commands-and-transactions-gaps.md)
- [infra-and-operability-gaps.md](./infra-and-operability-gaps.md)
- [commerce-demo-design.md](../superpowers/specs/2026-04-14-commerce-demo-design.md) (gitignored — local working spec)

## Open questions

1. **Intra-service multi-aggregate command shape.** Options: (a) extend `emit` to DAG-emit with transactional guarantee; (b) introduce a "saga-step" primitive for intra-service only; (c) rely on outbox + manual compensation. **Resolved in:** `commands-and-transactions-gaps.md` → §Intra-service multi-aggregate command shape.
2. **QSM vs ksqlDB boundary.** Which projections stay in QSM (entity-mirror tied to one service's events) and which go to ksqlDB (cross-service joins, analytics, derived stats). **Resolved in:** `queries-and-projections-gaps.md` → §QSM vs ksqlDB boundary.
3. **"View-artifact" format for UI.** Is the current JSON artifact format rich enough for the visualization UI (positions, labels, groupings) or do we need a separate view-artifact emit? Cross-cutting; each thematic doc notes its angle. **Resolved in:** this hub (aggregate) once business-user UI scope is set.
