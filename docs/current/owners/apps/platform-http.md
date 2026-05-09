# @rntme/platform-http

Hono HTTP server that wires `@rntme/platform-core` use-cases to the REST surface and server-rendered UI at `platform.rntme.com`. WorkOS AuthKit handles humans with auto-refreshing sealed sessions; bearer API tokens handle machines.

## Surfaces

This service exposes two surfaces on the same origin:

- **`/v1/*` — JSON REST API.** Documented via `/openapi.json` (OpenAPI 3.1). Used by the CLI and external integrations. Authentication via WorkOS AuthKit cookie (humans) or `Authorization: Bearer rntme_pat_…` (machines).
- **`/` — Browser UI.** Server-rendered dashboard (Hono JSX + htmx + Tailwind CDN) mounted beside the `/v1` sub-app. Lets an authenticated user browse orgs / projects / project versions / deploy targets / deployments / audit log and manage API tokens.

## UI routes

| Path | Purpose |
| --- | --- |
| `GET /` | Authed: 302 to `/{orgSlug}`. Unauth: 302 to `/login` |
| `GET /login` | Public sign-in landing with CTA to `/v1/auth/login` |
| `GET /no-org` | Authed user has no org membership yet |
| `GET /{orgSlug}` | Projects list |
| `GET /{orgSlug}/projects/{projSlug}` | Project detail + project versions list |
| `GET /{orgSlug}/projects/{projSlug}/versions/{seq}` | Project version detail |
| `GET /{orgSlug}/deploy-targets` | Deploy target list |
| `GET /{orgSlug}/deploy-targets/{targetSlug}` | Deploy target detail |
| `POST /{orgSlug}/projects/{projSlug}/deployments` | Start deployment from the selected project version |
| `GET /{orgSlug}/projects/{projSlug}/deployments` | Deployment history |
| `GET /{orgSlug}/projects/{projSlug}/deployments/{deploymentId}` | Deployment detail with polling status/logs |
| `GET /{orgSlug}/tokens` | API tokens list (+ create form if `token:manage` scope) |
| `POST /{orgSlug}/tokens` | Create token (htmx) — returns new `<tr>` + one-time plaintext banner |
| `DELETE /{orgSlug}/tokens/{id}` | Revoke token (htmx) — returns updated row with "revoked" badge |
| `GET /{orgSlug}/audit` | Audit log |
| `POST /logout` | Clears session cookie, redirects to WorkOS logout URL |

## Auth flow

1. `/` (unauth) → `/login`.
2. `/login` links to `/v1/auth/login` → WorkOS AuthKit.
3. WorkOS redirects to `/v1/auth/callback?code=…`. Callback upserts account + org, sets `rntme_session` sealed cookie on `.rntme.com`, and:
   - If request accepts JSON — returns JSON (CLI / tests).
   - Otherwise — 302 to `/`.
4. Authed `/` → `/{orgSlug}`. Session refresh is automatic through the WorkOS-backed provider; failed refresh clears the sealed cookie and returns the user to login.

## Session cookie

- Name: `rntme_session`
- Domain: `PLATFORM_SESSION_COOKIE_DOMAIN` (`.rntme.com` in prod).
- `HttpOnly`, `Secure`, `SameSite=Lax`.
- Max age 30 days.
- Refresh: WorkOS session refresh is attempted before expiry and reseals the cookie when the provider returns a fresh payload.

## CSRF

UI mutations (`POST /:orgSlug/tokens`, `DELETE /:orgSlug/tokens/:id`, `POST /:orgSlug/projects/:projSlug/deployments`, `POST /logout`) verify `Origin` or `Referer` against `PLATFORM_BASE_URL` via `sameOriginOnly`. The `/v1/*` JSON API does not use this guard — bearer tokens provide the CSRF defence.

## Deploy runtime

Deployment starts require an explicit `targetSlug` from both JSON API callers and the UI form. The platform records the deployment, schedules the same `runDeployment` executor used by UI-triggered deploys, and logs the selected project version, selected target, render digest, apply actions, and smoke results.

## Error logging

The global Hono `onError` handler logs unhandled exceptions before returning a
sanitized `PLATFORM_INTERNAL` response. Log fields include `err`, `requestId`,
HTTP method, concrete path, matched route, and `status: 500`; response bodies
do not include exception messages or stack traces.

## Project lifecycle operations

Project update/delete operations are exposed under
`/v1/orgs/:orgSlug/projects/:projSlug/operations` and on the project UI page.
Update queues a deployment for an explicit `targetSlug`; delete moves the
project through `deleting` to either `decommissioned` or `delete_failed`.
Operation detail pages poll status and logs, and delete scheduling uses the
same background executor/orphan detection pattern as deployments.

