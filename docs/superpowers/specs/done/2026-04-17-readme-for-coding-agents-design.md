# Design — READMEs and `AGENTS.md` for coding agents

**Status:** draft (awaiting implementation)
**Date:** 2026-04-17
**Reference:** [`humanlayer/advanced-context-engineering-for-coding-agents`](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md) (ace-fca)

## 1. Motivation

The article in the reference establishes three principles that drive this design:

1. **The context window is the only lever for output quality.** What an agent reads decides what it can produce.
2. **Hierarchy of context damage:** *incorrect information > missing information > excessive noise*. Wrong facts are worse than gaps; gaps are worse than verbosity.
3. **Specs become source-of-truth artifacts.** Agents work better when they read concise distilled documents than when they explore code through search.

Today the rntme repository has 11 `README.md` files (1 root, 9 packages, 1 demo). They are factual and well-structured for human readers, but they miss agent-specific affordances:

- No file-by-file map inside each package — the agent burns calls on `Glob`/`Grep` to find where a rule lives.
- No "invariants & gotchas" section — hard-learned rules live only in commit messages and in author memory (e.g., the `predicate_optional` SQL `?` misalignment, captured in auto-memory).
- No task-indexed entry points — when given a task, the agent infers the entry file from the package layout.
- No project-level navigation document — repo-wide conventions (`Result<T>`, branded types, error-code naming, SQLite-only target) are derivable only from reading source.
- Two packages (`packages/ui`, `packages/ui-runtime`) have no README at all.

This design closes those gaps without breaking the human-facing role of the existing READMEs.

## 2. Scope

**In scope:**
- Create `AGENTS.md` at the repo root.
- Patch root `README.md` with a one-block pointer to `AGENTS.md`.
- Rewrite all 11 existing per-package and demo READMEs against the template in §4.
- Create READMEs for `packages/ui` and `packages/ui-runtime`.

**Out of scope:**
- Modifying any code in `packages/*/src/`.
- Modifying any spec in `docs/superpowers/specs/` (existing specs are referenced, not rewritten).
- Creating a separate `CLAUDE.md` (`AGENTS.md` is the single agent-facing entry point).
- Changelog or migration-guide artifacts.
- Non-ASCII diagrams (Mermaid, images) — keep rendering dependency-free.

## 3. Artifacts

| Path | Action | Size target |
|---|---|---|
| `AGENTS.md` (root) | Create — research map | 300–450 lines |
| `README.md` (root) | Patch — header pointer to `AGENTS.md` | +5 lines |
| `packages/pdm/README.md` | Rewrite to template | 250–350 lines |
| `packages/qsm/README.md` | Rewrite to template | 250–350 lines |
| `packages/event-store/README.md` | Rewrite to template | 200–300 lines |
| `packages/graph-ir-compiler/README.md` | Rewrite to template | 400–500 lines |
| `packages/bindings/README.md` | Rewrite to template | 250–350 lines |
| `packages/bindings-http/README.md` | Rewrite to template | 200–300 lines |
| `packages/projection-consumer/README.md` | Rewrite to template | 200–300 lines |
| `packages/seed/README.md` | Rewrite to template | 200–300 lines |
| `packages/runtime/README.md` | Rewrite to template | 200–300 lines |
| `packages/ui/README.md` | Create from template | 250–350 lines |
| `packages/ui-runtime/README.md` | Create from template | 200–300 lines |
| `demo/issue-tracker-api/README.md` | Rewrite to template | 250–350 lines |

**Sources of truth:**
- Domain rules: `docs/superpowers/specs/*.md` and `graph_ir_rc_7.md` (referenced, never duplicated).
- Per-package implementation: that package's `README.md`.
- Project-wide conventions and navigation: `AGENTS.md`.

**Language:** English (matches the existing codebase).

**Tone:** factual; rules and statements only; no "we", "easy", "simple", "just".

## 4. Per-package README template

Every package README follows this structure with these exact section headings (consistent headings let agents find sections via deterministic search rather than inference).

