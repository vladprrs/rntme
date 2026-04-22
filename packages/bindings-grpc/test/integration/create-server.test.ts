import { describe, it, expect, afterEach } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import BetterSqlite3 from 'better-sqlite3';
import { SqliteEventStore } from '@rntme/event-store';
import { CodeCommandExecutor, GraphIrQueryExecutor } from '@rntme/runtime';
import { createGrpcServer, emitProto } from '../../src/index.js';
import { minimalValidated, minimalShapeRegistry } from '../fixtures/minimal-bindings.js';

let handle: Awaited<ReturnType<typeof createGrpcServer>> | null = null;
afterEach(async () => {
  if (handle !== null) {
    await handle.stop();
    handle = null;
  }
});

describe('createGrpcServer (integration)', () => {
  it('accepts a CreateOrder RPC and routes to CodeCommandExecutor', async () => {
    const eventStore = new SqliteEventStore({ filename: ':memory:', serviceName: 'minimal' });
    const qsmDb = new BetterSqlite3(':memory:');

    const commandExecutor = new CodeCommandExecutor({
      createOrder: async (_ctx, input) => ({
        ok: true,
        value: {
          aggregateId: `order-${(input as Record<string, unknown>).amount}`,
          version: 1,
          eventIds: ['evt-1'],
          commandId: 'cmd-1',
          correlationId: 'corr-1',
        },
      }),
    });
    const queryExecutor = new GraphIrQueryExecutor({});

    handle = createGrpcServer({
      validated: minimalValidated,
      shapes: minimalShapeRegistry,
      packageName: 'rntme.minimal.v1',
      serviceName: 'MinimalService',
      commandExecutor,
      queryExecutor,
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
      (client as unknown as Record<string, (arg: object, cb: (err: unknown, res: object) => void) => void>)
        .CreateOrder({ amount: 42, note: 'hello' }, (err, res) => {
          if (err !== null && err !== undefined) reject(err);
          else resolve(res as Record<string, unknown>);
        });
    });

    expect(response.aggregate_id).toBe('order-42');
    expect(Number(response.version)).toBe(1);
  });
});

function loadProto(src: string, serviceName: string): { root: protobuf.Root; service: protobuf.Service } {
  const { root } = protobuf.parse(src, { keepCase: true });
  return { root, service: root.lookupService(serviceName) };
}

function toServiceDef(root: protobuf.Root, service: protobuf.Service): grpc.ServiceDefinition {
  const def: grpc.ServiceDefinition = {};
  for (const [methodName, method] of Object.entries(service.methods)) {
    const req = root.lookupType(method.requestType);
    const res = root.lookupType(method.responseType);
    def[methodName] = {
      path: `/${service.fullName.replace(/^\./, '')}/${methodName}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (v: object): Buffer => Buffer.from(req.encode(req.fromObject(v)).finish()),
      requestDeserialize: (b: Buffer): object => req.toObject(req.decode(b)),
      responseSerialize: (v: object): Buffer => Buffer.from(res.encode(res.fromObject(v)).finish()),
      responseDeserialize: (b: Buffer): object => res.toObject(res.decode(b)),
    };
  }
  return def;
}
