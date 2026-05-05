# Pipeline Reorder (PR3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the provisioner stage **before** blueprint vars resolve, so vars can pull values from `provisionResult` (e.g., `AUTH0_SPA_CLIENT_ID` from the freshly-created Auth0 SPA client). New var source kind: `from: "provision.<moduleKey>.<output>.<jsonPointer>"`. Notes-demo no longer requires `target.auth.auth0.clientId` to be pre-filled.

**Architecture:** Reorder executor stages from `plan → provision → render` to `provision → plan → render`. `buildProjectDeploymentPlan` takes a new optional third arg `options.provisionResult`. `resolveVars` (in `packages/deploy/deploy-core/src/vars.ts`) extends `readPath` to handle `provision.*` paths against an injected provisionResult shape. Existing `target.*` paths unchanged. Existing `runProvisioners` and `renderDokployPlan` signatures unchanged. The eventBus log message moves out of post-plan into pre-provision (using `config.eventBus.mode` directly).

**Tech Stack:** TypeScript, Vitest, deploy-core/deploy-dokploy/platform-http packages.

**Spec reference:** `docs/superpowers/specs/2026-05-04-notes-demo-fresh-tenant-deployable-design.md` §5.

**File map:**
- `packages/deploy/deploy-core/src/vars.ts` — extend `readPath` and `resolveVars` for `provision.*` source.
- `packages/deploy/deploy-core/src/plan.ts` — `buildProjectDeploymentPlan` accepts `options.provisionResult`.
- `packages/deploy/deploy-core/src/errors.ts` — five new error codes.
- `apps/platform-http/src/deploy/executor.ts` — reorder stages.
- `demo/notes-blueprint/project.json` — `vars.AUTH0_SPA_CLIENT_ID.from` change.
- `packages/deploy/deploy-core/test/unit/vars.test.ts` — extended.
- `packages/deploy/deploy-core/test/unit/plan.test.ts` — adapt and add provisionResult tests.
- `apps/platform-http/test/unit/deploy/executor.test.ts` — adapt to new stage order.
- `packages/deploy/deploy-core/README.md` — document `provision.*` source.
- `apps/platform-http/README.md` — new stage order + `application-readLogs` MCP fallback runbook.
- `AGENTS.md §6` — how-to declare a `provision.*` var.
- `docs/superpowers/specs/2026-05-03-provisioner-bundle-transport-design.md` — mark §15 follow-up resolved.

---

### Task 1: Extend `resolveVars` to accept `provisionResult`

**Files:**
- Modify: `packages/deploy/deploy-core/src/vars.ts`
- Test: `packages/deploy/deploy-core/test/unit/vars.test.ts`

- [ ] **Step 1: Read the current shape**

```bash
sed -n '1,20p' packages/deploy/deploy-core/src/vars.ts
```

- [ ] **Step 2: Locate the existing test file**

```bash
ls packages/deploy/deploy-core/test/unit/ | grep vars
```

If `vars.test.ts` doesn't exist, create it (Step 4 below).

- [ ] **Step 3: Define provision-result shape and signature change**

Edit `packages/deploy/deploy-core/src/vars.ts`. Add after the existing `TargetForVars` type:

```ts
export type ProvisionResultForVars = {
  readonly modules: Readonly<Record<string, {
    readonly publicOutputs: Readonly<Record<string, unknown>>;
  }>>;
};

export type DiscoveredModulesForVars = Readonly<Record<string, {
  /** module.json `provisioner.produces[*].name` whitelist for validation. */
  readonly producesNames: readonly string[];
}>>;

export type ResolveVarsOptions = {
  readonly provisionResult?: ProvisionResultForVars;
  readonly discoveredModules?: DiscoveredModulesForVars;
};
```

Change `resolveVars` signature:

```ts
export function resolveVars(
  manifest: VarsManifest,
  target: TargetForVars,
  options: ResolveVarsOptions = {},
): Result<ResolvedVars> {
```

- [ ] **Step 4: Replace `readPath` to handle `provision.*` paths**

Replace the existing `readPath` function (lines ~55-65 in vars.ts) with:

