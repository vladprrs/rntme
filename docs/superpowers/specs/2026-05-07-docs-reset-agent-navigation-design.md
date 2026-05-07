# Docs reset and agent navigation — design

> Status: design.
> Scope: rewrite the repository documentation entry points after
> `docs/decision-system.md` landed. This spec deletes the stale architecture
> overview, makes `README.md` a short user-facing landing page, makes
> `AGENTS.md` a compact agent navigation file, and shrinks `CLAUDE.md` to a
> compatibility bootstrap.
> Non-goals: changing runtime/package code; changing package README internals;
> building documentation tooling; rewriting historical specs/plans/ADRs.

## 1. Problem

The current documentation asks agents and humans to load too many stale or
duplicated surfaces before they can act:

- `docs/architecture.md` is a long C4 snapshot with a cutoff date. It rots
  immediately because the package graph, deploy flow, modules, and runtime
  seams keep moving.
- `README.md` currently mixes product positioning, package inventory,
  architecture diagrams, dependency graph, long spec index, MVP inventory,
  glossary, and developer commands. It is not a sharp user-facing landing
  page.
- `AGENTS.md` is over 1100 lines. It mixes navigation, package descriptions,
  how-to recipes, conventions, decision links, glossary, and doc-maintenance
  policy. This is expensive for agents to load and still fragile because many
  links describe historical state.
- `CLAUDE.md` duplicates architecture and convention material that now belongs
  in `AGENTS.md` or `docs/decision-system.md`.
- The old rule "specs are source of truth; code that disagrees is a bug" is
  too broad. Specs are valuable when designing a change and explaining why a
  decision was made, but they become stale as current-state documentation.

This hurts the goal from `docs/decision-system.md`: AI agents should author
and maintain the system efficiently, while humans decide. Agent context should
prefer compact, current, high-leverage files over long historical documents.

## 2. Goals

After this change:

1. `README.md` is a concise user-facing landing page that sells the idea,
   asks the reader to star/try the project, and gives a short CLI-first path.
2. `AGENTS.md` is the primary machine-facing entry point and targets
   approximately 3000 tokens.
3. `CLAUDE.md` is a thin compatibility entry point for Claude Code.
4. `docs/architecture.md` is deleted.
5. References to the deleted architecture doc are removed.
6. Specs/plans are reclassified as design-time rationale and execution
   artifacts, not permanent current-state truth.
7. Current-state lookup is explicit: decisions from `docs/decision-system.md`,
   package internals from per-package READMEs and code/tests, dependency rules
   from `.dependency-cruiser.cjs`.

## 3. Decisions

| Q | Decision |
|---|---|
| What style of reset? | Full docs reset. Rewrite `README.md`, `AGENTS.md`, and `CLAUDE.md`; delete `docs/architecture.md`. |
| What is `README.md` for? | User-facing landing page. It should sell the project, not explain the whole repo. |
| What is `AGENTS.md` for? | Agent bootstrap: read order, repo map, package lookup, commands, workflow, layering, doc-touch evaluation. |
| What is `CLAUDE.md` for? | Compatibility pointer for Claude Code: read `AGENTS.md`, read decision-system before decisions, use listed commands. |
| Where does current architecture live? | In code/tests, package READMEs, `.dependency-cruiser.cjs`, and `docs/decision-system.md`, not in one large markdown diagram. |
| What are specs/plans? | Historical rationale and design/execution artifacts. They can update decisions, but old specs are not automatically current-state truth. |
| Do we add tooling now? | No. This is a docs reset; validation is via review and stale-reference search. |

## 4. Documentation roles

The new source-of-truth split is:

- `README.md` — user-facing landing page: what rntme is, why it matters, how
  to try it through the CLI, license, and a one-line agent pointer.
- `AGENTS.md` — machine-facing navigation: where to look, what to read before
  source files, commands, dependency/layering rules, and doc-touch policy.
- `CLAUDE.md` — Claude Code bootstrap only. It must not duplicate architecture
  or convention prose.
- `docs/decision-system.md` — canonical strategic/architectural/convention
  decisions and update protocol.
- Per-package `README.md` files — current package internals, APIs, invariants,
  gotchas, and package-specific "where to look first" pointers.
