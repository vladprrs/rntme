> Status: historical.
> Date: 2026-04-30.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Merge `rntme-cli` Submodule Back + Restructure by Role — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-merge the `rntme-cli` git submodule into the parent monorepo, unify the npm scope to `@rntme/*`, and reorganize `packages/` by architectural role (`artifacts/`, `runtime/`, `platform/`, `deploy/`, `tooling/`) with runnables under `apps/`.

**Architecture:** One PR. Use `git subtree` to graft the submodule's commit history under `rntme-cli/`, then `git mv` to relocate to the target layout — `git mv` preserves rename detection so `git blame` traces through the merge. The subtree add must run from a clean index and a prefix that does not exist, so the submodule removal is committed before the subtree graft commit. Scope rename is done via direct edits to 6 `package.json` files plus a focused sweep across code/config import surfaces; historical docs are bannered, not bulk-rewritten. Lockfile rebuilt from scratch; pre-stable, no back-compat shims (memory `project_pre_stable_stage.md`).

**Tech Stack:** pnpm 9.12 workspace, TypeScript, Node 20, GitHub Actions CI, Dokploy (post-merge config update via `dokploy-mcp`).

**Plan challenge updates (2026-05-01):**
- Verified `git subtree` locally: `git subtree add` refuses a dirty index and an existing prefix, so Task 2 is split into a submodule-removal commit and a subtree-graft commit.
- Verified current submodule pin on `main` is `be1e20f8e586d9d198f14465ec16290a9f500cdf`; remote `vladprrs/rntme-cli` `main` is `26c164a239b32eaf308e8377b788de950ac93729`. The plan must not silently merge remote HEAD when the parent repo pins an older commit.
- Verified pnpm workspace glob and `--frozen-lockfile` behavior through Context7 `/pnpm/pnpm`: workspace membership is controlled by `pnpm-workspace.yaml` globs, and CI should validate the regenerated lockfile with `pnpm install --frozen-lockfile`.
- Verified Dokploy API/MCP surface through Context7 `/websites/dokploy` and local MCP schemas: `watchPaths` are saved through provider-specific `application.save*Provider` calls, while Dockerfile build settings are saved through `application.saveBuildType`; there is no generic `application-update` tool in this environment.

**Spec:** `docs/history/specs/active-rationale/2026-04-30-merge-rntme-cli-back-design.md`

---

## Phase A — Discovery & worktree setup

### Task 1: Create worktree and capture current Dokploy config

**Files:**
- New worktree: outside main checkout
- Read-only: Dokploy app configs for `landing` and `platform-http` via `dokploy-mcp`

- [ ] **Step 1: Create isolated worktree off `main`**

```bash
cd /home/coder/work/rntme
git status --short
git fetch --prune origin
git worktree add .worktrees/rnt-407-merge-rntme-cli \
  -b dev/rnt-407-merge-rntme-cli origin/main
cd .worktrees/rnt-407-merge-rntme-cli
```

Verify: `git status` clean; `git branch --show-current` prints `dev/rnt-407-merge-rntme-cli`.

- [ ] **Step 2: Init submodule in the worktree (so subtree merge has the history)**

```bash
git submodule update --init --recursive
```

Expected: `rntme-cli/` populated at the pinned commit.

Capture and preserve the parent repo's pinned submodule commit:

```bash
submodule_pin="$(git ls-tree HEAD rntme-cli | awk '{print $3}')"
test -n "$submodule_pin"
test "$(git -C rntme-cli rev-parse HEAD)" = "$submodule_pin"
printf 'pinned rntme-cli commit: %s\n' "$submodule_pin"
```

If `rntme-cli/main` has advanced beyond `$submodule_pin`, do **not** silently graft remote HEAD. Either graft the pinned commit below, or first land an explicit submodule bump/update decision.

- [ ] **Step 3: Capture current Dokploy `landing` app config (read-only)**

Use `dokploy-mcp`'s `application_one` for the `landing` application in the platform org. Record:
- current `watchPaths`
- current `dockerContextPath`
- current `dockerfile` path
- current `appName`

Save the values to `.tmp/dokploy-landing-pre-merge.json` (gitignored). The values become the rollback reference for Task 17.

> Note: `dokploy-mcp` can return full secrets in `application_one` responses (memory `dokploy_mcp_leaks_secrets.md`). Strip secret-bearing fields before writing to disk.

- [ ] **Step 4: Capture current Dokploy `platform-http` app config**

Same procedure for the `platform-http` app. Save to `.tmp/dokploy-platform-http-pre-merge.json`.

- [ ] **Step 5: Commit no code yet — discovery output is local only**

No commit. Dot-tmp files are gitignored.

---

## Phase B — Subtree merge & physical layout

### Task 2: Replace submodule with subtree-merged history

**Files:**
- Modify: `.gitmodules` (delete), `.git/modules/rntme-cli` (delete)
- Modify: index entry for `rntme-cli/` (gitlink → tree)

- [ ] **Step 1: Add submodule repo as plain remote, fetch history**

