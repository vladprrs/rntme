# Issue #131 Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Per `feedback_plan_checkpoints_autonomous.md`, run end-to-end without intermediate "Review checkpoint" pauses.

**Goal:** Resolve every code divergence catalogued in [issue #131](https://github.com/vladprrs/rntme/issues/131) — the audit of un-merged challenge PRs (#113, #116, #118, #122) vs merged main.

**Architecture:** Sequential, ordered by priority. P1 first (latent bug in `pg-deployment-repo`, fake nginx test). P2 next (developer-friction: inject-version postbuild, duplicate `protectedRoutes`). P3 last (dead code removals + CLI ergonomics + docs). One commit per task. One PR for all.

**Tech Stack:** TypeScript, Vitest, pg/postgres-js, Testcontainers, Node `parseArgs`, Hono.

**Doc-touch decision (per CLAUDE.md §11):** Yes — Tasks 7 and 10 update `apps/cli/README.md` and `AGENTS.md` §6.20 (the new defaultProject + env tier + project-update target requirement). Task 10 also moves plans 3-4 into `done/` and fixes plan-text drift.

---

## Task 1: Fix pg-deployment-repo LEFT JOIN typing mismatch (P1)

`packages/platform/platform-storage/src/repos/pg-deployment-repo.ts:316,318` returns `projectVersionSeq`/`targetSlug` as `| undefined` (LEFT JOIN), but `packages/platform/platform-core/src/schemas/deployment.ts:32-33` requires both fields. If FK row is missing, `rowToDeployment` returns a malformed `Deployment` that violates the core schema. Choice: switch to INNER JOIN (deployment FK constraints guarantee `project_version` and `deploy_target` rows exist).

**Files:**
- Modify: `packages/platform/platform-storage/src/repos/pg-deployment-repo.ts`
- Test: `packages/platform/platform-storage/test/integration/pg-deployment-repo.test.ts` (existing — adjust assertion if needed)

- [ ] **Step 1: Verify FK constraints**

`grep -n "REFERENCES" packages/platform/platform-storage/src/schema/deployment.ts packages/platform/platform-storage/migrations/*.sql | grep -i "project_version\|deploy_target"`

Confirm `deployment.project_version_id REFERENCES project_version` and `deployment.target_id REFERENCES deploy_target`, both NOT NULL. If true, INNER JOIN cannot drop rows.

- [ ] **Step 2: Convert LEFT JOIN → INNER JOIN in all four queries**

Replace `LEFT JOIN project_version pv ...` and `LEFT JOIN deploy_target dt ...` with `INNER JOIN ...` in:
- `create()` enriched select (lines ~58-65)
- `getById()` (lines ~75-82)
- `listByProject()` (lines ~106-115)
- `listAll`/any other select that uses the same join (grep `LEFT JOIN project_version` in this file)

- [ ] **Step 3: Tighten `rowToDeployment`**

In `rowToDeployment` (line 310), drop `?? undefined` fallbacks so types match the required schema:

```ts
projectVersionSeq: r['project_version_seq'] as number,
targetSlug: r['target_slug'] as string,
```

- [ ] **Step 4: Run tests**

```
pnpm -F @rntme/platform-storage test
pnpm -F @rntme/platform-core test
```

If integration tests fail on the join (orphaned test fixture), update fixtures to include the FK rows. Expected: all green.

- [ ] **Step 5: Commit**

```
git commit -m "fix(platform-storage): INNER JOIN deployment FKs; drop optional pg row coercion"
```

---

## Task 2: Replace fake nginx-host with Testcontainers (P1)

`packages/deploy/deploy-dokploy/test/integration/edge-auth-fixtures/nginx-host.ts` is a Node `http.createServer` substitute that regex-parses the rendered nginx config and re-implements `auth_request` semantics in JS. Real regression surface (nginx `error_page` / `location` order / `auth_request_set`) is not covered. Replace with real Testcontainers `nginx:1.27-alpine`.

**Files:**
- Modify: `packages/deploy/deploy-dokploy/test/integration/edge-auth-fixtures/nginx-host.ts`
- Modify: `packages/deploy/deploy-dokploy/test/integration/edge-auth.test.ts`
- Modify: `packages/deploy/deploy-dokploy/package.json` (add `testcontainers` devDep)

- [ ] **Step 1: Add `testcontainers` devDep**

```
pnpm -F @rntme/deploy-dokploy add -D testcontainers
```

- [ ] **Step 2: Verify Docker available**

```
docker version >/dev/null 2>&1 && echo "docker ok" || echo "docker MISSING"
```

If Docker is missing in the worktree env, the plan has to skip live-container exec and gate the test with `describe.skipIf(!process.env.RNTME_INTEGRATION_DOCKER)`. Decide based on output.

- [ ] **Step 3: Rewrite `nginx-host.ts` to use `GenericContainer`**

Replace the file body with a function that:
1. Writes the rendered nginx config to a temp dir.
2. Starts `nginx:1.27-alpine` with the config and `/usr/share/nginx/html` mounted from a temp dir, exposes port 8080.
3. Returns `{ baseUrl, stop() }`.

```ts
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

export type StartedNginxHost = {
  readonly baseUrl: string;
  stop(): Promise<void>;
};

export async function startNginxHost(opts: {
  readonly nginxConfig: string;
  readonly upstreams: { readonly introspectHost: string; readonly introspectPort: number };
}): Promise<StartedNginxHost> {
  const dir = await mkdtemp(join(tmpdir(), 'rntme-nginx-'));
  await writeFile(join(dir, 'nginx.conf'), opts.nginxConfig);
  const container: StartedTestContainer = await new GenericContainer('nginx:1.27-alpine')
    .withExposedPorts(8080)
    .withBindMounts([{ source: join(dir, 'nginx.conf'), target: '/etc/nginx/nginx.conf', mode: 'ro' }])
    .withExtraHosts([{ host: 'introspect', ipAddress: 'host-gateway' }])
    .start();
  const baseUrl = `http://${container.getHost()}:${container.getMappedPort(8080)}`;
  return {
    baseUrl,
    stop: () => container.stop(),
  };
}
```

Drop `startNginxOrSubstitute` and the regex-parsed substitute. Remove the in-process `http.createServer` paths.

- [ ] **Step 4: Update `edge-auth.test.ts`**

Replace the `startNginxOrSubstitute` import with `startNginxHost`. The introspect sidecar continues as a small Hono server on a host-side port; nginx reaches it via the `introspect` extra-host alias.

If Docker isn't available (Step 2 indicated MISSING), wrap the suite with `describe.skipIf(...)` and document the env var in the file header comment.

- [ ] **Step 5: Run integration test**

```
pnpm -F @rntme/deploy-dokploy vitest run test/integration/edge-auth.test.ts
```

Expected: container starts, introspect sidecar reached via `auth_request`, the four assertions pass against the *real* nginx response codes. If anything diverges from the previous JS substitute behavior, that's the bug the substitute was hiding.

- [ ] **Step 6: Commit**

```
git commit -m "test(deploy-dokploy): real nginx Testcontainers for edge-auth integration"
```

---

## Task 3: Drop inject-version.cjs postbuild (P2)

`apps/cli/scripts/inject-version.cjs` rewrites `dist/util/version.js` after `tsc`, replacing `__CLI_VERSION__` from `apps/cli/src/util/version.ts:2`. The challenge said no postbuild mutation. Read `package.json` at runtime instead.

**Files:**
- Delete: `apps/cli/scripts/inject-version.cjs`
- Modify: `apps/cli/src/util/version.ts`
- Modify: `apps/cli/package.json` (drop `&& node scripts/inject-version.cjs` from `postbuild`)
- Test: `apps/cli/test/unit/util/version.test.ts` (existing or new)

- [ ] **Step 1: Rewrite `src/util/version.ts`**

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function readPackageJsonVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(here, '..', '..', 'package.json');
  const raw = readFileSync(pkgPath, 'utf8');
  const parsed = JSON.parse(raw) as { version?: unknown };
  if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
    throw new Error(`apps/cli/package.json has no version`);
  }
  return parsed.version;
}

export const CLI_VERSION = readPackageJsonVersion();
```

