# Edge auth via identity-module HTTP introspection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the comment-only `kind: "auth"` middleware in the deploy-dokploy nginx render with real edge enforcement via `auth_request` to a per-provider identity module HTTP introspection endpoint, eliminating the runtime 500 (`BINDINGS_RUNTIME_EXPRESSION_ERROR`) on unauthenticated requests and creating a provider-agnostic plug-point for future identity modules.

**Architecture:** The identity-auth0 module gains a second transport (Hono on `:50052`) that wraps the existing `IntrospectSession` handler. nginx is configured per-mount to call this HTTP endpoint via `auth_request`, returning 401 at the edge for missing/invalid tokens. Provider swap is achieved purely by changing the identity-module image; nginx render is parameterized by `moduleSlug`/`audience`/`port` only. Module-skeleton schema gains `capabilities.edgeAuth`; deploy-core fails planning with `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING` if a module targeted by `kind: "auth"` does not declare HTTP introspection. CLI positional folder for `project publish` and removal of phantom `deploy plan/render/apply` README sections complete Part A.

**Tech Stack:** TypeScript 5.5, Vitest 2, Hono 4, @grpc/grpc-js, jose (JWT), zod 4, esbuild (existing), node:test, nginx 1.27 directives (`auth_request`, `error_page`, `proxy_set_header`).

**Spec:** `docs/superpowers/specs/2026-05-01-edge-auth-introspection-design.md`

---

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `packages/contracts/identity/v1/error-codes.json` | Modify | Adds `IDENTITY_HTTP_TOKEN_MISSING` and `IDENTITY_HTTP_AUDIENCE_MISSING` to `vendor` layer. |
| `packages/contracts/identity/v1/test/error-codes.test.ts` | Modify | Asserts new codes are present and exported. |
| `packages/contracts/identity/v1/README.md` | Modify | New `## HTTP introspection transport` section pinning method/path/headers/error codes. |
| `packages/tooling/module-skeleton/src/manifest-shape.ts` | Modify | Add `EdgeAuthDescriptorSchema` and `edgeAuth` field on `ModuleCapabilitiesSchema`. |
| `packages/tooling/module-skeleton/test/unit/manifest-shape.test.ts` | Modify | Tests for `edgeAuth` parse + reject of invalid kind. |
| `modules/identity/auth0/module.json` | Modify | Adds `capabilities.edgeAuth`. |
| `packages/artifacts/blueprint/src/types/artifact.ts` | Modify | `CatalogManifest` gains `moduleEdgeAuth: Record<modulePackage, EdgeAuthDescriptor \| null>`. |
| `packages/artifacts/blueprint/src/compose/catalog.ts` | Modify | Populate `moduleEdgeAuth` from each module manifest's `capabilities.edgeAuth`. |
| `packages/artifacts/blueprint/test/unit/catalog.test.ts` | Modify | Test that `moduleEdgeAuth` is populated correctly. |
| `modules/identity/auth0/src/http-server.ts` | Create | Hono app with `GET /introspect`; wraps the same `module.IntrospectSession()` handler used by gRPC. |
| `modules/identity/auth0/test/unit/http-server.test.ts` | Create | Unit tests: missing header → 401, missing audience → 401, active session → 200 + headers, inactive → 401. |
| `modules/identity/auth0/src/bin/server.ts` | Modify | Boot both gRPC `:50051` and HTTP `:50052` in parallel; reads `HTTP_PORT` env. |
| `modules/identity/auth0/Dockerfile` | Modify | `EXPOSE 50051 50052`, set `HTTP_PORT=50052`. |
| `modules/identity/auth0/src/index.ts` | Modify | Re-exports `createIdentityAuth0HttpServer`. |
| `modules/identity/conformance/src/introspection-http.ts` | Create | Reusable conformance suite for HTTP introspection (used by every Identity module that ships HTTP introspection). |
| `modules/identity/conformance/src/index.ts` | Modify | Re-exports `runIntrospectionHttpConformance`. |
| `modules/identity/auth0/test/integration/conformance/introspection-http.test.ts` | Create | Auth0-specific integration test that runs `runIntrospectionHttpConformance` against a real Hono server with mock JWKS. |
| `packages/deploy/deploy-core/src/edge.ts` | Modify | `EdgeMiddleware.auth` gains `moduleIntrospectPort: number`; planner fails with `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING` if the module's `edgeAuth` is absent or wrong shape. |
| `packages/deploy/deploy-core/src/composed-project.ts` | Modify | Adds `modules?: Readonly<Record<string, { edgeAuth?: EdgeAuthDescriptor \| null }>>` to `ComposedProjectInput`. |
| `packages/deploy/deploy-core/src/errors.ts` | Modify | Adds the new error code constant. |
| `packages/deploy/deploy-core/test/unit/edge.test.ts` | Modify | Tests for missing `edgeAuth` → planning error; for present `edgeAuth` → `moduleIntrospectPort` propagation. |
| `apps/platform-http/src/deploy/executor.ts` | Modify | `toDeployCoreInput` populates `modules` from `composed.catalogManifest.moduleEdgeAuth`. |
| `apps/platform-http/test/unit/deploy/executor.test.ts` | Modify | Asserts `modules` map carries `edgeAuth` for identity-auth0 fixture. |
| `packages/deploy/deploy-dokploy/src/nginx.ts` | Modify | Real `auth_request` rendering; key by `<slug>__<audHash>`; emits upstream block + internal location + named-location 401 page. |
| `packages/deploy/deploy-dokploy/test/unit/nginx.test.ts` | Modify | Tests: auth-mount renders `auth_request`, `proxy_set_header`, named 401 location. |
| `packages/deploy/deploy-dokploy/src/render.ts` | Modify | Integration-module workload exposes `:50052` (in addition to `:50051`). |
| `packages/deploy/deploy-dokploy/test/unit/render.test.ts` | Modify | Asserts identity-auth0 workload exposes both ports. |
| `apps/cli/src/bin/cli.ts` | Modify | `project publish` resolves folder = positional[2] ?? `--folder` ?? `.`; rejects "both given". |
| `apps/cli/test/integration/commands.test.ts` | Modify | Add positional-folder test + both-given error test. |
| `apps/cli/README.md` | Modify | Update `Quick Start` and command summary; delete `deploy plan/render/apply` section; replace with one-line note pointing at platform UI / HTTP API. |
| `packages/contracts/identity/v1/README.md` | Modify | (already listed) Documentation. |
| `modules/identity/auth0/README.md` | Modify | New `## Two transports: gRPC + HTTP introspection` section. |
| `packages/deploy/deploy-core/README.md` | Modify | Update `## Edge auth planning`. |
| `packages/deploy/deploy-dokploy/README.md` | Modify | Update `## Edge auth rendering`. |
| `AGENTS.md` | Modify | If § "Identity contract & module pattern" exists, append paragraph; else add it. |
| `docs/superpowers/plans/2026-05-01-notes-demo-recovery.md` | Modify | Task 12 grows two acceptance probes. |

`AGENTS.md`/`CLAUDE.md`/`vision.md`/`README.md` table-of-packages — no architectural shift, no change.

---

## Task 1: Add `IDENTITY_HTTP_TOKEN_MISSING` and `IDENTITY_HTTP_AUDIENCE_MISSING` error codes

**Files:**
- Modify: `packages/contracts/identity/v1/error-codes.json`
- Modify: `packages/contracts/identity/v1/test/error-codes.test.ts`

- [ ] **Step 1: Open `packages/contracts/identity/v1/test/error-codes.test.ts` and read the existing structure.**

It uses `errorCodes.vendor` array. Find the assertion that lists the vendor codes; add expectations for the two new entries.

- [ ] **Step 2: Add the failing assertions to the test.**

Locate the assertion pattern that checks vendor codes. Add:

```ts
expect(errorCodes.vendor).toContain('IDENTITY_HTTP_TOKEN_MISSING');
expect(errorCodes.vendor).toContain('IDENTITY_HTTP_AUDIENCE_MISSING');
```

- [ ] **Step 3: Run the test; expect FAIL.**

```
pnpm -F @rntme/contracts-identity-v1 test
```

Expected: 2 failed assertions ("expected ... to contain 'IDENTITY_HTTP_TOKEN_MISSING'").

- [ ] **Step 4: Update `error-codes.json` to add both codes.**

Open `packages/contracts/identity/v1/error-codes.json` and append the two strings to the `"vendor"` array (alphabetical with the existing vendor codes — they go between `IDENTITY_VENDOR_INVALID_REQUEST` and `IDENTITY_VENDOR_RATE_LIMITED`):

```json
{
  ...
  "vendor": [
    "IDENTITY_HTTP_AUDIENCE_MISSING",
    "IDENTITY_HTTP_TOKEN_MISSING",
    "IDENTITY_VENDOR_INVALID_REQUEST",
    "IDENTITY_VENDOR_RATE_LIMITED",
    "IDENTITY_VENDOR_UNAUTHORIZED",
    "IDENTITY_VENDOR_UNAVAILABLE"
  ]
}
```

- [ ] **Step 5: Re-run the test; expect PASS.**

```
pnpm -F @rntme/contracts-identity-v1 test
```

Expected: all tests pass, including the two new assertions.

- [ ] **Step 6: Commit.**

```bash
git add packages/contracts/identity/v1/error-codes.json packages/contracts/identity/v1/test/error-codes.test.ts
git commit -m "feat(contracts-identity-v1): add IDENTITY_HTTP_{TOKEN,AUDIENCE}_MISSING vendor codes"
```

---

## Task 2: Document HTTP introspection transport in identity-v1 README

**Files:**
- Modify: `packages/contracts/identity/v1/README.md`

- [ ] **Step 1: Open the README and find the section on `IntrospectSession`.**

Search for `IntrospectSession` heading. After the existing gRPC description, add a new sibling section.

- [ ] **Step 2: Append the HTTP introspection section.**

Add this verbatim (placement: immediately before the "Error codes" section, or at the end of the IntrospectSession section if structured that way):

```markdown
## HTTP introspection transport

`IntrospectSession` has a second, edge-only transport. Identity modules whose `module.json` declares `capabilities.edgeAuth = { kind: "introspection-sidecar", transport: "http", method: "GET", path: "/introspect", port: 50052 }` MUST expose:

- **Method + path:** `GET /introspect` (Method MUST be `GET` because nginx `auth_request` always issues `GET`. Body is never read.)
- **Required request headers:**
  - `Authorization: Bearer <token>` — missing or malformed → `401` with code `IDENTITY_HTTP_TOKEN_MISSING`.
  - `X-Rntme-Audience: <audience>` — missing or empty → `401` with code `IDENTITY_HTTP_AUDIENCE_MISSING`.
- **Success response (`200`):**
  - Empty body.
  - `X-Rntme-User-Sub: <sub>` — the canonical session subject.
  - `X-Rntme-User-Audience: <audience>` — echo of the validated audience.
  - `X-Rntme-Session-Status: ACTIVE`.
- **Failure response (`401`):**
  - Body: JSON `{ "code": "<IDENTITY_*>", "message": "<msg>" }`. `Content-Type: application/json`.
  - Code is one of `IDENTITY_HTTP_TOKEN_MISSING`, `IDENTITY_HTTP_AUDIENCE_MISSING`, `IDENTITY_CONSISTENCY_INVALID_TOKEN`, `IDENTITY_VENDOR_INVALID_REQUEST`, or any other `IDENTITY_*` listed in `error-codes.json` that the module deems applicable.
- **No request body.** nginx `auth_request` does not forward the original body to the sub-request.
- **Headers MUST be ASCII-safe.** `sub` is provider-issued and ASCII per the OIDC `sub` claim spec; non-ASCII fields (email, name, vendor_raw) stay in the gRPC `Session` response only.

Both transports invoke the same in-process handler. The HTTP transport never duplicates validation logic.
```

