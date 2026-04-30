# Merge `rntme-cli` submodule back + restructure workspace by architectural role — design

> Status: design (brainstorming complete). Use as input for `writing-plans`.
> Supersedes: `docs/superpowers/specs/done/2026-04-18-rntme-cli-submodule-design.md`.
> Scope: re-merge the `rntme-cli` git submodule into the parent monorepo, unify the npm scope, and reorganize `packages/` by architectural role (artifact validators vs runtime engines vs platform vs deploy vs tooling). One PR.
> Non-goals: renaming individual packages, restructuring `modules/*` or `demo/*`, splitting `cli`/`platform-http` into sub-packages, replacing `demo/issue-tracker-api`.

## 1. Problem

The `rntme-cli/` git submodule was introduced **2026-04-18** (`docs/superpowers/specs/done/2026-04-18-rntme-cli-submodule-design.md`) under one rationale:

> "This code must not ship in the public `vladprrs/rntme` repository while it is still early and **proprietary**."

That rationale is gone. `gh repo view vladprrs/rntme-cli` reports `"visibility": "PUBLIC"`. The privacy seam now buys nothing while still costing on every cross-cutting change. Symptoms today:

- **Two-PR churn.** Parent history is dotted with `Bump rntme-cli`, `Point rntme-cli submodule at...`, `chore(submodule): bump rntme-cli to ...`. Every cross-layer change ships as a paired PR. Sample from the last two weeks: ~12 submodule-bump commits.
- **Duplicate config surface.** Two `pnpm-workspace.yaml`, two `tsconfig.base.json`, two READMEs, two CI surface conventions to keep in sync. Drift is one careless PR away.
- **Boundary confusion.** `rntme-cli/apps/landing/` is *not* in the parent's `pnpm-workspace.yaml` (only `rntme-cli/packages/*` is wired in). Root-level `pnpm -r` silently skips it. Specs reference `rntme-cli/...` paths next to `packages/...` paths with no rule for which side owns what.
- **CI surface.** `.github/workflows/ci.yml` carries `submodules: recursive`; PRs from forks cannot clone (already documented as accepted, but moot now that the submodule is public).

Beyond the merge-back, a flat `packages/*` containing every library hides an architectural axis the codebase already enforces in code: the **artifact → runtime** layering. Today `@rntme/bindings` (an artifact validator + OpenAPI generator) and `@rntme/bindings-http` (a Hono surface that consumes `Validated*` bindings) sit side by side because both names start with `bindings`. The same is true for `@rntme/ui` (artifact validator) vs `@rntme/ui-runtime` and module-provided SPA surfaces. Folder layout encodes none of this.

## 2. Goals

1. **Eliminate the submodule seam.** Single repo, single workspace, single lockfile, single CI checkout. Cross-cutting changes ship in one PR.
2. **Make the architectural axis visible at the folder level.** `packages/artifacts/*` for the validators/parsers/compilers of the seven artifacts; `packages/runtime/*` for engines that consume `Validated*` types; `packages/platform/*` for the commercial control plane; `packages/deploy/*` for deployment planning + adapters; `packages/tooling/*` for scaffolds. Direction `artifacts → runtime` becomes a fact of the filesystem, not a rule kept in head.
3. **Unify the npm scope.** Drop `@rntme-cli/*`. Everything is `@rntme/*`.
4. **Surface what is runnable.** `apps/cli`, `apps/platform-http`, `apps/landing` — top-level `apps/` peer of `packages/`, `modules/`, `demo/`.
5. **Preserve `git blame`** through the merge so the 12-day deploy/platform development trail stays navigable.

## 3. Target topology

After this PR:

```
packages/
  artifacts/                              # JSON-artifact validators / parsers / compilers
    pdm/                                  @rntme/pdm
    qsm/                                  @rntme/qsm
    graph-ir-compiler/                    @rntme/graph-ir-compiler
    bindings/                             @rntme/bindings
    ui/                                   @rntme/ui
    seed/                                 @rntme/seed
    blueprint/                            @rntme/blueprint
  runtime/                                # engines consuming Validated*
    runtime/                              @rntme/runtime
    event-store/                          @rntme/event-store
    projection-consumer/                  @rntme/projection-consumer
    bindings-http/                        @rntme/bindings-http
    bindings-grpc/                        @rntme/bindings-grpc
    ui-runtime/                           @rntme/ui-runtime
    module-provided-auth-ui/              identity module client blocks
    db-studio/                            @rntme/db-studio
  platform/                               # commercial control plane
    platform-core/                        @rntme/platform-core
    platform-storage/                     @rntme/platform-storage
  deploy/                                 # deployment planning + adapters
    deploy-core/                          @rntme/deploy-core
    deploy-dokploy/                       @rntme/deploy-dokploy
  tooling/                                # scaffolds (libraries)
    module-skeleton/                      @rntme/module-skeleton
  contracts/                              # unchanged
    {category}/v{N}/

apps/                                     # runnable binaries / sites
  cli/                                    @rntme/cli            (bin: rntme)
  platform-http/                          @rntme/platform-http  (Hono server)
  landing/                                # Astro static site

modules/                                  # unchanged
demo/                                     # unchanged
```

