import { describe, expect, it, vi } from 'vitest';
import { createLifecycleBus } from '../../src/lifecycle-bus.js';
import { createModuleBootContext } from '../../src/module-context.js';
import { createOperationRegistry } from '../../src/operation-registry.js';
import { createTransportChain } from '../../src/transport-chain.js';
import type { StateStore } from '@json-render/core';

describe('createModuleBootContext', () => {
  it('exposes the host transport fetch chain', async () => {
    const fetch = vi.fn(async () => new Response('ok'));
    const ctx = createModuleBootContext({
      moduleName: '@rntme/test',
      config: {},
      store: {
        get: () => undefined,
        set: () => undefined,
        update: () => undefined,
        getSnapshot: () => ({}),
        subscribe: () => () => undefined,
      } satisfies StateStore,
      bus: createLifecycleBus(),
      chain: createTransportChain(fetch),
      registry: createOperationRegistry(),
    });

    const res = await ctx.transport.fetch(new Request('https://example.test'));

    expect(await res.text()).toBe('ok');
    expect(fetch).toHaveBeenCalled();
  });
});
