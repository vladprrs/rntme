# Sustained Cutover to Thin Bootable Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land four slices that enable `rntme platform up --target ./platform.target.json` against live Dokploy to succeed end-to-end, without BPMN-orchestrated deploys.

**Architecture:** UI-only domain services bypass graph/qsm/bindings requirements at compose; `target.workflows.engine.kind: 'disabled'` collapses workflows to `null` so `deploy-dokploy` skips Operaton/worker render via its existing `engine.kind === 'none'` short-circuit; CLI dist gains a `.provisioners/` directory of bundled provisioner entries and an enhanced resolver that prefers them; the two-pass var resolution (provision before plan) already works in the codebase. Final slice is a live-deploy runbook plus receipt.

**Tech Stack:** TypeScript, Bun, Zod, esbuild, bun:test, existing `@rntme/blueprint` / `@rntme/deploy-core` / `@rntme/deploy-runner` / `@rntme/deploy-dokploy`.

**Pre-existing state note (read before starting):**

- Stage order is already `compose → provision → plan → render → apply → verify`
  (see `packages/deploy/deploy-runner/src/run-deployment.ts` doc comment).
- `resolveVars` already supports `provision.*` sources via the
  `provisionResult` option, and `stages.plan` already passes
  `provisionResultForPlan` through (see
  `packages/deploy/deploy-runner/src/stages/plan.ts:17`). The 2026-05-10 spec's
  "two-pass var resolution" task is already done — this plan does NOT add
  it. The memory `rntme_blueprint_vars_vs_provisioner` is stale.
- The plan-level workflow engine already has a `kind: 'none'` short-circuit
  in `packages/deploy/deploy-dokploy/src/workflow-render.ts:23`. Slice B just
  needs the target-side schema + load mapping so `kind: 'disabled'` in
  `platform.target.json` materialises as `workflowEngine: { kind: 'none' }`
  in the deploy config.
- `apps/platform/blueprint/` has no `package.json` and no `node_modules`. The
  blueprint resolves modules through workspace conventions
  (`modules/<category>/<vendor>/`) via `discoverModules`. The bundled
  blueprint at `apps/cli/dist/platform-blueprint/` therefore also has no
  `node_modules` — the build script must reach modules via filesystem paths.

---

## File Structure

| File | Purpose | Slice |
| --- | --- | --- |
| `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts` | Compose-stage runtime-artifact builder; gain UI-only branch | A |
| `packages/platform/deploy-bundle-input/test/unit/to-deploy-core-input.test.ts` | Tests for UI-only + PARTIAL guard | A |
| `apps/cli/src/deploy-engine/target-schema.ts` | Extend `WorkflowsTargetSchema` with `disabled` discriminator | B |
| `apps/cli/src/deploy-engine/load-target.ts` | `buildWorkflowsSection` returns `null` for `kind: 'disabled'` | B |
| `apps/cli/test/unit/deploy-engine/load-target.test.ts` | Test `disabled` and absent workflows | B |
| `apps/cli/test/fixtures/target-platform.json` | Update fixture to disabled mode | B |
| `platform.target.json` | Switch live target to disabled | B |
| `apps/cli/scripts/build-platform-blueprint.cjs` | Replaces `copy-platform-blueprint.cjs`; copies JSON + bundles provisioner entries | C |
| `apps/cli/scripts/copy-platform-blueprint.cjs` | Delete (replaced) | C |
| `apps/cli/package.json` | Postbuild references new script | C |
| `apps/cli/src/deploy-engine/resolve-provisioner.ts` | Prefer `.provisioners/` manifest before `createRequire` | C |
| `apps/cli/test/unit/deploy-engine/resolve-provisioner.test.ts` | Test bundle-aware path + fallback | C |
| `docs/goals/dokploy-platform-e2e-deploy/notes/T006-slice-a-receipt.md` | Slice A receipt | A |
| `docs/goals/dokploy-platform-e2e-deploy/notes/T007-slice-b-receipt.md` | Slice B receipt | B |
| `docs/goals/dokploy-platform-e2e-deploy/notes/T008-slice-c-receipt.md` | Slice C receipt | C |
| `docs/goals/dokploy-platform-e2e-deploy/notes/T009-platform-up-success.md` | Slice D verify proof | D |
| `docs/goals/dokploy-platform-e2e-deploy/state.yaml` | Update slice status + full_outcome_complete | A-D |

Slices A and B are independent and may run in parallel. C depends on A+B. D depends on C.

---

## Slice A — UI-only Kind Allowance

### Task A1: Failing tests for UI-only domain compose

**Files:**
- Test: `packages/platform/deploy-bundle-input/test/unit/to-deploy-core-input.test.ts`

- [ ] **Step 1: Read existing test file to learn the harness conventions**

Run: `cat packages/platform/deploy-bundle-input/test/unit/to-deploy-core-input.test.ts | head -80`

Note the imports and fixture-construction patterns used by existing tests.
Reuse them — do not introduce new helpers.

- [ ] **Step 2: Add three failing tests at the end of the file**

Append, adapting the existing fixture builder to your test cases:

