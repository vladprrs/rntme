# Sustained Cutover to Thin Bootable Platform

Date: 2026-05-11

## Status

Approved design pending user review of this written form. Implementation plan
not written yet.

## Context

Goal `dokploy-platform-e2e-deploy` aims for a successful end-to-end deploy of
`apps/platform/blueprint` to live Dokploy at `platform.rntme.com`. Worker
iteration T005 stopped before deploy with one concrete failure
(`DEPLOY_EXECUTOR_SERVICE_GRAPHS_NOT_FOUND:app` from `to-deploy-core-input.ts`)
and a documented list of 3-4 more gaps behind it. Full receipt:
`docs/goals/dokploy-platform-e2e-deploy/notes/T005-partial-receipt-stop.md`.

The 2026-05-10 spec
(`docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`)
sets the architectural target: CLI universal deploy front, BPMN-orchestrated
deploys inside the deployed platform, `apps/platform-http` deleted. Plan-1
through plan-2 are in motion. Plan-3 (BPMN inside the platform) and
plan-4-onward are unblocked but not landed. This spec is a **time-boxed
cutover** to get the first live platform deploy working before plan-3.

The user-selected scope for this cutover is **thin bootable platform**:

- `rntme platform up --target ./platform.target.json` reaches `verify` stage
  green against live Dokploy.
- `https://platform.rntme.com/` returns 200 + HTML.
- Auth0 SPA login flow completes; `/api/*` enforces auth.
- **Not in scope:** BPMN-orchestrated deploys inside the platform. Operaton +
  workflow-worker stay out of the rendered stack. Plan-3 of the 2026-05-10
  spec reintroduces them later.

## Gaps to Close

Numbered as in `T005-partial-receipt-stop.md`:

1. **UI-only "domain" service.** `services/app/service.json` declares
   `kind: 'domain'` but has only `ui/`; `buildRuntimeArtifactFiles`
   unconditionally requires `graphSpec`, `qsmValidated`, `bindings`. Semantic
   gap, not a one-liner.
2. **Provisioner `.entry.js` packaging.** `services/identity-auth0` is
   `kind: 'integration-module'` and needs its provisioner entry bundled into
   the CLI dist. Current `copy-platform-blueprint.cjs` copies JSON only.
   Plus a separate problem: `project.json.vars` declares
   `AUTH0_SPA_CLIENT_ID: { from: 'provision.identity.spaClient.id' }` but
   vars resolve at `compose` while provision runs after `plan`. Memory
   `rntme_blueprint_vars_vs_provisioner` flagged this exact mismatch.
3. **Deploy-worker image reachability.** `workflows.json` references native
   handlers from `@rntme/deploy-runner` packaged into image
   `ghcr.io/vladprrs/rntme-bpmn-worker:e2e-bpmn-4e3f55d-json-1`. Out of
   scope for thin mode — addressed by gap-3 bypass below.
4. **First-deploy platform DB seeding.** Whether the runtime auto-bootstraps
   SQLite schemas (event store + projections) on first boot is unverified.
   Code inspection during brainstorming confirmed `SqliteEventStore` calls
   `applyEventStoreSchema(db)` on open (`packages/runtime/event-store/src/store/sqlite.ts:50`)
   and `@rntme/projection-consumer` uses `CREATE TABLE IF NOT EXISTS` via
   `bootstrapProjections`. So this gap is expected to evaporate at run time;
   it is **verified empirically in Slice D**, not addressed by code changes.
5. **`target_secrets` store for Operaton's `adminUserSecretRef`.** Moot for
   thin mode — Operaton is not rendered. Resurfaces in plan-3.

## Decision-System Impact

This spec is a tactical cutover that **does not introduce new locked bets** in
`docs/decision-system.md`. It executes within the bets already locked by:

- "Platform as blueprint" (2026-05-09 spec).
- "CLI universal deploy front" (2026-05-10 spec).
- "Deployments service + adapter boundary" (2026-05-09 spec).

