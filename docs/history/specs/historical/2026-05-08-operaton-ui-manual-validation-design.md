> Status: historical.
> Date: 2026-05-08.
> Current source: docs/current/**, docs/decision-system.md, .dependency-cruiser.cjs, current code/tests, merged PR #168, and main evidence at 7c4164ac8a44bb4caafbd2ce7b7581c2d5ae6fea or newer.
> Why retained: Historical rationale for implemented manual access to provisioned Operaton UI during BPMN/workflow runtime validation; not current-state truth by itself.

# Operaton UI manual validation access - design

## Problem

Provisioned BPMN projects already deploy Operaton and a `bpmn-worker`, but
`@rntme/deploy-dokploy` renders Operaton as an internal-only Dokploy Compose
resource on `dokploy-network`. That is correct for runtime safety, but it leaves
operators without a repo-defined way to open Operaton webapps while manually
validating BPMN definitions, process instances, external tasks, and workflow
runtime behavior.

The design needs to expose a human inspection surface without turning Operaton
REST/UI into an accidental public API, leaking credentials into rendered plans,
or coupling workflow validation access to blueprint/service routes.

## Goals

- Add an explicit, target-level opt-in for manual Operaton UI access.
- Keep provisioned Operaton internal by default.
- Protect every public Operaton UI request at an outer auth boundary before it
  reaches the engine.
- Keep all access credentials and Operaton admin credentials out of rendered
  plans, apply results, deployment logs, docs, and issue comments.
- Preserve the current BPMN deploy flow: project workflow artifact ->
  deploy-core workflow plan -> Dokploy Operaton Compose + BPMN worker.
- Make smoke verification prove that unauthenticated public access is rejected.

## Non-goals

- No BPMN modeler authoring UI.
- No project-blueprint artifact change for UI access.
- No generic admin console exposure for Redpanda or other infrastructure.
- No replacement for Operaton's own webapp authentication/authorization.
- No direct public domain on the Operaton Compose service.
- No production public API for `/engine-rest`; this is manual validation access
  for operators.

## Current context checked

- `docs/decision-system.md`: BPMN is locked as the standard for cross-service
  async, Operaton is the current-default BPMN engine, Dokploy is the current
  deploy default, and inspectability is a north-star goal.
- `docs/current/owners/packages/deploy/deploy-core.md` and
  `packages/deploy/deploy-core/src/workflows.ts`: workflow projects require a
  provisioned Kafka bus, provisioned Operaton config, and a BPMN worker image.
  Planning produces `workflowEngine.internalBaseUrl` and the `bpmn-worker`
  workload.
- `docs/current/owners/packages/deploy/deploy-dokploy.md` and
  `packages/deploy/deploy-dokploy/src/workflow-render.ts`: Operaton renders as
  a Compose resource attached to `dokploy-network`; it is not public. The worker
  gets `RNTME_OPERATON_BASE_URL` and workflow file mounts.
- `apps/platform-http/src/deploy/dokploy-client-factory.ts`: current Dokploy
  client attaches domains only for application ingress. Compose resources are
  created/updated/deployed, but no compose-domain path is implemented.
- `packages/platform/platform-core/src/schemas/deploy-target.ts`: deploy target
  workflow config currently contains only `engine` and `worker`.
- `apps/platform-http/src/routes/target-secrets.ts`: target secrets are named,
  schema-validated, encrypted, and never returned by GET.
- `packages/runtime/bpmn-worker/src/operaton-rest.ts` and `env.ts`: the worker
  talks to Operaton REST under `/engine-rest`, with bounded HTTP calls.
- Dokploy docs via Context7: Dokploy domains map a host/path to a service name
  and container port; application Traefik config routes to an app service.
- Operaton docs via Context7: Docker examples expose port `8080`; REST defaults
  to `/engine-rest`; webapps support configurable application path; webapp auth
  is enabled by default and CSRF protection is documented for webapps.

## Decision-system fit

- **G3 / F4 Inspectability:** exposing a protected Operaton UI directly helps
  humans inspect process runtime state without reading JSON artifacts.
- **G1 / F6 Repeatability:** access is target config plus named target secrets,
  not an ad hoc port-forward. Identical target inputs produce the same rendered
  validation gateway shape.
- **G4 / F1 Lean core:** this is deploy-target infrastructure around the
  existing workflow engine, not a new blueprint core artifact.
- **G5 / F2 Canonical-way:** reuse the existing deployment target, target
  secrets, Dokploy adapter, and smoke-verifier surfaces.
- **F3 Contract boundary:** no vendor SDK type crosses into contracts; Dokploy
  API details stay in the Dokploy adapter/client seam.
- **F5 LLM-authorability:** strict deploy-target schema and codified error
  codes make missing domain/secret/image states fixable by agents.
- **F8 Standards/libraries:** rely on Dokploy domains/Traefik, Nginx basic auth
  gateway behavior, and Operaton's documented webapps/REST paths.

Applicable locked/current bets: **BPMN as the standard for cross-service async;
choreography forbidden** (`locked`), **Operaton as BPMN engine** (`current-default`),
**Dokploy for deploy** (`current-default`), **Provisioner contract** (`locked`),
**Layering enforced by dependency-cruiser** (`locked`). This spec does not
contradict any locked bet and does not require a Goal/Filter/Bet change.

## Proposed design

### 1. Target-level opt-in config

Extend deploy target workflow config with an optional validation UI block:

```ts
workflows: {
  engine: {
    kind: 'operaton',
    mode: 'provisioned',
    image: string,
    adminUserSecretRef?: string
  },
  worker: { image: string },
  operatonUi?: {
    enabled: true,
    publicBaseUrl: string,
    auth: { kind: 'basic', secretRef: string },
    allowedCidrs?: readonly string[]
  }
}
```

Default is disabled. `publicBaseUrl` is required when enabled; the platform
must not derive and publish an Operaton UI domain implicitly. DNS remains an
operator responsibility, as it is for project public ingress.

`allowedCidrs` is optional defence in depth. When present, the gateway returns
`403` before Basic Auth for non-matching source ranges. The MVP may defer CIDR
matching if the implementation cannot verify real client IP handling behind
Dokploy/Traefik; if deferred, keep the schema out until implemented.

### 2. Target secret schemas

Add target-secret schemas:

- `operaton-ui-basic-auth-v1`: stores an htpasswd-compatible line or file
  content for the outer gateway. Operators generate this locally; plaintext
  passwords are never accepted.
- `operaton-admin-user-v1`: stores Operaton admin user properties such as
  `{ "id": "...", "password": "..." }` when the target wants rntme to configure
  the provisioned Operaton container instead of relying on a pre-hardened image.

Secret values are decrypted only inside the platform deploy executor/client
boundary. They must never be added to `ProjectDeploymentPlan`,
`RenderedDokployPlan`, apply results, verification reports, or deployment logs.

### 3. Deploy-core plan shape

`@rntme/deploy-core` should keep workflow UI access target-neutral:

- validate that `operatonUi.enabled` appears only with provisioned Operaton;
- validate non-empty `publicBaseUrl` and non-empty auth `secretRef`;
- carry a planned `workflowEngine.uiAccess` block containing the public URL,
  auth kind, secret ref name, and optional CIDR list;
- carry `adminUserSecretRef` as a secret reference, not a secret value.

Suggested errors:

- `DEPLOY_PLAN_WORKFLOWS_UI_REQUIRES_OPERATON`
- `DEPLOY_PLAN_WORKFLOWS_UI_PUBLIC_URL_MISSING`
- `DEPLOY_PLAN_WORKFLOWS_UI_AUTH_SECRET_MISSING`
- `DEPLOY_PLAN_WORKFLOWS_OPERATON_ADMIN_SECRET_MISSING`

### 4. Dokploy rendering

Keep the Operaton engine as an internal Compose resource. Add a separate
Dokploy application resource, for example logical id `operaton-ui-gateway`,
only when `workflowEngine.uiAccess` is present.

The gateway:

- uses `nginx:1.27-alpine` or another already-approved small reverse-proxy
  image;
- mounts a generated `nginx.conf`;
- proxies all paths to `http://<operaton-resource>:8080`;
- applies `auth_basic` using a secret htpasswd file;
- optionally applies CIDR allow/deny rules if `allowedCidrs` ships;
- gets public ingress at `operatonUi.publicBaseUrl`;
- does not create project edge routes and does not alter blueprint route
  planning.

The existing Dokploy application domain path is the preferred implementation
because the current client already supports application domains. Direct compose
domains are not part of the MVP.

### 5. Secret handoff

Extend the rendered/apply model with redacted secret references rather than
values, for example:

```ts
secretFiles: {
  '/etc/nginx/.htpasswd': {
    schema: 'operaton-ui-basic-auth-v1',
    secretRef: 'operatonUiBasicAuth',
    field: 'htpasswd'
  }
}
secretEnv: {
  OPERATON_BPM_ADMIN_USER_ID: {
    schema: 'operaton-admin-user-v1',
    secretRef: 'operatonAdmin',
    field: 'id'
  },
  OPERATON_BPM_ADMIN_USER_PASSWORD: {
    schema: 'operaton-admin-user-v1',
    secretRef: 'operatonAdmin',
    field: 'password'
  }
}
```

Exact Operaton property/env names must be verified against Operaton docs/source
at implementation time. If env binding is not documented enough, mount a
generated `application.yaml` through the same redacted secret-file mechanism
instead.

`@rntme/deploy-dokploy` should remain structurally leak-resistant: render
accepts only refs, and the injected platform Dokploy client resolves refs from
encrypted target secrets while performing Dokploy calls. Apply errors must
continue using the existing redaction path before persistence.

### 6. Platform and CLI

Platform:

- validate the new deploy target workflow fields in `platform-core`;
- add target-secret parsers for the two schemas;
- during deployment, fail before apply when an enabled UI references a missing
  target secret;
- keep `GET /deploy-targets/:slug/secrets` value-free.

CLI:

- support JSON patch via existing `target set-config`;
- optionally add ergonomic flags later:
  `--operaton-ui-url`, `--operaton-ui-basic-auth-secret`,
  `--operaton-admin-secret`.

The first implementation does not need a CLI command that accepts plaintext
passwords.

### 7. Verification

When UI access is enabled, smoke verification adds:

- `operaton-ui-auth-required`: `GET <publicBaseUrl>/` without auth returns
  `401`;
- `operaton-ui-invalid-auth-rejected`: `GET <publicBaseUrl>/` with a malformed
  or invalid Basic credential returns `401`;
- `operaton-ui-no-secret-leak`: deployment logs/apply result contain only
  secret refs/redacted markers, never htpasswd/admin values.

Authenticated browsing remains a manual SPEC/QA validation step because the
platform should not store or replay plaintext Basic Auth passwords.

## Alternatives rejected

- **Attach a public domain directly to the Operaton Compose service.** Dokploy
  supports service-name/port domain concepts, but the current rntme client seam
  exposes domains through application ingress. Direct compose exposure also
  makes it easier to bypass an outer auth boundary.
- **Route Operaton through the project edge gateway.** This mixes deploy
  infrastructure with blueprint/service public routes and risks making engine
  access look like part of the product surface.
- **SSH tunnel or local port-forward runbook only.** Useful as an emergency
  fallback, but not repeatable, not target-configured, and not visible in deploy
  evidence.
- **Expose the UI by default for every workflow target.** Violates least
  exposure. Manual validation access must be explicit and removable.
- **Store plaintext validation passwords in deploy target config.** Violates
  the existing target-secret model and would leak through rendered config,
  audit, CLI, or logs.

## Docs touch

Implementation should update:

- `docs/current/owners/packages/deploy/deploy-core.md` for the planned
  `workflowEngine.uiAccess` model and error codes.
- `docs/current/owners/packages/deploy/deploy-dokploy.md` for the
  `operaton-ui-gateway` resource, domain, and secret-ref rendering.
- `docs/current/owners/packages/platform/platform-core.md` for deploy target
  schema and target-secret schema ownership.
- `docs/current/owners/packages/platform/platform-storage.md` only if storage
  columns or encryption behavior changes. The preferred path reuses existing
  target secrets.
- `docs/current/owners/apps/platform-http.md` for executor ordering,
  pre-apply secret validation, and smoke checks.
- `docs/current/owners/apps/cli.md` if CLI flags are added; JSON patch-only
  support can be documented as a target patch example.

No `docs/decision-system.md` update is needed because this uses current
Goals/Filters/Bets without contradiction.

## Validation and evidence

Evidence gathered for this spec:

- Current docs and code confirm Operaton is internal-only today and the worker
  uses the internal `RNTME_OPERATON_BASE_URL`.
- Current Dokploy client code confirms application domains exist in the rntme
  adapter, while compose domains are not implemented.
- Current platform target-secret routes confirm encrypted write/list-without-
  value behavior already exists.
- Operaton docs confirm Docker port `8080`, default REST path `/engine-rest`,
  configurable webapp path, default webapp authentication, and CSRF protection.
- Dokploy docs confirm domain mapping to service name and port.

Acceptance gates for implementation:

- Unit tests for deploy-target schema parsing and target-secret schema parsing.
- Deploy-core tests for disabled default, enabled UI plan, missing URL, missing
  secret ref, non-workflow/no-Operaton rejection, and no secret values in plan.
- Deploy-dokploy render tests for gateway app/domain, generated nginx config,
  secret-file refs, optional CIDR rules, and unchanged internal Operaton worker
  URL.
- Platform executor/client tests proving missing secret fails before apply and
  decrypted secret values are not present in logs, rendered plan, apply result,
  or verification report.
- Smoke-verifier tests for unauthenticated and invalid-auth `401`.
- `pnpm -F @rntme/deploy-core test`, `pnpm -F @rntme/deploy-dokploy test`,
  `pnpm -F @rntme/platform-core test`, relevant platform-http tests, and
  `pnpm depcruise`.

## Risks

- Dokploy domain behavior for applications is implemented in current rntme
  code, but compose-domain behavior is not. Keeping the UI gateway as an
  application avoids depending on an unmodeled compose API.
- Basic Auth protects the outer gateway but does not replace Operaton's own
  webapp auth. Operators still need valid Operaton users.
- If Operaton admin configuration cannot be safely expressed through documented
  env/property binding, implementation should mount a generated application
  config through the same secret-ref mechanism.
- CIDR allowlists may be unreliable unless the gateway receives the real client
  IP from Dokploy/Traefik. Ship CIDR support only after verifying headers and
  trust boundaries in integration tests.
- The gateway intentionally exposes `/engine-rest` behind auth because Operaton
  webapps and manual validation may need same-origin REST calls. This must not
  be documented as a product API.
