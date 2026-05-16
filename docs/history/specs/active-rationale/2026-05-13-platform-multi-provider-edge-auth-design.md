> Status: active-rationale.
> Date: 2026-05-13.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Recent Superpowers design rationale preserved during project cleanup; it is not current-state truth by itself.

# Platform Multi-Provider Edge Auth Design

Date: 2026-05-13

## Status

Brainstorming-approved design, written for user review. Implementation plan has
not been written yet.

## Context

The `cv-extract-platform-client-deploy-e2e` goal delivered the local
implementation slices for platform-client publish/deploy, but live T012 stopped
at the deployed platform edge:

- The CLI sends `Authorization: Bearer rntme_pat_*`.
- The deployed nginx `auth_request` middleware calls only
  `identity-auth0` HTTP introspection.
- `identity-auth0` validates Auth0/OIDC JWTs only.
- New platform native handlers behind `/api/projects`,
  `/api/deployments`, and `/api/deployments/targets` expect platform PATs via
  `ApiTokenProvider`, but the request never reaches those handlers.

A partial local A-full attempt exists on top of `origin/main`:

- `dbdec34c` adds `introspectPath` and `introspectPort` fields.
- `9b30f01d` lets `platform-tokens` target a domain service in planning and
  nginx rendering.
- `c365b6fe` flips the platform blueprint to `platform-tokens`.

Those commits are not a complete fix. `c365b6fe` is unsafe to push alone:
it points live auth at a tokens endpoint that does not yet satisfy the edge
introspection contract. Local exploration also found another gap: after the
flip, deploy-bundle-input treats `tokens` as a runtime module and fails with
`DEPLOY_BUNDLE_MODULE_PROTO_UNKNOWN:tokens`. The final design must replace or
amend this partial stack rather than publish it as-is.

## Decision

Implement first-class multi-provider edge auth. The platform API keeps edge
auth on protected routes, but the middleware can authorize through an ordered
set of providers. The platform uses this to accept both:

- platform PATs through the platform `tokens` domain service; and
- Auth0 browser JWTs through `identity-auth0`.

This is the target scalable solution for the blocker. It rejects quick fixes
that would unblock only the immediate CLI smoke at the cost of a weaker
architecture.

## Explicitly Rejected Quick Fixes

- Do not remove `auth` middleware from `/api/projects`, `/api/deployments`, or
  `/api/deployments/targets`.
- Do not make `identity-auth0` understand platform PATs through a callback to
  platform internals.
- Do not add a one-off sidecar container solely to proxy PAT introspection.
- Do not ship `c365b6fe` until the full edge-auth provider contract, routing,
  runtime, and introspection response pieces exist and are verified.

These shortcuts already resemble the pattern that led to the current blocker:
one layer appears unblocked while adjacent runtime contracts remain incoherent.

## Goals

- Preserve edge auth as the public ingress boundary for protected platform API
  routes.
- Let one protected API route accept either CLI PATs or browser Auth0 JWTs.
- Keep provider validation behind explicit provider-specific components.
- Make the edge auth provider contract inspectable in blueprint and deploy
  plan artifacts.
- Fail invalid provider wiring at parse, composition, or deploy planning time,
  not after deployment.
- Keep route paths in generated runtime artifacts consistent with project-level
  public routes.
- Keep native operation bindings valid at runtime startup without requiring
  nonexistent Graph IR files.

## Non-Goals

- A generalized identity broker service with its own domain model.
- A new public deploy-adapter or identity-provider module contract.
- A backwards-compatible schema migration for legacy auth middleware shapes.
  The repo is pre-stable; existing platform blueprint artifacts can move to the
  new shape directly.
- Reworking browser login UX or CLI login/token issuance.

## Blueprint Auth Shape

`project.json#middleware.<name>` for `kind: "auth"` should use ordered
providers:

```json
{
  "middleware": {
    "auth": {
      "kind": "auth",
      "providers": [
        {
          "provider": "platform-tokens",
          "moduleSlug": "tokens",
          "introspectPath": "/api/tokens/introspect",
          "introspectPort": 3000
        },
        {
          "provider": "auth0",
          "audience": "${AUTH0_AUDIENCE}",
          "moduleSlug": "identity-auth0"
        }
      ]
    }
  }
}
```

Provider rules:

- `auth0` requires `audience` and an integration-module workload whose manifest
  declares `capabilities.edgeAuth`.
- `platform-tokens` requires a domain-service workload and explicit
  `introspectPath` plus `introspectPort`.
- `platform-tokens` does not require an OAuth audience.
- Provider order is meaningful. The platform should try PAT first, then Auth0,
  because CLI traffic is machine-authenticated and PAT rejection is cheap.

The old single-provider fields (`provider`, `audience`, `moduleSlug`) should be
removed from the platform blueprint instead of kept as a second authoring form.