It does add one **convention** that should be recorded in
`docs/current/owners/packages/platform/deploy-bundle-input.md` when Slice A
lands: services may declare `kind: 'domain'` with only UI artifacts and no
graphs/qsm/bindings (UI-only domain). Mixed-partial state is a hard error.

## Approach

Sustained cutover delivered as four sequential Worker slices. A and B are
independent and can be parallelised; C depends on A+B; D depends on C.

Each slice ends with:

- `bun run typecheck`, `bun run test`, `bun run lint`, `bun run depcruise` all
  green at the workspace level.
- A receipt note under `docs/goals/dokploy-platform-e2e-deploy/notes/`.
- `state.yaml` updated.

The cutover ends with `full_outcome_complete: true` in `state.yaml` after
Slice D's verify proofs.

| # | Slice | Closes gap | Main artifact |
| --- | --- | --- | --- |
| A | UI-only kind allowance | 1 | `to-deploy-core-input.ts` + tests |
| B | BPMN engine `disabled` mode | 3, 5 | target schema + `workflow-render.ts` skip |
| C | Provisioner bundling + two-pass vars | 2 | postbuild esbuild + var-resolution pass |
| D | Live deploy + verify | 4 (empirical) + Auth0 login | green `rntme platform up` against live Dokploy |

## Slice A — UI-only Kind Allowance

### Target

`services/app` is `kind: 'domain'` with only `ui/` (layouts, screens,
manifest.json). Compose must accept this without bundling phantom graphs/qsm.

### Change

`packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts`,
function `buildRuntimeArtifactFiles`:

- If all three of `service.graphSpec`, `service.qsmValidated`,
  `service.bindings` are `null` → UI-only domain. Emit:
  - `manifest.json` with `surface.http.enabled: true`,
    `surface.grpc.enabled: false`, `seed.enabled: false`, `modules: []`,
    `ui: { enabled: true, buildPath: 'ui' }`.
  - UI assets copied from `uiBuildFiles` for this service.
  - No `pdm.json`, no `shapes.json`, no `graphs/*`, no `bindings.json`,
    no `qsm.json`, no proto files.
- If all three are non-null → existing behaviour.
- Any **mixed** state (e.g. graphSpec present, bindings null) → throw
  `DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_PARTIAL:<serviceSlug>` with a message
  listing which artifacts are present and which are missing. This guards
  against a service author accidentally shipping half a domain.

The caller at line 82-84 of `to-deploy-core-input.ts` already only invokes
`buildRuntimeArtifactFiles` for `kind === 'domain'`. No change needed at the
call site.

The UI runtime (HTTP binding serving UI assets) is already configured per
existing `routes.ui` / `mounts` declarations in `project.json`. UI-only
services keep `surface.http.enabled: true` so the runtime registers the HTTP
server for the UI mount.

### Tests

`packages/platform/deploy-bundle-input/test/unit/to-deploy-core-input.test.ts`:

- UI-only domain composes to a manifest with `http.enabled: true`,
  `grpc.enabled: false`, and a non-empty `uiBuildFiles` subset.
- Full domain composes unchanged.
- Mixed state (graphSpec non-null, bindings null) throws
  `*_ARTIFACTS_PARTIAL`.

### Files Changed

- `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts`
- `packages/platform/deploy-bundle-input/test/unit/to-deploy-core-input.test.ts`

## Slice B — BPMN Engine `disabled` Mode

### Target

Target files can declare `workflows.engine.kind: 'disabled'` to opt out of
Operaton + workflow-worker render entirely while keeping the blueprint's
workflow files in the bundle for future BPMN activation.

### Changes

1. **`apps/cli/src/deploy-engine/target-schema.ts`** — extend the
   discriminated union for `workflows.engine`:

   ```ts
   type WorkflowEngine =
     | { kind: 'operaton'; mode: 'provisioned'; image: string; uiAccess?: ... }
     | { kind: 'disabled' };
   ```

   When `kind === 'disabled'`, `target.workflows.worker` becomes optional.
   The whole `workflows` block can be omitted from target.json (equivalent
   to `{ engine: { kind: 'disabled' } }`) — keep both shapes valid.

