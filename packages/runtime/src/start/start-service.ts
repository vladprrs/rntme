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
import type { RunningService, ValidatedService } from '../types.js';
import { applySeed, type ApplyMode } from '@rntme/seed';
import { wireEventPipeline } from './wire-event-pipeline.js';
import { buildActorFromRequest } from './build-actor-from-request.js';
import { startSeenEventsRetention } from '../projections/seen-events-retention.js';

export type RuntimeConfig = {
  db?: DbDriver;
  bus?: EventBus;
  surfaces?: Surface[];
  actorFromRequest?: (c: Context) => ActorRef | null;
  onReady?: (info: { port: number }) => void;
  seedMode?: ApplyMode;
  skipSeed?: boolean;
};

export async function startService(
  service: ValidatedService,
  config: Partial<RuntimeConfig> = {},
): Promise<RunningService> {
  const db: DbDriver = config.db ?? new BetterSqliteDriver();
  const bus: EventBus = config.bus ?? new InMemoryBus();
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

  config.onReady?.({ port });

  return {
    httpPort: port,
    async stop(): Promise<void> {
      healthy = false;
      stopSeenEventsRetention();
      await new Promise<void>((resolve, reject) =>
        server.close((err?: Error) => (err !== undefined && err !== null ? reject(err) : resolve())),
      );
      await pipeline.stop();
      if (bus.stop) await bus.stop();
    },
  };
}
