# Order Fulfillment Blueprint

This demo composes a small order-fulfillment project with two domain services
and a project-level BPMN workflow artifact.

## Services And Entities

- `orders` owns `Order` and exposes `placeOrder`, `confirmOrder`,
  `cancelOrder`, and `getOrder`.
- `inventory` owns `InventoryItem` and `StockReservation`, and exposes
  `reserveStock` and `getReservation`.
- Project HTTP routes mount the services at `/api/orders` and
  `/api/inventory`, with request-context middleware on both routes.

Each service keeps read models as QSM entity mirrors. `OrderView` mirrors
`Order`; `InventoryItemView` and `StockReservationView` mirror the inventory
entities.

## BPMN Flow

`workflows/workflows.json` defines `orderFulfillment` and maps the
`orders.OrderPlace` event to the BPMN message start named `OrderPlaced`.
The process runs `reserveStock`, then an exclusive gateway routes to
`confirmOrder` when the reservation command returns `{ reserved: true,
reservationId }`. It routes to `cancelOrder` when the command returns
`{ reserved: false, reason }`.

`inventory` includes a service-local code command handler at
`services/inventory/commands/handlers.mjs`. The handler keeps `reserveStock`
as a successful business command in both branches: SKU `missing-stock` appends
`StockReservationRejected` and returns `{ reserved: false, reason:
"insufficient stock" }`; all other SKUs append a reserved stock reservation and
return `{ reserved: true, reservationId }`.

## Smoke Expectations

Local composition should validate the project, service graphs, bindings, QSM
mirrors, BPMN file reference, workflow event reference, and workflow command
binding references. It does not execute the business flow.

Deployment smoke for this demo needs a deploy target configured with
provisioned Redpanda and provisioned Operaton plus a BPMN worker image:

```json
{
  "eventBus": { "kind": "kafka", "mode": "provisioned", "provider": "redpanda" },
  "workflows": {
    "engine": { "kind": "operaton", "mode": "provisioned", "image": "operaton:test" },
    "worker": { "image": "ghcr.io/vladprrs/rntme-bpmn-worker:latest" }
  }
}
```

With that target shape, the worker can subscribe to order events and complete
service tasks through the project-routed command bindings.
