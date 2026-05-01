# Notes-demo Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore `https://notes-demo.rntme.com/` to a working state by patching one post-relocation regression in the deploy executor, fixing two deploy-target misconfigurations, building current images from `main`, running the live deploy through the platform, and root-causing the 502-on-`/` if it reproduces.

**Architecture:** Two-phase. Phase 1 = single code PR fixing `executor.ts` UI CSS path regression (TDD). Phase 2 = operational walk against the running `platform.rntme.com` and `dokploy.vladpr.com` using PAT auth — delete unused target, repurpose the rnt-364 target as canonical `notes-demo`, build new images via existing GHA `workflow_dispatch`, trigger deploy, watch logs, iterate per the failure tree if 502 reproduces.

**Tech Stack:** TypeScript, vitest, Hono platform-http, Postgres (RLS), rustfs, Dokploy MCP for ops, GitHub Actions (`runtime-image.yml`, `identity-auth0-image.yml`), Auth0 SPA + API, Redpanda Cloud (SCRAM-SHA-256/SSL).

**Spec:** `docs/superpowers/specs/2026-05-01-notes-demo-recovery-design.md`

---

## File Structure

**Phase 1 — code PR (PR 1):**

| File | What changes |
| --- | --- |
| `apps/platform-http/src/deploy/executor.ts` | `readUiRuntimeCss(workspaceRoot)` looks at both new `packages/runtime/ui-runtime/build/main.css` and legacy `packages/ui-runtime/build/main.css`. |
| `apps/platform-http/test/unit/deploy/executor.test.ts` | Strengthen the existing CSS assertion so the placeholder fallback is detected as a regression. Add focused unit test for `readUiRuntimeCss` itself via a small temp workspace fixture. |
| `apps/platform-http/README.md` | One-line note in the deploy section. |
| `docs/superpowers/specs/2026-05-01-notes-demo-recovery-design.md` | Already created in brainstorming; included in PR 1. |

`readUiRuntimeCss` is currently a `function` in the same file, not exported. We export it for the focused unit test.

**Phase 2 — operational PR (PR 2):**

| File | What changes |
| --- | --- |
| `docs/superpowers/plans/notes-demo-recovery-runbook.md` | Operational record: command outputs, deployment ids, log excerpts, root cause for 502 (whichever branch from spec §7 was hit), final acceptance evidence. |

No code in PR 2.

---

## Phase 1 — Code fix (PR 1)

### Task 1: Strengthen the existing CSS assertion + add focused test

