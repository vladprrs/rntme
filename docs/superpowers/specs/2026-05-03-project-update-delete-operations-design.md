# Project Update/Delete Operations - design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-05-03
**Related:**
- `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` - platform control-plane projects and archival baseline.
- `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md` - deploy-core / deploy-dokploy deployment pipeline.
- `docs/superpowers/specs/done/2026-04-26-project-deploy-flow-design.md` - platform project versions, deploy targets, deployment executor, and deployment logs.
- `docs/superpowers/specs/done/2026-05-02-cli-remote-deploy-hardening-design.md` - CLI-triggered remote deployments through platform.
- `docs/superpowers/specs/2026-05-01-provisioned-event-bus-design.md` - provisioned Redpanda resources that delete/teardown must remove.

**Implementation locations:**
- Platform operation schemas/use-cases - `packages/platform/platform-core/`
- Platform storage migrations/repos - `packages/platform/platform-storage/`
- Platform HTTP routes, UI, and executors - `apps/platform-http/`
- CLI command surface - `apps/cli/`
- Dokploy target adapter delete seam - `packages/deploy/deploy-dokploy/`

## 1. Problem

The platform currently has the primitives for publishing and deploying project
versions, but the product workflow is split across multiple commands and lacks a
project-level destructive teardown path:

1. `rntme project publish` uploads an immutable blueprint version.
2. `rntme project deploy --version N --target T` applies that version.
3. Platform UI can start a deployment from a selected version, but cannot apply
   the latest version from the project page.
4. Project archive exists as a soft control-plane state, but it does not remove
   Dokploy applications, compose resources, provisioned Redpanda, domains, or
   file mounts.

Users need two project-level operations:

- **Update project**: roll a newly published or selected blueprint version onto
  the project's deployment target.
- **Delete project**: decommission the project by tearing down every deployed
  Dokploy resource, while retaining platform evidence such as audit, deployment
  history, and operation logs.

Delete must be asynchronous. It can touch several deploy targets and many
resources, and external API failures must be retryable without losing the
project identity record.

## 2. Goals

Add a unified **project operation** model for update and delete:

- `project update` publishes a local blueprint if needed, then deploys the
  resulting project version to an explicit or default deploy target.
- Project-page UI update applies the latest published project version to the
  org default deploy target.
- `project delete` starts a project decommission operation that removes all
  known Dokploy resources for the project across all deploy targets.
- The project row remains as the stable identity/audit anchor. Delete changes
  the project lifecycle status to `decommissioned`; it does not free the slug.
- Failed teardown leaves the project in `delete_failed` and supports retry.
- CLI and UI can show/watch operation status and logs.

## 3. Non-goals

- No physical deletion of project, deployment, deployment log, project version,
  or audit rows in this iteration.
- No release of project slugs after decommissioning.
- No upload/publish flow from the web UI.
- No deployment cancellation or queueing behind an active deployment.
- No generic drift reconciler.
- No automatic cleanup of external resources that were not created by the
  rntme deploy adapter and are not present in deployment apply results.
- No multi-target update rollout. Update applies to one target: explicit or
  default.

## 4. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | User-facing model | Add a unified `project_operation` model for `update` and `delete`. |
| D2 | Update semantics | Publish local blueprint if supplied, otherwise use selected version, then deploy. |
| D3 | UI update | Project page deploys latest published version to the default deploy target. |
| D4 | Default target | Update may omit target; platform resolves the org default deploy target. |
| D5 | Active deployment conflict | Update/delete are blocked while conflicting `queued` or `running` deployments exist. |
| D6 | Delete scope | Delete tears down all known Dokploy resources across all targets used by the project. |
| D7 | Project after delete | Keep the project row and slug; set status to `decommissioned`. |
| D8 | Delete failure | Set project status to `delete_failed`; retry is allowed. |
| D9 | History retention | Keep audit, project versions, deployments, deployment logs, and operation logs. |
| D10 | Authorization | Add destructive scope `project:delete` for delete operations. |
| D11 | Confirmation | CLI and UI delete require the exact project slug as confirmation. |

## 5. Project Lifecycle

Add `project.status`:

```ts
export type ProjectStatus =
  | 'active'
  | 'deleting'
  | 'delete_failed'
  | 'decommissioned';
```

Rules:

- New projects start as `active`.
- Only `active` projects allow publish, update, direct deploy, and delete start.
- `deleting` blocks publish/update/deploy/delete start except internal retry
  continuation for the active delete operation.
