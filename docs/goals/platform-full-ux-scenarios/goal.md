# Platform Full UX Scenarios

## Objective

Turn the current `apps/platform` MVP into a usable platform experience by
integrating the supplied UX scenarios and prepared UI/component materials into
`apps/platform/ui-module` and `apps/platform`, then prove the result against the
live platform surface the operator will check.

## Original Request

Goal: transform MVP `apps/platform` into a full platform with user scenarios.
The scenarios are in `.tmp/rntme-ux-design.agent.final.md`, and prepared
elements/components are in `.tmp/rntme platform`; integrate them into
`apps/platform/ui-module` and `apps/platform`. The operator will verify by
visiting `platform.rntme.com` and expects to see deployed projects and inspect
all artifacts on the platform. Local product testing is hard because Docker is
not available; use the verification style from
`docs/goals/cv-extract-platform-client-auth0-bootstrap-e2e`.

## Intake Summary

- Input shape: `existing_plan`
- Audience: platform users/operators, especially the operator validating
  `platform.rntme.com`.
- Authority: `requested`
- Proof type: `demo`
- Completion proof: `platform.rntme.com` serves the integrated platform UX, the
  live org/project experience exposes deployed projects and artifact views
  described by the UX scenarios, package-level verification passes, and the
  final receipt maps every required scenario to live or test evidence.
- Likely misfire: copying prepared visual components into the repo while the
  runtime platform still shows disconnected MVP screens, empty project data, or
  no inspectable artifacts.
- Blind spots considered: local Docker is unavailable; live deploy/redeploy may
  require credentials or non-destructive production access; supplied `.tmp`
  materials must be validated against current docs/code/tests; artifact
  visibility may require backend/data-path fixes, not only UI composition.
- Existing plan facts:
  - UX scenarios live at `.tmp/rntme-ux-design.agent.final.md`.
  - Prepared UI/component materials live under `.tmp/rntme platform`.
  - Primary integration targets are `apps/platform/ui-module` and
    `apps/platform`.
  - The operator's acceptance check is live: load `platform.rntme.com`, see
    deployed projects, and inspect all platform artifacts.
  - Verification should follow the prior GoalBuddy pattern from
    `docs/goals/cv-extract-platform-client-auth0-bootstrap-e2e`: package tests,
    typecheck/lint/build where relevant, live API/UI probes, bundle/deploy
    evidence when a live deploy is performed, and explicit operator/browser
    confirmation for final UX acceptance.

## Goal Kind

`existing_plan`

## Current Tranche

Continuous execution. First map the supplied UX/component artifacts to the
current platform architecture and verification constraints, then implement
successive safe slices until the live platform experience satisfies the full
operator outcome. Do not stop at discovery, a static mock, or one implemented
screen if deployed projects or artifact inspection remain incomplete.

## Non-Negotiable Constraints

- Follow `AGENTS.md`: read relevant README stubs and owner docs before source,
  verify current behavior in code/tests, and respect dependency-cruiser
  layering.
- Do not treat historical specs or old goals as current truth; use the previous
  cv-extract goal only as a verification-pattern reference.
- Do not require Docker as mandatory local proof. Prefer package-level tests,
  typecheck/lint/build, targeted browser/UI checks, live API probes, and
  operator confirmation.
- Keep implementation scoped to `apps/platform/ui-module` and `apps/platform`
  unless Scout/Judge evidence shows a required platform/runtime/package change.
- Do not print, commit, or persist secret material used for live platform checks
  or deployment.
- Do not mark the goal done unless the final audit maps the UX scenarios to
  working live/test evidence and confirms `platform.rntme.com` is ready for the
  operator acceptance check.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task
can be activated.

Do not stop after a single verified Worker slice when the broader owner outcome
still has safe local follow-up slices. After each slice audit, advance the board
to the next highest-leverage safe Worker task and continue.

Do not stop because a slice needs owner input, credentials, production access,
destructive operations, or policy decisions. Mark that exact slice blocked with
a receipt, create the smallest safe follow-up or workaround task, and continue
all local, non-destructive work that can still move the goal toward the full
outcome.

## Canonical Board

Machine truth lives at:

`docs/goals/platform-full-ux-scenarios/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status,
active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/platform-full-ux-scenarios/goal.md.
```

## PM Loop

On every `/goal` continuation:

1. Read this charter.
2. Read `state.yaml`.
3. Run the bundled GoalBuddy update checker when available and mention a newer
   version without blocking.
4. Re-check the intake: original request, input shape, authority, proof, blind
   spots, existing plan facts, and likely misfire.
5. Work only on the active board task.
6. Assign Scout, Judge, Worker, or PM according to the task.
7. Write a compact task receipt.
8. Update the board.
9. If Judge selected a safe Worker task with `allowed_files`, `verify`, and
   `stop_if`, activate it and continue unless blocked.
10. If a task is blocked, create the smallest safe workaround or
    evidence-gathering task that can continue without owner input.
11. Treat a slice audit as a checkpoint, not completion, unless it explicitly
    proves the full original outcome is complete.
12. Finish only with a Judge/PM audit receipt that maps receipts and
    verification back to the original user outcome and records
    `full_outcome_complete: true`.
