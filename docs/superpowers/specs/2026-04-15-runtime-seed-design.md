# rntme runtime seed — design

**Status:** Draft
**Date:** 2026-04-15
**Scope:** One new package `@rntme/seed`, one new method on `@rntme/event-store`, a lifecycle hook in `@rntme/runtime`, and the demo-side changes that close the outstanding read-side failures documented in `demo/issue-tracker-api/KNOWN_ISSUES.md`.

## 1. Goal and non-goals

### Goal

Give an rntme service a declarative way to start with a non-trivial initial state — reference data (projects, users, sprints), pre-existing event-sourced aggregates — that flows through the **same pipeline** production events use: `event-store → relay → bus → projection-consumer → QSM`. The seed must work identically under an in-memory bus (tests, demos) and a real Kafka bus (future `@rntme/bus-kafka`), so that a run against `InMemoryBus` is an honest approximation of a run against Kafka.

One mechanism must serve three use cases:

- **(A) Live demo/dev state.** Services boot with realistic content so `GET /ui` shows meaningful data on first load.
- **(B) Integration-test harness without Kafka.** Tests inject a history of events and assert on HTTP query results, exercising the full projection pipeline.
- **(C) Close the reference-data gap** (KNOWN_ISSUES §1). `Project`/`User`/`Sprint` are currently unreachable in QSM because they have no commands and no events; seed provides their bootstrap path.

### Non-goals

- Authoring sugar beyond raw event envelopes (no `commands: []` dispatch, no `rows: []` shorthand). Envelopes only in MVP.
- HTTP-exposed commands for Project/User/Sprint. State machines are added to PDM so events exist; admin endpoints are a separate task.
- Compiler fix for `wrapPredicateOptional` (KNOWN_ISSUES §3). Seed works with the current workaround (`searchIssues` using two sequential filters).
- Cross-aggregate FK validation inside seed (Issue.projectId pointing at an unknown Project is not a seed error).
- Snapshot-based seed, seed export, `diff`, watch-mode, admin UI.
- Distributed coordination of concurrent seeds against one persistent event-store.
- Schema evolution for the seed artifact itself (`seedVersion: 1` is fixed; v2 is a future task).

## 2. Background

`demo/issue-tracker-api` today has two classes of broken read-side endpoints:

- `GET /v1/issues/:id` and `GET /v1/stats/by-project` return 500 because their graphs JOIN against `projects` / `users` tables that never exist: Project/User are reference entities in PDM with no state machine, no commands, and therefore no events that would populate a QSM projection (see `packages/graph-ir-compiler/src/lower/sqlite/joins.ts:48` — joins lower against the PDM `entities[target].table` name).
- `GET /v1/issues/search` 400s without `from`/`to` because the graph marks them as `mode: "required"`.

Both were deferred pending a principled seed design in the runtime (see `demo/issue-tracker-api/KNOWN_ISSUES.md`). Separately, the runtime already has a clean plugin seam: `DbDriver`, `EventBus`, `Surface` in `packages/runtime/src/plugins/interfaces.ts`; `InMemoryBus` plays the role of Kafka in tests. The event pipeline (`wireEventPipeline`) already sequences `bootstrapProjections → relay.start → consumer.start`. Adding seed means inserting one step between `bootstrapProjections` and `relay.start`, not rewiring the pipeline.

Event-type specs are derived from PDM state-machine transitions (`packages/pdm/src/derive/event-types.ts:25`) — `deriveEventTypes` skips entities without a `stateMachine` entirely. Commands (Graph IR graphs with `emit` nodes) are a separate concern from event types. Therefore: adding a minimal state machine to Project/User/Sprint gives them event specs without requiring any commands or HTTP bindings.

## 3. Overall shape

### 3.1 Architecture

```
                               apply-order at boot
  ┌──────────────┐            ╭────────────────────────╮
  │ seed.json    │  loadSeed  │ validate syntax        │
  │ (envelopes)  │────────────▶│ validate vs PDM/events │
  └──────────────┘            │ validate vs invariants │
                              ╰────────────┬───────────╯
                                           │ ValidatedSeed
                                           ▼
                           ┌────────────────────────────┐
                           │  applySeed(eventStore)      │
                           │  — single transaction       │
                           │  — strict | upsertByEventId │
                           └──────────────┬──────────────┘
                                          │
                                          ▼
            ┌─────────────────────────────────────────────┐
            │ event-store (SqliteEventStore)              │
            └──────────┬──────────────────────────────────┘
                       │  (relay starts AFTER applySeed)
                       ▼
                  ┌─────────┐
                  │  relay  │──▶ bus (InMemoryBus | KafkaBus)
                  └─────────┘                    │
                                                 ▼
                                  projection-consumer → QSM
```

