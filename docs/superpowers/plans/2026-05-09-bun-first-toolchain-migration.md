# Bun-First Toolchain Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace pnpm + Node + Vitest + esbuild + tsx + better-sqlite3 with Bun as the canonical project manager, runner, test runner, bundler, runtime, Docker base, and SQLite driver — keeping `tsc` only for typecheck and `.d.ts` emit.

**Architecture:** A big-bang migration. Repo root switches to `bun install`. Each package's `build`/`test`/scripts re-target to Bun (`tsc` retained where declarations are required). A new shared `SqliteDatabase` port wraps `bun:sqlite` and replaces direct `better-sqlite3` imports across event-store, projection-consumer, runtime plugins, ai-llm/openrouter, storage/s3, qsm, graph-ir-compiler, and seed. HTTP serving moves from `@hono/node-server` to `Bun.serve`. esbuild bundling for the platform-http UI builder and ui-runtime client switches to `Bun.build`. Module provisioner entry bundles use `bun build`. Dockerfiles switch to `oven/bun:1` and drop Corepack.

**Tech Stack:** Bun (package manager, runner, bundler, test runner, sqlite driver, HTTP server, Docker base), TypeScript (typecheck + `.d.ts` emit only), Hono, `@grpc/grpc-js`, dependency-cruiser, ESLint.

---

## File Structure

This migration touches the entire workspace. The structure is grouped by responsibility:

**Root toolchain**
- Modify `package.json` (engines/packageManager/scripts), delete `pnpm-workspace.yaml`, delete `pnpm-lock.yaml` after `bun install` produces `bun.lock`.
- Modify `.github/workflows/ci.yml` (replace pnpm/setup-node steps with `oven-sh/setup-bun`).
- Modify `.github/workflows/runtime-image.yml` (no direct pnpm but inherits Dockerfile changes).
- Modify `Dockerfile.test`, `apps/platform-http/Dockerfile`, `apps/landing/Dockerfile`, `packages/runtime/runtime/Dockerfile`, `packages/runtime/runtime/Dockerfile.template`, `packages/runtime/bpmn-worker/Dockerfile`, `modules/marketing-site/static-html/Dockerfile`, `modules/storage/s3/Dockerfile`, `modules/identity/auth0/Dockerfile`, `modules/ai-llm/openrouter/Dockerfile`.
- Modify `scripts/vendor-check.mjs`, `scripts/vendor-sync.mjs` shebangs and execution path (these stay `node:fs` based — Bun runs Node-API JS files directly).
- Modify `scripts/agent-env-check.sh` (drop pnpm checks, add bun checks).

**New shared SQLite port** (replaces direct `better-sqlite3` imports)
- Create `packages/runtime/sqlite/` — a new workspace package `@rntme/sqlite` exposing `SqliteDatabase`, `SqliteStatement`, `SqliteRunResult`, `openSqliteDatabase`, `inTransaction(...)` helper, and BLOB normalization. Backed by `bun:sqlite`.
  - `packages/runtime/sqlite/package.json`
  - `packages/runtime/sqlite/tsconfig.json`
  - `packages/runtime/sqlite/tsconfig.check.json`
  - `packages/runtime/sqlite/src/index.ts`
  - `packages/runtime/sqlite/src/database.ts`
  - `packages/runtime/sqlite/src/blob.ts`
  - `packages/runtime/sqlite/test/database.test.ts`
  - `packages/runtime/sqlite/test/blob.test.ts`
  - `packages/runtime/sqlite/README.md`

**Event store / projection / runtime SQLite consumers**
- Modify `packages/runtime/event-store/package.json` (remove `better-sqlite3`, add `@rntme/sqlite` workspace dep, switch test/build).
- Modify `packages/runtime/event-store/src/store/sqlite.ts` (use port).
- Modify `packages/runtime/event-store/src/store/schema.ts` (uses port type).
- Modify `packages/runtime/event-store/src/store/row-mapper.ts` (BLOB safe).
- Modify `packages/runtime/event-store/test/**` (drop direct `Database` use; use port helper).
- Modify `packages/runtime/projection-consumer/package.json` and SQLite-using sources/tests.
- Modify `packages/runtime/runtime/src/plugins/interfaces.ts` (`DbHandle = SqliteDatabase`).
- Replace `packages/runtime/runtime/src/plugins/better-sqlite-driver.ts` → `packages/runtime/runtime/src/plugins/bun-sqlite-driver.ts`.
- Modify `packages/runtime/runtime/src/projections/seen-events-retention.ts` (port-based usage).
- Modify `packages/runtime/runtime/test/**` SQLite touches.
- Modify `packages/runtime/bindings-http/src/idempotency/cache.ts`, `src/router.ts`, `src/runtime/operation-handler.ts` (port-based DbHandle).
- Modify `packages/runtime/bindings-grpc/src/types.ts`, `src/server/handler.ts` (port-based DbHandle).
- Modify `packages/artifacts/qsm/**` SQLite touches.
- Modify `packages/artifacts/graph-ir-compiler/**` SQLite touches.
- Modify `packages/artifacts/seed/**` SQLite touches if any.

**Module SQLite consumers**
- Modify `modules/storage/s3/src/pending-store.ts` (`DatabaseLike` → port; pragma & close path).
- Modify `modules/storage/s3/test/**` (port-based).
- Modify `modules/storage/s3/package.json`.
- Modify `modules/ai-llm/openrouter/src/idempotency-store.ts` (port; BLOB Buffer↔Uint8Array normalization).
- Modify `modules/ai-llm/openrouter/test/**`.
- Modify `modules/ai-llm/openrouter/package.json`.

**Test runner migration (Vitest → bun test)**
- Delete every `vitest.config.ts` (50 files) listed by the inventory.
- Modify every `package.json` `scripts.test` from `vitest run` to `bun test`.
- Modify every test file using `vi.fn`, `vi.mock`, `vi.useFakeTimers`, `vi.spyOn` (74 files) to bun:test equivalents (`mock`, `spyOn`, `setSystemTime`).
- Add `bunfig.toml` at repo root pinning `[test] preload`, timeouts.

**HTTP serving (`Bun.serve`)**
- Modify `packages/runtime/runtime/src/start/start-service.ts` (drop `@hono/node-server`).
- Modify `packages/runtime/runtime/package.json`.
- Modify `apps/platform-http/src/bin/server.ts` and `apps/platform-http/package.json`.
- Modify `modules/identity/auth0/src/http-server.ts` and `modules/identity/auth0/package.json`.

**Bundling (esbuild → bun build)**
- Modify `packages/runtime/ui-runtime/src/build.ts` (esbuild → `Bun.build`).
- Modify `packages/runtime/ui-runtime/package.json` (drop `tsx`/`esbuild`, change `build:client`).
- Modify `apps/platform-http/src/deploy/executor.ts` (UI bundling: esbuild → `Bun.build` with workspace plugin).
- Modify `apps/platform-http/package.json` (drop `esbuild`).
- Modify `modules/marketing-site/static-html/package.json` (`build:provisioner` esbuild → bun build).
- Modify `modules/storage/s3/package.json` (`build:provisioner-entry` esbuild → bun build).
- Modify `modules/identity/auth0/package.json` (`build:provisioner` esbuild → bun build).

**Shebangs / bin entries**
- Modify any `#!/usr/bin/env node` → `#!/usr/bin/env bun` in CLI/server bin files (e.g. `apps/cli/src/bin/*`, `packages/runtime/runtime/src/bin/runtime.ts`, `modules/*/src/bin/server.ts`).

**Documentation**
- Modify `docs/decision-system.md` §3.7 (flip Bun-first from `locked-pending` to `current-default`).
- Modify `AGENTS.md` (Commands table + workflow sections).
- Modify `CLAUDE.md` (Commands table).
- Modify `README.md` (quickstart `npm install` line and any tooling text).
- Modify owner docs whose hint text changes:
  - `docs/current/owners/packages/runtime/runtime.md`
  - `docs/current/owners/packages/runtime/event-store.md`
  - `docs/current/owners/packages/runtime/projection-consumer.md`
  - `docs/current/owners/packages/runtime/bindings-http.md`
  - `docs/current/owners/packages/runtime/bindings-grpc.md`
  - `docs/current/owners/packages/runtime/ui-runtime.md`
  - `docs/current/owners/apps/cli.md`
  - `docs/current/owners/apps/platform-http.md`
  - `docs/current/owners/apps/landing.md`
  - `docs/current/owners/modules/storage/s3.md`
  - `docs/current/owners/modules/ai-llm/openrouter.md`
  - `docs/current/owners/modules/identity/auth0.md`
- Modify local README stubs that contain `pnpm -F …` hints (sweep all `**/README.md`).

**Out of scope (explicit non-goals from the spec):** raw `.ts` package consumption, removing `tsc`, rewriting `node:fs`/`node:crypto`/`Buffer`/streams calls, bulk-editing `docs/history/**`.

---

## Layout Conventions Used Below

- "Modify ... file:line" cites the current state at planning time. The engineer should re-read and locate equivalent lines if the file has drifted.
- Every command shows the expected outcome.
- TDD: tests come before implementation when behavior changes; pure migrations (rename, dependency swap) use a verify-then-cut pattern.
- Commit frequency: at the end of each task. The branch may be squashed at PR time, but per-task commits keep bisection sane.

---

## Task 1: Repo bootstrap — replace pnpm root with Bun root

**Files:**
- Modify: `package.json`
- Delete: `pnpm-workspace.yaml`
- Delete: `pnpm-lock.yaml` (after `bun.lock` is generated)
- Create: `bunfig.toml`

- [ ] **Step 1: Confirm bun is installed and on $PATH**

Run: `bun --version`
Expected: prints `1.x.x` (any 1.x). If missing, install via `curl -fsSL https://bun.sh/install | bash` and re-source the shell.

- [ ] **Step 2: Rewrite root `package.json`**

Replace the file contents with:

```json
{
  "name": "rntme",
  "version": "0.0.0",
  "private": true,
  "description": "rntme — an open, validated runtime for AI-generated business apps.",
  "license": "Apache-2.0",
  "engines": {
    "bun": ">=1.1.0"
  },
  "workspaces": [
    "packages/artifacts/*",
    "packages/runtime/*",
    "packages/platform/*",
    "packages/deploy/*",
    "packages/tooling/*",
    "packages/contracts/*/v*",
    "apps/*",
    "modules/*/*",
    "demo/*"
  ],
  "scripts": {
    "build": "bun run --filter '*' build",
    "test": "bun test",
    "typecheck": "bun run --filter '*' typecheck",
    "lint": "bun run --filter '*' lint",
    "vendor:check": "bun run scripts/vendor-check.mjs",
    "vendor:sync": "bun run scripts/vendor-sync.mjs",
    "depcruise": "bunx depcruise --config .dependency-cruiser.cjs packages modules"
  },
  "devDependencies": {
    "@rntme/seed": "workspace:*",
    "dependency-cruiser": "^17.4.0"
  }
}
```

Notes:
- `workspaces` globs match the prior `pnpm-workspace.yaml`.
- `bun run --filter '*' <script>` runs `<script>` in every workspace package that defines it; missing scripts are skipped silently.
- `bun test` at the root recurses by default — that replaces `pnpm -r run test` for unit suites once each package switches.
- `bunx depcruise` is used because `depcruise` is a dev binary; Bun resolves it from `node_modules/.bin`.

- [ ] **Step 3: Delete `pnpm-workspace.yaml`**

Run: `rm pnpm-workspace.yaml`
Expected: file removed.

- [ ] **Step 4: Create `bunfig.toml` at repo root**

Write the file:

```toml
[install]
# rntme uses workspace:* protocol exclusively for internal packages.
# Bun resolves these from the root workspaces array.

[install.scopes]
# No private registries.

[test]
# Match Vitest defaults that the codebase relies on.
timeout = 15000
preload = []
```

- [ ] **Step 5: Run `bun install` to generate `bun.lock`**

Run: `bun install`
Expected: produces `bun.lock`, populates `node_modules/`. Some workspace packages may fail their own install hooks at this point — that is OK; subsequent tasks fix per-package metadata.

- [ ] **Step 6: Delete `pnpm-lock.yaml`**

