# @rntme/seed

Load and validate a declarative `seed.json` of event envelopes against the **PDM** (aggregate and event types derived from state machines), then append them to an `@rntme/event-store` before the relay starts so seeded events flow through the normal pipeline.

## Role in the system

- Depends on:
  - `@rntme/event-store` — `EventEnvelope`, `EventStore`, `SqliteEventStore`, `ConcurrencyConflict`, and the new `appendRaw` method (see runtime-seed-design §6).
  - `@rntme/pdm` — `PdmResolver`, `EventTypeSpec`, `parsePdm`, `validatePdm`, `createPdmResolver`, `deriveEventTypes` (CLI loads `pdm.json` for context).
  - `zod` (v4) — structural parsing of the artifact in `schema.ts`.
- Consumed by:
  - `@rntme/runtime` — calls `loadSeed` during `loadService`, then `applySeed(... { mode: 'strict' })` in `startService` between `bootstrapProjections` and `relay.start()`.
  - `rntme-seed` CLI binary published from this package.
- Position in pipeline: **authoring artifact (`seed.json`) → parse → validate → applySeed(eventStore)** — runs strictly before relay/consumer start, so seeded events traverse the same `relay → bus → projection-consumer → QSM` path as live events.

## File map

```
src/
  index.ts            (entry) Public surface; re-exports types + functions.
  types.ts            SeedArtifact, SeedEventInput, ValidatedSeed, SeedError,
                      SeedErrorCode, Result<T>, ApplyMode, ApplyResult.
  schema.ts           Zod schemas (SeedArtifactSchema, SeedEventInputSchema,
                      ActorSchema). Strict mode on every object level.
  parse.ts            parseSeed: layer 1 — Zod safeParse, maps Zod issues to
                      SEED_SYNTAX_INVALID / SEED_SYNTAX_UNKNOWN_FIELD.
  validate.ts         validateSeed: layers 2 + 3 — semantic checks against
                      PDM/EventTypeSpec; per-stream state-machine simulation;
                      intra-file invariants. Calls wrapPayloads on success.
  wrap-payloads.ts    Transforms flat seed payloads into the {before, after}
                      envelope shape replayAggregateState() expects. Pass-through
                      for already-wrapped payloads.
  load.ts             loadSeed: discriminates string (path) | Buffer | object;
                      reads file with fs.readFileSync; chains parseSeed →
                      validateSeed.
  apply.ts            applySeed: layer 4 — strict (refuse non-empty store) and
                      upsertByEventId (skip eventIds already in store, then
                      eventStore.appendRaw with ignoreDuplicates: true). Maps
                      ConcurrencyConflict and SQLITE_CONSTRAINT_UNIQUE to
                      SEED_STREAM_VERSION_CONFLICT / SEED_APPLY_IO.
  builder.ts          seedBuilder: fluent SeedArtifact constructor for tests
                      and tools. Pure composition — defaults are filled by
                      validateSeed, not here.
  bin/
    cli.ts            (entry) `rntme-seed` binary: subcommands `validate` and
                      `apply`. Loads pdm.json + seed.json from an artifacts dir.
```

## Quick start

Programmatic use (real exports from `src/index.ts`):

