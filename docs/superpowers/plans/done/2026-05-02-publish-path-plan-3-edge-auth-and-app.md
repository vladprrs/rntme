# Publish-Path Hardening — Plan 3: Edge Auth + App Semantics

> **Status (2026-05-03):** Implemented and merged in PRs #119 and #120. Subsequent issue #131 cleanup hardened the integration test from a Hono/Node-http substitute into a real `nginx:1.27-alpine` Testcontainers fixture (see `docs/superpowers/plans/done/2026-05-03-issue-131-cleanup.md` Task 2). The "Hono substitute" prose below is preserved as historical record, not as guidance.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-02-publish-path-end-to-end-hardening-design.md` §6, §8

**Goal:** Diagnose and lock the live edge-auth bypass, add the integration test that fails on regression, replace `createNote`'s client-required `id` with a server-generated UUID via a new graph IR `uuid` node, ship a production React build for the SPA, and add an explicit nginx 404 for `^/_rntme_auth_*` so internal locations no longer fall through to the SPA catch-all.

**Architecture:** Four independent slices: (1) edge-auth root-cause + integration test in `deploy-dokploy`; (2) graph IR `uuid` node + `$node` reference + `createNote` rewrite in `graph-ir-compiler` and notes-blueprint; (3) SPA production build settings in `@rntme/ui-runtime`; (4) nginx renderer adds explicit `^/_rntme_auth_` 404 location before SPA fallback.

**Tech Stack:** TypeScript, Vitest, esbuild (`define` + `minify`), nginx config rendering, Hono mock for sidecar tests.

---

## File Structure

**Create:**
- `packages/deploy/deploy-dokploy/test/integration/edge-auth.test.ts` — real introspect-sidecar + rendered nginx integration test
- `packages/deploy/deploy-dokploy/test/integration/edge-auth-fixtures/nginx-host.ts` — small helper to spawn nginx (or Hono-substitute) with the rendered config
- `packages/artifacts/graph-ir-compiler/src/canonical/uuid-node.ts` — new node type definition
- `packages/artifacts/graph-ir-compiler/test/unit/uuid-node.test.ts`
- `packages/runtime/ui-runtime/test/unit/build.test.ts` — assertion that the bundle has no `react.development`

**Modify:**
- `packages/deploy/deploy-dokploy/src/nginx.ts` — add explicit `^/_rntme_auth_` 404 block; if root cause requires changes, fix the auth_request emission
- `packages/deploy/deploy-dokploy/test/unit/nginx.test.ts` — snapshot the new 404 location and its position
- `packages/artifacts/graph-ir-compiler/src/canonical/normalize.ts` — accept `uuid` node, accept `$node` reference
- `packages/artifacts/graph-ir-compiler/src/lower/` — emit code for the `uuid` node (uses `crypto.randomUUID()`)
- `packages/artifacts/graph-ir-compiler/src/validate/` — `$node` references must resolve; `uuid` outputs must match consumer slot shape
- `demo/notes-blueprint/services/app/graphs/createNote.json` — drop `id` input, add `newId` `uuid` node, reference via `$node`
- `demo/notes-blueprint/services/app/bindings/bindings.json` — drop the `id` body parameter
- `demo/notes-blueprint/services/app/ui/screens/home.spec.json` (or wherever the create button is) — stop sending `id`
- `packages/runtime/ui-runtime/src/build.ts` — set `process.env.NODE_ENV = "production"`, `minify: true`, `treeShaking: true`

---

## Component A — Edge auth root cause + integration test

### Task A.1: Reproduce the bypass locally with a unit harness

**Files:**
- Create scratchpad in working directory; not committed

- [ ] **Step 1: Confirm the bypass with the rendered config**

Render the notes-demo-shaped nginx config locally:

