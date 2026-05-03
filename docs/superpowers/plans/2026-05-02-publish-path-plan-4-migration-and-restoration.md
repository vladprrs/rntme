# Publish-Path Hardening — Plan 4: Migration + Operational Restoration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-02-publish-path-end-to-end-hardening-design.md` §11 step 9, §12

**Goal:** Migrate `demo/notes-blueprint` to declarative `vars`, configure the live `dokploy-demos` deploy target with the Auth0 client id, publish a fresh blueprint version, redeploy, and verify that login works and forged bearers are canonically rejected at the edge.

**Pre-requisites:** Plans 1, 2, and 3 must be merged. The platform must run a build that includes:
- `vars` validation in blueprint
- typed deploy errors and `vars` resolver in deploy-core
- real protected-route smoke probes
- CLI `target` commands and `--wait`
- nginx renderer with `^/_rntme_auth_` 404
- production React build

**Current-main challenge finding (2026-05-03):** Plans 1-3 are present on `main`, but vars substitution only covers `modules.*.publicConfig` / `publicConfigJson`. `packages/artifacts/blueprint/src/validate/composition.ts#validateVars` does not walk `project.middleware`, and `packages/deploy/deploy-core/src/plan.ts` calls `planEdge(project, ...)` without applying resolved vars to middleware. Therefore Task A.2 is mandatory before changing `middleware.auth.audience` to `${AUTH0_AUDIENCE}`; otherwise the edge plan will render the literal placeholder as the Auth0 audience.

**Architecture:** Three slices — (1) a small vars-surface fix in blueprint validation + deploy-core planning so middleware values are substitutable; (2) blueprint migration committed as a normal PR including the expanded `vars` block and docs; (3) operational steps run by the engineer against `platform.rntme.com` only after the PR is merged and the platform build contains it. The operational steps are documented and tracked but are not committed code except the runbook/outcome notes.

**Tech Stack:** rntme CLI, platform-http API, Auth0 production tenant.

---

## File Structure

**Modify:**
- `demo/notes-blueprint/project.json` — add `vars` block; rewrite `publicConfig` to use the placeholders
- `demo/notes-blueprint/README.md` — document the `vars` shape and the production redeploy procedure
- `packages/artifacts/blueprint/src/validate/composition.ts` — include middleware values in placeholder consistency checks
- `packages/artifacts/blueprint/test/unit/vars.test.ts` — cover middleware placeholder consistency
- `packages/deploy/deploy-core/src/edge.ts` — accept resolved vars and substitute auth middleware audience
- `packages/deploy/deploy-core/src/plan.ts` — pass resolved vars into `planEdge`
- `packages/deploy/deploy-core/test/unit/plan-vars.test.ts` — assert middleware audience is substituted in the edge plan

**Create:**
- `docs/superpowers/runbooks/2026-05-02-notes-demo-restoration.md` — operational runbook (the engineer follows this against prod)

