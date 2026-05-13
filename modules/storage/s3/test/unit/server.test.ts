import { describe, expect, it } from 'bun:test';
import * as grpc from '@grpc/grpc-js';
import { proto } from '@rntme/contracts-storage-v1';
import { createStorageGrpcServer } from '../../src/server.js';

const storageV1 = proto.rntme.contracts.storage.v1;

describe('createStorageGrpcServer', () => {
  it('decodes int64 request fields to numbers for handler/database safety', async () => {
    let received: Record<string, unknown> = {};
    const server = createStorageGrpcServer({
      port: 0,
      host: '127.0.0.1',
      module: {
        PrepareUpload: async (request) => {
          received = request as Record<string, unknown>;
          return {
            file_id: 'file_123',
            object_key: 'resume-file/entity/file_123',
            presigned: {
              url: 'https://files.example/upload',
              headers: {},
              expires_at: { seconds: 1, nanos: 0 },
            },
          };
        },
      },
    });

    const { port } = await server.listen();
    try {
      const client = new StorageClient(
        `127.0.0.1:${port}`,
        grpc.credentials.createInsecure(),
      ) as unknown as StorageClientInstance;
      await prepareUpload(client, {
        context: { idempotency_key: 'k', correlation_id: 'c' },
        route_id: 'resume-file',
        entity_id: 'entity',
        filename: 'sample.pdf',
        content_type: 'application/pdf',
        declared_size: 123,
      });
    } finally {
      await server.stop();
    }

    expect(typeof received.declared_size).toBe('number');
    expect(received.declared_size).toBe(123);
  });
});

const serviceDefinition = {
  PrepareUpload: {
    path: '/rntme.contracts.storage.v1.StorageModule/PrepareUpload',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: object) =>
      Buffer.from(storageV1.PrepareUploadRequest.encode(
        storageV1.PrepareUploadRequest.fromObject(value),
      ).finish()),
    requestDeserialize: (bytes: Buffer) =>
      storageV1.PrepareUploadRequest.toObject(storageV1.PrepareUploadRequest.decode(bytes), {
        defaults: true,
      }),
    responseSerialize: (value: object) =>
      Buffer.from(storageV1.PrepareUploadResponse.encode(
        storageV1.PrepareUploadResponse.fromObject(value),
      ).finish()),
    responseDeserialize: (bytes: Buffer) =>
      storageV1.PrepareUploadResponse.toObject(storageV1.PrepareUploadResponse.decode(bytes), {
        defaults: true,
      }),
  },
} satisfies grpc.ServiceDefinition<grpc.UntypedServiceImplementation>;

const StorageClient = grpc.makeGenericClientConstructor(serviceDefinition, 'StorageModule');

type StorageClientInstance = grpc.Client & {
  PrepareUpload(
    request: object,
    callback: (error: grpc.ServiceError | null, response: object) => void,
  ): void;
};

function prepareUpload(client: StorageClientInstance, request: object): Promise<object> {
  return new Promise((resolve, reject) => {
    client.PrepareUpload(request, (error, response) => {
      if (error !== null) reject(error);
      else resolve(response);
    });
  });
}
