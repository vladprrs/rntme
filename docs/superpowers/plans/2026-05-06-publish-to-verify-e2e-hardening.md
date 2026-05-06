# Publish-to-verify e2e hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-05-06-publish-to-verify-e2e-hardening-design.md`](../specs/2026-05-06-publish-to-verify-e2e-hardening-design.md)

**Goal:** Make the publish → plan → render → apply → verify path produce actionable feedback at every stage and ship the CLI surface needed to operate it.

**Architecture:** Move bundle materialization from `apps/platform-http` into `@rntme/blueprint` so the CLI dry-run runs the same composition the server runs. Replace the flat `error.message` string with a structured `errors[]` cause tree across blueprint-validation and deploy-pipeline endpoints. Make `StartDeploymentRequestSchema.configOverrides` strict and accept `publicBaseUrl`. Add the missing CLI commands (`target create`, `token create --preset`), fix the `--json` flag collision in `target set-config`, and add scope-aware login + 403 hints.

**Tech Stack:** TypeScript, pnpm workspaces, vitest, zod v4, hono, Result-typed validators (`Result<T, PlatformError>` everywhere on the platform side, `Result<T, BlueprintError>` etc. inside artifact packages).

**Phase ordering:** Phase 1 (foundation in `@rntme/blueprint` + `@rntme/platform-core`) → Phase 2 (`apps/platform-http` and `deploy-core` text) → Phase 3 (CLI parser/render parity) → Phase 4 (CLI new commands) → Phase 5 (docs). Each phase is a coherent PR boundary; tasks within a phase land as small commits.

---

## Phase 1 — Foundation

### Task 1: Re-export `CanonicalBundle` from `@rntme/blueprint`

The Zod schema lives in `@rntme/platform-core/src/schemas/project-version.ts` (lines 50-57). We are NOT moving the schema; both the CLI bundle builder and the platform-http API need access to the same schema. Instead, `@rntme/blueprint` re-exports the type so CLI can import it without depending on `@rntme/platform-core`.

**Files:**
- Modify: `packages/artifacts/blueprint/package.json` (add `@rntme/platform-core` dep)
- Modify: `packages/artifacts/blueprint/src/index.ts`
- Create: `packages/artifacts/blueprint/test/unit/canonical-bundle-export.test.ts`

- [ ] **Step 1: Add `@rntme/platform-core` to blueprint's dependencies**

Edit `packages/artifacts/blueprint/package.json`:

```json
"dependencies": {
  "@rntme/bindings": "workspace:*",
  "@rntme/contracts-module-v1": "workspace:*",
  "@rntme/pdm": "workspace:*",
  "@rntme/platform-core": "workspace:*",
  "@rntme/qsm": "workspace:*",
  "@rntme/seed": "workspace:*",
  "@rntme/ui": "workspace:*",
  "@rntme/workflows": "workspace:*",
  "zod": "^4.0.0"
}
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing export test**

Create `packages/artifacts/blueprint/test/unit/canonical-bundle-export.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { CanonicalBundle } from '@rntme/blueprint';

