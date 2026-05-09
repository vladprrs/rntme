# Platform Runtime Cutover And CLI Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/platform-http` a thin launcher/edge for the platform blueprint runtime and update the CLI to use the new breaking platform API surface.

**Architecture:** The platform blueprint becomes the active runtime source. `apps/platform-http` keeps process/env/bootstrap responsibilities and any explicitly documented bridge seams, but no longer owns platform domain routes. The CLI moves to the new generated/canonical API without preserving `/v1/*` compatibility.

**Tech Stack:** `@rntme/runtime`, `@rntme/blueprint`, `@rntme/bindings-http`, `@rntme/ui-runtime`, Hono launcher, TypeScript, Vitest, CLI tests, pnpm.

---

## Scope Boundary

This plan depends on the foundation, Auth0, deployments-service, and UI artifact plans. It is the cutover plan. It may modify `apps/platform-http` and `apps/cli`. It must not keep a compatibility shim for old `/v1/*` unless a concrete blocker is documented in the task that finds it.

## File Structure

- Create `apps/platform-http/src/platform-runtime/load-platform-blueprint.ts` — loads and composes `apps/platform/blueprint`.
- Create `apps/platform-http/src/platform-runtime/create-platform-runtime-app.ts` — wraps `@rntme/runtime` or runtime surfaces for the platform blueprint.
- Modify `apps/platform-http/src/app.ts` — route new runtime app and retire legacy route registrations behind `PLATFORM_RUNTIME_MODE`.
- Modify `apps/platform-http/src/bin/server.ts` — boot runtime launcher.
- Modify `apps/cli/src/api/client.ts` and platform commands — call new API paths.
- Create `apps/platform-http/test/unit/platform-runtime/*.test.ts`.
- Modify or create CLI integration tests for publish/deploy/list/show against the new API.
- Update owner docs for `apps/platform-http`, `apps/platform`, and `apps/cli`.

## Tasks

### Task 1: Add Platform Blueprint Loader In platform-http

**Files:**
- Create: `apps/platform-http/src/platform-runtime/load-platform-blueprint.ts`
- Create: `apps/platform-http/test/unit/platform-runtime/load-platform-blueprint.test.ts`

- [ ] **Step 1: Write failing loader test**

Create `apps/platform-http/test/unit/platform-runtime/load-platform-blueprint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadPlatformBlueprint } from '../../../src/platform-runtime/load-platform-blueprint.js';

describe('loadPlatformBlueprint', () => {
  it('loads the platform blueprint from the repo apps/platform path', async () => {
    const result = await loadPlatformBlueprint();
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;
    expect(result.value.project.name).toBe('rntme-platform');
    expect(result.value.services.app?.compiledUi).toBeDefined();
    expect(result.value.services.deployments).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/platform-runtime/load-platform-blueprint.test.ts
```

Expected: FAIL because loader file does not exist.

- [ ] **Step 3: Add loader**

Create `apps/platform-http/src/platform-runtime/load-platform-blueprint.ts`:

```ts
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint, type ComposedBlueprint, type Result } from '@rntme/blueprint';

const here = dirname(fileURLToPath(import.meta.url));

export async function loadPlatformBlueprint(root = resolve(here, '../../../../apps/platform/blueprint')): Promise<Result<ComposedBlueprint>> {
  return loadComposedBlueprint(root);
}
```

- [ ] **Step 4: Run loader test**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/platform-runtime/load-platform-blueprint.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/platform-runtime/load-platform-blueprint.ts apps/platform-http/test/unit/platform-runtime/load-platform-blueprint.test.ts
git commit -m "feat(platform-http): load platform blueprint"
```

### Task 2: Add Runtime App Factory

**Files:**
- Create: `apps/platform-http/src/platform-runtime/create-platform-runtime-app.ts`
- Create: `apps/platform-http/test/unit/platform-runtime/create-platform-runtime-app.test.ts`

- [ ] **Step 1: Write factory test**

Create `apps/platform-http/test/unit/platform-runtime/create-platform-runtime-app.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlatformRuntimeApp } from '../../../src/platform-runtime/create-platform-runtime-app.js';
import { loadPlatformBlueprint } from '../../../src/platform-runtime/load-platform-blueprint.js';

