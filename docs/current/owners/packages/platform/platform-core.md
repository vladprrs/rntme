# @rntme/platform-core

Domain + use-cases + seam interfaces for the rntme platform control-plane.

## Deploy surface

This package owns the deploy target and deployment domain contracts used by
the platform API:

- deploy target schemas and use-cases for create/update/delete/default/rotate;
- deployment schemas and use-cases for queue/list/show/log reads;
- repository interfaces for deploy targets, deployment records, and log lines;
- `SecretCipher`, the encryption seam used before storage adapters persist
  Dokploy API tokens.

`PlatformError` supports a structured `errors?: PlatformErrorNode[]` cause
tree. HTTP adapters preserve that tree on validation/deploy failures so CLI and
API callers can show actionable nested causes instead of a flattened message.

`StartDeploymentRequestSchema.configOverrides` is strict. Supported override
keys are `eventBusMode`, `integrationModuleImages`, `policyOverrides`,
`runtimeImage`, and `publicBaseUrl`; `publicBaseUrl` must be an HTTP(S) URL.
Deploy targets may persist optional `manualAccess` (validated JSON): `redpandaConsole`
gates manual Console validation when the Kafka bus is provisioned; basic-auth
material is target-secret-backed (`redpanda-console-basic-auth-v1`).

See `docs/history/specs/historical/2026-04-19-platform-api-design.md` in the public repo.
Deployment design: `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md`.

## Internal deploy adapter seam

`src/deploy-adapter/seam.ts` defines the temporary internal seam used by the
platform `deployments` service while Dokploy execution still lives in existing
deploy packages. The seam returns sanitized status, logs, digest, evidence, and
coded failure details. It is not a public deploy-adapter module contract.

## Bearer-token introspection

This package owns the algorithm and HTTP-middleware shim for
`Authorization: Bearer rntme_pat_…` validation:

- **`introspectToken({ deps, input })`** (`src/use-cases/tokens.ts`) — pure
  function: bearer-prefix check + hash compare (`timingSafeEqual`) +
  revocation/expiry check + membership lookup + `lastUsedAt` touch. Returns
  `Result<AuthSubject, PlatformError>`. No HTTP awareness.
- **`ApiTokenProvider`** (`src/auth/api-token-provider.ts`) — `IdentityProvider`
  shim that adapts `introspectToken` to the `AuthContext`-based middleware
  chain. Consumed today by `apps/platform-http`; the runtime auth chain will
  consume the same shim once the platform blueprint is served by
  `@rntme/runtime`.

The matching native handler stub for the runtime cutover lives at
`apps/platform/blueprint/services/tokens/handlers/introspect-token.ts`, and the
`services/tokens.IntrospectToken` operation contract is declared in
`apps/platform/blueprint/services/tokens/operations.json`.

## Target-secret schemas

The platform owns the schema registry for deploy-target secrets. Two schemas are
used for Operaton deployments:

- **`operaton-ui-basic-auth-v1`** — stores an `htpasswd` field (newline-separated
  `username:hash` lines). Validated by `parseTargetSecret` in
  `src/use-cases/target-secrets/schemas.ts`.
- **`operaton-admin-user-v1`** — stores `id`, `password`, `firstName`,
  `lastName`, and optional `email`. Rendered as an `application.yaml` secret
  file mount into the Operaton Compose container.

The target-secret list endpoint (`GET …/secrets`) returns secret **names and
schemas only** — never values. Values are decrypted only inside the platform
executor's pre-apply validation stage or inside the Dokploy client factory when
mounting secret files.

## Project lifecycle operations

Project records now carry a lifecycle `status`:
`active`, `deleting`, `delete_failed`, or `decommissioned`.
`project-operations` use-cases queue update/delete operations, persist
operation input/result/log state through a repository seam, and reject work for
inactive projects. Update operations require an explicit target slug. Delete
operations require slug confirmation and block while active deployments exist.

Storage is expected to enforce at most one live operation (`queued` or
`running`) per project; repo implementations should surface that conflict as
`PROJECT_OPERATION_INVALID_STATE`.

Run package gates from `packages/platform/platform-core` with `bun test`,
`bun run typecheck`, `bun run build`, and `bun run lint`.
