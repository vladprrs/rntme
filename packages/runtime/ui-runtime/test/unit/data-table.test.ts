import './dom-setup';
import { describe, expect, it } from 'bun:test';

const { createRegistry } = await import('../../src/client/registry.js');

describe('Table runtime primitive', () => {
  it('registers Table in the runtime catalog without platform DataTable', () => {
    const bridge = {
      onNavigate: () => undefined,
      getScreen: () => null,
      store: { get: () => undefined, set: () => undefined, subscribe: () => () => undefined },
      fetchEndpoint: async () => undefined,
      fetchFn: fetch,
    };
    const { catalog } = createRegistry(bridge as never);
    expect(catalog.data.components.Table).toBeDefined();
    expect(catalog.data.components.DataTable).toBeUndefined();
    expect(catalog.data.components.PlatformDataTable).toBeUndefined();
  });
});
