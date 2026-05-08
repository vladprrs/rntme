# Project Lifecycle Init Design

Date: 2026-05-08

## Status

Approved design for planning. No implementation plan has been written yet.

## Context

The current seed implementation is service-local:

- Authoring path is `services/<service>/seed/seed.json`.
- `@rntme/seed` lives under `packages/artifacts/seed`.
- Runtime loads seed during service boot and applies it to the service-local
  event-store before relay/projection startup.

This conflicts with the decision-system direction that seed is a module-like
capability, not a core artifact. It also makes initialization look like a
runtime boot special case instead of a project lifecycle concern.

During design discussion we also changed the target persistence model. The
service-local event-store should not be treated as the durable replay boundary.
It remains useful as a transactional outbox/write buffer for service command
handling, but project event history belongs to the project event log and later
the DWH replay/audit layer.

## Goals

- Move initialization authoring to project scope.
- Make init orchestration a project lifecycle process, not a runtime boot hook.
- Keep QSM as serving state only.
- Preserve the transactional outbox pattern for service command handling.
- Allow `seed-events` init to publish project events without writing the
  service-local event-store/outbox.
- Use project Operaton/BPMN for init orchestration once infrastructure is up.
- Keep provisioners and init semantically distinct, even when BPMN orchestrates
  both.

## Non-Goals

- Define event schema migration or old-event upgrade mechanics.
- Build the DWH replay/backfill mechanism.
- Replace the service command transactional outbox path.
- Let init or any provider write QSM directly as domain state.
- Design production-grade compensation/deprovisioning for init side effects.

## Decision-System Update

This design requires a `docs/decision-system.md` update during implementation.
The change should supersede the current locked bets:

- `Single-writer event log`.
- `No outbox table; event log IS the outbox`.

Add a new locked-pending bet:

> **Project event log + DWH own replay truth** - Kafka-compatible project
> topics are the operational event log; DWH is the long-retention replay/audit
> source. Service-local event stores are allowed as transactional outbox/write
> buffers, not as the durable replay boundary. QSM is serving state and must not
> be treated as replay truth. Events must carry the domain facts needed to
> rebuild owned projections; projection logic must not depend on unrecorded
> point-in-time external state. - G1, G3, F4, F6, F8 - `locked-pending`

Runtime consequences:

- Service command handling may keep using a local transactional outbox.
- Relay or future SQLite CDC publishes command-originated events to the project
  event log.
- QSM is maintained from project event topics.
- DWH later becomes the cross-service replay source for projection rebuilds and
  audit.

## Persistence Model

Kafka-compatible project topics are the operational event log. DWH is the
future long-retention replay and audit source. Service-local event-store remains
allowed as an implementation detail for transactional command/outbox handling,
but it is not the durable replay boundary.

QSM remains service-local serving state. Init, modules, BPMN, and commands must
not write QSM directly as domain truth. QSM is populated from events and can be
rebuilt from project event history or future DWH replay mechanisms.

Projection invariants:

- Domain events must contain the facts required to build owned projections.
- Projection logic must not depend on unrecorded point-in-time external state.
- Projections such as median, percentile, cohort, or other history-dependent
  state may need a rebuild/backfill mechanism that reads project event history
  or DWH. Runtime request paths should not read DWH directly.
- Event schema migration and old-event upgrades are a separate future design.

## Deploy Pipeline

The target deploy pipeline moves toward:

```text
plan infrastructure
-> render/apply infrastructure
-> start project lifecycle engine/workloads
-> run project lifecycle BPMN
-> open/apply public workloads/traffic
-> verify
```

Infrastructure includes shared resources needed before project lifecycle work:

- Redpanda or another Kafka-compatible event bus.
- RustFS or other target-local object storage when configured.
- Operaton as the project lifecycle engine when init/workflows require BPMN.

Operaton is treated as project lifecycle infrastructure, not merely a
deploy-control engine. The deploy executor starts a lifecycle process instance
and waits for completion before opening public traffic or marking the deployment
successful.

Normal public traffic stays closed while init-capable workloads run. Domain
services and needed modules may be running internally so they can consume events,
project QSM, and report readiness, but edge routes are not open until the
project lifecycle process completes.

## Project Init Artifact

Add a project-level init artifact:

```text
init/init.json
init/files/**
```

Target shape:

```json
{
  "initVersion": 1,
  "process": {
    "kind": "bpmn",
    "definition": "project-initialized.bpmn",
    "processId": "ProjectInitialized"
  },
  "steps": [
    {
      "id": "notes.welcome",
      "type": "init",
      "provider": "seed-events",
      "targetService": "app",
      "mode": "lifecycle",
      "input": { "path": "files/notes.seed.json" },
      "dependsOn": []
    }
  ]
}
```

Path rules:

- `init/init.json` is rooted at project `init/`.
- `process.definition` is relative to `init/`.
- Step input paths are relative to `init/`.
- Absolute paths, parent traversal, empty segments, backslashes, and URI-scheme
  paths are invalid.

