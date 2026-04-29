import { serve, type ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ActorRef } from '@rntme/event-store';
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
  Surface,
} from '../plugins/interfaces.js';
import type { CommandExecutor, QueryExecutor } from '../plugins/executors/types.js';
import { GraphIrCommandExecutor } from '../plugins/executors/graph-ir-command-executor.js';
import { GraphIrQueryExecutor } from '../plugins/executors/graph-ir-query-executor.js';
import { buildDefaultGraphIrCommandMap, buildDefaultGraphIrQueryMap } from '@rntme/bindings-http';
import type { RunningService, ValidatedService } from '../types.js';
import { applySeed, type ApplyMode } from '@rntme/seed';
import { wireEventPipeline } from './wire-event-pipeline.js';
import { buildActorFromRequest } from './build-actor-from-request.js';
import { startSeenEventsRetention } from '../projections/seen-events-retention.js';
import { buildAdapterClient } from './build-adapter-client.js';
import type { ExternalAdapterClient } from '../plugins/adapter-client/index.js';
import { buildGrpcSurface, collectShapesFromService } from './build-grpc-surface.js';
import {
  buildKafkaJsClientConfigFromEnv,
  parseRuntimeAuthEnv,
  RuntimeBootError,
} from './runtime-env.js';
import { KafkaJsEventBus } from '../plugins/kafka-js-bus.js';

export type RuntimeConfig = {
  db?: DbDriver;
  bus?: EventBus;
  surfaces?: Surface[];
  actorFromRequest?: (c: Context) => ActorRef | null;
  onReady?: (info: { port: number }) => void;
  seedMode?: ApplyMode;
  skipSeed?: boolean;
  commandExecutor?: CommandExecutor;
  queryExecutor?: QueryExecutor;
  externalAdapterClient?: ExternalAdapterClient;
  artifactDir?: string;
  runtimeEnv?: Record<string, string | undefined>;
};

export async function startService(
  service: ValidatedService,
  config: Partial<RuntimeConfig> = {},
): Promise<RunningService> {
  const runtimeEnv = config.runtimeEnv ?? process.env;
  const authEnv = parseRuntimeAuthEnv(runtimeEnv);
  const adapter =
    config.externalAdapterClient
    ?? buildRuntimeAdapterClient(service.manifest, config.artifactDir, authEnv);
  const db: DbDriver = config.db ?? new BetterSqliteDriver();
  const kafkaClientConfig = buildKafkaJsClientConfigFromEnv(
    runtimeEnv,
    service.manifest.service.name,
  );
  const bus: EventBus =
    config.bus ?? (kafkaClientConfig === null ? new InMemoryBus() : new KafkaJsEventBus(kafkaClientConfig));
  const actorFromRequest =
    config.actorFromRequest ?? buildActorFromRequest(service.manifest);

  if (bus.start) await bus.start();

  const pipeline = wireEventPipeline(service, db, bus);

  if (service.seed !== null && !config.skipSeed) {
    try {
      await applySeed(service.seed, pipeline.eventStore, {
        mode: config.seedMode ?? 'strict',
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
  const commandExecutor =
    config.commandExecutor ?? new GraphIrCommandExecutor(defaultCommandMapResult.value);
  const queryExecutor =
    config.queryExecutor ?? new GraphIrQueryExecutor(defaultQueryMapResult.value);

  // Periodic sweep of the derived-projection idempotency side-table. Started
  // AFTER `wireEventPipeline` has created the `seen_events` table via
  // `bootstrapProjections`. The disposer is invoked from `RunningService.stop`.
  const stopSeenEventsRetention = startSeenEventsRetention(pipeline.qsmDb);

  const metrics = createMetrics(service.manifest.service.name);
  let healthy = true;
  const probe: HealthProbe = () =>
    healthy ? { ok: true } : { ok: false, reason: 'pipeline stopped' };

  const surfaces =
    config.surfaces ??
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

  config.onReady?.({ port });

  return {
    httpPort: port,
    grpcPort,
    async stop(): Promise<void> {
      healthy = false;
      stopSeenEventsRetention();
      await new Promise<void>((resolve, reject) =>
        server.close((err?: Error) => (err !== undefined && err !== null ? reject(err) : resolve())),
      );
      if (grpcStopper !== null) await grpcStopper();
      await pipeline.stop();
      if (bus.stop) await bus.stop();
    },
  };
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
