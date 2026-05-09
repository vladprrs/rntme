# Platform Identity/Auth0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach `@rntme/identity-auth0` to the platform blueprint as the first canonical identity provider and protect the platform API/UI routes through rntme auth middleware.

**Architecture:** The platform blueprint uses Auth0 through the existing canonical identity module contract, not WorkOS-specific session code. Auth0 provides gRPC `IntrospectSession`, HTTP edge introspection, browser login/logout boot, and provisioner outputs. This slice changes the target blueprint/auth model and supporting tests; legacy WorkOS code in `apps/platform-http` remains until runtime cutover.

**Tech Stack:** JSON rntme project artifacts, `@rntme/identity-auth0`, `@rntme/contracts-identity-v1`, `@rntme/blueprint`, `@rntme/deploy-core`, Vitest, pnpm.

---

## Scope Boundary

This plan depends on `2026-05-09-platform-blueprint-foundation.md`. It updates the platform blueprint to use Auth0 identity and validates auth wiring. It does not delete WorkOS routes, change CLI auth, or cut over the active platform host.

## File Structure

- Modify `apps/platform/blueprint/project.json` — add Auth0 vars, module, auth middleware, and protected mounts.
- Create `apps/platform/blueprint/services/identity-auth0/service.json` — integration module service descriptor.
- Create `apps/platform/blueprint/node_modules/rntme_identity_auth0/module.json` — test-time module manifest copy or symlink strategy matching demo fixtures.
- Modify service bindings to require `authorization` through `inputFrom`.
- Modify read/action graphs to call `identity-auth0.IntrospectSession` and use the returned session for tenant scoping.
- Create `apps/platform/blueprint/test/platform-auth0.test.ts` — Auth0-specific composition and route protection tests.
- Modify `docs/current/owners/apps/platform.md` — identity/auth section.

## Tasks

### Task 1: Vendor Auth0 Manifest Into Platform Blueprint Test Fixture

**Files:**
- Create: `apps/platform/blueprint/services/identity-auth0/service.json`
- Create or copy: `apps/platform/blueprint/node_modules/rntme_identity_auth0/module.json`

- [ ] **Step 1: Add integration service descriptor**

Create `apps/platform/blueprint/services/identity-auth0/service.json`:

```json
{ "kind": "integration-module" }
```

- [ ] **Step 2: Copy Auth0 module manifest**

Create the directory:

```bash
mkdir -p apps/platform/blueprint/node_modules/rntme_identity_auth0
cp modules/identity/auth0/module.json apps/platform/blueprint/node_modules/rntme_identity_auth0/module.json
```

Expected: `apps/platform/blueprint/node_modules/rntme_identity_auth0/module.json` contains `"contract": "identity/v1"` and `"IntrospectSession"` in `capabilities.rpcs`.

- [ ] **Step 3: Verify manifest capability**

Run:

```bash
rg -n '"IntrospectSession"|"edgeAuth"|"identity/v1"' apps/platform/blueprint/node_modules/rntme_identity_auth0/module.json
```

Expected: all three strings are present.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/blueprint/services/identity-auth0 apps/platform/blueprint/node_modules/rntme_identity_auth0/module.json
git commit -m "feat(platform): add Auth0 identity module fixture"
```

### Task 2: Add Auth0 Module And Protected Mounts

**Files:**
- Modify: `apps/platform/blueprint/project.json`

- [ ] **Step 1: Update project services and vars**

Edit `apps/platform/blueprint/project.json` so the top-level service list includes `identity-auth0` and the following keys exist:

```json
{
  "name": "rntme-platform",
  "services": ["organizations", "projects", "tokens", "audit", "identity-auth0"],
  "vars": {
    "AUTH0_SPA_CLIENT_ID": { "from": "provision.identity.spaClient.id", "required": true },
    "AUTH0_DOMAIN": { "from": "target.auth.auth0.domain", "required": true },
    "AUTH0_AUDIENCE": { "from": "target.auth.auth0.audience", "required": true },
    "AUTH0_REDIRECT_URI": { "from": "target.auth.auth0.redirectUri", "required": true }
  },
  "modules": {
    "identity": {
      "package": "rntme_identity_auth0",
      "publicConfig": {
        "appName": "rntme-platform",
        "domain": "${AUTH0_DOMAIN}",
        "clientId": "${AUTH0_SPA_CLIENT_ID}",
        "audience": "${AUTH0_AUDIENCE}",
        "redirectUri": "${AUTH0_REDIRECT_URI}"
      }
    }
  }
}
```

Keep the existing `routes`, `middleware`, and `mounts` keys and merge into them; do not remove the service routes created by the foundation plan.

- [ ] **Step 2: Add auth middleware**

In `project.json#middleware`, add:

