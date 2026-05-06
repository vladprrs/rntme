import { describe, it, expect, afterEach } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ReadableStream } from 'node:stream/web';
import { TextEncoder } from 'node:util';
import type { KafkaMessage, KafkaProducer } from '@rntme/event-store';
import type { KafkaBatch, KafkaConsumer } from '@rntme/projection-consumer';
import { loadService } from '../../src/load/load-service.js';
import { startService } from '../../src/start/start-service.js';
import type { EventBus } from '../../src/plugins/interfaces.js';
import type { RunningService, ValidatedService } from '../../src/types.js';
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

  it('serves the UI shell at / and exposes OpenAPI + service identity', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);
    const root = await fetch(`http://127.0.0.1:${running.httpPort}/`);
    expect(root.status).toBe(200);
    expect(root.headers.get('content-type')).toContain('text/html');
    expect(await root.text()).toContain('<div id="root">');
    const service = await (await fetch(`http://127.0.0.1:${running.httpPort}/service.json`)).json();
    expect((service as { name: string }).name).toBe('issue-tracker-api');
    const openapi = await (await fetch(`http://127.0.0.1:${running.httpPort}/api/openapi.json`)).json();
    expect((openapi as { openapi: string }).openapi).toBe('3.1.0');
  });

  it('rejects oversized /api request bodies with 413', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    loaded.value.manifest.surface.http.bodyLimit = { enabled: true, maxBytes: 8 };
    running = await startService(loaded.value);

    const res = await fetch(`http://127.0.0.1:${running.httpPort}/api/v1/issues`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'this body is too large' }),
    });

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'REQUEST_BODY_TOO_LARGE', maxBytes: 8 });
  });

  it('rejects oversized streamed /api request bodies without content-length', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    loaded.value.manifest.surface.http.bodyLimit = { enabled: true, maxBytes: 8 };
    running = await startService(loaded.value);

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ title: 'stream body is too large' })));
        controller.close();
      },
    });

    const res = await fetch(`http://127.0.0.1:${running.httpPort}/api/v1/issues`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      duplex: 'half',
    } as Parameters<typeof fetch>[1] & { duplex: 'half' });

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'REQUEST_BODY_TOO_LARGE', maxBytes: 8 });
  });

  it('rate limits /api requests with 429 and limit headers', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    loaded.value.manifest.surface.http.rateLimit = { enabled: true, windowMs: 60_000, max: 1 };
    running = await startService(loaded.value);

    const first = await fetch(`http://127.0.0.1:${running.httpPort}/api/openapi.json`);
    const second = await fetch(`http://127.0.0.1:${running.httpPort}/api/openapi.json`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBe('60');
    expect(second.headers.get('x-ratelimit-limit')).toBe('1');
    expect(second.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('does not trust forwarded client IP headers for /api rate limit keys', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    loaded.value.manifest.surface.http.rateLimit = { enabled: true, windowMs: 60_000, max: 1 };
    running = await startService(loaded.value);

    const first = await fetch(`http://127.0.0.1:${running.httpPort}/api/openapi.json`, {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });
    const second = await fetch(`http://127.0.0.1:${running.httpPort}/api/openapi.json`, {
      headers: { 'x-forwarded-for': '203.0.113.11' },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
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

  it('loads service-local code command handlers before falling back to Graph IR for gRPC commands', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-runtime-handlers-'));
    cpSync(fixtureDir, dir, { recursive: true });
    try {
      mkdirSync(join(dir, 'commands'), { recursive: true });
      writeFileSync(
        join(dir, 'commands', 'handlers.mjs'),
        [
          'export const handlers = {',
          '  assignIssue: async (_ctx, input) => ({',
          '    ok: true,',
          '    value: {',
          '      aggregateId: `code-handler-${input.issueId}`,',
          '      version: 42,',
          '      eventIds: ["code-event-id"],',
          '      commandId: "code-command-id",',
          '      correlationId: "code-correlation-id"',
          '    }',
          '  })',
          '};',
          '',
        ].join('\n'),
      );

      const manifestPath = join(dir, 'manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      manifest.surface = {
        ...((manifest.surface as Record<string, unknown> | undefined) ?? {}),
        grpc: { enabled: true, port: 0 },
      };
      manifest.commands = { handlersModule: 'commands/handlers.mjs' };
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const loaded = loadService(dir);
      if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
      running = await startService(loaded.value, { bus: new CapturingEventBus() });

      if (!running.grpcPort) throw new Error('grpc port missing');
      const client = createIssueTrackerGrpcClient(loaded.value, running.grpcPort) as unknown as {
        AssignIssue: (arg: object, cb: (err: grpc.ServiceError | null, res: object) => void) => void;
        ReportIssue: (arg: object, cb: (err: grpc.ServiceError | null, res: object) => void) => void;
      };

      const handled = await callGrpc<Record<string, unknown>>(client.AssignIssue.bind(client), {
        issue_id: 7001,
        assignee_id: 11,
      });
      expect(handled).toMatchObject({
        aggregate_id: 'code-handler-7001',
        event_ids: ['code-event-id'],
        command_id: 'code-command-id',
        correlation_id: 'code-correlation-id',
      });
      expect(String(handled.version)).toBe('42');

      const fallback = await callGrpc<Record<string, unknown>>(client.ReportIssue.bind(client), {
        issue_id: 7002,
        title: 'graph fallback still works',
        project_id: 1,
        reporter_id: 1,
        priority: 'high',
        story_points: 3,
      });
      expect(fallback.aggregate_id).toBe('7002');
      expect(fallback.command_id).not.toBe('code-command-id');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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

  it('fails boot when auth provider env is set without a module endpoint', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

    await expect(
      startService(loaded.value, {
        runtimeEnv: {
          RNTME_AUTH_PROVIDER: 'auth0',
          RNTME_AUTH_AUDIENCE: 'https://notes.example.com/api',
          RNTME_AUTH_MODULE_SLUG: 'identity-auth0',
        },
      }),
    ).rejects.toMatchObject({ code: 'RUNTIME_BOOT_AUTH_ENDPOINT_MISSING' });
  });

  it('rejects invalid RuntimeConfig before booting resources', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

    await expect(
      startService(loaded.value, { bus: {} as EventBus }),
    ).rejects.toMatchObject({
      code: 'RUNTIME_CONFIG_INVALID',
      errors: [
        expect.objectContaining({
          code: 'RUNTIME_CONFIG_EVENT_BUS_INVALID',
          path: 'bus',
        }),
      ],
    });
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

  it('applies RNTME_EVENT_BUS_TOPIC_PREFIX to relay topics and projection subscriptions', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const bus = new CapturingEventBus();
    running = await startService(loaded.value, {
      bus,
      runtimeEnv: { RNTME_EVENT_BUS_TOPIC_PREFIX: 'rntme.rnt364.smoke' },
    });
    const base = `http://127.0.0.1:${running.httpPort}`;

    const create = await fetch(`${base}/api/v1/issues`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-actor-id': 'alice',
      },
      body: JSON.stringify({
        issueId: 9201,
        title: 'event bus prefix',
        projectId: 1,
        reporterId: 1,
        priority: 'high',
        storyPoints: 1,
      }),
    });
    expect(create.status).toBe(200);

    const deadline = Date.now() + 1000;
    while (bus.sent.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(bus.sent.map((message) => message.topic)).toEqual([
      'rntme.rnt364.smoke.issue-tracker-api.issue',
    ]);
    expect(bus.consumerTopics).toEqual(['rntme.rnt364.smoke.issue-tracker-api.*']);
    expect(bus.ensuredTopics).toEqual([
      'rntme.rnt364.smoke.issue-tracker-api.issue',
      'rntme.rnt364.smoke.issue-tracker-api.project',
      'rntme.rnt364.smoke.issue-tracker-api.user',
    ]);
  });
});

class CapturingEventBus implements EventBus {
  readonly sent: KafkaMessage[] = [];
  readonly consumerTopics: string[] = [];
  readonly ensuredTopics: string[] = [];

  async ensureTopics(topics: readonly string[]): Promise<void> {
    this.ensuredTopics.push(...topics);
  }

  producer(): KafkaProducer {
    return {
      send: async (message): Promise<void> => {
        this.sent.push(message);
      },
    };
  }

  consumer(opts: { groupId: string; topic: string }): KafkaConsumer {
    this.consumerTopics.push(opts.topic);
    return {
      stop(): void {},
      async commitOffsets(_batch: KafkaBatch): Promise<void> {},
      async *[Symbol.asyncIterator](): AsyncIterator<KafkaBatch> {},
    };
  }
}

function loadProto(src: string, serviceName: string): { root: protobuf.Root; service: protobuf.Service } {
  const { root } = protobuf.parse(src, { keepCase: true });
  return { root, service: root.lookupService(serviceName) };
}

function createIssueTrackerGrpcClient(service: ValidatedService, port: number): grpc.Client {
  const packageName = 'rntme.issue_tracker_api.v1';
  const serviceName = 'IssueTrackerApiService';
  const protoSource = emitProto(service.bindings, collectShapesFromService(service), {
    packageName,
    serviceName,
  });
  const { root, service: grpcService } = loadProto(protoSource, `${packageName}.${serviceName}`);
  const ClientCtor = grpc.makeGenericClientConstructor(
    toServiceDef(root, grpcService),
    serviceName,
    {},
  );
  return new ClientCtor(`127.0.0.1:${port}`, grpc.credentials.createInsecure());
}

function callGrpc<T>(
  fn: (arg: object, cb: (err: grpc.ServiceError | null, res: object) => void) => void,
  arg: object,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    fn(arg, (err, res) => {
      if (err !== null) reject(err);
      else resolve(res as T);
    });
  });
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
