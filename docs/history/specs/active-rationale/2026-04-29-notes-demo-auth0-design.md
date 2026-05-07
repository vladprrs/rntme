> Status: active-rationale.
> Date: 2026-04-29.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Notes Demo — Auth0 + Ownership + Redpanda Cloud — design

**Status:** brainstorming approved, awaiting user review of this spec
**Status update (2026-04-30):** §6 (UI auth-shell) is superseded by `docs/history/specs/active-rationale/2026-04-30-notes-demo-auth0-migration-design.md`. Phases 1-3, 5-7 remain authoritative.
**Status update (2026-05-06):** Binding-level `pre[]` and Graph IR `$pre` mechanics in this spec are superseded by `docs/history/specs/historical/2026-05-06-graph-ir-effect-operations-design.md`. Auth/session introspection that feeds graph behavior must now be modeled as Graph IR `call` nodes and consumed through operation result data, while HTTP bindings use `exposure` and `inputFrom`.
**Author:** brainstorm 2026-04-29
**Related:**
- `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md` — module pattern (`pre[]` in command bindings, `ExternalAdapterClient`, three-tier integration). This spec extends `pre[]` to query bindings (K1) and uses the module pattern end-to-end.
- `docs/history/specs/historical/2026-04-26-identity-canonical-contract-design.md` — canonical Identity v1 (24 RPCs, `IntrospectSession`). This spec claims `IntrospectSession` for `@rntme/identity-auth0` and adds `audience` field to its request.
- `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md` — `deploy-core` / `deploy-dokploy` library. This spec extends `EdgeMiddleware` with `kind: "auth"` and `ExternalEventBusConfig.security` for SASL_SSL/SCRAM.
- `docs/history/specs/historical/2026-04-26-project-deploy-flow-design.md` — platform deploy-flow.
- `docs/history/specs/historical/2026-04-17-cloudevents-envelope-design.md` — CloudEvents envelope (unchanged here; `actor` not added — ownership is carried in domain payload).
- Memories: `rntme_orchestration_only`, `project_pre_stable_stage`, `dokploy_compose_dns_collision`.

**Implementation locations:**
- Identity contract — `packages/contracts/identity/v1/`
- Auth0 module — `modules/identity/auth0/`
- Bindings validator + http runtime — `packages/artifacts/bindings/`, `packages/runtime/bindings-http/`
- Graph IR compiler — `packages/artifacts/graph-ir-compiler/`
- Runtime boot pipeline — `packages/runtime/runtime/`
- Deploy library — `packages/deploy/deploy-core/`, `packages/deploy/deploy-dokploy/`
- New UI auth shell — `packages/ui-auth-shell/`
- UI runtime — `packages/runtime/ui-runtime/`
- Demo blueprint — `demo/notes-blueprint/`
- Implementation plan — `docs/history/plans/historical/2026-04-29-notes-demo-auth0.md`

## 0. PLAN review amendments (2026-04-29)

This section is authoritative over older wording in this document and the executable plan.

1. **Preserve the canonical Identity `Session` response.** `IntrospectSession` currently returns `Session`, and the done Identity spec explicitly calls this out (`2026-04-26-identity-canonical-contract-design.md` §OQ-IDV1-3). This Auth0 demo may add `audience` to `IntrospectSessionRequest`, but it must not introduce an `IntrospectSessionResponse` shape. The Auth0 handler returns a canonical `Session`:
   - valid token: `status=SESSION_STATUS_ACTIVE`, `user_id=<JWT sub>`, `session_id=<JWT jti or sub>`, `token_type=TOKEN_TYPE_JWT_ACCESS`, `expires_at=<JWT exp>`, and whitelisted token details under `vendor_raw.claims`;
   - invalid token: `status != SESSION_STATUS_ACTIVE` and `vendor_raw.deactivation_reason` is one of `TOKEN_EXPIRED`, `INVALID_SIGNATURE`, `INVALID_ISSUER`, `INVALID_AUDIENCE`, `MALFORMED`, `UNKNOWN`.
2. **Use canonical `Session.user_id` in graph `$pre` references.** Older `$pre.session.subject_id` references should be implemented as `$pre.session.user_id`; `ownerSub` stores the Auth0/OIDC subject string, but it is carried through the canonical field `Session.user_id`.
3. **`jose@5.x` test injection must use documented APIs.** `jose` v5 documents `createRemoteJWKSet(url, { cacheMaxAge, cooldownDuration, timeoutDuration, headers, agent })` and does not document a custom fetcher option. Unit tests should inject a `JWTVerifyGetKey`/local JWKS resolver (for example `createLocalJWKSet(jwks)`) rather than relying on `Symbol.for('jose.fetch')` or `[customFetch]`. Production code can still use `createRemoteJWKSet(new URL(...), { cacheMaxAge, timeoutDuration })`.
4. **Use the repo's actual bindings error codes.** The current code emits `BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND` and `BINDINGS_STRUCTURAL_PRE_TOO_MANY`, not `BINDINGS_PRE_QUERY_FORBIDDEN` / `BINDINGS_PRE_TOO_MANY`.
5. **Ownership denial must be explicitly remapped to 404.** The existing command guard failure is `COMMAND_GUARD_REJECTED` and maps to HTTP 422. For `deleteNote`, the implementation must add a binding response or handler mapping that returns HTTP 404 for this specific ownership guard so "missing note" and "not your note" do not diverge.

## 1. Goal, scope, non-goals

**Goal.** Bring `demo/notes-blueprint/` to production-shape: replace the no-auth preview with a demo that has real OIDC login through Auth0, entity-level ownership enforcement, and connection to managed Redpanda Cloud as the event bus. The demo deploys through the existing `platform.rntme.com` → `@rntme/deploy-dokploy` pipeline without any new workload kinds: identity-auth0 ships as the existing `integration-module` workload, the edge stays Nginx, the domain side stays one service. The canonical module pattern (`pre[]` → gRPC call into the Identity module → result in payload) executes end-to-end.

**In scope (one spec, one plan):**

1. **`@rntme/identity-auth0` extension** — claim `IntrospectSession` RPC, JWKS-based JWT-validation handler (no Mgmt API call); `ResolveIdentity` and other RPCs unchanged.
2. **`@rntme/bindings` validator extension (K1)** — `pre[]` with steps allowed on query bindings; the current `BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND` check is removed; the "max 2 steps" cap stays.
3. **`@rntme/bindings-http` extension** — query handler runs `pre[]` symmetrically with the command handler; auth-aware 401 mapping when the IntrospectSession step returns a `Session` whose `status` is not `SESSION_STATUS_ACTIVE`.
4. **`@rntme/blueprint` middleware schema** — `kind: "auth"` is a known kind with `provider`, `audience`, `moduleSlug` typed; cross-artifact validator enforces `audience` equality between `project.json` and every `bindings.json` pre-step input.
5. **Notes blueprint** — `Note.fields.ownerSub`, `create` transition `affects=["title","body","ownerSub"]`, all four bindings get `pre: [{ module: "identity-auth0", rpc: "IntrospectSession", input: { token, audience }, bindAs: "session" }]`; `createNote.json` graph injects `ownerSub` from `$pre: "session.user_id"`; `deleteNote.json` graph guards via `findMany → filter on (id ∧ ownerSub) → limit 1 → emit`; `listNotes`/`getNote` graphs unchanged in structure but `NoteView.exposed` includes `ownerSub`.
6. **`@rntme/contracts-identity-v1`** — additive `audience: string` field on `IntrospectSessionRequest`. `IntrospectSession` still returns canonical `Session`; invalid-token reason is carried in `Session.vendor_raw.deactivation_reason`.
7. **`@rntme/ui-auth-shell` (new package)** — wraps ui-runtime with `@auth0/auth0-spa-js` PKCE flow, login/logout chrome, transport middleware with Bearer injection, `currentUser` injection into ui-runtime initial data-state.
8. **`@rntme/deploy-core` extensions** — `EdgeMiddleware` discriminated-union gets a fifth variant `kind: "auth"` (noop in Nginx, marker for plan); `ExternalEventBusConfig.security` becomes a discriminated union supporting `protocol: "sasl_ssl"` with `mechanism: "scram-sha-256"|"scram-sha-512"` and strict `secretRefs: { username, password }`.
9. **`@rntme/deploy-dokploy` extensions** — render `kind: "auth"` middleware: domain-service workload gets env `RNTME_AUTH_PROVIDER=auth0`, `RNTME_AUTH_AUDIENCE=...`, `RNTME_AUTH_MODULE_SLUG=identity-auth0`, `RNTME_AUTH_MODULE_ENDPOINT=<rendered-resource-name-of-identity-auth0>:50051`. SASL_SSL/SCRAM env: `RNTME_EVENT_BUS_PROTOCOL`, `..._MECHANISM`, `..._USERNAME` (secret), `..._PASSWORD` (secret). Edge nginx unchanged (auth → noop).
10. **`@rntme/runtime` extensions** — boot pipeline reads `RNTME_AUTH_*` env, constructs `ExternalAdapterClient` registry with one registered module `identity-auth0`, passes it to `bindings-http`. SASL_SSL env consumed by Kafka client config.
11. **`@rntme/graph-ir-compiler` extension** — expression evaluator gains `$pre: "<bindAs>.<dot.path>"` directive for referencing pre-step results in `emit.payload` and `filter.where`.
12. **Deploy walkthrough** — Auth0 dashboard manual setup (custom API audience, SPA application, redirect URIs), Redpanda Cloud SASL user, Dokploy secrets, `rntme project publish`, deploy-target create/update, deploy.

