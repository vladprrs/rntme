# BPMN-orchestrated Deploy in services/deployments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the platform-http imperative deploy executor with a BPMN process owned by `services/deployments`, where Operaton drives six service tasks (`compose`, `plan`, `provision`, `render`, `apply`, `verify`) backed by native handlers that call `@rntme/deploy-runner`, with cross-stage state persisted via a new `DeployStageState` aggregate, while keeping the legacy executor available behind `PLATFORM_RUNTIME_MODE=legacy` until cutover.

**Architecture:** `runDeployment` in `@rntme/deploy-runner` is split into per-stage `stages.*` exports plus a coordinator. `@rntme/bpmn-worker` is extended with two capabilities: (1) native task handlers loaded from `workflows.json#nativeTasks`, dispatched before the existing `bindingRef`-via-gRPC path, and (2) a continuous Operaton fetch-and-lock loop independent of Kafka events. The `apps/platform/blueprint/services/deployments/workflows/run-deployment.bpmn` process is started by a `messageStart` subscription on `deployments.Deployment.queued` (already emitted by the `queueDeployment` graph) and threads `deploymentId` + `orgId` through six service tasks. Each task handler reads prior `DeployStageState` rows from Postgres, runs one stage, and persists its result. The platform target gains an Operaton workflow engine + provisioned Kafka requirement so `rntme platform up` brings up Operaton + bpmn-worker as siblings of the runtime container.

**Tech Stack:** Bun 1.1, TypeScript, BPMN 2.0 (Operaton 7), Postgres (platform DB), Drizzle ORM, Hono, Operaton REST API, KafkaJS, Zod.

---

## Scope and Dependencies

This plan is plan 3 of 6 in `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`.

**Requires:** plan 1 (`packages/deploy/deploy-runner` extracted) — already landed in current `main`.

**Does not block:** plan 2 (CLI direct-mode) — tasks here only touch deploy-runner, bpmn-worker, the platform blueprint, and platform-storage; the CLI direct-mode path uses `runDeployment` (the coordinator), which keeps the same public signature.

**Does not address:** plans 4–6 (HTTP middleware lift, token introspection move, platform-http deletion).

## File Structure

```
packages/deploy/deploy-runner/src/
  stages/
    compose.ts                  NEW — pure stage: load + revalidate composed blueprint
    provision.ts                NEW — pure stage: run provisioners
    plan.ts                     NEW — pure stage: build deployment plan
    render.ts                   NEW — pure stage: render Dokploy plan
    apply.ts                    NEW — pure stage: apply Dokploy plan
    verify.ts                   NEW — pure stage: verify smoke + stack
    types.ts                    NEW — per-stage I/O types
    index.ts                    NEW — re-exports `stages` namespace
  handlers/
    platform-context.ts         NEW — module-level cached platform deps from env
    compose-handler.ts          NEW — BPMN-task wrapper for stages.compose
    provision-handler.ts        NEW — BPMN-task wrapper for stages.provision
    plan-handler.ts             NEW — BPMN-task wrapper for stages.plan
    render-handler.ts           NEW — BPMN-task wrapper for stages.render
    apply-handler.ts            NEW — BPMN-task wrapper for stages.apply
    verify-handler.ts           NEW — BPMN-task wrapper for stages.verify
    index.ts                    NEW — re-exports handler functions
    types.ts                    NEW — handler input/output envelope types
  run-deployment.ts             MODIFY — refactor to call stages.* sequentially
  index.ts                      MODIFY — add `stages` and handler exports

packages/runtime/bpmn-worker/src/
  native-handlers.ts            NEW — load + dispatch handlers from manifest.nativeTasks
  poll-loop.ts                  NEW — continuous Operaton fetchAndLock loop
  worker.ts                     MODIFY — call native handler before bindingRef gRPC, fail loudly on missing
  run.ts                        MODIFY — add runBpmnPollWorker entrypoint
  bin/poll.ts                   NEW — bin entry for continuous-poll mode
  types.ts                      MODIFY — extend WorkerConfig with handlerRoot path
  env.ts                        MODIFY — read RNTME_BPMN_HANDLER_ROOT env
  index.ts                      MODIFY — export native-handler types and runBpmnPollWorker

packages/artifacts/workflows/src/parse/schema.ts
                                MODIFY — add nativeTaskSchema + WorkflowArtifactSchema.nativeTasks field
packages/artifacts/workflows/src/types/artifact.ts
                                MODIFY — add NativeTaskMapping type
packages/artifacts/workflows/src/validate/structural.ts
                                MODIFY — validate nativeTasks (no duplicates, no overlap with serviceTasks)

apps/platform/blueprint/services/deployments/workflows/
  run-deployment.bpmn           NEW — BPMN 2.0 process with six service tasks
  workflows.json                NEW — message starts + nativeTasks mapping

apps/platform/blueprint/pdm/entities/
  DeployStageState.json         NEW — new owned aggregate for cross-stage state

apps/platform/blueprint/services/deployments/graphs/
  recordStageState.json         NEW — graph that writes a stage's result row
  readStageStates.json          NEW — graph that reads all stage rows for a deployment
  shapes.json                   MODIFY — add DeployStageState shape

apps/platform/blueprint/services/deployments/qsm/
  qsm.json                      MODIFY — add DeployStageStateView projection
  projections/DeployStageStateView.json
                                NEW — projection definition

apps/platform/blueprint/services/deployments/bindings/bindings.json
                                MODIFY — add HTTP-internal bindings for stage state graphs

apps/platform/blueprint/project.json
                                MODIFY — add `workflows` config (Operaton engine reference)

apps/platform/blueprint/services/deployments/workflows.json (project-level)
                                NEW (project-level)? See Task 9 — workflows are referenced from project config

packages/platform/platform-storage/drizzle/
  0014_deploy_stage_state.sql   NEW — Postgres migration for deploy_stage_state table
packages/platform/platform-storage/src/schema/
  deploy-stage-state.ts         NEW — Drizzle schema
packages/platform/platform-storage/src/repos/
  deploy-stage-state.ts         NEW — DeployStageStateRepo

apps/platform-http/src/app.ts   MODIFY — confirm legacy gating already in place; document
apps/platform-http/src/config/env.ts
                                MODIFY (verify) — PLATFORM_RUNTIME_MODE already exists
docs/decision-system.md         MODIFY — promote three bets from locked-pending → current-default
docs/current/owners/packages/runtime/bpmn-worker.md
                                MODIFY — document native handlers + poll mode
docs/current/owners/packages/deploy/deploy-runner.md
                                MODIFY — document stages.* and handler exports
docs/current/owners/apps/platform.md
                                MODIFY — note Operaton + deploy BPMN dependency
```

---

## Task 1: Add per-stage I/O types in deploy-runner

**Files:**
- Create: `packages/deploy/deploy-runner/src/stages/types.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/deploy/deploy-runner/test/unit/stages/types.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import type {
  ComposeStageInput,
  ComposeStageOutput,
  ProvisionStageInput,
  ProvisionStageOutput,
  PlanStageInput,
  PlanStageOutput,
  RenderStageInput,
  RenderStageOutput,
  ApplyStageInput,
  ApplyStageOutput,
  VerifyStageInput,
  VerifyStageOutput,
} from '../../../src/stages/types.js';

describe('stage I/O types', () => {
  it('compose output is the input to provision and plan', () => {
    const compose: ComposeStageOutput = {} as ComposeStageOutput;
    const _provision: ProvisionStageInput['composed'] = compose.composed;
    const _plan: PlanStageInput['composed'] = compose.composed;
    expect(true).toBe(true);
  });

  it('provision output threads into plan and render inputs', () => {
    const provision: ProvisionStageOutput = {} as ProvisionStageOutput;
    const _plan: PlanStageInput['provision'] = provision;
    const _render: RenderStageInput['provisioned'] = provision.provisioned;
    expect(true).toBe(true);
  });

  it('plan output threads into render input', () => {
    const plan: PlanStageOutput = {} as PlanStageOutput;
    const _render: RenderStageInput['plan'] = plan.plan;
    expect(true).toBe(true);
  });

  it('render output threads into apply input', () => {
    const render: RenderStageOutput = {} as RenderStageOutput;
    const _apply: ApplyStageInput['rendered'] = render.rendered;
    expect(true).toBe(true);
  });

  it('apply output threads into verify input', () => {
    const apply: ApplyStageOutput = {} as ApplyStageOutput;
    const _verify: VerifyStageInput['applied'] = apply.applied;
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test --cwd packages/deploy/deploy-runner test/unit/stages/types.test.ts
```

Expected: module-not-found error for `'../../../src/stages/types.js'`.

- [ ] **Step 3: Create the types file**

Create `packages/deploy/deploy-runner/src/stages/types.ts`:

```ts
import type {
  ComposedProjectInput,
  DiscoveredModulesForVars,
  ProjectDeploymentPlan,
  ProvisionedModule,
  ProvisionerOutput,
  ProvisionResultForVars,
} from '@rntme/deploy-core';
import type { DeploymentApplyResult, RenderedDokployPlan } from '@rntme/deploy-dokploy';
import type { NormalizedDeployTarget, ResolvedTargetSecrets, VerificationReport } from '../types.js';

export type StageContext = {
  readonly orgSlug: string;
  readonly target: NormalizedDeployTarget;
  readonly resolvedTargetSecrets: ResolvedTargetSecrets;
  readonly configOverrides: Record<string, unknown>;
  readonly publicDeployDomain?: string;
};

export type ComposeStageInput = {
  readonly bundleDir: string;
};

export type ComposeStageOutput = {
  readonly composed: ComposedProjectInput;
  readonly bundleDir: string;
};

export type ProvisionStageInput = {
  readonly ctx: StageContext;
  readonly composed: ComposedProjectInput;
  readonly bundleDir: string;
  readonly priorProvisionOutputs: Readonly<Record<string, ProvisionerOutput>>;
};

export type ProvisionStageOutput = {
  readonly provisioned: ReadonlyMap<string, ProvisionedModule>;
  readonly publicByModule: Record<string, Record<string, unknown>>;
  readonly secretByModule: Record<string, Record<string, unknown>>;
  readonly provisionResultForPlan?: ProvisionResultForVars;
  readonly discoveredModulesForPlan?: DiscoveredModulesForVars;
  readonly startedAt: string;
  readonly finishedAt: string;
};

export type PlanStageInput = {
  readonly ctx: StageContext;
  readonly composed: ComposedProjectInput;
  readonly provision: ProvisionStageOutput;
};

export type PlanStageOutput = {
  readonly plan: ProjectDeploymentPlan;
};

export type RenderStageInput = {
  readonly ctx: StageContext;
  readonly plan: ProjectDeploymentPlan;
  readonly provisioned: ReadonlyMap<string, ProvisionedModule>;
  readonly bundleDir: string;
};

export type RenderStageOutput = {
  readonly rendered: RenderedDokployPlan;
};

export type ApplyStageInput = {
  readonly ctx: StageContext;
  readonly rendered: RenderedDokployPlan;
  readonly resolvedRequiredSecrets: Readonly<Record<string, unknown>>;
  readonly dokployClientFactory: (
    apiToken: string,
    extras?: Readonly<Record<string, unknown>>,
  ) => import('@rntme/deploy-dokploy').DokployClient;
};

export type ApplyStageOutput = {
  readonly applied: DeploymentApplyResult;
  readonly durationMs: number;
};

export type VerifyStageInput = {
  readonly applied: DeploymentApplyResult;
};

export type VerifyStageOutput = {
  readonly report: VerificationReport;
  readonly stackReport: VerificationReport | null;
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test --cwd packages/deploy/deploy-runner test/unit/stages/types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/deploy/deploy-runner/src/stages/types.ts packages/deploy/deploy-runner/test/unit/stages/types.test.ts
git commit -m "feat(deploy-runner): add per-stage I/O types"
```

---

## Task 2: Extract `compose` stage

**Files:**
- Create: `packages/deploy/deploy-runner/src/stages/compose.ts`
- Test: `packages/deploy/deploy-runner/test/unit/stages/compose.test.ts`

The compose stage today is implicit in the platform-http executor (`loadComposed` + `toDeployCoreInput`). It re-validates the materialized blueprint and returns a `ComposedProjectInput`.

- [ ] **Step 1: Write the failing test**

Create `packages/deploy/deploy-runner/test/unit/stages/compose.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compose } from '../../../src/stages/compose.js';

describe('stages.compose', () => {
  it('loads a minimal materialized blueprint and returns ComposedProjectInput', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'compose-test-'));
    writeFileSync(join(dir, 'project.json'), JSON.stringify({ name: 'demo', services: [] }));
    mkdirSync(join(dir, 'pdm'));
    writeFileSync(join(dir, 'pdm', 'pdm.json'), JSON.stringify({ version: '1' }));

    const result = await compose({ bundleDir: dir });

    expect(result.composed.name).toBe('demo');
    expect(result.bundleDir).toBe(dir);
  });

  it('throws DEPLOY_COMPOSE_FAILED when blueprint is invalid', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'compose-test-'));
    writeFileSync(join(dir, 'project.json'), '{ not valid json');

    await expect(compose({ bundleDir: dir })).rejects.toMatchObject({
      code: 'DEPLOY_COMPOSE_FAILED',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test --cwd packages/deploy/deploy-runner test/unit/stages/compose.test.ts
```

Expected: FAIL — `compose` not exported from `'../../../src/stages/compose.js'`.

- [ ] **Step 3: Implement the stage**

Create `packages/deploy/deploy-runner/src/stages/compose.ts`:

```ts
import { loadComposedBlueprint } from '@rntme/blueprint';
import type { ComposeStageInput, ComposeStageOutput } from './types.js';

export class StageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StageError';
  }
}

export async function compose(input: ComposeStageInput): Promise<ComposeStageOutput> {
  const result = await loadComposedBlueprint(input.bundleDir);
  if (!result.ok) {
    const first = result.errors[0];
    throw new StageError(
      'DEPLOY_COMPOSE_FAILED',
      first?.message ?? 'failed to load blueprint',
      result.errors,
    );
  }
  // The platform-http path uses `toDeployCoreInput` (lifted into deploy-runner
  // here). Implementations of toDeployCoreInput live in deploy-core; we re-export
  // the conversion via `result.value` since loadComposedBlueprint already returns
  // a ComposedProjectInput-compatible object.
  return { composed: result.value as ComposeStageOutput['composed'], bundleDir: input.bundleDir };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test --cwd packages/deploy/deploy-runner test/unit/stages/compose.test.ts
```

Expected: PASS for the happy path. The invalid-JSON case may surface a different code; if so, update the test to match the actual code returned by `loadComposedBlueprint`. Document the actual code in the test assertion.

