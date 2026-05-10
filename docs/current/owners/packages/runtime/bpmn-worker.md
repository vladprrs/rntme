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

## Native task handlers (`workflows.json#nativeTasks`)

In addition to gRPC-bound BPMN service tasks, the worker can execute **native
in-process handlers** declared in the workflow artifact's
`workflows.json#nativeTasks` section. Each entry maps a BPMN task id (or
external-task topic) to a handler **module + export** that the worker resolves
at startup and calls with the process variables as input.

This is how the platform's `runDeployment` BPMN drives
`@rntme/deploy-runner`'s `stages.*`: each of the six stages (compose, plan,
provision, render, apply, verify) is a native task whose handler is the
matching `stages.<name>.handler` export. Native handlers run in the worker
process — no gRPC hop — and therefore avoid the `bindings-grpc` dependency
for purely platform-internal orchestration.

### Loud-failure contract

A workflow artifact that names a `nativeTasks` handler the worker cannot
resolve **fails loudly at worker startup**. There is no silent skip, no
fallback to "unhandled", and no log-and-continue. Missing handler =
`BPMN_WORKER_NATIVE_HANDLER_UNRESOLVED` and the worker exits non-zero so the
deploy platform restarts it (or surfaces the broken artifact). The same
contract applies to invalid handler exports and handler runtime errors that
escape the stage's own error envelope.

## Poll-mode bin (`rntme-bpmn-poll-worker`)

The package ships a second bin, `rntme-bpmn-poll-worker`, that runs the
worker as a **continuous Operaton long-poller** rather than as a
Kafka-message-driven bridge. Use this bin for the platform's `deploy-worker`
container, where work originates from BPMN process instances started inside
Operaton (by `messageStartEventSubscription` from a Kafka command) and is
fetched via Operaton external-task long-poll.

The bin reuses the same handler resolution and loud-failure contract as the
default worker.

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