```bash
node -e "
const { renderNginxConfig } = require('./packages/deploy/deploy-dokploy/dist/nginx.js');
const edge = {
  routes: [{ id: 'http:/api', path: '/api', targetWorkload: 'app' }],
  middleware: [{ kind: 'auth', mountTarget: 'http:/api', moduleSlug: 'identity-auth0', audience: 'https://x/', provider: 'auth0', moduleIntrospectPort: 50052 }],
};
console.log(renderNginxConfig(edge, { app: 'http://app:3000', 'identity-auth0': 'http://identity-auth0:50052' }));
" > /tmp/nginx.conf
```

Inspect `/tmp/nginx.conf`. Confirm `auth_request /_rntme_auth_<key>;` and the `error_page 401 = @rntme_auth_401_<key>;` lines exist.

- [ ] **Step 2: Identify the actual deployed nginx config**

If possible, use the platform's `application-readTraefikConfig` or Dokploy MCP to fetch the live nginx config from the running container. Compare with the locally rendered config.

If they differ — the live deployment predates PR #112's renderer. The fix is operational (Plan 4) and no code change here is needed beyond the integration test (A.2).

If they match — the bypass is in the sidecar logic (`hasBearerToken` admits any non-empty Bearer; the IntrospectSession returns 200 unexpectedly). Move to A.3.

- [ ] **Step 3: Document the root cause**

Add a paragraph to `packages/deploy/deploy-dokploy/README.md` under a new "Edge auth invariants" section that explicitly states: "The named 401 fallback is the only canonical 401 body for protected routes. If a client sees a 401 with a `reason` field on a protected route, the request bypassed nginx and reached the backend pre-step pipeline — investigate."

(No commit yet; folded into A.2/A.3 commits.)

### Task A.2: Integration test against rendered config + real sidecar

**Files:**
- Create: `packages/deploy/deploy-dokploy/test/integration/edge-auth.test.ts`

- [ ] **Step 1: Add nginx test container or Hono-based substitute**

The simplest portable approach is to:
- start the real `@rntme/identity-auth0` introspect sidecar via `createIdentityAuth0HttpServer` against a fake `IntrospectSession` that classifies `Bearer fake.token.here` as inactive
- mount the rendered nginx config in a Docker container if the integration harness already supports it (look for `dockerode` or `testcontainers` in existing integration tests); otherwise approximate nginx with a Hono server that calls the sidecar via `auth_request`-style sub-request

Look for existing patterns: `grep -rn "testcontainers\|dockerode\|new GenericContainer" packages/deploy --include='*.ts'`

Choose: real nginx container if the harness exists, Hono substitute otherwise. The Hono substitute MUST replicate auth_request semantics (sub-request to `/introspect`, on 401 return the named-fallback body verbatim).

- [ ] **Step 2: Write the test**

```ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { renderNginxConfig } from '../../src/nginx.js';
import { createIdentityAuth0HttpServer } from '@rntme/identity-auth0/dist/http-server.js';
import { startNginxOrSubstitute } from './edge-auth-fixtures/nginx-host.js';

describe('edge auth integration', () => {
  let baseUrl: string;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const sidecar = createIdentityAuth0HttpServer({
      port: 0,
      module: { IntrospectSession: async () => ({ session_id: '', user_id: '', status: 0, token_type: 0, vendor_raw: { deactivation_reason: 'MALFORMED' } as never }) },
    });
    const { port } = await sidecar.listen();
    const config = renderNginxConfig(
      {
        routes: [{ id: 'http:/api', path: '/api', targetWorkload: 'app' }],
        middleware: [{ kind: 'auth', mountTarget: 'http:/api', moduleSlug: 'identity-auth0', audience: 'https://x/', provider: 'auth0', moduleIntrospectPort: port }],
      },
      { app: 'http://127.0.0.1:65535', 'identity-auth0': `http://127.0.0.1:${port}` },
    );
    const host = await startNginxOrSubstitute(config);
    baseUrl = host.baseUrl;
    stop = async () => { await sidecar.stop(); await host.stop(); };
  });

  afterAll(async () => { await stop(); });

  for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const) {
    it(`${method} /api/notes with Bearer fake.token.here is rejected by named fallback`, async () => {
      const r = await fetch(`${baseUrl}/api/notes`, {
        method,
        headers: { Authorization: 'Bearer fake.token.here' },
      });
      expect(r.status).toBe(401);
      expect(r.headers.get('content-type')).toContain('application/json');
      const body = await r.json();
      expect(body).toEqual({ code: 'RUNTIME_AUTH_TOKEN_INVALID', message: 'authentication required' });
      // canonical fallback has NO reason field; if it does, it leaked from upstream
      expect(body).not.toHaveProperty('reason');
    });
  }

  it('GET /_rntme_auth_anything returns 404, not SPA HTML', async () => {
    const r = await fetch(`${baseUrl}/_rntme_auth_xyz`);
    expect(r.status).toBe(404);
  });
});
```

- [ ] **Step 3: If using a Hono substitute, write `nginx-host.ts`**

```ts
// packages/deploy/deploy-dokploy/test/integration/edge-auth-fixtures/nginx-host.ts
// A minimal substitute that mimics the auth_request flow: for any request, do a GET
// to the configured /introspect endpoint with the original Authorization and X-Rntme-Audience.
// On 401, respond with the canonical named-fallback JSON body. On 200, proxy to the upstream.
// Implementation skipped here for brevity; the engineer writes a Hono server that reads the rendered
// nginx config to discover (a) the protected location prefix, (b) the introspect upstream URL,
// (c) the audience, and applies auth_request semantics in JS.
// Alternative: shell out to a real nginx binary and bind-mount the rendered config into a temp dir.
```

- [ ] **Step 4: Run the integration test**

Run: `pnpm -F @rntme/deploy-dokploy vitest run test/integration/edge-auth.test.ts`
Expected: PASS (or, if the bypass exists in the renderer, FAIL — fix it, re-run).

- [ ] **Step 5: Commit**

```bash
git add packages/deploy/deploy-dokploy/test/integration packages/deploy/deploy-dokploy/README.md
git commit -m "test(deploy-dokploy): integration test locks edge-auth fallback for forged bearers"
```

### Task A.3: Apply renderer/sidecar fix if root cause is in code

**Files:**
- Modify: whichever produced the bypass

If A.1 step 2 identified a code issue (renderer omits something, sidecar admits forged tokens, `error_page` directive uses wrong syntax):

- [ ] **Step 1: Write the fix**

Concrete changes here depend on the diagnosis. Examples:
- If `error_page` uses `=` semantics that don't intercept upstream 200/2xx via `auth_request`: ensure `auth_request` is the first directive after `location` and that the named fallback is registered.
- If sidecar accepts any Bearer: tighten `hasBearerToken` to require a JWS-shaped value (three dot-separated segments) or rely fully on `jwtVerify` to throw on garbage.
- If renderer omits the `error_page`: re-add it.

- [ ] **Step 2: Re-run the integration test from A.2**

Run: `pnpm -F @rntme/deploy-dokploy vitest run test/integration/edge-auth.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/deploy/deploy-dokploy/src/nginx.ts modules/identity/auth0/src
git commit -m "fix(edge-auth): <root-cause-summary>"
```

(If A.1 step 2 found no code root cause and the live deployment was simply outdated, skip A.3 entirely — Plan 4 redeploy will pick up the new renderer.)

---

## Component B — Graph IR `uuid` node + `$node` reference + createNote rewrite

### Task B.1: Add `$node` reference to graph IR

**Files:**
- Modify: `packages/artifacts/graph-ir-compiler/src/canonical/normalize.ts` (and any sibling parse/schema file)
- Modify: `packages/artifacts/graph-ir-compiler/src/validate/` (find the consistency check that resolves references)

- [ ] **Step 1: Locate the reference forms**

Run: `grep -rn '"\$param"\|"\$pre"\|"\$literal"' packages/artifacts/graph-ir-compiler/src --include='*.ts' -l`

Open one of the matching files to learn the pattern: how `$param` is parsed, type-checked, and lowered.

- [ ] **Step 2: Add `$node` to the same union**

Wherever the reference union is defined (likely a Zod schema or a TypeScript discriminated union), add:

```ts
{ $node: z.string().min(1) }
```

Update the validator to: ensure each `$node` value matches the id of a sibling node in the same graph; the consuming slot's expected type matches the producing node's output type.

- [ ] **Step 3: Add tests**

In `packages/artifacts/graph-ir-compiler/test/unit/`, add or extend:

```ts
it('accepts { $node: "x" } reference when node x exists', () => { /* … */ });
it('rejects { $node: "missing" } with a reference-not-found error', () => { /* … */ });
```

- [ ] **Step 4: Run + commit**

```bash
pnpm -F @rntme/graph-ir-compiler test
git add packages/artifacts/graph-ir-compiler
git commit -m "feat(graph-ir): add \$node reference form"
```

### Task B.2: Add `uuid` node type

**Files:**
- Create: `packages/artifacts/graph-ir-compiler/src/canonical/uuid-node.ts`
- Create: `packages/artifacts/graph-ir-compiler/test/unit/uuid-node.test.ts`
- Modify: the canonical-node registry (look in `canonical/` and `lower/` directories)

- [ ] **Step 1: Define the canonical node**

```ts
// packages/artifacts/graph-ir-compiler/src/canonical/uuid-node.ts
import { z } from 'zod';

