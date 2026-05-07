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

## Live Dokploy E2E

The real deploy acceptance test is:

```bash
RNTME_DOKPLOY_E2E=1 \
RNTME_DOKPLOY_URL=... \
RNTME_DOKPLOY_API_TOKEN=... \
RNTME_DOKPLOY_PROJECT_ID=... \
RNTME_DOKPLOY_PUBLIC_DEPLOY_DOMAIN=preview.example.com \
RNTME_E2E_RUNTIME_IMAGE=ghcr.io/vladprrs/rntme-runtime:e2e-bpmn-4e3f55d-json-1 \
RNTME_E2E_BPMN_WORKER_IMAGE=ghcr.io/vladprrs/rntme-bpmn-worker:e2e-bpmn-4e3f55d-json-1 \
RNTME_E2E_OPERATON_IMAGE=operaton/operaton:2.1.0 \
pnpm -F @rntme/platform-http test -- test/e2e/order-fulfillment-dokploy-live.test.ts
```

The test deploys provisioned Redpanda, provisioned Operaton, the two demo
services, the BPMN worker, and the edge gateway. It then creates one order
that reaches `confirmed` and one order that reaches `cancelled`.

The same target shape is created through the CLI with
`rntme target create ... --event-bus-mode provisioned --workflow-engine-image
operaton/operaton:2.1.0 --workflow-worker-image
ghcr.io/vladprrs/rntme-bpmn-worker:e2e-bpmn-4e3f55d-json-1`.