```bash
git remote add rntme-cli https://github.com/vladprrs/rntme-cli.git
git fetch rntme-cli '+refs/heads/*:refs/remotes/rntme-cli/*'
```

Expected: `git log rntme-cli/main --oneline | wc -l` ≥ 60 (12 days of submodule work).

Re-check the source commit before changing the tree:

```bash
submodule_pin="$(git ls-tree HEAD rntme-cli | awk '{print $3}')"
remote_main="$(git rev-parse rntme-cli/main)"
printf 'parent pin: %s\nremote main: %s\n' "$submodule_pin" "$remote_main"
git cat-file -e "$submodule_pin^{commit}"
mkdir -p .tmp
printf '%s\n' "$submodule_pin" > .tmp/rntme-cli-submodule-pin.txt
```

Expected: `$submodule_pin` exists locally after the fetch. If `$remote_main` differs from `$submodule_pin`, use `$submodule_pin` for the subtree graft unless the task owner explicitly decides to absorb newer `rntme-cli` commits in this same PR.

- [ ] **Step 2: Dismount the submodule**

```bash
git submodule deinit -f rntme-cli
git rm rntme-cli
rm -rf .git/modules/rntme-cli
```

- [ ] **Step 3: Delete `.gitmodules` (becomes empty after `git rm`)**

```bash
git rm .gitmodules || rm .gitmodules
```

If the file lingers as untracked, `rm .gitmodules` it.

- [ ] **Step 4: Commit the submodule removal**

```bash
git add -A
git commit -m "chore(merge): remove rntme-cli submodule before subtree graft

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Why this commit is required: `git subtree add` requires a clean working tree/index and fails if the prefix exists in the current tree.

- [ ] **Step 5: Subtree-add the pinned submodule history at the same prefix**

```bash
submodule_pin="$(cat .tmp/rntme-cli-submodule-pin.txt)"
git subtree add --prefix=rntme-cli "$submodule_pin" \
  -m "chore(merge): graft rntme-cli history via subtree"
```

Expected: a subtree merge commit and the prior submodule files now appear as ordinary tree entries under `rntme-cli/`.

- [ ] **Step 6: Sanity check — blame on a known submodule file**

```bash
git blame rntme-cli/packages/cli/src/api/client.ts | head -3
```

Expected: blame shows commits authored by submodule history (not just the merge commit).

### Task 3: Move cli-side packages into `apps/` and role folders

**Files:**
- Move: `rntme-cli/packages/cli` → `apps/cli`
- Move: `rntme-cli/packages/platform-http` → `apps/platform-http`
- Move: `rntme-cli/apps/landing` → `apps/landing`
- Move: `rntme-cli/packages/platform-core` → `packages/platform/platform-core`
- Move: `rntme-cli/packages/platform-storage` → `packages/platform/platform-storage`
- Move: `rntme-cli/packages/deploy-core` → `packages/deploy/deploy-core`
- Move: `rntme-cli/packages/deploy-dokploy` → `packages/deploy/deploy-dokploy`

- [ ] **Step 1: Create new top-level dirs**

```bash
mkdir -p apps packages/platform packages/deploy
```

- [ ] **Step 2: Move runnables to `apps/`**

```bash
git mv rntme-cli/packages/cli           apps/cli
git mv rntme-cli/packages/platform-http apps/platform-http
git mv rntme-cli/apps/landing           apps/landing
```

- [ ] **Step 3: Move libraries to role folders**

```bash
git mv rntme-cli/packages/platform-core    packages/platform/platform-core
git mv rntme-cli/packages/platform-storage packages/platform/platform-storage
git mv rntme-cli/packages/deploy-core      packages/deploy/deploy-core
git mv rntme-cli/packages/deploy-dokploy   packages/deploy/deploy-dokploy
```

- [ ] **Step 4: Verify rename detection**

```bash
git status | grep "renamed:" | wc -l
```

Expected: ≥ 7 directories registered as renames.

- [ ] **Step 5: Commit the cli-side relocation**

```bash
git commit -m "refactor: relocate rntme-cli packages into apps/ and packages/{platform,deploy}/

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4: Move existing `packages/*` into role folders

**Files:** see code below.

- [ ] **Step 1: Create role folders**

```bash
mkdir -p packages/artifacts packages/runtime packages/tooling
```

- [ ] **Step 2: Move artifact validators/parsers**

```bash
git mv packages/pdm                  packages/artifacts/pdm
git mv packages/qsm                  packages/artifacts/qsm
git mv packages/graph-ir-compiler    packages/artifacts/graph-ir-compiler
git mv packages/bindings             packages/artifacts/bindings
git mv packages/ui                   packages/artifacts/ui
git mv packages/seed                 packages/artifacts/seed
git mv packages/blueprint            packages/artifacts/blueprint
```

- [ ] **Step 3: Move runtime engines**

