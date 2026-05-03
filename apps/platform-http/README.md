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
it, plans with `@rntme/deploy-core`, applies with
`@rntme/deploy-dokploy`, writes sanitized logs, records apply/smoke
evidence, and finalizes stale running jobs through the orphan detector.

Smoke verification is critical for public ingress. The executor checks `/health`, the UI route when present, `/config.json` when public config is rendered, and notes-demo protected API regressions: unauthenticated `GET /api/notes` and `POST /api/notes` must return `401 application/json`.

Deploy targets may point at an external Kafka/Redpanda bus or request a
provisioned Redpanda bus. Provisioned Redpanda is rendered by
`@rntme/deploy-dokploy` as an internal Dokploy Compose resource with a
persistent named volume. It is explicit per deploy target; missing `eventBus`
config remains invalid.

The deploy executor runs five ordered phases: `plan → provision → render → apply → verify`. The provision phase calls each module's `provisioner` (if declared) to reconcile external state and collect `provisionResult` / `provisionResultCiphertext` before the render phase bakes those outputs into resource env entries. Public provisioner outputs persist as JSONB on `deployment.provisionResult`; secret outputs persist encrypted as `deployment.provisionResultCiphertext`.

Target secrets are per-deploy-target credential blobs validated against a registered schema and stored encrypted. Routes:

- `PUT /v1/orgs/:orgSlug/deploy-targets/:slug/secrets/:name` — upsert a secret; body `{ schema, value }`. `value` is validated against the registered schema; stored encrypted; never returned by GET.
- `DELETE /v1/orgs/:orgSlug/deploy-targets/:slug/secrets/:name` — remove a named secret.
- `GET /v1/orgs/:orgSlug/deploy-targets/:slug/secrets` — list secret names (no values).

The deploy executor's `readUiRuntimeCss` looks for the bundled SPA stylesheet
in `packages/runtime/ui-runtime/build/main.css` first, then falls back to the
legacy `packages/ui-runtime/build/main.css`. The legacy location predates the
2026-04-30 merge-back relocation; remove the fallback once no working tree
relies on it.

UI module client bundles are emitted as minified ESM chunks with source maps
omitted from Dokploy file mounts. The Dokploy adapter lists existing
application mounts through `mounts.listByServiceId` before create/update so
re-deploys update the current files instead of recreating duplicate mounts.

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

## Not in the UI (MVP)

- Creating / renaming / archiving projects — CLI only.
- Publishing project versions — CLI only.
- Creating or editing deploy targets — REST only in the current MVP.
- Creating organizations — use the WorkOS Admin Portal.
- Toggling archived visibility.
- Client-side SPA state or infinite scroll.