After `tsc` to `dist/`, `dist/util/version.js` resolves `../../package.json` → `apps/cli/package.json`. Verified by Step 4.

- [ ] **Step 2: Edit `apps/cli/package.json` postbuild**

Drop `&& node scripts/inject-version.cjs` from the `postbuild` chain. Result:

```json
"postbuild": "node -e \"const f='dist/bin/cli.js';const fs=require('fs');if(!fs.existsSync(f))process.exit(0);const s=fs.readFileSync(f,'utf8');if(!s.startsWith('#!'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+s);fs.chmodSync(f,0o755);\" && node scripts/copy-skills-assets.cjs",
```

- [ ] **Step 3: Delete `inject-version.cjs`**

```
rm apps/cli/scripts/inject-version.cjs
```

- [ ] **Step 4: Run / add unit test**

```
pnpm -F @rntme/cli build
node -e "import('./apps/cli/dist/util/version.js').then(m => { if (m.CLI_VERSION !== '0.1.0') process.exit(1); console.log('ok', m.CLI_VERSION); })"
```

Expected: `ok 0.1.0`. If `apps/cli/test/unit/util/version.test.ts` exists, ensure it still passes; otherwise no test required (the build smoke check is sufficient and it's a one-line getter).

- [ ] **Step 5: Run CLI suite + e2e**

```
pnpm -F @rntme/cli test
```

Expected: all green.

- [ ] **Step 6: Commit**

```
git commit -m "fix(cli): read CLI_VERSION from package.json at runtime; drop inject-version postbuild"
```

---

## Task 4: Drop duplicate protectedRoutes field; dedupe UI route in publicRoutes (P2)

`apps/platform-http/src/deploy/smoke-verifier.ts:9-23` introduced parallel `protectedRoutes` field while `protectedRouteChecks` was marked `@deprecated`. Challenge said: keep one canonical field, just extend its method union. Also, `packages/deploy/deploy-dokploy/src/render.ts:147-160` includes the UI route inside `publicRoutes` so the smoke verifier checks `/` twice.

**Files:**
- Modify: `apps/platform-http/src/deploy/smoke-verifier.ts`
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Modify: `packages/deploy/deploy-dokploy/src/apply.ts`
- Tests: `apps/platform-http/test/unit/deploy/smoke-verifier.test.ts`, `packages/deploy/deploy-dokploy/test/unit/render.test.ts`, `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`

- [ ] **Step 1: Extend method union of `protectedRouteChecks` in `smoke-verifier.ts`**

```ts
export type VerificationHints = {
  readonly healthUrl: string;
  readonly uiUrl?: string;
  readonly configUrl?: string;
  readonly publicRouteUrls: readonly string[];
  readonly protectedRouteChecks: readonly ProtectedRouteSpec[];
};
```

Drop the `protectedRoutes?: ...` field and the `@deprecated` line. Update the `protectedRoutes ?? protectedRouteChecks ?? []` fallback in `verify()` to `verificationHints.protectedRouteChecks`.

- [ ] **Step 2: Update `render.ts` `RenderedDokployPlan['urls']`**

Drop `protectedRoutes?` from the type and the assignment in `renderDokployPlan`. Widen `protectedRouteChecks` method union to `'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'`. Inline `protectedSmokeChecks` return type matches.

```ts
readonly urls: {
  readonly projectUrl: string;
  readonly uiUrl?: string;
  readonly publicRoutes: readonly { readonly routeId: string; readonly url: string }[];
  readonly protectedRouteChecks: readonly { readonly name: string; readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; readonly url: string }[];
};
```

Update the assignment in `renderDokployPlan` to drop `protectedRoutes`.

- [ ] **Step 3: Dedupe UI route in `publicRoutes`**

In `render.ts:146-150`, exclude UI routes from `publicRoutes`:

```ts
const uiRoute = plan.edge.routes.find((route) => route.kind === 'ui');
const publicRoutes = plan.edge.routes
  .filter((route) => route.kind !== 'ui')
  .map((route) => ({
    routeId: route.id,
    path: route.path,
    url: joinPublicUrl(config.publicBaseUrl, route.path),
  }));
```

UI route still drives `uiUrl` and `ingress.routes` (via `publicRoutes` snapshot before filter — but `ingress.routes` should include all routes for nginx ingress). Re-examine: `ingress.routes: publicRoutes` appears to feed the resource's ingress route list, not the smoke verifier. Verify by reading test expectations. If `ingress.routes` needs the UI route, compute it separately — `ingressRoutes = plan.edge.routes.map(...)` and feed that to ingress, while `publicRoutes` (filtered) feeds smoke checks.

- [ ] **Step 4: Update `apply.ts` to drop `protectedRoutes` field**

`packages/deploy/deploy-dokploy/src/apply.ts:36-37,478-479` — remove `protectedRoutes` from the `verificationHints` payload it emits. Only keep `protectedRouteChecks`.

- [ ] **Step 5: Update tests**

For each test that asserts the duplicated/legacy fields, switch to `protectedRouteChecks` only, and verify smoke checks no longer contain a `public-route /` duplicate when a UI route exists.

- [ ] **Step 6: Run tests**

```
pnpm -F @rntme/deploy-dokploy test
pnpm -F platform-http test
```

Expected: green.

- [ ] **Step 7: Commit**

```
git commit -m "refactor(deploy): single protectedRouteChecks field; exclude UI from publicRoutes"
```

---

## Task 5: Delete dead canonical/uuid-node.ts (P3)

`packages/artifacts/graph-ir-compiler/src/canonical/uuid-node.ts` exports `UuidNodeSchema` and `UUID_NODE_OUTPUT_TYPE`, neither referenced anywhere in `src/`. Real schema lives in `parse/schema.ts`.

- [ ] **Step 1: Confirm dead**

```
grep -rn "UuidNodeSchema\|UUID_NODE_OUTPUT_TYPE\|canonical/uuid-node" packages/ apps/ demo/
```

Expected: only the file itself matches.

- [ ] **Step 2: Delete**

```
rm packages/artifacts/graph-ir-compiler/src/canonical/uuid-node.ts
```

- [ ] **Step 3: Build + test**

```
pnpm -F @rntme/graph-ir-compiler build
pnpm -F @rntme/graph-ir-compiler test
```

- [ ] **Step 4: Commit**

```
git commit -m "chore(graph-ir-compiler): drop dead canonical/uuid-node.ts"
```

---

## Task 6: Delete dead --unredacted plumbing (P3)

CLI bin no longer parses `--unredacted` but `apps/cli/src/commands/target/show.ts` and `apps/cli/src/api/target-endpoints.ts:32` still accept the option (now `_opts`, ignored).

- [ ] **Step 1: Drop param from `target/show.ts`**

```ts
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

- [ ] **Step 2: Drop `_opts` from `target-endpoints.ts`**

```ts
show: async (ctx: TargetApiContext, org: string, slug: string) =>
  apiCall({
    method: 'GET',
    path: `/v1/orgs/${encodeURIComponent(org)}/deploy-targets/${encodeURIComponent(slug)}`,
    responseSchema: TargetResponseSchema,
    ...ctx,
  }),
```

- [ ] **Step 3: Update bin help text + any callers**

`grep -rn "unredacted" apps/cli/` — update bin help that mentions `--unredacted` if present, and any test that constructs `TargetShowArgs`.

- [ ] **Step 4: Run tests**

```
pnpm -F @rntme/cli test
```

- [ ] **Step 5: Commit**

```
git commit -m "chore(cli): drop dead --unredacted plumbing from target show"
```

---

## Task 7: Add defaultProject + RNTME_ORG/PROJECT/SERVICE env tier (P3)

`apps/cli/src/config/credentials.ts:16` only persists `defaultOrg`; `apps/cli/src/config/resolve.ts:22-58` skips env tier for org/project/service; `apps/cli/src/commands/login.ts:71-79` has no `--project` flag. Add the missing tier so `RNTME_ORG`/`RNTME_PROJECT`/`RNTME_SERVICE` are honored, and `login --project` persists `defaultProject`.

**Files:**
- Modify: `apps/cli/src/config/credentials.ts` (add `defaultProject` to schema)
- Modify: `apps/cli/src/config/resolve.ts` (add env vars + tier ordering)
- Modify: `apps/cli/src/commands/login.ts` (accept `--project`; persist)
- Modify: `apps/cli/src/bin/cli.ts` (parse `--project` for `login`)
- Modify: `apps/cli/README.md` (document)
- Test: `apps/cli/test/unit/config/resolve.test.ts` (add cases)

- [ ] **Step 1: Extend schemas**

`credentials.ts` `ProfileSchema`:

```ts
const ProfileSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().regex(/^rntme_pat_[a-zA-Z0-9]{22}$/),
  addedAt: z.string().datetime(),
  defaultOrg: z.string().optional(),
  defaultProject: z.string().optional(),
});
```

`resolve.ts` `ResolveEnv`:

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

- [ ] **Step 2: Wire env tier in `resolveConfig`**

Tier order (highest → lowest): flags → env → projectConfig → credentials profile defaults.

```ts
const org =
  input.flags.org ?? input.env.RNTME_ORG ?? input.projectConfig?.org ?? profile?.defaultOrg ?? null;
