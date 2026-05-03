# Publish-Path Hardening — Plan 1: Foundations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-02-publish-path-end-to-end-hardening-design.md`

**Goal:** Land the deploy-pipeline correctness backbone — declarative `vars` substitution, typed `DEPLOY_<LAYER>_*` errors replacing the generic uncaught wrapper, executor stage logging on failure, and real protected-route smoke probes that replace the placeholder-as-pass behavior.

**Architecture:** Three independent components landed in dependency order: (1) `vars` block validated in `@rntme/blueprint` and resolved in `@rntme/deploy-core`, (2) typed error families in `@rntme/deploy-core` consumed by the platform executor, (3) smoke verifier rewritten to make real probes per route classification. Each component has its own TDD slice.

**Tech Stack:** TypeScript, Zod for schemas, Vitest, Result<T> pattern (per-package), pnpm workspace.

---

## File Structure

**Create:**
- `packages/artifacts/blueprint/src/types/vars.ts` — `VarsManifest` type, target-path validators
- `packages/artifacts/blueprint/test/unit/vars.test.ts` — vars validation unit tests
- `packages/deploy/deploy-core/src/vars.ts` — `resolveVars(varsManifest, target) -> Result<ResolvedVars>` + `applyVars(value, resolvedVars)` substitution
- `packages/deploy/deploy-core/test/unit/vars.test.ts` — vars resolver tests
- `packages/deploy/deploy-core/src/errors-render.ts` — `DEPLOY_RENDER_*` codes + types
- `packages/deploy/deploy-core/src/errors-apply.ts` — `DEPLOY_APPLY_*` codes + types
- `packages/deploy/deploy-core/src/errors-verify.ts` — `DEPLOY_VERIFY_*` codes + types
- `apps/platform-http/src/deploy/stage-runner.ts` — `runStage(name, fn, deps)` wrapper that logs on Err / catches throws
- `apps/platform-http/src/deploy/__tests__/stage-runner.test.ts` — stage-runner unit tests
- `apps/platform-http/test/unit/deploy/smoke-verifier-real.test.ts` — replaces placeholder behavior with real-probe expectations

**Modify:**
- `packages/artifacts/blueprint/src/parse/schema.ts` — add `vars` to `ProjectBlueprintSchema`
- `packages/artifacts/blueprint/src/types/result.ts` — add 4 new vars error codes
- `packages/artifacts/blueprint/src/validate/structural.ts` — add vars structural pass
- `packages/artifacts/blueprint/src/validate/composition.ts` — add vars references + consistency passes
- `packages/artifacts/blueprint/src/types/artifact.ts` — add `vars?: VarsManifest` to `ProjectBlueprint`
- `packages/deploy/deploy-core/src/errors.ts` — add `DEPLOY_PLAN_TARGET_VAR_MISSING`, `DEPLOY_PLAN_VAR_FROM_PATH_INVALID`
- `packages/deploy/deploy-core/src/index.ts` — export vars + new error families
- `packages/deploy/deploy-core/src/composed-project.ts` — pass `varsManifest` through
- `packages/deploy/deploy-core/src/plan.ts` (or wherever planning happens) — call `resolveVars` early; substitute `${PLACEHOLDER}` in module publicConfig/env via `applyVars`
- `apps/platform-http/src/deploy/executor.ts` — wrap each stage in `runStage`; remove the `AUTH0_SPA_CLIENT_ID` ad-hoc throw (now caught by vars resolver); replace generic `throw new Error(...)` calls with typed errors
- `apps/platform-http/src/deploy/smoke-verifier.ts` — remove placeholder branch; classify per route; emit protected-route probes; honor new `verificationHints.protectedRoutes`
- `apps/platform-http/src/deploy/build-deploy-config.ts` — populate `verificationHints.protectedRoutes` from rendered plan / blueprint
- `packages/platform/platform-core/src/types.ts` (verification report) — add `protectedRoutes` field if absent

**Test:**
- See "Create" entries above; every modified module gets its assertions extended

---

## Component A — `vars` block validation in `@rntme/blueprint`

### Task A.1: Add vars error codes

**Files:**
- Modify: `packages/artifacts/blueprint/src/types/result.ts`

- [ ] **Step 1: Add codes to `ERROR_CODES`**

Insert into the existing `ERROR_CODES` const, after `BLUEPRINT_AUTH_MODULE_EDGE_AUTH_MISSING`:

```ts
  BLUEPRINT_VARS_FROM_INVALID: 'BLUEPRINT_VARS_FROM_INVALID',
  BLUEPRINT_VARS_FROM_UNKNOWN_ROOT: 'BLUEPRINT_VARS_FROM_UNKNOWN_ROOT',
  BLUEPRINT_CONSISTENCY_VAR_UNDECLARED: 'BLUEPRINT_CONSISTENCY_VAR_UNDECLARED',
  BLUEPRINT_CONSISTENCY_VAR_UNUSED: 'BLUEPRINT_CONSISTENCY_VAR_UNUSED',
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm -F @rntme/blueprint typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/artifacts/blueprint/src/types/result.ts
git commit -m "feat(blueprint): add vars error codes"
```

### Task A.2: Add `VarsManifest` type and target-path validator

**Files:**
- Create: `packages/artifacts/blueprint/src/types/vars.ts`

- [ ] **Step 1: Write the type module**

