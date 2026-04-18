# Medusa-class Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the medusa-class gap-analysis deliverables — `research/medusa/` checkout, 3 Medusa survey reports, 5 thematic gap docs in `docs/gaps/`, commerce-demo spec, and hub doc — so rntme has a concrete decision-framework for the next 2–3 product iterations.

**Architecture:** Documentation effort, not code. Each artifact has explicit acceptance criteria (structural markers that can be grep-verified). Tasks are bite-sized per deliverable; TDD-analog is: (a) state criteria, (b) write content, (c) verify with shell checks, (d) commit.

**Tech Stack:** Markdown, git, sparse-checkout, `Explore` subagents for Medusa survey.

**Spec:** [`docs/superpowers/specs/2026-04-14-medusa-class-roadmap-design.md`](../specs/2026-04-14-medusa-class-roadmap-design.md)
**Companion plan (author intent):** [`docs/superpowers/reports/2026-04-14-medusa-class-roadmap-plan.md`](../reports/2026-04-14-medusa-class-roadmap-plan.md)

**Memory anchors (already saved, load at session start):**
- `project_platform_vision.md` — rntme's role in the larger LLM-driven DDD platform; Zeebe/gRPC/ksqlDB/viz-UI boundaries.
- `rntme_turso_target.md` — SQL stays SQLite-dialect; Turso is the scale path, not Postgres.

---

## Task 1: Research area setup — `.gitignore` + sparse-clone Medusa

**Files:**
- Modify: `.gitignore` (root) — add `/research/`
- Create (external, gitignored): `research/medusa/` (sparse-clone)

- [ ] **Step 1.1: Add `/research/` to root `.gitignore`**

Edit `.gitignore`, add `/research/` next to `/.worktrees/`:

```diff
 # Local agent / editor config
 /.claude/
 /.cursor/
 /.worktrees/
+/research/
```

- [ ] **Step 1.2: Verify `.gitignore` change**

Run: `git check-ignore -v research/`
Expected: output like `.gitignore:<line>:/research/	research/`.

- [ ] **Step 1.3: Sparse-clone Medusa**

Run (from repo root):

```bash
mkdir -p research
git clone --depth 1 --filter=blob:none --sparse https://github.com/medusajs/medusa.git research/medusa
git -C research/medusa sparse-checkout set packages/framework packages/medusa packages/modules README.md
```

Expected: `research/medusa/packages/framework/`, `research/medusa/packages/medusa/`, `research/medusa/packages/modules/` all exist and populated. No other top-level package dirs (e.g. `packages/admin-*`, `packages/cli`) should be present.

- [ ] **Step 1.4: Verify clone is complete and repo stays clean**

Run:

```bash
ls research/medusa/packages
git status --short
```

Expected: `ls` shows the three dirs plus a top-level `README.md`. `git status` shows only `.gitignore` modified (no `research/` entries — proves ignore works).

- [ ] **Step 1.5: Commit `.gitignore`**

```bash
git add .gitignore
git commit -m "chore: ignore /research/ dir for Medusa sparse-checkout"
```

---

## Task 2: Medusa survey — three parallel Explore subagents

**Files:**
- Create: `docs/superpowers/reports/2026-04-14-medusa-survey-a-domain-dml.md`
- Create: `docs/superpowers/reports/2026-04-14-medusa-survey-b-module-workflow.md`
- Create: `docs/superpowers/reports/2026-04-14-medusa-survey-c-http-openapi.md`

All three reports are gitignored (`/docs/superpowers/` is in `.gitignore`). Intermediate artifacts — used by subsequent tasks.

- [ ] **Step 2.1: Dispatch three Explore agents in one message**