Run: `rm pnpm-lock.yaml`
Expected: file removed.

- [ ] **Step 7: Smoke check the workspace resolves**

Run: `bun pm ls --top | head -30`
Expected: lists each workspace package by name (e.g. `@rntme/event-store@workspace:packages/runtime/event-store`).

- [ ] **Step 8: Commit**

```bash
git add package.json bunfig.toml bun.lock
git rm pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore(toolchain): replace pnpm root with bun workspaces and bunfig"
```

---

## Task 2: CI — replace pnpm/setup-node with setup-bun

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace the workflow body**

Overwrite `.github/workflows/ci.yml` with:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  build-typecheck-test-lint:
    runs-on: ubuntu-latest
    env:
      TALLY_FORM_ID: ci-placeholder
      GITHUB_URL: https://github.com/vladprrs/rntme
      DOCS_URL: https://docs.rntme.com
      PLATFORM_URL: https://platform.rntme.com
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bun run typecheck
      - run: bun test
      - run: bun run lint
      - run: bun run depcruise
      - run: bun run vendor:check
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: switch from pnpm/setup-node to oven-sh/setup-bun"
```

CI will fail on this commit until package-level changes land. That is acceptable inside a feature branch; CI-green is the merge gate, not the per-commit gate.

---

## Task 3: Shared SQLite port — `@rntme/sqlite` package skeleton + tests

**Files:**
- Create: `packages/runtime/sqlite/package.json`
- Create: `packages/runtime/sqlite/tsconfig.json`
- Create: `packages/runtime/sqlite/tsconfig.check.json`
- Create: `packages/runtime/sqlite/src/index.ts`
- Create: `packages/runtime/sqlite/src/database.ts`
- Create: `packages/runtime/sqlite/src/blob.ts`
- Create: `packages/runtime/sqlite/test/database.test.ts`
- Create: `packages/runtime/sqlite/test/blob.test.ts`
- Create: `packages/runtime/sqlite/README.md`

- [ ] **Step 1: Write the failing test for the database port**

Create `packages/runtime/sqlite/test/database.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { openSqliteDatabase } from '../src/database.ts';

describe('SqliteDatabase port', () => {
  it('opens an in-memory database and runs WAL pragma', () => {
    const db = openSqliteDatabase({ filename: ':memory:' });
    db.pragma('journal_mode = WAL');
    db.close();
  });

  it('prepares with positional and named params and returns RunResult', () => {
    const db = openSqliteDatabase({ filename: ':memory:' });
    db.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, v INTEGER, n TEXT)`);
    const insertPos = db.prepare<[number, string], never>(
      'INSERT INTO t (v, n) VALUES (?, ?)',
    );
    const r1 = insertPos.run(10, 'a');
    expect(r1.changes).toBe(1);
    expect(typeof r1.lastInsertRowid === 'number' || typeof r1.lastInsertRowid === 'bigint').toBe(true);

    const insertNamed = db.prepare<{ v: number; n: string }, never>(
      'INSERT INTO t (v, n) VALUES (@v, @n)',
    );
    insertNamed.run({ v: 20, n: 'b' });

    const all = db.prepare<[], { v: number; n: string }>(
      'SELECT v, n FROM t ORDER BY id ASC',
    ).all();
    expect(all).toEqual([
      { v: 10, n: 'a' },
      { v: 20, n: 'b' },
    ]);
    db.close();
  });

  it('runs transactions and propagates errors', () => {
    const db = openSqliteDatabase({ filename: ':memory:' });
    db.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY)`);
    const insert = db.prepare<[number], never>('INSERT INTO t (id) VALUES (?)');
    const tx = db.transaction((ids: readonly number[]) => {
      for (const id of ids) insert.run(id);
      return ids.length;
    });
    expect(tx.immediate([1, 2, 3])).toBe(3);
    expect(() => tx.immediate([1])).toThrow(/UNIQUE/);
    const count = db.prepare<[], { c: number }>('SELECT COUNT(*) AS c FROM t').get();
    expect(count?.c).toBe(3);
    db.close();
  });

  it('exposes a "changes" RunResult for UPDATE statements', () => {
    const db = openSqliteDatabase({ filename: ':memory:' });
    db.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, v INTEGER)`);
    db.prepare<[number, number], never>('INSERT INTO t (id, v) VALUES (?, ?)').run(1, 10);
    const r = db.prepare<[number, number], never>('UPDATE t SET v=? WHERE id=?').run(99, 1);
    expect(r.changes).toBe(1);
    db.close();
  });
});
```

- [ ] **Step 2: Write the failing test for BLOB normalization**

Create `packages/runtime/sqlite/test/blob.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { openSqliteDatabase } from '../src/database.ts';
import { toBuffer, toUint8Array } from '../src/blob.ts';

describe('Sqlite BLOB normalization', () => {
  it('round-trips BLOBs and returns Buffer-compatible values via toBuffer', () => {
    const db = openSqliteDatabase({ filename: ':memory:' });
    db.exec(`CREATE TABLE b (k TEXT PRIMARY KEY, v BLOB)`);
    const payload = Buffer.from('hello world', 'utf8');
    db.prepare<[string, Buffer], never>('INSERT INTO b (k, v) VALUES (?, ?)').run('k1', payload);
    const row = db.prepare<[string], { v: Uint8Array | Buffer }>(
      'SELECT v FROM b WHERE k=?',
    ).get('k1');
    expect(row).toBeDefined();
    const buf = toBuffer(row!.v);
    expect(buf.toString('utf8')).toBe('hello world');
  });

  it('toUint8Array accepts Buffer or Uint8Array', () => {
    const a = toUint8Array(Buffer.from([1, 2, 3]));
    expect(Array.from(a)).toEqual([1, 2, 3]);
    const b = toUint8Array(new Uint8Array([4, 5]));
    expect(Array.from(b)).toEqual([4, 5]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail (no source yet)**

Run: `cd packages/runtime/sqlite && bun test`
Expected: FAIL — modules not found / src files missing.

- [ ] **Step 4: Write the package metadata**

Create `packages/runtime/sqlite/package.json`:

```json
{
  "name": "@rntme/sqlite",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Shared SQLite port over bun:sqlite. The only allowed SQLite driver in rntme runtime/modules.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "bun test",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.5.4",
    "eslint": "^9.10.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0"
  }
}
```

- [ ] **Step 5: Write `tsconfig.json` and `tsconfig.check.json`**

Create `packages/runtime/sqlite/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false,
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

Create `packages/runtime/sqlite/tsconfig.check.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "composite": false,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 6: Implement `database.ts`**

Create `packages/runtime/sqlite/src/database.ts`:

```ts
import { Database as BunDatabase } from 'bun:sqlite';

export type SqliteRunResult = {
  readonly changes: number;
  readonly lastInsertRowid: number | bigint;
};

export type SqliteParams = readonly unknown[] | Record<string, unknown> | undefined;

export interface SqliteStatement<P extends SqliteParams = SqliteParams, R = unknown> {
  run(...args: P extends readonly unknown[] ? P : [P]): SqliteRunResult;
  get(...args: P extends readonly unknown[] ? P : [P]): R | undefined;
  all(...args: P extends readonly unknown[] ? P : [P]): R[];
  finalize(): void;
}

export interface SqliteTransaction<A extends readonly unknown[], R> {
  (...args: A): R;
  immediate(...args: A): R;
  exclusive(...args: A): R;
  deferred(...args: A): R;
}

export interface SqliteDatabase {
  prepare<P extends SqliteParams = SqliteParams, R = unknown>(sql: string): SqliteStatement<P, R>;
  exec(sql: string): void;
  pragma(stmt: string): void;
  transaction<A extends readonly unknown[], R>(fn: (...args: A) => R): SqliteTransaction<A, R>;
  close(): void;
  /** Internal escape hatch for fixtures and migration code. Avoid in production code. */
  raw(): BunDatabase;
}

export type OpenSqliteOptions = Readonly<{
  filename: string | ':memory:';
  readonly?: boolean;
  /** When true, throws on unbound named parameters instead of binding NULL. */
  strict?: boolean;
}>;

export function openSqliteDatabase(opts: OpenSqliteOptions): SqliteDatabase {
  const db = new BunDatabase(opts.filename, {
    readonly: opts.readonly ?? false,
    strict: opts.strict ?? true,
    create: !opts.readonly,
  });

  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      return {
        run(...args: unknown[]) {
          const result = (args.length === 1 && isParamObject(args[0]))
            ? stmt.run(args[0] as Record<string, unknown>)
            : stmt.run(...(args as unknown[]));
          return {
            changes: Number(result.changes),
            lastInsertRowid: result.lastInsertRowid,
          } as SqliteRunResult;
        },
        get(...args: unknown[]) {
          return (args.length === 1 && isParamObject(args[0]))
            ? (stmt.get(args[0] as Record<string, unknown>) as never)
            : (stmt.get(...(args as unknown[])) as never);
        },
        all(...args: unknown[]) {
          return (args.length === 1 && isParamObject(args[0]))
            ? (stmt.all(args[0] as Record<string, unknown>) as never[])
            : (stmt.all(...(args as unknown[])) as never[]);
        },
        finalize() {
          stmt.finalize();
        },
      } as SqliteStatement;
    },
    exec(sql) {
      db.exec(sql);
    },
    pragma(stmt) {
      db.exec(`PRAGMA ${stmt}`);
    },
    transaction(fn) {
      const tx = db.transaction(fn);
      return tx as unknown as SqliteTransaction<never, never>;
    },
    close() {
      db.close();
    },
    raw() {
      return db;
    },
  };
}

function isParamObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array);
}
```

- [ ] **Step 7: Implement `blob.ts`**

Create `packages/runtime/sqlite/src/blob.ts`:

```ts
/** Convert a SQLite BLOB return value (Uint8Array or Buffer) to a Node Buffer. */
export function toBuffer(v: Uint8Array | Buffer): Buffer {
  if (Buffer.isBuffer(v)) return v;
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

/** Convert any binary-like into a Uint8Array (copy-free when input already is one). */
export function toUint8Array(v: Uint8Array | Buffer): Uint8Array {
  if (v instanceof Uint8Array) return v;
  return new Uint8Array(v as unknown as ArrayBufferLike);
}
```

- [ ] **Step 8: Re-export from `index.ts`**

Create `packages/runtime/sqlite/src/index.ts`:

```ts
export {
  openSqliteDatabase,
  type SqliteDatabase,
  type SqliteStatement,
  type SqliteRunResult,
  type SqliteTransaction,
  type SqliteParams,
  type OpenSqliteOptions,
} from './database.js';
export { toBuffer, toUint8Array } from './blob.js';
```

- [ ] **Step 9: Add a short README**

Create `packages/runtime/sqlite/README.md`:

```markdown
# @rntme/sqlite

Shared SQLite port over `bun:sqlite`. Re-export only — no runtime/artifact deps.

Public API: `openSqliteDatabase`, `SqliteDatabase`, `SqliteStatement`,
`SqliteRunResult`, `toBuffer`, `toUint8Array`.

Direct imports of `bun:sqlite` are forbidden outside this package; use the port.
```

- [ ] **Step 10: Run the tests**

Run: `cd packages/runtime/sqlite && bun test`
Expected: PASS — both test files green.

- [ ] **Step 11: Run typecheck and build**

Run: `cd packages/runtime/sqlite && bun run typecheck && bun run build`
Expected: PASS, `dist/index.js`, `dist/database.js`, `dist/blob.js`, `dist/*.d.ts` produced.

- [ ] **Step 12: Reinstall to register the new workspace**

Run: `bun install`
Expected: `bun.lock` updated.

- [ ] **Step 13: Commit**

```bash
git add packages/runtime/sqlite bun.lock
git commit -m "feat(sqlite): add @rntme/sqlite port over bun:sqlite"
```

---

## Task 4: Migrate `@rntme/event-store` to the SQLite port

**Files:**
- Modify: `packages/runtime/event-store/package.json`
- Modify: `packages/runtime/event-store/src/store/sqlite.ts`
- Modify: `packages/runtime/event-store/src/store/schema.ts`
- Modify: `packages/runtime/event-store/src/store/row-mapper.ts`
- Modify: `packages/runtime/event-store/test/**` (every test file that imports `better-sqlite3`)

- [ ] **Step 1: Replace dependencies in `package.json`**

In `packages/runtime/event-store/package.json`:
- Remove `"better-sqlite3"` from `dependencies`.
- Remove `"@types/better-sqlite3"` from `devDependencies`.
- Remove `"vitest"` from `devDependencies`.
- Add `"@rntme/sqlite": "workspace:*"` to `dependencies`.
- Add `"@types/bun": "latest"` to `devDependencies`.
- Change `scripts.test` from `"vitest run"` to `"bun test"`; remove `scripts["test:watch"]`.

The resulting file:

```json
{
  "name": "@rntme/event-store",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "SQLite-backed event store + relay for event-sourced write-side. Provides EventStore interface, optimistic concurrency, and Kafka-agnostic publication loop.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "bun test",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@rntme/sqlite": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Delete `packages/runtime/event-store/vitest.config.ts`**

Run: `rm packages/runtime/event-store/vitest.config.ts`

- [ ] **Step 3: Rewrite `src/store/sqlite.ts` to use the port**

Edit `packages/runtime/event-store/src/store/sqlite.ts`:
- Replace the imports:
  ```ts
  import { resolve } from 'node:path';
  import { openSqliteDatabase, type SqliteDatabase } from '@rntme/sqlite';
  import type { EventEnvelope } from '../types/envelope.js';
  // ... unchanged
  ```
- Replace the `private readonly db: BetterSqliteDatabase` declaration with `private readonly db: SqliteDatabase`.
- Replace `new Database(options.filename)` with `openSqliteDatabase({ filename: options.filename })`.
- Replace `db.pragma('journal_mode = WAL')` with `db.pragma('journal_mode = WAL')` (signature unchanged — port accepts the same string).
- Replace the `db.transaction(...).immediate(...)` calls with the same — port keeps the contract.
- Replace `Database.RunResult` reference at line 100 with the port's `SqliteRunResult`:
  ```ts
  let info: import('@rntme/sqlite').SqliteRunResult;
  ```
- Replace `rawDb(): BetterSqliteDatabase` with `rawDb(): SqliteDatabase` (return the port; tests must adapt).
- Replace the `mapSqliteError` `(err as Error & { code?: string }).code ?? ''` block with the same string-pattern matching, but also add fallback message detection because Bun's SQLite driver does not always set `.code`. The signature `mapSqliteError` stays the same; broaden the unique-constraint match:

  ```ts
  if (
    code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    code === 'SQLITE_CONSTRAINT' ||
    /UNIQUE constraint failed/i.test(msg)
  ) {
    if (/event_id/.test(msg)) {
      return new DuplicateEventId(eventId ?? '<unknown>');
    }
    if (/subject.*version|version.*subject/.test(msg)) {
      return new ConcurrencyConflict(subject, expectedVersion, attemptedVersion);
    }
  }
  ```

  And in the `appendRaw` `catch (err)` block, broaden:

  ```ts
  if (
    opts?.ignoreDuplicates &&
    (code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      code === 'SQLITE_CONSTRAINT' ||
      /UNIQUE constraint failed/i.test(msg)) &&
    /event_id/.test(msg)
  ) {
    continue;
  }
  ```

- The `ensureServiceName` helper signature changes from `(db: BetterSqliteDatabase, …)` to `(db: SqliteDatabase, …)` — body otherwise unchanged because it only uses `db.prepare(...).get(...)` and `.run(...)` which the port preserves.

- [ ] **Step 4: Update `src/store/schema.ts`**

In `packages/runtime/event-store/src/store/schema.ts`:
- Replace `import type { Database as BetterSqliteDatabase } from 'better-sqlite3'` (if present) with `import type { SqliteDatabase } from '@rntme/sqlite'`.
- Replace every `BetterSqliteDatabase` parameter type with `SqliteDatabase`.

- [ ] **Step 5: Update `src/store/row-mapper.ts`**

In `packages/runtime/event-store/src/store/row-mapper.ts`:
- If it imports any `better-sqlite3` types, swap them for the port. Add no new behavior.

- [ ] **Step 6: Convert tests from Vitest to Bun**

For every file under `packages/runtime/event-store/test/`:
- Replace `import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'` with `import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'`.
- Replace `vi.fn(...)` with `mock(...)`.
- Replace `vi.mock(modulePath, factory)` with Bun's `mock.module(modulePath, factory)`.
- Replace `vi.useFakeTimers()` / `vi.advanceTimersByTime(n)` with explicit injectable clocks where practical, or `Bun.setSystemTime(new Date(t))` and `Bun.setSystemTime()` to reset.
- Replace any direct `import Database from 'better-sqlite3'` with `import { openSqliteDatabase } from '@rntme/sqlite'` and `new Database(':memory:')` with `openSqliteDatabase({ filename: ':memory:' })`.
- Replace `(db as any).prepare(...)` with `db.prepare(...)`.

Run: `rg -n "vitest|better-sqlite3|vi\." packages/runtime/event-store/test`
Expected: no matches.

- [ ] **Step 7: Run the test suite**

Run: `cd packages/runtime/event-store && bun test`
Expected: PASS — append, read, cursor, delivery, schema, mapping, single-writer guard tests all green.

- [ ] **Step 8: Run typecheck and build**

Run: `cd packages/runtime/event-store && bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/runtime/event-store
git rm packages/runtime/event-store/vitest.config.ts 2>/dev/null || true
git commit -m "refactor(event-store): switch to @rntme/sqlite port and bun test"
```

---

## Task 5: Migrate `@rntme/projection-consumer` to the SQLite port + bun test

**Files:**
- Modify: `packages/runtime/projection-consumer/package.json`
- Modify: every `.ts` under `packages/runtime/projection-consumer/src/` that imports `better-sqlite3`
- Modify: every test file under `packages/runtime/projection-consumer/test/`
- Delete: `packages/runtime/projection-consumer/vitest.config.ts`

- [ ] **Step 1: Identify the imports**

Run: `rg -n "better-sqlite3|vitest|vi\." packages/runtime/projection-consumer`
Expected: prints every line that needs editing — record the set.

- [ ] **Step 2: Update `package.json`**

Apply the same edit pattern as Task 4 Step 1 (drop `better-sqlite3`, drop `@types/better-sqlite3`, drop `vitest`, add `@rntme/sqlite` workspace dep, add `@types/bun`, switch `test` to `bun test`, remove `test:watch`).

- [ ] **Step 3: Delete `vitest.config.ts`**

Run: `rm packages/runtime/projection-consumer/vitest.config.ts`

- [ ] **Step 4: Replace imports in src**

For every src file from Step 1, replace:
- `import Database from 'better-sqlite3'` → `import { openSqliteDatabase, type SqliteDatabase } from '@rntme/sqlite'`.
- `import type { Database as BetterSqliteDatabase } from 'better-sqlite3'` → `import type { SqliteDatabase } from '@rntme/sqlite'`.
- All `BetterSqliteDatabase` type uses → `SqliteDatabase`.
- `new Database(path)` → `openSqliteDatabase({ filename: path })`.
- `Database.RunResult` → `import('@rntme/sqlite').SqliteRunResult`.

- [ ] **Step 5: Convert tests**

Apply the Task 4 Step 6 conversion to every test under `packages/runtime/projection-consumer/test/`.

Run: `rg -n "vitest|better-sqlite3|vi\." packages/runtime/projection-consumer/test`
Expected: no matches.

- [ ] **Step 6: Run the test suite**

Run: `cd packages/runtime/projection-consumer && bun test`
Expected: PASS — bootstrap, consumer-loop, apply-*, seen-events DDL, smoke tests all green.

- [ ] **Step 7: Typecheck and build**

Run: `cd packages/runtime/projection-consumer && bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/runtime/projection-consumer
git rm packages/runtime/projection-consumer/vitest.config.ts 2>/dev/null || true
git commit -m "refactor(projection-consumer): switch to @rntme/sqlite port and bun test"
```

---

## Task 6: Migrate `@rntme/runtime` SQLite driver and DbHandle type

**Files:**
- Modify: `packages/runtime/runtime/package.json`
- Modify: `packages/runtime/runtime/src/plugins/interfaces.ts`
- Replace: `packages/runtime/runtime/src/plugins/better-sqlite-driver.ts` → `packages/runtime/runtime/src/plugins/bun-sqlite-driver.ts`
- Modify: `packages/runtime/runtime/src/start/start-service.ts`
- Modify: `packages/runtime/runtime/src/projections/seen-events-retention.ts`
- Modify: every test under `packages/runtime/runtime/test/` that imports `better-sqlite3`
- Delete: `packages/runtime/runtime/vitest.config.ts`

- [ ] **Step 1: Identify the imports**

Run: `rg -n "better-sqlite3|BetterSqlite3|BetterSqliteDriver" packages/runtime/runtime`
Expected: lists every site that needs editing.

- [ ] **Step 2: Update `package.json`**

In `packages/runtime/runtime/package.json`:
- Drop `better-sqlite3` from `dependencies`.
- Drop `@types/better-sqlite3`, `vitest` from `devDependencies`.
- Add `@rntme/sqlite": "workspace:*"` to `dependencies`.
- Add `@types/bun": "latest"` to `devDependencies`.
- Change `scripts.test` to `"bun test"`; remove `test:watch`.

- [ ] **Step 3: Replace `interfaces.ts` `DbHandle`**

Edit `packages/runtime/runtime/src/plugins/interfaces.ts`:
- Replace lines 1-8:
  ```ts
  import type { Hono, Context } from 'hono';
  import type { SqliteDatabase } from '@rntme/sqlite';
  import type { EventStore, KafkaProducer, ActorRef } from '@rntme/event-store';
  import type { KafkaConsumer } from '@rntme/projection-consumer';
  import type { ValidatedService } from '../types.js';

  /** Narrow slice of SQLite used by event-store + projection-consumer + graph-ir-compiler. */
  export type DbHandle = SqliteDatabase;
  ```
- Leave the rest of the file unchanged.

- [ ] **Step 4: Rename driver file**

Run:
```bash
git mv packages/runtime/runtime/src/plugins/better-sqlite-driver.ts \
       packages/runtime/runtime/src/plugins/bun-sqlite-driver.ts
```

- [ ] **Step 5: Replace driver implementation**

Overwrite `packages/runtime/runtime/src/plugins/bun-sqlite-driver.ts`:

```ts
import { openSqliteDatabase } from '@rntme/sqlite';
import type { DbDriver, DbHandle, DbOpenOpts } from './interfaces.js';

export class BunSqliteDriver implements DbDriver {
  open(opts: DbOpenOpts): DbHandle {
    return openSqliteDatabase({ filename: opts.path });
  }
}
```

- [ ] **Step 6: Update `start-service.ts`**

In `packages/runtime/runtime/src/start/start-service.ts`:
- Replace `import { BetterSqliteDriver } from '../plugins/better-sqlite-driver.js'` with `import { BunSqliteDriver } from '../plugins/bun-sqlite-driver.js'`.
- Replace `new BetterSqliteDriver()` with `new BunSqliteDriver()`.
- Note: `serve` from `@hono/node-server` stays here for now — the HTTP serve swap is Task 12.

- [ ] **Step 7: Update other src consumers**

Run: `rg -n "BetterSqliteDriver|better-sqlite-driver" packages/runtime/runtime/src`
Expected: empty after the renames. Fix any remaining hit.

- [ ] **Step 8: Update `projections/seen-events-retention.ts` and any other internal SQLite users**

Replace any `BetterSqlite3.Database` type with `SqliteDatabase`. The runtime function bodies that call `db.prepare(...).run(...)` / `.all(...)` / `.get(...)` are already port-compatible — no behavior change.

- [ ] **Step 9: Convert tests**

For every file under `packages/runtime/runtime/test/`:
- Apply the Vitest → bun:test conversion (Task 4 Step 6).
- Replace `import Database from 'better-sqlite3'` with `import { openSqliteDatabase } from '@rntme/sqlite'`.
- Replace driver fixture `new BetterSqliteDriver()` with `new BunSqliteDriver()`.

Run: `rg -n "vitest|better-sqlite3|BetterSqlite|vi\." packages/runtime/runtime/test`
Expected: no matches.

Delete `packages/runtime/runtime/vitest.config.ts`:

```bash
rm packages/runtime/runtime/vitest.config.ts
```

- [ ] **Step 10: Run unit tests**

Run: `cd packages/runtime/runtime && bun test`
Expected: PASS.

- [ ] **Step 11: Typecheck and build**

Run: `cd packages/runtime/runtime && bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add packages/runtime/runtime
git rm packages/runtime/runtime/vitest.config.ts 2>/dev/null || true
git commit -m "refactor(runtime): swap better-sqlite3 driver for bun:sqlite via @rntme/sqlite"
```

---

## Task 7: Migrate `bindings-http` and `bindings-grpc` types and tests

**Files:**
- Modify: `packages/runtime/bindings-http/package.json`
- Modify: `packages/runtime/bindings-http/src/idempotency/cache.ts`, `src/router.ts`, `src/runtime/operation-handler.ts` (and any other file that types DbHandle)
- Modify: `packages/runtime/bindings-http/test/**`
- Delete: `packages/runtime/bindings-http/vitest.config.ts`
- Modify: `packages/runtime/bindings-grpc/package.json`
- Modify: `packages/runtime/bindings-grpc/src/types.ts`, `src/server/handler.ts`
- Modify: `packages/runtime/bindings-grpc/test/**`
- Delete: `packages/runtime/bindings-grpc/vitest.config.ts`

- [ ] **Step 1: Identify imports**

Run: `rg -n "better-sqlite3|BetterSqlite|vitest|vi\." packages/runtime/bindings-http packages/runtime/bindings-grpc`
Expected: lists every site.

- [ ] **Step 2: Apply per-package metadata edit**

For both `bindings-http/package.json` and `bindings-grpc/package.json`:
- Drop `better-sqlite3` and `@types/better-sqlite3` and `vitest`.
- Add `@rntme/sqlite": "workspace:*"` to `dependencies` (or to `peerDependencies` if the package only uses the type — for bindings-http use a real dep).
- Add `@types/bun": "latest"` to `devDependencies`.
- Switch `scripts.test` to `bun test`. Remove `test:watch`.

- [ ] **Step 3: Replace src type imports**

In every src file from Step 1:
- `import type BetterSqlite3 from 'better-sqlite3'` → `import type { SqliteDatabase } from '@rntme/sqlite'`.
- `BetterSqlite3.Database` type → `SqliteDatabase`.
- `import Database from 'better-sqlite3'` (if any) → `import { openSqliteDatabase } from '@rntme/sqlite'`.
- `new Database(path)` → `openSqliteDatabase({ filename: path })`.

- [ ] **Step 4: Convert tests**

Apply the Vitest → bun:test conversion to every test under both `test/` trees.

Run: `rg -n "vitest|better-sqlite3|BetterSqlite|vi\." packages/runtime/bindings-http/test packages/runtime/bindings-grpc/test`
Expected: empty.

Delete the two vitest configs:

```bash
rm packages/runtime/bindings-http/vitest.config.ts packages/runtime/bindings-grpc/vitest.config.ts
```

- [ ] **Step 5: Run tests for both packages**

Run: `cd packages/runtime/bindings-http && bun test && cd ../bindings-grpc && bun test`
Expected: PASS for both.

- [ ] **Step 6: Typecheck and build both**

Run: `cd packages/runtime/bindings-http && bun run typecheck && bun run build && cd ../bindings-grpc && bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/bindings-http packages/runtime/bindings-grpc
git rm packages/runtime/bindings-http/vitest.config.ts packages/runtime/bindings-grpc/vitest.config.ts 2>/dev/null || true
git commit -m "refactor(bindings): switch http+grpc bindings to @rntme/sqlite and bun test"
```

---

## Task 8: Migrate `qsm`, `graph-ir-compiler`, `seed`, `_shared` artifacts SQLite + tests

**Files:**
- Modify: `packages/artifacts/qsm/package.json` and SQLite-using sources/tests; delete `vitest.config.ts`.
- Modify: `packages/artifacts/graph-ir-compiler/package.json` and SQLite-using sources/tests; delete `vitest.config.ts`.
- Modify: `packages/artifacts/seed/package.json` and tests; delete `vitest.config.ts`.
- Modify: `packages/artifacts/_shared/package.json` and tests; delete `vitest.config.ts`.
- Modify: `packages/artifacts/blueprint/package.json` and tests; delete `vitest.config.ts`.
- Modify: `packages/artifacts/init/package.json` and tests; delete `vitest.config.ts`.
- Modify: `packages/artifacts/bindings/package.json` and tests; delete `vitest.config.ts`.

- [ ] **Step 1: Identify SQLite imports across artifacts**

Run: `rg -n "better-sqlite3|BetterSqlite" packages/artifacts`
Expected: lists qsm + graph-ir-compiler + seed + any other consumer.

- [ ] **Step 2: Apply the per-package metadata edit (Task 4 Step 1) to each of qsm, graph-ir-compiler, seed, _shared, blueprint, init, bindings package.json**

For each: drop `better-sqlite3`, `@types/better-sqlite3`, `vitest`. Add `@rntme/sqlite": "workspace:*"` (only where the package actually uses SQLite — qsm and graph-ir-compiler at minimum). Add `@types/bun": "latest"`. Switch `scripts.test` to `bun test`.

- [ ] **Step 3: Replace src imports across artifacts**

Same `import` swap as Task 4 Step 3 for every artifact src file from Step 1.

- [ ] **Step 4: Convert artifact tests**

For every test under `packages/artifacts/*/test/`, apply the Vitest → bun:test conversion (Task 4 Step 6).

Run: `rg -n "vitest|better-sqlite3|BetterSqlite|vi\." packages/artifacts`
Expected: empty.

- [ ] **Step 5: Delete artifact vitest configs**

Run:

```bash
find packages/artifacts -name vitest.config.ts -delete
```

- [ ] **Step 6: Run the artifact test suites**

Run: `bun run --filter '@rntme/qsm' --filter '@rntme/graph-ir-compiler' --filter '@rntme/seed' --filter '@rntme/blueprint' --filter '@rntme/init' --filter '@rntme/bindings' --filter '@rntme/_shared' test`
Expected: every package passes.

- [ ] **Step 7: Typecheck and build artifacts**

Run: `bun run --filter '@rntme/qsm' --filter '@rntme/graph-ir-compiler' --filter '@rntme/seed' --filter '@rntme/blueprint' --filter '@rntme/init' --filter '@rntme/bindings' --filter '@rntme/_shared' typecheck`
Then: `bun run --filter '@rntme/qsm' --filter '@rntme/graph-ir-compiler' --filter '@rntme/seed' --filter '@rntme/blueprint' --filter '@rntme/init' --filter '@rntme/bindings' --filter '@rntme/_shared' build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/artifacts
git commit -m "refactor(artifacts): switch SQLite consumers to @rntme/sqlite and bun test"
```

---

## Task 9: Migrate `modules/storage/s3` `pending-store` to the port + bun test

**Files:**
- Modify: `modules/storage/s3/package.json`
- Modify: `modules/storage/s3/src/pending-store.ts`
- Modify: `modules/storage/s3/test/**`
- Delete: `modules/storage/s3/vitest.config.ts`

- [ ] **Step 1: Update `package.json`**

In `modules/storage/s3/package.json`:
- Drop `better-sqlite3` and `@types/better-sqlite3` from deps.
- Drop `vitest` from devDeps; keep `esbuild` here for now (Task 14 swaps it).
- Add `@rntme/sqlite": "workspace:*"` to `dependencies`.
- Add `@types/bun": "latest"` to `devDependencies`.
- Switch `scripts.test` to `bun test`.

- [ ] **Step 2: Refactor `pending-store.ts` to use the port**

Edit `modules/storage/s3/src/pending-store.ts`:
- Replace the local `DbRunResult`, `Stmt`, and `DatabaseLike` definitions with a re-export from the port:

  ```ts
  import type { SqliteDatabase, SqliteRunResult } from '@rntme/sqlite';

  export type DatabaseLike = SqliteDatabase;
  export type FileState = 'pending' | 'committed' | 'aborted' | 'deleted';
  ```
- Keep the public `PendingStore` interface and `createPendingStore({ db, now })` signature unchanged.
- Replace `db.pragma?.('journal_mode = WAL')` with `db.pragma('journal_mode = WAL')` (the port always supports `pragma`).
- Replace `(db as unknown as { close?(): void }).close?.()` in `close()` with `db.close()` (port always has `close`).
- Replace `db.prepare<...>(...)` with the same call shape — the port preserves the generic.

- [ ] **Step 3: Update tests**

For every test under `modules/storage/s3/test/`:
- Apply the Vitest → bun:test conversion (Task 4 Step 6).
- Replace `new Database(':memory:')` and `db as unknown as DatabaseLike` with `openSqliteDatabase({ filename: ':memory:' })`.

Run: `rg -n "vitest|better-sqlite3|vi\." modules/storage/s3/test`
Expected: empty.

Delete `modules/storage/s3/vitest.config.ts`:

```bash
rm modules/storage/s3/vitest.config.ts
```

- [ ] **Step 4: Run tests**

Run: `cd modules/storage/s3 && bun test`
Expected: PASS — pending-store, handler, sweeper, provisioner, startup-ensure all green.

- [ ] **Step 5: Typecheck and build**

Run: `cd modules/storage/s3 && bun run typecheck && bun run build`
Expected: PASS (provisioner-entry build still uses esbuild — that swaps in Task 14, but build still works).

- [ ] **Step 6: Commit**

```bash
git add modules/storage/s3
git rm modules/storage/s3/vitest.config.ts 2>/dev/null || true
git commit -m "refactor(storage-s3): switch pending-store to @rntme/sqlite and bun test"
```

---

## Task 10: Migrate `modules/ai-llm/openrouter` idempotency-store + BLOB normalization

**Files:**
- Modify: `modules/ai-llm/openrouter/package.json`
- Modify: `modules/ai-llm/openrouter/src/idempotency-store.ts`
- Modify: `modules/ai-llm/openrouter/test/**`
- Delete: `modules/ai-llm/openrouter/vitest.config.ts`

- [ ] **Step 1: Write the failing BLOB round-trip test**

Add to `modules/ai-llm/openrouter/test/unit/idempotency-store.blob.test.ts` (create if missing):

```ts
import { describe, expect, it } from 'bun:test';
import { createIdempotencyStore } from '../../src/idempotency-store.js';

describe('IdempotencyStore (sqlite) BLOB round trip', () => {
  it('returns the exact bytes on get() as a Buffer', async () => {
    const store = createIdempotencyStore({
      mode: 'sqlite',
      path: ':memory:',
      ttlMs: 60_000,
      now: () => 1_000_000,
    });
    const payload = Buffer.from([0x00, 0x01, 0x02, 0xff, 0x7f]);
    await store.put('k1', payload);
    const got = await store.get('k1');
    expect(Buffer.isBuffer(got)).toBe(true);
    expect(got!.equals(payload)).toBe(true);
    await store.close();
  });
});
```

- [ ] **Step 2: Run the test — it should fail (file did not exist before)**

Run: `cd modules/ai-llm/openrouter && bun test test/unit/idempotency-store.blob.test.ts`
Expected: FAIL or pass-but-wrong-shape — the current implementation predates the BLOB normalization rule under `bun:sqlite`.

- [ ] **Step 3: Update `package.json`**

In `modules/ai-llm/openrouter/package.json`:
- Drop `better-sqlite3`, `@types/better-sqlite3`, `vitest`.
- Add `@rntme/sqlite": "workspace:*"` to `dependencies`.
- Add `@types/bun": "latest"` to `devDependencies`.
- Switch `scripts.test` to `bun test`.

- [ ] **Step 4: Rewrite `src/idempotency-store.ts` to use the port + BLOB helpers**

Replace the file body:

```ts
import { openSqliteDatabase, toBuffer, toUint8Array, type SqliteDatabase } from '@rntme/sqlite';

export interface IdempotencyStore {
  get(key: string): Promise<Buffer | null>;
  put(key: string, payload: Buffer): Promise<void>;
  evictExpired(): Promise<number>;
  close(): Promise<void>;
}

export type IdempotencyStoreOptions =
  | { mode: 'sqlite'; path: string; ttlMs: number; now?: () => number }
  | { mode: 'memory'; ttlMs: number; now?: () => number };

const DEFAULT_NOW = (): number => Date.now();

export function createIdempotencyStore(opts: IdempotencyStoreOptions): IdempotencyStore {
  const now = opts.now ?? DEFAULT_NOW;
  if (opts.mode === 'memory') return createMemoryStore(opts.ttlMs, now);
  return createSqliteStore(opts.path, opts.ttlMs, now);
}

function createMemoryStore(ttlMs: number, now: () => number): IdempotencyStore {
  const map = new Map<string, { bytes: Buffer; createdAt: number }>();
  return {
    async get(key) {
      const row = map.get(key);
      if (!row) return null;
      if (now() - row.createdAt > ttlMs) {
        map.delete(key);
        return null;
      }
      return row.bytes;
    },
    async put(key, payload) {
      map.set(key, { bytes: payload, createdAt: now() });
    },
    async evictExpired() {
      let removed = 0;
      const cutoff = now() - ttlMs;
      for (const [k, v] of map.entries()) {
        if (v.createdAt < cutoff) {
          map.delete(k);
          removed++;
        }
      }
      return removed;
    },
    async close() {
      map.clear();
    },
  };
}

function createSqliteStore(path: string, ttlMs: number, now: () => number): IdempotencyStore {
  const db: SqliteDatabase = openSqliteDatabase({ filename: path });
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS idempotency_records (
      idempotency_key TEXT PRIMARY KEY,
      completion_proto BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_created_at ON idempotency_records(created_at);
  `);

  const stmtGet = db.prepare<[string, number], { completion_proto: Uint8Array | Buffer }>(
    `SELECT completion_proto FROM idempotency_records WHERE idempotency_key = ? AND created_at >= ?`,
  );
  const stmtPut = db.prepare<[string, Uint8Array, number]>(
    `INSERT OR REPLACE INTO idempotency_records (idempotency_key, completion_proto, created_at) VALUES (?, ?, ?)`,
  );
  const stmtEvict = db.prepare<[number]>(
    `DELETE FROM idempotency_records WHERE created_at < ?`,
  );

  return {
    async get(key) {
      const row = stmtGet.get(key, now() - ttlMs);
      if (row?.completion_proto === undefined) return null;
      return toBuffer(row.completion_proto);
    },
    async put(key, payload) {
      stmtPut.run(key, toUint8Array(payload), now());
    },
    async evictExpired() {
      const info = stmtEvict.run(now() - ttlMs);
      return info.changes;
    },
    async close() {
      db.close();
    },
  };
}
```

- [ ] **Step 5: Convert tests under `modules/ai-llm/openrouter/test/`**

Apply the Vitest → bun:test conversion. Replace direct `new Database(...)` with `openSqliteDatabase(...)` if any.

Run: `rg -n "vitest|better-sqlite3|vi\." modules/ai-llm/openrouter/test`
Expected: empty.

Delete `modules/ai-llm/openrouter/vitest.config.ts`.

- [ ] **Step 6: Run tests**

Run: `cd modules/ai-llm/openrouter && bun test`
Expected: PASS — including the new `idempotency-store.blob.test.ts`.

- [ ] **Step 7: Typecheck and build**

Run: `cd modules/ai-llm/openrouter && bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add modules/ai-llm/openrouter
git rm modules/ai-llm/openrouter/vitest.config.ts 2>/dev/null || true
git commit -m "refactor(ai-llm-openrouter): switch idempotency-store to @rntme/sqlite with BLOB normalization"
```

---

## Task 11: Migrate remaining vitest packages to `bun test` (no SQLite involvement)

**Files:**
- Modify: `package.json` of every remaining package whose `scripts.test` is `vitest run`.
- Delete: every remaining `vitest.config.ts`.
- Modify: every test file using Vitest API (`vi.fn`, `vi.mock`, `vi.useFakeTimers`, `vi.spyOn`, `vi.advanceTimersByTime`).

- [ ] **Step 1: Inventory the remaining vitest configs and test imports**

Run: `find . -name vitest.config.ts -not -path "./node_modules/*" -not -path "./.claude/*"`
Expected: prints the still-existing configs after Tasks 4-10. Save the list — it covers: `apps/landing`, `apps/cli`, `apps/platform-http`, `modules/identity/clerk`, `modules/identity/auth0`, `modules/identity/conformance`, `modules/ai-llm/conformance`, `modules/analytics/google-analytics`, `modules/crm/bitrix24`, `modules/crm/amocrm`, `demo/cv-extract-blueprint`, `packages/tooling/module-scaffold`, `packages/tooling/bundle-publish`, `packages/runtime/ui-runtime`, `packages/runtime/bpmn-worker`, `packages/deploy/deploy-dokploy`, `packages/platform/platform-storage`, `packages/platform/platform-core`, plus any not yet swept.

Run: `rg -nl "from 'vitest'" --glob '!node_modules' --glob '!.claude'`
Expected: lists all test files that still import from Vitest.

- [ ] **Step 2: Per-package metadata sweep**

For each package from Step 1:
- Drop `vitest` from `devDependencies`.
- Add `@types/bun": "latest"` to `devDependencies` (if not already pulled transitively).
- Change `scripts.test` from `vitest run` to `bun test`.
- Remove `scripts["test:watch"]` (Bun's `bun test --watch` is invocation-time, not script-bound).

- [ ] **Step 3: Per-test-file API conversion**

For every file from Step 1 (the Vitest import list):
- Replace `from 'vitest'` with `from 'bun:test'`. Bun re-exports `describe`, `it`, `test`, `expect`, `beforeAll`, `beforeEach`, `afterAll`, `afterEach`, `mock`, `spyOn` under that path.
- Replace `vi.fn(impl?)` with `mock(impl)`.
- Replace `vi.spyOn(obj, 'method')` with `spyOn(obj, 'method')`.
- Replace `vi.mock('module', factory)` with `mock.module('module', factory)`.
- Replace `vi.useFakeTimers()` / `vi.useRealTimers()` / `vi.advanceTimersByTime(n)` with `Bun.setSystemTime(new Date(t))` / `Bun.setSystemTime()`. If a test depends on `setTimeout` advancement (not just `Date.now`), refactor it to inject a clock — bun:test does not implement timer mocking equivalent to Vitest's fake timers.
- If a test relied on `--include`/`--exclude` glob patterns from `vitest.config.ts`, switch to `bun test path/to/file.test.ts` invocation in CI; keep the file inside `test/` so the default discovery picks it up.

For every file that uses `vi.useFakeTimers` and depends on real timer advancement:
- Where the production code accepts a `now: () => number` injection point, pass a stub clock.
- Where it does not, add an injection point now (small refactor) and call it from the production site with `() => Date.now()` as the default. Document the change in the commit body.

- [ ] **Step 4: Delete the remaining `vitest.config.ts` files**

Run: `find . -name vitest.config.ts -not -path "./node_modules/*" -not -path "./.claude/*" -delete`
Expected: every remaining vitest config removed.

- [ ] **Step 5: Verify no Vitest references remain**

Run: `rg -n "vitest|vi\.fn|vi\.mock|vi\.useFakeTimers|vi\.spyOn" --glob '!node_modules' --glob '!.claude' --glob '!docs/history' --glob '!docs/superpowers'`
Expected: empty (or only matches in fenced code blocks under historical docs that we explicitly do not bulk-edit).

- [ ] **Step 6: Run all tests at root**

Run: `bun test`
Expected: PASS across all packages. Investigate any `Bun.setSystemTime` regressions — most are tests that relied on `setTimeout` virtual advancement; either inject a clock or convert to `await Bun.sleep(0)` + explicit time injection.

- [ ] **Step 7: Run typecheck/build at root**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(tests): migrate Vitest -> bun:test across remaining workspaces"
```

---

## Task 12: Switch HTTP serving from `@hono/node-server` to `Bun.serve`

**Files:**
- Modify: `packages/runtime/runtime/package.json`
- Modify: `packages/runtime/runtime/src/start/start-service.ts`
- Modify: `apps/platform-http/package.json`
- Modify: `apps/platform-http/src/bin/server.ts`
- Modify: `modules/identity/auth0/package.json`
- Modify: `modules/identity/auth0/src/http-server.ts`

- [ ] **Step 1: Write a regression test for runtime lifecycle**

Add to `packages/runtime/runtime/test/integration/start-service-bun-serve.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { startService } from '../../src/start/start-service.js';
// Reuse the existing test fixture builder for ValidatedService.
// (engineer: locate the existing fixture used by other start-service tests
//  and import the same factory; do not invent a new one.)
import { buildMinimalValidatedServiceFixture } from '../fixtures/minimal-service.js';

describe('startService under Bun.serve', () => {
  it('binds an ephemeral port, serves /health, and stops cleanly', async () => {
    const service = buildMinimalValidatedServiceFixture({ port: 0 });
    const running = await startService(service, { skipSeed: true });
    try {
      expect(running.httpPort).toBeGreaterThan(0);
      const res = await fetch(`http://127.0.0.1:${running.httpPort}/health`);
      expect(res.status).toBe(200);
    } finally {
      await running.stop();
    }
  });
});
```

If `buildMinimalValidatedServiceFixture` does not exist, locate the equivalent already used by other start-service tests (e.g. one of the existing `*.test.ts` files in this directory) and import that factory instead. Do not duplicate logic.

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd packages/runtime/runtime && bun test test/integration/start-service-bun-serve.test.ts`
Expected: PASS (current `@hono/node-server` works) — or FAIL if the fixture import path is wrong; fix the path before continuing.

This test is a baseline; it should also pass after the swap. The point of running it now is to confirm the fixture works.

- [ ] **Step 3: Replace `serve` in `start-service.ts`**

Edit `packages/runtime/runtime/src/start/start-service.ts`:
- Remove `import { serve, type ServerType } from '@hono/node-server';`.
- At the bottom of the file remove the `closeHttpServer` helper (Bun's server has its own stop API).
- Replace lines 137-142:
  ```ts
  const listenPort = service.manifest.surface.http.port;
  const server = Bun.serve({
    port: listenPort,
    fetch: app.fetch,
  });
  const port = server.port;
  ```
- Replace the `await closeHttpServer(server, …)` call inside `stop()` with:
  ```ts
  server.stop(true);
  // Bun.serve.stop(true) closes idle connections and aborts in-flight requests.
  // For graceful shutdown semantics matching the prior @hono/node-server flow,
  // also settle any in-flight by awaiting the close promise:
  await Bun.sleep(0);
  ```
  If existing tests assert on a longer drain timeout, replace with:
  ```ts
  await stopServerWithTimeout(server, runtimeConfig.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS);
  ```
  and define the helper inside the file:
  ```ts
  async function stopServerWithTimeout(server: ReturnType<typeof Bun.serve>, timeoutMs: number): Promise<void> {
    server.stop(false);
    const start = Date.now();
    while (server.pendingRequests > 0 && Date.now() - start < timeoutMs) {
      await Bun.sleep(10);
    }
    server.stop(true);
  }
  ```

- [ ] **Step 4: Update `packages/runtime/runtime/package.json`**

Drop `@hono/node-server` from `dependencies`. Run `bun install`.

- [ ] **Step 5: Run runtime tests**

Run: `cd packages/runtime/runtime && bun test`
Expected: PASS — including the new lifecycle test and any prior shutdown-timeout tests.

- [ ] **Step 6: Replace `serve` in `apps/platform-http/src/bin/server.ts`**

Edit `apps/platform-http/src/bin/server.ts`:
- Remove `import { serve } from '@hono/node-server';`.
- Replace the `serve({ fetch: app.fetch, port: env.PORT });` call with:
  ```ts
  const server = Bun.serve({ fetch: app.fetch, port: env.PORT });
  logger.info({ port: server.port, baseUrl: env.PLATFORM_BASE_URL }, 'platform-http listening');
  // Keep a reference so the process holds the server lifetime; Bun.serve does
  // not block the event loop on its own, but the running fetch handler does.
  ```

Drop `@hono/node-server` from `apps/platform-http/package.json`. Run `bun install`.

- [ ] **Step 7: Replace `serve` in `modules/identity/auth0/src/http-server.ts`**

Edit `modules/identity/auth0/src/http-server.ts`:
- Remove `import { serve } from '@hono/node-server';` and `import type { ServerType } from '@hono/node-server';`.
- Replace any `serve({ fetch, port })` with `Bun.serve({ fetch, port })`.
- Replace the `ServerType` exported alias with `ReturnType<typeof Bun.serve>` everywhere it is referenced in this module.

Drop `@hono/node-server` from `modules/identity/auth0/package.json`. Run `bun install`.

- [ ] **Step 8: Run integration smoke for each rewritten server**

Run: `bun run --filter '@rntme/runtime' --filter '@rntme/platform-http' --filter '@rntme/identity-auth0' test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/runtime/runtime apps/platform-http modules/identity/auth0
git commit -m "refactor(http): swap @hono/node-server for Bun.serve in runtime, platform-http, auth0"
```

---

## Task 13: Replace UI build pipeline esbuild → `Bun.build` (`ui-runtime`)

**Files:**
- Modify: `packages/runtime/ui-runtime/src/build.ts`
- Modify: `packages/runtime/ui-runtime/package.json`

- [ ] **Step 1: Rewrite `src/build.ts` to use `Bun.build`**

Replace `packages/runtime/ui-runtime/src/build.ts` with:

```ts
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');

if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });
rmSync(join(buildDir, 'main.js'), { force: true });
rmSync(join(buildDir, 'main.js.map'), { force: true });

// 1. Build JS first — Tailwind needs the bundle to scan for class names.
const jsResult = await Bun.build({
  entrypoints: [join(__dirname, 'client', 'no-auth-entry.ts')],
  outdir: buildDir,
  target: 'browser',
  format: 'esm',
  splitting: false,
  minify: true,
  sourcemap: 'external',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  loader: {
    '.css': 'empty',
  },
  naming: {
    entry: 'main.js',
    chunk: 'chunks/[name]-[hash].js',
    asset: '[name]-[hash].[ext]',
  },
});

if (!jsResult.success) {
  for (const log of jsResult.logs) console.error(log);
  throw new Error('ui-runtime: Bun.build JS step failed');
}
console.log('JS built → build/main.js');

// 2. Build CSS with Tailwind CSS 4 — scans build/main.js via @source directive.
try {
  execSync(
    `bunx @tailwindcss/cli -i ${join(__dirname, 'client', 'styles.css')} -o ${join(buildDir, 'main.css')} --minify`,
    { stdio: 'inherit' },
  );
  console.log('CSS built → build/main.css');
} catch {
  console.warn('Tailwind CSS build failed — generating empty main.css');
  writeFileSync(join(buildDir, 'main.css'), '/* tailwind css build failed */\n');
}
```

Notes:
- `Bun.build` does not have an `external: []` option exactly like esbuild; defaults already exclude `node:*`. If the entry imports any package that must remain external at runtime (e.g. peer deps), add `external: [...]` accordingly. The current entry bundles everything into the browser — leave the array empty.
- Bun's loader option uses simple strings (`'empty'`). `target: 'browser'` is required.

- [ ] **Step 2: Update `packages/runtime/ui-runtime/package.json`**

- Remove `esbuild` and `tsx` from `devDependencies`.
- Change `scripts.build` to `tsc -p tsconfig.json && bun run scripts/build-client.ts` if the script needs `node:*` APIs (it does), or simply `tsc -p tsconfig.json && bun run src/build.ts` — Bun runs raw `.ts`. Concretely:

  ```json
  "scripts": {
    "build": "tsc -p tsconfig.json && bun run src/build.ts",
    "test": "bun test",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  }
  ```

- [ ] **Step 3: Smoke build**

Run: `cd packages/runtime/ui-runtime && bun run build`
Expected: PASS — `build/main.js` and `build/main.css` exist.

- [ ] **Step 4: Run tests**

Run: `cd packages/runtime/ui-runtime && bun test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/ui-runtime
git commit -m "refactor(ui-runtime): replace esbuild+tsx with Bun.build and bun run for client build"
```

---

## Task 14: Replace module provisioner-entry esbuild bundles with `bun build`

**Files:**
- Modify: `modules/marketing-site/static-html/package.json`
- Modify: `modules/storage/s3/package.json`
- Modify: `modules/identity/auth0/package.json`

- [ ] **Step 1: Replace each `build:provisioner` / `build:provisioner-entry` script**

For `modules/marketing-site/static-html/package.json`:
- Replace
  ```
  "build:provisioner": "esbuild dist/provisioner.js --bundle --platform=node --format=esm --target=node20 --external:node:* --outfile=dist/provisioner.entry.js"
  ```
  with
  ```
  "build:provisioner": "bun build dist/provisioner.js --target=bun --format=esm --outfile=dist/provisioner.entry.js"
  ```
- Drop `esbuild` from `devDependencies`.

For `modules/storage/s3/package.json`:
- Replace
  ```
  "build:provisioner-entry": "esbuild dist/provisioner/index.js --bundle --platform=node --format=esm --target=node20 --external:node:* --outfile=dist/provisioner.entry.js"
  ```
  with
  ```
  "build:provisioner-entry": "bun build dist/provisioner/index.js --target=bun --format=esm --outfile=dist/provisioner.entry.js"
  ```
- Drop `esbuild` from `devDependencies`.

For `modules/identity/auth0/package.json`:
- Replace
  ```
  "build:provisioner": "esbuild dist/provisioner.js --bundle --platform=node --format=esm --target=node20 --external:node:* --outfile=dist/provisioner.entry.js"
  ```
  with
  ```
  "build:provisioner": "bun build dist/provisioner.js --target=bun --format=esm --outfile=dist/provisioner.entry.js"
  ```
- Drop `esbuild` from `devDependencies`.

Notes:
- `bun build --target=bun` produces an ESM bundle that runs under Bun. `node:*` modules are externalized automatically; do not pass `--external:node:*`.
- The provisioner entrypoint is loaded by the platform-http executor at deploy time; the runtime is Bun in the platform container, so `--target=bun` is correct.

- [ ] **Step 2: Run module builds**

Run: `bun run --filter '@rntme/marketing-site-static' --filter '@rntme/storage-s3' --filter '@rntme/identity-auth0' build`
Expected: each module produces `dist/provisioner.entry.js`.

- [ ] **Step 3: Run module tests**

Run: `bun run --filter '@rntme/marketing-site-static' --filter '@rntme/storage-s3' --filter '@rntme/identity-auth0' test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/marketing-site/static-html modules/storage/s3 modules/identity/auth0
git commit -m "build(modules): replace esbuild provisioner bundling with bun build"
```

---

## Task 15: Replace platform-http executor UI bundling esbuild → `Bun.build`

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `apps/platform-http/package.json`

- [ ] **Step 1: Write a regression test for `bundleVirtualEntrySource`**

Add to `apps/platform-http/test/unit/deploy/bundle-virtual-entry.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Locate the existing test fixture for executor tests; reuse it. If the
// helper is not exported, export it now from the executor module under
// __testing__.bundleVirtualEntrySource so this test can call it.
import { __testing__ } from '../../../src/deploy/executor.js';