```ts
type ReadPathResult =
  | { kind: 'value'; value: unknown }
  | { kind: 'error'; error: DeploymentPlanError };

function readPath(
  target: TargetForVars,
  path: string,
  varName: string,
  options: ResolveVarsOptions,
): ReadPathResult {
  const segments = path.split('.');

  if (segments[0] === 'target') {
    let cursor: unknown = target;
    for (const seg of segments.slice(1)) {
      if (cursor === null || typeof cursor !== 'object') {
        return { kind: 'value', value: undefined };
      }
      cursor = (cursor as Record<string, unknown>)[seg];
    }
    return { kind: 'value', value: cursor };
  }

  if (segments[0] === 'provision') {
    // Shape: provision.<moduleKey>.<output>.<jsonPointer...>
    if (segments.length < 3) {
      return {
        kind: 'error',
        error: {
          code: 'BLUEPRINT_VAR_PROVISION_PATH_INVALID',
          message: `vars.${varName}: provision path must be "provision.<moduleKey>.<output>[.<...>]", got "${path}"`,
          varName,
          fromPath: path,
          targetSlug: target.slug,
        } as DeploymentPlanError,
      };
    }
    const moduleKey = segments[1]!;
    const outputName = segments[2]!;
    const jsonPointer = segments.slice(3);

    const discoveredEntry = options.discoveredModules?.[moduleKey];
    if (options.discoveredModules !== undefined && discoveredEntry === undefined) {
      return {
        kind: 'error',
        error: {
          code: 'BLUEPRINT_VAR_PROVISION_MODULE_MISSING',
          message: `vars.${varName}: module key "${moduleKey}" is not declared in project.json#modules`,
          varName,
          fromPath: path,
          targetSlug: target.slug,
        } as DeploymentPlanError,
      };
    }

    if (
      discoveredEntry !== undefined &&
      !discoveredEntry.producesNames.includes(outputName)
    ) {
      return {
        kind: 'error',
        error: {
          code: 'BLUEPRINT_VAR_PROVISION_OUTPUT_NOT_DECLARED',
          message: `vars.${varName}: module "${moduleKey}" provisioner does not declare output "${outputName}"`,
          varName,
          fromPath: path,
          targetSlug: target.slug,
        } as DeploymentPlanError,
      };
    }

    const moduleResult = options.provisionResult?.modules[moduleKey];
    if (moduleResult === undefined) {
      return {
        kind: 'error',
        error: {
          code: 'BLUEPRINT_VAR_PROVISION_OUTPUT_MISSING',
          message: `vars.${varName}: provisioner did not run or produced no output for module "${moduleKey}"`,
          varName,
          fromPath: path,
          targetSlug: target.slug,
        } as DeploymentPlanError,
      };
    }

    let cursor: unknown = moduleResult.publicOutputs[outputName];
    for (const seg of jsonPointer) {
      if (cursor === null || typeof cursor !== 'object') {
        return {
          kind: 'error',
          error: {
            code: 'BLUEPRINT_VAR_PROVISION_PATH_NOT_FOUND',
            message: `vars.${varName}: pointer "${jsonPointer.join('.')}" did not resolve in publicOutputs.${outputName}`,
            varName,
            fromPath: path,
            targetSlug: target.slug,
          } as DeploymentPlanError,
        };
      }
      cursor = (cursor as Record<string, unknown>)[seg];
    }

    return { kind: 'value', value: cursor };
  }

  return { kind: 'value', value: undefined };
}
```

- [ ] **Step 5: Update `resolveVars` body to consume the result**

In the `for` loop body, replace the existing call to `readPath(target, binding.from)` and the value-or-error chain with:

```ts
  for (const [name, binding] of Object.entries(manifest)) {
    const r = readPath(target, binding.from, name, options);
    if (r.kind === 'error') {
      errors.push(r.error);
      continue;
    }
    const value = r.value;
    if (value === undefined || value === '') {
      if (binding.required) {
        errors.push({
          code: 'DEPLOY_PLAN_TARGET_VAR_MISSING',
          message: `vars.${name}: target ${target.slug} does not provide "${binding.from}"`,
          varName: name,
          fromPath: binding.from,
          targetSlug: target.slug,
        });
      }
      continue;
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      errors.push({
        code: 'DEPLOY_PLAN_VAR_FROM_PATH_INVALID',
        message: `vars.${name}: target ${target.slug} value at "${binding.from}" is not a primitive`,
        varName: name,
        fromPath: binding.from,
        targetSlug: target.slug,
      });
      continue;
    }
    out[name] = String(value);
  }
```

(Reuse existing logic; the only change is the `readPath` call shape.)

- [ ] **Step 6: Run typecheck — expect failures in plan.ts (next task)**

Run: `pnpm -F @rntme/deploy-core typecheck`
Expected: errors pointing at `plan.ts` calling `resolveVars` without options. That's fine; Task 2 fixes it.

- [ ] **Step 7: Commit (intermediate)**

```bash
git add packages/deploy/deploy-core/src/vars.ts
git commit -m "feat(deploy-core): resolveVars accepts options.provisionResult

