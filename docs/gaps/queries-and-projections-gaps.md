# Gaps: Queries and Projections

Thematic gap document covering read-side concerns for the commerce-class demo: QSM entity-mirror projections, graph-IR relational queries, and the boundary between QSM and the ksqlDB analytics layer. All SQL emitted here must remain strictly SQLite-compatible per spec §9 (Turso target).

## What rntme has today

- **QSM (Query-Side Mirror)** derives an `entity-mirror` projection per aggregate: one SQLite table containing every PDM field for the entity, plus three fixed idempotency columns (`last_event_id`, `last_event_version`, `applied_at`). DDL is generated from PDM + QSM artifact by `generateProjectionDdl` (`packages/qsm/src/derive/ddl.ts:36`); composite primary keys are supported at DDL level (`packages/qsm/src/derive/ddl.ts:122`).
- **Projection consumer** compiles each event handler into a single `INSERT ... ON CONFLICT DO UPDATE` (for creation events) or `UPDATE ... WHERE last_event_version < ?` (for state-transition events). Each handler touches exactly one aggregate row keyed by a single-column PK — composite keys are explicitly rejected at compile time (`packages/projection-consumer/src/apply/compile.ts:22`).
- **Idempotency layering** is strict monotone-version: pre-check `SELECT last_event_version`, `INSERT ON CONFLICT` guarded by `excluded.last_event_version > current`, and update guarded by `WHERE last_event_version < ?` (`packages/projection-consumer/src/apply/apply-event.ts:9`).
- **Graph-IR relational layer** has 6 operators today: `Scan`, `Filter`, `Project`, `Aggregate`, `Sort`, `Limit`, `Join` (`packages/graph-ir-compiler/src/types/relational.ts:5`). Lowering to SQLite is in `packages/graph-ir-compiler/src/lower/sqlite/lower.ts:15`; the `Join` operator is declared in the type but the lowering `switch` has no `case 'Join'` branch and falls through to `throw new Error(\`lowerToSqlite: operator ${rel.op} not yet supported\`)` (`packages/graph-ir-compiler/src/lower/sqlite/lower.ts:154`). Multi-segment field paths like `cart.line_items.variant.price` are lowered via PDM-driven join expansion (`packages/graph-ir-compiler/src/lower/sqlite/lower.ts:256`) but only when they terminate at a scalar column — there is no Join-result projection.
- **QSM resolver** (`packages/qsm/src/resolvers/qsm-resolver.ts:14`) enforces that each entity has at most one `entity-mirror` projection; alternate backings are reserved in the type (`p.backing ?? 'entity-mirror'` at line 54) but the only one the pipeline actually understands is `entity-mirror` (`packages/qsm/src/derive/handler.ts:53` skips anything else).
- **Pagination** is offset-only and expressed via `RelLimit` (`packages/graph-ir-compiler/src/types/relational.ts:37`). There is no cursor, no `after`, no stable-key pagination contract; `Sort + Limit` is the only tool.

## How Medusa handles it

- Entities can declare **computed columns** at DML level via `.computed()` — e.g. `total: model.bigNumber().computed()`, `item_total: model.bigNumber().computed()`, `discount_total: model.bigNumber().computed()` on the Cart model (`research/medusa/packages/modules/cart/src/models/cart.ts:146`). The `ComputedProperty` wrapper flips a `computed: true` flag in the parsed schema (`research/medusa/packages/core/utils/src/dml/properties/computed.ts:36`), telling Medusa to skip DB persistence and compute the value at read-time in the service layer.
- **Relations drive joins** declaratively: `model.hasMany`, `model.belongsTo`, `model.manyToMany` (`research/medusa/packages/core/utils/src/dml/entity-builder.ts:473`) are consumed by MikroORM + Medusa's `QueryGraph` to produce joined queries with nested shape. A cart fetched with `line_items.variant` is a single request that hydrates the tree.
- **Cross-module joins** use the DML "link" concept — a link module declares a pivot table + relationships across module boundaries (`research/medusa/packages/modules/link-modules/src/definitions/product-sales-channel.ts:4`) and injects virtual fields so the aggregator can span service boundaries without direct FKs.
- **Pagination** exposes both offset and cursor-like shapes: `{ skip, take }` (`research/medusa/packages/core/types/src/common/common.ts:72`) and `offset` (`research/medusa/packages/core/types/src/common/common.ts:140`). Downstream services layer stable-key cursor semantics on top.
- **Full-text / free search** is handled outside core DML (Algolia / MeiliSearch modules) — Medusa's DML does not define a `fulltext` operator.

