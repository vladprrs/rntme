> Status: historical.
> Date: 2026-04-14.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Design: Medusa-class Roadmap (gap-analysis effort)

**Status:** Draft for review.
**Companion plan:** [`docs/history/reports/2026-04-14-medusa-class-roadmap-plan.md`](../reports/2026-04-14-medusa-class-roadmap-plan.md) — describes the *steps & schedule* to produce deliverables. This spec describes *how each deliverable is structured internally*.

## 1. Goal & framing

**Goal:** internal decision-framework — a gap-catalog that lets us pick the next 2–3 iterations of `rntme`, using a hypothetical commerce-class case (inspired by but not copying Medusa.js) as a forcing function.

**Audience:** ourselves (future-self). Prose can be terse; precision is for the structure, tagging, and code pointers.

**Outcome:** the **cross-cutting tier table** in the hub, plus a minimal-domain `commerce-api` demo spec that we plan to actually build after the roadmap closes its P0 items.

## 2. Platform context (anchors every scope decision)

rntme is the **per-service artifact-based runtime** inside a larger business platform:

- LLM agents talk to business users, decompose requests into DDD services, and emit rntme artifacts (PDM, QSM, graph-IR, bindings) per service.
- Each service runs event-sourced + CQRS on rntme for evolution-without-rewrites.
- **Cross-service orchestration** → **Zeebe** (sagas, long-running workflows with compensation).
- **Sync inter-service calls** → **gRPC** transport (rntme emits gRPC bindings alongside HTTP bindings).
- **Downstream event transformation & analytics projections** → **ksqlDB**, sitting on the Kafka bus.
- **Scale path for rntme's DB** → **Turso** (SQLite-compatible Rust rewrite solving concurrent writes). Postgres is **not** a target.
- **Observability/validation UI** (future layer) renders **all artifacts** — PDM, QSM, graph-IR, bindings — so business users can visually verify logic before deploy.

### 2.1 Out of scope for rntme (and for this roadmap)

Stated explicitly in the hub document so gap readers don't expect these:

- Cross-service workflow / saga runtime → Zeebe.
- Service-to-service RPC transport → gRPC layer (separate from rntme, though rntme emits contracts).
- Downstream event transformation / cross-service analytics projections → ksqlDB.
- Plugin / module SDK for third parties (Medusa-style) → replaced by LLM-agent artifact generation.
- LLM agent logic itself → separate platform component.
- Postgres migration → replaced by the Turso plan.

Gaps that fall into these areas may still be *mentioned* in the thematic docs for context, but never as P0/P1/P2 targets for rntme.

## 3. Deliverables

| # | Path | Committed? |
|---|------|------------|
| 1 | `docs/gaps/2026-04-14-medusa-class-roadmap.md` (hub) | yes |
| 2 | `docs/gaps/pdm-gaps.md` | yes |
| 3 | `docs/gaps/bindings-gaps.md` | yes |
| 4 | `docs/gaps/queries-and-projections-gaps.md` | yes |
| 5 | `docs/gaps/commands-and-transactions-gaps.md` | yes |
| 6 | `docs/gaps/infra-and-operability-gaps.md` | yes |
| 7 | `docs/history/specs/active-rationale/2026-04-14-commerce-demo-design.md` | no (gitignored, working spec) |
| 8 | `.gitignore` root — add `/research/` | yes |

Naming deltas from the original plan:

- `openapi-gaps.md` → **`bindings-gaps.md`** — covers both HTTP/OpenAPI 3.1 bindings and gRPC/protobuf bindings; any future binding shape lands here.
- `workflows-and-commands-gaps.md` → **`commands-and-transactions-gaps.md`** — scope narrows to intra-service after Zeebe takes cross-service sagas.
- `infra-and-extensibility-gaps.md` → **`infra-and-operability-gaps.md`** — plugin/module extensibility is out; infra/operability (Turso, Redis, observability) stays.

## 4. Thematic gap-doc template

Every thematic gap-doc (deliverables 2–6) follows this structure so the hub can aggregate consistently:

