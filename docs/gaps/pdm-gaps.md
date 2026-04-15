# Gaps: PDM

Thematic gap analysis of rntme's Problem Domain Model (PDM) artifact vs. Medusa.js DML, scoped to what a commerce-class service (the canonical "Cart → Order → LineItem → Money" shape) would demand from the platform. Input evidence: the rntme PDM source, the demo PDM (`issue-tracker`), and Medusa survey A (`docs/superpowers/reports/2026-04-14-medusa-survey-a-domain-dml.md`).

Scope reminder — rntme is a **per-service** artifact runtime inside a larger LLM-agent-driven DDD platform. Cross-service concerns (Zeebe sagas, gRPC transport, ksqlDB analytics, plugin SDK) are explicitly **out of PDM's scope** and are collected in the "Intersections" section below, not tagged as gaps.

## What rntme has today

- Entity shape is a flat record of **scalar fields only**, typed `integer | decimal | string | boolean | date | datetime` — see `packages/pdm/src/types/artifact.ts:4` (the `ScalarPrimitive` union).
- Fields are plain `{ type, nullable, column, generated? }` — no struct/object/nested shape is expressible (`packages/pdm/src/types/artifact.ts:19`).
- Generated markers are a closed set of four: `id | createdAt | updatedAt | actor` (`packages/pdm/src/types/artifact.ts:17`). There is **no `deletedAt` kind**, so soft-delete is not a first-class lifecycle marker.
- Relations are a thin `{ to, cardinality: 'one' | 'many', localKey, foreignKey }` shape (`packages/pdm/src/types/artifact.ts:28`). No `belongsTo`/`manyToMany`, no `cascades`, no `mappedBy`.
- Structural validation walks relations and requires `localKey`/`foreignKey` to exist on the corresponding entities — strictly local to the service (`packages/pdm/src/validate/structural.ts:37`).
- StateMachine is first-class on `Entity`, with `stateField` required to be a non-nullable `string` (`packages/pdm/src/validate/state-machine.ts:39`). This is what the demo `Issue` exploits for `draft → open → in_progress → resolved → closed`.
- Zod parse layer (`packages/pdm/src/parse/schema.ts:5`) enforces the scalar enum and rejects anything outside it, so extending the type system requires both a type change and a schema change.
- Entire artifact is one record: `{ entities: Record<string, Entity> }` (`packages/pdm/src/types/artifact.ts:60`). There is no notion of schema versioning, migrations, or cross-service boundary inside the artifact.
- Demo PDM uses conventions to approximate missing features — e.g., `priority` and `status` are plain `string` fields rather than enums (`demo/issue-tracker-api/src/artifacts/pdm.json:12-13`), and `storyPoints` is `integer` rather than a richer unit (see line 14).

## How Medusa handles it

- Entities are declared with `model.define(...)` producing a `DmlEntity` with implicit `created_at`, `updated_at`, and nullable `deleted_at` automatically present (`research/medusa/packages/core/utils/src/dml/entity-builder.ts:29`).
- Soft-delete is baked in: `deleted_at` ships on every entity and is auto-indexed with `deleted_at IS NULL` (`research/medusa/packages/core/utils/src/dml/helpers/entity-builder/create-default-properties.ts:14`).
- Primitive set includes `text | number | float | boolean | dateTime | enum | json | array | id | autoincrement` (`research/medusa/packages/core/utils/src/dml/entity-builder.ts:175`), broader than rntme's scalar set.
- **Money**: `model.bigNumber()` stores a decimal value plus a `raw_<field>` JSONB precision sidecar on the same row (`research/medusa/packages/core/utils/src/dml/entity-builder.ts:237`, and the property source at `research/medusa/packages/core/utils/src/dml/properties/big-number.ts:8`). Currency is adjacent, carried by the module (store supports `supported_currencies`) rather than on the field itself.
- **Enums** are first-class: `model.enum(values)` accepts arrays or enum-like objects (`research/medusa/packages/core/utils/src/dml/entity-builder.ts:359`).
- **JSON**: `model.json()` stores arbitrary object shapes as JSONB (`research/medusa/packages/core/utils/src/dml/entity-builder.ts:336`). Combined with relations, this is how Medusa expresses "embedded" shapes that do not warrant their own entity.
- Relations are rich: `hasOne`, `hasMany`, `belongsTo`, `manyToMany`, with `mappedBy`, `cascades`, `searchable`, and pivot config (`research/medusa/packages/core/utils/src/dml/entity-builder.ts:389`, and cascade plumbing at `research/medusa/packages/core/utils/src/dml/entity.ts:229`).
- **Links** are module-level joiners (not a field type) declared with `isLink: true` on a `ModuleJoinerConfig` and managed via a join table outside each module's schema (`research/medusa/packages/modules/link-modules/src/definitions/product-sales-channel.ts:4`).
- **Migrations** are generated from DML at runtime: `buildGenerateMigrationScript()` converts DML to MikroORM entities and emits SQL (`research/medusa/packages/core/utils/src/modules-sdk/migration-scripts/migration-generate.ts:44`).
- **No first-class multi-tenancy** in DML — tenants are enforced at the service/query layer, not the schema (survey A §6, no property exists in `research/medusa/packages/core/utils/src/dml/`).

