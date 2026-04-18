<!--
Architecture overview for rntme.
Spec: docs/superpowers/specs/2026-04-18-architecture-overview-design.md
Cutoff date: 2026-04-18. Later specs are folded in via subsequent bumps, not
retroactively.

Diagram colour palette (use the `classDef` lines below inside mermaid blocks
where styling is desired — copy, do not invent new colours):

  classDef artifact   fill:#1b3a5c,stroke:#4a90e2,color:#fff;
  classDef validator  fill:#5c3a1b,stroke:#e29a4a,color:#fff;
  classDef storage    fill:#1b5c3a,stroke:#4ae29a,color:#fff;
  classDef runtime    fill:#3a1b5c,stroke:#9a4ae2,color:#fff;
  classDef external   fill:#444,stroke:#999,color:#fff;
-->

# rntme — Architecture Overview

> Status: in progress (writing per plan `docs/superpowers/plans/2026-04-18-architecture-overview.md`).
>
> Spec: `docs/superpowers/specs/2026-04-18-architecture-overview-design.md`.
>
> Primary framing: rntme is an artifact-driven runtime for AI-agent-generated services. CQRS, event-sourcing, SQLite, Turso, branded `Validated*` types, and plugin seams are **consequences** of that goal, not the identity of the system. See `rntme_vision_framing` memory.

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [L1 — System Context](#2-l1--system-context)
3. [L2 — Containers](#3-l2--containers)
4. [L3 — Components](#4-l3--components)
5. [L4 — Code](#5-l4--code)
6. [Cross-cutting abstractions](#6-cross-cutting-abstractions)
7. [Observations and refactoring candidates](#7-observations-and-refactoring-candidates)
8. [Glossary](#8-glossary)
9. [How to use and maintain this document](#9-how-to-use-and-maintain-this-document)

---

## 1. Executive summary

**rntme is an artifact-driven runtime.** A service is described by a small set of strictly-validated JSON artifacts (PDM, QSM, Graph IR, bindings, UI, seed, manifest). The runtime loads those artifacts, validates them in layers, and boots a working HTTP + UI service without requiring any service-specific code. The primary payoff is that **AI agents and humans can _generate_ these artifacts and get a running service** — the runtime's job is to make that generation safe and repeatable.

```mermaid
flowchart LR
    subgraph authors["Artifact authors"]
        A["AI agent"]:::external
        H["Human"]:::external
    end
    subgraph artifacts["7 authoring artifacts (JSON)"]
        PDM["PDM"]:::artifact
        QSM["QSM"]:::artifact
        IR["Graph IR"]:::artifact
        B["Bindings"]:::artifact
        UI["UI"]:::artifact
        S["Seed"]:::artifact
        M["Manifest"]:::artifact
    end
    V["4-layer validator<br/>(parse → structural → reference → consistency)"]:::validator
    R["rntme runtime<br/>(@rntme/runtime)"]:::runtime
    DB[("SQLite / Turso")]:::storage
    UIS["Running service<br/>(HTTP + UI)"]:::runtime

    A --> PDM & QSM & IR & B & UI & S & M
    H --> PDM & QSM & IR & B & UI & S & M
    artifacts --> V --> R
    R --> DB
    R --> UIS

    classDef artifact fill:#1b3a5c,stroke:#4a90e2,color:#fff;
    classDef validator fill:#5c3a1b,stroke:#e29a4a,color:#fff;
    classDef storage fill:#1b5c3a,stroke:#4ae29a,color:#fff;
    classDef runtime fill:#3a1b5c,stroke:#9a4ae2,color:#fff;
    classDef external fill:#444,stroke:#999,color:#fff;
```

**Key invariants at a glance**

- **SQLite forever.** Scale-out target is Turso (SQLite-compatible); no Postgres dialect path is permitted.
- **JSON authoring only.** No YAML, no TOML for any artifact.
- **`Result<T>` across package boundaries.** No exceptions leak out of a package's public API.
- **Branded `Validated*` types.** Downstream APIs accept only the brand; casting into the brand (`as ValidatedPdm`) is an anti-pattern.
- **Fail-fast layered validation.** Each artifact runs parse → structural → reference/cross-ref → consistency; the orchestrator returns the first failing layer's errors only.

**Design rationale — why these choices serve the vision**

| Decision | Property delivered to the vision |
| --- | --- |
| Layered validators + branded types | An agent-generated artifact cannot silently bypass a check; downstream code cannot consume unvalidated data. |
| CQRS + event-sourcing | Schema and behaviour can evolve without losing history; migrations become replays, not destructive DDL. |
| SQLite (+ Turso) | One service = one file; running many services does not require orchestrating a database cluster. |
| Kafka-style topic convention `rntme.{svc}.{agg}` | Services can be composed into a larger platform (Zeebe sagas, gRPC) without invasive per-service wiring. |
| Plugin seams (`DbDriver`, `EventBus`, `Surface`) | Runtime can be swapped in (e.g. different storage or transport) without changing any of the seven artifacts. |
| Kept-small public surface per package | Agents and humans reason about fewer concepts per artifact; each artifact has a single canonical validator. |

The rest of this document unpacks each of these in order: L1 context (§2), container topology (§3), per-package components (§4), critical functions (§5), the abstractions catalogue (§6), diagnostic observations (§7).

## 2. L1 — System Context

```mermaid
C4Context
  title rntme — system context

  Person(author, "Artifact author", "AI agent or human — generates the 7 JSON artifacts")
  Person(operator, "Operator", "Boots and observes the service")
  Person(user, "End user", "Calls the service's HTTP or UI")

  System(rntme, "rntme service", "Runtime that loads artifacts and serves HTTP + UI")

  SystemDb_Ext(sqlite, "SQLite / Turso", "Per-service database — event log + projection tables")
  System_Ext(platform, "Agent platform (future)", "Zeebe sagas · gRPC · viz layer — outside the scope of this document")

  Rel(author, rntme, "Supplies artifacts")
  Rel(operator, rntme, "Boots / monitors")
  Rel(user, rntme, "HTTP + UI")
  Rel(rntme, sqlite, "Reads / writes")
  Rel(rntme, platform, "Topics: rntme.{svc}.{agg}", "future")
```

**What the diagram shows.** The runtime has exactly one direct input from humans/agents — the artifact set — and two human-facing surfaces (operator, end user). Storage is explicitly per-service. The agent platform (Zeebe, gRPC, viz layer) is an **external future consumer**, not a part of this document.

**Why only one storage actor.** rntme treats storage as a per-service concern. The `DbDriver` plugin seam (see §3) lets the same runtime run against `BetterSqlite`, an in-memory driver for tests, or Turso without changing any artifact.

**Why the platform is external.** The memory entry `project_platform_vision` describes the larger DDD platform (Zeebe for cross-service sagas, gRPC for synchronous calls, a viz layer for business users). rntme is *one per-service runtime inside that platform*; cross-service concerns are not in scope here.

## 3. L2 — Containers

### 3.1 Authoring surface — the 7 artifacts

rntme's authoring surface is seven JSON artifacts plus one service manifest. Each artifact has exactly one canonical validator and one canonical consumer.

```mermaid
flowchart LR
    classDef artifact fill:#1b3a5c,stroke:#4a90e2,color:#fff;
    classDef pkg fill:#3a1b5c,stroke:#9a4ae2,color:#fff;

    PDM["PDM.json"]:::artifact -->|validated by| PDMP["@rntme/pdm"]:::pkg
    QSM["QSM.json"]:::artifact -->|validated by| QSMP["@rntme/qsm"]:::pkg
    IR["Graph IR nodes<br/>(bindings/ui carry these)"]:::artifact -->|compiled by| GIR["@rntme/graph-ir-compiler"]:::pkg
    B["bindings.json"]:::artifact -->|validated by| BP["@rntme/bindings"]:::pkg
    U["ui.json"]:::artifact -->|compiled by| UP["@rntme/ui"]:::pkg
    S["seed.json"]:::artifact -->|validated by| SP["@rntme/seed"]:::pkg
    M["manifest.json"]:::artifact -->|validated by| R["@rntme/runtime"]:::pkg
```

**Caption.** Every artifact has exactly one owner package; a downstream package consuming an artifact does so via the owner's branded `Validated*` type.

### 3.2 Container map — 12 packages

```mermaid
flowchart TB
    classDef pkg fill:#3a1b5c,stroke:#9a4ae2,color:#fff;
    classDef demo fill:#1b5c3a,stroke:#4ae29a,color:#fff;

    PDM["@rntme/pdm"]:::pkg
    QSM["@rntme/qsm"]:::pkg
    ES["@rntme/event-store"]:::pkg
    GIR["@rntme/graph-ir-compiler"]:::pkg
    B["@rntme/bindings"]:::pkg
    BH["@rntme/bindings-http"]:::pkg
    UI["@rntme/ui"]:::pkg
    UIR["@rntme/ui-runtime"]:::pkg
    DS["@rntme/db-studio"]:::pkg
    PC["@rntme/projection-consumer"]:::pkg
    SD["@rntme/seed"]:::pkg
    RT["@rntme/runtime"]:::pkg
    DEMO["demo/issue-tracker-api"]:::demo

    QSM --> PDM
    GIR --> PDM & QSM & ES
    BH --> B & GIR & ES
    UIR --> UI
    PC --> ES & GIR & PDM & QSM
    SD --> ES & PDM
    RT --> BH & UIR & DS & PC & SD & GIR & ES
    DEMO --> RT
```

**Caption.** Arrows mean "depends on". `@rntme/runtime` is the orchestrator; it boots the plugin seams, wires the event pipeline, and mounts the HTTP surface. The demo is the only package that consumes `@rntme/runtime` directly.

### 3.3 Plugin seams — extension without editing artifacts

Three interfaces live in `packages/runtime/src/plugins/`:

- **`DbDriver`** — storage adapter. Default: `BetterSqliteDriver`. Alternate: in-memory for tests, future Turso driver.
- **`EventBus`** — message transport. Default: `InMemoryBus`. Alternate: Kafka / NATS via a custom implementation.
- **`Surface`** — HTTP (or equivalent) entry point. Default: `HttpSurface` (Hono-based). Alternate: any surface that can route bindings.

The manifest (`manifest.json`) selects defaults; a caller passing a custom implementation replaces one seam without editing any other artifact. See `packages/runtime/README.md` for the exact interface shapes.

### 3.4 Boot & seed lifecycle (sequence #3)

```mermaid
sequenceDiagram
    autonumber
    participant Op as Operator
    participant RT as @rntme/runtime
    participant V as Validators (pdm, qsm, bindings, ui)
    participant DB as DbDriver
    participant ES as @rntme/event-store
    participant SD as @rntme/seed
    participant R as Relay
    participant BH as @rntme/bindings-http
    participant UIR as @rntme/ui-runtime

    Op->>RT: boot(manifest.json)
    RT->>V: validate(pdm, qsm, bindings, ui)
    V-->>RT: ValidatedArtifacts | Err
    RT->>DB: open() + migrate schema
    RT->>ES: init(DbDriver)
    RT->>SD: apply(seed.json)
    Note over SD,ES: Seed envelopes must be appended<br/>BEFORE the relay starts
    RT->>R: start (cursor = last committed)
    RT->>BH: mount /api
    RT->>UIR: mount / (+ /_studio if enabled)
    RT-->>Op: ready
```

**Caption.** The boot-order invariant (see `2026-04-15-runtime-seed-design.md`) is that seed application and the publish relay are mutually exclusive in time: seeds are committed through `appendRaw` *before* the relay cursor starts advancing, or seed events would double-publish.

## 4. L3 — Components

Each subsection below follows the same structure:

1. **Purpose** — one sentence.
2. **Spec lineage** — which specs shaped this package, in time order.
3. **Component diagram** — internal modules and data flow.
4. **Components** — 2–3 sentences per module naming its responsibility.
5. **Invariants** — what must hold.

Sequence diagrams live with the package that owns the flow.

### 4.1 `@rntme/pdm`

**Purpose.** Parse, validate, resolve, and derive event-types for the PDM artifact — rntme's source of truth for entities, fields, relations, keys, and per-entity finite-state machines that drive event-sourced mutations.

**Spec lineage.**

| Spec | Date | Status | Contribution |
| --- | --- | --- | --- |
| `docs/superpowers/specs/done/2026-04-14-mutations-design.md` | 2026-04-14 | landed | Defined the `stateMachine` extension, derived event-types, and the event-sourcing topology consumed by PDM output. |
| `docs/adr/2026-04-15-event-driven-architecture.md` | 2026-04-15 | ADR | Write-path topology (event log, outbox, relay) that consumes `deriveEventTypes` output. |

**Component diagram.**

```mermaid
flowchart LR
    classDef stage fill:#5c3a1b,stroke:#e29a4a,color:#fff;
    classDef brand fill:#1b3a5c,stroke:#4a90e2,color:#fff;

    JSON["pdm.json"] --> P["parse/parse.ts<br/>+ schema.ts"]:::stage
    P --> S["validate/structural.ts"]:::stage
    S --> SM["validate/state-machine.ts"]:::stage
    SM --> VP["ValidatedPdm (brand)"]:::brand
    VP --> R["resolvers/pdm-resolver.ts"]:::stage
    VP --> D["derive/event-types.ts"]:::stage
```

**Caption.** Two validation layers (structural, then state-machine) construct the `ValidatedPdm` brand; resolver and event-type derivation consume the brand — they are not validation layers.

**Components.**

- **`parse/parse.ts` + `parse/schema.ts`** — Zod strict parsing; accepts either a JS object or a JSON string. Returns `Ok<PdmArtifact>` on success or `Err` with `PDM_PARSE_*` codes otherwise.
- **`validate/structural.ts`** — First validation layer. Checks keys reference real fields, relation endpoints resolve, and scalars are well-formed. Constructs the intermediate `StructurallyValidPdm` brand.
- **`validate/state-machine.ts`** — Second validation layer. Enforces state/transition rules, creation-transition `affects` declaration, self-loop non-empty `affects`, and BFS reachability from creation states. Promotes `StructurallyValidPdm` to the final `ValidatedPdm` brand.
- **`validate/index.ts`** — Orchestrator `validatePdm()`. Fail-fast: on a structural error, the state-machine layer does not run.
- **`resolvers/pdm-resolver.ts`** — Pure-lookup facade (`createPdmResolver`) that resolves entity / field / relation / state-machine references to in-memory handles; each resolved transition exposes a computed `declared` list that augments `affects` with `stateField`.
- **`derive/event-types.ts`** — Produces one `EventTypeSpec` per transition, consumed downstream by bindings, projection-consumer, and the event store.

**Invariants.**

- The `ValidatedPdm` brand is constructed only inside `validate/state-machine.ts`; the intermediate `StructurallyValidPdm` brand is constructed only inside `validate/structural.ts`. Downstream packages (QSM, bindings, graph-ir-compiler) accept only the final brand.
- `stateField` is a non-nullable string; `stateMachine.initial` is literal `null` (creation transitions are the only entry).
- Creation transitions and self-loop transitions must declare `affects` explicitly and non-empty.
- Reachability is enforced: any state unreachable from a creation transition is rejected with `PDM_SM_UNREACHABLE_STATE`.
- `relation.to` is local-only; cross-service relations are an explicit gap tracked in `docs/gaps/pdm-gaps.md` and in the package's "Out of scope" README section.

### 4.2 `@rntme/qsm`

**Purpose.** Parse, validate, and derive DDL + event handlers for QSM — the query-side model that declares read-side projections (entity-mirrors) over the PDM, and, post-2026-04-16, owns the relation metadata used for JOINs.

**Spec lineage.**

| Spec | Date | Status | Contribution |
| --- | --- | --- | --- |
| `docs/superpowers/specs/done/2026-04-14-mutations-design.md` | 2026-04-14 | landed | Entity-mirror projection contract: backing semantics, key/grain rules, generated columns, idempotency triple (§6). |
| `docs/superpowers/specs/2026-04-16-qsm-relations-migration-design.md` | 2026-04-16 | in-flight | Read-side relation graph moved from PDM to QSM: B2 cross-validation rules, single-hop / fan-out gates, error codes. |

**Component diagram.**

```mermaid
flowchart LR
    classDef stage fill:#5c3a1b,stroke:#e29a4a,color:#fff;
    classDef brand fill:#1b3a5c,stroke:#4a90e2,color:#fff;
    classDef derive fill:#3a1b5c,stroke:#9a4ae2,color:#fff;

    JSON["qsm.json"] --> P["parse/parse.ts<br/>+ schema.ts"]:::stage
    P --> S["validate/structural.ts"]:::stage
    S --> SV["StructurallyValidQsm (brand)"]:::brand
    SV --> X["validate/cross-ref.ts<br/>(reads PdmResolver)"]:::stage
    X --> VQ["ValidatedQsm (brand)"]:::brand
    VQ --> DDL["derive/ddl.ts"]:::derive
    VQ --> H["derive/handler.ts"]:::derive
    VQ --> R["resolvers/qsm-resolver.ts"]:::derive
```

**Caption.** Two validation layers (structural, then PDM-aware cross-ref) produce `ValidatedQsm`. Both derive modules also take a `PdmResolver` to look up entity shapes and event types; only `resolvers/qsm-resolver.ts` is PDM-free.

**Components.**

- **`parse/parse.ts` + `parse/schema.ts`** — Zod strict parser; accepts object or JSON string. Emits `QSM_PARSE_SCHEMA_VIOLATION` on failure.
- **`validate/structural.ts`** — PDM-free rules: empty / duplicate keys / grain / exposed, table-name collisions, relation-key shape `"<Projection>.<relation>"`. Constructs `StructurallyValidQsm`.
- **`validate/cross-ref.ts`** — PDM-aware rules: entity and field existence, entity-mirror constraints (keys and grain set-equal to source entity's keys; source entity must have a state-machine), at-most-one entity-mirror per source entity, and B2 relation parity with PDM on `(to, localKey, foreignKey, cardinality)`. Promotes to `ValidatedQsm`.
- **`validate/index.ts`** — `validateQsm()` orchestrator: structural → cross-ref, fail-fast.
- **`derive/ddl.ts`** — `generateProjectionDdl(ValidatedQsm, PdmResolver)` → `ProjectionDdlSpec[]`. Entity-mirror specs carry the full idempotency triple `(last_event_id, last_event_version, applied_at)`; derived specs (opt-in via `opts.derivedSchemas`) carry only `(last_event_id, applied_at)` plus a separate `seen_events` dedup table. State-field indexes and a `CREATE TABLE` statement are emitted with SQLite double-quoted identifiers.
- **`derive/handler.ts`** — `deriveProjectionHandler(ValidatedQsm, PdmResolver)` → `ProjectionHandlerSpec[]`. One `EventHandler` per `EventTypeSpec` with an `insert | update` op respecting the idempotency guard.
- **`resolvers/qsm-resolver.ts`** — Pure-lookup facade (`createQsmResolver`) with `listProjections`, `resolveProjection`, `findEntityMirror`, `listRelations`, `resolveRelation`.
- **`common/invariant.ts`** — `invariantViolated()` post-validation safety net; consumed by derive/* and resolver.

**Invariants.**

- **Brand path is the only path.** `ValidatedQsm` is constructed only in `validate/cross-ref.ts`; `StructurallyValidQsm` only in `validate/structural.ts`. Downstream (graph-ir-compiler, projection-consumer) accepts only `ValidatedQsm`.
- **Entity-mirror key / grain contract.** Keys and grain of an entity-mirror projection must be set-equal to the source entity's keys. Enforced by `QSM_XREF_ENTITY_MIRROR_KEYS_MISMATCH` and `QSM_XREF_ENTITY_MIRROR_GRAIN_MISMATCH`.
- **One mirror per entity.** `QSM_XREF_ENTITY_MIRROR_DUPLICATE` rejects a second entity-mirror for the same source entity.
- **`derived` backing is gated at cross-ref.** Zod accepts `backing: 'derived'`; the standard `validateQsm()` path rejects it in `validate/cross-ref.ts` with `QSM_BACKING_DERIVED_NOT_SUPPORTED`. `derive/ddl.ts` has a forward-compat path (`opts.derivedSchemas`) that produces DDL for derived projections, but no runtime consumer currently enables it — this is an explicit MVP gate.
- **B2 relation parity.** QSM relations must match PDM on `(to, localKey, foreignKey, cardinality)`. PDM is canon; divergence fails cross-ref with specific mismatch codes.
- **`cardinality: 'many'` is reserved.** Parser and validator accept it, but graph-ir-compiler refuses to lower it (`NAV_FAN_OUT_NOT_ALLOWED`). Author should treat `many` as forward-compat only.
- **Idempotency columns are immutable.** Entity-mirror tables carry `last_event_id`, `last_event_version`, `applied_at`; derived tables carry `last_event_id`, `applied_at` plus a `seen_events` dedup row. Names are stable; renaming is a breaking change for projection-consumer.

### 4.3 `@rntme/event-store`

**Purpose.** SQLite-backed event log with optimistic concurrency, a per-relay monotonic publish cursor, and a Kafka-style at-least-once relay — the write side of rntme's CQRS / event-sourced pipeline.

**Spec lineage.**

| Spec | Date | Status | Contribution |
| --- | --- | --- | --- |
| `docs/superpowers/specs/done/2026-04-14-mutations-design.md` | 2026-04-14 | landed (superseded) | Pre-D9 event model; envelope fields are now covered by the CloudEvents design below. |
| `docs/superpowers/specs/2026-04-17-cloudevents-envelope-design.md` | 2026-04-17 | landed | D9 CloudEvents 1.0 envelope end-to-end — shape (§3.1), DLQ wrapper (§5.2), topic convention (§6), schema compatibility (§7). |
| `docs/superpowers/specs/2026-04-17-relay-dlq-delivery-tracking-design.md` | 2026-04-17 | landed | A1 delivery-tracking table + unbounded DLQ retry semantics. |

**Component diagram.**

```mermaid
flowchart LR
    classDef store fill:#1b5c3a,stroke:#4ae29a,color:#fff;
    classDef iface fill:#1b3a5c,stroke:#4a90e2,color:#fff;
    classDef relay fill:#3a1b5c,stroke:#9a4ae2,color:#fff;
    classDef wire fill:#5c3a1b,stroke:#e29a4a,color:#fff;

    IF["store/interface.ts<br/>EventStore"]:::iface
    SQL["store/sqlite.ts<br/>SqliteEventStore"]:::store
    SCH["store/schema.ts<br/>(D9 guard)"]:::store
    RM["store/row-mapper.ts"]:::store
    LOOP["relay/loop.ts<br/>createRelay"]:::relay
    TOP["relay/topic.ts"]:::relay
    DLQ["relay/dlq-envelope.ts"]:::relay
    CODEC["kafka/wire-codec.ts<br/>(CE 1.0 binary)"]:::wire
    KP["kafka/producer.ts<br/>KafkaProducer"]:::wire

    SQL --> IF
    SQL --> SCH & RM
    LOOP --> IF
    LOOP --> CODEC
    LOOP --> KP
    LOOP --> TOP
    LOOP --> DLQ
```

**Caption.** The `EventStore` interface is the single seam the rest of the system talks to. `SqliteEventStore` is the default implementation; the relay polls it, encodes envelopes via the CloudEvents 1.0 wire codec, and publishes through a `KafkaProducer` (in-memory in tests).

**Components.**

- **`store/interface.ts`** — The `EventStore` interface: `appendEvents`, `appendRaw`, `readStream`, `readFrom`, `readRecordsFrom`, `readCursor` / `writeCursor`, plus per-event delivery-tracking ops (`readDeliveryAttempt`, `recordDeliveryAttempt`, `updateLastError`, `markDelivered`, `markDlq`).
- **`store/sqlite.ts`** — `SqliteEventStore` implementation over `better-sqlite3` with `journal_mode=WAL`. Maps SQLite errors to `ConcurrencyConflict` / `DuplicateEventId`. All append requests in one batch run in a single `immediate` transaction — atomic across subjects.
- **`store/schema.ts`** — DDL (`applyEventStoreSchema`) plus `assertSchemaD9Compatible(db)` that rejects pre-D9 files missing the `correlation_id` column.
- **`store/row-mapper.ts`** — `rowToEnvelope(row, serviceName)` re-derives CloudEvents `source` / `type` / `dataSchema` on read so those fields need not be persisted verbatim.
- **`relay/loop.ts`** — `createRelay({ store, cursorId, kafka, ... })` spins a polling loop: read from cursor → encode → send → record delivery → advance cursor. Retries per event with exponential backoff (10 ms → `maxBackoffMs`, up to `maxAttempts`). Emits a DLQ envelope after exhaustion.
- **`relay/topic.ts`** — `defaultTopicOf(service, aggregate)` returns `rntme.{service}.{aggregate}` (both lowercased). No `.v1` suffix.
- **`relay/dlq-envelope.ts`** — `buildDlqEnvelope` wraps a failed event with `type: '{service}.Relay.EventDeliveryFailed'`, published to `{topic}.dlq`.
- **`kafka/wire-codec.ts`** — `toCloudEventWire` / `fromCloudEventWire` — CloudEvents 1.0 binary content mode (CE attributes in headers, JSON payload in body).
- **`kafka/producer.ts` + `kafka/in-memory.ts`** — `KafkaProducer` interface plus an in-memory test producer.

**Invariants.**

- **Caller mints `id`, `time`, and `correlationId`.** The store never generates them; determinism matters for replay and golden tests. `correlation_id` is `NOT NULL` in the schema.
- **Optimistic concurrency on `(subject, expectedVersion)`.** `expectedVersion` is the pre-append `MAX(version)` for the subject; `0` means the subject does not exist. Violation raises `ConcurrencyConflict(subject, expectedVersion, actualVersion)`.
- **Append is atomic across subjects.** A multi-request batch either fully commits or fully rolls back (single `immediate` transaction).
- **Per-subject order in Kafka, not cross-subject.** The relay sets Kafka `key = subject`, giving partition affinity; cross-subject ordering is not guaranteed.
- **At-least-once delivery.** The publish cursor advances only after a batch is accepted by the producer. Crash mid-batch replays on restart; consumers must deduplicate by `event_id`.
- **Monotonic cursor per relay.** `writeCursor` rejects non-monotonic `last_event_id` values. Each relay instance uses its own `cursorId`.
- **Unbounded DLQ retry.** If the DLQ topic itself fails, the relay keeps retrying the DLQ envelope; `onDlqError` surfaces the failure to the operator.
- **Topic convention is fixed.** `rntme.{service}.{aggregate}`, lowercase, no version suffix. Breaking event changes are modelled as a new `eventType`, not a new topic.
- **`serviceName` is immutable.** It flows into CE `source`, `type`, `dataSchema`, and the topic; renaming after events exist rewrites derived values.
- **Single-writer SQLite.** WAL + `busy_timeout` handles short contention; multi-instance writes to the same file are not supported.
- **`appendRaw` trusts the caller's `rntVersion`** — non-contiguous versions are permitted for seed and replay only.

#### Sequence #6 — Envelope lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant CMD as Command handler
    participant ES as @rntme/event-store
    participant DB as SQLite
    participant R as Relay
    participant BUS as EventBus
    participant PC as @rntme/projection-consumer
    participant DTR as delivery_tracking
    participant DLQ as DLQ topic

    CMD->>ES: appendEvents({ subject, expectedVersion, events })
    ES->>DB: INSERT envelopes (one immediate txn)
    DB-->>ES: rows with monotonic id
    R->>DB: readRecordsFrom({ afterId: cursor, limit })
    loop per envelope
        R->>BUS: toCloudEventWire + producer.send
        alt accepted
            R->>DTR: markDelivered
            BUS->>PC: deliver
            PC->>DB: apply + advance consumer cursor
        else retryable error
            R->>DTR: recordDeliveryAttempt + backoff
        else exhausted
            R->>DLQ: buildDlqEnvelope + send
            R->>DTR: markDlq
        end
    end
    R->>DB: writeCursor(highestDeliveredId)
```

**Caption.** The publish cursor advances only after a batch's primary sends complete (or enter DLQ); a consumer failure is recorded in `delivery_tracking` but does not block the cursor — the relay is at-least-once; the consumer deduplicates on `event_id`.

### 4.4 `@rntme/graph-ir-compiler`

**Purpose.** Parse, validate, plan, lower, and execute rc7 Graph IR authoring specs. Query graphs lower to SQLite `SELECT`; command graphs compile to event-sourced emit plans executed against `@rntme/event-store`.

**Spec lineage.**

| Spec | Date | Status | Contribution |
| --- | --- | --- | --- |
| `docs/superpowers/specs/done/2026-04-13-graph-ir-sql-compiler-mvp-design.md` | 2026-04-13 | landed | MVP Tier 1 scope: `findMany` / `filter` / `map` / `reduce` / `sort` / `limit` / `emit`; structural + semantic validation; SQLite target; TDD workflow. |
| `docs/superpowers/specs/2026-04-16-predicate-optional-fix-design.md` | 2026-04-16 | landed | Fixes `wrapPredicateOptional` param-position misalignment by reordering OR args; regression tests at unit and e2e. |

Historical note: `graph_ir_rc_7.md` (gitignored, local-only) was the first-step IR language sketch; it is not treated as canon — later specs supersede it (see §7.8).

**Component diagram.**

```mermaid
flowchart LR
    classDef stage fill:#5c3a1b,stroke:#e29a4a,color:#fff;
    classDef brand fill:#1b3a5c,stroke:#4a90e2,color:#fff;
    classDef cmd fill:#3a1b5c,stroke:#9a4ae2,color:#fff;

    RAW["Graph IR spec"] --> P["parse/"]:::stage
    P --> ST["validate/structural/"]:::stage
    ST --> N["canonical/normalize.ts"]:::stage
    N --> SM["validate/semantic/"]:::stage
    SM --> ROLE["role/infer.ts"]:::stage
    ROLE --> SP["semantic-plan/build.ts"]:::stage
    SP --> REL["relational/build.ts"]:::stage
    REL --> LOW["lower/sqlite/"]:::stage
    LOW --> EM["emit/ (SQL or event-type)"]:::stage
    EM --> QX["execute/"]:::stage
    EM --> CX["command-runtime/"]:::cmd
    SP --> EP["emit/plan.ts<br/>(command emit plans)"]:::cmd
    CX --> ES["@rntme/event-store"]:::cmd
    QX --> DB[("SQLite")]
```

**Caption.** Parse / structural / normalize / semantic / semantic-plan are shared by both roles. The role inferer splits the pipeline into a query tail (relational → lower → emit SQL → execute) and a command tail (buildEmitPlans → command-runtime → event-store). Neither tail skips the shared head; the role check happens after canonicalisation so it can inspect the final graph.

**Components.**

- **`parse/` + `types/authoring.ts`** — Zod rc7 discriminated-union parser; produces `AuthoringSpec`. First line of defence; rejects syntactic errors with `PARSE_SCHEMA_VIOLATION`.
- **`validate/structural/`** — PDM-free rules: id uniqueness, output/input shapes, DAG, map/reduce arity, tier-1 node set, command shape, role. Errors are `STRUCT_*`.
- **`canonical/normalize.ts`** — Lifts authoring → `CanonicalNode`, allocates scope ids, fills sort defaults.
- **`validate/semantic/`** — PDM / QSM aware rules: source resolution, nav-relation / projection-required checks, scope-aware field resolution, param-context (`predicate_optional` only inside `filter`), shape-conformance, aggregate-phase. Errors are `SEM_*` or `NAV_*`.
- **`role/infer.ts`** — Classifies the graph as `query` / `command` / `predicate` / `mapper` / `reducer`. Rowset + emit in the same graph is `GRAPH_MIXED_ROLE`.
- **`semantic-plan/build.ts`** — Produces `SemanticPlan` (a typed `PlanStep[]`) from the canonical graph. Consumed by both tails.
- **`relational/build.ts`** — Query-tail only. Lowers `PlanStep[]` to a `RelOp` tree (`Scan` / `Filter` / `Project` / `Aggregate` / `Sort` / `Limit` / `Join`).
- **`lower/sqlite/lower.ts` + `expr.ts` + `joins.ts`** — Lowers `RelOp` to a `SqlSelect` AST with an ordered `paramOrder` list. `wrapPredicateOptional` wraps a filter expression with null-guards for each optional param; on 2026-04-16 a param-alignment bug was fixed by swapping the OR argument order so inner params walk before the guard `?` in emitted SQL.
- **`lower/sqlite/emit.ts`** — Serialises the AST to a SQL string.
- **`execute/execute.ts`** — Binds the `paramOrder` list positionally and runs the statement against the given SQLite driver.
- **`emit/plan.ts` + `event-type.ts` + `payload.ts`** — Command tail. Produces `EmitPlan[]` (one per `emit` node) and the runtime payload-builder. Emit-payload expressions at runtime may reference `$param` and `$literal` only — field paths are rejected.
- **`command-runtime/compile.ts` + `execute.ts` + `replay.ts` + `transition.ts`** — Command entry; re-validates PDM / QSM internally; at runtime, runs an optional read-prelude, replays aggregate state, checks `stateMachine` transition legality, builds payloads, appends to the event store. Only `COMMAND_CONCURRENCY_CONFLICT` is mapped from event-store errors; others propagate.
- **`explain/explain.ts`** — Returns partial artifacts on failure (parsed / canonical / semanticPlan / relational / sql / paramOrder) so agents can diagnose without re-running the pipeline.

**Invariants.**

- **Two public entries, not unified.** `compile()` for query graphs, `compileCommand()` for command graphs. Both perform the shared head and then diverge by role.
- **Validation order is load-bearing.** Structural before normalize; `inferRole` after canonical. Reordering silently breaks `SEM_PARAM_CONTEXT` and `GRAPH_MIXED_ROLE` detection.
- **Exactly one graph per compile.** `STRUCT_DUPLICATE_GRAPH_ID` rejects multi-graph specs.
- **`predicate_optional` only in `filter`.** `SEM_PARAM_CONTEXT` rejects it elsewhere.
- **NAV rules are validator errors, not runtime throws.** `NAV_NOT_ALLOWED` and `NAV_FAN_OUT_NOT_ALLOWED` surface at semantic layer; lowering-site throws are defensive safety nets only.
- **`makeColumnOf` requires an entity-mirror projection.** Enforced earlier by `checkNavProjectionRequired`; lowering assumes it held.
- **Param order is bind order.** `lowerExpr`, `wrapPredicateOptional`, and limit-appending append to `paramOrder` in statement order; `execute()` binds positionally. A reorder here is a correctness bug.
- **Creation transitions replay against `version = 0`.** First `append` sets `lastVersion = 1`; `COMMAND_CONCURRENCY_CONFLICT` surfaces the only event-store error.
- **Emit-payload runtime accepts `$param` and `$literal` only.** Field paths throw; this is the only runtime-side rc7 restriction.
- **SQLite ≥ 3.30 is required** (for `NULLS FIRST / LAST` in `ORDER BY`).

#### Sequence #5 — IR → SQL (query tail)

```mermaid
sequenceDiagram
    autonumber
    participant C as Caller
    participant P as parse
    participant ST as structural
    participant N as normalize
    participant SM as semantic
    participant SP as semantic-plan
    participant REL as relational
    participant L as lower/sqlite
    participant E as emit
    participant X as execute
    participant DB as SQLite

    C->>P: compile(rawSpec, rawPdm, rawQsm)
    P-->>C: AuthoringSpec | Err
    C->>ST: validateStructural
    ST-->>C: AuthoringSpec | Err
    C->>N: normalize
    N-->>C: CanonicalGraph
    C->>SM: validateSemantic(pdm, qsm)
    SM-->>C: ok | Err
    C->>SP: buildSemanticPlan
    SP-->>C: SemanticPlan
    C->>REL: buildRelational
    REL-->>C: RelOp tree
    C->>L: lowerToSqlite
    L-->>C: { ast, paramOrder }
    C->>E: emitSql(ast)
    E-->>C: sql: string
    C->>X: executeCompiled(sql, paramOrder, params, db)
    X->>DB: run
    DB-->>X: rows
    X-->>C: unknown[]
```

**Caption.** Parse through semantic-plan is shared with the command tail; from `buildRelational` onward is query-only. Param-binding is positional: `execute` maps `params[name]` into positions using `paramOrder`.

#### Sequence #1 — Command write path

```mermaid
sequenceDiagram
    autonumber
    participant HT as HTTP client
    participant BH as @rntme/bindings-http
    participant GIR as @rntme/graph-ir-compiler
    participant ES as @rntme/event-store
    participant BUS as EventBus
    participant PC as @rntme/projection-consumer
    participant DB as SQLite (projection tables)

    HT->>BH: POST /api/<cmd>
    BH->>GIR: executeCommand(compiled, params, ctx)
    opt has read-prelude
        GIR->>ES: readStream(subject)
        ES-->>GIR: prior envelopes
        GIR->>GIR: replay + transition check
    end
    GIR->>ES: appendEvents(subject, expectedVersion, events)
    alt success
        ES-->>GIR: CommandResult
        GIR-->>BH: ok
        BH-->>HT: 202
        ES->>BUS: relay publish (async)
        BUS->>PC: deliver
        PC->>DB: apply projection updates
    else concurrency
        ES-->>GIR: ConcurrencyConflict
        GIR-->>BH: Err(COMMAND_CONCURRENCY_CONFLICT)
        BH-->>HT: 409
    else validation
        GIR-->>BH: Err(PARSE_/STRUCT_/SEM_*)
        BH-->>HT: 422
    end
```

**Caption.** `executeCommand` runs any read-prelude against the event store, replays aggregate state, and only then appends. The HTTP response returns as soon as the append commits; projection updates are asynchronous — a client that needs read-after-write must poll the query endpoint.

#### Sequence #2 — Query read path

```mermaid
sequenceDiagram
    autonumber
    participant HT as HTTP client
    participant BH as @rntme/bindings-http
    participant GIR as @rntme/graph-ir-compiler
    participant DB as SQLite (projection tables + QSM relations)

    HT->>BH: GET /api/<query>
    BH->>GIR: compile(spec, pdm, qsm) & execute(compiled, params, db)
    GIR->>DB: SELECT ... JOIN (from QSM relations)
    DB-->>GIR: rows
    GIR-->>BH: shape-validated rows
    BH-->>HT: 200 | 422
```

**Caption.** Query lowering uses QSM relation metadata (post-2026-04-16) to construct JOINs; the response shape is declared in the binding artifact and validated against the query's output row-type.

### 4.5 `@rntme/projection-consumer`

**Purpose.** Kafka-to-SQLite read-side runner. Bootstraps entity-mirror DDL, compiles per-event apply handlers from PDM + QSM (and from graph-IR-derived projection handlers), and drains envelopes into projection rows under an all-or-nothing batch transaction, guarded by hybrid idempotency.

**Spec lineage.**

| Spec | Date | Status | Contribution |
| --- | --- | --- | --- |
| `docs/superpowers/specs/done/2026-04-14-mutations-design.md` | 2026-04-14 | landed | §6 projection consumer + QSM store: mirror table shape (§6.1–§6.3), batch loop (§6.4), three-layer idempotent apply (§6.5), offset tracking (§6.6), tier-2 deferrals (§6.9). |
| `docs/superpowers/specs/2026-04-18-d5-consumer-idempotency-hybrid-design.md` | 2026-04-18 | proposed | D5 hybrid idempotency: per-row `last_event_version` for mirrors plus a shared `seen_events(event_id, projection_id)` table for derived projections; unblocks graph-IR-backed projections. |

**Component diagram.**

```mermaid
flowchart LR
    classDef stage fill:#5c3a1b,stroke:#e29a4a,color:#fff;
    classDef run fill:#3a1b5c,stroke:#9a4ae2,color:#fff;
    classDef store fill:#1b5c3a,stroke:#4ae29a,color:#fff;

    BOOT["store/bootstrap.ts<br/>(mirror DDL + seen_events)"]:::store
    CP["apply/compile.ts<br/>compileApplyPlan"]:::stage
    QSM["qsm.ValidatedQsm + events"] --> CP
    PDM["pdm.PdmResolver"] --> CP
    DH["graph-ir DerivedHandler[]"] --> CP
    CP --> AP["ApplyPlan"]
    AP --> AE["apply/apply-event.ts<br/>applyEvent"]:::run
    AE --> BIND["apply/bind.ts<br/>bindValues / bindDerivedValue"]:::run
    C["consumer.ts<br/>createProjectionConsumer"]:::run --> AE
    C --> BOOT
    AE --> DB[("SQLite projection tables + seen_events")]
```

**Caption.** `compileApplyPlan` is pure and can run at build time; `applyEvent` runs inside the batch transaction owned by `createProjectionConsumer`. The `seen_events` table is created alongside the mirror tables in `bootstrapProjections`.

**Components.**

- **`store/bootstrap.ts`** — `bootstrapProjections(db, ProjectionDdlSpec[])` rewrites DDL to `IF NOT EXISTS` and creates the shared `seen_events(event_id, projection_id)` composite-key table plus an `applied_at` index.
- **`apply/compile.ts`** — `compileApplyPlan({ pdm, qsm, events, derivedHandlers? })` → `ApplyPlan`. Pure (no DB); produces `handlersByEventType` and `mirrorsByAggregate`. Rejects composite keys with `PC_COMPOSITE_KEY_NOT_SUPPORTED` and missing fields with `PC_MISSING_ENTITY_FIELD`.
- **`apply/apply-event.ts`** — `applyEvent` dispatches by handler kind: mirror handlers pre-check `last_event_version`, run the compiled SQL, and reclassify 0-row writes as `skipped-older-version`; derived handlers gate on `seen_events`, run the delta UPSERT, and record the seen row.
- **`apply/bind.ts`** — `bindValues` (mirror) and `bindDerivedValue` (derived) resolve `ColumnBinding` unions to positional SQL params in the exact order emitted by `compileApplyPlan`.
- **`consumer.ts`** — `createProjectionConsumer({ db, plan, consumer, onError? })` runs the batch loop: `BEGIN IMMEDIATE → for each envelope applyEvent → COMMIT → commitOffsets(batch)`; `ROLLBACK` on any throw. Without `onError`, loop terminates on failure; with `onError`, offsets stay uncommitted and the batch is re-delivered.
- **`kafka/in-memory.ts`** — Test / demo `KafkaConsumer` adapter with async-iterator, monotonic offsets, and replay via `produce`.
- **`types/apply.ts` + `types/consumer.ts` + `types/errors.ts`** — `ApplyPlan`, `CompiledHandler` (union of `MirrorHandler | DerivedHandler`), `ColumnBinding` union (8 kinds), `ApplyResult` (5 outcomes), `KafkaConsumer` interface, and `ApplyCompileErrorCode`.

**Invariants.**

- **Three-layer idempotency for mirror handlers.** (1) Pre-check `last_event_version`; (2) `INSERT … ON CONFLICT DO UPDATE … WHERE last_event_version < excluded.last_event_version`; (3) `UPDATE … WHERE last_event_version < ?`. Removing any layer regresses replay safety.
- **Hybrid idempotency for derived handlers.** Composite `seen_events(event_id, projection_id)` table gates each apply; inserted after a successful delta UPSERT. `last_event_version` is not available on derived rows (aggregates over many events).
- **Batch atomicity.** All events in a Kafka batch commit together under `BEGIN IMMEDIATE`; a thrown apply rolls the whole batch back and leaves offsets uncommitted, so the broker re-delivers.
- **Single-column key only.** Composite keys rejected at compile; deferred to tier 2.
- **Idempotency columns are appended in a fixed order.** Reordering breaks positional binding.
- **Unknown aggregate ⇒ commit-but-skip.** Envelopes targeting an aggregate without a mirror return `skipped-no-mirror`; the batch still commits its offset.
- **Type coercion is centralised.** `bindValues` and the pre-check `SELECT` coerce aggregate-id types identically; divergence breaks the version guard for integer keys.
- **No DLQ here.** A poison message is the relay's or the Kafka adapter's concern; the consumer only exposes `onError` to swap termination for continue.
- **State-column literal only on creation with a state machine.** Otherwise the state column comes from `payload.after`.
- **`generated: 'createdAt' | 'updatedAt'` both bind `envelope.occurredAt`.** Updates re-emit `updatedAt` on every event.
- **SQLite-only today.** Uses `BEGIN IMMEDIATE`, `ON CONFLICT DO UPDATE`, and `excluded.<col>`; future target is Turso.

### 4.6 `@rntme/bindings` + `@rntme/bindings-http`

**Purpose.** `@rntme/bindings` parses, validates (4 layers), and emits OpenAPI 3.1 for the HTTP binding artifact — a declarative map from `(method, path)` tuples to graphs plus input/output shapes. `@rntme/bindings-http` is the Hono sub-router that, given a `ValidatedBindings` artifact and a Graph IR spec, mounts those bindings at runtime and serves `/openapi.json`.

**Spec lineage.**

| Spec | Date | Status | Contribution |
| --- | --- | --- | --- |
| `docs/superpowers/specs/done/2026-04-14-bindings-design.md` | 2026-04-14 | landed | Bindings artifact format (§4), 4-layer validator (§6), OpenAPI mapping (§7), package layout (§8). |
| `docs/superpowers/specs/done/2026-04-14-bindings-http-design.md` | 2026-04-14 | landed | Hono surface: public API, request lifecycle, Zod rules, startup pipeline, error model. |

**Component diagram.**

```mermaid
flowchart LR
    classDef stage fill:#5c3a1b,stroke:#e29a4a,color:#fff;
    classDef brand fill:#1b3a5c,stroke:#4a90e2,color:#fff;
    classDef runtime fill:#3a1b5c,stroke:#9a4ae2,color:#fff;

    JSON["bindings.json"] --> P["parse/parse.ts<br/>+ schema.ts"]:::stage
    P --> S["validate/structural.ts"]:::stage
    S --> SV["StructurallyValidBindings"]:::brand
    SV --> REF["validate/references.ts<br/>(GraphResolvers)"]:::stage
    REF --> RV["ResolvedBindings"]:::brand
    RV --> CON["validate/consistency.ts"]:::stage
    CON --> VB["ValidatedBindings"]:::brand
    VB --> OAPI["openapi/emit.ts"]:::stage
    VB --> ROUTER["bindings-http:<br/>router.ts + startup/compile-plan.ts"]:::runtime
    ROUTER --> QH["runtime/handler.ts"]:::runtime
    ROUTER --> CH["runtime/command-handler.ts"]:::runtime
```

**Caption.** Bindings runs four layers (parse, structural, references, consistency) with two intermediate brands (`StructurallyValidBindings`, `ResolvedBindings`) before producing `ValidatedBindings`. The same `ValidatedBindings` value is consumed by the OpenAPI emitter and by `@rntme/bindings-http`'s router — no second parse, no cast.

**Components.**

- **`bindings/parse/*`** — Zod strict parser. Enums include `method` (`GET | POST`), `in` (`query | path | body`), `kind` (`query | command`, default `query`). Emits `BINDINGS_PARSE_*` codes.
- **`bindings/validate/structural.ts`** — Binding / method / path uniqueness, path-placeholder symmetry (`{id}` ↔ parameter name set), GET-cannot-have-body, command method = `POST` only, command cannot declare `in: 'query'` parameters.
- **`bindings/validate/references.ts`** — Resolves each binding's graph signature (inputs, output shape) via `BindingResolvers` and checks every `bindTo` exists in the target graph.
- **`bindings/validate/consistency.ts`** — Kind × role matrix (see below), root-input ban, output-shape contract, mode ↔ required matrix, type ↔ location rules, unbound inputs.
- **`bindings/openapi/emit.ts` + `shapes.ts` + `parameters.ts` + `responses.ts` + `errors.ts`** — Produces an OpenAPI 3.1 `OpenApiDoc` with `paths`, `components.schemas`, the built-in `CommandResult` shape for command responses, and the standard 400 / 409 / 422 / 500 error schemas. Passthrough (`x-*`) annotations deep-merge.
- **`bindings-http/router.ts`** — Entry point `createBindingsRouter({ bindings, graphIrSpec, pdm, qsm, eventStore? })`. Throws a single aggregated `BindingsRuntimeError` if compile errors exist; mounts query / command handlers per binding; serves `/openapi.json`.
- **`bindings-http/startup/compile-plan.ts`** — Per binding, slices the Graph IR to the target graph and calls `compile` or `compileCommand`, producing a `QueryBindingPlan | CommandBindingPlan` discriminated-union.
- **`bindings-http/startup/zod-schema.ts` + `primitive-schema.ts` + `hono-path.ts`** — Derives per-request Zod schemas (query / path / body) from the binding's input set; rewrites OpenAPI `{id}` to Hono `:id`.
- **`bindings-http/runtime/handler.ts` + `command-handler.ts` + `extract.ts` + `remap.ts`** — Per request: extract (list vs last-wins for query), Zod-parse, `bindTo`-map to graph inputs, execute, serialize. Correlation id is injected by `correlation-middleware.ts`.

**Kind × role matrix** (enforced by `validate/consistency.ts`):

| Binding kind | Graph role | Valid? | Required output |
| --- | --- | --- | --- |
| `query` | `query` | ✓ | `rowset<T>` |
| `query` | `command` | ✗ (`BINDINGS_QUERY_ON_COMMAND_GRAPH`) | — |
| `command` | `query` | ✗ (`BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH`) | — |
| `command` | `command` | ✓ | `row<CommandResult>` |

**Error → HTTP status mapping** (bindings-http):

| Status | Trigger |
| --- | --- |
| `400 VALIDATION_ERROR` | Zod `safeParse` failure on query / path / body. |
| `400 INVALID_BODY` | Body is not a JSON object. |
| `409 COMMAND_CONCURRENCY_CONFLICT` | `CommandExecutionError.code === 'COMMAND_CONCURRENCY_CONFLICT'`. |
| `422 COMMAND_*` | Any other `CommandExecutionError` (e.g. `COMMAND_ILLEGAL_TRANSITION`, `COMMAND_GUARD_REJECTED`). |
| `500 INTERNAL_ERROR` | Any uncaught throw. |

**Invariants.**

- **Same 4-layer shape as pdm / qsm / ui.** The bindings validator is the canonical instance of rntme's layered-validator pattern: parse → structural → references → consistency.
- **Fail-fast across layers; aggregate within.** A layer returns all its errors before the next layer runs.
- **Branded stage order.** `StructurallyValidBindings` → `ResolvedBindings` → `ValidatedBindings`; each brand is constructed only by its validator.
- **Commands output `row<CommandResult>`.** Built-in shape `{ aggregateId: string, version: integer, eventIds: array<string> }`.
- **Commands are `POST`-only.** `in: 'query'` parameters are forbidden on a command binding.
- **`requestBody.required = true` whenever any `in: 'body'` parameter exists.** Per-field `required` does not override this.
- **`in: 'path'` parameters are always `required: true`** and the placeholder set must equal the parameter set exactly.
- **Root inputs cannot be bound.** Graphs with `mode: 'root'` inputs fail `BINDINGS_GRAPH_HAS_ROOT_INPUT`.
- **Mode ↔ required matrix.** `required → [true]`, `defaulted → [false]`, `predicate_optional → [false]`, `nullable → [true, false]`, `root → []`.
- **Type ↔ location rules.** Scalars legal everywhere; `list<T>` legal in query / body only; row / rowset forbidden as input.
- **Passthrough annotations deep-merge.** Arrays replace; objects merge key-wise.
- **bindings-http is strict end-to-end.** Zod schemas are `.strict()`; no `additionalProperties: true` escape hatch.
- **`eventStore` is required when any binding is `kind: 'command'`.** Synchronous throw before route mount.
- **Compile errors aggregate.** A partial router is never mounted; `BindingsRuntimeError` carries all failures.

#### Sequence #4 — Validation pipeline (on bindings; shared pattern)

```mermaid
sequenceDiagram
    autonumber
    participant C as Caller (boot / CLI / test)
    participant P as parse (Zod)
    participant S as structural
    participant R as references (resolvers)
    participant K as consistency
    participant B as brand ValidatedBindings

    C->>P: raw JSON
    alt parse fail
        P-->>C: Err(BINDINGS_PARSE_*)
    end
    P-->>C: StructurallyParsed
    C->>S: StructurallyParsed
    alt structural fail
        S-->>C: Err(BINDINGS_STRUCT_*)
    end
    S-->>C: StructurallyValid
    C->>R: StructurallyValid + resolvers
    alt reference fail
        R-->>C: Err(BINDINGS_REF_*)
    end
    R-->>C: Resolved
    C->>K: Resolved
    alt consistency fail
        K-->>C: Err(BINDINGS_CONS_*)
    end
    K-->>C: Consistent
    C->>B: construct brand
    B-->>C: ValidatedBindings
```

**Caption.** pdm / qsm / ui all run the same four layers in this order; only the error-code prefixes and the specific rules differ. The brand is constructible only after all four layers pass — there is no `as ValidatedX` escape hatch in any legitimate code path.

### 4.7 `@rntme/ui` + `@rntme/ui-runtime`

**Purpose.** `@rntme/ui` compiles a multi-file UI authoring tree (manifest + layouts + screens + fragments, all JSON) into a single `CompiledArtifact`. `@rntme/ui-runtime` mounts a Hono sub-router that serves the compiled artifact as per-screen JSON endpoints and a static shell, paired with an esbuild-bundled React SPA that hydrates on the client and fetches screens on-demand.

**Spec lineage.**

| Spec | Date | Status | Contribution |
| --- | --- | --- | --- |
| `docs/superpowers/specs/2026-04-16-ui-artifact-v2-design.md` | 2026-04-16 | landed | UI artifact v2: manifest + screens + layouts + fragments, six-stage pipeline, `CompiledArtifact` shape consumed by the runtime. |

**Component diagram.**

```mermaid
flowchart LR
    classDef stage fill:#5c3a1b,stroke:#e29a4a,color:#fff;
    classDef out fill:#1b3a5c,stroke:#4a90e2,color:#fff;
    classDef run fill:#3a1b5c,stroke:#9a4ae2,color:#fff;

    SRC["source tree<br/>(manifest + *.spec/*.screen/*.layout JSON)"] --> R["resolve/resolve.ts"]:::stage
    R --> E["expand/expand.ts"]:::stage
    E --> V["validate/ (structural + references)"]:::stage
    V --> EM["emit/emit.ts<br/>+ http-map.ts"]:::stage
    EM --> CA["CompiledArtifact"]:::out
    CA --> SRV["ui-runtime: server/index.ts<br/>(Hono sub-router)"]:::run
    CA --> BLD["ui-runtime: build.ts<br/>(esbuild + Tailwind v4)"]:::run
    BLD --> SPA["SPA bundle<br/>(main.js + main.css)"]:::run
    SRV --> CLI["client/entry.tsx<br/>(hydrate)"]:::run
```

**Caption.** The compiler's six stages (parse → resolve → expand → validate → compile orchestrator → emit) produce a single JSON artifact. The runtime splits that artifact into per-screen / per-layout / manifest endpoints so the SPA loads only what each route needs.

**Components (ui compiler).**

- **Parse (implicit).** `JSON.parse` inside `resolve.readFile` catches syntax errors with `MANIFEST_INVALID`.
- **`resolve/resolve.ts`** — Reads the source tree, assembles paired `*.spec.json` + `*.screen.json` / `*.layout.json` files, detects `$ref` cycles.
- **`expand/expand.ts`** — Inlines fragments, substitutes `$param`, prefixes nested element ids as `<refKey>__<elKey>`. After this stage the tree has no `$ref` or `$param` tokens.
- **`validate/` (structural + references)** — Structural: root-element existence, no orphans, slot-only-in-layout. References: bindings resolve, navigation targets match manifest routes, state paths land in a covered prefix (`/form/`, `/route/params/`, `/data/`, `/data/__status/`, `/data/__error/`, `/actions/`).
- **`compile.ts` orchestrator** — Chains the above with fail-fast and produces a `CompiledArtifact` via `emit`.
- **`emit/emit.ts` + `http-map.ts`** — Maps binding ids to HTTP paths (consumes the ValidatedBindings contract), assembles the final artifact (`manifest`, `layouts`, `screens`).

**Components (ui-runtime).**

- **`server/index.ts`** — `createApp({ artifact, assetsDir? })` Hono app. Routes:
  - `GET /_manifest.json` → artifact.manifest.
  - `GET /_layouts/:name` → `artifact.layouts[name]` (404 on miss).
  - `GET /_screens/:name` → `artifact.screens[name]` (404 on miss).
  - `GET /assets/:file` → static file from `assetsDir` (path-traversal sandboxed).
  - `GET /*` → HTML shell (SPA deep-link fallback).
- **`server/static-shell.ts`** — Emits a minimal HTML document loading `/assets/main.js` and `/assets/main.css`.
- **`client/entry.tsx`** — `hydrateApp({ rootSelector })`: fetches `/_manifest.json`, wires store / loader / registry / driver, renders `<AppShell>` and listens to `popstate`.
- **`client/router.ts`** — `matchRoute` (exact-then-`:param` precedence) + `expandTemplate`.
- **`client/screen-loader.ts`** — Per-instance in-memory cache for `/_screens/:name.json` and `/_layouts/:name.json`.
- **`client/registry.ts` + `driver.ts` + `layout-manager.tsx`** — Wires the shadcn catalog, `navigate` / `dispatch` actions with zod validation, parallel data-endpoint fetches with `/data/__status` / `/data/__error` sentinels, and the `<AppShell>` that composes json-render state / action / visibility / validation providers.
- **`build.ts`** — esbuild bundles `client/entry.tsx` → `build/main.js` (ESM, es2022); Tailwind v4 CLI scans that bundle (via `@source` in `client/styles.css`) → `build/main.css`. Both are served under `/assets/`.

**Invariants.**

- **Manifest version is literal `"2.0"`.** Anything else fails at parse.
- **Screen key = route path's last segment.** Two routes with the same trailing segment collide.
- **`$ref` and `$param` are erased post-expand.** Compiled specs contain neither token.
- **Fragment element ids are prefixed recursively.** `<refKey>__<elKey>`, nested refs accumulate.
- **Structural errors short-circuit reference validation.** A broken tree never reaches the reference-layer rules.
- **History-based routing, not hash-based.** SPA deep-link fallback is served by the Hono `GET /*` route.
- **Path precedence is exact-then-param.** `/issues/browse` matches literal before `/issues/:id`.
- **Build order matters.** Tailwind scans the JS bundle; running Tailwind first prunes shadcn classes.
- **Only `server` is exported from the package root.** Browser-only code must import `@rntme/ui-runtime/client`.

#### Sequence #7 — UI compile

```mermaid
sequenceDiagram
    autonumber
    participant CLI as compile() caller
    participant R as resolve
    participant E as expand
    participant VS as validate/structural
    participant VR as validate/references
    participant EM as emit
    participant ART as CompiledArtifact
    participant SRV as ui-runtime server
    participant SPA as React SPA

    CLI->>R: sourceDir + resolvers
    R-->>CLI: ResolvedSource | Err(FILE_NOT_FOUND / CIRCULAR_REF)
    CLI->>E: ResolvedSource
    E-->>CLI: ExpandedSource | Err(UNBOUND_PARAM / UNKNOWN_PARAM)
    CLI->>VS: ExpandedSource
    VS-->>CLI: ok | Err(SPEC_INVALID / MISSING_ROOT / ORPHAN_ELEMENT)
    CLI->>VR: ExpandedSource + resolvers
    VR-->>CLI: ok | Err(UNRESOLVED_BINDING / UNKNOWN_ROUTE / UNCOVERED_STATE_PATH)
    CLI->>EM: ExpandedSource + httpMap
    EM-->>ART: manifest + layouts + screens
    ART->>SRV: createApp({ artifact })
    SRV->>SPA: /_manifest + /_layouts/:name + /_screens/:name (fetched on demand)
```

**Caption.** Compilation is once-per-artifact at build or boot time; the SPA never re-runs validation. Per-screen lazy loading keeps the initial payload small: the shell + manifest is fetched up front, and each route pulls exactly one layout and one screen.

### 4.8 Orchestration layer: `@rntme/seed`, `@rntme/db-studio`, `@rntme/runtime`

#### 4.8.1 `@rntme/seed`

**Purpose.** Parse, validate, and append a declarative JSON of event envelopes (`seed.json`) against the PDM and derived event-type specs, so a fresh deployment can arrive at a useful initial state.

**Spec.** `docs/superpowers/specs/2026-04-15-runtime-seed-design.md` (landed). The before-relay invariant (spec §3.1, §8.3) is the central constraint: seed envelopes must be appended through `eventStore.appendRaw` **before** the relay starts its publish cursor, or seeded events would double-publish once the cursor reached them.

**Surface.** `parseSeed`, `validateSeed`, `loadSeed`, `applySeed`, plus a `seedBuilder` helper and a `rntme-seed` CLI (`validate` / `apply`). Default `eventId` is deterministic (`seed:{aggregateType}:{aggregateId}:v{version}`), default `actor` is `{ kind: 'system', id: 'seed' }`.

**Modes.** `strict` (runtime default — reject non-empty store with `SEED_STORE_NOT_EMPTY`) and `upsertByEventId` (CLI default — idempotent re-apply by skipping seen ids).

See sequence #3 in §3.4 for the boot-time placement of `applySeed`.

#### 4.8.2 `@rntme/db-studio` (in-flight scaffold)

**Purpose.** Expose a read-only libSQL Hrana v3 HTTP endpoint over rntme's two SQLite databases (event log + projection DB), so operators can attach any Hrana-compatible browser studio (for example `libsqlstudio.com`) without bundling a custom UI.

**Spec.** `docs/superpowers/specs/2026-04-18-db-studio-design.md` (design landed; package scaffold in progress).

**Status (2026-04-18).** Only `packages/db-studio/test/` is present; `src/`, `package.json`, and `README.md` are not yet tracked. The runtime manifest carries a `studio: { enabled: false, mountPath: '/_studio', maxRows: 10000 }` block; `http-surface.ts` will mount the sub-router when enabled. This subsection describes intent; refer to the spec for the authoritative shape until the package lands.

**Planned safety.** Three layers of read-only guard: a second SQLite file handle opened read-only (never `:memory:`), a SQL classifier whitelist (`SELECT` / `EXPLAIN` / `PRAGMA` only) with a PRAGMA allow-list, and a server-side row cap (default 10,000) wrapping every result.

#### 4.8.3 `@rntme/runtime`

**Purpose.** Service orchestrator: loads and validates every artifact (`manifest.json` + PDM / QSM / bindings / graphs / UI / seed), boots the plugin seams, wires the event pipeline, applies seed, and mounts the HTTP surface.

**Spec.** `docs/superpowers/specs/2026-04-15-runtime-packaging-design.md` (landed): manifest schema, plugin-seam registration, Docker entry, boot order.

**Plugin seams** (see also §3.3) live in `packages/runtime/src/plugins/interfaces.ts` and are implemented by default in:

- `plugins/better-sqlite-driver.ts` — `BetterSqliteDriver` (default `DbDriver`; reads `eventStorePath` and `qsmPath` from the manifest, falls back to ephemeral `:memory:` in dev).
- `plugins/in-memory-bus.ts` — `InMemoryBus` (default `EventBus`; in-process Kafka emulation for tests and single-node deploys).
- `plugins/http-surface.ts` — `HttpSurface` (default `Surface`; Hono app that mounts bindings at `/api`, the UI at `/`, and — when enabled — db-studio at `/_studio`).
- `plugins/observability.ts` — Prometheus `/metrics` and a `/health` probe; consumed by any surface.

**Boot order (strict; tested in `test/integration/start-service.test.ts`):** `bus.start → wireEventPipeline (no auto-start) → applySeed → pipeline.start (relay + consumer) → HTTP listen`. Reordering any step breaks the before-relay invariant.

**Public API.** `loadService`, `startService`, `buildActorFromRequest`, the `DbDriver` / `EventBus` / `Surface` interfaces and their default implementations, plus the Prometheus helpers. `contract-tests.ts` is deliberately not re-exported (vitest-only dependency); tests import it from the src path.

## 5. L4 — Code

A selection of fourteen functions that carry the most invariants. Signatures are summarised for brevity; names match the current code at the cutoff date (2026-04-18). This is a pointer table — read the file for the actual implementation; follow-up observations on any of these live in §7.

| Function | Package | Purpose (one line) |
| --- | --- | --- |
| `validatePdm(raw)` | `@rntme/pdm` | Orchestrate structural → state-machine validation and construct the `ValidatedPdm` brand. |
| `validateQsm(raw, pdm)` | `@rntme/qsm` | Orchestrate structural → cross-ref validation and construct the `ValidatedQsm` brand. |
| `validateBindings(raw, resolvers)` | `@rntme/bindings` | Run the four validator layers and construct `ValidatedBindings`. |
| `generateOpenApi(validated, resolvers, opts?)` | `@rntme/bindings` | Emit OpenAPI 3.1 from a validated binding artifact. |
| `compile(rawSpec, rawPdm, rawQsm, opts?)` | `@rntme/graph-ir-compiler` | Query compile: parse → structural → normalize → semantic → plan → relational → lower → emit SQL. |
| `compileCommand(rawSpec, rawPdm, rawQsm)` | `@rntme/graph-ir-compiler` | Command compile: shared head + emit-plan construction + optional read-prelude. |
| `wrapPredicateOptional(...)` | `@rntme/graph-ir-compiler` | Wrap a predicate with `(predSql) OR (? IS NULL)` null-guards for each optional param (bug fixed 2026-04-16). |
| `appendEvents(requests)` | `@rntme/event-store` | Atomic multi-subject append with optimistic concurrency on `(subject, expectedVersion)`. |
| `appendRaw(envelopes, opts?)` | `@rntme/event-store` | Bypass command validation to seed or replay; `ignoreDuplicates` idempotent mode available. |
| `createRelay(opts)` | `@rntme/event-store` | Polling relay: read from cursor → encode CloudEvents → send → retry → DLQ → advance cursor. |
| `compileApplyPlan({ pdm, qsm, events, derivedHandlers? })` | `@rntme/projection-consumer` | Produce the handler plan for mirror + derived projections (pure, no DB). |
| `applyEvent(db, plan, envelope)` | `@rntme/projection-consumer` | Execute a single handler under the three-layer idempotency guard (mirror) or `seen_events` gate (derived). |
| `applySeed(seed, store, mode?)` | `@rntme/seed` | Apply validated seed envelopes via `appendRaw` before the relay starts. |
| `startService(validatedService, config?)` | `@rntme/runtime` | Orchestrate boot: bus → wire pipeline → apply seed → start pipeline → mount HTTP surface. |

Follow-up notes on anything surprising here belong in §7, not in this table.

## 6. Cross-cutting abstractions

Each entry below uses a fixed record format so Task-22's structural check can verify completeness:

- **Package / module:** `packages/<pkg>/src/<path>` (no line numbers).
- **Purpose:** one sentence.
- **Contract:** signature or structure.
- **Constructed by:** who creates instances and when.
- **Invariant:** what must hold.
- **Spec(s):** canonical spec link or "not covered by spec".
- **Related:** 1–3 related abstractions.

Sub-sections §6.0 – §6.5 group entries by layer. Follow-up observations about any entry (drift, ambiguity, duplication) belong in §7, not here.

### 6.0 Foundational (type-level plumbing)

#### `Result<T>` — success / error discriminator

- **Package / module:** `packages/pdm/src/types/result.ts` (and per-package copies in `qsm`, `bindings`, `event-store`, `graph-ir-compiler`, `projection-consumer`, `ui`, `seed`, `runtime`).
- **Purpose:** Make success / failure a first-class value across every package boundary; remove the need for exception handling at public APIs.
- **Contract:** `type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }`. Constructors `ok(value)` and `err(error)`; discriminators `isOk` and `isErr`.
- **Constructed by:** Any function whose public return can fail at a package boundary. Prohibited constructors inside `try/catch` that translate a native throw must still land on `err(...)` before exiting the package.
- **Invariant:** Exceptions never leak out of a package's public API. Consumers pattern-match `result.ok`; they never call `result.value` without checking.
- **Spec(s):** not covered by spec — it is a codebase convention documented in `AGENTS.md §4`.
- **Related:** `Validated*` brand family, `ERROR_CODES`, 4-layer validator.

#### `isOk` / `isErr` — Result discriminators

- **Package / module:** alongside each package's `result.ts`.
- **Purpose:** Narrowing helpers so TypeScript recognises `result.value` / `result.error` after a type-guard.
- **Contract:** `isOk(r): r is Ok<T>`, `isErr(r): r is Err<E>`.
- **Constructed by:** re-exported from the same module that defines `Result`.
- **Invariant:** Exactly one is true for any given `Result`.
- **Spec(s):** same as `Result<T>`.
- **Related:** `Result<T>`.

#### Branded `Validated*` family

- **Package / module:** each owner's `types/artifact.ts` (pdm, qsm, bindings, ui) — `StructurallyValid*`, `Resolved*`, `Validated*` branded types.
- **Purpose:** Encode validator success in the type system; downstream packages must accept only the brand.
- **Contract:** `type ValidatedX = XParsed & { readonly [ValidatedBrand]: true }` with a declared `unique symbol`. No public `of()` constructor.
- **Constructed by:** the final validator layer inside the owner package (for example `validate/state-machine.ts` for PDM, `validate/cross-ref.ts` for QSM, `validate/consistency.ts` for bindings). A call-site in any other package cannot construct the brand.
- **Invariant:** `as ValidatedX` is an anti-pattern. Every brand construction site is a single cast inside the validator it belongs to. Downstream APIs accept only the branded type, which forces calls to go through the orchestrator.
- **Spec(s):** per-package design specs (`2026-04-14-mutations-design.md`, `2026-04-14-bindings-design.md`, `2026-04-16-qsm-relations-migration-design.md`, `2026-04-16-ui-artifact-v2-design.md`).
- **Related:** 4-layer validator, `Result<T>`.

#### `ERROR_CODES` registry — stable machine-readable identifiers

- **Package / module:** each owner's `types/result.ts` (for example `packages/pdm/src/types/result.ts`, `packages/bindings/src/types/result.ts`).
- **Purpose:** Give every validation / runtime failure a stable, documented identifier callers can match on.
- **Contract:** Frozen object `ERROR_CODES` exporting keys of shape `<PKG>_<LAYER>_<KIND>` (for example `PDM_SM_UNREACHABLE_STATE`, `QSM_XREF_ENTITY_MIRROR_DUPLICATE`, `BINDINGS_CONS_MODE_MISMATCH`). The type `PdmErrorCode` / `QsmErrorCode` / `BindingsErrorCode` is a union of the values.
- **Constructed by:** Never at call sites — codes are referenced by name only.
- **Invariant:** Codes are APPEND-ONLY. Reordering or deleting a code is a breaking change for any automated error monitor. Renaming is forbidden; to rename, add a new code and deprecate the old in comments.
- **Spec(s):** `AGENTS.md §4` defines the naming rule; each owner's spec enumerates the codes it added.
- **Related:** `Result<T>`, 4-layer validator.

#### 4-layer validator pattern

- **Package / module:** `packages/{pdm,qsm,bindings,ui}/src/validate/` + `parse/`.
- **Purpose:** Fail-fast layered validation. Each artifact passes parse → structural → reference / cross-ref → consistency before any downstream code consumes it.
- **Contract:** `parse(raw) → Result<Parsed>`, then per-layer `Result<...>` functions. An orchestrator `validateX(raw, resolvers?)` short-circuits on the first failing layer.
- **Constructed by:** Each owner packages the orchestrator; no consumer runs layers manually.
- **Invariant:** Layers are ordered; skipping one (even on "trusted" input) loses downstream error codes. Errors from layer N + 1 are never seen when layer N fails.
- **Spec(s):** each artifact's design spec plus `AGENTS.md §4`.
- **Related:** `Validated*` brand family, `Result<T>`, `ERROR_CODES`.

### 6.1 Domain artifacts (PDM / QSM / Graph IR)

#### Entity, Field, Relation (PDM)

- **Package / module:** `packages/pdm/src/types/artifact.ts` + `parse/schema.ts`.
- **Purpose:** The PDM artifact's three core nouns — entities (tables), their fields (columns), and relations (foreign-key-like associations between entities).
- **Contract:** `Entity = { name, fields: Field[], keys: string[], stateField?, relations?: Relation[] }`; `Field = { name, type, nullable, column, generated? }`; `Relation = { name, to, localKey, foreignKey, cardinality }`.
- **Constructed by:** Zod parse in `parse/schema.ts` emits the shape; structural and state-machine validators promote it to `ValidatedPdm`.
- **Invariant:** `stateField` is non-nullable string; `keys` reference fields on the same entity; `relation.to` is local-only (single-service).
- **Spec(s):** `docs/superpowers/specs/done/2026-04-14-mutations-design.md`.
- **Related:** `StateMachine`, `Projection`, `RelationMetadata` (QSM).

#### `StateMachine` + `Transition`

- **Package / module:** `packages/pdm/src/types/artifact.ts` + `validate/state-machine.ts`.
- **Purpose:** Encode per-entity finite-state machines that drive event-sourced mutations; the validator enforces reachability and declared effects.
- **Contract:** `StateMachine = { stateField, states: string[], initial: null, transitions: Transition[] }`; `Transition = { name, from, to, affects: string[], payload?, ... }`.
- **Constructed by:** `validate/state-machine.ts` after `validate/structural.ts`.
- **Invariant:** Creation transitions declare `affects` explicitly; self-loops declare non-empty `affects`; all states reachable by BFS from a creation transition.
- **Spec(s):** `2026-04-14-mutations-design.md` (§4).
- **Related:** `EventTypeSpec` (`derive/event-types.ts`), `Projection`.

#### `Projection` + `Backing`

- **Package / module:** `packages/qsm/src/types/artifact.ts` + `validate/structural.ts` + `validate/cross-ref.ts`.
- **Purpose:** Declare a read-side materialized table backed by a PDM entity (`entity-mirror`) or by a future graph IR (`derived`, MVP-gated).
- **Contract:** `Projection = { backing, source, keys, grain, exposed, table }`; `ProjectionBacking = 'entity-mirror' | 'derived'`.
- **Constructed by:** QSM cross-ref validator promotes `StructurallyValidQsm` to `ValidatedQsm` only if each projection passes its backing-specific rules.
- **Invariant:** Exactly one entity-mirror per source entity; keys and grain set-equal to the source entity's keys; `derived` backing is rejected by `validateQsm()` (parse accepts, cross-ref rejects).
- **Spec(s):** `2026-04-14-mutations-design.md` (§6), `2026-04-16-qsm-relations-migration-design.md`.
- **Related:** `RelationMetadata`, `ApplyPlan` (projection-consumer), derived-DDL `ProjectionDdlSpec`.

#### `RelationMetadata` (post-2026-04-16)

- **Package / module:** `packages/qsm/src/types/artifact.ts` + `validate/cross-ref.ts`.
- **Purpose:** Read-side relation graph used by the Graph-IR compiler to emit JOINs. Owned by QSM (not PDM) as of 2026-04-16.
- **Contract:** `{ "<ProjectionName>.<relationName>": { to, localKey, foreignKey, cardinality, role? } }`.
- **Constructed by:** QSM cross-ref validator after B2 parity check against PDM.
- **Invariant:** B2 parity with PDM on `(to, localKey, foreignKey, cardinality)`; PDM is canon. `cardinality: 'many'` is parse-accepted but rejected by the Graph-IR compiler (`NAV_FAN_OUT_NOT_ALLOWED`).
- **Spec(s):** `2026-04-16-qsm-relations-migration-design.md`.
- **Related:** `Projection`, `ValidatedQsm`, Graph IR `Scan` / `Join` operators.

#### Graph IR `Operator` + `SemanticPlan`

- **Package / module:** `packages/graph-ir-compiler/src/types/authoring.ts` + `semantic-plan/build.ts`.
- **Purpose:** Canonical rc7 rowset operators (`findMany`, `filter`, `map`, `reduce`, `sort`, `limit`, `emit`) and the typed `PlanStep[]` that carries them through the compiler.
- **Contract:** Operators are a discriminated union; `SemanticPlan = { steps: PlanStep[] }`.
- **Constructed by:** Produced by `buildSemanticPlan(canonicalGraph, pdm, qsm)` after structural + semantic validation.
- **Invariant:** Param order reflects statement order — `lowerExpr` appends to `paramOrder` in the same order they will appear in emitted SQL; a reorder here is a correctness bug.
- **Spec(s):** `docs/superpowers/specs/done/2026-04-13-graph-ir-sql-compiler-mvp-design.md`.
- **Related:** `LoweredPlan` (lower/sqlite), `BindingPlan` (bindings-http), `EmitPlan` (command runtime).

#### `EventTypeSpec` — derived event shape

- **Package / module:** `packages/pdm/src/derive/event-types.ts` + `packages/pdm/src/types/artifact.ts`.
- **Purpose:** One spec per PDM state-machine transition. Drives downstream shape of envelopes, projection handlers, and OpenAPI command shapes.
- **Contract:** `{ aggregate, transition, eventType, affects, payload, isCreation, isSelfLoop, fromStates, toState }`.
- **Constructed by:** `deriveEventTypes(ValidatedPdm)` at boot.
- **Invariant:** `eventType` name is stable across additive changes; a breaking change requires a new `eventType`, not a topic-version suffix.
- **Spec(s):** `2026-04-14-mutations-design.md`, `2026-04-17-cloudevents-envelope-design.md`.
- **Related:** `Envelope` (§6.2), `ApplyPlan`, command `EmitPlan`.

### 6.2 Runtime (events, storage, consumer)

#### `Envelope` / CloudEvents 1.0 shape

- **Package / module:** `packages/event-store/src/types/envelope.ts`.
- **Purpose:** The single serialization shape for every event in rntme — CloudEvents 1.0 on the wire, camelCase in memory.
- **Contract:** In-memory `EventEnvelope<TPayload>` with `id`, `time`, `type`, `source`, `subject`, `correlationId`, `rntAggregateType`, `rntAggregateId`, `rntVersion`, `rntSchemaVersion`, `data`, `actor`. On the wire, CE-mandated attributes are `ce_*` headers in Kafka binary content mode; `data` is the JSON body.
- **Constructed by:** Command handlers (via `@rntme/graph-ir-compiler`) and the seed loader; never by consumers.
- **Invariant:** Caller mints `id`, `time`, and `correlationId`. The store never generates them; determinism is required for replay and golden tests.
- **Spec(s):** `docs/superpowers/specs/2026-04-17-cloudevents-envelope-design.md`.
- **Related:** `EventStore` interface, DLQ payload, topic convention.

#### `EventStore` interface

- **Package / module:** `packages/event-store/src/store/interface.ts`.
- **Purpose:** The single seam the rest of rntme talks to for event-sourced writes, reads, and per-event delivery-tracking.
- **Contract:** `appendEvents`, `appendRaw`, `readStream`, `readFrom`, `readRecordsFrom`, `readCursor` / `writeCursor`, plus `readDeliveryAttempt`, `recordDeliveryAttempt`, `updateLastError`, `markDelivered`, `markDlq`.
- **Constructed by:** The default implementation is `SqliteEventStore({ filename, serviceName })` in `packages/event-store/src/store/sqlite.ts`. A manifest may supply a different driver via the `DbDriver` seam.
- **Invariant:** `appendEvents` is atomic across subjects (single `BEGIN IMMEDIATE`); optimistic concurrency is enforced on `(subject, expectedVersion)`; `appendRaw` is reserved for seed and replay (bypass command validation, trusts caller's `rntVersion`).
- **Spec(s):** `2026-04-17-cloudevents-envelope-design.md`, `2026-04-17-relay-dlq-delivery-tracking-design.md`.
- **Related:** `Relay`, `ApplyPlan`, `Seed envelope`.

#### `PublishCursor` — per-relay monotonic offset

- **Package / module:** `packages/event-store/src/store/` (table `publish_cursor`).
- **Purpose:** Track how far each relay has published, so at-least-once delivery replays from a known point after a crash.
- **Contract:** Row per `relayId` carrying `last_event_id` and `updated_at`; `writeCursor(relayId, lastEventId)` UPSERTs and rejects non-monotonic values.
- **Constructed by:** Each relay instance allocates its own `cursorId` at `createRelay`.
- **Invariant:** The cursor advances only after a batch is accepted by the producer; a crash mid-batch replays on restart.
- **Spec(s):** `2026-04-17-cloudevents-envelope-design.md` (§6) + `2026-04-17-relay-dlq-delivery-tracking-design.md`.
- **Related:** `Relay`, `EventStore`, `DLQ`.

#### `Relay` (at-least-once publisher)

- **Package / module:** `packages/event-store/src/relay/loop.ts`.
- **Purpose:** Drain `readRecordsFrom(cursor)` batches, encode each envelope to CloudEvents 1.0 binary, publish to `KafkaProducer`, advance the cursor.
- **Contract:** `createRelay({ store, cursorId, kafka, serviceName, onDlqError? })` returns `{ start, stop }`.
- **Constructed by:** `packages/runtime/src/start/start-service.ts` after `wireEventPipeline` and `applySeed`.
- **Invariant:** At-least-once delivery, per-subject Kafka order (key = `subject`), exponential-backoff retry up to `maxAttempts`, then DLQ emit; unbounded DLQ retry.
- **Spec(s):** `2026-04-17-relay-dlq-delivery-tracking-design.md`.
- **Related:** `PublishCursor`, `DLQ`, `ApplyPlan`, sequence #6.

#### `DLQ` payload + delivery tracking

- **Package / module:** `packages/event-store/src/relay/dlq-envelope.ts` + `packages/event-store/src/store/` (`delivery_tracking` table).
- **Purpose:** Capture events that exceeded primary-topic retries, without blocking the cursor.
- **Contract:** `DlqPayload = { failedEvent, reason: 'max-attempts-exceeded', attempts, firstAttemptAt, lastError }` wrapped in a fresh `EventEnvelope` with `type = '{serviceName}.Relay.EventDeliveryFailed'`, published to `{primaryTopic}.dlq`. Per-event `delivery_tracking` row records attempt count, timestamps, last error.
- **Constructed by:** The relay on retry exhaustion.
- **Invariant:** DLQ retry is unbounded; failure of the DLQ topic itself is surfaced through `onDlqError` for operator alerting — it does not block the cursor.
- **Spec(s):** `2026-04-17-relay-dlq-delivery-tracking-design.md`.
- **Related:** `Relay`, `Envelope`.

#### `ApplyPlan` + three-layer idempotency

- **Package / module:** `packages/projection-consumer/src/types/apply.ts` + `packages/projection-consumer/src/apply/*`.
- **Purpose:** Per-event handler bundle for mirror and derived projections; the concrete unit of idempotent read-side apply.
- **Contract:** `ApplyPlan = { handlersByEventType, mirrorsByAggregate }`. Mirror handlers run under a three-layer guard: pre-check `last_event_version`, `INSERT ... ON CONFLICT DO UPDATE WHERE last_event_version < excluded.last_event_version` (creation), `UPDATE ... WHERE last_event_version < ?` (non-creation). Derived handlers gate on `seen_events(event_id, projection_id)` before a delta UPSERT.
- **Constructed by:** `compileApplyPlan({ pdm, qsm, events, derivedHandlers? })` — pure, no DB.
- **Invariant:** All three mirror layers are mandatory; removing any regresses replay safety. Batch apply is all-or-nothing under `BEGIN IMMEDIATE`.
- **Spec(s):** `2026-04-14-mutations-design.md` (§6), `docs/superpowers/specs/2026-04-18-d5-consumer-idempotency-hybrid-design.md`.
- **Related:** `Envelope`, `Projection`, `EventTypeSpec`.

#### `Seed envelope` + before-relay invariant

- **Package / module:** `packages/seed/src/apply.ts` + `packages/seed/src/types.ts`.
- **Purpose:** Allow a service to arrive at a useful initial state by declaring envelopes that are appended through the normal event store, then projected through the normal pipeline, but without double-publishing through Kafka.
- **Contract:** `applySeed(validatedSeed, store, { mode: 'strict' | 'upsertByEventId', ... })`. Default `eventId` = `seed:{aggregateType}:{aggregateId}:v{version}`, default `actor` = `{ kind: 'system', id: 'seed' }`.
- **Constructed by:** `packages/runtime/src/start/start-service.ts` between `wireEventPipeline` and `pipeline.start` (the strict boot-order invariant; see §3.4).
- **Invariant:** Seed envelopes must be appended BEFORE the relay's cursor starts advancing; the spec-§3.1 invariant is what prevents seed events from being re-published through Kafka.
- **Spec(s):** `docs/superpowers/specs/2026-04-15-runtime-seed-design.md`.
- **Related:** `Relay`, `ApplyPlan`, `startService`.

### 6.3 HTTP / UI

#### `BindingKind × Role` matrix

- **Package / module:** `packages/bindings/src/validate/consistency.ts` + `packages/bindings/src/types/artifact.ts`.
- **Purpose:** Ensure a binding's `kind` (`query | command`) agrees with the target graph's role, and that the output shape matches.
- **Contract:** `BindingKind = 'query' | 'command'`. Matrix: `query × query` requires `rowset<T>` output; `command × command` requires `row<CommandResult>`; other combinations are errors.
- **Constructed by:** Enforced in `checkGraphShape` during consistency validation.
- **Invariant:** Commands are `POST`-only and forbid `in: 'query'` parameters.
- **Spec(s):** `2026-04-14-bindings-design.md`.
- **Related:** `BindingPlan`, `CommandResult`, OpenAPI emitter.

#### `BindingPlan` — discriminated plan

- **Package / module:** `packages/bindings-http/src/startup/compile-plan.ts` + `packages/bindings-http/src/types/`.
- **Purpose:** The runtime pairing of a binding with its compiled graph, ready for per-request execution.
- **Contract:** `QueryBindingPlan | CommandBindingPlan` discriminated-union; each carries the compile result, input Zod schemas, and the HTTP path / method.
- **Constructed by:** `buildPlan` at router creation. Compile errors aggregate; a partial router is never mounted.
- **Invariant:** `eventStore` is required when any binding is `kind: 'command'`; synchronous throw before route mount.
- **Spec(s):** `2026-04-14-bindings-http-design.md`.
- **Related:** `BindingKind × Role`, `CommandResult`, OpenAPI emitter.

#### HTTP error → status mapping

- **Package / module:** `packages/bindings-http/src/errors.ts`.
- **Purpose:** Single source of truth for HTTP error codes emitted by `bindings-http`.
- **Contract:** `VALIDATION_ERROR | INVALID_BODY → 400`; `COMMAND_CONCURRENCY_CONFLICT → 409`; any other `CommandExecutionError → 422`; uncaught → `500`.
- **Constructed by:** The query and command handler modules; `commandErrorStatus(err) → 409 | 422`.
- **Invariant:** `409` is reserved for concurrency; `422` is every other business-rule rejection. Middleware cannot reinterpret a status.
- **Spec(s):** `2026-04-14-bindings-http-design.md` (§7).
- **Related:** `BindingPlan`, `CommandExecutionError`.

#### OpenAPI 3.1 emitter

- **Package / module:** `packages/bindings/src/openapi/emit.ts` + siblings (`shapes.ts`, `parameters.ts`, `responses.ts`, `errors.ts`, `command-result.ts`, `passthrough.ts`).
- **Purpose:** Emit an OpenAPI 3.1 document from a `ValidatedBindings` artifact, for tooling and client generation.
- **Contract:** `generateOpenApi(validated, resolvers, options?) → Result<OpenApiDoc>`. Produces `paths` per `(method, path)`, `components.schemas` for row shapes, and the built-in `CommandResult` shape plus standard 400 / 409 / 422 / 500 schemas. Passthrough `x-*` annotations deep-merge.
- **Constructed by:** `packages/bindings-http/src/router.ts` at startup, served at `/openapi.json`.
- **Invariant:** Emission is pure over `ValidatedBindings`; a missing resolver is a failure, not silent omission.
- **Spec(s):** `2026-04-14-bindings-design.md` (§7).
- **Related:** `BindingPlan`, `BindingKind × Role`.

#### UI compile pipeline + `CompiledArtifact`

- **Package / module:** `packages/ui/src/compile.ts` + siblings (`resolve/`, `expand/`, `validate/`, `emit/`); output type in `packages/ui/src/types/compiled.ts`.
- **Purpose:** Take a multi-file UI authoring tree and produce a single JSON artifact (`manifest`, `layouts`, `screens`) consumed by `@rntme/ui-runtime`.
- **Contract:** `compile(options) → Result<CompiledArtifact>`. Six-stage pipeline: parse (implicit in resolve) → resolve → expand → validate (structural + references) → compile orchestrator → emit.
- **Constructed by:** `packages/runtime` at boot (or by an external build step that persists the artifact).
- **Invariant:** Compiled specs contain no `$ref` or `$param` tokens. Manifest version is literal `"2.0"`. Structural errors short-circuit reference validation.
- **Spec(s):** `docs/superpowers/specs/2026-04-16-ui-artifact-v2-design.md`.
- **Related:** `BindingPlan` (for HTTP-map resolution during emit), `Surface` plugin (serves the artifact).

## 7. Observations and refactoring candidates

_(pending — Tasks 17–20)_

## 8. Glossary

_(pending — Task 21)_

## 9. How to use and maintain this document

_(pending — Task 21)_
