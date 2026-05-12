# Platform CLI Dokploy E2E

## Objective

Plan and execute a full e2e deployment test of `apps/platform` through `apps/cli` to Dokploy, using the approved CLI universal deploy/platform-http removal design as context, and keep advancing through discovered problems by solving them in sequence under `docs/decision-system.md`.

## Original Request

`$goalbuddy нужно запланировать полный e2e тест деплоя apps/platform через apps/cli (docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md) в dokploy (.env содержит DOKPLOY_URL и DOKPLOY_API_KEY) по пути будут находиться проблемы, задача - не блокироваться, а последовательно решать их в соответствии с docs/decision-system.md`

## Intake Summary

- Input shape: `specific`
- Audience: repository owner / platform deploy maintainer
- Authority: `requested`
- Proof type: `test`
- Completion proof: a documented command transcript or receipts proving `apps/platform` was deployed through `apps/cli` to the configured Dokploy target, smoke/health verification passed against the deployed platform, and any encountered blockers were fixed or explicitly recorded with remaining safe follow-up tasks.
- Likely misfire: stopping after writing a test plan, local build fixes, or a partial deploy attempt without proving the real CLI -> Dokploy -> deployed platform path works end to end.
- Blind spots considered: live Dokploy changes may be destructive; secrets must not be committed; current implementation may diverge from the design spec; failures should be triaged against `docs/decision-system.md` rather than patched ad hoc; platform bootstrap/direct/client mode boundaries must stay clear.
- Existing plan facts: use `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`; deploy `apps/platform` via `apps/cli`; target is Dokploy at `DOKPLOY_URL` from `.env`; API key is provided by `.env`; use `docs/decision-system.md`; continue through discovered issues instead of blocking at first failure.

## Goal Kind

`specific`

## Current Tranche

Complete successive safe verified slices until the full e2e outcome is proven: discover current CLI/platform/deploy-runner behavior, validate the intended command path and safety boundaries, attempt the deploy only when the plan and credentials are understood, fix encountered repo issues in bounded Worker tasks, re-run the relevant verification after each fix, and finish only after a final audit maps receipts back to the original e2e deploy proof.

## Operator Follow-up — 2026-05-12

The original preview e2e was proven, but the operator wants the next run to
continue through production-ready completion:

- GitHub Projects sync may use `gh`; if ProjectV2 access is blocked by token
  scopes, use `gh auth refresh` or an equivalent `GH_TOKEN`/`GITHUB_TOKEN`
  refresh with project scopes instead of treating the task as permanently
  blocked.
- Live Dokploy cleanup/destructive operations are allowed when needed for this
  goal, except resources/projects/apps named or owned by `cv-cms`, `landing`,
  or `multica`, which must not be touched.
- Desired final platform URL is `https://platform.rntme.com` if feasible. The
  run should prove the scenario works there, not only on a preview hostname,
  unless a Judge records why the canonical domain is unsafe or unavailable.
- Use `superpowers:finishing-a-development-branch` before final integration,
  then create the PR and merge it autonomously once required verification
  passes.

## Non-Negotiable Constraints

- Follow `docs/decision-system.md` for architectural choices and contradictions.
- Treat the 2026-05-10 CLI universal deploy spec as design context, then verify current behavior in code/tests before acting.
- Do not persist secret values in GoalBuddy files, logs, commits, issues, or PRs.
- Use `apps/cli` as the deploy entry point; do not bypass it with direct Dokploy-only manual deployment unless a Judge task explicitly records why the CLI path is blocked and what safe workaround remains.
- Preserve the intended architecture: CLI universal deploy front, `@rntme/deploy-runner` orchestration, platform served from `apps/platform/blueprint`, and no revival of `apps/platform-http`.
- For live Dokploy operations, prefer non-destructive create/update actions. The operator has approved destructive cleanup when needed for this goal, but do not touch resources/projects/apps named or owned by `cv-cms`, `landing`, or `multica`.
- Missing input, credentials, production access, or remote instability block only the specific task, not the whole goal.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task can be activated.

Do not stop after a single verified Worker slice when the broader owner outcome still has safe local follow-up slices. After each slice audit, advance the board to the next highest-leverage safe Worker task and continue.

Do not stop because a slice needs owner input, credentials, production access, destructive operations, or policy decisions. Mark that exact slice blocked with a receipt, create the smallest safe follow-up or workaround task, and continue all local, non-destructive work that can still move the goal toward the full outcome.

## Canonical Board

Machine truth lives at:

`docs/goals/platform-cli-dokploy-e2e/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/platform-cli-dokploy-e2e/goal.md.
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
