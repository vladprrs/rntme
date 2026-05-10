# @rntme/bindings-grpc

gRPC transport surface for `@rntme/bindings`. It emits a `.proto` service from `ValidatedBindings` and serves every RPC through the unified `OperationExecutor` contract.

## Public API

```ts
import * as grpc from '@grpc/grpc-js';
import { emitProto, createGrpcServer } from '@rntme/bindings-grpc';

const protoSource = emitProto(validated, shapeRegistry, {
  packageName: 'rntme.payments.v1',
  serviceName: 'PaymentsService',
});

const handle = createGrpcServer({
  validated,
  shapes: shapeRegistry,
  packageName: 'rntme.payments.v1',
  serviceName: 'PaymentsService',
  operationExecutor,
  eventStore,
  qsmDb, // SqliteDatabase from @rntme/sqlite
  serverCredentials: grpc.ServerCredentials.createInsecure(),
});

const port = await handle.listen(50051);
await handle.stop();
```

## Type Mapping

| Binding artifact type | Proto type |
| --- | --- |
| `scalar.integer` | `int64` |
| `scalar.decimal` | `string` decimal encoding |
| `scalar.string` | `string` |
| `scalar.boolean` | `bool` |
| `scalar.date` / `scalar.datetime` | `string` |
| `array.<scalar>` | `repeated <scalar>` |
| operation output | `google.protobuf.Struct result = 1` |
| nullable field | `optional` when emitted as a request field |

Inbound `int64` request fields are converted to JavaScript numbers before the executor receives inputs. All operation responses use a Struct wrapper so read and action operations share one gRPC response shape.

## Error Mapping

| Operation error code | gRPC status |
| --- | --- |
| `OPERATION_NOT_FOUND` | `UNIMPLEMENTED` |
| `COMMAND_GUARD_REJECTED` / `COMMAND_ILLEGAL_TRANSITION` | `FAILED_PRECONDITION` |
| `COMMAND_CONCURRENCY_CONFLICT` | `ABORTED` |
| `OPERATION_EXECUTION_FAILED` | `INTERNAL` |
| unknown operation errors | `INTERNAL` |

## Limitations

- No streaming RPCs.
- No `grpc.health.v1.Health` surface yet.
- Shape collection at boot currently reads binding output shapes; richer operation input shape registries remain future work.
- `qsmDb` is the shared `SqliteDatabase` port from `@rntme/sqlite`.

## Specs

- [`../../../docs/history/specs/historical/2026-05-06-graph-ir-effect-operations-design.md`](/docs/history/specs/historical/2026-05-06-graph-ir-effect-operations-design.md) — operation-based gRPC surface.