```ts
import { describe, expect, it } from 'bun:test';
// (other imports above — keep them)

describe('toDeployCoreInput UI-only domain services', () => {
  it('emits a UI-only manifest when a domain service has no graphSpec/qsm/bindings', async () => {
    const composed = makeMinimalComposedBlueprint({
      services: {
        app: { kind: 'domain', graphSpec: null, qsmValidated: null, bindings: null, seed: null },
      },
      uiBuildFiles: { 'ui/index.html': '<!doctype html>' },
    });
    const result = await toDeployCoreInput(composed, '/tmp');
    const app = result.services['app']!;
    expect(app.kind).toBe('domain');
    expect((app as any).runtimeFiles['manifest.json']).toContain('"http"');
    expect((app as any).runtimeFiles['manifest.json']).toContain('"enabled":true');
    expect((app as any).runtimeFiles).not.toHaveProperty('pdm.json');
    expect((app as any).runtimeFiles).not.toHaveProperty('shapes.json');
    expect((app as any).runtimeFiles['ui/index.html']).toBe('<!doctype html>');
  });

  it('throws DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_PARTIAL when only some artefacts are present', async () => {
    const composed = makeMinimalComposedBlueprint({
      services: {
        app: { kind: 'domain', graphSpec: { graphs: {}, shapes: {} } as any, qsmValidated: null, bindings: null, seed: null },
      },
    });
    await expect(toDeployCoreInput(composed, '/tmp')).rejects.toThrow(
      /DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_PARTIAL:app/,
    );
  });

  it('still emits full bundle for fully-populated domain services', async () => {
    const composed = makeMinimalComposedBlueprint({
      services: {
        organizations: {
          kind: 'domain',
          graphSpec: { graphs: {}, shapes: {} } as any,
          qsmValidated: {} as any,
          bindings: { artifact: {}, resolved: {} } as any,
          seed: null,
        },
      },
    });
    const result = await toDeployCoreInput(composed, '/tmp');
    expect((result.services['organizations'] as any).runtimeFiles).toHaveProperty('pdm.json');
  });
});
```

If `makeMinimalComposedBlueprint` does not already exist in this test file,
extract one from the closest existing fixture in the same file (the
`toDeployCoreInput` test file has a builder near the top). Do not invent a
new fixture path — read the file first and reuse what is there.

- [ ] **Step 3: Run the new tests; expect failure**

Run: `bun run --filter @rntme/deploy-bundle-input test -- to-deploy-core-input.test.ts`
Expected: 3 failures — `DEPLOY_EXECUTOR_SERVICE_GRAPHS_NOT_FOUND:app` and similar.

### Task A2: Implement UI-only branch in `buildRuntimeArtifactFiles`

**Files:**
- Modify: `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts`

- [ ] **Step 1: Locate `buildRuntimeArtifactFiles` and rewrite its head**

Open `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts`, find
the function `buildRuntimeArtifactFiles` (around line 210-260 today). Replace
the first guard block (the three `service.* === null` throws) with:

```ts
async function buildRuntimeArtifactFiles(
  project: ComposedBlueprint,
  rootDir: string,
  serviceSlug: string,
  uiBuildFiles: Record<string, string>,
): Promise<Record<string, string>> {
  const service = project.services[serviceSlug];
  if (service === undefined) throw new Error(`DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_NOT_FOUND:${serviceSlug}`);

  const hasGraph = service.graphSpec !== null;
  const hasQsm = service.qsmValidated !== null;
  const hasBindings = service.bindings !== null;
  const allMissing = !hasGraph && !hasQsm && !hasBindings;
  const allPresent = hasGraph && hasQsm && hasBindings;

  if (!allPresent && !allMissing) {
    const missing = [
      !hasGraph ? 'graphSpec' : null,
      !hasQsm ? 'qsmValidated' : null,
      !hasBindings ? 'bindings' : null,
    ].filter((s): s is string => s !== null).join(',');
    throw new Error(`DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_PARTIAL:${serviceSlug}:missing=${missing}`);
  }

  if (allMissing) {
    return buildUiOnlyRuntimeFiles(serviceSlug, uiBuildFiles);
  }

  // Full domain — existing behaviour. Keep the original assertions for
  // type narrowing only; reaching this point means all three are non-null.
  if (service.graphSpec === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_GRAPHS_NOT_FOUND:${serviceSlug}`);
  if (service.qsmValidated === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_QSM_NOT_FOUND:${serviceSlug}`);
  if (service.bindings === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_BINDINGS_NOT_FOUND:${serviceSlug}`);

  // … rest of the existing function body unchanged (manifest + pdm + qsm + bindings + graphs)
}
```

Then add the helper directly below the function:

```ts
function buildUiOnlyRuntimeFiles(
  serviceSlug: string,
  uiBuildFiles: Record<string, string>,
): Record<string, string> {
  const files: Record<string, string> = {};
  addJsonFile(files, 'manifest.json', {
    rntmeVersion: '1.0',
    service: { name: serviceSlug, version: '1.0.0' },
    surface: { http: { enabled: true, port: 3000 }, grpc: { enabled: false, port: 0 } },
    seed: { enabled: false, path: 'seed.json' },
    modules: [],
    ui: { enabled: true, buildPath: 'ui' },
  });
  for (const [path, content] of Object.entries(uiBuildFiles)) {
    if (!path.startsWith(`${serviceSlug}/`) && !path.startsWith('ui/')) continue;
    files[path] = content;
  }
  return files;
}
```

Note: `uiBuildFiles` keys in the existing code may be prefixed by service slug
or by `ui/` — match whatever convention the existing full-domain path uses
(grep for `uiBuildFiles[` in the same file and copy the convention).

- [ ] **Step 2: Run the new tests; expect them to pass**

Run: `bun run --filter @rntme/deploy-bundle-input test -- to-deploy-core-input.test.ts`
Expected: 3 pass.

- [ ] **Step 3: Run all package tests**

Run: `bun run --filter @rntme/deploy-bundle-input test`
Expected: all green. If any pre-existing test now fails because it asserted
the old hard-error behaviour, update the test to use the new
`DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_PARTIAL` shape (only if the failure is
clearly that case — otherwise stop and ask).

- [ ] **Step 4: Workspace typecheck**

Run: `bun run --filter @rntme/deploy-bundle-input typecheck`
Expected: exit 0.

### Task A3: Commit Slice A

- [ ] **Step 1: Write the slice receipt**

Create `docs/goals/dokploy-platform-e2e-deploy/notes/T006-slice-a-receipt.md`
with:

```md
# T006 — Slice A: UI-only domain allowance

Date: <today's ISO date>

## Change
`buildRuntimeArtifactFiles` now accepts services with `kind: 'domain'` and
all of `graphSpec`/`qsmValidated`/`bindings` null. Such services emit only a
UI-aware `manifest.json` + the service's UI assets. Mixed-partial state
throws `DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_PARTIAL:<svc>:missing=<csv>`.

## Tests added
- UI-only domain composes to UI-only manifest.
- Partial state throws PARTIAL.
- Full domain unchanged.

## Gates
- `bun run --filter @rntme/deploy-bundle-input typecheck` → exit 0
- `bun run --filter @rntme/deploy-bundle-input test` → all pass
```

- [ ] **Step 2: Commit**

```bash
git add packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts \
        packages/platform/deploy-bundle-input/test/unit/to-deploy-core-input.test.ts \
        docs/goals/dokploy-platform-e2e-deploy/notes/T006-slice-a-receipt.md
git commit -m "$(cat <<'EOF'
feat(deploy-bundle-input): allow UI-only domain services

Domain services that ship only UI assets (no graphs, qsm, or bindings) now
compose to a UI-only runtime manifest instead of throwing
DEPLOY_EXECUTOR_SERVICE_GRAPHS_NOT_FOUND. Mixed-partial state still throws,
under a new DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_PARTIAL code, so half-defined
services do not slip through silently.

Closes gap 1 of docs/superpowers/specs/2026-05-11-sustained-cutover-thin-platform-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Slice B — BPMN Engine `disabled` Mode

### Task B1: Failing tests for `engine.kind: 'disabled'`

**Files:**
- Test: `apps/cli/test/unit/deploy-engine/load-target.test.ts`

- [ ] **Step 1: Read existing tests**

Run: `cat apps/cli/test/unit/deploy-engine/load-target.test.ts | head -80`

- [ ] **Step 2: Add three failing tests**

Append (adjust import paths if existing tests use a different style):

```ts
describe('load-target workflows.engine.kind disabled', () => {
  it('accepts engine.kind=disabled with no worker section', async () => {
    const file = {
      kind: 'dokploy',
      displayName: 'preview',
      config: { dokployUrl: 'https://dokploy.example.com' },
      secrets: { apiToken: { source: 'env', name: 'TOK' } },
      workflows: { engine: { kind: 'disabled' } },
    };
    const r = await loadTargetFile('/x.json', 'preview', {
      readFile: async () => JSON.stringify(file),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.target.workflows).toBeNull();
  });

  it('rejects engine.kind=disabled if a worker block is present', async () => {
    const file = {
      kind: 'dokploy',
      displayName: 'preview',
      config: { dokployUrl: 'https://dokploy.example.com' },
      secrets: { apiToken: { source: 'env', name: 'TOK' } },
      workflows: { engine: { kind: 'disabled' }, worker: { image: 'foo' } },
    };
    const r = await loadTargetFile('/x.json', 'preview', {
      readFile: async () => JSON.stringify(file),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CLI_DEPLOY_TARGET_FILE_INVALID');
  });

  it('accepts target without a workflows block (workflows=null in result)', async () => {
    const file = {
      kind: 'dokploy',
      displayName: 'preview',
      config: { dokployUrl: 'https://dokploy.example.com' },
      secrets: { apiToken: { source: 'env', name: 'TOK' } },
    };
    const r = await loadTargetFile('/x.json', 'preview', {
      readFile: async () => JSON.stringify(file),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.target.workflows).toBeNull();
  });
});
```

- [ ] **Step 3: Run; expect failure**

Run: `bun run --filter @rntme/cli test -- load-target.test.ts`
Expected: first two tests fail with schema validation errors; the third may
pass (depending on current schema — capture the actual output).

### Task B2: Extend target schema and load mapping

**Files:**
- Modify: `apps/cli/src/deploy-engine/target-schema.ts`
- Modify: `apps/cli/src/deploy-engine/load-target.ts`

- [ ] **Step 1: Replace `WorkflowsTargetSchema` with a union of engine variants**

In `apps/cli/src/deploy-engine/target-schema.ts`, replace the
`WorkflowsTargetSchema` block (lines 28-39) with:

```ts
const WorkflowsEngineOperatonSchema = z.object({
  kind: z.literal('operaton'),
  mode: z.literal('provisioned'),
  image: z.string().min(1),
  adminUserSecretRef: z.string().min(1).optional(),
});

const WorkflowsEngineDisabledSchema = z.object({
  kind: z.literal('disabled'),
});

const WorkflowsOperatonTargetSchema = z.object({
  engine: WorkflowsEngineOperatonSchema,
  worker: z.object({ image: z.string().min(1) }),
  operatonUi: OperatonUiAccessSchema.optional(),
});

const WorkflowsDisabledTargetSchema = z
  .object({
    engine: WorkflowsEngineDisabledSchema,
  })
  .strict();

const WorkflowsTargetSchema = z.union([
  WorkflowsOperatonTargetSchema,
  WorkflowsDisabledTargetSchema,
]);
```

The `.strict()` on the disabled branch is what rejects targets that supply
`engine.kind: 'disabled'` along with a stray `worker` field. We use
`z.union` rather than `z.discriminatedUnion` because Zod's discriminated
union does not key on a nested field (`engine.kind`).

- [ ] **Step 2: Update `buildWorkflowsSection` in `load-target.ts`**

Replace the function with:

```ts
function buildWorkflowsSection(input: FileWorkflows | undefined): Record<string, unknown> | null {
  if (input === undefined) return null;
  if (input.engine.kind === 'disabled') return null;
  const engine: Record<string, unknown> = {
    kind: input.engine.kind,
    mode: input.engine.mode,
    image: input.engine.image,
  };
  if (input.engine.adminUserSecretRef !== undefined) {
    engine.adminUserSecretRef = input.engine.adminUserSecretRef;
  }
  const out: Record<string, unknown> = {
    engine,
    worker: { image: input.worker.image },
  };
  if (input.operatonUi !== undefined) out.operatonUi = input.operatonUi;
  return out;
}
```

If TypeScript complains about `input.worker` being possibly missing under
the union, narrow with `if (input.engine.kind !== 'operaton') return null;`
before reading `input.worker`.

- [ ] **Step 3: Run the failing tests; expect pass**

Run: `bun run --filter @rntme/cli test -- load-target.test.ts`
Expected: all three new tests pass; existing tests still green.

- [ ] **Step 4: Workspace typecheck for cli**

Run: `bun run --filter @rntme/cli typecheck`
Expected: exit 0.

### Task B3: Update fixtures and live target

**Files:**
- Modify: `apps/cli/test/fixtures/target-platform.json`
- Modify: `platform.target.json`

- [ ] **Step 1: Verify current fixture content**

Run: `cat apps/cli/test/fixtures/target-platform.json`

- [ ] **Step 2: Replace the `workflows` block in the fixture**

Replace the existing `workflows` object with:

```json
"workflows": { "engine": { "kind": "disabled" } },
```

- [ ] **Step 3: Replace the `workflows` block in `platform.target.json`**

Edit `platform.target.json`. Replace the existing `workflows` object
(starting with `"workflows": {` and the multi-line body) with:

```json
"workflows": { "engine": { "kind": "disabled" } },
```

Leave the rest of the file untouched.

- [ ] **Step 4: Re-run cli tests including any fixture-reading test**

Run: `bun run --filter @rntme/cli test`
Expected: all green.

### Task B4: Commit Slice B

- [ ] **Step 1: Write the slice receipt**

Create `docs/goals/dokploy-platform-e2e-deploy/notes/T007-slice-b-receipt.md`:

```md
# T007 — Slice B: BPMN engine disabled mode

Date: <today's ISO date>

## Change
Target schema accepts `workflows.engine.kind: 'disabled'`. Disabled engine
causes `buildWorkflowsSection` to emit `workflows: null` in the normalized
target; downstream `deploy-dokploy/workflow-render` already short-circuits
on `engine.kind === 'none'` so no Operaton or worker workload is rendered.

`platform.target.json` switched to disabled mode for thin-bootstrap.

## Tests added
- Disabled with no worker → ok.
- Disabled with stray worker → rejected.
- No workflows block → workflows=null.

## Gates
- `bun run --filter @rntme/cli typecheck` → exit 0
- `bun run --filter @rntme/cli test` → all pass
```

- [ ] **Step 2: Commit**

```bash
git add apps/cli/src/deploy-engine/target-schema.ts \
        apps/cli/src/deploy-engine/load-target.ts \
        apps/cli/test/unit/deploy-engine/load-target.test.ts \
        apps/cli/test/fixtures/target-platform.json \
        platform.target.json \
        docs/goals/dokploy-platform-e2e-deploy/notes/T007-slice-b-receipt.md
git commit -m "$(cat <<'EOF'
feat(cli): workflows.engine.kind disabled for thin platform bootstrap

Target file schema accepts engine.kind='disabled', producing workflows=null
in the normalized target. The existing deploy-dokploy renderer already
short-circuits on engine.kind='none', so no Operaton or BPMN worker is
emitted. platform.target.json switches to disabled mode pending plan-3
introduction of BPMN-orchestrated deploys.

Closes gaps 3 and 5 (for thin mode) of
docs/superpowers/specs/2026-05-11-sustained-cutover-thin-platform-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Slice C — Provisioner Bundling

### Task C1: Failing test for bundle-aware resolver

**Files:**
- Test: `apps/cli/test/unit/deploy-engine/resolve-provisioner.test.ts` (new)

- [ ] **Step 1: Inspect current resolver**

Run: `cat apps/cli/src/deploy-engine/resolve-provisioner.ts`

- [ ] **Step 2: Write the new test file**

Create `apps/cli/test/unit/deploy-engine/resolve-provisioner.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCliResolveProvisioner } from '../../../src/deploy-engine/resolve-provisioner.js';

