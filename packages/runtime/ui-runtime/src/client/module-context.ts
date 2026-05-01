import type { OperationRegistry } from './operation-registry.js';
import type { LifecycleBus } from './lifecycle-bus.js';
import type { TransportChain, TransportMiddleware } from './transport-chain.js';
import type { StateStore } from '@json-render/core';

export type ModuleBootContext = {
  config: Record<string, unknown>;
  state: {
    get(path: string): unknown;
    set(path: string, value: unknown): void;
    subscribe(path: string, handler: (value: unknown) => void): () => void;
  };
  transport: { use(mw: TransportMiddleware): void };
  on: LifecycleBus['on'];
  registerOperation: (
    name: string,
    handler: (params: Record<string, unknown>) => void | Promise<void>,
  ) => void;
};

export function createModuleBootContext(opts: {
  moduleName: string;
  config: Record<string, unknown>;
  store: StateStore;
  bus: LifecycleBus;
  chain: TransportChain;
  registry: OperationRegistry;
}): ModuleBootContext {
  return {
    config: opts.config,
    state: {
      get: (p) => opts.store.get(p),
      set: (p, v) => opts.store.set(p, v),
      subscribe: (path, handler) => {
        let last = opts.store.get(path);
        return opts.store.subscribe(() => {
          const next = opts.store.get(path);
          if (next !== last) {
            last = next;
            handler(next);
          }
        });
      },
    },
    transport: { use: (mw) => opts.chain.use(mw) },
    on: opts.bus.on,
    registerOperation: (name, h) => opts.registry.registerModule(opts.moduleName, name, h),
  };
}
