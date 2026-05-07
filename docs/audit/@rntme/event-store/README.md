# Architecture audit — `@rntme/event-store`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-204` (`f7dda0e3-9f7a-4121-9b53-017ac4facd7b`) |
| **Issue title** | Audit: package architecture — @rntme/event-store |
| **Package / scope** | `@rntme/event-store` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `e9d1a653-d747-41fa-8504-26688d175c78` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: @rntme/event-store

**Verdict: needs cleanup** - the architecture is mature and meets the specifications, but there are operational risks and debt that need to be closed before production.

---

### Issue Summary

| Severity | Problem | Evidence | Impact | Recommendation |
|----------|----------|----------|--------|--------------|
| **high** | ActorRef is duplicated locally without guarantee of synchronization with @rntme/pdm | `src/types/actor.ts:8-14` - local copy of union type | Discrepancy from PDM when expanding the actor model will break the wire-format and row-mapper | Either shared `@rntme/core-types` package or CI byte-equivalence check |
| **high** | `serviceName` changes the semantics of existing events when rename | `src/store/row-mapper.ts:15-17` - `source`/`type`/`dataSchema` are derived runtime from `serviceName` | Rename service = different CE `source`/`type` for old events; consumers break down | Fix `serviceName` in `manifest.json` and add an assert at startup that the database does not contain events with another `serviceName` |
| **medium** | No runtime validation `data` (payload = `unknown`) | `src/types/envelope.ts:23` - `data: TPayload`, but append accepts `unknown` | You can write invalid JSON to `payload_json`; downstream consumers will receive a runtime error | Either JSON Schema check on append (from `@rntme/pdm deriveEventTypes`) or explicitly document that validation is the responsibility of `graph-ir-compiler` |
| **medium** | SQLite single-writer - no runtime enforcement | `src/store/sqlite.ts:27` - `journal_mode = WAL`, but no file-lock check | Two processes on one file = silent corruption | Add advisory file lock or explicit `PRAGMA lock_status` check in the constructor |
| **medium** | `appendRaw` allows non-contiguous versions without warning | `test/append-raw.test.ts:17-21` - versions 5, 7 accepted | Semantically valid for seed, but for replay/rebuild it can create “holes” in the event log | Add a `strictMode` option or `warnOnGaps` flag to `AppendRawOptions` |
| **low** | No coverage reporting | `vitest.config.ts` - none `@vitest/coverage-v8` | It is impossible to measure coverage of critical paths (relay, DLQ, concurrency) | Add `@vitest/coverage-v8` to devDeps and CI gate |
| **low** | `getDbHandle()` - footgun for db-studio | `src/store/interface.ts:44-49` + `src/store/sqlite.ts:45-52` | Write via raw handle bypasses all invariants (cursor, OCC, relay ordering) | Restrict `getDbHandle()` to read-only via `db.prepare` wrapper or `Object.freeze` with proxy |
| **low** | Package version `0.0.0` | `package.json:3` + `src/index.ts:1` | Unable to track breaking changes via semver | Start versioning; first stable - `1.0.0` |
| **low** | No snapshot/replay tooling | README §Out of scope | For large aggregates, `readStream(subject)` per command will be expensive | Add `createSnapshot`/`restoreSnapshot` API or put it in a separate package `@rntme/snapshot` |

---

### Quick wins (can be done without a product solution)

1. Add `@vitest/coverage-v8` and CI gate for >80% coverage of critical files (`sqlite.ts`, `loop.ts`, `wire-codec.ts`).
2. Version the package (`1.0.0`).
3. Add `no-console: error` to production build config (currently `warn`).
4. Replace `console.error` in relay with a structured logger interface (even if default = console).

---

### Requires Vlad's product/architectural solution

1. **ActorRef sharing**: Create `@rntme/core-types` or leave a local copy with CI verification?
2. **Event payload validation**: Where to draw the line - in `event-store` (strict) or in `graph-ir-compiler` (lenient)?
3. **Multi-writer strategy**: Leave SQLite forever (single-node) or invest in a Turso/Postgres adapter?
4. **Snapshotting**: Embed in `event-store` or a separate package?
5. **Schema evolution**: `rntSchemaVersion` is stored, but upcasting is not implemented. Is an `EventUpcaster` interface needed?

---

### Compliance with product vision

The package exactly matches vision (“safe runtime for AI-generated business workflow apps”):
- Event-sourced write-side with OCC - core invariant for consistency.
- CloudEvents 1.0 end-to-end - standardization of the wire format for integrations.
- DLQ + delivery tracking — operational safety.
- Zero internal deps - the package can be used autonomously.

### Compliance with specs

- `2026-04-17-cloudevents-envelope-design.md` §3.1-3.3 — ✅ full compliance.
- `2026-04-17-relay-dlq-delivery-tracking-design.md` §D-CURSOR, D-DLQ-RETRY - ✅ implemented.
- `2026-04-14-mutations-design.md` §1.2 — ✅ layer architecture is respected.
- `2026-04-15-runtime-packaging-design.md` §3.4 - the package is ready for plugin seam (`DbDriver`, `EventBus`).

### Test base

- **96 tests**, 16 files, all ✅.
- Covered: append (single/multi/subject), concurrency, cursor, schema, delivery tracking, relay (happy path/DLQ/restart), wire codec roundtrip, poison events, smoke E2E.
- **Gap**: there are no property-based tests for `fromCloudEventWire(toCloudEventWire(env)) === env` (the spec requires property-tested, but only unit is available).
- **Gap**: no performance/benchmark tests for append throughput.

### Summary

The package is architecturally mature, meets specifications, and passes tests. The main risks are **ActorRef drift**, **serviceName immutability**, and **lack of runtime enforcement single-writer**. It is recommended to close quick wins in the next sprint, and bring up architectural decisions for discussion before production deployment.
