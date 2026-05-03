# Publish-Path Hardening — Plan 2: CLI Surface

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-02-publish-path-end-to-end-hardening-design.md` §7, §9

**Goal:** Make the rntme CLI sufficient for an operator to publish, deploy, watch, manage targets, and diagnose without ever touching the platform UI. Tighten error UX, add the missing flags, fix the version string, surface human-readable references, and add a helpful 404 for project-scoped target requests.

**Architecture:** Three components landed in order: (1) client-side CLI plumbing (defaults from credentials, per-subcommand `--help`, UUID validation, `--version`, `--wait`, `--runtime-image`, `--config-overrides`); (2) API denormalization (`projectVersionSeq` + `targetSlug` on deployment responses) consumed by the CLI; (3) target management commands + project-scoped 404 helper. Most tasks are TDD slices on isolated files.

**Tech Stack:** TypeScript, Vitest, Node `parseArgs`, Zod for response schemas, `tsc` build output.

---

## PLAN Challenge Update (RNT-416)

This section supersedes conflicting task text below. It was added after reading current `main` (merge `bc54d37`) and checking current docs for Node `util.parseArgs`, Zod v4, and esbuild through Context7.

### Current-code corrections

- The CLI is now in `apps/cli` and already has `project deploy` plus `project deployment <list|show|watch>`. Plan 2 must harden those files, not recreate the initial deployment command surface from the older plan.
- `apps/cli/package.json` uses plain `tsc`, not esbuild. Do not introduce esbuild or a postbuild mutation script just to fix `--version`. The current `readVersion()` already reads `apps/cli/package.json`; the hardening slice is to set the package version to a non-`0.0.0` value and keep the existing build/spawn tests passing.
- Node `parseArgs` is a single global parse in `apps/cli/src/bin/cli.ts`. Keep `--version <seq>` for `project deploy`, but keep `-v` as global version only. Do not document or rely on `project deploy -v 4`.
- Zod v4 is installed. Match the existing code style in `apps/cli/src/api/types.ts` and `packages/platform/platform-core/src/schemas/*`; do not switch one-off files to a different Zod idiom unless the package already uses it.
- Target management must align with the existing platform API: `GET /v1/orgs/:org/deploy-targets`, `GET /v1/orgs/:org/deploy-targets/:targetSlug`, and `PATCH /v1/orgs/:org/deploy-targets/:targetSlug`. Do not add a new `/config` subroute unless a test proves the existing PATCH route cannot enforce the required contract.
- Remove `--unredacted` from `target show`. The platform stores Dokploy API tokens encrypted and currently returns only `apiTokenRedacted`. A CLI flag that implies secret recovery is misleading and unsafe. Operators can inspect editable config (`auth`, `modules`, `eventBus`, `policyValues`) without ever printing deploy-target API tokens.

### Acceptance clarifications for [DEV]

- Credential defaults cover both `defaultOrg` and `defaultProject`. Precedence is: explicit CLI flag > `RNTME_ORG` / `RNTME_PROJECT` env > local `rntme.json` > credentials profile default. This preserves local-project ergonomics while allowing operator-only CLI workflows.
- `login --token ... [--project <slug>]` writes `defaultOrg` from `GET /v1/auth/me` when that call succeeds. It writes `defaultProject` only from explicit `--project`; `whoami` does not currently return a project default. If `auth.me` fails, login still succeeds and stores the token without defaults.
- Deployment response denormalization belongs in platform-core/storage, not only in `apps/platform-http/src/routes/deployments.ts`. Update `DeploymentSchema`, `DeploymentRepo`, `PgDeploymentRepo`, use-case tests, HTTP e2e fixtures, and CLI schemas together. `PgDeploymentRepo.getById()` and `listByProject()` should join `project_version.seq AS project_version_seq` and `deploy_target.slug AS target_slug`; `create()` should return the same enriched shape either by selecting back through the joined query or by an equivalent join/subquery.
- `target set-config` accepts only `{ auth?, modules?, eventBus?, policyValues? }`, validates the local JSON before sending, then calls the existing PATCH deploy-target route. Reject forbidden keys such as `apiToken`, `dokployUrl`, `displayName`, `isDefault`, and `publicBaseUrl` client-side with `CLI_VALIDATE_LOCAL_FAILED` or a new specific `CLI_VALIDATE_CONFIG_FORBIDDEN_FIELD` mapped to exit `6`.
- Helpful 404 for `/v1/orgs/:org/projects/:project/deploy-targets` should be registered inside the authenticated `/v1` router in `apps/platform-http/src/app.ts` before generic project routes, with both exact and nested variants. Response body must use the standard error envelope: `{ "error": { "code": "PLATFORM_HTTP_NOT_FOUND", "message": "deploy targets are org-scoped; use /v1/orgs/<org>/deploy-targets" } }`.
- Live platform publish/deploy evidence is optional for this plan. If a DEV agent performs it, run `./scripts/agent-env-check.sh platform` first and use `RNTME_TOKEN` without printing it.

## File Structure

**Create:**
- `apps/cli/src/commands/target/list.ts` — `rntme target list` command
- `apps/cli/src/commands/target/show.ts` — `rntme target show <slug>` command
- `apps/cli/src/commands/target/set-config.ts` — `rntme target set-config <slug> --json <path>` command
- `apps/cli/src/help/registry.ts` — per-subcommand help registry + lookup
- `apps/cli/src/util/uuid.ts` — UUID arg validator
- `apps/cli/test/unit/help-registry.test.ts`
- `apps/cli/test/unit/uuid.test.ts`
- `apps/cli/test/unit/target-list.test.ts`
- `apps/cli/test/unit/target-show.test.ts`
- `apps/cli/test/unit/target-set-config.test.ts`
- `apps/cli/test/unit/deployment-watch-exit.test.ts`
- `apps/cli/test/unit/deploy-flags.test.ts`
- `apps/cli/test/unit/defaults-from-credentials.test.ts`

**Modify:**
- `apps/cli/src/bin/cli.ts` — register subcommand help, target commands, version path, deploy flags
- `apps/cli/src/api/endpoints.ts` — add `targets` namespace using the existing `apiCall` helper
- `apps/cli/src/api/types.ts` — add deploy-target schemas plus deployment `projectVersionSeq` / `targetSlug`
- `apps/cli/src/config/credentials.ts` — add `defaultOrg?: string`, `defaultProject?: string`
- `apps/cli/src/config/resolve.ts` — resolve org/project from flags, env, project config, then credential defaults
- `apps/cli/src/commands/login.ts` — fetch `auth.me` fail-soft, write `defaultOrg`; write `defaultProject` only from `--project`
- `apps/cli/src/commands/project/deploy.ts` — accept `--runtime-image`, `--config-overrides`, `--wait`, `--timeout`
- `apps/cli/src/commands/project/deployment-show.ts` — UUID validation; verify summary lines
- `apps/cli/src/commands/project/deployment-watch.ts` — final summary print (errorCode/errorMessage/verify summary), reuse for `--wait`
- `apps/cli/src/commands/project/deployment-list.ts` — print `seq` and `targetSlug` when present, drop UUIDs from human output
- `apps/cli/package.json` — set package version to a real non-zero version; keep existing `tsc` build
- `packages/platform/platform-core/src/schemas/deployment.ts` — add denormalized response fields
- `packages/platform/platform-core/src/repos/deployment-repo.ts` — update repo return type contract
- `packages/platform/platform-core/src/use-cases/deployments.ts` — return enriched deployments
- `packages/platform/platform-storage/src/repos/pg-deployment-repo.ts` — join project version seq + target slug
- `apps/platform-http/src/app.ts` — register helpful project-scoped deploy-target 404 before project routes
- `apps/platform-http/src/routes/deploy-targets.ts` — only if existing PATCH behavior needs a narrower config-only guard

**Test:** see "Create" entries.

---

## Component A — Defaults from credentials, per-subcommand help, UUID validation, `--version`

### Task A.1: Default org/project from credentials

**Files:**
- Modify: `apps/cli/src/config/credentials.ts`, `apps/cli/src/config/resolve.ts`, `apps/cli/src/commands/login.ts`
- Create: `apps/cli/test/unit/defaults-from-credentials.test.ts`

- [ ] **Step 1: Add credential defaults to the profile schema**

In `credentials.ts`, replace the `ProfileSchema`:

```ts
const ProfileSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().regex(/^rntme_pat_[a-zA-Z0-9]{22}$/),
  addedAt: z.string().datetime(),
  defaultOrg: z.string().optional(),
  defaultProject: z.string().optional(),
});
```

- [ ] **Step 2: Add tenancy env vars and read credential defaults in `resolveConfig`**

Extend `ResolveEnv`:

```ts
export type ResolveEnv = {
  RNTME_BASE_URL?: string | undefined;
  RNTME_TOKEN?: string | undefined;
  RNTME_PROFILE?: string | undefined;
  RNTME_ORG?: string | undefined;
  RNTME_PROJECT?: string | undefined;
  RNTME_SERVICE?: string | undefined;
};
```

In `resolve.ts`, change:

```ts
const org = input.flags.org ?? input.env.RNTME_ORG ?? input.projectConfig?.org ?? profile?.defaultOrg ?? null;
const project = input.flags.project ?? input.env.RNTME_PROJECT ?? input.projectConfig?.project ?? profile?.defaultProject ?? null;
const service = input.flags.service ?? input.env.RNTME_SERVICE ?? input.projectConfig?.service ?? null;
```

`profile` is already resolved near `profileName`; use it instead of re-indexing `credentials.profiles`.

- [ ] **Step 3: Write the failing test**

`apps/cli/test/unit/defaults-from-credentials.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/config/resolve.js';

describe('resolveConfig credential defaults', () => {
  it('uses credentials default org/project when flags, env, and project config are absent', () => {
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
            defaultProject: 'notes-demo',
          },
        },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.org).toBe('my-org');
      expect(r.value.project).toBe('notes-demo');
    }
  });

  it('flag and env values win over credentials defaults', () => {
    const r = resolveConfig({
      flags: { org: 'flag-org' },
      env: { RNTME_PROJECT: 'env-project' },
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
            defaultProject: 'cred-project',
          },
        },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.org).toBe('flag-org');
      expect(r.value.project).toBe('env-project');
    }
  });

  it('local project config wins over credential defaults when no flag/env is set', () => {
    const r = resolveConfig({
      flags: {},
      env: {},
      projectConfig: { org: 'file-org', project: 'file-project', service: 'app' },
      credentials: {
        version: 1,
        defaultProfile: 'default',
        profiles: {
          default: {
            baseUrl: 'https://x',
            token: 'rntme_pat_abcdefghijklmnopqrstuv',
            addedAt: '2026-05-02T00:00:00.000Z',
            defaultOrg: 'cred-org',
            defaultProject: 'cred-project',
          },
        },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.org).toBe('file-org');
      expect(r.value.project).toBe('file-project');
    }
  });
});
```

- [ ] **Step 4: Run test, expect PASS** (the resolve change above already makes it pass)

Run: `pnpm -F @rntme/cli vitest run test/unit/defaults-from-credentials.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `login` to fetch and write credential defaults**

In `login.ts`, add optional `project?: string` to `LoginFlags` and wire `--project` through `bin/cli.ts`. Before writing credentials, call `endpoints.auth.me({ baseUrl, token })` with the new token and set `defaultOrg` from `response.org.slug` when it succeeds. Set `defaultProject` only when `--project <slug>` was provided. Keep the call fail-soft: if `auth.me` errors, write the token anyway without `defaultOrg`.

- [ ] **Step 6: Run full CLI tests**

Run: `pnpm -F @rntme/cli test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/cli/src/config apps/cli/src/bin/cli.ts apps/cli/src/commands/login.ts apps/cli/test/unit/defaults-from-credentials.test.ts
git commit -m "feat(cli): default org and project from credentials profile"
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
registerHelp(['target', 'show'], `Usage: rntme target show <slug> [--org <slug>]`);
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
- Modify: `apps/cli/package.json`, `apps/cli/test/unit/cli.test.ts`

- [ ] **Step 1: Keep the current `tsc` version path**

Do not create `apps/cli/src/util/version.ts` or `apps/cli/scripts/inject-version.cjs`. Current `apps/cli/src/bin/cli.ts` reads `../../package.json` from the built `dist/bin/cli.js` location, and `apps/cli/package.json#files` already includes package metadata in package installs. The observed bug is the package version value, not the read path.

- [ ] **Step 2: Bump package version**

In `apps/cli/package.json`, change `"version": "0.0.0"` to `"version": "0.1.0"` (or whichever number the project uses for first real release; pick a non-zero).

- [ ] **Step 3: Strengthen the existing spawn test**

In `apps/cli/test/unit/cli.test.ts`, extend the existing `--version` and `-v` assertions:

```ts
expect(result.stdout.trim()).toBe(pkgVersion);
expect(result.stdout.trim()).not.toBe('0.0.0');
```

- [ ] **Step 4: Build + run + assert end-to-end**

```bash
pnpm -F @rntme/cli build
node apps/cli/dist/bin/cli.js --version
```
Expected: prints the package.json version (e.g. `0.1.0`), not `0.0.0`.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/package.json apps/cli/test/unit/cli.test.ts
git commit -m "fix(cli): report nonzero package version"
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
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return err(cliError('CLI_VALIDATE_LOCAL_FAILED', '--config-overrides must be a JSON object'));
  }
  configOverrides = parsed as Record<string, unknown>;
}
if (args.runtimeImage) configOverrides.runtimeImage = args.runtimeImage;
```

The server-side `StartDeploymentRequestSchema` currently accepts `runtimeImage`, `integrationModuleImages`, and `policyOverrides`. The CLI should pass through unknown object keys only if the server schema is intentionally widened in the same PR; otherwise add a local validation test that rejects unsupported override keys before the HTTP call.

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
- Modify: `packages/platform/platform-core/src/schemas/deployment.ts`
- Modify: `packages/platform/platform-core/src/repos/deployment-repo.ts`
- Modify: `packages/platform/platform-core/src/use-cases/deployments.ts`
- Modify: `packages/platform/platform-storage/src/repos/pg-deployment-repo.ts`
- Modify: `packages/platform/platform-core/test/unit/use-cases/deployments.test.ts`
- Modify: `packages/platform/platform-storage/test/integration/pg-deployment-repo.test.ts`
- Modify: `apps/platform-http/test/e2e/deploy-flow.test.ts`
- Modify: `apps/cli/src/api/types.ts` — add fields to schema
- Modify: `apps/cli/test/unit/commands/project/deployment.test.ts`

- [ ] **Step 1: Locate the deployment response builder**

Run:

```bash
grep -RIn "rowToDeployment\|DeploymentSchema\|listByProject\|getById" packages/platform apps/platform-http apps/cli/src --include='*.ts'
```

- [ ] **Step 2: Add denormalized fields to the core schema**

In `packages/platform/platform-core/src/schemas/deployment.ts`, add required response fields after `targetId`:

```ts
projectVersionSeq: z.number().int().positive(),
targetSlug: z.string().min(1),
```

Update `Deployment` fixtures in platform-core tests accordingly.

- [ ] **Step 3: Join the fields in storage**

In `packages/platform/platform-storage/src/repos/pg-deployment-repo.ts`, update `getById()` and `listByProject()` to select through joins:

```ts
SELECT d.*, pv.seq AS project_version_seq, dt.slug AS target_slug
FROM deployment d
JOIN project_version pv ON pv.id = d.project_version_id
JOIN deploy_target dt ON dt.id = d.target_id
...
```

For `create()`, return the same enriched shape by selecting the inserted row back through the joined query (or by an equivalent `INSERT ... RETURNING` with subqueries). Do not leave queued-deployment responses missing fields.

Map them in `rowToDeployment`:

```ts
projectVersionSeq: Number(r['project_version_seq']),
targetSlug: r['target_slug'] as string,
```

- [ ] **Step 4: Update the API schema in CLI**

In `apps/cli/src/api/types.ts`, add:

```ts
projectVersionSeq: z.number().int().positive(),
targetSlug: z.string().min(1),
```

to `DeploymentResponseSchema` and the list-item schema.

- [ ] **Step 5: Update list output**

In `deployment-list.ts`, change the `humanRender` columns to print `seq` and `targetSlug`:

```
SEQ  TARGET            STATUS     QUEUED                    FINISHED                
4    dokploy-demos     succeeded  2026-05-02T15:00:00.000Z  2026-05-02T15:01:00.000Z
```

(ID stays only in `--json`.)

- [ ] **Step 6: Update show output**

In `deployment-show.ts`, print `version: <seq>` and `target: <slug>` instead of UUIDs.

- [ ] **Step 7: Add tests**

Update `apps/cli/test/unit/commands/project/deployment.test.ts` fixtures to include `projectVersionSeq` and `targetSlug`, and assert human list/show output includes `SEQ` / `TARGET <slug>` while not showing truncated UUIDs. Update platform storage integration tests to prove `create`, `getById`, and `listByProject` all return enriched fields.

- [ ] **Step 8: Run typecheck + tests across both packages**

```bash
pnpm -F @rntme/cli test
pnpm -F @rntme/platform-core test
pnpm -F @rntme/platform-storage test
pnpm -F @rntme/platform-http test
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/platform/platform-core packages/platform/platform-storage apps/platform-http/test apps/cli/src/api apps/cli/src/commands/project/deployment-{list,show}.ts apps/cli/test
git commit -m "feat(cli,platform): denormalize projectVersionSeq + targetSlug on deployment responses"
```

---

## Component D — Target management commands + helpful 404

### Task D.1: Deploy-target schemas and endpoint client

**Files:**
- Modify: `apps/cli/src/api/types.ts`
- Modify: `apps/cli/src/api/endpoints.ts` — add `targets:` namespace

- [ ] **Step 1: Add CLI-side target schemas**

In `apps/cli/src/api/types.ts`:

```ts
export const TargetSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  slug: z.string(),
  displayName: z.string(),
  kind: z.string(),
  dokployUrl: z.string(),
  publicBaseUrl: z.string().nullable(),
  dokployProjectId: z.string().nullable(),
  dokployProjectName: z.string().nullable(),
  allowCreateProject: z.boolean(),
  isDefault: z.boolean(),
  apiTokenRedacted: z.literal('***'),
  auth: z.record(z.string(), z.unknown()),
  modules: z.record(z.string(), z.unknown()),
  eventBus: z.record(z.string(), z.unknown()),
  policyValues: z.record(z.string(), z.record(z.string(), z.unknown())),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const TargetsResponseSchema = z.object({ targets: z.array(TargetSchema) });
export const TargetResponseSchema = z.object({ target: TargetSchema });
export type Target = z.infer<typeof TargetSchema>;
export type TargetConfigPatch = {
  auth?: Record<string, unknown>;
  modules?: Record<string, unknown>;
  eventBus?: Record<string, unknown>;
  policyValues?: Record<string, Record<string, unknown>>;
};
```

- [ ] **Step 2: Implement endpoints in the existing client**

In `apps/cli/src/api/endpoints.ts`, import `TargetResponseSchema` / `TargetsResponseSchema` and add:

```ts
targets: {
  list: (c: Ctx, org: string) =>
    apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/deploy-targets`, responseSchema: TargetsResponseSchema, ...c }),
  show: (c: Ctx, org: string, slug: string) =>
    apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/deploy-targets/${enc(slug)}`, responseSchema: TargetResponseSchema, ...c }),
  setConfig: (c: Ctx, org: string, slug: string, body: TargetConfigPatch) =>
    apiCall({ method: 'PATCH', path: `/v1/orgs/${enc(org)}/deploy-targets/${enc(slug)}`, body, responseSchema: TargetResponseSchema, ...c }),
},
```

Do not use a separate `request` helper or `ApiContext`; those names do not exist in the current CLI client.

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

- [ ] **Step 1: Test redacted target display**

```ts
// asserts output includes slug, kind, publicBaseUrl, auth/modules/eventBus/policyValues,
// includes apiTokenRedacted: ***, and never prints an apiToken/plaintext secret.
```

- [ ] **Step 2: Implement**

`apps/cli/src/commands/target/show.ts`:

```ts
import { endpoints } from '../../api/endpoints.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';

export type TargetShowArgs = { readonly slug: string };

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
      return endpoints.targets.show({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, args.slug);
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
- Modify: `apps/platform-http/src/routes/deploy-targets.ts` only if the existing `PATCH /v1/orgs/:org/deploy-targets/:slug` route cannot enforce the config-only contract

- [ ] **Step 1: Use the existing platform PATCH route**

The CLI sends a JSON body `{ auth?, modules?, eventBus?, policyValues? }` to `PATCH /v1/orgs/:org/deploy-targets/:slug`. The existing route already requires `deploy:target:manage` and `UpdateDeployTargetRequestSchema` is strict. If the schema accepts forbidden fields after this change, tighten it there and add a route unit/e2e test.

Do not create `PATCH /config`. The current platform API is already org-scoped and has a general PATCH route.

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
        const parsed = JSON.parse(readFileSync(resolve(process.cwd(), args.jsonPath), 'utf8')) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return err(cliError('CLI_VALIDATE_LOCAL_FAILED', '--json must contain an object'));
        }
        body = parsed as Record<string, unknown>;
      } catch (e) {
        return err(cliError('CLI_VALIDATE_LOCAL_FAILED', `--json path could not be parsed: ${(e as Error).message}`));
      }
      const allowed = new Set(['auth', 'modules', 'eventBus', 'policyValues']);
      const forbidden = Object.keys(body).filter((key) => !allowed.has(key));
      if (forbidden.length > 0) {
        return err(cliError('CLI_VALIDATE_LOCAL_FAILED', `target config cannot set: ${forbidden.join(', ')}`));
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
git add apps/cli/src/commands/target/set-config.ts apps/cli/src/bin/cli.ts apps/cli/test apps/platform-http/src/routes/deploy-targets.ts apps/platform-http/test
git commit -m "feat(cli): rntme target set-config"
```

### Task D.5: Helpful 404 for project-scoped target requests

**Files:**
- Modify: `apps/platform-http/src/app.ts`
- Add e2e or unit test in `apps/platform-http/test/e2e/deploy-flow.test.ts` or `apps/platform-http/test/unit/app.test.ts`

- [ ] **Step 1: Register a 404 handler with hint**

Inside the authenticated `/v1` router in `apps/platform-http/src/app.ts`, before `projectRoutes`, register both the exact and nested project-scoped target paths:

```ts
const projectScopedTarget404 = (c: Context) =>
  c.json({
    error: {
      code: 'PLATFORM_HTTP_NOT_FOUND',
      message: 'deploy targets are org-scoped; use /v1/orgs/<org>/deploy-targets',
    },
  }, 404);

authed.all('/orgs/:orgSlug/projects/:projSlug/deploy-targets', projectScopedTarget404);
authed.all('/orgs/:orgSlug/projects/:projSlug/deploy-targets/*', projectScopedTarget404);
```

Import `type Context` from `hono` if needed.

- [ ] **Step 2: Test**

```ts
it('returns helpful body for project-scoped deploy-targets', async () => {
  const r = await app.request('/v1/orgs/o/projects/p/deploy-targets', { method: 'GET', headers: { Authorization: 'Bearer pat' } });
  expect(r.status).toBe(404);
  const body = await r.json();
  expect(body.error.code).toBe('PLATFORM_HTTP_NOT_FOUND');
  expect(body.error.message).toMatch(/org-scoped/);
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
Expected: no hits. `apps/cli/package.json#version` should also be non-zero.