Key decisions:

- **Seed writes only to the event-store.** Never directly to the bus, never directly to QSM. The event log remains source-of-truth; if QSM is dropped and the service restarts, state rebuilds with the same code that handles live events.
- **Apply-order inside the runtime:** `bootstrapProjections(qsmDb)` → `applySeed(eventStore)` → `relay.start()` → `consumer.start()` → HTTP `listen`. The consumer starts **after** applySeed so it never polls a bus that relay has not yet filled with seeded events.
- **Package layout:** `@rntme/seed` depends only on `@rntme/event-store` (for `EventEnvelope`, `EventStore`) and `@rntme/pdm` (for `PdmResolver`, `EventTypeSpec`). It does **not** depend on runtime, projection-consumer, bindings-http, qsm, or graph-ir-compiler. `@rntme/runtime` depends on `@rntme/seed` and invokes it during lifecycle.
- **Production vs tests:** the path is identical. Runtime in production reads `artifacts/seed.json` and calls `applySeed`. Tests build `ValidatedSeed` programmatically via `seedBuilder()` and call `applySeed` against a `:memory:` event-store. No divergent code paths.

### 3.2 Package boundaries

New package: `@rntme/seed` under `packages/seed/`. Structure follows the rest of the monorepo:

```
packages/seed/
  package.json       (name: @rntme/seed, bin: { rntme-seed: ./dist/bin/cli.js })
  tsconfig.json
  tsconfig.check.json
  eslint.config.mjs
  vitest.config.ts
  README.md
  src/
    index.ts         (public exports)
    parse.ts         (parseSeed: Result<SeedArtifact>)
    validate.ts      (validateSeed: Result<ValidatedSeed>)
    apply.ts         (applySeed: Promise<ApplyResult>)
    builder.ts       (seedBuilder: programmatic construction)
    schema.ts        (zod schema for seed.json)
    types.ts         (SeedArtifact, SeedEventInput, ValidatedSeed, errors)
    bin/cli.ts       (rntme-seed CLI entry)
  test/
    unit/
      parse.test.ts
      validate.test.ts
      validate-invariants.test.ts
      apply.test.ts
      builder.test.ts
    fixtures/
      minimal-pdm.json
      seeds/*.json
```

Existing package changes: `@rntme/event-store` gains one method (`appendRaw`). `@rntme/runtime` adds a manifest block, a `ValidatedService.seed` field, and three lines in `start-service.ts`. `@rntme/issue-tracker-api-demo` gets PDM/QSM/seed edits.

## 4. Seed artifact (`seed.json`)

### 4.1 Schema

```json
{
  "seedVersion": 1,
  "events": [
    {
      "stream": "Project-1",
      "aggregateType": "Project",
      "aggregateId": "1",
      "version": 1,
      "eventType": "ProjectCreated",
      "payload": { "name": "Acme", "key": "ACME", "status": "active" },
      "actor": { "kind": "system", "id": "seed" },
      "occurredAt": "2026-01-01T00:00:00.000Z",
      "eventId": "seed:Project:1:v1",
      "schemaVersion": 1
    }
  ]
}
```

**Required per event:** `stream`, `aggregateType`, `aggregateId`, `version`, `eventType`, `payload`, `occurredAt`.

**Defaulted:**

- `eventId` → `"seed:${aggregateType}:${aggregateId}:v${version}"` (deterministic; underwrites idempotency).
- `actor` → `{ kind: "system", id: "seed" }`.
- `schemaVersion` → `1`.

**Ordering:** events apply in the order written in the array. Authors are responsible for:

- Uniqueness of `(stream, version)` within the file.
- Contiguous `version`s per stream starting at 1 (no gaps).
- Valid state-machine transitions for event-sourced aggregates (`IssueReported` before `IssueSubmitted`, etc.).

The validator (§7) enforces all three before applySeed runs.

### 4.2 Location

Default: `<artifacts-dir>/seed.json`. Overridable via `manifest.seed.path`. File is optional — its absence is not an error.

### 4.3 Explicitly out

