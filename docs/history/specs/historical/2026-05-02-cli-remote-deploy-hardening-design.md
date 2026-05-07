> Status: historical.
> Date: 2026-05-02.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# CLI Remote Deploy Hardening - design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-05-02
**Related:**
- `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md` - deploy-core / deploy-dokploy library-first deployment pipeline.
- `docs/history/specs/historical/2026-04-26-project-deploy-flow-design.md` - platform project versions, deploy targets, deployments, executor, and deployment logs.
- `docs/history/specs/active-rationale/2026-04-29-notes-demo-auth0-design.md` - notes-demo Auth0 production-shape demo and auth middleware path.
- `docs/history/specs/historical/2026-05-01-provisioned-event-bus-design.md` - provisioned Redpanda event bus path.

**Implementation locations:**
- CLI command surface - `apps/cli/`
- Platform deployment API/executor - `apps/platform-http/`
- Platform deployment schemas/use-cases - `packages/platform/platform-core/`
- Dokploy target adapter - `packages/deploy/deploy-dokploy/`
- Target-neutral deploy planner - `packages/deploy/deploy-core/`
- Notes demo blueprint smoke fixture - `demo/notes-blueprint/`

## 1. Problem

The project deployment pipeline is intended to be a single official path:

```text
rntme CLI / platform UI
  -> platform-http deployment API
  -> platform executor
  -> deploy-core plan
  -> deploy-dokploy render/apply
  -> platform smoke verification
```

The notes-demo production update on 2026-05-02 exposed gaps in that path:

1. `rntme` CLI could publish a project version, but it had no deploy command. Operators had to use platform UI/REST manually or direct Dokploy tooling.
2. `platform-http` lost module `edgeAuth` metadata when a project used a local module package alias (`rntme_identity_auth0`) for the canonical module manifest (`@rntme/identity-auth0`). `deploy-core` then could not plan edge auth correctly.
3. The notes-demo vendored Auth0 module manifest lacked `capabilities.edgeAuth`, allowing a blueprint that referenced auth middleware to reach deploy/apply without the required HTTP introspection descriptor.
4. Dokploy file mounts accumulated duplicates and could be created with paths that caused Swarm rejected tasks, for example `bind source path does not exist`.
5. A Dokploy API call could return success while the resulting Swarm task was rejected or exited non-zero. The deployment path did not reliably surface this as a platform deployment failure.
6. Smoke verification did not check the original protected API regression. `GET /api/notes` without `Authorization` returned a runtime `500 BINDINGS_RUNTIME_EXPRESSION_ERROR`; it should have been a canonical `401`.

The result was a production fix that required direct Dokploy operations. That must not be the expected workflow.

## 2. Goal

Make remote deployment through the platform the only supported CLI deploy path:

```text
rntme project deploy --org <org> --project <project> --version <seq> --target <target>
```

The CLI starts a deployment through platform HTTP. The platform remains the only component that can decrypt deploy target credentials and call Dokploy. All planning/rendering/apply behavior still goes through `@rntme/deploy-core` and `@rntme/deploy-dokploy`.

The same executor path must be used for CLI-triggered and UI-triggered deployments.

## 3. Non-goals

- No CLI local apply mode.
- No direct Dokploy calls from `apps/cli`.
- No CLI access to `DOKPLOY_API_KEY` or deploy target secret material.
- No generic drift detection or reconciler in this spec.
- No full browser e2e suite.
- No broad production persistence redesign.
- No rollback workflow beyond existing structured deployment failure reporting.

## 4. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Primary deploy path | CLI triggers platform deployment; platform executor applies through deploy packages. |
| D2 | Direct Dokploy from CLI | Forbidden in MVP. |
| D3 | CLI deploy version selection | `--version <seq>` required. No implicit latest. |
| D4 | CLI target selection | `--target <slug>` required. No implicit default target. |
| D5 | CLI deploy behavior | Async by default and only mode in MVP. It creates a deployment and returns immediately. |
| D6 | CLI observe commands | Add `deployment list`, `deployment show`, and `deployment watch`. |
| D7 | Scope of hardening | Include platform executor, Dokploy apply, and smoke verification hardening in this spec. |
| D8 | Protected API smoke | Auth-protected API routes must return `401 application/json` without `Authorization`; wrong status is deployment failure. |
| D9 | Drift/reconcile | Explicit follow-up spec after this work. |

## 5. CLI contract

### 5.1 Start deployment

Command:

```bash
rntme project deploy --org <org> --project <project> --version <seq> --target <target-slug>
```

Request:

```http
POST /v1/orgs/:org/projects/:project/deployments
Content-Type: application/json
```

```json
{
  "projectVersionSeq": 4,
  "targetSlug": "dokploy-rnt-364",
  "configOverrides": {}
}
```

Rules:

- `--version` is required and must be a positive integer.
- `--target` is required and must be a non-empty slug.
- `--org` and `--project` follow existing CLI resolution rules.
- The command exits `0` after the platform returns `202` and a deployment record.
- The command prints deployment id, initial status, timestamps, and a platform deployment detail URL.
- If the platform returns an error, the command maps it through the existing CLI error/exit-code model.

The command does not wait for terminal status. There is no `--wait` flag in this MVP.

### 5.2 List deployments

Command:

```bash
rntme project deployment list --org <org> --project <project> [--limit N]
```

Request:

```http
GET /v1/orgs/:org/projects/:project/deployments?limit=N
```

The command prints id, status, version reference when available from the API, target reference when available from the API, queued time, started time, and finished time.

### 5.3 Show deployment

Command:

```bash
rntme project deployment show --org <org> --project <project> <deployment-id>
```

Request:

```http
GET /v1/orgs/:org/projects/:project/deployments/:deploymentId
```

The command prints status, error code/message, warnings, rendered digest, verification summary, timestamps, and resource/apply summary if present.

### 5.4 Watch deployment

Command:

```bash
rntme project deployment watch --org <org> --project <project> <deployment-id>
```

Requests:

```http
GET /v1/orgs/:org/projects/:project/deployments/:deploymentId
GET /v1/orgs/:org/projects/:project/deployments/:deploymentId/logs?sinceLineId=<id>&limit=200
```

Behavior:

- Poll deployment status and incremental logs.
- Print new log lines in order.
- Stop when status is terminal.
- Exit `0` for `succeeded`.
- Exit `1` for `succeeded_with_warnings`.
- Exit `10` for `failed`, `failed_orphaned`, or platform server errors.

## 6. Platform API contract

The MVP uses the existing deployment endpoints:

- `POST /v1/orgs/:org/projects/:project/deployments`
- `GET /v1/orgs/:org/projects/:project/deployments`
- `GET /v1/orgs/:org/projects/:project/deployments/:deploymentId`
- `GET /v1/orgs/:org/projects/:project/deployments/:deploymentId/logs`

### 6.1 Explicit target requirement

`StartDeploymentRequestSchema` must require `targetSlug`.

The prior default-target fallback is removed from the shared JSON use-case. The UI must submit the selected target explicitly. This makes CLI and UI deployments reproducible and audit-friendly.

Failure cases:

- Missing `projectVersionSeq` -> parse/validation error.
- Missing `targetSlug` -> parse/validation error.
- Unknown version seq -> `DEPLOY_REQUEST_VERSION_NOT_FOUND`.
- Unknown target slug -> `DEPLOY_REQUEST_TARGET_NOT_FOUND`.

### 6.2 Response shape for CLI

`GET deployment` must expose enough structured data for CLI output:

- id
- project id
- project version id
- target id
- status
- config overrides
- rendered plan digest
- apply result
- verification report
- warnings
- error code/message
- queued/started/finished/heartbeat timestamps

The CLI may initially print ids if denormalized version/target labels are not present. A later additive API enhancement can include `projectVersionSeq` and `targetSlug` for nicer output.

### 6.3 Single executor path

Every deployment record, regardless of whether it is created by CLI or UI, must be scheduled through the same `runDeployment` executor.

No second quick-deploy path is allowed.

## 7. Platform executor hardening

The executor keeps the current high-level stages:

1. Fetch immutable project-version bundle.
2. Rehydrate it to a temporary blueprint folder.
3. Revalidate with `loadComposedBlueprint`.
4. Convert the composed blueprint to `ComposedProjectInput`.
5. Plan with `buildProjectDeploymentPlan`.
6. Render with `renderDokployPlan`.
7. Apply with `applyDokployPlan`.
8. Verify smoke checks.
9. Finalize deployment.

### 7.1 Module alias to canonical `edgeAuth`

When building `ComposedProjectInput.modules`, the executor must map project module aliases to canonical module manifest names.

Example:

```json
{
  "modules": {
    "identity": { "package": "rntme_identity_auth0" }
  }
}
```

with catalog metadata:

```json
{
  "categoryToModule": {
    "identity": "@rntme/identity-auth0"
  },
  "moduleEdgeAuth": {
    "@rntme/identity-auth0": {
      "kind": "introspection-sidecar",
      "transport": "http",
      "method": "GET",
      "path": "/introspect",
      "port": 50052
    }
  }
}
```

must produce:

```ts
modules["identity-auth0"].edgeAuth.port === 50052
```

The executor may also provide an alias key for compatibility, but `deploy-core` must be able to resolve the canonical service slug used by `middleware.auth.moduleSlug`.

### 7.2 Auth module manifest completeness

Blueprint/catalog validation must reject a project that mounts `kind: "auth"` middleware against a module that does not declare `module.json#capabilities.edgeAuth`.

This failure must happen before Dokploy apply.

The error should point to the module capability path and the middleware that requires it.

### 7.3 Deployment logs and failures

The executor must append enough log evidence to understand:

- selected project version seq/id,
- selected target slug/id,
- deploy-core plan success/failure,
- rendered plan digest,
- each apply resource action,
- smoke check names and outcomes,
- Dokploy task rejection or failed task status after deploy/start.

If apply or post-apply task inspection finds a rejected/failed resource, the deployment status must be `failed`.

## 8. Dokploy apply hardening

`deploy-dokploy` remains the package that owns target rendering/apply semantics. `apps/platform-http` provides the concrete Dokploy HTTP client implementation through the existing `DokployClient` seam.

### 8.1 File mounts are idempotent

For each rendered application file, the Dokploy client must:

1. List mounts with `mounts.listByServiceId`.
2. Match existing mounts by `mountPath`.
3. Update the matching mount when content changed.
4. Create a mount when missing.
5. Remove duplicate stale mounts for the same `mountPath`.

Duplicate file mounts for the same target path are invalid because they make container behavior order-dependent and can leave old config active.

### 8.2 Dokploy-compatible `filePath`

The client must use a `filePath` convention that Dokploy materializes as a real host source file for Swarm bind mounts.

Acceptance:

- Rendered `/etc/nginx/nginx.conf` and `/srv/config.json` mounts must produce host files that Swarm can bind.
- A deploy must not leave the service in a loop with `invalid mount config for type "bind": bind source path does not exist`.
- Unit tests should lock the request bodies for file mount create/update.
- Integration or contract tests should simulate existing duplicate mounts and verify cleanup.

### 8.3 Config changes update the running service

After files, env, image, or domain config changes, the apply path must drive Dokploy so the running Swarm service receives the new spec.

Acceptance:

- Re-deploying a changed edge `nginx.conf` leads to a running task using the new config.
- The deployment does not rely on direct MCP/manual `application.stop`, `application.start`, or hand-created host files.
- If Dokploy requires `application.start` or another operation after `application.deploy`, that sequence is encoded in the client/apply path.

### 8.4 Task status is part of apply success

Dokploy API returning success for `application.deploy` is not sufficient.

For application resources, apply must either:

- verify the resource reaches a running/done state with no rejected running task; or
- return a structured partial failure with enough diagnostic detail.

This check may live in the platform concrete client if the generic package seam does not expose Dokploy task inspection yet. The design intent is that platform deployment status reflects actual resource health, not just API request success.

## 9. Nginx and edge auth rendering

Nginx config is generated from `packages/deploy/deploy-dokploy/src/nginx.ts`. Direct edits in Dokploy are not source of truth.

For `kind: "auth"` middleware, rendered Nginx must include:

- an internal `/_rntme_auth_<moduleSlug>__<audHash>` location;
- `auth_request` on protected routes;
- forwarding of `Authorization` and literal `X-Rntme-Audience` to the module HTTP introspection endpoint;
- `auth_request_set` for advisory user/audience headers;
- a named 401 fallback returning `application/json`;
- `/config.json` serving the public SPA config.

The Auth0 module HTTP introspection endpoint remains the validator. Nginx does not validate JWTs itself.

## 10. Smoke verification

Smoke verification is a required deployment stage.

### 10.1 Required checks

For each deployment with public ingress:

1. `GET <publicBaseUrl>/health` -> `200`.
2. `GET <uiUrl or publicBaseUrl>/` -> `200 text/html` when a UI route exists.
3. `GET <publicBaseUrl>/config.json` -> `200 application/json` when the rendered edge contains public config.
4. For every auth-protected HTTP route with a representative smoke path, an unauthenticated request must return `401 application/json`.

