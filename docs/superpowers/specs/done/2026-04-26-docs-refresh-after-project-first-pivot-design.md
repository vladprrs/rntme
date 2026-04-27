# Documentation refresh after project-first pivot — design

> Status: design (brainstorming complete). Use as input for `writing-plans`.
> Scope: top-level docs + affected per-package READMEs + submodule docs.
> Non-goals: refactoring the demo, restructuring the landing app, drafting a new ADR.

## 1. Problem

`docs/architecture.md` was written **2026-04-18** (PR 8). After it merged, six concept-level layers landed in the codebase across PR 9-16:

| PR | Date | Layer |
| --- | --- | --- |
| 9   | 2026-04-19 | `rntme-cli/` private submodule + `@rntme-cli/cli` skeleton |
| 10  | 2026-04-19 | Platform API errata-01 + errata-02 (submodule bumps) |
| 11  | 2026-04-20 | Platform commands + skills pack (submodule bump) |
| 12  | 2026-04-23 | Platform-modules-integration: `@rntme/bindings-grpc`, `@rntme/module-skeleton`, `CommandExecutor`/`QueryExecutor` seam, `manifest.modules[]`, `manifest.surface.grpc`, pre-fetch middleware (`pre[]`), `IdempotencyCache` (24h TTL), callback bindings (GET + 302), `ResponseShape`, `InputSource`, `ProtoRegistry`, `GrpcAdapterClient`, `CircuitBreaker`, `withRetry` |
| 13  | 2026-04-23 | `@rntme/blueprint` Track A: `project.json`, project-level PDM, entity-per-file PDM dir loader, projection-per-file QSM dir loader |
| 14-15 | 2026-04-24 | Blueprint Track B: project routes/middleware validation, service artifact discovery, service member validation, project-routed binding registry, qualified service binding refs in UI |
| 16  | 2026-04-24 | `@rntme-cli/deploy-core` + `@rntme-cli/deploy-dokploy` wired into the workspace |

Across these PRs, the canonical authoring/versioning/deploy unit shifted from "one service" to **the project blueprint folder** (`docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md` Q1, Q3).

The top-level docs have not absorbed this. Symptoms today:

- `CLAUDE.md` "Architecture in one paragraph" still describes "seven JSON artifacts (PDM, QSM, Graph IR, bindings, UI, seed, manifest)" with `demo/issue-tracker-api` as the canonical example. No mention of `blueprint`, `bindings-grpc`, `module-skeleton`, modules, pre-fetch, callback bindings, executor seams, deploy pipeline.
- `README.md` hero + "Under the hood" + "Architecture at a glance" still position **validated service blueprint** as the bounded authoring object and **seven artifacts** as the internal pipeline. `README.md:144` carries the caveat *"`@rntme/blueprint` ... is not yet wired into `@rntme/runtime`"* — partially true (Track B compiles a project-routed binding registry; runtime intake still deferred), but the framing under-states the actual landed scope.
- `AGENTS.md §3` ASCII dependency diagram is missing `@rntme/bindings-grpc`, `@rntme/module-skeleton`, `@rntme-cli/deploy-core`, `@rntme-cli/deploy-dokploy` (those packages are listed in the §3 prose). §6 has no how-to for "compose a multi-service project" or "deploy a project". §10 glossary lacks project-first vocabulary.
- `docs/architecture.md` (1592 lines, 18 mermaid diagrams) is a **2026-04-18 snapshot**. §1 executive summary, §3 containers, §4 components, §6 abstractions catalogue, §8 glossary all reflect a pre-PR-12 view.
- `vision.md` (market-facing) repeats "validated service blueprint" in five places and explicitly footnotes *"the artifact pipeline is the compiler IR, not the authoring UX"* — that footnote stays valid, but the bounded-object label needs to track the canonical-unit shift.
- `rntme-cli/README.md` lists six workspace members but `apps/landing/` (the rntme.com landing, post-PR-9) is not among them. Per-package READMEs in the submodule for `cli` and `platform-http` are stale relative to platform UI + WorkOS auto-refresh changes.
- Per-package READMEs in main repo for `pdm`, `qsm`, `ui`, `runtime`, `bindings`, `bindings-http` lack coverage of post-PR-12 surface changes.

The risk: an agent starting from `CLAUDE.md` or `architecture.md` builds a mental model that already disagrees with the codebase. The spec rule ("specs are source of truth — code that disagrees is a bug") inverts when the docs themselves drift this far.

## 2. Goal

After this refresh:

1. The canonical authoring/versioning/deploy unit in **all** docs (internal and market-facing) is the **validated project blueprint folder**.
2. The "seven artifacts" framing is retained in service-level documentation as a service-level primitive, not as the top of the stack.
3. The 16-package container view is consistent across `AGENTS.md §3`, `README.md` packages-table/dep-graph, and `docs/architecture.md §3.2`.
4. New cross-cutting abstractions from PR 12 (executor seams, idempotency cache, pre-fetch, callback bindings, gRPC surface) appear in `architecture.md §6`.
5. `demo/issue-tracker-api` carries a deprecation banner and is no longer presented as the canonical example for the project-first model.
6. The submodule docs (`rntme-cli/README.md`, affected per-package READMEs) reflect the post-PR-9 workspace state.