The JSON routes are:

- `POST /operations/update` with `{ "projectVersionSeq": 4, "targetSlug": "dokploy-preview" }`
- `POST /operations/delete` with `{ "confirm": "<project-slug>" }`
- `GET /operations`, `GET /operations/:id`, `GET /operations/:id/logs`

Deploy-target REST routes require `deploy:target:manage`; start deployment
requires `deploy:execute`; deployment reads require `project:read`. The
background executor fetches the immutable project-version bundle, revalidates
it, materializes validated JSON files plus base64 `assets` such as provisioner
entries and workflow BPMN files, plans with `@rntme/deploy-core`, applies with
`@rntme/deploy-dokploy`, writes sanitized logs, records apply/smoke
evidence, and finalizes stale running jobs through the orphan detector.

Smoke verification is critical for public ingress. The executor checks `/health`, the UI route when present, `/config.json` when public config is rendered, and notes-demo protected API regressions: unauthenticated `GET /api/notes` and `POST /api/notes` must return `401 application/json`.

Deploy targets may point at an external Kafka/Redpanda bus or request a
provisioned Redpanda bus. Provisioned Redpanda is rendered by
`@rntme/deploy-dokploy` as an internal Dokploy Compose resource with a
persistent named volume. It is explicit per deploy target; missing `eventBus`
config remains invalid.

## Deploy executor stage order

Stages run in this sequence:

1. `compose` — resolve composed project from blueprint.
2. `plan` (bus-mode log only) — log which event-bus mode is in use, derived directly from `config.eventBus.mode`.
3. `provision` — run module provisioners; persist `provisionResult` and `secretOutputs`.
4. `plan` — `buildProjectDeploymentPlan(input, config, { provisionResult, discoveredModules })`. Vars resolve here; `provision.*` sources see the freshly-produced outputs.
5. `render` — `renderDokployPlan(plan, config, provisioned, envMappings)`.
6. `apply` — `applyDokployPlan(...)`.
7. `verify` — smoke checks.

Provision runs before plan so blueprint vars can pull from `provisionResult`. Public provisioner outputs persist as JSONB on `deployment.provisionResult`; secret outputs persist encrypted as `deployment.provisionResultCiphertext`.

## Pre-apply target-secret validation

After `buildProjectDeploymentPlan` returns successfully, the executor validates
`plan.requiredTargetSecrets` before calling `renderDokployPlan` or
`applyDokployPlan`. For each required secret:

1. Looks up the secret by `secretRef` in the target's secret repo.
2. Verifies the stored schema matches the required schema.
3. Decrypts the value and runs `parseTargetSecret` from `@rntme/platform-core`.
4. Stores the validated value in `resolvedTargetSecrets` for the Dokploy client
   factory to use when resolving secret-file mounts.

Failure at any step finalizes the deployment as failed with one of:

- `DEPLOY_EXECUTOR_TARGET_SECRET_MISSING` — secret not found on target.
- `DEPLOY_EXECUTOR_TARGET_SECRET_SCHEMA_MISMATCH` — stored schema does not match
  required schema.
- `DEPLOY_EXECUTOR_TARGET_SECRET_INVALID` — decrypted value fails schema
  validation.

This ordering guarantees that missing or misconfigured secrets are caught before
any Dokploy resources are created or updated.

## Smoke checks for Operaton UI

When the rendered plan includes `urls.operatonUiAuthChecks`, the smoke verifier
runs two checks per URL:

- **No-auth** — `GET` without an `Authorization` header must return `401`.
- **Invalid Basic Auth** — `GET` with `Basic invalid:invalid` must return `401`.

These checks verify that Nginx Basic Auth is active before the deployment is
marked successful. Valid credentials are not tested during smoke; those are
verified manually after deploy.

### Manual evidence checklist

After a workflow deployment succeeds, confirm the following manually:

1. Operaton UI loads at the configured `publicBaseUrl` with valid Basic Auth.
2. BPMN processes are visible in the Operaton cockpit.
3. The `bpmn-worker` application logs show successful subscriptions to the
   provisioned Redpanda topics.
4. Workflow service-task bindings resolve to the correct gRPC endpoints.

## Reading deployment logs

The Dokploy MCP `application-readLogs` tool is unreliable for this codebase — it has been observed to return `success: true` with an empty body, and to 500 when given the `search` filter (verified 2026-05-04). Until the MCP is fixed, read logs via SSH:

```bash
ssh dokploy-host
docker service ls | grep <project-slug>
docker service logs <service-id> --tail 500 --since 10m
```

The service ID can also be retrieved via `mcp__dokploy__docker-getServiceContainersByAppName` (returns `containerId` plus state). Once the SSH-based runbook stabilizes, document a one-line wrapper script.