```bash
git mv packages/runtime              packages/runtime/runtime
git mv packages/event-store          packages/runtime/event-store
git mv packages/projection-consumer  packages/runtime/projection-consumer
git mv packages/bindings-http        packages/runtime/bindings-http
git mv packages/bindings-grpc        packages/runtime/bindings-grpc
git mv packages/ui-runtime           packages/runtime/ui-runtime
# Legacy standalone Auth0 browser package is gone; identity module client blocks stay under modules/.
git mv packages/db-studio            packages/runtime/db-studio
```

- [ ] **Step 4: Move tooling**

```bash
git mv packages/module-skeleton      packages/tooling/module-skeleton
```

- [ ] **Step 5: Verify the layout**

```bash
ls packages/
```

Expected: exactly `artifacts  contracts  deploy  platform  runtime  tooling` (six entries).

- [ ] **Step 6: Commit the main-side relocation**

```bash
git commit -m "refactor: relocate packages/* into role folders (artifacts, runtime, tooling)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5: Strip the now-empty `rntme-cli/` scaffolding

**Files:**
- Delete: `rntme-cli/{package.json,pnpm-workspace.yaml,tsconfig.base.json,README.md,pnpm-lock.yaml,node_modules}`
- Delete: empty dirs `rntme-cli/{packages,apps}` and `rntme-cli/`

- [ ] **Step 1: Remove tracked scaffold files**

```bash
git rm rntme-cli/package.json rntme-cli/pnpm-workspace.yaml \
       rntme-cli/tsconfig.base.json rntme-cli/README.md \
       rntme-cli/pnpm-lock.yaml
```

- [ ] **Step 2: Remove untracked artefacts and empty dirs**

```bash
rm -rf rntme-cli/node_modules
rmdir rntme-cli/packages rntme-cli/apps rntme-cli 2>/dev/null || true
```

- [ ] **Step 3: Verify the directory is gone**

```bash
test ! -e rntme-cli && echo OK
git status
```

Expected: `OK`; no `rntme-cli/` entries left in `git status`.

- [ ] **Step 4: Commit the scaffold removal**

```bash
git commit -m "chore: remove rntme-cli/ scaffolding after subtree relocation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Scope rename, workspace + CI, lockfile

### Task 6: Rename `@rntme-cli/*` → `@rntme/*`

**Files:**
- Modify (6): `apps/cli/package.json`, `apps/platform-http/package.json`, `packages/platform/platform-core/package.json`, `packages/platform/platform-storage/package.json`, `packages/deploy/deploy-core/package.json`, `packages/deploy/deploy-dokploy/package.json`
- Modify: code/config/package metadata containing `@rntme-cli/` (imports, `package.json` deps, test fixtures, app/package README files after relocation)
- Do **not** bulk-rewrite `docs/superpowers/{specs,plans}/done/`; Task 11 adds historical path/status banners there instead.
- Do **not** bulk-rewrite active specs/plans in this task; Task 12 updates them pointwise after the physical layout is settled.

- [ ] **Step 1: Inspect the unique scope-references first**

```bash
grep -rl '@rntme-cli/' \
  --include='*.ts' --include='*.tsx' \
  --include='*.json' --include='*.mjs' \
  apps packages modules demo .github package.json pnpm-workspace.yaml \
  > /tmp/cli-scope-files.txt
wc -l /tmp/cli-scope-files.txt
```

Expected: a list of ~50–150 files (record the count — used in Step 4 to verify).

- [ ] **Step 2: Sweep replace `@rntme-cli/` → `@rntme/` across the listed files**

```bash
test ! -s /tmp/cli-scope-files.txt || xargs -a /tmp/cli-scope-files.txt sed -i 's|@rntme-cli/|@rntme/|g'
```

- [ ] **Step 3: Verify no `@rntme-cli/` references remain in code/configs**

```bash
grep -rn '@rntme-cli/' \
  --include='*.ts' --include='*.tsx' \
  --include='*.json' --include='*.mjs' \
  apps packages modules demo
```

Expected: empty output.

- [ ] **Step 4: Sanity-check the 6 renamed package names**

```bash
for f in apps/cli apps/platform-http \
         packages/platform/platform-core packages/platform/platform-storage \
         packages/deploy/deploy-core packages/deploy/deploy-dokploy; do
  grep '"name"' "$f/package.json" | head -1
done
```

Expected: each line shows `"name": "@rntme/X"` (no `@rntme-cli`).

- [ ] **Step 5: Commit the scope rename**

```bash
git commit -am "refactor: unify npm scope @rntme-cli/* -> @rntme/*

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 7: Update `pnpm-workspace.yaml`, CI, `.gitmodules`

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json` (root) — verify scripts still resolve

- [ ] **Step 1: Replace `pnpm-workspace.yaml` with the new layout**

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

(Replaces all prior entries including the `rntme-cli/packages/*` line.)

- [ ] **Step 2: Drop `submodules: recursive` from CI**

In `.github/workflows/ci.yml`, change:

```yaml
      - uses: actions/checkout@v4
        with:
          submodules: recursive
```

to:

```yaml
      - uses: actions/checkout@v4
```

(The PAT-based submodule fetch is no longer needed.)

- [ ] **Step 3: Re-check that `.gitmodules` is gone**