## 3. Catalog of post-baseline changes (input for the audit)

(See §1 table.) The catalog is the authoritative input list — every doc edit prescribed in §6 traces back to one of those PRs.

## 4. Decisions

| Q | Question | Decision |
| --- | --- | --- |
| Q1 | Temporal scope | Everything that drifted after `docs/architecture.md` baseline (2026-04-18). Includes submodule changes. |
| Q2 | Mental model | **Project-first canonical** in both internal and market-facing framings. "Seven artifacts" become service-level primitives, not the top of the stack. Hero "safe runtime for AI-generated business workflow apps" is retained. |
| Q3 | `architecture.md` treatment | Section-level rewrite. §1, §3, §8 rewritten in full. §4, §6 — new subsections / catalog entries appended. §2, §5, §7 — point patches. No structural reorganisation of section numbering. No new diagrams where existing ones still hold. |
| Q4 | Per-package README depth | Triage prescription: bullet-list of "what should appear" per affected package. Exact wording is left to the executor of the writing-plans output, who must respect the existing per-package README template (File map / Quick start / API / Invariants / Out of scope / Where to look first / Specs). |
| Q5 | Demo treatment | `demo/issue-tracker-api` stays single-service; not refactored. A deprecation banner is added in three places (see §6.8). |
| Q6 | Landing treatment | Terminology check only — sweep `rntme-cli/apps/landing/` for "validated service blueprint" / "seven artifacts" wording, replace where it occurs. No structural or design changes. |
| Q7 | New ADR | None. The project-first pivot is already captured in `docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md`. The deployment pipeline is captured in `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md`. AGENTS.md §8 already links to both. |
| Q8 | Backward compatibility | None required. rntme is pre-revenue, no users; renames and removals are free (per memory `project_pre_stable_stage`, 2026-04-23). |

## 5. Audit table

Drift severity: **H** = high (whole framing wrong); **M** = medium (specific sections stale); **L** = low (single-line drift); **N** = new (verify-only).

| File | Severity | Summary | Target action |
| --- | --- | --- | --- |
| `CLAUDE.md` | H | Architecture-in-one-paragraph + Product-positioning both reflect pre-PR-12 model | Rewrite both sections (§6.1) |
| `README.md` | H | Hero, Under-the-hood, Architecture-at-a-glance, dep-graph caveat | Rewrite hero + under-the-hood + main mermaid; update dep-graph caveat (§6.2) |
| `AGENTS.md` | M | §3 diagram drift, §6 missing how-tos, §10 glossary gaps | Patch §3 diagram, add §6.15-6.16, expand §10 (§6.3) |
| `docs/architecture.md` | H | 2026-04-18 snapshot, 6 layers missing | Section-level rewrite per Q3 (§6.4) |
| `vision.md` | M | "Validated service blueprint" in 5 places; footnote on framing valid but bounded-object label needs the shift | Replace label everywhere; update footnote; add deploy-pipeline mention (§6.5) |
| `packages/blueprint/README.md` | N | New (PR 13) | Verify completeness against template (§6.6) |
| `packages/bindings-grpc/README.md` | N | New (PR 12) | Verify completeness (§6.6) |
| `packages/module-skeleton/README.md` | N | New (PR 12) | Verify completeness (§6.6) |
| `packages/pdm/README.md` | M | Project entity ownership + entity-per-file dir loader missing | Add bullets (§6.6) |
| `packages/qsm/README.md` | M | Projection-per-file dir loader + project composition refs missing | Add bullets (§6.6) |
| `packages/ui/README.md` | M | Binding-map validation boundary + project-routed refs | Add bullets (§6.6) |
| `packages/runtime/README.md` | M | Executor seams, modules, idempotency, gRPC surface, pre-fetch boot | Add bullets (§6.6) |
| `packages/bindings/README.md` | M | `pre[]`, `inputFrom`, `ResponseShape`, callback bindings, `allowedRedirectHosts` | Add bullets (§6.6) |
| `packages/bindings-http/README.md` | M | IdempotencyCache, render-response, runPreSteps, callback wiring | Add bullets (§6.6) |
| `packages/graph-ir-compiler/README.md` | L | Executor seam reference | One line (§6.6) |
| `packages/event-store/README.md` | — | No changes since 2026-04-17 cloudevents work | Skip |
| `packages/projection-consumer/README.md` | — | Unchanged | Skip |
| `packages/seed/README.md` | — | Unchanged | Skip |
| `packages/db-studio/README.md` | — | Unchanged (PR 7 already in baseline) | Skip |
| `packages/ui-runtime/README.md` | — | Unchanged | Skip |
| `rntme-cli/README.md` | M | `apps/landing/` missing from workspace members | Add line (§6.7) |
| `rntme-cli/packages/deploy-core/README.md` | N | New (PR 16) | Verify completeness (§6.7) |
| `rntme-cli/packages/deploy-dokploy/README.md` | N | New (PR 16) | Verify completeness (§6.7) |
| `rntme-cli/packages/cli/README.md` | M | Platform commands added | Add bullets (§6.7) |
| `rntme-cli/packages/platform-http/README.md` | M | UI mount + `/v1` sub-app + WorkOS auto-refresh | Add bullets (§6.7) |
| `rntme-cli/packages/platform-core/README.md` | L | Spot-check | Verify (§6.7) |
| `rntme-cli/packages/platform-storage/README.md` | L | Spot-check | Verify (§6.7) |
| `rntme-cli/apps/landing/README.md` | L | Verify exists; terminology sweep on copy (not on README) | Verify + sweep (§6.6) |
| `demo/issue-tracker-api/README.md` | M | Add deprecation banner | Banner only (§6.8) |

