> Status: historical.
> Date: 2026-04-18.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# DB Studio — libSQL Hrana read-only endpoint for rntme runtimes

**Status:** design
**Author:** brainstorm 2026-04-18
**Related:** `rntme_turso_target` (auto-memory), `2026-04-15-runtime-packaging-design.md` (manifest schema + plugin seams), `2026-04-17-relay-dlq-delivery-tracking-design.md` (system tables visible in studio), `2026-04-18-d5-consumer-idempotency-hybrid-design.md` (ditto)

## 1. Problem

An rntme service owns two SQLite databases — an event log (`@rntme/event-store`) and a projection DB (`@rntme/projection-consumer`). During development and incident triage an operator needs to browse both: what rows exist, what's in a given `events.payload`, what's sitting in `_delivery_tracking`, what the `_idempotency_hybrid` table looks like after replay. Today there is no ergonomic way. The SQLite files can be copied and opened in a desktop tool, but that breaks for `:memory:` (current demo default), misses live state, and is friction for the common flow "boot demo, inspect state, hit an endpoint, inspect again".

Drizzle Studio was considered; it does not fit (closed-source client routed through `local.drizzle.studio`, requires a Drizzle schema we don't author, standalone process, no `:memory:` support, write-by-default). Outerbase Studio (`github.com/outerbase/studio`) is the closest open-source alternative — a browser GUI that speaks libSQL Hrana over HTTP. It is a Next.js app, not a component library, and AGPL-3.0 licensed; embedding the source is impractical.

The design question is not "what UI should we ship" but "what server-side endpoint should we ship so any Hrana-compatible browser UI — including Outerbase Studio hosted at `libsqlstudio.com` — can connect read-only to our databases".

## 2. Goal

Ship a runtime-mountable read-only libSQL Hrana v3 pipeline endpoint over both rntme databases, gated by a manifest flag, usable from any Hrana-compatible client. No custom UI in MVP — users open `libsqlstudio.com` in a browser and paste the URL.

**In scope:**
- New package `@rntme/db-studio` that exposes `mountStudio(app, ctx)`.
- Hrana v3 pipeline endpoint (`execute`, `batch`, `close`) per database target.
- Read-only enforcement via SQL whitelist + readonly file mode where possible + row cap.
- Manifest block `studio: { enabled, mountPath, maxRows }`, default `enabled: false`.
- Demo `studio.enabled: true` for `pnpm -F @rntme/issue-tracker-api-demo start`.
- Tests: unit (whitelist, hrana encoding, limit cap), integration (mount, CORS, both targets), demo e2e.

**Explicitly out of scope:**
- Writes (ever — violates CQRS).
- Replay / reset from event log (future extension).
- Custom UI bundle — browser uses `libsqlstudio.com` or equivalent.
- Auth / access control (dev-only feature; future admin-panel spec will close).
- Migration to `sqld`/Turso (separate project; see §11).
- Multi-instance / horizontally scaled rntme deployments.

## 3. Package layering

New package at the runtime-surface layer, peer of `@rntme/ui-runtime`:

```
 … existing packages …
              |
       @rntme/ui-runtime    @rntme/db-studio
              \                 /
               \               /
              @rntme/runtime
                     |
           demo/issue-tracker-api
```

One-line purpose: "libSQL Hrana-wire HTTP endpoint (read-only) over rntme's two SQLite handles, usable by any Hrana-compatible browser studio (libsqlstudio.com, outerbase studio desktop, @libsql/client)".

**Dependencies:**
- Runtime dependencies: `hono`, `zod`. SQL parser TBD at plan time (candidate: `node-sql-parser` or `sqlite-parser`; fallback: hand-rolled tokenizer — criteria in §5).
- Peer deps / injected: `better-sqlite3` `Database` handles supplied by caller.
- No rntme-package imports (`pdm`, `qsm`, etc.). The package treats SQLite as a black box.

**AGENTS.md updates:**
- §3 — package added to layering diagram with one-line purpose.
- §6 — new how-to "Browse service databases via db-studio".
- Root `README.md` — packages list entry.

## 4. HTTP surface (Hrana v3 pipeline)

Two targets mounted under `manifest.studio.mountPath` (default `/_studio`):

```
POST {mountPath}/hrana/events/v3/pipeline      → event store DB
POST {mountPath}/hrana/qsm/v3/pipeline         → projection DB
GET  {mountPath}                               → HTML landing page
OPTIONS {mountPath}/hrana/*                    → CORS preflight
```

**Pipeline request body:**
```json
{
  "baton": null,
  "requests": [
    { "type": "execute", "stmt": { "sql": "...", "args": [...], "named_args": {...} } },
    { "type": "batch",   "batch": { "steps": [ { "stmt": {...}, "condition": null }, ... ] } },
    { "type": "close" }
  ]
}
```

**Supported request types (MVP):** `execute`, `batch`, `close`.

**Unsupported (reject with Hrana inline error `DB_STUDIO_HRANA_UNSUPPORTED`):** `get_autocommit`, `describe`, `store_sql`, `execute_stored`, stream/transaction types.

**Pipeline response body:**
```json
{
  "baton": null,
  "base_url": null,
  "results": [
    {
      "type": "ok",
      "response": {
        "type": "execute",
        "result": {
          "cols": [ { "name": "id", "decltype": "INTEGER" }, ... ],
          "rows": [ [ { "type": "integer", "value": "7001" }, ... ], ... ],
          "affected_row_count": 0,
          "last_insert_rowid": null,
          "replication_index": null
        }
      }
    },
    { "type": "error", "error": { "message": "...", "code": "DB_STUDIO_READONLY_NOT_SELECT" } }
  ]
}
```

**Value encoding:**
| SQLite type | Hrana JSON |
| --- | --- |
| NULL | `{ "type": "null" }` |
| INTEGER | `{ "type": "integer", "value": "<int as string>" }` (Hrana spec requires string to preserve i64) |
| REAL | `{ "type": "float", "value": <number> }` |
| TEXT | `{ "type": "text", "value": "<string>" }` |
| BLOB | `{ "type": "blob", "base64": "<base64>" }` |

**Baton:** always respond with `null`. Stateless — each pipeline opens (or reuses) a handle and releases. Clients that expect a baton value handle `null` by reconnecting, which is fine.

**Columns metadata:** use `better-sqlite3`'s `stmt.columns()` to populate `cols`. `decltype` comes from the statement's declared type or `null` if computed.

## 5. Read-only enforcement

Defense in depth, three layers.

### 5.1 Open flags (opportunistic)

- Persistent file: open a **second** handle with `new Database(path, { readonly: true, fileMustExist: true })`. Any write statement errors at the C library (SQLITE_READONLY).
- `:memory:`: cannot open a second handle (different isolated DB). Fall back to reusing the writable handle from the event-store / projection-consumer. Whitelist (§5.2) becomes the only guard. Documented invariant.

### 5.2 SQL whitelist

Statement classifier runs before `db.prepare`. Each statement is parsed to AST; reject by root type.

**Allowed root types:**
- `SELECT` (including `WITH [RECURSIVE] … SELECT`, subqueries).
- `EXPLAIN` and `EXPLAIN QUERY PLAN` over an allowed statement.
- `PRAGMA` from the read-only allowlist: `table_info`, `table_list`, `index_list`, `index_info`, `foreign_key_list`, `schema_version`, `user_version`, `database_list`, `compile_options`, `page_count`, `page_size`, `integrity_check` (read-only form).

**Rejected (hard):** `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, `MERGE`, `CREATE`, `DROP`, `ALTER`, `ATTACH`, `DETACH`, `VACUUM`, `ANALYZE`, `REINDEX`, `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `RELEASE`, any `PRAGMA` not on the allowlist (notably `writable_schema`, `journal_mode=<write>`, `foreign_keys`, `query_only` with value — `query_only=ON` harmless but we reject for simplicity), and any `WITH … UPDATE/INSERT/DELETE` composite.

**Parser selection (decide at plan time):**
1. `node-sql-parser` with `db: 'sqlite'` — most used, has AST. Check maintenance, SQLite grammar fidelity for `WITH` + `PRAGMA`.
2. `sqlite-parser` (PEG) — SQLite-native grammar, older.
3. Hand-rolled tokenizer + root-keyword classifier — ~100 LOC; sufficient for guard semantics; loses CTE-write-body detection unless we also scan for write keywords inside `WITH`.

Selection criteria: (a) correctly classifies root type of SELECT/PRAGMA/EXPLAIN, (b) handles WITH-CTE, rejecting write-body CTE, (c) ESM-compatible, (d) active maintenance (published within 12 months), (e) MIT/BSD/ISC license.

If none pass (a) and (b), use the hand-rolled classifier plus an explicit regex pass over the raw SQL for write-keywords inside parenthesized CTE bodies. That catches the narrow class of `WITH x AS (INSERT … RETURNING …) SELECT … FROM x` attacks.

### 5.3 Row cap

- If statement is SELECT without explicit `LIMIT`: wrap as `SELECT * FROM (<user_sql>) LIMIT <maxRows>`.
- If SELECT has `LIMIT N` and `N > maxRows`: reject with `DB_STUDIO_LIMIT_TOO_LARGE` (do not silently rewrite — user should know the cap exists).
- `maxRows` defaults to 10000, configurable via `manifest.studio.maxRows` (min 1, max 1_000_000).
- EXPLAIN and PRAGMA are not wrapped (naturally bounded).

### 5.4 Error codes

Format `DB_STUDIO_<LAYER>_<KIND>` per §4 of AGENTS.md. Append-only registry; never reorder or delete.

| Code | Meaning |
| --- | --- |
| `DB_STUDIO_PARSE_SYNTAX` | SQL didn't parse |
| `DB_STUDIO_PARSE_MULTIPLE_STATEMENTS` | Multiple statements in one `stmt` — not allowed |
| `DB_STUDIO_READONLY_NOT_SELECT` | Root type not in whitelist |
| `DB_STUDIO_READONLY_PRAGMA_DENIED` | PRAGMA outside read-only allowlist |
| `DB_STUDIO_READONLY_ATTACH_DENIED` | ATTACH/DETACH rejected |
| `DB_STUDIO_READONLY_CTE_WRITE` | WITH-CTE body contains write statement |
| `DB_STUDIO_READONLY_TXN_DENIED` | BEGIN/COMMIT/ROLLBACK/SAVEPOINT rejected |
| `DB_STUDIO_LIMIT_TOO_LARGE` | Explicit LIMIT exceeds `maxRows` |
| `DB_STUDIO_SQLITE_ERROR` | Engine error (including readonly violation, if it slips through whitelist) |
| `DB_STUDIO_TARGET_UNKNOWN` | Path target not in `{events, qsm}` |
| `DB_STUDIO_HRANA_UNSUPPORTED` | Hrana request type outside `{execute, batch, close}` |
| `DB_STUDIO_HRANA_BAD_REQUEST` | Request body doesn't match Hrana v3 schema |

Surface in Hrana response as inline `{ type: "error", error: { message, code } }`. HTTP status 200 for Hrana errors (protocol convention). Non-Hrana errors (bad JSON body, missing target) use HTTP 4xx.

### 5.5 Not guarded

- `load_extension(...)` in a SELECT — better-sqlite3 is compiled without `SQLITE_ALLOW_LOAD_EXTENSION` by default, so this vector is inert. Documented as invariant. If extension loading is ever enabled, whitelist must be extended.
- Heavy full-table SELECTs — caps bound rows, not execution time. MVP: no timeout. Documented as "studio not for production load".
- Information disclosure — PII inside event payloads is visible by design (Q6, no auth).

## 6. Manifest, runtime wiring

### 6.1 Manifest schema

Extension to `packages/runtime/src/manifest/schema.ts`:

```json
"studio": {
  "enabled": false,
  "mountPath": "/_studio",
  "maxRows": 10000
}
```

- `enabled`: bool, default `false`. When `false` runtime does not import `@rntme/db-studio`.
- `mountPath`: string, default `/_studio`. Must start with `/` and not equal `/`. Consistency check: `mountPath` must not be `/`, and must not be exactly or start-with any of `/api`, `/ui`, `/health`, `/metrics` (prevents studio routes from shadowing existing surfaces). Violation → error code `RUNTIME_MANIFEST_STUDIO_PATH_CONFLICT`.
- `maxRows`: number, default 10000, min 1, max 1_000_000.

Validation runs through the standard four-layer pipeline (parse / structural / cross-ref / consistency). Only parse and consistency layers have new rules.

### 6.2 Runtime wiring

`packages/runtime/src/start/start-service.ts`, after UI mount and before `listen`:

```ts
if (config.studio?.enabled) {
  const { mountStudio } = await import('@rntme/db-studio');
  mountStudio(app, {
    eventStoreDb: eventStore.getDbHandle(),
    qsmDb: projectionConsumer.getDbHandle(),
    config: config.studio,
    logger,
  });
}
```

The dynamic import keeps `@rntme/db-studio` out of the dependency graph when `enabled: false`.

### 6.3 Exposed handles

New public getters, each with an invariant comment in the owning package README:

- `EventStore.getDbHandle(): Database` — returns the internal `better-sqlite3` handle. Comment: "Exposed for db-studio mount. Consumers must not issue writes through this handle outside event-store APIs."
- `ProjectionConsumer.getDbHandle(): Database` — same.

Rationale: narrow getter beats extending `DbDriver` interface for one feature. If a second consumer appears, promote to plugin-seam.

### 6.4 CORS

Studio responds with `Access-Control-Allow-Origin: *` unconditionally on preflight (`OPTIONS`) and actual requests. No credentials mode (auth not used — Q6 confirmed dev-only). Explicit decision, not an oversight: restricting origin frustrates ad-hoc browser clients (libsqlstudio.com, outerbase studio desktop, future dashboards); risk is accepted for dev-only feature that will move behind an admin gate later.

Preflight headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, Baton`
- `Access-Control-Max-Age: 600`

### 6.5 Landing page

`GET {mountPath}` returns a minimal HTML (inline, ~30 lines):

```
rntme DB Studio (dev-only)

Event log:
  Type: libSQL Remote (HTTP)
  URL:  <scheme>://<host>/_studio/hrana/events

Projection DB:
  Type: libSQL Remote (HTTP)
  URL:  <scheme>://<host>/_studio/hrana/qsm

Open https://libsqlstudio.com and paste the URL above.
Read-only enforced on the server.
WARNING: this endpoint has no auth; do not enable in production.
Slated to move behind an admin-panel auth gate in a future spec.
```

Scheme and host computed from request headers (`X-Forwarded-Proto`, `Host`). Not a SPA; no `@rntme/ui-runtime` dependency.

## 7. Data flow

1. Operator opens `https://libsqlstudio.com` in a browser.
2. Selects connection type "libSQL Remote (HTTP)", enters `http://localhost:3000/_studio/hrana/qsm`.
3. Browser issues preflight `OPTIONS` → studio responds with CORS headers.
4. Browser issues `POST …/v3/pipeline` with introspection queries (`SELECT name FROM sqlite_master WHERE type='table'`, `PRAGMA table_info(…)`).
5. Studio server: zod-parse body → whitelist-classify each statement → `prepare/all` on readonly handle → encode to Hrana values → return `results[]`.
6. UI renders tables and rows. User clicks a row, filters, writes a custom SELECT. All flows through the same pipeline endpoint.

## 8. Package layout

```
packages/db-studio/
  package.json
  README.md                                 (per repo template)
  tsconfig.json
  tsconfig.check.json
  src/
    index.ts                                public exports (mountStudio, types)
    mount.ts                                Hono sub-router, route wiring
    handler/
      pipeline.ts                           Hrana pipeline request dispatch
      landing.ts                            GET {mountPath} HTML
    whitelist/
      classify.ts                           SQL → verdict (allowed/rejected)
      pragma-allowlist.ts                   read-only PRAGMA set
    hrana/
      schema.ts                             zod schemas for request/response
      encode.ts                             SQLite value → Hrana JSON
      types.ts                              Hrana v3 type aliases used
    handle/
      readonly.ts                           open readonly companion or reuse writable
      cap.ts                                row-cap logic (wrap/reject)
    errors.ts                               error-code registry + toHranaError()
  test/
    unit/
      whitelist.test.ts
      hrana-encode.test.ts
      limit-cap.test.ts
      pragma-allowlist.test.ts
    integration/
      mount-studio.test.ts
      mount-studio-inmemory.test.ts
      cors.test.ts
      both-targets.test.ts
    fixtures/
      events-fixture.db
      qsm-fixture.db
```

## 9. Test matrix

**Unit (`packages/db-studio/test/unit/`):**
- `whitelist.test.ts` — every error code in §5.4: SELECT variants OK, PRAGMA OK/denied pairs, INSERT/UPDATE/DELETE/REPLACE rejection, CREATE/DROP/ALTER rejection, ATTACH rejection, CTE write-body rejection, BEGIN/COMMIT/ROLLBACK rejection.
- `hrana-encode.test.ts` — NULL/int64 (boundary i64)/float/text/blob; columns metadata; error mapping to Hrana inline-error.
- `limit-cap.test.ts` — SELECT without LIMIT → auto-wrap; SELECT with LIMIT ≤ cap → unmodified; SELECT with LIMIT > cap → reject; EXPLAIN/PRAGMA not wrapped.
- `pragma-allowlist.test.ts` — each read-only PRAGMA form allowed; write-capable forms denied.

**Integration (`packages/db-studio/test/integration/`):**
- `mount-studio.test.ts` — Hono app with fixture DBs; POST pipeline returns rows; POST write returns inline Hrana error; GET landing page returns HTML with correct URLs from `Host` header.
- `cors.test.ts` — `OPTIONS /hrana/events/v3/pipeline` returns expected headers; actual POST also carries `Access-Control-Allow-Origin: *`.
- `both-targets.test.ts` — events target queries event log tables (`events`, `_publish_cursor`, `_delivery_tracking`), qsm target queries projection tables (`projection_issue`, `user_mirror`, etc.); not crossed.

**Manifest schema (`packages/runtime/test/unit/manifest/`):**
- `studio-manifest.test.ts` — defaults, `mountPath` path-conflict detection against each reserved prefix, `maxRows` bounds.

**E2E (`demo/issue-tracker-api/test/studio-e2e.test.ts`):**
- Boot demo on `:3015` with `studio.enabled: true` + persistent SQLite.
- `GET /_studio` — HTML contains correct URLs.
- `POST /_studio/hrana/events/v3/pipeline` with `SELECT count(*) FROM events` → count > 0 (seed applied).
- `POST /_studio/hrana/qsm/v3/pipeline` with `SELECT count(*) FROM projection_issue` → 11 (7001–7011).
- `POST /_studio/hrana/qsm/v3/pipeline` with `UPDATE projection_issue SET title='hacked'` → Hrana inline error `DB_STUDIO_READONLY_NOT_SELECT`; subsequent `SELECT title FROM projection_issue WHERE issueId=7001` returns original value.
- `POST /_studio/hrana/qsm/v3/pipeline` with `ATTACH DATABASE ':memory:' AS evil` → `DB_STUDIO_READONLY_ATTACH_DENIED`.

**`:memory:` coverage:**
- Integration test `mount-studio-inmemory.test.ts` — mount on shared writable Database, verify whitelist alone prevents writes and introspection returns correct tables.

## 10. Definition of Done

- `@rntme/db-studio` exists as a package with README per repo template; `unit/` + `integration/` tests pass.
- `@rntme/runtime` extended with `studio` manifest block, lazy mount, manifest-schema tests covering conflict detection.
- `@rntme/event-store` and `@rntme/projection-consumer` export `getDbHandle()` with README invariant notes.
- Demo has `studio-e2e.test.ts` passing and (optionally) `artifacts/manifest.json` documents the opt-in.
- AGENTS.md §3 (layering), §6 (how-to browse databases), root `README.md` (packages list) updated.
- `pnpm -r run build && pnpm -r run typecheck && pnpm -r run test && pnpm -r run lint` — all green.

## 11. Out of scope and future evolution

- **Writes.** Never — violates CQRS invariants. Replay/reset from event log, if ever needed, goes through event-store APIs, not SQL.
- **Auth.** Dev-only feature. Future "admin panel" spec will introduce auth and may gate studio behind it; alternatively, studio will be deprecated when sqld/Turso migration provides native auth.
- **Custom UI.** Not built. Rely on external Hrana-speaking UIs. If demand justifies, a small embeddable UI can be added later — the endpoint is already the stable contract.
- **Turso / sqld migration.** rntme's long-term scale-out is Turso (auto-memory `rntme_turso_target`). When sqld is adopted, it exposes Hrana natively. Studio becomes either redundant (retire) or a legacy fallback (keep for in-process `:memory:` dev). Decided in that spec, not this one.
- **Load-extension guard.** Skipped because better-sqlite3 is compiled without extension support. If that changes, expand whitelist.
- **Query timeout / heavy-query DoS.** MVP documents "not for production load"; a later iteration can add a `statement_timeout` based on SQLite's `progress_handler`.
- **Schema DDL event stream.** Studio reads schema on each pipeline; clients re-fetch manually. Live schema push is a client-UI concern, not ours.
- **Replication / multi-DB views.** Studio targets two DBs independently; cross-DB joins are out of scope (would require `ATTACH`, which is denied).

## 12. Decision log (brainstorm answers)

| # | Decision | Rationale |
| - | -------- | --------- |
| Q1 | Both event log + projection DB, two targets | Operators need both write-side history and read-side current state |
| Q2 | Read-only for MVP; expand later if warranted | CQRS: writes to projections break derivation invariants |
| Q3 | Built into runtime, gated by manifest `studio.enabled` | In-process access covers `:memory:`, zero deployment complexity, easy to disable in prod |
| Q4 | Server-side Hrana endpoint + external browser UI (libsqlstudio.com) | Outerbase Studio has no library form; Hrana is the stable boundary; matches sqld future |
| Q5 | No system/user table split — show everything | `_delivery_tracking`, `_idempotency_hybrid`, `events` are exactly what operators need to debug CQRS |
| Q6 | No auth in MVP, documented "dev-only" | Acceptable for the declared scope; future admin-panel spec will close |
| Q7 | Separate `@rntme/db-studio` package | Clear role boundary; keeps `@rntme/runtime` focused on orchestration |
| Q8 | Write Hrana handler (~200 LOC) instead of migrating to sqld | Scope hygiene — Turso migration is its own project |
| Q9 | CORS `Access-Control-Allow-Origin: *` unconditional | Dev-only feature; restricting origin blocks ad-hoc tooling without meaningful security benefit at this gate |