**No code in apps/** — this plan is migration + ops plus the required package-level vars-surface fix.

---

## Component A — Blueprint migration

### Task A.1: Add `vars` block to notes-blueprint

**Files:**
- Modify: `demo/notes-blueprint/project.json`

- [ ] **Step 1: Update project.json**

Replace the existing `modules.identity.publicConfig` block to use placeholders, and add the `vars` block:

```json
{
  "name": "notes-demo",
  "services": ["app", "identity-auth0"],
  "vars": {
    "AUTH0_SPA_CLIENT_ID":      { "from": "target.auth.auth0.clientId",   "required": true },
    "AUTH0_DOMAIN":             { "from": "target.auth.auth0.domain",     "required": true },
    "AUTH0_AUDIENCE":           { "from": "target.auth.auth0.audience",   "required": true },
    "AUTH0_REDIRECT_URI":       { "from": "target.auth.auth0.redirectUri","required": true }
  },
  "modules": {
    "identity": {
      "package": "rntme_identity_auth0",
      "publicConfig": {
        "domain":      "${AUTH0_DOMAIN}",
        "clientId":    "${AUTH0_SPA_CLIENT_ID}",
        "audience":    "${AUTH0_AUDIENCE}",
        "redirectUri": "${AUTH0_REDIRECT_URI}"
      }
    }
  },
  "routes": {
    "ui":   { "/":    "app" },
    "http": { "/api": "app" }
  },
  "middleware": {
    "requestContext": { "kind": "request-context" },
    "auth": {
      "kind": "auth",
      "provider": "auth0",
      "audience": "${AUTH0_AUDIENCE}",
      "moduleSlug": "identity-auth0"
    }
  },
  "mounts": [
    { "target": "ui:/",     "use": ["requestContext"] },
    { "target": "http:/api", "use": ["requestContext", "auth"] }
  ]
}
```

Note: the auth middleware's `audience` field also uses the placeholder. Complete Task A.2 first on current `main`; do not commit this `project.json` change while middleware vars still render literally.

- [ ] **Step 2: Validate with the local CLI**

```bash
pnpm -r --filter @rntme/blueprint... --filter @rntme/deploy-core... --filter @rntme/cli... build
pnpm -F @rntme/cli build
node apps/cli/dist/bin/cli.js project publish --org test-organization --project notes-demo --dry-run demo/notes-blueprint
```
Expected: `✓ project bundle validated`. The dry-run does not apply target resolution; it confirms parse + structural + composition pass.

- [ ] **Step 3: Update notes-demo README**

Add a section "Production deployment" that documents:
- the `vars` block in `project.json`,
- the required target keys (`auth.auth0.{clientId,domain,audience,redirectUri}`),
- the redeploy command (`rntme project deploy --version <seq> --target dokploy-demos --wait`).

Show the canonical `target.auth.auth0` block as JSON for use with `rntme target set-config`:

```json
{
  "auth": {
    "auth0": {
      "domain": "demo-rntme.us.auth0.com",
      "clientId": "<production SPA client id>",
      "audience": "https://notes-demo.rntme.com/api",
      "redirectUri": "https://notes-demo.rntme.com/"
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add demo/notes-blueprint/project.json demo/notes-blueprint/README.md
git commit -m "feat(notes-demo): migrate to declarative vars block"
```

### Task A.2: Extend vars consistency + resolution to middleware

**Files:**
- Modify: `packages/artifacts/blueprint/src/validate/composition.ts`
- Modify: `packages/artifacts/blueprint/test/unit/vars.test.ts`
- Modify: `packages/deploy/deploy-core/src/edge.ts`
- Modify: `packages/deploy/deploy-core/src/plan.ts`
- Modify: `packages/deploy/deploy-core/test/unit/plan-vars.test.ts`

This task is mandatory against current `main`.

- [ ] **Step 1: Add blueprint consistency tests**

In `packages/artifacts/blueprint/test/unit/vars.test.ts`, add:

```ts
it('flags placeholder in middleware.<name>.audience as undeclared', () => {
  const r = validateBlueprintComposition({
    ...composeBase,
    project: {
      name: 'demo',
      services: ['app'],
      middleware: { auth: { kind: 'auth', provider: 'auth0', audience: '${MISSING}', moduleSlug: 'm' } },
      vars: {},
    },
  });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.code === 'BLUEPRINT_CONSISTENCY_VAR_UNDECLARED')).toBe(true);
});

it('counts middleware.<name>.audience placeholder as a vars reference', () => {
  const r = validateBlueprintComposition({
    ...composeBase,
    project: {
      name: 'demo',
      services: ['app'],
      middleware: { auth: { kind: 'auth', provider: 'auth0', audience: '${AUD}', moduleSlug: 'm' } },
      vars: { AUD: { from: 'target.auth.auth0.audience', required: true } },
    },
  });
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors.some((e) => e.code === 'BLUEPRINT_CONSISTENCY_VAR_UNUSED')).toBe(false);
  }
});
```

Run: `pnpm -F @rntme/blueprint vitest run test/unit/vars.test.ts -t "middleware"`
Expected before the implementation: the undeclared-placeholder assertion is missing and/or `AUD` is reported as unused.

- [ ] **Step 2: Update `validateVars`**

In `composition.ts`'s `validateVars` helper, add:

```ts
for (const [name, mw] of Object.entries(project.middleware ?? {})) {
  for (const placeholder of extractPlaceholders(mw)) {
    used.add(placeholder);
    if (!declared.has(placeholder)) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_CONSISTENCY_VAR_UNDECLARED,
        message: `placeholder "${placeholder}" used in middleware.${name} is not declared in project.vars`,
        path: `project.middleware.${name}`,
      });
    }
  }
}
```

- [ ] **Step 3: Add deploy-core edge-plan substitution test**

In `packages/deploy/deploy-core/test/unit/plan-vars.test.ts`, add:

```ts
it('substitutes ${VAR} from target into auth middleware audience', () => {
  const plan = buildProjectDeploymentPlan(
    {
      ...baseProject,
      services: {
        api: { slug: 'api', kind: 'domain', runtimeFiles: { 'manifest.json': '{}' } },
        'identity-auth0': {
          slug: 'identity-auth0',
          kind: 'integration',
          runtimeFiles: {},
        },
      },
      modules: {
        'identity-auth0': {
          edgeAuth: {
            kind: 'introspection-sidecar',
            transport: 'http',
            method: 'GET',
            path: '/introspect',
            port: 50052,
          },
        },
      },
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'auth0',
          audience: '${AUD}',
          moduleSlug: 'identity-auth0',
        },
      },
      mounts: [{ target: 'http:/api', use: ['auth'] }],
      varsManifest: { AUD: { from: 'target.auth.auth0.audience', required: true } },
    },
    {
      ...baseConfig,
      auth: { auth0: { audience: 'https://notes-demo.rntme.com/api' } },
      modules: {
        'identity-auth0': {
          image: 'ghcr.io/vladprrs/rntme-identity-auth0:test',
          expose: false,
          env: { AUTH0_DOMAIN: 'demo-rntme.us.auth0.com' },
          secretRefs: {},
        },
      },
    },
  );
  expect(plan.ok).toBe(true);
  if (plan.ok) {
    const auth = plan.value.edge.middleware.find((mw) => mw.kind === 'auth');
    expect(auth).toBeDefined();
    expect(auth?.kind).toBe('auth');
    if (auth?.kind === 'auth') {
      expect(auth.audience).toBe('https://notes-demo.rntme.com/api');
      expect(auth.audience).not.toContain('${AUD}');
    }
  }
});
```

Run: `pnpm -F @rntme/deploy-core vitest run test/unit/plan-vars.test.ts -t "auth middleware audience"`
Expected before the implementation: FAIL because `audience` remains `${AUD}`.

- [ ] **Step 4: Update planner substitution**

In `packages/deploy/deploy-core/src/plan.ts`, pass resolved vars into the edge planner:

```ts
const { edge, errors: edgeErrors } = planEdge(project, config, workloads, vars);
```

In `packages/deploy/deploy-core/src/edge.ts`, import the vars helper types and update the function signatures:

```ts
import { applyVars, type ResolvedVars } from './vars.js';

export function planEdge(
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
  workloads: readonly DeploymentWorkload[],
  vars: ResolvedVars = {},
): { edge: PlannedEdge; errors: DeploymentPlanError[] } {
  // ...
  const middleware = planMiddleware(
    project,
    config,
    new Set(routes.map((route) => route.id)),
    workloads,
    errors,
    vars,
  );
}
```

Update `planMiddleware` to receive `vars`, then change the auth middleware push to:

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
          ...(decl.config !== undefined ? { config: applyVars(decl.config, vars) } : {}),
        });
```

Keep validation before substitution so missing declarations still fail via blueprint consistency and missing target values still fail via `resolveVars`.

- [ ] **Step 5: Run + commit**

```bash
pnpm -F @rntme/blueprint vitest run test/unit/vars.test.ts -t "middleware"
pnpm -F @rntme/deploy-core vitest run test/unit/plan-vars.test.ts -t "auth middleware audience"
pnpm -F @rntme/blueprint test
pnpm -F @rntme/deploy-core test
git add packages/artifacts/blueprint packages/deploy/deploy-core
git commit -m "feat(blueprint,deploy-core): vars resolution covers middleware values"
```

---

## Component B — Operational restoration of notes-demo

### Task B.1: Write the runbook

**Files:**
- Create: `docs/superpowers/runbooks/2026-05-02-notes-demo-restoration.md`

- [ ] **Step 1: Author the runbook**

```markdown
# notes-demo restoration runbook (2026-05-02)

Pre-flight:
- All four hardening plans (1–4) merged.
- `platform.rntme.com` is running a build at or after the Plan 4 merge commit; do not run the production restoration from an unmerged PR build.
- Local workspace dependencies built first, then CLI built:
  `pnpm -r --filter @rntme/blueprint... --filter @rntme/deploy-core... --filter @rntme/cli... build`
  and `pnpm -F @rntme/cli build`.
- `./scripts/agent-env-check.sh platform` passes; use `RNTME_TOKEN` from the shared agent environment. Do not print token values.
- Production Auth0 SPA client id at hand (read from the Auth0 dashboard, application "notes-demo"). Auth0 SPA JS expects `domain` and `clientId` at client initialization and Auth0 authorization parameters such as `audience` and `redirect_uri`; the application must allow `https://notes-demo.rntme.com/` as a callback/logout URL.

Steps:

1. Confirm the new CLI version is live:
   ```bash
   node apps/cli/dist/bin/cli.js --version          # expect 0.1.0+ (not 0.0.0)
   node apps/cli/dist/bin/cli.js whoami             # confirm org test-organization, role admin
   node apps/cli/dist/bin/cli.js target list        # expect dokploy-demos
   node apps/cli/dist/bin/cli.js target show dokploy-demos
   ```
   Do not use `--unredacted` in run logs. The redacted show output is enough to confirm the target exists; the set-config response below confirms update success.

2. Prepare the target config:
   ```bash
   cat > /tmp/dokploy-demos-config.json <<'EOF'
   {
     "auth": {
       "auth0": {
         "domain": "demo-rntme.us.auth0.com",
         "clientId": "<PRODUCTION_AUTH0_CLIENT_ID>",
         "audience": "https://notes-demo.rntme.com/api",
         "redirectUri": "https://notes-demo.rntme.com/"
       }
     }
   }
   EOF
   ```
   Replace `<PRODUCTION_AUTH0_CLIENT_ID>`.

3. Apply target config:
   ```bash
   node apps/cli/dist/bin/cli.js target set-config dokploy-demos --json /tmp/dokploy-demos-config.json
   node apps/cli/dist/bin/cli.js target show dokploy-demos
   ```
   Expected: `✓ updated dokploy-demos`, then redacted target output that includes an `auth.auth0` block. Do not paste `/tmp/dokploy-demos-config.json` or unredacted target output into issues, PRs, or run logs.

4. Publish a fresh blueprint version (with the new `vars` block):
   ```bash
   node apps/cli/dist/bin/cli.js project publish --org test-organization --project notes-demo demo/notes-blueprint
   # capture the seq
   ```

5. Deploy with --wait:
   ```bash
   node apps/cli/dist/bin/cli.js project deploy \
     --org test-organization --project notes-demo \
     --version <seq> --target dokploy-demos --wait
   ```
   Expected exit code 0 (succeeded). If 10 (failed): `project deployment show <id>` and inspect logs.

6. Smoke from the outside:
   ```bash
   curl -i https://notes-demo.rntme.com/health
   curl -i https://notes-demo.rntme.com/config.json
   curl -i https://notes-demo.rntme.com/api/notes
   curl -i -H 'Authorization: Bearer fake.token.here' https://notes-demo.rntme.com/api/notes
   curl -i -H 'Authorization: Bearer fake' -X POST -H 'Content-Type: application/json' -d '{"title":"x","body":"y"}' https://notes-demo.rntme.com/api/notes
   curl -i https://notes-demo.rntme.com/_rntme_auth_test
   ```
   Expectations:
   - /health → 200 ok
   - /config.json → 200 application/json with the Auth0 SPA config under `@rntme/identity-auth0`
   - GET /api/notes (no bearer) → 401 application/json, body length 73
   - GET /api/notes (Bearer fake.token.here) → 401 application/json, body length 73 (NOT containing `reason`)
   - POST /api/notes (Bearer fake) → 401 application/json, body length 73
   - /_rntme_auth_test → 404, NOT 200 SPA HTML

7. Manual login round-trip (browser):
   - Open https://notes-demo.rntme.com/, click Login
   - Complete Auth0 redirect
   - Create a note (title + body only — no id field)
   - List notes; expect to see the new note
   - Logout

8. Record results:
   - Append to `docs/superpowers/specs/done/` once the spec is moved (or mark in the spec itself that operational restoration completed on 2026-05-02 with deployment id `<id>`).
```

- [ ] **Step 2: Commit the runbook**

```bash
git add docs/superpowers/runbooks/2026-05-02-notes-demo-restoration.md
git commit -m "docs: notes-demo restoration runbook"
```

### Task B.2: Run the runbook against production

This task is operational and not committed code. Follow the runbook from B.1 only after the PR is merged to `main` and `platform.rntme.com` is confirmed to run that build. Before merge, stop after dry-run validation and PR evidence.

- [ ] **Step 1: Pre-flight checks (B.1 step 1)**

- [ ] **Step 2: Apply target config (B.1 steps 2–3)**

- [ ] **Step 3: Publish + deploy (B.1 steps 4–5)**

- [ ] **Step 4: Smoke (B.1 step 6)**

- [ ] **Step 5: Manual login round-trip (B.1 step 7)**

- [ ] **Step 6: If anything fails:**

- For deploy `failed` with `DEPLOY_PLAN_TARGET_VAR_MISSING`: target config did not include the named key. Re-run set-config with the corrected JSON.
- For smoke probe `protected route returned 200`: the live nginx/runtime is still old or the middleware audience rendered incorrectly. First inspect the deployment version/commit marker and rendered edge config; only then re-deploy with `--runtime-image` pinned to a known latest CI build if the platform target still points at an old runtime image.
- For login redirect failure: inspect the SPA console; verify `/config.json` returns the expected redacted/public Auth0 fields, the configured `redirectUri` is `https://notes-demo.rntme.com/`, and the same URL is in the Auth0 SPA application's allowed callback/logout URLs.

### Task B.3: Close the loop on the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-05-02-publish-path-end-to-end-hardening-design.md`

- [ ] **Step 1: Move spec to `done/` and add operational outcome**

```bash
mkdir -p docs/superpowers/specs/done
git mv docs/superpowers/specs/2026-05-02-publish-path-end-to-end-hardening-design.md docs/superpowers/specs/done/
```

Append a final section to the moved spec:

```markdown
## 14. Operational outcome

Restoration completed on 2026-05-02 with deployment id `<id>`, blueprint version `<seq>`. Smoke verifier reported all 7 critical checks ok. Manual login + create-note round-trip succeeded. Edge auth confirmed via `Bearer fake.token.here` returning 73-byte canonical 401 (no `reason` field).
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs
git commit -m "docs: archive publish-path hardening spec; record operational restoration"
```

---

## Self-Review Pass

- [ ] **Confirm dry-run is clean**

```bash
pnpm -r --filter @rntme/blueprint... --filter @rntme/deploy-core... --filter @rntme/cli... build
pnpm -F @rntme/cli build
node apps/cli/dist/bin/cli.js project publish --org test-organization --project notes-demo --dry-run demo/notes-blueprint
```
Expected: `✓ project bundle validated`.

- [ ] **Confirm vars references everything they should**

```bash
grep -o '\${[A-Z][A-Z0-9_]*}' demo/notes-blueprint/project.json | sort -u
```
Each placeholder must be a key in the `vars` block of the same file. Compare manually.

- [ ] **Confirm runbook exists and is reachable**

```bash
test -f docs/superpowers/runbooks/2026-05-02-notes-demo-restoration.md && echo OK
```

- [ ] **Push branch + open PRs as separate or stacked PRs**

(One PR per plan is the natural unit. Plan 4's PR is the smallest and safest to merge last.)