**Out of scope (separate specs):**

- Operaton BPMN workload and BPMN integration in the demo.
- Redpanda as a provisioned container in Dokploy (external Redpanda Cloud is used here).
- Edge-side auth sidecar (Q2 option A, rejected).
- Other Auth0 session RPCs (`RevokeSession`, `ListSessions`, `GetSession`) — `IntrospectSession` only.
- Provisioning the Auth0 tenant via Mgmt API (manual via dashboard).
- Conditional rendering of "hide Delete if not owner" in ui-runtime — degrades to "click → 403 → toast".
- Refresh-token rotation in the shell (no silent renew via iframe).
- E2E browser-test automation — manual smoke.
- Live conformance for the new IntrospectSession handler (mock conformance only here).
- Multi-vendor IDP support in auth-shell (`provider: "clerk"`, `"workos"`).

**Relation to `2026-04-27-notes-demo-e2e-design.md`.** That spec describes the **first deploy-flow run** on the no-auth preview blueprint; status "awaiting user review". This spec **supersedes** it: instead of deploying a preview, we go straight to a production-shape demo with auth. If the 2026-04-27 deploy was already executed, this spec describes the v2 upgrade (re-publish with a new project version, redeploy). If not, this replaces 2026-04-27 as the first run. Phase 6 of the plan resolves this.

## 2. Decisions matrix

| # | Question | Decision |
|---|---|---|
| Q1 | Scope cut | Auth + ownership + notes-blueprint + Redpanda Cloud (external) — one spec, one plan. Operaton, Redpanda-as-container — separate specs. |
| Q2 | Where does JWT verification live? | **D — canonical module pattern: `IntrospectSession` in `@rntme/identity-auth0`.** Domain service calls it via `pre[]` in every binding; bindings-http maps canonical `Session.status !== SESSION_STATUS_ACTIVE` → 401. |
| Q3 | Ownership enforcement model | **E1 — payload-injection in graph IR + IR-side guard for delete.** `createNote` injects `ownerSub` from `$pre: "session.user_id"` in `emit.payload`; `deleteNote` filters `NoteView` by `id ∧ ownerSub` and emits only if a row matches. CloudEvents envelope is **not** changed. |
| Q4a | Auth0 SDK on the client | **F1 — `@auth0/auth0-spa-js`** with Authorization Code + PKCE. |
| Q4b | Where does auth state live? | **G1 — auth-shell wrapper around ui-runtime.** ui-runtime stays auth-agnostic; the shell injects a Bearer-aware transport and seeds `currentUser` into initial data-state. The shell never exposes `getAccessToken()`. |
| Q5.1 | Auth0 audience | Custom API in Auth0 dashboard, identifier `https://notes-demo.rntme.com/api`. The Mgmt API URL `https://demo-rntme.us.auth0.com/api/v2/` is a **separate** audience and not used here. |
| Q5.2 | Auth on every endpoint? | **H1 — yes**, including queries. All four bindings carry `pre: [IntrospectSession]`. |
| Q5.3 | Note PDM schema change | Add `ownerSub: string`. `create` transition `affects: ["title","body","ownerSub"]`. Seed welcome note has `ownerSub: "system"` (sentinel — no Auth0 sub matches `^[^|]+$`). |
| Q5.4 | identity-auth0 Mgmt API in demo | Not used. Module ships only for `IntrospectSession`. Mgmt SDK lazy-init: missing creds do not crash, but every Mgmt RPC returns `IDENTITY_CONFIG_MGMT_NOT_CONFIGURED`. |
| Q5.5 | `ExternalEventBusConfig` shape for Redpanda Cloud | Discriminated union: `protocol: "plaintext"` (no extra fields) or `protocol: "sasl_ssl"` (requires `mechanism` + `secretRefs.{username,password}`). |
| Q5.6 | UI auth-shell location | New package `@rntme/ui-auth-shell`. Vanilla DOM chrome (no React/Vue). |
| Q5.7 | deploy-dokploy `kind: "auth"` rendering | **Edge noop** (per Q2 D); marker drives env wiring on the domain-service workload. |
| K1 | Allow `pre[]` on query bindings? | **Yes.** Validator's current `BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND` branch is removed; `bindings-http` query handler runs `pre[]` symmetrically with the command handler. |

## 3. End-to-end flows

Throughout: `edge` = Nginx workload, `app` = domain-service workload `notes-demo-app`, `id-auth0` = integration-module workload `notes-demo-identity-auth0`, `kafka` = external Redpanda Cloud.

### 3.1 Cold-start login (anonymous visit)

```
browser                 edge      app    id-auth0    Auth0 IDP
   │ GET /                │        │         │           │
   ├─────────────────────►│ → /     │         │           │
   │ 200 index.html       │        │         │           │
   │◄─────────────────────┤        │         │           │
   │                                                       │
   │ ui-auth-shell boots:                                  │
   │  GET /config.json (public static asset from edge)    │
   │  Auth0Client.checkSession() → no token in memory     │
   │  render <LoginButton onClick=loginWithRedirect()/>   │
   │                                                       │
   │ click Login                                           │
   │ → window.location = /authorize?client_id=...         │
   │   &audience=https://notes-demo.rntme.com/api         │
   │   &response_type=code&code_challenge=...             │
   │   &redirect_uri=https://<edge>/                      │
   ├──────────────────────────────────────────────────────►│
   │ 302 → Universal Login → user enters credentials      │
   │◄────────── 302 → /?code=<authcode>&state=...         │
   │                                                       │
   │ GET /?code=...       │        │         │           │
   ├─────────────────────►│        │         │           │
   │ 200 index.html (same SPA bundle)                      │
   │◄─────────────────────┤                              │
   │ ui-auth-shell sees `code`, handleRedirectCallback() │
   │ POST /oauth/token (PKCE code-verifier) ─────────────►│
   │◄── { access_token, id_token, expires_in }           │
   │ tokens in-memory; mount ui-runtime with               │
   │   transport(headers: Authorization: Bearer …)        │
   │   initial state: { currentUser: { sub, email } }     │
```

### 3.2 listNotes (read, requires auth)

```
ui-runtime → fetch GET /api/notes  (Authorization: Bearer <jwt>)
   │
   ├─► edge (Nginx, no auth) ──► app:3000/api/notes
   │
   │   bindings-http (query handler, K1-extended):
   │     1. extract Authorization header → token
   │     2. runPreSteps(pre):
   │          externalAdapterClient.call("identity-auth0", "IntrospectSession",
   │            { token, audience: "https://notes-demo.rntme.com/api" })
   │          ↓ gRPC over HTTP/2 to id-auth0:50051
   │
   │        id-auth0 IntrospectSession handler:
   │          a. fetch JWKS from https://demo-rntme.us.auth0.com/.well-known/jwks.json
   │             (in-memory cache, 1h TTL, lazy on miss)
   │          b. jwtVerify (RS256), iss=https://demo-rntme.us.auth0.com/,
   │             aud contains audience param, exp > now (clockTolerance 30s)
   │          c. return canonical Session { status: SESSION_STATUS_ACTIVE,
   │                      user_id: "auth0|abc123", expires_at,
   │                      vendor_raw.claims: <whitelist> }
   │
   │     3. if session.status !== SESSION_STATUS_ACTIVE → 401
   │     4. bindAs: "session" → scope.pre.session = response
   │     5. execute graph listNotes (no actor.sub used — pure read of all active notes)
   │     6. response: { notes: [...] }, 200
```