## Deploy Plan And Nginx Rendering

`deploy-core` should plan one auth middleware with an ordered provider list.
Each planned provider carries:

- provider kind;
- target workload/service slug;
- HTTP introspection path;
- HTTP introspection port;
- optional audience;
- index for precise diagnostics.

`deploy-dokploy` should render a real OR-chain. For a protected route:

1. nginx calls provider 0 through an internal location.
2. A `200` from any provider accepts the request.
3. A `401` falls through to the next provider.
4. The last `401` returns the canonical runtime auth body:
   `{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}`.
5. Provider error bodies are never exposed by protected routes.

On success, nginx forwards:

- the original `Authorization` header;
- `X-Rntme-User-Sub`;
- `X-Rntme-User-Audience`;
- `X-Rntme-Session-Status`.

The Auth0 provider continues to receive `X-Rntme-Audience`. The
`platform-tokens` provider does not.

## Platform Tokens Introspection

The `tokens` domain service becomes a first-class edge auth provider for
platform PATs. It exposes:

```text
GET /api/tokens/introspect
Authorization: Bearer rntme_pat_...
```

The service-local binding can stay authored as `/introspect`; the deployed
runtime artifact should carry the project-routed path, matching the binding
registry and the provider's `introspectPath`.

Success response:

- HTTP `200`;
- empty body;
- `X-Rntme-User-Sub`;
- `X-Rntme-User-Audience`;
- `X-Rntme-Session-Status: ACTIVE`.

Failure response:

- HTTP `401`;
- JSON body with a platform auth code, for direct diagnostics when called
  outside nginx.

`X-Rntme-User-Sub` should be stable and non-secret. A good value is the
authenticated platform account id. `X-Rntme-User-Audience` should use a stable
non-OAuth value such as `urn:rntme:platform-tokens`, not an empty string, so
downstream header structure is consistent.

The handler delegates to the existing `ApiTokenProvider` / `introspectToken`
logic. Downstream native handlers still authenticate with `ApiTokenProvider` for
defense in depth and tenancy checks.

## Bindings Response Headers

`@rntme/bindings` response shapes need a header contract for custom responses.
The minimal shape is:

```json
{
  "response": {
    "onOk": {
      "json": null,
      "headers": {
        "X-Rntme-User-Sub": "$result.subject.account.id",
        "X-Rntme-User-Audience": "urn:rntme:platform-tokens",
        "X-Rntme-Session-Status": "ACTIVE"
      }
    },
    "onErr": {
      "json": { "code": "$error.code", "message": "$error.message" },
      "status": 401
    }
  }
}
```

The exact authoring shape can vary during planning, but it must support:

- static header values;
- expression-derived header values;
- ASCII-safe rendered header validation;
- status override for non-redirect JSON responses.

This is broader than the T012 need, but it belongs in the bindings contract
because HTTP response metadata is part of the artifact surface.

## Runtime Route Correctness

Project composition already derives project-routed paths such as
`/api/projects/{projectId}/versions` from service-local bindings like
`/{projectId}/versions`.

The deployed runtime artifacts must expose the same project-routed paths that
edge and clients call. Do not make nginx compensate with ad hoc rewrites as the
primary fix. Instead, deploy-bundle-input should materialize each domain
service's runtime `bindings.json` with public route prefixes applied for that
service:

- `projects` root binding `/` becomes `/api/projects`;
- `projects` publish binding `/{projectId}/versions` becomes
  `/api/projects/{projectId}/versions`;
- `tokens` introspection binding `/introspect` becomes
  `/api/tokens/introspect`, and the platform provider config uses that same
  path.

The design preference is consistency with the binding registry: runtime
artifacts should match the public project route paths unless a narrower runtime
mount contract is explicitly introduced.

## Native Operation Runtime

Native bindings currently validate through a synthetic signature, but runtime
startup still tries to compile all binding `graph` names into Graph IR
operations. Native-only bindings such as `publishProjectBundle` and
`startDeployment` do not have graph JSON files.

Runtime/bindings-http must treat `target.engine = "native"` as an operation
binding that:

- participates in HTTP extraction, validation, response rendering, OpenAPI, and
  idempotency;
- does not require or compile a Graph IR file;
- dispatches through `NativeOperationExecutor`;
- returns a clear startup or request-time error when the required native handler
  is absent.

This is required before live platform-client publish/deploy can be considered
reliable.

## Deploy-Bundle Module Wiring

Auth middleware provider slugs must not all become runtime gRPC module entries.
Only module-backed providers such as `identity-auth0` need canonical contract
proto wiring in `manifest.modules[]`.

`platform-tokens` is a domain service in the same project. It is reached by
nginx over HTTP for edge auth, not by Graph IR over a module gRPC contract.
Therefore deploy-bundle-input must skip it when collecting runtime module
targets from auth middleware.

