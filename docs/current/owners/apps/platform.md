# @rntme/platform

Platform-as-blueprint authoring surface for the rntme control plane. The source
of truth lives under `apps/platform/blueprint` and is loaded with
`@rntme/blueprint`.

## Role in the system

- Depends on rntme artifact packages through validation and composition.
- Consumed by future platform runtime cutover work.
- Does not replace `apps/platform-http` until the cutover plan lands.

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
  "eventBus": { "mode": "provisioned" }
}
```

## Runtime cutover

The active platform runtime is hosted through `apps/platform-http` blueprint
mode. The platform blueprint is the source of truth for domain API and UI
surfaces. The old `/v1/*` Hono route ownership is not part of blueprint mode.

## Identity

The platform blueprint uses `@rntme/identity-auth0` as its first identity
provider through the canonical identity contract. Platform API mounts use the
project `auth` middleware with Auth0 edge introspection. Graphs receive the
`Authorization` header through binding `inputFrom.authorization` and call
`identity-auth0.IntrospectSession` for canonical session data.

WorkOS remains a legacy hosted-platform integration until a future provider
parity plan adds canonical session/edge introspection support.

### Known gaps (resolved in the runtime cutover slice)

- The `${auth.audience}` placeholder in graph `IntrospectSession` calls is not
  yet resolved by any graph-IR pass — at runtime every session call will fail
  audience validation until a resolver is added.
- `organizations.listOrganizations` filters only by `status = active`. Once
  the session result is consumed it must scope by membership; today it would
  return every tenant's orgs to any authenticated caller.
- The `session` call result is not consumed by downstream nodes. Actor
  derivation from the session is deferred to the cutover plan.

## UI

The platform UI is authored as `@rntme/ui` artifacts under
`apps/platform/blueprint/services/app/ui`. The UI is a functional port of the
legacy Hono JSX platform UI and reads/mutates state through platform blueprint
bindings. `apps/platform-http/src/ui/**` remains legacy reference code until
runtime cutover.

## Local commands

```bash
bun run -F @rntme/blueprint test -- ../../../apps/platform/blueprint/test
```

## Invariants

- This app owns authoring artifacts only in the foundation slice.
- `apps/platform-http` remains the active hosted platform until cutover.

## Where to look first

- `apps/platform/blueprint/project.json`
- `apps/platform/blueprint/test/platform-blueprint.test.ts`

## Specs

- [`../../superpowers/specs/2026-05-09-platform-as-blueprint-design.md`](/docs/superpowers/specs/2026-05-09-platform-as-blueprint-design.md)
