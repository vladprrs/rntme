> Status: active-rationale.
> Date: 2026-05-10.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Recent Superpowers design rationale preserved during project cleanup; it is not current-state truth by itself.

# CLI Universal Deploy and platform-http Removal Design

Date: 2026-05-10

## Status

Approved design for user review. Implementation plans have not been written yet.

## Context

The `2026-05-09-platform-as-blueprint-design.md` spec set the trajectory for
moving platform domain ownership into `apps/platform/blueprint`. Plans 1-4 are
landed (foundation, identity/Auth0, deployments service artifacts, UI
artifact). Plan 5 was scoped as "make `apps/platform-http` a thin launcher
around the platform blueprint runtime."

Reviewing the actual remaining shape of `apps/platform-http/src/`, every piece
has a non-platform-specific home it should move to:

- `routes/*.ts` — replaced by blueprint-generated `/api/*` (plan 1, done).
- `ui/` — replaced by blueprint UI artifacts (plan 4, done).
- `auth/workos-*` — replaced by `@rntme/identity-auth0` through the canonical
  identity contract (plan 2, done).
- `auth/api-token-provider.ts` — should become a handler in the
  `services/tokens` blueprint.
- `middleware/*` — `requestId`, `logger`, `cors`, `error-handler`,
  `body-limit`, `rate-limit`, `security-headers`, `same-origin`, `auth`, `tx`
  are runtime concerns, not platform concerns; they belong inside
  `@rntme/runtime` and `@rntme/bindings-http`.
- `deploy/*` — `executor.ts`, `dokploy-client-factory.ts`, `smoke-verifier.ts`,
  `log-redactor.ts`, `orphan-detect.ts`, `project-delete-executor.ts`,
  `stage-runner.ts`, `build-deploy-config.ts`, `run-teardowns.ts` are deploy
  orchestration. They should move into a deploy orchestrator library used by
  both the platform-side workflow and the CLI direct-mode path.
- `bin/server.ts` — `@rntme/runtime` already ships `bin/runtime.ts`.
- `config/env.ts` — runtime-driven from blueprint requirements.
- `app.ts`, `platform-runtime/*` — disappear when there is no per-app launcher.

`@rntme/runtime` already exists as a generic zero-code runtime
(`packages/runtime/runtime/`) with its own bin entrypoint and a
`Dockerfile.template` that uses image `ghcr.io/vladprrs/rntme-runtime:1.0` and
copies blueprint artifacts into `/srv/artifacts`. Any blueprint, including the
platform's own, can be deployed by that template alone.

In parallel, the CLI today (`apps/cli`) is a thin HTTP client to
`platform-http`. Every operation goes through the platform server. There is
no way to deploy a blueprint without the platform present, and no first-deploy
story for the platform itself.

This spec turns those observations into a single direction:

1. The CLI becomes a universal deploy front. It can deploy any blueprint
   directly, talk to a deployed platform, and bootstrap the platform itself.
2. `apps/platform-http` is deleted. The platform is `apps/platform/blueprint`
   served by `@rntme/runtime`.
3. Deploy orchestration logic lives in `packages/deploy/deploy-runner`. CLI
   direct-mode and platform's `services/deployments` workflow both depend on
   the same library.
4. Inside the platform, deploy is BPMN-orchestrated (Operaton). The CLI
   direct-mode path is synchronous and BPMN-free.

Pre-stable stage applies (`G6`, `F7`): no compatibility shims, no `/v1/*`
preservation, no deprecation paths.

## Goals

- Make the rntme CLI work in three explicit modes against the same deploy
  engine: direct (no platform), platform-client (talk to a deployed platform),
  platform-bootstrap (deploy `apps/platform/blueprint` to a target).
- Extract deploy orchestration from `apps/platform-http/src/deploy/` into a
  reusable `packages/deploy/deploy-runner` library with no HTTP, DB, or BPMN
  dependency.
- Move long-running deploy orchestration inside the platform from a hand-written
  background loop to a BPMN process owned by `services/deployments`.
