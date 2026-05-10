# @rntme/deploy-runner

Pure deploy orchestrator library used by both the platform `deployments`
service (`apps/platform-http`) and the rntme CLI direct-mode (planned).

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

## Hooks

- `onLog(line)` — every sanitized log line. Messages are pre-redacted.
- `onStageBegin(stage)` — fires at the start of each active stage.
- `onStageComplete(stage, evidence)` — fires only on stage success. Stage
  failures are observable through `onTerminal`.
- `onProvisionResult(envelope)` — public + secret outputs per module. The
  caller is responsible for encrypting `secretByModule` before persistence.
- `onApplyResult(envelope)` — apply actions and duration.
- `onVerifyResult(envelope)` — smoke verification report. The caller maps
  `report.partialOk === true` to its own status (e.g. platform-http maps it
  to `succeeded_with_warnings`).
- `onTerminal(result)` — exactly one terminal callback per `runDeployment`
  invocation. The same `TerminalResult` is also returned from the function.

## Stage order

`provision → plan → render → apply → verify`. Provision runs before plan so
plan-stage variables can resolve `provision.*` paths. The `provision` stage
is skipped when the composed input has no provisioner modules.

## Invariants

- The runner never reads secrets from disk and never writes them to disk.
- The runner never opens a database connection.
- The runner never imports `@rntme/platform-core` or any HTTP framework.
- The runner never imports `@rntme/bindings-grpc` or any other
  `packages/runtime/**` module (depcruise enforces this).
- `onTerminal` is invoked exactly once per `runDeployment` call.

## Testability injection

`RunDeploymentInputs` accepts optional overrides for `runProvisioners`,
`planProject`, `renderPlan`, `applyPlan`, and `smoker`. Production callers
leave them unset; defaults come from `@rntme/deploy-core`,
`@rntme/deploy-dokploy`, and a fresh `SmokeVerifier`.

## Known consumers

- `apps/platform-http/src/deploy/executor.ts` — production caller (DB-bound
  wrapper with persistence hooks).
- `apps/cli/...` — planned CLI direct-mode caller (separate plan).
- `apps/platform/blueprint/services/deployments/workflows/handlers/` —
  planned BPMN task handlers (separate plan).

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