The notes-demo representative protected API checks are:

- `GET /api/notes` -> `401 application/json`
- `POST /api/notes` -> `401 application/json`

### 10.2 Failure semantics

Critical checks fail the deployment:

- health check non-200,
- UI route non-200,
- config route non-200 or invalid JSON,
- protected API returning `500`, `200`, `404`, timeout, network error, or non-JSON.

Optional checks may still produce `succeeded_with_warnings`, but protected auth smoke is critical.

### 10.3 Smoke path source

The first implementation may use rendered/apply verification hints for known protected paths. It must cover notes-demo.

A later enhancement can derive method-aware protected smoke paths from route/bindings metadata more generally.

## 11. Test plan

CLI:

- `project deploy` requires `--version` and `--target`.
- `project deploy` sends the expected JSON body to the platform endpoint.
- `deployment list/show/watch` call the correct endpoints.
- `watch` streams incremental logs and exits with the defined exit code per terminal status.

Platform API/use-cases:

- `StartDeploymentRequestSchema` rejects missing `targetSlug`.
- UI route submits explicit target slug.
- JSON route schedules deployment through the same executor callback.

Executor:

- Alias package `rntme_identity_auth0` plus `categoryToModule.identity = "@rntme/identity-auth0"` produces `modules["identity-auth0"].edgeAuth`.
- Missing `edgeAuth` for mounted auth middleware fails before apply.
- Dokploy rejected/failed task diagnostics finalize deployment as `failed`.

Deploy-dokploy / platform Dokploy client:

- Existing file mounts are updated, not duplicated.
- Duplicate mounts for the same `mountPath` are removed.
- Create/update mount request bodies use the chosen Dokploy-compatible `filePath`.
- Changed files trigger the deploy/start sequence required to refresh the running service.

Nginx:

- Auth middleware renders `auth_request`.
- Internal introspection location points at the module HTTP port from `edgeAuth`.
- 401 fallback returns canonical JSON.
- Unprotected routes do not get auth middleware.

Smoke verifier:

- `/health`, `/`, `/config.json`, protected `GET /api/notes`, protected `POST /api/notes` success cases.
- Protected route returning `500 BINDINGS_RUNTIME_EXPRESSION_ERROR` fails deployment.
- Protected route returning `401` with JSON passes.

Notes demo:

- Composed `demo/notes-blueprint` carries `@rntme/identity-auth0` `edgeAuth` through the catalog.

## 12. Rollout

1. Add CLI remote deployment commands and response schemas.
2. Tighten platform start-deployment schema to require `targetSlug`.
3. Harden executor conversion from composed blueprint to `ComposedProjectInput`.
4. Add Auth0 module `edgeAuth` validation coverage for notes-demo.
5. Harden Dokploy file mount update/cleanup behavior.
6. Add resource health/task failure detection to apply/executor.
7. Expand smoke verification to include protected API 401 checks.
8. Update docs.

This order keeps the user-facing CLI surface connected to the same platform path while hardening the failures that previously forced direct Dokploy intervention.

## 13. Documentation touch

Update these docs in the implementation PR:

- `apps/cli/README.md` - add `project deploy` and `project deployment <list|show|watch>`, remove "CLI does not bundle deploy commands".
- `apps/platform-http/README.md` - note explicit target slug for deploy starts and protected API smoke checks.
- `packages/deploy/deploy-dokploy/README.md` - document file mount idempotency, duplicate cleanup, and post-apply task status expectations.
- `packages/deploy/deploy-core/README.md` - ensure edge auth planner requirements match the canonical module mapping expectations.
- `demo/notes-blueprint/README.md` - document expected production smoke behavior for unauthenticated protected API calls.
- `AGENTS.md` §6.14 if CLI deploy incantations become part of the canonical deploy workflow.

## 14. Follow-up: deploy drift/reconcile

This spec intentionally does not build a generic reconciler.

After CLI remote-deploy hardening lands, create a separate **Deploy Drift/Reconcile** spec covering:

- desired-vs-actual Dokploy state comparison;
- detecting stale file mounts, stale domains, stale images, stopped services, and missing resources;
- safe repair actions;
- dry-run reporting;
- audit logs for repair;
- operator-facing CLI/platform UI surfaces;
- limits that prevent destructive surprises.

The goal of the current spec is to make normal deployment reliable enough that direct Dokploy intervention is not part of the expected workflow. The reconciler is the next layer, not a prerequisite for this MVP.
