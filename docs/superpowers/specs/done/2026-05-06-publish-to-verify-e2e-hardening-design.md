# Publish-to-verify e2e hardening design

**Date:** 2026-05-06
**Status:** draft

## 1. Problem

An end-to-end deployment of `demo/order-fulfillment-blueprint` via `@rntme/cli` against `platform.rntme.com` surfaced nine issues across four cohesive surfaces: bundle integrity / error visibility, CLI parser & command surface, deploy-config schema, and operational defaults. Failures were either silent (publish "succeeds" while shipping a partial bundle) or opaque (server returns a top-level code with no actionable cause). A user following the documented workflow cannot deploy a BPMN-bearing project end-to-end without external help.

This spec defines a single set of changes that close all nine issues so that the publish → plan → render → apply → verify pipeline produces actionable feedback at every stage and the CLI surface needed to operate it is consistent.

## 2. Scope

In scope:

- Bundle materialization parity between client and server.
- Structured, tree-shaped error responses for blueprint-validation and deploy-pipeline endpoints.
- CLI USAGE/help corrections, flag-name conflict, scope-aware login, actionable 403, role-preset token minting.
- New `rntme target create` command.
- Strict `configOverrides` schema with a working `publicBaseUrl` override.
- Actionable text for `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON` and `DEPLOY_PLAN_MISSING_POLICY_VALUE`.
- README pinning for demo image tags.

Out of scope:

- OAuth-style browser-based login flow (large standalone work).
- Pretty-printer for `errors[]` in `apps/platform-http/src/ui/`.
- A dist-freshness check in CI (rejected during brainstorming as too noisy).
- Changes to Dokploy/Operaton/Redpanda images or to provisioned-compose internals.
- DNS validation for overridden `publicBaseUrl` — the operator owns the DNS record, smoke verifier surfaces the failure.
- Migrating existing platform deploy targets to gain `workflows` config (operational task done out-of-band post-release).
- Defaulting `runtimeImage` in `deploy-core/plan.ts` away from `:latest` — that belongs to the CI/release track.

## 3. Architecture

The four themes touch four packages in a known dependency order. PRs land in this order:

| # | Package | Change | Themes |
|---|---|---|---|
| 1 | `@rntme/blueprint`, `@rntme/platform-core` | `materializeBundle` / `materializeAndCompose` move into blueprint. `CanonicalBundle` becomes the canonical export from `@rntme/blueprint`; `@rntme/platform-core` re-exports for API schemas. `PlatformError` gains `errors?: PlatformErrorNode[]`. `StartDeploymentRequestSchema.configOverrides` becomes `.strict()` and accepts `publicBaseUrl`. | 1, 3 |
| 2 | `apps/platform-http` | `src/blueprint/load.ts` delegates to the shared `materializeAndCompose` and serializes the full error tree. Deploy-pipeline error sites (`stage-runner`, `provision`, `plan`, `render`, `apply`, `verify`) populate `errors[]` when nested causes exist. `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON` and `DEPLOY_PLAN_MISSING_POLICY_VALUE` get actionable text plus `cause` hints. The `publicBaseUrl` override path in `build-deploy-config.ts` becomes live. | 1, 3, 4 |
| 3 | `apps/cli` | `bundle/build.ts` runs `materializeAndCompose` for dry-run/pre-publish parity. `api/client.ts` parses `errors[]` and renders a tree. USAGE adds the `target` block. `set-config` accepts `--from <path>` and rejects the legacy `--json <path>` with a hint. New commands: `target create`, plus `token create --preset deploy|admin|publish|read`. `login` prints a scope warning when deploy scopes are missing. 403 responses with `missing scope X` get an actionable hint. | 1, 2 |
| 4 | `demo/order-fulfillment-blueprint/README.md`, `apps/cli/README.md`, `packages/deploy/deploy-core/test/unit/plan-workflows.test.ts` | Replace `<pinned-tag>` with concrete tags. Add a "Deploying a workflow-enabled blueprint" section to the CLI README. Update plan-workflows tests to assert the new message shape. | 1, 4 |

The architecture preserves the repository's leaf-contract pattern: `@rntme/blueprint` is already a leaf doing fs-IO, so adding `materializeBundle` does not introduce a new dependency layer. `dependency-cruiser` rules in `.dependency-cruiser.cjs` are unchanged.