- No `transition: "report"` shorthand that lowers to `IssueReported`.
- No automatic version assignment by array index.
- No `occurredAt` generation (timestamps are part of the declared history).
- No `commands: []` or `rows: []` sugar.

## 5. `@rntme/seed` public API

```ts
import type { EventStore, EventEnvelope } from '@rntme/event-store';
import type { PdmResolver, EventTypeSpec } from '@rntme/pdm';

export type SeedArtifact = Readonly<{
  seedVersion: 1;
  events: readonly SeedEventInput[];
}>;

export type SeedEventInput = Readonly<{
  stream: string;
  aggregateType: string;
  aggregateId: string;
  version: number;
  eventType: string;
  payload: Readonly<Record<string, unknown>>;
  occurredAt: string;
  eventId?: string;
  actor?: { kind: string; id: string };
  schemaVersion?: number;
}>;

export type ValidatedSeed = Readonly<{
  events: readonly EventEnvelope[];
}>;

export type SeedErrorCode =
  | 'SEED_SYNTAX_INVALID'
  | 'SEED_SYNTAX_UNKNOWN_FIELD'
  | 'SEED_UNKNOWN_AGGREGATE_TYPE'
  | 'SEED_UNKNOWN_EVENT_TYPE'
  | 'SEED_EVENT_PAYLOAD_MISMATCH'
  | 'SEED_STATE_MACHINE_VIOLATION'
  | 'SEED_ACTOR_REQUIRED'
  | 'SEED_STREAM_VERSION_GAP'
  | 'SEED_STREAM_VERSION_DUPLICATE'
  | 'SEED_FIRST_EVENT_NOT_CREATION'
  | 'SEED_EVENT_ID_DUPLICATE'
  | 'SEED_STORE_NOT_EMPTY'
  | 'SEED_STREAM_VERSION_CONFLICT'
  | 'SEED_APPLY_IO';

export type SeedError = Readonly<{
  code: SeedErrorCode;
  message: string;
  path?: string;
  details?: Readonly<Record<string, string>>;
}>;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: readonly SeedError[] };

export function parseSeed(raw: unknown): Result<SeedArtifact>;

export function validateSeed(
  artifact: SeedArtifact,
  ctx: { pdm: PdmResolver; events: readonly EventTypeSpec[] },
): Result<ValidatedSeed>;

export function loadSeed(
  rawOrPath: string | Buffer | unknown,
  ctx: { pdm: PdmResolver; events: readonly EventTypeSpec[] },
): Result<ValidatedSeed>;

export type ApplyMode = 'strict' | 'upsertByEventId';
export type ApplyResult = Readonly<{
  appliedCount: number;
  skippedCount: number;
}>;

export function applySeed(
  seed: ValidatedSeed,
  eventStore: EventStore,
  opts?: { mode?: ApplyMode },
): Promise<ApplyResult>;

export interface SeedBuilder {
  event(input: SeedEventInput): SeedBuilder;
  build(): SeedArtifact;
}
export function seedBuilder(): SeedBuilder;
```

### 5.1 Apply semantics

- **One transaction per `applySeed` call.** All events commit together or none do.
- **`mode: 'strict'`** (runtime default): if `SELECT count(*) FROM event_log > 0`, returns a rejected promise with `SEED_STORE_NOT_EMPTY`. Nothing is written. The runtime catches this error code specifically and silently proceeds (this is the expected path on a restart of a persistent service).
- **`mode: 'upsertByEventId'`** (CLI default): `INSERT OR IGNORE` on `event_id`. Existing events (matched by `event_id` UNIQUE) are counted as `skipped`. A `(stream, version)` UNIQUE violation at a different `event_id` aborts the transaction with `SEED_STREAM_VERSION_CONFLICT`.
- Seed never writes directly to the underlying DB handle; it goes through the new `EventStore.appendRaw` method (§6). Packages below `@rntme/seed` remain the only owners of raw SQL.

### 5.2 `loadSeed` argument discrimination

- `string` → treated as a filesystem path, read with `fs.readFileSync` and JSON-parsed.
- `Buffer` → JSON-parsed directly.
- Any other value → assumed to be a pre-parsed object.

Runtime reads the file itself (to keep IO in the runtime layer) and passes the object form to `loadSeed`. The CLI uses the string form.

### 5.3 Builder

