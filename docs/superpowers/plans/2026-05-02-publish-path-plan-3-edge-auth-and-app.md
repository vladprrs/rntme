# Publish-Path Hardening — Plan 3: Edge Auth + App Semantics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-02-publish-path-end-to-end-hardening-design.md` §6, §8

**Goal:** Diagnose and lock the live edge-auth bypass, add the integration test that fails on regression, replace `createNote`'s client-required `id` with a server-generated UUID via a new graph IR `uuid` node, ship a production React build for the SPA, and add an explicit nginx 404 for `^/_rntme_auth_*` so internal locations no longer fall through to the SPA catch-all.

**Architecture:** Four independent slices: (1) edge-auth root-cause + integration test in `deploy-dokploy`; (2) graph IR `uuid` command node + `$node` reference + `createNote` rewrite in `graph-ir-compiler` and notes-blueprint; (3) SPA production build settings in `@rntme/ui-runtime`; (4) nginx renderer adds explicit `^/_rntme_auth_` 404 location before SPA fallback.

**Tech Stack:** TypeScript, Vitest, esbuild (`define` + `minify`), nginx config rendering, Testcontainers (`nginx:1.27-alpine`) for edge-auth integration.

---

## File Structure

**Create:**
- `packages/deploy/deploy-dokploy/test/integration/edge-auth.test.ts` — real introspect-sidecar + rendered nginx integration test
- `packages/deploy/deploy-dokploy/test/integration/edge-auth-fixtures/nginx-container.ts` — Testcontainers helper that boots `nginx:1.27-alpine` with the rendered config
- `packages/artifacts/graph-ir-compiler/test/unit/uuid-node.test.ts`
- `packages/runtime/ui-runtime/test/unit/build.test.ts` — assertion that the bundle has no `react.development`

**Modify:**
- `packages/deploy/deploy-dokploy/package.json` — add `testcontainers`, `@rntme/identity-auth0`, and `@rntme/contracts-identity-v1` dev dependencies for the real nginx + real sidecar integration test
- `packages/deploy/deploy-dokploy/src/nginx.ts` — add explicit `^/_rntme_auth_` 404 block; if root cause requires changes, fix the auth_request emission
- `packages/deploy/deploy-dokploy/test/unit/nginx.test.ts` — snapshot the new 404 location and its position
- `packages/artifacts/graph-ir-compiler/src/parse/schema.ts` — accept `{ "$node": string }` expressions and `{ "type": "uuid", "config": {} }` nodes
- `packages/artifacts/graph-ir-compiler/src/types/authoring.ts` — add `NodeRef` / `UuidNode`
- `packages/artifacts/graph-ir-compiler/src/types/canonical.ts` — add `CanonicalUuid`
- `packages/artifacts/graph-ir-compiler/src/types/command.ts` — add compiled command node generator metadata
- `packages/artifacts/graph-ir-compiler/src/canonical/normalize.ts` — normalize `uuid` to `kind: "uuid"`
- `packages/artifacts/graph-ir-compiler/src/validate/structural/refs.ts` — allow `uuid` as a no-input command node and validate `$node` references
- `packages/artifacts/graph-ir-compiler/src/validate/semantic/types.ts` and `src/validate/semantic/emit.ts` — type `$node` refs and require `emit.aggregateId` refs to resolve to uuid/string output
- `packages/artifacts/graph-ir-compiler/src/emit/plan.ts`, `src/emit/payload.ts`, `src/command-runtime/execute.ts` — carry and evaluate uuid node outputs before emit execution
- `demo/notes-blueprint/services/app/graphs/createNote.json` — drop `id` input, add `newId` `uuid` node, reference via `$node`
- `demo/notes-blueprint/services/app/bindings/bindings.json` — drop the `id` body parameter
- `demo/notes-blueprint/services/app/ui/screens/home.spec.json` — remove the create-note ID input
- `demo/notes-blueprint/services/app/ui/screens/home.screen.json` — stop sending `id` in `createNote.paramsFromState`
- `packages/runtime/ui-runtime/src/build.ts` — set `process.env.NODE_ENV = "production"`, `minify: true`, `treeShaking: true`

---

## Component A — Edge auth root cause + integration test

### Task A.1: Reproduce the bypass locally with a unit harness

**Files:**
- Create scratchpad in working directory; not committed

- [ ] **Step 1: Confirm the bypass with the rendered config**

