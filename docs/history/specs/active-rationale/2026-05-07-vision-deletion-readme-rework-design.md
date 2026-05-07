> Status: active-rationale.
> Date: 2026-05-07.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Delete vision.md, rework README, license under Apache 2.0 — design

> Status: design (brainstorming complete). Use as input for `writing-plans`.
> Scope: top-level docs (`README.md`, `vision.md`, `CLAUDE.md`, `AGENTS.md`) + `LICENSE` + root `package.json`.
> Non-goals: rewriting per-package READMEs, refactoring the landing app copy, retroactively editing historical specs, refactoring code.

## 1. Problem

`vision.md` was committed **2026-04-20** (commit `e5a03e48`). In the ~17 days since, several load-bearing claims in it have become factually wrong, and one strategic frame has been retired entirely. The damage so far is contained — the file is referenced from `README.md`, `AGENTS.md`, `CLAUDE.md`, and a handful of active specs — but the cost of leaving it in place compounds: every spec written from this point on inherits the stale framing, and external readers landing on the repo see a sales narrative that no longer matches the product.

### 1.1 Direct factual errors in `vision.md`

| Where | Stale claim | Reality (as of 2026-05-07) |
|---|---|---|
| §6 *Workflow engines* row | "Orthogonal — rntme punts cross-service orchestration to Zeebe." | rntme **embeds** BPMN orchestration as a project-level capability: `@rntme/workflows` artifact, provisioned Operaton in the deploy plan, separate `@rntme/bpmn-worker` workload. Zeebe was rejected (license + deploy complexity); Operaton is the current implementation, but the load-bearing decision is **BPMN as the orchestration model**, not the engine. |
| §3 *Product vision*, §8 *The future platform* opening | "rntme is a per-service runtime." | Project-first pivot landed `2026-04-23` (spec `done/2026-04-23-project-first-blueprint-design.md`). The canonical authoring unit is the project blueprint folder. `@rntme/runtime` remains the per-service execution kernel (true), but the product identity is project-first. |
| §3, §6, §7 (passim) | No mention of vendor-module ecosystem, canonical contracts, or provisioner pattern. | Three canonical contracts shipped (`identity-v1`, `ai-llm-v1`, `crm-v1`); fourth designed (`storage-s3`); vendor modules running (`auth0`, `openrouter`, `bitrix24`); provisioner contract (`@rntme/contracts-provisioner-v1`) and `provision → plan → render → apply → verify` deploy pipeline live. The vendor-module ecosystem is now a load-bearing capability, not a footnote. |

### 1.2 Retired strategic frame

`vision.md` is built around an **OSS-trust-engine + commercial-control-plane** split:

- §1 *Big-company / vision* pitch: "the winning company will not just generate code, but provide the runtime and control plane that makes generated services consistent, reviewable, deployable, and governable."
- §7 *Open source as trust engine, control plane as revenue* — explicit OSS-vs-commercial table.
- §8 *The future platform* — "four pillars" (control plane / registry / deploy surface / governance) that "the commercial platform composes."
- §10 *Long-term thesis* — "The winning company won't just generate code — it will own the runtime and control plane."

Decision (`2026-05-07`): rntme is fully open-source. Business-model questions are deferred. The four-pillars commercial framing is retired.

The half-life of leaving the file in place with this much stale content is short and the maintenance cost of editing in place is roughly the same as writing a clean README — so the file goes.

### 1.3 Broadened wedge

`vision.md` §7 frames the wedge narrowly: *"approvals, ticketing, customer-ops / ops consoles, onboarding flows, internal admin / back-office services."*

Refined formulation (`2026-05-07`): rntme is for **business processes that need consistency, observability, safety, and extensibility** — workflow apps remain the prototypical shape, but AI-extraction jobs (the `cv-extract` demo) are also in scope, and the wedge no longer attaches to a specific app archetype.

### 1.4 Hero collapse

`vision.md` §1 carries three canonical pitch sizes (one-liner / 30-second / big-company-vision). The big-company-vision pitch is now invalid (1.2). The remaining two are kept as a single hero in `README.md`. The hero text is selected and locked in §4 below.

## 2. Goal

After this refresh:

1. `vision.md` no longer exists. No replacement positioning doc (`docs/positioning.md` or similar) is created — strategic content (ICP, JTBD, competitive landscape, GTM motion, four pillars) is **not migrated**.
2. `README.md` is the single market-facing surface. It carries the chosen hero, a refreshed "What rntme does", a refreshed "How it works" that names BPMN-as-orchestration-choice and the vendor-module ecosystem, and the package/quick-start/dev/specs/MVP/glossary content that already serves repo navigation.
3. The repository is licensed **Apache 2.0**. `LICENSE` exists at the repo root; root `package.json` declares `"license": "Apache-2.0"`.
4. `CLAUDE.md` and `AGENTS.md` no longer link to `vision.md` and no longer reference the OSS-vs-commercial split or the four-pillars commercial framing. The internal "artifact-driven runtime authored as a project blueprint" framing is retained in `CLAUDE.md` *Product positioning*, but rewritten as a single audience (no longer "internal vs market" two-layer rule).
5. Active specs and per-package READMEs that mention `vision.md` are not retroactively edited. Historical specs in `done/` are not edited.
6. CI passes (`build → typecheck → test → lint → depcruise → vendor:check`) — this is a docs-only change, so the bar is low, but it must hold.

## 3. Decisions

| Q | Question | Decision |
| --- | --- | --- |
| Q1 | Replace `vision.md` with `docs/positioning.md`? | **No.** Delete entirely. Pre-revenue, no users — cost of carrying a strategic-positioning doc exceeds its value today. Re-derive if and when a real GTM motion starts. |
| Q2 | Hero pitch in `README.md`? | **Variant C** (documentary, no "safe"-marketing). Locked text in §4.1. |
| Q3 | License? | **Apache 2.0.** Patent grant + corporate-friendly + matches every project rntme integrates with (Camunda/Operaton, Temporal, OpenTelemetry, Drizzle, OpenRouter SDK, Kubernetes, Auth0 SDKs). |
| Q4 | Future managed/hosted offering? | **Not promised, not denied.** No copy in `README.md` mentions a future commercial product. Business model is deferred. |
| Q5 | What about `apps/platform-http`? | Stays in repo. Mentioned in a new **Apps** subsection of `README.md` as an *optional self-hosted control plane* (organizations, projects, deploy targets, registry). No "platform.rntme.com" hosted-service callout. |
| Q6 | Wedge framing (B3) | **Broadened.** "rntme is for business processes that need consistency, observability, safety, and extensibility." Workflow apps remain prototypical but no longer the only shape pitched. |
| Q7 | BPMN framing | **Vendor-neutral.** "rntme uses BPMN as the cross-service orchestration model. The current implementation provisions Operaton; the load-bearing choice is BPMN, not the engine." |
| Q8 | Vendor-module ecosystem framing | **First-class capability.** Named explicitly in `## How it works`. Listed categories (today): identity, AI/LLM, CRM, storage. Listed shipping vendors: Auth0, OpenRouter, Bitrix24. Storage/S3 noted as in-design. |
| Q9 | Existing references to `vision.md` in active specs and worktrees | **Leave.** Active specs in `docs/history/specs/active-rationale/*.md` and `done/*.md` may continue to reference the deleted file as historical context. The reader follows from the spec date and infers. |
| Q10 | Update memory entries (`rntme_market_positioning`, `rntme_vision_framing`)? | **Yes.** Refresh both under OSS-pivot + B3 broadening as part of this work. |

## 4. Concrete content changes

### 4.1 New `README.md` hero block (locked text)

```markdown
# rntme

[![CI](https://github.com/vladprrs/rntme/actions/workflows/ci.yml/badge.svg)](https://github.com/vladprrs/rntme/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

> **An open, validated runtime for AI-generated business apps.**
>
> A team — or an agent — describes the app as a project blueprint:
> domain model, queries, commands, HTTP bindings, UI, BPMN workflows,
> vendor modules. rntme validates the blueprint in layers and boots a
> standard runtime around it. The apps an agent generates stay
> consistent, observable, and reviewable across the second, third,
> and tenth iteration.
>
> Open-source under Apache 2.0.

- 🧱 **Architecture deep-dive:** [`docs/architecture.md`](docs/architecture.md)
- 🤖 **Coding agents:** start with [`AGENTS.md`](AGENTS.md) — research map, conventions, task-indexed pointers
- ⚖️ **License:** [`LICENSE`](LICENSE) (Apache 2.0)
```

### 4.2 New `## What rntme does` section (full draft)

The new wording replaces the current README §"What rntme does" verbatim:

```markdown
## What rntme does

A team (or an agent) describes a working app as a **validated project blueprint**:
a project blueprint folder containing `project.json` (project metadata, routing,
middleware), a project-level PDM, one or more services (each with its own QSM,
Graph IR, bindings, UI, seed, and manifest), project-level workflows (BPMN), and
integration modules. The rntme runtime validates the blueprint in layers and
boots the services described by it, with project-level routing and middleware
composing them into one HTTP surface — **with zero service-specific code**.

The durable unit is the project blueprint. Teams edit the blueprint; the runtime
keeps the app consistent. Agents author blueprints; the runtime enforces what's
valid. The second app you build starts from a copy of the first project
blueprint, not from an empty repo.

**Where it fits.** rntme targets **business processes that need consistency,
observability, safety, and extensibility** — workflow apps (approvals,
ticketing, customer-ops, onboarding, back-office), AI-extraction jobs
(see [`demo/cv-extract-blueprint`](demo/cv-extract-blueprint)), and stateful
back-office tools where every additional service shouldn't reinvent the backend.

**What we deliberately do not build:** a generic AI app builder competing with
Lovable / Bolt / Firebase Studio on first-run magic; a backend-as-a-service
competing with Supabase / Appwrite / Firebase on primitives; an internal-tools
low-code platform competing with Retool / Appsmith / ToolJet / Budibase on UI
speed; an agent runtime — rntme runs the services that agents describe, not the
agents themselves.
```

### 4.3 New `## How it works` section (full draft)

Renames `## Under the hood` → `## How it works` and rewrites the body:

```markdown
## How it works

The project blueprint is the bounded authoring object. Internally it compiles
from a project-level layer (`project.json`, project-level PDM, optional
project-level workflows) and per-service artifacts — **QSM** (read-side
projections), **Graph IR** (queries + commands, carried by bindings / UI),
**bindings** (HTTP surface), **UI**, **seed**, **manifest** — through a
four-layer validator (parse → structural → references → consistency) onto an
event-sourced SQLite runtime.

**Cross-service orchestration: BPMN.** rntme uses BPMN as the orchestration
model for cross-service workflows. The current implementation provisions
Operaton (the project-level `workflows` artifact compiles into deployable BPMN
process definitions, executed by a separate `@rntme/bpmn-worker` workload that
calls back into rntme services through gRPC action bindings). The load-bearing
choice is **BPMN as the standard**, not Operaton specifically — timers,
gateways, message-correlated process starts, and event-driven step sequencing
come from the BPMN spec, not from rntme code we'd otherwise have to invent.

**Vendor modules: typed adapters for the outside world.** Every category of
external integration (identity, AI/LLM, CRM, object storage, …) has a
**canonical contract** (`packages/contracts/<category>/v1`) — a protobuf-shaped
interface, conformance scenarios, and standardized error codes. **Vendor
modules** implement that contract for a specific vendor (Auth0, OpenRouter,
Bitrix24, S3-compatible storage, …) and ship as their own packages under
`modules/<category>/<vendor>/`. Modules can declare a **provisioner** block in
`module.json` to reconcile external resources idempotently as part of deploy
(e.g. create the Auth0 client, create the S3 bucket) and feed env vars back into
the runtime. This is how rntme reuses existing SDKs without losing the
validated-artifact guarantee: the canonical contract is the trust boundary; the
vendor module owns the SDK call.

**Production-class consequences, not the identity of the product.** CQRS,
event-sourcing, SQLite/Turso storage, branded `Validated*` types, plugin seams
(`DbDriver`, `EventBus`, `Surface`), and executor seams (`CommandExecutor` /
`QueryExecutor`) are downstream of the repeatability goal. They deliver
extensibility without editing artifacts, migrations as event replay, and
one-file-per-service scale-out — but they're not the headline.

From the project layer + service-level artifacts, the toolchain produces:

- SQLite DDL for projections and the event log.
- SQL for every query graph and a runtime to execute it.
- An event-sourced command runtime with optimistic concurrency, at-least-once
  CloudEvents-1.0-enveloped Kafka-style relay, and bounded-retry DLQ.
- An idempotent projection consumer that keeps the read-side eventually
  consistent.
- An OpenAPI 3.1 document and a Hono HTTP surface.
- A declarative React SPA compiled from the `ui` artifact.
- BPMN workflow deployment metadata for provisioned Operaton plus a `bpmn-worker`
  workload, when the project declares cross-service workflows.

Organised as a pnpm monorepo. Each package has a single, testable
responsibility and depends only on the packages strictly below it.
```

### 4.4 Architecture-at-a-glance mermaid

Keep the existing mermaid diagram in §"Architecture at a glance". Spot-check
two things only:

- The `validated project blueprint (folder)` cluster already names `project.json`,
  project-level PDM, services, modules, and workflows — correct for project-first.
  No change.
