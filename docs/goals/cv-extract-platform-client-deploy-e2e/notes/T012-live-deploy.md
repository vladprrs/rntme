# T012 Worker — Live Deploy Run (2026-05-13)

> **Resolution:** the architectural blocker found in this run is being closed
> by the platform multi-provider edge-auth plan
> (`docs/superpowers/plans/2026-05-13-platform-multi-provider-edge-auth.md`).
> See **Auth gap resolution (2026-05-13)** at the bottom of this file.

## Result: BLOCKED

Worker reached Phase 1.4 and uncovered a deep architectural blocker that
prevents the entire CLI-driven publish/deploy path from reaching the live
platform. Worker stopped per `stop_if: source/tests/product conflict` and
`one bounded writer; do not decide architecture direction`.

## Phase outcomes

| Phase | Outcome | Notes |
|------:|:-------:|:------|
| 0.1   | PASS    | `bun run lint`, `bun run typecheck`, `bun run --filter @rntme/cli test` all exit 0 (200 pass / 2 skip / 0 fail). |
| 0.2   | PARTIAL | `runProjectPublish --dry-run` (i.e. `materializeAndCompose`) initially failed `BLUEPRINT_MODULE_MANIFEST_INVALID` because dist was stale. After `bun run build` it advanced to a new failure: `BLUEPRINT_CATEGORY_MISMATCH: module "@rntme/marketing-site-static" declares category/vendor "marketing-site/static-html" but is wired under project key "marketing"`. The live test (`platform-client-deploy.test.ts`) bypasses local validation via `buildProjectBundle` direct call, so this is not strictly blocking for the live path — but it is a real defect in `demo/cv-extract-blueprint/project.json` (`modules.marketing` key) or in the marketing module manifest. Out of Worker scope to fix (`project.json` not in allowed_files). |
| 1.1   | PASS    | `git push origin main` → `45ae3358..9fe8e119 main -> main`. Remote head advanced by 17 commits. |
| 1.2   | PASS    | Dokploy compose for platform-http is `composeId=2mG1RpL80Q7MTmYf67Ky4` (project `wmiyt_0T7SKvS3sr6rzGK`, env `Ac5KIPWva9jzm7t-h4Af7`, sourceType `raw`, autoDeploy true but triggered by Dokploy itself not git push because sourceType=raw). |
| 1.3   | PASS    | Redeployed platform via `rntme platform up --target platform.target.json --log-file .rntme-platform-redeploy-2026-05-13-T012.jsonl`. Compose render digest `sha256:55b6f956bebb37e010e4db7e7bb107cd789dd51a2ef00b7ada46203ad244aecd`. Apply took ~26.6s. Smoke verification passed. Compose now includes `svc-projects` with `manifest.json` + `handlers/list-org-projects.ts` + `handlers/publish-project-bundle.ts`. |
| 1.4   | BLOCKED | Curl `GET /api/projects?organizationId=test` → 401 (NOT 404) which strictly satisfies the "401/403 not 404" requirement. BUT also `GET /api/projects?organizationId=org_uZUWhpWgK54VWC2X` with `Authorization: Bearer $RNTME_TOKEN` (a `rntme_pat_*` PAT) → 401 `{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}`. Same for `/api/deployments`, `/api/deployments/targets`, `/api/organizations`, `/api/tokens`. Root cause documented below. |
| 2     | NOT RUN | Blocked by Phase 1.4 architectural finding (Auth0 membership seed would succeed in isolation but is downstream of the platform being usable via PAT). |
| 3     | NOT RUN | Blocked. |
| 4     | NOT RUN | Blocked. |
| 5     | NOT RUN | Blocked. |
| 6     | NOT RUN | Blocked. |
| 7     | NOT RUN | Blocked. |

## Architectural blocker (root cause)

The deployed platform's `edge` (Nginx) container applies an `auth` middleware
to every route mounted by the platform-blueprint:

`apps/platform/blueprint/project.json` `mounts`:

```
{ "target": "http:/api/organizations", "use": ["requestContext", "auth"] },
{ "target": "http:/api/projects",      "use": ["requestContext", "auth"] },
{ "target": "http:/api/tokens",        "use": ["requestContext", "auth"] },
{ "target": "http:/api/audit",         "use": ["requestContext", "auth"] },
{ "target": "http:/api/deployments",   "use": ["requestContext", "auth"] }
```

