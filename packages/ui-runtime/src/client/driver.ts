import type { ValidatedUiArtifact } from '@rntme/ui';
import { createStateStore, type StateStore } from './state-store.js';

type HttpEntry = { method: 'GET' | 'POST'; path: string };

export type CreateUiDriverOptions = {
  artifact: ValidatedUiArtifact;
  bindingsHttpBaseUrl: string;
  fetch?: typeof globalThis.fetch | undefined;
  stateStore?: StateStore | undefined;
  bindingHttpByName: Record<string, HttpEntry>;
  onNavigate?: ((path: string) => void) | undefined;
};

export type UiDriver = {
  enterRoute(path: string): void;
  invokeAction(routePath: string, actionId: string): Promise<void>;
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

  async function invokeAction(routePath: string, actionId: string): Promise<void> {
    const route = opts.artifact.routes[routePath];
    if (!route) return;
    const action = route.actions?.[actionId];
    if (!action) return;
    if (action.kind === 'navigation') {
      const values: Record<string, string> = {};
      for (const [k, sp] of Object.entries(action.paramsFromState ?? {})) {
        const raw = store.get(sp);
        if (raw === undefined || raw === null) return; // missing placeholder — abort
        values[k] = String(raw);
      }
      const target = action.navigateTo.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_, name: string) => {
        const v = values[name];
        if (v === undefined) throw new Error(`invokeAction: missing :${name}`);
        return v;
      });
      opts.onNavigate?.(target);
      return;
    }

    if (action.kind !== 'command') return;

    const http = opts.bindingHttpByName[action.binding];
    if (!http || http.method !== 'POST') return;

    const body: Record<string, unknown> = {};
    for (const [k, sp] of Object.entries(action.paramsFromState)) {
      body[k] = store.get(sp);
    }

    store.set(`/actions/__status/${actionId}`, 'pending');
    try {
      const res = await fetchFn(`${opts.bindingsHttpBaseUrl}${http.path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody: unknown = await res.json().catch(() => ({}));
        const bodyObj = typeof errBody === 'object' && errBody !== null ? errBody : {};
        store.set(`/actions/__error/${actionId}`, { httpStatus: res.status, ...bodyObj });
        store.set(`/actions/__status/${actionId}`, 'error');
        return;
      }
      store.set(`/actions/__status/${actionId}`, 'success');
      const onSuccess = action.onSuccess;

      // Pre-capture placeholder values BEFORE clearFormState may delete them.
      let navTarget: string | undefined;
      if (opts.onNavigate && onSuccess?.navigateTo) {
        const values: Record<string, string> = {};
        for (const [k, sp] of Object.entries(action.paramsFromState)) {
          const raw = store.get(sp);
          if (raw === undefined || raw === null) continue;
          values[k] = String(raw);
        }
        const placeholders = Array.from(
          onSuccess.navigateTo.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g),
          (m) => m[1] as string,
        );
        let allResolved = true;
        for (const ph of placeholders) {
          if (values[ph] === undefined) { allResolved = false; break; }
        }
        if (allResolved) {
          navTarget = onSuccess.navigateTo.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_, name: string) => {
            const v = values[name];
            if (v === undefined) throw new Error(`invokeAction: missing :${name}`);
            return v;
          });
        }
      }

      if (onSuccess?.clearFormState) for (const p of onSuccess.clearFormState) store.reset(p);
      if (onSuccess?.refetchData) for (const ds of onSuccess.refetchData) runQuery(routePath, ds);
      if (navTarget !== undefined) opts.onNavigate?.(navTarget);
    } catch (e) {
      store.set(`/actions/__error/${actionId}`, { httpStatus: 0, message: String(e) });
      store.set(`/actions/__status/${actionId}`, 'error');
    }
  }

  return { enterRoute, invokeAction, stateStore: store };
}
