import * as grpc from '@grpc/grpc-js';
import type { ResolvedBinding, ValidatedBindings } from '@rntme/bindings';
import type {
  CommandExecutor,
  QueryExecutor,
  CommandExecutionContext,
  QueryExecutionContext,
} from '@rntme/bindings-http/executor-contract';
import type { EventStore } from '@rntme/event-store';
import type BetterSqlite3 from 'better-sqlite3';
import { mapExecutorErrorToGrpcStatus } from './errors.js';
import { bindingIdToRpcName, toSnakeCase } from '../emit/ids.js';

export type HandlerDeps = {
  commandExecutor: CommandExecutor;
  queryExecutor: QueryExecutor;
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database;
  now: () => string;
  nextId: () => string;
};

export type GrpcHandlerFn = (
  call: grpc.ServerUnaryCall<Record<string, unknown>, unknown>,
  callback: grpc.sendUnaryData<unknown>,
) => void;

function buildInputs(
  request: Record<string, unknown>,
  inputNames: Iterable<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of inputNames) {
    const key = toSnakeCase(name);
    if (key in request) out[name] = request[key];
  }
  return out;
}

export function makeGrpcHandler(bindingId: string, resolved: ResolvedBinding, deps: HandlerDeps): GrpcHandlerFn {
  return (call, callback) => {
    void (async () => {
      const input = buildInputs(
        call.request as Record<string, unknown>,
        Object.keys(resolved.signature.inputs),
      );
      const metadata = call.metadata.getMap();
      const correlation = {
        commandId: typeof metadata['rntme-command-id'] === 'string' ? metadata['rntme-command-id'] : deps.nextId(),
        correlationId: typeof metadata['rntme-correlation-id'] === 'string' ? metadata['rntme-correlation-id'] : deps.nextId(),
        traceparent: typeof metadata['traceparent'] === 'string' ? metadata['traceparent'] : null,
      };

      if (resolved.entry.kind === 'command') {
        const ctx: CommandExecutionContext = {
          eventStore: deps.eventStore,
          qsmDb: deps.qsmDb,
          now: deps.now,
          nextId: deps.nextId,
          actor: null,
          correlation,
        };
        const out = await deps.commandExecutor.execute({
          commandName: resolved.entry.graph,
          inputs: input,
          ctx,
        });
        if (!out.ok) {
          callback({
            code: mapExecutorErrorToGrpcStatus(out.error),
            message: `${out.error.code}: ${out.error.message}`,
          });
          return;
        }
        callback(null, {
          aggregate_id: out.value.aggregateId,
          version: out.value.version,
          event_ids: [...out.value.eventIds],
          command_id: out.value.commandId,
          correlation_id: out.value.correlationId,
        });
        return;
      }

      const qctx: QueryExecutionContext = { qsmDb: deps.qsmDb };
      const qout = await deps.queryExecutor.execute({
        queryName: resolved.entry.graph,
        inputs: input,
        ctx: qctx,
      });
      if (!qout.ok) {
        callback({
          code: mapExecutorErrorToGrpcStatus(qout.error),
          message: `${qout.error.code}: ${qout.error.message}`,
        });
        return;
      }
      const fromField = resolved.signature.output.from;
      const responsePayload: Record<string, unknown> = { [toSnakeCase(fromField)]: qout.value };
      callback(null, responsePayload);
    })().catch((err) => {
      callback({ code: grpc.status.INTERNAL, message: err instanceof Error ? err.message : String(err) });
    });
  };
}

export function makeAllHandlers(validated: ValidatedBindings, deps: HandlerDeps): Record<string, GrpcHandlerFn> {
  const out: Record<string, GrpcHandlerFn> = {};
  for (const [bindingId, resolved] of Object.entries(validated.resolved)) {
    const rpcName = bindingIdToRpcName(bindingId);
    out[rpcName] = makeGrpcHandler(bindingId, resolved, deps);
  }
  return out;
}