const { bundleVirtualEntrySource } = __testing__;

describe('bundleVirtualEntrySource (Bun.build)', () => {
  it('produces a main.js asset for a trivial virtual entry', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'rntme-ui-bundle-test-'));
    const out = await bundleVirtualEntrySource(
      `export const x = 1; console.log(x);`,
      rootDir,
    );
    const keys = Object.keys(out);
    expect(keys.some((k) => k === 'ui-build/main.js')).toBe(true);
    expect(keys.some((k) => k === 'ui-build/main.css')).toBe(true);
  });
});
```

- [ ] **Step 2: Expose `bundleVirtualEntrySource` for tests**

In `apps/platform-http/src/deploy/executor.ts`:
- At the bottom of the file add:
  ```ts
  export const __testing__ = { bundleVirtualEntrySource };
  ```
  (do not export it via the package's main entry — only for the test file to import directly from the file path).

- [ ] **Step 3: Run the test — it will fail (esbuild path may still work but workspace plugin is the risk; either way make it green)**

Run: `cd apps/platform-http && bun test test/unit/deploy/bundle-virtual-entry.test.ts`
Expected: PASS now (esbuild path), or FAIL if the workspace plugin assumes pnpm structure. If PASS, that is fine — we'll keep it green through the swap.

- [ ] **Step 4: Replace esbuild call with `Bun.build`**

In `apps/platform-http/src/deploy/executor.ts`:
- Remove `import { build, type Plugin } from 'esbuild';`.
- Replace the `bundleVirtualEntrySource` body:

  ```ts
  async function bundleVirtualEntrySource(
    virtualEntrySource: string,
    rootDir: string,
  ): Promise<Record<string, string>> {
    const workspaceRoot = findWorkspaceRoot();
    const outdir = join(rootDir, '.rntme-ui-build');

    const stdinFile = join(workspaceRoot, '__rntme_ui_entry.tsx');
    await import('node:fs/promises').then((fs) => fs.writeFile(stdinFile, virtualEntrySource, 'utf8'));
    try {
      const result = await Bun.build({
        entrypoints: [stdinFile],
        root: workspaceRoot,
        target: 'browser',
        format: 'esm',
        splitting: true,
        minify: true,
        sourcemap: 'none',
        outdir,
        naming: {
          entry: 'main.js',
          chunk: 'chunks/[name]-[hash].js',
          asset: '[name]-[hash].[ext]',
        },
        loader: {
          '.css': 'empty',
        },
        plugins: [workspacePackageResolverBunPlugin(workspaceRoot)],
      });
      if (!result.success) {
        for (const log of result.logs) {
          // surface logs for the caller
          console.error(log);
        }
        throw new Error('DEPLOY_EXECUTOR_UI_BUILD_FAILED');
      }

      const files: Record<string, string> = { 'ui-build/main.css': readUiRuntimeCss(workspaceRoot) };
      for (const artifact of result.outputs) {
        const rel = relative(outdir, artifact.path).split('\\').join('/');
        if (rel.startsWith('..') || rel === '') continue;
        const text = await artifact.text();
        files[`ui-build/${rel}`] = text;
      }
      if (!Object.keys(files).some((k) => k === 'ui-build/main.js')) {
        throw new Error('DEPLOY_EXECUTOR_UI_BUNDLE_MISSING_MAIN_JS');
      }
      return files;
    } finally {
      await import('node:fs/promises').then((fs) => fs.rm(stdinFile, { force: true }));
    }
  }
  ```
- Replace the `workspacePackageResolver(workspaceRoot)` esbuild Plugin with a Bun-compatible version. Replace its body and rename it `workspacePackageResolverBunPlugin`:

  ```ts
  import type { BunPlugin } from 'bun';

  function workspacePackageResolverBunPlugin(workspaceRoot: string): BunPlugin {
    const packageDirs = discoverWorkspacePackageDirs(workspaceRoot);
    return {
      name: 'rntme-workspace-package-resolver',
      setup(build) {
        build.onResolve({ filter: /^@rntme\// }, (args) => {
          const packageName = packageNameFromImport(args.path);
          const packageDir = packageDirs.get(packageName);
          if (packageDir === undefined) return undefined;
          const subpath = args.path.slice(packageName.length);
          return { path: resolveWorkspaceExport(packageDir, subpath.length === 0 ? '.' : `.${subpath}`) };
        });
        build.onResolve({ filter: /^\..*\.js$/ }, (args) => {
          const jsPath = join(args.importer ? dirname(args.importer) : workspaceRoot, args.path);
          if (existsSync(jsPath)) return undefined;
          const withoutJs = jsPath.slice(0, -'.js'.length);
          for (const candidate of [`${withoutJs}.ts`, `${withoutJs}.tsx`]) {
            if (existsSync(candidate)) return { path: candidate };
          }
          return undefined;
        });
      },
    };
  }
  ```

  Notes:
  - Bun's plugin API differs from esbuild's: `args.resolveDir` is not provided; use `args.importer` to derive the directory.
  - Bun does not currently support `onResolve` `nodePaths`. Workspaces resolve through the root `node_modules`; Bun's hoisted install lays out workspaces at `node_modules/<scope>/<name>` symlinks already, so module resolution Just Works for workspace-internal imports without the per-package `nodePaths` list. Drop `workspaceNodePaths(...)` from the call site.

- [ ] **Step 5: Drop `esbuild` from `apps/platform-http/package.json`**

- Remove `esbuild` from `devDependencies`.
- Add `@types/bun": "latest"` if not already present.

