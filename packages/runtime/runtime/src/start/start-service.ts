import { serve, type ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BetterSqliteDriver } from '../plugins/better-sqlite-driver.js';
import { InMemoryBus } from '../plugins/in-memory-bus.js';
import { HttpSurface } from '../plugins/http-surface.js';
import {
  createMetrics,
  type HealthProbe,
} from '../plugins/observability.js';
import type {
  DbDriver,
  EventBus,
} from '../plugins/interfaces.js';
import { CodeCommandExecutor } from '../plugins/executors/code-command-executor.js';
import { CompositeCommandExecutor } from '../plugins/executors/composite-command-executor.js';
import { GraphIrCommandExecutor } from '../plugins/executors/graph-ir-command-executor.js';
import { GraphIrQueryExecutor } from '../plugins/executors/graph-ir-query-executor.js';
import { buildDefaultGraphIrCommandMap, buildDefaultGraphIrQueryMap } from '@rntme/bindings-http';
import type { RunningService, ValidatedService } from '../types.js';
import type { CommandExecutor, ServiceLocalCodeCommandHandlerMap } from '../plugins/executors/types.js';
import { applySeed } from '@rntme/seed';
import { defaultTopicOf } from '@rntme/event-store';
import { wireEventPipeline } from './wire-event-pipeline.js';
import { buildActorFromRequest } from './build-actor-from-request.js';
import { startSeenEventsRetention } from '../projections/seen-events-retention.js';
import { buildAdapterClient } from './build-adapter-client.js';
import type { ExternalAdapterClient } from '../plugins/adapter-client/index.js';
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

export type { RuntimeConfig } from './runtime-config.js';

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5000;

export async function startService(
  service: ValidatedService,
  config: Partial<RuntimeConfig> = {},
): Promise<RunningService> {
  const runtimeConfig = assertValidRuntimeConfig(config);
  const runtimeEnv = runtimeConfig.runtimeEnv ?? process.env;
  const authEnv = parseRuntimeAuthEnv(runtimeEnv);
  const eventBusTopicPrefix = parseRuntimeEventBusTopicPrefixFromEnv(runtimeEnv);
  const adapter =
    runtimeConfig.externalAdapterClient
    ?? buildRuntimeAdapterClient(service.manifest, runtimeConfig.artifactDir, authEnv);
  const db: DbDriver = runtimeConfig.db ?? new BetterSqliteDriver();
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
        // Second boot with persistent store: strict mode skips when log already has events.
      } else {
        await pipeline.stop();
        if (bus.stop) await bus.stop();
        throw err;
      }
    }
  }

  pipeline.start();

  const defaultCommandMapResult = buildDefaultGraphIrCommandMap(
    service.bindings,
    service.graphSpec,
    service.pdm,
    service.qsm,
  );
  if (!defaultCommandMapResult.ok) {
    await pipeline.stop();
    if (bus.stop) await bus.stop();
    throw new Error(
      `Failed to compile command bindings: ${JSON.stringify(defaultCommandMapResult.errors)}`,
    );
  }
  const defaultQueryMapResult = buildDefaultGraphIrQueryMap(
    service.bindings,
    service.graphSpec,
    service.pdm,
    service.qsm,
  );
  if (!defaultQueryMapResult.ok) {
    await pipeline.stop();
    if (bus.stop) await bus.stop();
    throw new Error(
      `Failed to compile query bindings: ${JSON.stringify(defaultQueryMapResult.errors)}`,
    );
  }
  const graphCommandExecutor = new GraphIrCommandExecutor(defaultCommandMapResult.value);
  let commandExecutor: CommandExecutor;
  try {
    commandExecutor =
      runtimeConfig.commandExecutor ??
      await buildConfiguredCommandExecutor(service, graphCommandExecutor);
  } catch (err) {
    await pipeline.stop();
    if (bus.stop) await bus.stop();
    throw err;
  }
  const queryExecutor =
    runtimeConfig.queryExecutor ?? new GraphIrQueryExecutor(defaultQueryMapResult.value);

  // Periodic sweep of the derived-projection idempotency side-table. Started
  // AFTER `wireEventPipeline` has created the `seen_events` table via
  // `bootstrapProjections`. The disposer is invoked from `RunningService.stop`.
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
        commandExecutor,
        queryExecutor,
        externalAdapterClient: adapter ?? undefined,
      }),
    ];

  const app = new Hono();
  const ctx = {
    service,
    eventStore: pipeline.eventStore,
    qsmDb: pipeline.qsmDb,
    actorFromRequest,
  };
  for (const s of surfaces) await s.mount(app, ctx);

  const listenPort = service.manifest.surface.http.port;
  const server: ServerType = await new Promise((resolve) => {
    const s = serve({ fetch: app.fetch, port: listenPort }, () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : listenPort;

  const grpcSurface = buildGrpcSurface(service.manifest, {
    commandExecutor,
    queryExecutor,
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
    return artifactDir !== undefined ? buildAdapterClient(manifest, artifactDir) : null;
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

async function buildConfiguredCommandExecutor(
  service: ValidatedService,
  graphExecutor: CommandExecutor,
): Promise<CommandExecutor> {
  const handlersModule = service.manifest.commands?.handlersModule;
  if (handlersModule === undefined) return graphExecutor;

  const handlers = await importCommandHandlers(service.artifactDir, handlersModule);
  return new CompositeCommandExecutor(new CodeCommandExecutor(handlers), graphExecutor);
}

async function importCommandHandlers(
  artifactDir: string,
  modulePath: string,
): Promise<ServiceLocalCodeCommandHandlerMap> {
  const root = resolve(artifactDir);
  const absoluteModulePath = resolve(root, modulePath);
  if (absoluteModulePath !== root && !absoluteModulePath.startsWith(`${root}${sep}`)) {
    throw new Error(`commands.handlersModule escapes artifact directory: ${modulePath}`);
  }

  const mod = await import(pathToFileURL(absoluteModulePath).href) as {
    handlers?: unknown;
    default?: unknown;
  };
  const handlers = mod.handlers ?? mod.default;
  if (!isCodeCommandHandlerMap(handlers)) {
    throw new Error('commands.handlersModule must export a handler map as "handlers" or default');
  }
  return handlers;
}

function isCodeCommandHandlerMap(value: unknown): value is ServiceLocalCodeCommandHandlerMap {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((handler) => typeof handler === 'function');
}
