import type { ValidatedUiArtifact } from '@rntme/ui';
import { createStateStore, type StateStore } from './state-store.js';

type HttpEntry = { method: 'GET' | 'POST'; path: string };

export type CreateUiDriverOptions = {
  artifact: ValidatedUiArtifact;
  bindingsHttpBaseUrl: string;
  fetch?: typeof globalThis.fetch | undefined;
  stateStore?: StateStore | undefined;
  bindingHttpByName: Record<string, HttpEntry>;
};

export type UiDriver = {
  enterRoute(path: string): void;
  stateStore: StateStore;
};

export function createUiDriver(opts: CreateUiDriverOptions): UiDriver {
  const store = opts.stateStore ?? createStateStore();
  const fetchFn = opts.fetch ?? globalThis.fetch;

  function runQuery(routePath: string, datasetId: string): void {
    const route = opts.artifact.routes[routePath];
    if (!route) return;
    const def = route.data?.[datasetId];
    if (!def) return;
    const http = opts.bindingHttpByName[def.binding];
    if (!http || http.method !== 'GET') return;

    const params = def.params ?? {};
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'object' && '$state' in (v as Record<string, unknown>)) {
        const resolved = store.get((v as { $state: string }).$state);
        if (resolved === undefined || resolved === null) continue;
        qs.set(k, String(resolved));
      } else {
        qs.set(k, String(v));
      }
    }
    const url = `${opts.bindingsHttpBaseUrl}${http.path}${qs.toString() ? `?${qs}` : ''}`;

    store.set(`/data/__status/${datasetId}`, 'pending');
    fetchFn(url, { method: 'GET' })
      .then((res) => {
        if (!res.ok) {
          const status = res.status;
          return (res.json() as Promise<unknown>)
            .catch(() => ({}))
            .then((body: unknown) => {
              const bodyObj = typeof body === 'object' && body !== null ? body : {};
              store.set(`/data/__error/${datasetId}`, { httpStatus: status, ...bodyObj });
              store.set(`/data/__status/${datasetId}`, 'error');
            });
        }
        return (res.json() as Promise<unknown>).then((value) => {
          store.set(`/data/${datasetId}`, value);
          store.set(`/data/__status/${datasetId}`, 'success');
        });
      })
      .catch((e: unknown) => {
        store.set(`/data/__error/${datasetId}`, { httpStatus: 0, message: String(e) });
        store.set(`/data/__status/${datasetId}`, 'error');
      });
  }

  function enterRoute(routePath: string): void {
    const route = opts.artifact.routes[routePath];
    if (!route) return;
    for (const datasetId of Object.keys(route.data ?? {})) {
      runQuery(routePath, datasetId);
    }
  }

  return { enterRoute, stateStore: store };
}