```ts
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { SqliteEventStore } from '@rntme/event-store';
import {
  loadSeed, parseSeed, validateSeed, applySeed, seedBuilder, wrapPayloads,
  type ValidatedSeed, type ValidateCtx,
} from '@rntme/seed';

// 1. Build the validation context from a parsed PDM.
const pdmRaw = JSON.parse(readFileSync('artifacts/pdm.json', 'utf8'));
const parsedPdm = parsePdm(pdmRaw);
if (!parsedPdm.ok) throw new Error('pdm parse failed');
const validatedPdm = validatePdm(parsedPdm.value);
if (!validatedPdm.ok) throw new Error('pdm validation failed');
const ctx: ValidateCtx = {
  pdm: createPdmResolver(validatedPdm.value),
  events: deriveEventTypes(validatedPdm.value),
};

// 2a. From a file path (or Buffer, or pre-parsed object).
const fromFile = loadSeed('artifacts/seed.json', ctx);

// 2b. Or programmatically with the builder (tests/tools).
const built = seedBuilder()
  .event({
    stream: 'Project-1', aggregateType: 'Project', aggregateId: '1',
    version: 1, eventType: 'ProjectCreated',
    payload: { name: 'Acme', key: 'ACME', status: 'active' },
    occurredAt: '2026-01-01T00:00:00.000Z',
  })
  .build();
const validated = validateSeed(built, ctx);
if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

// 3. Append to an event-store BEFORE relay/consumer start.
const store = new SqliteEventStore({ filename: 'data/event-store.db' });
const result: { appliedCount: number; skippedCount: number } =
  await applySeed(validated.value, store, { mode: 'strict' });
```

CLI:

```bash
# Validate a seed fixture against a PDM fixture.
rntme-seed validate ./packages/artifacts/seed/test/fixtures

# Apply with idempotent re-run semantics.
rntme-seed apply ./packages/artifacts/seed/test/fixtures \
  --event-store ./data/event-store.db \
  --mode upsert-by-event-id
```

## API

| Export | Signature | Purpose |
| ------ | --------- | ------- |
| `parseSeed` | `(raw: unknown) => Result<SeedArtifact>` | Layer 1 — Zod structural parse of `{ seedVersion: 1, events }`. Maps `unrecognized_keys` → `SEED_SYNTAX_UNKNOWN_FIELD`; everything else → `SEED_SYNTAX_INVALID`. |
| `validateSeed` | `(artifact, ctx: ValidateCtx) => Result<ValidatedSeed>` | Layers 2 + 3 — checks each event against `PdmResolver` and `EventTypeSpec[]`, simulates state machines per stream, enforces intra-file invariants, then calls `wrapPayloads` on the surviving envelopes. |
| `loadSeed` | `(input: string \| Buffer \| object, ctx) => Result<ValidatedSeed>` | Discriminates input: string → `fs.readFileSync` + JSON parse; Buffer → JSON parse; object → use as-is. Then `parseSeed → validateSeed`. Read errors and JSON errors both surface as `SEED_SYNTAX_INVALID`. |
| `applySeed` | `(seed: ValidatedSeed, store: EventStore, opts?: { mode?: ApplyMode }) => Promise<ApplyResult>` | Layer 4 — appends envelopes via `store.appendRaw`. See **Apply modes** below. |
| `wrapPayloads` | `(envelopes, ctx) => EventEnvelope[]` | Pure transform from flat `payload` to `{ before, after }`. Already-wrapped payloads are passed through. Called internally by `validateSeed`; exported for callers that hand-roll envelopes. |
| `seedBuilder` | `() => SeedBuilder` | Fluent `SeedArtifact` constructor. `build()` returns a frozen artifact; subsequent `.event()` calls do not mutate prior snapshots. |

Types re-exported from `index.ts`: `SeedArtifact`, `SeedEventInput`, `ValidatedSeed`, `SeedError`, `SeedErrorCode`, `Result<T>`, `ApplyMode`, `ApplyResult`, `ValidateCtx`, `SeedBuilder`.

### Apply modes

- **`strict`** (runtime default): if the event log has any rows, returns a rejected promise with `{ code: 'SEED_STORE_NOT_EMPTY', ... }`. Nothing is written. The runtime catches this code and proceeds — it is the expected path on a restart of a persistent service.
- **`upsertByEventId`** (CLI default): scans existing `eventId`s, drops envelopes already present, then calls `store.appendRaw(toAppend, { ignoreDuplicates: true })`. A `(stream, version)` UNIQUE collision at a different `eventId` rolls back and surfaces as `SEED_STREAM_VERSION_CONFLICT`.

### Error codes (`SeedErrorCode`)