### 3.3 createNote (write, payload injection)

```
ui-runtime → fetch POST /api/notes  (Authorization: Bearer <jwt>)
             body: { id, title, body }
   │
   ├─► edge ──► app:3000/api/notes (POST)
   │
   │   bindings-http (command handler):
   │     1. runPreSteps([IntrospectSession]) → scope.pre.session = { user_id: "auth0|abc123", … }
   │     2. construct command params from HTTP body: id, title, body
   │     3. graph IR createNote evaluates:
   │          emit { aggregate: "Note", aggregateId: $param.id,
   │                 transition: "create",
   │                 payload: { title: $param.title,
   │                            body:  $param.body,
   │                            ownerSub: $pre.session.user_id } }
   │     4. event-store appends CloudEvent type="NoteCreate"
   │     5. publish to Redpanda Cloud topic="rntme.app.note"
   │        (SASL_SSL/SCRAM-SHA-512, creds from RNTME_EVENT_BUS_USERNAME/PASSWORD env)
   │     6. projection-consumer reads back, updates NoteView (incl ownerSub)
   │     7. response: { id, status: "active" }, 201
```

The client-supplied `body.ownerSub`, if any, is **ignored** because `bindings.json#createNote.http.parameters` does not declare it.

### 3.4 deleteNote (write, IR-side ownership guard)

```
ui-runtime → fetch POST /api/notes/<id>/actions/delete  (Authorization: Bearer <jwt>)
   │
   ├─► edge ──► app:3000/api/notes/<id>/actions/delete (POST)
   │
   │   bindings-http (command handler):
   │     1. runPreSteps → scope.pre.session.user_id = "auth0|abc123"
   │     2. params: { id: <path.id> }
   │     3. graph IR deleteNote (nodes: findMany "all" → filter "guard" → emit):
   │          guard.expr = (noteView.id == $param.id) AND (noteView.ownerSub == $pre.session.user_id)
   │          if guard yields zero rows → emit does NOT fire → command result "guard failed"
   │          if guard yields one row → emit publishes NoteDelete CloudEvent
   │     4. on guard-failed → HTTP 404 (security-conscious; same code for "no such note" and "not your note")
   │     5. on success → 200, projection sets status=deleted on next consume
```

The single 404 mapping for both "no such note" and "not your note" is intentional: it does not leak the existence of someone else's notes. Empty-emit semantics follow the existing fixture `assignIssueWithCapacityGuard` — see §5.7.

### 3.5 ui-runtime data-state after login

```js
{
  currentUser: { sub: "auth0|abc123", email: "user@example.com" },
  notes: []   // populated after listNotes refetch
}
```

`currentUser` is readonly (injected by shell) and is used only for optional UI conditional rendering ("hide Delete if note.ownerSub !== currentUser.sub" if ui-runtime supports it; otherwise the button is always visible and the server returns 404).

### 3.6 Token expiry

When the access token expires (Auth0 default 24h), the next API call returns 401 with body `{ code: "RUNTIME_AUTH_TOKEN_INVALID", reason: "TOKEN_EXPIRED" }`. The shell's transport intercepts the 401, unmounts ui-runtime, and renders the login chrome again with a "Session expired, please sign in again" hint. No silent renew via iframe.

## 4. Component changes summary

| # | Package | Δ | Change |
|---|---|---|---|
| 1 | `@rntme/contracts-identity-v1` | XS | `IntrospectSessionRequest.audience: string` (additive). `IntrospectSession` continues to return canonical `Session`. Invalid-token reason is carried in `Session.vendor_raw.deactivation_reason`. Regenerate TS bindings. README: `audience` listed as required for OIDC/JWT vendors. |
| 2 | `@rntme/identity-auth0` | M | `module.json#capabilities.rpcs` adds `IntrospectSession`; limitations rewritten. New `src/introspect-session.ts` with `jose`-based JWKS verifier. `src/handlers.ts` dispatch updated. `src/capabilities.ts` `CLAIMED_RPCS` updated. Mock-conformance scenarios for IntrospectSession (≥6). Existing UNIMPLEMENTED tests for the other session RPCs split off and kept. R13 fix: lazy Mgmt SDK init. |
| 3 | `@rntme/blueprint` | XS | Middleware schema already accepts `kind: nonEmptyString` — no parse change. New cross-artifact validator: `audience` equality between `project.json#middleware.auth.audience` and every `bindings.json#bindings.X.pre[].input.audience` in services that mount that auth middleware. Error code `BLUEPRINT_AUTH_AUDIENCE_MISMATCH`. `ComposedProjectInput.middleware` typing extended for `kind: "auth"` discriminated case. |
| 4 | `@rntme/bindings` | S | Validator removes the current `BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND` branch for query bindings with pre steps. "Max 2 pre-steps" cap stays. Unit tests added. |
| 5 | `@rntme/bindings-http` | M | Query handler runs `runPreSteps` symmetrically with the command handler. `router.ts` requires `externalAdapterClient` when **any** binding has `pre[]`. Auth-aware 401 mapping when `module===project.middleware.auth.moduleSlug && rpc==="IntrospectSession"` and returned `Session.status !== SESSION_STATUS_ACTIVE`. PII masking in pre-result logs (`vendor_raw.claims.*` replaced with `<masked>`). |
| 6 | `@rntme/graph-ir-compiler` | S | Expression evaluator gains `$pre: "<bindAs>.<dot-path>"` directive. Allowed in `emit.payload.<field>`, `filter.where.eq[]`, `filter.where.and[].eq[]`, `findMany`/`findOne` filters. Disallowed in `aggregateId`, `transition`. Compile-time error `GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_<position>` for misuse. Cross-artifact validation (`$pre` references an existing `bindAs`) lives in `@rntme/blueprint`, not here. |
| 7 | `@rntme/runtime` | M | Boot reads `RNTME_AUTH_PROVIDER`, `RNTME_AUTH_AUDIENCE`, `RNTME_AUTH_MODULE_SLUG`, `RNTME_AUTH_MODULE_ENDPOINT`. If `provider=auth0` and endpoint is non-empty, build `ExternalAdapterClient` registry with the single module `identity-auth0` → `<endpoint>` (gRPC over HTTP/2) and pass to `bindings-http.createBindingsRouter`. If provider set but endpoint missing → boot fails `RUNTIME_BOOT_AUTH_ENDPOINT_MISSING`. Kafka client reads `RNTME_EVENT_BUS_PROTOCOL`/`MECHANISM`/`USERNAME`/`PASSWORD` for SASL_SSL/SCRAM. |
| 8 | `@rntme/deploy-core` | S | `ExternalEventBusConfig.security` becomes a discriminated union `{ protocol: "plaintext" } \| { protocol: "sasl_ssl"; mechanism; secretRefs }`. Plan validators added. `EdgeMiddleware` union extended with `kind: "auth"` (`provider`, `audience`, `moduleSlug`, `policy`, `config`). `supportedMiddlewareKinds` extended. `planMiddleware` validates that `moduleSlug` references an existing `integration-module` workload in the same plan. |
| 9 | `@rntme/deploy-dokploy` | S | `render.ts` for domain-service workloads emits `RNTME_AUTH_*` env when an `auth` middleware is mounted on its routes, and SASL env (incl. `RNTME_EVENT_BUS_USERNAME`/`PASSWORD` as `secret: true` resolving Dokploy secret refs). `nginx.ts` does not emit any block for `kind: "auth"` (intentional noop). gRPC port `50051` is the convention for integration-module workloads. |
| 10 | `demo/notes-blueprint/` | M | See §5. PDM, QSM, graphs, bindings, project.json, seed, services/identity-auth0, README — all updated. |
| 11 | `@rntme/ui-auth-shell` | **New M** | New workspace package. `mountAuthenticatedApp(config)` API. `@auth0/auth0-spa-js` PKCE flow. Vanilla-DOM login/logout chrome. Bearer-injecting transport. `currentUser` injection into ui-runtime initial data-state. `getAccessToken()` not exposed. Unit tests. |
| 12 | `@rntme/ui-runtime` | XS | `bootstrap` accepts `transport?: typeof fetch` and `initialState?: Record<string, unknown>` with readonly-keys protection. SPA build entry replaced with shell-mount `app.js`. Static `/config.json` served from disk by domain-service workload (deploy-dokploy renders it as a generated file). |
| 13 | `@rntme/cli` | none | No changes. |
| 14 | `platform-*` (control plane) | none | No changes. The deploy-flow already works. |