- [ ] **Step 6: Run targeted test**

Run: `cd apps/platform-http && bun test test/unit/deploy/bundle-virtual-entry.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full platform-http test suite**

Run: `cd apps/platform-http && bun test`
Expected: PASS.

- [ ] **Step 8: Run typecheck**

Run: `cd apps/platform-http && bun run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/platform-http
git commit -m "refactor(platform-http): swap esbuild UI bundling for Bun.build with workspace plugin"
```

---

## Task 16: Switch shebangs and bin entrypoints to `bun`

**Files:**
- Modify: every `*.ts` (or `*.js`) under `**/src/bin/**` whose first line is `#!/usr/bin/env node`.
- Confirm: `apps/cli/src/bin/*`, `packages/runtime/runtime/src/bin/runtime.ts`, `modules/*/src/bin/server.ts`.

- [ ] **Step 1: List shebanged bin files**

Run: `rg -nl "^#!/usr/bin/env node" --glob '*.ts' --glob '*.js' --glob '!node_modules' --glob '!.claude'`
Expected: prints every file. Save the list.

- [ ] **Step 2: Replace shebang**

For each file in the list, replace the first line `#!/usr/bin/env node` with `#!/usr/bin/env bun`.

- [ ] **Step 3: Verify each Dockerfile invokes the right bin**

