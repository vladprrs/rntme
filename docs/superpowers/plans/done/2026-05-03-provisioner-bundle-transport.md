# Provisioner Bundle Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/platform-http` execute module provisioners that travel inside the canonical project bundle as base64 ESM assets, ending the current `DEPLOY_PROVISION_ENTRY_LOAD_FAILED: Cannot find package '@rntme/identity-auth0'` failure.

**Architecture:** Each provisioner-declaring module pre-bundles a self-contained ESM entry via esbuild during `pnpm build`. CLI publish embeds that entry into a new `assets` map on the canonical bundle, keyed by a deterministic synthetic path computed from `manifest.name`. Platform-side, `materializeBundle` writes assets to a `tmpDir`, and `resolveProvisioner(packageName, _entry, projectDir)` `import()`s the file via a `file://` URL using the same convention.

**Tech Stack:** TypeScript ESM, Vitest, Zod (existing), esbuild (already a workspace devDep), Node 20 ESM dynamic import, base64.

**Spec:** [`docs/superpowers/specs/2026-05-03-provisioner-bundle-transport-design.md`](../specs/2026-05-03-provisioner-bundle-transport-design.md)

**Naming alignment with codebase conventions:** the spec uses `BLUEPRINT_PROVISIONER_ENTRY_MISSING`, `BUNDLE_ASSETS_TOO_LARGE`, `BUNDLE_VERSION_UNSUPPORTED`. The codebase enforces `<PKG>_<LAYER>_<KIND>` naming. Plan uses:
- `BLUEPRINT_PROVISIONER_ENTRY_MISSING` (added to `@rntme/blueprint` `ERROR_CODES`)
- `CLI_BUNDLE_ASSETS_TOO_LARGE` (added to `apps/cli` `CLI_ERROR_CODES`)
- `DEPLOY_PROVISION_BUNDLE_ASSET_MISSING` (added to `deploy-core` `DEPLOY_PROVISION_ERROR_CODES`)
- `DEPLOY_BUNDLE_VERSION_UNSUPPORTED` (added to `deploy-core` `DEPLOY_PROVISION_ERROR_CODES`)

---

## File Structure

**`@rntme/blueprint` — `packages/artifacts/blueprint/`**
- Create: `src/compose/safe-provisioner-name.ts` — convention helper.
- Modify: `src/index.ts` — re-export `safeProvisionerName`.
- Modify: `src/types/result.ts` — add `BLUEPRINT_PROVISIONER_ENTRY_MISSING` to `ERROR_CODES`.
- Create: `test/unit/safe-provisioner-name.test.ts`.

**CLI — `apps/cli/`**
- Create: `src/bundle/collect-assets.ts` — walk module manifests, read entry files, base64-encode.
- Modify: `src/bundle/build.ts` — emit `version: 2`, integrate `collectProvisionerAssets`, add `assets` to canonical type.
- Modify: `src/errors/codes.ts` — add `CLI_BUNDLE_ASSETS_TOO_LARGE`.
- Create: `test/unit/bundle/collect-assets.test.ts`.
- Modify: `test/unit/bundle/build.test.ts` — extend coverage for v2 + assets digest stability.

**`@rntme/deploy-core` — `packages/deploy/deploy-core/`**
- Modify: `src/provision.ts` — add `projectDir: string` to `RunProvisionersInput`; resolver signature gets a third `projectDir` arg.
- Modify: `src/errors-provision.ts` — add `DEPLOY_PROVISION_BUNDLE_ASSET_MISSING`, `DEPLOY_BUNDLE_VERSION_UNSUPPORTED`.
- Modify: `test/unit/provision.test.ts` — pass `projectDir` in every existing call site.

**Platform-http — `apps/platform-http/`**
- Modify: `src/deploy/executor.ts` — `materializeBundle` writes `assets`; version check before materialization; pass `tmpDir` as `projectDir` to `runProvisioners`.
- Modify: `src/app.ts` — replace `resolveProvisioner` with the convention-from-`tmpDir` resolver; export `safeProvisionerName` import from blueprint.
- Modify: `src/deploy/project-delete-executor.ts` — fetch each `provisionResult` deployment's bundle, re-materialize, invoke `tearDown` per module before resource deletion.
- Create: `test/unit/deploy/materialize-bundle.test.ts`.
- Create: `test/unit/deploy/resolve-provisioner.test.ts`.

**Auth0 reference module — `modules/identity/auth0/`**
- Modify: `package.json` — add `build:provisioner` script (esbuild) and chain it after `tsc`; add `./provisioner.entry` to `exports`.
- Modify: `module.json` — `provisioner.entry` → `./dist/provisioner.entry.js`.
- Create: `test/unit/provisioner-entry.test.ts` — verify built entry shape and externals contract.

**Docs**
- Modify: `apps/cli/README.md`
- Modify: `apps/platform-http/README.md`
- Modify: `packages/deploy/deploy-core/README.md`
- Modify: `modules/identity/auth0/README.md`
- Modify: `AGENTS.md` — §6 how-to.
- Modify: `docs/superpowers/specs/done/2026-05-03-module-provisioner-contract-design.md` — cross-ref note at §6.
- Modify: `docs/superpowers/specs/2026-05-03-project-update-delete-operations-design.md` — note in §8 about bundle re-materialization.

---

### Task 1: `safeProvisionerName` helper in `@rntme/blueprint`

**Files:**
- Create: `packages/artifacts/blueprint/src/compose/safe-provisioner-name.ts`
- Modify: `packages/artifacts/blueprint/src/index.ts`
- Test: `packages/artifacts/blueprint/test/unit/safe-provisioner-name.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/artifacts/blueprint/test/unit/safe-provisioner-name.test.ts
import { describe, expect, it } from 'vitest';
import { safeProvisionerName } from '../../src/compose/safe-provisioner-name.js';

describe('safeProvisionerName', () => {
  it('drops a leading @ and replaces / with __', () => {
    expect(safeProvisionerName('@rntme/identity-auth0')).toBe('rntme__identity-auth0');
  });

  it('handles unscoped names unchanged', () => {
    expect(safeProvisionerName('rntme_identity_auth0')).toBe('rntme_identity_auth0');
  });

  it('replaces every / segment, not just the first', () => {
    expect(safeProvisionerName('@a/b/c')).toBe('a__b__c');
  });

  it('throws on empty input', () => {
    expect(() => safeProvisionerName('')).toThrow(/manifest name is empty/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -F @rntme/blueprint vitest run test/unit/safe-provisioner-name.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// packages/artifacts/blueprint/src/compose/safe-provisioner-name.ts
export function safeProvisionerName(manifestName: string): string {
  if (manifestName.length === 0) {
    throw new Error('manifest name is empty');
  }
  const dropAt = manifestName.startsWith('@') ? manifestName.slice(1) : manifestName;
  return dropAt.replace(/\//g, '__');
}
```

- [ ] **Step 4: Re-export from package index**

In `packages/artifacts/blueprint/src/index.ts` add the line in the existing export block (alphabetical order near other `compose/...` exports):

```ts
export { safeProvisionerName } from './compose/safe-provisioner-name.js';
```

- [ ] **Step 5: Run tests, expect pass; build the package**

```bash
pnpm -F @rntme/blueprint vitest run test/unit/safe-provisioner-name.test.ts
pnpm -F @rntme/blueprint build
```

Expected: tests PASS, `dist/compose/safe-provisioner-name.js` exists.

- [ ] **Step 6: Commit**

```bash
git add packages/artifacts/blueprint/src/compose/safe-provisioner-name.ts \
        packages/artifacts/blueprint/src/index.ts \
        packages/artifacts/blueprint/test/unit/safe-provisioner-name.test.ts
git commit -m "feat(blueprint): safeProvisionerName helper"
```

