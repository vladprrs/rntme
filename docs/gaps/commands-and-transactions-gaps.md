# Gaps: Commands and Transactions

This document tracks command-runtime and event-pipeline gaps after CloudEvents,
delivery tracking, DLQ, pre-fetch, and HTTP idempotency landed. The command
runtime is still intentionally deterministic: Graph IR read prelude, guards, and
event emits; external calls happen through binding pre-steps/modules, not inside
Graph IR.

## What rntme has today

- `packages/graph-ir-compiler/src/command-runtime/compile.ts` compiles one
  command graph, builds read prelude SQL when needed, and still rejects commands
  whose emit plans span more than one aggregate type with
  `CMD_MULTI_AGGREGATE_NOT_ALLOWED`.
- `packages/graph-ir-compiler/src/command-runtime/execute.ts` replays one
  stream, validates transitions, derives event payloads, and calls
  `eventStore.appendEvents([req])` with one append request.
- `packages/event-store/src/store/sqlite.ts` supports transactional append of an
  array of append requests, so the storage layer is not the main blocker for
  multi-stream atomicity.
- `packages/bindings-http` has HTTP command idempotency cache and pre-step
  execution. These are transport/binding features, not core `executeCommand`
  semantics.
- `packages/event-store` has CloudEvents envelope fields, service-segmented
  topics, `delivery_tracking`, bounded retry, and DLQ emission.
- `packages/projection-consumer` has mirror and derived idempotency paths.
- There is no scheduled command primitive in rntme runtime; the current product
  leaning is to let Operaton/timer workflows invoke services through gRPC.

## Closed or reframed since the original gap doc

- **Outbox/DLQ:** closed for delivery tracking, bounded attempts, and DLQ
  emission. Residual: ops APIs and selective publish semantics.
- **API-level HTTP idempotency:** mostly closed in bindings-http. Residual:
  artifact/OpenAPI/gRPC contract and whether `executeCommand` itself accepts
  idempotency metadata.
- **Exactly-once projection concern:** reframed. `seen_events` covers derived
  projection replay; full Kafka transactional exactly-once remains out of scope.
- **Scheduled jobs:** still P2/out-of-scope unless a service-local scheduling
  need appears that should not be a BPMN timer.

## Gaps

### [P0] Intra-service multi-aggregate command with transactional guarantee

**Why it matters.** Normal workflow actions can touch more than one aggregate in
one service: approve request and create audit task; close ticket and create
follow-up; submit onboarding and create account record. Forcing these into
multiple commands loses atomicity and makes the generated behavior harder to
review.

**Current evidence.**

- `compileCommand` rejects multiple aggregate types.
- `executeCommand` chooses `compiled.emits[0]` as the head, derives one subject,
  reads one stream, and appends one request.
- `@rntme/event-store` already accepts `AppendRequest[]` and wraps append in one
  SQLite transaction, so the next design step is compiler/executor semantics.

**Target.**

- Allow multiple terminal emit nodes in one command graph when all aggregates
  are owned by the same runtime service.
- Build one `AppendRequest` per aggregate stream and append them atomically.
- Define composite OCC behavior and error reporting when one stream has moved.
- Render the transactional boundary in UI/review output.

**Acceptance gate.** A test command emits to two aggregate streams in one SQLite
transaction; if either expected version fails, no stream is appended.

### [P1] Command idempotency beyond HTTP replay cache

**Why it matters.** HTTP retries are protected, but non-HTTP callers are coming:
gRPC surfaces, BPMN workers, modules, CLI/test harnesses. If idempotency remains
purely Hono middleware, those callers need parallel conventions.

**Current evidence.**

- `packages/bindings-http/src/idempotency/*` implements replay cache.
- `executeCommand` has no `idempotencyKey` in its context.
- `packages/bindings-grpc` calls the command executor without a documented
  idempotency contract equivalent to HTTP `Idempotency-Key`.

**Target.**

- Decide whether idempotency belongs in `CommandExecutor` context or remains a
  transport contract.
- Document gRPC metadata/request behavior.
- Align module pre-step idempotency chain with top-level command idempotency.

**Acceptance gate.** The same command invoked through HTTP and gRPC has
documented retry semantics and tests for replay/conflict behavior.

### [P1] Relay/projection ops visibility

**Why it matters.** Delivery tracking and DLQ data exist, but operators still
need supported ways to answer "what is stuck, how far behind are we, and what
was dead-lettered?"

**Current evidence.**

- `delivery_tracking` exists in `packages/event-store/src/store/schema.ts`.
- Runtime metrics exist in `packages/runtime/src/plugins/observability.ts`.
- `@rntme/db-studio` can inspect tables manually, but that is not an ops API.

**Target.**

- Add read-only ops endpoints or package APIs for relay lag, DLQ count/list, and
  projection lag.
- Keep detailed SQL browsing behind db-studio/admin gates.

**Acceptance gate.** A runtime instance exposes supported health/metrics/ops
data sufficient to debug a poisoned event without raw SQL.

### [P2] Scheduled commands and timers

**Why it matters.** Reminders, expiry, renewals, and sweeps are common business
flows. Duplicating a scheduler inside each runtime may be the wrong abstraction
if the platform standard is Operaton timers calling gRPC commands.

**Current evidence.**

- Runtime starts HTTP/gRPC surfaces and the event pipeline; no scheduler is in
  `packages/runtime/src/start/start-service.ts`.
- The modules integration spec kept workflow worker adapters and BPMN
  conventions out of the original runtime slice; current BPMN worker work is
  tracked in `docs/superpowers/specs/done/2026-05-05-provisioned-bpmn-operaton-design.md`.

**Target.** Defer until the project runtime/deploy story proves whether timers
are platform workflow artifacts or service-local runtime artifacts.

**Acceptance gate.** Either BPMN timer invocation is documented and tested, or
a service-local scheduled command primitive is specified with idempotency,
visibility, and deploy semantics.

## Boundaries

- **Cross-service BPMN orchestration belongs to Operaton.** rntme commands should not grow a
  workflow/compensation engine.
- **External side effects happen before command emit through pre-steps/modules.**
  Graph IR stays pure read/guard/emit.
- **Kafka exactly-once is not an artifact feature.** rntme keeps at-least-once
  delivery plus idempotent consumers and DLQ handling.
- **Selective publish is not yet proven.** Treat event_log as outbox until a real
  non-public event type appears.

## Open questions

1. For multi-aggregate commands, should the compiler allow multiple aggregate
   types or only multiple streams of one aggregate type first? Recommended
   default: allow multiple same-service aggregate types, but keep cross-service
   blocked.
2. Should command idempotency move into `CommandExecutor` context? Recommended
   default: yes, as optional metadata, so HTTP/gRPC/BPMN workers share one path.
3. Do we need selective event publishing? Recommended default: no until a real
   event type should be persisted but not published.