- Delete `apps/platform-http` entirely after its responsibilities are moved.
- Keep `apps/platform/blueprint` evolving as the rntme platform product. The
  platform is what users self-host or run as a hosted instance to manage their
  projects with versions, history, audit, multi-tenant inspection.

## Non-Goals

- A `packages/contracts/deploy/v1/` canonical contract. There is no second
  vendor for "deploy" — target variation lives inside
  `packages/deploy/deploy-{dokploy,local,...}` adapters via discriminated
  `target.kind`.
- A `modules/deploy/...` rntme vendor module. Deploy is not a vendor capability
  behind a contract; it is a first-party deploy stack.
- Local docker target adapter (`packages/deploy/deploy-local`). This is a
  later, separate piece of work; the current environment cannot install
  Docker.
- A new universal "background worker" capability in `modules/v1`. The platform
  uses BPMN for its long-running deploy; modules stay request/response.
- Splitting CLI into multiple npm packages. The CLI direct-mode lives in
  `apps/cli/src/deploy-engine/` as plain glue around `@rntme/deploy-runner`.
- Any compatibility layer for the old `/v1/*` API surface. Pre-stable.
- Multi-tenancy or auth in CLI direct-mode. Direct mode is single-user; orgs,
  tokens, audit only exist when a platform is involved.

## Decision-System Impact

`docs/decision-system.md` already carries:

> **Platform as blueprint** — locked-pending — spec
> `docs/history/specs/active-rationale/2026-05-09-platform-as-blueprint-design.md`

> **Deployments service + adapter boundary** — locked-pending — same spec

This spec adds:

> **CLI universal deploy front** — The rntme CLI is the single user-facing
> deploy entry point and works in three modes (direct, platform-client,
> platform-bootstrap) over the same deploy engine. Direct mode never requires
> a running platform. — G1, G3, G5, F2, F4, F8 — `locked-pending` — this spec.

> **Deploy orchestrator library** — Deploy stage orchestration lives in
> `packages/deploy/deploy-runner` as a pure library with no HTTP/DB/BPMN
> dependency. CLI direct-mode and platform `services/deployments` workflow
> both depend on it; the platform side wraps it in a BPMN process for
> durability and inspectability. — G3, G4, G5, F1, F4, F8 — `locked-pending` —
> this spec.

> **No `apps/platform-http`** — The platform is `apps/platform/blueprint`
> served by `@rntme/runtime`. There is no per-app launcher, no platform-side
> hand-written HTTP server. — G1, G2, G5, F1, F2, F6 — `locked-pending` — this
> spec.

These bets refine "Platform as blueprint" by replacing the "thin launcher"
endpoint of plan 5 with full deletion. They do not change goals or filters.

## Target Architecture

```text
                                rntme CLI (apps/cli)
                                       │
        ┌──────────────────────────────┼─────────────────────────────┐
        │                              │                             │
   direct mode                  platform-client mode          platform-bootstrap
   (no platform)                (talk to deployed platform)   (= direct mode against
                                                               apps/platform/blueprint)

   rntme deploy <bp>            rntme login --base-url …      rntme platform up
       --target X               rntme project deploy             --target X
                                    --version N
                                rntme project list
                                rntme deployment watch
        │                              │                             │
        ▼                              ▼                             ▼
  ┌───────────────┐             ┌──────────────┐             ┌──────────────┐
  │ Deploy Engine │             │ Platform API │             │ Deploy Engine│
  │ (in CLI)      │             │ HTTP client  │             │ (in CLI)     │
  │ runDeployment │             │              │             │ runDeployment│
  │ (synchronous) │             │              │             │ (synchronous)│
  └───────┬───────┘             └──────┬───────┘             └───────┬──────┘
          │                            │                             │
          │                            ▼                             │
          │           ┌────────────────────────────────┐             │
          │           │ Deployed instance:             │             │
          │           │   apps/platform/blueprint      │             │
          │           │   served by @rntme/runtime     │             │
          │           │                                │             │
          │           │ services/deployments BPMN:     │             │
          │           │   run-deployment.bpmn          │             │
          │           │     ↓ task: render             │             │
          │           │     ↓ task: provision          │             │
          │           │     ↓ task: apply              │             │
          │           │     ↓ task: verify             │             │
          │           │   handlers call deploy-runner  │             │
          │           │   stages                       │             │
          │           └─────────────┬──────────────────┘             │
          │                         │                                │
          ▼                         ▼                                ▼
                       Target adapter (Dokploy now → Local later)


                              packages/deploy/
                                ├─ deploy-core      (target-neutral planner)
                                ├─ deploy-dokploy   (Dokploy adapter)
                                └─ deploy-runner    (NEW — pure orchestrator)
```