2. **`packages/deploy/deploy-dokploy/src/workflow-render.ts`** — at the top
   of `renderOperatonStack` and `renderWorkerWorkload` (or whichever
   helpers exist), short-circuit on `engine.kind === 'disabled'` and return
   `null`. The composed plan consumer already handles `null` workloads
   (verify by reading the call sites; if not, add the guard there).

3. **`platform.target.json`** — replace the existing `workflows` block with:

   ```json
   "workflows": { "engine": { "kind": "disabled" } }
   ```

4. **`apps/cli/test/fixtures/target-platform.json`** — same update.

5. **`apps/platform/blueprint/project.json`** — **no change**. The
   blueprint still references `workflows.manifest`. The runtime sees the
   workflow files in `/srv/artifacts/workflows/` but does not start a BPMN
   worker when the rendered stack has no `bpmn-worker` workload. This is
   already how `@rntme/runtime` behaves when no worker config is present
   (verify in implementation).

### Tests

- `apps/cli/test/unit/deploy-engine/load-target.test.ts` — fixture with
  `engine.kind: 'disabled'` parses; fixture omitting `workflows` entirely
  parses; fixture with `kind: 'disabled'` and stray `worker` field rejects
  with a clear error message.
- `packages/deploy/deploy-dokploy/test/unit/workflow-render.test.ts` — at
  `engine.kind: 'disabled'`, render returns `null` (or an empty plan slice);
  the rest of the deploy plan is identical to the same target with
  workflows omitted.

### Files Changed

- `apps/cli/src/deploy-engine/target-schema.ts`
- `packages/deploy/deploy-dokploy/src/workflow-render.ts`
- `platform.target.json`
- `apps/cli/test/fixtures/target-platform.json`
- `apps/cli/test/unit/deploy-engine/load-target.test.ts`
- `packages/deploy/deploy-dokploy/test/unit/workflow-render.test.ts`

## Slice C — Provisioner Bundling and Two-Pass Vars

### Target

`identity-auth0` provisioner runs from the bundled CLI artifacts during
`rntme platform up`, creates the Auth0 SPA client, and supplies
`provision.identity.spaClient.id` for `AUTH0_SPA_CLIENT_ID` var resolution
before `render`.

This slice has the most moving parts. Sub-tasks C1-C5 are sequential within
the slice. C6 (tests) ride alongside each.

### C1 — Postbuild bundling of `.provisioner.entry.js`

Replace `apps/cli/scripts/copy-platform-blueprint.cjs` with
`apps/cli/scripts/build-platform-blueprint.cjs`:

1. Copy `apps/platform/blueprint/` JSON contents to
   `apps/cli/dist/platform-blueprint/` (existing behaviour, preserved).
2. Read `apps/platform/blueprint/project.json`. Collect
   `modules[*].package` (e.g. `rntme_identity_auth0`).
3. Resolve each package via `require.resolve('<package>/package.json',
   { paths: [...] })`. Read its `package.json` and look up
   `rntme.provisioner.entry` (convention: source path relative to package
   root). Fall back to `dist/provisioner.entry.js` if the field is absent
   and the file exists.
4. Bundle each entry with `esbuild`:
   - `bundle: true`, `format: 'esm'`, `target: 'node20'`, `platform: 'node'`
   - `external: ['@rntme/*']` so cross-package types stay resolved via
     node_modules at runtime.
   - Output: `apps/cli/dist/platform-blueprint/.provisioners/<package>.entry.js`.
5. Write `apps/cli/dist/platform-blueprint/.provisioners/manifest.json`:
   `{ "<package>": "<package>.entry.js" }`.

If any module has `kind: 'integration-module'` in its service.json but no
resolvable provisioner entry, **fail the build with a clear error** that
names the service and the package. Silent skip is not allowed (per the
`rntme_cli_dist_silent_stale` memory).