Build `deploy-dokploy`, then render the notes-demo-shaped nginx config locally with ESM import syntax:

```bash
pnpm -F @rntme/deploy-dokploy build
node --input-type=module -e "
import { renderNginxConfig } from './packages/deploy/deploy-dokploy/dist/nginx.js';
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

- [ ] **Step 1: Add real nginx integration dependencies**

`@rntme/deploy-dokploy` currently has no Docker integration harness. Add the minimum dev dependencies needed for a real nginx test:

```json
{
  "devDependencies": {
    "@rntme/contracts-identity-v1": "workspace:*",
    "@rntme/identity-auth0": "workspace:*",
    "testcontainers": "^10.13.0"
  }
}
```

Doc-backed decisions:
- Testcontainers `GenericContainer` supports exposed ports and wait strategies.
- `TestContainers.exposeHostPorts(port)` exposes host services to the container at `host.testcontainers.internal:<port>`.
- Use `withCopyContentToContainer` to write the rendered config to `/etc/nginx/nginx.conf`.

- [ ] **Step 2: Add `nginx-container.ts`**

```ts
// packages/deploy/deploy-dokploy/test/integration/edge-auth-fixtures/nginx-container.ts
import { GenericContainer, TestContainers, Wait, type StartedTestContainer } from 'testcontainers';

export type StartedNginx = {
  readonly baseUrl: string;
  readonly stop: () => Promise<void>;
};

export async function startNginxWithConfig(config: string, hostPorts: readonly number[]): Promise<StartedNginx> {
  for (const port of hostPorts) await TestContainers.exposeHostPorts(port);

  let container: StartedTestContainer | null = await new GenericContainer('nginx:1.27-alpine')
    .withExposedPorts(8080)
    .withCopyContentToContainer([{ content: config, target: '/etc/nginx/nginx.conf' }])
    .withWaitStrategy(Wait.forHttp('/health', 8080).forStatusCode(200))
    .start();

  const baseUrl = `http://${container.getHost()}:${container.getMappedPort(8080)}`;
  return {
    baseUrl,
    async stop() {
      if (container !== null) {
        await container.stop();
        container = null;
      }
    },
  };
}
```

- [ ] **Step 3: Write the test**

```ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { renderNginxConfig } from '../../src/nginx.js';
import { SessionStatus } from '@rntme/contracts-identity-v1';
import { createIdentityAuth0HttpServer } from '@rntme/identity-auth0';
import { startNginxWithConfig, type StartedNginx } from './edge-auth-fixtures/nginx-container.js';

describe('edge auth integration', () => {
  let baseUrl: string;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const sidecar = createIdentityAuth0HttpServer({
      port: 0,
      host: '127.0.0.1',
      module: {
        IntrospectSession: async () => ({
          session_id: '',
          user_id: '',
          status: SessionStatus.SESSION_STATUS_EXPIRED,
          token_type: 0,
          vendor_raw: { deactivation_reason: 'MALFORMED' } as never,
        }),
      },
    });
    const { port } = await sidecar.listen();
    const config = renderNginxConfig(
      {
        routes: [{ id: 'http:/api', path: '/api', targetWorkload: 'app' }],
        middleware: [{ kind: 'auth', mountTarget: 'http:/api', moduleSlug: 'identity-auth0', audience: 'https://x/', provider: 'auth0', moduleIntrospectPort: port }],
      },
      { app: 'http://host.testcontainers.internal:65535', 'identity-auth0': `http://host.testcontainers.internal:${port}` },
    );
    const nginx: StartedNginx = await startNginxWithConfig(config, [port]);
    baseUrl = nginx.baseUrl;
    stop = async () => { await nginx.stop(); await sidecar.stop(); };
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
    expect(await r.text()).not.toContain('<!doctype html');
  });
});
```

- [ ] **Step 4: Run the integration test**

Run: `pnpm -F @rntme/identity-auth0 build && pnpm -F @rntme/deploy-dokploy vitest run test/integration/edge-auth.test.ts`
Expected: PASS (or, if the bypass exists in the renderer, FAIL — fix it, re-run).

- [ ] **Step 5: Commit**

```bash
git add packages/deploy/deploy-dokploy/package.json packages/deploy/deploy-dokploy/test/integration packages/deploy/deploy-dokploy/README.md pnpm-lock.yaml
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
- Modify: `packages/artifacts/graph-ir-compiler/src/parse/schema.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/types/authoring.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/validate/structural/refs.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/validate/semantic/types.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/emit/payload.ts`