```bash
test ! -e .gitmodules && echo OK
git config -f .git/config --get-regexp '^submodule\.' || echo "no submodule entries: OK"
```

Expected: `OK` for both.

- [ ] **Step 4: Verify root `package.json` `validate:issue-tracker-seed` script still resolves**

The script invokes `rntme-seed validate demo/issue-tracker-api/artifacts`. Since `@rntme/seed` is now at `packages/artifacts/seed`, pnpm's bin linkage will reroute automatically after `pnpm install`. No change needed in `package.json` text.

- [ ] **Step 5: Commit workspace + CI updates**

```bash
git commit -am "chore: update pnpm workspace + CI for unified monorepo

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 8: Rebuild lockfile, run full verification

**Files:**
- Regenerate: `pnpm-lock.yaml`

- [ ] **Step 1: Wipe the existing root lockfile and run `pnpm install`**

```bash
rm pnpm-lock.yaml
pnpm install
pnpm install --frozen-lockfile
```

Expected: install completes; new lockfile produced; the immediate frozen install exits 0. This mirrors CI's deterministic lockfile gate after the regenerated lockfile exists.

- [ ] **Step 1b: Verify workspace membership includes moved runnables and modules**

```bash
pnpm list -r --depth -1 | grep -E '@rntme/(cli|platform-http|platform-core|platform-storage|deploy-core|deploy-dokploy|pre-step-demo)'
```

Expected: all named packages appear. This catches stale `pnpm-workspace.yaml` globs, including the current `demo/pre-step-demo` workspace package.

- [ ] **Step 2: Run build**

```bash
pnpm -r run build
```

Expected: every package builds. If any package complains about a path-relative import (e.g., `../../../packages/...`), the import is hard-coded to the old layout — fix locally.

- [ ] **Step 3: Run typecheck**

```bash
pnpm -r run typecheck
```

Expected: clean. Any failure points to a path-relative import or a stale `references` entry in a `tsconfig.json`.

- [ ] **Step 4: Run tests**

```bash
pnpm -r run test
```

Expected: all green. Test fixtures sometimes hard-code paths (e.g., `'../packages/seed/...'`) — fix locally.

- [ ] **Step 5: Run lint**

```bash
pnpm -r run lint
```

Expected: clean.

- [ ] **Step 6: If any of B2–B5 fail, fix locally, re-run, then commit fixes as one followup commit**

Common breakage sources to investigate first:
- Path-relative imports inside `vitest.config.ts` (e.g., `resolve: { alias: { ... } }`).
- `tsconfig.json` `references` arrays naming sibling packages by relative path.
- `eslint.config.mjs` `tsconfigRootDir` or `project` paths.

- [ ] **Step 7: Commit lockfile + any path-fix patches**

```bash
git commit -am "chore: rebuild lockfile, fix path-relative imports after relocation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase D — Documentation

### Task 9: Update top-level docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `vision.md`

- [ ] **Step 1: `CLAUDE.md` — fix "Architecture in one paragraph"**

In the paragraph that mentions `@rntme-cli/deploy-core` + `@rntme-cli/deploy-dokploy`, replace with `@rntme/deploy-core` + `@rntme/deploy-dokploy`. Also strip any mention of "submodule" in the file.

```bash
grep -n 'rntme-cli\|submodule' CLAUDE.md
```

Expected (after edit): only false positives like the file's own name in `git log` or the commit body.

- [ ] **Step 2: `AGENTS.md` — fix §2 (repo map), §3 (layering), §6 (how-tos), §10 (glossary), §11 (doc maintenance)**

In `AGENTS.md`:
- §2: drop the "private git submodule" entry; add new sub-folders under `packages/` and a top-level `apps/`.
- §3: replace 6 `@rntme-cli/*` rows with `@rntme/*`. Redraw the ASCII dep arrow that names `@rntme-cli/deploy-core ─── @rntme-cli/deploy-dokploy`.
- §6: every `rntme-cli/packages/...` path becomes the new role-folder path (`packages/deploy/deploy-core`, `packages/deploy/deploy-dokploy`, `apps/cli`, `apps/platform-http`).
- §10: glossary entry "Deployment plan" — update scope to `@rntme/`.
- §11: re-read the doc-touch checklist to ensure it still reflects reality.

After editing, verify:

```bash
grep -n 'rntme-cli\|@rntme-cli\|/rntme-cli/' AGENTS.md
```

Expected: empty (or only inside historical references like commit hashes / archived spec dates).

- [ ] **Step 3: `README.md` — fix Mermaid + packages table + private-submodule section**

- The Mermaid `DEPLOY` node renders `@rntme-cli/deploy-core` — change to `@rntme/deploy-core`.
- Packages table: rows for `deploy-core`/`deploy-dokploy` link to `packages/deploy/deploy-core` / `packages/deploy/deploy-dokploy`.
- Delete the entire `### Private submodule (rntme-cli/)` subsection.
- Drop `--recurse-submodules` from the clone instructions.

```bash
grep -n 'rntme-cli\|@rntme-cli\|recurse-submodules' README.md
```

Expected: empty after the edit.