describe('createCliResolveProvisioner', () => {
  it('loads a provisioner from .provisioners/<sanitized>.entry.js when manifest is present', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-resolve-bundle-'));
    mkdirSync(join(dir, '.provisioners'));
    writeFileSync(
      join(dir, '.provisioners', 'manifest.json'),
      JSON.stringify({ '@rntme/identity-auth0': 'rntme-identity-auth0.entry.js' }),
    );
    writeFileSync(
      join(dir, '.provisioners', 'rntme-identity-auth0.entry.js'),
      'export default { run: async () => ({ outputs: {}, secretOutputs: {} }) };\n',
    );
    const resolve = createCliResolveProvisioner();
    const contract = await resolve('@rntme/identity-auth0', './dist/provisioner.entry.js', dir);
    expect(typeof contract).toBe('object');
    expect(typeof (contract as { run?: unknown }).run).toBe('function');
  });

  it('throws a clear error when manifest is present but the entry file is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-resolve-broken-'));
    mkdirSync(join(dir, '.provisioners'));
    writeFileSync(
      join(dir, '.provisioners', 'manifest.json'),
      JSON.stringify({ '@rntme/identity-auth0': 'rntme-identity-auth0.entry.js' }),
    );
    const resolve = createCliResolveProvisioner();
    await expect(
      resolve('@rntme/identity-auth0', './dist/provisioner.entry.js', dir),
    ).rejects.toThrow(/DEPLOY_PROVISION_BUNDLE_ASSET_MISSING/);
  });

  it('falls back to createRequire when no .provisioners directory exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-resolve-fallback-'));
    writeFileSync(join(dir, 'package.json'), '{"name":"x","version":"0.0.0"}');
    const resolve = createCliResolveProvisioner();
    // No bundled entry, no node_modules — createRequire should fail with
    // its own MODULE_NOT_FOUND, not with a bundle-mode error.
    await expect(
      resolve('@rntme/identity-auth0', './dist/provisioner.entry.js', dir),
    ).rejects.toThrow(/Cannot find|MODULE_NOT_FOUND/);
  });
});
```

- [ ] **Step 3: Run; expect failure**

Run: `bun run --filter @rntme/cli test -- resolve-provisioner.test.ts`
Expected: first two tests fail (resolver does not look at `.provisioners/`
yet); third may pass.

### Task C2: Implement bundle-aware resolver

**Files:**
- Modify: `apps/cli/src/deploy-engine/resolve-provisioner.ts`

- [ ] **Step 1: Replace the resolver with a bundle-aware implementation**

Replace the entire file content with:

```ts
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ProvisionerContract } from '@rntme/deploy-core';
import type { ResolveProvisioner } from '@rntme/deploy-runner';