## Components

### `packages/deploy/deploy-runner` (new)

Pure orchestrator library. No HTTP, no DB, no BPMN, no Operaton, no
filesystem-state. Inputs are data, outputs are data, side effects only on
deploy targets.

Public API sketch (subject to refinement during implementation):

```ts
export interface RunDeploymentInputs {
  composedBlueprint: ComposedBlueprint;
  projectVersionRef: { seq: number; digest: string };
  target: NormalizedTarget;
  resolvedTargetSecrets: ResolvedTargetSecrets;
  hooks?: DeploymentHooks;
  abortSignal?: AbortSignal;
}

export interface DeploymentHooks {
  onLog?(line: SanitizedLogLine): void | Promise<void>;
  onStageBegin?(stage: StageName): void | Promise<void>;
  onStageComplete?(stage: StageName, evidence: StageEvidence): void | Promise<void>;
  onTerminal?(result: TerminalResult): void | Promise<void>;
}

export type StageName = 'compose' | 'plan' | 'provision' | 'render' | 'apply' | 'verify';

export function runDeployment(inputs: RunDeploymentInputs): Promise<TerminalResult>;

export const stages: {
  compose(input: ComposeStageInput): Promise<ComposeStageOutput>;
  plan(input: PlanStageInput): Promise<PlanStageOutput>;
  provision(input: ProvisionStageInput): Promise<ProvisionStageOutput>;
  render(input: RenderStageInput): Promise<RenderStageOutput>;
  apply(input: ApplyStageInput): Promise<ApplyStageOutput>;
  verify(input: VerifyStageInput): Promise<VerifyStageOutput>;
};
```

`runDeployment` is the high-level, end-to-end runner used by CLI direct-mode.
`stages` is the per-stage decomposition used by BPMN task handlers, which
need to execute one stage at a time and persist results between tasks.

Code that moves into `deploy-runner`:

- The main stage runner from `apps/platform-http/src/deploy/executor.ts`
  (refactored to consume hooks instead of writing to repos).
- `apps/platform-http/src/deploy/stage-runner.ts` (executor support).
- `apps/platform-http/src/deploy/dokploy-client-factory.ts` (Dokploy
  client construction; secret values stay inside the closure as today).
- `apps/platform-http/src/deploy/smoke-verifier.ts` (smoke checks; called
  during the verify stage).
- `apps/platform-http/src/deploy/log-redactor.ts` (sanitization of all log
  lines emitted through hooks).
- `apps/platform-http/src/deploy/build-deploy-config.ts` (per-target deploy
  config assembly).
- `apps/platform-http/src/deploy/run-teardowns.ts` (cleanup helpers).

Code that does NOT move into `deploy-runner` — it belongs to the caller:

- `apps/platform-http/src/deploy/orphan-detect.ts` — the runner can emit a
  "stale running detected" signal through hooks, but the actual decision to
  finalize stale rows is owned by the caller (CLI or BPMN handler). For BPMN,
  this is a separate concern (Operaton-level incident/timer).
- `apps/platform-http/src/deploy/project-delete-executor.ts` — project-delete
  is a separate operation and gets its own follow-up workflow. It is out of
  scope for the first cut of `deploy-runner`; it can either move into a
  sibling library or stay until project-delete-as-BPMN is designed.

The runner does not import `pg`, `pino`, `hono`, `kafkajs`, or any other host
concern. It depends only on `@rntme/blueprint`, `@rntme/deploy-core`,
`@rntme/deploy-dokploy`, and shared result types.