- [ ] **Step 4: `docs/architecture.md` — pointwise replace**

```bash
grep -n 'rntme-cli\|@rntme-cli' docs/architecture.md
```

Walk each hit and replace path/scope strings. Diagrams that label packages with the old scope need their text labels updated.

- [ ] **Step 5: `vision.md` — audit and fix**

```bash
grep -n 'rntme-cli\|@rntme-cli\|submodule' vision.md
```

Replace any path/scope mentions. Market-framing phrasing about "the platform" stays — only repo/scope strings change.

- [ ] **Step 6: Commit top-level doc updates**

```bash
git add CLAUDE.md AGENTS.md README.md docs/architecture.md vision.md
git commit -m "docs: update top-level docs for unified scope and role-based layout

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 10: Update per-package READMEs and audit docs

**Files:**
- Modify: every per-package `README.md` containing path or scope references to siblings.
- Move/modify: current package audit docs under `docs/audit/` that use `@rntme-cli/*` directory names or old package paths.

- [ ] **Step 1: List every per-package README that mentions the old paths or scope**

```bash
grep -rl 'rntme-cli\|@rntme-cli\|packages/pdm/\|packages/qsm/\|packages/runtime/runtime\|^packages/runtime\|^packages/bindings\|^packages/ui' \
  --include='README.md' apps packages modules > /tmp/pkg-readme-fixes.txt
```

(The `^packages/...` patterns catch absolute-from-root paths; relative `../sibling/` paths must be reviewed by hand because moving into a role folder changes their depth.)

- [ ] **Step 2: For each file in the list, do the following pointwise edits**

- `@rntme-cli/X` → `@rntme/X`
- `rntme-cli/packages/<X>` → corresponding new path (cli → `apps/cli`, deploy-* → `packages/deploy/...`, platform-core/storage → `packages/platform/...`, platform-http → `apps/platform-http`).
- `packages/pdm` → `packages/artifacts/pdm` (and similar for the 16 main-side relocations).
- Any phrase in the cli-side READMEs that says "Consumed from the parent monorepo" or "private subproject" — delete the paragraph; the package is now first-class.

Use `grep -n` first to find each hit, then `sed -i` per file with a tightly-scoped pattern (avoid global sweeps that catch unrelated text).

- [ ] **Step 3: Verify no stale references remain in READMEs**

```bash
grep -rn 'rntme-cli\|@rntme-cli\|packages/pdm/\|packages/qsm/' \
  --include='README.md' apps packages modules \
  | grep -v 'CHANGELOG\|history\|2026-04-\(18\|19\|2[0-6]\)'
```

Expected: empty.

- [ ] **Step 4: Rename/update current audit docs**

```bash
git mv docs/audit/@rntme-cli/cli docs/audit/@rntme/cli
git mv docs/audit/@rntme-cli/landing docs/audit/@rntme/landing
git mv docs/audit/@rntme-cli/platform-http docs/audit/@rntme/platform-http
git mv docs/audit/@rntme-cli/platform-core docs/audit/@rntme/platform-core
git mv docs/audit/@rntme-cli/platform-storage docs/audit/@rntme/platform-storage
git mv docs/audit/@rntme-cli/deploy-core docs/audit/@rntme/deploy-core
git mv docs/audit/@rntme-cli/deploy-dokploy docs/audit/@rntme/deploy-dokploy
grep -Rln 'rntme-cli\|@rntme-cli' docs/audit \
  | xargs -r sed -i 's|@rntme-cli/|@rntme/|g; s|rntme-cli/packages/cli|apps/cli|g; s|rntme-cli/apps/landing|apps/landing|g; s|rntme-cli/packages/platform-http|apps/platform-http|g; s|rntme-cli/packages/platform-core|packages/platform/platform-core|g; s|rntme-cli/packages/platform-storage|packages/platform/platform-storage|g; s|rntme-cli/packages/deploy-core|packages/deploy/deploy-core|g; s|rntme-cli/packages/deploy-dokploy|packages/deploy/deploy-dokploy|g'
grep -Rln 'rntme-cli\|@rntme-cli' docs/audit
```

Expected: final grep is empty.

- [ ] **Step 5: Commit per-package README and audit-doc updates**

```bash
git add apps packages modules docs/audit
git commit -m "docs: update per-package READMEs and audit docs for new layout

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 11: Add status banners to historical specs/plans

**Files:**
- Modify: `docs/history/specs/historical/2026-04-18-rntme-cli-submodule-design.md`
- Modify: all other specs/plans in `docs/superpowers/{specs,plans}/done/` containing `rntme-cli/` or `@rntme-cli/` references, including nested `done/<track>/...` plan directories

- [ ] **Step 1: Add `Status: SUPERSEDED` banner to the original submodule spec**

Insert at the very top of `docs/history/specs/historical/2026-04-18-rntme-cli-submodule-design.md` (above the `# Title` line):

```markdown
> **Status:** SUPERSEDED by `2026-04-30-merge-rntme-cli-back-design.md` (submodule merge-back planned for this PR; original privacy rationale obsoleted when the repo was made public).
```

- [ ] **Step 2: Enumerate other affected specs/plans**

```bash
find docs/history/specs/active-rationale/done docs/history/plans/historical/done -type f -name '*.md' -print \
  | xargs grep -ln 'rntme-cli\|@rntme-cli' \
  | grep -v '2026-04-18-rntme-cli-submodule' \
  > /tmp/historical-docs.txt
wc -l /tmp/historical-docs.txt
```

Expected: approximately 35 files in the current tree.

- [ ] **Step 3: Insert path-note banner at the top of each listed file**

For each file in `/tmp/historical-docs.txt`, prepend (above its `#` title):

```markdown
> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).
```

The body text of these specs/plans is **not** rewritten — they are historical decisions and should describe the world as it was at the time.

- [ ] **Step 4: Verify**

```bash
head -3 docs/history/specs/historical/2026-04-18-rntme-cli-submodule-design.md | grep SUPERSEDED && echo OK
xargs -a /tmp/historical-docs.txt -I{} head -3 {} | grep -c 'Path note'
```

Expected: `OK`; the count matches the number of files.

- [ ] **Step 5: Commit historical doc banners**

```bash
git add docs/history/specs/active-rationale/done docs/history/plans/historical/done
git commit -m "docs: banner historical specs/plans with path/status notes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 12: Update active (not-`done/`) specs and plans

**Files:**
- Modify: any spec in `docs/history/specs/active-rationale/` or plan in `docs/history/plans/historical/` (root, not `done/`) that references old paths/scope, excluding this merge-back spec/plan where old paths are the subject being migrated.

- [ ] **Step 1: List active specs/plans with stale references**

```bash
grep -ln 'rntme-cli\|@rntme-cli' docs/history/plans/historical/*.md docs/history/specs/active-rationale/*.md 2>/dev/null \
  | grep -v '2026-04-30-merge-rntme-cli-back'
```

Expected: handful of files (current tree includes active notes-demo/UI-module/dependency specs and plans).

- [ ] **Step 2: For each active spec/plan, replace path/scope strings in place**

Active specs/plans are still being executed against the live tree, so paths must be current. Apply the same string replacements as in Task 10 (`@rntme-cli/X` → `@rntme/X`, `rntme-cli/packages/X` → corresponding new path, `packages/pdm` → `packages/artifacts/pdm`, etc.).

- [ ] **Step 3: Verify**

```bash
grep -ln 'rntme-cli\|@rntme-cli' docs/history/plans/historical/*.md docs/history/specs/active-rationale/*.md 2>/dev/null \
  | grep -v '2026-04-30-merge-rntme-cli-back'
```

Expected: empty.

- [ ] **Step 4: Commit active spec/plan updates**

```bash
git commit -am "docs: update active specs and plans for unified scope and new layout

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 13: Update CLI skills sources

**Files:**
- Modify: `apps/cli/src/skills/sources/*.md`

- [ ] **Step 1: Inspect the skills sources for repo-vs-product references**

```bash
grep -n 'rntme-cli' apps/cli/src/skills/sources/*.md
```

The keyword `rntme-cli` appears in two distinct senses:
- **Repo / package scope:** "publish via @rntme-cli/cli", URLs like `https://github.com/vladprrs/rntme-cli`. → Replace with `@rntme/cli` or the new repo URL `https://github.com/vladprrs/rntme`.
- **Product/CLI binary mention:** "use the rntme CLI" — these stay (they refer to the `rntme` binary, not the old repo).

- [ ] **Step 2: Apply pointwise edits per occurrence**

For each hit, judge by surrounding text whether it's a repo reference (replace) or a product reference (leave). When in doubt: if the line names a `@rntme-cli/...` package or a github.com URL → replace; otherwise leave.

- [ ] **Step 3: Verify**

```bash
grep -n '@rntme-cli\|vladprrs/rntme-cli' apps/cli/src/skills/sources/*.md
```

Expected: empty.

- [ ] **Step 4: Re-run the cli package's tests to ensure no skill-source assertion broke**

```bash
pnpm -F @rntme/cli test
```

Expected: green.

- [ ] **Step 5: Commit CLI skills source updates**

```bash
git commit -am "docs(cli): update skills sources for unified scope

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase E — Final verification & PR

### Task 14: Final acceptance gates

- [ ] **Step 1: Re-run the full pnpm matrix from a clean install**

```bash
rm -rf node_modules
find . -name node_modules -type d -prune -exec rm -rf {} +
pnpm install
pnpm -r run build
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
```

Expected: each step exits 0.

- [ ] **Step 2: Confirm `@rntme-cli/` references are gone from code/configs**

```bash
grep -rn '@rntme-cli/' \
  --include='*.ts' --include='*.tsx' \
  --include='*.json' --include='*.mjs' \
  apps packages modules demo
```

Expected: empty output.

- [ ] **Step 3: Confirm `rntme-cli/` paths only survive in historical specs/plans (with path-note banner)**

```bash
grep -rn 'rntme-cli/packages\|rntme-cli/apps' \
  --include='*.md' --include='*.ts' --include='*.json' \
  apps packages modules demo docs CLAUDE.md AGENTS.md README.md
```

Expected: hits, if any, are inside:
- `docs/superpowers/{specs,plans}/done/**/*.md` files that already carry the `Path note` banner.
- `docs/history/specs/active-rationale/2026-04-30-merge-rntme-cli-back-design.md` or `docs/history/plans/historical/2026-04-30-merge-rntme-cli-back.md`, where the old paths are the migration subject.

Additionally verify current docs/audit snapshots are not stale:

```bash
grep -Rln 'rntme-cli\|@rntme-cli' docs/audit
```

Expected: empty.

- [ ] **Step 4: Confirm no submodule scaffolding remains**

```bash
test ! -e .gitmodules && echo OK1
test ! -e rntme-cli && echo OK2
git config -f .git/config --get-regexp '^submodule\.' && echo "FAIL" || echo OK3
```

Expected: `OK1`, `OK2`, `OK3`.

- [ ] **Step 5: `git blame` sanity check across the merge boundary**

```bash
git log --follow --oneline apps/cli/src/api/client.ts | tail -3
```

Expected: oldest visible commits authored by submodule history (not just the subtree merge commit).

- [ ] **Step 6: If anything fails, fix locally, re-verify, no commit needed unless code changed**

### Task 15: Open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin merge-rntme-cli
```

