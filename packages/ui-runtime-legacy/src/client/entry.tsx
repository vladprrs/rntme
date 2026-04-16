import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { ValidatedUiArtifact } from '@rntme/ui-legacy';
import { createStateStore } from './state-store.js';
import { createRouter, matchRoute, stripMountPath, fullMountPath } from './router.js';
import { createUiDriver, type UiDriver } from './driver.js';
import { buildHandlers } from './handlers.js';
import { RouteView } from './minimal-render.js';

declare global {
  interface Window {
    __RNTME_UI_MOUNT__?: string;
  }
}

type HttpEntry = { method: 'GET' | 'POST'; path: string };

type ArtifactPayload = {
  artifact: ValidatedUiArtifact;
  config: {
    bindingsHttpOrigin: string;
    mountPath: string;
    resolvedHttp: Record<string, HttpEntry>;
    defaultHeaders: Record<string, string>;
  };
};

function resolveInitialRoute(patterns: string[], pathname: string, mountPath: string): string {
  const fallback = patterns.includes('/') ? '/' : patterns[0] ?? '/';
  const stripped = stripMountPath(pathname || '/', mountPath);
  if (stripped === '/' || stripped === '') return fallback;
  if (matchRoute(patterns, stripped)) return stripped;
  return fallback;
}

export async function hydrateApp(opts: { rootSelector: string }): Promise<void> {
  const container = document.querySelector(opts.rootSelector);
  if (!container) throw new Error(`hydrateApp: ${opts.rootSelector} not found`);

  const mountFromShell = typeof window !== 'undefined' && window.__RNTME_UI_MOUNT__ ? window.__RNTME_UI_MOUNT__ : '/ui';
  const artifactUrl = fullMountPath(mountFromShell, '/__artifact.json');
  const payload = (await (await fetch(artifactUrl)).json()) as ArtifactPayload;

  const bindingHttpByName: Record<string, HttpEntry> = payload.config.resolvedHttp ?? {};
  const mountPath = payload.config.mountPath ?? '/ui';

  const store = createStateStore();
  const patterns = Object.keys(payload.artifact.routes);
  let currentRoute = patterns[0] ?? '/';

  let driver: UiDriver;

  const router = createRouter({
    patterns,
    mountPath,
    onRoute: (e) => {
      currentRoute = e.pattern;
      store.reset('/route/params');
      for (const [k, v] of Object.entries(e.params)) {
        store.set(`/route/params/${k}`, v);
      }
      driver.enterRoute(e.pattern);
      rerender();
    },
  });

  driver = createUiDriver({
    artifact: payload.artifact,
    bindingsHttpBaseUrl: payload.config.bindingsHttpOrigin,
    stateStore: store,
    bindingHttpByName,
    defaultHeaders: payload.config.defaultHeaders,
    onNavigate: (path) => router.navigate(path),
  });

  const initial = resolveInitialRoute(patterns, window.location.pathname, mountPath);
  const m = matchRoute(patterns, initial);
  if (m) {
    currentRoute = m.pattern;
    store.reset('/route/params');
    for (const [k, v] of Object.entries(m.params)) {
      store.set(`/route/params/${k}`, v);
    }
    driver.enterRoute(m.pattern);
    const full = fullMountPath(mountPath, initial);
    if (window.location.pathname !== full) {
      window.history.replaceState({}, '', full);
    }
  }

  const root = createRoot(container);

  function rerender(): void {
    const route = payload.artifact.routes[currentRoute];
    if (!route) return;
    const layoutId = route.layout;
    const layout = layoutId ? payload.artifact.layouts[layoutId] : undefined;
    const handlers = buildHandlers(driver, () => currentRoute);
    root.render(
      React.createElement(RouteView, {
        route,
        layout,
        store,
        handlers,
      }),
    );
  }

  rerender();
}

void hydrateApp({ rootSelector: '#root' }).catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[rntme ui-runtime]', err);
  const el = document.querySelector('#root');
  if (el) {
    el.textContent = err instanceof Error ? err.message : String(err);
  }
});