```ts
const seed = seedBuilder()
  .event({ stream: 'Project-1', aggregateType: 'Project', aggregateId: '1',
           version: 1, eventType: 'ProjectCreated',
           payload: { name: 'Acme', key: 'ACME', status: 'active' },
           occurredAt: '2026-01-01T00:00:00.000Z' })
  .build();

const validated = validateSeed(seed, { pdm, events });
if (!validated.ok) throw new Error(JSON.stringify(validated.errors));
await applySeed(validated.value, eventStore);
```

Defaulted fields are filled in by `validateSeed`, not by the builder. The builder is pure composition.

## 6. `@rntme/event-store` extension

New method on the `EventStore` interface (and its `SqliteEventStore` implementation):

```ts
interface EventStore {
  // ...existing API...
  appendRaw(
    envelopes: readonly EventEnvelope[],
    opts?: { ignoreDuplicates?: boolean },
  ): void;
}
```

Semantics:

- Bypasses optimistic concurrency (the regular `append` checks expected version against the current head of the stream). `appendRaw` trusts the caller's `version` and `event_id` values.
- Runs within the caller's transaction when provided; otherwise opens its own.
- `ignoreDuplicates: true` → uses `INSERT OR IGNORE`; rows with colliding `event_id` are silently skipped. Rows that collide on `(stream, version)` with a different `event_id` still raise.
- `ignoreDuplicates: false | undefined` → plain `INSERT`; any UNIQUE violation raises and rolls back the transaction.

This is a targeted extension — seed is the only caller in MVP. Adding it to the public interface (rather than letting seed reach for the raw DB handle) keeps the event-store the single owner of its DDL, idempotency columns, and constraint semantics.

## 7. Validation and error codes

Three layers. Layer 1 + 2 + 3 run inside `parseSeed`/`validateSeed` and surface `SeedError[]` before any IO. Layer 4 only emits during `applySeed`.

### 7.1 Layer 1 — syntactic (`parseSeed`)

Zod-based, `.strict()` on each object.

- `SEED_SYNTAX_INVALID` — not JSON, missing required field, wrong type, malformed `occurredAt`.
- `SEED_SYNTAX_UNKNOWN_FIELD` — unexpected keys at any level.

### 7.2 Layer 2 — semantic vs PDM/event-types (`validateSeed`)

For each event:

- `SEED_UNKNOWN_AGGREGATE_TYPE` — `aggregateType` not in PDM.
- `SEED_UNKNOWN_EVENT_TYPE` — `eventType` not produced by `deriveEventTypes(pdm)`.
- `SEED_EVENT_PAYLOAD_MISMATCH` — `payload` shape (keys, types) does not match the `EventTypeSpec.payloadFields` derived from PDM. Extra keys are errors.
- `SEED_STATE_MACHINE_VIOLATION` — per-stream simulation. Walk events in the given order, track current state from the previous event's `to`, reject if the next event's `from` set does not include current state.
- `SEED_ACTOR_REQUIRED` — `actor.kind: "user"` with missing/empty `id`. `"system"` is always permitted.

### 7.3 Layer 3 — intra-file invariants (`validateSeed`, second pass)

- `SEED_STREAM_VERSION_GAP` — per-stream versions not `1, 2, 3, …`.
- `SEED_STREAM_VERSION_DUPLICATE` — two events sharing `(stream, version)`.
- `SEED_FIRST_EVENT_NOT_CREATION` — first event per stream must be a creation transition (`isCreation: true`).
- `SEED_EVENT_ID_DUPLICATE` — two events with the same `eventId` (after defaults are filled).

### 7.4 Layer 4 — apply-time (`applySeed`)

- `SEED_STORE_NOT_EMPTY` — strict mode on non-empty log. Expected error; runtime silently proceeds.
- `SEED_STREAM_VERSION_CONFLICT` — `upsertByEventId` mode, existing row has same `(stream, version)` at a different `event_id`. Transaction is rolled back.
- `SEED_APPLY_IO` — any other SQLite error.

### 7.5 Error format

```ts
{
  code: 'SEED_STATE_MACHINE_VIOLATION',
  message: 'Event "IssueAssigned" on stream "Issue-7001" at v2 requires from-state "open"; current state is "draft" after v1.',
  path: 'events[4]',
  details: {
    stream: 'Issue-7001',
    eventType: 'IssueAssigned',
    requiredFrom: 'open',
    actualFrom: 'draft',
    version: '2',
  },
}
```