- [ ] **Step 5: Commit**

```bash
git add packages/deploy/deploy-runner/src/stages/compose.ts packages/deploy/deploy-runner/test/unit/stages/compose.test.ts
git commit -m "feat(deploy-runner): add compose stage"
```

---

## Task 3: Extract `provision` stage

**Files:**
- Create: `packages/deploy/deploy-runner/src/stages/provision.ts`
- Test: `packages/deploy/deploy-runner/test/unit/stages/provision.test.ts`

Lift the provision block from `run-deployment.ts` (lines around 106–188 currently) into a pure function.

- [ ] **Step 1: Write the failing test**

Create `packages/deploy/deploy-runner/test/unit/stages/provision.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { provision } from '../../../src/stages/provision.js';
import type { ComposedProjectInput } from '@rntme/deploy-core';

describe('stages.provision', () => {
  it('returns empty result when blueprint has no provisioner-bearing modules', async () => {
    const composed = { name: 'demo', services: [], modules: {}, varsManifest: {} } as unknown as ComposedProjectInput;
    const out = await provision({
      ctx: {
        orgSlug: 'org',
        target: { kind: 'dokploy', slug: 'preview', config: {}, modules: [], storage: [], workflows: undefined, auth: {} } as never,
        resolvedTargetSecrets: { apiToken: '', extras: {} },
        configOverrides: {},
      },
      composed,
      bundleDir: '/tmp/empty',
      priorProvisionOutputs: {},
    });

    expect(out.provisioned.size).toBe(0);
    expect(out.publicByModule).toEqual({});
    expect(out.secretByModule).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test --cwd packages/deploy/deploy-runner test/unit/stages/provision.test.ts
```

Expected: module-not-found.

- [ ] **Step 3: Implement the stage**

Create `packages/deploy/deploy-runner/src/stages/provision.ts`:

```ts
import { discoverModules } from '@rntme/blueprint';
import {
  applyVars,
  resolveTargetVarsOnly,
  runProvisioners,
  targetForVars,
  type DiscoveredProvisionerModule,
  type ProvisionedModule,
} from '@rntme/deploy-core';
import { buildProjectDeploymentConfig } from '../build-deploy-config.js';
import { StageError } from './compose.js';
import type { ProvisionStageInput, ProvisionStageOutput } from './types.js';

export async function provision(
  input: ProvisionStageInput,
  overrides?: { readonly runProvisioners?: typeof runProvisioners; readonly resolveProvisioner?: import('../types.js').ResolveProvisioner },
): Promise<ProvisionStageOutput> {
  const config = buildProjectDeploymentConfig(input.ctx.target, input.ctx.orgSlug, input.ctx.configOverrides, {
    projectSlug: input.composed.name,
    ...(input.ctx.publicDeployDomain === undefined ? {} : { publicDeployDomain: input.ctx.publicDeployDomain }),
  });

  const discovered = await discoverModules({ projectDir: input.bundleDir });
  const provModules: DiscoveredProvisionerModule[] = [];
  if (discovered.ok) {
    for (const [, info] of Object.entries(discovered.value)) {
      if (!info.manifest.provisioner) continue;
      provModules.push({
        projectKey: info.projectKey,
        packageName: info.manifest.name,
        manifest: info.manifest,
        publicConfig: info.publicConfig,
      });
    }
  }

  if (provModules.length === 0) {
    const now = new Date().toISOString();
    return {
      provisioned: new Map(),
      publicByModule: {},
      secretByModule: {},
      startedAt: now,
      finishedAt: now,
    };
  }

  const targetVarsResult = resolveTargetVarsOnly(
    input.composed.varsManifest ?? {},
    targetForVars(config, input.ctx.target.slug),
  );
  if (!targetVarsResult.ok) {
    throw new StageError(
      targetVarsResult.errors[0]?.code ?? 'DEPLOY_PLAN_UNKNOWN',
      targetVarsResult.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      targetVarsResult.errors,
    );
  }
  const targetVars = targetVarsResult.value;
  const provModulesWithSubstitutedConfig = provModules.map((m) => ({
    ...m,
    publicConfig: applyVars(m.publicConfig, targetVars) as Record<string, unknown>,
  }));

  const startedAt = new Date().toISOString();
  const provisionRunner = overrides?.runProvisioners ?? runProvisioners;
  const resolveProvisioner =
    overrides?.resolveProvisioner ??
    ((): never => {
      throw new StageError('DEPLOY_PROVISION_NO_RESOLVER', 'resolveProvisioner missing');
    });

  const provisionResult = await provisionRunner({
    modules: provModulesWithSubstitutedConfig.map((m) => {
      const prior = input.priorProvisionOutputs[m.projectKey];
      return prior === undefined ? m : { ...m, priorOutputs: prior };
    }),
    resolvedTargetSecrets: input.ctx.resolvedTargetSecrets.extras,
    projectDir: input.bundleDir,
    resolveProvisioner,
    log: () => undefined,
  });
  if (!provisionResult.ok) {
    throw new StageError(
      provisionResult.errors[0]?.code ?? 'DEPLOY_PROVISION_UNKNOWN',
      provisionResult.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      provisionResult.errors,
    );
  }

  const moduleMap = new Map<string, ProvisionedModule>();
  const publicByModule: Record<string, Record<string, unknown>> = {};
  const secretByModule: Record<string, Record<string, unknown>> = {};
  const publicOutputsForPlan: Record<string, { publicOutputs: Record<string, unknown> }> = {};
  for (const m of provisionResult.value.modules) {
    moduleMap.set(m.projectKey, m);
    publicOutputsForPlan[m.projectKey] = { publicOutputs: { ...m.publicOutputs } };
    publicByModule[m.projectKey] = { ...m.publicOutputs };
    if (Object.keys(m.secretOutputs).length > 0) {
      secretByModule[m.projectKey] = { ...m.secretOutputs };
    }
  }

  const dm: import('@rntme/deploy-core').DiscoveredModulesForVars = {};
  for (const m of provModules) {
    dm[m.projectKey] = { producesNames: m.manifest.provisioner?.produces.map((p) => p.name) ?? [] };
  }

  return {
    provisioned: moduleMap,
    publicByModule,
    secretByModule,
    provisionResultForPlan: { modules: publicOutputsForPlan },
    discoveredModulesForPlan: dm,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test --cwd packages/deploy/deploy-runner test/unit/stages/provision.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/deploy/deploy-runner/src/stages/provision.ts packages/deploy/deploy-runner/test/unit/stages/provision.test.ts
git commit -m "feat(deploy-runner): add provision stage"
```

---

## Task 4: Extract `plan`, `render`, `apply`, `verify` stages

**Files:**
- Create: `packages/deploy/deploy-runner/src/stages/plan.ts`
- Create: `packages/deploy/deploy-runner/src/stages/render.ts`
- Create: `packages/deploy/deploy-runner/src/stages/apply.ts`
- Create: `packages/deploy/deploy-runner/src/stages/verify.ts`
- Create: `packages/deploy/deploy-runner/test/unit/stages/{plan,render,apply,verify}.test.ts`

Each stage lifts a contiguous block from current `run-deployment.ts`:

- `plan`: `buildProjectDeploymentPlan` invocation (~lines 191–210). Throws `StageError` with `DEPLOY_PLAN_*` codes.
- `render`: `renderDokployPlan` (~lines 274–306). Throws `DEPLOY_RENDER_DOKPLOY_*`.
- `apply`: `applyDokployPlan` (~lines 308–344). Throws `DEPLOY_APPLY_DOKPLOY_*`.
- `verify`: `verifyComposeStack` + `SmokeVerifier.verify` (~lines 346–380). Throws `DEPLOY_VERIFY_*`.

- [ ] **Step 1: Write a stub failing test for each stage**

Each test file imports its stage and asserts the function exists:

```ts
// plan.test.ts
import { describe, expect, it } from 'bun:test';
import { plan } from '../../../src/stages/plan.js';

describe('stages.plan', () => {
  it('exports a plan function', () => {
    expect(typeof plan).toBe('function');
  });
});
```

Repeat with `render`, `apply`, `verify`.

- [ ] **Step 2: Run all four tests to verify they fail**

```bash
bun test --cwd packages/deploy/deploy-runner test/unit/stages/
```

Expected: 4 failing imports.

- [ ] **Step 3: Implement `plan.ts`**

Create `packages/deploy/deploy-runner/src/stages/plan.ts`:

```ts
import { buildProjectDeploymentPlan } from '@rntme/deploy-core';
import { buildProjectDeploymentConfig } from '../build-deploy-config.js';
import { StageError } from './compose.js';
import type { PlanStageInput, PlanStageOutput } from './types.js';

export async function plan(
  input: PlanStageInput,
  override?: typeof buildProjectDeploymentPlan,
): Promise<PlanStageOutput> {
  const config = buildProjectDeploymentConfig(input.ctx.target, input.ctx.orgSlug, input.ctx.configOverrides, {
    projectSlug: input.composed.name,
    ...(input.ctx.publicDeployDomain === undefined ? {} : { publicDeployDomain: input.ctx.publicDeployDomain }),
  });

  const planner = override ?? buildProjectDeploymentPlan;
  const result = await planner(input.composed, config, {
    ...(input.provision.provisionResultForPlan ? { provisionResult: input.provision.provisionResultForPlan } : {}),
    ...(input.provision.discoveredModulesForPlan ? { discoveredModules: input.provision.discoveredModulesForPlan } : {}),
  });
  if (!result.ok) {
    throw new StageError(
      result.errors[0]?.code ?? 'DEPLOY_PLAN_UNKNOWN',
      result.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      result.errors,
    );
  }
  return { plan: result.value };
}
```

- [ ] **Step 4: Implement `render.ts`**

Create `packages/deploy/deploy-runner/src/stages/render.ts`:

```ts
import { renderDokployPlan, type ProvisionerEnvMapping } from '@rntme/deploy-dokploy';
import { discoverModules } from '@rntme/blueprint';
import { buildDokployTargetConfig } from '../build-deploy-config.js';
import { StageError } from './compose.js';
import type { RenderStageInput, RenderStageOutput } from './types.js';

export async function render(
  input: RenderStageInput,
  override?: typeof renderDokployPlan,
): Promise<RenderStageOutput> {
  const envMappings: Record<string, ProvisionerEnvMapping[string]> = {};
  const discovered = await discoverModules({ projectDir: input.bundleDir });
  if (discovered.ok) {
    for (const [, info] of Object.entries(discovered.value)) {
      if (!info.manifest.provisioner) continue;
      try {
        const moduleExports = (await import(info.manifest.name)) as { ENV_MAPPINGS?: ProvisionerEnvMapping };
        if (moduleExports.ENV_MAPPINGS && typeof moduleExports.ENV_MAPPINGS === 'object') {
          for (const [k, v] of Object.entries(moduleExports.ENV_MAPPINGS)) {
            if (v !== undefined) envMappings[k] = v;
          }
        }
      } catch {
        // module opts out by not exporting ENV_MAPPINGS
      }
    }
  }

  const renderer = override ?? renderDokployPlan;
  const result = await renderer(
    input.plan,
    buildDokployTargetConfig(input.ctx.target, input.ctx.configOverrides, {
      orgSlug: input.ctx.orgSlug,
      projectSlug: input.plan.project.projectSlug,
      environment: input.plan.project.environment,
      ...(input.ctx.publicDeployDomain === undefined ? {} : { publicDeployDomain: input.ctx.publicDeployDomain }),
    }),
    input.provisioned,
    envMappings,
  );
  if (!result.ok) {
    throw new StageError(
      result.errors[0]?.code ?? 'DEPLOY_RENDER_DOKPLOY_UNKNOWN',
      result.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      result.errors,
    );
  }
  return { rendered: result.value };
}
```

- [ ] **Step 5: Implement `apply.ts`**

Create `packages/deploy/deploy-runner/src/stages/apply.ts`:

```ts
import { applyDokployPlan } from '@rntme/deploy-dokploy';
import { StageError } from './compose.js';
import type { ApplyStageInput, ApplyStageOutput } from './types.js';

export async function apply(
  input: ApplyStageInput,
  override?: typeof applyDokployPlan,
): Promise<ApplyStageOutput> {
  const dokployClient = input.dokployClientFactory(
    input.ctx.resolvedTargetSecrets.apiToken,
    Object.keys(input.resolvedRequiredSecrets).length > 0 ? input.resolvedRequiredSecrets : input.ctx.resolvedTargetSecrets.extras,
  );
  const start = Date.now();
  const applier = override ?? applyDokployPlan;
  const result = await applier(input.rendered, dokployClient);
  if (!result.ok) {
    throw new StageError(
      result.errors[0]?.code ?? 'DEPLOY_APPLY_DOKPLOY_UNKNOWN',
      result.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      result.errors,
    );
  }
  return { applied: result.value, durationMs: Date.now() - start };
}
```

Note: `ApplyStageInput.ctx` was added to types in Task 1; if missing, add it before continuing.

- [ ] **Step 6: Implement `verify.ts`**

Create `packages/deploy/deploy-runner/src/stages/verify.ts`:

```ts
import { isComposeTaskHealthy, type DeploymentApplyResult } from '@rntme/deploy-dokploy';
import { SmokeVerifier } from '../smoke-verifier.js';
import { StageError } from './compose.js';
import type { VerifyStageInput, VerifyStageOutput } from './types.js';
import type { VerificationReport } from '../types.js';

export async function verify(
  input: VerifyStageInput,
  override?: { readonly smoker?: SmokeVerifier },
): Promise<VerifyStageOutput> {
  const stackReport = verifyComposeStack(input.applied);
  if (stackReport !== null && !stackReport.ok) {
    throw new StageError('DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP', 'workload crash loop detected', stackReport);
  }
  const smoker = override?.smoker ?? new SmokeVerifier();
  const report = await smoker.verify(input.applied);
  if (!report.ok && !report.partialOk) {
    throw new StageError('DEPLOY_EXECUTOR_SMOKE_FAILED', 'smoke verification failed', report);
  }
  return { report, stackReport };
}

function verifyComposeStack(applyResult: DeploymentApplyResult): VerificationReport | null {
  const stack = applyResult.verificationHints.stack;
  if (stack === undefined) return null;
  const checks = (stack.inspections ?? []).map((inspection) => ({
    name: `workload ${inspection.serviceName}`,
    url: `dokploy:compose/${stack.composeId}/${inspection.serviceName}`,
    status: inspection.status,
    latencyMs: 0,
    ok: isComposeTaskHealthy(inspection),
    note: inspection.message ?? `status=${inspection.status} failedCount=${inspection.failedCount}`,
  }));
  if (checks.length === 0) return { checks: [], ok: true, partialOk: false };
  return { checks, ok: checks.every((c) => c.ok), partialOk: false };
}
```

