import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { ValidatedUiArtifact } from '@rntme/ui';
import { createStateStore } from './state-store.js';
import { createRouter, type RouteEvent } from './router.js';
import { createUiDriver, type UiDriver } from './driver.js';
import { buildHandlers } from './handlers.js';
import { buildRegistry } from './registry.js';

type ArtifactPayload = {
  artifact: ValidatedUiArtifact;
  config: { bindingsHttpOrigin: string };
};

type HttpEntry = { method: 'GET' | 'POST'; path: string };

export async function hydrateApp(opts: { rootSelector: string }): Promise<void> {
  const container = document.querySelector(opts.rootSelector);
  if (!container) throw new Error(`hydrateApp: ${opts.rootSelector} not found`);

  const payload = (await (await fetch('/ui/__artifact.json')).json()) as ArtifactPayload;

  const bindingHttpByName: Record<string, HttpEntry> =
    (payload as unknown as { resolvedHttp?: Record<string, HttpEntry> }).resolvedHttp ?? {};

  const store = createStateStore();
  let currentRoute = Object.keys(payload.artifact.routes)[0] ?? '/';

  // Forward-declare driver so the router callback can reference it before assignment.
  // The callback is invoked at runtime (after both are constructed), so no TDZ error.
  let driver: UiDriver;

  const router = createRouter({
    patterns: Object.keys(payload.artifact.routes),
    onRoute: (e: RouteEvent) => {
      currentRoute = e.pattern;
      store.set('/route/params', e.params);
      driver.enterRoute(e.pattern);
      rerender();
    },
  });

  driver = createUiDriver({
    artifact: payload.artifact,
    bindingsHttpBaseUrl: payload.config.bindingsHttpOrigin,
    stateStore: store,
    bindingHttpByName,
    onNavigate: (path) => router.navigate(path),
  });

  const { registry } = buildRegistry();
  const handlers = buildHandlers(driver, () => currentRoute);
  const root = createRoot(container);

  function rerender(): void {
    const route = payload.artifact.routes[currentRoute];
    if (!route) return;
    // Minimal render: dump the JSON spec for now.
    // Task 22 exercises the full driver pipeline with a proper renderer stub.
    // The real @json-render Renderer can be wired here once the workspace upgrades
    // to zod@^4 / react@^19 (matching @json-render@0.17 peer deps).
    root.render(
      React.createElement(
        'pre',
        {},
        JSON.stringify(
          {
            route: currentRoute,
            spec: route.page,
            handlers: Object.keys(handlers),
            registry: typeof registry,
          },
          null,
          2,
        ),
      ),
    );
  }

  router.navigate(window.location.pathname || '/');
}
