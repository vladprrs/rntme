# Platform As Blueprint Design

Date: 2026-05-09

## Status

Approved design for user review. Implementation plans have not been written yet.

## Context

`apps/platform-http` currently owns too many platform responsibilities in one
hand-written Hono application:

- REST API routes under `/v1/*`.
- Server-rendered UI with Hono JSX, htmx, and Tailwind CDN.
- WorkOS AuthKit session handling and bearer API-token auth.
- Postgres/RLS repository wiring through `@rntme/platform-storage`.
- In-process deployment and project-delete executors.
- Dokploy client construction, target-secret decryption, smoke checks, orphan
  detection, and deployment log writing.

This shape predates the current rntme direction. The decision system now makes
the blueprint the unit of truth, uses canonical contracts for optional
capabilities, keeps core lean, and expects runtime behavior to be inspectable
through surfaces rather than by reading JSON or hand-written glue. The platform
should dogfood that architecture: the rntme platform itself should be a rntme
project blueprint.

Breaking API changes are allowed for this migration. The CLI will move to the
new generated/canonical API surface during cutover rather than preserving the
old `/v1/*` shape with compatibility shims.

## Goals

- Make the platform itself a rntme project blueprint rooted at
  `apps/platform/blueprint`.
- Move platform domain behavior toward PDM, QSM, Graph IR, bindings, and UI
  artifacts instead of hand-written Hono route ownership.
- Keep humans able to inspect platform runtime state through API/UI surfaces:
  projects, versions, deployments, operations, logs, evidence, tokens, and
  audit.
- Use `@rntme/identity-auth0` as the first platform identity provider through
  the canonical identity contract.
- Move deploy ownership out of `platform-http` into a platform `deployments`
  service, while preserving an internal adapter seam to the current deploy
  packages.
- Split the migration into one umbrella spec and five implementation plans.

## Non-Goals

- No WorkOS provider parity in the first five plans. Existing WorkOS work stays
  in the repository, but Auth0 is the first platform identity provider.
- No compatibility layer for the old `/v1/*` API unless a later implementation
  plan discovers a hard operational blocker.
- No production deploy-adapter module contract in the first deploy slice.
- No broad redesign of `@rntme/ui` or `@rntme/ui-runtime`. The UI plan may add
  only the minimum reusable primitive or authoring support required by the
  platform UI.
- No DWH/replay implementation beyond respecting the existing project event log
  direction.
- No database dialect strategy change. SQLite remains the default service store
  and Turso remains the scale-out target unless a separate decision-system
  update changes that.
- No immediate deletion of `@rntme/platform-core`,
  `@rntme/platform-storage`, or `apps/platform-http`. Migration plans decide
  when each becomes legacy, bridge, or removable.

## Decision-System Impact

The implementation should update `docs/decision-system.md` when the first
platform blueprint slice lands.

Add a locked-pending bet:

> **Platform as blueprint** - The rntme control plane is authored, reviewed,
> deployed, and evolved as a rntme project blueprint rooted at
> `apps/platform/blueprint`. Hand-written launchers may host or bridge the
> platform during migration, but domain/API/UI source of truth moves to
> artifacts. - G1, G2, G3, G5, F2, F4, F5, F6 - `locked-pending`

Add a locked-pending or current-default bet, depending on implementation
confidence after the deployments-service slice:

> **Deployments service + adapter boundary** - Platform deployment lifecycle is
> owned by a rntme `deployments` service. Target-neutral planning and
> provider-specific apply details sit behind an adapter seam. Dokploy remains
> the first adapter; a public deploy-adapter module contract is deferred until
> the service boundary stabilizes or a second backend exists. - G3, G4, F1, F3,
> F4, F8 - `locked-pending`

These bets derive from existing goals and filters. They do not require changing
the north-star goals.

## Target Architecture

The platform blueprint lives at:

```text
apps/platform/blueprint
```

`apps/platform-http` becomes a transitional host:

- during early plans, it remains the current runnable platform;
- during cutover, it becomes a thin launcher/edge around the platform blueprint
  runtime plus any explicitly documented bridge seams;
- after cutover, it should not own platform domain logic.

The platform blueprint should contain services with explicit ownership
boundaries:

| Service | Ownership |
| --- | --- |
| `organizations` | Organization metadata, account membership mirror, tenant context needed by the platform. |
| `projects` | Project metadata, project versions, immutable canonical bundles, publish/read operations. |
| `tokens` | Machine API tokens, scopes, revocation, token audit metadata. |
| `deployments` | Deploy targets, deployments, project update/delete operations, logs, apply/smoke evidence, lifecycle status. |
| `audit` | Inspectable audit stream or projections over platform domain events. |

The exact service split can be refined in the foundation plan, but the design
must preserve one clear owner for each state family. Cross-service behavior
should use rntme runtime mechanisms rather than direct imports between service
implementations.

## Identity

Platform auth uses the canonical identity contract. The first provider is
`@rntme/identity-auth0` because it already provides the required capabilities:

- `IntrospectSession` over canonical gRPC.
- HTTP edge introspection via `module.json#capabilities.edgeAuth`.
- Browser client boot for login/logout and bearer transport injection.
- Provisioner support for SPA client, resource server, and M2M outputs.

WorkOS is not part of the first migration because its current module does not
claim session or edge introspection. WorkOS can become a later provider-parity
plan once it supports the canonical session surface.

Platform state may mirror identity facts needed for tenancy, scopes, and
inspectability. The identity provider remains the source of truth for external
users, organizations, sessions, and provider-specific lifecycle events.

## Deploy Architecture

Deploy follows a hybrid target:

- The platform has a rntme `deployments` service that owns deployment domain
  state, lifecycle transitions, logs, evidence, and API/UI inspectability.
- Target-neutral planning remains in `@rntme/deploy-core`.
- The first provider-specific adapter remains `@rntme/deploy-dokploy`.
- The first implementation uses an internal adapter seam, not a public
  deploy-adapter module contract.
- A future canonical deploy-adapter contract may move Dokploy and later targets
  into module-like packages once the `deployments` service boundary is proven.

This means deploy is not an `apps/platform-http` responsibility and not a core
artifact. It is a platform service capability with target adapters behind a
contract boundary.

First-slice deployment flow:

1. API, UI, or CLI calls a `deployments.startDeployment` binding.
2. The `deployments` service writes queued state and records a domain event.
3. A lifecycle worker or BPMN-capable runner picks up the operation.
4. The worker loads the immutable project-version bundle and revalidates it.
5. The worker resolves target config and target secrets.
6. The worker runs provisioners, calls `@rntme/deploy-core`, renders and
   applies through the Dokploy adapter seam, and runs smoke checks.
7. Logs, warnings, errors, apply result, smoke evidence, and final state are
   appended back to the `deployments` service-owned state.
8. UI and CLI read deployment status, logs, and evidence through bindings.

Secret values must stay inside cipher/client closures. They must not appear in
rendered plans, apply results, logs, API responses, or UI state.

## Platform UI

The platform UI moves to a rntme UI artifact as part of the first five plans.
The migration is functional, not a redesign.

The UI artifact should cover the current simple platform pages:

- login and authenticated/anonymous gates;
- no-org state;
- organization project list;
- project detail and project versions;
- project-version detail and deploy action;
- deploy targets and target detail;
- deployment history, deployment detail, status polling, and logs;
- project operation detail, status polling, and logs;
- token list, create, revoke, and one-time plaintext token display;
- audit log;
- error states.

If existing UI runtime primitives are insufficient, the UI plan should add the
smallest reusable primitive or authoring feature that directly supports these
pages. It should not become a general UI-runtime redesign.

## API And CLI

The new platform API is the rntme bindings surface generated from the platform
blueprint. It does not need to preserve the old `/v1/*` route shape.

The cutover plan updates the CLI to the new surface in the same slice that
makes the platform runtime the active host. Until then, old platform and new
platform blueprint can coexist in tests.