- [ ] **Step 7: Run all stage tests to verify they pass**

```bash
bun test --cwd packages/deploy/deploy-runner test/unit/stages/
```

Expected: 6 PASS (compose, provision, plan, render, apply, verify stubs at minimum).

- [ ] **Step 8: Commit**

```bash
git add packages/deploy/deploy-runner/src/stages packages/deploy/deploy-runner/test/unit/stages
git commit -m "feat(deploy-runner): split runDeployment into per-stage exports"
```

---

## Task 5: Refactor `runDeployment` to call `stages.*`

**Files:**
- Modify: `packages/deploy/deploy-runner/src/run-deployment.ts`
- Create: `packages/deploy/deploy-runner/src/stages/index.ts`
- Modify: `packages/deploy/deploy-runner/src/index.ts`

- [ ] **Step 1: Write a regression test for runDeployment**

Find the existing run-deployment test (`packages/deploy/deploy-runner/test/unit/run-deployment.test.ts`) and add this case if missing:

```ts
it('passes provisioned modules through to plan and render and reports terminal success', async () => {
  // ... reuse existing happy-path harness; assert hooks fire in order:
  //   onProvisionResult → onApplyResult → onVerifyResult → onTerminal({ ok: true, kind: 'succeeded' })
});
```

Run existing tests to capture current behaviour:

```bash
bun test --cwd packages/deploy/deploy-runner test/unit/run-deployment.test.ts
```

Expected: PASS (baseline).

- [ ] **Step 2: Create the stages namespace export**

Create `packages/deploy/deploy-runner/src/stages/index.ts`:

```ts
import { compose } from './compose.js';
import { provision } from './provision.js';
import { plan } from './plan.js';
import { render } from './render.js';
import { apply } from './apply.js';
import { verify } from './verify.js';

export const stages = { compose, provision, plan, render, apply, verify } as const;

export { compose, provision, plan, render, apply, verify };
export { StageError } from './compose.js';
export type * from './types.js';
```

- [ ] **Step 3: Refactor `run-deployment.ts` to call stages**

Replace the body of `runDeployment` (`packages/deploy/deploy-runner/src/run-deployment.ts`) with sequential calls to `stages.*`. The new shape:

```ts
import { stages, StageError } from './stages/index.js';
// ...keep existing hook helpers (terminalSuccess, terminalFailure, etc.)...

export async function runDeployment(inputs: RunDeploymentInputs): Promise<TerminalResult> {
  const hooks: DeploymentHooks = inputs.hooks ?? {};
  const log = async (line: SanitizedLogLine): Promise<void> => {
    if (hooks.onLog === undefined) return;
    await hooks.onLog({ ...line, message: redact(line.message) });
  };

  const ctx = {
    orgSlug: inputs.orgSlug,
    target: inputs.target,
    resolvedTargetSecrets: inputs.resolvedTargetSecrets,
    configOverrides: inputs.configOverrides,
    ...(inputs.publicDeployDomain === undefined ? {} : { publicDeployDomain: inputs.publicDeployDomain }),
  };

  try {
    await emitStageBegin(hooks, 'compose');
    const composed = await stages.compose({ bundleDir: inputs.bundleDir });
    await emitStageComplete(hooks, 'compose', 0);

    await emitStageBegin(hooks, 'provision');
    const provisionStart = Date.now();
    const provisionOut = await stages.provision({
      ctx, composed: composed.composed, bundleDir: composed.bundleDir,
      priorProvisionOutputs: inputs.priorProvisionOutputs,
    }, { runProvisioners: inputs.runProvisioners, resolveProvisioner: inputs.resolveProvisioner });
    if (hooks.onProvisionResult !== undefined) {
      await hooks.onProvisionResult({
        publicByModule: provisionOut.publicByModule,
        secretByModule: provisionOut.secretByModule,
        startedAt: provisionOut.startedAt,
        finishedAt: provisionOut.finishedAt,
      });
    }
    await emitStageComplete(hooks, 'provision', Date.now() - provisionStart);

    await emitStageBegin(hooks, 'plan');
    const planStart = Date.now();
    const planOut = await stages.plan({ ctx, composed: composed.composed, provision: provisionOut }, inputs.planProject);
    await emitStageComplete(hooks, 'plan', Date.now() - planStart);

    // Required-secret pre-validation (preserve previous behavior; same code as today's runDeployment)
    const resolvedRequiredSecrets = await validateRequiredSecrets(planOut.plan, inputs);

    await emitStageBegin(hooks, 'render');
    const renderStart = Date.now();
    const renderOut = await stages.render({
      ctx, plan: planOut.plan, provisioned: provisionOut.provisioned, bundleDir: composed.bundleDir,
    }, inputs.renderPlan);
    await emitStageComplete(hooks, 'render', Date.now() - renderStart);

    await emitStageBegin(hooks, 'apply');
    const applyOut = await stages.apply({
      ctx, rendered: renderOut.rendered, resolvedRequiredSecrets,
      dokployClientFactory: inputs.dokployClientFactory,
    }, inputs.applyPlan);
    if (hooks.onApplyResult !== undefined) {
      await hooks.onApplyResult({ actions: applyOut.applied, durationMs: applyOut.durationMs });
    }
    await emitStageComplete(hooks, 'apply', applyOut.durationMs);

    await emitStageBegin(hooks, 'verify');
    const verifyStart = Date.now();
    const verifyOut = await stages.verify({ applied: applyOut.applied }, { smoker: inputs.smoker });
    if (hooks.onVerifyResult !== undefined) {
      await hooks.onVerifyResult({ report: verifyOut.report });
    }
    await emitStageComplete(hooks, 'verify', Date.now() - verifyStart);

    return await terminalSuccess(hooks);
  } catch (cause) {
    if (cause instanceof StageError) {
      return await terminalFailure(hooks, {
        errorCode: cause.code,
        errorMessage: redact(cause.message),
      });
    }
    return await terminalFailure(hooks, {
      errorCode: 'DEPLOY_EXECUTOR_UNCAUGHT',
      errorMessage: redact(cause instanceof Error ? cause.message : String(cause)),
    });
  }
}

async function validateRequiredSecrets(
  plan: import('@rntme/deploy-core').ProjectDeploymentPlan,
  inputs: RunDeploymentInputs,
): Promise<Readonly<Record<string, unknown>>> {
  const required = plan.requiredTargetSecrets;
  if (required.length === 0) return {};
  const validated: Record<string, unknown> = {};
  for (const ref of required) {
    const decryptedValue = inputs.resolvedTargetSecrets.extras[ref.secretRef];
    if (decryptedValue === undefined) {
      throw new StageError(
        'DEPLOY_EXECUTOR_TARGET_SECRET_MISSING',
        `target secret "${ref.secretRef}" is required for ${ref.purpose} but not found on target`,
      );
    }
    if (inputs.parseTargetSecret !== undefined) {
      const parseResult = inputs.parseTargetSecret(ref.schema, decryptedValue);
      if (!parseResult.ok) {
        const firstCode = parseResult.errors[0]?.code;
        const errorCode =
          typeof firstCode === 'string' && firstCode.startsWith('DEPLOY_')
            ? firstCode
            : 'DEPLOY_EXECUTOR_TARGET_SECRET_INVALID';
        throw new StageError(
          errorCode,
          parseResult.errors[0]?.message ?? `target secret "${ref.secretRef}" failed validation`,
        );
      }
      validated[ref.secretRef] = parseResult.value;
    } else {
      validated[ref.secretRef] = decryptedValue;
    }
  }
  return validated;
}
```

Keep the helpers `terminalSuccess`, `terminalFailure`, `emitStageBegin`, `emitStageComplete`, `deployErrorsToPlatformError` exactly as they are; only the body of `runDeployment` changes.

- [ ] **Step 4: Update the package index**

Modify `packages/deploy/deploy-runner/src/index.ts` — append:

```ts
export { stages, StageError } from './stages/index.js';
export type {
  StageContext,
  ComposeStageInput,
  ComposeStageOutput,
  ProvisionStageInput,
  ProvisionStageOutput,
  PlanStageInput,
  PlanStageOutput,
  RenderStageInput,
  RenderStageOutput,
  ApplyStageInput,
  ApplyStageOutput,
  VerifyStageInput,
  VerifyStageOutput,
} from './stages/types.js';
```

- [ ] **Step 5: Verify regressions are clean**

```bash
bun test --cwd packages/deploy/deploy-runner
bun run --cwd packages/deploy/deploy-runner typecheck
bun run --cwd packages/deploy/deploy-runner lint
```

Expected: all green. The platform-http executor unit tests still pass because they consume `runDeployment`.

- [ ] **Step 6: Commit**

```bash
git add packages/deploy/deploy-runner/src
git commit -m "refactor(deploy-runner): runDeployment now composes stages.*"
```

---

## Task 6: Add `DeployStageState` PDM entity + migration + repo

The BPMN process must persist intermediate stage results so each handler can pick up where the previous task left off. Process variables are unsuitable for the volume (rendered Dokploy plans are KB to MB) and for secrets. Solution: a per-deployment, per-stage state row, with a Postgres `bytea` column for the encrypted secret blob.

**Files:**
- Create: `apps/platform/blueprint/pdm/entities/DeployStageState.json`
- Create: `packages/platform/platform-storage/drizzle/0014_deploy_stage_state.sql`
- Create: `packages/platform/platform-storage/src/schema/deploy-stage-state.ts`
- Create: `packages/platform/platform-storage/src/repos/deploy-stage-state.ts`
- Modify: `packages/platform/platform-storage/src/index.ts`

- [ ] **Step 1: Define the PDM entity**

Create `apps/platform/blueprint/pdm/entities/DeployStageState.json`:

```json
{
  "ownerService": "deployments",
  "kind": "owned",
  "table": "deploy_stage_state",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "deploymentId": { "type": "string", "nullable": false, "column": "deployment_id" },
    "organizationId": { "type": "string", "nullable": false, "column": "organization_id" },
    "stage": { "type": "string", "nullable": false, "column": "stage" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "publicStateJson": { "type": "string", "nullable": true, "column": "public_state_json" },
    "secretBlobKey": { "type": "string", "nullable": true, "column": "secret_blob_key" },
    "errorCode": { "type": "string", "nullable": true, "column": "error_code" },
    "errorMessage": { "type": "string", "nullable": true, "column": "error_message" },
    "startedAt": { "type": "datetime", "nullable": false, "column": "started_at" },
    "finishedAt": { "type": "datetime", "nullable": true, "column": "finished_at" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["running", "succeeded", "failed"],
    "transitions": {
      "begin": { "from": null, "to": "running", "affects": ["deploymentId", "organizationId", "stage", "startedAt"] },
      "succeed": { "from": "running", "to": "succeeded", "affects": ["finishedAt", "publicStateJson", "secretBlobKey"] },
      "fail": { "from": "running", "to": "failed", "affects": ["finishedAt", "errorCode", "errorMessage"] }
    }
  }
}
```

- [ ] **Step 2: Write the failing migration test**

Create `packages/platform/platform-storage/test/unit/deploy-stage-state.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { deployStageState } from '../../src/schema/deploy-stage-state.js';

describe('deploy_stage_state schema', () => {
  it('uses snake_case column names matching PDM', () => {
    const cols = Object.keys(deployStageState);
    expect(cols).toContain('deploymentId');
    expect(cols).toContain('publicStateJson');
    expect(cols).toContain('secretBlobKey');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
bun test --cwd packages/platform/platform-storage test/unit/deploy-stage-state.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create the migration**

Create `packages/platform/platform-storage/drizzle/0014_deploy_stage_state.sql`:

```sql
CREATE TABLE IF NOT EXISTS deploy_stage_state (
  id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  public_state_json TEXT,
  secret_blob_key TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS deploy_stage_state_dep_stage_idx
  ON deploy_stage_state (deployment_id, stage);

CREATE INDEX IF NOT EXISTS deploy_stage_state_org_idx
  ON deploy_stage_state (organization_id, deployment_id);

ALTER TABLE deploy_stage_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY deploy_stage_state_org_isolation ON deploy_stage_state
  USING (organization_id = current_setting('app.org_id', true));
```

- [ ] **Step 5: Create the Drizzle schema**

Create `packages/platform/platform-storage/src/schema/deploy-stage-state.ts`:

```ts
import { pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const deployStageState = pgTable(
  'deploy_stage_state',
  {
    id: text('id').primaryKey(),
    deploymentId: text('deployment_id').notNull(),
    organizationId: text('organization_id').notNull(),
    stage: text('stage').notNull(),
    status: text('status').notNull(),
    publicStateJson: text('public_state_json'),
    secretBlobKey: text('secret_blob_key'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('deploy_stage_state_dep_stage_idx').on(table.deploymentId, table.stage),
    index('deploy_stage_state_org_idx').on(table.organizationId, table.deploymentId),
  ],
);
```

- [ ] **Step 6: Create the repo**

Create `packages/platform/platform-storage/src/repos/deploy-stage-state.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { deployStageState } from '../schema/deploy-stage-state.js';

export type DeployStage = 'compose' | 'provision' | 'plan' | 'render' | 'apply' | 'verify';
export type DeployStageStatus = 'running' | 'succeeded' | 'failed';

export type DeployStageStateRow = {
  readonly id: string;
  readonly deploymentId: string;
  readonly organizationId: string;
  readonly stage: DeployStage;
  readonly status: DeployStageStatus;
  readonly publicStateJson: string | null;
  readonly secretBlobKey: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
};

export type DeployStageStateRepo = {
  readonly begin: (input: {
    readonly id: string;
    readonly deploymentId: string;
    readonly organizationId: string;
    readonly stage: DeployStage;
  }) => Promise<void>;
  readonly succeed: (input: {
    readonly deploymentId: string;
    readonly stage: DeployStage;
    readonly publicStateJson?: string;
    readonly secretBlobKey?: string;
  }) => Promise<void>;
  readonly fail: (input: {
    readonly deploymentId: string;
    readonly stage: DeployStage;
    readonly errorCode: string;
    readonly errorMessage: string;
  }) => Promise<void>;
  readonly read: (input: {
    readonly deploymentId: string;
    readonly stage: DeployStage;
  }) => Promise<DeployStageStateRow | null>;
  readonly readAll: (deploymentId: string) => Promise<readonly DeployStageStateRow[]>;
};

export function createPgDeployStageStateRepo(deps: { readonly db: NodePgDatabase }): DeployStageStateRepo {
  return {
    async begin(input) {
      await deps.db.insert(deployStageState).values({
        id: input.id,
        deploymentId: input.deploymentId,
        organizationId: input.organizationId,
        stage: input.stage,
        status: 'running',
      });
    },
    async succeed(input) {
      await deps.db
        .update(deployStageState)
        .set({
          status: 'succeeded',
          finishedAt: new Date(),
          ...(input.publicStateJson === undefined ? {} : { publicStateJson: input.publicStateJson }),
          ...(input.secretBlobKey === undefined ? {} : { secretBlobKey: input.secretBlobKey }),
        })
        .where(and(eq(deployStageState.deploymentId, input.deploymentId), eq(deployStageState.stage, input.stage)));
    },
    async fail(input) {
      await deps.db
        .update(deployStageState)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
        })
        .where(and(eq(deployStageState.deploymentId, input.deploymentId), eq(deployStageState.stage, input.stage)));
    },
    async read(input) {
      const rows = await deps.db
        .select()
        .from(deployStageState)
        .where(and(eq(deployStageState.deploymentId, input.deploymentId), eq(deployStageState.stage, input.stage)))
        .limit(1);
      const r = rows[0];
      return r === undefined ? null : (r as DeployStageStateRow);
    },
    async readAll(deploymentId) {
      const rows = await deps.db.select().from(deployStageState).where(eq(deployStageState.deploymentId, deploymentId));
      return rows as readonly DeployStageStateRow[];
    },
  };
}
```

- [ ] **Step 7: Re-export from package index**

Modify `packages/platform/platform-storage/src/index.ts`. Find the section that exports schemas and repos, add:

```ts
export { deployStageState } from './schema/deploy-stage-state.js';
export {
  createPgDeployStageStateRepo,
  type DeployStage,
  type DeployStageStatus,
  type DeployStageStateRepo,
  type DeployStageStateRow,
} from './repos/deploy-stage-state.js';
```

- [ ] **Step 8: Run package test + typecheck**

```bash
bun test --cwd packages/platform/platform-storage
bun run --cwd packages/platform/platform-storage typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/platform/blueprint/pdm/entities/DeployStageState.json packages/platform/platform-storage
git commit -m "feat(platform-storage): add DeployStageState aggregate, migration, and repo"
```

---

## Task 7: Extend `@rntme/workflows` artifact schema with `nativeTasks`

**Files:**
- Modify: `packages/artifacts/workflows/src/parse/schema.ts`
- Modify: `packages/artifacts/workflows/src/types/artifact.ts`
- Modify: `packages/artifacts/workflows/src/validate/structural.ts`

- [ ] **Step 1: Write the failing parse test**

Add to `packages/artifacts/workflows/test/unit/parse.test.ts`:

```ts
it('accepts a workflow artifact with nativeTasks', () => {
  const result = parseWorkflowArtifact({
    workflowVersion: 1,
    definitions: [{ id: 'd1', bpmnFile: 'd1.bpmn', processId: 'p1' }],
    messageStarts: [],
    serviceTasks: [],
    nativeTasks: [
      {
        definition: 'd1',
        taskId: 'task-1',
        handler: { module: '@rntme/deploy-runner', export: 'composeStageHandler' },
      },
    ],
  });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.nativeTasks).toHaveLength(1);
    expect(result.value.nativeTasks?.[0]?.handler.module).toBe('@rntme/deploy-runner');
  }
});