| Code | Layer | Meaning |
| ---- | ----- | ------- |
| `SEED_SYNTAX_INVALID` | 1 | JSON parse failure, missing required field, wrong type, malformed `occurredAt`, or Zod issue not classified below. |
| `SEED_SYNTAX_UNKNOWN_FIELD` | 1 | Extra keys at any level (Zod `unrecognized_keys`). |
| `SEED_UNKNOWN_AGGREGATE_TYPE` | 2 | `aggregateType` not in PDM. |
| `SEED_UNKNOWN_EVENT_TYPE` | 2 | `eventType` not produced by `deriveEventTypes(pdm)`, or paired with the wrong `aggregateType`. |
| `SEED_EVENT_PAYLOAD_MISMATCH` | 2 | Missing required field, extra field, null on non-nullable, or JSON type does not match PDM type (`integer`/`boolean`/`decimal`/`string`/`date`/`datetime`). |
| `SEED_STATE_MACHINE_VIOLATION` | 2 | Per-stream replay: next event's `from` set does not include current state. |
| `SEED_FIRST_EVENT_NOT_CREATION` | 2/3 | First event of a stream has `isCreation: false`. |
| `SEED_ACTOR_REQUIRED` | 2 | `actor.kind === 'user'` with empty `id`. |
| `SEED_STREAM_VERSION_GAP` | 3 | Per-stream versions not contiguous starting at 1. |
| `SEED_STREAM_VERSION_DUPLICATE` | 3 | Two events share `(stream, version)`. |
| `SEED_EVENT_ID_DUPLICATE` | 3 | Two events share `eventId` after defaults are filled. |
| `SEED_STORE_NOT_EMPTY` | 4 | `applySeed` in `strict` mode against a non-empty log. Expected rejection on restart. |
| `SEED_STREAM_VERSION_CONFLICT` | 4 | `appendRaw` hit `ConcurrencyConflict` or SQLite `UNIQUE(stream, version)`/`UNIQUE(event_id)` constraint. Transaction rolled back. |
| `SEED_APPLY_IO` | 4 | Other SQLite or I/O error during `appendRaw`. |

### CLI

Binary `rntme-seed` (declared in `package.json` `bin`, built to `dist/bin/cli.js`; the `postbuild` script normalizes a `#!/usr/bin/env bun` shebang and `chmod 0755`s the file).

| Subcommand | Flags | Effect |
| ---------- | ----- | ------ |
| `validate <artifacts-dir>` | `--path <file>` (default `seed.json`), `--json` | Reads `pdm.json` + `seed.json` from `<artifacts-dir>`. Missing `seed.json` exits 0 (with `--json` prints `[]`). Success prints `ok: <n> events`. On errors prints one `<path>: <CODE> <message>` per line, exits 1. With `--json` emits `SeedError[]` to stdout. Does not open any event-store. |
| `apply <artifacts-dir> --event-store <path>` | `--mode strict\|upsert-by-event-id` (default `upsert-by-event-id`), `--dry-run`, `--path <file>` | Validates, then opens a `SqliteEventStore` at `--event-store` and calls `applySeed`. Missing seed file exits 1. `--dry-run` prints `would apply N events (mode=<mode>)` and writes nothing. Success prints `applied=<n> skipped=<n>`. Failures print `<CODE>: <message>` on stderr and exit 1. The store handle is closed in a `finally` block. |

`buildCtx` constructs the `ValidateCtx` by parsing and validating `pdm.json` from the same directory; failure exits 1 before any seed work runs.

CLI exit codes:

| Exit | Meaning |
| ---- | ------- |
| `0` | Subcommand succeeded; or `validate` ran with no `seed.json` present. |
| `1` | Missing/invalid args, missing `pdm.json`, invalid PDM, missing seed file in `apply`, validation errors, or apply-time `SeedError`. |

## Invariants & gotchas

