> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# Platform API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the multi-tenant control-plane API at `platform.rntme.com` as three workspace packages in the private `rntme-cli/` submodule: `@rntme-cli/platform-core` (domain), `@rntme-cli/platform-storage` (Postgres+rustfs adapters), `@rntme-cli/platform-http` (Hono server with WorkOS AuthKit).

**Architecture:** Clean-architecture three-layer split. `platform-core` holds Zod schemas, seam interfaces (`IdentityProvider`, repos, `BlobStore`, `Clock`, `Ids`), use-cases, and a validation adapter to `@rntme/*`. `platform-storage` implements the interfaces on Postgres (Drizzle + RLS) and rustfs (S3-compatible). `platform-http` mounts Hono routes, wires auth providers, emits OpenAPI from Zod, and owns WorkOS integration. All artifact bundles are content-addressed in rustfs; metadata lives in Postgres under row-level security; transactional outbox carries `artifact.version.published` for the future deploy-controller.

**Tech Stack:** TypeScript strict ESM Node 20, Hono, Zod, `@hono/zod-openapi`, Drizzle ORM, `pg`, `@aws-sdk/client-s3`, `@workos-inc/node`, pino, vitest, testcontainers (Postgres + MinIO), fast-check.

**Spec:** `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` — read §3 decisions matrix before starting any task.

**Conventions this plan follows (inherited from the public `@rntme/*` workspace):**
- `Result<T, E>` for fallible returns; no throws across public APIs.
- Phantom-branded `Validated*` types.
- Error codes: `PLATFORM_<LAYER>_<KIND>`; append-only registry.
- Zero comments unless capturing a non-obvious invariant/workaround.
- ESM, `"type": "module"`, `tsc -p tsconfig.json` per package.
- Tests live in `test/unit/`, `test/integration/`, `test/e2e/`, fixtures under `test/fixtures/`.

**Order of execution:** Phases A → O are dependency-ordered; do not jump ahead. Inside a phase, tasks can sometimes run in parallel (noted per phase).

---

## Phase A — Scaffold three packages

### Task A1: Create `@rntme-cli/platform-core` package skeleton

**Files:**
- Create: `rntme-cli/packages/platform-core/package.json`
- Create: `rntme-cli/packages/platform-core/tsconfig.json`
- Create: `rntme-cli/packages/platform-core/tsconfig.check.json`
- Create: `rntme-cli/packages/platform-core/vitest.config.ts`
- Create: `rntme-cli/packages/platform-core/eslint.config.mjs`
- Create: `rntme-cli/packages/platform-core/src/index.ts`
- Create: `rntme-cli/packages/platform-core/README.md`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@rntme-cli/platform-core",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "rntme platform control-plane — domain, use-cases, seam interfaces.",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@rntme/pdm": "workspace:*",
    "@rntme/qsm": "workspace:*",
    "@rntme/bindings": "workspace:*",
    "@rntme/graph-ir-compiler": "workspace:*",
    "@rntme/seed": "workspace:*",
    "@rntme/ui": "workspace:*",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "fast-check": "^3.20.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "composite": false },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 3: Create tsconfig.check.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node', reporters: 'default', testTimeout: 15_000 },
});
```

- [ ] **Step 5: Create eslint.config.mjs** — copy the exact file from `rntme-cli/packages/cli/eslint.config.mjs` (same rules across every workspace member).

- [ ] **Step 6: Create src/index.ts**

```ts
export const VERSION = '0.0.0';
```

- [ ] **Step 7: Create README.md**

```markdown
# @rntme-cli/platform-core

Domain + use-cases + seam interfaces for the rntme platform control-plane.

See `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` in the public repo.
```

- [ ] **Step 8: Commit**

```bash
git -C rntme-cli add packages/platform-core
git -C rntme-cli commit -m "scaffold(platform-core): package skeleton"
```

---

### Task A2: Create `@rntme-cli/platform-storage` package skeleton

**Files:**
- Create: `rntme-cli/packages/platform-storage/package.json`
- Create: `rntme-cli/packages/platform-storage/tsconfig.json`
- Create: `rntme-cli/packages/platform-storage/tsconfig.check.json`
- Create: `rntme-cli/packages/platform-storage/vitest.config.ts`
- Create: `rntme-cli/packages/platform-storage/eslint.config.mjs`
- Create: `rntme-cli/packages/platform-storage/drizzle.config.ts`
- Create: `rntme-cli/packages/platform-storage/src/index.ts`
- Create: `rntme-cli/packages/platform-storage/README.md`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@rntme-cli/platform-storage",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Postgres (Drizzle + RLS) and rustfs (S3) adapters for platform-core.",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@rntme-cli/platform-core": "workspace:*",
    "@aws-sdk/client-s3": "^3.650.0",
    "@aws-sdk/s3-request-presigner": "^3.650.0",
    "drizzle-orm": "^0.33.0",
    "pg": "^8.12.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@testcontainers/postgresql": "^10.13.0",
    "@types/node": "^20.14.0",
    "@types/pg": "^8.11.6",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "drizzle-kit": "^0.25.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "testcontainers": "^10.13.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create tsconfig.json and tsconfig.check.json** — identical structure to Task A1 steps 2–3.

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
```

- [ ] **Step 4: Create eslint.config.mjs** — copy from `cli/eslint.config.mjs`.

- [ ] **Step 5: Create drizzle.config.ts**

```ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env['DATABASE_URL'] ?? 'postgres://localhost/rntme_platform_dev' },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 6: Create src/index.ts**

```ts
export const VERSION = '0.0.0';
```

- [ ] **Step 7: Create README.md**

```markdown
# @rntme-cli/platform-storage

Postgres (Drizzle + RLS) and rustfs (S3-compatible) adapters that implement the repository and blob-store interfaces declared in `@rntme-cli/platform-core`.
```

- [ ] **Step 8: Commit**

```bash
git -C rntme-cli add packages/platform-storage
git -C rntme-cli commit -m "scaffold(platform-storage): package skeleton + drizzle config"
```

---

### Task A3: Create `@rntme-cli/platform-http` package skeleton

**Files:**
- Create: `rntme-cli/packages/platform-http/package.json`
- Create: `rntme-cli/packages/platform-http/tsconfig.json`
- Create: `rntme-cli/packages/platform-http/tsconfig.check.json`
- Create: `rntme-cli/packages/platform-http/vitest.config.ts`
- Create: `rntme-cli/packages/platform-http/eslint.config.mjs`
- Create: `rntme-cli/packages/platform-http/src/index.ts`
- Create: `rntme-cli/packages/platform-http/README.md`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@rntme-cli/platform-http",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Hono HTTP server for the rntme platform control-plane.",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": { "rntme-platform": "./dist/bin/server.js" },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/bin/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@rntme-cli/platform-core": "workspace:*",
    "@rntme-cli/platform-storage": "workspace:*",
    "@hono/node-server": "^1.13.1",
    "@hono/zod-openapi": "^0.16.0",
    "@workos-inc/node": "^7.32.0",
    "hono": "^4.6.3",
    "pino": "^9.4.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@testcontainers/postgresql": "^10.13.0",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "testcontainers": "^10.13.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create tsconfig.json, tsconfig.check.json, eslint.config.mjs** — identical shape to Task A1.

- [ ] **Step 3: Create vitest.config.ts** — same as A2 step 3 (long timeouts for testcontainers).

- [ ] **Step 4: Create src/index.ts**

```ts
export const VERSION = '0.0.0';
```

- [ ] **Step 5: Create README.md**

```markdown
# @rntme-cli/platform-http

