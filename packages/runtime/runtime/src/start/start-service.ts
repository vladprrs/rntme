import {
  serve,
  type Http2Bindings,
  type HttpBindings,
  type ServerType,
} from '@hono/node-server';
import { Hono } from 'hono';
import { Socket } from 'node:net';
import { BunSqliteDriver } from '../plugins/bun-sqlite-driver.js';
import { InMemoryBus } from '../plugins/in-memory-bus.js';
import { HttpSurface } from '../plugins/http-surface.js';
import {
  createMetrics,
  type HealthProbe,
} from '../plugins/observability.js';
import type {
  DbDriver,
  EventBus,
  ExternalAdapterClient,
} from '../plugins/interfaces.js';
import { GraphOperationExecutor } from '../plugins/executors/graph-operation-executor.js';
import { NativeOperationExecutor } from '../plugins/executors/native-operation-executor.js';
import { buildDefaultGraphIrOperationMap } from '@rntme/bindings-http';
import type { OperationRegistry, OperationTarget } from '@rntme/graph-ir-compiler';
import type { RunningService, ValidatedService } from '../types.js';
import { applySeed } from '@rntme/seed';
import { defaultTopicOf } from '@rntme/event-store';
import { wireEventPipeline } from './wire-event-pipeline.js';
import { buildActorFromRequest } from './build-actor-from-request.js';
import { startSeenEventsRetention } from '../projections/seen-events-retention.js';
import { buildAdapterClient } from './build-adapter-client.js';
import { buildGrpcSurface, collectShapesFromService } from './build-grpc-surface.js';
import {
  buildKafkaJsClientConfigFromEnv,
  parseRuntimeEventBusTopicPrefixFromEnv,
  parseRuntimeAuthEnv,
  RuntimeBootError,
} from './runtime-env.js';
import { KafkaJsEventBus } from '../plugins/kafka-js-bus.js';
import {
  assertValidRuntimeConfig,
  type RuntimeConfig,
} from './runtime-config.js';
import { runtimeModuleOperationEffect } from './runtime-module-operations.js';
import { toOperationCallClient } from './operation-call-client.js';

export type { RuntimeConfig } from './runtime-config.js';

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5000;
type NodeServerEnv = HttpBindings | Http2Bindings;
type NodeServerFetch = (request: Request, env: NodeServerEnv) => Promise<unknown> | unknown;