## Gaps for commerce-class case

### [P0] [demo-blocker] Money type (amount + currency) native in PDM

**Why critical / DX impact.**
A cart/order service cannot be modelled honestly without `Money`. Today an LLM agent has to fabricate a two-field convention (`amount: decimal`, `currency: string`) for every price-like field, which leaks an implicit invariant (they must always move together) that neither the structural validator nor downstream graph-IR compiler can enforce.

**Pain point in rntme today** (concrete pattern/line).
`packages/pdm/src/types/artifact.ts:4` defines the closed `ScalarPrimitive` union as `integer | decimal | string | boolean | date | datetime`. The Zod parse layer echoes the same set at `packages/pdm/src/parse/schema.ts:5`, so there is no way to tag a pair of fields as "a single Money". The current workaround in practice is two fields plus a comment, which the QSM/graph-IR layers cannot introspect.

**Medusa reference** (how they solve it).
Medusa uses `model.bigNumber()` which stores the numeric value plus a sidecar `raw_<field>` JSONB metadata column on the same row to preserve precision (`research/medusa/packages/core/utils/src/dml/entity-builder.ts:237` and the property definition at `research/medusa/packages/core/utils/src/dml/properties/big-number.ts:8`). Currency is carried adjacent on the module (store-level `supported_currencies`), not on the field — so a rntme-native `money` should adopt the value+metadata sidecar pattern but make **currency a co-located field on the same entity**, since a rntme PDM is one service and the currency cardinality decision is local.

**Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.
With `money` as a primitive, the LLM generator can emit `unitPrice: { type: 'money', currency: 'USD' }` in one step instead of two, and transition `affects: ['unitPrice']` now covers the pair atomically. The future observability UI can render Money fields with currency-aware formatting (symbol, precision) instead of raw decimals, and business users reviewing a "charge customer" command graph see `€12.50` rather than `1250 minor units` — a direct unblock for "visually verify commerce logic".

### [P0] [demo-blocker] Nested / embedded objects in entity

**Why critical / DX impact.**
Commerce shapes like `Address` on a Customer, or `LineItem[]` embedded in a Cart snapshot, are not worth a full entity+relation round-trip every time but *must* be structurally typed for validation and UI rendering. Without this, rntme forces the LLM agent into a false choice: either promote every sub-shape to a full entity (explodes the relation graph) or flatten fields (loses structure).

**Pain point in rntme today** (concrete pattern/line).
`Entity.fields` is `Readonly<Record<string, Field>>` where `Field.type` is constrained to `ScalarPrimitive` — `packages/pdm/src/types/artifact.ts:52`. There is no object/struct/list-of-struct variant, and `packages/pdm/src/validate/structural.ts:37` only walks relations, not nested shapes. The demo `Issue` entity at `demo/issue-tracker-api/src/artifacts/pdm.json:5` works precisely because it has no sub-structure — an Order with embedded line items is not expressible here at all.

**Medusa reference** (how they solve it).
Medusa offers two tools: `model.json()` for free-form embedded objects (`research/medusa/packages/core/utils/src/dml/entity-builder.ts:336`) and `model.hasMany()` for child entities (`research/medusa/packages/core/utils/src/dml/entity-builder.ts:473`). The DML leaves the choice to the author — LineItems typically become a `hasMany(LineItem)` with cascade-delete from Order (`research/medusa/packages/core/utils/src/dml/entity.ts:229`), while an embedded shipping address on Order is `model.json()`. rntme needs at minimum a `json` scalar and ideally a typed-struct variant so the UI can render embedded shapes schematically.

**Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.
A typed-struct variant lets the LLM agent express `billingAddress: Address` without inventing a foreign key, and keeps the graph-IR compiler able to reason about the full column set on an `UPDATE`. The visualization layer can render an entity as a nested card (Address fields indented under Customer) and can draw a `LineItem` list inside a Cart node on the command-graph canvas. Without this gap closed, embedded shapes appear as a wall of flat columns, which business users cannot map back to their mental model.

### [P1] [non-blocker] Soft-delete markers as first-class

**Why critical / DX impact.**
Order and cart lifecycles demand tombstones for auditability (void vs. delete, abandoned cart retention). Today rntme's `GeneratedKind` covers only create/update/actor — soft-delete has to be modelled by hand as a nullable datetime plus a convention, defeating the whole point of generated markers being a closed, compiler-known set.

**Pain point in rntme today** (concrete pattern/line).
`packages/pdm/src/types/artifact.ts:17` declares `GeneratedKind = 'id' | 'createdAt' | 'updatedAt' | 'actor'` — there is no `'deletedAt'` member. The Zod schema mirrors it at `packages/pdm/src/parse/schema.ts:14`. The downstream derive layer at `packages/pdm/src/derive/event-types.ts` treats generated fields specially (they cannot appear in `transition.affects`), but a hand-rolled `deletedAt: datetime, nullable: true` is *not* excluded that way, so an LLM agent can accidentally list it in `affects` and corrupt the soft-delete semantics.

**Medusa reference** (how they solve it).
Medusa makes `deleted_at` part of the implicit default properties on every entity and auto-indexes it with `deleted_at IS NULL` for fast "live rows" queries (`research/medusa/packages/core/utils/src/dml/helpers/entity-builder/create-default-properties.ts:14`). The DML never asks an author to opt in; soft-delete is a platform guarantee.

**Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.
With `'deletedAt'` added to `GeneratedKind`, the LLM can mark an entity soft-deletable by a single flag, and the structural validator will automatically forbid `deletedAt` from appearing in any transition's `affects`. The business-user UI can then render a "Deleted (soft)" badge on rows with non-null `deletedAt`, and graph-IR-compiled queries can default-append `WHERE deleted_at IS NULL` for entities marked soft-deletable — mirroring Medusa's index convention without needing a Postgres-only partial-index extension (SQLite expression indexes cover this on the Turso path).

### [P1] [non-blocker] Medusa-style cross-module "link" → foreign-service-ref annotation

**Why critical / DX impact.**
A commerce stack is multi-service by design: Cart (cart-service) references `customer_id` (customer-service) and `product_id` (product-service). In Medusa's monolith, cross-module links are a first-class artifact. In rntme's per-service runtime, we *deliberately* do not want cross-service foreign keys — but we *do* need the PDM to record that a field is a handle into another service so Zeebe sagas, gRPC contracts, and the visualization layer know "this is not a local row".

**Pain point in rntme today** (concrete pattern/line).
`Relation.to` is typed as `string` and `packages/pdm/src/validate/structural.ts:40` rejects any `to` that is not a local entity name (`entityNames.has(rel.to)` check). There is no annotation path to say "this ID points at the customer-service". LLM agents writing a cart service today must model `customerId: integer` as a plain scalar with no relation at all, stripping all useful structure.

**Medusa reference** (how they solve it).
Medusa's link is a module-level `ModuleJoinerConfig` with `isLink: true` that declares both endpoints and uses a physical join table (`research/medusa/packages/modules/link-modules/src/definitions/product-sales-channel.ts:4`). In rntme the **physical join table is wrong** — the target row lives in a different service's Turso, not ours — but the *declarative* part (this field is a typed handle to a named entity in a named service) maps cleanly to a new relation kind such as `foreign-service-ref` that emits no local FK but does emit Zeebe correlation metadata and gRPC contract entries.

**Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.
The LLM agent can now say `customer: { kind: 'foreign-service-ref', service: 'customer', entity: 'Customer', localKey: 'customerId' }` and the platform compiler routes it correctly: the structural validator does *not* look for `Customer` in this PDM, but the Zeebe wiring generator registers a correlation key, and the gRPC contract emitter adds a `GetCustomer(id)` stub. In the business-user UI, a foreign-service-ref renders as a dotted-edge node crossing the service boundary — visually distinct from local relations — so reviewers instantly see where the saga boundary is.

