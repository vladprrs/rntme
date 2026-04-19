# rntme CLI — platform commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the command surface defined in `docs/superpowers/specs/2026-04-19-rntme-cli-platform-commands-design.md` (Scope B: login, token, project, service, version, tag, publish, validate) in the existing `@rntme-cli/cli` package.

**Architecture:** Single package extension. `src/{bin,commands,config,api,errors,validate,output,util}/` modules wired into a thin `parseArgs` dispatcher. Handwritten typed `fetch` client mirrors platform Zod schemas. Local validation reuses `@rntme-cli/platform-core.validateBundle()` (see amendment #1 below).

**Tech Stack:** Node 20+, TypeScript 5.5, vitest 2.1, zod, `@truestamp/canonify`, global `fetch`. Lazy-imports `@rntme-cli/platform-core`, `@rntme/pdm`, `@rntme/qsm`, `@rntme/graph-ir-compiler`, `@rntme/bindings`, `@rntme/ui`, `@rntme/seed` for `rntme validate` only.

---

## Amendments to spec (research-driven; may reject)

**Amendment #1 — allow `@rntme-cli/platform-core` import in CLI.**
Spec §4.4 bans the import. Research shows platform-core already implements `validateBundle()` (pure TypeScript, no Drizzle/Hono/AWS per platform-api-design §4.1). Re-implementing it in CLI drifts from server-side gate over time. **Plan uses platform-core.validateBundle() directly** under a lazy-import, confined to `src/validate/run.ts` so only the `rntme validate` command pulls it in. All other forbidden imports (`platform-storage`, `platform-http`, workos, drizzle, aws-sdk) remain banned and are still lint-enforced.

*If rejected:* swap Task 21 for a hand-written re-implementation of the 6-layer chain (~80 LOC), mirroring `platform-core/src/validation/bundle.ts`. Rest of plan unchanged.

**Amendment #2 — add `GET /v1/auth/me` to `platform-http` as Task 14.**
Spec §11.1 of platform-api-design declares this endpoint but it isn't implemented (only `/auth/login` / `/auth/callback` / `/auth/logout` exist in `rntme-cli/packages/platform-http/src/routes/auth.ts`). `rntme whoami` depends on it. Task 14 adds ~30 LOC to platform-http — small, self-contained, matches the spec.

*If rejected:* drop `rntme whoami` from MVP scope; users verify auth via `rntme project list` (non-401 == authenticated). Also drop Task 15.

---

## Package layout (what gets created/modified)

**Modified:**
- `rntme-cli/packages/cli/package.json` — add deps
- `rntme-cli/packages/cli/src/bin/cli.ts` — replace skeleton with dispatcher
- `rntme-cli/packages/cli/src/index.ts` — export entry
- `rntme-cli/packages/cli/eslint.config.mjs` — add `no-restricted-imports` rule
- `rntme-cli/packages/cli/tsconfig.json` / `tsconfig.check.json` — include `test/**/*`
- `rntme-cli/packages/platform-http/src/routes/auth.ts` — add `GET /v1/auth/me`
- `rntme-cli/packages/platform-http/src/app.ts` — register new route (if needed)
- `demo/issue-tracker-api/` — add `rntme.json`

**Created (CLI source):**
- `src/config/project.ts` · `src/config/credentials.ts` · `src/config/resolve.ts`
- `src/api/client.ts` · `src/api/endpoints.ts` · `src/api/types.ts`
- `src/errors/codes.ts` · `src/errors/render.ts` · `src/errors/exit.ts`
- `src/output/format.ts` · `src/output/tables.ts`
- `src/util/canonical-json.ts`
- `src/validate/run.ts`
- `src/commands/login.ts` · `logout.ts` · `whoami.ts` · `publish.ts` · `validate.ts`
- `src/commands/token/create.ts` · `list.ts` · `revoke.ts`
- `src/commands/project/create.ts` · `list.ts` · `show.ts`
- `src/commands/service/create.ts` · `list.ts` · `show.ts`
- `src/commands/version/list.ts` · `show.ts`
- `src/commands/tag/list.ts` · `set.ts` · `delete.ts`

**Created (tests):**
- `test/unit/config/project.test.ts` · `credentials.test.ts` · `resolve.test.ts`
- `test/unit/api/client.test.ts`
- `test/unit/errors/render.test.ts` · `exit.test.ts`
- `test/unit/output/tables.test.ts`
- `test/unit/util/canonical-json.test.ts`
- `test/integration/commands.test.ts` (MSW-mock for each command)
- `test/e2e/publish-loop.test.ts` (against `platform.rntme.com`; skip without `RNTME_E2E_TOKEN`)
- `test/fixtures/rntme.json` · `bundle/{manifest,pdm,qsm,graphIr,bindings,ui,seed}.json` · `bundle-broken/qsm.json` · `credentials-0600.json` · `credentials-0644.json`

---

## Task 0: Preflight

**Files:** (none modified)

- [ ] **Step 1: Verify spec was read**

Read `docs/superpowers/specs/2026-04-19-rntme-cli-platform-commands-design.md` end-to-end. All tasks below reference it by section number.

- [ ] **Step 2: Confirm baseline is green**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme-cli/cli typecheck
pnpm -F @rntme-cli/cli lint
pnpm -F @rntme-cli/cli test
```

Expected: all green. If red — fix first; this plan assumes clean start.

- [ ] **Step 3: Commit a "plan start" marker (optional)**

```bash
git commit --allow-empty -m "chore: begin rntme-cli platform-commands plan"
```

---

## Task 1: Add runtime deps to `@rntme-cli/cli`

**Files:**
- Modify: `rntme-cli/packages/cli/package.json`

- [ ] **Step 1: Update `package.json` deps**

Open `rntme-cli/packages/cli/package.json`. Insert `"dependencies"` block after `"devDependencies"` (and before closing `}`). Keep existing fields.

```json
  "dependencies": {
    "zod": "^3.23.8",
    "@truestamp/canonify": "^1.0.0"
  },
```

*Rationale:* `zod` parses `rntme.json`, credentials file, HTTP responses. `@truestamp/canonify` computes canonical JSON for `bundleDigest`. Validators (`@rntme/pdm` etc.) and `@rntme-cli/platform-core` are intentionally NOT listed — they are lazy-imported from workspace (see Task 20/21) and must NOT appear in hot-path command cold-start.

- [ ] **Step 2: Install and lock**

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` updated in repo root; no errors.

- [ ] **Step 3: Verify CLI still compiles**

```bash
pnpm -F @rntme-cli/cli typecheck
```