Backward compatibility: per `CLAUDE.md` and the `project_pre_stable_stage.md` memory, the codebase is pre-revenue. The only API consumer is `@rntme/cli`, which is updated in the same release. The renamed `set-config --from` is backward-incompatible with the previous `--json <path>` form, but the previous form was structurally broken (it never parsed) so observable breakage is zero.

## 4. Theme 1 — Bundle integrity & structured errors

### 4.1 Move materialize+compose into `@rntme/blueprint`

**Current state.** `apps/platform-http/src/bundle/materialize.ts` writes the canonical bundle into a tmp directory; `apps/platform-http/src/blueprint/load.ts` calls `loadComposedBlueprint` on that directory and converts errors. The CLI does not run this pipeline; its `--dry-run` only loads the source folder via `loadBlueprint` and never sees missing-asset cases (e.g. a referenced `.bpmn` not bundled).

**Design.**

In `@rntme/blueprint`:

- New export `CanonicalBundle`:

  ```ts
  export type CanonicalBundle = {
    readonly version: 2;
    readonly files: Readonly<Record<string, unknown>>;
    readonly assets: Readonly<Record<string, string>>;
  };
  ```

- New export `materializeBundle(bundle: CanonicalBundle): Promise<string>` — copies the implementation currently in `apps/platform-http/src/bundle/materialize.ts` verbatim. Throws `DEPLOY_BUNDLE_VERSION_UNSUPPORTED`, `DEPLOY_BUNDLE_PATH_UNSAFE`, `DEPLOY_BUNDLE_PATH_COLLISION` as today.
- New export `materializeAndCompose(bundle: CanonicalBundle): Promise<Result<MaterializeResult>>` — materializes, calls `loadComposedBlueprint`, removes the tmp dir, returns `{ composed, summary }` on success or the `BlueprintError[]` returned by composition. Always cleans up on error.

In `@rntme/platform-core`:

- `CanonicalBundle` becomes a re-export from `@rntme/blueprint` to avoid duplication. API request schemas keep referencing the platform-core type alias for stability.

In `apps/platform-http`:

- `src/bundle/materialize.ts` is deleted; consumers import from `@rntme/blueprint`.
- `src/blueprint/load.ts` becomes a thin wrapper that calls `materializeAndCompose` and converts the `BlueprintError[]` tree into `PlatformError` (see 4.2). It no longer does the materialization itself.

In `apps/cli`:

- `apps/cli/src/bundle/build.ts` deletes its local `CanonicalBundle` declaration; it imports the type from `@rntme/blueprint`.
- `apps/cli/src/commands/project/publish.ts` runs `materializeAndCompose(bundle.bundle)` after `buildProjectBundle`. On failure the CLI returns `CLI_VALIDATE_LOCAL_FAILED` with the full cause tree printed. On success: continue to network upload (or print the dry-run summary).

This catches missing referenced assets, missing entity references, and any other client-side drift before a network call. It also gives the dry-run real value.

**Layering.** `@rntme/blueprint` already does fs IO via `loadComposedBlueprint`; adding `materializeBundle` is the same layer. `@rntme/blueprint` does not gain a dependency on any other workspace package.

### 4.2 Structured `errors[]` wire format

`@rntme/platform-core` extends the error shape:

```ts
export type PlatformErrorNode = {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly cause?: readonly PlatformErrorNode[];
};

export type PlatformError = {
  readonly code: string;
  readonly message: string;
  readonly stage?: string;
  readonly errors?: readonly PlatformErrorNode[];
};
```

Top-level `code` and `message` keep their current short-summary semantics for log lines and dashboards. `errors[]` carries the full tree when one is available.

Wire format (4xx/5xx response body) becomes:

```json
{
  "error": {
    "code": "PROJECT_VERSION_BLUEPRINT_INVALID",
    "message": "BLUEPRINT_WORKFLOWS_INVALID: workflow artifact failed validation",
    "stage": "validation",
    "errors": [
      {
        "code": "BLUEPRINT_WORKFLOWS_INVALID",
        "message": "workflow artifact failed validation",
        "path": "workflows/workflows.json",
        "cause": [
          {
            "code": "WORKFLOWS_FILE_MISSING",
            "message": "referenced \"order-fulfillment.bpmn\" not in bundle assets",
            "path": "definitions[0].bpmnFile"
          }
        ]
      }
    ]
  },
  "requestId": "req_…"
}
```

