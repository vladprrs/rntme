> Status: historical.
> Date: 2026-05-03.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Module Provisioner Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make external-state provisioning (Auth0 SPA client config, Resource Server, Connection enablement, M2M clients) a first-class module contract enforced by the deploy pipeline, eliminating manual Auth0 dashboard fiddling.

**Architecture:** Extend `module.json` with a declarative `provisioner` block (entry/produces/requires). Insert a `provision` phase between `plan` and `render` in the executor. Persist public outputs as JSONB and secret outputs as encrypted ciphertext on `deployment`. Persist Mgmt API credentials as encrypted target secrets on `deploy_target`. Auth0 module ships a concrete provisioner that reconciles SPA + Resource Server + Connection + M2M, plus a `tearDown` invoked by the project-delete operation before Dokploy resource deletion.

**Tech Stack:** TypeScript, zod, drizzle-orm (Postgres), Vitest, libsodium-style symmetric crypto via existing `SecretCipher` interface, Node `fetch` for Auth0 Mgmt API.

**Spec:** `docs/history/specs/historical/2026-05-03-module-provisioner-contract-design.md` (commit `d03b327`).

---

## File Structure

### Created files
- `packages/tooling/module-skeleton/src/manifest-shape.ts` — extended (+ProvisionerBlock zod)
- `packages/deploy/deploy-core/src/provisioner-contract.ts` — `ProvisionerContract<I>`, `ProvisionerInput`, `ProvisionerOutput`, `ProvisionerLog`
- `packages/deploy/deploy-core/src/provision.ts` — `runProvisioners` and types
- `packages/deploy/deploy-core/src/provisioner-env-mapping.ts` — env-mapping resolver
- `packages/deploy/deploy-core/src/errors-provision.ts` — `DEPLOY_PROVISION_ERROR_CODES`
- `packages/deploy/deploy-core/test/unit/provision.test.ts`
- `packages/deploy/deploy-core/test/unit/provisioner-env-mapping.test.ts`
- `packages/deploy/deploy-core/test/conformance/provisioner-contract.test.ts`
- `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts`
- `packages/platform/platform-core/src/use-cases/target-secrets/schemas.test.ts`
- `packages/platform/platform-storage/drizzle/0007_provisioner_columns.sql`
- `packages/platform/platform-storage/src/repos/pg-target-secrets-repo.ts`
- `packages/platform/platform-storage/test/repos/pg-target-secrets-repo.test.ts`
- `apps/platform-http/src/routes/target-secrets.ts`
- `apps/platform-http/test/unit/routes/target-secrets.test.ts`
- `modules/identity/auth0/src/mgmt-client.ts`
- `modules/identity/auth0/src/provisioner.ts`
- `modules/identity/auth0/test/unit/provisioner.test.ts`
- `modules/identity/auth0/test/e2e/provisioner.test.ts`

### Modified files
- `packages/tooling/module-skeleton/src/index.ts` — re-export new types
- `packages/tooling/module-skeleton/test/unit/manifest-shape.test.ts` — provisioner cases
- `packages/artifacts/blueprint/src/compose/modules.ts` — surface `provisioner`
- `packages/artifacts/blueprint/test/unit/discover-modules.test.ts` — provisioner cases
- `packages/artifacts/blueprint/src/types/result.ts` — `BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY`
- `packages/deploy/deploy-core/src/index.ts` — re-export provisioner surface
- `packages/deploy/deploy-dokploy/src/render.ts` — accept third arg, apply env mappings
- `packages/deploy/deploy-dokploy/test/unit/render.test.ts` — provisioner-output env baking
- `packages/platform/platform-storage/src/schema/deployment.ts` — `provision_result*` columns
- `packages/platform/platform-storage/src/schema/deploy-target.ts` — `target_secrets_*` columns
- `packages/platform/platform-storage/src/repos/pg-deployment-repo.ts` — set/get provision result
- `packages/platform/platform-core/src/index.ts` — re-export `TargetSecretsRepo`
- `apps/platform-http/src/deploy/executor.ts` — five-phase wiring + decryption boundary
- `apps/platform-http/src/deploy/log-redactor.ts` — extend regex
- `apps/platform-http/src/server.ts` — mount target-secrets route
- `apps/platform-http/test/integration/deploy-executor.test.ts` — five-phase + skip cases
- `apps/platform-http/test/unit/deploy/log-redactor.test.ts` — new patterns
- `modules/identity/auth0/module.json` — provisioner block
- `modules/identity/auth0/package.json` — `provisioner` export path
- `CLAUDE.md` — Architecture-in-one-paragraph
- `AGENTS.md` — §3, §6 how-tos, §10 glossary
- `packages/tooling/module-skeleton/README.md`
- `packages/artifacts/blueprint/README.md`
- `packages/deploy/deploy-core/README.md`
- `packages/deploy/deploy-dokploy/README.md`
- `apps/platform-http/README.md`
- `modules/identity/auth0/README.md`
- `docs/architecture.md`
- `docs/history/specs/historical/2026-05-03-project-update-delete-operations-design.md` (D-row + paragraph) **OR** new `…-errata-01.md` if merged before PR 3

---

## PR 1 — Manifest schema + discovery + deploy-core surface

### Task 1: Add `ProvisionerBlock` zod schema to module-skeleton

**Files:**
- Modify: `packages/tooling/module-skeleton/src/manifest-shape.ts`
- Test: `packages/tooling/module-skeleton/test/unit/manifest-shape.test.ts`

- [ ] **Step 1.1: Write failing tests for `ProvisionerBlock`**

Append to `packages/tooling/module-skeleton/test/unit/manifest-shape.test.ts`:

```ts
describe('ModuleManifestSchema — provisioner block', () => {
  const baseManifest = {
    name: 'identity-auth0',
    version: '1.0.0',
    category: 'identity',
    vendor: 'auth0',
    contract: 'identity/v1',
    capabilities: { rpcs: ['GetUser'], events: [] },
  };

  it('accepts a valid provisioner block', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: {
        entry: './dist/provisioner.js',
        produces: [
          { name: 'spaClient', kind: 'single', secret: false },
          { name: 'm2mClients', kind: 'many', secret: true },
        ],
        requires: [{ name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' }],
        timeoutMs: 30000,
      },
    });
    expect(parsed.ok).toBe(true);
  });

  it('rejects empty produces array', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: { entry: './dist/provisioner.js', produces: [] },
    });
    expect(parsed.ok).toBe(false);
  });

  it('rejects duplicate produces names', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: {
        entry: './dist/provisioner.js',
        produces: [
          { name: 'spaClient', kind: 'single', secret: false },
          { name: 'spaClient', kind: 'single', secret: true },
        ],
      },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((e) => e.message.includes('PROVISIONER_DUPLICATE_PRODUCES'))).toBe(true);
    }
  });

  it('rejects duplicate requires names', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: {
        entry: './dist/provisioner.js',
        produces: [{ name: 'a', kind: 'single', secret: false }],
        requires: [
          { name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' },
          { name: 'auth0Mgmt', schema: 'something-else' },
        ],
      },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((e) => e.message.includes('PROVISIONER_DUPLICATE_REQUIRES'))).toBe(true);
    }
  });

  it('rejects unknown kind', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: {
        entry: './dist/provisioner.js',
        produces: [{ name: 'a', kind: 'list', secret: false }],
      },
    });
    expect(parsed.ok).toBe(false);
  });

  it('rejects empty entry', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: {
        entry: '',
        produces: [{ name: 'a', kind: 'single', secret: false }],
      },
    });
    expect(parsed.ok).toBe(false);
  });

  it('treats provisioner block as optional', () => {
    const parsed = parseModuleManifest(baseManifest);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.provisioner).toBeUndefined();
    }
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `pnpm -F @rntme/module-skeleton vitest run test/unit/manifest-shape.test.ts`
Expected: 7 failures (provisioner field unknown / not validated).

- [ ] **Step 1.3: Implement the schema extension**

Edit `packages/tooling/module-skeleton/src/manifest-shape.ts`. Add three new schemas before `ModuleManifestSchema`:

```ts
export const ProvisionerProducesSchema = z
  .object({
    name: z.string().min(1),
    kind: z.enum(['single', 'many']),
    secret: z.boolean(),
  })
  .strict();

export const ProvisionerRequiresSchema = z
  .object({
    name: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict();

export const ProvisionerBlockSchema = z
  .object({
    entry: z.string().min(1),
    produces: z.array(ProvisionerProducesSchema).min(1),
    requires: z.array(ProvisionerRequiresSchema).default([]),
    timeoutMs: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const names = v.produces.map((p) => p.name);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    if (dup.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['produces'],
        message: `MODULE_MANIFEST_PROVISIONER_DUPLICATE_PRODUCES: duplicate produces names (${[...new Set(dup)].join(', ')})`,
      });
    }
    const reqNames = v.requires.map((r) => r.name);
    const dupReq = reqNames.filter((n, i) => reqNames.indexOf(n) !== i);
    if (dupReq.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requires'],
        message: `MODULE_MANIFEST_PROVISIONER_DUPLICATE_REQUIRES: duplicate requires names (${[...new Set(dupReq)].join(', ')})`,
      });
    }
  });
```

In the `ModuleManifestSchema` `.object({...})` block, add `provisioner: ProvisionerBlockSchema.optional()` between `client:` and `limitations:`.

At the bottom, add type exports:

```ts
export type ProvisionerProduces = z.infer<typeof ProvisionerProducesSchema>;
export type ProvisionerRequires = z.infer<typeof ProvisionerRequiresSchema>;
export type ProvisionerBlock = z.infer<typeof ProvisionerBlockSchema>;
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `pnpm -F @rntme/module-skeleton vitest run test/unit/manifest-shape.test.ts`
Expected: all green.

- [ ] **Step 1.5: Update `index.ts` exports**

Edit `packages/tooling/module-skeleton/src/index.ts`. In the `export {}` block add `ProvisionerBlockSchema`, `ProvisionerProducesSchema`, `ProvisionerRequiresSchema`. In the `export type {}` block add `ProvisionerBlock`, `ProvisionerProduces`, `ProvisionerRequires`.

- [ ] **Step 1.6: Build and commit**

Run: `pnpm -F @rntme/module-skeleton run build && pnpm -F @rntme/module-skeleton run typecheck`
Expected: green.

```bash
git add packages/tooling/module-skeleton
git commit -m "feat(module-skeleton): add provisioner block to manifest schema"
```

---

### Task 2: Plumb `provisioner` through blueprint discovery

**Files:**
- Modify: `packages/artifacts/blueprint/src/compose/modules.ts`
- Modify: `packages/artifacts/blueprint/src/types/result.ts`
- Test: `packages/artifacts/blueprint/test/unit/discover-modules.test.ts`

- [ ] **Step 2.1: Write failing test cases**

Append to `packages/artifacts/blueprint/test/unit/discover-modules.test.ts` (or create the file if absent — locate the existing test file by `ls packages/artifacts/blueprint/test/unit/` first):

```ts
describe('discoverModules — provisioner block', () => {
  it('surfaces provisioner block on DiscoveredModule', async () => {
    const projectDir = await mkTempProject({
      'project.json': JSON.stringify({
        name: 'demo',
        modules: { identity: { package: '@rntme/identity-auth0' } },
      }),
      'node_modules/@rntme/identity-auth0/module.json': JSON.stringify({
        name: '@rntme/identity-auth0',
        version: '1.0.0',
        category: 'identity',
        vendor: 'auth0',
        contract: 'identity/v1',
        capabilities: { rpcs: ['GetUser'], events: [] },
        provisioner: {
          entry: './dist/provisioner.js',
          produces: [{ name: 'spaClient', kind: 'single', secret: false }],
          requires: [{ name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' }],
        },
      }),
    });
    const result = discoverModules({ projectDir });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const m = result.value['@rntme/identity-auth0'];
      expect(m.manifest.provisioner).toEqual({
        entry: './dist/provisioner.js',
        produces: [{ name: 'spaClient', kind: 'single', secret: false }],
        requires: [{ name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' }],
      });
    }
  });

  it('rejects absolute provisioner entry', async () => {
    const projectDir = await mkTempProject({
      'project.json': JSON.stringify({
        name: 'demo',
        modules: { identity: { package: '@rntme/identity-auth0' } },
      }),
      'node_modules/@rntme/identity-auth0/module.json': JSON.stringify({
        name: '@rntme/identity-auth0',
        version: '1.0.0',
        category: 'identity',
        vendor: 'auth0',
        contract: 'identity/v1',
        capabilities: { rpcs: ['GetUser'], events: [] },
        provisioner: {
          entry: '/absolute/path/provisioner.js',
          produces: [{ name: 'a', kind: 'single', secret: false }],
        },
      }),
    });
    const result = discoverModules({ projectDir });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY')).toBe(true);
    }
  });

  it('rejects parent-traversal provisioner entry', async () => {
    const projectDir = await mkTempProject({
      'project.json': JSON.stringify({
        name: 'demo',
        modules: { identity: { package: '@rntme/identity-auth0' } },
      }),
      'node_modules/@rntme/identity-auth0/module.json': JSON.stringify({
        name: '@rntme/identity-auth0',
        version: '1.0.0',
        category: 'identity',
        vendor: 'auth0',
        contract: 'identity/v1',
        capabilities: { rpcs: ['GetUser'], events: [] },
        provisioner: {
          entry: '../escapes/provisioner.js',
          produces: [{ name: 'a', kind: 'single', secret: false }],
        },
      }),
    });
    const result = discoverModules({ projectDir });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY')).toBe(true);
    }
  });
});
```

If `mkTempProject` does not exist, follow whatever fixture pattern the existing tests already use (look at the top of the file).

- [ ] **Step 2.2: Run tests, verify failures**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/discover-modules.test.ts`
Expected: 3 failures.

- [ ] **Step 2.3: Add new error code**

Edit `packages/artifacts/blueprint/src/types/result.ts`. Add to `ERROR_CODES`:

```ts
BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY: 'BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY',
```

- [ ] **Step 2.4: Validate provisioner.entry in discoverModules**

Edit `packages/artifacts/blueprint/src/compose/modules.ts`. After the existing `parsed.value.category` check (around line 93), insert:

```ts
    if (parsed.value.provisioner) {
      const entry = parsed.value.provisioner.entry;
      if (entry.startsWith('/') || entry.startsWith('..') || entry.includes('/../') || entry.includes('\\..\\')) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY,
          message: `module "${packageName}" provisioner.entry "${entry}" must be a relative path inside the package`,
          path: `${packageName}/module.json:provisioner.entry`,
        });
        continue;
      }
    }
```

`DiscoveredModule.manifest` already includes `provisioner` because manifest is the full parsed shape — no further plumbing needed.

- [ ] **Step 2.5: Run tests, verify pass**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/discover-modules.test.ts`
Expected: green.

- [ ] **Step 2.6: Build and commit**

```bash
pnpm -F @rntme/blueprint run build && pnpm -F @rntme/blueprint run typecheck
git add packages/artifacts/blueprint
git commit -m "feat(blueprint): validate and surface provisioner block in discovery"
```

---

### Task 3: Define `ProvisionerContract` types in deploy-core

**Files:**
- Create: `packages/deploy/deploy-core/src/provisioner-contract.ts`
- Modify: `packages/deploy/deploy-core/src/index.ts`

- [ ] **Step 3.1: Create the contract types file**

Create `packages/deploy/deploy-core/src/provisioner-contract.ts`:

```ts
import type { Result } from './result.js';

export type ProvisionerLog = (entry: {
  readonly step: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly code?: string;
  readonly message: string;
}) => void;

export type ProvisionerInput<I = unknown> = {
  readonly publicConfig: I;
  readonly targetSecrets: Readonly<Record<string, unknown>>;
  readonly priorOutputs?: {
    readonly publicOutputs: Readonly<Record<string, unknown>>;
    readonly secretOutputs: Readonly<Record<string, unknown>>;
  };
  readonly log: ProvisionerLog;
  readonly signal: AbortSignal;
};

export type ProvisionerOutput = {
  readonly publicOutputs: Readonly<Record<string, unknown>>;
  readonly secretOutputs: Readonly<Record<string, unknown>>;
};

export type ProvisionerVendorError = {
  readonly code: string;
  readonly message: string;
};

export type ProvisionerContract<I = unknown> = {
  provision(input: ProvisionerInput<I>): Promise<Result<ProvisionerOutput, ProvisionerVendorError>>;
  tearDown?(input: ProvisionerInput<I>): Promise<Result<void, ProvisionerVendorError>>;
};
```

- [ ] **Step 3.2: Re-export from deploy-core index**

Edit `packages/deploy/deploy-core/src/index.ts`. Append:

```ts
export type {
  ProvisionerContract,
  ProvisionerInput,
  ProvisionerOutput,
  ProvisionerLog,
  ProvisionerVendorError,
} from './provisioner-contract.js';
```

- [ ] **Step 3.3: Build and commit**

```bash
pnpm -F @rntme/deploy-core run build && pnpm -F @rntme/deploy-core run typecheck
git add packages/deploy/deploy-core/src/provisioner-contract.ts packages/deploy/deploy-core/src/index.ts
git commit -m "feat(deploy-core): add ProvisionerContract types"
```

---

### Task 4: Add provisioner error codes

**Files:**
- Create: `packages/deploy/deploy-core/src/errors-provision.ts`
- Modify: `packages/deploy/deploy-core/src/index.ts`

- [ ] **Step 4.1: Create errors-provision.ts**

```ts
export const DEPLOY_PROVISION_ERROR_CODES = {
  DEPLOY_PROVISION_MODULE_RESOLVE_FAILED: 'DEPLOY_PROVISION_MODULE_RESOLVE_FAILED',
  DEPLOY_PROVISION_ENTRY_LOAD_FAILED: 'DEPLOY_PROVISION_ENTRY_LOAD_FAILED',
  DEPLOY_PROVISION_TARGET_SECRET_MISSING: 'DEPLOY_PROVISION_TARGET_SECRET_MISSING',
  DEPLOY_PROVISION_TARGET_SECRET_SCHEMA_MISMATCH: 'DEPLOY_PROVISION_TARGET_SECRET_SCHEMA_MISMATCH',
  DEPLOY_PROVISION_TIMEOUT: 'DEPLOY_PROVISION_TIMEOUT',
  DEPLOY_PROVISION_OUTPUT_INVALID: 'DEPLOY_PROVISION_OUTPUT_INVALID',
  DEPLOY_PROVISION_VENDOR_FAILED: 'DEPLOY_PROVISION_VENDOR_FAILED',
} as const;

export type DeploymentProvisionErrorCode = keyof typeof DEPLOY_PROVISION_ERROR_CODES;

export type DeploymentProvisionError = Readonly<{
  code: DeploymentProvisionErrorCode | string;
  message: string;
  module?: string;
}>;
```

- [ ] **Step 4.2: Re-export from index**

Append to `packages/deploy/deploy-core/src/index.ts`:

```ts
export {
  DEPLOY_PROVISION_ERROR_CODES,
  type DeploymentProvisionErrorCode,
  type DeploymentProvisionError,
} from './errors-provision.js';
```

- [ ] **Step 4.3: Build and commit**

```bash
pnpm -F @rntme/deploy-core run build && pnpm -F @rntme/deploy-core run typecheck
git add packages/deploy/deploy-core/src/errors-provision.ts packages/deploy/deploy-core/src/index.ts
git commit -m "feat(deploy-core): add DEPLOY_PROVISION error codes"
```

---

### Task 5: Implement `runProvisioners`

**Files:**
- Create: `packages/deploy/deploy-core/src/provision.ts`
- Test: `packages/deploy/deploy-core/test/unit/provision.test.ts`
- Modify: `packages/deploy/deploy-core/src/index.ts`

- [ ] **Step 5.1: Write failing tests**

Create `packages/deploy/deploy-core/test/unit/provision.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runProvisioners, type DiscoveredProvisionerModule } from '../../src/provision.js';
import type { ProvisionerContract } from '../../src/provisioner-contract.js';
import { ok, err } from '../../src/result.js';

const baseModule = (overrides: Partial<DiscoveredProvisionerModule> = {}): DiscoveredProvisionerModule => ({
  projectKey: 'identity-auth0',
  packageName: '@rntme/identity-auth0',
  manifest: {
    name: '@rntme/identity-auth0',
    version: '1.0.0',
    provisioner: {
      entry: './dist/provisioner.js',
      produces: [
        { name: 'spaClient', kind: 'single', secret: false },
        { name: 'm2mClients', kind: 'many', secret: true },
      ],
      requires: [{ name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' }],
    },
  },
  publicConfig: { redirectUri: 'https://x.example/' },
  ...overrides,
});

const happyContract: ProvisionerContract = {
  async provision() {
    return ok({
      publicOutputs: { spaClient: { id: 'cid', name: 'app' } },
      secretOutputs: { m2mClients: [{ name: 'svc', clientId: 'mid', clientSecret: 'sss' }] },
    });
  },
};

describe('runProvisioners', () => {
  it('skips modules without provisioner block', async () => {
    const result = await runProvisioners({
      modules: [{ ...baseModule(), manifest: { name: 'x', version: '1.0.0' } }],
      resolvedTargetSecrets: {},
      resolveProvisioner: async () => happyContract,
      log: () => undefined,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.modules).toHaveLength(0);
  });

  it('returns aggregated outputs on happy path', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: { tenantDomain: 'x', mgmtClientId: 'a', mgmtClientSecret: 'b' } },
      resolveProvisioner: async () => happyContract,
      log: () => undefined,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.modules).toHaveLength(1);
      expect(result.value.modules[0]?.publicOutputs).toEqual({ spaClient: { id: 'cid', name: 'app' } });
      expect(result.value.modules[0]?.secretOutputs).toEqual({
        m2mClients: [{ name: 'svc', clientId: 'mid', clientSecret: 'sss' }],
      });
    }
  });

  it('fails fast when required target secret is missing', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: {},
      resolveProvisioner: async () => happyContract,
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_TARGET_SECRET_MISSING');
    }
  });

  it('rejects output missing a declared produces name', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      resolveProvisioner: async (): Promise<ProvisionerContract> => ({
        async provision() {
          return ok({ publicOutputs: { spaClient: { id: 'a' } }, secretOutputs: {} });
        },
      }),
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_OUTPUT_INVALID');
      expect(result.errors[0]?.message).toContain('m2mClients');
    }
  });

  it('rejects when produces.kind=many but value is not an array', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      resolveProvisioner: async (): Promise<ProvisionerContract> => ({
        async provision() {
          return ok({
            publicOutputs: { spaClient: { id: 'a' } },
            secretOutputs: { m2mClients: { not: 'an array' } },
          });
        },
      }),
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_OUTPUT_INVALID');
    }
  });

  it('rejects when secret-flagged value lives in publicOutputs', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      resolveProvisioner: async (): Promise<ProvisionerContract> => ({
        async provision() {
          return ok({
            publicOutputs: { spaClient: { id: 'a' }, m2mClients: [{ clientSecret: 'leaked' }] },
            secretOutputs: {},
          });
        },
      }),
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_OUTPUT_INVALID');
    }
  });

  it('returns DEPLOY_PROVISION_VENDOR_FAILED when provision returns Err', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      resolveProvisioner: async (): Promise<ProvisionerContract> => ({
        async provision() {
          return err([{ code: 'AUTH0_THING_FAILED', message: 'upstream said no' }]);
        },
      }),
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('DEPLOY_PROVISION_VENDOR_FAILED');
    }
  });

  it('times out when provision exceeds timeoutMs', async () => {
    vi.useFakeTimers();
    const slow: ProvisionerContract = {
      async provision({ signal }) {
        await new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
        return ok({ publicOutputs: {}, secretOutputs: {} });
      },
    };
    const promise = runProvisioners({
      modules: [{ ...baseModule(), manifest: { ...baseModule().manifest, provisioner: { ...baseModule().manifest.provisioner!, timeoutMs: 50 } } }],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      resolveProvisioner: async () => slow,
      log: () => undefined,
    });
    await vi.advanceTimersByTimeAsync(60);
    const result = await promise;
    vi.useRealTimers();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_TIMEOUT');
    }
  });
});
```

- [ ] **Step 5.2: Run tests, verify failures**

Run: `pnpm -F @rntme/deploy-core vitest run test/unit/provision.test.ts`
Expected: file does not compile (provision.ts missing).

- [ ] **Step 5.3: Implement provision.ts**

Create `packages/deploy/deploy-core/src/provision.ts`:

```ts
import type { ModuleManifest } from '@rntme/module-skeleton';
import { DEPLOY_PROVISION_ERROR_CODES, type DeploymentProvisionError } from './errors-provision.js';
import type { ProvisionerContract, ProvisionerLog, ProvisionerOutput } from './provisioner-contract.js';
import { err, ok, type Result } from './result.js';

export type DiscoveredProvisionerModule = {
  readonly projectKey: string;
  readonly packageName: string;
  readonly manifest: ModuleManifest;
  readonly publicConfig: Readonly<Record<string, unknown>>;
  readonly priorOutputs?: ProvisionerOutput;
};

export type RunProvisionersInput = {
  readonly modules: readonly DiscoveredProvisionerModule[];
  readonly resolvedTargetSecrets: Readonly<Record<string, unknown>>;
  readonly resolveProvisioner: (packageName: string, entry: string) => Promise<ProvisionerContract>;
  readonly log: ProvisionerLog;
  readonly defaultTimeoutMs?: number;
};

export type ProvisionedModule = {
  readonly projectKey: string;
  readonly packageName: string;
  readonly publicOutputs: Readonly<Record<string, unknown>>;
  readonly secretOutputs: Readonly<Record<string, unknown>>;
  readonly provisionedAt: string;
};

export type RunProvisionersValue = { readonly modules: readonly ProvisionedModule[] };
export type RunProvisionersResult = Result<RunProvisionersValue, DeploymentProvisionError>;

const DEFAULT_TIMEOUT_MS = 60_000;

export async function runProvisioners(input: RunProvisionersInput): Promise<RunProvisionersResult> {
  const errors: DeploymentProvisionError[] = [];
  const out: ProvisionedModule[] = [];

  for (const m of input.modules) {
    const block = m.manifest.provisioner;
    if (!block) continue;

    for (const required of block.requires ?? []) {
      if (!Object.prototype.hasOwnProperty.call(input.resolvedTargetSecrets, required.name)) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_TARGET_SECRET_MISSING,
          message: `module "${m.packageName}" requires target secret "${required.name}" (schema "${required.schema}"), but it is not configured on the deploy target`,
          module: m.packageName,
        });
      }
    }
    if (errors.length > 0) return err(errors);

    let contract: ProvisionerContract;
    try {
      contract = await input.resolveProvisioner(m.packageName, block.entry);
    } catch (cause) {
      errors.push({
        code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_ENTRY_LOAD_FAILED,
        message: cause instanceof Error ? cause.message : String(cause),
        module: m.packageName,
      });
      return err(errors);
    }

    const requiredSecrets: Record<string, unknown> = {};
    for (const r of block.requires ?? []) {
      requiredSecrets[r.name] = (input.resolvedTargetSecrets as Record<string, unknown>)[r.name];
    }

    const timeoutMs = block.timeoutMs ?? input.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    let provisionResult: Awaited<ReturnType<ProvisionerContract['provision']>>;
    try {
      provisionResult = await Promise.race([
        contract.provision({
          publicConfig: m.publicConfig,
          targetSecrets: requiredSecrets,
          priorOutputs: m.priorOutputs,
          log: (e) => input.log({ ...e, step: `provision/${m.projectKey}/${e.step}` }),
          signal: ctrl.signal,
        }),
        new Promise<never>((_, reject) => {
          ctrl.signal.addEventListener(
            'abort',
            () => reject(Object.assign(new Error('provision timed out'), { __timeout: true })),
            { once: true },
          );
        }),
      ]);
    } catch (cause) {
      clearTimeout(timer);
      const isTimeout = (cause as { __timeout?: boolean })?.__timeout === true;
      errors.push({
        code: isTimeout
          ? DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_TIMEOUT
          : DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_VENDOR_FAILED,
        message: cause instanceof Error ? cause.message : String(cause),
        module: m.packageName,
      });
      return err(errors);
    }
    clearTimeout(timer);

    if (!provisionResult.ok) {
      for (const e of provisionResult.errors) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_VENDOR_FAILED,
          message: `${e.code}: ${e.message}`,
          module: m.packageName,
        });
      }
      return err(errors);
    }

    const { publicOutputs, secretOutputs } = provisionResult.value;

    for (const p of block.produces) {
      const bucket = p.secret ? secretOutputs : publicOutputs;
      const wrongBucket = p.secret ? publicOutputs : secretOutputs;
      if (!(p.name in bucket)) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_OUTPUT_INVALID,
          message: `module "${m.packageName}" declared produces "${p.name}" (secret=${p.secret}) but value is missing from the ${p.secret ? 'secretOutputs' : 'publicOutputs'} bucket`,
          module: m.packageName,
        });
        continue;
      }
      if (p.name in wrongBucket) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_OUTPUT_INVALID,
          message: `module "${m.packageName}" produces "${p.name}" appears in both publicOutputs and secretOutputs; pick one bucket per produces declaration`,
          module: m.packageName,
        });
        continue;
      }
      const value = (bucket as Record<string, unknown>)[p.name];
      if (p.kind === 'many' && !Array.isArray(value)) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_OUTPUT_INVALID,
          message: `module "${m.packageName}" produces "${p.name}" declared kind=many but returned a non-array`,
          module: m.packageName,
        });
      }
      if (p.kind === 'single' && (value === null || typeof value !== 'object' || Array.isArray(value))) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_OUTPUT_INVALID,
          message: `module "${m.packageName}" produces "${p.name}" declared kind=single but returned a non-object`,
          module: m.packageName,
        });
      }
    }

    if (errors.length > 0) return err(errors);

    out.push({
      projectKey: m.projectKey,
      packageName: m.packageName,
      publicOutputs,
      secretOutputs,
      provisionedAt: new Date().toISOString(),
    });
  }

  return ok({ modules: out });
}
```

- [ ] **Step 5.4: Add re-exports**

Append to `packages/deploy/deploy-core/src/index.ts`:

```ts
export { runProvisioners } from './provision.js';
export type {
  DiscoveredProvisionerModule,
  RunProvisionersInput,
  RunProvisionersResult,
  RunProvisionersValue,
  ProvisionedModule,
} from './provision.js';
```

- [ ] **Step 5.5: Run tests, verify pass**

Run: `pnpm -F @rntme/deploy-core vitest run test/unit/provision.test.ts`
Expected: green.

- [ ] **Step 5.6: Build and commit**

```bash
pnpm -F @rntme/deploy-core run build && pnpm -F @rntme/deploy-core run typecheck && pnpm -F @rntme/deploy-core run lint
git add packages/deploy/deploy-core
git commit -m "feat(deploy-core): add runProvisioners and contract validation"
```

---

### Task 6: Implement env-mapping resolver

**Files:**
- Create: `packages/deploy/deploy-core/src/provisioner-env-mapping.ts`
- Test: `packages/deploy/deploy-core/test/unit/provisioner-env-mapping.test.ts`
- Modify: `packages/deploy/deploy-core/src/index.ts`

- [ ] **Step 6.1: Write failing tests**

Create `packages/deploy/deploy-core/test/unit/provisioner-env-mapping.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveEnvMappings, type ProvisionerEnvMapping } from '../../src/provisioner-env-mapping.js';
import type { ProvisionedModule } from '../../src/provision.js';

const mod: ProvisionedModule = {
  projectKey: 'identity-auth0',
  packageName: '@rntme/identity-auth0',
  publicOutputs: {
    spaClient: { id: 'cid_xyz', name: 'app' },
    resourceServer: { id: 'rs_1', identifier: 'https://x/api' },
  },
  secretOutputs: {
    m2mClients: [
      { name: 'introspect', clientId: 'm_a', clientSecret: 'sec_a' },
      { name: 'webhook', clientId: 'm_b', clientSecret: 'sec_b' },
    ],
  },
  provisionedAt: '2026-05-03T10:00:00Z',
};

describe('resolveEnvMappings', () => {
  it('resolves dot-paths against publicOutputs (kind=single)', () => {
    const mapping: ProvisionerEnvMapping = {
      'identity-auth0': [
        { from: 'spaClient.id', envName: 'AUTH0_SPA_CLIENT_ID', secret: false, target: 'app' },
      ],
    };
    const out = resolveEnvMappings(new Map([['identity-auth0', mod]]), mapping);
    expect(out).toEqual([
      { module: 'identity-auth0', target: 'app', envName: 'AUTH0_SPA_CLIENT_ID', value: 'cid_xyz', secret: false },
    ]);
  });

  it('expands kind=many with star and ${name} substitution', () => {
    const mapping: ProvisionerEnvMapping = {
      'identity-auth0': [
        { from: 'm2mClients.*.clientSecret', envName: 'AUTH0_M2M_${name}_CLIENT_SECRET', secret: true, target: 'identity-auth0' },
      ],
    };
    const out = resolveEnvMappings(new Map([['identity-auth0', mod]]), mapping);
    expect(out).toEqual([
      { module: 'identity-auth0', target: 'identity-auth0', envName: 'AUTH0_M2M_INTROSPECT_CLIENT_SECRET', value: 'sec_a', secret: true },
      { module: 'identity-auth0', target: 'identity-auth0', envName: 'AUTH0_M2M_WEBHOOK_CLIENT_SECRET', value: 'sec_b', secret: true },
    ]);
  });

  it('throws on path not found', () => {
    const mapping: ProvisionerEnvMapping = {
      'identity-auth0': [{ from: 'nope.field', envName: 'X', secret: false, target: 'app' }],
    };
    expect(() => resolveEnvMappings(new Map([['identity-auth0', mod]]), mapping)).toThrow(/nope/);
  });

  it('uppercases ${name} and replaces non-alphanumerics with underscore', () => {
    const modWithDash: ProvisionedModule = {
      ...mod,
      secretOutputs: {
        m2mClients: [{ name: 'web-hook 2', clientId: 'a', clientSecret: 's' }],
      },
    };
    const mapping: ProvisionerEnvMapping = {
      'identity-auth0': [
        { from: 'm2mClients.*.clientSecret', envName: 'AUTH0_M2M_${name}_X', secret: true, target: 'identity-auth0' },
      ],
    };
    const out = resolveEnvMappings(new Map([['identity-auth0', modWithDash]]), mapping);
    expect(out[0]?.envName).toBe('AUTH0_M2M_WEB_HOOK_2_X');
  });
});
```