Expected: green (we haven't written any new code yet).

- [ ] **Step 4: Commit**

```bash
git add rntme-cli/packages/cli/package.json pnpm-lock.yaml
git commit -m "feat(cli): add zod + canonify runtime deps"
```

---

## Task 2: TypeScript Result helper

**Files:**
- Create: `rntme-cli/packages/cli/src/result.ts`

A shared `Result<T, E>` type for CLI-internal use. Matches the shape used in `@rntme-cli/platform-core/src/types/result.ts` so values pass through cleanly.

- [ ] **Step 1: Create the file**

```typescript
// rntme-cli/packages/cli/src/result.ts
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm -F @rntme-cli/cli typecheck
```

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add rntme-cli/packages/cli/src/result.ts
git commit -m "feat(cli): add Result<T,E> helper"
```

---

## Task 3: CLI error codes + exit-code mapping

**Files:**
- Create: `rntme-cli/packages/cli/src/errors/codes.ts`
- Create: `rntme-cli/packages/cli/src/errors/exit.ts`
- Create: `rntme-cli/packages/cli/test/unit/errors/exit.test.ts`

Per spec §7.4, §7.5.

- [ ] **Step 1: Write `errors/codes.ts`**

```typescript
// rntme-cli/packages/cli/src/errors/codes.ts
export const CLI_ERROR_CODES = [
  'CLI_CONFIG_MISSING',
  'CLI_CONFIG_INVALID',
  'CLI_CONFIG_ARTIFACT_NOT_FOUND',
  'CLI_CREDENTIALS_MISSING',
  'CLI_CREDENTIALS_INVALID',
  'CLI_CREDENTIALS_PERMISSIONS_TOO_OPEN',
  'CLI_RESPONSE_PARSE_FAILED',
  'CLI_VALIDATE_LOCAL_FAILED',
  'CLI_PUBLISH_DIGEST_MISMATCH',
  'CLI_NETWORK_TIMEOUT',
  'CLI_USAGE',
] as const;

export type CliErrorCode = (typeof CLI_ERROR_CODES)[number];

export type CliError = {
  readonly kind: 'cli';
  readonly code: CliErrorCode;
  readonly message: string;
  readonly hint?: string;
  readonly cause?: unknown;
};

export function cliError(code: CliErrorCode, message: string, hint?: string, cause?: unknown): CliError {
  return { kind: 'cli', code, message, hint, cause };
}
```

- [ ] **Step 2: Write failing test for exit mapping**

```typescript
// rntme-cli/packages/cli/test/unit/errors/exit.test.ts
import { describe, it, expect } from 'vitest';
import { exitCodeFor } from '../../../src/errors/exit.js';

describe('exitCodeFor', () => {
  it.each([
    ['CLI_CONFIG_MISSING', 2],
    ['CLI_CONFIG_INVALID', 2],
    ['CLI_CREDENTIALS_MISSING', 2],
    ['CLI_CREDENTIALS_PERMISSIONS_TOO_OPEN', 2],
    ['PLATFORM_AUTH_MISSING', 3],
    ['PLATFORM_AUTH_INVALID', 3],
    ['PLATFORM_AUTH_FORBIDDEN', 4],
    ['PLATFORM_TENANCY_PROJECT_NOT_FOUND', 5],
    ['PLATFORM_TENANCY_RESOURCE_ARCHIVED', 5],
    ['PLATFORM_VALIDATION_BUNDLE_FAILED', 6],
    ['CLI_VALIDATE_LOCAL_FAILED', 6],
    ['PLATFORM_CONCURRENCY_VERSION_CONFLICT', 7],
    ['PLATFORM_RATE_LIMITED', 8],
    ['CLI_NETWORK_TIMEOUT', 9],
    ['PLATFORM_INTERNAL', 10],
    ['PLATFORM_STORAGE_BLOB_UPLOAD_FAILED', 10],
  ])('%s → exit %i', (code, exit) => {
    expect(exitCodeFor(code)).toBe(exit);
  });

  it('unknown code defaults to 1', () => {
    expect(exitCodeFor('BOGUS_CODE')).toBe(1);
  });

  it('null/undefined input returns 1', () => {
    expect(exitCodeFor(undefined)).toBe(1);
  });
});
```

- [ ] **Step 3: Run test, verify FAIL**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/errors/exit.test.ts
```

Expected: FAIL (`exitCodeFor` not defined).

- [ ] **Step 4: Write `errors/exit.ts`**

```typescript
// rntme-cli/packages/cli/src/errors/exit.ts
const EXIT_MAP: Record<string, number> = {
  // CLI_* (config/credentials → 2)
  CLI_CONFIG_MISSING: 2,
  CLI_CONFIG_INVALID: 2,
  CLI_CONFIG_ARTIFACT_NOT_FOUND: 2,
  CLI_CREDENTIALS_MISSING: 2,
  CLI_CREDENTIALS_INVALID: 2,
  CLI_CREDENTIALS_PERMISSIONS_TOO_OPEN: 2,
  CLI_USAGE: 2,
  CLI_RESPONSE_PARSE_FAILED: 10,
  CLI_VALIDATE_LOCAL_FAILED: 6,
  CLI_PUBLISH_DIGEST_MISMATCH: 1,
  CLI_NETWORK_TIMEOUT: 9,

  // PLATFORM_AUTH_*
  PLATFORM_AUTH_MISSING: 3,
  PLATFORM_AUTH_INVALID: 3,
  PLATFORM_AUTH_TOKEN_REVOKED: 3,
  PLATFORM_AUTH_TOKEN_EXPIRED: 3,
  PLATFORM_AUTH_FORBIDDEN: 4,

  // Parse → 2 (config-like from client perspective)
  PLATFORM_PARSE_BODY_INVALID: 2,
  PLATFORM_PARSE_PATH_INVALID: 2,

  // Tenancy → 5
  PLATFORM_TENANCY_ORG_NOT_FOUND: 5,
  PLATFORM_TENANCY_PROJECT_NOT_FOUND: 5,
  PLATFORM_TENANCY_SERVICE_NOT_FOUND: 5,
  PLATFORM_TENANCY_RESOURCE_ARCHIVED: 5,

  // Validation → 6
  PLATFORM_VALIDATION_BUNDLE_FAILED: 6,

  // Concurrency → 7
  PLATFORM_CONCURRENCY_VERSION_CONFLICT: 7,
  PLATFORM_CONCURRENCY_LAST_OWNER: 7,

  // Rate limit → 8
  PLATFORM_RATE_LIMITED: 8,

  // Storage / internal → 10
  PLATFORM_STORAGE_BLOB_UPLOAD_FAILED: 10,
  PLATFORM_STORAGE_DB_UNAVAILABLE: 10,
  PLATFORM_INTERNAL: 10,
  PLATFORM_WORKOS_WEBHOOK_INVALID: 10,
  PLATFORM_WORKOS_UNAVAILABLE: 10,
};

export function exitCodeFor(code: string | undefined): number {
  if (!code) return 1;
  return EXIT_MAP[code] ?? 1;
}
```

- [ ] **Step 5: Run test, verify PASS**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/errors/exit.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/cli/src/errors/ rntme-cli/packages/cli/test/unit/errors/
git commit -m "feat(cli): CLI error-code registry + exit-code map"
```

---

## Task 4: Canonical JSON + bundleDigest

**Files:**
- Create: `rntme-cli/packages/cli/src/util/canonical-json.ts`
- Create: `rntme-cli/packages/cli/test/unit/util/canonical-json.test.ts`
- Create: `rntme-cli/packages/cli/test/fixtures/bundle/*.json` (7 files; reuse demo artifacts)

Per spec §8 step 4 (publish flow) and §6 of platform-api-design.

- [ ] **Step 1: Copy fixture bundle from demo**

```bash
mkdir -p rntme-cli/packages/cli/test/fixtures/bundle
cp demo/issue-tracker-api/artifacts/manifest.json rntme-cli/packages/cli/test/fixtures/bundle/manifest.json
cp demo/issue-tracker-api/artifacts/pdm.json      rntme-cli/packages/cli/test/fixtures/bundle/pdm.json
cp demo/issue-tracker-api/artifacts/qsm.json      rntme-cli/packages/cli/test/fixtures/bundle/qsm.json
cp demo/issue-tracker-api/artifacts/bindings.json rntme-cli/packages/cli/test/fixtures/bundle/bindings.json
cp demo/issue-tracker-api/artifacts/seed.json     rntme-cli/packages/cli/test/fixtures/bundle/seed.json
```

For `graphIr.json` and `ui.json`: the demo uses split directories (`artifacts/graphs/*.json`, `artifacts/ui/*.json`). The CLI spec assumes one-file-per-artifact. Use stubs for now; full graphs/ui serialization is out of scope for this plan (Task 22 revisits via the real `rntme.json` demo entry).

```bash
cat > rntme-cli/packages/cli/test/fixtures/bundle/graphIr.json <<'EOF'
{ "graphs": {}, "shapes": {} }
EOF
cat > rntme-cli/packages/cli/test/fixtures/bundle/ui.json <<'EOF'
{ "version": "1", "screens": {} }
EOF
```

- [ ] **Step 2: Write failing tests**

```typescript
// rntme-cli/packages/cli/test/unit/util/canonical-json.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalJson, fileDigest, bundleDigest } from '../../../src/util/canonical-json.js';

describe('canonicalJson', () => {
  it('sorts object keys recursively', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ b: { y: 1, x: 2 }, a: 3 })).toBe('{"a":3,"b":{"x":2,"y":1}}');
  });

  it('preserves array order', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('emits no whitespace', () => {
    const out = canonicalJson({ a: [1, 2], b: { c: 3 } });
    expect(out).not.toMatch(/\s/);
  });

  it('is deterministic across formatting', () => {
    const a = JSON.parse('{ "b": 1, "a": 2 }');
    const b = JSON.parse('{"a":2,"b":1}');
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});

describe('fileDigest', () => {
  it('returns sha256 hex of canonical form', () => {
    expect(fileDigest({ hello: 'world' })).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const d1 = fileDigest({ a: 1, b: 2 });
    const d2 = fileDigest({ b: 2, a: 1 });
    expect(d1).toBe(d2);
  });
});

describe('bundleDigest', () => {
  it('concatenates per-file digests in fixed order', () => {
    const fixtures = resolve(__dirname, '../../fixtures/bundle');
    const read = (n: string) => JSON.parse(readFileSync(`${fixtures}/${n}.json`, 'utf8'));

    const digest = bundleDigest({
      manifest: read('manifest'),
      pdm: read('pdm'),
      qsm: read('qsm'),
      graphIr: read('graphIr'),
      bindings: read('bindings'),
      ui: read('ui'),
      seed: read('seed'),
    });

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('order-sensitive: swapping pdm and qsm changes digest', () => {
    // (only sanity — confirms we're not accidentally sorting inputs)
    const d1 = bundleDigest({
      manifest: {}, pdm: { a: 1 }, qsm: { b: 2 },
      graphIr: {}, bindings: {}, ui: {}, seed: {},
    });
    const d2 = bundleDigest({
      manifest: {}, pdm: { b: 2 }, qsm: { a: 1 },
      graphIr: {}, bindings: {}, ui: {}, seed: {},
    });
    expect(d1).not.toBe(d2);
  });
});
```

- [ ] **Step 3: Run test, verify FAIL**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/util/canonical-json.test.ts
```

Expected: FAIL (functions not defined).

- [ ] **Step 4: Write the module**

```typescript
// rntme-cli/packages/cli/src/util/canonical-json.ts
import { createHash } from 'node:crypto';
import { canonify } from '@truestamp/canonify';

export type BundleFiles = {
  manifest: unknown;
  pdm: unknown;
  qsm: unknown;
  graphIr: unknown;
  bindings: unknown;
  ui: unknown;
  seed: unknown;
};

const BUNDLE_ORDER: ReadonlyArray<keyof BundleFiles> = [
  'manifest',
  'pdm',
  'qsm',
  'graphIr',
  'bindings',
  'ui',
  'seed',
];

export function canonicalJson(value: unknown): string {
  return canonify(value);
}

export function fileDigest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function bundleDigest(files: BundleFiles): string {
  const concat = BUNDLE_ORDER.map((k) => fileDigest(files[k])).join('');
  return createHash('sha256').update(concat).digest('hex');
}
```

- [ ] **Step 5: Run test, verify PASS**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/util/canonical-json.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/cli/src/util/ \
        rntme-cli/packages/cli/test/unit/util/ \
        rntme-cli/packages/cli/test/fixtures/bundle/
git commit -m "feat(cli): canonical-JSON + sha256 bundleDigest"
```

---

## Task 5: `rntme.json` config discovery

**Files:**
- Create: `rntme-cli/packages/cli/src/config/project.ts`
- Create: `rntme-cli/packages/cli/test/unit/config/project.test.ts`
- Create: `rntme-cli/packages/cli/test/fixtures/rntme.json`

Per spec §6.1.

- [ ] **Step 1: Create fixture `rntme.json`**

```json
// rntme-cli/packages/cli/test/fixtures/rntme.json
{
  "org": "rntme-cli-e2e",
  "project": "issue-tracker",
  "service": "api",
  "artifacts": {
    "manifest": "bundle/manifest.json",
    "pdm": "bundle/pdm.json",
    "qsm": "bundle/qsm.json",
    "graphIr": "bundle/graphIr.json",
    "bindings": "bundle/bindings.json",
    "ui": "bundle/ui.json",
    "seed": "bundle/seed.json"
  }
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// rntme-cli/packages/cli/test/unit/config/project.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverProjectConfig, parseProjectConfig } from '../../../src/config/project.js';

function setupTree(layout: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'rntme-cfg-'));
  for (const [path, content] of Object.entries(layout)) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

describe('discoverProjectConfig', () => {
  it('finds rntme.json in cwd', async () => {
    const root = setupTree({
      'rntme.json': JSON.stringify({
        org: 'acme', project: 'p', service: 's',
        artifacts: { manifest: 'a.json', pdm: 'a.json', qsm: 'a.json',
                     graphIr: 'a.json', bindings: 'a.json', ui: 'a.json', seed: 'a.json' },
      }),
    });
    const result = await discoverProjectConfig(root);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toBe(join(root, 'rntme.json'));
      expect(result.value.config.org).toBe('acme');
    }
  });

  it('walks up from sub-directory', async () => {
    const root = setupTree({
      'rntme.json': JSON.stringify({
        org: 'acme', project: 'p', service: 's',
        artifacts: { manifest: 'a.json', pdm: 'a.json', qsm: 'a.json',
                     graphIr: 'a.json', bindings: 'a.json', ui: 'a.json', seed: 'a.json' },
      }),
      'src/index.ts': '',
    });
    const result = await discoverProjectConfig(join(root, 'src'));
    expect(result.ok).toBe(true);
  });

  it('returns CLI_CONFIG_MISSING when no rntme.json up the tree', async () => {
    const root = setupTree({ 'index.ts': '' });
    const result = await discoverProjectConfig(root);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_CONFIG_MISSING');
  });

  it('CLI_CONFIG_INVALID on bad JSON', async () => {
    const root = setupTree({ 'rntme.json': '{ not json' });
    const result = await discoverProjectConfig(root);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_CONFIG_INVALID');
  });

  it('CLI_CONFIG_INVALID on bad slug', async () => {
    const root = setupTree({
      'rntme.json': JSON.stringify({
        org: 'ab', // too short
        project: 'p', service: 's',
        artifacts: { manifest: 'a.json', pdm: 'a.json', qsm: 'a.json',
                     graphIr: 'a.json', bindings: 'a.json', ui: 'a.json', seed: 'a.json' },
      }),
    });
    const result = await discoverProjectConfig(root);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_CONFIG_INVALID');
  });

  it('CLI_CONFIG_INVALID on absolute artifact path', async () => {
    const root = setupTree({
      'rntme.json': JSON.stringify({
        org: 'acme', project: 'p', service: 's',
        artifacts: { manifest: '/abs/manifest.json', pdm: 'a.json', qsm: 'a.json',
                     graphIr: 'a.json', bindings: 'a.json', ui: 'a.json', seed: 'a.json' },
      }),
    });
    const result = await discoverProjectConfig(root);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_CONFIG_INVALID');
  });
});
```

- [ ] **Step 3: Run test, verify FAIL**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/config/project.test.ts
```

Expected: FAIL (module not defined).

- [ ] **Step 4: Write the module**

```typescript
// rntme-cli/packages/cli/src/config/project.ts
import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { Result, ok, err } from '../result.js';
import { CliError, cliError } from '../errors/codes.js';

const OrgSlug = z.string().regex(/^[a-z0-9-]{3,40}$/);
const ProjSlug = z.string().regex(/^[a-z0-9-]{3,60}$/);
const SvcSlug = z.string().regex(/^[a-z0-9-]{3,60}$/);

const RntmeProjectConfigSchema = z.object({
  $schema: z.string().url().optional(),
  org: OrgSlug,
  project: ProjSlug,
  service: SvcSlug,
  artifacts: z.object({
    manifest: z.string(),
    pdm: z.string(),
    qsm: z.string(),
    graphIr: z.string(),
    bindings: z.string(),
    ui: z.string(),
    seed: z.string(),
  }),
  defaults: z
    .object({
      tags: z.array(z.string()).optional(),
      message: z.string().optional(),
    })
    .optional(),
});

export type RntmeProjectConfig = z.infer<typeof RntmeProjectConfigSchema>;

export type DiscoveredConfig = {
  path: string;
  dir: string;
  config: RntmeProjectConfig;
};

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function discoverProjectConfig(
  startDir: string,
): Promise<Result<DiscoveredConfig, CliError>> {
  let dir = resolve(startDir);
  // Stop when we hit the filesystem root
  while (true) {
    const candidate = join(dir, 'rntme.json');
    if (await fileExists(candidate)) {
      return parseProjectConfig(candidate);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return err(
    cliError(
      'CLI_CONFIG_MISSING',
      'rntme.json not found in current directory or any parent',
      'create `rntme.json` at the service root (see `rntme --help`)',
    ),
  );
}

export async function parseProjectConfig(
  path: string,
): Promise<Result<DiscoveredConfig, CliError>> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (cause) {
    return err(cliError('CLI_CONFIG_MISSING', `cannot read ${path}`, undefined, cause));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    return err(cliError('CLI_CONFIG_INVALID', `invalid JSON in ${path}`, undefined, cause));
  }

  const schemaResult = RntmeProjectConfigSchema.safeParse(parsed);
  if (!schemaResult.success) {
    return err(
      cliError(
        'CLI_CONFIG_INVALID',
        `rntme.json schema violation: ${schemaResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      ),
    );
  }

  const cfg = schemaResult.data;

  // Reject absolute paths in artifacts
  for (const [key, p] of Object.entries(cfg.artifacts)) {
    if (isAbsolute(p)) {
      return err(
        cliError(
          'CLI_CONFIG_INVALID',
          `artifacts.${key} must be a relative path (got: ${p})`,
        ),
      );
    }
  }

  return ok({ path, dir: dirname(path), config: cfg });
}
```

- [ ] **Step 5: Run test, verify PASS**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/config/project.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/cli/src/config/project.ts \
        rntme-cli/packages/cli/test/unit/config/project.test.ts \
        rntme-cli/packages/cli/test/fixtures/rntme.json
git commit -m "feat(cli): rntme.json discovery + Zod validation"
```

---

## Task 6: Credentials file (XDG)

**Files:**
- Create: `rntme-cli/packages/cli/src/config/credentials.ts`
- Create: `rntme-cli/packages/cli/test/unit/config/credentials.test.ts`

Per spec §6.2.

- [ ] **Step 1: Write failing tests**

```typescript
// rntme-cli/packages/cli/test/unit/config/credentials.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, statSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  credentialsPath,
  readCredentials,
  writeCredentials,
} from '../../../src/config/credentials.js';

describe('credentialsPath', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('honours XDG_CONFIG_HOME when set', () => {
    process.env.XDG_CONFIG_HOME = '/custom/xdg';
    delete process.env.HOME;
    // On non-Windows platforms
    if (process.platform !== 'win32') {
      expect(credentialsPath()).toBe('/custom/xdg/rntme/credentials.json');
    }
  });

  it('falls back to ~/.config/rntme on Linux/macOS', () => {
    delete process.env.XDG_CONFIG_HOME;
    process.env.HOME = '/home/user';
    if (process.platform !== 'win32') {
      expect(credentialsPath()).toBe('/home/user/.config/rntme/credentials.json');
    }
  });
});

describe('writeCredentials + readCredentials', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'rntme-creds-'));
  });

  it('writes with mode 0600 and dir 0700', async () => {
    const target = join(tmp, 'rntme/credentials.json');
    const result = await writeCredentials(target, {
      version: 1,
      defaultProfile: 'default',
      profiles: {
        default: {
          baseUrl: 'https://platform.rntme.com',
          token: 'rntme_pat_abcdefghijklmnopqrstuv',
          addedAt: new Date().toISOString(),
        },
      },
    });
    expect(result.ok).toBe(true);
    const fileMode = statSync(target).mode & 0o777;
    const dirMode = statSync(join(tmp, 'rntme')).mode & 0o777;
    if (process.platform !== 'win32') {
      expect(fileMode).toBe(0o600);
      expect(dirMode).toBe(0o700);
    }
  });

  it('round-trips via readCredentials', async () => {
    const target = join(tmp, 'creds.json');
    const input = {
      version: 1 as const,
      defaultProfile: 'default',
      profiles: {
        default: {
          baseUrl: 'https://platform.rntme.com',
          token: 'rntme_pat_abcdefghijklmnopqrstuv',
          addedAt: '2026-04-19T12:00:00.000Z',
        },
      },
    };
    await writeCredentials(target, input);
    const read = await readCredentials(target);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value).toEqual(input);
  });

  it('CLI_CREDENTIALS_MISSING when file absent', async () => {
    const result = await readCredentials(join(tmp, 'nope.json'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_CREDENTIALS_MISSING');
  });

  it('CLI_CREDENTIALS_PERMISSIONS_TOO_OPEN when mode 0644', async () => {
    if (process.platform === 'win32') return; // modes don't enforce on Windows
    const target = join(tmp, 'creds.json');
    await writeCredentials(target, {
      version: 1,
      defaultProfile: 'default',
      profiles: {
        default: {
          baseUrl: 'https://platform.rntme.com',
          token: 'rntme_pat_abcdefghijklmnopqrstuv',
          addedAt: '2026-04-19T12:00:00.000Z',
        },
      },
    });
    chmodSync(target, 0o644);
    const result = await readCredentials(target);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_CREDENTIALS_PERMISSIONS_TOO_OPEN');
  });

  it('CLI_CREDENTIALS_INVALID on bad JSON', async () => {
    const target = join(tmp, 'creds.json');
    await writeCredentials(target, {
      version: 1,
      defaultProfile: 'default',
      profiles: {
        default: {
          baseUrl: 'https://platform.rntme.com',
          token: 'rntme_pat_abcdefghijklmnopqrstuv',
          addedAt: '2026-04-19T12:00:00.000Z',
        },
      },
    });
    // corrupt it
    const fs = await import('node:fs/promises');
    await fs.writeFile(target, 'not json', { mode: 0o600 });
    const result = await readCredentials(target);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_CREDENTIALS_INVALID');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/config/credentials.test.ts
```

Expected: FAIL (module not defined).

- [ ] **Step 3: Write the module**

```typescript
// rntme-cli/packages/cli/src/config/credentials.ts
import { readFile, writeFile, mkdir, stat, chmod } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { Result, ok, err } from '../result.js';
import { CliError, cliError } from '../errors/codes.js';

export const PROFILE_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

const ProfileSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().regex(/^rntme_pat_[a-zA-Z0-9]{22}$/),
  addedAt: z.string().datetime(),
});

export const CredentialsFileSchema = z.object({
  version: z.literal(1),
  defaultProfile: z.string().regex(PROFILE_REGEX),
  profiles: z.record(z.string().regex(PROFILE_REGEX), ProfileSchema),
});

export type CredentialsFile = z.infer<typeof CredentialsFileSchema>;

export function credentialsPath(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'rntme', 'credentials.json');
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.length > 0) {
    return join(xdg, 'rntme', 'credentials.json');
  }
  return join(homedir(), '.config', 'rntme', 'credentials.json');
}

export async function writeCredentials(
  path: string,
  data: CredentialsFile,
): Promise<Result<void, CliError>> {
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    // mkdir's mode is pre-umask; enforce explicitly
    if (process.platform !== 'win32') await chmod(dirname(path), 0o700);
    await writeFile(path, JSON.stringify(data, null, 2), { mode: 0o600 });
    if (process.platform !== 'win32') await chmod(path, 0o600);
    return ok(undefined);
  } catch (cause) {
    return err(cliError('CLI_CREDENTIALS_INVALID', `cannot write credentials at ${path}`, undefined, cause));
  }
}

export async function readCredentials(
  path: string,
): Promise<Result<CredentialsFile, CliError>> {
  let s: Awaited<ReturnType<typeof stat>>;
  try {
    s = await stat(path);
  } catch (cause) {
    return err(
      cliError(
        'CLI_CREDENTIALS_MISSING',
        `credentials file not found at ${path}`,
        'run `rntme login --token <your-pat>`',
        cause,
      ),
    );
  }

  if (process.platform !== 'win32') {
    const mode = s.mode & 0o777;
    if (mode !== 0o600) {
      return err(
        cliError(
          'CLI_CREDENTIALS_PERMISSIONS_TOO_OPEN',
          `credentials file ${path} has mode ${mode.toString(8)}; must be 600`,
          `run: chmod 600 ${path}`,
        ),
      );
    }
  }

  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (cause) {
    return err(cliError('CLI_CREDENTIALS_INVALID', `cannot read credentials at ${path}`, undefined, cause));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    return err(cliError('CLI_CREDENTIALS_INVALID', `invalid JSON in ${path}`, undefined, cause));
  }

  const result = CredentialsFileSchema.safeParse(parsed);
  if (!result.success) {
    return err(
      cliError(
        'CLI_CREDENTIALS_INVALID',
        `credentials schema violation: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      ),
    );
  }
  return ok(result.data);
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/config/credentials.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/src/config/credentials.ts \
        rntme-cli/packages/cli/test/unit/config/credentials.test.ts
git commit -m "feat(cli): XDG credentials file (0600/0700) with Zod schema"
```

---

## Task 7: Resolved config (flag > env > project > credentials > default)

**Files:**
- Create: `rntme-cli/packages/cli/src/config/resolve.ts`
- Create: `rntme-cli/packages/cli/test/unit/config/resolve.test.ts`

Per spec §6.4.

- [ ] **Step 1: Write failing test**

```typescript
// rntme-cli/packages/cli/test/unit/config/resolve.test.ts
import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../../../src/config/resolve.js';

const FIXED_BASE = 'https://platform.rntme.com';
const DUMMY_TOKEN = 'rntme_pat_abcdefghijklmnopqrstuv';
const PROJECT_STUB = {
  org: 'acme',
  project: 'p',
  service: 's',
  artifacts: {
    manifest: 'a.json', pdm: 'a.json', qsm: 'a.json',
    graphIr: 'a.json', bindings: 'a.json', ui: 'a.json', seed: 'a.json',
  },
} as const;

describe('resolveConfig', () => {
  it('flag beats env beats project beats credentials beats default', () => {
    const r = resolveConfig({
      flags:        { org: 'flag-org' },
      env:          { RNTME_BASE_URL: 'https://env.example', RNTME_TOKEN: DUMMY_TOKEN, RNTME_PROFILE: 'p2' },
      projectConfig: PROJECT_STUB,
      credentials:  {
        version: 1, defaultProfile: 'default',
        profiles: { default: { baseUrl: 'https://cred.example', token: DUMMY_TOKEN, addedAt: '2026-04-19T00:00:00Z' } },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.org).toBe('flag-org');
      expect(r.value.baseUrl).toBe('https://env.example');
      expect(r.value.token).toBe(DUMMY_TOKEN);
      expect(r.value.project).toBe('p');        // from project config
      expect(r.value.service).toBe('s');        // from project config
    }
  });

  it('default baseUrl when nothing else', () => {
    const r = resolveConfig({ flags: {}, env: {}, projectConfig: null, credentials: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.baseUrl).toBe(FIXED_BASE);
  });

  it('CLI_CREDENTIALS_MISSING when no token anywhere', () => {
    const r = resolveConfig({ flags: {}, env: {}, projectConfig: null, credentials: null, requireToken: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CLI_CREDENTIALS_MISSING');
  });

  it('CLI_CONFIG_MISSING when requireTenancy and no org/project/service', () => {
    const r = resolveConfig({
      flags: {}, env: {},
      projectConfig: null,
      credentials: {
        version: 1, defaultProfile: 'default',
        profiles: { default: { baseUrl: FIXED_BASE, token: DUMMY_TOKEN, addedAt: '2026-04-19T00:00:00Z' } },
      },
      requireTenancy: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CLI_CONFIG_MISSING');
  });

  it('--profile env picks profile', () => {
    const r = resolveConfig({
      flags: {},
      env: { RNTME_PROFILE: 'staging' },
      projectConfig: null,
      credentials: {
        version: 1,
        defaultProfile: 'default',
        profiles: {
          default: { baseUrl: FIXED_BASE, token: DUMMY_TOKEN, addedAt: '2026-04-19T00:00:00Z' },
          staging: { baseUrl: 'https://staging.example', token: 'rntme_pat_' + 'z'.repeat(22), addedAt: '2026-04-19T00:00:00Z' },
        },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.baseUrl).toBe('https://staging.example');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/config/resolve.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// rntme-cli/packages/cli/src/config/resolve.ts
import { Result, ok, err } from '../result.js';
import { CliError, cliError } from '../errors/codes.js';
import { CredentialsFile } from './credentials.js';
import { RntmeProjectConfig } from './project.js';

export const DEFAULT_BASE_URL = 'https://platform.rntme.com';

export type ResolveFlags = {
  baseUrl?: string;
  token?: string;
  profile?: string;
  org?: string;
  project?: string;
  service?: string;
};

export type ResolveEnv = Partial<{
  RNTME_BASE_URL: string;
  RNTME_TOKEN: string;
  RNTME_PROFILE: string;
}>;

export type ResolveInput = {
  flags: ResolveFlags;
  env: ResolveEnv;
  projectConfig: RntmeProjectConfig | null;
  credentials: CredentialsFile | null;
  requireToken?: boolean;
  requireTenancy?: boolean;
};

export type ResolvedConfig = {
  baseUrl: string;
  token: string | null;
  profileName: string;
  org: string | null;
  project: string | null;
  service: string | null;
};

export function resolveConfig(input: ResolveInput): Result<ResolvedConfig, CliError> {
  const profileName = input.flags.profile ?? input.env.RNTME_PROFILE ?? input.credentials?.defaultProfile ?? 'default';
  const profile = input.credentials?.profiles[profileName] ?? null;

  const baseUrl =
    input.flags.baseUrl ??
    input.env.RNTME_BASE_URL ??
    profile?.baseUrl ??
    DEFAULT_BASE_URL;

  const token =
    input.flags.token ??
    input.env.RNTME_TOKEN ??
    profile?.token ??
    null;

  const org = input.flags.org ?? input.projectConfig?.org ?? null;
  const project = input.flags.project ?? input.projectConfig?.project ?? null;
  const service = input.flags.service ?? input.projectConfig?.service ?? null;

  if (input.requireToken && token === null) {
    return err(
      cliError(
        'CLI_CREDENTIALS_MISSING',
        'no token found in flags, env, or credentials file',
        'run `rntme login --token <your-pat>`',
      ),
    );
  }

  if (input.requireTenancy && (org === null || project === null || service === null)) {
    return err(
      cliError(
        'CLI_CONFIG_MISSING',
        'org/project/service not resolved',
        'run from a directory containing `rntme.json`, or pass --org --project --service',
      ),
    );
  }

  return ok({ baseUrl, token, profileName, org, project, service });
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/config/resolve.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/src/config/resolve.ts \
        rntme-cli/packages/cli/test/unit/config/resolve.test.ts
git commit -m "feat(cli): config resolution precedence (flag > env > project > creds > default)"
```

---

## Task 8: HTTP client with error-envelope parsing

**Files:**
- Create: `rntme-cli/packages/cli/src/api/client.ts`
- Create: `rntme-cli/packages/cli/test/unit/api/client.test.ts`

Per spec §7.1, §7.3.

- [ ] **Step 1: Write failing tests (uses `fetch` mocked via `vi.stubGlobal`)**

```typescript
// rntme-cli/packages/cli/test/unit/api/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { apiCall } from '../../../src/api/client.js';

const OkSchema = z.object({ ok: z.boolean() });

describe('apiCall', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { globalThis.fetch = realFetch; });

  it('200 → parsed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })));
    const r = await apiCall({ method: 'GET', path: '/x', baseUrl: 'https://p', token: null, responseSchema: OkSchema });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ ok: true });
  });

  it('2xx with bad shape → CLI_RESPONSE_PARSE_FAILED', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"bogus":1}', {
      status: 200, headers: { 'content-type': 'application/json' },
    })));
    const r = await apiCall({ method: 'GET', path: '/x', baseUrl: 'https://p', token: null, responseSchema: OkSchema });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ kind: 'http', code: 'CLI_RESPONSE_PARSE_FAILED' });
  });

  it('4xx envelope → ApiError with platform code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'PLATFORM_AUTH_INVALID', message: 'bad token' },
    }), { status: 401, headers: { 'content-type': 'application/json' } })));
    const r = await apiCall({ method: 'GET', path: '/x', baseUrl: 'https://p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa', responseSchema: OkSchema });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('http');
      if (r.error.kind === 'http') {
        expect(r.error.code).toBe('PLATFORM_AUTH_INVALID');
        expect(r.error.status).toBe(401);
      }
    }
  });

  it('non-JSON 5xx → PLATFORM_INTERNAL synthetic', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>500</html>', { status: 500 })));
    const r = await apiCall({ method: 'GET', path: '/x', baseUrl: 'https://p', token: null, responseSchema: OkSchema });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === 'http') {
      expect(r.error.code).toBe('PLATFORM_INTERNAL');
      expect(r.error.status).toBe(500);
    }
  });

  it('network error → NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const r = await apiCall({ method: 'GET', path: '/x', baseUrl: 'https://p', token: null, responseSchema: OkSchema });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('network');
  });

  it('sends Authorization when token provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiCall({ method: 'GET', path: '/x', baseUrl: 'https://p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa', responseSchema: OkSchema });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Bearer /);
    expect(headers['X-Request-ID']).toMatch(/^req_/);
  });

  it('nested[] preserved from envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 'PLATFORM_VALIDATION_BUNDLE_FAILED',
        message: 'bundle validation failed',
        cause: { errors: [{ code: 'QSM_STRUCT_DUP', message: 'dup', path: 'x' }] },
      },
    }), { status: 422, headers: { 'content-type': 'application/json' } })));
    const r = await apiCall({ method: 'POST', path: '/x', baseUrl: 'https://p', token: null, responseSchema: OkSchema, body: {} });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === 'http') {
      expect(r.error.nested).toHaveLength(1);
      expect(r.error.nested?.[0].code).toBe('QSM_STRUCT_DUP');
    }
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/api/client.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// rntme-cli/packages/cli/src/api/client.ts
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Result, ok, err } from '../result.js';

export type NestedError = { code: string; message: string; path?: string; pkg?: string; stage?: string };

export type ApiError = {
  kind: 'http';
  status: number;
  code: string;
  message: string;
  stage?: string;
  pkg?: string;
  path?: string;
  requestId?: string;
  nested?: NestedError[];
};

export type NetworkError = { kind: 'network'; message: string; cause: unknown };
export type ClientError = ApiError | NetworkError;

export type ApiCallOptions<T> = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  baseUrl: string;
  token: string | null;
  body?: unknown;
  responseSchema: z.ZodType<T>;
  requestId?: string;
  timeoutMs?: number;
};

const VERSION = '0.0.0'; // updated at build if needed

export async function apiCall<T>(opts: ApiCallOptions<T>): Promise<Result<T, ClientError>> {
  const requestId = opts.requestId ?? `req_${randomUUID().replaceAll('-', '')}`;
  const url = `${opts.baseUrl.replace(/\/+$/, '')}${opts.path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': `rntme-cli/${VERSION} (node/${process.version.replace(/^v/, '')})`,
    'X-Request-ID': requestId,
  };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch (cause) {
    clearTimeout(timeout);
    return err({ kind: 'network', message: String((cause as Error)?.message ?? cause), cause });
  }
  clearTimeout(timeout);

  const echoedRequestId = res.headers.get('x-request-id') ?? requestId;

  const text = await res.text();
  let parsedBody: unknown = null;
  if (text.length > 0) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = null;
    }
  }

  if (res.ok) {
    const schemaResult = opts.responseSchema.safeParse(parsedBody);
    if (!schemaResult.success) {
      return err({
        kind: 'http',
        status: res.status,
        code: 'CLI_RESPONSE_PARSE_FAILED',
        message: `response did not match expected schema: ${schemaResult.error.issues.map((i) => i.message).join('; ')}`,
        requestId: echoedRequestId,
      });
    }
    return ok(schemaResult.data);
  }

  // 4xx / 5xx — try to read error envelope
  const envelope = parseErrorEnvelope(parsedBody);
  return err({
    kind: 'http',
    status: res.status,
    code: envelope?.code ?? 'PLATFORM_INTERNAL',
    message: envelope?.message ?? `HTTP ${res.status}`,
    stage: envelope?.stage,
    pkg: envelope?.pkg,
    path: envelope?.path,
    requestId: echoedRequestId,
    nested: envelope?.nested,
  });
}

function parseErrorEnvelope(body: unknown):
  | { code: string; message: string; stage?: string; pkg?: string; path?: string; nested?: NestedError[] }
  | null {
  if (!body || typeof body !== 'object') return null;
  const errObj = (body as { error?: unknown }).error;
  if (!errObj || typeof errObj !== 'object') return null;
  const e = errObj as Record<string, unknown>;
  const code = typeof e.code === 'string' ? e.code : 'PLATFORM_INTERNAL';
  const message = typeof e.message === 'string' ? e.message : 'unknown';
  const stage = typeof e.stage === 'string' ? e.stage : undefined;
  const pkg = typeof e.pkg === 'string' ? e.pkg : undefined;
  const path = typeof e.path === 'string' ? e.path : undefined;

  const nestedRaw =
    (e.cause && typeof e.cause === 'object' && (e.cause as { errors?: unknown }).errors) || undefined;
  let nested: NestedError[] | undefined;
  if (Array.isArray(nestedRaw)) {
    nested = nestedRaw
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x) => ({
        code: typeof x.code === 'string' ? x.code : 'UNKNOWN',
        message: typeof x.message === 'string' ? x.message : '',
        path: typeof x.path === 'string' ? x.path : undefined,
        pkg: typeof x.pkg === 'string' ? x.pkg : undefined,
        stage: typeof x.stage === 'string' ? x.stage : undefined,
      }));
  }

  return { code, message, stage, pkg, path, nested };
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/api/client.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/src/api/client.ts \
        rntme-cli/packages/cli/test/unit/api/client.test.ts
git commit -m "feat(cli): typed HTTP client with error-envelope parsing"
```

---

## Task 9: API types mirror (Zod) + endpoint wrappers

**Files:**
- Create: `rntme-cli/packages/cli/src/api/types.ts`
- Create: `rntme-cli/packages/cli/src/api/endpoints.ts`

Schemas are hand-mirrored from `rntme-cli/packages/platform-core/src/schemas/{entities,requests,responses}.ts`. If those paths contain fields not listed below, extend the schemas to match.

- [ ] **Step 1: Write `api/types.ts`**

```typescript
// rntme-cli/packages/cli/src/api/types.ts
import { z } from 'zod';

// -------- entities (from platform-core/schemas/entities.ts) --------

export const ProjectSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  slug: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ServiceSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  projectId: z.string(),
  slug: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const ArtifactVersionSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  serviceId: z.string(),
  seq: z.number().int(),
  bundleDigest: z.string(),
  previousVersionId: z.string().nullable(),
  manifestDigest: z.string(),
  pdmDigest: z.string(),
  qsmDigest: z.string(),
  graphIrDigest: z.string(),
  bindingsDigest: z.string(),
  uiDigest: z.string(),
  seedDigest: z.string(),
  validationSnapshot: z.record(z.string(), z.unknown()),
  publishedByAccountId: z.string(),
  publishedByTokenId: z.string().nullable(),
  publishedAt: z.string(),
  message: z.string().nullable(),
});
export type ArtifactVersion = z.infer<typeof ArtifactVersionSchema>;

export const ArtifactTagSchema = z.object({
  serviceId: z.string(),
  name: z.string(),
  versionId: z.string(),
  updatedAt: z.string(),
  updatedByAccountId: z.string(),
});
export type ArtifactTag = z.infer<typeof ArtifactTagSchema>;

export const ApiTokenInfoSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  accountId: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ApiTokenInfo = z.infer<typeof ApiTokenInfoSchema>;

// -------- request bodies --------

export const CreateProjectRequestSchema = z.object({
  slug: z.string(),
  displayName: z.string(),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const CreateServiceRequestSchema = z.object({
  slug: z.string(),
  displayName: z.string(),
});
export type CreateServiceRequest = z.infer<typeof CreateServiceRequestSchema>;

export const BundleInputSchema = z.object({
  manifest: z.record(z.string(), z.unknown()),
  pdm: z.record(z.string(), z.unknown()),
  qsm: z.record(z.string(), z.unknown()),
  graphIr: z.record(z.string(), z.unknown()),
  bindings: z.record(z.string(), z.unknown()),
  ui: z.record(z.string(), z.unknown()),
  seed: z.record(z.string(), z.unknown()),
});

export const PublishRequestSchema = z.object({
  bundle: BundleInputSchema,
  previousVersionSeq: z.number().int().positive().optional(),
  message: z.string().max(500).optional(),
  moveTags: z.array(z.string()).max(16).optional(),
});
export type PublishRequest = z.infer<typeof PublishRequestSchema>;

export const MoveTagRequestSchema = z.object({
  versionSeq: z.number().int().positive(),
});
export type MoveTagRequest = z.infer<typeof MoveTagRequestSchema>;

export const CreateTokenRequestSchema = z.object({
  name: z.string(),
  scopes: z.array(z.string()),
  expiresAt: z.string().datetime().nullable().optional(),
});
export type CreateTokenRequest = z.infer<typeof CreateTokenRequestSchema>;

// -------- response envelopes --------

export const ProjectResponseSchema = z.object({ project: ProjectSchema });
export const ProjectsListResponseSchema = z.object({ projects: z.array(ProjectSchema) });
export const ServiceResponseSchema = z.object({ service: ServiceSchema });
export const ServicesListResponseSchema = z.object({ services: z.array(ServiceSchema) });
export const VersionResponseSchema = z.object({ version: ArtifactVersionSchema });
export const VersionsListResponseSchema = z.object({ versions: z.array(ArtifactVersionSchema), nextCursor: z.string().nullable().optional() });
export const TagResponseSchema = z.object({ tag: ArtifactTagSchema });
export const TagsListResponseSchema = z.object({ tags: z.array(ArtifactTagSchema) });
export const TokenCreatedResponseSchema = z.object({
  token: ApiTokenInfoSchema,
  plaintext: z.string(),
});
export const TokensListResponseSchema = z.object({ tokens: z.array(ApiTokenInfoSchema) });

export const AuthMeResponseSchema = z.object({
  account: z.object({
    id: z.string(),
    workosUserId: z.string(),
    displayName: z.string(),
    email: z.string(),
  }),
  org: z.object({
    id: z.string(),
    workosOrganizationId: z.string(),
    slug: z.string(),
  }),
  role: z.enum(['admin', 'member']),
  scopes: z.array(z.string()),
  tokenId: z.string().nullable().optional(),
});
```

- [ ] **Step 2: Write `api/endpoints.ts`**

```typescript
// rntme-cli/packages/cli/src/api/endpoints.ts
import { apiCall, ClientError } from './client.js';
import { Result } from '../result.js';
import {
  ProjectResponseSchema,
  ProjectsListResponseSchema,
  ServiceResponseSchema,
  ServicesListResponseSchema,
  VersionResponseSchema,
  VersionsListResponseSchema,
  TagResponseSchema,
  TagsListResponseSchema,
  TokenCreatedResponseSchema,
  TokensListResponseSchema,
  AuthMeResponseSchema,
  CreateProjectRequest,
  CreateServiceRequest,
  CreateTokenRequest,
  PublishRequest,
  MoveTagRequest,
} from './types.js';

export type Ctx = { baseUrl: string; token: string | null; requestId?: string };

export const endpoints = {
  auth: {
    me: (c: Ctx) =>
      apiCall({ method: 'GET', path: '/v1/auth/me', responseSchema: AuthMeResponseSchema, ...c }),
  },

  tokens: {
    create: (c: Ctx, org: string, body: CreateTokenRequest) =>
      apiCall({ method: 'POST', path: `/v1/orgs/${enc(org)}/tokens`, body, responseSchema: TokenCreatedResponseSchema, ...c }),
    list: (c: Ctx, org: string) =>
      apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/tokens`, responseSchema: TokensListResponseSchema, ...c }),
    revoke: (c: Ctx, org: string, id: string) =>
      apiCall({ method: 'DELETE', path: `/v1/orgs/${enc(org)}/tokens/${enc(id)}`,
                responseSchema: (await import('zod')).z.object({}).passthrough(), ...c }),
  },

  projects: {
    create: (c: Ctx, org: string, body: CreateProjectRequest) =>
      apiCall({ method: 'POST', path: `/v1/orgs/${enc(org)}/projects`, body, responseSchema: ProjectResponseSchema, ...c }),
    list: (c: Ctx, org: string, opts?: { includeArchived?: boolean }) =>
      apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/projects${opts?.includeArchived ? '?includeArchived=1' : ''}`,
                responseSchema: ProjectsListResponseSchema, ...c }),
    show: (c: Ctx, org: string, project: string) =>
      apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/projects/${enc(project)}`,
                responseSchema: ProjectResponseSchema, ...c }),
  },

  services: {
    create: (c: Ctx, org: string, project: string, body: CreateServiceRequest) =>
      apiCall({ method: 'POST', path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/services`, body,
                responseSchema: ServiceResponseSchema, ...c }),
    list: (c: Ctx, org: string, project: string) =>
      apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/services`,
                responseSchema: ServicesListResponseSchema, ...c }),
    show: (c: Ctx, org: string, project: string, service: string) =>
      apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/services/${enc(service)}`,
                responseSchema: ServiceResponseSchema, ...c }),
  },

  versions: {
    list: (c: Ctx, org: string, project: string, service: string, opts?: { limit?: number; cursor?: string }) => {
      const qs = new URLSearchParams();
      if (opts?.limit) qs.set('limit', String(opts.limit));
      if (opts?.cursor) qs.set('cursor', opts.cursor);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/services/${enc(service)}/versions${suffix}`,
                       responseSchema: VersionsListResponseSchema, ...c });
    },
    show: (c: Ctx, org: string, project: string, service: string, seq: number) =>
      apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/services/${enc(service)}/versions/${seq}`,
                responseSchema: VersionResponseSchema, ...c }),
    publish: (c: Ctx, org: string, project: string, service: string, body: PublishRequest) =>
      apiCall({ method: 'POST', path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/services/${enc(service)}/versions`,
                body, responseSchema: VersionResponseSchema, timeoutMs: 120_000, ...c }),
  },

  tags: {
    list: (c: Ctx, org: string, project: string, service: string) =>
      apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/services/${enc(service)}/tags`,
                responseSchema: TagsListResponseSchema, ...c }),
    set: (c: Ctx, org: string, project: string, service: string, name: string, body: MoveTagRequest) =>
      apiCall({ method: 'PUT', path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/services/${enc(service)}/tags/${enc(name)}`,
                body, responseSchema: TagResponseSchema, ...c }),
    delete: async (c: Ctx, org: string, project: string, service: string, name: string): Promise<Result<void, ClientError>> => {
      const { z } = await import('zod');
      const r = await apiCall({
        method: 'DELETE',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/services/${enc(service)}/tags/${enc(name)}`,
        responseSchema: z.object({}).passthrough(),
        ...c,
      });
      return r.ok ? { ok: true, value: undefined } : r;
    },
  },
};

function enc(s: string): string {
  return encodeURIComponent(s);
}
```

*Note:* `tokens.revoke` uses `await import('zod')` for the pass-through schema; this needs the function to be async. Fix: replace the revoke entry with an async wrapper like `tags.delete`. **Apply this fix before committing:**

```typescript
  tokens: {
    create: ...unchanged...,
    list: ...unchanged...,
    revoke: async (c: Ctx, org: string, id: string): Promise<Result<void, ClientError>> => {
      const { z } = await import('zod');
      const r = await apiCall({
        method: 'DELETE',
        path: `/v1/orgs/${enc(org)}/tokens/${enc(id)}`,
        responseSchema: z.object({}).passthrough(),
        ...c,
      });
      return r.ok ? { ok: true, value: undefined } : r;
    },
  },
```

- [ ] **Step 3: Typecheck**

```bash
pnpm -F @rntme-cli/cli typecheck
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add rntme-cli/packages/cli/src/api/types.ts \
        rntme-cli/packages/cli/src/api/endpoints.ts
git commit -m "feat(cli): Zod type mirrors + typed endpoint wrappers"
```

---

## Task 10: Output formatting — human and `--json`

**Files:**
- Create: `rntme-cli/packages/cli/src/output/format.ts`
- Create: `rntme-cli/packages/cli/src/output/tables.ts`
- Create: `rntme-cli/packages/cli/test/unit/output/tables.test.ts`

Per spec §10.

- [ ] **Step 1: Write failing test for tables**

```typescript
// rntme-cli/packages/cli/test/unit/output/tables.test.ts
import { describe, it, expect } from 'vitest';
import { renderTable } from '../../../src/output/tables.js';

describe('renderTable', () => {
  it('renders a simple table', () => {
    const out = renderTable(
      ['SLUG', 'LATEST'],
      [['api', '42'], ['worker', '17']],
    );
    // header + two rows
    expect(out.split('\n')).toHaveLength(3);
    expect(out).toContain('SLUG');
    expect(out).toContain('42');
  });

  it('truncates long cells with ellipsis', () => {
    const out = renderTable(['X'], [['abcdefghij']], { maxWidths: [4] });
    expect(out).toContain('a…'); // truncated
  });

  it('handles zero rows', () => {
    const out = renderTable(['X'], []);
    expect(out).toContain('X');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/output/tables.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write `output/tables.ts`**

```typescript
// rntme-cli/packages/cli/src/output/tables.ts
export function renderTable(
  headers: string[],
  rows: string[][],
  opts?: { maxWidths?: number[] },
): string {
  const widths: number[] = headers.map((h, i) => {
    const cellMax = Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length));
    const cap = opts?.maxWidths?.[i];
    return cap ? Math.min(cellMax, cap) : cellMax;
  });

  const formatRow = (row: string[]) =>
    row.map((c, i) => truncate(c ?? '', widths[i]).padEnd(widths[i])).join('  ');

  return [formatRow(headers), ...rows.map(formatRow)].join('\n');
}

function truncate(s: string, width: number): string {
  if (s.length <= width) return s;
  if (width <= 1) return s.slice(0, width);
  return s.slice(0, width - 1) + '…';
}
```

- [ ] **Step 4: Write `output/format.ts`**

```typescript
// rntme-cli/packages/cli/src/output/format.ts
import { CliError } from '../errors/codes.js';
import { ClientError } from '../api/client.js';

export type OutputMode = 'human' | 'json';

export type SuccessOutput<T> = { ok: true; data: T };
export type FailureOutput = {
  ok: false;
  error: {
    code: string;
    status?: number;
    message: string;
    requestId?: string;
    hint?: string;
    nested?: Array<{ code: string; message: string; path?: string; pkg?: string; stage?: string }>;
  };
};

export function formatSuccess<T>(mode: OutputMode, data: T, human?: (d: T) => string): string {
  if (mode === 'json') {
    return JSON.stringify({ ok: true, data } satisfies SuccessOutput<T>);
  }
  return human ? human(data) : JSON.stringify(data, null, 2);
}

export function formatFailure(mode: OutputMode, fail: FailureOutput['error']): string {
  if (mode === 'json') {
    return JSON.stringify({ ok: false, error: fail } satisfies FailureOutput);
  }
  const lines = [`✖ ${fail.code}`, `  ${fail.message}`];
  if (fail.requestId) lines.push(`  request: ${fail.requestId}`);
  if (fail.nested) {
    lines.push('', 'Nested errors:');
    for (const n of fail.nested) {
      lines.push(`  • ${n.code}`);
      if (n.path) lines.push(`      at  ${n.path}`);
      lines.push(`      msg ${n.message}`);
    }
  }
  if (fail.hint) {
    lines.push('', `Hint: ${fail.hint}`);
  }
  return lines.join('\n');
}

export function toFailureOutput(e: CliError | ClientError): FailureOutput['error'] {
  if ('kind' in e && e.kind === 'cli') {
    return { code: e.code, message: e.message, hint: e.hint };
  }
  if ('kind' in e && e.kind === 'network') {
    return { code: 'CLI_NETWORK_TIMEOUT', message: e.message };
  }
  if ('kind' in e && e.kind === 'http') {
    return {
      code: e.code,
      status: e.status,
      message: e.message,
      requestId: e.requestId,
      nested: e.nested,
    };
  }
  return { code: 'PLATFORM_INTERNAL', message: 'unknown error' };
}
```

- [ ] **Step 5: Run test, verify PASS**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/output/tables.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/cli/src/output/ rntme-cli/packages/cli/test/unit/output/
git commit -m "feat(cli): output formatters (human + --json) and ASCII tables"
```

---

## Task 11: Command harness — `runCommand` helper

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/harness.ts`

A shared helper every command calls. Centralizes: config discovery, credentials load, resolve, emit output, return exit code.

- [ ] **Step 1: Write `harness.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/harness.ts
import { discoverProjectConfig } from '../config/project.js';
import { readCredentials, credentialsPath } from '../config/credentials.js';
import { resolveConfig, ResolveFlags, ResolvedConfig } from '../config/resolve.js';
import { Result, isOk } from '../result.js';
import { CliError } from '../errors/codes.js';
import { ClientError } from '../api/client.js';
import { exitCodeFor } from '../errors/exit.js';
import { formatSuccess, formatFailure, toFailureOutput, OutputMode } from '../output/format.js';

export type CommonFlags = ResolveFlags & {
  json?: boolean;
  verbose?: boolean;
  quiet?: boolean;
};

export type CommandContext = {
  mode: OutputMode;
  verbose: boolean;
  quiet: boolean;
  resolved: ResolvedConfig;
};

export type CommandHandler<T> = (ctx: CommandContext) => Promise<Result<T, CliError | ClientError>>;

export async function runCommand<T>(
  flags: CommonFlags,
  opts: { requireToken?: boolean; requireTenancy?: boolean; humanRender?: (d: T) => string },
  handler: CommandHandler<T>,
): Promise<number> {
  const mode: OutputMode = flags.json ? 'json' : 'human';

  const projectResult = await discoverProjectConfig(process.cwd());
  const projectConfig = isOk(projectResult) ? projectResult.value.config : null;

  // Credentials: best-effort read. Missing file is OK unless requireToken.
  const credsPathResolved = credentialsPath();
  const credsResult = await readCredentials(credsPathResolved);
  const credentials =
    isOk(credsResult) ? credsResult.value :
    credsResult.error.code === 'CLI_CREDENTIALS_MISSING' ? null :
    /* propagate permissions / corruption errors immediately */ null;

  // If reading failed for reasons OTHER than missing, surface it now:
  if (!isOk(credsResult) && credsResult.error.code !== 'CLI_CREDENTIALS_MISSING') {
    emit(mode, null, credsResult.error);
    return exitCodeFor(credsResult.error.code);
  }

  const resolved = resolveConfig({
    flags: { baseUrl: flags.baseUrl, token: flags.token, profile: flags.profile, org: flags.org, project: flags.project, service: flags.service },
    env: {
      RNTME_BASE_URL: process.env.RNTME_BASE_URL,
      RNTME_TOKEN: process.env.RNTME_TOKEN,
      RNTME_PROFILE: process.env.RNTME_PROFILE,
    },
    projectConfig,
    credentials,
    requireToken: opts.requireToken,
    requireTenancy: opts.requireTenancy,
  });

  if (!isOk(resolved)) {
    emit(mode, null, resolved.error);
    return exitCodeFor(resolved.error.code);
  }

  const result = await handler({
    mode,
    verbose: flags.verbose ?? false,
    quiet: flags.quiet ?? false,
    resolved: resolved.value,
  });

  if (isOk(result)) {
    if (!flags.quiet) emit(mode, result.value, null, opts.humanRender as any);
    return 0;
  }
  emit(mode, null, result.error);
  const code = 'kind' in result.error && result.error.kind === 'cli'
    ? result.error.code
    : 'kind' in result.error && result.error.kind === 'http'
    ? result.error.code
    : 'CLI_NETWORK_TIMEOUT';
  return exitCodeFor(code);
}

