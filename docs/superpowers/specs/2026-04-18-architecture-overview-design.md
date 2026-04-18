# 2026-04-18 — Architecture overview document (design)

**Status:** brainstormed, pending implementation plan
**Deliverable target:** `docs/architecture.md` (new, at repo root-level `docs/`)
**Related memory:** `rntme_vision_framing`, `rntme_graph_ir_rc7_not_canon`, `project_platform_vision`

## 1. Context & motivation

rntme has accumulated twelve packages, eleven active specs, landed specs under
`docs/superpowers/specs/done/`, per-package READMEs, ADRs, and gap reports.
There is no single document that explains how the whole runtime fits together
from a "top-down" perspective, and — more importantly — why it is organized
this way.

`AGENTS.md` is a research map (task-indexed pointers). Per-package READMEs
cover internals. Specs cover decisions. None of them teaches the runtime as
an artifact-driven system. That is the gap this document fills.

The document serves two purposes simultaneously (combination A+B from the
brainstorm):

- **A.** "Entrypoint for understanding" — a newcomer (including a future
  coding agent) can read it once and have a usable mental model of every
  abstraction and every runtime flow.
- **B.** "Observations for potential refactoring" — explicit, structured
  catalogue of smells, risks, and vision-alignment issues, collected under a
  disciplined methodology (§8). Not prescriptive; purely diagnostic.

## 2. Primary framing

> **rntme is an artifact-driven runtime that boots a service from a small set
> of strictly-validated JSON artifacts (PDM, QSM, Graph IR, bindings, UI,
> seed, manifest). Its central value is enabling AI agents and humans to
> _generate_ these artifacts and have a working service.**
>
> CQRS, event-sourcing, SQLite, Turso, four-layer validators, branded
> `Validated*` types, plugin seams — are **consequences** of this goal:
> extensibility in service complexity, scale in number of services,
> migrations, and predictability for agent-driven generation.

The architecture document MUST lead with this framing. Any CQRS / ES /
storage discussion comes as rationale (why this decision serves the vision),
not as the primary identity of the system.

Source for this framing: `rntme_vision_framing` memory entry.

## 3. Audience & success criteria

**Primary audience:** the owner of the codebase (@vladprrs) — uses the
document to reason about refactoring and to frame new plans.

**Secondary audience:** future coding agents and human collaborators who
need a mental model within ~1 hour of reading.

**Success criteria** (assessed after writing):

1. A first-time reader can name the purpose of each package and trace a
   command from HTTP to projection after 60 minutes.
2. Every abstraction in the catalog (§7 of the doc) has: name, module,
   contract, invariant, construction path, spec reference.
3. Every refactoring lens (§8 of the doc) produces at least 2 concrete
   observations with `file:function` references; or explicit "no significant
   findings" as negative evidence.
4. All mermaid diagrams render correctly on GitHub.

## 4. Document outline (hybrid C4 + interleaved flows)

Single file, single `.md`. Approximate length: 1500–2200 lines. Section
numbering below is for the final document (`docs/architecture.md`), not this
spec.

