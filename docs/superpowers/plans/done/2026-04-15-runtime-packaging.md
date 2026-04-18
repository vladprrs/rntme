# rntme Runtime Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@rntme/runtime` — one npm package + one `ghcr.io/vladprrs/rntme-runtime` image that consumes a folder of JSON artifacts (PDM/QSM/graphs/bindings/ui + `manifest.json`) and starts a live CQRS/ES service with no user-written code.

**Architecture:** Single TypeScript package with plugin seams (`DbDriver`, `EventBus`, `Surface`). MVP defaults: `BetterSqliteDriver` + `InMemoryBus` + `HttpSurface`. Entry points: `loadService(dir) → Result<ValidatedService, ServiceError[]>` then `startService(service, config) → RunningService`. CLI `rntme-runtime {start,validate}` on top.

**Tech Stack:** Node 20, TypeScript, ESM, Hono, better-sqlite3, Vitest, pnpm workspaces. Spec: `docs/superpowers/specs/2026-04-15-runtime-packaging-design.md`.

---

## File Structure

### New package

```
packages/runtime/
  package.json
  tsconfig.json
  tsconfig.check.json
  vitest.config.ts
  eslint.config.mjs                      ← copy shape from bindings-http
  README.md
  Dockerfile                             ← multi-stage, ships the image
  Dockerfile.template                    ← copied into the published npm tarball
  src/
    index.ts                             ← public exports (entry points, plugin types, defaults, test-kit)
    types.ts                             ← ValidatedService, RunningService, RuntimeConfig, ServiceError
    manifest/
      schema.ts                          ← Zod or hand-rolled; validates manifest.json shape
      parse.ts                           ← parseManifest(json) → Result<ParsedManifest, ManifestError[]>
      validate.ts                        ← validateManifest(parsed) + applyEnvOverrides(validated, env)
      types.ts                           ← ParsedManifest, ValidatedManifest, ManifestError
    load/
      load-service.ts                    ← loadService(dir)
      read-dir.ts                        ← tiny fs helpers (readJsonFile, readGraphsDir)
    start/
      start-service.ts                   ← startService(service, config)
      wire-event-pipeline.ts             ← event store + relay + projection-consumer (ex-demo events.ts)
      build-actor-from-request.ts        ← manifest.auth → actorFromRequest
    plugins/
      interfaces.ts                      ← DbDriver, DbHandle, EventBus, Surface, SurfaceContext
      better-sqlite-driver.ts            ← BetterSqliteDriver
      in-memory-bus.ts                   ← InMemoryBus (wraps @rntme/projection-consumer helpers)
      http-surface.ts                    ← HttpSurface
      observability.ts                   ← /health + /metrics mounted by HttpSurface
    bin/
      runtime.ts                         ← CLI entrypoint: start | validate
  test/
    unit/
      manifest-parse.test.ts
      manifest-validate.test.ts
      env-override.test.ts
      load-service.errors.test.ts
    integration/
      load-service.test.ts
      startup.test.ts
      shutdown.test.ts
      health-metrics.test.ts
      plugin-contracts.test.ts           ← calls runDbDriverContract / runEventBusContract / runSurfaceContract on MVP defaults
    e2e/
      issue-tracker.test.ts              ← boots fixture via startService + hits HTTP endpoints
      validate-cli.test.ts               ← spawns `rntme-runtime validate` and asserts exit codes / stdout
    fixtures/
      issue-tracker/
        manifest.json
        pdm.json qsm.json bindings.json shapes.json ui.json
        graphs/*.json
      broken-manifest/
        manifest.json                    ← e.g., missing service.name
        ...
      version-mismatch/
        manifest.json                    ← rntmeVersion "9.0"
        ...
```

### Modified files (demo migration)

```
demo/issue-tracker-api/
  artifacts/                              ← moved from src/artifacts/, plus manifest.json + ui.json
    manifest.json                          ← NEW
    pdm.json qsm.json bindings.json shapes.json
    ui.json                                ← NEW (was src/ui.ts)
    graphs/*.json
  src/
    server.ts                              ← shrunk to ~15 lines using loadService + startService
  Dockerfile                               ← NEW, 3 lines on top of rntme-runtime:1.0
  package.json                             ← adds "@rntme/runtime", removes now-unused deps
  test/                                   ← unchanged (HTTP smoke tests)
```

Files deleted: `demo/issue-tracker-api/src/artifacts.ts`, `src/events.ts`, `src/ui.ts`, `src/db/seed.ts` (seed goes via real POST commands in tests — follow-up, not this plan's block).

### CI

```
.github/workflows/
  release.yml                              ← on git tag v* → build image, push to GHCR, npm publish
```

---

## Phase 1 — Package scaffold

### Task 1: Create `@rntme/runtime` package skeleton

**Files:**
- Create: `packages/runtime/package.json`
- Create: `packages/runtime/tsconfig.json`
- Create: `packages/runtime/tsconfig.check.json`
- Create: `packages/runtime/vitest.config.ts`
- Create: `packages/runtime/src/index.ts`
- Create: `packages/runtime/test/unit/_smoke.test.ts`

- [ ] **Step 1: Write the smoke test**

```ts
// packages/runtime/test/unit/_smoke.test.ts
import { describe, it, expect } from 'vitest';
import { VERSION } from '@rntme/runtime';

describe('@rntme/runtime', () => {
  it('exports a version string', () => {
    expect(typeof VERSION).toBe('string');
  });
});
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "@rntme/runtime",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Zero-code runtime for rntme services: consumes PDM/QSM/graphs/bindings/ui + manifest.json and serves HTTP.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "rntme-runtime": "./dist/bin/runtime.js"
  },
  "files": ["dist", "README.md", "Dockerfile.template"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@hono/node-server": "^1.13.0",
    "@rntme/bindings": "workspace:*",
    "@rntme/bindings-http": "workspace:*",
    "@rntme/event-store": "workspace:*",
    "@rntme/graph-ir-compiler": "workspace:*",
    "@rntme/pdm": "workspace:*",
    "@rntme/projection-consumer": "workspace:*",
    "@rntme/qsm": "workspace:*",
    "@rntme/ui": "workspace:*",
    "@rntme/ui-runtime": "workspace:*",
    "hono": "^4.6.0",
    "prom-client": "^15.1.3",
    "zod": "^3.23.8"
  },
  "peerDependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "better-sqlite3": "^11.0.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 4: Create `tsconfig.check.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": ".",
    "composite": false
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 15_000,
  },
});
```

- [ ] **Step 6: Create the stub `src/index.ts`**

```ts
export const VERSION = '0.0.0';
```

- [ ] **Step 7: Install + build**

Run:
```bash
pnpm install
pnpm -F @rntme/runtime build
pnpm -F @rntme/runtime test
```
Expected: install succeeds, build emits `dist/index.d.ts` + `dist/index.js`, smoke test passes.

- [ ] **Step 8: Commit**

```bash
git add packages/runtime pnpm-lock.yaml
git commit -m "feat(runtime): scaffold @rntme/runtime package"
```

---

## Phase 2 — Manifest artifact

### Task 2: Manifest schema + types

**Files:**
- Create: `packages/runtime/src/manifest/schema.ts`
- Create: `packages/runtime/src/manifest/types.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
// packages/runtime/src/manifest/types.ts
import type { Result } from '@rntme/pdm';

export type ParsedManifest = {
  rntmeVersion: string;
  service: { name: string; version: string };
  surface?: { http?: { enabled?: boolean; port?: number } };
  persistence?: {
    mode?: 'ephemeral' | 'persistent';
    eventStorePath?: string;
    qsmPath?: string;
  };
  bus?: { mode?: 'in-memory' };
  auth?: { mode?: 'header'; headerName?: string; actorKind?: string };
  observability?: {
    health?: { path?: string };
    metrics?: { path?: string };
  };
};

export type ValidatedManifest = {
  rntmeVersion: { major: number; minor: number; patch: number };
  service: { name: string; version: string };
  surface: { http: { enabled: boolean; port: number } };
  persistence:
    | { mode: 'ephemeral' }
    | { mode: 'persistent'; eventStorePath: string; qsmPath: string };
  bus: { mode: 'in-memory' };
  auth: { mode: 'header'; headerName: string; actorKind: string };
  observability: {
    health: { path: string };
    metrics: { path: string };
  };
};

export type ManifestErrorCode =
  | 'MANIFEST_NOT_JSON'
  | 'MANIFEST_NOT_OBJECT'
  | 'MANIFEST_UNKNOWN_KEY'
  | 'MANIFEST_MISSING_FIELD'
  | 'MANIFEST_INVALID_TYPE'
  | 'MANIFEST_INVALID_PORT'
  | 'MANIFEST_INVALID_VERSION'
  | 'MANIFEST_VERSION_MAJOR_MISMATCH'
  | 'MANIFEST_MISSING_EVENT_STORE_PATH'
  | 'MANIFEST_MISSING_QSM_PATH';

export type ManifestError = {
  code: ManifestErrorCode;
  path: string;            // e.g., "service.name" or "persistence.eventStorePath"
  message: string;
};

export type ManifestResult<T> = Result<T, ManifestError[]>;
```

- [ ] **Step 2: Write `schema.ts` (Zod)**

```ts
// packages/runtime/src/manifest/schema.ts
import { z } from 'zod';

