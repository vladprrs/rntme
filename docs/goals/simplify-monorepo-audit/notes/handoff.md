# Simplify Monorepo Audit — Tranche Handoff

**Date:** 2026-05-15
**Status:** complete
**Budget:** 155 / 900 worker-minutes spent (17%)
**Tranche completion rule:** complete when `worker_minutes_spent >= 900` OR all queue entries Q1..QN done. **Both arms partially satisfied (queue arm fully): 7/7 queued slices done.**

## What shipped (Q1..Q7)

| Slice | Finding | Effort | What landed | Verified |
|---|---|---|---|---|
| Q1 (T200) | F034 | 8m  | `findStaleRunning` in pg-deployment-repo + pg-project-operation-repo now reaps `queued OR running`; interfaces + tests updated. Memory `rntme_orphan_detect_queued_gap` retired. | typecheck / test / lint (in-scope) pass |
| Q2 (T201) | F033 | 22m | `pg/tx.ts` owns canonical `withOptionalTransaction` + `withSystemRlsDisabled`; 4 helper copies collapsed; 6 unit tests added. | typecheck / test / lint (in-scope) pass |
| Q3 (T202) | F022 | 8m  | `@rntme/contracts-marketing-site-v1` pinned to `zod ^3.24.2` matching `contracts-module-v1`; single resolved `zod@3.25.76`. | typecheck / test (47 pass) / lint (in-scope) pass |
| Q4 (T203) | F021 | 45m | `@rntme/contracts-common-v1/result` is canonical home for `Result/Ok/Err` + `ok`/`err`/`isOk`/`isErr` (readonly, array-arg). provisioner-v1, deploy-core, platform-core, bundle-publish are now thin re-export shims. 5 call sites in `publish-folder.ts` rewritten to array-arg `err`. | typecheck / test / lint / depcruise (828→0 violations) pass |
| Q5 (T204) | F006 | 22m | Canonical `parseScalarType/parseFieldType/parseInputType/parseOutputType` (+ `TypeParseError`) in `@rntme/bindings`; blueprint + runtime delete inline regex copies. Grammar reconciliations documented at parser site. | typecheck / test (495 pass across 3 pkgs) / depcruise pass |
| Q6 (T205) | F040 | 25m | `apps/platform/ui-module/module.json` augmented with 3 missing top-level props (`PlatformTopbar.crumbsFromRoute`, `PlatformAPIExplorer.graphHrefTemplate`, `PlatformAPIExplorer.pdmHrefTemplate`); drift-detection test added to `platform-ui.test.ts`. F040 audit "≥9 props" estimate was inflated by array-element shapes; actual drift was 3. | typecheck / test (153 pass) / lint pass |
| Q7 (T206) | F043 | 25m | `buildResolveProvisioner({ bundleAssetDir?, manifestPath?, errorCodePrefix? })` in `@rntme/deploy-runner`; CLI + platform start-deployment handler delegate. ~120 LoC dedup. Pre-existing CLI `NodeJS` lint error fixed inline. | typecheck / test (416 pass) / lint / depcruise (829/1147/0) pass |

## Net impact (concrete)

- **Worker-reported LoC removed:** ~360 (Q2 ~80, Q4 ~120 dupe Result modules, Q5 ~80 inline regex parsers, Q7 ~120 resolveBundledProvisioner)
- **Tests added:** `pg/tx.test.ts` (6), `parse-types.test.ts`, `resolve-provisioner.test.ts` (6), platform-ui drift detector (1), platform-storage `findStaleRunning` queued-row coverage
- **Memories retired:** `rntme_orphan_detect_queued_gap` (Q1), `rntme_provisioner_resolver_gap` (already stale per T005 — noted, not yet purged)
- **depcruise:** 828 → 829 modules, 0 violations throughout

## Final-audit verify (Judge re-run, T999)

| Command | Result | Notes |
|---|---|---|
| `bun run typecheck` | PASS (exit 0) | All 58 workspace packages |
| `bun run depcruise` | PASS | 829 modules / 1147 deps / 0 violations |
| `bun run lint` | exit 1 | **Pre-existing only:** `modules/storage/s3/test/unit/server.test.ts` Buffer no-undef (4 errors) — F056. CLI NodeJS no-undef (was pre-existing) is FIXED by Q7. |

## Budget reconciliation

| Slice | elapsed_minutes | running total | matches state.yaml? |
|---|---|---|---|
| Q1 | 8 | 8 | y |
| Q2 | 22 | 30 | y |
| Q3 | 8 | 38 | y |
| Q4 | 45 | 83 | y |
| Q5 | 22 | 105 | y |
| Q6 | 25 | 130 | y |
| Q7 | 25 | 155 | y |

`execution_budget.worker_minutes_spent` in state.yaml = **155**. Reconciled. Cap = 900. Headroom remaining = 745 min (12.4h) — explicitly *not* consumed; the tranche completes by the queue-exhaustion arm of the completion rule.

