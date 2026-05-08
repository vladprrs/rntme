import { Buffer } from 'node:buffer';
import * as grpc from '@grpc/grpc-js';
import { proto } from '@rntme/contracts-storage-v1';
import { GrpcStatus, grpcStatusFor, StorageS3Error, unimplemented } from './errors.js';

const storageV1 = proto.rntme.contracts.storage.v1;

type ProtoType = {
  encode(value: object): { finish(): Uint8Array };
  decode(bytes: Uint8Array): object;
  fromObject(value: object): object;
  toObject(value: object, options?: object): object;
};

type UnaryHandler = (request: object) => Promise<object>;

const rpcDescriptors = {
  PrepareUpload: [storageV1.PrepareUploadRequest, storageV1.PrepareUploadResponse],
  CommitUpload: [storageV1.CommitUploadRequest, storageV1.CommitUploadResponse],
  AbortUpload: [storageV1.AbortUploadRequest, storageV1.AbortUploadResponse],
  GetFile: [storageV1.GetFileRequest, storageV1.GetFileResponse],
  ListFiles: [storageV1.ListFilesRequest, storageV1.ListFilesResponse],
  GetDownloadUrl: [storageV1.GetDownloadUrlRequest, storageV1.GetDownloadUrlResponse],
  DeleteFile: [storageV1.DeleteFileRequest, storageV1.DeleteFileResponse],
} satisfies Record<string, readonly [ProtoType, ProtoType]>;

export type StorageRpcName = keyof typeof rpcDescriptors;

export interface StorageGrpcServerOptions {
  module: Partial<Record<StorageRpcName, UnaryHandler>>;
  port?: number;
  host?: string;
  serverCredentials?: grpc.ServerCredentials;
}

export interface StorageGrpcServer {
  server: grpc.Server;
  listen(): Promise<{ port: number }>;
  stop(): Promise<void>;
}

function serialize(type: ProtoType, value: object): Buffer {
  return Buffer.from(type.encode(type.fromObject(value)).finish());
}

function deserialize(type: ProtoType, bytes: Buffer): object {
  return type.toObject(type.decode(bytes), { defaults: true });
}

function createServiceDefinition(): grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
  const service: Record<string, grpc.MethodDefinition<object, object>> = {};
  for (const [rpc, [requestType, responseType]] of Object.entries(rpcDescriptors)) {
    service[rpc] = {
      path: `/rntme.contracts.storage.v1.StorageModule/${rpc}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (value: object): Buffer => serialize(requestType, value),
      requestDeserialize: (bytes: Buffer): object => deserialize(requestType, bytes),
      responseSerialize: (value: object): Buffer => serialize(responseType, value),
      responseDeserialize: (bytes: Buffer): object => deserialize(responseType, bytes),
    };
  }
  return service as grpc.ServiceDefinition<grpc.UntypedServiceImplementation>;
}

function errorToServiceError(error: unknown): grpc.ServiceError {
  const e =
    error instanceof StorageS3Error
      ? error
      : new StorageS3Error(
          'STORAGE_VENDOR_NETWORK_ERROR',
          error instanceof Error ? error.message : String(error),
          GrpcStatus.INTERNAL,
          error,
        );
  return {
    name: e.name,
    message: `${e.storageCode}: ${e.message}`,
    code: grpcStatusFor(e.storageCode) as unknown as grpc.status,
    details: `${e.storageCode}: ${e.message}`,
    metadata: new grpc.Metadata(),
  };
}

function makeImplementation(
  module: Partial<Record<StorageRpcName, UnaryHandler>>,
): grpc.UntypedServiceImplementation {
  const implementation: grpc.UntypedServiceImplementation = {};
  for (const rpc of Object.keys(rpcDescriptors) as StorageRpcName[]) {
    implementation[rpc] = async (
      call: grpc.ServerUnaryCall<object, object>,
      callback: grpc.sendUnaryData<object>,
    ): Promise<void> => {
      const handler = module[rpc];
      try {
        if (handler === undefined) throw unimplemented(rpc);
        callback(null, await handler(call.request));
      } catch (error) {
        callback(errorToServiceError(error), null);
      }
    };
  }
  return implementation;
}

export function createStorageGrpcServer(opts: StorageGrpcServerOptions): StorageGrpcServer {
  const server = new grpc.Server();
  server.addService(createServiceDefinition(), makeImplementation(opts.module));
  const host = opts.host ?? '0.0.0.0';
  const port = opts.port ?? 50051;
  const credentials = opts.serverCredentials ?? grpc.ServerCredentials.createInsecure();
  return {
    server,
    listen(): Promise<{ port: number }> {
      return new Promise((resolve, reject) => {
        server.bindAsync(`${host}:${port}`, credentials, (error, boundPort) => {
          if (error !== null) return reject(error);
          resolve({ port: boundPort });
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve) => server.tryShutdown(() => resolve()));
    },
  };
}
