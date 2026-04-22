import type { Hono } from 'hono';
import {
  createBindingsRouter,
  correlationMiddleware,
  type CorrelationVariables,
} from '@rntme/bindings-http';
import { createApp as createUiApp } from '@rntme/ui-runtime';
import type { Surface, SurfaceContext } from './interfaces.js';
import { mountObservability, type Metrics, type HealthProbe } from './observability.js';
import type { CommandExecutor, QueryExecutor } from './executors/types.js';
import type { ExternalAdapterClient } from './adapter-client/index.js';

export type HttpSurfaceOptions = {
  healthPath: string;
  metricsPath: string;
  metrics: Metrics;
  healthProbe: HealthProbe;
  commandExecutor?: CommandExecutor;
  queryExecutor?: QueryExecutor;
  externalAdapterClient?: ExternalAdapterClient;
};

export type { CorrelationVariables };

export class HttpSurface implements Surface {
  constructor(private readonly opts: HttpSurfaceOptions) {}

  async mount(app: Hono, ctx: SurfaceContext): Promise<void> {
    const routerOpts: Parameters<typeof createBindingsRouter>[0] = {
      validated: ctx.service.bindings,
      graphSpec: ctx.service.graphSpec,
      pdm: ctx.service.pdm,
      qsm: ctx.service.qsm,
      db: ctx.qsmDb,
      eventStore: ctx.eventStore,
      actorFromRequest: ctx.actorFromRequest,
      openApiDoc: ctx.service.openApiDoc,
    };
    if (this.opts.commandExecutor !== undefined) {
      routerOpts.commandExecutor = this.opts.commandExecutor;
    }
    if (this.opts.externalAdapterClient !== undefined) {
      routerOpts.externalAdapterClient = this.opts.externalAdapterClient;
    }
    const router = createBindingsRouter(routerOpts);

    app.get('/', (c) =>
      c.json({
        name: ctx.service.manifest.service.name,
        version: ctx.service.manifest.service.version,
        rntmeVersion: ctx.service.manifest.rntmeVersion,
      }),
    );
    mountObservability(app, {
      healthPath: this.opts.healthPath,
      metricsPath: this.opts.metricsPath,
      probe: this.opts.healthProbe,
      metrics: this.opts.metrics,
    });

    const uiApp = createUiApp({ artifact: ctx.service.compiledUi });
    // Mount correlation middleware BEFORE the bindings router so every
    // /api request gets a CorrelationCtx. Command handlers read it via
    // `c.var.correlation` (typed by CorrelationVariables).
    app.use('/api/*', correlationMiddleware());
    app.route('/api', router);

    const studioCfg = ctx.service.manifest.studio;
    if (studioCfg?.enabled) {
      const { mountStudio } = await import('@rntme/db-studio');
      mountStudio(app, {
        eventStoreDb: ctx.eventStore.getDbHandle(),
        qsmDb: ctx.qsmDb,
        config: studioCfg,
      });
    }

    app.route('/', uiApp);
  }
}