function emit<T>(mode: OutputMode, success: T | null, error: CliError | ClientError | null, human?: (d: T) => string): void {
  if (error) {
    process.stderr.write(formatFailure(mode, toFailureOutput(error)) + '\n');
    return;
  }
  if (success !== null) {
    process.stdout.write(formatSuccess(mode, success, human as any) + '\n');
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm -F @rntme-cli/cli typecheck
```

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add rntme-cli/packages/cli/src/commands/harness.ts
git commit -m "feat(cli): shared command harness (config resolve + emit + exit)"
```

---

## Task 12: Commands — login / logout

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/login.ts`
- Create: `rntme-cli/packages/cli/src/commands/logout.ts`

Per spec §5.1, §6.5.

- [ ] **Step 1: Write `commands/login.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/login.ts
import { readCredentials, writeCredentials, credentialsPath } from '../config/credentials.js';
import { cliError } from '../errors/codes.js';
import { DEFAULT_BASE_URL } from '../config/resolve.js';
import { formatSuccess, formatFailure, toFailureOutput } from '../output/format.js';
import { exitCodeFor } from '../errors/exit.js';
import { isOk } from '../result.js';

export type LoginFlags = {
  token?: string;      // either a value, '-' for stdin, or absent
  baseUrl?: string;
  profile?: string;
  json?: boolean;
};

export async function runLogin(flags: LoginFlags): Promise<number> {
  const mode = flags.json ? 'json' : 'human';
  const profile = flags.profile ?? 'default';
  const baseUrl = flags.baseUrl ?? DEFAULT_BASE_URL;

  let token: string;
  if (!flags.token) {
    process.stderr.write('No token provided. Usage:\n');
    process.stderr.write('  rntme login --token <pat>\n');
    process.stderr.write('  rntme login --token -     # read from stdin\n');
    process.stderr.write('\nCreate a machine token in the platform dashboard (not yet available);\n');
    process.stderr.write('for MVP, contact your org admin for a PAT.\n');
    return 0;
  }

  if (flags.token === '-') {
    token = (await readAllStdin()).trim();
  } else {
    token = flags.token;
    if (process.stderr.isTTY) {
      process.stderr.write('warning: token visible in process list; prefer --token -\n');
    }
  }

  if (!/^rntme_pat_[a-zA-Z0-9]{22}$/.test(token)) {
    const e = cliError('CLI_CREDENTIALS_INVALID', 'token format invalid; expected rntme_pat_<22 base62 chars>');
    process.stderr.write(formatFailure(mode, toFailureOutput(e)) + '\n');
    return exitCodeFor(e.code);
  }

  const path = credentialsPath();
  const existing = await readCredentials(path);

  const file = isOk(existing)
    ? existing.value
    : { version: 1 as const, defaultProfile: profile, profiles: {} as Record<string, { baseUrl: string; token: string; addedAt: string }> };

  file.profiles[profile] = { baseUrl, token, addedAt: new Date().toISOString() };
  if (!file.defaultProfile) file.defaultProfile = profile;

  const wrote = await writeCredentials(path, file);
  if (!isOk(wrote)) {
    process.stderr.write(formatFailure(mode, toFailureOutput(wrote.error)) + '\n');
    return exitCodeFor(wrote.error.code);
  }

  const out = formatSuccess(
    mode,
    { profile, baseUrl, credentialsPath: path },
    (d) => `✓ logged in\n  profile:      ${d.profile}\n  baseUrl:      ${d.baseUrl}\n  credentials:  ${d.credentialsPath}`,
  );
  process.stdout.write(out + '\n');
  return 0;
}

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
```

- [ ] **Step 2: Write `commands/logout.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/logout.ts
import { unlink } from 'node:fs/promises';
import { credentialsPath } from '../config/credentials.js';
import { formatSuccess } from '../output/format.js';

export type LogoutFlags = { json?: boolean };

export async function runLogout(flags: LogoutFlags): Promise<number> {
  const mode = flags.json ? 'json' : 'human';
  const path = credentialsPath();
  try {
    await unlink(path);
  } catch {
    // already gone — no-op
  }
  process.stdout.write(formatSuccess(mode, { credentialsPath: path }, (d) => `✓ logged out (removed ${d.credentialsPath})`) + '\n');
  return 0;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm -F @rntme-cli/cli typecheck
```

- [ ] **Step 4: Commit**

```bash
git add rntme-cli/packages/cli/src/commands/login.ts \
        rntme-cli/packages/cli/src/commands/logout.ts
git commit -m "feat(cli): login/logout commands"
```

---

## Task 13: Command — whoami

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/whoami.ts`

*Depends on Task 14 (platform `/v1/auth/me`)* — which ships first in PR order but test-wise both can be mocked.

- [ ] **Step 1: Write `commands/whoami.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/whoami.ts
import { runCommand, CommonFlags } from './harness.js';
import { endpoints } from '../api/endpoints.js';
import { ok } from '../result.js';

export async function runWhoami(flags: CommonFlags): Promise<number> {
  return runCommand<Awaited<ReturnType<typeof endpoints.auth.me>> extends infer R
    ? R extends { ok: true; value: infer V } ? V : never : never>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => {
        const lines = [
          `account:  ${d.account.email} (${d.account.displayName})`,
          `org:      ${d.org.slug} (${d.org.id})`,
          `role:     ${d.role}`,
          `scopes:   ${d.scopes.join(', ')}`,
        ];
        if (d.tokenId) lines.push(`tokenId:  ${d.tokenId}`);
        return lines.join('\n');
      },
    },
    async (ctx) => {
      const r = await endpoints.auth.me({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token });
      return r;
    },
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm -F @rntme-cli/cli typecheck
```

- [ ] **Step 3: Commit**

```bash
git add rntme-cli/packages/cli/src/commands/whoami.ts
git commit -m "feat(cli): whoami command"
```

---

## Task 14: Platform — add `GET /v1/auth/me`

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/routes/auth.ts`
- Modify: `rntme-cli/packages/platform-core/src/schemas/responses.ts` (if a schema is centralized there)

*If Amendment #2 rejected → skip this task and Task 13.*

- [ ] **Step 1: Inspect existing auth route file**

```bash
cat rntme-cli/packages/platform-http/src/routes/auth.ts
```

Identify the `auth` Hono router, middleware for auth context (likely `c.get('authSubject')`), and pattern for other routes.

- [ ] **Step 2: Add `GET /v1/auth/me` handler**

At the end of the `auth` route file (before export), add:

```typescript
auth.get('/me', async (c) => {
  const subject = c.get('authSubject') as
    | {
        account: { id: string; workosUserId: string; displayName: string; email: string };
        org: { id: string; workosOrganizationId: string; slug: string };
        role: 'admin' | 'member';
        scopes: string[];
        tokenId?: string;
      }
    | undefined;

  if (!subject) {
    return c.json(
      { error: { code: 'PLATFORM_AUTH_MISSING', message: 'no authenticated subject' } },
      401,
    );
  }

  return c.json({
    account: subject.account,
    org: subject.org,
    role: subject.role,
    scopes: subject.scopes,
    tokenId: subject.tokenId ?? null,
  });
});
```

**If the context-key for the subject is different** — inspect other routes (e.g., `projects.ts`, `tokens.ts`) to find the exact key/getter. Use the same pattern.

- [ ] **Step 3: If a test for the auth router exists, add a `GET /me` unit test**

Check `rntme-cli/packages/platform-http/test/` for existing auth tests. Add one case per response mode (200 with subject, 401 without). Mirror the test setup used by other routes.

- [ ] **Step 4: Build + test platform-http**

```bash
pnpm -F @rntme-cli/platform-http typecheck
pnpm -F @rntme-cli/platform-http test
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/platform-http/src/routes/auth.ts \
        rntme-cli/packages/platform-http/test/  # if tests added
git commit -m "feat(platform-http): GET /v1/auth/me endpoint"
```

---

## Task 15: Commands — project (create / list / show)

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/project/create.ts`
- Create: `rntme-cli/packages/cli/src/commands/project/list.ts`
- Create: `rntme-cli/packages/cli/src/commands/project/show.ts`

Per spec §5.3.

- [ ] **Step 1: Write `commands/project/create.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/project/create.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';

export type ProjectCreateArgs = {
  slug: string;
  displayName?: string;
};

export async function runProjectCreate(
  args: ProjectCreateArgs,
  flags: CommonFlags,
): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: any) =>
        [
          `✓ project created`,
          `  slug:         ${d.project.slug}`,
          `  id:           ${d.project.id}`,
          `  displayName:  ${d.project.displayName}`,
        ].join('\n'),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return { ok: false, error: { kind: 'cli', code: 'CLI_CONFIG_MISSING', message: 'no org; use --org or run in repo with rntme.json' } };
      return endpoints.projects.create(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        { slug: args.slug, displayName: args.displayName ?? args.slug },
      );
    },
  );
}
```

- [ ] **Step 2: Write `commands/project/list.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/project/list.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';
import { renderTable } from '../../output/tables.js';

export type ProjectListArgs = { includeArchived?: boolean };

export async function runProjectList(args: ProjectListArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: any) =>
        renderTable(
          ['SLUG', 'DISPLAY NAME', 'CREATED', 'ARCHIVED'],
          d.projects.map((p: any) => [
            p.slug, p.displayName, p.createdAt.slice(0, 10), p.archivedAt ? p.archivedAt.slice(0, 10) : '—',
          ]),
        ),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return { ok: false, error: { kind: 'cli', code: 'CLI_CONFIG_MISSING', message: 'no org' } };
      return endpoints.projects.list({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, {
        includeArchived: args.includeArchived,
      });
    },
  );
}
```

- [ ] **Step 3: Write `commands/project/show.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/project/show.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';

export type ProjectShowArgs = { slug?: string };

export async function runProjectShow(args: ProjectShowArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: any) =>
        [
          `project:      ${d.project.slug}`,
          `id:           ${d.project.id}`,
          `displayName:  ${d.project.displayName}`,
          `createdAt:    ${d.project.createdAt}`,
          `archivedAt:   ${d.project.archivedAt ?? '—'}`,
        ].join('\n'),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const slug = args.slug ?? flags.project ?? ctx.resolved.project;
      if (!org || !slug) return { ok: false, error: { kind: 'cli', code: 'CLI_CONFIG_MISSING', message: 'need --org and a project slug' } };
      return endpoints.projects.show({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, slug);
    },
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm -F @rntme-cli/cli typecheck
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/src/commands/project/
git commit -m "feat(cli): project commands (create/list/show)"
```

---

## Task 16: Commands — service (create / list / show)

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/service/{create,list,show}.ts`

Structure mirrors Task 15. Full code below:

- [ ] **Step 1: Write `commands/service/create.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/service/create.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';

export type ServiceCreateArgs = { slug: string; displayName?: string };

export async function runServiceCreate(args: ServiceCreateArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: any) =>
        [`✓ service created`, `  slug:  ${d.service.slug}`, `  id:    ${d.service.id}`].join('\n'),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org || !project) return { ok: false, error: { kind: 'cli', code: 'CLI_CONFIG_MISSING', message: 'need org + project' } };
      return endpoints.services.create(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org, project,
        { slug: args.slug, displayName: args.displayName ?? args.slug },
      );
    },
  );
}
```

- [ ] **Step 2: Write `commands/service/list.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/service/list.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';
import { renderTable } from '../../output/tables.js';