## 6. Prescription per document

### 6.1 `CLAUDE.md`

#### 6.1.1 "Architecture in one paragraph" (line 43, currently "rntme is a pnpm workspace that produces a typed CQRS / event-sourced backend from seven JSON artifacts...")

Rewrite as a project-first paragraph. The new paragraph must, in order:

1. State that rntme produces an event-sourced backend from a **validated project blueprint folder** (project.json + project-level PDM + N services + modules).
2. Describe `@rntme/blueprint` first: parses `project.json`, validates project routes/middleware/PDM, discovers service artifacts, builds a project-routed binding registry.
3. Then describe service-level primitives — `@rntme/pdm` (now project-shared), `@rntme/qsm` (per-service projections), `@rntme/graph-ir-compiler`, `@rntme/event-store`, `@rntme/projection-consumer`, `@rntme/seed`, `@rntme/bindings` + `@rntme/bindings-http`, `@rntme/bindings-grpc`, `@rntme/ui` + `@rntme/ui-runtime`, `@rntme/db-studio`.
4. Mention the executor seam (`CommandExecutor` / `QueryExecutor`) and the modules story (`@rntme/module-skeleton`, `manifest.modules[]`, pre-fetch middleware, idempotency cache).
5. Mention `@rntme/runtime` as boot orchestrator for **a single service** (project-level intake is still deferred per the project-first spec).
6. Mention deploy: `@rntme-cli/deploy-core` + `@rntme-cli/deploy-dokploy` as project-level deploy planning + adapters (CLI-side, not in the runtime path).
7. Note the demo: `demo/issue-tracker-api` is still single-service, **deprecated**, kept as historical reference until a project-shape canonical example replaces it.

Length cap: ~one paragraph, comparable to the current one (~12 lines). It is not a glossary — it is the orientation paragraph.

#### 6.1.2 "Product positioning" (line 11-22, the two-frame block)

Update both frames:

- **Internal framing** — rntme is an **artifact-driven runtime authored as a project blueprint**. The project blueprint folder is the canonical authoring/versioning/deploy unit. Inside, services compose from JSON artifacts (PDM is project-shared; QSM, Graph IR, bindings, UI, seed, manifest are per-service). CQRS / event sourcing / branded `Validated*` types / plugin seams (`DbDriver`, `EventBus`, `Surface`) / executor seams (`CommandExecutor`, `QueryExecutor`) are **consequences** of the repeatability goal.
- **Market framing** — rntme is *"the safe runtime for AI-generated business workflow apps."* Buyers see ONE bounded authoring object — a **validated project blueprint** — not the internal multi-service or multi-artifact decomposition. Primary wedge: approvals, ticketing, customer-ops, onboarding, internal admin / back-office. The project blueprint may technically contain multiple services + integration modules; from the buyer's perspective it is a single business app.

The "When editing, match the framing to the audience" guidance retained verbatim, with the term updates above.

### 6.2 `README.md`

#### 6.2.1 Hero block (lines 5-7)

Replace:
- *"the safe runtime for AI-generated business workflow apps"* — kept.
- *"...rntme turns a validated service blueprint into a working API and UI..."* → *"...rntme turns a validated project blueprint into working APIs and a UI..."*. Adjust grammar so the sentence still reads naturally with the multi-service interpretation.

#### 6.2.2 "What rntme does" (lines 13-21)

Rewrite "A team (or an agent) describes one service as a validated service blueprint..." paragraph. Replace with:

- A team or agent describes a working app as a **validated project blueprint**: a folder containing `project.json` (project metadata + routing + middleware), a project-level `PDM`, one or more services (each with their own QSM / Graph IR / bindings / UI / seed / manifest), and integration modules.
- The rntme runtime validates the blueprint in layers and boots the services described by it, with project-level routing/middleware composing them into one HTTP surface — **with zero service-specific code**.

Retain the "durable unit is the blueprint" framing but on the *project* blueprint.