## Cross-slice integration — Result types

Q4 promoted `@rntme/contracts-common-v1/result` as canonical and converted four of the five duplicates (`contracts-provisioner-v1`, `deploy-core`, `platform-core`, `bundle-publish`). **`packages/artifacts/_shared/src/result.ts` was intentionally left untouched** (allowed_files boundary; `_shared/package.json` was not in scope and `_shared` is depended on by code that cannot reach `contracts-common-v1` without a layering review).

The two surviving shapes are **structurally compatible**:

- `contracts-common-v1`: `{ readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: readonly E[] }`; `isOk` uses `r.ok === true`.
- `_shared`: `{ ok: true; value: T } | { ok: false; errors: readonly E[] }`; `isOk` uses truthy `r.ok`.

TypeScript treats them as assignable in both directions for normal use. Q5 + Q7 deliberately used `@rntme/artifact-shared`'s Result because `@rntme/bindings` and `@rntme/deploy-runner` already depend on it. **No runtime divergence**, but two type aliases for the same algebra remain in the workspace until a future tranche unifies them (see F057 below).

## Regressions

**None.** All in-scope verify suites are green. The only red signal in `bun run lint` workspace-wide is the pre-existing `modules/storage/s3` Buffer no-undef, which was flagged in T200's receipt as out-of-scope and is now backlogged as F056.

## Newly-surfaced findings (next tranche candidates)

- **F055** — Wider workspace zod 4 vs 3 split. T202 closed `marketing-site/v1`, but `apps/cli`, `packages/runtime/bindings-http`, `packages/runtime/ui-runtime`, all `packages/artifacts/*`, `packages/deploy/deploy-core`, `packages/platform/platform-core` still pin `zod ^4`. Decide single major before next contract authoring slice.
- **F056** — `modules/storage/s3/test/unit/server.test.ts` references `Buffer` without an eslint `env: { node: true }` declaration. Pre-existing; surfaced repeatedly by T200/T201/T202 verify runs. Fix is one-line eslintrc override or `import { Buffer } from "node:buffer"`. P3, ~0.25h.
- **F057** — `@rntme/artifact-shared` keeps a second (structurally-compatible, mutable-fields) `Result<T,E>` shape after Q4. Unify with `@rntme/contracts-common-v1/result` once `_shared/package.json` is in scope (depcruise allows `artifact-shared → contracts-common-v1` as both are leaves). P2, ~1h.

These three findings have been appended to `notes/audit-catalog.md` § `4_backlog`.

## What did NOT ship (deferred backlog — already in catalog)

Carried over from T101's `deferred_to_backlog` block plus original `4_backlog` items:

- **F037** (4h) — compose-yaml / nginx structural rendering (Dokploy-touching, biggest singleton).
- **F031** (3h) — AES-GCM cipher dedup in deployments handlers (crypto-sensitive).
- **F030** (2h) — `DeployAdapter` dead-strut deletion.
- **F044, F046** (1h each) — CLI watcher dedup + publish error-fidelity preservation.
- **F052** (3h) — `vendor-check.mjs` schema validation. **Unblocked by Q6.**
- **Rank ≥ #11** — all deferred per the 13h slice cap.
- **Cosmetic / non-architectural** — F045, F047, F048, F017, F019, F025, F026, F028, F053 (module-scaffold half), F054 — see catalog `4_backlog`.

## Next-tranche recommendation

1. **First candidate:** F052 (vendor-check schema validation). Q6 made `module.json` the source of truth; F052 is the CI gate that makes Q6's drift detector enforceable at publish time. Small, well-shaped, ~3h.
2. **High-impact pair:** F037 (compose/nginx structural rendering, ~4h) + F031 (AES-GCM dedup, ~3h). Budget at least 8h for both with verify-suite room.
3. **Quick wins to clear backlog:** F056 (0.25h), F044+F046 (2h), F048 (cosmetic, batch with any platform-blueprint slice).
4. **Architectural Result unification:** F057 — needs depcruise review since the move touches `artifact-shared` whose dependents span runtime + artifacts. Promote only when an adjacent slice already opens `_shared/package.json`.
5. **Charter status:** original goal was "audit then execute until budget or queue exhausted"; the queue arm completed at 17% of budget. A second tranche of `simplify-monorepo-audit` is justified — resume from `2_ranking` rank #11 onward, keep the same 900-min cap.

## Audit verdict

- **complete:** true
- **full_outcome_complete:** true — the tranche-completion rule (`queue exhausted OR budget exhausted`) is satisfied by the queue arm; the deferred items are explicitly backlogged per the goal's `likely_misfire` discipline, not "unfinished work"; no regressions surfaced; verify suite is green for everything Workers touched and red only on documented pre-existing issues.
