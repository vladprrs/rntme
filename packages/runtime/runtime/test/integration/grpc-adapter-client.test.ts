import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GrpcAdapterClient } from '../../src/plugins/adapter-client/grpc-adapter-client.js';
import { ProtoRegistry } from '../../src/plugins/adapter-client/proto-registry.js';
import { DEFAULT_RETRY } from '../../src/plugins/adapter-client/types.js';

const ECHO_PROTO = `
syntax = "proto3";
package rntme.echo.v1;
message EchoRequest { string message = 1; }
message EchoResponse { string message = 1; }
service EchoService {
  rpc Echo (EchoRequest) returns (EchoResponse);
  rpc Fail (EchoRequest) returns (EchoResponse);
}
`;

function buildDescriptors(proto: string): Record<string, grpc.MethodDefinition<object, object>> {
  const parsed = protobuf.parse(proto, { keepCase: true });
  const root = parsed.root;
  const pkg = parsed.package ?? '';
  const pkgPrefix = pkg.length > 0 ? `${pkg}.` : '';

  let service: protobuf.Service | null = null;
  const walk = (obj: protobuf.ReflectionObject): void => {
    if (obj instanceof protobuf.Service && service === null) {
      service = obj;
      return;
    }
    if (obj instanceof protobuf.Namespace) {
      for (const child of Object.values(obj.nested ?? {})) walk(child);
    }
  };
  for (const child of Object.values(root.nested ?? {})) walk(child);
  if (service === null) throw new Error('no service');

  const methods: Record<string, grpc.MethodDefinition<object, object>> = {};
  for (const [methodName, method] of Object.entries((service as protobuf.Service).methods)) {
    const req = root.lookupType(method.requestType);
    const res = root.lookupType(method.responseType);
    methods[methodName] = {
      path: `/${pkgPrefix}${(service as protobuf.Service).name}/${methodName}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (v: object): Buffer => Buffer.from(req.encode(req.fromObject(v)).finish()),
      requestDeserialize: (b: Buffer): object => req.toObject(req.decode(b)),
      responseSerialize: (v: object): Buffer => Buffer.from(res.encode(res.fromObject(v)).finish()),
      responseDeserialize: (b: Buffer): object => res.toObject(res.decode(b)),
    };
  }
  return methods;
}

async function startEchoServer(port: number): Promise<grpc.Server> {
  const descriptors = buildDescriptors(ECHO_PROTO);
  const server = new grpc.Server();
  server.addService(
    descriptors as unknown as grpc.ServiceDefinition,
    {
      Echo: (_call: grpc.ServerUnaryCall<object, object>, cb: grpc.sendUnaryData<object>) => {
        cb(null, { message: 'echoed' });
      },
      Fail: (_call: grpc.ServerUnaryCall<object, object>, cb: grpc.sendUnaryData<object>) => {
        cb({ code: grpc.status.INTERNAL, message: 'boom' } as grpc.ServiceError, null);
      },
    },
  );
  await new Promise<void>((resolve, reject) => {
    server.bindAsync(`127.0.0.1:${port}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  server.start();
  return server;
}

describe('GrpcAdapterClient integration', () => {
  const port = 19999;
  let server: grpc.Server;
  let client: GrpcAdapterClient;

  beforeAll(async () => {
    server = await startEchoServer(port);
    const dir = mkdtempSync(join(tmpdir(), 'rntme-grpc-test-'));
    const protoPath = join(dir, 'echo.proto');
    writeFileSync(protoPath, ECHO_PROTO);
    const registry = new ProtoRegistry();
    registry.registerModule('echo', protoPath);
    client = new GrpcAdapterClient({
      modules: { echo: { address: `127.0.0.1:${port}`, protoPath } },
      registry,
    });
  });

  afterAll(() => {
    server.forceShutdown();
  });

  it('calls Echo and returns value', async () => {
    const res = await client.call('echo', 'Echo', { message: 'hi' }, {
      idempotencyKey: 'ik-1',
      timeoutMs: 2000,
      retry: DEFAULT_RETRY,
    });
    expect(res.ok).toBe(true);
    expect((res as { ok: true; value: unknown }).value).toEqual({ message: 'echoed' });
  });

  it('uses explicit TLS channel credentials instead of the insecure fallback', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-grpc-test-creds-'));
    const protoPath = join(dir, 'echo.proto');
    writeFileSync(protoPath, ECHO_PROTO);
    const registry = new ProtoRegistry();
    registry.registerModule('echo', protoPath);
    const credentials = grpc.credentials.createSsl();
    const explicitClient = new GrpcAdapterClient({
      modules: { echo: { address: `127.0.0.1:${port}`, protoPath, credentials } },
      registry,
    });

    const res = await explicitClient.call('echo', 'Echo', { message: 'hi' }, {
      idempotencyKey: 'ik-creds',
      timeoutMs: 500,
      retry: DEFAULT_RETRY,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]?.code).toBe('EXTERNAL_MODULE_UNAVAILABLE');
  });

  it('maps Fail to EXTERNAL_MODULE_INTERNAL', async () => {
    const res = await client.call('echo', 'Fail', { message: 'x' }, {
      idempotencyKey: 'ik-2',
      timeoutMs: 2000,
      retry: DEFAULT_RETRY,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0]!.code).toBe('EXTERNAL_MODULE_INTERNAL');
      expect(res.errors[0]!.httpStatus).toBe(502);
    }
  });

  it('returns EXTERNAL_MODULE_NOT_CONFIGURED for unknown module', async () => {
    const res = await client.call('unknown', 'Echo', {}, {
      idempotencyKey: 'ik-3',
      timeoutMs: 2000,
      retry: DEFAULT_RETRY,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0]!.code).toBe('EXTERNAL_MODULE_NOT_CONFIGURED');
      expect(res.errors[0]!.httpStatus).toBe(500);
    }
  });
});