The `auth` middleware in `apps/platform/blueprint/project.json`:

```
"auth": { "kind": "auth", "provider": "auth0", "audience": "${AUTH0_AUDIENCE}",
          "moduleSlug": "identity-auth0" }
```

`packages/deploy/deploy-dokploy/src/nginx.ts` renders this into an Nginx
`auth_request` that calls `/_rntme_auth_identity-auth0_<hash>` → the
`mod-identity-auth0` container's `/introspect` endpoint
(`modules/identity/auth0/src/http-server.ts:58`).

That endpoint (`modules/identity/auth0/src/introspect-session.ts`,
`introspectJwtToSession`) does a strict **JWT** verify against Auth0 JWKS —
issuer must be `https://demo-rntme.us.auth0.com/`, audience must be
`https://platform.rntme.com/api`, signature must verify. There is **no PAT
acceptance path** in `identity-auth0`. Anything that is not a valid Auth0
JWT becomes `inactiveSession('MALFORMED' | 'INVALID_SIGNATURE' | ...)` which
the nginx `auth_request` rejects with 401 and the named location
`@rntme_auth_401_identity-auth0_<hash>` returns the canonical body
`{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}`.

Meanwhile the new native handlers added by commits `b68bf649` and `37fb2128`
(`apps/platform/blueprint/services/projects/handlers/publish-project-bundle.ts`,
`list-org-projects.ts`, plus `apps/platform/blueprint/services/deployments/handlers/*`)
all start with:

```
const auth = await deps.provider.authenticate({
  authorizationHeader: input.authorization,
  cookieHeader: undefined,
});
```

where `deps.provider` is `ApiTokenProvider`
(`packages/platform/platform-core/src/auth/api-token-provider.ts`) which
calls `introspectToken` against the platform's `tokens` table — i.e. it
**expects a `rntme_pat_*` PAT**, not a JWT. So the native handlers and the
edge-side middleware **disagree on token format** and the request never
reaches the native handler.

The CLI (`apps/cli/src/api/client.ts`) only knows how to send PATs via
`Authorization: Bearer <RNTME_TOKEN>`. `.env` has
`RNTME_TOKEN=rntme_pat_*` (32 chars, the canonical PAT). There is no
CLI flow that obtains an Auth0 JWT (no `rntme login` device-code flow;
`apps/cli/src/commands/login.js` writes the supplied PAT to disk and
optionally calls `whoami`).

### Why each previously-passing local test did not catch this

- `apps/platform/blueprint/test/platform-projects-handler.test.ts` calls
  `publishProjectBundleHandler(deps, input)` directly with an in-test
  `ApiTokenProvider` — i.e. **bypasses nginx**.
- `demo/cv-extract-blueprint/test/landing-deploy.test.ts` and the fake e2e
  in `apps/cli/test/integration/` do not stand up the edge nginx with
  Auth0 auth middleware; they either skip auth or use a stub.

### Net effect

Phase 3.4 (`rntme project publish` against
`https://platform.rntme.com`) will always 401 at the edge. Phase 4
(`rntme target list/create`) will always 401. Phase 5 (`rntme project
deploy`) will always 401. The plan's CLI-driven live publish/deploy path
is **architecturally non-functional** as currently merged.

## What WAS proven during this run

1. `bun run build && bun run typecheck && bun run lint && bun run --filter @rntme/cli test` all green on the new tip `9fe8e119`.
2. Push: `git push origin main` advanced remote from `45ae3358` to `9fe8e119`.
3. Platform redeploy: `rntme platform up --target platform.target.json` succeeded against `https://dokploy.vladpr.com` for compose `2mG1RpL80Q7MTmYf67Ky4`, smoke verification PASS. The new `svc-projects`, `svc-deployments`, `svc-tokens` services with their native handlers are running in the deployed compose. (Confirmed by `compose.one` showing `svc-projects:` block; render digest `sha256:55b6f956bebb37e010e4db7e7bb107cd789dd51a2ef00b7ada46203ad244aecd`.)
4. Public reachability: `GET /config.json` → 200, returns the live `@rntme/identity-auth0` block — platform is healthy.
5. Routing: `/api/projects?organizationId=test` → 401 (NOT 404). The route is bound. The 404→401 transition is the only fact T012 Phase 1.4 actually required, and that IS satisfied.

