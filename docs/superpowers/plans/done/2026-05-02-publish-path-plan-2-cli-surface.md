# Publish-Path Hardening — Plan 2: CLI Surface

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-02-publish-path-end-to-end-hardening-design.md` §7, §9

**Goal:** Make the rntme CLI sufficient for an operator to publish, deploy, watch, manage targets, and diagnose without ever touching the platform UI. Tighten error UX, add the missing flags, fix the version string, surface human-readable references, and add a helpful 404 for project-scoped target requests.

**Architecture:** Three components landed in order: (1) client-side CLI plumbing (defaults from credentials, per-subcommand `--help`, UUID validation, `--version`, `--wait`, `--runtime-image`, `--config-overrides`); (2) API denormalization (`projectVersionSeq` + `targetSlug` on deployment responses) consumed by the CLI; (3) target management commands + project-scoped 404 helper. Most tasks are TDD slices on isolated files.

**Tech Stack:** TypeScript, Vitest, Node `parseArgs`, Zod for response schemas, esbuild define for build-time constants.

---

## File Structure

**Create:**
- `apps/cli/src/commands/target/list.ts` — `rntme target list` command
- `apps/cli/src/commands/target/show.ts` — `rntme target show <slug>` command
- `apps/cli/src/commands/target/set-config.ts` — `rntme target set-config <slug> --json <path>` command
- `apps/cli/src/api/target-endpoints.ts` — typed endpoints for org-scoped targets
- `apps/cli/src/help/registry.ts` — per-subcommand help registry + lookup
- `apps/cli/src/util/uuid.ts` — UUID arg validator
- `apps/cli/src/util/version.ts` — single source for the CLI version constant (esbuild-injected)
- `apps/cli/scripts/inject-version.cjs` — postbuild helper that rewrites `dist/util/version.js` to the package.json version
- `apps/cli/test/unit/help-registry.test.ts`
- `apps/cli/test/unit/uuid.test.ts`
- `apps/cli/test/unit/target-list.test.ts`
- `apps/cli/test/unit/target-show.test.ts`
- `apps/cli/test/unit/target-set-config.test.ts`
- `apps/cli/test/unit/deployment-watch-exit.test.ts`
- `apps/cli/test/unit/deploy-flags.test.ts`
- `apps/cli/test/unit/version.test.ts`
- `apps/cli/test/unit/defaults-from-credentials.test.ts`

**Modify:**
- `apps/cli/src/bin/cli.ts` — register subcommand help, target commands, version path, deploy flags
- `apps/cli/src/config/credentials.ts` — add `defaultOrg?: string` to schema; `login` writes it
- `apps/cli/src/config/resolve.ts` — fall back to `credentials.defaultOrg` when `--org` and project config lack it
- `apps/cli/src/commands/login.ts` — fetch `whoami` after token save, write `defaultOrg`
- `apps/cli/src/commands/project/deploy.ts` — accept `--runtime-image`, `--config-overrides`, `--wait`, `--timeout`
- `apps/cli/src/commands/project/deployment-show.ts` — UUID validation; verify summary lines
- `apps/cli/src/commands/project/deployment-watch.ts` — final summary print (errorCode/errorMessage/verify summary), reuse for `--wait`
- `apps/cli/src/commands/project/deployment-list.ts` — print `seq` and `targetSlug` when present, drop UUIDs from human output
- `apps/cli/src/api/types.ts` — add `projectVersionSeq` and `targetSlug` to `DeploymentResponseSchema` and list schema
- `apps/cli/package.json` — `bin` map unchanged; tsconfig/build picks up version injection
- `apps/platform-http/src/routes/deployments.ts` (or current file) — populate `projectVersionSeq` and `targetSlug` in response
- `apps/platform-http/src/routes/deploy-targets.ts` (or new file) — register helpful 404 for project-scoped path
- `apps/platform-http/src/routes/_register.ts` — wire 404 handler

**Test:** see "Create" entries.

---

## Component A — Defaults from credentials, per-subcommand help, UUID validation, `--version`

### Task A.1: Default org from credentials

**Files:**
- Modify: `apps/cli/src/config/credentials.ts`, `apps/cli/src/config/resolve.ts`, `apps/cli/src/commands/login.ts`
- Create: `apps/cli/test/unit/defaults-from-credentials.test.ts`

- [ ] **Step 1: Add `defaultOrg` to credentials schema**

In `credentials.ts`, replace the `ProfileSchema`:

```ts
const ProfileSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().regex(/^rntme_pat_[a-zA-Z0-9]{22}$/),
  addedAt: z.string().datetime(),
  defaultOrg: z.string().optional(),
});
```

- [ ] **Step 2: Read `defaultOrg` in `resolveConfig`**

In `resolve.ts`, change:

```ts
const org = input.flags.org ?? input.projectConfig?.org ?? input.credentials?.profiles[profileName]?.defaultOrg ?? null;
```

(Use `profileName` resolved earlier in the same function.)

- [ ] **Step 3: Write the failing test**

`apps/cli/test/unit/defaults-from-credentials.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/config/resolve.js';

