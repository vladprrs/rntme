# T005 — Worker partial receipt: blocked on platform-blueprint cutover gaps

Author: Worker / pm-loop iteration 1
Date: 2026-05-11
Status: **stopped** before deploy. Awaiting operator direction.

## What did succeed

- `bun install --frozen-lockfile` (incremental) — ok.
- `bun run build` — all packages rebuild green, including
  `apps/cli/dist/platform-blueprint/` postbuild copy step.
- Resolver bug #1 fixed in
  `packages/artifacts/blueprint/src/compose/modules.ts`:
  `workspacePackagePathSegments` now maps `rntme_<category>_<vendor>` aliases
  (e.g. `rntme_identity_auth0`) onto `modules/<category>/<vendor>/`. Test
  added to `packages/artifacts/blueprint/test/unit/discover-modules.test.ts`.
  `bun run --filter @rntme/blueprint test` → 127 pass / 0 fail.
- Resolver bug #2 fixed in same file: `workspacePackageDir` now walks up
  through 8 ancestor directories instead of just 2-3, so it finds the
  workspace root from `apps/cli/dist/platform-blueprint/` (4 levels up).

## Where we got stuck

With the resolver fixes in place,
`rntme platform up --target ./platform.target.json --dry-run` advances
through blueprint module discovery and validation, but then dies in the
**compose stage** during `toDeployCoreInput`:

```
error: DEPLOY_EXECUTOR_SERVICE_GRAPHS_NOT_FOUND:app
      at buildRuntimeArtifactFiles
         (packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts:218)
```

Root cause: `apps/platform/blueprint/services/app/service.json` declares
`{ "kind": "domain" }`, but the service contains only `ui/` (layouts +
screens + manifest.json) with no `graphs/`, `qsm/`, or `bindings/`
artefacts. `buildRuntimeArtifactFiles` is invoked for every `kind: 'domain'`
service and unconditionally requires graphSpec/qsmValidated/bindings.

This is a real cutover gap — not a one-line fix. The platform blueprint
asks for `routes.ui = { "/": "app" }` (a pure UI mount), but the artifact
loader does not yet recognise "UI-only domain service" as a valid shape.

## Why this matters beyond the immediate failure

Even if we patched past this single point, the platform cutover trail
shows several more in-flight pieces that any real platform deploy will
trip over:

1. `apps/platform/blueprint/services/identity-auth0` is `kind:
   'integration-module'` — needs its provisioner entry bundled into
   `assets/provisioners/`. The CLI postbuild step
   (`copy-platform-blueprint.cjs`) copies JSON only; the .entry.js for
   `@rntme/identity-auth0` is not packaged for the deployed runtime.
2. `services/deployments/workflows/workflows.json` declares native handlers
   from `@rntme/deploy-runner` — the deploy-worker container image
   `ghcr.io/vladprrs/rntme-bpmn-worker:e2e-bpmn-4e3f55d-json-1` needs to be
   reachable from the Dokploy host (untested).
3. The first deploy needs Postgres migrations to land; whether the
   platform's own DB seeding happens automatically on first boot is
   unverified.
4. Operaton's own admin secret (`adminUserSecretRef`) is referenced from the
   target file but the target-secrets store is not populated for direct
   mode (platform-bootstrap has no `target_secrets` table yet).

Memory `rntme_provisioner_resolver_gap` already flags item 1 explicitly;
items 2-4 are downstream of the same cutover.

## What I did NOT do (deliberately)

- Did **not** run the actual `rntme platform up` (no `--dry-run`) against
  Dokploy. The dry-run path proves the failure pre-render, so wasting
  Dokploy state was unnecessary.
- Did **not** patch `to-deploy-core-input.ts` to silently skip graph/qsm
  checks for UI-only services. That is a real semantic change that should
  be brainstormed with the user, not bolted on at the deploy edge.
- Did **not** patch `service.json` to introduce a new `kind: 'ui'` value.
  Same reason — broader API decision than this slice owns.

## Files changed in this Worker (still on disk, NOT reverted)

| File | Change |
| --- | --- |
| `packages/artifacts/blueprint/src/compose/modules.ts` | Added `rntme_<cat>_<vendor>` alias mapping in `workspacePackagePathSegments`; widened `workspacePackageDir` ancestor walk to 8 levels. |
| `packages/artifacts/blueprint/test/unit/discover-modules.test.ts` | Added "resolves snake-case workspace aliases" test. |
| `apps/cli/dist/**` | Rebuilt after the resolver fix. |
| `docs/goals/dokploy-platform-e2e-deploy/notes/platform-up-dryrun.jsonl` | Captured dry-run hook log (empty/zero-entries since failure was pre-runner). |
| `docs/goals/dokploy-platform-e2e-deploy/notes/T005-partial-receipt-stop.md` | This receipt. |

The resolver patch is independently useful — once the broader cutover
gaps are addressed, this fix stays. We can also extract it as a separate
PR to close the `rntme_provisioner_resolver_gap` memory.

## Gates (in current dirty state)

```
bun run --filter @rntme/blueprint typecheck  → exit 0
bun run --filter @rntme/blueprint test        → 127 pass / 0 fail
bun run --filter @rntme/cli typecheck         → exit 0
bun run --filter @rntme/cli test              → 180 pass / 2 skip / 0 fail
bun run depcruise                             → no violations
```

## Decision required from operator (3 options)

1. **Sustained cutover slice.** Authorise a sequence of Worker tasks to
   close items 1-4 above plus the UI-only-service classification (likely
   2-4 more sessions of work). This is the canonical path and aligns with
   the 2026-05-10 spec.
2. **Narrow the goal to a non-platform blueprint.** Re-target the goal at
   `demo/notes-blueprint` or `demo/order-fulfillment-blueprint` (which are
   known to deploy via direct mode), prove e2e there, and treat the
   platform-bootstrap path as a separate goal once the cutover lands.
3. **Pause the goal.** Land the two completed pieces (resolver fix + CLI
   target extension + cleanup of old Dokploy artefacts) as PRs, then come
   back when the platform cutover is further along.

Need direction before proceeding.
