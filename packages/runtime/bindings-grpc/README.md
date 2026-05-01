# @rntme/bindings-grpc

gRPC transport surface for `@rntme/bindings`. Emits a `.proto` file from a `ValidatedBindings` artifact and serves commands/queries via `@grpc/grpc-js` + `protobufjs`, wiring each RPC through the `CommandExecutor` / `QueryExecutor` seam (defined in plan 1).

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
  commandExecutor,
  queryExecutor,
  eventStore,
  qsmDb,
  // Optional. Defaults to grpc.ServerCredentials.createInsecure().
  serverCredentials: grpc.ServerCredentials.createSsl(rootCerts, [
    { private_key: serverKey, cert_chain: serverCert },
  ]),
});

const port = await handle.listen(50051);
// ...
await handle.stop();
```

## Type mapping

| Binding artifact type            | Proto type         |
|----------------------------------|--------------------|
| `scalar.integer`                 | `int64`            |
| `scalar.decimal`                 | `string` (decimal encoded) |
| `scalar.string`                  | `string`           |
| `scalar.boolean`                 | `bool`             |
| `scalar.date` / `scalar.datetime`| `string` (ISO)     |
| `array.<scalar>`                 | `repeated <scalar>`|
| `rowset.<shape>`                 | `repeated <Shape>` |
| `row.<shape>`                    | `<Shape>`          |
| command output                   | canonical `CommandResult` |
| nullable field                   | `optional`         |

## Error mapping

| Executor error code              | gRPC status              |
|----------------------------------|--------------------------|
| `COMMAND_NOT_FOUND`, `QUERY_NOT_FOUND` | `UNIMPLEMENTED`    |
| `COMMAND_GUARD_REJECTED`         | `FAILED_PRECONDITION`    |
| `COMMAND_CONCURRENCY_CONFLICT`   | `ABORTED`                |
| `COMMAND_HANDLER_THREW`, `QUERY_HANDLER_THREW` | `INTERNAL` |
| `COMMAND_HANDLER_ERROR`          | `INVALID_ARGUMENT`       |

## Not yet supported

- `pre[]` middleware (plan 3).
- Extended `command` binding with `method` / `inputFrom` / `response` (plan 4).
- `grpc.health.v1.Health` proto surface.
- Streaming RPCs.

## Limitations (MVP)

- Shape collection at boot currently reads output shapes only; multi-shape input requires a centralised shape registry. Tracked as inline TODO in `packages/runtime/src/start/build-grpc-surface.ts`; revisit when plan 5 ships a module that needs it.