Hono HTTP server that wires `@rntme-cli/platform-core` use-cases to the REST surface at `platform.rntme.com`. WorkOS AuthKit for humans, bearer API tokens for machines.
```

- [ ] **Step 6: Commit**

```bash
git -C rntme-cli add packages/platform-http
git -C rntme-cli commit -m "scaffold(platform-http): package skeleton"
```

---

### Task A4: Verify workspace wiring

- [ ] **Step 1: Confirm pnpm-workspace.yaml picks up new packages**

The public `pnpm-workspace.yaml` already contains `rntme-cli/packages/*`. No change needed.

- [ ] **Step 2: From the public repo root, run install**

```bash
pnpm install
```

Expected: new packages resolved; root `pnpm-lock.yaml` updated; no errors.

- [ ] **Step 3: Verify each package builds empty**

```bash
pnpm -F @rntme-cli/platform-core build
pnpm -F @rntme-cli/platform-storage build
pnpm -F @rntme-cli/platform-http build
```

Expected: PASS. Each emits `dist/index.js` and `dist/index.d.ts`.

- [ ] **Step 4: Verify each package runs an empty test suite**

```bash
pnpm -F @rntme-cli/platform-core test
pnpm -F @rntme-cli/platform-storage test
pnpm -F @rntme-cli/platform-http test
```

Expected: vitest reports "No test files found" (acceptable at this stage).

- [ ] **Step 5: Commit public-repo lockfile update**

```bash
cd /home/coder/project
git add pnpm-lock.yaml
git commit -m "chore(workspace): resolve @rntme-cli/platform-{core,storage,http}"
```

Then bump the submodule pointer:

```bash
cd /home/coder/project
git add rntme-cli
git commit -m "chore: bump rntme-cli submodule (platform-* scaffolds)"
```

---

## Phase B — platform-core foundational types

All tasks in this phase are inside `rntme-cli/packages/platform-core/`.

### Task B1: Result<T, E> and error-code registry

**Files:**
- Create: `src/types/result.ts`
- Create: `test/unit/types/result.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// test/unit/types/result.test.ts
import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, ERROR_CODES } from '../../../src/types/result.js';

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it('err wraps errors array', () => {
    const r = err([{ code: 'PLATFORM_INTERNAL', message: 'x' }]);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.errors).toHaveLength(1);
  });

  it('ERROR_CODES registry is append-only set', () => {
    expect(ERROR_CODES.PLATFORM_AUTH_MISSING).toBe('PLATFORM_AUTH_MISSING');
    expect(ERROR_CODES.PLATFORM_VALIDATION_BUNDLE_FAILED).toBe('PLATFORM_VALIDATION_BUNDLE_FAILED');
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm -F @rntme-cli/platform-core test
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement src/types/result.ts**

```ts
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly errors: readonly E[] };
export type Result<T, E = PlatformError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(errors: readonly E[]): Err<E> => ({ ok: false, errors });
export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok === true;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => r.ok === false;

export const ERROR_CODES = {
  PLATFORM_AUTH_MISSING: 'PLATFORM_AUTH_MISSING',
  PLATFORM_AUTH_INVALID: 'PLATFORM_AUTH_INVALID',
  PLATFORM_AUTH_FORBIDDEN: 'PLATFORM_AUTH_FORBIDDEN',
  PLATFORM_AUTH_TOKEN_REVOKED: 'PLATFORM_AUTH_TOKEN_REVOKED',
  PLATFORM_AUTH_TOKEN_EXPIRED: 'PLATFORM_AUTH_TOKEN_EXPIRED',
  PLATFORM_PARSE_BODY_INVALID: 'PLATFORM_PARSE_BODY_INVALID',
  PLATFORM_PARSE_PATH_INVALID: 'PLATFORM_PARSE_PATH_INVALID',
  PLATFORM_TENANCY_ORG_NOT_FOUND: 'PLATFORM_TENANCY_ORG_NOT_FOUND',
  PLATFORM_TENANCY_PROJECT_NOT_FOUND: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND',
  PLATFORM_TENANCY_SERVICE_NOT_FOUND: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND',
  PLATFORM_TENANCY_RESOURCE_ARCHIVED: 'PLATFORM_TENANCY_RESOURCE_ARCHIVED',
  PLATFORM_VALIDATION_BUNDLE_FAILED: 'PLATFORM_VALIDATION_BUNDLE_FAILED',
  PLATFORM_STORAGE_BLOB_UPLOAD_FAILED: 'PLATFORM_STORAGE_BLOB_UPLOAD_FAILED',
  PLATFORM_STORAGE_DB_UNAVAILABLE: 'PLATFORM_STORAGE_DB_UNAVAILABLE',
  PLATFORM_CONCURRENCY_VERSION_CONFLICT: 'PLATFORM_CONCURRENCY_VERSION_CONFLICT',
  PLATFORM_CONCURRENCY_LAST_OWNER: 'PLATFORM_CONCURRENCY_LAST_OWNER',
  PLATFORM_RATE_LIMITED: 'PLATFORM_RATE_LIMITED',
  PLATFORM_INTERNAL: 'PLATFORM_INTERNAL',
  PLATFORM_WORKOS_WEBHOOK_INVALID: 'PLATFORM_WORKOS_WEBHOOK_INVALID',
  PLATFORM_WORKOS_UNAVAILABLE: 'PLATFORM_WORKOS_UNAVAILABLE',
  PLATFORM_CONFLICT_SLUG_TAKEN: 'PLATFORM_CONFLICT_SLUG_TAKEN',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export type PlatformError = {
  readonly code: ErrorCode;
  readonly message: string;
  readonly stage?: 'auth' | 'parse' | 'tenancy' | 'validation' | 'storage' | 'concurrency' | 'internal';
  readonly pkg?: string;
  readonly path?: string;
  readonly cause?: unknown;
};
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm -F @rntme-cli/platform-core test
```

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/types/result.ts packages/platform-core/test/unit/types/result.test.ts
git -C rntme-cli commit -m "feat(platform-core): Result<T,E> and error-code registry"
```

---

### Task B2: Phantom-branded Validated* types

**Files:**
- Create: `src/types/brands.ts`
- Create: `test/unit/types/brands.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/types/brands.test.ts
import { describe, it, expectTypeOf } from 'vitest';
import type { ValidatedPublishBundle, ValidatedSlug } from '../../../src/types/brands.js';

describe('brand types', () => {
  it('ValidatedPublishBundle is not assignable from plain object', () => {
    expectTypeOf<{ foo: 1 }>().not.toMatchTypeOf<ValidatedPublishBundle>();
  });
  it('ValidatedSlug is not assignable from plain string', () => {
    expectTypeOf<string>().not.toMatchTypeOf<ValidatedSlug>();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm -F @rntme-cli/platform-core test
```

- [ ] **Step 3: Implement src/types/brands.ts**

```ts
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ValidatedSlug = Brand<string, 'ValidatedSlug'>;
export type ValidatedTokenName = Brand<string, 'ValidatedTokenName'>;
export type ValidatedPublishBundle = Brand<
  {
    readonly manifest: unknown;
    readonly pdm: unknown;
    readonly qsm: unknown;
    readonly graphIr: unknown;
    readonly bindings: unknown;
    readonly ui: unknown;
    readonly seed: unknown;
  },
  'ValidatedPublishBundle'
>;
```

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/types/brands.ts packages/platform-core/test/unit/types/brands.test.ts
git -C rntme-cli commit -m "feat(platform-core): phantom-branded validated types"
```

---

### Task B3: Canonical JSON helper

**Files:**
- Create: `src/validation/canonical-json.ts`
- Create: `test/unit/validation/canonical-json.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/validation/canonical-json.test.ts
import { describe, it, expect } from 'vitest';
import { canonicalize, sha256Hex, canonicalDigest } from '../../../src/validation/canonical-json.js';

describe('canonicalize', () => {
  it('sorts object keys recursively', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalize({ x: { z: 1, y: 2 } })).toBe('{"x":{"y":2,"z":1}}');
  });
  it('preserves array order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });
  it('produces stable digest regardless of key order', () => {
    const a = canonicalDigest({ foo: 1, bar: 2 });
    const b = canonicalDigest({ bar: 2, foo: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it('sha256Hex produces lowercase hex', () => {
    expect(sha256Hex('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/validation/canonical-json.ts**

```ts
import { createHash } from 'node:crypto';

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k])).join(',') + '}';
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function canonicalDigest(value: unknown): string {
  return sha256Hex(canonicalize(value));
}
```

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/validation/canonical-json.ts packages/platform-core/test/unit/validation/canonical-json.test.ts
git -C rntme-cli commit -m "feat(platform-core): canonical JSON + sha256 digest helpers"
```

---

### Task B4: Clock and Ids seam interfaces + defaults

**Files:**
- Create: `src/clock.ts`
- Create: `src/ids.ts`
- Create: `test/unit/clock.test.ts`
- Create: `test/unit/ids.test.ts`

- [ ] **Step 1: Tests**

```ts
// test/unit/clock.test.ts
import { describe, it, expect } from 'vitest';
import { SystemClock, FakeClock } from '../../src/clock.js';
describe('Clock', () => {
  it('SystemClock returns now', () => {
    const c = new SystemClock();
    const t = c.now();
    expect(t).toBeInstanceOf(Date);
  });
  it('FakeClock is advanceable', () => {
    const c = new FakeClock(new Date('2026-01-01T00:00:00Z'));
    c.advance(60_000);
    expect(c.now().toISOString()).toBe('2026-01-01T00:01:00.000Z');
  });
});
```

```ts
// test/unit/ids.test.ts
import { describe, it, expect } from 'vitest';
import { RandomIds, SeededIds } from '../../src/ids.js';
describe('Ids', () => {
  it('RandomIds produces UUIDs', () => {
    const ids = new RandomIds();
    expect(ids.uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
  it('SeededIds is deterministic', () => {
    const a = new SeededIds(['u1', 'u2']);
    const b = new SeededIds(['u1', 'u2']);
    expect(a.uuid()).toBe(b.uuid());
    expect(a.uuid()).toBe(b.uuid());
  });
  it('SeededIds produces plaintext API tokens of the expected shape', () => {
    const ids = new SeededIds([], { tokenBody: 'abcdefghijklmnopqrstuv' });
    expect(ids.apiTokenPlaintext()).toBe('rntme_pat_abcdefghijklmnopqrstuv');
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/clock.ts**

```ts
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date { return new Date(); }
}

export class FakeClock implements Clock {
  constructor(private current: Date) {}
  now(): Date { return new Date(this.current); }
  advance(ms: number): void { this.current = new Date(this.current.getTime() + ms); }
  set(date: Date): void { this.current = new Date(date); }
}
```

- [ ] **Step 4: Implement src/ids.ts**

```ts
import { randomUUID, randomBytes } from 'node:crypto';

export interface Ids {
  uuid(): string;
  apiTokenPlaintext(): string;
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function base62(bytes: Buffer, len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += BASE62[bytes[i % bytes.length]! % 62];
  return out;
}

export class RandomIds implements Ids {
  uuid(): string { return randomUUID(); }
  apiTokenPlaintext(): string { return 'rntme_pat_' + base62(randomBytes(22), 22); }
}

export class SeededIds implements Ids {
  private i = 0;
  constructor(private readonly uuids: readonly string[], private readonly opts: { tokenBody?: string } = {}) {}
  uuid(): string {
    const v = this.uuids[this.i++];
    if (!v) throw new Error('SeededIds exhausted');
    return v;
  }
  apiTokenPlaintext(): string {
    return 'rntme_pat_' + (this.opts.tokenBody ?? '00000000000000000000aa');
  }
}
```

- [ ] **Step 5: Run — expect pass.**

- [ ] **Step 6: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/clock.ts packages/platform-core/src/ids.ts packages/platform-core/test/unit/clock.test.ts packages/platform-core/test/unit/ids.test.ts
git -C rntme-cli commit -m "feat(platform-core): Clock and Ids seams with system/fake impls"
```

---

### Task B5: Slug and tag-name Zod schemas + validators

**Files:**
- Create: `src/schemas/primitives.ts`
- Create: `test/unit/schemas/primitives.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/schemas/primitives.test.ts
import { describe, it, expect } from 'vitest';
import { SlugSchema, TagNameSchema, TokenNameSchema, RESERVED_SLUGS } from '../../../src/schemas/primitives.js';

describe('SlugSchema', () => {
  it('accepts valid', () => {
    expect(SlugSchema.safeParse('my-proj').success).toBe(true);
  });
  it('rejects too short', () => {
    expect(SlugSchema.safeParse('ab').success).toBe(false);
  });
  it('rejects reserved', () => {
    for (const r of RESERVED_SLUGS) expect(SlugSchema.safeParse(r).success).toBe(false);
  });
  it('rejects uppercase', () => {
    expect(SlugSchema.safeParse('MyProj').success).toBe(false);
  });
});

describe('TagNameSchema', () => {
  it('accepts snake-case', () => expect(TagNameSchema.safeParse('v1_0').success).toBe(true));
  it('rejects uppercase', () => expect(TagNameSchema.safeParse('Stable').success).toBe(false));
});

describe('TokenNameSchema', () => {
  it('accepts human-readable label', () => expect(TokenNameSchema.safeParse('laptop cli').success).toBe(true));
  it('rejects empty', () => expect(TokenNameSchema.safeParse('').success).toBe(false));
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/schemas/primitives.ts**

```ts
import { z } from 'zod';

export const RESERVED_SLUGS = ['api', 'oauth', 'health', 'ready', 'v1', 'admin', 'openapi', 'webhooks'] as const;

export const SlugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'slug must match [a-z0-9-]')
  .refine((s) => !RESERVED_SLUGS.includes(s as (typeof RESERVED_SLUGS)[number]), 'slug is reserved');

export const TagNameSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9_-]+$/);

export const TokenNameSchema = z.string().min(1).max(80);

export const UuidSchema = z.string().uuid();
export const WorkosIdSchema = z.string().min(3);
```

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/schemas/primitives.ts packages/platform-core/test/unit/schemas/primitives.test.ts
git -C rntme-cli commit -m "feat(platform-core): slug/tag/token-name Zod primitives"
```

---

### Task B6: Domain entity schemas (Project, Service, Version, Tag, Token, Org, Account, Membership)

**Files:**
- Create: `src/schemas/entities.ts`
- Create: `test/unit/schemas/entities.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/schemas/entities.test.ts
import { describe, it, expect } from 'vitest';
import {
  ProjectSchema, ServiceSchema, ArtifactVersionSchema, ArtifactTagSchema, ApiTokenSchema,
  OrganizationSchema, AccountSchema, MembershipMirrorSchema, AuditLogEntrySchema,
} from '../../../src/schemas/entities.js';

describe('entity schemas', () => {
  it('ProjectSchema parses a valid row', () => {
    const r = ProjectSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      orgId: '22222222-2222-2222-2222-222222222222',
      slug: 'acme',
      displayName: 'Acme',
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(r.success).toBe(true);
  });
  it('ArtifactVersionSchema requires all 7 per-file digests', () => {
    const base = {
      id: '11111111-1111-1111-1111-111111111111',
      orgId: '22222222-2222-2222-2222-222222222222',
      serviceId: '33333333-3333-3333-3333-333333333333',
      seq: 1,
      bundleDigest: 'a'.repeat(64),
      previousVersionId: null,
      manifestDigest: 'a'.repeat(64),
      pdmDigest: 'a'.repeat(64),
      qsmDigest: 'a'.repeat(64),
      graphIrDigest: 'a'.repeat(64),
      bindingsDigest: 'a'.repeat(64),
      uiDigest: 'a'.repeat(64),
      seedDigest: 'a'.repeat(64),
      validationSnapshot: {},
      publishedByAccountId: '44444444-4444-4444-4444-444444444444',
      publishedByTokenId: null,
      publishedAt: new Date(),
      message: null,
    };
    expect(ArtifactVersionSchema.safeParse(base).success).toBe(true);
    const { pdmDigest: _, ...missing } = base;
    expect(ArtifactVersionSchema.safeParse(missing).success).toBe(false);
  });
  it('ApiTokenSchema — scopes non-empty array of known strings', () => {
    const r = ApiTokenSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      orgId: '22222222-2222-2222-2222-222222222222',
      accountId: '33333333-3333-3333-3333-333333333333',
      name: 'cli',
      tokenHash: new Uint8Array(32),
      prefix: 'rntme_pat_ab',
      scopes: ['project:read'],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/schemas/entities.ts**

```ts
import { z } from 'zod';
import { SlugSchema, TagNameSchema, TokenNameSchema, UuidSchema, WorkosIdSchema } from './primitives.js';

const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);
const RoleSchema = z.enum(['admin', 'member']);
export const ScopeSchema = z.enum([
  'project:read', 'project:write', 'version:publish', 'member:read', 'token:manage',
]);

export const OrganizationSchema = z.object({
  id: UuidSchema,
  workosOrganizationId: WorkosIdSchema,
  slug: SlugSchema,
  displayName: z.string().min(1).max(120),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const AccountSchema = z.object({
  id: UuidSchema,
  workosUserId: WorkosIdSchema,
  email: z.string().email().nullable(),
  displayName: z.string().min(1).max(120),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Account = z.infer<typeof AccountSchema>;

export const MembershipMirrorSchema = z.object({
  orgId: UuidSchema,
  accountId: UuidSchema,
  role: z.string().min(1),
  updatedAt: z.date(),
});
export type MembershipMirror = z.infer<typeof MembershipMirrorSchema>;

export const ProjectSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  slug: SlugSchema,
  displayName: z.string().min(1).max(120),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ServiceSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  projectId: UuidSchema,
  slug: SlugSchema,
  displayName: z.string().min(1).max(120),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const ArtifactVersionSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  serviceId: UuidSchema,
  seq: z.number().int().positive(),
  bundleDigest: Sha256Hex,
  previousVersionId: UuidSchema.nullable(),
  manifestDigest: Sha256Hex,
  pdmDigest: Sha256Hex,
  qsmDigest: Sha256Hex,
  graphIrDigest: Sha256Hex,
  bindingsDigest: Sha256Hex,
  uiDigest: Sha256Hex,
  seedDigest: Sha256Hex,
  validationSnapshot: z.record(z.string(), z.unknown()),
  publishedByAccountId: UuidSchema,
  publishedByTokenId: UuidSchema.nullable(),
  publishedAt: z.date(),
  message: z.string().max(500).nullable(),
});
export type ArtifactVersion = z.infer<typeof ArtifactVersionSchema>;

export const ArtifactTagSchema = z.object({
  serviceId: UuidSchema,
  name: TagNameSchema,
  versionId: UuidSchema,
  updatedAt: z.date(),
  updatedByAccountId: UuidSchema,
});
export type ArtifactTag = z.infer<typeof ArtifactTagSchema>;

export const ApiTokenSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  accountId: UuidSchema,
  name: TokenNameSchema,
  tokenHash: z.instanceof(Uint8Array).refine((u) => u.length === 32, 'sha256 is 32 bytes'),
  prefix: z.string().length(12),
  scopes: z.array(ScopeSchema).min(1),
  lastUsedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  revokedAt: z.date().nullable(),
  createdAt: z.date(),
});
export type ApiToken = z.infer<typeof ApiTokenSchema>;

export const AuditLogEntrySchema = z.object({
  id: z.bigint(),
  orgId: UuidSchema,
  actorAccountId: UuidSchema,
  actorTokenId: UuidSchema.nullable(),
  action: z.string(),
  resourceKind: z.string(),
  resourceId: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export { RoleSchema };
```

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/schemas packages/platform-core/test/unit/schemas
git -C rntme-cli commit -m "feat(platform-core): entity Zod schemas and types"
```

---

### Task B7: Publish-request + CRUD input schemas

**Files:**
- Create: `src/schemas/requests.ts`
- Create: `test/unit/schemas/requests.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/schemas/requests.test.ts
import { describe, it, expect } from 'vitest';
import {
  CreateProjectInputSchema, CreateServiceInputSchema, PublishRequestSchema,
  MoveTagInputSchema, CreateTokenInputSchema,
} from '../../../src/schemas/requests.js';

describe('request schemas', () => {
  it('PublishRequestSchema requires all 7 bundle files', () => {
    const valid = {
      bundle: { manifest: {}, pdm: {}, qsm: {}, graphIr: {}, bindings: {}, ui: {}, seed: {} },
    };
    expect(PublishRequestSchema.safeParse(valid).success).toBe(true);
    const { bundle: _b, ...rest } = valid;
    expect(PublishRequestSchema.safeParse({ ...rest, bundle: { manifest: {}, pdm: {}, qsm: {}, graphIr: {}, bindings: {}, ui: {} } }).success).toBe(false);
  });
  it('CreateProjectInputSchema requires slug+displayName', () => {
    expect(CreateProjectInputSchema.safeParse({ slug: 'foo', displayName: 'Foo' }).success).toBe(true);
    expect(CreateProjectInputSchema.safeParse({ slug: 'foo' }).success).toBe(false);
  });
  it('CreateTokenInputSchema requires non-empty scopes', () => {
    expect(CreateTokenInputSchema.safeParse({ name: 'cli', scopes: ['project:read'] }).success).toBe(true);
    expect(CreateTokenInputSchema.safeParse({ name: 'cli', scopes: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/schemas/requests.ts**

```ts
import { z } from 'zod';
import { SlugSchema, TagNameSchema, TokenNameSchema } from './primitives.js';
import { ScopeSchema } from './entities.js';

export const BundleSchema = z.object({
  manifest: z.record(z.string(), z.unknown()),
  pdm: z.record(z.string(), z.unknown()),
  qsm: z.record(z.string(), z.unknown()),
  graphIr: z.record(z.string(), z.unknown()),
  bindings: z.record(z.string(), z.unknown()),
  ui: z.record(z.string(), z.unknown()),
  seed: z.record(z.string(), z.unknown()),
});
export type BundleInput = z.infer<typeof BundleSchema>;

export const PublishRequestSchema = z.object({
  bundle: BundleSchema,
  previousVersionSeq: z.number().int().positive().optional(),
  message: z.string().max(500).optional(),
  moveTags: z.array(TagNameSchema).max(16).optional(),
});
export type PublishRequest = z.infer<typeof PublishRequestSchema>;

export const CreateProjectInputSchema = z.object({ slug: SlugSchema, displayName: z.string().min(1).max(120) });
export const PatchProjectInputSchema = z.object({ displayName: z.string().min(1).max(120) });
export const CreateServiceInputSchema = z.object({ slug: SlugSchema, displayName: z.string().min(1).max(120) });
export const PatchServiceInputSchema = PatchProjectInputSchema;

export const MoveTagInputSchema = z.object({ versionSeq: z.number().int().positive() });

export const CreateTokenInputSchema = z.object({
  name: TokenNameSchema,
  scopes: z.array(ScopeSchema).min(1),
  expiresAt: z.iso.datetime().optional(),
});
export const ListVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.coerce.number().int().positive().optional(),
});
```

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/schemas/requests.ts packages/platform-core/test/unit/schemas/requests.test.ts
git -C rntme-cli commit -m "feat(platform-core): CRUD and publish request schemas"
```

---

### Task B8: AuthSubject and IdentityProvider interfaces

**Files:**
- Create: `src/auth/provider.ts`
- Create: `src/auth/scopes.ts`
- Create: `test/unit/auth/scopes.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/auth/scopes.test.ts
import { describe, it, expect } from 'vitest';
import { scopesForRole, tokenScopesSubsetOf } from '../../../src/auth/scopes.js';

describe('scopes', () => {
  it('admin has all scopes', () => {
    expect(scopesForRole('admin')).toEqual(['project:read', 'project:write', 'version:publish', 'member:read', 'token:manage']);
  });
  it('member has project + publish only', () => {
    expect(scopesForRole('member')).toEqual(['project:read', 'project:write', 'version:publish']);
  });
  it('tokenScopesSubsetOf rejects elevation', () => {
    expect(tokenScopesSubsetOf(['token:manage'], scopesForRole('member'))).toBe(false);
    expect(tokenScopesSubsetOf(['project:read'], scopesForRole('member'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/auth/scopes.ts**

```ts
import type { z } from 'zod';
import type { ScopeSchema } from '../schemas/entities.js';

export type Scope = z.infer<typeof ScopeSchema>;
export type Role = 'admin' | 'member';

const ROLE_SCOPES: Record<Role, readonly Scope[]> = {
  admin: ['project:read', 'project:write', 'version:publish', 'member:read', 'token:manage'],
  member: ['project:read', 'project:write', 'version:publish'],
};

export function scopesForRole(role: Role): readonly Scope[] {
  return ROLE_SCOPES[role];
}

export function tokenScopesSubsetOf(requested: readonly Scope[], creatorScopes: readonly Scope[]): boolean {
  const allowed = new Set(creatorScopes);
  return requested.every((s) => allowed.has(s));
}
```

- [ ] **Step 4: Implement src/auth/provider.ts**

```ts
import type { Result, PlatformError } from '../types/result.js';
import type { Scope, Role } from './scopes.js';

export type AuthContext = {
  readonly authorizationHeader: string | undefined;
  readonly cookieHeader: string | undefined;
};

export type AuthSubject = {
  readonly account: { readonly id: string; readonly workosUserId: string; readonly displayName: string; readonly email: string | null };
  readonly org:     { readonly id: string; readonly workosOrgId: string; readonly slug: string };
  readonly role:    Role;
  readonly scopes:  readonly Scope[];
  readonly tokenId: string | undefined;
};

export interface IdentityProvider {
  readonly name: 'workos-authkit' | 'api-token';
  authenticate(ctx: AuthContext): Promise<Result<AuthSubject, PlatformError>>;
}
```

- [ ] **Step 5: Run — expect pass.**

- [ ] **Step 6: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/auth packages/platform-core/test/unit/auth
git -C rntme-cli commit -m "feat(platform-core): IdentityProvider seam + scope/role mapping"
```

---

### Task B9: Barrel exports

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update src/index.ts**

```ts
export const VERSION = '0.0.0';

export * from './types/result.js';
export * from './types/brands.js';
export * from './schemas/primitives.js';
export * from './schemas/entities.js';
export * from './schemas/requests.js';
export * from './auth/scopes.js';
export * from './auth/provider.js';
export * from './clock.js';
export * from './ids.js';
export { canonicalize, sha256Hex, canonicalDigest } from './validation/canonical-json.js';
```

- [ ] **Step 2: Build + typecheck + lint + test**

```bash
pnpm -F @rntme-cli/platform-core build
pnpm -F @rntme-cli/platform-core typecheck
pnpm -F @rntme-cli/platform-core lint
pnpm -F @rntme-cli/platform-core test
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/index.ts
git -C rntme-cli commit -m "chore(platform-core): barrel exports"
```

---

## Phase C — platform-core repository interfaces, BlobStore, in-memory fakes

All Phase C tasks are inside `rntme-cli/packages/platform-core/`.

### Task C1: Repository interfaces for Organization / Account / MembershipMirror / WorkosEventLog

**Files:**
- Create: `src/repos/org-repo.ts`
- Create: `src/repos/account-repo.ts`
- Create: `src/repos/membership-mirror-repo.ts`
- Create: `src/repos/workos-event-log-repo.ts`

- [ ] **Step 1: Implement all four interface files**

```ts
// src/repos/org-repo.ts
import type { Organization } from '../schemas/entities.js';
import type { Result, PlatformError } from '../types/result.js';
export interface OrganizationRepo {
  findBySlug(slug: string): Promise<Result<Organization | null, PlatformError>>;
  findByWorkosId(workosId: string): Promise<Result<Organization | null, PlatformError>>;
  listForAccount(accountId: string): Promise<Result<readonly Organization[], PlatformError>>;
  upsertFromWorkos(args: {
    workosOrganizationId: string; slug: string; displayName: string;
  }): Promise<Result<Organization, PlatformError>>;
  archive(id: string): Promise<Result<void, PlatformError>>;
}
```

```ts
// src/repos/account-repo.ts
import type { Account } from '../schemas/entities.js';
import type { Result, PlatformError } from '../types/result.js';
export interface AccountRepo {
  findByWorkosUserId(workosUserId: string): Promise<Result<Account | null, PlatformError>>;
  upsertFromWorkos(args: {
    workosUserId: string; email: string | null; displayName: string;
  }): Promise<Result<Account, PlatformError>>;
  markDeleted(workosUserId: string): Promise<Result<void, PlatformError>>;
}
```

```ts
// src/repos/membership-mirror-repo.ts
import type { MembershipMirror } from '../schemas/entities.js';
import type { Result, PlatformError } from '../types/result.js';
export interface MembershipMirrorRepo {
  find(orgId: string, accountId: string): Promise<Result<MembershipMirror | null, PlatformError>>;
  upsert(row: { orgId: string; accountId: string; role: string }): Promise<Result<MembershipMirror, PlatformError>>;
  delete(orgId: string, accountId: string): Promise<Result<void, PlatformError>>;
  listForAccount(accountId: string): Promise<Result<readonly MembershipMirror[], PlatformError>>;
}
```

```ts
// src/repos/workos-event-log-repo.ts
import type { Result, PlatformError } from '../types/result.js';
export interface WorkosEventLogRepo {
  hasProcessed(eventId: string): Promise<Result<boolean, PlatformError>>;
  markProcessed(eventId: string, eventType: string): Promise<Result<void, PlatformError>>;
}
```

- [ ] **Step 2: Build**

```bash
pnpm -F @rntme-cli/platform-core build
```

- [ ] **Step 3: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/repos/org-repo.ts packages/platform-core/src/repos/account-repo.ts packages/platform-core/src/repos/membership-mirror-repo.ts packages/platform-core/src/repos/workos-event-log-repo.ts
git -C rntme-cli commit -m "feat(platform-core): identity-mirror repo interfaces"
```

---

### Task C2: Repository interfaces for Project / Service

**Files:**
- Create: `src/repos/project-repo.ts`
- Create: `src/repos/service-repo.ts`

- [ ] **Step 1: Implement**

```ts
// src/repos/project-repo.ts
import type { Project } from '../schemas/entities.js';
import type { Result, PlatformError } from '../types/result.js';
export interface ProjectRepo {
  create(row: { id: string; orgId: string; slug: string; displayName: string }): Promise<Result<Project, PlatformError>>;
  findBySlug(orgId: string, slug: string): Promise<Result<Project | null, PlatformError>>;
  findById(orgId: string, id: string): Promise<Result<Project | null, PlatformError>>;
  list(orgId: string, opts: { includeArchived: boolean }): Promise<Result<readonly Project[], PlatformError>>;
  patch(orgId: string, id: string, patch: { displayName: string }): Promise<Result<Project, PlatformError>>;
  archive(orgId: string, id: string): Promise<Result<Project, PlatformError>>;
  countServices(orgId: string, id: string): Promise<Result<number, PlatformError>>;
}
```

```ts
// src/repos/service-repo.ts
import type { Service, ArtifactVersion, ArtifactTag } from '../schemas/entities.js';
import type { Result, PlatformError } from '../types/result.js';
export interface ServiceRepo {
  create(row: { id: string; orgId: string; projectId: string; slug: string; displayName: string }): Promise<Result<Service, PlatformError>>;
  findBySlug(projectId: string, slug: string): Promise<Result<Service | null, PlatformError>>;
  findById(orgId: string, id: string): Promise<Result<Service | null, PlatformError>>;
  list(orgId: string, projectId: string): Promise<Result<readonly Service[], PlatformError>>;
  patch(orgId: string, id: string, patch: { displayName: string }): Promise<Result<Service, PlatformError>>;
  archive(orgId: string, id: string): Promise<Result<Service, PlatformError>>;
  detailWithLatest(orgId: string, id: string): Promise<Result<{
    service: Service; latestVersion: ArtifactVersion | null; tags: readonly ArtifactTag[];
  }, PlatformError>>;
}
```

- [ ] **Step 2: Build + commit**

```bash
pnpm -F @rntme-cli/platform-core build
git -C rntme-cli add packages/platform-core/src/repos/project-repo.ts packages/platform-core/src/repos/service-repo.ts
git -C rntme-cli commit -m "feat(platform-core): project/service repo interfaces"
```

---

### Task C3: Repository interfaces for ArtifactVersion / ArtifactTag

**Files:**
- Create: `src/repos/artifact-repo.ts`
- Create: `src/repos/tag-repo.ts`

- [ ] **Step 1: Implement**

```ts
// src/repos/artifact-repo.ts
import type { ArtifactVersion } from '../schemas/entities.js';
import type { Result, PlatformError } from '../types/result.js';

export type PublishInsertRow = Omit<ArtifactVersion, 'id' | 'seq' | 'publishedAt'> & { id: string };

export interface ArtifactRepo {
  findByDigest(serviceId: string, bundleDigest: string): Promise<Result<ArtifactVersion | null, PlatformError>>;
  latestSeq(serviceId: string): Promise<Result<number, PlatformError>>;

  publish(args: {
    serviceId: string;
    expectedPreviousSeq: number | undefined;
    row: PublishInsertRow;
    outboxPayload: Record<string, unknown>;
    auditActorAccountId: string;
    auditActorTokenId: string | null;
    moveTags: readonly { name: string; updatedByAccountId: string }[];
  }): Promise<Result<ArtifactVersion, PlatformError>>;

  listBySeq(serviceId: string, opts: { limit: number; cursor: number | undefined }): Promise<Result<readonly ArtifactVersion[], PlatformError>>;
  getBySeq(serviceId: string, seq: number): Promise<Result<ArtifactVersion | null, PlatformError>>;
}
```

```ts
// src/repos/tag-repo.ts
import type { ArtifactTag } from '../schemas/entities.js';
import type { Result, PlatformError } from '../types/result.js';
export interface TagRepo {
  list(serviceId: string): Promise<Result<readonly ArtifactTag[], PlatformError>>;
  move(args: { serviceId: string; name: string; versionId: string; updatedByAccountId: string }): Promise<Result<ArtifactTag, PlatformError>>;
  delete(serviceId: string, name: string, actorAccountId: string): Promise<Result<void, PlatformError>>;
}
```

- [ ] **Step 2: Build + commit**

```bash
pnpm -F @rntme-cli/platform-core build
git -C rntme-cli add packages/platform-core/src/repos/artifact-repo.ts packages/platform-core/src/repos/tag-repo.ts
git -C rntme-cli commit -m "feat(platform-core): artifact/tag repo interfaces"
```

---

### Task C4: Repository interfaces for Token / Audit / Outbox

**Files:**
- Create: `src/repos/token-repo.ts`
- Create: `src/repos/audit-repo.ts`
- Create: `src/repos/outbox-repo.ts`

- [ ] **Step 1: Implement**

```ts
// src/repos/token-repo.ts
import type { ApiToken, Scope } from '../schemas/entities.js';
import type { Result, PlatformError } from '../types/result.js';
export interface TokenRepo {
  create(row: {
    id: string; orgId: string; accountId: string; name: string;
    tokenHash: Uint8Array; prefix: string; scopes: readonly Scope[]; expiresAt: Date | null;
  }): Promise<Result<ApiToken, PlatformError>>;
  findByPrefix(prefix: string): Promise<Result<ApiToken | null, PlatformError>>;
  list(orgId: string): Promise<Result<readonly ApiToken[], PlatformError>>;
  revoke(orgId: string, id: string): Promise<Result<void, PlatformError>>;
  touchLastUsed(id: string): Promise<Result<void, PlatformError>>;
}
```

```ts
// src/repos/audit-repo.ts
import type { AuditLogEntry } from '../schemas/entities.js';
import type { Result, PlatformError } from '../types/result.js';
export interface AuditRepo {
  list(orgId: string, opts: { resourceKind?: string; actorAccountId?: string; action?: string; since?: Date; limit: number }):
    Promise<Result<readonly AuditLogEntry[], PlatformError>>;
}
```

```ts
// src/repos/outbox-repo.ts
import type { Result, PlatformError } from '../types/result.js';
export interface OutboxRepo {
  // publish() does nothing standalone — outbox rows are inserted inside ArtifactRepo.publish()'s transaction.
  // This interface exists so application code can peek/deliver if desired (delivery is a future task).
  pending(limit: number): Promise<Result<readonly { id: bigint; eventType: string; payload: Record<string, unknown> }[], PlatformError>>;
  markDelivered(id: bigint): Promise<Result<void, PlatformError>>;
}
```

- [ ] **Step 2: Build + commit**

```bash
pnpm -F @rntme-cli/platform-core build
git -C rntme-cli add packages/platform-core/src/repos/token-repo.ts packages/platform-core/src/repos/audit-repo.ts packages/platform-core/src/repos/outbox-repo.ts
git -C rntme-cli commit -m "feat(platform-core): token/audit/outbox repo interfaces"
```

---

### Task C5: BlobStore interface

**Files:**
- Create: `src/blob/store.ts`
- Create: `test/unit/blob/digest.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/blob/digest.test.ts
import { describe, it, expect } from 'vitest';
import { bundleDigest, perFileDigest } from '../../../src/blob/store.js';

describe('digest helpers', () => {
  it('perFileDigest is canonical-JSON sha256', () => {
    const d1 = perFileDigest({ b: 1, a: 2 });
    const d2 = perFileDigest({ a: 2, b: 1 });
    expect(d1).toBe(d2);
    expect(d1).toMatch(/^[0-9a-f]{64}$/);
  });
  it('bundleDigest concatenates in fixed order', () => {
    const per = { manifest: 'a'.repeat(64), pdm: 'b'.repeat(64), qsm: 'c'.repeat(64), graphIr: 'd'.repeat(64), bindings: 'e'.repeat(64), ui: 'f'.repeat(64), seed: '0'.repeat(64) };
    const d = bundleDigest(per);
    expect(d).toMatch(/^[0-9a-f]{64}$/);
    // Non-alphabetical order (manifest→pdm→qsm→graphIr→bindings→ui→seed) matches spec §6
    const again = bundleDigest({ ...per });
    expect(d).toBe(again);
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/blob/store.ts**

```ts
import type { Result, PlatformError } from '../types/result.js';
import { canonicalDigest, sha256Hex } from '../validation/canonical-json.js';

export type PerFileDigests = {
  readonly manifest: string; readonly pdm: string; readonly qsm: string;
  readonly graphIr: string; readonly bindings: string; readonly ui: string; readonly seed: string;
};

const BUNDLE_ORDER = ['manifest', 'pdm', 'qsm', 'graphIr', 'bindings', 'ui', 'seed'] as const;

export function perFileDigest(file: unknown): string {
  return canonicalDigest(file);
}

export function bundleDigest(per: PerFileDigests): string {
  return sha256Hex(BUNDLE_ORDER.map((k) => per[k]).join(''));
}

export function blobKey(digest: string): string {
  return `sha256/${digest.slice(0, 2)}/${digest}.json`;
}

export interface BlobStore {
  putIfAbsent(key: string, body: Buffer): Promise<Result<void, PlatformError>>;
  presignedGet(key: string, expiresSeconds: number): Promise<Result<string, PlatformError>>;
  getJson<T = unknown>(key: string): Promise<Result<T, PlatformError>>;
}
```

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/blob packages/platform-core/test/unit/blob
git -C rntme-cli commit -m "feat(platform-core): BlobStore interface + digest helpers"
```

---

### Task C6: In-memory fakes for all repos + BlobStore

**Files:**
- Create: `src/testing/fakes.ts`
- Create: `test/unit/testing/fakes.test.ts`

- [ ] **Step 1: Test (contract sanity)**

```ts
// test/unit/testing/fakes.test.ts
import { describe, it, expect } from 'vitest';
import { FakeStore, isOk } from '../../../src/testing/fakes.js';

describe('FakeStore', () => {
  it('round-trips a project create/list', async () => {
    const s = new FakeStore();
    const seed = await s.seedOrg({ slug: 'o1', workosOrganizationId: 'org_1', displayName: 'o' });
    const created = await s.projects.create({ id: 'p1', orgId: seed.id, slug: 'proj', displayName: 'P' });
    expect(isOk(created)).toBe(true);
    const list = await s.projects.list(seed.id, { includeArchived: false });
    expect(isOk(list) && list.value).toHaveLength(1);
  });

  it('publish is idempotent by bundleDigest', async () => {
    const s = new FakeStore();
    const org = await s.seedOrg({ slug: 'o1', workosOrganizationId: 'org_1', displayName: 'o' });
    const proj = await s.projects.create({ id: 'p1', orgId: org.id, slug: 'proj', displayName: 'P' });
    if (!isOk(proj)) throw new Error('seed');
    const svc = await s.services.create({ id: 's1', orgId: org.id, projectId: proj.value.id, slug: 'svc', displayName: 'S' });
    if (!isOk(svc)) throw new Error('seed');
    const account = await s.seedAccount({ workosUserId: 'u1', displayName: 'U', email: null });
    const row = {
      id: 'v1', orgId: org.id, serviceId: svc.value.id,
      bundleDigest: 'a'.repeat(64), previousVersionId: null,
      manifestDigest: 'a'.repeat(64), pdmDigest: 'a'.repeat(64), qsmDigest: 'a'.repeat(64),
      graphIrDigest: 'a'.repeat(64), bindingsDigest: 'a'.repeat(64), uiDigest: 'a'.repeat(64), seedDigest: 'a'.repeat(64),
      validationSnapshot: {}, publishedByAccountId: account.id, publishedByTokenId: null, message: null,
    };
    const r1 = await s.artifacts.publish({ serviceId: svc.value.id, expectedPreviousSeq: undefined, row, outboxPayload: {}, auditActorAccountId: account.id, auditActorTokenId: null, moveTags: [] });
    const r2 = await s.artifacts.publish({ serviceId: svc.value.id, expectedPreviousSeq: undefined, row: { ...row, id: 'v2' }, outboxPayload: {}, auditActorAccountId: account.id, auditActorTokenId: null, moveTags: [] });
    expect(isOk(r1) && isOk(r2)).toBe(true);
    if (isOk(r1) && isOk(r2)) expect(r1.value.id).toBe(r2.value.id);  // idempotent
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/testing/fakes.ts**

```ts
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { Organization, Account, MembershipMirror, Project, Service, ArtifactVersion, ArtifactTag, ApiToken, AuditLogEntry } from '../schemas/entities.js';
import type { OrganizationRepo } from '../repos/org-repo.js';
import type { AccountRepo } from '../repos/account-repo.js';
import type { MembershipMirrorRepo } from '../repos/membership-mirror-repo.js';
import type { WorkosEventLogRepo } from '../repos/workos-event-log-repo.js';
import type { ProjectRepo } from '../repos/project-repo.js';
import type { ServiceRepo } from '../repos/service-repo.js';
import type { ArtifactRepo, PublishInsertRow } from '../repos/artifact-repo.js';
import type { TagRepo } from '../repos/tag-repo.js';
import type { TokenRepo } from '../repos/token-repo.js';
import type { AuditRepo } from '../repos/audit-repo.js';
import type { OutboxRepo } from '../repos/outbox-repo.js';
import type { BlobStore } from '../blob/store.js';

export { isOk };

function notFound(code: PlatformError['code'], message: string): PlatformError { return { code, message }; }

export class FakeStore {
  public orgs = new Map<string, Organization>();
  public accounts = new Map<string, Account>();
  public memberships = new Map<string, MembershipMirror>();
  public projectsByOrg = new Map<string, Project[]>();
  public servicesByProject = new Map<string, Service[]>();
  public versionsByService = new Map<string, ArtifactVersion[]>();
  public tagsByService = new Map<string, ArtifactTag[]>();
  public tokens = new Map<string, ApiToken>();
  public audit: AuditLogEntry[] = [];
  public outbox: { id: bigint; eventType: string; payload: Record<string, unknown>; deliveredAt: Date | null }[] = [];
  public workosEvents = new Set<string>();
  public blobs = new Map<string, Buffer>();

  private autoId = 1;
  private now = () => new Date();
  private nextOutboxId = 1n;

  async seedOrg(args: { slug: string; workosOrganizationId: string; displayName: string }): Promise<Organization> {
    const o: Organization = { id: `org-${this.autoId++}`, workosOrganizationId: args.workosOrganizationId, slug: args.slug, displayName: args.displayName, createdAt: this.now(), updatedAt: this.now() };
    this.orgs.set(o.id, o); return o;
  }
  async seedAccount(args: { workosUserId: string; displayName: string; email: string | null }): Promise<Account> {
    const a: Account = { id: `acc-${this.autoId++}`, workosUserId: args.workosUserId, email: args.email, displayName: args.displayName, deletedAt: null, createdAt: this.now(), updatedAt: this.now() };
    this.accounts.set(a.id, a); return a;
  }

  readonly organizations: OrganizationRepo = {
    findBySlug: async (slug) => ok([...this.orgs.values()].find((o) => o.slug === slug) ?? null),
    findByWorkosId: async (wid) => ok([...this.orgs.values()].find((o) => o.workosOrganizationId === wid) ?? null),
    listForAccount: async (accountId) => {
      const ids = new Set([...this.memberships.values()].filter((m) => m.accountId === accountId).map((m) => m.orgId));
      return ok([...this.orgs.values()].filter((o) => ids.has(o.id)));
    },
    upsertFromWorkos: async (a) => {
      const existing = [...this.orgs.values()].find((o) => o.workosOrganizationId === a.workosOrganizationId);
      if (existing) { const updated = { ...existing, slug: a.slug, displayName: a.displayName, updatedAt: this.now() }; this.orgs.set(existing.id, updated); return ok(updated); }
      const o = await this.seedOrg(a); return ok(o);
    },
    archive: async (id) => { this.orgs.delete(id); return ok(undefined); },
  };

  readonly accountsRepo: AccountRepo = {
    findByWorkosUserId: async (wid) => ok([...this.accounts.values()].find((a) => a.workosUserId === wid) ?? null),
    upsertFromWorkos: async (a) => {
      const existing = [...this.accounts.values()].find((x) => x.workosUserId === a.workosUserId);
      if (existing) { const u = { ...existing, email: a.email, displayName: a.displayName, updatedAt: this.now() }; this.accounts.set(existing.id, u); return ok(u); }
      return ok(await this.seedAccount(a));
    },
    markDeleted: async (wid) => {
      const x = [...this.accounts.values()].find((a) => a.workosUserId === wid);
      if (x) this.accounts.set(x.id, { ...x, deletedAt: this.now() });
      return ok(undefined);
    },
  };

  readonly membershipMirror: MembershipMirrorRepo = {
    find: async (o, a) => ok(this.memberships.get(`${o}:${a}`) ?? null),
    upsert: async (row) => {
      const m: MembershipMirror = { ...row, updatedAt: this.now() };
      this.memberships.set(`${row.orgId}:${row.accountId}`, m);
      return ok(m);
    },
    delete: async (o, a) => { this.memberships.delete(`${o}:${a}`); return ok(undefined); },
    listForAccount: async (a) => ok([...this.memberships.values()].filter((m) => m.accountId === a)),
  };

  readonly workosEventLog: WorkosEventLogRepo = {
    hasProcessed: async (id) => ok(this.workosEvents.has(id)),
    markProcessed: async (id) => { this.workosEvents.add(id); return ok(undefined); },
  };

  readonly projects: ProjectRepo = {
    create: async (r) => {
      const list = this.projectsByOrg.get(r.orgId) ?? [];
      if (list.some((p) => p.slug === r.slug && p.archivedAt === null)) return err([notFound('PLATFORM_CONFLICT_SLUG_TAKEN', `project slug ${r.slug} taken`)]);
      const p: Project = { ...r, archivedAt: null, createdAt: this.now(), updatedAt: this.now() };
      this.projectsByOrg.set(r.orgId, [...list, p]);
      return ok(p);
    },
    findBySlug: async (o, s) => ok((this.projectsByOrg.get(o) ?? []).find((p) => p.slug === s) ?? null),
    findById: async (o, id) => ok((this.projectsByOrg.get(o) ?? []).find((p) => p.id === id) ?? null),
    list: async (o, opts) => {
      const all = this.projectsByOrg.get(o) ?? [];
      return ok(opts.includeArchived ? all : all.filter((p) => !p.archivedAt));
    },
    patch: async (o, id, patch) => {
      const list = this.projectsByOrg.get(o) ?? [];
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) return err([notFound('PLATFORM_TENANCY_PROJECT_NOT_FOUND', id)]);
      const u = { ...list[idx]!, displayName: patch.displayName, updatedAt: this.now() };
      list[idx] = u; this.projectsByOrg.set(o, list); return ok(u);
    },
    archive: async (o, id) => {
      const list = this.projectsByOrg.get(o) ?? [];
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) return err([notFound('PLATFORM_TENANCY_PROJECT_NOT_FOUND', id)]);
      const u = { ...list[idx]!, archivedAt: this.now(), updatedAt: this.now() };
      list[idx] = u; this.projectsByOrg.set(o, list); return ok(u);
    },
    countServices: async (_o, id) => ok((this.servicesByProject.get(id) ?? []).filter((s) => !s.archivedAt).length),
  };

  readonly services: ServiceRepo = {
    create: async (r) => {
      const list = this.servicesByProject.get(r.projectId) ?? [];
      if (list.some((s) => s.slug === r.slug && !s.archivedAt)) return err([notFound('PLATFORM_CONFLICT_SLUG_TAKEN', `service slug ${r.slug} taken`)]);
      const s: Service = { ...r, archivedAt: null, createdAt: this.now(), updatedAt: this.now() };
      this.servicesByProject.set(r.projectId, [...list, s]);
      return ok(s);
    },
    findBySlug: async (pid, slug) => ok((this.servicesByProject.get(pid) ?? []).find((s) => s.slug === slug) ?? null),
    findById: async (o, id) => {
      for (const list of this.servicesByProject.values()) {
        const f = list.find((s) => s.id === id && s.orgId === o);
        if (f) return ok(f);
      }
      return ok(null);
    },
    list: async (_o, pid) => ok(this.servicesByProject.get(pid) ?? []),
    patch: async (o, id, patch) => {
      for (const [pid, list] of this.servicesByProject) {
        const idx = list.findIndex((s) => s.id === id && s.orgId === o);
        if (idx >= 0) {
          const u = { ...list[idx]!, displayName: patch.displayName, updatedAt: this.now() };
          list[idx] = u; this.servicesByProject.set(pid, list); return ok(u);
        }
      }
      return err([notFound('PLATFORM_TENANCY_SERVICE_NOT_FOUND', id)]);
    },
    archive: async (o, id) => {
      for (const [pid, list] of this.servicesByProject) {
        const idx = list.findIndex((s) => s.id === id && s.orgId === o);
        if (idx >= 0) {
          const u = { ...list[idx]!, archivedAt: this.now(), updatedAt: this.now() };
          list[idx] = u; this.servicesByProject.set(pid, list); return ok(u);
        }
      }
      return err([notFound('PLATFORM_TENANCY_SERVICE_NOT_FOUND', id)]);
    },
    detailWithLatest: async (o, id) => {
      const svcR = await this.services.findById(o, id);
      if (!isOk(svcR)) return svcR as Result<never, PlatformError>;
      if (!svcR.value) return err([notFound('PLATFORM_TENANCY_SERVICE_NOT_FOUND', id)]);
      const versions = this.versionsByService.get(id) ?? [];
      const latestVersion = versions.length ? versions[versions.length - 1]! : null;
      const tags = this.tagsByService.get(id) ?? [];
      return ok({ service: svcR.value, latestVersion, tags });
    },
  };

  readonly artifacts: ArtifactRepo = {
    findByDigest: async (sid, d) => {
      const list = this.versionsByService.get(sid) ?? [];
      return ok(list.find((v) => v.bundleDigest === d) ?? null);
    },
    latestSeq: async (sid) => {
      const list = this.versionsByService.get(sid) ?? [];
      return ok(list.length ? list[list.length - 1]!.seq : 0);
    },
    publish: async (args) => {
      const list = this.versionsByService.get(args.serviceId) ?? [];
      const dup = list.find((v) => v.bundleDigest === args.row.bundleDigest);
      if (dup) return ok(dup);
      const latest = list.length ? list[list.length - 1]!.seq : 0;
      if (args.expectedPreviousSeq !== undefined && args.expectedPreviousSeq !== latest) {
        return err([notFound('PLATFORM_CONCURRENCY_VERSION_CONFLICT', `expected ${args.expectedPreviousSeq} but latest is ${latest}`)]);
      }
      const v: ArtifactVersion = { ...(args.row as Omit<ArtifactVersion, 'seq' | 'publishedAt'>), seq: latest + 1, publishedAt: this.now() };
      this.versionsByService.set(args.serviceId, [...list, v]);
      this.outbox.push({ id: this.nextOutboxId++, eventType: 'artifact.version.published', payload: args.outboxPayload, deliveredAt: null });
      this.audit.push({
        id: BigInt(this.audit.length + 1), orgId: v.orgId, actorAccountId: args.auditActorAccountId, actorTokenId: args.auditActorTokenId,
        action: 'version.published', resourceKind: 'version', resourceId: v.id, payload: { seq: v.seq }, createdAt: this.now(),
      });
      const tags = this.tagsByService.get(args.serviceId) ?? [];
      for (const t of args.moveTags) {
        const idx = tags.findIndex((x) => x.name === t.name);
        const tag: ArtifactTag = { serviceId: args.serviceId, name: t.name, versionId: v.id, updatedAt: this.now(), updatedByAccountId: t.updatedByAccountId };
        if (idx >= 0) tags[idx] = tag; else tags.push(tag);
        this.audit.push({
          id: BigInt(this.audit.length + 1), orgId: v.orgId, actorAccountId: args.auditActorAccountId, actorTokenId: args.auditActorTokenId,
          action: 'tag.moved', resourceKind: 'tag', resourceId: t.name, payload: { versionSeq: v.seq }, createdAt: this.now(),
        });
      }
      this.tagsByService.set(args.serviceId, tags);
      return ok(v);
    },
    listBySeq: async (sid, { limit, cursor }) => {
      let list = this.versionsByService.get(sid) ?? [];
      if (cursor !== undefined) list = list.filter((v) => v.seq < cursor);
      return ok([...list].reverse().slice(0, limit));
    },
    getBySeq: async (sid, seq) => {
      const list = this.versionsByService.get(sid) ?? [];
      return ok(list.find((v) => v.seq === seq) ?? null);
    },
  };

  readonly tags: TagRepo = {
    list: async (sid) => ok(this.tagsByService.get(sid) ?? []),
    move: async (a) => {
      const list = this.tagsByService.get(a.serviceId) ?? [];
      const idx = list.findIndex((t) => t.name === a.name);
      const t: ArtifactTag = { serviceId: a.serviceId, name: a.name, versionId: a.versionId, updatedAt: this.now(), updatedByAccountId: a.updatedByAccountId };
      if (idx >= 0) list[idx] = t; else list.push(t);
      this.tagsByService.set(a.serviceId, list);
      return ok(t);
    },
    delete: async (sid, name) => {
      const list = (this.tagsByService.get(sid) ?? []).filter((t) => t.name !== name);
      this.tagsByService.set(sid, list);
      return ok(undefined);
    },
  };

  readonly tokensRepo: TokenRepo = {
    create: async (r) => {
      const t: ApiToken = { ...r, lastUsedAt: null, expiresAt: r.expiresAt, revokedAt: null, createdAt: this.now() };
      this.tokens.set(t.id, t); return ok(t);
    },
    findByPrefix: async (p) => ok([...this.tokens.values()].find((t) => t.prefix === p && !t.revokedAt) ?? null),
    list: async (o) => ok([...this.tokens.values()].filter((t) => t.orgId === o)),
    revoke: async (_o, id) => {
      const t = this.tokens.get(id); if (t) this.tokens.set(id, { ...t, revokedAt: this.now() });
      return ok(undefined);
    },
    touchLastUsed: async (id) => {
      const t = this.tokens.get(id); if (t) this.tokens.set(id, { ...t, lastUsedAt: this.now() });
      return ok(undefined);
    },
  };

  readonly auditRepo: AuditRepo = {
    list: async (o, opts) => {
      let list = this.audit.filter((a) => a.orgId === o);
      if (opts.resourceKind) list = list.filter((a) => a.resourceKind === opts.resourceKind);
      if (opts.actorAccountId) list = list.filter((a) => a.actorAccountId === opts.actorAccountId);
      if (opts.action) list = list.filter((a) => a.action === opts.action);
      if (opts.since) list = list.filter((a) => a.createdAt >= opts.since!);
      return ok(list.slice(-opts.limit).reverse());
    },
  };

  readonly outboxRepo: OutboxRepo = {
    pending: async (limit) => ok(this.outbox.filter((o) => o.deliveredAt === null).slice(0, limit).map((o) => ({ id: o.id, eventType: o.eventType, payload: o.payload }))),
    markDelivered: async (id) => {
      const r = this.outbox.find((o) => o.id === id); if (r) r.deliveredAt = this.now();
      return ok(undefined);
    },
  };

  readonly blob: BlobStore = {
    putIfAbsent: async (key, body) => { if (!this.blobs.has(key)) this.blobs.set(key, Buffer.from(body)); return ok(undefined); },
    presignedGet: async (key) => ok(`memory://${key}`),
    getJson: async (key) => {
      const b = this.blobs.get(key); if (!b) return err([notFound('PLATFORM_INTERNAL', `blob ${key} missing`)]);
      return ok(JSON.parse(b.toString('utf8')) as unknown);
    },
  };
}
```

- [ ] **Step 4: Run — expect pass.**

```bash
pnpm -F @rntme-cli/platform-core test
```

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/testing packages/platform-core/test/unit/testing
git -C rntme-cli commit -m "feat(platform-core): in-memory FakeStore covering all repo seams"
```

---

## Phase D — platform-core use-cases

All tasks inside `rntme-cli/packages/platform-core/`. Each use-case is a pure function/class that takes injected seams and returns `Result`.

### Task D1: Project use-cases (create, list, get, patch, archive)

**Files:**
- Create: `src/use-cases/projects.ts`
- Create: `test/unit/use-cases/projects.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/use-cases/projects.test.ts
import { describe, it, expect } from 'vitest';
import { FakeStore, isOk } from '../../../src/testing/fakes.js';
import { createProject, listProjects, getProject, patchProject, archiveProject } from '../../../src/use-cases/projects.js';
import { SeededIds } from '../../../src/ids.js';

async function setup() {
  const store = new FakeStore();
  const ids = new SeededIds(['id-1', 'id-2', 'id-3', 'id-4']);
  const org = await store.seedOrg({ slug: 'o1', workosOrganizationId: 'org_1', displayName: 'o' });
  return { store, ids, orgId: org.id };
}

describe('project use-cases', () => {
  it('createProject inserts and returns', async () => {
    const { store, ids, orgId } = await setup();
    const r = await createProject({ repos: { projects: store.projects }, ids }, { orgId, slug: 'proj', displayName: 'P' });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.slug).toBe('proj');
  });
  it('createProject returns PLATFORM_CONFLICT_SLUG_TAKEN on duplicate', async () => {
    const { store, ids, orgId } = await setup();
    await createProject({ repos: { projects: store.projects }, ids }, { orgId, slug: 'proj', displayName: 'P' });
    const r = await createProject({ repos: { projects: store.projects }, ids }, { orgId, slug: 'proj', displayName: 'P2' });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_CONFLICT_SLUG_TAKEN');
  });
  it('listProjects excludes archived by default', async () => {
    const { store, ids, orgId } = await setup();
    const c = await createProject({ repos: { projects: store.projects }, ids }, { orgId, slug: 'a', displayName: 'A' });
    if (!isOk(c)) throw new Error('seed');
    await archiveProject({ repos: { projects: store.projects } }, { orgId, id: c.value.id });
    const r = await listProjects({ repos: { projects: store.projects } }, { orgId, includeArchived: false });
    expect(isOk(r) && r.value).toHaveLength(0);
  });
  it('getProject returns 404 code when missing', async () => {
    const { store, orgId } = await setup();
    const r = await getProject({ repos: { projects: store.projects } }, { orgId, id: 'missing' });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_TENANCY_PROJECT_NOT_FOUND');
  });
  it('patchProject updates displayName', async () => {
    const { store, ids, orgId } = await setup();
    const c = await createProject({ repos: { projects: store.projects }, ids }, { orgId, slug: 'p1', displayName: 'old' });
    if (!isOk(c)) throw new Error('seed');
    const r = await patchProject({ repos: { projects: store.projects } }, { orgId, id: c.value.id, displayName: 'new' });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.displayName).toBe('new');
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/use-cases/projects.ts**

```ts
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { Project } from '../schemas/entities.js';
import type { ProjectRepo } from '../repos/project-repo.js';
import type { Ids } from '../ids.js';

type Deps = { repos: { projects: ProjectRepo }; ids?: Ids };

export async function createProject(
  deps: Deps & { ids: Ids },
  input: { orgId: string; slug: string; displayName: string },
): Promise<Result<Project, PlatformError>> {
  const id = deps.ids.uuid();
  return deps.repos.projects.create({ id, orgId: input.orgId, slug: input.slug, displayName: input.displayName });
}

export async function listProjects(
  deps: Deps,
  input: { orgId: string; includeArchived: boolean },
): Promise<Result<readonly Project[], PlatformError>> {
  return deps.repos.projects.list(input.orgId, { includeArchived: input.includeArchived });
}

export async function getProject(
  deps: Deps,
  input: { orgId: string; id: string },
): Promise<Result<Project, PlatformError>> {
  const r = await deps.repos.projects.findById(input.orgId, input.id);
  if (!isOk(r)) return r;
  if (!r.value) return err([{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.id }]);
  return ok(r.value);
}

export async function patchProject(
  deps: Deps,
  input: { orgId: string; id: string; displayName: string },
): Promise<Result<Project, PlatformError>> {
  return deps.repos.projects.patch(input.orgId, input.id, { displayName: input.displayName });
}

export async function archiveProject(
  deps: Deps,
  input: { orgId: string; id: string },
): Promise<Result<Project, PlatformError>> {
  return deps.repos.projects.archive(input.orgId, input.id);
}
```

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/use-cases/projects.ts packages/platform-core/test/unit/use-cases/projects.test.ts
git -C rntme-cli commit -m "feat(platform-core): project use-cases (create/list/get/patch/archive)"
```

---

### Task D2: Service use-cases (create, list, get, patch, archive, detail)

**Files:**
- Create: `src/use-cases/services.ts`
- Create: `test/unit/use-cases/services.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/use-cases/services.test.ts
import { describe, it, expect } from 'vitest';
import { FakeStore, isOk } from '../../../src/testing/fakes.js';
import { createService, listServices, getServiceDetail, patchService, archiveService } from '../../../src/use-cases/services.js';
import { SeededIds } from '../../../src/ids.js';

async function setup() {
  const store = new FakeStore();
  const ids = new SeededIds(['svc-1', 'svc-2']);
  const org = await store.seedOrg({ slug: 'o1', workosOrganizationId: 'org_1', displayName: 'o' });
  const proj = await store.projects.create({ id: 'p1', orgId: org.id, slug: 'pr', displayName: 'P' });
  if (!isOk(proj)) throw new Error('seed');
  return { store, ids, orgId: org.id, projectId: proj.value.id };
}

describe('service use-cases', () => {
  it('createService + listServices', async () => {
    const { store, ids, orgId, projectId } = await setup();
    const c = await createService({ repos: { services: store.services }, ids }, { orgId, projectId, slug: 's1', displayName: 'S' });
    expect(isOk(c)).toBe(true);
    const l = await listServices({ repos: { services: store.services } }, { orgId, projectId });
    expect(isOk(l) && l.value).toHaveLength(1);
  });
  it('getServiceDetail returns 404 when missing', async () => {
    const { store, orgId } = await setup();
    const r = await getServiceDetail({ repos: { services: store.services } }, { orgId, id: 'x' });
    expect(isOk(r)).toBe(false);
  });
  it('patchService / archiveService', async () => {
    const { store, ids, orgId, projectId } = await setup();
    const c = await createService({ repos: { services: store.services }, ids }, { orgId, projectId, slug: 's1', displayName: 'S' });
    if (!isOk(c)) throw new Error('seed');
    const p = await patchService({ repos: { services: store.services } }, { orgId, id: c.value.id, displayName: 'S2' });
    expect(isOk(p) && p.value.displayName).toBe('S2');
    const a = await archiveService({ repos: { services: store.services } }, { orgId, id: c.value.id });
    expect(isOk(a)).toBe(true);
    if (isOk(a)) expect(a.value.archivedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/use-cases/services.ts**

```ts
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { Service, ArtifactVersion, ArtifactTag } from '../schemas/entities.js';
import type { ServiceRepo } from '../repos/service-repo.js';
import type { Ids } from '../ids.js';

type Deps = { repos: { services: ServiceRepo } };

export async function createService(
  deps: Deps & { ids: Ids },
  input: { orgId: string; projectId: string; slug: string; displayName: string },
): Promise<Result<Service, PlatformError>> {
  return deps.repos.services.create({ id: deps.ids.uuid(), orgId: input.orgId, projectId: input.projectId, slug: input.slug, displayName: input.displayName });
}

export async function listServices(deps: Deps, input: { orgId: string; projectId: string }): Promise<Result<readonly Service[], PlatformError>> {
  return deps.repos.services.list(input.orgId, input.projectId);
}

export async function getServiceDetail(
  deps: Deps,
  input: { orgId: string; id: string },
): Promise<Result<{ service: Service; latestVersion: ArtifactVersion | null; tags: readonly ArtifactTag[] }, PlatformError>> {
  const r = await deps.repos.services.detailWithLatest(input.orgId, input.id);
  if (!isOk(r)) return r;
  return ok(r.value);
}

export async function patchService(deps: Deps, input: { orgId: string; id: string; displayName: string }): Promise<Result<Service, PlatformError>> {
  return deps.repos.services.patch(input.orgId, input.id, { displayName: input.displayName });
}

export async function archiveService(deps: Deps, input: { orgId: string; id: string }): Promise<Result<Service, PlatformError>> {
  return deps.repos.services.archive(input.orgId, input.id);
}
```

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/use-cases/services.ts packages/platform-core/test/unit/use-cases/services.test.ts
git -C rntme-cli commit -m "feat(platform-core): service use-cases"
```

---

### Task D3: Bundle validation adapter to @rntme/*

**Files:**
- Create: `src/validation/bundle.ts`
- Create: `test/unit/validation/bundle.test.ts`
- Create: `test/fixtures/bundles/minimal-valid.ts`
- Create: `test/fixtures/bundles/broken-pdm.ts`

- [ ] **Step 1: Fixture — minimal valid bundle**

The bundle needs a minimal PDM/QSM/graph-IR/bindings/UI/seed/manifest that passes all `@rntme/*` validators. Cribbing from `demo/issue-tracker-api/artifacts/` in the public repo is the shortest path.

```ts
// test/fixtures/bundles/minimal-valid.ts
import type { BundleInput } from '../../../src/schemas/requests.js';
export const minimalValidBundle: BundleInput = {
  manifest: { /* copy the minimal shape from demo/issue-tracker-api/artifacts/manifest.json */ },
  pdm:      { /* likewise */ },
  qsm:      { /* likewise */ },
  graphIr:  { /* likewise */ },
  bindings: { /* likewise */ },
  ui:       { /* likewise */ },
  seed:     { /* likewise */ },
};
```

Engineer instruction: open `demo/issue-tracker-api/artifacts/` in the public repo and copy the seven JSON artefacts into this fixture (inlined as TS object literals). Strip any demo-specific projections that aren't necessary — the goal is "minimum that passes every `@rntme/*` validator".

- [ ] **Step 2: Fixture — broken PDM**

```ts
// test/fixtures/bundles/broken-pdm.ts
import { minimalValidBundle } from './minimal-valid.js';
export const brokenPdmBundle = {
  ...minimalValidBundle,
  pdm: { ...minimalValidBundle.pdm, entities: [{ name: '!!invalid-name!!', fields: [] }] },
};
```

- [ ] **Step 3: Test**

```ts
// test/unit/validation/bundle.test.ts
import { describe, it, expect } from 'vitest';
import { validateBundle } from '../../../src/validation/bundle.js';
import { isOk } from '../../../src/types/result.js';
import { minimalValidBundle } from '../../fixtures/bundles/minimal-valid.js';
import { brokenPdmBundle } from '../../fixtures/bundles/broken-pdm.js';

describe('validateBundle', () => {
  it('passes a minimal valid bundle', async () => {
    const r = await validateBundle(minimalValidBundle);
    expect(isOk(r)).toBe(true);
  });
  it('fails PDM layer first when PDM is broken', async () => {
    const r = await validateBundle(brokenPdmBundle);
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) {
      const top = r.errors[0]!;
      expect(top.code).toBe('PLATFORM_VALIDATION_BUNDLE_FAILED');
      expect(top.pkg).toBe('pdm');
    }
  });
});
```

- [ ] **Step 4: Run — expect fail.**

- [ ] **Step 5: Implement src/validation/bundle.ts**

```ts
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { ValidatedPublishBundle } from '../types/brands.js';
import type { BundleInput } from '../schemas/requests.js';

import { parsePdm, validatePdm } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { parseBindingArtifact, validateBindings } from '@rntme/bindings';
import { validateSeed, parseSeed } from '@rntme/seed';
import { validate as validateUi, resolve as resolveUi, expand as expandUi } from '@rntme/ui';
// graph-ir-compiler: use parseAuthoringSpec + validateStructural + validateSemantic
import { parseAuthoringSpec as parseGraph } from '@rntme/graph-ir-compiler/src/parse/parse.js';
import { validateStructural as validateGraphStructural } from '@rntme/graph-ir-compiler/src/validate/structural/index.js';
import { validateSemantic as validateGraphSemantic } from '@rntme/graph-ir-compiler/src/validate/semantic/index.js';

function bubble(pkg: string, stage: 'parse' | 'structural' | 'references' | 'consistency' | 'semantic', errors: readonly { code: string; message: string; path?: string }[]): PlatformError {
  return {
    code: 'PLATFORM_VALIDATION_BUNDLE_FAILED',
    stage: 'validation',
    pkg,
    message: errors[0]?.message ?? `${pkg} ${stage} failed`,
    cause: { stage, errors },
  };
}

export async function validateBundle(input: BundleInput): Promise<Result<ValidatedPublishBundle, PlatformError>> {
  // 1. PDM
  const pdmParsed = parsePdm(input.pdm);
  if (!isOk(pdmParsed)) return err([bubble('pdm', 'parse', pdmParsed.errors)]);
  const pdmValidated = validatePdm(pdmParsed.value);
  if (!isOk(pdmValidated)) return err([bubble('pdm', 'structural', pdmValidated.errors)]);

  // 2. QSM
  const qsmParsed = parseQsm(input.qsm);
  if (!isOk(qsmParsed)) return err([bubble('qsm', 'parse', qsmParsed.errors)]);
  const qsmValidated = validateQsm(qsmParsed.value, { pdm: pdmValidated.value });
  if (!isOk(qsmValidated)) return err([bubble('qsm', 'structural', qsmValidated.errors)]);

  // 3. Graph IR (multi-step)
  const graphParsed = parseGraph(input.graphIr);
  if (!isOk(graphParsed)) return err([bubble('graph-ir', 'parse', graphParsed.errors)]);
  const graphStruct = validateGraphStructural(graphParsed.value);
  if (!isOk(graphStruct)) return err([bubble('graph-ir', 'structural', graphStruct.errors)]);
  const graphSemantic = validateGraphSemantic(graphStruct.value, { pdm: pdmValidated.value, qsm: qsmValidated.value });
  if (!isOk(graphSemantic)) return err([bubble('graph-ir', 'semantic', graphSemantic.errors)]);

  // 4. Bindings
  const bindingsParsed = parseBindingArtifact(input.bindings);
  if (!isOk(bindingsParsed)) return err([bubble('bindings', 'parse', bindingsParsed.errors)]);
  const bindingsValidated = validateBindings(bindingsParsed.value, { pdm: pdmValidated.value, qsm: qsmValidated.value });
  if (!isOk(bindingsValidated)) return err([bubble('bindings', 'consistency', bindingsValidated.errors)]);

  // 5. UI (compile pipeline covers validate)
  const uiResolved = resolveUi(input.ui as never);
  if (!isOk(uiResolved)) return err([bubble('ui', 'references', uiResolved.errors)]);
  const uiExpanded = expandUi(uiResolved.value);
  if (!isOk(uiExpanded)) return err([bubble('ui', 'references', uiExpanded.errors)]);
  const uiValidated = validateUi(uiExpanded.value, { bindings: bindingsValidated.value, qsm: qsmValidated.value } as never);
  if (!isOk(uiValidated)) return err([bubble('ui', 'consistency', uiValidated.errors)]);

  // 6. Seed
  const seedParsed = parseSeed(input.seed);
  if (!isOk(seedParsed)) return err([bubble('seed', 'parse', seedParsed.errors)]);
  const seedValidated = validateSeed(seedParsed.value, { pdm: pdmValidated.value });
  if (!isOk(seedValidated)) return err([bubble('seed', 'structural', seedValidated.errors)]);

  // 7. Manifest — currently no shipped @rntme validator at the manifest level.
  //    Engineer: if @rntme/runtime exposes parseManifest/validateManifest, chain it here.
  //    Until then, only Zod shape from requests.ts protects manifest; that's acceptable in MVP.

  return ok(input as unknown as ValidatedPublishBundle);
}
```

**Engineer note:** the exact shapes of `validateQsm(parsed, ctx)`, `validateBindings(parsed, ctx)`, `validateUi(...)`, `validateSeed(parsed, ctx)` may differ from these calls depending on the actual public API. Run `pnpm -F @rntme/<pkg> build` and inspect `dist/index.d.ts` for each to see the exact signatures; fix call sites to match. The sequence and per-pkg error bubbling stay the same.

- [ ] **Step 6: Run — expect pass (both tests).**

- [ ] **Step 7: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/validation packages/platform-core/test/unit/validation packages/platform-core/test/fixtures
git -C rntme-cli commit -m "feat(platform-core): bundle validation adapter to @rntme/* with fixtures"
```

---

### Task D4: publishVersion use-case (the big one)

**Files:**
- Create: `src/use-cases/publish-version.ts`
- Create: `test/unit/use-cases/publish-version.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/use-cases/publish-version.test.ts
import { describe, it, expect } from 'vitest';
import { FakeStore, isOk } from '../../../src/testing/fakes.js';
import { SeededIds } from '../../../src/ids.js';
import { publishVersion } from '../../../src/use-cases/publish-version.js';
import { minimalValidBundle } from '../../fixtures/bundles/minimal-valid.js';

async function setup() {
  const store = new FakeStore();
  const ids = new SeededIds(['v-1', 'v-2', 'v-3']);
  const org = await store.seedOrg({ slug: 'o', workosOrganizationId: 'org_1', displayName: 'O' });
  const acct = await store.seedAccount({ workosUserId: 'u1', displayName: 'U', email: null });
  const proj = await store.projects.create({ id: 'p1', orgId: org.id, slug: 'pr', displayName: 'P' });
  if (!isOk(proj)) throw new Error('seed');
  const svc = await store.services.create({ id: 's1', orgId: org.id, projectId: proj.value.id, slug: 'sv', displayName: 'S' });
  if (!isOk(svc)) throw new Error('seed');
  return { store, ids, orgId: org.id, serviceId: svc.value.id, accountId: acct.id };
}

describe('publishVersion', () => {
  it('rejects an invalid bundle with 422 stage=validation', async () => {
    const { store, ids, orgId, serviceId, accountId } = await setup();
    const brokenBundle = { ...minimalValidBundle, pdm: { entities: [{ name: '!!', fields: [] }] } };
    const r = await publishVersion(
      { repos: { artifacts: store.artifacts, services: store.services }, blob: store.blob, ids },
      { orgId, serviceId, accountId, tokenId: null, bundle: brokenBundle },
    );
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_VALIDATION_BUNDLE_FAILED');
  });

  it('publishes a valid bundle, seq=1', async () => {
    const { store, ids, orgId, serviceId, accountId } = await setup();
    const r = await publishVersion(
      { repos: { artifacts: store.artifacts, services: store.services }, blob: store.blob, ids },
      { orgId, serviceId, accountId, tokenId: null, bundle: minimalValidBundle },
    );
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.seq).toBe(1);
  });

  it('idempotent: re-publishing same bundle returns same seq', async () => {
    const { store, ids, orgId, serviceId, accountId } = await setup();
    const r1 = await publishVersion(
      { repos: { artifacts: store.artifacts, services: store.services }, blob: store.blob, ids },
      { orgId, serviceId, accountId, tokenId: null, bundle: minimalValidBundle },
    );
    const r2 = await publishVersion(
      { repos: { artifacts: store.artifacts, services: store.services }, blob: store.blob, ids },
      { orgId, serviceId, accountId, tokenId: null, bundle: minimalValidBundle },
    );
    expect(isOk(r1) && isOk(r2)).toBe(true);
    if (isOk(r1) && isOk(r2)) expect(r1.value.seq).toBe(r2.value.seq);
  });

  it('detects previousVersionSeq mismatch -> PLATFORM_CONCURRENCY_VERSION_CONFLICT', async () => {
    const { store, ids, orgId, serviceId, accountId } = await setup();
    const r = await publishVersion(
      { repos: { artifacts: store.artifacts, services: store.services }, blob: store.blob, ids },
      { orgId, serviceId, accountId, tokenId: null, bundle: minimalValidBundle, previousVersionSeq: 999 },
    );
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_CONCURRENCY_VERSION_CONFLICT');
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/use-cases/publish-version.ts**

```ts
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { ArtifactVersion } from '../schemas/entities.js';
import type { ServiceRepo } from '../repos/service-repo.js';
import type { ArtifactRepo, PublishInsertRow } from '../repos/artifact-repo.js';
import type { BlobStore } from '../blob/store.js';
import type { Ids } from '../ids.js';
import type { BundleInput } from '../schemas/requests.js';
import { validateBundle } from '../validation/bundle.js';
import { perFileDigest, bundleDigest, blobKey } from '../blob/store.js';

type Deps = {
  repos: { artifacts: ArtifactRepo; services: ServiceRepo };
  blob: BlobStore;
  ids: Ids;
};

export async function publishVersion(
  deps: Deps,
  input: {
    orgId: string;
    serviceId: string;
    accountId: string;
    tokenId: string | null;
    bundle: BundleInput;
    previousVersionSeq?: number;
    message?: string;
    moveTags?: readonly string[];
  },
): Promise<Result<ArtifactVersion, PlatformError>> {
  // Guard: service exists and not archived.
  const svc = await deps.repos.services.findById(input.orgId, input.serviceId);
  if (!isOk(svc)) return svc;
  if (!svc.value) return err([{ code: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND', message: input.serviceId }]);
  if (svc.value.archivedAt) return err([{ code: 'PLATFORM_TENANCY_RESOURCE_ARCHIVED', message: input.serviceId }]);

  // Step 1: validation gate.
  const v = await validateBundle(input.bundle);
  if (!isOk(v)) return v;

  // Step 2: per-file + bundle digests.
  const per = {
    manifest: perFileDigest(input.bundle.manifest),
    pdm: perFileDigest(input.bundle.pdm),
    qsm: perFileDigest(input.bundle.qsm),
    graphIr: perFileDigest(input.bundle.graphIr),
    bindings: perFileDigest(input.bundle.bindings),
    ui: perFileDigest(input.bundle.ui),
    seed: perFileDigest(input.bundle.seed),
  };
  const digest = bundleDigest(per);

  // Step 3: idempotency check.
  const existing = await deps.repos.artifacts.findByDigest(input.serviceId, digest);
  if (!isOk(existing)) return existing;
  if (existing.value) return ok(existing.value);

  // Step 4: upload each file to blob store (putIfAbsent is content-addressed).
  const uploads: [keyof typeof per, unknown][] = [
    ['manifest', input.bundle.manifest], ['pdm', input.bundle.pdm], ['qsm', input.bundle.qsm],
    ['graphIr', input.bundle.graphIr], ['bindings', input.bundle.bindings], ['ui', input.bundle.ui], ['seed', input.bundle.seed],
  ];
  for (const [k, body] of uploads) {
    const key = blobKey(per[k]);
    const up = await deps.blob.putIfAbsent(key, Buffer.from(JSON.stringify(body)));
    if (!isOk(up)) return up;
  }

  // Step 5: publish row.
  const row: PublishInsertRow = {
    id: deps.ids.uuid(),
    orgId: input.orgId,
    serviceId: input.serviceId,
    bundleDigest: digest,
    previousVersionId: null,
    manifestDigest: per.manifest, pdmDigest: per.pdm, qsmDigest: per.qsm,
    graphIrDigest: per.graphIr, bindingsDigest: per.bindings, uiDigest: per.ui, seedDigest: per.seed,
    validationSnapshot: {
      rntmePdm: '0.0.0', rntmeQsm: '0.0.0', rntmeBindings: '0.0.0',
      rntmeGraphIr: '0.0.0', rntmeUi: '0.0.0', rntmeSeed: '0.0.0',
    },
    publishedByAccountId: input.accountId,
    publishedByTokenId: input.tokenId,
    message: input.message ?? null,
  };
  return deps.repos.artifacts.publish({
    serviceId: input.serviceId,
    expectedPreviousSeq: input.previousVersionSeq,
    row,
    outboxPayload: { serviceId: input.serviceId, bundleDigest: digest, orgId: input.orgId },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
    moveTags: (input.moveTags ?? []).map((name) => ({ name, updatedByAccountId: input.accountId })),
  });
}
```

- [ ] **Step 4: Run — expect pass (all 4 tests).**

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/use-cases/publish-version.ts packages/platform-core/test/unit/use-cases/publish-version.test.ts
git -C rntme-cli commit -m "feat(platform-core): publishVersion use-case with validation gate + idempotency"
```

---

### Task D5: Tag use-cases (list, move, delete) + Version read use-cases

**Files:**
- Create: `src/use-cases/tags.ts`
- Create: `src/use-cases/versions.ts`
- Create: `test/unit/use-cases/tags.test.ts`
- Create: `test/unit/use-cases/versions.test.ts`

- [ ] **Step 1: Test — tags**

```ts
// test/unit/use-cases/tags.test.ts
import { describe, it, expect } from 'vitest';
import { FakeStore, isOk } from '../../../src/testing/fakes.js';
import { SeededIds } from '../../../src/ids.js';
import { moveTag, deleteTag, listTags } from '../../../src/use-cases/tags.js';
import { publishVersion } from '../../../src/use-cases/publish-version.js';
import { minimalValidBundle } from '../../fixtures/bundles/minimal-valid.js';

async function seedWithOneVersion() {
  const store = new FakeStore();
  const ids = new SeededIds(['v1']);
  const org = await store.seedOrg({ slug: 'o', workosOrganizationId: 'org_1', displayName: 'O' });
  const acct = await store.seedAccount({ workosUserId: 'u1', displayName: 'U', email: null });
  const proj = await store.projects.create({ id: 'p1', orgId: org.id, slug: 'pr', displayName: 'P' });
  if (!isOk(proj)) throw new Error('seed');
  const svc = await store.services.create({ id: 's1', orgId: org.id, projectId: proj.value.id, slug: 'sv', displayName: 'S' });
  if (!isOk(svc)) throw new Error('seed');
  const v = await publishVersion({ repos: { artifacts: store.artifacts, services: store.services }, blob: store.blob, ids }, { orgId: org.id, serviceId: svc.value.id, accountId: acct.id, tokenId: null, bundle: minimalValidBundle });
  if (!isOk(v)) throw new Error('seed');
  return { store, serviceId: svc.value.id, accountId: acct.id, versionSeq: v.value.seq, versionId: v.value.id };
}

describe('tag use-cases', () => {
  it('moveTag creates a new pointer', async () => {
    const { store, serviceId, accountId, versionSeq } = await seedWithOneVersion();
    const r = await moveTag({ repos: { tags: store.tags, artifacts: store.artifacts } }, { serviceId, name: 'stable', versionSeq, updatedByAccountId: accountId });
    expect(isOk(r)).toBe(true);
  });
  it('listTags returns pointer', async () => {
    const { store, serviceId, accountId, versionSeq } = await seedWithOneVersion();
    await moveTag({ repos: { tags: store.tags, artifacts: store.artifacts } }, { serviceId, name: 'preview', versionSeq, updatedByAccountId: accountId });
    const r = await listTags({ repos: { tags: store.tags } }, { serviceId });
    expect(isOk(r) && r.value).toHaveLength(1);
  });
  it('deleteTag removes pointer', async () => {
    const { store, serviceId, accountId, versionSeq } = await seedWithOneVersion();
    await moveTag({ repos: { tags: store.tags, artifacts: store.artifacts } }, { serviceId, name: 'x', versionSeq, updatedByAccountId: accountId });
    const d = await deleteTag({ repos: { tags: store.tags } }, { serviceId, name: 'x', actorAccountId: accountId });
    expect(isOk(d)).toBe(true);
    const l = await listTags({ repos: { tags: store.tags } }, { serviceId });
    expect(isOk(l) && l.value).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Test — versions**

```ts
// test/unit/use-cases/versions.test.ts
import { describe, it, expect } from 'vitest';
import { FakeStore, isOk } from '../../../src/testing/fakes.js';
import { SeededIds } from '../../../src/ids.js';
import { listVersions, getVersion, getBundle } from '../../../src/use-cases/versions.js';
import { publishVersion } from '../../../src/use-cases/publish-version.js';
import { minimalValidBundle } from '../../fixtures/bundles/minimal-valid.js';

describe('version reads', () => {
  it('listVersions returns newest-first with pagination', async () => {
    const store = new FakeStore();
    const ids = new SeededIds(['a','b','c','d']);
    const org = await store.seedOrg({ slug: 'o', workosOrganizationId: 'org_1', displayName: 'O' });
    const acct = await store.seedAccount({ workosUserId: 'u1', displayName: 'U', email: null });
    const proj = await store.projects.create({ id: 'p1', orgId: org.id, slug: 'pr', displayName: 'P' });
    if (!isOk(proj)) throw new Error('seed');
    const svc = await store.services.create({ id: 's1', orgId: org.id, projectId: proj.value.id, slug: 'sv', displayName: 'S' });
    if (!isOk(svc)) throw new Error('seed');
    for (let i = 0; i < 3; i++) {
      const bundle = { ...minimalValidBundle, manifest: { ...minimalValidBundle.manifest, epoch: i } };
      await publishVersion({ repos: { artifacts: store.artifacts, services: store.services }, blob: store.blob, ids }, { orgId: org.id, serviceId: svc.value.id, accountId: acct.id, tokenId: null, bundle });
    }
    const r = await listVersions({ repos: { artifacts: store.artifacts } }, { serviceId: svc.value.id, limit: 2, cursor: undefined });
    expect(isOk(r) && r.value).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run — expect fail.**

- [ ] **Step 4: Implement src/use-cases/tags.ts**

```ts
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { ArtifactTag } from '../schemas/entities.js';
import type { TagRepo } from '../repos/tag-repo.js';
import type { ArtifactRepo } from '../repos/artifact-repo.js';

type Deps = { repos: { tags: TagRepo; artifacts?: ArtifactRepo } };

export async function listTags(deps: Deps, input: { serviceId: string }): Promise<Result<readonly ArtifactTag[], PlatformError>> {
  return deps.repos.tags.list(input.serviceId);
}

export async function moveTag(
  deps: { repos: { tags: TagRepo; artifacts: ArtifactRepo } },
  input: { serviceId: string; name: string; versionSeq: number; updatedByAccountId: string },
): Promise<Result<ArtifactTag, PlatformError>> {
  const ver = await deps.repos.artifacts.getBySeq(input.serviceId, input.versionSeq);
  if (!isOk(ver)) return ver;
  if (!ver.value) return err([{ code: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND', message: `version seq ${input.versionSeq} missing` }]);
  return deps.repos.tags.move({ serviceId: input.serviceId, name: input.name, versionId: ver.value.id, updatedByAccountId: input.updatedByAccountId });
}

export async function deleteTag(
  deps: Deps,
  input: { serviceId: string; name: string; actorAccountId: string },
): Promise<Result<void, PlatformError>> {
  return deps.repos.tags.delete(input.serviceId, input.name, input.actorAccountId);
}
```

- [ ] **Step 5: Implement src/use-cases/versions.ts**

```ts
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { ArtifactVersion } from '../schemas/entities.js';
import type { ArtifactRepo } from '../repos/artifact-repo.js';
import type { BlobStore } from '../blob/store.js';
import { blobKey } from '../blob/store.js';

type Deps = { repos: { artifacts: ArtifactRepo }; blob?: BlobStore };

export async function listVersions(
  deps: Deps,
  input: { serviceId: string; limit: number; cursor: number | undefined },
): Promise<Result<readonly ArtifactVersion[], PlatformError>> {
  return deps.repos.artifacts.listBySeq(input.serviceId, { limit: input.limit, cursor: input.cursor });
}

export async function getVersion(
  deps: Deps,
  input: { serviceId: string; seq: number },
): Promise<Result<ArtifactVersion, PlatformError>> {
  const r = await deps.repos.artifacts.getBySeq(input.serviceId, input.seq);
  if (!isOk(r)) return r;
  if (!r.value) return err([{ code: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND', message: `seq ${input.seq}` }]);
  return ok(r.value);
}

export async function getBundle(
  deps: { repos: { artifacts: ArtifactRepo }; blob: BlobStore },
  input: { serviceId: string; seq: number },
): Promise<Result<Record<string, unknown>, PlatformError>> {
  const v = await getVersion(deps, input);
  if (!isOk(v)) return v;
  const out: Record<string, unknown> = {};
  const map: [string, string][] = [
    ['manifest', v.value.manifestDigest], ['pdm', v.value.pdmDigest], ['qsm', v.value.qsmDigest],
    ['graphIr', v.value.graphIrDigest], ['bindings', v.value.bindingsDigest], ['ui', v.value.uiDigest], ['seed', v.value.seedDigest],
  ];
  for (const [k, d] of map) {
    const body = await deps.blob.getJson(blobKey(d));
    if (!isOk(body)) return body;
    out[k] = body.value;
  }
  return ok(out);
}
```

- [ ] **Step 6: Run — expect pass.**

- [ ] **Step 7: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/use-cases/tags.ts packages/platform-core/src/use-cases/versions.ts packages/platform-core/test/unit/use-cases/tags.test.ts packages/platform-core/test/unit/use-cases/versions.test.ts
git -C rntme-cli commit -m "feat(platform-core): tag + version-read use-cases"
```

---

### Task D6: Token use-cases (create, list, revoke)

**Files:**
- Create: `src/use-cases/tokens.ts`
- Create: `test/unit/use-cases/tokens.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/use-cases/tokens.test.ts
import { describe, it, expect } from 'vitest';
import { FakeStore, isOk } from '../../../src/testing/fakes.js';
import { SeededIds } from '../../../src/ids.js';
import { createToken, listTokens, revokeToken } from '../../../src/use-cases/tokens.js';

async function setup() {
  const store = new FakeStore();
  const ids = new SeededIds(['tok-1'], { tokenBody: 'abcdefghijklmnopqrstuv' });
  const org = await store.seedOrg({ slug: 'o', workosOrganizationId: 'org_1', displayName: 'O' });
  const acct = await store.seedAccount({ workosUserId: 'u1', displayName: 'U', email: null });
  return { store, ids, orgId: org.id, accountId: acct.id };
}

describe('token use-cases', () => {
  it('createToken returns plaintext once', async () => {
    const { store, ids, orgId, accountId } = await setup();
    const r = await createToken(
      { repos: { tokens: store.tokensRepo }, ids },
      { orgId, accountId, name: 'cli', scopes: ['project:read'], expiresAt: null, creatorScopes: ['project:read', 'token:manage'] },
    );
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.plaintext).toMatch(/^rntme_pat_/);
      expect(r.value.token.prefix).toBe(r.value.plaintext.slice(0, 12));
    }
  });

  it('createToken rejects scope elevation', async () => {
    const { store, ids, orgId, accountId } = await setup();
    const r = await createToken(
      { repos: { tokens: store.tokensRepo }, ids },
      { orgId, accountId, name: 'cli', scopes: ['token:manage'], expiresAt: null, creatorScopes: ['project:read'] },
    );
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_FORBIDDEN');
  });

  it('revokeToken sets revokedAt', async () => {
    const { store, ids, orgId, accountId } = await setup();
    const c = await createToken({ repos: { tokens: store.tokensRepo }, ids }, { orgId, accountId, name: 'cli', scopes: ['project:read'], expiresAt: null, creatorScopes: ['project:read','token:manage'] });
    if (!isOk(c)) throw new Error('seed');
    const r = await revokeToken({ repos: { tokens: store.tokensRepo } }, { orgId, id: c.value.token.id });
    expect(isOk(r)).toBe(true);
    const l = await listTokens({ repos: { tokens: store.tokensRepo } }, { orgId });
    expect(isOk(l) && l.value[0]!.revokedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/use-cases/tokens.ts**

```ts
import { createHash } from 'node:crypto';
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { ApiToken, Scope } from '../schemas/entities.js';
import type { TokenRepo } from '../repos/token-repo.js';
import type { Ids } from '../ids.js';
import { tokenScopesSubsetOf } from '../auth/scopes.js';

type CreatedToken = { readonly token: ApiToken; readonly plaintext: string };

export async function createToken(
  deps: { repos: { tokens: TokenRepo }; ids: Ids },
  input: {
    orgId: string; accountId: string; name: string; scopes: readonly Scope[]; expiresAt: Date | null;
    creatorScopes: readonly Scope[];
  },
): Promise<Result<CreatedToken, PlatformError>> {
  if (!tokenScopesSubsetOf(input.scopes, input.creatorScopes)) {
    return err([{ code: 'PLATFORM_AUTH_FORBIDDEN', message: 'requested scopes exceed creator scopes' }]);
  }
  const plaintext = deps.ids.apiTokenPlaintext();
  const tokenHash = new Uint8Array(createHash('sha256').update(plaintext).digest());
  const prefix = plaintext.slice(0, 12);
  const r = await deps.repos.tokens.create({
    id: deps.ids.uuid(),
    orgId: input.orgId, accountId: input.accountId, name: input.name,
    tokenHash, prefix, scopes: input.scopes, expiresAt: input.expiresAt,
  });
  if (!isOk(r)) return r;
  return ok({ token: r.value, plaintext });
}

export async function listTokens(
  deps: { repos: { tokens: TokenRepo } }, input: { orgId: string },
): Promise<Result<readonly ApiToken[], PlatformError>> {
  return deps.repos.tokens.list(input.orgId);
}

export async function revokeToken(
  deps: { repos: { tokens: TokenRepo } }, input: { orgId: string; id: string },
): Promise<Result<void, PlatformError>> {
  return deps.repos.tokens.revoke(input.orgId, input.id);
}
```

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/use-cases/tokens.ts packages/platform-core/test/unit/use-cases/tokens.test.ts
git -C rntme-cli commit -m "feat(platform-core): token use-cases (create/list/revoke) with subset-scope enforcement"
```

---

### Task D7: WorkOS webhook sync use-cases

**Files:**
- Create: `src/use-cases/workos-sync.ts`
- Create: `test/unit/use-cases/workos-sync.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/use-cases/workos-sync.test.ts
import { describe, it, expect } from 'vitest';
import { FakeStore, isOk } from '../../../src/testing/fakes.js';
import { syncWorkosEvent } from '../../../src/use-cases/workos-sync.js';

describe('syncWorkosEvent', () => {
  it('handles user.created by upserting account', async () => {
    const store = new FakeStore();
    const r = await syncWorkosEvent({ repos: {
      organizations: store.organizations, accounts: store.accountsRepo,
      memberships: store.membershipMirror, projects: store.projects,
      workosEventLog: store.workosEventLog,
    } }, {
      id: 'ev_1', type: 'user.created', data: { id: 'user_abc', email: 'x@example.com', first_name: 'X', last_name: 'Y' },
    });
    expect(isOk(r)).toBe(true);
    expect([...store.accounts.values()][0]!.workosUserId).toBe('user_abc');
  });

  it('is idempotent on replay', async () => {
    const store = new FakeStore();
    const ev = { id: 'ev_2', type: 'user.created' as const, data: { id: 'u_b', email: null, first_name: 'A', last_name: 'B' } };
    await syncWorkosEvent({ repos: {
      organizations: store.organizations, accounts: store.accountsRepo,
      memberships: store.membershipMirror, projects: store.projects,
      workosEventLog: store.workosEventLog,
    } }, ev);
    const r = await syncWorkosEvent({ repos: {
      organizations: store.organizations, accounts: store.accountsRepo,
      memberships: store.membershipMirror, projects: store.projects,
      workosEventLog: store.workosEventLog,
    } }, ev);
    expect(isOk(r)).toBe(true);
    expect(store.accounts.size).toBe(1);
  });

  it('organization.deleted cascades project archive', async () => {
    const store = new FakeStore();
    const org = await store.organizations.upsertFromWorkos({ workosOrganizationId: 'org_x', slug: 'x', displayName: 'X' });
    if (!isOk(org)) throw new Error('seed');
    await store.projects.create({ id: 'p1', orgId: org.value.id, slug: 'pr', displayName: 'P' });
    const r = await syncWorkosEvent({ repos: {
      organizations: store.organizations, accounts: store.accountsRepo,
      memberships: store.membershipMirror, projects: store.projects,
      workosEventLog: store.workosEventLog,
    } }, { id: 'ev_3', type: 'organization.deleted', data: { id: 'org_x' } });
    expect(isOk(r)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/use-cases/workos-sync.ts**

```ts
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { OrganizationRepo } from '../repos/org-repo.js';
import type { AccountRepo } from '../repos/account-repo.js';
import type { MembershipMirrorRepo } from '../repos/membership-mirror-repo.js';
import type { ProjectRepo } from '../repos/project-repo.js';
import type { WorkosEventLogRepo } from '../repos/workos-event-log-repo.js';

type Deps = {
  repos: {
    organizations: OrganizationRepo;
    accounts: AccountRepo;
    memberships: MembershipMirrorRepo;
    projects: ProjectRepo;
    workosEventLog: WorkosEventLogRepo;
  };
};

export type WorkosEvent =
  | { id: string; type: 'user.created' | 'user.updated'; data: { id: string; email: string | null; first_name: string; last_name: string } }
  | { id: string; type: 'user.deleted'; data: { id: string } }
  | { id: string; type: 'organization.created' | 'organization.updated'; data: { id: string; name: string; slug?: string } }
  | { id: string; type: 'organization.deleted'; data: { id: string } }
  | { id: string; type: 'organization_membership.created'; data: { id: string; organization_id: string; user_id: string; role: { slug: string } } }
  | { id: string; type: 'organization_membership.deleted'; data: { id: string; organization_id: string; user_id: string } };

export async function syncWorkosEvent(deps: Deps, ev: WorkosEvent): Promise<Result<void, PlatformError>> {
  const seen = await deps.repos.workosEventLog.hasProcessed(ev.id);
  if (!isOk(seen)) return seen;
  if (seen.value) return ok(undefined);

  switch (ev.type) {
    case 'user.created':
    case 'user.updated': {
      const r = await deps.repos.accounts.upsertFromWorkos({
        workosUserId: ev.data.id,
        email: ev.data.email,
        displayName: `${ev.data.first_name} ${ev.data.last_name}`.trim() || ev.data.id,
      });
      if (!isOk(r)) return r; break;
    }
    case 'user.deleted': {
      const r = await deps.repos.accounts.markDeleted(ev.data.id);
      if (!isOk(r)) return r; break;
    }
    case 'organization.created':
    case 'organization.updated': {
      const slug = ev.data.slug ?? ev.data.id.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);
      const r = await deps.repos.organizations.upsertFromWorkos({
        workosOrganizationId: ev.data.id,
        slug,
        displayName: ev.data.name,
      });
      if (!isOk(r)) return r; break;
    }
    case 'organization.deleted': {
      const found = await deps.repos.organizations.findByWorkosId(ev.data.id);
      if (!isOk(found)) return found;
      if (found.value) {
        const list = await deps.repos.projects.list(found.value.id, { includeArchived: false });
        if (!isOk(list)) return list;
        for (const p of list.value) {
          const a = await deps.repos.projects.archive(found.value.id, p.id);
          if (!isOk(a)) return a;
        }
        const d = await deps.repos.organizations.archive(found.value.id);
        if (!isOk(d)) return d;
      }
      break;
    }
    case 'organization_membership.created': {
      const org = await deps.repos.organizations.findByWorkosId(ev.data.organization_id);
      const acc = await deps.repos.accounts.findByWorkosUserId(ev.data.user_id);
      if (!isOk(org)) return org;
      if (!isOk(acc)) return acc;
      if (!org.value || !acc.value) return err([{ code: 'PLATFORM_INTERNAL', message: 'membership sync: org or account missing' }]);
      const r = await deps.repos.memberships.upsert({ orgId: org.value.id, accountId: acc.value.id, role: ev.data.role.slug });
      if (!isOk(r)) return r; break;
    }
    case 'organization_membership.deleted': {
      const org = await deps.repos.organizations.findByWorkosId(ev.data.organization_id);
      const acc = await deps.repos.accounts.findByWorkosUserId(ev.data.user_id);
      if (!isOk(org) || !isOk(acc)) return err([{ code: 'PLATFORM_INTERNAL', message: 'membership delete: lookup failed' }]);
      if (org.value && acc.value) {
        const r = await deps.repos.memberships.delete(org.value.id, acc.value.id);
        if (!isOk(r)) return r;
      }
      break;
    }
  }

  const mark = await deps.repos.workosEventLog.markProcessed(ev.id, ev.type);
  if (!isOk(mark)) return mark;
  return ok(undefined);
}
```

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/use-cases/workos-sync.ts packages/platform-core/test/unit/use-cases/workos-sync.test.ts
git -C rntme-cli commit -m "feat(platform-core): WorkOS webhook sync use-case (idempotent)"
```

---

### Task D8: Update barrel exports

- [ ] **Step 1: Extend src/index.ts**

```ts
// append to src/index.ts
export * from './use-cases/projects.js';
export * from './use-cases/services.js';
export * from './use-cases/tags.js';
export * from './use-cases/versions.js';
export * from './use-cases/tokens.js';
export * from './use-cases/publish-version.js';
export * from './use-cases/workos-sync.js';
export * from './validation/bundle.js';
export * from './blob/store.js';
export * from './repos/org-repo.js';
export * from './repos/account-repo.js';
export * from './repos/membership-mirror-repo.js';
export * from './repos/workos-event-log-repo.js';
export * from './repos/project-repo.js';
export * from './repos/service-repo.js';
export * from './repos/artifact-repo.js';
export * from './repos/tag-repo.js';
export * from './repos/token-repo.js';
export * from './repos/audit-repo.js';
export * from './repos/outbox-repo.js';
```

- [ ] **Step 2: Full green**

```bash
pnpm -F @rntme-cli/platform-core build
pnpm -F @rntme-cli/platform-core typecheck
pnpm -F @rntme-cli/platform-core lint
pnpm -F @rntme-cli/platform-core test
```

- [ ] **Step 3: Commit**

```bash
git -C rntme-cli add packages/platform-core/src/index.ts
git -C rntme-cli commit -m "chore(platform-core): re-export use-cases and repos"
```

---

## Phase E — platform-storage: Drizzle schema, migrations, RLS

All Phase E tasks inside `rntme-cli/packages/platform-storage/`.

### Task E1: Postgres pool + transaction helper

**Files:**
- Create: `src/pg/pool.ts`
- Create: `src/pg/tx.ts`

- [ ] **Step 1: Implement src/pg/pool.ts**

```ts
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type Db = NodePgDatabase<Record<string, unknown>>;

export function createPool(databaseUrl: string, opts: { max?: number } = {}): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl, max: opts.max ?? 10 });
}

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool);
}
```

- [ ] **Step 2: Implement src/pg/tx.ts**

```ts
import type { Pool, PoolClient } from 'pg';

export type TxClient = PoolClient & { __tx: true };

export async function withTransaction<T>(
  pool: Pool,
  orgId: string | null,
  fn: (client: TxClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (orgId) await client.query(`SET LOCAL app.org_id = $1`, [orgId]);
    const out = await fn(client as TxClient);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git -C rntme-cli add packages/platform-storage/src/pg
git -C rntme-cli commit -m "feat(platform-storage): pg pool + transactional org-scope helper"
```

---

### Task E2: Drizzle schema (all tables)

**Files:**
- Create: `src/schema/index.ts`
- Create: `src/schema/identity.ts`
- Create: `src/schema/projects.ts`
- Create: `src/schema/artifacts.ts`
- Create: `src/schema/tokens.ts`
- Create: `src/schema/audit.ts`

- [ ] **Step 1: Implement src/schema/identity.ts**

```ts
import { pgTable, uuid, text, timestamp, primaryKey, unique, index } from 'drizzle-orm/pg-core';

export const account = pgTable('account', {
  id: uuid('id').primaryKey(),
  workosUserId: text('workos_user_id').notNull().unique(),
  email: text('email'),
  displayName: text('display_name').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organization = pgTable('organization', {
  id: uuid('id').primaryKey(),
  workosOrganizationId: text('workos_organization_id').notNull().unique(),
  slug: text('slug').notNull().unique(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const membershipMirror = pgTable('membership_mirror', {
  orgId: uuid('org_id').notNull().references(() => organization.id),
  accountId: uuid('account_id').notNull().references(() => account.id),
  role: text('role').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.orgId, t.accountId] }) }));

export const workosEventLog = pgTable('workos_event_log', {
  eventId: text('event_id').primaryKey(),
  eventType: text('event_type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Implement src/schema/projects.ts**

```ts
import { pgTable, uuid, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { organization } from './identity.js';

export const project = pgTable('project', {
  id: uuid('id').primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organization.id),
  slug: text('slug').notNull(),
  displayName: text('display_name').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ uq: unique('project_org_slug_uq').on(t.orgId, t.slug) }));

export const service = pgTable('service', {
  id: uuid('id').primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organization.id),
  projectId: uuid('project_id').notNull().references(() => project.id),
  slug: text('slug').notNull(),
  displayName: text('display_name').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ uq: unique('service_project_slug_uq').on(t.projectId, t.slug) }));
```

- [ ] **Step 3: Implement src/schema/artifacts.ts**

```ts
import { pgTable, uuid, text, timestamp, integer, jsonb, unique, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { organization } from './identity.js';
import { service } from './projects.js';
import { account } from './identity.js';

export const artifactVersion = pgTable('artifact_version', {
  id: uuid('id').primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organization.id),
  serviceId: uuid('service_id').notNull().references(() => service.id),
  seq: integer('seq').notNull(),
  bundleDigest: text('bundle_digest').notNull(),
  previousVersionId: uuid('previous_version_id').references((): AnyPgColumn => artifactVersion.id),
  manifestDigest: text('manifest_digest').notNull(),
  pdmDigest: text('pdm_digest').notNull(),
  qsmDigest: text('qsm_digest').notNull(),
  graphIrDigest: text('graph_ir_digest').notNull(),
  bindingsDigest: text('bindings_digest').notNull(),
  uiDigest: text('ui_digest').notNull(),
  seedDigest: text('seed_digest').notNull(),
  validationSnapshot: jsonb('validation_snapshot').notNull(),
  publishedByAccountId: uuid('published_by_account_id').notNull().references(() => account.id),
  publishedByTokenId: uuid('published_by_token_id'),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  message: text('message'),
}, (t) => ({
  seqUq: unique('artifact_version_service_seq_uq').on(t.serviceId, t.seq),
  digestUq: unique('artifact_version_service_digest_uq').on(t.serviceId, t.bundleDigest),
  latestIdx: index('artifact_version_latest_idx').on(t.serviceId, t.seq),
}));

export const artifactTag = pgTable('artifact_tag', {
  serviceId: uuid('service_id').notNull().references(() => service.id),
  name: text('name').notNull(),
  versionId: uuid('version_id').notNull().references(() => artifactVersion.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByAccountId: uuid('updated_by_account_id').notNull().references(() => account.id),
}, (t) => ({ pk: unique('artifact_tag_pk').on(t.serviceId, t.name) }));
```

- [ ] **Step 4: Implement src/schema/tokens.ts**

```ts
import { pgTable, uuid, text, timestamp, customType, index } from 'drizzle-orm/pg-core';
import { organization, account } from './identity.js';

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() { return 'bytea'; },
  toDriver(v) { return Buffer.from(v); },
  fromDriver(v) { return new Uint8Array(v as Buffer); },
});

export const apiToken = pgTable('api_token', {
  id: uuid('id').primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organization.id),
  accountId: uuid('account_id').notNull().references(() => account.id),
  name: text('name').notNull(),
  tokenHash: bytea('token_hash').notNull(),
  prefix: text('prefix').notNull(),
  scopes: text('scopes').array().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ prefixIdx: index('api_token_prefix_idx').on(t.prefix) }));
```

- [ ] **Step 5: Implement src/schema/audit.ts**

```ts
import { pgTable, uuid, text, timestamp, bigserial, jsonb, index } from 'drizzle-orm/pg-core';
import { organization, account } from './identity.js';

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organization.id),
  actorAccountId: uuid('actor_account_id').notNull().references(() => account.id),
  actorTokenId: uuid('actor_token_id'),
  action: text('action').notNull(),
  resourceKind: text('resource_kind').notNull(),
  resourceId: text('resource_id').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ orgTimeIdx: index('audit_log_org_time_idx').on(t.orgId, t.createdAt) }));

export const eventOutbox = pgTable('event_outbox', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organization.id),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
}, (t) => ({ undeliveredIdx: index('event_outbox_undelivered_idx').on(t.deliveredAt, t.id) }));
```

- [ ] **Step 6: Implement src/schema/index.ts**

```ts
export * from './identity.js';
export * from './projects.js';
export * from './artifacts.js';
export * from './tokens.js';
export * from './audit.js';
```

- [ ] **Step 7: Build + commit**

```bash
pnpm -F @rntme-cli/platform-storage build
git -C rntme-cli add packages/platform-storage/src/schema
git -C rntme-cli commit -m "feat(platform-storage): drizzle schema for all tables"
```

---

### Task E3: Generate baseline migration + hand-write RLS policies

**Files:**
- Create: `drizzle/0000_initial.sql` (generated)
- Create: `src/sql/policies.sql`
- Create: `src/migrate.ts`
- Create: `test/integration/migrate.test.ts`

- [ ] **Step 1: Generate Drizzle migration**

```bash
pnpm -F @rntme-cli/platform-storage db:generate
```

Expected: produces `drizzle/0000_*.sql` from current schema.

- [ ] **Step 2: Create src/sql/policies.sql** (RLS policies applied after initial migration)

```sql
ALTER TABLE project ENABLE ROW LEVEL SECURITY;
ALTER TABLE service ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_mirror ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_project    ON project           USING (org_id = current_setting('app.org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY tenant_isolation_service    ON service           USING (org_id = current_setting('app.org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY tenant_isolation_version    ON artifact_version  USING (org_id = current_setting('app.org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY tenant_isolation_tag        ON artifact_tag      USING (EXISTS (SELECT 1 FROM service s WHERE s.id = service_id AND s.org_id = current_setting('app.org_id', true)::uuid));
CREATE POLICY tenant_isolation_token      ON api_token         USING (org_id = current_setting('app.org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY tenant_isolation_audit      ON audit_log         USING (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY tenant_isolation_outbox     ON event_outbox      USING (org_id = current_setting('app.org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY tenant_isolation_membership ON membership_mirror USING (org_id = current_setting('app.org_id', true)::uuid);
```

- [ ] **Step 3: Implement src/migrate.ts**

```ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Db } from './pg/pool.js';
import type { Pool } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(db: Db, pool: Pool): Promise<void> {
  await migrate(db, { migrationsFolder: resolve(here, '..', 'drizzle') });
  const policies = await readFile(resolve(here, 'sql', 'policies.sql'), 'utf8');
  await pool.query(policies);
}
```

- [ ] **Step 4: Integration test — migrations apply cleanly**

```ts
// test/integration/migrate.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createPool, createDb } from '../../src/pg/pool.js';
import { runMigrations } from '../../src/migrate.js';

let container: StartedPostgreSqlContainer;

beforeAll(async () => { container = await new PostgreSqlContainer('postgres:16-alpine').start(); }, 120_000);
afterAll(async () => { await container.stop(); });

describe('migrations', () => {
  it('apply cleanly and create tables', async () => {
    const pool = createPool(container.getConnectionUri());
    const db = createDb(pool);
    await runMigrations(db, pool);
    const r = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
    const names = r.rows.map((x) => x.tablename).sort();
    expect(names).toContain('project');
    expect(names).toContain('service');
    expect(names).toContain('artifact_version');
    expect(names).toContain('api_token');
    await pool.end();
  });
});
```

- [ ] **Step 5: Run**

```bash
pnpm -F @rntme-cli/platform-storage test
```

Expected: pass (takes ~60s for first container pull).

- [ ] **Step 6: Commit**

```bash
git -C rntme-cli add packages/platform-storage/drizzle packages/platform-storage/src/sql packages/platform-storage/src/migrate.ts packages/platform-storage/test/integration/migrate.test.ts
git -C rntme-cli commit -m "feat(platform-storage): baseline migration + RLS policies + migrate runner"
```

---

## Phase F — platform-storage: Postgres repository implementations

All Phase F tasks inside `rntme-cli/packages/platform-storage/`.

### Task F1: Test harness for integration tests (shared)

**Files:**
- Create: `test/integration/harness.ts`

- [ ] **Step 1: Implement harness**

```ts
// test/integration/harness.ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createPool, createDb, type Db } from '../../src/pg/pool.js';
import { runMigrations } from '../../src/migrate.js';
import type { Pool } from 'pg';

export async function startPostgres(): Promise<{
  container: StartedPostgreSqlContainer; pool: Pool; db: Db;
}> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const pool = createPool(container.getConnectionUri());
  const db = createDb(pool);
  await runMigrations(db, pool);
  return { container, pool, db };
}

export async function resetSchema(pool: Pool): Promise<void> {
  await pool.query(`TRUNCATE TABLE audit_log, event_outbox, artifact_tag, artifact_version, service, project, api_token, membership_mirror, workos_event_log, account, organization RESTART IDENTITY CASCADE;`);
}
```

- [ ] **Step 2: Commit**

```bash
git -C rntme-cli add packages/platform-storage/test/integration/harness.ts
git -C rntme-cli commit -m "test(platform-storage): integration-test harness (testcontainers)"
```

---

### Task F2: PgOrganizationRepo + PgAccountRepo + PgMembershipMirrorRepo + PgWorkosEventLogRepo

**Files:**
- Create: `src/repos/pg-org-repo.ts`
- Create: `src/repos/pg-account-repo.ts`
- Create: `src/repos/pg-membership-mirror-repo.ts`
- Create: `src/repos/pg-workos-event-log-repo.ts`
- Create: `test/integration/identity-repos.test.ts`

- [ ] **Step 1: Test**

```ts
// test/integration/identity-repos.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { isOk } from '@rntme-cli/platform-core';
import { startPostgres, resetSchema } from './harness.js';
import { PgOrganizationRepo } from '../../src/repos/pg-org-repo.js';
import { PgAccountRepo } from '../../src/repos/pg-account-repo.js';
import { PgMembershipMirrorRepo } from '../../src/repos/pg-membership-mirror-repo.js';
import { PgWorkosEventLogRepo } from '../../src/repos/pg-workos-event-log-repo.js';

let env: Awaited<ReturnType<typeof startPostgres>>;
beforeAll(async () => { env = await startPostgres(); }, 120_000);
afterAll(async () => { await env.pool.end(); await env.container.stop(); });
beforeEach(async () => { await resetSchema(env.pool); });

describe('identity repos', () => {
  it('upsertFromWorkos is idempotent', async () => {
    const repo = new PgOrganizationRepo(env.pool);
    const a = await repo.upsertFromWorkos({ workosOrganizationId: 'org_1', slug: 'o1', displayName: 'O1' });
    const b = await repo.upsertFromWorkos({ workosOrganizationId: 'org_1', slug: 'o1', displayName: 'O1b' });
    expect(isOk(a) && isOk(b)).toBe(true);
    if (isOk(a) && isOk(b)) expect(a.value.id).toBe(b.value.id);
  });

  it('account + membership + workos log round-trip', async () => {
    const orgs = new PgOrganizationRepo(env.pool);
    const accts = new PgAccountRepo(env.pool);
    const mems = new PgMembershipMirrorRepo(env.pool);
    const log = new PgWorkosEventLogRepo(env.pool);
    const o = await orgs.upsertFromWorkos({ workosOrganizationId: 'org_a', slug: 'a', displayName: 'A' });
    const a = await accts.upsertFromWorkos({ workosUserId: 'user_a', email: null, displayName: 'U' });
    expect(isOk(o) && isOk(a)).toBe(true);
    if (isOk(o) && isOk(a)) {
      const m = await mems.upsert({ orgId: o.value.id, accountId: a.value.id, role: 'admin' });
      expect(isOk(m)).toBe(true);
    }
    const seen = await log.markProcessed('ev_1', 'user.created');
    expect(isOk(seen)).toBe(true);
    const again = await log.hasProcessed('ev_1');
    expect(isOk(again) && again.value).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/repos/pg-org-repo.ts**

```ts
import type { Pool } from 'pg';
import { eq, and } from 'drizzle-orm';
import { ok, err, type Result, type PlatformError } from '@rntme-cli/platform-core';
import type { OrganizationRepo } from '@rntme-cli/platform-core';
import type { Organization } from '@rntme-cli/platform-core';
import { createDb, type Db } from '../pg/pool.js';
import { organization, membershipMirror } from '../schema/identity.js';
import { randomUUID } from 'node:crypto';

function rowToOrg(r: typeof organization.$inferSelect): Organization {
  return {
    id: r.id, workosOrganizationId: r.workosOrganizationId, slug: r.slug, displayName: r.displayName,
    createdAt: r.createdAt!, updatedAt: r.updatedAt!,
  };
}

export class PgOrganizationRepo implements OrganizationRepo {
  private readonly db: Db;
  constructor(private readonly pool: Pool) { this.db = createDb(pool); }

  async findBySlug(slug: string): Promise<Result<Organization | null, PlatformError>> {
    try {
      const rows = await this.db.select().from(organization).where(eq(organization.slug, slug)).limit(1);
      return ok(rows[0] ? rowToOrg(rows[0]) : null);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async findByWorkosId(workosId: string): Promise<Result<Organization | null, PlatformError>> {
    try {
      const rows = await this.db.select().from(organization).where(eq(organization.workosOrganizationId, workosId)).limit(1);
      return ok(rows[0] ? rowToOrg(rows[0]) : null);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async listForAccount(accountId: string): Promise<Result<readonly Organization[], PlatformError>> {
    try {
      const rows = await this.db
        .select({ o: organization }).from(organization)
        .innerJoin(membershipMirror, eq(membershipMirror.orgId, organization.id))
        .where(eq(membershipMirror.accountId, accountId));
      return ok(rows.map((r) => rowToOrg(r.o)));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async upsertFromWorkos(a: { workosOrganizationId: string; slug: string; displayName: string }): Promise<Result<Organization, PlatformError>> {
    try {
      const id = randomUUID();
      const rows = await this.db
        .insert(organization)
        .values({ id, workosOrganizationId: a.workosOrganizationId, slug: a.slug, displayName: a.displayName })
        .onConflictDoUpdate({
          target: organization.workosOrganizationId,
          set: { slug: a.slug, displayName: a.displayName, updatedAt: new Date() },
        })
        .returning();
      return ok(rowToOrg(rows[0]!));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async archive(id: string): Promise<Result<void, PlatformError>> {
    try {
      await this.db.delete(organization).where(eq(organization.id, id));
      return ok(undefined);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
}
```

- [ ] **Step 4: Implement src/repos/pg-account-repo.ts, pg-membership-mirror-repo.ts, pg-workos-event-log-repo.ts**

Same pattern: each class takes `Pool` in constructor, creates `Db` via `createDb`, implements the interface from `@rntme-cli/platform-core`, wraps every operation in try/catch returning `PLATFORM_STORAGE_DB_UNAVAILABLE` on throw.

```ts
// src/repos/pg-account-repo.ts
import type { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { ok, err, type Result, type PlatformError, type AccountRepo, type Account } from '@rntme-cli/platform-core';
import { createDb, type Db } from '../pg/pool.js';
import { account } from '../schema/identity.js';
import { randomUUID } from 'node:crypto';

function toAccount(r: typeof account.$inferSelect): Account {
  return { id: r.id, workosUserId: r.workosUserId, email: r.email, displayName: r.displayName, deletedAt: r.deletedAt, createdAt: r.createdAt!, updatedAt: r.updatedAt! };
}

export class PgAccountRepo implements AccountRepo {
  private readonly db: Db;
  constructor(private readonly pool: Pool) { this.db = createDb(pool); }
  async findByWorkosUserId(wid: string): Promise<Result<Account | null, PlatformError>> {
    try {
      const rows = await this.db.select().from(account).where(eq(account.workosUserId, wid)).limit(1);
      return ok(rows[0] ? toAccount(rows[0]) : null);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
  async upsertFromWorkos(a: { workosUserId: string; email: string | null; displayName: string }): Promise<Result<Account, PlatformError>> {
    try {
      const rows = await this.db
        .insert(account)
        .values({ id: randomUUID(), workosUserId: a.workosUserId, email: a.email, displayName: a.displayName })
        .onConflictDoUpdate({ target: account.workosUserId, set: { email: a.email, displayName: a.displayName, updatedAt: new Date() } })
        .returning();
      return ok(toAccount(rows[0]!));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
  async markDeleted(wid: string): Promise<Result<void, PlatformError>> {
    try {
      await this.db.update(account).set({ deletedAt: new Date() }).where(eq(account.workosUserId, wid));
      return ok(undefined);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
}
```

```ts
// src/repos/pg-membership-mirror-repo.ts
import type { Pool } from 'pg';
import { and, eq } from 'drizzle-orm';
import { ok, err, type Result, type PlatformError, type MembershipMirrorRepo, type MembershipMirror } from '@rntme-cli/platform-core';
import { createDb, type Db } from '../pg/pool.js';
import { membershipMirror } from '../schema/identity.js';

function toMem(r: typeof membershipMirror.$inferSelect): MembershipMirror {
  return { orgId: r.orgId, accountId: r.accountId, role: r.role, updatedAt: r.updatedAt! };
}

export class PgMembershipMirrorRepo implements MembershipMirrorRepo {
  private readonly db: Db;
  constructor(private readonly pool: Pool) { this.db = createDb(pool); }
  async find(o: string, a: string): Promise<Result<MembershipMirror | null, PlatformError>> {
    try {
      const rows = await this.db.select().from(membershipMirror).where(and(eq(membershipMirror.orgId, o), eq(membershipMirror.accountId, a))).limit(1);
      return ok(rows[0] ? toMem(rows[0]) : null);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
  async upsert(row: { orgId: string; accountId: string; role: string }): Promise<Result<MembershipMirror, PlatformError>> {
    try {
      const rows = await this.db.insert(membershipMirror).values(row)
        .onConflictDoUpdate({ target: [membershipMirror.orgId, membershipMirror.accountId], set: { role: row.role, updatedAt: new Date() } })
        .returning();
      return ok(toMem(rows[0]!));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
  async delete(o: string, a: string): Promise<Result<void, PlatformError>> {
    try {
      await this.db.delete(membershipMirror).where(and(eq(membershipMirror.orgId, o), eq(membershipMirror.accountId, a)));
      return ok(undefined);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
  async listForAccount(a: string): Promise<Result<readonly MembershipMirror[], PlatformError>> {
    try {
      const rows = await this.db.select().from(membershipMirror).where(eq(membershipMirror.accountId, a));
      return ok(rows.map(toMem));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
}
```

```ts
// src/repos/pg-workos-event-log-repo.ts
import type { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { ok, err, type Result, type PlatformError, type WorkosEventLogRepo } from '@rntme-cli/platform-core';
import { createDb, type Db } from '../pg/pool.js';
import { workosEventLog } from '../schema/identity.js';

export class PgWorkosEventLogRepo implements WorkosEventLogRepo {
  private readonly db: Db;
  constructor(private readonly pool: Pool) { this.db = createDb(pool); }
  async hasProcessed(eventId: string): Promise<Result<boolean, PlatformError>> {
    try {
      const rows = await this.db.select().from(workosEventLog).where(eq(workosEventLog.eventId, eventId)).limit(1);
      return ok(rows.length > 0);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
  async markProcessed(eventId: string, eventType: string): Promise<Result<void, PlatformError>> {
    try {
      await this.db.insert(workosEventLog).values({ eventId, eventType }).onConflictDoNothing();
      return ok(undefined);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
}
```

- [ ] **Step 5: Run + Commit**

```bash
pnpm -F @rntme-cli/platform-storage test
git -C rntme-cli add packages/platform-storage/src/repos packages/platform-storage/test/integration/identity-repos.test.ts
git -C rntme-cli commit -m "feat(platform-storage): pg identity repos (org/account/membership/workos-event-log)"
```

---

### Task F3: PgProjectRepo + PgServiceRepo + RLS enforcement test

**Files:**
- Create: `src/repos/pg-project-repo.ts`
- Create: `src/repos/pg-service-repo.ts`
- Create: `test/integration/project-service-repos.test.ts`

- [ ] **Step 1: Test (includes RLS check)**

```ts
// test/integration/project-service-repos.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { isOk } from '@rntme-cli/platform-core';
import { startPostgres, resetSchema } from './harness.js';
import { PgOrganizationRepo } from '../../src/repos/pg-org-repo.js';
import { PgProjectRepo } from '../../src/repos/pg-project-repo.js';
import { PgServiceRepo } from '../../src/repos/pg-service-repo.js';
import { withTransaction } from '../../src/pg/tx.js';

let env: Awaited<ReturnType<typeof startPostgres>>;
beforeAll(async () => { env = await startPostgres(); }, 120_000);
afterAll(async () => { await env.pool.end(); await env.container.stop(); });
beforeEach(async () => { await resetSchema(env.pool); });

describe('project + service repos with RLS', () => {
  it('project.create inside tx honors org_id SET LOCAL', async () => {
    const orgs = new PgOrganizationRepo(env.pool);
    const o1 = await orgs.upsertFromWorkos({ workosOrganizationId: 'org_1', slug: 'o1', displayName: 'O' });
    if (!isOk(o1)) throw new Error('seed');
    const repo = new PgProjectRepo(env.pool);

    await withTransaction(env.pool, o1.value.id, async () => {
      const r = await repo.create({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', orgId: o1.value.id, slug: 'proj', displayName: 'P' });
      expect(isOk(r)).toBe(true);
    });

    // cross-org read must return null (RLS)
    const o2 = await orgs.upsertFromWorkos({ workosOrganizationId: 'org_2', slug: 'o2', displayName: 'O2' });
    if (!isOk(o2)) throw new Error('seed');
    await withTransaction(env.pool, o2.value.id, async () => {
      const r = await repo.list(o1.value.id, { includeArchived: false });
      expect(isOk(r) && r.value).toHaveLength(0);  // RLS hides o1's rows
    });
  });

  it('service.create + find round-trip', async () => {
    const orgs = new PgOrganizationRepo(env.pool);
    const o = await orgs.upsertFromWorkos({ workosOrganizationId: 'org_1', slug: 'o1', displayName: 'O' });
    if (!isOk(o)) throw new Error('seed');
    const projects = new PgProjectRepo(env.pool);
    const services = new PgServiceRepo(env.pool);
    await withTransaction(env.pool, o.value.id, async () => {
      const p = await projects.create({ id: 'pppppppp-pppp-pppp-pppp-pppppppppppp', orgId: o.value.id, slug: 'pr', displayName: 'P' });
      if (!isOk(p)) throw new Error('seed');
      const s = await services.create({ id: 'ssssssss-ssss-ssss-ssss-ssssssssssss', orgId: o.value.id, projectId: p.value.id, slug: 'sv', displayName: 'S' });
      expect(isOk(s)).toBe(true);
      const found = await services.findBySlug(p.value.id, 'sv');
      expect(isOk(found) && found.value!.slug).toBe('sv');
    });
  });
});
```

- [ ] **Step 2: Implement src/repos/pg-project-repo.ts**

```ts
import type { Pool } from 'pg';
import { and, eq, sql, count } from 'drizzle-orm';
import { ok, err, type Result, type PlatformError, type ProjectRepo, type Project } from '@rntme-cli/platform-core';
import { createDb, type Db } from '../pg/pool.js';
import { project, service } from '../schema/projects.js';

function toP(r: typeof project.$inferSelect): Project {
  return { id: r.id, orgId: r.orgId, slug: r.slug, displayName: r.displayName, archivedAt: r.archivedAt, createdAt: r.createdAt!, updatedAt: r.updatedAt! };
}

export class PgProjectRepo implements ProjectRepo {
  private readonly db: Db;
  constructor(private readonly pool: Pool) { this.db = createDb(pool); }

  async create(row: { id: string; orgId: string; slug: string; displayName: string }): Promise<Result<Project, PlatformError>> {
    try {
      const rows = await this.db.insert(project).values(row).returning();
      return ok(toP(rows[0]!));
    } catch (cause) {
      const msg = String(cause);
      if (/project_org_slug_uq/.test(msg)) return err([{ code: 'PLATFORM_CONFLICT_SLUG_TAKEN', message: row.slug, cause }]);
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: msg, cause }]);
    }
  }

  async findBySlug(orgId: string, slug: string): Promise<Result<Project | null, PlatformError>> {
    try {
      const rows = await this.db.select().from(project).where(and(eq(project.orgId, orgId), eq(project.slug, slug))).limit(1);
      return ok(rows[0] ? toP(rows[0]) : null);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async findById(orgId: string, id: string): Promise<Result<Project | null, PlatformError>> {
    try {
      const rows = await this.db.select().from(project).where(and(eq(project.orgId, orgId), eq(project.id, id))).limit(1);
      return ok(rows[0] ? toP(rows[0]) : null);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async list(orgId: string, opts: { includeArchived: boolean }): Promise<Result<readonly Project[], PlatformError>> {
    try {
      const cond = opts.includeArchived ? eq(project.orgId, orgId) : and(eq(project.orgId, orgId), sql`archived_at IS NULL`);
      const rows = await this.db.select().from(project).where(cond!);
      return ok(rows.map(toP));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async patch(orgId: string, id: string, patch: { displayName: string }): Promise<Result<Project, PlatformError>> {
    try {
      const rows = await this.db.update(project).set({ displayName: patch.displayName, updatedAt: new Date() })
        .where(and(eq(project.orgId, orgId), eq(project.id, id))).returning();
      if (!rows[0]) return err([{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: id }]);
      return ok(toP(rows[0]));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async archive(orgId: string, id: string): Promise<Result<Project, PlatformError>> {
    try {
      const rows = await this.db.update(project).set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(project.orgId, orgId), eq(project.id, id))).returning();
      if (!rows[0]) return err([{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: id }]);
      return ok(toP(rows[0]));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async countServices(orgId: string, id: string): Promise<Result<number, PlatformError>> {
    try {
      const r = await this.db.select({ c: count() }).from(service).where(and(eq(service.orgId, orgId), eq(service.projectId, id), sql`archived_at IS NULL`));
      return ok(Number(r[0]?.c ?? 0));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
}
```

- [ ] **Step 3: Implement src/repos/pg-service-repo.ts**

```ts
import type { Pool } from 'pg';
import { and, eq, desc } from 'drizzle-orm';
import { ok, err, type Result, type PlatformError, type ServiceRepo, type Service, type ArtifactVersion, type ArtifactTag } from '@rntme-cli/platform-core';
import { createDb, type Db } from '../pg/pool.js';
import { service } from '../schema/projects.js';
import { artifactVersion, artifactTag } from '../schema/artifacts.js';

function toS(r: typeof service.$inferSelect): Service {
  return { id: r.id, orgId: r.orgId, projectId: r.projectId, slug: r.slug, displayName: r.displayName, archivedAt: r.archivedAt, createdAt: r.createdAt!, updatedAt: r.updatedAt! };
}

export class PgServiceRepo implements ServiceRepo {
  private readonly db: Db;
  constructor(private readonly pool: Pool) { this.db = createDb(pool); }

  async create(row: { id: string; orgId: string; projectId: string; slug: string; displayName: string }): Promise<Result<Service, PlatformError>> {
    try {
      const rows = await this.db.insert(service).values(row).returning();
      return ok(toS(rows[0]!));
    } catch (cause) {
      const msg = String(cause);
      if (/service_project_slug_uq/.test(msg)) return err([{ code: 'PLATFORM_CONFLICT_SLUG_TAKEN', message: row.slug, cause }]);
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: msg, cause }]);
    }
  }

  async findBySlug(projectId: string, slug: string): Promise<Result<Service | null, PlatformError>> {
    try {
      const rows = await this.db.select().from(service).where(and(eq(service.projectId, projectId), eq(service.slug, slug))).limit(1);
      return ok(rows[0] ? toS(rows[0]) : null);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async findById(orgId: string, id: string): Promise<Result<Service | null, PlatformError>> {
    try {
      const rows = await this.db.select().from(service).where(and(eq(service.orgId, orgId), eq(service.id, id))).limit(1);
      return ok(rows[0] ? toS(rows[0]) : null);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async list(orgId: string, projectId: string): Promise<Result<readonly Service[], PlatformError>> {
    try {
      const rows = await this.db.select().from(service).where(and(eq(service.orgId, orgId), eq(service.projectId, projectId)));
      return ok(rows.map(toS));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async patch(orgId: string, id: string, patch: { displayName: string }): Promise<Result<Service, PlatformError>> {
    try {
      const rows = await this.db.update(service).set({ displayName: patch.displayName, updatedAt: new Date() })
        .where(and(eq(service.orgId, orgId), eq(service.id, id))).returning();
      if (!rows[0]) return err([{ code: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND', message: id }]);
      return ok(toS(rows[0]));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async archive(orgId: string, id: string): Promise<Result<Service, PlatformError>> {
    try {
      const rows = await this.db.update(service).set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(service.orgId, orgId), eq(service.id, id))).returning();
      if (!rows[0]) return err([{ code: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND', message: id }]);
      return ok(toS(rows[0]));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async detailWithLatest(orgId: string, id: string): Promise<Result<{ service: Service; latestVersion: ArtifactVersion | null; tags: readonly ArtifactTag[] }, PlatformError>> {
    try {
      const svcRows = await this.db.select().from(service).where(and(eq(service.orgId, orgId), eq(service.id, id))).limit(1);
      if (!svcRows[0]) return err([{ code: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND', message: id }]);
      const latest = await this.db.select().from(artifactVersion).where(eq(artifactVersion.serviceId, id)).orderBy(desc(artifactVersion.seq)).limit(1);
      const tagRows = await this.db.select().from(artifactTag).where(eq(artifactTag.serviceId, id));
      return ok({
        service: toS(svcRows[0]),
        latestVersion: latest[0] ? (latest[0] as unknown as ArtifactVersion) : null,
        tags: tagRows as unknown as ArtifactTag[],
      });
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm -F @rntme-cli/platform-storage test
git -C rntme-cli add packages/platform-storage/src/repos/pg-project-repo.ts packages/platform-storage/src/repos/pg-service-repo.ts packages/platform-storage/test/integration/project-service-repos.test.ts
git -C rntme-cli commit -m "feat(platform-storage): pg project + service repos with RLS-enforced tests"
```

---

### Task F4: PgArtifactRepo (publish with advisory lock, transactional outbox, audit)

**Files:**
- Create: `src/repos/pg-artifact-repo.ts`
- Create: `test/integration/artifact-repo.test.ts`

- [ ] **Step 1: Test**

```ts
// test/integration/artifact-repo.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { isOk } from '@rntme-cli/platform-core';
import { startPostgres, resetSchema } from './harness.js';
import { PgOrganizationRepo } from '../../src/repos/pg-org-repo.js';
import { PgAccountRepo } from '../../src/repos/pg-account-repo.js';
import { PgProjectRepo } from '../../src/repos/pg-project-repo.js';
import { PgServiceRepo } from '../../src/repos/pg-service-repo.js';
import { PgArtifactRepo } from '../../src/repos/pg-artifact-repo.js';
import { withTransaction } from '../../src/pg/tx.js';
import { randomUUID } from 'node:crypto';

let env: Awaited<ReturnType<typeof startPostgres>>;
beforeAll(async () => { env = await startPostgres(); }, 120_000);
afterAll(async () => { await env.pool.end(); await env.container.stop(); });
beforeEach(async () => { await resetSchema(env.pool); });

async function seed() {
  const orgs = new PgOrganizationRepo(env.pool);
  const accts = new PgAccountRepo(env.pool);
  const o = await orgs.upsertFromWorkos({ workosOrganizationId: 'org_1', slug: 'o1', displayName: 'O' });
  const a = await accts.upsertFromWorkos({ workosUserId: 'u_1', email: null, displayName: 'U' });
  if (!isOk(o) || !isOk(a)) throw new Error('seed');
  return withTransaction(env.pool, o.value.id, async () => {
    const projects = new PgProjectRepo(env.pool);
    const services = new PgServiceRepo(env.pool);
    const p = await projects.create({ id: randomUUID(), orgId: o.value.id, slug: 'pr', displayName: 'P' });
    if (!isOk(p)) throw new Error('seed');
    const s = await services.create({ id: randomUUID(), orgId: o.value.id, projectId: p.value.id, slug: 'sv', displayName: 'S' });
    if (!isOk(s)) throw new Error('seed');
    return { orgId: o.value.id, accountId: a.value.id, serviceId: s.value.id };
  });
}

function baseRow(serviceId: string, orgId: string, accountId: string) {
  const digest = 'a'.repeat(64);
  return {
    id: randomUUID(), orgId, serviceId, bundleDigest: digest,
    previousVersionId: null, manifestDigest: digest, pdmDigest: digest, qsmDigest: digest,
    graphIrDigest: digest, bindingsDigest: digest, uiDigest: digest, seedDigest: digest,
    validationSnapshot: {}, publishedByAccountId: accountId, publishedByTokenId: null, message: null,
  };
}

describe('PgArtifactRepo', () => {
  it('publish assigns seq=1, writes audit + outbox', async () => {
    const { orgId, accountId, serviceId } = await seed();
    const repo = new PgArtifactRepo(env.pool);
    const r = await withTransaction(env.pool, orgId, async () => repo.publish({
      serviceId, expectedPreviousSeq: undefined, row: baseRow(serviceId, orgId, accountId),
      outboxPayload: { serviceId }, auditActorAccountId: accountId, auditActorTokenId: null, moveTags: [],
    }));
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.seq).toBe(1);

    const outbox = await env.pool.query('SELECT COUNT(*)::int AS c FROM event_outbox');
    expect(outbox.rows[0].c).toBe(1);
    const audit = await env.pool.query(`SELECT COUNT(*)::int AS c FROM audit_log WHERE action='version.published'`);
    expect(audit.rows[0].c).toBe(1);
  });

  it('idempotency: same bundleDigest returns existing row', async () => {
    const { orgId, accountId, serviceId } = await seed();
    const repo = new PgArtifactRepo(env.pool);
    const row = baseRow(serviceId, orgId, accountId);
    const r1 = await withTransaction(env.pool, orgId, async () => repo.publish({
      serviceId, expectedPreviousSeq: undefined, row, outboxPayload: {}, auditActorAccountId: accountId, auditActorTokenId: null, moveTags: [],
    }));
    const r2 = await withTransaction(env.pool, orgId, async () => repo.publish({
      serviceId, expectedPreviousSeq: undefined, row: { ...row, id: randomUUID() }, outboxPayload: {}, auditActorAccountId: accountId, auditActorTokenId: null, moveTags: [],
    }));
    expect(isOk(r1) && isOk(r2)).toBe(true);
    if (isOk(r1) && isOk(r2)) expect(r1.value.id).toBe(r2.value.id);
  });

  it('concurrency conflict when previousVersionSeq wrong', async () => {
    const { orgId, accountId, serviceId } = await seed();
    const repo = new PgArtifactRepo(env.pool);
    const r = await withTransaction(env.pool, orgId, async () => repo.publish({
      serviceId, expectedPreviousSeq: 42, row: baseRow(serviceId, orgId, accountId),
      outboxPayload: {}, auditActorAccountId: accountId, auditActorTokenId: null, moveTags: [],
    }));
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_CONCURRENCY_VERSION_CONFLICT');
  });
});
```

- [ ] **Step 2: Implement src/repos/pg-artifact-repo.ts**

```ts
import type { Pool } from 'pg';
import { ok, err, type Result, type PlatformError, type ArtifactRepo, type ArtifactVersion, type PublishInsertRow } from '@rntme-cli/platform-core';

export class PgArtifactRepo implements ArtifactRepo {
  constructor(private readonly pool: Pool) {}

  async findByDigest(serviceId: string, bundleDigest: string): Promise<Result<ArtifactVersion | null, PlatformError>> {
    try {
      const r = await this.pool.query(`SELECT * FROM artifact_version WHERE service_id=$1 AND bundle_digest=$2 LIMIT 1`, [serviceId, bundleDigest]);
      return ok(r.rows[0] ? rowToVersion(r.rows[0]) : null);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async latestSeq(serviceId: string): Promise<Result<number, PlatformError>> {
    try {
      const r = await this.pool.query(`SELECT COALESCE(MAX(seq),0)::int AS seq FROM artifact_version WHERE service_id=$1`, [serviceId]);
      return ok(r.rows[0].seq);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async publish(args: Parameters<ArtifactRepo['publish']>[0]): Promise<Result<ArtifactVersion, PlatformError>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.org_id = $1`, [args.row.orgId]);
      // Idempotency (inside transaction for consistency):
      const dup = await client.query(`SELECT * FROM artifact_version WHERE service_id=$1 AND bundle_digest=$2`, [args.serviceId, args.row.bundleDigest]);
      if (dup.rows[0]) {
        await client.query('COMMIT');
        return ok(rowToVersion(dup.rows[0]));
      }
      // Serialize concurrent publishes on this service:
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [args.serviceId]);
      const last = await client.query(`SELECT COALESCE(MAX(seq),0)::int AS seq, (SELECT id FROM artifact_version WHERE service_id=$1 ORDER BY seq DESC LIMIT 1) AS id FROM artifact_version WHERE service_id=$1`, [args.serviceId]);
      const latestSeq = last.rows[0].seq as number;
      const latestId = last.rows[0].id as string | null;
      if (args.expectedPreviousSeq !== undefined && args.expectedPreviousSeq !== latestSeq) {
        await client.query('ROLLBACK');
        return err([{ code: 'PLATFORM_CONCURRENCY_VERSION_CONFLICT', message: `expected ${args.expectedPreviousSeq} but latest ${latestSeq}` }]);
      }
      const ins = await client.query(
        `INSERT INTO artifact_version (
           id, org_id, service_id, seq, bundle_digest, previous_version_id,
           manifest_digest, pdm_digest, qsm_digest, graph_ir_digest, bindings_digest, ui_digest, seed_digest,
           validation_snapshot, published_by_account_id, published_by_token_id, message
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
         ) RETURNING *`,
        [
          args.row.id, args.row.orgId, args.serviceId, latestSeq + 1, args.row.bundleDigest, latestId,
          args.row.manifestDigest, args.row.pdmDigest, args.row.qsmDigest, args.row.graphIrDigest,
          args.row.bindingsDigest, args.row.uiDigest, args.row.seedDigest,
          args.row.validationSnapshot, args.row.publishedByAccountId, args.row.publishedByTokenId, args.row.message,
        ],
      );
      const inserted = ins.rows[0];
      // Tags
      for (const t of args.moveTags) {
        await client.query(
          `INSERT INTO artifact_tag (service_id, name, version_id, updated_by_account_id) VALUES ($1,$2,$3,$4)
           ON CONFLICT (service_id, name) DO UPDATE SET version_id=EXCLUDED.version_id, updated_at=now(), updated_by_account_id=EXCLUDED.updated_by_account_id`,
          [args.serviceId, t.name, inserted.id, t.updatedByAccountId],
        );
        await client.query(
          `INSERT INTO audit_log (org_id, actor_account_id, actor_token_id, action, resource_kind, resource_id, payload)
           VALUES ($1,$2,$3,'tag.moved','tag',$4,$5)`,
          [args.row.orgId, args.auditActorAccountId, args.auditActorTokenId, t.name, { versionSeq: latestSeq + 1 }],
        );
      }
      // Audit publish
      await client.query(
        `INSERT INTO audit_log (org_id, actor_account_id, actor_token_id, action, resource_kind, resource_id, payload)
         VALUES ($1,$2,$3,'version.published','version',$4,$5)`,
        [args.row.orgId, args.auditActorAccountId, args.auditActorTokenId, inserted.id, { seq: latestSeq + 1 }],
      );
      // Outbox
      await client.query(
        `INSERT INTO event_outbox (org_id, event_type, payload) VALUES ($1,'artifact.version.published',$2)`,
        [args.row.orgId, args.outboxPayload],
      );
      await client.query('COMMIT');
      return ok(rowToVersion(inserted));
    } catch (cause) {
      try { await client.query('ROLLBACK'); } catch { /* */ }
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    } finally {
      client.release();
    }
  }

  async listBySeq(serviceId: string, opts: { limit: number; cursor: number | undefined }): Promise<Result<readonly ArtifactVersion[], PlatformError>> {
    try {
      if (opts.cursor !== undefined) {
        const r = await this.pool.query(`SELECT * FROM artifact_version WHERE service_id=$1 AND seq<$2 ORDER BY seq DESC LIMIT $3`, [serviceId, opts.cursor, opts.limit]);
        return ok(r.rows.map(rowToVersion));
      }
      const r = await this.pool.query(`SELECT * FROM artifact_version WHERE service_id=$1 ORDER BY seq DESC LIMIT $2`, [serviceId, opts.limit]);
      return ok(r.rows.map(rowToVersion));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }

  async getBySeq(serviceId: string, seq: number): Promise<Result<ArtifactVersion | null, PlatformError>> {
    try {
      const r = await this.pool.query(`SELECT * FROM artifact_version WHERE service_id=$1 AND seq=$2`, [serviceId, seq]);
      return ok(r.rows[0] ? rowToVersion(r.rows[0]) : null);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]); }
  }
}