const BUNDLE_DIR = '.provisioners';

export function createCliResolveProvisioner(): ResolveProvisioner {
  return async (packageName, entry, projectDir) => {
    const bundleManifestPath = join(projectDir, BUNDLE_DIR, 'manifest.json');
    if (existsSync(bundleManifestPath)) {
      const manifest = JSON.parse(readFileSync(bundleManifestPath, 'utf-8')) as Record<string, string>;
      const fileName = manifest[packageName];
      if (fileName !== undefined) {
        const entryPath = join(projectDir, BUNDLE_DIR, fileName);
        if (!existsSync(entryPath)) {
          throw new Error(
            `DEPLOY_PROVISION_BUNDLE_ASSET_MISSING: bundled provisioner entry for ${packageName} not found at ${entryPath}`,
          );
        }
        const mod = (await import(pathToFileURL(entryPath).href)) as
          & { default?: ProvisionerContract }
          & ProvisionerContract;
        if (mod.default && typeof mod.default === 'object') return mod.default;
        return mod;
      }
    }
    const req = createRequire(`${projectDir}/package.json`);
    const resolved = req.resolve(`${packageName}/${entry}`.replace(/\\/g, '/'));
    const mod = (await import(pathToFileURL(resolved).href)) as
      & { default?: ProvisionerContract }
      & ProvisionerContract;
    if (mod.default && typeof mod.default === 'object') return mod.default;
    return mod;
  };
}
```

- [ ] **Step 2: Run the failing tests; expect pass**

Run: `bun run --filter @rntme/cli test -- resolve-provisioner.test.ts`
Expected: all three pass.

- [ ] **Step 3: Wider test pass to confirm no regression**

Run: `bun run --filter @rntme/cli test`
Expected: all green.

### Task C3: Build script that bundles provisioner entries

**Files:**
- Create: `apps/cli/scripts/build-platform-blueprint.cjs`
- Delete: `apps/cli/scripts/copy-platform-blueprint.cjs`
- Modify: `apps/cli/package.json` (postbuild script)

- [ ] **Step 1: Check esbuild availability**

Run: `bun pm ls esbuild 2>&1 | head -20`

If esbuild is not a workspace dep, run:
`bun add -D esbuild --cwd apps/cli`

(esbuild is already used elsewhere in this workspace — check
`grep -r '"esbuild"' package.json apps/*/package.json packages/*/package.json | head -5`
to confirm before adding.)

- [ ] **Step 2: Write the new build script**

Create `apps/cli/scripts/build-platform-blueprint.cjs`:

```js
#!/usr/bin/env bun
/* eslint-env node */
const { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { join, dirname } = require('node:path');

const root = join(__dirname, '..');
const repoRoot = join(root, '..', '..');
const srcBlueprint = join(repoRoot, 'apps', 'platform', 'blueprint');
const destBlueprint = join(root, 'dist', 'platform-blueprint');
const provisionersDir = join(destBlueprint, '.provisioners');

if (!existsSync(srcBlueprint)) {
  console.error(`platform blueprint source not found: ${srcBlueprint}`);
  process.exit(1);
}

// Step 1: copy the blueprint tree (JSON + BPMN + UI assets), skipping
// node_modules / test / dist.
cpSync(srcBlueprint, destBlueprint, {
  recursive: true,
  filter: (entry) => {
    const rel = entry.slice(srcBlueprint.length + 1);
    if (rel === 'node_modules' || rel.startsWith('node_modules/')) return false;
    if (rel === 'test' || rel.startsWith('test/')) return false;
    if (rel === 'dist' || rel.startsWith('dist/')) return false;
    return true;
  },
});

// Step 2: read project.json to discover modules.
const project = JSON.parse(readFileSync(join(destBlueprint, 'project.json'), 'utf-8'));
const modules = (project && typeof project === 'object' && project.modules) || {};

// Step 3: for each module, resolve its module.json on disk and bundle the
// provisioner entry if present.
const manifest = {};
const bundleSrc = require('esbuild');

(async () => {
  // Recreate provisioners dir from scratch
  if (existsSync(provisionersDir)) rmSync(provisionersDir, { recursive: true, force: true });
  mkdirSync(provisionersDir, { recursive: true });

  for (const [projectKey, decl] of Object.entries(modules)) {
    const packageAlias = decl && typeof decl === 'object' && decl.package;
    if (typeof packageAlias !== 'string' || packageAlias.length === 0) continue;
    const modulePath = resolveModulePath(packageAlias, repoRoot);
    if (modulePath === null) {
      throw new Error(`build-platform-blueprint: cannot resolve module path for ${packageAlias}`);
    }
    const moduleManifest = JSON.parse(readFileSync(join(modulePath, 'module.json'), 'utf-8'));
    const provisioner = moduleManifest && moduleManifest.provisioner;
    if (!provisioner || typeof provisioner.entry !== 'string') {
      // Not all modules have a provisioner — that is fine.
      continue;
    }
    const entrySrcRelative = provisioner.entry.replace(/^\.\//, '');
    const entrySrc = join(modulePath, entrySrcRelative);
    if (!existsSync(entrySrc)) {
      throw new Error(
        `build-platform-blueprint: provisioner entry for ${moduleManifest.name} not built at ${entrySrc} — run package build first`,
      );
    }
    const safe = moduleManifest.name.replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '');
    const outFile = `${safe}.entry.js`;
    const outPath = join(provisionersDir, outFile);
    await bundleSrc.build({
      entryPoints: [entrySrc],
      outfile: outPath,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node20',
      logLevel: 'warning',
    });
    manifest[moduleManifest.name] = outFile;
    console.log(`bundled ${moduleManifest.name} → .provisioners/${outFile}`);
  }

  writeFileSync(join(provisionersDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`copied ${srcBlueprint} → ${destBlueprint}`);
  console.log(`wrote ${join(provisionersDir, 'manifest.json')} with ${Object.keys(manifest).length} entries`);
})().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});

