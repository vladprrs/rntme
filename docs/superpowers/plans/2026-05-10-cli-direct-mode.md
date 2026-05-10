# CLI Direct-Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `rntme` CLI deploy any blueprint without a running platform, by adding a thin `apps/cli/src/deploy-engine/` glue layer over `@rntme/deploy-runner`, plus three commands: `rntme deploy <bp>`, `rntme platform up`, `rntme platform down`. The CLI bundle ships `apps/platform/blueprint/` artifacts so `platform up` works offline.

**Architecture:** A new `apps/cli/src/deploy-engine/` directory hosts target-file loading, env-var secret resolution, blueprint composition, a plain-token Dokploy client builder, and a stdout/JSONL hook layer that wraps `runDeployment` from `@rntme/deploy-runner`. The blueprint→`ComposedProjectInput` conversion (currently in `apps/platform-http/src/deploy/executor.ts`) is ported into the engine because it depends on `@rntme/bindings-grpc`, which deploy-runner cannot import. The CLI postbuild copies `apps/platform/blueprint/` into `dist/platform-blueprint/` so the bundled CLI carries the artifacts. Three new commands wire into the existing `bin/cli.ts` dispatcher; no platform API call is made in direct mode.

**Tech Stack:** TypeScript, Bun 1.1+, `@rntme/deploy-runner`, `@rntme/deploy-core`, `@rntme/deploy-dokploy`, `@rntme/blueprint`, `@rntme/platform-core`, `@rntme/bindings-grpc`, `zod` for target-file validation, `bun test`.

---

## Scope Boundary

This plan adds direct-mode deploy + platform bootstrap + platform teardown to the CLI. It does not modify `apps/platform-http`, does not introduce BPMN, does not delete anything, does not touch `services/deployments`, and does not add a non-Dokploy target adapter. Existing CLI commands (`login`, `project deploy`, `target *`, etc.) are unchanged. The spec for this plan is `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md` step 2.

The platform-side rename of `commands/login.ts` → `commands/platform/login.ts` mentioned in the spec is **out of scope** for this plan; it is a cosmetic move that buys nothing functional and risks breaking `rntme login` muscle memory in tests/docs. Defer to a later cleanup plan.

## File Structure

### Created