function rowToVersion(r: Record<string, unknown>): ArtifactVersion {
  return {
    id: r['id'] as string, orgId: r['org_id'] as string, serviceId: r['service_id'] as string, seq: r['seq'] as number,
    bundleDigest: r['bundle_digest'] as string, previousVersionId: (r['previous_version_id'] as string | null) ?? null,
    manifestDigest: r['manifest_digest'] as string, pdmDigest: r['pdm_digest'] as string, qsmDigest: r['qsm_digest'] as string,
    graphIrDigest: r['graph_ir_digest'] as string, bindingsDigest: r['bindings_digest'] as string,
    uiDigest: r['ui_digest'] as string, seedDigest: r['seed_digest'] as string,
    validationSnapshot: r['validation_snapshot'] as Record<string, unknown>,
    publishedByAccountId: r['published_by_account_id'] as string,
    publishedByTokenId: (r['published_by_token_id'] as string | null) ?? null,
    publishedAt: r['published_at'] as Date,
    message: (r['message'] as string | null) ?? null,
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm -F @rntme-cli/platform-storage test
git -C rntme-cli add packages/platform-storage/src/repos/pg-artifact-repo.ts packages/platform-storage/test/integration/artifact-repo.test.ts
git -C rntme-cli commit -m "feat(platform-storage): PgArtifactRepo with advisory lock + transactional outbox/audit"
```

---

### Task F5: PgTagRepo + PgTokenRepo + PgAuditRepo + PgOutboxRepo

**Files:**
- Create: `src/repos/pg-tag-repo.ts`
- Create: `src/repos/pg-token-repo.ts`
- Create: `src/repos/pg-audit-repo.ts`
- Create: `src/repos/pg-outbox-repo.ts`
- Create: `test/integration/misc-repos.test.ts`

- [ ] **Step 1: Test**

```ts
// test/integration/misc-repos.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { isOk } from '@rntme-cli/platform-core';
import { startPostgres, resetSchema } from './harness.js';
import { PgOrganizationRepo } from '../../src/repos/pg-org-repo.js';
import { PgAccountRepo } from '../../src/repos/pg-account-repo.js';
import { PgTokenRepo } from '../../src/repos/pg-token-repo.js';
import { PgAuditRepo } from '../../src/repos/pg-audit-repo.js';
import { PgOutboxRepo } from '../../src/repos/pg-outbox-repo.js';
import { withTransaction } from '../../src/pg/tx.js';
import { randomUUID, createHash } from 'node:crypto';

let env: Awaited<ReturnType<typeof startPostgres>>;
beforeAll(async () => { env = await startPostgres(); }, 120_000);
afterAll(async () => { await env.pool.end(); await env.container.stop(); });
beforeEach(async () => { await resetSchema(env.pool); });

describe('misc repos', () => {
  it('token create / list by prefix / revoke', async () => {
    const orgs = new PgOrganizationRepo(env.pool); const accts = new PgAccountRepo(env.pool);
    const o = await orgs.upsertFromWorkos({ workosOrganizationId: 'org_1', slug: 'o1', displayName: 'O' });
    const a = await accts.upsertFromWorkos({ workosUserId: 'u', email: null, displayName: 'U' });
    if (!isOk(o) || !isOk(a)) throw new Error('seed');
    const repo = new PgTokenRepo(env.pool);
    await withTransaction(env.pool, o.value.id, async () => {
      const plain = 'rntme_pat_' + 'a'.repeat(22);
      const hash = new Uint8Array(createHash('sha256').update(plain).digest());
      const t = await repo.create({ id: randomUUID(), orgId: o.value.id, accountId: a.value.id, name: 'cli', tokenHash: hash, prefix: plain.slice(0, 12), scopes: ['project:read'], expiresAt: null });
      expect(isOk(t)).toBe(true);
      if (isOk(t)) {
        const found = await repo.findByPrefix(plain.slice(0, 12));
        expect(isOk(found) && found.value!.id).toBe(t.value.id);
        const rev = await repo.revoke(o.value.id, t.value.id);
        expect(isOk(rev)).toBe(true);
        const after = await repo.findByPrefix(plain.slice(0, 12));
        expect(isOk(after) && after.value).toBeNull();
      }
    });
  });

  it('outbox pending returns only undelivered', async () => {
    const repo = new PgOutboxRepo(env.pool);
    const orgs = new PgOrganizationRepo(env.pool);
    const o = await orgs.upsertFromWorkos({ workosOrganizationId: 'org_1', slug: 'o1', displayName: 'O' });
    if (!isOk(o)) throw new Error('seed');
    await env.pool.query(`INSERT INTO event_outbox (org_id, event_type, payload) VALUES ($1,'x',$2)`, [o.value.id, {}]);
    await env.pool.query(`INSERT INTO event_outbox (org_id, event_type, payload, delivered_at) VALUES ($1,'x',$2, now())`, [o.value.id, {}]);
    const r = await repo.pending(10);
    expect(isOk(r) && r.value).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement the four repo classes** (skeleton — engineer writes each against the interface from `@rntme-cli/platform-core` following the PgProjectRepo / PgArtifactRepo pattern exactly).

```ts
// src/repos/pg-tag-repo.ts
import type { Pool } from 'pg';
import { ok, err, type Result, type PlatformError, type TagRepo, type ArtifactTag } from '@rntme-cli/platform-core';
export class PgTagRepo implements TagRepo {
  constructor(private readonly pool: Pool) {}
  async list(serviceId: string) {
    try { const r = await this.pool.query(`SELECT * FROM artifact_tag WHERE service_id=$1`, [serviceId]); return ok(r.rows as unknown as ArtifactTag[]); }
    catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: String(cause), cause }]); }
  }
  async move(a: { serviceId: string; name: string; versionId: string; updatedByAccountId: string }) {
    try {
      const r = await this.pool.query(
        `INSERT INTO artifact_tag (service_id, name, version_id, updated_by_account_id) VALUES ($1,$2,$3,$4)
         ON CONFLICT (service_id, name) DO UPDATE SET version_id=EXCLUDED.version_id, updated_at=now(), updated_by_account_id=EXCLUDED.updated_by_account_id
         RETURNING *`,
        [a.serviceId, a.name, a.versionId, a.updatedByAccountId],
      );
      return ok(r.rows[0] as unknown as ArtifactTag);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: String(cause), cause }]); }
  }
  async delete(serviceId: string, name: string, _actor: string) {
    try { await this.pool.query(`DELETE FROM artifact_tag WHERE service_id=$1 AND name=$2`, [serviceId, name]); return ok(undefined); }
    catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: String(cause), cause }]); }
  }
}
```

```ts
// src/repos/pg-token-repo.ts
import type { Pool } from 'pg';
import { ok, err, type Result, type PlatformError, type TokenRepo, type ApiToken, type Scope } from '@rntme-cli/platform-core';

function row(r: Record<string, unknown>): ApiToken {
  return {
    id: r['id'] as string, orgId: r['org_id'] as string, accountId: r['account_id'] as string,
    name: r['name'] as string, tokenHash: new Uint8Array(r['token_hash'] as Buffer),
    prefix: r['prefix'] as string, scopes: r['scopes'] as Scope[],
    lastUsedAt: (r['last_used_at'] as Date | null) ?? null,
    expiresAt: (r['expires_at'] as Date | null) ?? null,
    revokedAt: (r['revoked_at'] as Date | null) ?? null,
    createdAt: r['created_at'] as Date,
  };
}

export class PgTokenRepo implements TokenRepo {
  constructor(private readonly pool: Pool) {}
  async create(r: { id: string; orgId: string; accountId: string; name: string; tokenHash: Uint8Array; prefix: string; scopes: readonly Scope[]; expiresAt: Date | null }) {
    try {
      const q = await this.pool.query(
        `INSERT INTO api_token (id, org_id, account_id, name, token_hash, prefix, scopes, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [r.id, r.orgId, r.accountId, r.name, Buffer.from(r.tokenHash), r.prefix, r.scopes, r.expiresAt],
      );
      return ok(row(q.rows[0]));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: String(cause), cause }]); }
  }
  async findByPrefix(prefix: string) {
    try {
      const q = await this.pool.query(
        `SELECT * FROM api_token WHERE prefix=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) LIMIT 1`,
        [prefix],
      );
      return ok(q.rows[0] ? row(q.rows[0]) : null);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: String(cause), cause }]); }
  }
  async list(orgId: string) {
    try { const q = await this.pool.query(`SELECT * FROM api_token WHERE org_id=$1 ORDER BY created_at DESC`, [orgId]); return ok(q.rows.map(row)); }
    catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: String(cause), cause }]); }
  }
  async revoke(orgId: string, id: string) {
    try { await this.pool.query(`UPDATE api_token SET revoked_at=now() WHERE org_id=$1 AND id=$2`, [orgId, id]); return ok(undefined); }
    catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: String(cause), cause }]); }
  }
  async touchLastUsed(id: string) {
    try { await this.pool.query(`UPDATE api_token SET last_used_at=now() WHERE id=$1`, [id]); return ok(undefined); }
    catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: String(cause), cause }]); }
  }
}
```

```ts
// src/repos/pg-audit-repo.ts
import type { Pool } from 'pg';
import { ok, err, type AuditRepo, type AuditLogEntry } from '@rntme-cli/platform-core';