## 5. Blueprint shape

### 5.1 `project.json`

```json
{
  "name": "notes-demo",
  "services": ["app", "identity-auth0"],
  "routes": {
    "ui": { "/": "app" },
    "http": { "/api": "app" }
  },
  "middleware": {
    "requestContext": { "kind": "request-context" },
    "auth": {
      "kind": "auth",
      "provider": "auth0",
      "audience": "https://notes-demo.rntme.com/api",
      "moduleSlug": "identity-auth0"
    }
  },
  "mounts": [
    { "target": "ui:/",     "use": ["requestContext"] },
    { "target": "http:/api", "use": ["requestContext", "auth"] }
  ]
}
```

`auth` is mounted **only** on the http route. The ui bundle and `/config.json` are public.

### 5.2 `services/identity-auth0/service.json`

```json
{ "kind": "integration-module" }
```

The image, env, and secretRefs come from `ProjectDeploymentConfig.modules["identity-auth0"]` at deploy time, not from the blueprint.

### 5.3 `pdm/entities/Note.json`

```json
{
  "ownerService": "app",
  "kind": "owned",
  "table": "notes",
  "fields": {
    "id":        { "type": "string",   "nullable": false, "column": "id" },
    "title":     { "type": "string",   "nullable": false, "column": "title" },
    "body":      { "type": "string",   "nullable": false, "column": "body" },
    "ownerSub":  { "type": "string",   "nullable": false, "column": "owner_sub" },
    "status":    { "type": "string",   "nullable": false, "column": "status" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active", "deleted"],
    "transitions": {
      "create": { "from": null,     "to": "active",  "affects": ["title", "body", "ownerSub"] },
      "delete": { "from": "active", "to": "deleted" }
    }
  }
}
```

The `delete` transition omits `affects` (no fields written) — matching the existing convention in the current Note.json. `ownerSub` `column` is `owner_sub` to follow the existing snake_case column convention.

### 5.4 `services/app/qsm/projections/NoteView.json`

```json
{
  "backing": "entity-mirror",
  "source": { "entity": "Note" },
  "keys": ["id"],
  "grain": ["id"],
  "exposed": ["title", "body", "ownerSub", "status", "createdAt"]
}
```

`backing`, `source`, `keys`, `grain` are required by the existing QSM schema. `exposed` adds `ownerSub` and `createdAt` to the previous list.

### 5.5 `services/app/graphs/shapes.json`

```json
{
  "NoteView": {
    "fields": {
      "id":        { "type": "string",   "nullable": false },
      "title":     { "type": "string",   "nullable": false },
      "body":      { "type": "string",   "nullable": false },
      "ownerSub":  { "type": "string",   "nullable": false },
      "status":    { "type": "string",   "nullable": false },
      "createdAt": { "type": "datetime", "nullable": false }
    }
  }
}
```

Flat `<ShapeName>: { fields: ... }` record — no `shapes:` wrapper, matching the existing convention.

### 5.6 `services/app/graphs/createNote.json`

```json
{
  "id": "createNote",
  "signature": {
    "inputs": {
      "id":    { "type": "string", "mode": "required" },
      "title": { "type": "string", "mode": "required" },
      "body":  { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Note",
        "aggregateId": { "$param": "id" },
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

`ownerSub` is absent from `signature.inputs` — the client cannot supply it. The graph IR shape (`id`, `signature`, `nodes[]`) matches the existing convention; the `$pre` directive in `payload.ownerSub` is the new graph-ir-compiler extension (§7.3).

### 5.7 `services/app/graphs/deleteNote.json`

```json
{
  "id": "deleteNote",
  "signature": {
    "inputs": {
      "id": { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "all",
      "type": "findMany",
      "config": { "source": { "projection": "NoteView" } }
    },
    {
      "id": "guard",
      "type": "filter",
      "config": {
        "input": "all",
        "expr": {
          "and": [
            { "eq": ["noteView.id",       { "$param": "id" }] },
            { "eq": ["noteView.ownerSub", { "$pre":   "session.user_id" }] }
          ]
        }
      }
    },
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Note",
        "aggregateId": { "$param": "id" },
        "transition": "delete",
        "payload": {}
      }
    }
  ]
}
```

The runtime semantic for `assignIssueWithCapacityGuard` (existing fixture) sets the precedent: when an upstream `filter` reduces to an empty rowset, the downstream `emit` does not fire and the command returns `COMMAND_GUARD_REJECTED`. Current `bindings-http` maps that code to HTTP 422, so the notes implementation must add an explicit binding-level response or command-handler mapping for `deleteNote` that returns HTTP 404. This preserves the security-conscious behavior: the API does not distinguish "no such note" from "not your note".

### 5.8 `services/app/graphs/listNotes.json` and `getNote.json`

Unchanged in IR structure (no owner filter — every signed-in user sees every active note). `NoteView.exposed` now contains `ownerSub`, which therefore appears in JSON responses.

### 5.9 `services/app/bindings/bindings.json`

```json
{
  "version": "1.0",
  "graphSpecRef": "../graphs/shapes.json",
  "pdmRef":       "../../../pdm/pdm.json",
  "qsmRef":       "../qsm/qsm.json",
  "bindings": {
    "createNote": {
      "kind": "command",
      "graph": "../graphs/createNote.json",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "POST",
        "path": "/notes",
        "parameters": [
          { "name": "id",    "in": "body", "bindTo": "id",    "required": true },
          { "name": "title", "in": "body", "bindTo": "title", "required": true },
          { "name": "body",  "in": "body", "bindTo": "body",  "required": true }
        ]
      },
      "pre": [
        {
          "kind": "module-rpc",
          "module": "identity-auth0",
          "rpc": "IntrospectSession",
          "input": {
            "token":    { "from": "header", "name": "authorization" },
            "audience": "https://notes-demo.rntme.com/api"
          },
          "bindAs": "session",
          "timeoutMs": 5000,
          "retry": { "attempts": 1, "retryOn": "never" }
        }
      ]
    },
    "deleteNote": {
      "kind": "command",
      "graph": "../graphs/deleteNote.json",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "POST",
        "path": "/notes/{id}/actions/delete",
        "parameters": [
          { "name": "id", "in": "path", "bindTo": "id", "required": true }
        ]
      },
      "pre": [
        { "kind": "module-rpc", "module": "identity-auth0", "rpc": "IntrospectSession",
          "input": {
            "token":    { "from": "header", "name": "authorization" },
            "audience": "https://notes-demo.rntme.com/api"
          },
          "bindAs": "session" }
      ]
    },
    "listNotes": {
      "kind": "query",
      "graph": "../graphs/listNotes.json",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": { "method": "GET", "path": "/notes", "parameters": [] },
      "pre": [
        { "kind": "module-rpc", "module": "identity-auth0", "rpc": "IntrospectSession",
          "input": {
            "token":    { "from": "header", "name": "authorization" },
            "audience": "https://notes-demo.rntme.com/api"
          },
          "bindAs": "session" }
      ]
    },
    "getNote": {
      "kind": "query",
      "graph": "../graphs/getNote.json",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "GET",
        "path": "/notes/{id}",
        "parameters": [
          { "name": "id", "in": "path", "bindTo": "id", "required": true }
        ]
      },
      "pre": [
        { "kind": "module-rpc", "module": "identity-auth0", "rpc": "IntrospectSession",
          "input": {
            "token":    { "from": "header", "name": "authorization" },
            "audience": "https://notes-demo.rntme.com/api"
          },
          "bindAs": "session" }
      ]
    }
  }
}
```

The `audience` field is duplicated across `project.json#middleware.auth.audience` and four `bindings.json#bindings.*.pre[0].input.audience`. The blueprint cross-artifact validator (`@rntme/blueprint`) enforces equality and emits `BLUEPRINT_AUTH_AUDIENCE_MISMATCH` on drift.