## Gaps for commerce-class case

### [P0] [demo-blocker] Derived projections (computed cart totals / order sums)

**Why critical / DX impact.**
The commerce demo's `addToCart` command specifies "append LineItem; update derived cart totals" (spec §7). QSM today only mirrors PDM fields 1:1 from event payloads; there is no way to express `cart.total = sum(line_items.quantity * line_items.unit_price)` as a QSM column kept in sync with `LineItemAdded` events. Without derived projections, the command-path read that validates "cart is open and total ≤ capacity" must do a join+aggregate on every command — defeating the whole point of a mirror.

**Pain point in rntme today** (concrete pattern/line).
Every handler in `packages/projection-consumer/src/apply/compile.ts:67` is either `compileInsert` or `compileUpdate` keyed on a single aggregate row; the `setColumns` list is derived strictly from `EventTypeSpec.affects` (`packages/qsm/src/derive/handler.ts:116`). There is no concept of a column whose value is a function of other rows in the same or a different mirror. `allMirrorColumns = entity.fields.map((f) => f.column)` at `packages/qsm/src/derive/handler.ts:75` enumerates exactly the persisted scalar fields — no computed extensions.

**Medusa reference** (how they solve it).
Medusa exposes `.computed()` on any DML property and flips a `computed: true` flag during schema parse (`research/medusa/packages/core/utils/src/dml/properties/computed.ts:36`). Cart totals (`total`, `item_total`, `subtotal`, `discount_total`, `tax_total`, etc.) are all declared `model.bigNumber().computed()` on the Cart entity (`research/medusa/packages/modules/cart/src/models/cart.ts:146`) and computed at read-time by the service. rntme's equivalent should be QSM-side (materialized on event, not on read) because the command path needs sub-millisecond access.

**Authorability / visualization** — LLM agents can easily write `total = sum(line_items.unit_price * line_items.quantity)` as a declarative QSM field; what they cannot easily write is a custom handler that edits `cart_total` on each LineItem event. A `derived: { expr, triggeredBy: ["LineItemAdded","LineItemRemoved"] }` clause in the QSM artifact, rendered in the viz UI as a dashed arrow from trigger events to the derived column, keeps derivation visible. The compiler emits an extra `UPDATE cart SET total = (SELECT SUM(...) FROM line_item WHERE cart_id = ?)` step in the projection transaction, all SQLite-compatible.

### [P0] [demo-blocker] Joins / aggregations in graph-IR

**Why critical / DX impact.**
`addToCart` must read `LineItem` enriched with `Variant.price` (or at least `Variant.is_active`) to validate and to stamp `unit_price` on the new line. The command is a graph-IR read, and graph-IR today cannot lower a `Join` operator. Without it the demo command cannot be written declaratively; it degrades to imperative TypeScript outside the artifact, losing both LLM-authorability and visualization.

**Pain point in rntme today** (concrete pattern/line).
`RelJoin` is declared in the type union (`packages/graph-ir-compiler/src/types/relational.ts:39`) but the SQLite lowering `switch` has no `case 'Join'` and throws at the `default` branch (`packages/graph-ir-compiler/src/lower/sqlite/lower.ts:154`). Multi-segment field paths get a narrow auto-join path via `expandChain` / `chainToSqlJoins` (`packages/graph-ir-compiler/src/lower/sqlite/lower.ts:261`), but those are scalar-field-terminated only — you cannot project two rows of a related entity, and `relOutputColumns` explicitly throws `'lower: relOutputColumns not implemented for Join'` (`packages/graph-ir-compiler/src/lower/sqlite/lower.ts:233`).