- [ ] **Step 3: Commit.**

```bash
git add packages/contracts/identity/v1/README.md
git commit -m "docs(contracts-identity-v1): document HTTP introspection transport"
```

---

## Task 3: Extend `ModuleCapabilitiesSchema` with `edgeAuth`

**Files:**
- Modify: `packages/tooling/module-skeleton/src/manifest-shape.ts`
- Modify: `packages/tooling/module-skeleton/test/unit/manifest-shape.test.ts`

- [ ] **Step 1: Open `packages/tooling/module-skeleton/test/unit/manifest-shape.test.ts` and add three failing tests.**

After the existing tests, add this `describe` block:

```ts
describe('capabilities.edgeAuth', () => {
  it('parses introspection-sidecar with full descriptor', () => {
    const result = parseModuleManifest({
      name: 'test',
      version: '1.0.0',
      capabilities: {
        rpcs: ['IntrospectSession'],
        events: [],
        edgeAuth: {
          kind: 'introspection-sidecar',
          transport: 'http',
          method: 'GET',
          path: '/introspect',
          port: 50052,
        },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.capabilities?.edgeAuth?.kind).toBe('introspection-sidecar');
      expect(result.value.capabilities?.edgeAuth?.port).toBe(50052);
    }
  });

  it('rejects unknown edgeAuth.kind', () => {
    const result = parseModuleManifest({
      name: 'test',
      version: '1.0.0',
      capabilities: {
        rpcs: ['IntrospectSession'],
        events: [],
        edgeAuth: { kind: 'native-jwt-validation', port: 50052 },
      },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects port outside 1..65535', () => {
    const result = parseModuleManifest({
      name: 'test',
      version: '1.0.0',
      capabilities: {
        rpcs: ['IntrospectSession'],
        events: [],
        edgeAuth: {
          kind: 'introspection-sidecar',
          transport: 'http',
          method: 'GET',
          path: '/introspect',
          port: 0,
        },
      },
    });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL.**

```
pnpm -F @rntme/module-skeleton test
```

Expected: the three new tests fail (zod rejects unknown `edgeAuth` field on a strict schema, or rejection logic is absent).

- [ ] **Step 3: Add `EdgeAuthDescriptorSchema` and field to `ModuleCapabilitiesSchema`.**

Open `packages/tooling/module-skeleton/src/manifest-shape.ts`. Above `ModuleCapabilitiesSchema`, add:

```ts
export const EdgeAuthDescriptorSchema = z
  .object({
    kind: z.literal('introspection-sidecar'),
    transport: z.literal('http'),
    method: z.literal('GET'),
    path: z.string().startsWith('/'),
    port: z.number().int().min(1).max(65_535),
  })
  .strict();

export type EdgeAuthDescriptor = z.infer<typeof EdgeAuthDescriptorSchema>;
```

In `ModuleCapabilitiesSchema`, add `edgeAuth: EdgeAuthDescriptorSchema.optional()` as a new field:

```ts
export const ModuleCapabilitiesSchema = z
  .object({
    vendors: z.array(z.string().min(1)).optional(),
    entities: z.array(z.string().min(1)).optional(),
    rpcs: z.array(z.string().min(1)).default([]),
    events: z.array(z.string().min(1)).default([]),
    search_tiers: z.array(z.string().min(1)).optional(),
    labeled_associations: z.boolean().optional(),
    bulk_operations: z.record(z.unknown()).optional(),
    async_job_types: z.array(z.string().min(1)).optional(),
    webhook_format: z.string().min(1).optional(),
    webhook_retry_policy: z.string().min(1).optional(),
    edgeAuth: EdgeAuthDescriptorSchema.optional(),
  })
  .strict();
```

- [ ] **Step 4: Re-export `EdgeAuthDescriptor` from the package index.**

Open `packages/tooling/module-skeleton/src/index.ts` and add `EdgeAuthDescriptor` and `EdgeAuthDescriptorSchema` to the export list:

```ts
export {
  ...,
  EdgeAuthDescriptorSchema,
} from './manifest-shape.js';
export type {
  ...,
  EdgeAuthDescriptor,
} from './manifest-shape.js';
```

(Slot them alphabetically into the existing export blocks.)

- [ ] **Step 5: Re-run tests; expect PASS.**

```
pnpm -F @rntme/module-skeleton test
```

Expected: all three new tests pass.

- [ ] **Step 6: Commit.**

```bash
git add packages/tooling/module-skeleton/src/manifest-shape.ts packages/tooling/module-skeleton/src/index.ts packages/tooling/module-skeleton/test/unit/manifest-shape.test.ts
git commit -m "feat(module-skeleton): capabilities.edgeAuth = introspection-sidecar descriptor"
```

---

## Task 4: Set `capabilities.edgeAuth` in identity-auth0 module.json

**Files:**
- Modify: `modules/identity/auth0/module.json`

- [ ] **Step 1: Open the file and locate `capabilities`.**

The current shape lists `rpcs` and `events` arrays.

- [ ] **Step 2: Add the `edgeAuth` descriptor inside `capabilities`.**

Modify `capabilities` to be:

```json
"capabilities": {
  "rpcs": [
    "GetUser",
    ...
    "IntrospectSession"
  ],
  "events": [...],
  "edgeAuth": {
    "kind": "introspection-sidecar",
    "transport": "http",
    "method": "GET",
    "path": "/introspect",
    "port": 50052
  }
},
```

(Keep the existing `rpcs`/`events` lists unchanged — only add the `edgeAuth` field.)

- [ ] **Step 3: Verify it parses.**

```
pnpm -F @rntme/identity-auth0 typecheck
```

Expected: clean. (The build does not validate JSON; we'll catch it via the catalog test in Task 5.)

- [ ] **Step 4: Commit.**

```bash
git add modules/identity/auth0/module.json
git commit -m "feat(identity-auth0): declare capabilities.edgeAuth introspection-sidecar"
```

---

## Task 5: Surface `moduleEdgeAuth` in `CatalogManifest`

**Files:**
- Modify: `packages/artifacts/blueprint/src/types/artifact.ts`
- Modify: `packages/artifacts/blueprint/src/compose/catalog.ts`
- Modify: `packages/artifacts/blueprint/test/unit/catalog.test.ts` (or whatever test file exercises catalog building — verify path before editing)

- [ ] **Step 1: Locate the existing catalog test file.**

```
ls packages/artifacts/blueprint/test/unit/ | grep -i catalog
```

If `catalog.test.ts` exists, use it. If not, identify the test file that exercises `buildCatalogManifest` (search: `grep -rln "buildCatalogManifest" packages/artifacts/blueprint/test/`).

- [ ] **Step 2: Add the failing test.**

Append a test inside the relevant `describe` block:

```ts
it('populates moduleEdgeAuth from each module manifest', () => {
  const result = buildCatalogManifest([
    {
      packageName: '@rntme/identity-auth0',
      manifest: {
        name: '@rntme/identity-auth0',
        version: '0.0.0',
        capabilities: {
          rpcs: ['IntrospectSession'],
          events: [],
          edgeAuth: {
            kind: 'introspection-sidecar',
            transport: 'http',
            method: 'GET',
            path: '/introspect',
            port: 50052,
          },
        },
      },
      packageDir: '/tmp/auth0',
    },
  ]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.moduleEdgeAuth['@rntme/identity-auth0']).toEqual({
      kind: 'introspection-sidecar',
      transport: 'http',
      method: 'GET',
      path: '/introspect',
      port: 50052,
    });
  }
});

it('records null in moduleEdgeAuth for modules without edgeAuth', () => {
  const result = buildCatalogManifest([
    {
      packageName: '@rntme/some-noop',
      manifest: {
        name: '@rntme/some-noop',
        version: '0.0.0',
        capabilities: { rpcs: ['Foo'], events: [] },
      },
      packageDir: '/tmp/noop',
    },
  ]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.moduleEdgeAuth['@rntme/some-noop']).toBeNull();
  }
});
```

(Adjust the call shape to match the actual `buildCatalogManifest` signature once verified in Step 1; the assertion shape stays the same.)

- [ ] **Step 3: Run the test; expect FAIL.**

```
pnpm -F @rntme/blueprint test
```

Expected: `result.value.moduleEdgeAuth` is undefined.

- [ ] **Step 4: Add `moduleEdgeAuth` to `CatalogManifest`.**

Open `packages/artifacts/blueprint/src/types/artifact.ts`. Modify the `CatalogManifest` type:

```ts
import type { EdgeAuthDescriptor } from '@rntme/module-skeleton';

export type CatalogManifest = {
  readonly components: ReadonlyArray<{
    readonly type: string;
    readonly module: string;
    readonly props: Readonly<Record<string, PropSchema>>;
  }>;
  readonly operations: ReadonlyArray<{
    readonly name: string;
    readonly module: string;
    readonly appliesTo: readonly string[] | null;
    readonly params: Readonly<Record<string, PropSchema>>;
    readonly category: string | null;
  }>;
  readonly modulesWithBoot: readonly string[];
  readonly categoryToModule: Readonly<Record<string, string>>;
  readonly publicConfig: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly moduleEdgeAuth: Readonly<Record<string, EdgeAuthDescriptor | null>>;
};
```

- [ ] **Step 5: Populate the field in `buildCatalogManifest`.**

Open `packages/artifacts/blueprint/src/compose/catalog.ts`. After the existing component/operation loops, build a `moduleEdgeAuth` record:

```ts
const moduleEdgeAuth: Record<string, EdgeAuthDescriptor | null> = {};
for (const m of modules) {
  moduleEdgeAuth[m.packageName] = m.manifest.capabilities?.edgeAuth ?? null;
}
```

Then include `moduleEdgeAuth` in the returned object:

```ts
return ok({
  components,
  operations,
  modulesWithBoot,
  categoryToModule,
  publicConfig,
  moduleEdgeAuth,
} satisfies CatalogManifest);
```

Add the import for `EdgeAuthDescriptor`:

```ts
import type { EdgeAuthDescriptor } from '@rntme/module-skeleton';
```

- [ ] **Step 6: Re-run tests; expect PASS.**

```
pnpm -F @rntme/blueprint test
```

Expected: all blueprint unit tests pass, including the two new ones.

- [ ] **Step 7: Run typecheck across packages that depend on blueprint.**

```
pnpm -r run typecheck 2>&1 | grep -E "error|@rntme" | head -30
```

Expected: no new TypeScript errors. If a downstream package destructures `CatalogManifest` exhaustively, it may complain — fix in this same task by adding the field to that destructure (search: `grep -rn "moduleEdgeAuth\|categoryToModule" packages apps`).

- [ ] **Step 8: Commit.**

```bash
git add packages/artifacts/blueprint/src/types/artifact.ts packages/artifacts/blueprint/src/compose/catalog.ts packages/artifacts/blueprint/test/unit/
git commit -m "feat(blueprint): surface module edgeAuth descriptors in CatalogManifest"
```

---

## Task 6: Implement `createIdentityAuth0HttpServer`

**Files:**
- Create: `modules/identity/auth0/src/http-server.ts`
- Create: `modules/identity/auth0/test/unit/http-server.test.ts`

- [ ] **Step 1: Add `hono` to the auth0 module dependencies.**

Open `modules/identity/auth0/package.json` and add `"hono": "^4.0.0"` to `dependencies` (alphabetical between `@grpc/grpc-js` and `@auth0/auth0-spa-js`):

```json
"dependencies": {
  "@auth0/auth0-spa-js": "^2.1.3",
  "@grpc/grpc-js": "^1.14.3",
  "@rntme/conformance-identity": "workspace:*",
  "@rntme/contracts-common-v1": "workspace:*",
  "@rntme/contracts-identity-v1": "workspace:*",
  "auth0": "4.28.0",
  "hono": "^4.0.0",
  "jose": "^5"
},
```

Run `pnpm install --frozen-lockfile=false` from the workspace root to add the lockfile entry.

- [ ] **Step 2: Write the failing test file.**

Create `modules/identity/auth0/test/unit/http-server.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SessionStatus } from '@rntme/contracts-identity-v1';
import { createIdentityAuth0HttpApp } from '../../src/http-server.js';

