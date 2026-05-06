# Edge auth via identity-module HTTP introspection — design

**Status:** brainstorming approved 2026-05-01, awaiting user review of this spec.
**Status update (2026-05-06):** The incident notes below describe the old deployed `pre[]`/`$pre` path. New work must not reintroduce binding-level pre-steps; runtime introspection needed by graph behavior belongs in Graph IR `call` nodes per `docs/superpowers/specs/2026-05-06-graph-ir-effect-operations-design.md`.
**Author:** brainstorm 2026-05-01.
**Related:**
- `docs/superpowers/specs/done/2026-04-29-notes-demo-auth0-design.md` — landed Auth0 OIDC introspection over gRPC + edge `kind: "auth"` middleware declaration (RNT-364).
- `docs/superpowers/specs/2026-04-30-notes-demo-auth0-migration-design.md` — UI-side auth gating via module `client.boot` (RNT-388).
- `docs/superpowers/plans/2026-05-01-notes-demo-recovery.md` — operational recovery (the deployed bundle is still pre-RNT-388; this spec adds an acceptance step there).
- `packages/contracts/identity/v1/proto/identity.proto` — canonical Identity contract (`IntrospectSession` RPC).

## 1. Problem

Anonymous requests to deployed apps with project-level `auth` middleware crash the runtime instead of being rejected at the edge. Reproduced 2026-05-01 against `https://notes-demo.rntme.com`:

```
$ curl -X POST https://notes-demo.rntme.com/api/notes \
    -H 'content-type: application/json' \
    -d '{"id":"x","title":"y","body":"z"}'
HTTP 500
{"code":"BINDINGS_RUNTIME_EXPRESSION_ERROR",
 "message":"unknown path in reference \"$header.authorization\" at segment \"header.authorization\""}
```

Cause chain:

1. `services/app/bindings/bindings.json` declares `pre[].input.token = "$header.authorization"` for every binding.
2. `packages/deploy/deploy-dokploy/src/nginx.ts:80-83` renders `kind: "auth"` middleware as **two comment lines only**:
   ```
   # auth middleware: provider=auth0, audience=...
   # - delegated to runtime via identity module RPC; edge does not validate JWT
   ```
   No directive ever rejects a request based on missing or invalid `Authorization`.
3. The request reaches runtime.  `bindings-http/src/runtime/handler.ts:65` builds `headerValues` from `c.req.raw.headers.entries()`. Without an `Authorization` header, `headerValues` has no `authorization` key.
4. `bindings-http/src/pre/expression.ts:52` does `Object.prototype.hasOwnProperty.call(scope.header, 'authorization')` → false → throws `unknown path in reference "$header.authorization" at segment "header.authorization"`.
5. `run-pre-steps.ts:43-49` catches the throw and returns `httpStatus: 500`, `code: BINDINGS_RUNTIME_EXPRESSION_ERROR`.

A 500 for "no token sent" is a contract violation: missing-credential is a 401-class error; runtime "expression" errors are 500-class. The middleware was *declared* to enforce auth at the edge but in practice enforces nothing.

Secondarily: `apps/cli/README.md` documents (a) a positional `[dir]` argument for `rntme project publish` while the dispatcher (`apps/cli/src/bin/cli.ts:222-227`) only accepts `--folder <dir>`, and (b) three commands `deploy plan`, `deploy render dokploy`, `deploy apply dokploy` that have no implementation. Verified by `node apps/cli/dist/bin/cli.js --help` and by absence of a `commands/deploy/` directory.

## 2. Goal

A production-grade, provider-agnostic edge auth enforcement seam for projects that mount `kind: "auth"` middleware:

1. Requests without a valid session token are rejected at the edge with a `401` JSON response. The runtime container is never invoked. This eliminates the `BINDINGS_RUNTIME_EXPRESSION_ERROR` symptom by removing the reachability path that produces it.
2. Validation logic is owned by the identity module (Auth0 today, WorkOS / Clerk next). Swapping providers in `project.json#middleware.auth.provider` swaps the workload image whose HTTP endpoint nginx queries. **deploy-dokploy renders the same nginx pattern regardless of provider** — extensibility is purely an identity-module concern.
3. The runtime continues to call `IntrospectSession` in its pre-step (defence in depth + canonical `Session` shape needed for `$pre.session.sub` → `ownerSub` graph inputs). Unchanged.
4. Phase-2-friendly: a future spec can add edge-side response caching (`proxy_cache` keyed on token hash, 30s TTL) and replace the runtime pre-step with header reads. Not in this spec.

Secondarily (Part A):
5. CLI README accurately reflects shipped commands. `rntme project publish` accepts both positional and `--folder`. Defunct `deploy plan/render/apply` documentation is removed.

## 3. Approach

### 3.1 Architecture

```
                       ┌─────────────────────────────────────┐
                       │ identity-<provider> container        │
                       │ (e.g. identity-auth0)                │
                       │                                      │
                       │  :50051  gRPC IdentityModule         │
                       │          (existing — runtime calls)  │
                       │  :50052  HTTP introspection          │
                       │          (new — edge calls)          │
                       │                                      │
                       │  shared handler: introspectSession() │
                       └──────────────────────────────────────┘
                                  ▲                  ▲
                                  │ gRPC             │ HTTP
                                  │ (pre-step,       │ (auth_request
                                  │  in-cluster)     │  sub-request)
                                  │                  │
   ┌───────────┐                  │                  │
   │  client   │ Authorization:   │                  │
   │  (browser)│   Bearer ...     │                  │
   │           │ ─────────────────┼──────────────────┼────────►  edge nginx (Dokploy)
   └───────────┘                  │                  │           │
                                  │                  │           │  for routes mounted with
                                  │                  │           │  kind: "auth":
                                  │                  │           │
                                  │                  └───────── auth_request /_rntme_auth_<slug>
                                  │                              │
                                  │              200 +           │
                                  │              X-Rntme-User-*  │
                                  │             ─────────────►   │
                                  │                              ▼
                                  └──────────────── proxy_pass ─►  app:3000 (runtime)
                                                                    runs pre-step IntrospectSession
                                                                    (gRPC) over the same module
```

**Key invariants:**

- **One process, two transports.** The identity-auth0 container exposes both `:50051` (gRPC) and `:50052` (HTTP). They wrap the same `introspectSession()` handler — provider-specific validation logic exists in exactly one place.
- **Provider swap = image swap.** nginx render is parameterized by `moduleSlug` (already present in `EdgeMiddleware<auth>`). Swapping `provider: "auth0"` → `provider: "workos"` in the blueprint changes the configured workload image; nginx config is identical in shape.
- **Edge sets headers; runtime trusts them as advisory only.** Edge sets `X-Rntme-User-Sub`, `X-Rntme-User-Audience`, `X-Rntme-Session-Status` from the introspection result. Runtime continues calling `IntrospectSession` itself — defence in depth, plus runtime needs the full canonical `Session` (email, vendor_raw, etc.) which is too large for headers.
- **Internal-only auth location.** The `_rntme_auth_<slug>` location is `internal;` so it cannot be hit directly from the public network.

### 3.2 Contract addition — HTTP introspection

`@rntme/contracts-identity-v1` is augmented with a documented HTTP transport for `IntrospectSession`. The proto file is **not** changed (gRPC stays the canonical contract); we add a sibling `README.md` section "HTTP introspection transport" that pins:

- **Method + path:** `GET /introspect`. (`POST` is not used — the only input is the `Authorization` header. `auth_request` always issues `GET` to its sub-request.)
- **Request:**
  - `Authorization: Bearer <token>` — required. Missing or malformed → `401`.
  - `X-Rntme-Audience: <audience-string>` — required. Comes from `auth_request_set` of the parent location (which knows the audience from the middleware declaration). Empty → `401`.
- **Success response (`200`):** body empty. Headers:
  - `X-Rntme-User-Sub: <sub>` — required.
  - `X-Rntme-User-Audience: <audience>` — echo of what was checked.
  - `X-Rntme-Session-Status: ACTIVE` — fixed value on success path.
