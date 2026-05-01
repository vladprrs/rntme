import type { Hono, MiddlewareHandler } from 'hono';
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
import type {
  ValidatedHttpBodyLimitConfig,
  ValidatedHttpRateLimitConfig,
} from '../manifest/types.js';

export type HttpSurfaceOptions = {
  healthPath: string;
  metricsPath: string;
  metrics: Metrics;
  healthProbe: HealthProbe;
  commandExecutor?: CommandExecutor;
  queryExecutor?: QueryExecutor;
  externalAdapterClient?: ExternalAdapterClient | undefined;
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
    if (this.opts.metrics !== undefined) {
      routerOpts.metrics = this.opts.metrics;
    }
    const router = createBindingsRouter(routerOpts);
    const rateLimiter = createInMemoryRateLimiter(ctx.service.manifest.surface.http.rateLimit);

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

    const uiApp = createUiApp({
      artifact: ctx.service.compiledUi,
      ...(ctx.service.uiAssetsDir === null ? {} : { assetsDir: ctx.service.uiAssetsDir }),
    });
    // Mount correlation middleware BEFORE the bindings router so every
    // /api request gets a CorrelationCtx. Command handlers read it via
    // `c.var.correlation` (typed by CorrelationVariables).
    app.use('/api/*', bodyLimitMiddleware(ctx.service.manifest.surface.http.bodyLimit));
    app.use('/api/*', rateLimiter);
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

function bodyLimitMiddleware(config: ValidatedHttpBodyLimitConfig): MiddlewareHandler {
  return async (c, next): Promise<Response | void> => {
    if (!config.enabled) {
      await next();
      return;
    }

    const contentLength = c.req.header('content-length');
    if (contentLength !== undefined) {
      const n = Number(contentLength);
      if (Number.isFinite(n) && n > config.maxBytes) {
        return c.json({ error: 'REQUEST_BODY_TOO_LARGE', maxBytes: config.maxBytes }, 413);
      }
      if (Number.isFinite(n)) {
        await next();
        return;
      }
    }

    const raw = c.req.raw.body;
    if (raw !== null) {
      const reader = raw.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let total = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > config.maxBytes) {
          return c.json({ error: 'REQUEST_BODY_TOO_LARGE', maxBytes: config.maxBytes }, 413);
        }
        const chunk = new Uint8Array(value.byteLength);
        chunk.set(value);
        chunks.push(chunk);
      }
      const body = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      c.req.raw = new Request(c.req.url, {
        method: c.req.method,
        headers: c.req.raw.headers,
        body,
      });
    }

    await next();
  };
}

type RateEntry = { count: number; resetAt: number };

function createInMemoryRateLimiter(config: ValidatedHttpRateLimitConfig): MiddlewareHandler {
  const buckets = new Map<string, RateEntry>();

  return async (c, next): Promise<Response | void> => {
    if (!config.enabled) {
      await next();
      return;
    }

    const now = Date.now();
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    const key = rateLimitKey(c);
    let entry = buckets.get(key);
    if (entry === undefined || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + config.windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, config.max - entry.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    c.header('X-RateLimit-Limit', String(config.max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > config.max) {
      c.header('Retry-After', String(retryAfterSeconds));
      return c.json({ error: 'RATE_LIMITED' }, 429);
    }

    await next();
  };
}

function rateLimitKey(_c: Parameters<MiddlewareHandler>[0]): string {
  // Hono's Node adapter does not expose a trustworthy peer address here.
  // Use a conservative per-process bucket instead of trusting spoofable
  // X-Forwarded-For / X-Real-IP headers.
  return 'process';
}