### [P2] [non-blocker] Migrations / schema evolution

**Why critical / DX impact.**
Today a PDM edit has no emitted migration — the artifact is the schema, and evolution is manual. That blocks safe production roll-forward as soon as a second service ships. It is P2 because the demo runs on a fresh DB each test, so no commerce-class demo is blocked, but as soon as an LLM agent regenerates a PDM on an existing service it becomes a real problem.

**Pain point in rntme today** (concrete pattern/line).
`packages/pdm/src/types/artifact.ts:60` defines the artifact as a bare `{ entities }` record with no version, no prior-state reference, and no migration-step concept. There is no sibling to `packages/pdm/src/derive/event-types.ts` that produces a `schema diff → DDL steps` output; the whole evolution path is implicit.

**Medusa reference** (how they solve it).
Medusa generates migrations from DML at runtime via `buildGenerateMigrationScript()` — it converts DML to MikroORM entities and emits SQL with second-precision timestamps for ordering (`research/medusa/packages/core/utils/src/modules-sdk/migration-scripts/migration-generate.ts:44`). The emitted SQL targets Postgres (JSONB, ARRAY, partial indexes). A rntme analogue must emit **SQLite-dialect only** so it stays Turso-compatible — no JSONB, use `TEXT` with JSON1 extension functions; no `ARRAY`, use a child table; partial indexes are fine (SQLite has them).

**Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.
The LLM agent can emit a new PDM version and the platform auto-produces a reviewable migration step, which the business-user UI surfaces as a diff card ("adds column `cart.coupon_code TEXT NULL`, backfills to NULL, indexes on `customer_id WHERE deleted_at IS NULL`"). Without this, schema changes are invisible until something breaks at runtime. The authorability win is that LLM-generated PDM edits become reviewable at the DDL level, not only at the artifact level.

## Intersections with out-of-scope

- **Cross-service entity links → Zeebe + gRPC, not PDM-proper.** The `foreign-service-ref` relation kind above is the PDM *hook*, but the actual saga orchestration and the sync call mesh live in Zeebe and gRPC — rntme's PDM only annotates, it does not implement. The join table Medusa uses for links is explicitly wrong for rntme: target rows are in another service's Turso.
- **Cross-service analytics / read models → ksqlDB, not PDM.** Medusa's `manyToMany` spanning modules would, in rntme, be expressed as a ksqlDB projection over both services' event streams. PDM stays single-service-only.
- **Multi-tenancy → service/query layer, not PDM.** Agrees with Medusa survey §6: no `tenant_id` primitive in the PDM type system. Tenant scoping enters at command-graph and binding layers, where the actor context is already available.
- **Plugin/module SDK.** Medusa's extension hooks (e.g., link modules extending sibling entities with virtual fields) have no rntme analogue — extension happens by regenerating artifacts through an LLM agent, not through runtime plugin code.
- **Postgres-specific DDL.** Any migration work must stay SQLite-dialect for Turso. JSONB → `TEXT` + JSON1; `ARRAY` → child table; enum types → `CHECK (col IN (...))`. No `CREATE EXTENSION`, no Postgres partial-index syntax divergences.

## Open questions

- **Should PDM express `foreign-service-ref` as a first-class relation type, or keep it as a metadata tag on a scalar field?** First-class gives validators and visualization a rich hook; metadata tagging keeps the PDM type surface small and pushes the semantics into a separate "service-topology" artifact. Current leaning: first-class relation kind, because the graph-IR compiler already walks `Relation` and would need a parallel scan for tags — but we need to decide before the Money gap (P0) ships, because both touch the type system.
- **Should `money` be a new `ScalarPrimitive` member, or a composite `{ kind: 'money', amount: decimal, currency: string }` handled one level above scalars?** Composite is closer to Medusa's value+sidecar model and avoids bloating `ScalarPrimitive`, but requires the parse layer to learn a second field-shape schema.
- **Do we want `enum` as a primitive now, or keep simulating it with `string` + a validator hint?** Demo currently does the latter (`priority`, `status` as plain string at `demo/issue-tracker-api/src/artifacts/pdm.json:12`); the visualization UI would benefit from knowing the closed set explicitly.
