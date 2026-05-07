> Status: historical.
> Date: 2026-05-05.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Provisioned BPMN / Operaton - design

**Status:** brainstorming approved, awaiting user review of this spec
**Status update (2026-05-06):** Superseded in part by `docs/history/specs/historical/2026-05-06-graph-ir-effect-operations-design.md`: short intra-request integration calls are now Graph IR `call` nodes rather than binding `pre[]`, and workflow service tasks target action-exposed operations rather than command-kind bindings. The BPMN boundary and Operaton deployment model remain authoritative.
**Author:** brainstorm 2026-05-05
**Related:**
- `docs/history/specs/historical/2026-04-23-project-first-blueprint-design.md` - project-first blueprint model. This spec adds a project-level workflow artifact.
- `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md` - project deployment pipeline. This spec fills the prior Operaton/BPMN out-of-scope item.
- `docs/history/specs/historical/2026-05-01-provisioned-event-bus-design.md` - provisioned Redpanda. The BPMN demo requires a provisioned event bus.
- `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md` - gRPC command surfaces and the no-choreography boundary.
- `docs/adr/2026-04-15-event-driven-architecture.md` - current ADR still names Zeebe as the placeholder workflow engine; this spec makes Operaton the current BPMN target for new work.

**Implementation locations:**
- `packages/artifacts/workflows/` - new `@rntme/workflows` artifact package.
- `packages/artifacts/blueprint/` - workflow artifact discovery and project composition integration.
- `packages/deploy/deploy-core/` - target-neutral workflow engine and BPMN worker plan model.
- `packages/deploy/deploy-dokploy/` - Operaton and BPMN worker rendering/apply.
- `apps/platform-http/` - deploy executor plumbing and smoke verification.
- `demo/order-fulfillment-blueprint/` - new BPMN validation demo.

## 1. Problem

rntme has service-local CQRS/event-sourcing, project-level deployment, a
Kafka-compatible event bus, and gRPC-capable command surfaces. It still lacks a
first-class way to author, validate, deploy, and smoke-test a cross-service
business process.

Existing docs describe cross-service sagas as "Zeebe territory". Later audit
notes moved the target to Operaton, but that decision is not yet captured as a
spec. The result is unclear guidance: agents know that choreography is
forbidden, but they do not know what artifact should describe the orchestrated
process, what deploy should provision, or how a demo proves the event/QSM path.

We need a bounded BPMN slice that proves:

- events emitted by rntme services reach the project event bus;
- a BPMN engine starts and drives a process from those events;
- service tasks call rntme command bindings through gRPC;
- command events update QSM projections;
- success and failure branches are observable through service read models.

## 2. Goals

Add **Provisioned BPMN / Operaton** support:

1. A project-level `workflows/` artifact for BPMN process definitions and their
   rntme-specific mapping contract.
2. A new `@rntme/workflows` package that owns parse, structural validation,
   cross-reference validation, branded `ValidatedWorkflows` types, and stable
   error codes.
3. Blueprint composition discovers and validates workflow artifacts against the
   project service list, PDM-derived event catalog, and project binding registry.
4. Deploy planning can include a provisioned Operaton runtime plus a separate
   BPMN worker workload.
5. Dokploy rendering can provision Redpanda, Operaton, and the BPMN worker for a
   preview deployment.
6. A new `order-fulfillment` demo proves both success and failure branches:
   `OrderPlaced -> ReserveStock -> ConfirmOrder | CancelOrder`.

## 3. Non-goals

- No service-local workflow engine inside `@rntme/runtime`.
- No side-effect projection consumer or reactive choreography path.
- No BPMN modeler UI.
- No XML semantic parser in v1. BPMN XML is deployed to Operaton, while
  `workflows.json` is the rntme validation contract.
- No BPMN extension-element authoring contract in v1.
- No human tasks, long-running user approvals, generic compensation handlers,
  cron scheduling, or timer workflow support in this slice.