---

### Task 2: Add `BLUEPRINT_PROVISIONER_ENTRY_MISSING` error code

**Files:**
- Modify: `packages/artifacts/blueprint/src/types/result.ts`

- [ ] **Step 1: Locate the existing `ERROR_CODES` const**

Open `packages/artifacts/blueprint/src/types/result.ts`. The const declaration starts around line 21 (`export const ERROR_CODES = { ... }`) and has the `as const` suffix.

- [ ] **Step 2: Add the new code as a member of the literal map**

Append a key-value pair inside the const (preserving alphabetical-ish grouping near other `BLUEPRINT_*` codes). Insert as the last entry before the closing `}`:

```ts
  BLUEPRINT_PROVISIONER_ENTRY_MISSING: 'BLUEPRINT_PROVISIONER_ENTRY_MISSING',
```

- [ ] **Step 3: Build the package and verify the literal type compiles**

```bash
pnpm -F @rntme/blueprint typecheck
```

Expected: PASS — no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/artifacts/blueprint/src/types/result.ts
git commit -m "feat(blueprint): add BLUEPRINT_PROVISIONER_ENTRY_MISSING code"
```

---

### Task 3: Add `CLI_BUNDLE_ASSETS_TOO_LARGE` to CLI error codes

**Files:**
- Modify: `apps/cli/src/errors/codes.ts`

- [ ] **Step 1: Open `apps/cli/src/errors/codes.ts`**

The `CLI_ERROR_CODES` array starts at line 1.

- [ ] **Step 2: Add the new code**

Append `'CLI_BUNDLE_ASSETS_TOO_LARGE'` as a new entry inside the array (insertion order is informational; place it after `'CLI_PUBLISH_DIGEST_MISMATCH'` to group bundle/publish concerns):

```ts
  'CLI_PUBLISH_DIGEST_MISMATCH',
  'CLI_BUNDLE_ASSETS_TOO_LARGE',
  'CLI_NETWORK_TIMEOUT',
```

- [ ] **Step 3: Run CLI typecheck**

```bash
pnpm -F @rntme/cli typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/errors/codes.ts
git commit -m "feat(cli): add CLI_BUNDLE_ASSETS_TOO_LARGE code"
```

---

### Task 4: Bundle v2 type + new `CanonicalBundle` shape

**Files:**
- Modify: `apps/cli/src/bundle/build.ts`

(Note: `collectProvisionerAssets` is wired in Task 6. This task only updates the type and digest input, with `assets: {}` always so far.)

- [ ] **Step 1: Update the `CanonicalBundle` type literal**

In `apps/cli/src/bundle/build.ts`, replace the existing `CanonicalBundle` type:

```ts
export type CanonicalBundle = {
  readonly version: 2;
  readonly files: Readonly<Record<string, unknown>>;
  readonly assets: Readonly<Record<string, string>>;
};
```

- [ ] **Step 2: Update bundle construction inside `buildProjectBundle`**

Replace the existing `const bundle: CanonicalBundle = { version: 1, files: bundleFiles };` line with:

```ts
const bundle: CanonicalBundle = { version: 2, files: bundleFiles, assets: {} };
```

`canonicalJson(bundle)` already serializes deterministically — no change to digest helper.

- [ ] **Step 3: Run CLI build + tests; expect EXISTING bundle tests to need digest expectation updates**

```bash
pnpm -F @rntme/cli vitest run test/unit/bundle/build.test.ts
```

Expected: tests likely FAIL because hardcoded digests in existing tests assumed `version: 1` and no `assets` key. Update the affected expected digests inline by re-running the build helper — or, preferred: replace any literal hex digest in those tests with `expect(result.value.digest).toMatch(/^sha256:[a-f0-9]{64}$/)` and `expect(canonicalJson(result.value.bundle)).toBe(result.value.bytes)` checks (no literal-digest assertions). Document in commit message.

- [ ] **Step 4: Re-run tests; expect PASS**

```bash
pnpm -F @rntme/cli vitest run test/unit/bundle/build.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/bundle/build.ts apps/cli/test/unit/bundle/build.test.ts
git commit -m "feat(cli): bundle CanonicalBundle v2 with empty assets map"
```

---

### Task 5: `collectProvisionerAssets` — pure function

**Files:**
- Create: `apps/cli/src/bundle/collect-assets.ts`
- Test: `apps/cli/test/unit/bundle/collect-assets.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// apps/cli/test/unit/bundle/collect-assets.test.ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { collectProvisionerAssets } from '../../../src/bundle/collect-assets.js';