const audience = 'https://demo.example.com/api';

function activeSession() {
  return {
    session_id: 'auth0|alice@1700000000',
    user_id: 'auth0|alice',
    status: SessionStatus.SESSION_STATUS_ACTIVE,
    issued_at: '2026-05-01T00:00:00.000Z',
    expires_at: '2026-05-01T01:00:00.000Z',
    audience,
    token_type: 1,
    public: {},
    private: {},
    unsafe: {},
    vendor_raw: {},
  };
}

function inactiveSession() {
  return {
    ...activeSession(),
    status: SessionStatus.SESSION_STATUS_INACTIVE,
    vendor_raw: { deactivation_reason: 'TOKEN_EXPIRED' },
  };
}

describe('createIdentityAuth0HttpApp', () => {
  it('returns 401 IDENTITY_HTTP_TOKEN_MISSING when Authorization header is absent', async () => {
    const app = createIdentityAuth0HttpApp({
      module: { IntrospectSession: async () => activeSession() },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { 'X-Rntme-Audience': audience },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      code: 'IDENTITY_HTTP_TOKEN_MISSING',
      message: 'Authorization header is required',
    });
  });

  it('returns 401 IDENTITY_HTTP_TOKEN_MISSING when Authorization is malformed (no Bearer)', async () => {
    const app = createIdentityAuth0HttpApp({
      module: { IntrospectSession: async () => activeSession() },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Token abc', 'X-Rntme-Audience': audience },
    });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('IDENTITY_HTTP_TOKEN_MISSING');
  });

  it('returns 401 IDENTITY_HTTP_AUDIENCE_MISSING when X-Rntme-Audience header is absent', async () => {
    const app = createIdentityAuth0HttpApp({
      module: { IntrospectSession: async () => activeSession() },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-x' },
    });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('IDENTITY_HTTP_AUDIENCE_MISSING');
  });

  it('returns 200 with X-Rntme-User-* headers on active session', async () => {
    let received: { token: string; audience: string } | null = null;
    const app = createIdentityAuth0HttpApp({
      module: {
        IntrospectSession: async (req) => {
          received = req as { token: string; audience: string };
          return activeSession();
        },
      },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-x', 'X-Rntme-Audience': audience },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Rntme-User-Sub')).toBe('auth0|alice');
    expect(res.headers.get('X-Rntme-User-Audience')).toBe(audience);
    expect(res.headers.get('X-Rntme-Session-Status')).toBe('ACTIVE');
    expect(received).toEqual({ token: 'Bearer token-x', audience });
  });

  it('returns 401 with IDENTITY_CONSISTENCY_INVALID_TOKEN on inactive session', async () => {
    const app = createIdentityAuth0HttpApp({
      module: { IntrospectSession: async () => inactiveSession() },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Bearer expired', 'X-Rntme-Audience': audience },
    });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('IDENTITY_CONSISTENCY_INVALID_TOKEN');
  });

  it('returns 500 with IDENTITY_VENDOR_UNAVAILABLE when handler throws', async () => {
    const app = createIdentityAuth0HttpApp({
      module: {
        IntrospectSession: async () => {
          throw new Error('boom');
        },
      },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Bearer x', 'X-Rntme-Audience': audience },
    });
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe('IDENTITY_VENDOR_UNAVAILABLE');
  });
});
```

- [ ] **Step 3: Run the test; expect FAIL.**

```
pnpm -F @rntme/identity-auth0 vitest run test/unit/http-server.test.ts
```

Expected: cannot resolve `../../src/http-server.js`.

- [ ] **Step 4: Implement `http-server.ts`.**

Create `modules/identity/auth0/src/http-server.ts`:

```ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { SessionStatus } from '@rntme/contracts-identity-v1';
import type { Auth0IdentityModule } from './server.js';

export interface IdentityAuth0HttpAppOptions {
  readonly module: Pick<Auth0IdentityModule, 'IntrospectSession'>;
}

export function createIdentityAuth0HttpApp(opts: IdentityAuth0HttpAppOptions): Hono {
  const app = new Hono();

  app.get('/introspect', async (c) => {
    const auth = c.req.header('Authorization');
    if (!auth || !/^Bearer\s+\S+/.test(auth)) {
      return c.json(
        { code: 'IDENTITY_HTTP_TOKEN_MISSING', message: 'Authorization header is required' },
        401,
      );
    }

    const audience = c.req.header('X-Rntme-Audience');
    if (!audience || audience.length === 0) {
      return c.json(
        { code: 'IDENTITY_HTTP_AUDIENCE_MISSING', message: 'X-Rntme-Audience header is required' },
        401,
      );
    }

    const handler = opts.module.IntrospectSession;
    if (handler === undefined) {
      return c.json(
        { code: 'IDENTITY_VENDOR_UNAVAILABLE', message: 'IntrospectSession not implemented' },
        500,
      );
    }

    let session: { status?: number; user_id?: string; vendor_raw?: { deactivation_reason?: string } };
    try {
      session = (await handler({ token: auth, audience })) as typeof session;
    } catch (e) {
      return c.json(
        { code: 'IDENTITY_VENDOR_UNAVAILABLE', message: e instanceof Error ? e.message : 'introspection failed' },
        500,
      );
    }

    const active = session.status === SessionStatus.SESSION_STATUS_ACTIVE;
    if (!active) {
      const reason = session.vendor_raw?.deactivation_reason;
      return c.json(
        {
          code: 'IDENTITY_CONSISTENCY_INVALID_TOKEN',
          message: reason ?? 'session is not active',
        },
        401,
      );
    }

    const sub = session.user_id ?? '';
    c.header('X-Rntme-User-Sub', sub);
    c.header('X-Rntme-User-Audience', audience);
    c.header('X-Rntme-Session-Status', 'ACTIVE');
    return c.body(null, 200);
  });

  return app;
}

export interface IdentityAuth0HttpServerOptions extends IdentityAuth0HttpAppOptions {
  readonly port: number;
  readonly host?: string;
}

export interface IdentityAuth0HttpServer {
  listen(): Promise<{ port: number }>;
  stop(): Promise<void>;
}

export function createIdentityAuth0HttpServer(opts: IdentityAuth0HttpServerOptions): IdentityAuth0HttpServer {
  const app = createIdentityAuth0HttpApp(opts);
  let server: ReturnType<typeof serve> | null = null;

  return {
    listen(): Promise<{ port: number }> {
      return new Promise((resolve, reject) => {
        server = serve(
          { fetch: app.fetch, port: opts.port, hostname: opts.host ?? '0.0.0.0' },
          (info) => resolve({ port: info.port }),
        );
        server.on?.('error', reject);
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve) => {
        if (server === null) return resolve();
        server.close(() => resolve());
      });
    },
  };
}
```

- [ ] **Step 5: Add `@hono/node-server` to dependencies if not present.**

```
grep '"@hono/node-server"' modules/identity/auth0/package.json
```

If absent, append `"@hono/node-server": "^1.11.0"` to `dependencies` and re-run `pnpm install --frozen-lockfile=false`.

- [ ] **Step 6: Re-run tests; expect PASS.**

```
pnpm -F @rntme/identity-auth0 vitest run test/unit/http-server.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 7: Commit.**

```bash
git add modules/identity/auth0/package.json modules/identity/auth0/src/http-server.ts modules/identity/auth0/test/unit/http-server.test.ts pnpm-lock.yaml
git commit -m "feat(identity-auth0): GET /introspect HTTP transport for IntrospectSession"
```

---

## Task 7: Wire the HTTP server into the bin entrypoint

**Files:**
- Modify: `modules/identity/auth0/src/bin/server.ts`

- [ ] **Step 1: Read the current bin to confirm shape.**

```
cat modules/identity/auth0/src/bin/server.ts
```

- [ ] **Step 2: Replace the body of `bin/server.ts`.**

Overwrite with:

```ts
import { createAuth0Adapter } from '../adapter.js';
import { createAuth0IdentityModule } from '../handlers.js';
import { createIdentityAuth0GrpcServer } from '../server.js';
import { createIdentityAuth0HttpServer } from '../http-server.js';

function readPort(envName: string, fallbackName: string | null, defaultPort: number): number {
  const raw =
    process.env[envName] ?? (fallbackName !== null ? process.env[fallbackName] : undefined) ?? String(defaultPort);
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid ${envName}/${fallbackName ?? ''} value: ${raw}`);
  }
  return port;
}

const adapter = createAuth0Adapter();
const module = createAuth0IdentityModule(adapter);

const grpcPort = readPort('PORT', 'GRPC_PORT', 50051);
const httpPort = readPort('HTTP_PORT', null, 50052);
const host = process.env.HOST ?? '0.0.0.0';

const grpc = createIdentityAuth0GrpcServer({ module, port: grpcPort, host });
const http = createIdentityAuth0HttpServer({ module, port: httpPort, host });

const [grpcInfo, httpInfo] = await Promise.all([grpc.listen(), http.listen()]);

process.stdout.write(
  `${JSON.stringify({ msg: 'identity_auth0_grpc_listening', port: grpcInfo.port })}\n`,
);
process.stdout.write(
  `${JSON.stringify({ msg: 'identity_auth0_http_listening', port: httpInfo.port })}\n`,
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void Promise.all([grpc.stop(), http.stop()]).then(() => process.exit(0));
  });
}
```

- [ ] **Step 3: Build the package to confirm it compiles.**

```
pnpm -F @rntme/identity-auth0 build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Run all module unit + integration tests.**

```
pnpm -F @rntme/identity-auth0 test
```

Expected: green.

- [ ] **Step 5: Commit.**