- No production-grade Operaton storage design. The first target is preview
  deployment and demo validation.
- No support for raw network/proto targets in workflow artifacts.
- No replacement of Graph IR `call` nodes for short intra-request integration
  calls. BPMN is for cross-service async workflows.

## 4. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Feature name | Provisioned BPMN / Operaton |
| D2 | Workflow artifact placement | Project-level `workflows/` directory |
| D3 | Workflow validation owner | New `@rntme/workflows` package |
| D4 | rntme workflow contract | Strict JSON manifest next to BPMN XML |
| D5 | BPMN XML role | Deployable source for Operaton, not the rntme cross-ref source |
| D6 | Process trigger | Kafka message start from PDM-derived service events |
| D7 | Service task target | Project binding refs such as `orders.confirmOrder` |
| D8 | Allowed service task binding exposure | Action-exposed operations only |
| D9 | Network addresses in blueprint | Forbidden |
| D10 | Runtime boundary | `@rntme/runtime` remains service-local; no saga logic |
| D11 | Worker placement | Separate `bpmn-worker` workload in deploy plan |
| D12 | Demo | New `demo/order-fulfillment-blueprint/` |
| D13 | Demo services | `orders` and `inventory` |
| D14 | Demo branches | Stock available -> confirm order; insufficient stock -> cancel order |
| D15 | Event bus for demo | Provisioned Redpanda |
| D16 | Acceptance gate | Package tests plus deployed smoke for both branches |
| D17 | Old Zeebe language | Update misleading docs to name Operaton for current BPMN work |

## 5. Blueprint shape

Canonical demo shape:

```text
demo/order-fulfillment-blueprint/
  project.json
  pdm/
    pdm.json
    entities/
      Order.json
      InventoryItem.json
      StockReservation.json
  services/
    orders/
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
  workflows/
    workflows.json
    order-fulfillment.bpmn
```

`workflows/` is optional for projects generally. When present, the directory is
validated as one project-level artifact. It is not owned by a service because it
coordinates several service runtimes.

## 6. Workflow artifact package

Add `packages/artifacts/workflows/` as workspace package
`@rntme/workflows`.

### 6.1 Role

`@rntme/workflows` owns:

- Zod parsing of `workflows.json`;
- PDM-free structural rules;
- cross-reference rules against caller-provided project context;
- branded output types;
- error registry and result helpers;
- test fixtures for workflow artifact rules.

It must not import `@rntme/blueprint`, `@rntme/deploy-core`,
`@rntme/deploy-dokploy`, `@rntme/runtime`, or any app package.

The package may either depend on existing artifact packages for shared types or
accept plain context interfaces. The implementation should prefer a narrow
`WorkflowCrossRefContext` so blueprint remains the composition owner:

```ts
export type WorkflowCrossRefContext = {
  readonly services: readonly string[];
  readonly resolveEvent: (ref: WorkflowEventRef) => WorkflowEventResolution | null;
  readonly resolveBindingRef: (ref: string) => WorkflowBindingResolution | null;
};
```

### 6.2 Public API

```ts
parseWorkflowArtifact(raw: unknown): Result<WorkflowArtifact>
validateWorkflowStructural(artifact: WorkflowArtifact): Result<StructurallyValidWorkflows>
validateWorkflowCrossRef(
  artifact: StructurallyValidWorkflows,
  ctx: WorkflowCrossRefContext,
): Result<ValidatedWorkflows>
validateWorkflows(
  artifact: WorkflowArtifact,
  ctx: WorkflowCrossRefContext,
): Result<ValidatedWorkflows>
```

Re-export:

- `WorkflowArtifact`, `WorkflowDefinition`, `WorkflowMessageStart`,
  `WorkflowServiceTask`;
- `StructurallyValidWorkflows`, `ValidatedWorkflows`;
- `WorkflowError`, `WorkflowErrorCode`, `ERROR_CODES`;
- `ok`, `err`, `isOk`, `isErr`.

### 6.3 Error codes