### C2 — Resolver for bundled entries

The current resolver `packages/artifacts/blueprint/src/compose/modules.ts`
maps `rntme_<cat>_<vendor>` aliases to `modules/<cat>/<vendor>/` paths in
the workspace. That stays for dev mode.

Add a new helper that the deploy-runner / provisioner-runner calls:

```ts
// packages/artifacts/blueprint/src/compose/provisioner-loader.ts
export function loadProvisionerEntry(args: {
  packageName: string;
  bundleRoot: string;
}): Promise<{ run: ProvisionerRunFn } | null>;
```

It looks at `<bundleRoot>/.provisioners/<packageName>.entry.js` first
(deployed mode). If absent and `bundleRoot` points inside the workspace,
fall back to dev-mode resolution via `workspacePackagePathSegments`.
Return `null` only when the module legitimately does not need a
provisioner. Throw on packaging inconsistencies.

### C3 — Two-pass var resolution

Stage order stays `compose → plan → provision → render → apply → verify`.

Add explicit handling of unresolved vars:

1. In `compose` (where vars resolve today), classify each var:
   - `from` starts with `target.` → resolve immediately from
     `NormalizedTarget`.
   - `from` starts with `provision.` → mark `pendingProvisionerOutput`,
     leave var unresolved in the composed blueprint.
   - Anything else → existing behaviour.
   The composed blueprint now carries `pendingProvisionerOutputs: string[]`
   (an array of var names).
2. In `compose` validation, **do not fail** for unresolved vars whose
   source is `provision.*` — that is the expected interim state.
3. After `provision` stage produces `provisionResult.outputs` (a flat map
   keyed by dotted paths like `identity.spaClient.id`), a small new step
   `resolve-provisioner-vars` runs before `render`. It walks
   `pendingProvisionerOutputs` and resolves each var from
   `provisionResult.outputs`. Any var still unresolved at this point is a
   hard error: `BLUEPRINT_VAR_UNRESOLVED_AFTER_PROVISION:<varName>`.
4. The resolved blueprint goes into `render`.

This change lives in:

- `packages/artifacts/blueprint/src/compose/vars.ts` (or wherever var
  resolution happens today — implementation plan locates the exact file).
- `packages/deploy/deploy-core/src/stages.ts` (or equivalent) — add the
  resolve-provisioner-vars step between provision and render. It is
  internal to the deploy pipeline, not a publicly addressable stage.

### C4 — Auth0 management credentials wiring

`platform.target.json` already declares:

```json
"secrets": {
  "extras": {
    "auth0Mgmt": {
      "tenantDomain": { "source": "env", "name": "AUTH0_DOMAIN" },
      "mgmtClientId": { "source": "env", "name": "AUTH0_MANAGEMENT_CLIENT_ID" },
      "mgmtClientSecret": { "source": "env", "name": "AUTH0_MANAGEMENT_CLIENT_SECRET" }
    }
  }
}
```

Confirm and (if needed) extend `apps/cli/src/deploy-engine/load-secrets.ts`
so that:

- `extras` is resolved alongside `apiToken`.
- The resolved `ResolvedTargetSecrets.extras.auth0Mgmt` is passed into the
  provisioner runner as part of the `provisionerContext.secrets` field that
  `@rntme/identity-auth0` expects.

The `@rntme/identity-auth0` provisioner contract is already defined; this
slice does not change its shape. If `extras.auth0Mgmt` is missing while a
module needs it, the provisioner itself emits a clear error.

### C5 — Provisioner runner in CLI direct mode

In CLI direct-mode (no platform), the provisioner stage runs in the CLI
process:

1. For each `integration-module` service in the composed blueprint:
   - Locate bundled entry via `loadProvisionerEntry`
     (`bundleRoot = apps/cli/dist/platform-blueprint`).
   - Dynamic `import()` the entry, expect a default export with shape
     `{ run: (input) => Promise<{ outputs }> }`.
   - Build `input.context` from `{ target, resolvedTargetSecrets, signal }`.
   - Call `run()` with a 60s timeout (configurable later).
