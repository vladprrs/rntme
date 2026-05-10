# @rntme/bpmn-worker

Bridge worker for provisioned BPMN/Operaton projects.

It subscribes to planned Kafka topics, starts Operaton process instances from
message starts, executes BPMN service tasks by calling rntme gRPC action
bindings, and writes deterministic command metadata for retries.
Subscriptions are deployment-scoped and start from the beginning of their
Kafka topics, so an `OrderPlaced`-style message-start event produced while the
worker is still deploying is replayed instead of dropped.

## Role in the system

- Depends on: `@rntme/workflows`.
- Consumed by: deployment plans as the provisioned BPMN worker workload.
- Position in pipeline: workflow artifact + event envelopes + process state ->
  mapping evaluation -> action binding input and command metadata.

## Where to look first

- `src/mapping.ts`
- `src/metadata.ts`
- `src/command-client.ts`
- `test/unit/`
- `test/integration/worker.test.ts`

## gRPC Action Bindings

`createGrpcCommandClient(...)` builds the concrete `RntmeCommandClient` used by
workflow service tasks. Configure it with:

- `endpoints`: full workflow binding refs (`inventory.reserveStock`) mapped to
  `host:port` gRPC endpoints rendered from the deployment plan.
- `services`: service slugs (`inventory`) mapped to `{ packageName,
  serviceName, protoSource }` so the client can derive the RPC name from the
  binding id and encode/decode requests with `protobufjs`.

The client sends `rntme-command-id`, `rntme-correlation-id`, and
`rntme-causation-id` as gRPC metadata. If the action response includes a
business result protobuf `Struct`, the worker unwraps that payload into the
BPMN process variable; otherwise it returns the canonical aggregate/version/event
envelope.
`int64` fields in action responses are decoded as JavaScript numbers before
the worker maps them back into process variables.
Operaton `Json` variables fetched from later external tasks are decoded back
into plain JavaScript objects so workflow mappings such as
`$process.reservation.reservationId` can read fields returned by earlier tasks.

`runWorkflowEventOnce(...)` starts the matching process instance, then polls
and completes same-instance mapped service tasks for a bounded number of
passes. This lets a single source event drive immediate BPMN branches such as
`reserveStock` followed by `cancelOrder`.

Operaton REST calls are bounded. The client defaults to a request timeout of
at least 15 seconds (or external-task long-poll timeout + 5 seconds) and raises
`OPERATON_HTTP_TIMEOUT` when the engine hangs during startup or task polling,
so the deploy platform can restart the worker instead of leaving it alive but
unsubscribed from Kafka.

## Deployable worker image

`@rntme/bpmn-worker` ships a `rntme-bpmn-worker` bin and Dockerfile. The image
expects the Dokploy-rendered env:

- `RNTME_EVENT_BUS_BROKERS`
- `RNTME_EVENT_BUS_PROTOCOL`
- `RNTME_OPERATON_BASE_URL`
- `RNTME_WORKFLOWS_MANIFEST_PATH`
- `RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON`
- `RNTME_WORKFLOW_GRPC_SERVICES_JSON`
- `RNTME_WORKFLOW_SUBSCRIPTIONS_JSON`

Build:

```bash
docker build -f packages/runtime/bpmn-worker/Dockerfile -t ghcr.io/<owner>/rntme-bpmn-worker:<tag> .
```

## Development

Run package gates from `packages/runtime/bpmn-worker`:

```bash
bun test
bun run typecheck
bun run build
bun run lint
```

## Specs

- `../../../docs/history/specs/historical/2026-05-05-provisioned-bpmn-operaton-design.md`