- `delete_failed` blocks publish/update/deploy and allows delete retry.
- `decommissioned` blocks all mutation workflows except read-only history.
- The slug remains reserved in every non-active status.
- Existing `archived_at` remains for backward compatibility and org-cascade
  behavior. Product delete does not use archive as its terminal state.
- Existing direct publish and deployment routes must also reject projects whose
  status is not `active`.

Default project lists exclude `decommissioned` projects. The API should expose
an opt-in query such as `includeInactive=true` for UI/history screens that need
to show them.

## 6. Data Model

Add `project_operation`:

```ts
export type ProjectOperationKind = 'update' | 'delete';
export type ProjectOperationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type ProjectOperation = {
  readonly id: string;
  readonly orgId: string;
  readonly projectId: string;
  readonly kind: ProjectOperationKind;
  readonly status: ProjectOperationStatus;
  readonly requestedByAccountId: string;
  readonly requestedByTokenId: string | null;
  readonly targetId: string | null;
  readonly projectVersionId: string | null;
  readonly deploymentId: string | null;
  readonly input: Record<string, unknown>;
  readonly result: Record<string, unknown> | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly lastHeartbeatAt: Date | null;
};
```

Add `project_operation_log_line`:

```ts
export type ProjectOperationLogLine = {
  readonly id: bigint;
  readonly operationId: string;
  readonly orgId: string;
  readonly ts: Date;
  readonly level: 'info' | 'warn' | 'error';
  readonly step: string;
  readonly message: string;
};
```

Indexes:

- `project_operation(project_id, queued_at desc)`
- `project_operation(status, last_heartbeat_at)` for orphan detection
- `project_operation_log_line(operation_id, id)`

Relationships:

- `update` may reference `target_id`, `project_version_id`, and `deployment_id`.
- `delete` references the project and records per-target teardown evidence in
  `result`.
- Deployment rows stay authoritative for deploy apply/smoke details.
- Operation logs carry high-level project operation progress. For update
  operations, operation watch may also stream linked deployment logs.

## 7. Update Flow

CLI command:

```bash
rntme project update [folder] [--version <seq>] [--target <slug>] [--wait] [--timeout <sec>]
```

Rules:

- Exactly one source is used:
  - no `--version`: CLI validates the local blueprint folder, builds the
    canonical project bundle, and sends it to the platform operation endpoint;
  - `--version <seq>`: CLI sends only the existing version seq.
- `--target` is optional. If omitted, platform resolves the org default deploy
  target. If no default target exists, the operation request fails.
- Update is blocked if the selected target already has a `queued` or `running`
  deployment for the same project.
- `--wait` watches the project operation until terminal status.

Platform flow:

1. Resolve org/project and require project status `active`.
2. Resolve source:
   - if a bundle is provided, run the existing canonical bundle parse,
     validation, composition, idempotent publish path;
   - if `projectVersionSeq` is provided, resolve that existing version.
3. Resolve target: explicit `targetSlug` or org default deploy target.
4. Check there is no active deployment for `projectId + targetId`.
5. Create `project_operation(kind='update', status='queued')`.
6. Create the normal `deployment(status='queued')` with the resolved version and
   target, and link it to the operation.
7. Schedule the existing deployment executor.
8. Finalize operation from the linked deployment:
   - `succeeded` or `succeeded_with_warnings` deployment -> operation
     `succeeded`;
   - `failed` or `failed_orphaned` deployment -> operation `failed`.

The deployment executor remains the only path that plans, renders, applies, and
smoke-verifies updates. Project operation code must not duplicate deploy-core
or deploy-dokploy apply logic.

## 8. Delete Flow

CLI command:

```bash
rntme project delete <slug> --confirm <slug> [--wait] [--timeout <sec>]
```

Rules:

- `--confirm` must exactly equal the project slug.
- Delete requires `project:delete`.
- Delete is blocked if any deployment for the project is `queued` or `running`.
- Delete is allowed when project status is `active` or `delete_failed`.
- Delete is rejected when project status is `decommissioned`.

Platform flow:

1. Resolve org/project.
2. Verify confirmation and authorization.
3. Verify no active project deployments exist.
4. Transition project status to `deleting`.
5. Create `project_operation(kind='delete', status='queued')`.
6. Schedule the delete executor.

Delete executor:

1. Transition operation to `running` and heartbeat while active.
2. Read all deployments for the project with non-null `applyResult`.
3. Extract `applyResult.resources` from each deployment.
4. Group resources by the deployment row's `targetId`.
5. Dedupe resources by `(resourceKind, targetResourceId)`.
6. Delete application resources before compose resources, so service workloads
   are removed before shared infrastructure such as provisioned Redpanda.