**Where the format applies.** All blueprint-validation and deploy-pipeline endpoints:

- `apps/platform-http/src/blueprint/load.ts` (publish path).
- `apps/platform-http/src/deploy/stage-runner.ts` and the per-stage modules (`provision`, `plan`, `render`, `apply`, `verify`).
- `apps/platform-http/src/middleware/error-handler.ts` — pass-through for `errors[]` if present, otherwise emit only `code`/`message` as today.

Routes outside that surface (auth, project/token/target CRUD other than create-target body validation) keep their flat error shape. Body-validation errors from those routes already contain enough detail in `message`.

**Code naming.** Inner-node codes follow the existing `<PKG>_<LAYER>_<KIND>` convention. Existing error codes from `@rntme/blueprint`, `@rntme/pdm`, `@rntme/workflows`, and `deploy-core` flow through unchanged; the serializer just nests them.

### 4.3 CLI rendering

`apps/cli/src/api/client.ts`:

- Parses `error.errors` if present.
- Human render: indented tree, two spaces per level. Example:

  ```
  ✖ PROJECT_VERSION_BLUEPRINT_INVALID
    BLUEPRINT_WORKFLOWS_INVALID at workflows/workflows.json
      WORKFLOWS_FILE_MISSING at definitions[0].bpmnFile
        referenced "order-fulfillment.bpmn" not in bundle assets
  ```

- `--json`: response is passed through as-is, including `errors[]`.
- Fallback to the current `code: message` rendering when `errors` is missing.

### 4.4 Tests

- `packages/artifacts/blueprint/test/unit/materialize-and-compose.test.ts` — fixture bundles with and without the BPMN asset; verifies success and the exact missing-asset error code. (Tests in this package are organized as `unit/` plus flat `smoke-*.test.ts`; this is a unit-level test on the new export.)
- `apps/platform-http/test/unit/error-serialization.test.ts` — three-level cause tree round-trips through `PlatformError`.
- `apps/platform-http` existing publish/deploy e2e tests are updated to assert the new `errors[]` shape.
- `apps/cli/test/integration/publish.test.ts` — dry-run on a bundle missing a referenced BPMN file fails locally with `CLI_VALIDATE_LOCAL_FAILED` and prints the full cause chain.
- `apps/cli/test/unit/error-render.test.ts` — stub response with three-level `errors[]` renders the expected indented tree.

The existing `apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts` is unchanged; it verifies the live path with no schema-shape assumptions.

### 4.5 Migration / data shape

No database migrations. No external API consumers; `@rntme/cli` is updated in lockstep.

## 5. Theme 2 — CLI surface

### 5.1 USAGE & help

`apps/cli/src/bin/cli.ts` USAGE block adds:

```
  target list             List deploy targets in the org
  target show <slug>      Show a deploy target
  target create <slug>    Create a new deploy target
  target set-config <slug> Update a deploy target from a JSON patch file
```

`registerHelp` is added for `target create`. `test/unit/help-registry.test.ts` is extended to cover the new entries and the presence of the `target` block in USAGE.

### 5.2 `set-config --json` → `--from`

- The dispatcher in `bin/cli.ts` reads `values['from']` instead of `values['json']` for `target set-config`.
- Help: `Usage: rntme target set-config <slug> --from <path> [--org <slug>]`.
- If a user passes the legacy `--json <path>`, `parseArgs` parses `--json` as a boolean (`values['json'] === true`) and `<path>` lands in `positionals` after the slug. The `set-config` dispatcher detects this combination (boolean `--json` plus an extra trailing positional that is not the slug) and prints:

  ```
  --json now selects machine-readable output; pass the JSON patch via --from <path>
  ```

  Exit code: `CLI_USAGE` (2).
- `apps/cli/src/commands/target/set-config.ts` accepts the path through the renamed argument; internal field becomes `fromPath`.
- The CLI README is updated.