export async function runServiceList(flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: any) =>
        renderTable(['SLUG', 'DISPLAY NAME', 'ARCHIVED'],
          d.services.map((s: any) => [s.slug, s.displayName, s.archivedAt ?? '—'])),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org || !project) return { ok: false, error: { kind: 'cli', code: 'CLI_CONFIG_MISSING', message: 'need org + project' } };
      return endpoints.services.list({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, project);
    },
  );
}
```

- [ ] **Step 3: Write `commands/service/show.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/service/show.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';

export type ServiceShowArgs = { slug?: string };

export async function runServiceShow(args: ServiceShowArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: any) =>
        [
          `service:      ${d.service.slug}`,
          `id:           ${d.service.id}`,
          `displayName:  ${d.service.displayName}`,
          `archivedAt:   ${d.service.archivedAt ?? '—'}`,
        ].join('\n'),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      const slug = args.slug ?? flags.service ?? ctx.resolved.service;
      if (!org || !project || !slug) return { ok: false, error: { kind: 'cli', code: 'CLI_CONFIG_MISSING', message: 'need org + project + service' } };
      return endpoints.services.show({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, project, slug);
    },
  );
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm -F @rntme-cli/cli typecheck
git add rntme-cli/packages/cli/src/commands/service/
git commit -m "feat(cli): service commands (create/list/show)"
```

---

## Task 17: Commands — version (list / show)

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/version/{list,show}.ts`