7. For each target, create a Dokploy client with the stored target credentials.
8. Delete resources through the Dokploy delete seam.
9. Treat missing external resources as success with a warning log.
10. If all target groups succeed:
    - operation `succeeded`;
    - project status `decommissioned`.
11. If any target group fails:
    - operation `failed`;
    - project status `delete_failed`;
    - operation `result` includes failed resources and warnings.

Retry:

- Re-running delete on `delete_failed` creates a new delete operation.
- Already-missing resources remain success with warning.
- The retry uses the same deployment apply results, so it can finish after a
  partial previous teardown.

## 9. Dokploy Delete Seam

Extend `DokployClient`:

```ts
export type DokployClient = {
  // existing methods...
  deleteApplication(applicationId: string): Promise<void>;
  deleteCompose(composeId: string): Promise<void>;
};
```

Add a target-adapter helper:

```ts
export type DokployDeleteResource = {
  readonly resourceKind: 'application' | 'compose';
  readonly targetResourceId: string;
  readonly targetResourceName: string;
};

export function deleteDokployResources(
  resources: readonly DokployDeleteResource[],
  client: DokployClient,
): Promise<Result<DokployDeleteResult, DokployDeploymentError>>;
```

Behavior:

- Applications delete before composes.
- Duplicate target resource ids are deleted once.
- Missing resources return a warning, not a failure.
- API errors for present resources fail the helper and include sanitized cause
  data.
- The real platform Dokploy client maps these seam methods to Dokploy's delete
  API endpoints. The implementation plan must verify exact endpoint names
  against the Dokploy API version currently deployed.

Deleting an application/compose is expected to remove associated Dokploy-managed
domains and mounts. If the Dokploy API requires explicit cleanup for either,
the real client must perform it inside `deleteApplication` / `deleteCompose`
before deleting the parent resource.

## 10. REST API

Add project operation routes:

```http
POST /v1/orgs/:org/projects/:project/operations/update
POST /v1/orgs/:org/projects/:project/operations/delete
GET  /v1/orgs/:org/projects/:project/operations
GET  /v1/orgs/:org/projects/:project/operations/:operationId
GET  /v1/orgs/:org/projects/:project/operations/:operationId/logs
```

Update request:

```json
{
  "targetSlug": "dokploy-preview",
  "projectVersionSeq": 4
}
```

Or:

```json
{
  "targetSlug": "dokploy-preview",
  "bundle": {
    "contentType": "application/rntme-project-bundle+json",
    "bytesBase64": "..."
  }
}
```

Rules:

- Exactly one of `projectVersionSeq` or `bundle` is required.
- `targetSlug` is optional. Omitted means default deploy target.
- Bundle size limit is the same as project version publish.
- Bundle content uses the same validation/publish path as
  `POST /versions`.

Delete request:

```json
{
  "confirm": "project-slug"
}
```

Responses:

- Operation create endpoints return `202` with `{ "operation": ... }`.
- Operation show returns `{ "operation": ... }`.
- Operation list returns `{ "operations": [...] }`.
- Operation logs returns `{ "lines": [...], "lastLineId": N }`.

Error codes to add:

- `PROJECT_OPERATION_NOT_FOUND`
- `PROJECT_OPERATION_ACTIVE_DEPLOYMENT`
- `PROJECT_OPERATION_DEFAULT_TARGET_MISSING`
- `PROJECT_OPERATION_INVALID_STATE`
- `PROJECT_OPERATION_CONFIRMATION_MISMATCH`
- `PROJECT_OPERATION_BUNDLE_SOURCE_CONFLICT`
- `PROJECT_OPERATION_DELETE_TEARDOWN_FAILED`

HTTP mapping:

- confirmation/source/path parse errors -> `400`
- missing operation -> `404`
- missing default target, invalid state, or active deployment conflict -> `409`
- teardown failure on executor finalization is stored on the operation; the
  original create request remains `202` if queueing succeeded.

## 11. CLI Surface

Add commands:

```bash
rntme project update [folder] [--version <seq>] [--target <slug>] [--wait] [--timeout <sec>]
rntme project delete <slug> --confirm <slug> [--wait] [--timeout <sec>]
rntme project operation list
rntme project operation show <id>
rntme project operation watch <id>
```

Output:

- Human output prints operation id, kind, status, linked version/deployment when
  available, and platform URL.
- `--json` prints the API response.
- `project update --wait` exits like deployment watch:
  - `0` on succeeded;
  - `1` on succeeded with warnings when the linked deployment has that status;
  - `10` on failed.
