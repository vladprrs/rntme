import * as grpc from '@grpc/grpc-js';
import protobuf from 'protobufjs';
import { Buffer } from 'node:buffer';

import type {
  CommandMetadata,
  WorkflowGrpcServiceConfig,
  WorkflowGrpcServiceRegistry,
  WorkflowServiceEndpointMap,
} from './types.js';

export type RntmeCommandClient = {
  readonly execute: (bindingRef: string, input: unknown, metadata: CommandMetadata) => Promise<unknown>;
};

export type GrpcCommandClientOptions = {
  readonly endpoints: WorkflowServiceEndpointMap;
  readonly services: WorkflowGrpcServiceRegistry;
  readonly credentials?: grpc.ChannelCredentials;
};

type UnaryGrpcClient = grpc.Client &
  Record<
    string,
    (
      request: Record<string, unknown>,
      metadata: grpc.Metadata,
      callback: (err: grpc.ServiceError | null, response: Record<string, unknown>) => void,
    ) => void
  >;

type LoadedServiceClient = {
  readonly client: UnaryGrpcClient;
  readonly service: protobuf.Service;
};

export function createGrpcCommandClient(options: GrpcCommandClientOptions): RntmeCommandClient {
  const credentials = options.credentials ?? grpc.credentials.createInsecure();
  const clients = new Map<string, LoadedServiceClient>();

  return {
    async execute(bindingRef, input, metadata) {
      const { serviceSlug, bindingId } = splitBindingRef(bindingRef);
      const endpoint = options.endpoints[bindingRef];
      if (endpoint === undefined || endpoint.length === 0) {
        throw new Error(`no gRPC endpoint configured for workflow service task binding "${bindingRef}"`);
      }

      const serviceConfig = options.services[serviceSlug];
      if (serviceConfig === undefined) {
        throw new Error(`no gRPC proto configured for workflow service "${serviceSlug}"`);
      }

      const rpcName = bindingIdToRpcName(bindingId);
      const loaded = getLoadedServiceClient(clients, endpoint, serviceSlug, serviceConfig, credentials);
      if (loaded.service.methods[rpcName] === undefined || typeof loaded.client[rpcName] !== 'function') {
        throw new Error(`gRPC service "${serviceSlug}" does not define RPC "${rpcName}" for binding "${bindingRef}"`);
      }

      const response = await callUnary(loaded.client, rpcName, objectToGrpc(input), metadata);
      if (hasOwn(response, 'result') && response.result !== undefined) {
        return structToJson(response.result);
      }
      return {
        aggregateId: stringOrEmpty(response.aggregate_id),
        version: numberOrZero(response.version),
        eventIds: Array.isArray(response.event_ids) ? response.event_ids.map(String) : [],
        commandId: stringOrEmpty(response.command_id),
        correlationId: stringOrEmpty(response.correlation_id),
      };
    },
  };
}

function getLoadedServiceClient(
  clients: Map<string, LoadedServiceClient>,
  endpoint: string,
  serviceSlug: string,
  config: WorkflowGrpcServiceConfig,
  credentials: grpc.ChannelCredentials,
): LoadedServiceClient {
  const cacheKey = `${serviceSlug}\0${endpoint}`;
  const cached = clients.get(cacheKey);
  if (cached !== undefined) return cached;

  const { root } = protobuf.parse(config.protoSource, { keepCase: true });
  root.addJSON(protobuf.common.get('google/protobuf/struct.proto')?.nested ?? {});
  const service = root.lookupService(`${config.packageName}.${config.serviceName}`);
  const ClientCtor = grpc.makeGenericClientConstructor(toServiceDefinition(root, service), config.serviceName, {});
  const client = new ClientCtor(endpoint, credentials) as UnaryGrpcClient;
  const loaded = { client, service };
  clients.set(cacheKey, loaded);
  return loaded;
}

function toServiceDefinition(root: protobuf.Root, service: protobuf.Service): grpc.ServiceDefinition {
  const def: Record<string, grpc.MethodDefinition<object, object>> = {};
  for (const [methodName, method] of Object.entries(service.methods)) {
    const requestType = root.lookupType(method.requestType);
    const responseType = root.lookupType(method.responseType);
    def[methodName] = {
      path: `/${service.fullName.replace(/^\./, '')}/${methodName}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (value: object): Buffer => Buffer.from(requestType.encode(requestType.fromObject(value)).finish()),
      requestDeserialize: (buffer: Buffer): object => requestType.toObject(requestType.decode(buffer)),
      responseSerialize: (value: object): Buffer => Buffer.from(responseType.encode(responseType.fromObject(value)).finish()),
      responseDeserialize: (buffer: Buffer): object => responseType.toObject(responseType.decode(buffer)),
    };
  }
  return def as grpc.ServiceDefinition;
}

function callUnary(
  client: UnaryGrpcClient,
  rpcName: string,
  request: Record<string, unknown>,
  metadata: CommandMetadata,
): Promise<Record<string, unknown>> {
  const grpcMetadata = new grpc.Metadata();
  grpcMetadata.set('rntme-command-id', metadata.commandId);
  grpcMetadata.set('rntme-correlation-id', metadata.correlationId);
  grpcMetadata.set('rntme-causation-id', metadata.causationId);

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    client[rpcName]!(request, grpcMetadata, (err, response) => {
      if (err !== null) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

function splitBindingRef(bindingRef: string): { serviceSlug: string; bindingId: string } {
  const dot = bindingRef.indexOf('.');
  if (dot <= 0 || dot === bindingRef.length - 1) {
    throw new Error(`workflow service task binding "${bindingRef}" must use "<service>.<binding>"`);
  }
  return {
    serviceSlug: bindingRef.slice(0, dot),
    bindingId: bindingRef.slice(dot + 1),
  };
}

function objectToGrpc(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return {};
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [toSnakeCase(key), valueToGrpc(value)]));
}

function valueToGrpc(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(valueToGrpc);
  if (isRecord(value)) return objectToGrpc(value);
  return value;
}

function structToJson(value: unknown): unknown {
  if (!isRecord(value)) return undefined;
  const fields = value.fields;
  if (!isRecord(fields)) return undefined;
  return fieldsToJson(fields);
}

function fieldsToJson(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, protoValueToJson(value)]));
}

function protoValueToJson(value: unknown): unknown {
  if (!isRecord(value)) return undefined;
  if (hasOwn(value, 'nullValue')) return null;
  if (hasOwn(value, 'numberValue')) return value.numberValue;
  if (hasOwn(value, 'stringValue')) return value.stringValue;
  if (hasOwn(value, 'boolValue')) return value.boolValue;
  if (isRecord(value.structValue)) return structToJson(value.structValue);
  if (isRecord(value.listValue) && Array.isArray(value.listValue.values)) {
    return value.listValue.values.map(protoValueToJson);
  }
  return undefined;
}

function bindingIdToRpcName(bindingId: string): string {
  return sanitizeToProtoIdent(bindingId)
    .split('_')
    .filter((part) => part.length > 0)
    .map(camelToPascal)
    .join('');
}

function sanitizeToProtoIdent(raw: string): string {
  const out = raw.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[0-9]/.test(out) ? `_${out}` : out;
}

function camelToPascal(value: string): string {
  if (value.length === 0) return value;
  return value[0]!.toUpperCase() + value.slice(1);
}

function toSnakeCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function hasOwn<T extends object, K extends PropertyKey>(value: T, key: K): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
