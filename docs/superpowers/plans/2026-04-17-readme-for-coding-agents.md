# READMEs and AGENTS.md for coding agents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 11 existing READMEs to a uniform agent-friendly template, create READMEs for the two missing packages (`ui`, `ui-runtime`), add a project-level `AGENTS.md` research map, and add a one-block pointer in the root `README.md`.

**Architecture:** Documentation-only refactor. Each package README is produced by a fresh subagent given the package's spec, current README, the §4 template from the design doc, and the live `ls src/` listing. The main session verifies the output (file map matches reality, spec links resolve), then commits. `AGENTS.md` is written in the main session because it cross-references all packages.

**Tech Stack:** Markdown only. No code changes. Verification uses `ls`, `grep`, `find`, and the existing `pnpm -r run build/test` pipeline as a paranoia check.

**Spec:** `docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md`

**Note on git:** `/docs/superpowers/` is gitignored, so this plan and the spec stay on local disk. Only the README/AGENTS.md files are committed.

---

## Conventions used by every task

**Subagent prompt template** (the "Author one README" subagent). Used in tasks that produce per-package READMEs:

```
You are writing the README.md for `packages/<PKG>` of the rntme project.

CONSTRAINT — read these in order:
1. The design spec at docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md.
   Section §4 is the README template. Section §6 is the content-rule checklist.
2. The current README at packages/<PKG>/README.md.
3. The package source: list files under packages/<PKG>/src/ and read entry files
   (index.ts, parse.ts, validate*.ts, and any files referenced from index.ts).
4. The package tests under packages/<PKG>/test/ — to ground "Where to look first"
   pointers and to validate "Invariants & gotchas" entries.
5. The relevant spec(s) referenced in the current README's "Specs" section,
   plus this list (if any): <PKG-SPECIFIC SPEC PATHS>.
6. The auto-memory entries listed below (read for invariants you might miss):
   <RELEVANT MEMORY ENTRIES>

OUTPUT: a complete README.md following the §4 template exactly. Section
headings are fixed and must appear in the order from §4. Target length:
<SIZE TARGET FROM §3>. Do NOT include sections that don't apply (e.g.,
"Glossary" if the package has no local terms).

CONTENT RULES (from §6):
- No "usually", "often", "easy", "simple", "just".
- File map must match `ls -R packages/<PKG>/src/` exactly.
- Every spec link must resolve against the working tree.
- "Invariants & gotchas" entries must come from: the spec, an existing
  test, an auto-memory entry, or a "fix" commit in `git log packages/<PKG>`.
  No theoretical pitfalls.
- "Where to look first" uses function/file names, not line numbers.
- Quick-start TypeScript snippets must use real exports (cross-check
  against `src/index.ts`).
- Do not duplicate facts that live in the spec — link to them.

Return the README content only. No preamble, no commentary.
```

**Verification block** (run by main session after every per-package README is written):

```bash
# 1. File map matches reality
diff <(grep -oE 'src/[a-zA-Z0-9_/.-]+' packages/<PKG>/README.md | sort -u) \
     <(cd packages/<PKG> && find src -type f | sort -u)
# Empty diff → file map matches. Discrepancies → fix README.

# 2. All spec links resolve
grep -oE '\(\.\./\.\./docs/superpowers/[a-zA-Z0-9_/.-]+\.md' packages/<PKG>/README.md \
  | sed 's/^(//' | while read p; do
      target="packages/<PKG>/$p"
      [ -f "$target" ] || echo "BROKEN LINK: $p"
    done
# No "BROKEN LINK" lines → all references resolve.

# 3. No banned soft language
grep -nE '\b(usually|often|easy|simple|just)\b' packages/<PKG>/README.md \
  || echo "OK: no banned words"
```

**Commit style:** one commit per task. Body brief; trailer with Claude attribution per project convention.

---

## Task 1: Foundation packages — pdm, event-store, bindings

**Files:**
- Modify: `packages/pdm/README.md`
- Modify: `packages/event-store/README.md`
- Modify: `packages/bindings/README.md`

