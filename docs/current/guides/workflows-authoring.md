# Workflows Authoring

Project workflows map BPMN process definitions to PDM event starts and
project-routed action bindings. Use workflows for cross-service asynchronous
processes after the participating action bindings exist.

Package internals live in
[`../owners/packages/artifacts/workflows.md`](../owners/packages/artifacts/workflows.md).

## Files

```text
workflows/
  workflows.json
  order-fulfillment.bpmn
```

`project.json` may rely on `workflows/workflows.json` by convention or set
`workflows.manifest` to a relative manifest path.

## Manifest Shape

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
  "messageStarts": [],
  "serviceTasks": []
}
```

Rules:

- `bpmnFile` is a relative `.bpmn` path under the workflow manifest directory.
- `definitions[].id` is the local id used by message starts and service tasks.
- `processId` must match the BPMN process id.
- Keep BPMN XML in `.bpmn` files; keep rntme mappings in `workflows.json`.

## Message Starts

Message starts subscribe to PDM event types:

```json
{
  "id": "orderPlaced",
  "definition": "orderFulfillment",
  "messageName": "OrderPlaced",
  "event": {
    "service": "orders",
    "aggregateType": "Order",
    "eventType": "OrderPlaced"
  },
  "businessKey": "$event.rntAggregateId",
  "variables": {
    "orderId": "$event.rntAggregateId",
    "sku": "$event.data.after.sku",
    "quantity": "$event.data.after.quantity"
  }
}
```

Rules:

- `event.service` must be a project service.
- `aggregateType` and `eventType` must resolve from the PDM event types scoped
  to that service.
- Mapping expressions start with `$event` or `$process` and use dot paths.
- `businessKey` should identify the process instance, usually the aggregate id.

## Service Tasks

Service tasks call project-routed action bindings:

```json
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
}
```

Rules:

- `bindingRef` is `<service>.<bindingId>`.
- The binding must resolve to an action binding.
- The service prefix in `bindingRef` must match the resolved service.
- `taskId` must match the BPMN service task id.
- `resultVariable` stores the action result for later `$process.<name>` input.

Do not use workflow `nativeTasks` for third-party blueprint authoring. External
workflows should call action bindings through `serviceTasks`.

## Example To Copy

- `demo/order-fulfillment-blueprint/workflows/workflows.json`
- `demo/order-fulfillment-blueprint/workflows/order-fulfillment.bpmn`