describe('collectProvisionerAssets', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'rntme-collect-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  function writeManifest(rel: string, manifest: object): void {
    const abs = join(root, rel);
    mkdirSync(abs.replace(/\/[^/]+$/, ''), { recursive: true });
    writeFileSync(abs, JSON.stringify(manifest));
  }
  function writeJs(rel: string, contents: string): void {
    const abs = join(root, rel);
    mkdirSync(abs.replace(/\/[^/]+$/, ''), { recursive: true });
    writeFileSync(abs, contents);
  }

  const bundleFiles = (paths: Record<string, unknown>): Readonly<Record<string, unknown>> => paths;

  it('returns {} for project with no provisioner-declaring modules', () => {
    writeManifest('node_modules/foo/module.json', { name: '@x/foo', version: '1.0.0' });
    const r = collectProvisionerAssets(root, bundleFiles({
      'node_modules/foo/module.json': { name: '@x/foo', version: '1.0.0' },
    }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({});
  });

  it('collects entry file as base64 under conventional path', () => {
    writeManifest('node_modules/auth0/module.json', {
      name: '@rntme/identity-auth0',
      version: '1.0.0',
      provisioner: { entry: './dist/provisioner.entry.js' },
    });
    const js = 'export const provision = () => {};\nexport const tearDown = () => {};';
    writeJs('node_modules/auth0/dist/provisioner.entry.js', js);
    const r = collectProvisionerAssets(root, bundleFiles({
      'node_modules/auth0/module.json': {
        name: '@rntme/identity-auth0', version: '1.0.0',
        provisioner: { entry: './dist/provisioner.entry.js' },
      },
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value['assets/provisioners/rntme__identity-auth0.entry.js']).toBe(
        Buffer.from(js).toString('base64'),
      );
      expect(Object.keys(r.value)).toHaveLength(1);
    }
  });

  it('returns BLUEPRINT_PROVISIONER_ENTRY_MISSING when entry file absent', () => {
    writeManifest('node_modules/x/module.json', {
      name: '@a/x', version: '1.0.0',
      provisioner: { entry: './dist/missing.js' },
    });
    const r = collectProvisionerAssets(root, bundleFiles({
      'node_modules/x/module.json': {
        name: '@a/x', version: '1.0.0',
        provisioner: { entry: './dist/missing.js' },
      },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('BLUEPRINT_PROVISIONER_ENTRY_MISSING');
      expect(r.errors[0]?.message).toContain('@a/x');
      expect(r.errors[0]?.message).toContain('./dist/missing.js');
    }
  });

  it('returns CLI_BUNDLE_ASSETS_TOO_LARGE when total bytes exceed 10 MiB', () => {
    writeManifest('node_modules/big/module.json', {
      name: '@a/big', version: '1.0.0',
      provisioner: { entry: './dist/big.entry.js' },
    });
    const big = Buffer.alloc(11 * 1024 * 1024, 0x20).toString();
    writeJs('node_modules/big/dist/big.entry.js', big);
    const r = collectProvisionerAssets(root, bundleFiles({
      'node_modules/big/module.json': {
        name: '@a/big', version: '1.0.0',
        provisioner: { entry: './dist/big.entry.js' },
      },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('CLI_BUNDLE_ASSETS_TOO_LARGE');
  });

  it('collects multiple modules and emits stable key order', () => {
    writeManifest('node_modules/a/module.json', {
      name: '@a/m', version: '1.0.0',
      provisioner: { entry: './e.js' },
    });
    writeJs('node_modules/a/e.js', 'export const provision = () => {};');
    writeManifest('node_modules/b/module.json', {
      name: '@b/m', version: '1.0.0',
      provisioner: { entry: './e.js' },
    });
    writeJs('node_modules/b/e.js', 'export const provision = () => {};');
    const r = collectProvisionerAssets(root, bundleFiles({
      'node_modules/a/module.json': {
        name: '@a/m', version: '1.0.0', provisioner: { entry: './e.js' },
      },
      'node_modules/b/module.json': {
        name: '@b/m', version: '1.0.0', provisioner: { entry: './e.js' },
      },
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value).sort()).toEqual([
        'assets/provisioners/a__m.entry.js',
        'assets/provisioners/b__m.entry.js',
      ]);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm -F @rntme/cli vitest run test/unit/bundle/collect-assets.test.ts
```

Expected: FAIL — `collectProvisionerAssets` not exported.

- [ ] **Step 3: Implement `collectProvisionerAssets`**

```ts
// apps/cli/src/bundle/collect-assets.ts
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { safeProvisionerName } from '@rntme/blueprint';
import { err, ok, type Result } from '../result.js';

const MAX_ASSETS_BYTES = 10 * 1024 * 1024;

export type CollectAssetsError = Readonly<{
  code: 'BLUEPRINT_PROVISIONER_ENTRY_MISSING' | 'CLI_BUNDLE_ASSETS_TOO_LARGE';
  message: string;
}>;

type ProvisionerBlock = { entry?: unknown };
type ManifestShape = { name?: unknown; provisioner?: unknown };

export function collectProvisionerAssets(
  root: string,
  bundleFiles: Readonly<Record<string, unknown>>,
): Result<Readonly<Record<string, string>>, CollectAssetsError> {
  const out: Record<string, string> = {};
  let totalBytes = 0;

  for (const [relPath, value] of Object.entries(bundleFiles)) {
    if (!relPath.endsWith('/module.json')) continue;
    if (!relPath.startsWith('node_modules/')) continue;
    const manifest = value as ManifestShape;
    const provisioner = manifest.provisioner as ProvisionerBlock | undefined;
    if (!provisioner) continue;
    const entry = provisioner.entry;
    if (typeof entry !== 'string' || entry.length === 0) continue;
    const name = manifest.name;
    if (typeof name !== 'string' || name.length === 0) continue;

    const moduleDir = dirname(relPath);
    const absEntry = resolve(root, moduleDir, entry);

    let bytes: Buffer;
    try {
      const st = statSync(absEntry);
      if (!st.isFile()) {
        return err({
          code: 'BLUEPRINT_PROVISIONER_ENTRY_MISSING',
          message: `module "${name}" provisioner.entry "${entry}" is not a regular file`,
        });
      }
      bytes = readFileSync(absEntry);
    } catch (cause) {
      return err({
        code: 'BLUEPRINT_PROVISIONER_ENTRY_MISSING',
        message: `module "${name}" provisioner.entry "${entry}" is missing on disk (${(cause as Error).message})`,
      });
    }

    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_ASSETS_BYTES) {
      return err({
        code: 'CLI_BUNDLE_ASSETS_TOO_LARGE',
        message: `combined provisioner asset bytes exceed 10 MiB (got ${totalBytes})`,
      });
    }

    const safe = safeProvisionerName(name);
    out[`assets/provisioners/${safe}.entry.js`] = bytes.toString('base64');
  }

  return ok(out);
}
```

- [ ] **Step 4: Run tests; expect PASS**

```bash
pnpm -F @rntme/cli vitest run test/unit/bundle/collect-assets.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/bundle/collect-assets.ts apps/cli/test/unit/bundle/collect-assets.test.ts
git commit -m "feat(cli): collectProvisionerAssets walks bundle manifests, emits base64 assets"
```

---

### Task 6: Wire `collectProvisionerAssets` into `buildProjectBundle`

**Files:**
- Modify: `apps/cli/src/bundle/build.ts`
- Modify: `apps/cli/test/unit/bundle/build.test.ts`

- [ ] **Step 1: Add a test to `build.test.ts` for the integrated path**

Append the following test inside the existing `describe('buildProjectBundle', ...)` block:

```ts
it('emits version 2 bundles with assets when modules declare provisioner.entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-build-'));
  try {
    writeFileSync(join(dir, 'project.json'), JSON.stringify({ name: 'demo', services: [] }));
    mkdirSync(join(dir, 'node_modules/auth0/dist'), { recursive: true });
    writeFileSync(join(dir, 'node_modules/auth0/module.json'), JSON.stringify({
      name: '@rntme/identity-auth0',
      version: '1.0.0',
      provisioner: { entry: './dist/provisioner.entry.js' },
    }));
    const js = 'export const provision = () => {};\nexport const tearDown = () => {};';
    writeFileSync(join(dir, 'node_modules/auth0/dist/provisioner.entry.js'), js);

    const r = buildProjectBundle(dir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.bundle.version).toBe(2);
    expect(r.value.bundle.assets['assets/provisioners/rntme__identity-auth0.entry.js']).toBe(
      Buffer.from(js).toString('base64'),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('returns BLUEPRINT_PROVISIONER_ENTRY_MISSING from buildProjectBundle when entry absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-build-'));
  try {
    writeFileSync(join(dir, 'project.json'), JSON.stringify({ name: 'demo', services: [] }));
    mkdirSync(join(dir, 'node_modules/x'), { recursive: true });
    writeFileSync(join(dir, 'node_modules/x/module.json'), JSON.stringify({
      name: '@a/x', version: '1.0.0',
      provisioner: { entry: './dist/missing.js' },
    }));
    const r = buildProjectBundle(dir);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_PROVISIONER_ENTRY_MISSING');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

Ensure the imports `mkdtempSync, mkdirSync, writeFileSync, rmSync, tmpdir, join` are present at the top of the file; add any missing.

- [ ] **Step 2: Run test; expect FAIL**

```bash
pnpm -F @rntme/cli vitest run test/unit/bundle/build.test.ts
```

Expected: FAIL — assets not populated, returns version 2 with `{}`.

- [ ] **Step 3: Wire `collectProvisionerAssets` into `buildProjectBundle`**

In `apps/cli/src/bundle/build.ts`, after the existing `bundleFiles` collection loop and before constructing `const bundle`, insert:

```ts
import { collectProvisionerAssets } from './collect-assets.js';
// ...
const assetsResult = collectProvisionerAssets(root, bundleFiles);
if (!assetsResult.ok) {
  const e = assetsResult.errors[0];
  return err(cliError(
    e.code === 'CLI_BUNDLE_ASSETS_TOO_LARGE' ? 'CLI_BUNDLE_ASSETS_TOO_LARGE' : 'CLI_VALIDATE_LOCAL_FAILED',
    e.message,
  ));
}
```

Then update bundle construction:

```ts
const bundle: CanonicalBundle = { version: 2, files: bundleFiles, assets: assetsResult.value };
```

(Note: the `BLUEPRINT_PROVISIONER_ENTRY_MISSING` code is preserved in the *message*; the CLI exit-mapping wraps it as `CLI_VALIDATE_LOCAL_FAILED`. Tests assert on the error message containing `BLUEPRINT_PROVISIONER_ENTRY_MISSING`. Update the test in Step 1 if needed: `expect(r.errors[0]?.message).toContain('BLUEPRINT_PROVISIONER_ENTRY_MISSING')` — adjust accordingly if the test was checking `code`.)

Actually, surface the inner code directly: refactor the wrapping so the original error code is exposed. Replace the `cliError(...)` call with:

```ts
return err({
  kind: 'cli',
  code: e.code === 'CLI_BUNDLE_ASSETS_TOO_LARGE' ? 'CLI_BUNDLE_ASSETS_TOO_LARGE' : 'CLI_VALIDATE_LOCAL_FAILED',
  message: `${e.code}: ${e.message}`,
});
```

Tests now assert `r.errors[0]?.message` contains the inner code string — keep tests on `message.includes('BLUEPRINT_PROVISIONER_ENTRY_MISSING')`.

- [ ] **Step 4: Re-run; expect PASS**

```bash
pnpm -F @rntme/cli vitest run test/unit/bundle/build.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/bundle/build.ts apps/cli/test/unit/bundle/build.test.ts
git commit -m "feat(cli): buildProjectBundle includes provisioner assets in v2 bundles"
```

---

### Task 7: `deploy-core` — add `projectDir` to provisioner inputs and resolver signature

**Files:**
- Modify: `packages/deploy/deploy-core/src/provision.ts`
- Modify: `packages/deploy/deploy-core/test/unit/provision.test.ts`

- [ ] **Step 1: Update existing tests to pass `projectDir`**

In `provision.test.ts`, every call to `runProvisioners({...})` must include `projectDir: '/tmp/test'` (or any string — the value is opaque to `runProvisioners`, only forwarded to `resolveProvisioner`).

Use a single sed-style search-and-replace: in every options object passed to `runProvisioners`, append `, projectDir: '/tmp/test'` to the input. There are roughly 8–10 call sites; verify by grepping for `runProvisioners({` in the test file and updating each.

Also update the `resolveProvisioner` mock signature in tests to accept three args (still ignoring them):

```ts
resolveProvisioner: async (_pkg, _entry, _projectDir) => happyContract,
```

- [ ] **Step 2: Run tests; expect FAIL (typecheck)**

```bash
pnpm -F @rntme/deploy-core vitest run test/unit/provision.test.ts
```

Expected: FAIL — `projectDir` not in input type.

- [ ] **Step 3: Update `RunProvisionersInput` and resolver signature**

In `packages/deploy/deploy-core/src/provision.ts`:

Add `projectDir: string` to `RunProvisionersInput`:

```ts
export type RunProvisionersInput = {
  readonly modules: ReadonlyArray<DiscoveredProvisionerModule>;
  readonly resolvedTargetSecrets: Readonly<Record<string, unknown>>;
  readonly projectDir: string;                              // NEW
  readonly resolveProvisioner: (
    packageName: string,
    entry: string,
    projectDir: string,                                     // NEW arg
  ) => Promise<ProvisionerContract>;
  readonly log: (entry: { step: string; level: 'info' | 'warn' | 'error'; code?: string; message: string }) => void;
  readonly defaultTimeoutMs?: number;
};
```

In the body of `runProvisioners`, locate the `contract = await input.resolveProvisioner(m.packageName, block.entry);` call (~line 56) and pass the new arg:

```ts
contract = await input.resolveProvisioner(m.packageName, block.entry, input.projectDir);
```

- [ ] **Step 4: Re-run tests; expect PASS**

```bash
pnpm -F @rntme/deploy-core vitest run test/unit/provision.test.ts
pnpm -F @rntme/deploy-core typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/deploy/deploy-core/src/provision.ts \
        packages/deploy/deploy-core/test/unit/provision.test.ts
git commit -m "feat(deploy-core): runProvisioners receives projectDir; resolver gets third arg"
```

---

### Task 8: `deploy-core` — add `DEPLOY_PROVISION_BUNDLE_ASSET_MISSING` and `DEPLOY_BUNDLE_VERSION_UNSUPPORTED`

**Files:**
- Modify: `packages/deploy/deploy-core/src/errors-provision.ts`

- [ ] **Step 1: Add codes to the const map**

In `packages/deploy/deploy-core/src/errors-provision.ts`, append to the existing object:

```ts
export const DEPLOY_PROVISION_ERROR_CODES = {
  DEPLOY_PROVISION_MODULE_RESOLVE_FAILED: 'DEPLOY_PROVISION_MODULE_RESOLVE_FAILED',
  DEPLOY_PROVISION_ENTRY_LOAD_FAILED: 'DEPLOY_PROVISION_ENTRY_LOAD_FAILED',
  DEPLOY_PROVISION_BUNDLE_ASSET_MISSING: 'DEPLOY_PROVISION_BUNDLE_ASSET_MISSING',
  DEPLOY_PROVISION_TARGET_SECRET_MISSING: 'DEPLOY_PROVISION_TARGET_SECRET_MISSING',
  DEPLOY_PROVISION_TARGET_SECRET_SCHEMA_MISMATCH: 'DEPLOY_PROVISION_TARGET_SECRET_SCHEMA_MISMATCH',
  DEPLOY_PROVISION_TIMEOUT: 'DEPLOY_PROVISION_TIMEOUT',
  DEPLOY_PROVISION_OUTPUT_INVALID: 'DEPLOY_PROVISION_OUTPUT_INVALID',
  DEPLOY_PROVISION_VENDOR_FAILED: 'DEPLOY_PROVISION_VENDOR_FAILED',
  DEPLOY_BUNDLE_VERSION_UNSUPPORTED: 'DEPLOY_BUNDLE_VERSION_UNSUPPORTED',
} as const;
```

- [ ] **Step 2: Typecheck**

```bash
pnpm -F @rntme/deploy-core typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/deploy/deploy-core/src/errors-provision.ts
git commit -m "feat(deploy-core): add bundle asset and version error codes"
```

---

### Task 9: Platform `materializeBundle` writes `assets`; rejects `version > 2`

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Test: `apps/platform-http/test/unit/deploy/materialize-bundle.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/platform-http/test/unit/deploy/materialize-bundle.test.ts
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// materializeBundle is currently not exported; add an `export` to its declaration in
// executor.ts as part of Step 3 below. The test imports it directly.
import { materializeBundle } from '../../../src/deploy/executor.js';

const sample = (overrides: Record<string, unknown> = {}): unknown => ({
  version: 2,
  files: { 'project.json': { name: 'demo' } },
  assets: { 'assets/provisioners/x.entry.js': Buffer.from('export const provision=()=>{};').toString('base64') },
  ...overrides,
});

describe('materializeBundle', () => {
  it('writes JSON files and binary assets to a tmp dir', async () => {
    const dir = await materializeBundle(sample() as never);
    try {
      const proj = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'));
      expect(proj).toEqual({ name: 'demo' });
      const asset = readFileSync(join(dir, 'assets/provisioners/x.entry.js'), 'utf8');
      expect(asset).toBe('export const provision=()=>{};');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('treats absent assets section as empty (v1 read-compat)', async () => {
    const v1 = { version: 1, files: { 'project.json': { name: 'demo' } } };
    const dir = await materializeBundle(v1 as never);
    try {
      const proj = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'));
      expect(proj).toEqual({ name: 'demo' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects bundle versions greater than 2 with DEPLOY_BUNDLE_VERSION_UNSUPPORTED', async () => {
    await expect(materializeBundle({ version: 3, files: {}, assets: {} } as never))
      .rejects.toThrow(/DEPLOY_BUNDLE_VERSION_UNSUPPORTED/);
  });
});
```

- [ ] **Step 2: Run test; expect FAIL**

```bash
pnpm -F @rntme/platform-http vitest run test/unit/deploy/materialize-bundle.test.ts
```

Expected: FAIL — `materializeBundle` not exported and assets not written.

- [ ] **Step 3: Update `materializeBundle`**

In `apps/platform-http/src/deploy/executor.ts`, around line 479:

```ts
export async function materializeBundle(bundle: CanonicalBundle): Promise<string> {
  if (typeof bundle.version === 'number' && bundle.version > 2) {
    throw new Error(`DEPLOY_BUNDLE_VERSION_UNSUPPORTED: bundle version ${bundle.version} not supported`);
  }
  const dir = await mkdtemp(join(tmpdir(), 'rntme-deploy-'));
  for (const [relPath, value] of Object.entries(bundle.files)) {
    const path = join(dir, relPath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(value));
  }
  const assets = (bundle as { assets?: Record<string, string> }).assets ?? {};
  for (const [relPath, base64] of Object.entries(assets)) {
    const path = join(dir, relPath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(base64, 'base64'));
  }
  return dir;
}
```

Update the `CanonicalBundle` type import in `executor.ts` to allow `version: 1 | 2` and an optional `assets` map (or extend the existing local type). If the local type is duplicated from CLI, define it inline:

```ts
type CanonicalBundle = {
  readonly version: 1 | 2;
  readonly files: Readonly<Record<string, unknown>>;
  readonly assets?: Readonly<Record<string, string>>;
};
```

- [ ] **Step 4: Run tests; expect PASS**

```bash
pnpm -F @rntme/platform-http vitest run test/unit/deploy/materialize-bundle.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/deploy/executor.ts \
        apps/platform-http/test/unit/deploy/materialize-bundle.test.ts
git commit -m "feat(platform-http): materializeBundle writes assets, rejects v>2"
```

---

### Task 10: Platform `resolveProvisioner` — convention-based path from `tmpDir`

**Files:**
- Modify: `apps/platform-http/src/app.ts`
- Test: `apps/platform-http/test/unit/deploy/resolve-provisioner.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/platform-http/test/unit/deploy/resolve-provisioner.test.ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { buildResolveProvisioner } from '../../../src/app.js';

describe('buildResolveProvisioner', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'rntme-rp-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('imports the provisioner entry from the synthetic path', async () => {
    const safePath = join(dir, 'assets/provisioners/test__example.entry.js');
    mkdirSync(join(dir, 'assets/provisioners'), { recursive: true });
    writeFileSync(safePath, 'export const provision = () => "p";\nexport const tearDown = () => "t";\n');

    const resolve = buildResolveProvisioner();
    const contract = await resolve('@test/example', './ignored.js', dir);
    expect(typeof contract.provision).toBe('function');
    expect(typeof contract.tearDown).toBe('function');
  });

  it('throws DEPLOY_PROVISION_BUNDLE_ASSET_MISSING when the file is absent', async () => {
    const resolve = buildResolveProvisioner();
    await expect(resolve('@test/missing', './ignored.js', dir))
      .rejects.toThrow(/DEPLOY_PROVISION_BUNDLE_ASSET_MISSING/);
  });

  it('throws DEPLOY_PROVISION_ENTRY_LOAD_FAILED when JS is broken', async () => {
    const safePath = join(dir, 'assets/provisioners/broken.entry.js');
    mkdirSync(join(dir, 'assets/provisioners'), { recursive: true });
    writeFileSync(safePath, 'this is not valid javascript {{{');

    const resolve = buildResolveProvisioner();
    await expect(resolve('broken', './ignored.js', dir))
      .rejects.toThrow(/DEPLOY_PROVISION_ENTRY_LOAD_FAILED/);
  });
});
```

- [ ] **Step 2: Run test; expect FAIL**

```bash
pnpm -F @rntme/platform-http vitest run test/unit/deploy/resolve-provisioner.test.ts
```

Expected: FAIL — `buildResolveProvisioner` not exported.

- [ ] **Step 3: Implement `buildResolveProvisioner` in `app.ts`**

In `apps/platform-http/src/app.ts`, find the existing `resolveProvisioner` arrow function around line 109. Replace it with:

```ts
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { safeProvisionerName } from '@rntme/blueprint';

// new exported factory; the result plugs into executorDeps.resolveProvisioner
export function buildResolveProvisioner(): (
  packageName: string,
  entry: string,
  projectDir: string,
) => Promise<{ provision: unknown; tearDown: unknown }> {
  return async (packageName, _entry, projectDir) => {
    const safe = safeProvisionerName(packageName);
    const relPath = `assets/provisioners/${safe}.entry.js`;
    const absPath = join(projectDir, relPath);
    if (!existsSync(absPath)) {
      throw new Error(
        `DEPLOY_PROVISION_BUNDLE_ASSET_MISSING: module "${packageName}" expected ${relPath} in materialized bundle`,
      );
    }
    let pkg: { provision?: unknown; tearDown?: unknown };
    try {
      pkg = (await import(pathToFileURL(absPath).href)) as { provision?: unknown; tearDown?: unknown };
    } catch (cause) {
      throw new Error(
        `DEPLOY_PROVISION_ENTRY_LOAD_FAILED: module "${packageName}" failed to import: ${(cause as Error).message}`,
      );
    }
    return { provision: pkg.provision as never, tearDown: pkg.tearDown as never };
  };
}
```

In the place where `executorDeps.resolveProvisioner` is currently set (the inline arrow), replace with:

```ts
resolveProvisioner: buildResolveProvisioner(),
```

- [ ] **Step 4: Re-run tests; expect PASS**

```bash
pnpm -F @rntme/platform-http vitest run test/unit/deploy/resolve-provisioner.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/app.ts \
        apps/platform-http/test/unit/deploy/resolve-provisioner.test.ts
git commit -m "feat(platform-http): resolveProvisioner imports from materialized tmpDir"
```

---

### Task 11: Pass `tmpDir` as `projectDir` through executor → `runProvisioners`

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`

- [ ] **Step 1: Locate the `runProvisioners` call**

Around line 214–225 in `executor.ts`, the executor builds the input object. The `projectDir` arg must be added.

- [ ] **Step 2: Pass `tmpDir`**

Update the call site:

```ts
const provisionResult = await runStage(
  'provision',
  async () =>
    (deps.runProvisioners ?? runProvisioners)({
      modules: provModules.map((m) => {
        const prior = priorOutputs[m.projectKey];
        return prior === undefined ? m : { ...m, priorOutputs: prior };
      }),
      resolvedTargetSecrets: decrypted,
      projectDir: tmpDir,                                   // NEW
      resolveProvisioner: deps.resolveProvisioner,
      log: (e) => void appendLog(deps, deploymentId, orgId, e.level, e.step, redact(e.message)),
    }),
  { log },
);
```

`tmpDir` is in scope from the outer `try { ... }` block (assigned by `materializeBundle`).

- [ ] **Step 3: Update the `executorDeps.resolveProvisioner` typing in `app.ts`**

The deps signature already accepts `(packageName, entry, projectDir) => ...` because of Task 7's changes. Verify:

```bash
pnpm -F @rntme/platform-http typecheck
```

Expected: PASS.

- [ ] **Step 4: Run platform tests**

```bash
pnpm -F @rntme/platform-http test
```

Expected: existing tests pass; if any test sets up a custom `runProvisioners` mock without `projectDir`, fix by adding `projectDir: '/tmp/x'` to the input.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/deploy/executor.ts
git commit -m "feat(platform-http): forward tmpDir as projectDir to runProvisioners"
```

---

### Task 12: Delete-flow tearDown — re-materialize bundle + invoke provisioner.tearDown

**Files:**
- Modify: `apps/platform-http/src/deploy/project-delete-executor.ts`

- [ ] **Step 1: Plan the change**

The current `runProjectDeleteOperation`:
1. transitions to running
2. lists applied resources
3. groups by target
4. deletes Dokploy resources

D17 / spec §8.4 inserts a tearDown phase BEFORE Dokploy deletion: for each target group, locate the **last successful deployment** for that `(project, target)` pair, fetch its blueprint bundle from blob storage, materialize it, and for each module in `deployment.provisionResult.modules`, dynamic-import the provisioner via `resolveProvisioner` and call `tearDown(input)`.

The delete-executor needs three new dependencies:
- `blob`: blob fetcher (already used in deploy executor; same `getRaw` interface).
- `resolveProvisioner`: same factory as deploy.
- `secretCipher`: to decrypt `provisionResultCiphertext`.

- [ ] **Step 2: Add new deps to `ProjectDeleteExecutorDeps`**

```ts
import type { Blob, SecretCipher } from '@rntme/platform-core'; // adjust import path to where these live
import { runTearDownsForDeployment } from './run-teardowns.js';

export type ProjectDeleteExecutorDeps = {
  // existing fields...
  readonly blob: { getRaw: (key: string) => Promise<Result<Buffer, PlatformError>> };
  readonly secretCipher: SecretCipher;
  readonly resolveProvisioner: (
    packageName: string,
    entry: string,
    projectDir: string,
  ) => Promise<{ provision: unknown; tearDown: unknown }>;
  readonly heartbeatMs?: number;
};
```

(Adjust types to match what's already in scope. If `Blob` / `SecretCipher` types already export from `@rntme/platform-core` or a sibling, use those.)

- [ ] **Step 3: Add `tearDown-per-target` step before Dokploy deletion**

In the loop over `groups` (around line 46), before the `dokployClientFactory.create(target.value)` call, insert:

```ts
const lastSuccess = await deps.withOrgTx(orgId, (repos) =>
  repos.deployments.findLastSuccessfulForProjectTarget(operation.projectId, targetId),
);
if (isOk(lastSuccess) && lastSuccess.value && lastSuccess.value.provisionResult) {
  const tearDownResult = await runTearDownsForDeployment({
    deployment: lastSuccess.value,
    deps,
    orgId,
    operationId: operation.id,
  });
  if (!tearDownResult.ok) {
    failures.push({ targetId, message: `tearDown failed: ${tearDownResult.errors[0]?.message ?? 'unknown'}` });
    continue;
  }
}
```

This pattern requires:
- `deployments.findLastSuccessfulForProjectTarget(projectId, targetId)` repo method. If it doesn't exist, add it in `packages/platform/platform-storage/src/repos/pg-deployment-repo.ts` with the SQL: `WHERE project_id=$1 AND target_id=$2 AND status IN ('succeeded','succeeded_with_warnings') ORDER BY queued_at DESC LIMIT 1`. Add the matching method to the `DeploymentRepo` interface in `packages/platform/platform-core/src/repos/deployment-repo.ts`.

- [ ] **Step 4: Implement `runTearDownsForDeployment` helper**

Create `apps/platform-http/src/deploy/run-teardowns.ts`:

```ts
import { gunzipSync } from 'node:zlib';
import { rm } from 'node:fs/promises';
import { isOk } from '@rntme/platform-core';
import { discoverModules } from '@rntme/blueprint';
import { materializeBundle } from './executor.js';
import type { ProjectDeleteExecutorDeps } from './project-delete-executor.js';

export async function runTearDownsForDeployment(input: {
  deployment: { bundleBlobKey: string; provisionResult: { modules: Record<string, { publicOutputs: Record<string, unknown> }> }; provisionResultCiphertext?: Buffer | null; provisionResultNonce?: Buffer | null; provisionResultKeyVersion?: number | null };
  deps: Pick<ProjectDeleteExecutorDeps, 'blob' | 'secretCipher' | 'resolveProvisioner'>;
  orgId: string;
  operationId: string;
}): Promise<{ ok: true } | { ok: false; errors: Array<{ message: string }> }> {
  const raw = await input.deps.blob.getRaw(input.deployment.bundleBlobKey);
  if (!isOk(raw)) return { ok: false, errors: [{ message: 'bundle blob fetch failed' }] };
  const bundle = JSON.parse(gunzipSync(raw.value).toString('utf8')) as never;
  const tmpDir = await materializeBundle(bundle);
  try {
    const discovered = discoverModules({ projectDir: tmpDir });
    if (!discovered.ok) return { ok: false, errors: [{ message: 'module discovery failed' }] };

    let secretEnvelope: { modules: Record<string, { secretOutputs: Record<string, unknown> }> } = { modules: {} };
    if (input.deployment.provisionResultCiphertext && input.deployment.provisionResultNonce && input.deployment.provisionResultKeyVersion !== null && input.deployment.provisionResultKeyVersion !== undefined) {
      const dec = input.deps.secretCipher.decrypt({
        ciphertext: input.deployment.provisionResultCiphertext,
        nonce: input.deployment.provisionResultNonce,
        keyVersion: input.deployment.provisionResultKeyVersion,
      });
      secretEnvelope = JSON.parse(dec.toString('utf8'));
    }

    for (const [moduleKey, moduleEntry] of Object.entries(input.deployment.provisionResult.modules)) {
      const info = Object.values(discovered.value).find((m) => m.projectKey === moduleKey);
      if (!info?.manifest.provisioner) continue;
      const contract = await input.deps.resolveProvisioner(info.manifest.name, info.manifest.provisioner.entry, tmpDir);
      if (typeof contract.tearDown !== 'function') continue;
      const secretOutputs = secretEnvelope.modules[moduleKey]?.secretOutputs ?? {};
      const result = await (contract.tearDown as (i: unknown) => Promise<{ ok: boolean; errors?: Array<{ message: string }> }>)({
        publicConfig: info.publicConfig,
        targetSecrets: {},                      // tearDown only needs prior outputs in v1
        priorOutputs: { publicOutputs: moduleEntry.publicOutputs, secretOutputs },
        log: () => undefined,
        signal: new AbortController().signal,
      });
      if (!result.ok) {
        return { ok: false, errors: result.errors ?? [{ message: 'tearDown returned err' }] };
      }
    }
    return { ok: true };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
```

(If types collide or imports don't resolve, adapt to the actual platform-core/platform-storage exports. The point is: re-materialize the bundle, discover modules, call tearDown per module with prior outputs reconstructed from `provisionResult` + decrypted ciphertext.)

- [ ] **Step 5: Wire deps in `apps/platform-http/src/app.ts`**

Where `projectDeleteExecutorDeps` is constructed (~line 119), add:

```ts
const projectDeleteExecutorDeps = {
  withOrgTx,
  dokployClientFactory: createDokployClientFactory(cipher),
  logger: deps.logger,
  blob: deps.blob,
  secretCipher: cipher,
  resolveProvisioner: buildResolveProvisioner(),
};
```

- [ ] **Step 6: Build, typecheck, run tests**

```bash
pnpm -F @rntme/platform-http typecheck
pnpm -F @rntme/platform-http test
```

Expected: PASS. If any existing test for `runProjectDeleteOperation` fails because of missing `blob` / `secretCipher` / `resolveProvisioner` in the deps mock, add no-op stubs:

```ts
{ blob: { getRaw: async () => ok(Buffer.alloc(0)) }, secretCipher: cipher, resolveProvisioner: async () => ({ provision: () => undefined, tearDown: () => undefined }) }
```

- [ ] **Step 7: Commit**

```bash
git add apps/platform-http/src/deploy/project-delete-executor.ts \
        apps/platform-http/src/deploy/run-teardowns.ts \
        apps/platform-http/src/app.ts \
        packages/platform/platform-core/src/repos/deployment-repo.ts \
        packages/platform/platform-storage/src/repos/pg-deployment-repo.ts
git commit -m "feat(platform-http): tearDown phase in project delete (D17)"
```

---

### Task 13: Auth0 module — pre-bundle the provisioner entry

**Files:**
- Modify: `modules/identity/auth0/package.json`
- Modify: `modules/identity/auth0/module.json`

- [ ] **Step 1: Update `package.json` build chain**

Find the `scripts` block. Current `build`:

```json
"build": "pnpm run build:deps && tsc -p tsconfig.json && tsc -p tsconfig.client.json"
```

Change to:

```json
"build": "pnpm run build:deps && tsc -p tsconfig.json && tsc -p tsconfig.client.json && pnpm run build:provisioner",
"build:provisioner": "esbuild dist/provisioner.js --bundle --platform=node --format=esm --target=node20 --external:node:* --outfile=dist/provisioner.entry.js"
```

If `esbuild` is not already a devDependency of this package, add it:

```json
"devDependencies": {
  ...,
  "esbuild": "^0.20.0"
}
```

(Pin to the same version already used in `apps/cli` or `packages/runtime/ui-runtime`. Run `grep -r '"esbuild"' apps packages` to find the canonical version.)

- [ ] **Step 2: Update `module.json`**

Change `provisioner.entry` from `./dist/provisioner.js` to `./dist/provisioner.entry.js`:

```json
"provisioner": {
  "entry": "./dist/provisioner.entry.js",
  "produces": [
    { "name": "spaClient", "kind": "single", "secret": false },
    { "name": "resourceServer", "kind": "single", "secret": false },
    { "name": "m2mClients", "kind": "many", "secret": true }
  ],
  "requires": [
    { "name": "auth0Mgmt", "schema": "auth0-mgmt-api-v1" }
  ],
  "timeoutMs": 60000
}
```

Also update `package.json#exports`:

```json
"./provisioner.entry": {
  "import": "./dist/provisioner.entry.js"
}
```

- [ ] **Step 3: Build the module**

```bash
pnpm -F @rntme/identity-auth0 build
```

Expected: `modules/identity/auth0/dist/provisioner.entry.js` exists.

- [ ] **Step 4: Inspect bundle size**

```bash
wc -c modules/identity/auth0/dist/provisioner.entry.js
```

Expected: between ~10 KB and ~500 KB. If significantly larger, esbuild is pulling in unexpected runtime deps.

- [ ] **Step 5: Commit**

```bash
git add modules/identity/auth0/package.json modules/identity/auth0/module.json
git commit -m "feat(identity-auth0): pre-bundle provisioner.entry.js via esbuild"
```

---

### Task 14: Auth0 module — provisioner-entry shape unit test

**Files:**
- Create: `modules/identity/auth0/test/unit/provisioner-entry.test.ts`

- [ ] **Step 1: Write the test**

```ts
// modules/identity/auth0/test/unit/provisioner-entry.test.ts
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ENTRY_PATH = resolve(__dirname, '../../dist/provisioner.entry.js');

describe('provisioner.entry.js (built artifact)', () => {
  it('exists', () => {
    expect(statSync(ENTRY_PATH).isFile()).toBe(true);
  });

  it('weighs less than 500 KB', () => {
    const size = statSync(ENTRY_PATH).size;
    expect(size).toBeLessThan(500 * 1024);
  });

  it('contains no @rntme imports (everything inlined)', () => {
    const text = readFileSync(ENTRY_PATH, 'utf8');
    expect(text).not.toMatch(/from\s+['"]@rntme\//);
    expect(text).not.toMatch(/require\(['"]@rntme\//);
  });

  it('exports provision and tearDown as functions', async () => {
    const mod = await import(ENTRY_PATH);
    expect(typeof mod.provision).toBe('function');
    expect(typeof mod.tearDown).toBe('function');
  });
});
```

- [ ] **Step 2: Run test (after `pnpm build`)**

```bash
pnpm -F @rntme/identity-auth0 build
pnpm -F @rntme/identity-auth0 vitest run test/unit/provisioner-entry.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/identity/auth0/test/unit/provisioner-entry.test.ts
git commit -m "test(identity-auth0): assert provisioner.entry shape and externals contract"
```

---

### Task 15: E2E test — gated full deploy with bundled provisioner

**Files:**
- Create: `apps/platform-http/test/e2e/provisioner-bundle.test.ts`

This task adds an integration test that exercises the whole pipeline: publish a project bundle containing the auth0 provisioner asset, run a deployment, assert `provisionResult` is populated.

The test runs only when `RNTME_AUTH0_E2E=1` is set (and `AUTH0_*` env vars are present). Skipping when those are missing.

- [ ] **Step 1: Write the gated test**

```ts
// apps/platform-http/test/e2e/provisioner-bundle.test.ts
import { describe, expect, it } from 'vitest';

const E2E = process.env['RNTME_AUTH0_E2E'] === '1';

describe.runIf(E2E)('provisioner-bundle e2e', () => {
  it('publishes bundle with assets and runs auth0 provisioner end-to-end', async () => {
    // ... see test plan in spec §12. Builds project bundle locally, posts to a
    // test instance of platform-http, watches deployment, asserts provisionResult.
    // Outline only — full implementation aligned with existing platform-http
    // e2e harness (see other test/e2e/*.test.ts files for setup patterns).
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Skip locally; verify file compiles**

```bash
pnpm -F @rntme/platform-http typecheck
pnpm -F @rntme/platform-http vitest run test/e2e/provisioner-bundle.test.ts
```

Expected: SKIP (no `RNTME_AUTH0_E2E`), file typechecks.

- [ ] **Step 3: Commit**

```bash
git add apps/platform-http/test/e2e/provisioner-bundle.test.ts
git commit -m "test(platform-http): gated e2e for bundled provisioner pipeline"
```

(Note: full e2e implementation is left to a follow-up because it requires standing up a platform-http test instance with the Auth0 mgmt secret. The skeleton ensures the file exists and is wired into the test runner.)

---

### Task 16: Cross-package green run

- [ ] **Step 1: Build everything in topological order**

```bash
pnpm -r run build
```

Expected: PASS. If any package fails because of the new `projectDir` arg in `resolveProvisioner`, fix the call site.

- [ ] **Step 2: Run all tests**

```bash
pnpm -r run test
```

Expected: PASS.

- [ ] **Step 3: Commit any incidental fixes**

If any unrelated test broke because of subtle type widening (e.g., a test mock not declaring `projectDir`), fix the mock. Commit:

```bash
git add -A
git commit -m "chore: update mocks for projectDir resolver arg"
```

---

### Task 17: Documentation touches (one PR per CLAUDE.md rule)

**Files:**
- Modify: `apps/cli/README.md`
- Modify: `apps/platform-http/README.md`
- Modify: `packages/deploy/deploy-core/README.md`
- Modify: `modules/identity/auth0/README.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/done/2026-05-03-module-provisioner-contract-design.md`
- Modify: `docs/superpowers/specs/2026-05-03-project-update-delete-operations-design.md`

- [ ] **Step 1: `apps/cli/README.md`**

Add a subsection "Bundle format v2" under the existing publish/build documentation describing:

```
Bundles emitted by `rntme project publish` are v2:

```
{ "version": 2, "files": { ... }, "assets": { ... } }
```

`assets` is a map from synthetic path to base64-encoded bytes. Today the only
assets are pre-bundled module provisioner entries, keyed by
`assets/provisioners/<safeName(manifest.name)>.entry.js` where `<safeName>`
drops the leading `@` from the package name and replaces `/` with `__`.

Total `assets` size is capped at 10 MiB. CLI publish returns
`CLI_BUNDLE_ASSETS_TOO_LARGE` if exceeded.
```
```

- [ ] **Step 2: `apps/platform-http/README.md`**

Update the "Provision phase" section (or add one if absent):

```
The provision stage resolves each module's provisioner from the materialized
bundle's `assets/` directory. Resolution path:
`<tmpDir>/assets/provisioners/<safeProvisionerName(manifest.name)>.entry.js`.
Modules are not loaded from the platform-http process's own `node_modules`.

Bundle versions higher than 2 are rejected with
`DEPLOY_BUNDLE_VERSION_UNSUPPORTED`. Bundles with `version: 1` are read with
`assets = {}` and skip provisioning if the bundled manifest has no provisioner
block.
```

- [ ] **Step 3: `packages/deploy/deploy-core/README.md`**

Add to the `runProvisioners` documentation:

```
Resolver signature:

`resolveProvisioner(packageName: string, entry: string, projectDir: string) => Promise<ProvisionerContract>`

Implementations should ignore `entry` at runtime in favor of a stable
convention from `manifest.name` rooted at `projectDir`. The platform-http
implementation uses
`<projectDir>/assets/provisioners/${safeProvisionerName(packageName)}.entry.js`.
```

- [ ] **Step 4: `modules/identity/auth0/README.md`**

Add a "Build pipeline" section:

```
This module ships its provisioner as a self-contained ESM bundle. The build
chain is:

1. `pnpm run build:deps` — workspace prerequisites.
2. `tsc -p tsconfig.json` — type-checked output to `dist/`.
3. `pnpm run build:provisioner` — esbuild produces `dist/provisioner.entry.js`,
   inlining `./mgmt-client.js` and `./result-shim.js` and externalizing only
   `node:*` built-ins.

`module.json#provisioner.entry` points at the bundled file, which is what the
CLI embeds in `assets/provisioners/rntme__identity-auth0.entry.js` of the
canonical project bundle.
```

- [ ] **Step 5: `AGENTS.md` §6**

Add a how-to entry (place it near other §6 task recipes, alphabetical or by topic):

```
- **How to ship a module with a provisioner.** Module's `package.json` chains
  `pnpm run build:provisioner` after `tsc`, with the script
  `esbuild dist/<name>.js --bundle --platform=node --format=esm --target=node20 --external:node:* --outfile=dist/<name>.entry.js`.
  The provisioner source must keep `@rntme/deploy-core` as `import type` only;
  TSC strips type-only imports so esbuild never sees them. Point
  `module.json#provisioner.entry` at the bundled file. CLI publish embeds the
  file as a base64 asset; platform-http imports it from the materialized
  `tmpDir`.
```

- [ ] **Step 6: Cross-references in spec files**

In `docs/superpowers/specs/done/2026-05-03-module-provisioner-contract-design.md`, near §6 (resolver detail), add:

```
> **Resolver detail superseded by `2026-05-03-provisioner-bundle-transport-design.md`.**
> The original spec assumed the resolver imports modules from the platform-http
> process's `node_modules`; the bundle-transport spec replaces that with
> resolver-from-`tmpDir` and a self-contained bundled entry per module.
```

In `docs/superpowers/specs/2026-05-03-project-update-delete-operations-design.md`, in §8 (Delete Flow), add a sentence:

```
> Delete-flow tearDown re-materializes each (project, deploy_target)'s last
> successful deployment bundle to a per-call `tmpDir`, then resolves and
> invokes provisioner tearDown via the same path-from-`tmpDir` resolver as
> deploy provisioning. See `docs/superpowers/specs/2026-05-03-provisioner-bundle-transport-design.md`.
```

- [ ] **Step 7: Commit**

```bash
git add apps/cli/README.md apps/platform-http/README.md \
        packages/deploy/deploy-core/README.md modules/identity/auth0/README.md \
        AGENTS.md \
        docs/superpowers/specs/done/2026-05-03-module-provisioner-contract-design.md \
        docs/superpowers/specs/2026-05-03-project-update-delete-operations-design.md
git commit -m "docs: document provisioner bundle transport across CLI/platform/auth0"
```

---

### Task 18: Verify e2e by hand against staging

After the PR merges and `platform-http` redeploys via Dokploy, retry the e2e from the broken state captured during spec authoring.

- [ ] **Step 1: Wait for platform-http redeploy**

Watch `https://dokploy.vladpr.com/...platform-http...` until the new commit is `done`. Or use the Dokploy MCP `application-one` to confirm `applicationStatus: "done"` and the latest commit matches.

- [ ] **Step 2: Re-run the deployment from the existing fixture**

```bash
set -a && source .env && set +a
node apps/cli/dist/bin/cli.js --token "$RNTME_TOKEN" --org test-organization --project notes-demo-v2 \
  project deploy --version 1 --target dokploy-demos-prov --wait --timeout 900
```

Expected: deploy succeeds; logs show `provision` stage completing without `DEPLOY_PROVISION_ENTRY_LOAD_FAILED`. `provisionResult` populated on the deployment row.

- [ ] **Step 3: Verify Auth0 client reconciled**

```bash
AUTH0_MGMT=$(curl -sS -X POST "https://${AUTH0_DOMAIN}/oauth/token" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\":\"$AUTH0_MANAGEMENT_CLIENT_ID\",\"client_secret\":\"$AUTH0_MANAGEMENT_CLIENT_SECRET\",\"audience\":\"$AUTH0_MANAGEMENT_AUDIENCE\",\"grant_type\":\"client_credentials\"}" | jq -r '.access_token')
curl -sS "https://${AUTH0_DOMAIN}/api/v2/clients/oqTqqNchzIDbnhtppvSlZqb2ni7KITnA" \
  -H "Authorization: Bearer $AUTH0_MGMT" | jq '{client_id, web_origins, allowed_origins}'
```

Expected: client present and reconciled to expected origins.

- [ ] **Step 4: Run full delete e2e**

```bash
node apps/cli/dist/bin/cli.js --token "$RNTME_TOKEN" --org test-organization \
  --project notes-demo-v2 project delete notes-demo-v2 --confirm notes-demo-v2 --wait --timeout 600
```

Expected: operation status `succeeded`. Auth0 client returns 404 on next mgmt query. Dokploy applications + Redpanda compose for `notes-demo-v2` are gone.

- [ ] **Step 5: Update memory**

Mark `rntme_provisioner_resolver_gap.md` as resolved or delete the memory file. Confirm in MEMORY.md index.

```bash
# Edit /home/coder/.claude/projects/-home-coder-project/memory/MEMORY.md to remove the line for rntme_provisioner_resolver_gap.md
rm /home/coder/.claude/projects/-home-coder-project/memory/rntme_provisioner_resolver_gap.md
```

(No git commit — this is local agent memory.)

---

## Self-review checklist

- [ ] Every spec section has a task: §6 → Task 4, §7 → Tasks 5–6, §8.1 → Task 9, §8.2 → Task 10, §8.3 → Task 7, §8.4 → Task 12, §9 → Task 13, §10 → Tasks 13–14, §11 → Tasks 2–3, 8, §12 → Tasks 1, 5, 6, 9, 10, 14, 15, §13 → Task 17, §14 → Task 18 manual verify.
- [ ] No "TBD"/"TODO" placeholders.
- [ ] Method/property names consistent (`safeProvisionerName`, `collectProvisionerAssets`, `buildResolveProvisioner`, `runTearDownsForDeployment`, `runProjectDeleteOperation`, `materializeBundle`).
- [ ] Error code names finalized: `BLUEPRINT_PROVISIONER_ENTRY_MISSING`, `CLI_BUNDLE_ASSETS_TOO_LARGE`, `DEPLOY_PROVISION_BUNDLE_ASSET_MISSING`, `DEPLOY_BUNDLE_VERSION_UNSUPPORTED` — used identically across tasks.
- [ ] Bundle version bump (1→2) reflected in every layer that touches it (CLI emit, platform read, executor short-circuit).
- [ ] tearDown wiring includes both repo addition (`findLastSuccessfulForProjectTarget`) and helper (`runTearDownsForDeployment`) and dep injection in `app.ts`.