### 5.3 `rntme target create`

A new command corresponding to `POST /v1/orgs/{org}/deploy-targets`.

```
Usage: rntme target create <slug>
  --kind dokploy
  --display-name <name>
  --dokploy-url <url>
  (--dokploy-project-id <id> | --dokploy-project-name <name> --allow-create-project)
  --api-token <token>
  [--public-base-url <url>]
  [--event-bus provisioned|external]
  [--event-bus-image <image>]
  [--event-bus-topic-prefix <prefix>]
  [--event-bus-brokers <csv>]
  [--event-bus-protocol plaintext|sasl_ssl]
  [--event-bus-mechanism scram-sha-256|scram-sha-512]
  [--event-bus-username-secret <secret-name>]
  [--event-bus-password-secret <secret-name>]
  [--workflow-engine-image <image>]
  [--workflow-worker-image <image>]
  [--auth0-domain <domain>] [--auth0-audience <aud>] [--auth0-client-id <id>] [--auth0-redirect-uri <url>]
  [--module <slug>=<image>]
  [--from <path>]
  [--default]
  [--org <slug>]
```

**Semantics.**

- Both `--workflow-engine-image` and `--workflow-worker-image` together produce `workflows: { engine: { kind: 'operaton', mode: 'provisioned', image }, worker: { image } }`. Neither produces `workflows: null`. Exactly one of the two is `CLI_USAGE` with a clear message.
- `--from <path>` is mutually exclusive with the per-field flags. Either you assemble the body from flags, or you submit a full JSON file.
- `--api-token` accepts `@<file>` to read a secret from disk and avoid exposing it in shell history.
- `--module a=img --module b=img2` is repeatable.

`apps/cli/src/commands/target/create.ts` assembles the request, validates the required-field combinations locally, and calls `POST /v1/orgs/{org}/deploy-targets`. Server validation errors render through the new `errors[]` tree.

### 5.4 `token create --preset`

`apps/cli/src/commands/token/create.ts` adds `--preset deploy|admin|publish|read`:

| preset    | scopes |
|-----------|--------|
| `read`    | `project:read` |
| `publish` | `project:read`, `project:write`, `version:publish` |
| `deploy`  | `project:read`, `version:publish`, `deploy:execute` |
| `admin`   | every scope held by the creator token |

The preset expands client-side; the server still applies the existing `scopes ⊆ creator scopes` rule. `--preset` and `--scope` are mutually exclusive.

### 5.5 `login` scope warning

After `rntme login --token <pat>` the CLI calls `GET /v1/whoami`. If `deploy:execute` and `deploy:target:manage` are both missing, it prints to stderr (in addition to the success line):

```
✓ logged in as inbox@example.com (acme, role=admin)
  scopes: project:read, project:write, version:publish, token:manage
  ⚠ this token cannot run deployments or manage targets.
    To deploy: mint a new token with `rntme token create deploy-bot --preset deploy`
    To manage targets: include `deploy:target:manage` in scopes (admin role only).
```

Behaviour does not change; only an additional warning is emitted.

### 5.6 403 actionable hint

`apps/cli/src/api/client.ts` checks 403 responses for a `missing scope <name>` pattern in `error.message` and substitutes:

```
✖ PLATFORM_AUTH_FORBIDDEN
  your token is missing scope "deploy:execute".
  Mint a new token with this scope:
    rntme token create deploy-bot --preset deploy
  Then re-login:
    rntme login --token <new-token>
  request: req_<id>
```

Other 403 shapes fall back to the standard render.

### 5.7 Tests

- `test/unit/cli.test.ts` — updated USAGE and help fixtures.
- `test/unit/target-set-config.test.ts` — accepts `--from`, rejects `--json <path>` with the documented hint.
- `test/unit/target-create.test.ts` — assembles bodies for plain and BPMN-ready cases; `--from` conflicts with field flags; required combinations.
- `test/unit/token-create-preset.test.ts` — preset expansion and `--scope`/`--preset` exclusivity.
- `test/integration/login-scope-warning.test.ts` — fake server returns whoami without deploy scopes; the warning is printed.
- `test/integration/forbidden-hint.test.ts` — fake server returns 403 with `missing scope deploy:execute`; output is replaced.

