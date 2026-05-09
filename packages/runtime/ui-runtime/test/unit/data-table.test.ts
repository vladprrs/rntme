import { describe, expect, it } from 'vitest';
import { createRegistry } from '../../src/client/registry.js';

describe('DataTable runtime primitive', () => {
  it('registers DataTable in the runtime catalog', () => {
    const bridge = {
      onNavigate: () => undefined,
      getScreen: () => null,
      store: { get: () => undefined, set: () => undefined, subscribe: () => () => undefined },
      fetchEndpoint: async () => undefined,
      fetchFn: fetch,
    };
    const { catalog } = createRegistry(bridge as never);
    expect(catalog.data.components.DataTable).toBeDefined();
  });
});
