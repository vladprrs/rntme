# Platform API Explorer

## Objective

Implement the next platform API Explorer capability from the user-provided `.tmp/rntme platform/api-explorer` input, after validating the input plan against current owner docs, source, and tests, then carry the work through verified implementation and final audit.

## Original Request

`$goalbuddy:goal-prep давай подготовим следующую цель на реализацию .tmp/rntme platform/api-explorer`

The operator selected no visual board for this goal.

## Intake Summary

- Input shape: `existing_plan`
- Audience: Platform users and operators inspecting a project's API/endpoints from the platform UI.
- Authority: `requested` for implementation planning and local work; production redeploy requires explicit task-level authority or a Judge-confirmed requirement from the input plan.
- Proof type: `demo`
- Completion proof: The `.tmp/rntme platform/api-explorer` input is located and validated; the API Explorer platform capability is implemented according to the validated plan and current platform conventions; focused tests/typecheck/lint/build pass; documentation-touch evaluation is recorded; and a final audit maps evidence back to this original request. If production exposure is confirmed in-scope, completion also requires a successful `platform up` redeploy and live `platform.rntme.com` proof.
- Likely misfire: Implementing a generic/static endpoint list or stopping at a plan instead of delivering the validated API Explorer behavior through the platform UI/API path.
- Blind spots considered: The exact `.tmp/...` path is ambiguous from the chat text; the plan has not been inspected during `$goal-prep`; "API Explorer" may mean endpoint catalog, endpoint detail, schema/body exploration, request testing, auth-aware examples, or a smaller first tranche; production deployment scope must be made explicit before live writes.
- Existing plan facts: User pointed to `.tmp/rntme platform/api-explorer` as the source for the next implementation goal; this prep turn must not inspect that input, so T001 must locate and validate it first.

## Goal Kind

`existing_plan`

## Current Tranche

Validate the provided API Explorer input plan, reconcile it with the current platform architecture and owner docs, choose the largest safe vertical implementation slice, implement successive verified slices, and continue until the validated API Explorer outcome is complete or a specific task is blocked with a durable receipt.

## Non-Negotiable Constraints

- Follow the repo's `AGENTS.md` read order before touching source: decision system for strategic choices, local README stubs, then owner docs.
- Treat `.tmp/rntme platform/api-explorer` as rationale/input until Scout and Judge validate it against current docs/code/tests.
- Keep edits scoped to the platform package/doc surfaces justified by the validated plan.
- Preserve unrelated dirty worktree changes.
- Evaluate docs touch surfaces for every implementation plan.
- Do not redeploy production unless the active task explicitly authorizes it and records the proof requirement.
- Do not stop after planning, Scout findings, or Judge selection if a safe Worker task can proceed.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if the user asked for working software and a safe Worker task can be activated.

Do not stop after a single verified Worker package when the broader validated API Explorer outcome still has safe local follow-up slices. Advance the board to the next highest-leverage safe Worker package and continue unless a phase, risk, rejected-verification, ambiguity, or final-completion review is due.

Do not create one Worker/Judge pair per repeated file, route, helper, or component. Put repeated same-shape work into one Worker package and review the package as a whole.

Do not stop because a slice needs owner input, credentials, production access, destructive operations, or policy decisions. Mark that exact slice blocked with a receipt, create the smallest safe follow-up or workaround task, and continue all local, non-destructive work that can still move the goal toward the full outcome.

## Slice Sizing

Safe means bounded, explicit, verified, and reversible. It does not mean tiny.

A good task is the largest safe useful slice.

Small is not the goal. Useful is the goal.

A Worker should finish the whole assigned slice. A Judge should judge the whole assigned slice. A PM should reorient the board when tasks are safe but not moving the outcome.

Tiny tasks are allowed when the failure is isolated, the risk is high, the scope is unknown, or the tiny task unlocks a larger slice. Tiny tasks are bad when they keep happening, do not change behavior, only add wrappers/contracts/proof files, or avoid the real milestone.

Do not stop because a slice needs owner input, credentials, production access, destructive operations, or policy decisions. Mark that exact slice blocked with a receipt, create the smallest safe follow-up or workaround task, and continue all local, non-destructive work that can still move the goal toward the full outcome.

## Canonical Board

Machine truth lives at:

`docs/goals/platform-api-explorer/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/platform-api-explorer/goal.md.
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
