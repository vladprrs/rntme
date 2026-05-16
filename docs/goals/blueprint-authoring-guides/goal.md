# Blueprint Authoring Guides

## Objective

Implement the guide-set design in `docs/superpowers/specs/2026-05-16-blueprint-authoring-guides-design.md` so `docs/current/guides` becomes a practical authoring playbook for external coding agents building working rntme blueprints.

## Original Request

`$goalbuddy:goal-prep подготовь цель по реализации docs/superpowers/specs/2026-05-16-blueprint-authoring-guides-design.md`

## Intake Summary

- Input shape: `existing_plan`
- Audience: external coding agents that need to author valid rntme blueprints for product tasks.
- Authority: `approved`
- Proof type: `artifact`
- Completion proof: `docs/current/guides` contains the approved guide set, current examples and warnings match repo reality, local documentation checks pass, and a final audit confirms the design spec is implemented without native-handler, deploy, or module-authoring drift.
- Likely misfire: the run could update only the old bindings/Graph IR references, or produce a large package-reference dump, instead of a task-oriented blueprint authoring playbook.
- Blind spots considered: stale current guides, removed QSM `relationRoles`, operation-era Graph IR, binding `exposure`, native handlers as an internal escape hatch, module-authoring/deploy scope creep, and examples that do not correspond to current demo files.
- Existing plan facts: preserve the design spec at `docs/superpowers/specs/2026-05-16-blueprint-authoring-guides-design.md`; use the compact guide-set approach; modules are mention-only; deploy is out of scope; native handlers, `operations.json`, `handlers/*.ts`, binding `target.engine: "native"`, and workflow `nativeTasks` are forbidden as third-party authoring paths.

## Goal Kind

`existing_plan`

## Current Tranche

Complete the approved guide-set implementation in the current repository. The first `/goal` run should validate the committed design against current guide/demo/owner-doc evidence, then execute the largest safe documentation slices until the full guide set is implemented and audited.

## Non-Negotiable Constraints

- Keep implementation scoped to `docs/current/guides/**` unless a Scout/Judge receipt proves a small owner-doc correction is necessary.
- Do not edit deploy documentation or add deploy authoring guidance.
- Do not teach module authoring. Modules may be mentioned only as existing external capability surfaces.
- Do not recommend native handlers for third-party blueprints.
- Do not add examples that use `operations.json`, `handlers/*.ts`, binding `target.engine: "native"`, or workflow `nativeTasks` as authoring paths.
- Do not describe removed QSM `relationRoles` as current.
- Do not rewrite package owner docs into guides; guides are authoring playbooks and should link to owner docs for package internals.
- Use current demo blueprints and current owner docs as evidence before claiming a pattern is supported.
- Preserve unrelated dirty worktree changes.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if safe documentation Worker work can proceed.

Do not stop after a single verified Worker package when required guide surfaces remain incomplete. Advance the board to the next safe Worker package unless a phase, risk, rejected-verification, ambiguity, or final-completion review is due.

Do not create one Worker/Judge pair per guide file by habit. Put repeated same-shape documentation edits into coherent Worker packages and review the package as a whole.

## Slice Sizing

Safe means bounded, explicit, verified, and reversible. It does not mean tiny.

A good task is the largest safe useful slice.

For this goal, useful slices are coherent guide families: entrypoint/foundation, domain data authoring, Graph IR/bindings, UI/workflows/seed/examples, and final cross-guide audit.

## Canonical Board

Machine truth lives at:

`docs/goals/blueprint-authoring-guides/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/blueprint-authoring-guides/goal.md.
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
9. If safe local guide work remains, choose the next largest reversible Worker package and continue unless blocked.
10. Review at phase, risk, rejected-verification, ambiguity, or final-completion boundaries; do not review every small documentation edit by habit.
11. Finish only with a Judge/PM audit receipt that maps receipts and verification back to the design spec and records `full_outcome_complete: true`.