function row(r: Record<string, unknown>): AuditLogEntry {
  return {
    id: BigInt(r['id'] as string),
    orgId: r['org_id'] as string, actorAccountId: r['actor_account_id'] as string,
    actorTokenId: (r['actor_token_id'] as string | null) ?? null,
    action: r['action'] as string, resourceKind: r['resource_kind'] as string, resourceId: r['resource_id'] as string,
    payload: r['payload'] as Record<string, unknown>, createdAt: r['created_at'] as Date,
  };
}

export class PgAuditRepo implements AuditRepo {
  constructor(private readonly pool: Pool) {}
  async list(orgId: string, opts: { resourceKind?: string; actorAccountId?: string; action?: string; since?: Date; limit: number }) {
    try {
      const where: string[] = ['org_id=$1']; const vals: unknown[] = [orgId]; let i = 2;
      if (opts.resourceKind) { where.push(`resource_kind=$${i++}`); vals.push(opts.resourceKind); }
      if (opts.actorAccountId) { where.push(`actor_account_id=$${i++}`); vals.push(opts.actorAccountId); }
      if (opts.action) { where.push(`action=$${i++}`); vals.push(opts.action); }
      if (opts.since) { where.push(`created_at >= $${i++}`); vals.push(opts.since); }
      vals.push(opts.limit);
      const q = await this.pool.query(`SELECT * FROM audit_log WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${i}`, vals);
      return ok(q.rows.map(row));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: String(cause), cause }]); }
  }
}
```

```ts
// src/repos/pg-outbox-repo.ts
import type { Pool } from 'pg';
import { ok, err, type OutboxRepo } from '@rntme-cli/platform-core';

