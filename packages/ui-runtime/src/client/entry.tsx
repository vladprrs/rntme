import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { CompiledManifest, CompiledScreen, CompiledSpec } from '@rntme/ui';
import { matchRoute } from './router.js';
import { createScreenLoader } from './screen-loader.js';
import { createDriver } from './driver.js';
import { LayoutManager } from './layout-manager.js';

export async function hydrateApp(opts: { rootSelector: string }): Promise<void> {
  const container = document.querySelector(opts.rootSelector);
  if (!container) throw new Error(`hydrateApp: ${opts.rootSelector} not found`);

  const manifestRes = await fetch('/_manifest.json');
  const manifest = (await manifestRes.json()) as CompiledManifest;

  const loader = createScreenLoader();
  const patterns = Object.keys(manifest.routes);
  const state: Record<string, unknown> = {};

  function getState(path: string): unknown {
    return state[path];
  }

  function setState(path: string, value: unknown): void {
    state[path] = value;
    rerender();
  }

  let currentLayout: CompiledScreen | null = null;
  let currentScreen: CompiledScreen | null = null;
  let currentLayoutName: string | null = null;

  const driver = createDriver({
    fetchFn: fetch,
    onStateChange: setState,
    onNavigate: (path) => {
      window.history.pushState({}, '', path);
      void enterRoute(path);
    },
  });

  async function enterRoute(path: string): Promise<void> {
    const match = matchRoute(patterns, path);
    if (!match) return;

    const routeEntry = manifest.routes[match.pattern];
    if (!routeEntry) return;

    for (const [k, v] of Object.entries(match.params)) {
      setState(`/route/params/${k}`, v);
    }

    if (routeEntry.layout !== currentLayoutName) {
      currentLayout = await loader.loadLayout(routeEntry.layout);
      currentLayoutName = routeEntry.layout;
    }

    currentScreen = await loader.loadScreen(routeEntry.screen);
    rerender();

    await driver.enterScreen(currentScreen);
  }

  const root = createRoot(container);

  function renderSpec(spec: CompiledSpec, key: string): React.ReactNode {
    return React.createElement('pre', { key }, JSON.stringify(spec, null, 2));
  }

  function rerender(): void {
    root.render(
      React.createElement(LayoutManager, {
        layout: currentLayout,
        screen: currentScreen,
        renderSpec,
      }),
    );
  }

  const initialPath = window.location.pathname || '/';
  await enterRoute(initialPath);

  window.addEventListener('popstate', () => {
    void enterRoute(window.location.pathname);
  });
}

void hydrateApp({ rootSelector: '#root' }).catch((err: unknown) => {
  console.error('[rntme ui-runtime]', err);
  const el = document.querySelector('#root');
  if (el) el.textContent = err instanceof Error ? err.message : String(err);
});
