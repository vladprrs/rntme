# Platform Data Model Explorer

## Objective

Bring the data-model explorer in `apps/platform` to the UX represented by `.tmp/rntme platform/data-model-explorer`, fully implementing the required UI, platform routes/API handlers, PDM/QSM data plumbing, tests, and documentation touches needed to satisfy `.tmp/rntme-ux-design.agent.final.md`.

## Original Request

`$goalbuddy:goal-prep Привести просмотр моделей данных в apps/platform к виду .tmp/rntme platform/data-model-explorer помимо UI доработай нужные ручки, PDM/QSM и тд. для того чтобы реализовать полноценно .tmp/rntme-ux-design.agent.final.md`

## Intake Summary

- Input shape: `existing_plan`
- Audience: platform users/operators who need to inspect project data models through the platform UI.
- Authority: `requested`
- Proof type: `demo`
- Completion proof: The platform data-model explorer renders the required UX from `.tmp/rntme platform/data-model-explorer` and `.tmp/rntme-ux-design.agent.final.md`, backed by real platform API/data-model flows rather than static fixtures; relevant package tests/typechecks/lint or focused verification pass; and the final audit maps UI, routes/handlers, PDM, QSM, and documentation-touch evidence back to the original request.
- Likely misfire: GoalBuddy could integrate a static or mostly visual explorer screen while leaving platform routes, handlers, PDM/QSM projections, real artifact data, or verification incomplete.
- Blind spots considered: `.tmp` materials may be stale relative to current owner docs/code; the correct data source for model explorer content may require PDM/QSM or artifact-storage decisions; API shape and error behavior must match existing platform conventions; verification may need focused package tests if full local runtime dependencies are unavailable; docs may need updates where public API, invariants, gotchas, or navigation change.
- Existing plan facts:
  - Target app: `apps/platform`.
  - UX target: `.tmp/rntme platform/data-model-explorer`.
  - Design/rationale input: `.tmp/rntme-ux-design.agent.final.md`.
  - Scope explicitly includes more than UI: required routes/handlers, PDM, QSM, and related data plumbing must be completed.
  - Repo workflow requires research -> plan -> implement for non-trivial work and a documentation-touch evaluation.

## Goal Kind

`existing_plan`

## Current Tranche

Continuous execution: discover the current platform, PDM, QSM, and UX evidence; choose the largest safe vertical implementation slice; implement and verify successive slices until the data-model explorer is genuinely working end to end; review at risk, ambiguity, rejected-verification, and final-completion boundaries.

## Non-Negotiable Constraints

- Follow `AGENTS.md`: read `docs/decision-system.md` for strategic, architectural, or convention decisions.
- Before opening package source, read the relevant local README stub and follow its current owner doc.
- Treat specs, historical plans, and `.tmp` artifacts as rationale or input, not automatic current-state truth; verify against current code, tests, owner docs, and dependency rules.
- Do not implement a UI-only facade if routes, handlers, PDM/QSM, or artifact data are required for the requested experience.
- Respect dependency-cruiser layering rules, especially modules/contracts/runtime/artifacts/platform boundaries.
- Do not bypass validated brands with casts, skip validation layers, throw across validation/compile package boundaries, reorder existing error codes, introduce unsupported authoring formats, or let vendor SDK types leak across canonical boundaries.
- Evaluate docs touches for owner docs, README stubs, guides, `docs/decision-system.md`, `AGENTS.md`, root docs, and related surfaces; record "no docs need updating" only with a reason.
- Keep secrets, credentials, production access, and destructive operations out of scope unless the operator explicitly approves them.
- Keep edits scoped to the package/doc surfaces required for the data-model explorer outcome.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if the user asked for working software or automation and a safe Worker task can be activated.

Do not stop after a single verified Worker package when the broader owner outcome still has safe local follow-up work. Advance the board to the next highest-leverage safe Worker package and continue unless a phase, risk, rejected-verification, ambiguity, or final-completion review is due.

Do not create one Worker/Judge pair per repeated file, table, route, or helper. Put repeated same-shape work into one Worker package and review the package as a whole.

## Slice Sizing

Safe means bounded, explicit, verified, and reversible. It does not mean tiny.

A good task is the largest safe useful slice.

Small is not the goal. Useful is the goal.

A Worker should finish the whole assigned slice. A Judge should judge the whole assigned slice. A PM should reorient the board when tasks are safe but not moving the outcome.

Tiny tasks are allowed when the failure is isolated, the risk is high, the scope is unknown, or the tiny task unlocks a larger slice. Tiny tasks are bad when they keep happening, do not change behavior, only add wrappers/contracts/proof files, or avoid the real milestone.

Do not stop because a slice needs owner input, credentials, production access, destructive operations, or policy decisions. Mark that exact slice blocked with a receipt, create the smallest safe follow-up or workaround task, and continue all local, non-destructive work that can still move the goal toward the full outcome.

## Canonical Board

Machine truth lives at:

`docs/goals/platform-data-model-explorer/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/platform-data-model-explorer/goal.md.
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
9. If safe local work remains, choose the next largest reversible Worker package and continue unless blocked.
10. If a problem, suggestion, or follow-up should become a repo artifact, create an approved issue/PR or ask the operator whether to create one.
11. Review at phase, risk, rejected-verification, ambiguity, or final-completion boundaries; do not review every small Worker by habit.
12. Finish only with a Judge/PM audit receipt that maps receipts and verification back to the original user outcome and records `full_outcome_complete: true`.

Issue and PR handoffs are supporting artifacts. `state.yaml` remains authoritative, and every external artifact decision must be recorded in a task receipt.
