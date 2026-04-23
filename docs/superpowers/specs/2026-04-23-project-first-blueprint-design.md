# Project-first blueprint model — design

**Status:** design approved in brainstorming, awaiting user review of this spec
**Author:** brainstorm 2026-04-23
**Related:**
- `README.md` (current public framing still says "one blueprint = one service")
- `AGENTS.md` (research map and current one-service glossary)
- `docs/adr/2026-04-15-event-driven-architecture.md` (current "QSM is strictly service-local" stance)
- `docs/superpowers/specs/done/2026-04-14-mutations-design.md` (derived events from `stateMachine`)
- `docs/superpowers/specs/done/2026-04-15-ui-layer-design.md` (current per-service UI framing)
- `docs/superpowers/specs/done/2026-04-15-runtime-packaging-design.md` (current one-service runtime packaging)

**Implementation tracks:**
- **Track A — Blueprint model.** Project folder structure, `project.json`, project-level `PDM`, multi-file `QSM`, service kinds, `mod-*` rule.
- **Track B — Project composition model.** Service validation against project `PDM`, cross-service `QSM` inputs, project routing, project-declared middleware, multi-service UI composition.
- **Track C — Project runtime.** Deferred to a separate brainstorm/spec; this document only records the dependency and target shape.

## 1. Problem

The current rntme framing assumes:

- one blueprint = one service;
- one service owns one `PDM`;
- `QSM` is service-local not only in runtime placement, but also in read-model scope;
- UI compiles against the same service's bindings;
- multi-service composition lives outside rntme (Zeebe / Kafka / ksqlDB / DWH layer above).

That framing breaks down when the desired authoring unit is not "one service", but **a working project made of several cooperating services plus integration modules**, deployed as a whole and useful immediately.

The pressure points are visible in commerce-class domains:

- `Product` is not naturally "one service's record";
- different services own different behaviors around one business object;
- a project needs one coherent routing surface and one entry UI;
- integration capabilities such as WorkOS, Stripe, or messaging should be modeled as first-class services inside the same blueprint;
- event sourcing stays valuable, but requiring a single per-service `PDM` makes the project model fragment too early.

We need a new canonical unit without falling into two traps:

1. a fake "shared mega-entity" where multiple services write different fields of one record;
2. a fake "project read layer" that duplicates every service's `QSM`.

## 2. Goal

Define a **project-first canonical blueprint** where:

- the blueprint is a **folder** with JSON files, not one bundle file;
- the blueprint describes a **project** containing multiple services;
- `PDM` becomes a **project-level semantic catalog**;
- `QSM` stays **service-level**, but may consume events from multiple services;
- UI stays **service-level**, while project-wide UI is hosted by an ordinary domain service selected in `project.json`;
- integration "modules" are modeled as normal services with explicit naming and kind;
- events are still **derived**, not hand-authored.

## 3. Decisions

| # | Question | Decision |
|---|---|---|
| Q1 | Canonical authoring/versioning/deploy unit | **Project blueprint folder** |
| Q2 | Is blueprint one JSON bundle? | **No.** Blueprint is a folder with structured JSON files |
| Q3 | Project deploy scope | **Whole project deploys together** |
| Q4 | Project-level `PDM` | **Yes** |
| Q5 | `PDM` layout | **Multi-file, entity-per-file** |
| Q6 | Field-level ownership | **No** in this spec |
| Q7 | Root entity lifecycle | **No root-level `stateMachine` in this spec** |
| Q8 | Meaningful domain events | **Derived from service-owned entities with local `stateMachine`** |
| Q9 | Service-local `PDM` | **Removed** |
| Q10 | `QSM` placement | **Service-level only** |
| Q11 | `QSM` sources | **May consume own and foreign service events** |
| Q12 | `QSM` file layout | **Multi-file** |
| Q13 | Project-level `QSM` runtime layer | **No** |
| Q14 | UI placement | **Service-level only** |
| Q15 | Project UI host | **Ordinary domain service chosen by `project.json` routing** |
| Q16 | Portal service kind | **No special `portal` kind** |
| Q17 | Service kinds | **`domain` and `integration`** |
| Q18 | Integration module placement | **Lives in `services/` as a normal service** |
| Q19 | Integration naming rule | **slug must start with `mod-`** |
| Q20 | Project edge concerns | **Declared in `project.json` routes + middleware** |
| Q21 | Project runtime details | **Deferred to separate spec** |