The submodule directory `rntme-cli/` is removed; `.gitmodules` is deleted; `vladprrs/rntme-cli` is archived (read-only, URL preserved for external references).

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/artifacts/*"
  - "packages/runtime/*"
  - "packages/platform/*"
  - "packages/deploy/*"
  - "packages/tooling/*"
  - "packages/contracts/*/v*"
  - "apps/*"
  - "modules/*/*"
  - "demo/*"
```

## 4. Why this layout (and not alternatives)

Three options were weighed during brainstorm:

| Option | Verdict |
| --- | --- |
| **A. Domain-by-architectural-role** (this spec) | Chosen. Splits `bindings`/`bindings-http` and `ui`/`ui-runtime` across `artifacts/` vs `runtime/` because they *are* different roles. The `artifact → runtime` direction becomes a filesystem fact, not a convention. The OSS/commercial boundary (`runtime/` + `artifacts/` + `tooling/` vs `platform/` + `deploy/`) is visible. |
| B. Family-prefix grouping | Rejected. Keeps `bindings/{core,http,grpc}` and `ui/{core,runtime,auth-shell}` together. Easier on muscle memory but hides the architectural axis the user wanted surfaced; obscures the "validators are an oss kernel concept" insight. |
| C. Hybrid (role + family inside) | Rejected. Two-level nesting (`packages/runtime/bindings/http/`) for one package each is over-grouped. |

The folder name `artifacts/` was picked over `validators/` because the contents are more than validators: `@rntme/pdm` ships a resolver, `@rntme/graph-ir-compiler` compiles to SQL, `@rntme/bindings` generates OpenAPI 3.1. `artifacts/` matches the AGENTS.md vocabulary ("the seven artifacts of rntme").

## 5. Merge mechanics

### 5.1 — Order of operations within the PR

```
# 1. add submodule repo as plain remote, fetch its history
git remote add rntme-cli https://github.com/vladprrs/rntme-cli.git
git fetch rntme-cli main

# 2. dismount the submodule (gitlink + .gitmodules + .git/modules cache)
git submodule deinit -f rntme-cli
git rm rntme-cli
# remove the .gitmodules entry (delete file if it becomes empty)
rm -rf .git/modules/rntme-cli

# 3. graft the submodule history at the same prefix as a subtree
git subtree add --prefix=rntme-cli rntme-cli/main

# 4. relocate the merged subtree to the target layout
git mv rntme-cli/packages/cli              apps/cli
git mv rntme-cli/packages/platform-http    apps/platform-http
git mv rntme-cli/apps/landing              apps/landing
mkdir -p packages/platform packages/deploy
git mv rntme-cli/packages/platform-core    packages/platform/platform-core
git mv rntme-cli/packages/platform-storage packages/platform/platform-storage
git mv rntme-cli/packages/deploy-core      packages/deploy/deploy-core
git mv rntme-cli/packages/deploy-dokploy   packages/deploy/deploy-dokploy
# remove the now-empty submodule scaffolding
git rm rntme-cli/{package.json,pnpm-workspace.yaml,tsconfig.base.json,README.md,pnpm-lock.yaml}
rmdir rntme-cli/packages rntme-cli/apps rntme-cli