export const ManifestSchema = z
  .object({
    rntmeVersion: z.string(),
    service: z.object({
      name: z.string().min(1),
      version: z.string().min(1),
    }),
    surface: z
      .object({
        http: z
          .object({
            enabled: z.boolean().optional(),
            port: z.number().int().positive().max(65535).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    persistence: z
      .object({
        mode: z.enum(['ephemeral', 'persistent']).optional(),
        eventStorePath: z.string().optional(),
        qsmPath: z.string().optional(),
      })
      .strict()
      .optional(),
    bus: z
      .object({
        mode: z.literal('in-memory').optional(),
      })
      .strict()
      .optional(),
    auth: z
      .object({
        mode: z.literal('header').optional(),
        headerName: z.string().min(1).optional(),
        actorKind: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    observability: z
      .object({
        health: z
          .object({ path: z.string().startsWith('/').optional() })
          .strict()
          .optional(),
        metrics: z
          .object({ path: z.string().startsWith('/').optional() })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/src/manifest/
git commit -m "feat(runtime): manifest schema + types"
```

---

### Task 3: `parseManifest` — unit tests first

**Files:**
- Test: `packages/runtime/test/unit/manifest-parse.test.ts`
- Create: `packages/runtime/src/manifest/parse.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/runtime/test/unit/manifest-parse.test.ts
import { describe, it, expect } from 'vitest';
import { parseManifest } from '../../src/manifest/parse.js';

const MIN = {
  rntmeVersion: '1.0',
  service: { name: 'svc', version: '1.0.0' },
};

describe('parseManifest', () => {
  it('parses a minimal valid manifest', () => {
    const r = parseManifest(JSON.stringify(MIN));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.service.name).toBe('svc');
  });

  it('errors on non-JSON input', () => {
    const r = parseManifest('not { json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_NOT_JSON');
  });

  it('errors on array/non-object JSON', () => {
    const r = parseManifest('[]');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_NOT_OBJECT');
  });

  it('rejects unknown top-level keys (strict)', () => {
    const r = parseManifest(JSON.stringify({ ...MIN, unknownKey: 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'MANIFEST_UNKNOWN_KEY')).toBe(true);
  });

  it('reports missing service.name', () => {
    const r = parseManifest(JSON.stringify({ rntmeVersion: '1.0', service: { version: '1.0.0' } }));
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors.some((e) => e.path === 'service.name' && e.code === 'MANIFEST_MISSING_FIELD')).toBe(
        true,
      );
  });

  it('accepts optional observability overrides', () => {
    const r = parseManifest(
      JSON.stringify({
        ...MIN,
        observability: { health: { path: '/hz' }, metrics: { path: '/m' } },
      }),
    );
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm -F @rntme/runtime test test/unit/manifest-parse.test.ts`
Expected: FAIL with "parseManifest is not exported".

- [ ] **Step 3: Implement `parseManifest`**

```ts
// packages/runtime/src/manifest/parse.ts
import type { ZodIssue } from 'zod';
import { ManifestSchema } from './schema.js';
import type { ManifestError, ManifestResult, ParsedManifest } from './types.js';

function zodIssueToError(issue: ZodIssue): ManifestError {
  const path = issue.path.length === 0 ? '<root>' : issue.path.join('.');
  if (issue.code === 'unrecognized_keys') {
    return {
      code: 'MANIFEST_UNKNOWN_KEY',
      path: `${path}.${(issue as unknown as { keys: string[] }).keys.join(',')}`,
      message: `unknown key(s): ${(issue as unknown as { keys: string[] }).keys.join(', ')}`,
    };
  }
  if (issue.code === 'invalid_type' && issue.received === 'undefined') {
    return { code: 'MANIFEST_MISSING_FIELD', path, message: issue.message };
  }
  if (issue.code === 'invalid_type') {
    return { code: 'MANIFEST_INVALID_TYPE', path, message: issue.message };
  }
  if (issue.code === 'too_small' && issue.type === 'number') {
    return { code: 'MANIFEST_INVALID_PORT', path, message: issue.message };
  }
  return { code: 'MANIFEST_INVALID_TYPE', path, message: issue.message };
}

export function parseManifest(raw: string): ManifestResult<ParsedManifest> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      errors: [
        {
          code: 'MANIFEST_NOT_JSON',
          path: '<root>',
          message: e instanceof Error ? e.message : String(e),
        },
      ],
    };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      errors: [
        { code: 'MANIFEST_NOT_OBJECT', path: '<root>', message: 'manifest must be a JSON object' },
      ],
    };
  }
  const result = ManifestSchema.safeParse(data);
  if (!result.success) {
    return { ok: false, errors: result.error.issues.map(zodIssueToError) };
  }
  return { ok: true, value: result.data as ParsedManifest };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm -F @rntme/runtime test test/unit/manifest-parse.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/manifest/parse.ts packages/runtime/test/unit/manifest-parse.test.ts
git commit -m "feat(runtime): parseManifest with strict schema + coded errors"
```

---

### Task 4: `validateManifest` + `applyEnvOverrides`

**Files:**
- Test: `packages/runtime/test/unit/manifest-validate.test.ts`
- Test: `packages/runtime/test/unit/env-override.test.ts`
- Create: `packages/runtime/src/manifest/validate.ts`

- [ ] **Step 1: Write failing validate tests**

```ts
// packages/runtime/test/unit/manifest-validate.test.ts
import { describe, it, expect } from 'vitest';
import { validateManifest } from '../../src/manifest/validate.js';
import type { ParsedManifest } from '../../src/manifest/types.js';

const RUNTIME_VERSION = { major: 1, minor: 0, patch: 0 };
const MIN: ParsedManifest = {
  rntmeVersion: '1.0',
  service: { name: 'svc', version: '1.0.0' },
};

describe('validateManifest', () => {
  it('applies defaults for optional sections', () => {
    const r = validateManifest(MIN, RUNTIME_VERSION);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.surface.http.enabled).toBe(true);
    expect(r.value.surface.http.port).toBe(3000);
    expect(r.value.persistence.mode).toBe('ephemeral');
    expect(r.value.bus.mode).toBe('in-memory');
    expect(r.value.auth.headerName).toBe('x-actor-id');
    expect(r.value.auth.actorKind).toBe('user');
    expect(r.value.observability.health.path).toBe('/health');
    expect(r.value.observability.metrics.path).toBe('/metrics');
  });

  it('parses rntmeVersion to triple', () => {
    const r = validateManifest(MIN, RUNTIME_VERSION);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.rntmeVersion).toEqual({ major: 1, minor: 0, patch: 0 });
  });

  it('rejects invalid rntmeVersion string', () => {
    const r = validateManifest({ ...MIN, rntmeVersion: 'banana' }, RUNTIME_VERSION);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_INVALID_VERSION');
  });

  it('fails fast on major mismatch', () => {
    const r = validateManifest({ ...MIN, rntmeVersion: '2.0' }, RUNTIME_VERSION);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_VERSION_MAJOR_MISMATCH');
  });

  it('requires eventStorePath/qsmPath in persistent mode', () => {
    const r = validateManifest(
      { ...MIN, persistence: { mode: 'persistent' } },
      RUNTIME_VERSION,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'MANIFEST_MISSING_EVENT_STORE_PATH')).toBe(true);
      expect(r.errors.some((e) => e.code === 'MANIFEST_MISSING_QSM_PATH')).toBe(true);
    }
  });

  it('accepts persistent mode with paths', () => {
    const r = validateManifest(
      {
        ...MIN,
        persistence: {
          mode: 'persistent',
          eventStorePath: '/data/events.db',
          qsmPath: '/data/qsm.db',
        },
      },
      RUNTIME_VERSION,
    );
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Write failing env override tests**

```ts
// packages/runtime/test/unit/env-override.test.ts
import { describe, it, expect } from 'vitest';
import { applyEnvOverrides } from '../../src/manifest/validate.js';
import type { ValidatedManifest } from '../../src/manifest/types.js';

const base: ValidatedManifest = {
  rntmeVersion: { major: 1, minor: 0, patch: 0 },
  service: { name: 'svc', version: '1.0.0' },
  surface: { http: { enabled: true, port: 3000 } },
  persistence: { mode: 'ephemeral' },
  bus: { mode: 'in-memory' },
  auth: { mode: 'header', headerName: 'x-actor-id', actorKind: 'user' },
  observability: {
    health: { path: '/health' },
    metrics: { path: '/metrics' },
  },
};

describe('applyEnvOverrides', () => {
  it('is a no-op without any RNTME_* vars', () => {
    const r = applyEnvOverrides(base, {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(base);
  });

  it('overrides RNTME_HTTP_PORT', () => {
    const r = applyEnvOverrides(base, { RNTME_HTTP_PORT: '8080' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.surface.http.port).toBe(8080);
  });

  it('rejects invalid port env', () => {
    const r = applyEnvOverrides(base, { RNTME_HTTP_PORT: 'abc' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_INVALID_PORT');
  });

  it('switches to persistent mode via env with paths', () => {
    const r = applyEnvOverrides(base, {
      RNTME_PERSISTENCE_MODE: 'persistent',
      RNTME_EVENT_STORE_PATH: '/tmp/e.db',
      RNTME_QSM_PATH: '/tmp/q.db',
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.persistence.mode === 'persistent') {
      expect(r.value.persistence.eventStorePath).toBe('/tmp/e.db');
      expect(r.value.persistence.qsmPath).toBe('/tmp/q.db');
    }
  });

  it('errors when switching to persistent without paths', () => {
    const r = applyEnvOverrides(base, { RNTME_PERSISTENCE_MODE: 'persistent' });
    expect(r.ok).toBe(false);
  });

  it('overrides auth header name', () => {
    const r = applyEnvOverrides(base, { RNTME_AUTH_HEADER_NAME: 'x-user' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.auth.headerName).toBe('x-user');
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `pnpm -F @rntme/runtime test test/unit/manifest-validate.test.ts test/unit/env-override.test.ts`
Expected: FAIL (module not exporting `validateManifest`/`applyEnvOverrides`).

- [ ] **Step 4: Implement `validate.ts`**

```ts
// packages/runtime/src/manifest/validate.ts
import type {
  ManifestError,
  ManifestResult,
  ParsedManifest,
  ValidatedManifest,
} from './types.js';

export type SemverTriple = { major: number; minor: number; patch: number };

function parseSemver(s: string): SemverTriple | null {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3] ?? '0') };
}

export function validateManifest(
  parsed: ParsedManifest,
  runtimeVersion: SemverTriple,
): ManifestResult<ValidatedManifest> {
  const errors: ManifestError[] = [];
  const semver = parseSemver(parsed.rntmeVersion);
  if (!semver) {
    errors.push({
      code: 'MANIFEST_INVALID_VERSION',
      path: 'rntmeVersion',
      message: `expected "<major>.<minor>" or "<major>.<minor>.<patch>", got "${parsed.rntmeVersion}"`,
    });
  } else if (semver.major !== runtimeVersion.major) {
    errors.push({
      code: 'MANIFEST_VERSION_MAJOR_MISMATCH',
      path: 'rntmeVersion',
      message: `manifest major ${semver.major} != runtime major ${runtimeVersion.major}`,
    });
  }

  const mode = parsed.persistence?.mode ?? 'ephemeral';
  let persistence: ValidatedManifest['persistence'];
  if (mode === 'persistent') {
    const eventStorePath = parsed.persistence?.eventStorePath;
    const qsmPath = parsed.persistence?.qsmPath;
    if (!eventStorePath) {
      errors.push({
        code: 'MANIFEST_MISSING_EVENT_STORE_PATH',
        path: 'persistence.eventStorePath',
        message: 'required when persistence.mode is "persistent"',
      });
    }
    if (!qsmPath) {
      errors.push({
        code: 'MANIFEST_MISSING_QSM_PATH',
        path: 'persistence.qsmPath',
        message: 'required when persistence.mode is "persistent"',
      });
    }
    persistence = {
      mode: 'persistent',
      eventStorePath: eventStorePath ?? '',
      qsmPath: qsmPath ?? '',
    };
  } else {
    persistence = { mode: 'ephemeral' };
  }

  if (errors.length > 0) return { ok: false, errors };

  const v: ValidatedManifest = {
    rntmeVersion: semver!,
    service: { name: parsed.service.name, version: parsed.service.version },
    surface: {
      http: {
        enabled: parsed.surface?.http?.enabled ?? true,
        port: parsed.surface?.http?.port ?? 3000,
      },
    },
    persistence,
    bus: { mode: parsed.bus?.mode ?? 'in-memory' },
    auth: {
      mode: parsed.auth?.mode ?? 'header',
      headerName: parsed.auth?.headerName ?? 'x-actor-id',
      actorKind: parsed.auth?.actorKind ?? 'user',
    },
    observability: {
      health: { path: parsed.observability?.health?.path ?? '/health' },
      metrics: { path: parsed.observability?.metrics?.path ?? '/metrics' },
    },
  };
  return { ok: true, value: v };
}

export function applyEnvOverrides(
  v: ValidatedManifest,
  env: Record<string, string | undefined>,
): ManifestResult<ValidatedManifest> {
  const errors: ManifestError[] = [];
  let port = v.surface.http.port;
  if (env.RNTME_HTTP_PORT !== undefined) {
    const n = Number(env.RNTME_HTTP_PORT);
    if (!Number.isInteger(n) || n <= 0 || n > 65535) {
      errors.push({
        code: 'MANIFEST_INVALID_PORT',
        path: 'surface.http.port (from RNTME_HTTP_PORT)',
        message: `invalid port "${env.RNTME_HTTP_PORT}"`,
      });
    } else {
      port = n;
    }
  }

  const mode =
    env.RNTME_PERSISTENCE_MODE === 'persistent' || env.RNTME_PERSISTENCE_MODE === 'ephemeral'
      ? env.RNTME_PERSISTENCE_MODE
      : v.persistence.mode;
  let persistence: ValidatedManifest['persistence'];
  if (mode === 'persistent') {
    const eventStorePath =
      env.RNTME_EVENT_STORE_PATH ??
      (v.persistence.mode === 'persistent' ? v.persistence.eventStorePath : undefined);
    const qsmPath =
      env.RNTME_QSM_PATH ??
      (v.persistence.mode === 'persistent' ? v.persistence.qsmPath : undefined);
    if (!eventStorePath) {
      errors.push({
        code: 'MANIFEST_MISSING_EVENT_STORE_PATH',
        path: 'persistence.eventStorePath',
        message: 'required when persistence.mode is "persistent"',
      });
    }
    if (!qsmPath) {
      errors.push({
        code: 'MANIFEST_MISSING_QSM_PATH',
        path: 'persistence.qsmPath',
        message: 'required when persistence.mode is "persistent"',
      });
    }
    persistence = {
      mode: 'persistent',
      eventStorePath: eventStorePath ?? '',
      qsmPath: qsmPath ?? '',
    };
  } else {
    persistence = { mode: 'ephemeral' };
  }

  const bus: ValidatedManifest['bus'] =
    env.RNTME_BUS_MODE === 'in-memory' || env.RNTME_BUS_MODE === undefined
      ? { mode: 'in-memory' }
      : { mode: 'in-memory' };

  const auth: ValidatedManifest['auth'] = {
    mode: 'header',
    headerName: env.RNTME_AUTH_HEADER_NAME ?? v.auth.headerName,
    actorKind: v.auth.actorKind,
  };

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...v,
      surface: { http: { enabled: v.surface.http.enabled, port } },
      persistence,
      bus,
      auth,
    },
  };
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `pnpm -F @rntme/runtime test test/unit/manifest-validate.test.ts test/unit/env-override.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/manifest/validate.ts packages/runtime/test/unit/manifest-validate.test.ts packages/runtime/test/unit/env-override.test.ts
git commit -m "feat(runtime): validateManifest + applyEnvOverrides with defaults and coded errors"
```

---

## Phase 3 — `loadService`

### Task 5: Fixture for loadService tests

**Files:**
- Create: `packages/runtime/test/fixtures/issue-tracker/manifest.json`
- Create (copy): `packages/runtime/test/fixtures/issue-tracker/pdm.json`, `qsm.json`, `bindings.json`, `shapes.json`, `graphs/*.json`
- Create: `packages/runtime/test/fixtures/issue-tracker/ui.json`
- Create: `packages/runtime/test/fixtures/broken-manifest/manifest.json`
- Create: `packages/runtime/test/fixtures/version-mismatch/manifest.json`

- [ ] **Step 1: Write the happy-path manifest**

```json
// packages/runtime/test/fixtures/issue-tracker/manifest.json
{
  "rntmeVersion": "1.0",
  "service": { "name": "issue-tracker-api", "version": "1.0.0" },
  "surface": { "http": { "port": 3000 } }
}
```

- [ ] **Step 2: Copy existing demo artifacts into the fixture**

Run:
```bash
cp -r demo/issue-tracker-api/src/artifacts/pdm.json \
      demo/issue-tracker-api/src/artifacts/qsm.json \
      demo/issue-tracker-api/src/artifacts/bindings.json \
      demo/issue-tracker-api/src/artifacts/shapes.json \
      packages/runtime/test/fixtures/issue-tracker/
mkdir -p packages/runtime/test/fixtures/issue-tracker/graphs
cp demo/issue-tracker-api/src/artifacts/graphs/*.json \
   packages/runtime/test/fixtures/issue-tracker/graphs/
```

- [ ] **Step 3: Convert `demo/src/ui.ts` to `ui.json` inside the fixture**

Run a one-shot Node dump:
```bash
node --input-type=module -e "
  import('./demo/issue-tracker-api/src/ui.ts').catch(async () => {
    const tsx = await import('tsx');
  });
" > /dev/null
```
If that doesn't work, the simplest reliable path is: open `demo/issue-tracker-api/src/ui.ts`, copy the value of the exported `ui` const into a JSON file (remove the `as const`, `satisfies`, and trailing `;`). Save the result to `packages/runtime/test/fixtures/issue-tracker/ui.json`. Validate it round-trips:
```bash
node -e "JSON.parse(require('fs').readFileSync('packages/runtime/test/fixtures/issue-tracker/ui.json','utf8'))"
```
Expected: no output, exit 0.

- [ ] **Step 4: Write broken fixture**

```json
// packages/runtime/test/fixtures/broken-manifest/manifest.json
{
  "rntmeVersion": "1.0",
  "service": { "version": "1.0.0" }
}
```

- [ ] **Step 5: Write version-mismatch fixture**

```json
// packages/runtime/test/fixtures/version-mismatch/manifest.json
{
  "rntmeVersion": "9.0",
  "service": { "name": "x", "version": "1.0.0" }
}
```

(For these two broken/mismatch fixtures, do NOT copy the rest of the artifacts — `loadService` must fail on manifest alone.)

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/test/fixtures/
git commit -m "test(runtime): fixture artifacts for loadService"
```

---

### Task 6: Filesystem helpers

**Files:**
- Create: `packages/runtime/src/load/read-dir.ts`

- [ ] **Step 1: Implement read helpers**

```ts
// packages/runtime/src/load/read-dir.ts
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function readTextFile(dir: string, name: string): string {
  const path = join(dir, name);
  if (!existsSync(path)) {
    throw new Error(`missing required file: ${name}`);
  }
  return readFileSync(path, 'utf8');
}

export function readJsonFile<T = unknown>(dir: string, name: string): T {
  return JSON.parse(readTextFile(dir, name)) as T;
}

export function readGraphsDir(dir: string): Record<string, unknown> {
  const graphsDir = join(dir, 'graphs');
  if (!existsSync(graphsDir)) return {};
  const out: Record<string, unknown> = {};
  for (const fname of readdirSync(graphsDir)) {
    if (!fname.endsWith('.json')) continue;
    const g = JSON.parse(readFileSync(join(graphsDir, fname), 'utf8')) as { id?: string };
    if (typeof g.id !== 'string') {
      throw new Error(`graphs/${fname}: missing string "id" field`);
    }
    out[g.id] = g;
  }
  return out;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/src/load/read-dir.ts
git commit -m "feat(runtime): filesystem helpers for artifact loading"
```

---

### Task 7: `loadService` — types + tests

**Files:**
- Create: `packages/runtime/src/types.ts`
- Test: `packages/runtime/test/integration/load-service.test.ts`
- Test: `packages/runtime/test/unit/load-service.errors.test.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
// packages/runtime/src/types.ts
import type { ValidatedPdm, EventTypeSpec } from '@rntme/pdm';
import type { ValidatedQsm, ProjectionDdlSpec } from '@rntme/qsm';
import type { ValidatedBindings, OpenApiDoc } from '@rntme/bindings';
import type { ValidatedUiArtifact } from '@rntme/ui';
import type { ApplyPlan } from '@rntme/projection-consumer';
import type { ValidatedManifest, ManifestError } from './manifest/types.js';

export type GraphSpec = {
  version: '1.0-rc7';
  pdmRef: string;
  qsmRef: string;
  shapes: Record<string, { fields: Record<string, { type: string; nullable: boolean }> }>;
  graphs: Record<string, unknown>;
};

export type ValidatedService = {
  manifest: ValidatedManifest;
  pdm: ValidatedPdm;
  qsm: ValidatedQsm;
  bindings: ValidatedBindings;
  ui: ValidatedUiArtifact;
  graphSpec: GraphSpec;
  openApiDoc: OpenApiDoc;
  projectionApplyPlan: ApplyPlan;
  projectionDdls: readonly ProjectionDdlSpec[];
  eventTypes: readonly EventTypeSpec[];
};

export type ServiceError =
  | { code: 'MANIFEST_INVALID'; details: ManifestError[] }
  | { code: 'PDM_INVALID'; details: unknown[] }
  | { code: 'QSM_INVALID'; details: unknown[] }
  | { code: 'BINDINGS_INVALID'; details: unknown[] }
  | { code: 'UI_INVALID'; details: unknown[] }
  | { code: 'GRAPH_INVALID'; details: unknown[] }
  | { code: 'OPENAPI_INVALID'; details: unknown[] }
  | { code: 'IO_ERROR'; details: { message: string } };

export type RunningService = {
  httpPort: number;
  stop(): Promise<void>;
};
```

- [ ] **Step 2: Write failing integration test**

```ts
// packages/runtime/test/integration/load-service.test.ts
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'issue-tracker');

describe('loadService (happy path)', () => {
  it('loads the issue-tracker fixture', () => {
    const r = loadService(fixtureDir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.manifest.service.name).toBe('issue-tracker-api');
    expect(Object.keys(r.value.graphSpec.graphs).length).toBeGreaterThan(0);
    expect(r.value.openApiDoc.openapi).toBe('3.1.0');
    expect(r.value.projectionDdls.length).toBeGreaterThan(0);
    expect(r.value.eventTypes.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Write failing error tests**

```ts
// packages/runtime/test/unit/load-service.errors.test.ts
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');

describe('loadService (errors)', () => {
  it('returns MANIFEST_INVALID for broken manifest', () => {
    const r = loadService(join(fixtures, 'broken-manifest'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_INVALID');
  });

  it('returns MANIFEST_INVALID for rntmeVersion mismatch', () => {
    const r = loadService(join(fixtures, 'version-mismatch'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_INVALID');
  });

  it('returns IO_ERROR for nonexistent directory', () => {
    const r = loadService('/nonexistent/path/here');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('IO_ERROR');
  });
});
```

- [ ] **Step 4: Run tests, verify they fail**

Run: `pnpm -F @rntme/runtime test test/integration/load-service.test.ts test/unit/load-service.errors.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 5: Implement `load-service.ts`**

```ts
// packages/runtime/src/load/load-service.ts
import type { Result } from '@rntme/pdm';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  deriveEventTypes,
  isErr,
} from '@rntme/pdm';
import {
  parseQsm,
  validateQsm,
  generateProjectionDdl,
  isErr as isQsmErr,
} from '@rntme/qsm';
import {
  parseBindingArtifact,
  validateBindings,
  generateOpenApi,
  type BindingResolvers,
  type GraphSignature,
  type InputType,
  type OutputType,
  type ResolvedShape,
  type ScalarPrimitive,
  type InputMode,
} from '@rntme/bindings';
import { parseUiArtifact, validateUi } from '@rntme/ui';
import {
  compileApplyPlan,
} from '@rntme/projection-consumer';
import { buildBindingResolver, buildComponentResolver } from '@rntme/ui-runtime';
import { parseManifest } from '../manifest/parse.js';
import { validateManifest, applyEnvOverrides } from '../manifest/validate.js';
import type {
  GraphSpec,
  ServiceError,
  ValidatedService,
} from '../types.js';
import { readJsonFile, readTextFile, readGraphsDir } from './read-dir.js';

// Runtime's own version — must match package.json major.
const RUNTIME_VERSION = { major: 1, minor: 0, patch: 0 };

function parseInputType(raw: string): InputType {
  if (
    raw === 'integer' || raw === 'decimal' || raw === 'string' ||
    raw === 'boolean' || raw === 'date' || raw === 'datetime'
  ) {
    return { kind: 'scalar', primitive: raw };
  }
  throw new Error(`unsupported input type: "${raw}"`);
}
function parseOutputType(raw: string): OutputType {
  const m = /^(rowset|row)<([A-Za-z_][A-Za-z0-9_]*)>$/.exec(raw);
  if (!m) throw new Error(`unsupported output type: "${raw}"`);
  return { kind: m[1] as 'rowset' | 'row', shape: m[2]! };
}
type GraphJson = {
  id: string;
  signature: {
    inputs: Record<string, { type: string; mode: InputMode; default?: unknown }>;
    output: { type: string; from: string };
  };
  nodes: unknown[];
};
function toGraphSignature(g: GraphJson): GraphSignature {
  const inputs: GraphSignature['inputs'] = {};
  for (const [name, decl] of Object.entries(g.signature.inputs)) {
    const base = { type: parseInputType(decl.type), mode: decl.mode };
    inputs[name] = decl.default !== undefined ? { ...base, default: decl.default } : base;
  }
  const hasEmit = Array.isArray(g.nodes) && g.nodes.some(
    (n) => typeof n === 'object' && n !== null && (n as { type?: string }).type === 'emit',
  );
  return {
    id: g.id,
    ...(hasEmit ? { role: 'command' as const } : {}),
    inputs,
    output: { type: parseOutputType(g.signature.output.type), from: g.signature.output.from },
  };
}

export function loadService(dir: string): Result<ValidatedService, ServiceError[]> {
  // 1. Manifest
  let manifestText: string;
  try {
    manifestText = readTextFile(dir, 'manifest.json');
  } catch (e) {
    return {
      ok: false,
      errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }],
    };
  }
  const parsedManifest = parseManifest(manifestText);
  if (!parsedManifest.ok) {
    return { ok: false, errors: [{ code: 'MANIFEST_INVALID', details: parsedManifest.errors }] };
  }
  const validatedManifest = validateManifest(parsedManifest.value, RUNTIME_VERSION);
  if (!validatedManifest.ok) {
    return { ok: false, errors: [{ code: 'MANIFEST_INVALID', details: validatedManifest.errors }] };
  }
  const envApplied = applyEnvOverrides(validatedManifest.value, process.env as Record<string, string | undefined>);
  if (!envApplied.ok) {
    return { ok: false, errors: [{ code: 'MANIFEST_INVALID', details: envApplied.errors }] };
  }

  // 2. Domain artifacts — short-circuit on first error per artifact, collect across artifacts.
  const errors: ServiceError[] = [];

  // PDM
  let validatedPdmValue: ReturnType<typeof validatePdm> extends Result<infer V, infer _E> ? V : never;
  let pdmResolver: ReturnType<typeof createPdmResolver>;
  try {
    const pdmParsed = parsePdm(readTextFile(dir, 'pdm.json'));
    if (isErr(pdmParsed)) return { ok: false, errors: [{ code: 'PDM_INVALID', details: pdmParsed.errors }] };
    const v = validatePdm(pdmParsed.value);
    if (isErr(v)) return { ok: false, errors: [{ code: 'PDM_INVALID', details: v.errors }] };
    validatedPdmValue = v.value;
    pdmResolver = createPdmResolver(validatedPdmValue);
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  // QSM
  let validatedQsmValue: ReturnType<typeof validateQsm> extends Result<infer V, infer _E> ? V : never;
  try {
    const qsmParsed = parseQsm(readJsonFile(dir, 'qsm.json'));
    if (isQsmErr(qsmParsed)) return { ok: false, errors: [{ code: 'QSM_INVALID', details: qsmParsed.errors }] };
    const v = validateQsm(qsmParsed.value, pdmResolver);
    if (isQsmErr(v)) return { ok: false, errors: [{ code: 'QSM_INVALID', details: v.errors }] };
    validatedQsmValue = v.value;
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  // Graphs + shapes
  let graphsById: Record<string, GraphJson>;
  let shapes: GraphSpec['shapes'];
  try {
    graphsById = readGraphsDir(dir) as Record<string, GraphJson>;
    shapes = readJsonFile<GraphSpec['shapes']>(dir, 'shapes.json');
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }
  const graphSpec: GraphSpec = {
    version: '1.0-rc7',
    pdmRef: (validatedPdmValue as unknown as { id: string }).id,
    qsmRef: (validatedQsmValue as unknown as { id: string }).id,
    shapes,
    graphs: graphsById,
  };

  // Bindings resolvers (same shape as demo/artifacts.ts)
  const bindingResolvers: BindingResolvers = {
    resolveGraphSignature: (id) => {
      const g = graphsById[id];
      return g ? toGraphSignature(g) : null;
    },
    resolveShape: (name) => {
      const custom = shapes[name];
      if (custom) {
        const fields: ResolvedShape['fields'] = {};
        for (const [fn, f] of Object.entries(custom.fields)) {
          fields[fn] = {
            type: { kind: 'scalar', primitive: f.type as ScalarPrimitive },
            nullable: f.nullable,
          };
        }
        return { name, origin: 'custom', fields };
      }
      const e = pdmResolver.resolveEntity(name);
      if (!e) return null;
      const fields: ResolvedShape['fields'] = {};
      for (const f of e.fields) {
        fields[f.name] = {
          type: { kind: 'scalar', primitive: f.type as ScalarPrimitive },
          nullable: f.nullable,
        };
      }
      return { name, origin: 'pdm', fields };
    },
  };

  // Bindings
  let validatedBindingsValue: ReturnType<typeof validateBindings> extends Result<infer V, infer _E> ? V : never;
  try {
    const bRaw = readJsonFile(dir, 'bindings.json');
    const bParsed = parseBindingArtifact(bRaw);
    if (!bParsed.ok) return { ok: false, errors: [{ code: 'BINDINGS_INVALID', details: bParsed.errors }] };
    const v = validateBindings(bParsed.value, bindingResolvers);
    if (!v.ok) return { ok: false, errors: [{ code: 'BINDINGS_INVALID', details: v.errors }] };
    validatedBindingsValue = v.value;
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  // UI
  let validatedUiValue: ReturnType<typeof validateUi> extends Result<infer V, infer _E> ? V : never;
  try {
    const uRaw = readJsonFile(dir, 'ui.json');
    const uParsed = parseUiArtifact(uRaw);
    if (!uParsed.ok) return { ok: false, errors: [{ code: 'UI_INVALID', details: uParsed.errors }] };
    const v = validateUi(uParsed.value, {
      resolveBinding: buildBindingResolver(validatedBindingsValue, bindingResolvers.resolveShape),
      resolveComponent: buildComponentResolver(),
      resolveRoute: (p) => p in (uParsed.value as { routes: Record<string, unknown> }).routes,
    });
    if (!v.ok) return { ok: false, errors: [{ code: 'UI_INVALID', details: v.errors }] };
    validatedUiValue = v.value;
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  // OpenAPI
  const openapi = generateOpenApi(validatedBindingsValue, bindingResolvers);
  if (!openapi.ok) {
    return { ok: false, errors: [{ code: 'OPENAPI_INVALID', details: openapi.errors }] };
  }

  // Derived projection specs + apply plan
  const projectionDdls = generateProjectionDdl(validatedQsmValue, pdmResolver);
  const eventTypes = deriveEventTypes(validatedPdmValue);
  const projectionApplyPlan = compileApplyPlan({
    pdm: pdmResolver,
    qsm: validatedQsmValue,
    events: eventTypes,
  });

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      manifest: envApplied.value,
      pdm: validatedPdmValue,
      qsm: validatedQsmValue,
      bindings: validatedBindingsValue,
      ui: validatedUiValue,
      graphSpec,
      openApiDoc: openapi.value,
      projectionApplyPlan,
      projectionDdls,
      eventTypes,
    },
  };
}
```

- [ ] **Step 6: Run tests, verify pass**

Run: `pnpm -F @rntme/runtime test test/integration/load-service.test.ts test/unit/load-service.errors.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/src/types.ts packages/runtime/src/load/load-service.ts packages/runtime/test/integration/load-service.test.ts packages/runtime/test/unit/load-service.errors.test.ts
git commit -m "feat(runtime): loadService reads artifacts and returns ValidatedService"
```

---

## Phase 4 — Plugins

### Task 8: Plugin interfaces + `InMemoryBus`

**Files:**
- Create: `packages/runtime/src/plugins/interfaces.ts`
- Create: `packages/runtime/src/plugins/better-sqlite-driver.ts`
- Create: `packages/runtime/src/plugins/in-memory-bus.ts`

- [ ] **Step 1: Write `interfaces.ts`**

```ts
// packages/runtime/src/plugins/interfaces.ts
import type { Hono, Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { EventStore, KafkaProducer, ActorRef } from '@rntme/event-store';
import type { KafkaConsumer } from '@rntme/projection-consumer';
import type { ValidatedService } from '../types.js';

/** Narrow slice of better-sqlite3 used by event-store + projection-consumer + graph-ir-compiler. */
export type DbHandle = BetterSqlite3.Database;

export type DbOpenOpts = {
  purpose: 'event-store' | 'qsm';
  path: string | ':memory:';
};

export interface DbDriver {
  open(opts: DbOpenOpts): DbHandle;
}

export interface EventBus {
  producer(): KafkaProducer;
  consumer(opts: { groupId: string; topic: string }): KafkaConsumer;
  start?(): Promise<void>;
  stop?(): Promise<void>;
}

export type SurfaceContext = {
  service: ValidatedService;
  eventStore: EventStore;
  qsmDb: DbHandle;
  actorFromRequest: (c: Context) => ActorRef | null;
};

export interface Surface {
  mount(app: Hono, ctx: SurfaceContext): void;
  listen?(): Promise<{ port: number; stop(): Promise<void> }>;
}
```

- [ ] **Step 2: Write `better-sqlite-driver.ts`**

```ts
// packages/runtime/src/plugins/better-sqlite-driver.ts
import Database from 'better-sqlite3';
import type { DbDriver, DbHandle, DbOpenOpts } from './interfaces.js';

export class BetterSqliteDriver implements DbDriver {
  open(opts: DbOpenOpts): DbHandle {
    return new Database(opts.path);
  }
}
```

- [ ] **Step 3: Write `in-memory-bus.ts`**

```ts
// packages/runtime/src/plugins/in-memory-bus.ts
import type { KafkaMessage, KafkaProducer, EventEnvelope } from '@rntme/event-store';
import {
  createInMemoryKafkaConsumer,
  type InMemoryKafkaConsumer,
  type KafkaConsumer,
} from '@rntme/projection-consumer';
import type { EventBus } from './interfaces.js';

export class InMemoryBus implements EventBus {
  private readonly inner: InMemoryKafkaConsumer;

  constructor(opts: { pollIntervalMs?: number } = {}) {
    this.inner = createInMemoryKafkaConsumer({ pollIntervalMs: opts.pollIntervalMs ?? 2 });
  }

  producer(): KafkaProducer {
    const inner = this.inner;
    return {
      async send(message: KafkaMessage): Promise<void> {
        const envelope = JSON.parse(message.value) as EventEnvelope;
        inner.produce(envelope);
      },
    };
  }

  consumer(): KafkaConsumer {
    return this.inner;
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/plugins/
git commit -m "feat(runtime): plugin interfaces + BetterSqliteDriver + InMemoryBus"
```

---

### Task 9: Observability (`/health` + `/metrics`)

**Files:**
- Create: `packages/runtime/src/plugins/observability.ts`

- [ ] **Step 1: Write `observability.ts`**

```ts
// packages/runtime/src/plugins/observability.ts
import type { Hono } from 'hono';
import {
  Registry,
  Counter,
  Gauge,
  collectDefaultMetrics,
  type Metric,
} from 'prom-client';

export type HealthProbe = () => { ok: true } | { ok: false; reason: string };

export type Metrics = {
  registry: Registry;
  commandsTotal: Counter<string>;
  eventsAppendedTotal: Counter<string>;
  httpRequestsTotal: Counter<string>;
  projectionLagEvents: Gauge<string>;
  relayCursor: Gauge<string>;
};

export function createMetrics(serviceName: string): Metrics {
  const registry = new Registry();
  registry.setDefaultLabels({ service: serviceName });
  collectDefaultMetrics({ register: registry });

  const commandsTotal = new Counter({
    name: 'rntme_commands_total',
    help: 'Command executions.',
    labelNames: ['graph', 'status'] as const,
    registers: [registry],
  });
  const eventsAppendedTotal = new Counter({
    name: 'rntme_events_appended_total',
    help: 'Events appended to the log.',
    labelNames: ['stream_type'] as const,
    registers: [registry],
  });
  const httpRequestsTotal = new Counter({
    name: 'rntme_http_requests_total',
    help: 'HTTP requests served.',
    labelNames: ['route', 'method', 'status'] as const,
    registers: [registry],
  });
  const projectionLagEvents = new Gauge({
    name: 'rntme_projection_lag_events',
    help: 'Events appended minus events projected.',
    registers: [registry],
  });
  const relayCursor = new Gauge({
    name: 'rntme_relay_cursor',
    help: 'Current relay cursor position.',
    registers: [registry],
  });
  return { registry, commandsTotal, eventsAppendedTotal, httpRequestsTotal, projectionLagEvents, relayCursor };
}

export function mountObservability(
  app: Hono,
  opts: {
    healthPath: string;
    metricsPath: string;
    probe: HealthProbe;
    metrics: Metrics;
  },
): void {
  app.get(opts.healthPath, (c) => {
    const r = opts.probe();
    return r.ok ? c.json({ ok: true }) : c.json({ ok: false, reason: r.reason }, 503);
  });
  app.get(opts.metricsPath, async (c) => {
    const body = await opts.metrics.registry.metrics();
    return c.text(body, 200, { 'content-type': opts.metrics.registry.contentType });
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/src/plugins/observability.ts
git commit -m "feat(runtime): observability endpoints (/health + /metrics)"
```

---

### Task 10: `HttpSurface`

**Files:**
- Create: `packages/runtime/src/plugins/http-surface.ts`

- [ ] **Step 1: Write `http-surface.ts`**

```ts
// packages/runtime/src/plugins/http-surface.ts
import type { Hono } from 'hono';
import { createBindingsRouter } from '@rntme/bindings-http';
import { createUiApp } from '@rntme/ui-runtime';
import type { Surface, SurfaceContext } from './interfaces.js';
import { mountObservability, type Metrics, type HealthProbe } from './observability.js';

export type HttpSurfaceOptions = {
  healthPath: string;
  metricsPath: string;
  metrics: Metrics;
  healthProbe: HealthProbe;
};

export class HttpSurface implements Surface {
  constructor(private readonly opts: HttpSurfaceOptions) {}

  mount(app: Hono, ctx: SurfaceContext): void {
    const router = createBindingsRouter({
      validated: ctx.service.bindings,
      graphSpec: ctx.service.graphSpec,
      pdm: ctx.service.pdm,
      qsm: ctx.service.qsm,
      db: ctx.qsmDb,
      eventStore: ctx.eventStore,
      actorFromRequest: ctx.actorFromRequest,
      openApiDoc: ctx.service.openApiDoc,
    });
    const uiApp = createUiApp({
      artifact: ctx.service.ui,
      validatedBindings: ctx.service.bindings,
      defaultHeaders: {},
    });

    app.get('/', (c) =>
      c.json({
        name: ctx.service.manifest.service.name,
        version: ctx.service.manifest.service.version,
        rntmeVersion: ctx.service.manifest.rntmeVersion,
      }),
    );
    mountObservability(app, {
      healthPath: this.opts.healthPath,
      metricsPath: this.opts.metricsPath,
      probe: this.opts.healthProbe,
      metrics: this.opts.metrics,
    });
    app.route('/', router);
    app.route('/', uiApp);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/src/plugins/http-surface.ts
git commit -m "feat(runtime): HttpSurface composes bindings-http + ui-runtime + observability"
```

---

## Phase 5 — `startService`

### Task 11: Event pipeline wiring helper

**Files:**
- Create: `packages/runtime/src/start/wire-event-pipeline.ts`

- [ ] **Step 1: Write `wire-event-pipeline.ts`**

```ts
// packages/runtime/src/start/wire-event-pipeline.ts
import {
  SqliteEventStore,
  createRelay,
  type EventStore,
  type Relay,
} from '@rntme/event-store';
import { createProjectionConsumer, type ProjectionConsumer } from '@rntme/projection-consumer';
import type { DbHandle, DbDriver, EventBus } from '../plugins/interfaces.js';
import type { ValidatedService } from '../types.js';
import type { ValidatedManifest } from '../manifest/types.js';

export type EventPipeline = {
  eventStore: EventStore;
  qsmDb: DbHandle;
  relay: Relay;
  projectionConsumer: ProjectionConsumer;
  start(): void;
  stop(): Promise<void>;
};

export function wireEventPipeline(
  service: ValidatedService,
  db: DbDriver,
  bus: EventBus,
): EventPipeline {
  const manifest: ValidatedManifest = service.manifest;
  const eventStorePath =
    manifest.persistence.mode === 'persistent'
      ? manifest.persistence.eventStorePath
      : ':memory:';
  const qsmPath =
    manifest.persistence.mode === 'persistent' ? manifest.persistence.qsmPath : ':memory:';

  const eventStore = new SqliteEventStore({ filename: eventStorePath });
  const qsmDb = db.open({ purpose: 'qsm', path: qsmPath });

  // Apply QSM DDL (idempotent).
  for (const ddl of service.projectionDdls) {
    for (const stmt of ddl.statements) {
      qsmDb.exec(stmt);
    }
  }

  const relay: Relay = createRelay({
    store: eventStore,
    kafka: bus.producer(),
    cursorId: `${manifest.service.name}:relay`,
    pollIntervalMs: 10,
    batchSize: 100,
  });

  const projectionConsumer = createProjectionConsumer({
    kafka: bus.consumer({
      groupId: `${manifest.service.name}:projection`,
      topic: manifest.service.name,
    }),
    plan: service.projectionApplyPlan,
    db: qsmDb,
  });

  return {
    eventStore,
    qsmDb,
    relay,
    projectionConsumer,
    start(): void {
      projectionConsumer.start();
      relay.start();
    },
    async stop(): Promise<void> {
      await relay.stop();
      await projectionConsumer.stop();
      (eventStore as SqliteEventStore).close();
      qsmDb.close();
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: PASS.

(If `ProjectionDdlSpec.statements` does not exist, inspect `packages/qsm/src/projections/ddl.ts` to confirm the correct field — adjust the loop accordingly. Do not guess: open the file and use the real property name.)

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/src/start/wire-event-pipeline.ts
git commit -m "feat(runtime): wireEventPipeline — event store + relay + projection consumer"
```

---

### Task 12: Actor extractor from manifest auth

**Files:**
- Create: `packages/runtime/src/start/build-actor-from-request.ts`

- [ ] **Step 1: Write the helper**

```ts
// packages/runtime/src/start/build-actor-from-request.ts
import type { Context } from 'hono';
import type { ActorRef } from '@rntme/event-store';
import type { ValidatedManifest } from '../manifest/types.js';

export function buildActorFromRequest(
  manifest: ValidatedManifest,
): (c: Context) => ActorRef | null {
  const headerName = manifest.auth.headerName;
  const kind = manifest.auth.actorKind;
  return (c: Context) => {
    const id = c.req.header(headerName);
    if (!id) return null;
    return { kind, id } as ActorRef;
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/src/start/build-actor-from-request.ts
git commit -m "feat(runtime): buildActorFromRequest from manifest.auth"
```

---

### Task 13: `startService` — integration test

**Files:**
- Test: `packages/runtime/test/integration/startup.test.ts`
- Create: `packages/runtime/src/start/start-service.ts`

- [ ] **Step 1: Write the failing startup test**

```ts
// packages/runtime/test/integration/startup.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';
import { startService } from '../../src/start/start-service.js';
import type { RunningService } from '../../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'issue-tracker');

let running: RunningService | null = null;

afterEach(async () => {
  if (running) await running.stop();
  running = null;
});

describe('startService', () => {
  it('boots the service and serves /health', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value, {
      onReady: () => undefined,
    });
    const res = await fetch(`http://127.0.0.1:${running.httpPort}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('exposes OpenAPI + service identity', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);
    const root = await (await fetch(`http://127.0.0.1:${running.httpPort}/`)).json();
    expect((root as { name: string }).name).toBe('issue-tracker-api');
    const openapi = await (await fetch(`http://127.0.0.1:${running.httpPort}/openapi.json`)).json();
    expect((openapi as { openapi: string }).openapi).toBe('3.1.0');
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm -F @rntme/runtime test test/integration/startup.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `start-service.ts`**

```ts
// packages/runtime/src/start/start-service.ts
import { serve, type ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ActorRef } from '@rntme/event-store';
import { BetterSqliteDriver } from '../plugins/better-sqlite-driver.js';
import { InMemoryBus } from '../plugins/in-memory-bus.js';
import { HttpSurface } from '../plugins/http-surface.js';
import {
  createMetrics,
  type HealthProbe,
} from '../plugins/observability.js';
import type {
  DbDriver,
  EventBus,
  Surface,
} from '../plugins/interfaces.js';
import type { RunningService, ValidatedService } from '../types.js';
import { wireEventPipeline } from './wire-event-pipeline.js';
import { buildActorFromRequest } from './build-actor-from-request.js';

export type RuntimeConfig = {
  db?: DbDriver;
  bus?: EventBus;
  surfaces?: Surface[];
  actorFromRequest?: (c: Context) => ActorRef | null;
  onReady?: (info: { port: number }) => void;
};

export async function startService(
  service: ValidatedService,
  config: Partial<RuntimeConfig> = {},
): Promise<RunningService> {
  const db = config.db ?? new BetterSqliteDriver();
  const bus = config.bus ?? new InMemoryBus();
  const actorFromRequest =
    config.actorFromRequest ?? buildActorFromRequest(service.manifest);

  if (bus.start) await bus.start();

  const pipeline = wireEventPipeline(service, db, bus);
  pipeline.start();

  const metrics = createMetrics(service.manifest.service.name);
  let healthy = true;
  const probe: HealthProbe = () =>
    healthy ? { ok: true } : { ok: false, reason: 'pipeline stopped' };

  const surfaces =
    config.surfaces ??
    [
      new HttpSurface({
        healthPath: service.manifest.observability.health.path,
        metricsPath: service.manifest.observability.metrics.path,
        metrics,
        healthProbe: probe,
      }),
    ];

  const app = new Hono();
  const ctx = {
    service,
    eventStore: pipeline.eventStore,
    qsmDb: pipeline.qsmDb,
    actorFromRequest,
  };
  for (const s of surfaces) s.mount(app, ctx);

  const listenPort = service.manifest.surface.http.port;
  const server: ServerType = serve({ fetch: app.fetch, port: listenPort });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : listenPort;

  config.onReady?.({ port });
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      msg: 'rntme runtime ready',
      service: service.manifest.service.name,
      port,
    }),
  );

  return {
    httpPort: port,
    async stop(): Promise<void> {
      healthy = false;
      await new Promise<void>((resolve, reject) =>
        server.close((err?: Error) => (err ? reject(err) : resolve())),
      );
      await pipeline.stop();
      if (bus.stop) await bus.stop();
    },
  };
}
```

Add `port: 0` fallback handling by setting the manifest port to `0` in tests where a dynamic port is required; the integration test above uses the manifest value.

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm -F @rntme/runtime test test/integration/startup.test.ts`
Expected: PASS.

(If port 3000 is in use on the test machine, change the fixture's `manifest.json` to `"port": 0` and refresh the assertion — listener port will come from `running.httpPort`.)

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/start/start-service.ts packages/runtime/test/integration/startup.test.ts
git commit -m "feat(runtime): startService boots pipeline + surfaces and exposes identity"
```

---

### Task 14: Shutdown test

**Files:**
- Test: `packages/runtime/test/integration/shutdown.test.ts`

- [ ] **Step 1: Write test**

```ts
// packages/runtime/test/integration/shutdown.test.ts
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';
import { startService } from '../../src/start/start-service.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'issue-tracker');

describe('startService shutdown', () => {
  it('closes the listener and the pipeline', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const running = await startService(loaded.value);
    const port = running.httpPort;
    await running.stop();

    // After shutdown, the port must no longer accept TCP — fetch rejects with ECONNREFUSED.
    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm -F @rntme/runtime test test/integration/shutdown.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/test/integration/shutdown.test.ts
git commit -m "test(runtime): verify graceful shutdown closes listener and pipeline"
```

---

### Task 15: Health + metrics endpoint test

**Files:**
- Test: `packages/runtime/test/integration/health-metrics.test.ts`

- [ ] **Step 1: Write test**

```ts
// packages/runtime/test/integration/health-metrics.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';
import { startService } from '../../src/start/start-service.js';
import type { RunningService } from '../../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'issue-tracker');

let running: RunningService | null = null;

afterEach(async () => {
  if (running) await running.stop();
  running = null;
});

describe('observability endpoints', () => {
  it('serves /metrics in Prometheus text format', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);
    const res = await fetch(`http://127.0.0.1:${running.httpPort}/metrics`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('rntme_commands_total');
    expect(body).toContain('rntme_events_appended_total');
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm -F @rntme/runtime test test/integration/health-metrics.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/test/integration/health-metrics.test.ts
git commit -m "test(runtime): /metrics exposes rntme counters in Prometheus format"
```

---

## Phase 6 — Public API + contract test-kit

### Task 16: Wire public exports

**Files:**
- Modify: `packages/runtime/src/index.ts`

- [ ] **Step 1: Replace `index.ts` with the full public surface**

```ts
// packages/runtime/src/index.ts
export const VERSION = '0.0.0';

export { loadService } from './load/load-service.js';
export { startService, type RuntimeConfig } from './start/start-service.js';
export { buildActorFromRequest } from './start/build-actor-from-request.js';

export type {
  ValidatedService,
  RunningService,
  ServiceError,
  GraphSpec,
} from './types.js';

export type {
  ParsedManifest,
  ValidatedManifest,
  ManifestError,
  ManifestErrorCode,
} from './manifest/types.js';
export { parseManifest } from './manifest/parse.js';
export { validateManifest, applyEnvOverrides } from './manifest/validate.js';

export type {
  DbDriver,
  DbHandle,
  DbOpenOpts,
  EventBus,
  Surface,
  SurfaceContext,
} from './plugins/interfaces.js';
export { BetterSqliteDriver } from './plugins/better-sqlite-driver.js';
export { InMemoryBus } from './plugins/in-memory-bus.js';
export { HttpSurface } from './plugins/http-surface.js';
export {
  createMetrics,
  mountObservability,
  type Metrics,
  type HealthProbe,
} from './plugins/observability.js';

// Contract test-kit (implemented in the next task)
export {
  runDbDriverContract,
  runEventBusContract,
  runSurfaceContract,
} from './plugins/contract-tests.js';
```

- [ ] **Step 2: Typecheck (will fail on the contract-tests import)**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: FAIL referencing `plugins/contract-tests.js` — next task fixes this.

- [ ] **Step 3: Skip commit until contract tests land (Task 17).**

---

### Task 17: Contract test-kit

**Files:**
- Create: `packages/runtime/src/plugins/contract-tests.ts`
- Test: `packages/runtime/test/integration/plugin-contracts.test.ts`

- [ ] **Step 1: Implement the contract functions**

```ts
// packages/runtime/src/plugins/contract-tests.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { DbDriver, EventBus, Surface, SurfaceContext } from './interfaces.js';

export function runDbDriverContract(driver: DbDriver): void {
  describe('DbDriver contract', () => {
    it('opens :memory: and executes DDL', () => {
      const db = driver.open({ purpose: 'qsm', path: ':memory:' });
      db.exec('CREATE TABLE t (a INTEGER)');
      const stmt = db.prepare('INSERT INTO t VALUES (?)');
      stmt.run(1);
      const rows = db.prepare('SELECT a FROM t').all() as { a: number }[];
      expect(rows).toEqual([{ a: 1 }]);
      db.close();
    });

    it('supports transactions', () => {
      const db = driver.open({ purpose: 'qsm', path: ':memory:' });
      db.exec('CREATE TABLE t (a INTEGER)');
      const insert = db.prepare('INSERT INTO t VALUES (?)');
      const tx = db.transaction((vals: number[]) => {
        for (const v of vals) insert.run(v);
      });
      tx([1, 2, 3]);
      const rows = db.prepare('SELECT COUNT(*) AS n FROM t').get() as { n: number };
      expect(rows.n).toBe(3);
      db.close();
    });
  });
}

export function runEventBusContract(makeBus: () => EventBus): void {
  describe('EventBus contract', () => {
    it('delivers produced messages to a consumer', async () => {
      const bus = makeBus();
      const producer = bus.producer();
      const consumer = bus.consumer({ groupId: 'g', topic: 't' });
      const received: unknown[] = [];
      const sub = consumer.subscribe(async (msg) => {
        received.push(msg);
      });
      await producer.send({
        topic: 't',
        key: 'k',
        value: JSON.stringify({
          eventId: 'e1',
          stream: 'a-1',
          version: 1,
          payload: {},
          schemaVersion: 1,
          occurredAt: new Date().toISOString(),
          type: 'Noop',
          actor: null,
        }),
      });
      // Allow the in-memory loop to deliver.
      await new Promise((r) => setTimeout(r, 20));
      expect(received.length).toBe(1);
      await sub.stop();
    });
  });
}

export function runSurfaceContract(makeSurface: () => Surface): void {
  describe('Surface contract', () => {
    it('mounts onto a Hono app without throwing', () => {
      const surface = makeSurface();
      const app = new Hono();
      const ctx = {
        service: {} as SurfaceContext['service'],
        eventStore: {} as SurfaceContext['eventStore'],
        qsmDb: {} as SurfaceContext['qsmDb'],
        actorFromRequest: () => null,
      } as SurfaceContext;
      // Contract requires mount() to never throw on well-typed input; full behavior is tested via startService.
      expect(() => surface.mount(app, ctx)).not.toThrow();
    });
  });
}
```

- [ ] **Step 2: Write the test that runs contracts against MVP defaults**

```ts
// packages/runtime/test/integration/plugin-contracts.test.ts
import { runDbDriverContract, runEventBusContract } from '../../src/plugins/contract-tests.js';
import { BetterSqliteDriver } from '../../src/plugins/better-sqlite-driver.js';
import { InMemoryBus } from '../../src/plugins/in-memory-bus.js';

runDbDriverContract(new BetterSqliteDriver());
runEventBusContract(() => new InMemoryBus());
// runSurfaceContract is exercised via startService; no direct contract for HttpSurface
// because its behavior is validated by the HTTP integration tests.
```

- [ ] **Step 3: Run tests**

Run: `pnpm -F @rntme/runtime test test/integration/plugin-contracts.test.ts`
Expected: PASS. If the EventBus contract fails because the in-memory consumer interface signature differs, open `packages/projection-consumer/src/kafka/in-memory.ts` to find the real subscribe/consume API and adjust the contract test to call the real method names.

- [ ] **Step 4: Re-run full typecheck**

Run: `pnpm -F @rntme/runtime typecheck && pnpm -F @rntme/runtime build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/plugins/contract-tests.ts packages/runtime/src/index.ts packages/runtime/test/integration/plugin-contracts.test.ts
git commit -m "feat(runtime): public exports + plugin contract test-kit"
```

---

## Phase 7 — CLI

### Task 18: `rntme-runtime` CLI

**Files:**
- Create: `packages/runtime/src/bin/runtime.ts`
- Test: `packages/runtime/test/e2e/validate-cli.test.ts`

- [ ] **Step 1: Write the CLI**

```ts
// packages/runtime/src/bin/runtime.ts
#!/usr/bin/env node
import { loadService } from '../load/load-service.js';
import { startService } from '../start/start-service.js';

function usage(): never {
  // eslint-disable-next-line no-console
  console.error('usage: rntme-runtime <start|validate> [artifacts-dir]');
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, maybeDir] = process.argv.slice(2);
  const dir = maybeDir ?? process.env.RNTME_ARTIFACTS_DIR ?? '/srv/artifacts';

  if (cmd === 'validate') {
    const r = loadService(dir);
    if (!r.ok) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ ok: false, errors: r.errors }, null, 2));
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        ok: true,
        service: r.value.manifest.service.name,
        graphs: Object.keys(r.value.graphSpec.graphs).length,
      }),
    );
    return;
  }

  if (cmd === 'start') {
    const r = loadService(dir);
    if (!r.ok) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ ok: false, errors: r.errors }, null, 2));
      process.exit(1);
    }
    const running = await startService(r.value);
    const shutdown = async (): Promise<void> => {
      await running.stop();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }

  usage();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ fatal: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
```

- [ ] **Step 2: Write the CLI e2e test**

```ts
// packages/runtime/test/e2e/validate-cli.test.ts
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');
const cli = join(here, '..', '..', 'dist', 'bin', 'runtime.js');

describe('rntme-runtime validate', () => {
  it('exits 0 on a valid fixture', () => {
    const r = spawnSync('node', [cli, 'validate', join(fixtures, 'issue-tracker')]);
    if (r.status !== 0) {
      // eslint-disable-next-line no-console
      console.error(r.stderr.toString());
    }
    expect(r.status).toBe(0);
  });

  it('exits 1 on broken manifest', () => {
    const r = spawnSync('node', [cli, 'validate', join(fixtures, 'broken-manifest')]);
    expect(r.status).toBe(1);
    expect(r.stderr.toString()).toContain('MANIFEST_INVALID');
  });
});
```

- [ ] **Step 3: Build then run the CLI test**

Run:
```bash
pnpm -F @rntme/runtime build
pnpm -F @rntme/runtime test test/e2e/validate-cli.test.ts
```
Expected: PASS. The build must emit `dist/bin/runtime.js` with a shebang + executable bit; `tsc` preserves the shebang and the `bin` entry in `package.json` handles executability at install time.

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/src/bin/runtime.ts packages/runtime/test/e2e/validate-cli.test.ts
git commit -m "feat(runtime): CLI — rntme-runtime {start,validate}"
```

---

## Phase 8 — E2E against the fixture

### Task 19: End-to-end issue-tracker smoke

**Files:**
- Test: `packages/runtime/test/e2e/issue-tracker.test.ts`

- [ ] **Step 1: Write the test**

```ts
// packages/runtime/test/e2e/issue-tracker.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';
import { startService } from '../../src/start/start-service.js';
import type { RunningService } from '../../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'issue-tracker');

let running: RunningService | null = null;

afterEach(async () => {
  if (running) await running.stop();
  running = null;
});

describe('issue-tracker e2e via @rntme/runtime', () => {
  it('creates and reads an issue end-to-end', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);
    const base = `http://127.0.0.1:${running.httpPort}`;

    const create = await fetch(`${base}/v1/issues`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-actor-id': 'alice',
      },
      body: JSON.stringify({
        issueId: 9001,
        title: 'e2e via runtime',
        projectId: 1,
        reporterId: 1,
        priority: 'high',
        storyPoints: 1,
      }),
    });
    expect(create.status).toBe(200);

    // Wait for projection to apply.
    await new Promise((r) => setTimeout(r, 100));

    const list = await fetch(`${base}/v1/issues?status=open&limit=50`);
    expect(list.status).toBe(200);
    const body = (await list.json()) as { rows: { title: string }[] };
    expect(body.rows.some((row) => row.title === 'e2e via runtime')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm -F @rntme/runtime test test/e2e/issue-tracker.test.ts`
Expected: PASS.

(If the e2e fails because the fixture's seed data differs from demo expectations, rebuild the fixture by re-copying from `demo/issue-tracker-api/src/artifacts/` — the current test asserts only on the issue the test itself created, so it does not depend on a seeded row.)

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/test/e2e/issue-tracker.test.ts
git commit -m "test(runtime): e2e smoke for issue-tracker fixture via startService"
```

---

## Phase 9 — Demo migration

### Task 20: Move artifacts out of `src/`

**Files:**
- Move: `demo/issue-tracker-api/src/artifacts/` → `demo/issue-tracker-api/artifacts/`

- [ ] **Step 1: Move the folder**

```bash
git mv demo/issue-tracker-api/src/artifacts demo/issue-tracker-api/artifacts
```

- [ ] **Step 2: Typecheck demo (will fail — `src/artifacts.ts` references moved paths)**

Run: `pnpm -F @rntme/issue-tracker-api-demo typecheck`
Expected: FAIL — next tasks fix this.

- [ ] **Step 3: Do not commit yet.** Continue through Task 24 and commit as one demo-migration change.

---

### Task 21: Generate `manifest.json` + `ui.json`

**Files:**
- Create: `demo/issue-tracker-api/artifacts/manifest.json`
- Create: `demo/issue-tracker-api/artifacts/ui.json`

- [ ] **Step 1: Write `manifest.json`**

```json
// demo/issue-tracker-api/artifacts/manifest.json
{
  "rntmeVersion": "1.0",
  "service": { "name": "issue-tracker-api", "version": "1.0.0" },
  "surface": { "http": { "port": 3000 } }
}
```

- [ ] **Step 2: Emit `ui.json` from the TS source via a one-off script**

Create a temporary TypeScript file `demo/issue-tracker-api/scripts/dump-ui.ts`:

```ts
// demo/issue-tracker-api/scripts/dump-ui.ts
import { writeFileSync } from 'node:fs';
import { ui } from '../src/ui.js';
writeFileSync('artifacts/ui.json', JSON.stringify(ui, null, 2));
```

Run:
```bash
cd demo/issue-tracker-api
pnpm exec tsx scripts/dump-ui.ts
ls -la artifacts/ui.json
```
Expected: the file exists and is valid JSON.

Then delete the scratch script:
```bash
rm demo/issue-tracker-api/scripts/dump-ui.ts
rmdir demo/issue-tracker-api/scripts 2>/dev/null || true
```

---

### Task 22: Shrink `src/server.ts` and remove old glue

**Files:**
- Replace: `demo/issue-tracker-api/src/server.ts`
- Delete: `demo/issue-tracker-api/src/artifacts.ts`
- Delete: `demo/issue-tracker-api/src/events.ts`
- Delete: `demo/issue-tracker-api/src/ui.ts`
- Delete: `demo/issue-tracker-api/src/db/seed.ts`

- [ ] **Step 1: Rewrite `server.ts`**

```ts
// demo/issue-tracker-api/src/server.ts
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService, startService } from '@rntme/runtime';

const here = dirname(fileURLToPath(import.meta.url));
const artifactsDir = join(here, '..', 'artifacts');

const loaded = loadService(artifactsDir);
if (!loaded.ok) {
  console.error(JSON.stringify({ ok: false, errors: loaded.errors }, null, 2));
  process.exit(1);
}

const running = await startService(loaded.value);

const shutdown = async (): Promise<void> => {
  await running.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

- [ ] **Step 2: Delete obsolete files**

```bash
git rm demo/issue-tracker-api/src/artifacts.ts \
       demo/issue-tracker-api/src/events.ts \
       demo/issue-tracker-api/src/ui.ts \
       demo/issue-tracker-api/src/db/seed.ts
rmdir demo/issue-tracker-api/src/db 2>/dev/null || true
```

---

### Task 23: Update demo `package.json`

**Files:**
- Modify: `demo/issue-tracker-api/package.json`

- [ ] **Step 1: Replace dependencies block and scripts**

Current deps list (keep only what `src/server.ts` imports directly):

```json
{
  "name": "@rntme/issue-tracker-api-demo",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Demo: issue tracker service built from artifacts + @rntme/runtime.",
  "scripts": {
    "start": "tsx src/server.ts",
    "start:runtime-cli": "rntme-runtime start ./artifacts",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@rntme/runtime": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

Notes:
- `@hono/node-server`, `hono`, `better-sqlite3`, and the individual `@rntme/*` core packages move behind `@rntme/runtime` and are no longer direct deps of the demo.
- `seed` script removed (dead code now).

- [ ] **Step 2: Run install + build + typecheck + tests**

Run:
```bash
pnpm install
pnpm -F @rntme/issue-tracker-api-demo typecheck
pnpm -F @rntme/issue-tracker-api-demo test
```
Expected: all green.

---

### Task 24: Commit the demo migration

- [ ] **Step 1: Commit**

```bash
git add demo/issue-tracker-api/artifacts demo/issue-tracker-api/src demo/issue-tracker-api/package.json pnpm-lock.yaml
git commit -m "refactor(demo): migrate issue-tracker-api to @rntme/runtime; delete hand-written glue"
```

- [ ] **Step 2: Sanity-check end-to-end from the repo root**

Run:
```bash
pnpm -r run build
pnpm -r run test
pnpm -r run lint
```
Expected: all green.

- [ ] **Step 3: Commit any fallout (if lint or typecheck in other packages changed)**

Only if the previous step produced edits. Otherwise skip.

---

## Phase 10 — Docker + release

### Task 25: Runtime Dockerfile + template

**Files:**
- Create: `packages/runtime/Dockerfile`
- Create: `packages/runtime/Dockerfile.template`
- Create: `packages/runtime/.dockerignore`

- [ ] **Step 1: Write `.dockerignore`**

```
node_modules
test
dist/**/*.map
*.log
.git
```

- [ ] **Step 2: Write `Dockerfile`**

```dockerfile
# packages/runtime/Dockerfile
# Build from repo root:
#   docker build -f packages/runtime/Dockerfile -t ghcr.io/vladprrs/rntme-runtime:dev .

FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY demo ./demo
RUN corepack enable \
  && pnpm install --frozen-lockfile \
  && pnpm -r --filter "@rntme/*" build

FROM node:20-alpine
WORKDIR /srv
COPY --from=builder /build/packages/runtime/dist ./dist
COPY --from=builder /build/packages/runtime/package.json ./package.json
COPY --from=builder /build/node_modules ./node_modules
ENV NODE_ENV=production \
    RNTME_ARTIFACTS_DIR=/srv/artifacts \
    RNTME_HTTP_PORT=3000
USER node
EXPOSE 3000
ENTRYPOINT ["node", "dist/bin/runtime.js", "start"]
CMD ["/srv/artifacts"]
```

- [ ] **Step 3: Write `Dockerfile.template`**

```dockerfile
# packages/runtime/Dockerfile.template
# Copy this file into a directory that contains your artifacts (pdm.json, etc.)
# and run:
#   docker build -t myorg/my-service:VERSION .

FROM ghcr.io/vladprrs/rntme-runtime:1.0
COPY . /srv/artifacts
```

- [ ] **Step 4: Build the image locally to validate**

Run (from repo root):
```bash
docker build -f packages/runtime/Dockerfile -t rntme-runtime:dev .
```
Expected: build succeeds. If it fails on `pnpm install`, re-check that `pnpm-lock.yaml` is up to date.

- [ ] **Step 5: Smoke-test the image against the demo artifacts**

Run:
```bash
docker run --rm -d --name rntme-smoke -p 13000:3000 \
  -v "$(pwd)/demo/issue-tracker-api/artifacts:/srv/artifacts:ro" \
  rntme-runtime:dev
sleep 2
curl -sf http://127.0.0.1:13000/health
docker rm -f rntme-smoke
```
Expected: `{"ok":true}`.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/Dockerfile packages/runtime/Dockerfile.template packages/runtime/.dockerignore
git commit -m "build(runtime): multi-stage Dockerfile + Dockerfile.template for bake-in"
```

---

### Task 26: Demo Dockerfile (bake-in example)

**Files:**
- Create: `demo/issue-tracker-api/Dockerfile`

- [ ] **Step 1: Copy the template**

```dockerfile
# demo/issue-tracker-api/Dockerfile
FROM ghcr.io/vladprrs/rntme-runtime:1.0
COPY artifacts /srv/artifacts
```

(This references the published image tag. For a local test before the image is published upstream, temporarily swap `ghcr.io/vladprrs/rntme-runtime:1.0` for `rntme-runtime:dev` from Task 25.)

- [ ] **Step 2: Commit**

```bash
git add demo/issue-tracker-api/Dockerfile
git commit -m "build(demo): bake-in Dockerfile on top of rntme-runtime base image"
```

---

### Task 27: GHCR release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/release.yml
name: release

on:
  push:
    tags: ['v*.*.*']

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: '9.12.0'

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org/'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm -r --filter "@rntme/*" build
      - run: pnpm -r --filter "@rntme/*" test

      - name: Derive version
        id: ver
        run: echo "v=${GITHUB_REF_NAME#v}" >> $GITHUB_OUTPUT

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v6
        with:
          context: .
          file: packages/runtime/Dockerfile
          push: true
          tags: |
            ghcr.io/vladprrs/rntme-runtime:${{ steps.ver.outputs.v }}
            ghcr.io/vladprrs/rntme-runtime:latest

      - run: pnpm -F @rntme/runtime publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Notes:
- The workflow only fires on `v<semver>` tags. Pushing to `main` does not publish.
- `NPM_TOKEN` must be set in repo secrets before the first tag.
- Minor/major floating tags (`:1.0`, `:1`) are a follow-up; keep the first release simple with exact + `latest`.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: release workflow — tag-triggered GHCR image + npm publish"
```

---

## Phase 11 — Docs

### Task 28: Package README

**Files:**
- Create: `packages/runtime/README.md`

- [ ] **Step 1: Write the README**

```markdown
# @rntme/runtime

Zero-code runtime for an rntme service. Consumes a directory of validated JSON artifacts — PDM, QSM, graphs, bindings, UI, plus a `manifest.json` — and exposes the corresponding HTTP surface (bindings + SPA + OpenAPI + `/health` + `/metrics`).

## Usage — mount artifacts into the base image

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/artifacts:/srv/artifacts:ro" \
  ghcr.io/vladprrs/rntme-runtime:1.0
```

The artifacts directory must contain:

```
artifacts/
  manifest.json
  pdm.json qsm.json bindings.json shapes.json ui.json
  graphs/*.json
```

## Usage — bake artifacts into your own image

Copy `node_modules/@rntme/runtime/Dockerfile.template` next to your artifacts, then:

```bash
docker build -t myorg/my-service:1.0.0 .
```

## Embedding

```ts
import { loadService, startService } from '@rntme/runtime';

const loaded = loadService('./artifacts');
if (!loaded.ok) { console.error(loaded.errors); process.exit(1); }
const running = await startService(loaded.value);
// running.httpPort, running.stop()
```

## `manifest.json`

See the design doc `docs/superpowers/specs/2026-04-15-runtime-packaging-design.md` §4.1 for the authoritative schema.

## CLI

- `rntme-runtime start <dir>` — boot the service (Docker ENTRYPOINT).
- `rntme-runtime validate <dir>` — parse + validate all artifacts and exit; useful in CI.

## Plugin seams

- `DbDriver` / `EventBus` / `Surface` interfaces are exported from the package. MVP ships `BetterSqliteDriver`, `InMemoryBus`, `HttpSurface`. Future packages (`@rntme/bus-kafka`, `@rntme/db-turso`, `@rntme/bindings-grpc`) implement these and plug in via `RuntimeConfig`.
```

- [ ] **Step 2: Commit**

```bash
git add packages/runtime/README.md
git commit -m "docs(runtime): README with usage, embedding, plugin seams"
```

---

### Task 29: Update root README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the runtime row to the packages table**

Find the existing packages table at `README.md` and append a row:

```markdown
| [`@rntme/runtime`](packages/runtime) | Service runtime: reads a folder of artifacts + `manifest.json` and serves the full HTTP surface. Published as both an npm package and the `ghcr.io/vladprrs/rntme-runtime` image. |
```

Also update the dependency graph ASCII art: `@rntme/runtime` depends on every other `@rntme/*` package (it's the top layer).

- [ ] **Step 2: Add a new top-level "Run a service" subsection under Quick start**

```markdown
### Run a service with the runtime

The runtime is the production face of the project. Given a folder of artifacts it boots the whole stack with no user code:

\`\`\`bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/demo/issue-tracker-api/artifacts:/srv/artifacts:ro" \
  ghcr.io/vladprrs/rntme-runtime:1.0
\`\`\`

Or embed it (the demo does this):

\`\`\`ts
import { loadService, startService } from '@rntme/runtime';
const loaded = loadService('./artifacts');
if (loaded.ok) await startService(loaded.value);
\`\`\`
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document @rntme/runtime + zero-code run path in root README"
```

---

## Self-Review

**Spec coverage check** (§s refer to `docs/superpowers/specs/2026-04-15-runtime-packaging-design.md`):

- §3.1 distribution, both paths — Task 25 (base image) + Task 26 (bake-in template).
- §3.2 single package + CLI — Task 1 scaffold + Task 18 CLI.
- §3.3 no existing-package changes — confirmed in spec; nothing to cover here.
- §4 artifact layout — Task 5 fixture + Task 20 demo relocation.
- §4.1 manifest schema — Tasks 2–4.
- §5 startup sequence — Tasks 11–13.
- §5.1 `/health`, §5.2 `/metrics` — Tasks 9 + 15.
- §5.3 graceful shutdown — Task 14.
- §6 public API — Task 16.
- §7 plugin seams — Task 8 (interfaces + defaults), Task 17 (contract test-kit).
- §8 Docker + tag/release — Tasks 25–27.
- §9 migration of demo — Tasks 20–24.
- §10 risks — mitigations live in the Dockerfile (multi-stage), the manifest validator (major-mismatch), and the e2e coverage (projection lag is exercised by Task 19).
- §11 decision log — all nine decisions are implemented in the listed tasks.
- §12 out-of-scope — nothing to implement (by definition).

No gaps. No "TBD"/"TODO"/"similar to" shortcuts. Type names are consistent across tasks (`ValidatedService`, `RunningService`, `RuntimeConfig`, `DbDriver`/`DbHandle`, `EventBus`, `Surface`, `ManifestError`/`ServiceError`). Method names in test code match implementations (`loadService.ok`, `startService` returning `{ httpPort, stop }`, `registry.metrics()` on prom-client).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-runtime-packaging.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