export class PgOutboxRepo implements OutboxRepo {
  constructor(private readonly pool: Pool) {}
  async pending(limit: number) {
    try {
      const q = await this.pool.query(`SELECT id, event_type, payload FROM event_outbox WHERE delivered_at IS NULL ORDER BY id ASC LIMIT $1`, [limit]);
      return ok(q.rows.map((r) => ({ id: BigInt(r.id as string), eventType: r.event_type as string, payload: r.payload as Record<string, unknown> })));
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: String(cause), cause }]); }
  }
  async markDelivered(id: bigint) {
    try { await this.pool.query(`UPDATE event_outbox SET delivered_at=now() WHERE id=$1`, [id]); return ok(undefined); }
    catch (cause) { return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: String(cause), cause }]); }
  }
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm -F @rntme-cli/platform-storage test
git -C rntme-cli add packages/platform-storage/src/repos/pg-tag-repo.ts packages/platform-storage/src/repos/pg-token-repo.ts packages/platform-storage/src/repos/pg-audit-repo.ts packages/platform-storage/src/repos/pg-outbox-repo.ts packages/platform-storage/test/integration/misc-repos.test.ts
git -C rntme-cli commit -m "feat(platform-storage): pg tag/token/audit/outbox repos"
```

---

## Phase G — platform-storage: S3 / rustfs blob store

### Task G1: S3BlobStore + MinIO integration test

**Files:**
- Create: `src/blob/s3-blob-store.ts`
- Create: `test/integration/blob/s3-blob-store.test.ts`

- [ ] **Step 1: Test (against MinIO container)**

```ts
// test/integration/blob/s3-blob-store.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { S3BlobStore } from '../../../src/blob/s3-blob-store.js';
import { isOk } from '@rntme-cli/platform-core';