- **Strict mode is the runtime contract, upsert is the CLI contract.** `applySeed` defaults to `strict`; the CLI's `runApply` defaults to `upsertByEventId`. The runtime catches `SEED_STORE_NOT_EMPTY` and proceeds; CLI users get idempotent re-application. Source: `src/apply.ts` `mode = opts.mode ?? 'strict'`; `src/bin/cli.ts` `resolveApplyMode(undefined) === 'upsertByEventId'`. Spec: §5.1, §9.2.
- **`seedVersion: 1` is fixed.** `SeedArtifactSchema` uses `z.literal(1)`. Future migrations are explicitly out of scope (spec §1 non-goals). Test: `parse.test.ts` "rejects seedVersion other than 1".
- **`.strict()` on every object schema.** Extra keys at any level (`seedVersion`/`events`/event/`actor`) raise `SEED_SYNTAX_UNKNOWN_FIELD`, not silent drop. Source: `src/schema.ts`. Test: `parse.test.ts` "rejects extra keys on an event".
- **Payload validation rejects extra keys *and* missing required fields.** Allowed keys come from `EventTypeSpec.payloadFields`. Nullable is honored only for nullable fields. JSON-type mapping: `integer` → `Number.isInteger`, `decimal` → `typeof number`, `boolean` → `typeof boolean`, `string`/`date`/`datetime` → `typeof string`. Source: `src/validate.ts` `checkPayloadShape`/`matchesType`. Tests: `validate-semantic.test.ts` "missing required" and "extra key".
- **State-machine simulation sorts events per stream by `version` before walking.** File order is not assumed; the per-stream contiguous-versions check (`SEED_STREAM_VERSION_GAP`) runs separately on the unsorted set. Source: `src/validate.ts` `simulateStateMachines` `list.sort((a, b) => a.input.version - b.input.version)`.
- **First event per stream must satisfy `EventTypeSpec.isCreation`.** Otherwise `SEED_FIRST_EVENT_NOT_CREATION` is raised and the per-stream walk halts. Spec: §7.3. Test: `validate-semantic.test.ts` "archived before created".
- **`wrapPayloads` runs on the post-validation envelope list.** Flat `payload` becomes `{ before, after }`; creation events get `before: null` and `after` includes `[stateField]: spec.to`. Non-creation events accumulate per-stream state across the array. Already-wrapped payloads (object with exactly two keys `before`+`after`) are passed through untouched. Source: `src/wrap-payloads.ts`. Test: `wrap-payloads.test.ts` "skips envelopes whose payload already has {before, after}".
- **`stateField` defaults to `'status'` when the PDM state machine omits it.** Source: `src/wrap-payloads.ts` `sm?.stateField ?? 'status'`.
- **Default `eventId` is `seed:${aggregateType}:${aggregateId}:v${version}`.** Used in both `validate.ts` `normalize` and the duplicate-detector — duplicates are detected after defaults are filled. Source: `src/validate.ts`. Spec: §4.1.
- **Default `actor` is `{ kind: 'system', id: 'seed' }`; default `schemaVersion` is `1`.** Defaults are applied by `validateSeed`, not by `seedBuilder`. The builder is pure composition. Source: `src/validate.ts` `normalize`; `src/builder.ts`. Test: `validate-semantic.test.ts` "defaults eventId, actor, schemaVersion".
- **`SqliteEventStore.appendRaw` is the only write path.** Seed never touches the underlying DB handle directly — `event-store` remains the sole owner of DDL and constraints. Spec: §5.1, §6.
- **Cross-aggregate FK validation is deliberately absent.** `Issue.projectId` pointing at an unknown `Project` is not a seed error. Spec: §7.6. Belongs to a broader semantic-payload-validation effort that does not exist yet.
- **Temporal realism is not validated.** `occurredAt` may be in the future or non-monotonic per stream. Spec: §7.6.
- **`seedBuilder().build()` returns a frozen snapshot.** Subsequent `.event()` calls on the same builder do not mutate prior snapshots. Test: `builder.test.ts` "returns a frozen snapshot on build".
- **`loadSeed` argument discrimination is exact.** `Buffer.isBuffer(input)` first, then `typeof input === 'string'` (treated as a filesystem path), else assumed pre-parsed object. The runtime reads files itself and passes the parsed object form; the CLI uses the path form. Source: `src/load.ts`. Spec: §5.2.

