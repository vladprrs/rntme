# Project Cleanup

## Objective

Clean up the repository by discovering and removing files that are genuinely unnecessary, deleting Superpowers plan files while preserving specs, and reorganizing docs where moving files improves the structure without losing useful rationale.

## Original Request

Prepare a goal to clean up the project, remove unnecessary files, delete Superpowers plans while keeping specs, and allow docs files to be moved during cleanup to improve structure.

## Intake Summary

- Input shape: `vague`
- Audience: repository maintainers and future coding agents
- Authority: `requested`
- Proof type: `test`
- Completion proof: a documented candidate inventory exists, only confirmed-unnecessary files were deleted or moved, specs were preserved, docs moves have updated references, and the CI-equivalent command set either passes or records exact blockers: `bun run build`, `bun run typecheck`, `bun run test`, `bun run lint`, `bun run depcruise`, and `bun run vendor:check`.
- Likely misfire: GoalBuddy could produce a large cleanup diff that deletes historical rationale, active docs, fixtures, metadata, or user work because files look stale without proving they are unnecessary.
- Blind spots considered: destructive deletes, docs link drift after moves, old specs as rationale rather than current truth, dirty worktree safety, generated artifacts that may still be intentionally committed, and broad cleanup scope hiding risky category decisions.
- Existing plan facts: use no visual board; create a fresh goal; perform broad repo cleanup; delete Superpowers plans; preserve specs; in `docs/**`, moving files is allowed when it improves structure; protect history/docs and generated-sensitive surfaces unless a Judge decision explicitly permits a change.

## Goal Kind

`open_ended`

## Current Tranche

Discover cleanup candidates across the repository, classify them into keep/delete/move/defer categories with file-path evidence, execute the largest safe verified cleanup batches, and keep advancing until the repository cleanup outcome is complete. This tranche includes documentation reorganization where safe, but it does not authorize deleting specs or protected historical rationale just because they are old.

## Non-Negotiable Constraints

- Do not delete specs. Preserve `docs/history/specs/**` and any other spec surface unless the user gives a separate explicit instruction.
- Delete Superpowers plan files only after Scout/Judge identify the exact plan surfaces and confirm they are plans rather than specs or current owner documentation.
- In `docs/**`, file moves are allowed when they improve structure, but references, README stubs, owner-doc pointers, and navigation must be updated in the same Worker slice.
- Treat `docs/history/specs/**`, ADR/audit/research/gaps material, lockfiles, package configs, snapshots/fixtures, generated-but-committed artifacts, and vendor metadata as protected surfaces. A cleanup batch may touch them only with explicit Judge rationale, exact allowed files, and strong verification.
- Do not revert or overwrite unrelated user changes. Check dirty worktree state before cleanup slices and work with any existing changes.
- Prefer evidence from current docs, code, tests, dependency rules, and references over assumptions from file names alone.
- Every deletion or move batch must be reversible through git diff and must include verification commands.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task can be activated.

Do not stop after a single verified Worker package when the broader cleanup still has safe local follow-up work. Advance the board to the next highest-leverage safe Worker package and continue unless a phase, risk, rejected-verification, ambiguity, or final-completion review is due.

Do not create one Worker/Judge pair per repeated file or folder when a coherent cleanup batch can be handled safely as one package.

## Slice Sizing

Safe means bounded, explicit, verified, and reversible. It does not mean tiny.

A good cleanup task removes or moves a coherent category of files with a clear reason, updates references where needed, and verifies the affected surfaces. A bad cleanup task deletes files by name pattern without proving ownership, references, or generation rules.

## Canonical Board

Machine truth lives at:

`docs/goals/project-cleanup/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/project-cleanup/goal.md.
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
9. If safe local cleanup remains, choose the next largest reversible Worker package and continue unless blocked.
10. Review at phase, risk, rejected-verification, ambiguity, or final-completion boundaries.
11. Finish only with a Judge/PM audit receipt that maps receipts and verification back to the original user outcome and records `full_outcome_complete: true`.