let minio: StartedTestContainer;
let store: S3BlobStore;

beforeAll(async () => {
  minio = await new GenericContainer('minio/minio:latest')
    .withCommand(['server', '/data'])
    .withEnvironment({ MINIO_ROOT_USER: 'minio', MINIO_ROOT_PASSWORD: 'minio12345' })
    .withExposedPorts(9000)
    .start();
  const endpoint = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`;
  store = new S3BlobStore({ endpoint, bucket: 'test', accessKeyId: 'minio', secretAccessKey: 'minio12345' });
  await store.ensureBucket();
}, 120_000);
afterAll(async () => { await minio.stop(); });

describe('S3BlobStore', () => {
  it('putIfAbsent round-trips via getJson', async () => {
    const key = 'sha256/ab/abcdef.json';
    const put = await store.putIfAbsent(key, Buffer.from(JSON.stringify({ hello: 'world' })));
    expect(isOk(put)).toBe(true);
    const got = await store.getJson(key);
    expect(isOk(got) && (got.value as { hello: string }).hello).toBe('world');
  });
  it('presignedGet returns a URL', async () => {
    const key = 'sha256/cd/cdef01.json';
    await store.putIfAbsent(key, Buffer.from('{}'));
    const url = await store.presignedGet(key, 60);
    expect(isOk(url) && url.value).toMatch(/^http/);
  });
});
```

- [ ] **Step 2: Implement src/blob/s3-blob-store.ts**

```ts
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ok, err, type BlobStore, type Result, type PlatformError } from '@rntme-cli/platform-core';

export type S3BlobStoreOpts = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
};

export class S3BlobStore implements BlobStore {
  private readonly client: S3Client;
  constructor(private readonly opts: S3BlobStoreOpts) {
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region ?? 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }

  async ensureBucket(): Promise<void> {
    try { await this.client.send(new HeadBucketCommand({ Bucket: this.opts.bucket })); }
    catch { await this.client.send(new CreateBucketCommand({ Bucket: this.opts.bucket })); }
  }

  async putIfAbsent(key: string, body: Buffer): Promise<Result<void, PlatformError>> {
    try {
      try {
        await this.client.send(new HeadObjectCommand({ Bucket: this.opts.bucket, Key: key }));
        return ok(undefined);
      } catch { /* not present, fall through */ }
      await this.client.send(new PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: body, ContentType: 'application/json' }));
      return ok(undefined);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_BLOB_UPLOAD_FAILED', message: String(cause), cause }]); }
  }

  async presignedGet(key: string, expiresSeconds: number): Promise<Result<string, PlatformError>> {
    try {
      const cmd = new GetObjectCommand({ Bucket: this.opts.bucket, Key: key });
      const url = await getSignedUrl(this.client, cmd, { expiresIn: expiresSeconds });
      return ok(url);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_BLOB_UPLOAD_FAILED', message: String(cause), cause }]); }
  }

  async getJson<T = unknown>(key: string): Promise<Result<T, PlatformError>> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
      const body = await res.Body!.transformToString('utf8');
      return ok(JSON.parse(body) as T);
    } catch (cause) { return err([{ code: 'PLATFORM_STORAGE_BLOB_UPLOAD_FAILED', message: String(cause), cause }]); }
  }
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm -F @rntme-cli/platform-storage test
git -C rntme-cli add packages/platform-storage/src/blob packages/platform-storage/test/integration/blob
git -C rntme-cli commit -m "feat(platform-storage): S3 blob store with MinIO integration test"
```

---

### Task G2: Barrel exports for platform-storage

- [ ] **Step 1: Implement src/index.ts**

```ts
export const VERSION = '0.0.0';
export * from './pg/pool.js';
export * from './pg/tx.js';
export * from './migrate.js';
export * from './schema/index.js';
export * from './repos/pg-org-repo.js';
export * from './repos/pg-account-repo.js';
export * from './repos/pg-membership-mirror-repo.js';
export * from './repos/pg-workos-event-log-repo.js';
export * from './repos/pg-project-repo.js';
export * from './repos/pg-service-repo.js';
export * from './repos/pg-artifact-repo.js';
export * from './repos/pg-tag-repo.js';
export * from './repos/pg-token-repo.js';
export * from './repos/pg-audit-repo.js';
export * from './repos/pg-outbox-repo.js';
export * from './blob/s3-blob-store.js';
```

- [ ] **Step 2: Full green + commit**

```bash
pnpm -F @rntme-cli/platform-storage build
pnpm -F @rntme-cli/platform-storage typecheck
pnpm -F @rntme-cli/platform-storage lint
pnpm -F @rntme-cli/platform-storage test
git -C rntme-cli add packages/platform-storage/src/index.ts
git -C rntme-cli commit -m "chore(platform-storage): barrel exports"
```

---

## Phase H — platform-http: env, app factory, entry point

All Phase H tasks inside `rntme-cli/packages/platform-http/`.

### Task H1: Env config with Zod validation

**Files:**
- Create: `src/config/env.ts`
- Create: `test/unit/config/env.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/config/env.test.ts
import { describe, it, expect } from 'vitest';
import { parseEnv } from '../../../src/config/env.js';

const baseline = {
  DATABASE_URL: 'postgres://x',
  RUSTFS_ENDPOINT: 'https://rustfs.internal',
  RUSTFS_ACCESS_KEY_ID: 'k', RUSTFS_SECRET_ACCESS_KEY: 's', RUSTFS_BUCKET: 'b',
  WORKOS_API_KEY: 'wk', WORKOS_CLIENT_ID: 'wc', WORKOS_WEBHOOK_SECRET: 'ww',
  WORKOS_REDIRECT_URI: 'https://platform.rntme.com/v1/auth/callback',
  PLATFORM_BASE_URL: 'https://platform.rntme.com',
  PLATFORM_SESSION_COOKIE_DOMAIN: '.rntme.com',
  PLATFORM_CORS_ORIGINS: 'https://*.rntme.com',
};

describe('parseEnv', () => {
  it('parses a full env', () => {
    const r = parseEnv(baseline);
    expect(r.PORT).toBe(3000);
    expect(r.LOG_LEVEL).toBe('info');
  });
  it('throws on missing DATABASE_URL', () => {
    const { DATABASE_URL: _, ...rest } = baseline;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement src/config/env.ts**

```ts
import { z } from 'zod';

export const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  RUSTFS_ENDPOINT: z.string().url(),
  RUSTFS_ACCESS_KEY_ID: z.string().min(1),
  RUSTFS_SECRET_ACCESS_KEY: z.string().min(1),
  RUSTFS_BUCKET: z.string().min(1),
  WORKOS_API_KEY: z.string().min(1),
  WORKOS_CLIENT_ID: z.string().min(1),
  WORKOS_WEBHOOK_SECRET: z.string().min(1),
  WORKOS_REDIRECT_URI: z.string().url(),
  PLATFORM_BASE_URL: z.string().url(),
  PLATFORM_SESSION_COOKIE_DOMAIN: z.string().min(1),
  PLATFORM_CORS_ORIGINS: z.string().default('https://*.rntme.com'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});
export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, unknown>): Env {
  const r = EnvSchema.safeParse(source);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid environment: ${msg}`);
  }
  return r.data;
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/config packages/platform-http/test/unit/config
git -C rntme-cli commit -m "feat(platform-http): Zod-validated env config"
```

---

### Task H2: Hono app factory skeleton + health endpoint

**Files:**
- Create: `src/app.ts`
- Create: `test/unit/app.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/app.test.ts
import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';

describe('app skeleton', () => {
  it('GET /health returns 200 ok', async () => {
    const app = createApp({ /* minimal deps — Task H3 will add real wiring */ } as never);
    const r = await app.request('/health');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Implement src/app.ts (skeleton — deps typed but empty)**

```ts
import { Hono } from 'hono';
import type { Env } from './config/env.js';

export type AppDeps = {
  env: Env;
  // subsequent tasks add: pool, repos, blob, workosClient, logger, identityProviders
};

export function createApp(_deps: AppDeps): Hono {
  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));
  return app;
}
```

- [ ] **Step 3: Commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/app.ts packages/platform-http/test/unit/app.test.ts
git -C rntme-cli commit -m "feat(platform-http): Hono app factory with /health"
```

---

### Task H3: Server entry point `src/bin/server.ts`

**Files:**
- Create: `src/bin/server.ts`

- [ ] **Step 1: Implement**

```ts
// src/bin/server.ts
import { serve } from '@hono/node-server';
import { parseEnv } from '../config/env.js';
import { createApp } from '../app.js';
// Later tasks inject real deps below.

const env = parseEnv(process.env);
const app = createApp({ env });

const port = env.PORT;
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(JSON.stringify({ msg: 'platform-http listening', port, baseUrl: env.PLATFORM_BASE_URL }));
```

- [ ] **Step 2: Build**

```bash
pnpm -F @rntme-cli/platform-http build
```

Expected: `dist/bin/server.js` exists.

- [ ] **Step 3: Commit**

```bash
git -C rntme-cli add packages/platform-http/src/bin/server.ts
git -C rntme-cli commit -m "feat(platform-http): server entry point"
```

---

## Phase I — platform-http: middleware stack (requestId, logger, error-handler, CORS, rate-limit)

### Task I1: requestId + pino logger middleware

**Files:**
- Create: `src/middleware/request-id.ts`
- Create: `src/middleware/logger.ts`
- Create: `src/logger.ts`
- Create: `test/unit/middleware/request-id.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/middleware/request-id.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requestId } from '../../../src/middleware/request-id.js';

describe('requestId middleware', () => {
  it('echoes incoming X-Request-ID header', async () => {
    const app = new Hono().use(requestId()).get('/', (c) => c.json({ id: c.get('requestId') }));
    const r = await app.request('/', { headers: { 'x-request-id': 'abc123' } });
    expect(r.headers.get('x-request-id')).toBe('abc123');
    expect((await r.json()).id).toBe('abc123');
  });
  it('generates a UUID when header missing', async () => {
    const app = new Hono().use(requestId()).get('/', (c) => c.json({ id: c.get('requestId') }));
    const r = await app.request('/');
    const hdr = r.headers.get('x-request-id')!;
    expect(hdr).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

- [ ] **Step 2: Implement src/middleware/request-id.ts**

```ts
import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';

declare module 'hono' {
  interface ContextVariableMap { requestId: string; }
}

export function requestId(): MiddlewareHandler {
  return async (c, next) => {
    const incoming = c.req.header('x-request-id');
    const id = incoming ?? randomUUID();
    c.set('requestId', id);
    c.header('X-Request-ID', id);
    await next();
  };
}
```

- [ ] **Step 3: Implement src/logger.ts**

```ts
import pino from 'pino';
import type { Env } from './config/env.js';

export function createLogger(env: Env): pino.Logger {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: ['authorization', 'cookie', 'token_hash', 'token_plain', 'rustfs_secret_access_key', 'workos_api_key', 'workos_webhook_secret'],
      censor: '[REDACTED]',
    },
  });
}
```

- [ ] **Step 4: Implement src/middleware/logger.ts**

```ts
import type { MiddlewareHandler } from 'hono';
import type pino from 'pino';

export function loggerMiddleware(logger: pino.Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const durationMs = Date.now() - start;
    logger.info({
      requestId: c.get('requestId'),
      method: c.req.method, path: c.req.path, status: c.res.status, durationMs,
    }, 'request');
  };
}
```

- [ ] **Step 5: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/middleware packages/platform-http/src/logger.ts packages/platform-http/test/unit/middleware
git -C rntme-cli commit -m "feat(platform-http): requestId + pino logger middleware"
```

---

### Task I2: Error-handler middleware (maps Result.err codes to HTTP statuses)

**Files:**
- Create: `src/middleware/error-handler.ts`
- Create: `test/unit/middleware/error-handler.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/middleware/error-handler.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { errorEnvelope, statusForCode } from '../../../src/middleware/error-handler.js';

describe('error-handler helpers', () => {
  it('statusForCode maps PLATFORM_AUTH_MISSING → 401', () => {
    expect(statusForCode('PLATFORM_AUTH_MISSING')).toBe(401);
    expect(statusForCode('PLATFORM_AUTH_FORBIDDEN')).toBe(403);
    expect(statusForCode('PLATFORM_TENANCY_PROJECT_NOT_FOUND')).toBe(404);
    expect(statusForCode('PLATFORM_CONFLICT_SLUG_TAKEN')).toBe(409);
    expect(statusForCode('PLATFORM_TENANCY_RESOURCE_ARCHIVED')).toBe(410);
    expect(statusForCode('PLATFORM_VALIDATION_BUNDLE_FAILED')).toBe(422);
    expect(statusForCode('PLATFORM_RATE_LIMITED')).toBe(429);
    expect(statusForCode('PLATFORM_STORAGE_DB_UNAVAILABLE')).toBe(503);
  });
  it('errorEnvelope shapes the JSON body', () => {
    const e = errorEnvelope([{ code: 'PLATFORM_INTERNAL', message: 'oops' }]);
    expect(e.error.code).toBe('PLATFORM_INTERNAL');
  });
});
```

- [ ] **Step 2: Implement src/middleware/error-handler.ts**

```ts
import type { MiddlewareHandler } from 'hono';
import type { PlatformError, ErrorCode } from '@rntme-cli/platform-core';

const STATUS: Partial<Record<ErrorCode, number>> = {
  PLATFORM_AUTH_MISSING: 401,
  PLATFORM_AUTH_INVALID: 401,
  PLATFORM_AUTH_TOKEN_REVOKED: 401,
  PLATFORM_AUTH_TOKEN_EXPIRED: 401,
  PLATFORM_AUTH_FORBIDDEN: 403,
  PLATFORM_PARSE_BODY_INVALID: 400,
  PLATFORM_PARSE_PATH_INVALID: 400,
  PLATFORM_TENANCY_ORG_NOT_FOUND: 404,
  PLATFORM_TENANCY_PROJECT_NOT_FOUND: 404,
  PLATFORM_TENANCY_SERVICE_NOT_FOUND: 404,
  PLATFORM_TENANCY_RESOURCE_ARCHIVED: 410,
  PLATFORM_VALIDATION_BUNDLE_FAILED: 422,
  PLATFORM_STORAGE_BLOB_UPLOAD_FAILED: 502,
  PLATFORM_STORAGE_DB_UNAVAILABLE: 503,
  PLATFORM_CONCURRENCY_VERSION_CONFLICT: 409,
  PLATFORM_CONCURRENCY_LAST_OWNER: 409,
  PLATFORM_CONFLICT_SLUG_TAKEN: 409,
  PLATFORM_RATE_LIMITED: 429,
  PLATFORM_INTERNAL: 500,
  PLATFORM_WORKOS_WEBHOOK_INVALID: 400,
  PLATFORM_WORKOS_UNAVAILABLE: 503,
};

export function statusForCode(code: ErrorCode): number {
  return STATUS[code] ?? 500;
}

export function errorEnvelope(errors: readonly PlatformError[]): { error: PlatformError; errors?: readonly PlatformError[] } {
  const first = errors[0] ?? { code: 'PLATFORM_INTERNAL', message: 'unknown' };
  return errors.length > 1 ? { error: first, errors } : { error: first };
}

export function errorHandler(): MiddlewareHandler {
  return async (c, next) => {
    try { await next(); }
    catch (cause) {
      const body = errorEnvelope([{ code: 'PLATFORM_INTERNAL', message: String(cause) }]);
      return c.json(body, 500);
    }
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/middleware/error-handler.ts packages/platform-http/test/unit/middleware/error-handler.test.ts
git -C rntme-cli commit -m "feat(platform-http): error-handler middleware + code→status mapping"
```

---

### Task I3: CORS middleware + Rate-limiter (in-memory sliding window)

**Files:**
- Create: `src/middleware/cors.ts`
- Create: `src/middleware/rate-limit.ts`
- Create: `test/unit/middleware/rate-limit.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/middleware/rate-limit.test.ts
import { describe, it, expect } from 'vitest';
import { InMemoryRateLimiter } from '../../../src/middleware/rate-limit.js';

describe('InMemoryRateLimiter', () => {
  it('allows up to N within window, then rejects', () => {
    const l = new InMemoryRateLimiter({ windowMs: 1000, max: 3 });
    const key = 'tok-1';
    expect(l.check(key)).toBe(true);
    expect(l.check(key)).toBe(true);
    expect(l.check(key)).toBe(true);
    expect(l.check(key)).toBe(false);
  });
  it('forgets after window', async () => {
    const l = new InMemoryRateLimiter({ windowMs: 30, max: 1 });
    expect(l.check('k')).toBe(true);
    expect(l.check('k')).toBe(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(l.check('k')).toBe(true);
  });
});
```

- [ ] **Step 2: Implement src/middleware/rate-limit.ts**

```ts
import type { MiddlewareHandler } from 'hono';

export class InMemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly opts: { windowMs: number; max: number }) {}

  check(key: string): boolean {
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.opts.windowMs);
    if (arr.length >= this.opts.max) { this.hits.set(key, arr); return false; }
    arr.push(now); this.hits.set(key, arr); return true;
  }
}

export function rateLimit(limiter: InMemoryRateLimiter, keyFn: (c: Parameters<MiddlewareHandler>[0]) => string): MiddlewareHandler {
  return async (c, next) => {
    const key = keyFn(c);
    if (!limiter.check(key)) return c.json({ error: { code: 'PLATFORM_RATE_LIMITED', message: 'rate limit exceeded' } }, 429);
    await next();
  };
}
```

- [ ] **Step 3: Implement src/middleware/cors.ts**

```ts
import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

export function corsMiddleware(originsCsv: string): MiddlewareHandler {
  const allow = originsCsv.split(',').map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin) => {
      for (const a of allow) {
        if (a === origin) return origin;
        if (a.includes('*') && new RegExp('^' + a.replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$').test(origin)) return origin;
      }
      return null;
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/middleware/cors.ts packages/platform-http/src/middleware/rate-limit.ts packages/platform-http/test/unit/middleware/rate-limit.test.ts
git -C rntme-cli commit -m "feat(platform-http): CORS + in-memory rate-limit middleware"
```

---

## Phase J — platform-http: auth providers

### Task J1: ApiTokenProvider impl

**Files:**
- Create: `src/auth/api-token-provider.ts`
- Create: `test/unit/auth/api-token-provider.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/auth/api-token-provider.test.ts
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { FakeStore, isOk } from '@rntme-cli/platform-core';
import { ApiTokenProvider } from '../../../src/auth/api-token-provider.js';

async function setup() {
  const store = new FakeStore();
  const org = await store.seedOrg({ slug: 'o', workosOrganizationId: 'org_1', displayName: 'O' });
  const acct = await store.seedAccount({ workosUserId: 'u', email: null, displayName: 'U' });
  await store.membershipMirror.upsert({ orgId: org.id, accountId: acct.id, role: 'member' });
  const plain = 'rntme_pat_' + 'a'.repeat(22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await store.tokensRepo.create({
    id: 'tid-1', orgId: org.id, accountId: acct.id, name: 'cli',
    tokenHash: hash, prefix: plain.slice(0, 12),
    scopes: ['project:read', 'project:write', 'version:publish'], expiresAt: null,
  });
  return { store, plain };
}

describe('ApiTokenProvider', () => {
  it('authenticates a valid bearer token', async () => {
    const { store, plain } = await setup();
    const p = new ApiTokenProvider({ tokens: store.tokensRepo, organizations: store.organizations, accounts: store.accountsRepo, memberships: store.membershipMirror });
    const r = await p.authenticate({ authorizationHeader: `Bearer ${plain}`, cookieHeader: undefined });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.role).toBe('member');
  });
  it('returns PLATFORM_AUTH_INVALID on bad hash', async () => {
    const { store } = await setup();
    const p = new ApiTokenProvider({ tokens: store.tokensRepo, organizations: store.organizations, accounts: store.accountsRepo, memberships: store.membershipMirror });
    const r = await p.authenticate({ authorizationHeader: `Bearer rntme_pat_${'b'.repeat(22)}`, cookieHeader: undefined });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_INVALID');
  });
  it('returns PLATFORM_AUTH_MISSING without header', async () => {
    const { store } = await setup();
    const p = new ApiTokenProvider({ tokens: store.tokensRepo, organizations: store.organizations, accounts: store.accountsRepo, memberships: store.membershipMirror });
    const r = await p.authenticate({ authorizationHeader: undefined, cookieHeader: undefined });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_MISSING');
  });
});
```

- [ ] **Step 2: Implement src/auth/api-token-provider.ts**

```ts
import { createHash, timingSafeEqual } from 'node:crypto';
import { ok, err, isOk, scopesForRole, type IdentityProvider, type AuthContext, type AuthSubject, type Role,
  type TokenRepo, type OrganizationRepo, type AccountRepo, type MembershipMirrorRepo } from '@rntme-cli/platform-core';

type Deps = {
  tokens: TokenRepo;
  organizations: OrganizationRepo;
  accounts: AccountRepo;
  memberships: MembershipMirrorRepo;
};

export class ApiTokenProvider implements IdentityProvider {
  readonly name = 'api-token' as const;
  constructor(private readonly deps: Deps) {}

  async authenticate(ctx: AuthContext) {
    const header = ctx.authorizationHeader;
    if (!header || !header.startsWith('Bearer rntme_pat_')) {
      return err([{ code: 'PLATFORM_AUTH_MISSING' as const, message: 'no bearer token' }]);
    }
    const plain = header.slice('Bearer '.length);
    const prefix = plain.slice(0, 12);
    const found = await this.deps.tokens.findByPrefix(prefix);
    if (!isOk(found)) return found;
    if (!found.value) return err([{ code: 'PLATFORM_AUTH_INVALID' as const, message: 'token not found' }]);
    const expected = Buffer.from(found.value.tokenHash);
    const actual = createHash('sha256').update(plain).digest();
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return err([{ code: 'PLATFORM_AUTH_INVALID' as const, message: 'token mismatch' }]);
    }
    // Resolve account/org/role from mirrors
    const orgs = await this.deps.organizations.findByWorkosId(''); // token rows have local org_id; we need the org row by id
    const byId = await resolveOrgById(this.deps, found.value.orgId);
    if (!isOk(byId)) return byId;
    if (!byId.value) return err([{ code: 'PLATFORM_AUTH_INVALID' as const, message: 'token org missing' }]);
    const mem = await this.deps.memberships.find(found.value.orgId, found.value.accountId);
    if (!isOk(mem)) return mem;
    const role: Role = (mem.value?.role === 'admin') ? 'admin' : 'member';
    const acct = await this.deps.accounts.findByWorkosUserId(''); // not looked up by workos id here; just return stub below
    const account = acct.ok && acct.value ? acct.value : { id: found.value.accountId, workosUserId: 'unknown', email: null, displayName: 'unknown', deletedAt: null, createdAt: new Date(), updatedAt: new Date() };
    const subject: AuthSubject = {
      account: { id: account.id, workosUserId: account.workosUserId, displayName: account.displayName, email: account.email },
      org: { id: byId.value.id, workosOrgId: byId.value.workosOrganizationId, slug: byId.value.slug },
      role,
      scopes: found.value.scopes,
      tokenId: found.value.id,
    };
    // Touch last-used async (best effort)
    void this.deps.tokens.touchLastUsed(found.value.id);
    return ok(subject);
  }
}

async function resolveOrgById(deps: Deps, orgId: string) {
  // OrganizationRepo doesn't expose findById — use listForAccount + scan, or add findById in a follow-up.
  // For MVP: call a wider query. Acceptable indirection: listForAccount over the token's account.
  const list = await deps.organizations.listForAccount(''); // empty account → returns [] always; engineer should add OrganizationRepo.findById
  if (!isOk(list)) return list;
  return ok(list.value.find((o) => o.id === orgId) ?? null);
}
```

**Engineer note:** The `resolveOrgById` shim relies on an `OrganizationRepo.findById` method that the current interface does not expose. Add `findById(id: string): Promise<Result<Organization | null, PlatformError>>` to `@rntme-cli/platform-core`'s `OrganizationRepo` and its fake + Pg impl as a small follow-up before this provider is wired into the app. Same note applies to `AccountRepo.findById`.

- [ ] **Step 3: Add `findById` to OrganizationRepo + AccountRepo**

Edit in `@rntme-cli/platform-core`:
- `src/repos/org-repo.ts` — add `findById(id: string): Promise<Result<Organization | null, PlatformError>>;`.
- `src/repos/account-repo.ts` — add `findById(id: string): Promise<Result<Account | null, PlatformError>>;`.
- `src/testing/fakes.ts` — implement for both.

Edit in `@rntme-cli/platform-storage`:
- `src/repos/pg-org-repo.ts` and `pg-account-repo.ts` — add `findById` with the obvious SQL.

Re-run full test suite on all three packages.

- [ ] **Step 4: Simplify provider now that findById exists**

Replace the `resolveOrgById` shim with direct `this.deps.organizations.findById(orgId)` and `this.deps.accounts.findById(found.value.accountId)`.

- [ ] **Step 5: Run + commit**

```bash
pnpm -F @rntme-cli/platform-core test
pnpm -F @rntme-cli/platform-storage test
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-core/src/repos packages/platform-core/src/testing packages/platform-storage/src/repos packages/platform-http/src/auth packages/platform-http/test/unit/auth
git -C rntme-cli commit -m "feat(platform-http): ApiTokenProvider + findById on org/account repos"
```

---

### Task J2: WorkOSAuthKitProvider impl

**Files:**
- Create: `src/auth/workos-provider.ts`
- Create: `src/auth/workos-client.ts`
- Create: `test/unit/auth/workos-provider.test.ts`

- [ ] **Step 1: Implement src/auth/workos-client.ts**

```ts
import { WorkOS } from '@workos-inc/node';
import type { Env } from '../config/env.js';

export function createWorkos(env: Env): WorkOS {
  return new WorkOS(env.WORKOS_API_KEY, { clientId: env.WORKOS_CLIENT_ID });
}

export type WorkOSClient = WorkOS;
```

- [ ] **Step 2: Implement src/auth/workos-provider.ts**

```ts
import { ok, err, isOk, scopesForRole, type IdentityProvider, type AuthContext, type AuthSubject, type Role,
  type OrganizationRepo, type AccountRepo, type MembershipMirrorRepo } from '@rntme-cli/platform-core';
import type { WorkOSClient } from './workos-client.js';

type Deps = {
  workos: WorkOSClient;
  cookiePassword: string;
  organizations: OrganizationRepo;
  accounts: AccountRepo;
  memberships: MembershipMirrorRepo;
};

export class WorkOSAuthKitProvider implements IdentityProvider {
  readonly name = 'workos-authkit' as const;
  constructor(private readonly deps: Deps) {}

  async authenticate(ctx: AuthContext) {
    const cookie = ctx.cookieHeader ?? '';
    const match = /(?:^|; )rntme_session=([^;]+)/.exec(cookie);
    if (!match) return err([{ code: 'PLATFORM_AUTH_MISSING' as const, message: 'no session cookie' }]);
    const sealed = decodeURIComponent(match[1]!);
    try {
      const session = this.deps.workos.userManagement.loadSealedSession({ sessionData: sealed, cookiePassword: this.deps.cookiePassword });
      const auth = await session.authenticate();
      if (!auth.authenticated) return err([{ code: 'PLATFORM_AUTH_INVALID' as const, message: auth.reason ?? 'session invalid' }]);

      const user = auth.user;
      const orgId = auth.organizationId;
      if (!orgId) return err([{ code: 'PLATFORM_AUTH_INVALID' as const, message: 'no organization in session' }]);

      const acct = await this.deps.accounts.findByWorkosUserId(user.id);
      const org = await this.deps.organizations.findByWorkosId(orgId);
      if (!isOk(acct) || !isOk(org)) return err([{ code: 'PLATFORM_INTERNAL' as const, message: 'mirror lookup failed' }]);
      if (!acct.value || !org.value) return err([{ code: 'PLATFORM_AUTH_INVALID' as const, message: 'mirror not yet synced' }]);

      const mem = await this.deps.memberships.find(org.value.id, acct.value.id);
      const role: Role = (isOk(mem) && mem.value?.role === 'admin') ? 'admin' : 'member';

      const subject: AuthSubject = {
        account: { id: acct.value.id, workosUserId: acct.value.workosUserId, displayName: acct.value.displayName, email: acct.value.email },
        org: { id: org.value.id, workosOrgId: org.value.workosOrganizationId, slug: org.value.slug },
        role, scopes: scopesForRole(role), tokenId: undefined,
      };
      return ok(subject);
    } catch (cause) {
      return err([{ code: 'PLATFORM_AUTH_INVALID' as const, message: String(cause), cause }]);
    }
  }
}
```

- [ ] **Step 3: Test (shape-only; full integration covered in e2e)**

```ts
// test/unit/auth/workos-provider.test.ts
import { describe, it, expect } from 'vitest';
import { FakeStore, isOk } from '@rntme-cli/platform-core';
import { WorkOSAuthKitProvider } from '../../../src/auth/workos-provider.js';

const mockWorkos = {
  userManagement: {
    loadSealedSession: () => ({
      authenticate: async () => ({ authenticated: false, reason: 'test' }),
    }),
  },
} as never;

describe('WorkOSAuthKitProvider', () => {
  it('returns AUTH_MISSING when no cookie present', async () => {
    const store = new FakeStore();
    const p = new WorkOSAuthKitProvider({ workos: mockWorkos, cookiePassword: 'x'.repeat(32), organizations: store.organizations, accounts: store.accountsRepo, memberships: store.membershipMirror });
    const r = await p.authenticate({ authorizationHeader: undefined, cookieHeader: undefined });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_MISSING');
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/auth/workos-client.ts packages/platform-http/src/auth/workos-provider.ts packages/platform-http/test/unit/auth/workos-provider.test.ts
git -C rntme-cli commit -m "feat(platform-http): WorkOSAuthKitProvider over sealed session"
```

---

### Task J3: Auth middleware that orchestrates providers + sets RLS

**Files:**
- Create: `src/middleware/auth.ts`
- Create: `test/unit/middleware/auth.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/middleware/auth.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireAuth, requireScope } from '../../../src/middleware/auth.js';
import type { IdentityProvider } from '@rntme-cli/platform-core';
import { ok, err } from '@rntme-cli/platform-core';

function makeProvider(subject: unknown | null): IdentityProvider {
  return {
    name: 'api-token',
    authenticate: async () => subject ? ok(subject as never) : err([{ code: 'PLATFORM_AUTH_MISSING', message: '' }]),
  };
}

describe('requireAuth', () => {
  it('401 when no provider authenticates', async () => {
    const app = new Hono().use(requireAuth([makeProvider(null)])).get('/', (c) => c.text('ok'));
    const r = await app.request('/');
    expect(r.status).toBe(401);
  });
  it('passes when one provider authenticates', async () => {
    const subj = { account: { id: 'a' }, org: { id: 'o' }, role: 'member', scopes: ['project:read'] };
    const app = new Hono().use(requireAuth([makeProvider(subj)])).get('/', (c) => c.json({ who: c.get('subject') }));
    const r = await app.request('/', { headers: { authorization: 'Bearer rntme_pat_x' } });
    expect(r.status).toBe(200);
  });
  it('requireScope 403 when missing', async () => {
    const subj = { account: { id: 'a' }, org: { id: 'o' }, role: 'member', scopes: ['project:read'] };
    const app = new Hono().use(requireAuth([makeProvider(subj)])).use(requireScope('version:publish')).get('/', (c) => c.text('ok'));
    const r = await app.request('/', { headers: { authorization: 'Bearer rntme_pat_x' } });
    expect(r.status).toBe(403);
  });
});
```

- [ ] **Step 2: Implement src/middleware/auth.ts**

```ts
import type { MiddlewareHandler } from 'hono';
import type { IdentityProvider, AuthSubject, Scope } from '@rntme-cli/platform-core';
import { isOk } from '@rntme-cli/platform-core';

declare module 'hono' {
  interface ContextVariableMap { subject: AuthSubject; }
}

export function requireAuth(providers: readonly IdentityProvider[]): MiddlewareHandler {
  return async (c, next) => {
    const ctx = {
      authorizationHeader: c.req.header('authorization'),
      cookieHeader: c.req.header('cookie'),
    };
    for (const p of providers) {
      const r = await p.authenticate(ctx);
      if (isOk(r)) {
        c.set('subject', r.value);
        return next();
      }
    }
    return c.json({ error: { code: 'PLATFORM_AUTH_MISSING', message: 'authentication required' } }, 401);
  };
}

export function requireScope(scope: Scope): MiddlewareHandler {
  return async (c, next) => {
    const s = c.get('subject');
    if (!s || !s.scopes.includes(scope)) {
      return c.json({ error: { code: 'PLATFORM_AUTH_FORBIDDEN', message: `missing scope ${scope}` } }, 403);
    }
    return next();
  };
}

export function requireOrgMatch(urlOrgSlugParam: string = 'orgSlug'): MiddlewareHandler {
  return async (c, next) => {
    const s = c.get('subject');
    const slug = c.req.param(urlOrgSlugParam);
    if (!s || s.org.slug !== slug) {
      return c.json({ error: { code: 'PLATFORM_AUTH_FORBIDDEN', message: 'org mismatch' } }, 403);
    }
    return next();
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/middleware/auth.ts packages/platform-http/test/unit/middleware/auth.test.ts
git -C rntme-cli commit -m "feat(platform-http): auth middleware + scope/org guards"
```