- **Failure response (`401`):** body `{"code":"<CODE>","message":"<msg>"}` — content-type `application/json`. `<CODE>` is one of the existing `IDENTITY_*` error codes from `@rntme/contracts-identity-v1/error-codes` plus a new `IDENTITY_HTTP_TOKEN_MISSING` for the no-Authorization case.
- **Headers ASCII-only.** `sub` is provider-issued and ASCII-safe by Auth0/WorkOS/Clerk specs (Auth0: `<connection>|<userId>` or `auth0|<id>`). `email`, `name`, etc. are not in headers — runtime continues to fetch them through the gRPC path.
- **No request body.** `auth_request` does not forward body; introspection MUST work from headers only.

A new HTTP-transport conformance test is added to `@rntme/conformance-identity` (the package already houses canonical contract conformance suites). Modules call it from their integration tests.

### 3.3 Identity module update — `@rntme/identity-auth0`

`modules/identity/auth0/src/bin/server.ts` boots both servers in parallel:

```ts
const grpcPort = readPortEnv('PORT', 'GRPC_PORT', 50051);
const httpPort = readPortEnv('HTTP_PORT', null, 50052);

const adapter = createAuth0Adapter();
const module = createAuth0IdentityModule(adapter);

const grpc = createIdentityAuth0GrpcServer({ module, port: grpcPort, host: '0.0.0.0' });
const http = createIdentityAuth0HttpServer({ module, port: httpPort, host: '0.0.0.0' });

await Promise.all([grpc.listen(), http.listen()]);
```

The new `createIdentityAuth0HttpServer` lives at `modules/identity/auth0/src/http-server.ts`:

- Hono app with one route: `GET /introspect`.
- Reads `Authorization` and `X-Rntme-Audience`.
- Calls `module.IntrospectSession({ token, audience })` — the **same handler** as the gRPC path.
- Maps the `Session` result: `status === SESSION_STATUS_ACTIVE` → `200` with sub/audience/status headers; anything else → `401` with code derived from `vendor_raw.deactivation_reason` if present, else `IDENTITY_VENDOR_INVALID_TOKEN`.

Why Hono: already a workspace dep (`packages/runtime/bindings-http`), no new transitive deps for the identity-auth0 package.

`modules/identity/auth0/Dockerfile` exposes both ports:
```dockerfile
ENV NODE_ENV=production \
    PORT=50051 \
    HTTP_PORT=50052
EXPOSE 50051 50052
```

### 3.4 deploy-core update — `EdgePlan` carries module HTTP port

`packages/deploy/deploy-core/src/edge.ts` AuthMiddleware planned shape gains one field:

```ts
{
  mountTarget, name, kind: 'auth',
  provider, audience, moduleSlug,
  moduleIntrospectPort: 50052,  // NEW: planned port for HTTP introspection
  policy?, config?
}
```

Default port is `50052`. The integration-module workload spec (`plan.ts`) gains an optional `introspectionHttpPort?: number` field on integration-module config; when present it overrides the default in the auth-middleware plan output. (We do not want a hard-coded port to be a footgun if a future module collides on 50052.)

A new compose-time validation in deploy-core: if a `kind: "auth"` middleware references a `moduleSlug` whose integration-module workload **does not declare HTTP introspection support** (a new module.json field — see §3.5), planning fails with `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING`. This is the gate that makes Phase-1 safe to ship before workos/clerk add the HTTP transport: a blueprint that names `provider: "workos"` and tries to deploy will get a clear error instead of silently producing a broken nginx config.

### 3.5 module.json schema addition

Identity modules' `module.json` gains a `capabilities.edgeAuth` field:

```json
{
  "name": "@rntme/identity-auth0",
  "category": "identity",
  ...
  "capabilities": {
    "rpcs": [...],
    "events": [...],
    "edgeAuth": {
      "kind": "introspection-sidecar",
      "transport": "http",
      "method": "GET",
      "path": "/introspect",
      "port": 50052
    }
  }
}
```

