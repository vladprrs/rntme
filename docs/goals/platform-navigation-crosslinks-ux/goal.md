# Platform Navigation and Cross-Link UX Repair

## Objective

Bring `apps/platform` navigation, cross-links, and related user flows into a coherent working state aligned with `.tmp/rntme-ux-design.agent.final.md`, then verify locally, redeploy to production when commands and credentials are available, and prove the production experience works.

## Original Request

`$goalbuddy:goal-prep` prepare a goal to put navigation/cross-links/etc. in `apps/platform` in order; navigation generally does not work now. UI/UX logic is described in `.tmp/rntme-ux-design.agent.final.md`.

## Intake Summary

- Input shape: `specific`
- Audience: platform users and operators
- Authority: `approved`
- Proof type: `demo`
- Completion proof: local verification and browser smoke pass, production redeploy is executed when commands and credentials are available, and production smoke confirms the key navigation/cross-link flows work against the deployed app.
- Likely misfire: fixing only obvious broken hrefs or route errors while missing the intended UX flow model, related shared UI/runtime dependencies, documentation touch requirements, or the required redeploy and production check.
- Blind spots considered: the UX document may not map one-to-one to current code; navigation may be partly owned by shared UI/runtime packages; production deploy commands, credentials, or URLs may be missing; a route can pass unit tests while still failing as a user flow in the browser.
- Existing plan facts: use `.tmp/rntme-ux-design.agent.final.md` as the UX authority; scope is `apps/platform` plus shared UI/runtime packages only when evidence shows they affect navigation; no visual board; create a fresh goal; production redeploy may run automatically if commands and credentials are available.

## Goal Kind

`open_ended`

## Current Tranche

Audit the expected navigation model and current implementation, choose the largest safe useful repair slice, implement successive verified packages until the platform navigation and cross-links match the UX intent, then redeploy and smoke test production. Do not stop at discovery, a route inventory, or one repaired link if the broader navigation outcome still has safe local work.

## Non-Negotiable Constraints

- Follow `AGENTS.md`: read relevant README stubs and current owner docs before package source work, and verify current behavior in code and tests.
- Treat `.tmp/rntme-ux-design.agent.final.md` as the required UX/design input, but verify all current behavior in code and tests.
- Keep scope to `apps/platform` and shared UI/runtime packages only when Scout/Judge evidence shows they are required for the navigation outcome.
- Do not bypass validation layers, package boundaries, or dependency-cruiser layering.
- Include a documentation-touch evaluation in each implementation plan. "No docs need updating" is valid only with a reason.
- Execute production redeploy automatically only if the commands, environment, credentials, and production URL/check path are available and unambiguous. Otherwise block the exact deploy/prod-check task with a receipt and continue all safe local work.
- Final completion requires production smoke evidence or a blocked deploy/prod-check receipt that clearly identifies the missing requirement; do not claim full completion without production evidence unless the user explicitly waives it.

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

`docs/goals/platform-navigation-crosslinks-ux/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/platform-navigation-crosslinks-ux/goal.md.
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
