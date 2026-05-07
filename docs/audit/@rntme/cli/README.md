# Architecture audit — `@rntme/cli`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-224` (`09e692bc-df2a-415e-84e7-d22f45c0a921`) |
| **Issue title** | Audit: package architecture — @rntme/cli |
| **Package / scope** | `@rntme/cli` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `b5371c27-d3f7-4713-a3d7-2a227dee5da9` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


# Audit Report: @rntme/cli

**Verdict: needs cleanup** - The package has a solid architectural foundation (Result<T>, harness pattern, typed API client, Zod schemas), but contains several serious discrepancies between the code, tests and documentation.

---

## High

### 1. E2E test is completely broken
**Evidence:** `test/e2e/skills-smoke.test.ts:18` calls `main(['validate'])`, but the `validate` command is missing from the `src/bin/cli.ts` manager. The test also expects `rntme.json` and `artifacts/pdm.json` files, which `init` does not create.
**Impact:** E2E test always fails on `validate`; CI is not possible without disabling e2e.
**Rec:** Remove or rewrite e2e test. If `validate` is needed, implement it as an alias for `project publish --dry-run`. If not, remove from e2e.

### 2. `init` does not create `rntme.json`
**Evidence:** `src/commands/init.ts` creates `project.json`, but `src/config/project.ts:57` looks for `rntme.json` when traversing the tree. `rntme.json` is a local service config (org/project/service/artifacts), different from `project.json`.
**Impact:** After `rntme init`, commands requiring `discoverProjectConfig` (publish, and potentially deploy) will not find the configuration.
**Rec:** Add creation of `rntme.json` to `runInit`, or explicitly document that the user must create it manually.

### 3. README documents non-existent `deploy` commands
**Evidence:** `README.md:62-64` describes `deploy plan`, `deploy render dokploy`, `deploy apply dokploy`, but there is not a single `deploy` branch in `src/bin/cli.ts`.
**Impact:** Documentation is misleading; Users expect functionality that is not there.
**Rec:** Either implement deploy commands (requires integration with `@rntme/deploy-core`/`deploy-dokploy`), or remove it from the README and create a follow-up issue.

---

## Medium

### 4. `skills install` bypasses the harness pattern
**Evidence:** `src/commands/skills/install.ts` implements its own `writeOk`/`writeErr` instead of using `runCommand` from `src/commands/harness.ts`.
**Impact:** Inconsistency between error handling and output; The `--json` flag works differently than other commands.
**Rec:** Refactor `skills install` to use `runCommand` and `CommandHandler<T>`.

### 5. The version is hardcoded as "0.0.0"
**Evidence:** `package.json:3` and `src/api/client.ts:42` contain `"0.0.0"`. `readVersion()` reads it from package.json.
**Impact:** User-Agent and `--version` always return 0.0.0; It is not possible to determine the CLI version when debugging.
**Rec:** Set up versioning (semantic-release, or at least manual bump before release).

### 6. Insufficient test command coverage
**Evidence:** There are tests for login, project create, project publish, whoami (integration), but no tests for: logout, project list, project show, project version list/show, token create/list/revoke, skills install (except for broken e2e).
**Impact:** Regressions in uncovered commands are not caught.
**Rec:** Add unit/integration tests for all teams.

### 7. `postbuild` script with fragile paths
**Evidence:** `package.json:21` - the script searches for `package.json` by `../../package.json` relative to `dist/bin/cli.js`. If the build structure changes, the script will break.
**Impact:** Assembly fragility.
**Rec:** Use `import.meta.url` at runtime or copy package.json to dist at build time.

### 8. `validate` has been removed from the CLI, but the unit test calls it "legacy"
**Evidence:** `test/unit/cli.test.ts:72-78` checks that `validate` is rejected. E2E expects it to work.
**Impact:** Contradiction between unit and e2e tests.
**Rec:** Decide if the `validate` command is needed and bring the tests into compliance.

---

## Low

### 9. `init` accepts `--org`/`--project` flags, but ignores them
**Evidence:** `test/e2e/skills-smoke.test.ts:13` passes `--org demo --project smoke`, but `runInit` does not use these flags. `parseArgs` with `strict: false` allows unknown flags.
**Rec:** Either add support for `--org`/`--project` to `init` to generate `rntme.json`, or remove it from e2e.

### 10. Cursor adapter throws an exception instead of Result
**Evidence:** `src/skills/adapters/cursor.ts:14` - `throw new Error` if there is no frontmatter.
**Impact:** Unhandled exception instead of graceful error.
**Rec:** Return Result or throw a structured error with code.

### 11. Absence of the `validate` command in the dispatcher
**Evidence:** The README mentions `rntme project publish --dry-run` as a way to validate, but there is no separate `validate` command.
**Rec:** Either add `validate` as alias/sugar, or update the documentation.

---

## Quick Wins

1. Delete/comment out the broken e2e test.
2. Update the README - remove the `deploy` commands or mark it as "coming soon".
3. Add `rntme.json` to the output of `rntme init`.
4. Add basic tests for `logout`, `project list`, `token list`.

## Require Vlad's product solution

1. **Do we need a separate `validate` command?** Currently dry-run is done via `project publish --dry-run`, but e2e and user intuition expect `rntme validate`.
2. **When to implement `deploy` commands?** The README promises them, the code does not. Is this a documentation blocker or a priority feature?
3. **What is the semantics of `rntme init`?** Does it create only a project blueprint, or a local `rntme.json` too? Now both files are needed, but only one is created.

---

**Files requiring changes:**
- `src/commands/init.ts` — add `rntme.json`
- `src/bin/cli.ts` - add `validate` or remove waits
- `README.md` - synchronize with the real CLI surface
- `test/e2e/skills-smoke.test.ts` - fix or delete
- `src/commands/skills/install.ts` — translate to harness pattern

**The plan is ready for dev implementation quick wins; product questions (validate/deploy) require Vlad's answer.**