## Five Implementation Plans

### 1. Platform Blueprint Foundation

Create `apps/platform/blueprint` and define the first valid platform project
blueprint. Include PDM, QSM, service layout, Graph IR operations, and bindings
for the basic platform domain: organizations, projects, project versions,
tokens, and audit.

This plan should produce a composed blueprint that validates locally. It should
not cut over `apps/platform-http` or deploy execution.

### 2. Platform Identity/Auth0

Attach `@rntme/identity-auth0` as the platform identity module. Define protected
routes, Auth0 public config, edge auth, runtime `IntrospectSession`, and the
platform tenancy/session mapping needed by operations.

This plan replaces the target auth model, not necessarily every legacy WorkOS
code path in the old host.

### 3. Deployments Service And Internal Adapter Seam

Move deployment and project-operation ownership into the platform blueprint's
`deployments` service. Model deploy targets, deployment records, project
operations, sanitized log lines, final results, and smoke evidence as
service-owned state.

Add an internal adapter seam that can invoke the existing deploy executor logic
through `@rntme/deploy-core` and `@rntme/deploy-dokploy`. Do not create a public
deploy-adapter module contract in this plan.

### 4. Platform UI Artifact

Port the current platform UI into rntme UI artifacts. Preserve the main
workflows and page coverage while moving data reads and mutations to generated
bindings.

This plan should cover compile-time validation for every platform route and
runtime smoke coverage for the key browse, polling, token, and error states.

### 5. Runtime Cutover And CLI Update

Make `apps/platform-http` a thin launcher/edge around the platform blueprint
runtime. Remove legacy ownership of platform routes where the blueprint surface
now owns behavior. Update the CLI to call the new API surface and document the
self-hosting/deploy story for the platform itself.

Compatibility with old `/v1/*` routes remains out of scope unless this plan
finds a concrete blocker.

## Testing Strategy

The plans should use focused tests at each boundary:

- Blueprint foundation: composition tests, artifact validation tests, binding
  resolution tests, and Graph IR operation validation.
- Identity/Auth0: protected binding-route tests, edge auth planning tests,
  runtime session propagation tests, and reuse of existing Auth0 mock
  conformance where appropriate.
- Deployments service: state-transition tests, target-secret preflight tests,
  log-redaction tests, adapter seam tests, and integration tests adapted from
  current platform deploy executor fixtures.
- UI artifact: UI compile tests for every route, state branch coverage, and
  browser smoke for login gate, project browsing, deployment polling, token
  create/revoke, and errors.
- Cutover: end-to-end CLI publish/deploy/list/show flows against the new API.

Old and new platform paths may run side by side in tests until cutover. Tests
should increasingly assert against service-owned platform state and events, not
legacy Hono route internals.

## Migration Strategy

Do not mutate `apps/platform-http` into a half-runtime app immediately. Build
the platform blueprint first and make it compose cleanly. Then attach identity,
then migrate deploy ownership, then migrate UI, then cut over runtime and CLI.

Current `@rntme/platform-core` and `@rntme/platform-storage` code can serve as
implementation reference and transitional support. They are not automatically
the target model. The target model should prefer rntme artifacts and service
ownership when those can express the same behavior without custom glue.

Deploy adapter abstraction should stay internal until the `deployments` service
boundary is stable or a second backend exists. Designing a public deploy module
contract too early risks freezing the current Dokploy-specific executor shape
instead of a real canonical deploy capability.

## Documentation Touch

Expected documentation updates during implementation:

- `docs/decision-system.md` when the foundation/deploy service decisions land.
- `AGENTS.md` when `apps/platform/blueprint` becomes a common navigation path.
- `apps/platform/README.md` and a matching owner doc if a new `apps/platform/`
  package/workspace is created.
- `apps/platform-http/README.md` and
  `docs/current/owners/apps/platform-http.md` when it becomes legacy, bridge, or
  thin launcher.
- Owner docs for any new or changed platform blueprint, service, UI, or deploy
  adapter surfaces.