Retain "What rntme deliberately does not build" verbatim.

#### 6.2.3 "Under the hood" (lines 23-38)

Rewrite:
- Open with "the project blueprint is the market-facing surface".
- Internally it compiles from a project-level layer (`project.json` + project `PDM`) plus per-service artifacts (QSM, Graph IR, bindings, UI, seed, manifest).
- List the four-layer validator + event-sourced SQLite runtime as before.
- Mention the modules layer + executor seam + gRPC surface as PR-12 additions to the internal pipeline.
- Retain the "consequences of the repeatability goal" sentence.
- Retain the bullet list of toolchain outputs (DDL, SQL, command runtime, projection consumer, OpenAPI, React SPA).

#### 6.2.4 "Architecture at a glance" mermaid (lines 42-73)

Redraw to reflect:
- Top: AI / Human → **project blueprint folder** (`project.json` + project-level PDM + service folders + modules).
- Below: project blueprint compiles via 4-layer validator into project-routed bindings, per-service runtimes, and a single mounted HTTP surface.
- The internal "7 artifacts" subgraph shrinks into a "service-level artifacts" subgraph, with `project.json` + `project PDM` shown above as the project-level layer.
- Keep the same colour palette and structure depth (do not introduce new visual conventions).

#### 6.2.5 Packages table (lines 88-105)

- Re-order so `@rntme/blueprint` is first (it sits at the top of the dep graph).
- Verify every existing entry still describes the package's current responsibility (specifically: re-check `@rntme/pdm` line for project-ownership, `@rntme/qsm` for relations, `@rntme/runtime` for executor seams).
- `@rntme/module-skeleton` is already listed (line 105). Add `@rntme/bindings-grpc` (currently absent from the table).
- Add a "Deployment (CLI-side)" row group at the bottom for `@rntme-cli/deploy-core` and `@rntme-cli/deploy-dokploy` (currently absent).

#### 6.2.6 Dependency graph (lines 113-144)

Update mermaid:
- Retain top-of-graph blueprint position.
- Add `BG["@rntme/bindings-grpc"]:::pkg` node and a `BG --> B & GIR & ES` edge.
- Add `MS["@rntme/module-skeleton"]:::pkg` and a `MS --> RT` edge.
- The `RT` node depends on `BG` and `MS` — add edges `RT --> BG`.

Update the explanatory paragraph (line 144). Replace the **"`@rntme/blueprint` currently depends on `@rntme/pdm` and `@rntme/qsm` but is not yet wired into `@rntme/runtime`"** sentence with:

- `@rntme/blueprint` validates project composition and produces a project-routed binding registry consumed by `@rntme/bindings`/`@rntme/ui` for compilation.
- Project-level runtime intake — boot from a project blueprint folder rather than a single service folder — is **not yet wired** in `@rntme/runtime`. The runtime still boots one service at a time. (Cite the project-first design spec.)

#### 6.2.7 "The commercial platform" (lines 77-86)

- Pillar 3 ("Deploy surface") — add explicit mention of `@rntme-cli/deploy-core` (target-neutral plan model) + `@rntme-cli/deploy-dokploy` (Dokploy adapter). Cite spec `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md`.
- No changes to pillars 1, 2, 4.

#### 6.2.8 "MVP / Tier 1 scope" (lines 233-248)

Add line: "Project blueprint composition: `project.json` + project-level PDM + N services + modules; project routes/middleware validated; project-routed binding registry compiled. Runtime intake at the project level is not yet wired."

Add line: "Platform modules integration: `manifest.modules[]` declares external services; pre-fetch middleware (`pre[]`) supports `system` (idempotency-key) + `module-rpc` steps; HTTP idempotency cache (24h TTL); callback bindings (GET + 302). Module communication is gRPC-based (`@rntme/bindings-grpc`)."

#### 6.2.9 "Design docs" section (lines 220-231)