### 5.10 `services/app/seed/seed.json`

```json
{
  "seedVersion": 1,
  "events": [
    {
      "id": "seed:Note:welcome:v1",
      "subject": "Note-00000000-0000-0000-0000-000000000001",
      "rntAggregateType": "Note",
      "rntAggregateId":   "00000000-0000-0000-0000-000000000001",
      "rntVersion": 1,
      "eventType": "NoteCreate",
      "data": {
        "title":    "Welcome to notes-demo",
        "body":     "This is a system-seeded note. Anyone can see it; no one can delete it.",
        "ownerSub": "system"
      },
      "time": "2026-04-29T00:00:00.000Z",
      "rntSchemaVersion": 1
    }
  ]
}
```

`ownerSub: "system"` is a sentinel: every real Auth0 sub contains a `|` (`auth0|…`, `oauth2|google-oauth2|…`, `samlp|…`), so the filter in `deleteNote` never matches it. The seed note is read-only by construction. Envelope fields (`id`, `subject`, `rntAggregateType`, `rntAggregateId`, `rntVersion`, `time`, `rntSchemaVersion`) follow the existing seed convention — see `demo/notes-blueprint/services/app/seed/seed.json` (current).

### 5.11 UI screen — `services/app/ui/screens/home.spec.json`

Inherits the structure from `2026-04-27-notes-demo-e2e-design.md` §2.6: `Stack(vertical)` with `createForm` + `deleteForm` + `notesList`. The `notesList` row template now displays `ownerSub` (or `currentUser.sub === note.ownerSub ? "you" : <masked>` if ui-runtime supports conditional rendering — otherwise raw). The exact form is finalized in the plan.

## 6. `@rntme/identity-auth0` IntrospectSession handler

### 6.1 Capability claim

`modules/identity/auth0/module.json` patch:

```diff
   "capabilities": {
     "rpcs": [
       "GetUser", "ListUsers", "CreateUser", "UpdateUser", "DeleteUser",
       "ResolveIdentity",
       "GetOrganization", "ListOrganizations", "CreateOrganization", "UpdateOrganization", "DeleteOrganization",
       "ListMemberships", "AddMembership", "RemoveMembership",
-      "CreateInvitation", "ListInvitations", "GetInvitation", "RevokeInvitation"
+      "CreateInvitation", "ListInvitations", "GetInvitation", "RevokeInvitation",
+      "IntrospectSession"
     ],
     ...
   },
   "limitations": [
-    "Auth0 tenant sessions are not claimed because Auth0 session and token semantics do not map safely to the canonical session RPCs.",
+    "Only IntrospectSession is claimed via OIDC JWKS validation. RevokeSession, ListSessions, GetSession remain unclaimed because Auth0 server-side session aggregate does not map to the canonical Session entity (no listable session resource, no programmatic revoke without Mgmt session-scope).",
     ...
   ]
```

`src/capabilities.ts` `CLAIMED_RPCS` adds `"IntrospectSession"`. `SESSION_RPCS` (if present) is reclassified accordingly.

### 6.2 Contract change

`packages/contracts/identity/v1/proto/identity.proto`:

```proto
message IntrospectSessionRequest {
  string token = 1;
  string audience = 2;
}

// IntrospectSession still returns canonical Session.
// Invalid-token details are carried in Session.vendor_raw.deactivation_reason.
```

`audience` is additive in proto3 — no contract version bump. `error-codes.json` is unchanged for this RPC: invalid-token outcomes are reported via canonical `Session.status != SESSION_STATUS_ACTIVE` plus `Session.vendor_raw.deactivation_reason`, not gRPC errors. gRPC errors only on transport-level problems (`IDENTITY_TRANSPORT_JWKS_UNREACHABLE`).

`vendor_raw.deactivation_reason` enum-string values: `TOKEN_EXPIRED`, `INVALID_SIGNATURE`, `INVALID_ISSUER`, `INVALID_AUDIENCE`, `MALFORMED`, `UNKNOWN`. It is absent when `status=SESSION_STATUS_ACTIVE`.

### 6.3 Handler implementation

JWT library: `jose@^5.x` (modern, native JWKS support, async-first; final pin in plan).

`createAuth0Adapter(options)` extension:

```ts
type Auth0OidcOptions = {
  domain: string;             // existing
  jwksCacheTtlMs?: number;    // default 3_600_000
  jwksTimeoutMs?: number;     // default 5_000
};
```

`src/introspect-session.ts`:

```ts
import { jwtVerify, createRemoteJWKSet, errors as joseErrors } from 'jose';
import { SessionStatus, TokenType } from '@rntme/contracts-identity-v1';
import type { IntrospectSessionRequest, Session } from '@rntme/contracts-identity-v1';

export type IntrospectDeps = {
  domain: string;
  jwksCacheTtlMs?: number;
  jwksTimeoutMs?: number;
  jwksResolver?: Parameters<typeof jwtVerify>[1];
  now?: () => number;
};

export function createIntrospectSession(deps: IntrospectDeps) {
  const issuer  = `https://${deps.domain}/`;
  const jwksUrl = new URL(`https://${deps.domain}/.well-known/jwks.json`);
  const jwks = deps.jwksResolver ?? createRemoteJWKSet(jwksUrl, {
    cacheMaxAge: deps.jwksCacheTtlMs ?? 3_600_000,
    timeoutDuration: deps.jwksTimeoutMs ?? 5_000,
    // jose v5 has no documented custom-fetch option; tests inject a local getKey resolver.
  });

  return async function introspectSession(req: IntrospectSessionRequest): Promise<Session> {
    if (!req.token || !req.audience) return inactive('MALFORMED');
    try {
      const { payload } = await jwtVerify(req.token, jwks, {
        issuer,
        audience: req.audience,
        clockTolerance: 30,
      });
      return {
        user_id: String(payload.sub ?? ''),
        session_id: typeof payload.jti === 'string' ? payload.jti : String(payload.sub ?? ''),
        status: SessionStatus.SESSION_STATUS_ACTIVE,
        token_type: TokenType.TOKEN_TYPE_JWT_ACCESS,
        expires_at: payload.exp ? secondsToTs(payload.exp) : undefined,
        vendor_raw: { claims: pickPublicClaims(payload) },
      };
    } catch (err) {
      return inactive(classifyJoseError(err));
    }
  };
}

function classifyJoseError(err: unknown): string {
  if (err instanceof joseErrors.JWTExpired)        return 'TOKEN_EXPIRED';
  if (err instanceof joseErrors.JWTClaimValidationFailed) {
    if (err.claim === 'iss') return 'INVALID_ISSUER';
    if (err.claim === 'aud') return 'INVALID_AUDIENCE';
    return 'MALFORMED';
  }
  if (err instanceof joseErrors.JWSSignatureVerificationFailed) return 'INVALID_SIGNATURE';
  if (err instanceof joseErrors.JWSInvalid)        return 'MALFORMED';
  if (err instanceof joseErrors.JWKSNoMatchingKey) return 'INVALID_SIGNATURE';
  return 'UNKNOWN';
}