## 4. Canonical model

The new canonical model is:

- **Project-level** describes the system's semantic structure and exposed edges.
- **Service-level** describes executable behavior, read models, bindings, seeds, and UI.
- **Events stay derived** from lifecycle, not written as a manual catalog.
- **Ownership is entity-level, not field-level.**

This produces a strict split:

- `project.json` is the system assembly document;
- `pdm/` is the semantic catalog for all services;
- `services/<svc>/...` are executable slices of that catalog.

The project layer does **not** become another runtime that owns business logic. It owns topology, routing, and shared semantics.

## 5. Blueprint folder structure

Canonical shape:

```text
blueprint/
  project.json
  pdm/
    pdm.json
    entities/
      Product.json
      Publication.json
      PriceEntry.json
      InventoryPosition.json
  services/
    catalog/
      service.json
      graphs/
      bindings/
      qsm/
      seed/
    pricing/
      service.json
      graphs/
      bindings/
      qsm/
      seed/
    inventory/
      service.json
      graphs/
      bindings/
      qsm/
      seed/
    app/
      service.json
      bindings/
      ui/
      qsm/
    mod-workos/
      service.json
      graphs/
      bindings/
      qsm/
      seed/
```

Rules:

- `project.json` is mandatory.
- `pdm/` is mandatory and is shared by the whole project.
- `services/` contains all executable services, including integrations.
- There is **no top-level `modules/` directory**.
- A service that hosts project UI is still just a service under `services/`.

## 6. `project.json`

`project.json` becomes the assembly/edge artifact of the blueprint.

It owns:

- project metadata;
- list of services included in the project;
- external routing;
- project-level middleware declarations;
- mapping of middleware onto entrypoints.

It does **not** own:

- entity ownership;
- domain fields;
- state machines;
- per-service read models.

Illustrative shape:

```json
{
  "name": "commerce-catalog",
  "services": ["catalog", "pricing", "inventory", "app", "mod-workos"],
  "routes": {
    "ui": {
      "/": "app"
    },
    "http": {
      "/api/catalog": "catalog",
      "/api/pricing": "pricing",
      "/api/inventory": "inventory"
    }
  },
  "middleware": {
    "requestContext": { "kind": "request-context" },
    "auth": { "kind": "auth", "provider": "mod-workos" },
    "rateLimit": { "kind": "rate-limit", "policy": "default" }
  },
  "mounts": [
    { "target": "ui:/", "use": ["requestContext", "auth"] },
    { "target": "http:/api/catalog", "use": ["requestContext", "auth", "rateLimit"] }
  ]
}
```

Important constraint:

- middleware declarations are **declared seams** in this spec;
- the concrete runtime implementation of that seam belongs to Track C, not here.

## 7. Project-level `PDM`

### 7.1 Placement and layout

`PDM` moves to the project level:

```text
pdm/
  pdm.json
  entities/
    <Entity>.json
```

- one entity = one file;
- `pdm.json` is an index/metadata document for the whole project artifact;
- there is no per-service `pdm.json`.

### 7.2 Ownership model

Ownership is entity-level only.

Each entity declares:

- `ownerService`;
- `kind`.

`kind` is:

- `root` — minimal identity anchor for a business object;
- `owned` — full service-owned entity with behavior/lifecycle.

This spec explicitly rejects field-level ownership. If multiple services need their own behavior around one business object, the correct model is **multiple related entities**, not multiple owners of one record's fields.

### 7.3 Root entities

`root` entities:

- provide shared identity and semantic anchor;
- are created only by their owner service;
- do **not** define `stateMachine` in this spec;
- are intentionally small.

For commerce-style `Product`, the root entity is not "the entire product card". It is an identity anchor.

Minimal `Product` shape:

- `ownerService: "catalog"`
- `kind: "root"`
- fields: only `productId` in this spec