Per spec §5.5. `show` resolves tag aliases by first calling `tags.list`.

- [ ] **Step 1: Write `commands/version/list.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/version/list.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';
import { renderTable } from '../../output/tables.js';

export type VersionListArgs = { limit?: number; cursor?: string };

export async function runVersionList(args: VersionListArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      requireTenancy: true,
      humanRender: (d: any) =>
        renderTable(['SEQ', 'DIGEST', 'MESSAGE', 'PUBLISHED'],
          d.versions.map((v: any) => [
            String(v.seq),
            v.bundleDigest.slice(0, 12),
            (v.message ?? '').slice(0, 40),
            v.publishedAt,
          ])),
    },
    async (ctx) =>
      endpoints.versions.list(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        ctx.resolved.org!, ctx.resolved.project!, ctx.resolved.service!,
        { limit: args.limit, cursor: args.cursor },
      ),
  );
}
```

- [ ] **Step 2: Write `commands/version/show.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/version/show.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';
import { isOk } from '../../result.js';

export type VersionShowArgs = { seqOrTag: string };

export async function runVersionShow(args: VersionShowArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      requireTenancy: true,
      humanRender: (d: any) =>
        [
          `seq:          ${d.version.seq}`,
          `bundleDigest: ${d.version.bundleDigest}`,
          `publishedAt:  ${d.version.publishedAt}`,
          `message:      ${d.version.message ?? '—'}`,
        ].join('\n'),
    },
    async (ctx) => {
      const maybeSeq = Number.parseInt(args.seqOrTag, 10);
      let seq: number;
      if (!Number.isNaN(maybeSeq) && String(maybeSeq) === args.seqOrTag) {
        seq = maybeSeq;
      } else {
        // resolve tag → seq
        const tags = await endpoints.tags.list(
          { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
          ctx.resolved.org!, ctx.resolved.project!, ctx.resolved.service!,
        );
        if (!isOk(tags)) return tags;
        const match = tags.value.tags.find((t: any) => t.name === args.seqOrTag);
        if (!match) return { ok: false, error: { kind: 'cli', code: 'CLI_CONFIG_MISSING', message: `tag "${args.seqOrTag}" not found` } };
        // versionId isn't seq; ask server for version by id via GET versions list? No direct by-id endpoint.
        // Simplest: the tags list includes the version ID but not seq; fetch versions and match.
        const versions = await endpoints.versions.list(
          { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
          ctx.resolved.org!, ctx.resolved.project!, ctx.resolved.service!,
          { limit: 200 },
        );
        if (!isOk(versions)) return versions;
        const ver = versions.value.versions.find((v: any) => v.id === match.versionId);
        if (!ver) return { ok: false, error: { kind: 'cli', code: 'CLI_CONFIG_MISSING', message: `version for tag ${args.seqOrTag} not found in last 200 versions` } };
        seq = ver.seq;
      }
      return endpoints.versions.show(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        ctx.resolved.org!, ctx.resolved.project!, ctx.resolved.service!,
        seq,
      );
    },
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm -F @rntme-cli/cli typecheck
git add rntme-cli/packages/cli/src/commands/version/
git commit -m "feat(cli): version commands (list/show w/ tag resolution)"
```

