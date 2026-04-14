import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import {
  parseBindingArtifact,
  validateBindings,
  generateOpenApi,
} from '@rntme/bindings';
import { createBindingsRouter } from '@rntme/bindings-http';
import { createSeededDb } from './db/seed.js';
import {
  bindingsArtifact,
  graphSpec,
  pdm,
  qsm,
  resolvers,
} from './artifacts.js';

export function buildApp(): { app: Hono; cleanup: () => void } {
  const parsed = parseBindingArtifact(bindingsArtifact);
  if (!parsed.ok) {
    throw new Error(`Binding parse failed: ${JSON.stringify(parsed.errors)}`);
  }

  const validated = validateBindings(parsed.value, resolvers);
  if (!validated.ok) {
    throw new Error(`Binding validation failed: ${JSON.stringify(validated.errors)}`);
  }

  const openapi = generateOpenApi(validated.value, resolvers);
  if (!openapi.ok) {
    throw new Error(`OpenAPI generation failed: ${JSON.stringify(openapi.errors)}`);
  }

  const db = createSeededDb();

  const router = createBindingsRouter({
    validated: validated.value,
    graphSpec,
    pdm,
    qsm,
    db,
    openApiDoc: openapi.value,
  });

  const app = new Hono();
  app.get('/', (c) =>
    c.json({
      name: 'issue-tracker-api-demo',
      routes: [
        'GET /v1/issues?status=&limit=',
        'GET /v1/issues/:id',
        'GET /v1/issues/search?q=&from=&to=&priority=&limit=',
        'GET /v1/stats/by-project',
        'GET /v1/sprints/:sprintId/burndown',
        'GET /openapi.json',
      ],
    }),
  );
  app.route('/', router);

  return { app, cleanup: () => db.close() };
}

const PORT = Number(process.env.PORT ?? 3000);

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/server.ts') === true;

if (isMain) {
  const { app, cleanup } = buildApp();
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    // eslint-disable-next-line no-console
    console.log(`issue-tracker-api-demo listening on http://localhost:${info.port}`);
  });
  const shutdown = (): void => {
    cleanup();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