```markdown
# Gaps: <topic>

## What rntme has today
- Concept: …
- Code pointers: <pkg>:<file>:<lines>
- What works for the issue-tracker demo: …

## How Medusa handles it
- Concept: …
- Code pointers: research/medusa/…
- Key technique: money type / DML link / idempotency middleware / …

## Gaps for commerce-class case (tagged)
Each gap heading: `[P0|P1|P2] [demo-blocker|non-blocker] <gap name>`

Body of each gap:
- **Why critical / DX impact.**
- **Pain point in rntme today** (concrete pattern / line).
- **Medusa reference** (how they solve it).
- **Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.

## Intersections with out-of-scope
- Which parts of this topic are actually covered by Zeebe / gRPC / ksqlDB, so we do NOT build them into rntme.

## Open questions
- …
```

### 4.1 Depth policy

All five thematic docs are written at **full depth** in one session. Every gap must have:

- Maturity tag (P0/P1/P2).
- Demo-blocker tag.
- At least one concrete rntme code pointer.
- Medusa code pointer if the concept has an analogue there. If the gap is unique to our platform vision (e.g., LLM-authorability concerns, Zeebe/ksqlDB boundary), note explicitly: *"No direct Medusa analogue — rationale from platform vision"* and proceed.
- 3–4 lines on authorability/visualization impact.

## 5. Tagging schema (two axes + authorability section)

### Axes

| Tag | Values | Meaning |
|-----|--------|---------|
| **Maturity** | `P0` / `P1` / `P2` | P0 = blocker for commerce-class maturity of rntme. P1 = required for serious production cases (ops/scale). P2 = DX / nice-to-have. |
| **Demo blocker** | `demo-blocker` / `non-blocker` | `demo-blocker` = `demo/commerce-api` cannot be built correctly without this. `non-blocker` = demo works (perhaps with ugly workarounds). |

### Authorability / visualization — not a tag

Kept as a **mandatory body section** inside every gap (3–4 lines), not a column in the tier table. Rationale: it's qualitative, cross-cutting across all artifact types (PDM / QSM / graph-IR / bindings), and flattening it to `high/med/low` would lose signal. The hub's tier table includes a short *"auth-impact"* summary column derived from these sections.

## 6. Hub structure (`2026-04-14-medusa-class-roadmap.md`)

Sections in order:

1. **Context + platform vision recap** — short, references memory and §2 of this spec.
2. **Target case** — what "commerce-class complexity" means: multi-aggregate ops within a service, long-running workflows (handled by Zeebe, not us), multi-currency/region, artifact authorability for LLM, visual validation.
3. **rntme snapshot today** — PDM, QSM entity-mirror, graph-IR (6 relational operators + emit), Hono router, OpenAPI 3.1 emit, SQLite, Kafka relay, event-store.
4. **Out of scope for rntme** — the §2.1 list, verbatim, so any reader starts with the boundary clear.
5. **Cross-cutting tier table** — flat, sorted by Maturity then Demo. The `Auth-impact` column is a **short phrase** (3–6 words) distilled from the gap's authorability section (e.g., "unlocks LLM money emit", "stable retry codes for agent"):

    ```
    | Gap | Area | Maturity | Demo | Auth-impact (short) |
    ```

6. **Dependency notes** — gaps that unlock other gaps (e.g., `Money type in PDM` → `price emission in bindings` → `checkout workflow demo`).
7. **Links** — to the 5 thematic docs and the commerce-demo spec.
8. **Open questions** — the list from §8 below.

## 7. Commerce demo spec (`2026-04-14-commerce-demo-design.md`)

Deliverable #7, gitignored working spec (per repo convention: `/docs/superpowers/` is ignored; this is fine — `demo/commerce-api` itself lives in `demo/` and *is* committed when we build it).

### 7.1 Domain (one service, one rntme instance)

- **Product** — title, description, handle.
- **Variant** — sku, title, price, inventory_quantity (placeholder).
- **Cart** — customer_id (optional), region_id (optional), currency_code, state ∈ {`open`, `completed`, `abandoned`}.
- **LineItem** — variant_id, quantity, unit_price, cart_id.
- **Order** — cart_id, customer_id (optional), total, status ∈ {`pending`, `confirmed`, `cancelled`}.

### 7.2 Workflows