describe('CanonicalBundle re-export', () => {
  it('is structurally compatible with version 2 bundles', () => {
    expectTypeOf<CanonicalBundle>().toMatchTypeOf<{
      version: 1 | 2;
      files: Readonly<Record<string, unknown>>;
      assets?: Readonly<Record<string, string>>;
    }>();
  });
});
```

- [ ] **Step 3: Run the test, confirm failure**

Run: `pnpm -F @rntme/blueprint test test/unit/canonical-bundle-export.test.ts`
Expected: FAIL — `Module '@rntme/blueprint' has no exported member 'CanonicalBundle'`.

- [ ] **Step 4: Add the re-export**

Append to `packages/artifacts/blueprint/src/index.ts`:

```ts
export type { CanonicalBundle } from '@rntme/platform-core';
```

- [ ] **Step 5: Run test, confirm pass**

Run: `pnpm -F @rntme/blueprint test test/unit/canonical-bundle-export.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/artifacts/blueprint/package.json packages/artifacts/blueprint/src/index.ts packages/artifacts/blueprint/test/unit/canonical-bundle-export.test.ts pnpm-lock.yaml
git commit -m "feat(blueprint): re-export CanonicalBundle for client-side bundle parity"
```

---

### Task 2: Add `materializeBundle` to `@rntme/blueprint`

Move the implementation from `apps/platform-http/src/bundle/materialize.ts` into the blueprint package without changing behaviour.

**Files:**
- Create: `packages/artifacts/blueprint/src/load/materialize.ts`
- Create: `packages/artifacts/blueprint/test/unit/materialize.test.ts`
- Modify: `packages/artifacts/blueprint/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/artifacts/blueprint/test/unit/materialize.test.ts`:

```ts
import { rmSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { materializeBundle } from '@rntme/blueprint';
import type { CanonicalBundle } from '@rntme/blueprint';

const baseBundle: CanonicalBundle = {
  version: 2,
  files: {
    'project.json': { name: 'demo', services: ['app'] },
  },
  assets: {
    'workflows/foo.bpmn': Buffer.from('<bpmn-xml/>').toString('base64'),
  },
};

describe('materializeBundle', () => {
  it('writes files and assets to a fresh temp directory', async () => {
    const dir = await materializeBundle(baseBundle);
    try {
      expect(statSync(join(dir, 'project.json')).isFile()).toBe(true);
      expect(JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'))).toEqual({
        name: 'demo',
        services: ['app'],
      });
      expect(readFileSync(join(dir, 'workflows/foo.bpmn'), 'utf8')).toBe('<bpmn-xml/>');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects path traversal attempts', async () => {
    const bad: CanonicalBundle = {
      version: 2,
      files: { 'project.json': {}, '../escape.json': {} },
      assets: {},
    };
    await expect(materializeBundle(bad)).rejects.toThrow(/DEPLOY_BUNDLE_PATH_UNSAFE/);
  });

  it('rejects asset/file path collisions', async () => {
    const collision: CanonicalBundle = {
      version: 2,
      files: { 'project.json': {}, 'a/b.json': {} },
      assets: { 'a/b.json': Buffer.from('x').toString('base64') },
    };
    await expect(materializeBundle(collision)).rejects.toThrow(/DEPLOY_BUNDLE_PATH_(UNSAFE|COLLISION)/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/blueprint test test/unit/materialize.test.ts`
Expected: FAIL — `materializeBundle` is not exported.

- [ ] **Step 3: Implement `materializeBundle`**

Create `packages/artifacts/blueprint/src/load/materialize.ts`:

```ts
import { Buffer } from 'node:buffer';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { CanonicalBundle } from '@rntme/platform-core';

export async function materializeBundle(bundle: CanonicalBundle): Promise<string> {
  if (typeof bundle.version === 'number' && bundle.version > 2) {
    throw new Error(`DEPLOY_BUNDLE_VERSION_UNSUPPORTED: bundle version ${bundle.version} not supported`);
  }

  const dir = await mkdtemp(join(tmpdir(), 'rntme-deploy-'));
  try {
    const materializedFilePaths = new Set<string>();
    for (const [relPath, value] of Object.entries(bundle.files)) {
      const path = safeBundlePath(dir, relPath, 'json');
      materializedFilePaths.add(path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(value));
    }

    const assets = (bundle as { assets?: Record<string, string> }).assets ?? {};
    for (const [relPath, base64] of Object.entries(assets)) {
      const path = safeBundlePath(dir, relPath, 'asset');
      if (materializedFilePaths.has(path)) {
        throw new Error(`DEPLOY_BUNDLE_PATH_COLLISION: asset path "${relPath}" collides with a bundle file`);
      }
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, Buffer.from(base64, 'base64'));
    }
  } catch (cause) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw cause;
  }

  return dir;
}

function safeBundlePath(root: string, relPath: string, kind: 'json' | 'asset'): string {
  if (!isSafeBundleRelPath(relPath)) {
    throw new Error(`DEPLOY_BUNDLE_PATH_UNSAFE: unsafe bundle path "${relPath}"`);
  }
  if (kind === 'json' && !relPath.endsWith('.json')) {
    throw new Error(`DEPLOY_BUNDLE_PATH_UNSAFE: bundle JSON file path "${relPath}" must end with .json`);
  }

  const normalizedRoot = resolve(root);
  const absPath = resolve(normalizedRoot, relPath);
  const relativePath = relative(normalizedRoot, absPath);
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep()}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`DEPLOY_BUNDLE_PATH_UNSAFE: bundle path "${relPath}" escapes materialization root`);
  }

  return absPath;
}

function isSafeBundleRelPath(path: string): boolean {
  if (path === '') return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function sep(): string {
  return process.platform === 'win32' ? '\\' : '/';
}
```

- [ ] **Step 4: Wire export**

Append to `packages/artifacts/blueprint/src/index.ts`:

```ts
export { materializeBundle } from './load/materialize.js';
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `pnpm -F @rntme/blueprint test test/unit/materialize.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/artifacts/blueprint/src/load/materialize.ts packages/artifacts/blueprint/src/index.ts packages/artifacts/blueprint/test/unit/materialize.test.ts
git commit -m "feat(blueprint): expose materializeBundle for client/server parity"
```

---

### Task 3: Add `materializeAndCompose` to `@rntme/blueprint`

Wraps `materializeBundle` + `loadComposedBlueprint` and cleans up the tmp dir. This is the function CLI dry-run will call.

**Files:**
- Create: `packages/artifacts/blueprint/src/load/materialize-and-compose.ts`
- Create: `packages/artifacts/blueprint/test/unit/materialize-and-compose.test.ts`
- Modify: `packages/artifacts/blueprint/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/artifacts/blueprint/test/unit/materialize-and-compose.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { materializeAndCompose, isOk } from '@rntme/blueprint';
import type { CanonicalBundle } from '@rntme/blueprint';

const goodBundle: CanonicalBundle = {
  version: 2,
  files: {
    'project.json': { name: 'demo', services: ['app'] },
    'pdm/pdm.json': { version: '1' },
    'pdm/entities/Note.json': {
      ownerService: 'app',
      kind: 'owned',
      table: 'notes',
      fields: { id: { type: 'string', nullable: false, column: 'id' } },
      keys: ['id'],
    },
    'services/app/service.json': { kind: 'domain' },
    'services/app/qsm/qsm.json': { version: '1' },
    'services/app/bindings/bindings.json': { bindings: {} },
  },
  assets: {},
};

describe('materializeAndCompose', () => {
  it('returns ok with composed blueprint for a complete bundle', async () => {
    const r = await materializeAndCompose(goodBundle);
    expect(r.ok).toBe(true);
    if (isOk(r)) {
      expect(r.value.composed.project.name).toBe('demo');
      expect(r.value.summary.projectName).toBe('demo');
    }
  });

  it('returns err with the blueprint error tree for an incomplete bundle', async () => {
    const bad: CanonicalBundle = {
      version: 2,
      files: { 'project.json': { name: 'demo', services: [] } },
      assets: {},
    };
    const r = await materializeAndCompose(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain('BLUEPRINT_IO_ERROR');
    }
  });

  it('cleans up the tmp dir after success', async () => {
    const r = await materializeAndCompose(goodBundle);
    expect(r.ok).toBe(true);
    // Test indirectly by running again — no FS leaks crash the second invocation.
    const r2 = await materializeAndCompose(goodBundle);
    expect(r2.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/blueprint test test/unit/materialize-and-compose.test.ts`
Expected: FAIL — `materializeAndCompose` not exported.

- [ ] **Step 3: Implement `materializeAndCompose`**

Create `packages/artifacts/blueprint/src/load/materialize-and-compose.ts`:

```ts
import { rm } from 'node:fs/promises';
import type { CanonicalBundle } from '@rntme/platform-core';
import { loadComposedBlueprint } from '../compose/load-composed-blueprint.js';
import type { ComposedBlueprint } from '../types/artifact.js';
import { ok, err, type Result } from '../types/result.js';
import type { BlueprintError } from '../types/result.js';
import { materializeBundle } from './materialize.js';

export type MaterializeResult = {
  readonly composed: ComposedBlueprint;
  readonly summary: {
    readonly projectName: string;
    readonly services: readonly string[];
    readonly routes: { readonly ui: Record<string, string>; readonly http: Record<string, string> };
    readonly middleware: Record<string, unknown>;
    readonly mounts: readonly { readonly target: string; readonly use: readonly string[] }[];
  };
};

export async function materializeAndCompose(
  bundle: CanonicalBundle,
): Promise<Result<MaterializeResult>> {
  let dir: string;
  try {
    dir = await materializeBundle(bundle);
  } catch (cause) {
    return err<BlueprintError>([
      {
        layer: 'load',
        code: 'BLUEPRINT_IO_ERROR',
        message: cause instanceof Error ? cause.message : String(cause),
        path: '',
      },
    ]);
  }

  try {
    const composed = loadComposedBlueprint(dir);
    if (!composed.ok) return composed;

    const project = composed.value.project;
    const summary = {
      projectName: project.name,
      services: [...project.services],
      routes: {
        ui: { ...(project.routes?.ui ?? {}) },
        http: { ...(project.routes?.http ?? {}) },
      },
      middleware: { ...(project.middleware ?? {}) },
      mounts: [...(project.mounts ?? [])],
    } as const;

    return ok({ composed: composed.value, summary });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
```

- [ ] **Step 4: Wire export**

Append to `packages/artifacts/blueprint/src/index.ts`:

```ts
export { materializeAndCompose } from './load/materialize-and-compose.js';
export type { MaterializeResult } from './load/materialize-and-compose.js';
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `pnpm -F @rntme/blueprint test test/unit/materialize-and-compose.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run full blueprint test suite**

Run: `pnpm -F @rntme/blueprint test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/artifacts/blueprint/src/load/materialize-and-compose.ts packages/artifacts/blueprint/src/index.ts packages/artifacts/blueprint/test/unit/materialize-and-compose.test.ts
git commit -m "feat(blueprint): add materializeAndCompose for end-to-end bundle validation"
```

---

### Task 4: Hoist `HttpUrlSchema` to a shared platform-core location

Currently file-local in `packages/platform/platform-core/src/schemas/deploy-target.ts:82-88`. Will be reused by `deployment.ts` for `publicBaseUrl`.

**Files:**
- Create: `packages/platform/platform-core/src/schemas/url.ts`
- Modify: `packages/platform/platform-core/src/schemas/deploy-target.ts`
- Modify: `packages/platform/platform-core/src/schemas/index.ts` (or wherever exports live)

- [ ] **Step 1: Write the failing test**

Create `packages/platform/platform-core/test/unit/http-url-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HttpUrlSchema } from '@rntme/platform-core';

describe('HttpUrlSchema', () => {
  it('accepts http and https URLs', () => {
    expect(HttpUrlSchema.safeParse('https://example.com/').success).toBe(true);
    expect(HttpUrlSchema.safeParse('http://localhost:8080/').success).toBe(true);
  });

  it('rejects ftp/file/other protocols', () => {
    expect(HttpUrlSchema.safeParse('ftp://example.com/').success).toBe(false);
    expect(HttpUrlSchema.safeParse('file:///tmp/x').success).toBe(false);
    expect(HttpUrlSchema.safeParse('not-a-url').success).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/platform-core test test/unit/http-url-schema.test.ts`
Expected: FAIL — `HttpUrlSchema` is not exported.

- [ ] **Step 3: Create the schema**

Create `packages/platform/platform-core/src/schemas/url.ts`:

```ts
import { z } from 'zod';

export const HttpUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const protocol = new URL(value).protocol;
      return protocol === 'http:' || protocol === 'https:';
    },
    { message: 'expected an http(s) URL' },
  );
```

- [ ] **Step 4: Replace local definition in `deploy-target.ts`**

Edit `packages/platform/platform-core/src/schemas/deploy-target.ts`. Delete lines 82-88 (the local `HttpUrlSchema`) and add import at top:

```ts
import { HttpUrlSchema } from './url.js';
```

- [ ] **Step 5: Re-export from package root**

Edit `packages/platform/platform-core/src/index.ts`. Add to existing export block:

```ts
export { HttpUrlSchema } from './schemas/url.js';
```

(Find the existing `export … from './schemas/...` lines; add the new one alongside.)

- [ ] **Step 6: Run tests, confirm pass**

Run: `pnpm -F @rntme/platform-core test test/unit/http-url-schema.test.ts`
Expected: PASS.

Run: `pnpm -F @rntme/platform-core test`
Expected: all tests pass (deploy-target tests still pass after the move).

- [ ] **Step 7: Commit**

```bash
git add packages/platform/platform-core/src/schemas/url.ts packages/platform/platform-core/src/schemas/deploy-target.ts packages/platform/platform-core/src/index.ts packages/platform/platform-core/test/unit/http-url-schema.test.ts
git commit -m "refactor(platform-core): hoist HttpUrlSchema to shared module"
```

---

### Task 5: Extend `PlatformError` with structured `errors[]` tree

Replaces `cause: unknown` with a typed tree. Defines `PlatformErrorNode` with `code/message/path?/cause?` and adds `errors?: PlatformErrorNode[]` to `PlatformError`.

**Files:**
- Modify: `packages/platform/platform-core/src/types/result.ts`
- Modify: `packages/platform/platform-core/src/index.ts` (export new type)
- Create: `packages/platform/platform-core/test/unit/platform-error-node.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/platform/platform-core/test/unit/platform-error-node.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { PlatformError, PlatformErrorNode } from '@rntme/platform-core';

describe('PlatformErrorNode', () => {
  it('has code, message, optional path, optional cause tree', () => {
    expectTypeOf<PlatformErrorNode>().toMatchTypeOf<{
      readonly code: string;
      readonly message: string;
      readonly path?: string;
      readonly cause?: readonly PlatformErrorNode[];
    }>();
  });
});

describe('PlatformError', () => {
  it('exposes optional errors[] tree', () => {
    const e: PlatformError = {
      code: 'PROJECT_VERSION_BLUEPRINT_INVALID',
      message: 'bad bundle',
      errors: [
        {
          code: 'BLUEPRINT_WORKFLOWS_INVALID',
          message: 'failed',
          path: 'workflows/workflows.json',
          cause: [{ code: 'WORKFLOWS_FILE_MISSING', message: 'missing bpmn' }],
        },
      ],
    };
    expectTypeOf(e.errors).toEqualTypeOf<readonly PlatformErrorNode[] | undefined>();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/platform-core test test/unit/platform-error-node.test.ts`
Expected: FAIL — `PlatformErrorNode` is not exported.

- [ ] **Step 3: Update `result.ts`**

Edit `packages/platform/platform-core/src/types/result.ts`. Add the `PlatformErrorNode` type and extend `PlatformError`:

```ts
export type PlatformErrorNode = {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly cause?: readonly PlatformErrorNode[];
};

export type PlatformError = {
  readonly code: ErrorCode;
  readonly message: string;
  readonly stage?:
    | 'auth'
    | 'parse'
    | 'tenancy'
    | 'validation'
    | 'storage'
    | 'concurrency'
    | 'internal'
    | 'plan'
    | 'render'
    | 'apply'
    | 'verify'
    | 'provision';
  readonly pkg?: string;
  readonly path?: string;
  readonly errors?: readonly PlatformErrorNode[];
};
```

(Note the removed `cause: unknown` — replaced with structured `errors[]`. Stage union extended with deploy-pipeline values per spec §3.)

- [ ] **Step 4: Re-export the new type**

Edit `packages/platform/platform-core/src/index.ts`. Find the existing `export type` block for `PlatformError` and extend it:

```ts
export type { PlatformError, PlatformErrorNode } from './types/result.js';
```

- [ ] **Step 5: Sweep usages of removed `cause` field**

Run: `grep -rn "platformError.cause\|: PlatformError.*cause" packages apps modules 2>/dev/null`
Expected: no remaining usages (the field was rarely used). If any appear, replace `e.cause` with `e.errors` and adjust the type as needed.

Run: `pnpm -r run typecheck`
Expected: PASS. Fix any type errors that surface (the change is small; expected fallout is in `apps/platform-http/src/blueprint/load.ts` and possibly tests — they will be updated in Task 7).

- [ ] **Step 6: Run tests, confirm pass**

Run: `pnpm -F @rntme/platform-core test test/unit/platform-error-node.test.ts`
Expected: PASS.

Run: `pnpm -F @rntme/platform-core test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/platform/platform-core/src/types/result.ts packages/platform/platform-core/src/index.ts packages/platform/platform-core/test/unit/platform-error-node.test.ts
git commit -m "feat(platform-core): structured PlatformErrorNode tree on PlatformError"
```

---

### Task 6: Make `StartDeploymentRequestSchema.configOverrides` strict and accept `publicBaseUrl`

**Files:**
- Modify: `packages/platform/platform-core/src/schemas/deployment.ts`
- Modify: `packages/platform/platform-core/test/unit/schemas-deployment.test.ts` (or create if absent)

- [ ] **Step 1: Locate or create the deployment-schema test**

Check: `ls packages/platform/platform-core/test/unit/ | grep -i deploy`. If `schemas-deployment.test.ts` doesn't exist, create it with the test below; otherwise extend it.

Create or append to `packages/platform/platform-core/test/unit/schemas-deployment.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { StartDeploymentRequestSchema } from '@rntme/platform-core';

describe('StartDeploymentRequestSchema.configOverrides', () => {
  it('rejects unknown keys', () => {
    const r = StartDeploymentRequestSchema.safeParse({
      projectVersionSeq: 1,
      targetSlug: 'x',
      configOverrides: { mysteryKey: 'huh' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toContain('mysteryKey');
    }
  });

  it('accepts publicBaseUrl with a valid http(s) URL', () => {
    const r = StartDeploymentRequestSchema.safeParse({
      projectVersionSeq: 1,
      targetSlug: 'x',
      configOverrides: { publicBaseUrl: 'https://order-demo.rntme.com' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects publicBaseUrl with a non-http(s) protocol', () => {
    const r = StartDeploymentRequestSchema.safeParse({
      projectVersionSeq: 1,
      targetSlug: 'x',
      configOverrides: { publicBaseUrl: 'ftp://example.com' },
    });
    expect(r.success).toBe(false);
  });

  it('still accepts the four pre-existing override keys', () => {
    const r = StartDeploymentRequestSchema.safeParse({
      projectVersionSeq: 1,
      targetSlug: 'x',
      configOverrides: {
        eventBusMode: 'in-memory',
        integrationModuleImages: { auth: 'img:1' },
        policyOverrides: { requestContext: { default: {} } },
        runtimeImage: 'ghcr.io/x/y:1',
      },
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/platform-core test test/unit/schemas-deployment.test.ts`
Expected: FAIL on the strict and publicBaseUrl tests.

- [ ] **Step 3: Modify the schema**

Edit `packages/platform/platform-core/src/schemas/deployment.ts`. Add import at the top:

```ts
import { HttpUrlSchema } from './url.js';
```

Replace lines 31-42 (the `StartDeploymentRequestSchema` definition) with:

```ts
export const StartDeploymentRequestSchema = z.object({
  projectVersionSeq: z.number().int().positive(),
  targetSlug: z.string().trim().min(1),
  configOverrides: z
    .object({
      eventBusMode: z.literal('in-memory').optional(),
      integrationModuleImages: z.record(z.string(), z.string()).optional(),
      policyOverrides: z.record(z.string(), z.unknown()).optional(),
      runtimeImage: z.string().min(1).optional(),
      publicBaseUrl: HttpUrlSchema.optional(),
    })
    .strict()
    .default({}),
});
```

- [ ] **Step 4: Run test, confirm pass**

Run: `pnpm -F @rntme/platform-core test test/unit/schemas-deployment.test.ts`
Expected: PASS (4 tests).

Run: `pnpm -F @rntme/platform-core test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/platform/platform-core/src/schemas/deployment.ts packages/platform/platform-core/test/unit/schemas-deployment.test.ts
git commit -m "feat(platform-core): strict configOverrides accepting publicBaseUrl"
```

---

## Phase 2 — Platform-http and deploy-core

### Task 7: Update `apps/platform-http/src/blueprint/load.ts` to delegate and emit `errors[]`

Replace the local materialize call with `materializeAndCompose` from `@rntme/blueprint`, and serialize the `BlueprintError[]` tree into `PlatformErrorNode[]` instead of joining into a flat string.

**Files:**
- Modify: `apps/platform-http/src/blueprint/load.ts`
- Delete: `apps/platform-http/src/bundle/materialize.ts`
- Modify: any file importing `materialize` from `bundle/materialize.ts` — rewrite to import from `@rntme/blueprint`
- Create: `apps/platform-http/test/unit/blueprint-load-errors.test.ts`

- [ ] **Step 1: Find consumers of the old `bundle/materialize.ts`**

Run: `grep -rn "bundle/materialize" apps/platform-http/src apps/platform-http/test 2>/dev/null`

Note every file that imports it.

- [ ] **Step 2: Write the failing test**

Create `apps/platform-http/test/unit/blueprint-load-errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { materializeAndCompose } from '@rntme/blueprint';
import { isOk } from '@rntme/platform-core';
import { materializeAndComposeForApi } from '../../src/blueprint/load.js';

describe('materializeAndComposeForApi', () => {
  it('serializes nested blueprint cause tree into PlatformError.errors[]', async () => {
    const r = await materializeAndComposeForApi({
      version: 2,
      files: { 'project.json': { name: 'demo', services: ['app'] } },
      assets: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const top = r.errors[0];
      expect(top.code).toBe('PROJECT_VERSION_BLUEPRINT_INVALID');
      expect(top.errors).toBeDefined();
      expect(top.errors!.length).toBeGreaterThan(0);
      expect(top.errors![0]).toHaveProperty('code');
      expect(top.errors![0]).toHaveProperty('message');
    }
  });

  it('passes valid bundles through to composition success', async () => {
    // sanity test — full bundle covered by phase 1 task 3
    const dummy = {
      version: 2 as const,
      files: { 'project.json': { name: 'demo', services: [] } },
      assets: {},
    };
    const r = await materializeAndComposeForApi(dummy);
    // services: [] is invalid — assert the error path is reached cleanly
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run, confirm failure**

Run: `pnpm -F @rntme/platform-http test test/unit/blueprint-load-errors.test.ts`
Expected: FAIL — old API doesn't expose `materializeAndComposeForApi` with the new shape.

- [ ] **Step 4: Rewrite `load.ts`**

Replace `apps/platform-http/src/blueprint/load.ts` with:

```ts
import { materializeAndCompose, type ComposedBlueprint } from '@rntme/blueprint';
import {
  err,
  ok,
  type CanonicalBundle,
  type PlatformError,
  type PlatformErrorNode,
  type ProjectVersionSummary,
  type Result,
} from '@rntme/platform-core';

export type MaterializeResult = {
  readonly composed: ComposedBlueprint;
  readonly summary: ProjectVersionSummary;
};

export async function materializeAndComposeForApi(
  bundle: CanonicalBundle,
): Promise<Result<MaterializeResult, PlatformError>> {
  const r = await materializeAndCompose(bundle);
  if (r.ok) {
    return ok({ composed: r.value.composed, summary: r.value.summary });
  }
  return err<PlatformError>([
    {
      code: 'PROJECT_VERSION_BLUEPRINT_INVALID',
      message: r.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      stage: 'validation',
      errors: r.errors.map(blueprintErrorToNode),
    },
  ]);
}

function blueprintErrorToNode(e: { code: string; message: string; path?: string; cause?: readonly unknown[] }): PlatformErrorNode {
  const node: { -readonly [K in keyof PlatformErrorNode]: PlatformErrorNode[K] } = {
    code: e.code,
    message: e.message,
  };
  if (typeof e.path === 'string' && e.path.length > 0) node.path = e.path;
  if (Array.isArray(e.cause)) {
    const children = e.cause
      .filter((c): c is { code?: unknown; message?: unknown; path?: unknown; cause?: unknown } => typeof c === 'object' && c !== null)
      .map((c) => ({
        code: typeof c.code === 'string' ? c.code : 'UNKNOWN',
        message: typeof c.message === 'string' ? c.message : JSON.stringify(c),
        ...(typeof c.path === 'string' ? { path: c.path } : {}),
        ...(Array.isArray(c.cause) ? { cause: c.cause as unknown as readonly PlatformErrorNode[] } : {}),
      }));
    if (children.length > 0) node.cause = children as readonly PlatformErrorNode[];
  }
  return node;
}
```

(The exported function is renamed to `materializeAndComposeForApi` to make the layering boundary obvious. Old `materializeAndCompose` import sites get replaced — see step 5.)

- [ ] **Step 5: Update import sites**

For each file found in step 1 that imports `bundle/materialize` directly, rewrite the import to `@rntme/blueprint` (for `materializeBundle`) or to the new `materializeAndComposeForApi` from `./blueprint/load.js` (for the platform-http composition path).

For each file that imports `materializeAndCompose` from `./blueprint/load.js`, rename to `materializeAndComposeForApi`.

Run: `grep -rn "bundle/materialize\|materializeAndCompose" apps/platform-http/src apps/platform-http/test 2>/dev/null` to verify all consumers are updated.

- [ ] **Step 6: Delete the old materialize file**

```bash
rm apps/platform-http/src/bundle/materialize.ts
```

If `apps/platform-http/src/bundle/` is now empty: `rmdir apps/platform-http/src/bundle/` (skip if other files exist there).

- [ ] **Step 7: Run typecheck, tests**

Run: `pnpm -F @rntme/platform-http typecheck`
Expected: PASS.

Run: `pnpm -F @rntme/platform-http test test/unit/blueprint-load-errors.test.ts`
Expected: PASS.

Run: `pnpm -F @rntme/platform-http test`
Expected: all tests pass. If existing tests assert on flat `error.message` shape from publish, update them now to assert on the new `errors[]` tree (one expected affected file: `test/integration/project-versions.test.ts` or similar — adjust as needed).

- [ ] **Step 8: Commit**

```bash
git add apps/platform-http apps/platform-http/test/unit/blueprint-load-errors.test.ts
git rm apps/platform-http/src/bundle/materialize.ts
git commit -m "refactor(platform-http): delegate bundle materialization to @rntme/blueprint and emit structured errors[] tree"
```

---

### Task 8: Pass `errors[]` through the platform-http error envelope

Currently `errorEnvelope` (`apps/platform-http/src/middleware/error-handler.ts:54-59`) wraps multi-error PlatformError lists. We need it to also preserve each PlatformError's nested `errors[]` field on the wire — which it does automatically, since `PlatformError` is serialized as-is. Verify with a unit test, no code change expected.

**Files:**
- Create: `apps/platform-http/test/unit/error-envelope-tree.test.ts`

- [ ] **Step 1: Write the unit test**

Create `apps/platform-http/test/unit/error-envelope-tree.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { errorEnvelope } from '../../src/middleware/error-handler.js';
import type { PlatformError } from '@rntme/platform-core';

describe('errorEnvelope with structured errors[] tree', () => {
  it('preserves nested errors[] on each PlatformError', () => {
    const e: PlatformError = {
      code: 'PROJECT_VERSION_BLUEPRINT_INVALID',
      message: 'bad',
      stage: 'validation',
      errors: [
        {
          code: 'BLUEPRINT_WORKFLOWS_INVALID',
          message: 'failed',
          path: 'workflows/workflows.json',
          cause: [{ code: 'WORKFLOWS_FILE_MISSING', message: 'missing' }],
        },
      ],
    };
    const env = errorEnvelope([e]);
    expect(env.error.errors).toBeDefined();
    expect(env.error.errors![0].cause).toBeDefined();
    expect(env.error.errors![0].cause![0].code).toBe('WORKFLOWS_FILE_MISSING');
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm -F @rntme/platform-http test test/unit/error-envelope-tree.test.ts`
Expected: PASS without code changes (envelope is structural pass-through).

- [ ] **Step 3: Commit**

```bash
git add apps/platform-http/test/unit/error-envelope-tree.test.ts
git commit -m "test(platform-http): assert errors[] tree survives error envelope"
```

---

### Task 9: Wrap deploy-pipeline errors into `PlatformError.errors[]` in `stage-runner.ts`

Stage failures currently lose nested `cause` data (executor.ts line 487 takes `errors[].cause: unknown` and doesn't structure it). Convert deploy-core errors and apply errors into PlatformErrorNode trees on the way out.

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts` (the error-shape handling around line 487)
- Modify: `apps/platform-http/src/deploy/stage-runner.ts`
- Create: `apps/platform-http/test/unit/deploy-error-tree.test.ts`

- [ ] **Step 1: Read the current error pipeline**

Run: `grep -n "cause\|errors:" apps/platform-http/src/deploy/executor.ts apps/platform-http/src/deploy/stage-runner.ts`

Read the lines around the matches. Identify where deploy-core errors enter platform-http and where they're persisted onto the deployment row.

- [ ] **Step 2: Write the failing unit test**

Create `apps/platform-http/test/unit/deploy-error-tree.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deployErrorsToPlatformError } from '../../src/deploy/executor.js';

describe('deployErrorsToPlatformError', () => {
  it('preserves nested cause arrays as PlatformErrorNode tree', () => {
    const platformError = deployErrorsToPlatformError(
      [
        {
          code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON',
          message: 'workflow projects require provisioned Operaton config',
          path: 'workflows.engine',
          cause: [
            { code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT', message: 'use rntme target create...' },
          ],
        },
      ],
      'plan',
    );
    expect(platformError.code).toBe('PLATFORM_INTERNAL'); // until we add a deploy-stage code; see step 3
    expect(platformError.errors).toBeDefined();
    expect(platformError.errors![0].cause).toBeDefined();
    expect(platformError.errors![0].cause![0].code).toBe('DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT');
  });
});
```

- [ ] **Step 3: Run, confirm failure**

Run: `pnpm -F @rntme/platform-http test test/unit/deploy-error-tree.test.ts`
Expected: FAIL — `deployErrorsToPlatformError` is not exported.

- [ ] **Step 4: Implement and export `deployErrorsToPlatformError`**

In `apps/platform-http/src/deploy/executor.ts`, near the existing error-handling block (around line 487), add:

```ts
import type { PlatformError, PlatformErrorNode, ErrorCode } from '@rntme/platform-core';

type StageErrorInput = {
  readonly code?: string;
  readonly message?: string;
  readonly path?: string;
  readonly cause?: unknown;
};

export function deployErrorsToPlatformError(
  errors: readonly StageErrorInput[],
  stage: 'plan' | 'render' | 'apply' | 'verify' | 'provision',
): PlatformError {
  const nodes = errors.map(stageErrorToNode);
  const flatMessage = errors
    .map((e) => `${e.code ?? 'UNKNOWN'}: ${e.message ?? ''}`)
    .join('; ');
  const code: ErrorCode = 'PLATFORM_INTERNAL';
  return {
    code,
    message: flatMessage || `deployment ${stage} failed`,
    stage,
    errors: nodes,
  };
}

function stageErrorToNode(e: StageErrorInput): PlatformErrorNode {
  const node: { -readonly [K in keyof PlatformErrorNode]: PlatformErrorNode[K] } = {
    code: typeof e.code === 'string' ? e.code : 'UNKNOWN',
    message: typeof e.message === 'string' ? e.message : JSON.stringify(e),
  };
  if (typeof e.path === 'string' && e.path.length > 0) node.path = e.path;
  if (Array.isArray(e.cause)) {
    const children = e.cause
      .filter((c): c is StageErrorInput => typeof c === 'object' && c !== null)
      .map(stageErrorToNode);
    if (children.length > 0) node.cause = children;
  }
  return node;
}
```

- [ ] **Step 5: Run test, confirm pass**

Run: `pnpm -F @rntme/platform-http test test/unit/deploy-error-tree.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire `deployErrorsToPlatformError` into the deployment-failure path**

Edit `apps/platform-http/src/deploy/executor.ts`. Find the existing block that takes deploy-core errors and persists `errorMessage`/`errorCode` onto the deployment row. Replace the flat-string serialization with a call to `deployErrorsToPlatformError(errors, stage)` and persist the resulting `PlatformError.errors` (e.g. as a JSON column on the deployment row, or — if no schema migration is desired — simply persist the structured form into an existing `applyResult`-style JSON field or extend the deployment record).

The exact persistence wiring depends on the current deployment record shape. Read `packages/platform/platform-storage/src/sql/` for the column layout. **If a migration is needed**, add an `error_tree JSONB` column via a new migration file in the same commit.

(Concretely: the deployment row already has `errorCode` and `errorMessage` text columns. Add `errorTree JSONB NULL` as a new column via migration; populate it from `deployErrorsToPlatformError(...)`. Read on `GET /deployments/{id}` and merge into the response payload as `error.errors[]`.)

Persistence migration steps:

1. Run: `ls packages/platform/platform-storage/src/sql/`. Note the latest migration filename.
2. Create `packages/platform/platform-storage/src/sql/<NNNN>_deployment_error_tree.sql`:

   ```sql
   ALTER TABLE deployments ADD COLUMN error_tree JSONB NULL;
   ```

3. Register the migration in the migration list (find existing list registration in `packages/platform/platform-storage/src/migrate.ts`).
4. Update `packages/platform/platform-storage/src/repos/deployments.ts` to read/write the new column.
5. Update `apps/platform-http/src/deploy/executor.ts` to populate `errorTree` from `deployErrorsToPlatformError(...)`.

- [ ] **Step 7: Update GET /deployments/{id} response shape**

Edit the deployment-show route handler to include `error.errors[]` in the response when `errorTree` is set on the row. Match the wire format from spec §4.2.

- [ ] **Step 8: Run typecheck and tests**

Run: `pnpm -F @rntme/platform-storage typecheck && pnpm -F @rntme/platform-http typecheck`
Expected: PASS.

Run: `pnpm -F @rntme/platform-http test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/platform/platform-storage/src/sql/ packages/platform/platform-storage/src/migrate.ts packages/platform/platform-storage/src/repos/deployments.ts apps/platform-http/src/deploy/executor.ts apps/platform-http/test/unit/deploy-error-tree.test.ts
git commit -m "feat(platform-http): persist and surface deploy-pipeline error tree on deployments"
```

---

### Task 10: Make `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON` actionable

**Files:**
- Modify: `packages/deploy/deploy-core/src/workflows.ts` (lines 36-40 and 56-58)
- Modify: `packages/deploy/deploy-core/test/unit/plan-workflows.test.ts`

- [ ] **Step 1: Update the failing test expectations**

Edit `packages/deploy/deploy-core/test/unit/plan-workflows.test.ts`. For the test that asserts the `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON` error, extend assertions to require:

```ts
expect(error.message).toMatch(/target ".+" has no workflows config/);
expect(error.cause).toBeDefined();
expect(error.cause![0].code).toBe('DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT');
expect(error.cause![0].message).toContain('rntme target create');
```

(Identify the specific test by name in the existing file; the spec lists this file as already covering the case.)

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/deploy-core test test/unit/plan-workflows.test.ts`
Expected: FAIL on the new assertions.

- [ ] **Step 3: Update the error-raise sites**

Edit `packages/deploy/deploy-core/src/workflows.ts`. Replace the `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON` push at line 36-40:

```ts
input.errors.push({
  code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON',
  message: `target "${input.config.targetSlug}" has no workflows config; deploying a project with workflows requires workflows.engine and workflows.worker on the target`,
  path: 'target.workflows',
  cause: [
    {
      code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT',
      message: 'create a workflow-ready target with `rntme target create <slug> --workflow-engine-image <op> --workflow-worker-image <wk> ...`, or PATCH the existing target with `rntme target set-config <slug> --from <patch.json>`. See demo/order-fulfillment-blueprint/README.md for image refs.',
    },
  ],
});
```

Replace the second push at line 55-59 (image-missing branch) similarly:

```ts
input.errors.push({
  code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON',
  message: `target "${input.config.targetSlug}" workflows.engine.image is empty; provide a non-empty Operaton image (see demo/order-fulfillment-blueprint/README.md)`,
  path: 'workflows.engine.image',
  cause: [
    {
      code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT',
      message: 'fix with `rntme target set-config <slug> --from <patch.json>` containing {"workflows":{"engine":{"image":"operaton/operaton:..."}}}.',
    },
  ],
});
```

(Confirm `input.config.targetSlug` is in scope; if the field name differs, adapt — `input.config` is the `ProjectDeploymentConfig`, which has `targetSlug`.)

- [ ] **Step 4: Add the new error-code keys to `errors.ts`**

Edit `packages/deploy/deploy-core/src/errors.ts`. Add `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT'` to the `ERROR_CODES` const if such a registry exists. (If the file uses string-literal codes inline only, skip this step.)

- [ ] **Step 5: Run tests, confirm pass**

Run: `pnpm -F @rntme/deploy-core test test/unit/plan-workflows.test.ts`
Expected: PASS.

Run: `pnpm -F @rntme/deploy-core test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/deploy/deploy-core/src/workflows.ts packages/deploy/deploy-core/src/errors.ts packages/deploy/deploy-core/test/unit/plan-workflows.test.ts
git commit -m "feat(deploy-core): actionable text and hint cause for DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON"
```

---

### Task 11: Make `DEPLOY_PLAN_MISSING_POLICY_VALUE` actionable

**Files:**
- Modify: `packages/deploy/deploy-core/src/edge.ts:334`
- Modify: `packages/deploy/deploy-core/test/unit/plan-policy.test.ts` (or the closest existing test that exercises this code)

- [ ] **Step 1: Locate the test that exercises the error**

Run: `grep -rn "DEPLOY_PLAN_MISSING_POLICY_VALUE" packages/deploy/deploy-core/test/`

If no test exists, create `packages/deploy/deploy-core/test/unit/plan-policy.test.ts` with a minimal repro:

```ts
import { describe, it, expect } from 'vitest';
import { buildProjectDeploymentPlan } from '@rntme/deploy-core';
// Construct a project with a `requestContext` middleware referencing missing policy "default".
// Re-use the fixture factory in plan-workflows.test.ts (or a similar adjacent test) for the input shape.

describe('DEPLOY_PLAN_MISSING_POLICY_VALUE', () => {
  it('produces actionable cause hint', () => {
    // Arrange: a project that has middleware "requestContext" requiring policy "default",
    // and a config whose policies map does not contain the value.
    // Act: call buildProjectDeploymentPlan(project, config).
    // Assert: error.cause exists with code DEPLOY_PLAN_MISSING_POLICY_VALUE_HINT and a message
    // mentioning `--config-overrides {policyOverrides:{requestContext:{default:...}}}`.
  });
});
```

(Fill in the arrange/act blocks using the existing fixture pattern from `plan-workflows.test.ts`.)

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/deploy-core test test/unit/plan-policy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update the raise site**

Edit `packages/deploy/deploy-core/src/edge.ts:334`. Replace the existing push with:

```ts
errors.push({
  code: 'DEPLOY_PLAN_MISSING_POLICY_VALUE',
  message: `middleware "${middlewareSlug}" references missing policy "${policyName}"`,
  path: `middleware.${middlewareSlug}.policy.${policyName}`,
  cause: [
    {
      code: 'DEPLOY_PLAN_MISSING_POLICY_VALUE_HINT',
      message: `provide the value via the deploy target's policyValues or override at deploy time with --config-overrides '{"policyOverrides":{"${middlewareSlug}":{"${policyName}":{}}}}'.`,
    },
  ],
});
```

(Adapt the `${middlewareSlug}` / `${policyName}` placeholders to match the actual variable names at line 334.)

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm -F @rntme/deploy-core test test/unit/plan-policy.test.ts`
Expected: PASS.

Run: `pnpm -F @rntme/deploy-core test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/deploy/deploy-core/src/edge.ts packages/deploy/deploy-core/test/unit/plan-policy.test.ts
git commit -m "feat(deploy-core): actionable hint for DEPLOY_PLAN_MISSING_POLICY_VALUE"
```

---

### Task 12: Verify `publicBaseUrl` override works end-to-end on the platform side

`build-deploy-config.ts:107` already reads `overrides.publicBaseUrl`. With Task 6 making the schema accept it, the path is now live. Add a test that proves the override propagates through `buildDokployTargetConfig` and into the rendered plan.

**Files:**
- Modify or create: `apps/platform-http/test/unit/build-deploy-config.test.ts`

- [ ] **Step 1: Locate or create the test**

Run: `ls apps/platform-http/test/unit/ | grep -i build-deploy`

If absent, create `apps/platform-http/test/unit/build-deploy-config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildDokployTargetConfig } from '../../src/deploy/build-deploy-config.js';
import type { DeployTarget } from '@rntme/platform-core';

const baseTarget: DeployTarget = {
  // Fill in a minimal DeployTarget. Reuse fixture from existing tests if available.
  // Required fields per packages/platform/platform-core/src/schemas/deploy-target.ts.
} as DeployTarget;

describe('buildDokployTargetConfig publicBaseUrl override', () => {
  it('returns override URL when configOverrides.publicBaseUrl is set', () => {
    const target = { ...baseTarget, publicBaseUrl: 'https://target-default.example.com' };
    const r = buildDokployTargetConfig(target, { publicBaseUrl: 'https://override.example.com' });
    expect(r.publicBaseUrl).toBe('https://override.example.com');
  });

  it('falls back to target.publicBaseUrl when override absent', () => {
    const target = { ...baseTarget, publicBaseUrl: 'https://target-default.example.com' };
    const r = buildDokployTargetConfig(target, {});
    expect(r.publicBaseUrl).toBe('https://target-default.example.com');
  });

  it('falls back to derivePublicBaseUrl when neither set', () => {
    const target = { ...baseTarget, publicBaseUrl: null };
    const r = buildDokployTargetConfig(target, {}, {
      orgSlug: 'acme',
      projectSlug: 'demo',
      environment: 'default',
      publicDeployDomain: 'rntme.com',
    });
    expect(r.publicBaseUrl).toBe('https://acme-demo-default.rntme.com');
  });
});
```

(Fill in `baseTarget` from an existing fixture in the package, or inline a minimal one matching `DeployTarget`.)

- [ ] **Step 2: Run, confirm pass**

Run: `pnpm -F @rntme/platform-http test test/unit/build-deploy-config.test.ts`
Expected: PASS — the override path is already in the implementation.

- [ ] **Step 3: Commit**

```bash
git add apps/platform-http/test/unit/build-deploy-config.test.ts
git commit -m "test(platform-http): publicBaseUrl override priority chain"
```

---

### Task 13: Update existing publish/deploy e2e tests for the new `errors[]` shape

Find tests asserting on the old flat-string `error.message` shape from the publish endpoint or deploy executor and update them to assert on `error.errors[]`.

**Files:**
- Modify: any test file matching `grep -rln 'BLUEPRINT_WORKFLOWS_INVALID\|BLUEPRINT_.*INVALID:' apps/platform-http/test`

- [ ] **Step 1: Find the affected tests**

Run: `grep -rln 'BLUEPRINT.*INVALID:\|.*INVALID:.*workflow artifact' apps/platform-http/test 2>/dev/null`

For each match, open the file and identify the assertions.

- [ ] **Step 2: Update assertions**

For each test, replace flat-string assertions with structural ones:

```ts
// before:
expect(body.error.message).toMatch(/BLUEPRINT_WORKFLOWS_INVALID/);
// after:
expect(body.error.code).toBe('PROJECT_VERSION_BLUEPRINT_INVALID');
expect(body.error.errors).toBeDefined();
expect(body.error.errors[0].code).toBe('BLUEPRINT_WORKFLOWS_INVALID');
```

- [ ] **Step 3: Run platform-http tests**

Run: `pnpm -F @rntme/platform-http test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/platform-http/test
git commit -m "test(platform-http): assert on structured errors[] tree in publish/deploy paths"
```

---

## Phase 3 — CLI: errors[] parsing + dry-run parity

### Task 14: Migrate `apps/cli/src/bundle/build.ts` to use blueprint's `CanonicalBundle`

**Files:**
- Modify: `apps/cli/package.json` (add `@rntme/blueprint` dep — already present per current state, verify)
- Modify: `apps/cli/src/bundle/build.ts`

- [ ] **Step 1: Verify dependency**

Check `apps/cli/package.json`. `@rntme/blueprint` should already be in `dependencies` (it is, per the current file). If missing, add:

```json
"@rntme/blueprint": "workspace:*",
```

- [ ] **Step 2: Replace local CanonicalBundle declaration**

Edit `apps/cli/src/bundle/build.ts`. Delete lines 9-13:

```ts
export type CanonicalBundle = {
  readonly version: 2;
  readonly files: Readonly<Record<string, unknown>>;
  readonly assets: Readonly<Record<string, string>>;
};
```

Replace with a re-export at the top:

```ts
import type { CanonicalBundle } from '@rntme/blueprint';
export type { CanonicalBundle };
```

(Note: `@rntme/blueprint` re-exports the type from `@rntme/platform-core`. The CLI now has a single source.)

- [ ] **Step 3: Run typecheck**

Run: `pnpm -F @rntme/cli typecheck`
Expected: PASS. If `version: 2` literal types fail to satisfy `1 | 2`, narrow the local literal in `build.ts` (search for `version: 2` in that file and confirm it satisfies the union).

- [ ] **Step 4: Run cli tests**

Run: `pnpm -F @rntme/cli test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/bundle/build.ts
git commit -m "refactor(cli): import CanonicalBundle from @rntme/blueprint"
```

---

### Task 15: Run `materializeAndCompose` in `project publish` (and `--dry-run`)

After `buildProjectBundle`, the CLI runs `materializeAndCompose(bundle.bundle)` to validate the bundle the same way the server will. On failure: return `CLI_VALIDATE_LOCAL_FAILED` with a printed cause tree.

**Files:**
- Modify: `apps/cli/src/commands/project/publish.ts`
- Create: `apps/cli/test/integration/publish-dry-run-missing-asset.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/cli/test/integration/publish-dry-run-missing-asset.test.ts`. The test creates a temp project folder that contains a `workflows/workflows.json` referencing `foo.bpmn` but no actual `foo.bpmn` file, runs `rntme project publish --dry-run`, and asserts the CLI exits non-zero with the missing-asset error in the output. Pattern model:

```ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { runPublish } from '../../src/commands/project/publish.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rntme-pub-test-'));
  writeFileSync(join(dir, 'project.json'), JSON.stringify({ name: 'demo', services: ['app'] }));
  mkdirSync(join(dir, 'pdm/entities'), { recursive: true });
  writeFileSync(join(dir, 'pdm/pdm.json'), JSON.stringify({ version: '1' }));
  writeFileSync(join(dir, 'pdm/entities/Note.json'), JSON.stringify({
    ownerService: 'app', kind: 'owned', table: 'notes',
    fields: { id: { type: 'string', nullable: false, column: 'id' } },
    keys: ['id'],
  }));
  mkdirSync(join(dir, 'services/app/qsm/projections'), { recursive: true });
  mkdirSync(join(dir, 'services/app/bindings'), { recursive: true });
  writeFileSync(join(dir, 'services/app/service.json'), JSON.stringify({ kind: 'domain' }));
  writeFileSync(join(dir, 'services/app/qsm/qsm.json'), JSON.stringify({ version: '1' }));
  writeFileSync(join(dir, 'services/app/bindings/bindings.json'), JSON.stringify({ bindings: {} }));
  mkdirSync(join(dir, 'workflows'));
  writeFileSync(join(dir, 'workflows/workflows.json'), JSON.stringify({
    workflowVersion: 1,
    definitions: [{ id: 'wf', bpmnFile: 'missing.bpmn', processId: 'p' }],
    messageStarts: [],
    serviceTasks: [],
  }));
  // Note: missing.bpmn intentionally absent.
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('publish --dry-run with missing referenced asset', () => {
  it('returns CLI_VALIDATE_LOCAL_FAILED with structured cause tree', async () => {
    const { exitCode, stdout, stderr } = await captureRun(() => runPublish({
      folder: dir,
      org: 'test',
      project: 'demo',
      dryRun: true,
    }, /* flags */ { json: true }));
    expect(exitCode).not.toBe(0);
    const output = JSON.parse(stdout);
    expect(output.error.code).toBe('CLI_VALIDATE_LOCAL_FAILED');
    expect(stderr).toMatch(/missing.bpmn/);
  });
});
```

(Use the test patterns established in `apps/cli/test/integration/`. Implement `captureRun` if not present.)

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/cli test test/integration/publish-dry-run-missing-asset.test.ts`
Expected: FAIL — current dry-run does not invoke materializeAndCompose.

- [ ] **Step 3: Wire `materializeAndCompose` into publish flow**

Edit `apps/cli/src/commands/project/publish.ts`. After `buildProjectBundle` returns ok and before the network call (or before printing the dry-run summary), add:

```ts
import { materializeAndCompose } from '@rntme/blueprint';

// Inside the publish flow, after `bundle = built.value`:
const validated = await materializeAndCompose(bundle.bundle);
if (!validated.ok) {
  return err(cliError('CLI_VALIDATE_LOCAL_FAILED', formatBlueprintErrors(validated.errors)));
}
```

Add `formatBlueprintErrors` either inline or in `apps/cli/src/util/format-blueprint-errors.ts`:

```ts
export function formatBlueprintErrors(errors: readonly { code: string; message: string; path?: string; cause?: readonly unknown[] }[]): string {
  const lines: string[] = [];
  for (const e of errors) appendNode(lines, e, 0);
  return lines.join('\n');
}

function appendNode(lines: string[], node: { code: string; message: string; path?: string; cause?: readonly unknown[] }, indent: number): void {
  const pad = '  '.repeat(indent);
  lines.push(`${pad}${node.code}${node.path ? ` at ${node.path}` : ''}: ${node.message}`);
  if (Array.isArray(node.cause)) {
    for (const c of node.cause) {
      if (typeof c === 'object' && c !== null && 'code' in c) {
        appendNode(lines, c as { code: string; message: string; path?: string; cause?: readonly unknown[] }, indent + 1);
      }
    }
  }
}
```

- [ ] **Step 4: Run test, confirm pass**

Run: `pnpm -F @rntme/cli test test/integration/publish-dry-run-missing-asset.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full CLI suite**

Run: `pnpm -F @rntme/cli test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/commands/project/publish.ts apps/cli/src/util/format-blueprint-errors.ts apps/cli/test/integration/publish-dry-run-missing-asset.test.ts
git commit -m "feat(cli): run materializeAndCompose during publish for client/server parity"
```

---

### Task 16: Parse and render `error.errors[]` tree in CLI

**Files:**
- Modify: `apps/cli/src/api/client.ts`
- Create: `apps/cli/test/unit/error-render.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/cli/test/unit/error-render.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderApiError } from '../../src/api/client.js';

describe('renderApiError', () => {
  it('renders flat error when no errors[] present', () => {
    expect(renderApiError({
      code: 'PLATFORM_AUTH_FORBIDDEN',
      message: 'forbidden',
    })).toBe('✖ PLATFORM_AUTH_FORBIDDEN\n  forbidden');
  });

  it('renders the cause tree when errors[] present', () => {
    const out = renderApiError({
      code: 'PROJECT_VERSION_BLUEPRINT_INVALID',
      message: 'BLUEPRINT_WORKFLOWS_INVALID: workflow artifact failed validation',
      errors: [
        {
          code: 'BLUEPRINT_WORKFLOWS_INVALID',
          message: 'workflow artifact failed validation',
          path: 'workflows/workflows.json',
          cause: [
            {
              code: 'WORKFLOWS_FILE_MISSING',
              message: 'referenced "order-fulfillment.bpmn" not in bundle assets',
              path: 'definitions[0].bpmnFile',
            },
          ],
        },
      ],
    });
    expect(out).toBe(
      [
        '✖ PROJECT_VERSION_BLUEPRINT_INVALID',
        '  BLUEPRINT_WORKFLOWS_INVALID at workflows/workflows.json',
        '    WORKFLOWS_FILE_MISSING at definitions[0].bpmnFile',
        '      referenced "order-fulfillment.bpmn" not in bundle assets',
      ].join('\n'),
    );
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/cli test test/unit/error-render.test.ts`
Expected: FAIL — `renderApiError` not exported.

- [ ] **Step 3: Implement `renderApiError`**

Edit `apps/cli/src/api/client.ts`. Add (or expose if it exists privately):

```ts
type ApiErrorPayload = {
  readonly code: string;
  readonly message: string;
  readonly errors?: readonly ApiErrorNode[];
};
type ApiErrorNode = {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly cause?: readonly ApiErrorNode[];
};

export function renderApiError(error: ApiErrorPayload): string {
  const lines = [`✖ ${error.code}`];
  if (error.errors && error.errors.length > 0) {
    for (const node of error.errors) appendErrorNode(lines, node, 1);
  } else {
    lines.push(`  ${error.message}`);
  }
  return lines.join('\n');
}

function appendErrorNode(lines: string[], node: ApiErrorNode, depth: number): void {
  const pad = '  '.repeat(depth);
  const head = node.path ? `${node.code} at ${node.path}` : node.code;
  lines.push(`${pad}${head}`);
  if (node.cause && node.cause.length > 0) {
    for (const child of node.cause) appendErrorNode(lines, child, depth + 1);
  } else {
    lines.push(`${pad}  ${node.message}`);
  }
}
```

Wire `renderApiError` into the existing failure-rendering path in the same file (find the spot that prints `✖ <code>\n  <message>` and replace with a call to `renderApiError(error)`).

- [ ] **Step 4: Run test, confirm pass**

Run: `pnpm -F @rntme/cli test test/unit/error-render.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full CLI tests, confirm no regressions**

Run: `pnpm -F @rntme/cli test`
Expected: all tests pass. Adjust any existing test fixtures whose expected stderr included the old flat-string format (replace with the tree format).

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/api/client.ts apps/cli/test/unit/error-render.test.ts
git commit -m "feat(cli): render structured error tree from platform responses"
```

---

## Phase 4 — CLI new commands

### Task 17: Add `target` block to USAGE and register help for `target create`

**Files:**
- Modify: `apps/cli/src/bin/cli.ts`
- Modify: `apps/cli/test/unit/help-registry.test.ts`

- [ ] **Step 1: Write the failing test**

Edit `apps/cli/test/unit/help-registry.test.ts`. Add or extend an existing test with:

```ts
it('lists target subcommands in USAGE', () => {
  const usage = readUsageBlock(); // helper that returns the USAGE constant from bin/cli.ts
  expect(usage).toMatch(/target list/);
  expect(usage).toMatch(/target show/);
  expect(usage).toMatch(/target create/);
  expect(usage).toMatch(/target set-config/);
});

it('has registered help for target create', () => {
  expect(lookupHelp(['target', 'create'])).toBeDefined();
});
```

(Implement `readUsageBlock` if not present — it can simply re-export `USAGE` from `bin/cli.ts` for testability, or the test can spawn the CLI and capture `--help` output.)

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/cli test test/unit/help-registry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update USAGE**

Edit `apps/cli/src/bin/cli.ts`. In the USAGE constant (search for `Commands:`), add a target block:

```
  target list             List deploy targets in the org
  target show <slug>      Show a deploy target
  target create <slug>    Create a new deploy target
  target set-config <slug> Update target config from a JSON patch file
```

Add `registerHelp(['target', 'create'], ...)` next to the existing target help registrations:

```ts
registerHelp(['target', 'create'], `Usage: rntme target create <slug>
  --kind dokploy
  --display-name <name>
  --dokploy-url <url>
  (--dokploy-project-id <id> | --dokploy-project-name <name> --allow-create-project)
  --api-token <token>             prefix with @ to read from a file (e.g. @~/.dokploy-token)
  [--public-base-url <url>]
  [--event-bus provisioned|external]
  [--event-bus-image <image>]
  [--event-bus-topic-prefix <prefix>]
  [--event-bus-brokers <csv>]
  [--event-bus-protocol plaintext|sasl_ssl]
  [--event-bus-mechanism scram-sha-256|scram-sha-512]
  [--event-bus-username-secret <name>]
  [--event-bus-password-secret <name>]
  [--workflow-engine-image <image>]
  [--workflow-worker-image <image>]
  [--auth0-domain <domain>] [--auth0-audience <aud>] [--auth0-client-id <id>] [--auth0-redirect-uri <url>]
  [--module <slug>=<image>]       repeatable
  [--from <path>]                 alternative: send the body from a JSON file
  [--default]
  [--org <slug>]`);
```

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm -F @rntme/cli test test/unit/help-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/bin/cli.ts apps/cli/test/unit/help-registry.test.ts
git commit -m "feat(cli): list target subcommands in USAGE and register help for create"
```

---

### Task 18: Rename `target set-config --json` to `--from`, detect legacy use

**Files:**
- Modify: `apps/cli/src/bin/cli.ts` (the `set-config` dispatcher block, around lines 543-554)
- Modify: `apps/cli/src/commands/target/set-config.ts` (rename internal field)
- Create: `apps/cli/test/unit/target-set-config.test.ts` (extend if it exists)

- [ ] **Step 1: Write the failing test**

Create or extend `apps/cli/test/unit/target-set-config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runCli } from './harness.js'; // or whatever pattern existing tests use

describe('target set-config', () => {
  it('accepts --from <path>', async () => {
    const { exitCode } = await runCli(['target', 'set-config', 'my-tgt', '--from', 'patch.json'], {
      mockServer: { /* return 200 with target on PATCH */ },
    });
    expect(exitCode).toBe(0);
  });

  it('rejects legacy --json <path> with a helpful hint', async () => {
    const { exitCode, stderr } = await runCli(['target', 'set-config', 'my-tgt', '--json', 'patch.json'], {});
    expect(exitCode).toBe(2);
    expect(stderr).toMatch(/--json now selects machine-readable output; pass the JSON patch via --from <path>/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/cli test test/unit/target-set-config.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update the dispatcher**

Edit `apps/cli/src/bin/cli.ts`. Replace the `case 'set-config': { ... }` block with:

```ts
case 'set-config': {
  const slug = positionals[2];
  if (!slug) {
    process.stderr.write('Usage: rntme target set-config <slug> --from <path> [--org <slug>]\n');
    return 1;
  }
  const fromPath = asString(values['from']);
  if (!fromPath) {
    // Legacy --json <path> form: --json was parsed as boolean true; the path lands as a stray positional.
    if (values['json'] === true && positionals[3] !== undefined && !positionals[3].startsWith('-')) {
      process.stderr.write(
        '--json now selects machine-readable output; pass the JSON patch via --from <path>\n',
      );
      return 2;
    }
    process.stderr.write('Usage: rntme target set-config <slug> --from <path> [--org <slug>]\n');
    return 1;
  }
  return runTargetSetConfig({ slug, fromPath }, commonFlags);
}
```

Also register `from: { type: 'string' }` in the `parseArgs` options block (search for the `parseArgs` config in the file and add the new entry).

- [ ] **Step 4: Update the command file**

Edit `apps/cli/src/commands/target/set-config.ts`. Rename the field `jsonPath` → `fromPath` everywhere, including in `TargetSetConfigArgs` and inside `runTargetSetConfig`. Behavior stays identical.

- [ ] **Step 5: Run, confirm pass**

Run: `pnpm -F @rntme/cli test test/unit/target-set-config.test.ts`
Expected: PASS.

Run: `pnpm -F @rntme/cli test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/bin/cli.ts apps/cli/src/commands/target/set-config.ts apps/cli/test/unit/target-set-config.test.ts
git commit -m "feat(cli): rename target set-config --json to --from with legacy hint"
```

---

### Task 19: Add `rntme target create` command

**Files:**
- Modify: `apps/cli/src/api/target-endpoints.ts` (add `create`)
- Create: `apps/cli/src/commands/target/create.ts`
- Modify: `apps/cli/src/bin/cli.ts` (dispatch + parseArgs flags)
- Create: `apps/cli/test/unit/target-create.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/cli/test/unit/target-create.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildTargetCreateRequest } from '../../src/commands/target/create.js';

describe('buildTargetCreateRequest', () => {
  it('assembles a minimal Dokploy body without workflows', () => {
    const body = buildTargetCreateRequest({
      slug: 'my-tgt',
      kind: 'dokploy',
      displayName: 'My Target',
      dokployUrl: 'https://dokploy.example.com',
      dokployProjectId: 'p1',
      apiToken: 'secret',
    });
    expect(body).toEqual(expect.objectContaining({
      slug: 'my-tgt',
      kind: 'dokploy',
      displayName: 'My Target',
      dokployUrl: 'https://dokploy.example.com',
      dokployProjectId: 'p1',
      apiToken: 'secret',
      workflows: null,
      isDefault: false,
    }));
  });

  it('produces workflows config when both worker and engine images supplied', () => {
    const body = buildTargetCreateRequest({
      slug: 'my-tgt',
      kind: 'dokploy',
      displayName: 'X',
      dokployUrl: 'https://x.example.com',
      dokployProjectId: 'p1',
      apiToken: 's',
      workflowEngineImage: 'operaton/operaton:1.0.0-beta-5',
      workflowWorkerImage: 'ghcr.io/x/wk:v1',
    });
    expect(body.workflows).toEqual({
      engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:1.0.0-beta-5' },
      worker: { image: 'ghcr.io/x/wk:v1' },
    });
  });

  it('rejects single-sided workflow flags', () => {
    expect(() => buildTargetCreateRequest({
      slug: 'x',
      kind: 'dokploy',
      displayName: 'X',
      dokployUrl: 'https://x.example.com',
      dokployProjectId: 'p1',
      apiToken: 's',
      workflowEngineImage: 'operaton/operaton:1.0.0-beta-5',
      // no workflowWorkerImage
    })).toThrow(/CLI_USAGE.*both.*workflow-worker-image.*workflow-engine-image/);
  });

  it('reads --api-token @file from disk', () => {
    // setup: write a temp file containing 'tok-123'
    // call buildTargetCreateRequest with apiToken: '@/tmp/token-file'
    // assert: body.apiToken === 'tok-123'
  });

  it('rejects --from combined with field flags', () => {
    expect(() => buildTargetCreateRequest({
      slug: 'x',
      kind: 'dokploy',
      from: '/tmp/x.json',
      displayName: 'extra',
    } as never)).toThrow(/CLI_USAGE.*--from is mutually exclusive/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/cli test test/unit/target-create.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the command**

Add `create` to `apps/cli/src/api/target-endpoints.ts`:

```ts
create: async (ctx: TargetApiContext, org: string, body: Record<string, unknown>) =>
  apiCall({
    method: 'POST',
    path: `/v1/orgs/${encodeURIComponent(org)}/deploy-targets`,
    body,
    responseSchema: TargetResponseSchema,
    ...ctx,
  }),
```

Create `apps/cli/src/commands/target/create.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runCommand, type CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';

export type TargetCreateArgs = {
  readonly slug: string;
  readonly kind: 'dokploy';
  readonly displayName: string;
  readonly dokployUrl: string;
  readonly dokployProjectId?: string;
  readonly dokployProjectName?: string;
  readonly allowCreateProject?: boolean;
  readonly apiToken: string;
  readonly publicBaseUrl?: string;
  readonly eventBus?: 'provisioned' | 'external';
  readonly eventBusImage?: string;
  readonly eventBusTopicPrefix?: string;
  readonly eventBusBrokers?: string;
  readonly eventBusProtocol?: 'plaintext' | 'sasl_ssl';
  readonly eventBusMechanism?: 'scram-sha-256' | 'scram-sha-512';
  readonly eventBusUsernameSecret?: string;
  readonly eventBusPasswordSecret?: string;
  readonly workflowEngineImage?: string;
  readonly workflowWorkerImage?: string;
  readonly auth0Domain?: string;
  readonly auth0Audience?: string;
  readonly auth0ClientId?: string;
  readonly auth0RedirectUri?: string;
  readonly modules?: ReadonlyArray<{ readonly slug: string; readonly image: string }>;
  readonly from?: string;
  readonly setDefault?: boolean;
};

export function buildTargetCreateRequest(args: TargetCreateArgs): Record<string, unknown> {
  if (args.from) {
    const conflicting = ['displayName','dokployUrl','dokployProjectId','dokployProjectName','allowCreateProject','apiToken','publicBaseUrl','eventBus','workflowEngineImage','workflowWorkerImage','auth0Domain','auth0ClientId','modules'].filter(
      (k) => (args as Record<string, unknown>)[k] !== undefined,
    );
    if (conflicting.length > 0) {
      throw new Error(`CLI_USAGE: --from is mutually exclusive with field flags (${conflicting.join(', ')})`);
    }
    return { slug: args.slug, ...JSON.parse(readFileSync(resolve(args.from), 'utf8')) as Record<string, unknown> };
  }

  if ((args.workflowEngineImage === undefined) !== (args.workflowWorkerImage === undefined)) {
    throw new Error('CLI_USAGE: both --workflow-worker-image and --workflow-engine-image must be provided together');
  }

  const apiTokenValue = args.apiToken.startsWith('@')
    ? readFileSync(resolve(args.apiToken.slice(1).replace(/^~/, process.env.HOME ?? '~')), 'utf8').trim()
    : args.apiToken;

  const body: Record<string, unknown> = {
    slug: args.slug,
    kind: args.kind,
    displayName: args.displayName,
    dokployUrl: args.dokployUrl,
    apiToken: apiTokenValue,
    eventBus: buildEventBus(args),
    modules: buildModules(args),
    workflows: args.workflowEngineImage && args.workflowWorkerImage
      ? {
          engine: { kind: 'operaton', mode: 'provisioned', image: args.workflowEngineImage },
          worker: { image: args.workflowWorkerImage },
        }
      : null,
    auth: buildAuth(args),
    policyValues: { requestContext: { default: {} } },
    isDefault: args.setDefault ?? false,
    allowCreateProject: args.allowCreateProject ?? false,
  };
  if (args.publicBaseUrl) body.publicBaseUrl = args.publicBaseUrl;
  if (args.dokployProjectId) body.dokployProjectId = args.dokployProjectId;
  if (args.dokployProjectName) body.dokployProjectName = args.dokployProjectName;
  return body;
}

function buildEventBus(args: TargetCreateArgs): Record<string, unknown> {
  const mode = args.eventBus ?? (args.eventBusBrokers ? 'external' : 'provisioned');
  if (mode === 'external') {
    const security = args.eventBusProtocol === 'sasl_ssl'
      ? {
          protocol: 'sasl_ssl' as const,
          mechanism: args.eventBusMechanism ?? 'scram-sha-256',
          secretRefs: {
            username: args.eventBusUsernameSecret ?? '',
            password: args.eventBusPasswordSecret ?? '',
          },
        }
      : { protocol: 'plaintext' as const };
    return {
      kind: 'kafka',
      mode: 'external',
      brokers: (args.eventBusBrokers ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      ...(args.eventBusTopicPrefix ? { topicPrefix: args.eventBusTopicPrefix } : {}),
      security,
    };
  }
  return {
    kind: 'kafka',
    mode: 'provisioned',
    provider: 'redpanda',
    ...(args.eventBusImage ? { image: args.eventBusImage } : {}),
    ...(args.eventBusTopicPrefix ? { topicPrefix: args.eventBusTopicPrefix } : {}),
  };
}

function buildModules(args: TargetCreateArgs): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of args.modules ?? []) out[m.slug] = { image: m.image };
  return out;
}

function buildAuth(args: TargetCreateArgs): Record<string, unknown> {
  if (!args.auth0ClientId && !args.auth0Domain && !args.auth0Audience && !args.auth0RedirectUri) return {};
  return {
    auth0: {
      ...(args.auth0ClientId ? { clientId: args.auth0ClientId } : {}),
      ...(args.auth0Domain ? { domain: args.auth0Domain } : {}),
      ...(args.auth0Audience ? { audience: args.auth0Audience } : {}),
      ...(args.auth0RedirectUri ? { redirectUri: args.auth0RedirectUri } : {}),
    },
  };
}

export async function runTargetCreate(args: TargetCreateArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: { target: { slug: string; id: string } }) =>
        `✓ target created\n  slug: ${d.target.slug}\n  id:   ${d.target.id}`,
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      let body: Record<string, unknown>;
      try {
        body = buildTargetCreateRequest(args);
      } catch (e) {
        return err(cliError('CLI_USAGE', (e as Error).message));
      }
      return endpoints.targets.create({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, body);
    },
  );
}
```

- [ ] **Step 4: Wire dispatcher**

Edit `apps/cli/src/bin/cli.ts`. In the parseArgs options config, add the new flags (`kind`, `display-name`, `dokploy-url`, etc., all `type: 'string'`; `allow-create-project`, `default` as boolean; `module` repeatable). In the `target` switch, add:

```ts
case 'create': {
  const slug = positionals[2];
  if (!slug) {
    process.stderr.write('Usage: rntme target create <slug> ...\n');
    return 1;
  }
  return runTargetCreate({
    slug,
    kind: 'dokploy',
    displayName: asString(values['display-name']) ?? '',
    dokployUrl: asString(values['dokploy-url']) ?? '',
    dokployProjectId: asString(values['dokploy-project-id']),
    dokployProjectName: asString(values['dokploy-project-name']),
    allowCreateProject: values['allow-create-project'] === true,
    apiToken: asString(values['api-token']) ?? '',
    publicBaseUrl: asString(values['public-base-url']),
    eventBus: asString(values['event-bus']) as 'provisioned' | 'external' | undefined,
    eventBusImage: asString(values['event-bus-image']),
    eventBusTopicPrefix: asString(values['event-bus-topic-prefix']),
    eventBusBrokers: asString(values['event-bus-brokers']),
    eventBusProtocol: asString(values['event-bus-protocol']) as 'plaintext' | 'sasl_ssl' | undefined,
    eventBusMechanism: asString(values['event-bus-mechanism']) as 'scram-sha-256' | 'scram-sha-512' | undefined,
    eventBusUsernameSecret: asString(values['event-bus-username-secret']),
    eventBusPasswordSecret: asString(values['event-bus-password-secret']),
    workflowEngineImage: asString(values['workflow-engine-image']),
    workflowWorkerImage: asString(values['workflow-worker-image']),
    auth0Domain: asString(values['auth0-domain']),
    auth0Audience: asString(values['auth0-audience']),
    auth0ClientId: asString(values['auth0-client-id']),
    auth0RedirectUri: asString(values['auth0-redirect-uri']),
    modules: parseModuleFlag(values['module']),
    from: asString(values['from']),
    setDefault: values['default'] === true,
  }, commonFlags);
}
```

Implement `parseModuleFlag` near the top of `bin/cli.ts`:

```ts
function parseModuleFlag(v: unknown): ReadonlyArray<{ slug: string; image: string }> | undefined {
  const list = Array.isArray(v) ? v : v === undefined ? [] : [v];
  if (list.length === 0) return undefined;
  return list.map((item) => {
    const s = String(item);
    const eq = s.indexOf('=');
    if (eq <= 0) throw new Error(`CLI_USAGE: --module expects <slug>=<image>, got "${s}"`);
    return { slug: s.slice(0, eq), image: s.slice(eq + 1) };
  });
}
```

Register `module: { type: 'string', multiple: true }` in the `parseArgs` options block so the flag accepts repeated values.

- [ ] **Step 5: Run, confirm pass**

Run: `pnpm -F @rntme/cli test test/unit/target-create.test.ts`
Expected: PASS.

Run: `pnpm -F @rntme/cli test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/api/target-endpoints.ts apps/cli/src/commands/target/create.ts apps/cli/src/bin/cli.ts apps/cli/test/unit/target-create.test.ts
git commit -m "feat(cli): rntme target create command with workflow-ready flags"
```

---

### Task 20: Add `token create --preset deploy|admin|publish|read`

**Files:**
- Modify: `apps/cli/src/commands/token/create.ts`
- Modify: `apps/cli/src/bin/cli.ts` (parseArgs + dispatch)
- Create: `apps/cli/test/unit/token-create-preset.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/cli/test/unit/token-create-preset.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveTokenScopes } from '../../src/commands/token/create.js';

describe('resolveTokenScopes', () => {
  it('expands --preset read', () => {
    expect(resolveTokenScopes({ preset: 'read', creatorScopes: [] })).toEqual(['project:read']);
  });

  it('expands --preset publish', () => {
    expect(resolveTokenScopes({ preset: 'publish', creatorScopes: [] })).toEqual([
      'project:read', 'project:write', 'version:publish',
    ]);
  });

  it('expands --preset deploy', () => {
    expect(resolveTokenScopes({ preset: 'deploy', creatorScopes: [] })).toEqual([
      'project:read', 'version:publish', 'deploy:execute',
    ]);
  });

  it('expands --preset admin to creatorScopes', () => {
    expect(resolveTokenScopes({ preset: 'admin', creatorScopes: ['project:read', 'token:manage'] })).toEqual([
      'project:read', 'token:manage',
    ]);
  });

  it('rejects --preset combined with --scope', () => {
    expect(() => resolveTokenScopes({ preset: 'deploy', explicitScopes: ['project:read'], creatorScopes: [] })).toThrow(
      /CLI_USAGE.*mutually exclusive/,
    );
  });

  it('returns explicit scopes when no preset', () => {
    expect(resolveTokenScopes({ explicitScopes: ['project:read'], creatorScopes: [] })).toEqual(['project:read']);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/cli test test/unit/token-create-preset.test.ts`
Expected: FAIL — `resolveTokenScopes` not exported.

- [ ] **Step 3: Implement preset resolution**

Edit `apps/cli/src/commands/token/create.ts`. Add:

```ts
type Preset = 'read' | 'publish' | 'deploy' | 'admin';

const PRESET_SCOPES: Record<Exclude<Preset, 'admin'>, readonly string[]> = {
  read: ['project:read'],
  publish: ['project:read', 'project:write', 'version:publish'],
  deploy: ['project:read', 'version:publish', 'deploy:execute'],
};

export function resolveTokenScopes(input: {
  readonly preset?: Preset;
  readonly explicitScopes?: readonly string[];
  readonly creatorScopes: readonly string[];
}): readonly string[] {
  if (input.preset && input.explicitScopes && input.explicitScopes.length > 0) {
    throw new Error('CLI_USAGE: --preset and --scope are mutually exclusive');
  }
  if (input.preset === 'admin') return [...input.creatorScopes];
  if (input.preset) return PRESET_SCOPES[input.preset];
  return input.explicitScopes ?? [];
}
```

Update `runTokenCreate` to call `resolveTokenScopes`. To know `creatorScopes`, fetch via `whoami` if `--preset admin` is supplied (otherwise the preset is independent of creator). Sketch:

```ts
let scopes = input.scopes;
if (args.preset !== undefined) {
  let creatorScopes: readonly string[] = [];
  if (args.preset === 'admin') {
    const wai = await endpoints.whoami({ baseUrl, token });
    if (!wai.ok) return wai;
    creatorScopes = wai.value.scopes;
  }
  scopes = resolveTokenScopes({ preset: args.preset, creatorScopes });
}
```

- [ ] **Step 4: Wire dispatcher**

Edit `apps/cli/src/bin/cli.ts`. Add `preset: { type: 'string' }` to parseArgs options. In the token-create dispatch:

```ts
case 'create': {
  const name = positionals[2];
  if (!name) { process.stderr.write('Usage: rntme token create <name> [--preset <preset> | --scope <s> ...]\n'); return 1; }
  const preset = asString(values['preset']);
  return runTokenCreate({
    name,
    preset: preset as 'read' | 'publish' | 'deploy' | 'admin' | undefined,
    scopes: asStringArray(values['scope']) ?? [],
    expiresAt: asString(values['expires-at']),
  }, commonFlags);
}
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `pnpm -F @rntme/cli test test/unit/token-create-preset.test.ts`
Expected: PASS.

Run: `pnpm -F @rntme/cli test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/commands/token/create.ts apps/cli/src/bin/cli.ts apps/cli/test/unit/token-create-preset.test.ts
git commit -m "feat(cli): token create --preset {read|publish|deploy|admin}"
```

---

### Task 21: Add login scope warning

**Files:**
- Modify: `apps/cli/src/commands/login.ts`
- Create: `apps/cli/test/integration/login-scope-warning.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `apps/cli/test/integration/login-scope-warning.test.ts`. Use the existing CLI integration harness. The test sets up a mock platform-http that returns whoami with limited scopes, runs `rntme login --token <pat>`, and asserts stderr contains the warning lines.

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/cli test test/integration/login-scope-warning.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the warning**

Edit `apps/cli/src/commands/login.ts`. After successful login, call whoami; if scopes lack both `deploy:execute` and `deploy:target:manage`, emit a warning to stderr:

```ts
import { endpoints } from '../api/endpoints.js';

// inside runLogin, after persisting credentials:
const wai = await endpoints.whoami({ baseUrl, token });
if (wai.ok) {
  const scopes = wai.value.scopes ?? [];
  const hasDeploy = scopes.includes('deploy:execute');
  const hasTargetManage = scopes.includes('deploy:target:manage');
  if (!hasDeploy && !hasTargetManage) {
    process.stderr.write(
      `  ⚠ this token cannot run deployments or manage targets.\n` +
      `    To deploy: mint a new token with \`rntme token create deploy-bot --preset deploy\`\n` +
      `    To manage targets: include \`deploy:target:manage\` in scopes (admin role only).\n`,
    );
  }
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm -F @rntme/cli test test/integration/login-scope-warning.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/commands/login.ts apps/cli/test/integration/login-scope-warning.test.ts
git commit -m "feat(cli): warn on login when token lacks deploy scopes"
```

---

### Task 22: Add 403 actionable hint

**Files:**
- Modify: `apps/cli/src/api/client.ts` (the 403 handling branch)
- Create: `apps/cli/test/integration/forbidden-hint.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/cli/test/integration/forbidden-hint.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runCli } from './harness.js';

describe('CLI 403 hint', () => {
  it('replaces stderr with actionable hint when error matches missing scope X', async () => {
    const { exitCode, stderr } = await runCli(['project', 'deploy', '--org', 'a', '--project', 'p', '--version', '1', '--target', 't'], {
      mockServer: {
        onPost: { '/v1/orgs/a/projects/p/deployments': () => ({ status: 403, body: { error: { code: 'PLATFORM_AUTH_FORBIDDEN', message: 'missing scope deploy:execute' }, requestId: 'req_x' } }) },
      },
    });
    expect(exitCode).not.toBe(0);
    expect(stderr).toMatch(/your token is missing scope "deploy:execute"/);
    expect(stderr).toMatch(/rntme token create deploy-bot --preset deploy/);
    expect(stderr).toMatch(/req_x/);
  });

  it('falls back to standard render for other 403 messages', async () => {
    const { exitCode, stderr } = await runCli(['project', 'deploy', '--org', 'a', '--project', 'p', '--version', '1', '--target', 't'], {
      mockServer: {
        onPost: { '/v1/orgs/a/projects/p/deployments': () => ({ status: 403, body: { error: { code: 'PLATFORM_AUTH_FORBIDDEN', message: 'access denied: forbidden' }, requestId: 'req_y' } }) },
      },
    });
    expect(exitCode).not.toBe(0);
    expect(stderr).toMatch(/✖ PLATFORM_AUTH_FORBIDDEN/);
    expect(stderr).not.toMatch(/your token is missing scope/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm -F @rntme/cli test test/integration/forbidden-hint.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the hint logic**

Edit `apps/cli/src/api/client.ts`. In the 4xx-handling branch, after determining it's a 403 with `PLATFORM_AUTH_FORBIDDEN`:

```ts
function maybeForbiddenHint(error: ApiErrorPayload, requestId: string | undefined): string | null {
  if (error.code !== 'PLATFORM_AUTH_FORBIDDEN') return null;
  const m = /missing scope ["']?([a-z:_-]+)["']?/i.exec(error.message ?? '');
  if (!m) return null;
  const scope = m[1];
  return [
    `✖ PLATFORM_AUTH_FORBIDDEN`,
    `  your token is missing scope "${scope}".`,
    `  Mint a new token with this scope:`,
    `    rntme token create deploy-bot --preset deploy`,
    `  Then re-login:`,
    `    rntme login --token <new-token>`,
    requestId ? `  request: ${requestId}` : '',
  ].filter(Boolean).join('\n');
}
```

Wire it into the existing `renderApiError` path: when `maybeForbiddenHint(error, requestId)` returns non-null, use that instead of the default tree rendering.

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm -F @rntme/cli test test/integration/forbidden-hint.test.ts`
Expected: PASS.

Run: `pnpm -F @rntme/cli test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/api/client.ts apps/cli/test/integration/forbidden-hint.test.ts
git commit -m "feat(cli): actionable hint on 403 missing-scope responses"
```

---

## Phase 5 — Docs

### Task 23: Update `apps/cli/README.md`

**Files:**
- Modify: `apps/cli/README.md`

- [ ] **Step 1: Add `--from` flag, `target create`, `token --preset`, `--config-overrides publicBaseUrl` example**

Edit `apps/cli/README.md`. Update the Commands section to include the new commands and flags. Add a "Deploying a workflow-enabled blueprint" section:

```markdown
### Deploying a workflow-enabled blueprint

A project that ships `workflows/workflows.json` requires the deploy target to
have `workflows.engine` and `workflows.worker` configured. Create a fresh
target with both images:

    rntme target create my-bpmn-target \
      --kind dokploy \
      --display-name "BPMN demo target" \
      --dokploy-url https://dokploy.example.com \
      --dokploy-project-id <id> \
      --api-token @~/.dokploy-token \
      --public-base-url https://order-demo.example.com \
      --workflow-engine-image operaton/operaton:1.0.0-beta-5 \
      --workflow-worker-image ghcr.io/vladprrs/rntme-bpmn-worker:<sha>

Or update an existing target:

    cat > /tmp/wf.json <<EOF
    {"workflows":{"engine":{"kind":"operaton","mode":"provisioned","image":"operaton/operaton:1.0.0-beta-5"},"worker":{"image":"ghcr.io/vladprrs/rntme-bpmn-worker:<sha>"}}}
    EOF
    rntme target set-config my-target --from /tmp/wf.json

See [`demo/order-fulfillment-blueprint/README.md`](../../demo/order-fulfillment-blueprint/README.md) for current image pins.

### Overriding `publicBaseUrl` per deployment

`configOverrides.publicBaseUrl` overrides the target's default URL for one
deployment. The DNS record for the new domain MUST already point at the same
Dokploy host; no DNS records are created automatically.

    echo '{"publicBaseUrl":"https://order-demo.rntme.com"}' > /tmp/ovr.json
    rntme project deploy --org acme --project order-fulfillment --version 1 \
      --target dokploy-shared --config-overrides /tmp/ovr.json
```

- [ ] **Step 2: Commit**

```bash
git add apps/cli/README.md
git commit -m "docs(cli): document target create, --from, --preset, publicBaseUrl override"
```

---

### Task 24: Pin tags in `demo/order-fulfillment-blueprint/README.md`

**Files:**
- Modify: `demo/order-fulfillment-blueprint/README.md`

- [ ] **Step 1: Resolve current image tags**

For Operaton, run:
```bash
curl -s https://hub.docker.com/v2/repositories/operaton/operaton/tags?page_size=10 | jq -r '.results[].name'
```
Pick a stable non-`latest`, non-`-alpha`, non-`-beta` tag if available; otherwise the most recent stable beta. Record the pinned value.

For `ghcr.io/vladprrs/rntme-bpmn-worker` and `ghcr.io/vladprrs/rntme-runtime`, use the merge SHA of `main` at PR time. If image manifests for that SHA exist on GHCR (verify with `docker manifest inspect`), use those values.

- [ ] **Step 2: Replace `<pinned-tag>` placeholders**

Edit `demo/order-fulfillment-blueprint/README.md`. Replace the `<pinned-tag>` and `<owner>:<tag>` placeholders in the live e2e block with the resolved concrete values. Keep `<sha>` inline if it must remain abstract (with a note pointing to CI workflow `runtime-image.yml`).

- [ ] **Step 3: Commit**

```bash
git add demo/order-fulfillment-blueprint/README.md
git commit -m "docs(demo): pin Operaton/runtime/bpmn-worker image tags"
```

---

### Task 25: Update OpenAPI definitions

**Files:**
- Modify: `apps/platform-http/src/openapi.ts`

- [ ] **Step 1: Find error-response schemas**

Run: `grep -n "error\|errors" apps/platform-http/src/openapi.ts | head -40`

Locate the shared error response schema definition.

- [ ] **Step 2: Update the error response schema**

Edit `apps/platform-http/src/openapi.ts`. In the shared error response schema, add the optional `errors[]` field with a recursive `PlatformErrorNode` shape:

```ts
const PlatformErrorNodeSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    path: { type: 'string' },
    cause: { type: 'array', items: { $ref: '#/components/schemas/PlatformErrorNode' } },
  },
  required: ['code', 'message'],
};
// register PlatformErrorNode in components.schemas
// extend the existing error schema's properties:
//   error.errors: { type: 'array', items: { $ref: '#/components/schemas/PlatformErrorNode' } }
```

(Adapt to whatever the file's serialization style is — explicit JSON schema vs zod-to-openapi.)

For `StartDeploymentRequest`, add `publicBaseUrl: { type: 'string', format: 'uri' }` to `configOverrides.properties`.

- [ ] **Step 3: Run typecheck/test**

Run: `pnpm -F @rntme/platform-http test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/platform-http/src/openapi.ts
git commit -m "docs(platform-http): document errors[] tree and publicBaseUrl override in openapi"
```

---

### Task 26: Update package READMEs (`@rntme/blueprint`, `@rntme/platform-core`)

**Files:**
- Modify: `packages/artifacts/blueprint/README.md`
- Modify: `packages/platform/platform-core/README.md`

- [ ] **Step 1: Document new exports in blueprint README**

Edit `packages/artifacts/blueprint/README.md`. Under the API section, add:

```markdown
### `materializeBundle(bundle: CanonicalBundle): Promise<string>`

Writes a canonical bundle to a fresh temp directory. The caller is responsible
for `rm`ing the directory when done.

### `materializeAndCompose(bundle: CanonicalBundle): Promise<Result<MaterializeResult>>`

Convenience for client/server parity: materializes the bundle, runs
`loadComposedBlueprint`, and removes the temp directory regardless of outcome.
Used by `apps/cli` to validate bundles locally before publishing, and by
`apps/platform-http` on the publish endpoint.
```

- [ ] **Step 2: Document `PlatformErrorNode` in platform-core README**

Edit `packages/platform/platform-core/README.md`. Add a section describing the structured error tree:

```markdown
### Structured error responses

`PlatformError.errors?: readonly PlatformErrorNode[]` carries the cause tree
for blueprint-validation and deploy-pipeline errors. Each node has
`code`, `message`, optional `path`, and optional recursive `cause`.

The wire format is:

    {
      "error": {
        "code": "PROJECT_VERSION_BLUEPRINT_INVALID",
        "message": "BLUEPRINT_WORKFLOWS_INVALID: workflow artifact failed validation",
        "stage": "validation",
        "errors": [
          {
            "code": "BLUEPRINT_WORKFLOWS_INVALID",
            "message": "workflow artifact failed validation",
            "path": "workflows/workflows.json",
            "cause": [
              { "code": "WORKFLOWS_FILE_MISSING", "message": "...", "path": "..." }
            ]
          }
        ]
      },
      "requestId": "req_..."
    }

CRUD endpoints outside the blueprint/deploy surface keep the flat shape with
just `code` and `message`.
```

- [ ] **Step 3: Commit**

```bash
git add packages/artifacts/blueprint/README.md packages/platform/platform-core/README.md
git commit -m "docs(packages): document materializeAndCompose and structured error tree"
```

---

## Final verification

### Task 27: Full repo build + test sweep

- [ ] **Step 1: Clean dist and rebuild**

```bash
pnpm -r run build
```

Expected: all packages build.

- [ ] **Step 2: Typecheck everything**

```bash
pnpm -r run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run all tests**

```bash
pnpm -r run test
```

Expected: PASS.

- [ ] **Step 4: Lint**

```bash
pnpm -r run lint
```

Expected: PASS.

- [ ] **Step 5: Dependency-cruiser**

```bash
pnpm depcruise
```

Expected: no violations.

- [ ] **Step 6: Final commit (if anything pending)**

If any test fixtures or generated files require an extra touch (e.g., snapshot updates), commit them under `chore: final test fixture sync`.

---

## Appendix: open questions / deferred follow-ups

These are noted in the spec §10 and not implemented in this plan:

- Browser-based OAuth login.
- A `--public-base-url` shorthand on `project deploy`.
- Platform admin migration that retroactively populates `workflows` on existing targets.
- Dist-freshness CI guard.