export async function startService(
  service: ValidatedService,
  config: Partial<RuntimeConfig> = {},
): Promise<RunningService> {
  const runtimeConfig = assertValidRuntimeConfig(config);
  const runtimeEnv = runtimeConfig.runtimeEnv ?? process.env;
  const authEnv = parseRuntimeAuthEnv(runtimeEnv);
  const eventBusTopicPrefix = parseRuntimeEventBusTopicPrefixFromEnv(runtimeEnv);
  const adapterClient =
    runtimeConfig.externalAdapterClient ?? buildRuntimeAdapterClient(service.manifest, runtimeConfig.artifactDir, authEnv);
  const operationRegistry = buildManifestOperationRegistry(service.manifest);
  const operationCallClient = adapterClient === null ? null : toOperationCallClient(adapterClient);
  const db: DbDriver = runtimeConfig.db ?? new BunSqliteDriver();
  const kafkaClientConfig = buildKafkaJsClientConfigFromEnv(
    runtimeEnv,
    service.manifest.service.name,
  );
  const bus: EventBus =
    runtimeConfig.bus ?? (kafkaClientConfig === null ? new InMemoryBus() : new KafkaJsEventBus(kafkaClientConfig));
  const actorFromRequest =
    runtimeConfig.actorFromRequest ?? buildActorFromRequest(service.manifest);

  if (bus.start) await bus.start();
  if (bus.ensureTopics) {
    await bus.ensureTopics(eventTopicsForService(service, eventBusTopicPrefix));
  }

  const pipeline = wireEventPipeline(service, db, bus, {
    topicPrefix: eventBusTopicPrefix,
    ...(runtimeConfig.logger ? { logger: runtimeConfig.logger } : {}),
  });

  if (service.seed !== null && !runtimeConfig.skipSeed) {
    try {
      await applySeed(service.seed, pipeline.eventStore, {
        mode: runtimeConfig.seedMode ?? 'strict',
        serviceName: service.manifest.service.name,
      });
    } catch (err) {
      const code =
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code;
      if (code === 'SEED_STORE_NOT_EMPTY') {
        // strict mode no-op when persistent log already has events
      } else {
        await pipeline.stop();
        if (bus.stop) await bus.stop();
        throw err;
      }
    }
  }

  pipeline.start();

  const defaultOperationMapResult = buildDefaultGraphIrOperationMap(
    service.bindings,
    service.graphSpec,
    service.pdm,
    service.qsm,
    operationRegistry,
  );
  if (!defaultOperationMapResult.ok) {
    await pipeline.stop();
    if (bus.stop) await bus.stop();
    throw new Error(
      `Failed to compile operation bindings: ${JSON.stringify(defaultOperationMapResult.errors)}`,
    );
  }
  const baseOperationExecutor =
    runtimeConfig.operationExecutor ?? new GraphOperationExecutor(defaultOperationMapResult.value);
  const nativeOperationNames = new Set(
    Object.values(service.bindings.resolved)
      .filter((r) => r.entry.target.engine === 'native')
      .map((r) => r.entry.graph),
  );
  const operationExecutor =
    nativeOperationNames.size > 0
      ? new NativeOperationExecutor(
          runtimeConfig.nativeOperationHandlers ?? {},
          baseOperationExecutor,
          nativeOperationNames,
        )
      : baseOperationExecutor;

  // Must run after wireEventPipeline creates the seen_events table.
  const stopSeenEventsRetention = startSeenEventsRetention(pipeline.qsmDb);

  const metrics = createMetrics(service.manifest.service.name);
  let healthy = true;
  const probe: HealthProbe = () =>
    healthy ? { ok: true } : { ok: false, reason: 'pipeline stopped' };

  const surfaces =
    runtimeConfig.surfaces ??
    [
      new HttpSurface({
        healthPath: service.manifest.observability.health.path,
        metricsPath: service.manifest.observability.metrics.path,
        metrics,
        healthProbe: probe,
        operationExecutor,
        ...(runtimeConfig.logger ? { logger: runtimeConfig.logger } : {}),
      }),
    ];

  const app = new Hono();
  const ctx = {
    service,
    eventStore: pipeline.eventStore,
    qsmDb: pipeline.qsmDb,
    actorFromRequest,
    operationRegistry,
    operationCallClient,
  };
  for (const s of surfaces) await s.mount(app, ctx);

  ensureSocketDestroySoonCompatibility();
  const listenPort = service.manifest.surface.http.port;
  const fetchWithSocketCompatibility: NodeServerFetch = (request, env) => {
    ensureIncomingSocketDestroySoonCompatibility(env);
    return app.fetch(request, env);
  };
  const server: ServerType = await new Promise((resolve) => {
    const s = serve({ fetch: fetchWithSocketCompatibility, port: listenPort }, () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : listenPort;

  const grpcSurface = buildGrpcSurface(service.manifest, {
    operationExecutor,
    shapes: collectShapesFromService(service),
  });

  let grpcStopper: (() => Promise<void>) | null = null;
  let grpcPort: number | undefined;
  if (grpcSurface !== null && grpcSurface.listen !== undefined) {
    const { port: gPort, stop } = await grpcSurface.listen(ctx);
    grpcStopper = stop;
    grpcPort = gPort;
  }

  runtimeConfig.onReady?.({ port });

  return {
    httpPort: port,
    grpcPort,
    async stop(): Promise<void> {
      healthy = false;
      stopSeenEventsRetention();
      await closeHttpServer(server, runtimeConfig.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS);
      if (grpcStopper !== null) await grpcStopper();
      await pipeline.stop();
      if (bus.stop) await bus.stop();
    },
  };
}

function ensureSocketDestroySoonCompatibility(): void {
  const socketPrototype = Socket.prototype as Socket & { destroySoon?: Socket['destroy'] };
  socketPrototype.destroySoon ??= socketPrototype.destroy;
}

function ensureIncomingSocketDestroySoonCompatibility(env: NodeServerEnv): void {
  const incoming = env.incoming as {
    socket?: {
      destroy?: () => void;
      destroySoon?: () => void;
    };
  };
  const socket = incoming.socket;
  if (socket === undefined || socket.destroySoon !== undefined || socket.destroy === undefined) return;
  socket.destroySoon = socket.destroy.bind(socket);
}

function eventTopicsForService(
  service: ValidatedService,
  topicPrefix: string | null,
): readonly string[] {
  return [
    ...new Set(
      service.eventTypes.map((eventType) =>
        defaultTopicOf(service.manifest.service.name, eventType.aggregateType, topicPrefix),
      ),
    ),
  ].sort();
}

type ForceClosableServer = ServerType & {
  closeIdleConnections?: () => void;
  closeAllConnections?: () => void;
};

function closeHttpServer(server: ServerType, timeoutMs: number): Promise<void> {
  const forceClosable = server as ForceClosableServer;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  return new Promise<void>((resolve, reject) => {
    const settle = (err?: Error): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) globalThis.clearTimeout(timer);
      if (err !== undefined) reject(err);
      else resolve();
    };

    timer = globalThis.setTimeout(() => {
      try {
        forceClosable.closeAllConnections?.();
        settle();
      } catch (err) {
        settle(err instanceof Error ? err : new Error(String(err)));
      }
    }, timeoutMs);
    timer.unref?.();

    try {
      server.close((err?: Error) => settle(err ?? undefined));
      forceClosable.closeIdleConnections?.();
    } catch (err) {
      settle(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function buildRuntimeAdapterClient(
  manifest: ValidatedService['manifest'],
  artifactDir: string | undefined,
  authEnv: ReturnType<typeof parseRuntimeAuthEnv>,
): ExternalAdapterClient | null {
  if (authEnv === null) {
    return artifactDir === undefined ? null : buildAdapterClient(manifest, artifactDir);
  }

  if (artifactDir === undefined) {
    throw new RuntimeBootError(
      'RUNTIME_BOOT_AUTH_ARTIFACT_DIR_MISSING',
      'artifactDir is required when RNTME_AUTH_PROVIDER is set',
    );
  }
  if (!manifest.modules.some((module) => module.name === authEnv.moduleSlug)) {
    throw new RuntimeBootError(
      'RUNTIME_BOOT_AUTH_MODULE_MISSING',
      `auth module "${authEnv.moduleSlug}" is not declared in manifest.modules`,
    );
  }
  return buildAdapterClient(manifest, artifactDir, {
    [authEnv.moduleSlug]: authEnv.moduleEndpoint,
  });
}

function buildManifestOperationRegistry(manifest: ValidatedService['manifest']): OperationRegistry {
  const moduleNames = new Set(manifest.modules.map((module) => module.name));
  return {
    resolve(target: OperationTarget) {
      if (!('module' in target) || !moduleNames.has(target.module)) return null;
      const effect = runtimeModuleOperationEffect(target.module, target.operation);
      if (effect === null) return null;
      return {
        id: `${target.module}.${target.operation}`,
        target,
        effect,
        idempotency: effect === 'action' ? 'optional' : 'none',
        inputShape: `${target.operation}Request`,
        outputShape: `${target.operation}Response`,
      };
    },
  };
}