const project =
  input.flags.project ?? input.env.RNTME_PROJECT ?? input.projectConfig?.project ?? profile?.defaultProject ?? null;
const service =
  input.flags.service ?? input.env.RNTME_SERVICE ?? input.projectConfig?.service ?? null;
```

- [ ] **Step 3: Add `--project` to `login`**

Add `project?: string` to `LoginFlags`; in `runLogin`, after writing credentials and before whoami, if `flags.project` set: `file.profiles[profile].defaultProject = flags.project; await writeCredentials(path, file);`. Add to bin's `parseArgs` for the `login` subcommand.

- [ ] **Step 4: Tests**

In `resolve.test.ts`, add tests:
- env `RNTME_ORG` overrides credentials default
- flag `--org` overrides env
- `defaultProject` from credentials picked when no flag/env

- [ ] **Step 5: Update README**

In `apps/cli/README.md`, document env vars table additions: `RNTME_ORG`, `RNTME_PROJECT`, `RNTME_SERVICE`. Document `login --project <slug>`.

- [ ] **Step 6: Run tests**

```
pnpm -F @rntme/cli test
```

- [ ] **Step 7: Commit**

```
git commit -m "feat(cli): add defaultProject + RNTME_ORG/PROJECT/SERVICE env tier"
```

---

## Task 8: Add scripts/agent-env-check.sh platform mode (P3)

The notes-demo restoration runbook references `./scripts/agent-env-check.sh platform` but the script does not exist. Add a minimal version that asserts `RNTME_BASE_URL`, `RNTME_TOKEN`, and a `whoami` round-trip.

**Files:**
- Create: `scripts/agent-env-check.sh`

- [ ] **Step 1: Verify gap**

```
ls scripts/ 2>/dev/null || echo "no scripts dir"
```

- [ ] **Step 2: Create the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
case "$mode" in
  platform)
    : "${RNTME_BASE_URL:?RNTME_BASE_URL not set}"
    : "${RNTME_TOKEN:?RNTME_TOKEN not set}"
    if [[ ! "$RNTME_TOKEN" =~ ^rntme_pat_[a-zA-Z0-9]{22}$ ]]; then
      echo "RNTME_TOKEN format invalid" >&2
      exit 1
    fi
    code=$(curl -sS -o /dev/null -w '%{http_code}' \
      -H "Authorization: Bearer $RNTME_TOKEN" \
      "$RNTME_BASE_URL/v1/auth/me" || true)
    if [[ "$code" != "200" ]]; then
      echo "whoami HTTP $code at $RNTME_BASE_URL/v1/auth/me" >&2
      exit 1
    fi
    echo "✓ platform env ok ($RNTME_BASE_URL)"
    ;;
  *)
    echo "Usage: $0 platform" >&2
    exit 2
    ;;
esac
```