- The `MOD["modules x N<br/>(gRPC adapters)"]` node — keep the gRPC label, but
  consider widening the description to "vendor modules (gRPC adapters)" so the
  diagram matches §How it works terminology. Optional polish, not required.

### 4.5 `## The commercial platform` — DELETE

Remove the entire section sitting between `## Architecture at a glance` and
`## Packages`. No replacement. The section currently lists the four pillars
(control plane / registry / deploy surface / governance) and links to
`platform.rntme.com` and `done/2026-04-19-platform-api-design.md`; all of that
goes.

### 4.6 New `## Apps` subsection (after `### Demo`)

Add a sibling subsection to `### Demo` and `### Dependency graph`:

```markdown
### Apps

| App | Purpose |
| --- | --- |
| [`apps/platform-http`](apps/platform-http) | **Optional self-hosted control plane.** Manages organizations, projects, deploy targets, encrypted credentials, and the artifact registry. Self-host alongside your rntme-runtime services if you want a UI for project lifecycle and deploy. |
| [`apps/cli`](apps/cli) | `rntme` CLI: bundle a project blueprint, publish to a platform instance, trigger deploys. |
| [`apps/landing`](apps/landing) | The rntme.com landing site source. Not required to run rntme. |
```

### 4.7 `## Packages` table

Keep the current table verbatim. The `apps/*` packages are not currently in this
table (the table covers libraries under `packages/*` and `modules/*`). They get
their own `### Apps` subsection per §4.6 — they're binaries, not libraries.

### 4.8 `## Design docs and specs` refresh

- Drop the line referencing `done/2026-04-19-platform-modules-integration-design.md`. It is currently flagged as "historical" but the modules + executor-seams story is now better told by §How it works prose; pointing readers at a `done/` spec for it just adds friction.
- Add a line for `2026-05-07-vision-deletion-readme-rework-design.md` (this spec).
- Keep all other rows.