- `.dependency-cruiser.cjs` — current enforced dependency/layering rules.
- `docs/superpowers/specs/`, `docs/superpowers/plans/`, `docs/adr/` —
  rationale/history: why something was designed or implemented that way at
  the time.
- Code and tests — final authority for current executable behavior, checked
  against decisions and package README claims.

This intentionally removes the old broad claim that every spec is permanently
the source of truth.

## 5. README design

`README.md` should be short and written for a user who is deciding whether to
star and try the project.

Required shape:

1. `# rntme`, hero image if still useful, CI/license badges.
2. One-line positioning: open runtime for AI-generated business apps.
3. A compact value proposition:
   - agents author project blueprints;
   - rntme validates and runs them;
   - business apps stay repeatable across iterations;
   - BPMN workflows and vendor modules are standard boundaries;
   - Apache 2.0, no commercial split.
4. A direct call to action: star the repo and try the CLI.
5. CLI-first try-it section. Preferred public path:

   ```bash
   npm install -g @rntme/cli
   rntme init my-app
   cd my-app
   rntme dev
   ```

   Implementation must verify the current CLI surface in `apps/cli/README.md`
   and `apps/cli/src/**` before promising commands. If `init`/`dev` do not
   exist yet, the README must not invent them; it should use the real current
   CLI path or mark the CLI-first quick start as coming soon and point to the
   current runnable demo/test path.
6. Exactly one agent pointer line:

   ```markdown
   Agents: read [`AGENTS.md`](AGENTS.md) before touching the codebase.
   ```

7. License line.

Remove from README:

- architecture deep-dive link;
- architecture diagram;
- package table;
- dependency graph;
- long developer command table;
- design docs/spec index;
- MVP/Tier 1 inventory;
- glossary.

## 6. AGENTS.md design

`AGENTS.md` should be small enough to load at the start of a coding session.
Target: approximately 3000 tokens; as a practical review proxy, keep it under
about 2200 English words unless a concrete need justifies more.

Required sections:

1. **Read order**
   - Read `docs/decision-system.md` for strategic/architectural/convention
     decisions.
   - Read the relevant package README before opening source files in that
     package.
   - Use code/tests for current executable behavior.
   - Use specs/plans/ADRs as rationale/history, not automatic truth.
2. **Repo map**
   - Top-level folders only: `apps/`, `packages/`, `modules/`, `demo/`,
     `docs/`.
3. **Package lookup**
   - Compact grouped table mapping package/module names to README paths.
   - No long prose descriptions; the README path is the handoff.
4. **Workflow**
   - Research -> plan -> implement for non-trivial work.
   - Use brainstorming/writing-plans when designing changes.
   - Every plan includes doc-touch evaluation, even when the result is
     "no docs need updating".
5. **Commands**
   - Install, build, typecheck, test, lint, dependency-cruiser, vendor check,
     package-specific test.
6. **Layering**
   - Summarize enforced dependency-cruiser rules and point to
     `.dependency-cruiser.cjs` as the authority.
7. **Navigation recipes**
   - Short "for X, start at Y" pointers, not step-by-step how-tos that rot.
8. **Do not do**
   - Only high-signal damage-prevention rules: do not bypass `Validated*`,
     do not introduce unsupported dialect paths, do not skip validation
     layers, do not delete/reorder error codes, do not invent authoring
     formats, do not rely on stale specs without checking current code.
9. **Docs touch**
   - Short checklist: package README, AGENTS, README, CLAUDE,
     decision-system. `docs/architecture.md` is gone.

Remove from AGENTS:

- long package purpose prose;
- ASCII dependency diagram;
- long how-to recipes with inline examples;
- long decision/spec map;
- memory catalogue;
- long glossary;
- references to `docs/architecture.md`.

## 7. CLAUDE.md design

`CLAUDE.md` should become a thin bootstrap:

- read `AGENTS.md` first;
- read `docs/decision-system.md` before strategic/architectural/convention
  decisions;
- commands table;
- note that package READMEs own package internals.

Remove:

- product positioning duplicate;
- architecture paragraph;
- duplicated non-obvious conventions list;
- stale references to `docs/architecture.md`;
- old "specs are source of truth" wording.

## 8. Delete docs/architecture.md

