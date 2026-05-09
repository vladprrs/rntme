import { Hono } from 'hono';
import { createApp as createUiRuntimeApp } from '@rntme/ui-runtime/server';
import type { ComposedBlueprint, ValidatedServiceMember } from '@rntme/blueprint';
import { generateOpenApi } from '@rntme/bindings';
import type { OpenApiDoc, ValidatedBindings } from '@rntme/bindings';

export type CreatePlatformRuntimeAppOptions = {
  readonly blueprint: ComposedBlueprint;
};

export async function createPlatformRuntimeApp(opts: CreatePlatformRuntimeAppOptions): Promise<Hono> {
  const app = new Hono();
  const ui = opts.blueprint.services.app?.compiledUi;
  if (ui === undefined || ui === null) {
    throw new Error('PLATFORM_RUNTIME_UI_MISSING');
  }

  for (const [slug, service] of Object.entries(opts.blueprint.services)) {
    const router = buildOpenApiRouter(slug, service);
    if (router === null) continue;
    const base = opts.blueprint.routing.httpBaseByService[slug];
    if (base === undefined) continue;
    // TODO(platform-runtime-cutover Task 4+): mount @rntme/bindings-http handlers
    // here once cross-module operation registry/executor wiring is in place.
    app.route(base, router);
  }

  app.route('/', createUiRuntimeApp({ artifact: ui }));
  return app;
}

function buildOpenApiRouter(slug: string, service: ValidatedServiceMember): Hono | null {
  if (service.bindings === null) return null;

  const router = new Hono();
  mountOpenApi(router, slug, service.bindings);
  return router;
}

function mountOpenApi(router: Hono, slug: string, bindings: ValidatedBindings): void {
  const result = generateOpenApi(bindings);
  if (!result.ok) {
    throw new Error(
      `PLATFORM_RUNTIME_OPENAPI_FAILED:${slug}:${JSON.stringify(result.errors)}`,
    );
  }
  const doc: OpenApiDoc = result.value;
  router.get('/openapi.json', (c) => c.json(doc));
}