```markdown
# @rntme/<pkg>

<one-line purpose; ≤ 1 sentence>

## Role in the system

- Depends on: <@rntme/* with one-line "for what">
- Consumed by: <@rntme/* that import from me>
- Position in pipeline: <e.g., "authoring → validation → DDL emission">

## File map

Tree-style listing of `src/` with one-line purpose per file.
Files marked `(entry)` are public exports. Files marked `(internal)` are not exported.
Goal: agent picks the right file in <2 reads instead of 5 greps.

src/
  index.ts              (entry) Public API surface — re-exports.
  parse.ts              (entry) Zod-driven structural parsing.
  validate-structural.ts        Structural rules (no PDM resolver).
  validate-cross-ref.ts         Cross-ref against PDM.
  ...

## Quick start

Minimal copy-paste-runnable example.

## API

Table: Export / Signature / Purpose. (May include validation-layers and
error-code subsections where the package warrants them.)

## Invariants & gotchas

Bulleted list. Each entry is a hard-learned rule:
- "X must be Y because Z" — rules, not advice.
- Concrete pitfall examples with the failing scenario.
- Cross-references to specs/issues if useful.

## Out of scope / known limits

What this package explicitly does NOT do, with reason if non-obvious.
Prevents agents from "fixing" intentional omissions.

## Where to look first

Task-indexed pointers:
- "Add a new validation rule" → start at `src/validate-structural.ts`,
  follow the pattern of <existing rule>.
- "Add a new error code" → register in `src/errors.ts`, then update
  the README error table.
- "Debug a failing test" → tests live in `test/`, fixtures in `test/fixtures/`.

## Specs

- [`<spec path>`](relative/path.md) — authoritative §N for X.

## Glossary

Optional. Only for package-local terminology not covered by the root glossary.
```

**What changes vs today's READMEs:**
- New required sections: **File map**, **Invariants & gotchas**, **Where to look first**, **Out of scope**.
- Existing **Role / Quick start / API / Specs** sections are kept; **Validation layers** and **Error codes** become subsections of API where present.

## 5. `AGENTS.md` content

