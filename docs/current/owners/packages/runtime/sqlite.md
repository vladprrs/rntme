# @rntme/sqlite

Shared SQLite port over `bun:sqlite`. This package is the canonical SQLite
driver boundary for runtime packages and vendor modules during the Bun-first
toolchain migration.

## Role in the system

- Depends on: `bun:sqlite` through Bun's runtime API.
- Consumed by: runtime and module packages that need SQLite access.
- Boundary: direct SQLite driver imports should stay inside this package.

## File map

```
src/
  index.ts      Public re-export surface.
  database.ts   SqliteDatabase, SqliteStatement, transactions, open helper.
  blob.ts       Buffer / Uint8Array normalization helpers.
test/
  database.test.ts  Port behavior against in-memory SQLite.
  blob.test.ts      BLOB round-trip and normalization behavior.
```

## Public API

| Export | Purpose |
| --- | --- |
| `openSqliteDatabase(opts)` | Open a Bun-backed SQLite database and return the port interface. |
| `SqliteDatabase` | Minimal database API used by rntme packages: prepare, exec, pragma, transaction, close, raw. |
| `SqliteStatement` | Prepared statement wrapper with `run`, `get`, `all`, and `finalize`. |
| `SqliteRunResult` | Normalized write result with `changes` and `lastInsertRowid`. |
| `SqliteTransaction` | Transaction function with `immediate`, `exclusive`, and `deferred` modes. |
| `toBuffer` | Normalize a SQLite BLOB result to `Buffer`. |
| `toUint8Array` | Normalize binary values to `Uint8Array`. |

## Invariants & gotchas

- `bun:sqlite` is the only concrete driver used here. Other packages should
  depend on this port instead of importing `bun:sqlite` directly.
- `strict` defaults to `true` so unbound named parameters fail instead of
  silently binding `NULL`.
- `pragma(stmt)` prefixes the supplied statement with `PRAGMA`; callers pass
  only the pragma body, for example `journal_mode = WAL`.
- `raw()` is an escape hatch for fixtures and migration code. Production code
  should use the typed port methods.
- BLOB reads may be `Uint8Array` or `Buffer` compatible. Use `toBuffer` or
  `toUint8Array` at package boundaries where representation matters.

## Local commands

```bash
bun run --filter @rntme/sqlite test
bun run --filter @rntme/sqlite typecheck
bun run --filter @rntme/sqlite build
bun run --filter @rntme/sqlite lint
```
