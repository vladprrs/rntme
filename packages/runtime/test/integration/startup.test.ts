import { describe, it, expect, afterEach } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';
import { startService } from '../../src/start/start-service.js';
import type { RunningService } from '../../src/types.js';
import { emitProto } from '@rntme/bindings-grpc';
import { collectShapesFromService } from '../../src/start/build-grpc-surface.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'issue-tracker');

let running: RunningService | null = null;

afterEach(async () => {
  if (running) await running.stop();
  running = null;
});

describe('startService', () => {
  it('boots the service and serves /health', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value, {
      onReady: () => undefined,
    });
    const res = await fetch(`http://127.0.0.1:${running.httpPort}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('exposes OpenAPI + service identity', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);
    const root = await (await fetch(`http://127.0.0.1:${running.httpPort}/`)).json();
    expect((root as { name: string }).name).toBe('issue-tracker-api');
    const openapi = await (await fetch(`http://127.0.0.1:${running.httpPort}/api/openapi.json`)).json();
    expect((openapi as { openapi: string }).openapi).toBe('3.1.0');
  });

  it('rejects oversized /api request bodies with 413', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    (loaded.value.manifest.surface.http as any).bodyLimit = { enabled: true, maxBytes: 8 };
    running = await startService(loaded.value);

    const res = await fetch(`http://127.0.0.1:${running.httpPort}/api/v1/issues`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'this body is too large' }),
    });

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'REQUEST_BODY_TOO_LARGE', maxBytes: 8 });
  });

  it('rate limits /api requests with 429 and limit headers', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    (loaded.value.manifest.surface.http as any).rateLimit = { enabled: true, windowMs: 60_000, max: 1 };
    running = await startService(loaded.value);

    const first = await fetch(`http://127.0.0.1:${running.httpPort}/api/openapi.json`);
    const second = await fetch(`http://127.0.0.1:${running.httpPort}/api/openapi.json`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBe('60');
    expect(second.headers.get('x-ratelimit-limit')).toBe('1');
    expect(second.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('wires a compiled query map through the default GraphIrQueryExecutor for gRPC', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    loaded.value.manifest.surface = {
      ...(loaded.value.manifest.surface ?? {}),
      grpc: { enabled: true, port: 0 },
    };
    running = await startService(loaded.value);

    if (!running.grpcPort) throw new Error('grpc port missing');

    const packageName = 'rntme.issue_tracker_api.v1';
    const serviceName = 'IssueTrackerApiService';
    const protoSource = emitProto(loaded.value.bindings, collectShapesFromService(loaded.value), {
      packageName,
      serviceName,
    });

    const { root, service } = loadProto(protoSource, `${packageName}.${serviceName}`);
    const ClientCtor = grpc.makeGenericClientConstructor(
      toServiceDef(root, service),
      serviceName,
      {},
    );
    const client = new ClientCtor(`127.0.0.1:${running.grpcPort}`, grpc.credentials.createInsecure()) as unknown as {
      ListIssues: (arg: object, cb: (err: grpc.ServiceError | null, res: object) => void) => void;
    };
    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
      client.ListIssues({}, (err, res) => {
        if (err !== null) reject(err);
        else resolve(res as Record<string, unknown>);
      });
    });

    expect(response).not.toMatchObject({ code: 'QUERY_NOT_FOUND' });
    expect(typeof response).toBe('object');
    expect(response).not.toBeNull();
  });

  it('wires GrpcAdapterClient when manifest.modules[] is non-empty', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value, {
      artifactDir: fixtureDir,
      onReady: () => undefined,
    });
    const res = await fetch(`http://127.0.0.1:${running.httpPort}/health`);
    expect(res.status).toBe(200);
  });

  it('boots a GrpcSurface alongside HttpSurface when manifest.surface.grpc.enabled', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    loaded.value.manifest.surface = {
      ...(loaded.value.manifest.surface ?? {}),
      grpc: { enabled: true, port: 0 },
    };
    running = await startService(loaded.value);
    expect(running.httpPort).toBeGreaterThan(0);
    expect(running.grpcPort).toBeGreaterThan(0);
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