function pickPublicClaims(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ['sub','email','email_verified','name','given_name','family_name','picture','locale','iat','exp','iss','aud','azp']) {
    if (k in p) out[k] = p[k];
  }
  return out;
}
```

`pickPublicClaims` is a **whitelist**, not a blacklist, to keep tenant-specific custom claims off the gRPC surface unless explicitly added. The JWKS cache lives in `createIntrospectSession` closure — singleton per identity-auth0 process.

### 6.4 Handler dispatch

`src/handlers.ts` patch dispatches `IntrospectSession` to the new function. `src/adapter.ts` lazy-inits the Mgmt SDK so missing creds do not crash (R13).

### 6.5 Mock-conformance scenarios

`modules/identity/auth0/test/integration/conformance/introspect-session.ts` adds at minimum:

1. Valid token with correct iss/aud/exp → `{status: SESSION_STATUS_ACTIVE, user_id: ...}`.
2. Expired token → `{status: SESSION_STATUS_EXPIRED, vendor_raw.deactivation_reason: "TOKEN_EXPIRED"}`.
3. Wrong audience → `{status: SESSION_STATUS_UNSPECIFIED, vendor_raw.deactivation_reason: "INVALID_AUDIENCE"}`.
4. Wrong issuer → `{status: SESSION_STATUS_UNSPECIFIED, vendor_raw.deactivation_reason: "INVALID_ISSUER"}`.
5. Malformed token (not three parts) → `{status: SESSION_STATUS_UNSPECIFIED, vendor_raw.deactivation_reason: "MALFORMED"}`.
6. Empty audience in request → `{status: SESSION_STATUS_UNSPECIFIED, vendor_raw.deactivation_reason: "MALFORMED"}`.
7. Optional: JWKS-unreachable → gRPC error `IDENTITY_TRANSPORT_JWKS_UNREACHABLE`.

The mock-vendor (part of `@rntme/conformance-framework`) generates JWTs against a local test keypair and serves a mock JWKS endpoint.

Live conformance (real Auth0 sandbox tenant) is out of scope for this spec.

### 6.6 What is not changed

Mgmt-API handlers (User/Org/Membership/Invitation) are untouched. `src/adapter.ts` `Auth0ManagementAdapter` is unchanged in behavior (only its init becomes lazy). `src/events.ts` log-event translation is unchanged. README "Out of Scope" section is rewritten to reflect the new IntrospectSession claim and the still-unclaimed RevokeSession/ListSessions/GetSession.

## 7. `@rntme/bindings` K1 + Graph IR `$pre` directive

### 7.1 Validator — `@rntme/bindings`

`packages/artifacts/bindings/src/validate/structural.ts` currently emits `BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND` for query bindings with one or more pre steps. Remove that branch. Keep the "max 2 pre-fetch steps" check and its current code `BINDINGS_STRUCTURAL_PRE_TOO_MANY`.

Unit test added: query binding with one valid `module-rpc` pre-step validates ok; query binding with three pre-steps fails on `BINDINGS_STRUCTURAL_PRE_TOO_MANY`.

### 7.2 Runtime query path — `@rntme/bindings-http`

The query handler runs `runPreSteps` symmetrically with the command handler. `router.ts` updates the precondition: `externalAdapterClient` is required when **any** binding has `pre[]` (commands or queries). Idempotency cache is unchanged: queries are not cached there.

Auth-aware 401 mapping. `bindings-http` reads `project.json#middleware.auth.moduleSlug` (if any). For each pre-step in any binding where `module === moduleSlug && rpc === "IntrospectSession"`, after `runPreSteps`, if the bound canonical `Session.status !== SESSION_STATUS_ACTIVE`, the handler replies HTTP 401 with body:

```json
{ "code": "RUNTIME_AUTH_TOKEN_INVALID", "message": "authentication required", "reason": "<vendor_raw.deactivation_reason>" }
```

This is the only place where an inactive IntrospectSession result becomes a 401: the rest of the runtime treats it as a regular pre-step result.

PII masking. `runPreSteps` and command/query handlers, when logging the pre-step result, must replace any field matching `vendor_raw.claims.*` with `<masked>` (R12). One central mask helper in `pre/run-pre-steps.ts` log paths.

### 7.3 Graph IR `$pre` directive — `@rntme/graph-ir-compiler`

Expression evaluator extension. The directive form is a JSON object with a single key `$pre`, value is a dot-separated path `<bindAs>.<segment>...`:

```ts
type ExprRef =
  | { $param: string }
  | { $pre:   string };

function evaluateExprRef(expr: ExprRef, scope: { params: Record<string, unknown>; pre: Record<string, unknown> }): unknown {
  if ('$param' in expr) return scope.params[expr.$param];
  if ('$pre'   in expr) return resolvePath(scope.pre, expr.$pre);
  throw new Error(`unknown expression ref: ${JSON.stringify(expr)}`);
}

function resolvePath(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc as Record<string, unknown> | undefined)?.[key],
    root,
  );
}
```

Allowed positions: anywhere `expr` is valid in the existing IR — `filter.config.expr` (including nested `eq`/`and`/`or`/`between`/etc.), `emit.config.payload.<field>`, `map.config.fields.<field>`, `reduce.config.measures.<name>.expr`, `sort.config.by[].field` (rare; not used in this demo). The `$pre` directive is added to the `expr` discriminated union in `parse/schema.ts`.

Disallowed positions: `emit.config.aggregateId` (identity comes from params), `emit.config.transition` (structural constant), `findMany.config.source.<entity|projection|eventType>` (structural). Compile-time validator emits `GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_AGGREGATE_ID` / `..._IN_TRANSITION` / `..._IN_SOURCE` for misuse.