- [ ] **Step 3: Make executable**

```
chmod +x scripts/agent-env-check.sh
```

- [ ] **Step 4: Verify shellcheck if available**

```
command -v shellcheck && shellcheck scripts/agent-env-check.sh || echo "shellcheck not installed; skipping"
```

- [ ] **Step 5: Commit**

```
git commit -m "feat(scripts): add agent-env-check.sh platform mode for runbooks"
```

---

## Task 9: Push applyVars into planEdge signature (P3)

`packages/deploy/deploy-core/src/edge.ts` `planEdge(project, config, workloads)` — the middleware vars substitution is currently done in `plan.ts` by constructing `edgeProject = { ...project, middleware: applyVars(project.middleware ?? {}, vars) }`. Push the contract into `planEdge` so vars are colocated with their consumer.

**Files:**
- Modify: `packages/deploy/deploy-core/src/edge.ts`
- Modify: `packages/deploy/deploy-core/src/plan.ts`
- Test: `packages/deploy/deploy-core/test/unit/plan-vars.test.ts` (existing; should still pass)

- [ ] **Step 1: Extend `planEdge` signature**

```ts
import { applyVars, type ResolvedVars } from './vars.js';

export function planEdge(
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
  workloads: readonly DeploymentWorkload[],
  vars: ResolvedVars = {},
): { edge: PlannedEdge; errors: DeploymentPlanError[] } {
  // ... existing body
  const middleware = planMiddleware(project, config, new Set(routes.map((route) => route.id)), workloads, errors, vars);
  // ...
}
```

