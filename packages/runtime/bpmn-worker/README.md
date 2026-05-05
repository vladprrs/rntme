# @rntme/bpmn-worker

Bridge worker for provisioned BPMN/Operaton projects.

It subscribes to planned Kafka topics, starts Operaton process instances from
message starts, executes BPMN service tasks by calling rntme gRPC command
bindings, and writes deterministic command metadata for retries.

## Role in the system

- Depends on: `@rntme/workflows`.
- Consumed by: deployment plans as the provisioned BPMN worker workload.
- Position in pipeline: workflow artifact + event envelopes + process state ->
  mapping evaluation -> command binding input and metadata.

## Where to look first

- `src/mapping.ts`
- `src/metadata.ts`
- `src/command-client.ts`
- `test/unit/`
- `test/integration/worker.test.ts`

## gRPC command bindings

`createGrpcCommandClient(...)` builds the concrete `RntmeCommandClient` used by
workflow service tasks. Configure it with:

- `endpoints`: full workflow binding refs (`inventory.reserveStock`) mapped to
  `host:port` gRPC endpoints rendered from the deployment plan.
- `services`: service slugs (`inventory`) mapped to `{ packageName,
  serviceName, protoSource }` so the client can derive the RPC name from the
  binding id and encode/decode requests with `protobufjs`.

The client sends `rntme-command-id`, `rntme-correlation-id`, and
`rntme-causation-id` as gRPC metadata. If the command returns the canonical
`CommandResult.result` protobuf `Struct`, the worker unwraps that business
payload into the BPMN process variable; otherwise it returns the canonical
aggregate/version/event envelope.

`runWorkflowEventOnce(...)` starts the matching process instance, then polls
and completes same-instance mapped service tasks for a bounded number of
passes. This lets a single source event drive immediate BPMN branches such as
`reserveStock` followed by `cancelOrder`.

## Specs

- `../../../docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md`