```markdown
# AGENTS.md — research map for coding agents

> Read this file first. It tells you where things live, what conventions
> govern the codebase, and how to approach common tasks. Per-package
> READMEs (`packages/*/README.md`) are the authoritative source for each
> package's internals.

## 1. Workflow expectations

- Research → Plan → Implement. Use the brainstorming/writing-plans skills.
- Specs in `docs/superpowers/specs/` are source of truth. Code that
  disagrees with a spec is a bug; do not "fix" the spec by reading the code.
- Read the per-package README before opening source files for that package.

## 2. Repository map

- `packages/`               — workspace packages (see §3 for layering)
- `demo/issue-tracker-api/` — end-to-end wiring of every package
- `docs/superpowers/specs/` — authoritative design specs
- `docs/superpowers/plans/` — per-package implementation plans
- `docs/superpowers/reports/` — gap analyses (spec vs implementation)
- `docs/adr/`, `docs/gaps/` — architectural decisions and known gaps
- `graph_ir_rc_7.md`        — Graph IR language spec (rc7)

## 3. Package layering

ASCII dependency diagram + a one-line purpose and a "read README first
when touching" pointer per package.

## 4. Project-wide conventions

- **Result<T> everywhere** — `{ ok: true; value } | { ok: false; errors }`.
  No exceptions in validation pipelines.
- **Branded `Validated*` types** — constructible only by validators.
- **Error codes** — `<PKG>_<LAYER>_<KIND>`. Stable. Append, never reorder.
- **No exceptions across package boundaries.**
- **SQLite forever** — target dialect is SQLite (≥3.30). Future scale-out
  is via Turso (SQLite-compatible Rust). Do not introduce Postgres-specific
  syntax.
- **Authoring artifacts are JSON.** Validation is layered: parse (Zod) →
  structural → cross-ref (resolver-based) → feature-gate.
- **MVP gates** — many features parse but are validator-rejected. The
  README "Out of scope" section names them per package.
- **Test categories** — unit / integration / e2e / golden. Vitest.

## 5. Build / test / lint

| Command | Effect |
| ------- | ------ |
| `pnpm install` | install deps (pnpm 9.12.0+) |
| `pnpm -r run build` | tsc per package |
| `pnpm -r run typecheck` | typecheck-only pass |
| `pnpm -r run test` | vitest in every package |
| `pnpm -r run lint` | ESLint on src + test |
| `pnpm -F @rntme/<pkg> test:watch` | watch mode for one package |
| `pnpm -F @rntme/issue-tracker-api-demo start` | start the demo |

CI runs `build → typecheck → test → lint` on push and PR to `main`.

## 6. How to do common tasks

Each subsection: one task, ordered steps, exact files to start at.

- 6.1 Add a new graph operator
- 6.2 Add a new projection backing
- 6.3 Add a new HTTP binding kind
- 6.4 Add a new event-store driver
- 6.5 Add a new field type to PDM
- 6.6 Wire a new package into the runtime
- 6.7 Add a new spec
- 6.8 Run the demo locally
- 6.9 Reproduce a failing CI test

Each subsection is roughly 6–10 lines: numbered steps, file pointers,
the spec to read first.

## 7. Anti-patterns / do not do

- Do not bypass `Validated*` brands by casting.
- Do not introduce a Postgres dialect path.
- Do not skip a validation layer "because the input is trusted".
- Do not catch and swallow errors in the Result pipeline.
- Do not create new packages without updating §3 and the root README.
- Do not edit `graph_ir_rc_7.md` to match a code bug — fix the code.
- Do not delete error codes; they are part of the API.

## 8. Where decisions live

Map of "if you're tempted to do X, the decision-doc is Y":
- "Why SQLite, not Postgres?" → memory entry + spec links.
- "Why entity-mirror only, not derived?" → mutations-design.md §6.
- "Why the four-layer validator?" → bindings-design.md §3.
- "Why no YAML?" → (decision in spec or ADR; pin location during writing).

## 9. Memory and prior decisions

Auto-memory entries can shape current work. Read `MEMORY.md` for the
current index. Memory may be stale; always re-verify against the
codebase before relying on it.

## 10. Glossary

Authoritative project-wide glossary. Per-package READMEs add only
package-local terms.
```

**Root `README.md`** is otherwise unchanged. The only patch is a header block:

```markdown
> **Coding agents:** start with [`AGENTS.md`](AGENTS.md), not this file.
> It contains the project map, conventions, and task-indexed pointers.
```

## 6. Quality controls

To prevent context-toxic content, every produced file passes these checks before commit.

**Content rules:**
1. **No duplicated authority.** If a fact lives in a spec or another README, link to it. Never copy.
2. **No soft language.** "Usually", "often", "easy", "simple", "just" — banned. Statements are rules or they are not written.
3. **File map matches reality.** Verified by `ls packages/<pkg>/src/` immediately before commit.
4. **All spec links resolve.** Each `docs/superpowers/specs/<…>` reference grep-checked against the filesystem.
5. **Quick-start snippets compile.** TypeScript blocks must pass `tsc --noEmit` against the package.
6. **Invariants & gotchas — only verified entries.** Sources allowed: specs, existing tests, auto-memory entries, "fix" commits in `git log`. No theoretical pitfalls.
7. **`Where to look first` — function/file references, not line numbers.** Lines drift; functions and filenames are stable.

**Anti-scope (explicitly not done):**
- Specs in `docs/superpowers/specs/` are not edited.
- Source files in `packages/*/src/` are not edited.
- No separate `CLAUDE.md`.
- No changelog or migration guide.
- No Mermaid or image diagrams; ASCII only.

## 7. Implementation order

One PR with logically grouped commits. Grouping reflects similarity of
content and complexity, not the package dependency graph (relative links
between READMEs work in any order).

1. `docs: per-package README — foundation packages (pdm, event-store, bindings)` — the three packages with no internal dependencies. Smallest blast radius.
2. `docs: per-package README — derived authoring (qsm, seed)` — read PDM, write artifacts; similar shape.
3. `docs: per-package README — graph-ir-compiler` — largest README; isolated commit for diff readability.
4. `docs: per-package README — projection-consumer` — read-side runner.
5. `docs: per-package README — http surface (bindings-http)`.
6. `docs: per-package README — UI layer (ui, ui-runtime)` — both created from scratch.
7. `docs: per-package README — runtime` — depends on every other package.
8. `docs: demo README — restructure as agent-readable example`.
9. `docs: AGENTS.md — repo research map for coding agents` — written last so it aggregates verified facts.
10. `docs: root README — link to AGENTS.md` — minimal header patch.

**Implementation technique:**
- Each per-package README is produced via a subagent (one package per task) given: the package's spec(s), current README, the §4 template, the §6 content rules, and the live `ls src/` listing. The subagent returns finished prose; the writer applies it via `Write`/`Edit` in the main session.
- `AGENTS.md` is written in the main session, not delegated, since it cross-references all package READMEs.
- Independent leaf packages may be processed by parallel subagents.

**Final-check pass:**
- `pnpm -r run build && pnpm -r run typecheck && pnpm -r run test` — paranoia check (no code changes are made, but verify nothing accidentally broke).
- Per-file line count vs §3 target: > +200% over target flags a review (likely spec-copying).
- Relative-link checker over all changed files.

## 8. Success criteria

A coding agent given a typical task ("add a new validator rule to QSM", "fix a failing graph-ir test", "add a new HTTP binding kind") can:
1. Read `AGENTS.md` once and identify the target package.
2. Read that package's `README.md` once and identify the entry file.
3. Begin focused reading of source code without exploratory `Glob`/`Grep` calls.

Symptom of success in a transcript: under three discovery calls before the agent opens the right source file. Symptom of failure: the agent re-derives a documented invariant by reading source.