```bash
git add modules/identity/auth0/src/bin/server.ts
git commit -m "feat(identity-auth0): bin starts gRPC :50051 + HTTP :50052 in parallel"
```

---

## Task 8: Update Dockerfile to expose `:50052` and set `HTTP_PORT`

**Files:**
- Modify: `modules/identity/auth0/Dockerfile`

- [ ] **Step 1: Open the Dockerfile.**

- [ ] **Step 2: Replace the `ENV` and `EXPOSE` block.**

Find these lines:

```dockerfile
ENV NODE_ENV=production \
    PORT=50051

USER node
EXPOSE 50051
CMD ["node", "dist/bin/server.js"]
```

Replace with:

```dockerfile
ENV NODE_ENV=production \
    PORT=50051 \
    HTTP_PORT=50052

USER node
EXPOSE 50051 50052
CMD ["node", "dist/bin/server.js"]
```

- [ ] **Step 3: Build the image locally to confirm it does not regress.**

```
docker build -f modules/identity/auth0/Dockerfile -t rntme-identity-auth0:edge-auth-test .
```

Expected: image builds. If your environment lacks Docker, skip this step but note it in the commit message footer.

- [ ] **Step 4: Commit.**

```bash
git add modules/identity/auth0/Dockerfile
git commit -m "build(identity-auth0): expose 50052 for HTTP introspection transport"
```

---

## Task 9: Add HTTP introspection conformance suite

**Files:**
- Create: `modules/identity/conformance/src/introspection-http.ts`
- Modify: `modules/identity/conformance/src/index.ts`
- Modify: `modules/identity/conformance/package.json` (only if a new dep is needed; `hono` is not required here because tests use `fetch` against a live URL)

- [ ] **Step 1: Read the conformance package layout to find existing exports.**

```
ls modules/identity/conformance/src/
cat modules/identity/conformance/src/index.ts
```

- [ ] **Step 2: Create `introspection-http.ts`.**

```ts
import { describe, expect, it } from 'vitest';

export type IntrospectionHttpHarness = {
  /** Base URL of a running HTTP introspection server (e.g. http://localhost:50052). */
  readonly baseUrl: string;
  /** Audience the server is configured to accept. */
  readonly audience: string;
  /** A token the server will introspect as ACTIVE. */
  readonly validToken: string;
  /** A token the server will reject. */
  readonly invalidToken: string;
  /** Callback to start the harness; resolves to baseUrl/audience/tokens. Called once per suite. */
  readonly setup?: () => Promise<void>;
  /** Callback to tear the harness down. Called once per suite. */
  readonly teardown?: () => Promise<void>;
};

export function runIntrospectionHttpConformance(label: string, makeHarness: () => IntrospectionHttpHarness): void {
  describe(`HTTP introspection conformance — ${label}`, () => {
    const h = makeHarness();

    it('rejects requests with no Authorization header', async () => {
      const res = await fetch(`${h.baseUrl}/introspect`, {
        headers: { 'X-Rntme-Audience': h.audience },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('IDENTITY_HTTP_TOKEN_MISSING');
    });

    it('rejects requests with no X-Rntme-Audience header', async () => {
      const res = await fetch(`${h.baseUrl}/introspect`, {
        headers: { Authorization: `Bearer ${h.validToken}` },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('IDENTITY_HTTP_AUDIENCE_MISSING');
    });

    it('rejects malformed Authorization (no Bearer prefix)', async () => {
      const res = await fetch(`${h.baseUrl}/introspect`, {
        headers: { Authorization: `Token ${h.validToken}`, 'X-Rntme-Audience': h.audience },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('IDENTITY_HTTP_TOKEN_MISSING');
    });

    it('rejects an invalid token', async () => {
      const res = await fetch(`${h.baseUrl}/introspect`, {
        headers: { Authorization: `Bearer ${h.invalidToken}`, 'X-Rntme-Audience': h.audience },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('IDENTITY_CONSISTENCY_INVALID_TOKEN');
    });

    it('returns 200 + X-Rntme-User-* headers on a valid token', async () => {
      const res = await fetch(`${h.baseUrl}/introspect`, {
        headers: { Authorization: `Bearer ${h.validToken}`, 'X-Rntme-Audience': h.audience },
      });
      expect(res.status).toBe(200);
      const sub = res.headers.get('X-Rntme-User-Sub');
      expect(sub).toBeTruthy();
      expect(res.headers.get('X-Rntme-User-Audience')).toBe(h.audience);
      expect(res.headers.get('X-Rntme-Session-Status')).toBe('ACTIVE');
    });
  });
}
```

- [ ] **Step 3: Re-export from `index.ts`.**

Open `modules/identity/conformance/src/index.ts` and add:

```ts
export { runIntrospectionHttpConformance, type IntrospectionHttpHarness } from './introspection-http.js';
```

- [ ] **Step 4: Build the conformance package.**

```
pnpm -F @rntme/conformance-identity build
```

Expected: clean build.

- [ ] **Step 5: Commit.**

```bash
git add modules/identity/conformance/src/introspection-http.ts modules/identity/conformance/src/index.ts
git commit -m "feat(conformance-identity): runIntrospectionHttpConformance suite"
```

---

## Task 10: Wire the conformance suite from the auth0 module

**Files:**
- Create: `modules/identity/auth0/test/integration/conformance/introspection-http.test.ts`

- [ ] **Step 1: Inspect existing auth0 integration tests for a JWKS / token harness.**

```
ls modules/identity/auth0/test/integration/
grep -rln "createRemoteJWKSet\|exportSpkiPublicKey\|generateKeyPair\|createLocalJWKSet" modules/identity/auth0/test/integration/
```

If a JWKS test fixture exists, reuse it. If not, create one inline in the test using `jose.generateKeyPair` + a local JWKS resolver.

- [ ] **Step 2: Create the integration test.**

```ts
import { afterAll, beforeAll } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { runIntrospectionHttpConformance } from '@rntme/conformance-identity';
import { createIdentityAuth0HttpServer } from '../../../src/http-server.js';
import { createAuth0IdentityModule } from '../../../src/handlers.js';

const audience = 'https://demo.example.com/api';
const issuer = 'https://demo-rntme.us.auth0.com/';

let baseUrl = '';
let server: ReturnType<typeof createIdentityAuth0HttpServer> | null = null;
let validToken = '';
const invalidToken = 'eyJ.bogus.signature';

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-kid';
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';
  const localJwks = async () => publicKey;

  const adapter = {
    /* Auth0 mgmt RPCs not used by IntrospectSession; stubbed empty */
  } as Parameters<typeof createAuth0IdentityModule>[0];

  const module = createAuth0IdentityModule(adapter, {
    auth0Issuer: issuer,
    jwksResolver: localJwks,
  });

  server = createIdentityAuth0HttpServer({ module, port: 0, host: '127.0.0.1' });
  const { port } = await server.listen();
  baseUrl = `http://127.0.0.1:${port}`;

  validToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer(issuer)
    .setSubject('auth0|alice')
    .setAudience(audience)
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(privateKey);
});

afterAll(async () => {
  if (server !== null) await server.stop();
});

runIntrospectionHttpConformance('identity-auth0', () => ({
  baseUrl,
  audience,
  validToken,
  invalidToken,
}));
```

(If `createAuth0IdentityModule`'s second argument shape differs, adjust based on `modules/identity/auth0/src/handlers.ts` `HandlerOptions`. The harness still works because the conformance suite only calls `IntrospectSession` via HTTP.)

- [ ] **Step 3: Run the integration test.**

```
pnpm -F @rntme/identity-auth0 vitest run test/integration/conformance/introspection-http.test.ts
```

Expected: all 5 conformance scenarios pass against the real Hono server.

- [ ] **Step 4: Commit.**

```bash
git add modules/identity/auth0/test/integration/conformance/introspection-http.test.ts
git commit -m "test(identity-auth0): integration conformance for HTTP introspection"
```

---

## Task 11: Extend `EdgeMiddleware.auth` with `moduleIntrospectPort` + new validation error

**Files:**
- Modify: `packages/deploy/deploy-core/src/edge.ts`
- Modify: `packages/deploy/deploy-core/src/composed-project.ts`
- Modify: `packages/deploy/deploy-core/src/errors.ts`
- Modify: `packages/deploy/deploy-core/test/unit/edge.test.ts`

- [ ] **Step 1: Read the current `errors.ts` for the `DeploymentPlanError` shape.**

```
cat packages/deploy/deploy-core/src/errors.ts | head -40
```

Note the existing pattern (codes are string literals on a discriminated union, or simple `code` field — copy that exactly).

- [ ] **Step 2: Add the failing test cases.**

Open `packages/deploy/deploy-core/test/unit/edge.test.ts`. Find the existing auth-middleware test block (search for `kind: 'auth'`). Add these two tests in the same `describe`:

```ts
it('plans auth middleware with moduleIntrospectPort from module edgeAuth', () => {
  const result = planEdge(
    {
      name: 'p',
      services: {
        app: { slug: 'app', kind: 'domain' },
        'identity-auth0': { slug: 'identity-auth0', kind: 'integration' },
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
      routes: { http: { '/api': 'app' } },
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'auth0',
          audience: 'https://demo.example.com/api',
          moduleSlug: 'identity-auth0',
        },
      },
      mounts: [{ target: 'http:/api', use: ['auth'] }],
    },
    /* config */ baseConfigWithModuleImage('identity-auth0'),
    /* workloads */ workloadsWith('identity-auth0', { expose: false, env: { AUTH0_DOMAIN: 'd' } }),
  );
  expect(result.errors).toHaveLength(0);
  const auth = result.edge.middleware.find((m) => m.kind === 'auth')!;
  expect(auth.moduleIntrospectPort).toBe(50052);
});

it('rejects auth middleware when module has no edgeAuth', () => {
  const result = planEdge(
    {
      name: 'p',
      services: {
        app: { slug: 'app', kind: 'domain' },
        'identity-noop': { slug: 'identity-noop', kind: 'integration' },
      },
      modules: { 'identity-noop': { edgeAuth: null } },
      routes: { http: { '/api': 'app' } },
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'noop',
          audience: 'https://demo.example.com/api',
          moduleSlug: 'identity-noop',
        },
      },
      mounts: [{ target: 'http:/api', use: ['auth'] }],
    },
    baseConfigWithModuleImage('identity-noop'),
    workloadsWith('identity-noop', { expose: false, env: {} }),
  );
  const codes = result.errors.map((e) => e.code);
  expect(codes).toContain('DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING');
});
```

(Define `baseConfigWithModuleImage` and `workloadsWith` helpers near the top of the file by copying and adapting whatever scaffolding the existing tests use. If the existing tests already create these via inline literals, mirror that pattern instead of factoring helpers.)

- [ ] **Step 3: Run the test; expect FAIL on at least one.**

```
pnpm -F @rntme/deploy-core test
```

Expected: `moduleIntrospectPort` undefined; `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING` not produced.

- [ ] **Step 4: Add the error code.**

In `packages/deploy/deploy-core/src/errors.ts`, locate the union/list of error codes and add a new variant:

```ts
| {
    code: 'DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING';
    message: string;
    middleware: string;
    moduleSlug: string;
    path: string;
  }
