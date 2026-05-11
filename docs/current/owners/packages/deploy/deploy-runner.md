# @rntme/deploy-runner

Pure deploy orchestrator library — the single home for deploy stage logic.
Consumed by the rntme CLI direct-mode and by the platform's `runDeployment`
BPMN process (whose native task handlers resolve `@rntme/deploy-runner#stages.*`).

## Role in the system

- Consumes a composed project input, a structurally-mirrored deploy target,
  and resolved (already-decrypted) target secrets.
- Runs the deploy lifecycle: `provision → plan → render → apply → verify`.
- Emits side-effect-bearing events (logs, stage results, persistence
  envelopes, terminal status) through hooks. The caller persists what it
  wants.
- Owns no HTTP, DB, BPMN, Operaton, filesystem state, or platform-specific
  types.

## Public API

- `runDeployment(inputs: RunDeploymentInputs): Promise<TerminalResult>` —
  the orchestrator entry point.
- `deployErrorsToPlatformError(errors, stage)` — error-tree formatter.
- Utilities: `redact`, `runStage`, `SmokeVerifier`, `defaultSmokeFetcher`,
  `createDokployClientFactory`, `normalizeDokployBaseUrl`,
  `buildProjectDeploymentConfig`, `buildDokployTargetConfig`,
  `derivePublicBaseUrl`, `runTearDownsForDeployment`.
- Public types: `NormalizedDeployTarget` (alias of `DeployTargetForBuild`),
  `ResolvedTargetSecrets`, `DeploymentHooks`, `RunDeploymentInputs`,
  `TerminalResult`, `StageName`, `StageEvidence`, `SanitizedLogLine`,
  `SecretCipher`, `EncryptedSecret`, `ParseTargetSecretFn`,
  `DokployTargetWithSecret`, plus the structural mirrors of platform-core
  schemas in `deploy-target-types.ts` (`EventBusConfig`,
  `DeployTargetModules`, `DeployTargetWorkflows`, `DeployTargetStorage`,
  `DeployTargetAuthConfig`, `DeployTargetManualAccess`, `PolicyValues`,
  `VerificationReport`, `VerificationCheck`, `WorkloadStatus`).

### `runProjectDelete`

Sibling orchestrator for project-delete operations. Same DB-bound dependency
shape as the historical platform-http executor: a `withOrgTx` callback that
gives the function transactional access to `ProjectOperationRepo`,
`ProjectRepo`, `DeploymentRepo`, `DeployTargetRepo`, and `ProjectVersionRepo`,
plus a `DokployClientFactory`, a `BlobStore`, a `SecretCipher`, and a
provisioner resolver. The function:

1. Transitions the project-operation to `running` and starts a heartbeat.
2. Reads applied resources grouped by deploy target.
3. For each target, runs provisioner tearDown for the last successful
   deployment, then deletes the Dokploy resources.
4. Finalizes the operation as `succeeded` and sets the project status to
   `decommissioned`, or `failed` with an aggregated error message.

Used by future callers in `services/deployments` (BPMN handler) and in any
direct-mode tooling that needs to dismantle a project's deployed resources.
Wiring to a BPMN process is a follow-up plan.

## Hooks

- `onLog(line)` — every sanitized log line. Messages are pre-redacted.
- `onStageBegin(stage)` — fires at the start of each active stage.
- `onStageComplete(stage, evidence)` — fires only on stage success. Stage
  failures are observable through `onTerminal`.
- `onProvisionResult(envelope)` — public + secret outputs per module. The
  caller is responsible for encrypting `secretByModule` before persistence.
- `onApplyResult(envelope)` — apply actions and duration.
- `onVerifyResult(envelope)` — smoke verification report. The caller maps
  `report.partialOk === true` to its own status (e.g. a deployment row may
  go to `succeeded_with_warnings`).
- `onTerminal(result)` — exactly one terminal callback per `runDeployment`
  invocation. The same `TerminalResult` is also returned from the function.

## Stage order

`provision → plan → render → apply → verify`. Provision runs before plan so
plan-stage variables can resolve `provision.*` paths. The `provision` stage
is skipped when the composed input has no provisioner modules.

## `stages.*` API (per-stage entry points)