## Provision phase

The provision stage resolves each module's provisioner from the materialized
bundle's `assets/` directory. Resolution path:
`<tmpDir>/assets/provisioners/<safeProvisionerName(manifest.name)>.entry.js`.
Modules are not loaded from the platform-http process's own `node_modules`.
Workflow BPMN assets are materialized at their project-relative paths under
`<tmpDir>/workflows/` before blueprint composition so workflow validation and
deploy planning see the same files that were published.

Bundle versions higher than 2 are rejected with
`DEPLOY_BUNDLE_VERSION_UNSUPPORTED`. Bundles with `version: 1` are read with
`assets = {}` and skip provisioning if the bundled manifest has no provisioner
block.

Target secrets are per-deploy-target credential blobs validated against a registered schema and stored encrypted. Routes:

- `PUT /v1/orgs/:orgSlug/deploy-targets/:slug/secrets/:name` — upsert a secret; body `{ schema, value }`. `value` is validated against the registered schema; stored encrypted; never returned by GET.
- `DELETE /v1/orgs/:orgSlug/deploy-targets/:slug/secrets/:name` — remove a named secret.
- `GET /v1/orgs/:orgSlug/deploy-targets/:slug/secrets` — list secret names (no values).

The deploy executor's `readUiRuntimeCss` looks for the bundled SPA stylesheet
in `packages/runtime/ui-runtime/build/main.css` first, then falls back to the
legacy `packages/ui-runtime/build/main.css`. The legacy location predates the
2026-04-30 merge-back relocation; remove the fallback once no working tree
relies on it.

Generated runtime `manifest.json` files for domain services enable both HTTP
port `3000` and gRPC port `50051`. The BPMN worker uses those deterministic
gRPC surfaces when calling workflow service-task action bindings.

Domain services no longer ship executable `commands/handlers.mjs` files. The
deploy executor relies on Graph IR operation artifacts and generated runtime
manifests instead of copying service-local command handlers.

UI module client bundles are emitted as minified ESM chunks with source maps
omitted from Dokploy file mounts. The Dokploy adapter lists existing
application mounts through `mounts.listByServiceId` before create/update so
re-deploys update the current files instead of recreating duplicate mounts.

## Workflow deploy support

Project-version bundles may include workflow BPMN assets. During deployment,
the executor materializes those assets under `<tmpDir>/workflows/`, composes the
blueprint so `@rntme/workflows` can validate event and binding refs, reads the
referenced BPMN files into `ComposedProjectInput.workflowFiles`, and passes the
deploy target's `workflows` config through `ProjectDeploymentConfig`.

The executor records smoke evidence after apply. For workflow deployments, the
apply result must include the Operaton compose resource and the `bpmn-worker`
application, and the package-level workflow tests cover both order-fulfillment
branches through the worker/service-task path. Public ingress smoke remains
`/health`, UI, `/config.json`, and protected API checks when applicable.

Manual **Redpanda Console** validation: when configured on the deploy target /
deployment override, apply wires basic-auth nginx in front of the internal
Console; smoke checks probe the public URL without credentials and with invalid
Basic Auth (expect 401).

## Security headers (UI only)

Applied by `securityHeaders()` middleware on UI responses:

- `Content-Security-Policy` with `'self'` + `cdn.tailwindcss.com` + `unpkg.com` allowlists.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.

## Development

```bash
pnpm -F @rntme/platform-http test       # unit + e2e (testcontainers)
pnpm -F @rntme/platform-http typecheck
pnpm -F @rntme/platform-http lint
pnpm -F @rntme/platform-http build      # tsc (includes TSX)
pnpm -F @rntme/platform-http start      # runs dist/bin/server.js
```

## Env vars

See `src/config/env.ts`. Required: `DATABASE_URL`, `RUSTFS_*`, `WORKOS_*`, `PLATFORM_BASE_URL`, `PLATFORM_SESSION_COOKIE_DOMAIN`, `PLATFORM_COOKIE_PASSWORD` (≥32 chars), `PLATFORM_SECRET_ENCRYPTION_KEY` (64 hex chars).

## Blueprint runtime mode

`PLATFORM_RUNTIME_MODE=blueprint` runs the platform-as-blueprint runtime and
does not expose legacy `/v1/*` platform routes. Legacy mode remains only as a
temporary migration fallback until production cutover is complete.

## Not in the UI (MVP)

- Creating / renaming / archiving projects — CLI only.
- Publishing project versions — CLI only.
- Creating or editing deploy targets — REST only in the current MVP.
- Creating organizations — use the WorkOS Admin Portal.
- Toggling archived visibility.
- Client-side SPA state or infinite scroll.
