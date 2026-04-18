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

_(pending — Tasks 5–12)_

## 5. L4 — Code

_(pending — Task 13)_

## 6. Cross-cutting abstractions

_(pending — Tasks 14–16)_

## 7. Observations and refactoring candidates

_(pending — Tasks 17–20)_

## 8. Glossary

_(pending — Task 21)_

## 9. How to use and maintain this document

_(pending — Task 21)_