`kind: "introspection-sidecar"` is the only value for now. Future kinds (e.g. `"native-jwt-validation"` for nginx-lua + JWKS) extend the union without breaking Phase-1 modules.

The blueprint composer (`@rntme/blueprint`) reads this field when validating modules at compose time. deploy-core's auth-middleware planner reads it through `ComposedProjectInput.modules[<slug>].edgeAuth` (small extension to the existing module manifest pass-through; details under §4 file diffs). Modules without `edgeAuth` are valid for everything except being targeted by `kind: "auth"` middleware.

### 3.6 deploy-dokploy update — nginx render

`packages/deploy/deploy-dokploy/src/nginx.ts` is reworked. The current per-`location` rendering of comments becomes:

**Keying:** locations and upstreams are keyed by a stable identifier `<slug>__<audHash>`, where `<slug>` is `moduleSlug` (alphanumerics + hyphens) and `<audHash>` is the first 8 hex chars of `sha256(audience)`. This lets a future project mount the same identity module twice with different audiences (e.g. tenant-A and tenant-B both using Auth0) without collisions. Notes-demo today renders one such pair.

1. **Before the `server { ... }` block**, one upstream per distinct `(moduleSlug, audience)`:

   ```nginx
   upstream rntme_auth_<slug>__<audHash> {
     server <module-resource-name>:<port>;
   }
   ```

2. **Inside `server { listen 8080; ... }`**, before the route `location` blocks, one internal location per distinct pair:

   ```nginx
   location = /_rntme_auth_<slug>__<audHash> {
     internal;
     proxy_pass         http://rntme_auth_<slug>__<audHash>/introspect;
     proxy_pass_request_body off;
     proxy_set_header   content-length     "";
     proxy_set_header   Authorization      $http_authorization;
     proxy_set_header   X-Rntme-Audience   "<audience>";
     proxy_intercept_errors on;
   }
   ```

3. **In each route `location` mounted with `kind: "auth"`**, emit:

   ```nginx
   auth_request          /_rntme_auth_<slug>__<audHash>;
   auth_request_set      $rntme_user_sub      $upstream_http_x_rntme_user_sub;
   auth_request_set      $rntme_user_audience $upstream_http_x_rntme_user_audience;
   error_page 401        = @rntme_auth_401_<slug>__<audHash>;
   proxy_set_header      X-Rntme-User-Sub      $rntme_user_sub;
   proxy_set_header      X-Rntme-User-Audience $rntme_user_audience;
   proxy_set_header      Authorization         $http_authorization;
   ```

4. **One named location per pair** for the 401 error page (so the JSON body is consistent and independent of upstream behaviour):

   ```nginx
   location @rntme_auth_401_<slug>__<audHash> {
     default_type application/json;
     return 401 '{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}';
   }
   ```

The current comment lines stay (informational, helpful for ops grepping the rendered config) but are appended to the same auth block.

`assertSafeUpstreamUrl`, `assertSafeHeaderName`, etc. — the existing safety checks — are reused for the new directive renderers; one new check `assertSafeSlug` validates `moduleSlug` (alphanumerics + hyphens only) since it is used to build location/upstream names.

### 3.7 CLI cleanup (Part A)

Three small changes to `apps/cli`:

1. `apps/cli/src/bin/cli.ts` — `parseArgs({ allowPositionals: true, ... })`. The `publish` subcommand resolves folder as: `positionals[2]` if set, else `--folder` flag, else `.`. If both positional and flag are given, exit with `CLI_CONFIG_INVALID: cannot use positional and --folder together`.
2. `apps/cli/src/commands/project/publish.ts` — no change to the command itself; the dispatcher handles the precedence.
3. `apps/cli/README.md` — update `Quick Start` and the command summary to show `rntme project publish .` (positional). Delete the entire `deploy plan / deploy render dokploy / deploy apply dokploy` section. Add a short note that deploy operations are server-side via the platform-http control plane (or via the platform UI).

