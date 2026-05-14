# @rntme/platform

Platform-as-blueprint authoring surface for the rntme control plane. The source
of truth lives under `apps/platform/blueprint` and is loaded with
`@rntme/blueprint`.

## Role in the system

- Depends on rntme artifact packages through validation and composition.
- Consumed by future platform runtime cutover work.
- The platform is exclusively served by `@rntme/runtime` reading
  `apps/platform/blueprint`. There is no separate launcher app.

## Blueprint layout

- `project.json`
- `pdm/pdm.json` and `pdm/entities/*.json`
- `services/organizations`
- `services/projects`
- `services/tokens`
- `services/audit`
- `services/deployments`
- `services/app`

## Services

| Entity | Owner service | Purpose |
| --- | --- | --- |
| `Organization` | `organizations` | Tenant identity and display metadata. |
| `Account` | `organizations` | Human or machine principal mirror. |
| `Membership` | `organizations` | Account-to-organization role/scopes mirror. |
| `Project` | `projects` | Project metadata and lifecycle state. |
| `ProjectVersion` | `projects` | Immutable published bundle metadata. |
| `ApiToken` | `tokens` | Machine token metadata, prefix, scopes, revocation state. |
| `AuditEvent` | `audit` | Append-only inspectable audit stream. |
| `DeployTarget` | `deployments` | Provider-scoped deploy target metadata and lifecycle. |
| `Deployment` | `deployments` | Per-target deployment record with queue/run/terminal state. |
| `DeploymentLogLine` | `deployments` | Sanitized append-only log line for a deployment. |
| `ProjectOperation` | `deployments` | Long-running project operation record (e.g., archive/delete). |
| `ProjectOperationLogLine` | `deployments` | Sanitized append-only log line for a project operation. |

## Deployments

The platform blueprint has a `deployments` domain service that owns deploy
targets, deployment records, project operations, sanitized log lines, and
execution evidence. The first implementation uses an internal adapter seam to
call the existing Dokploy deploy path. A public deploy-adapter module contract
is intentionally deferred.

## Native operations

Several platform-blueprint bindings dispatch to TypeScript native operation
handlers declared in `services/<svc>/operations.json` and implemented under
`services/<svc>/handlers/*.ts`. These are referenced by bindings the same way
graphs are, so the runtime's compiled operation map covers both kinds.

| Binding | Native operation | Handler module / export |
| --- | --- | --- |
| `POST /api/tokens` | `createToken` | `services/tokens/handlers/create-token.ts` (`createTokenHandler`) — mints a `rntme_pat_*` value once, stores only its SHA-256 hash in the tokens service's persistent SQLite state, and records the token create event |
| `GET /api/tokens/introspect` | `IntrospectToken` | `services/tokens/handlers/introspect-token.ts` (`introspectTokenHandler`) — runtime-native PAT introspection entrypoint; missing or invalid bearer values throw typed `PLATFORM_AUTH_*` errors |
| `GET /api/projects` | `listProjects` | `services/projects/handlers/list-org-projects.ts` (`listOrgProjectsHandler`) — supports the runtime-native edge-authenticated call shape for dashboard and CLI proof paths |
| `POST /api/projects/{projectId}/versions` | `publishProjectBundle` | `services/projects/handlers/publish-project-bundle.ts` (`publishProjectBundleHandler`) — ingests the `application/rntme-project-bundle+json` body bytes via `inputFrom.bodyBytes` |
| `POST /api/deployments` | `startDeployment` | `services/deployments/handlers/*` (`startDeploymentHandler`) — accepts `projectVersionSeq` and `targetSlug` |
| `GET /api/deployments/targets` | `listDeployTargets` | `services/deployments/handlers/deploy-targets.ts` |
| `GET /api/deployments/targets/{slug}` | `getDeployTarget` | `services/deployments/handlers/deploy-targets.ts` |
| `POST /api/deployments/targets` | `createDeployTarget` | `services/deployments/handlers/deploy-targets.ts` (`createDeployTargetHandler`) |
| `POST /api/deployments/targets/{slug}/actions/update` | `updateDeployTarget` | `services/deployments/handlers/deploy-targets.ts` (`updateDeployTargetHandler`) |
| `POST /api/deployments/targets/{slug}/actions/delete` | `deleteDeployTarget` | `services/deployments/handlers/deploy-targets.ts` (`deleteDeployTargetHandler`) |