These three have no internal `@rntme/*` dependencies, so file-map and "Role in the system" sections are simplest. Process them in parallel via three subagents.

- [ ] **Step 1: Capture current state and per-package context**

```bash
wc -l packages/pdm/README.md packages/event-store/README.md packages/bindings/README.md
ls packages/pdm/src packages/event-store/src packages/bindings/src
git log --oneline --all -- packages/pdm/ | head -20
git log --oneline --all -- packages/event-store/ | head -20
git log --oneline --all -- packages/bindings/ | head -20
```

Expected: each `ls` returns the layout already verified during planning. Note any "fix" commits per package — feed their messages into the subagent prompt under "auto-memory entries" if they document an invariant.

- [ ] **Step 2: Dispatch three parallel subagents**

Use the Agent tool, one call per package, all in a single message. Each prompt is the template from "Conventions" above with placeholders filled:

| Placeholder | pdm value | event-store value | bindings value |
|---|---|---|---|
| `<PKG>` | `pdm` | `event-store` | `bindings` |
| `<SIZE TARGET FROM §3>` | 250–350 lines | 200–300 lines | 250–350 lines |
| `<PKG-SPECIFIC SPEC PATHS>` | `docs/superpowers/specs/2026-04-14-mutations-design.md` (stateMachine, derived event types) | `docs/superpowers/specs/2026-04-14-mutations-design.md` §event store, relay | `docs/superpowers/specs/2026-04-14-bindings-design.md` |
| `<RELEVANT MEMORY ENTRIES>` | none | none | none |

Subagent type: `general-purpose`.

- [ ] **Step 3: Apply the three READMEs via Write**

For each subagent's returned content, use `Write` against the corresponding `packages/<PKG>/README.md`. Do not edit subagent output before writing — if something is wrong, send a second subagent invocation with the correction.

- [ ] **Step 4: Run verification block for each package**

Execute the three-step verification block from "Conventions" for each of the three packages. Fix discrepancies inline before committing. If a banned word is intentional in a quote/code, re-word.

- [ ] **Step 5: Commit**

```bash
git add packages/pdm/README.md packages/event-store/README.md packages/bindings/README.md
git commit -m "$(cat <<'EOF'
docs: per-package README — foundation packages (pdm, event-store, bindings)

Restructure to the agent-friendly template (file map, invariants & gotchas,
where to look first, out of scope). Spec:
docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git status
```

Expected: clean working tree on `main` with one new commit.

---

## Task 2: Derived authoring packages — qsm, seed

**Files:**
- Modify: `packages/qsm/README.md`
- Modify: `packages/seed/README.md`

Both consume PDM and produce derived artifacts (projections; seed envelopes). Two parallel subagents.

- [ ] **Step 1: Capture current state**

```bash
wc -l packages/qsm/README.md packages/seed/README.md
ls packages/qsm/src packages/seed/src
git log --oneline --all -- packages/qsm/ | head -20
git log --oneline --all -- packages/seed/ | head -20
```

- [ ] **Step 2: Dispatch two parallel subagents**

| Placeholder | qsm value | seed value |
|---|---|---|
| `<PKG>` | `qsm` | `seed` |
| `<SIZE TARGET FROM §3>` | 250–350 lines | 200–300 lines |
| `<PKG-SPECIFIC SPEC PATHS>` | `docs/superpowers/specs/2026-04-14-mutations-design.md` §6, `docs/superpowers/specs/2026-04-16-qsm-relations-migration-design.md` | `docs/superpowers/specs/2026-04-15-runtime-seed-design.md` |
| `<RELEVANT MEMORY ENTRIES>` | none | none |

- [ ] **Step 3: Write the returned content to each README**

- [ ] **Step 4: Run verification block for each**

- [ ] **Step 5: Commit**

