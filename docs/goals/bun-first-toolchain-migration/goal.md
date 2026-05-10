# Bun-First Toolchain Migration

## Objective

Execute the existing Bun-first toolchain migration plan safely, task-by-task, until Bun is the canonical project manager, runner, test runner, bundler, runtime, Docker base, and SQLite driver for this repo, while retaining `tsc` only for typecheck and `.d.ts` emit.

## Original Request

`$goalbuddy yужно сделать goal из docs/superpowers/plans/2026-05-09-bun-first-toolchain-migration.md`

## Intake Summary

- Input shape: `existing_plan`
- Audience: repo maintainers and future coding agents working in this monorepo
- Authority: `requested`
- Proof type: `test`
- Completion proof: the migration plan is executed or explicitly adapted with receipts, all required repo gates pass under Bun, banned pnpm/Node/Vitest/esbuild/tsx/better-sqlite3 references are removed outside allowed historical docs, required Docker images build, and a final Judge or PM audit records `full_outcome_complete: true`.
- Likely misfire: treating the long implementation plan as complete after only creating the board, validating the plan, or landing the first migration slice.
- Blind spots considered: plan drift from current code, huge blast radius, lockfile/install churn, Bun API differences, SQLite BLOB and transaction compatibility, fake timer migration differences, Docker build availability, docs command drift, and dirty-worktree safety.
- Existing plan facts: source plan is `docs/superpowers/plans/2026-05-09-bun-first-toolchain-migration.md`; it defines a big-bang Bun migration, 21 implementation tasks, explicit out-of-scope items, verification gates, commit checkpoints, and a documentation-touch evaluation.

## Goal Kind

`existing_plan`

## Current Tranche

Validate and operationalize the existing plan, then continuously execute successive safe verified slices until the full migration is complete. The first active task is a read-only Judge review of the plan against current repo state and GoalBuddy execution constraints. After validation, the PM should activate or create bounded Worker tasks that preserve the plan's sequencing where still valid, adapt where code has drifted, and keep advancing after each verified slice until the final whole-repo audit passes.

## Non-Negotiable Constraints

- Preserve the existing plan as source rationale, but verify current behavior in current docs, code, tests, `.dependency-cruiser.cjs`, and package metadata before each slice.
- Follow `AGENTS.md`: read local README stubs and linked owner docs before source work in a package; do not treat historical or plan text as automatic current truth.
- Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` when implementing the source plan, as required by the plan itself.
- Use `superpowers:test-driven-development` for behavior-changing bugfixes or features, and `superpowers:systematic-debugging` for unexpected failures.
- Do not revert unrelated user changes in the dirty worktree.
- Keep edits scoped to the active Worker task's `allowed_files`.
- Do not bypass validated brands with casts, skip validation layers, throw across validation/compile package boundaries, or leak vendor SDK types across canonical contracts.
- Do not bulk-edit `docs/history/**`; `docs/superpowers/**` is source input and historical rationale, not a target surface unless the PM deliberately records a control-file reference.
- Documentation touch must be evaluated for every implementation slice; "no docs need updating" must be recorded with a reason.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if the user asked for working software or automation and a safe Worker task can be activated.

Do not stop after a single verified Worker slice when the broader owner outcome still has safe local follow-up slices. After each slice audit, advance the board to the next highest-leverage safe Worker task and continue.

Do not stop because a slice needs owner input, credentials, production access, destructive operations, or policy decisions. Mark that exact slice blocked with a receipt, create the smallest safe follow-up or workaround task, and continue all local, non-destructive work that can still move the goal toward the full outcome.

## Canonical Board

Machine truth lives at:

`docs/goals/bun-first-toolchain-migration/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/bun-first-toolchain-migration/goal.md.
```

## PM Loop

On every `/goal` continuation:

1. Read this charter.
2. Read `state.yaml`.
3. Run the bundled GoalBuddy update checker when available and mention a newer version without blocking.
4. Re-check the intake: original request, input shape, authority, proof, blind spots, existing plan facts, and likely misfire.
5. Work only on the active board task.
6. Assign Scout, Judge, Worker, or PM according to the task.
7. Write a compact task receipt.
8. Update the board.
9. If Judge selected a safe Worker task with `allowed_files`, `verify`, and `stop_if`, activate it and continue unless blocked.
10. If a problem, suggestion, or follow-up should become a repo artifact, create an approved issue/PR or ask the operator whether to create one.
11. Treat a slice audit as a checkpoint, not completion, unless it explicitly proves the full original outcome is complete.
12. Finish only with a Judge/PM audit receipt that maps receipts and verification back to the original user outcome and records `full_outcome_complete: true`.

Issue and PR handoffs are supporting artifacts. `state.yaml` remains authoritative, and every external artifact decision must be recorded in a task receipt.
