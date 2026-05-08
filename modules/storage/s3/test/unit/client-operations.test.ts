import type { ModuleBootContext } from '@rntme/contracts-client-runtime-v1';
import { describe, expect, it, vi } from 'vitest';
import { registerStorageOperations } from '../../src/client/operations.js';

function createCtx(response: Response): ModuleBootContext & { handlers: Record<string, (params: Record<string, unknown>) => unknown> } {
  const handlers: Record<string, (params: Record<string, unknown>) => unknown> = {};
  return {
    config: {},
    state: { get: () => undefined, set: () => undefined, subscribe: () => () => undefined },
    transport: {
      fetch: vi.fn(async () => response),
      use: vi.fn(),
    },
    on: vi.fn(),
    registerOperation: vi.fn((name, handler) => {
      handlers[name] = handler;
    }),
    handlers,
  };
}

describe('registerStorageOperations', () => {
  it('registers storage operations through the host transport chain', async () => {
    const ctx = createCtx(Response.json({ fileId: 'f', objectKey: 'k', presigned: { url: 'u', headers: {}, expiresAt: 't' } }));

    registerStorageOperations(ctx);
    const result = await ctx.handlers['storage.upload.prepare']({
      routeId: 'r',
      entityId: 'e',
      filename: 'a.txt',
      contentType: 'text/plain',
      declaredSize: 1,
    });

    expect(result).toEqual({ fileId: 'f', objectKey: 'k', presigned: { url: 'u', headers: {}, expiresAt: 't' } });
    expect(ctx.registerOperation).toHaveBeenCalledTimes(5);
    const request = vi.mocked(ctx.transport.fetch).mock.calls[0][0];
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/storage/PrepareUpload');
  });
});