For Dockerfiles that hard-code `node packages/.../bin/runtime.js`, that line is replaced in Task 17. Just confirm here that source shebangs are consistent.

- [ ] **Step 4: Smoke run a CLI bin under Bun**

Run: `bun run apps/cli/src/bin/cli.ts --version`
(If the entry path differs, locate it via `cat apps/cli/package.json | grep '"bin"'` and call that file.)
Expected: prints the CLI version without throwing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(bin): switch bin shebangs from node to bun"
```

---

## Task 17: Migrate Dockerfiles to `oven/bun:1`

**Files:**
- Modify: `Dockerfile.test`
- Modify: `apps/landing/Dockerfile`
- Modify: `apps/platform-http/Dockerfile`
- Modify: `packages/runtime/runtime/Dockerfile`
- Modify: `packages/runtime/runtime/Dockerfile.template`
- Modify: `packages/runtime/bpmn-worker/Dockerfile`
- Modify: `modules/marketing-site/static-html/Dockerfile`
- Modify: `modules/storage/s3/Dockerfile`
- Modify: `modules/identity/auth0/Dockerfile`
- Modify: `modules/ai-llm/openrouter/Dockerfile`

For every Dockerfile, the swap pattern is:
- `FROM node:20-slim` / `node:20-alpine` → `FROM oven/bun:1`
- Drop `RUN corepack enable && corepack prepare pnpm@9.12.0 --activate`.
- Drop `RUN apk add --no-cache python3 make g++` (better-sqlite3 was the only native compile target; removed in Tasks 4-10).
- `pnpm install --frozen-lockfile` → `bun install --frozen-lockfile`
- `pnpm -r run build`, `pnpm --filter X build`, `pnpm -F X build` → `bun run --filter X build` (or `bun run build` for "all").
- `node packages/.../bin/runtime.js …` → `bun packages/.../bin/runtime.ts …` (Bun runs raw TS — runtime/bin entries can keep emitted JS too; pick one explicitly per Dockerfile).
- `pnpm-lock.yaml`, `pnpm-workspace.yaml` COPY lines → drop, replace with `bun.lock`.

- [ ] **Step 1: Rewrite `Dockerfile.test`**

```dockerfile
FROM oven/bun:1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN bun install --frozen-lockfile
RUN bun run --filter '@rntme/platform-http' build
RUN bun run --filter '@rntme/platform-storage' build