- [ ] **Step 1: Locate the reference forms**

Run: `grep -rn '"\$param"\|"\$pre"\|"\$literal"' packages/artifacts/graph-ir-compiler/src --include='*.ts' -l`

Open one of the matching files to learn the pattern: how `$param` is parsed, type-checked, and lowered.

- [ ] **Step 2: Add `$node` to the same union**

Add the reference to the actual expression definitions:

```ts
// packages/artifacts/graph-ir-compiler/src/parse/schema.ts
z.object({ $node: z.string().min(1) }).strict()

// packages/artifacts/graph-ir-compiler/src/types/authoring.ts
export type NodeRef = { $node: string };
export type Expr =
  | FieldPath
  | number
  | boolean
  | null
  | { $literal: string }
  | { $param: string }
  | { $pre: string }
  | NodeRef
  | { [K in ExprOp]?: Expr[] }
  | { between: [Expr, Expr, Expr] }
  | { case: { when: Array<[Expr, Expr]>; else: Expr } }
  | { exists: { relation: string; where?: Expr } }
  | { $list: Expr[] };
```

Update structural validation to ensure each `$node` reference resolves to a prior node in the same graph. For this slice, `$node` is only valid when the target node is `type: "uuid"`; reject references to query nodes or emit nodes with a new error code such as `STRUCT_INVALID_NODE_REF`.

- [ ] **Step 3: Add tests**

In `packages/artifacts/graph-ir-compiler/test/unit/`, add or extend:

Extend the `uuid-node.test.ts` fixture from Task B.2 with three concrete assertions:
- compiling `commandSpecWithUuidAggregateId` returns `{ ok: true }`
- compiling the same fixture with `aggregateId: { "$node": "missing" }` returns `{ ok: false }` and an error with `code === "STRUCT_INVALID_NODE_REF"`
- compiling the same fixture with a `$node` reference to a `findMany` node returns `{ ok: false }` and an error with `code === "STRUCT_INVALID_NODE_REF"`

- [ ] **Step 4: Run + commit**

```bash
pnpm -F @rntme/graph-ir-compiler test
git add packages/artifacts/graph-ir-compiler
git commit -m "feat(graph-ir): add \$node reference form"
```

### Task B.2: Add `uuid` node type

**Files:**
- Create: `packages/artifacts/graph-ir-compiler/test/unit/uuid-node.test.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/parse/schema.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/types/authoring.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/types/canonical.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/canonical/normalize.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/types/command.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/emit/plan.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/emit/payload.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/command-runtime/execute.ts`

- [ ] **Step 1: Define the canonical node**

```ts
// packages/artifacts/graph-ir-compiler/src/types/authoring.ts
export type UuidNode = {
  id: string;
  type: 'uuid';
  config: Record<string, never>;
};

// packages/artifacts/graph-ir-compiler/src/types/canonical.ts
export type CanonicalUuid = {
  kind: 'uuid';
  id: string;
  scope: ScopeId;
};
```

- [ ] **Step 2: Register the node in the canonical registry**

Add this Zod node beside the existing nodes in `parse/schema.ts` and include it in the `graphNode` discriminated union:

```ts
const uuidNode = z
  .object({
    id: z.string(),
    type: z.literal('uuid'),
    config: z.object({}).strict(),
  })
  .strict();
```

- [ ] **Step 3: Compile and evaluate uuid outputs**

This is command-runtime work, not SQLite lowering work. Do not add `uuid` to `readNodes`; otherwise `compileCommand` will try to lower it through the relational query pipeline. In `compile.ts`, keep:

```ts
const readNodes = graph.nodes.filter((n) => n.kind !== 'emit' && n.kind !== 'uuid');
```

In command types and execution:

```ts
// packages/artifacts/graph-ir-compiler/src/types/command.ts
export type CommandNodeGenerator = { nodeId: string; kind: 'uuid' };
export type CompiledCommand = {
  // existing fields...
  nodeGenerators: CommandNodeGenerator[];
};

// packages/artifacts/graph-ir-compiler/src/command-runtime/execute.ts
const nodeValues: Record<string, unknown> = {};
for (const generator of compiled.nodeGenerators) {
  if (generator.kind === 'uuid') nodeValues[generator.nodeId] = ctx.nextId();
}
const aggregateId = String(evalExprAtRuntime(head.aggregateIdExpr, paramValues, nodeValues) ?? '');
```