Use the `Agent` tool with `subagent_type: Explore`, thoroughness `very thorough`, **three calls in a single message** for parallel execution. Each agent receives a self-contained prompt (they have no access to this session's context).

**Agent A — Domain & DML:**

```
Explore research/medusa/packages/framework/src/utils/dml/ and how DML is consumed by modules under research/medusa/packages/modules/.

Questions to answer (cite file paths and short snippets):
1. How is a domain entity declared in DML? (model helper, field types, pk/id conventions).
2. What primitive field types exist? Focus on: money/amount, currency, enum, soft-delete markers, timestamps, nested/embedded objects, JSON fields.
3. How are relations declared (one-to-one, one-to-many, many-to-many)?
4. What is a DML "link" and how does it differ from a relation? Show an example linking two modules.
5. How are migrations generated from DML (CLI, runtime, both)?
6. How is multi-tenancy (if any) expressed?

Output: report under 800 words, written to docs/superpowers/reports/2026-04-14-medusa-survey-a-domain-dml.md with H2 per question, code pointers as research/medusa/<path>:<line>. Create the file using Write tool.
```

**Agent B — Module & Workflow runtime:**

```
Explore research/medusa/packages/framework/src/modules-sdk/ and research/medusa/packages/framework/src/workflows-sdk/.

Questions to answer (cite file paths):
1. How is a module registered? What interface must it expose (service, API, events)?
2. How are modules wired together at runtime (module container / DI)?
3. How is the event bus implemented (Redis pub/sub, in-memory, both)?
4. How is a workflow defined and executed? What's the step/compensation API?
5. How are long-running workflows resumed after crash? (durable state store?)
6. How is idempotency handled inside a workflow step?
7. What primitives exist for saga-style cross-module orchestration?

Output: report under 800 words to docs/superpowers/reports/2026-04-14-medusa-survey-b-module-workflow.md with H2 per question, code pointers. Create the file using Write tool.
```

**Agent C — HTTP API surface + OpenAPI:**

```
Explore research/medusa/packages/medusa/src/api/ and any middleware under research/medusa/packages/medusa/src/.

Questions to answer (cite file paths):
1. How are routes defined? File-based routing vs. explicit registration?
2. How are admin vs store routes split and authed? Security schemes used.
3. Is OpenAPI generated? If yes — from which source (decorators, manual YAML, route metadata)?
4. How is idempotency implemented on API level (headers, middleware, storage)?
5. How are multipart file uploads handled? Storage abstraction?
6. How is error response format standardized (shape, error codes catalog)?
7. Are webhooks / callbacks emitted and documented?

Output: report under 800 words to docs/superpowers/reports/2026-04-14-medusa-survey-c-http-openapi.md with H2 per question, code pointers. Create the file using Write tool.
```

- [ ] **Step 2.2: Verify three reports exist**

Run:

```bash
ls docs/superpowers/reports/2026-04-14-medusa-survey-*.md
wc -l docs/superpowers/reports/2026-04-14-medusa-survey-*.md
```

Expected: three files listed, each with >30 lines (non-trivial content).

- [ ] **Step 2.3: No commit**

Reports are gitignored working artifacts. Skip commit.

---

## Task 3: Thematic doc — `pdm-gaps.md`

**Files:**
- Create: `docs/gaps/pdm-gaps.md`

**Inputs:** Medusa survey A (domain/DML), current rntme PDM code at `packages/pdm/src/types/artifact.ts`, `packages/pdm/src/parse/schema.ts`, demo PDM at `demo/issue-tracker-api/artifacts/pdm.json`.

**Acceptance criteria (verify before commit):**
- H1 = `Gaps: PDM`.
- H2 sections present: `What rntme has today`, `How Medusa handles it`, `Gaps for commerce-class case`, `Intersections with out-of-scope`, `Open questions`.
- ≥3 tagged gaps. At least one P0. Each gap heading matches regex `^### \[P[012]\] \[(demo-blocker|non-blocker)\]`.
- Every gap body contains: `**Pain point in rntme today**`, `**Medusa reference**` (or the "no direct analogue" note), `**Authorability / visualization**`.
- ≥1 rntme code pointer formatted as `packages/<pkg>/src/<path>:<line>`.
- ≥1 Medusa code pointer formatted as `research/medusa/<path>:<line>`.

**Candidate gaps (from vision + issue-tracker experience — author picks final list after reading survey A):**
- `[P0] [demo-blocker] Money type (amount + currency) native in PDM` — commerce-class requirement; workaround today = number + enum.
- `[P0] [demo-blocker] Nested/embedded objects in entity` — LineItems inside Cart, addresses inside Customer.
- `[P1] [non-blocker] Soft-delete markers as first-class` — needed for order/cart lifecycle audit.
- `[P1] [non-blocker] Medusa-style cross-module "link"` — map to rntme's service-boundary semantics (one service per rntme instance → links could mean "foreign-service-ref" annotations that inform Zeebe/gRPC wiring).
- `[P2] [non-blocker] Migrations / schema evolution` — currently manual; Medusa generates from DML.

- [ ] **Step 3.1: Write doc skeleton with all required H2 sections and gap heading shells**

Use the template from spec §4 verbatim. Include the candidate gaps above as section shells.

- [ ] **Step 3.2: Fill "What rntme has today" from PDM source code**

Read `packages/pdm/src/types/artifact.ts`, `packages/pdm/src/parse/schema.ts`, `demo/issue-tracker-api/artifacts/pdm.json`. Write 6–10 bullets with code pointers.

- [ ] **Step 3.3: Fill "How Medusa handles it" from survey report A**

Read `docs/superpowers/reports/2026-04-14-medusa-survey-a-domain-dml.md`. Write 6–10 bullets with `research/medusa/...` pointers.

- [ ] **Step 3.4: Fill each gap body (Why critical / Pain point / Medusa reference / Authorability)**

For each gap heading shell, write the four required sub-sections (3–6 sentences each).

- [ ] **Step 3.5: Fill "Intersections with out-of-scope"**

Notes like: "Cross-service entity links — live as Zeebe/gRPC integration concerns, not PDM features." "Schema-runtime migrations on Turso — SQLite-dialect only."

- [ ] **Step 3.6: Fill "Open questions"**

At minimum: *"Should PDM express foreign-service-ref as a first-class relation type, or keep it as metadata tag?"*

- [ ] **Step 3.7: Verify acceptance criteria**

Run:

```bash
grep -c '^### \[P[012]\] \[' docs/gaps/pdm-gaps.md
grep -c '\*\*Pain point in rntme today\*\*' docs/gaps/pdm-gaps.md
grep -c '\*\*Authorability / visualization\*\*' docs/gaps/pdm-gaps.md
grep -c 'packages/.*:[0-9]' docs/gaps/pdm-gaps.md
grep -c 'research/medusa/.*:[0-9]' docs/gaps/pdm-gaps.md
```

Expected: first three counts equal (≥3 each, matching); last two ≥1 each.

- [ ] **Step 3.8: No commit yet**

Batch commit all six gap docs at end of Task 8 to keep the hub consistent with thematic docs.

---

## Task 4: Thematic doc — `bindings-gaps.md`

**Files:**
- Create: `docs/gaps/bindings-gaps.md`

**Inputs:** Medusa survey C (HTTP/OpenAPI), current rntme bindings code at `packages/bindings/src/openapi/emit.ts`, `packages/bindings/src/openapi/shapes.ts`, `packages/bindings-http/src/` (runtime).

**Acceptance criteria:** Same structural criteria as Task 3 (H1, five H2s, tagged gaps with four mandatory sub-sections, ≥1 rntme + ≥1 Medusa pointer).

**Candidate gaps:**
- `[P0] [demo-blocker] Idempotency-Key middleware + storage` — commerce retry correctness requires it; affects LLM's ability to author retry-safe bindings.
- `[P0] [non-blocker] gRPC/protobuf binding emit` — vision: bindings must cover inter-service gRPC surface, not just HTTP.
- `[P1] [demo-blocker] Error catalog with stable codes in OpenAPI` — rntme already has CommandExecutionError codes; gap = explicit enum in OpenAPI + cross-reference.
- `[P1] [non-blocker] Multipart / file upload handling`.
- `[P1] [non-blocker] Discriminator / oneOf in responses` (polymorphic orders, products).
- `[P2] [non-blocker] Webhooks/callbacks emit in OpenAPI 3.1`.

- [ ] **Step 4.1: Skeleton with all H2s and gap shells.**
- [ ] **Step 4.2: "What rntme has today"** — from `packages/bindings/src/openapi/emit.ts`, `shapes.ts`, `packages/bindings-http/src/`.
- [ ] **Step 4.3: "How Medusa handles it"** — from survey C.
- [ ] **Step 4.4: Fill each gap body.**

For the **gRPC binding emit** gap, note no direct Medusa analogue (Medusa is HTTP-only) — cite "No direct Medusa analogue — rationale from platform vision (inter-service gRPC transport)".

- [ ] **Step 4.5: "Intersections with out-of-scope"** — gRPC *transport* layer (connection, service mesh) is not rntme; rntme only emits contracts.
- [ ] **Step 4.6: Open questions** — at minimum: *"Separate artifact file `grpc-bindings.json` or merge into existing bindings artifact with transport: 'grpc'|'http' discriminator?"*
- [ ] **Step 4.7: Verify acceptance criteria**

Same grep battery as Task 3:

```bash
f=docs/gaps/bindings-gaps.md
grep -c '^### \[P[012]\] \[' "$f"
grep -c '\*\*Pain point in rntme today\*\*' "$f"
grep -c '\*\*Authorability / visualization\*\*' "$f"
grep -c 'packages/.*:[0-9]' "$f"
grep -c 'research/medusa/.*:[0-9]' "$f"
```

- [ ] **Step 4.8: No commit yet.**

---

## Task 5: Thematic doc — `queries-and-projections-gaps.md`

**Files:**
- Create: `docs/gaps/queries-and-projections-gaps.md`

**Inputs:** Medusa survey A + B (for query patterns / module repos), rntme graph-IR at `packages/graph-ir-compiler/src/types/relational.ts`, `packages/graph-ir-compiler/src/emit/sqlite.ts`, QSM at `packages/qsm/src/`, projection-consumer at `packages/projection-consumer/src/`.

**Acceptance criteria:** Same structural criteria + **must contain a dedicated §"QSM vs ksqlDB boundary"** (not just a mention). This is the answer to open question 2 from the spec.

**Candidate gaps:**
- `[P0] [demo-blocker] Derived projections (computed columns on cart totals, order sums)`.
- `[P0] [demo-blocker] Joins/aggregations in graph-IR` — `addToCart` result must enrich LineItem with Variant.
- `[P1] [non-blocker] Cursor pagination` (offset-only today).
- `[P1] [non-blocker] Graph-IR visual readability` — stable node positions / labels for UI rendering.
- `[P2] [non-blocker] Full-text search operator`.
- `[P2] [non-blocker] Window functions` (SQLite-compatible subset only per spec §9).

- [ ] **Step 5.1: Skeleton.**
- [ ] **Step 5.2: "What rntme has today"** — graph-IR operators (6 current), QSM entity-mirror, projection handler spec.
- [ ] **Step 5.3: "How Medusa handles it"** — from survey A/B (repo query patterns, remote links).
- [ ] **Step 5.4: Fill each gap body.**
- [ ] **Step 5.5: §"QSM vs ksqlDB boundary"** (required) — propose the split:

  - *QSM owns:* entity-mirror projections for the owning service, immediate consistency needed for command validation.
  - *ksqlDB owns:* cross-service analytics, derived aggregates that don't need command-path consistency, stream-to-stream transforms.
  - *Ambiguous cases:* derived cart totals (QSM vs ksqlDB? — answer: QSM, because `addToCart` reads them for validation).

  Insert this discussion before `## Open questions`.

- [ ] **Step 5.6: "Intersections with out-of-scope"** — cross-service analytics projections → ksqlDB, not QSM.
- [ ] **Step 5.7: Open questions** — at minimum: *"Does graph-IR need a stable node-id + position emit for UI rendering, or is layout a UI-layer concern?"*
- [ ] **Step 5.8: Verify acceptance criteria + presence of QSM/ksqlDB section**

```bash
f=docs/gaps/queries-and-projections-gaps.md
grep -c '^### \[P[012]\] \[' "$f"
grep -c '\*\*Pain point in rntme today\*\*' "$f"
grep -c '\*\*Authorability / visualization\*\*' "$f"
grep -c 'packages/.*:[0-9]' "$f"
grep -iE 'qsm vs ksqldb|qsm and ksqldb' "$f"
```

Expected last grep: ≥1 match.

- [ ] **Step 5.9: No commit yet.**

---

## Task 6: Thematic doc — `commands-and-transactions-gaps.md`

**Files:**
- Create: `docs/gaps/commands-and-transactions-gaps.md`

**Inputs:** Medusa survey B (workflows/SDK), rntme event-store at `packages/event-store/src/`, projection-consumer at `packages/projection-consumer/src/`, graph-IR command emit, issue-tracker's composite command graph in `demo/issue-tracker-api/graphs/`.

**Acceptance criteria:** Same structural + **explicit statement of the Zeebe boundary** in the "Intersections" section + a dedicated sub-section `#### Intra-service multi-aggregate command shape` discussing the 3 options from spec §8 question 1.

**Candidate gaps:**
- `[P0] [demo-blocker] Intra-service multi-aggregate command with transactional guarantee` — `checkoutCart` touches cart+order.
- `[P0] [non-blocker] Outbox pattern for reliable event emission`.
- `[P1] [non-blocker] Exactly-once semantics in projection-consumer` (currently at-least-once + idempotent).
- `[P1] [non-blocker] Idempotency on API-level command retries` — intersects with bindings-gaps (cross-link).
- `[P2] [non-blocker] Scheduled/cron jobs primitive` — or is this out-of-scope (Zeebe timer events)?

- [ ] **Step 6.1: Skeleton.**
- [ ] **Step 6.2: "What rntme has today"** — single-aggregate emit, composite graph capacity guard (issue-tracker), event-store pattern.
- [ ] **Step 6.3: "How Medusa handles it"** — from survey B: workflow step/compensation API, distributed transaction manager, event bus delivery.
- [ ] **Step 6.4: Fill each gap body.**
- [ ] **Step 6.5: Sub-section `#### Intra-service multi-aggregate command shape`**

Discuss the three options from spec §8 question 1 (extended `emit` DAG, separate "saga-step" primitive, outbox+manual-compensation). Bullet tradeoffs, leave decision open.

- [ ] **Step 6.6: "Intersections with out-of-scope"** — **explicit**:
  - Cross-service saga orchestration → Zeebe (not in rntme).
  - Scheduled jobs at platform level → Zeebe timer events (may deprecate P2 gap above).
  - Event transformation / enrichment between services → ksqlDB.

- [ ] **Step 6.7: Open questions** — at minimum: *"If Zeebe handles scheduled jobs, do we need a scheduled-jobs primitive in rntme at all, or only Zeebe-triggered commands?"*
- [ ] **Step 6.8: Verify**

```bash
f=docs/gaps/commands-and-transactions-gaps.md
grep -c '^### \[P[012]\] \[' "$f"
grep -c '\*\*Pain point in rntme today\*\*' "$f"
grep -c '\*\*Authorability / visualization\*\*' "$f"
grep -c 'packages/.*:[0-9]' "$f"
grep -c 'Zeebe' "$f"
grep -c 'Intra-service multi-aggregate command shape' "$f"
```

Expected: last two greps ≥1 and ≥1.

- [ ] **Step 6.9: No commit yet.**

---

## Task 7: Thematic doc — `infra-and-operability-gaps.md`

**Files:**
- Create: `docs/gaps/infra-and-operability-gaps.md`

**Inputs:** all three survey reports (for Medusa infra patterns), rntme deployment config (none yet), `README.md`.

**Acceptance criteria:** Same structural + **Turso framing explicit** — scale-up discussion framed around Turso compatibility, not Postgres migration. Must contain a sub-section `#### Turso migration path` OR equivalent clearly-marked section.

**Candidate gaps:**
- `[P1] [non-blocker] Turso (libsql) compatibility audit` — verify all emitted SQL runs under Turso; add CI check.
- `[P1] [non-blocker] Observability — structured logs, traces, metrics, DLQ for projection-consumer`.
- `[P1] [non-blocker] Redis for event-bus / cache` — complements Kafka for low-latency pub/sub; or is this ksqlDB's job? Discuss.
- `[P2] [non-blocker] File/object storage abstraction` (S3-compatible).
- `[P2] [non-blocker] Snapshotting for event-store` — performance on long-lived aggregates.

Note: P0 may be absent here per spec §4.1 (no artificial P0).

- [ ] **Step 7.1: Skeleton.**
- [ ] **Step 7.2: "What rntme has today"** — SQLite single-writer; no first-party observability; Kafka relay for events; no file storage.
- [ ] **Step 7.3: "How Medusa handles it"** — from survey B/C: Redis pub/sub, file storage module, logger abstraction.
- [ ] **Step 7.4: Fill each gap body.**
- [ ] **Step 7.5: Sub-section `#### Turso migration path`**

State the constraint (SQL stays SQLite-dialect), the test plan (run full rntme test suite under Turso CLI/server), expected incompatibilities (window functions extensions, FTS variants), and the cut-over criteria (when demo's concurrent-write needs exceed SQLite's capacity).

- [ ] **Step 7.6: "Intersections with out-of-scope"** — plugin/module SDK is not in rntme; LLM-generated artifacts replace third-party extensibility.
- [ ] **Step 7.7: Open questions** — at minimum: *"Does rntme own an observability abstraction (pino wrapper + OpenTelemetry emit), or is it the operator's responsibility?"*
- [ ] **Step 7.8: Verify**

```bash
f=docs/gaps/infra-and-operability-gaps.md
grep -c '^### \[P[012]\] \[' "$f"
grep -c '\*\*Pain point in rntme today\*\*' "$f"
grep -c '\*\*Authorability / visualization\*\*' "$f"
grep -c 'packages/.*:[0-9]' "$f"
grep -c 'Turso' "$f"
grep -c 'Turso migration path' "$f"
```

Expected: last two ≥1 and ≥1.

- [ ] **Step 7.9: No commit yet.**

---

## Task 8: Commerce demo spec — `2026-04-14-commerce-demo-design.md`

**Files:**
- Create (gitignored): `docs/superpowers/specs/2026-04-14-commerce-demo-design.md`

**Inputs:** all 5 thematic gap docs (to anchor "blocking gaps" links), spec §7 for domain/workflows definition.

**Acceptance criteria:**
- H2 sections: `Goal`, `Domain`, `Workflows`, `Explicitly not in demo`, `Mapping (entity → capability → blocking gaps)`, `Minimum P0 subset (for next iteration)`.
- Each entity listed has a "blocking gaps" bullet list with `../gaps/<file>#<anchor>` links.
- Minimum P0 subset section enumerates ≥3 gap references by `[area]/[gap-name]`.

- [ ] **Step 8.1: Skeleton with all H2 sections.**
- [ ] **Step 8.2: Domain section** — copy verbatim from spec §7.1 (Product, Variant, Cart, LineItem, Order with state enums).
- [ ] **Step 8.3: Workflows section** — `addToCart` + `checkoutCart`, copy from spec §7.2 with concrete pseudo-graph-IR snippets (no need to be exact, indicative).
- [ ] **Step 8.4: "Explicitly not in demo"** — verbatim from spec §7.3 (payment/inventory/tax stubs, pricing deferred, multi-region placeholder, guest checkout).
- [ ] **Step 8.5: Mapping section — per entity, 3 bullets**

For each of Product/Variant/Cart/LineItem/Order:

- *Supported today:* "PDM supports top-level entity with id + string/number fields — `demo/issue-tracker-api/artifacts/pdm.json` as reference."
- *Blocking gaps:* list of `[../gaps/<file>#<anchor>](...)` links.
- *Workaround before gaps close:* what we do in interim.

For each of `addToCart`/`checkoutCart`:

- *Supported today:* references rntme single-emit graph pattern.
- *Blocking gaps:* link to multi-aggregate + derived-projection gaps.
- *Workaround:* e.g. "single aggregate with hand-written outbox INSERT" for checkout.

- [ ] **Step 8.6: "Minimum P0 subset" section**

Union of all `[P0]` gaps referenced in the mapping. Sort by area. Output as a numbered list with one-line rationale each. This IS the next-iteration ask.

- [ ] **Step 8.7: Verify**

```bash
f=docs/superpowers/specs/2026-04-14-commerce-demo-design.md
for h in Goal Domain Workflows 'Explicitly not in demo' 'Mapping' 'Minimum P0 subset'; do
  grep -c "^## .*$h" "$f"
done
grep -c '\.\./gaps/' "$f"
```

Expected: each H2 grep ≥1; `../gaps/` links ≥5 (at least one per mapped entity).

- [ ] **Step 8.8: No commit** (gitignored file).

---

## Task 9: Hub — `2026-04-14-medusa-class-roadmap.md`

**Files:**
- Create: `docs/gaps/2026-04-14-medusa-class-roadmap.md`

**Inputs:** all 5 thematic docs (aggregates the tier table), commerce-demo spec, platform-vision memory.

**Acceptance criteria:**
- H2 sections in order per spec §6: `Context`, `Target case`, `rntme snapshot today`, `Out of scope for rntme`, `Cross-cutting tier table`, `Dependency notes`, `Links`, `Open questions`.
- Tier table is a markdown table with columns exactly: `| Gap | Area | Maturity | Demo | Auth-impact |`.
- Tier table contains every `[P0]`-tagged gap from the 5 thematic docs (union check: `grep -h '^### \[P0\]' docs/gaps/{pdm,bindings,queries-and-projections,commands-and-transactions,infra-and-operability}-gaps.md | wc -l` ≤ count of P0 rows in the tier table).
- `Out of scope` section enumerates exactly 5 items: Zeebe, gRPC transport, ksqlDB, plugin/module SDK, LLM agent logic.
- `Links` section has working relative links to all 5 thematic docs AND to `../superpowers/specs/2026-04-14-commerce-demo-design.md`.
- `Open questions` section lists exactly 3 items (from spec §8 unresolved list).

- [ ] **Step 9.1: Skeleton with all H2s.**
- [ ] **Step 9.2: Context section** — 4–6 sentences, reference platform vision memory briefly, point to the spec doc.
- [ ] **Step 9.3: Target case** — define "commerce-class": multi-aggregate ops inside a service, long-running cross-service workflows (Zeebe), multi-currency/region, artifact authorability for LLM, visual validation by business users.
- [ ] **Step 9.4: rntme snapshot today** — 8–12 bullets covering PDM, QSM entity-mirror, graph-IR (6 operators + emit), bindings (OpenAPI 3.1), bindings-http (Hono + Zod), event-store, projection-consumer, Kafka relay, SQLite, demo/issue-tracker-api.
- [ ] **Step 9.5: Out of scope section** — exactly 5 bullets as listed.
- [ ] **Step 9.6: Cross-cutting tier table**

Enumerate every gap from the 5 thematic docs. Columns as specified. Sort by Maturity (P0 first) then Demo (demo-blocker first).

Rows must be keyed consistently — re-use gap names verbatim from thematic doc H3s. Auth-impact column is a 3–6 word phrase distilled from the thematic doc's gap body.

- [ ] **Step 9.7: Dependency notes section** — bullet list of "gap X unlocks gap Y" chains. Example: *"Money type in PDM → price emission in bindings → checkout workflow demo."*
- [ ] **Step 9.8: Links section**

```markdown
## Links

- [pdm-gaps.md](./pdm-gaps.md)
- [bindings-gaps.md](./bindings-gaps.md)
- [queries-and-projections-gaps.md](./queries-and-projections-gaps.md)
- [commands-and-transactions-gaps.md](./commands-and-transactions-gaps.md)
- [infra-and-operability-gaps.md](./infra-and-operability-gaps.md)
- [commerce-demo-design.md](../superpowers/specs/2026-04-14-commerce-demo-design.md) (gitignored — local working spec)
```

- [ ] **Step 9.9: Open questions** — the 3 unresolved items from spec §8 + attribution to which thematic doc will resolve each.
- [ ] **Step 9.10: Verify**

```bash
f=docs/gaps/2026-04-14-medusa-class-roadmap.md
for h in 'Context' 'Target case' 'rntme snapshot' 'Out of scope' 'Cross-cutting tier table' 'Dependency notes' 'Links' 'Open questions'; do
  grep -c "^## .*$h" "$f"
done
# P0 coverage: every P0 in thematic docs present in tier table
expected=$(grep -h '^### \[P0\]' docs/gaps/{pdm,bindings,queries-and-projections,commands-and-transactions,infra-and-operability}-gaps.md | wc -l)
# Each row in tier table starting with | <name> | has 4 other pipes
actual_p0=$(grep -E '^\| .* \| .* \| P0 \|' "$f" | wc -l)
echo "expected P0 rows: $expected; got: $actual_p0"
[ "$actual_p0" = "$expected" ] || echo "MISMATCH"
# Out-of-scope has 5 bullets (scan 30 lines after heading, count top-level '-' bullets)
grep -A 30 '^## .*Out of scope' "$f" | grep -c '^- '
# Open questions: exactly 3 (scan 30 lines after heading, count '1./2./3.' items)
grep -A 30 '^## .*Open questions' "$f" | grep -c '^[0-9]\. '
```

Expected: each H2 grep ≥1; expected==actual_p0 (no MISMATCH); 5 bullets in out-of-scope; 3 in open questions.

- [ ] **Step 9.11: No commit yet.**

---

## Task 10: Final verification pass + commit

**Files:** all `docs/gaps/*.md` + `.gitignore` (already committed in Task 1).

- [ ] **Step 10.1: Run full verification from spec §11**

```bash
# 6 files in docs/gaps/
ls docs/gaps/*.md | wc -l
# Demo spec exists (gitignored)
test -f docs/superpowers/specs/2026-04-14-commerce-demo-design.md && echo OK
# Only docs/gaps/* as new tracked files
git status --short docs/ .gitignore
# No Postgres-only SQL suggestion without Turso/SQLite workaround
grep -l -i 'postgres' docs/gaps/*.md | while read f; do
  echo "=== $f ==="
  # Every mention of 'Postgres' should be near 'Turso' or 'SQLite' within 5 lines
  grep -n -i -B2 -A5 'postgres' "$f"
done
```

Manually review the last output: every Postgres mention must sit near a Turso/SQLite framing (workaround or "Postgres not in plan" note). Fix inline if any naked Postgres mention is found.

- [ ] **Step 10.2: Commit all 6 gap docs in one commit**

```bash
git add docs/gaps/
git commit -m "docs(gaps): add medusa-class gap analysis (hub + 5 thematic + demo anchor)

- Hub aggregates cross-cutting tier table + out-of-scope section
- 5 thematic: pdm, bindings, queries-and-projections, commands-and-transactions, infra-and-operability
- Tagging: Maturity (P0/P1/P2) + Demo-blocker, authorability/visualization as body section
- Commerce-demo spec anchors blocking gaps (gitignored)

Spec: docs/superpowers/specs/2026-04-14-medusa-class-roadmap-design.md
Plan: docs/superpowers/plans/2026-04-14-medusa-class-roadmap.md"
```

- [ ] **Step 10.3: Verify final state**

```bash
git log --oneline -2
ls docs/gaps/
```

Expected: new commit visible; `docs/gaps/` contains hub + 5 thematic files.

---

## Execution notes

- Tasks 3–7 (five thematic docs) **can be parallelized** — each task reads its own survey report and its own rntme sub-package. If running via `subagent-driven-development`, dispatch all five in one message after Task 2 completes.
- Tasks 8 (demo spec) and 9 (hub) **must be sequential and after 3–7** — both aggregate from the thematic docs.
- Task 10 (verify + commit) is final.
- If a survey report is thin (Agent A/B/C returned less than expected), rerun that agent with a narrower, more prescriptive prompt — do NOT proceed to thematic docs with a weak base.