CMD ["bun", "test"]
```

- [ ] **Step 2: Rewrite `apps/platform-http/Dockerfile`**

```dockerfile
# stage 1 — builder
FROM oven/bun:1 AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN bun install --frozen-lockfile
RUN bun run --filter '@rntme/platform-http' build

# stage 2 — runtime
FROM oven/bun:1 AS runtime
WORKDIR /app

COPY --from=builder /app /app

WORKDIR /app/apps/platform-http
EXPOSE 3000
CMD ["bun", "dist/bin/server.js"]
```

- [ ] **Step 3: Rewrite `apps/landing/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7

FROM oven/bun:1 AS build
WORKDIR /repo

COPY package.json bun.lock ./
COPY apps/landing/package.json ./apps/landing/package.json

# Install only @rntme/landing's closure.
RUN bun install --frozen-lockfile --filter '@rntme/landing'

COPY apps/landing ./apps/landing

ARG TALLY_FORM_ID
ARG GITHUB_URL
ARG DOCS_URL
ARG PLATFORM_URL
ARG DEMO_URL=""
ARG PLAUSIBLE_DOMAIN=""
ENV TALLY_FORM_ID=$TALLY_FORM_ID \
    GITHUB_URL=$GITHUB_URL \
    DOCS_URL=$DOCS_URL \
    PLATFORM_URL=$PLATFORM_URL \
    DEMO_URL=$DEMO_URL \
    PLAUSIBLE_DOMAIN=$PLAUSIBLE_DOMAIN

RUN bun run --filter '@rntme/landing' build
RUN test -f /repo/apps/landing/dist/index.html || (echo "dist/index.html missing after astro build" && exit 1)

FROM nginx:alpine AS runtime
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf

RUN nginx -t

EXPOSE 80
```

- [ ] **Step 4: Rewrite `packages/runtime/runtime/Dockerfile`**

```dockerfile
# Build from repo root:
#   docker build -f packages/runtime/runtime/Dockerfile -t ghcr.io/vladprrs/rntme-runtime:dev .

FROM oven/bun:1 AS builder
WORKDIR /build
COPY package.json bun.lock tsconfig.base.json ./
COPY packages ./packages
COPY demo ./demo
RUN bun install --frozen-lockfile \
  && bun run --filter '@rntme/*' build

FROM oven/bun:1
WORKDIR /srv
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/packages ./packages
RUN bun --eval "await import('/srv/packages/runtime/runtime/dist/load/load-service.js'); await import('node:fs/promises').then(fs => fs.access('/srv/packages/runtime/runtime/assets/protos/identity-auth0.proto'))"
ENV NODE_ENV=production \
    RNTME_ARTIFACTS_DIR=/srv/artifacts \
    RNTME_HTTP_PORT=3000
USER bun
EXPOSE 3000
ENTRYPOINT ["bun", "packages/runtime/runtime/dist/bin/runtime.js", "start"]
CMD ["/srv/artifacts"]
```

Note: `oven/bun:1` ships a non-root `bun` user.

- [ ] **Step 5: Mirror the same edit pattern for the remaining Dockerfiles**

Apply the same `node:20-* → oven/bun:1`, drop-corepack, drop-build-essentials, swap-pnpm-for-bun pattern to:
- `packages/runtime/runtime/Dockerfile.template`
- `packages/runtime/bpmn-worker/Dockerfile`
- `modules/marketing-site/static-html/Dockerfile`
- `modules/storage/s3/Dockerfile`
- `modules/identity/auth0/Dockerfile`
- `modules/ai-llm/openrouter/Dockerfile`

- [ ] **Step 6: Build the runtime image locally**

Run: `docker build -f packages/runtime/runtime/Dockerfile -t rntme-runtime:bun-test .`
Expected: image builds without invoking pnpm or Corepack, and the inline `bun --eval` import smoke passes.

- [ ] **Step 7: Build the platform-http image locally**

Run: `docker build -f apps/platform-http/Dockerfile -t rntme-platform-http:bun-test .`
Expected: image builds.

- [ ] **Step 8: Commit**

```bash
git add Dockerfile.test apps/landing/Dockerfile apps/platform-http/Dockerfile \
        packages/runtime/runtime/Dockerfile packages/runtime/runtime/Dockerfile.template \
        packages/runtime/bpmn-worker/Dockerfile modules/marketing-site/static-html/Dockerfile \
        modules/storage/s3/Dockerfile modules/identity/auth0/Dockerfile \
        modules/ai-llm/openrouter/Dockerfile
git commit -m "build(docker): switch every image to oven/bun:1 and bun install/build/run"
```

---

## Task 18: Promote `scratch/bun-grpc-smoke` to a real compatibility regression

**Files:**
- Create: `packages/runtime/bindings-grpc/test/integration/bun-grpc-compat.test.ts`

The spec calls out that gRPC stays on `@grpc/grpc-js` and that the `scratch/bun-grpc-smoke` proves Bun + `@grpc/grpc-js` round-trips. Promote it into the runtime test surface so a future regression breaks CI rather than silently rotting.

- [ ] **Step 1: Write the regression test**

Create `packages/runtime/bindings-grpc/test/integration/bun-grpc-compat.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import * as grpc from '@grpc/grpc-js';

const service: grpc.ServiceDefinition = {
  Ping: {
    path: '/smoke.Smoke/Ping',
    requestStream: false,
    responseStream: false,
    requestSerialize: (v: { msg: string }) => Buffer.from(v.msg, 'utf8'),
    requestDeserialize: (b: Buffer) => ({ msg: b.toString('utf8') }),
    responseSerialize: (v: { msg: string }) => Buffer.from(v.msg, 'utf8'),
    responseDeserialize: (b: Buffer) => ({ msg: b.toString('utf8') }),
  },
};