Messages are actionable and self-contained — matches the existing error style in PDM, QSM, bindings.

### 7.6 Explicitly not validated

- Cross-aggregate foreign keys in payload (`Issue.projectId` pointing at an unknown Project).
- Temporal realism of `occurredAt` (future timestamps, non-monotonic within a stream).

Both are deliberate gaps: they belong in a broader semantic-payload-validation effort that currently does not exist in the monorepo.

## 8. `@rntme/runtime` integration

### 8.1 Manifest schema addition

`packages/runtime/src/manifest/schema.ts`:

```ts
seed: z
  .object({
    enabled: z.boolean().optional(),
    path: z.string().optional(),
  })
  .strict()
  .optional(),
```

Effective behavior:

- No `seed` block → runtime looks for `artifacts/seed.json`. Present → loads. Absent → skips silently.
- `seed.enabled: false` → never reads seed, even if `seed.json` exists.
- `seed.path: "seed-e2e.json"` → alternative filename within `artifacts-dir`.

### 8.2 `ValidatedService.seed`

`packages/runtime/src/types.ts`:

```ts
export type ValidatedService = Readonly<{
  // ...existing fields...
  seed: ValidatedSeed | null;
}>;
```

`loadService` parses and validates seed via `@rntme/seed` as part of the standard validation pass. Seed errors join the existing error array — a service with an invalid `seed.json` cannot start.

### 8.3 Lifecycle in `startService`

Schematic changes to `packages/runtime/src/start/start-service.ts`:

```ts
if (bus.start) await bus.start();

const pipeline = wireEventPipeline(service, db, bus);
// wireEventPipeline no longer calls pipeline.start() itself.

if (service.seed !== null && !config.skipSeed) {
  const result = await applySeed(service.seed, pipeline.eventStore, {
    mode: config.seedMode ?? 'strict',
  });
  // A SEED_STORE_NOT_EMPTY rejection in 'strict' mode is the expected
  // "already seeded on a previous boot" path: log at debug and proceed.
  // Any other rejection surfaces and fails startup.
}

pipeline.start();
// ... HTTP listen
```

Required refactor in `wireEventPipeline`: split the current combined `start()` into explicit control so the runtime can interleave applySeed between schema bootstrap and relay start. Concretely: `bootstrapProjections` stays inside `wireEventPipeline`; `relay.start()` and `consumer.start()` become callable only via the returned `pipeline.start()`, which is invoked by `startService` after applySeed.

### 8.4 RuntimeConfig

```ts
export type RuntimeConfig = {
  db?: DbDriver;
  bus?: EventBus;
  surfaces?: Surface[];
  actorFromRequest?: (c: Context) => ActorRef | null;
  onReady?: (info: { port: number }) => void;
  seedMode?: ApplyMode;   // default: 'strict'
  skipSeed?: boolean;     // default: false
};
```

`skipSeed` is a test-only escape hatch (tests that need to drive events manually). `seedMode` is exposed for advanced callers; the default `'strict'` is what all demo and production paths use.

### 8.5 Health check

`/health` returns `503 { ok: false, reason: "seeding" }` for the duration of `applySeed`, `200 { ok: true }` after. applySeed is typically sub-second, but the explicit signal matters for orchestrators (k8s readinessProbe, etc.).

## 9. `rntme-seed` CLI

Packaged in `@rntme/seed` as the `rntme-seed` bin. Two subcommands.

### 9.1 `rntme-seed validate <artifacts-dir>`

```bash
rntme-seed validate ./demo/issue-tracker-api/artifacts
# exit 0 on success
# exit 1 with errors printed (one per line), or --json for machine output
```

- Reads `seed.json` + `pdm.json` only. Does not open any event-store.
- `--path <file>` overrides the default `seed.json` filename.
- `--json` emits `SeedError[]` as JSON for CI consumption.

Intended usage: CI job per PR, catches drift between PDM changes and the seed.

### 9.2 `rntme-seed apply <artifacts-dir> --event-store <path>`

```bash
rntme-seed apply ./demo/issue-tracker-api/artifacts \
  --event-store ./data/event-store.db \
  --mode upsert-by-event-id
# prints: applied=14 skipped=0
```