# 5. relocate existing packages/* into role folders
mkdir -p packages/{artifacts,runtime,tooling}
git mv packages/pdm                  packages/artifacts/pdm
git mv packages/qsm                  packages/artifacts/qsm
git mv packages/graph-ir-compiler    packages/artifacts/graph-ir-compiler
git mv packages/bindings             packages/artifacts/bindings
git mv packages/ui                   packages/artifacts/ui
git mv packages/seed                 packages/artifacts/seed
git mv packages/blueprint            packages/artifacts/blueprint
git mv packages/runtime              packages/runtime/runtime
git mv packages/event-store          packages/runtime/event-store
git mv packages/projection-consumer  packages/runtime/projection-consumer
git mv packages/bindings-http        packages/runtime/bindings-http
git mv packages/bindings-grpc        packages/runtime/bindings-grpc
git mv packages/ui-runtime           packages/runtime/ui-runtime
# Legacy standalone Auth0 browser package is gone; identity module client blocks stay under modules/.
git mv packages/db-studio            packages/runtime/db-studio
git mv packages/module-skeleton      packages/tooling/module-skeleton

# 6. unify the npm scope (6 package.json files + every import in the repo)
#    Each of the 6 cli-side package.json files: "@rntme-cli/X" → "@rntme/X".
#    Then sweep imports + workspace deps:
grep -rl '@rntme-cli/' --include='*.ts' --include='*.json' --include='*.md' --include='*.mjs' \
  | xargs sed -i 's|@rntme-cli/|@rntme/|g'

