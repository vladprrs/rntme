import type { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Database } from 'better-sqlite3';
import { parsePipelineRequest } from './hrana/schema.js';
import { handlePipeline } from './handler/pipeline.js';
import { openReadonlyCompanion } from './handle/readonly.js';
import { renderLanding } from './handler/landing.js';
import { toHranaError, type HranaInlineError } from './errors.js';

export type StudioConfig = {
  enabled: boolean;
  mountPath: string;
  maxRows: number;
};

export type StudioLogger = {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
};

export type MountStudioCtx = {
  eventStoreDb: Database;
  qsmDb: Database;
  config: StudioConfig;
  logger?: StudioLogger;
};

const VALID_TARGETS = new Set(['events', 'qsm']);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function mountStudio(app: Hono, ctx: MountStudioCtx): void {
  if (!ctx.config.enabled) return;

  const { mountPath, maxRows } = ctx.config;
  const logger = ctx.logger;

  const readonlyEvents = openReadonlyCompanion(ctx.eventStoreDb);
  const readonlyQsm = openReadonlyCompanion(ctx.qsmDb);

  const dbByTarget: Record<string, Database> = {
    events: readonlyEvents,
    qsm: readonlyQsm,
  };

  // CORS for all studio routes. `*` is intentional (dev-only feature); no credentials used.
  app.use(`${mountPath}/*`, cors({
    origin: '*',
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Baton'],
    maxAge: 600,
  }));

  // Landing page.
  app.get(mountPath, (c) => {
    const url = new URL(c.req.url);
    const scheme = c.req.header('x-forwarded-proto') ?? url.protocol.replace(':', '');
    const host = c.req.header('host') ?? url.host;
    const html = renderLanding({
      scheme: escapeHtml(scheme),
      host: escapeHtml(host),
      mountPath: escapeHtml(mountPath),
    });
    return c.html(html);
  });

  // Hrana pipeline per target.
  app.post(`${mountPath}/hrana/:target/v3/pipeline`, async (c) => {
    const target = c.req.param('target');
    if (!VALID_TARGETS.has(target)) {
      const inline: HranaInlineError = toHranaError({
        code: 'DB_STUDIO_TARGET_UNKNOWN',
        message: `unknown target: ${target}`,
      });
      return c.json(
        { baton: null, base_url: null, results: [inline] },
        200,
      );
    }

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json(
        {
          baton: null,
          base_url: null,
          results: [
            toHranaError({
              code: 'DB_STUDIO_HRANA_BAD_REQUEST',
              message: 'request body is not valid JSON',
            }),
          ],
        },
        200,
      );
    }

    const parsed = parsePipelineRequest(raw);
    if (!parsed.ok) {
      return c.json(
        {
          baton: null,
          base_url: null,
          results: [toHranaError(parsed.error)],
        },
        200,
      );
    }

    const db = dbByTarget[target] as Database;
    const response = handlePipeline(parsed.value, { db, maxRows });
    logger?.info('studio.pipeline', { target, requests: parsed.value.requests.length });
    return c.json(response, 200);
  });
}
