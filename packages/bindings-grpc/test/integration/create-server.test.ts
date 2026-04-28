import { describe, it, expect, afterEach, vi } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import BetterSqlite3 from 'better-sqlite3';
import { SqliteEventStore } from '@rntme/event-store';
import type {
  CommandExecutor,
  CommandExecutorInput,
  CommandExecutorOutput,
  QueryExecutor,
  QueryExecutorInput,
  QueryExecutorOutput,
} from '@rntme/bindings-http/executor-contract';
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
  it('accepts a CreateOrder RPC and routes to CodeCommandExecutor', async () => {
    const eventStore = new SqliteEventStore({ filename: ':memory:', serviceName: 'minimal' });
    const qsmDb = new BetterSqlite3(':memory:');

    const commandExecutor: CommandExecutor = {
      async execute(req: CommandExecutorInput): Promise<CommandExecutorOutput> {
        if (req.commandName !== 'createOrder') {
          return { ok: false, error: { code: 'COMMAND_NOT_FOUND', message: req.commandName } };
        }
        return {
          ok: true,
          value: {
            aggregateId: `order-${(req.inputs as Record<string, unknown>).amount}`,
            version: 1,
            eventIds: ['evt-1'],
            commandId: 'cmd-1',
            correlationId: 'corr-1',
          },
        };
      },
    };
    const queryExecutor: QueryExecutor = {
      async execute(req: QueryExecutorInput): Promise<QueryExecutorOutput> {
        return { ok: false, error: { code: 'QUERY_NOT_FOUND', message: req.queryName } };
      },
    };

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
      const typedClient = client as unknown as {
        CreateOrder?: (arg: object, cb: (err: unknown, res: object) => void) => void;
      };
      if (!typedClient.CreateOrder) throw new Error('CreateOrder method missing');
      typedClient.CreateOrder({ amount: 42, note: 'hello' }, (err, res) => {
        if (err !== null && err !== undefined) reject(err);
        else resolve(res as Record<string, unknown>);
      });
    });

    expect(response.aggregate_id).toBe('order-42');
    expect(Number(response.version)).toBe(1);
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
      commandExecutor: {
        async execute() {
          return { ok: false, error: { code: 'COMMAND_NOT_FOUND', message: 'not used' } };
        },
      },
      queryExecutor: {
        async execute() {
          return { ok: false, error: { code: 'QUERY_NOT_FOUND', message: 'not used' } };
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
  return { root, service: root.lookupService(serviceName) };
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