```

(Match the precise shape of existing error variants in the file.)

- [ ] **Step 5: Add `modules` to `ComposedProjectInput`.**

Open `packages/deploy/deploy-core/src/composed-project.ts` and append:

```ts
import type { EdgeAuthDescriptor } from '@rntme/module-skeleton';

export type ComposedProjectModuleInfo = {
  readonly edgeAuth?: EdgeAuthDescriptor | null;
};

export type ComposedProjectInput = {
  readonly name: string;
  readonly services: Readonly<Record<string, ComposedProjectService>>;
  readonly publicConfigJson?: string | null;
  readonly modules?: Readonly<Record<string, ComposedProjectModuleInfo>>;
  readonly routes?: ProjectRouteMap;
  readonly middleware?: Readonly<Record<string, ProjectMiddlewareDecl>>;
  readonly mounts?: readonly ProjectMountDecl[];
};
```

- [ ] **Step 6: Extend the auth `EdgeMiddleware` variant.**

Open `packages/deploy/deploy-core/src/edge.ts`. In the auth variant of `EdgeMiddleware`, add `moduleIntrospectPort: number`:

```ts
| {
    readonly mountTarget: string;
    readonly name: string;
    readonly kind: 'auth';
    readonly provider: string;
    readonly audience: string;
    readonly moduleSlug: string;
    readonly moduleIntrospectPort: number;
    readonly policy?: string;
    readonly config?: unknown;
  };
```

- [ ] **Step 7: Update `planMiddleware` (auth branch) to read edgeAuth.**

Find the `if (decl.kind === 'auth')` branch (around line 191 in current code). After existing checks (provider, audience, moduleSlug; module workload exists; AUTH0_DOMAIN), insert before the `planned.push({...})`:

```ts
const moduleInfo = project.modules?.[decl.moduleSlug];
const edgeAuth = moduleInfo?.edgeAuth;
if (edgeAuth === null || edgeAuth === undefined) {
  errors.push({
    code: 'DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING',
    message: `auth middleware "${middlewareName}" requires module "${decl.moduleSlug}" to declare capabilities.edgeAuth`,
    middleware: middlewareName,
    moduleSlug: decl.moduleSlug,
    path: `modules.${decl.moduleSlug}.capabilities.edgeAuth`,
  });
  continue;
}
```

Then in the `planned.push`, add `moduleIntrospectPort: edgeAuth.port`:

```ts
planned.push({
  mountTarget: mount.target,
  name: middlewareName,
  kind: decl.kind,
  provider: decl.provider,
  audience: decl.audience,
  moduleSlug: decl.moduleSlug,
  moduleIntrospectPort: edgeAuth.port,
  ...(decl.policy !== undefined ? { policy: decl.policy } : {}),
  ...(decl.config !== undefined ? { config: decl.config } : {}),
});
```

- [ ] **Step 8: Re-run the deploy-core tests; expect PASS.**

```
pnpm -F @rntme/deploy-core test
```

Expected: all tests pass, including the two new ones.

- [ ] **Step 9: Run downstream typechecks.**

```
pnpm -r run typecheck 2>&1 | grep -E "error|@rntme/deploy" | head -20
```

Expected: only failures in deploy-dokploy / platform-http (we'll fix them in subsequent tasks).

- [ ] **Step 10: Commit.**

```bash
git add packages/deploy/deploy-core/src/edge.ts packages/deploy/deploy-core/src/composed-project.ts packages/deploy/deploy-core/src/errors.ts packages/deploy/deploy-core/test/unit/edge.test.ts
git commit -m "feat(deploy-core): EdgeMiddleware.auth gains moduleIntrospectPort + DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING"
```

---

## Task 12: Update platform-http executor to pass `modules.edgeAuth` to deploy-core

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts`

- [ ] **Step 1: Locate `toDeployCoreInput` in `executor.ts`.**

```
grep -n "toDeployCoreInput\|services: Object.fromEntries" apps/platform-http/src/deploy/executor.ts | head
```

- [ ] **Step 2: Add the failing test assertion.**

Open `apps/platform-http/test/unit/deploy/executor.test.ts`. Find the existing test that asserts on the shape of `toDeployCoreInput` output (search for `services:` in expectations). Add an assertion in the `'adapts composed blueprints into deploy-core input ...'` test:

```ts
expect(deployInput.modules?.['identity-auth0']?.edgeAuth).toEqual({
  kind: 'introspection-sidecar',
  transport: 'http',
  method: 'GET',
  path: '/introspect',
  port: 50052,
});
```

(If the existing fixture's `catalogManifest` does not yet include `moduleEdgeAuth['@rntme/identity-auth0']`, add it to that fixture.)

- [ ] **Step 3: Run the test; expect FAIL.**

```
pnpm -F @rntme/platform-http vitest run test/unit/deploy/executor.test.ts
```

Expected: `deployInput.modules` is undefined.

- [ ] **Step 4: Update `toDeployCoreInput` to populate `modules`.**

Open `apps/platform-http/src/deploy/executor.ts`. In `toDeployCoreInput`, after the `services:` entry being built, add:

```ts
const moduleEdgeAuth = value.catalogManifest?.moduleEdgeAuth ?? {};
const modules: Record<string, { edgeAuth: typeof moduleEdgeAuth[string] | null }> = {};
for (const slug of value.project.services) {
  // Map service slug to module package via project.json#modules
  const moduleRef = value.project.modules?.[slug] ?? Object.values(value.project.modules ?? {}).find((m) => m.package);
  // Translation: service slug `identity-auth0` corresponds to package `@rntme/identity-auth0`.
  // The catalog stores edgeAuth keyed by package name, so we look it up via the modules map.
  if (moduleRef !== undefined) {
    modules[slug] = { edgeAuth: moduleEdgeAuth[moduleRef.package] ?? null };
  }
}
```

Then include `modules` in the returned object:

```ts
return {
  name: value.project.name,
  publicConfigJson,
  services: ...,
  modules,
  ...(value.project.routes === undefined ? {} : { routes: value.project.routes }),
  ...(value.project.middleware === undefined ? {} : { middleware: value.project.middleware }),
  ...(value.project.mounts === undefined ? {} : { mounts: value.project.mounts }),
};
```

- [ ] **Step 5: Verify the service-slug → package lookup.**

The blueprint stores modules keyed by *role name* (e.g. `"identity"` in `project.json#modules.identity`), and the *service* `identity-auth0` does not appear in `project.json#modules` directly. Confirm by reading `demo/notes-blueprint/project.json`:

```
cat demo/notes-blueprint/project.json
```

Then read `packages/artifacts/blueprint/src/compose/modules.ts` to see how `serviceSlug` is derived from the module ref (likely the package's `module.json#name` last segment). If the mapping is `serviceSlug = packageName.split('/').pop()` (e.g. `@rntme/identity-auth0` → `identity-auth0`), the loop becomes:

```ts
for (const [, moduleRef] of Object.entries(value.project.modules ?? {})) {
  const slug = moduleRef.package.split('/').pop()!;
  modules[slug] = { edgeAuth: moduleEdgeAuth[moduleRef.package] ?? null };
}
```

If the mapping is different, follow the actual logic from `compose/modules.ts`. **The test from Step 2 will fail until the mapping is right** — use the test as the contract.

- [ ] **Step 6: Re-run the test; expect PASS.**

```
pnpm -F @rntme/platform-http vitest run test/unit/deploy/executor.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit.**

```bash
git add apps/platform-http/src/deploy/executor.ts apps/platform-http/test/unit/deploy/executor.test.ts
git commit -m "feat(platform-http): pass module edgeAuth to deploy-core in toDeployCoreInput"
```

---

## Task 13: Rewrite `nginx.ts` auth render with `auth_request`

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/nginx.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/nginx.test.ts`

- [ ] **Step 1: Add the failing tests.**

Open `packages/deploy/deploy-dokploy/test/unit/nginx.test.ts`. Append a new `describe`:

```ts
describe('auth middleware rendering', () => {
  function authEdge(): EdgePlan {
    return {
      routes: [
        {
          id: 'http:/api',
          kind: 'http',
          path: '/api',
          targetService: 'app',
          targetWorkload: 'app',
        },
      ],
      middleware: [
        {
          mountTarget: 'http:/api',
          name: 'auth',
          kind: 'auth',
          provider: 'auth0',
          audience: 'https://notes-demo.rntme.com/api',
          moduleSlug: 'identity-auth0',
          moduleIntrospectPort: 50052,
        },
      ],
    };
  }

  it('renders an upstream block per (slug, audience) pair', () => {
    const rendered = renderNginxConfig(authEdge(), {
      app: 'http://rntme-acme-notes-app:3000',
      'identity-auth0': 'http://rntme-acme-notes-identity-auth0:50052',
    });
    expect(rendered).toMatch(/upstream rntme_auth_identity-auth0__[0-9a-f]{8}\s*\{/);
    expect(rendered).toContain('server rntme-acme-notes-identity-auth0:50052;');
  });

  it('renders an internal location with X-Rntme-Audience set', () => {
    const rendered = renderNginxConfig(authEdge(), {
      app: 'http://rntme-acme-notes-app:3000',
      'identity-auth0': 'http://rntme-acme-notes-identity-auth0:50052',
    });
    expect(rendered).toMatch(/location = \/_rntme_auth_identity-auth0__[0-9a-f]{8}\s*\{/);
    expect(rendered).toContain('internal;');
    expect(rendered).toMatch(/proxy_pass\s+http:\/\/rntme_auth_identity-auth0__[0-9a-f]{8}\/introspect;/);
    expect(rendered).toContain('proxy_set_header   X-Rntme-Audience   "https://notes-demo.rntme.com/api";');
    expect(rendered).toContain('proxy_pass_request_body off;');
  });

  it('renders auth_request and forwards X-Rntme-User-* on /api', () => {
    const rendered = renderNginxConfig(authEdge(), {
      app: 'http://rntme-acme-notes-app:3000',
      'identity-auth0': 'http://rntme-acme-notes-identity-auth0:50052',
    });
    expect(rendered).toMatch(/auth_request\s+\/_rntme_auth_identity-auth0__[0-9a-f]{8};/);
    expect(rendered).toContain('proxy_set_header      X-Rntme-User-Sub      $rntme_user_sub;');
    expect(rendered).toContain('proxy_set_header      X-Rntme-User-Audience $rntme_user_audience;');
    expect(rendered).toMatch(/error_page 401\s+= @rntme_auth_401_identity-auth0__[0-9a-f]{8};/);
  });

  it('renders a named 401 location returning JSON', () => {
    const rendered = renderNginxConfig(authEdge(), {
      app: 'http://rntme-acme-notes-app:3000',
      'identity-auth0': 'http://rntme-acme-notes-identity-auth0:50052',
    });
    expect(rendered).toMatch(/location @rntme_auth_401_identity-auth0__[0-9a-f]{8}\s*\{/);
    expect(rendered).toContain('default_type application/json;');
    expect(rendered).toContain(`return 401 '{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}';`);
  });

  it('does NOT render auth_request for routes without auth middleware', () => {
    const rendered = renderNginxConfig(
      {
        routes: [
          {
            id: 'http:/public',
            kind: 'http',
            path: '/public',
            targetService: 'app',
            targetWorkload: 'app',
          },
        ],
        middleware: [],
      },
      { app: 'http://rntme-acme-notes-app:3000' },
    );
    expect(rendered).not.toContain('auth_request');
    expect(rendered).not.toContain('rntme_auth_');
  });
});
```

- [ ] **Step 2: Run; expect FAIL on every assertion.**

```
pnpm -F @rntme/deploy-dokploy vitest run test/unit/nginx.test.ts
```

Expected: 5 new tests fail.

- [ ] **Step 3: Rewrite `nginx.ts`.**

Open `packages/deploy/deploy-dokploy/src/nginx.ts`. Replace the entire file with:

```ts
import { createHash } from 'node:crypto';
import type { EdgeMiddleware, EdgePlan, EdgeRoute } from '@rntme/deploy-core';

type AuthMiddleware = Extract<EdgeMiddleware, { kind: 'auth' }>;

type AuthBlock = {
  readonly slug: string;
  readonly audHash: string;
  readonly audience: string;
  readonly upstream: string;
  readonly key: string; // <slug>__<audHash>
};

export function renderNginxConfig(
  edge: EdgePlan,
  upstreams: Readonly<Record<string, string>>,
): string {
  const rateLimitZones = edge.middleware
    .filter((m): m is Extract<EdgeMiddleware, { kind: 'rate-limit' }> => m.kind === 'rate-limit')
    .map((m) => {
      const zone = zoneName(m.mountTarget);
      return `limit_req_zone $binary_remote_addr zone=${zone}:10m rate=${m.config.requestsPerMinute}r/m;`;
    });

  const authMiddlewares = edge.middleware.filter((m): m is AuthMiddleware => m.kind === 'auth');
  const authBlocks = buildAuthBlocks(authMiddlewares, upstreams);
  const upstreamLines = authBlocks.map(
    (b) => `  upstream rntme_auth_${b.key} {\n    server ${b.upstream};\n  }`,
  );

  const internalLocations = authBlocks.map((b) => renderAuthInternalLocation(b));
  const named401Locations = authBlocks.map((b) => renderAuthNamed401Location(b));

  const locations = edge.routes.map((route) =>
    renderLocation(
      route,
      upstreams[route.targetWorkload] ?? `http://${route.targetWorkload}:3000`,
      edge.middleware,
      authBlocks,
    ),
  );

  return [
    'events {}',
    'http {',
    ...rateLimitZones.map((line) => `  ${line}`),
    ...upstreamLines,
    '  server {',
    '    listen 8080;',
    '    location = /health { return 200 "ok\\n"; }',
    ...renderConfigLocation(),
    ...internalLocations,
    ...named401Locations,
    ...locations,
    '  }',
    '}',
    '',
  ].join('\n');
}