```ts
export type VarsManifest = Readonly<Record<string, VarBinding>>;

export type VarBinding = Readonly<{
  from: string;
  required: boolean;
}>;

const KNOWN_ROOTS = [
  /^target\.auth\.[a-z][a-z0-9-]*\.[a-zA-Z][a-zA-Z0-9_]*$/,
  /^target\.modules\.[a-z][a-z0-9-]*\.[a-zA-Z][a-zA-Z0-9_]*$/,
  /^target\.eventBus\.[a-zA-Z][a-zA-Z0-9_]*$/,
] as const;

export function isKnownTargetPath(path: string): boolean {
  return KNOWN_ROOTS.some((re) => re.test(path));
}

const PLACEHOLDER_RE = /\$\{([A-Z][A-Z0-9_]*)\}/g;

export function extractPlaceholders(value: unknown): readonly string[] {
  if (typeof value === 'string') {
    const out: string[] = [];
    for (const match of value.matchAll(PLACEHOLDER_RE)) {
      out.push(match[1]!);
    }
    return out;
  }
  if (Array.isArray(value)) return value.flatMap(extractPlaceholders);
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(extractPlaceholders);
  }
  return [];
}
```

- [ ] **Step 2: Export from package index**

Add to `packages/artifacts/blueprint/src/index.ts`:

```ts
export type { VarsManifest, VarBinding } from './types/vars.js';
export { isKnownTargetPath, extractPlaceholders } from './types/vars.js';
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm -F @rntme/blueprint typecheck`
Expected: PASS.

```bash
git add packages/artifacts/blueprint/src/types/vars.ts packages/artifacts/blueprint/src/index.ts
git commit -m "feat(blueprint): add VarsManifest type + target path validator"
```

### Task A.3: Add `vars` to parse schema

**Files:**
- Modify: `packages/artifacts/blueprint/src/parse/schema.ts`
- Modify: `packages/artifacts/blueprint/src/types/artifact.ts`

- [ ] **Step 1: Write the failing parse test**

Append to `packages/artifacts/blueprint/test/unit/parse.test.ts`:

```ts
import { parseProjectBlueprint } from '../../src/parse/parse.js';

describe('parseProjectBlueprint vars', () => {
  it('accepts a vars block with from + required', () => {
    const r = parseProjectBlueprint({
      name: 'demo',
      services: ['app'],
      vars: { FOO: { from: 'target.auth.auth0.clientId', required: true } },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.vars).toEqual({ FOO: { from: 'target.auth.auth0.clientId', required: true } });
  });

  it('rejects vars entry missing from', () => {
    const r = parseProjectBlueprint({
      name: 'demo',
      services: ['app'],
      vars: { FOO: { required: true } },
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/parse.test.ts -t "vars"`
Expected: FAIL ("vars" rejected by strict schema).

- [ ] **Step 3: Add `vars` to schema**

In `packages/artifacts/blueprint/src/parse/schema.ts`, before the closing `.strict()` of `ProjectBlueprintSchema`, add the field. Replace the schema body to include:

```ts
    modules: z.record(nonEmptyString, moduleProjectRefSchema).optional(),
    vars: z
      .record(
        z.string().regex(/^[A-Z][A-Z0-9_]*$/),
        z
          .object({
            from: nonEmptyString,
            required: z.boolean().default(true),
          })
          .strict(),
      )
      .optional(),
```

- [ ] **Step 4: Add `vars` to `ProjectBlueprint` type**

In `packages/artifacts/blueprint/src/types/artifact.ts`, add the optional field on the type that mirrors `ProjectBlueprintSchema` (search for the existing `modules` field and add `vars` next to it):

```ts
  vars?: Readonly<Record<string, { from: string; required: boolean }>>;
```

- [ ] **Step 5: Run test, expect PASS**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/parse.test.ts -t "vars"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/artifacts/blueprint/src/parse/schema.ts packages/artifacts/blueprint/src/types/artifact.ts packages/artifacts/blueprint/test/unit/parse.test.ts
git commit -m "feat(blueprint): parse vars block from project.json"
```

### Task A.4: Structural validation of `vars`

**Files:**
- Create: `packages/artifacts/blueprint/test/unit/vars.test.ts`
- Modify: `packages/artifacts/blueprint/src/validate/structural.ts`

- [ ] **Step 1: Write failing structural test**

Create `packages/artifacts/blueprint/test/unit/vars.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateBlueprintStructural } from '../../src/validate/structural.js';

const baseInput = {
  serviceDirs: ['app'],
  services: { app: { kind: 'domain' as const } },
};