function resolveModulePath(packageAlias, repoRoot) {
  // Same convention as discoverModules: rntme_<category>_<vendor> →
  // modules/<category>/<vendor>/
  const m = /^rntme_([a-z0-9]+)_([a-z0-9-]+)$/.exec(packageAlias);
  if (m === null) return null;
  const path = join(repoRoot, 'modules', m[1], m[2]);
  if (!existsSync(join(path, 'module.json'))) return null;
  return path;
}
```

- [ ] **Step 3: Update `apps/cli/package.json` postbuild reference**

In `apps/cli/package.json`, change the postbuild script. Replace
`bun scripts/copy-platform-blueprint.cjs` with
`bun scripts/build-platform-blueprint.cjs`.

- [ ] **Step 4: Delete the old script**

Run: `git rm apps/cli/scripts/copy-platform-blueprint.cjs`

- [ ] **Step 5: Test the build script end-to-end**

```bash
bun run --filter @rntme/identity-auth0 build
bun run --filter @rntme/cli build
ls apps/cli/dist/platform-blueprint/.provisioners/
cat apps/cli/dist/platform-blueprint/.provisioners/manifest.json
```

Expected: `manifest.json` lists `@rntme/identity-auth0`,
and there is a `rntme-identity-auth0.entry.js` file (a bundled ESM file
of non-trivial size).

If the auth0 module's `dist/` is missing, the build script should fail
loudly per its own error — that is the intended behaviour.

### Task C4: Smoke test bundled provisioner load

- [ ] **Step 1: Run a small node script to verify the bundle imports**

```bash
cd /home/coder/project
bun -e "import('./apps/cli/dist/platform-blueprint/.provisioners/rntme-identity-auth0.entry.js').then(m => console.log('default kind:', typeof m.default, 'has run:', typeof (m.default && m.default.run)))"
```

Expected output: `default kind: object has run: function` (or similar — the
exact shape depends on the provisioner contract, but `run` must be a
function).

If the import fails with `Cannot find module '...'`, the esbuild config is
not bundling something it should. Re-run with `--external:` whitelisted
deps only if absolutely required; default should be full bundle.

### Task C5: Commit Slice C

- [ ] **Step 1: Write the slice receipt**

Create `docs/goals/dokploy-platform-e2e-deploy/notes/T008-slice-c-receipt.md`:

```md
# T008 — Slice C: Provisioner bundling

