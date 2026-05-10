import type { ModuleBootContext } from '@rntme/contracts-client-runtime-v1';
import { describe, expect, it, mock } from 'bun:test';
import { registerStorageOperations } from '../../src/client/operations.js';

function createCtx(
  response: Response,
): ModuleBootContext & { handlers: Record<string, (params: Record<string, unknown>) => unknown>; requests: Request[] } {
  const handlers: Record<string, (params: Record<string, unknown>) => unknown> = {};
  const requests: Request[] = [];
  return {
    config: {},
    state: { get: () => undefined, set: () => undefined, subscribe: () => () => undefined },
    transport: {
      fetch: mock(async (request: Request) => {
        requests.push(request);
        return response;
      }),
      use: mock(),
    },
    on: mock(),
    registerOperation: mock((name, handler) => {
      handlers[name] = handler;
    }),
    handlers,
    requests,
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
    const request = ctx.requests[0];
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/storage/PrepareUpload');
  });
});