```
1. Executive summary
   - Primary framing (artifact-driven runtime, agent-generable services)
   - One summary diagram: 7 artifacts → validator → runtime → running service
   - Key invariants at a glance (SQLite forever, JSON-only, Result<T>,
     Validated brands, fail-fast validation)
   - Design rationale: why each major decision (CQRS/ES, SQLite, branded
     types, plugin seams) serves vision properties

2. L1 — System Context
   - Actors: AI agent / human author (artifact authors), operator,
     end-user, SQLite / Turso, broader agent platform (future)
   - mermaid C4Context diagram

3. L2 — Containers
   - Artifact map first (7 authoring artifacts + manifest) — shows the
     authoring surface of the runtime
   - Package/container map (12 packages + plugin seams) — shows the
     runtime topology
   - Interleaved: sequence #3 (Boot & seed lifecycle)
   - Plugin seams (DbDriver, EventBus, Surface) — explicit "extension
     without artifact or code change" story

4. L3 — Components (by package, following layering order)
   Each package subsection starts with a short Spec-lineage table
   (§6 — research methodology). Then a flowchart and 2–3 sentences per
   component. Sequence diagrams are placed with the package that owns
   the flow.

   4.1 pdm                — 4-layer validator; foundational pattern
   4.2 qsm                — projections, derived DDL, relation metadata
   4.3 event-store        — EventStore interface, optimistic concurrency,
                            relay, DLQ
       · seq #6 Envelope lifecycle
   4.4 graph-ir-compiler  — parse / semantic-plan / lower / emit / execute
       · seq #5 IR → SQL
       · seq #1 Command write path (cross-package, anchored here)
       · seq #2 Query read path (cross-package, anchored here)
   4.5 projection-consumer — ApplyPlan, idempotency
   4.6 bindings & bindings-http — four-layer validator, kind × role
                            matrix, OpenAPI emission, error→HTTP status
       · seq #4 Validation pipeline (illustrated here; the pattern is
         shared with pdm/qsm/ui and cross-referenced from those sections)
   4.7 ui & ui-runtime    — compile pipeline + React SPA
       · seq #7 UI artifact compilation
   4.8 seed, db-studio, runtime — orchestration layer (shorter subsections)

5. L4 — Code
   A table of ~12 critical functions with signatures and one-line
   purpose. No code blocks; this section intentionally light, keeping
   maintainability reasonable.
   Representative functions:
   validateBindings, lowerOperator, wrapPredicateOptional, appendRaw,
   publishNext, compileApplyPlan, applyEnvelope, bootService,
   applySeed, compileBindings, emitOpenApi, compileUi.

6. Cross-cutting abstractions (catalogue)
   6.0 Foundational (validation pipeline leads)
       - Result<T>, isOk, isErr
       - Branded Validated* family
       - ERROR_CODES registry and <PKG>_<LAYER>_<KIND> format
       - The 4-layer validator as a reusable pattern
   6.1 Domain artifacts
       - Entity, Field, FieldType, Relation, StateMachine (PDM)
       - Projection, Backing, RelationMetadata (QSM)
       - Operator, SemanticPlan, LoweringRule (Graph IR)
   6.2 Runtime
       - Envelope / CloudEvents shape
       - EventStore interface + monotonic cursor
       - Relay (at-least-once)
       - DLQ
       - ApplyPlan, projection-consumer idempotency
       - Seed envelope + before-relay invariant
   6.3 HTTP / UI
       - BindingKind × Role matrix
       - BindingPlan, error→HTTP status map
       - OpenAPI 3.1 emitter
       - UI compile pipeline
   6.4 Extensibility
       - Plugin seams: DbDriver, EventBus, Surface
       - Service manifest
       - MVP gates (concept)
   6.5 Topology
       - Kafka topic convention: rntme.{svc}.{agg} (no .v1)
       - db-studio Hrana endpoint

7. Observations & refactoring candidates
   Nine lenses (§8 below). Each lens: list of findings in the template
   "[severity] path — description / why / direction / links".

8. Glossary
   Extended from AGENTS.md §10.

9. How to use and maintain this document
   - Relationship to AGENTS.md (task-index) and specs/ (decisions)
   - Update policy (any meaningful refactor bumps the relevant section)
   - Cutoff date for the initial writing (2026-04-18) — new specs after
     this date are captured in subsequent bumps, not retroactively
```

## 5. Diagram conventions

All diagrams are inline mermaid. External tooling is out of scope.

| Diagram type | Mermaid flavor | Where |
|---|---|---|
| L1 Context | `C4Context` (beta but GitHub-supported) | §2 |
| L2 Container | `C4Container` | §3 |
| L3 Component | `flowchart` with subgraph styling | §4 per package |
| L4 Code | no diagrams — signature table | §5 |
| Sequence flows (1–7) | `sequenceDiagram` | inside §3 and §4 |
| Entity / relation | `erDiagram` | §4.2 (qsm) |
| State machine | `stateDiagram-v2` | §4.1 (pdm) if needed |
| Boot-order | `flowchart LR` with groups | §3 |

Rules:

- Each diagram: ≤ 30 nodes / ≤ 10 actors. If exceeded, split.
- Each diagram is followed by 1–3 sentences naming what it shows.
- Colour palette declared once in a comment block near §1. Artifacts
  share one colour, validators another, storage a third.
- Node names match code symbols (`@rntme/graph-ir-compiler`, not
  "compiler").
- In sequence diagrams, actors are packages/containers, not functions;
  functions appear as `note over`.

## 6. Research methodology

### 6.1 Source ranking

Authority decreasing:

1. **Active specs** — `docs/superpowers/specs/` (current work).
2. **Landed specs** — `docs/superpowers/specs/done/` (historical but
   still authoritative unless superseded).
3. **Per-package READMEs** — "Where to look first", "Invariants &
   gotchas".
