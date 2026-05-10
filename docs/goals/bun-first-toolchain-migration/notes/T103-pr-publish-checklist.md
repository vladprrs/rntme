# T103 Draft PR Publish Checklist

## Scope

Use this only after the operator explicitly approves publishing the migration
scope. The worktree is broad and mixed, so do not stage blindly.

Target:

- repository: `vladprrs/rntme`
- base branch: `main`
- working branch: `codex/bun-first-toolchain-migration`
- commit message: `migrate repo to bun-first toolchain`
- draft PR title: `[codex] migrate repo to bun-first toolchain`

## Preflight

```bash
git status --short --branch
git branch --show-current
gh auth status
gh repo view vladprrs/rntme --json defaultBranchRef,nameWithOwner,url
```

The expected starting branch is `main`. If already on a non-main migration
branch, do not create another branch; use the current branch after confirming it
is intended for this migration.

## Branch

```bash
git switch -c codex/bun-first-toolchain-migration
```

If the branch already exists locally, inspect it before reusing it:

```bash
git status --short --branch
git log --oneline --decorate -5
```

## Stage

Stage the migration scope while excluding the unrelated `.clone/**` path:

```bash
git add -A -- . ':!.clone/**'
```

Then verify the exclusion and inspect the staged shape:

```bash
git diff --cached --name-only | rg '^\.clone/' && exit 1 || true
git diff --cached --stat
git diff --cached --name-status | sed -n '1,160p'
```

Expected staged content includes:

- `bun.lock`, `bunfig.toml`, `.dockerignore`;
- root command/docs/workflow changes;
- deleted `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and Vitest config files;
- Bun test/runtime/bundler/SQLite migrations across apps, packages, modules,
  and demos;
- the tracked vendored demo package metadata at
  `demo/notes-blueprint/node_modules/rntme_identity_auth0/package.json`;
- GoalBuddy control files under `docs/goals/bun-first-toolchain-migration/`.

Expected staged content must not include:

- `.clone/**`;
- untracked/generated local install output, `dist`, or `build` artifacts.

## Local Verification Before Commit

Use the freshest feasible local gates before committing:

```bash
PATH="$HOME/.bun/bin:$PATH" bun install --frozen-lockfile
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run vendor:check
git diff --check
git diff --cached --check
```

Full non-Docker gates previously passed in `T091`. If time allows before
publishing, rerun:

```bash
PATH="$HOME/.bun/bin:$PATH" bun run build
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run test
PATH="$HOME/.bun/bin:$PATH" bun run depcruise
```

Do not rerun the local Docker builds in this workspace; `T092` and `T101`
record that local Docker cannot build even a minimal Dockerfile.

## Commit And Push

```bash
git commit -m "migrate repo to bun-first toolchain"
git push -u origin codex/bun-first-toolchain-migration
```

## Draft PR

Create a draft PR targeting `main`. A concise body should include:

```markdown
## Summary
- Migrates the repo from pnpm/Node/Vitest/esbuild/better-sqlite3 tooling to Bun-first package, test, runtime, bundler, Docker, and SQLite surfaces.
- Keeps `tsc` for typecheck and declaration emit.
- Adds CI Docker build coverage for all required migrated images.

## Verification
- `bun install --frozen-lockfile`
- `bun run build`
- `bun run typecheck`
- `bun run test`
- `bun run lint`
- `bun run depcruise`
- `bun run vendor:check`
- `git diff --check`

## Remaining Proof Needed
- GitHub Actions must run the PR CI Docker matrix successfully for:
  `Dockerfile.test`, `apps/platform-http`, `apps/landing`, `runtime`,
  `bpmn-worker`, `identity-auth0`, `storage-s3`, `marketing-site-static`, and
  `ai-llm-openrouter`.
```

CLI fallback:

```bash
gh pr create \
  --repo vladprrs/rntme \
  --base main \
  --head codex/bun-first-toolchain-migration \
  --draft \
  --title "[codex] migrate repo to bun-first toolchain" \
  --body-file /tmp/rntme-bun-pr-body.md
```

## CI Evidence

After the PR opens, inspect the CI run for the migration branch:

```bash
gh pr checks --repo vladprrs/rntme --watch
gh run list --repo vladprrs/rntme --branch codex/bun-first-toolchain-migration --limit 5
```

The goal can use PR CI as Docker proof only if every Docker matrix entry
completes successfully against the migration branch.