Update `evalExprAtRuntime` and `derivePayload` to accept the same `nodeValues` map:

```ts
if ('$node' in expr) {
  const value = nodeValues[(expr as { $node: string }).$node];
  if (value === undefined) throw runtimeError('RUNTIME_INTERNAL_ERROR', `unknown $node "${(expr as { $node: string }).$node}"`);
  return value;
}
```

- [ ] **Step 4: Tests**

```ts
// packages/artifacts/graph-ir-compiler/test/unit/uuid-node.test.ts
import { describe, expect, it } from 'vitest';
import { compileCommand, executeCommand } from '../../src/index.js';

describe('uuid node', () => {
  it('compiles a command whose aggregateId references a prior uuid node', () => {
    const compiled = compileCommand(commandSpecWithUuidAggregateId, pdm, qsm);
    expect(compiled.ok).toBe(true);
  });

  it('rejects extra config keys on uuid nodes', () => {
    const compiled = compileCommand(commandSpecWithBadUuidConfig, pdm, qsm);
    expect(compiled.ok).toBe(false);
  });

  it('executes the uuid node once and uses it as the aggregate id', () => {
    const compiled = compileCommand(commandSpecWithUuidAggregateId, pdm, qsm);
    if (!compiled.ok) throw new Error(compiled.errors[0]?.message ?? 'compile failed');
    const out = executeCommand(compiled.value, { title: 'A', body: 'B' }, {
      eventStore,
      qsmDb: null,
      now: () => '2026-05-03T00:00:00.000Z',
      nextId: (() => {
        const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
        return () => ids.shift()!;
      })(),
      actor: null,
      correlation,
    });
    expect(out.aggregateId).toBe('11111111-1111-4111-8111-111111111111');
    expect(out.eventIds).toEqual(['22222222-2222-4222-8222-222222222222']);
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
- Modify: `demo/notes-blueprint/services/app/ui/screens/home.screen.json`

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

In `home.spec.json`, remove the create form `field-id` element and remove it from the `create-section.children` array. In `home.screen.json`, remove the `id: "/form/id"` entry from `actions.createNote.paramsFromState`. Leave delete-note `id` unchanged.

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
    expect(src.includes('process.env.NODE_ENV')).toBe(false);
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
node --input-type=module -e "import { renderNginxConfig } from './packages/deploy/deploy-dokploy/dist/nginx.js'; console.log(renderNginxConfig({ routes: [{ id: 'http:/api', path: '/api', targetWorkload: 'app' }], middleware: [{ kind: 'auth', mountTarget: 'http:/api', moduleSlug: 'identity-auth0', audience: 'https://x/', provider: 'auth0', moduleIntrospectPort: 50052 }] }, { app: 'http://app:3000', 'identity-auth0': 'http://identity-auth0:50052' }))" | grep -E "auth_request|_rntme_auth"
```
Expected: shows both `auth_request /_rntme_auth_<key>;` and `location ~ ^/_rntme_auth_`.

- [ ] **Confirm createNote contract**

```bash
grep -A 5 '"createNote"' demo/notes-blueprint/services/app/bindings/bindings.json
```
Expected: parameters list does not include `id`.

---

## Plan Challenge Notes

These amendments were added on 2026-05-03 after checking the current repo shape and current external docs:

- **No Hono substitute for edge auth.** The edge-auth regression must exercise nginx itself. Testcontainers supports `GenericContainer`, `withCopyContentToContainer`, HTTP wait strategies, and `TestContainers.exposeHostPorts`; use those with `nginx:1.27-alpine` and the real `@rntme/identity-auth0` sidecar.
- **Graph IR `uuid` is command-runtime, not SQL lowering.** The current compiler lowers read nodes through the relational SQLite path; `uuid` must be excluded from `readNodes` and carried as command node generator metadata evaluated before emits.
- **`$node` scope is intentionally narrow.** For this slice, `$node` is valid only for prior `uuid` nodes in command expressions. General node-output references for query rowsets are out of scope.
- **Production bundle assertion must not require a literal `"production"` string.** esbuild `define` plus minification may constant-fold the branch away. Assert absence of `react.development` and unresolved `process.env.NODE_ENV` instead.
- **Use ESM import in local render commands.** `@rntme/deploy-dokploy` is `"type": "module"`; `node --input-type=module` avoids a `require()` failure.