## Out of scope / known limits

- **No authoring sugar.** No `commands: []` (dispatch through compiled command runtime) and no `rows: []` (entity insert shorthand). Envelopes only in MVP. Spec: §1 non-goals, §4.3.
- **No automatic version assignment by array index.** Authors hand-write `version: 1, 2, 3, …` per stream; the validator enforces contiguity. Spec: §4.3.
- **No `occurredAt` generation.** Timestamps are part of the declared history. Spec: §4.3.
- **No `seedVersion: 2` migrators.** Schema evolution for the artifact is a future task. Spec: §1 non-goals, §14.
- **No `rntme-seed export`, no `diff`, no watch mode, no admin UI.** Spec: §9.3, §1 non-goals.
- **No distributed coordination.** Concurrent seeds against one persistent event-store are out of scope. Spec: §1 non-goals.
- **No Postgres path.** SQLite is the forever target (project-wide rule); `appendRaw` and the constraint-error mapping are SQLite-specific. See auto-memory `rntme_turso_target.md`.
- **No `bus` or `qsm` writes from seed.** Seed writes only to the event-store; downstream state rebuilds via the same relay/consumer code that handles live events. Spec: §3.1.

## Where to look first

- "Add a new validation rule" → start at `src/validate.ts`. Layer 2 (per-event semantic) lives in the main loop; layer 3 (intra-file invariants) lives in `checkIntraFileInvariants`. Add a corresponding `SEED_*` code in `src/types.ts` `SeedErrorCode` (append, never reorder). Add a negative test under `test/unit/validate-*.test.ts`. Spec §7 lists the layer split.
- "Add a new error code" → register in `src/types.ts` `SeedErrorCode` union; emit from the layer that detects it (`parse.ts` for syntax, `validate.ts` for semantic/invariants, `apply.ts` for I/O); add a row to the **Error codes** table above; add a negative-path unit test.
- "Change apply-time behavior" → `src/apply.ts`. `mode === 'strict'` branch refuses non-empty stores; `mode === 'upsertByEventId'` reads existing IDs via `store.readRecordsFrom({ afterId: 0, limit: 1_000_000 })`. SQLite/`ConcurrencyConflict` mapping lives in `mapApplyError`.
- "Change payload wrapping" → `src/wrap-payloads.ts`. `streamState` accumulates per-stream `{ ...currentState, ...after }`. Tests in `test/unit/wrap-payloads.test.ts` cover creation, non-creation, terminal transitions, multi-stream, pass-through, and field preservation.
- "Change CLI flags or output" → `src/bin/cli.ts`. `runValidate`/`runApply` parse argv with `getFlag`; `resolveApplyMode` maps `--mode` to `ApplyMode`; `emitErrors` formats human and JSON output. CLI tests in `test/unit/cli.test.ts` use Bun to execute the built `dist/bin/cli.js`.
- "Add a fixture for a new aggregate" → `test/fixtures/minimal-pdm.json` is the synthetic PDM used by `validate-*.test.ts`, `wrap-payloads.test.ts`, `load.test.ts`, and `cli.test.ts`. It declares one entity (`Thing`) with three transitions.
- "Debug a failing seed fixture" → run `rntme-seed validate packages/artifacts/seed/test/fixtures`. Spec §11.4.
- "Trace runtime integration" → `@rntme/runtime`'s `loadService` calls `loadSeed`; `startService` calls `applySeed` between `bootstrapProjections` and `pipeline.start()`. Spec §8.

## Specs

- [`../../docs/history/specs/historical/2026-04-15-runtime-seed-design.md`](/docs/history/specs/historical/2026-04-15-runtime-seed-design.md) — historical design rationale. §3 architecture, §4 artifact, §5 public API, §6 `appendRaw`, §7 validation layers and error codes, §8 runtime integration, §9 CLI, §11 testing, §14 future work.