**Medusa reference** (how they solve it).
Relations drive nested reads — `model.hasMany(() => LineItem)` on Cart (`research/medusa/packages/core/utils/src/dml/entity-builder.ts:473`) is enough for Medusa's query layer to return a cart with its line items and each line item's variant in one call. For cross-service joins (not needed in our single-service demo) they add the link-module mechanism (`research/medusa/packages/modules/link-modules/src/definitions/product-sales-channel.ts:4`).

**Authorability / visualization** — A concrete `Join` lowering unblocks `LineItem × Variant` for the command's read phase. In the artifact, `join: { right: "Variant", on: "variant_id", kind: "inner" }` is easy for an LLM to emit and easy to render as a connecting node between two scan boxes in the viz UI. Constrain the lowering to `inner` and `left` only (already in the type), single `leftCol/rightCol` equi-joins — no Postgres-only hash/lateral joins. All emitted SQL stays SQLite-compatible.

### [P1] [non-blocker] Cursor pagination

**Why critical / DX impact.**
Admin-facing list endpoints (e.g. `GET /carts?status=open`) should be stable across inserts; offset pagination drifts under concurrent writes. This is not a demo-blocker because the demo's happy-path flow uses single-aggregate reads, but any "list" binding in the public API will hit this.

**Pain point in rntme today** (concrete pattern/line).
`RelLimit` takes `count: number | { $param: string }` (`packages/graph-ir-compiler/src/types/relational.ts:37`) and `lower` simply attaches it as `child.limit` (`packages/graph-ir-compiler/src/lower/sqlite/lower.ts:67`). There is no `after: $cursor` shape, no `Sort + StableKeyAfter` operator pair, no contract for emitting a `next_cursor` back to the caller.

**Medusa reference** (how they solve it).
Medusa exposes both `skip` and `take` on list shapes (`research/medusa/packages/core/types/src/common/common.ts:72`) and `offset` on paginated response envelopes (`research/medusa/packages/core/types/src/common/common.ts:140`). Cursor semantics are layered by higher services, not baked into the DML — which is a reasonable precedent: put the cursor logic in graph-IR, not PDM.

**Authorability / visualization** — An `after: { col: "created_at", value: $cursor }` clause pairs naturally with an existing `Sort` operator as a new `RelStableAfter` op (or desugared as `Filter(col > cursor) + Sort + Limit`). The UI renders a cursor icon on the Limit node and a side-channel `cursor_out` label. Critical constraint: the sort key must be unique-or-tiebreak-by-PK to be a valid cursor. This is the same pattern used by most SQLite-backed projection stores.

### [P1] [non-blocker] Graph-IR visual readability

**Why critical / DX impact.**
The viz UI is the main feedback channel for business users ("does this query do what I asked?"). Today the relational IR has no stable node IDs, no position hints, no human labels — so every re-emit of the same artifact could render with different layout, and renamed aliases break all muscle memory. This is open question 3 in the spec.

**Pain point in rntme today** (concrete pattern/line).
`RelScan`, `RelFilter`, `RelProject` etc. carry only structural fields (`packages/graph-ir-compiler/src/types/relational.ts:1`); none carry `id`, `label`, or layout metadata. The compiler deterministically walks the tree but does not stamp stable identifiers, so a UI cannot reliably diff "before" and "after" versions of a query.

**Medusa reference** (how they solve it).
No direct Medusa analogue — rationale: Medusa does not have a visual graph-IR surface; its queries are imperative TypeScript plus decorators. This gap is unique to the rntme/LLM-agent platform vision where every artifact must render visually.

**Authorability / visualization** — Add an optional `nodeId: string` and `label?: string` to each RelOp variant; the compiler guarantees stable IDs by content-hashing subtree shape (or walks the tree with a deterministic counter). Position is a UI-layer concern — the artifact should NOT carry `x, y` — but **stable IDs** are a compiler concern so the UI can store positions by ID. This keeps the artifact deployment-focused and the layout ergonomic-focused.

### [P2] [non-blocker] Full-text search operator

**Why critical / DX impact.**
Any non-trivial admin UI needs "search carts by customer name or email substring". Without a full-text operator in graph-IR, LLM agents fall back to `LIKE '%...%'` projections that scan and can't use indexes. Not a demo-blocker; the demo's happy path does not include free-text search.

