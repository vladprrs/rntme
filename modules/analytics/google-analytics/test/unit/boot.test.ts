import { describe, expect, it, mock } from 'bun:test';
import { boot } from '../../src/client.js';
import type { ModuleBootContext } from '@rntme/contracts-client-runtime-v1';

function mockCtx(config: Record<string, unknown>): ModuleBootContext {
  const subs = new Map<string, Array<(v: unknown) => void>>();
  return {
    config,
    state: {
      get: () => undefined,
      set: mock(),
      subscribe: (path, h) => {
        const arr = subs.get(path) ?? [];
        arr.push(h);
        subs.set(path, arr);
        return () => undefined;
      },
    },
    transport: { use: mock() },
    on: mock(() => () => undefined),
    registerOperation: mock(),
  };
}

describe('boot', () => {
  it('registers track and identify', () => {
    const ctx = mockCtx({ measurementId: 'G-X' });
    boot(ctx);
    expect(ctx.registerOperation).toHaveBeenCalled();
  });
});