`update` and `delete` are exposed as `POST /actions/update` and
`POST /actions/delete` sub-routes (rather than `PUT`/`DELETE`) because the
bindings HTTP runtime is GET/POST-only.

The `/api/projects` edge route mounts `projectBundleBodyLimit`
(`kind: "body-limit"`, policy `projectBundle`) because project bundle publish
streams raw artifact bytes through that route. Platform deploy targets must
provide `policyValues.bodyLimit.projectBundle.maxBodySize` large enough for the
expected bundle size; the production bootstrap target currently uses `10m`.

## Workflows

The platform blueprint declares a project-level `workflows` section
pointing at `services/deployments/workflows/workflows.json`. The deployments
service owns the only workflow today (`runDeployment` BPMN with native task
handlers from `@rntme/deploy-runner`). Because the project ships workflows,
the deploy target MUST provide a workflow engine and event bus; otherwise
deploy-core planning fails with `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON`.

### Operaton + Kafka requirement and `deploy-worker` container

The deployed platform is no longer self-contained. It now depends on
**Operaton** (BPMN engine) and **Kafka** (provisioned by the platform's
event bus) being up and reachable, because deploy itself runs as a BPMN
process. In addition to the default `bpmn-worker` container, the platform
compose stack ships a **`deploy-worker`** container — a second
`@rntme/bpmn-worker` instance running in poll mode
(`rntme-bpmn-poll-worker`) and resolving the `runDeployment` BPMN's native
task handlers from `@rntme/deploy-runner#stages.*`. Each stage runs as a
native task in this worker; cross-stage state is persisted in
`DeployStageState` rows so the orchestrator can restart or retry a single
stage without re-running the whole deploy.

The platform target file therefore needs to declare both:

```jsonc
{
  "kind": "dokploy",
  // ...
  "workflows": {
    "engine": {
      "kind": "operaton",
      "mode": "provisioned",
      "image": "ghcr.io/operaton/operaton:latest"
    }
  },
  "eventBus": { "kind": "kafka", "mode": "provisioned", "provider": "redpanda" }
}
```

## Runtime

The platform runtime is `@rntme/runtime` reading `apps/platform/blueprint`.
The blueprint declares HTTP routes, UI mounts, BPMN workflows, and the
identity-auth0 module configuration. There is no separate launcher app —
production deploys ship the runtime image with the blueprint artifacts
copied into `/srv/artifacts` via the `Dockerfile.template` in
`packages/runtime/runtime/`.

The platform `tokens`, `projects`, and `deployments` domain services opt into
persistent runtime SQLite. `tokens` has its own volume. `projects` and
`deployments` share the `rntme-platform-control-data` volume and QSM database
so runtime-native deployment handlers can read projects, versions, targets,
operations, and deployments together, while keeping separate event-store files
for each service.

Runtime-native deploy target creation encrypts Dokploy API tokens and target
extras with `PLATFORM_SECRET_ENCRYPTION_KEY`, supplied to the `deployments`
service through a target secret ref. Runtime-native deployment start
materializes the saved project-version bundle, loads bundled provisioner entry
files from `assets/provisioners/<safe>.entry.js`, and calls
`@rntme/deploy-runner` in-process. Runtime deployment log line ids are global
within `deployment_log_lines` because the QSM projection keys that table by
`id`, not `(deployment_id, id)`.

## Identity

The platform blueprint uses an ordered, multi-provider `auth` middleware on
protected API routes. The middleware's `providers[]` list is:

1. **`platform-tokens`** — validates CLI personal access tokens
   (`Authorization: Bearer rntme_pat_*`) via HTTP introspection at
   `/api/tokens/introspect`, served by the platform's `tokens` domain service.
   The stable audience constant for this provider is
   `urn:rntme:platform-tokens`. Tokens are minted through
   `POST /api/tokens`, looked up by their stored hash, and the response is
   shaped like a session document for downstream handlers.
2. **`@rntme/identity-auth0`** — validates browser Auth0 JWTs through the
   canonical identity-module HTTP introspection sidecar, the same path used
   for browser SSO.

nginx walks the providers in order and authorizes on the first 200. Graphs
and native handlers receive the `Authorization` header through binding
`inputFrom.authorization` and consult the upstream session via
`IntrospectSession` (for module-backed providers) or the platform-tokens
introspection result (for PATs). Edge nginx forwards `X-Rntme-User-Sub`,
`X-Rntme-User-Audience`, and `X-Rntme-Session-Status` as advisory hints.

WorkOS remains a legacy hosted-platform integration until a future provider
parity plan adds canonical session/edge introspection support.

### Known gaps (remaining)

- The `${auth.audience}` placeholder in graph `IntrospectSession` calls is not
  yet resolved by any graph-IR pass — at runtime every session call will fail
  audience validation until a resolver is added.
- Platform PAT issuance is now runtime-native and durable for the `tokens`
  service, but safe bootstrap still requires an authenticated Auth0/browser
  session to call `POST /api/tokens`. Do not seed PAT plaintexts into files or
  bypass hashing.
- Runtime-native platform handlers currently trust edge-forwarded session
  headers as the bridge between nginx auth and service code. Full
  account/org membership enforcement for these handlers is still a separate
  platform membership slice.
- `organizations.listOrganizations` filters only by `status = active`. Once
  the session result is consumed it must scope by membership; today it would
  return every tenant's orgs to any authenticated caller.
- The `session` call result is not consumed by downstream nodes. Actor
  derivation from the session is deferred to the cutover plan.

## UI

The platform UI is authored as `@rntme/ui` artifacts under
`apps/platform/blueprint/services/app/ui`. The UI is a functional port of the
legacy Hono JSX platform UI and reads/mutates state through platform blueprint
bindings.

Platform product components, CSS tokens, logos, and exported reusable UI fragments live in `apps/platform/ui-module` as the `@rntme/platform-ui` module. `apps/platform/blueprint/project.json#modules.platformUi` wires that package into composition, and platform UI specs use `Platform*` component type names.

The platform UI routes `/`, `/login`, and `/auth/callback` to the login screen.
The Auth0 callback path is present so the browser runtime can finish the SPA
redirect flow without rendering the runtime not-found screen. The platform
identity public config sets `postLoginRedirectPath: "/no-org"` so a successful
SPA callback leaves the callback/login route before `ui-runtime` performs its
first route match. It also lists `/`, `/login`, and `/auth/callback` in
`authenticatedRedirectPaths` so an already-authenticated browser does not stay
on the login screen after reload.

The `/:orgId/tokens` screen includes `PlatformTokenIssuer`, a platform UI
module component that uses the browser Auth0 transport to call
`POST /api/tokens`. The PAT plaintext is rendered only in component-local
browser state after a successful create response; it is not written to the
runtime store, docs, logs, localStorage, or sessionStorage. This is the safe
bootstrap path for operators who can sign in through the browser but should not
seed tokens directly.

## Local commands

```bash
bun run -F @rntme/blueprint test -- ../../../apps/platform/blueprint/test
```

## Invariants

- This app owns authoring artifacts only in the foundation slice.
- The platform is the live runtime; `apps/platform-http` no longer exists.

## Where to look first

- `apps/platform/blueprint/project.json`
- `apps/platform/blueprint/test/platform-blueprint.test.ts`

## Specs

- [`../../superpowers/specs/2026-05-09-platform-as-blueprint-design.md`](/docs/superpowers/specs/2026-05-09-platform-as-blueprint-design.md)
