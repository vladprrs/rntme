# Simplify Monorepo Audit — Tranche 3 Handoff

**Date:** 2026-05-16
**Status:** complete
**Budget:** 120 / 665 Tranche-3 minutes spent (18%); cumulative 355 / 900 (39%)
**Tranche completion rule:** complete when `worker_minutes_spent >= 900` OR all queue entries Q15..Q17 done. **Queue arm fully satisfied: 3/3 queued slices done.**

## What shipped (Q15..Q17)

| Slice | Finding | Effort | What landed | Verified |
|---|---|---|---|---|
| Q15 (T214) | F058 | 5m | The known-slow CV demo deploy-bundle materialization test now has a scoped 15s timeout via Bun's typed third-argument overload. No production code changed. | isolated repro fixed; CLI typecheck / lint / test pass |
| Q16 (T215) | F037 | 45m | `@rntme/deploy-dokploy` Compose YAML now renders from a typed document object through `yaml@2.9.0`, with regression coverage for YAML-looking env literals (`true`, `123`, `{token}`). Nginx was inspected and intentionally left unchanged because the existing renderer is `EdgePlan`-driven with sanitizer and golden coverage. | deploy-dokploy tests, workspace gates, and live Dokploy smoke pass |
| Q17 (T216) | F055 | 70m | First-party workspace Zod pins now converge on `^4.0.0`. The remaining Zod 3 packages (`contracts-module-v1`, `contracts-marketing-site-v1`, `runtime`) were upgraded, module manifest record schemas were updated to Zod 4's two-argument `z.record(z.string(), valueSchema)` form, and owner docs record the invariant. | install / typecheck / lint / depcruise / test / build / vendor-check pass |

## Additional finding closed

- **F059** — Root `bun run test` could hang under Bun's default parallel filtered workspace runner: `@rntme/conformance-ai-llm` stranded as a high-CPU child for more than four minutes while the same package passed standalone in ~89ms. The root `test` script now runs the same filtered workspace tests sequentially, preserving the documented `bun run test` command while making the gate deterministic.

## Verification

| Command | Result | Notes |
|---|---|---|
| `bun install --frozen-lockfile` | PASS | lockfile current after `yaml@2.9.0` and Zod pin changes |
| `bun run typecheck` | PASS | all workspace package typechecks exited 0 |
| `bun run lint` | PASS | all workspace package lint scripts exited 0 |
| `bun run depcruise` | PASS | 827 modules / 1145 dependencies / 0 violations |
| `bun run test` | PASS | root script now uses `bun run --filter '*' --sequential test`; all package tests completed with exit 0 |
| `bun run build` | PASS | workspace build exited 0 |
| `bun run vendor:check` | PASS | `vendor:check ok — all vendored copies in sync` |
| `bun apps/cli/dist/bin/cli.js platform up --target platform.target.json --log-file .rntme-platform-redeploy-2026-05-16-T215.jsonl` | PASS | render digest `sha256:e8d7d7616eb9e3bf283decc9ad643af094dae3039752bf19ff09ed3ce2614a82`; built-in smoke checks for health/ui/config all 200 |

## Budget reconciliation

| Slice | elapsed_minutes | Tranche-3 running total | cumulative_total |
|---|---|---|---|
| Q15 | 5 | 5 | 240 |
| Q16 | 45 | 50 | 285 |
| Q17 | 70 | 120 | 355 |

`execution_budget.worker_minutes_spent` in state.yaml = **355**. Reconciled. Cap = 900. Headroom remaining = 545 minutes (~9.1h). Tranche 3 completes by the queue-exhaustion arm, not budget exhaustion.

## Residual notes

- Lockfile `zod@3.25.76` entries remain only as external transitive aliases from `astro`, `zod-to-json-schema`, and `zod-to-ts`; no first-party package manifest pins Zod 3.
- The Zod 4 record update follows the official Zod 4 migration guidance for `z.record(...)`: https://zod.dev/v4/changelog
- Nginx structural rewrite is not part of F037 closure unless a future finding identifies a concrete unsafe directive class. The current renderer already has sanitizer and byte-exact golden coverage.
- Some storage-s3 React tests emit act warnings during the workspace test run, but they are warnings only; `bun run test` exits 0.
- Unrelated platform UX and separate goal-directory worktree changes were present before this tranche's final audit and were left untouched.

## Audit verdict

- **complete:** true
- **full_outcome_complete:** true — Tranche 3's queue-completion rule is satisfied by Q15, Q16, and Q17 all done; workspace verification is green; newly surfaced F059 was fixed inside the tranche; remaining items are clean backlog notes rather than required work.

PM action after this audit: `goal.status = complete`.
