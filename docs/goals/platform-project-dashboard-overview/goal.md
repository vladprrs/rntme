# Platform Project Dashboard Overview

## Objective

Fully implement the `apps/platform` project dashboard overview described by `.tmp/rntme-ux-design.agent.final.md`, including the UI plus any required platform handlers, PDM/QSM/data flow, tests, deploy flow fixes, release Dokploy redeploy, and browser verification.

## Original Request

`$goalbuddy:goal-prep Привести dashboard apps/platform в .tmp/rntme platform/project-dashboard-overview помимо UI доработай нужные ручки, PDM/QSM и тд. для того чтобы реализовать полноценно .tmp/rntme-ux-design.agent.final.md`

User follow-up decisions:

- Visual board: none.
- Primary result: end-to-end dashboard, not UI-only.
- Completion proof: targeted tests/typecheck plus browser verification through release Dokploy.
- Verification reference: inspect how `docs/goals/platform-full-ux-scenarios` handled release/browser checks.
- Scope: dashboard vertical slice plus deploy/release flow changes if required.
- Do not forget redeploy.
- Create a fresh goal and use `docs/goals/platform-full-ux-scenarios` as reference input.

## Intake Summary

- Input shape: `specific`
- Audience: users/operators of the platform project dashboard
- Authority: `requested`
- Proof type: `demo`
- Completion proof: dashboard behavior is implemented end-to-end, targeted verification passes, and the dashboard is browser-checked after a release Dokploy redeploy using the repo's established verification pattern from `docs/goals/platform-full-ux-scenarios`.
- Likely misfire: GoalBuddy could stop after a visually matching dashboard while backend handlers, PDM/QSM projections, real data flows, deploy/release behavior, or Dokploy browser verification remain incomplete.
- Blind spots considered: release credentials/environment may be unavailable; historical goal docs are verification reference, not current truth; deploy-flow changes may be needed; docs-touch evaluation is required; implementation must follow AGENTS.md read order and owner docs.
- Existing plan facts: the implementation target is `.tmp/rntme-ux-design.agent.final.md` and the referenced `.tmp/rntme platform/project-dashboard-overview`; verification must consult `docs/goals/platform-full-ux-scenarios`; completion includes redeploy.

## Goal Kind

`specific`

## Current Tranche

Discover the design and platform requirements, validate the necessary owner docs and current code paths, then complete successive safe vertical implementation slices until the project dashboard overview works end-to-end. The tranche is not complete after planning, UI-only work, or local tests alone. It ends only after final audit maps code changes, targeted tests/typecheck, deploy/release work, Dokploy redeploy, and browser evidence back to the original dashboard outcome.

## Non-Negotiable Constraints

- Follow `AGENTS.md`: read `docs/decision-system.md` for strategic/architectural/convention decisions, then local package README stubs and linked owner docs before opening source in those packages.
- Treat `docs/goals/platform-full-ux-scenarios` as a verification-method reference to inspect during Scout work, not as current-state truth.
- Verify current behavior in code and tests before changing implementation.
- Do not deliver UI-only work when API handlers, PDM/QSM projections, contracts, runtime integration, tests, or deploy flow changes are needed for a real dashboard.
- Include redeploy and release Dokploy browser verification in completion proof. If credentials/environment are unavailable, block only that specific task with a receipt and continue safe local work; do not mark the full goal done without owner-approved substitute proof.
- Keep edits scoped to the dashboard vertical slice and required supporting platform/deploy layers.
- Include a documentation-touch evaluation in the implementation plan and update current docs only when public API, invariants, gotchas, navigation, or user-facing project surface changes.
- Preserve unrelated user changes in the worktree.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if the user asked for working software or automation and a safe Worker task can be activated.

Do not stop after a single verified Worker package when the broader owner outcome still has safe local follow-up work. Advance the board to the next highest-leverage safe Worker package and continue unless a phase, risk, rejected-verification, ambiguity, or final-completion review is due.

Do not create one Worker/Judge pair per repeated file, table, route, or helper. Put repeated same-shape work into one Worker package and review the package as a whole.

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

`docs/goals/platform-project-dashboard-overview/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/platform-project-dashboard-overview/goal.md.
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