# 7. update workspace, CI, top-level docs (Section 6), per-package READMEs,
#    spec status notes (Section 6.3), then rebuild lockfile
pnpm install
pnpm -r run build && pnpm -r run typecheck && pnpm -r run test && pnpm -r run lint
```

`git mv` preserves rename detection. Combined with the subtree merge, `git blame apps/cli/src/...` and `git log --follow` trace cleanly back into the original submodule history.

### 5.2 — Why subtree (not plain copy)

Plain copy is simpler but loses 12 days / ~70 commits of real deploy + platform work (`deploy-core` planner, `deploy-dokploy` adapter, RNT-364 Auth0/notes-demo trail, platform-http UI work). Subtree adds a one-off noise spike to `git log` in exchange for permanent blame fidelity. Pre-stable rename freedom (memory `project_pre_stable_stage.md`) lets us pick the more thorough option without compatibility cost.

### 5.3 — Lockfile

Pre-stable; no users of `@rntme-cli/*` outside this repo. Lockfile is rebuilt from scratch via `pnpm install`. No backward-compat shims (memory `project_pre_stable_stage.md`).

## 6. Documentation impact

CLAUDE.md mandates that any plan touching the doc surface land doc updates in the same PR. This change touches every layer of the doc surface.

### 6.1 — Top-level docs (rewrite in PR)

| File | Change |
| --- | --- |
| `CLAUDE.md` | "Architecture in one paragraph" — replace `@rntme-cli/deploy-core` + `@rntme-cli/deploy-dokploy` with `@rntme/deploy-core` + `@rntme/deploy-dokploy`. Strip "submodule" mentions. |
| `AGENTS.md` | §2 (repository map) — drop the "private git submodule" entry, add `packages/{artifacts,runtime,platform,deploy,tooling}/` + `apps/`. §3 (layering) — replace 6 `@rntme-cli/*` rows with `@rntme/*`; redraw the ASCII dep arrow that names `@rntme-cli/deploy-core ─── @rntme-cli/deploy-dokploy`. §6 (how-tos) — every `rntme-cli/packages/...` path becomes the new role-folder path. §10 (glossary) — update "Deployment plan" definition to use unified scope. §11 (documentation maintenance) — verify the doc-touch checklist still reflects reality after the move. |
| `README.md` | Mermaid `DEPLOY` node uses unified scope. Packages table rows for `deploy-core`/`deploy-dokploy` link to new paths. Drop the entire `### Private submodule (rntme-cli/)` section. Drop `--recurse-submodules` from the clone instructions. |
| `docs/architecture.md` | Pointwise replace `rntme-cli/...` paths and `@rntme-cli/*` names. |
| `vision.md` | Verify no path references; drop CLI/platform submodule mentions. |

### 6.2 — Per-package READMEs

Each package README is rewritten where it references its own location (`packages/<old>/...` → `packages/<role>/<pkg>/...`). The "consumed from the parent monorepo" / "private subproject" framing in the 6 cli-side READMEs is removed. Cross-package links resolve by package name (`@rntme/qsm`) when possible to survive the move.

### 6.3 — Specs and plans (historical, not rewritten)

23 files in `docs/superpowers/specs/done/` and `docs/superpowers/plans/` reference `rntme-cli/...` or `@rntme-cli/*`. They describe point-in-time decisions and are not rewritten. Two treatments:

1. **`2026-04-18-rntme-cli-submodule-design.md`** — front-of-document banner:
   > **Status:** SUPERSEDED by `2026-04-30-merge-rntme-cli-back-design.md` (submodule re-merged into monorepo on 2026-04-30; original privacy rationale obsoleted when the repo was made public).

2. **All other affected specs/plans** — front-of-document path note:
   > **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After 2026-04-30 they moved per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

Active (not-`done/`) plans get their paths updated, since they are still being executed.

### 6.4 — CLI-skills sources

`apps/cli/src/skills/sources/*.md` (after move) carry text where `rntme-cli` means **the repo** versus where `rntme` means **the product**. Adjust the former to the new repo URL; leave the latter alone.

### 6.5 — Memory files (not in repo, but updated alongside)

After merge, the assistant updates its memory:
- `project_platform_deployed.md` — drop "submodule is public" line.
- Any other memory file that references `rntme-cli/` paths or `@rntme-cli/*` scope.

## 7. CI and infrastructure

- `.github/workflows/ci.yml`: drop `with: submodules: recursive`. The rest is unchanged.
- `.gitmodules`: deleted.
- `README.md` clone instructions: drop `--recurse-submodules`.

## 8. Dokploy follow-up (must run same day as merge)

Per memory `dokploy_watchpaths_semantics.md`, Dokploy compares `watchPaths` against committed file paths. After paths move, both production deployments need their app config updated **same day** as the merge — otherwise auto-deploy goes silent.

| App | Domain | New `watchPaths` | New `dockerContextPath` |
| --- | --- | --- | --- |
| `landing` | rntme.com | `apps/landing/**` | verify against new path |
| `platform-http` | platform.rntme.com | `apps/platform-http/**` | verify against new path |

Updates are made via `dokploy-mcp` (memory `dokploy_mcp_url_gotcha.md`, `dokploy_mcp_patched_install.md`, `dokploy_docker_build_context.md`). Smoke: push an empty commit, confirm both deploys trigger.

## 9. Acceptance gates

PR does not merge until:

- [ ] `pnpm install` succeeds; lockfile rebuilt without manual edits.
- [ ] `pnpm -r run build`, `typecheck`, `test`, `lint` all green locally and in CI.
- [ ] `grep -rn "@rntme-cli/" --include='*.ts' --include='*.json' --include='*.mjs'` returns empty (only historical specs may reference it, after status-note treatment).
- [ ] `grep -rn "rntme-cli/packages\|rntme-cli/apps" --include='*.ts' --include='*.md'` returns only historical specs/plans with the path-note banner.
- [ ] `.gitmodules` is absent; no submodule entries in `git config -f .git/config --get-regexp '^submodule\.'`.
- [ ] `git blame apps/cli/src/<sample>.ts` traces to the original submodule commit (sanity check on subtree + `git mv`).
- [ ] Top-level docs (CLAUDE.md, AGENTS.md, README.md, docs/architecture.md) carry no stale submodule references.

Post-merge (same day, separate task list, not blocking PR merge but blocking "done"):

- [ ] Dokploy `landing` app: `watchPaths` and `dockerContextPath` updated; smoke commit triggers deploy.
- [ ] Dokploy `platform-http` app: `watchPaths` and `dockerContextPath` updated; smoke commit triggers deploy.
- [ ] `gh repo archive vladprrs/rntme-cli --yes` + description suffix `Archived 2026-04-30 — merged into vladprrs/rntme`.
- [ ] Memory files updated.

## 10. Rollback

If the merge causes a problem after landing:

1. **Code:** `git revert -m 1 <merge-commit>` returns the tree to the pre-merge state in one commit. Subtree-grafted history remains in the repo as dangling commits but is inert.
2. **Submodule:** `gh repo unarchive vladprrs/rntme-cli`, then `git submodule add https://github.com/vladprrs/rntme-cli.git rntme-cli` after the revert lands.
3. **Dokploy:** revert `watchPaths` and `dockerContextPath` to pre-merge values via MCP.

## 11. Out of scope

- Renaming individual packages (e.g., `platform-core` → `control-plane-core`). Only the scope changes.
- Restructuring `modules/*/` (already category-grouped).
- Restructuring or replacing `demo/issue-tracker-api` (deprecated per CLAUDE.md, replaced separately).
- Splitting `cli` or `platform-http` into sub-packages — they are large but cohesive; sub-decomposition is its own design.
- Editing `graph_ir_rc_7.md` (gitignored, historical).
- Staged/multi-PR rollout — one PR is the chosen shape.
- Adding back-compat shims for `@rntme-cli/*` — pre-stable, no users.