- Reads `seed.json` + `pdm.json`, validates, opens the event-store at the given path, calls `applySeed({ mode })`.
- `--mode strict | upsert-by-event-id` (default `upsert-by-event-id` — CLI is the expert path).
- `--dry-run` parses/validates and prints `would apply N events`, writes nothing.
- Does **not** start relay, consumer, or QSM. Pure event-store population; the subsequent `rntme-runtime start` will discover the seeded events through the normal relay path.

### 9.3 Not in MVP

- `rntme-seed export` (reverse: event-store → seed.json).
- `rntme-seed diff`.
- Watch/reload.
- Distribution as a standalone docker image.

## 10. Demo changes (`demo/issue-tracker-api`)

### 10.1 PDM — minimal state machines for reference entities

`artifacts/pdm.json`:

- **Project**: `stateField: "status"`, `initialState: null`, transitions:
  - `created: null → active` (affects: `name`, `key`, optional `description`, `status`).
  - `closed: active → closed` (affects: `status`).
- **User**: `stateField: "status"`, transitions:
  - `created: null → active` (affects: `email`, `displayName`, `status`).
  - `deactivated: active → inactive` (affects: `status`).
- **Sprint**: `stateField: "status"`, transitions:
  - `planned: null → planned` (affects: `name`, `projectId`, `startDate`, `endDate`, `status`).
  - `started: planned → active` (affects: `status`).
  - `completed: active → completed` (affects: `status`).

Derived event types: `ProjectCreated`, `ProjectClosed`, `UserCreated`, `UserDeactivated`, `SprintPlanned`, `SprintStarted`, `SprintCompleted`.

No command graphs, no bindings. These state machines exist only to produce event-type specs for the projection consumer.

### 10.2 QSM — entity-mirror projections

`artifacts/qsm.json` adds:

- `project_mirror` → table `projects` (matches PDM `Project.table`).
- `user_mirror` → table `users`.
- `sprint_mirror` → table `sprints`.

The table name must equal the PDM entity's `table` field — `chainToSqlJoins` joins against the PDM table name, not the projection name (see KNOWN_ISSUES.md §1).

### 10.3 `artifacts/seed.json`

Representative content:

- 3 projects (`Project-1..3`), all `active`.
- 4 users (`User-1..4`), all `active`, including `alice` (id=1), `bob` (id=2).
- 2 sprints (`Sprint-1..2`), one `completed`, one `active`.
- ~10 issues across realistic states (draft/open/in_progress/resolved/closed) with full event histories (`IssueReported → IssueSubmitted → IssueAssigned → IssueResolved` etc.).

Total: ~40–60 envelopes. This is the practical upper bound for hand-edited JSON; larger seeds should be generated by tooling, out of scope here.

### 10.4 Bundled demo fixes

- `artifacts/graphs/searchIssues.json`: `from`/`to` from `mode: "required"` to `mode: "defaulted"` with wide bounds (`1970-01-01T00:00:00.000Z` / `9999-12-31T23:59:59.999Z`). Closes KNOWN_ISSUES §2.
- `demo/issue-tracker-api/README.md`: fix stale `resolve` example (needs `resolvedAt`).
- `demo/issue-tracker-api/test/smoke.test.ts`: extend to cover `/v1/ui/issues`, `/v1/issues/:id`, `/v1/stats/by-project`, `/v1/sprints/1/burndown`, and a full `report → submit → resolve` POST flow.

### 10.5 KNOWN_ISSUES.md update

After this spec lands:

- §1 (reference-JOIN 500s) → closed by seed + state machines + QSM projections.
- §2 (`searchIssues` 400) → closed.
- §3 (`wrapPredicateOptional`) → still open, linked to its own task.
- §4 (stale `/resolve` example) → closed.

## 11. Testing

### 11.1 Unit — `packages/seed/test/unit/`

Vitest, in-memory only.

- `parse.test.ts` — all `SEED_SYNTAX_*` codes with minimal fixtures (invalid JSON, missing fields, extra keys, wrong types).
- `validate.test.ts` — `SEED_UNKNOWN_*`, `SEED_EVENT_PAYLOAD_MISMATCH`, `SEED_STATE_MACHINE_VIOLATION`, `SEED_FIRST_EVENT_NOT_CREATION`, `SEED_ACTOR_REQUIRED`.
- `validate-invariants.test.ts` — `SEED_STREAM_VERSION_GAP/DUPLICATE`, `SEED_EVENT_ID_DUPLICATE`.
- `apply.test.ts` — strict mode empty/non-empty; upsert mode first-run/second-run/partial-new; mid-batch constraint violation → full rollback; atomicity assertion.
- `builder.test.ts` — defaults applied; immutability; chaining.

