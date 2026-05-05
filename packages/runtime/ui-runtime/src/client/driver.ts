import type { CompiledScreen, CompiledAction, CompiledDataEndpoint } from '@rntme/ui';
import type { OperationRegistry } from '@rntme/contracts-client-runtime-v1';

export type DriverOptions = {
  fetchFn: typeof fetch;
  onStateChange: (path: string, value: unknown) => void;
  onNavigate: (path: string) => void;
  defaultHeaders?: Record<string, string>;
  operationRegistry?: OperationRegistry;
};

export type Driver = {
  enterScreen: (screen: Pick<CompiledScreen, 'data'>) => Promise<void>;
  dispatchAction: (action: CompiledAction, stateGetter?: (path: string) => unknown) => Promise<void>;
};

function buildUrl(path: string, params?: Record<string, unknown>, stateGetter?: (path: string) => unknown): string {
  let url = path;
  // Replace path parameters like {id}
  url = url.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = params?.[key];
    if (value !== undefined) return String(value);
    return `{${key}}`;
  });

  // Build query params from remaining (non-path-template) params
  const queryParams = { ...params };
  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    delete queryParams[match[1]!];
  }

  // Resolve $state references
  for (const [k, v] of Object.entries(queryParams)) {
    if (v && typeof v === 'object' && '$state' in (v as Record<string, unknown>)) {
      queryParams[k] = stateGetter?.((v as { $state: string }).$state);
    }
  }

  const qs = Object.entries(queryParams)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  return qs ? `${url}?${qs}` : url;
}

export function createDriver(opts: DriverOptions): Driver {
  const { fetchFn, onStateChange, onNavigate, defaultHeaders = {}, operationRegistry } = opts;

  function resolveActionParams(
    params: Record<string, unknown> | undefined,
    stateGetter?: (path: string) => unknown,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!params) return out;
    for (const [k, v] of Object.entries(params)) {
      if (v && typeof v === 'object' && '$state' in (v as Record<string, unknown>)) {
        out[k] = stateGetter?.((v as { $state: string }).$state);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  async function fetchEndpoint(
    statePath: string,
    endpoint: CompiledDataEndpoint,
    stateGetter?: (path: string) => unknown,
  ): Promise<void> {
    const url = buildUrl(endpoint.path, endpoint.params, stateGetter);
    onStateChange(`/data/__status${statePath}`, 'pending');
    try {
      const res = await fetchFn(url, {
        method: endpoint.method,
        headers: { ...defaultHeaders, 'content-type': 'application/json' },
      });
      if (!res.ok) {
        onStateChange(`/data/__status${statePath}`, 'error');
        onStateChange(`/data/__error${statePath}`, `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      onStateChange(statePath, data);
      onStateChange(`/data/__status${statePath}`, 'ok');
    } catch (e) {
      onStateChange(`/data/__status${statePath}`, 'error');
      onStateChange(`/data/__error${statePath}`, e instanceof Error ? e.message : String(e));
    }
  }

  return {
    async enterScreen(screen) {
      if (!screen.data) return;
      const fetches = Object.entries(screen.data).map(([statePath, endpoint]) =>
        fetchEndpoint(statePath, endpoint),
      );
      await Promise.all(fetches);
    },

    async dispatchAction(action, stateGetter) {
      if (action.kind === 'module-action') {
        if (!operationRegistry) return;
        const params = resolveActionParams(
          action.params as Record<string, unknown> | undefined,
          stateGetter,
        );
        try {
          if (action.target) {
            await operationRegistry.lookupComponent(action.target, action.name)?.(params);
          } else if (action.module) {
            await operationRegistry.lookupModule(action.module, action.name)?.(params);
          }
        } catch (e) {
          console.error('[rntme] module-action dispatch failed:', e);
        }
        return;
      }

      if (action.kind === 'navigation') {
        let target = action.navigateTo;
        if (action.paramsFromState && stateGetter) {
          for (const [param, statePath] of Object.entries(action.paramsFromState)) {
            target = target.replace(`:${param}`, String(stateGetter(statePath) ?? ''));
          }
        }
        onNavigate(target);
        return;
      }

      if (action.kind === 'refetch') {
        // Refetch actions are handled by the registry's dispatch handler.
        // The driver does not handle them directly.
        return;
      }

      // Command action
      const params: Record<string, unknown> = {};
      if (action.paramsFromState && stateGetter) {
        for (const [param, statePath] of Object.entries(action.paramsFromState)) {
          params[param] = stateGetter(statePath);
        }
      }

      let url = action.path;
      url = url.replace(/\{([^}]+)\}/g, (_, key: string) => {
        const v = params[key];
        delete params[key];
        return String(v ?? '');
      });

      try {
        const res = await fetchFn(url, {
          method: action.method,
          headers: { ...defaultHeaders, 'content-type': 'application/json' },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          if (action.onError?.showAlert) {
            const text = await res.text().catch(() => `HTTP ${res.status}`);
            globalThis.alert?.(text) ?? console.error(text);
          }
          return;
        }
        if (action.onSuccess?.navigateTo) {
          onNavigate(action.onSuccess.navigateTo);
        }
      } catch (e) {
        if (action.onError?.showAlert) {
          const msg = e instanceof Error ? e.message : String(e);
          globalThis.alert?.(msg) ?? console.error(msg);
        }
      }
    },
  };
}