```bash
git add packages/qsm/README.md packages/seed/README.md
git commit -m "$(cat <<'EOF'
docs: per-package README — derived authoring (qsm, seed)

Restructure to the agent-friendly template. Spec:
docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: graph-ir-compiler

**Files:**
- Modify: `packages/graph-ir-compiler/README.md`

Largest README (target 400–500 lines). One subagent, isolated commit for diff readability. The package has the most subdirectories (`canonical`, `command-runtime`, `emit`, `execute`, `explain`, `lower`, `parse`, `relational`, `role`, `semantic-plan`, `types`, `validate`) so the file map matters most here.

- [ ] **Step 1: Capture current state and full src tree**

```bash
wc -l packages/graph-ir-compiler/README.md
find packages/graph-ir-compiler/src -type f | sort
git log --oneline --all -- packages/graph-ir-compiler/ | head -40
```

Expected: src tree matches the layout used during planning. Note recent `fix(graph-ir-compiler): ...` commits — they signal invariants worth documenting (e.g., the `predicate_optional` SQL-positional bug, the NAV validator hardening, the `collectDotNavPaths` lookup guard).

- [ ] **Step 2: Dispatch one subagent**

| Placeholder | value |
|---|---|
| `<PKG>` | `graph-ir-compiler` |
| `<SIZE TARGET FROM §3>` | 400–500 lines |
| `<PKG-SPECIFIC SPEC PATHS>` | `docs/superpowers/specs/2026-04-13-graph-ir-sql-compiler-mvp-design.md`, `docs/superpowers/specs/2026-04-14-mutations-design.md` (command-runtime), `docs/superpowers/specs/2026-04-16-predicate-optional-fix-design.md`, `docs/superpowers/specs/2026-04-16-qsm-relations-migration-design.md`, `graph_ir_rc_7.md` (root) |
| `<RELEVANT MEMORY ENTRIES>` | `rntme_predicate_optional_bug.md` — `wrapPredicateOptional` misaligns SQL `?` positions when filter mixes `predicate_optional` with other params; `demo_join_enrichment_todo.md` — list/search endpoints currently return raw FK IDs |

Augment the subagent prompt with: "Tree the `src/` directory under each subdirectory in the File map (do not flatten). Each subdirectory becomes a sub-tree with its own one-line purposes."

- [ ] **Step 3: Write the returned content**

- [ ] **Step 4: Run verification block**

In addition to the standard checks, manually verify these auto-memory invariants are present in "Invariants & gotchas":
- `predicate_optional` mixed with other params — SQL positional misalignment.
- NAV operator restrictions captured by the semantic validator (`NAV_NOT_ALLOWED`, `NAV_FAN_OUT_NOT_ALLOWED`).

If absent, send a follow-up subagent invocation: "Add these two invariants under '## Invariants & gotchas': <text>. Return the full updated README."

- [ ] **Step 5: Commit**

```bash
git add packages/graph-ir-compiler/README.md
git commit -m "$(cat <<'EOF'
docs: per-package README — graph-ir-compiler

Restructure to the agent-friendly template. Documents the
sub-tree layout (canonical/lower/semantic-plan/emit/...) and
captures known SQL-positional and NAV invariants. Spec:
docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: projection-consumer

**Files:**
- Modify: `packages/projection-consumer/README.md`

- [ ] **Step 1: Capture current state**

```bash
wc -l packages/projection-consumer/README.md
ls packages/projection-consumer/src
git log --oneline --all -- packages/projection-consumer/ | head -20
```

- [ ] **Step 2: Dispatch subagent**

| Placeholder | value |
|---|---|
| `<PKG>` | `projection-consumer` |
| `<SIZE TARGET FROM §3>` | 200–300 lines |
| `<PKG-SPECIFIC SPEC PATHS>` | `docs/superpowers/specs/2026-04-14-mutations-design.md` §projection-consumer |
| `<RELEVANT MEMORY ENTRIES>` | none |

- [ ] **Step 3: Write the returned content**

- [ ] **Step 4: Run verification block**

- [ ] **Step 5: Commit**