Date: <today's ISO date>

## Change
- New `apps/cli/scripts/build-platform-blueprint.cjs` replaces
  `copy-platform-blueprint.cjs`. It copies the blueprint tree (existing
  behaviour) and additionally bundles each module's `provisioner.entry`
  into `apps/cli/dist/platform-blueprint/.provisioners/<safe-name>.entry.js`
  via esbuild (esm, node20). A `.provisioners/manifest.json` indexes
  packageName → file.
- `createCliResolveProvisioner` now checks `.provisioners/manifest.json`
  before `createRequire`. Bundled entries are loaded by direct file URL;
  missing bundled assets throw `DEPLOY_PROVISION_BUNDLE_ASSET_MISSING`.

## Tests added
- bundle hit, missing asset, fallback to createRequire (3 tests).

## Gates
- `bun run --filter @rntme/cli typecheck` → exit 0
- `bun run --filter @rntme/cli test` → all pass
- manual smoke: `apps/cli/dist/platform-blueprint/.provisioners/rntme-identity-auth0.entry.js` imports with `run: function`

## Memory updates
- `rntme_provisioner_resolver_gap` resolved by this slice — flag for
  removal/update during goal close.
- `rntme_blueprint_vars_vs_provisioner` already stale (two-pass works in
  the codebase); update or remove during goal close.
```

- [ ] **Step 2: Commit**

```bash
git add apps/cli/scripts/build-platform-blueprint.cjs \
        apps/cli/package.json \
        apps/cli/src/deploy-engine/resolve-provisioner.ts \
        apps/cli/test/unit/deploy-engine/resolve-provisioner.test.ts \
        docs/goals/dokploy-platform-e2e-deploy/notes/T008-slice-c-receipt.md
git add -u apps/cli/scripts/copy-platform-blueprint.cjs  # records deletion
git commit -m "$(cat <<'EOF'
feat(cli): bundle module provisioner entries into platform blueprint dist

The CLI build now bundles each module's provisioner.entry.js (e.g.
@rntme/identity-auth0) into apps/cli/dist/platform-blueprint/.provisioners/
via esbuild and indexes them in a manifest. The CLI provisioner resolver
prefers the bundled entry when a manifest is present and falls back to
createRequire for dev mode where node_modules is resolvable from the
project dir. This unblocks `rntme platform up` from a published CLI dist
where node_modules cannot be relied on at the blueprint path.

Closes gap 2 of docs/superpowers/specs/2026-05-11-sustained-cutover-thin-platform-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Slice D — Live Deploy and Verify

This slice has no code changes. It is a runbook to be executed against live
Dokploy and Auth0 with the `platform.rntme.com` target.

### Task D1: Pre-flight checks

- [ ] **Step 1: Confirm clean workspace and green build**

```bash
git status --short
bun run typecheck
bun run lint
bun run test
bun run depcruise
```

Expected: working tree clean (only the slice-D receipt to be created later);
all four gates exit 0.

- [ ] **Step 2: Confirm required env vars are present**

```bash
test -n "$DOKPLOY_API_KEY" && echo "DOKPLOY_API_KEY ok" || echo "MISSING DOKPLOY_API_KEY"
test -n "$AUTH0_DOMAIN" && echo "AUTH0_DOMAIN ok" || echo "MISSING AUTH0_DOMAIN"
test -n "$AUTH0_MANAGEMENT_CLIENT_ID" && echo "AUTH0_MANAGEMENT_CLIENT_ID ok" || echo "MISSING AUTH0_MANAGEMENT_CLIENT_ID"
test -n "$AUTH0_MANAGEMENT_CLIENT_SECRET" && echo "AUTH0_MANAGEMENT_CLIENT_SECRET ok" || echo "MISSING AUTH0_MANAGEMENT_CLIENT_SECRET"
```

All four must say "ok". If any missing, stop and ask the operator to set
the missing env var (do not invent values).

- [ ] **Step 3: Inspect current Dokploy state**

Use the dokploy MCP (`mcp__dokploy__application-search` and
`mcp__dokploy__compose-search`) to list workloads currently attached to
`dokployProjectId` from `platform.target.json`. Capture the list — Slice D
will append a "before" snapshot to the receipt.

If a previous attempt left stale workloads, **do not delete them
unilaterally** — confirm with the operator first.

### Task D2: Dry-run platform up

- [ ] **Step 1: Run dry-run**

```bash
cd /home/coder/project
bun run --filter @rntme/cli build
./apps/cli/dist/bin/cli.js platform up --target ./platform.target.json --dry-run --json | tee /tmp/platform-up-dryrun.json
```

Expected: exits 0; the JSON output covers compose / provision / plan /
render stages; the plan section has no workload with `kind: 'bpmn-worker'`
and no infrastructure `workflowEngine`; `AUTH0_SPA_CLIENT_ID` resolves to
a non-empty string.

- [ ] **Step 2: Capture the dry-run summary**

Save `/tmp/platform-up-dryrun.json` to
`docs/goals/dokploy-platform-e2e-deploy/notes/platform-up-dryrun.json`
(overwrite any existing file from earlier attempts).

If dry-run fails, **stop** — slice D is an operational verification, not a
debugging task. Hand back to brainstorming with the dry-run error.

