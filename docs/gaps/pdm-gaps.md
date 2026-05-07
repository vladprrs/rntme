# Gaps: PDM

This document tracks the Problem Domain Model gaps after the project-first
pivot. Medusa's DML remains a useful reference for rich domain modeling, but the
rntme goal is not commerce parity. The goal is a project-level semantic catalog
that agents can author safely and that service runtimes can compile into event
schemas, read models, bindings, UI, and migrations.

## What rntme has today

- `packages/artifacts/pdm/src/types/artifact.ts` defines a project/service-agnostic entity
  artifact with `ownerService`, `kind`, `table`, `fields`, `relations`, `keys`,
  and optional entity `stateMachine`.
- Field types are still a closed scalar set:
  `integer | decimal | string | boolean | date | datetime`. The Zod schema in
  `packages/artifacts/pdm/src/parse/schema.ts` mirrors that exact set.
- Generated fields are still only `id | createdAt | updatedAt | actor`; there is
  no generated `deletedAt`.
- Relations are local only: `{ to, cardinality, localKey, foreignKey }`.
  `packages/artifacts/pdm/src/validate/structural.ts` rejects relation targets that are
  not entities in the same PDM and validates only local/foreign key presence.
- State machines are first-class and derive event specs through
  `packages/artifacts/pdm/src/derive/event-types.ts`. These event specs drive seed,
  projection, command, and schema-governance work.
- `packages/artifacts/blueprint` has moved authoring context upward: project blueprint
  folders now contain a project-level PDM, and service members consume that PDM.
  The PDM package itself still exposes one JSON artifact shape, not the
  multi-file project folder loader.

## Closed or reframed since the original gap doc

- "Per-service PDM" is no longer the product model. The project-first spec and
  `@rntme/blueprint` make PDM project-level, while runtime service intake still
  consumes validated PDM data.
- Commerce-specific `money` remains useful, but it should not be the only P0.
  Workflow-heavy apps need enums, typed structs/json, lifecycle metadata, and
  cross-service handles at least as urgently.
- Multi-tenancy remains a query/binding/auth concern for now; do not add a PDM
  tenant primitive without a concrete platform authorization spec.

## Gaps

### [P0] PDM structured type-system v2

**Why it matters.** Agents currently encode important business meaning as
strings and field-name conventions. `priority`, `status`, `currency`,
`address_*`, and `metadata_json` all look like plain scalars to validators,
Graph IR, bindings, OpenAPI/protobuf emitters, UI forms, and schema governance.
That is too weak for repeatable agent-authored workflow apps.

**Current evidence.**

- `packages/artifacts/pdm/src/types/artifact.ts` only exposes scalar fields.
- `packages/artifacts/pdm/src/parse/schema.ts` rejects any field shape beyond that scalar
  enum.
- Current demos still model workflow states and priorities as strings rather
  than closed enums.

**Target.** Design a PDM v2 field grammar with:

- `enum` with closed values and stable display labels;
- `json` or typed `struct` for embedded value objects;
- list/array semantics for struct/scalar collections only where downstream SQL
  and UI handling are explicit;
- a named money/composite recipe or first-class `money` if a real pilot needs it;
- validator errors that explain which downstream surface is blocked.

**Acceptance gate.** A [DEV] agent can add `enum` and typed embedded object
fields to a project PDM and see consistent derived event schemas, QSM DDL,
OpenAPI/protobuf shapes, and UI field rendering. If money is deferred, the doc
must include the exact recommended composite convention.

### [P1] Foreign-service refs and project ownership semantics

**Why it matters.** Project-level PDM now describes entities across services,
but rntme still needs a way to distinguish local relations from handles to
entities owned by another service. Modeling a WorkOS user, CRM contact, or
approval subject as a plain scalar throws away service-boundary information; a
local FK is also wrong because the target row is not owned by this service.

**Current evidence.**

- `Relation.to` is a string, and `validateStructural` requires it to resolve to
  a local entity name.
- `docs/history/specs/historical/2026-04-23-project-first-blueprint-design.md`
  makes entity ownership project-level but does not introduce field-level
  ownership or a foreign-reference relation kind.
- `packages/artifacts/blueprint/src/types/artifact.ts` records service descriptors and
  project routing but not typed cross-service entity references.

**Target.** Add one explicit modeling path for cross-service handles:

- preferred: a relation kind such as `foreign-service-ref` with
  `service/entity/localKey` and no local FK;
- alternative: metadata on scalar fields, if validators and UI can still consume
  it without parallel scanning complexity.

**Acceptance gate.** Validators can reject accidental local joins across service
boundaries while UI/Graph IR/gRPC generation can still render or use a typed
foreign handle.

### [P2] Soft delete and schema evolution

**Why it matters.** Real workflow apps need lifecycle/audit semantics and safe
roll-forward of existing services. Today soft delete is a hand-modeled nullable
datetime, and PDM edits do not emit migration artifacts.

**Current evidence.**

- `GeneratedKind` lacks `deletedAt`.
- `PdmArtifact` has no artifact version, prior-state reference, migration block,
  or generated schema-diff API.
- QSM/event-store DDL is generated for fresh databases; existing-data migration
  remains manual.

**Target.**

- Add generated `deletedAt` or an entity-level soft-delete flag that downstream
  query generation can honor.
- Define a SQLite/libsql-only migration artifact produced from PDM/QSM deltas.
- Keep Postgres-specific constructs out of scope.

**Acceptance gate.** A PDM change produces a reviewable DDL/migration diff and
soft-deleted entities default out of generated list queries unless explicitly
included.

## Intersections and boundaries

- **Project-first belongs in `@rntme/blueprint`.** PDM should model semantics;
  project folder structure, service registry, and routing stay in blueprint.
- **Cross-service orchestration belongs outside PDM.** PDM may annotate handles;
  workflow/worker specs decide process flow.
- **Analytics belongs outside PDM.** Do not add PDM primitives whose only purpose
  is ksqlDB/search/BI optimization.
- **SQLite/libsql is the SQL target.** Any schema/migration design must stay
  portable to Turso/libsql.

## Open questions

1. Should PDM v2 ship `enum` + typed `struct/json` first, with money documented
   as a composite recipe, or should `money` be first-class in the same release?
   Recommended default: enum + struct/json first.
2. Should foreign-service refs be relation kinds or scalar metadata?
   Recommended default: relation kind, because validators and UI already walk
   relations.
3. Should the schema evolution artifact live in PDM, QSM, or a higher
   "blueprint migration" package? Recommended default: higher blueprint-level
   migration plan that includes PDM/QSM/service artifacts.
