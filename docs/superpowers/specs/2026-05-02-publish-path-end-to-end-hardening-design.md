# Publish-Path End-to-End Hardening - design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-05-02 (live walkthrough on `notes-demo.rntme.com`)
**Related:**
- `docs/superpowers/specs/2026-05-02-cli-remote-deploy-hardening-design.md` - prior CLI remote deploy hardening (PR #112). This spec is the successor; it captures problems still observable after #112 landed and the broken production state of `notes-demo` on 2026-05-02.
- `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md` - deploy-core / deploy-dokploy library-first deployment pipeline.
- `docs/superpowers/specs/done/2026-04-26-project-deploy-flow-design.md` - platform project versions, deploy targets, deployments, executor, deployment logs.
- `docs/superpowers/specs/2026-04-29-notes-demo-auth0-design.md` - notes-demo Auth0 production-shape demo and auth middleware path.

**Implementation locations:**
- CLI command surface - `apps/cli/`
- Platform deployment API/executor/smoke - `apps/platform-http/`
- Platform deployment schemas/use-cases - `packages/platform/platform-core/`
- Blueprint validation + composition + vars - `packages/artifacts/blueprint/` (and adjacent packages)
- Deploy planner / variable resolution / typed errors - `packages/deploy/deploy-core/`
- Dokploy adapter / nginx renderer - `packages/deploy/deploy-dokploy/`
- Graph IR `uuid` node - `packages/artifacts/graph-ir-compiler/`
- UI runtime production bundle - `packages/runtime/ui-runtime/`
- Auth0 introspect sidecar integration test - `modules/identity/auth0/`
- Notes demo blueprint - `demo/notes-blueprint/`

## 1. Problem

The 2026-05-02 live walkthrough of the publish-blueprint path against `platform.rntme.com` and `notes-demo.rntme.com` (using the merged CLI from PR #112) surfaced one critical security issue, one false-positive smoke check, and a long tail of CLI / API / blueprint / app friction. Concrete evidence captured below; numbered findings are referenced from the design sections.

### 1.1 Edge auth is not enforcing

`GET /api/notes` without `Authorization` returns the 73-byte nginx fallback body `{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}` (no `correlation-id`, no `x-ratelimit-*` headers). `GET /api/notes` with `Authorization: Bearer fake.token.here` returns a 92-byte body `{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required","reason":"UNKNOWN"}` with `correlation-id` and `x-ratelimit-*` headers. The `reason` field originates in `packages/runtime/bindings-http/src/pre/run-pre-steps.ts`, not in the nginx renderer. Conclusion: the deployed nginx `auth_request` accepts any non-empty Bearer; the only thing rejecting forged tokens today is the per-graph backend pre-step introspection. POST/PUT/DELETE/PATCH on `/api/notes` with a fake Bearer reach backend validation (HTTP 400) or backend not-found (HTTP 404), depending on whether validation runs before pre-steps. **(F-A1)**

### 1.2 Smoke verifier reports public-route checks as ok without running them

`deployment show` for the last successful deployment of `notes-demo` shows:

```json
"verificationReport": {
  "checks": [
    { "name": "edge-health",  "url": "https://notes-demo.rntme.com/health", "status": 200, "ok": true },
    { "name": "ui",           "url": "https://notes-demo.rntme.com/",       "status": 200, "ok": true },
    { "name": "public-route", "url": "https://notes-demo.rntme.com/",       "status": 0,   "ok": true, "note": "not auto-checked in MVP" },
    { "name": "public-route", "url": "https://notes-demo.rntme.com/api",    "status": 0,   "ok": true, "note": "not auto-checked in MVP" }
  ],
  "ok": true,
  "partialOk": false
}
```

`status: 0, ok: true` is a placeholder-as-pass. The smoke check that PR #112 was supposed to add for protected routes is reported but not executed. **(F-A2)**

### 1.3 Latest hardening is published but not deployed

Project version 4 (digest `sha256:604d2f0371ad…`, published 2026-05-02 02:02 UTC) carries the PR #112 hardening. The most recent deployment is from 2026-05-01 13:57 UTC on a previous version (`d479434c-…`). The `runtimeImage` config override on past deployments was `ghcr.io/vladprrs/rntme-runtime:runtime-pr108-27c70ad`. The currently running production therefore predates PR #112. **(F-A3)**

### 1.4 Implicit `${VAR}` substitution

`demo/notes-blueprint/project.json` contains `"clientId": "${AUTH0_SPA_CLIENT_ID}"` in the identity module's `publicConfig`. The executor maps `AUTH0_SPA_CLIENT_ID` to `target.auth.auth0.clientId` by naming convention. When the live `dokploy-demos` target had `auth: {}`, a CLI deploy of version 4 failed with:

```
error:    DEPLOY_EXECUTOR_UNCAUGHT
message:  AUTH0_SPA_CLIENT_ID deploy target auth.auth0.clientId is required
```

The blueprint never declares which placeholders it expects, the target never declares which keys it provides, and the failure is reported via the generic uncaught-exception wrapper. **(F-B9, F-B8)**

### 1.5 CLI surface gaps

Captured against PR #112's surface:

- `project list` without `--org` returns `CLI_CONFIG_MISSING: no org`, even though `whoami` just printed the org. No default-from-credentials behavior. **(F-B1)**
- `project deploy --help` (and any subcommand `--help`) prints the global help text instead of subcommand-specific usage. **(F-B2)**
- No CLI commands exist for inspecting or editing deploy targets. Operators must use the platform UI to discover a target slug or to set its `auth.<provider>.<field>` configuration. **(F-B3)**
- `deployment list` columns `VERSION` and `TARGET` print truncated UUIDs (`d479434c-13…`, `91d34e40-b4…`). The deployment record on the API has `projectVersionId` and `targetId` but not denormalized `projectVersionSeq` / `targetSlug`. **(F-B4)**
- `project deployment show <truncated-id>` returns `PLATFORM_STORAGE_DB_UNAVAILABLE: error: invalid input syntax for type uuid: "5db540dd-37"`. The CLI sends the malformed id to the server; the server leaks Postgres error text. **(F-B5)**
- `project deployment watch` exits `0` for `failed` status (spec D6 requires `10`), and prints only `deployment <id> ended with failed` - no error code, no error message, no verify summary. **(F-B6, F-B7)**
- The CLI exposes no flag for `configOverrides`, including no `--runtime-image`. The platform record shows the prior production deploy used `runtimeImage: runtime-pr108-27c70ad`; without an override flag the CLI deploys whatever default the executor picks. **(F-B10)**
- The CLI offers no `--wait` flag and no synchronous deploy. The only path is `deploy` then `watch` in a separate command. **(F-B11)**
- `rntme --version` prints `0.0.0`. The CLI version is hard-coded in `package.json` and never updated. **(F-B12)**

### 1.6 Application-level surprises (out of the deploy pipeline but in the path the user follows)

- `POST /api/notes` requires the client to send a `id` field in the body. **(F-C1)**
- The SPA bundle ships `react.development.js` in production. **(F-C2)**
- `GET /_rntme_auth_<anything>` returns `200 text/html` (the SPA index) instead of `404`. The internal nginx location is masked by the SPA catch-all. **(F-C3)**

### 1.7 Discoverability

`GET /v1/orgs/<org>/projects/<project>/deploy-targets` returns `404 Not Found` with no body. The actual route is `GET /v1/orgs/<org>/deploy-targets`. **(F-D1)**

### 1.8 Failed-deployment log gap

The deployment that failed with the var-missing error wrote two log lines (`init`, `plan: Re-validating blueprint`) and then nothing. The `errorMessage` is on the deployment record but not in the log stream, so `watch` clients see no diagnostic line. **(part of F-B7)**

## 2. Goal

Make a fresh operator able to publish and deploy a blueprint from the CLI alone, with no UI assistance, and trust that a green deployment record reflects a working public surface - and have the same path bring `notes-demo` back to a state where login works and edge auth actually rejects forged tokens.

Concretely, after this spec lands:

- A blueprint declares its expected target inputs explicitly (`vars` block); validation fails fast at compose / publish time when a placeholder is undeclared or when a target cannot supply a required value.
- The smoke verifier executes real HTTP probes for each public route, including unauthenticated and forged-bearer probes for protected routes; placeholder-as-pass entries are removed.
- Edge auth is locked by an integration test that runs a real introspect sidecar against the rendered nginx config and asserts forged bearers are rejected by the named 401 fallback, not by upstream pre-steps.
- The CLI exposes target inspection / configuration commands, deployment metadata in human-readable form, accurate exit codes, error messages with structured codes, a `--wait` flow, runtime-image and config overrides, and a real version string.
- Deploy executor failures use typed `DEPLOY_<LAYER>_<KIND>` codes; uncaught is the last-resort fallback only.
- `notes-demo` is operationally restored: the `dokploy-demos` target is configured with the Auth0 client id, a fresh blueprint version is published with a `vars` block, and the redeploy is verified by the new smoke probes.

## 3. Non-goals

- No new identity provider beyond Auth0.
- No multi-region targets, no preview environments per branch, no rollback workflow beyond `redeploy` of an earlier version.
- No re-design of the runtime pre-step pipeline. Backend pre-step introspection stays as defense-in-depth; this spec does not remove it.
- No idempotency-key support for command bindings (deferred). `createNote` becomes server-side-id-generating in the simple way; the broader idempotency-key pattern is a separate spec.
- No drift / reconcile between desired and live Dokploy state. The follow-up listed in the prior spec still applies.
- No CLI sub-shell, REPL, TUI, or watch UI beyond polling.

## 4. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Substitution model | Explicit `vars` block in blueprint; `from` references typed target paths; consistency layer rejects undeclared `${PLACEHOLDER}` and unused `vars` entries. (Brainstorm option A) |
| D2 | Target CLI namespace | `rntme target list/show/set-config`; org-scoped, mirrors `/v1/orgs/<org>/deploy-targets`. (Brainstorm option A) |
| D3 | `createNote` id | Server-generated UUID via a new graph IR node `{ "type": "uuid" }`; `id` removed from inputs and HTTP body. (Brainstorm option A, with explicit node decision) |
| D4 | Backward compatibility | None. rntme is pre-stable; existing blueprints and the live notes-demo are migrated in this spec's PRs. |
| D5 | `DEPLOY_EXECUTOR_UNCAUGHT` | Kept only as last-resort fallback. New typed families per stage; uncaught logs the stack but does not put it in `errorMessage`. |
| D6 | Smoke `not auto-checked in MVP` | Removed entirely. A check that does not run does not appear in the report. |
| D7 | CLI default org / project | Read from credentials when `--org` / `--project` not provided. Priority: flag > env > credentials default. `login` writes the default. |
| D8 | `--wait` and exit codes | `project deploy --wait` polls until terminal status; exits `0` / `1` / `10` per the spec D6 mapping. Without `--wait`, behavior unchanged. |
| D9 | UUID arg validation | Client-side validation in CLI; invalid UUID returns `CLI_VALIDATE_NOT_UUID` exit `6`, no API call. |
| D10 | Internal nginx locations | Renderer emits explicit `location ~ ^/_rntme_auth_ { return 404; }` block before any SPA fallback. |

## 5. Variable substitution (D1)

### 5.1 Blueprint shape

`project.json` gains an optional `vars` block:

```json
{
  "name": "notes-demo",
  "vars": {
    "AUTH0_SPA_CLIENT_ID": { "from": "target.auth.auth0.clientId", "required": true },
    "AUTH0_AUDIENCE":      { "from": "target.auth.auth0.audience", "required": true }
  },
  "modules": { "identity": { "package": "rntme_identity_auth0", "publicConfig": { "clientId": "${AUTH0_SPA_CLIENT_ID}", "audience": "${AUTH0_AUDIENCE}" } } }
}
```

`from` is a JSON-pointer-style path rooted at `target`. Initial supported roots:

- `target.auth.<provider>.<field>` - identity provider config (e.g., `target.auth.auth0.clientId`)
- `target.modules.<slug>.<field>` - per-module config block
- `target.eventBus.<field>` - event bus config (`brokers`, `topicPrefix`, etc.)

Each entry has `required: true | false`. Default if omitted: `true`.

### 5.2 Validation layers

Standard four-layer validators in `@rntme/blueprint`:

1. **parse** - JSON Schema for `vars` block.
2. **structural** - each entry has `from` (string) and `required` (boolean, defaulted to `true`).
3. **references** - each `from` path matches the declared target schema. Reject unknown roots with `BLUEPRINT_REFERENCES_VAR_FROM_UNKNOWN`.
4. **consistency** - every `${PLACEHOLDER}` occurring in `publicConfig`, `env`, and any other substitutable surface is declared in `vars`. Every entry in `vars` is referenced at least once. Errors: `BLUEPRINT_CONSISTENCY_VAR_UNDECLARED`, `BLUEPRINT_CONSISTENCY_VAR_UNUSED`.

A blueprint without any `${PLACEHOLDER}` and without a `vars` block is valid.

### 5.3 Bundle and publish

The composed bundle includes `varsManifest`: the resolved `vars` block. The platform may use this for UI hints but does not validate target compatibility at publish time (target may not exist yet).

### 5.4 Plan-time resolution

`@rntme/deploy-core` resolves vars when planning:

- For each `vars` entry, walk the target config by the `from` path.
- If `required` and missing or empty: fail with `DEPLOY_PLAN_TARGET_VAR_MISSING { varName, fromPath, targetSlug }`.
- If present, store value in a resolved-vars map. Substitute into all `${PLACEHOLDER}` occurrences during render.

### 5.5 Migration

`demo/notes-blueprint/project.json` is updated to declare its vars. The `dokploy-demos` target on production is updated with `auth.auth0.clientId` and `auth.auth0.audience` as part of operational follow-up (section 11).

## 6. Edge auth (F-A1, F-A2, F-A3)

### 6.1 Root-cause investigation (F-A1)

The implementation work begins with a diagnosis of why the live deployed nginx accepts any non-empty Bearer despite the renderer in `packages/deploy/deploy-dokploy/src/nginx.ts` emitting `auth_request /_rntme_auth_<key>;` correctly. Possible roots include: deployed nginx config predates the auth_request render, deployed sidecar image does not implement `/introspect`, sidecar returns 200 for any Bearer, `error_page 401 = @location` does not intercept the actual sub-request status code. The investigation must conclude with one of:

- a code/config fix in `nginx.ts`, the sidecar, or the executor that produces a deterministic 401 for forged bearers, or
- evidence that the running deployment is older than the rendered config and the only change needed is a fresh deploy of version 4 (followed by smoke).

In either case, the verification (6.2) is required.

### 6.2 Locking integration test (F-A1)

A new test in `packages/deploy/deploy-dokploy/test/integration/edge-auth.test.ts`:

- Renders the nginx config for a notes-demo-shaped blueprint.
- Boots a real `identity-auth0` introspect sidecar in-process via `createIdentityAuth0HttpServer`.
- Boots real nginx through Testcontainers (`nginx:1.27-alpine`) with the rendered config copied to `/etc/nginx/nginx.conf`.
- Exposes the host sidecar port to nginx with `TestContainers.exposeHostPorts(port)` and uses `host.testcontainers.internal:<port>` in the rendered upstream URL.
- Sends `GET /api/notes` with `Authorization: Bearer fake.token.here` through nginx.
- Asserts the response is `401 application/json` with body exactly equal to `{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}` (the named-fallback body, no `reason` field).
- Repeats the assertion for `POST`, `PUT`, `DELETE`, `PATCH`.

This test must fail against a renderer/sidecar regression that lets forged bearers reach upstream, and pass after the fix. Do not replace this with a Hono or Node substitute for nginx; the regression surface is nginx `auth_request`, `error_page`, and location matching.

### 6.3 Smoke verifier real probes (F-A2)

`apps/platform-http/src/deploy/smoke-verifier.ts` is updated:

- Remove every `status: 0, ok: true, note: "not auto-checked in MVP"` placeholder. A check that does not run does not appear in the report.
- For each `public-route` URL, classify by route kind (UI vs HTTP) using rendered plan metadata.
  - UI route: `GET <url>` -> assert `200 text/html`.
  - Unprotected HTTP route: `GET <url>` -> assert `200`-class.
  - Protected HTTP route (route mounts an `auth` middleware): three probes -
    1. `GET <url>` without `Authorization` -> assert `401 application/json` with `code === 'RUNTIME_AUTH_TOKEN_INVALID'`.
    2. `GET <url>` with `Authorization: Bearer invalid.token.here` -> same assertion as (1).
    3. `GET <url>` with `Authorization: Bearer ` (literally `Bearer ` with trailing space, no token) -> same assertion as (1).
- For HTTP routes that have `POST` / `PUT` / `DELETE` smoke paths declared in the rendered plan, repeat probes (1) and (2) for those methods.
- Failure of any required probe sets deployment status to `failed`.

The protected-route smoke list is sourced from rendered plan `verificationHints.protectedRoutes` (new field; populated by the planner from blueprint route+middleware metadata).

### 6.4 Operational redeploy (F-A3)

Tracked in section 11. Once 6.1-6.3 land plus the variable substitution work in section 5, a fresh blueprint version is published with `vars`, and a CLI deploy is run against a `dokploy-demos` target whose `auth.auth0.clientId` and `auth.auth0.audience` have been set.

## 7. CLI hardening (F-B1 .. F-B12)

| Finding | Change |
|---|---|
| F-B1 | `runCommand` harness reads `defaultOrg` and `defaultProject` from credentials when flag is absent. `login` writes `defaultOrg` from the `whoami` response into the credentials file (and `defaultProject` only if explicitly provided via `--project` to `login`). Priority: `--flag` > `RNTME_*` env > credentials default. |
| F-B2 | Per-subcommand `--help`. Replace the single global help handler with a registry that maps a subcommand path (e.g. `["project","deploy"]`) to its usage block. Each subcommand defines a `usage` string and an `options` table; `--help` prints those plus a short example. |
| F-B3 | New CLI commands: `rntme target list [--org]`, `rntme target show <slug> [--org] [--unredacted]`, `rntme target set-config <slug> --json <path> [--org]`. `set-config` does an atomic replace of the editable config block (`auth`, `modules`, `eventBus`, `policyValues`); does not touch `apiToken`. `show` redacts secret-bearing fields by default; `--unredacted` requires `deploy:target:manage` scope. |
| F-B4 | API: `GET /v1/orgs/.../projects/.../deployments[/:id]` responses gain `projectVersionSeq` (number) and `targetSlug` (string). CLI prints these in the `VERSION` and `TARGET` columns; UUID columns are dropped from human output (kept in `--json`). |
| F-B5 | CLI client-side UUID validation for `<deployment-id>` and any other UUID-shaped positional arg. Invalid input returns `CLI_VALIDATE_NOT_UUID` with exit code `6` (validation failed). No HTTP call is made. |
| F-B6 | `watch` exit codes: `succeeded` -> `0`, `succeeded_with_warnings` -> `1`, `failed` / `failed_orphaned` -> `10`, server `5xx` while polling -> `10`. Unit-tested across all four terminal states. |
| F-B7 | `watch` final print: before exit, fetch the deployment record and print `errorCode`, `errorMessage`, and a one-line verify summary (`verify: <ok\|partial\|failed>; <n> checks; first failure: <name> -> <status>`). Executor: each stage (`init`, `plan`, `render`, `apply`, `verify`, `finalize`) emits a structured log line `{ step, level: 'error', code, message }` on failure. Two paths feed this: stages that return `Result<…>` log on `Err` before propagating; a stage that throws is caught by the executor's stage wrapper, which logs and re-throws. Uncaught exceptions still hit the last-resort handler that maps to `DEPLOY_EXECUTOR_UNCAUGHT`. |
| F-B8 | New typed deploy error families: `DEPLOY_PLAN_*` (`TARGET_VAR_MISSING`, `BLUEPRINT_INVALID`, `MODULE_EDGE_AUTH_MISSING`, …), `DEPLOY_RENDER_*` (`NGINX_INVALID`, `COMPOSE_INVALID`, …), `DEPLOY_APPLY_*` (`DOKPLOY_TASK_REJECTED`, `MOUNT_PATH_MISSING`, …), `DEPLOY_VERIFY_*` (`PROTECTED_ROUTE_NOT_401`, `HEALTH_NON_200`, …). Existing call sites that throw bare `Error` are converted to `Result<…>` returns or to typed errors. `DEPLOY_EXECUTOR_UNCAUGHT` is reserved for last-resort (programming errors); its `errorMessage` is generic; the stack goes to logs. |
| F-B9 | Implemented in section 5 (variable substitution). |
| F-B10 | `project deploy --runtime-image <ref>` and `project deploy --config-overrides <json-path>`. `--runtime-image` shorthand merges into `configOverrides.runtimeImage`. `--config-overrides` reads JSON from disk and shallow-merges into `configOverrides`; explicit `--runtime-image` wins on key collision. |
| F-B11 | `project deploy --wait [--timeout <sec>]`: after submitting, internally re-uses the watch loop. Default timeout 300s. Exit codes per F-B6. Without `--wait`, behavior unchanged (exit 0 after `queued`, no polling). |
| F-B12 | `--version` reads the version constant injected from `package.json#version` at build time. The build adds an esbuild `define` (or a generated `version.ts` step) so that running `node dist/bin/cli.js --version` returns the actual package version. Test asserts the printed value is not `0.0.0` and matches the package.json. |

## 8. Application semantics (F-C1, F-C2, F-C3)

### 8.1 `createNote` id (F-C1)

A new graph IR node type `uuid` is added to `@rntme/graph-ir-compiler`:

```json
{ "id": "newId", "type": "uuid", "config": {} }
```

Output: a freshly generated server-side UUID string. No inputs. Existing graphs reference inputs and prior pipeline values via `$param`, `$pre`, `$literal`. Consuming a `uuid` node's output requires a new reference form `{ "$node": "<nodeId>" }`. The compiler validates that every `$node` reference resolves to a declared node id and that the consuming slot accepts the producing node's output type.

For this slice, `$node` is deliberately narrow:

- valid only in command graph expressions
- valid only for a prior `uuid` node in the same graph
- invalid for query rowset nodes, emit nodes, future nodes, and missing nodes

`uuid` is a command-runtime node, not a relational/SQLite lowering node. `compileCommand` must exclude `uuid` from the read-prelude `readNodes` set and carry it as command node generator metadata. `executeCommand` evaluates node generators before the first emit, stores outputs in a `nodeValues` map, and resolves `$node` expressions from that map in both `aggregateId` and payload expressions. The default generator may reuse the existing command `ctx.nextId()` UUID source so tests can provide deterministic IDs; the first generated value becomes the note aggregate id and later `ctx.nextId()` calls still produce event ids.

`demo/notes-blueprint/services/app/graphs/createNote.json` is rewritten:

```json
{
  "id": "createNote",
  "signature": {
    "inputs": {
      "title": { "type": "string", "mode": "required" },
      "body":  { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    { "id": "newId", "type": "uuid", "config": {} },
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Note",
        "aggregateId": { "$node": "newId" },
        "transition": "create",
        "payload": {
          "title":    { "$param": "title" },
          "body":     { "$param": "body" },
          "ownerSub": { "$pre":   "session.user_id" }
        }
      }
    }
  ]
}
```

`bindings.json#createNote.http.parameters` drops the `id` entry. The notes-demo SPA loses its client-side UUID generation and sends only `title` + `body`. The compiler validates that `aggregateId` consumes a node output of UUID-shape; an `$node` reference to a missing, future, or non-`uuid` node is rejected with `STRUCT_INVALID_NODE_REF`.

### 8.2 Production React bundle (F-C2)

`@rntme/ui-runtime` esbuild config sets:

- `define: { "process.env.NODE_ENV": "\"production\"" }`
- `minify: true`
- `treeShaking: true`

Test in `packages/runtime/ui-runtime/test/unit/build.test.ts` runs the production build and reads `packages/runtime/ui-runtime/build/main.js`. The test should assert that `react.development` and unresolved `process.env.NODE_ENV` are absent. It should not require the literal string `"production"` to remain in the bundle because esbuild `define` plus minification can constant-fold the branch away.

### 8.3 Internal nginx locations (F-C3)

`packages/deploy/deploy-dokploy/src/nginx.ts` adds, before the SPA / catch-all locations:

```
    location ~ ^/_rntme_auth_ {
      return 404;
    }
```

Snapshot test confirms this block appears before any SPA-fallback `try_files`. Live probe test (in the integration file from 6.2) asserts `GET /_rntme_auth_zzz` returns `404` (not `200 text/html`).

## 9. Discoverability (F-D1)

`apps/platform-http` registers a 404 handler for `GET /v1/orgs/:org/projects/:project/deploy-targets` that returns:

```json
{ "code": "PLATFORM_HTTP_NOT_FOUND", "message": "deploy targets are org-scoped; use /v1/orgs/<org>/deploy-targets" }
```

Same shape for any other plausibly-misplaced route (a small allowlist; not a generic 404 hint engine).

## 10. Test plan

### 10.1 Unit

- `vars` validation: parse / structural / references / consistency, including success and each error code path.
- Typed `DEPLOY_<LAYER>_*` errors: snapshot of full code list; one test per code path that asserts the right code is produced for the right input.
- `watch` exit code mapping for all four terminal statuses + server 5xx during poll.
- CLI UUID arg validation: invalid UUID -> `CLI_VALIDATE_NOT_UUID` exit 6; valid UUID passes through.
- CLI `--version` constant matches `package.json#version`.
- Subcommand `--help` registry: each registered subcommand has a usage string; `--help` prints it.

### 10.2 Integration

- Edge auth integration (6.2) - real sidecar, real nginx, forged bearer rejected by named fallback.
- Smoke verifier (6.3) - probes a fake edge, asserts each new probe family fails the deployment when a protected route returns 200/500/wrong-shape.
- Target CLI (`target list/show/set-config`) round-trips against a fake `platform-http` test fixture; redaction respected.
- Variable resolution: composed blueprint with vars + target with subset of values -> `DEPLOY_PLAN_TARGET_VAR_MISSING { varName, fromPath }`; full target -> resolved values flow through to rendered config.
- Subcommand `--help` end-to-end: `node dist/bin/cli.js project deploy --help` prints deploy-specific text, not global help.

### 10.3 Manual / E2E

Documented (in `apps/cli/README.md`) walkthrough that an operator can run against `platform.rntme.com`:

1. `rntme login`
2. `rntme target show dokploy-demos --unredacted`
3. `rntme target set-config dokploy-demos --json target-config.json` (sets `auth.auth0.clientId`, `auth.auth0.audience`)
4. `rntme project publish demo/notes-blueprint`
5. `rntme project deploy --version <seq> --target dokploy-demos --wait`
6. Verify `succeeded`, then `curl -i https://notes-demo.rntme.com/api/notes -H 'Authorization: Bearer fake.token.here'` returns 401 with the canonical body.

### 10.4 Snapshots

- `nginx.ts` rendering: includes `location ~ ^/_rntme_auth_` before SPA fallback.
- Typed deploy error code list: snapshot of the exhaustive set.

## 11. Rollout

Strict ordering by dependency:

1. **Variable substitution** (`@rntme/blueprint` validation + `@rntme/deploy-core` resolver). Lands without any blueprint changes (no current blueprint declares `vars`; the consistency check only fires if a blueprint contains `${…}`, which today only `notes-demo` does - migrated in step 9).
2. **Typed deploy errors** (`@rntme/deploy-core`, executor in `apps/platform-http`). Replace bare throws with typed `Result` / typed errors. Lands before any executor stage rewrite.
3. **Executor stage logging** + **smoke verifier real probes**. Each stage now emits structured error log lines on failure; smoke verifier no longer reports placeholder-as-pass.
4. **CLI client-side cluster** (F-B1, F-B2, F-B5, F-B6, F-B10, F-B11, F-B12). One PR; no API changes.
5. **API denormalization** (F-B4): `GET deployments[/:id]` adds `projectVersionSeq` + `targetSlug`. CLI consumes; human output switches columns.
6. **CLI target commands** (F-B3) + **helpful 404** (F-D1).
7. **Edge auth root cause** (6.1) + **integration test** (6.2).
8. **App semantics**: graph IR `uuid` node, `createNote` rewrite, notes-demo SPA update, production React build, nginx internal-location 404.
9. **Migrate `notes-blueprint`** to `vars` block.
10. **Operational restoration of notes-demo** (section 12).

## 12. Operational follow-up

Not code, but tracked here:

1. After step 6 (CLI target commands), run `rntme target set-config dokploy-demos --json …` to set `auth.auth0.clientId` and `auth.auth0.audience` from the production Auth0 tenant.
2. After step 9 (vars migration), publish a new `notes-demo` version that uses `vars`.
3. Run `rntme project deploy --org test-organization --project notes-demo --version <new-seq> --target dokploy-demos --wait`.
4. Confirm `succeeded` status. Smoke verifier must report real `200` for `/health`, `/`, `/config.json`, and real `401` for the protected `/api/notes` probes.
5. Manually exercise login on `notes-demo.rntme.com`: complete Auth0 redirect, create a note, list notes.
6. Re-run the `Bearer fake.token.here` probe; expect canonical 401 from named fallback.

## 13. Documentation touch

In the implementation PR(s):

- `AGENTS.md` §6 deploy how-to (CLI publish/deploy walkthrough), §10 glossary (vars, typed deploy errors, target slug).
- `apps/cli/README.md` - all new commands and flags, exit code table, real version, manual walkthrough.
- `packages/deploy/deploy-core/README.md` - vars resolver, typed error families.
- `packages/deploy/deploy-dokploy/README.md` - nginx internal-location 404, integration test contract.
- `packages/artifacts/blueprint/README.md` (or current location) - `vars` block, four-layer validation, migration notes.
- `demo/notes-blueprint/README.md` - vars usage example, REST contract for `createNote` (no client-side id).
- `apps/platform-http/README.md` - denormalized deployment fields, helpful 404 on project-scoped `deploy-targets`.
- `modules/identity/auth0/README.md` - integration test contract for the introspect sidecar.
- `packages/runtime/ui-runtime/README.md` - production React build, bundle assertion.
- `packages/artifacts/graph-ir-compiler/README.md` - new `uuid` node type.