### `apps/cli` additions

#### `apps/cli/src/deploy-engine/` (new)

Thin glue around `@rntme/deploy-runner`. Not a separate package.

- `load-target.ts` — read target file (JSON), validate against discriminated
  schema (`target.kind`), normalize.
- `load-secrets.ts` — resolve secret refs to plaintext: env-vars by default,
  later optionally age-encrypted local file. The first cut supports only
  env-var refs.
- `load-blueprint.ts` — load and compose the blueprint folder via
  `@rntme/blueprint`.
- `run.ts` — call `runDeployment` with hooks that print structured progress
  to stdout and optionally append a JSONL audit file (default off).
- `report.ts` — final result rendering for human and `--json` output.

#### `apps/cli/src/commands/` additions

- `deploy.ts` — direct mode top-level command: `rntme deploy <blueprint-dir>
  --target <file-path-or-slug>`. No platform involvement. No CLI auth required.
- `platform/up.ts` — alias that resolves to "deploy `apps/platform/blueprint`
  to the given target." Implementation is a thin wrapper that locates the
  platform blueprint inside the installed CLI bundle and delegates to
  `commands/deploy`.
- `platform/down.ts` — teardown the platform stack on a target (delegates to
  the same Dokploy adapter cleanup paths used during normal deploy
  superseding).
- `platform/login.ts` — rename of the current `login.ts`; sets base-url and
  bearer token for platform-client mode. Existing semantics unchanged.

Existing CLI commands stay where they are. `rntme project deploy --version N`
keeps calling the platform API; that path is platform-client mode.

#### Target file format (direct mode)

Direct mode reads target config from a local JSON file. Schema is discriminated
by `kind`:

```json
{
  "kind": "dokploy",
  "displayName": "preview",
  "config": {
    "dokployUrl": "https://dokploy.example.com",
    "dokployProjectId": "01HZ..."
  },
  "secrets": {
    "apiToken": { "source": "env", "name": "DOKPLOY_API_TOKEN" }
  },
  "eventBus": { "mode": "provisioned" },
  "publicBaseUrl": "https://preview.example.com"
}
```

`secrets[*].source` enum is `"env"` only in the first cut. Future sources
(`"file-age"`, `"op"` for 1Password CLI, `"keychain"`) are out of scope.

#### Bundle change

The CLI bundle ships `apps/platform/blueprint/` artifacts so `rntme platform
up` works without internet/git access. This requires a build-time copy step in
`apps/cli` (similar to existing `copy-skills-assets.cjs`). The bundle includes
only the JSON artifacts and BPMN files — no platform-side runtime code (the
runtime image is on the target).

### `apps/platform/blueprint/services/deployments/` additions

Existing service-level artifacts (`pdm/`, `qsm/`, `bindings/`, `graphs/`,
`service.json`) stay. New additions:

- `workflows/run-deployment.bpmn` — process definition with sequential
  service tasks: `compose`, `plan`, `provision`, `render`, `apply`, `verify`,
  with retry policies, timers, and an incident state on failure.
- `workflows/handlers/render.ts`, `provision.ts`, `apply.ts`, `verify.ts`,
  `compose.ts`, `plan.ts` — BPMN external task handlers, each ~30 lines:
  pull task variables from the Operaton context, call the matching `stages.*`
  function from `@rntme/deploy-runner`, persist evidence through service
  bindings, ack the task. Handler files live next to the `.bpmn` file in the
  blueprint and are bundled together; the runtime loader resolves them by the
  task type declared inside the BPMN process. The implementation plan must
  cover the handler-loader contract and fail loudly on missing handlers (no
  silent skip).
- Existing graph in `services/deployments/graphs/start-deployment` is updated
  to start the BPMN process instead of writing a "queued" row that a polling
  loop reads.
- The polling-based executor goes away. Orphan detection is handled at the
  BPMN level (incidents / timers).

### `@rntme/runtime` updates

Add (or confirm) generic HTTP middleware so platform-http no longer needs to
own them:

- `requestId`, `loggerMiddleware`, CORS, error handler, security headers,
  body limit, rate limit, same-origin guard.

These already exist in `@rntme/bindings-http` to a partial extent; the
implementation plan starts by auditing what is missing and lifting from
platform-http where needed. The runtime exposes them as default-on for any
HTTP surface; per-blueprint overrides come through the binding manifest where
already supported.

### `apps/platform-http/` deletion

The final commit deletes:

- The `apps/platform-http/` directory.
- Any workspace references in `pnpm-workspace.yaml` / `bun` workspace config /
  Dockerfiles / Dokploy compose render / docs that name it.
- The `bin: rntme-platform` entry — replaced by the runtime image bin.

The platform image rendered by `deploy-dokploy` switches its `image:` and
build context to the runtime image plus the platform blueprint artifacts.

### `apps/platform-http/src/auth/api-token-provider.ts`

Bearer-token validation (used by `/v1/*` machine routes today) becomes a
handler in `services/tokens` reachable from the API binding's auth middleware
chain. Implementation detail tracked in the deployments-service plan; the
contract is "graphs that need a verified token can call
`services/tokens.IntrospectToken` the same way they call
`services/identity-auth0.IntrospectSession`."

## CLI Surface

### Direct mode

```text
rntme deploy <blueprint-dir>
    --target <file-path>          # required, JSON file with target config
    [--secret-file <path>]        # reserved, unused in first cut
    [--name <suffix>]             # optional resource name suffix
    [--dry-run]                   # plan + render, no apply
    [--json]                      # machine-readable output
    [--log-file <path>]           # also append JSONL evidence
```

Examples:

```bash
DOKPLOY_API_TOKEN=… rntme deploy ./demo/notes-blueprint \
    --target ./targets/preview.json
```

```bash
rntme deploy ./demo/notes-blueprint \
    --target ./targets/preview.json --dry-run --json
```

### Platform-bootstrap

```text
rntme platform up    --target <file-path>
rntme platform down  --target <file-path>
```

`up` is `deploy apps/platform/blueprint --target X` against the bundled
platform artifacts.

### Platform-client

Unchanged from today. Existing `rntme login`, `rntme project deploy`, etc.,
keep their current behavior; only the underlying server changes (now the
runtime executing the platform blueprint).

## BPMN Process Definition

```text
[start]
  ↓
(service task) compose      retry: none, fail → incident
  ↓
(service task) plan         retry: none, fail → incident
  ↓
(service task) provision    retry: 1× backoff 30s, fail → incident
  ↓
(service task) render       retry: none, fail → incident
  ↓
(service task) apply        retry: none, fail → incident
  ↓
(service task) verify       retry: 3× backoff 10/30/60s, fail → incident
  ↓
[end: deployment_succeeded]

incident → finalize as failed → [end: deployment_failed]
```

Variables threaded through the process: `deploymentId`, `projectVersionRef`,
`targetSlug`, `composedBlueprintRef` (digest), `planResult`, `provisionResult`,
`renderResult`, `applyResult`, `verifyResult`. Secret values are never variable
contents; handlers resolve them per task from the platform's target-secret
store.

Process ownership is the `deployments` service. Operaton runs as part of the
deployed platform stack — and this is **new for the platform**. Today the
platform's own compose stack is Postgres + (soon) the runtime image; it does
not include Operaton because the existing `platform-http` deploy executor is
imperative. The implementation plan that introduces BPMN-orchestrated deploy
must also extend the platform's own rendered compose to include Operaton plus
its dependencies (Postgres schema or sibling DB), and treat that as part of
its scope. See "Migration Plan" plan 3.

## Bootstrap Story

Chicken-and-egg: BPMN-orchestrated deploy needs Operaton, but Operaton runs
inside the deployed platform.

Resolution: CLI direct-mode never uses BPMN. The first deploy of the platform
to any target is `rntme platform up --target X`, which runs `runDeployment`
synchronously in the CLI process. Operaton is started as part of the platform
stack rendered by the Dokploy adapter (existing wiring). After this, the
platform is live and any subsequent deploy of any blueprint (including a
re-deploy of the platform itself, which still goes through CLI direct-mode)
happens through the relevant code path:

- Re-deploy platform: CLI direct-mode (does not require existing platform).
- Deploy any other blueprint: either CLI direct-mode (no platform) or via the
  deployed platform's BPMN (with versions / history / inspectability).

## Testing Strategy

Boundary-focused tests at each layer:

- `packages/deploy/deploy-runner`:
  - Unit tests per stage (`compose`, `plan`, `provision`, `render`, `apply`,
    `verify`) with deterministic inputs.
  - End-to-end `runDeployment` tests against a Dokploy testcontainer (or
    skipped under `SKIP_TESTCONTAINERS`, mirroring existing pattern from
    commits 5d84fced and 11d230fb).
  - Hook contract tests: `onLog` redaction, `onStageComplete` evidence shape,
    `onTerminal` final result.
- `apps/cli/src/deploy-engine/`:
  - Unit tests for target-file load/normalize.
  - Unit tests for env-var secret resolution.
  - Integration tests for `rntme deploy` and `rntme platform up` against the
    Dokploy testcontainer.
- `apps/platform/blueprint/services/deployments/`:
  - Existing service composition tests stay.
  - New tests: BPMN process loads and validates; handlers map to the right
    `stages.*` calls; failure paths produce incidents not silent stalls.
- Platform end-to-end:
  - Cutover smoke: deploy demo `notes-blueprint` against a Dokploy
    testcontainer through the deployed platform's `services/deployments` BPMN
    instead of through `platform-http` executor.
- CLI end-to-end:
  - `rntme platform up` to a fresh Dokploy testcontainer succeeds.
  - `rntme platform up` followed by `rntme login` and `rntme project deploy`
    against the just-bootstrapped platform succeeds.

Old and new code paths run side by side until the deletion commit; tests
should increasingly assert against `deploy-runner` and the BPMN process, not
against `platform-http/src/deploy/`.

## Migration Plan (sequence of implementation plans)

1. **Extract `packages/deploy/deploy-runner`.** Create the new package, port
   the executor / stage-runner / smoke-verifier / log-redactor /
   dokploy-client-factory / build-deploy-config / run-teardowns into it
   behind the public API above. Wire `apps/platform-http/src/deploy/executor.ts`
   to call the new library so behavior is unchanged. Delete the moved files
   from `platform-http/src/deploy/` after the wrapper passes.

2. **CLI direct-mode.** Add `apps/cli/src/deploy-engine/` and the `deploy`
   command. Bundle `apps/platform/blueprint` artifacts. Add `platform up` and
   `platform down` commands. End-to-end test against Dokploy testcontainer.
   At this point, deploying any blueprint without the platform works.

3. **BPMN-orchestrated deploy in `services/deployments`.** Add
   `workflows/run-deployment.bpmn` and handler files. Switch the
   `start-deployment` graph to start a BPMN process instance. Extend the
   platform's own rendered compose (in `@rntme/deploy-dokploy`) to include
   Operaton + its database; verify the bootstrap path (`rntme platform up`)
   produces a working Operaton alongside the runtime. Wire BPMN external
   workers (`@rntme/bpmn-worker`) to register the new handler set. The
   `platform-http`-side deploy executor still exists and runs in parallel
   only if `PLATFORM_RUNTIME_MODE !== 'blueprint'`. End-to-end test via the
   deployed platform.

4. **Lift HTTP middleware into `@rntme/runtime`.** Audit
   `apps/platform-http/src/middleware/` against `@rntme/bindings-http`. Move
   missing pieces. Default-on in runtime; remove from platform-http.

5. **Move bearer-token validation into `services/tokens`.** Extract
   `apps/platform-http/src/auth/api-token-provider.ts` into a token
   introspection handler reachable from API binding auth middleware in the
   blueprint. Update API mounts accordingly.

6. **Delete `apps/platform-http`.** Switch the deploy renderer to use the
   runtime image plus blueprint artifacts directly. Remove the directory and
   workspace references. Delete `bin: rntme-platform`. Update Dockerfiles and
   Dokploy stack rendering. Final smoke deploy of platform-via-CLI to confirm
   nothing else depends on platform-http. Update owner docs.