```bash
git add packages/projection-consumer/README.md
git commit -m "$(cat <<'EOF'
docs: per-package README — projection-consumer

Restructure to the agent-friendly template. Spec:
docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: bindings-http

**Files:**
- Modify: `packages/bindings-http/README.md`

- [ ] **Step 1: Capture current state**

```bash
wc -l packages/bindings-http/README.md
ls packages/bindings-http/src
git log --oneline --all -- packages/bindings-http/ | head -20
```

- [ ] **Step 2: Dispatch subagent**

| Placeholder | value |
|---|---|
| `<PKG>` | `bindings-http` |
| `<SIZE TARGET FROM §3>` | 200–300 lines |
| `<PKG-SPECIFIC SPEC PATHS>` | `docs/superpowers/specs/2026-04-14-bindings-http-design.md` |
| `<RELEVANT MEMORY ENTRIES>` | none |

- [ ] **Step 3: Write the returned content**

- [ ] **Step 4: Run verification block**

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-http/README.md
git commit -m "$(cat <<'EOF'
docs: per-package README — bindings-http

Restructure to the agent-friendly template. Spec:
docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: UI layer — ui, ui-runtime (both created from scratch)

**Files:**
- Create: `packages/ui/README.md`
- Create: `packages/ui-runtime/README.md`

Neither package has a README today. The subagent prompt deviates: there is no "current README" input. Add this line to the prompt: "There is no current README. Produce one from scratch following the template."

- [ ] **Step 1: Capture state**

```bash
ls packages/ui/src packages/ui-runtime/src
ls packages/ui packages/ui-runtime  # confirm no README.md exists
cat packages/ui/package.json
cat packages/ui-runtime/package.json
git log --oneline --all -- packages/ui/ | head -20
git log --oneline --all -- packages/ui-runtime/ | head -20
```

- [ ] **Step 2: Dispatch two parallel subagents**

| Placeholder | ui value | ui-runtime value |
|---|---|---|
| `<PKG>` | `ui` | `ui-runtime` |
| `<SIZE TARGET FROM §3>` | 250–350 lines | 200–300 lines |
| `<PKG-SPECIFIC SPEC PATHS>` | `docs/superpowers/specs/2026-04-16-ui-artifact-v2-design.md` | `docs/superpowers/specs/2026-04-16-ui-artifact-v2-design.md` |
| `<RELEVANT MEMORY ENTRIES>` | none | none |

Both prompts include the "from scratch" line above. For `ui-runtime`, also include: "This package emits both an HTTP sub-router (server) and an SPA bundle (client). Reflect both in the file map and Quick start."

- [ ] **Step 3: Write the returned content**

- [ ] **Step 4: Run verification block for each**

- [ ] **Step 5: Commit**

```bash
git add packages/ui/README.md packages/ui-runtime/README.md
git commit -m "$(cat <<'EOF'
docs: per-package README — UI layer (ui, ui-runtime)

Create from scratch on the agent-friendly template. Spec:
docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: runtime

**Files:**
- Modify: `packages/runtime/README.md`

The runtime depends on every other package. Done after the rest so its "Role in the system" can reference the up-to-date READMEs.

- [ ] **Step 1: Capture current state**

```bash
wc -l packages/runtime/README.md
ls packages/runtime/src
git log --oneline --all -- packages/runtime/ | head -20
```

- [ ] **Step 2: Dispatch subagent**

| Placeholder | value |
|---|---|
| `<PKG>` | `runtime` |
| `<SIZE TARGET FROM §3>` | 200–300 lines |
| `<PKG-SPECIFIC SPEC PATHS>` | `docs/superpowers/specs/2026-04-15-runtime-packaging-design.md` (referenced by current README; verify path before passing to subagent), `docs/superpowers/specs/2026-04-15-runtime-seed-design.md` |
| `<RELEVANT MEMORY ENTRIES>` | `project_infra.md` — server/Coolify deployment context (use only if it surfaces a real runtime invariant) |

Verify the `runtime-packaging-design.md` filename before dispatching:

```bash
ls docs/superpowers/specs/ | grep runtime
```

If the filename differs, update the placeholder before sending the prompt.

- [ ] **Step 3: Write the returned content**

- [ ] **Step 4: Run verification block**