### 3.8 Notes-demo recovery acceptance — one new step

`docs/superpowers/plans/2026-05-01-notes-demo-recovery.md` § Task 12 grows two probes:

```bash
curl -sS https://notes-demo.rntme.com/_layouts/main.json | jq -e '.spec.elements | has("anonRoot")'  # must be true
curl -sS https://notes-demo.rntme.com/assets/main.js | grep -c "auth0-spa-js"                       # must be > 0
```

These prove the deployed render is post-RNT-388 and the SPA bundle includes the auth0 module's `boot()`. The recovery plan is otherwise unchanged.

## 4. Scope

### 4.1 In scope

- Contract: HTTP introspection transport documented in `@rntme/contracts-identity-v1` README + `IDENTITY_HTTP_TOKEN_MISSING` error code.
- module.json schema: `capabilities.edgeAuth` field, `introspection-sidecar` kind only.
- `@rntme/identity-auth0`: new HTTP server (`http-server.ts`), `bin/server.ts` boots both transports, Dockerfile exposes both ports.
- deploy-core: `EdgeMiddleware.auth` plan output gains `moduleIntrospectPort`. Compose-time validation `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING`.
- deploy-dokploy: nginx render emits real `auth_request` enforcement; render uses module's `edgeAuth` config and audience from middleware decl.
- Conformance: HTTP introspection suite in `@rntme/conformance-identity` exercising auth0 (mock JWKS) end-to-end.
- CLI: positional folder for `project publish`, README cleanup, deletion of phantom deploy commands.
- Recovery plan acceptance probes.

### 4.2 Out of scope

- Edge-side response caching (`proxy_cache`). Phase 2.
- Replacing runtime pre-step `IntrospectSession` with header-only reads. Phase 2 (changes runtime contract — needs its own spec).
- WorkOS / Clerk HTTP introspection implementations. Each is a separate module-only PR after this spec lands; the Phase-1 gate (§3.4) ensures blueprints cannot ship `provider: "workos"` until that PR exists.
- Native JWT validation in nginx (`lua-resty-jwt` or `auth_jwt` from nginx-plus). Future Phase 3.
- UI login button. Closed by the existing `2026-05-01-notes-demo-recovery.md`; this spec only adds two probes to its acceptance.
- Cross-origin / CORS handling on the auth response. Edge already sets CORS via earlier middleware; auth_request runs server-internally, so no extra CORS work.

## 5. Failure modes and how each is handled

| Scenario | What happens today | What happens after this spec |
| --- | --- | --- |
| Request without `Authorization` | runtime 500 (BINDINGS_RUNTIME_EXPRESSION_ERROR) | edge 401 (RUNTIME_AUTH_TOKEN_INVALID), runtime not invoked |
| Request with malformed Bearer ("Bearer ") | runtime 500 same code | edge 401 |
| Request with bogus JWT | runtime calls IntrospectSession, gets inactive, returns 401 | edge calls module HTTP, gets 401, shortcircuits — runtime never invoked |
| Request with expired JWT | runtime returns 401 | edge returns 401 |
| Request with valid JWT | runtime authenticates, processes | edge introspects (200), forwards with `X-Rntme-User-Sub` headers; runtime independently re-introspects via gRPC pre-step (defence in depth) and processes |
| Identity module HTTP server down | n/a (today edge does not depend on it) | nginx `auth_request` returns 502; edge surfaces 500 to client. Mitigation: identity module health-check; module is a managed Dokploy workload with restart policy. Acceptable tradeoff for real enforcement. |
| Identity module image without `capabilities.edgeAuth` | n/a — silently allowed | deploy planning fails with `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING` before any apply |
| Provider switched (Auth0→WorkOS) without WorkOS HTTP impl | undeployable today (also missing) | undeployable, with the same explicit error code |