Error codes use `WORKFLOWS_<LAYER>_<KIND>` and are append-only.

Initial codes:

- `WORKFLOWS_PARSE_SCHEMA_VIOLATION`
- `WORKFLOWS_STRUCT_DEFINITION_ID_DUPLICATE`
- `WORKFLOWS_STRUCT_BPMN_FILE_DUPLICATE`
- `WORKFLOWS_STRUCT_MESSAGE_START_ID_DUPLICATE`
- `WORKFLOWS_STRUCT_SERVICE_TASK_ID_DUPLICATE`
- `WORKFLOWS_STRUCT_UNKNOWN_DEFINITION`
- `WORKFLOWS_STRUCT_MAPPING_PATH_INVALID`
- `WORKFLOWS_XREF_EVENT_UNKNOWN_SERVICE`
- `WORKFLOWS_XREF_EVENT_UNKNOWN_AGGREGATE`
- `WORKFLOWS_XREF_EVENT_UNKNOWN_TYPE`
- `WORKFLOWS_XREF_BINDING_REF_UNKNOWN`
- `WORKFLOWS_XREF_BINDING_NOT_COMMAND`
- `WORKFLOWS_XREF_BINDING_SERVICE_MISMATCH`
- `WORKFLOWS_XREF_BPMN_FILE_MISSING`

`WORKFLOWS_XREF_BPMN_FILE_MISSING` may be emitted by blueprint integration if
the package itself stays filesystem-agnostic. If the package receives a
`fileExists` callback, the package can emit it directly.

## 7. Artifact shape

`workflows/workflows.json` v1:

```json
{
  "workflowVersion": 1,
  "definitions": [
    {
      "id": "orderFulfillment",
      "bpmnFile": "order-fulfillment.bpmn",
      "processId": "orderFulfillment"
    }
  ],
  "messageStarts": [
    {
      "id": "orderPlaced",
      "definition": "orderFulfillment",
      "messageName": "OrderPlaced",
      "event": {
        "service": "orders",
        "aggregateType": "Order",
        "eventType": "OrderPlaced"
      },
      "businessKey": "$event.data.orderId",
      "variables": {
        "orderId": "$event.data.orderId",
        "sku": "$event.data.sku",
        "quantity": "$event.data.quantity"
      }
    }
  ],
  "serviceTasks": [
    {
      "definition": "orderFulfillment",
      "taskId": "reserveStock",
      "bindingRef": "inventory.reserveStock",
      "input": {
        "orderId": "$process.orderId",
        "sku": "$process.sku",
        "quantity": "$process.quantity"
      },
      "resultVariable": "reservation"
    },
    {
      "definition": "orderFulfillment",
      "taskId": "confirmOrder",
      "bindingRef": "orders.confirmOrder",
      "input": {
        "orderId": "$process.orderId",
        "reservationId": "$process.reservation.reservationId"
      }
    },
    {
      "definition": "orderFulfillment",
      "taskId": "cancelOrder",
      "bindingRef": "orders.cancelOrder",
      "input": {
        "orderId": "$process.orderId",
        "reason": "$process.reservation.reason"
      }
    }
  ]
}
```

Rules:

- `workflowVersion` must be `1`.
- `definitions[].id` is unique.
- `definitions[].bpmnFile` is a relative path inside `workflows/`.
- `definitions[].processId` is the Operaton process id to start.
- `messageStarts[].definition` must reference a known definition.
- `messageStarts[].event` must resolve to a PDM-derived event owned by the
  named service.
- `messageStarts[].businessKey` and mapping expressions must use the v1 path
  grammar.
- `serviceTasks[].definition` must reference a known definition.
- `serviceTasks[].bindingRef` must resolve through the project binding
  registry and must target a command binding.
- `serviceTasks[].taskId` is the BPMN service task id the worker uses to match
  available work from Operaton.
- V1 does not parse BPMN XML to prove that `processId`, `messageName`, or
  `taskId` values exist inside the BPMN file. A mismatch is caught by worker
  integration tests or deployed smoke tests.

