# Gaps: Queries and Projections

This document covers QSM, projection-consumer, and Graph IR read-path gaps after
derived projections landed. The key change since the original snapshot:
`backing: "derived"` and `seen_events` are implemented, but explicit relational
`Join` lowering and production-grade query ergonomics are still open.

## What rntme has today

- `packages/artifacts/qsm` supports `entity-mirror` and `derived` projection backings.
  Derived projections reference graph IDs and require explicit table names.
- `packages/artifacts/qsm/src/derive/ddl.ts` can emit DDL for entity mirrors and derived
  projection schemas supplied by runtime cross-validation.
- `packages/runtime/runtime/src/projections/cross-validate.ts` compiles derived
  projections from graph specs and feeds `derivedSchemas`/`derivedHandlers` into
  QSM/projection-consumer.
- `packages/runtime/projection-consumer/src/apply/apply-event.ts` applies mirror
  handlers with `last_event_version` guards and derived handlers with
  `seen_events(event_id, projection_id)`.
- `packages/artifacts/graph-ir-compiler/src/types/relational.ts` includes `Scan`,
  `Filter`, `Project`, `Aggregate`, `Sort`, `Limit`, and `Join`.
- `packages/artifacts/graph-ir-compiler/src/lower/sqlite/lower.ts` lowers everything
  except explicit `Join`. Multi-segment dot-navigation can inject joins for
  scalar path resolution, but `relOutputColumns` still throws for `Join`.
- Pagination remains `Sort + Limit`; there is no first-class cursor contract.

## Closed or reframed since the original gap doc

- **Derived projections are no longer a P0 missing primitive.** The implemented
  shape covers event-delta projections and idempotent replay via `seen_events`.
  Richer per-parent aggregates may still need design, but the category exists.
- **Exactly-once projection semantics are reframed.** rntme now has two
  idempotency paths: mirror version guards and derived `seen_events`. Kafka
  offset transactions are still at-least-once, but projection correctness no
  longer depends only on entity mirrors.
- **QSM vs ksqlDB boundary changed with project-first.** The project-first spec
  allows service-level QSM to consume foreign service events passively. That
  does not mean QSM owns broad analytics; cross-service dashboards and stream
  transforms still belong outside the per-service command path.

## Gaps

### [P0] Explicit Join lowering in Graph IR

**Why it matters.** Workflow services need multi-entity reads: approval request
plus requester, ticket plus customer, task plus assignee capacity, or order plus
line items. Today authors can sometimes rely on dot-navigation, but explicit
joins are typed and not lowerable. This is a direct blocker for agent-authored
queries that need to project columns from both sides.

**Current evidence.**

- `RelJoin` is in `packages/artifacts/graph-ir-compiler/src/types/relational.ts`.
- `packages/artifacts/graph-ir-compiler/src/lower/sqlite/lower.ts` has no `case 'Join'`
  and throws from the default branch.
- `relOutputColumns` explicitly throws for `Join`.

**Target.**

- Lower `inner` and `left` equi-joins with `leftCol/rightCol`.
- Define output-column naming/aliasing for both sides.
- Validate ambiguous or missing columns before SQL emission.
- Keep emitted SQL SQLite/libsql-compatible.

**Acceptance gate.** A graph with an explicit join compiles to SQLite, executes
in runtime tests, and can be referenced from a binding/UI route without custom
code.

### [P1] Cursor pagination

**Why it matters.** Admin/workflow list screens drift under offset pagination
when writes happen concurrently. Stable cursors are not a project-demo blocker,
but they are table stakes for generated business UIs.

**Current evidence.**

- `RelLimit` has only `count`; no `after`, cursor token, or stable-key
  validation.
- OpenAPI/bindings do not standardize cursor input/output envelopes.

**Target.**

- Add either a `RelStableAfter` operator or a validated `Sort + cursor` pattern.
- Require unique-or-PK-tiebroken sort keys.
- Emit response metadata for `nextCursor`.

**Acceptance gate.** A generated list endpoint remains stable across inserts in
an integration test.

### [P1] Graph IR visual readability

**Why it matters.** rntme's thesis depends on business users and reviewers being
able to inspect generated behavior. Re-rendering a query as a new layout on
every agent edit makes diffs unreadable.

**Current evidence.**

- Relational operators carry structural fields only; no `nodeId`, stable label,
  or view metadata exists in `packages/artifacts/graph-ir-compiler/src/types/relational.ts`.
- UI layout should not be embedded in deploy artifacts, but stable IDs need a
  compiler-owned source.

**Target.**

- Add stable node IDs and optional labels to relational IR or a compiler-emitted
  view model.
- Keep x/y positions in UI/user layout storage, not deploy artifacts.

**Acceptance gate.** The same logical graph keeps stable node identity across
non-semantic edits, enabling before/after review.

### [P2] Search, windowing, and analytics boundary

**Why it matters.** Search and reporting show up quickly in operational apps,
but the runtime should not become a BI/search platform.

**Current evidence.**

- There is no FTS operator in `RelOp`.
- There is no window-function operator.
- Derived projections can materialize some counters, but broad cross-service
  analytics are not a per-service QSM responsibility.

**Target.**

- Consider a small SQLite FTS5 baseline for in-process search where it directly
  serves service UI.
- Consider a restricted SQLite window-function subset only if a concrete
  workflow demo requires it.
- Keep cross-service dashboards, long scans, and stream transforms in the
  platform analytics layer.

**Acceptance gate.** The docs and validators make it clear when a requested read
belongs in QSM/Graph IR versus external analytics/search.

## QSM vs external analytics boundary

QSM owns:

- Service-local read models needed by command validation.
- Passive projections from own or foreign service events when the owning
  service needs that data locally.
- Derived projections whose freshness is part of service behavior.

External analytics/search owns:

- Cross-service reporting with no command-path dependency.
- Large-window analytics, BI dashboards, and stream-to-stream transforms.
- Full enterprise search beyond a small SQLite FTS5 service-local baseline.

Reverse test: if removing the projection would break a command precondition or a
service-local UI workflow, it can belong in QSM. If it only powers reporting,
default out of QSM.

## Open questions

1. Should explicit cursor pagination be a new operator or a validated desugaring
   over `Filter + Sort + Limit`? Recommended default: explicit operator, because
   UI/contracts need the semantic signal.
2. Do stable graph node IDs live in source artifacts or compiler output?
   Recommended default: compiler output/view model, with user layout stored
   separately.
3. What is the smallest derived-projection grammar beyond event-delta UPSERTs
   that a canonical workflow demo truly needs? Do not grow it for commerce
   hypotheticals without a pilot.