- [ ] **Step 2: Open PR via `gh`**

```bash
gh pr create --title "Merge rntme-cli submodule back + restructure by role" --body "$(cat <<'EOF'
## Summary
- Re-merges the `rntme-cli` git submodule into the parent monorepo via `git subtree`, preserving submodule history for `git blame`.
- Unifies the npm scope: `@rntme-cli/*` → `@rntme/*`.
- Reorganises `packages/` by architectural role: `artifacts/` (validators/parsers/compilers), `runtime/` (engines consuming `Validated*`), `platform/`, `deploy/`, `tooling/`.
- Adds top-level `apps/` for runnables (`cli`, `platform-http`, `landing`).
- Submodule `vladprrs/rntme-cli` to be archived (not deleted) post-merge.

## Spec
- `docs/history/specs/active-rationale/2026-04-30-merge-rntme-cli-back-design.md`
- Supersedes `docs/history/specs/historical/2026-04-18-rntme-cli-submodule-design.md`.

## Why
Original submodule rationale was privacy. `vladprrs/rntme-cli` is now public. The seam costs two-PR churn on every cross-cutting change (~12 submodule-bump commits in the last two weeks) without any remaining benefit.

## Test plan
- [ ] CI green: build, typecheck, test, lint
- [ ] `git blame apps/cli/src/api/client.ts` traces through submodule history
- [ ] `grep -rn '@rntme-cli/' apps packages modules demo` returns empty
- [ ] No `.gitmodules`; no `rntme-cli/` directory
- [ ] Post-merge: Dokploy `landing` and `platform-http` apps reconfigured (separate task list, not blocking PR but blocking "done")

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase F — Post-merge operations (run same day as PR merge)

> These tasks run **after** the PR merges to `main`. They are not part of the PR diff but are required to consider the work done. Treat as a follow-up checklist.

### Task 16: Update Dokploy `landing` app config

**Tools:** `dokploy-mcp`:
- `application_one` to inspect the existing provider/build-type shape.
- Provider-specific save call for `watchPaths`: usually `application_saveGithubProvider`; use `application_saveGitProvider`, `application_saveGitlabProvider`, `application_saveGiteaProvider`, or `application_saveBitbucketProvider` only if `application_one` shows that provider is active.
- `application_saveBuildType` for `dockerfile` / `dockerContextPath` if those changed.

When saving provider config, preserve the existing non-secret provider fields from `application_one`, set `enableSubmodules` to `false`, and change only `watchPaths` / build path fields needed for the new layout. Do not paste secret-bearing fields into comments, PR text, or logs.

- [ ] **Step 1: Update `watchPaths`**

Use the provider-specific save call to set `watchPaths` to `["apps/landing/**"]` (replacing whatever pre-merge value was captured in Task 1). If the provider is GitHub, the call is `application_saveGithubProvider` with existing `githubId`, `owner`, `repository`, `branch`, `buildPath`, and `triggerType` preserved.

- [ ] **Step 2: Update `dockerContextPath` and `dockerfile` if needed**

If the app's pre-merge `dockerContextPath` was `rntme-cli/apps/landing` (per memory `dokploy_docker_build_context.md`), it now has to point to `apps/landing` (or `/` with explicit dockerfile path). Use `application_saveBuildType` and supply both fields explicitly — don't rely on Dokploy's empty-string default.

- [ ] **Step 3: Verify**

Use `application_one` to read the values back and confirm they match the new layout.

### Task 17: Update Dokploy `platform-http` app config

Same procedure as Task 16, but with the new path `apps/platform-http`.

- [ ] **Step 1: Update `watchPaths` to `apps/platform-http/**`**
- [ ] **Step 2: Update `dockerContextPath` and `dockerfile` if needed**
- [ ] **Step 3: Verify with `application_one`**

### Task 18: Smoke-test both deploys

- [ ] **Step 1: Push a reversible smoke commit to `main` that touches both watched paths**

Do not use an empty commit for this watch-path test: an empty commit may have no modified path for Dokploy's path filter to match. Use a tiny reversible smoke marker under each watched app path, or another no-op file change under both `apps/landing/` and `apps/platform-http/`.

```bash
date -u +%Y-%m-%dT%H:%M:%SZ > apps/landing/.dokploy-smoke
date -u +%Y-%m-%dT%H:%M:%SZ > apps/platform-http/.dokploy-smoke
git add apps/landing/.dokploy-smoke apps/platform-http/.dokploy-smoke
git commit -m "chore: smoke-trigger Dokploy deploys after merge"
git push origin main
```

- [ ] **Step 2: Watch Dokploy for deploy triggers**

Use `application_readLogs` and/or `deployment_all` for both apps. Expected: both `landing` and `platform-http` start a build within ~1 minute.

- [ ] **Step 3: If a deploy does not trigger, revisit `watchPaths` / `dockerContextPath` for the silent app**

Per memory `dokploy_watchpaths_semantics.md`, watchPaths uses micromatch against committed modified paths. If a deploy does not trigger after the smoke-marker commit, the glob or build path is wrong and needs another iteration.

- [ ] **Step 4: Clean up smoke markers after both deploys are observed**

```bash
git rm apps/landing/.dokploy-smoke apps/platform-http/.dokploy-smoke
git commit -m "chore: remove Dokploy smoke markers"
git push origin main
```

Expected: cleanup commit may trigger one more deploy; record both the smoke-trigger and cleanup-trigger outcomes in the final issue/PR evidence.

### Task 19: Archive `vladprrs/rntme-cli`

- [ ] **Step 1: Add an "Archived" suffix to the repo description**

```bash
gh repo edit vladprrs/rntme-cli --description "Private CLI for creating rntme services from artifacts. Archived after merge into vladprrs/rntme."
```

- [ ] **Step 2: Archive (read-only)**

```bash
gh repo archive vladprrs/rntme-cli --yes
```

- [ ] **Step 3: Verify**

```bash
gh repo view vladprrs/rntme-cli --json isArchived,description
```

Expected: `"isArchived": true`, description carries the merge-back suffix.

### Task 20: Update assistant memory files

**Files:**
- Modify: `/home/coder/.claude/projects/-home-coder-project/memory/project_platform_deployed.md` (drop "submodule is public" line)
- Modify: any other memory file referencing `rntme-cli/` paths or `@rntme-cli/*` scope

- [ ] **Step 1: List affected memory files**

```bash
grep -ln 'rntme-cli\|@rntme-cli' /home/coder/.claude/projects/-home-coder-project/memory/*.md
```

- [ ] **Step 2: For each file, edit pointwise**

- Drop "submodule is public" text in `project_platform_deployed.md`.
- Replace path/scope strings as in Task 10.
- If a memory becomes stale or contradicted by the new state, remove it instead of patching.

- [ ] **Step 3: No commit — memory is local, not in repo**

---

## Self-Review

**Spec coverage:** Each section of the spec maps to tasks below.

| Spec section | Plan tasks |
| --- | --- |
| §3 Target topology | Tasks 3, 4, 5, 7 |
| §5.1 Order of operations | Tasks 2, 3, 4, 5, 6, 7, 8 |
| §5.2 Why subtree | Task 2 |
| §5.3 Lockfile | Task 8 |
| §6.1 Top-level docs | Task 9 |
| §6.2 Per-package READMEs | Task 10 |
| §6.3 Specs and plans | Tasks 11, 12 |
| §6.4 CLI-skills sources | Task 13 |
| §6.5 Memory files | Task 20 |
| §7 CI and infra | Task 7 |
| §8 Dokploy follow-up | Tasks 16, 17, 18 |
| §9 Acceptance gates | Task 14 |
| §10 Rollback | covered in spec; not a forward task |
| §11 Out of scope | nothing to do, just read |

**Placeholder scan:** No "TBD", "TODO", "implement later", or "similar to Task N" patterns. Each step has its concrete command or edit.

**Type/path consistency:** Path renames in Tasks 3 and 4 align with the layout in spec §3 verbatim (apps/cli, apps/platform-http, apps/landing, packages/{platform,deploy,artifacts,runtime,tooling}/...). Scope renames in Task 6 use `@rntme-cli/X` → `@rntme/X` consistently. The `git blame` sanity check in Task 14 references `apps/cli/src/api/client.ts` — the same file used in Task 2 for the post-subtree blame sanity check, so they're consistent.

**One judgment call left to executor:** Task 13 distinguishes "repo references" vs "product references" of the string `rntme-cli` in skills sources. Hard to encode mechanically because it depends on surrounding sentence meaning. Left as an explicit instruction.

---

**Plan complete and saved to `docs/history/plans/historical/2026-04-30-merge-rntme-cli-back.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