- [ ] **Step 6.2: Run, verify failure**

Run: `pnpm -F @rntme/deploy-core vitest run test/unit/provisioner-env-mapping.test.ts`
Expected: file does not compile.

- [ ] **Step 6.3: Implement resolver**

Create `packages/deploy/deploy-core/src/provisioner-env-mapping.ts`:

```ts
import type { ProvisionedModule } from './provision.js';

export type EnvMappingEntry = {
  readonly from: string;
  readonly envName: string;
  readonly secret: boolean;
  readonly target: string;
};

export type ProvisionerEnvMapping = Readonly<Record<string, readonly EnvMappingEntry[]>>;

export type ResolvedEnvEntry = {
  readonly module: string;
  readonly target: string;
  readonly envName: string;
  readonly value: string;
  readonly secret: boolean;
};

export function resolveEnvMappings(
  modules: ReadonlyMap<string, ProvisionedModule>,
  mappings: ProvisionerEnvMapping,
): ResolvedEnvEntry[] {
  const out: ResolvedEnvEntry[] = [];
  for (const [moduleKey, entries] of Object.entries(mappings)) {
    const provisioned = modules.get(moduleKey);
    if (!provisioned) continue;
    for (const entry of entries) {
      const bucket = entry.secret ? provisioned.secretOutputs : provisioned.publicOutputs;
      const expanded = expand(entry.from, bucket as Record<string, unknown>);
      for (const { value, name } of expanded) {
        out.push({
          module: moduleKey,
          target: entry.target,
          envName: substituteName(entry.envName, name),
          value: String(value),
          secret: entry.secret,
        });
      }
    }
  }
  return out;
}

function expand(path: string, root: Record<string, unknown>): { value: unknown; name?: string }[] {
  const parts = path.split('.');
  let frontier: { node: unknown; name?: string }[] = [{ node: root }];
  for (const part of parts) {
    const next: { node: unknown; name?: string }[] = [];
    for (const f of frontier) {
      if (part === '*') {
        if (!Array.isArray(f.node)) {
          throw new Error(`env mapping path expansion: expected array at "*" in "${path}", got ${typeof f.node}`);
        }
        for (const item of f.node) {
          const itemName =
            typeof item === 'object' && item !== null && 'name' in item
              ? String((item as { name: unknown }).name)
              : undefined;
          next.push({ node: item, name: itemName });
        }
      } else {
        if (typeof f.node !== 'object' || f.node === null) {
          throw new Error(`env mapping path "${path}": cannot read "${part}" of non-object`);
        }
        if (!(part in (f.node as Record<string, unknown>))) {
          throw new Error(`env mapping path "${path}": missing key "${part}"`);
        }
        next.push({ node: (f.node as Record<string, unknown>)[part], name: f.name });
      }
    }
    frontier = next;
  }
  return frontier.map((f) => ({ value: f.node, name: f.name }));
}

function substituteName(template: string, name: string | undefined): string {
  if (!template.includes('${name}')) return template;
  if (name === undefined) {
    throw new Error(`env mapping uses \${name} but the iterated value has no "name" field`);
  }
  return template.replace(/\$\{name\}/g, normalize(name));
}

function normalize(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
```

- [ ] **Step 6.4: Run tests, verify pass**

Run: `pnpm -F @rntme/deploy-core vitest run test/unit/provisioner-env-mapping.test.ts`
Expected: green.

- [ ] **Step 6.5: Re-export from index**

Append to `packages/deploy/deploy-core/src/index.ts`:

```ts
export { resolveEnvMappings } from './provisioner-env-mapping.js';
export type { EnvMappingEntry, ProvisionerEnvMapping, ResolvedEnvEntry } from './provisioner-env-mapping.js';
```

- [ ] **Step 6.6: Build and commit**

```bash
pnpm -F @rntme/deploy-core run build && pnpm -F @rntme/deploy-core run typecheck && pnpm -F @rntme/deploy-core run lint
git add packages/deploy/deploy-core
git commit -m "feat(deploy-core): add provisioner env-mapping resolver"
```

---

### Task 7: PR-1 doc-touch (module-skeleton, blueprint, deploy-core, AGENTS.md)

**Files:**
- Modify: `packages/tooling/module-skeleton/README.md`
- Modify: `packages/artifacts/blueprint/README.md`
- Modify: `packages/deploy/deploy-core/README.md`
- Modify: `AGENTS.md`

- [ ] **Step 7.1: Update module-skeleton README**

Append a new section to `packages/tooling/module-skeleton/README.md`:

```markdown
## Provisioner block

Modules can declare a `provisioner` block in their manifest to participate in
the deploy-time `provision` phase:

```jsonc
{
  "provisioner": {
    "entry": "./dist/provisioner.js",
    "produces": [
      { "name": "spaClient",  "kind": "single", "secret": false },
      { "name": "m2mClients", "kind": "many",   "secret": true  }
    ],
    "requires": [
      { "name": "auth0Mgmt", "schema": "auth0-mgmt-api-v1" }
    ],
    "timeoutMs": 60000
  }
}
```

- `entry` — relative path to the compiled provisioner module from the package
  root. Absolute paths and parent-traversal are rejected at discovery time
  (`BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY`).
- `produces[]` — declares the outputs the provisioner will return. `kind: 'single'`
  expects a single object value, `kind: 'many'` expects an array. `secret: true`
  routes the value into the encrypted output bucket; `secret: false` routes it
  into the plain-JSONB bucket. Mixed-secret-within-output is rejected.
- `requires[]` — declares the named credential blobs the provisioner needs. Each
  name maps 1:1 to a `targetSecrets[name]` entry on the deploy target; the
  `schema` is a registered identifier validated by the platform when secrets are
  written.
- `timeoutMs` — optional, default 60 000.

The runtime contract for the provisioner module itself is in
`@rntme/deploy-core` (`ProvisionerContract`).
```

- [ ] **Step 7.2: Update blueprint README**

In `packages/artifacts/blueprint/README.md`, find the §Modules section and add one paragraph:

```markdown
A `provisioner` block on the manifest is surfaced through `DiscoveredModule.manifest.provisioner`. Discovery validates that `entry` is a relative path inside the module package; absolute or parent-traversal entries fail with `BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY`.
```

- [ ] **Step 7.3: Update deploy-core README**

Append a new section to `packages/deploy/deploy-core/README.md`:

```markdown
## Provision phase

`runProvisioners(input)` runs each module's provisioner sequentially. It is invoked by the platform deploy executor between `plan` and `render` (five-phase pipeline). The function:

1. Iterates `modules[]` and skips entries without a `provisioner` block.
2. Asserts every `requires[].name` is present in `resolvedTargetSecrets`. Missing → `DEPLOY_PROVISION_TARGET_SECRET_MISSING`.
3. Calls `resolveProvisioner(packageName, entry)` (caller-supplied dynamic-import shim) to load the contract.
4. Awaits `contract.provision({ publicConfig, targetSecrets, priorOutputs?, log, signal })` with a per-module abort signal honoring `provisioner.timeoutMs`.
5. Validates the returned output against the declared `produces[]`: every name present, kind matches (`single` → object, `many` → array), `secret` flag matches the bucket the value lives in.
6. Returns aggregated `ProvisionedModule[]`. The platform persists these on `deployment.provisionResult` (public) and `deployment.provisionResultCiphertext` (secret).

The companion helper `resolveEnvMappings(modules, mapping)` projects provisioner outputs into env entries the renderer bakes into runtime resources.

Error codes live in `errors-provision.ts`. Vendor-side failures (e.g. an Auth0 5xx) are wrapped under `DEPLOY_PROVISION_VENDOR_FAILED` while preserving the vendor error message.
```

- [ ] **Step 7.4: Update AGENTS.md**

In `AGENTS.md` §3 (layering), find the `@rntme/deploy-core` paragraph and append:

```markdown
Provision-phase surface: `runProvisioners`, `ProvisionerContract`, `resolveEnvMappings`, `DEPLOY_PROVISION_ERROR_CODES`.
```

In §6 (task-indexed how-to), add a new entry:

```markdown
### How to add a provisioner to a module

1. Implement `provision(input): Promise<Result<ProvisionerOutput, ProvisionerVendorError>>` (and optional `tearDown`) in `<module>/src/provisioner.ts`. Import `ProvisionerContract` from `@rntme/deploy-core`.
2. Add a `provisioner` block to the module's `module.json`. Declare every output you return in `produces[]` (with `kind` and `secret`); declare every credential blob you read in `requires[]`.
3. Register the `requires[].schema` ids in `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts` if not already registered.
4. Export an `ENV_MAPPINGS` constant from the same file if your outputs need to land as env vars on rendered resources.
5. Add a unit test that runs `provision()` twice in a row and asserts the second call issues zero mutating upstream calls (idempotence).
6. The conformance test in `packages/deploy/deploy-core/test/conformance/provisioner-contract.test.ts` will pick up the new module automatically if it is wired in `modules/<category>/<vendor>/`.
```

- [ ] **Step 7.5: Commit**

```bash
git add packages/tooling/module-skeleton/README.md packages/artifacts/blueprint/README.md packages/deploy/deploy-core/README.md AGENTS.md
git commit -m "docs: cover provisioner block (module-skeleton, blueprint, deploy-core, AGENTS)"
```

---

## PR 2 — Persistence + executor + render + target-secret CRUD

### Task 8: Drizzle migration `0007_provisioner_columns.sql`

**Files:**
- Create: `packages/platform/platform-storage/drizzle/0007_provisioner_columns.sql`

- [ ] **Step 8.1: Author migration**

Create the SQL file:

```sql
ALTER TABLE "deployment" ADD COLUMN "provision_result" jsonb;
--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "provision_result_ciphertext" bytea;
--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "provision_result_nonce" bytea;
--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "provision_result_key_version" smallint;
--> statement-breakpoint
ALTER TABLE "deploy_target" ADD COLUMN "target_secrets_ciphertext" bytea;
--> statement-breakpoint
ALTER TABLE "deploy_target" ADD COLUMN "target_secrets_nonce" bytea;
--> statement-breakpoint
ALTER TABLE "deploy_target" ADD COLUMN "target_secrets_key_version" smallint;
```

- [ ] **Step 8.2: Verify migration applies**

Run: `pnpm -F @rntme/platform-storage exec drizzle-kit migrate` against a test DB if available, otherwise run the migration tests in step 9.

- [ ] **Step 8.3: Commit**

```bash
git add packages/platform/platform-storage/drizzle/0007_provisioner_columns.sql
git commit -m "feat(platform-storage): migration for provisioner result and target-secrets columns"
```

---

### Task 9: Update drizzle schemas to match the migration

**Files:**
- Modify: `packages/platform/platform-storage/src/schema/deployment.ts`
- Modify: `packages/platform/platform-storage/src/schema/deploy-target.ts`

- [ ] **Step 9.1: Extend deployment schema**

Edit `packages/platform/platform-storage/src/schema/deployment.ts`. Add `bytea` custom-type if not already present (copy the pattern from `deploy-target.ts`). Inside `pgTable('deployment', { ... })`, just before `queuedAt:`, add:

```ts
provisionResult: jsonb('provision_result').$type<DeploymentProvisionResult>(),
provisionResultCiphertext: bytea('provision_result_ciphertext'),
provisionResultNonce: bytea('provision_result_nonce'),
provisionResultKeyVersion: smallint('provision_result_key_version'),
```

Add the type at the top of the file:

```ts
export type DeploymentProvisionResultModule = {
  readonly publicOutputs: Record<string, unknown>;
  readonly provisionedAt: string;
};

export type DeploymentProvisionResult = {
  readonly modules: Record<string, DeploymentProvisionResultModule>;
  readonly startedAt: string;
  readonly finishedAt: string;
};
```

- [ ] **Step 9.2: Extend deploy-target schema**

Edit `packages/platform/platform-storage/src/schema/deploy-target.ts`. Inside the `pgTable` block, just before `eventBusConfig:`, add:

```ts
targetSecretsCiphertext: bytea('target_secrets_ciphertext'),
targetSecretsNonce: bytea('target_secrets_nonce'),
targetSecretsKeyVersion: smallint('target_secrets_key_version'),
```

- [ ] **Step 9.3: Build & typecheck**

```bash
pnpm -F @rntme/platform-storage run build && pnpm -F @rntme/platform-storage run typecheck
```

- [ ] **Step 9.4: Commit**

```bash
git add packages/platform/platform-storage/src/schema
git commit -m "feat(platform-storage): wire provisioner columns into drizzle schemas"
```

---

### Task 10: Target-secret schema registry

**Files:**
- Create: `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts`
- Create: `packages/platform/platform-core/src/use-cases/target-secrets/schemas.test.ts`
- Modify: `packages/platform/platform-core/src/index.ts`

- [ ] **Step 10.1: Write failing tests**

Create `packages/platform/platform-core/src/use-cases/target-secrets/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  TARGET_SECRET_SCHEMAS,
  parseTargetSecret,
  type TargetSecretSchemaId,
} from './schemas.js';

describe('TARGET_SECRET_SCHEMAS', () => {
  it('registers auth0-mgmt-api-v1', () => {
    expect(TARGET_SECRET_SCHEMAS).toHaveProperty('auth0-mgmt-api-v1');
  });

  it('parseTargetSecret returns Ok for valid auth0Mgmt payload', () => {
    const r = parseTargetSecret('auth0-mgmt-api-v1', {
      tenantDomain: 'demo.us.auth0.com',
      mgmtClientId: 'abc',
      mgmtClientSecret: 'xyz',
    });
    expect(r.ok).toBe(true);
  });

  it('parseTargetSecret returns Err for missing mgmtClientSecret', () => {
    const r = parseTargetSecret('auth0-mgmt-api-v1', {
      tenantDomain: 'demo.us.auth0.com',
      mgmtClientId: 'abc',
    });
    expect(r.ok).toBe(false);
  });

  it('parseTargetSecret returns Err for unknown schema id', () => {
    const r = parseTargetSecret('not-a-schema' as TargetSecretSchemaId, {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('TARGET_SECRET_SCHEMA_UNKNOWN');
    }
  });
});
```

- [ ] **Step 10.2: Run, verify failure**

Run: `pnpm -F @rntme/platform-core vitest run src/use-cases/target-secrets/schemas.test.ts`
Expected: file missing.

- [ ] **Step 10.3: Implement registry**

Create `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts`:

```ts
import { z } from 'zod';

export const TARGET_SECRET_SCHEMAS = {
  'auth0-mgmt-api-v1': z
    .object({
      tenantDomain: z.string().min(1),
      mgmtClientId: z.string().min(1),
      mgmtClientSecret: z.string().min(1),
    })
    .strict(),
} as const;

export type TargetSecretSchemaId = keyof typeof TARGET_SECRET_SCHEMAS;

export type TargetSecretParseError = {
  readonly code: 'TARGET_SECRET_SCHEMA_UNKNOWN' | 'TARGET_SECRET_VALIDATION_FAILED';
  readonly message: string;
  readonly path?: readonly (string | number)[];
};

export type TargetSecretParseResult =
  | { ok: true; value: unknown }
  | { ok: false; errors: TargetSecretParseError[] };

export function parseTargetSecret(schemaId: string, value: unknown): TargetSecretParseResult {
  const schema = (TARGET_SECRET_SCHEMAS as Record<string, z.ZodTypeAny | undefined>)[schemaId];
  if (!schema) {
    return {
      ok: false,
      errors: [{ code: 'TARGET_SECRET_SCHEMA_UNKNOWN', message: `unknown target-secret schema id "${schemaId}"` }],
    };
  }
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, value: r.data };
  return {
    ok: false,
    errors: r.error.issues.map((i) => ({
      code: 'TARGET_SECRET_VALIDATION_FAILED',
      message: i.message,
      path: i.path,
    })),
  };
}
```