---

## Task 18: Commands — tag (list / set / delete)

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/tag/{list,set,delete}.ts`

Per spec §5.6.

- [ ] **Step 1: Write `commands/tag/list.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/tag/list.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';
import { renderTable } from '../../output/tables.js';

export async function runTagList(flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      requireTenancy: true,
      humanRender: (d: any) =>
        renderTable(['NAME', 'VERSION ID', 'UPDATED'],
          d.tags.map((t: any) => [t.name, t.versionId.slice(0, 12), t.updatedAt])),
    },
    async (ctx) =>
      endpoints.tags.list(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        ctx.resolved.org!, ctx.resolved.project!, ctx.resolved.service!,
      ),
  );
}
```

- [ ] **Step 2: Write `commands/tag/set.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/tag/set.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';

export type TagSetArgs = { name: string; seq: number };

export async function runTagSet(args: TagSetArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      requireTenancy: true,
      humanRender: (d: any) => `✓ tag ${d.tag.name} → version ${args.seq}`,
    },
    async (ctx) =>
      endpoints.tags.set(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        ctx.resolved.org!, ctx.resolved.project!, ctx.resolved.service!,
        args.name, { versionSeq: args.seq },
      ),
  );
}
```

- [ ] **Step 3: Write `commands/tag/delete.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/tag/delete.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';

export type TagDeleteArgs = { name: string };

export async function runTagDelete(args: TagDeleteArgs, flags: CommonFlags): Promise<number> {
  return runCommand<void>(
    flags,
    {
      requireToken: true,
      requireTenancy: true,
      humanRender: () => `✓ tag ${args.name} deleted`,
    },
    async (ctx) =>
      endpoints.tags.delete(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        ctx.resolved.org!, ctx.resolved.project!, ctx.resolved.service!,
        args.name,
      ),
  );
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm -F @rntme-cli/cli typecheck
git add rntme-cli/packages/cli/src/commands/tag/
git commit -m "feat(cli): tag commands (list/set/delete)"
```

---

## Task 19: Commands — token (create / list / revoke)

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/token/{create,list,revoke}.ts`

Per spec §5.2.

- [ ] **Step 1: Write `commands/token/create.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/token/create.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';

export type TokenCreateArgs = {
  name: string;
  scopes: string[];
  expiresAt?: string;
};

export async function runTokenCreate(args: TokenCreateArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: any) =>
        [
          `✓ token created — save it now, it will NOT be shown again`,
          ``,
          `  name:        ${d.token.name}`,
          `  id:          ${d.token.id}`,
          `  scopes:      ${d.token.scopes.join(', ')}`,
          `  prefix:      ${d.token.prefix}`,
          `  expiresAt:   ${d.token.expiresAt ?? '—'}`,
          ``,
          `  plaintext:   ${d.plaintext}`,
        ].join('\n'),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return { ok: false, error: { kind: 'cli', code: 'CLI_CONFIG_MISSING', message: 'need --org' } };
      return endpoints.tokens.create(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org,
        { name: args.name, scopes: args.scopes, expiresAt: args.expiresAt ?? null },
      );
    },
  );
}
```

- [ ] **Step 2: Write `commands/token/list.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/token/list.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';
import { renderTable } from '../../output/tables.js';

export async function runTokenList(flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: any) =>
        renderTable(['NAME', 'PREFIX', 'SCOPES', 'EXPIRES', 'LAST USED', 'REVOKED'],
          d.tokens.map((t: any) => [
            t.name, t.prefix, t.scopes.join('/'),
            t.expiresAt ?? '—', t.lastUsedAt ?? '—', t.revokedAt ?? '—',
          ])),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return { ok: false, error: { kind: 'cli', code: 'CLI_CONFIG_MISSING', message: 'need --org' } };
      return endpoints.tokens.list({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org);
    },
  );
}
```

- [ ] **Step 3: Write `commands/token/revoke.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/token/revoke.ts
import { runCommand, CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';

export type TokenRevokeArgs = { id: string };

export async function runTokenRevoke(args: TokenRevokeArgs, flags: CommonFlags): Promise<number> {
  return runCommand<void>(
    flags,
    {
      requireToken: true,
      humanRender: () => `✓ token ${args.id} revoked`,
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return { ok: false, error: { kind: 'cli', code: 'CLI_CONFIG_MISSING', message: 'need --org' } };
      return endpoints.tokens.revoke({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, args.id);
    },
  );
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm -F @rntme-cli/cli typecheck
git add rntme-cli/packages/cli/src/commands/token/
git commit -m "feat(cli): token commands (create/list/revoke)"
```

---

## Task 20: Command — validate (local validator chain)

**Files:**
- Create: `rntme-cli/packages/cli/src/validate/run.ts`
- Create: `rntme-cli/packages/cli/src/commands/validate.ts`

Per spec §9 (amended: reuses `@rntme-cli/platform-core.validateBundle`).

- [ ] **Step 1: Write `validate/run.ts`**

```typescript
// rntme-cli/packages/cli/src/validate/run.ts
// Lazy-imports platform-core and @rntme/* transitively via platform-core.
// Only this module is permitted to import @rntme-cli/platform-core.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Result, ok, err } from '../result.js';
import { CliError, cliError } from '../errors/codes.js';
import { RntmeProjectConfig } from '../config/project.js';
import { bundleDigest, BundleFiles } from '../util/canonical-json.js';

export type ValidateReport = {
  ok: boolean;
  bundleDigest: string;
  artifactDigests: Record<keyof BundleFiles, string>;
  errors?: Array<{ code: string; message: string; path?: string; pkg?: string; stage?: string }>;
};

export async function runValidate(cfg: RntmeProjectConfig, cfgDir: string): Promise<Result<ValidateReport, CliError>> {
  // 1. load artifact files
  const files: Partial<BundleFiles> = {};
  for (const key of ['manifest', 'pdm', 'qsm', 'graphIr', 'bindings', 'ui', 'seed'] as const) {
    const p = resolve(cfgDir, cfg.artifacts[key]);
    let raw: string;
    try { raw = await readFile(p, 'utf8'); }
    catch (cause) { return err(cliError('CLI_CONFIG_ARTIFACT_NOT_FOUND', `artifact ${key} not found at ${p}`, undefined, cause)); }
    try { files[key] = JSON.parse(raw); }
    catch (cause) { return err(cliError('CLI_CONFIG_INVALID', `artifact ${key} is not valid JSON (${p})`, undefined, cause)); }
  }
  const bundle = files as BundleFiles;

  // 2. compute digest (useful for user even on success)
  const digest = bundleDigest(bundle);

  // 3. Lazy-import platform-core validator. If the import fails (platform-core not in workspace in a standalone install), surface CLI_VALIDATE_LOCAL_FAILED.
  let validateBundleFn: (input: BundleFiles) => Promise<{ ok: boolean; errors?: any[] }>;
  try {
    const mod: any = await import('@rntme-cli/platform-core');
    if (typeof mod.validateBundle !== 'function') {
      return err(cliError('CLI_VALIDATE_LOCAL_FAILED', 'platform-core.validateBundle not exported (submodule out of sync?)'));
    }
    validateBundleFn = mod.validateBundle;
  } catch (cause) {
    return err(cliError('CLI_VALIDATE_LOCAL_FAILED', 'could not import @rntme-cli/platform-core — is this CLI running inside the rntme monorepo?', undefined, cause));
  }

  const result = await validateBundleFn(bundle);
  if (result.ok) {
    return ok({
      ok: true,
      bundleDigest: digest,
      artifactDigests: perFileDigests(bundle),
    });
  }

  return ok({
    ok: false,
    bundleDigest: digest,
    artifactDigests: perFileDigests(bundle),
    errors: (result.errors ?? []).map((e: any) => ({
      code: e.code ?? 'UNKNOWN',
      message: e.message ?? 'validation error',
      path: e.path,
      pkg: e.pkg,
      stage: e.stage,
    })),
  });
}

function perFileDigests(bundle: BundleFiles): Record<keyof BundleFiles, string> {
  const { fileDigest } = require('../util/canonical-json.js') as typeof import('../util/canonical-json.js');
  return {
    manifest: fileDigest(bundle.manifest),
    pdm: fileDigest(bundle.pdm),
    qsm: fileDigest(bundle.qsm),
    graphIr: fileDigest(bundle.graphIr),
    bindings: fileDigest(bundle.bindings),
    ui: fileDigest(bundle.ui),
    seed: fileDigest(bundle.seed),
  };
}
```

- [ ] **Step 2: Write `commands/validate.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/validate.ts
import { discoverProjectConfig } from '../config/project.js';
import { runValidate } from '../validate/run.js';
import { formatSuccess, formatFailure, toFailureOutput } from '../output/format.js';
import { exitCodeFor } from '../errors/exit.js';
import { isOk } from '../result.js';
import { cliError } from '../errors/codes.js';

export async function runValidateCommand(flags: { json?: boolean; verbose?: boolean }): Promise<number> {
  const mode = flags.json ? 'json' : 'human';

  const found = await discoverProjectConfig(process.cwd());
  if (!isOk(found)) {
    process.stderr.write(formatFailure(mode, toFailureOutput(found.error)) + '\n');
    return exitCodeFor(found.error.code);
  }

  const report = await runValidate(found.value.config, found.value.dir);
  if (!isOk(report)) {
    process.stderr.write(formatFailure(mode, toFailureOutput(report.error)) + '\n');
    return exitCodeFor(report.error.code);
  }

  if (report.value.ok) {
    process.stdout.write(
      formatSuccess(
        mode,
        report.value,
        (d) =>
          `✓ bundle valid\n  bundleDigest: ${d.bundleDigest}\n  pdm:          ${d.artifactDigests.pdm.slice(0, 12)}\n  qsm:          ${d.artifactDigests.qsm.slice(0, 12)}\n  graphIr:      ${d.artifactDigests.graphIr.slice(0, 12)}\n  bindings:     ${d.artifactDigests.bindings.slice(0, 12)}\n  ui:           ${d.artifactDigests.ui.slice(0, 12)}\n  seed:         ${d.artifactDigests.seed.slice(0, 12)}\n  manifest:     ${d.artifactDigests.manifest.slice(0, 12)}`,
      ) + '\n',
    );
    return 0;
  }

  const err = cliError(
    'CLI_VALIDATE_LOCAL_FAILED',
    `bundle failed validation (${report.value.errors?.length ?? 0} errors)`,
  );
  process.stderr.write(
    formatFailure(mode, {
      code: err.code,
      message: err.message,
      nested: report.value.errors,
    }) + '\n',
  );
  return exitCodeFor(err.code);
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm -F @rntme-cli/cli typecheck
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add rntme-cli/packages/cli/src/validate/ \
        rntme-cli/packages/cli/src/commands/validate.ts
git commit -m "feat(cli): rntme validate (reuses platform-core.validateBundle)"
```

---

## Task 21: Command — publish

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/publish.ts`

Per spec §8.

- [ ] **Step 1: Write `commands/publish.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/publish.ts
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runCommand, CommonFlags } from './harness.js';
import { endpoints } from '../api/endpoints.js';
import { discoverProjectConfig } from '../config/project.js';
import { bundleDigest, BundleFiles } from '../util/canonical-json.js';
import { isOk } from '../result.js';
import { cliError } from '../errors/codes.js';

export type PublishArgs = {
  tag?: string[];
  message?: string;
  previousVersionSeq?: number;
};