`planMiddleware` accepts `vars: ResolvedVars`. Inside the auth-middleware push:

```ts
planned.push({
  mountTarget: mount.target,
  name: middlewareName,
  kind: decl.kind,
  provider: applyVars(decl.provider, vars),
  audience: applyVars(decl.audience, vars),
  moduleSlug: applyVars(decl.moduleSlug, vars),
  moduleIntrospectPort: edgeAuth.port,
  ...(decl.policy !== undefined ? { policy: applyVars(decl.policy, vars) } : {}),
  ...(decl.config !== undefined ? { config: applyVars(decl.config as Record<string, unknown>, vars) } : {}),
});
```

Keep validation BEFORE substitution (so `BLUEPRINT_CONSISTENCY_VAR_UNDECLARED` and `DEPLOY_PLAN_TARGET_VAR_MISSING` are still the single enforcement points — `applyVars` is a substitution helper, not a validator).

For non-auth middleware, decide if `applyVars` is needed for `policy` references — the current behavior leaves them raw; preserve that for now (no behavior change beyond auth).

- [ ] **Step 2: Update `plan.ts` call site**

```ts
const { edge, errors: edgeErrors } = planEdge(project, config, workloads, vars);
```

Drop the `edgeProject` shimmed wrapper.

- [ ] **Step 3: Run tests**