Delete `docs/architecture.md` instead of refreshing it.

Rationale:

- It is explicitly cutoff-based and therefore stale by construction.
- The current dependency graph is better derived from package manifests and
  `.dependency-cruiser.cjs`.
- Package internals change too quickly for one central C4 document to remain
  useful.
- Architectural decisions now have a smaller canonical home:
  `docs/decision-system.md`.
- Humans should inspect runtime behavior through product/observability
  surfaces over time, not by reading a long markdown snapshot.

Any live reference to `docs/architecture.md` should be deleted or redirected
to `AGENTS.md`, `docs/decision-system.md`, package READMEs, or
`.dependency-cruiser.cjs` depending on the question.

## 9. Specs and plans policy

New policy:

- Specs are design-time rationale.
- Plans are execution traces.
- ADRs are historical analysis artifacts unless promoted into
  `docs/decision-system.md`.
- Current behavior is verified from code/tests plus the relevant package
  README.
- Current strategic/architectural/convention decisions live in
  `docs/decision-system.md`.
- When a new spec changes a decision, it includes a
  `Decision-system updates` section and lands the corresponding edit to
  `docs/decision-system.md` in the same PR.
- Old specs may answer "why was this chosen at the time?" They should not be
  used as the sole reason to change code before checking current code/tests
  and decision-system.
- `README.md` and `AGENTS.md` should avoid long individual spec lists.
  Prefer directory-level pointers or package README "rationale/history"
  sections where a specific link is genuinely useful.

## 10. Migration steps

1. Rewrite `README.md` to the landing-page shape in §5.
2. Rewrite `AGENTS.md` to the compact agent-navigation shape in §6.
3. Rewrite `CLAUDE.md` to the bootstrap shape in §7.
4. Delete `docs/architecture.md`.
5. Search for stale references:

   ```bash
   rg "docs/architecture.md|architecture.md"
   ```

6. Remove or redirect live stale references.
7. Verify README does not include the removed long sections.
8. Verify AGENTS is under the target size.

## 11. Verification

Docs-only verification:

- `rg "docs/architecture.md|architecture.md"` returns no live stale
  references, except this spec if it is still active.
- `README.md` contains no package table, dependency graph, architecture
  diagram, long spec index, MVP inventory, or glossary.
- `README.md` has a CLI-first try-it path based on the real current CLI
  surface.
- `AGENTS.md` is compact enough to load at session start.
- `CLAUDE.md` has no duplicated architecture/convention blocks.
- Git diff shows no package/runtime source changes.

Full CI is not required for this docs-only reset unless implementation edits
code/config. If only markdown is changed, stale-reference search and review are
the relevant checks.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| README promises CLI commands that do not exist. | Verify `apps/cli` before writing the quick start; use only real commands or clearly mark missing CLI path. |
| AGENTS becomes too terse to navigate. | Keep a compact package lookup table and "for X, start at Y" pointers. The handoff is to package READMEs. |
| Agents lose historical rationale after long spec lists are removed. | Point to spec directories and package README rationale links; use `rg` by topic when rationale is needed. |
| Decision drift moves from specs into code. | Decision-level changes must update `docs/decision-system.md` through its update protocol. |
| Architecture overview deletion removes useful diagrams. | Current graph is enforced by dependency-cruiser and package manifests; if a diagram is needed later, generate it from current data rather than maintain a stale snapshot. |

## 13. Acceptance criteria

1. `README.md` is rewritten as a short user-facing landing page with CLI-first
   try-it guidance and a one-line agent pointer.
2. `AGENTS.md` is rewritten as a compact agent bootstrap targeting ~3000
   tokens.
3. `CLAUDE.md` is rewritten as a thin compatibility entrypoint.
4. `docs/architecture.md` is deleted.
5. Live references to `docs/architecture.md` are removed.
6. Old wording that treats specs as permanent source of truth is removed from
   `README.md`, `AGENTS.md`, and `CLAUDE.md`.
7. Verification from §11 passes.

## 14. Decision-system updates

No update to `docs/decision-system.md` is required by this spec. The docs reset
applies existing goals and filters, especially G2 (AI agents author, humans
decide), G5 (minimize entropy), F2 (canonical-way check), and F5
(LLM-authorability check).