Cross-artifact validation (a `$pre` reference must point at a `bindAs` declared in the binding's `pre[]`) lives in `@rntme/blueprint` `validate/composition.ts` because graph-ir-compiler does not see bindings. Error code `BLUEPRINT_GRAPH_PRE_REF_UNDEFINED_BINDING`.

Backward compatibility: `$pre` is additive; existing graphs using only `$param` are unchanged. Existing fixtures (e.g. `product-catalog-project`) compile unchanged.

### 7.4 Bindings-side vs IR-side payload-injection — final

Payload injection lives in **graph IR** via `$pre`, not in `bindings.json`. This keeps `bindings.json` purely about HTTP→params mapping and pre-step orchestration; the graph fully describes the command's effect. Tests for the graph are runnable without bindings-http: feed `{params, pre}` into the evaluator, assert the emitted CloudEvent.

## 8. Deploy library extensions

### 8.1 `ExternalEventBusConfig` — SASL_SSL/SCRAM

`packages/deploy/deploy-core/src/config.ts`:

```ts
export type ExternalEventBusSecurity =
  | { readonly protocol: 'plaintext' }
  | {
      readonly protocol: 'sasl_ssl';
      readonly mechanism: 'scram-sha-256' | 'scram-sha-512';
      readonly secretRefs: { readonly username: string; readonly password: string };
    };

export type ExternalEventBusConfig = {
  readonly kind: 'kafka';
  readonly mode: 'external';
  readonly brokers: readonly string[];
  readonly topicPrefix?: string;
  readonly security?: ExternalEventBusSecurity;
};
```

The previous open `secretRefs: Record<string, string>` shape is replaced — pre-stable, no production users.

Plan validators in `plan.ts`:
- `protocol === 'sasl_ssl'` requires both `secretRefs.username` and `secretRefs.password` non-empty → otherwise `DEPLOY_PLAN_EVENT_BUS_SASL_INCOMPLETE`.
- `mechanism` must be `scram-sha-256` or `scram-sha-512` → otherwise `DEPLOY_PLAN_EVENT_BUS_SASL_MECHANISM_UNSUPPORTED`.

Render → env in `deploy-dokploy/src/render.ts` for domain-service and integration-module workloads:

```
RNTME_EVENT_BUS_BROKERS = <brokers joined by ",">
RNTME_EVENT_BUS_PROTOCOL = <plaintext | sasl_ssl>
[ if sasl_ssl ]
  RNTME_EVENT_BUS_MECHANISM = <scram-sha-256 | scram-sha-512>
  RNTME_EVENT_BUS_USERNAME  = <secret>  (Dokploy secret ref)
  RNTME_EVENT_BUS_PASSWORD  = <secret>
[ if topicPrefix ]
  RNTME_EVENT_BUS_TOPIC_PREFIX = <prefix>
```

### 8.2 `EdgeMiddleware` — `kind: "auth"`

`packages/deploy/deploy-core/src/edge.ts`:

```ts
export type EdgeMiddleware =
  | { kind: 'request-context'; ... }
  | { kind: 'rate-limit';      ... }
  | { kind: 'body-limit';      ... }
  | { kind: 'timeout';         ... }
  | {
      readonly mountTarget: string;
      readonly name: string;
      readonly kind: 'auth';
      readonly provider: 'auth0';
      readonly audience: string;
      readonly moduleSlug: string;
      readonly policy: string;
      readonly config: Record<string, never>;
    };

const supportedMiddlewareKinds = new Set([
  'request-context', 'rate-limit', 'body-limit', 'timeout', 'auth',
]);
```

`policy` is kept at literal `"default"` for shape consistency with other middleware kinds; `config` is intentionally empty for v1 (no policy fields — audience/moduleSlug live on the kind itself).

Validator in `planMiddleware`:
- `provider !== 'auth0'` → `DEPLOY_PLAN_AUTH_UNSUPPORTED_PROVIDER`.
- empty `audience` or `moduleSlug` → `DEPLOY_PLAN_AUTH_MISSING_FIELDS`.
- no `integration-module` workload with `serviceSlug === moduleSlug` in the plan → `DEPLOY_PLAN_AUTH_MODULE_WORKLOAD_MISSING`.

### 8.3 Edge Nginx render — auth = noop

`deploy-dokploy/src/nginx.ts` does not emit any nginx block for `kind: "auth"`. A one-line metadata comment is added near the route block for readability:

```
# auth middleware: provider=auth0, audience=<audience>
# - delegated to runtime via identity module RPC; edge does not validate JWT
```

### 8.4 Domain-service env — auth wiring

`deploy-dokploy/src/render.ts`, in the domain-service branch of `renderResource`, after eventBus env:

```ts
const authMw = plan.edge.middleware.find((m) =>
  m.kind === 'auth' && routesMountedOnTarget(m.mountTarget, workload, plan.edge.routes),
);
if (authMw && authMw.kind === 'auth') {
  const moduleResourceName = dokployResourceName(plan.project.orgSlug, plan.project.projectSlug, authMw.moduleSlug);
  env.push(
    { name: 'RNTME_AUTH_PROVIDER',        value: authMw.provider,                  secret: false },
    { name: 'RNTME_AUTH_AUDIENCE',        value: authMw.audience,                   secret: false },
    { name: 'RNTME_AUTH_MODULE_SLUG',     value: authMw.moduleSlug,                 secret: false },
    { name: 'RNTME_AUTH_MODULE_ENDPOINT', value: `${moduleResourceName}:50051`,     secret: false },
  );
}
```

`50051` is the convention port for integration-module gRPC; literal in render code is acceptable for the MVP.

### 8.5 identity-auth0 module deploy config

User supplies via `ProjectDeploymentConfig.modules`:

```ts
modules: {
  'identity-auth0': {
    image: 'ghcr.io/rntme/identity-auth0:0.1.0',
    expose: false,
    env: { AUTH0_DOMAIN: 'demo-rntme.us.auth0.com' },
    secretRefs: {},
  },
},
```

`expose: false` keeps the module off the edge gateway. Mgmt creds are intentionally absent.

Validator: when `provider="auth0"` is mounted as auth middleware and the matching integration-module workload exists, the workload's env must contain `AUTH0_DOMAIN` non-empty → otherwise `DEPLOY_PLAN_AUTH_MODULE_ENV_INCOMPLETE`.

### 8.6 No new policy fields

`DeploymentPolicyConfig` is not extended with an `auth` map — auth middleware is fully configured by the kind itself.

## 9. UI auth-shell

### 9.1 New package

`packages/ui-auth-shell/` (`@rntme/ui-auth-shell`):

```
src/
  index.ts          # exports mountAuthenticatedApp
  auth0-client.ts   # @auth0/auth0-spa-js init + token API
  transport.ts      # fetch wrapper with Bearer injection + 401 handling
  chrome.ts         # vanilla-DOM login/logout chrome
  config.ts         # AuthShellConfig type + parser
  types.ts
test/unit/
  transport.test.ts
  auth0-client.test.ts
  config.test.ts
```

`peerDependencies`: `@rntme/ui-runtime`. `dependencies`: `@auth0/auth0-spa-js@^2.x`.

### 9.2 API

```ts
export type AuthShellConfig = {
  auth0: {
    domain: string;
    clientId: string;
    audience: string;
    redirectUri: string;
    scope?: string;             // default "openid profile email"
  };
  runtime: {
    manifestUrl: string;
    target: HTMLElement;
  };
};

export type MountResult = { unmount: () => void };

export function mountAuthenticatedApp(config: AuthShellConfig): Promise<MountResult>;
```

`getAccessToken()` is **not** exposed. The token lives only inside the transport closure (R4).

### 9.3 Token lifecycle

In-memory only (no localStorage, no cookies). On mount: if URL has `?code=...`, run `auth0Client.handleRedirectCallback()`. Else if `auth0Client.isAuthenticated()`, fetch token via `getTokenSilently()` and mount ui-runtime. Otherwise render login chrome. On 401 from any API call: unmount ui-runtime, render login chrome with "Session expired, please sign in again". No silent renew via iframe.

### 9.4 Transport wrapper

```ts
export function createAuthedTransport(opts: {
  baseFetch: typeof fetch;
  getToken: () => string | null;
  on401: () => void;
}): typeof fetch {
  return async (input, init) => {
    const token = opts.getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set('authorization', `Bearer ${token}`);
    const response = await opts.baseFetch(input, { ...init, headers });
    if (response.status === 401) {
      opts.on401();
      throw new Error('UI_AUTH_SHELL_UNAUTHENTICATED');
    }
    return response;
  };
}
```

The throw on 401 prevents the failure body from leaking into ui-runtime data-state.

### 9.5 Initial data-state injection

```ts
const claims = await auth0Client.getIdTokenClaims();
const initialState = {
  currentUser: {
    sub:   claims.sub,
    email: claims.email ?? null,
    name:  claims.name  ?? null,
  },
};
mountUiRuntime({
  manifestUrl: config.runtime.manifestUrl,
  target: config.runtime.target,
  transport: authedTransport,
  initialState,
});
```

`currentUser.sub` from the ID-token's `sub` claim equals the `user_id` returned by IntrospectSession on the server side — guaranteed by OIDC spec, no cross-validation needed. ui-runtime treats `currentUser` as a readonly key (action dispatchers cannot overwrite).

### 9.6 Login chrome

Vanilla DOM; no React/Vue dependency. Two layouts:

- **Anon:** title, blurb, "Sign in" button (calls `loginWithRedirect`).
- **Authed:** topbar with `currentUser.email` + "Logout" button (calls `logout({logoutParams:{returnTo: redirectUri}})`); ui-runtime mounted in the body.

Inline minimal CSS in the shell bundle. Independent of ui-runtime CSS.

### 9.7 ui-runtime extensions

Three small changes:

1. `bootstrap` accepts `transport?: typeof fetch` and `initialState?: Record<string, unknown>`. Internal fetch call sites use the injected transport; initial data-state is seeded; readonly keys are protected.
2. SPA `index.html` (the esbuild target) replaced with a shell-mount entrypoint that reads `window.__RNTME_AUTH_SHELL_CONFIG__` (populated from `/config.json`).
3. `app.js` entrypoint: `mountAuthenticatedApp({ ...cfg, runtime: { ...cfg.runtime, target: document.getElementById('root') } })`.

### 9.8 `/config.json` static asset

The deploy-dokploy render generates `/srv/config.json` for the domain-service workload (under the workload's generated files). The runtime serves it as a static asset on `GET /config.json` (a non-bindings, non-auth route). The shell loads it on mount before any authenticated request. Public values only (Auth0 `domain`, `clientId`, `audience`, `redirectUri`); no secrets.

### 9.9 Bundle budget

Target gzip total ≤ 100 kB: ui-runtime + shell (~10 kB) + `@auth0/auth0-spa-js` (~25 kB) + manifest. Going over is a signal to revisit, not a release blocker.

## 10. Risk register

| # | Risk | Where it surfaces | Mitigation |
|---|---|---|---|
| R1 | JWKS cold-start latency on first request after identity-auth0 start (~50–200 ms) | First API call after deploy | `jose.createRemoteJWKSet` lazy-fetch + 1 h cache. Optional: health check pre-warms JWKS before "ready" (XS in plan). |
| R2 | Clock drift between identity-auth0 host and Auth0 issuer | Spurious `JWTExpired` on fresh tokens | `clockTolerance: 30` in `jwtVerify`. NTP if Dokploy host drifts more. |
| R3 | identity-auth0 container crashed → all 4 endpoints reply 5xx | Any request after crash | Dokploy auto-restart on failure. Domain-service retry/timeout in `ExternalAdapterClient`. UI surfaces "service unavailable". |
| R4 | Access-token leakage into logs / `paramsFromState` | Any careless screen-spec | Architectural: shell does not expose `getAccessToken()`; token lives in transport closure. ui-runtime never sees it through state. Code review pre-merge. |
| R5 | `ownerSub: "system"` collides with a real user | Never (Auth0 sub always contains `\|`) | Documented in seed comment + spec note. |
| R6 | Existing graphs use unrecognized expression-ref after `$pre` extension | `product-catalog-project` fixtures | Additive. Test: every existing fixture compiles after change. |
| R7 | `pre[]` on queries adds ~50–100 ms to each GET (gRPC roundtrip) | listNotes / getNote | Acceptable for the demo. Production-shape optimisation (per-request session cache in bindings-http) is a separate spec. |
| R8 | UX: 401 → unmount looks like a crash | Token expiry mid-session | Shell unmount → re-render login chrome with "Session expired" message. Not a black screen. |
| R9 | `audience` mismatch between project.json and bindings.json | Manual edit drift | Cross-artifact validator emits `BLUEPRINT_AUTH_AUDIENCE_MISMATCH`. Must-have in plan. |
| R10 | Auth0 SPA app configured as Implicit Grant (legacy) instead of Authorization Code + PKCE | First login fails "unsupported response type" | Plan walkthrough explicitly: Application Type = SPA, Grant Types = Authorization Code + Refresh Token. |
| R11 | RedirectUri in Auth0 dashboard does not match shell config | Auth0 returns "Callback not allowed" | Plan walkthrough fixes the exact URL string with screenshot/inline steps. |
| R12 | PII (email, name) in `Session.vendor_raw.claims` leaks into server-access logs | `LOG_LEVEL=debug` | `pickPublicClaims` whitelist on identity-auth0 side; `bindings-http` masks `vendor_raw.claims.*` in pre-result logs. Single mask helper. |
| R13 | identity-auth0 runs without Mgmt creds (by design) → noisy logs | Container logs | Lazy Mgmt SDK init; first Mgmt call returns `IDENTITY_CONFIG_MGMT_NOT_CONFIGURED` without periodic noise. **In scope.** |
| R14 | Auth0 SPA `clientId`/`audience` exposed in `/config.json` | Anyone with dev tools | **Not a risk** — public values per OIDC. SPA app has no client_secret (PKCE replaces it). |
| R15 | Redpanda Cloud SASL credentials leaked through Dokploy MCP `application-one` | Any MCP call | Per memory `dokploy_mcp_leaks_secrets.md`: do not paste responses to shared contexts. Rotate Redpanda Cloud user creds after deploy. |

### 10.1 Hard-gate "success"

The 6 gates from `2026-04-27-notes-demo-e2e-design.md` §5.3, plus a 7th:

7. Logged-in user A can create a note and see it. Logged-in user B (a different Auth0 account) sees it in the list (read-all) but cannot delete it: `POST /api/notes/<a-id>/actions/delete` returns 404. User A deletes it successfully.

Any gate false → not a success. Open follow-up.

### 10.2 No rollback

Phase-3 changes (deploy library extensions, runtime SASL/auth env consumption, blueprint update) on a pre-stable platform are needed regardless of whether the demo run succeeds. If Phase 6 deploy fails: the deployment row stays in the DB as `failed`/`succeeded_with_warnings` — history, not broken state. Re-clicking Deploy is idempotent. If Phase 1–5 code lands but Phase 6 fails — code is correct independent of the deploy outcome; we do not revert it.

## 11. Documentation touches

| File | Change | What |
|---|---|---|
| `CLAUDE.md` "Architecture in one paragraph" | small edit | Add one phrase covering auth-middleware + identity-module participation. |
| `AGENTS.md` how-tos / glossary | add | New how-to: "wire Auth0 (or other OIDC vendor) into a project blueprint" — points at this spec's §5–§9. Glossary: auth-middleware, `$pre` directive, audience. |
| `README.md` packages table | edit | Add `@rntme/ui-auth-shell`. Update dep graph. |
| Per-package READMEs (10 packages) | edit | identity-auth0, contracts-identity-v1, bindings, bindings-http, runtime, deploy-core, deploy-dokploy, graph-ir-compiler, ui-auth-shell (new), blueprint. Each: File map / API / Invariants & gotchas / Where to look first / Specs. |
| `demo/notes-blueprint/README.md` | rewrite | Production-shape demo, login flow, ownership semantics, link to this spec. |
| `vision.md` | none | Not buyer-facing. |
| `docs/architecture.md` | none | Architecture unchanged; auth-middleware is a natural extension. |
| `docs/history/specs/active-rationale/2026-04-29-notes-demo-auth0-design.md` | new | This document. |
| `docs/history/plans/historical/2026-04-29-notes-demo-auth0.md` | new | Implementation plan. |

All doc changes ride in the same PRs as the corresponding code (CLAUDE.md mandate).

## 12. Plan split

One plan: `docs/history/plans/historical/2026-04-29-notes-demo-auth0.md`. Seven phases. Phases 1–4 are independent and can run in parallel; Phase 5 depends on all four; Phase 6 follows; Phase 7 wraps up.

**Phase 1 — Contract + identity-auth0 IntrospectSession.** §6 changes. Deliverable: `pnpm -F @rntme/identity-auth0 test` green; mock-conformance scenarios pass; R13 lazy Mgmt init verified.

**Phase 2 — Bindings + graph IR.** §7 changes. Deliverable: `pnpm -r run test` green including existing `product-catalog-project` fixtures; new unit tests for query `pre[]` and `$pre`.

**Phase 3 — Deploy-core + deploy-dokploy.** §8 changes + runtime SASL/auth env consumption. Deliverable: rendered Dokploy plan for notes-blueprint with auth + identity-auth0 + sasl_ssl is correct (snapshot test); apply through mock client wires the right env.

**Phase 4 — UI auth-shell** (parallel to 1–3). §9 changes. Deliverable: `pnpm -F @rntme/ui-auth-shell test` green; manual smoke in a local browser against a dev Auth0 tenant — login redirect works.

**Phase 5 — Notes blueprint update** (after 1–4). §5 changes. Deliverable: `loadComposedBlueprint('demo/notes-blueprint')` returns ok.

**Phase 6 — External setup + deploy.** Auth0 dashboard manual setup (custom API audience, SPA application, allowed callback/logout URLs/web origins, refresh-token rotation). Redpanda Cloud SASL user with produce/consume ACLs for the topic prefix. Dokploy secrets. `rntme project publish demo/notes-blueprint`. Deploy-target update or create. Click Deploy → poll until `succeeded`.

**Phase 7 — Smoke check + recording.** Hard-gate from §10.1 (7 points). Memory record `notes_demo_auth0_deployed.md`: deploymentId, date, edge URL, Auth0 tenant, Redpanda Cloud cluster id (no creds), Dokploy project, open issues.

```
Phase 1 ┐
Phase 2 ├── parallel
Phase 3 ┘
Phase 4 (parallel to 1–3)
   │
   ▼
Phase 5
   │
   ▼
Phase 6 ── manual external-setup steps may start in parallel with Phase 5
   │
   ▼
Phase 7
```

## 13. Out-of-scope follow-ups

- Operaton BPMN workload + integration in the demo (separate spec).
- Redpanda as a provisioned Dokploy container (separate spec).
- Edge-side auth sidecar (Q2 option A) — only if JWKS load needs to leave runtime.
- Silent token renew / refresh-token rotation in the shell.
- E2E browser-test automation.
- Live-conformance tests for IntrospectSession in identity-auth0 (real Auth0 sandbox tenant).
- Conditional rendering "hide Delete if not owner" in ui-runtime.
- Multi-vendor IDP support in auth-shell (`provider: clerk`, `workos`).
- Per-request session caching in bindings-http to avoid one IntrospectSession RPC per query.