- `project delete --wait` exits `0` on succeeded and `10` on failed.

Client constraints:

- CLI remains HTTP-only. It must not import platform-core, platform-storage,
  deploy-core, deploy-dokploy, WorkOS, Drizzle, pg, or AWS SDK packages.
- CLI never receives deploy target secrets.
- CLI local blueprint validation for update mirrors existing `project publish`.

## 12. Platform UI

Project list:

- Show status badges for inactive states.
- Hide `decommissioned` projects by default.
- Add an opt-in inactive/history view if needed for support workflows.

Project detail:

- Show latest operation panel with status, timestamps, and links.
- Show an **Update** action when:
  - project status is `active`;
  - at least one project version exists;
  - an org default deploy target exists.
- The Update action deploys the latest published version to the default target.
- Show a **Delete** action when project status is `active`.
- Show **Retry delete** when project status is `delete_failed`.
- Delete form requires entering the exact project slug.

Operation detail:

- Show operation status, input summary, result summary, error, and logs.
- For update operations, link to the underlying deployment detail page.
- Poll status/log fragments using the existing htmx style used by deployment
  detail.

## 13. Concurrency and Orphan Handling

Active deployment means status `queued` or `running`.

Update conflict:

- Check active deployments for `projectId + targetId`.
- Reject with `PROJECT_OPERATION_ACTIVE_DEPLOYMENT` if one exists.

Delete conflict:

- Check active deployments for `projectId`.
- Reject with `PROJECT_OPERATION_ACTIVE_DEPLOYMENT` if any exists.

Operation orphan detection:

- Add an orphan detector for `project_operation(status='running')` with stale
  heartbeat.
- For update operations, if the linked deployment becomes orphaned/failed, the
  operation becomes failed.
- For delete operations, stale running operations become failed and project
  status becomes `delete_failed`.

No cancellation semantics are introduced. Users wait for active deployments to
finish before update/delete.

## 14. Security and Audit

Scopes:

- Update requires the existing deployment/publish scopes depending on source:
  - bundle source: `version:publish` and `deploy:execute`;
  - version source: `deploy:execute`.
- Delete requires new `project:delete`.
- Operation reads require `project:read`.

Audit actions:

- `project.operation.queued`
- `project.update.started`
- `project.update.succeeded`
- `project.update.failed`
- `project.delete.started`
- `project.delete.succeeded`
- `project.delete.failed`

Audit payloads may include project id/slug, operation id, target id/slug,
version seq, deployment id, and redacted failure summaries. They must not
contain deploy target secrets or raw credentials.

## 15. Testing

Core unit tests:

- project status schema parses all lifecycle states.
- operation request schemas enforce exactly-one source for update.
- delete confirmation mismatch returns the stable error code.
- update/delete use-cases reject inactive project states.
- active deployment conflict rules are project+target for update and
  project-wide for delete.

Storage integration tests:

- project status transitions persist.
- operation create/list/show/log repos respect tenant RLS.
- operation heartbeat/finalization writes timestamps and errors.
- delete retry after `delete_failed` creates a new operation and keeps slug
  reserved.

Platform route tests:

- update with default target resolves the default target.
- update without default target fails.
- update with bundle publishes idempotently and creates a linked deployment.
- update with version creates a linked deployment without publishing.
- delete requires `confirm`.
- delete blocks active deployments.
- delete retry allowed from `delete_failed`.

Deploy-dokploy tests:

- delete helper orders applications before composes.
- duplicate resource ids delete once.
- missing resources are warnings.
- API failures return sanitized errors.

CLI tests:

- `project update` sends bundle or version request correctly.
- `project update` rejects `folder + --version` source conflict.
- `project delete` requires `--confirm`.
- operation list/show/watch hit expected URLs.
- wait exit codes match operation terminal states.

UI tests:

- project page renders update/delete actions only for valid states.
- latest-version update form posts to the operation endpoint.
- delete confirmation form posts expected payload.
- operation detail renders logs and linked deployment for update operations.

## 16. Documentation Touches

The implementation plan must update:

- `apps/cli/README.md` with `project update`, `project delete`, and
  `project operation` commands.
- `apps/platform-http/README.md` UI routes, CSRF mutation list, and project
  lifecycle behavior.
- `packages/platform/platform-core/README.md` for project operation domain
  contracts.
- `packages/platform/platform-storage/README.md` for operation tables and
  lifecycle storage.
- `packages/deploy/deploy-dokploy/README.md` for the delete seam.
- `AGENTS.md` §6 with a short "update/decommission a project" how-to if the
  resulting workflow becomes a common task for agents.