describe('createPlatformRuntimeApp', () => {
  it('serves platform UI and API health surfaces', async () => {
    const loaded = await loadPlatformBlueprint();
    expect(loaded.ok, loaded.ok ? '' : JSON.stringify(loaded.errors, null, 2)).toBe(true);
    if (!loaded.ok) return;

    const app = await createPlatformRuntimeApp({ blueprint: loaded.value });
    const ui = await app.request('/');
    expect(ui.status).toBe(200);

    const manifest = await app.request('/_manifest.json');
    expect(manifest.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/platform-runtime/create-platform-runtime-app.test.ts
```

Expected: FAIL because factory file does not exist.

- [ ] **Step 3: Implement factory using current runtime/UI surfaces**

Create `apps/platform-http/src/platform-runtime/create-platform-runtime-app.ts`:

```ts
import { Hono } from 'hono';
import { createApp as createUiRuntimeApp } from '@rntme/ui-runtime/server';
import type { ComposedBlueprint } from '@rntme/blueprint';

export type CreatePlatformRuntimeAppOptions = {
  readonly blueprint: ComposedBlueprint;
};

export async function createPlatformRuntimeApp(opts: CreatePlatformRuntimeAppOptions): Promise<Hono> {
  const app = new Hono();
  const ui = opts.blueprint.services.app?.compiledUi;
  if (ui === undefined || ui === null) {
    throw new Error('PLATFORM_RUNTIME_UI_MISSING');
  }
  app.route('/', createUiRuntimeApp({ artifact: ui }));
  return app;
}
```

This first factory proves the UI runtime mount. API binding runtime is added in Task 3 because it needs operation execution/storage wiring.

- [ ] **Step 4: Run factory test**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/platform-runtime/create-platform-runtime-app.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/platform-runtime/create-platform-runtime-app.ts apps/platform-http/test/unit/platform-runtime/create-platform-runtime-app.test.ts
git commit -m "feat(platform-http): create platform runtime app"
```

### Task 3: Mount Generated Platform API

**Files:**
- Modify: `apps/platform-http/src/platform-runtime/create-platform-runtime-app.ts`
- Create: `apps/platform-http/test/unit/platform-runtime/platform-api.test.ts`

- [ ] **Step 1: Write API mount test**

Create `apps/platform-http/test/unit/platform-runtime/platform-api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlatformRuntimeApp } from '../../../src/platform-runtime/create-platform-runtime-app.js';
import { loadPlatformBlueprint } from '../../../src/platform-runtime/load-platform-blueprint.js';

describe('platform generated API', () => {
  it('exposes generated OpenAPI for platform services', async () => {
    const loaded = await loadPlatformBlueprint();
    expect(loaded.ok, loaded.ok ? '' : JSON.stringify(loaded.errors, null, 2)).toBe(true);
    if (!loaded.ok) return;

    const app = await createPlatformRuntimeApp({ blueprint: loaded.value });
    const res = await app.request('/api/projects/openapi.json');
    expect([200, 404]).toContain(res.status);
  });
});
```

The initial assertion allows `404` only before API runtime wiring. Step 3 tightens it to `200`.

- [ ] **Step 2: Run test**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/platform-runtime/platform-api.test.ts
```

Expected: PASS with status `404` before implementation.

- [ ] **Step 3: Wire API binding runtime**

Update `createPlatformRuntimeApp` to mount each service's compiled bindings with the established runtime surface. Use `@rntme/runtime` `HttpSurface` if a whole `ValidatedService` is available; otherwise mount `@rntme/bindings-http` directly with the same dependencies used by `HttpSurface`. The implementation must:

- mount `organizations` under `/api/organizations`;
- mount `projects` under `/api/projects`;
- mount `tokens` under `/api/tokens`;
- mount `audit` under `/api/audit`;
- mount `deployments` under `/api/deployments`;
- keep UI mounted at `/`.

Tighten the API test expected status:

```ts
expect(res.status).toBe(200);
```

- [ ] **Step 4: Run API tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/platform-runtime/platform-api.test.ts
pnpm -F @rntme/runtime test
pnpm -F @rntme/bindings-http test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/platform-runtime/create-platform-runtime-app.ts apps/platform-http/test/unit/platform-runtime/platform-api.test.ts
git commit -m "feat(platform-http): mount generated platform API"
```

### Task 4: Switch platform-http App To Runtime Launcher

**Files:**
- Modify: `apps/platform-http/src/app.ts`
- Modify: `apps/platform-http/src/bin/server.ts`
- Create: `apps/platform-http/test/unit/platform-runtime/cutover.test.ts`

- [ ] **Step 1: Write cutover test**

Create `apps/platform-http/test/unit/platform-runtime/cutover.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadPlatformBlueprint } from '../../../src/platform-runtime/load-platform-blueprint.js';
import { createPlatformRuntimeApp } from '../../../src/platform-runtime/create-platform-runtime-app.js';

describe('platform runtime cutover surface', () => {
  it('does not expose legacy v1 routes from the runtime app', async () => {
    const loaded = await loadPlatformBlueprint();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const app = await createPlatformRuntimeApp({ blueprint: loaded.value });
    const legacy = await app.request('/v1/auth/me');
    expect(legacy.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run cutover test**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/platform-runtime/cutover.test.ts
```

Expected: PASS against runtime app.

- [ ] **Step 3: Add launcher mode in app.ts**

Modify `apps/platform-http/src/app.ts` so `createApp(deps)` checks a new env flag `PLATFORM_RUNTIME_MODE`. When it equals `"blueprint"`, it loads the platform blueprint and routes all traffic to `createPlatformRuntimeApp`. Keep legacy behavior for `"legacy"` until deploy config switches.

Add type to `Env` in `apps/platform-http/src/config/env.ts`:

```ts
PLATFORM_RUNTIME_MODE: z.enum(['legacy', 'blueprint']).default('legacy')
```

- [ ] **Step 4: Add app test for blueprint mode**

Extend existing `apps/platform-http/test/unit/app.test.ts` or create a new test that constructs env with `PLATFORM_RUNTIME_MODE: 'blueprint'` and asserts `/v1/auth/me` returns `404` while `/_manifest.json` returns `200`.

- [ ] **Step 5: Run app tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/app.test.ts test/unit/platform-runtime/cutover.test.ts
pnpm -F @rntme/platform-http typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/platform-http/src/app.ts apps/platform-http/src/config/env.ts apps/platform-http/test/unit/app.test.ts apps/platform-http/test/unit/platform-runtime/cutover.test.ts
git commit -m "feat(platform-http): add blueprint runtime mode"
```

### Task 5: Update CLI API Client To New Surface

**Files:**
- Modify: `apps/cli/src/api/client.ts`
- Modify: CLI command files under `apps/cli/src/commands/**`
- Modify or create tests under `apps/cli/test/**`

- [ ] **Step 1: Locate old `/v1` usage**

Run:

```bash
rg -n '"/v1|`/v1|/v1/' apps/cli/src apps/cli/test
```

Expected: list of API client and command call sites.

- [ ] **Step 2: Update API client base paths**

In `apps/cli/src/api/client.ts`, remove hard-coded `/v1` path construction. Add named methods for the new surface:

```ts
export const PLATFORM_API = {
  projects: '/api/projects',
  deployments: '/api/deployments',
  deployTargets: '/api/deployments/targets',
  tokens: '/api/tokens',
  audit: '/api/audit',
} as const;
```

Use these constants in request methods.

- [ ] **Step 3: Update project publish/list/show commands**

Change project commands to call:

- `GET /api/projects`
- `POST /api/projects`
- `POST /api/projects/{projectId}/versions`
- `GET /api/projects/{projectId}/versions`

Use the emitted binding paths asserted by `platform-blueprint.test.ts`: `/api/projects`, `/api/deployments`, `/api/deployments/targets`, `/api/tokens`, and `/api/audit`. Do not preserve old org-slug path nesting.

- [ ] **Step 4: Update deployment commands**

Change deployment commands to call:

- `POST /api/deployments`
- `GET /api/deployments`
- `GET /api/deployments/{deploymentId}`
- `GET /api/deployments/{deploymentId}/logs`

- [ ] **Step 5: Update CLI tests**

For each changed command test, update expected request paths to the new API constants. Example assertion:

```ts
expect(fetchCalls[0]?.url).toContain('/api/deployments');
expect(fetchCalls[0]?.url).not.toContain('/v1/');
```

- [ ] **Step 6: Run CLI tests**

Run:

```bash
pnpm -F @rntme/cli test
pnpm -F @rntme/cli typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/cli/src apps/cli/test
git commit -m "feat(cli): use platform blueprint API"
```

### Task 6: Remove Legacy Route Ownership In Blueprint Mode

**Files:**
- Modify: `apps/platform-http/src/app.ts`
- Modify: `docs/current/owners/apps/platform-http.md`

- [ ] **Step 1: Add regression test**

Add to `apps/platform-http/test/unit/platform-runtime/cutover.test.ts`:

```ts
it('serves platform UI manifest in blueprint mode', async () => {
  const loaded = await loadPlatformBlueprint();
  expect(loaded.ok).toBe(true);
  if (!loaded.ok) return;
  const app = await createPlatformRuntimeApp({ blueprint: loaded.value });
  const manifest = await app.request('/_manifest.json');
  expect(manifest.status).toBe(200);
  const body = await manifest.json() as { routes: Record<string, unknown> };
  expect(body.routes['/:orgId']).toBeDefined();
});
```

- [ ] **Step 2: Ensure legacy routes are unreachable in blueprint mode**

In `createApp`, mount legacy `/v1/*` and legacy UI routes only in legacy mode. Blueprint mode returns the runtime app after the global request-id, logger, and error middleware.

- [ ] **Step 3: Run platform-http tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/platform-runtime/cutover.test.ts test/unit/app.test.ts
pnpm -F @rntme/platform-http typecheck
```

Expected: PASS.

- [ ] **Step 4: Update owner doc**

In `docs/current/owners/apps/platform-http.md`, add:

```md
## Blueprint runtime mode

`PLATFORM_RUNTIME_MODE=blueprint` runs the platform-as-blueprint runtime and
does not expose legacy `/v1/*` platform routes. Legacy mode remains only as a
temporary migration fallback until production cutover is complete.
```

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/app.ts apps/platform-http/test/unit/platform-runtime/cutover.test.ts docs/current/owners/apps/platform-http.md
git commit -m "refactor(platform-http): isolate legacy routes behind legacy mode"
```

### Task 7: Final Verification And Documentation

**Files:**
- Modify: `docs/current/owners/apps/platform.md`
- Modify: `docs/current/owners/apps/cli.md`
- Modify: `docs/decision-system.md`

- [ ] **Step 1: Update platform docs**

Add to `docs/current/owners/apps/platform.md`:

```md
## Runtime cutover

The active platform runtime is hosted through `apps/platform-http` blueprint
mode. The platform blueprint is the source of truth for domain API and UI
surfaces. The old `/v1/*` Hono route ownership is not part of blueprint mode.
```

- [ ] **Step 2: Update CLI docs**

In `docs/current/owners/apps/cli.md`, replace old `/v1` API references with the new `/api/*` platform blueprint surface.

- [ ] **Step 3: Promote decision-system status if implementation landed**

In `docs/decision-system.md`, change `Platform as blueprint` from `locked-pending` to `locked` only if blueprint mode is the active production/default mode. If legacy remains default, keep `locked-pending`.

- [ ] **Step 4: Run final CI-equivalent subset**

Run:

```bash
pnpm -F @rntme/platform-http test
pnpm -F @rntme/platform-http typecheck
pnpm -F @rntme/cli test
pnpm -F @rntme/cli typecheck
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts ../../apps/platform/blueprint/test/platform-auth0.test.ts ../../apps/platform/blueprint/test/platform-deployments.test.ts ../../apps/platform/blueprint/test/platform-ui.test.ts
pnpm depcruise
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/current/owners/apps/platform.md docs/current/owners/apps/cli.md docs/decision-system.md
git commit -m "docs(platform): document runtime cutover"
```