Blueprint validates:

- JSON shape and `initVersion`.
- Target services exist.
- Provider and mode are supported.
- Referenced files exist and are safe relative paths.
- `seed-events` inputs validate against project PDM, service ownership, derived
  event types, and seed schema.

The target model removes `services/<service>/seed/seed.json`. Pre-stable status
allows this as a breaking authoring change.

## Seed-Events Provider

`seed-events` v1 publishes validated domain events directly to the project event
log. It does not write the service-local event-store/outbox.

Sequential flow:

```text
1. Deploy applies infrastructure.
2. Deploy starts init-capable services, needed modules, Operaton, and lifecycle worker.
3. Deploy starts the project lifecycle BPMN process.
4. BPMN reaches a seed-events task.
5. seed-events worker reads init/files/*.seed.json and project artifacts.
6. Worker validates target service, service ownership, event types, payloads,
   ids, versions, and idempotency keys.
7. Worker publishes accepted domain events to project event topics.
8. Target service projection consumer reads those topics and applies QSM.
9. Worker waits for target projection checkpoint/status for expected event ids.
10. BPMN step completes or fails with structured errors.
```

Rules:

- Direct publish is allowed only for declared lifecycle init providers.
- `seed-events` must not write QSM directly.
- `seed-events` must not write service-local event-store/outbox.
- Service-local transactional outbox remains for service command path only.
- Target services may still defensively reject/DLQ invalid envelopes on consume.
- Init success means the target service projected expected events, not merely
  that the worker published them.

The shared validation code currently in `@rntme/seed` should move toward an
init/provider package or module surface that can validate against project
artifacts without importing runtime implementations.

## BPMN Lifecycle

Project lifecycle BPMN orchestrates init steps and, later, provisioner-like
tasks. Provisioners and init remain different task types:

- Provisioners create or configure capabilities: Auth0 apps, buckets, module
  credentials, webhooks.
- Init creates initial business state: reference data, demo data, baseline
  organizations/users/roles, migration events.

Both can use BPMN retries, incidents, timers, and operator visibility. The
first implementation may keep module provisioners in the platform executor, but
the target architecture should allow service tasks such as:

- `ProvisionModule`
- `RunInitProvider`
- `WaitForProjection`
- `OpenTrafficGate`

## Status And Acknowledgement

Init needs an acknowledgement surface so BPMN and deploy know a step completed.
The acknowledgement must be based on projection progress.

Acceptable status designs for planning:

- Service publishes `InitStepProjected` or similar status events after applying
  all expected event ids.
- Service exposes an internal status endpoint keyed by step id and expected
  event ids.
- Projection consumer writes checkpoint state that lifecycle worker can query.

The implementation plan must choose one. The design invariant is that a
`seed-events` step is complete only after the target service has projected the
published events.

## Error Handling

Validation failures fail the BPMN task with structured errors and do not publish
partial event batches.

Publish failures use BPMN retry policy. If retries exhaust, the process enters
an incident/failure state and deploy does not open traffic.

Projection timeout means the init step fails even if events were published.
This produces an initialized-but-not-projected diagnostic and keeps traffic
closed.

Consumer-side invalid event handling must be visible through DLQ/failure
surfaces. It must not silently skip lifecycle init events.

## Testing Strategy

Focused coverage should include:

- `init/init.json` parse and safe-path validation.
- Cross-reference validation for target service ownership and event types.
- `seed-events` validation against PDM-derived event specs.
- No writes to service-local event-store/outbox from init path.
- Direct publish to project event topics.
- Projection checkpoint/status completion before BPMN step success.
- Deploy executor phase ordering.
- Public traffic remains closed until lifecycle process completion.

## Documentation Touch

Implementation should update:

- `docs/decision-system.md` for the new project-log/DWH replay bet and
  superseded event-store bets.
- `AGENTS.md` if project init paths become standard navigation.
- `docs/current/owners/packages/artifacts/blueprint.md` for `init/init.json`.
- A new or moved owner doc for the init/seed provider package.
- `docs/current/owners/packages/deploy/deploy-core.md` for phased planning and
  lifecycle init.
- `docs/current/owners/packages/deploy/deploy-dokploy.md` for infrastructure
  apply before lifecycle/workloads.
- `docs/current/owners/packages/runtime/runtime.md` and
  `docs/current/owners/packages/runtime/projection-consumer.md` for consuming
  project event topics as QSM input.
- Demo owner docs when `services/<service>/seed/seed.json` is removed.

## Open Implementation Choices

The design intentionally leaves these for the implementation plan:

- Exact `init/init.json` schema details for retries/timeouts.
- Whether lifecycle BPMN definitions live under `init/` or reuse
  `workflows/`.
- Status acknowledgement mechanism.
- Package/module name for shared init provider validation.
- Exact topic naming for project event topics under configured prefixes.
- Whether provisioners move to BPMN in the first slice or remain executor-run
  while init uses BPMN.