- `apps/cli/src/deploy-engine/types.ts` — engine-internal types (`LoadedTargetFile`, `EngineRunOptions`, `EngineProgressEvent`).
- `apps/cli/src/deploy-engine/target-schema.ts` — Zod schema for the discriminated target file (`kind: 'dokploy'` only).
- `apps/cli/src/deploy-engine/load-target.ts` — read + validate target JSON, return `NormalizedDeployTarget` (the runner's structural target type).
- `apps/cli/src/deploy-engine/load-secrets.ts` — resolve `{ source: 'env', name: 'X' }` refs to plaintext via `process.env`.
- `apps/cli/src/deploy-engine/load-blueprint.ts` — call `loadComposedBlueprint(dir)` and convert `ComposedBlueprint` → `ComposedProjectInput`.
- `apps/cli/src/deploy-engine/to-deploy-core-input.ts` — pure conversion `ComposedBlueprint → ComposedProjectInput` (port of `toDeployCoreInput` from `apps/platform-http/src/deploy/executor.ts`).
- `apps/cli/src/deploy-engine/dokploy-client.ts` — `buildPlainTokenDokployClient(apiToken, dokployUrl)` that returns a `DokployClient` without using a `SecretCipher`.
- `apps/cli/src/deploy-engine/resolve-provisioner.ts` — `dynamic-import` based `ResolveProvisioner` for direct-mode; mirrors the provisioner-resolution pattern used in platform-http but resolves from `bundleDir/node_modules/`.
- `apps/cli/src/deploy-engine/run.ts` — `runDirectDeployment(opts) → Promise<DirectRunResult>` orchestrates `runDeployment` with stdout/JSONL hooks.
- `apps/cli/src/deploy-engine/report.ts` — formatter for human + `--json` output of a terminal `DirectRunResult`.
- `apps/cli/src/deploy-engine/locate-platform-blueprint.ts` — return absolute path of bundled `dist/platform-blueprint/`.
- `apps/cli/src/commands/deploy.ts` — top-level `rntme deploy <blueprint-dir> --target <file>` command.
- `apps/cli/src/commands/platform/up.ts` — `rntme platform up --target <file>` command.
- `apps/cli/src/commands/platform/down.ts` — `rntme platform down --target <file>` command.
- `apps/cli/scripts/copy-platform-blueprint.cjs` — postbuild copy of `apps/platform/blueprint/{pdm,services,project.json}` to `apps/cli/dist/platform-blueprint/`.
- `apps/cli/test/helpers/docker-available.ts` — port of `apps/platform-http/test/e2e/docker-available.ts` for testcontainer gating.
- `apps/cli/test/unit/deploy-engine/load-target.test.ts`
- `apps/cli/test/unit/deploy-engine/load-secrets.test.ts`
- `apps/cli/test/unit/deploy-engine/to-deploy-core-input.test.ts`
- `apps/cli/test/unit/deploy-engine/run-hooks.test.ts`
- `apps/cli/test/unit/deploy-engine/locate-platform-blueprint.test.ts`
- `apps/cli/test/unit/commands/deploy-direct.test.ts`
- `apps/cli/test/unit/commands/platform-up.test.ts`
- `apps/cli/test/integration/deploy-direct-mode.test.ts` — Dokploy-testcontainer end-to-end; skipped when Docker unavailable.
- `apps/cli/test/integration/platform-up.test.ts` — Dokploy-testcontainer bootstrap test; skipped when Docker unavailable.
- `apps/cli/test/fixtures/target-dokploy.json` — sample direct-mode target file.

### Modified

- `apps/cli/package.json` — add deps `@rntme/deploy-runner`, `@rntme/deploy-core`, `@rntme/deploy-dokploy`, `@rntme/bindings-grpc`; add postbuild step calling `copy-platform-blueprint.cjs`.
- `apps/cli/src/bin/cli.ts` — register `deploy` and `platform` top-level commands; add USAGE entries; register help text via `registerHelp`.
- `apps/cli/src/errors/codes.ts` — add `CLI_DEPLOY_TARGET_FILE_INVALID`, `CLI_DEPLOY_SECRET_MISSING`, `CLI_DEPLOY_BLUEPRINT_INVALID`, `CLI_DEPLOY_PLATFORM_BLUEPRINT_NOT_BUNDLED`, `CLI_DEPLOY_TEARDOWN_FAILED` to the `CLI_ERROR_CODES` array.
- `apps/cli/README.md` — short section describing the three CLI modes and the target file format.
- `docs/current/owners/apps/cli.md` — update owner doc with `deploy-engine` overview and target-file shape.

### Not modified (verify, do not touch)

- `apps/platform-http/**` — untouched.
- `apps/platform/blueprint/**` — untouched (read-only consumer).
- `packages/deploy/**` — untouched. If a sub-task discovers a reusable refactor (e.g., a plain-token Dokploy client factory), keep it inside `apps/cli/src/deploy-engine/`; defer extraction.

## CLI Surface (target end state for this plan)

```text
rntme deploy <blueprint-dir>
    --target <file-path>          # required, JSON target file
    [--name <suffix>]             # appended to project slug (max 16 chars)
    [--dry-run]                   # plan + render only (no apply)
    [--json]                      # machine-readable output
    [--log-file <path>]           # also append JSONL evidence

rntme platform up    --target <file-path>  [--name <suffix>] [--dry-run] [--json] [--log-file <path>]
rntme platform down  --target <file-path>  [--json]
```

All three commands resolve secrets from `process.env` only (via `secrets[*].source: "env"`).

## Target File Format (direct mode)

```json
{
  "kind": "dokploy",
  "displayName": "preview",
  "config": {
    "dokployUrl": "https://dokploy.example.com",
    "dokployProjectId": "01HZ..."
  },
  "secrets": {
    "apiToken": { "source": "env", "name": "DOKPLOY_API_TOKEN" }
  },
  "eventBus": { "mode": "provisioned" },
  "publicBaseUrl": "https://preview.example.com"
}
```

`secrets[*].source` enum is `"env"` only in this plan. The validated, normalized target structurally matches `NormalizedDeployTarget` (alias for `DeployTargetForBuild` exported by `@rntme/deploy-runner`).

---

## Task 1: Add workspace dependencies and postbuild step

**Files:**
- Modify: `apps/cli/package.json`

- [ ] **Step 1: Add workspace deps to `apps/cli/package.json`**

Add to the `dependencies` block (alphabetical order with existing entries):

```json
"@rntme/bindings-grpc": "workspace:*",
"@rntme/deploy-core": "workspace:*",
"@rntme/deploy-dokploy": "workspace:*",
"@rntme/deploy-runner": "workspace:*",
```

- [ ] **Step 2: Update `postbuild` script to also copy platform blueprint**

Replace the `postbuild` line so it runs the existing skills copier and the new platform-blueprint copier sequentially:

```json
"postbuild": "bun -e \"const f='dist/bin/cli.js';const fs=require('fs');if(!fs.existsSync(f))process.exit(0);const s=fs.readFileSync(f,'utf8');if(!s.startsWith('#!'))fs.writeFileSync(f,'#!/usr/bin/env bun\\n'+s);fs.chmodSync(f,0o755);\" && bun scripts/copy-skills-assets.cjs && bun scripts/copy-platform-blueprint.cjs",
```

- [ ] **Step 3: Install + verify**

Run: `bun install --frozen-lockfile=false`
Expected: deps resolve; `bun.lock` updated.

- [ ] **Step 4: Commit**

```bash
git add apps/cli/package.json bun.lock
git commit -m "feat(cli): add deploy-runner deps and postbuild platform-blueprint copy hook"
```

## Task 2: Implement platform-blueprint copy script

**Files:**
- Create: `apps/cli/scripts/copy-platform-blueprint.cjs`

- [ ] **Step 1: Write the copy script**

```javascript
#!/usr/bin/env bun
/* eslint-env node */
const { cpSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const repoRoot = join(root, '..', '..');
const src = join(repoRoot, 'apps', 'platform', 'blueprint');
const dest = join(root, 'dist', 'platform-blueprint');

if (!existsSync(src)) {
  console.error(`platform blueprint source not found: ${src}`);
  process.exit(1);
}

cpSync(src, dest, {
  recursive: true,
  filter: (entry) => {
    const rel = entry.slice(src.length + 1);
    if (rel === 'node_modules' || rel.startsWith('node_modules/')) return false;
    if (rel === 'test' || rel.startsWith('test/')) return false;
    if (rel === 'dist' || rel.startsWith('dist/')) return false;
    return true;
  },
});
console.log(`copied ${src} → ${dest}`);
```

- [ ] **Step 2: Verify `bun run build` produces `dist/platform-blueprint/project.json`**

Run: `cd apps/cli && bun run build`
Expected: `apps/cli/dist/platform-blueprint/project.json` exists; `apps/cli/dist/platform-blueprint/services/app/service.json` exists.

- [ ] **Step 3: Commit**

```bash
git add apps/cli/scripts/copy-platform-blueprint.cjs
git commit -m "feat(cli): copy platform blueprint into CLI dist for offline platform up"
```

## Task 3: Define direct-mode error codes

**Files:**
- Modify: `apps/cli/src/errors/codes.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/cli/test/unit/errors/direct-mode-codes.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { CLI_ERROR_CODES } from '../../../src/errors/codes.js';

describe('direct-mode error codes', () => {
  it('exposes target-file, secret-missing, blueprint, bundle, and teardown codes', () => {
    expect(CLI_ERROR_CODES).toContain('CLI_DEPLOY_TARGET_FILE_INVALID');
    expect(CLI_ERROR_CODES).toContain('CLI_DEPLOY_SECRET_MISSING');
    expect(CLI_ERROR_CODES).toContain('CLI_DEPLOY_BLUEPRINT_INVALID');
    expect(CLI_ERROR_CODES).toContain('CLI_DEPLOY_PLATFORM_BLUEPRINT_NOT_BUNDLED');
    expect(CLI_ERROR_CODES).toContain('CLI_DEPLOY_TEARDOWN_FAILED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && bun test test/unit/errors/direct-mode-codes.test.ts`
Expected: FAIL — codes not present.

- [ ] **Step 3: Add the codes**

Edit `apps/cli/src/errors/codes.ts` and append five entries to `CLI_ERROR_CODES` (before the closing `] as const;`):

```ts
  'CLI_DEPLOY_TARGET_FILE_INVALID',
  'CLI_DEPLOY_SECRET_MISSING',
  'CLI_DEPLOY_BLUEPRINT_INVALID',
  'CLI_DEPLOY_PLATFORM_BLUEPRINT_NOT_BUNDLED',
  'CLI_DEPLOY_TEARDOWN_FAILED',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/cli && bun test test/unit/errors/direct-mode-codes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/errors/codes.ts apps/cli/test/unit/errors/direct-mode-codes.test.ts
git commit -m "feat(cli): add direct-mode deploy error codes"
```

## Task 4: Target file schema + loader

**Files:**
- Create: `apps/cli/src/deploy-engine/target-schema.ts`
- Create: `apps/cli/src/deploy-engine/load-target.ts`
- Create: `apps/cli/src/deploy-engine/types.ts`
- Create: `apps/cli/test/fixtures/target-dokploy.json`
- Test: `apps/cli/test/unit/deploy-engine/load-target.test.ts`

- [ ] **Step 1: Write target fixture**

`apps/cli/test/fixtures/target-dokploy.json`:

```json
{
  "kind": "dokploy",
  "displayName": "preview",
  "config": {
    "dokployUrl": "https://dokploy.example.com",
    "dokployProjectId": "01HZTESTPROJECTID000000"
  },
  "secrets": {
    "apiToken": { "source": "env", "name": "DOKPLOY_API_TOKEN" }
  },
  "eventBus": { "mode": "provisioned", "kind": "kafka", "provider": "redpanda" },
  "publicBaseUrl": "https://preview.example.com"
}
```

- [ ] **Step 2: Write the failing tests**

`apps/cli/test/unit/deploy-engine/load-target.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadTargetFile } from '../../../src/deploy-engine/load-target.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '..', '..', 'fixtures', 'target-dokploy.json');

describe('loadTargetFile', () => {
  it('parses a valid dokploy target file into a normalized target', async () => {
    const result = await loadTargetFile(fixturePath, 'preview');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.target.slug).toBe('preview');
      expect(result.value.target.kind).toBe('dokploy');
      expect(result.value.target.dokployUrl).toBe('https://dokploy.example.com');
      expect(result.value.secretRefs.apiToken.source).toBe('env');
      expect(result.value.secretRefs.apiToken.name).toBe('DOKPLOY_API_TOKEN');
    }
  });

  it('returns CLI_DEPLOY_TARGET_FILE_INVALID for missing file', async () => {
    const result = await loadTargetFile('/no/such/file.json', 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_DEPLOY_TARGET_FILE_INVALID');
  });

  it('rejects unknown kind', async () => {
    const result = await loadTargetFile(fixturePath, 'preview', {
      readFile: async () => JSON.stringify({ kind: 'mystery', displayName: 'x' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_DEPLOY_TARGET_FILE_INVALID');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/cli && bun test test/unit/deploy-engine/load-target.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `target-schema.ts`**

```ts
import { z } from 'zod';

const SecretRefSchema = z.object({
  source: z.literal('env'),
  name: z.string().min(1),
});

const DokployTargetFileSchema = z.object({
  kind: z.literal('dokploy'),
  displayName: z.string().min(1).max(120),
  config: z.object({
    dokployUrl: z.string().url(),
    dokployProjectId: z.string().min(1).optional(),
    dokployProjectName: z.string().min(1).optional(),
    allowCreateProject: z.boolean().optional(),
  }),
  secrets: z.object({
    apiToken: SecretRefSchema,
  }),
  eventBus: z
    .object({
      kind: z.literal('kafka').default('kafka'),
      mode: z.enum(['provisioned', 'external']),
      provider: z.literal('redpanda').optional(),
      brokers: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  publicBaseUrl: z.string().url().optional(),
});

export const TargetFileSchema = z.discriminatedUnion('kind', [DokployTargetFileSchema]);
export type TargetFile = z.infer<typeof TargetFileSchema>;
export type SecretRef = z.infer<typeof SecretRefSchema>;
```

- [ ] **Step 5: Implement `types.ts`**

```ts
import type { NormalizedDeployTarget } from '@rntme/deploy-runner';
import type { SecretRef } from './target-schema.js';

export type LoadedTarget = {
  readonly target: NormalizedDeployTarget;
  readonly secretRefs: { readonly apiToken: SecretRef; readonly extras: Readonly<Record<string, SecretRef>> };
};

export type LoadTargetDeps = {
  readonly readFile?: (path: string) => Promise<string>;
};
```

- [ ] **Step 6: Implement `load-target.ts`**

```ts
import { readFile as fsReadFile } from 'node:fs/promises';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';
import { TargetFileSchema } from './target-schema.js';
import type { LoadedTarget, LoadTargetDeps } from './types.js';

export async function loadTargetFile(
  path: string,
  slug: string,
  deps: LoadTargetDeps = {},
): Promise<Result<LoadedTarget, CliError>> {
  let raw: string;
  try {
    raw = await (deps.readFile ?? fsReadFile)(path, 'utf8');
  } catch (cause) {
    return err(
      cliError(
        'CLI_DEPLOY_TARGET_FILE_INVALID',
        `cannot read target file ${path}: ${String(cause)}`,
        undefined,
        cause,
      ),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    return err(
      cliError('CLI_DEPLOY_TARGET_FILE_INVALID', `target file ${path} is not valid JSON`, undefined, cause),
    );
  }

  const validated = TargetFileSchema.safeParse(parsed);
  if (!validated.success) {
    return err(
      cliError(
        'CLI_DEPLOY_TARGET_FILE_INVALID',
        `target file ${path} failed schema validation: ${validated.error.message}`,
        undefined,
        validated.error,
      ),
    );
  }

  const file = validated.data;
  if (file.kind === 'dokploy') {
    return ok({
      target: {
        id: `direct-${slug}`,
        slug,
        kind: 'dokploy',
        displayName: file.displayName,
        dokployUrl: file.config.dokployUrl,
        publicBaseUrl: file.publicBaseUrl ?? null,
        dokployProjectId: file.config.dokployProjectId ?? null,
        dokployProjectName: file.config.dokployProjectName ?? null,
        allowCreateProject: file.config.allowCreateProject ?? false,
        eventBus: file.eventBus ?? { kind: 'kafka', mode: 'external', brokers: ['localhost:9092'] },
        modules: {},
        workflows: null,
        storage: { mode: 'external' },
        auth: {},
        policyValues: {},
        manualAccess: {},
      } as never,
      secretRefs: { apiToken: file.secrets.apiToken, extras: {} },
    });
  }
  // unreachable — discriminated union exhausts kinds, but TypeScript needs the catch-all.
  return err(cliError('CLI_DEPLOY_TARGET_FILE_INVALID', 'unknown target kind'));
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/cli && bun test test/unit/deploy-engine/load-target.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add apps/cli/src/deploy-engine/target-schema.ts \
  apps/cli/src/deploy-engine/types.ts \
  apps/cli/src/deploy-engine/load-target.ts \
  apps/cli/test/fixtures/target-dokploy.json \
  apps/cli/test/unit/deploy-engine/load-target.test.ts
git commit -m "feat(cli): direct-mode target file schema and loader"
```

## Task 5: Env-var secret resolver

**Files:**
- Create: `apps/cli/src/deploy-engine/load-secrets.ts`
- Test: `apps/cli/test/unit/deploy-engine/load-secrets.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'bun:test';
import { resolveSecrets } from '../../../src/deploy-engine/load-secrets.js';

describe('resolveSecrets', () => {
  it('reads env-var refs into plaintext', () => {
    const env = { DOKPLOY_API_TOKEN: 'secret-token' };
    const result = resolveSecrets(
      { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' }, extras: {} },
      env,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.apiToken).toBe('secret-token');
      expect(result.value.extras).toEqual({});
    }
  });

  it('returns CLI_DEPLOY_SECRET_MISSING when env var is unset', () => {
    const result = resolveSecrets(
      { apiToken: { source: 'env', name: 'NOT_SET' }, extras: {} },
      {},
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CLI_DEPLOY_SECRET_MISSING');
      expect(result.error.message).toContain('NOT_SET');
    }
  });

  it('resolves extra secret refs into the extras map keyed by ref name', () => {
    const env = { CONSOLE_HTPASSWD: 'user:pw' };
    const result = resolveSecrets(
      {
        apiToken: { source: 'env', name: 'TOK' },
        extras: { redpanda_console_htpasswd: { source: 'env', name: 'CONSOLE_HTPASSWD' } },
      },
      { ...env, TOK: 't' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.extras['redpanda_console_htpasswd']).toBe('user:pw');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && bun test test/unit/deploy-engine/load-secrets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `load-secrets.ts`**

```ts
import type { ResolvedTargetSecrets } from '@rntme/deploy-runner';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';
import type { SecretRef } from './target-schema.js';

export type SecretRefMap = {
  readonly apiToken: SecretRef;
  readonly extras: Readonly<Record<string, SecretRef>>;
};

export function resolveSecrets(
  refs: SecretRefMap,
  env: Readonly<Record<string, string | undefined>>,
): Result<ResolvedTargetSecrets, CliError> {
  const apiToken = readEnv(refs.apiToken, env);
  if (apiToken === null) {
    return err(
      cliError('CLI_DEPLOY_SECRET_MISSING', `env var ${refs.apiToken.name} not set (required for apiToken)`),
    );
  }
  const extras: Record<string, string> = {};
  for (const [key, ref] of Object.entries(refs.extras)) {
    const value = readEnv(ref, env);
    if (value === null) {
      return err(cliError('CLI_DEPLOY_SECRET_MISSING', `env var ${ref.name} not set (required for ${key})`));
    }
    extras[key] = value;
  }
  return ok({ apiToken, extras });
}

function readEnv(ref: SecretRef, env: Readonly<Record<string, string | undefined>>): string | null {
  const value = env[ref.name];
  if (value === undefined || value === '') return null;
  return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/cli && bun test test/unit/deploy-engine/load-secrets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/deploy-engine/load-secrets.ts apps/cli/test/unit/deploy-engine/load-secrets.test.ts
git commit -m "feat(cli): direct-mode env-var secret resolver"
```

## Task 6: Port `toDeployCoreInput` into the engine

**Files:**
- Create: `apps/cli/src/deploy-engine/to-deploy-core-input.ts`
- Test: `apps/cli/test/unit/deploy-engine/to-deploy-core-input.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toDeployCoreInput } from '../../../src/deploy-engine/to-deploy-core-input.js';

function makeMinimalComposed(): {
  readonly project: { name: string; services: string[] };
  readonly services: Record<string, never>;
  readonly publicConfigJson: null;
  readonly varsManifest: Record<string, never>;
} {
  return {
    project: { name: 'demo', services: [] },
    services: {},
    publicConfigJson: null,
    varsManifest: {},
  };
}

describe('toDeployCoreInput', () => {
  it('passes through ComposedProjectInput shape unchanged when input already matches', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-deploy-engine-'));
    const input = makeMinimalComposed();
    const result = await toDeployCoreInput(input as never, dir);
    expect(result.name).toBe('demo');
    expect(result.services).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && bun test test/unit/deploy-engine/to-deploy-core-input.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `to-deploy-core-input.ts`**

Port the body of `toDeployCoreInput` (and its support helpers `bundleVirtualEntrySource`, `readWorkflowDefinitionFiles`, `workflowDefinitionPath`, `isSafeWorkflowFilePath`, `buildRuntimeArtifactFiles`, `runtimeModulesForService`, `addJsonFile`, `workflowGrpcServicesForProject`, `grpcPackageNameForService`, `grpcServiceNameForService`, `collectGrpcShapesFromService`, `IDENTITY_INTROSPECTION_PROTO`, `errorCode`, `isComposedBlueprint`) verbatim from `apps/platform-http/src/deploy/executor.ts` (lines covering the function and its dependencies). Preserve imports from `@rntme/bindings-grpc` and `@rntme/blueprint`. Export only `toDeployCoreInput`.

The verbatim port keeps platform and CLI on the same conversion logic for plan 2; plan 6 will centralize.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/cli && bun test test/unit/deploy-engine/to-deploy-core-input.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify typecheck**

Run: `cd apps/cli && bun run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/deploy-engine/to-deploy-core-input.ts apps/cli/test/unit/deploy-engine/to-deploy-core-input.test.ts
git commit -m "feat(cli): port ComposedBlueprint→ComposedProjectInput conversion into deploy-engine"
```

## Task 7: Blueprint loader for the engine

**Files:**
- Create: `apps/cli/src/deploy-engine/load-blueprint.ts`

- [ ] **Step 1: Write the failing test**

`apps/cli/test/unit/deploy-engine/load-blueprint.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { loadBlueprintForDeploy } from '../../../src/deploy-engine/load-blueprint.js';

describe('loadBlueprintForDeploy', () => {
  it('returns CLI_DEPLOY_BLUEPRINT_INVALID for a non-existent dir', async () => {
    const result = await loadBlueprintForDeploy('/no/such/dir');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_DEPLOY_BLUEPRINT_INVALID');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && bun test test/unit/deploy-engine/load-blueprint.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `load-blueprint.ts`**

```ts
import { loadComposedBlueprint } from '@rntme/blueprint';
import type { ComposedProjectInput } from '@rntme/deploy-core';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';
import { toDeployCoreInput } from './to-deploy-core-input.js';

export type LoadedBlueprint = {
  readonly composedBlueprint: ComposedProjectInput;
  readonly bundleDir: string;
};

export async function loadBlueprintForDeploy(dir: string): Promise<Result<LoadedBlueprint, CliError>> {
  const composed = await loadComposedBlueprint(dir);
  if (!composed.ok) {
    const first = composed.errors[0];
    return err(
      cliError(
        'CLI_DEPLOY_BLUEPRINT_INVALID',
        `failed to compose blueprint at ${dir}: ${first?.code ?? 'UNKNOWN'}: ${first?.message ?? ''}`,
        undefined,
        composed.errors,
      ),
    );
  }
  const projectInput = await toDeployCoreInput(composed.value, dir);
  return ok({ composedBlueprint: projectInput, bundleDir: dir });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/cli && bun test test/unit/deploy-engine/load-blueprint.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/deploy-engine/load-blueprint.ts apps/cli/test/unit/deploy-engine/load-blueprint.test.ts
git commit -m "feat(cli): direct-mode blueprint loader (compose + convert)"
```

## Task 8: Plain-token Dokploy client builder

**Files:**
- Create: `apps/cli/src/deploy-engine/dokploy-client.ts`
- Test: `apps/cli/test/unit/deploy-engine/dokploy-client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, mock } from 'bun:test';
import { buildPlainTokenDokployClient } from '../../../src/deploy-engine/dokploy-client.js';

describe('buildPlainTokenDokployClient', () => {
  it('issues GET requests with the x-api-key header set to the plaintext token', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const fetchMock = mock(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), headers: new Headers(init?.headers) });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const client = buildPlainTokenDokployClient('plaintext-tok', 'https://dokploy.example.com', fetchMock as never);
    await client.ensureEnvironment({ mode: 'use-existing', projectId: 'p1' } as never, 'production').catch(() => undefined);
    expect(calls[0]?.headers.get('x-api-key')).toBe('plaintext-tok');
    expect(calls[0]?.url).toContain('/api/project.all');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && bun test test/unit/deploy-engine/dokploy-client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `dokploy-client.ts`**

Adapt the inner closure of `createDokployClientFactory` from `packages/deploy/deploy-runner/src/dokploy-client-factory.ts`: drop the `cipher.decrypt` step, take `apiToken: string` directly, and return the same `DokployClient` shape. Reuse `normalizeDokployBaseUrl` from `@rntme/deploy-runner` (re-exported there). Skeleton:

```ts
import {
  normalizeDokployBaseUrl,
  type DokployResolvedTargetSecretMap,
} from '@rntme/deploy-runner';
import type { DokployClient } from '@rntme/deploy-dokploy';

export function buildPlainTokenDokployClient(
  apiToken: string,
  dokployUrl: string,
  httpFetch: typeof globalThis.fetch = globalThis.fetch,
  resolvedTargetSecrets?: DokployResolvedTargetSecretMap,
): DokployClient {
  const baseUrl = normalizeDokployBaseUrl(dokployUrl);
  const request = async <T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> => {
    const url =
      method === 'GET' && body
        ? `${baseUrl}${path}?${new URLSearchParams(body as Record<string, string>)}`
        : `${baseUrl}${path}`;
    const response = await httpFetch(url, {
      method,
      headers: { 'content-type': 'application/json', 'x-api-key': apiToken },
      ...(method === 'POST' && body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      throw new Error(`Dokploy request failed: ${response.status} ${await response.text()}`);
    }
    const text = await response.text();
    if (text.trim() === '') return {} as T;
    return JSON.parse(text) as T;
  };
  // Build the same DokployClient shape as createDokployClientFactory's inner closure.
  // Copy all method bodies from packages/deploy/deploy-runner/src/dokploy-client-factory.ts
  // (lines 144-…), substituting the request closure above. resolvedTargetSecrets is kept
  // for redpanda console htpasswd resolution — port that block verbatim.
  void resolvedTargetSecrets;
  return /* the constructed DokployClient */ {} as DokployClient;
}
```

The skeleton above is a sketch. The actual implementation must port every method body that the existing `createDokployClientFactory` inner closure builds (`ensureEnvironment`, `findApplicationByName`, `createApplication`, `updateApplication`, `findComposeByName`, `createCompose`, `updateCompose`, `applyCompose`, `inspectCompose`, …). Port them line-for-line, substituting the new `request` and `resolvedTargetSecrets` closure variables. Do not change behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/cli && bun test test/unit/deploy-engine/dokploy-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify typecheck**

Run: `cd apps/cli && bun run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/deploy-engine/dokploy-client.ts apps/cli/test/unit/deploy-engine/dokploy-client.test.ts
git commit -m "feat(cli): plain-token Dokploy client builder for direct-mode deploys"
```

## Task 9: Provisioner resolver

**Files:**
- Create: `apps/cli/src/deploy-engine/resolve-provisioner.ts`

- [ ] **Step 1: Write the failing test**

`apps/cli/test/unit/deploy-engine/resolve-provisioner.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCliResolveProvisioner } from '../../../src/deploy-engine/resolve-provisioner.js';

describe('createCliResolveProvisioner', () => {
  it('throws when the provisioner package cannot be resolved from bundleDir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-resolveprov-'));
    const resolve = createCliResolveProvisioner();
    await expect(resolve('definitely-not-installed', './provisioner.js', dir)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && bun test test/unit/deploy-engine/resolve-provisioner.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `resolve-provisioner.ts`**

```ts
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { ProvisionerContract, ResolveProvisioner } from '@rntme/deploy-runner';

export function createCliResolveProvisioner(): ResolveProvisioner {
  return async (packageName, entry, projectDir) => {
    const req = createRequire(`${projectDir}/package.json`);
    const resolved = req.resolve(`${packageName}/${entry}`.replace(/\\/g, '/'));
    const mod = (await import(pathToFileURL(resolved).href)) as { default?: ProvisionerContract } & ProvisionerContract;
    if (mod.default && typeof mod.default === 'object') return mod.default;
    return mod;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/cli && bun test test/unit/deploy-engine/resolve-provisioner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/deploy-engine/resolve-provisioner.ts apps/cli/test/unit/deploy-engine/resolve-provisioner.test.ts
git commit -m "feat(cli): direct-mode provisioner resolver via createRequire"
```

## Task 10: Bundled platform-blueprint locator

**Files:**
- Create: `apps/cli/src/deploy-engine/locate-platform-blueprint.ts`
- Test: `apps/cli/test/unit/deploy-engine/locate-platform-blueprint.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { locatePlatformBlueprint } from '../../../src/deploy-engine/locate-platform-blueprint.js';

describe('locatePlatformBlueprint', () => {
  it('returns a path to a bundled directory containing project.json after build', () => {
    const result = locatePlatformBlueprint();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(existsSync(`${result.value}/project.json`)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && bun run build && bun test test/unit/deploy-engine/locate-platform-blueprint.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `locate-platform-blueprint.ts`**

```ts
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';

export function locatePlatformBlueprint(): Result<string, CliError> {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/deploy-engine/locate-platform-blueprint.js → ../platform-blueprint
  // src/deploy-engine/locate-platform-blueprint.ts (unbuilt) → ../../../../apps/platform/blueprint
  const bundled = resolve(here, '..', 'platform-blueprint');
  if (existsSync(join(bundled, 'project.json'))) return ok(bundled);
  const fallback = resolve(here, '..', '..', '..', '..', 'platform', 'blueprint');
  if (existsSync(join(fallback, 'project.json'))) return ok(fallback);
  return err(
    cliError(
      'CLI_DEPLOY_PLATFORM_BLUEPRINT_NOT_BUNDLED',
      `bundled platform blueprint not found; expected ${bundled}/project.json`,
    ),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/cli && bun run build && bun test test/unit/deploy-engine/locate-platform-blueprint.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/deploy-engine/locate-platform-blueprint.ts apps/cli/test/unit/deploy-engine/locate-platform-blueprint.test.ts
git commit -m "feat(cli): locator for bundled platform blueprint artifacts"
```

## Task 11: Engine runner with stdout/JSONL hooks

**Files:**
- Create: `apps/cli/src/deploy-engine/run.ts`
- Create: `apps/cli/src/deploy-engine/report.ts`
- Test: `apps/cli/test/unit/deploy-engine/run-hooks.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, mock } from 'bun:test';
import { runDirectDeployment } from '../../../src/deploy-engine/run.js';

describe('runDirectDeployment hooks', () => {
  it('writes structured stage events to the provided stdout sink', async () => {
    const lines: string[] = [];
    const orchestrator = mock(async (inputs: Parameters<typeof import('@rntme/deploy-runner').runDeployment>[0]) => {
      await inputs.hooks?.onLog?.({ level: 'info', step: 'plan', message: 'planning' });
      await inputs.hooks?.onStageBegin?.('plan');
      await inputs.hooks?.onStageComplete?.('plan', { stage: 'plan', durationMs: 12 });
      await inputs.hooks?.onTerminal?.({ ok: true, kind: 'succeeded' });
      return { ok: true, kind: 'succeeded' as const };
    });
    const result = await runDirectDeployment({
      composedBlueprint: { name: 'demo' } as never,
      bundleDir: '/tmp/none',
      target: { slug: 'preview', kind: 'dokploy', dokployUrl: 'http://x' } as never,
      resolvedTargetSecrets: { apiToken: 'tok', extras: {} },
      orgSlug: 'direct',
      configOverrides: {},
      priorProvisionOutputs: {},
      resolveProvisioner: (() => undefined) as never,
      dokployClientFactory: (() => ({})) as never,
      stdout: { write: (s: string) => { lines.push(s); return true; } } as never,
      orchestrator: orchestrator as never,
    });
    expect(result.ok).toBe(true);
    expect(lines.some((l) => l.includes('plan'))).toBe(true);
    expect(lines.some((l) => l.includes('planning'))).toBe(true);
  });

  it('writes JSONL evidence when logFile is provided', async () => {
    const written: string[] = [];
    const result = await runDirectDeployment({
      composedBlueprint: { name: 'demo' } as never,
      bundleDir: '/tmp/none',
      target: { slug: 'preview', kind: 'dokploy', dokployUrl: 'http://x' } as never,
      resolvedTargetSecrets: { apiToken: 'tok', extras: {} },
      orgSlug: 'direct',
      configOverrides: {},
      priorProvisionOutputs: {},
      resolveProvisioner: (() => undefined) as never,
      dokployClientFactory: (() => ({})) as never,
      stdout: { write: () => true } as never,
      logFileWriter: (line: string) => { written.push(line); },
      orchestrator: (async (inputs: never) => {
        const i = inputs as Parameters<typeof import('@rntme/deploy-runner').runDeployment>[0];
        await i.hooks?.onLog?.({ level: 'info', step: 'plan', message: 'hi' });
        await i.hooks?.onTerminal?.({ ok: true, kind: 'succeeded' });
        return { ok: true, kind: 'succeeded' as const };
      }) as never,
    });
    expect(result.ok).toBe(true);
    expect(written.some((l) => JSON.parse(l).message === 'hi')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && bun test test/unit/deploy-engine/run-hooks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `report.ts`**

```ts
import type { TerminalResult } from '@rntme/deploy-runner';

export type DirectRunResult = {
  readonly target: string;
  readonly project: string;
  readonly terminal: TerminalResult;
};

export function renderHumanReport(r: DirectRunResult): string {
  if (r.terminal.ok) {
    return `✓ deployment succeeded\n  project:  ${r.project}\n  target:   ${r.target}`;
  }
  return [
    `✗ deployment failed`,
    `  project:  ${r.project}`,
    `  target:   ${r.target}`,
    `  code:     ${r.terminal.errorCode}`,
    `  message:  ${r.terminal.errorMessage}`,
  ].join('\n');
}
```

- [ ] **Step 4: Implement `run.ts`**

```ts
import {
  runDeployment as defaultRunDeployment,
  type DeploymentHooks,
  type RunDeploymentInputs,
  type SanitizedLogLine,
  type StageEvidence,
  type StageName,
  type TerminalResult,
} from '@rntme/deploy-runner';
import type { DirectRunResult } from './report.js';

export type DirectDeploymentInputs = Omit<RunDeploymentInputs, 'hooks'> & {
  readonly stdout: NodeJS.WritableStream;
  readonly logFileWriter?: (line: string) => void;
  readonly orchestrator?: typeof defaultRunDeployment;
  readonly orgSlug: string;
};

export async function runDirectDeployment(
  inputs: DirectDeploymentInputs,
): Promise<{ ok: true; result: DirectRunResult } | { ok: false; result: DirectRunResult }> {
  const orchestrator = inputs.orchestrator ?? defaultRunDeployment;
  let terminal: TerminalResult = { ok: false, kind: 'failed', errorCode: 'CLI_DEPLOY_NEVER_RAN', errorMessage: 'no terminal hook fired' };

  const writeJsonl = (event: Record<string, unknown>): void => {
    if (inputs.logFileWriter !== undefined) {
      inputs.logFileWriter(`${JSON.stringify(event)}\n`);
    }
  };

  const hooks: DeploymentHooks = {
    onLog: (line: SanitizedLogLine) => {
      inputs.stdout.write(`[${line.level}] ${line.step}: ${line.message}\n`);
      writeJsonl({ type: 'log', ...line });
    },
    onStageBegin: (stage: StageName) => {
      inputs.stdout.write(`▶ ${stage}\n`);
      writeJsonl({ type: 'stage-begin', stage });
    },
    onStageComplete: (stage: StageName, evidence: StageEvidence) => {
      inputs.stdout.write(`✓ ${stage} (${evidence.durationMs}ms)\n`);
      writeJsonl({ type: 'stage-complete', stage, durationMs: evidence.durationMs });
    },
    onProvisionResult: (envelope) => writeJsonl({ type: 'provision-result', ...envelope }),
    onApplyResult: (envelope) => writeJsonl({ type: 'apply-result', ...envelope }),
    onVerifyResult: (envelope) => writeJsonl({ type: 'verify-result', ...envelope }),
    onTerminal: (result) => {
      terminal = result;
      writeJsonl({ type: 'terminal', ok: result.ok, ...(result.ok ? {} : { errorCode: result.errorCode, errorMessage: result.errorMessage }) });
    },
  };

  const { stdout: _stdout, logFileWriter: _writer, orchestrator: _orchestrator, ...runnerInputs } = inputs;
  await orchestrator({ ...(runnerInputs as RunDeploymentInputs), hooks });

  const result: DirectRunResult = {
    target: inputs.target.slug ?? 'unknown',
    project: inputs.composedBlueprint.name,
    terminal,
  };
  return terminal.ok ? { ok: true, result } : { ok: false, result };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/cli && bun test test/unit/deploy-engine/run-hooks.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/deploy-engine/run.ts apps/cli/src/deploy-engine/report.ts apps/cli/test/unit/deploy-engine/run-hooks.test.ts
git commit -m "feat(cli): direct-mode runner with stdout + JSONL hooks"
```

## Task 12: `rntme deploy` command

**Files:**
- Create: `apps/cli/src/commands/deploy.ts`
- Test: `apps/cli/test/unit/commands/deploy-direct.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, mock } from 'bun:test';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDirectDeploy } from '../../../src/commands/deploy.js';

const fixture = {
  kind: 'dokploy',
  displayName: 'preview',
  config: { dokployUrl: 'https://dokploy.example.com', dokployProjectId: 'p1' },
  secrets: { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' } },
};

describe('rntme deploy (direct mode)', () => {
  it('returns CLI_DEPLOY_SECRET_MISSING when env var is not set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-deploy-cmd-'));
    const targetPath = join(dir, 'target.json');
    writeFileSync(targetPath, JSON.stringify(fixture));
    delete process.env['DOKPLOY_API_TOKEN'];
    const exit = await runDirectDeploy({ blueprintDir: dir, targetPath, json: true, quiet: true });
    expect(exit).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && bun test test/unit/commands/deploy-direct.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `commands/deploy.ts`**

```ts
import { basename } from 'node:path';
import { createWriteStream } from 'node:fs';
import { isOk } from '../result.js';
import { exitCodeFor } from '../errors/exit.js';
import { formatFailure, formatSuccess, toFailureOutput } from '../output/format.js';
import type { OutputMode } from '../output/format.js';
import { loadTargetFile } from '../deploy-engine/load-target.js';
import { resolveSecrets } from '../deploy-engine/load-secrets.js';
import { loadBlueprintForDeploy } from '../deploy-engine/load-blueprint.js';
import { buildPlainTokenDokployClient } from '../deploy-engine/dokploy-client.js';
import { createCliResolveProvisioner } from '../deploy-engine/resolve-provisioner.js';
import { runDirectDeployment } from '../deploy-engine/run.js';
import { renderHumanReport } from '../deploy-engine/report.js';

export type DirectDeployArgs = {
  readonly blueprintDir: string;
  readonly targetPath: string;
  readonly name?: string | undefined;
  readonly dryRun?: boolean | undefined;
  readonly json?: boolean | undefined;
  readonly quiet?: boolean | undefined;
  readonly logFile?: string | undefined;
};

export async function runDirectDeploy(args: DirectDeployArgs): Promise<number> {
  const mode: OutputMode = args.json ? 'json' : 'human';
  const slug = basename(args.targetPath, '.json');

  const target = await loadTargetFile(args.targetPath, slug);
  if (!isOk(target)) return emitFailure(mode, target.error);

  const secrets = resolveSecrets(target.value.secretRefs, process.env);
  if (!isOk(secrets)) return emitFailure(mode, secrets.error);

  const blueprint = await loadBlueprintForDeploy(args.blueprintDir);
  if (!isOk(blueprint)) return emitFailure(mode, blueprint.error);

  const logStream = args.logFile === undefined ? null : createWriteStream(args.logFile, { flags: 'a' });
  const result = await runDirectDeployment({
    composedBlueprint: blueprint.value.composedBlueprint,
    bundleDir: blueprint.value.bundleDir,
    target: target.value.target,
    resolvedTargetSecrets: secrets.value,
    orgSlug: 'direct',
    configOverrides: args.dryRun ? { dryRun: true } : {},
    priorProvisionOutputs: {},
    resolveProvisioner: createCliResolveProvisioner(),
    dokployClientFactory: (apiToken, extras) =>
      buildPlainTokenDokployClient(apiToken, target.value.target.dokployUrl, globalThis.fetch, extras),
    stdout: process.stdout,
    ...(logStream === null ? {} : { logFileWriter: (line: string) => { logStream.write(line); } }),
  });
  logStream?.end();

  if (!args.quiet) {
    const out = result.ok
      ? formatSuccess(mode, result.result, renderHumanReport)
      : formatFailure(mode, { code: 'CLI_DEPLOY_FAILED', message: renderHumanReport(result.result) });
    (result.ok ? process.stdout : process.stderr).write(out + '\n');
  }
  return result.ok ? 0 : 10;
}

function emitFailure(mode: OutputMode, error: { code: string; message: string }): number {
  process.stderr.write(formatFailure(mode, toFailureOutput(error as never)) + '\n');
  return exitCodeFor(error.code as never);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/cli && bun test test/unit/commands/deploy-direct.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/commands/deploy.ts apps/cli/test/unit/commands/deploy-direct.test.ts
git commit -m "feat(cli): rntme deploy direct-mode command"
```

## Task 13: `rntme platform up` and `down` commands

**Files:**
- Create: `apps/cli/src/commands/platform/up.ts`
- Create: `apps/cli/src/commands/platform/down.ts`
- Test: `apps/cli/test/unit/commands/platform-up.test.ts`
- Test: `apps/cli/test/unit/commands/platform-down.test.ts`

- [ ] **Step 1: Write the failing test for `platform up`**

```ts
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPlatformUp } from '../../../src/commands/platform/up.js';

const fixture = {
  kind: 'dokploy',
  displayName: 'preview',
  config: { dokployUrl: 'https://dokploy.example.com', dokployProjectId: 'p1' },
  secrets: { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' } },
};

describe('rntme platform up', () => {
  it('uses the bundled platform blueprint dir, then delegates to deploy', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-platform-up-'));
    const targetPath = join(dir, 'target.json');
    writeFileSync(targetPath, JSON.stringify(fixture));
    delete process.env['DOKPLOY_API_TOKEN'];
    const exit = await runPlatformUp({ targetPath, json: true, quiet: true });
    // bundled blueprint exists post-build but secrets are missing → exit 2
    expect(exit).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && bun run build && bun test test/unit/commands/platform-up.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `commands/platform/up.ts`**

```ts
import { isOk } from '../../result.js';
import { exitCodeFor } from '../../errors/exit.js';
import { formatFailure, toFailureOutput } from '../../output/format.js';
import { locatePlatformBlueprint } from '../../deploy-engine/locate-platform-blueprint.js';
import { runDirectDeploy, type DirectDeployArgs } from '../deploy.js';

export type PlatformUpArgs = Omit<DirectDeployArgs, 'blueprintDir'>;

export async function runPlatformUp(args: PlatformUpArgs): Promise<number> {
  const located = locatePlatformBlueprint();
  if (!isOk(located)) {
    process.stderr.write(formatFailure(args.json ? 'json' : 'human', toFailureOutput(located.error as never)) + '\n');
    return exitCodeFor(located.error.code);
  }
  return runDirectDeploy({ ...args, blueprintDir: located.value });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/cli && bun run build && bun test test/unit/commands/platform-up.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `platform down` test**

```ts
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPlatformDown } from '../../../src/commands/platform/down.js';

const fixture = {
  kind: 'dokploy',
  displayName: 'preview',
  config: { dokployUrl: 'https://dokploy.example.com', dokployProjectId: 'p1' },
  secrets: { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' } },
};

describe('rntme platform down', () => {
  it('returns CLI_DEPLOY_SECRET_MISSING when env var is not set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-platform-down-'));
    const targetPath = join(dir, 'target.json');
    writeFileSync(targetPath, JSON.stringify(fixture));
    delete process.env['DOKPLOY_API_TOKEN'];
    const exit = await runPlatformDown({ targetPath, json: true, quiet: true });
    expect(exit).toBe(2);
  });
});
```

- [ ] **Step 6: Implement `commands/platform/down.ts`**

```ts
import { isOk } from '../../result.js';
import { exitCodeFor } from '../../errors/exit.js';
import { formatFailure, toFailureOutput } from '../../output/format.js';
import { runTearDownsForDeployment } from '@rntme/deploy-runner';
import { locatePlatformBlueprint } from '../../deploy-engine/locate-platform-blueprint.js';
import { loadTargetFile } from '../../deploy-engine/load-target.js';
import { resolveSecrets } from '../../deploy-engine/load-secrets.js';
import { loadBlueprintForDeploy } from '../../deploy-engine/load-blueprint.js';
import { createCliResolveProvisioner } from '../../deploy-engine/resolve-provisioner.js';
import { cliError } from '../../errors/codes.js';
import { basename } from 'node:path';
import type { OutputMode } from '../../output/format.js';

export type PlatformDownArgs = {
  readonly targetPath: string;
  readonly json?: boolean | undefined;
  readonly quiet?: boolean | undefined;
};

export async function runPlatformDown(args: PlatformDownArgs): Promise<number> {
  const mode: OutputMode = args.json ? 'json' : 'human';
  const slug = basename(args.targetPath, '.json');

  const target = await loadTargetFile(args.targetPath, slug);
  if (!isOk(target)) return emitFailure(mode, target.error);

  const secrets = resolveSecrets(target.value.secretRefs, process.env);
  if (!isOk(secrets)) return emitFailure(mode, secrets.error);

  const located = locatePlatformBlueprint();
  if (!isOk(located)) return emitFailure(mode, located.error);

  const blueprint = await loadBlueprintForDeploy(located.value);
  if (!isOk(blueprint)) return emitFailure(mode, blueprint.error);

  const teardown = await runTearDownsForDeployment({
    bundleDir: blueprint.value.bundleDir,
    priorProvisionPublic: {},
    priorProvisionSecrets: {},
    deps: { resolveProvisioner: createCliResolveProvisioner() },
  });

  if (!teardown.ok) {
    const error = cliError(
      'CLI_DEPLOY_TEARDOWN_FAILED',
      `teardown failed: ${teardown.errors.map((e) => e.message).join('; ')}`,
    );
    return emitFailure(mode, error);
  }

  if (!args.quiet) process.stdout.write('✓ teardown complete\n');
  return 0;
}

function emitFailure(mode: OutputMode, error: { code: string; message: string }): number {
  process.stderr.write(formatFailure(mode, toFailureOutput(error as never)) + '\n');
  return exitCodeFor(error.code as never);
}
```

- [ ] **Step 7: Run both tests**

Run: `cd apps/cli && bun run build && bun test test/unit/commands/platform-up.test.ts test/unit/commands/platform-down.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/cli/src/commands/platform apps/cli/test/unit/commands/platform-up.test.ts apps/cli/test/unit/commands/platform-down.test.ts
git commit -m "feat(cli): rntme platform up/down commands"
```

## Task 14: Wire commands into the CLI dispatcher

**Files:**
- Modify: `apps/cli/src/bin/cli.ts`

- [ ] **Step 1: Write the failing test**

`apps/cli/test/unit/cli-direct-mode-help.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cliPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'bin', 'cli.js');

describe('rntme deploy/platform usage', () => {
  it('lists `deploy` in the top-level USAGE', () => {
    const result = spawnSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('deploy <blueprint-dir>');
    expect(result.stdout).toContain('platform up');
    expect(result.stdout).toContain('platform down');
  });

  it('errors with usage when `deploy` is given without --target', () => {
    const result = spawnSync(process.execPath, [cliPath, 'deploy', '/tmp/x'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--target');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && bun run build && bun test test/unit/cli-direct-mode-help.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `bin/cli.ts`**

Add imports near the top (after the other command imports):

```ts
import { runDirectDeploy } from '../commands/deploy.js';
import { runPlatformUp } from '../commands/platform/up.js';
import { runPlatformDown } from '../commands/platform/down.js';
```

Add `parseArgs` options entries (alongside the existing flags):

```ts
        'log-file': { type: 'string' },
        name: { type: 'string' },
```

Register help (next to existing `registerHelp` calls):

```ts
registerHelp(['deploy'], `Usage: rntme deploy <blueprint-dir> --target <file>
  [--name <suffix>] [--dry-run] [--json] [--log-file <path>]

Deploys a blueprint directly without the platform server. Reads target config from a JSON file.`);

registerHelp(['platform', 'up'], `Usage: rntme platform up --target <file>
  [--name <suffix>] [--dry-run] [--json] [--log-file <path>]

Deploys the bundled rntme-platform blueprint to the given target.`);

registerHelp(['platform', 'down'], `Usage: rntme platform down --target <file> [--json]

Tears down the rntme-platform stack on the given target.`);
```

Update `USAGE`: insert new lines under the `Commands:` block, between `bundle publish` and `project create`:

```text
  deploy <blueprint-dir>  Deploy any blueprint directly (no platform required)
  platform up             Bootstrap rntme-platform onto a target
  platform down           Tear down rntme-platform on a target
```

Add new `case` branches inside the `switch (cmd)` block:

```ts
    case 'deploy': {
      const blueprintDir = positionals[1];
      const targetPath = asString(values['target']);
      if (!blueprintDir || !targetPath) {
        process.stderr.write('Usage: rntme deploy <blueprint-dir> --target <file>\n');
        return 1;
      }
      const dArgs: Parameters<typeof runDirectDeploy>[0] = { blueprintDir, targetPath };
      setIfDefined(dArgs, 'name', asString(values['name']));
      setIfDefined(dArgs, 'dryRun', asBool(values['dry-run']));
      setIfDefined(dArgs, 'json', asBool(values['json']));
      setIfDefined(dArgs, 'quiet', asBool(values['quiet']));
      setIfDefined(dArgs, 'logFile', asString(values['log-file']));
      return runDirectDeploy(dArgs);
    }

    case 'platform': {
      const sub = positionals[1];
      if (!sub) {
        process.stderr.write('Usage: rntme platform <up|down> ...\n');
        return 1;
      }
      switch (sub) {
        case 'up': {
          const targetPath = asString(values['target']);
          if (!targetPath) {
            process.stderr.write('Usage: rntme platform up --target <file>\n');
            return 1;
          }
          const upArgs: Parameters<typeof runPlatformUp>[0] = { targetPath };
          setIfDefined(upArgs, 'name', asString(values['name']));
          setIfDefined(upArgs, 'dryRun', asBool(values['dry-run']));
          setIfDefined(upArgs, 'json', asBool(values['json']));
          setIfDefined(upArgs, 'quiet', asBool(values['quiet']));
          setIfDefined(upArgs, 'logFile', asString(values['log-file']));
          return runPlatformUp(upArgs);
        }
        case 'down': {
          const targetPath = asString(values['target']);
          if (!targetPath) {
            process.stderr.write('Usage: rntme platform down --target <file>\n');
            return 1;
          }
          const downArgs: Parameters<typeof runPlatformDown>[0] = { targetPath };
          setIfDefined(downArgs, 'json', asBool(values['json']));
          setIfDefined(downArgs, 'quiet', asBool(values['quiet']));
          return runPlatformDown(downArgs);
        }
        default: {
          process.stderr.write(`Unknown platform subcommand: ${sub}\n`);
          process.stderr.write('Usage: rntme platform <up|down> ...\n');
          return 2;
        }
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/cli && bun run build && bun test test/unit/cli-direct-mode-help.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Re-run the existing CLI usage test**

Run: `cd apps/cli && bun test test/unit/cli.test.ts`
Expected: PASS — must not regress on existing assertions.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/bin/cli.ts apps/cli/test/unit/cli-direct-mode-help.test.ts
git commit -m "feat(cli): wire deploy and platform commands into top-level dispatcher"
```

## Task 15: Docker availability helper for integration tests

**Files:**
- Create: `apps/cli/test/helpers/docker-available.ts`

- [ ] **Step 1: Port the helper**

```ts
import { spawnSync } from 'node:child_process';

let cached: boolean | undefined;

export function dockerAvailable(): boolean {
  if (process.env['SKIP_TESTCONTAINERS'] === '1') return false;
  if (cached !== undefined) return cached;
  const info = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (info.status !== 0) {
    cached = false;
    return cached;
  }
  const run = spawnSync('docker', ['run', '--rm', 'hello-world'], { stdio: 'ignore' });
  cached = run.status === 0;
  return cached;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/cli/test/helpers/docker-available.ts
git commit -m "test(cli): add docker-available helper for integration suite gating"
```

## Task 16: Direct-mode integration test against Dokploy testcontainer

**Files:**
- Create: `apps/cli/test/integration/deploy-direct-mode.test.ts`

- [ ] **Step 1: Write the integration test**

The test should:
1. Skip when `dockerAvailable()` is false.
2. Boot a Dokploy testcontainer (mirror the harness pattern from `apps/platform-http/test/e2e/harness.ts`; if a shared helper exists in `packages/deploy/deploy-runner/test/fixtures`, reuse it directly).
3. Use the existing `apps/cli/test/fixtures/bundle/` blueprint (or copy a tiny inline one) as the target blueprint dir.
4. Set `DOKPLOY_API_TOKEN` env var to the testcontainer token.
5. Spawn `dist/bin/cli.js deploy <bp> --target <fixture>`.
6. Assert exit code 0; assert stdout contains `▶ plan` and `✓ verify`.

Concrete skeleton:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dockerAvailable } from '../helpers/docker-available.js';

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = join(here, '..', '..', 'dist', 'bin', 'cli.js');

const describeOrSkip = dockerAvailable() ? describe : describe.skip;

describeOrSkip('rntme deploy <bp> --target <file> (direct mode)', () => {
  let dokployBaseUrl: string;
  let dokployToken: string;
  // start Dokploy testcontainer; capture base url + token
  beforeAll(async () => {
    // TODO: reuse the harness from platform-http/test/e2e/harness.ts.
    // If unavailable, leave a TODO and skip the suite when env vars are absent.
  });
  afterAll(async () => {
    // teardown
  });

  it('deploys notes-blueprint successfully', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cli-direct-e2e-'));
    const targetPath = join(tmp, 'target.json');
    writeFileSync(targetPath, JSON.stringify({
      kind: 'dokploy',
      displayName: 'e2e',
      config: { dokployUrl: dokployBaseUrl, dokployProjectName: 'cli-e2e', allowCreateProject: true },
      secrets: { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' } },
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
    }));
    const result = spawnSync(process.execPath, [cliPath, 'deploy', join(here, '..', 'fixtures', 'bundle'), '--target', targetPath], {
      encoding: 'utf8',
      env: { ...process.env, DOKPLOY_API_TOKEN: dokployToken },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('▶ plan');
    expect(result.stdout).toContain('✓ verify');
  });
});
```

If the Dokploy harness is not yet ready outside `platform-http`, mark the test `describe.skip` with a `// TODO(plan-2): wire harness from platform-http or provide shared one` and add a unit-level integration test that mocks the orchestrator instead. The plan succeeds either way as long as the suite is wired and runs (skipped if needed).

- [ ] **Step 2: Run**

Run: `cd apps/cli && bun run build && bun test test/integration/deploy-direct-mode.test.ts`
Expected: PASS or skipped (when Docker unavailable).

- [ ] **Step 3: Commit**

```bash
git add apps/cli/test/integration/deploy-direct-mode.test.ts
git commit -m "test(cli): integration test for direct-mode deploy against Dokploy"
```

## Task 17: Platform-up integration test

**Files:**
- Create: `apps/cli/test/integration/platform-up.test.ts`

- [ ] **Step 1: Write the integration test**

Mirror the structure from Task 16 but invoke `cli platform up`. Assert stdout contains `▶ plan` and the platform stack appears in Dokploy.

```ts
// Skipped when Docker unavailable — same gating as direct-mode test.
// Asserts that `rntme platform up --target <file>` exits 0 and the platform
// app/compose appears via the Dokploy admin API.
```

- [ ] **Step 2: Run + commit**

Run: `cd apps/cli && bun run build && bun test test/integration/platform-up.test.ts`
Expected: PASS or skipped.

```bash
git add apps/cli/test/integration/platform-up.test.ts
git commit -m "test(cli): integration test for rntme platform up"
```

## Task 18: Update README and owner doc

**Files:**
- Modify: `apps/cli/README.md`
- Modify: `docs/current/owners/apps/cli.md`

- [ ] **Step 1: Append to `apps/cli/README.md`**

Add a "Direct-mode and platform bootstrap" section that describes:
- The three CLI modes (direct, platform-client, platform-bootstrap).
- The `rntme deploy <bp> --target <file>` form with a one-block example.
- The target file shape (copy from this plan's `Target File Format`).
- The `rntme platform up/down` commands.

Keep it ≤40 lines. No marketing copy.

- [ ] **Step 2: Update `docs/current/owners/apps/cli.md`**

Add subsections covering:
- `src/deploy-engine/` purpose and module layout.
- `dist/platform-blueprint/` bundling: where it comes from, how `locatePlatformBlueprint` resolves it.
- The three error codes added in this plan.

- [ ] **Step 3: Commit**

```bash
git add apps/cli/README.md docs/current/owners/apps/cli.md
git commit -m "docs(cli): direct-mode and platform-bootstrap documentation"
```

## Task 19: Final green-build verification

- [ ] **Step 1: Run all checks from repo root**

Run (sequentially):

```bash
bun run build
bun run typecheck
bun run lint
bun run test
bun run depcruise
```

Expected: every command exits 0.

- [ ] **Step 2: Run CLI-only test buckets**

```bash
bun run --filter @rntme/cli test
bun run --filter @rntme/cli test:e2e
```

Expected: PASS or skipped (e2e skipped when Docker is not available locally).

- [ ] **Step 3: Smoke-test the binary manually**

```bash
node apps/cli/dist/bin/cli.js --help        # contains deploy, platform up, platform down
node apps/cli/dist/bin/cli.js deploy --help # prints the registered help
node apps/cli/dist/bin/cli.js platform up --help
node apps/cli/dist/bin/cli.js platform down --help
```

Each should exit 0 and print the expected usage block.

- [ ] **Step 4: Final commit (if any docs/lint cleanup needed)**

```bash
git add -p
git commit -m "chore(cli): post-direct-mode lint/typecheck cleanup"
```

(Skip this step if there is nothing to commit.)

---

## Self-Review Checklist (run before declaring complete)

- All five new error codes from Task 3 are imported and used somewhere.
- `to-deploy-core-input.ts` lives in `apps/cli/src/deploy-engine/` (not `packages/deploy/`); confirms `bun run depcruise` stays clean (apps/ is exempt from the deploy→runtime ban).
- The `DirectDeploymentInputs` type's `composed`, `bundleDir`, `target`, `resolvedTargetSecrets`, `orgSlug`, `configOverrides`, `priorProvisionOutputs`, `resolveProvisioner`, `dokployClientFactory` field names match `RunDeploymentInputs` exactly (Task 11).
- Existing `apps/cli/test/unit/cli.test.ts` still passes — its assertion list does not include `deploy` or `platform`, so it must not be broken.
- `dist/platform-blueprint/` exists post-build and contains `project.json`, `services/`, and `pdm/`.
- The `runDirectDeploy` command's exit code mapping: 0 success, 2 for `CLI_DEPLOY_*` validation errors, 10 for runtime deploy failure — matches the existing `exitCodeFor` table for these codes.
- `rntme login`, `rntme project deploy`, `rntme target list` still work (platform-client mode is untouched).

If any check fails, fix inline.

---

## Plan Complete — Execution Handoff

Plan saved to `docs/superpowers/plans/2026-05-10-cli-direct-mode.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
