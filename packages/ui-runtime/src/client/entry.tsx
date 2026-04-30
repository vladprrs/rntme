import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type {
  CompiledManifest,
  CompiledScreen,
  CompiledDataEndpoint,
  PropSchema,
} from '@rntme/ui';
import { matchRoute } from './router.js';
import { createScreenLoader } from './screen-loader.js';
import { createRegistry, type ModuleSurfaceForRegistry } from './registry.js';
import { AppShell } from './layout-manager.js';
import { createRuntimeStateStore } from './state.js';
import { createOperationRegistry } from './operation-registry.js';
import { createLifecycleBus } from './lifecycle-bus.js';
import { createTransportChain } from './transport-chain.js';
import { createModuleBootContext, type ModuleBootContext } from './module-context.js';

function resolveParamValue(v: unknown, stateGetter?: (path: string) => unknown): unknown {
  if (v && typeof v === 'object' && '$state' in (v as Record<string, unknown>)) {
    return stateGetter?.((v as { $state: string }).$state);
  }
  return v;
}

function buildUrl(path: string, params?: Record<string, unknown>, stateGetter?: (path: string) => unknown): string {
  let url = path;
  url = url.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const raw = params?.[key];
    const value = resolveParamValue(raw, stateGetter);
    if (value !== undefined && value !== null) return String(value);
    return `{${key}}`;
  });

  const queryParams: Record<string, unknown> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (path.includes(`{${k}}`)) continue;
      const resolved = resolveParamValue(v, stateGetter);
      if (resolved !== undefined) queryParams[k] = resolved;
    }
  }

  const qs = Object.entries(queryParams)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  return qs ? `${url}?${qs}` : url;
}

export type ModuleSpec = {
  name: string;
  boot?: (ctx: ModuleBootContext) => void | Promise<void>;
  bootTimeoutMs?: number;
};

export type MountUiRuntimeOptions = {
  manifestUrl: string;
  target: HTMLElement;
  transport?: typeof fetch | undefined;
  initialState?: Record<string, unknown> | undefined;
  /** Project UI modules: React components keyed by json-render `type` (from module manifests). */
  moduleComponents?: Record<string, React.ComponentType<Record<string, unknown>>> | undefined;
  /** Prop schemas for module components (from compose catalog). */
  moduleCatalogComponents?: ReadonlyArray<{
    type: string;
    props: Record<string, PropSchema>;
  }>;
  /** Optional `boot()` hooks (run before UI mount; use `/config.json` for publicConfig). */
  modules?: ModuleSpec[] | undefined;
};

export type MountUiRuntimeResult = {
  unmount: () => void;
};

export async function mountUiRuntime(opts: MountUiRuntimeOptions): Promise<MountUiRuntimeResult> {
  const fetchImpl = opts.transport ?? fetch.bind(window);

  const manifestRes = await fetchImpl(opts.manifestUrl);
  const manifest = (await manifestRes.json()) as CompiledManifest;

  const loader = createScreenLoader(fetchImpl);
  const patterns = Object.keys(manifest.routes);
  const store = createRuntimeStateStore({
    initialState: opts.initialState,
    readonlyKeys: ['currentUser'],
  });

  let currentLayout: CompiledScreen | null = null;
  let currentScreen: CompiledScreen | null = null;
  let currentLayoutName: string | null = null;
  const operationRegistry = createOperationRegistry();

  const bus = createLifecycleBus();
  const chain = createTransportChain((req) => fetchImpl(req));

  let publicConfig: Record<string, Record<string, unknown>> = {};
  if (opts.modules?.some((m) => m.boot)) {
    try {
      const cfgRes = await fetchImpl('/config.json');
      if (cfgRes.ok) {
        publicConfig = (await cfgRes.json()) as Record<string, Record<string, unknown>>;
      }
    } catch {
      /* optional */
    }
  }

  for (const m of opts.modules ?? []) {
    if (!m.boot) continue;
    const ctx = createModuleBootContext({
      moduleName: m.name,
      config: publicConfig[m.name] ?? {},
      store,
      bus,
      chain,
      registry: operationRegistry,
    });
    const ms = m.bootTimeoutMs ?? 10_000;
    await Promise.race([
      Promise.resolve(m.boot(ctx)),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error(`boot timeout: ${m.name}`)), ms),
      ),
    ]);
  }

  async function fetchEndpoint(statePath: string, endpoint: CompiledDataEndpoint): Promise<void> {
    const url = buildUrl(endpoint.path, endpoint.params, (p) => store.get(p));
    try {
      const res = await fetchImpl(url, {
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

  const surface: ModuleSurfaceForRegistry | undefined =
    opts.moduleCatalogComponents !== undefined && opts.moduleComponents !== undefined
      ? { components: opts.moduleCatalogComponents, reactByType: opts.moduleComponents }
      : undefined;

  const { registry, handlers } = createRegistry(
    {
      onNavigate: (path) => {
        window.history.pushState({}, '', path);
        void enterRoute(path);
      },
      getScreen: () => currentScreen,
      store,
      fetchEndpoint,
      fetchFn: fetchImpl,
      operationRegistry,
    },
    surface,
  );

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

    if (currentScreen.data) {
      const fetches = Object.entries(currentScreen.data)
        .filter(([, ep]) => ep.refetchOn?.includes('mount'))
        .map(([statePath, ep]) => fetchEndpoint(statePath, ep));
      await Promise.all(fetches);
    }
  }

  const root = createRoot(opts.target);

  function rerender(): void {
    root.render(
      React.createElement(AppShell, {
        layoutSpec: currentLayout?.spec ?? null,
        screenSpec: currentScreen?.spec ?? null,
        registry,
        actionHandlers,
        store,
        operationRegistry,
      }),
    );
  }

  store.subscribe(() => rerender());

  const initialPath = window.location.pathname || '/';
  const initialMatch = matchRoute(patterns, initialPath);
  if (!initialMatch) {
    const defaultRoute = patterns[0] ?? '/';
    window.history.replaceState({}, '', defaultRoute);
    await enterRoute(defaultRoute);
  } else {
    await enterRoute(initialPath);
  }

  window.addEventListener('popstate', () => {
    void enterRoute(window.location.pathname);
  });

  return {
    unmount: () => root.unmount(),
  };
}

export async function hydrateApp(opts: {
  rootSelector: string;
  manifestUrl?: string | undefined;
  transport?: typeof fetch | undefined;
  initialState?: Record<string, unknown> | undefined;
  moduleComponents?: Record<string, React.ComponentType<Record<string, unknown>>> | undefined;
  moduleCatalogComponents?: MountUiRuntimeOptions['moduleCatalogComponents'];
  modules?: ModuleSpec[] | undefined;
}): Promise<MountUiRuntimeResult> {
  const target = document.querySelector<HTMLElement>(opts.rootSelector);
  if (!target) throw new Error(`hydrateApp: ${opts.rootSelector} not found`);
  return mountUiRuntime({
    manifestUrl: opts.manifestUrl ?? '/_manifest.json',
    target,
    transport: opts.transport,
    initialState: opts.initialState,
    ...(opts.moduleComponents !== undefined ? { moduleComponents: opts.moduleComponents } : {}),
    ...(opts.moduleCatalogComponents !== undefined
      ? { moduleCatalogComponents: opts.moduleCatalogComponents }
      : {}),
    ...(opts.modules !== undefined ? { modules: opts.modules } : {}),
  });
}