### 7.1 Mapping expression grammar

V1 supports only path expressions:

- `$event.<path>` for message-start input from the CloudEvents envelope and
  event payload.
- `$process.<path>` for process variables.
- string, number, boolean, and null literals.
- object and array containers composed from supported values.

No arbitrary JavaScript, SQL, function calls, template strings, or environment
lookups are allowed.

## 8. Blueprint integration

`@rntme/blueprint` adds workflow discovery:

- `discoverProjectWorkflows(dir)` finds optional `workflows/workflows.json` and
  BPMN files.
- `loadComposedBlueprint(dir)` validates workflows after PDM, services, graphs,
  and bindings are loaded.
- `ComposedProjectInput` exposes the validated workflow artifact for deploy.

Blueprint remains responsible for project-level context:

- service slugs;
- PDM-derived event catalog by `(service, aggregateType, eventType)`;
- project binding registry resolution for refs such as `orders.confirmOrder`;
- filesystem checks for BPMN files if `@rntme/workflows` stays path-only.

Blueprint should return a single `WORKFLOWS_INVALID`-style composed-project
error wrapper carrying the package error list, following the existing PDM/QSM
pattern.

## 9. Deploy-core plan model

`deploy-core` adds target-neutral workflow planning.

```ts
export type PlannedWorkflowEngine =
  | {
      readonly kind: 'none';
    }
  | {
      readonly kind: 'operaton';
      readonly mode: 'provisioned';
      readonly resourceName: string;
      readonly internalBaseUrl: string;
      readonly image: string;
    };

export type PlannedBpmnWorker = {
  readonly kind: 'bpmn-worker';
  readonly resourceName: string;
  readonly image: string;
  readonly workflowManifestPath: string;
  readonly bpmnFiles: readonly PlannedBpmnFile[];
  readonly subscriptions: readonly PlannedWorkflowSubscription[];
  readonly serviceTasks: readonly PlannedWorkflowServiceTask[];
};
```

`ProjectDeploymentPlan.infrastructure.workflowEngine` is `kind: "none"` when a
project has no workflows. For projects with `ValidatedWorkflows`, MVP planning
requires:

- `eventBus.kind === "kafka"` and `eventBus.mode === "provisioned"` for the
  demo path;
- provisioned Operaton enabled in deploy config or selected by workflow
  defaults;
- a BPMN worker image config or default image.

The planner derives:

- Operaton internal URL for the worker;
- event bus brokers/topic prefix for the worker;
- service task binding resolutions to target service gRPC endpoints;
- mounted workflow manifest and BPMN file paths.

Initial deploy-core error codes:

- `DEPLOY_PLAN_WORKFLOWS_REQUIRE_EVENT_BUS`
- `DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON`
- `DEPLOY_PLAN_WORKFLOWS_WORKER_IMAGE_MISSING`
- `DEPLOY_PLAN_WORKFLOWS_BINDING_GRPC_UNAVAILABLE`
- `DEPLOY_PLAN_WORKFLOWS_UNSUPPORTED_ENGINE`

## 10. Dokploy rendering

`deploy-dokploy` renders three resource classes when workflows are present:

1. Provisioned Redpanda compose resource, from the existing provisioned event
   bus design.
2. Operaton workflow-engine resource.
3. `bpmn-worker` application resource.

Apply order:

1. Infrastructure compose/resources: Redpanda, then Operaton.
2. Domain-service and integration-module applications.
3. BPMN worker application.
4. Edge gateway application.

The worker is applied after domain services because it needs their gRPC
endpoints to be resolvable. It may start before every service is healthy, but
it must retry transient connection failures.

Rendered worker env includes:

- `RNTME_EVENT_BUS_BROKERS`
- `RNTME_EVENT_BUS_PROTOCOL=plaintext` for provisioned Redpanda
- optional `RNTME_EVENT_BUS_TOPIC_PREFIX`
- `RNTME_OPERATON_BASE_URL`
- `RNTME_WORKFLOWS_MANIFEST_PATH`
- service endpoint env or mounted JSON generated from the plan

