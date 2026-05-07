> Status: historical.
> Date: 2026-05-07.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Docs Reset and Agent Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stale, high-token repository docs with short role-specific entry points and delete `docs/architecture.md`.

**Architecture:** This is a docs-only reset. `README.md` becomes the user landing page, `AGENTS.md` becomes the compact agent bootstrap, `CLAUDE.md` becomes a thin compatibility pointer, and current architecture/decision lookup moves to `docs/decision-system.md`, package READMEs, code/tests, and `.dependency-cruiser.cjs`.

**Tech Stack:** Markdown documentation, `rg` stale-reference checks, git diff review. No package/runtime code changes.

---

## Files

- Modify: `README.md` — short user-facing landing page with real CLI-first try-it path.
- Modify: `AGENTS.md` — compact agent navigation file targeting ~3000 tokens.
- Modify: `CLAUDE.md` — thin Claude Code bootstrap.
- Delete: `docs/architecture.md` — stale cutoff-based architecture snapshot.
- Verify: stale references to `docs/architecture.md`, removed old source-of-truth wording, docs-only diff.

## Tasks

### Task 1: Rewrite README as the user landing page

**Files:**
- Modify: `README.md`

- [x] **Step 1: Replace README with short landing content**

Use these sections only: title/hero/badges, value proposition, `Try the CLI`, agent pointer, license. The CLI path must use real commands confirmed in `apps/cli`:

```bash
npm install -g @rntme/cli
mkdir my-app && cd my-app
rntme init my-app
rntme skills install --agent claude-code
```

Do not include package tables, dependency graphs, architecture diagrams, long spec indexes, MVP inventory, or glossary.

- [x] **Step 2: Review README for removed sections**

Run:

```bash
rg -n "Architecture at a glance|Packages|Dependency graph|Design docs|MVP|Glossary|docs/architecture.md" README.md
```

Expected: no output.

### Task 2: Rewrite AGENTS as compact agent bootstrap

**Files:**
- Modify: `AGENTS.md`

- [x] **Step 1: Replace AGENTS with compact sections**

Use these sections: read order, repo map, package lookup, commands, layering, workflow, navigation recipes, do-not-do, docs touch. Keep descriptions short and hand off package details to each package README.

- [x] **Step 2: Size check**

Run:

```bash
wc -l -w AGENTS.md
```

Expected: under about 2200 words.

### Task 3: Rewrite CLAUDE and delete architecture doc

**Files:**
- Modify: `CLAUDE.md`
- Delete: `docs/architecture.md`

- [x] **Step 1: Replace CLAUDE with bootstrap content**

Keep only: read `AGENTS.md`, read `docs/decision-system.md` before decisions, package READMEs own package internals, command table.

- [x] **Step 2: Delete stale architecture snapshot**

Remove `docs/architecture.md`.

### Task 4: Verify docs reset

**Files:**
- Verify: `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/history/specs/active-rationale/2026-05-07-docs-reset-agent-navigation-design.md`

- [x] **Step 1: Search stale architecture references**

Run:

```bash
rg -n "docs/architecture.md" README.md AGENTS.md CLAUDE.md packages apps modules demo docs \
  --glob '!docs/superpowers/**' --glob '!docs/adr/**' --glob '!docs/gaps/**'
```

Expected: no output. Historical specs/plans/ADRs may still mention the deleted
file as part of their own history.

- [x] **Step 2: Search old broad source-of-truth wording**

Run:

```bash
rg -n "Specs in `docs/history/specs/active-rationale/` are the source of truth|code that disagrees with a spec is a bug|specs are source of truth" README.md AGENTS.md CLAUDE.md
```

Expected: no output.

- [x] **Step 3: Confirm docs-only diff**

Run:

```bash
git diff --stat
```

Expected: only Markdown documentation changes and deletion of `docs/architecture.md`.

## Self-review

Spec coverage:
- README landing rewrite: Task 1.
- AGENTS compact agent bootstrap: Task 2.
- CLAUDE bootstrap: Task 3.
- Architecture deletion and stale references: Task 3 and Task 4.
- Specs/plans policy replacement: Task 2 and Task 3.

Placeholder scan: no TBD/TODO placeholders.

Doc-touch evaluation: this plan intentionally touches `README.md`, `AGENTS.md`, `CLAUDE.md`, and deletes `docs/architecture.md`. Package READMEs are not changed because package internals are not migrated by this reset.