## 6. Theme 3 — Deploy schema & config

### 6.1 `configOverrides` becomes strict and gains `publicBaseUrl`

In `packages/platform/platform-core/src/schemas/deployment.ts`:

```ts
configOverrides: z
  .object({
    eventBusMode: z.literal('in-memory').optional(),
    integrationModuleImages: z.record(z.string(), z.string()).optional(),
    policyOverrides: z.record(z.string(), z.unknown()).optional(),
    runtimeImage: z.string().min(1).optional(),
    publicBaseUrl: HttpUrlSchema.optional(),
  })
  .strict()
  .default({}),
```

`HttpUrlSchema` (currently file-local in `deploy-target.ts:82-88`) is hoisted to a shared location inside `packages/platform/platform-core/src/schemas/` and imported by both files; no behavioural change to existing target schemas.

Behavioural consequences:

- Unknown keys produce `PLATFORM_PARSE_BODY_INVALID` 400 with a structural `errors[]` pointing at the offending field (formatted by Theme 1.2).
- `publicBaseUrl` flows through the existing chain to `apps/platform-http/src/deploy/build-deploy-config.ts:107`, where the previously dead branch `overrides.publicBaseUrl ?? target.publicBaseUrl ?? derive…` becomes live.

### 6.2 `build-deploy-config.ts` cleanup

- The existing `BuildDeployConfigOverrides` type already includes `readonly publicBaseUrl?: string`; no shape change.
- If `overrides.publicBaseUrl === target.publicBaseUrl`, log an info-level message that the override is a no-op. Do not block.
- Logical resource names (`compactDnsLabel(orgSlug, projectSlug, environment)`) are unaffected; the override only changes the Traefik route and the smoke-fetch URL.

### 6.3 DNS contract

`apps/cli/README.md` documents the contract under `project deploy --config-overrides`:

> `publicBaseUrl` overrides the target's default public URL for this deployment only. The DNS record for the new domain MUST already point at the same Dokploy host; no DNS records are created automatically. Smoke verification will report 502 / timeout if DNS is misconfigured.

No DNS validation logic is added.

### 6.4 CLI

No new flags. The override goes through the existing `--config-overrides <path>` mechanism, plus an example in the CLI README:

```bash
echo '{"publicBaseUrl":"https://order-demo.rntme.com"}' > /tmp/ovr.json
rntme project deploy --org acme --project order-fulfillment --version 1 \
  --target dokploy-shared --config-overrides /tmp/ovr.json
```

A dedicated `--public-base-url` flag is intentionally deferred to keep the surface tight.

### 6.5 Tests

- `packages/platform/platform-core/test/unit/schemas-deployment.test.ts` — strict mode rejects unknown keys; `publicBaseUrl` accepts valid http(s) URLs and rejects others.
- `apps/platform-http/test/integration/deployment-overrides.test.ts` — deploy with a `publicBaseUrl` override sees the planned `infrastructure.edge.publicBaseUrl` reflect the override, not the target value.
- `apps/platform-http/test/unit/build-deploy-config.test.ts` — priority chain `override > target > derive`.

### 6.6 Migration

No database migrations. Existing rows in `deployments` carry `configOverrides = {}` which the strict schema still accepts. No external clients to migrate.

## 7. Theme 4 — Operational defaults & docs

### 7.1 Actionable workflows-required error

`packages/deploy/deploy-core/src/plan.ts` raises `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON` with structured cause data on the existing `DeployPlanError`. The platform-http stage runner (`apps/platform-http/src/deploy/stage-runner.ts`) propagates that structure into `PlatformError.errors[]` per Theme 1.2; deploy-core itself stays library-level and does not depend on the platform-error shape.

- `code`: `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON`.
- `message`: `target "<targetSlug>" has no workflows config; deploying a project with workflows requires workflows.engine and workflows.worker on the target`.
- `path`: `target.workflows`.
- `cause`: one node, `code: DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT`, `message: "create a workflow-ready target with \`rntme target create <slug> --workflow-engine-image <op> --workflow-worker-image <wk> ...\`, or PATCH the existing target with \`rntme target set-config <slug> --from <patch.json>\`. See demo/order-fulfillment-blueprint/README.md for image refs."`.