function buildAuthBlocks(
  middlewares: readonly AuthMiddleware[],
  upstreams: Readonly<Record<string, string>>,
): AuthBlock[] {
  const seen = new Map<string, AuthBlock>();
  for (const m of middlewares) {
    assertSafeSlug(m.moduleSlug);
    const audHash = sha256Hex8(m.audience);
    const key = `${m.moduleSlug}__${audHash}`;
    if (seen.has(key)) continue;
    const upstreamUrl = upstreams[m.moduleSlug] ?? `http://${m.moduleSlug}:${m.moduleIntrospectPort}`;
    const upstreamHost = stripScheme(upstreamUrl);
    assertSafeUpstreamHost(upstreamHost);
    seen.set(key, {
      slug: m.moduleSlug,
      audHash,
      audience: m.audience,
      upstream: upstreamHost,
      key,
    });
  }
  return [...seen.values()];
}

function renderAuthInternalLocation(b: AuthBlock): string {
  return [
    `    location = /_rntme_auth_${b.key} {`,
    '      internal;',
    `      proxy_pass         http://rntme_auth_${b.key}/introspect;`,
    '      proxy_pass_request_body off;',
    '      proxy_set_header   content-length     "";',
    '      proxy_set_header   Authorization      $http_authorization;',
    `      proxy_set_header   X-Rntme-Audience   "${b.audience}";`,
    '      proxy_intercept_errors on;',
    '    }',
  ].join('\n');
}

function renderAuthNamed401Location(b: AuthBlock): string {
  return [
    `    location @rntme_auth_401_${b.key} {`,
    '      default_type application/json;',
    `      return 401 '{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}';`,
    '    }',
  ].join('\n');
}

function renderConfigLocation(): string[] {
  return [
    '    location = /config.json {',
    '      default_type application/json;',
    '      alias /srv/config.json;',
    '    }',
  ];
}