4. **Code** — `packages/*/src/` (used to verify README/spec claims).
5. **ADRs** — `docs/adr/`.
6. **Gap reports** — `docs/gaps/`, `docs/superpowers/reports/`.
7. **Git log / commit messages** — evidence of which spec produced which
   code, and of code-review gap-filling.
8. **Auto-memory** — non-obvious invariants (always re-verify against
   code before relying).
9. **`AGENTS.md`** — index, not source.
10. **`graph_ir_rc_7.md`** — historical context for Graph IR; **not
    canon** (see `rntme_graph_ir_rc7_not_canon` memory). Use to fill
    gaps not covered by later IR specs.

### 6.2 Spec lineage (required subsection per package in §4)

Before writing any L3 package subsection, build a table:

| Spec | Date | Status | What it added/changed |
|---|---|---|---|
| … | … | landed / in-flight | … |

Sources: `git log packages/<pkg>/`, README "Specs" section, gap reports.

This table is the first content inside each package's L3 subsection.

### 6.3 Per-package research loop

1. Build spec lineage (6.2).
2. Read README §§ "File map", "Invariants & gotchas", "Where to look
   first".
3. Read `src/index.ts` and the directories named in "Where to look
   first".
4. Produce the L3 flowchart and 2–3 sentences per component.
5. Reference files as `packages/<pkg>/src/…` (no line numbers — they
   drift).

### 6.4 Divergence rules (revised)

- Code matches the latest relevant spec → OK.
- Code disagrees with the latest relevant spec, behaviour seems
  intentional and covered by tests → observation "possible spec bump /
  possible bug" (§8, usually minor).
- Code disagrees with the latest spec, no tests cover the disagreement
  → observation "bug: behaviour does not match spec, no regression
  guard" (§8, major).
- Code is not covered by any spec but is test-covered → observation
  "undocumented extension" (§8, lens 7.8).
- Latest spec is still in `specs/` (not `done/`) → label "in-flight"
  and lower priority.

### 6.5 Abstraction / observation data gathering

- Abstractions catalog (§6 of doc): grep `ERROR_CODES` in each package,
  list all `Validated*` brands and `src/types/` files.
- Size smells: `find packages/*/src -name '*.ts' | xargs wc -l`,
  threshold > 500 lines for files; function length ≥ 80 by inspection
  on top candidates.
- Dependency smells: inspect each `package.json` and import graph; verify
  against AGENTS.md §3 layering.
- Conceptual duplication, naming inconsistencies, undocumented extensions
  — manual review.
- Known bugs — direct from auto-memory with links to regression tests.

### 6.6 Anti-pattern to avoid

Do NOT analyse "from a blank slate reading the code alone and ignoring
specs". Specs are authoritative. If the code seems to improve on the
spec, that is still an observation in §8 — not an unrecorded
improvement.

## 7. Abstractions catalog structure (§6 of doc)

Fixed record template per entry:

```markdown
### <Name>
- **Package / module:** `packages/<pkg>/src/<path>`
- **Purpose:** one sentence
- **Contract:** signature or structure (copy from types file)
- **Constructed by:** who creates instances and when
- **Invariant:** what must hold; what must not be broken
- **How to violate:** link to AGENTS.md §7 anti-patterns if applicable
- **Spec(s):** canonical spec link, or "not covered by spec"
- **Related:** 1–3 related abstractions
```

Grouping follows §4 outline's subcategories 6.0–6.5 (Foundational,
Domain, Runtime, HTTP/UI, Extensibility, Topology).

Excluded from the catalog:

- Local internal types of a single function.
- Test helpers.
- Re-exports.

Estimated entry count: ~25.

## 8. Observations methodology (§7 of doc)

### 8.1 Finding template

```markdown
- **[severity]** `packages/<pkg>/src/<file>` — short description
  - **Why it is a smell:** one sentence
  - **Possible direction:** one sentence (hypothesis only, not a plan)
  - **Links:** spec(s), ADR, related observations
```

Severity levels:

- `major` — breaks an invariant, creates risk (Result violations,
  layering violations).
- `minor` — harms readability / maintainability (naming, size).
- `info` — a recorded fact, not necessarily actionable (MVP gates,
  known bugs).

### 8.2 Lenses