All other services attach their own full entities to the root identity.

### 7.4 Owned entities

`owned` entities:

- belong to exactly one service;
- have their own identity;
- may reference a root entity ID such as `productId`;
- may define `stateMachine`;
- are the primary source of meaningful domain events.

Examples:

- `Publication` — owner `catalog`
- `PriceEntry` — owner `pricing`
- `InventoryPosition` — owner `inventory`

### 7.5 Events remain derived

The "no hand-authored event catalog" rule stays intact.

Meaningful domain events come from `stateMachine` on `owned` entities, not from:

- field diffs on a root entity;
- manual event declarations in `project.json`;
- workflow-only milestones.

This keeps the existing rntme event model principle:

- user describes lifecycle;
- system derives event types.

What changes is **where the lifecycle lives**: in service-owned entities within the shared project `PDM`, not in one giant shared entity.

### 7.6 Product example

The intended modeling style for a complex domain object such as `Product` is:

- `Product` — root, minimal identity anchor, owner `catalog`
- `Publication` — owned by `catalog`, publication lifecycle
- `PriceEntry` — owned by `pricing`, pricing lifecycle
- `InventoryPosition` — owned by `inventory`, inventory lifecycle

This is preferred over:

- one fat `Product` entity with service-owned field slices;
- one global product state enum.

## 8. Service layer

### 8.1 Service-level `PDM` is removed

Services no longer author their own `PDM`.

Instead:

- services compile and validate against the shared project `PDM`;
- service responsibility is executable behavior, not local domain-schema authorship.

### 8.2 Service kinds

Only two service kinds exist in this spec:

- `domain`
- `integration`

There is no special `portal` kind.

### 8.3 Integration services

An integration module is modeled as a normal service under `services/`.

Rules:

- `service.json.kind = "integration"`
- service slug must start with `mod-`

Examples:

- `mod-workos`
- `mod-stripe`
- `mod-notifications`

An integration service may own its own `owned` entities if needed, for example:

- `ExternalIdentityLink`
- `PaymentProviderSession`
- `WebhookDelivery`

### 8.4 UI host services

A service that hosts project UI is just a `domain` service.

Its "portal" role is defined by `project.json` routing, not by a separate service kind.

### 8.5 Service folder contents

Canonical service contents:

```text
services/<svc>/
  service.json
  graphs/
  bindings/
  qsm/
  seed/
  ui/        # optional
```

Not every service must own every artifact:

- a UI host service may have `ui/`;
- some services may omit `seed/`;
- some services may not need `qsm/`.

## 9. `QSM`

### 9.1 Placement

`QSM` stays service-level only.

There is no project-level `QSM` runtime layer in this spec.

### 9.2 Layout

`QSM` becomes multi-file:

```text
services/<svc>/qsm/
  qsm.json
  projections/
    <Projection>.json
```

In this spec, `qsm.json` is the artifact index/metadata file and `projections/*.json` holds the projection definitions. Single-file `qsm.json` as the whole artifact is replaced by this directory-owned shape.

### 9.3 Scope expansion

The meaning of `QSM` changes:

- **old framing:** service-local read side for the service's own world;
- **new framing:** read side owned by one service for that service's use cases, even if fed by foreign events.

This allows:

- domain services to build local cross-service read models;
- entry UI services to host project-facing screens without introducing a project-level `QSM` layer.

### 9.4 Ownership rule

Even when a `QSM` projection consumes foreign events, it still belongs to exactly one service:

- it is declared in that service's `qsm/`;
- it materializes into that service's read-side;
- it exists because that service needs the projection.

## 10. UI

### 10.1 Placement

UI stays service-level only.

There is no project-level UI artifact in this spec.

### 10.2 Project-wide UI

Project-wide UI is implemented by a normal domain service selected in `project.json`.

That service:

- serves the project entry UI;
- uses project routing to reach other services;
- does not become the owner of their domain logic.

### 10.3 Composition rule

Default composition path is:

- service UI talks to HTTP surfaces published through project routing;
- direct HTTP composition is preferred;
- local `QSM` duplication is not the default.

