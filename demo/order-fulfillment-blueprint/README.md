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

`inventory` includes a service-local code command handler at
`services/inventory/commands/handlers.mjs`. The handler keeps `reserveStock`
as a successful business command in both branches: SKU `missing-stock` appends
`StockReservationRejected` and returns `{ reserved: false, reason:
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
RNTME_E2E_RUNTIME_IMAGE=ghcr.io/<owner>/rntme-runtime:<tag> \
RNTME_E2E_BPMN_WORKER_IMAGE=ghcr.io/<owner>/rntme-bpmn-worker:<tag> \
RNTME_E2E_OPERATON_IMAGE=operaton/operaton:<pinned-tag> \
pnpm -F @rntme/platform-http test -- test/e2e/order-fulfillment-dokploy-live.test.ts
```

The test deploys provisioned Redpanda, provisioned Operaton, the two demo
services, the BPMN worker, and the edge gateway. It then creates one order
that reaches `confirmed` and one order that reaches `cancelled`.