Plus an extra check for the `Plugin seams` content (DbDriver/EventBus/Surface) — these are exported and the README should mention them in the API table.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/README.md
git commit -m "$(cat <<'EOF'
docs: per-package README — runtime

Restructure to the agent-friendly template. Spec:
docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: demo — issue-tracker-api

**Files:**
- Modify: `demo/issue-tracker-api/README.md`

The demo README serves a slightly different purpose: it explains how to read the example, what each artifact is for, and where the agent should look when answering "how does X get wired up". The template still applies; "File map" covers `artifacts/` and `src/` rather than `src/` only.

- [ ] **Step 1: Capture current state**

```bash
wc -l demo/issue-tracker-api/README.md
ls demo/issue-tracker-api/src demo/issue-tracker-api/artifacts demo/issue-tracker-api/test
cat demo/issue-tracker-api/KNOWN_ISSUES.md  # content may seed Invariants & gotchas
git log --oneline --all -- demo/issue-tracker-api/ | head -30
```

- [ ] **Step 2: Dispatch subagent**

Use the standard prompt with these placeholders:

| Placeholder | value |
|---|---|
| `<PKG>` | `issue-tracker-api-demo` (relative path: `demo/issue-tracker-api`) |
| `<SIZE TARGET FROM §3>` | 250–350 lines |
| `<PKG-SPECIFIC SPEC PATHS>` | `docs/superpowers/specs/2026-04-16-demo-issue-tracker-fixes-design.md`, `docs/superpowers/specs/2026-04-16-demo-v2-migration-design.md` |
| `<RELEVANT MEMORY ENTRIES>` | `demo_join_enrichment_todo.md` — list/search endpoints return raw FK IDs |

Augment the prompt with: "This is the demo, not a library. Reframe Quick start as 'how to run the demo locally'. The File map covers BOTH `src/` (server bootstrap) AND `artifacts/` (PDM/QSM/graphs/bindings/UI JSON). Add a section after 'Where to look first' titled '## Reading the example' with: 'If you want to understand how X is wired, start at file Y' for X in {a query, a command, a UI screen, a projection, an event}. Pull `KNOWN_ISSUES.md` content into 'Invariants & gotchas' if applicable."

- [ ] **Step 3: Write the returned content**

- [ ] **Step 4: Run verification block**

The path adjustments: replace `packages/<PKG>/` with `demo/issue-tracker-api/` in each verification command.

- [ ] **Step 5: Commit**

```bash
git add demo/issue-tracker-api/README.md
git commit -m "$(cat <<'EOF'
docs: demo README — restructure as agent-readable example

Apply the agent-friendly template, plus a 'Reading the example'
section for "how is X wired" navigation. Spec:
docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: AGENTS.md (root)

**Files:**
- Create: `AGENTS.md`

Written in the main session, not delegated, because it cross-references all per-package READMEs from Tasks 1–8 and so requires their finished state.

- [ ] **Step 1: Verify the prerequisite READMEs are committed**

```bash
git log --oneline -10
ls packages/*/README.md demo/*/README.md
wc -l AGENTS.md 2>/dev/null  # expect "no such file"
```

Expected: 8 commits from Tasks 1–8 visible. All 11 package READMEs + 2 new ui READMEs = 13 files plus the demo. AGENTS.md does not yet exist.

- [ ] **Step 2: Re-read the spec §5 to fix structure**

Open `docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md` and read §5 in full. The 10 numbered subsections (1. Workflow expectations through 10. Glossary) are the headings. Do not invent new sections; do not skip any.

- [ ] **Step 3: Resolve the "Where decisions live" pointers (§8)**

For each "if you're tempted to do X, the decision-doc is Y" pair listed in spec §5, find the actual spec path:

```bash
grep -rln 'SQLite' docs/superpowers/specs/ | head -5  # for "Why SQLite"
grep -rln 'entity-mirror' docs/superpowers/specs/ | head -5  # for "Why entity-mirror only"
grep -rln 'four-layer' docs/superpowers/specs/ | head -5  # for "Why the four-layer validator"
grep -rln 'YAML' docs/superpowers/specs/ docs/adr/ | head -5  # for "Why no YAML"
```

For any pair where no concrete spec exists, drop the entry rather than leaving a TBD. The list in §5 is illustrative; the AGENTS.md content is "verified pointers only".

- [ ] **Step 4: Resolve the "How to do common tasks" entries (§6)**

For each 6.x subsection in spec §5, draft the 6–10 lines by reading the relevant package README (which now exists). Each subsection contains: numbered steps, file pointers, and the spec to read first.

For example, "6.1 Add a new graph operator" pulls from `packages/graph-ir-compiler/README.md`'s "Where to look first" entry on the same topic. If the subagent did not produce that entry, treat it as a gap and either (a) add the entry to the relevant per-package README and amend the prior commit's contents in a follow-up commit, or (b) write the steps directly into AGENTS.md from source code reading. Prefer (a) — keep authority in the package README.

If an entry has no clear answer (e.g., "6.4 Add a new event-store driver" — no precedent yet), include the subsection but write: "No precedent in the codebase. Read `packages/event-store/README.md` and `packages/runtime/README.md` plugin-seam section for the closest analog." Do not fabricate steps.

- [ ] **Step 5: Write AGENTS.md**

Use `Write` to create `/home/coder/project/AGENTS.md` containing all 10 sections. Length target: 300–450 lines per spec §3. Each section header is `## N. <Name>` matching spec §5 exactly.