2. Collect outputs into `provisionResult.outputs` namespaced by the module
   slug (`identity` for `services/identity-auth0` per `project.json.modules`).
3. Surface progress through the existing deploy hooks (`onStageBegin`,
   `onLog`, `onStageComplete`).

Bundle root resolution: in CLI direct-mode, the CLI is either run from the
workspace (`apps/cli/dist/...` is one level up from where the CLI script
sits) or from an npm install (`<install-root>/dist/platform-blueprint`).
Use `import.meta.url`-relative resolution; fall back to
`RNTME_CLI_BUNDLE_ROOT` env var if needed. Concrete path strategy is locked
in the implementation plan.

### C6 — Tests

- **C1 build script:** Test that running the script against the fixture
  blueprint produces `.provisioners/rntme_identity_auth0.entry.js` and the
  manifest. Failure case: module without resolvable entry → script exits
  non-zero with a message naming the service and package.
- **C2 resolver:** `loadProvisionerEntry` returns the bundled entry when
  present; falls back to workspace mode when bundle is workspace-relative;
  throws on unresolvable.
- **C3 two-pass vars:** Compose with a `from: 'provision.*'` var produces
  `pendingProvisionerOutputs`. Resolve step fills it in. Hard error if
  unresolved post-provision.
- **C4 secrets:** `load-secrets` returns `extras.auth0Mgmt` with each
  field resolved; missing env vars produce a clear list.
- **C5 runner:** Integration test with a stub provisioner entry (no
  network) — CLI direct-mode pipeline executes the entry, threads outputs
  into render.

### Files Changed

- `apps/cli/scripts/build-platform-blueprint.cjs` (new, replaces
  `copy-platform-blueprint.cjs`)
- `apps/cli/package.json` — postbuild script ref
- `packages/artifacts/blueprint/src/compose/provisioner-loader.ts` (new)
- `packages/artifacts/blueprint/src/compose/vars.ts` (var classification)
- `packages/deploy/deploy-core/src/stages.ts` (resolve-provisioner-vars step)
- `apps/cli/src/deploy-engine/load-secrets.ts` (extras passthrough)
- `apps/cli/src/deploy-engine/run.ts` (or equivalent — invokes provisioner
  runner for direct mode)
- Tests in matching `test/unit/` directories.

## Slice D — Live Deploy and Verify

### Pre-flight

- Workspace has zero diff except the slice-C commits.
- `bun run build` clean from scratch (`apps/cli/dist/` regenerated).
- Auth0 Management env vars present in shell:
  `AUTH0_DOMAIN`, `AUTH0_MANAGEMENT_CLIENT_ID`,
  `AUTH0_MANAGEMENT_CLIENT_SECRET`, `DOKPLOY_API_KEY`.
- Old Dokploy artefacts for `platform.rntme.com` are clean (no stale
  workloads from previous attempts). MCP `application-search` /
  `compose-search` used to confirm.

### Steps

1. `rntme platform up --target ./platform.target.json --dry-run --json`
   → expect all six stages succeed, render plan visible, no Operaton or
   worker workload in plan, `AUTH0_SPA_CLIENT_ID` resolved from
   `provision.identity.spaClient.id`.
2. `rntme platform up --target ./platform.target.json --json` (real deploy).
   Expect all stages green.
3. `curl -i https://platform.rntme.com/` → 200, content-type text/html,
   body contains the platform UI shell.
4. Open `https://platform.rntme.com/` in a browser. Auth0 SPA login:
   - Redirect to `<AUTH0_DOMAIN>/authorize`.
   - Callback to `https://platform.rntme.com/auth/callback`.
   - SPA stores token; UI mounts authenticated.
5. `curl -i https://platform.rntme.com/api/organizations` (no token)
   → 401.
6. `curl -i -H "Authorization: Bearer <token>"
   https://platform.rntme.com/api/organizations` → 200 with the user's
   org list.
