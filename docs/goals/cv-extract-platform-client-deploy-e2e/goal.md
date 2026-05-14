# CV Extract Platform Client Deploy E2E

## Objective

Implement the existing CV extract platform-client deploy E2E plan and the multi-provider platform edge-auth follow-up plan through the repo, CLI, deployed platform, and Dokploy until `demo/cv-extract-blueprint` is deployed and smoke-tested live.

## Original Request

Prepare a GoalBuddy implementation goal for `docs/superpowers/plans/2026-05-13-cv-extract-platform-client-deploy-e2e.md`; use `superpowers:subagent-driven-development`, keep advancing instead of blocking, deploy `demo/cv-extract-blueprint`, return a working cv-extract URL, and make the platform dashboard for user/org `vladprsib` (`org_uZUWhpWgK54VWC2X`) show access to the deployed project.

## Intake Summary

- Input shape: `existing_plan`
- Audience: platform operator/user `vladprsib`, repo maintainers, and the deployed cv-extract demo user.
- Authority: `requested`
- Proof type: `demo`
- Completion proof: a live deployed cv-extract URL passes the resume upload, commit, extract, and read smoke flow; the platform dashboard for `vladprsib` / `org_uZUWhpWgK54VWC2X` shows access to the deployed `cv-extract` project; final local verification and live deployment receipts are recorded.
- Likely misfire: finishing only the local implementation, fake platform e2e, or gated test harness while never publishing/deploying through the live CLI and platform, or deploying without dashboard access for the requested org/user.
- Blind spots considered: the existing plan may be stale against current code; `.env` uses `OPENROUTER` while the plan names `OPENROUTER_API_KEY`; target image/domain/secret names may need discovery from the current platform/Dokploy state; Auth0 organization/user/dashboard wiring may need platform-native or Auth0 Management API fixes; existing dirty worktree changes must be preserved.
- Existing plan facts: preserve and validate all ten plan tasks from `docs/superpowers/plans/2026-05-13-cv-extract-platform-client-deploy-e2e.md`, including integration service aliases, CV blueprint validity, runtime module manifests, marketing project-folder assets, target-owned static hosting, platform-native publish/deploy/target APIs, CLI platform-client fake e2e, gated live smoke tests, owner docs, decision-system updates, CI-equivalent verification, and final handoff fields.
- Follow-up plan facts: preserve and validate `docs/superpowers/plans/2026-05-13-platform-multi-provider-edge-auth.md`, which replaces unsafe single-provider/bypass auth with ordered edge auth providers, adds platform token HTTP introspection, response headers/status in bindings, native binding startup without Graph IR, project-routed runtime binding paths, docs, full local verification, platform redeploy, and resumed T012 live proof.

## Goal Kind

`existing_plan`

## Current Tranche

Continuous execution: validate the existing CV extract plan and the platform multi-provider edge-auth plan against current docs, code, tests, credentials, platform state, and Dokploy state; implement successive safe verified slices; recover from failures by creating smaller Worker tasks; and continue until the full live deployment and dashboard outcome is complete.

The current continuation starts with read-only preflight and branch hygiene for `docs/superpowers/plans/2026-05-13-platform-multi-provider-edge-auth.md`. Once a Judge approves concrete write scopes, Worker tasks should proceed through the edge-auth implementation plan and resumed deployment flow without stopping at "ready for implementation" or "local tests pass".

## Non-Negotiable Constraints

- Use exactly `superpowers:subagent-driven-development` during `/goal` execution before implementation work. Do not substitute `superpowers:executing-plans`, manual-only execution, or another development workflow. If dedicated GoalBuddy agents are unavailable, continue through PM fallback only after recording why the required subagent-driven workflow cannot be fully applied.
- Use subagents for research and investigation too: Scout/Judge drift analysis, architecture investigation, and completion audits should be delegated rather than done only in the PM thread. Select each subagent model by complexity: lightweight for mechanical lookup, standard for cross-file synthesis, strongest available for architecture, security, deployment-risk, or final-audit judgment. Record the model choice rationale in receipts.
- Follow `AGENTS.md`: read `docs/decision-system.md` for strategic/convention decisions, read local README stubs and owner docs before package source, verify current behavior in code/tests, and respect dependency-cruiser layering.
- Do not treat historical specs or this plan as current-state truth without checking current docs, code, tests, `package.json`, and `.dependency-cruiser.cjs`.
- Do not bypass validation brands with casts, skip validation, throw across validation/compile package boundaries, reorder error codes, add unsupported authoring formats, leak vendor SDK types across canonical contracts, or add warning-only architecture rules.
- Do not block the whole goal because a task lacks an obvious path. Use the available `.env` credentials, Auth0 Management API credentials, Dokploy URL/API key, OpenRouter credential, Dokploy MCP, platform CLI/API, and repo tools to devise the smallest safe workaround. Block only the exact task that is truly blocked, record why, and keep advancing safe adjacent work.
- Do not print or persist secret values. Record only secret names, config keys, and non-secret deployment identifiers.
- Preserve unrelated dirty worktree changes. Before commits, if any are still desired, inspect the dirty tree and include only this goal's changes.
- Completion requires live proof, not just local tests: working app URL, resume smoke result, deployment id, target slug, project version sequence, marketing URL when applicable, and dashboard access for `vladprsib` / `org_uZUWhpWgK54VWC2X`.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task can be activated.

Do not stop after a single verified Worker slice when the broader owner outcome still has safe local follow-up slices. After each slice audit, advance the board to the next highest-leverage safe Worker task and continue.

Do not stop because a slice needs owner input, credentials, production access, destructive operations, or policy decisions. Mark that exact slice blocked with a receipt, create the smallest safe follow-up or workaround task, and continue all local, non-destructive work that can still move the goal toward the full outcome.

## Canonical Board

Machine truth lives at:

`docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/cv-extract-platform-client-deploy-e2e/goal.md.
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
10. If a task is blocked, create and activate the smallest safe workaround or evidence-gathering task that can continue without owner input.
11. Treat a slice audit as a checkpoint, not completion, unless it explicitly proves the full original outcome is complete.
12. Finish only with a Judge/PM audit receipt that maps receipts and verification back to the original user outcome and records `full_outcome_complete: true`.