- [ ] **Step 10.4: Re-export**

Add to `packages/platform/platform-core/src/index.ts`:

```ts
export {
  TARGET_SECRET_SCHEMAS,
  parseTargetSecret,
  type TargetSecretSchemaId,
  type TargetSecretParseError,
  type TargetSecretParseResult,
} from './use-cases/target-secrets/schemas.js';
```

- [ ] **Step 10.5: Run tests, build, commit**

```bash
pnpm -F @rntme/platform-core vitest run src/use-cases/target-secrets/schemas.test.ts
pnpm -F @rntme/platform-core run build && pnpm -F @rntme/platform-core run typecheck
git add packages/platform/platform-core
git commit -m "feat(platform-core): target-secret schema registry with auth0-mgmt-api-v1"
```

---

### Task 11: `pg-target-secrets-repo`

**Files:**
- Create: `packages/platform/platform-storage/src/repos/pg-target-secrets-repo.ts`
- Create: `packages/platform/platform-storage/test/repos/pg-target-secrets-repo.test.ts`
- Modify: `packages/platform/platform-storage/src/index.ts` (or wherever repos are re-exported — locate by `grep -n "pg-deploy-target-repo" packages/platform/platform-storage/src/index.ts`)
- Modify: `packages/platform/platform-core/src/types/...` to add a `TargetSecretsRepo` type if `DeployTargetRepo` is in a similar pattern (locate it by `grep -rln "DeployTargetRepo" packages/platform/platform-core/src/types/`)

- [ ] **Step 11.1: Define repo interface in platform-core**

Find the existing `DeployTargetRepo` interface (search: `grep -rln "interface DeployTargetRepo\|type DeployTargetRepo" packages/platform/platform-core/src/`). Beside it (same file), add:

```ts
export type TargetSecretRecord = {
  readonly name: string;
  readonly schema: string;
  readonly value: unknown;
};

export type TargetSecretSummary = {
  readonly name: string;
  readonly schema: string;
  readonly updatedAt: Date;
};

export interface TargetSecretsRepo {
  list(targetId: string): Promise<readonly TargetSecretSummary[]>;
  upsert(targetId: string, record: TargetSecretRecord, now: Date): Promise<void>;
  remove(targetId: string, name: string): Promise<void>;
  getAllDecrypted(targetId: string): Promise<Readonly<Record<string, unknown>>>;
}
```

Re-export from `packages/platform/platform-core/src/index.ts`.

- [ ] **Step 11.2: Write failing repo tests**

Create `packages/platform/platform-storage/test/repos/pg-target-secrets-repo.test.ts` mirroring the structure of one of the existing `test/repos/*` files (locate one with `ls packages/platform/platform-storage/test/`). Tests:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { createPgTargetSecretsRepo } from '../../src/repos/pg-target-secrets-repo.js';
import { withTestDb } from '../helpers/with-test-db.js';        // use the existing helper if present
import type { SecretCipher } from '@rntme/platform-core';

const fakeCipher: SecretCipher = {
  encrypt: (pt) => ({ ciphertext: Buffer.from(`enc:${pt}`), nonce: Buffer.from('n'), keyVersion: 1 }),
  decrypt: (s) => s.ciphertext.toString('utf8').replace(/^enc:/, ''),
};