**Files:**
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts:100`
- Modify (export): `apps/platform-http/src/deploy/executor.ts`

- [ ] **Step 1: Export `readUiRuntimeCss` from `executor.ts` so it can be unit-tested in isolation**

In `apps/platform-http/src/deploy/executor.ts`, change the line
```ts
function readUiRuntimeCss(workspaceRoot: string): string {
```
to
```ts
export function readUiRuntimeCss(workspaceRoot: string): string {
```

Do not change behavior in this step. Run `pnpm -F @rntme/platform-http build` and confirm it still compiles.

- [ ] **Step 2: Strengthen the existing line-100 assertion in `executor.test.ts`**

Find the `it('adapts composed blueprints into deploy-core input with runtime artifact files', ...)` test (around line 61). Locate the line:
```ts
expect(runtimeFiles['ui-build/main.css']).toEqual(expect.any(String));
```
Replace with:
```ts
expect(runtimeFiles['ui-build/main.css']).toContain('tailwindcss');
expect(runtimeFiles['ui-build/main.css']).not.toContain('rntme ui runtime styles unavailable');
```
Rationale: the placeholder string `'/* rntme ui runtime styles unavailable at deploy bundle time */\n'` is also a `String`, so the existing assertion passes even when the fallback fires (the bug we are fixing). The two new assertions detect both: (1) real Tailwind output is present, (2) the placeholder banner is not.

- [ ] **Step 3: Add a focused unit test for `readUiRuntimeCss` with both layouts**

At the bottom of `apps/platform-http/test/unit/deploy/executor.test.ts`, add a new `describe` block (do not nest inside the existing `runDeployment` block):

```ts
describe('readUiRuntimeCss', () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs') as typeof import('node:fs');
  const { tmpdir } = require('node:os') as typeof import('node:os');
  const { join } = require('node:path') as typeof import('node:path');

  function workspaceWith(layout: 'new' | 'legacy' | 'none', cssContent = '/* fixture css */'): string {
    const root = mkdtempSync(join(tmpdir(), 'rntme-ui-css-test-'));
    if (layout === 'new') {
      mkdirSync(join(root, 'packages', 'runtime', 'ui-runtime', 'build'), { recursive: true });
      writeFileSync(join(root, 'packages', 'runtime', 'ui-runtime', 'build', 'main.css'), cssContent);
    }
    if (layout === 'legacy') {
      mkdirSync(join(root, 'packages', 'ui-runtime', 'build'), { recursive: true });
      writeFileSync(join(root, 'packages', 'ui-runtime', 'build', 'main.css'), cssContent);
    }
    return root;
  }

  it('reads CSS from the new packages/runtime/ui-runtime location', () => {
    const root = workspaceWith('new', '/* css from new path */');
    try {
      const { readUiRuntimeCss } = require('../../../src/deploy/executor.js') as typeof import('../../../src/deploy/executor.js');
      expect(readUiRuntimeCss(root)).toBe('/* css from new path */');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to legacy packages/ui-runtime location when new path is absent', () => {
    const root = workspaceWith('legacy', '/* css from legacy path */');
    try {
      const { readUiRuntimeCss } = require('../../../src/deploy/executor.js') as typeof import('../../../src/deploy/executor.js');
      expect(readUiRuntimeCss(root)).toBe('/* css from legacy path */');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns the placeholder banner when neither path exists', () => {
    const root = workspaceWith('none');
    try {
      const { readUiRuntimeCss } = require('../../../src/deploy/executor.js') as typeof import('../../../src/deploy/executor.js');
      expect(readUiRuntimeCss(root)).toBe('/* rntme ui runtime styles unavailable at deploy bundle time */\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 4: Run the strengthened tests; expect new path test to FAIL**

Run:
```
pnpm -F @rntme/platform-http vitest run test/unit/deploy/executor.test.ts
```

Expected results before the fix:
- `'reads CSS from the new packages/runtime/ui-runtime location'` → **FAIL** (returns the placeholder banner instead of the new-path content).
- `'falls back to legacy packages/ui-runtime location when new path is absent'` → **PASS** (current code reads from the legacy path).
- `'returns the placeholder banner when neither path exists'` → **PASS**.
- `'adapts composed blueprints into deploy-core input ...'` → **PASS or FAIL** depending on whether `pnpm -F @rntme/ui-runtime build` ran first; the test's strengthened assertions require the new path content to be present. If FAIL, the failure message should mention `tailwindcss` not found in the placeholder string.

These failures are the proof that the regression exists. Do not move on until you see the new-path test fail.

- [ ] **Step 5: Commit the failing tests**

```bash
git add apps/platform-http/test/unit/deploy/executor.test.ts apps/platform-http/src/deploy/executor.ts
git commit -m "test(platform-http): pin ui-runtime CSS path lookup behavior"
```

### Task 2: Implement the path fix

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts:574-578`

- [ ] **Step 1: Replace the `readUiRuntimeCss` body**

In `apps/platform-http/src/deploy/executor.ts`, find the existing body:

```ts
export function readUiRuntimeCss(workspaceRoot: string): string {
  const cssPath = join(workspaceRoot, 'packages', 'ui-runtime', 'build', 'main.css');
  if (existsSync(cssPath)) return readFileSync(cssPath, 'utf8');
  return '/* rntme ui runtime styles unavailable at deploy bundle time */\n';
}
```

Replace with:

```ts
export function readUiRuntimeCss(workspaceRoot: string): string {
  for (const cssPath of [
    join(workspaceRoot, 'packages', 'runtime', 'ui-runtime', 'build', 'main.css'),
    join(workspaceRoot, 'packages', 'ui-runtime', 'build', 'main.css'),
  ]) {
    if (existsSync(cssPath)) return readFileSync(cssPath, 'utf8');
  }
  return '/* rntme ui runtime styles unavailable at deploy bundle time */\n';
}
```

The new-path lookup is first (the canonical post-merge-back location). The legacy lookup remains as a defensive fallback in case any historical build artifact survives in another tree; it can be removed in a follow-up once we are sure no consumer relies on it.

- [ ] **Step 2: Run the tests; all four executor tests should now pass**

Run:
```
pnpm -F @rntme/platform-http vitest run test/unit/deploy/executor.test.ts
```

Expected: all tests in the file pass, including:
- `'reads CSS from the new packages/runtime/ui-runtime location'` → **PASS**
- `'falls back to legacy packages/ui-runtime location when new path is absent'` → **PASS**
- `'returns the placeholder banner when neither path exists'` → **PASS**
- `'adapts composed blueprints into deploy-core input ...'` → **PASS**

If `'adapts composed blueprints into deploy-core input ...'` still fails because the actual `packages/runtime/ui-runtime/build/main.css` is missing in the working tree, run `pnpm -F @rntme/ui-runtime build` once and re-run the vitest command.

- [ ] **Step 3: Run the full platform-http unit suite to confirm no collateral**

Run:
```
pnpm -F @rntme/platform-http test
```

Expected: all unit + integration tests pass.

- [ ] **Step 4: Commit the fix**

```bash
git add apps/platform-http/src/deploy/executor.ts
git commit -m "fix(platform-http): readUiRuntimeCss reads new packages/runtime/ui-runtime path

After PR #106 (rntme-cli merge-back relocation), packages/ui-runtime moved
to packages/runtime/ui-runtime. The executor silently fell back to a
placeholder comment, shipping unstyled SPA bundles in every deploy."
```

### Task 3: README touch + spec link

**Files:**
- Modify: `apps/platform-http/README.md`

- [ ] **Step 1: Open `apps/platform-http/README.md` and locate the deploy section**

The README has a section that describes the deploy executor (search for "executor" or "deploy"). If there is no explicit deploy section, add a one-paragraph "Deploy executor — UI bundle CSS lookup" subsection under the existing "Deploy" or "Modules" heading.

- [ ] **Step 2: Insert this paragraph in the relevant section**

```markdown
The deploy executor's `readUiRuntimeCss` looks for the bundled SPA stylesheet
in `packages/runtime/ui-runtime/build/main.css` first, then falls back to the
legacy `packages/ui-runtime/build/main.css`. The legacy location predates the
2026-04-30 merge-back relocation; remove the fallback once no working tree
relies on it.
```

- [ ] **Step 3: Commit the README + spec**

```bash
git add apps/platform-http/README.md docs/superpowers/specs/2026-05-01-notes-demo-recovery-design.md
git commit -m "docs(platform-http): note dual-path CSS lookup; ship recovery spec"
```

- [ ] **Step 4: Push branch + open PR 1**

```bash
git push -u origin HEAD
gh pr create --title "fix(platform-http): readUiRuntimeCss new ui-runtime path + recovery spec" --body "$(cat <<'EOF'
## Summary
- Fixes ui-runtime CSS path regression after the merge-back relocation (PR #106).
- Adds focused unit tests for both layouts; strengthens existing assertion.
- Ships the notes-demo recovery design spec; operational PR follows.

## Test plan
- [x] pnpm -F @rntme/platform-http vitest run test/unit/deploy/executor.test.ts
- [x] pnpm -F @rntme/platform-http test
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After PR 1 merges, proceed to Phase 2.

---

## Phase 2 — Operational recovery (PR 2)

The runbook file is the operational record; create it before Step 1 below and append to it as you proceed.

### Task 4: Bootstrap the runbook + CLI credentials

**Files:**
- Create: `docs/superpowers/plans/notes-demo-recovery-runbook.md`
- Create: `~/.rntme/credentials.json`

- [ ] **Step 1: Create the runbook stub**

```bash
mkdir -p docs/superpowers/plans
cat > docs/superpowers/plans/notes-demo-recovery-runbook.md <<'EOF'
# Notes-demo recovery — runbook

Operational record for the recovery executed against `https://platform.rntme.com`
and `https://dokploy.vladpr.com`. Spec: `docs/superpowers/specs/2026-05-01-notes-demo-recovery-design.md`.

## Identifiers (captured 2026-05-01 brainstorm)
- Org: `test-organization` (id `acbad7d1-2a45-48cf-9381-ac144fdb3e25`)
- Project: `notes-demo` (id `bb207638-71da-49b0-b93b-eb02e14ec4c3`)
- Project version: `seq=2` digest `sha256:0ae3ad9950d4a10f4c0a12c279ecc8de52b4b35db5e561b4fd49f1eb77c92a0a`
- Deploy targets at start: `dokploy-demos` (id `6201f45e-abfe-4e13-8c7c-b472da2b69c9`, default), `dokploy-rnt-364` (id `91d34e40-b4ac-4040-89b1-a9d9a89d346a`)
- Dokploy project: `rntme-demos` (id `A_FqV_wcGzoh4K-Nq5xVB`, env `C2epQ14S_Go4VN6eP8wxv`)
- Postgres: `platform-pg-gzfrsm` (id `xK9g1NniBWBjr67ciIDxB`)

## Step outputs
(filled by tasks below)
EOF
```

- [ ] **Step 2: Configure CLI credentials with the PAT from `.env`**

Read `RNTME_TOKEN` from `.env`. Then:
```bash
mkdir -p ~/.rntme
chmod 700 ~/.rntme
RNTME_TOKEN=$(grep '^RNTME_TOKEN=' .env | cut -d= -f2-)
cat > ~/.rntme/credentials.json <<EOF
{
  "version": 1,
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "baseUrl": "https://platform.rntme.com",
      "token": "${RNTME_TOKEN}",
      "addedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
  }
}
EOF
chmod 600 ~/.rntme/credentials.json
```

- [ ] **Step 3: Verify CLI sees the same subject as `/v1/auth/me`**

```bash
node apps/cli/dist/bin/cli.js whoami
```

Expected: prints `vladprsib@gmail.com`, org `test-organization`, role `admin`. Append the literal output to the runbook under `## Step 4 — credentials`.

If `dist/bin/cli.js` does not exist, run `pnpm -F @rntme/cli build` first.

### Task 5: Delete the broken `dokploy-demos` target

**Files:**
- Modify: `docs/superpowers/plans/notes-demo-recovery-runbook.md`

- [ ] **Step 1: Capture the current state for posterity**

```bash
RNTME_TOKEN=$(grep '^RNTME_TOKEN=' .env | cut -d= -f2-)
curl -sS -H "Authorization: Bearer $RNTME_TOKEN" \
  "https://platform.rntme.com/v1/orgs/test-organization/deploy-targets/dokploy-demos" \
  | tee /tmp/dokploy-demos-before.json
```

Append `/tmp/dokploy-demos-before.json` content (the redacted JSON — `apiTokenRedacted: "***"` already) into the runbook under `## Step 5 — delete dokploy-demos`.

- [ ] **Step 2: Delete the target**

```bash
RNTME_TOKEN=$(grep '^RNTME_TOKEN=' .env | cut -d= -f2-)
curl -sS -X DELETE -H "Authorization: Bearer $RNTME_TOKEN" \
  -w "\nHTTP %{http_code}\n" \
  "https://platform.rntme.com/v1/orgs/test-organization/deploy-targets/dokploy-demos"
```

Expected: `HTTP 204`. If the response is `HTTP 409` with code `DEPLOY_TARGET_IN_USE`, list deployments that reference target id `6201f45e-...` and abort: there is a live deployment we did not expect.

- [ ] **Step 3: Verify only the rnt-364 target remains**

```bash
curl -sS -H "Authorization: Bearer $RNTME_TOKEN" \
  "https://platform.rntme.com/v1/orgs/test-organization/deploy-targets" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('count:',len(d['targets'])); [print(' -', t['slug'], 'isDefault:', t['isDefault']) for t in d['targets']]"
```

Expected: `count: 1` and one line `- dokploy-rnt-364 isDefault: False`. Append to runbook.

### Task 6: PATCH `dokploy-rnt-364` into the canonical notes-demo target

**Files:**
- Modify: `docs/superpowers/plans/notes-demo-recovery-runbook.md`

- [ ] **Step 1: PATCH publicBaseUrl + displayName**

```bash
RNTME_TOKEN=$(grep '^RNTME_TOKEN=' .env | cut -d= -f2-)
curl -sS -X PATCH -H "Authorization: Bearer $RNTME_TOKEN" -H "Content-Type: application/json" \
  -w "\nHTTP %{http_code}\n" \
  "https://platform.rntme.com/v1/orgs/test-organization/deploy-targets/dokploy-rnt-364" \
  -d '{
    "displayName": "Notes demo (Dokploy)",
    "publicBaseUrl": "https://notes-demo.rntme.com"
  }'
```

Expected: `HTTP 200` with the updated target. If the route does not accept `publicBaseUrl` in the patch body (response body has `PLATFORM_PARSE_BODY_INVALID`), open `packages/platform/platform-core/src/use-cases/deploy-targets.ts` and confirm the field is in `UpdateDeployTargetRequestSchema`. If absent, add it (this would be a small platform-core PR splice — record the gap in the runbook and pause for review before adding).

- [ ] **Step 2: Mark this target as default via the dedicated endpoint**

```bash
curl -sS -X PUT -H "Authorization: Bearer $RNTME_TOKEN" \
  -w "\nHTTP %{http_code}\n" \
  "https://platform.rntme.com/v1/orgs/test-organization/deploy-targets/dokploy-rnt-364/default"
```

Expected: `HTTP 200` with `isDefault: true`.

- [ ] **Step 3: Verify the target shape**

```bash
curl -sS -H "Authorization: Bearer $RNTME_TOKEN" \
  "https://platform.rntme.com/v1/orgs/test-organization/deploy-targets/dokploy-rnt-364" \
  | python3 -m json.tool
```

Confirm: `publicBaseUrl: "https://notes-demo.rntme.com"`, `isDefault: true`, `auth.auth0.clientId` is non-empty, `modules.identity-auth0.image` is set (will be replaced in Task 8), `eventBus.brokers` points at Redpanda Cloud, `dokployProjectId: "A_FqV_wcGzoh4K-Nq5xVB"`. Paste the redacted JSON into the runbook.

### Task 7: Build runtime + identity-auth0 images from `main`

**Files:**
- Modify: `docs/superpowers/plans/notes-demo-recovery-runbook.md`

- [ ] **Step 1: Capture the current `main` SHA on origin**

```bash
git fetch origin main
MAIN_SHA=$(git rev-parse --short=7 origin/main)
echo "main = $MAIN_SHA"
```

Append `MAIN_SHA` value to the runbook.

- [ ] **Step 2: Dispatch the runtime image workflow with tag `runtime-main-<sha>`**

```bash
gh workflow run runtime-image.yml --ref main -f tag=runtime-main-${MAIN_SHA}
```

Expected: `Created workflow_dispatch event for runtime-image.yml at main`.

- [ ] **Step 3: Dispatch the identity-auth0 image workflow with tag `identity-auth0-main-<sha>`**

```bash
gh workflow run identity-auth0-image.yml --ref main -f tag=identity-auth0-main-${MAIN_SHA}
```

- [ ] **Step 4: Wait for both workflow runs to succeed**

```bash
gh run list --workflow=runtime-image.yml --limit=3
gh run list --workflow=identity-auth0-image.yml --limit=3
```

Watch the most recent run id with `gh run watch <id>` until status is `completed` and conclusion is `success`. If either fails, read the run logs and stop — recovery cannot proceed without these images.

- [ ] **Step 5: Verify both tags exist in GHCR**

You will need a GHCR PAT with `read:packages` scope. If `GHCR_TOKEN` is not in `.env`, ask the user for one and add it to `.env` (do not commit `.env`).

```bash
GHCR_TOKEN=$(grep '^GHCR_TOKEN=' .env | cut -d= -f2-)
GHCR_BEARER=$(curl -sS -u "vladprrs:${GHCR_TOKEN}" "https://ghcr.io/token?service=ghcr.io&scope=repository:vladprrs/rntme-runtime:pull" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
curl -sI -H "Authorization: Bearer $GHCR_BEARER" \
  "https://ghcr.io/v2/vladprrs/rntme-runtime/manifests/runtime-main-${MAIN_SHA}" | head -3
GHCR_BEARER=$(curl -sS -u "vladprrs:${GHCR_TOKEN}" "https://ghcr.io/token?service=ghcr.io&scope=repository:vladprrs/rntme-identity-auth0:pull" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
curl -sI -H "Authorization: Bearer $GHCR_BEARER" \
  "https://ghcr.io/v2/vladprrs/rntme-identity-auth0/manifests/identity-auth0-main-${MAIN_SHA}" | head -3
```

Expected: both return `HTTP/2 200`. Append the two image refs to the runbook in a code block titled `## Step 7 — image refs`.

### Task 8: Update target with the new identity-auth0 image

**Files:**
- Modify: `docs/superpowers/plans/notes-demo-recovery-runbook.md`

- [ ] **Step 1: PATCH the target's `modules.identity-auth0.image`**

```bash
RNTME_TOKEN=$(grep '^RNTME_TOKEN=' .env | cut -d= -f2-)
NEW_IMAGE="ghcr.io/vladprrs/rntme-identity-auth0:identity-auth0-main-${MAIN_SHA}"
curl -sS -X PATCH -H "Authorization: Bearer $RNTME_TOKEN" -H "Content-Type: application/json" \
  -w "\nHTTP %{http_code}\n" \
  "https://platform.rntme.com/v1/orgs/test-organization/deploy-targets/dokploy-rnt-364" \
  -d "$(jq -nc --arg img "$NEW_IMAGE" '{
    modules: {
      "identity-auth0": {
        image: $img,
        env: { AUTH0_DOMAIN: "demo-rntme.us.auth0.com" },
        expose: false
      }
    }
  }')"
```

Expected: `HTTP 200`, response shows `modules.identity-auth0.image` equals `$NEW_IMAGE`.

If the PATCH replaces the whole `modules` map (not merges), confirm `auth.auth0` is still set after the call:
```bash
curl -sS -H "Authorization: Bearer $RNTME_TOKEN" \
  "https://platform.rntme.com/v1/orgs/test-organization/deploy-targets/dokploy-rnt-364" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); t=d['target']; print('image:', t['modules']['identity-auth0']['image']); print('auth.auth0.clientId:', t['auth'].get('auth0',{}).get('clientId'))"
```

If `auth.auth0.clientId` is missing after the PATCH, restore it with another PATCH carrying both `auth` and `modules` together. Append both responses to the runbook.

### Task 9: Auth0 SPA pre-flight

**Files:**
- Modify: `docs/superpowers/plans/notes-demo-recovery-runbook.md`

- [ ] **Step 1: Verify SPA app callbacks via Management API**

Use the Auth0 management credentials from `.env`. Get a management token:

```bash
AUTH0_DOMAIN=$(grep '^AUTH0_DOMAIN=' .env | cut -d= -f2-)
AUTH0_MGMT_AUD=$(grep '^AUTH0_MANAGEMENT_AUDIENCE=' .env | cut -d= -f2-)
AUTH0_MGMT_CID=$(grep '^AUTH0_MANAGEMENT_CLIENT_ID=' .env | cut -d= -f2-)
AUTH0_MGMT_SEC=$(grep '^AUTH0_MANAGEMENT_CLIENT_SECRET=' .env | cut -d= -f2-)
M2M=$(curl -sS -X POST -H 'content-type: application/json' \
  "https://${AUTH0_DOMAIN}/oauth/token" \
  -d "$(jq -nc --arg cid "$AUTH0_MGMT_CID" --arg sec "$AUTH0_MGMT_SEC" --arg aud "$AUTH0_MGMT_AUD" '{client_id:$cid,client_secret:$sec,audience:$aud,grant_type:"client_credentials"}')" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
SPA_CID="imxBZKGfAPj61xOdf13xLB6DVQyQDNTT"
curl -sS -H "Authorization: Bearer $M2M" \
  "https://${AUTH0_DOMAIN}/api/v2/clients/${SPA_CID}?fields=callbacks,allowed_logout_urls,web_origins,allowed_origins" \
  | python3 -m json.tool
```

Expected: `callbacks`, `allowed_logout_urls`, `web_origins`, `allowed_origins` each include `https://notes-demo.rntme.com/` (or for origins: `https://notes-demo.rntme.com`).

- [ ] **Step 2: If any are missing, PATCH the SPA app**

```bash
curl -sS -X PATCH -H "Authorization: Bearer $M2M" -H 'content-type: application/json' \
  -w "\nHTTP %{http_code}\n" \
  "https://${AUTH0_DOMAIN}/api/v2/clients/${SPA_CID}" \
  -d '{
    "callbacks":          ["https://notes-demo.rntme.com/"],
    "allowed_logout_urls":["https://notes-demo.rntme.com/"],
    "web_origins":        ["https://notes-demo.rntme.com"],
    "allowed_origins":    ["https://notes-demo.rntme.com"]
  }'
```

Expected: `HTTP 200`. If existing values must be preserved, include them in the array (Auth0 PATCH on these fields replaces, not merges).

- [ ] **Step 3: Verify the API resource server identifier**

```bash
curl -sS -H "Authorization: Bearer $M2M" \
  "https://${AUTH0_DOMAIN}/api/v2/resource-servers" \
  | python3 -c "import sys,json; rs=json.load(sys.stdin); [print(r['identifier'], r.get('name')) for r in rs]"
```

Expected: at least one resource server with identifier exactly `https://notes-demo.rntme.com/api`. If absent, create it via `POST /api/v2/resource-servers` with `identifier=https://notes-demo.rntme.com/api`, `signing_alg=RS256`, name `notes-demo API`. Append the result to the runbook.

### Task 10: Trigger the live deployment

**Files:**
- Modify: `docs/superpowers/plans/notes-demo-recovery-runbook.md`

- [ ] **Step 1: POST the deployment**

```bash
RNTME_TOKEN=$(grep '^RNTME_TOKEN=' .env | cut -d= -f2-)
RUNTIME_IMAGE="ghcr.io/vladprrs/rntme-runtime:runtime-main-${MAIN_SHA}"
DEPLOY=$(curl -sS -X POST -H "Authorization: Bearer $RNTME_TOKEN" -H 'Content-Type: application/json' \
  "https://platform.rntme.com/v1/orgs/test-organization/projects/notes-demo/deployments" \
  -d "$(jq -nc --arg img "$RUNTIME_IMAGE" '{
    projectVersionSeq: 2,
    targetSlug: "dokploy-rnt-364",
    configOverrides: { runtimeImage: $img }
  }')")
echo "$DEPLOY" | python3 -m json.tool
DEPLOYMENT_ID=$(echo "$DEPLOY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["deployment"]["id"])')
echo "deployment id = $DEPLOYMENT_ID"
```

Expected: HTTP 202 with a deployment id. Capture `$DEPLOYMENT_ID`.

- [ ] **Step 2: Poll deployment status until terminal**

```bash
SINCE=0
while true; do
  STATUS=$(curl -sS -H "Authorization: Bearer $RNTME_TOKEN" \
    "https://platform.rntme.com/v1/orgs/test-organization/projects/notes-demo/deployments/${DEPLOYMENT_ID}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["deployment"]["status"])')
  LOGS=$(curl -sS -H "Authorization: Bearer $RNTME_TOKEN" \
    "https://platform.rntme.com/v1/orgs/test-organization/projects/notes-demo/deployments/${DEPLOYMENT_ID}/logs?sinceLineId=${SINCE}")
  NEW_SINCE=$(echo "$LOGS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("lastLineId",0))')
  echo "$LOGS" | python3 -c 'import sys,json; [print(l["ts"],l["step"],l["level"],l["message"]) for l in json.load(sys.stdin)["lines"]]'
  echo "status=$STATUS"
  case "$STATUS" in
    succeeded|succeeded_with_warnings|failed|failed_orphaned) break ;;
  esac
  SINCE=$NEW_SINCE
  sleep 2
done
```

Append all log lines and the final deployment record (full JSON of the `GET /deployments/<id>`) to the runbook under `## Step 10 — deployment <id>`.

- [ ] **Step 3: Branch on terminal status**

- `succeeded` → skip to Task 12.
- `succeeded_with_warnings` and `verificationReport.checks` shows `ui` not OK → proceed to Task 11.
- `failed` → record `errorCode` + `errorMessage` in runbook, then go to Task 11 with the error code as the entry point.
- `failed_orphaned` → platform-http restarted mid-deploy. Re-run Task 10 once. If it happens again, record and pause.

### Task 11: Diagnose and fix `app` boot failure (only if needed)

**Files:**
- Modify: `docs/superpowers/plans/notes-demo-recovery-runbook.md`
- Modify (whichever is found): blueprint, deploy target config, or `packages/runtime/runtime` source

This task is the live execution of the failure tree from spec §7. Each sub-step corresponds to a branch.

- [ ] **Step 1: Find the rendered `app` resource in Dokploy and read first 200 boot lines**

The rendered name is `rntme-test-organization-notes-demo-app`. Find its applicationId:

```bash
mcp_call mcp__dokploy__application-search q=app environmentId=C2epQ14S_Go4VN6eP8wxv
```

(Use the actual MCP invocation in your session; this is the request shape.) Get the matching `applicationId`, then:

```bash
mcp_call mcp__dokploy__application-readLogs applicationId=<id> tail=200
```

Append the first 200 lines verbatim to the runbook under `## Step 11 — app boot logs`.

- [ ] **Step 2: Categorize the failure into one branch**

Map the log lines to the spec §7 failure tree:

- `error: image pull failed` / `manifest unknown` → **A1** (image tag wrong) — return to Task 7 and re-build.
- `process exited with code <N>` within first 5 seconds → **A2** (entrypoint fails) — `pnpm -F @rntme/runtime build` locally, run `node packages/runtime/runtime/dist/bin/server.js` with the same env to reproduce; fix; re-build; re-deploy.
- `OOM killed` → **A3** — increase the workload memory in `packages/deploy/deploy-dokploy/src/render.ts` (today there is no memory cap; would need `memoryLimit` plumbed through). Record as a follow-up.
- `listening on 0.0.0.0:<not-3000>` → **B1** — the runtime image binds the wrong port; fix the runtime source so it listens on `:3000` (nginx upstream is hardcoded `:3000` in `render.ts:105`); rebuild image; redeploy.
- `kafka` / `broker` / `sasl` / `redpanda` errors → **C1** — verify against Redpanda Cloud which user (`rntme-demo` vs `notes-demo` from the duplicated `.env` line) is provisioned; verify topic prefix; PATCH `eventBus.security.secretRefs` and `eventBus.topicPrefix` on the target; redeploy.
- `identity-auth0` / `grpc` / `:50051` errors → **C2** — verify the integration-module resource is up via `mcp__dokploy__application-one`; if it is, check that resource name `rntme-test-organization-notes-demo-identity-auth0` matches what runtime tries to dial.
- `ENOENT /srv/artifacts/<file>` → **C4** — compare `applyResult.resources` (from the deployment record) against `mcp__dokploy__application-one` mounts; if a file is missing on disk but present in render, this is a deploy-dokploy `applyDokployPlan` bug. Capture and pause.

- [ ] **Step 3: Implement the fix from the matched branch**

Each branch above has a specific remediation. Make the change in a focused commit (separate from PR 1 if it touches code).

- [ ] **Step 4: Redeploy and re-poll**

Re-run Task 10 Step 1 + Step 2 with the new fix in place. Loop back to Step 1 of this task if the verification still fails. Record every iteration in the runbook (timestamp, hypothesis, fix, outcome).

- [ ] **Step 5: Stop after three iterations and escalate to architecture review**

Per the systematic-debugging skill: if three rounds of `app boot logs → fix → redeploy` do not produce `status=succeeded` with UI HTTP 200, stop. Append a clear summary to the runbook of: the last three hypotheses, what was tried, current evidence. Pause and ask for review before further attempts.

### Task 12: Acceptance evidence

**Files:**
- Modify: `docs/superpowers/plans/notes-demo-recovery-runbook.md`

- [ ] **Step 1: Capture HTTP probes**

```bash
for path in /health / /api; do
  echo "=== $path ===" >> /tmp/notes-demo-acceptance.txt
  curl -sS -o /dev/null -D - -w "HTTP %{http_code} time=%{time_total}s\n" \
    "https://notes-demo.rntme.com${path}" -m 15 >> /tmp/notes-demo-acceptance.txt 2>&1
done

echo "=== /_layouts/main.json (auth gating) ===" >> /tmp/notes-demo-acceptance.txt
curl -sS https://notes-demo.rntme.com/_layouts/main.json -m 15 \
  | python3 -c "import sys,json; d=json.load(sys.stdin); els=d['spec']['elements']; assert 'anonRoot' in els and els['anonRoot']['type']=='LoginScreen', f'anonRoot/LoginScreen missing: {list(els.keys())}'; print('OK: LoginScreen present')" \
  >> /tmp/notes-demo-acceptance.txt 2>&1

echo "=== /assets/main.js (auth0 bundle) ===" >> /tmp/notes-demo-acceptance.txt
HITS=$(curl -sS https://notes-demo.rntme.com/assets/main.js -m 30 | grep -c "auth0")
test "$HITS" -gt 0 && echo "OK: auth0-spa-js bundled ($HITS hits)" >> /tmp/notes-demo-acceptance.txt \
  || echo "FAIL: auth0 not bundled" >> /tmp/notes-demo-acceptance.txt

cat /tmp/notes-demo-acceptance.txt
```

Expected: `/health` → `200`; `/` → `200` `text/html`; `/api` → `200` or `401` (both prove the upstream is up; with the new edge auth render, an unauthenticated `/api` call returns `401` with `{"code":"RUNTIME_AUTH_TOKEN_INVALID"}`); the layout probe prints `OK: LoginScreen present`; the bundle probe prints `OK: auth0-spa-js bundled`. Append all output to the runbook under `## Step 12 — acceptance probes`.

- [ ] **Step 2: Manual browser smoke per `demo/notes-blueprint/README.md`**

Open `https://notes-demo.rntme.com/` in a browser and run the 5 user-test steps from `demo/notes-blueprint/README.md` §"User test after deploy". Append a paragraph to the runbook describing what worked / did not work for each step.

- [ ] **Step 3: Commit the runbook**

```bash
git add docs/superpowers/plans/notes-demo-recovery-runbook.md
git commit -m "docs(plan): notes-demo recovery runbook"
```

- [ ] **Step 4: Open PR 2**

```bash
git push -u origin HEAD
gh pr create --title "docs(plan): notes-demo recovery runbook" --body "$(cat <<'EOF'
## Summary
- Operational record for the recovery executed per docs/superpowers/specs/2026-05-01-notes-demo-recovery-design.md.
- Captures: deleted target id, patched target shape, image SHAs, deployment id, log excerpts, root cause for the 502 on `/`, acceptance evidence.

## Test plan
- [x] curl https://notes-demo.rntme.com/ returns 200 text/html
- [x] browser flow per demo/notes-blueprint/README.md User test 1–5

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review (executed before publishing this plan)

**1. Spec coverage:**
- Spec §6 Step 1 (CLI creds) → Task 4. ✓
- Spec §6 Step 2 (delete dokploy-demos) → Task 5. ✓
- Spec §6 Step 3 (PATCH rnt-364 → notes-demo shape) → Task 6. ✓
- Spec §6 Step 4 (build images) → Task 7. ✓
- Spec §6 Step 4 cont. (PATCH module image) → Task 8. ✓
- Spec §6 Step 5 (executor.ts path fix + test) → Tasks 1, 2, 3 in PR 1. ✓
- Spec §6 Step 6 (live deploy) → Task 10. ✓
- Spec §6 Step 7 (502 diagnostic tree) → Task 11. ✓
- Spec §6 Step 8 (acceptance) → Task 12. ✓
- Spec §3 D6 / Auth0 audience pre-flight → Task 9. ✓
- Spec §10 doc-touch (apps/platform-http/README.md) → Task 3. ✓
- Spec §10 doc-touch (operational record) → runbook tracked through Tasks 4–12. ✓

**2. Placeholder scan:** none of the steps say "TBD", "implement later", or "handle edge cases" — every code/curl block is concrete.

**3. Type / signature consistency:** `readUiRuntimeCss(workspaceRoot: string): string` is the same name in Task 1 (export change), Task 2 (body replacement), Task 3 (README mention). Curl URLs and target slugs are consistent across Tasks 5–10.

**4. Honest about unknown:** Task 11 explicitly cannot prescribe a single fix (the 502 root cause is unknown until live boot logs exist). The plan handles this by giving a categorization rule and a 3-iteration cap. This is the right shape for a debugging task; do not rewrite it as a deterministic step.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-01-notes-demo-recovery.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