Adds the new 'provision.<moduleKey>.<output>.<jsonPointer>' source kind.
Five new error codes for path validation. Existing 'target.*' callers
remain compatible (options is defaulted to {}); plan.ts call site
updated in follow-up commit."
```

---

### Task 2: Add new error codes to `errors.ts`

**Files:**
- Modify: `packages/deploy/deploy-core/src/errors.ts`

- [ ] **Step 1: Read existing error type**

```bash
grep -n "code:" packages/deploy/deploy-core/src/errors.ts | head -20
```

- [ ] **Step 2: Add the five new codes to the union**

In `packages/deploy/deploy-core/src/errors.ts`, locate `DeploymentPlanError` (or whatever the union is) and add to the `code:` literal-string union:

```ts
| 'BLUEPRINT_VAR_PROVISION_PATH_INVALID'
| 'BLUEPRINT_VAR_PROVISION_MODULE_MISSING'
| 'BLUEPRINT_VAR_PROVISION_OUTPUT_NOT_DECLARED'
| 'BLUEPRINT_VAR_PROVISION_OUTPUT_MISSING'
| 'BLUEPRINT_VAR_PROVISION_PATH_NOT_FOUND'
```

If the file uses a `const ERROR_CODES = { ... } as const` registry pattern, add the same five names there as well.

- [ ] **Step 3: Run typecheck**

Run: `pnpm -F @rntme/deploy-core typecheck`
Expected: vars.ts no longer flags the unknown error codes. plan.ts may still error from Task 1 — Task 3 fixes it.

- [ ] **Step 4: Commit**

```bash
git add packages/deploy/deploy-core/src/errors.ts
git commit -m "feat(deploy-core): five error codes for provision.* var resolution"
```

---

### Task 3: Wire provisionResult through `buildProjectDeploymentPlan`

**Files:**
- Modify: `packages/deploy/deploy-core/src/plan.ts:110-188`

- [ ] **Step 1: Read the current call site**

```bash
sed -n '110,160p' packages/deploy/deploy-core/src/plan.ts
```

- [ ] **Step 2: Add options parameter**

Replace the function signature:

```ts
export function buildProjectDeploymentPlan(
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
): Result<ProjectDeploymentPlan, DeploymentPlanError> {
```

with:

```ts
import type { ProvisionResultForVars, DiscoveredModulesForVars } from './vars.js';

export type BuildPlanOptions = {
  readonly provisionResult?: ProvisionResultForVars;
  readonly discoveredModules?: DiscoveredModulesForVars;
};

export function buildProjectDeploymentPlan(
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
  options: BuildPlanOptions = {},
): Result<ProjectDeploymentPlan, DeploymentPlanError> {
```

(Adjust the `import` placement to the top of the file with other imports; merge with the existing `import { resolveVars, applyVars, ... } from './vars.js';` line.)

- [ ] **Step 3: Pass options into `resolveVars`**

Locate line 114:
```ts
  const resolved = resolveVars(project.varsManifest ?? {}, targetForVars(config, project.name));
```

Replace with:
```ts
  const resolved = resolveVars(
    project.varsManifest ?? {},
    targetForVars(config, project.name),
    {
      ...(options.provisionResult ? { provisionResult: options.provisionResult } : {}),
      ...(options.discoveredModules ? { discoveredModules: options.discoveredModules } : {}),
    },
  );
```

- [ ] **Step 4: Export the new type from index**

In `packages/deploy/deploy-core/src/index.ts`, add to the `export { buildProjectDeploymentPlan, ... } from './plan.js'` re-export:

```ts
export type { BuildPlanOptions } from './plan.js';
export type { ProvisionResultForVars, DiscoveredModulesForVars } from './vars.js';
```

- [ ] **Step 5: Run typecheck and tests**

Run: `pnpm -F @rntme/deploy-core typecheck && pnpm -F @rntme/deploy-core test`
Expected: typecheck green; existing tests green (the new options arg defaults to `{}`, so old call sites work unchanged).

- [ ] **Step 6: Commit**

```bash
git add packages/deploy/deploy-core/src/plan.ts packages/deploy/deploy-core/src/index.ts
git commit -m "feat(deploy-core): buildProjectDeploymentPlan accepts options.provisionResult

Existing call sites (no options) keep current behavior. The new option
is consumed by resolveVars to handle provision.* var sources."
```

---

### Task 4: Unit tests for resolveVars `provision.*` paths

**Files:**
- Modify (or create): `packages/deploy/deploy-core/test/unit/vars.test.ts`

- [ ] **Step 1: Create or extend the test file**

Replace the file with (or append, if it exists, after deduping):

```ts
import { describe, it, expect } from 'vitest';
import { resolveVars } from '../../src/vars.js';

const target = { slug: 'demo', auth: { auth0: { domain: 'tenant.auth0.com' } } };

describe('resolveVars target.* sources', () => {
  it('resolves a target.* path', () => {
    const r = resolveVars(
      { AUTH0_DOMAIN: { from: 'target.auth.auth0.domain', required: true } },
      target,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.AUTH0_DOMAIN).toBe('tenant.auth0.com');
  });

  it('errors on missing required target.* path', () => {
    const r = resolveVars(
      { MISSING: { from: 'target.auth.unknown', required: true } },
      target,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('DEPLOY_PLAN_TARGET_VAR_MISSING');
  });
});

describe('resolveVars provision.* sources', () => {
  const provisionResult = {
    modules: {
      identity: {
        publicOutputs: {
          spaClient: { id: 'spa_abc', name: 'Notes Demo' },
          resourceServer: { id: 'rs_xyz', identifier: 'https://notes-demo.rntme.com/api' },
        },
      },
    },
  };

  const discoveredModules = {
    identity: { producesNames: ['spaClient', 'resourceServer'] },
  };

  it('resolves a provision.<moduleKey>.<output>.<path>', () => {
    const r = resolveVars(
      { AUTH0_SPA_CLIENT_ID: { from: 'provision.identity.spaClient.id', required: true } },
      target,
      { provisionResult, discoveredModules },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.AUTH0_SPA_CLIENT_ID).toBe('spa_abc');
  });

  it('errors with PROVISION_PATH_INVALID for a malformed path', () => {
    const r = resolveVars(
      { BAD: { from: 'provision.identity', required: true } },
      target,
      { provisionResult, discoveredModules },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_PATH_INVALID');
  });

  it('errors with PROVISION_MODULE_MISSING when discoveredModules lacks the key', () => {
    const r = resolveVars(
      { X: { from: 'provision.unknownModule.foo.bar', required: true } },
      target,
      { provisionResult, discoveredModules },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_MODULE_MISSING');
  });

  it('errors with PROVISION_OUTPUT_NOT_DECLARED when output not in produces', () => {
    const r = resolveVars(
      { X: { from: 'provision.identity.unknownOutput.id', required: true } },
      target,
      { provisionResult, discoveredModules },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_OUTPUT_NOT_DECLARED');
  });

  it('errors with PROVISION_OUTPUT_MISSING when provisioner did not run for this module', () => {
    const r = resolveVars(
      { X: { from: 'provision.identity.spaClient.id', required: true } },
      target,
      {
        provisionResult: { modules: {} },
        discoveredModules,
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_OUTPUT_MISSING');
  });

  it('errors with PROVISION_PATH_NOT_FOUND when JSON pointer dead-ends', () => {
    const r = resolveVars(
      { X: { from: 'provision.identity.spaClient.notAField.deeper', required: true } },
      target,
      { provisionResult, discoveredModules },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_PATH_NOT_FOUND');
  });

  it('returns undefined (not error) for non-required missing target.* with no error code', () => {
    const r = resolveVars(
      { X: { from: 'target.auth.optional', required: false } },
      target,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.X).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm -F @rntme/deploy-core test vars`
Expected: 7+ test cases all green.

- [ ] **Step 3: Commit**

```bash
git add packages/deploy/deploy-core/test/unit/vars.test.ts
git commit -m "test(deploy-core): provision.* var source resolution and error codes"
```

---

### Task 5: Reorder executor stages (provision before plan)

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts:170-300`

- [ ] **Step 1: Read the current ordering carefully**

```bash
sed -n '172,300p' apps/platform-http/src/deploy/executor.ts
```

Note these key blocks:
- (a) lines ~175-184: `plan` stage — calls `buildProjectDeploymentPlan(deployInput, config)`.
- (b) lines ~186-197: log message branching on `plan.value.infrastructure.eventBus.mode`.
- (c) lines ~199-267: `provision` stage — populates `provisioned` and `persistence`.
- (d) lines ~269-282: env-mappings loop.
- (e) lines ~283-300: `render` stage.

- [ ] **Step 2: Move log message (b) to use config directly, before provision**

Replace (b) with:

```ts
    const eventBusModeForLog =
      config.eventBus === undefined ? 'unknown' :
      config.eventBus.mode === 'provisioned' ? 'provisioned' :
      config.eventBus.mode === 'in-memory' ? 'in-memory' : 'external';
    const eventBusLogMessage =
      eventBusModeForLog === 'provisioned' ? 'Provisioning Redpanda event bus' :
      eventBusModeForLog === 'in-memory' ? 'Using in-memory event bus' :
      eventBusModeForLog === 'external' ? 'Using external Kafka/Redpanda event bus' :
      'Event bus mode unspecified';
    await appendLog(deps, deploymentId, orgId, 'info', 'plan', eventBusLogMessage);
```

This lets us log the bus mode before `plan` runs.

- [ ] **Step 3: Cut the provision block (c) and move it before plan**

The new order is: discover provModules + (config-based bus log) + run provisioners + plan + render.

Replace lines `(a)`-`(e)` (i.e., from `const plan = ...` through end of render stage) with this restructured sequence:

```ts
    if (tmpDir === null) throw new Error('tmpDir not initialized');
    const materializedDir: string = tmpDir;
    const provModules = collectProvisionerModules(composed.value, materializedDir);

    // Bus mode log moved out of plan (was post-plan; now pre-provision).
    const eventBusModeForLog =
      config.eventBus === undefined ? 'unknown' :
      config.eventBus.mode === 'provisioned' ? 'provisioned' :
      config.eventBus.mode === 'in-memory' ? 'in-memory' : 'external';
    const eventBusLogMessage =
      eventBusModeForLog === 'provisioned' ? 'Provisioning Redpanda event bus' :
      eventBusModeForLog === 'in-memory' ? 'Using in-memory event bus' :
      eventBusModeForLog === 'external' ? 'Using external Kafka/Redpanda event bus' :
      'Event bus mode unspecified';
    await appendLog(deps, deploymentId, orgId, 'info', 'plan', eventBusLogMessage);

    let provisioned: ReadonlyMap<string, ProvisionedModule> = new Map();
    let provisionResultForPlan: { modules: Record<string, { publicOutputs: Record<string, unknown> }> } | undefined;
    let discoveredModulesForPlan: Record<string, { producesNames: string[] }> | undefined;

    if (provModules.length > 0) {
      // Build discoveredModules input for plan-time var validation.
      // DiscoveredProvisionerModule has `manifest: ModuleManifest` directly
      // (see packages/deploy/deploy-core/src/provision.ts).
      discoveredModulesForPlan = {};
      for (const m of provModules) {
        const names = m.manifest.provisioner?.produces.map((p) => p.name) ?? [];
        discoveredModulesForPlan[m.projectKey] = { producesNames: names };
      }

      await appendLog(deps, deploymentId, orgId, 'info', 'provision', 'Resolving target secrets');
      const targetSecretsRepo = await deps.targetSecretsRepoFor(orgId);
      const decrypted = await targetSecretsRepo.getAllDecrypted(target.id);

      const priorOutputs = await deps.lastSuccessfulProvisionOutputs(deploymentId);

      await appendLog(deps, deploymentId, orgId, 'info', 'provision', `Provisioning ${provModules.length} module(s)`);
      const startedAt = new Date().toISOString();
      const provisionResult = await runStage(
        'provision',
        async () =>
          (deps.runProvisioners ?? runProvisioners)({
            modules: provModules.map((m) => {
              const prior = priorOutputs[m.projectKey];
              return prior === undefined ? m : { ...m, priorOutputs: prior };
            }),
            resolvedTargetSecrets: decrypted,
            projectDir: materializedDir,
            resolveProvisioner: deps.resolveProvisioner,
            log: (e) => void appendLog(deps, deploymentId, orgId, e.level, e.step, redact(e.message)),
          }),
        { log },
      );
      if (!provisionResult.ok) {
        await finalize(deps, deploymentId, orgId, 'failed', {
          errorCode: provisionResult.errors[0]?.code ?? 'DEPLOY_PROVISION_UNKNOWN',
          errorMessage: redact(errorSummary(provisionResult.errors)),
        });
        return;
      }
      const finishedAt = new Date().toISOString();

      const moduleMap = new Map<string, ProvisionedModule>();
      const persistence: DeploymentProvisionResult = { modules: {}, startedAt, finishedAt };
      const secretEnvelope: { modules: Record<string, { secretOutputs: Record<string, unknown>; provisionedAt: string }> } = { modules: {} };
      const publicOutputsForPlan: Record<string, { publicOutputs: Record<string, unknown> }> = {};

      for (const m of provisionResult.value.modules) {
        moduleMap.set(m.projectKey, m);
        publicOutputsForPlan[m.projectKey] = { publicOutputs: { ...m.publicOutputs } };
        (persistence.modules as Record<string, { publicOutputs: Record<string, unknown>; provisionedAt: string }>)[m.projectKey] = {
          publicOutputs: { ...m.publicOutputs },
          provisionedAt: m.provisionedAt,
        };
        if (Object.keys(m.secretOutputs).length > 0) {
          secretEnvelope.modules[m.projectKey] = {
            secretOutputs: { ...m.secretOutputs },
            provisionedAt: m.provisionedAt,
          };
        }
      }
      provisioned = moduleMap;
      provisionResultForPlan = { modules: publicOutputsForPlan };

      const enc: EncryptedSecret | null =
        Object.keys(secretEnvelope.modules).length > 0
          ? deps.secretCipher.encrypt(JSON.stringify(secretEnvelope))
          : null;

      await deps.withOrgTx(orgId, (repos) =>
        repos.deployments.setProvisionResult(deploymentId, persistence, enc),
      );
    }

    // Plan now runs AFTER provision so vars can resolve provision.* paths.
    const plan = await runStage(
      'plan',
      async () =>
        (deps.planProject ?? buildProjectDeploymentPlan)(deployInput, config, {
          ...(provisionResultForPlan ? { provisionResult: provisionResultForPlan } : {}),
          ...(discoveredModulesForPlan ? { discoveredModules: discoveredModulesForPlan } : {}),
        }),
      { log },
    );
    if (!plan.ok) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: plan.errors[0]?.code ?? 'DEPLOY_PLAN_UNKNOWN',
        errorMessage: redact(errorSummary(plan.errors)),
      });
      return;
    }

    const envMappings: Record<string, ProvisionerEnvMapping[string]> = {};
    for (const m of provModules) {
      try {
        const moduleExports = (await import(m.packageName)) as { ENV_MAPPINGS?: ProvisionerEnvMapping };
        if (moduleExports.ENV_MAPPINGS && typeof moduleExports.ENV_MAPPINGS === 'object') {
          for (const [k, v] of Object.entries(moduleExports.ENV_MAPPINGS)) {
            if (v !== undefined) envMappings[k] = v;
          }
        }
      } catch {
        // Module without ENV_MAPPINGS export is allowed.
      }
    }

    await appendLog(deps, deploymentId, orgId, 'info', 'render', 'Rendering Dokploy plan');
    const rendered = await runStage('render', async () => (deps.renderPlan ?? renderDokployPlan)(
      plan.value as ProjectDeploymentPlan,
      buildDokployTargetConfig(redactedTarget, ctx.configOverrides, {
        orgSlug,
        projectSlug: plan.value.project.projectSlug,
        environment: plan.value.project.environment,
        ...(deps.publicDeployDomain === undefined ? {} : { publicDeployDomain: deps.publicDeployDomain }),
      }),
      provisioned,
      envMappings,
    ), { log });
    // ... existing post-render error handling unchanged
```

(Take care to preserve all existing variable usage downstream of `rendered` — e.g., apply, verify. No changes there.)

> **Note:** the `m.manifest.provisioner?.produces` access uses the existing `DiscoveredProvisionerModule.manifest: ModuleManifest` field (defined at `packages/deploy/deploy-core/src/provision.ts:9`). No changes to `collectProvisionerModules` needed.

- [ ] **Step 4: Run typecheck**

Run: `pnpm -F @rntme/platform-http typecheck`
Expected: green. If TypeScript flags an issue with `m.module.manifest.provisioner?.produces`, see the Note in Step 3 and adjust the source of `producesNames`.

- [ ] **Step 5: Run executor unit tests — expect failures**

Run: `pnpm -F @rntme/platform-http test executor`
Expected: existing tests likely fail because the stage order changed. Task 6 adapts them.

- [ ] **Step 6: Commit (intermediate, with broken tests)**

```bash
git add apps/platform-http/src/deploy/executor.ts
git commit -m "feat(platform-http): reorder executor — provision before plan

Provisioner output now feeds buildProjectDeploymentPlan via the new
options.provisionResult arg, letting blueprint vars resolve provision.*
paths. Bus-mode log message moved out of plan (was post-plan; now
pre-provision, derived from config). Tests adapted in follow-up commit."
```

---

### Task 6: Adapt platform-http executor tests to new stage order

**Files:**
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts`

- [ ] **Step 1: Run failing tests, capture failures**

Run: `pnpm -F @rntme/platform-http test executor 2>&1 | tail -40`
Expected: tests asserting `plan` ran before `provision` (or assertions on log-stage order) fail.

- [ ] **Step 2: Update tests to assert new order**

For each failing test, update assertions:

- Tests asserting log-stage sequence: change expected order from `[plan, provision, render]` to `[plan (bus mode), provision, plan (final), render]` (or `[plan, provision, render]` if the new bus-mode log is folded under `plan` step).
- Tests asserting `runProvisioners` was called with `provModules` derived from a `plan.value.workloads` shape: nothing changes; `runProvisioners` input doesn't depend on `plan`.
- Tests asserting `buildProjectDeploymentPlan` was called once with `(input, config)`: change to expect the new third arg present (with provisionResult populated when modules exist).

Add at least one new test:

```ts
it('passes provisionResult into buildProjectDeploymentPlan when modules ran provisioners', async () => {
  const planSpy = vi.fn(buildProjectDeploymentPlan);
  // ... harness wiring with at least one provisioner module ...
  // ... assert planSpy.mock.calls[0][2]?.provisionResult.modules.identity.publicOutputs ... ...
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm -F @rntme/platform-http test executor`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/platform-http/test/
git commit -m "test(platform-http): executor tests for provision-before-plan stage order"
```

---

### Task 7: deploy-core plan tests for provisionResult option

**Files:**
- Modify: `packages/deploy/deploy-core/test/unit/plan.test.ts`

- [ ] **Step 1: Run existing tests (should still pass — option defaults to {})**

Run: `pnpm -F @rntme/deploy-core test plan`
Expected: green (no behavioral change for callers passing 2 args).

- [ ] **Step 2: Add a test using a vars.AUTH0_SPA_CLIENT_ID with provision.* source**

In `packages/deploy/deploy-core/test/unit/plan.test.ts`, append:

```ts
describe('buildProjectDeploymentPlan with provisionResult', () => {
  it('substitutes provision.* var into publicConfigJson', () => {
    // Build a minimal ComposedProjectInput and ProjectDeploymentConfig that:
    //   - has varsManifest: { AUTH0_SPA_CLIENT_ID: { from: 'provision.identity.spaClient.id', required: true } }
    //   - has publicConfigJson: '{"identity":{"clientId":"${AUTH0_SPA_CLIENT_ID}"}}'
    //   - has eventBus: { kind: 'kafka', mode: 'in-memory' }
    //   - has services: { app: { kind: 'domain', slug: 'app', ... } }
    const input = {
      name: 'demo',
      varsManifest: {
        AUTH0_SPA_CLIENT_ID: { from: 'provision.identity.spaClient.id', required: true },
      },
      publicConfigJson: '{"identity":{"clientId":"${AUTH0_SPA_CLIENT_ID}"}}',
      services: {
        app: { slug: 'app', kind: 'domain', runtimeFiles: {} },
      },
      // plus whatever fields ComposedProjectInput requires; align with existing test fixtures.
    } as any; // adapt via existing test helpers if available
    const config = {
      orgSlug: 'org',
      environment: 'default',
      mode: 'preview',
      eventBus: { kind: 'kafka', mode: 'in-memory' as const },
    } as any;

    const r = buildProjectDeploymentPlan(input, config, {
      provisionResult: {
        modules: { identity: { publicOutputs: { spaClient: { id: 'spa_real' } } } },
      },
      discoveredModules: { identity: { producesNames: ['spaClient'] } },
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      const app = r.value.workloads.find((w) => w.kind === 'domain-service');
      expect(app && 'publicConfigJson' in app && app.publicConfigJson).toContain('spa_real');
    }
  });

  it('errors when a required provision.* var has no provisionResult entry', () => {
    const input = {
      name: 'demo',
      varsManifest: {
        AUTH0_SPA_CLIENT_ID: { from: 'provision.identity.spaClient.id', required: true },
      },
      publicConfigJson: '{}',
      services: { app: { slug: 'app', kind: 'domain', runtimeFiles: {} } },
    } as any;
    const config = {
      orgSlug: 'org',
      environment: 'default',
      mode: 'preview',
      eventBus: { kind: 'kafka', mode: 'in-memory' as const },
    } as any;

    const r = buildProjectDeploymentPlan(input, config, {
      discoveredModules: { identity: { producesNames: ['spaClient'] } },
      // no provisionResult
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_OUTPUT_MISSING');
    }
  });
});
```

> **Note:** adjust `as any` to match real test fixtures; the existing plan.test.ts likely has helper builders.

- [ ] **Step 3: Run tests**

Run: `pnpm -F @rntme/deploy-core test plan`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add packages/deploy/deploy-core/test/unit/plan.test.ts
git commit -m "test(deploy-core): buildProjectDeploymentPlan with provisionResult"
```

---

### Task 8: Update `demo/notes-blueprint/project.json`

**Files:**
- Modify: `demo/notes-blueprint/project.json`

- [ ] **Step 1: Read current vars block**

```bash
cat demo/notes-blueprint/project.json
```

- [ ] **Step 2: Change the AUTH0_SPA_CLIENT_ID source**

Edit `demo/notes-blueprint/project.json`. Replace:

```json
"AUTH0_SPA_CLIENT_ID": { "from": "target.auth.auth0.clientId", "required": true },
```

with:

```json
"AUTH0_SPA_CLIENT_ID": { "from": "provision.identity.spaClient.id", "required": true },
```

Other vars (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_REDIRECT_URI`) remain on `target.auth.auth0.*`.

- [ ] **Step 3: Verify the demo blueprint still parses**

Run: `pnpm -F @rntme/blueprint test 2>/dev/null || true`. If blueprint compose has a pre-deploy validator step, run it on this blueprint.

- [ ] **Step 4: Commit**

```bash
git add demo/notes-blueprint/project.json
git commit -m "feat(demo): notes-demo AUTH0_SPA_CLIENT_ID resolves from provisioner output

A fresh Auth0 tenant no longer needs target.auth.auth0.clientId pre-filled —
the identity module's provisioner creates the SPA client and the new
provision.* var source feeds its id into config.json."
```

---

### Task 9: README and AGENTS.md updates

**Files:**
- Modify: `packages/deploy/deploy-core/README.md`
- Modify: `apps/platform-http/README.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-05-03-provisioner-bundle-transport-design.md`

- [ ] **Step 1: deploy-core README**

Add a section "Var sources" (or extend an existing one):

```markdown
## Var sources

Blueprint `vars` may pull values from three sources, selected by the `from` string prefix:

- `target.<root>.<...>` — read from `ProjectDeploymentConfig`'s typed shape (e.g., `target.auth.auth0.domain`). Resolved at every plan call.
- `provision.<moduleKey>.<output>.<jsonPointer>` — read from a provisioner's `publicOutputs`. **Requires** `buildProjectDeploymentPlan` to be called with `options.provisionResult` populated. The executor sequences provision before plan to make this possible.
- `env.<NAME>` — (future) read from process env. Not implemented yet.

`<moduleKey>` is the local key from `project.json#modules`, not the package name. `<output>` must be declared in `module.json#provisioner.produces`. The plan validates these at resolve time and emits one of:

- `BLUEPRINT_VAR_PROVISION_PATH_INVALID` (syntax wrong)
- `BLUEPRINT_VAR_PROVISION_MODULE_MISSING` (key not in project.json#modules)
- `BLUEPRINT_VAR_PROVISION_OUTPUT_NOT_DECLARED` (output not in produces)
- `BLUEPRINT_VAR_PROVISION_OUTPUT_MISSING` (provisioner didn't run for this module)
- `BLUEPRINT_VAR_PROVISION_PATH_NOT_FOUND` (JSON pointer dead-ends)

## Two-pass plan API

`buildProjectDeploymentPlan(input, config, options?)` accepts:
- `options.provisionResult: { modules: { [key]: { publicOutputs } } }` — output of the provisioner stage.
- `options.discoveredModules: { [key]: { producesNames } }` — used to validate `provision.*` paths against declared outputs.

Callers without `provision.*` vars can omit `options`; behavior is identical to a pre-options call.
```

- [ ] **Step 2: platform-http README**

Add or extend a "Deploy executor" section:

```markdown
## Deploy executor stage order

Stages run in this sequence:

1. `compose` — resolve composed project from blueprint.
2. `plan` (bus-mode log only) — log which event-bus mode is in use, derived directly from `config.eventBus.mode`.
3. `provision` — run module provisioners; persist `provisionResult` and `secretOutputs`.
4. `plan` — `buildProjectDeploymentPlan(input, config, { provisionResult, discoveredModules })`. Vars resolve here; `provision.*` sources see the freshly-produced outputs.
5. `render` — `renderDokployPlan(plan, config, provisioned, envMappings)`.
6. `apply` — `applyDokployPlan(...)`.
7. `verify` — smoke checks.

Provision runs before plan so blueprint vars can pull from `provisionResult`.

## Reading deployment logs

The Dokploy MCP `application-readLogs` tool is unreliable for this codebase — it has been observed to return `success: true` with an empty body, and to 500 when given the `search` filter (verified 2026-05-04). Until the MCP is fixed, read logs via SSH:

```bash
ssh dokploy-host
docker service ls | grep <project-slug>
docker service logs <service-id> --tail 500 --since 10m
```

The service ID can also be retrieved via `mcp__dokploy__docker-getServiceContainersByAppName` (returns `containerId` plus state). Once the SSH-based runbook stabilizes, document a one-line wrapper script.
```

- [ ] **Step 3: AGENTS.md how-to**

Insert in §6:

```markdown
### Declare a var that resolves from provisioner output

When a service needs a value the provisioner creates at deploy time (e.g., a freshly-issued OAuth client id):

1. In the module manifest, declare the output: `module.json#provisioner.produces: [{ name: "spaClient", kind: "single", secret: false }]`.
2. The provisioner's `provision()` function returns it under `publicOutputs.spaClient` (or however the produces shape is structured).
3. In the blueprint `project.json`, use the new var source:
   ```json
   "vars": {
     "AUTH0_SPA_CLIENT_ID": { "from": "provision.identity.spaClient.id", "required": true }
   }
   ```
   `identity` is the local module key from `project.json#modules`. `spaClient` matches `produces[].name`. `.id` is a JSON pointer into `publicOutputs.spaClient`.
4. Use `${AUTH0_SPA_CLIENT_ID}` inside any `publicConfig`/manifest field. The plan substitutes it after the provisioner runs.

The pipeline runs `provision → plan → render`, so by the time render bakes `config.json` the SPA client id is already known.
```

- [ ] **Step 4: Mark provisioner-bundle-transport §15 follow-up resolved**

In `docs/superpowers/specs/2026-05-03-provisioner-bundle-transport-design.md`, find §15 "Out-of-scope follow-ups". Change the line:

```
- `vars`-vs-provisioner architectural mismatch (blueprint vars resolved before provisioner runs; see `rntme_blueprint_vars_vs_provisioner.md` finding).
```

to:

```
- ~~`vars`-vs-provisioner architectural mismatch~~ — resolved by `2026-05-04-notes-demo-fresh-tenant-deployable-design.md`.
```

- [ ] **Step 5: Commit doc touches**

```bash
git add packages/deploy/deploy-core/README.md apps/platform-http/README.md AGENTS.md docs/superpowers/specs/2026-05-03-provisioner-bundle-transport-design.md
git commit -m "docs: provision.* var source, executor stage order, log-reading runbook"
```

---

### Task 10: Local end-to-end smoke

- [ ] **Step 1: Build everything**

Run: `pnpm install --frozen-lockfile && pnpm -r build`
Expected: green.

- [ ] **Step 2: Typecheck and tests across packages**

Run: `pnpm -r typecheck && pnpm -r test`
Expected: green.

- [ ] **Step 3: Lint**

Run: `pnpm -r lint`
Expected: green.

If any of the above fails, return to the relevant task — do not proceed to PR creation.

- [ ] **Step 4: Commit any incidental fixes**

If lint/typecheck surfaced trivial issues, fix and commit:

```bash
git add <files>
git commit -m "fix: <description>"
```

---

### Task 11: Open the PR

- [ ] **Step 1: Push and open**

```bash
git push -u origin <branch>
gh pr create --title "feat(deploy): pipeline reorder — provision before plan (PR3/4)" --body "$(cat <<'EOF'
## Summary

Closes the `vars`-vs-provisioner ordering gap so notes-demo can deploy on a fresh Auth0 tenant without `target.auth.auth0.clientId` pre-filled.

- New executor stage order: `compose → plan(bus-log only) → provision → plan → render → apply → verify`. Provision runs **before** plan.
- `buildProjectDeploymentPlan(input, config, options?)` accepts `options.provisionResult` and `options.discoveredModules`. Existing 2-arg call sites unchanged.
- New var source: `from: "provision.<moduleKey>.<output>.<jsonPointer>"`. Example: `provision.identity.spaClient.id`.
- Five new error codes: `BLUEPRINT_VAR_PROVISION_PATH_INVALID`, `..._MODULE_MISSING`, `..._OUTPUT_NOT_DECLARED`, `..._OUTPUT_MISSING`, `..._PATH_NOT_FOUND`.
- `demo/notes-blueprint/project.json` switches `AUTH0_SPA_CLIENT_ID` from `target.auth.auth0.clientId` to `provision.identity.spaClient.id`.
- Closes the §15 follow-up in `docs/superpowers/specs/2026-05-03-provisioner-bundle-transport-design.md`.

PR3 of 4 implementing `docs/superpowers/specs/2026-05-04-notes-demo-fresh-tenant-deployable-design.md`. Depends on PR1 (vendoring) for the demo blueprint to bundle correctly. Independent of PR2.

## Test plan

- [ ] Vitest green across `@rntme/deploy-core`, `@rntme/deploy-dokploy`, `@rntme/platform-http`.
- [ ] New `vars.test.ts` cases — 7+ cases for all five error codes plus happy-path.
- [ ] New `plan.test.ts` cases — provisionResult substitution into publicConfigJson + missing-output error.
- [ ] Existing executor tests adapted to new stage order; one new test asserting `provisionResult` reaches `buildProjectDeploymentPlan`.
- [ ] Manual deploy on a fresh Auth0 tenant target with `target.auth.auth0.clientId` absent → `provisionResult.modules.identity.publicOutputs.spaClient.id` populated → materialized bundle's `config.json` contains the same id.
- [ ] CI green.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Note PR URL**

Done. PR4 (notes 500 fix) starts after this PR is merged AND a fresh deploy is reachable.