describe('pg-target-secrets-repo', () => {
  it('upsert+list+getAllDecrypted roundtrip', async () => {
    await withTestDb(async ({ db, deployTargetId }) => {
      const repo = createPgTargetSecretsRepo({ db, cipher: fakeCipher });
      await repo.upsert(deployTargetId, {
        name: 'auth0Mgmt',
        schema: 'auth0-mgmt-api-v1',
        value: { tenantDomain: 'x.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b' },
      }, new Date('2026-05-03T00:00:00Z'));

      const summaries = await repo.list(deployTargetId);
      expect(summaries).toEqual([{ name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1', updatedAt: expect.any(Date) }]);

      const decrypted = await repo.getAllDecrypted(deployTargetId);
      expect(decrypted).toEqual({ auth0Mgmt: { tenantDomain: 'x.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b' } });
    });
  });

  it('remove deletes a single secret without affecting others', async () => {
    await withTestDb(async ({ db, deployTargetId }) => {
      const repo = createPgTargetSecretsRepo({ db, cipher: fakeCipher });
      await repo.upsert(deployTargetId, { name: 'a', schema: 'auth0-mgmt-api-v1', value: { x: 1 } }, new Date());
      await repo.upsert(deployTargetId, { name: 'b', schema: 'auth0-mgmt-api-v1', value: { x: 2 } }, new Date());
      await repo.remove(deployTargetId, 'a');
      const summaries = await repo.list(deployTargetId);
      expect(summaries.map((s) => s.name)).toEqual(['b']);
    });
  });

  it('list returns [] for a target with no secrets configured', async () => {
    await withTestDb(async ({ db, deployTargetId }) => {
      const repo = createPgTargetSecretsRepo({ db, cipher: fakeCipher });
      expect(await repo.list(deployTargetId)).toEqual([]);
    });
  });
});
```

If `withTestDb` does not exist, follow the harness pattern from another repo test file.

- [ ] **Step 11.3: Run tests, verify failures**

Run: `pnpm -F @rntme/platform-storage vitest run test/repos/pg-target-secrets-repo.test.ts`
Expected: file missing.

- [ ] **Step 11.4: Implement repo**

Create `packages/platform/platform-storage/src/repos/pg-target-secrets-repo.ts`. The encrypted blob is a single JSON map keyed by secret-name; we store the whole map in the existing `target_secrets_*` columns and rewrite on upsert/remove. This avoids per-secret rows for v1.

```ts
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SecretCipher, TargetSecretRecord, TargetSecretSummary, TargetSecretsRepo } from '@rntme/platform-core';
import { deployTarget } from '../schema/deploy-target.js';

type StoredEnvelope = {
  secrets: Record<string, { schema: string; value: unknown; updatedAt: string }>;
};

export function createPgTargetSecretsRepo(deps: {
  db: NodePgDatabase<Record<string, unknown>>;
  cipher: SecretCipher;
}): TargetSecretsRepo {
  return {
    async list(targetId) {
      const env = await loadEnvelope(deps, targetId);
      return Object.entries(env.secrets).map(([name, e]) => ({
        name,
        schema: e.schema,
        updatedAt: new Date(e.updatedAt),
      }));
    },
    async upsert(targetId, record, now) {
      const env = await loadEnvelope(deps, targetId);
      env.secrets[record.name] = {
        schema: record.schema,
        value: record.value,
        updatedAt: now.toISOString(),
      };
      await writeEnvelope(deps, targetId, env);
    },
    async remove(targetId, name) {
      const env = await loadEnvelope(deps, targetId);
      delete env.secrets[name];
      await writeEnvelope(deps, targetId, env);
    },
    async getAllDecrypted(targetId) {
      const env = await loadEnvelope(deps, targetId);
      const out: Record<string, unknown> = {};
      for (const [name, entry] of Object.entries(env.secrets)) {
        out[name] = entry.value;
      }
      return out;
    },
  };
}

async function loadEnvelope(
  deps: { db: NodePgDatabase<Record<string, unknown>>; cipher: SecretCipher },
  targetId: string,
): Promise<StoredEnvelope> {
  const rows = await deps.db
    .select({
      ct: deployTarget.targetSecretsCiphertext,
      nonce: deployTarget.targetSecretsNonce,
      kv: deployTarget.targetSecretsKeyVersion,
    })
    .from(deployTarget)
    .where(eq(deployTarget.id, targetId));
  const row = rows[0];
  if (!row || !row.ct || !row.nonce || row.kv === null) {
    return { secrets: {} };
  }
  const plaintext = deps.cipher.decrypt({ ciphertext: row.ct, nonce: row.nonce, keyVersion: row.kv });
  return JSON.parse(plaintext) as StoredEnvelope;
}

async function writeEnvelope(
  deps: { db: NodePgDatabase<Record<string, unknown>>; cipher: SecretCipher },
  targetId: string,
  env: StoredEnvelope,
): Promise<void> {
  const enc = deps.cipher.encrypt(JSON.stringify(env));
  await deps.db
    .update(deployTarget)
    .set({
      targetSecretsCiphertext: enc.ciphertext,
      targetSecretsNonce: enc.nonce,
      targetSecretsKeyVersion: enc.keyVersion,
    })
    .where(eq(deployTarget.id, targetId));
}
```

- [ ] **Step 11.5: Re-export from platform-storage index**

Add to `packages/platform/platform-storage/src/index.ts`:

```ts
export { createPgTargetSecretsRepo } from './repos/pg-target-secrets-repo.js';
```

- [ ] **Step 11.6: Run, build, commit**

```bash
pnpm -F @rntme/platform-storage vitest run test/repos/pg-target-secrets-repo.test.ts
pnpm -F @rntme/platform-storage run build && pnpm -F @rntme/platform-storage run typecheck
git add packages/platform/platform-core packages/platform/platform-storage
git commit -m "feat(platform-storage): add pg-target-secrets-repo"
```

---

### Task 12: HTTP routes for target-secret CRUD

**Files:**
- Create: `apps/platform-http/src/routes/target-secrets.ts`
- Create: `apps/platform-http/test/unit/routes/target-secrets.test.ts`
- Modify: `apps/platform-http/src/server.ts` (mount the route)

- [ ] **Step 12.1: Write failing tests**

Create `apps/platform-http/test/unit/routes/target-secrets.test.ts`. Mirror the harness pattern from `apps/platform-http/test/unit/routes/*.test.ts` (locate one with `ls apps/platform-http/test/unit/routes/`):

```ts
import { describe, expect, it } from 'vitest';
import { buildAppForTests } from '../../helpers/build-app.js';

describe('target-secrets routes', () => {
  it('PUT /:secretName validates against the registered schema', async () => {
    const app = await buildAppForTests({ withDeployTarget: true });
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/orgs/test-organization/deploy-targets/notes-demo/secrets/auth0Mgmt',
      headers: { authorization: `Bearer ${app.testToken}` },
      payload: { schema: 'auth0-mgmt-api-v1', value: { tenantDomain: 'x', mgmtClientId: 'a', mgmtClientSecret: 'b' } },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' });
  });

  it('PUT rejects body that does not match schema', async () => {
    const app = await buildAppForTests({ withDeployTarget: true });
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/orgs/test-organization/deploy-targets/notes-demo/secrets/auth0Mgmt',
      headers: { authorization: `Bearer ${app.testToken}` },
      payload: { schema: 'auth0-mgmt-api-v1', value: { tenantDomain: 'x' } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PUT rejects unknown schema id', async () => {
    const app = await buildAppForTests({ withDeployTarget: true });
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/orgs/test-organization/deploy-targets/notes-demo/secrets/foo',
      headers: { authorization: `Bearer ${app.testToken}` },
      payload: { schema: 'unknown', value: {} },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET returns names+schema, never values', async () => {
    const app = await buildAppForTests({ withDeployTarget: true });
    await app.inject({
      method: 'PUT',
      url: '/v1/orgs/test-organization/deploy-targets/notes-demo/secrets/auth0Mgmt',
      headers: { authorization: `Bearer ${app.testToken}` },
      payload: { schema: 'auth0-mgmt-api-v1', value: { tenantDomain: 'x', mgmtClientId: 'a', mgmtClientSecret: 'b' } },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/orgs/test-organization/deploy-targets/notes-demo/secrets',
      headers: { authorization: `Bearer ${app.testToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as { secrets: Array<{ name: string; schema: string; value?: unknown; updatedAt: string }> };
    expect(body.secrets[0]?.name).toBe('auth0Mgmt');
    expect(body.secrets[0]).not.toHaveProperty('value');
  });

  it('DELETE removes a secret', async () => {
    const app = await buildAppForTests({ withDeployTarget: true });
    await app.inject({
      method: 'PUT',
      url: '/v1/orgs/test-organization/deploy-targets/notes-demo/secrets/auth0Mgmt',
      headers: { authorization: `Bearer ${app.testToken}` },
      payload: { schema: 'auth0-mgmt-api-v1', value: { tenantDomain: 'x', mgmtClientId: 'a', mgmtClientSecret: 'b' } },
    });
    const del = await app.inject({
      method: 'DELETE',
      url: '/v1/orgs/test-organization/deploy-targets/notes-demo/secrets/auth0Mgmt',
      headers: { authorization: `Bearer ${app.testToken}` },
    });
    expect(del.statusCode).toBe(204);
    const get = await app.inject({
      method: 'GET',
      url: '/v1/orgs/test-organization/deploy-targets/notes-demo/secrets',
      headers: { authorization: `Bearer ${app.testToken}` },
    });
    expect(JSON.parse(get.payload).secrets).toEqual([]);
  });
});
```

If `buildAppForTests` lacks a `withDeployTarget` option, extend it; the existing helper file lives in `apps/platform-http/test/helpers/`.

- [ ] **Step 12.2: Implement route module**

Create `apps/platform-http/src/routes/target-secrets.ts`. Follow the patterns in adjacent route files (`apps/platform-http/src/routes/deploy-targets.ts`):

```ts
import type { FastifyInstance } from 'fastify';
import { parseTargetSecret } from '@rntme/platform-core';
import type { TargetSecretsRepo } from '@rntme/platform-core';

export type TargetSecretRouteDeps = {
  readonly secretsRepoFor: (orgId: string) => Promise<TargetSecretsRepo>;
  readonly resolveTarget: (orgSlug: string, targetSlug: string) => Promise<{ id: string; orgId: string }>;
  readonly requireAuth: (req: unknown) => Promise<{ orgId: string }>;
  readonly clock: () => Date;
};

export async function registerTargetSecretsRoutes(app: FastifyInstance, deps: TargetSecretRouteDeps): Promise<void> {
  app.put('/v1/orgs/:orgSlug/deploy-targets/:targetSlug/secrets/:secretName', async (req, reply) => {
    const { orgSlug, targetSlug, secretName } = req.params as { orgSlug: string; targetSlug: string; secretName: string };
    const body = req.body as { schema?: string; value?: unknown };
    if (typeof body?.schema !== 'string') return reply.code(400).send({ code: 'TARGET_SECRET_SCHEMA_REQUIRED' });

    const parsed = parseTargetSecret(body.schema, body.value);
    if (!parsed.ok) {
      return reply.code(400).send({ code: parsed.errors[0]?.code ?? 'TARGET_SECRET_VALIDATION_FAILED', errors: parsed.errors });
    }
    const target = await deps.resolveTarget(orgSlug, targetSlug);
    const repo = await deps.secretsRepoFor(target.orgId);
    await repo.upsert(target.id, { name: secretName, schema: body.schema, value: parsed.value }, deps.clock());
    return reply.code(200).send({ name: secretName, schema: body.schema });
  });

  app.delete('/v1/orgs/:orgSlug/deploy-targets/:targetSlug/secrets/:secretName', async (req, reply) => {
    const { orgSlug, targetSlug, secretName } = req.params as { orgSlug: string; targetSlug: string; secretName: string };
    const target = await deps.resolveTarget(orgSlug, targetSlug);
    const repo = await deps.secretsRepoFor(target.orgId);
    await repo.remove(target.id, secretName);
    return reply.code(204).send();
  });

  app.get('/v1/orgs/:orgSlug/deploy-targets/:targetSlug/secrets', async (req, reply) => {
    const { orgSlug, targetSlug } = req.params as { orgSlug: string; targetSlug: string };
    const target = await deps.resolveTarget(orgSlug, targetSlug);
    const repo = await deps.secretsRepoFor(target.orgId);
    const list = await repo.list(target.id);
    return reply.code(200).send({
      secrets: list.map((s) => ({ name: s.name, schema: s.schema, updatedAt: s.updatedAt.toISOString() })),
    });
  });
}
```

Adapt the auth/middleware wiring to whatever `apps/platform-http/src/routes/deploy-targets.ts` uses (the snippet above is intentionally minimal and uses bare `req.params`/`req.body` — match the project's typed-request convention if it differs).

- [ ] **Step 12.3: Mount in server.ts**

Edit `apps/platform-http/src/server.ts`. Find where `registerDeployTargetsRoutes` (or similar) is called and add:

```ts
await registerTargetSecretsRoutes(app, {
  secretsRepoFor: async (orgId) => deps.repoFactories.targetSecretsFor(orgId),
  resolveTarget: deps.resolveDeployTarget,
  requireAuth: deps.requireAuth,
  clock: deps.clock,
});
```

You will likely need to:
- Add a `targetSecretsFor` factory in the `repoFactories` shape (mirroring the existing factories, wired to a `secretCipher` from `platform-core`).
- Re-export `createPgTargetSecretsRepo` through wherever the platform-http boot wires its repos.

- [ ] **Step 12.4: Run, build, commit**

```bash
pnpm -F @rntme/platform-http vitest run test/unit/routes/target-secrets.test.ts
pnpm -F @rntme/platform-http run build && pnpm -F @rntme/platform-http run typecheck
git add apps/platform-http
git commit -m "feat(platform-http): target-secrets CRUD routes"
```

---

### Task 13: Extend log redactor

**Files:**
- Modify: `apps/platform-http/src/deploy/log-redactor.ts`
- Test: `apps/platform-http/test/unit/deploy/log-redactor.test.ts`

- [ ] **Step 13.1: Write failing tests**

Locate the existing redactor test file (or create one). Add cases:

```ts
import { describe, expect, it } from 'vitest';
import { redact } from '../../../src/deploy/log-redactor.js';

describe('redact — provisioner extensions', () => {
  it('redacts mgmt_client_secret in JSON-shaped strings', () => {
    expect(redact('{"mgmt_client_secret":"abc123"}')).not.toContain('abc123');
  });

  it('redacts mgmtClientSecret camelCase', () => {
    expect(redact('{"mgmtClientSecret":"abc123"}')).not.toContain('abc123');
  });

  it('redacts m2mClients[*].clientSecret embedded values', () => {
    const out = redact('m2mClients=[{"clientSecret":"shh"}]');
    expect(out).not.toContain('shh');
  });

  it('redacts targetSecrets envelope payload values', () => {
    const out = redact('"targetSecrets":{"auth0Mgmt":{"mgmtClientSecret":"v"}}');
    expect(out).not.toContain('"v"');
  });
});
```

- [ ] **Step 13.2: Run, verify failure**

Run: `pnpm -F @rntme/platform-http vitest run test/unit/deploy/log-redactor.test.ts`
Expected: red on the new cases.

- [ ] **Step 13.3: Extend regex set**

Edit `apps/platform-http/src/deploy/log-redactor.ts`. Replace `SECRET_KEY` constant:

```ts
const SECRET_KEY =
  String.raw`(?:apiToken|api[-_]?key|x-api-key|clientSecret|client_secret|mgmtClientSecret|mgmt_client_secret|m2m_client_secret|m2mClientSecret|accessToken|access_token|refreshToken|refresh_token|password|token|secret)`;
```

Then add a final pass for any value beneath a key whose name contains `secretOutputs`, `targetSecrets`, or `mgmtClientSecret`:

```ts
const STRUCTURAL_REDACTION_PATTERNS: readonly { pattern: RegExp; replace: string }[] = [
  {
    pattern: /("(?:secretOutputs|targetSecrets|mgmtClientSecret|m2mClients)"\s*:\s*)([^,}\]]+)/g,
    replace: '$1"***"',
  },
];

const ALL_PATTERNS = [...REDACTION_PATTERNS, ...STRUCTURAL_REDACTION_PATTERNS];

export function redact(input: string): string {
  let output = input;
  for (const { pattern, replace } of ALL_PATTERNS) {
    output = output.replace(pattern, replace);
  }
  return output;
}
```

- [ ] **Step 13.4: Run, verify pass**

Run: `pnpm -F @rntme/platform-http vitest run test/unit/deploy/log-redactor.test.ts`
Expected: green.

- [ ] **Step 13.5: Commit**

```bash
git add apps/platform-http/src/deploy/log-redactor.ts apps/platform-http/test/unit/deploy/log-redactor.test.ts
git commit -m "feat(platform-http): extend log redactor for provisioner secrets"
```

---

### Task 14: Wire `provision` stage into executor

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Test: extend `apps/platform-http/test/integration/deploy-executor.test.ts`

- [ ] **Step 14.1: Write failing integration tests**

Append to `apps/platform-http/test/integration/deploy-executor.test.ts`:

```ts
describe('executor — provision phase', () => {
  it('runs plan→provision→render→apply→verify in order', async () => {
    const calls: string[] = [];
    const harness = await buildExecutorHarness({
      planProject: async (...args) => { calls.push('plan'); return realPlan(...args); },
      runProvisioners: async () => { calls.push('provision'); return ok({ modules: [] }); },
      renderPlan: async (...args) => { calls.push('render'); return realRender(...args); },
      applyPlan: async (...args) => { calls.push('apply'); return realApply(...args); },
      smokeVerify: async () => { calls.push('verify'); return { ok: true, warnings: [] }; },
    });
    await harness.runDeployment();
    expect(calls).toEqual(['plan', 'provision', 'render', 'apply', 'verify']);
  });

  it('skips provision phase when no module declares a provisioner block', async () => {
    const harness = await buildExecutorHarness({ blueprintWithoutProvisioner: true });
    const result = await harness.runDeployment();
    expect(result.status).toBe('succeeded');
    expect(harness.logs.find((l) => l.step === 'provision')).toBeUndefined();
  });

  it('fails the deployment when provision returns Err and does not call apply', async () => {
    let appliedCalled = false;
    const harness = await buildExecutorHarness({
      runProvisioners: async () => err([{ code: 'DEPLOY_PROVISION_VENDOR_FAILED', message: 'auth0 said no', module: '@rntme/identity-auth0' }]),
      applyPlan: async () => { appliedCalled = true; throw new Error('should not be called'); },
    });
    const result = await harness.runDeployment();
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('DEPLOY_PROVISION_VENDOR_FAILED');
    expect(appliedCalled).toBe(false);
  });

  it('persists provisionResult on the deployment row when provision succeeds', async () => {
    const harness = await buildExecutorHarness({
      runProvisioners: async () => ok({
        modules: [{
          projectKey: 'identity-auth0',
          packageName: '@rntme/identity-auth0',
          publicOutputs: { spaClient: { id: 'cid' } },
          secretOutputs: {},
          provisionedAt: '2026-05-03T00:00:00Z',
        }],
      }),
    });
    await harness.runDeployment();
    const row = await harness.fetchDeploymentRow();
    expect(row.provision_result).toMatchObject({
      modules: { 'identity-auth0': { publicOutputs: { spaClient: { id: 'cid' } } } },
    });
  });
});
```

`buildExecutorHarness` is the existing test harness — extend it as needed to inject `runProvisioners`.

- [ ] **Step 14.2: Run, verify failure**

Run: `pnpm -F @rntme/platform-http vitest run test/integration/deploy-executor.test.ts`
Expected: red.

- [ ] **Step 14.3: Wire executor**

Edit `apps/platform-http/src/deploy/executor.ts`. After `const plan = await runStage('plan', ...)` and its error handling, insert:

```ts
    const provModules = collectProvisionerModules(composed.value);
    let provisioned: ReadonlyMap<string, ProvisionedModule> = new Map();
    let provisionResultForPersistence: DeploymentProvisionResult | undefined;

    if (provModules.length > 0) {
      await appendLog(deps, deploymentId, orgId, 'info', 'provision', 'Resolving target secrets');
      const targetSecretsRepo = await deps.targetSecretsRepoFor(orgId);
      const decrypted = await targetSecretsRepo.getAllDecrypted(target.id);

      const priorOutputs = await deps.lastSuccessfulProvisionOutputs(deploymentId);

      await appendLog(deps, deploymentId, orgId, 'info', 'provision', `Provisioning ${provModules.length} module(s)`);
      const startedAt = new Date().toISOString();
      const result = await runStage(
        'provision',
        async () =>
          (deps.runProvisioners ?? runProvisioners)({
            modules: provModules.map((m) => ({
              ...m,
              priorOutputs: priorOutputs[m.projectKey],
            })),
            resolvedTargetSecrets: decrypted,
            resolveProvisioner: deps.resolveProvisioner,
            log: (e) => void appendLog(deps, deploymentId, orgId, e.level, e.step, redact(e.message)),
          }),
        { log },
      );
      if (!result.ok) {
        await finalize(deps, deploymentId, orgId, 'failed', {
          errorCode: result.errors[0]?.code ?? 'DEPLOY_PROVISION_UNKNOWN',
          errorMessage: redact(errorSummary(result.errors)),
        });
        return;
      }
      const finishedAt = new Date().toISOString();

      const map = new Map<string, ProvisionedModule>();
      const persistence: DeploymentProvisionResult = { modules: {}, startedAt, finishedAt };
      const secretEnvelope: { modules: Record<string, { secretOutputs: Record<string, unknown>; provisionedAt: string }> } = { modules: {} };
      for (const m of result.value.modules) {
        map.set(m.projectKey, m);
        persistence.modules[m.projectKey] = { publicOutputs: m.publicOutputs, provisionedAt: m.provisionedAt };
        if (Object.keys(m.secretOutputs).length > 0) {
          secretEnvelope.modules[m.projectKey] = { secretOutputs: m.secretOutputs, provisionedAt: m.provisionedAt };
        }
      }
      provisioned = map;
      provisionResultForPersistence = persistence;

      const enc = Object.keys(secretEnvelope.modules).length > 0 ? deps.secretCipher.encrypt(JSON.stringify(secretEnvelope)) : null;

      await deps.withOrgTx(orgId, (repos) =>
        repos.deployments.setProvisionResult(deploymentId, persistence, enc),
      );
    }
```

Update the render call:

```ts
const rendered = await runStage('render', async () => (deps.renderPlan ?? renderDokployPlan)(
  plan.value as ProjectDeploymentPlan,
  buildDokployTargetConfig(redactedTarget, ctx.configOverrides, { ... }),
  provisioned,
), { log });
```

(`renderDokployPlan` will be updated in Task 15 to accept the third argument.)

Add helper at the bottom of the file:

```ts
function collectProvisionerModules(composed: ComposedProjectInput | ComposedBlueprint): DiscoveredProvisionerModule[] {
  const mods = (composed as ComposedBlueprint).modules ?? {};
  const out: DiscoveredProvisionerModule[] = [];
  for (const [projectKey, info] of Object.entries(mods)) {
    if (!info.manifest?.provisioner) continue;
    out.push({
      projectKey,
      packageName: info.manifest.name,
      manifest: info.manifest,
      publicConfig: info.publicConfig ?? {},
    });
  }
  return out;
}
```

Extend `ExecutorDeps`:

```ts
readonly runProvisioners?: typeof runProvisioners;
readonly resolveProvisioner: (packageName: string, entry: string) => Promise<ProvisionerContract>;
readonly targetSecretsRepoFor: (orgId: string) => Promise<TargetSecretsRepo>;
readonly secretCipher: SecretCipher;
readonly lastSuccessfulProvisionOutputs: (deploymentId: string) => Promise<Record<string, ProvisionerOutput>>;
```

Boot wiring in `server.ts` supplies `resolveProvisioner` as the dynamic-import shim:

```ts
resolveProvisioner: async (packageName, entry) => {
  const pkg = await import(`${packageName}/${entry.replace(/^\.\//, '')}`);
  return { provision: pkg.provision, tearDown: pkg.tearDown };
},
```

- [ ] **Step 14.4: Add `setProvisionResult` to deployment repo**

Edit `packages/platform/platform-storage/src/repos/pg-deployment-repo.ts`. Add a method:

```ts
async setProvisionResult(deploymentId, result, encrypted) {
  await db
    .update(deployment)
    .set({
      provisionResult: result,
      provisionResultCiphertext: encrypted?.ciphertext ?? null,
      provisionResultNonce: encrypted?.nonce ?? null,
      provisionResultKeyVersion: encrypted?.keyVersion ?? null,
    })
    .where(eq(deployment.id, deploymentId));
}
```

Add the matching method signature to `DeploymentRepo` in `platform-core`.

Add a `getLastSuccessfulProvisionResult(projectId, targetId)` query that decrypts the secret envelope, used by the executor to populate `priorOutputs`.

- [ ] **Step 14.5: Run integration tests, verify pass**

Run: `pnpm -F @rntme/platform-http vitest run test/integration/deploy-executor.test.ts`
Expected: green.

- [ ] **Step 14.6: Commit**

```bash
pnpm -F @rntme/platform-http run build && pnpm -F @rntme/platform-http run typecheck
git add apps/platform-http packages/platform/platform-storage packages/platform/platform-core
git commit -m "feat(platform-http): wire provision phase into deploy executor"
```

---

### Task 15: Render integration with provisioner outputs

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Test: extend `packages/deploy/deploy-dokploy/test/unit/render.test.ts`

- [ ] **Step 15.1: Write failing tests**

Append to `packages/deploy/deploy-dokploy/test/unit/render.test.ts`:

```ts
describe('renderDokployPlan — provisioner outputs', () => {
  const baseProvisioned = new Map([
    [
      'identity-auth0',
      {
        projectKey: 'identity-auth0',
        packageName: '@rntme/identity-auth0',
        publicOutputs: { spaClient: { id: 'cid_xyz', name: 'app' } },
        secretOutputs: { m2mClients: [{ name: 'introspect', clientId: 'mid', clientSecret: 'sss' }] },
        provisionedAt: '2026-05-03T00:00:00Z',
      },
    ],
  ]);

  it('bakes a public output into env on the target resource', () => {
    const rendered = renderDokployPlan(samplePlan(), sampleConfig(), baseProvisioned, {
      'identity-auth0': [
        { from: 'spaClient.id', envName: 'AUTH0_SPA_CLIENT_ID', secret: false, target: 'app' },
      ],
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const appResource = rendered.value.resources.find((r) => r.workloadSlug === 'app');
    expect(appResource?.env).toContainEqual({ key: 'AUTH0_SPA_CLIENT_ID', value: 'cid_xyz', secret: false });
  });

  it('bakes a secret output as secret env on the target resource', () => {
    const rendered = renderDokployPlan(samplePlan(), sampleConfig(), baseProvisioned, {
      'identity-auth0': [
        { from: 'm2mClients.*.clientSecret', envName: 'AUTH0_M2M_${name}_CLIENT_SECRET', secret: true, target: 'identity-auth0' },
      ],
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const idResource = rendered.value.resources.find((r) => r.workloadSlug === 'identity-auth0');
    expect(idResource?.env).toContainEqual({ key: 'AUTH0_M2M_INTROSPECT_CLIENT_SECRET', value: 'sss', secret: true });
  });

  it('digest changes when a provisioned value changes', () => {
    const a = renderDokployPlan(samplePlan(), sampleConfig(), baseProvisioned, {
      'identity-auth0': [{ from: 'spaClient.id', envName: 'AUTH0_SPA_CLIENT_ID', secret: false, target: 'app' }],
    });
    const otherProvisioned = new Map([
      [
        'identity-auth0',
        { ...baseProvisioned.get('identity-auth0')!, publicOutputs: { spaClient: { id: 'changed', name: 'app' } } },
      ],
    ]);
    const b = renderDokployPlan(samplePlan(), sampleConfig(), otherProvisioned, {
      'identity-auth0': [{ from: 'spaClient.id', envName: 'AUTH0_SPA_CLIENT_ID', secret: false, target: 'app' }],
    });
    if (!a.ok || !b.ok) throw new Error('renders did not succeed');
    expect(a.value.digest).not.toBe(b.value.digest);
  });

  it('skips mapping for modules absent from the provisioned map', () => {
    const rendered = renderDokployPlan(samplePlan(), sampleConfig(), new Map(), {
      'identity-auth0': [{ from: 'spaClient.id', envName: 'X', secret: false, target: 'app' }],
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const appResource = rendered.value.resources.find((r) => r.workloadSlug === 'app');
    expect(appResource?.env.find((e) => e.key === 'X')).toBeUndefined();
  });
});
```

- [ ] **Step 15.2: Update `renderDokployPlan` signature**

Edit `packages/deploy/deploy-dokploy/src/render.ts`. Change the function signature to accept the new arguments:

```ts
import { resolveEnvMappings, type ProvisionerEnvMapping, type ProvisionedModule } from '@rntme/deploy-core';

export function renderDokployPlan(
  plan: ProjectDeploymentPlan,
  targetConfig: DokployTargetConfig,
  provisionedModules: ReadonlyMap<string, ProvisionedModule> = new Map(),
  envMappings: ProvisionerEnvMapping = {},
): Result<RenderedDokployPlan, DeploymentRenderError> {
  // ... existing code ...

  const envEntries = resolveEnvMappings(provisionedModules, envMappings);
  for (const e of envEntries) {
    const resource = resources.find((r) => r.workloadSlug === e.target);
    if (!resource) continue;
    resource.env.push({ key: e.envName, value: e.value, secret: e.secret });
  }

  // include envEntries in the digest input so render is deterministic over outputs
  const digestInput = JSON.stringify({ ...existingDigestInput, envEntries });
  const digest = sha256Hex(digestInput);

  // ... return ok({ resources, digest, ... }) ...
}
```

The exact integration depends on the existing `render.ts` shape. Read the file first, identify the digest computation, and ensure `envEntries` participates.

- [ ] **Step 15.3: Run, verify pass**

Run: `pnpm -F @rntme/deploy-dokploy vitest run test/unit/render.test.ts`
Expected: green.

- [ ] **Step 15.4: Build, commit**

```bash
pnpm -F @rntme/deploy-dokploy run build && pnpm -F @rntme/deploy-dokploy run typecheck
git add packages/deploy/deploy-dokploy
git commit -m "feat(deploy-dokploy): bake provisioner outputs into rendered env"
```

---

### Task 16: Pass `envMappings` through the executor to render

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`

- [ ] **Step 16.1: Resolve env mappings per discovered provisioner module**

Edit `apps/platform-http/src/deploy/executor.ts`. After `provModules` is computed, add:

```ts
const envMappings: ProvisionerEnvMapping = {};
for (const m of provModules) {
  try {
    const moduleExports = await import(m.packageName);
    if (moduleExports.ENV_MAPPINGS && typeof moduleExports.ENV_MAPPINGS === 'object') {
      const local = moduleExports.ENV_MAPPINGS as ProvisionerEnvMapping;
      for (const k of Object.keys(local)) {
        envMappings[k] = local[k]!;
      }
    }
  } catch {
    // Module without ENV_MAPPINGS export is allowed (no env baking required).
  }
}
```

Pass `envMappings` to `renderDokployPlan`.

- [ ] **Step 16.2: Build, commit**

```bash
pnpm -F @rntme/platform-http run build && pnpm -F @rntme/platform-http run typecheck
git add apps/platform-http/src/deploy/executor.ts
git commit -m "feat(platform-http): forward module ENV_MAPPINGS into render"
```

---

### Task 17: PR-2 doc-touch

**Files:**
- Modify: `apps/platform-http/README.md`
- Modify: `packages/deploy/deploy-dokploy/README.md`
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `docs/architecture.md`

- [ ] **Step 17.1: platform-http README**

In the §Deploy executor / §Phases section, replace the four-phase description with five (`plan → provision → render → apply → verify`) and document the new target-secrets routes (`PUT/DELETE/GET …/secrets/:name`).

- [ ] **Step 17.2: deploy-dokploy README**

Add one paragraph: render now accepts `provisionedModules` and `envMappings` and bakes provisioner outputs into resource env entries; the digest covers them.

- [ ] **Step 17.3: CLAUDE.md §Architecture-in-one-paragraph**

Insert one sentence into the existing paragraph (near the deploy-pipeline mention):

```markdown
The deploy pipeline runs `plan → provision → render → apply → verify`; modules can declare a `provisioner` block in `module.json` to reconcile external state (Auth0 clients, third-party API resources) and feed env vars into render via `provisionResult`/`provisionResultCiphertext`.
```

- [ ] **Step 17.4: AGENTS.md §6 second how-to**

Add:

```markdown
### How to add a target-secret schema

1. Add a zod schema entry to `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts` with a stable, versioned id (e.g. `stripe-restricted-key-v1`).
2. Reference the id in any module manifest's `provisioner.requires[].schema`.
3. Operators write the secret via `PUT /v1/orgs/:org/deploy-targets/:slug/secrets/:name` with `{ schema, value }` body. The platform validates `value` against the registered schema; `value` is never returned by GET.
```

§10 glossary additions:

```markdown
- **provisioner** — module-side code that reconciles external state during deploy. Declares `produces[]` (outputs) and `requires[]` (target-secret credentials) in `module.json`.
- **provisioner outputs** — values returned by `provision()`. Public outputs persist as JSONB on `deployment.provisionResult`; secret outputs persist as encrypted ciphertext on `deployment.provisionResultCiphertext`.
- **target secret** — encrypted credential blob on `deploy_target`, keyed by name (e.g. `auth0Mgmt`), validated against a registered schema id (e.g. `auth0-mgmt-api-v1`).
- **schema id** — versioned identifier for a target-secret shape, registered in `target-secrets/schemas.ts`.
```

- [ ] **Step 17.5: docs/architecture.md**

Add one sentence in the deploy-pipeline section: provisioner phase added between plan and render.

- [ ] **Step 17.6: Commit**

```bash
git add CLAUDE.md AGENTS.md docs/architecture.md apps/platform-http/README.md packages/deploy/deploy-dokploy/README.md
git commit -m "docs: PR-2 doc-touch for provisioner pipeline integration"
```

---

## PR 3 — Auth0 concrete provisioner + tear-down hook

### Task 18: Auth0 mgmt-client.ts (fetch wrapper)

**Files:**
- Create: `modules/identity/auth0/src/mgmt-client.ts`
- Test: `modules/identity/auth0/test/unit/mgmt-client.test.ts`

- [ ] **Step 18.1: Write failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createMgmtClient } from '../../src/mgmt-client.js';

describe('Auth0 mgmt-client', () => {
  it('fetches an access token before the first call', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/oauth/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    });
    const c = createMgmtClient({ tenantDomain: 'x.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b', fetch: fetcher });
    await c.findClientByName('foo');
    expect(fetcher.mock.calls.some((c) => String(c[0]).endsWith('/oauth/token'))).toBe(true);
  });

  it('returns 404 from delete as success', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/oauth/token')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      return new Response('', { status: 404 });
    });
    const c = createMgmtClient({ tenantDomain: 'x.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b', fetch: fetcher });
    const r = await c.deleteClient('cid');
    expect(r.ok).toBe(true);
  });

  it('retries 429 up to 3 times then fails', async () => {
    let calls = 0;
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/oauth/token')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      calls++;
      return new Response('rate limited', { status: 429 });
    });
    const c = createMgmtClient({ tenantDomain: 'x.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b', fetch: fetcher, retryDelayMs: 1 });
    const r = await c.findClientByName('foo');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('AUTH0_RATE_LIMITED');
    expect(calls).toBe(3);
  });

  it('maps 401 from token endpoint to AUTH0_UNAUTHORIZED', async () => {
    const fetcher = vi.fn(async () => new Response('{"error":"invalid_client"}', { status: 401 }));
    const c = createMgmtClient({ tenantDomain: 'x.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b', fetch: fetcher });
    const r = await c.findClientByName('foo');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('AUTH0_UNAUTHORIZED');
  });
});
```

- [ ] **Step 18.2: Implement client**

Create `modules/identity/auth0/src/mgmt-client.ts`:

```ts
import type { Result } from './result-shim.js';
import { err, ok } from './result-shim.js';

export type MgmtError = { code: string; message: string };

export type Auth0Client = {
  client_id: string;
  name: string;
  app_type?: string;
  token_endpoint_auth_method?: string;
  client_secret?: string;
  grant_types?: string[];
  callbacks?: string[];
  web_origins?: string[];
  allowed_origins?: string[];
  allowed_logout_urls?: string[];
  organization_usage?: 'allow' | 'deny';
};

export type Auth0ResourceServer = {
  id: string;
  identifier: string;
  name?: string;
  signing_alg?: string;
  token_dialect?: string;
  enforce_policies?: boolean;
};

export type Auth0Connection = {
  id: string;
  name: string;
  enabled_clients?: string[];
};

export type Auth0ClientGrant = {
  id: string;
  client_id: string;
  audience: string;
  scope?: string[];
};

export type MgmtClientConfig = {
  tenantDomain: string;
  mgmtClientId: string;
  mgmtClientSecret: string;
  fetch?: typeof fetch;
  retryDelayMs?: number;
};

export type MgmtClient = {
  findClientByName(name: string): Promise<Result<Auth0Client | null, MgmtError>>;
  createClient(body: Partial<Auth0Client>): Promise<Result<Auth0Client, MgmtError>>;
  patchClient(id: string, body: Partial<Auth0Client>): Promise<Result<Auth0Client, MgmtError>>;
  deleteClient(id: string): Promise<Result<void, MgmtError>>;

  findResourceServerByIdentifier(identifier: string): Promise<Result<Auth0ResourceServer | null, MgmtError>>;
  createResourceServer(body: Partial<Auth0ResourceServer>): Promise<Result<Auth0ResourceServer, MgmtError>>;
  patchResourceServer(id: string, body: Partial<Auth0ResourceServer>): Promise<Result<Auth0ResourceServer, MgmtError>>;
  deleteResourceServer(id: string): Promise<Result<void, MgmtError>>;

  findConnectionByName(name: string): Promise<Result<Auth0Connection | null, MgmtError>>;
  patchConnection(id: string, body: Partial<Auth0Connection>): Promise<Result<Auth0Connection, MgmtError>>;

  listClientGrants(clientId: string, audience: string): Promise<Result<Auth0ClientGrant[], MgmtError>>;
  createClientGrant(body: { client_id: string; audience: string; scope: string[] }): Promise<Result<Auth0ClientGrant, MgmtError>>;
  deleteClientGrant(id: string): Promise<Result<void, MgmtError>>;
};

export function createMgmtClient(cfg: MgmtClientConfig): MgmtClient {
  const fetcher = cfg.fetch ?? fetch;
  const retryDelay = cfg.retryDelayMs ?? 250;
  const apiBase = `https://${cfg.tenantDomain}/api/v2`;
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<Result<string, MgmtError>> {
    if (token && token.expiresAt > Date.now() + 30_000) return ok(token.value);
    const res = await fetcher(`https://${cfg.tenantDomain}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: cfg.mgmtClientId,
        client_secret: cfg.mgmtClientSecret,
        audience: `https://${cfg.tenantDomain}/api/v2/`,
      }),
    });
    if (res.status === 401 || res.status === 403) {
      return err([{ code: 'AUTH0_UNAUTHORIZED', message: 'mgmt token request failed; rotate target secret auth0Mgmt' }]);
    }
    if (!res.ok) return err([{ code: 'AUTH0_UPSTREAM_5XX', message: `token endpoint returned ${res.status}` }]);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return ok(body.access_token);
  }

  async function call<T>(method: string, path: string, body?: unknown): Promise<Result<T, MgmtError>> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const tok = await getToken();
      if (!tok.ok) return err(tok.errors as MgmtError[]);
      const res = await fetcher(`${apiBase}${path}`, {
        method,
        headers: { authorization: `Bearer ${tok.value}`, 'content-type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429) {
        if (attempt === 2) return err([{ code: 'AUTH0_RATE_LIMITED', message: `429 after 3 attempts on ${method} ${path}` }]);
        await new Promise((r) => setTimeout(r, retryDelay * Math.pow(2, attempt)));
        continue;
      }
      if (res.status === 404 && method === 'DELETE') return ok(undefined as T);
      if (res.status === 401 || res.status === 403) return err([{ code: 'AUTH0_UNAUTHORIZED', message: `${res.status} on ${method} ${path}` }]);
      if (res.status === 409) return err([{ code: 'AUTH0_CONFLICT', message: `409 on ${method} ${path}` }]);
      if (res.status >= 500) return err([{ code: 'AUTH0_UPSTREAM_5XX', message: `${res.status} on ${method} ${path}` }]);
      if (res.status >= 400) {
        const text = await res.text();
        return err([{ code: 'AUTH0_INVALID_INPUT', message: `${res.status} on ${method} ${path}: ${text.slice(0, 200)}` }]);
      }
      if (res.status === 204) return ok(undefined as T);
      return ok((await res.json()) as T);
    }
    return err([{ code: 'AUTH0_RATE_LIMITED', message: 'unreachable' }]);
  }

  return {
    async findClientByName(name) {
      const r = await call<Auth0Client[]>('GET', `/clients?name=${encodeURIComponent(name)}&fields=client_id,name,app_type,token_endpoint_auth_method,grant_types,callbacks,web_origins,allowed_origins,allowed_logout_urls,organization_usage&include_fields=true`);
      if (!r.ok) return r;
      return ok(r.value[0] ?? null);
    },
    createClient: (body) => call<Auth0Client>('POST', '/clients', body),
    patchClient: (id, body) => call<Auth0Client>('PATCH', `/clients/${encodeURIComponent(id)}`, body),
    deleteClient: (id) => call<void>('DELETE', `/clients/${encodeURIComponent(id)}`),
    async findResourceServerByIdentifier(identifier) {
      const r = await call<Auth0ResourceServer[]>('GET', `/resource-servers?identifiers=${encodeURIComponent(identifier)}`);
      if (!r.ok) return r;
      return ok(r.value[0] ?? null);
    },
    createResourceServer: (body) => call<Auth0ResourceServer>('POST', '/resource-servers', body),
    patchResourceServer: (id, body) => call<Auth0ResourceServer>('PATCH', `/resource-servers/${encodeURIComponent(id)}`, body),
    deleteResourceServer: (id) => call<void>('DELETE', `/resource-servers/${encodeURIComponent(id)}`),
    async findConnectionByName(name) {
      const r = await call<Auth0Connection[]>('GET', `/connections?name=${encodeURIComponent(name)}&strategy=auth0`);
      if (!r.ok) return r;
      return ok(r.value[0] ?? null);
    },
    patchConnection: (id, body) => call<Auth0Connection>('PATCH', `/connections/${encodeURIComponent(id)}`, body),
    async listClientGrants(clientId, audience) {
      return call<Auth0ClientGrant[]>('GET', `/client-grants?client_id=${encodeURIComponent(clientId)}&audience=${encodeURIComponent(audience)}`);
    },
    createClientGrant: (body) => call<Auth0ClientGrant>('POST', '/client-grants', body),
    deleteClientGrant: (id) => call<void>('DELETE', `/client-grants/${encodeURIComponent(id)}`),
  };
}
```

Create `modules/identity/auth0/src/result-shim.ts` with the same `ok`/`err` helpers if it does not already exist (the auth0 module currently imports from a different package — match whatever the existing convention is).

- [ ] **Step 18.3: Run, build, commit**

```bash
pnpm -F @rntme/identity-auth0 vitest run test/unit/mgmt-client.test.ts
pnpm -F @rntme/identity-auth0 run build
git add modules/identity/auth0
git commit -m "feat(identity-auth0): mgmt-client fetch wrapper with retry and error mapping"
```

---

### Task 19: Auth0 `provisioner.ts` — `provision()` reconcile

**Files:**
- Create: `modules/identity/auth0/src/provisioner.ts`
- Test: `modules/identity/auth0/test/unit/provisioner.test.ts`
- Modify: `modules/identity/auth0/package.json` (export the provisioner entry)

- [ ] **Step 19.1: Write failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { provision, ENV_MAPPINGS } from '../../src/provisioner.js';

const baseInput = {
  publicConfig: {
    appName: 'test-organization-notes-demo-default',
    redirectUri: 'https://notes-demo.rntme.com/',
    audience: 'https://notes-demo.rntme.com/api',
    allowedOrigins: ['https://notes-demo.rntme.com'],
    allowedLogoutUrls: ['https://notes-demo.rntme.com/'],
    organizationsCapability: 'allow' as const,
    m2mClients: [{ name: 'introspect', scopes: ['read:resource_servers'] }],
  },
  targetSecrets: {
    auth0Mgmt: { tenantDomain: 'demo.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b' },
  },
  log: () => undefined,
  signal: new AbortController().signal,
};

describe('provision — create path', () => {
  it('creates SPA client + Resource Server + M2M when none exist', async () => {
    const calls: { method: string; path: string; body?: unknown }[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      calls.push({ method: init?.method ?? 'GET', path: u.pathname + u.search, body: init?.body });
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      if (u.pathname === '/api/v2/clients' && (!init?.method || init.method === 'GET')) return new Response('[]', { status: 200 });
      if (u.pathname === '/api/v2/clients' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ client_id: `cid_${body.app_type}`, name: body.name, client_secret: 'm2m_sec', ...body }), { status: 201 });
      }
      if (u.pathname === '/api/v2/resource-servers' && (!init?.method || init.method === 'GET')) return new Response('[]', { status: 200 });
      if (u.pathname === '/api/v2/resource-servers' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: 'rs_1', ...body }), { status: 201 });
      }
      if (u.pathname === '/api/v2/connections') return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication', enabled_clients: [] }]), { status: 200 });
      if (u.pathname.startsWith('/api/v2/connections/')) return new Response('{}', { status: 200 });
      if (u.pathname === '/api/v2/client-grants' && (!init?.method || init.method === 'GET')) return new Response('[]', { status: 200 });
      if (u.pathname === '/api/v2/client-grants' && init?.method === 'POST') return new Response('{"id":"grant_1"}', { status: 201 });
      throw new Error(`unhandled ${u.pathname}`);
    });

    const out = await provision({ ...baseInput, fetch: fetcher });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.publicOutputs).toMatchObject({
      spaClient: { name: 'test-organization-notes-demo-default' },
      resourceServer: { id: 'rs_1', identifier: 'https://notes-demo.rntme.com/api' },
    });
    expect(out.value.secretOutputs.m2mClients).toEqual([
      { name: 'introspect', clientId: expect.any(String), clientSecret: 'm2m_sec' },
    ]);

    const spaPost = calls.find((c) => c.method === 'POST' && c.path === '/api/v2/clients' && JSON.parse(String(c.body)).app_type === 'spa');
    expect(spaPost).toBeTruthy();
    const spaBody = JSON.parse(String(spaPost!.body));
    expect(spaBody.token_endpoint_auth_method).toBe('none');
    expect(spaBody.grant_types).toEqual(['authorization_code', 'refresh_token']);
  });
});

describe('provision — reconcile path', () => {
  it('PATCHes a SPA client whose token_endpoint_auth_method differs from desired', async () => {
    let patchCalled = false;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      if (u.pathname === '/api/v2/clients' && u.searchParams.get('name')?.includes('m2m')) return new Response('[]', { status: 200 });
      if (u.pathname === '/api/v2/clients' && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify([{
          client_id: 'spa_existing',
          name: baseInput.publicConfig.appName,
          app_type: 'spa',
          token_endpoint_auth_method: 'client_secret_post',
          grant_types: ['authorization_code', 'refresh_token'],
          callbacks: [baseInput.publicConfig.redirectUri],
          web_origins: baseInput.publicConfig.allowedOrigins,
          allowed_origins: baseInput.publicConfig.allowedOrigins,
          allowed_logout_urls: baseInput.publicConfig.allowedLogoutUrls,
          organization_usage: 'allow',
        }]), { status: 200 });
      }
      if (u.pathname.startsWith('/api/v2/clients/spa_existing') && init?.method === 'PATCH') {
        patchCalled = true;
        const body = JSON.parse(String(init.body));
        expect(body.token_endpoint_auth_method).toBe('none');
        return new Response('{}', { status: 200 });
      }
      if (u.pathname === '/api/v2/clients' && init?.method === 'POST') return new Response(JSON.stringify({ client_id: 'm2m_c', name: 'm2m', client_secret: 's' }), { status: 201 });
      if (u.pathname === '/api/v2/resource-servers' && (!init?.method || init.method === 'GET')) return new Response(JSON.stringify([{ id: 'rs_1', identifier: baseInput.publicConfig.audience, signing_alg: 'RS256', token_dialect: 'access_token_authz', enforce_policies: true }]), { status: 200 });
      if (u.pathname === '/api/v2/connections') return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication', enabled_clients: ['spa_existing'] }]), { status: 200 });
      if (u.pathname === '/api/v2/client-grants' && (!init?.method || init.method === 'GET')) return new Response('[{"id":"g","client_id":"m2m_c","audience":"https://notes-demo.rntme.com/api","scope":["read:resource_servers"]}]', { status: 200 });
      throw new Error(`unhandled ${u.pathname}`);
    });

    const out = await provision({ ...baseInput, fetch: fetcher });
    expect(out.ok).toBe(true);
    expect(patchCalled).toBe(true);
  });
});

describe('provision — no-op path', () => {
  it('issues zero PATCH/POST when state is already converged', async () => {
    const mutations: string[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      const method = init?.method ?? 'GET';
      if (method === 'POST' || method === 'PATCH') mutations.push(`${method} ${u.pathname}`);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      // Return fully-converged state for everything
      if (u.pathname === '/api/v2/clients' && u.searchParams.get('name')?.includes('m2m')) {
        return new Response(JSON.stringify([{ client_id: 'm2m_c', name: 'test-organization-notes-demo-default-m2m-introspect', app_type: 'non_interactive', grant_types: ['client_credentials'], token_endpoint_auth_method: 'client_secret_post' }]), { status: 200 });
      }
      if (u.pathname === '/api/v2/clients') {
        return new Response(JSON.stringify([{
          client_id: 'spa_x', name: baseInput.publicConfig.appName,
          app_type: 'spa', token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code', 'refresh_token'],
          callbacks: [baseInput.publicConfig.redirectUri],
          web_origins: baseInput.publicConfig.allowedOrigins,
          allowed_origins: baseInput.publicConfig.allowedOrigins,
          allowed_logout_urls: baseInput.publicConfig.allowedLogoutUrls,
          organization_usage: 'allow',
        }]), { status: 200 });
      }
      if (u.pathname === '/api/v2/resource-servers') return new Response(JSON.stringify([{ id: 'rs_1', identifier: baseInput.publicConfig.audience, name: `${baseInput.publicConfig.appName} API`, signing_alg: 'RS256', token_dialect: 'access_token_authz', enforce_policies: true }]), { status: 200 });
      if (u.pathname === '/api/v2/connections') return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication', enabled_clients: ['spa_x'] }]), { status: 200 });
      if (u.pathname === '/api/v2/client-grants') return new Response(JSON.stringify([{ id: 'g', client_id: 'm2m_c', audience: baseInput.publicConfig.audience, scope: ['read:resource_servers'] }]), { status: 200 });
      throw new Error(`unhandled ${u.pathname}`);
    });

    const out = await provision({
      ...baseInput,
      priorOutputs: {
        publicOutputs: { spaClient: { id: 'spa_x', name: baseInput.publicConfig.appName }, resourceServer: { id: 'rs_1', identifier: baseInput.publicConfig.audience } },
        secretOutputs: { m2mClients: [{ name: 'introspect', clientId: 'm2m_c', clientSecret: 'kept' }] },
      },
      fetch: fetcher,
    });

    expect(out.ok).toBe(true);
    expect(mutations).toEqual([]);
  });
});

describe('provision — idempotence', () => {
  it('twice in a row produces identical outputs and zero extra mutations', async () => {
    // Use the same fetcher harness as no-op test
    // Run provision once, capture output
    // Run again, assert output bytes equal and zero additional mutations recorded after first run
  });
});

describe('ENV_MAPPINGS', () => {
  it('exposes the expected mappings', () => {
    expect(ENV_MAPPINGS).toMatchObject({
      'identity-auth0': expect.arrayContaining([
        expect.objectContaining({ envName: 'AUTH0_SPA_CLIENT_ID' }),
        expect.objectContaining({ envName: 'AUTH0_AUDIENCE' }),
        expect.objectContaining({ envName: expect.stringContaining('AUTH0_M2M_') }),
      ]),
    });
  });
});
```

- [ ] **Step 19.2: Implement provisioner.ts**

Create `modules/identity/auth0/src/provisioner.ts`:

```ts
import { createMgmtClient, type Auth0Client, type Auth0Connection, type Auth0ResourceServer, type MgmtClient } from './mgmt-client.js';
import { err, ok } from './result-shim.js';
import type { ProvisionerEnvMapping } from '@rntme/deploy-core';

export type Auth0PublicConfig = {
  appName: string;
  redirectUri: string;
  audience: string;
  allowedOrigins: string[];
  allowedLogoutUrls: string[];
  organizationsCapability: 'allow' | 'deny';
  m2mClients: ReadonlyArray<{ name: string; scopes: string[] }>;
};

export type Auth0TargetSecrets = {
  auth0Mgmt: { tenantDomain: string; mgmtClientId: string; mgmtClientSecret: string };
};

type ProvisionInput = {
  publicConfig: Auth0PublicConfig;
  targetSecrets: Record<string, unknown>;
  priorOutputs?: { publicOutputs: Record<string, unknown>; secretOutputs: Record<string, unknown> };
  log: (entry: { step: string; level: 'info' | 'warn' | 'error'; code?: string; message: string }) => void;
  signal: AbortSignal;
  fetch?: typeof fetch;
};

const DEFAULT_CONNECTION = 'Username-Password-Authentication';

export async function provision(input: ProvisionInput) {
  const cfg = input.publicConfig;
  const secrets = input.targetSecrets.auth0Mgmt as Auth0TargetSecrets['auth0Mgmt'];
  const mgmt = createMgmtClient({ ...secrets, fetch: input.fetch });

  // 1. SPA client
  const spaDesired: Partial<Auth0Client> = {
    name: cfg.appName,
    app_type: 'spa',
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    callbacks: [cfg.redirectUri],
    web_origins: cfg.allowedOrigins,
    allowed_origins: cfg.allowedOrigins,
    allowed_logout_urls: cfg.allowedLogoutUrls,
    organization_usage: cfg.organizationsCapability,
  };
  const spaResult = await reconcileClient(mgmt, cfg.appName, spaDesired);
  if (!spaResult.ok) return err(spaResult.errors);
  const spa = spaResult.value;
  input.log({ step: 'spa-client', level: 'info', message: `SPA client ${spa.client_id}` });

  // 2. Resource Server
  const rsDesired: Partial<Auth0ResourceServer> = {
    identifier: cfg.audience,
    name: `${cfg.appName} API`,
    signing_alg: 'RS256',
    token_dialect: 'access_token_authz',
    enforce_policies: true,
  };
  const rsResult = await reconcileResourceServer(mgmt, cfg.audience, rsDesired);
  if (!rsResult.ok) return err(rsResult.errors);
  const rs = rsResult.value;
  input.log({ step: 'resource-server', level: 'info', message: `Resource server ${rs.identifier}` });

  // 3. Connection enablement
  const connResult = await ensureConnectionEnabled(mgmt, DEFAULT_CONNECTION, spa.client_id);
  if (!connResult.ok) return err(connResult.errors);
  input.log({ step: 'connection', level: 'info', message: `Connection ${DEFAULT_CONNECTION}` });

  // 4. M2M clients
  const priorM2M = (input.priorOutputs?.secretOutputs.m2mClients ?? []) as Array<{ name: string; clientId: string; clientSecret: string }>;
  const m2mOut: Array<{ name: string; clientId: string; clientSecret: string }> = [];
  for (const decl of cfg.m2mClients) {
    const m2mName = `${cfg.appName}-m2m-${decl.name}`;
    const found = await mgmt.findClientByName(m2mName);
    if (!found.ok) return err(found.errors);
    let clientId: string;
    let clientSecret: string;
    if (found.value === null) {
      const created = await mgmt.createClient({
        name: m2mName,
        app_type: 'non_interactive',
        grant_types: ['client_credentials'],
        token_endpoint_auth_method: 'client_secret_post',
      });
      if (!created.ok) return err(created.errors);
      clientId = created.value.client_id;
      clientSecret = created.value.client_secret ?? '';
    } else {
      clientId = found.value.client_id;
      const prior = priorM2M.find((p) => p.name === decl.name);
      if (!prior) {
        input.log({ step: 'm2m-client', level: 'warn', code: 'AUTH0_M2M_SECRET_LOST', message: `existing M2M ${m2mName} has no priorOutputs entry; secret cannot be recovered without rotate-flow` });
        clientSecret = '';
      } else {
        clientSecret = prior.clientSecret;
      }
    }
    m2mOut.push({ name: decl.name, clientId, clientSecret });

    const grants = await mgmt.listClientGrants(clientId, cfg.audience);
    if (!grants.ok) return err(grants.errors);
    if (grants.value.length === 0) {
      const cg = await mgmt.createClientGrant({ client_id: clientId, audience: cfg.audience, scope: decl.scopes });
      if (!cg.ok) return err(cg.errors);
    }
  }

  return ok({
    publicOutputs: {
      spaClient: { id: spa.client_id, name: spa.name },
      resourceServer: { id: rs.id, identifier: rs.identifier },
    },
    secretOutputs: { m2mClients: m2mOut },
  });
}

async function reconcileClient(mgmt: MgmtClient, name: string, desired: Partial<Auth0Client>) {
  const found = await mgmt.findClientByName(name);
  if (!found.ok) return found;
  if (!found.value) return mgmt.createClient(desired);
  if (clientDiff(found.value, desired)) return mgmt.patchClient(found.value.client_id, desired);
  return ok(found.value);
}

function clientDiff(actual: Auth0Client, desired: Partial<Auth0Client>): boolean {
  for (const k of Object.keys(desired) as (keyof Auth0Client)[]) {
    if (JSON.stringify(actual[k]) !== JSON.stringify(desired[k])) return true;
  }
  return false;
}

async function reconcileResourceServer(mgmt: MgmtClient, identifier: string, desired: Partial<Auth0ResourceServer>) {
  const found = await mgmt.findResourceServerByIdentifier(identifier);
  if (!found.ok) return found;
  if (!found.value) return mgmt.createResourceServer(desired);
  for (const k of Object.keys(desired) as (keyof Auth0ResourceServer)[]) {
    if (k === 'id' || k === 'identifier') continue;
    if (JSON.stringify(found.value[k]) !== JSON.stringify(desired[k])) return mgmt.patchResourceServer(found.value.id, desired);
  }
  return ok(found.value);
}

async function ensureConnectionEnabled(mgmt: MgmtClient, connectionName: string, clientId: string) {
  const found = await mgmt.findConnectionByName(connectionName);
  if (!found.ok) return found;
  if (!found.value) return ok({} as Auth0Connection);
  const enabled = found.value.enabled_clients ?? [];
  if (enabled.includes(clientId)) return ok(found.value);
  return mgmt.patchConnection(found.value.id, { enabled_clients: [...enabled, clientId] });
}

export const ENV_MAPPINGS: ProvisionerEnvMapping = {
  'identity-auth0': [
    { from: 'spaClient.id', envName: 'AUTH0_SPA_CLIENT_ID', secret: false, target: 'app' },
    { from: 'resourceServer.identifier', envName: 'AUTH0_AUDIENCE', secret: false, target: 'app' },
    { from: 'm2mClients.*.clientSecret', envName: 'AUTH0_M2M_${name}_CLIENT_SECRET', secret: true, target: 'identity-auth0' },
    { from: 'm2mClients.*.clientId', envName: 'AUTH0_M2M_${name}_CLIENT_ID', secret: false, target: 'identity-auth0' },
  ],
};
```

- [ ] **Step 19.3: Update package exports**

Edit `modules/identity/auth0/package.json` to add an `exports` entry for `./provisioner.js` if the package uses subpath exports. Otherwise, ensure `dist/provisioner.js` is reachable via `import('@rntme/identity-auth0/dist/provisioner.js')`.

- [ ] **Step 19.4: Run tests, build, commit**

```bash
pnpm -F @rntme/identity-auth0 vitest run test/unit/provisioner.test.ts
pnpm -F @rntme/identity-auth0 run build && pnpm -F @rntme/identity-auth0 run typecheck
git add modules/identity/auth0
git commit -m "feat(identity-auth0): provision() reconcile sequence + ENV_MAPPINGS"
```

---

### Task 20: Auth0 `tearDown()`

**Files:**
- Modify: `modules/identity/auth0/src/provisioner.ts`
- Modify: `modules/identity/auth0/test/unit/provisioner.test.ts`

- [ ] **Step 20.1: Write failing tests**

Append to the provisioner test file:

```ts
describe('tearDown', () => {
  it('deletes M2M clients, client-grants, resource server, and SPA client', async () => {
    const deletes: string[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      if (init?.method === 'DELETE') {
        deletes.push(u.pathname);
        return new Response('', { status: 204 });
      }
      if (u.pathname === '/api/v2/client-grants') return new Response('[{"id":"g","client_id":"m2m_c","audience":"https://x/api"}]', { status: 200 });
      if (u.pathname === '/api/v2/connections') return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication', enabled_clients: ['spa_x', 'other_app'] }]), { status: 200 });
      if (u.pathname.startsWith('/api/v2/connections/')) return new Response('{}', { status: 200 });
      throw new Error(`unhandled ${u.pathname}`);
    });
    const r = await tearDown({ ...baseInput, priorOutputs: {
      publicOutputs: { spaClient: { id: 'spa_x' }, resourceServer: { id: 'rs_1', identifier: 'https://x/api' } },
      secretOutputs: { m2mClients: [{ name: 'introspect', clientId: 'm2m_c', clientSecret: 'shh' }] },
    }, fetch: fetcher });
    expect(r.ok).toBe(true);
    expect(deletes).toContain('/api/v2/client-grants/g');
    expect(deletes).toContain('/api/v2/clients/m2m_c');
    expect(deletes).toContain('/api/v2/resource-servers/rs_1');
    expect(deletes).toContain('/api/v2/clients/spa_x');
  });

  it('does not remove other clients from connection.enabled_clients', async () => {
    let connectionPatch: { enabled_clients?: string[] } | null = null;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      if (u.pathname === '/api/v2/connections') return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication', enabled_clients: ['spa_x', 'other_app'] }]), { status: 200 });
      if (u.pathname === '/api/v2/connections/conn_1' && init?.method === 'PATCH') {
        connectionPatch = JSON.parse(String(init.body));
        return new Response('{}', { status: 200 });
      }
      if (init?.method === 'DELETE') return new Response('', { status: 204 });
      if (u.pathname === '/api/v2/client-grants') return new Response('[]', { status: 200 });
      throw new Error(`unhandled ${u.pathname}`);
    });
    await tearDown({ ...baseInput, priorOutputs: {
      publicOutputs: { spaClient: { id: 'spa_x' } },
      secretOutputs: { m2mClients: [] },
    }, fetch: fetcher });
    expect(connectionPatch?.enabled_clients).toEqual(['other_app']);
  });

  it('treats 404 on delete as success (idempotent)', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      if (u.pathname === '/api/v2/connections') return new Response('[]', { status: 200 });
      if (u.pathname === '/api/v2/client-grants') return new Response('[]', { status: 200 });
      if (init?.method === 'DELETE') return new Response('', { status: 404 });
      throw new Error(`unhandled ${u.pathname}`);
    });
    const r = await tearDown({ ...baseInput, priorOutputs: {
      publicOutputs: { spaClient: { id: 'spa_x' }, resourceServer: { id: 'rs_1', identifier: 'https://x/api' } },
      secretOutputs: { m2mClients: [{ name: 'a', clientId: 'm', clientSecret: 's' }] },
    }, fetch: fetcher });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 20.2: Implement `tearDown`**

Append to `modules/identity/auth0/src/provisioner.ts`:

```ts
export async function tearDown(input: ProvisionInput) {
  const secrets = input.targetSecrets.auth0Mgmt as Auth0TargetSecrets['auth0Mgmt'];
  const mgmt = createMgmtClient({ ...secrets, fetch: input.fetch });

  const prior = input.priorOutputs;
  if (!prior) return ok(undefined);

  const m2m = (prior.secretOutputs.m2mClients ?? []) as Array<{ clientId: string }>;
  for (const m of m2m) {
    const grants = await mgmt.listClientGrants(m.clientId, (prior.publicOutputs.resourceServer as { identifier?: string } | undefined)?.identifier ?? '');
    if (grants.ok) {
      for (const g of grants.value) {
        const r = await mgmt.deleteClientGrant(g.id);
        if (!r.ok) return err(r.errors);
      }
    }
    const r = await mgmt.deleteClient(m.clientId);
    if (!r.ok) return err(r.errors);
  }

  const rs = prior.publicOutputs.resourceServer as { id?: string } | undefined;
  if (rs?.id) {
    const r = await mgmt.deleteResourceServer(rs.id);
    if (!r.ok) return err(r.errors);
  }

  const spa = prior.publicOutputs.spaClient as { id?: string } | undefined;
  if (spa?.id) {
    const conn = await mgmt.findConnectionByName(DEFAULT_CONNECTION);
    if (conn.ok && conn.value) {
      const enabled = conn.value.enabled_clients ?? [];
      if (enabled.includes(spa.id)) {
        const r = await mgmt.patchConnection(conn.value.id, { enabled_clients: enabled.filter((c) => c !== spa.id) });
        if (!r.ok) return err(r.errors);
      }
    }
    const r = await mgmt.deleteClient(spa.id);
    if (!r.ok) return err(r.errors);
  }

  return ok(undefined);
}
```

- [ ] **Step 20.3: Run, build, commit**

```bash
pnpm -F @rntme/identity-auth0 vitest run test/unit/provisioner.test.ts
pnpm -F @rntme/identity-auth0 run build
git add modules/identity/auth0
git commit -m "feat(identity-auth0): tearDown for SPA, RS, M2M, and connection enablement"
```

---

### Task 21: Update Auth0 `module.json`

**Files:**
- Modify: `modules/identity/auth0/module.json`

- [ ] **Step 21.1: Add provisioner block**

Edit `modules/identity/auth0/module.json`. Insert before `"limitations"`:

```jsonc
"provisioner": {
  "entry": "./dist/provisioner.js",
  "produces": [
    { "name": "spaClient", "kind": "single", "secret": false },
    { "name": "resourceServer", "kind": "single", "secret": false },
    { "name": "m2mClients", "kind": "many", "secret": true }
  ],
  "requires": [
    { "name": "auth0Mgmt", "schema": "auth0-mgmt-api-v1" }
  ],
  "timeoutMs": 60000
},
```

- [ ] **Step 21.2: Verify discovery still parses**

The existing test `accepts checked-in identity module manifests without local rewrites` in `module-skeleton/test/unit/manifest-shape.test.ts` should still pass and now exercise the provisioner block.

```bash
pnpm -F @rntme/module-skeleton vitest run test/unit/manifest-shape.test.ts
```

- [ ] **Step 21.3: Commit**

```bash
git add modules/identity/auth0/module.json
git commit -m "feat(identity-auth0): declare provisioner block in module.json"
```

---

### Task 22: Conformance contract test

**Files:**
- Create: `packages/deploy/deploy-core/test/conformance/provisioner-contract.test.ts`

- [ ] **Step 22.1: Write the conformance test**

```ts
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseModuleManifest } from '@rntme/module-skeleton';

const MODULES_ROOT = join(process.cwd(), '..', '..', '..', 'modules');

function listModules(): { dir: string; manifest: ReturnType<typeof parseModuleManifest> }[] {
  const out: { dir: string; manifest: ReturnType<typeof parseModuleManifest> }[] = [];
  for (const category of readdirSync(MODULES_ROOT)) {
    const categoryDir = join(MODULES_ROOT, category);
    for (const vendor of readdirSync(categoryDir)) {
      const moduleJson = join(categoryDir, vendor, 'module.json');
      if (!existsSync(moduleJson)) continue;
      const raw = JSON.parse(readFileSync(moduleJson, 'utf8'));
      out.push({ dir: join(categoryDir, vendor), manifest: parseModuleManifest(raw) });
    }
  }
  return out;
}

describe('Provisioner conformance', () => {
  for (const m of listModules()) {
    if (!m.manifest.ok || !m.manifest.value.provisioner) continue;
    it(`${m.manifest.value.name} exports a provision() function from its provisioner entry`, async () => {
      const entryPath = join(m.dir, m.manifest.value.provisioner!.entry);
      expect(existsSync(entryPath), `provisioner entry must exist at ${entryPath}`).toBe(true);
      const exports = await import(entryPath);
      expect(typeof exports.provision).toBe('function');
      // tearDown is optional
      if ('tearDown' in exports) {
        expect(typeof exports.tearDown).toBe('function');
      }
    });

    it(`${m.manifest.value.name} provision() returns a Result for invalid input rather than throwing`, async () => {
      const entryPath = join(m.dir, m.manifest.value.provisioner!.entry);
      const exports = await import(entryPath);
      const r = await exports.provision({
        publicConfig: {} as never,
        targetSecrets: {},
        log: () => undefined,
        signal: new AbortController().signal,
      });
      expect(r).toHaveProperty('ok');
      expect(typeof r.ok).toBe('boolean');
    });
  }
});
```

- [ ] **Step 22.2: Run and commit**

```bash
pnpm -F @rntme/deploy-core vitest run test/conformance/provisioner-contract.test.ts
git add packages/deploy/deploy-core/test/conformance
git commit -m "test(deploy-core): provisioner contract conformance suite"
```

---

### Task 23: Tear-down hook coordination with project-delete spec

**Files:**
- Modify: `docs/history/specs/historical/2026-05-03-project-update-delete-operations-design.md` **OR** create `docs/history/specs/active-rationale/2026-05-03-project-update-delete-operations-design-errata-01.md`

- [ ] **Step 23.1: Determine which form to use**

```bash
ls docs/history/specs/historical/ | grep '2026-05-03-project-update-delete'
```

If the spec is in `done/`, write an errata file. Otherwise, add a decision row and a tear-down paragraph directly.

- [ ] **Step 23.2: If editing in-place — add decision D17**

Append a new row to the §4 Decisions table:

```markdown
| D17 | Module-provisioner tear-down | Before Dokploy adapter delete, the project-delete executor invokes each module's `tearDown(input)` for every module with a `provisionResult` on the last successful deployment. 404 responses are treated as success. Tear-down failures transition the operation to `delete_failed` with retry semantics. |
```

Add a paragraph in the §teardown phase section:

```markdown
### Module provisioner tear-down

For each (project, deploy_target) pair, the executor:

1. Loads the last successful `deployment.provisionResult` (public) and decrypts `provisionResultCiphertext` (secret).
2. For each module entry, dynamically imports the module's `provisioner.entry` and calls `tearDown({ publicConfig, targetSecrets, priorOutputs, log, signal })`. Inputs are reconstructed from the immutable blueprint version, decrypted target secrets, and the prior outputs.
3. If `tearDown` returns Err, the operation transitions to `delete_failed` and retries replay the call (idempotent — 404 = success).
4. Adapter-side resource deletion proceeds only after all module tear-downs succeed.

If no successful deployment exists, tear-down is skipped and a warning is recorded on the operation.
```

- [ ] **Step 23.3: Commit**

```bash
git add docs/history/specs/historical/2026-05-03-project-update-delete-operations-design.md
git commit -m "docs: D17 + tear-down phase paragraph for module provisioners"
```

(Or with the errata filename if applicable.)

---

### Task 24: E2E test gated on `AUTH0_E2E=1`

**Files:**
- Create: `modules/identity/auth0/test/e2e/provisioner.test.ts`

- [ ] **Step 24.1: Write the gated test**

```ts
import { describe, expect, it } from 'vitest';
import { provision, tearDown } from '../../src/provisioner.js';

const ENABLED = process.env.AUTH0_E2E === '1';
const TENANT = process.env.AUTH0_E2E_TENANT_DOMAIN ?? '';
const CLIENT_ID = process.env.AUTH0_E2E_MGMT_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.AUTH0_E2E_MGMT_CLIENT_SECRET ?? '';

describe.skipIf(!ENABLED)('provisioner — Auth0 E2E', () => {
  it('roundtrips create -> reconcile -> tearDown against a real tenant', async () => {
    const suffix = Math.floor(Date.now() / 1000);
    const appName = `rntme-e2e-${suffix}`;
    const audience = `https://e2e-${suffix}.example/api`;
    const input = {
      publicConfig: {
        appName,
        redirectUri: `https://e2e-${suffix}.example/`,
        audience,
        allowedOrigins: [`https://e2e-${suffix}.example`],
        allowedLogoutUrls: [`https://e2e-${suffix}.example/`],
        organizationsCapability: 'allow' as const,
        m2mClients: [{ name: 'introspect', scopes: [] }],
      },
      targetSecrets: { auth0Mgmt: { tenantDomain: TENANT, mgmtClientId: CLIENT_ID, mgmtClientSecret: CLIENT_SECRET } },
      log: () => undefined,
      signal: new AbortController().signal,
    };

    const first = await provision(input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await provision({
      ...input,
      priorOutputs: { publicOutputs: first.value.publicOutputs, secretOutputs: first.value.secretOutputs },
    });
    expect(second.ok).toBe(true);

    const teardown = await tearDown({
      ...input,
      priorOutputs: { publicOutputs: first.value.publicOutputs, secretOutputs: first.value.secretOutputs },
    });
    expect(teardown.ok).toBe(true);
  }, 30_000);
});
```

- [ ] **Step 24.2: Commit**

```bash
git add modules/identity/auth0/test/e2e
git commit -m "test(identity-auth0): gated E2E provision/tearDown roundtrip"
```

---

### Task 25: PR-3 doc-touch — Auth0 README

**Files:**
- Modify: `modules/identity/auth0/README.md`

- [ ] **Step 25.1: Add Provisioner section**

Append:

```markdown
## Provisioner

`src/provisioner.ts` exports `provision(input)` and `tearDown(input)`. The Auth0 module declares its provisioner block in `module.json`:

- `produces`: `spaClient` (single, public), `resourceServer` (single, public), `m2mClients` (many, secret).
- `requires`: `auth0Mgmt` (schema `auth0-mgmt-api-v1`).
- `timeoutMs`: 60 000.

### Required target secret

Operators write the Auth0 Mgmt API credentials onto the deploy target via:

```
PUT /v1/orgs/<org>/deploy-targets/<slug>/secrets/auth0Mgmt
Content-Type: application/json

{
  "schema": "auth0-mgmt-api-v1",
  "value": {
    "tenantDomain": "demo.us.auth0.com",
    "mgmtClientId": "<machine-to-machine client id>",
    "mgmtClientSecret": "<machine-to-machine client secret>"
  }
}
```

The Mgmt API client must be authorized with `read/create/update/delete:clients`, `read/create/update/delete:resource_servers`, `read/update:connections`, and `read/create/delete:client_grants`.

### What gets reconciled

| Object | Reconcile rules |
|---|---|
| SPA client | name = `appName`; `app_type='spa'`; `token_endpoint_auth_method='none'`; grant_types `['authorization_code','refresh_token']`; callbacks/web_origins/allowed_origins/allowed_logout_urls from blueprint; `organization_usage='allow'`. |
| Resource Server | identifier = blueprint `audience`; `signing_alg='RS256'`; `token_dialect='access_token_authz'`; `enforce_policies=true`. |
| Connection | `Username-Password-Authentication` enabled_clients += SPA client_id. Other clients are preserved. |
| M2M clients | per blueprint `m2mClients[]`: `app_type='non_interactive'`, `grant_types=['client_credentials']`, plus a client_grant for the Resource Server with declared scopes. |

### Output env vars

After provision, render bakes:

- `AUTH0_SPA_CLIENT_ID` (on `app` resource).
- `AUTH0_AUDIENCE` (on `app` resource).
- `AUTH0_M2M_<NAME>_CLIENT_ID` and `AUTH0_M2M_<NAME>_CLIENT_SECRET` (on `identity-auth0` resource), per declared M2M client.

### Tear-down

Triggered by the project-delete operation before Dokploy resource deletion. Removes M2M clients and grants, the Resource Server, removes the SPA client_id from the connection's enabled_clients, and deletes the SPA client. 404 responses are treated as success.

### Limitations

- M2M `clientSecret` is only obtainable at create time. Reconcile does not rotate it; if the stored ciphertext is lost, recovery is a separate CLI flow.
- Only the `Username-Password-Authentication` connection is currently enabled. Multi-connection blueprints are a future extension.
```

- [ ] **Step 25.2: Commit**

```bash
git add modules/identity/auth0/README.md
git commit -m "docs(identity-auth0): provisioner section"
```

---

## Self-review checklist (executor must run before opening PRs)

- `pnpm -r run build` — green across the workspace.
- `pnpm -r run typecheck` — green.
- `pnpm -r run test` — green.
- `pnpm -r run lint` — green.
- `git log` shows 25 commits matching tasks 1–25.
- The notes-demo target (or a fresh test target) has `auth0Mgmt` configured and one deploy completes; `provision` phase log includes "SPA client …" and the post-deploy `/api/v2/clients/<id>` response shows `token_endpoint_auth_method='none'`.

---

## Operational follow-up (not a code task — record in PR 3 description)

1. In the demo Auth0 tenant, create a Machine-to-Machine application authorized for the Mgmt API with the scopes listed above. Note its `client_id` and `client_secret`.
2. PUT the credentials onto the `notes-demo` deploy target:
   ```bash
   curl -X PUT \
     -H "Authorization: Bearer $RNTME_TOKEN" \
     -H "Content-Type: application/json" \
     https://platform.rntme.com/v1/orgs/test-organization/deploy-targets/notes-demo/secrets/auth0Mgmt \
     -d '{"schema":"auth0-mgmt-api-v1","value":{"tenantDomain":"demo-rntme.us.auth0.com","mgmtClientId":"...","mgmtClientSecret":"..."}}'
   ```
3. Trigger a deployment. Watch the `provision` phase logs for the SPA, RS, connection, and M2M reconcile lines.
4. Verify in the Auth0 dashboard that `token_endpoint_auth_method` on the SPA client is `none`.
5. Record the deployment id, log excerpts, and final state in `docs/history/plans/historical/notes-demo-provisioner-rollout-<date>.md`.