Same treatment for `DEPLOY_PLAN_MISSING_POLICY_VALUE`: the cause hint mentions `--config-overrides {policyOverrides:{...}}` and points at the policy definition in the target.

No other plan-time errors require text changes in this round.

### 7.2 CLI README — "Deploying a workflow-enabled blueprint"

`apps/cli/README.md` adds a short section that:

- States that workflow-bearing projects need `workflows.engine` and `workflows.worker` on the target.
- Shows a complete `rntme target create` invocation with `--workflow-engine-image` and `--workflow-worker-image`.
- Cross-links to `demo/order-fulfillment-blueprint/README.md` for image pins.

### 7.3 Demo README — pinned tags

`demo/order-fulfillment-blueprint/README.md` replaces every `<pinned-tag>` placeholder with verified concrete values:

- `RNTME_E2E_OPERATON_IMAGE=operaton/operaton:1.0.0-beta-5` (verified by `docker manifest inspect`; if unavailable at implementation time, the implementer picks the latest `1.0.0-*` tag and updates this section in the same PR).
- `RNTME_E2E_BPMN_WORKER_IMAGE=ghcr.io/vladprrs/rntme-bpmn-worker:<sha>` — replaced with the head-of-`main` SHA at PR merge time.
- `RNTME_E2E_RUNTIME_IMAGE=ghcr.io/vladprrs/rntme-runtime:<sha>` — same treatment.

### 7.4 Tests

- `packages/deploy/deploy-core/test/unit/plan-workflows.test.ts` — assertions are extended: the `message` contains the `targetSlug`, `cause[0].code` is `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT`.
- `apps/cli/test/integration/commands.test.ts` — snapshot help for `target create` and the `target` block in USAGE.

### 7.5 What we do not do

- Existing platform deploy targets are not migrated automatically. Operationally, post-release we PATCH affected targets or replace them via `target create`. Pre-revenue project-stage policy permits this.
- `runtimeImage` default (`ghcr.io/vladprrs/rntme-runtime:latest` in `deploy-core/plan.ts`) is left alone; the release-tagging story belongs to a separate spec.
- No seed-script for a default BPMN-ready target.

## 8. Test plan summary

Per-package, all tests run under existing `pnpm -r run test` and `pnpm -r run lint`. New or updated tests:

- `@rntme/blueprint`: integration test for `materializeAndCompose`.
- `@rntme/platform-core`: schema tests for strict `configOverrides` and `publicBaseUrl`.
- `@rntme/deploy-core`: updated `plan-workflows` assertions for the new message shape.
- `apps/platform-http`: error-serialization unit test, updated publish/deploy e2e assertions, deployment-override integration test.
- `apps/cli`: error-render unit test, USAGE/help updates, `set-config --from` test, `target create` tests, `token create --preset` test, `login` scope-warning integration test, 403 hint integration test.

Existing live e2e tests (`apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts`) continue to pass without modification.

## 9. Documentation touch checklist

Per `CLAUDE.md` §11:

- `apps/cli/README.md` — new "Deploying a workflow-enabled blueprint" section, `--from` flag, `target create`, `token create --preset`, `--config-overrides publicBaseUrl` example.
- `demo/order-fulfillment-blueprint/README.md` — pinned image tags.
- `apps/platform-http/src/openapi.ts` — `errors[]` field on the relevant error responses; `publicBaseUrl` in `configOverrides`.
- `AGENTS.md` — no change (no public-API contract changes outside the openapi update).
- Per-package `README.md` for `@rntme/blueprint`: document `materializeBundle`/`materializeAndCompose` exports.
- Per-package `README.md` for `@rntme/platform-core`: document the new `errors[]` shape.

These doc updates land in the same PR as their respective code changes per project policy.

## 10. Out-of-scope follow-ups (recorded for later)

- Browser-based OAuth login flow that mints a properly-scoped token without user-side UI navigation.
- A `--public-base-url` flag on `project deploy` if the file-based override pattern proves clumsy.
- A platform admin migration path that retroactively populates `workflows` on existing targets.
- Dist-freshness CI guard, if a different shape (e.g. compare timestamps only when the diff is staged) avoids the post-checkout false-positive problem.
