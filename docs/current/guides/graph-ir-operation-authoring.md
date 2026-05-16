# Graph IR Operation Authoring

Use operation graphs for behavior: creating state, changing state, calling
existing module or service operations, branching decisions, and returning typed
action results.

Package internals live in
[`../owners/packages/artifacts/graph-ir-compiler.md`](../owners/packages/artifacts/graph-ir-compiler.md).

## Operation Rules

- Every operation graph must contain a `result` node.
- `branch` nodes must have exactly one default case.
- `emit` nodes may target only aggregates owned by the current service.
- `emit` transitions must exist in the PDM state machine.
- `emit` payloads must match the PDM event fields for the transition.
- `exposure: "read"` forbids local emits and action-effect calls.
- Use Graph IR for third-party blueprint behavior. Service-local native handlers
  are platform internals, not an external authoring path.

## Action Skeleton

```json
{
  "id": "placeOrder",
  "signature": {
    "inputs": {
      "sku": { "type": "string", "mode": "required" },
      "quantity": { "type": "integer", "mode": "required" }
    },
    "output": { "type": "row<OrderActionResult>", "from": "out" }
  },
  "nodes": [
    { "id": "newId", "type": "uuid", "config": {} },
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Order",
        "aggregateId": { "$node": "newId" },
        "transition": "placed",
        "payload": {
          "sku": { "$param": "sku" },
          "quantity": { "$param": "quantity" }
        }
      }
    },
    {
      "id": "out",
      "type": "result",
      "value": {
        "orderId": { "$ref": "emit.aggregateId" },
        "version": { "$ref": "emit.version" }
      }
    }
  ]
}
```

This pattern is in
`demo/order-fulfillment-blueprint/services/orders/graphs/placeOrder.json`.

## Operation Nodes

Use these nodes in action graphs:

- `uuid`: create an id for a new aggregate or related value.
- `findMany` / `findOne`: read local QSM state before deciding.
- `call`: invoke an existing module or service operation.
- `branch`: choose which downstream node runs.
- `emit`: append a PDM state-machine event.
- `result`: shape the response returned to the binding.

Read nodes in operation graphs read from QSM tables. Event writes still go
through `emit`.

## Calls

Use `call` to consume an existing module or service capability:

```json
{
  "id": "prepared",
  "type": "call",
  "target": { "module": "storage", "operation": "PrepareUpload" },
  "input": {
    "route_id": { "$literal": "resume-file" },
    "filename": { "$param": "filename" }
  },
  "policy": {
    "timeoutMs": 5000,
    "retry": { "attempts": 1, "retryOn": "transient" },
    "idempotency": { "mode": "derive" },
    "onError": "fail"
  }
}
```

Targets are resolved by the runtime registry. The guide teaches how to consume
an existing target, not how to implement the target.

## Branches

Branches choose node ids:

```json
{
  "id": "decision",
  "type": "branch",
  "cases": [
    {
      "when": { "gte": [{ "$ref": "item.available" }, { "$param": "quantity" }] },
      "then": "emitReserved"
    },
    { "default": true, "then": "emitRejected" }
  ]
}
```

Exactly one case must be `{ "default": true, "then": "..." }`.

## Emits

`emit` connects Graph IR behavior to PDM state machines:

```json
{
  "id": "emitReserved",
  "type": "emit",
  "config": {
    "aggregate": "StockReservation",
    "aggregateId": { "$node": "newId" },
    "transition": "reserve",
    "payload": {
      "orderId": { "$param": "orderId" },
      "sku": { "$param": "sku" },
      "quantity": { "$param": "quantity" }
    }
  }
}
```

The compiler checks that:

- `aggregate` exists in PDM.
- The current service owns the aggregate.
- `transition` exists on the aggregate state machine.
- `payload` has required fields, no extra fields, and matching scalar types.

Creation transitions use an empty stream and append the first version. Update
transitions replay current aggregate state and enforce optimistic concurrency.

## Expression References

Use these reference forms deliberately:

| Form | Meaning |
| --- | --- |
| `{ "$param": "name" }` | Graph input. |
| `{ "$literal": "text" }` | Literal value; use for string constants. |
| `{ "$node": "newId" }` | Whole output of a node such as `uuid`. |
| `{ "$ref": "emit.aggregateId" }` | Field path into a prior node result. |

`$ref` paths can traverse nested call results and arrays, such as
`completion.result.content[0].text.text`.

## Binding Expectations

Action bindings normally use `POST` and `exposure: "action"`. A graph with local
emits or action-effect calls must not be exposed as `read`.

Examples:

- `demo/order-fulfillment-blueprint/services/orders/graphs/placeOrder.json`
- `demo/order-fulfillment-blueprint/services/inventory/graphs/reserveStock.json`
- `demo/cv-extract-blueprint/services/app/graphs/prepareResumeFileUpload.json`
- `demo/cv-extract-blueprint/services/app/graphs/extractResume.json`