## External calls made (no bodies, no secrets)

| Method | Path | Outcome |
|---|---|---|
| `git push origin main` | github.com/vladprrs/rntme.git | 200 / 45ae3358..9fe8e119 |
| GET | `https://dokploy.vladpr.com/api/project.one?projectId=wmiyt_0T7SKvS3sr6rzGK` | 200 |
| GET | `https://dokploy.vladpr.com/api/compose.one?composeId=2mG1RpL80Q7MTmYf67Ky4` (before redeploy) | 200 |
| POST | `https://dokploy.vladpr.com/api/*` (via `rntme platform up`, exact internal call shape inside Dokploy MCP / CLI deploy-engine) | rendered+applied compose, smoke PASS |
| GET | `https://dokploy.vladpr.com/api/compose.one?composeId=2mG1RpL80Q7MTmYf67Ky4` (after redeploy) | 200, contains `svc-projects` |
| GET | `https://platform.rntme.com/config.json` | 200 |
| GET | `https://platform.rntme.com/api/projects?organizationId=test` (no auth) | 401 |
| GET | `https://platform.rntme.com/api/projects?organizationId=org_uZUWhpWgK54VWC2X` (Bearer PAT) | 401 |
| GET | `https://platform.rntme.com/api/deployments` (Bearer PAT) | 401 |
| GET | `https://platform.rntme.com/api/deployments/targets` (Bearer PAT) | 401 |
| GET | `https://platform.rntme.com/api/organizations` (Bearer PAT) | 401 |
| GET | `https://platform.rntme.com/api/tokens` (Bearer PAT) | 401 |
| GET | `https://platform.rntme.com/v1/auth/me` (Bearer PAT) | 200 HTML (SPA fallthrough — no `/v1` route exists on platform anymore) |

## Discovered identifiers