Graph IR `call` nodes continue to drive module wiring for canonical modules,
including identity, AI/LLM, and storage.

## Data Flow

CLI PAT request:

1. CLI sends `Authorization: Bearer rntme_pat_*` to
   `https://platform.rntme.com/api/projects...`.
2. Edge invokes the auth provider chain.
3. Provider 0 calls `svc-tokens:3000/api/tokens/introspect` with the
   Authorization header.
4. Tokens handler validates through `ApiTokenProvider`.
5. Edge accepts the `200`, captures `X-Rntme-*`, and forwards to the target
   domain service.
6. The native handler validates the same PAT again and applies tenancy/scopes.

Browser Auth0 request:

1. Browser sends an Auth0 JWT.
2. `platform-tokens` returns `401` because the bearer is not a PAT.
3. The chain falls through to `identity-auth0`.
4. Auth0 HTTP introspection validates the JWT and returns the standard
   `X-Rntme-*` headers.
5. Runtime graph/native behavior continues behind the accepted edge request.

## Error Model

- Missing or invalid credentials across all providers return the canonical edge
  `401` body.
- Provider misconfiguration fails before deploy.
- Provider 5xx responses are deployment/runtime faults and should not be
  silently converted into authentication denial during smoke tests.
- Authenticated-but-forbidden platform actions remain handler-level structured
  errors, typically `PLATFORM_AUTH_FORBIDDEN`.
- No provider may leak secret values into rendered plans, nginx config,
  response bodies, logs, or docs.

## Tests

Add or update tests at these layers:

- Blueprint parse/composition:
  - accepts `providers[]`;
  - rejects `auth0` without audience;
  - accepts `platform-tokens` backed by a domain service;
  - rejects invalid provider targets with provider-indexed diagnostics.
- Deploy-core:
  - plans ordered providers;
  - preserves Auth0 `edgeAuth` behavior;
  - uses explicit path/port for `platform-tokens`;
  - rejects missing `platform-tokens` path/port.
- Deploy-dokploy:
  - renders an OR-chain;
  - falls through from provider 0 `401` to provider 1;
  - accepts the first provider `200`;
  - forwards `X-Rntme-*`;
  - returns canonical 401 when all providers fail.
- Bindings/bindings-http:
  - parses and validates response headers;
  - renders expression-derived headers;
  - rejects unsafe header names/values;
  - supports JSON status override.
- Runtime:
  - native bindings do not compile missing Graph IR files;
  - missing native handlers fail clearly;
  - project-routed runtime artifact paths are reachable.
- Platform blueprint:
  - `tokens` declares a service-local `GET /introspect` binding and the
    deployed runtime artifact exposes `/api/tokens/introspect`;
  - PAT introspection emits active headers;
  - invalid PAT returns `401`;
  - `toDeployCoreInput` does not request a proto for `tokens`.
- Live T012:
  - redeploy platform;
  - prove PAT reaches `/api/projects`;
  - rerun publish, target, deploy, smoke, and dashboard phases.

## Documentation Touch

Update:

- `docs/decision-system.md` with the first-class multi-provider edge auth
  decision and the rejection of quick auth bypasses for platform APIs.
- `docs/current/owners/packages/artifacts/blueprint.md` for `providers[]`.
- `docs/current/owners/packages/artifacts/bindings.md` for response headers.
- `docs/current/owners/packages/runtime/bindings-http.md` for response header
  rendering and native binding startup behavior.
- `docs/current/owners/packages/runtime/runtime.md` for native operation
  dispatch and project-routed HTTP artifact expectations.
- `docs/current/owners/packages/platform/deploy-bundle-input.md` for route
  prefix materialization and auth-provider module-wiring exclusions.
- `docs/current/owners/packages/deploy/deploy-core.md` for planned auth
  providers.
- `docs/current/owners/packages/deploy/deploy-dokploy.md` for nginx auth
  chains.
- `docs/current/owners/apps/platform.md` and
  `docs/current/owners/packages/platform/platform-core.md` for platform token
  edge introspection.
- `docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml` and T012 notes
  with the chosen architecture and rejected shortcuts.

No local README stub needs to change unless a public command hint or current-doc
link changes.

## Rollout

1. Leave `c365b6fe` unpushed or rewrite it as part of the final provider-list
   implementation.
2. Rework the existing two safe scaffolding commits if needed so they match the
   final `providers[]` contract rather than extending the old single-provider
   shape.
3. Land the contract/runtime changes with focused tests before changing the
   platform blueprint to use multi-provider auth.
4. Redeploy the platform only after local tests prove:
   - provider chain rendering;
   - tokens introspection response headers;
   - deploy-bundle-input does not wire `tokens` as a module proto;
   - native bindings start without missing graph files;
   - public route paths match runtime routes.
5. Resume T012 phases 2-7 and record live proof.
