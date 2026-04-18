# @rntme/db-studio

Read-only libSQL Hrana v3 HTTP endpoint over rntme's event-store and projection SQLite handles. Lets any Hrana-compatible browser studio (libsqlstudio.com, outerbase desktop, @libsql/client) connect and browse both databases.

## Role in the system

- Depends on: `hono` (sub-router), `zod` (request parsing), `better-sqlite3` (peer, provided by caller).
- Consumed by: `@rntme/runtime` (lazy `import('@rntme/db-studio')` when `manifest.studio.enabled: true`).
- Position in pipeline: runtime surface layer, peer of `@rntme/ui-runtime`. Ships no UI bundle — external browser clients provide the UI.
- Why: operators need read-only visibility into both event log (with `_publish_cursor`, `_delivery_tracking`, event payloads) and projection tables, across `:memory:` and persistent SQLite targets, without forking Outerbase Studio (AGPL) or running a sidecar.
- Boundary: package knows nothing about PDM, QSM, or graphs — pure SQL-over-HTTP shim.

## File map

```
src/
  index.ts                   Public exports
  mount.ts                   mountStudio(app, ctx) — Hono sub-router + CORS + landing
  errors.ts                  Error codes, Result<T>, Hrana inline-error shape
  hrana/
    types.ts                 Hrana v3 type aliases (subset used)
    schema.ts                Zod pipeline-request parser
    encode.ts                SQLite value ↔ Hrana JSON codec
  whitelist/
    classify.ts              Hand-rolled SQL classifier (root keyword + CTE scan)
    pragma-allowlist.ts      Read-only PRAGMA name set
  handle/
    readonly.ts              Open readonly companion or reuse writable (:memory:)
    cap.ts                   LIMIT wrap / reject
  handler/
    pipeline.ts              Hrana pipeline dispatch
    landing.ts               GET {mountPath} HTML
test/
  unit/                      Whitelist, encode, cap, pragma-allowlist
  integration/               Mount + :memory: + CORS + target isolation
  fixtures/                  Sample SQL for integration DBs
```

## Quick start

```ts
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { mountStudio } from '@rntme/db-studio';

const app = new Hono();
const eventsDb = new Database('events.sqlite');
const qsmDb = new Database('qsm.sqlite');

mountStudio(app, {
  eventStoreDb: eventsDb,
  qsmDb,
  config: { enabled: true, mountPath: '/_studio', maxRows: 10_000 },
});
```

Then open `http://localhost:3000/_studio` — follow the on-page instructions to connect from https://libsqlstudio.com.

## API

| Method & path | Purpose |
| --- | --- |
| `GET  {mountPath}` | HTML landing page with URLs and usage note. |
| `POST {mountPath}/hrana/events/v3/pipeline` | libSQL Hrana v3 pipeline over the event-store DB. |
| `POST {mountPath}/hrana/qsm/v3/pipeline` | libSQL Hrana v3 pipeline over the projection DB. |
| `OPTIONS {mountPath}/hrana/*` | CORS preflight (responds `Access-Control-Allow-Origin: *`). |

Supported Hrana request types (MVP): `execute`, `batch`, `close`. All others → inline `DB_STUDIO_HRANA_UNSUPPORTED`.

## Invariants & gotchas

- **Read-only enforced at three layers:** SQL whitelist (root-type classifier + CTE write-body scan + PRAGMA allowlist) + readonly file-mode handle (when backing store is a file) + row cap. For `:memory:` the writable handle is reused; whitelist is the only guard — do not relax it.
- **CORS is `*` unconditionally.** Dev-only feature; no credentials; future admin-panel spec will gate.
- **No auth.** Runtime surface must not be enabled in production without a gate.
- **`load_extension(...)` not guarded.** better-sqlite3 is built without extension support; vector inert. If extension loading is ever enabled, whitelist MUST be extended.
- **Row cap is on LIMIT count, not execution time.** Heavy full-table scans are possible; not for production load.
- **Error codes are stable API.** Append-only; never reorder or delete.

## Out of scope / known limits

- Writes — ever. Violates CQRS.
- Hrana streams, transactions, `store_sql`, `execute_stored`, `describe`, `get_autocommit` — rejected with `DB_STUDIO_HRANA_UNSUPPORTED`.
- Custom UI bundle — external clients speak Hrana.
- Cross-DB `ATTACH`-based joins — explicitly denied.
- Query timeouts / DoS mitigation — rely on operational discipline + admin gate.
- Replay / reset — future work, goes through event-store APIs, not SQL.

## Where to look first

- "How does a query enter the package?" → `src/mount.ts` (Hono route) → `src/handler/pipeline.ts` (dispatch).
- "How is read-only enforced?" → `src/whitelist/classify.ts` + `src/whitelist/pragma-allowlist.ts` + `src/handle/readonly.ts` + `src/handle/cap.ts`.
- "How are Hrana values mapped?" → `src/hrana/encode.ts`.
- "Where does a new error code go?" → `src/errors.ts` (append only).
- "How do I add a new Hrana request type?" → `src/hrana/schema.ts` (zod union) + `src/hrana/types.ts` (TS type) + `src/handler/pipeline.ts` (dispatch).

## Specs

- [`../../docs/superpowers/specs/2026-04-18-db-studio-design.md`](../../docs/superpowers/specs/2026-04-18-db-studio-design.md) — full design doc, decision log, out-of-scope, future evolution.