Each lifecycle stage is also exposed as a standalone, callable unit through
the `stages` namespace. Every stage exports:

- A pure `run(input): Promise<output>` (or `compose(input): Promise<output>`
  in the case of the leading `compose` stage) that takes the stage's input
  shape and returns its output shape. No hooks, no terminal mapping, no
  cross-stage state.
- A `handler` export that adapts `run` to the BPMN native-task contract
  (`@rntme/bpmn-worker#nativeTasks`). The handler reads its inputs from the
  process variables, returns the stage output as process variables, and
  surfaces failures as `BPMN_WORKER_NATIVE_HANDLER_*` errors that the worker
  reports loudly (no silent skip).

The stages are wired by `runDeployment` for the in-process path **and** by
the platform's `runDeployment` BPMN process for the orchestrated path.
Holding state across stages (`stages.compose` → `stages.plan` → … →
`stages.verify`) goes through `DeployStageState` rows so the orchestrator can
restart, inspect, and retry a single stage without re-running the whole
deploy.

## Invariants

The package has two layers with different invariants:

**Pure layer (`src/stages/**`, `src/run-deployment.ts`, `src/build-deploy-config.ts`,
`src/redactor.ts`, `src/smoke-verifier.ts`):**

- Never reads secrets from disk and never writes them to disk.
- Never opens a database connection.
- Never imports `pg`, `drizzle-orm`, or any `@rntme/platform-storage` symbol.
- Never imports any `packages/runtime/**` module (depcruise enforces this).
- `onTerminal` is invoked exactly once per `runDeployment` call.

**Platform-glue layer (`src/handlers/**`):**

- Wraps `stages.*` for the BPMN orchestrated deploy path. Each handler
  begins/succeeds/fails a `DeployStageState` row, reads prior stage rows for
  inputs, spills large or sensitive payloads to the blob store, and persists
  only keys + small digests in the row.
- Imports `@rntme/platform-storage` repos (`createPgDeployStageStateRepo`,
  `PgDeploymentRepo`, `PgDeployTargetRepo`, …), the `pg` pool, and
  `drizzle-orm` for transaction binding. This is allowed.
- Runs every database read or write inside `ctx.withOrgTx(orgId, fn)` so
  Postgres RLS sees `app.org_id` set on the connection. Any handler that
  bypasses `withOrgTx` will be silently rejected by RLS policies on
  `deploy_stage_state`, `deployment`, `deploy_target`, and friends.
- Uses `ctx.resolveProvisioner` (built once per worker process by
  `buildResolveProvisioner`) to load provisioner entry files from the
  materialized bundle's `assets/provisioners/<safe>.entry.js` path.
- Owns no HTTP routing and no Operaton/Kafka client — the BPMN worker
  resolves these handlers by `module + export` from `workflows.json` and
  invokes them with `(input, processVariables)` envelopes.

## Testability injection

`RunDeploymentInputs` accepts optional overrides for `runProvisioners`,
`planProject`, `renderPlan`, `applyPlan`, and `smoker`. Production callers
leave them unset; defaults come from `@rntme/deploy-core`,
`@rntme/deploy-dokploy`, and a fresh `SmokeVerifier`.

## Known consumers

- `apps/cli/` — CLI direct-mode caller.
- `apps/platform/blueprint/services/deployments/workflows/workflows.json` —
  BPMN `nativeTasks` resolving the package's stage handler exports
  (`composeStageHandler`, `planStageHandler`, …) for the platform's
  `runDeployment` process.

## Where to look first

- `packages/deploy/deploy-runner/src/types.ts` — public input/output shapes.
- `packages/deploy/deploy-runner/src/run-deployment.ts` — orchestrator body.
- `packages/deploy/deploy-runner/src/deploy-target-types.ts` — structural
  mirrors of platform-core's deploy-target schemas.
- `packages/deploy/deploy-runner/src/build-deploy-config.ts` — config
  builder used by the runner and its callers.

## Specs

- [`docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`](/docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md)
- [`docs/superpowers/plans/2026-05-10-deploy-runner-extraction.md`](/docs/superpowers/plans/2026-05-10-deploy-runner-extraction.md)