describe('resolveConfig defaultOrg', () => {
  it('uses credentials.defaultOrg when --org and project config absent', () => {
    const r = resolveConfig({
      flags: {},
      env: {},
      projectConfig: null,
      credentials: {
        version: 1,
        defaultProfile: 'default',
        profiles: {
          default: {
            baseUrl: 'https://x',
            token: 'rntme_pat_abcdefghijklmnopqrstuv',
            addedAt: '2026-05-02T00:00:00.000Z',
            defaultOrg: 'my-org',
          },
        },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.org).toBe('my-org');
  });

  it('--org wins over credentials default', () => {
    const r = resolveConfig({
      flags: { org: 'flag-org' },
      env: {},
      projectConfig: null,
      credentials: {
        version: 1,
        defaultProfile: 'default',
        profiles: {
          default: {
            baseUrl: 'https://x',
            token: 'rntme_pat_abcdefghijklmnopqrstuv',
            addedAt: '2026-05-02T00:00:00.000Z',
            defaultOrg: 'cred-org',
          },
        },
      },
    });
    if (r.ok) expect(r.value.org).toBe('flag-org');
  });
});
```

- [ ] **Step 4: Run test, expect PASS** (the resolve change above already makes it pass)

Run: `pnpm -F @rntme/cli vitest run test/unit/defaults-from-credentials.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `login` to fetch and write `defaultOrg`**

In `login.ts`, after the credentials are written, call `endpoints.whoami` with the new token and update the profile's `defaultOrg` from the response. Keep the change minimal — fail-soft if whoami errors (write the credentials anyway, just without `defaultOrg`).

- [ ] **Step 6: Run full CLI tests**

Run: `pnpm -F @rntme/cli test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/cli/src/config apps/cli/src/commands/login.ts apps/cli/test/unit/defaults-from-credentials.test.ts
git commit -m "feat(cli): default org from credentials profile"
```

### Task A.2: Per-subcommand `--help`

**Files:**
- Create: `apps/cli/src/help/registry.ts`, `apps/cli/test/unit/help-registry.test.ts`
- Modify: `apps/cli/src/bin/cli.ts`

- [ ] **Step 1: Write the failing test**

`apps/cli/test/unit/help-registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lookupHelp, registerHelp } from '../../src/help/registry.js';

describe('help registry', () => {
  it('returns the registered help for a subcommand path', () => {
    registerHelp(['project', 'deploy'], 'Usage: rntme project deploy --version <seq> --target <slug>');
    expect(lookupHelp(['project', 'deploy'])).toContain('--version');
  });

  it('returns null for an unregistered path', () => {
    expect(lookupHelp(['totally', 'unknown'])).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm -F @rntme/cli vitest run test/unit/help-registry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement registry**

`apps/cli/src/help/registry.ts`:

```ts
const REGISTRY = new Map<string, string>();

const key = (path: readonly string[]): string => path.join('');

export function registerHelp(path: readonly string[], usage: string): void {
  REGISTRY.set(key(path), usage);
}

export function lookupHelp(path: readonly string[]): string | null {
  return REGISTRY.get(key(path)) ?? null;
}
```

- [ ] **Step 4: Register usage for each subcommand**

In `bin/cli.ts`, near the imports add:

```ts
import { registerHelp, lookupHelp } from '../help/registry.js';

registerHelp(['project', 'deploy'], `Usage: rntme project deploy --org <slug> --project <slug> --version <seq> --target <target-slug>
  [--runtime-image <ref>] [--config-overrides <path.json>] [--wait] [--timeout <sec>]

Starts a platform deployment of a previously published version against a deploy target.`);

registerHelp(['project', 'publish'], `Usage: rntme project publish [--org <slug>] [--project <slug>] [--dry-run] [folder]

Validates and uploads the project blueprint as a new version. Folder defaults to current directory.`);

registerHelp(['project', 'deployment', 'list'], `Usage: rntme project deployment list --org <slug> --project <slug> [--limit <n>]`);
registerHelp(['project', 'deployment', 'show'], `Usage: rntme project deployment show --org <slug> --project <slug> <deployment-id>`);
registerHelp(['project', 'deployment', 'watch'], `Usage: rntme project deployment watch --org <slug> --project <slug> <deployment-id>`);
registerHelp(['target', 'list'], `Usage: rntme target list [--org <slug>]`);
registerHelp(['target', 'show'], `Usage: rntme target show <slug> [--org <slug>] [--unredacted]`);
registerHelp(['target', 'set-config'], `Usage: rntme target set-config <slug> --json <path> [--org <slug>]`);
```

- [ ] **Step 5: Dispatch `--help` to subcommand registry**

In `bin/cli.ts`, before the global help fallback when `--help` is set, look up the subcommand path from positional args:

```ts
if (parsed.values.help === true) {
  const cmdPath: string[] = parsed.positionals; // e.g. ['project', 'deploy']
  const sub = lookupHelp(cmdPath);
  if (sub !== null) {
    process.stdout.write(sub + '\n');
    return 0;
  }
  process.stdout.write(USAGE);
  return 0;
}
```

- [ ] **Step 6: Run tests, expect PASS**

Run: `pnpm -F @rntme/cli vitest run test/unit/help-registry.test.ts`
Expected: PASS.

- [ ] **Step 7: End-to-end check**

Build CLI: `pnpm -F @rntme/cli build`
Run: `node apps/cli/dist/bin/cli.js project deploy --help`
Expected: deploy-specific usage block.

- [ ] **Step 8: Commit**

```bash
git add apps/cli/src/help apps/cli/src/bin/cli.ts apps/cli/test/unit/help-registry.test.ts
git commit -m "feat(cli): per-subcommand --help"
```

### Task A.3: UUID arg validation

**Files:**
- Create: `apps/cli/src/util/uuid.ts`, `apps/cli/test/unit/uuid.test.ts`
- Modify: `apps/cli/src/commands/project/deployment-show.ts`, `apps/cli/src/commands/project/deployment-watch.ts`
- Modify: `apps/cli/src/errors/codes.ts` — add `CLI_VALIDATE_NOT_UUID`
- Modify: `apps/cli/src/errors/exit.ts` — map to exit `6`

- [ ] **Step 1: Add the error code**

In `apps/cli/src/errors/codes.ts`, add `CLI_VALIDATE_NOT_UUID` to the union/enum. In `exit.ts`, ensure the `CLI_VALIDATE_*` family maps to exit `6`.

- [ ] **Step 2: Write failing tests**

`apps/cli/test/unit/uuid.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateUuid } from '../../src/util/uuid.js';

describe('validateUuid', () => {
  it('accepts a v4 UUID', () => {
    const r = validateUuid('5db540dd-3706-4b74-b7b6-27ca43f9b458', 'deployment-id');
    expect(r.ok).toBe(true);
  });

  it('rejects a truncated id with CLI_VALIDATE_NOT_UUID', () => {
    const r = validateUuid('5db540dd-37', 'deployment-id');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CLI_VALIDATE_NOT_UUID');
  });
});
```

- [ ] **Step 3: Implement**

`apps/cli/src/util/uuid.ts`:

```ts
import { ok, err, type Result } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUuid(value: string, argName: string): Result<string, CliError> {
  if (UUID_RE.test(value)) return ok(value);
  return err(cliError('CLI_VALIDATE_NOT_UUID', `${argName} must be a UUID; got "${value}"`));
}
```

- [ ] **Step 4: Apply in deployment-show and deployment-watch**

In each command, validate the deployment-id before any HTTP call:

```ts
const id = validateUuid(args.deploymentId, '<deployment-id>');
if (!id.ok) return id;
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `pnpm -F @rntme/cli vitest run test/unit/uuid.test.ts test/unit/deployment-show.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/util/uuid.ts apps/cli/src/commands/project/deployment-{show,watch}.ts apps/cli/src/errors apps/cli/test/unit/uuid.test.ts
git commit -m "feat(cli): client-side UUID validation for deployment id args"
```

### Task A.4: Real `--version` from package.json

**Files:**
- Create: `apps/cli/src/util/version.ts`, `apps/cli/scripts/inject-version.cjs`, `apps/cli/test/unit/version.test.ts`
- Modify: `apps/cli/src/bin/cli.ts`, `apps/cli/package.json`

- [ ] **Step 1: Write the version module**

`apps/cli/src/util/version.ts`:

```ts
// Replaced at build time by scripts/inject-version.cjs.
export const CLI_VERSION = '__CLI_VERSION__';
```

- [ ] **Step 2: Use it in cli.ts**

In `bin/cli.ts`, replace `readVersion()` body with:

```ts
import { CLI_VERSION } from '../util/version.js';
function readVersion(): string { return CLI_VERSION; }
```

- [ ] **Step 3: Write the postbuild injector**

`apps/cli/scripts/inject-version.cjs`:

```cjs
const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const target = path.join(__dirname, '..', 'dist', 'util', 'version.js');
const src = fs.readFileSync(target, 'utf8');
fs.writeFileSync(target, src.replace('__CLI_VERSION__', pkg.version));
```

- [ ] **Step 4: Wire postbuild**

In `apps/cli/package.json`, append to the `postbuild` script:

```
&& node scripts/inject-version.cjs
```

(Concatenate with existing postbuild chain.)

- [ ] **Step 5: Bump package version**

In `apps/cli/package.json`, change `"version": "0.0.0"` to `"version": "0.1.0"` (or whichever number the project uses for first real release; pick a non-zero).

- [ ] **Step 6: Write the test**

`apps/cli/test/unit/version.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CLI_VERSION } from '../../src/util/version.js';
import pkg from '../../package.json' assert { type: 'json' };

describe('CLI_VERSION', () => {
  // Pre-build: source has placeholder; post-build (CI), it equals pkg.version.
  it('is the placeholder OR matches package.json#version', () => {
    expect([(pkg as { version: string }).version, '__CLI_VERSION__']).toContain(CLI_VERSION);
  });
});
```

- [ ] **Step 7: Build + run + assert end-to-end**

```bash
pnpm -F @rntme/cli build
node apps/cli/dist/bin/cli.js --version
```
Expected: prints the package.json version (e.g. `0.1.0`), not `0.0.0`, not `__CLI_VERSION__`.

- [ ] **Step 8: Commit**

```bash
git add apps/cli/src/util/version.ts apps/cli/scripts/inject-version.cjs apps/cli/src/bin/cli.ts apps/cli/package.json apps/cli/test/unit/version.test.ts
git commit -m "feat(cli): inject real version from package.json at build"
```

---

## Component B — Deploy flags + watch summary + exit codes

### Task B.1: `project deploy --runtime-image` + `--config-overrides`

**Files:**
- Modify: `apps/cli/src/commands/project/deploy.ts`, `apps/cli/src/bin/cli.ts`
- Create: `apps/cli/test/unit/deploy-flags.test.ts`

- [ ] **Step 1: Extend the args type**

In `deploy.ts`:

```ts
export type ProjectDeployArgs = {
  readonly version: number;
  readonly target: string;
  readonly runtimeImage?: string | undefined;
  readonly configOverridesPath?: string | undefined;
  readonly wait?: boolean | undefined;
  readonly timeoutSec?: number | undefined;
};
```

Build `configOverrides` from the two flags before calling `endpoints.deployments.start`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let configOverrides: Record<string, unknown> = {};
if (args.configOverridesPath) {
  const raw = readFileSync(resolve(process.cwd(), args.configOverridesPath), 'utf8');
  configOverrides = JSON.parse(raw) as Record<string, unknown>;
}
if (args.runtimeImage) configOverrides.runtimeImage = args.runtimeImage;
```

- [ ] **Step 2: Wire flags in `bin/cli.ts`**

In the `parseArgs` options, add:

```ts
'runtime-image': { type: 'string' },
'config-overrides': { type: 'string' },
wait: { type: 'boolean' },
timeout: { type: 'string' },
```

In the deploy dispatcher, pass values into `ProjectDeployArgs`. Convert `--timeout` to a number; default 300 when `--wait` is set.

- [ ] **Step 3: Test**

`apps/cli/test/unit/deploy-flags.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runProjectDeploy } from '../../src/commands/project/deploy.js';

