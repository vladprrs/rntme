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
`orders.OrderPlaced` event to the BPMN message start named `OrderPlaced`.
The process runs `reserveStock`, then an exclusive gateway routes to
`confirmOrder` when the reservation command returns `{ reserved: true,
reservationId }`. It routes to `cancelOrder` when the command returns
`{ reserved: false, reason }`.
The BPMN gateway uses Operaton/Camunda Spin JSON accessors
(`reservation.prop("reserved").boolValue()`) because the worker stores object
command results as Operaton `Json` process variables.

`inventory` implements `reserveStock` as an action graph. The graph branches
inside Graph IR: SKU `missing-stock` follows the rejection path, appends
`StockReservationRejected`, and returns `{ reserved: false, reason:
"insufficient stock" }`; all other SKUs append `StockReserved` and return
`{ reserved: true, reservationId }`.

## Live Dokploy deployment

The demo is intended to be exercisable end-to-end against a real Dokploy
instance — deploying provisioned Redpanda, provisioned Operaton, the two
demo services, the BPMN worker, and the edge gateway, then creating one
order that reaches `confirmed` and one that reaches `cancelled`. There is
no automated test runner for this end-to-end flow today; the workflow is
exercised manually via the CLI.

The required target shape is created through the CLI with
`rntme target create ... --event-bus-mode provisioned --workflow-engine-image
operaton/operaton:2.1.0 --workflow-worker-image
ghcr.io/vladprrs/rntme-bpmn-worker:e2e-bpmn-4e3f55d-json-1`.
