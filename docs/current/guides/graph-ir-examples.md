# Graph IR Examples

Use these as compact patterns, then copy from the current demo files named in
each section.

## Read List With Filter, Sort, Limit, And Result

Source example:
`demo/notes-blueprint/services/app/graphs/listNotes.json`.

```json
{
  "id": "listNotes",
  "signature": {
    "inputs": {
      "limit": { "type": "integer", "mode": "defaulted", "default": 100 }
    },
    "output": { "type": "rowset<NoteView>", "from": "out" }
  },
  "nodes": [
    {
      "id": "items",
      "type": "findMany",
      "config": { "source": { "projection": "NoteView" } }
    },
    {
      "id": "filtered",
      "type": "filter",
      "config": {
        "input": "items",
        "expr": {
          "eq": ["noteView.status", { "$literal": "active" }]
        }
      }
    },
    {
      "id": "sorted",
      "type": "sort",
      "config": {
        "input": "filtered",
        "by": [{ "field": "noteView.createdAt", "dir": "desc", "nulls": "last" }]
      }
    },
    {
      "id": "paged",
      "type": "limit",
      "config": { "input": "sorted", "count": { "$param": "limit" } }
    },
    {
      "id": "out",
      "type": "result",
      "value": { "$ref": "paged" }
    }
  ]
}
```

## Single-Row Lookup Shape

Source example:
`demo/order-fulfillment-blueprint/services/orders/graphs/getOrder.json`.

```json
{
  "id": "getOrder",
  "signature": {
    "inputs": {
      "id": { "type": "string", "mode": "required" }
    },
    "output": { "type": "rowset<OrderView>", "from": "out" }
  },
  "nodes": [
    {
      "id": "orders",
      "type": "findMany",
      "config": { "source": { "projection": "OrderView" } }
    },
    {
      "id": "filtered",
      "type": "filter",
      "config": {
        "input": "orders",
        "expr": { "eq": ["orderView.id", { "$param": "id" }] }
      }
    },
    {
      "id": "one",
      "type": "limit",
      "config": { "input": "filtered", "count": 1 }
    },
    {
      "id": "out",
      "type": "result",
      "value": { "$ref": "one" }
    }
  ]
}
```

## Emit Action

Source example:
`demo/order-fulfillment-blueprint/services/orders/graphs/placeOrder.json`.

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

## Branching Action

Source example:
`demo/order-fulfillment-blueprint/services/inventory/graphs/reserveStock.json`.

```json
{
  "id": "reserveStock",
  "signature": {
    "inputs": {
      "orderId": { "type": "string", "mode": "required" },
      "sku": { "type": "string", "mode": "required" },
      "quantity": { "type": "integer", "mode": "required" }
    },
    "output": { "type": "row<ReservationResult>", "from": "out" }
  },
  "nodes": [
    {
      "id": "item",
      "type": "findOne",
      "config": {
        "source": { "projection": "InventoryItemView" },
        "where": { "eq": ["inventoryItemView.sku", { "$param": "sku" }] }
      }
    },
    { "id": "newId", "type": "uuid", "config": {} },
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
    },
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
    },
    {
      "id": "emitRejected",
      "type": "emit",
      "config": {
        "aggregate": "StockReservation",
        "aggregateId": { "$node": "newId" },
        "transition": "rejected",
        "payload": {
          "orderId": { "$param": "orderId" },
          "sku": { "$param": "sku" },
          "quantity": { "$param": "quantity" },
          "reason": { "$literal": "insufficient stock" }
        }
      }
    },
    {
      "id": "out",
      "type": "result",
      "value": {
        "reserved": { "$ref": "emitReserved.didRun" },
        "reservationId": { "$ref": "emitReserved.aggregateId" },
        "reason": { "$ref": "emitRejected.payload.after.reason" }
      }
    }
  ]
}
```

## Module Call Action

Source examples:

- `demo/cv-extract-blueprint/services/app/graphs/prepareResumeFileUpload.json`
- `demo/cv-extract-blueprint/services/app/graphs/extractResume.json`

Use `call` when an existing module or service operation provides a capability.
The graph remains the product behavior owner; module implementation is not part
of blueprint authoring.