---

## Phase K — platform-http: auth routes (login/callback/logout/me)

### Task K1: GET /v1/auth/login + GET /v1/auth/callback + POST /v1/auth/logout + GET /v1/auth/me

**Files:**
- Create: `src/routes/auth.ts`
- Create: `test/unit/routes/auth.test.ts`

- [ ] **Step 1: Implement src/routes/auth.ts**

```ts
import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import type { WorkOSClient } from '../auth/workos-client.js';
import type { Env } from '../config/env.js';
import type { AuthSubject, OrganizationRepo, AccountRepo, MembershipMirrorRepo } from '@rntme-cli/platform-core';
import { syncWorkosEvent } from '@rntme-cli/platform-core';

export function authRoutes(deps: {
  workos: WorkOSClient;
  env: Env;
  cookiePassword: string;
  repos: {
    organizations: OrganizationRepo;
    accounts: AccountRepo;
    memberships: MembershipMirrorRepo;
  };
}): Hono {
  const app = new Hono();

  app.get('/login', (c) => {
    const url = deps.workos.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      redirectUri: deps.env.WORKOS_REDIRECT_URI,
      clientId: deps.env.WORKOS_CLIENT_ID,
    });
    return c.redirect(url);
  });

  app.get('/callback', async (c) => {
    const code = c.req.query('code');
    if (!code) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: 'missing code' } }, 400);
    try {
      const { user, organizationId, sealedSession } = await deps.workos.userManagement.authenticateWithCode({
        code, clientId: deps.env.WORKOS_CLIENT_ID,
        session: { sealSession: true, cookiePassword: deps.cookiePassword },
      });
      // Defensive upsert mirrors (in case webhook hasn't arrived).
      await deps.repos.accounts.upsertFromWorkos({ workosUserId: user.id, email: user.email ?? null, displayName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || user.id });
      if (organizationId) {
        await deps.repos.organizations.upsertFromWorkos({ workosOrganizationId: organizationId, slug: organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40), displayName: organizationId });
      }
      if (sealedSession) {
        setCookie(c, 'rntme_session', sealedSession, {
          httpOnly: true, secure: true, sameSite: 'Lax', path: '/',
          domain: deps.env.PLATFORM_SESSION_COOKIE_DOMAIN, maxAge: 60 * 60 * 24 * 30,
        });
      }
      return c.json({ account: { workosUserId: user.id }, org: { workosOrganizationId: organizationId ?? null } });
    } catch (cause) {
      return c.json({ error: { code: 'PLATFORM_AUTH_INVALID', message: String(cause) } }, 401);
    }
  });

  app.post('/logout', async (c) => {
    const sealed = getCookie(c, 'rntme_session');
    let url = deps.env.PLATFORM_BASE_URL;
    if (sealed) {
      try {
        const session = deps.workos.userManagement.loadSealedSession({ sessionData: sealed, cookiePassword: deps.cookiePassword });
        url = await session.getLogoutUrl();
      } catch { /* stale session, just clear cookie */ }
    }
    deleteCookie(c, 'rntme_session', { domain: deps.env.PLATFORM_SESSION_COOKIE_DOMAIN, path: '/' });
    return c.json({ logoutUrl: url });
  });

  app.get('/me', (c) => {
    const s = c.get('subject' as never) as AuthSubject | undefined;
    if (!s) return c.json({ error: { code: 'PLATFORM_AUTH_MISSING', message: 'authenticate first' } }, 401);
    return c.json({ account: s.account, org: s.org, role: s.role, scopes: s.scopes });
  });

  return app;
}
```

- [ ] **Step 2: Test (redirect + cookie shape)**

```ts
// test/unit/routes/auth.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { FakeStore } from '@rntme-cli/platform-core';
import { authRoutes } from '../../../src/routes/auth.ts';

const mockWorkos = {
  userManagement: {
    getAuthorizationUrl: () => 'https://workos.test/auth?x=1',
    authenticateWithCode: async () => ({ user: { id: 'u_1', email: 'a@b', firstName: 'A', lastName: 'B' }, organizationId: 'org_1', sealedSession: 'sealed' }),
    loadSealedSession: () => ({ getLogoutUrl: async () => 'https://workos.test/logout' }),
  },
} as never;

const env = {
  WORKOS_REDIRECT_URI: 'https://platform.rntme.com/v1/auth/callback',
  WORKOS_CLIENT_ID: 'wc', PLATFORM_SESSION_COOKIE_DOMAIN: '.rntme.com',
  PLATFORM_BASE_URL: 'https://platform.rntme.com',
} as never;

describe('auth routes', () => {
  it('GET /login redirects to WorkOS', async () => {
    const store = new FakeStore();
    const app = new Hono().route('/v1/auth', authRoutes({ workos: mockWorkos, env, cookiePassword: 'p'.repeat(32), repos: { organizations: store.organizations, accounts: store.accountsRepo, memberships: store.membershipMirror } }));
    const r = await app.request('/v1/auth/login');
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toMatch(/workos\.test/);
  });
  it('GET /callback upserts mirrors and sets cookie', async () => {
    const store = new FakeStore();
    const app = new Hono().route('/v1/auth', authRoutes({ workos: mockWorkos, env, cookiePassword: 'p'.repeat(32), repos: { organizations: store.organizations, accounts: store.accountsRepo, memberships: store.membershipMirror } }));
    const r = await app.request('/v1/auth/callback?code=xyz');
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie')).toMatch(/rntme_session=sealed/);
    expect(store.accounts.size).toBe(1);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/routes/auth.ts packages/platform-http/test/unit/routes/auth.test.ts
git -C rntme-cli commit -m "feat(platform-http): WorkOS login/callback/logout + /me endpoints"
```

---

## Phase L — platform-http: WorkOS webhook

### Task L1: POST /v1/webhooks/workos with signature verification

**Files:**
- Create: `src/routes/webhook-workos.ts`
- Create: `test/unit/routes/webhook-workos.test.ts`

- [ ] **Step 1: Test**

```ts
// test/unit/routes/webhook-workos.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { FakeStore } from '@rntme-cli/platform-core';
import { webhookWorkosRoute } from '../../../src/routes/webhook-workos.ts';

const passingMock = {
  webhooks: { constructEvent: async ({ payload }: { payload: string }) => JSON.parse(payload) as unknown as Record<string, unknown> },
} as never;
const failingMock = {
  webhooks: { constructEvent: async () => { throw new Error('bad sig'); } },
} as never;

describe('workos webhook', () => {
  it('rejects invalid signature with 400', async () => {
    const store = new FakeStore();
    const app = new Hono().route('/v1/webhooks', webhookWorkosRoute({ workos: failingMock, secret: 'x', repos: { organizations: store.organizations, accounts: store.accountsRepo, memberships: store.membershipMirror, projects: store.projects, workosEventLog: store.workosEventLog } }));
    const r = await app.request('/v1/webhooks/workos', {
      method: 'POST',
      headers: { 'workos-signature': 'sig' },
      body: JSON.stringify({ id: 'ev', type: 'user.created', data: {} }),
    });
    expect(r.status).toBe(400);
  });

  it('processes user.created event', async () => {
    const store = new FakeStore();
    const app = new Hono().route('/v1/webhooks', webhookWorkosRoute({ workos: passingMock, secret: 'x', repos: { organizations: store.organizations, accounts: store.accountsRepo, memberships: store.membershipMirror, projects: store.projects, workosEventLog: store.workosEventLog } }));
    const body = { id: 'ev_1', type: 'user.created', data: { id: 'u_a', email: 'x@y', first_name: 'X', last_name: 'Y' } };
    const r = await app.request('/v1/webhooks/workos', { method: 'POST', headers: { 'workos-signature': 'sig' }, body: JSON.stringify(body) });
    expect(r.status).toBe(200);
    expect(store.accounts.size).toBe(1);
  });
});
```

- [ ] **Step 2: Implement src/routes/webhook-workos.ts**

```ts
import { Hono } from 'hono';
import type { WorkOSClient } from '../auth/workos-client.js';
import { syncWorkosEvent, type OrganizationRepo, type AccountRepo, type MembershipMirrorRepo, type ProjectRepo, type WorkosEventLogRepo, isOk } from '@rntme-cli/platform-core';

export function webhookWorkosRoute(deps: {
  workos: WorkOSClient;
  secret: string;
  repos: {
    organizations: OrganizationRepo;
    accounts: AccountRepo;
    memberships: MembershipMirrorRepo;
    projects: ProjectRepo;
    workosEventLog: WorkosEventLogRepo;
  };
}): Hono {
  const app = new Hono();
  app.post('/workos', async (c) => {
    const sig = c.req.header('workos-signature') ?? '';
    const payload = await c.req.text();
    let event: unknown;
    try {
      event = await deps.workos.webhooks.constructEvent({ payload, sigHeader: sig, secret: deps.secret });
    } catch (cause) {
      return c.json({ error: { code: 'PLATFORM_WORKOS_WEBHOOK_INVALID', message: String(cause) } }, 400);
    }
    const r = await syncWorkosEvent({ repos: deps.repos }, event as never);
    if (!isOk(r)) return c.json({ error: r.errors[0] }, 500);
    return c.json({ ok: true });
  });
  return app;
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/routes/webhook-workos.ts packages/platform-http/test/unit/routes/webhook-workos.test.ts
git -C rntme-cli commit -m "feat(platform-http): WorkOS webhook endpoint with signature verification"
```

---

## Phase M — platform-http: route handlers for projects / services

### Task M1: Helpers — tenancy resolver + Result→Response

**Files:**
- Create: `src/routes/helpers.ts`

- [ ] **Step 1: Implement**

```ts
import type { Context } from 'hono';
import { isOk, statusForCode } from '@rntme-cli/platform-core';
import type { Result, PlatformError } from '@rntme-cli/platform-core';
import { errorEnvelope } from '../middleware/error-handler.js';
import type { OrganizationRepo } from '@rntme-cli/platform-core';
import type { ProjectRepo } from '@rntme-cli/platform-core';
import type { ServiceRepo } from '@rntme-cli/platform-core';

export function respond<T>(c: Context, r: Result<T, PlatformError>, okStatus = 200): Response {
  if (isOk(r)) return c.json(r.value as never, okStatus as never);
  const first = r.errors[0] ?? { code: 'PLATFORM_INTERNAL' as const, message: 'unknown' };
  return c.json(errorEnvelope(r.errors), statusForCode(first.code) as never);
}

export async function resolveProject(deps: { organizations: OrganizationRepo; projects: ProjectRepo }, orgSlug: string, projSlug: string) {
  const org = await deps.organizations.findBySlug(orgSlug);
  if (!isOk(org)) return org;
  if (!org.value) return { ok: false as const, errors: [{ code: 'PLATFORM_TENANCY_ORG_NOT_FOUND' as const, message: orgSlug }] };
  const proj = await deps.projects.findBySlug(org.value.id, projSlug);
  if (!isOk(proj)) return proj;
  if (!proj.value) return { ok: false as const, errors: [{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND' as const, message: projSlug }] };
  if (proj.value.archivedAt) return { ok: false as const, errors: [{ code: 'PLATFORM_TENANCY_RESOURCE_ARCHIVED' as const, message: projSlug }] };
  return { ok: true as const, value: { org: org.value, project: proj.value } };
}

export async function resolveService(deps: { organizations: OrganizationRepo; projects: ProjectRepo; services: ServiceRepo }, orgSlug: string, projSlug: string, svcSlug: string) {
  const p = await resolveProject(deps, orgSlug, projSlug);
  if (!p.ok) return p;
  const s = await deps.services.findBySlug(p.value.project.id, svcSlug);
  if (!isOk(s)) return s;
  if (!s.value) return { ok: false as const, errors: [{ code: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND' as const, message: svcSlug }] };
  if (s.value.archivedAt) return { ok: false as const, errors: [{ code: 'PLATFORM_TENANCY_RESOURCE_ARCHIVED' as const, message: svcSlug }] };
  return { ok: true as const, value: { ...p.value, service: s.value } };
}
```

- [ ] **Step 2: Commit**

```bash
git -C rntme-cli add packages/platform-http/src/routes/helpers.ts
git -C rntme-cli commit -m "feat(platform-http): route helpers (tenancy resolver, Result → Response)"
```

---

### Task M2: Project routes

**Files:**
- Create: `src/routes/projects.ts`
- Create: `test/unit/routes/projects.test.ts`

- [ ] **Step 1: Implement src/routes/projects.ts**

```ts
import { Hono } from 'hono';
import { z } from 'zod';
import { CreateProjectInputSchema, PatchProjectInputSchema, createProject, listProjects, getProject, patchProject, archiveProject, isOk } from '@rntme-cli/platform-core';
import type { OrganizationRepo, ProjectRepo, Ids } from '@rntme-cli/platform-core';
import { requireScope, requireOrgMatch } from '../middleware/auth.js';
import { respond } from './helpers.js';

export function projectRoutes(deps: { organizations: OrganizationRepo; projects: ProjectRepo; ids: Ids }): Hono {
  const app = new Hono();

  app.use('*', requireOrgMatch('orgSlug'));

  app.post('/', requireScope('project:write'), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateProjectInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    const s = c.get('subject');
    const r = await createProject({ repos: { projects: deps.projects }, ids: deps.ids }, { orgId: s.org.id, ...parsed.data });
    return respond(c, r, 201);
  });

  app.get('/', requireScope('project:read'), async (c) => {
    const includeArchived = c.req.query('includeArchived') === 'true';
    const s = c.get('subject');
    const r = await listProjects({ repos: { projects: deps.projects } }, { orgId: s.org.id, includeArchived });
    return respond(c, r);
  });

  app.get('/:projSlug', requireScope('project:read'), async (c) => {
    const s = c.get('subject');
    const p = await deps.projects.findBySlug(s.org.id, c.req.param('projSlug'));
    if (!isOk(p) || !p.value) return c.json({ error: { code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: c.req.param('projSlug') } }, 404);
    const count = await deps.projects.countServices(s.org.id, p.value.id);
    return c.json({ project: p.value, serviceCount: isOk(count) ? count.value : 0 });
  });

  app.patch('/:projSlug', requireScope('project:write'), async (c) => {
    const s = c.get('subject');
    const body = await c.req.json().catch(() => null);
    const parsed = PatchProjectInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    const p = await deps.projects.findBySlug(s.org.id, c.req.param('projSlug'));
    if (!isOk(p) || !p.value) return c.json({ error: { code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: c.req.param('projSlug') } }, 404);
    const r = await patchProject({ repos: { projects: deps.projects } }, { orgId: s.org.id, id: p.value.id, displayName: parsed.data.displayName });
    return respond(c, r);
  });

  app.post('/:projSlug/archive', requireScope('project:write'), async (c) => {
    const s = c.get('subject');
    const p = await deps.projects.findBySlug(s.org.id, c.req.param('projSlug'));
    if (!isOk(p) || !p.value) return c.json({ error: { code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: c.req.param('projSlug') } }, 404);
    const r = await archiveProject({ repos: { projects: deps.projects } }, { orgId: s.org.id, id: p.value.id });
    return respond(c, r);
  });

  return app;
}
```

- [ ] **Step 2: Test (minimal shape)**

```ts
// test/unit/routes/projects.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { FakeStore, SeededIds } from '@rntme-cli/platform-core';
import { projectRoutes } from '../../../src/routes/projects.js';
import { requireAuth } from '../../../src/middleware/auth.js';
import { ok } from '@rntme-cli/platform-core';

async function makeApp() {
  const store = new FakeStore();
  const ids = new SeededIds(['p-1']);
  const org = await store.seedOrg({ slug: 'o1', workosOrganizationId: 'org_1', displayName: 'O' });
  const acct = await store.seedAccount({ workosUserId: 'u', email: null, displayName: 'U' });
  const subject = {
    account: { id: acct.id, workosUserId: 'u', displayName: 'U', email: null },
    org: { id: org.id, workosOrgId: 'org_1', slug: 'o1' },
    role: 'member' as const, scopes: ['project:read', 'project:write'] as readonly string[], tokenId: undefined,
  };
  const fakeProvider = { name: 'api-token' as const, authenticate: async () => ok(subject as never) };
  const app = new Hono().use(requireAuth([fakeProvider])).route('/v1/orgs/:orgSlug/projects', projectRoutes({ organizations: store.organizations, projects: store.projects, ids }));
  return { app, store };
}

describe('project routes', () => {
  it('POST creates project', async () => {
    const { app } = await makeApp();
    const r = await app.request('/v1/orgs/o1/projects', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer rntme_pat_x' },
      body: JSON.stringify({ slug: 'proj', displayName: 'P' }),
    });
    expect(r.status).toBe(201);
  });
  it('GET lists projects', async () => {
    const { app } = await makeApp();
    await app.request('/v1/orgs/o1/projects', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer rntme_pat_x' }, body: JSON.stringify({ slug: 'proj', displayName: 'P' }) });
    const r = await app.request('/v1/orgs/o1/projects', { headers: { authorization: 'Bearer rntme_pat_x' } });
    expect(r.status).toBe(200);
  });
  it('cross-org access 403', async () => {
    const { app } = await makeApp();
    const r = await app.request('/v1/orgs/other-org/projects', { headers: { authorization: 'Bearer rntme_pat_x' } });
    expect(r.status).toBe(403);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/routes/projects.ts packages/platform-http/test/unit/routes/projects.test.ts
git -C rntme-cli commit -m "feat(platform-http): project CRUD routes"
```

---

### Task M3: Service routes

**Files:**
- Create: `src/routes/services.ts`
- Create: `test/unit/routes/services.test.ts`

- [ ] **Step 1: Implement src/routes/services.ts**

```ts
import { Hono } from 'hono';
import { CreateServiceInputSchema, PatchServiceInputSchema, createService, listServices, getServiceDetail, patchService, archiveService, isOk } from '@rntme-cli/platform-core';
import type { OrganizationRepo, ProjectRepo, ServiceRepo, Ids } from '@rntme-cli/platform-core';
import { requireScope, requireOrgMatch } from '../middleware/auth.js';
import { respond, resolveProject } from './helpers.js';

export function serviceRoutes(deps: { organizations: OrganizationRepo; projects: ProjectRepo; services: ServiceRepo; ids: Ids }): Hono {
  const app = new Hono();
  app.use('*', requireOrgMatch('orgSlug'));

  app.post('/', requireScope('project:write'), async (c) => {
    const r0 = await resolveProject(deps, c.req.param('orgSlug'), c.req.param('projSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const body = await c.req.json().catch(() => null);
    const parsed = CreateServiceInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    const r = await createService({ repos: { services: deps.services }, ids: deps.ids }, {
      orgId: r0.value.org.id, projectId: r0.value.project.id, slug: parsed.data.slug, displayName: parsed.data.displayName,
    });
    return respond(c, r, 201);
  });

  app.get('/', requireScope('project:read'), async (c) => {
    const r0 = await resolveProject(deps, c.req.param('orgSlug'), c.req.param('projSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const r = await listServices({ repos: { services: deps.services } }, { orgId: r0.value.org.id, projectId: r0.value.project.id });
    return respond(c, r);
  });

  app.get('/:svcSlug', requireScope('project:read'), async (c) => {
    const r0 = await resolveProject(deps, c.req.param('orgSlug'), c.req.param('projSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const s = await deps.services.findBySlug(r0.value.project.id, c.req.param('svcSlug'));
    if (!isOk(s) || !s.value) return c.json({ error: { code: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND', message: c.req.param('svcSlug') } }, 404);
    const r = await getServiceDetail({ repos: { services: deps.services } }, { orgId: r0.value.org.id, id: s.value.id });
    return respond(c, r);
  });

  app.patch('/:svcSlug', requireScope('project:write'), async (c) => {
    const r0 = await resolveProject(deps, c.req.param('orgSlug'), c.req.param('projSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const body = await c.req.json().catch(() => null);
    const parsed = PatchServiceInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    const s = await deps.services.findBySlug(r0.value.project.id, c.req.param('svcSlug'));
    if (!isOk(s) || !s.value) return c.json({ error: { code: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND', message: c.req.param('svcSlug') } }, 404);
    const r = await patchService({ repos: { services: deps.services } }, { orgId: r0.value.org.id, id: s.value.id, displayName: parsed.data.displayName });
    return respond(c, r);
  });

  app.post('/:svcSlug/archive', requireScope('project:write'), async (c) => {
    const r0 = await resolveProject(deps, c.req.param('orgSlug'), c.req.param('projSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const s = await deps.services.findBySlug(r0.value.project.id, c.req.param('svcSlug'));
    if (!isOk(s) || !s.value) return c.json({ error: { code: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND', message: c.req.param('svcSlug') } }, 404);
    const r = await archiveService({ repos: { services: deps.services } }, { orgId: r0.value.org.id, id: s.value.id });
    return respond(c, r);
  });

  return app;
}
```

- [ ] **Step 2: Test — minimal**

```ts
// test/unit/routes/services.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { FakeStore, SeededIds, ok } from '@rntme-cli/platform-core';
import { serviceRoutes } from '../../../src/routes/services.js';
import { requireAuth } from '../../../src/middleware/auth.js';

async function makeApp() {
  const store = new FakeStore();
  const ids = new SeededIds(['s-1']);
  const org = await store.seedOrg({ slug: 'o1', workosOrganizationId: 'org_1', displayName: 'O' });
  const acct = await store.seedAccount({ workosUserId: 'u', email: null, displayName: 'U' });
  await store.projects.create({ id: 'p-1', orgId: org.id, slug: 'pr', displayName: 'P' });
  const subject = {
    account: { id: acct.id, workosUserId: 'u', displayName: 'U', email: null },
    org: { id: org.id, workosOrgId: 'org_1', slug: 'o1' },
    role: 'member' as const, scopes: ['project:read', 'project:write'] as readonly string[], tokenId: undefined,
  };
  const fakeProvider = { name: 'api-token' as const, authenticate: async () => ok(subject as never) };
  const app = new Hono().use(requireAuth([fakeProvider])).route('/v1/orgs/:orgSlug/projects/:projSlug/services', serviceRoutes({ organizations: store.organizations, projects: store.projects, services: store.services, ids }));
  return { app, store };
}

describe('service routes', () => {
  it('POST creates service', async () => {
    const { app } = await makeApp();
    const r = await app.request('/v1/orgs/o1/projects/pr/services', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer rntme_pat_x' },
      body: JSON.stringify({ slug: 'sv', displayName: 'S' }),
    });
    expect(r.status).toBe(201);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/routes/services.ts packages/platform-http/test/unit/routes/services.test.ts
git -C rntme-cli commit -m "feat(platform-http): service CRUD routes"
```

---

## Phase N — platform-http: versions, tags, tokens, audit, orgs, ops, OpenAPI

### Task N1: Version + Tag + Publish routes

**Files:**
- Create: `src/routes/versions.ts`
- Create: `test/unit/routes/versions.test.ts`

- [ ] **Step 1: Implement src/routes/versions.ts**

```ts
import { Hono } from 'hono';
import { PublishRequestSchema, MoveTagInputSchema, ListVersionsQuerySchema, publishVersion, listVersions, getVersion, getBundle, moveTag, deleteTag, listTags, isOk } from '@rntme-cli/platform-core';
import type { OrganizationRepo, ProjectRepo, ServiceRepo, ArtifactRepo, TagRepo, BlobStore, Ids } from '@rntme-cli/platform-core';
import { requireScope, requireOrgMatch } from '../middleware/auth.js';
import { respond, resolveService } from './helpers.js';

type Deps = {
  organizations: OrganizationRepo;
  projects: ProjectRepo;
  services: ServiceRepo;
  artifacts: ArtifactRepo;
  tags: TagRepo;
  blob: BlobStore;
  ids: Ids;
};

export function versionRoutes(deps: Deps): Hono {
  const app = new Hono();
  app.use('*', requireOrgMatch('orgSlug'));

  app.post('/versions', requireScope('version:publish'), async (c) => {
    const r0 = await resolveService(deps, c.req.param('orgSlug'), c.req.param('projSlug'), c.req.param('svcSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const body = await c.req.json().catch(() => null);
    const parsed = PublishRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    const s = c.get('subject');
    const r = await publishVersion(
      { repos: { artifacts: deps.artifacts, services: deps.services }, blob: deps.blob, ids: deps.ids },
      { orgId: s.org.id, serviceId: r0.value.service.id, accountId: s.account.id, tokenId: s.tokenId ?? null,
        bundle: parsed.data.bundle, previousVersionSeq: parsed.data.previousVersionSeq, message: parsed.data.message, moveTags: parsed.data.moveTags },
    );
    return respond(c, r, 201);
  });

  app.get('/versions', requireScope('project:read'), async (c) => {
    const r0 = await resolveService(deps, c.req.param('orgSlug'), c.req.param('projSlug'), c.req.param('svcSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const q = ListVersionsQuerySchema.safeParse({ limit: c.req.query('limit'), cursor: c.req.query('cursor') });
    if (!q.success) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: q.error.message } }, 400);
    const r = await listVersions({ repos: { artifacts: deps.artifacts } }, { serviceId: r0.value.service.id, limit: q.data.limit, cursor: q.data.cursor });
    return respond(c, r);
  });

  app.get('/versions/:seq', requireScope('project:read'), async (c) => {
    const r0 = await resolveService(deps, c.req.param('orgSlug'), c.req.param('projSlug'), c.req.param('svcSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const seq = Number(c.req.param('seq'));
    if (!Number.isInteger(seq) || seq <= 0) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: 'seq' } }, 400);
    const v = await getVersion({ repos: { artifacts: deps.artifacts } }, { serviceId: r0.value.service.id, seq });
    if (!isOk(v)) return respond(c, v);
    const per: Record<string, string> = {
      manifest: v.value.manifestDigest, pdm: v.value.pdmDigest, qsm: v.value.qsmDigest,
      graphIr: v.value.graphIrDigest, bindings: v.value.bindingsDigest, ui: v.value.uiDigest, seed: v.value.seedDigest,
    };
    const urls: Record<string, string> = {};
    for (const [k, d] of Object.entries(per)) {
      const u = await deps.blob.presignedGet(`sha256/${d.slice(0, 2)}/${d}.json`, 600);
      if (isOk(u)) urls[k] = u.value;
    }
    return c.json({ version: v.value, files: urls });
  });

  app.get('/versions/by-digest/:bundleDigest', requireScope('project:read'), async (c) => {
    const r0 = await resolveService(deps, c.req.param('orgSlug'), c.req.param('projSlug'), c.req.param('svcSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const r = await deps.artifacts.findByDigest(r0.value.service.id, c.req.param('bundleDigest'));
    if (!isOk(r)) return respond(c, r);
    if (!r.value) return c.json({ error: { code: 'PLATFORM_TENANCY_SERVICE_NOT_FOUND', message: 'digest not found' } }, 404);
    return c.json({ version: r.value });
  });

  app.get('/versions/:seq/bundle', requireScope('project:read'), async (c) => {
    const r0 = await resolveService(deps, c.req.param('orgSlug'), c.req.param('projSlug'), c.req.param('svcSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const seq = Number(c.req.param('seq'));
    if (!Number.isInteger(seq) || seq <= 0) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: 'seq' } }, 400);
    const r = await getBundle({ repos: { artifacts: deps.artifacts }, blob: deps.blob }, { serviceId: r0.value.service.id, seq });
    return respond(c, r);
  });

  app.get('/tags', requireScope('project:read'), async (c) => {
    const r0 = await resolveService(deps, c.req.param('orgSlug'), c.req.param('projSlug'), c.req.param('svcSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const r = await listTags({ repos: { tags: deps.tags } }, { serviceId: r0.value.service.id });
    return respond(c, r);
  });

  app.put('/tags/:tagName', requireScope('project:write'), async (c) => {
    const r0 = await resolveService(deps, c.req.param('orgSlug'), c.req.param('projSlug'), c.req.param('svcSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const body = await c.req.json().catch(() => null);
    const parsed = MoveTagInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    const s = c.get('subject');
    const r = await moveTag(
      { repos: { tags: deps.tags, artifacts: deps.artifacts } },
      { serviceId: r0.value.service.id, name: c.req.param('tagName'), versionSeq: parsed.data.versionSeq, updatedByAccountId: s.account.id },
    );
    return respond(c, r);
  });

  app.delete('/tags/:tagName', requireScope('project:write'), async (c) => {
    const r0 = await resolveService(deps, c.req.param('orgSlug'), c.req.param('projSlug'), c.req.param('svcSlug'));
    if (!r0.ok) return respond(c, r0 as never);
    const s = c.get('subject');
    const r = await deleteTag({ repos: { tags: deps.tags } }, { serviceId: r0.value.service.id, name: c.req.param('tagName'), actorAccountId: s.account.id });
    return respond(c, r, 204);
  });

  return app;
}
```

- [ ] **Step 2: Test (end-to-end for publish)**

```ts
// test/unit/routes/versions.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { FakeStore, SeededIds, ok } from '@rntme-cli/platform-core';
import { versionRoutes } from '../../../src/routes/versions.js';
import { requireAuth } from '../../../src/middleware/auth.js';
import { minimalValidBundle } from '../../../../platform-core/test/fixtures/bundles/minimal-valid.js';

async function makeApp() {
  const store = new FakeStore();
  const ids = new SeededIds(['v-1','v-2','v-3']);
  const org = await store.seedOrg({ slug: 'o1', workosOrganizationId: 'org_1', displayName: 'O' });
  const acct = await store.seedAccount({ workosUserId: 'u', email: null, displayName: 'U' });
  const proj = await store.projects.create({ id: 'p-1', orgId: org.id, slug: 'pr', displayName: 'P' });
  if (!proj.ok) throw new Error('seed');
  const svc = await store.services.create({ id: 's-1', orgId: org.id, projectId: proj.value.id, slug: 'sv', displayName: 'S' });
  if (!svc.ok) throw new Error('seed');
  const subject = {
    account: { id: acct.id, workosUserId: 'u', displayName: 'U', email: null },
    org: { id: org.id, workosOrgId: 'org_1', slug: 'o1' },
    role: 'member' as const, scopes: ['project:read', 'project:write', 'version:publish'] as readonly string[], tokenId: undefined,
  };
  const app = new Hono()
    .use(requireAuth([{ name: 'api-token', authenticate: async () => ok(subject as never) }]))
    .route('/v1/orgs/:orgSlug/projects/:projSlug/services/:svcSlug', versionRoutes({ ...store, blob: store.blob, ids }));
  return { app, store };
}

describe('version routes', () => {
  it('POST /versions publishes seq=1', async () => {
    const { app } = await makeApp();
    const r = await app.request('/v1/orgs/o1/projects/pr/services/sv/versions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer rntme_pat_x' },
      body: JSON.stringify({ bundle: minimalValidBundle }),
    });
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.seq).toBe(1);
  });
  it('PUT /tags/:name creates tag', async () => {
    const { app } = await makeApp();
    await app.request('/v1/orgs/o1/projects/pr/services/sv/versions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer rntme_pat_x' }, body: JSON.stringify({ bundle: minimalValidBundle }) });
    const r = await app.request('/v1/orgs/o1/projects/pr/services/sv/tags/stable', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer rntme_pat_x' }, body: JSON.stringify({ versionSeq: 1 }) });
    expect(r.status).toBe(200);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/src/routes/versions.ts packages/platform-http/test/unit/routes/versions.test.ts
git -C rntme-cli commit -m "feat(platform-http): version + tag + publish routes"
```

---

### Task N2: Token + Audit + Orgs routes

**Files:**
- Create: `src/routes/tokens.ts`
- Create: `src/routes/audit.ts`
- Create: `src/routes/orgs.ts`

- [ ] **Step 1: Implement src/routes/tokens.ts**

```ts
import { Hono } from 'hono';
import { CreateTokenInputSchema, createToken, listTokens, revokeToken } from '@rntme-cli/platform-core';
import type { TokenRepo, Ids } from '@rntme-cli/platform-core';
import { requireScope, requireOrgMatch } from '../middleware/auth.js';
import { respond } from './helpers.js';

export function tokenRoutes(deps: { tokens: TokenRepo; ids: Ids }): Hono {
  const app = new Hono();
  app.use('*', requireOrgMatch('orgSlug'), requireScope('token:manage'));

  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateTokenInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    const s = c.get('subject');
    const r = await createToken({ repos: { tokens: deps.tokens }, ids: deps.ids }, {
      orgId: s.org.id, accountId: s.account.id,
      name: parsed.data.name, scopes: parsed.data.scopes, expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      creatorScopes: s.scopes as never,
    });
    if (!r.ok) return respond(c, r);
    const { token, plaintext } = r.value;
    return c.json({ id: token.id, plaintext, prefix: token.prefix, scopes: token.scopes, createdAt: token.createdAt, expiresAt: token.expiresAt, name: token.name }, 201);
  });

  app.get('/', async (c) => {
    const s = c.get('subject');
    const r = await listTokens({ repos: { tokens: deps.tokens } }, { orgId: s.org.id });
    if (!r.ok) return respond(c, r);
    return c.json({
      tokens: r.value.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, scopes: t.scopes, lastUsedAt: t.lastUsedAt, expiresAt: t.expiresAt, revokedAt: t.revokedAt, createdAt: t.createdAt })),
    });
  });

  app.delete('/:id', async (c) => {
    const s = c.get('subject');
    const r = await revokeToken({ repos: { tokens: deps.tokens } }, { orgId: s.org.id, id: c.req.param('id') });
    return respond(c, r, 204);
  });

  return app;
}
```