### Task D3: Live platform up

- [ ] **Step 1: Apply**

```bash
./apps/cli/dist/bin/cli.js platform up --target ./platform.target.json --json | tee /tmp/platform-up-apply.json
```

Expected: all stages green. Capture the JSON.

If any stage fails, save the output and stop. Open a brainstorming session
to triage the failure rather than patching ad-hoc.

### Task D4: Verify

- [ ] **Step 1: HTTPS reachability and HTML body**

```bash
curl -is https://platform.rntme.com/ | head -20
```

Expected: HTTP/2 200, content-type `text/html`, body starts with
`<!doctype html>` (or equivalent).

- [ ] **Step 2: API requires auth**

```bash
curl -is https://platform.rntme.com/api/organizations | head -5
```

Expected: HTTP/2 401.

- [ ] **Step 3: Auth0 SPA login (manual)**

Open `https://platform.rntme.com/` in a browser. Confirm:

- Redirect to `https://<AUTH0_DOMAIN>/authorize?...` with the SPA client id.
- After login, redirect back to `https://platform.rntme.com/auth/callback`.
- UI mounts an authenticated state.

Capture the SPA client id surfaced in the URL — it must match the
`provision.identity.spaClient.id` output from the apply step.

- [ ] **Step 4: API with token (manual)**

In the browser dev tools, copy a `Bearer` token from a successful API call
made by the loaded UI. Then:

```bash
curl -is -H "Authorization: Bearer <token>" https://platform.rntme.com/api/organizations | head -10
```

Expected: HTTP/2 200, JSON body with at least the operator's organization.

- [ ] **Step 5: Container logs sanity**

For each workload listed in the apply output, fetch logs via the dokploy
MCP `mcp__dokploy__application-readLogs` (or `compose-readLogs` for
compose-rendered services). Confirm no `ERROR`-level entries from the
deploy window.

### Task D5: Final receipt and goal completion

- [ ] **Step 1: Write the success receipt**

Create `docs/goals/dokploy-platform-e2e-deploy/notes/T009-platform-up-success.md`:

```md
# T009 — Platform up success

Date: <today's ISO date>

## Outcome
`rntme platform up --target ./platform.target.json` completes against live
Dokploy at https://platform.rntme.com/. Auth0 SPA login flow works.

## Evidence

- Dry-run JSON: docs/goals/dokploy-platform-e2e-deploy/notes/platform-up-dryrun.json
- Apply JSON snippet (stage timings + applied resources): <paste>
- curl HEAD on /: HTTP/2 200, content-type text/html
- curl HEAD on /api/organizations no token: HTTP/2 401
- Browser SPA login: completed, callback URL matches target.auth.auth0.redirectUri
- curl GET /api/organizations with token: HTTP/2 200, body lists org <slug>
- MCP logs: no ERROR entries on any workload during the deploy window

## Gaps closed
- Gap 1 (UI-only): Slice A
- Gap 2 (provisioner bundling): Slice C
- Gap 3 (BPMN worker): Slice B (disabled mode bypasses)
- Gap 4 (migrations): empirical pass — runtime auto-bootstraps SQLite
- Gap 5 (target_secrets): Slice B (disabled mode bypasses Operaton)

## Stale memories to clean up post-goal
- rntme_provisioner_resolver_gap — resolved by Slice C
- rntme_blueprint_vars_vs_provisioner — already stale, Slice C documents
- T005-partial-receipt-stop.md — superseded by T006-T009
```

- [ ] **Step 2: Update `state.yaml`**

Open `docs/goals/dokploy-platform-e2e-deploy/state.yaml`. Append (or update)
a final audit section setting `full_outcome_complete: true` and linking
T006-T009 receipts. Follow the exact yaml structure the goal-loop uses
elsewhere in the file — do not invent new keys.

- [ ] **Step 3: Commit**

```bash
git add docs/goals/dokploy-platform-e2e-deploy/notes/T009-platform-up-success.md \
        docs/goals/dokploy-platform-e2e-deploy/notes/platform-up-dryrun.json \
        docs/goals/dokploy-platform-e2e-deploy/state.yaml
git commit -m "$(cat <<'EOF'
docs(goal): platform up succeeds against live Dokploy

Slice D of the sustained-cutover plan completes. Auth0 SPA login flow
verified; /api/* enforces bearer auth; logs clean. Goal
dokploy-platform-e2e-deploy now full_outcome_complete: true.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

The plan covers the four spec slices. Spec-level open items reconciled:

- "two-pass vs reorder" (spec): already implemented as reorder
  (`compose → provision → plan`) in `run-deployment.ts`. Plan does not
  introduce new var-resolution code. Noted in Pre-existing state.
- "bundle root resolution under npm install vs workspace dev" (spec):
  resolved by Slice C2's `.provisioners/manifest.json` lookup that works
  identically in both modes — the bundle path is always relative to
  `projectDir`.
- "exact filename of vars resolution code": no longer needed; we do not
  touch vars resolution.
- "engine discriminator placement": Slice B settles it as `target.workflows.engine`.

No placeholders, every code block contains executable content, type names
are consistent (`createCliResolveProvisioner`, `buildWorkflowsSection`,
`buildRuntimeArtifactFiles`, `buildUiOnlyRuntimeFiles`,
`DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_PARTIAL`,
`DEPLOY_PROVISION_BUNDLE_ASSET_MISSING`).