Rendered plans and apply results must not contain secret values. The first
preview design does not require secrets for Operaton or provisioned Redpanda.

The implementation plan must verify the exact Operaton image, API, and storage
mode before coding. The spec intentionally avoids pinning unverified API names.

## 11. BPMN worker contract

The BPMN worker is the only component that bridges:

```text
Kafka event -> Operaton process instance -> service task -> rntme gRPC command
```

Responsibilities:

- subscribe to planned Kafka topics;
- filter events by `(service, aggregateType, eventType)`;
- start an Operaton process instance using `processId`, `messageName`, and
  mapped variables;
- poll or receive executable service tasks from Operaton using the selected
  Operaton adapter API;
- match task ids to `workflows.json#serviceTasks`;
- map process variables to command input;
- call the target command binding over the service gRPC surface;
- write command results back to process variables when `resultVariable` is set;
- mark the task complete or failed in Operaton;
- expose `/health` and structured logs.

The worker must generate deterministic command metadata for retries:

```text
commandId = bpmn:<processInstanceId>:<taskId>:<activityInstanceId>
correlationId = <message event correlation id or processInstanceId>
causationId = <source event id or previous command id>
```

If the current gRPC command surface cannot accept this metadata, the
implementation plan must add that capability before enabling worker retries
greater than one. Until then, demo commands must be written so duplicate task
execution is caught by state-machine guards and surfaced as a safe terminal
condition in tests.

## 12. Demo design

New demo: `demo/order-fulfillment-blueprint/`.

### 12.1 Services

`orders` owns `Order`.

Commands:

- `placeOrder` emits `OrderPlaced`.
- `confirmOrder` emits `OrderConfirmed`.
- `cancelOrder` emits `OrderCancelled`.

QSM:

- `OrderView` mirrors `Order`.
- Reads expose order status and cancellation reason.

`inventory` owns `InventoryItem` and `StockReservation`.

Commands:

- `reserveStock` emits `StockReserved` when stock is available.
- `reserveStock` emits `StockReservationRejected` when stock is insufficient.
- `reserveStock` returns a successful typed result in both business branches:
  `{ reserved: true, reservationId }` or `{ reserved: false, reason }`.
  Transport, validation, and system failures remain command failures.

QSM:

- `InventoryItemView` mirrors stock state.
- `StockReservationView` mirrors reservations/rejections.

### 12.2 BPMN flow

Process: `orderFulfillment`.

Start:

- message start on `orders.Order.OrderPlaced`.

Tasks:

1. `reserveStock` -> `inventory.reserveStock`.
2. Exclusive branch on reservation result.
3. `confirmOrder` -> `orders.confirmOrder` on success.
4. `cancelOrder` -> `orders.cancelOrder` on insufficient stock.

The BPMN file should be small and committed as source. The JSON manifest is the
contract tests assert against.

### 12.3 Smoke scenarios

Success:

1. `POST /api/orders` with SKU that has stock.
2. Wait for workflow completion.
3. `GET /api/orders/{id}` returns `status: "confirmed"`.
4. `GET /api/inventory/reservations/{orderId}` returns reserved stock.

Failure:

1. `POST /api/orders` with SKU that lacks stock.
2. Wait for workflow completion.
3. `GET /api/orders/{id}` returns `status: "cancelled"`.
4. `GET /api/inventory/reservations/{orderId}` shows a rejected reservation
   with the same reason used by `orders.cancelOrder`.

## 13. Testing

`@rntme/workflows`:

- parse rejects unknown fields and invalid enum/version values;
- structural validation catches duplicate ids and unknown definition refs;
- cross-ref validation catches unknown service/event/binding refs;
- non-command binding refs are rejected;
- mapping path grammar is covered.

`@rntme/blueprint`:

- composed project loads workflows;
- missing BPMN file fails;
- valid order-fulfillment blueprint returns `ValidatedWorkflows`;
- workflow errors are surfaced through blueprint result wrapping.

`deploy-core`:

- project without workflows plans no workflow engine;
- project with workflows plans provisioned Operaton and BPMN worker;
- missing event bus or unsupported engine returns stable errors;
- service task binding refs resolve to service gRPC endpoints.

`deploy-dokploy`:

- renders Operaton resource and BPMN worker resource;
- mounts `workflows.json` and `.bpmn` files into the worker or engine as
  planned;
- applies resources in dependency order;
- partial failure reporting includes workflow resources;
- rendered artifacts contain no secrets.

`bpmn-worker`:

- fake Kafka + fake Operaton + fake gRPC success path;
- fake insufficient-stock branch;
- retries use deterministic command metadata;
- health endpoint and structured logs are covered.

Demo smoke:

- deploy order-fulfillment preview with provisioned Redpanda and Operaton;
- run success branch;
- run failure branch;
- verify QSM reads for orders and inventory.

## 14. Documentation touch

The implementation plan must include documentation updates for:

- new `packages/artifacts/workflows/README.md`;
- `packages/artifacts/blueprint/README.md`;
- `packages/deploy/deploy-core/README.md`;
- `packages/deploy/deploy-dokploy/README.md`;
- `apps/platform-http/README.md`;
- `demo/order-fulfillment-blueprint/README.md`;
- root `README.md` package table, dependency graph, and glossary if the new
  package changes them;
- `AGENTS.md` repository map, package layering, common tasks, decisions map,
  and glossary;
- stale Zeebe references in docs where they describe the current BPMN target
  rather than historical context.

Historical ADR/spec text may keep Zeebe if it is explicitly historical. New
navigation docs should say Operaton for current BPMN work.

## 15. Risks

**Operaton API/image drift.** The implementation plan must verify the official
image, deployment API, task API, and storage defaults before coding the adapter.

**Retry duplication.** BPMN engines retry work by design. The worker must pass
deterministic command metadata, and target commands must remain safe under
duplicate delivery.

**Branch modeling discipline.** The demo treats insufficient stock as a
successful business result, not a command failure. Command failures represent
transport, validation, or system failure. This keeps the BPMN exclusive branch
deterministic and avoids teaching agents to encode business alternatives as
runtime errors.

**Startup ordering.** The worker may start before Operaton, Redpanda, or domain
services are ready. It must retry dependencies and expose health that reflects
readiness honestly.

**Scope creep into workflow runtime.** Timers, compensation, human tasks, and
process migration are tempting follow-ups. They stay out until the basic event
to QSM proof is green.

**Layering.** `@rntme/workflows` must stay an artifact package. It should not
learn Dokploy, Operaton HTTP details, or runtime boot behavior.

## 16. Future follow-ups

- BPMN extension elements as an optional authoring source for refs.
- Timer start/events after the command metadata and worker retry story is
  proven.
- Production Operaton persistence and backup/restore.
- Workflow deployment history and process-instance observability in
  `platform-http`.
- Worker conformance tests against a real Operaton container.
- BPMN visualization in the platform UI.

## 17. Live Dokploy Acceptance

The BPMN/Operaton slice is not accepted by mock Dokploy tests alone. The
acceptance gate includes a gated live e2e test, skipped unless
`RNTME_DOKPLOY_E2E=1`, that deploys `demo/order-fulfillment-blueprint/` to a
real Dokploy target with provisioned Redpanda, provisioned Operaton, a
deployable BPMN worker image, the demo domain services, and the edge gateway.

The test must prove:

- deployment resources include event bus, workflow engine, BPMN worker,
  orders, inventory, and edge;
- a normal order reaches `confirmed` through `reserveStock -> confirmOrder`;
- a `missing-stock` order reaches `cancelled` through
  `reserveStock -> cancelOrder`;
- resources created by the test are deleted from Dokploy in `finally`.