```json
"auth": {
  "kind": "auth",
  "provider": "auth0",
  "audience": "${AUTH0_AUDIENCE}",
  "moduleSlug": "identity-auth0"
}
```

- [ ] **Step 3: Protect all API mounts**

For every `http:` mount in `project.json#mounts`, set `use` to:

```json
["requestContext", "auth"]
```

Expected mounted targets:

```json
[
  { "target": "http:/api/organizations", "use": ["requestContext", "auth"] },
  { "target": "http:/api/projects", "use": ["requestContext", "auth"] },
  { "target": "http:/api/tokens", "use": ["requestContext", "auth"] },
  { "target": "http:/api/audit", "use": ["requestContext", "auth"] }
]
```

- [ ] **Step 4: Run composition and observe expected graph failures**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: FAIL with graph or binding errors naming missing `authorization` inputs. Task 3 fixes those errors.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/blueprint/project.json
git commit -m "feat(platform): protect platform API with Auth0 middleware"
```

### Task 3: Add Authorization Inputs To Platform Bindings

**Files:**
- Modify: `apps/platform/blueprint/services/organizations/bindings/bindings.json`
- Modify: `apps/platform/blueprint/services/projects/bindings/bindings.json`
- Modify: `apps/platform/blueprint/services/tokens/bindings/bindings.json`
- Modify: `apps/platform/blueprint/services/audit/bindings/bindings.json`

- [ ] **Step 1: Add inputFrom to every binding**

For each binding object in all four files, add:

```json
"inputFrom": {
  "authorization": {
    "from": "header",
    "name": "authorization",
    "required": true
  }
}
```

Example final binding shape:

```json
"listOrganizations": {
  "graph": "listOrganizations",
  "target": { "engine": "sqlite", "dialect": "sqlite" },
  "http": {
    "method": "GET",
    "path": "/",
    "parameters": [{ "name": "limit", "in": "query", "bindTo": "limit", "required": false }]
  },
  "exposure": "read",
  "inputFrom": {
    "authorization": { "from": "header", "name": "authorization", "required": true }
  }
}
```

- [ ] **Step 2: Run bindings tests**

Run:

```bash
pnpm -F @rntme/bindings test
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: bindings parser accepts `inputFrom`; graph validation may still fail until Task 4.

- [ ] **Step 3: Commit**

```bash
git add apps/platform/blueprint/services/*/bindings/bindings.json
git commit -m "feat(platform): pass bearer tokens into platform bindings"
```

### Task 4: Call IntrospectSession In Graphs

**Files:**
- Modify: every graph JSON under `apps/platform/blueprint/services/*/graphs/*.json` except `shapes.json`

- [ ] **Step 1: Add authorization input to each graph signature**

For each graph signature, add:

```json
"authorization": { "type": "string", "mode": "required" }
```

- [ ] **Step 2: Add session node to each graph**

Add this node as the first node in each graph:

```json
{
  "id": "session",
  "type": "call",
  "target": {
    "module": "identity-auth0",
    "operation": "IntrospectSession"
  },
  "input": {
    "token": { "$param": "authorization" },
    "audience": { "$literal": "${auth.audience}" }
  },
  "policy": {
    "timeoutMs": 1000,
    "retry": { "attempts": 2, "retryOn": "transient" },
    "idempotency": { "mode": "none" },
    "onError": "fail"
  }
}
```

- [ ] **Step 3: Scope tenant reads by session when an organization id exists**

For graphs that read organization-owned data, add or keep an `organizationId` input and filter by it. Do not derive organization tenancy directly from Auth0 in this plan because platform membership mapping is finalized in the cutover plan.

Example filter condition:

```json
{
  "eq": [
    "projectView.organizationId",
    { "$param": "organizationId" }
  ]
}
```

- [ ] **Step 4: Run focused composition**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: PASS or validation errors pointing to exact graph paths. Fix only graph/binding mismatches.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/blueprint/services/*/graphs apps/platform/blueprint/services/*/bindings
git commit -m "feat(platform): introspect Auth0 sessions in platform graphs"
```

### Task 5: Add Auth0 Composition Tests

**Files:**
- Create: `apps/platform/blueprint/test/platform-auth0.test.ts`

- [ ] **Step 1: Write Auth0 test**

Create `apps/platform/blueprint/test/platform-auth0.test.ts`:

> Note: `catalogManifest.moduleEdgeAuth` is keyed by manifest name (`@rntme/identity-auth0`), not
> the project slot name (`identity`). `discoveredModules` is internal to `loadComposedBlueprint`
> and is NOT exposed on the returned `ComposedBlueprint` type — the rpcs assertion is dropped
> because checking our own vendored copy is tautological; `package` + `moduleEdgeAuth` populated
> already proves Auth0 wiring end-to-end.

```ts
import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '@rntme/blueprint';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform Auth0 wiring', () => {
  it('uses Auth0 as the platform identity module', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.modules?.identity?.package).toBe('rntme_identity_auth0');
    expect(result.value.catalogManifest?.moduleEdgeAuth['@rntme/identity-auth0']).toMatchObject({
      kind: 'introspection-sidecar',
      transport: 'http',
      method: 'GET',
      path: '/introspect',
      port: 50052,
    });
    for (const mount of result.value.project.mounts ?? []) {
      if (mount.target.startsWith('http:')) expect(mount.use).toContain('auth');
    }
  });
});
```

- [ ] **Step 2: Run the new test**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-auth0.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run Auth0 module tests**

Run:

```bash
pnpm -F @rntme/identity-auth0 test
pnpm -F @rntme/identity-auth0 run test:conformance:mock
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/blueprint/test/platform-auth0.test.ts
git commit -m "test(platform): cover Auth0 identity wiring"
```

### Task 6: Documentation Touch

**Files:**
- Modify: `docs/current/owners/apps/platform.md`

- [ ] **Step 1: Add identity section**

Add this section to `docs/current/owners/apps/platform.md`:

```md
## Identity

The platform blueprint uses `@rntme/identity-auth0` as its first identity
provider through the canonical identity contract. Platform API mounts use the
project `auth` middleware with Auth0 edge introspection. Graphs receive the
`Authorization` header through binding `inputFrom.authorization` and call
`identity-auth0.IntrospectSession` for canonical session data.

WorkOS remains a legacy hosted-platform integration until a future provider
parity plan adds canonical session/edge introspection support.
```

- [ ] **Step 2: Verify docs**

Run:

```bash
rg -n "identity-auth0|IntrospectSession|WorkOS" docs/current/owners/apps/platform.md apps/platform/blueprint/project.json
```

Expected: all terms are present.

- [ ] **Step 3: Final verification**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts ../../apps/platform/blueprint/test/platform-auth0.test.ts
pnpm -F @rntme/identity-auth0 test
pnpm -F @rntme/identity-auth0 run test:conformance:mock
pnpm depcruise
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/current/owners/apps/platform.md apps/platform/blueprint
git commit -m "docs(platform): document Auth0 platform identity"
```