**Pain point in rntme today** (concrete pattern/line).
No full-text operator exists in `RelOp` union (`packages/graph-ir-compiler/src/types/relational.ts:48`). The only string operators are whatever `Filter.predicate` admits via the expression language — equality and comparison, no MATCH / contains / prefix.

**Medusa reference** (how they solve it).
No direct Medusa analogue — rationale: Medusa delegates full-text to external providers (Algolia, MeiliSearch) via a dedicated index module, not its core DML. We can follow the same split long-term, but need a baseline in-process operator for the demo.

**Authorability / visualization** — SQLite ships FTS5 — a `RelFtsMatch { table, column, query: $param }` operator lowers to `<table> MATCH ?` on an FTS5 virtual table (staying strictly SQLite-compatible, no Postgres `tsvector`). The projection consumer would also need a new `backing: "fts5"` in QSM that writes a shadow `CREATE VIRTUAL TABLE ... USING fts5` next to the entity-mirror. Visualization: a search-icon node connected to the scan.

### [P2] [non-blocker] Window functions (SQLite-compatible subset)

**Why critical / DX impact.**
"Most recent order per customer", "running cart total by line-item order", "top-N orders per status": these are natural asks for admin reports. Not demo-critical, but limits the analytical range of QSM-backed reads before we hand off to ksqlDB.

**Pain point in rntme today** (concrete pattern/line).
`RelAggregate` takes `group` + `measures` only (`packages/graph-ir-compiler/src/types/relational.ts:23`); there is no `partition_by`, no `row_number`, no `rank`. The measure set in `measureToAggSql` (`packages/graph-ir-compiler/src/lower/sqlite/lower.ts:28`) is limited to `count`, `count_distinct`, `group_array`, and generic aggs — no window frame.

**Medusa reference** (how they solve it).
No direct Medusa analogue — rationale: Medusa computes ranked/windowed views by issuing multiple queries or by materialized DB views, not through a declarative IR. Our target (ksqlDB handoff) covers the analytics tier, so the in-process subset should stay minimal.

**Authorability / visualization** — SQLite has solid window-function support (`ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)`, `RANK`, `LAG`, `LEAD`). Add `RelWindow { partition, order, fn }` as an operator, but restrict to the SQLite-compatible subset and reject Postgres-only constructs like `FILTER (WHERE ...)` at validate-time. Visualization: a framed box over the feeding node showing partition + order keys. All anything more analytically ambitious (cross-aggregate, streaming, large-scan) belongs in ksqlDB — see next section.

## QSM vs ksqlDB boundary

This section answers open question 2 from the roadmap spec (`docs/superpowers/specs/2026-04-14-medusa-class-roadmap-design.md:171`): where does QSM end and ksqlDB begin? The decision framework below runs QSM vs ksqlDB on three axes: ownership, consistency-to-command-path, and scope (single vs cross-service).

### QSM owns

- **Entity-mirror projections for the owning service.** Every aggregate in the PDM gets a single SQLite-backed mirror that the service's own command path reads from. This is the contract already encoded by `deriveProjectionHandler` + `compileApplyPlan` (`packages/projection-consumer/src/apply/compile.ts:11`): one mirror per aggregate, same service, same process.
- **Derived columns needed for command validation.** Anything the command path must read synchronously to validate an invariant — cart totals, available stock per SKU in the same service, computed `is_open` flags — belongs in QSM. The update is applied in the same projection transaction as the event that triggered it, so reads are monotone-consistent with the event stream the command just appended to.
- **Immediate consistency guarantees.** QSM's `last_event_version` pre-check + `WHERE last_event_version < ?` guard (`packages/projection-consumer/src/apply/apply-event.ts:17`) is what makes "read-your-writes after command append" trivially correct. Nothing else in the stack gives that.

### ksqlDB owns

- **Cross-service analytics.** Any projection whose input stream spans more than one service's topic — "orders by customer across all tenants", "GMV per day per SKU" — belongs in ksqlDB, not QSM. A single service's QSM must not reach into another service's Kafka topic; that coupling would violate the service boundary the platform vision encodes.
- **Derived aggregates with no command-path dependency.** Admin dashboards, BI reports, marketing-segment rollups: these read from ksqlDB tables, are allowed to lag the event stream by seconds, and do not participate in any command's read-your-writes contract.
- **Stream-to-stream transforms.** Event-shape normalisation, tenant-aware filtering, join-then-emit derived-event streams: these live in ksqlDB and become new Kafka topics, which individual services may choose to mirror (back into their own QSM) if they need them on the command path.

