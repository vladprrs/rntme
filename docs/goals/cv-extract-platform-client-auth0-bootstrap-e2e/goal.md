# CV Extract Platform Client Auth0 Bootstrap E2E

## Objective

Complete the live `demo/cv-extract-blueprint` platform-client publish, deploy,
smoke, and dashboard proof without requiring further operator input, using the
approved persistent Auth0 test automation grant to bootstrap a valid platform
credential.

## Original Request

Create a fresh GoalBuddy goal with enough current context to continue the
previous cv-extract platform-client deploy work without getting blocked by
manual Auth0/browser credential input. The Auth0 account is test-only, and the
agent is approved to create a persistent test automation grant.

## Intake Summary

- Input shape: `recovery`
- Audience: platform operator/user `vladprsib`, repo maintainers, and the live
  cv-extract demo user.
- Authority: `approved`
- Proof type: `demo`
- Completion proof: platform-client mode publishes the cv-extract project
  bundle to the live platform, creates or updates the live deploy target,
  starts a deployment through the platform API, the deployment reaches a
  successful terminal state, the deployed app passes the resume
  prepare-upload/PUT/commit/extract/read smoke flow, and the platform dashboard
  data path for `org_uZUWhpWgK54VWC2X` returns 200 with access to the deployed
  project. The final receipt records platform deployment id, target slug,
  project version sequence, app base URL, marketing URL when present, and smoke
  result.
- Likely misfire: treating the existing direct-mode deploy at
  `https://cv-extract.rntme.com` as completion. It is useful evidence but does
  not satisfy platform-client publish/deploy or dashboard proof.
- Blind spots considered: Auth0 Management credentials must not be printed;
  bearer tokens, PAT plaintext, OpenRouter, RustFS, and Dokploy secrets must not
  be persisted; the persistent Auth0 grant is test-tenant automation, not a
  product auth contract; the old GoalBuddy board contains stale exploratory
  context and must be used only as historical evidence.
- Existing plan facts: preserve only current facts needed to finish:
  - Old goal path:
    `docs/goals/cv-extract-platform-client-deploy-e2e/`.
  - Old implementation plan:
    `docs/superpowers/plans/2026-05-13-cv-extract-platform-client-deploy-e2e.md`.
  - Multi-provider edge auth plan:
    `docs/superpowers/plans/2026-05-13-platform-multi-provider-edge-auth.md`.
  - Ordered edge auth providers have been implemented in the platform blueprint:
    `platform-tokens` first, `identity-auth0` second.
  - Direct-mode cv-extract proof exists and passed on 2026-05-14:
    `https://cv-extract.rntme.com`, resume smoke status `complete`.
  - Direct-mode proof does not provide a platform project version sequence or
    platform deployment id.
  - The latest known live blocker was credential bootstrap: `PLATFORM_BROWSER_JWT`
    was absent, existing shell PAT returned 401, Auth0 client credentials for
    audience `https://platform.rntme.com/api` returned 403 because the current
    M2M client had no client grant for that audience.
  - Auth0 tenant is test-only. The operator approved a persistent test
    automation grant so future runs do not require browser/Auth0 manual input.

## Goal Kind

`recovery`

## Current Tranche

Continuous execution. Start by re-validating only the current bootstrap facts,
then create or verify the persistent Auth0 test automation grant, mint a
short-lived Auth0 access token, create a platform PAT through the platform API,
and proceed through platform-client target, publish, deploy, smoke, and
dashboard proof. Continue through safe fixes if the live platform path exposes
repo defects, stale images, target drift, or deploy/runtime regressions. Stop
only when final audit proves the full platform-client outcome is complete.

## Latest Operator Symptom (2026-05-14, T014)

The `/no-org` dead-end is resolved: operator `vladprsib` now lands on
`https://platform.rntme.com/org_uZUWhpWgK54VWC2X`. New, narrower symptom: that
org page shows **no information about the cv-extract project, its services, or
deployments** — the org resolves but the org->project data path renders empty.
Recovery chain seeded: T015 Scout (diagnose the broken link, and reconcile the
T003 `done` vs `last_verification` deploy-blocked inconsistency — published-only
vs actually-deployed) -> T016 Judge -> T017 Worker fix -> T018 Worker
redeploy/deploy -> T019 PM re-confirm -> T020 final audit (supersedes T999).

## Non-Negotiable Constraints

- The Auth0 tenant is test-only, and the agent has explicit approval to create
  or verify a persistent M2M client grant for audience
  `https://platform.rntme.com/api` with `scope=[]`.
- Prefer using the existing Auth0 Management API client identified by the
  environment. If a dedicated test automation M2M client already exists, using
  it is allowed. Do not require the operator to provide a browser JWT.
- The persistent Auth0 grant is a test automation convenience, not a product
  authorization contract. Record it that way in receipts and docs if docs are
  touched.
- Do not print, commit, or persist secret material: Auth0 Management token,
  Auth0 client secret, Auth0 access token, platform PAT plaintext, Dokploy API
  key, OpenRouter key, RustFS credentials, or presigned URL signatures.
- If token material must cross a command boundary, keep it in process memory or
  in a temporary `/tmp` file with restrictive permissions, delete it after use,
  and record only non-secret identifiers.
- Do not forge internal edge headers and do not seed platform token rows
  directly. The approved path is Auth0 client grant -> Auth0 JWT -> platform
  `/api/tokens` -> platform PAT.
- Preserve unrelated dirty worktree changes. Commit only changes made for this
  goal if a commit is needed.
- Follow `AGENTS.md`: read relevant README stubs and owner docs before package
  source, verify current code/tests, and respect dependency-cruiser layering.
- Completion requires live proof through platform-client mode, not only local
  tests or direct-mode deploy.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task
can be activated.

Do not stop after Auth0 grant creation or PAT bootstrap. Those are enabling
steps, not completion.

Do not stop because a slice needs credentials or production-like access if the
credential can be derived from the approved test Auth0 automation grant. Mark
only genuinely impossible or unsafe slices blocked, create the smallest safe
follow-up, and keep advancing local or live work that still moves the goal.

## Canonical Board

Machine truth lives at:

`docs/goals/cv-extract-platform-client-auth0-bootstrap-e2e/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status,
active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/cv-extract-platform-client-auth0-bootstrap-e2e/goal.md.
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