vi.mock('../../src/api/endpoints.js', () => ({
  endpoints: {
    deployments: {
      start: vi.fn(async (_ctx, _org, _project, body) => ({ ok: true, value: { deployment: { id: 'd', status: 'queued', queuedAt: '2026-05-02T00:00:00Z' } }, ...body })),
    },
  },
}));

describe('project deploy flags', () => {
  it('sends runtime-image as configOverrides.runtimeImage', async () => {
    const exit = await runProjectDeploy(
      { version: 4, target: 't', runtimeImage: 'ghcr.io/x:tag' },
      { org: 'o', project: 'p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never,
    );
    expect(exit).toBe(0);
    const start = (await import('../../src/api/endpoints.js')).endpoints.deployments.start as unknown as { mock: { calls: unknown[][] } };
    const body = start.mock.calls.at(-1)?.[3] as { configOverrides: Record<string, unknown> };
    expect(body.configOverrides.runtimeImage).toBe('ghcr.io/x:tag');
  });
});
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `pnpm -F @rntme/cli vitest run test/unit/deploy-flags.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/commands/project/deploy.ts apps/cli/src/bin/cli.ts apps/cli/test/unit/deploy-flags.test.ts
git commit -m "feat(cli): --runtime-image and --config-overrides on project deploy"
```

### Task B.2: `project deploy --wait` reuses watch

**Files:**
- Modify: `apps/cli/src/commands/project/deploy.ts`, `apps/cli/src/commands/project/deployment-watch.ts`

- [ ] **Step 1: Extract a watch loop function**

In `deployment-watch.ts`, factor the polling body into:

```ts
export async function watchUntilTerminal(opts: {
  apiCtx: ApiCtx; org: string; project: string; deploymentId: string; pollIntervalMs?: number; timeoutMs?: number; printLogs?: boolean;
}): Promise<Result<DeploymentResponse, ClientError | CliError>> { … }
```

Move the existing `while (true)` loop into the function. Keep the existing `runProjectDeploymentWatch` thin: call `watchUntilTerminal` then return its result.

- [ ] **Step 2: Use it from deploy when `--wait`**

In `deploy.ts`, after the platform returns the queued response:

```ts
if (args.wait) {
  const final = await watchUntilTerminal({
    apiCtx, org, project,
    deploymentId: queued.value.deployment.id,
    timeoutMs: (args.timeoutSec ?? 300) * 1000,
    printLogs: flags.json !== true && flags.quiet !== true,
  });
  return final; // exit code mapped by successExitCode below
}
```

- [ ] **Step 3: Map exit codes when waiting**

In `deploy.ts`, override `successExitCode` so that with `--wait` the same mapping as watch applies (succeeded→0, succeeded_with_warnings→1, else→10). Without `--wait`, exit 0 after queued.

- [ ] **Step 4: Test**

Add a wait scenario to `deploy-flags.test.ts`:

```ts
it('with --wait, exits 10 when terminal status is failed', async () => {
  // mock endpoints.deployments.show to return failed
});
```

- [ ] **Step 5: Run + commit**

Run: `pnpm -F @rntme/cli vitest run test/unit/deploy-flags.test.ts`
Expected: PASS.

```bash
git add apps/cli/src/commands/project
git commit -m "feat(cli): --wait flag on project deploy reuses watch loop"
```

### Task B.3: Watch prints final summary (errorCode/errorMessage/verify)

**Files:**
- Modify: `apps/cli/src/commands/project/deployment-watch.ts`
- Create: `apps/cli/test/unit/deployment-watch-exit.test.ts`

- [ ] **Step 1: Replace `humanRender`**

```ts
humanRender: (d) => {
  const dep = d.deployment;
  const lines: string[] = [`deployment ${dep.id} ${dep.status}`];
  if (dep.errorCode) lines.push(`  error:    ${dep.errorCode}`);
  if (dep.errorMessage) lines.push(`  message:  ${dep.errorMessage}`);
  if (dep.verificationReport) {
    const checks = dep.verificationReport.checks ?? [];
    const failed = checks.filter((c) => !c.ok);
    lines.push(`  verify:   ${dep.verificationReport.ok ? 'ok' : 'failed'}; ${checks.length} checks; ${failed.length} failed`);
    if (failed[0]) lines.push(`  first fail: ${failed[0].name} -> ${failed[0].status}`);
  }
  return lines.join('\n');
},
```

- [ ] **Step 2: Write the test**

`apps/cli/test/unit/deployment-watch-exit.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

describe('deployment watch summary + exit codes', () => {
  it('prints errorCode and exits 10 on failed', async () => {
    // mock endpoints.deployments.show to return { deployment: { status: 'failed', errorCode: 'DEPLOY_PLAN_TARGET_VAR_MISSING', errorMessage: '...' } } and logs empty
    // run runProjectDeploymentWatch
    // assert process exit code 10 and stdout contains 'DEPLOY_PLAN_TARGET_VAR_MISSING'
  });

  it('exits 0 on succeeded', async () => { /* … */ });
  it('exits 1 on succeeded_with_warnings', async () => { /* … */ });
});
```

(Use the testing pattern from existing CLI tests — mock the `endpoints.deployments` module and check the captured exit code returned by `runProjectDeploymentWatch`.)

- [ ] **Step 3: Run tests, expect PASS**

Run: `pnpm -F @rntme/cli vitest run test/unit/deployment-watch-exit.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/commands/project/deployment-watch.ts apps/cli/test/unit/deployment-watch-exit.test.ts
git commit -m "feat(cli): final-state summary for deployment watch"
```

---

## Component C — API denormalization + CLI consume

### Task C.1: API exposes `projectVersionSeq` + `targetSlug`

**Files:**
- Modify: `apps/platform-http/src/routes/deployments.ts` (or current path; `grep -rn "GET.*deployments" apps/platform-http/src`)
- Modify: `packages/platform/platform-core/src/...` — schema for response if shared
- Modify: `apps/cli/src/api/types.ts` — add fields to schema

- [ ] **Step 1: Locate the deployment response builder**

Run: `grep -rn "queuedAt" apps/platform-http/src --include='*.ts' | head`

- [ ] **Step 2: Add denormalized fields**

In the response shape, after `targetId`:

```ts
projectVersionSeq: number; // joined from project_versions
targetSlug: string;        // joined from deploy_targets
```

In the SQL/repo query (look for the deployment-by-id and list-by-project queries), add a join to fetch `project_versions.seq` as `projectVersionSeq` and `deploy_targets.slug` as `targetSlug`. Map them into the response.

- [ ] **Step 3: Update the API schema in CLI**

In `apps/cli/src/api/types.ts`, add:

```ts
projectVersionSeq: z.number().int().nonnegative(),
targetSlug: z.string().min(1),
```

to `DeploymentResponseSchema` and the list-item schema.

- [ ] **Step 4: Update list output**

In `deployment-list.ts`, change the `humanRender` columns to print `seq` and `targetSlug`:

```
SEQ  TARGET            STATUS     QUEUED                    FINISHED                
4    dokploy-demos     succeeded  2026-05-02T15:00:00.000Z  2026-05-02T15:01:00.000Z
```

(ID stays only in `--json`.)

- [ ] **Step 5: Update show output**

In `deployment-show.ts`, print `version: <seq>` and `target: <slug>` instead of UUIDs.

- [ ] **Step 6: Add tests**

Update `apps/cli/test/unit/deployment-list.test.ts` (or create) to assert columns include `SEQ` and `TARGET <slug>`. Update existing fixture mocks to include `projectVersionSeq` and `targetSlug`.

- [ ] **Step 7: Run typecheck + tests across both packages**

```bash
pnpm -F @rntme/cli test
pnpm -F @rntme/platform-http test
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/platform-http/src apps/cli/src/api apps/cli/src/commands/project/deployment-{list,show}.ts apps/cli/test
git commit -m "feat(cli,platform): denormalize projectVersionSeq + targetSlug on deployment responses"
```

---

## Component D — Target management commands + helpful 404

### Task D.1: API endpoints client (`apps/cli/src/api/target-endpoints.ts`)

**Files:**
- Create: `apps/cli/src/api/target-endpoints.ts`
- Modify: `apps/cli/src/api/endpoints.ts` — add `targets:` namespace re-export

- [ ] **Step 1: Implement endpoints**

```ts
import { z } from 'zod';
import type { ApiContext } from './client.js';
import { request } from './client.js';

export const TargetSchema = z.object({
  id: z.string(),
  slug: z.string(),
  displayName: z.string().nullable(),
  kind: z.string(),
  publicBaseUrl: z.string().nullable(),
  isDefault: z.boolean(),
  apiTokenRedacted: z.string().optional(),
  auth: z.record(z.string(), z.unknown()).optional(),
  modules: z.record(z.string(), z.unknown()).optional(),
  eventBus: z.record(z.string(), z.unknown()).optional(),
});

export const TargetsResponseSchema = z.object({ targets: z.array(TargetSchema) });
export const TargetResponseSchema = z.object({ target: TargetSchema });

export type Target = z.infer<typeof TargetSchema>;

export const targetEndpoints = {
  list: async (ctx: ApiContext, org: string) =>
    request(TargetsResponseSchema, ctx, 'GET', `/v1/orgs/${encodeURIComponent(org)}/deploy-targets`),
  show: async (ctx: ApiContext, org: string, slug: string, opts: { unredacted?: boolean }) =>
    request(TargetResponseSchema, ctx, 'GET', `/v1/orgs/${encodeURIComponent(org)}/deploy-targets/${encodeURIComponent(slug)}${opts.unredacted ? '?unredacted=true' : ''}`),
  setConfig: async (ctx: ApiContext, org: string, slug: string, body: Record<string, unknown>) =>
    request(TargetResponseSchema, ctx, 'PATCH', `/v1/orgs/${encodeURIComponent(org)}/deploy-targets/${encodeURIComponent(slug)}/config`, body),
};
```

- [ ] **Step 2: Re-export**

In `endpoints.ts`, add `targets: targetEndpoints` to the `endpoints` object.

- [ ] **Step 3: Commit**

```bash
git add apps/cli/src/api
git commit -m "feat(cli): typed endpoints for org-scoped deploy targets"
```

### Task D.2: `rntme target list`

**Files:**
- Create: `apps/cli/src/commands/target/list.ts`, `apps/cli/test/unit/target-list.test.ts`
- Modify: `apps/cli/src/bin/cli.ts`

- [ ] **Step 1: Test**

`apps/cli/test/unit/target-list.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/endpoints.js', () => ({
  endpoints: {
    targets: {
      list: vi.fn(async () => ({ ok: true, value: { targets: [{ id: 'a', slug: 's1', displayName: 'X', kind: 'dokploy', publicBaseUrl: null, isDefault: false }] } })),
    },
  },
}));

describe('rntme target list', () => {
  it('renders SLUG / DISPLAY NAME columns', async () => {
    const { runTargetList } = await import('../../src/commands/target/list.js');
    const exit = await runTargetList({}, { org: 'o', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never);
    expect(exit).toBe(0);
  });
});
```

- [ ] **Step 2: Implement**

`apps/cli/src/commands/target/list.ts`:

```ts
import { endpoints } from '../../api/endpoints.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';

export type TargetListArgs = Record<string, never>;

export async function runTargetList(_args: TargetListArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: { targets: Array<{ slug: string; displayName: string | null; kind: string; isDefault: boolean }> }) => {
        const header = 'SLUG'.padEnd(28) + 'DISPLAY NAME'.padEnd(32) + 'KIND'.padEnd(12) + 'DEFAULT';
        const rows = d.targets.map((t) =>
          (t.slug.padEnd(28) + (t.displayName ?? '—').padEnd(32) + t.kind.padEnd(12) + (t.isDefault ? 'yes' : '—'))
        );
        return [header, ...rows].join('\n');
      },
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      return endpoints.targets.list({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org);
    },
  );
}
```

- [ ] **Step 3: Wire dispatcher**

In `bin/cli.ts`, add a `target list` branch in the command switch.

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/commands/target/list.ts apps/cli/src/bin/cli.ts apps/cli/test/unit/target-list.test.ts
git commit -m "feat(cli): rntme target list"
```

### Task D.3: `rntme target show`

**Files:**
- Create: `apps/cli/src/commands/target/show.ts`, `apps/cli/test/unit/target-show.test.ts`
- Modify: `apps/cli/src/bin/cli.ts`

- [ ] **Step 1: Test (succeeds with redacted display by default)**

```ts
// asserts: when --unredacted not passed, output omits secret-like fields
// when --unredacted passed, full target JSON appears
```

- [ ] **Step 2: Implement**

`apps/cli/src/commands/target/show.ts`:

```ts
import { endpoints } from '../../api/endpoints.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';

export type TargetShowArgs = { readonly slug: string; readonly unredacted?: boolean | undefined };

export async function runTargetShow(args: TargetShowArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: { target: Record<string, unknown> }) =>
        Object.entries(d.target).map(([k, v]) => `${k.padEnd(20)} ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('\n'),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      return endpoints.targets.show({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, args.slug, { unredacted: args.unredacted ?? false });
    },
  );
}
```

- [ ] **Step 3: Wire + commit**

```bash
git add apps/cli/src/commands/target/show.ts apps/cli/src/bin/cli.ts apps/cli/test/unit/target-show.test.ts
git commit -m "feat(cli): rntme target show"
```

### Task D.4: `rntme target set-config`

**Files:**
- Create: `apps/cli/src/commands/target/set-config.ts`, `apps/cli/test/unit/target-set-config.test.ts`
- Modify: `apps/cli/src/bin/cli.ts`
- Modify: `apps/platform-http/src/routes/deploy-targets.ts` (or wherever) to expose `PATCH /v1/orgs/:org/deploy-targets/:slug/config`

- [ ] **Step 1: Add the platform endpoint**

The handler accepts a JSON body `{ auth?, modules?, eventBus?, policyValues? }` and atomically replaces those blocks on the target row. Reject `apiToken` etc. with `400 PLATFORM_HTTP_FORBIDDEN_FIELD`. Require scope `deploy:target:manage`.

Add a unit test in `apps/platform-http/test/unit` against the route handler.

- [ ] **Step 2: Implement CLI command**

`apps/cli/src/commands/target/set-config.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { endpoints } from '../../api/endpoints.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';

export type TargetSetConfigArgs = { readonly slug: string; readonly jsonPath: string };

export async function runTargetSetConfig(args: TargetSetConfigArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: { target: { slug: string } }) => `✓ updated ${d.target.slug}`,
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(readFileSync(resolve(process.cwd(), args.jsonPath), 'utf8')) as Record<string, unknown>;
      } catch (e) {
        return err(cliError('CLI_VALIDATE_JSON_INVALID', `--json path could not be parsed: ${(e as Error).message}`));
      }
      return endpoints.targets.setConfig({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, args.slug, body);
    },
  );
}
```

- [ ] **Step 3: Wire dispatcher; require `--json <path>` arg**

- [ ] **Step 4: Tests + commit**

Run: `pnpm -F @rntme/cli test && pnpm -F @rntme/platform-http test`
Expected: PASS.

```bash
git add apps/cli/src/commands/target/set-config.ts apps/platform-http/src/routes apps/cli/src/bin/cli.ts apps/cli/test apps/platform-http/test
git commit -m "feat(cli,platform): rntme target set-config + PATCH endpoint"
```

### Task D.5: Helpful 404 for project-scoped target requests

**Files:**
- Modify: `apps/platform-http/src/routes/_register.ts` (or whichever handler-registration file)
- Add unit test in `apps/platform-http/test/unit`

- [ ] **Step 1: Register a 404 handler with hint**

For paths matching `^/v1/orgs/[^/]+/projects/[^/]+/deploy-targets`, respond:

```ts
return c.json({
  code: 'PLATFORM_HTTP_NOT_FOUND',
  message: 'deploy targets are org-scoped; use /v1/orgs/<org>/deploy-targets',
}, 404);
```

- [ ] **Step 2: Test**

```ts
it('returns helpful body for project-scoped deploy-targets', async () => {
  const r = await app.request('/v1/orgs/o/projects/p/deploy-targets', { method: 'GET', headers: { Authorization: 'Bearer pat' } });
  expect(r.status).toBe(404);
  const body = await r.json();
  expect(body.code).toBe('PLATFORM_HTTP_NOT_FOUND');
  expect(body.message).toMatch(/org-scoped/);
});
```

- [ ] **Step 3: Run + commit**

Run: `pnpm -F @rntme/platform-http test`
Expected: PASS.

```bash
git add apps/platform-http/src apps/platform-http/test
git commit -m "feat(platform): helpful 404 for project-scoped deploy-targets path"
```

---

## Self-Review Pass

- [ ] **Run full pipeline**

```bash
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
```

Expected: PASS.

- [ ] **Manual end-to-end check (against a non-prod org if possible)**

```bash
node apps/cli/dist/bin/cli.js --version           # not 0.0.0
node apps/cli/dist/bin/cli.js project deploy --help # subcommand help
node apps/cli/dist/bin/cli.js project list         # uses default org from credentials
node apps/cli/dist/bin/cli.js target list          # lists targets
```

- [ ] **Confirm no remaining hardcoded `0.0.0`**

Run: `grep -rn "0\.0\.0" apps/cli/src apps/cli/dist`
Expected: only in source `version.ts` placeholder line and the package.json (the dist/util/version.js should have the real version).