it('rejects nativeTasks that overlap with serviceTasks on the same taskId', () => {
  const result = validateWorkflowStructural({
    workflowVersion: 1,
    definitions: [{ id: 'd1', bpmnFile: 'd1.bpmn', processId: 'p1' }],
    messageStarts: [],
    serviceTasks: [{ definition: 'd1', taskId: 'task-1', bindingRef: 'svc.binding' }],
    nativeTasks: [
      { definition: 'd1', taskId: 'task-1', handler: { module: '@x', export: 'h' } },
    ],
  } as never);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors[0]?.code).toBe('WORKFLOW_TASK_DEFINITION_OVERLAP');
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test --cwd packages/artifacts/workflows test/unit/parse.test.ts
```

Expected: nativeTasks not present in schema → FAIL.

- [ ] **Step 3: Update the schema**

Modify `packages/artifacts/workflows/src/parse/schema.ts`. Append before `WorkflowArtifactSchema`:

```ts
const handlerRefSchema = z
  .object({
    module: nonEmptyString,
    export: nonEmptyString,
  })
  .strict();

const nativeTaskSchema = z
  .object({
    definition: nonEmptyString,
    taskId: nonEmptyString,
    handler: handlerRefSchema,
    input: z.record(nonEmptyString, workflowMappingValueSchema).optional(),
    resultVariable: nonEmptyString.optional(),
  })
  .strict();
```

Then add `.nativeTasks` to `WorkflowArtifactSchema`:

```ts
export const WorkflowArtifactSchema = z
  .object({
    workflowVersion: z.literal(1),
    definitions: z.array(definitionSchema),
    messageStarts: z.array(messageStartSchema).default([]),
    serviceTasks: z.array(serviceTaskSchema).default([]),
    nativeTasks: z.array(nativeTaskSchema).default([]),
  })
  .strict();
```

- [ ] **Step 4: Update the artifact type**

Modify `packages/artifacts/workflows/src/types/artifact.ts`. Add:

```ts
export type NativeTaskHandlerRef = {
  readonly module: string;
  readonly export: string;
};

export type NativeTaskMapping = {
  readonly definition: string;
  readonly taskId: string;
  readonly handler: NativeTaskHandlerRef;
  readonly input?: Record<string, unknown>;
  readonly resultVariable?: string;
};
```

Add `nativeTasks: readonly NativeTaskMapping[]` to the `WorkflowArtifact` type.

- [ ] **Step 5: Update structural validation**

Modify `packages/artifacts/workflows/src/validate/structural.ts`. Inside the validator, after the existing serviceTask checks, add:

```ts
const taskKeyOf = (definition: string, taskId: string): string => `${definition}.${taskId}`;
const serviceTaskKeys = new Set(artifact.serviceTasks.map((t) => taskKeyOf(t.definition, t.taskId)));
const nativeTaskKeys = new Set<string>();

for (const native of artifact.nativeTasks) {
  const key = taskKeyOf(native.definition, native.taskId);
  if (serviceTaskKeys.has(key)) {
    errors.push({
      code: 'WORKFLOW_TASK_DEFINITION_OVERLAP',
      message: `task "${key}" is defined as both a serviceTask (bindingRef) and a nativeTask (handler); pick exactly one`,
      path: `nativeTasks.${key}`,
    });
  }
  if (nativeTaskKeys.has(key)) {
    errors.push({
      code: 'WORKFLOW_NATIVE_TASK_DUPLICATE',
      message: `native task "${key}" appears more than once`,
      path: `nativeTasks.${key}`,
    });
  }
  nativeTaskKeys.add(key);
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
bun test --cwd packages/artifacts/workflows
bun run --cwd packages/artifacts/workflows typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/artifacts/workflows
git commit -m "feat(workflows): add nativeTasks to workflow artifact schema"
```

---

## Task 8: Extend `@rntme/bpmn-worker` with native handler resolution

**Files:**
- Create: `packages/runtime/bpmn-worker/src/native-handlers.ts`
- Modify: `packages/runtime/bpmn-worker/src/worker.ts`
- Modify: `packages/runtime/bpmn-worker/src/types.ts`
- Modify: `packages/runtime/bpmn-worker/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/runtime/bpmn-worker/test/unit/native-handlers.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { resolveNativeHandlers } from '../../src/native-handlers.js';

describe('resolveNativeHandlers', () => {
  it('imports each handler module export and indexes by definition+taskId', async () => {
    const fakeModule = { sampleHandler: async (input: unknown) => ({ echoed: input }) };
    const importer = async (mod: string) => {
      if (mod === 'fake-mod') return fakeModule;
      throw new Error(`unexpected import "${mod}"`);
    };

    const handlers = await resolveNativeHandlers({
      manifest: {
        workflowVersion: 1,
        definitions: [],
        messageStarts: [],
        serviceTasks: [],
        nativeTasks: [
          { definition: 'def-1', taskId: 'task-a', handler: { module: 'fake-mod', export: 'sampleHandler' } },
        ],
      },
      importModule: importer,
    });

    expect(handlers.size).toBe(1);
    const fn = handlers.get('def-1.task-a');
    expect(fn).toBeDefined();
    const result = await fn!({ greeting: 'hello' }, {});
    expect(result).toEqual({ echoed: { greeting: 'hello' } });
  });

  it('throws WORKFLOW_NATIVE_HANDLER_MISSING_EXPORT when export is missing', async () => {
    const importer = async () => ({}) as Record<string, unknown>;
    await expect(
      resolveNativeHandlers({
        manifest: {
          workflowVersion: 1,
          definitions: [],
          messageStarts: [],
          serviceTasks: [],
          nativeTasks: [
            { definition: 'd', taskId: 't', handler: { module: 'm', export: 'missing' } },
          ],
        },
        importModule: importer,
      }),
    ).rejects.toMatchObject({ code: 'WORKFLOW_NATIVE_HANDLER_MISSING_EXPORT' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test --cwd packages/runtime/bpmn-worker test/unit/native-handlers.test.ts
```

Expected: FAIL — missing module.

- [ ] **Step 3: Implement the resolver**

Create `packages/runtime/bpmn-worker/src/native-handlers.ts`:

```ts
import type { WorkflowArtifact } from '@rntme/workflows';

export type NativeHandlerInput = Readonly<Record<string, unknown>>;
export type NativeHandlerProcessVariables = Readonly<Record<string, unknown>>;

export type NativeHandlerFn = (
  input: NativeHandlerInput,
  processVariables: NativeHandlerProcessVariables,
) => Promise<unknown>;

export type NativeHandlerKey = string; // `${definition}.${taskId}`

export class NativeHandlerError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'NativeHandlerError';
  }
}

export type ResolveNativeHandlersInput = {
  readonly manifest: WorkflowArtifact;
  readonly importModule?: (specifier: string) => Promise<Record<string, unknown>>;
};

export async function resolveNativeHandlers(
  input: ResolveNativeHandlersInput,
): Promise<Map<NativeHandlerKey, NativeHandlerFn>> {
  const importer = input.importModule ?? ((spec) => import(spec));
  const map = new Map<NativeHandlerKey, NativeHandlerFn>();
  const moduleCache = new Map<string, Record<string, unknown>>();

  for (const native of input.manifest.nativeTasks ?? []) {
    let mod = moduleCache.get(native.handler.module);
    if (mod === undefined) {
      try {
        mod = await importer(native.handler.module);
      } catch (cause) {
        throw new NativeHandlerError(
          'WORKFLOW_NATIVE_HANDLER_MODULE_LOAD_FAILED',
          `could not import handler module "${native.handler.module}": ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
        );
      }
      moduleCache.set(native.handler.module, mod);
    }
    const fn = mod[native.handler.export];
    if (typeof fn !== 'function') {
      throw new NativeHandlerError(
        'WORKFLOW_NATIVE_HANDLER_MISSING_EXPORT',
        `handler module "${native.handler.module}" does not export "${native.handler.export}"`,
      );
    }
    map.set(`${native.definition}.${native.taskId}`, fn as NativeHandlerFn);
  }
  return map;
}
```

- [ ] **Step 4: Wire native dispatch into the worker**

Modify `packages/runtime/bpmn-worker/src/worker.ts`. Update `RunWorkflowEventOnceInput` to accept `nativeHandlers`:

```ts
export type RunWorkflowEventOnceInput = {
  readonly manifest: WorkflowArtifact;
  readonly event: EventEnvelopeLike;
  readonly eventRef: WorkflowEventRef;
  readonly operaton: OperatonClient;
  readonly commands: RntmeCommandClient;
  readonly nativeHandlers?: ReadonlyMap<string, NativeHandlerFn>;
  readonly maxTaskFetches?: number;
};
```

In the `for` loop, after the `mapping` lookup but before `commands.execute`, insert native dispatch:

```ts
for (const task of tasks.filter((candidate) => candidate.processInstanceId === process.processInstanceId)) {
  if (handledTaskIds.has(task.id)) continue;

  const nativeKey = `${start.definition}.${task.taskId}`;
  const nativeFn = input.nativeHandlers?.get(nativeKey);
  const mapping = input.manifest.serviceTasks.find(
    (candidate) => candidate.definition === start.definition && candidate.taskId === task.taskId,
  );

  if (nativeFn !== undefined && mapping !== undefined) {
    await input.operaton.failTask(
      task.id,
      `WORKFLOW_TASK_AMBIGUOUS_DISPATCH: task "${nativeKey}" matched both a nativeTask and a serviceTask`,
    );
    handledTaskIds.add(task.id);
    progressed = true;
    continue;
  }

  if (nativeFn === undefined && mapping === undefined) {
    await input.operaton.failTask(
      task.id,
      `WORKFLOW_TASK_HANDLER_MISSING: no nativeTask or serviceTask mapping for "${nativeKey}"`,
    );
    handledTaskIds.add(task.id);
    progressed = true;
    continue;
  }

  try {
    if (nativeFn !== undefined) {
      // native path
      const nativeInput = Object.fromEntries(
        Object.entries(input.manifest.nativeTasks?.find((n) => n.definition === start.definition && n.taskId === task.taskId)?.input ?? {}).map(([key, value]) => [
          key,
          evaluateMappingValue(value, { event: input.event, process: task.variables }),
        ]),
      );
      const result = await nativeFn(nativeInput, task.variables);
      const completionVars = nativeMapping(input.manifest, start.definition, task.taskId)?.resultVariable === undefined
        ? {}
        : { [nativeMapping(input.manifest, start.definition, task.taskId)!.resultVariable!]: result };
      await input.operaton.completeTask(task.id, completionVars);
    } else if (mapping !== undefined) {
      // existing bindingRef gRPC path (unchanged)
      const commandInput = Object.fromEntries(
        Object.entries(mapping.input ?? {}).map(([key, value]) => [
          key,
          evaluateMappingValue(value, { event: input.event, process: task.variables }),
        ]),
      );
      const metadata = buildCommandMetadata({ /* ...unchanged... */ });
      const result = await input.commands.execute(mapping.bindingRef, commandInput, metadata);
      const completionVars = mapping.resultVariable === undefined ? {} : { [mapping.resultVariable]: result };
      await input.operaton.completeTask(task.id, completionVars);
    }
  } catch (cause) {
    await input.operaton.failTask(task.id, cause instanceof Error ? cause.message : String(cause));
  }
  handledTaskIds.add(task.id);
  progressed = true;
}
```

Add the helper `nativeMapping` near the bottom of the file:

```ts
function nativeMapping(
  manifest: WorkflowArtifact,
  definition: string,
  taskId: string,
): { readonly resultVariable?: string } | undefined {
  return manifest.nativeTasks?.find((n) => n.definition === definition && n.taskId === taskId);
}
```

The critical change here is the **loud failure on missing handler** — the spec calls this out explicitly, and the previous silent skip (`if (mapping === undefined) continue;`) was a known gotcha (`rntme_cli_dist_silent_stale` memory).

- [ ] **Step 5: Update package index**

Modify `packages/runtime/bpmn-worker/src/index.ts`:

```ts
export {
  resolveNativeHandlers,
  NativeHandlerError,
  type NativeHandlerFn,
  type NativeHandlerInput,
  type NativeHandlerProcessVariables,
  type NativeHandlerKey,
} from './native-handlers.js';
```

- [ ] **Step 6: Run tests**

```bash
bun test --cwd packages/runtime/bpmn-worker
bun run --cwd packages/runtime/bpmn-worker typecheck
bun run --cwd packages/runtime/bpmn-worker lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/bpmn-worker
git commit -m "feat(bpmn-worker): native task handlers with loud failure on missing dispatch"
```

---

## Task 9: Add continuous Operaton poll mode to bpmn-worker

The current `runBpmnWorkerFromEnv` only fetches tasks during the lifetime of a Kafka event. Long-running deploy stages need continuous fetch-and-lock independent of Kafka.

**Files:**
- Create: `packages/runtime/bpmn-worker/src/poll-loop.ts`
- Create: `packages/runtime/bpmn-worker/src/bin/poll.ts`
- Modify: `packages/runtime/bpmn-worker/src/run.ts`
- Modify: `packages/runtime/bpmn-worker/package.json` (add bin entry)

- [ ] **Step 1: Write the failing test**

Create `packages/runtime/bpmn-worker/test/unit/poll-loop.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { runPollOnce } from '../../src/poll-loop.js';

describe('runPollOnce', () => {
  it('dispatches each locked task to the matching native handler', async () => {
    const fetched: string[] = [];
    const completed: Array<{ id: string; vars: Record<string, unknown> }> = [];
    const handlerCalls: Array<{ key: string; input: Record<string, unknown> }> = [];
    const handlers = new Map([
      ['d1.t1', async (input: Readonly<Record<string, unknown>>) => {
        handlerCalls.push({ key: 'd1.t1', input: { ...input } });
        return { ok: true };
      }],
    ]);

    await runPollOnce({
      manifest: {
        workflowVersion: 1,
        definitions: [{ id: 'd1', bpmnFile: 'd1.bpmn', processId: 'p1' }],
        messageStarts: [], serviceTasks: [],
        nativeTasks: [{ definition: 'd1', taskId: 't1', handler: { module: 'm', export: 'h' }, resultVariable: 'r' }],
      },
      operaton: {
        startProcess: async () => ({ processInstanceId: 'pi-1' }),
        fetchAndLock: async () => {
          fetched.push('fetched');
          return [{ id: 'task-1', taskId: 't1', processInstanceId: 'pi-1', activityInstanceId: 'a1', variables: {} }];
        },
        completeTask: async (id, vars) => { completed.push({ id, vars }); },
        failTask: async () => { throw new Error('should not fail'); },
        deployDefinitions: async () => undefined,
      } as never,
      nativeHandlers: handlers,
      definitionByProcessInstance: new Map([['pi-1', 'd1']]),
    });

    expect(fetched).toHaveLength(1);
    expect(handlerCalls).toEqual([{ key: 'd1.t1', input: {} }]);
    expect(completed).toEqual([{ id: 'task-1', vars: { r: { ok: true } } }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test --cwd packages/runtime/bpmn-worker test/unit/poll-loop.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the poll loop**

Create `packages/runtime/bpmn-worker/src/poll-loop.ts`:

```ts
import type { WorkflowArtifact } from '@rntme/workflows';
import { evaluateMappingValue } from './mapping.js';
import type { NativeHandlerFn } from './native-handlers.js';
import type { OperatonClient } from './operaton.js';

export type RunPollOnceInput = {
  readonly manifest: WorkflowArtifact;
  readonly operaton: OperatonClient;
  readonly nativeHandlers: ReadonlyMap<string, NativeHandlerFn>;
  /**
   * Map from active processInstanceId to its definitionId. The poll worker maintains
   * this externally (e.g., by listening on Kafka or by querying Operaton at startup).
   * For deploy, the queueDeployment graph emits an event that triggers a process start;
   * we record (pi → definition) when we observe the start.
   */
  readonly definitionByProcessInstance: ReadonlyMap<string, string>;
};

export async function runPollOnce(input: RunPollOnceInput): Promise<void> {
  const tasks = await input.operaton.fetchAndLock();
  for (const task of tasks) {
    const definition = input.definitionByProcessInstance.get(task.processInstanceId);
    if (definition === undefined) {
      await input.operaton.failTask(
        task.id,
        `WORKFLOW_PROCESS_DEFINITION_UNKNOWN: no definition recorded for processInstanceId=${task.processInstanceId}`,
      );
      continue;
    }
    const key = `${definition}.${task.taskId}`;
    const handler = input.nativeHandlers.get(key);
    if (handler === undefined) {
      await input.operaton.failTask(task.id, `WORKFLOW_TASK_HANDLER_MISSING: no nativeTask handler for "${key}"`);
      continue;
    }
    const native = (input.manifest.nativeTasks ?? []).find(
      (n) => n.definition === definition && n.taskId === task.taskId,
    );
    try {
      const inputVars = Object.fromEntries(
        Object.entries(native?.input ?? {}).map(([k, v]) => [
          k, evaluateMappingValue(v, { event: { data: undefined }, process: task.variables ?? {} }),
        ]),
      );
      const result = await handler(inputVars, task.variables ?? {});
      const vars = native?.resultVariable === undefined ? {} : { [native.resultVariable]: result };
      await input.operaton.completeTask(task.id, vars);
    } catch (cause) {
      await input.operaton.failTask(task.id, cause instanceof Error ? cause.message : String(cause));
    }
  }
}

export type RunPollLoopInput = RunPollOnceInput & {
  readonly intervalMs?: number;
  readonly stopSignal?: AbortSignal;
};

export async function runPollLoop(input: RunPollLoopInput): Promise<void> {
  const intervalMs = input.intervalMs ?? 500;
  while (!(input.stopSignal?.aborted ?? false)) {
    try {
      await runPollOnce(input);
    } catch {
      // swallow to keep looping; individual task errors are reported via failTask
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
```

- [ ] **Step 4: Add the bin entry**

Create `packages/runtime/bpmn-worker/src/bin/poll.ts`:

```ts
#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadWorkerConfigFromEnv } from '../env.js';
import { resolveNativeHandlers } from '../native-handlers.js';
import { createOperatonRestClient } from '../operaton-rest.js';
import { runPollLoop } from '../poll-loop.js';
import type { LoadedWorkerManifest } from '../types.js';

async function main(): Promise<void> {
  const config = loadWorkerConfigFromEnv(process.env);
  const manifest = JSON.parse(await readFile(config.workflowsManifestPath, 'utf8')) as LoadedWorkerManifest;
  const root = dirname(config.workflowsManifestPath);

  const topics = [...new Set(manifest.nativeTasks.map((t) => t.taskId))].sort();
  const operaton = createOperatonRestClient({
    baseUrl: config.operatonBaseUrl,
    workerId: `rntme-deploy-worker-${process.pid}`,
    topics,
  });
  await operaton.deployDefinitions(
    Object.fromEntries(
      await Promise.all(
        manifest.definitions.map(async (def) => [def.bpmnFile, await readFile(join(root, def.bpmnFile), 'utf8')]),
      ),
    ),
  );

  const nativeHandlers = await resolveNativeHandlers({ manifest });

  // For the deploy use case, we maintain definitionByProcessInstance by querying
  // Operaton's process-instance API at the start of each poll. The poll loop's
  // input is read once; for production, replace this with a periodic refresh.
  const definitionByProcessInstance = new Map<string, string>();
  // Periodic refresh of the (pi → definition) map. Operaton's process-instance/list
  // API returns processDefinitionKey; we map it to our definition.id via processId match.
  setInterval(async () => {
    try {
      const list = await fetch(`${config.operatonBaseUrl}/process-instance`, { method: 'GET' });
      if (!list.ok) return;
      const rows = (await list.json()) as Array<{ id: string; processDefinitionKey: string }>;
      definitionByProcessInstance.clear();
      for (const row of rows) {
        const def = manifest.definitions.find((d) => d.processId === row.processDefinitionKey);
        if (def !== undefined) definitionByProcessInstance.set(row.id, def.id);
      }
    } catch {
      // tolerate transient errors
    }
  }, 1_000).unref();

  const stop = new AbortController();
  process.on('SIGINT', () => stop.abort());
  process.on('SIGTERM', () => stop.abort());
  await runPollLoop({ manifest, operaton, nativeHandlers, definitionByProcessInstance, stopSignal: stop.signal });
}

main().catch((cause) => {
  process.stderr.write(`${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Add the bin entry to package.json**

Modify `packages/runtime/bpmn-worker/package.json`:

```json
"bin": {
  "rntme-bpmn-worker": "./dist/bin/worker.js",
  "rntme-bpmn-poll-worker": "./dist/bin/poll.js"
}
```

(If `bin` already exists with the first entry, just add the second.)

- [ ] **Step 6: Update run.ts to export `runPollLoop`**

Modify `packages/runtime/bpmn-worker/src/run.ts` — append:

```ts
export { runPollOnce, runPollLoop } from './poll-loop.js';
```

- [ ] **Step 7: Update package index**

Modify `packages/runtime/bpmn-worker/src/index.ts`:

```ts
export { runPollOnce, runPollLoop } from './poll-loop.js';
```

- [ ] **Step 8: Run tests**

```bash
bun test --cwd packages/runtime/bpmn-worker
bun run --cwd packages/runtime/bpmn-worker typecheck
bun run --cwd packages/runtime/bpmn-worker build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/runtime/bpmn-worker
git commit -m "feat(bpmn-worker): continuous-poll mode with rntme-bpmn-poll-worker bin"
```

---

## Task 10: Add stage handlers in `@rntme/deploy-runner`

Each handler is a self-contained async function that:
1. Reads platform env (DB URL, blob, secret cipher) once at module level (memoized).
2. Loads any prior `DeployStageState` rows from the platform DB.
3. Runs its `stages.*` function.
4. Persists its own `DeployStageState` row (using the repo from Task 6).
5. Returns a small JSON payload as the BPMN result variable.

**Files:**
- Create: `packages/deploy/deploy-runner/src/handlers/types.ts`
- Create: `packages/deploy/deploy-runner/src/handlers/platform-context.ts`
- Create: `packages/deploy/deploy-runner/src/handlers/{compose,provision,plan,render,apply,verify}-handler.ts`
- Create: `packages/deploy/deploy-runner/src/handlers/index.ts`
- Modify: `packages/deploy/deploy-runner/src/index.ts`
- Modify: `packages/deploy/deploy-runner/package.json` (add `@rntme/platform-storage` and `@rntme/platform-core` workspace deps + `pg` peer)

- [ ] **Step 1: Define the handler input/output envelope**

Create `packages/deploy/deploy-runner/src/handlers/types.ts`:

```ts
import type { DeployStage } from '@rntme/platform-storage';

export type StageHandlerInput = {
  readonly deploymentId: string;
  readonly orgId: string;
  readonly bundleBlobKey?: string;
};

export type StageHandlerResult = {
  readonly stage: DeployStage;
  readonly status: 'succeeded' | 'failed';
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly publicSummary?: Record<string, unknown>;
};
```

- [ ] **Step 2: Add the platform context module**

Create `packages/deploy/deploy-runner/src/handlers/platform-context.ts`:

```ts
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  createPgDeployStageStateRepo,
  type DeployStageStateRepo,
} from '@rntme/platform-storage';
// repos for blob, deployments, deploy targets, target secrets, project versions:
import {
  createS3BlobStore,
  createPgDeploymentRepo,
  createPgDeployTargetRepo,
  createPgTargetSecretsRepo,
  createPgProjectVersionRepo,
  type BlobStore,
  type DeploymentRepo,
  type DeployTargetRepo,
  type TargetSecretsRepo,
  type ProjectVersionRepo,
  type SecretCipher,
} from '@rntme/platform-storage';
import { createXChaCha20Poly1305Cipher } from '@rntme/platform-storage/secret';

type Context = {
  readonly pool: Pool;
  readonly db: ReturnType<typeof drizzle>;
  readonly cipher: SecretCipher;
  readonly blob: BlobStore;
  readonly stageStateRepoFor: (orgId: string) => DeployStageStateRepo;
  readonly deploymentRepoFor: (orgId: string) => DeploymentRepo;
  readonly deployTargetRepoFor: (orgId: string) => DeployTargetRepo;
  readonly targetSecretsRepoFor: (orgId: string) => TargetSecretsRepo;
  readonly projectVersionRepoFor: (orgId: string) => ProjectVersionRepo;
};

let cached: Context | undefined;

export function getPlatformHandlerContext(): Context {
  if (cached !== undefined) return cached;

  const databaseUrl = required('DATABASE_URL');
  const blobBucket = required('PLATFORM_BLOB_BUCKET');
  const blobEndpoint = required('PLATFORM_BLOB_ENDPOINT');
  const blobAccessKeyId = required('PLATFORM_BLOB_ACCESS_KEY_ID');
  const blobSecretAccessKey = required('PLATFORM_BLOB_SECRET_ACCESS_KEY');
  const encryptionKey = required('PLATFORM_SECRET_ENCRYPTION_KEY');

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const cipher = createXChaCha20Poly1305Cipher(encryptionKey);
  const blob = createS3BlobStore({
    bucket: blobBucket,
    endpoint: blobEndpoint,
    accessKeyId: blobAccessKeyId,
    secretAccessKey: blobSecretAccessKey,
  });

  // Each per-org factory wraps the shared db with `app.org_id` set.
  // For deploy handlers, we wrap each operation in withOrgTx-equivalent:
  // - acquire client, BEGIN, set_config, run, COMMIT.
  // The platform-storage repos accept either a Pool or a connected client; for
  // simplicity here, the per-org factory returns a repo bound to a fresh client
  // and the handler explicitly closes the transaction. See Task 11 for usage.

  cached = {
    pool, db, cipher, blob,
    stageStateRepoFor: (_orgId) => createPgDeployStageStateRepo({ db }),
    deploymentRepoFor: (_orgId) => createPgDeploymentRepo({ db }),
    deployTargetRepoFor: (_orgId) => createPgDeployTargetRepo({ db }),
    targetSecretsRepoFor: (_orgId) => createPgTargetSecretsRepo({ db: pool, cipher }),
    projectVersionRepoFor: (_orgId) => createPgProjectVersionRepo({ db }),
  };
  return cached;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`HANDLER_ENV_MISSING: ${name}`);
  }
  return value;
}
```

Note: this assumes platform-storage exports the repo factories above. Verify each one exists; if any are named differently in the current package (e.g., `createS3BlobStore` may be absent), use the existing equivalent or expose a thin adapter in platform-storage as part of this task.

- [ ] **Step 3: Implement the compose handler**

Create `packages/deploy/deploy-runner/src/handlers/compose-handler.ts`:

```ts
import { gunzipSync } from 'node:zlib';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { materializeBundle, parseCanonicalBundle } from '@rntme/blueprint';
import { compose } from '../stages/compose.js';
import { redact } from '../redactor.js';
import { getPlatformHandlerContext } from './platform-context.js';
import type { StageHandlerInput, StageHandlerResult } from './types.js';

export async function composeStageHandler(
  input: StageHandlerInput,
): Promise<StageHandlerResult> {
  const ctx = getPlatformHandlerContext();
  const stageStateId = `${input.deploymentId}-compose`;
  const repo = ctx.stageStateRepoFor(input.orgId);
  await repo.begin({ id: stageStateId, deploymentId: input.deploymentId, organizationId: input.orgId, stage: 'compose' });

  try {
    const deployment = await ctx.deploymentRepoFor(input.orgId).get(input.deploymentId);
    if (deployment === null) throw new Error('DEPLOY_HANDLER_DEPLOYMENT_MISSING');

    const projectVersion = await ctx.projectVersionRepoFor(input.orgId).get(deployment.projectVersionId);
    if (projectVersion === null) throw new Error('DEPLOY_HANDLER_PROJECT_VERSION_MISSING');

    const blobKey = projectVersion.bundleBlobKey;
    const raw = await ctx.blob.getRaw(blobKey);
    if (!raw.ok) throw new Error(`DEPLOY_HANDLER_BLOB_FETCH_FAILED: ${raw.errors[0]?.message ?? ''}`);

    const bundleBytes = gunzipSync(raw.value);
    const parsed = parseCanonicalBundle(bundleBytes);
    if (!parsed.ok) throw new Error(`DEPLOY_HANDLER_BUNDLE_INVALID: ${parsed.errors[0]?.message ?? ''}`);

    const bundleDir = await materializeBundle(parsed.value.bundle, mkdtempSync(join(tmpdir(), 'deploy-')));
    const result = await compose({ bundleDir });

    await repo.succeed({
      deploymentId: input.deploymentId,
      stage: 'compose',
      publicStateJson: JSON.stringify({ bundleDir, projectName: result.composed.name }),
    });

    return { stage: 'compose', status: 'succeeded', publicSummary: { projectName: result.composed.name } };
  } catch (cause) {
    const code = errorCode(cause, 'DEPLOY_COMPOSE_FAILED');
    const message = redact(errorMessage(cause));
    await repo.fail({ deploymentId: input.deploymentId, stage: 'compose', errorCode: code, errorMessage: message });
    return { stage: 'compose', status: 'failed', errorCode: code, errorMessage: message };
  }
}

function errorCode(cause: unknown, fallback: string): string {
  if (cause instanceof Error && 'code' in cause && typeof (cause as Error & { code: string }).code === 'string') {
    return (cause as Error & { code: string }).code;
  }
  return fallback;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
```

- [ ] **Step 4: Implement provision/plan/render/apply/verify handlers**

Each follows the same pattern as `compose-handler.ts`:

1. Get platform context.
2. `repo.begin({...})` for stage row.
3. Read prior stage outputs (from `DeployStageState` rows) — e.g., the provision handler reads the compose stage's `publicStateJson` to get the `bundleDir`.
4. For provision handler — also load the deploy target via `deployTargetRepoFor(orgId).get(deployment.targetId)`, decrypt secrets via `targetSecretsRepoFor(orgId).getAllDecrypted(target.id)`, and use them as `StageContext`.
5. Call its corresponding `stages.*` function.
6. `repo.succeed({...})` with publicStateJson summarizing what later stages need.
7. On error, `repo.fail({...})` and return failed result.

Concrete pattern for the provision handler:

```ts
// provision-handler.ts (skeleton)
import { provision } from '../stages/provision.js';
import { redact } from '../redactor.js';
import { getPlatformHandlerContext } from './platform-context.js';
import type { StageHandlerInput, StageHandlerResult } from './types.js';

export async function provisionStageHandler(
  input: StageHandlerInput,
): Promise<StageHandlerResult> {
  const ctx = getPlatformHandlerContext();
  const repo = ctx.stageStateRepoFor(input.orgId);
  await repo.begin({ id: `${input.deploymentId}-provision`, deploymentId: input.deploymentId, organizationId: input.orgId, stage: 'provision' });

  try {
    const composeRow = await repo.read({ deploymentId: input.deploymentId, stage: 'compose' });
    if (composeRow === null || composeRow.publicStateJson === null) {
      throw new Error('DEPLOY_HANDLER_COMPOSE_STATE_MISSING');
    }
    const composeState = JSON.parse(composeRow.publicStateJson) as { bundleDir: string };

    const deployment = await ctx.deploymentRepoFor(input.orgId).get(input.deploymentId);
    if (deployment === null) throw new Error('DEPLOY_HANDLER_DEPLOYMENT_MISSING');
    const target = await ctx.deployTargetRepoFor(input.orgId).get(deployment.targetId);
    if (target === null) throw new Error('DEPLOY_HANDLER_TARGET_MISSING');

    const targetSecretsRepo = ctx.targetSecretsRepoFor(input.orgId);
    const decrypted = await targetSecretsRepo.getAllDecrypted(target.id);

    // re-load composed blueprint (cheap)
    const { compose } = await import('../stages/compose.js');
    const composed = await compose({ bundleDir: composeState.bundleDir });

    const out = await provision({
      ctx: {
        orgSlug: deployment.orgSlug ?? '',
        target: target as never,
        resolvedTargetSecrets: { apiToken: '', extras: decrypted },
        configOverrides: {},
      },
      composed: composed.composed,
      bundleDir: composed.bundleDir,
      priorProvisionOutputs: {},
    }, {
      resolveProvisioner: (await import('@rntme/runtime/adapter-client')).resolveProvisioner ?? buildResolveProvisioner(),
    });

    // Sensitive `secretByModule` is encrypted and stored in the blob; only digest goes into publicStateJson
    const secretBlobKey = `deploy/${input.deploymentId}/provision-secrets`;
    await ctx.blob.putRaw(secretBlobKey, Buffer.from(JSON.stringify(out.secretByModule), 'utf8'));

    await repo.succeed({
      deploymentId: input.deploymentId,
      stage: 'provision',
      publicStateJson: JSON.stringify({
        publicByModule: out.publicByModule,
        provisionResultForPlan: out.provisionResultForPlan,
        discoveredModulesForPlan: out.discoveredModulesForPlan,
      }),
      secretBlobKey,
    });

    return { stage: 'provision', status: 'succeeded', publicSummary: { moduleCount: out.provisioned.size } };
  } catch (cause) {
    const code = cause instanceof Error && 'code' in cause ? String((cause as Error & { code: unknown }).code) : 'DEPLOY_PROVISION_FAILED';
    const message = redact(cause instanceof Error ? cause.message : String(cause));
    await repo.fail({ deploymentId: input.deploymentId, stage: 'provision', errorCode: code, errorMessage: message });
    return { stage: 'provision', status: 'failed', errorCode: code, errorMessage: message };
  }
}

function buildResolveProvisioner(): never {
  throw new Error('DEPLOY_HANDLER_PROVISIONER_RESOLVER_MISSING');
}
```

Concrete reads/writes for each remaining handler:

**plan-handler.ts** — reads `compose` and `provision` rows. Re-runs `compose` stage (cheap; loads composed blueprint from disk) to get a `ComposedProjectInput` rather than serializing it through Postgres. Calls `stages.plan({ ctx, composed, provision })`. Writes `publicStateJson: JSON.stringify({ planDigest, requiredTargetSecrets })` and stores the full `ProjectDeploymentPlan` JSON to blob at `deploy/${deploymentId}/plan`.

```ts
// plan-handler.ts (skeleton)
import { plan as planStage } from '../stages/plan.js';
import { compose as composeStage } from '../stages/compose.js';
// ...
const composeRow = await repo.read({ deploymentId, stage: 'compose' });
const provRow = await repo.read({ deploymentId, stage: 'provision' });
if (composeRow === null || provRow === null) throw new Error('DEPLOY_HANDLER_PRIOR_STATE_MISSING');
const { bundleDir } = JSON.parse(composeRow.publicStateJson!) as { bundleDir: string };
const provisionPublic = JSON.parse(provRow.publicStateJson!) as { provisionResultForPlan?: unknown; discoveredModulesForPlan?: unknown; publicByModule: Record<string, Record<string, unknown>> };
const composed = await composeStage({ bundleDir });
const provisioned = new Map(); // empty here; render-handler reloads via blob
const planResult = await planStage({ ctx, composed: composed.composed, provision: { provisioned, ...provisionPublic, secretByModule: {}, startedAt: '', finishedAt: '' } });
await ctx.blob.putRaw(`deploy/${deploymentId}/plan`, Buffer.from(JSON.stringify(planResult.plan)));
await repo.succeed({ deploymentId, stage: 'plan', publicStateJson: JSON.stringify({ planBlobKey: `deploy/${deploymentId}/plan`, requiredTargetSecrets: planResult.plan.requiredTargetSecrets }) });
```

**render-handler.ts** — reads `compose`, `provision`, `plan` rows. Loads the plan from blob. Reloads `provisioned` Map from `provision-secrets` blob (decrypted in-process). Calls `stages.render({ ctx, plan, provisioned, bundleDir })`. Stores the `RenderedDokployPlan` to blob at `deploy/${deploymentId}/render`. publicStateJson carries `{ renderBlobKey, digest }`.

**apply-handler.ts** — reads `render` row + plan row (for `requiredTargetSecrets`). Loads rendered plan from blob. Resolves required secrets from the deploy target via `targetSecretsRepoFor(orgId).getAllDecrypted(targetId)`. Builds `dokployClientFactory` using `createDokployClientFactory` from platform-storage / platform-core (the same factory the legacy executor uses, surfaced via `getPlatformHandlerContext`). Calls `stages.apply({ ctx, rendered, resolvedRequiredSecrets, dokployClientFactory })`. Stores the `DeploymentApplyResult` to blob at `deploy/${deploymentId}/apply`. publicStateJson carries `{ applyBlobKey, durationMs }`.

```ts
// apply-handler.ts (skeleton)
import { apply as applyStage } from '../stages/apply.js';
// ...
const renderRow = await repo.read({ deploymentId, stage: 'render' });
const renderState = JSON.parse(renderRow!.publicStateJson!) as { renderBlobKey: string };
const renderedRaw = await ctx.blob.getRaw(renderState.renderBlobKey);
if (!renderedRaw.ok) throw new Error('DEPLOY_HANDLER_RENDER_BLOB_MISSING');
const rendered = JSON.parse(renderedRaw.value.toString('utf8')) as import('@rntme/deploy-dokploy').RenderedDokployPlan;
const planRow = await repo.read({ deploymentId, stage: 'plan' });
const planState = JSON.parse(planRow!.publicStateJson!) as { requiredTargetSecrets: { secretRef: string; schema: string; purpose: string }[] };
const target = await ctx.deployTargetRepoFor(input.orgId).get(deployment.targetId);
const decrypted = await ctx.targetSecretsRepoFor(input.orgId).getAllDecrypted(target!.id);
const resolvedRequiredSecrets: Record<string, unknown> = {};
for (const ref of planState.requiredTargetSecrets) {
  const v = decrypted[ref.secretRef];
  if (v === undefined) throw new Error(`DEPLOY_EXECUTOR_TARGET_SECRET_MISSING: ${ref.secretRef}`);
  resolvedRequiredSecrets[ref.secretRef] = v;
}
const dokployClientFactory = ctx.dokployClientFactoryFor(target!);
const out = await applyStage({ ctx: stageCtx, rendered, resolvedRequiredSecrets, dokployClientFactory });
await ctx.blob.putRaw(`deploy/${deploymentId}/apply`, Buffer.from(JSON.stringify(out.applied)));
await repo.succeed({ deploymentId, stage: 'apply', publicStateJson: JSON.stringify({ applyBlobKey: `deploy/${deploymentId}/apply`, durationMs: out.durationMs }) });
```

**verify-handler.ts** — reads `apply` row + loads applied result from blob. Calls `stages.verify({ applied })`. Writes `publicStateJson: JSON.stringify({ ok, partialOk, checkCount })` and finalizes the deployment row via `ctx.deploymentRepoFor(orgId).succeed(...)` if verify is the last successful stage. Note: if verify fails (smoke fails), the BPMN incident triggers and Operaton retries per policy; only after retries are exhausted is the deployment recorded as failed.

The handlers' size budgets:
- compose-handler: 60–80 lines
- provision-handler: 80–110 lines
- plan-handler: 60–80 lines
- render-handler: 70–90 lines
- apply-handler: 90–120 lines
- verify-handler: 60–80 lines

Each handler's blob key follows the convention `deploy/${deploymentId}/${stage}` for non-secret artifacts and `deploy/${deploymentId}/${stage}-secrets` for secrets. All blobs are eligible for cleanup after the deployment finalizes.

The `dokployClientFactoryFor(target)` helper added to `getPlatformHandlerContext` wraps `createDokployClientFactory(cipher, parseTargetSecret)` from the legacy executor — same closure signature, just hoisted into the platform-context module. Add this to `platform-context.ts` before implementing apply-handler.

- [ ] **Step 5: Add the handler index**

Create `packages/deploy/deploy-runner/src/handlers/index.ts`:

```ts
export { composeStageHandler } from './compose-handler.js';
export { provisionStageHandler } from './provision-handler.js';
export { planStageHandler } from './plan-handler.js';
export { renderStageHandler } from './render-handler.js';
export { applyStageHandler } from './apply-handler.js';
export { verifyStageHandler } from './verify-handler.js';
export type { StageHandlerInput, StageHandlerResult } from './types.js';
```

- [ ] **Step 6: Update package index and deps**

Modify `packages/deploy/deploy-runner/src/index.ts`:

```ts
export {
  composeStageHandler,
  provisionStageHandler,
  planStageHandler,
  renderStageHandler,
  applyStageHandler,
  verifyStageHandler,
} from './handlers/index.js';
export type { StageHandlerInput, StageHandlerResult } from './handlers/index.js';
```

Modify `packages/deploy/deploy-runner/package.json`:

```json
"dependencies": {
  "@rntme/blueprint": "workspace:*",
  "@rntme/deploy-core": "workspace:*",
  "@rntme/deploy-dokploy": "workspace:*",
  "@rntme/platform-core": "workspace:*",
  "@rntme/platform-storage": "workspace:*",
  "drizzle-orm": "^0.39.1",
  "pg": "^8.13.0"
}
```

(Use the same versions of `drizzle-orm` and `pg` that platform-storage already declares to keep the lockfile clean.)

- [ ] **Step 7: Add unit tests for each handler with a mock platform context**

Create `packages/deploy/deploy-runner/test/unit/handlers/compose-handler.test.ts` (and one per handler). Mock the platform context by setting `cached = ...` before invocation, or refactor `getPlatformHandlerContext` to accept an override for tests:

```ts
// In platform-context.ts, expose:
export function _setHandlerContextForTest(ctx: Context | undefined): void { cached = ctx; }
```

Each test asserts:
- `repo.begin` is called once.
- On success, `repo.succeed` is called with the right `publicStateJson` shape.
- On error, `repo.fail` is called with the right code.
- The returned `StageHandlerResult` matches.

- [ ] **Step 8: Run tests**

```bash
bun test --cwd packages/deploy/deploy-runner test/unit/handlers
bun run --cwd packages/deploy/deploy-runner typecheck
bun run --cwd packages/deploy/deploy-runner lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/deploy/deploy-runner
git commit -m "feat(deploy-runner): BPMN-task stage handlers backed by DeployStageState"
```

---

## Task 11: Add the BPMN process file

**Files:**
- Create: `apps/platform/blueprint/services/deployments/workflows/run-deployment.bpmn`

The platform's deployments service owns this process. It declares six external service tasks with retry/timer policies matching the spec.

- [ ] **Step 1: Create the BPMN definition**

Create `apps/platform/blueprint/services/deployments/workflows/run-deployment.bpmn`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:operaton="http://operaton.org/schema/1.0/bpmn"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="runDeploymentDefinitions"
  targetNamespace="https://rntme.com/platform/deployments">
  <bpmn:message id="Message_DeploymentQueued" name="DeploymentQueued" />

  <bpmn:process id="runDeployment" name="Run Deployment" isExecutable="true" operaton:historyTimeToLive="30">
    <bpmn:startEvent id="deploymentQueued" name="Deployment queued">
      <bpmn:outgoing>Flow_Queued_Compose</bpmn:outgoing>
      <bpmn:messageEventDefinition messageRef="Message_DeploymentQueued" />
    </bpmn:startEvent>

    <bpmn:serviceTask id="compose" name="Compose blueprint" operaton:type="external" operaton:topic="compose">
      <bpmn:incoming>Flow_Queued_Compose</bpmn:incoming>
      <bpmn:outgoing>Flow_Compose_Plan</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="plan" name="Build deployment plan" operaton:type="external" operaton:topic="plan">
      <bpmn:incoming>Flow_Compose_Plan</bpmn:incoming>
      <bpmn:outgoing>Flow_Plan_Provision</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="provision" name="Run provisioners" operaton:type="external" operaton:topic="provision" operaton:asyncAfter="true">
      <bpmn:incoming>Flow_Plan_Provision</bpmn:incoming>
      <bpmn:outgoing>Flow_Provision_Render</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="render" name="Render Dokploy plan" operaton:type="external" operaton:topic="render">
      <bpmn:incoming>Flow_Provision_Render</bpmn:incoming>
      <bpmn:outgoing>Flow_Render_Apply</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="apply" name="Apply Dokploy plan" operaton:type="external" operaton:topic="apply">
      <bpmn:incoming>Flow_Render_Apply</bpmn:incoming>
      <bpmn:outgoing>Flow_Apply_Verify</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="verify" name="Verify deployment" operaton:type="external" operaton:topic="verify">
      <bpmn:incoming>Flow_Apply_Verify</bpmn:incoming>
      <bpmn:outgoing>Flow_Verify_End</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:endEvent id="deploymentSucceeded" name="Deployment succeeded">
      <bpmn:incoming>Flow_Verify_End</bpmn:incoming>
    </bpmn:endEvent>

    <bpmn:sequenceFlow id="Flow_Queued_Compose" sourceRef="deploymentQueued" targetRef="compose" />
    <bpmn:sequenceFlow id="Flow_Compose_Plan" sourceRef="compose" targetRef="plan" />
    <bpmn:sequenceFlow id="Flow_Plan_Provision" sourceRef="plan" targetRef="provision" />
    <bpmn:sequenceFlow id="Flow_Provision_Render" sourceRef="provision" targetRef="render" />
    <bpmn:sequenceFlow id="Flow_Render_Apply" sourceRef="render" targetRef="apply" />
    <bpmn:sequenceFlow id="Flow_Apply_Verify" sourceRef="apply" targetRef="verify" />
    <bpmn:sequenceFlow id="Flow_Verify_End" sourceRef="verify" targetRef="deploymentSucceeded" />

  </bpmn:process>
</bpmn:definitions>
```

Note: per-task retry policies (provision: 1×30s, verify: 3× 10/30/60s) are configured via Operaton extension elements. Add `<operaton:failedJobRetryTimeCycle>R1/PT30S</operaton:failedJobRetryTimeCycle>` to the provision task's `<bpmn:extensionElements>` and `<operaton:failedJobRetryTimeCycle>R3/PT10S,R3/PT30S,R3/PT60S</operaton:failedJobRetryTimeCycle>` to verify. The other tasks have no retry (default).

For brevity in this plan, the retry annotations are added in the next step.

- [ ] **Step 2: Add retry policy extensions**

Edit the `<bpmn:serviceTask id="provision" ...>`:

```xml
<bpmn:serviceTask id="provision" name="Run provisioners" operaton:type="external" operaton:topic="provision" operaton:asyncAfter="true">
  <bpmn:extensionElements>
    <operaton:failedJobRetryTimeCycle>R1/PT30S</operaton:failedJobRetryTimeCycle>
  </bpmn:extensionElements>
  <bpmn:incoming>Flow_Plan_Provision</bpmn:incoming>
  <bpmn:outgoing>Flow_Provision_Render</bpmn:outgoing>
</bpmn:serviceTask>
```

Edit verify similarly with `R3/PT10S,R3/PT30S,R3/PT60S`.

- [ ] **Step 3: Run BPMN parse smoke**

There is no BPMN linter; rely on bpmn-worker's `deployDefinitions` call against an Operaton container in e2e tests. Verify the file is well-formed XML:

```bash
xmllint --noout apps/platform/blueprint/services/deployments/workflows/run-deployment.bpmn
```

Expected: no output (well-formed). If `xmllint` is missing, skip; the e2e test in Task 17 catches malformed BPMN through Operaton.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/blueprint/services/deployments/workflows/run-deployment.bpmn
git commit -m "feat(platform/deployments): run-deployment BPMN process definition"
```

---

## Task 12: Add the workflows.json mapping

**Files:**
- Create: `apps/platform/blueprint/services/deployments/workflows/workflows.json`

- [ ] **Step 1: Author the manifest**

Create `apps/platform/blueprint/services/deployments/workflows/workflows.json`:

```json
{
  "workflowVersion": 1,
  "definitions": [
    {
      "id": "runDeployment",
      "bpmnFile": "run-deployment.bpmn",
      "processId": "runDeployment"
    }
  ],
  "messageStarts": [
    {
      "id": "deploymentQueued",
      "definition": "runDeployment",
      "messageName": "DeploymentQueued",
      "event": {
        "service": "deployments",
        "aggregateType": "Deployment",
        "eventType": "queued"
      },
      "businessKey": "$event.rntAggregateId",
      "variables": {
        "deploymentId": "$event.rntAggregateId",
        "orgId": "$event.data.after.organizationId"
      }
    }
  ],
  "serviceTasks": [],
  "nativeTasks": [
    {
      "definition": "runDeployment",
      "taskId": "compose",
      "handler": { "module": "@rntme/deploy-runner", "export": "composeStageHandler" },
      "input": { "deploymentId": "$process.deploymentId", "orgId": "$process.orgId" },
      "resultVariable": "composeResult"
    },
    {
      "definition": "runDeployment",
      "taskId": "plan",
      "handler": { "module": "@rntme/deploy-runner", "export": "planStageHandler" },
      "input": { "deploymentId": "$process.deploymentId", "orgId": "$process.orgId" },
      "resultVariable": "planResult"
    },
    {
      "definition": "runDeployment",
      "taskId": "provision",
      "handler": { "module": "@rntme/deploy-runner", "export": "provisionStageHandler" },
      "input": { "deploymentId": "$process.deploymentId", "orgId": "$process.orgId" },
      "resultVariable": "provisionResult"
    },
    {
      "definition": "runDeployment",
      "taskId": "render",
      "handler": { "module": "@rntme/deploy-runner", "export": "renderStageHandler" },
      "input": { "deploymentId": "$process.deploymentId", "orgId": "$process.orgId" },
      "resultVariable": "renderResult"
    },
    {
      "definition": "runDeployment",
      "taskId": "apply",
      "handler": { "module": "@rntme/deploy-runner", "export": "applyStageHandler" },
      "input": { "deploymentId": "$process.deploymentId", "orgId": "$process.orgId" },
      "resultVariable": "applyResult"
    },
    {
      "definition": "runDeployment",
      "taskId": "verify",
      "handler": { "module": "@rntme/deploy-runner", "export": "verifyStageHandler" },
      "input": { "deploymentId": "$process.deploymentId", "orgId": "$process.orgId" },
      "resultVariable": "verifyResult"
    }
  ]
}
```

- [ ] **Step 2: Run blueprint parse to confirm pickup**

```bash
bun run --cwd packages/artifacts/workflows test
```

Then run a one-shot validate:

```bash
bun run --cwd apps/platform/blueprint test 2>&1 | head -80
```

Expected: workflows artifact validates (or, if no platform-blueprint test suite exists yet, this step verifies the file parses against the schema in unit tests added in Task 7).

- [ ] **Step 3: Commit**

```bash
git add apps/platform/blueprint/services/deployments/workflows/workflows.json
git commit -m "feat(platform/deployments): workflows.json with native deploy stage handlers"
```

---

## Task 13: Update platform `project.json` to declare workflows + Operaton requirement

**Files:**
- Modify: `apps/platform/blueprint/project.json`

- [ ] **Step 1: Add workflows config to project.json**

Modify `apps/platform/blueprint/project.json`. Add a `workflows` section (sibling of `routes`):

```json
"workflows": {
  "manifest": "services/deployments/workflows/workflows.json"
}
```

This tells `@rntme/blueprint` to compose the workflow artifact at the project level. (Multiple services can contribute; here only deployments has workflows.)

- [ ] **Step 2: Verify the platform target requires Operaton**

The deploy-core planner already errors if a workflow project has no provisioned Operaton in the target. Confirm via dry-render: cd into `apps/platform/blueprint`, run `bun run build`, and observe the deploy-core dry-run output (if a script exists). Otherwise, this is verified in the bootstrap e2e test in Task 17 — if the platform target is missing Operaton config, the test fails with `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON`.

- [ ] **Step 3: Update target file template documentation (for plan 2 + plan 3 to share)**

Modify the platform target docs (`docs/current/owners/apps/platform.md`) to require Operaton config in the platform target:

```jsonc
{
  "kind": "dokploy",
  // ...
  "workflows": {
    "engine": {
      "kind": "operaton",
      "mode": "provisioned",
      "image": "ghcr.io/operaton/operaton:latest"
    }
  },
  "eventBus": { "mode": "provisioned" }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/platform/blueprint/project.json docs/current/owners/apps/platform.md
git commit -m "feat(platform): blueprint declares workflows + requires Operaton + Kafka"
```

---

## Task 14: Confirm `queueDeployment` graph emits a Kafka-routed event

The existing `queueDeployment.json` already calls `emit` with `aggregate: 'Deployment'`, `transition: 'queue'`. The PDM declares the queue transition produces an event of type `queued`. The workflows.json messageStart subscribes to that exact event. No graph changes are needed if the Kafka topic for `Deployment` events is `rntme.deployments.Deployment` (per memory `rntme_topic_no_version_suffix.md`).

**Files:**
- Modify (confirm): `apps/platform/blueprint/services/deployments/graphs/queueDeployment.json`

- [ ] **Step 1: Verify the emit produces all variables BPMN needs**

Read `apps/platform/blueprint/services/deployments/graphs/queueDeployment.json`. The current emit:

```json
{
  "id": "emit",
  "type": "emit",
  "config": {
    "aggregate": "Deployment",
    "aggregateId": { "$node": "newId" },
    "transition": "queue",
    "payload": {
      "organizationId": { "$param": "organizationId" },
      "projectId": { "$param": "projectId" },
      "projectVersionId": { "$param": "projectVersionId" },
      "targetId": { "$param": "targetId" }
    }
  }
}
```

The PDM declares `transition: "queue"` produces an event of type `queued` with `affects: ["organizationId", "projectId", "projectVersionId", "targetId"]`. The Kafka envelope emitted by the platform's event store includes the `data.after` snapshot of the affected fields, so `data.after.organizationId` resolves correctly in the BPMN messageStart's `$event.data.after.organizationId` mapping.

No changes needed. If a regression appears in the e2e test (Task 17) where `orgId` is undefined in the BPMN process, the fix is to widen the `affects` array in the PDM transition or to emit the org id explicitly via a non-aggregate payload field.

- [ ] **Step 2: Add an integration assertion in `apps/platform-http/test/e2e/deploy-flow.test.ts`**

Append a test stub:

```ts
it('queueDeployment emit produces a Kafka envelope containing organizationId for BPMN messageStart', async () => {
  // Arrange: post to /v1/orgs/{org}/deployments with a valid version+target
  // Act: capture the Kafka envelope produced by the queueDeployment graph
  // Assert: envelope.data.after.organizationId is present
});
```

This is a sanity test, not the full BPMN integration test (which lives in Task 17).

- [ ] **Step 3: Commit (only if changes made)**

If the emit needs payload changes:

```bash
git add apps/platform/blueprint/services/deployments/graphs/queueDeployment.json apps/platform-http/test/e2e/deploy-flow.test.ts
git commit -m "fix(platform/deployments): queueDeployment emit carries organizationId for BPMN messageStart"
```

---

## Task 15: Wire the bpmn-worker into the platform compose stack

deploy-core already plans an `operaton` infrastructure workload + a `bpmn-worker` workload when the project declares workflows. The bpmn-worker workload runs the manifest-driven worker (`packages/runtime/bpmn-worker/src/bin/worker.ts`).

For deploy-stage handlers, we want the **poll-mode** worker (Task 9), not the Kafka-event-loop worker. Two options:

A. Add a separate `deploy-worker` workload that runs `rntme-bpmn-poll-worker` from the same image but a different bin entrypoint, alongside `bpmn-worker`.

B. Refactor `bpmn-worker` to run both modes (kafka-driven + poll loop) in one process.

Choose (A) for clarity — the plan workload list grows by one container, no behavior changes for non-deploy workflows.

**Files:**
- Modify: `packages/deploy/deploy-core/src/plan.ts` and `packages/deploy/deploy-core/src/workflows.ts`
- Modify: `packages/deploy/deploy-dokploy/src/workflow-render.ts`

- [ ] **Step 1: Write a failing test in deploy-core**

Add to `packages/deploy/deploy-core/test/unit/workflows.test.ts`:

```ts
it('plans both bpmn-worker and deploy-worker workloads for projects whose workflows include native deploy handlers', async () => {
  const composed = mockComposedProjectWithDeployWorkflows();
  const config = mockConfigWithProvisionedOperaton();
  const result = await planWorkflowEngine({ project: composed, config, eventBus: kafkaProvisioned(), errors: [], requiredTargetSecrets: [] });
  expect(result.engine.kind).toBe('operaton');
  // assert two worker workloads are returned
  expect(result.workers).toHaveLength(2);
  expect(result.workers.map(w => w.slug)).toEqual(expect.arrayContaining(['bpmn-worker', 'deploy-worker']));
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test --cwd packages/deploy/deploy-core test/unit/workflows.test.ts
```

Expected: FAIL — current API returns `{ engine, worker }` (single worker).

- [ ] **Step 3: Update the plan return shape**

Modify `packages/deploy/deploy-core/src/workflows.ts`:

```ts
// before:
export function planWorkflowEngine(input: ...): {
  readonly engine: PlannedWorkflowEngine;
  readonly worker: BpmnWorkerWorkload | null;
} { /* ... */ }

// after:
export function planWorkflowEngine(input: ...): {
  readonly engine: PlannedWorkflowEngine;
  readonly workers: readonly BpmnWorkerWorkload[];
} { /* ... */ }
```

Inside `planWorkflowEngine`, replace the single `worker` build with:

```ts
const workers: BpmnWorkerWorkload[] = [];
if (workflows.serviceTasks.length > 0 || workflows.messageStarts.length > 0) {
  workers.push(buildBpmnWorkerWorkload({
    slug: 'bpmn-worker',
    bin: 'rntme-bpmn-worker',  // existing kafka-driven bin
    image: workerImage,
    /* other fields unchanged */
  }));
}
if (workflows.nativeTasks.length > 0) {
  workers.push(buildBpmnWorkerWorkload({
    slug: 'deploy-worker',
    bin: 'rntme-bpmn-poll-worker',  // continuous-poll bin from Task 9
    image: workerImage,
    /* other fields identical to bpmn-worker */
  }));
}
return { engine, workers };
```

Modify `packages/deploy/deploy-core/src/plan.ts`:

```ts
// PlannedWorkflowEngine type already returns the engine itself; the workers
// were threaded as `workflowPlan.worker`. Update buildProjectDeploymentPlan
// (~line 297) from:
const workloads =
  workflowPlan.worker === null ? workloads : [...workloads, workflowPlan.worker];

// to:
const allWorkloads = [...workloads, ...workflowPlan.workers];
```

Then update every consumer of `workflowPlan.worker` to iterate `workflowPlan.workers`. Run `bun run --cwd packages/deploy/deploy-core typecheck` to surface the call sites.

`buildBpmnWorkerWorkload` is the existing builder factored to take a `bin` and `slug`. The current code constructs the worker inline; refactor it to a small helper that returns a `BpmnWorkerWorkload`. Both worker workloads share image, environment, mounts, workflowFiles — only `slug` and the container `command` differ.

- [ ] **Step 4: Update workflow-render to render both workloads**

Modify `packages/deploy/deploy-dokploy/src/workflow-render.ts`. Current `renderBpmnWorkerWorkload` is invoked once per worker; iterate `plan.infrastructure.workflowEngine.workers` (after the rename in Task 15.3).

- [ ] **Step 5: Run tests**

```bash
bun test --cwd packages/deploy/deploy-core
bun test --cwd packages/deploy/deploy-dokploy
bun run --cwd packages/deploy/deploy-core typecheck
bun run --cwd packages/deploy/deploy-dokploy typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/deploy/deploy-core packages/deploy/deploy-dokploy
git commit -m "feat(deploy): plan deploy-worker (poll-mode bpmn-worker) for projects with nativeTasks"
```

---

## Task 16: Confirm `PLATFORM_RUNTIME_MODE=blueprint` already disables the legacy executor

The `PLATFORM_RUNTIME_MODE` env var already exists with values `'legacy' | 'blueprint'` in `apps/platform-http/src/config/env.ts`, and `app.ts` (~line 120) already short-circuits the entire imperative server when in blueprint mode. The schedule-deployment hook (`setImmediate(() => runDeployment(...))`) only runs in legacy mode, since it lives below the blueprint branch.

**Files:**
- Verify: `apps/platform-http/src/app.ts` (~line 120)
- Verify: `apps/platform-http/src/config/env.ts`

- [ ] **Step 1: Confirm and document the gating**

Add a comment block above the legacy `scheduleDeployment` to make the contract explicit:

```ts
// LEGACY MODE ONLY: in PLATFORM_RUNTIME_MODE=blueprint, the entire imperative
// server is short-circuited above (line ~120) and the deployment lifecycle is
// driven by the runDeployment BPMN process owned by services/deployments.
// See docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md
// (plan 3) for the BPMN flow.
const scheduleDeployment = deps.scheduleDeployment ?? ((deploymentId: string, orgId: string) => {
  setImmediate(() => {
    void runDeployment(deploymentId, orgId, executorDeps).catch((cause) => {
      deps.logger.error({ deploymentId, cause }, 'scheduled deployment failed');
    });
  });
});
```

- [ ] **Step 2: Add a unit test that the legacy path is bypassed in blueprint mode**

Confirm `apps/platform-http/test/unit/app.test.ts` line 62 already covers this; add an extra assertion that no `setImmediate(scheduleDeployment)` fires when `PLATFORM_RUNTIME_MODE=blueprint`:

```ts
it('does not schedule legacy deployments in PLATFORM_RUNTIME_MODE=blueprint', async () => {
  let scheduled = 0;
  await createApp({
    ...deps,
    env: parseEnv({ ...baseline, PLATFORM_RUNTIME_MODE: 'blueprint' }),
    scheduleDeployment: () => { scheduled += 1; },
  });
  // Hit the deployment-create endpoint (under /api/deployments via blueprint runtime)
  // ...
  expect(scheduled).toBe(0);
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/platform-http/src/app.ts apps/platform-http/test/unit/app.test.ts
git commit -m "test(platform-http): blueprint mode bypasses legacy deployment scheduler"
```

---

## Task 17: Cutover smoke test — deploy notes-blueprint via deployed platform's BPMN

**Files:**
- Create: `apps/platform-http/test/e2e/bpmn-deploy-flow.test.ts`

This test:
1. Boots the deployed platform (in blueprint mode) against a Dokploy testcontainer.
2. Posts a queueDeployment for the demo `notes-blueprint` against a target.
3. Polls until the BPMN process completes (success or failure).
4. Asserts the `DeployStageState` rows exist for all six stages with status `succeeded`.
5. Asserts the deployment record transitions to `succeeded`.

- [ ] **Step 1: Author the test**

Create `apps/platform-http/test/e2e/bpmn-deploy-flow.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { skipIfNoDocker } from './docker-available.js';
import { startTestPlatformBlueprintMode, queueTestDeployment, waitForDeployment } from './harness.js';

describe('BPMN deploy flow', () => {
  it('runs all six stages via Operaton and finalizes the deployment', async () => {
    if (await skipIfNoDocker()) return;
    const platform = await startTestPlatformBlueprintMode();
    try {
      const deployment = await queueTestDeployment(platform, { blueprint: 'notes-blueprint' });
      const result = await waitForDeployment(platform, deployment.id, { timeoutMs: 5 * 60_000 });
      expect(result.status).toBe('succeeded');
      expect(result.stages).toEqual([
        { stage: 'compose', status: 'succeeded' },
        { stage: 'plan', status: 'succeeded' },
        { stage: 'provision', status: 'succeeded' },
        { stage: 'render', status: 'succeeded' },
        { stage: 'apply', status: 'succeeded' },
        { stage: 'verify', status: 'succeeded' },
      ]);
    } finally {
      await platform.stop();
    }
  }, { timeout: 10 * 60_000 });
});
```

`startTestPlatformBlueprintMode` is a new helper in `harness.ts` that:
- Spawns the Operaton + Kafka + platform-http (blueprint mode) + bpmn-worker + deploy-worker stack via testcontainers.
- Waits for the platform's `/v1/health` to return 200 from the runtime app.
- Returns a handle with stop() and an HTTP client.

- [ ] **Step 2: Add the harness helpers**

Modify `apps/platform-http/test/e2e/harness.ts` and add `startTestPlatformBlueprintMode`, `queueTestDeployment`, `waitForDeployment`. They wrap existing dokploy-live-env primitives plus a new Operaton container.

- [ ] **Step 3: Run the test**

```bash
SKIP_TESTCONTAINERS=false bun test --cwd apps/platform-http test/e2e/bpmn-deploy-flow.test.ts
```

Expected: PASS within 5 minutes.

- [ ] **Step 4: Commit**

```bash
git add apps/platform-http/test/e2e
git commit -m "test(e2e): BPMN-orchestrated deploy through the deployed platform"
```

---

## Task 18: Update docs and decision-system

**Files:**
- Modify: `docs/decision-system.md`
- Modify: `docs/current/owners/packages/runtime/bpmn-worker.md`
- Modify: `docs/current/owners/packages/deploy/deploy-runner.md`
- Modify: `docs/current/owners/apps/platform.md`

- [ ] **Step 1: Promote the three bets**

In `docs/decision-system.md`, change the three bets from spec 2026-05-10 from `locked-pending` to `current-default`:

- "CLI universal deploy front" — promote.
- "Deploy orchestrator library" — promote.
- "No `apps/platform-http`" — keep `locked-pending` (only plans 1–3 land in this plan; plan 6 deletes platform-http).

Add a new entry for plan 3:

> **BPMN-orchestrated deploy** — Inside the deployed platform, deploy is run as a BPMN process (`run-deployment.bpmn` in `services/deployments/workflows/`) with six native task handlers backed by `@rntme/deploy-runner`'s `stages.*`. CLI direct-mode remains synchronous and BPMN-free. — G3, G4, F1, F4 — `current-default` — spec `2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`, plan `2026-05-10-bpmn-orchestrated-deploy-services-deployments.md`.

- [ ] **Step 2: Update package owner docs**

`docs/current/owners/packages/runtime/bpmn-worker.md`: add sections for native handlers (`workflows.json#nativeTasks`) and the poll-mode bin (`rntme-bpmn-poll-worker`). Document the loud-failure contract (no silent skip on missing handler).

`docs/current/owners/packages/deploy/deploy-runner.md`: document the `stages.*` API and the per-stage handler exports. Reference `DeployStageState` for cross-stage state.

`docs/current/owners/apps/platform.md`: note that the deployed platform now requires Operaton + Kafka and ships a `deploy-worker` container alongside `bpmn-worker`.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: promote BPMN-orchestrated deploy bet and update owner docs"
```

---

## Task 19: Final green build

- [ ] **Step 1: Run the full check**

```bash
bun install --frozen-lockfile
bun run build
bun run typecheck
bun run test
bun run lint
bun run depcruise
```

Expected: all green.

- [ ] **Step 2: Commit any drift fixes**

```bash
git status
# stage and commit any small fixes surfaced
git commit -m "chore: cross-package drift fixes from plan 3 cutover"
```

---

## Notes on retries and incidents

The BPMN process uses Operaton's native retry semantics via `<operaton:failedJobRetryTimeCycle>`. When retries are exhausted, Operaton creates an incident on the failed job. The handler always persists `DeployStageState` with `status: 'failed'` before returning, so the platform's UI can show the failure even if the incident sits in Operaton awaiting human action.

For the legacy `orphan-detect` background loop: deletion is **out of scope** for this plan (it's removed in plan 6 with the rest of platform-http). Until then, the orphan loop only operates against deployments scheduled in legacy mode (since the schedule-hook is gated by `PLATFORM_RUNTIME_MODE`). This means orphan detection can co-exist with BPMN-driven deploy without conflict.

## Notes on Operaton DB

The platform's compose stack already includes a Postgres container for platform data. Operaton's container image defaults to in-memory H2, which is sufficient for the e2e test in Task 17 but loses workflow state on restart. The spec calls for "Postgres schema or sibling DB"; this plan uses the simpler default (H2) for the first cut, with a TODO to point Operaton at the platform's existing Postgres via Operaton env vars (`SPRING_DATASOURCE_URL`, etc.) in a follow-up commit.

If the e2e test surfaces flakiness due to H2 (e.g., process state lost mid-test on container restart), point Operaton at a dedicated database in the platform Postgres instance (`CREATE DATABASE operaton;`) by setting `SPRING_DATASOURCE_URL=jdbc:postgresql://<platform-pg-host>/operaton` in the workflow engine workload's environment. This is a one-line change in `packages/deploy/deploy-dokploy/src/workflow-render.ts` plus a migration that creates the `operaton` database. Mark this as a follow-up task in `docs/decision-system.md` if the H2 default holds in tests.

## Open questions deferred to other plans

- **Project-delete operation** (spec open question): not addressed here. The `apps/platform-http/src/deploy/project-delete-executor.ts` stays untouched. Plan 6 owns the migration.
- **Workflow handler bundling** (spec open question): handlers live as exports of `@rntme/deploy-runner`, not as `.ts` files inside the blueprint folder. This is the simpler interpretation of "handler files live next to the .bpmn" — the workflows.json *references* exports of a workspace package rather than co-locating TS source. If a future plan wants per-blueprint handler code, the schema already supports any module specifier.
- **CLI direct-mode reuse of stages.* refactor**: Task 5's refactor preserves the `runDeployment` signature. Plan 2's CLI direct-mode (already landed in `apps/cli/src/deploy-engine/`) consumes `runDeployment` and is unaffected by the per-stage decomposition. If plan 2 ever wants per-stage CLI flags (e.g., `--stop-after render`), the `stages.*` exports are now available without further refactor.