Each unit test fixture lives under `packages/seed/test/fixtures/` with a minimal synthetic PDM containing one entity and three transitions.

### 11.2 Integration — `packages/runtime/test/`

Extends the existing fixture under `packages/runtime/test/fixtures/issue-tracker/`. Adds a `seed.json` file and a new test module:

- `start-service-seed.test.ts`:
  - Happy path: start service with seed; `/v1/issues` returns seeded rows; `/v1/stats/by-project` returns non-zero counts.
  - Ephemeral: restart process → empty DB → seed re-applies.
  - Persistent: first start → seed applied; second start → `SEED_STORE_NOT_EMPTY` silently skipped; data still present.
  - `seed.enabled: false` — seed skipped; projections empty.
  - `seed.path: "alt.json"` — alternative file loaded.
  - `RuntimeConfig.skipSeed: true` — projections empty.
  - `/health` returns 503 during applySeed, 200 after (via a test-only delay hook in apply).
  - Invalid seed → `loadService` returns errors; service does not start.
- `wire-event-pipeline-order.test.ts`:
  - Regression: `consumer.start()` is called strictly after `applySeed` resolves.

### 11.3 E2E — `demo/issue-tracker-api/test/`

Extend `smoke.test.ts`:

- `/v1/ui/issues?limit=5` → array ≥ 1.
- `/v1/issues/7001` → 200 with projection fields.
- `/v1/stats/by-project` → array, sane counts.
- `/v1/sprints/1/burndown` → 200, array of points.
- `POST /v1/issues` + follow-on `submit` → `/v1/stats/by-project` counter increments.

### 11.4 CI contract

- `pnpm -r run test` covers unit + integration + e2e.
- New CI step: `pnpm -F @rntme/issue-tracker-api-demo exec rntme-seed validate ./artifacts`. Catches drift between PDM edits and the seed.

### 11.5 Out of scope

- Real Kafka integration tests. All buses are in-memory.
- Performance benchmarks. Seed size is small.
- Concurrent-seed race tests.

## 12. Distribution and documentation

- New package `@rntme/seed` published to the same registry (same tooling as other `@rntme/*`).
- `@rntme/runtime` Dockerfile unchanged: the runtime image does not ship the `rntme-seed` bin. Users who want CLI from the container can `docker run --entrypoint rntme-seed` or use the bin from their host install.
- Root `README.md` updates:
  - Add `@rntme/seed` row to the packages table.
  - Add `@rntme/seed` to the dependency graph (side branch, optional hook into runtime).
- `packages/seed/README.md`: usage, artifact shape, CLI, full error-code table.
- `demo/issue-tracker-api/README.md`: replace "Known issues" top-level section with a "Seed" section; keep `KNOWN_ISSUES.md` as the updated catalogue.

## 13. Definition of done

1. `pnpm -r run build && pnpm -r run typecheck && pnpm -r run test && pnpm -r run lint` green.
2. `pnpm -F @rntme/issue-tracker-api-demo start` serves sane 200 responses for all routes listed in §11.3.
3. `rntme-seed validate demo/issue-tracker-api/artifacts` exits 0.
4. `rntme-seed apply demo/issue-tracker-api/artifacts --event-store /tmp/es.db --dry-run` prints `would apply ≥40 events`.
5. `KNOWN_ISSUES.md` updated: §1, §2, §4 closed; §3 remains with a pointer to its own task.
6. All `SEED_*` error codes have at least one negative-path unit test.

## 14. Future work

- **`rntme-seed export`** — snapshot a running event-store into a `seed.json`.
- **Authoring sugar.** `commands: []` (dispatch through compiled command runtime — natural shape for event-sourced aggregates with commands) and `rows: []` (shorthand for simple entity inserts — requires a generic `<Entity>Seeded` event type or PDM extension).
- **Seed schema v2.** `seedVersion: 2` with forward/back migrators when the shape needs to evolve.
- **Cross-aggregate FK validation** — a broader semantic layer for payload reference integrity.
- **Admin HTTP bindings** for Project/User/Sprint commands (the state machines added here make these trivial when needed).
- **Fix `wrapPredicateOptional`** in `graph-ir-compiler` (KNOWN_ISSUES §3, separate task).
