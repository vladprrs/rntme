import { describe, it, expect, afterEach, vi } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import BetterSqlite3 from 'better-sqlite3';
import { SqliteEventStore } from '@rntme/event-store';
import type { OperationExecutor } from '@rntme/bindings-http/operation-contract';
import { createGrpcServer } from '../../src/index.js';
import { minimalValidated, minimalShapeRegistry } from '../fixtures/minimal-bindings.js';

let handle: Awaited<ReturnType<typeof createGrpcServer>> | null = null;
afterEach(async () => {
  if (handle !== null) {
    await handle.stop();
    handle = null;
  }
});

describe('createGrpcServer (integration)', () => {
  it('routes an action exposure to OperationExecutor and returns operation result', async () => {
    const eventStore = new SqliteEventStore({ filename: ':memory:', serviceName: 'minimal' });
    const qsmDb = new BetterSqlite3(':memory:');
    const receivedInputs: Record<string, unknown>[] = [];

    const operationExecutor: OperationExecutor = {
      async execute(req) {
        if (req.operationName !== 'createOrder') {
          return { ok: false, error: { code: 'OPERATION_NOT_FOUND', message: req.operationName } };
        }
        receivedInputs.push(req.inputs as Record<string, unknown>);
        return {
          ok: true,
          value: {
            value: { reserved: true, reservationId: 'r1' },
            metadata: { eventIds: ['e1'], commandId: 'cmd', correlationId: 'corr' },
          },
        };
      },
    };

    handle = createGrpcServer({
      validated: minimalValidated,
      shapes: minimalShapeRegistry,
      packageName: 'rntme.minimal.v1',
      serviceName: 'MinimalService',
      operationExecutor,
      eventStore,
      qsmDb,
    });

    const port = await handle.listen(0, '127.0.0.1');

    // Build a client against the same proto to call the server.
    const { root, service } = loadProto(handle.protoSource, 'rntme.minimal.v1.MinimalService');
    const ClientCtor = grpc.makeGenericClientConstructor(
      toServiceDef(root, service),
      'MinimalService',
      {},
    );
    const client = new ClientCtor(`127.0.0.1:${port}`, grpc.credentials.createInsecure());

    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const typedClient = client as unknown as {
        CreateOrder?: (arg: object, cb: (err: unknown, res: object) => void) => void;
      };
      if (!typedClient.CreateOrder) throw new Error('CreateOrder method missing');
      typedClient.CreateOrder({ amount: 42, note: 'hello' }, (err, res) => {
        if (err !== null && err !== undefined) reject(err);
        else resolve(res as Record<string, unknown>);
      });
    });

    expect(response.aggregate_id).toBeUndefined();
    expect(response.version).toBeUndefined();
    expect(response.event_ids).toBeUndefined();
    expect(structToJson(response.result)).toEqual({ reserved: true, reservationId: 'r1' });
    const inputs = receivedInputs[0];
    if (inputs === undefined) throw new Error('operation executor was not called');
    expect(inputs).toMatchObject({ amount: 42, note: 'hello' });
    expect(typeof inputs.amount).toBe('number');
  });

  it('passes supplied server credentials to bindAsync', async () => {
    const eventStore = new SqliteEventStore({ filename: ':memory:', serviceName: 'minimal' });
    const qsmDb = new BetterSqlite3(':memory:');
    const credentials = new TestServerCredentials();

    handle = createGrpcServer({
      validated: minimalValidated,
      shapes: minimalShapeRegistry,
      packageName: 'rntme.minimal.v1',
      serviceName: 'MinimalService',
      operationExecutor: {
        async execute() {
          return { ok: false, error: { code: 'OPERATION_NOT_FOUND', message: 'not used' } };
        },
      },
      eventStore,
      qsmDb,
      serverCredentials: credentials,
    });

    const bindAsync = vi.spyOn(handle.server, 'bindAsync').mockImplementation((address, serverCredentials, callback) => {
      callback(null, 50051);
    });

    await expect(handle.listen(0, '127.0.0.1')).resolves.toBe(50051);

    expect(bindAsync).toHaveBeenCalledWith('127.0.0.1:0', credentials, expect.any(Function));
  });
});

function loadProto(src: string, serviceName: string): { root: protobuf.Root; service: protobuf.Service } {
  const { root } = protobuf.parse(src, { keepCase: true });
  root.addJSON(protobuf.common.get('google/protobuf/struct.proto')?.nested ?? {});
  return { root, service: root.lookupService(serviceName) };
}

function structToJson(value: unknown): unknown {
  if (value === undefined) return undefined;
  const struct = value as { fields?: Record<string, unknown> };
  return fieldsToJson(struct.fields ?? {});
}

function fieldsToJson(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = valueToJson(value);
  }
  return out;
}

function valueToJson(value: unknown): unknown {
  const typed = value as {
    nullValue?: unknown;
    numberValue?: number;
    stringValue?: string;
    boolValue?: boolean;
    structValue?: { fields?: Record<string, unknown> };
    listValue?: { values?: unknown[] };
  };
  if (typed.nullValue !== undefined) return null;
  if (typed.numberValue !== undefined) return typed.numberValue;
  if (typed.stringValue !== undefined) return typed.stringValue;
  if (typed.boolValue !== undefined) return typed.boolValue;
  if (typed.structValue !== undefined) return fieldsToJson(typed.structValue.fields ?? {});
  if (typed.listValue !== undefined) return (typed.listValue.values ?? []).map(valueToJson);
  return undefined;
}

function toServiceDef(root: protobuf.Root, service: protobuf.Service): grpc.ServiceDefinition {
  const def = {} as Record<string, grpc.MethodDefinition<object, object>>;
  for (const [methodName, method] of Object.entries(service.methods)) {
    const req = root.lookupType(method.requestType);
    const res = root.lookupType(method.responseType);
    def[methodName] = {
      path: `/${service.fullName.replace(/^\./, '')}/${methodName}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (v: object): globalThis.Buffer => globalThis.Buffer.from(req.encode(req.fromObject(v)).finish()),
      requestDeserialize: (b: globalThis.Buffer): object => req.toObject(req.decode(b)),
      responseSerialize: (v: object): globalThis.Buffer => globalThis.Buffer.from(res.encode(res.fromObject(v)).finish()),
      responseDeserialize: (b: globalThis.Buffer): object => res.toObject(res.decode(b)),
    };
  }
  return def as grpc.ServiceDefinition;
}

class TestServerCredentials extends grpc.ServerCredentials {
  constructor() {
    super(null);
  }

  _equals(other: grpc.ServerCredentials): boolean {
    return other === this;
  }
}