export const UuidNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('uuid'),
  config: z.object({}).strict(),
});

export type UuidNode = z.infer<typeof UuidNodeSchema>;

// Output type: a single string (UUID v4).
export const UUID_NODE_OUTPUT_TYPE = 'string' as const;
```

- [ ] **Step 2: Register the node in the canonical registry**

Find the existing registry of node types (search: `grep -rn "type: z.literal" packages/artifacts/graph-ir-compiler/src/canonical`). Add `UuidNodeSchema` to the discriminated union of canonical nodes.

- [ ] **Step 3: Lower the node**

In `packages/artifacts/graph-ir-compiler/src/lower/`, find how `emit`/`findMany`/`filter` are lowered. Add a lowering for `uuid` that emits a runtime call equivalent to `crypto.randomUUID()`. (The exact form depends on the existing lowering target — TypeScript code, intermediate AST, or runtime command list.)

- [ ] **Step 4: Tests**

```ts
// packages/artifacts/graph-ir-compiler/test/unit/uuid-node.test.ts
import { describe, expect, it } from 'vitest';
import { UuidNodeSchema } from '../../src/canonical/uuid-node.js';

describe('uuid node', () => {
  it('parses a valid uuid node spec', () => {
    expect(UuidNodeSchema.parse({ id: 'newId', type: 'uuid', config: {} })).toEqual({ id: 'newId', type: 'uuid', config: {} });
  });

  it('rejects extra config keys', () => {
    expect(() => UuidNodeSchema.parse({ id: 'x', type: 'uuid', config: { weird: true } })).toThrow();
  });

  it('lowers to a runtime that emits a UUID v4 string', () => {
    // exercise the lowering, run the produced runtime, assert output matches /^[0-9a-f-]{36}$/i
  });
});
```

- [ ] **Step 5: Run + commit**

```bash
pnpm -F @rntme/graph-ir-compiler test
git add packages/artifacts/graph-ir-compiler
git commit -m "feat(graph-ir): add uuid node type"
```

### Task B.3: Rewrite `createNote` to use the `uuid` node

**Files:**
- Modify: `demo/notes-blueprint/services/app/graphs/createNote.json`
- Modify: `demo/notes-blueprint/services/app/bindings/bindings.json`
- Modify: `demo/notes-blueprint/services/app/ui/screens/home.spec.json` (or wherever the create form lives — `grep -rn "createNote" demo/notes-blueprint/services/app/ui`)

- [ ] **Step 1: New `createNote.json`**

Replace contents:

```json
{
  "id": "createNote",
  "signature": {
    "inputs": {
      "title": { "type": "string", "mode": "required" },
      "body":  { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    { "id": "newId", "type": "uuid", "config": {} },
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Note",
        "aggregateId": { "$node": "newId" },
        "transition": "create",
        "payload": {
          "title":    { "$param": "title" },
          "body":     { "$param": "body" },
          "ownerSub": { "$pre":   "session.user_id" }
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Drop `id` from bindings**

In `bindings.json#createNote.http.parameters`, remove the `id` entry. Final shape:

```json
"http": {
  "method": "POST",
  "path": "/notes",
  "parameters": [
    { "name": "title", "in": "body", "bindTo": "title", "required": true },
    { "name": "body",  "in": "body", "bindTo": "body",  "required": true }
  ]
}
```

- [ ] **Step 3: Update SPA call site**

In the UI spec referenced above, find the operation that posts `{ id, title, body }` and change it to send `{ title, body }`. (If the UI is generated from bindings — check; in that case no manual change is needed.)

- [ ] **Step 4: Regenerate composed blueprint and validate**

```bash
node apps/cli/dist/bin/cli.js project publish --org test-organization --project notes-demo --dry-run demo/notes-blueprint
```
Expected: `✓ project bundle validated`. (If the dry-run errors, fix the spec before continuing.)

- [ ] **Step 5: Commit**

```bash
git add demo/notes-blueprint/services/app/graphs/createNote.json demo/notes-blueprint/services/app/bindings/bindings.json demo/notes-blueprint/services/app/ui
git commit -m "feat(notes-demo): server-generated note id via uuid graph node"
```

---

## Component C — Production React build

### Task C.1: Esbuild `define` + `minify`

**Files:**
- Modify: `packages/runtime/ui-runtime/src/build.ts`
- Create: `packages/runtime/ui-runtime/test/unit/build.test.ts`

- [ ] **Step 1: Update `build.ts`**

In `sharedBuildOptions`, add:

```ts
const sharedBuildOptions = {
  bundle: true,
  format: 'esm' as const,
  platform: 'browser' as const,
  target: 'es2022' as const,
  sourcemap: true,
  minify: true,
  treeShaking: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  loader: { '.css': 'empty' as const },
  external: [],
};
```

- [ ] **Step 2: Test asserts no `react.development` in built bundle**

```ts
// packages/runtime/ui-runtime/test/unit/build.test.ts
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..', '..');
const bundle = join(pkgRoot, 'build', 'main.js');

describe('ui-runtime production bundle', () => {
  it('does not contain react.development', () => {
    if (!existsSync(bundle)) {
      execSync('pnpm run build:client', { cwd: pkgRoot, stdio: 'inherit' });
    }
    const src = readFileSync(bundle, 'utf8');
    expect(src.includes('react.development')).toBe(false);
    expect(src.includes('"production"')).toBe(true);
  });
});
```

- [ ] **Step 3: Build + run + commit**

```bash
pnpm -F @rntme/ui-runtime build
pnpm -F @rntme/ui-runtime test
git add packages/runtime/ui-runtime/src/build.ts packages/runtime/ui-runtime/test/unit/build.test.ts
git commit -m "feat(ui-runtime): production React build (define NODE_ENV, minify)"
```

---

## Component D — Internal nginx location 404

### Task D.1: Renderer adds `^/_rntme_auth_` 404 location before SPA fallback

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/nginx.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/nginx.test.ts`

- [ ] **Step 1: Failing snapshot test**

In `nginx.test.ts`, add:

```ts
it('emits an explicit 404 for ^/_rntme_auth_<anything>', () => {
  const rendered = renderNginxConfig(
    {
      routes: [{ id: 'http:/api', path: '/api', targetWorkload: 'app' }],
      middleware: [{ kind: 'auth', mountTarget: 'http:/api', moduleSlug: 'identity-auth0', audience: 'https://x/', provider: 'auth0', moduleIntrospectPort: 50052 }],
    },
    { app: 'http://app:3000', 'identity-auth0': 'http://identity-auth0:50052' },
  );

  expect(rendered).toContain('location ~ ^/_rntme_auth_');
  expect(rendered).toContain('return 404;');

  // The block must appear BEFORE any SPA-fallback location (e.g. `try_files $uri /index.html;`)
  const blockIdx = rendered.indexOf('location ~ ^/_rntme_auth_');
  const tryFilesIdx = rendered.indexOf('try_files');
  if (tryFilesIdx !== -1) expect(blockIdx).toBeLessThan(tryFilesIdx);
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm -F @rntme/deploy-dokploy vitest run test/unit/nginx.test.ts -t "explicit 404"`
Expected: FAIL.

- [ ] **Step 3: Modify the renderer**

In `nginx.ts`, in the `renderNginxConfig` body, build the `^/_rntme_auth_` 404 line and place it BEFORE the regular `locations`:

```ts
const internalAuthFallback = '    location ~ ^/_rntme_auth_ {\n      return 404;\n    }';

return [
  'events {}',
  'http {',
  ...rateLimitZones.map((line) => `  ${line}`),
  ...upstreamLines,
  '  server {',
  '    listen 8080;',
  '    location = /health { return 200 "ok\\n"; }',
  ...renderConfigLocation(),
  ...internalLocations, // keeps `location = /_rntme_auth_<key>` (exact match wins)
  ...named401Locations,
  internalAuthFallback,  // 404 for any other /_rntme_auth_*
  ...locations,
  '  }',
  '}',
  '',
].join('\n');
```

(`location = /_rntme_auth_<key>` is an exact-match — it wins over the regex fallback for the legitimate sub-request paths. Random strings hit the regex and return 404.)

- [ ] **Step 4: Run snapshot tests, expect PASS**

Run: `pnpm -F @rntme/deploy-dokploy test`
Expected: PASS, including the new test and the existing snapshot tests (update existing snapshots if they assert exhaustive output).

- [ ] **Step 5: Commit**

```bash
git add packages/deploy/deploy-dokploy/src/nginx.ts packages/deploy/deploy-dokploy/test/unit/nginx.test.ts
git commit -m "feat(deploy-dokploy): explicit 404 for /_rntme_auth_* internal locations"
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

- [ ] **Confirm SPA bundle is production**

```bash
pnpm -F @rntme/ui-runtime build
grep -c "react.development" packages/runtime/ui-runtime/build/main.js
```
Expected: `0`.

- [ ] **Confirm rendered nginx has the 404 + auth_request both**

```bash
node -e "const { renderNginxConfig } = require('./packages/deploy/deploy-dokploy/dist/nginx.js'); console.log(renderNginxConfig({ routes: [{ id: 'http:/api', path: '/api', targetWorkload: 'app' }], middleware: [{ kind: 'auth', mountTarget: 'http:/api', moduleSlug: 'identity-auth0', audience: 'https://x/', provider: 'auth0', moduleIntrospectPort: 50052 }] }, { app: 'http://app:3000', 'identity-auth0': 'http://identity-auth0:50052' }))" | grep -E "auth_request|_rntme_auth"
```
Expected: shows both `auth_request /_rntme_auth_<key>;` and `location ~ ^/_rntme_auth_`.

- [ ] **Confirm createNote contract**

```bash
grep -A 5 '"createNote"' demo/notes-blueprint/services/app/bindings/bindings.json
```
Expected: parameters list does not include `id`.