Each plan ends with a green build, `bun run typecheck`, `bun run test`,
`bun run lint`, and `bun run depcruise`. Plans 1-3 can be parallelized to
some extent; plans 4-6 are sequential after them.

## Risks and Tradeoffs

- **Bootstrap dependency on Dokploy still.** Without a local target adapter,
  every direct-mode deploy needs a reachable Dokploy. Acceptable today; local
  adapter is a follow-up when a docker-capable environment is available.
- **CLI bundle grows.** Shipping `apps/platform/blueprint` artifacts inside
  the CLI npm bundle is a few hundred KB of JSON plus BPMN files. Trivial.
- **BPMN handlers vs. runtime extension.** The runtime needs a way to load
  per-blueprint BPMN handler code at startup. The `rntme_cli_dist_silent_stale`
  memory implies the bundle/handlers pattern already exists and was a source
  of past silent failures. The implementation plan must cover the loader
  thoroughly with explicit error codes; no silent skip on a missing handler.
- **Operaton presence in platform.** This is a new dependency for the
  platform's own runtime. Project-lifecycle BPMN per
  `2026-05-08-project-lifecycle-init-design.md` runs inside deployed
  *projects*, not inside the platform itself. Plan 3 must extend the platform's
  rendered compose accordingly. The added cost is one container plus a small
  database, which the platform already has via its existing Postgres.
- **No canonical contract for deploy.** If a second deploy backend ever
  appears (e.g., a Pulumi-flavored thing), refactoring will be needed. We
  accept this; F2/F3 say not to invent contracts in advance for a single
  vendor.
- **Direct-mode and platform-mode diverge in inspectability.** Direct mode
  produces stdout + optional JSONL; platform mode produces full inspection
  through the platform UI. This is the actual product difference between
  "deploy from your laptop" and "team-shared platform." Acceptable.
- **Project-delete operation is left in `platform-http` until its own
  workflow lands.** Plan 6 must keep project-delete behavior somewhere
  reachable — either move it into `deploy-runner` as a sibling operation, or
  design its own BPMN process before deleting `platform-http`. The plan that
  closes step 6 owns this gap.

## Documentation Touch

- `docs/decision-system.md` — add the three bets above when the first plan
  lands; promote to `current-default` as plans complete.
- `AGENTS.md` — update CLI navigation when direct-mode commands land; remove
  `apps/platform-http` from navigation in plan 6.
- `apps/cli/README.md` and `docs/current/owners/apps/cli.md` — document the
  three modes, the `deploy` and `platform` commands, and the target file
  format.
- `apps/platform/README.md` and `docs/current/owners/apps/platform.md` —
  update to reflect that the platform is the live runtime; remove "active
  hosted platform until cutover" wording.
- `packages/deploy/deploy-runner/README.md` and a new
  `docs/current/owners/packages/deploy/deploy-runner.md` — document the
  public API, hooks, and stage decomposition.
- Delete `apps/platform-http/README.md` and
  `docs/current/owners/apps/platform-http.md` in plan 6.
- `docs/current/owners/packages/runtime/runtime.md` — update with the
  middleware additions in plan 4.

## Open Questions

- **Project-delete operation.** Move into `deploy-runner` as a sibling
  operation, or model as its own BPMN process inside
  `services/deployments`? Decide in plan 6 (or earlier if it blocks plan 1).
- **CLI auth in direct mode for shared targets.** If a team wants to share
  a target file but each member uses their own Dokploy credentials, env-var
  resolution suffices. If they want to share credentials, secrets handling
  needs more thought. Out of scope for first cut.
- **Bundling BPMN handler code.** Whether handlers live in the blueprint
  folder as `.ts` files (compiled by the bundler) or in a sibling
  `apps/platform/blueprint-handlers/` package. The first cut puts them in
  the blueprint folder per the existing pattern; the implementation plan
  may revisit if it causes packaging friction.
