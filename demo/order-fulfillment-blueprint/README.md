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
`confirmOrder` when reservation succeeds or `cancelOrder` when reservation
fails.

The current `reserveStock` graph is intentionally a simple command graph that
always emits a reserved stock reservation. The insufficient-stock path through
`cancelOrder` is the intended deployed smoke branch once a code handler or
follow-up graph capability can return the rejected reservation result.

## Smoke Expectations

Local composition should validate the project, service graphs, bindings, QSM
mirrors, BPMN file reference, workflow event reference, and workflow command
binding references. It does not execute the business flow.

Deployment smoke for this demo needs a deploy target configured with
provisioned Redpanda and provisioned Operaton so the BPMN worker can subscribe
to order events and complete service tasks.
