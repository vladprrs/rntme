import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { CompiledManifest, CompiledScreen, CompiledDataEndpoint } from '@rntme/ui';
import { matchRoute } from './router.js';
import { createScreenLoader } from './screen-loader.js';
import { createStateStore } from './state-store.js';
import { createRegistry } from './registry.js';
import { AppShell } from './layout-manager.js';

function buildUrl(path: string, params?: Record<string, unknown>, stateGetter?: (path: string) => unknown): string {
  let url = path;
  // Replace path params like {id} with actual values
  url = url.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = params?.[key];
    if (value !== undefined) return String(value);
    return `{${key}}`;
  });

  // Build query string from remaining params (non-path-template params)
  const queryParams: Record<string, unknown> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      // Skip params that were used as path params
      if (path.includes(`{${k}}`)) continue;
      // Resolve $state references
      if (v && typeof v === 'object' && '$state' in (v as Record<string, unknown>)) {
        queryParams[k] = stateGetter?.((v as { $state: string }).$state);
      } else {
        queryParams[k] = v;
      }
    }
  }

  const qs = Object.entries(queryParams)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  return qs ? `${url}?${qs}` : url;
}

export async function hydrateApp(opts: { rootSelector: string }): Promise<void> {
  const container = document.querySelector(opts.rootSelector);
  if (!container) throw new Error(`hydrateApp: ${opts.rootSelector} not found`);

  const manifestRes = await fetch('/_manifest.json');
  const manifest = (await manifestRes.json()) as CompiledManifest;

  const loader = createScreenLoader();
  const patterns = Object.keys(manifest.routes);
  const store = createStateStore();

  let currentLayout: CompiledScreen | null = null;
  let currentScreen: CompiledScreen | null = null;
  let currentLayoutName: string | null = null;

  async function fetchEndpoint(statePath: string, endpoint: CompiledDataEndpoint): Promise<void> {
    const url = buildUrl(endpoint.path, endpoint.params, (p) => store.get(p));
    try {
      const res = await fetch(url, {
        method: endpoint.method,
        headers: { 'content-type': 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      store.set(statePath, data);
    } catch (e) {
      console.error(`[rntme] fetch ${statePath} failed:`, e);
    }
  }

  const { registry, handlers } = createRegistry({
    onNavigate: (path) => {
      window.history.pushState({}, '', path);
      void enterRoute(path);
    },
    getScreen: () => currentScreen,
    store,
    fetchEndpoint,
  });

  // Create action handlers using the defineRegistry handlers() function
  // getSetState returns a setState function compatible with json-render's SetState type
  // getState returns the current state snapshot
  const actionHandlers = handlers(
    () => (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
      const next = updater(store.getSnapshot());
      store.update(next);
    },
    () => store.getSnapshot(),
  );

  async function enterRoute(path: string): Promise<void> {
    const match = matchRoute(patterns, path);
    if (!match) return;

    const routeEntry = manifest.routes[match.pattern];
    if (!routeEntry) return;

    for (const [k, v] of Object.entries(match.params)) {
      store.set(`/route/params/${k}`, v);
    }

    if (routeEntry.layout !== currentLayoutName) {
      currentLayout = await loader.loadLayout(routeEntry.layout);
      currentLayoutName = routeEntry.layout;
    }

    currentScreen = await loader.loadScreen(routeEntry.screen);
    rerender();

    // Fetch data for mount-triggered endpoints
    if (currentScreen.data) {
      const fetches = Object.entries(currentScreen.data)
        .filter(([, ep]) => ep.refetchOn?.includes('mount'))
        .map(([statePath, ep]) => fetchEndpoint(statePath, ep));
      await Promise.all(fetches);
    }
  }

  const root = createRoot(container);

  function rerender(): void {
    root.render(
      React.createElement(AppShell, {
        layoutSpec: currentLayout?.spec ?? null,
        screenSpec: currentScreen?.spec ?? null,
        registry,
        actionHandlers,
        store,
      }),
    );
  }

  // Subscribe to store changes to trigger re-renders
  store.subscribe(() => rerender());

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