1. **`addToCart`** — single-aggregate command: validate cart is open, variant exists, qty > 0; append LineItem; update derived cart totals.
2. **`checkoutCart`** — **intra-service multi-aggregate**: validate cart → emit `OrderPlaced` event + create Order → transition cart to `completed`. No distributed saga (payment/inventory/shipping sit behind Zeebe in real deployment; in demo they're stubs with `# would be Zeebe-orchestrated call to X-service` comments).

### 7.3 Explicitly not in demo

- Payment processing, inventory allocation, shipping calculation, tax.
- Pricing rules, promotions, discounts.
- Multi-region / multi-currency conversion (we keep `currency_code` as a placeholder field only).
- Customer/auth flows (guest checkout is acceptable).

### 7.4 Mapping

For each entity and each workflow, the spec lists:

- Which rntme capability already supports it (code/artifact reference).
- Which gaps (anchored link into thematic docs) block correct implementation.
- Interim workaround if we choose to build demo before the gap is closed (e.g., "use `number` + `enum currency_code` until `Money` type lands in PDM").

The union of blocking gaps → **the minimum P0 subset** that must close before demo is buildable. This subset is what feeds the next rntme iteration plan.

## 8. Open questions

Carried into the hub, resolved during thematic-doc review (not in this spec):

1. **Intra-service multi-aggregate command shape.** Options: (a) extend `emit` to DAG-emit with transactional guarantee; (b) introduce a "saga-step" primitive for intra-service only; (c) rely on outbox + manual compensation. Lands in `commands-and-transactions-gaps.md`.
2. **QSM vs ksqlDB boundary.** Which projections stay in QSM (entity-mirror tied to one service's events) and which go to ksqlDB (analytics, cross-service joins, derived stats). Lands in `queries-and-projections-gaps.md`.
3. **"View-artifact" format for UI.** Is current JSON artifact format rich enough for the visualization UI (positions, labels, groupings) or do we need a separate "view-artifact" emit? Cross-cutting; each thematic doc notes its angle, hub aggregates.

**Closed by platform vision (no longer open):**

- ~~Postgres-mandatory vs SQLite~~ → replaced by Turso plan; SQL stays SQLite-dialect.
- ~~Workflow runtime vs multi-aggregate command~~ → cross-service workflows go to Zeebe; only intra-service remnant survives as question #1 above.
- ~~Demo scope boundary (pricing/tax/inventory)~~ → decided in §7.3: not in demo, stub comments only.

## 9. SQL-dialect constraint (cross-cutting)

All SQL emitted by rntme packages (QSM DDL, graph-IR compiler, projection-consumer queries) stays **strictly SQLite-compatible** so the Turso migration is drop-in. No Postgres-only features: no `gen_random_uuid()`, no `JSONB`, no `ARRAY`, no `ltree`, no Postgres-extension window functions.

Any gap doc suggesting "use Postgres feature X" must be rewritten as "does SQLite/Turso support this; if not, what's the workaround?"

## 10. Execution order

Sequenced so early outputs inform later ones:

1. Add `/research/` to root `.gitignore`; sparse-clone Medusa into `research/medusa/`.
2. Run three parallel `Explore` agents on Medusa (Domain/DML, Module/Workflow runtime, HTTP API + OpenAPI). Short reports per plan.
3. Write the 5 thematic gap-docs (parallelizable; full depth per §4).
4. Write the commerce-demo spec (§7).
5. Write the hub (§6) — goes last because it aggregates the tier table from the other docs.
6. Verification per the companion plan §Step 6.

## 11. Verification (reused from companion plan + additions)

- `ls docs/gaps/` → 6 files.
- `docs/history/specs/active-rationale/2026-04-14-commerce-demo-design.md` exists (gitignored is fine).
- `git status` shows only `.gitignore` + `docs/gaps/*` as tracked changes; `research/medusa/` ignored.
- Hub has working relative links to all thematic docs and the commerce-demo spec.
- Each thematic doc has ≥1 tagged gap with rntme code pointer (P0 present if the topic warrants — no artificial P0 if none exist; in that case hub notes the topic has no current P0).
- Every gap has both tags (Maturity, Demo-blocker) and an authorability/visualization section.
- Hub contains an explicit §"Out of scope for rntme" matching §2.1.
- No thematic doc suggests a Postgres-only SQL feature without a SQLite/Turso workaround.
- Demo spec contains explicit mapping demo → blocking gaps → minimum P0 subset.