function renderLocation(
  route: EdgeRoute,
  upstream: string,
  middleware: readonly EdgeMiddleware[],
  authBlocks: readonly AuthBlock[],
): string {
  assertSafeLocationPath(route.path);
  assertSafeUpstreamUrl(upstream);
  const applied = middleware.filter((m) => m.mountTarget === route.id);
  const lines = [`    location ${route.path} {`];

  for (const m of applied) {
    if (m.kind === 'rate-limit') {
      lines.push(`      limit_req zone=${zoneName(m.mountTarget)} burst=${m.config.burst};`);
    }
    if (m.kind === 'body-limit') {
      assertSafeBodyLimit(m.config.maxBodySize);
      lines.push(`      client_max_body_size ${m.config.maxBodySize};`);
    }
    if (m.kind === 'timeout') {
      const seconds = Math.ceil(m.config.upstreamTimeoutMs / 1000);
      lines.push(`      proxy_connect_timeout ${seconds}s;`);
      lines.push(`      proxy_read_timeout ${seconds}s;`);
      lines.push(`      proxy_send_timeout ${seconds}s;`);
    }
    if (m.kind === 'request-context') {
      const requestHeader = m.config.requestIdHeader ?? 'x-request-id';
      const correlationHeader = m.config.correlationIdHeader ?? 'x-correlation-id';
      assertSafeHeaderName(requestHeader);
      assertSafeHeaderName(correlationHeader);
      lines.push(`      proxy_set_header ${requestHeader} $request_id;`);
      lines.push(
        `      proxy_set_header ${correlationHeader} $http_${headerVariable(correlationHeader)};`,
      );
    }
    if (m.kind === 'auth') {
      const audHash = sha256Hex8(m.audience);
      const key = `${m.moduleSlug}__${audHash}`;
      lines.push(`      # auth middleware: provider=${commentValue(m.provider)}, audience=${commentValue(m.audience)}`);
      lines.push(`      auth_request          /_rntme_auth_${key};`);
      lines.push(`      auth_request_set      $rntme_user_sub      $upstream_http_x_rntme_user_sub;`);
      lines.push(`      auth_request_set      $rntme_user_audience $upstream_http_x_rntme_user_audience;`);
      lines.push(`      error_page 401        = @rntme_auth_401_${key};`);
      lines.push(`      proxy_set_header      X-Rntme-User-Sub      $rntme_user_sub;`);
      lines.push(`      proxy_set_header      X-Rntme-User-Audience $rntme_user_audience;`);
      lines.push(`      proxy_set_header      Authorization         $http_authorization;`);
    }
  }

  lines.push('      proxy_set_header Host $host;');
  lines.push('      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
  lines.push(`      proxy_pass ${upstream};`);
  lines.push('    }');
  return lines.join('\n');
}

function zoneName(target: string): string {
  return target.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function headerVariable(header: string): string {
  return header.toLowerCase().replace(/-/g, '_');
}

function commentValue(value: string): string {
  return value.replace(/[\r\n]/g, ' ').replace(/\*\//g, '* /');
}

function sha256Hex8(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

function assertSafeLocationPath(path: string): void {
  if (!/^\/[A-Za-z0-9/_~.-]*$/.test(path)) {
    throw new TypeError(`unsafe Nginx location path: ${path}`);
  }
}

function assertSafeHeaderName(header: string): void {
  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(header)) {
    throw new TypeError(`unsafe Nginx header name: ${header}`);
  }
}

function assertSafeBodyLimit(value: string): void {
  if (!/^(0|[1-9][0-9]*[kKmMgG]?)$/.test(value)) {
    throw new TypeError(`unsafe Nginx body limit: ${value}`);
  }
}

function assertSafeUpstreamUrl(url: string): void {
  if (!/^https?:\/\/[A-Za-z0-9.\-_]+(:\d+)?(\/[^\s]*)?$/.test(url)) {
    throw new TypeError(`unsafe Nginx upstream URL: ${url}`);
  }
}

function assertSafeUpstreamHost(host: string): void {
  if (!/^[A-Za-z0-9.\-_]+(:\d+)?$/.test(host)) {
    throw new TypeError(`unsafe Nginx upstream host: ${host}`);
  }
}

function assertSafeSlug(slug: string): void {
  if (!/^[A-Za-z0-9-]+$/.test(slug)) {
    throw new TypeError(`unsafe slug for nginx upstream/location: ${slug}`);
  }
}
```

(If the existing nginx.ts already has different `assertSafeUpstreamUrl` etc. signatures, keep the existing ones as-is and only add the new helpers.)

- [ ] **Step 4: Run the nginx tests; expect PASS.**

```
pnpm -F @rntme/deploy-dokploy vitest run test/unit/nginx.test.ts
```

Expected: all tests pass, including the original ones (re-run untouched) and the 5 new auth tests.

- [ ] **Step 5: Run the full deploy-dokploy suite.**

```
pnpm -F @rntme/deploy-dokploy test
```

Expected: green.

- [ ] **Step 6: Commit.**

```bash
git add packages/deploy/deploy-dokploy/src/nginx.ts packages/deploy/deploy-dokploy/test/unit/nginx.test.ts
git commit -m "feat(deploy-dokploy): real auth_request enforcement in nginx render"
```

---

## Task 14: Render integration-module workload exposing port `:50052`

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/render.test.ts`

- [ ] **Step 1: Locate the integration-module branch in render.ts.**

```
grep -n "integration-module" packages/deploy/deploy-dokploy/src/render.ts | head
```

- [ ] **Step 2: Inspect the existing test that asserts on the rendered integration-module resource.**

```
grep -n "integration-module\|identity-auth0\|kind: 'integration-module'" packages/deploy/deploy-dokploy/test/unit/render.test.ts | head
```

- [ ] **Step 3: Add the failing test.**

In `render.test.ts`, append a test (or extend an existing identity-auth0 fixture test):

```ts
it('exposes ports 50051 and 50052 on integration-module workloads when edgeAuth is set', () => {
  const plan: ProjectDeploymentPlan = makePlanWithIdentityAuth0Module();
  const resources = renderDokployPlan(plan);
  const moduleRes = resources.find((r) => r.workloadKind === 'integration-module');
  expect(moduleRes).toBeDefined();
  // Adapt the assertion shape to whatever field carries port info on RenderedDokployResource;
  // if the renderer encodes ports through env, the assertion uses env.
  expect(moduleRes?.ports).toEqual(expect.arrayContaining([50051, 50052]));
});
```

(`makePlanWithIdentityAuth0Module` is whatever helper the existing test file uses; adapt to match. The assertion field name `ports` must match the actual `RenderedDokployResource` shape — confirm via `grep -n "ports\|expose" packages/deploy/deploy-dokploy/src/types.ts` or wherever `RenderedDokployResource` is defined.)

- [ ] **Step 4: Read the `RenderedDokployResource` shape if `ports` is not the field.**

If render's resource shape carries ports differently (e.g. through `applyResult.ports`, or implicitly through Dokploy Compose strings), confirm what assertion to use. The task is "the renderer must publish 50052 in addition to 50051 on integration-module workloads"; the test assertion is whatever surfaces that.

- [ ] **Step 5: Run the test; expect FAIL.**

```
pnpm -F @rntme/deploy-dokploy vitest run test/unit/render.test.ts
```

- [ ] **Step 6: Update `render.ts`.**

In the `if (workload.kind === 'integration-module')` branch, add a `ports` field (or whatever the resource shape uses) listing both 50051 and 50052. Find any current port-related field and extend it; if there is none, add:

```ts
return {
  logicalId: workload.slug,
  kind: 'application',
  workloadKind: workload.kind,
  workloadSlug: workload.slug,
  name,
  image: workload.image,
  env: [...],
  labels,
  ports: [50051, 50052], // new
};
```

(Field name `ports` here is illustrative; use whatever `RenderedDokployResource` actually exposes. If Dokploy resources do not have a "ports" field — Dokploy is a Docker Compose orchestrator; ports are part of the compose spec — adjust to add the ports there. The integration test for deploy-flow exercises the actual rendering path; ensure that path is satisfied.)

- [ ] **Step 7: Re-run the test; expect PASS.**

```
pnpm -F @rntme/deploy-dokploy vitest run test/unit/render.test.ts
```

- [ ] **Step 8: Run `pnpm -F @rntme/deploy-dokploy test` for the full suite.**

```
pnpm -F @rntme/deploy-dokploy test
```

Expected: green.

- [ ] **Step 9: Commit.**

```bash
git add packages/deploy/deploy-dokploy/src/render.ts packages/deploy/deploy-dokploy/test/unit/render.test.ts
git commit -m "feat(deploy-dokploy): integration-module workloads expose port 50052 for HTTP introspection"
```

---

## Task 15: CLI — positional folder for `project publish`

**Files:**
- Modify: `apps/cli/src/bin/cli.ts`
- Modify: `apps/cli/test/integration/commands.test.ts`

- [ ] **Step 1: Read the current dispatcher's `publish` block.**

```
grep -n -A20 "case 'publish'" apps/cli/src/bin/cli.ts
```

The block currently does only `setIfDefined(publishArgs, 'folder', asString(values['folder']));`. We will resolve folder from `positionals[2]` first, then `--folder`, with mutual exclusion.

- [ ] **Step 2: Add the failing tests.**

Open `apps/cli/test/integration/commands.test.ts`. Find or add a `describe('project publish folder resolution')` block:

```ts
describe('project publish folder resolution', () => {
  it('accepts a positional folder argument', async () => {
    const exit = await main([
      'project', 'publish', 'demo/notes-blueprint',
      '--dry-run', '--org', 'test', '--project', 'notes-demo', '--token', 'pat_x',
    ]);
    expect(exit).toBe(0); // dry-run does not need a real token; expects local validation to succeed
  });

  it('accepts --folder flag (back-compat)', async () => {
    const exit = await main([
      'project', 'publish',
      '--folder', 'demo/notes-blueprint',
      '--dry-run', '--org', 'test', '--project', 'notes-demo', '--token', 'pat_x',
    ]);
    expect(exit).toBe(0);
  });

  it('rejects positional + --folder together with CLI_CONFIG_INVALID', async () => {
    const stderr: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    try {
      const exit = await main([
        'project', 'publish', 'demo/notes-blueprint',
        '--folder', 'demo/notes-blueprint',
        '--dry-run', '--org', 'test', '--project', 'notes-demo', '--token', 'pat_x',
      ]);
      expect(exit).not.toBe(0);
      expect(stderr.join('')).toContain('cannot use positional and --folder together');
    } finally {
      process.stderr.write = origWrite;
    }
  });
});
```

(If `main` is not directly invocable from the test file, follow the existing test pattern in `commands.test.ts` — it already exercises subcommands.)

- [ ] **Step 3: Run the tests; expect FAIL.**

```
pnpm -F @rntme/cli vitest run test/integration/commands.test.ts
```

Expected: positional case fails or behaves like `--folder` is missing.

- [ ] **Step 4: Update the publish dispatcher.**

In `apps/cli/src/bin/cli.ts`, find:

```ts
case 'publish': {
  const publishArgs: Parameters<typeof runProjectPublish>[0] = {};
  setIfDefined(publishArgs, 'folder', asString(values['folder']));
  setIfDefined(publishArgs, 'createProject', asBool(values['create-project']));
  setIfDefined(publishArgs, 'dryRun', asBool(values['dry-run']));
  return runProjectPublish(publishArgs, commonFlags);
}
```

Replace with:

```ts
case 'publish': {
  const positional = positionals[2];
  const flagFolder = asString(values['folder']);
  if (positional !== undefined && flagFolder !== undefined) {
    process.stderr.write('CLI_CONFIG_INVALID: cannot use positional and --folder together\n');
    return 1;
  }
  const folder = positional ?? flagFolder;
  const publishArgs: Parameters<typeof runProjectPublish>[0] = {};
  setIfDefined(publishArgs, 'folder', folder);
  setIfDefined(publishArgs, 'createProject', asBool(values['create-project']));
  setIfDefined(publishArgs, 'dryRun', asBool(values['dry-run']));
  return runProjectPublish(publishArgs, commonFlags);
}
```

- [ ] **Step 5: Re-run the tests.**

```
pnpm -F @rntme/cli vitest run test/integration/commands.test.ts
```

Expected: PASS.

- [ ] **Step 6: Verify against the live demo blueprint.**

```
pnpm -F @rntme/cli build
node apps/cli/dist/bin/cli.js project publish demo/notes-blueprint --dry-run --org test --project notes-demo
```

Expected:
```
✓ project bundle validated
  digest: sha256:...
  size:   10134
```

- [ ] **Step 7: Commit.**

```bash
git add apps/cli/src/bin/cli.ts apps/cli/test/integration/commands.test.ts
git commit -m "feat(cli): rntme project publish accepts positional folder"
```

---

## Task 16: CLI README cleanup

**Files:**
- Modify: `apps/cli/README.md`

- [ ] **Step 1: Open the README.**

Locate the `## Quick Start` section and the command summary table.

- [ ] **Step 2: Update Quick Start step 4.**

Find:

```
### 4. Validate the blueprint

```bash
rntme project publish --dry-run --org my-org --project my-project .
```
```

The `.` was a misleading mix of positional and flag-style. Replace with:

```markdown
### 4. Validate the blueprint

```bash
rntme project publish --dry-run --org my-org --project my-project demo/notes-blueprint
```

You can also pass the folder via `--folder demo/notes-blueprint`. The two forms are mutually exclusive.
```

- [ ] **Step 3: Update Quick Start step 5.**

Find:

```
### 5. Publish

```bash
rntme project publish --org my-org --project my-project .
```
```

Replace with:

```markdown
### 5. Publish

```bash
rntme project publish --org my-org --project my-project demo/notes-blueprint
```
```

- [ ] **Step 4: Update the command summary block.**

Find the block that starts with `Usage: rntme [options] <command> [subcommand] [args...]`. Update the `project publish` line:

```
  project publish [dir]   Upload or dry-run a project blueprint
```

(Use `[dir]` to indicate optional positional. The rest of the help block is fine.)

- [ ] **Step 5: Delete the entire `deploy plan / deploy render dokploy / deploy apply dokploy` section.**

Find lines like:

```
  deploy plan             Produce a redacted project deployment plan
  deploy render dokploy   Render the plan for Dokploy
  deploy apply dokploy    Apply the rendered Dokploy plan
```

Delete them.

- [ ] **Step 6: Add a single replacement note.**

After the command summary block, add:

```markdown
> **Deploy operations** (planning, rendering, applying) are server-side on the platform control plane. Trigger them via the platform UI or by `POST` to `/v1/orgs/<org>/projects/<project>/deployments` on `https://platform.rntme.com`. The CLI does not bundle deploy commands.
```

- [ ] **Step 7: Verify the README renders cleanly.**

Just open the file and skim the top 200 lines for stale references to the deleted commands. Search:

```
grep -n "deploy plan\|deploy render\|deploy apply" apps/cli/README.md
```

Expected: no matches (except possibly the removal note above, if you reused those words — make sure the wording does not contradict the removal).

- [ ] **Step 8: Commit.**

```bash
git add apps/cli/README.md
git commit -m "docs(cli): remove phantom deploy commands; document positional publish folder"
```

---

## Task 17: Identity-auth0 module README — document two transports

**Files:**
- Modify: `modules/identity/auth0/README.md`

- [ ] **Step 1: Open the file.**

- [ ] **Step 2: Append a new section before any existing "Limitations" section.**

```markdown
## Two transports: gRPC + HTTP introspection

The container exposes two ports:

| Port | Transport | Caller | Endpoint |
|---:|---|---|---|
| 50051 | gRPC | runtime pre-step `module-rpc IntrospectSession` | `IdentityModule/IntrospectSession` |
| 50052 | HTTP | edge nginx via `auth_request` | `GET /introspect` |

Both transports share the in-process `IntrospectSession` handler — there is no duplicated validation logic. The HTTP transport exists so edge can reject unauthenticated requests at nginx without involving the runtime, while runtime continues to call gRPC for the canonical `Session` shape.

Required env:

| Var | Default | Note |
|---|---|---|
| `PORT` (or `GRPC_PORT`) | `50051` | gRPC listener port. |
| `HTTP_PORT` | `50052` | HTTP introspection port. Must match `module.json#capabilities.edgeAuth.port`. |
| `AUTH0_DOMAIN` or `AUTH0_ISSUER` | — required | JWKS issuer; `IntrospectSession` derives `https://<AUTH0_DOMAIN>/.well-known/jwks.json`. |
```

- [ ] **Step 3: Commit.**

```bash
git add modules/identity/auth0/README.md
git commit -m "docs(identity-auth0): document gRPC + HTTP introspection transports"
```

---

## Task 18: deploy-core README — update edge auth section

**Files:**
- Modify: `packages/deploy/deploy-core/README.md`

- [ ] **Step 1: Open the file and find the existing edge auth section.**

```
grep -n "kind.*auth\|edge\|auth0\|moduleSlug" packages/deploy/deploy-core/README.md | head
```

- [ ] **Step 2: Replace or extend the auth section with:**

```markdown
### Edge auth

`mounts: [...].use: ["auth"]` declares an `auth` middleware. Planning enforces:

- The middleware decl provides `provider`, `audience`, `moduleSlug`.
- An integration-module workload exists for `moduleSlug`.
- The module's `module.json#capabilities.edgeAuth` is present and describes an HTTP introspection endpoint (today only `kind: "introspection-sidecar"` is supported).
- For Auth0 modules, `AUTH0_DOMAIN` env is set on the workload.

If any of the above is missing, planning fails with one of:

- `DEPLOY_PLAN_AUTH_MIDDLEWARE_INCOMPLETE` — provider/audience/moduleSlug missing.
- `DEPLOY_PLAN_AUTH_MODULE_WORKLOAD_MISSING` — no integration-module workload for `moduleSlug`.
- `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING` — module does not declare `capabilities.edgeAuth`.
- `DEPLOY_PLAN_AUTH_MODULE_ENV_INCOMPLETE` — Auth0 module missing `AUTH0_DOMAIN`.

The planned auth middleware carries `moduleIntrospectPort` (from `capabilities.edgeAuth.port`) for the renderer to wire `auth_request` into the right port.
```

- [ ] **Step 3: Commit.**

```bash
git add packages/deploy/deploy-core/README.md
git commit -m "docs(deploy-core): document DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING + moduleIntrospectPort"
```

---

## Task 19: deploy-dokploy README — describe new auth render

**Files:**
- Modify: `packages/deploy/deploy-dokploy/README.md`

- [ ] **Step 1: Open the file and find the existing edge auth section.**

- [ ] **Step 2: Replace the section with:**

```markdown
### Edge auth rendering

For each `kind: "auth"` middleware in the plan, the renderer emits:

1. An `upstream rntme_auth_<slug>__<audHash>` block pointing at `<module-resource>:<introspectPort>`. The audience hash (`first 8 hex chars of sha256(audience)`) lets a future project mount the same module image with different audiences without colliding.
2. An internal `location = /_rntme_auth_<slug>__<audHash>` that forwards the `Authorization` header and a literal `X-Rntme-Audience` header to the module HTTP introspection endpoint. The location strips the request body (`proxy_pass_request_body off`) — auth_request never forwards body.
3. On every route mounted with `kind: "auth"`: an `auth_request` directive, two `auth_request_set` lines capturing `X-Rntme-User-Sub` / `X-Rntme-User-Audience` from the introspection response, and an `error_page 401 = @rntme_auth_401_<slug>__<audHash>` so the 401 body is canonical JSON regardless of upstream.
4. A named `location @rntme_auth_401_<slug>__<audHash>` returning `401 application/json` with body `{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}`.

Edge does not validate JWTs. The module HTTP endpoint does (Auth0: JWKS verification; WorkOS: API call; Clerk: API call). Provider-swap is therefore purely an image change.
```

- [ ] **Step 3: Commit.**

```bash
git add packages/deploy/deploy-dokploy/README.md
git commit -m "docs(deploy-dokploy): describe auth_request rendering shape"
```

---

## Task 20: AGENTS.md — note both transports for identity modules

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Search for an identity-module / how-to section.**

```
grep -n "identity\|IntrospectSession\|module pattern\|how to add" AGENTS.md | head
```

- [ ] **Step 2: Add or extend the section.**

If a relevant section exists (e.g. "How to add a new identity provider"), append:

```markdown
**Two transports.** Identity modules consumed by `kind: "auth"` middleware MUST expose IntrospectSession via two transports: gRPC (for runtime pre-step calls) and HTTP `GET /introspect` (for edge `auth_request`). Both wrap the same in-process handler. The module declares its HTTP port via `module.json#capabilities.edgeAuth.port`. See `packages/contracts/identity/v1/README.md#http-introspection-transport`.
```

If no such section exists, add a short subsection under §6 ("How to do X") titled "Add a new identity provider" with the body above.

- [ ] **Step 3: Commit.**

```bash
git add AGENTS.md
git commit -m "docs(agents): identity modules must expose gRPC + HTTP IntrospectSession"
```

---

## Task 21: Update notes-demo recovery plan acceptance probes

**Files:**
- Modify: `docs/superpowers/plans/2026-05-01-notes-demo-recovery.md`

- [ ] **Step 1: Open the file and find Task 12 Step 1 (HTTP probes).**

The block currently has `for path in /health / /api`.

- [ ] **Step 2: Add two new probes after the existing ones.**

Append to Step 1's bash block:

```bash
echo "=== /_layouts/main.json (auth gating) ===" >> /tmp/notes-demo-acceptance.txt
curl -sS https://notes-demo.rntme.com/_layouts/main.json -m 15 \
  | python3 -c "import sys,json; d=json.load(sys.stdin); els=d['spec']['elements']; assert 'anonRoot' in els and els['anonRoot']['type']=='LoginScreen', f'anonRoot/LoginScreen missing: {list(els.keys())}'; print('OK: LoginScreen present')" \
  >> /tmp/notes-demo-acceptance.txt 2>&1

echo "=== /assets/main.js (auth0 bundle) ===" >> /tmp/notes-demo-acceptance.txt
HITS=$(curl -sS https://notes-demo.rntme.com/assets/main.js -m 30 | grep -c "auth0")
test "$HITS" -gt 0 && echo "OK: auth0-spa-js bundled ($HITS hits)" >> /tmp/notes-demo-acceptance.txt \
  || echo "FAIL: auth0 not bundled" >> /tmp/notes-demo-acceptance.txt
```

The first probe asserts the rendered layout includes the `LoginScreen` node (proves post-RNT-388 render). The second asserts the SPA bundle includes auth0 SDK code (proves the virtualEntrySource was bundled, not the no-auth-entry fallback).

Also update Step 1's "Expected" sentence to read:

```
Expected: `/health` → `200`; `/` → `200` `text/html`; `/api` → `200` or `401` (both prove the upstream is up; with the new edge auth render, an unauthenticated `/api` call returns `401` with `{"code":"RUNTIME_AUTH_TOKEN_INVALID"}`); the layout probe prints `OK: LoginScreen present`; the bundle probe prints `OK: auth0-spa-js bundled`. Append all output to the runbook under `## Step 12 — acceptance probes`.
```

- [ ] **Step 3: Commit.**

```bash
git add docs/superpowers/plans/2026-05-01-notes-demo-recovery.md
git commit -m "docs(plan): add LoginScreen + auth0-bundle probes to notes-demo recovery"
```

---

## Task 22: End-to-end sanity — full build and test

**Files:** none (final verification)

- [ ] **Step 1: Full build.**

```
pnpm -r run build
```

Expected: every package builds.

- [ ] **Step 2: Full test.**

```
pnpm -r run test
```

Expected: green. If a package fails, fix in the same task (do not commit a broken merge); the most likely culprits are downstream packages destructuring `CatalogManifest` or `ComposedProjectInput` without the new fields.

- [ ] **Step 3: Lint.**

```
pnpm -r run lint
```

Expected: clean.

- [ ] **Step 4: Manual reproduction of the original bug.**

If you have access to a fresh deployment of the new render (this requires running the existing recovery plan to actually deploy `notes-demo` with the new images, which is a separate operational task), curl the API:

```
curl -i https://notes-demo.rntme.com/api/notes -m 15
```

Expected: `HTTP/2 401`, `content-type: application/json`, body `{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}`. **Not** the `BINDINGS_RUNTIME_EXPRESSION_ERROR` 500 we started with.

If the deployment is still on the old render, this step is "after the next recovery deploy" — out of scope for this PR.

- [ ] **Step 5: Open PR.**

```
git push -u origin HEAD
gh pr create --title "feat: edge auth via identity-module HTTP introspection" --body "$(cat <<'EOF'
## Summary

- Replaces the comment-only `kind: "auth"` nginx middleware with real `auth_request` enforcement.
- Identity modules expose IntrospectSession over both gRPC (existing) and HTTP `GET /introspect` (new). Both wrap the same handler.
- Provider swap is achieved by changing the identity-module image; nginx render is parameterized by moduleSlug/audience/port only.
- CLI `project publish` now accepts the folder as a positional argument; phantom `deploy plan/render/apply` README sections removed.
- Notes-demo recovery acceptance probes extended to verify the post-RNT-388 layout + auth0 SDK in the SPA bundle.

Closes the runtime-side `BINDINGS_RUNTIME_EXPRESSION_ERROR` symptom on `notes-demo.rntme.com` once the next deploy lands.

## Test plan

- [x] `pnpm -r run build`
- [x] `pnpm -r run test`
- [x] `pnpm -r run lint`
- [x] `node apps/cli/dist/bin/cli.js project publish demo/notes-blueprint --dry-run --org test --project notes-demo` returns OK with positional folder.
- [x] HTTP introspection conformance suite passes against identity-auth0 (mock JWKS).
- [x] nginx render for an auth-mounted route contains `auth_request` + named-location 401 page.
- [ ] Post-deploy: `curl -i https://notes-demo.rntme.com/api/notes` returns 401 (after the recovery plan applies the new render).

Spec: `docs/superpowers/specs/2026-05-01-edge-auth-introspection-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**1. Spec coverage:**
- §3.2 Contract — Tasks 1, 2 (error codes + README).
- §3.3 identity-auth0 HTTP server — Tasks 6, 7, 8.
- §3.4 deploy-core EdgeMiddleware extension + validation — Task 11.
- §3.5 module.json schema — Task 3, 4.
- §3.6 nginx render — Task 13.
- §3.7 CLI cleanup — Tasks 15, 16.
- §3.8 recovery acceptance — Task 21.
- §3 catalog plumbing (`moduleEdgeAuth`, executor pass-through) — Tasks 5, 12.
- §3 integration-module workload exposing port — Task 14.
- §3 conformance suite — Tasks 9, 10.
- §7 doc touches — Tasks 2, 16, 17, 18, 19, 20, 21.
- Final verification — Task 22.

**2. Placeholder scan:** No "TBD"/"TODO"/"implement later". Code blocks accompany every implementation step. The two places with adapt-to-actual-shape language (Task 5 step 2 fixture shape, Task 14 ports field name) make the test the contract: the test fails until the implementation matches, so the engineer has clear feedback even if the surrounding signature surprises them.

**3. Type / signature consistency:**
- `EdgeAuthDescriptor` defined in Task 3, consumed in Tasks 5, 11, 12.
- `moduleIntrospectPort` introduced in Task 11, consumed in Task 13 nginx render.
- `moduleEdgeAuth` field on `CatalogManifest` introduced in Task 5, consumed in Task 12 executor.
- `createIdentityAuth0HttpApp` / `createIdentityAuth0HttpServer` named consistently in Tasks 6, 7, 10.
- `IDENTITY_HTTP_TOKEN_MISSING` / `IDENTITY_HTTP_AUDIENCE_MISSING` codes are spelled identically across tasks.
- nginx location names use `<slug>__<audHash>` keying consistently across Task 13 helpers and tests.

**4. Honest about unknown:**
- Task 5 Step 2 says "adjust the call shape to match the actual `buildCatalogManifest` signature once verified in Step 1" — the engineer must inspect the function before writing the test. This is correct behaviour for a test-first task.
- Task 12 Step 5 says "the test from Step 2 will fail until the mapping is right — use the test as the contract" — the cross-package mapping (service slug → module package) is one of two existing patterns; the engineer reads the existing compose code in `packages/artifacts/blueprint/src/compose/modules.ts` to determine which.
- Task 14 Step 4 says "if `ports` is not the field, confirm what assertion to use" — `RenderedDokployResource` shape is known but its port-conveyance mechanism (env vs. compose `ports` array vs. label) needs one quick lookup.

These three are honest unknowns that disappear once the engineer reads two files; not placeholders.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-01-edge-auth-introspection.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
