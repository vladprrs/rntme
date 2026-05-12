import type { Hono } from 'hono';
import pino, { type Logger } from 'pino';
import {
  createBindingsRouter,
  correlationMiddleware,
  requestId,
  requestLogger,
  cors,
  errorHandler,
  securityHeaders,
  bodyLimit,
  rateLimit,
  InMemoryRateLimiter,
  type CorrelationVariables,
} from '@rntme/bindings-http';
import type { OperationExecutor } from '@rntme/bindings-http/operation-contract';
import { createApp as createUiApp } from '@rntme/ui-runtime';
import type { Surface, SurfaceContext } from './interfaces.js';
import { mountObservability, type Metrics, type HealthProbe } from './observability.js';

export type HttpSurfaceOptions = {
  healthPath: string;
  metricsPath: string;
  metrics: Metrics;
  healthProbe: HealthProbe;
  operationExecutor: OperationExecutor;
  logger?: Logger;
};

export type { CorrelationVariables };

export class HttpSurface implements Surface {
  constructor(private readonly opts: HttpSurfaceOptions) {}

  async mount(app: Hono, ctx: SurfaceContext): Promise<void> {
    const logger = this.opts.logger ?? pino({ level: 'info', name: ctx.service.manifest.service.name });
    const httpCfg = ctx.service.manifest.surface.http;

    app.use('*', requestId());
    app.use('*', requestLogger({ logger }));
    app.onError(errorHandler({ logger }));
    if (httpCfg.cors.origins.length > 0) {
      app.use(
        '*',
        cors({
          origins: httpCfg.cors.origins,
          credentials: httpCfg.cors.credentials,
          allowHeaders: httpCfg.cors.allowHeaders,
        }),
      );
    }
    app.use(
      '*',
      securityHeaders({
        ...(httpCfg.securityHeaders.csp === null ? {} : { csp: httpCfg.securityHeaders.csp }),
        contentTypeOptions: httpCfg.securityHeaders.contentTypeOptions,
        referrerPolicy: httpCfg.securityHeaders.referrerPolicy,
      }),
    );

    const routerOpts: Parameters<typeof createBindingsRouter>[0] = {
      validated: ctx.service.bindings,
      graphSpec: ctx.service.graphSpec,
      pdm: ctx.service.pdm,
      qsm: ctx.service.qsm,
      db: ctx.qsmDb,
      eventStore: ctx.eventStore,
      actorFromRequest: ctx.actorFromRequest,
      openApiDoc: ctx.service.openApiDoc,
      operationExecutor: this.opts.operationExecutor,
      operationRegistry: ctx.operationRegistry,
      operationCallClient: ctx.operationCallClient,
    };
    const router = createBindingsRouter(routerOpts);

    app.get('/service.json', (c) =>
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

    const uiApp = createUiApp({
      artifact: ctx.service.compiledUi,
      ...(ctx.service.uiAssetsDir === null ? {} : { assetsDir: ctx.service.uiAssetsDir }),
    });

    if (httpCfg.bodyLimit.enabled) {
      app.use('/api/*', bodyLimit(httpCfg.bodyLimit.maxBytes));
    }
    if (httpCfg.rateLimit.enabled) {
      const limiter = new InMemoryRateLimiter({
        windowMs: httpCfg.rateLimit.windowMs,
        max: httpCfg.rateLimit.max,
      });
      // Per-process bucket — Hono's Node adapter cannot expose a trusted peer
      // address. The same conservative default the previous inline limiter used.
      app.use('/api/*', rateLimit(limiter, () => 'process'));
    }
    app.use('/api/*', correlationMiddleware());
    app.route('/api', router);

    app.route('/', uiApp);
  }
}