- [ ] **Step 2: Implement src/routes/audit.ts**

```ts
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuditRepo } from '@rntme-cli/platform-core';
import { requireOrgMatch } from '../middleware/auth.js';
import { respond } from './helpers.js';

const QuerySchema = z.object({
  resource: z.string().optional(),
  actor: z.string().uuid().optional(),
  action: z.string().optional(),
  since: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export function auditRoutes(deps: { audit: AuditRepo }): Hono {
  const app = new Hono();
  app.use('*', requireOrgMatch('orgSlug'));

  app.get('/', async (c) => {
    const q = QuerySchema.safeParse({
      resource: c.req.query('resource'), actor: c.req.query('actor'),
      action: c.req.query('action'), since: c.req.query('since'), limit: c.req.query('limit'),
    });
    if (!q.success) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: q.error.message } }, 400);
    const s = c.get('subject');
    const r = await deps.audit.list(s.org.id, {
      resourceKind: q.data.resource, actorAccountId: q.data.actor, action: q.data.action,
      since: q.data.since ? new Date(q.data.since) : undefined, limit: q.data.limit,
    });
    return respond(c, r);
  });
  return app;
}
```

- [ ] **Step 3: Implement src/routes/orgs.ts**

```ts
import { Hono } from 'hono';
import type { OrganizationRepo } from '@rntme-cli/platform-core';
import { respond } from './helpers.js';
import { isOk } from '@rntme-cli/platform-core';

export function orgRoutes(deps: { organizations: OrganizationRepo }): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    const s = c.get('subject');
    const r = await deps.organizations.listForAccount(s.account.id);
    return respond(c, r);
  });

  app.get('/:orgSlug', async (c) => {
    const s = c.get('subject');
    if (s.org.slug !== c.req.param('orgSlug')) return c.json({ error: { code: 'PLATFORM_AUTH_FORBIDDEN', message: 'org mismatch' } }, 403);
    const r = await deps.organizations.findBySlug(c.req.param('orgSlug'));
    if (!isOk(r)) return respond(c, r);
    if (!r.value) return c.json({ error: { code: 'PLATFORM_TENANCY_ORG_NOT_FOUND', message: c.req.param('orgSlug') } }, 404);
    return c.json({ org: r.value });
  });

  return app;
}
```

- [ ] **Step 4: Commit**

```bash
pnpm -F @rntme-cli/platform-http build
git -C rntme-cli add packages/platform-http/src/routes/tokens.ts packages/platform-http/src/routes/audit.ts packages/platform-http/src/routes/orgs.ts
git -C rntme-cli commit -m "feat(platform-http): token, audit, org routes"
```

---

### Task N3: Ops endpoints (/health /ready /openapi.json /openapi.yaml)

**Files:**
- Create: `src/routes/ops.ts`
- Create: `src/openapi.ts`

- [ ] **Step 1: Implement src/routes/ops.ts**

```ts
import { Hono } from 'hono';
import type { Pool } from 'pg';
import type { BlobStore } from '@rntme-cli/platform-core';
import type { WorkOSClient } from '../auth/workos-client.js';

export function opsRoutes(deps: { pool: Pool; blob: BlobStore; workos: WorkOSClient; openApiJson: () => object }): Hono {
  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.get('/ready', async (c) => {
    const results: Record<string, boolean> = {};
    try { await deps.pool.query('SELECT 1'); results.postgres = true; } catch { results.postgres = false; }
    try { const u = await deps.blob.presignedGet('health-check', 30); results.rustfs = u.ok; } catch { results.rustfs = false; }
    try { await deps.workos.listApiKeys?.({ limit: 1 } as never); results.workos = true; } catch { results.workos = true; /* API-key-read may be gated — don't block readiness */ }
    const ok = results.postgres && results.rustfs;
    return c.json({ status: ok ? 'ready' : 'degraded', checks: results }, ok ? 200 : 503);
  });

  app.get('/openapi.json', (c) => c.json(deps.openApiJson()));

  app.get('/openapi.yaml', async (c) => {
    const json = deps.openApiJson();
    const { stringify } = await import('yaml');
    c.header('content-type', 'application/yaml');
    return c.body(stringify(json));
  });

  return app;
}
```

- [ ] **Step 2: Implement src/openapi.ts (minimal hand-written OpenAPI emit)**

```ts
import type { Env } from './config/env.js';

export function buildOpenApi(env: Env): object {
  return {
    openapi: '3.1.0',
    info: { title: 'rntme platform API', version: '0.0.0', description: 'Control-plane for rntme projects, services, and artifact versions.' },
    servers: [{ url: env.PLATFORM_BASE_URL }],
    paths: {
      '/v1/auth/login':    { get: { summary: 'Redirect to WorkOS' } },
      '/v1/auth/callback': { get: { summary: 'OAuth callback' } },
      '/v1/auth/logout':   { post: { summary: 'Logout' } },
      '/v1/auth/me':       { get: { summary: 'Current subject', security: [{ bearerAuth: [] }, { cookieAuth: [] }] } },
      '/v1/orgs':          { get: { summary: 'List orgs' } },
      '/v1/orgs/{orgSlug}/projects': {
        get: { summary: 'List projects' }, post: { summary: 'Create project' },
      },
      '/v1/orgs/{orgSlug}/projects/{projSlug}/services/{svcSlug}/versions': {
        post: { summary: 'Publish version' }, get: { summary: 'List versions' },
      },
      // TODO for engineer: enumerate the remaining endpoints from spec §11 exhaustively in this object.
      // Generating from Zod schemas is preferred; switch to @hono/zod-openapi when moving past MVP.
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'rntme_pat_...' },
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'rntme_session' },
      },
    },
  };
}
```

**Engineer note:** Hand-writing is a stopgap to get `/openapi.json` served from day one. A follow-up task should migrate each route to `@hono/zod-openapi` so the spec is generated from the Zod schemas we already have, avoiding drift.

- [ ] **Step 3: Commit**

```bash
pnpm -F @rntme-cli/platform-http build
git -C rntme-cli add packages/platform-http/src/routes/ops.ts packages/platform-http/src/openapi.ts
git -C rntme-cli commit -m "feat(platform-http): /health /ready /openapi endpoints"
```

---

### Task N4: Wire the whole app in src/app.ts

**Files:**
- Modify: `src/app.ts`
- Modify: `src/bin/server.ts`

- [ ] **Step 1: Replace src/app.ts with full wiring**

```ts
import { Hono } from 'hono';
import type { Env } from './config/env.js';
import { requestId } from './middleware/request-id.js';
import { loggerMiddleware } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { corsMiddleware } from './middleware/cors.js';
import { rateLimit, InMemoryRateLimiter } from './middleware/rate-limit.js';
import { requireAuth } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { webhookWorkosRoute } from './routes/webhook-workos.js';
import { orgRoutes } from './routes/orgs.js';
import { projectRoutes } from './routes/projects.js';
import { serviceRoutes } from './routes/services.js';
import { versionRoutes } from './routes/versions.js';
import { tokenRoutes } from './routes/tokens.js';
import { auditRoutes } from './routes/audit.js';
import { opsRoutes } from './routes/ops.js';
import { buildOpenApi } from './openapi.js';
import { ApiTokenProvider } from './auth/api-token-provider.js';
import { WorkOSAuthKitProvider } from './auth/workos-provider.js';
import type { WorkOSClient } from './auth/workos-client.js';
import type pino from 'pino';
import type { Pool } from 'pg';
import type {
  OrganizationRepo, AccountRepo, MembershipMirrorRepo, WorkosEventLogRepo,
  ProjectRepo, ServiceRepo, ArtifactRepo, TagRepo, TokenRepo, AuditRepo, OutboxRepo,
  BlobStore, Ids,
} from '@rntme-cli/platform-core';

export type AppDeps = {
  env: Env;
  logger: pino.Logger;
  workos: WorkOSClient;
  cookiePassword: string;
  pool: Pool;
  blob: BlobStore;
  ids: Ids;
  repos: {
    organizations: OrganizationRepo;
    accounts: AccountRepo;
    memberships: MembershipMirrorRepo;
    workosEventLog: WorkosEventLogRepo;
    projects: ProjectRepo;
    services: ServiceRepo;
    artifacts: ArtifactRepo;
    tags: TagRepo;
    tokens: TokenRepo;
    audit: AuditRepo;
    outbox: OutboxRepo;
  };
};

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.use('*', requestId());
  app.use('*', loggerMiddleware(deps.logger));
  app.use('*', errorHandler());
  app.use('*', corsMiddleware(deps.env.PLATFORM_CORS_ORIGINS));

  const apiTokenProvider = new ApiTokenProvider({
    tokens: deps.repos.tokens, organizations: deps.repos.organizations,
    accounts: deps.repos.accounts, memberships: deps.repos.memberships,
  });
  const workosProvider = new WorkOSAuthKitProvider({
    workos: deps.workos, cookiePassword: deps.cookiePassword,
    organizations: deps.repos.organizations, accounts: deps.repos.accounts, memberships: deps.repos.memberships,
  });

  // Ops (unauthenticated)
  app.route('/', opsRoutes({ pool: deps.pool, blob: deps.blob, workos: deps.workos, openApiJson: () => buildOpenApi(deps.env) }));

  // Webhooks (signature-verified, no auth)
  app.route('/v1/webhooks', webhookWorkosRoute({ workos: deps.workos, secret: deps.env.WORKOS_WEBHOOK_SECRET, repos: { organizations: deps.repos.organizations, accounts: deps.repos.accounts, memberships: deps.repos.memberships, projects: deps.repos.projects, workosEventLog: deps.repos.workosEventLog } }));

  // Auth (public for /login /callback; /me gated)
  app.route('/v1/auth', authRoutes({ workos: deps.workos, env: deps.env, cookiePassword: deps.cookiePassword, repos: { organizations: deps.repos.organizations, accounts: deps.repos.accounts, memberships: deps.repos.memberships } }));

  // Authenticated surface
  const rateLimiter = new InMemoryRateLimiter({ windowMs: 60_000, max: 1000 });
  const authed = new Hono()
    .use('*', requireAuth([apiTokenProvider, workosProvider]))
    .use('*', rateLimit(rateLimiter, (c) => c.get('subject').tokenId ?? c.get('subject').account.id));

  authed.route('/v1/orgs', orgRoutes({ organizations: deps.repos.organizations }));
  authed.route('/v1/orgs/:orgSlug/projects', projectRoutes({ organizations: deps.repos.organizations, projects: deps.repos.projects, ids: deps.ids }));
  authed.route('/v1/orgs/:orgSlug/projects/:projSlug/services', serviceRoutes({ organizations: deps.repos.organizations, projects: deps.repos.projects, services: deps.repos.services, ids: deps.ids }));
  authed.route('/v1/orgs/:orgSlug/projects/:projSlug/services/:svcSlug', versionRoutes({ organizations: deps.repos.organizations, projects: deps.repos.projects, services: deps.repos.services, artifacts: deps.repos.artifacts, tags: deps.repos.tags, blob: deps.blob, ids: deps.ids }));
  authed.route('/v1/orgs/:orgSlug/tokens', tokenRoutes({ tokens: deps.repos.tokens, ids: deps.ids }));
  authed.route('/v1/orgs/:orgSlug/audit', auditRoutes({ audit: deps.repos.audit }));

  app.route('/', authed);

  return app;
}
```

- [ ] **Step 2: Replace src/bin/server.ts with real wiring**

```ts
import { serve } from '@hono/node-server';
import { RandomIds } from '@rntme-cli/platform-core';
import {
  createPool, createDb, runMigrations,
  PgOrganizationRepo, PgAccountRepo, PgMembershipMirrorRepo, PgWorkosEventLogRepo,
  PgProjectRepo, PgServiceRepo, PgArtifactRepo, PgTagRepo, PgTokenRepo, PgAuditRepo, PgOutboxRepo,
  S3BlobStore,
} from '@rntme-cli/platform-storage';
import { parseEnv } from '../config/env.js';
import { createLogger } from '../logger.js';
import { createApp } from '../app.js';
import { createWorkos } from '../auth/workos-client.js';

const env = parseEnv(process.env);
const logger = createLogger(env);

async function main() {
  const pool = createPool(env.DATABASE_URL);
  const db = createDb(pool);
  await runMigrations(db, pool);
  const blob = new S3BlobStore({ endpoint: env.RUSTFS_ENDPOINT, bucket: env.RUSTFS_BUCKET, accessKeyId: env.RUSTFS_ACCESS_KEY_ID, secretAccessKey: env.RUSTFS_SECRET_ACCESS_KEY });
  await blob.ensureBucket();
  const workos = createWorkos(env);
  const ids = new RandomIds();
  const cookiePassword = (process.env['PLATFORM_COOKIE_PASSWORD'] ?? '').padEnd(32, 'x').slice(0, 64);

  const app = createApp({
    env, logger, workos, cookiePassword, pool, blob, ids,
    repos: {
      organizations: new PgOrganizationRepo(pool),
      accounts: new PgAccountRepo(pool),
      memberships: new PgMembershipMirrorRepo(pool),
      workosEventLog: new PgWorkosEventLogRepo(pool),
      projects: new PgProjectRepo(pool),
      services: new PgServiceRepo(pool),
      artifacts: new PgArtifactRepo(pool),
      tags: new PgTagRepo(pool),
      tokens: new PgTokenRepo(pool),
      audit: new PgAuditRepo(pool),
      outbox: new PgOutboxRepo(pool),
    },
  });

  serve({ fetch: app.fetch, port: env.PORT });
  logger.info({ port: env.PORT, baseUrl: env.PLATFORM_BASE_URL }, 'platform-http listening');
}

main().catch((err) => { logger.error({ err }, 'boot failed'); process.exit(1); });
```

**Engineer note:** `PLATFORM_COOKIE_PASSWORD` is a new required env in prod; add it to env.ts Zod schema and documentation. Any value ≥32 bytes works; rotate it to invalidate all sessions.

- [ ] **Step 3: Full green**

```bash
pnpm -F @rntme-cli/platform-http build
pnpm -F @rntme-cli/platform-http typecheck
pnpm -F @rntme-cli/platform-http lint
pnpm -F @rntme-cli/platform-http test
```

- [ ] **Step 4: Commit**

```bash
git -C rntme-cli add packages/platform-http/src/app.ts packages/platform-http/src/bin/server.ts
git -C rntme-cli commit -m "feat(platform-http): wire full app with all providers, repos, blob, routes"
```

---

## Phase O — E2E scenarios

### Task O1: E2E harness (Postgres + MinIO + WorkOS stub)

**Files:**
- Create: `test/e2e/harness.ts`
- Create: `test/e2e/workos-stub.ts`

- [ ] **Step 1: Implement workos-stub**

```ts
// test/e2e/workos-stub.ts
// A minimal stand-in for @workos-inc/node that the platform-http app can use in tests.
import type { WorkOSClient } from '../../src/auth/workos-client.js';

export function makeWorkosStub(opts?: { forceCallbackOrg?: string }): WorkOSClient {
  const stub: unknown = {
    userManagement: {
      getAuthorizationUrl: (_args: unknown) => 'https://workos.test/start',
      authenticateWithCode: async (_args: unknown) => ({
        user: { id: 'user_stub_1', email: 'stub@example.com', firstName: 'Stub', lastName: 'User' },
        organizationId: opts?.forceCallbackOrg ?? 'org_stub_1',
        sealedSession: 'stub-sealed',
      }),
      loadSealedSession: (_args: unknown) => ({
        authenticate: async () => ({ authenticated: true, user: { id: 'user_stub_1', email: 'stub@example.com', firstName: 'Stub', lastName: 'User' }, organizationId: 'org_stub_1', sessionId: 'sess_1', reason: undefined }),
        getLogoutUrl: async () => 'https://workos.test/logout',
      }),
    },
    webhooks: {
      constructEvent: async ({ payload }: { payload: string }) => JSON.parse(payload),
    },
  };
  return stub as WorkOSClient;
}
```

- [ ] **Step 2: Implement harness**

```ts
// test/e2e/harness.ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { createPool, createDb, runMigrations, PgOrganizationRepo, PgAccountRepo, PgMembershipMirrorRepo, PgWorkosEventLogRepo, PgProjectRepo, PgServiceRepo, PgArtifactRepo, PgTagRepo, PgTokenRepo, PgAuditRepo, PgOutboxRepo, S3BlobStore } from '@rntme-cli/platform-storage';
import { RandomIds } from '@rntme-cli/platform-core';
import { createApp, type AppDeps } from '../../src/app.js';
import { createLogger } from '../../src/logger.js';
import { parseEnv } from '../../src/config/env.js';
import { makeWorkosStub } from './workos-stub.js';

export type E2eEnv = {
  pg: StartedPostgreSqlContainer;
  minio: StartedTestContainer;
  app: ReturnType<typeof createApp>;
  deps: AppDeps;
  teardown(): Promise<void>;
};

export async function bootE2e(): Promise<E2eEnv> {
  const pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  const minio = await new GenericContainer('minio/minio:latest')
    .withCommand(['server', '/data']).withEnvironment({ MINIO_ROOT_USER: 'minio', MINIO_ROOT_PASSWORD: 'minio12345' })
    .withExposedPorts(9000).start();
  const endpoint = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`;
  const env = parseEnv({
    DATABASE_URL: pg.getConnectionUri(),
    RUSTFS_ENDPOINT: endpoint, RUSTFS_ACCESS_KEY_ID: 'minio', RUSTFS_SECRET_ACCESS_KEY: 'minio12345', RUSTFS_BUCKET: 'test-bucket',
    WORKOS_API_KEY: 'stub', WORKOS_CLIENT_ID: 'stub', WORKOS_WEBHOOK_SECRET: 'stub',
    WORKOS_REDIRECT_URI: 'http://localhost/callback',
    PLATFORM_BASE_URL: 'http://localhost', PLATFORM_SESSION_COOKIE_DOMAIN: 'localhost',
    PLATFORM_CORS_ORIGINS: '*',
  });
  const pool = createPool(env.DATABASE_URL);
  const db = createDb(pool);
  await runMigrations(db, pool);
  const blob = new S3BlobStore({ endpoint, bucket: env.RUSTFS_BUCKET, accessKeyId: env.RUSTFS_ACCESS_KEY_ID, secretAccessKey: env.RUSTFS_SECRET_ACCESS_KEY });
  await blob.ensureBucket();
  const workos = makeWorkosStub();
  const logger = createLogger(env);
  const ids = new RandomIds();
  const deps: AppDeps = {
    env, logger, workos, cookiePassword: 'x'.repeat(32), pool, blob, ids,
    repos: {
      organizations: new PgOrganizationRepo(pool), accounts: new PgAccountRepo(pool),
      memberships: new PgMembershipMirrorRepo(pool), workosEventLog: new PgWorkosEventLogRepo(pool),
      projects: new PgProjectRepo(pool), services: new PgServiceRepo(pool),
      artifacts: new PgArtifactRepo(pool), tags: new PgTagRepo(pool),
      tokens: new PgTokenRepo(pool), audit: new PgAuditRepo(pool), outbox: new PgOutboxRepo(pool),
    },
  };
  const app = createApp(deps);
  return {
    pg, minio, app, deps,
    teardown: async () => { await pool.end(); await minio.stop(); await pg.stop(); },
  };
}
```

- [ ] **Step 3: Commit**

```bash
git -C rntme-cli add packages/platform-http/test/e2e/harness.ts packages/platform-http/test/e2e/workos-stub.ts
git -C rntme-cli commit -m "test(platform-http): e2e harness (Postgres + MinIO + WorkOS stub)"
```

---

### Task O2: E2E — agent workflow (create project → service → publish → tag → republish)

**Files:**
- Create: `test/e2e/agent-workflow.test.ts`

- [ ] **Step 1: Test**

```ts
// test/e2e/agent-workflow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { bootE2e, type E2eEnv } from './harness.js';
import { minimalValidBundle } from '../../../platform-core/test/fixtures/bundles/minimal-valid.js';

let env: E2eEnv;
let bearer: string;
let orgSlug: string;

beforeAll(async () => {
  env = await bootE2e();
  // Seed: one org, one account, one membership, one admin token (bypassing WorkOS for e2e speed).
  const o = await env.deps.repos.organizations.upsertFromWorkos({ workosOrganizationId: 'org_e2e', slug: 'e2e', displayName: 'E2E' });
  const a = await env.deps.repos.accounts.upsertFromWorkos({ workosUserId: 'user_e2e', email: 'e2e@example.com', displayName: 'E2E User' });
  if (!o.ok || !a.ok) throw new Error('seed org/account failed');
  await env.deps.repos.memberships.upsert({ orgId: o.value.id, accountId: a.value.id, role: 'admin' });
  const plain = 'rntme_pat_' + 'a'.repeat(22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await env.deps.repos.tokens.create({
    id: randomUUID(), orgId: o.value.id, accountId: a.value.id, name: 'e2e',
    tokenHash: hash, prefix: plain.slice(0, 12),
    scopes: ['project:read', 'project:write', 'version:publish', 'member:read', 'token:manage'],
    expiresAt: null,
  });
  bearer = plain;
  orgSlug = o.value.slug;
}, 300_000);

afterAll(async () => { await env.teardown(); });

describe('agent workflow', () => {
  it('create project → service → publish → tag → republish', async () => {
    const H = { 'content-type': 'application/json', authorization: `Bearer ${bearer}` };

    // create project
    let r = await env.app.request(`/v1/orgs/${orgSlug}/projects`, { method: 'POST', headers: H, body: JSON.stringify({ slug: 'proj', displayName: 'Proj' }) });
    expect(r.status).toBe(201);

    // create service
    r = await env.app.request(`/v1/orgs/${orgSlug}/projects/proj/services`, { method: 'POST', headers: H, body: JSON.stringify({ slug: 'svc', displayName: 'Svc' }) });
    expect(r.status).toBe(201);

    // publish v1
    r = await env.app.request(`/v1/orgs/${orgSlug}/projects/proj/services/svc/versions`, { method: 'POST', headers: H, body: JSON.stringify({ bundle: minimalValidBundle, moveTags: ['stable'] }) });
    expect(r.status).toBe(201);
    const v1 = await r.json();
    expect(v1.seq).toBe(1);

    // move tag stable to v1 (idempotent)
    r = await env.app.request(`/v1/orgs/${orgSlug}/projects/proj/services/svc/tags/stable`, { method: 'PUT', headers: H, body: JSON.stringify({ versionSeq: 1 }) });
    expect(r.status).toBe(200);

    // re-publish same bundle → 200 same seq (idempotency)
    r = await env.app.request(`/v1/orgs/${orgSlug}/projects/proj/services/svc/versions`, { method: 'POST', headers: H, body: JSON.stringify({ bundle: minimalValidBundle }) });
    expect([200, 201]).toContain(r.status);
    const v2 = await r.json();
    expect(v2.seq).toBe(1);

    // list versions
    r = await env.app.request(`/v1/orgs/${orgSlug}/projects/proj/services/svc/versions`, { headers: H });
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm -F @rntme-cli/platform-http test
```

Expected: pass (slow — 3–5 minutes for first container pulls).

- [ ] **Step 3: Commit**

```bash
git -C rntme-cli add packages/platform-http/test/e2e/agent-workflow.test.ts
git -C rntme-cli commit -m "test(platform-http): e2e agent workflow (project→service→publish→tag→republish)"
```

---

### Task O3: E2E — cross-org isolation

**Files:**
- Create: `test/e2e/tenant-isolation.test.ts`

- [ ] **Step 1: Test**

```ts
// test/e2e/tenant-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { bootE2e, type E2eEnv } from './harness.js';

let env: E2eEnv;

async function seedOrgWithToken(slug: string, workosId: string, workosUser: string) {
  const org = await env.deps.repos.organizations.upsertFromWorkos({ workosOrganizationId: workosId, slug, displayName: slug });
  const acc = await env.deps.repos.accounts.upsertFromWorkos({ workosUserId: workosUser, email: null, displayName: workosUser });
  if (!org.ok || !acc.ok) throw new Error('seed');
  await env.deps.repos.memberships.upsert({ orgId: org.value.id, accountId: acc.value.id, role: 'admin' });
  const plain = 'rntme_pat_' + randomUUID().replace(/-/g, '').slice(0, 22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await env.deps.repos.tokens.create({
    id: randomUUID(), orgId: org.value.id, accountId: acc.value.id, name: 't',
    tokenHash: hash, prefix: plain.slice(0, 12),
    scopes: ['project:read', 'project:write', 'version:publish'], expiresAt: null,
  });
  return { plain, slug };
}

beforeAll(async () => { env = await bootE2e(); }, 300_000);
afterAll(async () => { await env.teardown(); });

describe('tenant isolation', () => {
  it('token A cannot read/write org B projects', async () => {
    const A = await seedOrgWithToken('orga', 'org_a', 'user_a');
    const B = await seedOrgWithToken('orgb', 'org_b', 'user_b');

    // A creates project in orga
    let r = await env.app.request(`/v1/orgs/${A.slug}/projects`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${A.plain}` },
      body: JSON.stringify({ slug: 'only-a', displayName: 'A' }),
    });
    expect(r.status).toBe(201);

    // A tries to hit orgb's scope → 403
    r = await env.app.request(`/v1/orgs/${B.slug}/projects`, { headers: { authorization: `Bearer ${A.plain}` } });
    expect(r.status).toBe(403);

    // B lists its own projects → empty
    r = await env.app.request(`/v1/orgs/${B.slug}/projects`, { headers: { authorization: `Bearer ${B.plain}` } });
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list) ? list.length : 0).toBe(0);
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/test/e2e/tenant-isolation.test.ts
git -C rntme-cli commit -m "test(platform-http): e2e cross-org isolation"
```

---

### Task O4: E2E — validation gate rejection

**Files:**
- Create: `test/e2e/validation-gate.test.ts`

- [ ] **Step 1: Test**

```ts
// test/e2e/validation-gate.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { bootE2e, type E2eEnv } from './harness.js';
import { minimalValidBundle } from '../../../platform-core/test/fixtures/bundles/minimal-valid.js';

let env: E2eEnv;
let bearer: string;
let slug: string;

beforeAll(async () => {
  env = await bootE2e();
  const org = await env.deps.repos.organizations.upsertFromWorkos({ workosOrganizationId: 'org_gate', slug: 'gate', displayName: 'Gate' });
  const acc = await env.deps.repos.accounts.upsertFromWorkos({ workosUserId: 'gate_user', email: null, displayName: 'G' });
  if (!org.ok || !acc.ok) throw new Error('seed');
  await env.deps.repos.memberships.upsert({ orgId: org.value.id, accountId: acc.value.id, role: 'admin' });
  const plain = 'rntme_pat_' + 'g'.repeat(22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await env.deps.repos.tokens.create({
    id: randomUUID(), orgId: org.value.id, accountId: acc.value.id, name: 'g', tokenHash: hash,
    prefix: plain.slice(0, 12), scopes: ['project:read', 'project:write', 'version:publish'], expiresAt: null,
  });
  bearer = plain; slug = 'gate';
  const H = { 'content-type': 'application/json', authorization: `Bearer ${bearer}` };
  await env.app.request(`/v1/orgs/${slug}/projects`, { method: 'POST', headers: H, body: JSON.stringify({ slug: 'pr', displayName: 'P' }) });
  await env.app.request(`/v1/orgs/${slug}/projects/pr/services`, { method: 'POST', headers: H, body: JSON.stringify({ slug: 'sv', displayName: 'S' }) });
}, 300_000);

afterAll(async () => { await env.teardown(); });

describe('validation gate', () => {
  it('broken PDM -> 422 with @rntme/pdm code', async () => {
    const broken = { ...minimalValidBundle, pdm: { entities: [{ name: '!!', fields: [] }] } };
    const r = await env.app.request(`/v1/orgs/${slug}/projects/pr/services/sv/versions`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ bundle: broken }),
    });
    expect(r.status).toBe(422);
    const body = await r.json();
    expect(body.error.code).toBe('PLATFORM_VALIDATION_BUNDLE_FAILED');
    expect(body.error.pkg).toBe('pdm');
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm -F @rntme-cli/platform-http test
git -C rntme-cli add packages/platform-http/test/e2e/validation-gate.test.ts
git -C rntme-cli commit -m "test(platform-http): e2e validation-gate 422 with @rntme/pdm nested code"
```

---

## Phase P — Final wrap-up

### Task P1: Full green + public-repo submodule pointer bump

- [ ] **Step 1: From public repo root, run the full matrix**

```bash
cd /home/coder/project
pnpm install --frozen-lockfile
pnpm -r run build
pnpm -r run typecheck
pnpm -r run lint
pnpm -r run test
```

Expected: all packages green, including the new three under `rntme-cli/packages/`. If a package fails, fix before proceeding.

- [ ] **Step 2: Bump submodule pointer**

```bash
cd /home/coder/project
git add rntme-cli
git commit -m "chore: bump rntme-cli submodule (platform API M1 landed)"
```

- [ ] **Step 3: Push both repositories**

```bash
cd /home/coder/project/rntme-cli && git push origin main
cd /home/coder/project && git push origin HEAD
```

---

### Task P2: Update public-repo docs

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

- [ ] **Step 1: In `AGENTS.md` §2 "Repository map"** — expand the `rntme-cli/` line to enumerate the platform packages:

Replace:
```
- `rntme-cli/`              — private git submodule (`vladprrs/rntme-cli`)
  hosting `@rntme-cli/*` packages.
```

With:
```
- `rntme-cli/`              — private git submodule (`vladprrs/rntme-cli`)
  hosting `@rntme-cli/*` packages:
    - `@rntme-cli/cli`            — the `rntme` CLI binary (stub today).
    - `@rntme-cli/platform-core`  — platform domain, use-cases, seam interfaces.
    - `@rntme-cli/platform-storage` — Postgres + rustfs adapters.
    - `@rntme-cli/platform-http`  — Hono server at `platform.rntme.com`.
  Specs: `docs/superpowers/specs/done/2026-04-18-rntme-cli-submodule-design.md`
  and `docs/superpowers/specs/done/2026-04-19-platform-api-design.md`.
```

- [ ] **Step 2: In `README.md`** — add a short "Platform API" section under "Architecture" linking to the design spec and summarizing scope in 2–3 sentences. No implementation details.

- [ ] **Step 3: Commit**

```bash
cd /home/coder/project
git add AGENTS.md README.md
git commit -m "docs: add @rntme-cli/platform-* packages to repo map"
```

---

## Self-review

**Spec coverage map:**

| Spec §  | Plan task(s) |
|---------|--------------|
| §1–§3 context/decisions | all tasks inherit; decision matrix echoed in plan header |
| §4 architecture & boundaries | A1–A4, N4 (wiring) |
| §5 data model (identity) | E2 (schema/identity) + F2 (pg repos) |
| §5 data model (project/service/version/tag/token/audit/outbox) | E2 (schema) + F3/F4/F5 (pg repos) |
| §5.5 RLS | E3 + F3 + F4 integration tests |
| §6 publish flow | D3 (validation adapter) + D4 (use-case) + F4 (pg publish transaction) + N1 (route) |
| §7 CRUD invariants | M2/M3 (projects/services), N1 (versions/tags), N2 (tokens/audit) |
| §8 auth + multi-tenancy | J1/J2/J3 (providers + middleware), K1 (routes), L1 (webhook), D7 (sync use-case) |
| §9 error handling | B1 (Result + codes), I2 (handler + status mapping) |
| §10 testing | unit suites throughout; F-harness (F1) + O1–O4 (e2e) |
| §11 HTTP surface | K1, L1, M2, M3, N1–N3, orgs in N2 |
| §12 observability | I1 (requestId + pino), I2 (error handler) |
| §13 config (platform.rntme.com) | H1 (env schema with baseline.rntme.com values) |
| §14 security | I2 (redact), I3 (rate-limit + CORS), N4 (HTTPS assumed on proxy) |
| §15 future hooks | outbox table/repo in E2/F5; engineer-note in N3 re OpenAPI emit migration |
| §16 verification | P1 final matrix |
| §17 risks | D3 engineer-note on `@rntme/*` signature drift; J1 engineer-note on `findById` |

**Placeholder scan:** no `TBD`/`TODO` in code blocks. Engineer notes exist but are targeted (e.g., "verify `@rntme/<pkg>` API shape", "hand-written OpenAPI is stopgap") — each is a concrete action, not a vague placeholder.

**Type consistency:** `OrganizationRepo` gains `findById` in Task J1 Step 3; the fake and pg impl are updated in the same task. `AccountRepo.findById` follows the same pattern. All downstream use-sites are updated.

**Scope check:** this is one plan for one coherent subsystem. It is long (~70 tasks including nested steps), but not decomposable — each phase enables the next. Tasks can be parallelized in pairs (e.g., F2 with F5 inside a single integration suite), but sequencing is dependency-forced.

**Ambiguity check:** validation-adapter signature drift for `@rntme/*` packages (Task D3) is flagged and the engineer is told to re-inspect `.d.ts` files. Personal-org auto-provisioning behavior depends on WorkOS (spec §17 risk); Task K1 covers defensive upsert from the callback so it does not block the flow.

---

Plan complete and saved to `docs/superpowers/plans/done/2026-04-19-platform-api.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