Verify spec §4 conventions are present and accurately quoted:
- `Result<T>` shape.
- Branded `Validated*` types.
- Error code naming `<PKG>_<LAYER>_<KIND>`.
- SQLite-only target with Turso roadmap pointer.
- JSON-only authoring.
- Vitest test categories.

- [ ] **Step 6: Run AGENTS.md verification**

```bash
# 1. All package READMEs referenced
for pkg in pdm qsm event-store graph-ir-compiler bindings bindings-http \
           projection-consumer seed runtime ui ui-runtime; do
  grep -q "packages/$pkg" AGENTS.md || echo "MISSING reference: $pkg"
done

# 2. All spec links resolve
grep -oE '\(docs/superpowers/[a-zA-Z0-9_/.-]+\.md\)' AGENTS.md \
  | tr -d '()' | while read p; do
      [ -f "$p" ] || echo "BROKEN LINK: $p"
    done

# 3. No banned soft language
grep -nE '\b(usually|often|easy|simple|just)\b' AGENTS.md \
  || echo "OK: no banned words"

# 4. All 10 sections present
for n in 1 2 3 4 5 6 7 8 9 10; do
  grep -q "^## $n\." AGENTS.md || echo "MISSING section: $n"
done

# 5. Length within target
wc -l AGENTS.md  # expect 300-450
```

Each check should produce only "OK"/empty output. Fix any failures.

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
docs: AGENTS.md — repo research map for coding agents

Project-level navigation document: repo map, package layering,
project-wide conventions (Result<T>, branded types, error codes,
SQLite target), build/test/lint commands, task-indexed pointers
("how to do common tasks"), anti-patterns, and a decision-index
("where decisions live"). Per design spec
docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md §5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Root README — pointer to AGENTS.md

**Files:**
- Modify: `README.md`

Single header-block patch.

- [ ] **Step 1: Confirm current state**

```bash
head -5 README.md
```

Expected output:

```
# rntme

[![CI](https://github.com/vladprrs/rntme/actions/workflows/ci.yml/badge.svg)](https://github.com/vladprrs/rntme/actions/workflows/ci.yml)

A typed, declarative **CQRS / Event-Sourced** backend-authoring toolkit. ...
```

- [ ] **Step 2: Insert pointer block via Edit**

Use the `Edit` tool with:

```
old_string:
# rntme

[![CI](https://github.com/vladprrs/rntme/actions/workflows/ci.yml/badge.svg)](https://github.com/vladprrs/rntme/actions/workflows/ci.yml)

new_string:
# rntme

[![CI](https://github.com/vladprrs/rntme/actions/workflows/ci.yml/badge.svg)](https://github.com/vladprrs/rntme/actions/workflows/ci.yml)

> **Coding agents:** start with [`AGENTS.md`](AGENTS.md), not this file.
> It contains the project map, conventions, and task-indexed pointers.
```

