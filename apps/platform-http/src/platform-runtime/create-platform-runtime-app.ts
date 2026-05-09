import { Hono } from 'hono';
import { createApp as createUiRuntimeApp } from '@rntme/ui-runtime/server';
import type { ComposedBlueprint } from '@rntme/blueprint';

export type CreatePlatformRuntimeAppOptions = {
  readonly blueprint: ComposedBlueprint;
};

export async function createPlatformRuntimeApp(opts: CreatePlatformRuntimeAppOptions): Promise<Hono> {
  const app = new Hono();
  const ui = opts.blueprint.services.app?.compiledUi;
  if (ui === undefined || ui === null) {
    throw new Error('PLATFORM_RUNTIME_UI_MISSING');
  }
  app.route('/', createUiRuntimeApp({ artifact: ui }));
  return app;
}