7. MCP `application-readLogs` on every platform workload — no `ERROR`
   level entries from the deploy window.

### Acceptance

All seven steps pass. Receipt at
`docs/goals/dokploy-platform-e2e-deploy/notes/T009-platform-up-success.md`
(numbering follows existing T-series). `state.yaml` updates
`full_outcome_complete: true` and links the receipt.

### Empirical gap-4 check (migrations)

If any service comes up with a `SqliteEventStore` open error or a
projection `no such table` error in logs, that is gap-4 surfacing. Hand
back to brainstorming for a migration-bootstrap design — do **not**
patch in a quick init script. The expectation from code review during
brainstorming is that the runtime auto-bootstraps; if reality disagrees,
that is a real design gap.

## Risks and Tradeoffs

- **Slice C is the heaviest.** Two-pass var resolution touches compose
  and the deploy pipeline. If the implementation plan finds a cleaner
  refactor (e.g. moving provision before plan), it can revisit — but
  the plan-internal contract must stay clear.
- **Bundle root resolution under npm install.** Slice C5's
  `import.meta.url`-relative scheme has not been exercised end-to-end
  for a published CLI. Workspace-mode is verified by the existing
  `copy-platform-blueprint.cjs`; npm-mode is verified empirically only
  if/when we publish.
- **BPMN files in bundle but no worker.** Slice B leaves
  `services/deployments/workflows/*.bpmn` and `workflows.json` in the
  runtime artifacts directory. The runtime must NOT attempt to start a
  BPMN client when the deploy plan has no worker workload. If it does,
  Slice B has a follow-up (gate runtime BPMN init on a manifest flag).
- **Auth0 SPA client lifecycle.** The provisioner creates the SPA
  client on first deploy. Idempotency: re-runs should detect the
  existing client (by name/audience) and reconcile callbacks rather
  than create duplicates. `@rntme/identity-auth0`'s provisioner already
  encodes this contract; verify in C5 tests with a "second run"
  fixture.
- **Operaton resurfacing in plan-3.** When BPMN-orchestrated deploys
  land (per 2026-05-10 spec plan-3), the `disabled` engine kind stays
  as a first-class option for environments that do not need
  inspection / history. This is a useful side-effect, not a goal of
  this spec.

## Documentation Touch

- `docs/decision-system.md` — no new bets. No touch in this spec.
- `docs/current/owners/packages/platform/deploy-bundle-input.md` — note
  the UI-only domain convention when Slice A lands.
- `docs/current/owners/apps/cli.md` — document `engine.kind: 'disabled'`
  in the target file format when Slice B lands.
- `docs/current/owners/packages/artifacts/blueprint.md` — document
  `pendingProvisionerOutputs` and the resolve-provisioner-vars step
  when Slice C lands.
- `docs/goals/dokploy-platform-e2e-deploy/notes/` — receipt per slice.

## Out of Scope

- BPMN-orchestrated deploys (plan-3 of 2026-05-10 spec).
- `packages/deploy/deploy-runner` extraction as a standalone library
  (plan-1 of 2026-05-10 spec). Slice C touches `deploy-core` stages
  directly; if `deploy-runner` lands in parallel, this spec's changes
  rebase onto it.
- `target_secrets` store. Resurfaces with Operaton in plan-3.
- Local docker target adapter (`packages/deploy/deploy-local`).
- Multi-tenant or multi-target verification — Slice D verifies the
  single `platform.rntme.com` instance only.

## Open Items Inside the Implementation Plan

The implementation plan must lock concrete answers for these. They
were considered during brainstorming but the answer depends on code
details that the plan author will read first.

- C3 vs alternative ordering. Two-pass is the recommended path; the
  plan author may prefer reordering stages if the cost is small.
- C5 bundle-root resolution under npm install vs workspace dev.
- Exact filename of the existing `vars` resolution code in
  `packages/artifacts/blueprint/src/compose/`.
- Concrete `engine` discriminator placement (is it
  `target.workflows.engine` or `target.workflows`?) — code reading
  during planning will confirm.