Add bullets for:
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` — modules story.
- `docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md` — already cited; verify.
- `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md` — deploy pipeline.

### 6.3 `AGENTS.md`

#### 6.3.1 §3 ASCII dependency diagram (lines 53-80)

Add nodes for `@rntme/bindings-grpc`, `@rntme/module-skeleton` to the graph. Show:
- `@rntme/blueprint` retains top-of-graph position.
- `@rntme/bindings-grpc` sits next to `@rntme/bindings-http` (both depend on `@rntme/bindings`).
- `@rntme/module-skeleton` sits to the right of `@rntme/runtime` (depends on it).
- `@rntme-cli/deploy-core` and `@rntme-cli/deploy-dokploy` shown as a separate "Deployment (CLI-side)" cluster below the runtime, with a thin label noting they consume validated/composed project models from `@rntme/blueprint`.

The diagram's general style — ASCII tree with arrows meaning "depends on" — preserved.

#### 6.3.2 §3 prose, one-line purpose list (lines 82-132)

Verify each line is current. Specifically:
- `@rntme/blueprint` line — confirm it covers Track A (parsing/validating project blueprint folders) **and** Track B (project composition / project-routed binding registry).
- `@rntme/qsm` line — keep, but cross-check the "relation metadata for JOINs" reference matches current code.
- `@rntme/runtime` line — extend to mention executor seams + module wiring.
- `@rntme/bindings` line — extend to mention `pre[]` + callback shape support.
- `@rntme/bindings-http` line — extend with idempotency-cache + pre-fetch orchestration.

#### 6.3.3 §6 how-to additions

Add two new entries after §6.14:

- **§6.15 Compose a multi-service project.**
  1. Read `packages/blueprint/README.md` and the project-first design spec.
  2. Lay out the blueprint folder (`project.json`, `pdm/`, `services/<name>/...`, `modules/<name>/...`).
  3. Validate via `loadProjectBlueprint(...)`; the validator surfaces composition errors (missing services in routes, missing PDM ownership, duplicate paths).
  4. Compile the project-routed binding registry; verify expected service prefixes resolve.
  5. Until project-level runtime intake lands, run individual services with `@rntme/runtime` as before.

- **§6.16 Deploy a project via Dokploy.**
  1. Read `rntme-cli/packages/deploy-core/README.md`, `rntme-cli/packages/deploy-dokploy/README.md`, and `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md`.
  2. From a validated/composed project model, call `planDeployment(...)` (target-neutral) → returns a redacted plan.
  3. For Dokploy, render the plan via `renderDokployPlan(...)` and apply via `applyDokployPlan(...)`.
  4. The CLI command surface is in `@rntme-cli/cli` — verify against the cli README for the current incantations.

#### 6.3.4 §10 Glossary additions

Add definitions for:
- **Project blueprint** — folder with `project.json` + project-level PDM + per-service artifacts + modules. Canonical authoring/versioning/deploy unit.
- **Project PDM** — PDM artifact at the project level, shared across all services in the project.
- **Root entity** / **Owned entity** — project-level PDM ownership classification (per project-first spec §7.3-§7.4).
- **Module** — external integration service declared in `manifest.modules[]`; reached via gRPC; called from a binding's `pre[]`.
- **Pre-step** — a `pre[]` entry on a command binding; either `system` (idempotency-key) or `module-rpc`. Cap of 2 per binding.
- **Callback binding** — a command binding whose HTTP method is GET and whose `response.onOk` / `response.onErr` is a redirect; used for vendor returns (OAuth, magic links, hosted checkout).
- **Idempotency cache** — SQLite-backed cache of `(idempotency-key, command-run-id) → response`, 24h TTL, used by HTTP retries.
- **Executor seam** — `CommandExecutor` / `QueryExecutor` interfaces decoupling bindings-http/grpc from graph-ir execution.
- **Deployment plan** — target-neutral redacted descriptor produced by `@rntme-cli/deploy-core` from a composed project; rendered by an adapter (`@rntme-cli/deploy-dokploy`) to a target-specific shape.

#### 6.3.5 §8 "Where decisions live" additions

Add bullets:
- "Why project-first?" → already present (verify the link points to the 2026-04-23 spec).
- "Why deploy via plan→render→apply, not raw CLI?" → `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md`.
- "Why platform modules over gRPC, not direct HTTP?" → already present (verify).

### 6.4 `docs/architecture.md`

Section-level rewrite per Q3.

#### 6.4.1 §1 Executive summary (lines 39-95)

Full rewrite:
- Lead with project-blueprint flowchart at the top: AI/Human → project blueprint folder → 4-layer validator → composed project model → @rntme/runtime (per-service) + deploy pipeline (project-level).
- The decision→vision rationale table extends with two rows:
  - "Project as deployable unit" → "Whole-project deploys, project-level routing, project-shared PDM" (cites project-first spec).
  - "Modules over gRPC" → "External integrations decoupled from the runtime via dynamic-proto-load gRPC adapters" (cites platform-modules-integration spec).
- The "seven artifacts" mention moves into a sub-paragraph framed as "service-level primitives" with the project layer above.
- Keep the executive-summary length budget (~50 lines).

#### 6.4.2 §2 L1 System Context (lines 97-123)

Replace "service" as the deployable unit with "project". Inside the project, services + modules. Update the C4Context diagram boxes accordingly. Other actors (operator, agent, end-user) preserved.

#### 6.4.3 §3 L2 Containers

- **§3.1 "Authoring surface — the 7 artifacts"** (lines 127-145) → rename to **"Authoring surface — project blueprint folder"**. Show the folder shape from project-first spec §5; describe the project-level layer (`project.json` + `pdm/`) above the per-service artifacts.
- **§3.2 "Container map — 12 packages"** (lines 147-178) → **"Container map — 16 packages"**. Update the dep map. Add `@rntme/bindings-grpc`, `@rntme/module-skeleton`, `@rntme/blueprint`, `@rntme-cli/deploy-core`, `@rntme-cli/deploy-dokploy`. Explicitly note where each new package fits in the layering.
- **§3.3 "Plugin seams — extension without editing artifacts"** (lines 180-188) → add executor seams (`CommandExecutor`, `QueryExecutor`) alongside the existing `DbDriver` / `EventBus` / `Surface` triad. Note that pre-fetch middleware introduces a separate seam (`ExternalAdapterClient`) for modules.
- **§3.4 "Boot & seed lifecycle (sequence #3)"** (lines 190-218) → extend with idempotency-cache initialisation, gRPC surface boot, module-registry construction. Sequence diagram updated; preserve readability (no new actors unless necessary).

#### 6.4.4 §4 L3 Components

Existing subsections (§4.1-§4.8) — point patches:
- **§4.1 `@rntme/pdm`**: add note on project-PDM ownership model (root vs owned entities), the entity-per-file directory loader.
- **§4.2 `@rntme/qsm`**: add note on projection-per-file directory loader.
- **§4.6 `@rntme/bindings` + `@rntme/bindings-http`**: significantly expand. Add: `pre[]` validator chain (parse → structural → consistency); `inputFrom`; `ResponseShape` (onOk / onErr; redirect / json); GET-redirect callback bindings; `IdempotencyCache` (SQLite, 24h TTL); `runPreSteps` orchestrator; `expression` evaluator; `error-to-http` table; the structural codes added in batch 1 of the ultrareview; `BindingEntry.allowedRedirectHosts`; `bindAs: {name, pick}` form.
- **§4.7 `@rntme/ui` + `@rntme/ui-runtime`**: add note on qualified service binding refs and binding-map validation boundary.

New subsections:
- **§4.9 `@rntme/blueprint`** — full subsection in the same shape as the others (entry function, key types, validation pipeline, output → consumed by `@rntme/bindings`/`@rntme/ui`/deploy pipeline). Reference `docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md`.
- **§4.10 `@rntme/bindings-grpc`** — proto emission, identifier sanitization, `CommandResult` envelope, error-code → gRPC status mapping, `createGrpcServer`. Reference platform-modules-integration spec §6.2.
- **§4.11 `@rntme/module-skeleton`** — minimal handler-map scaffold; relationship to `CodeCommandExecutor`; health-check convention.
- **§4.12 Deploy pipeline (CLI-side)** — covers `@rntme-cli/deploy-core` (plan model: ports, edge routes, env, secrets, redaction) and `@rntme-cli/deploy-dokploy` (render → apply → status). Reference the deployment-pipeline spec.

The rule: every new subsection follows the same template as the existing ones (purpose / key types / pipeline / sequence diagram if useful / pointers).

#### 6.4.5 §5 L4 Code (lines 919-940)

Append rows for the most diagnostic functions in the new packages:
- `loadProjectBlueprint` — `packages/blueprint/src/...`
- `runPreSteps` — `packages/bindings-http/src/pre/...`
- `IdempotencyCache.lookup` / `IdempotencyCache.write`
- `emitProto` — `packages/bindings-grpc/src/emit/...`
- `errorToHttp` table — `packages/bindings-http/src/runtime/error-to-http.ts`
- `planDeployment` — `rntme-cli/packages/deploy-core/src/...`
- `renderDokployPlan` / `applyDokployPlan` — `rntme-cli/packages/deploy-dokploy/src/...`

Aim for ~10 new rows. Keep existing 14 rows.

#### 6.4.6 §6 Cross-cutting abstractions

Append new entries in the existing record format (Package / Purpose / Contract / Constructed by / Invariant / Spec(s) / Related):

- **§6.0** (Foundational): no changes.
- **§6.1** (Domain): add `ProjectBlueprint`, `ProjectMetadata`, `ProjectRoutes`, `ProjectMiddleware`, `ServiceMember`, `RootEntity` / `OwnedEntity` (PDM ownership).
- **§6.2** (Runtime): add `IdempotencyCache`, `CachedResponse` (with headers post-batch-1), `CircuitBreaker`, `withRetry`.
- **§6.3** (HTTP / UI): add `ResponseShape`, `ResponseBranch`, `InputSource`, `InputFromMap`, `BindingEntry.allowedRedirectHosts`, `PreStep`, `PreStepBindAs` (string | {name, pick}), `ExternalAdapterClient`.
- **§6.4** (Extensibility seams): add `CommandExecutor`, `QueryExecutor`, `GraphIrCommandExecutor`, `GraphIrQueryExecutor`, `CodeCommandExecutor`.
- **§6.5** (Topology): add `ProtoRegistry`, `GrpcAdapterClient`, `ModuleManifestEntry`, `DeploymentPlan`, `DokployTarget`.

Each entry uses the same fixed-record format as the existing entries.

#### 6.4.7 §7 Diagnostic observations (existing 9 lenses)

- For each of the 9 lenses, re-evaluate whether its observations still hold post-PR-9-16. Update or strike through outdated bullets.
- Decision on snapshot framing: the rest of the document (§§1-§6) is intentionally evergreen — diagnostic observations are inherently time-bound. Add a single line at the top of §7: *"Diagnostic observations as of 2026-04-26."* No per-section snapshot stamping elsewhere.

#### 6.4.8 §8 Glossary

Synchronise with `AGENTS.md §10` (see §6.3.4). Order alphabetical.

#### 6.4.9 §9 How to use / maintain

Verify reference list still points at correct files. Specifically: ensure the "snapshot date" guidance is consistent with the §7 decision above.

### 6.5 `vision.md`

#### 6.5.1 Hero (lines 5, 32)

Replace "validated service blueprint" → "validated project blueprint". Adjust grammar: "...rntme turns a validated project blueprint into a working app on a standard runtime..." (note: "app", not "service").

#### 6.5.2 "What rntme does" (line 59)

Same replacement: "...describes one service as a **validated service blueprint**..." → "...describes a working app as a **validated project blueprint**...". Adjust the rest of the paragraph for the multi-service interpretation.

#### 6.5.3 "A note on framing" (line 76)

The footnote *"the artifact pipeline is the compiler IR, not the authoring UX"* still holds. Update only the bounded-object label: "...buyers see one thing: a validated project blueprint."

#### 6.5.4 "The durable unit..." (line 266)

"...validated service blueprint" → "...validated project blueprint."

#### 6.5.5 §8 "The future platform" (deploy mention)

Add a sentence noting that the deploy surface is built on `@rntme-cli/deploy-core` + `@rntme-cli/deploy-dokploy`. Cite spec.

### 6.6 Main-repo per-package READMEs (triage)

For each affected README, the executor must add or verify the listed bullets in the appropriate template section (API / Invariants & gotchas / Where to look first / Specs). Exact wording is the executor's call; the bullets below are the minimum coverage requirement.

**`packages/blueprint/README.md`** — verify-only:
- Covers Track A (project.json parsing, project-level PDM, dir loaders) and Track B (project composition, route/middleware validation, project-routed binding registry).
- Lists all error codes from `BLUEPRINT_<LAYER>_<KIND>` namespace.
- "Where to look first" indexed by task (load project, validate composition, build registry).
- Spec links: 2026-04-23-project-first-blueprint-design.md.

**`packages/bindings-grpc/README.md`** — verify-only:
- Proto emission entry point (`emitProto`).
- Identifier sanitization rules.
- `CommandResult` envelope shape.
- Error-code → gRPC status mapping (cites `error-to-grpc.ts` if it exists, or the equivalent).
- `createGrpcServer` entry function.
- "Out of scope": streams, server-side TLS termination (if applicable).
- Spec link: 2026-04-19-platform-modules-integration-design.md §6.2.

**`packages/module-skeleton/README.md`** — verify-only:
- Purpose: scaffold for new platform modules.
- Handler-map pattern.
- Relationship to `CodeCommandExecutor`.
- Health-check convention.
- Spec link: platform-modules-integration §5 + §12.

**`packages/pdm/README.md`** — additions:
- Project entity ownership: root entities vs owned entities (cite project-first spec §7).
- Entity-per-file directory loader: API + invariants.
- Spec link: 2026-04-23-project-first-blueprint-design.md.

**`packages/qsm/README.md`** — additions:
- Projection-per-file directory loader: API.
- Cross-service projection inputs (project composition mode).
- Spec link: 2026-04-23-project-first-blueprint-design.md (for project composition); existing 2026-04-16-qsm-relations-migration-design.md retained.

**`packages/ui/README.md`** — additions:
- Service binding map validation boundary: what the UI compiler validates against the project-routed binding registry.
- Qualified service binding refs (cross-service binding references).
- Spec link: 2026-04-23-project-first-blueprint-design.md.

**`packages/runtime/README.md`** — additions:
- `CommandExecutor` / `QueryExecutor` seam and the default `GraphIrCommandExecutor` / `GraphIrQueryExecutor` implementations.
- `manifest.modules[]` parsing + `ProtoRegistry` boot + `GrpcAdapterClient` construction.
- `manifest.surface.grpc` boot path.
- Idempotency-cache initialisation.
- Note: project-level intake (boot from a project blueprint folder) is not yet wired.
- Spec links: platform-modules-integration; project-first-blueprint (note on deferred intake).

**`packages/bindings/README.md`** — additions:
- `pre[]` (pre-step middleware): structural rules, `kind: system | module-rpc`, ≤2 per binding, unique `bindAs`, command-only.
- `bindAs: string | {name, pick}` shape.
- `inputFrom` (callback input mapping) and the GET-redirect rule.
- `ResponseShape` (onOk / onErr; redirect | json), `ResponseBranch`.
- `BindingEntry.allowedRedirectHosts`.
- Spec link: platform-modules-integration §7-§8.

**`packages/bindings-http/README.md`** — additions:
- `IdempotencyCache` (SQLite, 24h TTL): lookup → cached response replay (with headers); `CachedResponse.headers` post-batch-1.
- `runPreSteps` orchestrator.
- `expression` evaluator (template strings / nested expressions).
- `error-to-http.ts` shared table.
- GET-redirect callback wiring (`renderResponse`, `c.redirect` Hono v4 RedirectStatusCode alignment).
- `command-run-id` derivation (SHA-256).
- `runtime-contract.ts` decoupling from `@rntme/runtime`.
- Spec link: platform-modules-integration.

**`packages/graph-ir-compiler/README.md`** — small addition:
- One paragraph noting the executor seam: `CommandExecutor` / `QueryExecutor` decouples HTTP/gRPC bindings from this package; default executors live here.
- Spec link: platform-modules-integration §5.

### 6.7 Submodule docs (triage)

**`rntme-cli/README.md`** — additions:
- Add `apps/landing/` to workspace members (rntme.com landing, deployed on Dokploy).
- Add `packages/deploy-core/`, `packages/deploy-dokploy/` to workspace members (already done? verify).

**`rntme-cli/packages/deploy-core/README.md`** — verify-only:
- Plan model (ports, edge routes, env, secrets, redaction).
- Target-neutral entry function (`planDeployment` or current name).
- Out of scope: target-specific render/apply (that lives in adapters).
- Spec link: 2026-04-24-project-deployment-pipeline-design.md.

**`rntme-cli/packages/deploy-dokploy/README.md`** — verify-only:
- `renderDokployPlan` and `applyDokployPlan`.
- Dokploy API quirks (e.g. memory: `dokploy_mcp_url_gotcha`).
- Spec link: 2026-04-24-project-deployment-pipeline-design.md and 2026-04-19-platform-deploy-dokploy-design.md.

**`rntme-cli/packages/cli/README.md`** — additions:
- New platform commands (per the post-PR-11 surface).
- Skills pack reference.
- Schema-sync drift gate (mentions snapshot files).

**`rntme-cli/packages/platform-http/README.md`** — additions:
- UI mount + `/v1` sub-app (auth gating).
- WorkOS session auto-refresh.
- Membership self-heal.
- `set_config`-based org-scoped tx.

**`rntme-cli/packages/platform-core/README.md`**, **`platform-storage/README.md`** — spot-check for currentness; minor updates only if obvious drift surfaces.

**`rntme-cli/apps/landing/README.md`** — verify exists and template-correct. Then a separate copy-sweep on the landing source files (`apps/landing/src/...`): replace "validated service blueprint" with "validated project blueprint" wherever it appears in user-facing copy. Do NOT change page structure, animations, or layouts. (Memory `feedback_landing_overdrive`: landing is sensitive — restraint earns trust.)

### 6.8 Demo deprecation banner

Three placements:

**`demo/issue-tracker-api/README.md`** — banner at the very top, before the existing content:

> ⚠️ **DEPRECATED — single-service shape.**
> This demo predates the project-first canonical model (see [`docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md`](../../docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md)).
> It is kept as a working historical reference for the per-service runtime path.
> A project-shape canonical example will replace it; do not start new work from this layout.

**Root `README.md`** — packages-table demo row → prepend "⚠️ Deprecated — single-service" and link to the demo README.

**`AGENTS.md` §6.8 "Run the demo locally"** — add a one-line note at the top: "*Demo is deprecated (single-service shape); see the demo README for context.*"

The banner does not introduce a deletion date — the demo continues to serve as a regression suite for the per-service path until project-level intake lands in the runtime.

## 7. Out of scope

- Substantive refactor of the demo (graphs, bindings, fixtures, projection schema). Banner only.
- Restructuring the landing app (`rntme-cli/apps/landing/`). Terminology sweep on copy only.
- Drafting a new ADR for the project-first pivot. The 2026-04-23 spec already plays that role.
- Re-recording the `runtime` ↔ `bindings-http` build-order cycle as a "fixed" issue; it remains a known-issue from PR 12 and lives in a separate follow-up.
- Adding new diagrams to `architecture.md` outside the explicit prescriptions in §6.4.
- Synchronising `graph_ir_rc_7.md` (gitignored, historical, not canon).

## 8. Order of work (input to writing-plans)

The plan that follows this spec should treat each §6.x section as one or more independent units. A reasonable grouping:

1. Top-level framing: §6.1 (CLAUDE.md), §6.2 (README.md), §6.5 (vision.md). One PR; the framing must shift atomically.
2. AGENTS.md: §6.3. Independent.
3. Architecture rewrite: §6.4. Largest unit; can split per subsection but the §1/§3 rewrite must land together to stay coherent.
4. Per-package READMEs (main repo): §6.6. Independent per package.
5. Submodule READMEs: §6.7. Independent per file; submodule edits land via a separate submodule PR + parent submodule-pointer bump.
6. Demo deprecation banner: §6.8. Independent, three placements.

The order is suggested; the plan author may regroup based on PR-size sensibility.