```
pnpm -F @rntme/deploy-core test
```

Expected: `plan-vars.test.ts` "substitutes ${VAR} from target into auth middleware audience" still passes (substitution path moved, behavior identical).

- [ ] **Step 4: Commit**

```
git commit -m "refactor(deploy-core): planEdge accepts ResolvedVars; drop plan.ts wrapper"
```

---

## Task 10: Plan-text drift fix + archive plans 3-4 + AGENTS.md docs-touch (P3 / docs)

Plans 3-4 still in `docs/superpowers/plans/`; the plan-3 file references "Hono substitute" that the implementation actually used (challenge said use real Testcontainers — Task 2 above closes that gap). Move plans to `done/`. Per CLAUDE.md, archived plans must reflect what shipped, not what was originally intended.

**Files:**
- Modify: `docs/superpowers/plans/2026-05-02-publish-path-plan-3-edge-auth-and-app.md` (drop "Hono substitute" prose)
- Move: `docs/superpowers/plans/2026-05-02-publish-path-plan-3-edge-auth-and-app.md` → `done/`
- Move: `docs/superpowers/plans/2026-05-02-publish-path-plan-4-migration-and-restoration.md` → `done/`
- Possibly modify: `AGENTS.md` (only if §6 how-tos / §3 layering changed; otherwise no change required)

