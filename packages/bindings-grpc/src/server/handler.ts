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

export function makeGrpcHandler(bindingId: string, resolved: ResolvedBinding, deps: HandlerDeps): GrpcHandlerFn {
  return (call, callback) => {
    void (async () => {
      const input = call.request;
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
        const out = await deps.commandExecutor.execute({ commandName: bindingId, inputs: input, ctx });
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
      const qout = await deps.queryExecutor.execute({ queryName: bindingId, inputs: input, ctx: qctx });
      if (!qout.ok) {
        callback({
          code: mapExecutorErrorToGrpcStatus(qout.error),
          message: `${qout.error.code}: ${qout.error.message}`,
        });
        return;
      }
      const fromField = resolved.signature.output.from;
      const responsePayload: Record<string, unknown> = { [snakeCase(fromField)]: qout.value };
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

function bindingIdToRpcName(bindingId: string): string {
  let sanitized = bindingId.replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(sanitized)) sanitized = `_${sanitized}`;
  return sanitized.split('_').filter((p) => p.length > 0).map((p) => p[0]!.toUpperCase() + p.slice(1)).join('');
}

function snakeCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