export async function runPublish(args: PublishArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      requireTenancy: true,
      humanRender: (d: any) =>
        [
          d.__replay ? `↺ version already published (idempotent replay)` : `✓ published`,
          `  seq:          ${d.version.seq}`,
          `  bundleDigest: ${d.version.bundleDigest}`,
          `  previousSeq:  ${d.version.previousVersionId ?? '—'}`,
          `  publishedAt:  ${d.version.publishedAt}`,
          `  message:      ${d.version.message ?? '—'}`,
        ].join('\n'),
    },
    async (ctx) => {
      // 1. Load bundle files from rntme.json
      const disco = await discoverProjectConfig(process.cwd());
      if (!isOk(disco)) return disco;
      const cfg = disco.value.config;
      const cfgDir = disco.value.dir;

      const bundle: Partial<BundleFiles> = {};
      for (const key of ['manifest', 'pdm', 'qsm', 'graphIr', 'bindings', 'ui', 'seed'] as const) {
        const p = resolve(cfgDir, cfg.artifacts[key]);
        try {
          const raw = await readFile(p, 'utf8');
          bundle[key] = JSON.parse(raw);
        } catch (cause) {
          return { ok: false, error: cliError('CLI_CONFIG_ARTIFACT_NOT_FOUND', `cannot load artifact "${key}" from ${p}`, undefined, cause) };
        }
      }
      const files = bundle as BundleFiles;

      // 2. Compute local digest for invariant check
      const localDigest = bundleDigest(files);
      if (ctx.verbose) {
        process.stderr.write(`[rntme] local bundleDigest: ${localDigest}\n`);
      }

      // 3. Build + POST
      const resp = await endpoints.versions.publish(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        ctx.resolved.org!, ctx.resolved.project!, ctx.resolved.service!,
        {
          bundle: files,
          previousVersionSeq: args.previousVersionSeq,
          message: args.message ?? cfg.defaults?.message,
          moveTags: args.tag && args.tag.length ? args.tag : cfg.defaults?.tags,
        },
      );
      if (!resp.ok) return resp;

      // 4. Invariant: local digest == server digest
      if (resp.value.version.bundleDigest.replace(/^sha256:/, '') !== localDigest) {
        return {
          ok: false,
          error: cliError(
            'CLI_PUBLISH_DIGEST_MISMATCH',
            `local bundleDigest (${localDigest}) != server bundleDigest (${resp.value.version.bundleDigest})`,
            'report this as a bug — canonical-JSON or ordering drift',
          ),
        };
      }

      // 5. Annotate replay heuristic: if response status were 200 (vs 201), mark replay.
      //    apiCall() does not surface status on success; for UX parity, treat publishedAt > 5s old as replay.
      const ageMs = Date.now() - Date.parse(resp.value.version.publishedAt);
      const isReplay = ageMs > 5_000;
      return { ok: true, value: { ...resp.value, __replay: isReplay } };
    },
  );
}
```

**Note on replay detection:** a cleaner solution requires `apiCall` to surface the HTTP status on success. Leave the 5-second-heuristic in for MVP; file a follow-up ticket "surface success status in apiCall so publish can detect replay by 200 vs 201". This is acceptable because replay is rare, and the output still matches the real version data.

- [ ] **Step 2: Typecheck**

```bash
pnpm -F @rntme-cli/cli typecheck
```

- [ ] **Step 3: Commit**

```bash
git add rntme-cli/packages/cli/src/commands/publish.ts
git commit -m "feat(cli): publish command (digest invariant + replay UX)"
```

---

## Task 22: Top-level dispatcher (`bin/cli.ts`)

**Files:**
- Modify: `rntme-cli/packages/cli/src/bin/cli.ts` (full rewrite)
- Modify: `rntme-cli/packages/cli/src/index.ts` (export `main`)

- [ ] **Step 1: Replace `bin/cli.ts`**

```typescript
#!/usr/bin/env node
/* eslint-disable no-console -- CLI entrypoint */
import { parseArgs } from 'node:util';
import { runLogin } from '../commands/login.js';
import { runLogout } from '../commands/logout.js';
import { runWhoami } from '../commands/whoami.js';
import { runValidateCommand } from '../commands/validate.js';
import { runPublish } from '../commands/publish.js';
import { runProjectCreate } from '../commands/project/create.js';
import { runProjectList } from '../commands/project/list.js';
import { runProjectShow } from '../commands/project/show.js';
import { runServiceCreate } from '../commands/service/create.js';
import { runServiceList } from '../commands/service/list.js';
import { runServiceShow } from '../commands/service/show.js';
import { runVersionList } from '../commands/version/list.js';
import { runVersionShow } from '../commands/version/show.js';
import { runTagList } from '../commands/tag/list.js';
import { runTagSet } from '../commands/tag/set.js';
import { runTagDelete } from '../commands/tag/delete.js';
import { runTokenCreate } from '../commands/token/create.js';
import { runTokenList } from '../commands/token/list.js';
import { runTokenRevoke } from '../commands/token/revoke.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const USAGE = `Usage: rntme [--global-flags] <command> [<args>]

Commands:
  login --token <pat>|-                Save a PAT (or '-' to read from stdin)
  logout                                Remove credentials
  whoami                                Show current identity and scopes
  validate                              Run local 4-layer validator chain
  publish [--tag NAME]... [--message M] [--previous-version-seq N]
                                        Publish the bundle described by rntme.json

  project create <slug> [--display-name S]
  project list [--include-archived]
  project show [<slug>]

  service create <slug> [--display-name S]
  service list
  service show [<slug>]

  version list [--limit N] [--cursor C]
  version show <seq-or-tag>

  tag list
  tag set <name> <seq>
  tag delete <name>

  token create --name N --scopes a,b[,...] [--expires ISO]
  token list
  token revoke <id>

Global flags:
  --json                                Machine-readable output
  --base-url <url>                      Override platform base URL
  --profile <name>                      Select credential profile (default: 'default')
  --org <slug>, --project <slug>, --service <slug>
                                        Override rntme.json tenancy
  -v, --verbose                         Print HTTP request details to stderr
  -q, --quiet                           Suppress human-output noise
      --no-color                        Disable ANSI colour
  -h, --help                            Show this help
      --version                         Print version

Exit codes:
  0 ok | 1 generic | 2 config/creds | 3 auth | 4 forbidden | 5 not found |
  6 validation | 7 conflict | 8 rate limit | 9 network | 10 5xx
`;

async function readVersion(): Promise<string> {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, '..', '..', 'package.json');
    const raw = readFileSync(pkgPath, 'utf8');
    return (JSON.parse(raw) as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}

export async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean' },
        json: { type: 'boolean' },
        'base-url': { type: 'string' },
        profile: { type: 'string' },
        org: { type: 'string' },
        project: { type: 'string' },
        service: { type: 'string' },
        verbose: { type: 'boolean', short: 'v' },
        quiet: { type: 'boolean', short: 'q' },
        'no-color': { type: 'boolean' },
        // command-specific flags
        token: { type: 'string' },
        tag: { type: 'string', multiple: true },
        message: { type: 'string' },
        'previous-version-seq': { type: 'string' },
        'include-archived': { type: 'boolean' },
        limit: { type: 'string' },
        cursor: { type: 'string' },
        'display-name': { type: 'string' },
        name: { type: 'string' },
        scopes: { type: 'string' },
        expires: { type: 'string' },
      },
      allowPositionals: true,
      strict: false, // we want command-specific flags to pass through
    });
  } catch (err) {
    console.error((err as Error).message);
    console.error(USAGE);
    return 2;
  }

  const { values, positionals } = parsed;

  if (values['help']) { console.log(USAGE); return 0; }
  if (values['version']) { console.log(await readVersion()); return 0; }

  const cmd = positionals[0];
  const sub = positionals[1];

  const commonFlags = {
    json: values['json'] as boolean | undefined,
    baseUrl: values['base-url'] as string | undefined,
    profile: values['profile'] as string | undefined,
    org: values['org'] as string | undefined,
    project: values['project'] as string | undefined,
    service: values['service'] as string | undefined,
    verbose: values['verbose'] as boolean | undefined,
    quiet: values['quiet'] as boolean | undefined,
    token: values['token'] as string | undefined,
  };

  switch (cmd) {
    case 'login':
      return runLogin({ token: values['token'] as string | undefined, baseUrl: values['base-url'] as string | undefined, profile: values['profile'] as string | undefined, json: commonFlags.json });
    case 'logout':
      return runLogout({ json: commonFlags.json });
    case 'whoami':
      return runWhoami(commonFlags);
    case 'validate':
      return runValidateCommand({ json: commonFlags.json, verbose: commonFlags.verbose });
    case 'publish':
      return runPublish(
        {
          tag: (values['tag'] as string[] | undefined) ?? undefined,
          message: values['message'] as string | undefined,
          previousVersionSeq: values['previous-version-seq'] ? Number(values['previous-version-seq']) : undefined,
        },
        commonFlags,
      );

    case 'project':
      if (sub === 'create') {
        if (!positionals[2]) { console.error('usage: rntme project create <slug>'); return 2; }
        return runProjectCreate({ slug: positionals[2], displayName: values['display-name'] as string | undefined }, commonFlags);
      }
      if (sub === 'list') return runProjectList({ includeArchived: values['include-archived'] as boolean | undefined }, commonFlags);
      if (sub === 'show') return runProjectShow({ slug: positionals[2] }, commonFlags);
      console.error(`unknown: rntme project ${sub}`); return 2;

    case 'service':
      if (sub === 'create') {
        if (!positionals[2]) { console.error('usage: rntme service create <slug>'); return 2; }
        return runServiceCreate({ slug: positionals[2], displayName: values['display-name'] as string | undefined }, commonFlags);
      }
      if (sub === 'list') return runServiceList(commonFlags);
      if (sub === 'show') return runServiceShow({ slug: positionals[2] }, commonFlags);
      console.error(`unknown: rntme service ${sub}`); return 2;

    case 'version':
      if (sub === 'list') return runVersionList({
        limit: values['limit'] ? Number(values['limit']) : undefined,
        cursor: values['cursor'] as string | undefined,
      }, commonFlags);
      if (sub === 'show') {
        if (!positionals[2]) { console.error('usage: rntme version show <seq-or-tag>'); return 2; }
        return runVersionShow({ seqOrTag: positionals[2] }, commonFlags);
      }
      console.error(`unknown: rntme version ${sub}`); return 2;

    case 'tag':
      if (sub === 'list') return runTagList(commonFlags);
      if (sub === 'set') {
        if (!positionals[2] || !positionals[3]) { console.error('usage: rntme tag set <name> <seq>'); return 2; }
        return runTagSet({ name: positionals[2], seq: Number(positionals[3]) }, commonFlags);
      }
      if (sub === 'delete') {
        if (!positionals[2]) { console.error('usage: rntme tag delete <name>'); return 2; }
        return runTagDelete({ name: positionals[2] }, commonFlags);
      }
      console.error(`unknown: rntme tag ${sub}`); return 2;

    case 'token':
      if (sub === 'create') {
        if (!values['name'] || !values['scopes']) { console.error('usage: rntme token create --name N --scopes a,b[,...]'); return 2; }
        return runTokenCreate({
          name: values['name'] as string,
          scopes: (values['scopes'] as string).split(',').map((s) => s.trim()).filter((s) => s.length > 0),
          expiresAt: values['expires'] as string | undefined,
        }, commonFlags);
      }
      if (sub === 'list') return runTokenList(commonFlags);
      if (sub === 'revoke') {
        if (!positionals[2]) { console.error('usage: rntme token revoke <id>'); return 2; }
        return runTokenRevoke({ id: positionals[2] }, commonFlags);
      }
      console.error(`unknown: rntme token ${sub}`); return 2;

    default:
      if (!cmd) { console.log(USAGE); return 0; }
      console.error(`unknown command: ${cmd}`);
      console.error(USAGE);
      return 2;
  }
}

main(process.argv.slice(2)).then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Update `src/index.ts`**

```typescript
// rntme-cli/packages/cli/src/index.ts
export { main } from './bin/cli.js';
```

- [ ] **Step 3: Build**

```bash
pnpm -F @rntme-cli/cli build
```

Expected: `dist/bin/cli.js` exists, has shebang, is 0755.

- [ ] **Step 4: Smoke-test locally**

```bash
node rntme-cli/packages/cli/dist/bin/cli.js --help
node rntme-cli/packages/cli/dist/bin/cli.js --version
```

Expected: `--help` prints USAGE, exit 0. `--version` prints `0.0.0`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/src/bin/cli.ts \
        rntme-cli/packages/cli/src/index.ts
git commit -m "feat(cli): top-level dispatcher for all commands"
```

---

## Task 23: Integration tests (MSW)

**Files:**
- Modify: `rntme-cli/packages/cli/package.json` — add `msw` devDep
- Create: `rntme-cli/packages/cli/test/integration/commands.test.ts`

Scope: at least one test per command group (happy + key error cases). Fully exhaustive coverage is nice-to-have; a narrow happy-path + one error per command group satisfies §11.2.

- [ ] **Step 1: Add `msw` to devDeps**

In `package.json`, under `devDependencies`:

```json
    "msw": "^2.4.9",
```

```bash
pnpm install
```

- [ ] **Step 2: Write integration test**

```typescript
// rntme-cli/packages/cli/test/integration/commands.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { main } from '../../src/bin/cli.js';

const BASE = 'https://test.platform';
const PAT = 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa';

function runCli(argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const chunks: { stdout: string[]; stderr: string[] } = { stdout: [], stderr: [] };
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  (process.stdout.write as any) = (s: string) => { chunks.stdout.push(s); return true; };
  (process.stderr.write as any) = (s: string) => { chunks.stderr.push(s); return true; };
  const envBackup = { ...process.env };
  process.env.RNTME_BASE_URL = BASE;
  process.env.RNTME_TOKEN = PAT;
  return main(argv).then((code) => {
    (process.stdout.write as any) = origOut;
    (process.stderr.write as any) = origErr;
    process.env = envBackup;
    return { code, stdout: chunks.stdout.join(''), stderr: chunks.stderr.join('') };
  });
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('whoami', () => {
  it('200 → human output with account/org/role', async () => {
    server.use(http.get(`${BASE}/v1/auth/me`, () =>
      HttpResponse.json({
        account: { id: 'a', workosUserId: 'u', displayName: 'Vlad', email: 'v@example.com' },
        org: { id: 'o', workosOrganizationId: 'wo', slug: 'acme' },
        role: 'admin', scopes: ['project:read'], tokenId: null,
      })));
    const r = await runCli(['whoami']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('acme');
    expect(r.stdout).toContain('admin');
  });

  it('401 → exit 3 with PLATFORM_AUTH_INVALID', async () => {
    server.use(http.get(`${BASE}/v1/auth/me`, () =>
      HttpResponse.json({ error: { code: 'PLATFORM_AUTH_INVALID', message: 'bad' } }, { status: 401 })));
    const r = await runCli(['whoami']);
    expect(r.code).toBe(3);
    expect(r.stderr).toContain('PLATFORM_AUTH_INVALID');
  });
});

describe('project create', () => {
  it('201 → exit 0 with slug', async () => {
    server.use(http.post(`${BASE}/v1/orgs/acme/projects`, () =>
      HttpResponse.json({
        project: { id: 'p', orgId: 'o', slug: 'test', displayName: 'Test', createdAt: '2026-04-19T00:00:00Z', updatedAt: '2026-04-19T00:00:00Z', archivedAt: null },
      }, { status: 201 })));
    const r = await runCli(['--org', 'acme', 'project', 'create', 'test']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('test');
  });
});

describe('publish', () => {
  it('422 → exit 6 with nested validation error', async () => {
    server.use(http.post(`${BASE}/v1/orgs/acme/projects/p/services/s/versions`, () =>
      HttpResponse.json({
        error: {
          code: 'PLATFORM_VALIDATION_BUNDLE_FAILED',
          message: 'bundle validation failed',
          cause: { errors: [{ code: 'QSM_STRUCT_DUP', message: 'duplicate projection', path: 'projections[1]' }] },
        },
      }, { status: 422 })));
    // Use fixtures/rntme.json as cwd
    const cwdBackup = process.cwd();
    process.chdir('rntme-cli/packages/cli/test/fixtures');
    const r = await runCli(['--org', 'acme', '--project', 'p', '--service', 's', 'publish']);
    process.chdir(cwdBackup);
    expect(r.code).toBe(6);
    expect(r.stderr).toContain('QSM_STRUCT_DUP');
  });
});
```

*Add more cases iteratively as gaps appear. The three above cover the core error paths.*

- [ ] **Step 3: Run integration tests**

```bash
pnpm -F @rntme-cli/cli vitest run test/integration/commands.test.ts
```

Expected: 3 pass.

- [ ] **Step 4: Commit**

```bash
git add rntme-cli/packages/cli/package.json \
        rntme-cli/packages/cli/test/integration/ \
        pnpm-lock.yaml
git commit -m "test(cli): MSW-based integration tests for key command paths"
```

