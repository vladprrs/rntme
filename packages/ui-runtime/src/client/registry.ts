import { defineCatalog } from '@json-render/core';
import { schema, defineRegistry } from '@json-render/react';
import { shadcnComponentDefinitions } from '@json-render/shadcn/catalog';
import { shadcnComponents } from '@json-render/shadcn';
import { z } from 'zod';
import type { CompiledScreen, CompiledAction, CompiledDataEndpoint } from '@rntme/ui';
import type { StateStore } from './state-store.js';

export type RuntimeBridge = {
  onNavigate: (path: string) => void;
  getScreen: () => CompiledScreen | null;
  store: StateStore;
  fetchEndpoint: (statePath: string, endpoint: CompiledDataEndpoint) => Promise<void>;
};

const catalog = defineCatalog(schema, {
  components: shadcnComponentDefinitions,
  actions: {
    navigate: {
      params: z.object({ to: z.string() }).passthrough(),
      description:
        'Client-side navigation. :param placeholders in `to` are replaced from remaining params.',
    },
    dispatch: {
      params: z.object({ name: z.string() }),
      description: 'Execute a screen-defined action by name (command, refetch).',
    },
  },
});

export function createRegistry(bridge: RuntimeBridge) {
  const { registry, handlers } = defineRegistry(catalog, {
    components: shadcnComponents,
    actions: {
      navigate: async (params) => {
        if (!params) return;
        let target = params.to;
        for (const [k, v] of Object.entries(params)) {
          if (k !== 'to') target = target.replace(`:${k}`, String(v));
        }
        bridge.onNavigate(target);
      },
      dispatch: async (params) => {
        if (!params) return;
        const screen = bridge.getScreen();
        if (!screen?.actions) return;
        const actionName = params.name;
        const action = screen.actions[actionName] as CompiledAction | undefined;
        if (!action) return;

        if (action.kind === 'navigation') {
          let target = action.navigateTo;
          if (action.paramsFromState) {
            for (const [param, statePath] of Object.entries(action.paramsFromState)) {
              target = target.replace(`:${param}`, String(bridge.store.get(statePath) ?? ''));
            }
          }
          bridge.onNavigate(target);
          return;
        }

        if (action.kind === 'refetch') {
          const currentScreen = bridge.getScreen();
          if (!currentScreen?.data) return;
          for (const refetchTarget of action.targets) {
            const endpoint = currentScreen.data[refetchTarget];
            if (endpoint) await bridge.fetchEndpoint(refetchTarget, endpoint);
          }
          return;
        }

        // Command action
        const cmdParams: Record<string, unknown> = {};
        if (action.paramsFromState) {
          for (const [param, statePath] of Object.entries(action.paramsFromState)) {
            cmdParams[param] = bridge.store.get(statePath);
          }
        }

        let url = action.path;
        url = url.replace(/\{([^}]+)\}/g, (_, key: string) => {
          const v = cmdParams[key];
          delete cmdParams[key];
          return String(v ?? '');
        });

        try {
          const res = await fetch(url, {
            method: action.method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(cmdParams),
          });
          if (!res.ok) {
            if (action.onError?.showAlert) {
              const text = await res.text().catch(() => `HTTP ${res.status}`);
              globalThis.alert?.(text) ?? console.error(text);
            }
            return;
          }
          if (action.onSuccess?.refetchData) {
            const currentScreen = bridge.getScreen();
            if (currentScreen?.data) {
              for (const dataPath of action.onSuccess.refetchData) {
                const endpoint = currentScreen.data[dataPath];
                if (endpoint) await bridge.fetchEndpoint(dataPath, endpoint);
              }
            }
          }
          if (action.onSuccess?.navigateTo) {
            bridge.onNavigate(action.onSuccess.navigateTo);
          }
        } catch (e) {
          if (action.onError?.showAlert) {
            const msg = e instanceof Error ? e.message : String(e);
            globalThis.alert?.(msg) ?? console.error(msg);
          }
        }
      },
    },
  });

  return { catalog, registry, handlers };
}
