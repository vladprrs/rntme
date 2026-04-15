import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  parseBindingArtifact,
  validateBindings,
  generateOpenApi,
} from '@rntme/bindings';
import { createBindingsRouter } from '@rntme/bindings-http';
import type { ActorRef } from '@rntme/event-store';
import { validateUi } from '@rntme/ui';
import { createUiApp, buildBindingResolver, buildComponentResolver } from '@rntme/ui-runtime';
import type { UiArtifact } from '@rntme/ui';
import { buildEventPipeline } from './events.js';
import {
  bindingsArtifact,
  graphSpec,
  pdm,
  qsm,
  resolvers,
} from './artifacts.js';
import { ui } from './ui.js';

function resolveUiRoutePath(path: string, routes: UiArtifact['routes']): boolean {
  if (path in routes) return true;
  const pathSegs = path.split('/').filter(Boolean);
  for (const pattern of Object.keys(routes)) {
    const ps = pattern.split('/').filter(Boolean);
    if (ps.length !== pathSegs.length) continue;
    let ok = true;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      const b = pathSegs[i];
      if (a === undefined || b === undefined) {
        ok = false;
        break;
      }
      if (a.startsWith(':')) continue;
      if (a !== b) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function actorFromRequest(c: Context): ActorRef | null {
  const actorId = c.req.header('x-actor-id');
  if (!actorId) return null;
  return { kind: 'user', id: actorId };
}

export function buildApp(): { app: Hono; stop: () => Promise<void> } {
  const parsed = parseBindingArtifact(bindingsArtifact);
  if (!parsed.ok) {
    throw new Error(`Binding parse failed: ${JSON.stringify(parsed.errors)}`);
  }

  const validated = validateBindings(parsed.value, resolvers);
  if (!validated.ok) {
    throw new Error(`Binding validation failed: ${JSON.stringify(validated.errors)}`);
  }

  const uiValidated = validateUi(ui, {
    resolveBinding: buildBindingResolver(validated.value, resolvers.resolveShape),
    resolveComponent: buildComponentResolver(),
    resolveRoute: (p) => resolveUiRoutePath(p, ui.routes),
  });
  if (!uiValidated.ok) {
    throw new Error(`UI validation failed: ${JSON.stringify(uiValidated.errors)}`);
  }

  const openapi = generateOpenApi(validated.value, resolvers);
  if (!openapi.ok) {
    throw new Error(`OpenAPI generation failed: ${JSON.stringify(openapi.errors)}`);
  }

  const pipeline = buildEventPipeline();
  pipeline.start();

  const router = createBindingsRouter({
    validated: validated.value,
    graphSpec,
    pdm,
    qsm,
    db: pipeline.qsmDb,
    eventStore: pipeline.eventStore,
    actorFromRequest,
    openApiDoc: openapi.value,
  });

  const app = new Hono();
  app.get('/', (c) =>
    c.json({
      name: 'issue-tracker-api-demo',
      ui: 'GET /ui — SPA (issue list, create issue, detail actions)',
      routes: [
        'GET  /v1/issues?status=&limit=',
        'GET  /v1/issues/:id',
        'GET  /v1/issues/search?q=&from=&to=&priority=&limit=',
        'GET  /v1/stats/by-project',
        'GET  /v1/sprints/:sprintId/burndown',
        'POST /v1/issues',
        'POST /v1/issues/:issueId/actions/submit',
        'POST /v1/issues/:issueId/actions/assign',
        'POST /v1/issues/:issueId/actions/assign-with-guard',
        'POST /v1/issues/:issueId/actions/reassign',
        'POST /v1/issues/:issueId/actions/resolve',
        'POST /v1/issues/:issueId/actions/reopen',
        'POST /v1/issues/:issueId/actions/close',
        'GET  /openapi.json',
      ],
    }),
  );
  app.route('/', router);
  app.route(
    '/',
    createUiApp({
      artifact: uiValidated.value,
      validatedBindings: validated.value,
      defaultHeaders: { 'x-actor-id': 'alice' },
    }),
  );

  return { app, stop: () => pipeline.stop() };
}

const PORT = Number(process.env.PORT ?? 3000);

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/server.ts') === true;

if (isMain) {
  const { app, stop } = buildApp();
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    // eslint-disable-next-line no-console
    console.log(`issue-tracker-api-demo listening on http://localhost:${info.port}`);
  });
  const shutdown = async (): Promise<void> => {
    await stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
