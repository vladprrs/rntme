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
- `test/unit/`

## Specs

- `../../../docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md`
