import { createContext, useCallback, useContext } from 'react';
import type { OperationRegistry } from './operation-registry.js';
import type { TransportChain } from './transport-chain.js';
import type { StateStore } from '@json-render/core';

const TransportContext = createContext<TransportChain | null>(null);
const StoreContext = createContext<StateStore | null>(null);
const RegistryContext = createContext<OperationRegistry | null>(null);

export const TransportProvider = TransportContext.Provider;
export const StoreProvider = StoreContext.Provider;
export const RegistryProvider = RegistryContext.Provider;

export function useTransport(): (req: Request) => Promise<Response> {
  const c = useContext(TransportContext);
  if (!c) throw new Error('useTransport requires <TransportProvider>');
  return c.fetch.bind(c);
}

export function useStateStore(): StateStore {
  const c = useContext(StoreContext);
  if (!c) throw new Error('useStateStore requires <StoreProvider>');
  return c;
}

export function useOperationRegistry(): {
  register(
    elementId: string,
    handlers: Record<string, (params: Record<string, unknown>) => void | Promise<void>>,
  ): () => void;
} {
  const c = useContext(RegistryContext);
  if (!c) throw new Error('useOperationRegistry requires <RegistryProvider>');
  return { register: (eid, hs) => c.registerComponent(eid, hs) };
}

export function useModuleAction(
  moduleName: string,
  name: string,
): (params?: Record<string, unknown>) => Promise<void> {
  const registry = useContext(RegistryContext);
  return useCallback(
    async (params: Record<string, unknown> = {}) => {
      await registry?.lookupModule(moduleName, name)?.(params);
    },
    [moduleName, name, registry],
  );
}
