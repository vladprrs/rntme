import * as grpc from '@grpc/grpc-js';
import type { ResolvedBinding, ValidatedBindings } from '@rntme/bindings';
import type { OperationExecutor } from '@rntme/bindings-http/operation-contract';
import type { EventStore } from '@rntme/event-store';
import type BetterSqlite3 from 'better-sqlite3';
import { mapExecutorErrorToGrpcStatus } from './errors.js';
import { bindingIdToRpcName, toSnakeCase } from '../emit/ids.js';

export type HandlerDeps = {
  operationExecutor: OperationExecutor;
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
      const idempotencyKey =
        typeof metadata['rntme-idempotency-key'] === 'string'
          ? metadata['rntme-idempotency-key']
          : null;

      const out = await deps.operationExecutor.execute({
        operationName: resolved.entry.graph,
        inputs: input,
        ctx: {
          qsmDb: deps.qsmDb,
          eventStore: deps.eventStore,
          callClient: null,
          now: deps.now,
          nextId: deps.nextId,
          actor: null,
          correlation,
          idempotencyKey,
        },
      });
      if (!out.ok) {
        callback({
          code: mapExecutorErrorToGrpcStatus(out.error),
          message: `${out.error.code}: ${out.error.message}`,
        });
        return;
      }
      callback(null, { result: jsonToStruct(out.value.value) });
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

function jsonToStruct(value: unknown): { fields: Record<string, unknown> } {
  if (isRecord(value)) {
    return { fields: fieldsToStructValues(value) };
  }
  return { fields: { value: jsonToValue(value) } };
}

function fieldsToStructValues(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = jsonToValue(value);
  }
  return out;
}

function jsonToValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: 0 };
  if (typeof value === 'number') return { numberValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (Array.isArray(value)) return { listValue: { values: value.map(jsonToValue) } };
  if (isRecord(value)) return { structValue: { fields: fieldsToStructValues(value) } };
  return { stringValue: String(value) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