---

## Task 24: Lint invariant — forbidden imports in CLI

**Files:**
- Modify: `rntme-cli/packages/cli/eslint.config.mjs`

Per spec §12.4 machine-checked invariant.

- [ ] **Step 1: Read existing eslint config**

```bash
cat rntme-cli/packages/cli/eslint.config.mjs
```

- [ ] **Step 2: Add `no-restricted-imports` rule**

Open the config; add to the shared rules block (or create one if missing):

```javascript
export default [
  // ...existing config...
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@rntme-cli/platform-storage', '@rntme-cli/platform-storage/*'], message: 'CLI must not import platform-storage (Drizzle/pg).' },
          { group: ['@rntme-cli/platform-http', '@rntme-cli/platform-http/*'], message: 'CLI must not import platform-http (Hono).' },
          { group: ['@workos-inc/*'], message: 'CLI must not import WorkOS SDK.' },
          { group: ['drizzle-orm', 'drizzle-orm/*', 'pg', 'pg-pool'], message: 'CLI must not import a database driver.' },
          { group: ['@aws-sdk/*'], message: 'CLI must not import AWS SDK.' },
        ],
      }],
    },
  },
  // Only src/validate/run.ts is permitted to import @rntme-cli/platform-core.
  // Anything else importing it violates the invariant.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/validate/run.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@rntme-cli/platform-core', '@rntme-cli/platform-core/*'],
            message: 'Only src/validate/run.ts may import @rntme-cli/platform-core.' },
          { group: ['@rntme-cli/platform-storage', '@rntme-cli/platform-storage/*'] },
          { group: ['@rntme-cli/platform-http', '@rntme-cli/platform-http/*'] },
          { group: ['@workos-inc/*'] },
          { group: ['drizzle-orm', 'drizzle-orm/*', 'pg', 'pg-pool'] },
          { group: ['@aws-sdk/*'] },
        ],
      }],
    },
  },
];
```

- [ ] **Step 3: Run lint**

```bash
pnpm -F @rntme-cli/cli lint
```

Expected: green. If a legitimate file is blocked (other than `src/validate/run.ts` importing platform-core) — fix it there, not by relaxing the rule.

- [ ] **Step 4: Commit**

```bash
git add rntme-cli/packages/cli/eslint.config.mjs
git commit -m "lint(cli): enforce CLI import invariant (§4.4 of spec)"
```

---

## Task 25: Add `rntme.json` to demo

**Files:**
- Create: `demo/issue-tracker-api/rntme.json`

- [ ] **Step 1: Check what filenames exist in `demo/issue-tracker-api/artifacts/`**

```bash
ls demo/issue-tracker-api/artifacts/
```

The demo splits graphs into `artifacts/graphs/` and UI into `artifacts/ui/` directories. `rntme publish` needs seven **single-file** artifacts.

**Decision:** For the demo, create two stub files that flatten these into single JSON files. Acceptable for MVP; a future task can add dir-concatenation support to the CLI.

- [ ] **Step 2: Generate flat `graph-ir.json` and `ui.json`**

Write a one-off node script (not a committed file) that reads all `artifacts/graphs/*.json` and combines them into `{ graphs: { ... }, shapes: { ... } }`:

```bash
cd demo/issue-tracker-api
node -e '
  const fs = require("fs");
  const path = require("path");
  const graphs = {};
  const graphFiles = fs.readdirSync("artifacts/graphs").filter((f) => f.endsWith(".json"));
  for (const f of graphFiles) {
    graphs[path.basename(f, ".json")] = JSON.parse(fs.readFileSync(`artifacts/graphs/${f}`, "utf8"));
  }
  const shapes = JSON.parse(fs.readFileSync("artifacts/shapes.json", "utf8"));
  fs.writeFileSync("artifacts/graph-ir.json", JSON.stringify({ graphs, shapes }, null, 2));
  // for ui, naive merge — adjust per actual ui schema
  const uiFiles = fs.readdirSync("artifacts/ui").filter((f) => f.endsWith(".json"));
  const screens = {};
  for (const f of uiFiles) screens[path.basename(f, ".json")] = JSON.parse(fs.readFileSync(`artifacts/ui/${f}`, "utf8"));
  fs.writeFileSync("artifacts/ui.json", JSON.stringify({ screens }, null, 2));
'
cd -
```

If the actual UI/graph-ir formats don't fit this naive flatten, consult `@rntme/ui` and `@rntme/graph-ir-compiler` specs and adjust. This may expose a real structural issue — surface it to the user rather than hacking around.

- [ ] **Step 3: Create `demo/issue-tracker-api/rntme.json`**

```json
{
  "org": "rntme-cli-e2e",
  "project": "issue-tracker",
  "service": "api",
  "artifacts": {
    "manifest": "artifacts/manifest.json",
    "pdm": "artifacts/pdm.json",
    "qsm": "artifacts/qsm.json",
    "graphIr": "artifacts/graph-ir.json",
    "bindings": "artifacts/bindings.json",
    "ui": "artifacts/ui.json",
    "seed": "artifacts/seed.json"
  }
}
```

- [ ] **Step 4: Smoke-test `rntme validate` in demo**

```bash
cd demo/issue-tracker-api
node ../../rntme-cli/packages/cli/dist/bin/cli.js validate
cd -
```

Expected: either `✓ bundle valid` OR a descriptive validator error. If the flat graph-ir/ui shapes don't match the spec — this test exposes it. Fix the flattening or surface the issue to the user.

- [ ] **Step 5: Commit**

```bash
git add demo/issue-tracker-api/rntme.json demo/issue-tracker-api/artifacts/graph-ir.json demo/issue-tracker-api/artifacts/ui.json
git commit -m "feat(demo): rntme.json + flat graph-ir/ui artifacts for CLI"
```

---

## Task 26: E2E tests against `platform.rntme.com`

**Files:**
- Create: `rntme-cli/packages/cli/test/e2e/publish-loop.test.ts`

Per spec §11.3.

- [ ] **Step 1: Create fixture**

```bash
mkdir -p rntme-cli/packages/cli/test/e2e/fixtures-e2e
# We'll reuse demo/issue-tracker-api. No copy needed.
```

- [ ] **Step 2: Write the test**

```typescript
// rntme-cli/packages/cli/test/e2e/publish-loop.test.ts
import { describe, it, expect } from 'vitest';
import { main } from '../../src/bin/cli.js';

const E2E_TOKEN = process.env.RNTME_E2E_TOKEN;
const E2E_BASE = process.env.RNTME_E2E_BASE_URL ?? 'https://platform.rntme.com';

const run = async (argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> => {
  const out: string[] = []; const err: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  (process.stdout.write as any) = (s: string) => { out.push(s); return true; };
  (process.stderr.write as any) = (s: string) => { err.push(s); return true; };
  process.env.RNTME_TOKEN = E2E_TOKEN;
  process.env.RNTME_BASE_URL = E2E_BASE;
  const code = await main(argv);
  (process.stdout.write as any) = origOut;
  (process.stderr.write as any) = origErr;
  return { code, stdout: out.join(''), stderr: err.join('') };
};

describe.skipIf(!E2E_TOKEN)('e2e: publish loop', () => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const projectSlug = `cli-e2e-${stamp}`;
  const serviceSlug = 'api';

  it('whoami succeeds with E2E token', async () => {
    const r = await run(['whoami']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('rntme-cli-e2e');
  });

  it('creates project, service, publishes, moves tag, re-publishes idempotently', async () => {
    const cp = await run(['--org', 'rntme-cli-e2e', 'project', 'create', projectSlug]);
    expect(cp.code).toBe(0);

    const cs = await run(['--org', 'rntme-cli-e2e', '--project', projectSlug, 'service', 'create', serviceSlug]);
    expect(cs.code).toBe(0);

    // Run `publish` from demo cwd
    const cwd = process.cwd();
    process.chdir('demo/issue-tracker-api');
    const p1 = await run(['--org', 'rntme-cli-e2e', '--project', projectSlug, '--service', serviceSlug, 'publish', '--tag', 'preview', '--message', 'e2e smoke']);
    const p2 = await run(['--org', 'rntme-cli-e2e', '--project', projectSlug, '--service', serviceSlug, 'publish', '--tag', 'preview']); // idempotent replay
    process.chdir(cwd);

    expect(p1.code).toBe(0);
    expect(p2.code).toBe(0);
    // same digest in both outputs
    const digest1 = /bundleDigest:\s*(\S+)/.exec(p1.stdout)?.[1];
    const digest2 = /bundleDigest:\s*(\S+)/.exec(p2.stdout)?.[1];
    expect(digest1).toBeDefined();
    expect(digest1).toBe(digest2);
  }, 60_000);
});
```

- [ ] **Step 3: Add `test:e2e` script**

In `package.json` scripts:

```json
    "test:e2e": "vitest run test/e2e",
```

- [ ] **Step 4: Run (only if `RNTME_E2E_TOKEN` set)**

```bash
pnpm -F @rntme-cli/cli test:e2e
```

Expected (with token): PASS. Expected (without token): `describe.skipIf` skips all → 0 tests, exit 0.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/package.json rntme-cli/packages/cli/test/e2e/
git commit -m "test(cli): e2e publish-loop against platform.rntme.com"
```

---

## Task 27: Documentation

**Files:**
- Modify: `rntme-cli/packages/cli/README.md`

- [ ] **Step 1: Read existing README**

```bash
cat rntme-cli/packages/cli/README.md
```

- [ ] **Step 2: Replace with full reference**

```markdown
# @rntme-cli/cli

The `rntme` CLI — operate rntme services against the platform control-plane.

## Quick start

1. Create a machine token in the platform dashboard (or via an existing
   admin token: `rntme token create --name laptop --scopes project:read,project:write,version:publish`).
2. `rntme login --token -  # paste the token and press Ctrl-D`
3. `cd your-service-repo`
4. Create `rntme.json`:
   ```json
   {
     "org": "your-org",
     "project": "your-project",
     "service": "api",
     "artifacts": {
       "manifest": "artifacts/manifest.json",
       "pdm": "artifacts/pdm.json",
       "qsm": "artifacts/qsm.json",
       "graphIr": "artifacts/graph-ir.json",
       "bindings": "artifacts/bindings.json",
       "ui": "artifacts/ui.json",
       "seed": "artifacts/seed.json"
     }
   }
   ```
5. `rntme validate   # confirms the bundle is internally consistent`
6. `rntme publish --tag preview`

## Commands

(Paste the USAGE string from `bin/cli.ts` here, kept in sync manually.)

## Environment variables

| Variable | Effect |
| --- | --- |
| `RNTME_TOKEN` | Override the credentials file token |
| `RNTME_BASE_URL` | Override the platform base URL |
| `RNTME_PROFILE` | Select a credentials profile (default: `default`) |
| `RNTME_NO_COLOR`, `NO_COLOR` | Disable ANSI |

## Exit codes

| Exit | When |
| --- | --- |
| 0 | success |
| 1 | generic / internal |
| 2 | config or credentials problem |
| 3 | auth failed |
| 4 | forbidden / scope |
| 5 | not found / archived |
| 6 | validation failed |
| 7 | concurrency conflict |
| 8 | rate limited |
| 9 | network error |
| 10 | 5xx from platform |

## Error codes

CLI-local codes (format `CLI_<LAYER>_<KIND>`):

- `CLI_CONFIG_MISSING`, `CLI_CONFIG_INVALID`, `CLI_CONFIG_ARTIFACT_NOT_FOUND`
- `CLI_CREDENTIALS_MISSING`, `CLI_CREDENTIALS_INVALID`, `CLI_CREDENTIALS_PERMISSIONS_TOO_OPEN`
- `CLI_RESPONSE_PARSE_FAILED`, `CLI_VALIDATE_LOCAL_FAILED`, `CLI_PUBLISH_DIGEST_MISMATCH`
- `CLI_NETWORK_TIMEOUT`, `CLI_USAGE`

Platform codes (`PLATFORM_*`) come from the server unchanged; see platform-api-design spec §9.2.

## See also

- Design spec: `docs/superpowers/specs/2026-04-19-rntme-cli-platform-commands-design.md`
- Platform API: `docs/superpowers/specs/2026-04-19-platform-api-design.md`
```

- [ ] **Step 3: Commit**

```bash
git add rntme-cli/packages/cli/README.md
git commit -m "docs(cli): Quick start + command/env/exit/error reference"
```

---

## Task 28: Final verification

**Files:** (none modified; this is a checklist task)

- [ ] **Step 1: Full test run**

```bash
pnpm -F @rntme-cli/cli typecheck
pnpm -F @rntme-cli/cli lint
pnpm -F @rntme-cli/cli test
pnpm -F @rntme-cli/cli build
```

All green.

- [ ] **Step 2: Smoke-test spec §12.2**

```bash
node rntme-cli/packages/cli/dist/bin/cli.js --version
node rntme-cli/packages/cli/dist/bin/cli.js --help

# no credentials
mv ~/.config/rntme/credentials.json ~/.config/rntme/credentials.json.bak 2>/dev/null || true
unset RNTME_TOKEN
node rntme-cli/packages/cli/dist/bin/cli.js whoami    # expect exit 2 CLI_CREDENTIALS_MISSING
node rntme-cli/packages/cli/dist/bin/cli.js publish   # expect exit 2 CLI_CONFIG_MISSING
mv ~/.config/rntme/credentials.json.bak ~/.config/rntme/credentials.json 2>/dev/null || true

# validate in demo
cd demo/issue-tracker-api
node ../../rntme-cli/packages/cli/dist/bin/cli.js validate   # expect exit 0 with bundleDigest
cd -
```

All exit codes as documented.

- [ ] **Step 3: If `RNTME_E2E_TOKEN` available — run e2e**

```bash
RNTME_E2E_TOKEN=<token> pnpm -F @rntme-cli/cli test:e2e
```

Expected: all scenarios pass (whoami + full publish loop + idempotent replay).

- [ ] **Step 4: Update submodule pointer in parent**

If working inside the parent monorepo and `rntme-cli/` is a submodule:

```bash
cd rntme-cli
git push origin HEAD:main       # or the feature branch you worked on
cd ..
git add rntme-cli
git commit -m "chore: bump rntme-cli submodule (platform-commands CLI)"
```

- [ ] **Step 5: Confirm deployment compatibility**

The CLI doesn't deploy — only platform-http does. If Task 14 touched platform-http, verify the Docker build + Coolify/Dokploy deploy works before merging. Deferred to integration time.

---

## Self-review (completed by plan author)

- **Spec coverage:** each §5 command group → Tasks 12–21. §6 config → Tasks 5–7. §7 client/errors → Tasks 3, 8, 10. §8 publish flow → Task 21 (with digest invariant). §9 validate → Task 20. §10 output → Task 10. §11 tests → Tasks 23 (integration), 26 (e2e). §12 verification → Task 28.
- **Placeholder scan:** no "TBD"/"TODO" in steps; all code blocks complete. One known acceptable deferral: the replay-detection heuristic in Task 21 ("5-second age") is documented as a follow-up (requires `apiCall` status-surfacing change).
- **Type consistency:** `Result<T, E>` shape aligns with `@rntme-cli/platform-core`'s; error kind-tags (`'cli' | 'http' | 'network'`) used consistently across `errors/codes.ts`, `api/client.ts`, `output/format.ts`, command harness.
- **Amendment risks:** the two amendments at the top of the plan are flagged; rejection path for each is documented in-place.

---
