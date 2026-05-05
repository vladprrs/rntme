import { afterEach, describe, expect, it } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import { Buffer } from 'node:buffer';
import { createGrpcCommandClient } from '../../src/index.js';

const protoSource = [
  'syntax = "proto3";',
  'package rntme.inventory.v1;',
  'import "google/protobuf/struct.proto";',
  'message ReserveStockRequest {',
  '  string order_id = 1;',
  '  string sku = 2;',
  '  int64 quantity = 3;',
  '}',
  'message CommandResult {',
  '  string aggregate_id = 1;',
  '  int64 version = 2;',
  '  repeated string event_ids = 3;',
  '  string command_id = 4;',
  '  string correlation_id = 5;',
  '  google.protobuf.Struct result = 6;',
  '}',
  'service InventoryService {',
  '  rpc ReserveStock (ReserveStockRequest) returns (CommandResult);',
  '}',
  '',
].join('\n');

let server: grpc.Server | null = null;

afterEach(async () => {
  if (server === null) return;
  await new Promise<void>((resolve) => server?.tryShutdown(() => resolve()));
  server = null;
});

describe('createGrpcCommandClient', () => {
  it('calls the binding endpoint over gRPC and unwraps CommandResult.result', async () => {
    const receivedMetadata: Record<string, unknown> = {};
    const port = await startInventoryServer((call, callback) => {
      Object.assign(receivedMetadata, call.metadata.getMap());
      callback(null, {
        aggregate_id: `reservation-${call.request.order_id}`,
        version: 1,
        event_ids: ['evt-1'],
        command_id: String(receivedMetadata['rntme-command-id']),
        correlation_id: String(receivedMetadata['rntme-correlation-id']),
        result: jsonToStruct({ reserved: false, reason: 'insufficient stock' }),
      });
    });

    const client = createGrpcCommandClient({
      endpoints: { 'inventory.reserveStock': `127.0.0.1:${port}` },
      services: {
        inventory: {
          packageName: 'rntme.inventory.v1',
          serviceName: 'InventoryService',
          protoSource,
        },
      },
    });

    const result = await client.execute(
      'inventory.reserveStock',
      { orderId: 'ord_1', sku: 'missing-stock', quantity: 2 },
      {
        commandId: 'bpmn:proc_1:reserveStock:act_1',
        correlationId: 'corr_1',
        causationId: 'evt_1',
      },
    );

    expect(receivedMetadata['rntme-command-id']).toBe('bpmn:proc_1:reserveStock:act_1');
    expect(receivedMetadata['rntme-correlation-id']).toBe('corr_1');
    expect(receivedMetadata['rntme-causation-id']).toBe('evt_1');
    expect(result).toEqual({ reserved: false, reason: 'insufficient stock' });
  });
});

async function startInventoryServer(
  handler: grpc.handleUnaryCall<Record<string, unknown>, Record<string, unknown>>,
): Promise<number> {
  const { root, service } = loadProto(protoSource, 'rntme.inventory.v1.InventoryService');
  server = new grpc.Server();
  server.addService(toServiceDef(root, service), { ReserveStock: handler });
  return new Promise<number>((resolve, reject) => {
    server?.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err !== null) {
        reject(err);
        return;
      }
      server?.start();
      resolve(port);
    });
  });
}

function loadProto(src: string, serviceName: string): { root: protobuf.Root; service: protobuf.Service } {
  const { root } = protobuf.parse(src, { keepCase: true });
  root.addJSON(protobuf.common.get('google/protobuf/struct.proto')?.nested ?? {});
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
      requestSerialize: (v: object): Buffer => Buffer.from(req.encode(req.fromObject(v)).finish()),
      requestDeserialize: (b: Buffer): object => req.toObject(req.decode(b)),
      responseSerialize: (v: object): Buffer => Buffer.from(res.encode(res.fromObject(v)).finish()),
      responseDeserialize: (b: Buffer): object => res.toObject(res.decode(b)),
    };
  }
  return def as grpc.ServiceDefinition;
}

function jsonToStruct(value: Record<string, unknown>): { fields: Record<string, unknown> } {
  return {
    fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonToValue(item)])),
  };
}

function jsonToValue(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') return { numberValue: value };
  if (value === null || value === undefined) return { nullValue: 0 };
  return { stringValue: String(value) };
}