### Ambiguous cases

- **Derived cart totals: QSM, not ksqlDB.** Even though "cart total" looks like an analytic aggregate, `addToCart` reads `cart.total` (or the implicit pre-update value) to validate capacity. Command-path reads fix this as QSM's responsibility; pushing it to ksqlDB would introduce lag the command can't tolerate.
- **"Count of open carts per tenant" dashboard: ksqlDB.** Same math, different consumer. No command validates against this number, latency is fine in seconds.
- **Customer-facing "your order history": QSM of the Order service.** This is single-service, entity-mirror-shaped, and read-your-writes matters (the customer just placed the order). ksqlDB would be a mistake even though it reads like a report.
- **Reverse test.** If removing the projection would break a command-validation precondition, it belongs in QSM. Otherwise default to ksqlDB and only promote to QSM if measured latency demands it.

The split between QSM and ksqlDB is also the split between "artifact rntme owns and visualizes" (QSM declared in the per-service artifact bundle) and "artifact the analytics platform owns" (ksqlDB topology declared elsewhere, possibly by a different agent). Gap docs should not propose QSM features whose natural home is ksqlDB.

## Intersections with out-of-scope

- **Cross-service analytics projections → ksqlDB, not QSM.** Per the QSM vs ksqlDB boundary above, gaps that would push QSM toward multi-topic joins, GMV rollups, or cross-tenant aggregates are deliberately out of scope. QSM stays per-service, entity-mirror-shaped, SQLite-backed.
- **Zeebe owns cross-service sagas.** The `checkoutCart` command is explicitly intra-service (demo spec §7.3). Multi-service orchestration (payment capture, inventory reservation, shipping) is deferred to Zeebe and out of scope for any gap in this doc.
- **Synchronous cross-service reads → gRPC.** If service A's command needs data owned by service B, the platform vision routes that through gRPC, not through service A's QSM. QSM stays the owning service's read-model only.
- **Full-text / search indexing at scale.** The P2 FTS gap above covers an in-process SQLite FTS5 baseline. Enterprise search (faceted, typo-tolerant, multi-tenant) belongs in an external search service (Algolia/MeiliSearch/Typesense) and is out of scope.
- **Visualization layout (positions, groupings).** The P1 graph-IR readability gap explicitly keeps `x, y` positions out of the artifact; layout is a UI-layer concern. The artifact carries stable IDs and labels only.

## Open questions

1. **Does graph-IR need a stable node-id + position emit for UI rendering, or is layout a UI-layer concern?** Proposal: stable `nodeId` + optional `label` belong in the artifact (compiler-owned, content-hash-derived); `x, y` and grouping belong in a per-user layout store keyed by `nodeId`. Confirm during viz prototype.
2. **How are derived columns expressed in the QSM artifact grammar?** Candidates: (a) a `derived: { expr, triggeredBy: [...] }` clause per column; (b) a separate `derivations` block in the QSM artifact that references mirror columns. Option (a) is more LLM-authorable because the derivation lives next to the column it produces; (b) keeps the base mirror shape cleaner. Decide during PDM + QSM v2 design.
3. **Does QSM need a second-tier "aggregate-mirror" backing** for per-parent aggregates like `cart.line_item_count`, or do we always emit them as derived columns on the parent's entity-mirror? Both paths are SQLite-compatible; the question is artifact ergonomics and how the viz UI renders them.
4. **Should cursor pagination be a new `RelStableAfter` operator or desugared into `Filter + Sort + Limit`?** Desugaring is simpler but loses the "this is a cursor paginated read" signal in the IR, which the UI and tests both care about. Leaning toward explicit operator.
5. **FTS5 virtual-table lifecycle.** If we add `backing: "fts5"` projections, how do they coexist with `entity-mirror` during DDL generation and event apply? One transaction per event that updates both, or two independent handlers? Affects idempotency bookkeeping.
