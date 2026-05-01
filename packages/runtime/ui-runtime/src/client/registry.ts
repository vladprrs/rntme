import { defineCatalog } from '@json-render/core';
import { schema, defineRegistry } from '@json-render/react';
import { shadcnComponentDefinitions } from '@json-render/shadcn/catalog';
import { shadcnComponents } from '@json-render/shadcn';
import * as React from 'react';
import { z } from 'zod';
import type { CompiledScreen, CompiledAction, CompiledDataEndpoint, PropSchema } from '@rntme/ui';
import type { StateStore } from '@json-render/core';
import type { OperationRegistry } from './operation-registry.js';

export type RuntimeBridge = {
  onNavigate: (path: string) => void;
  getScreen: () => CompiledScreen | null;
  store: StateStore;
  fetchEndpoint: (statePath: string, endpoint: CompiledDataEndpoint) => Promise<void>;
  fetchFn: typeof fetch;
  operationRegistry?: OperationRegistry;
};

function propsRecordToZod(props: Record<string, PropSchema>): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [k, sch] of Object.entries(props)) {
    let inner: z.ZodTypeAny;
    switch (sch.type) {
      case 'string':
        inner = z.string();
        break;
      case 'number':
        inner = z.number();
        break;
      case 'boolean':
        inner = z.boolean();
        break;
      case 'object':
        inner = z.record(z.string(), z.unknown());
        break;
      case 'array':
        inner = z.array(z.unknown());
        break;
      default:
        inner = z.unknown();
    }
    if (sch.array === true) inner = z.array(inner);
    shape[k] = sch.required === true ? inner : inner.optional();
  }
  return z.object(shape);
}

export type ModuleSurfaceForRegistry = {
  readonly components: ReadonlyArray<{ type: string; props: Record<string, PropSchema> }>;
  readonly reactByType: Record<string, React.ComponentType<Record<string, unknown>>>;
};

const sharedActions = {
  navigate: {
    params: z.object({ to: z.string() }).passthrough(),
    description:
      'Client-side navigation. :param placeholders in `to` are replaced from remaining params.',
  },
  dispatch: {
    params: z.object({ name: z.string() }),
    description: 'Execute a screen-defined action by name (command, refetch).',
  },
} as const;

export function createRegistry(bridge: RuntimeBridge, surface?: ModuleSurfaceForRegistry | undefined) {
  function resolveActionParams(params: Record<string, unknown> | undefined): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!params) return out;
    for (const [k, v] of Object.entries(params)) {
      if (v && typeof v === 'object' && '$state' in (v as Record<string, unknown>)) {
        out[k] = bridge.store.get((v as { $state: string }).$state);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  const extraDefs: Record<string, { props: z.ZodObject<Record<string, z.ZodTypeAny>> }> = {};
  const extraReact: Record<string, React.ComponentType<Record<string, unknown>>> = {};
  if (surface) {
    for (const c of surface.components) {
      extraDefs[c.type] = { props: propsRecordToZod(c.props) };
      const R = surface.reactByType[c.type];
      if (R) extraReact[c.type] = R;
    }
  }

  const catalog = defineCatalog(schema, {
    components: { ...shadcnComponentDefinitions, ...(extraDefs as typeof shadcnComponentDefinitions) },
    actions: { ...sharedActions },
  });

  const { registry, handlers } = defineRegistry(catalog, {
    components: { ...shadcnComponents, ...extraReact },
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

        if (action.kind === 'module-action') {
          const p = resolveActionParams(action.params as Record<string, unknown> | undefined);
          if (action.target) {
            await bridge.operationRegistry?.lookupComponent(action.target, action.name)?.(p);
          } else if (action.module) {
            await bridge.operationRegistry?.lookupModule(action.module, action.name)?.(p);
          }
          return;
        }

        if (action.kind !== 'command') return;

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
          const res = await bridge.fetchFn(url, {
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