describe('structural vars', () => {
  it('rejects vars.from with unknown root', () => {
    const r = validateBlueprintStructural({
      ...baseInput,
      project: {
        name: 'demo',
        services: ['app'],
        vars: { FOO: { from: 'project.junk.path', required: true } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('BLUEPRINT_VARS_FROM_UNKNOWN_ROOT');
      expect(r.errors[0]!.path).toBe('project.vars.FOO.from');
    }
  });

  it('accepts vars with known root', () => {
    const r = validateBlueprintStructural({
      ...baseInput,
      project: {
        name: 'demo',
        services: ['app'],
        vars: { CID: { from: 'target.auth.auth0.clientId', required: true } },
      },
    });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/vars.test.ts -t "structural vars"`
Expected: FAIL.

- [ ] **Step 3: Implement vars structural pass**

In `packages/artifacts/blueprint/src/validate/structural.ts`, after the existing service loop and before `if (errors.length > 0) return err(errors);`, add:

```ts
  if (input.project.vars) {
    const { isKnownTargetPath } = await import('../types/vars.js');
    for (const [name, binding] of Object.entries(input.project.vars)) {
      if (!isKnownTargetPath(binding.from)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.BLUEPRINT_VARS_FROM_UNKNOWN_ROOT,
          message: `vars.${name}.from "${binding.from}" does not match a known target.* root`,
          path: `project.vars.${name}.from`,
        });
      }
    }
  }
```

If dynamic `import` is awkward in this file (sync function), instead place a top-level `import { isKnownTargetPath } from '../types/vars.js';` and use it directly. Use the static import form.

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/vars.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/artifacts/blueprint/src/validate/structural.ts packages/artifacts/blueprint/test/unit/vars.test.ts
git commit -m "feat(blueprint): structural vars.from validation"
```

### Task A.5: Composition (consistency) validation of vars vs placeholders

**Files:**
- Modify: `packages/artifacts/blueprint/src/validate/composition.ts`
- Modify: `packages/artifacts/blueprint/test/unit/vars.test.ts`

- [ ] **Step 1: Write failing consistency tests**

Append to `packages/artifacts/blueprint/test/unit/vars.test.ts`:

```ts
import { validateBlueprintComposition } from '../../src/validate/composition.js';

const composeBase = {
  services: {
    app: {
      kind: 'domain' as const,
      artifacts: { hasBindings: true, hasUi: true, hasGraphs: true, hasQsm: true, hasSeed: false },
    },
  },
};

describe('consistency vars', () => {
  it('rejects placeholder not declared in vars', () => {
    const r = validateBlueprintComposition({
      ...composeBase,
      project: {
        name: 'demo',
        services: ['app'],
        modules: { id: { package: 'mod-x', publicConfig: { key: '${UNDECLARED}' } } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'BLUEPRINT_CONSISTENCY_VAR_UNDECLARED')).toBe(true);
    }
  });

  it('rejects vars entry never referenced', () => {
    const r = validateBlueprintComposition({
      ...composeBase,
      project: {
        name: 'demo',
        services: ['app'],
        vars: { UNUSED: { from: 'target.auth.auth0.clientId', required: true } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'BLUEPRINT_CONSISTENCY_VAR_UNUSED')).toBe(true);
    }
  });

  it('accepts placeholder declared in vars', () => {
    const r = validateBlueprintComposition({
      ...composeBase,
      project: {
        name: 'demo',
        services: ['app'],
        vars: { K: { from: 'target.auth.auth0.clientId', required: true } },
        modules: { id: { package: 'mod-x', publicConfig: { key: '${K}' } } },
      },
    });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/vars.test.ts -t "consistency vars"`
Expected: FAIL on all three.

- [ ] **Step 3: Implement consistency pass**

In `packages/artifacts/blueprint/src/validate/composition.ts`, add to top imports:

```ts
import { extractPlaceholders } from '../types/vars.js';
```

Add a new function before the file's last `export`:

```ts
function validateVars(project: ProjectBlueprint): BlueprintError[] {
  const errors: BlueprintError[] = [];
  const declared = new Set(Object.keys(project.vars ?? {}));
  const used = new Set<string>();

  for (const [moduleKey, mod] of Object.entries(project.modules ?? {})) {
    for (const placeholder of extractPlaceholders(mod.publicConfig ?? {})) {
      used.add(placeholder);
      if (!declared.has(placeholder)) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_CONSISTENCY_VAR_UNDECLARED,
          message: `placeholder "${placeholder}" used in modules.${moduleKey}.publicConfig is not declared in project.vars`,
          path: `project.modules.${moduleKey}.publicConfig`,
        });
      }
    }
  }

  for (const name of declared) {
    if (!used.has(name)) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_CONSISTENCY_VAR_UNUSED,
        message: `vars.${name} is declared but never referenced as \${${name}}`,
        path: `project.vars.${name}`,
      });
    }
  }

  return errors;
}
```

In `validateBlueprintComposition`, before `if (errors.length > 0) return err(errors);` (or before the final `return ok(...)`), append:

```ts
  errors.push(...validateVars(input.project));
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/vars.test.ts`
Expected: PASS on all.

- [ ] **Step 5: Run full blueprint suite for regressions**

Run: `pnpm -F @rntme/blueprint test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/artifacts/blueprint/src/validate/composition.ts packages/artifacts/blueprint/test/unit/vars.test.ts
git commit -m "feat(blueprint): consistency check for ${VAR} ↔ vars block"
```

### Task A.6: Surface `varsManifest` on `ComposedBlueprint`

**Files:**
- Modify: `packages/artifacts/blueprint/src/compose/` (find the file that builds `ComposedBlueprint`)

- [ ] **Step 1: Locate composed blueprint builder**

Run: `grep -rn "ComposedBlueprint" packages/artifacts/blueprint/src --include='*.ts' -l`

Note the file (likely `compose/load-composed-blueprint.ts` or `index.ts`). Open it.

- [ ] **Step 2: Add `varsManifest` to the composed result**

Locate where the composed value is constructed (a `return { …, project, … }` shape). Add:

```ts
varsManifest: project.vars ?? {},
```

Add the field to the `ComposedBlueprint` type as well:

```ts
varsManifest: Readonly<Record<string, { from: string; required: boolean }>>;
```

- [ ] **Step 3: Update existing fixture tests if any break**

Run: `pnpm -F @rntme/blueprint test`

If a snapshot or shape assertion fails because of the new field, update it to include `varsManifest: {}` for blueprints that don't declare vars.

- [ ] **Step 4: Commit**

```bash
git add packages/artifacts/blueprint/src
git commit -m "feat(blueprint): expose varsManifest on ComposedBlueprint"
```

---

## Component B — vars resolver in `@rntme/deploy-core`

### Task B.1: Add `DEPLOY_PLAN_TARGET_VAR_MISSING` and `DEPLOY_PLAN_VAR_FROM_PATH_INVALID`

**Files:**
- Modify: `packages/deploy/deploy-core/src/errors.ts`

- [ ] **Step 1: Add codes**

In the `DEPLOY_CORE_ERROR_CODES` object, after the existing `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING` entry:

```ts
  DEPLOY_PLAN_TARGET_VAR_MISSING: 'DEPLOY_PLAN_TARGET_VAR_MISSING',
  DEPLOY_PLAN_VAR_FROM_PATH_INVALID: 'DEPLOY_PLAN_VAR_FROM_PATH_INVALID',
```

- [ ] **Step 2: Extend `DeploymentPlanError` to carry `varName` + `fromPath`**

```ts
export type DeploymentPlanError = {
  readonly code: DeploymentPlanErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly service?: string;
  readonly route?: string;
  readonly middleware?: string;
  readonly moduleSlug?: string;
  readonly policy?: string;
  readonly varName?: string;
  readonly fromPath?: string;
  readonly targetSlug?: string;
};
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm -F @rntme/deploy-core typecheck`
Expected: PASS.

```bash
git add packages/deploy/deploy-core/src/errors.ts
git commit -m "feat(deploy-core): add vars-related plan error codes"
```

### Task B.2: Implement `resolveVars` + `applyVars`

**Files:**
- Create: `packages/deploy/deploy-core/src/vars.ts`
- Create: `packages/deploy/deploy-core/test/unit/vars.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/deploy/deploy-core/test/unit/vars.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveVars, applyVars } from '../../src/vars.js';

const target = {
  slug: 'demo',
  auth: { auth0: { clientId: 'abc', audience: 'https://api/' } },
  modules: {},
  eventBus: { topicPrefix: 'pfx', brokers: ['k:9092'] },
};

describe('resolveVars', () => {
  it('resolves a known path', () => {
    const r = resolveVars(
      { CID: { from: 'target.auth.auth0.clientId', required: true } },
      target,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ CID: 'abc' });
  });

  it('fails with DEPLOY_PLAN_TARGET_VAR_MISSING when required value missing', () => {
    const r = resolveVars(
      { MISSING: { from: 'target.auth.auth0.tenantId', required: true } },
      target,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('DEPLOY_PLAN_TARGET_VAR_MISSING');
      expect(r.errors[0]!.varName).toBe('MISSING');
      expect(r.errors[0]!.fromPath).toBe('target.auth.auth0.tenantId');
      expect(r.errors[0]!.targetSlug).toBe('demo');
    }
  });

  it('omits optional missing var', () => {
    const r = resolveVars(
      { OPT: { from: 'target.auth.auth0.tenantId', required: false } },
      target,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({});
  });
});

describe('applyVars', () => {
  it('substitutes ${VAR} in strings', () => {
    expect(applyVars('hello ${X}', { X: 'world' })).toBe('hello world');
  });

  it('walks nested objects and arrays', () => {
    expect(
      applyVars(
        { a: '${X}', b: ['${Y}', { c: '${X}' }] },
        { X: '1', Y: '2' },
      ),
    ).toEqual({ a: '1', b: ['2', { c: '1' }] });
  });

  it('leaves missing placeholders intact', () => {
    expect(applyVars('${X}/${Y}', { X: '1' })).toBe('1/${Y}');
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `pnpm -F @rntme/deploy-core vitest run test/unit/vars.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `vars.ts`**

Create `packages/deploy/deploy-core/src/vars.ts`:

```ts
import { err, ok, type Result } from './result.js';
import type { DeploymentPlanError } from './errors.js';

export type VarBinding = Readonly<{ from: string; required: boolean }>;
export type VarsManifest = Readonly<Record<string, VarBinding>>;
export type ResolvedVars = Readonly<Record<string, string>>;

export type TargetForVars = {
  readonly slug: string;
  readonly auth?: Record<string, Record<string, unknown>>;
  readonly modules?: Record<string, Record<string, unknown>>;
  readonly eventBus?: Record<string, unknown>;
};

const PLACEHOLDER_RE = /\$\{([A-Z][A-Z0-9_]*)\}/g;

export function resolveVars(
  manifest: VarsManifest,
  target: TargetForVars,
): Result<ResolvedVars> {
  const errors: DeploymentPlanError[] = [];
  const out: Record<string, string> = {};

  for (const [name, binding] of Object.entries(manifest)) {
    const value = readPath(target, binding.from);
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

  if (errors.length > 0) return err(errors);
  return ok(out);
}

function readPath(target: TargetForVars, path: string): unknown {
  // Path is "target.<root>.<...>". Strip leading "target.".
  const segments = path.split('.');
  if (segments[0] !== 'target') return undefined;
  let cursor: unknown = target;
  for (const seg of segments.slice(1)) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return cursor;
}

export function applyVars<T>(value: T, vars: ResolvedVars): T {
  if (typeof value === 'string') {
    return value.replace(PLACEHOLDER_RE, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : match,
    ) as unknown as T;
  }
  if (Array.isArray(value)) {
    return (value as unknown[]).map((v) => applyVars(v, vars)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = applyVars(v, vars);
    }
    return out as unknown as T;
  }
  return value;
}
```

- [ ] **Step 4: Export from package index**

Modify `packages/deploy/deploy-core/src/index.ts` to add:

```ts
export { resolveVars, applyVars } from './vars.js';
export type { VarBinding, VarsManifest, ResolvedVars, TargetForVars } from './vars.js';
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `pnpm -F @rntme/deploy-core vitest run test/unit/vars.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/deploy/deploy-core/src/vars.ts packages/deploy/deploy-core/src/index.ts packages/deploy/deploy-core/test/unit/vars.test.ts
git commit -m "feat(deploy-core): resolveVars + applyVars implementation"
```

### Task B.3: Wire vars resolution into the planner

**Files:**
- Modify: `packages/deploy/deploy-core/src/composed-project.ts` and/or `plan.ts`
- Modify: `packages/deploy/deploy-core/test/unit/` (add a planner test)

- [ ] **Step 1: Locate the planner entry**

Run: `grep -n "buildProjectDeploymentPlan\|export function" packages/deploy/deploy-core/src/plan.ts | head`

Confirm the function signature; planner takes a `ComposedProjectInput` (which contains `varsManifest`) and a target.

- [ ] **Step 2: Add `varsManifest` to `ComposedProjectInput`**

In `packages/deploy/deploy-core/src/composed-project.ts`, add to the `ComposedProjectInput` type:

```ts
varsManifest?: import('./vars.js').VarsManifest;
```

- [ ] **Step 3: Resolve vars at the start of planning, before any rendering reads `publicConfig`**

In `packages/deploy/deploy-core/src/plan.ts` (or wherever planning happens), at the top of `buildProjectDeploymentPlan`:

```ts
import { resolveVars, applyVars } from './vars.js';

// near top of the function body
const resolved = resolveVars(input.varsManifest ?? {}, target);
if (!resolved.ok) return resolved; // propagate DEPLOY_PLAN_TARGET_VAR_MISSING
const vars = resolved.value;
```

Then for every place the planner reads `module.publicConfig`, `module.env`, route URLs, audiences — wrap the read with `applyVars(value, vars)`. Use grep to find them: `grep -n "publicConfig\|module.env\|audience" packages/deploy/deploy-core/src/*.ts`.

- [ ] **Step 4: Add planner integration test**

Create `packages/deploy/deploy-core/test/unit/plan-vars.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildProjectDeploymentPlan } from '../../src/plan.js';

describe('buildProjectDeploymentPlan vars', () => {
  it('substitutes ${VAR} from target into module publicConfig', () => {
    const plan = buildProjectDeploymentPlan(
      {
        // ... minimum ComposedProjectInput shape; copy a known fixture
        // adding varsManifest + a module publicConfig with ${CID}
      } as never,
      { slug: 't', auth: { auth0: { clientId: 'CCC' } } } as never,
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      // assert that the rendered module config contains "CCC", not "${CID}"
    }
  });

  it('fails the plan with DEPLOY_PLAN_TARGET_VAR_MISSING when required var unavailable', () => {
    const plan = buildProjectDeploymentPlan(
      {
        // varsManifest declares CID required from target.auth.auth0.clientId
      } as never,
      { slug: 't', auth: {} } as never,
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.errors[0]!.code).toBe('DEPLOY_PLAN_TARGET_VAR_MISSING');
    }
  });
});
```

> Note: the engineer must fill in the minimal `ComposedProjectInput` shape from existing fixtures in this package's `test/fixtures/` (look for `notes-demo` or `composed-` files). The test asserts the contract; fixture details depend on the current shape.

- [ ] **Step 5: Run tests, expect PASS**

Run: `pnpm -F @rntme/deploy-core test`
Expected: PASS, including new tests and existing.

- [ ] **Step 6: Commit**

```bash
git add packages/deploy/deploy-core/src
git commit -m "feat(deploy-core): resolve and apply vars during planning"
```

### Task B.4: Remove the executor's ad-hoc `AUTH0_SPA_CLIENT_ID` throw

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts` (around line 470)

- [ ] **Step 1: Remove the throw**

Find the line `throw new Error('AUTH0_SPA_CLIENT_ID deploy target auth.auth0.clientId is required');`. Delete the throw and the surrounding ad-hoc check (the planner now handles it via vars).

- [ ] **Step 2: Build and run executor tests**

Run: `pnpm -F @rntme/platform-http test`
Expected: PASS (the planner now produces a typed error if the target lacks the value, and the executor surfaces it via the standard failure path).

- [ ] **Step 3: Commit**

```bash
git add apps/platform-http/src/deploy/executor.ts
git commit -m "refactor(platform): remove ad-hoc AUTH0_SPA_CLIENT_ID throw"
```

---

## Component C — typed deploy error families and stage runner

### Task C.1: Add `DEPLOY_RENDER_*`, `DEPLOY_APPLY_*`, `DEPLOY_VERIFY_*` error families

**Files:**
- Create: `packages/deploy/deploy-core/src/errors-render.ts`
- Create: `packages/deploy/deploy-core/src/errors-apply.ts`
- Create: `packages/deploy/deploy-core/src/errors-verify.ts`
- Modify: `packages/deploy/deploy-core/src/index.ts`

- [ ] **Step 1: Write `errors-render.ts`**

```ts
export const DEPLOY_RENDER_ERROR_CODES = {
  DEPLOY_RENDER_NGINX_INVALID: 'DEPLOY_RENDER_NGINX_INVALID',
  DEPLOY_RENDER_COMPOSE_INVALID: 'DEPLOY_RENDER_COMPOSE_INVALID',
  DEPLOY_RENDER_UI_BUNDLE_MISSING: 'DEPLOY_RENDER_UI_BUNDLE_MISSING',
} as const;

export type DeploymentRenderErrorCode = keyof typeof DEPLOY_RENDER_ERROR_CODES;
export type DeploymentRenderError = Readonly<{
  code: DeploymentRenderErrorCode;
  message: string;
  resource?: string;
}>;
```

- [ ] **Step 2: Write `errors-apply.ts`**

```ts
export const DEPLOY_APPLY_ERROR_CODES = {
  DEPLOY_APPLY_DOKPLOY_TASK_REJECTED: 'DEPLOY_APPLY_DOKPLOY_TASK_REJECTED',
  DEPLOY_APPLY_MOUNT_PATH_MISSING: 'DEPLOY_APPLY_MOUNT_PATH_MISSING',
  DEPLOY_APPLY_DOKPLOY_API_ERROR: 'DEPLOY_APPLY_DOKPLOY_API_ERROR',
  DEPLOY_APPLY_TIMEOUT: 'DEPLOY_APPLY_TIMEOUT',
} as const;

export type DeploymentApplyErrorCode = keyof typeof DEPLOY_APPLY_ERROR_CODES;
export type DeploymentApplyError = Readonly<{
  code: DeploymentApplyErrorCode;
  message: string;
  resource?: string;
  taskId?: string;
}>;
```

- [ ] **Step 3: Write `errors-verify.ts`**

```ts
export const DEPLOY_VERIFY_ERROR_CODES = {
  DEPLOY_VERIFY_HEALTH_NON_200: 'DEPLOY_VERIFY_HEALTH_NON_200',
  DEPLOY_VERIFY_UI_NON_200: 'DEPLOY_VERIFY_UI_NON_200',
  DEPLOY_VERIFY_CONFIG_NON_200: 'DEPLOY_VERIFY_CONFIG_NON_200',
  DEPLOY_VERIFY_PROTECTED_ROUTE_NOT_401: 'DEPLOY_VERIFY_PROTECTED_ROUTE_NOT_401',
  DEPLOY_VERIFY_PROTECTED_ROUTE_BAD_BODY: 'DEPLOY_VERIFY_PROTECTED_ROUTE_BAD_BODY',
  DEPLOY_VERIFY_TIMEOUT: 'DEPLOY_VERIFY_TIMEOUT',
} as const;

export type DeploymentVerifyErrorCode = keyof typeof DEPLOY_VERIFY_ERROR_CODES;
export type DeploymentVerifyError = Readonly<{
  code: DeploymentVerifyErrorCode;
  message: string;
  url?: string;
  status?: number | 'timeout' | 'error';
}>;
```

- [ ] **Step 4: Re-export from index**

Append to `packages/deploy/deploy-core/src/index.ts`:

```ts
export { DEPLOY_RENDER_ERROR_CODES } from './errors-render.js';
export type { DeploymentRenderErrorCode, DeploymentRenderError } from './errors-render.js';
export { DEPLOY_APPLY_ERROR_CODES } from './errors-apply.js';
export type { DeploymentApplyErrorCode, DeploymentApplyError } from './errors-apply.js';
export { DEPLOY_VERIFY_ERROR_CODES } from './errors-verify.js';
export type { DeploymentVerifyErrorCode, DeploymentVerifyError } from './errors-verify.js';
```

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm -F @rntme/deploy-core typecheck`
Expected: PASS.

```bash
git add packages/deploy/deploy-core/src
git commit -m "feat(deploy-core): typed render/apply/verify error families"
```

### Task C.2: Add `runStage` wrapper

**Files:**
- Create: `apps/platform-http/src/deploy/stage-runner.ts`
- Create: `apps/platform-http/test/unit/deploy/stage-runner.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/platform-http/test/unit/deploy/stage-runner.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runStage } from '../../../src/deploy/stage-runner.js';

describe('runStage', () => {
  it('returns the value when stage succeeds', async () => {
    const log = vi.fn();
    const r = await runStage('plan', async () => ({ ok: true as const, value: 42 }), { log });
    expect(r).toEqual({ ok: true, value: 42 });
    expect(log).not.toHaveBeenCalled();
  });

  it('logs structured error on Result-Err and returns it', async () => {
    const log = vi.fn();
    const r = await runStage(
      'plan',
      async () => ({ ok: false as const, errors: [{ code: 'X_FAIL', message: 'boom' }] }),
      { log },
    );
    expect(r.ok).toBe(false);
    expect(log).toHaveBeenCalledWith({ step: 'plan', level: 'error', code: 'X_FAIL', message: 'boom' });
  });

  it('catches throws, logs uncaught code, re-throws', async () => {
    const log = vi.fn();
    await expect(
      runStage('apply', async () => { throw new Error('kaboom'); }, { log }),
    ).rejects.toThrow('kaboom');
    expect(log).toHaveBeenCalledWith({ step: 'apply', level: 'error', code: 'DEPLOY_EXECUTOR_UNCAUGHT', message: 'kaboom' });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm -F @rntme/platform-http vitest run test/unit/deploy/stage-runner.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `stage-runner.ts`**

```ts
export type StageLog = (entry: {
  readonly step: string;
  readonly level: 'error';
  readonly code: string;
  readonly message: string;
}) => void | Promise<void>;

export type StageResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly { readonly code: string; readonly message: string }[] };

export async function runStage<T>(
  step: string,
  fn: () => Promise<StageResult<T>>,
  deps: { log: StageLog },
): Promise<StageResult<T>> {
  let r: StageResult<T>;
  try {
    r = await fn();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await deps.log({ step, level: 'error', code: 'DEPLOY_EXECUTOR_UNCAUGHT', message });
    throw cause;
  }
  if (!r.ok) {
    const first = r.errors[0];
    await deps.log({
      step,
      level: 'error',
      code: first?.code ?? 'DEPLOY_EXECUTOR_UNCAUGHT',
      message: first?.message ?? 'stage failed',
    });
  }
  return r;
}
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `pnpm -F @rntme/platform-http vitest run test/unit/deploy/stage-runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/deploy/stage-runner.ts apps/platform-http/test/unit/deploy/stage-runner.test.ts
git commit -m "feat(platform): runStage wrapper for typed-result + uncaught logging"
```

### Task C.3: Wrap executor stages with `runStage`

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`

- [ ] **Step 1: Identify stage boundaries**

In `executor.ts`, the existing `appendLog(...)` calls demarcate stages: `init`, `plan`, `render`, `apply`, `verify`, plus the outer `try/catch` block ending around line 219.

- [ ] **Step 2: Bind a `log` adapter for `runStage`**

Inside the executor function, near the top:

```ts
import { runStage } from './stage-runner.js';

const log = async (entry: { step: string; level: 'error'; code: string; message: string }) =>
  appendLog(deps, deploymentId, orgId, 'error', entry.step, `${entry.code}: ${entry.message}`);
```

- [ ] **Step 3: Wrap the planning step**

Find the planning block (the `buildProjectDeploymentPlan` call and the `if (!isOk(planResult))` check). Replace with:

```ts
const planResult = await runStage('plan', async () => deps.planProject?.(...) ?? buildProjectDeploymentPlan(...), { log });
if (!planResult.ok) {
  return finalize(planResult.errors[0]?.code, planResult.errors[0]?.message, /*…*/);
}
```

(Adjust `finalize` to match the existing failure-path call site; the goal is to emit the typed error code + message as deployment failure data, not as `DEPLOY_EXECUTOR_UNCAUGHT`.)

- [ ] **Step 4: Wrap render and apply stages similarly**

Replace render, apply, verify analogously. Each typed-result error code now flows through `errorCode`/`errorMessage` on the deployment record.

- [ ] **Step 5: Run executor tests**

Run: `pnpm -F @rntme/platform-http vitest run test/unit/deploy`
Expected: PASS (existing tests + assertions about typed codes; if existing tests assert `DEPLOY_EXECUTOR_UNCAUGHT` for cases now typed, update those assertions to the new typed codes).

- [ ] **Step 6: Commit**

```bash
git add apps/platform-http/src/deploy/executor.ts
git commit -m "refactor(platform): wrap deploy stages in runStage with typed errors"
```

---

## Component D — smoke verifier real probes

### Task D.1: Replace placeholder branch + classify routes

**Files:**
- Modify: `apps/platform-http/src/deploy/smoke-verifier.ts`
- Modify: `packages/platform/platform-core/src/types.ts` (or wherever `VerificationReport` lives)
- Create: `apps/platform-http/test/unit/deploy/smoke-verifier-real.test.ts`

- [ ] **Step 1: Locate `VerificationReport` and confirm shape**

Run: `grep -rn "VerificationReport" packages/platform/platform-core/src/ apps/platform-http/src/`

Note the file. Confirm `checks[]` shape is `{ name, url, status, latencyMs, ok, note? }`.

- [ ] **Step 2: Extend `VerificationHints` to include `protectedRoutes`**

In `apps/platform-http/src/deploy/smoke-verifier.ts`:

```ts
export type ProtectedRouteSpec = Readonly<{
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
}>;

export type VerificationHints = {
  readonly healthUrl: string;
  readonly uiUrl?: string;
  readonly configUrl?: string;
  readonly publicRouteUrls: readonly string[];
  readonly protectedRoutes?: readonly ProtectedRouteSpec[];
};
```

(Keep the legacy `protectedRouteChecks` field for one PR if tests still reference it; otherwise rename in the same change.)

- [ ] **Step 3: Write the failing real-probe test**

Create `apps/platform-http/test/unit/deploy/smoke-verifier-real.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { SmokeVerifier, type SmokeFetcher } from '../../../src/deploy/smoke-verifier.js';

const ok401 = { status: 401, latencyMs: 1, body: '{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}', contentType: 'application/json' };
const ok200html = { status: 200, latencyMs: 1, body: '<!doctype html>', contentType: 'text/html' };
const ok200 = { status: 200, latencyMs: 1, contentType: 'text/plain' };

describe('SmokeVerifier real probes', () => {
  it('removes "not auto-checked in MVP" placeholder for public routes', async () => {
    const fetcher = vi.fn(async () => ok200);
    const v = new SmokeVerifier(fetcher as unknown as SmokeFetcher);
    const report = await v.verify({
      verificationHints: {
        healthUrl: 'http://x/health',
        publicRouteUrls: ['http://x/'],
      },
    });
    expect(report.checks.every((c) => c.note !== 'not auto-checked in MVP')).toBe(true);
  });

  it('runs three probes per protected route (no-bearer, fake-bearer, empty-bearer)', async () => {
    const calls: { url: string; headers?: Record<string, string> }[] = [];
    const fetcher: SmokeFetcher = async (url, opts) => {
      calls.push({ url, headers: opts.headers });
      return ok401;
    };
    const v = new SmokeVerifier(fetcher);
    const report = await v.verify({
      verificationHints: {
        healthUrl: 'http://x/health',
        publicRouteUrls: [],
        protectedRoutes: [{ name: 'api-notes', method: 'GET', url: 'http://x/api/notes' }],
      },
    });
    expect(calls.filter((c) => c.url === 'http://x/api/notes').length).toBe(3);
    expect(report.ok).toBe(true);
  });

  it('fails the deployment when a protected probe returns 200 instead of 401', async () => {
    const fetcher: SmokeFetcher = async (_url, _opts) => ok200;
    const v = new SmokeVerifier(fetcher);
    const report = await v.verify({
      verificationHints: {
        healthUrl: 'http://x/health',
        publicRouteUrls: [],
        protectedRoutes: [{ name: 'api-notes', method: 'GET', url: 'http://x/api/notes' }],
      },
    });
    expect(report.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Run, expect FAIL**

Run: `pnpm -F @rntme/platform-http vitest run test/unit/deploy/smoke-verifier-real.test.ts`
Expected: FAIL.

- [ ] **Step 5: Extend `SmokeFetcher` to accept headers and rewrite verifier**

Update the fetcher signature in `smoke-verifier.ts`:

```ts
export type SmokeFetcher = (
  url: string,
  opts: { method: 'HEAD' | 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; timeoutMs: number; headers?: Record<string, string> },
) => Promise<{ status: number | 'timeout' | 'error'; latencyMs: number; body?: string; contentType?: string }>;
```

In `defaultSmokeFetcher`, pass headers through to `globalThis.fetch`.

Replace the `for (const url of verificationHints.publicRouteUrls)` block with real probes (`GET <url>` -> assert 2xx). Add the three-probe block for each protected route:

```ts
for (const route of verificationHints.protectedRoutes ?? []) {
  for (const auth of [undefined, 'Bearer invalid.token.here', 'Bearer ']) {
    const headers = auth ? { Authorization: auth } : undefined;
    const r = await this.fetcher(route.url, { method: route.method, timeoutMs: 5_000, headers });
    let bodyOk = false;
    try {
      const parsed = r.body ? JSON.parse(r.body) : {};
      bodyOk = parsed?.code === 'RUNTIME_AUTH_TOKEN_INVALID';
    } catch {
      bodyOk = false;
    }
    checks.push({
      name: `${route.name} (${auth ?? 'no-auth'})`,
      url: route.url,
      status: r.status,
      latencyMs: r.latencyMs,
      ok: r.status === 401 && isJson(r.contentType) && bodyOk,
    });
  }
}
```

Update the report computation: `checks.every((c) => c.ok)`. Drop `partialOk` to `false` (or remove the field if unused; otherwise leave at `false`).

- [ ] **Step 6: Run tests, expect PASS**

Run: `pnpm -F @rntme/platform-http vitest run test/unit/deploy`
Expected: PASS, including any older tests in `smoke-verifier.test.ts` (update them if they relied on the placeholder behavior).

- [ ] **Step 7: Commit**

```bash
git add apps/platform-http/src/deploy/smoke-verifier.ts apps/platform-http/test/unit/deploy/smoke-verifier-real.test.ts
git commit -m "feat(platform): real public + protected route probes in smoke verifier"
```

### Task D.2: Populate `verificationHints.protectedRoutes` from rendered plan

**Files:**
- Modify: `apps/platform-http/src/deploy/build-deploy-config.ts` (or wherever `verificationHints` is constructed)
- Modify: `packages/deploy/deploy-dokploy/src/` (look for where the rendered plan emits `verificationHints`)

- [ ] **Step 1: Locate the existing hints construction**

Run: `grep -rn "verificationHints" apps/platform-http/src packages/deploy --include='*.ts'`

- [ ] **Step 2: Compute protected routes from blueprint mounts**

For each mount where `use` includes a middleware whose `kind === 'auth'`, and whose `target` is `http:/<path>`, add to the hints:

```ts
{ name: `protected-${routeId}`, method: 'GET', url: `${publicBaseUrl}${path}` }
```

Add an entry per `(method, path)` declared in the bindings of the targeted service (look up via `service.bindings.<id>.http.method/path`).

- [ ] **Step 3: Run integration test for executor / hints**

Run: `pnpm -F @rntme/platform-http test`
Expected: PASS. If a snapshot of `verificationHints` is stored, update it to include the `protectedRoutes` array.

- [ ] **Step 4: Commit**

```bash
git add apps/platform-http/src/deploy
git commit -m "feat(platform): emit protectedRoutes in verificationHints"
```

---

## Self-Review Pass

- [ ] **Run full pipeline**

```bash
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
```

Expected: PASS across the workspace.

- [ ] **Confirm no remaining `not auto-checked in MVP`**

Run: `grep -rn "not auto-checked in MVP" apps/ packages/`
Expected: empty.

- [ ] **Confirm no `DEPLOY_EXECUTOR_UNCAUGHT` in non-fallback paths**

Run: `grep -n "DEPLOY_EXECUTOR_UNCAUGHT" apps/platform-http/src/deploy/`
Expected: only in `stage-runner.ts` (last-resort path).

- [ ] **Final commit and summary**

If anything was bundled across tasks, fold into a single tidy commit per logical unit. Push the branch.
