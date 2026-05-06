import { randomUUID } from 'node:crypto';
import * as grpc from '@grpc/grpc-js';
import { emitProto } from '../emit/emit-proto.js';
import { loadProtoFromString } from './load-proto.js';
import { makeAllHandlers } from './handler.js';
import type { GrpcServerHandle, GrpcServerOptions } from '../types.js';

function buildServiceDefinition(loaded: ReturnType<typeof loadProtoFromString>): Record<string, grpc.MethodDefinition<object, object>> {
  const service = loaded.service;
  const def: Record<string, grpc.MethodDefinition<object, object>> = {};
  for (const [methodName, method] of Object.entries(service.methods)) {
    const requestType = loaded.root.lookupType(method.requestType);
    const responseType = loaded.root.lookupType(method.responseType);
    def[methodName] = {
      path: `/${service.fullName.replace(/^\./, '')}/${methodName}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (value: object): globalThis.Buffer =>
        globalThis.Buffer.from(requestType.encode(requestType.fromObject(value)).finish()),
      requestDeserialize: (bytes: globalThis.Buffer): object =>
        requestType.toObject(requestType.decode(bytes), { longs: Number }),
      responseSerialize: (value: object): globalThis.Buffer =>
        globalThis.Buffer.from(responseType.encode(responseType.fromObject(value)).finish()),
      responseDeserialize: (bytes: globalThis.Buffer): object =>
        responseType.toObject(responseType.decode(bytes), { longs: Number }),
    };
  }
  return def;
}

export function createGrpcServer(opts: GrpcServerOptions): GrpcServerHandle {
  const protoSource = emitProto(opts.validated, opts.shapes, {
    packageName: opts.packageName,
    serviceName: opts.serviceName,
  });

  const loaded = loadProtoFromString(protoSource, `${opts.packageName}.${opts.serviceName}`);
  const serviceDef = buildServiceDefinition(loaded);

  const now = opts.now ?? ((): string => new Date().toISOString());
  const nextId = opts.nextId ?? ((): string => randomUUID());

  const handlers = makeAllHandlers(opts.validated, {
    operationExecutor: opts.operationExecutor,
    eventStore: opts.eventStore,
    qsmDb: opts.qsmDb,
    now,
    nextId,
  });

  const server = new grpc.Server();
  server.addService(serviceDef, handlers as unknown as grpc.UntypedServiceImplementation);
  const serverCredentials = opts.serverCredentials ?? grpc.ServerCredentials.createInsecure();

  return {
    server,
    protoSource,
    listen(port, host = '0.0.0.0'): Promise<number> {
      return new Promise((resolve, reject) => {
        server.bindAsync(`${host}:${port}`, serverCredentials, (err, boundPort) => {
          if (err !== null) return reject(err);
          resolve(boundPort);
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve) => server.tryShutdown(() => resolve()));
    },
  };
}
