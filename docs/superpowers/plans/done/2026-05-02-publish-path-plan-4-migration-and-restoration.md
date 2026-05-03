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

**Architecture:** Two slices — (1) blueprint migration committed as a normal PR including the new `vars` block and any consequent test updates; (2) operational steps run by the engineer against `platform.rntme.com` using the new CLI commands. The operational steps are documented and tracked but are not committed code.

**Tech Stack:** rntme CLI, platform-http API, Auth0 production tenant.

---

## File Structure

**Modify:**
- `demo/notes-blueprint/project.json` — add `vars` block; rewrite `publicConfig` to use the placeholders
- `demo/notes-blueprint/README.md` — document the `vars` shape and the production redeploy procedure

**Create:**
- `docs/superpowers/runbooks/2026-05-02-notes-demo-restoration.md` — operational runbook (the engineer follows this against prod)

**No code in apps/** — this plan is migration + ops only.

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

Note: the auth middleware's `audience` field also uses the placeholder; this requires the planner / blueprint to allow `${VAR}` in middleware.audience. Verify Plan 1 Task A.5 / B.3 handle middleware values; if they don't (the consistency check today only walks `modules.publicConfig`), extend it to include middleware values too. (Add this as a small follow-up commit if missing.)

- [ ] **Step 2: Validate with the local CLI**

```bash
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

### Task A.2: (If needed) Extend consistency check to middleware

**Files:**
- Modify: `packages/artifacts/blueprint/src/validate/composition.ts`

Skip this task if the consistency check already walks middleware values. Otherwise:

- [ ] **Step 1: Failing test**

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
```

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

- [ ] **Step 3: Update planner substitution**

In `@rntme/deploy-core` planner, ensure middleware values pass through `applyVars` as well. Find the `audience` reference; wrap it.

- [ ] **Step 4: Run + commit**

```bash
pnpm -r run test
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
- Local CLI built: `pnpm -F @rntme/cli build`.
- `RNTME_TOKEN` exported (`rntme_pat_…`); token has `deploy:target:manage` and `deploy:execute` scopes.
- Production Auth0 SPA client id at hand (read from the Auth0 dashboard, application "notes-demo").

Steps:

1. Confirm the new CLI version is live:
   ```bash
   node apps/cli/dist/bin/cli.js --version          # expect 0.1.0+ (not 0.0.0)
   node apps/cli/dist/bin/cli.js whoami             # confirm org test-organization, role admin
   node apps/cli/dist/bin/cli.js target list        # expect dokploy-demos
   node apps/cli/dist/bin/cli.js target show dokploy-demos --unredacted | head -30
   ```

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
   node apps/cli/dist/bin/cli.js target show dokploy-demos --unredacted | grep auth0   # verify
   ```

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

This task is operational and not committed code. Follow the runbook from B.1.

- [ ] **Step 1: Pre-flight checks (B.1 step 1)**

- [ ] **Step 2: Apply target config (B.1 steps 2–3)**

- [ ] **Step 3: Publish + deploy (B.1 steps 4–5)**

- [ ] **Step 4: Smoke (B.1 step 6)**

- [ ] **Step 5: Manual login round-trip (B.1 step 7)**

- [ ] **Step 6: If anything fails:**

- For deploy `failed` with `DEPLOY_PLAN_TARGET_VAR_MISSING`: target config did not include the named key. Re-run set-config with the corrected JSON.
- For smoke probe `protected route returned 200`: the live nginx is still the pre-PR-112 image. Force a new deployment (publish a no-op blueprint change) or re-deploy with `--runtime-image` pinned to the latest CI build.
- For login redirect failure: inspect the SPA console; verify `/config.json` returns the correct `clientId`.

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
