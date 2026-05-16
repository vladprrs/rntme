# Simplify Monorepo Audit

Slug: `simplify-monorepo-audit`
Created: 2026-05-15
Input shape: `open_ended` (audit-then-execute)

## Original request

"я хочу чтобы мы подготовили цель используя skill `simplify` пройтись по всему проекту (пакет за пакетом) и найти архитектурные проблемы, не оптимальные решения, множественные реализации и провести работу над ними"

Plus: "в рамках этой задачи я разрешаю использовать не безопасные действия и используй `.env` для тестирования редеплоя на dokploy".

## Interpreted outcome

Provide a single ranked catalog of architectural problems, duplicate implementations, and suboptimal solutions across the rntme monorepo (package by package), then execute the highest-impact fixes using the `simplify` skill until the execution time budget expires.

## Intake summary

- **Input shape:** `open_ended` (audit catalog must come before execution; user accepted two-phase plan).
- **Audience:** project owner; pre-revenue, no external users (see `project_pre_stable_stage`).
- **Authority:** `approved`. User explicitly grants:
  - Worker tasks may take **destructive / unsafe actions** when the task is scoped to it and verification covers it.
  - Worker tasks may **use `.env`** at repo root to run Dokploy redeploy as a verification channel (production app `platform.rntme.com`, landing `rntme.com`) — *unsafe ops authorized for this goal only*.
- **Proof type:** `artifact` (audit catalog) + `verify` (each Worker slice: typecheck + tests + lint + depcruise +, when relevant, Dokploy redeploy smoke).
- **Completion proof:** Final Judge audit declares the tranche complete when **either** (a) the time budget below is exhausted, **or** (b) all top-N ranked slices are completed and verified.
- **Likely misfire:** Refactor everything everywhere (rename/move sprees), or chase cosmetic simplifications while skipping the architectural duplications and dead-strut patterns that are the actual win.
- **Existing plan facts:** "package by package" → translated to Phase A waves grouped by `packages/` subtree + `apps/` + non-vendored demo sources.

## Constraints

1. **Two-phase, fixed scope.** Phase A = global Scout audit. Phase B = Judge prioritization. Phase C = Worker execution. Phase D = final audit.
2. **Execution time budget = 15 hours** wall-clock from the moment T101 Judge ranking publishes the ordered Worker queue. T101's receipt MUST record `execution_budget_started_at: <ISO 8601>`. Every Worker receipt MUST record `elapsed_minutes` and the running cumulative `worker_minutes_spent`. Once `worker_minutes_spent >= 900`, no new Worker tasks start; PM activates T999 audit immediately.
3. **High-impact first.** Judge ranks by `impact * confidence / risk`. Ties broken by reversibility (more reversible = earlier). Cosmetic-only items deferred to backlog.
4. **`simplify` skill is the Worker default.** Every Worker task references the `simplify` skill in its objective and must follow it: review changed code for reuse, quality, efficiency; fix issues; preserve functionality.
5. **Non-goals (off-limits):**
   - `demo/notes-blueprint/node_modules/rntme_*` and any other vendored `node_modules/rntme_*` snapshots — these are publishable snapshots, not sources.
6. **In-scope but careful (no implicit ban — Judge may still pick these, but with explicit risk note):**
   - Deployed surfaces (`apps/platform`, `apps/landing`, Dockerfiles, runtime config).
   - Public manifests of `apps/platform/blueprint/services/*/ui/**` and vendor modules in `apps/platform/blueprint/services/*/modules` (rename = blueprint break).
   - `AGENTS.md`, `docs/decision-system.md`, ADR files — Scout may read; Worker may edit only if an ADR-touching slice is explicitly justified in the Judge receipt.
7. **Unsafe ops allowed for this goal:** force-push to feature branches, dependency removal, package deletion, env-driven Dokploy redeploys via the repo `.env`. Still: never push `--force` to `main`; never commit `.env`; never paste secrets into receipts.
8. **Verify per slice (default suite):**
   - `bun run typecheck` (scoped where possible)
   - `bun run --filter @rntme/<pkg> test` (or full `bun run test` if cross-package)
   - `bun run lint`
   - `bun run depcruise`
   - When the slice touches deploy-affecting code: a Dokploy redeploy smoke against the staging or live app, using `.env`.
9. **Backlog discipline.** Anything not selected for execution stays in `notes/audit-catalog.md` with stable IDs so future tranches can resume without re-auditing.

## Goal shape (tranche)

> Audit every non-vendored package and app in the monorepo, produce a ranked catalog of architectural problems, duplicate implementations, and suboptimal patterns, then apply the `simplify` skill in priority order until 15 worker-hours are consumed or the top-N queue is empty — whichever comes first. Finish with a written audit and a clear backlog handoff.

## How to read the board

- `state.yaml` is truth. `goal.md` is intent and constraints.
- Phase A Scout tasks each cover one workspace wave and append to `notes/audit-catalog.md`.
- Phase B Judge tasks build the ranked queue inside the catalog and emit per-slice Worker briefs (objective, `allowed_files`, `verify`, `stop_if`).
- Phase C: PM activates Worker tasks one at a time from the queue.
- Phase D (T999): final Judge audit — checks budget, slice receipts, regressions, and produces handoff.

## /goal entry

```text
/goal Follow docs/goals/simplify-monorepo-audit/goal.md.
```