(Note: `done/2026-04-19-platform-api-design.md` was referenced only from the
deleted §"The commercial platform" — it does not appear in §"Design docs and
specs", so no edit there.)

### 4.9 `## MVP / Tier 1 scope` refresh

Three concrete edits to the existing `## MVP / Tier 1 scope` section:

1. The "Out of scope for now" line currently reads *"snapshots, multi-aggregate commands, list/`in` parameters, named predicate graphs, `distinct`, `lookupOne`, window functions, **auth/authz**, multi-tenancy, schema registry / breaking schema evolution."* — strike **`auth/authz`**. Auth ships as a vendor-module category (Auth0 module). Multi-tenancy stays out of scope.
2. The "Project workflow artifact" bullet — lift its phrasing to match §How it works: "BPMN as the orchestration model; current target is provisioned Operaton plus a separate `bpmn-worker` workload."
3. The "Platform modules integration" bullet — replace "Module communication is gRPC-based (`@rntme/bindings-grpc`)" with "Vendor-module communication is gRPC-based; canonical contracts live under `packages/contracts/<category>/v1` and are independent of any vendor implementation."

### 4.10 New `## License` section

Add as the final section, after `## Glossary`:

```markdown
## License

rntme is released under the [Apache License 2.0](LICENSE).

That includes the runtime, all artifact validators, all vendor modules in this
repository, the `apps/*` workspace, and the demo blueprints. There is no
separately-licensed commercial layer. If a future managed offering exists, it
will be a separate product.
```

### 4.11 `## Glossary` refresh

Add three terms to the existing glossary table:

| Term | Meaning |
| --- | --- |
| **Vendor module** | An implementation of a canonical category contract (`identity`, `ai-llm`, `crm`, `storage`, …) for a specific vendor (Auth0, OpenRouter, Bitrix24, …). Lives under `modules/<category>/<vendor>/` and ships its own `module.json`. |
| **Canonical contract** | The protobuf-shaped interface, conformance scenarios, and `<CATEGORY>_<LAYER>_<KIND>` error codes for a category of external integration. Lives under `packages/contracts/<category>/v1`. Vendor modules code against the contract; the contract has no vendor knowledge. |
| **Provisioner** | The optional `module.json` block that lets a vendor module reconcile external resources (e.g. create the Auth0 client, create the S3 bucket) idempotently as part of `provision → plan → render → apply → verify`. The contract lives in `@rntme/contracts-provisioner-v1`. |

Keep all other glossary rows.

## 5. Files touched

| File | Action |
| --- | --- |
| `vision.md` | **Delete.** |
| `README.md` | Rework per §4.1–§4.11. |
| `LICENSE` | **Create.** Full Apache 2.0 text. |
| `package.json` (root) | Add `"license": "Apache-2.0"`. |
| `CLAUDE.md` | Three concrete edits: (a) the "Product positioning" section currently has two bullets — *Internal framing* and *Market framing*. Collapse to a single audience: keep the *Internal framing* description (artifact-driven runtime authored as project blueprint) verbatim; delete the *Market framing* bullet entirely. (b) The line "Source of truth for positioning: `README.md` hero block and `vision.md` (ICP, wedge, substitutes, canonical one-liner / 30-second / vision pitches)." → replace with "Source of truth for positioning: `README.md` hero block and `## What rntme does`." (c) The "Every plan must include a documentation-touch task" bullet enumerates files including `vision.md` — drop the `or `vision.md`` clause. |
| `AGENTS.md` | Three concrete edits: (a) the doc-touch enumeration around line 32 lists `vision.md` — drop. (b) The §3 narrative around line 47 mentions "`platform.rntme.com`, REST/UI deploy surface, and background deploy executor" as part of describing platform-http capabilities — keep the deploy-surface/executor framing but rephrase to "`apps/platform-http` (the optional self-hosted control plane), REST/UI deploy surface, and background deploy executor." Drop the bare `platform.rntme.com` URL. (c) The doc-touch checklist item 12 around line 1090 enumerates `vision.md` as a touchable doc — drop the entry; renumber the checklist if needed. |
| `apps/landing/` (source) | **Out of scope for this spec.** Track separately if landing copy diverges from new framing. |
| `docs/history/specs/active-rationale/*.md` (active and `done/`) | **Out of scope.** Historical references to `vision.md` are left intact. |
| Per-package READMEs | **Out of scope.** None of the per-package READMEs in `packages/*` link to `vision.md` (verified). |
| `~/.claude/projects/-home-coder-project/memory/rntme_vision_framing.md` | Refresh under OSS-pivot. |
| `~/.claude/projects/-home-coder-project/memory/rntme_market_positioning.md` | Refresh under OSS-pivot + B3-broadening. |

## 6. Out of scope (explicit non-goals)

- No code changes. Dep-cruiser layering rules are not affected.
- No restructuring of `docs/architecture.md`. That document was refreshed for the project-first pivot in `done/2026-04-26-docs-refresh-after-project-first-pivot-design.md`; further refresh is its own spec.
- No `docs/positioning.md` or any successor strategic-positioning doc. Strategic content is **deleted**, not migrated.
- No retroactive edits to historical specs in `docs/history/specs/historical/`.
- No edits to active specs in `docs/history/specs/active-rationale/*.md` that mention `vision.md`. They keep their references as historical context; the reader infers from spec dates.
- No landing-app copy refresh. Tracked separately.
- No per-package README edits.
- No new third-party license header on every source file. Apache 2.0 supports project-level licensing without per-file headers; we adopt that convention. Per-file headers can be added later if a contributor or downstream packager requires it.

## 7. Verification

After this spec is implemented:

1. `vision.md` does not exist (`test ! -f vision.md`).
2. `LICENSE` exists and contains the canonical Apache 2.0 text (first line: *"                                 Apache License"*).
3. `README.md` no longer matches `grep -E '(vision\.md|commercial platform|four pillars|the winning company|platform\.rntme\.com)'` (all five strings absent).
4. `CLAUDE.md` no longer matches `grep -E '(vision\.md|commercial platform|four pillars|platform\.rntme\.com)'`.
5. `AGENTS.md` no longer matches `grep -E '(vision\.md|commercial platform|four pillars|platform\.rntme\.com)'`.
6. Root `package.json` declares `"license": "Apache-2.0"`.
7. CI green: `pnpm -r run build && pnpm -r run typecheck && pnpm -r run test && pnpm -r run lint && pnpm depcruise`.
8. The two memory files are refreshed and `MEMORY.md` index entries point to the refreshed content.

## 8. Implementation note

This is a docs-only change. The implementation plan can be a single PR with three commits: (a) `LICENSE` + root `package.json`, (b) `README.md` rework, (c) `vision.md` deletion + `CLAUDE.md` and `AGENTS.md` cross-doc updates. Memory refresh happens in the working session, not in the PR.

The spec itself is a documentation-touch artifact — per `CLAUDE.md` the writing-plans output that consumes this spec must explicitly track that no per-package README and no `docs/architecture.md` change is required, with a one-line "no docs-touch needed for X" decision recorded in the plan.