## 6. Risks and reversibility

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Module HTTP server adds latency to every request | medium | 5-50ms p50 added per request | Phase-2 caching reduces this to <1ms for cache-hit cases. Acceptable for Phase 1; current design has zero edge auth so the comparison is "0ms with bug" vs. "introspection latency without bug". |
| nginx `if` directives are forbidden inside `location` per nginx-best-practice | n/a | n/a | We do not use `if`. `auth_request` + `error_page` is the recommended pattern. |
| Response body in `auth_request` sub-request is dropped (nginx behavior) | n/a | n/a | Module returns body only on 401. nginx `auth_request` *does* drop the body; we set `error_page 401 = @rntme_auth_401_<slug>` to substitute a known JSON body in the parent response. |
| Module needs `audience` per route, but route only knows `moduleSlug` | low | nginx misroutes between two different audiences | Locations and upstreams are keyed by `<slug>__<audHash>` (§3.6 keying). Notes-demo has one pair; multi-tenant projects can reuse the same module image with distinct audiences without collisions. |
| Header injection via `Authorization` value | low | Token leak / bypass | nginx escapes header values into `proxy_set_header` directives; we add `assertSafeUpstreamUrl` and `assertSafeSlug` checks; runtime never trusts `X-Rntme-User-*` headers as authoritative — it does its own pre-step IntrospectSession (defence in depth). |
| Two transports = two places to keep in sync when contract changes | medium | Drift between gRPC `IntrospectSession` and HTTP introspection responses | Both transports invoke the same `module.IntrospectSession()` handler; contract conformance suite covers both transports. Drift is mechanically prevented. |

Reversibility: every change is a config/render addition; reverting is `git revert` of two PRs (identity-auth0 module + deploy-dokploy nginx render). Image tags are content-addressed so old images keep working with a deploy target that still uses the old render.

## 7. Documentation touches (per CLAUDE.md mandate)

- `apps/cli/README.md` — A1 + A3.
- `packages/contracts/identity/v1/README.md` — new `## HTTP introspection transport` section.
- `packages/contracts/identity/v1/src/error-codes.ts` — `IDENTITY_HTTP_TOKEN_MISSING` constant + JSDoc.
- `modules/identity/auth0/README.md` — add `## Two transports: gRPC + HTTP introspection` section, document ports + envs.
- `packages/deploy/deploy-core/README.md` — `## Edge auth planning` updated: gain `moduleIntrospectPort`, gain `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING`.
- `packages/deploy/deploy-dokploy/README.md` — `## Edge auth rendering` updated: describe the new `auth_request` shape and `_rntme_auth_<slug>` internal location.
- `docs/superpowers/plans/2026-05-01-notes-demo-recovery.md` — Task 12 acceptance probes.
- `AGENTS.md` § "Identity contract & module pattern" (if present, otherwise § "How to add a new identity provider") — one paragraph noting both transports must be supported.
- `CLAUDE.md` § "Architecture in one paragraph" — no change. Edge auth architecture is internal to the deploy / module layer; the architectural one-liner does not name nginx or transports.
- `vision.md` — no change.

## 8. Why this shape

Three principles drove the design:

1. **One handler, two transports.** Provider validation is the part that varies; gRPC vs. HTTP is just a wire format. Forcing both transports to call the same in-process handler eliminates an entire class of drift bugs and lets the conformance suite cover both with one canonical test corpus.
2. **deploy-dokploy stays provider-agnostic.** The render code knows nothing about Auth0 / WorkOS / Clerk; it only knows `moduleSlug`, `audience`, `port`. Adding a new identity provider is a module-only change. This is the production-grade extensibility the user asked for.
3. **Defence in depth at runtime.** Edge enforcement is real but headers are advisory at the runtime boundary. Runtime continues to introspect via gRPC. If someone bypasses the edge (direct container access, internal traffic), the runtime still rejects unauthenticated calls. Phase 2 may relax this; Phase 1 keeps both lines of defence.

Phase-2 footholds are deliberately left in the design (`capabilities.edgeAuth.kind` discriminator, `moduleIntrospectPort` parameter, conformance suite covering both transports). The migration from "edge introspects per-request" to "edge introspects with cache" is a single render change in deploy-dokploy.