For the entry UI service, its own `QSM` is optional and justified only for:

- latency-sensitive aggregation;
- search indexes;
- dashboards that would be too expensive or too noisy via direct fan-out HTTP.

### 10.4 Required compiler/validator pivot

Current `@rntme/ui` assumes resolution against the same service's HTTP map.

The new model requires:

- service UI to resolve bindings against **project-routed HTTP surfaces**;
- validation to understand that a UI can intentionally call another service through project routing.

This is a Track B change, not a Track C runtime decision.

## 11. Validation model

Validation becomes two-layered.

### 11.1 Project layer

Validate:

- `project.json`
- project directory structure
- project `PDM`
- service registry consistency
- route targets
- middleware declarations and mounts
- `mod-*` naming rule vs `kind: "integration"`

### 11.2 Service layer

For each service, validate:

- `service.json`
- `graphs/`
- `bindings/`
- `qsm/`
- `ui/`
- `seed/`

But service validation now runs against:

- the shared project `PDM`;
- the service's own declared scope (its owned entities plus any foreign events/projections explicitly referenced by its artifacts);
- project routing context where required.

Important consequence:

- the question is no longer only "is this service valid by itself?"
- the system must answer "is this service valid as a member of this project?"

## 12. Compatibility pivot

This spec intentionally supersedes several current assumptions.

Superseded by this design:

- `blueprint = one service`
- `PDM` as one-service artifact
- `QSM` as strictly service-local in input scope
- project UI needing a special service kind
- field-level ownership as a baseline modeling tool

Not superseded:

- event sourcing
- derived events from lifecycle
- Zeebe/Kafka as orchestration/integration layer
- DWH built from Kafka as the analytics path above operational services

The new stance is:

- analytics-wide composition still belongs to DWH/streaming layers;
- operational read models may now live inside a service even when fed by multiple services.

## 13. Implementation tracks

### 13.1 Track A — Blueprint model

Scope:

- project folder structure
- `project.json`
- project `PDM`
- `entity-per-file`
- service kinds
- `mod-*` validation
- multi-file `QSM` shape

Primary output:

- parser/validator capable of loading a project blueprint directory.

### 13.2 Track B — Project composition model

Scope:

- service validation against project `PDM`
- cross-service `QSM` inputs
- project-routed UI binding resolution
- project routes and middleware declarations
- entry UI service composition rules

Primary output:

- services can be validated and compiled as members of a project, not as isolated bundles.

### 13.3 Track C — Project runtime

Deferred.

This spec records only that a future runtime must eventually:

- boot the whole project;
- apply project routing;
- honor project-declared middleware;
- expose the selected UI host service as the project entrypoint.

Actual runtime architecture is explicitly left to a separate brainstorm/spec.

## 14. Testing

Minimum regression set planned by this design:

- fixture project directory, e.g. `product-catalog-project/`
- parse/validate project blueprint directory
- parse/validate project `PDM` with root entities and owned entities
- validation that root entities have no `stateMachine` in this spec
- validation that meaningful events derive from owned entities
- validation that `QSM` may consume foreign service events
- validation that UI bindings may resolve through project routing
- validation that `mod-*` services must be `integration`
- validation that project routing/middleware targets refer to existing services and entrypoints

Track C runtime tests are intentionally out of scope here.

## 15. Non-goals

This spec does **not** define:

- project runtime boot order;
- Kafka / Zeebe provisioning;
- a new hand-authored event catalog;
- field-level ownership;
- a project-level `QSM` artifact;
- a project-level UI artifact;
- a special `portal` service kind;
- generated service artifacts compiled automatically from project artifacts.

## 16. Why this model

The central tradeoff is deliberate:

- **project-first** gives us one canonical system description;
- **service-level execution** keeps behavior, APIs, read models, and runtime ownership legible.

That split avoids both extremes:

- not a pile of independent service bundles with no canonical whole;
- not one giant project runtime layer that absorbs every concern.

It also keeps rntme's strongest rule intact:

> users describe structure and lifecycle; the system derives events and executable surfaces.

The difference is that the durable authoring unit is now the **project**, not the single service.