| # | Lens | Collection method | Expected findings |
|---|---|---|---|
| 7.1 | Size smells | `wc -l`, function-level manual scan of top 10 | 5–15 |
| 7.2 | Dependency smells | `package.json` review + import graph scan vs AGENTS.md §3 | 3–8 |
| 7.3 | Conceptual duplication | manual diff of 4-layer validator implementations across pdm/qsm/bindings/ui | 3–5 |
| 7.4 | Brand / Result violations | `grep -rn 'as Validated' packages/*/src`; try/catch across package boundaries | 2–5 |
| 7.5 | MVP gates inventory | README "Out of scope" per package | 10–20 (mostly `info`) |
| 7.6 | Naming inconsistencies | glossary review + grep of suspect terms | 3–6 |
| 7.7 | Known bugs from memory | direct copy from auto-memory, with regression-test links | ~2 |
| 7.8 | Undocumented extensions | diff of "last relevant specs per package" against "what the code does" | 3–8 |
| 7.9 | Vision alignment | six sub-probes: agent-generability, validation tightness, implementation leakage, brand integrity, extensibility vs hardcoding, scale properties | 5–10 |

### 8.3 Rules

- Every finding must reference a concrete place (`file:function`). No
  abstract remarks.
- §7 of the doc is **diagnostic, not prescriptive.** Do not propose
  solutions; that belongs to a follow-up plan.
- If a lens returns < 2 findings, record "reviewed, no significant
  smells" — negative evidence matters.
- Within each lens, sort findings major → minor → info.

### 8.4 Dedicated observation (must appear in the doc)

`AGENTS.md` §2 and §7 describe `graph_ir_rc_7.md` as "authoritative"
and "canon". `CLAUDE.md` repeats this. Per
`rntme_graph_ir_rc7_not_canon` memory, this is stale — rc7 was a
first step, not canon. Record as a §7.8 / §7.6 finding (stale doctrine
in meta-docs). Fixing `AGENTS.md` is a separate task.

## 9. Implementation approach

The document is written in its natural order, with a review checkpoint
after each major block and a git commit per checkpoint.

1. Skeleton + §1 Executive summary + §2 L1 Context → review
2. §3 L2 Containers + seq #3 (Boot & seed) → review
3. §4 L3 Components, package by package in layering order. Sequence
   diagrams appear with the package that owns them. Review every 3–4
   packages.
4. §5 L4 Code table → review
5. §6 Abstractions catalog → review
6. §7 Observations (nine lenses) → dedicated review (most time-sensitive
   block)
7. §8 Glossary + §9 How to use → final review

Review guidance: the user reviews **the block just written**, not the
whole document. A 1500+ line document cannot be reviewed in one pass.

## 10. Out of scope

- Rewriting per-package READMEs.
- Updating `AGENTS.md` (findings about it are observations; edits are a
  separate task).
- Rewriting `graph_ir_rc_7.md`. It is historical material, not canon,
  but revising it is its own task.
- Producing a plan or task list for refactoring. §7 of the doc is
  diagnosis; planning comes later.
- External diagramming tools (Structurizr, PlantUML). Inline mermaid
  only.
- Platform vision (Zeebe, gRPC, viz layer) — lives at a higher level.
- Performance analysis.

## 11. Risks & mitigations

1. **Staleness.** The document becomes out of date quickly without a
   maintenance policy. *Mitigation:* §9 of the doc sets an update rule —
   any meaningful refactor bumps the relevant section.
2. **Pretty but useless.** If the document duplicates READMEs, it wastes
   space. *Mitigation:* §7 (observations, including vision-alignment)
   provides unique value that exists nowhere else.
3. **L4 code section drifting toward duplicating code.** *Mitigation:*
   hard limit ~12–15 functions, table format with short signatures only,
   no code blocks.
4. **Spec drift during writing.** New specs may appear before the
   document finishes. *Mitigation:* fix a cutoff date (2026-04-18) in
   the document; later specs are absorbed in subsequent bumps.

## 12. Open questions

- None at brainstorm time. Vision-alignment lens (7.9) is the
  highest-risk section to land well — to be treated as a separate review
  checkpoint during writing.

## 13. References

- `AGENTS.md` — research map (needs post-write update per §8.4).
- `CLAUDE.md` — repeats AGENTS.md top-level conventions.
- Per-package READMEs under `packages/*/README.md`.
- Memory entries: `rntme_vision_framing`, `rntme_graph_ir_rc7_not_canon`,
  `project_platform_vision`, `rntme_turso_target`,
  `rntme_topic_no_version_suffix`, `rntme_predicate_optional_bug`.