- [ ] **Step 3: Verify the patch**

```bash
head -8 README.md
grep -c 'AGENTS.md' README.md  # expect ≥ 1
```

Expected: pointer block visible immediately after the CI badge; reference count ≥ 1.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: root README — link to AGENTS.md

One-block pointer at the top so coding agents land on the
research map first. Spec:
docs/superpowers/specs/2026-04-17-readme-for-coding-agents-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final paranoia pass and PR

**Files:** none modified.

This task verifies the documentation work didn't accidentally break anything (it shouldn't — no code touched) and opens the PR.

- [ ] **Step 1: Build, typecheck, test, lint at the workspace root**

```bash
pnpm install --frozen-lockfile
pnpm -r run build
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
```

Expected: all four commands exit 0. If any fails, the failure is unrelated to this PR (no code was touched) but must still be fixed or escalated before opening the PR.

- [ ] **Step 2: Check commit history**

```bash
git log --oneline main..HEAD
```

Expected: 10 commits (Tasks 1–10), one per task, all `docs:`-prefixed.

- [ ] **Step 3: Confirm PR-relevant file inventory**

```bash
git diff --name-only main..HEAD
```

Expected list (14 files):
```
AGENTS.md
README.md
demo/issue-tracker-api/README.md
packages/bindings-http/README.md
packages/bindings/README.md
packages/event-store/README.md
packages/graph-ir-compiler/README.md
packages/pdm/README.md
packages/projection-consumer/README.md
packages/qsm/README.md
packages/runtime/README.md
packages/seed/README.md
packages/ui-runtime/README.md
packages/ui/README.md
```

If files are missing or extras appear, investigate before pushing.

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin HEAD
gh pr create --title "docs: agent-friendly READMEs and project AGENTS.md" --body "$(cat <<'EOF'
## Summary

- Restructure all 11 existing READMEs to a uniform agent-friendly template (file map, invariants & gotchas, where to look first, out of scope).
- Create READMEs for `packages/ui` and `packages/ui-runtime`.
- Add `AGENTS.md` at the repo root: project map, conventions (`Result<T>`, branded types, error codes, SQLite target), build/test commands, task-indexed pointers, anti-patterns, decision index.
- Add a one-block pointer in the root `README.md` so agents land on `AGENTS.md` first.

## Why

The context window is the only lever for coding-agent output quality (ace-fca). Today's READMEs are factual but miss agent affordances: no per-package file map, no documented invariants, no task-indexed entry points, no project-level navigation. This PR closes those gaps without changing any code.

## Test plan

- [x] `pnpm -r run build` passes
- [x] `pnpm -r run typecheck` passes
- [x] `pnpm -r run test` passes
- [x] `pnpm -r run lint` passes
- [x] All file-map sections match `ls -R src/`
- [x] All spec links resolve

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Capture PR URL and report**

The `gh pr create` command prints the PR URL. Report it back to the user as the final output.

---

## Self-review notes

**Spec coverage:** Each artifact in spec §3 has a task: foundation (T1), derived (T2), graph-ir (T3), projection-consumer (T4), bindings-http (T5), UI new (T6), runtime (T7), demo (T8), AGENTS.md (T9), root README (T10). Final pass T11. Total 14 README artifacts × 10 commits + 1 paranoia commit-free task = matches spec §7.

**Placeholder scan:** Each task has explicit subagent prompts, exact verification commands, and exact commit messages. No "TBD" / "implement later" / "fill in details". Where the AGENTS.md §6 entries can't be filled (e.g., 6.4 driver), the task explicitly instructs to write "No precedent in the codebase" rather than leaving blank.

**Type consistency:** No types defined; documentation only.

**Order assumption:** Tasks 1–8 are independent in their content (each touches different files). They could be reordered. Task 9 (AGENTS.md) requires Tasks 1–8 done. Task 10 (root README) is independent but kept last to follow Task 9 chronologically. Task 11 must be last.
