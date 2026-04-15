# @rntme/seed

Load and validate a declarative `seed.json` of event envelopes against the **PDM** (aggregate and event types derived from state machines), then append them to an `@rntme/event-store`. Intended to run **before** the relay starts so seeded events flow through the normal pipeline (`event-store → relay → projection-consumer → QSM`).

Design background: [`docs/superpowers/specs/2026-04-15-runtime-seed-design.md`](../../docs/superpowers/specs/2026-04-15-runtime-seed-design.md).

## API

Exports from `@rntme/seed`:

| Export | Role |
| ------ | ---- |
| `loadSeed(input, ctx)` | Read JSON from a path, `Buffer`, or parsed object; `parseSeed` then `validateSeed`. Returns `Result<ValidatedSeed>`. |
| `parseSeed(raw)` | Zod structural parse of `seedVersion` + `events` → `Result<SeedArtifact>`. |
| `validateSeed(artifact, ctx)` | Semantic validation against `ValidateCtx` (`pdm`, `deriveEventTypes` list) → `Result<ValidatedSeed>` with normalized `EventEnvelope[]`. |
| `applySeed(seed, eventStore, opts?)` | Append envelopes to an `EventStore`. See **Apply modes** below. |
| `seedBuilder()` | Fluent builder for tests/tools: `seedBuilder().event({ ... }).build()`. |

Types: `SeedArtifact`, `SeedEventInput`, `ValidatedSeed`, `SeedError`, `SeedErrorCode`, `Result<T>`, `ApplyMode`, `ApplyResult`, `ValidateCtx`.

### Apply modes

- **`strict`** (default): refuses if the store already has any events (`SEED_STORE_NOT_EMPTY`); otherwise `appendRaw` the full seed in one shot.
- **`upsertByEventId`**: skip envelopes whose `eventId` is already present, then append the rest with `ignoreDuplicates: true` so re-applying the same seed is idempotent without duplicating `(stream, version)` rows.

## CLI

The package publishes the `rntme-seed` binary (`package.json` `"bin"`).

```bash
# Validate seed.json against pdm.json in an artifacts directory (default file: seed.json)
rntme-seed validate <artifacts-dir> [--path <file>] [--json]

# Apply to a SQLite event-store file (requires better-sqlite3 at runtime)
rntme-seed apply <artifacts-dir> --event-store <path> [--mode strict|upsert-by-event-id] [--dry-run] [--path <file>]
```

- **`validate`**: missing `seed.json` exits 0 (empty `[]` with `--json`). Loads `pdm.json` from the same directory for context.
- **`apply`**: missing seed file exits 1. `--dry-run` prints counts only.

## Error codes (`SeedErrorCode`)

| Code | Meaning |
| ---- | ------- |
| `SEED_SYNTAX_INVALID` | JSON parse failure or Zod shape violation (excluding unknown keys). |
| `SEED_SYNTAX_UNKNOWN_FIELD` | Extra keys in the artifact (Zod `unrecognized_keys`). |
| `SEED_UNKNOWN_AGGREGATE_TYPE` | `aggregateType` not in PDM. |
| `SEED_UNKNOWN_EVENT_TYPE` | `eventType` not derived from PDM state machines, or wrong aggregate pairing. |
| `SEED_EVENT_PAYLOAD_MISMATCH` | Payload does not match the event type spec. |
| `SEED_STATE_MACHINE_VIOLATION` | Sequences do not replay through declared transitions. |
| `SEED_ACTOR_REQUIRED` | Actor missing where required. |
| `SEED_STREAM_VERSION_GAP` | Non-contiguous `(stream, version)` in file order. |
| `SEED_STREAM_VERSION_DUPLICATE` | Duplicate `(stream, version)`. |
| `SEED_FIRST_EVENT_NOT_CREATION` | First event for a stream is not a creation transition. |
| `SEED_EVENT_ID_DUPLICATE` | Duplicate `eventId` in the seed file. |
| `SEED_STORE_NOT_EMPTY` | `applySeed` in **strict** mode when the store already has events. |
| `SEED_STREAM_VERSION_CONFLICT` | `appendRaw` hit optimistic / SQLite unique on `(stream, version)` or unexpected `event_id` clash. |
| `SEED_APPLY_IO` | Other store / I/O errors during apply. |

Peer dependency: **`better-sqlite3`** (used by the CLI and typical hosts; the library types against `EventStore` from `@rntme/event-store`).