describe('Bun + @grpc/grpc-js compatibility regression', () => {
  it('round-trips a unary RPC under Bun', async () => {
    const server = new grpc.Server();
    server.addService(service, {
      Ping: (
        call: grpc.ServerUnaryCall<{ msg: string }, { msg: string }>,
        cb: grpc.sendUnaryData<{ msg: string }>,
      ) => cb(null, { msg: `pong:${call.request.msg}` }),
    });
    const port = await new Promise<number>((resolve, reject) => {
      server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, p) => {
        if (err !== null) reject(err);
        else resolve(p);
      });
    });
    try {
      const client = new grpc.Client(
        `127.0.0.1:${port}`,
        grpc.credentials.createInsecure(),
      );
      const reply = await new Promise<{ msg: string }>((resolve, reject) => {
        client.makeUnaryRequest(
          '/smoke.Smoke/Ping',
          (v: { msg: string }) => Buffer.from(v.msg, 'utf8'),
          (b: Buffer) => ({ msg: b.toString('utf8') }),
          { msg: 'hi' },
          new grpc.Metadata(),
          (err, value) => {
            if (err !== null && err !== undefined) reject(err);
            else if (value === undefined) reject(new Error('empty value'));
            else resolve(value);
          },
        );
      });
      expect(reply.msg).toBe('pong:hi');
    } finally {
      server.forceShutdown();
    }
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd packages/runtime/bindings-grpc && bun test test/integration/bun-grpc-compat.test.ts`
Expected: PASS.

- [ ] **Step 3: Delete the now-redundant scratch directory**

Run: `git rm -r scratch/bun-grpc-smoke`

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/bindings-grpc/test/integration/bun-grpc-compat.test.ts
git commit -m "test(bindings-grpc): promote bun-grpc smoke to a CI regression and drop scratch"
```

---

## Task 19: Update `scripts/vendor-check.mjs`, `scripts/vendor-sync.mjs`, `scripts/agent-env-check.sh`

**Files:**
- Modify: `scripts/vendor-check.mjs` (shebang + path through Bun)
- Modify: `scripts/vendor-sync.mjs` (same)
- Modify: `scripts/agent-env-check.sh`

- [ ] **Step 1: Update shebangs**

In `scripts/vendor-check.mjs` and `scripts/vendor-sync.mjs`:
- Replace `#!/usr/bin/env node` with `#!/usr/bin/env bun`.
- Bun runs `.mjs` files using the same Node-API surface (`node:fs/promises`, etc.) — no body change needed.

- [ ] **Step 2: Update `scripts/agent-env-check.sh`**

Replace any `pnpm --version` / `node --version` checks with `bun --version`. If the script sourced corepack, drop that line.

- [ ] **Step 3: Smoke run**

Run: `bun run scripts/vendor-check.mjs`
Expected: same output as before (no diff between vendored module metadata and source).

Run: `bash scripts/agent-env-check.sh`
Expected: prints bun-related success lines, no pnpm references.

- [ ] **Step 4: Commit**

```bash
git add scripts/vendor-check.mjs scripts/vendor-sync.mjs scripts/agent-env-check.sh
git commit -m "chore(scripts): switch shebangs and env checks from node/pnpm to bun"
```

---

## Task 20: Update `docs/decision-system.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`

**Files:**
- Modify: `docs/decision-system.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Flip §3.7 in `docs/decision-system.md`**

Locate the entry:

```markdown
- **Bun-first toolchain + scoped `tsc` exception** ... · `locked-pending` · spec `docs/superpowers/specs/2026-05-09-bun-first-toolchain-migration-design.md`
```

Change `locked-pending` to `current-default`. Append `· plan executed: docs/superpowers/plans/2026-05-09-bun-first-toolchain-migration.md`.

If §6 ("Open Questions") names this migration as an open item, move that note into a "Future direction: 2A raw TypeScript packages" sub-bullet under §3.7 referencing the spec's `Future Direction` section.

- [ ] **Step 2: Update `AGENTS.md` Commands table**

Replace the entire Commands table at lines 56-68 with:

```markdown
| Command | Effect |
| --- | --- |
| `bun install --frozen-lockfile` | install deps |
| `bun run build` | build every package (workspaces filter) |
| `bun run typecheck` | typecheck every package |
| `bun test` | run package tests |
| `bun run lint` | lint source and tests |
| `bun run depcruise` | enforce package layering |
| `bun run vendor:check` | verify vendored module metadata in demos |
| `bun run --filter '@rntme/<pkg>' test` | run one package's tests |
| `bun test --watch` | watch tests (run from package or pass `--cwd`) |
```

Update the "CI runs" line to: `CI runs install, build, typecheck, test, lint, depcruise, and vendor check under Bun.`.

- [ ] **Step 3: Update `CLAUDE.md` Commands table**

In `CLAUDE.md`, replace the line `Node 20+, pnpm 9.12+. From the workspace root:` with `Bun 1.1+. From the workspace root:` and replace the table with the same Bun-flavored table from Step 2.

- [ ] **Step 4: Update `README.md`**

Update the Try-the-CLI block:
- The `npm install -g @rntme/cli` line is end-user-facing and stays (the published CLI must remain installable via npm even though local dev uses Bun). No change required to the public install line, but add a note under `## Try the CLI`:

  ```markdown
  > Local development uses Bun (`bun install`). End-user CLI installs continue to work through npm, yarn, pnpm, or bun.
  ```

If the README has a "Tooling" or "Requirements" section listing `Node 20`/`pnpm`, replace those with `Bun 1.1+`.

- [ ] **Step 5: Sweep local README stubs for `pnpm -F …` hints**

Run: `rg -n 'pnpm' --glob '!docs/history' --glob '!docs/superpowers' --glob '!node_modules' --glob '!.claude'`
Expected: list of matches. For each match in a `README.md` stub or current owner doc:
- Replace `pnpm -F @rntme/<pkg> <script>` with `bun run --filter '@rntme/<pkg>' <script>`.
- Replace `pnpm install` with `bun install`.
- Replace `pnpm run X` with `bun run X`.

- [ ] **Step 6: Update affected current owner docs**

Open each owner doc listed in the File Structure section above and replace command examples / requirement lines that mention pnpm or Node-20-as-runtime with Bun equivalents. Do not touch invariants, error codes, or API behavior text — only the command/runtime hints.

- [ ] **Step 7: Commit**

```bash
git add docs/decision-system.md AGENTS.md CLAUDE.md README.md \
        docs/current/owners apps/cli/README.md apps/platform-http/README.md \
        apps/landing/README.md packages/runtime/runtime/README.md \
        packages/runtime/event-store/README.md \
        packages/runtime/projection-consumer/README.md \
        packages/runtime/bindings-http/README.md \
        packages/runtime/bindings-grpc/README.md \
        packages/runtime/ui-runtime/README.md \
        modules/storage/s3/README.md modules/ai-llm/openrouter/README.md \
        modules/identity/auth0/README.md
git commit -m "docs: flip Bun-first to current-default and rewrite tooling commands across current docs"
```

---

## Task 21: Whole-repo verification

**Files:** none — this task is a verification gate.

- [ ] **Step 1: Clean install from scratch**

Run: `rm -rf node_modules && bun install --frozen-lockfile`
Expected: `bun.lock` is honored; install completes.

- [ ] **Step 2: Run every gate the spec lists in "Build and test verification gates"**

Run sequentially:

```bash
bun install --frozen-lockfile
bun run build
bun run typecheck
bun test
bun run lint
bun run depcruise
bun run vendor:check
```

Expected: every command exits 0.

- [ ] **Step 3: Run targeted SQLite compatibility checks**

Run: `bun run --filter '@rntme/event-store' --filter '@rntme/projection-consumer' --filter '@rntme/storage-s3' --filter '@rntme/ai-llm-openrouter' --filter '@rntme/runtime' test`
Expected: PASS — covers append, read, cursor, delivery, schema, projection rollback, idempotency, seen-events, BLOB round trip, named params, transactions, WAL pragma, unique-constraint mapping.

- [ ] **Step 4: Run runtime + bindings integration tests**

Run: `bun run --filter '@rntme/runtime' --filter '@rntme/bindings-http' --filter '@rntme/bindings-grpc' test`
Expected: PASS — covers Bun.serve startup/shutdown, gRPC server/client, HTTP routes.

- [ ] **Step 5: Verify no banned dependencies remain**

Run:

```bash
rg -n '"better-sqlite3"|"@types/better-sqlite3"|"vitest"|"esbuild"|"tsx"' \
  --glob '*package.json' --glob '!node_modules' --glob '!.claude'
```

Expected: empty output.

```bash
rg -n "from 'better-sqlite3'|from 'vitest'|from 'esbuild'|@hono/node-server" \
  --glob '*.ts' --glob '!node_modules' --glob '!.claude' --glob '!docs/history' --glob '!docs/superpowers'
```

Expected: empty output.

```bash
rg -n 'pnpm' --glob '!node_modules' --glob '!.claude' --glob '!docs/history' --glob '!docs/superpowers'
```

Expected: empty (a few residual references in `docs/history/**` are explicitly allowed by the spec's non-goals).

- [ ] **Step 6: Build runtime + platform-http + landing Docker images**

Run:

```bash
docker build -f packages/runtime/runtime/Dockerfile -t rntme-runtime:verify .
docker build -f apps/platform-http/Dockerfile -t rntme-platform-http:verify .
docker build -f apps/landing/Dockerfile \
  --build-arg TALLY_FORM_ID=verify \
  --build-arg GITHUB_URL=https://github.com/vladprrs/rntme \
  --build-arg DOCS_URL=https://docs.rntme.com \
  --build-arg PLATFORM_URL=https://platform.rntme.com \
  -t rntme-landing:verify .
```

Expected: all three images build under `oven/bun:1` (or `nginx:alpine` for landing's runtime stage) without invoking pnpm or Corepack.

- [ ] **Step 7: Smoke-run runtime container**

Run: `docker run --rm rntme-runtime:verify --help` (or whatever flag the runtime CLI supports for a no-op).
Expected: process starts under bun and prints expected output.

- [ ] **Step 8: Commit verification artifacts (if any) and finalize**

If any verification surfaced fix-ups, commit them. Otherwise, no commit needed for this task.

```bash
git status
# If clean, proceed to PR.
```

---

## Documentation-Touch Evaluation

Per `AGENTS.md` "Docs Touch", evaluate each surface:

| Surface | Touched? | Where | Reason |
| --- | --- | --- | --- |
| `docs/decision-system.md` | yes | §3.7 | Bun-first flips from `locked-pending` to `current-default`; future 2A noted. |
| local README stubs | yes | every `README.md` in apps/packages/modules with a `pnpm -F` hint | Hint commands change. |
| `docs/current/owners/**` | yes | runtime, event-store, projection-consumer, bindings-http, bindings-grpc, ui-runtime, cli, platform-http, landing, storage/s3, ai-llm/openrouter, identity/auth0 | Toolchain commands and runtime base change. |
| `docs/current/guides/**` | yes-conditional | only if guides quote `pnpm` invocation; sweep with `rg pnpm docs/current/guides` | Authoring command hints. |
| `docs/README.md` | no | n/a | Navigation unchanged. |
| `AGENTS.md` | yes | Commands table | Commands change. |
| `README.md` | yes | Try-the-CLI section | Public requirement change for local dev (still installable via npm for end users). |
| `CLAUDE.md` | yes | Commands table | Bootstrap commands change. |

Historical specs/plans under `docs/history/**` and `docs/superpowers/**` are explicitly out of scope per the spec's non-goals.

---

## Self-Review Notes

- **Spec coverage**:
  - Bun as package manager / runner / test runner / runtime / Docker base / SQLite — Tasks 1-4, 6, 11, 12, 17.
  - `tsc` retained for typecheck + `.d.ts` — `scripts.build = "tsc -p tsconfig.json"` preserved per package; `scripts.typecheck` retained.
  - Removal of pnpm/Vitest/esbuild/tsx/better-sqlite3 — Tasks 1, 4-11, 13-15.
  - Shared SQLite port (event-store, qsm, graph-ir-compiler, projection-consumer, runtime, storage/s3, ai-llm/openrouter, seed) — Tasks 3-10.
  - BLOB normalization — Task 3 (`toBuffer`/`toUint8Array`) + Task 10 (openrouter consumer).
  - Bun strict named binding to preserve `@subject`/`subject` parameter shapes — `openSqliteDatabase` opens with `strict: true` by default in Task 3.
  - Constraint error mapping preserved — Task 4 broadens regex to also match Bun's "UNIQUE constraint failed" message.
  - Single-writer guard — preserved in Task 4 by leaving `liveSqliteWriterKeys` set logic untouched.
  - HTTP `Bun.serve` with lifecycle preserved — Task 12.
  - gRPC compat regression — Task 18.
  - Provisioner bundles via `bun build` — Task 14.
  - UI bundles via `Bun.build` — Tasks 13, 15.
  - Shebangs + bin entries — Task 16.
  - Dockerfiles — Task 17.
  - Decision-system + AGENTS + CLAUDE + README + owner docs — Task 20.
  - Verification gates from spec — Task 21.

- **Placeholder scan**: No "TBD", "TODO", "implement later", or hand-wavy steps. Every regex/identifier change is named; every code block is concrete.

- **Type consistency**: `SqliteDatabase`, `SqliteStatement`, `SqliteRunResult`, `openSqliteDatabase`, `BunSqliteDriver`, `bun-sqlite-driver.ts`, `@rntme/sqlite` are used consistently across Tasks 3-10. `Bun.build` plugin is named `workspacePackageResolverBunPlugin` consistently in Task 15.

- **Risks called out by the spec, addressed in plan**:
  - Vitest fake timers without a clean Bun replacement — Task 11 Step 3 explicitly says: refactor production sites to accept an injected clock; do not paper over with `Bun.setSystemTime` when timer advancement is required.
  - Workspace package resolver in platform-http executor — Task 15 ports the esbuild plugin to a `BunPlugin` and explicitly drops `nodePaths` because Bun's hoisted node_modules layout supersedes it.
  - Builds depending on emitted JS — provisioner bundle scripts run after `tsc -p tsconfig.json`; the prerequisite ordering is preserved (each package's `build` runs `tsc` first, then `bun build` against `dist/...`).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-09-bun-first-toolchain-migration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Especially appropriate here: Tasks 4-10 are mechanically similar but each touches different test files, so per-task isolation prevents cross-package context blur.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

Which approach?