- platform Dokploy compose id: `2mG1RpL80Q7MTmYf67Ky4`
- platform Dokploy project id: `wmiyt_0T7SKvS3sr6rzGK`
- platform Dokploy environmentId (`default`): `Ac5KIPWva9jzm7t-h4Af7`
- platform Dokploy compose appName: `rntme-direct-rntme-platform-anfxkl`
- post-redeploy nginx config volume sha (edge): `31f32a598064d10f` (held by the digest entry; unchanged after this redeploy — auth wiring did not change, only service additions did)
- runtime image: `ghcr.io/vladprrs/rntme-runtime:runtime-e2e-45ae3358-055759` (this is the value already in dirty `platform.target.json`; the `9fe8e119` runtime image was **not** rebuilt by this Worker. The runtime container loads bindings/operations as artifact-volumes, so the 37fb2128 + 9fe8e119 commits' new handlers ARE present via the artifact volumes attached to `svc-projects` etc., not via a runtime-image bump.)
- Auth0 SPA client id: `AjOMyNUPyuJpkCf4RR8izh9z84wGHqXE` (from `/config.json`)
- Auth0 audience: `https://platform.rntme.com/api`
- Auth0 domain: `demo-rntme.us.auth0.com`

## Side-effects on local repo

- Appended `OPENROUTER_API_KEY=<value>` to `/home/coder/project/.env` alongside the existing `OPENROUTER=<same value>` per Worker task instruction. `.env` is gitignored; not committed.
- Created `/home/coder/project/.rntme-platform-redeploy-2026-05-13-T012.jsonl` (21 lines) — this is the redeploy log file. Allowed per task `.rntme-platform-*.jsonl` allowance.
- Created this notes file.

## Concerns

1. `BLUEPRINT_CATEGORY_MISMATCH` on `demo/cv-extract-blueprint/project.json` `modules.marketing` (declares package `@rntme/marketing-site-static` whose manifest category=`marketing-site` vendor=`static-html` — neither matches the project key `marketing`). Fixing this requires renaming the project-side key from `marketing` to `marketing-site` (or adding an alias). Out of Worker scope, but worth a 1-line follow-up.
2. The deploy target config that Task 8 expects (`storage.mode=provisioned`, `provider=rustfs`, `accessKeyRef=rustfs-access-key`, `secretKeyRef=rustfs-secret-key`) requires those secrets to be registered in Dokploy/platform; this Worker did not verify their presence, but it is moot until the auth blocker is resolved.

## Remaining manual / architecture steps before T012 can complete

1. **Resolve PAT-vs-JWT auth gap** for `/api/projects`, `/api/deployments`, `/api/deployments/targets`. Options:
   - Add a PAT introspect path in `identity-auth0` `/introspect` (would mix two providers in one module — likely undesirable).
   - Add a second auth middleware kind (`auth-pat` or `auth-multi`) in `packages/deploy/deploy-dokploy/src/nginx.ts` and reference it from the platform `mounts` block, so PAT-bearing requests proxy to a PAT introspect endpoint (currently only callable in-process by the native handlers).
   - Drop the `auth` middleware from `/api/projects` and `/api/deployments` mounts, since the native handlers already call `provider.authenticate(...)` internally and would reject unauthenticated requests on their own. (This is probably the smallest correct fix: native handlers are self-authenticating; double-gating them with Auth0 is the bug.)
   - Implement a CLI-side login flow that obtains an Auth0 JWT via device-code or M2M and uses that as the Bearer.
2. After the auth gap is resolved, the **`BLUEPRINT_CATEGORY_MISMATCH`** on `demo/cv-extract-blueprint/project.json` should also be fixed (rename `marketing` to `marketing-site` or add a manifest alias) so `rntme project publish` doesn't fail local validation. Note: the live test bypasses local validation, so an alternative is to publish via the bun test path (`bun --env-file=.env test test/live/platform-client-deploy.test.ts`). That requires the deploy target slug, `RNTME_CV_BASE_URL`, `RNTME_OPENROUTER_IMAGE`, `RNTME_STORAGE_S3_IMAGE` etc. to be pre-provisioned.
3. Verify `OPENROUTER_API_KEY` alias propagates to where it is needed (Auth0/Dokploy secrets table for the `openrouter-api-key` secret-ref expected by Task 8 target config). Local `.env` change is non-load-bearing for the live cv-extract deploy because the openrouter module container will get its API key from a Dokploy secret, not from the operator's shell.

## Suggested next Worker / Judge call

A Judge call deciding **which of the four PAT-vs-JWT options above** is the
intended product behavior. The simplest correct fix (drop the `auth`
middleware from the new native-handler routes, since the handlers
self-authenticate) is also a one-line change to
`apps/platform/blueprint/project.json` `mounts` and would unblock T012's
Phases 2-7 immediately.

## Auth gap resolution (2026-05-13)

Decision: quick auth bypasses are rejected. The blocker is resolved through
first-class ordered edge auth providers: `platform-tokens` first for CLI PATs,
`identity-auth0` second for browser JWTs. Live T012 resumes only after local
tests prove provider chains, token introspection headers, native binding
startup, project-routed runtime paths, and deploy-bundle module wiring.

Commits landing the resolution:
- 682c5a5d feat(blueprint): model auth middleware providers
- 9466bfff feat(deploy-core): plan ordered auth providers
- 541eaa25 test(deploy-core): migrate plan-vars auth fixture to providers
- 7dd63cfa feat(deploy-dokploy): render auth provider chains
- e709e887 test(deploy-dokploy): migrate render fixture to auth providers
- cd1b7164 fix(deploy-dokploy): emit RNTME_AUTH_* from auth0 provider
- 6d4ed92a feat(bindings): support response headers and status
- b257421c feat(bindings-http): emit configured response headers
- 16f563b8 feat(runtime): dispatch native bindings without graph files
- 3ea54fd1 feat(runtime): support project-routed binding paths
- d5446023 fix(deploy-bundle): skip domain auth providers in module wiring
- 90dd629e feat(platform): use multi-provider edge auth with typed handler errors
- 056d8a62 fix(blueprint): narrow AuthMiddlewareDecl with type guard
