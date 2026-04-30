import { describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/client.js';
import type { ModuleBootContext } from '@rntme/ui-runtime/client';

function mockCtx(config: Record<string, unknown>): ModuleBootContext {
  const subs = new Map<string, Array<(v: unknown) => void>>();
  return {
    config,
    state: {
      get: () => undefined,
      set: vi.fn(),
      subscribe: (path, h) => {
        const arr = subs.get(path) ?? [];
        arr.push(h);
        subs.set(path, arr);
        return () => undefined;
      },
    },
    transport: { use: vi.fn() },
    on: vi.fn(() => () => undefined),
    registerOperation: vi.fn(),
  };
}

describe('boot', () => {
  it('registers track and identify', () => {
    const ctx = mockCtx({ measurementId: 'G-X' });
    boot(ctx);
    expect(ctx.registerOperation).toHaveBeenCalled();
  });
});