- [ ] **Step 1: Fix plan-3 drift**

Edit `docs/superpowers/plans/2026-05-02-publish-path-plan-3-edge-auth-and-app.md` to replace any reference to "Hono substitute" with "real nginx Testcontainers fixture (see Task 2 of issue #131 cleanup plan)". Or, since the plan is about to be archived, simply add a one-line "Implemented as merged in PRs #119/#120; nginx integration test hardened in issue #131 cleanup PR (see Task 2)." note at the top.

- [ ] **Step 2: Move plans to `done/`**

```
git mv docs/superpowers/plans/2026-05-02-publish-path-plan-3-edge-auth-and-app.md docs/superpowers/plans/done/
git mv docs/superpowers/plans/2026-05-02-publish-path-plan-4-migration-and-restoration.md docs/superpowers/plans/done/
```

- [ ] **Step 3: AGENTS.md check**

The Task 7 CLI changes added env vars `RNTME_ORG/PROJECT/SERVICE` and `defaultProject`. Check `AGENTS.md` §6 "how-tos" for the existing CLI section; if it documents `RNTME_TOKEN` env, append the new ones in the same paragraph. If `AGENTS.md` doesn't currently document CLI env, no update required — README.md is the canonical CLI doc.

```
grep -n "RNTME_TOKEN\|RNTME_BASE_URL\|--org" AGENTS.md
```

If no matches, doc-touch decision recorded: AGENTS.md does not document CLI env; README is canonical.

- [ ] **Step 4: Commit**

```
git commit -m "docs: archive publish-path plans 3-4; align prose with shipped tests"
```

---

## Task 11: Open PR

- [ ] **Step 1: Push branch + create PR**

```
git push -u origin <branch>
gh pr create --title "chore: resolve issue #131 follow-ups (publish-path cleanup)" --body "Closes #131. ..."
```

PR body lists each task with file references and the issue checklist.

---

## Self-Review

**Spec coverage** — all 9 issue items mapped:
- #131 P1 #1 → Task 1
- #131 P1 #2 → Task 2
- #131 P2 #3 → Task 3
- #131 P2 #4 → Task 4
- #131 P3 #5 (uuid-node.ts) → Task 5
- #131 P3 #5 (--unredacted) → Task 6
- #131 P3 #6 → Task 7
- #131 P3 #7 → Task 8
- #131 P3 #8 → Task 9
- #131 P3 #9 (plan-text drift + archival) → Task 10

**Placeholder scan** — passes; no "TBD"/"implement later"; trivial deletions (Task 5) do not need full code blocks.

**Type consistency** — `ProtectedRouteSpec` reused across smoke-verifier + render. `ResolvedVars` import in `edge.ts` matches `vars.ts` export. `LoginFlags.project` consistently typed as `string`.

**Risk** — Task 2 depends on Docker availability. If absent, plan execution gates the test with an env-var skip and records the gap.
