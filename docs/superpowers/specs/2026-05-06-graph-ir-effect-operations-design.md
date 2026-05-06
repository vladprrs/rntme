# Graph IR Effect Operations Design

Date: 2026-05-06

Status: Draft for review

Supersedes the command/query role split from:

- `docs/superpowers/specs/done/2026-04-14-mutations-design.md`
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md`
- `docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md`

Related implementation artifact that motivated this spec:

- `demo/order-fulfillment-blueprint/services/inventory/commands/handlers.mjs`

## 1. Problem

The current Graph IR model separates graphs into read-oriented queries and
emit-oriented commands. That split was useful for the MVP, but it is now
creating the wrong architectural pressure.

The `order-fulfillment` BPMN demo exposed the problem. The `inventory`
service needs `reserveStock` to read current stock, branch on availability,
emit either `StockReserved` or `StockReservationRejected`, and return a typed
business result:

- `{ reserved: true, reservationId }`
- `{ reserved: false, reason }`

Current Graph IR cannot express that operation. Its command path compiles a
static emit plan, `emit.transition` is a compile-time literal, read prelude
can only reject the command as `COMMAND_GUARD_REJECTED`, and Graph IR command
output is still centered on `CommandResult` metadata instead of an explicit
business result. To close the demo branch, the project introduced a
service-local executable handler module:

```text
services/inventory/commands/handlers.mjs
```

That file solves the demo mechanically but violates the platform direction.
Domain blueprints should be declarative, validated artifacts. Business logic
inside executable service-local files bypasses Graph IR validation, PDM
state-machine checks, error-code discipline, artifact portability, and review
visibility.

The root issue is not only missing conditional emit support. The deeper issue
is that operation semantics are split across three places:

- Graph IR for local reads and emits.
- `bindings.pre[]` for module/service calls before graph execution.
- BPMN for durable cross-service orchestration.

`pre[]` is especially problematic because it is a graph-adjacent mini-language.
It performs typed calls, then feeds results back into Graph IR through `$pre`.
Those calls are part of the operation and should be represented in the graph
itself.

## 2. Goals

1. Make Graph IR a unified effect-based operation language.
2. Allow one bounded operation to combine local QSM reads, typed synchronous
   calls, branching, local emits, and explicit result shaping.
3. Remove graph-level `query` / `command` roles from the target model.
4. Replace binding-level `kind: "query" | "command"` with surface exposure
   policy.
5. Move `pre[]` semantics into Graph IR `call` nodes.
6. Remove `row<CommandResult>` as the required business output for action
   operations.
7. Forbid executable service-local command handlers inside domain blueprints.
8. Preserve BPMN as the durable cross-service saga/orchestration model.
9. Keep the local event-store ownership boundary strict: Graph IR may emit
   only to the current service-local event store.

## 3. Non-goals

- No distributed transaction support.
- No hidden saga runtime inside Graph IR.
- No waits for future events inside Graph IR.
- No compensation model inside Graph IR.
- No human-task or timer semantics inside Graph IR.
- No arbitrary code nodes in domain blueprints.
- No remote event-store append primitive.
- No backward-compatible artifact shape requirement. The project is still
  pre-stable; the migration is a clean break.

## 4. Decisions

| ID | Decision |
| --- | --- |
| D1 | Graph IR vNext is effect-based. It does not declare graph roles as `query` or `command`. |
| D2 | The compiler infers an `EffectSummary` from graph nodes. |
| D3 | Bindings expose operations with `exposure: "read" | "action"`. Exposure is a surface policy over inferred effects. |
| D4 | `call` nodes are first-class Graph IR nodes and may target modules or domain service operations. |
| D5 | `call` nodes do not carry `kind: "query"`. The target operation registry supplies effect metadata. |
| D6 | Graph IR may emit only to aggregates owned by the current service. |
| D7 | QSM reads are local cached read-model reads. Synchronous calls are authoritative owner answers. |
| D8 | BPMN remains the model for durable cross-service sagas, compensation, waits, and process state. |
| D9 | Binding-level `pre[]` is removed from the target authoring model. |
| D10 | `row<CommandResult>` is removed as the required business output. Graphs return explicit `result` node output. |
| D11 | Domain blueprint `services/*/commands/handlers.mjs` files are forbidden. |
| D12 | `branch` selects exactly one reachable path in this design. Multi-output fan-out is not part of this spec. |
| D13 | Remote operations are authored as `{ module, operation }` or `{ service, operation }` targets and resolved to fully-qualified operation ids by the project operation registry. |
| D14 | Action-like calls after a local emit are rejected in this design. They require BPMN or a later explicit post-commit effect model. |
| D15 | Multiple local emits are allowed when all target aggregates are owned by the current service. |

## 5. Architecture Boundary

Graph IR vNext describes one bounded operation.

An operation may include:

- local QSM reads;
- typed synchronous calls to modules or service operations;
- branch decisions;
- one or more local emits;
- explicit result shaping.

Graph IR may call other modules or services, but it may emit only to the
current service-local event store. A remote service write can happen only by
calling a typed operation exposed by that remote service. The remote service
owns its own invariants and events.

BPMN remains the boundary for durable orchestration. Use BPMN when a workflow:

- coordinates writes across multiple domain services;
- waits for future events;
- needs compensation;
- needs durable retry state over time;
- has timers, human tasks, or external task lifecycle;
- must expose process state as a first-class business object.

Graph IR is not a saga engine. It is the language for one synchronous bounded
operation.

## 6. QSM vs Call Boundary

Graph IR supports both local QSM reads and synchronous `call` nodes. They are
not interchangeable.

QSM is the current service's cached local read model. Use QSM when:

- the service needs queryable local state;
- eventual consistency is acceptable;
- the operation is list/search/filter/sort/join oriented;
- the value is used for UX, dashboards, or local denormalized views;
- the value is used for a soft guard where stale data cannot create a false
  business fact;
- the data shape is stable as a local read contract.

`call` is an authoritative synchronous dependency. Use `call` when:

- the current operation needs the owner to answer now;
- the data is volatile or high-risk;
- the owner must apply private policy or authorization rules;
- a stale projection could create a wrong local event;
- the answer is computed from private state or an external API;
- the query is rare or point-like and does not justify a local projection.

For action operations, the rule is stricter:

- If stale data is safe, read local QSM.
- If stale data can create a false business fact, call the owner.
- If the operation needs writes in multiple domain services, use BPMN.

Summary:

```text
QSM  = local cached read model for this service.
call = authoritative synchronous answer from the owner.
BPMN = durable cross-service process.
```

The `reserveStock` operation is owned by `inventory`, so it should read local
inventory state and branch in Graph IR. It should not use a service-local code
handler. BPMN should only orchestrate `orders` and `inventory` after
`inventory.reserveStock` returns a typed result.

## 7. Effect Summary

The compiler infers effects from nodes.

```ts
export type EffectSummary = Readonly<{
  localReads: boolean;
  localEmits: readonly LocalEmitEffect[];
  calls: readonly CallEffect[];
  waits: false;
}>;

export type LocalEmitEffect = Readonly<{
  aggregate: string;
  transition: string;
  eventType: string;
}>;

export type CallEffect = Readonly<{
  target: 'module' | 'service';
  operation: string;
  effect: 'read' | 'action';
  idempotency: 'none' | 'optional' | 'required';
}>;
```

`effect: "read" | "action"` comes from the target operation registry, not from
the `call` node itself. The local graph references a typed target; the target
declares whether it is read-like or action-like.

## 8. Binding Exposure

Bindings expose graph operations with surface intent:

```json
{
  "exposure": "read",
  "graph": "listOrders"
}
```

```json
{
  "exposure": "action",
  "graph": "reserveStock"
}
```

Validation rules:

- `exposure: "read"` allows local QSM reads and read-like calls.
- `exposure: "read"` rejects local emits.
- `exposure: "read"` rejects action-like calls.
- `exposure: "action"` allows local reads, read/action calls, branches, local
  emits, and typed result shaping.
- `emit` is always local-only.
- `call.target` must resolve through the project/module operation registry.
- `call.input` must match the target input shape.
- action-like calls require explicit timeout, retry, idempotency, and error
  mapping policy.
- projection/derived-QSM contexts remain stricter: no calls, no emits,
  deterministic local computation only.

This replaces `kind: "query" | "command"` as the semantic boundary. Read/action
is a surface policy over inferred effects, not a separate graph language.

## 9. Graph Model

Graph IR vNext keeps existing read and emit concepts but adds first-class
operation-flow nodes.

Core node families:

| Node | Purpose |
| --- | --- |
| `findMany` / `findOne` | Local QSM read. |
| `call` | Typed synchronous call to a module or service operation. |
| `branch` | Choose one reachable path from typed expressions. |
| `emit` | Append a local event-store event. |
| `result` | Build the explicit operation output. |

### 9.1 `call`

```json
{
  "id": "credit",
  "type": "call",
  "target": {
    "service": "customers",
    "operation": "getCreditStatus"
  },
  "input": {
    "customerId": { "$param": "customerId" }
  },
  "policy": {
    "timeoutMs": 500,
    "retry": { "attempts": 2, "retryOn": "transient" },
    "idempotency": { "mode": "inherit" },
    "onError": "fail"
  }
}
```

`call.target` may reference a module operation or a domain service operation.
The operation registry supplies:

- input shape;
- output shape;
- effect metadata (`read` or `action`);
- idempotency requirements;
- transport details.

### 9.2 `branch`

```json
{
  "id": "stockDecision",
  "type": "branch",
  "cases": [
    {
      "when": {
        "gte": [
          { "$ref": "item.available" },
          { "$param": "quantity" }
        ]
      },
      "then": "emitReserved"
    },
    {
      "default": true,
      "then": "emitRejected"
    }
  ]
}
```

The first matching case is selected. A branch must have exactly one default
case unless the compiler can prove all cases are exhaustive for the expression
domain.

### 9.3 `emit`

`emit` remains the only local write primitive. It appends events for aggregates
owned by the current service.

`emit.payload` may reference prior node outputs, not only params and pre-step
results. This is required for operations such as "read current value and emit an
updated fact".

### 9.4 `result`

```json
{
  "id": "out",
  "type": "result",
  "value": {
    "reserved": { "$literal": true },
    "reservationId": { "$ref": "emitReserved.aggregateId" }
  }
}
```

The graph signature references a `result` node for operation output. Business
output is graph-defined. Runtime metadata such as `eventIds`, `commandId`, and
`correlationId` can still exist as envelope/debug metadata, but it is no longer
the required business shape.

### 9.5 References

Supported reference forms:

- `$param.foo` - graph input.
- `$ref: "node.field"` - prior node output.
- `$ref: "callNode.result.field"` - call output.
- `$ref: "emitNode.aggregateId"` - local emit metadata.
- `$ref: "emitNode.version"` - local emit metadata.
- `$ref: "emitNode.eventIds"` - local emit metadata.

Local aliases from QSM reads remain scoped and validated.

## 10. Runtime Semantics

Graph execution is deterministic within explicit effect boundaries.

Execution order:

1. Validate and bind graph inputs.
2. Execute local QSM reads when reached.
3. Execute synchronous `call` nodes when reached.
4. Evaluate branches.
5. Replay local aggregate streams needed by reached `emit` nodes.
6. Validate local state-machine transitions.
7. Append local events.
8. Build explicit `result`.

Transaction boundaries:

- Local event append is transactional within the current service event store.
- QSM reads are not part of the event-store transaction.
- Remote calls are not part of the local transaction.
- Graph IR does not provide distributed transactions.

Effect ordering rules:

- read-like calls may happen before local emits.
- action-like calls before local emits require idempotency policy.
- action-like calls after local emits require explicit error handling.
- multiple action-like calls are allowed only when they are still one bounded
  synchronous operation; if they imply compensation or durable coordination,
  use BPMN.

Error semantics:

- compile-time type/reference/effect errors fail validation.
- local transition errors are structured local operation errors.
- call transport errors follow retry policy and then map through `policy.onError`.
- business denial should be modeled as a successful typed result, not a
  transport error.
- branch decisions should use typed result fields, not error codes.

Idempotency:

- `exposure: "action"` receives an operation idempotency key from the binding or
  runtime context.
- action-like calls can inherit or derive child idempotency keys.
- local emits use deterministic command metadata/correlation.
- repeated execution should either return the same result or fail with a stable
  conflict; it must not append duplicate business facts.

## 11. Clean-break Migration

The project is pre-stable, so the target model does not need to preserve old
artifact forms.

1. Replace graph role model.
   - Remove `query | command` as graph roles.
   - Infer `EffectSummary` from nodes.
   - Stop using `inferRole()` for operation semantics.

2. Replace binding `kind`.
   - Remove `kind: "query" | "command"` from the target binding artifact.
   - Add `exposure: "read" | "action"`.

3. Remove binding-level `pre[]`.
   - All synchronous module/service calls move into Graph IR `call` nodes.

4. Remove `row<CommandResult>` requirement.
   - Graphs return explicit `result` node output.
   - Runtime metadata remains internal/envelope metadata.

5. Remove service-local domain handlers.
   - Domain blueprints must not include `services/*/commands/handlers.mjs`.
   - Deploy/publish must not copy those files as runtime artifacts.

6. Refactor runtime around one operation executor.
   - Replace separate query/command execution paths with one
     `GraphOperationExecutor`.
   - The executor receives compiled graph effects plus dependencies:
     `qsmDb`, `eventStore`, call client, correlation, and idempotency context.

7. Keep BPMN conceptually unchanged.
   - BPMN invokes exposed typed operations and receives typed results.
   - BPMN owns durable saga behavior, not Graph IR.

8. Update demos, tests, and docs in the same change series.
   - `order-fulfillment` rewrites `reserveStock` as Graph IR
     `read + branch + emit + result`.

## 12. Testing And Enforcement

Compiler tests:

- infer `EffectSummary` for read-only, call-only, local-emit, call+emit, and
  branch+emit graphs;
- reject any `emit` targeting an aggregate not owned by the current service;
- validate `call.target` against the operation registry;
- validate `call.input` against target input shape;
- validate `$ref` paths from read/call/emit/result nodes;
- reject waits, subscriptions, compensation, and durable process-state nodes;
- verify `branch` produces exactly one reachable path;
- verify `result` output shape matches the graph signature.

Runtime tests:

- execute `reserveStock` fully in Graph IR:
  - available branch emits `StockReserved`;
  - missing branch emits `StockReservationRejected`;
  - both branches return typed results;
- execute a graph with a module call and use the call output in `emit.payload`;
- execute a graph with a domain service call and use the result in a branch;
- verify action call idempotency key derivation;
- verify local transition failure is not reported as remote call failure;
- verify remote business-denial result is branchable data.

Binding tests:

- `exposure: "read"` accepts read-only graphs and read-like calls;
- `exposure: "read"` rejects local emits and action-like calls;
- `exposure: "action"` accepts local emits and action-like calls;
- OpenAPI/gRPC output schemas come from `result` node output;
- old `kind` and `pre[]` fixtures are removed.

Blueprint/deploy tests:

- publishing/deploying a domain blueprint with
  `services/*/commands/handlers.mjs` fails;
- deploy no longer copies service-local command handler artifacts from domain
  blueprints;
- `order-fulfillment` composes and deploys without executable service-local
  handler files;
- BPMN worker receives typed operation results and branches on them.

Docs/tests cleanup:

- update Graph IR README;
- update bindings README;
- update runtime README;
- update platform-http deploy docs;
- update AGENTS common-task guidance;
- rewrite "Call a module via pre-fetch" as "Call a module from Graph IR";
- mark older `CommandResult` / `kind` / `pre[]` semantics as superseded.

## 13. Implementation Defaults

These defaults remove ambiguity for the first implementation plan.

### 13.1 `findOne`

`findOne` is a local QSM read node that returns either one row or `null`.

```json
{
  "id": "item",
  "type": "findOne",
  "config": {
    "source": { "projection": "InventoryItemView" },
    "where": {
      "eq": [
        "inventoryItemView.sku",
        { "$param": "sku" }
      ]
    }
  }
}
```

If more than one row matches, runtime fails with a structured graph execution
error. Authors who expect several rows must use `findMany`.

### 13.2 Branch selection

`branch` selects exactly one path. The first matching `case.when` wins. If no
case matches and no default exists, runtime fails with a structured graph
execution error. Multi-output fan-out is out of scope for this spec.

### 13.3 Operation registry ids

Authoring uses explicit target objects:

```json
{ "module": "identity-auth0", "operation": "IntrospectSession" }
```

```json
{ "service": "customers", "operation": "getCreditStatus" }
```

The project operation registry resolves those into fully-qualified operation ids
internally:

```text
module:identity-auth0.IntrospectSession
service:customers.getCreditStatus
```

Bindings, module manifests, and generated contracts may all contribute registry
entries, but Graph IR authors do not write transport addresses or proto paths in
the graph.

### 13.4 Action-call ordering

Action-like calls before local emits are allowed only with explicit idempotency
policy. Action-like calls after local emits are rejected in this design because
Graph IR has no post-commit effect queue or compensation model. Use BPMN when a
flow needs "local write, then remote action" with durable recovery.

Read-like calls may occur before local emits. Read-like calls after local emits
are rejected for the same reason as action-like calls: Graph IR vNext executes
one synchronous operation and does not model post-commit side effects.

### 13.5 Multiple local emits

Multiple local emits are allowed when every emitted aggregate belongs to the
current service. The executor groups/replays/appends by local aggregate stream
and returns graph-defined business output from the `result` node. Cross-service
emits remain forbidden.
