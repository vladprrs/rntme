> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Notes-demo deployable on a fresh Auth0 tenant — design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-05-04
**Related:**
- `docs/history/specs/historical/2026-05-03-module-provisioner-contract-design.md` — provisioner contract; required prereq, merged.
- `docs/history/specs/historical/2026-05-03-provisioner-bundle-transport-design.md` — bundle v2 + asset transport for provisioner JS; merged. This spec closes its §15 follow-up "`vars`-vs-provisioner architectural mismatch".
- `docs/history/specs/historical/2026-05-01-provisioned-event-bus-design.md` — provisioned Redpanda compose; merged (PR #111). This spec is independent but compatible.
- `docs/history/specs/active-rationale/2026-05-01-notes-demo-recovery-design.md` — operational recovery (manual `token_endpoint_auth_method` PATCH was its leftover gap; this spec eliminates the manual step).

**Implementation locations:**
- Pipeline reorder — `packages/deploy/deploy-core/src/{plan.ts,vars.ts}`, `apps/platform-http/src/deploy/executor.ts`.
- Boot fragility — `packages/runtime/ui-runtime/src/client/entry.tsx`, `modules/identity/auth0/module.json` and peers.
- Vendoring sync — `demo/notes-blueprint/node_modules/rntme_identity_auth0/`, `apps/cli/` or workspace `scripts/`.
- /api/notes 500 — TBD by diagnostic; primary location `packages/runtime/runtime/`.

## 1. Problem

The 2026-05-01 recovery operation got `notes-demo` running, but with three latent gaps that prevent the demo from being **deployable from scratch on a fresh Auth0 tenant**:

1. **Manual Auth0 PATCH.** SPA client `token_endpoint_auth_method` had to be set to `"none"` by hand via the Management API. The provisioner already writes the correct value (`modules/identity/auth0/src/provisioner.ts:39`), but **never runs end-to-end** for notes-demo because:
2. **Pipeline `vars`-vs-`provision` ordering.** Blueprint vars resolve at plan time before the provisioner runs. `vars.AUTH0_SPA_CLIENT_ID.from = "target.auth.auth0.clientId"` requires the SPA client id to exist in the deploy target *before* the provisioner can create it. On a fresh tenant there is nothing to put in `target.auth.auth0.clientId`, so `config.json` ships with an empty `clientId` and Auth0 SDK boot rejects.
3. **`mountUiRuntime` is fragile.** Any unhandled error in any module's `boot()` aborts the entire `await` chain, `createRoot` is never called, `<div id="root">` stays empty. The 2026-05-04 user-visible "blank page after Auth0 redirect" trace was exactly this failure mode amplifying gap (1).

In addition:

4. The vendored `demo/notes-blueprint/node_modules/rntme_identity_auth0/` is **out of sync** with the source-of-truth `modules/identity/auth0/` (currently sitting as an unstaged change in the working tree, with a stale `provisioner.entry: ./dist/provisioner.js` path predating bundle transport).
5. `/api/notes` returns 500 `INTERNAL_ERROR` after a successful Auth0 login. The auth-middleware works (probing without a token returns 401 `RUNTIME_AUTH_TOKEN_INVALID`); the 500 happens deeper. Live MCP inspection shows the running `app` container has only 6 env vars and `RNTME_PERSISTENCE_MODE=ephemeral`, with no DB or event-bus env. Most likely root cause: ephemeral SQLite has no `CREATE TABLE` step on boot, so the `listNotes` query hits a missing `notes` table.

## 2. Goal

Make the user-facing definition of "demo works" be **repeatable from scratch**:

1. Spin up a new Auth0 tenant and a Management API M2M app.
2. Register a deploy target on the platform with `auth.auth0.{tenantDomain, mgmtClientId, mgmtClientSecret}` and `eventBus` (any of `external`, `provisioned`, `in-memory` — orthogonal). **Without** `target.auth.auth0.clientId` — the provisioner creates it.
3. `POST /v1/.../deployments` reaches terminal `succeeded` (not `_with_warnings`).
4. `https://<host>/` SPA renders, login through Auth0 works, `/api/notes` returns 200, create/list/delete work.
5. `DELETE /v1/.../projects/notes-demo` invokes `tearDown`, which removes the SPA client + resource server in Auth0.

## 3. Non-goals

- Cleanup workflow for the orphan-detect `queued` sweep gap (memory `rntme_orphan_detect_queued_gap.md`). Separate spec.
- Styled visual error banner for `bootErrors`. Separate UX PR.
- Sandbox / capability model for provisioner code execution. Out of scope per `2026-05-03-provisioner-bundle-transport-design.md §15`.
- Multi-tenant Auth0 (one resource server across projects). Product-level decision, not platform.
- Rotating M2M client secrets. Provisioner already warns `AUTH0_M2M_SECRET_LOST`; rotation flow is a separate spec.
- Replacing `target.auth.auth0.clientId` as a valid var source. It stays valid for production targets that pre-provision SPA clients out-of-band.
- Updating non-Auth0 identity modules' provisioner state. Workos/Clerk identity-contract flag is included in PR2; their full provisioner blocks land separately.

## 4. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Definition of done | β: deployable from scratch on a fresh Auth0 tenant. A + B + C + D in scope. |
| D2 | How to break vars-vs-provisioner ordering | Pipeline reorder. New order: `plan-phase1 → provision → resolve-vars → plan-phase2 → render → apply → verify`. |
| D3 | Provision-derived var source | New `from: "provision.<moduleKey>.<output>.<jsonPointer>"`. `<moduleKey>` is the local key from `project.json#modules`, not a package name. |
| D4 | Backward compat for vars | `target.*` and `env.*` sources unchanged. `target.auth.auth0.clientId` stays valid for targets that pre-provision SPA clients. |
| D5 | Boot fragility approach | γ: soft-fail per module, identity-aware contract. Identity modules **must** set `/auth/status`; runtime sets `'anon'` on their behalf only if they crashed before doing so. Other modules: `console.error` and continue. |
| D6 | Identity contract surface | New optional `client.contract: "identity"` in `module.json`. Whitelist enforced in `@rntme/blueprint`. |
| D7 | Visual feedback for boot errors | State path `/runtime/bootErrors`. No styled UI in this spec — `console.error` plus the state slot is enough infra; banner is future UX work. |
| D8 | `/api/notes` 500 handling | Diagnostic methodology in spec; concrete fix discovered during PR4 plan execution after a working deploy is reachable. Primary hypothesis: ephemeral persistence skips `CREATE TABLE` step. |
| D9 | Vendoring sync | Re-vendor + add `pnpm vendor:check` (and `pnpm vendor:sync`) to CI lint. Diff source-of-truth `modules/<cat>/<vendor>/` against `demo/<bp>/node_modules/<pkg>/`. |
| D10 | Packaging | Four PRs in dependency order: PR1 (C) → PR2 (B) → PR3 (D) → PR4 (A). PR1 and PR2 may land in parallel; PR3 is the architectural one; PR4 needs PR3 deployed to diagnose. |

## 5. Pipeline reorder (D)

### 5.1 Old order

```
buildProjectDeploymentPlan(config, manifests):
  vars = resolveBlueprintVars(config, target)
  composed = composeWithVars(manifests, vars)
  → Plan
runProvisioners(plan, target.auth) → provisionResult
renderDokployPlan(plan, provisionResult)
applyDokployPlan / verify
```

`config.json` is rendered from `composed.publicConfigJson` and shipped as a deploy-time bind mount. Provisioner output arrives too late to influence it.

### 5.2 New order

```
buildPlanPhase1(config, manifests):           // structural plan, no vars
  → PartialPlan { discoveredModules, infrastructure, … }

runProvisioners(partialPlan, target.auth)
  → provisionResult                            // spaClient.id, resourceServer.identifier populated

resolveDeploymentVars(config, target, provisionResult)
  → Vars                                       // can reference provision.*

buildPlanPhase2(partialPlan, vars, manifests)
  composed = composeWithVars(manifests, vars)
  → Plan

renderDokployPlan(plan, provisionResult)       // unchanged; ENV_MAPPINGS still inject env
applyDokployPlan / verify                      // unchanged
```

### 5.3 Concrete changes

1. **`packages/deploy/deploy-core/src/plan.ts`** — split `buildProjectDeploymentPlan` into `buildPlanPhase1` and `buildPlanPhase2`. The existing convenience function remains for callers that don't need provisioner-derived vars: `buildProjectDeploymentPlan = config → phase1 → resolveDeploymentVars(no provision) → phase2`.
2. **`packages/deploy/deploy-core/src/vars.ts`** (new) — `resolveDeploymentVars(config, target, provisionResult): Result<Vars>`. Existing var-resolution logic in `plan.ts` migrates here.
3. **New source kind**: `from: "provision.<moduleKey>.<output>.<path>"`.
   - `<moduleKey>`: key from `project.json#modules` (e.g. `"identity"`).
   - `<output>`: name from `module.json#provisioner.produces[].name` (e.g. `"spaClient"`).
   - `<path>`: JSON pointer in `publicOutputs.<output>` (e.g. `"id"`).
   - Full example: `"provision.identity.spaClient.id"`.
4. **`apps/platform-http/src/deploy/executor.ts`** — re-sequence stage calls. Add new log step entries `provisioning-modules` and `resolving-vars`. Top-level `deployment.status` enum unchanged (no DB migration).
5. **`demo/notes-blueprint/project.json#vars`**:
   ```diff
   - "AUTH0_SPA_CLIENT_ID": { "from": "target.auth.auth0.clientId", "required": true }
   + "AUTH0_SPA_CLIENT_ID": { "from": "provision.identity.spaClient.id", "required": true }
   ```
   `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_REDIRECT_URI` stay on `target.auth.auth0.*` — user-supplied, not provisioner output.
6. **Backward compat**: `target.auth.auth0.clientId` stays optional in the deploy target schema and stays valid as a var source. Removing the `required: true` constraint is a notes-demo-only change in `project.json`.

### 5.4 Edge cases

- **Provisioner timeout/failure**: vars never resolve; deployment errors with the provisioner's native error code; render never starts.
- **`tearDown`**: uses `prior.publicOutputs`/`secretOutputs` directly. Vars are not consulted. Reorder does not touch tear-down.
- **Idempotent redeploy**: provisioner reconciles by name → returns same `spaClient.id` → vars resolve identically → render output identical → resources `unchanged`.
- **Var with `provision.*` source but no `provisioner` block on the module**: caught at phase1 with `BLUEPRINT_VAR_PROVISION_MODULE_MISSING`, before provision starts.

### 5.5 Error codes (deploy-core)

| Code | When |
|---|---|
| `BLUEPRINT_VAR_PROVISION_PATH_INVALID` | `from` string syntax wrong |
| `BLUEPRINT_VAR_PROVISION_MODULE_MISSING` | `<moduleKey>` not in `project.json#modules` |
| `BLUEPRINT_VAR_PROVISION_OUTPUT_NOT_DECLARED` | `module.json#provisioner.produces` lacks the named output |
| `BLUEPRINT_VAR_PROVISION_OUTPUT_MISSING` | provisioner returned without `publicOutputs[<output>]` |
| `BLUEPRINT_VAR_PROVISION_PATH_NOT_FOUND` | JSON pointer didn't resolve |

## 6. Boot fragility (B)

### 6.1 Code change in `entry.tsx`

```ts
type BootError = { moduleName: string; cause: unknown };
const bootErrors: BootError[] = [];

for (const m of opts.modules ?? []) {
  if (!m.boot) continue;
  const ctx = createModuleBootContext({ … });
  const ms = m.bootTimeoutMs ?? 10_000;
  try {
    await Promise.race([
      Promise.resolve(m.boot(ctx)),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error(`boot timeout: ${m.name}`)), ms),
      ),
    ]);
  } catch (cause) {
    bootErrors.push({ moduleName: m.name, cause });
    if (m.bootContract === 'identity' && store.get('/auth/status') === undefined) {
      store.set('/auth/status', 'anon');
      store.set('/auth/user', null);
    }
    console.error(`[rntme] module boot failed: ${m.name}`, cause);
  }
}

const root = createRoot(opts.target);
store.set('/runtime/bootErrors', bootErrors);
```

### 6.2 Identity contract

- `module.json#client.contract: "identity"` (optional, whitelisted to `["identity"]` in `@rntme/blueprint`).
- `@rntme/blueprint` exposes the manifest field on the runtime `ModuleClientDescriptor` as `bootContract`. The code in §6.1 reads `m.bootContract`; the manifest field is `client.contract`. One translation, in blueprint compose.
- Identity modules **must** set `/auth/status` themselves on success/failure. The runtime fallback (`'anon'`) only fires when the module crashed before reaching either branch.
- The fallback **does not** overwrite an already-set `/auth/status`. A module that authed successfully and crashed in `registerOperation` keeps `'authed'` — no surprise logout.

### 6.3 Manifest changes

`modules/identity/auth0/module.json`: add `"contract": "identity"` to `client`. Same for any other identity-vendor modules in the repo (workos, clerk).

A module-conformance test enforces: every module with `category: "identity"` declares `client.contract: "identity"`.

## 7. /api/notes 500 (A)

### 7.1 Failure-mode tree

(Hypothesis labels H1-H4 are local to this section; they don't refer to PR-level letters A/B/C/D used elsewhere.)

```
GET /api/notes (Bearer valid)  →  500 INTERNAL_ERROR
├── H1) listNotes query SQL execution failed: missing table   ← primary hypothesis
│   PDM declares Note aggregate, runtime in ephemeral mode
│   skips CREATE TABLE on boot.
│   Log signature: "no such table: notes" / SQLITE_ERROR
│
├── H2) listNotes DSN / connection error
│   Log signature: "database is locked" / "connection refused"
│
├── H3) IntrospectSession pre-block failure mistranslated
│   Bindings runtime maps non-zero gRPC status to INTERNAL_ERROR
│   instead of UNAUTHENTICATED.
│   Log signature: "module-rpc identity-auth0 IntrospectSession"
│
└── H4) bindings-http transport bug
    Crash in gRPC↔HTTP bridge serializing Session.
    Log signature: stack trace in bindings-http
```

### 7.2 Diagnostic step in PR4

1. Land PR1+PR2+PR3. Working deploy is now reachable.
2. Reproduce: create a one-off Auth0 user via Mgmt API; Playwright login; cURL `/api/notes` with the resulting Bearer.
3. Read logs via `docker service logs <service-id> --tail 500 --since 10m` on the Dokploy host. (`mcp__dokploy__application-readLogs` is unreliable — confirmed by this brainstorm. Runbook lives in `apps/platform-http/README.md` PR3 doc-touch.)
4. Identify branch by log signature. Patch at root.
5. Tear down test user via `DELETE /api/v2/users/{id}`.

### 7.3 If H1 is confirmed

- Locate boot orchestrator in `packages/runtime/runtime/`.
- Add the missing `if (mode === 'ephemeral') { applyPdmSchema(db, pdm) }` branch (or the equivalent given current code shape).
- Test: PDM with one aggregate → boot ephemeral → `SELECT * FROM <agg>` returns `[]`.

### 7.4 Constraint on this section

This section is intentionally **not** a fix specification. It commits to a methodology and a primary hypothesis. The actual code change is discovered during PR4 plan execution.

## 8. Vendoring sync (C)

### 8.1 Re-vendor

Copy `modules/identity/auth0/{module.json, package.json, dist/**}` into `demo/notes-blueprint/node_modules/rntme_identity_auth0/`. Commit. The `dist/provisioner.entry.js` esbuild bundle is required for the CLI to bundle the provisioner asset.

### 8.2 `pnpm vendor:check` and `pnpm vendor:sync`

Workspace script (or `apps/cli/src/bin/vendor-*.ts`):

- **`vendor:check`**: walks `demo/<bp>/node_modules/<pkg>/`. For each, finds source-of-truth pkg in `modules/<cat>/<vendor>/` by `package.json#name`. Diffs files (excluding `node_modules/`, `*.tsbuildinfo`, normalized EOL). Exits 1 with message `vendored copy of X is out-of-sync with modules/Y; run \`pnpm vendor:sync\`` on any drift.
- **`vendor:sync`**: copies source-of-truth → vendored copy. Idempotent.

CI lint workflow runs `pnpm vendor:check`. PRs that edit `modules/identity/auth0/` without re-vendoring fail.

### 8.3 AGENTS.md §6 entry

> **Vendoring an updated module into a demo blueprint.** (1) Edit `modules/<cat>/<vendor>/`. (2) `pnpm -F <pkg> build`. (3) `pnpm vendor:sync`. (4) Commit both source and vendored copy.

## 9. Testing

### 9.1 PR1 (vendoring)

- `pnpm vendor:check` on clean repo: green.
- Intentional drift in vendored `module.json`: red, exit 1, message points at the file.
- `pnpm vendor:sync` restores. Subsequent `vendor:check` is green.

### 9.2 PR2 (boot fragility)

`packages/runtime/ui-runtime/test/unit/entry.boot.test.tsx` (new) cases:

- Module's `boot()` throws → `mountUiRuntime` still calls `createRoot` and `root.render` runs.
- Identity-contract module fails before setting `/auth/status` → runtime sets `'anon'` on its behalf.
- Identity-contract module fails after setting `/auth/status: 'authed'` → status stays `'authed'`; `bootErrors` still records.
- Non-identity module fails → `/auth/status` not touched.
- Boot timeout on one module → other modules continue to boot.

Module-conformance test: any module with `category: "identity"` has `client.contract: "identity"`.

### 9.3 PR3 (pipeline reorder)

- `packages/deploy/deploy-core/test/unit/vars.test.ts` (new): happy path for `target.*`, `env.*`, `provision.*`; one negative case per error code from §5.5.
- `packages/deploy/deploy-core/test/unit/plan-phases.test.ts`: phase1 alone produces a partial plan; phase1 + (no-provision) + phase2 is byte-equivalent to old `buildProjectDeploymentPlan` for a target without `provision.*` vars (regression).
- `apps/platform-http/test/unit/deploy/executor.test.ts`: new sequence asserted; provisioner failure halts before render.
- E2E gated (`RNTME_AUTH0_E2E=1`) extends the existing bundle-transport e2e: deploy on a fresh Auth0 tenant target with `target.auth.auth0.clientId` absent. Asserts `provisionResult.modules.identity.publicOutputs.spaClient.id` populated AND the materialized bundle's `config.json` contains the same value.

### 9.4 PR4 (notes 500)

- Unit test at the localized fix point (likely `packages/runtime/runtime/test/unit/persistence/ephemeral-bootstrap.test.ts` if H1 is confirmed).
- E2E gated (`RNTME_NOTES_DEMO_E2E=1`): full publish → deploy → login → `/api/notes` with Bearer returns 200 `[]`. Runs against an ephemeral Dokploy target.

## 10. Documentation touches

| PR | File | Why |
|---|---|---|
| PR1 | `AGENTS.md §6` | how-to: vendor sync workflow |
| PR2 | `packages/runtime/ui-runtime/README.md` | boot lifecycle + `bootContract` + `/runtime/bootErrors` slot |
| PR2 | `modules/identity/auth0/module.json` (and peers) | add `client.contract: "identity"` |
| PR3 | `packages/deploy/deploy-core/README.md` | new var source `provision.*`; two-phase plan API |
| PR3 | `apps/platform-http/README.md` | new executor stage order; `application-readLogs` MCP unreliability + SSH fallback runbook |
| PR3 | `AGENTS.md §6` | how-to: declare a `provision.*` var |
| PR3 | `docs/history/specs/historical/2026-05-03-provisioner-bundle-transport-design.md` | mark §15 "vars-vs-provisioner" follow-up as resolved by this spec |
| PR4 | `packages/runtime/runtime/README.md` (if H1) | ephemeral persistence lifecycle |
| PR4 | `demo/notes-blueprint/README.md` | "User test after deploy" updated for fresh-tenant flow |

`README.md` package table / dep graph / `vision.md` / `CLAUDE.md` "Architecture in one paragraph" / `docs/architecture.md` — **not changed** (recorded decision: this spec adjusts pipeline ordering and runtime boot lifecycle; package boundaries, layering, and product positioning are untouched).

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase split in `plan.ts` breaks deploys without `provision.*` vars | medium | critical (deploys halt) | Phase1 + identity-provision-noop + phase2 byte-equivalent to old path; regression test in §9.3 enforces |
| Identity module forgets `contract: "identity"` | medium | LoginScreen never renders on boot fail | Module-conformance test in PR2 |
| `application-readLogs` MCP unreliable → can't diagnose A | medium | blocks PR4 | SSH + `docker service logs` fallback documented in PR3 README |
| Real /api/notes 500 root cause is H2/H3/H4, not H1 | low | scope expansion in PR4 | Spec keeps all branches open; PR4 plan is diagnose-then-fix, not committed-solution |
| `ENV_MAPPINGS` and `provision.*` vars look like duplication | low | cosmetic | Recorded distinction: env-mappings inject env into running containers; vars shape deploy-time artifacts (config.json). Different consumers, not duplication. |
| `vendor:check` flakes on Windows (EOL, file mode) | low | CI noise | Normalize EOL in diff; hash content without mode |
| Provisioner concurrent runs on parallel deploys race on Auth0 client name | low | duplicate or wrong-named clients | Provisioner already reconciles-by-name idempotently; race window only widens warning log, not state |

## 12. Why this shape

Three principles drive the decisions:

- **Architectural fix, not patch-around.** The manual `token_endpoint_auth_method` PATCH was a symptom of the vars-vs-provisioner ordering. We could have hard-coded the field in render or added a one-time post-provision PATCH in the executor; neither closes the gap on the next vendor (workos, clerk). Pipeline reorder closes it for every future provisioner.
- **Surgical layering.** PR1-PR4 each touch one slice. The architectural piece (D) lives alone in PR3 to keep its review surface focused. Operational diagnosis (A) is gated until PR3 is deployable, because we cannot read what we cannot run.
- **Identity contract is explicit.** The 2026-05-04 blank page was identity-specific (Auth0 boot threw, `/auth/status` never set, layout's `visible: { eq: 'anon' }` never matched). Naming the contract makes the failure mode legible and prevents the same trap for future identity vendors.

## 13. Out of scope (tracked separately)

- `findStaleRunning` extension to sweep stale `queued` deployments (memory `rntme_orphan_detect_queued_gap.md`).
- Styled error banner UI for `/runtime/bootErrors`.
- Sandbox / capability model for provisioner JS.
- Multi-tenant Auth0 (one resource server across projects).
- M2M client secret rotation.
- Workos/Clerk provisioner blocks (this spec only adds the identity-contract flag, not full provisioning).
